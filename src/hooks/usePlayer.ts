import { useCallback, useEffect, useState } from 'react';
import { AppState, PermissionsAndroid, Platform } from 'react-native';

import {
  VoiceCyclePlayer,
  type PlayerSnapshot,
  type SessionReport,
  type StartOptions,
} from '../../modules/voicecycle-player';
import { IDLE_SNAPSHOT } from '../domain/display';

const ANDROID_13 = 33;

export type PlayerControls = {
  isAvailable: boolean;
  snapshot: PlayerSnapshot;
  lastReport: SessionReport | null;
  /** True when the user declined notifications, so lock-screen controls may be hidden. */
  notificationsDenied: boolean;
  start: (options: StartOptions) => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => void;
};

async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android' || Number(Platform.Version) < ANDROID_13) return true;
  const permission = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
  if (await PermissionsAndroid.check(permission)) return true;
  const result = await PermissionsAndroid.request(permission);
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

/**
 * Mirrors the native service state. It never keeps timers of its own: the UI
 * only re-renders snapshots, so returning to the foreground cannot create a
 * second playback loop.
 */
export function usePlayer(): PlayerControls {
  const player = VoiceCyclePlayer;
  const [snapshot, setSnapshot] = useState<PlayerSnapshot>(() => player?.getSnapshot() ?? IDLE_SNAPSHOT);
  const [lastReport, setLastReport] = useState<SessionReport | null>(() => player?.getLastSessionReport() ?? null);
  const [notificationsDenied, setNotificationsDenied] = useState(false);

  useEffect(() => {
    if (!player) return;
    const refresh = () => {
      setSnapshot(player.getSnapshot());
      setLastReport(player.getLastSessionReport());
    };
    const subscription = player.addListener('onSnapshot', (next) => {
      setSnapshot(next);
      // The stored report changes when a session ends.
      if (next.state === 'STOPPED') setLastReport(player.getLastSessionReport());
    });
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    refresh();
    return () => {
      subscription.remove();
      appStateSubscription.remove();
    };
  }, [player]);

  const start = useCallback(
    async (options: StartOptions) => {
      if (!player) throw new Error('The VoiceCycle player is not available in this build.');
      const granted = await ensureNotificationPermission();
      setNotificationsDenied(!granted);
      if (!player.start(options)) throw new Error('A session is already running.');
    },
    [player],
  );

  const pause = useCallback(() => player?.pause(), [player]);
  const resume = useCallback(() => player?.resume(), [player]);
  const stop = useCallback(() => player?.stop(), [player]);

  return { isAvailable: player !== null, snapshot, lastReport, notificationsDenied, start, pause, resume, stop };
}
