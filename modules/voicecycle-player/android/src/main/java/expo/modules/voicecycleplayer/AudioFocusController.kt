package expo.modules.voicecycleplayer

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import android.os.Handler

enum class FocusResult { GRANTED, DELAYED, FAILED }

/**
 * Wraps audio focus. Focus is held only while the recording is audible, so other
 * apps can play during the silent wait. On Android 8+ a request made during a
 * phone call is granted later (delayed focus gain) and reported through [onGain].
 */
class AudioFocusController(
  context: Context,
  private val attributes: AudioAttributes,
  private val handler: Handler,
  private val onGain: () -> Unit,
  private val onLoss: (permanent: Boolean) -> Unit,
) {
  private val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager

  private val listener = AudioManager.OnAudioFocusChangeListener { change ->
    when (change) {
      AudioManager.AUDIOFOCUS_GAIN -> onGain()
      AudioManager.AUDIOFOCUS_LOSS -> onLoss(true)
      AudioManager.AUDIOFOCUS_LOSS_TRANSIENT,
      AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK -> onLoss(false)
    }
  }

  private val request: AudioFocusRequest? =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
        .setAudioAttributes(attributes)
        .setAcceptsDelayedFocusGain(true)
        // Spoken audio should pause rather than duck under other sounds.
        .setWillPauseWhenDucked(true)
        .setOnAudioFocusChangeListener(listener, handler)
        .build()
    } else {
      null
    }

  fun request(): FocusResult {
    val result = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && request != null) {
      audioManager.requestAudioFocus(request)
    } else {
      @Suppress("DEPRECATION")
      audioManager.requestAudioFocus(listener, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN)
    }
    return when (result) {
      AudioManager.AUDIOFOCUS_REQUEST_GRANTED -> FocusResult.GRANTED
      AudioManager.AUDIOFOCUS_REQUEST_DELAYED -> FocusResult.DELAYED
      else -> FocusResult.FAILED
    }
  }

  fun abandon() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && request != null) {
      audioManager.abandonAudioFocusRequest(request)
    } else {
      @Suppress("DEPRECATION")
      audioManager.abandonAudioFocus(listener)
    }
  }
}
