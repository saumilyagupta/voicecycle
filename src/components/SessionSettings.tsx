import { StyleSheet, Text, View } from 'react-native';

import {
  estimatePlays,
  INTERVAL_LIMITS,
  INTERVAL_PRESETS_MIN,
  parseCountInput,
  parseMinutesInput,
  PLAYS_LIMITS,
  PLAYS_PRESETS,
  SESSION_LIMITS,
  SESSION_PRESETS_MIN,
  type Settings,
} from '../domain/settings';
import { formatMinutes } from '../domain/time';
import type { Theme } from '../theme/themes';
import { OptionPicker } from './OptionPicker';

type Props = {
  settings: Settings;
  isLocked: boolean;
  theme: Theme;
  onChange: (patch: Partial<Settings>) => void;
};

const formatPlays = (count: number): string => `${count}×`;
const rangeMessage = (limits: { min: number; max: number }) => `Enter a number from ${limits.min} to ${limits.max}`;

export function SessionSettings({ settings, isLocked, theme, onChange }: Props) {
  const { colors } = theme;
  const sessionHint = settings.recording
    ? `About ${estimatePlays(settings.recording.durationMs, settings)} plays fit in this session.`
    : 'Playback stops automatically when the time is up.';

  return (
    <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <OptionPicker
        title="Wait between plays"
        hint="Silence after the recording ends, before it starts again. 0 repeats immediately. Random picks a new wait each time."
        value={settings.intervalMinutes}
        presets={INTERVAL_PRESETS_MIN}
        presetLabel={(m) => `${m}m`}
        formatValue={formatMinutes}
        parseInput={(text) => parseMinutesInput(text, INTERVAL_LIMITS)}
        invalidMessage={rangeMessage(INTERVAL_LIMITS)}
        unitLabel="minutes"
        keyboardType="decimal-pad"
        random={{
          isActive: settings.waitMode === 'random',
          range: settings.waitRange,
          onSetRange: (waitRange) => onChange({ waitMode: 'random', waitRange }),
        }}
        disabled={isLocked}
        theme={theme}
        onChange={(intervalMinutes) => onChange({ waitMode: 'fixed', intervalMinutes })}
      />
      <View style={[styles.separator, { backgroundColor: colors.border }]} />
      <OptionPicker
        title="Plays in a row"
        hint="How many times the recording plays back to back before each wait. Random picks a new count each round."
        value={settings.playsPerRound}
        presets={PLAYS_PRESETS}
        presetLabel={formatPlays}
        formatValue={formatPlays}
        parseInput={(text) => parseCountInput(text, PLAYS_LIMITS)}
        invalidMessage={rangeMessage(PLAYS_LIMITS)}
        unitLabel="plays"
        keyboardType="number-pad"
        random={{
          isActive: settings.playsMode === 'random',
          range: settings.playsRange,
          onSetRange: (playsRange) => onChange({ playsMode: 'random', playsRange }),
        }}
        disabled={isLocked}
        theme={theme}
        onChange={(playsPerRound) => onChange({ playsMode: 'fixed', playsPerRound })}
      />
      <View style={[styles.separator, { backgroundColor: colors.border }]} />
      <OptionPicker
        title="Session length"
        hint={sessionHint}
        value={settings.sessionMinutes}
        presets={SESSION_PRESETS_MIN}
        presetLabel={(m) => `${m / 60}h`}
        formatValue={formatMinutes}
        parseInput={(text) => parseMinutesInput(text, SESSION_LIMITS)}
        invalidMessage={rangeMessage(SESSION_LIMITS)}
        unitLabel="minutes"
        keyboardType="decimal-pad"
        disabled={isLocked}
        theme={theme}
        onChange={(sessionMinutes) => onChange({ sessionMinutes })}
      />
      {isLocked ? (
        <Text style={[styles.lockedHint, { color: colors.textFaint }]}>
          Settings apply to the next session. Stop to change them.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 18, gap: 18 },
  separator: { height: StyleSheet.hairlineWidth },
  lockedHint: { fontSize: 13 },
});
