import { useCallback, useEffect, useRef, useState } from 'react';

import { DEFAULT_SETTINGS, type Settings } from '../domain/settings';
import { recordingExists } from '../services/recordingLibrary';
import { loadSettings, saveSettings } from '../services/settingsRepository';

export type SettingsState = {
  settings: Settings;
  isLoaded: boolean;
  /** A recording was saved earlier but its file is no longer readable. */
  missingRecordingName: string | null;
  /** Applies the patch immediately. The promise rejects if it could not be saved. */
  update: (patch: Partial<Settings>) => Promise<void>;
};

export function useSettings(): SettingsState {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);
  const [missingRecordingName, setMissingRecordingName] = useState<string | null>(null);
  const latest = useRef(settings);

  useEffect(() => {
    let cancelled = false;
    loadSettings().then((loaded) => {
      if (cancelled) return;
      const recording = loaded.recording;
      const usable = recording && recordingExists(recording) ? recording : null;
      if (recording && !usable) setMissingRecordingName(recording.name);
      const next = { ...loaded, recording: usable };
      latest.current = next;
      setSettings(next);
      setIsLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    const next = { ...latest.current, ...patch };
    latest.current = next;
    setSettings(next);
    if (patch.recording) setMissingRecordingName(null);
    return saveSettings(next).catch((error: unknown) => {
      console.warn('[VoiceCycle] Could not save settings', error);
      throw new Error('Your settings could not be saved on this device.');
    });
  }, []);

  return { settings, isLoaded, missingRecordingName, update };
}
