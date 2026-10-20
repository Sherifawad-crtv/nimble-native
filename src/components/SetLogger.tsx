import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { t } from '../i18n';
import { formatClock } from '../timer/engine';
import type { ItemTarget, MeasuredAs, SetResult } from '../types';
import { Button, Icon, T, color, font, success, tap } from '../ui';

interface Row {
  values: string[];
  done: boolean;
}

const COLUMNS: Record<MeasuredAs, string[]> = {
  reps: [t('log.col.reps')],
  weight_reps: [t('log.col.kg'), t('log.col.reps')],
  time: [t('log.col.time')],
  distance: [t('log.col.meters')],
  rounds: [t('log.col.rounds')],
};

/** Unit shown inside each field, so the row reads "80 kg · 6x" without column captions. */
const UNITS: Record<MeasuredAs, string[]> = {
  reps: [t('log.unit.reps')],
  weight_reps: [t('log.unit.kg'), t('log.unit.reps')],
  time: [''],
  distance: [t('log.unit.meters')],
  rounds: [t('log.unit.rounds')],
};

const parseSeconds = (s: string): number => {
  const [m, sec] = s.includes(':') ? s.split(':') : ['0', s];
  return (parseInt(m ?? '0', 10) || 0) * 60 + (parseInt(sec ?? '0', 10) || 0);
};
const num = (s: string) => parseFloat(s.replace(',', '.'));

function toResult(measured: MeasuredAs, v: string[]): SetResult | null {
  const [a = '', b = ''] = v;
  switch (measured) {
    case 'weight_reps': {
      const kg = num(a);
      const reps = parseInt(b, 10);
      return Number.isNaN(kg) && Number.isNaN(reps) ? null : { ...(Number.isNaN(kg) ? {} : { load: `${kg} kg` }), ...(Number.isNaN(reps) ? {} : { reps }) };
    }
    case 'time':
      return a.trim() ? { durationSec: parseSeconds(a) } : null;
    case 'distance':
      return a.trim() ? { distanceM: num(a) } : null;
    case 'reps':
    case 'rounds':
      return a.trim() ? { reps: parseInt(a, 10) } : null;
  }
}

function fromResult(measured: MeasuredAs, r: SetResult): string[] {
  switch (measured) {
    case 'weight_reps':
      return [String(parseFloat(r.load ?? '') || ''), r.reps === undefined ? '' : String(r.reps)];
    case 'time':
      return [r.durationSec === undefined ? '' : formatClock(r.durationSec)];
    case 'distance':
      return [r.distanceM === undefined ? '' : String(r.distanceM)];
    case 'reps':
    case 'rounds':
      return [r.reps === undefined ? '' : String(r.reps)];
  }
}

/** Placeholder values taken from the coach's target so a tap on "done" can log it as planned. */
function targetValues(measured: MeasuredAs, target: ItemTarget): string[] {
  switch (measured) {
    case 'weight_reps':
      return [String(parseFloat(target.loadNote ?? '') || ''), target.reps ? String(target.reps) : ''];
    case 'time':
      return [target.durationSec ? formatClock(target.durationSec) : ''];
    case 'distance':
      return [target.distanceM ? String(target.distanceM) : ''];
    case 'reps':
    case 'rounds':
      return [target.reps ? String(target.reps) : ''];
  }
}

interface Props {
  name: string;
  measuredAs: MeasuredAs;
  target: ItemTarget;
  saved: SetResult[];
  disabled?: boolean;
  onChange: (sets: SetResult[]) => void;
  onSetDone?: (restSec: number) => void;
}

/** Log inputs for one exercise, matching how the coach measures it. */
export function SetLogger({ name, measuredAs, target, saved, disabled, onChange, onSetDone }: Props) {
  const planned = Math.max(target.sets ?? 1, saved.length);
  const [rows, setRows] = useState<Row[]>(() =>
    Array.from({ length: planned }, (_, i) => {
      const s = saved[i];
      return s ? { values: fromResult(measuredAs, s), done: true } : { values: [], done: false };
    }),
  );
  const hints = targetValues(measuredAs, target);
  const cols = COLUMNS[measuredAs];
  const units = UNITS[measuredAs];
  const current = rows.findIndex((r) => !r.done);

  const commit = (next: Row[]) => {
    setRows(next);
    onChange(next.filter((r) => r.done).flatMap((r) => toResult(measuredAs, r.values) ?? []));
  };

  const edit = (i: number, k: number, value: string) => commit(rows.map((r, j) => (j === i ? { ...r, values: Object.assign([...r.values], { [k]: value }) } : r)));

  const toggle = (i: number) => {
    const row = rows[i];
    if (!row) return;
    const done = !row.done;
    const values = done ? cols.map((_, k) => (row.values[k]?.trim() ? (row.values[k] as string) : (hints[k] ?? ''))) : row.values;
    commit(rows.map((r, j) => (j === i ? { values, done } : r)));
    if (done) {
      success();
      if (target.restSec && i < rows.length - 1) onSetDone?.(target.restSec);
    }
  };

  return (
    <View style={{ gap: 8 }}>
      {rows.map((row, i) => (
        <View key={i} style={[styles.set, row.done && { backgroundColor: 'rgba(201,247,17,0.12)' }]}>
          <View style={[styles.n, i === current && !disabled && { backgroundColor: color.brand }]}>
            {i === current && !disabled ? null : (
              <T variant="chip" tone="muted">
                {i + 1}
              </T>
            )}
          </View>
          {cols.map((c, k) => (
            <View key={c} style={styles.pill}>
              <TextInput
                style={styles.input}
                keyboardType={measuredAs === 'time' ? 'numbers-and-punctuation' : 'decimal-pad'}
                value={row.values[k] ?? ''}
                placeholder={hints[k] || '0'}
                placeholderTextColor={color.faint}
                editable={!disabled}
                selectTextOnFocus
                onChangeText={(v) => edit(i, k, v)}
                accessibilityLabel={t('log.setField', { name, set: i + 1, field: c })}
              />
              {units[k] ? (
                <T variant="caption" tone="muted">
                  {units[k]}
                </T>
              ) : null}
            </View>
          ))}
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: row.done, disabled }}
            accessibilityLabel={t('log.setDone', { name, set: i + 1 })}
            disabled={disabled}
            onPress={() => {
              tap();
              toggle(i);
            }}
            style={[styles.check, row.done && { backgroundColor: color.brand }]}
          >
            <Icon name="check" size={24} tint={row.done ? color.onBrand : color.muted} />
          </Pressable>
        </View>
      ))}
      {!disabled && (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Button size="md" variant="secondary" icon="plus" onPress={() => setRows([...rows, { values: [], done: false }])}>
              {t('log.addSet')}
            </Button>
          </View>
          {rows.length > 1 && (
            <View style={{ flex: 1 }}>
              <Button size="md" variant="destructive" onPress={() => commit(rows.slice(0, -1))}>
                {t('log.removeLast')}
              </Button>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  set: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 6, borderRadius: 32, backgroundColor: color.surfaceControl },
  n: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surfaceRaised },
  pill: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4, height: 48, borderRadius: 24, backgroundColor: color.fieldBg, paddingHorizontal: 14 },
  input: { flex: 1, color: color.ink, fontFamily: font.sansSemi, fontSize: 18, padding: 0 },
  check: { width: 48, height: 48, borderRadius: 24, backgroundColor: color.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
});
