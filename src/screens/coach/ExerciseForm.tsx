import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { TagPicker } from '../../components/TagPicker';
import { Thumb } from '../../components/VideoEmbed';
import { errorMessage, useAction } from '../../hooks/data';
import { keys } from '../../hooks/keys';
import { t } from '../../i18n';
import { MEASURED_AS, measuredLabel } from '../../lib/workout';
import { ServiceError } from '../../services';
import type { Exercise, ExerciseInput, LinkPreview, MeasuredAs } from '../../types';
import { Banner, Button, ConfirmDialog, Segmented, T, TextField, useToast } from '../../ui';

export const MOVEMENT_TAGS = ['push', 'pull', 'legs', 'core', 'full body'];
export const EQUIPMENT_TAGS = ['bodyweight', 'barbell', 'dumbbell', 'kettlebell', 'bands', 'machine', 'other'];

type LinkState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'ok'; preview: LinkPreview }
  | { kind: 'blocked'; preview: LinkPreview }
  | { kind: 'error'; message: string };

interface Props {
  /** Present when editing; absent when creating. */
  exercise?: Exercise;
  onSaved: (exercise: Exercise) => void;
  /** Called after a delete. Only shown when editing. */
  onDeleted?: () => void;
  submitLabel?: string;
}

/** Create or edit a library exercise. Used by the library screen and inside the workout builder. */
export function ExerciseForm({ exercise, onSaved, onDeleted, submitLabel }: Props) {
  const toast = useToast();
  const [url, setUrl] = useState(exercise?.videoUrl ?? '');
  const [name, setName] = useState(exercise?.name ?? '');
  const [measuredAs, setMeasuredAs] = useState<MeasuredAs>(exercise?.measuredAs ?? 'reps');
  const [tags, setTags] = useState(exercise?.tags ?? []);
  const [equipment, setEquipment] = useState(exercise?.equipment ?? []);
  const [cues, setCues] = useState(exercise?.cues ?? '');
  const [link, setLink] = useState<LinkState>({ kind: 'idle' });
  const [nameError, setNameError] = useState<string | undefined>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const checked = useRef(exercise?.videoUrl ?? '');
  const nameTouched = useRef(!!exercise);

  const preview = useAction((s, u: string) => s.previewVideoLink(u));
  const create = useAction((s, input: ExerciseInput) => s.createExercise(input), { invalidate: [keys.exercisesAll] });
  const update = useAction((s, a: { id: string; patch: Partial<Exercise> }) => s.updateExercise(a.id, a.patch), { invalidate: [keys.exercisesAll] });
  const remove = useAction((s, id: string) => s.deleteExercise(id), { invalidate: [keys.exercisesAll] });

  const checkLink = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === checked.current) return;
    checked.current = trimmed;
    setLink({ kind: 'checking' });
    try {
      const p = await preview.run(trimmed);
      setLink(p.embeddable ? { kind: 'ok', preview: p } : { kind: 'blocked', preview: p });
      if (!nameTouched.current && !name.trim()) setName(p.title);
    } catch (e) {
      setLink({ kind: 'error', message: errorMessage(e) });
    }
  };

  useEffect(() => {
    if (exercise?.videoUrl && exercise.linkStatus === 'unavailable') setLink({ kind: 'error', message: t('exercise.link.unavailable') });
  }, [exercise]);

  const busy = create.isPending || update.isPending;

  const submit = async () => {
    if (!name.trim()) {
      setNameError(t('exercise.name.required'));
      return;
    }
    setNameError(undefined);
    const videoUrl = url.trim();
    try {
      const saved = exercise
        ? await update.run({ id: exercise.id, patch: { name, measuredAs, tags, equipment, cues: cues.trim() || undefined, videoUrl: videoUrl || undefined } })
        : await create.run({ name, measuredAs, tags, equipment, ...(cues.trim() && { cues }), ...(videoUrl && { videoUrl }) });
      toast.show(t(exercise ? 'exercise.saved' : 'exercise.created', { name: saved.name }));
      onSaved(saved);
    } catch (e) {
      if (e instanceof ServiceError && e.code === 'invalid_link') setLink({ kind: 'error', message: e.message });
      else toast.show(errorMessage(e), 'error');
    }
  };

  return (
    <View style={{ gap: 16 }}>
      <TextField
        label={t('exercise.link.label')}
        placeholder={t('exercise.link.placeholder')}
        keyboardType="url"
        autoCapitalize="none"
        autoCorrect={false}
        value={url}
        onChangeText={(v) => {
          setUrl(v);
          if (link.kind !== 'idle') setLink({ kind: 'idle' });
          // A paste arrives as one large change; check straight away.
          if (v.length - url.length > 8) void checkLink(v);
          else checked.current = '';
        }}
        onBlur={() => void checkLink(url)}
        onSubmitEditing={() => void checkLink(url)}
        {...(link.kind === 'error' && { error: link.message })}
        hint={link.kind === 'checking' ? t('exercise.link.checking') : link.kind === 'ok' ? t('exercise.link.ok') : link.kind === 'idle' ? t('exercise.link.hint') : undefined}
      />
      {link.kind === 'ok' || link.kind === 'blocked' ? (
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <Thumb url={link.preview.thumbnailUrl} />
          <View style={{ flex: 1 }}>
            <T variant="bodyStrong" numberOfLines={2}>
              {link.preview.title}
            </T>
            <T variant="caption" tone="muted">
              {link.preview.provider === 'youtube' ? 'YouTube' : 'Vimeo'}
            </T>
          </View>
        </View>
      ) : null}
      {link.kind === 'blocked' ? <Banner tone="warning" title={t('exercise.link.blocked')} /> : null}
      {link.kind === 'error' && url.trim() ? (
        <T variant="label" tone="muted">
          {t('exercise.link.saveWithout')}
        </T>
      ) : null}

      <TextField
        label={t('exercise.name.label')}
        required
        value={name}
        error={nameError}
        onChangeText={(v) => {
          nameTouched.current = true;
          setName(v);
        }}
      />
      <View style={{ gap: 6 }}>
        <T variant="label" tone="muted">
          {t('exercise.measuredAs')}
        </T>
        <Segmented options={MEASURED_AS.map((m) => ({ id: m, label: measuredLabel(m) }))} value={measuredAs} onChange={(id) => setMeasuredAs(id as MeasuredAs)} />
      </View>
      <TagPicker label={t('exercise.tags')} value={tags} options={MOVEMENT_TAGS} onChange={setTags} custom />
      <TagPicker label={t('exercise.equipment')} value={equipment} options={EQUIPMENT_TAGS} onChange={setEquipment} custom />
      <TextField label={t('exercise.cues.label')} placeholder={t('exercise.cues.placeholder')} multiline value={cues} onChangeText={setCues} />
      <View style={{ gap: 8 }}>
        <Button fullWidth loading={busy} onPress={() => void submit()} size="md">
          {submitLabel ?? t(exercise ? 'common.save' : 'exercise.create.save')}
        </Button>
        {exercise && onDeleted ? (
          <Button fullWidth variant="tertiary" size="md" icon="trash" onPress={() => setConfirmDelete(true)}>
            {t('exercise.delete')}
          </Button>
        ) : null}
      </View>
      {exercise && onDeleted ? (
        <ConfirmDialog
          open={confirmDelete}
          destructive
          title={t('exercise.delete.title', { name: exercise.name })}
          body={t('exercise.delete.body')}
          confirmLabel={t('exercise.delete')}
          busy={remove.isPending}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() =>
            void remove
              .run(exercise.id)
              .then(() => {
                setConfirmDelete(false);
                toast.show(t('exercise.deleted', { name: exercise.name }));
                onDeleted();
              })
              .catch((e: unknown) => toast.show(errorMessage(e), 'error'))
          }
        />
      ) : null}
    </View>
  );
}
