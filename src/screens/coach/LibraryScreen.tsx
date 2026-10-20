import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Thumb } from '../../components/VideoEmbed';
import { useData } from '../../hooks/data';
import { keys } from '../../hooks/keys';
import { t, tp } from '../../i18n';
import { measuredLabel } from '../../lib/workout';
import type { Exercise } from '../../types';
import { Banner, Chip, DataBoundary, IconButton, List, ListRow, Screen, Sheet, StatusChip, TextField } from '../../ui';
import { ExerciseForm } from './ExerciseForm';

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

export function LibraryScreen() {
  const [search, setSearch] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [equipment, setEquipment] = useState<string[]>([]);
  const [editing, setEditing] = useState<Exercise | 'new' | null>(null);
  const debounced = useDebounced(search, 200);
  const filtered = tags.length > 0 || equipment.length > 0 || debounced.trim() !== '';

  const everything = useData(keys.exercises(), (s) => s.listExercises());
  const results = useData(keys.exercises({ search: debounced, tags, equipment }), (s) => s.listExercises({ search: debounced, tags, equipment }));
  const tagOptions = useMemo(() => [...new Set((everything.data ?? []).flatMap((e) => e.tags))].sort(), [everything.data]);
  const equipmentOptions = useMemo(() => [...new Set((everything.data ?? []).flatMap((e) => e.equipment))].sort(), [everything.data]);
  const broken = (everything.data ?? []).filter((e) => e.linkStatus === 'unavailable').length;

  return (
    <Screen
      tabs
      title={t('library.title')}
      subtitle={everything.data ? tp('library.count', everything.data.length) : t('library.subtitle')}
      trailing={<IconButton icon="plus" label={t('library.add')} onPress={() => setEditing('new')} />}
      refreshing={results.isRefetching}
      onRefresh={() => void results.refetch()}
    >
      {broken > 0 ? <Banner tone="warning" title={tp('library.broken.title', broken)} message={t('library.broken.body')} /> : null}
      <TextField placeholder={t('library.search')} value={search} onChangeText={setSearch} returnKeyType="search" autoCorrect={false} clearButtonMode="while-editing" />
      {tagOptions.length + equipmentOptions.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} accessibilityLabel={t('library.filter.tags')}>
          {tagOptions.map((tag) => (
            <Chip key={tag} label={tag} selected={tags.includes(tag)} onPress={() => setTags(toggle(tags, tag))} />
          ))}
          {equipmentOptions.map((eq) => (
            <Chip key={eq} label={eq} selected={equipment.includes(eq)} onPress={() => setEquipment(toggle(equipment, eq))} />
          ))}
        </ScrollView>
      ) : null}
      <DataBoundary
        query={results}
        empty={
          filtered
            ? {
                icon: 'search',
                title: t('library.empty.filtered.title'),
                body: t('library.empty.filtered.body'),
                action: t('library.clearFilters'),
                onAction: () => {
                  setSearch('');
                  setTags([]);
                  setEquipment([]);
                },
              }
            : { icon: 'book', title: t('library.empty.title'), body: t('library.empty.body'), action: t('library.add'), onAction: () => setEditing('new') }
        }
      >
        {(list) => (
          <List>
            {list.map((e) => (
              <ListRow
                key={e.id}
                title={e.name}
                subtitle={[...e.tags, measuredLabel(e.measuredAs)].join(' · ')}
                leading={<Thumb url={e.thumbnailUrl} status={e.linkStatus} />}
                trailing={e.linkStatus === 'unavailable' ? <StatusChip kind="link" value="unavailable" /> : undefined}
                chevron
                onPress={() => setEditing(e)}
              />
            ))}
          </List>
        )}
      </DataBoundary>
      <Sheet open={editing !== null} title={editing && editing !== 'new' ? t('library.edit') : t('library.add')} onClose={() => setEditing(null)}>
        {editing !== null ? (
          <View>
            <ExerciseForm key={editing === 'new' ? 'new' : editing.id} exercise={editing === 'new' ? undefined : editing} onSaved={() => setEditing(null)} onDeleted={() => setEditing(null)} />
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}
