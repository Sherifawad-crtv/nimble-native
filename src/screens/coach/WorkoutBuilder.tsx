import { useMemo, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { errorMessage, useAction, useData } from '../../hooks/data';
import { keys } from '../../hooks/keys';
import { t } from '../../i18n';
import { BLOCK_TYPES, blockTypeLabel, defaultSettings, newId, settingsSummary, targetText } from '../../lib/workout';
import type { Block, BlockItem, BlockType, Exercise, ItemTarget, MeasuredAs, Workout } from '../../types';
import { Button, Card, Chip, ConfirmDialog, DataBoundary, EmptyState, IconButton, List, ListRow, Screen, Sheet, T, TextField, color, font, useToast } from '../../ui';
import { AddExerciseSheet } from './AddExerciseSheet';
import { AssignSheet } from './AssignSheet';
import { BlockSettingsEditor } from './BlockSettingsEditor';
import { TargetSheet } from './TargetSheet';

export function WorkoutBuilder() {
  const { id: workoutId = 'new' } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const templates = useData(keys.templates, (s) => s.listTemplates());
  return (
    <DataBoundary query={templates} skeleton="detail">
      {(list) => {
        const found = workoutId === 'new' ? undefined : list.find((w) => w.id === workoutId);
        if (workoutId !== 'new' && !found) {
          return (
            <Screen title={t('builder.notFound.title')} back>
              <EmptyState icon="dumbbell" title={t('builder.notFound.title')} body={t('builder.notFound.body')} action={t('builder.notFound.action')} onAction={() => router.back()} />
            </Screen>
          );
        }
        return <BuilderForm key={found?.id ?? 'new'} initial={found} />;
      }}
    </DataBoundary>
  );
}

function defaultTarget(blockType: BlockType, measured: MeasuredAs): ItemTarget {
  if (blockType === 'tabata') return {};
  const timer = blockType !== 'standard';
  const amount: ItemTarget = measured === 'time' ? { durationSec: 30 } : measured === 'distance' ? { distanceM: 200 } : { reps: timer ? 10 : 8 };
  return timer ? amount : { sets: 3, ...amount, restSec: 60 };
}

const hasTargetFields = (b: BlockType) => b !== 'tabata' && b !== 'custom';

function BuilderForm({ initial }: { initial?: Workout }) {
  const router = useRouter();
  const toast = useToast();
  const exercises = useData(keys.exercises(), (s) => s.listExercises());
  const measuredOf = useMemo(() => {
    const m = new Map<string, MeasuredAs>();
    for (const e of exercises.data ?? []) m.set(e.id, e.measuredAs);
    return (id: string): MeasuredAs => m.get(id) ?? 'reps';
  }, [exercises.data]);

  const [title, setTitle] = useState(initial?.title ?? '');
  const [blocks, setBlocks] = useState<Block[]>(initial?.blocks ?? []);
  const [savedId, setSavedId] = useState(initial?.id);
  const snapshot = useRef(JSON.stringify({ title: initial?.title ?? '', blocks: initial?.blocks ?? [] }));
  const dirty = JSON.stringify({ title, blocks }) !== snapshot.current;

  const [titleError, setTitleError] = useState<string>();
  const [addingBlock, setAddingBlock] = useState(false);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ blockId: string; itemId: string } | null>(null);
  const [removing, setRemoving] = useState<Block | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

  const save = useAction((s, w: Parameters<typeof s.saveWorkout>[0]) => s.saveWorkout(w), { invalidate: [keys.templates] });

  const patchBlock = (id: string, patch: Partial<Block>) => setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const moveBlock = (i: number, by: number) =>
    setBlocks((bs) => {
      const next = [...bs];
      const [b] = next.splice(i, 1);
      if (b) next.splice(i + by, 0, b);
      return next;
    });
  const moveItem = (block: Block, i: number, by: number) => {
    const items = [...block.items];
    const [it] = items.splice(i, 1);
    if (it) items.splice(i + by, 0, it);
    patchBlock(block.id, { items });
  };

  const addBlock = (type: BlockType) => {
    const n = blocks.length + 1;
    setBlocks([...blocks, { id: newId('bl'), title: type === 'standard' ? t('builder.block.defaultTitle', { n }) : blockTypeLabel(type), settings: defaultSettings(type), items: [] }]);
    setAddingBlock(false);
  };

  const addExercises = (list: Exercise[]) => {
    const block = blocks.find((b) => b.id === addingTo);
    if (!block) return;
    const items: BlockItem[] = list.map((e) => ({ id: newId('it'), exerciseId: e.id, exerciseName: e.name, target: defaultTarget(block.settings.type, e.measuredAs) }));
    patchBlock(block.id, { items: [...block.items, ...items] });
  };

  const submit = async () => {
    if (!title.trim()) return setTitleError(t('builder.title.required'));
    setTitleError(undefined);
    if (!blocks.length) return toast.show(t('builder.blocks.required'), 'error');
    try {
      const saved = await save.run({ ...(savedId && { id: savedId }), title, blocks });
      snapshot.current = JSON.stringify({ title: saved.title, blocks: saved.blocks });
      setTitle(saved.title);
      setBlocks(saved.blocks);
      setSavedId(saved.id);
      toast.show(t('builder.saved', { title: saved.title }));
    } catch (e) {
      toast.show(errorMessage(e), 'error');
    }
  };

  const editingBlock = blocks.find((b) => b.id === editing?.blockId);
  const editingItem = editingBlock?.items.find((i) => i.id === editing?.itemId);

  return (
    <Screen
      title={initial ? t('builder.edit') : t('builder.new')}
      back
      onBack={() => (dirty ? setLeaving(true) : router.back())}
      trailing={
        <Button size="sm" loading={save.isPending} disabled={!dirty && !!savedId} onPress={() => void submit()}>
          {t('builder.save')}
        </Button>
      }
    >
      <TextField label={t('builder.title.label')} required placeholder={t('builder.title.placeholder')} value={title} error={titleError} onChangeText={setTitle} />

      {blocks.length === 0 ? <EmptyState icon="list" title={t('builder.empty.title')} body={t('builder.empty.body')} /> : null}

      {blocks.map((block, bi) => {
        const timer = block.settings.type !== 'standard';
        return (
          <Card key={block.id}>
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <TextInput
                  value={block.title}
                  accessibilityLabel={t('builder.block.title')}
                  onChangeText={(v) => patchBlock(block.id, { title: v })}
                  style={{ flex: 1, color: color.ink, fontFamily: font.sansSemi, fontSize: 18, minHeight: 44 }}
                  selectionColor={color.brand}
                />
                <IconButton icon="arrow-up" label={t('builder.block.up', { title: block.title })} variant="ghost" size={20} disabled={bi === 0} onPress={() => moveBlock(bi, -1)} />
                <IconButton icon="arrow-down" label={t('builder.block.down', { title: block.title })} variant="ghost" size={20} disabled={bi === blocks.length - 1} onPress={() => moveBlock(bi, 1)} />
                <IconButton icon="trash" label={t('builder.block.remove', { title: block.title })} variant="ghost" size={20} onPress={() => (block.items.length ? setRemoving(block) : setBlocks(blocks.filter((b) => b.id !== block.id)))} />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Chip label={blockTypeLabel(block.settings.type)} selected />
                <T variant="label" tone="muted" style={{ flexShrink: 1 }}>
                  {settingsSummary(block.settings)}
                </T>
              </View>
              <BlockSettingsEditor value={block.settings} onChange={(settings) => patchBlock(block.id, { settings })} />

              {block.settings.type !== 'custom' ? (
                <View style={{ gap: 8 }}>
                  {block.items.length === 0 ? <T tone="muted">{t('builder.items.empty')}</T> : null}
                  {block.items.map((it, i) => (
                    <View key={it.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 }}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <T variant="bodyStrong" numberOfLines={1}>
                          {it.exerciseName}
                        </T>
                        <T variant="label" tone="muted" numberOfLines={2}>
                          {targetText(it.target, measuredOf(it.exerciseId), timer) || t('builder.target.none')}
                        </T>
                      </View>
                      {hasTargetFields(block.settings.type) ? (
                        <IconButton icon="edit" label={t('builder.item.edit', { name: it.exerciseName })} variant="ghost" size={18} onPress={() => setEditing({ blockId: block.id, itemId: it.id })} />
                      ) : null}
                      <IconButton icon="arrow-up" label={t('builder.item.up', { name: it.exerciseName })} variant="ghost" size={18} disabled={i === 0} onPress={() => moveItem(block, i, -1)} />
                      <IconButton icon="arrow-down" label={t('builder.item.down', { name: it.exerciseName })} variant="ghost" size={18} disabled={i === block.items.length - 1} onPress={() => moveItem(block, i, 1)} />
                      <IconButton icon="close" label={t('builder.item.remove', { name: it.exerciseName })} variant="ghost" size={18} onPress={() => patchBlock(block.id, { items: block.items.filter((x) => x.id !== it.id) })} />
                    </View>
                  ))}
                  <Button size="md" variant="secondary" icon="plus" onPress={() => setAddingTo(block.id)}>
                    {t('builder.addExercise')}
                  </Button>
                </View>
              ) : null}
            </View>
          </Card>
        );
      })}

      <Button variant="secondary" size="md" icon="plus" onPress={() => setAddingBlock(true)}>
        {t('builder.addBlock')}
      </Button>
      {savedId && !dirty ? (
        <Button size="md" icon="calendar" onPress={() => setAssignOpen(true)}>
          {t('builder.assign')}
        </Button>
      ) : null}

      <Sheet open={addingBlock} title={t('builder.addBlock')} onClose={() => setAddingBlock(false)}>
        <List>
          {BLOCK_TYPES.map((type) => (
            <ListRow key={type} title={blockTypeLabel(type)} subtitle={t(`blockType.${type}.hint`)} chevron onPress={() => addBlock(type)} />
          ))}
        </List>
      </Sheet>
      <AddExerciseSheet open={addingTo !== null} onClose={() => setAddingTo(null)} onAdd={addExercises} />
      {editingBlock && editingItem ? (
        <TargetSheet
          open
          name={editingItem.exerciseName}
          blockType={editingBlock.settings.type}
          measuredAs={measuredOf(editingItem.exerciseId)}
          target={editingItem.target}
          onClose={() => setEditing(null)}
          onSave={(target) => {
            patchBlock(editingBlock.id, { items: editingBlock.items.map((x) => (x.id === editingItem.id ? { ...x, target } : x)) });
            setEditing(null);
          }}
        />
      ) : null}
      <ConfirmDialog
        open={removing !== null}
        destructive
        title={t('builder.block.remove.title', { title: removing?.title ?? '' })}
        body={t('builder.block.remove.body')}
        confirmLabel={t('common.remove')}
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          setBlocks(blocks.filter((b) => b.id !== removing?.id));
          setRemoving(null);
        }}
      />
      <ConfirmDialog open={leaving} destructive title={t('builder.discard.title')} body={t('builder.discard.body')} confirmLabel={t('builder.discard.confirm')} onCancel={() => setLeaving(false)} onConfirm={() => router.back()} />
      {savedId ? <AssignSheet open={assignOpen} onClose={() => setAssignOpen(false)} workoutId={savedId} /> : null}
    </Screen>
  );
}
