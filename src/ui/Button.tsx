import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { tap } from './haptics';
import { Icon } from './Icon';
import { T } from './Text';
import { color, radius } from './theme';

type Variant = 'primary' | 'secondary' | 'tertiary' | 'destructive';
type Size = 'lg' | 'md' | 'sm';

interface Props {
  children: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: string;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

const heights: Record<Size, number> = { lg: 52, md: 52, sm: 40 };

/** Pill buttons, 52px tall, uppercase labels. */
export function Button({ children, onPress, variant = 'primary', size = 'lg', icon, loading, disabled, fullWidth = size === 'lg', style }: Props) {
  const off = disabled || loading;
  const fill = variant === 'primary' ? color.brand : variant === 'destructive' ? 'rgba(255,90,95,0.16)' : variant === 'secondary' ? color.surfaceControl : 'transparent';
  const ink = variant === 'primary' ? color.onBrand : variant === 'destructive' ? color.danger : variant === 'tertiary' ? color.brand : color.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off}
      onPress={() => {
        tap();
        onPress?.();
      }}
      style={({ pressed }) => [styles.base, { height: heights[size], backgroundColor: fill, opacity: off ? 0.45 : pressed ? 0.85 : 1, alignSelf: fullWidth ? 'stretch' : 'flex-start', paddingHorizontal: size === 'sm' ? 16 : 24 }, style]}
    >
      <View style={styles.row}>
        {loading ? <ActivityIndicator color={ink} /> : icon ? <Icon name={icon} size={size === 'sm' ? 18 : 22} tint={ink} /> : null}
        <T variant="button" style={{ color: ink, textTransform: 'uppercase', fontSize: size === 'sm' ? 14 : 16 }}>
          {children}
        </T>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.pill, justifyContent: 'center', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
