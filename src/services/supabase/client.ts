import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, FunctionsHttpError, type SupabaseClient } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { ServiceError, type ServiceErrorCode } from '../DataService';

/** Where email links (confirm, reset password) send people back to: the app's own URL scheme. */
export const redirectUrl = () => Linking.createURL('auth');

export function createSupabase(url: string, key: string): SupabaseClient {
  return createClient(url, key, {
    // The app stores the session itself; there is no URL bar, so links are handled in app/_layout.
    auth: { storage: AsyncStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: 'pkce' },
  });
}

const OFFLINE = 'Could not reach Nimble. Check your connection and try again.';
const CODES = new Set<ServiceErrorCode>(['not_found', 'forbidden', 'invalid_link', 'unauthenticated', 'invalid']);

interface DbError {
  code?: string;
  message: string;
}

/**
 * Maps a database error to the app's error shape. Messages raised by Nimble's own SQL are written
 * for people, so they pass through; constraint and policy errors get a plain sentence instead.
 */
export function dbError(e: DbError): Error {
  switch (e.code) {
    case 'PGRST116':
    case 'P0002':
      return new ServiceError('not_found', e.code === 'P0002' ? e.message : 'This item no longer exists.');
    case '42501':
      return new ServiceError('forbidden', 'You do not have access to this.');
    case '23514':
      return new ServiceError('invalid', /violates check constraint/.test(e.message) ? 'One of the values is not allowed.' : e.message);
    case '23505':
      return new ServiceError('invalid', 'That already exists.');
    case '23503':
      return new ServiceError('invalid', 'Something this refers to no longer exists.');
    case 'PGRST301':
    case 'PGRST303':
      return new ServiceError('unauthenticated', 'Your session ended. Sign in again.');
  }
  return new Error(e.message || OFFLINE);
}

/** Unwraps a query result, throwing the mapped error. */
export function must<T>(r: { data: T | null; error: DbError | null }): T {
  if (r.error) throw dbError(r.error);
  return r.data as T;
}

/** Calls a Nimble edge function. Errors come back as { error: { code, message } }. */
export async function callFunction<T>(sb: SupabaseClient, name: string, body: object = {}): Promise<T> {
  const { data, error } = await sb.functions.invoke<T>(name, { body });
  if (!error) return data as T;
  if (error instanceof FunctionsHttpError) {
    const payload = (await (error.context as Response).json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
    const code = payload?.error?.code;
    const message = payload?.error?.message ?? OFFLINE;
    if (code && CODES.has(code as ServiceErrorCode)) throw new ServiceError(code as ServiceErrorCode, message);
    throw new Error(message);
  }
  throw new Error(OFFLINE);
}
