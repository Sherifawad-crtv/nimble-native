import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMe } from '../../core/auth';
import { NotifyPrompt } from '../../components/NotifyPrompt';
import { ProgressHero } from '../../components/ProgressHero';
import { useData } from '../../hooks/data';
import { keys } from '../../hooks/keys';
import { formatDateShort, t } from '../../i18n';
import { addDays, startOfWeek, todayISO } from '../../lib/date';
import type { Assignment } from '../../types';
import { Avatar, Calendar, DataBoundary, EmptyState, List, ListRow, Screen, StatusChip, T } from '../../ui';

/** How far ahead the home screen looks, and how many workouts it lists. */
const LOOKAHEAD_DAYS = 14;
const MAX_ROWS = 8;
const WEEK_START = 1; // Monday

/** Home: this week's calendar, the progress hero, then the workouts coming up. */
export function TodayScreen() {
  const me = useMe();
  const router = useRouter();
  const today = todayISO();
  const [selected, setSelected] = useState(today);
  const from = startOfWeek(today, WEEK_START);
  const to = addDays(today, LOOKAHEAD_DAYS);
  const assignments = useData(keys.assignments(undefined, from, to), (s) => s.listAssignments({ from, to }));

  const data: Record<string, string[]> = {};
  for (const a of assignments.data ?? []) (data[a.date] ??= []).push(a.status);

  const open = (a: Assignment) => router.push({ pathname: '/workout/[id]', params: { id: a.id } });
  const first = me.name.split(' ')[0] ?? me.name;

  return (
    <Screen
      tabs
      title={t('home.greeting', { name: first })}
      subtitle={t('home.welcome')}
      trailing={<Avatar name={me.name} />}
      refreshing={assignments.isRefetching}
      onRefresh={() => void assignments.refetch()}
    >
      <Calendar mode="week" weekStart={WEEK_START} today={today} selected={selected} data={data} onSelect={setSelected} />
      <ProgressHero quietWhenEmpty />
      <View style={{ gap: 12 }}>
        <T variant="eyebrow">{selected === today ? t('today.upNext') : formatDateShort(selected)}</T>
        <DataBoundary query={assignments} skeleton="list" rows={3}>
          {(list) => {
            // Today shows what is coming up; any other day shows that day's own workouts.
            const rows = selected === today ? list.filter((a) => a.date >= today).slice(0, MAX_ROWS) : list.filter((a) => a.date === selected);
            if (!rows.length) return <EmptyState icon="moon" title={t('today.rest.title')} body={selected === today ? t('today.rest.body') : t('home.day.none')} />;
            return (
              <List>
                {rows.map((a) => (
                  <ListRow
                    key={a.id}
                    title={a.workout.title}
                    subtitle={a.date === today ? t('today.rowToday') : formatDateShort(a.date)}
                    trailing={a.date === today || a.status !== 'not_started' ? <StatusChip kind="assignment" value={a.status} /> : undefined}
                    chevron
                    onPress={() => open(a)}
                  />
                ))}
              </List>
            );
          }}
        </DataBoundary>
      </View>
      <NotifyPrompt />
    </Screen>
  );
}
