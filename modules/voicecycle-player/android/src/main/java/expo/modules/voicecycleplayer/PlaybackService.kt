package expo.modules.voicecycleplayer

import android.app.NotificationManager
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaMetadata
import android.media.MediaPlayer
import android.media.session.MediaSession
import android.media.session.PlaybackState
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import android.util.Log
import kotlin.random.Random

/**
 * Foreground media service that owns the whole repetition cycle: playback,
 * completion detection, the silent wait, and the session timer. Nothing here
 * depends on JavaScript, so the cycle continues while the React Native runtime
 * is suspended, the screen is locked, or the app is in the background.
 *
 * All state changes run on the main looper and go through [CycleStateMachine].
 */
class PlaybackService : Service() {

  companion object {
    private const val TAG = "VoiceCycle"
    const val ACTION_START = "expo.modules.voicecycleplayer.START"
    const val ACTION_PAUSE = "expo.modules.voicecycleplayer.PAUSE"
    const val ACTION_RESUME = "expo.modules.voicecycleplayer.RESUME"
    const val ACTION_STOP = "expo.modules.voicecycleplayer.STOP"
    const val EXTRA_URI = "uri"
    const val EXTRA_TITLE = "title"
    const val EXTRA_INTERVAL_MIN_MS = "intervalMinMs"
    const val EXTRA_INTERVAL_MAX_MS = "intervalMaxMs"
    const val EXTRA_PLAYS_MIN = "playsMin"
    const val EXTRA_PLAYS_MAX = "playsMax"
    const val EXTRA_SESSION_MS = "sessionMs"

    /** Tick rate while the app is on screen, so progress and countdowns update every second. */
    private const val VISIBLE_TICK_MS = 1_000L
    /** Ceiling between ticks while the app is hidden. Deadlines are still met exactly. */
    private const val HIDDEN_TICK_MS = 30_000L
    private const val MIN_TICK_MS = 50L
    private const val FADE_STEPS = 15
    private const val FADE_STEP_MS = 200L
    private const val FADE_WAKE_LOCK_MS = FADE_STEPS * FADE_STEP_MS + 5_000L
    private const val WAKE_LOCK_MARGIN_MS = 10 * 60_000L

    /** The running instance, accessed only on the main thread. */
    private var instance: PlaybackService? = null

    /** Whether the app UI is on screen. Accessed only on the main thread. */
    private var uiVisible = true

    /** Delivers a control action to the running service. Returns false if none is running. */
    fun dispatch(action: String): Boolean {
      val service = instance ?: return false
      service.handleControl(action)
      return true
    }

    /** Called on the main thread when the app UI appears or disappears. */
    fun setUiVisible(visible: Boolean) {
      if (uiVisible == visible) return
      uiVisible = visible
      instance?.onUiVisibilityChanged()
    }
  }

  private val handler = Handler(Looper.getMainLooper())
  private val audioAttributes = AudioAttributes.Builder()
    .setUsage(AudioAttributes.USAGE_MEDIA)
    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
    .build()

  private val random: Random = Random.Default
  private var model = CycleModel()
  private var player: MediaPlayer? = null
  private var title: String? = null
  private var durationMs = 0L
  private var finished = false
  private var fading = false
  private var lastNotificationKey: String? = null

  private lateinit var mediaSession: MediaSession
  private lateinit var focus: AudioFocusController
  private lateinit var wakeLock: PowerManager.WakeLock

