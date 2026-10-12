import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import type { PlayerSnapshot } from '../../modules/voicecycle-player';
import { recordingProgress } from '../domain/display';
import type { StoredRecording } from '../domain/settings';
import { formatClock } from '../domain/time';
import type { Theme } from '../theme/themes';
import { ProgressBar } from './ProgressBar';
import { stateColor } from './StatusHero';

type Props = {
  recording: StoredRecording | null;
  snapshot: PlayerSnapshot;
  theme: Theme;
  isBusy: boolean;
  isLocked: boolean;
  onSelect: () => void;
};

export function RecordingCard({ recording, snapshot, theme, isBusy, isLocked, onSelect }: Props) {
  const { colors } = theme;
  const showLive = snapshot.state === 'PLAYING' || snapshot.state === 'PAUSED' || snapshot.state === 'WAITING';
  const durationMs = showLive && snapshot.durationMs > 0 ? snapshot.durationMs : recording?.durationMs ?? 0;
  const positionMs = showLive ? (snapshot.state === 'WAITING' ? durationMs : snapshot.positionMs) : 0;
  const progress = showLive ? recordingProgress(snapshot) : 0;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <Text style={[styles.eyebrow, { color: colors.textFaint }]}>RECORDING</Text>
          <Text style={[styles.name, { color: recording ? colors.text : colors.textMuted }]} numberOfLines={2}>
            {recording ? recording.name : 'No recording selected'}
          </Text>
        </View>
        <Pressable
          onPress={onSelect}
          disabled={isBusy || isLocked}
          accessibilityRole="button"
          accessibilityLabel={recording ? 'Change recording' : 'Select audio'}
          accessibilityHint={isLocked ? 'Stop the session to change the recording' : undefined}
          style={({ pressed }) => [
            styles.selectButton,
            { borderColor: colors.border, backgroundColor: pressed ? colors.surfaceRaised : 'transparent' },
            (isBusy || isLocked) && styles.disabled,
          ]}
        >
          {isBusy ? (
            <ActivityIndicator color={colors.text} size="small" />
          ) : (
            <Text style={[styles.selectText, { color: colors.text }]}>{recording ? 'Change' : 'Select audio'}</Text>
          )}
        </Pressable>
      </View>

      <View style={styles.progressBlock}>
        <ProgressBar
          progress={progress}
          color={stateColor(snapshot, theme)}
          trackColor={colors.track}
          label="Recording progress"
        />
        <View style={styles.timeRow}>
          <Text style={[styles.time, { color: colors.textMuted }]}>{formatClock(positionMs)}</Text>
          <Text style={[styles.time, { color: colors.textMuted }]}>
            {showLive ? `-${formatClock(Math.max(0, durationMs - positionMs), true)}` : formatClock(durationMs)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 18 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  titleBlock: { flex: 1 },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.6 },
  name: { fontSize: 18, fontWeight: '500', marginTop: 4, lineHeight: 24 },
  selectButton: {
    minHeight: 44,
    minWidth: 96,
    paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectText: { fontSize: 15, fontWeight: '600' },
  disabled: { opacity: 0.4 },
  progressBlock: { marginTop: 18 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  time: { fontSize: 13, fontVariant: ['tabular-nums'] },
});
