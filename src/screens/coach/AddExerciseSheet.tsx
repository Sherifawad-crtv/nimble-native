import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Thumb } from '../../components/VideoEmbed';
import { useData } from '../../hooks/data';
import { keys } from '../../hooks/keys';
import { t, tp } from '../../i18n';
import { measuredLabel } from '../../lib/workout';
import type { Exercise } from '../../types';
import { Button, DataBoundary, Icon, Sheet, T, TextField, color } from '../../ui';
import { ExerciseForm } from './ExerciseForm';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Receives the chosen library exercises, or the one just created. */
  onAdd: (exercises: Exercise[]) => void;
}

/** Pick from the library, or create a new exercise without leaving the builder. Everything comes from the library. */
export function AddExerciseSheet({ open, onClose, onAdd }: Props) {
  const [creating, setCreating] = useState(false);
  const close = () => {
    setCreating(false);
    onClose();
  };
  return (
    <Sheet open={open} title={t(creating ? 'addExercise.createTitle' : 'addExercise.title')} onClose={close}>
      {creating ? (
        <View style={{ gap: 12 }}>
          <Pressable accessibilityRole="button" onPress={() => setCreating(false)}>
            <T variant="bodyStrong" tone="brand">
              {t('addExercise.backToLibrary')}
            </T>
          </Pressable>
          <ExerciseForm
            submitLabel={t('addExercise.createAndAdd')}
            onSaved={(ex) => {
              onAdd([ex]);
              close();
            }}
          />
        </View>
      ) : (
        <PickList
          onCreate={() => setCreating(true)}
          onAdd={(list) => {
            onAdd(list);
            close();
          }}
        />
      )}
    </Sheet>
  );
}

function PickList({ onCreate, onAdd }: { onCreate: () => void; onAdd: (list: Exercise[]) => void }) {
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<Exercise[]>([]);
  const results = useData(keys.exercises({ search }), (s) => s.listExercises({ search }));
  const toggle = (e: Exercise) => setPicked(picked.some((p) => p.id === e.id) ? picked.filter((p) => p.id !== e.id) : [...picked, e]);

  return (
    <View style={{ gap: 12 }}>
      <TextField placeholder={t('addExercise.search')} value={search} onChangeText={setSearch} autoCorrect={false} returnKeyType="search" />
      <Button variant="secondary" size="md" icon="plus" fullWidth onPress={onCreate}>
        {t('addExercise.create')}
      </Button>
      <DataBoundary query={results} empty={{ icon: 'search', title: t('addExercise.empty.title'), body: t('addExercise.empty.body'), action: t('addExercise.create'), onAction: onCreate }}>
        {(list) => (
          <View>
            {list.map((e) => {
              const on = picked.some((p) => p.id === e.id);
              return (
                <Pressable key={e.id} accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => toggle(e)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}>
                  <Thumb url={e.thumbnailUrl} status={e.linkStatus} />
                  <View style={{ flex: 1 }}>
                    <T variant="bodyStrong" numberOfLines={1}>
                      {e.name}
                    </T>
                    <T variant="caption" tone="muted" numberOfLines={1}>
                      {[...e.tags, measuredLabel(e.measuredAs)].join(' · ')}
                    </T>
                  </View>
                  <View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: on ? color.brand : color.lineStrong, backgroundColor: on ? color.brand : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                    {on ? <Icon name="check" size={16} tint={color.onBrand} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </DataBoundary>
      {picked.length > 0 ? (
        <Button fullWidth size="md" onPress={() => onAdd(picked)}>
          {tp('addExercise.add', picked.length)}
        </Button>
      ) : null}
    </View>
  );
}
