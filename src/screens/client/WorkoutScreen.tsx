import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMe } from '../../core/auth';
import { Comments } from '../../components/Comments';
import { RestOverlay } from '../../components/RestOverlay';
import { SetLogger } from '../../components/SetLogger';
import { VideoEmbed } from '../../components/VideoEmbed';
import { WorkoutPlan } from '../../components/WorkoutPlan';
import { WorkoutResults } from '../../components/WorkoutResults';
import { BlockHeader } from '../../components/BlockHeader';
import { errorMessage, useAction, useData } from '../../hooks/data';
import { keys } from '../../hooks/keys';
import { formatDateLong, t } from '../../i18n';
import { formatTimerResult } from '../../lib/results';
import { blockTypeLabel, isTimerBlock, settingsSummary, targetText } from '../../lib/workout';
import type { Assignment, Block, Exercise, SetResult, WorkoutLog } from '../../types';
import { Banner, Button, Card, DataBoundary, Screen, StatusChip, T, TextField, useToast } from '../../ui';

export function WorkoutScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const assignment = useData(keys.assignment(id), (s) => s.getAssignment(id));
  return (
    <DataBoundary query={assignment} skeleton="detail">
      {(a) => <WorkoutView assignment={a} />}
    </DataBoundary>
  );
}

const refreshAfterWork = [keys.assignmentsAll, keys.logsAll, keys.recordsAll, keys.progressAll];

function WorkoutView({ assignment: a }: { assignment: Assignment }) {
  const exercises = useData(keys.exercises(), (s) => s.listExercises());
  const log = useData(keys.log(a.id), (s) => s.getLog(a.id));
  const toast = useToast();
  const start = useAction((s, _: void) => s.startWorkout(a.id), { invalidate: refreshAfterWork });
  const begin = () => void start.run().catch((e: unknown) => toast.show(errorMessage(e), 'error'));

  return (
    <Screen back title={a.workout.title} subtitle={formatDateLong(a.date)} trailing={<StatusChip kind="assignment" value={a.status} />}>
      <DataBoundary query={exercises} skeleton="detail">
        {(exList) => (
          <DataBoundary query={log} skeleton="detail">
            {(l) => {
              if (a.status === 'completed') return <Completed assignment={a} log={l} />;
              if (a.status === 'skipped') return <Banner title={t('workout.skipped')} />;
              if (!l || a.status === 'not_started') {
                return (
                  <>
                    <Button loading={start.isPending} onPress={begin}>
                      {t('workout.start')}
                    </Button>
                    <WorkoutPlan assignment={a} exercises={exList} />
                  </>
                );
              }
              return <Active assignment={a} log={l} exercises={exList} />;
            }}
          </DataBoundary>
        )}
      </DataBoundary>
      <Comments assignmentId={a.id} viewer="client" />
    </Screen>
  );
}

function Completed({ assignment, log }: { assignment: Assignment; log: WorkoutLog | null }) {
  return (
    <>
      <Banner title={t('workout.completed.title')} message={t('workout.completed.body')} />
      <WorkoutResults assignment={assignment} log={log} />
    </>
  );
}

const SAVE_DELAY_MS = 700;

