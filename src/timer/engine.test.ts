import { describe, expect, it } from 'vitest';
import {
  buildPlan,
  buildRestPlan,
  buildResult,
  cuesBetween,
  finish,
  formatClock,
  idleClock,
  pause,
  resume,
  snapshot,
  start,
} from './engine';

const T0 = 1_000_000;
const at = (sec: number) => T0 + sec * 1000;
const running = () => start(idleClock(), T0);

describe('clock', () => {
  it('is ready before start', () => {
    const plan = buildPlan({ type: 'amrap', capSec: 60 }, 0);
    expect(snapshot(plan, idleClock(), at(5)).status).toBe('ready');
  });

  it('derives elapsed time from the real clock, not from ticks', () => {
    const plan = buildPlan({ type: 'amrap', capSec: 600 }, 0);
    // Page throttled for 4 minutes: one read still gives the right answer.
    const snap = snapshot(plan, running(), at(240));
    expect(snap.status).toBe('running');
    expect(snap.segmentRemainingSec).toBe(360);
  });

  it('stops counting while paused and resumes without drift', () => {
    const plan = buildPlan({ type: 'amrap', capSec: 600 }, 0);
    let c = running();
    c = pause(c, at(100));
    expect(snapshot(plan, c, at(500)).status).toBe('paused');
    expect(snapshot(plan, c, at(500)).segmentRemainingSec).toBe(500);
    c = resume(c, at(500));
    expect(snapshot(plan, c, at(530)).segmentRemainingSec).toBe(470);
  });

  it('ignores pause when not running and resume when not paused', () => {
    const c = running();
    expect(resume(c, at(5))).toBe(c);
    const p = pause(c, at(5));
    expect(pause(p, at(9))).toBe(p);
  });
});

describe('AMRAP', () => {
  const plan = buildPlan({ type: 'amrap', capSec: 720 });
  it('runs a get-ready countdown then the work segment', () => {
    expect(snapshot(plan, running(), at(3)).segment.kind).toBe('ready');
    expect(snapshot(plan, running(), at(3)).displaySec).toBe(7);
    const work = snapshot(plan, running(), at(10));
    expect(work.segment.kind).toBe('work');
    expect(work.displaySec).toBe(720);
  });
  it('finishes at the cap and reports rounds plus extra reps', () => {
    const snap = snapshot(plan, running(), at(10 + 720));
    expect(snap.status).toBe('finished');
    expect(snap.endedBy).toBe('time');
    expect(buildResult(plan, snap, { rounds: 7, extraReps: 4 })).toEqual({ kind: 'amrap', rounds: 7, extraReps: 4 });
  });
  it('flags the last ten seconds', () => {
    expect(snapshot(plan, running(), at(10 + 700)).final).toBe(false);
    expect(snapshot(plan, running(), at(10 + 711)).final).toBe(true);
  });
  it('has no result until finished', () => {
    expect(buildResult(plan, snapshot(plan, running(), at(30)), { rounds: 1, extraReps: 0 })).toBeNull();
  });
});

describe('EMOM', () => {
  const plan = buildPlan({ type: 'emom', totalMin: 10, intervalSec: 60 }, 0);
  it('builds one segment per interval', () => {
    expect(plan.segments).toHaveLength(10);
    expect(plan.totalSec).toBe(600);
  });
  it('knows which interval it is in', () => {
    const snap = snapshot(plan, running(), at(185));
    expect(snap.segment.round).toBe(4);
    expect(snap.segmentRemainingSec).toBe(55);
  });
  it('handles intervals that do not divide evenly', () => {
    expect(buildPlan({ type: 'emom', totalMin: 5, intervalSec: 90 }, 0).segments).toHaveLength(3);
  });
  it('reports completed', () => {
    const snap = snapshot(plan, running(), at(600));
    expect(buildResult(plan, snap, { rounds: 0, extraReps: 0 })).toEqual({ kind: 'emom', completed: true });
  });
  it('reports not completed when stopped early', () => {
    const c = finish(running(), at(120));
    const snap = snapshot(plan, c, at(900));
    expect(snap.endedBy).toBe('manual');
    expect(buildResult(plan, snap, { rounds: 0, extraReps: 0 })).toEqual({ kind: 'emom', completed: false });
  });
});

describe('For Time', () => {
  const capped = buildPlan({ type: 'for_time', rounds: 5, capSec: 900 }, 5);
  const open = buildPlan({ type: 'for_time', rounds: 3 }, 5);

  it('counts up from zero after the get-ready countdown', () => {
    expect(snapshot(open, running(), at(2)).segment.kind).toBe('ready');
    expect(snapshot(open, running(), at(5 + 83)).displaySec).toBe(83);
  });
  it('never ends by itself when there is no cap', () => {
    const snap = snapshot(open, running(), at(5 + 36_000));
    expect(snap.status).toBe('running');
  });
  it('records the finish time when the athlete stops it', () => {
    const c = finish(running(), at(5 + 761));
    const snap = snapshot(open, c, at(5 + 5000));
    expect(buildResult(open, snap, { rounds: 3, extraReps: 0 })).toEqual({ kind: 'for_time', finishSec: 761, capped: false });
  });
  it('ends at the cap and marks the result capped', () => {
    const snap = snapshot(capped, running(), at(5 + 900 + 30));
    expect(snap.status).toBe('finished');
    expect(buildResult(capped, snap, { rounds: 4, extraReps: 0 })).toEqual({ kind: 'for_time', finishSec: 900, capped: true });
  });
});

