import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { PrimaryAction } from '../domain/display';
import type { Theme } from '../theme/themes';

type Props = {
  action: PrimaryAction;
  accent: string;
  canStart: boolean;
  canStop: boolean;
  theme: Theme;
  onPrimary: () => void;
  onStop: () => void;
};

const LABELS: Record<PrimaryAction, string> = { start: 'Start', pause: 'Pause', resume: 'Resume' };

export function Controls({ action, accent, canStart, canStop, theme, onPrimary, onStop }: Props) {
  const { colors } = theme;
  const primaryDisabled = action === 'start' && !canStart;

  return (
    <View style={styles.row}>
      <Pressable
        onPress={onPrimary}
        disabled={primaryDisabled}
        accessibilityRole="button"
        accessibilityLabel={LABELS[action]}
        accessibilityState={{ disabled: primaryDisabled }}
        style={({ pressed }) => [
          styles.primary,
          { backgroundColor: accent, transform: [{ scale: pressed ? 0.97 : 1 }] },
          primaryDisabled && styles.disabled,
        ]}
      >
        <Text style={[styles.primaryText, { color: colors.onAccent }]}>{LABELS[action]}</Text>
      </Pressable>
      <Pressable
        onPress={onStop}
        disabled={!canStop}
        accessibilityRole="button"
        accessibilityLabel="Stop session"
        accessibilityState={{ disabled: !canStop }}
        style={({ pressed }) => [
          styles.stop,
          { borderColor: canStop ? colors.danger : colors.border, backgroundColor: pressed ? colors.surfaceRaised : 'transparent' },
          !canStop && styles.disabled,
        ]}
      >
        <Text style={[styles.stopText, { color: canStop ? colors.danger : colors.textMuted }]}>Stop</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, alignItems: 'stretch' },
  primary: { flex: 1, minHeight: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontSize: 22, fontWeight: '700', letterSpacing: 0.5 },
  stop: {
    width: 104,
    minHeight: 72,
    borderRadius: 36,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopText: { fontSize: 17, fontWeight: '600' },
  disabled: { opacity: 0.4 },
});
