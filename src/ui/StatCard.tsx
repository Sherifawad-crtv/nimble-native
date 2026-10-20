import { StyleSheet, View } from 'react-native';
import { Icon } from './Icon';
import { T } from './Text';
import { color, radius, toneColor, type Tone } from './theme';

/** A headline number with a duotone icon. The value arrives formatted: nothing is computed here. */
export function StatCard({ tone = 'brand', icon, value, label }: { tone?: Tone; icon: string; value: string; label: string }) {
  return (
    <View style={styles.card} accessible accessibilityLabel={`${value} ${label}`}>
      <Icon name={icon} size={36} tint={toneColor[tone]} />
      <View>
        <T variant="stat">{value}</T>
        <T variant="label" tone="muted">
          {label}
        </T>
      </View>
    </View>
  );
}

export const StatGrid = ({ children }: { children: React.ReactNode }) => <View style={styles.grid}>{children}</View>;

const styles = StyleSheet.create({
  card: { flexBasis: '48%', flexGrow: 1, minHeight: 124, borderRadius: radius.card, backgroundColor: color.surfaceCard, padding: 16, justifyContent: 'space-between' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
