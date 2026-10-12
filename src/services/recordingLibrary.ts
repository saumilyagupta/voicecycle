import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';

import { VoiceCyclePlayer } from '../../modules/voicecycle-player';
import type { StoredRecording } from '../domain/settings';

export type PickResult = { status: 'canceled' } | { status: 'picked'; recording: StoredRecording };

const RECORDINGS_DIR = 'recordings';

const safeFileName = (name: string): string => {
  const cleaned = name.replace(/[^\w.\- ]+/g, '_').trim();
  return cleaned.length > 0 ? cleaned : 'recording';
};

function recordingsDirectory(): Directory {
  const dir = new Directory(Paths.document, RECORDINGS_DIR);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/**
 * Lets the user pick an audio file, copies it into app-private storage so it
 * stays readable across restarts, and confirms Android can decode it.
 * Throws an Error with a user-facing message when the file is unusable.
 * The caller removes the previous recording once the new one is saved.
 */
export async function pickRecording(): Promise<PickResult> {
  if (!VoiceCyclePlayer) {
    throw new Error('This build does not include the VoiceCycle player. Install the development build.');
  }
  const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true, multiple: false });
  if (result.canceled || !result.assets?.[0]) return { status: 'canceled' };

  const asset = result.assets[0];
  const cached = new File(asset.uri);
  const target = new File(recordingsDirectory(), `${Date.now()}-${safeFileName(asset.name)}`);
  try {
    await cached.copy(target);
  } finally {
    if (cached.exists) cached.delete();
  }

  let durationMs: number;
  try {
    ({ durationMs } = await VoiceCyclePlayer.probe(target.uri));
  } catch (error) {
    if (target.exists) target.delete();
    throw new Error(error instanceof Error ? error.message : 'This file cannot be played');
  }

  return { status: 'picked', recording: { uri: target.uri, name: asset.name, durationMs } };
}

export function recordingExists(recording: StoredRecording): boolean {
  try {
    return new File(recording.uri).exists;
  } catch {
    return false;
  }
}

/** Deletes the app's private copy of a replaced recording. Failures are logged, not fatal. */
export function removeRecording(recording: StoredRecording | null): void {
  if (!recording) return;
  try {
    const file = new File(recording.uri);
    if (file.exists) file.delete();
  } catch (error) {
    console.warn('[VoiceCycle] Could not delete old recording', error);
  }
}
