import type { AuthError, SupabaseClient } from '@supabase/supabase-js';
import { ServiceError, type AccountSession, type AuthEvent, type SignUpInput } from '../DataService';
import { callFunction, must } from './client';

/** Plain sentences for the auth errors people actually hit. */
function authError(e: AuthError): Error {
  const m = e.message.toLowerCase();
  if (m.includes('invalid login credentials')) return new ServiceError('unauthenticated', 'That email and password do not match.');
  if (m.includes('email not confirmed')) return new ServiceError('unauthenticated', 'Confirm your email first. Open the link we sent you.');
  if (m.includes('already registered')) return new ServiceError('invalid', 'An account with this email already exists. Sign in instead.');
  if (m.includes('password should be')) return new ServiceError('invalid', 'Use a password of at least 8 characters.');
  // The project sends only a few emails an hour on the built-in mail service, for everyone together.
  if (e.code === 'over_email_send_rate_limit' || m.includes('email rate limit')) return new ServiceError('invalid', 'We cannot send confirmation emails right now. Try again in a little while.');
  if (m.includes('rate limit') || e.status === 429) return new ServiceError('invalid', 'Too many attempts. Wait a minute and try again.');
  if (m.includes('database error saving new user')) return new ServiceError('invalid', 'That invite code is not valid. Ask your coach for a new one.');
  if (m.includes('unable to validate email') || m.includes('invalid email')) return new ServiceError('invalid', 'Enter a valid email address.');
  return new Error(e.message);
}

const MIN_PASSWORD = 8;

/** Email and password accounts on Supabase Auth. Sign-up creates the profile through a database trigger. */
export class SupabaseSession implements AccountSession {
  readonly kind = 'account' as const;
  private readonly listeners = new Set<(event: AuthEvent) => void>();
  private recovering = false;

  constructor(
    private readonly sb: SupabaseClient,
    private readonly redirectTo: string,
  ) {
    // Subscribe at once: a password-reset link is handled before the UI has mounted.
    // Only a change of account is reported: Supabase repeats SIGNED_IN on token refresh and tab focus.
    let user: string | null | undefined;
    sb.auth.onAuthStateChange((event, session) => {
      const id = session?.user.id ?? null;
      const first = user === undefined;
      const changed = id !== user;
      user = id;
      let mapped: AuthEvent | null = null;
      if (event === 'PASSWORD_RECOVERY') {
        this.recovering = true;
        mapped = 'password_recovery';
      } else if (changed && !first) mapped = id ? 'signed_in' : 'signed_out';
      if (!mapped) return;
      // Never call back into Supabase from inside its own callback.
      setTimeout(() => this.listeners.forEach((l) => l(mapped)), 0);
    });
  }

  onChange(listener: (event: AuthEvent) => void): () => void {
    this.listeners.add(listener);
    if (this.recovering) setTimeout(() => listener('password_recovery'), 0);
    return () => void this.listeners.delete(listener);
  }

  async signIn(email: string, password: string): Promise<void> {
    if (!email.trim() || !password) throw new ServiceError('invalid', 'Enter your email and password.');
    const { error } = await this.sb.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw authError(error);
  }

  async checkInvite(code: string): Promise<string | null> {
    const clean = code.trim().toUpperCase();
    if (!clean) return null;
    const name = must(await this.sb.rpc('check_invite', { p_code: clean }));
    return typeof name === 'string' && name ? name : null;
  }

  async signUp(input: SignUpInput): Promise<'signed_in' | 'confirm_email'> {
    if (!input.name.trim()) throw new ServiceError('invalid', 'Enter your name.');
    if (!input.email.trim()) throw new ServiceError('invalid', 'Enter your email.');
    if (input.password.length < MIN_PASSWORD) throw new ServiceError('invalid', 'Use a password of at least 8 characters.');
    const data: Record<string, string> = { role: input.role, name: input.name.trim() };
    if (input.role === 'coach') {
      if (!input.workspaceName.trim()) throw new ServiceError('invalid', 'Name your workspace.');
      data.workspace_name = input.workspaceName.trim();
    } else {
      if (!(await this.checkInvite(input.inviteCode))) throw new ServiceError('invalid', 'That invite code is not valid. Ask your coach for a new one.');
      data.invite_code = input.inviteCode.trim().toUpperCase();
    }
    const { data: res, error } = await this.sb.auth.signUp({
      email: input.email.trim(),
      password: input.password,
      options: { data, emailRedirectTo: this.redirectTo },
    });
    if (error) throw authError(error);
    return res.session ? 'signed_in' : 'confirm_email';
  }

  async requestPasswordReset(email: string): Promise<void> {
    if (!email.trim()) throw new ServiceError('invalid', 'Enter your email.');
    const { error } = await this.sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: this.redirectTo });
    if (error) throw authError(error);
  }

  async updatePassword(password: string): Promise<void> {
    if (password.length < MIN_PASSWORD) throw new ServiceError('invalid', 'Use a password of at least 8 characters.');
    const { error } = await this.sb.auth.updateUser({ password });
    if (error) throw authError(error);
    this.recovering = false;
  }

  async deleteAccount(): Promise<void> {
    await callFunction(this.sb, 'delete-account', {});
    await this.signOut();
  }

  async handleLink(url: string): Promise<void> {
    // PKCE links come back as nimble://auth?code=... (or with an error in the query or hash).
    const query = url.split('#')[1] ?? url.split('?')[1] ?? '';
    const params = new URLSearchParams(url.includes('?') ? url.split('?')[1]?.split('#')[0] : query);
    const code = params.get('code');
    if (!code) return;
    const { error } = await this.sb.auth.exchangeCodeForSession(code);
    if (error) throw authError(error);
  }

  async signOut(): Promise<void> {
    this.recovering = false;
    // Ask the server to end the session. supabase-js keeps the session when that call fails
    // (offline, expired token, server error), so remove it from this device ourselves.
    let ended = false;
    try {
      const { error } = await this.sb.auth.signOut();
      ended = !error;
    } catch {
      /* removed below */
    }
    if (!ended) {
      // The server could not be reached: end the session on this device anyway.
      await this.sb.auth.signOut({ scope: 'local' }).catch(() => undefined);
    }
  }
}

