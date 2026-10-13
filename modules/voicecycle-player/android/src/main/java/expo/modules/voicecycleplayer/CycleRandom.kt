package expo.modules.voicecycleplayer

import kotlin.random.Random

private const val MS_PER_SECOND = 1_000L

/** Draws the random parts of a round: how long to wait and how many plays come next. */
object CycleRandom {

  fun draw(config: CycleConfig, random: Random): Draw = Draw(
    waitMs = drawWaitMs(config.intervalMinMs, config.intervalMaxMs, random),
    roundPlays = if (config.playsMin == config.playsMax) {
      config.playsMin
    } else {
      random.nextInt(config.playsMin, config.playsMax + 1)
    },
  )

  /**
   * Uniform wait in [minMs, maxMs], inclusive. Whole seconds when the range allows,
   * so countdowns look tidy, but never outside the user's range.
   */
  private fun drawWaitMs(minMs: Long, maxMs: Long, random: Random): Long {
    if (minMs == maxMs) return minMs
    val firstSecond = (minMs + MS_PER_SECOND - 1) / MS_PER_SECOND
    val lastSecond = maxMs / MS_PER_SECOND
    if (firstSecond > lastSecond) return random.nextLong(minMs, maxMs + 1)
    return random.nextLong(firstSecond, lastSecond + 1) * MS_PER_SECOND
  }
}
