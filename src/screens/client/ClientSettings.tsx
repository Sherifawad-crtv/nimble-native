import { AccountSettings } from '../../components/AccountSettings';
import { t } from '../../i18n';
import { Screen } from '../../ui';

export function ClientSettings() {
  return (
    <Screen tabs title={t('settings.title')} subtitle={t('settings.subtitle')}>
      <AccountSettings />
    </Screen>
  );
}
