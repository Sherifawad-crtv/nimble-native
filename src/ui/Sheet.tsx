import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '../i18n';
import { Button } from './Button';
import { IconButton } from './IconButton';
import { T } from './Text';
import { color, radius, space } from './theme';

interface SheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
}

/** A bottom sheet. Tapping outside or the system back gesture closes it. */
export function Sheet({ open, title, onClose, footer, children }: SheetProps) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel={t('common.close')} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space[4] }]}>
          <View style={styles.handle} />
          <View style={styles.head}>
            <T variant="heading" style={{ flex: 1 }} accessibilityRole="header">
              {title}
            </T>
            <IconButton icon="close" label={t('common.close')} variant="ghost" onPress={onClose} />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: space[3], paddingBottom: space[2] }} style={{ flexGrow: 0 }}>
            {children}
          </ScrollView>
          {footer ? <View style={{ paddingTop: space[3] }}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

interface ConfirmProps {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ open, title, body, confirmLabel, destructive, busy, onConfirm, onCancel }: ConfirmProps) {
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <View style={styles.center}>
        <View style={styles.dialog} accessibilityViewIsModal>
          <T variant="heading">{title}</T>
          <T tone="muted">{body}</T>
          <View style={{ gap: space[2], marginTop: space[2] }}>
            <Button size="md" variant={destructive ? 'destructive' : 'primary'} loading={busy} onPress={onConfirm}>
              {confirmLabel}
            </Button>
            <Button size="md" variant="secondary" disabled={busy} onPress={onCancel}>
              {t('common.cancel')}
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: color.scrim },
  sheet: { backgroundColor: color.surfaceCard, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingHorizontal: space[4], paddingTop: space[2], maxHeight: '90%' },
  handle: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)', marginBottom: space[2] },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: space[2] },
  center: { flex: 1, backgroundColor: color.scrim, alignItems: 'center', justifyContent: 'center', padding: space[4] },
  dialog: { width: '100%', maxWidth: 420, backgroundColor: color.surfaceCard, borderRadius: radius.card, padding: space[5], gap: space[2] },
});
