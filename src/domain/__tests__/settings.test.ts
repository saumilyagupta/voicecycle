import {
  DEFAULT_SETTINGS,
  estimatePlays,
  INTERVAL_LIMITS,
  parseCountInput,
  parseMinutesInput,
  parseSettings,
  PLAYS_LIMITS,
  SESSION_LIMITS,
  toCycleOptions,
  type Settings,
} from '../settings';

const settings = (patch: Partial<Settings>): Settings => ({ ...DEFAULT_SETTINGS, ...patch });

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

describe('parseCountInput', () => {
  it('accepts whole numbers inside the limits', () => {
    expect(parseCountInput('3', PLAYS_LIMITS)).toBe(3);
    expect(parseCountInput(' 12 ', PLAYS_LIMITS)).toBe(12);
  });

  it('rejects decimals, zero and out-of-range values', () => {
    expect(parseCountInput('1.5', PLAYS_LIMITS)).toBeNull();
    expect(parseCountInput('0', PLAYS_LIMITS)).toBeNull();
    expect(parseCountInput('51', PLAYS_LIMITS)).toBeNull();
    expect(parseCountInput('two', PLAYS_LIMITS)).toBeNull();
  });
});

describe('parseSettings', () => {
  it('returns defaults for missing or corrupt data', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('nonsense')).toEqual(DEFAULT_SETTINGS);
  });

  it('loads settings saved by the first version and fills in the new fields', () => {
    const recording = { uri: 'file:///data/rec.m4a', name: 'rec.m4a', durationMs: 720_000 };
    expect(parseSettings({ intervalMinutes: 0, sessionMinutes: 120, themeId: 'ember', recording })).toEqual({
      ...DEFAULT_SETTINGS,
      intervalMinutes: 0,
      sessionMinutes: 120,
      themeId: 'ember',
      recording,
    });
  });

  it('keeps valid random ranges and plays settings', () => {
    const parsed = parseSettings({
      waitMode: 'random',
      waitRange: { min: 2, max: 9 },
      playsMode: 'random',
      playsRange: { min: 1, max: 4 },
      playsPerRound: 2,
    });
    expect(parsed.waitMode).toBe('random');
    expect(parsed.waitRange).toEqual({ min: 2, max: 9 });
    expect(parsed.playsMode).toBe('random');
    expect(parsed.playsRange).toEqual({ min: 1, max: 4 });
    expect(parsed.playsPerRound).toBe(2);
  });

  it('replaces invalid fields individually', () => {
    const parsed = parseSettings({
      intervalMinutes: -1,
      sessionMinutes: 120,
      themeId: 'neon',
      waitMode: 'chaos',
      waitRange: { min: 9, max: 2 },
      playsPerRound: 1.5,
      playsRange: { min: 0, max: 3 },
      recording: { uri: 'content://x', name: 'x', durationMs: 5 },
    });
    expect(parsed.intervalMinutes).toBe(DEFAULT_SETTINGS.intervalMinutes);
    expect(parsed.sessionMinutes).toBe(120);
    expect(parsed.themeId).toBe(DEFAULT_SETTINGS.themeId);
    expect(parsed.waitMode).toBe('fixed');
    expect(parsed.waitRange).toEqual(DEFAULT_SETTINGS.waitRange);
    expect(parsed.playsPerRound).toBe(DEFAULT_SETTINGS.playsPerRound);
    expect(parsed.playsRange).toEqual(DEFAULT_SETTINGS.playsRange);
    expect(parsed.recording).toBeNull();
  });
});

describe('toCycleOptions', () => {
  it('sends a fixed wait and fixed plays as single-value ranges', () => {
    expect(toCycleOptions(settings({ intervalMinutes: 10, playsPerRound: 2, sessionMinutes: 60 }))).toEqual({
      intervalMinMs: 600_000,
      intervalMaxMs: 600_000,
      playsMin: 2,
      playsMax: 2,
      sessionMs: 3_600_000,
    });
  });

  it('sends the random ranges when random mode is on', () => {
    const options = toCycleOptions(
      settings({
        waitMode: 'random',
        waitRange: { min: 0.5, max: 3 },
        playsMode: 'random',
        playsRange: { min: 1, max: 3 },
      }),
    );
    expect(options).toMatchObject({ intervalMinMs: 30_000, intervalMaxMs: 180_000, playsMin: 1, playsMax: 3 });
  });
});

describe('estimatePlays', () => {
  it('matches the 12 min recording, 10 min wait, 8 h example', () => {
    // Plays start at 0, 22, 44, ... 462 minutes: 22 plays begin inside 480 minutes.
    expect(estimatePlays(12 * 60_000, settings({ intervalMinutes: 10, sessionMinutes: 480 }))).toBe(22);
  });

  it('handles a zero interval', () => {
    expect(estimatePlays(30 * 60_000, settings({ intervalMinutes: 0, sessionMinutes: 60 }))).toBe(2);
  });

  it('counts several plays per round', () => {
    // Round = 3 x 10 min + 30 min wait = 60 min, so 2 rounds in 2 h = 6 plays.
    expect(estimatePlays(10 * 60_000, settings({ intervalMinutes: 30, playsPerRound: 3, sessionMinutes: 120 }))).toBe(6);
  });

  it('uses the middle of random ranges', () => {
    // Average round = 2 x 10 min + 20 min = 40 min, 3 rounds in 2 h, 6 plays.
    const random = settings({
      waitMode: 'random',
      waitRange: { min: 10, max: 30 },
      playsMode: 'random',
      playsRange: { min: 1, max: 3 },
      sessionMinutes: 120,
    });
    expect(estimatePlays(10 * 60_000, random)).toBe(6);
  });

  it('returns zero without a recording', () => {
    expect(estimatePlays(0, DEFAULT_SETTINGS)).toBe(0);
  });
});
