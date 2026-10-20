import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { readPref, writePref } from './prefs';

// Push on a phone goes through Expo's push service: the app registers an Expo push token, and the
// server (supabase/functions/send-push) posts to Expo, which delivers through APNs and FCM.
// A device is stored with endpoint = the token, p256dh = 'expo' and auth = the platform.

export type PushState = 'unsupported' | 'denied' | 'off' | 'on';

export interface PushDevice {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Whether this person turned notifications on, remembered per account on this device. */
const wanted = (userId: string) => readPref(`nimble.push.${userId}`) === '1';

/** True when this person switched notifications off themselves, so they are not asked again. */
export const optedOut = (userId: string) => readPref(`nimble.push.${userId}`) === '0';

export function configureNotifications(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
  if (Platform.OS === 'android') {
    void Notifications.setNotificationChannelAsync('default', { name: 'Nimble', importance: Notifications.AndroidImportance.DEFAULT, lightColor: '#C9F711' });
  }
}

export async function getPushState(userId: string): Promise<PushState> {
  if (!Device.isDevice) return 'unsupported';
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'denied') return 'denied';
  return status === 'granted' && wanted(userId) ? 'on' : 'off';
}

async function token(): Promise<string> {
  const projectId = (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId ?? Constants.easConfig?.projectId;
  const t = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  return t.data;
}

const toDevice = (endpoint: string): PushDevice => ({ endpoint, p256dh: 'expo', auth: Platform.OS });

/** Must run from a tap: asks permission, registers this phone, and hands it to `save`. */
export async function enablePush(userId: string, save: (device: PushDevice) => Promise<void>): Promise<PushState> {
  if (!Device.isDevice) return 'unsupported';
  const current = await Notifications.getPermissionsAsync();
  const granted = current.status === 'granted' ? current : await Notifications.requestPermissionsAsync();
  if (granted.status !== 'granted') return granted.status === 'denied' && !granted.canAskAgain ? 'denied' : 'off';
  await save(toDevice(await token()));
  writePref(`nimble.push.${userId}`, '1');
  return 'on';
}

export async function disablePush(userId: string, remove: (endpoint: string) => Promise<void>): Promise<void> {
  writePref(`nimble.push.${userId}`, '0');
  try {
    await remove(await token());
  } catch {
    /* no token on this device: nothing to remove */
  }
}

/** Signing out stops this phone receiving that account's notifications but keeps the person's choice. */
export async function pauseDevice(remove: (endpoint: string) => Promise<void>): Promise<void> {
  try {
    await remove(await token());
  } catch {
    /* offline or never registered: nothing more to do */
  }
}

/** After signing in: if this person had notifications on here, register the phone for them again. */
export async function restorePush(userId: string, save: (device: PushDevice) => Promise<void>): Promise<void> {
  try {
    if (!wanted(userId) || !Device.isDevice) return;
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;
    await save(toDevice(await token()));
  } catch {
    /* best effort: the toggle shows off and can be switched on again */
  }
}

/** Maps a push payload's web-style path to this app's routes. */
export function routeFor(url: string | undefined): string | null {
  if (!url) return null;
  const workout = /^\/app\/workout\/(.+)$/.exec(url);
  if (workout) return `/workout/${workout[1]}`;
  const review = /^\/coach\/review\/(.+)$/.exec(url);
  if (review) return `/review/${review[1]}`;
  if (url === '/app/calendar') return '/calendar';
  if (url === '/app/today') return '/today';
  return null;
}
