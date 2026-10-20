// POST { users: uuid[], title, body, url } -> sends a push to every device of those users.
// Called only by the database (private.notify), which proves itself with the shared x-push-secret.
// The secret and the VAPID signing keys live in private.push_config, read through push_settings().
//
// Devices come in two flavours, told apart by p256dh:
//   - web push subscriptions: real p256dh/auth keys, delivered via the Web Push protocol.
//   - Expo push tokens (the native app): p256dh = 'expo', endpoint = the Expo push token,
//     auth = the platform ('ios' | 'android'), delivered via Expo's push API.
import webpush from 'npm:web-push@3.6.7';
import { HttpError, json, serve } from '../_shared/http.ts';
import { admin } from '../_shared/supabase.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_MARKER = 'expo';

interface Device {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

async function sendWeb(cfg: { vapid_subject: string; vapid_public: string; vapid_private: string }, d: Device, payload: string): Promise<'sent' | 'gone' | 'failed'> {
  try {
    await webpush.sendNotification({ endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } }, payload, { TTL: 60 * 60 * 24 });
    return 'sent';
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return 'gone';
    console.error('web push failed', status);
    return 'failed';
  }
}

async function sendExpoBatch(devices: Device[], title: string, body: string, url: string): Promise<{ sent: number; gone: string[] }> {
  if (!devices.length) return { sent: 0, gone: [] };
  const messages = devices.map((d) => ({ to: d.endpoint, title, body, data: { url }, sound: 'default', priority: 'high' }));
  const res = await fetch(EXPO_PUSH_URL, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(messages) });
  if (!res.ok) {
    console.error('expo push batch failed', res.status, await res.text().catch(() => ''));
    return { sent: 0, gone: [] };
  }
  const { data } = (await res.json()) as { data?: { status: 'ok' | 'error'; details?: { error?: string } }[] };
  let sent = 0;
  const gone: string[] = [];
  (data ?? []).forEach((r, i) => {
    if (r.status === 'ok') sent++;
    else if (r.details?.error === 'DeviceNotRegistered') gone.push(devices[i]!.id);
    else console.error('expo push failed', r.details?.error);
  });
  return { sent, gone };
}

serve(async (req) => {
  const db = admin();
  const { data: cfg } = await db.rpc('push_settings');
  if (!cfg?.secret || req.headers.get('x-push-secret') !== cfg.secret) throw new HttpError(401, 'unauthenticated', 'Not allowed.');
  webpush.setVapidDetails(cfg.vapid_subject, cfg.vapid_public, cfg.vapid_private);

  const { users, title, body, url } = (await req.json().catch(() => ({}))) as { users?: string[]; title?: string; body?: string; url?: string };
  if (!Array.isArray(users) || !users.length || !title) throw new HttpError(400, 'invalid', 'Who and what to send are required.');

  const { data: subs } = await db.from('push_subscriptions').select('id, endpoint, p256dh, auth').in('user_id', users);
  const devices = subs ?? [];
  const webDevices = devices.filter((d) => d.p256dh !== EXPO_MARKER);
  const expoDevices = devices.filter((d) => d.p256dh === EXPO_MARKER);
  const payload = JSON.stringify({ title, body: body ?? '', url: url ?? '/' });

  let sent = 0;
  const gone: string[] = [];
  await Promise.all(
    webDevices.map(async (d) => {
      const result = await sendWeb(cfg, d, payload);
      if (result === 'sent') sent++;
      else if (result === 'gone') gone.push(d.id);
    }),
  );
  const expoResult = await sendExpoBatch(expoDevices, title, body ?? '', url ?? '/');
  sent += expoResult.sent;
  gone.push(...expoResult.gone);

  if (gone.length) await db.from('push_subscriptions').delete().in('id', gone);
  return json({ sent, removed: gone.length });
});
