import { useState } from 'react';
import { AccountSettings } from '../../components/AccountSettings';
import { t } from '../../i18n';
import { Button, Screen } from '../../ui';
import { InviteSheet } from './InviteSheet';

export function CoachSettings() {
  const [inviting, setInviting] = useState(false);
  return (
    <Screen tabs title={t('settings.title')} subtitle={t('settings.subtitle')}>
      <AccountSettings
        extra={
          <Button variant="secondary" size="md" icon="users" onPress={() => setInviting(true)}>
            {t('clients.invite')}
          </Button>
        }
      />
      <InviteSheet open={inviting} onClose={() => setInviting(false)} />
    </Screen>
  );
}
