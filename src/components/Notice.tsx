import { StyleSheet, Text, View } from 'react-native';

import type { Theme } from '../theme/themes';

type Props = { tone: 'info' | 'warning' | 'error'; message: string; theme: Theme };

export function Notice({ tone, message, theme }: Props) {
  const { colors } = theme;
  const accent = tone === 'error' ? colors.danger : tone === 'warning' ? colors.paused : colors.textMuted;
  return (
    <View
      accessibilityRole={tone === 'info' ? 'text' : 'alert'}
      style={[styles.box, { borderColor: accent, backgroundColor: colors.surface }]}
    >
      <Text style={[styles.text, { color: tone === 'info' ? colors.textMuted : colors.text }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderLeftWidth: 3, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14 },
  text: { fontSize: 14, lineHeight: 20 },
});
