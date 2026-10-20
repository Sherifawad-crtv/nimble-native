import type { DataService, SessionService } from './DataService';
import { MockDataService } from './mock/MockDataService';
import { createSupabase } from './supabase/client';
import { SupabaseDataService } from './supabase/SupabaseDataService';
import { SupabaseSession } from './supabase/SupabaseSession';
import { redirectUrl } from './supabase/client';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL as string | undefined;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/** Supabase when the project is configured; otherwise the local demo backend with seeded accounts. */
function pick(): { data: DataService; session: SessionService } {
  if (url && key) {
    const sb = createSupabase(url, key);
    return { data: new SupabaseDataService(sb), session: new SupabaseSession(sb, redirectUrl()) };
  }
  const mock = new MockDataService();
  return { data: mock, session: mock };
}

// `pick()` constructs native modules (Supabase, AsyncStorage, URL polyfill) at import time, before
// React has mounted — a throw here would crash before our error boundary exists to catch it and
// show what broke. So any failure here is swallowed, and `dataService`/`sessionService` fall back
// to proxies that re-throw it lazily, the first time something actually touches them from inside a
// component — by then the error boundary is mounted and can show the real message.
let backend: { data: DataService; session: SessionService };
let initError: unknown = null;
try {
  backend = pick();
} catch (e) {
  initError = e;
  console.error('Backend initialization failed:', e);
  const mock = new MockDataService();
  backend = { data: mock, session: mock };
}

function guard<T extends object>(obj: T): T {
  if (!initError) return obj;
  const error = initError;
  return new Proxy(obj, {
    get(): never {
      throw error instanceof Error ? error : new Error(String(error));
    },
  });
}

export const dataService = guard(backend.data);
export const sessionService = guard(backend.session);
export { ServiceError } from './DataService';
export type { AccountSession, DataService, DemoSession, SessionService, SignUpInput } from './DataService';
