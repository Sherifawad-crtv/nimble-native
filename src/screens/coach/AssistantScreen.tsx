import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, TextInput, View, type ScrollViewInstance } from 'react-native';
import { useRouter } from 'expo-router';
import { useMe } from '../../app/auth';
import { Md } from '../../components/Md';
import { errorMessage, useAction, useData } from '../../hooks/data';
import { keys } from '../../hooks/keys';
import { formatDay, t } from '../../i18n';
import { blockTypeLabel, isTimerBlock, measuredLabel, settingsSummary, targetText } from '../../lib/workout';
import { dataService } from '../../services';
import type { AssistantMessage, AssistantProposal, ExerciseInput, Id, MeasuredAs } from '../../types';
import { Button, Icon, Screen, T, color, radius, space, useToast } from '../../ui';

interface Turn extends AssistantMessage {
  proposal?: AssistantProposal;
  resolved?: boolean;
}

const STARTERS = [
  { label: t('assistant.starter.workout'), prompt: t('assistant.starter.workout.prompt') },
  { label: t('assistant.starter.assign'), prompt: t('assistant.starter.assign.prompt') },
  { label: t('assistant.starter.find'), prompt: t('assistant.starter.find.prompt') },
];

const STATUS = [t('assistant.status.1'), t('assistant.status.2'), t('assistant.status.3')];

/** A small pulsing sparkle, standing in for the web app's particle orb while the assistant works. */
function Sparkle({ size = 44, active }: { size?: number; active: boolean }) {
  const pulse = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    if (!active) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 650, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, pulse]);
  return (
    <Animated.View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', opacity: pulse }}>
      <Icon name="sparkle" size={size * 0.6} tint={color.brand} />
    </Animated.View>
  );
}

function Thinking() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % STATUS.length), 2300);
    return () => clearInterval(id);
  }, []);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }} accessibilityRole="progressbar" accessibilityLabel={t('assistant.working')}>
      <Sparkle size={36} active />
      <T variant="label" tone="muted">
        {STATUS[i]}
      </T>
    </View>
  );
}

