import { StyleSheet, Text, View } from 'react-native';

import type { PlayerSnapshot } from '../../modules/voicecycle-player';
import { describeStatus, heroCountdownMs, isActiveState } from '../domain/display';
import { formatClock } from '../domain/time';
import type { Theme } from '../theme/themes';

type Props = { snapshot: PlayerSnapshot; theme: Theme };

export function stateColor(snapshot: PlayerSnapshot, theme: Theme): string {
  const { colors } = theme;
  switch (snapshot.state) {
    case 'PLAYING':
      return colors.playing;
    case 'WAITING':
      return colors.waiting;
    case 'PAUSED':
      return colors.paused;
    case 'STOPPED':
      return snapshot.endReason === 'ERROR' ? colors.danger : colors.textMuted;
    default:
      return colors.textMuted;
  }
}

export function StatusHero({ snapshot, theme }: Props) {
  const { colors } = theme;
  const status = describeStatus(snapshot);
  const countdown = heroCountdownMs(snapshot);
  const accent = stateColor(snapshot, theme);
  const active = isActiveState(snapshot.state);

  return (
    <View
      style={styles.container}
      accessibilityLiveRegion="polite"
      accessibilityLabel={`${status.title}. ${status.detail}`}
    >
      <View style={styles.stateRow}>
        <View style={[styles.dot, { backgroundColor: accent }]} />
        <Text style={[styles.stateTitle, { color: accent }]}>{status.title.toUpperCase()}</Text>
      </View>

      <Text style={[styles.countdown, { color: active ? colors.text : colors.textFaint }]}>
        {countdown ? formatClock(countdown.ms, true) : '--:--'}
      </Text>
      <Text style={[styles.countdownLabel, { color: colors.textMuted }]}>
        {countdown ? countdown.label : status.detail}
      </Text>
      {countdown ? <Text style={[styles.detail, { color: colors.textFaint }]}>{status.detail}</Text> : null}

      <View style={[styles.stats, { borderColor: colors.border }]}>
        <Stat label="Session left" value={active ? formatClock(snapshot.sessionRemainingMs, true) : '—'} theme={theme} />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Stat label="Plays completed" value={String(snapshot.completedRepetitions)} theme={theme} />
      </View>
    </View>
  );
}

function Stat({ label, value, theme }: { label: string; value: string; theme: Theme }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: theme.colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.colors.textFaint }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 8, paddingBottom: 4 },
  stateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  stateTitle: { fontSize: 13, fontWeight: '700', letterSpacing: 2 },
  countdown: {
    fontSize: 72,
    fontWeight: '200',
    letterSpacing: -2,
    marginTop: 6,
    fontVariant: ['tabular-nums'],
  },
  countdownLabel: { fontSize: 16, marginTop: -4 },
  detail: { fontSize: 14, marginTop: 6, lineHeight: 20 },
  stats: {
    flexDirection: 'row',
    marginTop: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
  },
  stat: { flex: 1 },
  divider: { width: StyleSheet.hairlineWidth, marginHorizontal: 16 },
  statValue: { fontSize: 22, fontWeight: '500', fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 12, marginTop: 2, letterSpacing: 0.4 },
});
