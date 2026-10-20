import { Platform } from 'react-native';
import type { SupabaseClient } from '@supabase/supabase-js';
import { addDays, todayISO } from '../../lib/date';
import type {
  AssistantMessage,
  AssistantReply,
  Assignment,
  AssignmentStatus,
  Block,
  CoachOverview,
  Comment,
  Exercise,
  ExerciseInput,
  ExerciseProgress,
  Id,
  Invite,
  ISODate,
  LinkPreview,
  MeasuredAs,
  Package,
  PackageInput,
  PersonalRecord,
  ProgressSummary,
  Profile,
  Program,
  ProgramInput,
  Workout,
  WorkoutInput,
  WorkoutLog,
} from '../../types';
import { ServiceError, type DataService, type ExerciseQuery } from '../DataService';
import { coachOverview, exerciseProgress, personalRecords, progressSummary, withPackageState } from '../stats';
import { parseVideoUrl, thumbnailFor, videoUrlFor } from '../videoLink';
import { callFunction, must } from './client';

// ---------- rows ----------

interface ProfileRow {
  id: string;
  workspace_id: string;
  role: 'coach' | 'client';
  name: string;
  email: string;
}
interface ExerciseRow {
  id: string;
  workspace_id: string;
  name: string;
  video_url: string | null;
  video_provider: 'youtube' | 'vimeo' | null;
  video_id: string | null;
  thumbnail_url: string | null;
  equipment: string[];
  tags: string[];
  measured_as: MeasuredAs;
  cues: string | null;
  link_status: Exercise['linkStatus'];
  created_at: string;
}
interface WorkoutRow {
  id: string;
  workspace_id: string;
  title: string;
  blocks: Block[];
}
interface ProgramRow {
  id: string;
  workspace_id: string;
  title: string;
  days: Program['days'];
}
interface AssignmentRow {
  id: string;
  workspace_id: string;
  client_id: string;
  date: string;
  workout: Workout;
  program_id: string | null;
  status: AssignmentStatus;
}
interface LogRow {
  id: string;
  assignment_id: string;
  started_at: string;
  completed_at: string | null;
  item_results: WorkoutLog['itemResults'];
  timer_results: WorkoutLog['timerResults'];
  client_note: string | null;
}
interface CommentRow {
  id: string;
  assignment_id: string;
  author_id: string;
  author_name: string;
  author_role: 'coach' | 'client';
  body: string;
  created_at: string;
}
interface PackageRow {
  id: string;
  workspace_id: string;
  client_id: string;
  name: string;
  sessions_included: number;
  sessions_used: number;
  expires_on: string;
  payment_received: boolean;
}
// ---------- mapping ----------

/** Drops null fields so optional properties stay absent, as the UI expects. */
function compact<T extends object>(o: { [K in keyof T]: T[K] | null }): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined)) as T;
}

const toProfile = (r: ProfileRow): Profile => ({ id: r.id, workspaceId: r.workspace_id, role: r.role, name: r.name, email: r.email });

const toExercise = (r: ExerciseRow): Exercise =>
  compact<Exercise>({
    id: r.id,
    workspaceId: r.workspace_id,
    name: r.name,
    videoUrl: r.video_url,
    videoProvider: r.video_provider,
    videoId: r.video_id,
    thumbnailUrl: r.thumbnail_url,
    equipment: r.equipment,
    tags: r.tags,
    measuredAs: r.measured_as,
    cues: r.cues,
    linkStatus: r.link_status,
    createdAt: r.created_at,
  });

const toWorkout = (r: WorkoutRow): Workout => ({ id: r.id, workspaceId: r.workspace_id, title: r.title, isTemplate: true, blocks: r.blocks });
const toProgram = (r: ProgramRow): Program => ({ id: r.id, workspaceId: r.workspace_id, title: r.title, days: r.days });

const toAssignment = (r: AssignmentRow): Assignment =>
  compact<Assignment>({
    id: r.id,
    workspaceId: r.workspace_id,
    clientId: r.client_id,
    date: r.date,
    workout: r.workout,
    programId: r.program_id,
    status: r.status,
  });

