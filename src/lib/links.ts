import * as WebBrowser from 'expo-web-browser';

/** Public pages the stores require. Host the files in /legal (see docs/STORE_READINESS.md) and set these. */
export const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL ?? 'https://nimble.app/privacy';
export const TERMS_URL = process.env.EXPO_PUBLIC_TERMS_URL ?? 'https://nimble.app/terms';
export const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? 'support@nimble.app';

export const openLink = (url: string) => void WebBrowser.openBrowserAsync(url).catch(() => undefined);