  private val tickRunnable = Runnable { onTick() }
  private var noisyRegistered = false
  private val noisyReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
      if (intent.action == AudioManager.ACTION_AUDIO_BECOMING_NOISY) {
        dispatchEvent(CycleEvent.Pause(now(), PauseReason.NOISY))
      }
    }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    instance = this
    PlaybackNotification.ensureChannel(this)
    val power = getSystemService(Context.POWER_SERVICE) as PowerManager
    wakeLock = power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "VoiceCycle:session").apply {
      setReferenceCounted(false)
    }
    focus = AudioFocusController(
      this,
      audioAttributes,
      handler,
      onGain = { dispatchEvent(CycleEvent.FocusRegained(now())) },
      onLoss = { permanent ->
        val reason = if (permanent) PauseReason.FOCUS_LOST else PauseReason.INTERRUPTION
        dispatchEvent(CycleEvent.Pause(now(), reason))
      },
    )
    mediaSession = MediaSession(this, "VoiceCycle").apply {
      setCallback(object : MediaSession.Callback() {
        override fun onPlay() = dispatchEvent(CycleEvent.Resume(now()))
        override fun onPause() = dispatchEvent(CycleEvent.Pause(now(), PauseReason.USER))
        override fun onStop() = dispatchEvent(CycleEvent.Stop(now()))
      })
    }
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (val action = intent?.action) {
      ACTION_START -> handleStart(intent)
      null -> stopIfIdle()
      else -> handleControl(action)
    }
    // The cycle cannot be reconstructed after a process death without user intent,
    // so the system must not silently restart the service.
    return START_NOT_STICKY
  }

  override fun onTaskRemoved(rootIntent: Intent?) {
    // Swiping the app away from Recents keeps the session running, like other media apps.
    super.onTaskRemoved(rootIntent)
  }

  override fun onDestroy() {
    if (model.isActive) {
      // Not a user Stop: the system tore the service down mid-session.
      val event = CycleEvent.Failure(now(), "The session was closed by Android")
      model = CycleStateMachine.reduce(model, event).model
      finish()
    }
    handler.removeCallbacksAndMessages(null)
    mediaSession.release()
    instance = null
    super.onDestroy()
  }

  // ---- Commands ------------------------------------------------------------

  private fun handleStart(intent: Intent) {
    val uri = intent.getStringExtra(EXTRA_URI)
    val intervalMinMs = intent.getLongExtra(EXTRA_INTERVAL_MIN_MS, -1)
    val intervalMaxMs = intent.getLongExtra(EXTRA_INTERVAL_MAX_MS, -1)
    val playsMin = intent.getIntExtra(EXTRA_PLAYS_MIN, 1)
    val playsMax = intent.getIntExtra(EXTRA_PLAYS_MAX, playsMin)
    val sessionMs = intent.getLongExtra(EXTRA_SESSION_MS, -1)

    // Every startForegroundService() call must be answered with startForeground(),
    // even when the request is ignored or invalid.
    if (model.isActive) {
      enterForeground() // Keeps the current session's notification. No duplicate session.
      return
    }
    title = intent.getStringExtra(EXTRA_TITLE)
    enterForeground()

    finished = false
    fading = false
    lastNotificationKey = null
    val config = try {
      CycleConfig(intervalMinMs, intervalMaxMs, sessionMs, playsMin, playsMax)
    } catch (e: IllegalArgumentException) {
      return failBeforeStart("Invalid session settings: ${e.message}")
    }
    if (uri.isNullOrBlank()) return failBeforeStart("No recording selected")

    val prepared = try {
      createPlayer(Uri.parse(uri))
    } catch (e: Exception) {
      Log.w(TAG, "Unable to open recording", e)
      return failBeforeStart("The recording could not be opened. Please select it again.")
    }
    player = prepared
    durationMs = prepared.duration.toLong().coerceAtLeast(0)
    mediaSession.setMetadata(
      MediaMetadata.Builder()
        .putString(MediaMetadata.METADATA_KEY_TITLE, title ?: "Recording")
        .putString(MediaMetadata.METADATA_KEY_ARTIST, "VoiceCycle")
        .putLong(MediaMetadata.METADATA_KEY_DURATION, durationMs)
        .build(),
    )
    mediaSession.isActive = true
    CycleStore.markSessionStarted(this, title)
    dispatchEvent(CycleEvent.Start(now(), config, CycleRandom.draw(config, random).roundPlays))
  }

  private fun handleControl(action: String) {
    when (action) {
      ACTION_PAUSE -> dispatchEvent(CycleEvent.Pause(now(), PauseReason.USER))
      ACTION_RESUME -> dispatchEvent(CycleEvent.Resume(now()))
      ACTION_STOP -> dispatchEvent(CycleEvent.Stop(now()))
    }
    stopIfIdle()
  }

  private fun stopIfIdle() {
    if (!model.isActive && player == null) {
      stopForegroundCompat()
      stopSelf()
    }
  }

  // ---- State machine plumbing -----------------------------------------------

  private fun dispatchEvent(event: CycleEvent) {
    if (finished && event !is CycleEvent.Start) return
    val transition = CycleStateMachine.reduce(model, event)
    val previous = model
    model = transition.model
    if (previous.state != model.state || transition.effects.isNotEmpty()) {
      Log.i(
        TAG,
        "${previous.state} -> ${model.state} on ${event::class.simpleName} " +
          "effects=${transition.effects} reps=${model.completedRepetitions} " +
          "round=${model.playsInRound}/${model.roundTarget} waitMs=${model.currentWaitMs} " +
          "sessionLeftMs=${model.sessionRemainingAt(event.nowMs)} reason=${model.pauseReason ?: model.endReason}",
      )
    }
    transition.effects.forEach(::apply)
    if (previous.completedRepetitions != model.completedRepetitions) {
      CycleStore.recordProgress(this, model.completedRepetitions)
    }
    if (model.state == CycleState.STOPPED && transition.effects.contains(Effect.STOP_PLAYER)) {
      finish()
      return
    }
    updateTimers()
    publish()
  }

  private fun apply(effect: Effect) {
    val mp = player ?: return
    when (effect) {
      Effect.START_FROM_BEGINNING -> {
        mp.setVolume(1f, 1f)
        mp.seekTo(0)
        playWithFocus(mp)
      }
      Effect.RESUME_PLAYER -> playWithFocus(mp)
      Effect.PAUSE_PLAYER -> {
        if (mp.isPlaying) mp.pause()
        unregisterNoisy()
      }
      Effect.ENTER_WAIT -> {
        unregisterNoisy()
        focus.abandon()
      }
      Effect.STOP_PLAYER -> Unit // Handled by finish().
      Effect.FADE_AND_STOP -> fadeOutThenFinish(mp)
    }
  }

  /** Starts audio only with focus. Without focus the session pauses until focus returns. */
  private fun playWithFocus(mp: MediaPlayer) {
    when (focus.request()) {
      FocusResult.GRANTED -> {
        mp.start()
        registerNoisy()
      }
      // Usually a phone call. Delayed gain will call onGain and resume automatically.
      FocusResult.DELAYED -> handler.post { dispatchEvent(CycleEvent.Pause(now(), PauseReason.INTERRUPTION)) }
      FocusResult.FAILED -> handler.post { dispatchEvent(CycleEvent.Pause(now(), PauseReason.FOCUS_LOST)) }
    }
  }

  /** Wait and round size to use if the play that just finished ends a round. */
  private fun nextDraw(): Draw = model.config?.let { CycleRandom.draw(it, random) } ?: Draw(0, 1)

  private fun onTick() {
    dispatchEvent(CycleEvent.Tick(now()))
  }

  private fun onUiVisibilityChanged() {
    if (!model.isActive) return
    updateTimers()
    publish() // Fresh position and countdowns the moment the app becomes visible.
  }

  /**
   * Keeps exactly one pending tick while the clocks run, plus a wake lock so the
   * Handler clock keeps advancing with the screen off. The next tick lands exactly
   * on the nearest deadline (end of the wait or of the session). In between it ticks
   * every second while the app is visible and every 30 seconds while it is hidden.
   */
  private fun updateTimers() {
    handler.removeCallbacks(tickRunnable)
    val running = model.state == CycleState.PLAYING || model.state == CycleState.WAITING
    if (!running) {
      if (!fading && wakeLock.isHeld) wakeLock.release()
      return
    }
    val nowMs = now()
    val sessionLeft = model.sessionRemainingAt(nowMs)
    // Bounded timeout so a bug can never hold the CPU awake indefinitely.
    wakeLock.acquire(sessionLeft + WAKE_LOCK_MARGIN_MS)
    val nextDeadline = if (model.state == CycleState.WAITING) {
      minOf(sessionLeft, model.waitRemainingAt(nowMs))
    } else {
      sessionLeft // Recording completion arrives from MediaPlayer, not from ticks.
    }
    val ceiling = if (uiVisible) VISIBLE_TICK_MS else HIDDEN_TICK_MS
    handler.postDelayed(tickRunnable, minOf(ceiling, nextDeadline).coerceAtLeast(MIN_TICK_MS))
  }

  private fun fadeOutThenFinish(mp: MediaPlayer) {
    // The session clock is done, so updateTimers() no longer holds the CPU awake.
    // Hold it explicitly until the fade completes and the service shuts down.
    fading = true
    wakeLock.acquire(FADE_WAKE_LOCK_MS)
    var step = 0
    val fade = object : Runnable {
      override fun run() {
        step++
        val volume = (1f - step.toFloat() / FADE_STEPS).coerceAtLeast(0f)
        runCatching { mp.setVolume(volume, volume) }
        if (step >= FADE_STEPS) finish() else handler.postDelayed(this, FADE_STEP_MS)
      }
    }
    handler.post(fade)
  }

  /** Tears down the session. Idempotent. */
  private fun finish() {
    if (finished) return
    finished = true
    fading = false
    handler.removeCallbacksAndMessages(null)
    unregisterNoisy()
    focus.abandon()
    player?.let { mp ->
      runCatching { if (mp.isPlaying) mp.stop() }
      mp.release()
    }
    player = null
    if (wakeLock.isHeld) wakeLock.release()
    mediaSession.isActive = false
    CycleStore.markSessionEnded(this, model)
    publish()
    stopForegroundCompat()
    stopSelf()
  }

  private fun failBeforeStart(message: String) {
    model = CycleModel(state = CycleState.STOPPED, endReason = EndReason.ERROR, errorMessage = message)
    publish()
    stopForegroundCompat()
    stopSelf()
  }

  // ---- Player, notification, media session ---------------------------------

  private fun createPlayer(uri: Uri): MediaPlayer = MediaPlayer().apply {
    setAudioAttributes(audioAttributes)
    setDataSource(this@PlaybackService, uri)
    setWakeMode(this@PlaybackService, PowerManager.PARTIAL_WAKE_LOCK)
    setOnCompletionListener { dispatchEvent(CycleEvent.PlaybackCompleted(now(), nextDraw())) }
    setOnErrorListener { _, what, extra ->
      Log.w(TAG, "MediaPlayer error what=$what extra=$extra")
      dispatchEvent(CycleEvent.Failure(now(), "Playback failed (code $what/$extra)"))
      true
    }
    prepare()
  }

  private fun publish() {
    val nowMs = now()
    val position = when (model.state) {
      CycleState.WAITING -> durationMs
      CycleState.PLAYING, CycleState.PAUSED -> runCatching { player?.currentPosition?.toLong() }.getOrNull() ?: 0L
      else -> 0L
    }
    val snapshot = PlayerSnapshot(model, nowMs, position, durationMs, title)
    CycleStore.publish(snapshot)
    updateMediaSession(snapshot)
    updateNotification(snapshot)
  }

  private fun updateMediaSession(snapshot: PlayerSnapshot) {
    val (state, speed) = when (model.state) {
      CycleState.PLAYING -> PlaybackState.STATE_PLAYING to 1f
      // The cycle is still running during the wait, so expose a pause control (speed 0 freezes the bar).
      CycleState.WAITING -> PlaybackState.STATE_PLAYING to 0f
      CycleState.PAUSED -> PlaybackState.STATE_PAUSED to 0f
      else -> PlaybackState.STATE_STOPPED to 0f
    }
    mediaSession.setPlaybackState(
      PlaybackState.Builder()
        .setActions(
          PlaybackState.ACTION_PLAY or PlaybackState.ACTION_PAUSE or
            PlaybackState.ACTION_PLAY_PAUSE or PlaybackState.ACTION_STOP,
        )
        .setState(state, snapshot.positionMs, speed)
        .build(),
    )
  }

  /** Re-posts the notification only when its visible content changes. */
  private fun updateNotification(snapshot: PlayerSnapshot) {
    if (!model.isActive) return
    val key = "${model.state}:${model.pauseReason}:${model.completedRepetitions}:${model.currentWaitMs}"
    if (key == lastNotificationKey) return
    lastNotificationKey = key
    val manager = getSystemService(NotificationManager::class.java)
    manager.notify(PlaybackNotification.NOTIFICATION_ID, PlaybackNotification.build(this, mediaSession, snapshot))
  }

  private fun enterForeground() {
    val notification = PlaybackNotification.build(this, mediaSession, PlayerSnapshot(model, now(), 0, durationMs, title))
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(
        PlaybackNotification.NOTIFICATION_ID,
        notification,
        ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK,
      )
    } else {
      startForeground(PlaybackNotification.NOTIFICATION_ID, notification)
    }
  }

  private fun stopForegroundCompat() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      stopForeground(STOP_FOREGROUND_REMOVE)
    } else {
      @Suppress("DEPRECATION")
      stopForeground(true)
    }
  }

  private fun registerNoisy() {
    if (noisyRegistered) return
    val filter = IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      registerReceiver(noisyReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
    } else {
      registerReceiver(noisyReceiver, filter)
    }
    noisyRegistered = true
  }

  private fun unregisterNoisy() {
    if (!noisyRegistered) return
    runCatching { unregisterReceiver(noisyReceiver) }
    noisyRegistered = false
  }

  private fun now(): Long = SystemClock.elapsedRealtime()
}
