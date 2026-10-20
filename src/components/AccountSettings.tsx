import { useState } from 'react';
import { View } from 'react-native';
import { useMe, useSessionActions } from '../core/auth';
import { errorMessage } from '../hooks/data';
import { t } from '../i18n';
import { openLink, PRIVACY_URL, SUPPORT_EMAIL, TERMS_URL } from '../lib/links';
import { Linking } from 'react-native';
import { Avatar, Button, Card, ConfirmDialog, List, ListRow, T, useToast } from '../ui';
import { NotificationsSetting } from './NotificationsSetting';

/** Profile, notifications, legal links, sign out and account deletion: shared by coach and client. */
export function AccountSettings({ extra }: { extra?: React.ReactNode }) {
  const me = useMe();
  const toast = useToast();
  const { signOut, deleteAccount } = useSessionActions();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    setBusy(true);
    try {
      await deleteAccount();
      toast.show(t('account.deleted'));
    } catch (e) {
      toast.show(errorMessage(e) || t('account.delete.error'), 'error');
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <View style={{ gap: 16 }}>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <Avatar name={me.name} size={56} />
        <View style={{ flex: 1 }}>
          <T variant="heading">{me.name}</T>
          <T variant="label" tone="muted">
            {me.email}
          </T>
          {me.role === 'coach' ? (
            <T variant="caption" tone="muted">
              {t('role.coach')}
            </T>
          ) : null}
        </View>
      </Card>

      <NotificationsSetting />
      {extra}

      <List>
        <ListRow title={t('legal.privacy')} chevron onPress={() => openLink(PRIVACY_URL)} />
        <ListRow title={t('legal.terms')} chevron onPress={() => openLink(TERMS_URL)} />
        <ListRow title={t('settings.support')} subtitle={SUPPORT_EMAIL} chevron onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}`)} />
      </List>

      <Button variant="secondary" size="md" icon="logout" onPress={() => void signOut()}>
        {t('settings.signOut')}
      </Button>
      <Button variant="destructive" size="md" onPress={() => setConfirming(true)}>
        {t('account.delete')}
      </Button>

      <ConfirmDialog
        open={confirming}
        destructive
        busy={busy}
        title={t('account.delete.title')}
        body={t(me.role === 'coach' ? 'account.delete.body.coach' : 'account.delete.body.client')}
        confirmLabel={t('account.delete.confirm')}
        onCancel={() => setConfirming(false)}
        onConfirm={() => void remove()}
      />
    </View>
  );
}
