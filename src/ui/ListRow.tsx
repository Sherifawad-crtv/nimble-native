import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Icon } from './Icon';
import { T } from './Text';
import { color } from './theme';

interface Props {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  chevron?: boolean;
  onPress?: () => void;
  children?: ReactNode;
}

/** A tappable row with a hairline under it. Rows sit in a <List> card. */
export function ListRow({ title, subtitle, leading, trailing, chevron, onPress, children }: Props) {
  return (
    <Pressable accessibilityRole={onPress ? 'button' : undefined} onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.row, pressed && { backgroundColor: color.surfaceControl }]}>
      {leading}
      <View style={styles.body}>
        <T variant="bodyStrong" numberOfLines={1}>
          {title}
        </T>
        {subtitle ? (
          <T variant="caption" tone="muted" numberOfLines={2}>
            {subtitle}
          </T>
        ) : null}
        {children}
      </View>
      {trailing}
      {chevron ? <Icon name="chev-r" size={20} tint={color.muted} /> : null}
    </Pressable>
  );
}

export const List = ({ children }: { children: ReactNode }) => <View style={styles.list}>{children}</View>;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
  body: { flex: 1, minWidth: 0, gap: 2 },
  list: { backgroundColor: color.surfaceCard, borderRadius: 24, overflow: 'hidden' },
});
