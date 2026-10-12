import { formatClock, formatMinutes, minutesToMs } from '../time';

describe('formatClock', () => {
  it('formats minutes and seconds', () => {
    expect(formatClock(247_000)).toBe('4:07');
  });

  it('includes hours when needed', () => {
    expect(formatClock(3_909_000)).toBe('1:05:09');
  });

  it('rounds countdowns up so they never show zero early', () => {
    expect(formatClock(400, true)).toBe('0:01');
    expect(formatClock(400)).toBe('0:00');
  });

  it('treats negative and invalid values as zero', () => {
    expect(formatClock(-5)).toBe('0:00');
    expect(formatClock(Number.NaN)).toBe('0:00');
  });
});

describe('formatMinutes', () => {
  it.each([
    [0, '0 min'],
    [0.5, '30 s'],
    [10, '10 min'],
    [120, '2 h'],
    [90, '1 h 30 min'],
    [1.5, '1 min 30 s'],
    [2.25, '2 min 15 s'],
  ])('formats %p minutes as %p', (minutes, expected) => {
    expect(formatMinutes(minutes)).toBe(expected);
  });
});

describe('minutesToMs', () => {
  it('converts fractional minutes', () => {
    expect(minutesToMs(0.5)).toBe(30_000);
    expect(minutesToMs(10)).toBe(600_000);
  });
});
