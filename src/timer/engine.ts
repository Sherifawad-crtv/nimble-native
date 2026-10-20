// Pure timer logic. No UI, no timers, no globals: every function takes the current
// time as an argument, so state is always derived from the real clock and survives
// throttling, backgrounding and a locked phone.

import type { BlockSettings, TimerResult } from '../types';

export type TimerFormat = 'amrap' | 'emom' | 'for_time' | 'tabata' | 'custom' | 'rest';
export type SegmentKind = 'ready' | 'work' | 'rest';

export interface Segment {
  kind: SegmentKind;
  durationSec: number;
  /** Coach-written label (custom steps). Empty for the built-in phases, which the UI names by kind. */
  label: string;
  /** 1-based round (or EMOM interval) this segment belongs to. */
  round?: number;
}

export interface TimerPlan {
  format: TimerFormat;
  /** `down` counts the current segment down, `up` counts total elapsed up (For Time). */
  direction: 'down' | 'up';
  segments: Segment[];
  totalSec: number;
  /** Target rounds, shown by the round counter (For Time). */
  rounds?: number;
  capSec?: number;
}

export const DEFAULT_COUNTDOWN_SEC = 10;
export const FINAL_SECONDS = 10;
export const TICK_SECONDS = [3, 2, 1] as const;

const ready = (countdownSec: number): Segment[] =>
  countdownSec > 0 ? [{ kind: 'ready', durationSec: countdownSec, label: '' }] : [];

const sum = (segments: Segment[]): number => segments.reduce((t, s) => t + s.durationSec, 0);

export function buildPlan(
  settings: Exclude<BlockSettings, { type: 'standard' }>,
  countdownSec: number = DEFAULT_COUNTDOWN_SEC,
): TimerPlan {
  switch (settings.type) {
    case 'amrap': {
      const segments: Segment[] = [...ready(countdownSec), { kind: 'work', durationSec: settings.capSec, label: '' }];
      return { format: 'amrap', direction: 'down', segments, totalSec: sum(segments), capSec: settings.capSec };
    }
    case 'emom': {
      const intervals = Math.max(1, Math.floor((settings.totalMin * 60) / settings.intervalSec));
      const segments: Segment[] = [
        ...ready(countdownSec),
        ...Array.from({ length: intervals }, (_, i): Segment => ({
          kind: 'work',
          durationSec: settings.intervalSec,
          label: '',
          round: i + 1,
        })),
      ];
      return { format: 'emom', direction: 'down', segments, totalSec: sum(segments), rounds: intervals };
    }
    case 'for_time': {
      const segments: Segment[] = [
        ...ready(countdownSec),
        // No cap: the work segment is open-ended and only ends when the athlete finishes.
        { kind: 'work', durationSec: settings.capSec ?? Number.POSITIVE_INFINITY, label: '' },
      ];
      return {
        format: 'for_time',
        direction: 'up',
        segments,
        totalSec: sum(segments),
        rounds: settings.rounds,
        capSec: settings.capSec,
      };
    }
    case 'tabata': {
      const rounds = Array.from({ length: settings.rounds }, (_, i): Segment[] => [
        { kind: 'work', durationSec: settings.workSec, label: '', round: i + 1 },
        { kind: 'rest', durationSec: settings.restSec, label: '', round: i + 1 },
      ]).flat();
      const segments = [...ready(countdownSec), ...rounds];
      return { format: 'tabata', direction: 'down', segments, totalSec: sum(segments), rounds: settings.rounds };
    }
    case 'custom': {
      const segments: Segment[] = [
        ...ready(countdownSec),
        ...settings.steps.map((s, i): Segment => ({ kind: s.kind, durationSec: s.durationSec, label: s.label, round: i + 1 })),
      ];
      return { format: 'custom', direction: 'down', segments, totalSec: sum(segments) };
    }
  }
}

export function buildRestPlan(restSec: number): TimerPlan {
  const segments: Segment[] = [{ kind: 'rest', durationSec: restSec, label: '' }];
  return { format: 'rest', direction: 'down', segments, totalSec: restSec };
}

