import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Controls } from '../components/Controls';
import { Notice } from '../components/Notice';
import { RecordingCard } from '../components/RecordingCard';
import { SessionSettings } from '../components/SessionSettings';
import { StatusHero, stateColor } from '../components/StatusHero';
import { ThemePicker } from '../components/ThemePicker';
import { isActiveState, primaryActionFor } from '../domain/display';
import { describeReport } from '../domain/report';
import { toCycleOptions } from '../domain/settings';
import { usePlayer } from '../hooks/usePlayer';
import { useSettings } from '../hooks/useSettings';
import { pickRecording, removeRecording } from '../services/recordingLibrary';
import { THEMES } from '../theme/themes';

export function HomeScreen() {
  const { settings, isLoaded, missingRecordingName, update } = useSettings();
  const player = usePlayer();
  const [isPicking, setIsPicking] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const theme = THEMES[settings.themeId];
  const { colors } = theme;
  const { snapshot } = player;
  const isActive = isActiveState(snapshot.state);
  const action = primaryActionFor(snapshot.state);
  const accent = action === 'start' ? colors.playing : stateColor(snapshot, theme);
  const report = isActive ? null : describeReport(player.lastReport);

  const applySetting = (patch: Parameters<typeof update>[0]) => {
    update(patch).catch((error: unknown) =>
      setActionError(error instanceof Error ? error.message : 'Settings could not be saved.'),
    );
  };

  const handleSelect = async () => {
    setActionError(null);
    setIsPicking(true);
    const previous = settings.recording;
    try {
      const result = await pickRecording();
      if (result.status === 'canceled') return;
      try {
        await update({ recording: result.recording });
      } catch (saveError) {
        // Keep the old file: the saved settings still point to it.
        removeRecording(result.recording);
        await update({ recording: previous }).catch(() => undefined);
        throw saveError;
      }
      removeRecording(previous);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not load that file.');
    } finally {
      setIsPicking(false);
    }
  };

  const handlePrimary = async () => {
    setActionError(null);
    if (action === 'pause') return player.pause();
    if (action === 'resume') return player.resume();
    if (!settings.recording || isStarting) return;
    setIsStarting(true);
    try {
      await player.start({
        uri: settings.recording.uri,
        title: settings.recording.name,
        ...toCycleOptions(settings),
      });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not start the session.');
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView style={styles.safe} behavior="padding">
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[styles.brand, { color: colors.textMuted }]} accessibilityRole="header">
            Voice<Text style={{ color: colors.text }}>Cycle</Text>
          </Text>

          {!player.isAvailable ? (
            <Notice
              tone="error"
              theme={theme}
              message="The native player is missing. VoiceCycle needs its own development build or APK and does not run in Expo Go."
            />
          ) : null}

          <StatusHero snapshot={snapshot} theme={theme} />

          <View style={styles.notices}>
            {missingRecordingName && !settings.recording ? (
              <Notice
                tone="warning"
                theme={theme}
                message={`"${missingRecordingName}" can no longer be opened. Please select the recording again.`}
              />
            ) : null}
            {actionError ? <Notice tone="error" theme={theme} message={actionError} /> : null}
            {player.notificationsDenied && isActive ? (
              <Notice
                tone="info"
                theme={theme}
                message="Notifications are off, so lock-screen controls may be hidden. Playback still continues."
              />
            ) : null}
            {report ? <Notice tone={report.tone} theme={theme} message={report.text} /> : null}
          </View>

          <Controls
            action={action}
            accent={accent}
            canStart={isLoaded && !isStarting && settings.recording !== null && player.isAvailable}
            canStop={isActive}
            theme={theme}
            onPrimary={handlePrimary}
            onStop={player.stop}
          />

          <RecordingCard
            recording={settings.recording}
            snapshot={snapshot}
            theme={theme}
            isBusy={isPicking}
            isLocked={isActive || isStarting}
            onSelect={handleSelect}
          />

          <SessionSettings settings={settings} isLocked={isActive} theme={theme} onChange={applySetting} />

          <View style={styles.footer}>
            <Text style={[styles.footerLabel, { color: colors.textFaint }]}>THEME</Text>
            <ThemePicker theme={theme} onChange={(themeId) => applySetting({ themeId })} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40, gap: 20 },
  brand: { fontSize: 20, fontWeight: '300', letterSpacing: 0.5 },
  notices: { gap: 8 },
  footer: { gap: 10 },
  footerLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.6 },
});
