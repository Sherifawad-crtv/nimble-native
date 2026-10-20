import { Pressable, StyleSheet, View } from 'react-native';
import { addDays, parseISODate, startOfWeek, toISODate } from '../lib/date';
import type { ISODate } from '../types';
import { tap } from './haptics';
import { T } from './Text';
import { color } from './theme';

interface Props {
  mode: 'week' | 'month';
  /** First day of the visible month (month mode). */
  month?: ISODate;
  weekStart?: number;
  today: ISODate;
  selected: ISODate;
  /** Statuses of the workouts on each date, for the dots. */
  data: Record<string, string[]>;
  onSelect: (date: ISODate) => void;
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function Dots({ statuses, on }: { statuses: string[] | undefined; on: boolean }) {
  if (!statuses?.length) return <View style={styles.dotRow} />;
  const done = statuses.every((s) => s === 'completed');
  const skipped = statuses.every((s) => s === 'skipped');
  return (
    <View style={styles.dotRow}>
      {skipped ? (
        <View style={[styles.dash, { backgroundColor: on ? color.onBrand : color.muted }]} />
      ) : (
        <View style={[styles.dot, done ? { backgroundColor: on ? color.onBrand : color.brand } : { borderWidth: 1.5, borderColor: on ? color.onBrand : color.muted }]} />
      )}
    </View>
  );
}

/** A week strip or a month grid, with a dot under days that have workouts. */
export function Calendar({ mode, month, weekStart = 1, today, selected, data, onSelect }: Props) {
  let days: (ISODate | null)[];
  if (mode === 'week') {
    const start = startOfWeek(today, weekStart);
    days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  } else {
    const first = month ?? today;
    const d = parseISODate(first);
    const count = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const lead = (d.getDay() - weekStart + 7) % 7;
    days = [...Array.from({ length: lead }, () => null), ...Array.from({ length: count }, (_, i) => toISODate(new Date(d.getFullYear(), d.getMonth(), i + 1)))];
    while (days.length % 7) days.push(null);
  }
  const labels = Array.from({ length: 7 }, (_, i) => WEEKDAYS[(weekStart + i) % 7]);
  const rows: (ISODate | null)[][] = [];
  for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7));

  return (
    <View style={{ gap: 4 }}>
      <View style={styles.row}>
        {labels.map((l, i) => (
          <T key={i} variant="caption" tone="muted" style={styles.cell}>
            {l}
          </T>
        ))}
      </View>
      {rows.map((r, ri) => (
        <View key={ri} style={styles.row}>
          {r.map((date, ci) => {
            if (!date) return <View key={ci} style={styles.cell} />;
            const on = date === selected;
            return (
              <Pressable
                key={date}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={date}
                onPress={() => {
                  tap();
                  onSelect(date);
                }}
                style={[styles.cell, styles.day, on && { backgroundColor: color.brand }]}
              >
                <T variant="bodyStrong" style={{ color: on ? color.onBrand : date === today ? color.brand : color.ink }}>
                  {Number(date.slice(8))}
                </T>
                <Dots statuses={data[date]} on={on} />
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  cell: { flex: 1, textAlign: 'center', alignItems: 'center' },
  day: { minHeight: 52, borderRadius: 16, justifyContent: 'center', gap: 4, paddingVertical: 6 },
  dotRow: { height: 8, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 7, height: 7, borderRadius: 4 },
  dash: { width: 8, height: 2, borderRadius: 1 },
});
