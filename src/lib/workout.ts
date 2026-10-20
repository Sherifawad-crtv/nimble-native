import { t, tp } from '../i18n';
import { formatClock } from '../timer/engine';
import type { Block, BlockItem, BlockSettings, BlockType, ItemTarget, MeasuredAs } from '../types';

export const BLOCK_TYPES: BlockType[] = ['standard', 'amrap', 'emom', 'for_time', 'tabata', 'custom'];
export const MEASURED_AS: MeasuredAs[] = ['reps', 'weight_reps', 'time', 'distance', 'rounds'];

export function newId(prefix = 'tmp'): string {
  return `${prefix}_${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`;
}

export function defaultSettings(type: BlockType): BlockSettings {
  switch (type) {
    case 'standard':
      return { type };
    case 'amrap':
      return { type, capSec: 720 };
    case 'emom':
      return { type, totalMin: 10, intervalSec: 60 };
    case 'for_time':
      return { type, rounds: 3 };
    case 'tabata':
      return { type, workSec: 20, restSec: 10, rounds: 8 };
    case 'custom':
      return {
        type,
        steps: [
          { label: t('builder.step.work'), kind: 'work', durationSec: 40 },
          { label: t('builder.step.rest'), kind: 'rest', durationSec: 20 },
        ],
      };
  }
}

export const blockTypeLabel = (type: BlockType): string => t(`blockType.${type}`);
export const measuredLabel = (m: MeasuredAs): string => t(`measured.${m}`);

export const minutes = (sec: number): string => tp('unit.min', Math.round((sec / 60) * 10) / 10);

export function settingsSummary(s: BlockSettings): string {
  switch (s.type) {
    case 'standard':
      return t('block.summary.standard');
    case 'amrap':
      return t('block.summary.amrap', { min: minutes(s.capSec) });
    case 'emom':
      return t('block.summary.emom', { sec: s.intervalSec, min: s.totalMin });
    case 'for_time':
      return s.capSec ? t('block.summary.for_time_cap', { rounds: s.rounds, min: minutes(s.capSec) }) : t('block.summary.for_time', { rounds: s.rounds });
    case 'tabata':
      return t('block.summary.tabata', { work: s.workSec, rest: s.restSec, rounds: s.rounds });
    case 'custom':
      return tp('block.summary.custom', s.steps.length);
  }
}

export const isTimerBlock = (b: Block): boolean => b.settings.type !== 'standard';

/** One line describing what to do, e.g. "5 × 5 · 80% of 1RM · rest 02:00". */
export function targetText(target: ItemTarget, measured: MeasuredAs, timerBlock: boolean): string {
  const parts: string[] = [];
  const amount =
    measured === 'time' && target.durationSec
      ? formatClock(target.durationSec)
      : measured === 'distance' && target.distanceM
        ? `${target.distanceM} m`
        : target.reps
          ? String(target.reps)
          : '';
  if (!timerBlock && target.sets) parts.push(amount ? `${target.sets} × ${amount}` : tp('unit.set', target.sets));
  else if (amount) parts.push(timerBlock && measured === 'reps' ? tp('unit.rep', Number(amount)) : amount);
  if (target.loadNote) parts.push(target.loadNote);
  if (!timerBlock && target.restSec) parts.push(t('target.rest', { time: formatClock(target.restSec) }));
  if (target.notes) parts.push(target.notes);
  return parts.join(' · ');
}

export function itemLabel(item: BlockItem, measured: MeasuredAs, timerBlock: boolean): string {
  return targetText(item.target, measured, timerBlock);
}

export const cloneBlocks = (blocks: Block[]): Block[] => structuredClone(blocks);
