import { useState } from 'react';
import { Pressable, Text, TextInput, View, type KeyboardTypeOptions } from 'react-native';

import type { Range } from '../domain/settings';
import type { Theme } from '../theme/themes';
import { inputStyles as styles } from './inputStyles';

type Props = {
  title: string;
  initial: Range;
  unitLabel: string;
  keyboardType: KeyboardTypeOptions;
  parseInput: (text: string) => number | null;
  invalidMessage: string;
  theme: Theme;
  onSet: (range: Range) => void;
};

/** Minimum and maximum fields for a random value. */
export function RangeEditor({ title, initial, unitLabel, keyboardType, parseInput, invalidMessage, theme, onSet }: Props) {
  const { colors } = theme;
  const [minText, setMinText] = useState(String(initial.min));
  const [maxText, setMaxText] = useState(String(initial.max));
  const [error, setError] = useState<string | null>(null);

  const commit = () => {
    const min = parseInput(minText);
    const max = parseInput(maxText);
    if (min === null || max === null) return setError(invalidMessage);
    if (min > max) return setError('The minimum must not be larger than the maximum');
    setError(null);
    onSet({ min, max });
  };

  const field = (label: string, value: string, onChange: (text: string) => void, autoFocus: boolean) => (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.textFaint }]}>{label.toUpperCase()}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        onSubmitEditing={commit}
        keyboardType={keyboardType}
        autoFocus={autoFocus}
        selectTextOnFocus
        placeholder={unitLabel}
        placeholderTextColor={colors.textFaint}
        accessibilityLabel={`${title} ${label} in ${unitLabel}`}
        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceRaised }]}
      />
    </View>
  );

  return (
    <View>
      <View style={styles.row}>
        {field('Min', minText, setMinText, true)}
        {field('Max', maxText, setMaxText, false)}
        <Pressable
          onPress={commit}
          accessibilityRole="button"
          accessibilityLabel={`Set random ${title}`}
          style={({ pressed }) => [styles.setButton, { backgroundColor: colors.text, opacity: pressed ? 0.8 : 1 }]}
        >
          <Text style={[styles.setText, { color: colors.background }]}>Set</Text>
        </Pressable>
      </View>
      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  );
}
