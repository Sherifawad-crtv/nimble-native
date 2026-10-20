import { StyleSheet, View } from 'react-native';
import { color } from './theme';

/** A thin bar. `percent` arrives from the service (0-100). */
export function ProgressBar({ percent, muted }: { percent: number; muted?: boolean }) {
  return (
    <View style={styles.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(percent) }}>
      <View style={[styles.fill, { width: `${Math.max(0, Math.min(100, percent))}%`, backgroundColor: muted ? 'rgba(255,255,255,0.35)' : color.brand }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
});
