import { StyleSheet, View } from 'react-native';

type Props = { progress: number; color: string; trackColor: string; label: string };

export function ProgressBar({ progress, color, trackColor, label }: Props) {
  const clamped = Math.min(1, Math.max(0, progress));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={[styles.track, { backgroundColor: trackColor }]}
    >
      <View style={[styles.fill, { backgroundColor: color, width: `${clamped * 100}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
});
