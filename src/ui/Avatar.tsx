import { StyleSheet, View } from 'react-native';
import { T } from './Text';
import { color } from './theme';

export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const parts = (name || '?').split(' ');
  const initials = ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase();
  return (
    <View accessibilityLabel={name} style={[styles.av, { width: size, height: size, borderRadius: size / 2 }]}>
      <T variant="chip" style={{ fontSize: size > 40 ? 14 : 12 }}>
        {initials}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({ av: { backgroundColor: color.surfaceRaised, alignItems: 'center', justifyContent: 'center' } });
