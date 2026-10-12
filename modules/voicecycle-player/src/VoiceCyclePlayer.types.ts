export type CycleState = 'IDLE' | 'PLAYING' | 'WAITING' | 'PAUSED' | 'STOPPED';
export type PauseReason = 'USER' | 'INTERRUPTION' | 'FOCUS_LOST' | 'NOISY';
export type EndReason = 'USER' | 'SESSION_COMPLETE' | 'ERROR';

/** State published by the native playback service, the single source of truth. */
export type PlayerSnapshot = {
  state: CycleState;
  pausedFrom: CycleState | null;
  pauseReason: PauseReason | null;
  endReason: EndReason | null;
  errorMessage: string | null;
  completedRepetitions: number;
  positionMs: number;
  durationMs: number;
  waitRemainingMs: number;
  sessionRemainingMs: number;
  intervalMs: number;
  sessionMs: number;
  title: string | null;
};

export type StartOptions = {
  uri: string;
  title: string;
  intervalMs: number;
  sessionMs: number;
};

export type SessionReport = {
  status: 'running' | 'finished' | 'interrupted';
  title: string | null;
  startedAt: number;
  endedAt: number | null;
  endReason: EndReason | null;
  completedRepetitions: number;
  errorMessage: string | null;
};

export type ProbeResult = { durationMs: number };

export type VoiceCyclePlayerEvents = {
  onSnapshot(snapshot: PlayerSnapshot): void;
};