describe('Tabata', () => {
  const plan = buildPlan({ type: 'tabata', workSec: 20, restSec: 10, rounds: 8 }, 0);
  it('alternates work and rest for every round', () => {
    expect(plan.segments).toHaveLength(16);
    expect(plan.totalSec).toBe(240);
    expect(snapshot(plan, running(), at(5)).segment.kind).toBe('work');
    expect(snapshot(plan, running(), at(25)).segment.kind).toBe('rest');
    expect(snapshot(plan, running(), at(31)).segment.round).toBe(2);
  });
  it('finishes after the last rest', () => {
    const snap = snapshot(plan, running(), at(240));
    expect(buildResult(plan, snap, { rounds: 0, extraReps: 0 })).toEqual({ kind: 'tabata', completed: true });
  });
});

describe('Custom', () => {
  const plan = buildPlan(
    {
      type: 'custom',
      steps: [
        { label: 'Row', kind: 'work', durationSec: 90 },
        { label: 'Breathe', kind: 'rest', durationSec: 30 },
        { label: 'Burpees', kind: 'work', durationSec: 60 },
      ],
    },
    0,
  );
  it('walks the steps in order with their own labels', () => {
    expect(snapshot(plan, running(), at(10)).segment.label).toBe('Row');
    expect(snapshot(plan, running(), at(100)).segment.label).toBe('Breathe');
    expect(snapshot(plan, running(), at(125)).segment.label).toBe('Burpees');
    expect(plan.totalSec).toBe(180);
  });
  it('finishes after the last step', () => {
    const snap = snapshot(plan, running(), at(180));
    expect(buildResult(plan, snap, { rounds: 0, extraReps: 0 })).toEqual({ kind: 'custom', completed: true });
  });
});

describe('rest timer', () => {
  const plan = buildRestPlan(90);
  it('counts down and finishes', () => {
    expect(snapshot(plan, running(), at(30)).displaySec).toBe(60);
    expect(snapshot(plan, running(), at(90)).status).toBe('finished');
    expect(buildResult(plan, snapshot(plan, running(), at(90)), { rounds: 0, extraReps: 0 })).toBeNull();
  });
});

describe('returning from the background', () => {
  const plan = buildPlan({ type: 'tabata', workSec: 20, restSec: 10, rounds: 8 }, 0);
  it('lands on the right segment after a long gap', () => {
    const snap = snapshot(plan, running(), at(147));
    expect(snap.segmentIndex).toBe(9);
    expect(snap.segment.kind).toBe('rest');
    expect(snap.segmentRemainingSec).toBe(3);
  });
  it('reports every cue missed while the screen was locked', () => {
    const missed = cuesBetween(plan, 0, 65_000).filter((c) => c.type === 'segment_start');
    expect(missed.map((c) => c.segmentIndex)).toEqual([1, 2, 3, 4]);
  });
  it('reports nothing for an empty or reversed range', () => {
    expect(cuesBetween(plan, 5000, 5000)).toEqual([]);
    expect(cuesBetween(plan, 9000, 1000)).toEqual([]);
  });
});

describe('cues', () => {
  it('ticks the last three seconds of a segment and signals finish', () => {
    const plan = buildPlan({ type: 'amrap', capSec: 30 }, 0);
    const cues = cuesBetween(plan, 0, 30_000);
    expect(cues.filter((c) => c.type === 'tick').map((c) => c.secondsLeft)).toEqual([3, 2, 1]);
    expect(cues.at(-1)?.type).toBe('finish');
  });
  it('counts down the get-ready segment', () => {
    const plan = buildPlan({ type: 'amrap', capSec: 60 }, 10);
    const ticks = cuesBetween(plan, 0, 10_000).filter((c) => c.type === 'tick');
    expect(ticks.map((c) => c.atMs)).toEqual([7000, 8000, 9000]);
  });
  it('adds a halfway reminder to long single-segment workouts only', () => {
    const amrap = buildPlan({ type: 'amrap', capSec: 600 }, 10);
    expect(cuesBetween(amrap, 0, 700_000).filter((c) => c.type === 'halfway').map((c) => c.atMs)).toEqual([310_000]);
    const short = buildPlan({ type: 'amrap', capSec: 60 }, 0);
    expect(cuesBetween(short, 0, 60_000).some((c) => c.type === 'halfway')).toBe(false);
    const emom = buildPlan({ type: 'emom', totalMin: 10, intervalSec: 60 }, 0);
    expect(cuesBetween(emom, 0, 600_000).some((c) => c.type === 'halfway')).toBe(false);
  });
  it('does not tick inside an open-ended For Time', () => {
    const plan = buildPlan({ type: 'for_time', rounds: 3 }, 0);
    expect(cuesBetween(plan, 0, 600_000)).toEqual([]);
    expect(cuesBetween(buildPlan({ type: 'for_time', rounds: 3 }, 0), 0, 600_000)).toEqual([]);
  });
});

describe('formatClock', () => {
  it('formats minutes and seconds', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(83)).toBe('01:23');
    expect(formatClock(3725)).toBe('62:05');
    expect(formatClock(-4)).toBe('00:00');
  });
});
