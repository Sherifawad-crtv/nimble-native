import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { errorMessage, useAction, useData } from '../../hooks/data';
import { keys } from '../../hooks/keys';
import { t, tp } from '../../i18n';
import { blockTypeLabel, newId } from '../../lib/workout';
import type { Program, Workout } from '../../types';
import { DataBoundary, IconButton, List, ListRow, Screen, Segmented, useToast } from '../../ui';
import { AssignSheet } from './AssignSheet';

type Tab = 'templates' | 'programs';

const summary = (w: Workout) => `${tp('workouts.blocks', w.blocks.length)} · ${[...new Set(w.blocks.map((b) => blockTypeLabel(b.settings.type)))].join(', ')}`;

export function WorkoutsScreen() {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('templates');
  const [assigning, setAssigning] = useState<{ workoutId?: string; programId?: string } | null>(null);
  const templates = useData(keys.templates, (s) => s.listTemplates());
  const programs = useData(keys.programs, (s) => s.listPrograms());
  const openBuilder = (id: string) => router.push({ pathname: '/builder/[id]', params: { id } });
  const openProgram = (id: string) => router.push({ pathname: '/program/[id]', params: { id } });
  const create = () => (tab === 'templates' ? openBuilder('new') : openProgram('new'));

  const duplicate = useAction(
    (s, w: Workout) =>
      s.saveWorkout({
        title: t('workouts.copyOf', { title: w.title }),
        blocks: w.blocks.map((b) => ({ ...b, id: newId('bl'), items: b.items.map((i) => ({ ...i, id: newId('it') })) })),
      }),
    { invalidate: [keys.templates] },
  );
  const onDuplicate = (w: Workout) =>
    void duplicate
      .run(w)
      .then((copy) => toast.show(t('workouts.duplicated', { title: copy.title })))
      .catch((e: unknown) => toast.show(errorMessage(e), 'error'));

  const active = tab === 'templates' ? templates : programs;

  return (
    <Screen
      tabs
      title={t('workouts.title')}
      subtitle={t('workouts.subtitle')}
      trailing={<IconButton icon="plus" label={t(tab === 'templates' ? 'workouts.new' : 'programs.new')} onPress={create} />}
      refreshing={active.isRefetching}
      onRefresh={() => void active.refetch()}
    >
      <Segmented
        options={[
          { id: 'templates', label: t('workouts.tab.templates') },
          { id: 'programs', label: t('workouts.tab.programs') },
        ]}
        value={tab}
        onChange={(id) => setTab(id as Tab)}
      />
      {tab === 'templates' ? (
        <DataBoundary query={templates} empty={{ icon: 'dumbbell', title: t('workouts.empty.title'), body: t('workouts.empty.body'), action: t('workouts.new'), onAction: create }}>
          {(list) => (
            <List>
              {list.map((w) => (
                <ListRow
                  key={w.id}
                  title={w.title}
                  subtitle={summary(w)}
                  onPress={() => openBuilder(w.id)}
                  trailing={
                    <View style={{ flexDirection: 'row' }}>
                      <IconButton icon="calendar" label={t('workouts.assign', { title: w.title })} variant="ghost" size={20} onPress={() => setAssigning({ workoutId: w.id })} />
                      <IconButton icon="copy" label={t('workouts.duplicate', { title: w.title })} variant="ghost" size={20} onPress={() => onDuplicate(w)} />
                    </View>
                  }
                />
              ))}
            </List>
          )}
        </DataBoundary>
      ) : (
        <DataBoundary query={programs} empty={{ icon: 'list', title: t('programs.empty.title'), body: t('programs.empty.body'), action: t('programs.new'), onAction: create }}>
          {(list) => (
            <List>
              {list.map((p: Program) => (
                <ListRow
                  key={p.id}
                  title={p.title}
                  subtitle={tp('programs.days', p.days.length)}
                  onPress={() => openProgram(p.id)}
                  trailing={<IconButton icon="calendar" label={t('workouts.assign', { title: p.title })} variant="ghost" size={20} onPress={() => setAssigning({ programId: p.id })} />}
                />
              ))}
            </List>
          )}
        </DataBoundary>
      )}
      {assigning ? <AssignSheet open onClose={() => setAssigning(null)} {...assigning} /> : null}
    </Screen>
  );
}
