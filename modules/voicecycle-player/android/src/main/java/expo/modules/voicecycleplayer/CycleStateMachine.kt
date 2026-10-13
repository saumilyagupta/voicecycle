package expo.modules.voicecycleplayer

/** Inputs to the state machine. Every event carries the current elapsedRealtime. */
sealed class CycleEvent {
  abstract val nowMs: Long

  /** [firstRoundPlays] is the drawn size of the first round. */
  data class Start(override val nowMs: Long, val config: CycleConfig, val firstRoundPlays: Int) : CycleEvent()

  /** [next] is used only if this play ends a round: the wait and the size of the following round. */
  data class PlaybackCompleted(override val nowMs: Long, val next: Draw) : CycleEvent()
  data class Tick(override val nowMs: Long) : CycleEvent()
  data class Pause(override val nowMs: Long, val reason: PauseReason) : CycleEvent()
  data class Resume(override val nowMs: Long) : CycleEvent()
  data class FocusRegained(override val nowMs: Long) : CycleEvent()
  data class Stop(override val nowMs: Long) : CycleEvent()
  data class Failure(override val nowMs: Long, val message: String) : CycleEvent()
}

/**
 * Pure transition function for the repetition cycle:
 *
 *   IDLE/STOPPED -start-> PLAYING x N (one round) -round ends-> WAITING -wait elapses-> PLAYING ...
 *
 * Rules:
 * - A round is N back-to-back plays. N and the following wait may be random; they are
 *   drawn outside this pure function and passed in with the events.
 * - The wait starts when the last play of a round finishes, not when it starts.
 * - A wait of 0 starts the next round immediately.
 * - If the remaining session time is not longer than the drawn wait when a round
 *   finishes, the session ends right away instead of waiting in silence for nothing.
 * - When the session timer reaches zero mid-recording, the recording fades out and stops.
 * - Pause freezes the recording position, the wait countdown and the session timer.
 *   Resuming a pause taken during WAITING continues the remaining countdown.
 * - Events that do not apply to the current state are ignored, so a second Start
 *   can never create a duplicate session.
 */
object CycleStateMachine {

  fun reduce(model: CycleModel, event: CycleEvent): Transition = when (event) {
    is CycleEvent.Start -> start(model, event)
    is CycleEvent.PlaybackCompleted -> completed(model, event)
    is CycleEvent.Tick -> tick(model, event.nowMs)
    is CycleEvent.Pause -> pause(model, event.nowMs, event.reason)
    is CycleEvent.Resume -> resume(model, event.nowMs)
    is CycleEvent.FocusRegained ->
      if (model.state == CycleState.PAUSED && model.pauseReason == PauseReason.INTERRUPTION) {
        resume(model, event.nowMs)
      } else {
        Transition(model)
      }
    is CycleEvent.Stop -> end(model, event.nowMs, EndReason.USER, null)
    is CycleEvent.Failure -> end(model, event.nowMs, EndReason.ERROR, event.message)
  }

  private fun start(model: CycleModel, event: CycleEvent.Start): Transition {
    if (model.isActive) return Transition(model)
    val next = CycleModel(
      state = CycleState.PLAYING,
      config = event.config,
      sessionRemainingMs = event.config.sessionMs,
      anchorMs = event.nowMs,
      roundTarget = clampPlays(event.firstRoundPlays, event.config),
    )
    return Transition(next, listOf(Effect.START_FROM_BEGINNING))
  }