const toLog = (r: LogRow): WorkoutLog =>
  compact<WorkoutLog>({
    id: r.id,
    assignmentId: r.assignment_id,
    startedAt: r.started_at,
    completedAt: r.completed_at,
    itemResults: r.item_results,
    timerResults: r.timer_results,
    clientNote: r.client_note,
  });

const toComment = (r: CommentRow): Comment => ({
  id: r.id,
  assignmentId: r.assignment_id,
  authorId: r.author_id,
  authorName: r.author_name,
  authorRole: r.author_role,
  body: r.body,
  createdAt: r.created_at,
});

const uid = () => crypto.randomUUID();

/** The real backend: Postgres with row-level security, plus an edge function for video link checks. */
export class SupabaseDataService implements DataService {
  private meCache: Promise<Profile> | null = null;

  constructor(
    private readonly sb: SupabaseClient,
    private readonly today: () => ISODate = todayISO,
  ) {
    sb.auth.onAuthStateChange(() => {
      this.meCache = null;
    });
  }

  // ---------- access ----------

  private profile(): Promise<Profile> {
    this.meCache ??= this.loadMe().catch((e) => {
      this.meCache = null;
      throw e;
    });
    return this.meCache;
  }

  private async loadMe(): Promise<Profile> {
    const { data } = await this.sb.auth.getSession();
    const user = data.session?.user;
    if (!user) throw new ServiceError('unauthenticated', 'Sign in to continue.');
    const r = await this.sb.from('profiles').select('id, workspace_id, role, name, email').eq('id', user.id).maybeSingle<ProfileRow>();
    const row = must(r);
    if (!row) throw new ServiceError('unauthenticated', 'This account has no Nimble profile. Sign up again or contact your coach.');
    return toProfile(row);
  }

  private async coach(): Promise<Profile> {
    const me = await this.profile();
    if (me.role !== 'coach') throw new ServiceError('forbidden', 'Only the coach can do this.');
    return me;
  }

  private async client(): Promise<Profile> {
    const me = await this.profile();
    if (me.role !== 'client') throw new ServiceError('forbidden', 'Only the client can do this.');
    return me;
  }

  /** The coach, or the client themselves. Row-level security enforces the same rule in the database. */
  private async clientAccess(clientId: Id): Promise<Profile> {
    const me = await this.profile();
    if (me.role === 'client' && me.id !== clientId) throw new ServiceError('forbidden', 'You can only see your own data.');
    return me;
  }

  // ---------- session ----------

  async askAssistant(messages: AssistantMessage[]): Promise<AssistantReply> {
    await this.coach();
    return callFunction<AssistantReply>(this.sb, 'coach-assistant', { messages });
  }

  async savePushDevice(d: { endpoint: string; p256dh: string; auth: string }): Promise<void> {
    must(await this.sb.rpc('register_push', { p_endpoint: d.endpoint, p_p256dh: d.p256dh, p_auth: d.auth, p_user_agent: `${Platform.OS} app` }));
  }

  async removePushDevice(endpoint: string): Promise<void> {
    must(await this.sb.rpc('unregister_push', { p_endpoint: endpoint }));
  }

  async getMe(): Promise<Profile> {
    this.meCache = null;
    return this.profile();
  }

  // ---------- library ----------

