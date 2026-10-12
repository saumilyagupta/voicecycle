export type ThemeId = 'dusk' | 'black' | 'ember';

export type StoredRecording = {
  /** file:// URI of the app's private copy of the recording. */
  uri: string;
  name: string;
  durationMs: number;
};

export type Settings = {
  intervalMinutes: number;
  sessionMinutes: number;
  themeId: ThemeId;
  recording: StoredRecording | null;
};

export const INTERVAL_PRESETS_MIN = [0, 5, 10, 15, 20, 30] as const;
export const SESSION_PRESETS_MIN = [60, 120, 240, 360, 480] as const;

export const INTERVAL_LIMITS = { min: 0, max: 240 } as const;
export const SESSION_LIMITS = { min: 1, max: 1440 } as const;

export const THEME_IDS: readonly ThemeId[] = ['dusk', 'black', 'ember'];

export const DEFAULT_SETTINGS: Settings = {
  intervalMinutes: 10,
  sessionMinutes: 480,
  themeId: 'dusk',
  recording: null,
};

type Limits = { min: number; max: number };

const isWithin = (value: unknown, limits: Limits): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= limits.min && value <= limits.max;

/**
 * Parses free-text minutes from a custom input. Accepts decimals with "." or ","
 * so short test intervals such as 0.5 (30 seconds) are possible.
 * Returns null when the text is not a number inside the limits.
 */
export function parseMinutesInput(text: string, limits: Limits): number | null {
  const normalized = text.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const value = Number(normalized);
  return isWithin(value, limits) ? Math.round(value * 100) / 100 : null;
}

function parseRecording(value: unknown): StoredRecording | null {
  if (typeof value !== 'object' || value === null) return null;
  const { uri, name, durationMs } = value as Record<string, unknown>;
  if (typeof uri !== 'string' || !uri.startsWith('file://')) return null;
  if (typeof name !== 'string' || name.length === 0) return null;
  if (typeof durationMs !== 'number' || !Number.isFinite(durationMs) || durationMs <= 0) return null;
  return { uri, name, durationMs };
}

/** Validates persisted data field by field. Anything invalid falls back to its default. */
export function parseSettings(raw: unknown): Settings {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_SETTINGS;
  const data = raw as Record<string, unknown>;
  return {
    intervalMinutes: isWithin(data.intervalMinutes, INTERVAL_LIMITS)
      ? data.intervalMinutes
      : DEFAULT_SETTINGS.intervalMinutes,
    sessionMinutes: isWithin(data.sessionMinutes, SESSION_LIMITS)
      ? data.sessionMinutes
      : DEFAULT_SETTINGS.sessionMinutes,
    themeId: THEME_IDS.includes(data.themeId as ThemeId) ? (data.themeId as ThemeId) : DEFAULT_SETTINGS.themeId,
    recording: parseRecording(data.recording),
  };
}

/** Number of plays that fit in a session, for the "about N plays" hint. */
export function estimatePlays(durationMs: number, intervalMinutes: number, sessionMinutes: number): number {
  if (durationMs <= 0 || sessionMinutes <= 0) return 0;
  const sessionMs = sessionMinutes * 60_000;
  const cycleMs = durationMs + intervalMinutes * 60_000;
  // The last play may be cut short by the session timer, so count any play that starts in time.
  return Math.max(1, Math.ceil(sessionMs / cycleMs));
}
