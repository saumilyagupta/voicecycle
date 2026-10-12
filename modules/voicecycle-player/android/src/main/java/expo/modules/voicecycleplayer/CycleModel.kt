package expo.modules.voicecycleplayer

/** Lifecycle states of a repetition session. */
enum class CycleState { IDLE, PLAYING, WAITING, PAUSED, STOPPED }

/** Why a session is paused. Only INTERRUPTION resumes automatically. */
enum class PauseReason { USER, INTERRUPTION, FOCUS_LOST, NOISY }

/** Why a session ended. */
enum class EndReason { USER, SESSION_COMPLETE, ERROR }

/** Side effects the playback service must perform after a transition. */
enum class Effect {
  /** Request audio focus and play the recording from position 0. */
  START_FROM_BEGINNING,
  PAUSE_PLAYER,
  /** Request audio focus and continue from the current position. */
  RESUME_PLAYER,
  /** Recording finished. Release audio focus while waiting in silence. */
  ENTER_WAIT,
  STOP_PLAYER,
  /** Session timer expired mid-recording. Fade out, then stop. */
  FADE_AND_STOP,
}

data class CycleConfig(val intervalMs: Long, val sessionMs: Long) {
  init {
    require(intervalMs >= 0) { "intervalMs must be >= 0" }
    require(sessionMs > 0) { "sessionMs must be > 0" }
  }
}

/**
 * Immutable session model. Remaining times are stored relative to [anchorMs]
 * (a SystemClock.elapsedRealtime() value). The session clock runs only in
 * PLAYING and WAITING. The wait clock runs only in WAITING. Pausing freezes both.
 */
data class CycleModel(
  val state: CycleState = CycleState.IDLE,
  val config: CycleConfig? = null,
  val completedRepetitions: Int = 0,
  val sessionRemainingMs: Long = 0,
  val waitRemainingMs: Long = 0,
  val anchorMs: Long = 0,
  val pausedFrom: CycleState? = null,
  val pauseReason: PauseReason? = null,
  val endReason: EndReason? = null,
  val errorMessage: String? = null,
) {
  val isActive: Boolean
    get() = state == CycleState.PLAYING || state == CycleState.WAITING || state == CycleState.PAUSED

  fun sessionRemainingAt(nowMs: Long): Long {
    val running = state == CycleState.PLAYING || state == CycleState.WAITING
    val elapsed = if (running) (nowMs - anchorMs).coerceAtLeast(0) else 0
    return (sessionRemainingMs - elapsed).coerceAtLeast(0)
  }

  fun waitRemainingAt(nowMs: Long): Long {
    val elapsed = if (state == CycleState.WAITING) (nowMs - anchorMs).coerceAtLeast(0) else 0
    return (waitRemainingMs - elapsed).coerceAtLeast(0)
  }

  /** Re-bases the stored clocks onto [nowMs] without changing state. */
  fun rebase(nowMs: Long): CycleModel = copy(
    sessionRemainingMs = sessionRemainingAt(nowMs),
    waitRemainingMs = waitRemainingAt(nowMs),
    anchorMs = nowMs,
  )
}

data class Transition(val model: CycleModel, val effects: List<Effect> = emptyList())
