import { Pressable, StyleSheet } from 'react-native';
import { tap } from './haptics';
import { T } from './Text';
import { color, radius } from './theme';

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={() => {
        tap();
        onPress?.();
      }}
      style={[styles.chip, { backgroundColor: selected ? color.brand : color.surfaceControl }]}
    >
      <T variant="chip" style={{ color: selected ? color.onBrand : color.ink }}>
        {label}
      </T>
    </Pressable>
  );
}

const styles = StyleSheet.create({ chip: { minHeight: 36, paddingHorizontal: 14, borderRadius: radius.pill, justifyContent: 'center' } });
