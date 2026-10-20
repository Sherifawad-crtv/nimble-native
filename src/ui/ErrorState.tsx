import { StyleSheet, View } from 'react-native';
import { t } from '../i18n';
import { Button } from './Button';
import { Icon } from './Icon';
import { T } from './Text';
import { color } from './theme';

export function ErrorState({ title, body, onRetry }: { title: string; body?: string; onRetry?: () => void }) {
  return (
    <View style={styles.wrap} accessibilityRole="alert">
      <Icon name="alert" size={32} tint={color.danger} />
      <T variant="heading" style={{ textAlign: 'center' }}>
        {title}
      </T>
      {body ? (
        <T tone="muted" style={{ textAlign: 'center' }}>
          {body}
        </T>
      ) : null}
      {onRetry ? (
        <Button size="md" variant="secondary" fullWidth={false} onPress={onRetry}>
          {t('common.retry')}
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { alignItems: 'center', gap: 12, paddingVertical: 32, paddingHorizontal: 24 } });
