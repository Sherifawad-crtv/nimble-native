import { Pressable, StyleSheet, View } from 'react-native';
import { tap } from './haptics';
import { T } from './Text';
import { color, radius } from './theme';

export function Segmented({ options, value, onChange }: { options: { id: string; label: string }[]; value: string; onChange: (id: string) => void }) {
  return (
    <View style={styles.track} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.id === value;
        return (
          <Pressable
            key={o.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => {
              if (!on) tap();
              onChange(o.id);
            }}
            style={[styles.seg, on && { backgroundColor: color.surfaceRaised }]}
          >
            <T variant="chip" style={{ color: on ? color.ink : color.muted }}>
              {o.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', backgroundColor: color.surfaceControl, borderRadius: radius.pill, padding: 4 },
  seg: { flex: 1, minHeight: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
