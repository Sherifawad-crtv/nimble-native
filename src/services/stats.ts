import { addDays, daysBetween, startOfWeek } from '../lib/date';
import type {
  Assignment,
  ClientOverview,
  CoachOverview,
  ExerciseProgress,
  ISODate,
  MeasuredAs,
  Package,
  PersonalRecord,
  Profile,
  Program,
  ProgramProgress,
  ProgressSummary,
  SetResult,
  WorkoutLog,
} from '../types';
import { formatClock } from '../timer/engine';

interface Best {
  value: number;
  label: string;
}

const loadOf = (s: SetResult) => parseFloat(/[\d.]+/.exec(s.load ?? '')?.[0] ?? '0');

function bestOfSet(measured: MeasuredAs, s: SetResult): Best | null {
  switch (measured) {
    case 'weight_reps': {
      const load = loadOf(s);
      return load > 0 ? { value: load * 1000 + (s.reps ?? 0), label: `${s.reps ?? 1} × ${s.load}` } : null;
    }
    case 'reps':
      return s.reps ? { value: s.reps, label: `${s.reps} reps` } : null;
    case 'rounds':
      return s.reps ? { value: s.reps, label: `${s.reps} rounds` } : null;
    case 'time':
      return s.durationSec ? { value: s.durationSec, label: formatClock(s.durationSec) } : null;
    case 'distance':
      return s.distanceM ? { value: s.distanceM, label: `${s.distanceM} m` } : null;
  }
}

const UNITS: Record<MeasuredAs, string> = { weight_reps: 'kg', reps: 'reps', rounds: 'rounds', time: 's', distance: 'm' };

function chartValue(measured: MeasuredAs, s: SetResult): number {
  return measured === 'weight_reps' ? loadOf(s) : measured === 'time' ? (s.durationSec ?? 0) : measured === 'distance' ? (s.distanceM ?? 0) : (s.reps ?? 0);
}

interface Entry {
  exerciseId: string;
  exerciseName: string;
  measured: MeasuredAs;
  date: ISODate;
  sets: SetResult[];
}

function entriesFor(
  assignments: Assignment[],
  logs: WorkoutLog[],
  measuredOf: (exerciseId: string) => MeasuredAs,
): Entry[] {
  const out: Entry[] = [];
  for (const log of logs) {
    if (!log.completedAt) continue;
    const a = assignments.find((x) => x.id === log.assignmentId);
    if (!a) continue;
    for (const b of a.workout.blocks) {
      for (const it of b.items) {
        const result = log.itemResults.find((r) => r.itemId === it.id);
        if (result) out.push({ exerciseId: it.exerciseId, exerciseName: it.exerciseName, measured: measuredOf(it.exerciseId), date: a.date, sets: result.sets });
      }
    }
  }
  return out.sort((x, y) => x.date.localeCompare(y.date));
}

export function personalRecords(
  assignments: Assignment[],
  logs: WorkoutLog[],
  measuredOf: (exerciseId: string) => MeasuredAs,
): PersonalRecord[] {
  const best = new Map<string, Best & { exerciseName: string; date: ISODate }>();
  for (const e of entriesFor(assignments, logs, measuredOf)) {
    for (const s of e.sets) {
      const b = bestOfSet(e.measured, s);
      const cur = best.get(e.exerciseId);
      if (b && (!cur || b.value > cur.value)) best.set(e.exerciseId, { ...b, exerciseName: e.exerciseName, date: e.date });
    }
  }
  return [...best.entries()]
    .map(([exerciseId, b]) => ({ exerciseId, exerciseName: b.exerciseName, label: b.label, achievedOn: b.date }))
    .sort((a, b) => b.achievedOn.localeCompare(a.achievedOn) || a.exerciseName.localeCompare(b.exerciseName));
}

export function exerciseProgress(
  assignments: Assignment[],
  logs: WorkoutLog[],
  measuredOf: (exerciseId: string) => MeasuredAs,
): ExerciseProgress[] {
  const by = new Map<string, ExerciseProgress>();
  for (const e of entriesFor(assignments, logs, measuredOf)) {
    const value = Math.max(0, ...e.sets.map((s) => chartValue(e.measured, s)));
    if (value <= 0) continue;
    const entry = by.get(e.exerciseId) ?? { exerciseId: e.exerciseId, exerciseName: e.exerciseName, unit: UNITS[e.measured], points: [] };
    entry.points.push({ date: e.date, value });
    by.set(e.exerciseId, entry);
  }
  return [...by.values()].sort((a, b) => b.points.length - a.points.length || a.exerciseName.localeCompare(b.exerciseName));
}

const SUMMARY_DAYS = 28;

/** Consistency over the last four weeks. */
/** Sum of reps × load over every completed weighted set, all time. */
export function weightLifted(assignments: Assignment[], logs: WorkoutLog[], measuredOf: (exerciseId: string) => MeasuredAs): number {
  let total = 0;
  for (const e of entriesFor(assignments, logs, measuredOf)) {
    if (e.measured !== 'weight_reps') continue;
    for (const s of e.sets) total += loadOf(s) * (s.reps ?? 0);
  }
  return Math.round(total);
}

/** Consecutive weeks with a completed workout. A week still in progress without one does not break the run. */
export function weekStreak(assignments: Assignment[], today: ISODate): number {
  const weeks = new Set(assignments.filter((a) => a.status === 'completed').map((a) => startOfWeek(a.date, 1)));
  let week = startOfWeek(today, 1);
  if (!weeks.has(week)) week = addDays(week, -7);
  let n = 0;
  while (weeks.has(week)) {
    n++;
    week = addDays(week, -7);
  }
  return n;
}

