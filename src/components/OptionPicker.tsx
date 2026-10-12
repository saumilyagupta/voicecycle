import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { parseMinutesInput } from '../domain/settings';
import { formatMinutes } from '../domain/time';
import type { Theme } from '../theme/themes';

type Props = {
  title: string;
  hint: string;
  valueMinutes: number;
  presets: readonly number[];
  presetLabel: (minutes: number) => string;
  limits: { min: number; max: number };
  customUnitLabel: string;
  disabled: boolean;
  theme: Theme;
  onChange: (minutes: number) => void;
};

/** Preset chips plus a custom minutes field. */
export function OptionPicker(props: Props) {
  const { title, hint, valueMinutes, presets, presetLabel, limits, customUnitLabel, disabled, theme, onChange } = props;
  const { colors } = theme;
  const isCustomValue = !presets.includes(valueMinutes);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const commit = () => {
    const parsed = parseMinutesInput(draft, limits);
    if (parsed === null) {
      setError(`Enter a number from ${limits.min} to ${limits.max}`);
      return;
    }
    setError(null);
    setIsEditing(false);
    onChange(parsed);
  };

  return (
    <View style={[styles.container, disabled && styles.disabled]}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.value, { color: colors.textMuted }]}>{formatMinutes(valueMinutes)}</Text>
      </View>
      <Text style={[styles.hint, { color: colors.textFaint }]}>{hint}</Text>

      <View style={styles.chips}>
        {presets.map((minutes) => (
          <Chip
            key={minutes}
            label={presetLabel(minutes)}
            selected={!isEditing && valueMinutes === minutes}
            disabled={disabled}
            theme={theme}
            onPress={() => {
              setIsEditing(false);
              setError(null);
              onChange(minutes);
            }}
          />
        ))}
        <Chip
          label={isCustomValue && !isEditing ? `Custom · ${formatMinutes(valueMinutes)}` : 'Custom'}
          selected={isEditing || isCustomValue}
          disabled={disabled}
          theme={theme}
          onPress={() => {
            setDraft(isCustomValue ? String(valueMinutes) : '');
            setIsEditing(true);
          }}
        />
      </View>

      {isEditing ? (
        <View style={styles.customRow}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={commit}
            keyboardType="decimal-pad"
            autoFocus
            placeholder={customUnitLabel}
            placeholderTextColor={colors.textFaint}
            accessibilityLabel={`${title} in ${customUnitLabel}`}
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceRaised }]}
          />
          <Pressable
            onPress={commit}
            accessibilityRole="button"
            accessibilityLabel={`Set ${title}`}
            style={({ pressed }) => [styles.setButton, { backgroundColor: colors.text, opacity: pressed ? 0.8 : 1 }]}
          >
            <Text style={[styles.setText, { color: colors.background }]}>Set</Text>
          </Pressable>
        </View>
      ) : null}
      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  );
}

type ChipProps = { label: string; selected: boolean; disabled: boolean; theme: Theme; onPress: () => void };

function Chip({ label, selected, disabled, theme, onPress }: ChipProps) {
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
      <Text style={[styles.chipText, { color: selected ? colors.text : colors.textMuted }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: 4 },
  disabled: { opacity: 0.45 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  title: { fontSize: 17, fontWeight: '600' },
  value: { fontSize: 15, fontVariant: ['tabular-nums'] },
  hint: { fontSize: 13, marginTop: 2, lineHeight: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: {
    minHeight: 44,
    minWidth: 52,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontSize: 15, fontWeight: '500', fontVariant: ['tabular-nums'] },
  customRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  input: { flex: 1, minHeight: 48, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, fontSize: 17 },
  setButton: { minHeight: 48, paddingHorizontal: 22, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  setText: { fontSize: 16, fontWeight: '700' },
  error: { fontSize: 13, marginTop: 6 },
});
