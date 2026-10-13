package expo.modules.voicecycleplayer

import android.content.Context
import android.content.Intent
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

private const val SNAPSHOT_EVENT = "onSnapshot"
private const val MAX_INTERVAL_MS = 24 * 60 * 60_000.0
private const val MAX_SESSION_MS = 48 * 60 * 60_000.0
private const val MAX_PLAYS_PER_ROUND = 50

class StartOptions : Record {
  @Field val uri: String = ""
  @Field val title: String = ""
  @Field val intervalMinMs: Double = -1.0
  @Field val intervalMaxMs: Double = -1.0
  @Field val playsMin: Int = 1
  @Field val playsMax: Int = 1
  @Field val sessionMs: Double = -1.0
}

class InvalidRecordingException(message: String) : CodedException("ERR_INVALID_RECORDING", message, null)
class InvalidOptionsException(message: String) : CodedException("ERR_INVALID_OPTIONS", message, null)

/**
 * JS bridge. It never owns playback state: commands are forwarded to
 * [PlaybackService] and snapshots flow back from [CycleStore].
 */
class VoiceCyclePlayerModule : Module() {
  private val mainHandler = Handler(Looper.getMainLooper())
  private val listener: (PlayerSnapshot) -> Unit = { snapshot ->
    sendEvent(SNAPSHOT_EVENT, toBundle(snapshot.toMap()))
  }

  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("VoiceCyclePlayer")

    Events(SNAPSHOT_EVENT)

    OnStartObserving(SNAPSHOT_EVENT) { CycleStore.addListener(listener) }
    OnStopObserving(SNAPSHOT_EVENT) { CycleStore.removeListener(listener) }
    OnDestroy { CycleStore.removeListener(listener) }

    // The service ticks every second only while the UI is visible, saving battery during long sessions.
    OnActivityEntersForeground { setUiVisible(true) }
    OnActivityEntersBackground { setUiVisible(false) }
    OnActivityDestroys { setUiVisible(false) }

    Function("getSnapshot") { CycleStore.snapshot.toMap() }

    Function("getLastSessionReport") { CycleStore.lastSessionReport(context) }

    /** Reads the duration of a recording and confirms Android can decode it. */
    AsyncFunction("probe") { uri: String ->
      probeRecording(context, uri)
    }

    /** Starts a session. Returns false when a session is already active. */
    Function("start") { options: StartOptions ->
      validate(options)
      if (CycleStore.snapshot.model.isActive) return@Function false
      val intent = Intent(context, PlaybackService::class.java)
        .setAction(PlaybackService.ACTION_START)
        .putExtra(PlaybackService.EXTRA_URI, options.uri)
        .putExtra(PlaybackService.EXTRA_TITLE, options.title)
        .putExtra(PlaybackService.EXTRA_INTERVAL_MIN_MS, options.intervalMinMs.toLong())
        .putExtra(PlaybackService.EXTRA_INTERVAL_MAX_MS, options.intervalMaxMs.toLong())
        .putExtra(PlaybackService.EXTRA_PLAYS_MIN, options.playsMin)
        .putExtra(PlaybackService.EXTRA_PLAYS_MAX, options.playsMax)
        .putExtra(PlaybackService.EXTRA_SESSION_MS, options.sessionMs.toLong())
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
      true
    }

    Function("pause") { control(PlaybackService.ACTION_PAUSE) }
    Function("resume") { control(PlaybackService.ACTION_RESUME) }
    Function("stop") { control(PlaybackService.ACTION_STOP) }
  }

  /** Forwards a control to the running service on the main thread. */
  private fun control(action: String) {
    mainHandler.post { PlaybackService.dispatch(action) }
  }

  private fun setUiVisible(visible: Boolean) {
    mainHandler.post { PlaybackService.setUiVisible(visible) }
  }

  private fun validate(options: StartOptions) {
    if (options.uri.isBlank()) throw InvalidOptionsException("A recording must be selected")
    val (minWait, maxWait) = options.intervalMinMs to options.intervalMaxMs
    if (minWait.isNaN() || maxWait.isNaN() || minWait < 0 || maxWait > MAX_INTERVAL_MS || maxWait < minWait) {
      throw InvalidOptionsException("Wait must be between 0 and 24 hours, with minimum not above maximum")
    }
    if (options.playsMin < 1 || options.playsMax > MAX_PLAYS_PER_ROUND || options.playsMax < options.playsMin) {
      throw InvalidOptionsException("Plays in a row must be between 1 and $MAX_PLAYS_PER_ROUND, with minimum not above maximum")
    }
    if (options.sessionMs.isNaN() || options.sessionMs < 1_000 || options.sessionMs > MAX_SESSION_MS) {
      throw InvalidOptionsException("Session duration must be between 1 second and 48 hours")
    }
  }

  private fun probeRecording(context: Context, uri: String): Map<String, Any?> {
    val retriever = MediaMetadataRetriever()
    try {
      retriever.setDataSource(context, Uri.parse(uri))
      val hasAudio = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_HAS_AUDIO)
      val duration = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull()
      if (hasAudio == null && duration == null) throw InvalidRecordingException("The file does not contain playable audio")
      if (duration == null || duration <= 0) throw InvalidRecordingException("The recording has no readable duration")
      return mapOf("durationMs" to duration.toDouble())
    } catch (e: CodedException) {
      throw e
    } catch (e: Exception) {
      throw InvalidRecordingException("This file cannot be played on this device")
    } finally {
      runCatching { retriever.release() }
    }
  }

  private fun toBundle(map: Map<String, Any?>): Bundle = Bundle().apply {
    map.forEach { (key, value) ->
      when (value) {
        null -> putString(key, null)
        is String -> putString(key, value)
        is Int -> putInt(key, value)
        is Double -> putDouble(key, value)
        is Long -> putDouble(key, value.toDouble())
        is Boolean -> putBoolean(key, value)
        else -> putString(key, value.toString())
      }
    }
  }
}
