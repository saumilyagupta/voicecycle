import { Pressable, StyleSheet, Text, View } from 'react-native';

import { THEME_IDS, type ThemeId } from '../domain/settings';
import { THEMES, type Theme } from '../theme/themes';

type Props = { theme: Theme; onChange: (id: ThemeId) => void };

export function ThemePicker({ theme, onChange }: Props) {
  const { colors } = theme;
  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel="Theme">
      {THEME_IDS.map((id) => {
        const option = THEMES[id];
        const selected = id === theme.id;
        return (
          <Pressable
            key={id}
            onPress={() => onChange(id)}
            accessibilityRole="radio"
            accessibilityLabel={`${option.label} theme`}
            accessibilityState={{ selected }}
            style={({ pressed }) => [
              styles.option,
              { borderColor: selected ? colors.text : colors.border, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <View style={[styles.swatch, { backgroundColor: option.colors.background, borderColor: option.colors.border }]}>
              <View style={[styles.swatchDot, { backgroundColor: option.colors.playing }]} />
            </View>
            <Text style={[styles.label, { color: selected ? colors.text : colors.textMuted }]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  option: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  swatch: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  swatchDot: { width: 8, height: 8, borderRadius: 4 },
  label: { fontSize: 14, fontWeight: '500' },
});
