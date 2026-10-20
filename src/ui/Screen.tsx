import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { t } from '../i18n';
import { IconButton } from './IconButton';
import { T } from './Text';
import { color, space } from './theme';

interface Props {
  title?: string;
  /** Second headline line in the accent colour. */
  accent?: string;
  subtitle?: string;
  /** Show a back control. */
  back?: boolean;
  onBack?: () => void;
  trailing?: ReactNode;
  children: ReactNode;
  /** Extra space under the content, for a tab bar. */
  tabs?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  footer?: ReactNode;
}

/** The screen frame: large title, round controls, scrolls under the status bar, avoids the keyboard. */
export function Screen({ title, accent, subtitle, back, onBack, trailing, children, tabs, refreshing, onRefresh, footer }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + space[4], paddingHorizontal: space[4], paddingBottom: (tabs ? 0 : insets.bottom) + space[8] + (footer ? 0 : 0), gap: space[4] }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentInsetAdjustmentBehavior="never"
        refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={color.brand} colors={[color.brand]} /> : undefined}
      >
        {back || trailing ? (
          <View style={styles.bar}>
            {back ? <IconButton icon="chev-l" label={t('common.back')} onPress={onBack ?? (() => router.back())} /> : <View />}
            {trailing}
          </View>
        ) : null}
        {title ? (
          <View style={styles.head}>
            <View style={{ flex: 1, gap: 4 }}>
              <T variant={back ? 'title' : 'headline'} accessibilityRole="header">
                {title}
              </T>
              {accent ? (
                <T variant={back ? 'title' : 'headline'} tone="brand">
                  {accent}
                </T>
              ) : null}
              {subtitle ? (
                <T variant="label" tone="muted">
                  {subtitle}
                </T>
              ) : null}
            </View>
          </View>
        ) : null}
        {children}
      </ScrollView>
      {footer ? <View style={[styles.footer, { paddingBottom: insets.bottom + space[3] }]}>{footer}</View> : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  bar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  head: { flexDirection: 'row', alignItems: 'flex-start' },
  footer: { paddingHorizontal: space[4], paddingTop: space[3], backgroundColor: color.bg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line },
});
