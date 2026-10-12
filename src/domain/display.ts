import type { CycleState, PlayerSnapshot } from '../../modules/voicecycle-player';

export const IDLE_SNAPSHOT: PlayerSnapshot = {
  state: 'IDLE',
  pausedFrom: null,
  pauseReason: null,
  endReason: null,
  errorMessage: null,
  completedRepetitions: 0,
  positionMs: 0,
  durationMs: 0,
  waitRemainingMs: 0,
  sessionRemainingMs: 0,
  intervalMs: 0,
  sessionMs: 0,
  title: null,
};

export type PrimaryAction = 'start' | 'pause' | 'resume';

export const isActiveState = (state: CycleState): boolean =>
  state === 'PLAYING' || state === 'WAITING' || state === 'PAUSED';

export function primaryActionFor(state: CycleState): PrimaryAction {
  if (state === 'PLAYING' || state === 'WAITING') return 'pause';
  if (state === 'PAUSED') return 'resume';
  return 'start';
}

export type StatusText = { title: string; detail: string };

/** Headline and supporting line for the current state. */
export function describeStatus(snapshot: PlayerSnapshot): StatusText {
  switch (snapshot.state) {
    case 'PLAYING':
      return { title: 'Playing', detail: 'The recording is playing' };
    case 'WAITING':
      return { title: 'Waiting', detail: 'Silent until the next play' };
    case 'PAUSED':
      return { title: 'Paused', detail: pauseDetail(snapshot) };
    case 'STOPPED':
      return { title: 'Stopped', detail: endDetail(snapshot) };
    default:
      return { title: 'Ready', detail: 'Choose a recording and press Start' };
  }
}

function pauseDetail(snapshot: PlayerSnapshot): string {
  const during = snapshot.pausedFrom === 'WAITING' ? 'Countdown paused' : 'Recording paused';
  switch (snapshot.pauseReason) {
    case 'INTERRUPTION':
      return `${during} by a call or alert. It resumes automatically.`;
    case 'FOCUS_LOST':
      return `${during} because another app started playing audio`;
    case 'NOISY':
      return `${during} because headphones were disconnected`;
    default:
      return during;
  }
}

function endDetail(snapshot: PlayerSnapshot): string {
  switch (snapshot.endReason) {
    case 'SESSION_COMPLETE':
      return 'Session time is up';
    case 'ERROR':
      return snapshot.errorMessage ?? 'Playback failed';
    default:
      return 'Session stopped';
  }
}

/** Fraction of the recording played, 0..1. A finished recording reads as full while waiting. */
export function recordingProgress(snapshot: PlayerSnapshot): number {
  if (snapshot.state === 'WAITING') return 1;
  if (snapshot.durationMs <= 0) return 0;
  return Math.min(1, Math.max(0, snapshot.positionMs / snapshot.durationMs));
}

/** Countdown shown in the hero: next play while waiting, otherwise recording time left. */
export function heroCountdownMs(snapshot: PlayerSnapshot): { label: string; ms: number } | null {
  const waiting = snapshot.state === 'WAITING' || (snapshot.state === 'PAUSED' && snapshot.pausedFrom === 'WAITING');
  if (waiting) return { label: 'Next play in', ms: snapshot.waitRemainingMs };
  if (snapshot.state === 'PLAYING' || snapshot.state === 'PAUSED') {
    return { label: 'Recording left', ms: Math.max(0, snapshot.durationMs - snapshot.positionMs) };
  }
  return null;
}
