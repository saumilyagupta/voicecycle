package expo.modules.voicecycleplayer

import kotlin.random.Random
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class RoundsAndRandomTest {

  private val second = 1_000L
  private val minute = 60 * second
  private val hour = 60 * minute

  private fun run(model: CycleModel, event: CycleEvent): Transition = CycleStateMachine.reduce(model, event)

  private fun completed(model: CycleModel, at: Long, waitMs: Long = 0, nextPlays: Int = 1): Transition =
    run(model, CycleEvent.PlaybackCompleted(at, Draw(waitMs, nextPlays)))

  @Test
  fun `a round replays back to back before waiting`() {
    val config = CycleConfig.fixed(intervalMs = 10 * minute, sessionMs = hour, plays = 3)
    var model = run(CycleModel(), CycleEvent.Start(0, config, 3)).model
    assertEquals(3, model.roundTarget)

    val first = completed(model, 1 * minute)
    assertEquals(CycleState.PLAYING, first.model.state)
    assertEquals(listOf(Effect.START_FROM_BEGINNING), first.effects)
    assertEquals(1, first.model.playsInRound)

    model = completed(first.model, 2 * minute).model
    assertEquals(CycleState.PLAYING, model.state)
    assertEquals(2, model.playsInRound)

    val third = completed(model, 3 * minute, waitMs = 10 * minute, nextPlays = 3)
    assertEquals(CycleState.WAITING, third.model.state)
    assertEquals(listOf(Effect.ENTER_WAIT), third.effects)
    assertEquals(0, third.model.playsInRound)
    assertEquals(3, third.model.completedRepetitions)
  }

  @Test
  fun `random wait uses the drawn value for each round`() {
    val config = CycleConfig(intervalMinMs = 2 * minute, intervalMaxMs = 9 * minute, sessionMs = hour)
    val playing = run(CycleModel(), CycleEvent.Start(0, config, 1)).model

    val waiting = completed(playing, minute, waitMs = 7 * minute).model
    assertEquals(CycleState.WAITING, waiting.state)
    assertEquals(7 * minute, waiting.currentWaitMs)
    assertEquals(CycleState.WAITING, run(waiting, CycleEvent.Tick(minute + 7 * minute - 1)).model.state)
    assertEquals(CycleState.PLAYING, run(waiting, CycleEvent.Tick(minute + 7 * minute)).model.state)
  }

  @Test
  fun `next round size comes from the draw`() {
    val config = CycleConfig(0, 0, hour, playsMin = 1, playsMax = 3)
    val playing = run(CycleModel(), CycleEvent.Start(0, config, 1)).model
    // Round of one ends, wait is zero, next round has two plays.
    val next = completed(playing, minute, waitMs = 0, nextPlays = 2)
    assertEquals(CycleState.PLAYING, next.model.state)
    assertEquals(2, next.model.roundTarget)
    assertEquals(0, next.model.playsInRound)
  }

  @Test
  fun `draws outside the configured ranges are clamped`() {
    val config = CycleConfig(2 * minute, 5 * minute, hour, playsMin = 2, playsMax = 3)
    val start = run(CycleModel(), CycleEvent.Start(0, config, 9)).model
    assertEquals(3, start.roundTarget)
    var model = completed(start, minute).model
    model = completed(model, 2 * minute).model
    val waiting = completed(model, 3 * minute, waitMs = 99 * minute, nextPlays = 0).model
    assertEquals(5 * minute, waiting.currentWaitMs)
    assertEquals(2, waiting.roundTarget)
  }

  @Test
  fun `session ends when the drawn wait would outlast it`() {
    val config = CycleConfig(1 * minute, 20 * minute, sessionMs = 15 * minute)
    val playing = run(CycleModel(), CycleEvent.Start(0, config, 1)).model
    val t = completed(playing, 5 * minute, waitMs = 12 * minute)
    assertEquals(CycleState.STOPPED, t.model.state)
    assertEquals(EndReason.SESSION_COMPLETE, t.model.endReason)
  }

  @Test
  fun `session expiry mid-round still fades out`() {
    val config = CycleConfig.fixed(intervalMs = minute, sessionMs = 10 * minute, plays = 4)
    val playing = run(CycleModel(), CycleEvent.Start(0, config, 4)).model
    val t = run(playing, CycleEvent.Tick(10 * minute))
    assertEquals(listOf(Effect.FADE_AND_STOP), t.effects)
  }

  @Test
  fun `fixed config always draws the fixed values`() {
    val config = CycleConfig.fixed(intervalMs = 10 * minute, sessionMs = hour, plays = 2)
    repeat(50) {
      assertEquals(Draw(10 * minute, 2), CycleRandom.draw(config, Random(it)))
    }
  }

  @Test
  fun `random draws stay inside the ranges and reach both ends`() {
    val config = CycleConfig(5 * minute, 7 * minute, hour, playsMin = 1, playsMax = 3)
    val random = Random(42)
    val draws = List(2_000) { CycleRandom.draw(config, random) }
    assertTrue(draws.all { it.waitMs in 5 * minute..7 * minute })
    assertTrue(draws.all { it.waitMs % second == 0L })
    assertEquals(5 * minute, draws.minOf { it.waitMs })
    assertEquals(7 * minute, draws.maxOf { it.waitMs })
    assertEquals(setOf(1, 2, 3), draws.map { it.roundPlays }.toSet())
  }

  @Test
  fun `sub-second ranges still draw inside the range`() {
    val config = CycleConfig(intervalMinMs = 1_200, intervalMaxMs = 1_800, sessionMs = hour)
    val random = Random(7)
    repeat(200) { assertTrue(CycleRandom.draw(config, random).waitMs in 1_200L..1_800L) }
  }

  @Test(expected = IllegalArgumentException::class)
  fun `config rejects max wait below min wait`() {
    CycleConfig(intervalMinMs = 5 * minute, intervalMaxMs = 2 * minute, sessionMs = hour)
  }

  @Test(expected = IllegalArgumentException::class)
  fun `config rejects zero plays per round`() {
    CycleConfig(0, 0, hour, playsMin = 0, playsMax = 2)
  }
}
