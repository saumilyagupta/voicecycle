import {
  DEFAULT_SETTINGS,
  estimatePlays,
  INTERVAL_LIMITS,
  parseMinutesInput,
  parseSettings,
  SESSION_LIMITS,
} from '../settings';

describe('parseMinutesInput', () => {
  it('accepts whole and decimal minutes', () => {
    expect(parseMinutesInput('12', INTERVAL_LIMITS)).toBe(12);
    expect(parseMinutesInput('0.5', INTERVAL_LIMITS)).toBe(0.5);
    expect(parseMinutesInput(' 1,5 ', INTERVAL_LIMITS)).toBe(1.5);
  });

  it('accepts zero for the interval but not for the session', () => {
    expect(parseMinutesInput('0', INTERVAL_LIMITS)).toBe(0);
    expect(parseMinutesInput('0', SESSION_LIMITS)).toBeNull();
  });

  it('rejects text, negatives and out-of-range values', () => {
    expect(parseMinutesInput('abc', INTERVAL_LIMITS)).toBeNull();
    expect(parseMinutesInput('-3', INTERVAL_LIMITS)).toBeNull();
    expect(parseMinutesInput('', INTERVAL_LIMITS)).toBeNull();
    expect(parseMinutesInput('241', INTERVAL_LIMITS)).toBeNull();
    expect(parseMinutesInput('1e3', SESSION_LIMITS)).toBeNull();
  });
});

describe('parseSettings', () => {
  it('returns defaults for missing or corrupt data', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('nonsense')).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps valid values', () => {
    const recording = { uri: 'file:///data/rec.m4a', name: 'rec.m4a', durationMs: 720_000 };
    expect(parseSettings({ intervalMinutes: 0, sessionMinutes: 120, themeId: 'ember', recording })).toEqual({
      intervalMinutes: 0,
      sessionMinutes: 120,
      themeId: 'ember',
      recording,
    });
  });

  it('replaces invalid fields individually', () => {
    const parsed = parseSettings({
      intervalMinutes: -1,
      sessionMinutes: 120,
      themeId: 'neon',
      recording: { uri: 'content://x', name: 'x', durationMs: 5 },
    });
    expect(parsed.intervalMinutes).toBe(DEFAULT_SETTINGS.intervalMinutes);
    expect(parsed.sessionMinutes).toBe(120);
    expect(parsed.themeId).toBe(DEFAULT_SETTINGS.themeId);
    expect(parsed.recording).toBeNull();
  });
});

describe('estimatePlays', () => {
  it('matches the 12 min recording, 10 min wait, 8 h example', () => {
    // Plays start at 0, 22, 44, ... 462 minutes: 22 plays begin inside 480 minutes.
    expect(estimatePlays(12 * 60_000, 10, 480)).toBe(22);
  });

  it('handles a zero interval', () => {
    expect(estimatePlays(30 * 60_000, 0, 60)).toBe(2);
  });

  it('returns zero without a recording', () => {
    expect(estimatePlays(0, 10, 60)).toBe(0);
  });
});