// ---------- clock ----------

export interface Clock {
  startedAt: number | null;
  pausedAt: number | null;
  pausedMs: number;
  /** Set when the athlete ends a For Time / open-ended timer by hand. */
  finishedAt: number | null;
}

export const idleClock = (): Clock => ({ startedAt: null, pausedAt: null, pausedMs: 0, finishedAt: null });

export const start = (_: Clock, now: number): Clock => ({ startedAt: now, pausedAt: null, pausedMs: 0, finishedAt: null });

export const pause = (c: Clock, now: number): Clock =>
  c.startedAt === null || c.pausedAt !== null || c.finishedAt !== null ? c : { ...c, pausedAt: now };

export const resume = (c: Clock, now: number): Clock =>
  c.pausedAt === null ? c : { ...c, pausedAt: null, pausedMs: c.pausedMs + (now - c.pausedAt) };

export const finish = (c: Clock, now: number): Clock =>
  c.startedAt === null || c.finishedAt !== null ? c : { ...c, finishedAt: c.pausedAt ?? now };

export function elapsedMs(c: Clock, now: number): number {
  if (c.startedAt === null) return 0;
  const end = c.finishedAt ?? c.pausedAt ?? now;
  return Math.max(0, end - c.startedAt - c.pausedMs);
}

// ---------- snapshot ----------

export type TimerStatus = 'ready' | 'running' | 'paused' | 'finished';

export interface TimerSnapshot {
  status: TimerStatus;
  elapsedSec: number;
  segmentIndex: number;
  segment: Segment;
  /** Whole seconds left in the current segment, rounded up (0 only when finished). */
  segmentRemainingSec: number;
  totalRemainingSec: number;
  /** The number to show: seconds elapsed for up-timers, segment seconds remaining otherwise. */
  displaySec: number;
  /** 0..1 progress through the current segment (or through the cap for up-timers). */
  progress: number;
  /** True in the last FINAL_SECONDS of the timer (or of the get-ready countdown). */
  final: boolean;
  /** Why a finished timer ended. */
  endedBy: 'time' | 'manual' | null;
}

const lastIndex = (plan: TimerPlan) => plan.segments.length - 1;

function segmentAt(plan: TimerPlan, elapsedSec: number): { index: number; start: number } {
  let start = 0;
  for (let i = 0; i < plan.segments.length; i++) {
    const end = start + (plan.segments[i] as Segment).durationSec;
    if (elapsedSec < end) return { index: i, start };
    start = end;
  }
  return { index: lastIndex(plan), start: start - (plan.segments[lastIndex(plan)] as Segment).durationSec };
}

export function snapshot(plan: TimerPlan, clock: Clock, now: number): TimerSnapshot {
  const ms = elapsedMs(clock, now);
  const elapsed = ms / 1000;
  const timeUp = plan.totalSec > 0 && elapsed >= plan.totalSec;
  const manual = clock.finishedAt !== null;
  const finished = clock.startedAt !== null && (timeUp || manual);

  const status: TimerStatus =
    clock.startedAt === null ? 'ready' : finished ? 'finished' : clock.pausedAt !== null ? 'paused' : 'running';

  const capped = finished ? Math.min(elapsed, plan.totalSec || elapsed) : elapsed;
  const { index, start: segStart } = segmentAt(plan, capped);
  const segment = plan.segments[index] as Segment;
  const intoSegment = Math.min(Math.max(capped - segStart, 0), segment.durationSec);
  const segmentRemainingSec = finished ? 0 : Math.ceil(segment.durationSec - intoSegment);
  const totalRemainingSec = finished ? 0 : Math.max(0, Math.ceil(plan.totalSec - elapsed));

  const isReady = segment.kind === 'ready';
  const upTimer = plan.direction === 'up' && !isReady;
  const displaySec = upTimer ? Math.floor(capped - readySec(plan)) : segmentRemainingSec;
  const progress =
    upTimer && plan.capSec ? Math.min(1, Math.max(0, (capped - readySec(plan)) / plan.capSec)) : segment.durationSec ? intoSegment / segment.durationSec : 0;

  const final =
    status === 'running' || status === 'paused'
      ? isReady
        ? segmentRemainingSec <= FINAL_SECONDS
        : plan.direction === 'down' && totalRemainingSec <= FINAL_SECONDS
      : false;

  return {
    status,
    elapsedSec: Math.floor(capped),
    segmentIndex: index,
    segment,
    segmentRemainingSec,
    totalRemainingSec,
    displaySec: Math.max(0, displaySec),
    progress,
    final,
    endedBy: finished ? (manual ? 'manual' : 'time') : null,
  };
}

