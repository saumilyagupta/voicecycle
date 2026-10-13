package expo.modules.voicecycleplayer

import android.content.Context
import android.os.Handler
import android.os.Looper
import java.util.concurrent.CopyOnWriteArrayList

/** Everything the UI needs to render, produced by the playback service. */
data class PlayerSnapshot(
  val model: CycleModel = CycleModel(),
  val nowMs: Long = 0,
  val positionMs: Long = 0,
  val durationMs: Long = 0,
  val title: String? = null,
) {
  fun toMap(): Map<String, Any?> = mapOf(
    "state" to model.state.name,
    "pausedFrom" to model.pausedFrom?.name,
    "pauseReason" to model.pauseReason?.name,
    "endReason" to model.endReason?.name,
    "errorMessage" to model.errorMessage,
    "completedRepetitions" to model.completedRepetitions,
    "playsInRound" to model.playsInRound,
    "roundTarget" to model.roundTarget,
    "currentWaitMs" to model.currentWaitMs.toDouble(),
    "positionMs" to positionMs.toDouble(),
    "durationMs" to durationMs.toDouble(),
    "waitRemainingMs" to model.waitRemainingAt(nowMs).toDouble(),
    "sessionRemainingMs" to model.sessionRemainingAt(nowMs).toDouble(),
    "intervalMinMs" to (model.config?.intervalMinMs ?: 0L).toDouble(),
    "intervalMaxMs" to (model.config?.intervalMaxMs ?: 0L).toDouble(),
    "playsMin" to (model.config?.playsMin ?: 1),
    "playsMax" to (model.config?.playsMax ?: 1),
    "sessionMs" to (model.config?.sessionMs ?: 0L).toDouble(),
    "title" to title,
  )
}

/**
 * Process-wide holder of the latest snapshot. The playback service is the only
 * writer. The JS module only reads and subscribes, so there is a single source of truth.
 */
object CycleStore {
  private const val PREFS = "voicecycle.session"
  private const val KEY_ACTIVE = "active"
  private const val KEY_TITLE = "title"
  private const val KEY_STARTED_AT = "startedAt"
  private const val KEY_ENDED_AT = "endedAt"
  private const val KEY_END_REASON = "endReason"
  private const val KEY_REPS = "repetitions"
  private const val KEY_ERROR = "error"

  private val mainHandler = Handler(Looper.getMainLooper())
  private val listeners = CopyOnWriteArrayList<(PlayerSnapshot) -> Unit>()

  @Volatile
  var snapshot: PlayerSnapshot = PlayerSnapshot()
    private set

  fun publish(next: PlayerSnapshot) {
    snapshot = next
    mainHandler.post { listeners.forEach { it(next) } }
  }

  fun addListener(listener: (PlayerSnapshot) -> Unit) {
    listeners.add(listener)
  }

  fun removeListener(listener: (PlayerSnapshot) -> Unit) {
    listeners.remove(listener)
  }

  /** Marks a session as running so an unexpected process death can be reported later. */
  fun markSessionStarted(context: Context, title: String?) {
    prefs(context).edit()
      .putBoolean(KEY_ACTIVE, true)
      .putString(KEY_TITLE, title)
      .putLong(KEY_STARTED_AT, System.currentTimeMillis())
      .remove(KEY_ENDED_AT).remove(KEY_END_REASON).remove(KEY_REPS).remove(KEY_ERROR)
      .apply()
  }

  fun markSessionEnded(context: Context, model: CycleModel) {
    prefs(context).edit()
      .putBoolean(KEY_ACTIVE, false)
      .putLong(KEY_ENDED_AT, System.currentTimeMillis())
      .putString(KEY_END_REASON, model.endReason?.name)
      .putInt(KEY_REPS, model.completedRepetitions)
      .putString(KEY_ERROR, model.errorMessage)
      .apply()
  }

  /** Records progress so a report survives if the process is killed mid-session. */
  fun recordProgress(context: Context, repetitions: Int) {
    prefs(context).edit().putInt(KEY_REPS, repetitions).apply()
  }

  /**
   * Describes the most recent session. "interrupted" means the session was still
   * marked active although no playback service is running in this process, which
   * happens when Android killed the app or the phone restarted.
   */
  fun lastSessionReport(context: Context): Map<String, Any?>? {
    val p = prefs(context)
    if (!p.contains(KEY_STARTED_AT)) return null
    val wasActive = p.getBoolean(KEY_ACTIVE, false)
    val status = when {
      wasActive && snapshot.model.isActive -> "running"
      wasActive -> "interrupted"
      else -> "finished"
    }
    return mapOf(
      "status" to status,
      "title" to p.getString(KEY_TITLE, null),
      "startedAt" to p.getLong(KEY_STARTED_AT, 0).toDouble(),
      "endedAt" to if (p.contains(KEY_ENDED_AT)) p.getLong(KEY_ENDED_AT, 0).toDouble() else null,
      "endReason" to p.getString(KEY_END_REASON, null),
      "completedRepetitions" to p.getInt(KEY_REPS, 0),
      "errorMessage" to p.getString(KEY_ERROR, null),
    )
  }

  private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
}
