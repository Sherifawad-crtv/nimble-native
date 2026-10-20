import { StyleSheet, View } from 'react-native';
import { Button } from './Button';
import { Icon } from './Icon';
import { T } from './Text';
import { color } from './theme';

export function EmptyState({ icon = 'info', title, body, action, onAction }: { icon?: string; title: string; body?: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.ic}>
        <Icon name={icon} size={32} tint={color.muted} />
      </View>
      <T variant="heading" style={{ textAlign: 'center' }}>
        {title}
      </T>
      {body ? (
        <T tone="muted" style={{ textAlign: 'center' }}>
          {body}
        </T>
      ) : null}
      {action ? (
        <Button size="md" onPress={onAction} fullWidth={false}>
          {action}
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 12, paddingVertical: 32, paddingHorizontal: 24 },
  ic: { width: 64, height: 64, borderRadius: 32, backgroundColor: color.surfaceControl, alignItems: 'center', justifyContent: 'center' },
});
