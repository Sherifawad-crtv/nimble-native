import { View } from 'react-native';
import { formatDay, t } from '../i18n';
import type { Package } from '../types';
import { Card, Icon, ProgressBar, StatusChip, T, color } from '../ui';

/** The client's current package: sessions used, expiry and whether it is paid. */
export function PackageCard({ pkg }: { pkg: Package | null }) {
  if (!pkg)
    return (
      <Card>
        <T tone="muted">{t('package.none')}</T>
      </Card>
    );
  return (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <T variant="heading" style={{ flex: 1 }} numberOfLines={1}>
          {pkg.name}
        </T>
        <StatusChip kind="package" value={pkg.state} />
      </View>
      <T variant="label" tone="muted">
        {t('package.usedOf', { used: pkg.sessionsUsed, total: pkg.sessionsIncluded, left: pkg.sessionsRemaining })}
      </T>
      <ProgressBar percent={pkg.sessionsIncluded ? (pkg.sessionsUsed / pkg.sessionsIncluded) * 100 : 0} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <Icon name="calendar" size={16} tint={color.muted} />
          <T variant="caption" tone="muted">
            {t('package.expiresOn', { date: formatDay(pkg.expiresOn) })}
          </T>
        </View>
        {pkg.paymentReceived ? (
          <T variant="caption" tone="muted">
            ✓ {t('package.paid')}
          </T>
        ) : null}
      </View>
    </Card>
  );
}
