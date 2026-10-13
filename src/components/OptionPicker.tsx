import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type KeyboardTypeOptions } from 'react-native';

import type { Range } from '../domain/settings';
import type { Theme } from '../theme/themes';
import { Chip } from './Chip';
import { inputStyles } from './inputStyles';
import { RangeEditor } from './RangeEditor';

export type RandomOption = {
  isActive: boolean;
  range: Range;
  onSetRange: (range: Range) => void;
};

type Props = {
  title: string;
  hint: string;
  value: number;
  presets: readonly number[];
  presetLabel: (value: number) => string;
  formatValue: (value: number) => string;
  parseInput: (text: string) => number | null;
  /** Shown when typed text is rejected, e.g. "Enter a number from 0 to 240". */
  invalidMessage: string;
  unitLabel: string;
  keyboardType: KeyboardTypeOptions;
  /** Adds a "Random" choice with min and max fields. */
  random?: RandomOption;
  disabled: boolean;
  theme: Theme;
  /** Picking a preset or custom value also switches off random mode. */
  onChange: (value: number) => void;
};

type Editing = 'none' | 'custom' | 'random';

/** Preset chips, a custom value field and an optional random range. */
export function OptionPicker(props: Props) {
  const { title, hint, value, presets, presetLabel, formatValue, parseInput, invalidMessage } = props;
  const { unitLabel, keyboardType, random, disabled, theme, onChange } = props;
  const { colors } = theme;
  const [editing, setEditing] = useState<Editing>('none');
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isRandom = random?.isActive ?? false;
  const isCustomValue = !isRandom && !presets.includes(value);
  const summary = isRandom && random ? `Random ${formatValue(random.range.min)}–${formatValue(random.range.max)}` : formatValue(value);

  const choose = (next: number) => {
    setEditing('none');
    setError(null);
    onChange(next);
  };

  const commitCustom = () => {
    const parsed = parseInput(draft);
    if (parsed === null) return setError(invalidMessage);
    choose(parsed);
  };

  return (
    <View style={[styles.container, disabled && styles.disabled]}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.value, { color: colors.textMuted }]}>{summary}</Text>
      </View>
      <Text style={[styles.hint, { color: colors.textFaint }]}>{hint}</Text>

      <View style={styles.chips}>
        {presets.map((preset) => (
          <Chip
            key={preset}
            label={presetLabel(preset)}
            selected={editing === 'none' && !isRandom && value === preset}
            disabled={disabled}
            theme={theme}
            onPress={() => choose(preset)}
          />
        ))}
        <Chip
          label={isCustomValue && editing === 'none' ? `Custom · ${formatValue(value)}` : 'Custom'}
          selected={editing === 'custom' || (editing === 'none' && isCustomValue)}
          disabled={disabled}
          theme={theme}
          onPress={() => {
            setDraft(isCustomValue ? String(value) : '');
            setError(null);
            setEditing('custom');
          }}
        />
        {random ? (
          <Chip
            label="Random"
            selected={editing === 'random' || (editing === 'none' && isRandom)}
            disabled={disabled}
            theme={theme}
            onPress={() => {
              setError(null);
              setEditing('random');
            }}
          />
        ) : null}
      </View>

      {editing === 'custom' ? (
        <View style={inputStyles.row}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={commitCustom}
            keyboardType={keyboardType}
            autoFocus
            placeholder={unitLabel}
            placeholderTextColor={colors.textFaint}
            accessibilityLabel={`${title} in ${unitLabel}`}
            style={[
              inputStyles.input,
              styles.grow,
              { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceRaised },
            ]}
          />
          <Pressable
            onPress={commitCustom}
            accessibilityRole="button"
            accessibilityLabel={`Set ${title}`}
            style={({ pressed }) => [inputStyles.setButton, { backgroundColor: colors.text, opacity: pressed ? 0.8 : 1 }]}
          >
            <Text style={[inputStyles.setText, { color: colors.background }]}>Set</Text>
          </Pressable>
        </View>
      ) : null}

      {editing === 'random' && random ? (
        <RangeEditor
          title={title}
          initial={random.range}
          unitLabel={unitLabel}
          keyboardType={keyboardType}
          parseInput={parseInput}
          invalidMessage={invalidMessage}
          theme={theme}
          onSet={(range) => {
            setEditing('none');
            random.onSetRange(range);
          }}
        />
      ) : null}

      {error ? <Text style={[inputStyles.error, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: 4 },
  disabled: { opacity: 0.45 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 },
  title: { fontSize: 17, fontWeight: '600', flexShrink: 1 },
  value: { fontSize: 15, fontVariant: ['tabular-nums'], textAlign: 'right' },
  hint: { fontSize: 13, marginTop: 2, lineHeight: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  grow: { flex: 1 },
});
