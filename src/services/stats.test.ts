import { describe, expect, it } from 'vitest';
import { coachOverview, programProgress, weekStreak } from './stats';
import type { Assignment, Package, Profile, Program } from '../types';

const done = (date: string) => ({ date, status: 'completed' }) as Assignment;

describe('weekStreak', () => {
  // 2026-10-14 is a Wednesday
  it('counts consecutive weeks', () => {
    expect(weekStreak([done('2026-10-13'), done('2026-10-06'), done('2026-09-29')], '2026-10-14')).toBe(3);
  });
  it('does not break on an empty current week', () => {
    expect(weekStreak([done('2026-10-06'), done('2026-09-30')], '2026-10-14')).toBe(2);
  });
  it('breaks on a skipped week', () => {
    expect(weekStreak([done('2026-10-13'), done('2026-09-29')], '2026-10-14')).toBe(1);
  });
  it('is zero without completed workouts', () => {
    expect(weekStreak([], '2026-10-14')).toBe(0);
  });
});

const inProgram = (programId: string, date: string, status = 'not_started', clientId = 'c1') => ({ id: `${programId}${date}`, clientId, programId, date, status }) as Assignment;
const programs = [{ id: 'p1', title: 'Block 2' }, { id: 'p2', title: 'Old' }] as Program[];

describe('programProgress', () => {
  // 2026-10-05 is a Monday: a four-week program ends 2026-11-01.
  const run = [inProgram('p1', '2026-10-05', 'completed'), inProgram('p1', '2026-10-12', 'completed'), inProgram('p1', '2026-10-19'), inProgram('p1', '2026-11-01')];
  it('reports the week and share of dates elapsed', () => {
    const p = programProgress(run, programs, '2026-10-14');
    expect(p).toMatchObject({ title: 'Block 2', state: 'active', week: 2, weeks: 4, percent: 36, sessionsDone: 2, sessionsTotal: 4 });
  });
  it('is finished after the last day and upcoming before the first', () => {
    expect(programProgress(run, programs, '2026-11-20')).toMatchObject({ state: 'finished', percent: 100, week: 4 });
    expect(programProgress(run, programs, '2026-10-01')).toMatchObject({ state: 'upcoming', percent: 0, week: 1 });
  });
  it('prefers the program running today', () => {
    const both = [...run, inProgram('p2', '2026-08-03'), inProgram('p2', '2026-08-30')];
    expect(programProgress(both, programs, '2026-10-14')?.programId).toBe('p1');
  });
  it('is null without a program', () => {
    expect(programProgress([{ date: '2026-10-14' } as Assignment], programs, '2026-10-14')).toBeNull();
  });
});

describe('coachOverview', () => {
  const clients = [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }] as Profile[];
  const asg = [
    { id: 'a', clientId: 'c1', date: '2026-10-14', status: 'completed' },
    { id: 'b', clientId: 'c2', date: '2026-10-14', status: 'not_started' },
    { id: 'c', clientId: 'c3', date: '2026-10-01', status: 'completed' },
  ] as Assignment[];
  const pkgs = [
    { clientId: 'c1', state: 'expiring', sessionsRemaining: 8 },
    { clientId: 'c1', state: 'expired', sessionsRemaining: 0 },
    { clientId: 'c2', state: 'active', sessionsRemaining: 9 },
    { clientId: 'c3', state: 'active', sessionsRemaining: 1 },
  ] as Package[];
  it('counts today, activity and packages to renew from each client\'s latest package', () => {
    expect(coachOverview(clients, asg, programs, pkgs, '2026-10-14')).toMatchObject({ clients: 3, activeThisWeek: 1, todayPlanned: 2, todayDone: 1, packagesToRenew: 2 });
  });
});
