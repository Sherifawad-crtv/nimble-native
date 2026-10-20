import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Per-device conveniences. The app reads them synchronously from a cache filled once at launch
 * (`hydratePrefs`), and every write goes to storage in the background. Always safe to lose.
 */
const PREFIX = 'nimble.';
const cache = new Map<string, string>();

export async function hydratePrefs(): Promise<void> {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(PREFIX) || k.startsWith('origin.'));
    const pairs = await AsyncStorage.multiGet(keys);
    for (const [k, v] of pairs) if (v !== null) cache.set(k, v);
  } catch {
    /* storage unavailable: start with nothing remembered */
  }
}

export function readPref(key: string): string | null {
  return cache.get(key) ?? null;
}

export function writePref(key: string, value: string): void {
  cache.set(key, value);
  void AsyncStorage.setItem(key, value).catch(() => undefined);
}

export function removePref(key: string): void {
  cache.delete(key);
  void AsyncStorage.removeItem(key).catch(() => undefined);
}
