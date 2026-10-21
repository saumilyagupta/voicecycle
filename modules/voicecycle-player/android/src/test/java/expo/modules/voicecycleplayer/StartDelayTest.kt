package expo.modules.voicecycleplayer

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class StartDelayTest {

  private val minute = 60_000L
  private val hour = 60 * minute
  private val config = CycleConfig(
    intervalMinMs = 5 * minute,
    intervalMaxMs = 5 * minute,
    sessionMs = 2 * hour,
    startDelayMs = 20 * minute,
  )

  private fun run(model: CycleModel, event: CycleEvent): Transition = CycleStateMachine.reduce(model, event)

  private fun startedWithDelay(at: Long = 0): Transition = run(CycleModel(), CycleEvent.Start(at, config, 1))

  @Test
  fun `start with a delay waits silently before the first play`() {
    val t = startedWithDelay()
    assertEquals(CycleState.WAITING, t.model.state)
    assertTrue(t.model.inStartDelay)
    assertTrue(t.effects.isEmpty())
    assertEquals(20 * minute, t.model.waitRemainingAt(0))
    assertEquals(20 * minute, t.model.currentWaitMs)
  }

  @Test
  fun `session timer does not run during the start delay`() {
    val model = startedWithDelay().model
    assertEquals(2 * hour, model.sessionRemainingAt(15 * minute))
    assertEquals(CycleState.WAITING, run(model, CycleEvent.Tick(15 * minute)).model.state)
  }

  @Test
  fun `first play starts when the delay ends and the session clock starts then`() {
    val delayed = startedWithDelay().model
    val t = run(delayed, CycleEvent.Tick(20 * minute))
    assertEquals(CycleState.PLAYING, t.model.state)
    assertEquals(listOf(Effect.START_FROM_BEGINNING), t.effects)
    assertFalse(t.model.inStartDelay)
    assertEquals(2 * hour, t.model.sessionRemainingAt(20 * minute))
    assertEquals(2 * hour - 10 * minute, t.model.sessionRemainingAt(30 * minute))
  }

  @Test
  fun `later waits are normal waits, not start delays`() {
    val playing = run(startedWithDelay().model, CycleEvent.Tick(20 * minute)).model
    val waiting = run(playing, CycleEvent.PlaybackCompleted(32 * minute, Draw(5 * minute, 1))).model
    assertEquals(CycleState.WAITING, waiting.state)
    assertFalse(waiting.inStartDelay)
    assertEquals(5 * minute, waiting.currentWaitMs)
  }

  @Test
  fun `pause during the start delay freezes it and resume continues it`() {
    val paused = run(startedWithDelay().model, CycleEvent.Pause(5 * minute, PauseReason.USER)).model
    assertEquals(CycleState.PAUSED, paused.state)
    assertEquals(CycleState.WAITING, paused.pausedFrom)
    assertTrue(paused.inStartDelay)
    assertEquals(15 * minute, paused.waitRemainingAt(60 * minute))

    val resumed = run(paused, CycleEvent.Resume(60 * minute)).model
    assertEquals(CycleState.WAITING, resumed.state)
    assertTrue(resumed.inStartDelay)
    assertEquals(CycleState.WAITING, run(resumed, CycleEvent.Tick(74 * minute)).model.state)
    assertEquals(CycleState.PLAYING, run(resumed, CycleEvent.Tick(75 * minute)).model.state)
  }

  @Test
  fun `stop during the start delay ends the session without playing`() {
    val t = run(startedWithDelay().model, CycleEvent.Stop(5 * minute))
    assertEquals(CycleState.STOPPED, t.model.state)
    assertEquals(EndReason.USER, t.model.endReason)
    assertEquals(0, t.model.completedRepetitions)
    assertFalse(t.model.inStartDelay)
  }

  @Test
  fun `a second start during the delay is ignored`() {
    val delayed = startedWithDelay().model
    val t = run(delayed, CycleEvent.Start(minute, config, 1))
    assertEquals(delayed, t.model)
    assertTrue(t.effects.isEmpty())
  }

  @Test
  fun `zero delay starts playing immediately as before`() {
    val t = run(CycleModel(), CycleEvent.Start(0, config.copy(startDelayMs = 0), 1))
    assertEquals(CycleState.PLAYING, t.model.state)
    assertFalse(t.model.inStartDelay)
    assertEquals(listOf(Effect.START_FROM_BEGINNING), t.effects)
  }

  @Test(expected = IllegalArgumentException::class)
  fun `config rejects a negative start delay`() {
    config.copy(startDelayMs = -1)
  }
}