  async listExercises(q: ExerciseQuery = {}): Promise<Exercise[]> {
    await this.profile();
    const rows = must(await this.sb.from('exercises').select('*').order('name').returns<ExerciseRow[]>());
    const search = q.search?.trim().toLowerCase();
    return rows
      .map(toExercise)
      .filter((e) => !search || e.name.toLowerCase().includes(search) || e.tags.some((t) => t.toLowerCase().includes(search)))
      .filter((e) => !q.tags?.length || q.tags.some((t) => e.tags.includes(t)))
      .filter((e) => !q.equipment?.length || q.equipment.some((t) => e.equipment.includes(t)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async previewVideoLink(url: string): Promise<LinkPreview> {
    await this.coach();
    parseVideoUrl(url); // reject other sites before the round trip
    return callFunction<LinkPreview>(this.sb, 'link-preview', { url });
  }

  /** Normalises the link and records whether it can be played, using the provider's own lookup. */
  private async videoColumns(url: string | undefined) {
    if (!url?.trim()) return { video_url: null, video_provider: null, video_id: null, thumbnail_url: null, link_status: 'unchecked' as const };
    const parsed = parseVideoUrl(url);
    let status: Exercise['linkStatus'] = 'ok';
    let thumbnail = thumbnailFor(parsed);
    try {
      const preview = await callFunction<LinkPreview>(this.sb, 'link-preview', { url });
      if (!preview.embeddable) status = 'unavailable';
      if (preview.thumbnailUrl) thumbnail = preview.thumbnailUrl;
    } catch (e) {
      if (e instanceof ServiceError && e.code === 'not_found') status = 'unavailable';
      else if (e instanceof ServiceError) throw e;
      else status = 'unchecked'; // the check itself failed; keep the link and check again on the next save
    }
    return { video_url: videoUrlFor(parsed), video_provider: parsed.provider, video_id: parsed.videoId, thumbnail_url: thumbnail, link_status: status };
  }

  async createExercise(input: ExerciseInput): Promise<Exercise> {
    const me = await this.coach();
    if (!input.name.trim()) throw new ServiceError('invalid', 'Give the exercise a name.');
    const row = {
      workspace_id: me.workspaceId,
      name: input.name.trim(),
      equipment: input.equipment,
      tags: input.tags,
      measured_as: input.measuredAs,
      cues: input.cues?.trim() || null,
      ...(await this.videoColumns(input.videoUrl)),
    };
    return toExercise(must(await this.sb.from('exercises').insert(row as never).select().single<ExerciseRow>()));
  }

  async updateExercise(id: Id, patch: Partial<Exercise>): Promise<Exercise> {
    await this.coach();
    if (patch.name !== undefined && !patch.name.trim()) throw new ServiceError('invalid', 'Give the exercise a name.');
    const current = toExercise(must(await this.sb.from('exercises').select('*').eq('id', id).single<ExerciseRow>()));
    const row: Record<string, unknown> = {};
    if (patch.name !== undefined) row.name = patch.name.trim();
    if (patch.equipment !== undefined) row.equipment = patch.equipment;
    if (patch.tags !== undefined) row.tags = patch.tags;
    if (patch.measuredAs !== undefined) row.measured_as = patch.measuredAs;
    if ('cues' in patch) row.cues = patch.cues?.trim() || null;
    if ('videoUrl' in patch && patch.videoUrl !== current.videoUrl) Object.assign(row, await this.videoColumns(patch.videoUrl));
    if (!Object.keys(row).length) return current;
    return toExercise(must(await this.sb.from('exercises').update(row).eq('id', id).select().single<ExerciseRow>()));
  }

  async deleteExercise(id: Id): Promise<void> {
    await this.coach();
    const gone = must(await this.sb.from('exercises').delete().eq('id', id).select('id'));
    if (!gone.length) throw new ServiceError('not_found', 'Exercise not found.');
  }

  // ---------- workouts ----------

  async listTemplates(): Promise<Workout[]> {
    await this.coach();
    return must(await this.sb.from('workouts').select('id, workspace_id, title, blocks').order('updated_at', { ascending: false }).returns<WorkoutRow[]>()).map(
      toWorkout,
    );
  }

  async saveWorkout(w: WorkoutInput): Promise<Workout> {
    const me = await this.coach();
    if (!w.title.trim()) throw new ServiceError('invalid', 'Give the workout a title.');
    const ids = [...new Set(w.blocks.flatMap((b) => b.items.map((it) => it.exerciseId)))];
    const names = new Map<string, string>();
    if (ids.length) {
      const found = must(await this.sb.from('exercises').select('id, name').in('id', ids).returns<{ id: string; name: string }[]>());
      found.forEach((e) => names.set(e.id, e.name));
    }
    const blocks: Block[] = w.blocks.map((b) => ({
      ...b,
      id: b.id || uid(),
      items: b.items.map((it) => {
        const name = names.get(it.exerciseId);
        if (!name) throw new ServiceError('invalid', 'Every exercise must come from the library.');
        return { ...it, id: it.id || uid(), exerciseName: name };
      }),
    }));
    const row = { title: w.title.trim(), blocks };
    const saved = w.id
      ? await this.sb.from('workouts').update(row).eq('id', w.id).select('id, workspace_id, title, blocks').single<WorkoutRow>()
      : await this.sb.from('workouts').insert({ ...row, workspace_id: me.workspaceId }).select('id, workspace_id, title, blocks').single<WorkoutRow>();
    return toWorkout(must(saved));
  }

  async listPrograms(): Promise<Program[]> {
    await this.coach();
    return must(await this.sb.from('programs').select('id, workspace_id, title, days').order('created_at', { ascending: false }).returns<ProgramRow[]>()).map(
      toProgram,
    );
  }

  async saveProgram(p: ProgramInput): Promise<Program> {
    const me = await this.coach();
    if (!p.title.trim()) throw new ServiceError('invalid', 'Give the program a title.');
    if (!p.days.length) throw new ServiceError('invalid', 'Add at least one workout day.');
    const ids = [...new Set(p.days.map((d) => d.workoutId))];
    const found = must(await this.sb.from('workouts').select('id').in('id', ids).returns<{ id: string }[]>());
    if (found.length !== ids.length) throw new ServiceError('invalid', 'Program days must use saved templates.');
    const row = { title: p.title.trim(), days: [...p.days].sort((a, b) => a.dayOffset - b.dayOffset) };
    const saved = p.id
      ? await this.sb.from('programs').update(row).eq('id', p.id).select('id, workspace_id, title, days').single<ProgramRow>()
      : await this.sb.from('programs').insert({ ...row, workspace_id: me.workspaceId }).select('id, workspace_id, title, days').single<ProgramRow>();
    return toProgram(must(saved));
  }

  // ---------- clients, invites and assigning ----------

  async listClients(): Promise<Profile[]> {
    await this.coach();
    return must(await this.sb.from('profiles').select('id, workspace_id, role, name, email').eq('role', 'client').order('name').returns<ProfileRow[]>()).map(
      toProfile,
    );
  }

  async getCoachOverview(): Promise<CoachOverview> {
    const [clients, programs] = await Promise.all([this.listClients(), this.listPrograms()]);
    const [assignments, packages] = await Promise.all([
      this.sb.from('assignments').select('*').returns<AssignmentRow[]>(),
      this.sb.from('packages').select('*').order('created_at', { ascending: false }).returns<PackageRow[]>(),
    ]);
    return coachOverview(clients, must(assignments).map(toAssignment), programs, must(packages).map(this.toPackage), this.today());
  }

  async listInvites(): Promise<Invite[]> {
    await this.coach();
    const rows = must(
      await this.sb.from('workspace_invites').select('code, created_at').is('revoked_at', null).order('created_at', { ascending: false }).returns<{ code: string; created_at: string }[]>(),
    );
    return rows.map((r) => ({ code: r.code, createdAt: r.created_at }));
  }

  async createInvite(): Promise<Invite> {
    const me = await this.coach();
    const r = must(
      await this.sb.from('workspace_invites').insert({ workspace_id: me.workspaceId, created_by: me.id }).select('code, created_at').single<{ code: string; created_at: string }>(),
    );
    return { code: r.code, createdAt: r.created_at };
  }

  async revokeInvite(code: string): Promise<void> {
    await this.coach();
    must(await this.sb.from('workspace_invites').update({ revoked_at: new Date().toISOString() }).eq('code', code).select('code'));
  }

  /** The client's own copy, with fresh ids, so later template edits never change assigned work. */
  private copy(template: Workout): Workout {
    return {
      ...structuredClone(template),
      id: uid(),
      isTemplate: false,
      blocks: template.blocks.map((b) => ({ ...structuredClone(b), id: uid(), items: b.items.map((i) => ({ ...structuredClone(i), id: uid() })) })),
    };
  }

  private async templates(ids: Id[]): Promise<Map<Id, Workout>> {
    const rows = must(await this.sb.from('workouts').select('id, workspace_id, title, blocks').in('id', ids).returns<WorkoutRow[]>());
    return new Map(rows.map((r) => [r.id, toWorkout(r)]));
  }

  private async insertAssignments(rows: object[]): Promise<Assignment[]> {
    return must(await this.sb.from('assignments').insert(rows).select('*').returns<AssignmentRow[]>()).map(toAssignment);
  }

  async assignWorkout(input: { clientIds: Id[]; workoutId: Id; dates: ISODate[] }): Promise<Assignment[]> {
    const me = await this.coach();
    if (!input.clientIds.length || !input.dates.length) throw new ServiceError('invalid', 'Choose at least one client and one date.');
    const tpl = (await this.templates([input.workoutId])).get(input.workoutId);
    if (!tpl) throw new ServiceError('not_found', 'Workout not found.');
    const rows = input.clientIds.flatMap((clientId) =>
      input.dates.map((date) => ({ workspace_id: me.workspaceId, client_id: clientId, date, workout: this.copy(tpl), status: 'not_started' })),
    );
    return this.insertAssignments(rows);
  }

  async assignProgram(input: { clientId: Id; programId: Id; startDate: ISODate }): Promise<Assignment[]> {
    const me = await this.coach();
    const program = must(await this.sb.from('programs').select('id, workspace_id, title, days').eq('id', input.programId).maybeSingle<ProgramRow>());
    if (!program) throw new ServiceError('not_found', 'Program not found.');
    const tpls = await this.templates([...new Set(program.days.map((d) => d.workoutId))]);
    const rows = program.days.map((d) => {
      const tpl = tpls.get(d.workoutId);
      if (!tpl) throw new ServiceError('not_found', 'A workout in this program no longer exists.');
      return {
        workspace_id: me.workspaceId,
        client_id: input.clientId,
        date: addDays(input.startDate, d.dayOffset),
        workout: this.copy(tpl),
        program_id: program.id,
        status: 'not_started',
      };
    });
    return this.insertAssignments(rows);
  }

  async getAssignment(id: Id): Promise<Assignment> {
    await this.profile();
    const row = must(await this.sb.from('assignments').select('*').eq('id', id).maybeSingle<AssignmentRow>());
    if (!row) throw new ServiceError('not_found', 'Workout not found.');
    return toAssignment(row);
  }

  async listAssignments(q: { clientId?: Id; from: ISODate; to: ISODate }): Promise<Assignment[]> {
    const me = q.clientId ? await this.clientAccess(q.clientId) : await this.profile();
    const clientId = me.role === 'client' ? me.id : q.clientId;
    let query = this.sb.from('assignments').select('*').gte('date', q.from).lte('date', q.to);
    if (clientId) query = query.eq('client_id', clientId);
    return must(await query.order('date').order('created_at').returns<AssignmentRow[]>()).map(toAssignment);
  }

  async updateAssignment(id: Id, patch: { date?: ISODate; status?: AssignmentStatus }): Promise<Assignment> {
    await this.coach();
    const row: Record<string, unknown> = {};
    if (patch.date !== undefined) row.date = patch.date;
    if (patch.status !== undefined) row.status = patch.status;
    return toAssignment(must(await this.sb.from('assignments').update(row).eq('id', id).select('*').single<AssignmentRow>()));
  }

  async deleteAssignment(id: Id): Promise<void> {
    await this.coach();
    const a = await this.getAssignment(id);
    if (a.status !== 'not_started') throw new ServiceError('invalid', 'Only workouts that have not started can be deleted.');
    const gone = must(await this.sb.from('assignments').delete().eq('id', id).select('id'));
    if (!gone.length) throw new ServiceError('invalid', 'Only workouts that have not started can be deleted.');
  }

  // ---------- logging ----------

  async startWorkout(assignmentId: Id): Promise<WorkoutLog> {
    await this.client();
    return toLog(must(await this.sb.rpc('start_workout', { p_assignment: assignmentId }).single<LogRow>()));
  }

  async saveLog(log: WorkoutLog): Promise<WorkoutLog> {
    await this.client();
    return toLog(
      must(
        await this.sb
          .rpc('save_log', { p_log: log.id, p_item_results: log.itemResults, p_timer_results: log.timerResults, p_client_note: log.clientNote ?? '' })
          .single<LogRow>(),
      ),
    );
  }

  async completeWorkout(assignmentId: Id): Promise<WorkoutLog> {
    await this.client();
    return toLog(must(await this.sb.rpc('complete_workout', { p_assignment: assignmentId }).single<LogRow>()));
  }

  async getLog(assignmentId: Id): Promise<WorkoutLog | null> {
    await this.profile();
    const row = must(await this.sb.from('workout_logs').select('*').eq('assignment_id', assignmentId).maybeSingle<LogRow>());
    return row ? toLog(row) : null;
  }

  private async history(clientId: Id) {
    const [assignments, logs, exercises] = await Promise.all([
      this.sb.from('assignments').select('*').eq('client_id', clientId).returns<AssignmentRow[]>(),
      this.sb.from('workout_logs').select('*').eq('client_id', clientId).returns<LogRow[]>(),
      this.sb.from('exercises').select('id, measured_as').returns<{ id: string; measured_as: MeasuredAs }[]>(),
    ]);
    const measured = new Map(must(exercises).map((e) => [e.id, e.measured_as]));
    return {
      assignments: must(assignments).map(toAssignment),
      logs: must(logs).map(toLog),
      measuredOf: (id: Id): MeasuredAs => measured.get(id) ?? 'reps',
    };
  }

  async listPersonalRecords(clientId: Id): Promise<PersonalRecord[]> {
    await this.clientAccess(clientId);
    const h = await this.history(clientId);
    return personalRecords(h.assignments, h.logs, h.measuredOf);
  }

  async listExerciseProgress(clientId: Id): Promise<ExerciseProgress[]> {
    await this.clientAccess(clientId);
    const h = await this.history(clientId);
    return exerciseProgress(h.assignments, h.logs, h.measuredOf);
  }

  async getProgressSummary(clientId: Id): Promise<ProgressSummary> {
    await this.clientAccess(clientId);
    const h = await this.history(clientId);
    return progressSummary(h.assignments, h.logs, h.measuredOf, this.today());
  }

  // ---------- comments ----------

  async listComments(assignmentId: Id): Promise<Comment[]> {
    await this.profile();
    return must(await this.sb.from('comments').select('*').eq('assignment_id', assignmentId).order('created_at').returns<CommentRow[]>()).map(toComment);
  }

  async addComment(assignmentId: Id, body: string): Promise<Comment> {
    const me = await this.profile();
    if (!body.trim()) throw new ServiceError('invalid', 'Write a comment first.');
    // Author name, role and workspace are stamped by the database from the author's profile.
    const row = { assignment_id: assignmentId, author_id: me.id, author_name: me.name, author_role: me.role, workspace_id: me.workspaceId, body: body.trim() };
    return toComment(must(await this.sb.from('comments').insert(row).select('*').single<CommentRow>()));
  }

  // ---------- packages ----------

  private toPackage = (r: PackageRow): Package =>
    withPackageState(
      {
        id: r.id,
        workspaceId: r.workspace_id,
        clientId: r.client_id,
        name: r.name,
        sessionsIncluded: r.sessions_included,
        sessionsUsed: r.sessions_used,
        expiresOn: r.expires_on,
        paymentReceived: r.payment_received,
      },
      this.today(),
    );

  async listPackages(clientId: Id): Promise<Package[]> {
    await this.clientAccess(clientId);
    return must(await this.sb.from('packages').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).returns<PackageRow[]>()).map(this.toPackage);
  }

  async savePackage(p: PackageInput): Promise<Package> {
    const me = await this.coach();
    if (!p.name.trim()) throw new ServiceError('invalid', 'Give the package a name.');
    if (p.sessionsIncluded < 1) throw new ServiceError('invalid', 'A package needs at least one session.');
    if (p.sessionsUsed < 0 || p.sessionsUsed > p.sessionsIncluded) throw new ServiceError('invalid', 'Sessions used cannot exceed sessions included.');
    const row = {
      client_id: p.clientId,
      name: p.name.trim(),
      sessions_included: p.sessionsIncluded,
      sessions_used: p.sessionsUsed,
      expires_on: p.expiresOn,
      payment_received: p.paymentReceived,
    };
    const saved = p.id
      ? await this.sb.from('packages').update(row).eq('id', p.id).select('*').single<PackageRow>()
      : await this.sb.from('packages').insert({ ...row, workspace_id: me.workspaceId }).select('*').single<PackageRow>();
    return this.toPackage(must(saved));
  }
}