/** Seconds of get-ready countdown at the start of a plan. */
export function readySec(plan: TimerPlan): number {
  const first = plan.segments[0];
  return first && first.kind === 'ready' ? first.durationSec : 0;
}

// ---------- cues ----------

export type CueType = 'segment_start' | 'tick' | 'halfway' | 'finish';

export interface Cue {
  type: CueType;
  /** Elapsed milliseconds at which the cue fires. */
  atMs: number;
  segmentIndex: number;
  /** Seconds left in the segment, for ticks. */
  secondsLeft?: number;
}

/** Every cue that falls in (fromMs, toMs] of elapsed time, oldest first. */
export function cuesBetween(plan: TimerPlan, fromMs: number, toMs: number): Cue[] {
  if (toMs <= fromMs) return [];
  const cues: Cue[] = [];
  const inRange = (t: number) => t > fromMs && t <= toMs;
  let start = 0;
  plan.segments.forEach((segment, i) => {
    const startMs = start * 1000;
    const endMs = (start + segment.durationSec) * 1000;
    const sleeps = plan.direction === 'up' && !plan.capSec && segment.kind === 'work';

    if (i > 0 && segment.kind !== 'ready' && inRange(startMs)) cues.push({ type: 'segment_start', atMs: startMs, segmentIndex: i });
    if (!sleeps) {
      for (const s of TICK_SECONDS) {
        const t = endMs - s * 1000;
        if (segment.durationSec > s && inRange(t)) cues.push({ type: 'tick', atMs: t, segmentIndex: i, secondsLeft: s });
      }
    }
    start += segment.durationSec;
  });
  // Single long work segment (AMRAP, capped For Time): remind the athlete at the halfway point.
  const work = plan.segments.filter((s) => s.kind === 'work');
  const only = work.length === 1 ? (work[0] as Segment) : undefined;
  if (only && Number.isFinite(only.durationSec) && only.durationSec >= 120) {
    const t = (readySec(plan) + only.durationSec / 2) * 1000;
    if (inRange(t)) cues.push({ type: 'halfway', atMs: t, segmentIndex: plan.segments.indexOf(only) });
  }
  if (Number.isFinite(plan.totalSec) && plan.totalSec > 0 && inRange(plan.totalSec * 1000)) {
    cues.push({ type: 'finish', atMs: plan.totalSec * 1000, segmentIndex: lastIndex(plan) });
  }
  return cues.sort((a, b) => a.atMs - b.atMs);
}

// ---------- results ----------

export interface CounterState {
  rounds: number;
  extraReps: number;
}

export function buildResult(plan: TimerPlan, snap: TimerSnapshot, counter: CounterState): TimerResult | null {
  if (snap.status !== 'finished') return null;
  switch (plan.format) {
    case 'amrap':
      return { kind: 'amrap', rounds: counter.rounds, extraReps: counter.extraReps };
    case 'for_time': {
      const finishSec = Math.max(0, Math.round(snap.elapsedSec - readySec(plan)));
      return { kind: 'for_time', finishSec, capped: snap.endedBy === 'time' };
    }
    case 'emom':
    case 'tabata':
    case 'custom':
      return { kind: plan.format, completed: snap.endedBy === 'time' };
    case 'rest':
      return null;
  }
}

export function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(s / 60);
  const mm = String(m).padStart(2, '0');
  return `${mm}:${String(s % 60).padStart(2, '0')}`;
}