export function progressSummary(
  assignments: Assignment[],
  logs: WorkoutLog[],
  measuredOf: (exerciseId: string) => MeasuredAs,
  today: ISODate,
): ProgressSummary {
  const to = today;
  const from = addDays(to, -(SUMMARY_DAYS - 1));
  const inWindow = assignments.filter((a) => a.date >= from && a.date <= to);
  const ids = new Set(inWindow.map((a) => a.id));
  const completed = inWindow.filter((a) => a.status === 'completed').length;
  const setsLogged = logs.filter((l) => ids.has(l.assignmentId)).reduce((n, l) => n + l.itemResults.reduce((m, r) => m + r.sets.length, 0), 0);
  const records = personalRecords(assignments, logs, measuredOf).filter((r) => r.achievedOn >= from && r.achievedOn <= to).length;
  return {
    from,
    to,
    assigned: inWindow.length,
    completed,
    completionPct: inWindow.length ? Math.round((completed / inWindow.length) * 100) : 0,
    setsLogged,
    personalRecords: records,
    weightLiftedKg: weightLifted(assignments, logs, measuredOf),
    streakWeeks: weekStreak(assignments, today),
  };
}

const EXPIRING_WITHIN_DAYS = 14;

/** Sessions left and whether the package is active, expiring soon or expired. */
export function withPackageState(p: Omit<Package, 'sessionsRemaining' | 'state'>, today: ISODate): Package {
  const left = daysBetween(today, p.expiresOn);
  return {
    ...p,
    sessionsRemaining: Math.max(0, p.sessionsIncluded - p.sessionsUsed),
    state: left < 0 ? 'expired' : left <= EXPIRING_WITHIN_DAYS ? 'expiring' : 'active',
  };
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const LOW_SESSIONS = 2;

/** Where one client is in their current program: the program with assignments nearest to today. */
export function programProgress(assignments: Assignment[], programs: Program[], today: ISODate): ProgramProgress | null {
  const byProgram = new Map<string, Assignment[]>();
  for (const a of assignments) if (a.programId) byProgram.set(a.programId, [...(byProgram.get(a.programId) ?? []), a]);
  let best: { id: string; list: Assignment[]; start: ISODate; end: ISODate } | null = null;
  for (const [id, list] of byProgram) {
    const dates = list.map((a) => a.date).sort();
    const start = dates[0] as ISODate;
    const end = dates[dates.length - 1] as ISODate;
    // Prefer the program running today, else the one starting next, else the one that ended most recently.
    const rank = (s: ISODate, e: ISODate) => (s <= today && e >= today ? 0 : s > today ? 1 + daysBetween(today, s) : 100_000 + daysBetween(e, today));
    if (!best || rank(start, end) < rank(best.start, best.end)) best = { id, list, start, end };
  }
  if (!best) return null;
  const span = daysBetween(best.start, best.end) + 1;
  const elapsed = daysBetween(best.start, today) + 1;
  const weeks = Math.max(1, Math.ceil(span / 7));
  return {
    programId: best.id,
    title: programs.find((p) => p.id === best.id)?.title ?? '',
    startsOn: best.start,
    endsOn: best.end,
    state: today < best.start ? 'upcoming' : today > best.end ? 'finished' : 'active',
    week: clamp(Math.floor((elapsed - 1) / 7) + 1, 1, weeks),
    weeks,
    percent: clamp(Math.round((elapsed / span) * 100), 0, 100),
    sessionsDone: best.list.filter((a) => a.status === 'completed').length,
    sessionsTotal: best.list.length,
  };
}

/** The coach's home numbers. `packages` are newest first, so the first one per client is the latest. */
export function coachOverview(clients: Profile[], assignments: Assignment[], programs: Program[], packages: Package[], today: ISODate): CoachOverview {
  const weekAgo = addDays(today, -6);
  const latest = new Map<string, Package>();
  for (const p of packages) if (!latest.has(p.clientId)) latest.set(p.clientId, p);
  const perClient: ClientOverview[] = clients.map((c) => {
    const own = assignments.filter((a) => a.clientId === c.id);
    const done = own.filter((a) => a.status === 'completed' && a.date <= today).map((a) => a.date).sort();
    const pkg = latest.get(c.id);
    return {
      clientId: c.id,
      program: programProgress(own, programs, today),
      lastActiveOn: done[done.length - 1] ?? null,
      package: pkg ? { name: pkg.name, sessionsRemaining: pkg.sessionsRemaining, sessionsIncluded: pkg.sessionsIncluded, state: pkg.state, expiresOn: pkg.expiresOn } : null,
      needsRenewal: !!pkg && (pkg.state !== 'active' || pkg.sessionsRemaining <= LOW_SESSIONS),
    };
  });
  const ids = new Set(clients.map((c) => c.id));
  const todays = assignments.filter((a) => a.date === today && ids.has(a.clientId));
  return {
    clients: clients.length,
    activeThisWeek: perClient.filter((c) => c.lastActiveOn !== null && c.lastActiveOn >= weekAgo && c.lastActiveOn <= today).length,
    todayPlanned: todays.length,
    todayDone: todays.filter((a) => a.status === 'completed').length,
    packagesToRenew: perClient.filter((c) => c.needsRenewal).length,
    perClient,
  };
}
