// POST {} (no body) -> permanently deletes the signed-in account.
// A coach's deletion also deletes every client in their workspace (their auth user, which
// cascades their profile); their own workspace cascades from their own auth user's deletion.
// A client's deletion only removes themselves; the workspace and the coach are untouched.
import { HttpError, json, serve } from '../_shared/http.ts';
import { admin, caller } from '../_shared/supabase.ts';

serve(async (req) => {
  if (req.method !== 'POST') throw new HttpError(405, 'invalid', 'POST only.');
  const me = await caller(req);
  const db = admin();

  if (me.role === 'coach') {
    const { data: clients, error } = await db.from('profiles').select('id').eq('workspace_id', me.workspaceId).eq('role', 'client');
    if (error) throw new HttpError(500, 'unavailable', error.message);
    for (const c of clients ?? []) {
      const { error: delErr } = await db.auth.admin.deleteUser(c.id);
      if (delErr) console.error('delete-account: failed to remove client', c.id, delErr.message);
    }
  }

  const { error } = await db.auth.admin.deleteUser(me.id);
  if (error) throw new HttpError(500, 'unavailable', error.message);
  return json({ deleted: true });
});
