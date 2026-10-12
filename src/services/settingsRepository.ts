import AsyncStorage from '@react-native-async-storage/async-storage';

import { parseSettings, type Settings } from '../domain/settings';

const STORAGE_KEY = 'voicecycle.settings.v1';

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return parseSettings(raw ? JSON.parse(raw) : null);
  } catch (error) {
    console.warn('[VoiceCycle] Could not read saved settings, using defaults', error);
    return parseSettings(null);
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