/** The coach assistant: a chat that looks things up and proposes one change at a time. Nothing is saved until confirmed. */
export function AssistantScreen() {
  const me = useMe();
  const toast = useToast();
  const router = useRouter();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [thinking, setThinking] = useState(false);
  const scroll = useRef<ScrollViewInstance>(null);
  const exercises = useData(keys.exercises(), (s) => s.listExercises());
  const measured = new Map<string, MeasuredAs>((exercises.data ?? []).map((e) => [e.id, e.measuredAs]));

  const saveWorkout = useAction((s, a: { workout: Extract<AssistantProposal, { kind: 'workout' }> }) => s.saveWorkout({ ...a.workout.workout, ...(a.workout.replaceId ? { id: a.workout.replaceId } : {}) }), { invalidate: [keys.templates] });
  const assignWorkout = useAction((s, a: { clientId: string; workoutId: string; date: string }) => s.assignWorkout({ clientIds: [a.clientId], workoutId: a.workoutId, dates: [a.date] }), { invalidate: [keys.assignmentsAll] });
  const assignProgram = useAction((s, a: { clientId: string; programId: string; startDate: string }) => s.assignProgram(a), { invalidate: [keys.assignmentsAll] });
  const addExercise = useAction((s, a: ExerciseInput) => s.createExercise(a), { invalidate: [keys.exercisesAll] });
  const attachVideo = useAction((s, a: { id: Id; videoUrl: string }) => s.updateExercise(a.id, { videoUrl: a.videoUrl }), { invalidate: [keys.exercisesAll] });
  const saveProgram = useAction((s, a: { title: string; days: { dayOffset: number; workoutId: Id }[] }) => s.saveProgram(a), { invalidate: [keys.programs, keys.templates] });

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || busy) return;
    const next: Turn[] = [...turns, { role: 'user', content }];
    setTurns(next);
    setDraft('');
    setBusy(true);
    setThinking(true);
    try {
      const reply = await dataService.askAssistant(next.map(({ role, content: c }) => ({ role, content: c })));
      setTurns([...next, { role: 'assistant', content: reply.text, ...(reply.proposal ? { proposal: reply.proposal } : {}) }]);
    } catch (e) {
      toast.show(errorMessage(e), 'error');
      setTurns(next.slice(0, -1));
      setDraft(content);
    } finally {
      setThinking(false);
      setBusy(false);
      requestAnimationFrame(() => scroll.current?.scrollToEnd({ animated: true }));
    }
  };

  const settle = (index: number, message: string) => setTurns((list) => [...list.map((x, i) => (i === index ? { ...x, resolved: true } : x)), { role: 'assistant' as const, content: message }]);

  const confirm = async (index: number, p: AssistantProposal) => {
    setBusy(true);
    try {
      if (p.kind === 'workout') {
        const saved = await saveWorkout.run({ workout: p });
        toast.show(t('assistant.done.workout', { title: saved.title }));
        router.push({ pathname: '/builder/[id]', params: { id: saved.id } });
      } else if (p.kind === 'assign_workout') {
        await assignWorkout.run({ clientId: p.clientId, workoutId: p.workoutId, date: p.date });
        settle(index, t('assistant.done.assign', { client: p.clientName }));
      } else if (p.kind === 'assign_program') {
        await assignProgram.run({ clientId: p.clientId, programId: p.programId, startDate: p.startDate });
        settle(index, t('assistant.done.assign', { client: p.clientName }));
      } else if (p.kind === 'exercises') {
        let done = 0;
        const failed: string[] = [];
        for (const it of p.items) {
          try {
            if (it.existingId) await attachVideo.run({ id: it.existingId, videoUrl: it.videoUrl ?? '' });
            else await addExercise.run({ name: it.name, equipment: it.equipment, tags: it.tags, measuredAs: it.measuredAs, ...(it.cues ? { cues: it.cues } : {}), ...(it.videoUrl ? { videoUrl: it.videoUrl } : {}) });
            done++;
          } catch {
            failed.push(it.name);
          }
        }
        settle(index, failed.length ? t('assistant.done.exercisesSome', { n: done, failed: failed.join(', ') }) : t('assistant.done.exercises', { n: done }));
      } else {
        const ids = new Map<string, Id>();
        for (const n of p.newWorkouts) ids.set(n.key, (await saveWorkout.run({ workout: { kind: 'workout', workout: n.workout } })).id);
        const days = p.sessions.map((x) => ({ dayOffset: x.dayOffset, workoutId: (x.workoutId ?? ids.get(x.workoutKey ?? '')) as Id }));
        const saved = await saveProgram.run({ title: p.title, days });
        toast.show(t('assistant.done.program', { title: saved.title }));
        router.push({ pathname: '/program/[id]', params: { id: saved.id } });
      }
    } catch (e) {
      toast.show(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const empty = turns.length === 0;

  return (
    <Screen tabs title={empty ? undefined : t('assistant.title')} trailing={empty ? undefined : <Pressable accessibilityRole="button" accessibilityLabel={t('assistant.new')} disabled={busy} onPress={() => setTurns([])} style={{ padding: 8 }}><Icon name="refresh" size={20} tint={color.muted} /></Pressable>}>
      {empty ? (
        <View style={{ alignItems: 'center', gap: space[4], paddingTop: space[8] }}>
          <Sparkle size={96} active={false} />
          <T variant="label" tone="muted">
            {t('assistant.hello', { name: me.name.split(' ')[0] ?? me.name })}
          </T>
          <T variant="title" style={{ textAlign: 'center' }}>
            {t('assistant.headline')}
          </T>
          <View style={{ gap: 8, width: '100%' }} accessibilityRole="menu" accessibilityLabel={t('assistant.starters')}>
            {STARTERS.map((s) => (
              <Pressable key={s.label} accessibilityRole="button" onPress={() => void send(s.prompt)} style={{ borderRadius: radius.pill, borderWidth: 1, borderColor: color.line, paddingVertical: 12, paddingHorizontal: 16 }}>
                <T variant="bodyStrong" style={{ textAlign: 'center' }}>
                  {s.label}
                </T>
              </Pressable>
            ))}
          </View>
        </View>
      ) : (
        <ScrollView ref={scroll} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: space[4] }} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
          {turns.map((turn, i) =>
            turn.role === 'user' ? (
              <View key={i} style={{ alignSelf: 'flex-end', maxWidth: '86%', backgroundColor: color.brand, borderRadius: radius.card, paddingVertical: 10, paddingHorizontal: 14 }}>
                <T style={{ color: color.onBrand }}>{turn.content}</T>
              </View>
            ) : (
              <View key={i} style={{ alignSelf: 'flex-start', maxWidth: '100%', gap: 8 }}>
                <View style={{ backgroundColor: color.surfaceCard, borderRadius: radius.card, paddingVertical: 10, paddingHorizontal: 14 }}>
                  <Md text={turn.content} />
                </View>
                {turn.proposal ? (
                  <ProposalCard proposal={turn.proposal} measured={measured} resolved={!!turn.resolved} busy={busy} onConfirm={() => void confirm(i, turn.proposal as AssistantProposal)} onCancel={() => settle(i, t('assistant.cancelled'))} />
                ) : null}
              </View>
            ),
          )}
          {thinking ? <Thinking /> : null}
        </ScrollView>
      )}

      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingTop: space[2] }}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={t('assistant.placeholder')}
          placeholderTextColor={color.faint}
          selectionColor={color.brand}
          multiline
          accessibilityLabel={t('assistant.placeholder')}
          style={{
            flex: 1,
            minHeight: 44,
            maxHeight: 120,
            borderRadius: radius.pill,
            borderWidth: 1,
            borderColor: color.fieldEdge,
            backgroundColor: color.fieldBg,
            paddingHorizontal: 16,
            paddingVertical: 10,
            color: color.ink,
          }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('assistant.send')}
          disabled={busy || !draft.trim()}
          onPress={() => void send(draft)}
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: busy || !draft.trim() ? color.surfaceControl : color.brand, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="arrow-up" size={20} tint={busy || !draft.trim() ? color.muted : color.onBrand} />
        </Pressable>
      </View>
    </Screen>
  );
}