  private fun completed(model: CycleModel, event: CycleEvent.PlaybackCompleted): Transition {
    if (model.state != CycleState.PLAYING) return Transition(model)
    val config = model.config ?: return Transition(model)
    val nowMs = event.nowMs
    val counted = model.rebase(nowMs).copy(
      completedRepetitions = model.completedRepetitions + 1,
      playsInRound = model.playsInRound + 1,
    )
    val sessionLeft = counted.sessionRemainingMs
    if (sessionLeft <= 0) {
      return finish(counted, nowMs, EndReason.SESSION_COMPLETE, Effect.STOP_PLAYER, null)
    }
    // More plays left in this round: replay straight away.
    if (counted.playsInRound < counted.roundTarget) {
      return Transition(counted, listOf(Effect.START_FROM_BEGINNING))
    }

    val waitMs = event.next.waitMs.coerceIn(config.intervalMinMs, config.intervalMaxMs)
    val nextRound = counted.copy(
      playsInRound = 0,
      roundTarget = clampPlays(event.next.roundPlays, config),
      currentWaitMs = waitMs,
    )
    if (waitMs > 0 && sessionLeft <= waitMs) {
      return finish(nextRound, nowMs, EndReason.SESSION_COMPLETE, Effect.STOP_PLAYER, null)
    }
    if (waitMs == 0L) {
      return Transition(nextRound, listOf(Effect.START_FROM_BEGINNING))
    }
    val waiting = nextRound.copy(state = CycleState.WAITING, waitRemainingMs = waitMs)
    return Transition(waiting, listOf(Effect.ENTER_WAIT))
  }

  private fun clampPlays(plays: Int, config: CycleConfig): Int = plays.coerceIn(config.playsMin, config.playsMax)

  private fun tick(model: CycleModel, nowMs: Long): Transition = when (model.state) {
    CycleState.PLAYING ->
      if (model.sessionRemainingAt(nowMs) <= 0) {
        finish(model.rebase(nowMs), nowMs, EndReason.SESSION_COMPLETE, Effect.FADE_AND_STOP, null)
      } else {
        Transition(model)
      }
    CycleState.WAITING -> when {
      model.sessionRemainingAt(nowMs) <= 0 ->
        finish(model.rebase(nowMs), nowMs, EndReason.SESSION_COMPLETE, Effect.STOP_PLAYER, null)
      model.waitRemainingAt(nowMs) <= 0 ->
        Transition(
          model.rebase(nowMs).copy(state = CycleState.PLAYING, waitRemainingMs = 0),
          listOf(Effect.START_FROM_BEGINNING),
        )
      else -> Transition(model)
    }
    else -> Transition(model)
  }

  private fun pause(model: CycleModel, nowMs: Long, reason: PauseReason): Transition = when (model.state) {
    CycleState.PLAYING -> Transition(
      model.rebase(nowMs).copy(state = CycleState.PAUSED, pausedFrom = CycleState.PLAYING, pauseReason = reason),
      listOf(Effect.PAUSE_PLAYER),
    )
    CycleState.WAITING -> Transition(
      model.rebase(nowMs).copy(state = CycleState.PAUSED, pausedFrom = CycleState.WAITING, pauseReason = reason),
    )
    // A deliberate pause during an interruption cancels the automatic resume.
    CycleState.PAUSED ->
      if (reason != PauseReason.INTERRUPTION && model.pauseReason == PauseReason.INTERRUPTION) {
        Transition(model.copy(pauseReason = reason))
      } else {
        Transition(model)
      }
    else -> Transition(model)
  }

  private fun resume(model: CycleModel, nowMs: Long): Transition {
    if (model.state != CycleState.PAUSED) return Transition(model)
    val target = model.pausedFrom ?: CycleState.PLAYING
    val resumed = model.copy(state = target, anchorMs = nowMs, pausedFrom = null, pauseReason = null)
    val effects = if (target == CycleState.PLAYING) listOf(Effect.RESUME_PLAYER) else emptyList()
    return Transition(resumed, effects)
  }

  private fun end(model: CycleModel, nowMs: Long, reason: EndReason, message: String?): Transition {
    if (!model.isActive) return Transition(model)
    return finish(model.rebase(nowMs), nowMs, reason, Effect.STOP_PLAYER, message)
  }

  private fun finish(
    model: CycleModel,
    nowMs: Long,
    reason: EndReason,
    effect: Effect,
    message: String?,
  ): Transition = Transition(
    model.copy(
      state = CycleState.STOPPED,
      anchorMs = nowMs,
      waitRemainingMs = 0,
      pausedFrom = null,
      pauseReason = null,
      endReason = reason,
      errorMessage = message,
    ),
    listOf(effect),
  )
}
