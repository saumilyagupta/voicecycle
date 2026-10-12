package expo.modules.voicecycleplayer

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.session.MediaSession
import android.os.Build

/** Builds the ongoing media notification shown while a session is active. */
object PlaybackNotification {
  const val NOTIFICATION_ID = 4107
  private const val CHANNEL_ID = "voicecycle.playback"

  fun ensureChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = context.getSystemService(NotificationManager::class.java)
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return
    val channel = NotificationChannel(CHANNEL_ID, "Playback session", NotificationManager.IMPORTANCE_LOW).apply {
      description = "Shows the active VoiceCycle session and its controls"
      setShowBadge(false)
    }
    manager.createNotificationChannel(channel)
  }

  fun build(context: Context, session: MediaSession, snapshot: PlayerSnapshot): Notification {
    val model = snapshot.model
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(context, CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(context)
    }

    val isPaused = model.state == CycleState.PAUSED
    val toggle = if (isPaused) {
      action(context, android.R.drawable.ic_media_play, "Resume", PlaybackService.ACTION_RESUME, 1)
    } else {
      action(context, android.R.drawable.ic_media_pause, "Pause", PlaybackService.ACTION_PAUSE, 2)
    }
    val stop = action(context, android.R.drawable.ic_menu_close_clear_cancel, "Stop", PlaybackService.ACTION_STOP, 3)

    builder
      .setSmallIcon(R.drawable.ic_voicecycle_notification)
      .setContentTitle(snapshot.title ?: "VoiceCycle")
      .setContentText(statusText(model))
      .setOngoing(model.isActive)
      .setOnlyAlertOnce(true)
      .setShowWhen(false)
      .setVisibility(Notification.VISIBILITY_PUBLIC)
      .setCategory(Notification.CATEGORY_TRANSPORT)
      .addAction(toggle)
      .addAction(stop)
      .setStyle(Notification.MediaStyle().setMediaSession(session.sessionToken).setShowActionsInCompactView(0, 1))
    launchIntent(context)?.let { builder.setContentIntent(it) }

    // During the silent wait the system chronometer counts down to the next repetition,
    // so the notification stays accurate without being re-posted every second.
    if (model.state == CycleState.WAITING) {
      builder
        .setShowWhen(true)
        .setUsesChronometer(true)
        .setChronometerCountDown(true)
        .setWhen(System.currentTimeMillis() + model.waitRemainingAt(snapshot.nowMs))
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      builder.setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_IMMEDIATE)
    }
    return builder.build()
  }

  private fun statusText(model: CycleModel): String {
    val reps = "${model.completedRepetitions} played"
    return when (model.state) {
      CycleState.PLAYING -> "Playing · $reps"
      CycleState.WAITING -> "Waiting for next play · $reps"
      CycleState.PAUSED -> when (model.pauseReason) {
        PauseReason.INTERRUPTION -> "Paused by interruption · $reps"
        else -> "Paused · $reps"
      }
      CycleState.STOPPED -> "Session ended · $reps"
      CycleState.IDLE -> "Ready"
    }
  }

  private fun action(context: Context, icon: Int, title: String, actionName: String, requestCode: Int): Notification.Action {
    val intent = Intent(context, PlaybackService::class.java).setAction(actionName)
    val pending = PendingIntent.getService(
      context,
      requestCode,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    @Suppress("DEPRECATION")
    return Notification.Action.Builder(icon, title, pending).build()
  }

  private fun launchIntent(context: Context): PendingIntent? {
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return null
    launch.flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
    return PendingIntent.getActivity(context, 0, launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }
}
