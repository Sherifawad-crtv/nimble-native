import { Pressable, StyleSheet } from 'react-native';
import { tap } from './haptics';
import { Icon } from './Icon';
import { color } from './theme';

interface Props {
  icon: string;
  label: string;
  onPress?: () => void;
  variant?: 'control' | 'ghost';
  size?: number;
  disabled?: boolean;
}

/** A round icon-only button with an accessibility label and a 44pt hit area. */
export function IconButton({ icon, label, onPress, variant = 'control', size = 22, disabled }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      hitSlop={6}
      onPress={() => {
        tap();
        onPress?.();
      }}
      style={({ pressed }) => [styles.base, variant === 'control' && { backgroundColor: color.surfaceControl }, { opacity: disabled ? 0.4 : pressed ? 0.7 : 1 }]}
    >
      <Icon name={icon} size={size} />
    </Pressable>
  );
}

const styles = StyleSheet.create({ base: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' } });
