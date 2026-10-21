import type { PlayerSnapshot } from '../../../modules/voicecycle-player';
import {
  describeStatus,
  heroCountdownMs,
  IDLE_SNAPSHOT,
  isActiveState,
  primaryActionFor,
  recordingProgress,
} from '../display';
import { describeReport } from '../report';

const snap = (patch: Partial<PlayerSnapshot>): PlayerSnapshot => ({ ...IDLE_SNAPSHOT, ...patch });

describe('primaryActionFor', () => {
  it('maps each state to one big-button action', () => {
    expect(primaryActionFor('IDLE')).toBe('start');
    expect(primaryActionFor('STOPPED')).toBe('start');
    expect(primaryActionFor('PLAYING')).toBe('pause');
    expect(primaryActionFor('WAITING')).toBe('pause');
    expect(primaryActionFor('PAUSED')).toBe('resume');
  });

  it('treats only playing, waiting and paused as active', () => {
    expect(['IDLE', 'PLAYING', 'WAITING', 'PAUSED', 'STOPPED'].map((s) => isActiveState(s as never))).toEqual([
      false,
      true,
      true,
      true,
      false,
    ]);
  });
});

describe('heroCountdownMs', () => {
  it('counts down to the next play while waiting', () => {
    expect(heroCountdownMs(snap({ state: 'WAITING', waitRemainingMs: 420_000 }))).toEqual({
      label: 'Next play in',
      ms: 420_000,
    });
  });

  it('keeps the wait countdown when paused during the wait', () => {
    expect(heroCountdownMs(snap({ state: 'PAUSED', pausedFrom: 'WAITING', waitRemainingMs: 60_000 }))?.label).toBe(
      'Next play in',
    );
  });

  it('shows recording time left while playing', () => {
    expect(heroCountdownMs(snap({ state: 'PLAYING', durationMs: 720_000, positionMs: 120_000 }))).toEqual({
      label: 'Recording left',
      ms: 600_000,
    });
  });

  it('has nothing to count when idle', () => {
    expect(heroCountdownMs(IDLE_SNAPSHOT)).toBeNull();
  });
});

describe('recordingProgress', () => {
  it('is a clamped fraction of the duration', () => {
    expect(recordingProgress(snap({ state: 'PLAYING', durationMs: 1000, positionMs: 250 }))).toBe(0.25);
    expect(recordingProgress(snap({ state: 'PLAYING', durationMs: 1000, positionMs: 5000 }))).toBe(1);
    expect(recordingProgress(snap({ state: 'PLAYING', durationMs: 0, positionMs: 10 }))).toBe(0);
  });

  it('is full while waiting', () => {
    expect(recordingProgress(snap({ state: 'WAITING', durationMs: 1000 }))).toBe(1);
  });
});

describe('describeStatus', () => {
  it('explains interruptions that will resume by themselves', () => {
    const status = describeStatus(snap({ state: 'PAUSED', pausedFrom: 'PLAYING', pauseReason: 'INTERRUPTION' }));
    expect(status.title).toBe('Paused');
    expect(status.detail).toMatch(/resumes automatically/);
  });

  it('shows the error message when a session failed', () => {
    expect(describeStatus(snap({ state: 'STOPPED', endReason: 'ERROR', errorMessage: 'File gone' })).detail).toBe(
      'File gone',
    );
  });

  it('reports session completion', () => {
    expect(describeStatus(snap({ state: 'STOPPED', endReason: 'SESSION_COMPLETE' })).detail).toBe('Session time is up');
  });
});

describe('describeReport', () => {
  const base = {
    title: 'rec',
    startedAt: new Date(2026, 9, 12, 23, 0).getTime(),
    endedAt: new Date(2026, 9, 13, 7, 0).getTime(),
    completedRepetitions: 22,
    errorMessage: null,
  };

  it('warns when the previous session was killed', () => {
    const result = describeReport({ ...base, status: 'interrupted', endedAt: null, endReason: null });
    expect(result?.tone).toBe('warning');
    expect(result?.text).toMatch(/cut off after 22 plays/);
  });

  it('summarises a completed session', () => {
    const result = describeReport({ ...base, status: 'finished', endReason: 'SESSION_COMPLETE' });
    expect(result).toEqual({ tone: 'info', text: 'Last session finished at 7:00 after 22 plays.' });
  });

  it('shows nothing while a session is running or without history', () => {
    expect(describeReport({ ...base, status: 'running', endReason: null })).toBeNull();
    expect(describeReport(null)).toBeNull();
  });
});

describe('start delay', () => {
  const delayed = snap({ state: 'WAITING', inStartDelay: true, waitRemainingMs: 600_000, durationMs: 60_000 });

  it('shows a starting-soon status with a first-play countdown', () => {
    expect(describeStatus(delayed).title).toBe('Starting soon');
    expect(heroCountdownMs(delayed)).toEqual({ label: 'First play in', ms: 600_000 });
  });

  it('shows the recording as not yet played', () => {
    expect(recordingProgress(delayed)).toBe(0);
  });

  it('names the start delay when paused during it', () => {
    const paused = snap({ state: 'PAUSED', pausedFrom: 'WAITING', inStartDelay: true, waitRemainingMs: 300_000 });
    expect(describeStatus(paused).detail).toBe('Start delay paused');
    expect(heroCountdownMs(paused)?.label).toBe('First play in');
  });
});

describe('rounds and random waits', () => {
  it('shows the position in a multi-play round', () => {
    const status = describeStatus(snap({ state: 'PLAYING', playsInRound: 1, roundTarget: 3 }));
    expect(status.detail).toBe('Play 2 of 3 in this round');
  });

  it('keeps the plain text for single-play rounds', () => {
    expect(describeStatus(snap({ state: 'PLAYING', roundTarget: 1 })).detail).toBe('The recording is playing');
  });

  it('shows the drawn length of a random wait', () => {
    const status = describeStatus(
      snap({ state: 'WAITING', intervalMinMs: 60_000, intervalMaxMs: 600_000, currentWaitMs: 432_000 }),
    );
    expect(status.detail).toBe('Random wait of 7:12 this time');
  });

  it('keeps the plain text for fixed waits', () => {
    const status = describeStatus(snap({ state: 'WAITING', intervalMinMs: 60_000, intervalMaxMs: 60_000 }));
    expect(status.detail).toBe('Silent until the next play');
  });
});