const weekday = (offset: number): string => new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(new Date(2026, 9, 12 + (offset % 7), 12));

function ProposalCard({ proposal, measured, resolved, busy, onConfirm, onCancel }: { proposal: AssistantProposal; measured: Map<string, MeasuredAs>; resolved: boolean; busy: boolean; onConfirm: () => void; onCancel: () => void }) {
  const heading =
    proposal.kind === 'workout'
      ? proposal.replaceId
        ? t('assistant.proposal.update')
        : t('assistant.proposal.create')
      : proposal.kind === 'assign_workout'
        ? t('assistant.proposal.assignWorkout')
        : proposal.kind === 'assign_program'
          ? t('assistant.proposal.assignProgram')
          : proposal.kind === 'exercises'
            ? t('assistant.proposal.exercises')
            : t('assistant.proposal.program');
  return (
    <View style={{ gap: 10, backgroundColor: color.surfaceControl, borderRadius: radius.card, padding: 14, opacity: resolved ? 0.6 : 1 }}>
      <T variant="eyebrow" tone="muted">
        {heading}
      </T>
      {proposal.kind === 'workout' ? (
        <View style={{ gap: 8 }}>
          <T variant="heading">{proposal.workout.title}</T>
          {proposal.workout.blocks.map((b) => (
            <View key={b.id} style={{ gap: 2 }}>
              <T variant="bodyStrong">
                {b.title} <T variant="label" tone="muted">· {isTimerBlock(b) ? settingsSummary(b.settings) : blockTypeLabel(b.settings.type)}</T>
              </T>
              {b.items.map((it) => {
                const text = targetText(it.target, measured.get(it.exerciseId) ?? 'reps', isTimerBlock(b));
                return (
                  <T key={it.id} variant="label">
                    {it.exerciseName}
                    {text ? <T variant="label" tone="muted"> · {text}</T> : null}
                  </T>
                );
              })}
            </View>
          ))}
        </View>
      ) : null}
      {proposal.kind === 'assign_workout' ? <T>{t('assistant.proposal.assignWorkout.body', { title: proposal.workoutTitle, client: proposal.clientName, date: formatDay(proposal.date) })}</T> : null}
      {proposal.kind === 'assign_program' ? <T>{t('assistant.proposal.assignProgram.body', { title: proposal.programTitle, client: proposal.clientName, date: formatDay(proposal.startDate) })}</T> : null}
      {proposal.kind === 'exercises' ? (
        <View style={{ gap: 8 }}>
          {proposal.items.map((it) => (
            <View key={it.name} style={{ gap: 2 }}>
              <T variant="bodyStrong">
                {it.name} <T variant="label" tone="muted">· {measuredLabel(it.measuredAs)}{it.tags.length ? ` · ${it.tags.join(', ')}` : ''}</T>
              </T>
              <T variant="label" tone="muted">
                {it.videoUrl ? t('assistant.exercise.video', { title: it.videoTitle || it.videoUrl }) : it.note ?? t('assistant.exercise.noVideo')}
              </T>
            </View>
          ))}
          {proposal.skipped ? (
            <T variant="label" tone="muted">
              {t('assistant.exercise.skipped', { names: proposal.skipped.join(', ') })}
            </T>
          ) : null}
        </View>
      ) : null}
      {proposal.kind === 'program' ? (
        <View style={{ gap: 8 }}>
          <T variant="heading">{proposal.title}</T>
          <T variant="label" tone="muted">
            {t('assistant.program.summary', { weeks: Math.floor(Math.max(...proposal.sessions.map((x) => x.dayOffset)) / 7) + 1, sessions: proposal.sessions.length })}
          </T>
          {proposal.newWorkouts.length > 0 ? (
            <View style={{ gap: 2 }}>
              <T variant="bodyStrong">{t('assistant.program.newWorkouts', { n: proposal.newWorkouts.length })}</T>
              {proposal.newWorkouts.map((n) => (
                <T key={n.key}>{n.workout.title}</T>
              ))}
            </View>
          ) : null}
          <View style={{ gap: 2 }}>
            <T variant="bodyStrong">{t('assistant.program.week1')}</T>
            {proposal.sessions
              .filter((x) => x.dayOffset < 7)
              .map((x) => (
                <T key={x.dayOffset} variant="label">
                  <T variant="label" tone="muted">
                    {weekday(x.dayOffset)} ·{' '}
                  </T>
                  {x.title}
                </T>
              ))}
          </View>
        </View>
      ) : null}
      {!resolved ? (
        <View style={{ gap: 8 }}>
          <Button fullWidth size="md" loading={busy} disabled={busy} onPress={onConfirm}>
            {t('assistant.confirm')}
          </Button>
          <Button fullWidth size="md" variant="secondary" disabled={busy} onPress={onCancel}>
            {t('assistant.cancel')}
          </Button>
        </View>
      ) : null}
    </View>
  );
}
