import { Pressable, StyleSheet, Text } from 'react-native';

import type { Theme } from '../theme/themes';

type ChipProps = { label: string; selected: boolean; disabled: boolean; theme: Theme; onPress: () => void };

export function Chip({ label, selected, disabled, theme, onPress }: ChipProps) {
  const { colors } = theme;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      style={({ pressed }) => [
        styles.chip,
        {
          borderColor: selected ? colors.text : colors.border,
          backgroundColor: selected ? colors.surfaceRaised : pressed ? colors.surface : 'transparent',
        },
      ]}
    >
      <Text style={[styles.text, { color: selected ? colors.text : colors.textMuted }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 44,
    minWidth: 52,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { fontSize: 15, fontWeight: '500', fontVariant: ['tabular-nums'] },
});
