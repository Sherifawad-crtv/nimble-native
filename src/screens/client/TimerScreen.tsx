import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { RoundCounter, Stepper, TimerControls, TimerDisplay } from '../../components/TimerParts';
import { errorMessage, useAction, useData } from '../../hooks/data';
import { keys } from '../../hooks/keys';
import { t } from '../../i18n';
import { formatTimerResult } from '../../lib/results';
import { settingsSummary } from '../../lib/workout';
import { buildPlan, buildResult, formatClock, type TimerPlan } from '../../timer/engine';
import { useTimer } from '../../timer/useTimer';
import type { Assignment, Block, BlockSettings, WorkoutLog } from '../../types';
import { Button, ConfirmDialog, DataBoundary, ErrorState, IconButton, Screen, T, useToast } from '../../ui';

export function TimerScreen() {
  const { id = '', block: blockId = '' } = useLocalSearchParams<{ id: string; block: string }>();
  const router = useRouter();
  const assignment = useData(keys.assignment(id), (s) => s.getAssignment(id));
  const log = useData(keys.log(id), (s) => s.getLog(id));
  return (
    <DataBoundary query={assignment} skeleton="detail">
      {(a) => (
        <DataBoundary query={log} skeleton="detail">
          {(l) => {
            const block = a.workout.blocks.find((b) => b.id === blockId);
            if (!block || block.settings.type === 'standard' || !l) {
              return (
                <Screen back>
                  <ErrorState title={t('timer.unavailable.title')} body={t('timer.unavailable.body')} onRetry={() => router.back()} />
                </Screen>
              );
            }
            return <TimerView assignment={a} block={block} settings={block.settings} log={l} />;
          }}
        </DataBoundary>
      )}
    </DataBoundary>
  );
}

interface ViewProps {
  assignment: Assignment;
  block: Block;
  settings: Exclude<BlockSettings, { type: 'standard' }>;
  log: WorkoutLog;
}

function TimerView({ assignment, block, settings, log }: ViewProps) {
  const router = useRouter();
  const toast = useToast();
  const plan = useMemo<TimerPlan>(() => buildPlan(settings), [settings]);
  const timer = useTimer(plan);
  const { snap } = timer;
  const [rounds, setRounds] = useState(0);
  const [extraReps, setExtraReps] = useState(0);
  const [quit, setQuit] = useState(false);
  const save = useAction((s, w: WorkoutLog) => s.saveLog(w), { invalidate: [keys.logsAll] });

  const counts = plan.format === 'amrap' || plan.format === 'for_time';
  const running = snap.status === 'running' || snap.status === 'paused';
  const result = buildResult(plan, snap, { rounds, extraReps });

  const saveResult = async () => {
    if (!result) return;
    try {
      await save.run({ ...log, timerResults: [...log.timerResults.filter((r) => r.blockId !== block.id), { blockId: block.id, result }] });
      toast.show(t('timer.saved'));
      router.back();
    } catch (e) {
      toast.show(errorMessage(e), 'error');
    }
  };

  const seg = snap.segment;
  const sub =
    snap.status === 'ready'
      ? settingsSummary(settings)
      : seg.kind === 'ready'
        ? undefined
        : plan.format === 'emom' && seg.round
          ? t('timer.minuteOf', { n: seg.round, total: plan.rounds ?? seg.round })
          : plan.format === 'tabata' && seg.round
            ? t('timer.roundOf', { n: seg.round, total: plan.rounds ?? seg.round })
            : plan.format === 'for_time'
              ? t('timer.roundsTarget', { done: rounds, total: plan.rounds ?? rounds })
              : undefined;
  const phase = snap.status === 'ready' ? block.title : seg.label || t(`timer.phase.${seg.kind}`);
  const time = snap.status === 'ready' ? formatClock(plan.direction === 'up' ? 0 : (plan.segments.find((s) => s.kind !== 'ready')?.durationSec ?? 0)) : formatClock(snap.displaySec);

  return (
    <Screen
      title={block.title}
      subtitle={assignment.workout.title}
      trailing={<IconButton icon="close" label={t('timer.quit')} onPress={() => (snap.status === 'ready' || snap.status === 'finished' ? router.back() : setQuit(true))} />}
    >
      <TimerDisplay
        time={time}
        phase={phase}
        sub={sub}
        progress={snap.status === 'ready' ? 0 : snap.progress}
        tone={seg.kind === 'rest' ? 'rest' : seg.kind === 'ready' ? 'ready' : 'work'}
        final={snap.final}
        paused={snap.status === 'paused'}
      />

      {counts && snap.status !== 'ready' && snap.status !== 'finished' ? <RoundCounter count={rounds} onChange={setRounds} /> : null}

      {snap.status === 'finished' && result ? (
        <View style={{ gap: 12 }}>
          <T variant="eyebrow">{t('timer.result')}</T>
          {plan.format === 'amrap' ? (
            <View style={{ gap: 12 }}>
              <RoundCounter count={rounds} onChange={setRounds} />
              <Stepper label={t('timer.extraReps')} value={extraReps} min={0} max={999} onChange={setExtraReps} />
            </View>
          ) : null}
          <T variant="metric" tone="brand">
            {formatTimerResult(result)}
          </T>
          <Button loading={save.isPending} onPress={() => void saveResult()}>
            {t('timer.save')}
          </Button>
          <Button size="md" variant="secondary" onPress={() => router.back()}>
            {t('timer.discard')}
          </Button>
        </View>
      ) : (
        <>
          <TimerControls
            state={snap.status === 'finished' ? 'finished' : snap.status}
            sound={timer.sound}
            voice={timer.voice}
            onStart={timer.start}
            onPause={timer.pause}
            onResume={timer.resume}
            onStop={timer.stop}
            onSound={timer.toggleSound}
            onVoice={timer.toggleVoice}
          />
          {plan.format === 'for_time' && running ? (
            <Button icon="flag" onPress={timer.stop}>
              {t('timer.finishNow')}
            </Button>
          ) : null}
        </>
      )}

      {block.items.length > 0 && snap.status !== 'finished' ? (
        <View style={{ gap: 4 }}>
          <T variant="eyebrow">{t('timer.exercises')}</T>
          {block.items.map((it) => (
            <T key={it.id} variant="bodyStrong">
              {it.target.reps ? `${it.target.reps} ` : ''}
              {it.exerciseName}
            </T>
          ))}
        </View>
      ) : null}

      <ConfirmDialog open={quit} destructive title={t('timer.quit.title')} body={t('timer.quit.body')} confirmLabel={t('timer.quit.confirm')} onCancel={() => setQuit(false)} onConfirm={() => router.back()} />
    </Screen>
  );
}
