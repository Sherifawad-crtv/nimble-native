import { readPref, removePref, writePref } from '../../lib/prefs';
import { addDays, todayISO } from '../../lib/date';
import type {
  Assignment,
  AssignmentStatus,
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
import { ServiceError, type DataService, type DemoSession, type ExerciseQuery } from '../DataService';
import { cloneWorkout, createSeed, VIDEO_TITLES, type MockDB } from './seed';
import { coachOverview, exerciseProgress, personalRecords, progressSummary, withPackageState } from '../stats';
import { mockOembed, parseVideoUrl, thumbnailFor, videoUrlFor } from '../videoLink';

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface MockOptions {
  storage?: KeyValueStore;
  /** Simulated network latency range in ms. Use [0, 0] in tests. */
  latencyMs?: [number, number];
  today?: () => ISODate;
}

const DB_KEY = 'nimble.mock.db.v2';
const SESSION_KEY = 'nimble.mock.session.v1';

function browserStorage(): KeyValueStore {
  const memory = new Map<string, string>();
  const fallback: KeyValueStore = {
    getItem: (k) => memory.get(k) ?? null,
    setItem: (k, v) => void memory.set(k, v),
    removeItem: (k) => void memory.delete(k),
  };
  try {
    return { getItem: readPref, setItem: writePref, removeItem: removePref };
  } catch {
    return fallback;
  }
}

const emptyStore = (): KeyValueStore => {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
};

/** In-memory, localStorage-backed implementation of the backend contract. */
export class MockDataService implements DataService, DemoSession {
  readonly kind = 'demo' as const;
  private readonly storage: KeyValueStore;
  private readonly latency: [number, number];
  private readonly today: () => ISODate;
  private db: MockDB;
  private me: Id | null;

  constructor(opts: MockOptions = {}) {
    this.storage = opts.storage ?? (typeof window === 'undefined' ? emptyStore() : browserStorage());
    this.latency = opts.latencyMs ?? [90, 280];
    this.today = opts.today ?? todayISO;
    this.db = this.load();
    this.me = this.storage.getItem(SESSION_KEY);
    if (this.me && !this.db.profiles.some((p) => p.id === this.me)) this.me = null;
  }

  // ---------- plumbing ----------

  private load(): MockDB {
    try {
      const raw = this.storage.getItem(DB_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as MockDB;
        if (parsed.version === 2) {
          // Titles for the mock oEmbed are rebuilt from the library on every load.
          parsed.exercises.forEach((e) => e.videoId && (VIDEO_TITLES[e.videoId] = e.name));
          return parsed;
        }
      }
    } catch {
      /* fall through to a fresh seed */
    }
    const fresh = createSeed(this.today());
    this.storage.setItem(DB_KEY, JSON.stringify(fresh));
    return fresh;
  }

  private persist(): void {
    try {
      this.storage.setItem(DB_KEY, JSON.stringify(this.db));
    } catch {
      /* storage full or blocked: keep working in memory */
    }
  }

  private async wait(): Promise<void> {
    const [lo, hi] = this.latency;
    if (hi <= 0) return;
    await new Promise((r) => setTimeout(r, lo + Math.random() * (hi - lo)));
  }

  private id(prefix: string): Id {
    return `${prefix}_${++this.db.seq}`;
  }

  /** Resets the demo data to the seed. Not part of the backend contract. */
  reset(): void {
    this.db = createSeed(this.today());
    this.persist();
  }

  private profile(): Profile {
    const p = this.db.profiles.find((x) => x.id === this.me);
    if (!p) throw new ServiceError('unauthenticated', 'Sign in to continue.');
    return p;
  }

  private coach(): Profile {
    const p = this.profile();
    if (p.role !== 'coach') throw new ServiceError('forbidden', 'Only the coach can do this.');
    return p;
  }

  /** The coach, or the client themselves. Returns the client profile. */
  private clientAccess(clientId: Id): Profile {
    const me = this.profile();
    const client = this.db.profiles.find((p) => p.id === clientId && p.role === 'client' && p.workspaceId === me.workspaceId);
    if (!client) throw new ServiceError('not_found', 'Client not found.');
    if (me.role === 'client' && me.id !== clientId) throw new ServiceError('forbidden', 'You can only see your own data.');
    return client;
  }

  private assignmentFor(id: Id, mode: 'view' | 'client'): Assignment {
    const me = this.profile();
    const a = this.db.assignments.find((x) => x.id === id && x.workspaceId === me.workspaceId);
    if (!a) throw new ServiceError('not_found', 'Workout not found.');
    if (me.role === 'client' && a.clientId !== me.id) throw new ServiceError('forbidden', 'You can only see your own workouts.');
    if (mode === 'client' && me.role !== 'client') throw new ServiceError('forbidden', 'Only the client can log a workout.');
    return a;
  }

  private measuredOf = (exerciseId: Id): MeasuredAs =>
    this.db.exercises.find((e) => e.id === exerciseId)?.measuredAs ?? 'reps';

  private withDerived(p: MockDB['packages'][number]): Package {
    return withPackageState(p, this.today());
  }

  // ---------- session ----------

  currentProfileId(): Id | null {
    return this.me;
  }

  async listDemoAccounts(): Promise<Profile[]> {
    await this.wait();
    return structuredClone(this.db.profiles);
  }

  async signIn(profileId: Id): Promise<Profile> {
    await this.wait();
    const p = this.db.profiles.find((x) => x.id === profileId);
    if (!p) throw new ServiceError('not_found', 'Account not found.');
    this.me = p.id;
    this.storage.setItem(SESSION_KEY, p.id);
    return structuredClone(p);
  }

  async signOut(): Promise<void> {
    await this.wait();
    this.me = null;
    this.storage.removeItem(SESSION_KEY);
  }

  async askAssistant(): Promise<never> {
    throw new ServiceError('forbidden', 'The assistant needs a real account. It is not part of the demo.');
  }

  // Push needs a real backend; the demo backend has nothing to send.
  async savePushDevice(): Promise<void> {}
  async removePushDevice(): Promise<void> {}

  async getMe(): Promise<Profile> {
    await this.wait();
    return structuredClone(this.profile());
  }

  // ---------- library ----------

  async listExercises(q: ExerciseQuery = {}): Promise<Exercise[]> {
    await this.wait();
    const me = this.profile();
    const search = q.search?.trim().toLowerCase();
    return structuredClone(
      this.db.exercises
        .filter((e) => e.workspaceId === me.workspaceId)
        .filter((e) => !search || e.name.toLowerCase().includes(search) || e.tags.some((t) => t.toLowerCase().includes(search)))
        .filter((e) => !q.tags?.length || q.tags.some((t) => e.tags.includes(t)))
        .filter((e) => !q.equipment?.length || q.equipment.some((t) => e.equipment.includes(t)))
        .sort((a, b) => a.name.localeCompare(b.name)),
    );
  }

  async previewVideoLink(url: string): Promise<LinkPreview> {
    await this.wait();
    this.coach();
    return mockOembed(parseVideoUrl(url), VIDEO_TITLES);
  }

  private videoFields(url: string | undefined): Pick<Exercise, 'videoUrl' | 'videoProvider' | 'videoId' | 'thumbnailUrl' | 'linkStatus'> {
    if (!url?.trim()) return { linkStatus: 'unchecked' };
    const parsed = parseVideoUrl(url);
    let status: Exercise['linkStatus'] = 'ok';
    try {
      if (!mockOembed(parsed, VIDEO_TITLES).embeddable) status = 'unavailable';
    } catch {
      status = 'unavailable';
    }
    return { videoUrl: videoUrlFor(parsed), videoProvider: parsed.provider, videoId: parsed.videoId, thumbnailUrl: thumbnailFor(parsed), linkStatus: status };
  }

  async createExercise(input: ExerciseInput): Promise<Exercise> {
    await this.wait();
    const me = this.coach();
    if (!input.name.trim()) throw new ServiceError('invalid', 'Give the exercise a name.');
    const exercise: Exercise = {
      id: this.id('ex'),
      workspaceId: me.workspaceId,
      name: input.name.trim(),
      equipment: input.equipment,
      tags: input.tags,
      measuredAs: input.measuredAs,
      ...(input.cues?.trim() && { cues: input.cues.trim() }),
      ...this.videoFields(input.videoUrl),
      createdAt: new Date().toISOString(),
    };
    if (exercise.videoId) VIDEO_TITLES[exercise.videoId] = exercise.name;
    this.db.exercises.push(exercise);
    this.persist();
    return structuredClone(exercise);
  }

  async updateExercise(id: Id, patch: Partial<Exercise>): Promise<Exercise> {
    await this.wait();
    const me = this.coach();
    const i = this.db.exercises.findIndex((e) => e.id === id && e.workspaceId === me.workspaceId);
    const current = this.db.exercises[i];
    if (!current) throw new ServiceError('not_found', 'Exercise not found.');
    const { id: _id, workspaceId: _ws, createdAt: _at, ...allowed } = patch;
    if (allowed.name !== undefined && !allowed.name.trim()) throw new ServiceError('invalid', 'Give the exercise a name.');
    const next: Exercise = { ...current, ...allowed };
    if ('videoUrl' in patch && patch.videoUrl !== current.videoUrl) {
      delete next.videoProvider;
      delete next.videoId;
      delete next.thumbnailUrl;
      Object.assign(next, this.videoFields(patch.videoUrl));
      if (!patch.videoUrl?.trim()) delete next.videoUrl;
    }
    this.db.exercises[i] = next;
    this.persist();
    return structuredClone(next);
  }

  async deleteExercise(id: Id): Promise<void> {
    await this.wait();
    const me = this.coach();
    if (!this.db.exercises.some((e) => e.id === id && e.workspaceId === me.workspaceId)) throw new ServiceError('not_found', 'Exercise not found.');
    this.db.exercises = this.db.exercises.filter((e) => e.id !== id);
    this.persist();
  }

  // ---------- workouts ----------

  async listTemplates(): Promise<Workout[]> {
    await this.wait();
    const me = this.coach();
    return structuredClone(this.db.workouts.filter((w) => w.workspaceId === me.workspaceId && w.isTemplate));
  }

  async saveWorkout(w: WorkoutInput): Promise<Workout> {
    await this.wait();
    const me = this.coach();
    if (!w.title.trim()) throw new ServiceError('invalid', 'Give the workout a title.');
    const blocks = w.blocks.map((b) => ({
      ...b,
      id: b.id || this.id('bl'),
      items: b.items.map((it) => {
        const ex = this.db.exercises.find((e) => e.id === it.exerciseId && e.workspaceId === me.workspaceId);
        if (!ex) throw new ServiceError('invalid', 'Every exercise must come from the library.');
        return { ...it, id: it.id || this.id('it'), exerciseName: ex.name };
      }),
    }));
    const saved: Workout = { id: w.id || this.id('wo'), workspaceId: me.workspaceId, title: w.title.trim(), isTemplate: true, blocks };
    const i = this.db.workouts.findIndex((x) => x.id === saved.id);
    if (i >= 0) {
      if (this.db.workouts[i]?.workspaceId !== me.workspaceId) throw new ServiceError('forbidden', 'Not your workspace.');
      this.db.workouts[i] = saved;
    } else this.db.workouts.push(saved);
    this.persist();
    return structuredClone(saved);
  }

  async listPrograms(): Promise<Program[]> {
    await this.wait();
    const me = this.coach();
    return structuredClone(this.db.programs.filter((p) => p.workspaceId === me.workspaceId));
  }

  async saveProgram(p: ProgramInput): Promise<Program> {
    await this.wait();
    const me = this.coach();
    if (!p.title.trim()) throw new ServiceError('invalid', 'Give the program a title.');
    if (!p.days.length) throw new ServiceError('invalid', 'Add at least one workout day.');
    for (const d of p.days) {
      if (!this.db.workouts.some((w) => w.id === d.workoutId && w.workspaceId === me.workspaceId && w.isTemplate)) {
        throw new ServiceError('invalid', 'Program days must use saved templates.');
      }
    }
    const saved: Program = { id: p.id || this.id('pr'), workspaceId: me.workspaceId, title: p.title.trim(), days: [...p.days].sort((a, b) => a.dayOffset - b.dayOffset) };
    const i = this.db.programs.findIndex((x) => x.id === saved.id);
    if (i >= 0) this.db.programs[i] = saved;
    else this.db.programs.push(saved);
    this.persist();
    return structuredClone(saved);
  }

  // ---------- clients and assigning ----------

  async listClients(): Promise<Profile[]> {
    await this.wait();
    const me = this.coach();
    return structuredClone(this.db.profiles.filter((p) => p.role === 'client' && p.workspaceId === me.workspaceId));
  }

  async getCoachOverview(): Promise<CoachOverview> {
    await this.wait();
    const me = this.coach();
    const clients = this.db.profiles.filter((p) => p.role === 'client' && p.workspaceId === me.workspaceId);
    const assignments = this.db.assignments.filter((a) => a.workspaceId === me.workspaceId);
    const packages = this.db.packages.filter((p) => p.workspaceId === me.workspaceId).map((p) => this.withDerived(p)).reverse();
    return structuredClone(coachOverview(clients, assignments, this.db.programs, packages, this.today()));
  }

  async listInvites(): Promise<Invite[]> {
    await this.wait();
    this.coach();
    return structuredClone(this.db.invites ?? []);
  }

  async createInvite(): Promise<Invite> {
    await this.wait();
    this.coach();
    const code = Array.from({ length: 8 }, () => '0123456789ABCDEF'[Math.floor(Math.random() * 16)]).join('');
    const invite: Invite = { code, createdAt: new Date().toISOString() };
    this.db.invites = [invite, ...(this.db.invites ?? [])];
    this.persist();
    return structuredClone(invite);
  }

  async revokeInvite(code: string): Promise<void> {
    await this.wait();
    this.coach();
    this.db.invites = (this.db.invites ?? []).filter((i) => i.code !== code);
    this.persist();
  }

  private createAssignment(clientId: Id, date: ISODate, template: Workout, programId?: Id): Assignment {
    const a: Assignment = {
      id: this.id('as'),
      workspaceId: template.workspaceId,
      clientId,
      date,
      workout: cloneWorkout(template, (prefix) => this.id(prefix)),
      status: 'not_started',
      ...(programId && { programId }),
    };
    this.db.assignments.push(a);
    return a;
  }

  private template(id: Id, workspaceId: Id): Workout {
    const t = this.db.workouts.find((w) => w.id === id && w.workspaceId === workspaceId && w.isTemplate);
    if (!t) throw new ServiceError('not_found', 'Workout not found.');
    return t;
  }

  async assignWorkout(input: { clientIds: Id[]; workoutId: Id; dates: ISODate[] }): Promise<Assignment[]> {
    await this.wait();
    const me = this.coach();
    if (!input.clientIds.length || !input.dates.length) throw new ServiceError('invalid', 'Choose at least one client and one date.');
    const tpl = this.template(input.workoutId, me.workspaceId);
    input.clientIds.forEach((c) => this.clientAccess(c));
    const created = input.clientIds.flatMap((c) => input.dates.map((d) => this.createAssignment(c, d, tpl)));
    this.persist();
    return structuredClone(created);
  }

  async assignProgram(input: { clientId: Id; programId: Id; startDate: ISODate }): Promise<Assignment[]> {
    await this.wait();
    const me = this.coach();
    this.clientAccess(input.clientId);
    const program = this.db.programs.find((p) => p.id === input.programId && p.workspaceId === me.workspaceId);
    if (!program) throw new ServiceError('not_found', 'Program not found.');
    const created = program.days.map((d) =>
      this.createAssignment(input.clientId, addDays(input.startDate, d.dayOffset), this.template(d.workoutId, me.workspaceId), program.id),
    );
    this.persist();
    return structuredClone(created);
  }

  async getAssignment(id: Id): Promise<Assignment> {
    await this.wait();
    return structuredClone(this.assignmentFor(id, 'view'));
  }

  async listAssignments(q: { clientId?: Id; from: ISODate; to: ISODate }): Promise<Assignment[]> {
    await this.wait();
    const me = this.profile();
    if (q.clientId) this.clientAccess(q.clientId);
    const clientId = me.role === 'client' ? me.id : q.clientId;
    return structuredClone(
      this.db.assignments
        .filter((a) => a.workspaceId === me.workspaceId && (!clientId || a.clientId === clientId) && a.date >= q.from && a.date <= q.to)
        .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)),
    );
  }

  async updateAssignment(id: Id, patch: { date?: ISODate; status?: AssignmentStatus }): Promise<Assignment> {
    await this.wait();
    this.coach();
    const a = this.assignmentFor(id, 'view');
    if (patch.date !== undefined) {
      if (a.status !== 'not_started') throw new ServiceError('invalid', 'Only workouts that have not started can be moved.');
      a.date = patch.date;
    }
    if (patch.status !== undefined) a.status = patch.status;
    this.persist();
    return structuredClone(a);
  }

  async deleteAssignment(id: Id): Promise<void> {
    await this.wait();
    this.coach();
    const a = this.assignmentFor(id, 'view');
    if (a.status !== 'not_started') throw new ServiceError('invalid', 'Only workouts that have not started can be deleted.');
    this.db.assignments = this.db.assignments.filter((x) => x.id !== id);
    this.db.comments = this.db.comments.filter((c) => c.assignmentId !== id);
    this.persist();
  }

  // ---------- logging ----------

  async startWorkout(assignmentId: Id): Promise<WorkoutLog> {
    await this.wait();
    const a = this.assignmentFor(assignmentId, 'client');
    let log = this.db.logs.find((l) => l.assignmentId === a.id);
    if (!log) {
      log = { id: this.id('lg'), assignmentId: a.id, startedAt: new Date().toISOString(), itemResults: [], timerResults: [] };
      this.db.logs.push(log);
    }
    if (a.status === 'not_started' || a.status === 'skipped') a.status = 'in_progress';
    this.persist();
    return structuredClone(log);
  }

  async saveLog(log: WorkoutLog): Promise<WorkoutLog> {
    await this.wait();
    const a = this.assignmentFor(log.assignmentId, 'client');
    const i = this.db.logs.findIndex((l) => l.id === log.id && l.assignmentId === a.id);
    const current = this.db.logs[i];
    if (!current) throw new ServiceError('not_found', 'Log not found.');
    const next: WorkoutLog = {
      ...current,
      itemResults: log.itemResults,
      timerResults: log.timerResults,
      ...(log.clientNote?.trim() ? { clientNote: log.clientNote.trim() } : {}),
    };
    if (!log.clientNote?.trim()) delete next.clientNote;
    this.db.logs[i] = next;
    this.persist();
    return structuredClone(next);
  }

  async completeWorkout(assignmentId: Id): Promise<WorkoutLog> {
    await this.wait();
    const a = this.assignmentFor(assignmentId, 'client');
    const log = this.db.logs.find((l) => l.assignmentId === a.id);
    if (!log) throw new ServiceError('invalid', 'Start the workout before finishing it.');
    log.completedAt = new Date().toISOString();
    a.status = 'completed';
    this.persist();
    return structuredClone(log);
  }

  async getLog(assignmentId: Id): Promise<WorkoutLog | null> {
    await this.wait();
    const a = this.assignmentFor(assignmentId, 'view');
    return structuredClone(this.db.logs.find((l) => l.assignmentId === a.id) ?? null);
  }

  private clientHistory(clientId: Id) {
    const assignments = this.db.assignments.filter((a) => a.clientId === clientId);
    const ids = new Set(assignments.map((a) => a.id));
    return { assignments, logs: this.db.logs.filter((l) => ids.has(l.assignmentId)) };
  }

  async listPersonalRecords(clientId: Id): Promise<PersonalRecord[]> {
    await this.wait();
    this.clientAccess(clientId);
    const { assignments, logs } = this.clientHistory(clientId);
    return personalRecords(assignments, logs, this.measuredOf);
  }

  async listExerciseProgress(clientId: Id): Promise<ExerciseProgress[]> {
    await this.wait();
    this.clientAccess(clientId);
    const { assignments, logs } = this.clientHistory(clientId);
    return exerciseProgress(assignments, logs, this.measuredOf);
  }

  async getProgressSummary(clientId: Id): Promise<ProgressSummary> {
    await this.wait();
    this.clientAccess(clientId);
    const { assignments, logs } = this.clientHistory(clientId);
    return progressSummary(assignments, logs, this.measuredOf, this.today());
  }

  // ---------- comments ----------

  async listComments(assignmentId: Id): Promise<Comment[]> {
    await this.wait();
    const a = this.assignmentFor(assignmentId, 'view');
    return structuredClone(this.db.comments.filter((c) => c.assignmentId === a.id).sort((x, y) => x.createdAt.localeCompare(y.createdAt)));
  }

  async addComment(assignmentId: Id, body: string): Promise<Comment> {
    await this.wait();
    const me = this.profile();
    const a = this.assignmentFor(assignmentId, 'view');
    if (!body.trim()) throw new ServiceError('invalid', 'Write a comment first.');
    const comment: Comment = {
      id: this.id('cm'),
      assignmentId: a.id,
      authorId: me.id,
      authorName: me.name,
      authorRole: me.role,
      body: body.trim(),
      createdAt: new Date().toISOString(),
    };
    this.db.comments.push(comment);
    this.persist();
    return structuredClone(comment);
  }

  // ---------- packages ----------

  async listPackages(clientId: Id): Promise<Package[]> {
    await this.wait();
    this.clientAccess(clientId);
    // Newest first: the screen shows the most recently added package that has not expired.
    return this.db.packages
      .filter((p) => p.clientId === clientId)
      .map((p) => this.withDerived(p))
      .reverse();
  }

  async savePackage(p: PackageInput): Promise<Package> {
    await this.wait();
    const me = this.coach();
    this.clientAccess(p.clientId);
    if (!p.name.trim()) throw new ServiceError('invalid', 'Give the package a name.');
    if (p.sessionsIncluded < 1) throw new ServiceError('invalid', 'A package needs at least one session.');
    if (p.sessionsUsed < 0 || p.sessionsUsed > p.sessionsIncluded) throw new ServiceError('invalid', 'Sessions used cannot exceed sessions included.');
    const saved = {
      id: p.id || this.id('pk'),
      workspaceId: me.workspaceId,
      clientId: p.clientId,
      name: p.name.trim(),
      sessionsIncluded: p.sessionsIncluded,
      sessionsUsed: p.sessionsUsed,
      expiresOn: p.expiresOn,
      paymentReceived: p.paymentReceived,
    };
    const i = this.db.packages.findIndex((x) => x.id === saved.id);
    if (i >= 0) this.db.packages[i] = saved;
    else this.db.packages.push(saved);
    this.persist();
    return this.withDerived(saved);
  }
}
