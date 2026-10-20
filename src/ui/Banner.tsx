import { StyleSheet, View } from 'react-native';
import { Icon } from './Icon';
import { T } from './Text';
import { color, radius } from './theme';

export function Banner({ title, message, tone = 'warning' }: { title: string; message?: string; tone?: 'warning' | 'danger' }) {
  return (
    <View style={styles.wrap} accessibilityRole="alert">
      <Icon name="alert" size={22} tint={tone === 'danger' ? color.danger : color.warning} />
      <View style={{ flex: 1 }}>
        <T variant="bodyStrong">{title}</T>
        {message ? (
          <T variant="label" tone="muted">
            {message}
          </T>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', padding: 16, borderRadius: radius.card, backgroundColor: color.surfaceCard } });
