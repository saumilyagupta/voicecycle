import type { CycleOptions } from '../../modules/voicecycle-player';

export type ThemeId = 'dusk' | 'black' | 'ember';

/** A value is either fixed or drawn at random from a range, fresh for every round. */
export type ValueMode = 'fixed' | 'random';

export type Range = { min: number; max: number };

export type StoredRecording = {
  /** file:// URI of the app's private copy of the recording. */
  uri: string;
  name: string;
  durationMs: number;
};

export type Settings = {
  /** Silent countdown after Start, before the first play, in minutes. 0 means off. */
  startDelayMinutes: number;
  /** Fixed wait after each round, in minutes. */
  intervalMinutes: number;
  waitMode: ValueMode;
  /** Random wait range, in minutes. */
  waitRange: Range;
  /** Fixed number of back-to-back plays per round. */
  playsPerRound: number;
  playsMode: ValueMode;
  /** Random plays-per-round range. */
  playsRange: Range;
  sessionMinutes: number;
  themeId: ThemeId;
  recording: StoredRecording | null;
};

export const START_DELAY_PRESETS_MIN = [0, 10, 20, 30] as const;
export const INTERVAL_PRESETS_MIN = [0, 5, 10, 15, 20, 30] as const;
export const PLAYS_PRESETS = [1, 2, 3] as const;
export const SESSION_PRESETS_MIN = [60, 120, 240, 360, 480] as const;

export const START_DELAY_LIMITS = { min: 0, max: 240 } as const;
export const INTERVAL_LIMITS = { min: 0, max: 240 } as const;
export const PLAYS_LIMITS = { min: 1, max: 50 } as const;
export const SESSION_LIMITS = { min: 1, max: 1440 } as const;

export const THEME_IDS: readonly ThemeId[] = ['dusk', 'black', 'ember'];

export const DEFAULT_SETTINGS: Settings = {
  startDelayMinutes: 0,
  intervalMinutes: 10,
  waitMode: 'fixed',
  waitRange: { min: 5, max: 15 },
  playsPerRound: 1,
  playsMode: 'fixed',
  playsRange: { min: 1, max: 3 },
  sessionMinutes: 480,
  themeId: 'dusk',
  recording: null,
};

type Limits = { min: number; max: number };

const MS_PER_MINUTE = 60_000;

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

/** Parses a whole number of plays. Returns null for anything else or outside the limits. */
export function parseCountInput(text: string, limits: Limits): number | null {
  const normalized = text.trim();
  if (!/^\d+$/.test(normalized)) return null;
  const value = Number(normalized);
  return isWithin(value, limits) ? value : null;
}

function parseRange(value: unknown, limits: Limits, fallback: Range): Range {
  if (typeof value !== 'object' || value === null) return fallback;
  const { min, max } = value as Record<string, unknown>;
  if (!isWithin(min, limits) || !isWithin(max, limits) || min > max) return fallback;
  return { min, max };
}

const parseMode = (value: unknown): ValueMode => (value === 'random' ? 'random' : 'fixed');

function parseRecording(value: unknown): StoredRecording | null {
  if (typeof value !== 'object' || value === null) return null;
  const { uri, name, durationMs } = value as Record<string, unknown>;
  if (typeof uri !== 'string' || !uri.startsWith('file://')) return null;
  if (typeof name !== 'string' || name.length === 0) return null;
  if (typeof durationMs !== 'number' || !Number.isFinite(durationMs) || durationMs <= 0) return null;
  return { uri, name, durationMs };
}

/**
 * Validates persisted data field by field. Anything invalid or missing falls back
 * to its default, so settings saved by older versions load cleanly.
 */
export function parseSettings(raw: unknown): Settings {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_SETTINGS;
  const data = raw as Record<string, unknown>;
  const plays = data.playsPerRound;
  return {
    startDelayMinutes: isWithin(data.startDelayMinutes, START_DELAY_LIMITS)
      ? data.startDelayMinutes
      : DEFAULT_SETTINGS.startDelayMinutes,
    intervalMinutes: isWithin(data.intervalMinutes, INTERVAL_LIMITS)
      ? data.intervalMinutes
      : DEFAULT_SETTINGS.intervalMinutes,
    waitMode: parseMode(data.waitMode),
    waitRange: parseRange(data.waitRange, INTERVAL_LIMITS, DEFAULT_SETTINGS.waitRange),
    playsPerRound: isWithin(plays, PLAYS_LIMITS) && Number.isInteger(plays) ? plays : DEFAULT_SETTINGS.playsPerRound,
    playsMode: parseMode(data.playsMode),
    playsRange: parseRange(data.playsRange, PLAYS_LIMITS, DEFAULT_SETTINGS.playsRange),
    sessionMinutes: isWithin(data.sessionMinutes, SESSION_LIMITS)
      ? data.sessionMinutes
      : DEFAULT_SETTINGS.sessionMinutes,
    themeId: THEME_IDS.includes(data.themeId as ThemeId) ? (data.themeId as ThemeId) : DEFAULT_SETTINGS.themeId,
    recording: parseRecording(data.recording),
  };
}

/** Wait range in minutes that the session will use. A fixed wait is a range of one value. */
export function activeWaitRange(settings: Settings): Range {
  return settings.waitMode === 'random'
    ? settings.waitRange
    : { min: settings.intervalMinutes, max: settings.intervalMinutes };
}

/** Plays-per-round range that the session will use. */
export function activePlaysRange(settings: Settings): Range {
  return settings.playsMode === 'random'
    ? settings.playsRange
    : { min: settings.playsPerRound, max: settings.playsPerRound };
}

/** Converts settings into what the native player needs. */
export function toCycleOptions(settings: Settings): CycleOptions {
  const wait = activeWaitRange(settings);
  const plays = activePlaysRange(settings);
  return {
    intervalMinMs: Math.round(wait.min * MS_PER_MINUTE),
    intervalMaxMs: Math.round(wait.max * MS_PER_MINUTE),
    playsMin: plays.min,
    playsMax: plays.max,
    sessionMs: Math.round(settings.sessionMinutes * MS_PER_MINUTE),
    startDelayMs: Math.round(settings.startDelayMinutes * MS_PER_MINUTE),
  };
}

/**
 * Rough number of plays in a session, for the "about N plays" hint.
 * Random values are counted at the middle of their range.
 */
export function estimatePlays(durationMs: number, settings: Settings): number {
  if (durationMs <= 0 || settings.sessionMinutes <= 0) return 0;
  const wait = activeWaitRange(settings);
  const plays = activePlaysRange(settings);
  const averagePlays = (plays.min + plays.max) / 2;
  const averageWaitMs = ((wait.min + wait.max) / 2) * MS_PER_MINUTE;
  const roundMs = averagePlays * durationMs + averageWaitMs;
  // The last round may be cut short by the session timer, so count any round that starts in time.
  const rounds = Math.ceil((settings.sessionMinutes * MS_PER_MINUTE) / roundMs);
  return Math.max(1, Math.round(rounds * averagePlays));
}
