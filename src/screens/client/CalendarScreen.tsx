import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { CalendarView, monthRange } from '../../components/CalendarView';
import { useData } from '../../hooks/data';
import { keys } from '../../hooks/keys';
import { formatDateLong, t } from '../../i18n';
import { startOfMonth, todayISO } from '../../lib/date';
import type { ISODate } from '../../types';
import { DataBoundary, List, ListRow, Screen, StatusChip, T } from '../../ui';

export function CalendarScreen() {
  const router = useRouter();
  const today = todayISO();
  const [month, setMonth] = useState(startOfMonth(today));
  const [selected, setSelected] = useState<ISODate>(today);
  const { from, to } = monthRange(month);
  const assignments = useData(keys.assignments(undefined, from, to), (s) => s.listAssignments({ from, to }));
  const day = (assignments.data ?? []).filter((a) => a.date === selected);

  return (
    <Screen tabs title={t('calendar.title')} subtitle={t('calendar.subtitle')} refreshing={assignments.isRefetching} onRefresh={() => void assignments.refetch()}>
      <CalendarView
        month={month}
        selected={selected}
        assignments={assignments.data ?? []}
        onSelect={setSelected}
        onMonthChange={(m) => {
          setMonth(m);
          setSelected(m);
        }}
      />
      <View style={{ gap: 12 }}>
        <T variant="eyebrow">{formatDateLong(selected)}</T>
        <DataBoundary query={assignments} rows={2} isEmpty={() => day.length === 0} empty={<T tone="muted">{t('calendar.day.empty')}</T>}>
          {() => (
            <List>
              {day.map((a) => (
                <ListRow
                  key={a.id}
                  title={a.workout.title}
                  subtitle={a.workout.blocks.map((b) => b.title).join(' · ')}
                  trailing={<StatusChip kind="assignment" value={a.status} />}
                  chevron
                  onPress={() => router.push({ pathname: '/workout/[id]', params: { id: a.id } })}
                />
              ))}
            </List>
          )}
        </DataBoundary>
      </View>
    </Screen>
  );
}
