import { View } from 'react-native';
import { formatMonthYear, t } from '../i18n';
import { parseISODate, toISODate, todayISO } from '../lib/date';
import type { Assignment, ISODate } from '../types';
import { Calendar, IconButton, T } from '../ui';

interface Props {
  month: ISODate; // first day of the visible month
  selected: ISODate;
  assignments: Assignment[];
  onSelect: (date: ISODate) => void;
  onMonthChange: (firstOfMonth: ISODate) => void;
}

/** First and last day shown for a month, for loading its assignments. */
export function monthRange(month: ISODate): { from: ISODate; to: ISODate } {
  const d = parseISODate(month);
  return { from: month, to: toISODate(new Date(d.getFullYear(), d.getMonth() + 1, 0)) };
}

export const shiftMonth = (month: ISODate, by: number): ISODate => {
  const d = parseISODate(month);
  return toISODate(new Date(d.getFullYear(), d.getMonth() + by, 1));
};

/** A month grid with working month navigation. */
export function CalendarView({ month, selected, assignments, onSelect, onMonthChange }: Props) {
  const data: Record<string, string[]> = {};
  for (const a of assignments) (data[a.date] ??= []).push(a.status);
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <T variant="heading" accessibilityLiveRegion="polite">
          {formatMonthYear(month)}
        </T>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <IconButton icon="chev-l" label={t('calendar.prev')} size={20} onPress={() => onMonthChange(shiftMonth(month, -1))} />
          <IconButton icon="chev-r" label={t('calendar.next')} size={20} onPress={() => onMonthChange(shiftMonth(month, 1))} />
        </View>
      </View>
      <Calendar mode="month" month={month} selected={selected} today={todayISO()} data={data} onSelect={onSelect} />
    </View>
  );
}
