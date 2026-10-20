import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.49.4';
import { HttpError } from './http.ts';

const url = Deno.env.get('SUPABASE_URL')!;

/** Service-role client: bypasses RLS, so every caller must check ownership first. */
export const admin = (): SupabaseClient => createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

export interface Caller {
  id: string;
  workspaceId: string;
  role: 'coach' | 'client';
  name: string;
  email: string;
}

/** The signed-in user behind the request, with their profile. */
export async function caller(req: Request): Promise<Caller> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) throw new HttpError(401, 'unauthenticated', 'Sign in to continue.');
  const db = admin();
  const { data: auth, error } = await db.auth.getUser(token);
  if (error || !auth.user) throw new HttpError(401, 'unauthenticated', 'Sign in to continue.');
  const { data: p } = await db.from('profiles').select('id, workspace_id, role, name, email').eq('id', auth.user.id).single();
  if (!p) throw new HttpError(403, 'forbidden', 'No profile for this account.');
  return { id: p.id, workspaceId: p.workspace_id, role: p.role, name: p.name, email: p.email };
}
