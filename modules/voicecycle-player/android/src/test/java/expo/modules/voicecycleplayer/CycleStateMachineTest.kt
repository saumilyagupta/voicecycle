package expo.modules.voicecycleplayer

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class CycleStateMachineTest {

  private val minute = 60_000L

  // Draws are clamped to the config, so fixed-value tests can pass any draw.
  private val anyDraw = Draw(waitMs = 0, roundPlays = 1)
  private val hour = 60 * minute
  private val config = CycleConfig.fixed(intervalMs = 10 * minute, sessionMs = 8 * hour)

  private fun run(model: CycleModel, event: CycleEvent): Transition = CycleStateMachine.reduce(model, event)

  private fun started(cfg: CycleConfig = config, at: Long = 0): CycleModel =
    run(CycleModel(), CycleEvent.Start(at, cfg, 1)).model

  @Test
  fun `start from idle plays from the beginning`() {
    val t = run(CycleModel(), CycleEvent.Start(1_000, config, 1))
    assertEquals(CycleState.PLAYING, t.model.state)
    assertEquals(listOf(Effect.START_FROM_BEGINNING), t.effects)
    assertEquals(8 * hour, t.model.sessionRemainingAt(1_000))
  }

  @Test
  fun `second start while active is ignored so no duplicate session starts`() {
    val playing = started()
    val t = run(playing, CycleEvent.Start(5_000, config, 1))
    assertEquals(playing, t.model)
    assertTrue(t.effects.isEmpty())
  }

  @Test
  fun `recording end counts a repetition and waits for the interval`() {
    val t = run(started(), CycleEvent.PlaybackCompleted(12 * minute, anyDraw))
    assertEquals(CycleState.WAITING, t.model.state)
    assertEquals(1, t.model.completedRepetitions)
    assertEquals(listOf(Effect.ENTER_WAIT), t.effects)
    assertEquals(10 * minute, t.model.waitRemainingAt(12 * minute))
  }

  @Test
  fun `interval starts after the recording finishes, not when it started`() {
    val waiting = run(started(), CycleEvent.PlaybackCompleted(12 * minute, anyDraw)).model
    // 9 minutes after the recording ended: still waiting.
    val early = run(waiting, CycleEvent.Tick(21 * minute))
    assertEquals(CycleState.WAITING, early.model.state)
    assertEquals(1 * minute, early.model.waitRemainingAt(21 * minute))
    // 10 minutes after it ended: replay from the beginning.
    val due = run(waiting, CycleEvent.Tick(22 * minute))
    assertEquals(CycleState.PLAYING, due.model.state)
    assertEquals(listOf(Effect.START_FROM_BEGINNING), due.effects)
  }

  @Test
  fun `multiple full cycles accumulate repetitions`() {
    var model = started()
    var now = 0L
    repeat(3) {
      now += 12 * minute
      model = run(model, CycleEvent.PlaybackCompleted(now, anyDraw)).model
      now += 10 * minute
      model = run(model, CycleEvent.Tick(now)).model
      assertEquals(CycleState.PLAYING, model.state)
    }
    assertEquals(3, model.completedRepetitions)
    assertEquals(8 * hour - now, model.sessionRemainingAt(now))
  }

  @Test
  fun `zero interval restarts immediately without waiting`() {
    val playing = started(CycleConfig.fixed(intervalMs = 0, sessionMs = hour))
    val t = run(playing, CycleEvent.PlaybackCompleted(5 * minute, anyDraw))
    assertEquals(CycleState.PLAYING, t.model.state)
    assertEquals(1, t.model.completedRepetitions)
    assertEquals(listOf(Effect.START_FROM_BEGINNING), t.effects)
  }

  @Test
  fun `pause during playback freezes the session clock and resume continues the recording`() {
    val paused = run(started(), CycleEvent.Pause(5 * minute, PauseReason.USER))
    assertEquals(CycleState.PAUSED, paused.model.state)
    assertEquals(CycleState.PLAYING, paused.model.pausedFrom)
    assertEquals(listOf(Effect.PAUSE_PLAYER), paused.effects)
    // An hour passes while paused: nothing changes.
    assertEquals(paused.model, run(paused.model, CycleEvent.Tick(65 * minute)).model)
    assertEquals(8 * hour - 5 * minute, paused.model.sessionRemainingAt(65 * minute))

    val resumed = run(paused.model, CycleEvent.Resume(65 * minute))
    assertEquals(CycleState.PLAYING, resumed.model.state)
    assertEquals(listOf(Effect.RESUME_PLAYER), resumed.effects)
    assertEquals(8 * hour - 6 * minute, resumed.model.sessionRemainingAt(66 * minute))
  }

  @Test
  fun `pause during the wait keeps the remaining countdown and resume continues it`() {
    val waiting = run(started(), CycleEvent.PlaybackCompleted(12 * minute, anyDraw)).model
    val paused = run(waiting, CycleEvent.Pause(16 * minute, PauseReason.USER))
    assertEquals(CycleState.PAUSED, paused.model.state)
    assertEquals(CycleState.WAITING, paused.model.pausedFrom)
    assertTrue(paused.effects.isEmpty())
    assertEquals(6 * minute, paused.model.waitRemainingAt(100 * minute))

    val resumed = run(paused.model, CycleEvent.Resume(100 * minute)).model
    assertEquals(CycleState.WAITING, resumed.state)
    assertEquals(6 * minute, resumed.waitRemainingAt(100 * minute))
    val due = run(resumed, CycleEvent.Tick(106 * minute))
    assertEquals(CycleState.PLAYING, due.model.state)
    assertEquals(listOf(Effect.START_FROM_BEGINNING), due.effects)
  }

  @Test
  fun `stop during playback ends the session`() {
    val t = run(started(), CycleEvent.Stop(3 * minute))
    assertEquals(CycleState.STOPPED, t.model.state)
    assertEquals(EndReason.USER, t.model.endReason)
    assertEquals(listOf(Effect.STOP_PLAYER), t.effects)
  }

  @Test
  fun `stop during the wait cancels the pending replay`() {
    val waiting = run(started(), CycleEvent.PlaybackCompleted(12 * minute, anyDraw)).model
    val stopped = run(waiting, CycleEvent.Stop(15 * minute)).model
    assertEquals(CycleState.STOPPED, stopped.state)
    val later = run(stopped, CycleEvent.Tick(30 * minute))
    assertEquals(CycleState.STOPPED, later.model.state)
    assertTrue(later.effects.isEmpty())
  }

  @Test
  fun `stop while paused ends the session`() {
    val paused = run(started(), CycleEvent.Pause(minute, PauseReason.USER)).model
    val t = run(paused, CycleEvent.Stop(2 * minute))
    assertEquals(CycleState.STOPPED, t.model.state)
    assertNull(t.model.pausedFrom)
  }

  @Test
  fun `session expiry mid-recording fades out`() {
    val playing = started(CycleConfig.fixed(intervalMs = minute, sessionMs = 30 * minute))
    val t = run(playing, CycleEvent.Tick(30 * minute))
    assertEquals(CycleState.STOPPED, t.model.state)
    assertEquals(EndReason.SESSION_COMPLETE, t.model.endReason)
    assertEquals(listOf(Effect.FADE_AND_STOP), t.effects)
  }

  @Test
  fun `session ends at recording end when the next interval would outlast it`() {
    val playing = started(CycleConfig.fixed(intervalMs = 10 * minute, sessionMs = 20 * minute))
    val t = run(playing, CycleEvent.PlaybackCompleted(12 * minute, anyDraw))
    assertEquals(CycleState.STOPPED, t.model.state)
    assertEquals(EndReason.SESSION_COMPLETE, t.model.endReason)
    assertEquals(1, t.model.completedRepetitions)
  }

  @Test
  fun `session expiry during the wait stops without replaying`() {
    val waiting = run(
      started(CycleConfig.fixed(intervalMs = 5 * minute, sessionMs = 20 * minute)),
      CycleEvent.PlaybackCompleted(10 * minute, anyDraw),
    ).model
    assertEquals(CycleState.WAITING, waiting.state)
    // Simulate a late tick after both deadlines passed (e.g. delayed wake-up).
    val t = run(waiting, CycleEvent.Tick(25 * minute))
    assertEquals(CycleState.STOPPED, t.model.state)
    assertEquals(EndReason.SESSION_COMPLETE, t.model.endReason)
  }

  @Test
  fun `interruption resumes automatically when focus returns`() {
    val paused = run(started(), CycleEvent.Pause(minute, PauseReason.INTERRUPTION)).model
    val t = run(paused, CycleEvent.FocusRegained(3 * minute))
    assertEquals(CycleState.PLAYING, t.model.state)
    assertEquals(listOf(Effect.RESUME_PLAYER), t.effects)
  }

  @Test
  fun `user pause during an interruption prevents automatic resume`() {
    val interrupted = run(started(), CycleEvent.Pause(minute, PauseReason.INTERRUPTION)).model
    val userPaused = run(interrupted, CycleEvent.Pause(2 * minute, PauseReason.USER)).model
    assertEquals(PauseReason.USER, userPaused.pauseReason)
    val t = run(userPaused, CycleEvent.FocusRegained(3 * minute))
    assertEquals(CycleState.PAUSED, t.model.state)
    assertTrue(t.effects.isEmpty())
  }

  @Test
  fun `permanent focus loss does not auto resume`() {
    val paused = run(started(), CycleEvent.Pause(minute, PauseReason.FOCUS_LOST)).model
    assertEquals(CycleState.PAUSED, run(paused, CycleEvent.FocusRegained(2 * minute)).model.state)
  }

  @Test
  fun `failure stops an active session with the error message`() {
    val t = run(started(), CycleEvent.Failure(minute, "cannot open file"))
    assertEquals(CycleState.STOPPED, t.model.state)
    assertEquals(EndReason.ERROR, t.model.endReason)
    assertEquals("cannot open file", t.model.errorMessage)
  }

  @Test
  fun `restart after a finished session resets repetitions`() {
    val stopped = run(run(started(), CycleEvent.PlaybackCompleted(minute, anyDraw)).model, CycleEvent.Stop(2 * minute)).model
    val restarted = run(stopped, CycleEvent.Start(3 * minute, config, 1)).model
    assertEquals(CycleState.PLAYING, restarted.state)
    assertEquals(0, restarted.completedRepetitions)
    assertNull(restarted.endReason)
  }

  @Test(expected = IllegalArgumentException::class)
  fun `config rejects a non-positive session`() {
    CycleConfig.fixed(intervalMs = 0, sessionMs = 0)
  }
}
