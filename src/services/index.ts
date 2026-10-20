import type { DataService, SessionService } from './DataService';
import { MockDataService } from './mock/MockDataService';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL as string | undefined;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/**
 * Supabase when the project is configured; otherwise the local demo backend with seeded accounts.
 *
 * The Supabase modules are pulled in with `require()`, not a static top-level `import`, and
 * deliberately so: a static `import` is hoisted and evaluated before any of this file's own code
 * runs, so a throw during `@supabase/supabase-js`'s own module setup (or any of its dependencies')
 * would happen before the try/catch below even exists — crashing before React mounts, with no error
 * boundary around to catch it and show what broke. `require()` is an ordinary function call, made
 * from inside the try block, so it is genuinely caught.
 */
function pick(): { data: DataService; session: SessionService } {
  if (url && key) {
    const { createSupabase, redirectUrl } = require('./supabase/client') as typeof import('./supabase/client');
    const { SupabaseDataService } = require('./supabase/SupabaseDataService') as typeof import('./supabase/SupabaseDataService');
    const { SupabaseSession } = require('./supabase/SupabaseSession') as typeof import('./supabase/SupabaseSession');
    const sb = createSupabase(url, key);
    return { data: new SupabaseDataService(sb), session: new SupabaseSession(sb, redirectUrl()) };
  }
  const mock = new MockDataService();
  return { data: mock, session: mock };
}

// A throw inside `pick()` is swallowed, and `dataService`/`sessionService` fall back to proxies
// that re-throw it lazily, the first time something actually touches them from inside a
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
