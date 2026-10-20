import { useEffect, useState } from 'react';
import { Linking, Switch, View } from 'react-native';
import { useMe } from '../core/auth';
import { t } from '../i18n';
import { disablePush, enablePush, getPushState, type PushState } from '../lib/push';
import { dataService, sessionService } from '../services';
import { Card, T, color, useToast } from '../ui';

/** Turns push notifications on or off for this phone. Hidden on the demo backend, which sends none. */
export function NotificationsSetting() {
  const me = useMe();
  const toast = useToast();
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (sessionService.kind === 'account') void getPushState(me.id).then(setState);
  }, [me.id]);

  if (sessionService.kind !== 'account' || state === null) return null;

  const description =
    state === 'denied' ? t('notif.denied') : state === 'unsupported' ? t('notif.unsupported') : state === 'on' ? t('notif.on') : t(me.role === 'coach' ? 'notif.desc.coach' : 'notif.desc.client');

  const change = async (on: boolean) => {
    setBusy(true);
    try {
      if (on) {
        const next = await enablePush(me.id, (d) => dataService.savePushDevice(d));
        setState(next);
        if (next === 'denied') void Linking.openSettings();
      } else {
        await disablePush(me.id, (endpoint) => dataService.removePushDevice(endpoint));
        setState('off');
      }
    } catch {
      toast.show(t('notif.error'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <T variant="bodyStrong">{t('notif.label')}</T>
          <T variant="caption" tone="muted">
            {description}
          </T>
        </View>
        <Switch
          value={state === 'on'}
          disabled={busy || state === 'unsupported'}
          onValueChange={(v) => void change(v)}
          trackColor={{ true: color.brand, false: color.surfaceRaised }}
          thumbColor="#ffffff"
          ios_backgroundColor={color.surfaceRaised}
          accessibilityLabel={t('notif.label')}
        />
      </View>
    </Card>
  );
}
