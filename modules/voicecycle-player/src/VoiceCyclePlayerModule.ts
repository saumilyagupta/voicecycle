import { NativeModule, requireOptionalNativeModule } from 'expo';

import type {
  PlayerSnapshot,
  ProbeResult,
  SessionReport,
  StartOptions,
  VoiceCyclePlayerEvents,
} from './VoiceCyclePlayer.types';

declare class VoiceCyclePlayerNativeModule extends NativeModule<VoiceCyclePlayerEvents> {
  getSnapshot(): PlayerSnapshot;
  getLastSessionReport(): SessionReport | null;
  probe(uri: string): Promise<ProbeResult>;
  start(options: StartOptions): boolean;
  pause(): void;
  resume(): void;
  stop(): void;
}

/**
 * Null when running without the native module (Expo Go, web, unit tests).
 * The app shows a clear message instead of crashing in that case.
 */
export const VoiceCyclePlayer = requireOptionalNativeModule<VoiceCyclePlayerNativeModule>('VoiceCyclePlayer');
