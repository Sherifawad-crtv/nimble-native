import { t, tp } from '../i18n';
import { formatClock } from '../timer/engine';
import type { SetResult, TimerResult } from '../types';

export function formatSet(s: SetResult): string {
  if (s.load !== undefined) return s.reps !== undefined ? `${s.reps} × ${s.load}` : s.load;
  if (s.durationSec !== undefined) return formatClock(s.durationSec);
  if (s.distanceM !== undefined) return `${s.distanceM} m`;
  if (s.reps !== undefined) return tp('unit.rep', s.reps);
  return '–';
}

export function formatTimerResult(r: TimerResult): string {
  switch (r.kind) {
    case 'amrap':
      return r.extraReps ? t('result.amrap.extra', { rounds: r.rounds, reps: r.extraReps }) : tp('result.amrap', r.rounds);
    case 'for_time':
      return r.capped ? t('result.forTime.capped', { time: formatClock(r.finishSec) }) : t('result.forTime', { time: formatClock(r.finishSec) });
    default:
      return r.completed ? t('result.completed') : t('result.stopped');
  }
}
