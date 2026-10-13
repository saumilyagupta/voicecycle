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

/**
 * Session settings. A fixed value is a range whose min equals its max.
 *
 * A round is [playsMin]..[playsMax] back-to-back plays of the recording. After each
 * round comes one silent wait of [intervalMinMs]..[intervalMaxMs]. Both are drawn
 * again for every round.
 */
data class CycleConfig(
  val intervalMinMs: Long,
  val intervalMaxMs: Long,
  val sessionMs: Long,
  val playsMin: Int = 1,
  val playsMax: Int = playsMin,
) {
  init {
    require(intervalMinMs >= 0) { "intervalMinMs must be >= 0" }
    require(intervalMaxMs >= intervalMinMs) { "intervalMaxMs must be >= intervalMinMs" }
    require(sessionMs > 0) { "sessionMs must be > 0" }
    require(playsMin >= 1) { "playsMin must be >= 1" }
    require(playsMax >= playsMin) { "playsMax must be >= playsMin" }
  }

  companion object {
    fun fixed(intervalMs: Long, sessionMs: Long, plays: Int = 1) =
      CycleConfig(intervalMs, intervalMs, sessionMs, plays, plays)
  }
}

/** Random values for the next round, drawn by the service so the state machine stays pure. */
data class Draw(val waitMs: Long, val roundPlays: Int)

/**
 * Immutable session model. Remaining times are stored relative to [anchorMs]
 * (a SystemClock.elapsedRealtime() value). The session clock runs only in
 * PLAYING and WAITING. The wait clock runs only in WAITING. Pausing freezes both.
 */
data class CycleModel(
  val state: CycleState = CycleState.IDLE,
  val config: CycleConfig? = null,
  val completedRepetitions: Int = 0,
  /** Plays finished in the current round. */
  val playsInRound: Int = 0,
  /** Plays the current round consists of. */
  val roundTarget: Int = 1,
  /** Full length of the current (or most recent) wait, for display. */
  val currentWaitMs: Long = 0,
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
