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
  /** Plays finished in the current round. */
  playsInRound: number;
  /** Plays in the current round. */
  roundTarget: number;
  /** Full length of the current or most recent wait. */
  currentWaitMs: number;
  positionMs: number;
  durationMs: number;
  waitRemainingMs: number;
  sessionRemainingMs: number;
  intervalMinMs: number;
  intervalMaxMs: number;
  playsMin: number;
  playsMax: number;
  sessionMs: number;
  title: string | null;
};

/** Ranges with min === max are fixed values. Random values are drawn natively for every round. */
export type CycleOptions = {
  intervalMinMs: number;
  intervalMaxMs: number;
  playsMin: number;
  playsMax: number;
  sessionMs: number;
};

export type StartOptions = CycleOptions & {
  uri: string;
  title: string;
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
