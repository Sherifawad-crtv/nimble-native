import { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';
import { useMe } from '../app/auth';
import { t } from '../i18n';
import { enablePush, getPushState, optedOut, type PushState } from '../lib/push';
import { readPref, writePref } from '../lib/prefs';
import { dataService, sessionService } from '../services';
import { Button, Icon, Sheet, T, color, useToast } from '../ui';

const AGAIN_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Asks once, with a preview of what a notification looks like, when a signed-in person has not
 * turned notifications on: first visit, or after they were blocked. Skipping waits a week; a person
 * who switched notifications off in Settings is never asked.
 */
export function NotifyPrompt() {
  const me = useMe();
  const toast = useToast();
  const [state, setState] = useState<PushState | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const key = `nimble.notify.asked.${me.id}`;

  useEffect(() => {
    if (sessionService.kind !== 'account' || optedOut(me.id)) return;
    const asked = Number(readPref(key) ?? 0);
    if (asked && Date.now() - asked < AGAIN_AFTER_MS) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    void getPushState(me.id).then((s) => {
      if (!live || (s !== 'off' && s !== 'denied')) return;
      setState(s);
      timer = setTimeout(() => live && setOpen(true), 1200); // let the home screen settle first
    });
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [me.id, key]);

  const skip = () => {
    writePref(key, String(Date.now()));
    setOpen(false);
  };

  const enable = async () => {
    if (state === 'denied') {
      skip();
      void Linking.openSettings();
      return;
    }
    setBusy(true);
    try {
      const next = await enablePush(me.id, (d) => dataService.savePushDevice(d));
      writePref(key, String(Date.now()));
      if (next === 'denied') setState('denied');
      else setOpen(false);
    } catch {
      toast.show(t('notif.error'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const role = me.role === 'coach' ? 'coach' : 'client';
  return (
    <Sheet open={open} title={t('notifyPrompt.title')} onClose={skip}>
      <View style={{ gap: 16, paddingBottom: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 24, backgroundColor: '#fff' }}>
          <View style={{ width: 52, height: 52, borderRadius: 12, backgroundColor: color.brand, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="dumbbell" size={28} tint={color.onBrand} />
          </View>
          <View style={{ flex: 1 }}>
            <T variant="bodyStrong" style={{ color: '#111' }}>
              {t('notifyPrompt.app')}
            </T>
            <T variant="label" style={{ color: '#3c3c43' }}>
              {t(`notifyPrompt.sample.${role}`)}
            </T>
          </View>
        </View>
        <T tone="muted">{state === 'denied' ? t('notifyPrompt.blocked') : t(`notifyPrompt.body.${role}`)}</T>
        <Button loading={busy} onPress={() => void enable()}>
          {state === 'denied' ? t('notifyPrompt.openSettings') : t('notifyPrompt.enable')}
        </Button>
        <Button variant="tertiary" size="md" onPress={skip}>
          {t('notifyPrompt.skip')}
        </Button>
      </View>
    </Sheet>
  );
}