function Active({ assignment: a, log, exercises }: { assignment: Assignment; log: WorkoutLog; exercises: Exercise[] }) {
  const me = useMe();
  const router = useRouter();
  const toast = useToast();
  const exById = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);

  const [results, setResults] = useState<Record<string, SetResult[]>>(() => Object.fromEntries(log.itemResults.map((r) => [r.itemId, r.sets])));
  const [note, setNote] = useState(log.clientNote ?? '');
  const [rest, setRest] = useState<{ seconds: number; next?: string } | null>(null);
  const [dirty, setDirty] = useState(false);
  const latest = useRef({ results, note, log });
  latest.current = { results, note, log };

  const save = useAction((s, l: WorkoutLog) => s.saveLog(l), { invalidate: [keys.logsAll] });
  const complete = useAction((s, _: void) => s.completeWorkout(a.id), { invalidate: [...refreshAfterWork, keys.packages(me.id)] });
  const { run: saveRun } = save;

  const flush = useCallback(async () => {
    const { results: r, note: n, log: base } = latest.current;
    await saveRun({ ...base, itemResults: Object.entries(r).map(([itemId, sets]) => ({ itemId, sets })), ...(n.trim() ? { clientNote: n } : { clientNote: undefined }) });
    setDirty(false);
  }, [saveRun]);

  // Autosave shortly after the last change, so closing the app never loses a set.
  useEffect(() => {
    if (!dirty) return;
    const id = setTimeout(() => void flush().catch(() => undefined), SAVE_DELAY_MS);
    return () => clearTimeout(id);
  }, [dirty, results, note, flush]);

  // Flush on the way out: leaving the screen or backgrounding the app must never drop a logged set.
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active' && dirtyRef.current) void flush().catch(() => undefined);
    });
    return () => {
      sub.remove();
      if (dirtyRef.current) void flush().catch(() => undefined);
    };
  }, [flush]);

  const setItemSets = (itemId: string, sets: SetResult[]) => {
    setResults((r) => ({ ...r, [itemId]: sets }));
    setDirty(true);
  };

  const openTimer = async (block: Block) => {
    try {
      if (dirty) await flush();
      router.push({ pathname: '/timer/[id]', params: { id: a.id, block: block.id } });
    } catch (e) {
      toast.show(errorMessage(e), 'error');
    }
  };

  const finish = async () => {
    try {
      await flush();
      await complete.run();
      toast.show(t('workout.finished'));
    } catch (e) {
      toast.show(errorMessage(e), 'error');
    }
  };

  return (
    <>
      {a.workout.blocks.map((block) => {
        const timer = isTimerBlock(block);
        const result = log.timerResults.find((r) => r.blockId === block.id)?.result;
        return (
          <Card key={block.id} style={{ gap: 12 }}>
            <BlockHeader title={block.title} type={blockTypeLabel(block.settings.type)} />
            {timer ? (
              <T variant="label" tone="muted">
                {settingsSummary(block.settings)}
              </T>
            ) : null}

            {block.items.map((it, i) => {
              const ex = exById.get(it.exerciseId);
              const measured = ex?.measuredAs ?? 'reps';
              const next = block.items[i + 1]?.exerciseName ?? block.items[0]?.exerciseName;
              return (
                <View key={it.id} style={{ gap: 8 }}>
                  <T variant="bodyStrong">{it.exerciseName}</T>
                  <T variant="label" tone="muted">
                    {targetText(it.target, measured, timer)}
                  </T>
                  {ex ? <VideoEmbed exercise={ex} /> : <T variant="label" tone="muted">{t('workout.exerciseMissing')}</T>}
                  {!timer ? (
                    <SetLogger name={it.exerciseName} measuredAs={measured} target={it.target} saved={results[it.id] ?? []} onChange={(sets) => setItemSets(it.id, sets)} onSetDone={(seconds) => setRest({ seconds, next })} />
                  ) : null}
                </View>
              );
            })}

            {timer ? (
              <View style={{ gap: 8 }}>
                {result ? (
                  <T variant="metric" tone="brand">
                    {formatTimerResult(result)}
                  </T>
                ) : null}
                <Button icon="clock" variant={result ? 'secondary' : 'primary'} onPress={() => void openTimer(block)}>
                  {t(result ? 'workout.timer.again' : 'workout.timer.open')}
                </Button>
              </View>
            ) : null}
          </Card>
        );
      })}

      <TextField
        label={t('workout.note')}
        placeholder={t('workout.note.placeholder')}
        multiline
        value={note}
        onChangeText={(v) => {
          setNote(v);
          setDirty(true);
        }}
      />
      <T variant="caption" tone="muted" accessibilityLiveRegion="polite">
        {save.isPending ? t('workout.saving') : save.error ? t('workout.saveFailed') : dirty ? '' : t('workout.saved')}
      </T>
      <Button loading={complete.isPending} onPress={() => void finish()}>
        {t('workout.finish')}
      </Button>
      {rest ? <RestOverlay seconds={rest.seconds} next={rest.next} onClose={() => setRest(null)} /> : null}
    </>
  );
}
