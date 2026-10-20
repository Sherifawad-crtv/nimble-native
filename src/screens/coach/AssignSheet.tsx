import { useState } from 'react';
import { View } from 'react-native';
import { errorMessage, useAction, useData } from '../../hooks/data';
import { keys } from '../../hooks/keys';
import { t, tp } from '../../i18n';
import { todayISO } from '../../lib/date';
import type { Id, ISODate } from '../../types';
import { Button, CheckRow, Chip, DataBoundary, DateField, IconButton, Segmented, SelectField, Sheet, T, useToast } from '../../ui';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Fixes the client (assigning from a client page). */
  clientId?: Id;
  /** Fixes the workout (assigning from the template list). */
  workoutId?: Id;
  /** Fixes the program (assigning from the program list). */
  programId?: Id;
}

/** Assign a workout to clients on dates, or start a program for a client. */
export function AssignSheet(props: Props) {
  return (
    <Sheet open={props.open} title={t('assign.title')} onClose={props.onClose}>
      <AssignForm {...props} />
    </Sheet>
  );
}

function AssignForm({ onClose, clientId, workoutId, programId }: Props) {
  const toast = useToast();
  const needsPick = !workoutId && !programId;
  const clients = useData(keys.clients, (s) => s.listClients(), { enabled: !clientId });
  const templates = useData(keys.templates, (s) => s.listTemplates(), { enabled: needsPick });
  const programs = useData(keys.programs, (s) => s.listPrograms(), { enabled: needsPick });

  const [mode, setMode] = useState<'workout' | 'program'>(programId ? 'program' : 'workout');
  const [pickedWorkout, setPickedWorkout] = useState<Id | undefined>(workoutId);
  const [pickedProgram, setPickedProgram] = useState<Id | undefined>(programId);
  const [selected, setSelected] = useState<Id[]>(clientId ? [clientId] : []);
  const [dates, setDates] = useState<ISODate[]>([todayISO()]);
  const [startDate, setStartDate] = useState<ISODate>(todayISO());
  const [error, setError] = useState<string>();

  const assignWorkout = useAction((s, a: { clientIds: Id[]; workoutId: Id; dates: ISODate[] }) => s.assignWorkout(a), { invalidate: [keys.assignmentsAll] });
  const assignProgram = useAction(async (s, a: { clientIds: Id[]; programId: Id; startDate: ISODate }) => (await Promise.all(a.clientIds.map((c) => s.assignProgram({ clientId: c, programId: a.programId, startDate: a.startDate })))).flat(), {
    invalidate: [keys.assignmentsAll],
  });

  const isProgram = programId ? true : workoutId ? false : mode === 'program';
  const workout = workoutId ?? pickedWorkout;
  const program = programId ?? pickedProgram;
  const busy = assignWorkout.isPending || assignProgram.isPending;

  const submit = async () => {
    if (!selected.length) return setError(t('assign.error.client'));
    if (isProgram ? !program : !workout) return setError(t(isProgram ? 'assign.error.program' : 'assign.error.workout'));
    const unique = [...new Set(dates.filter(Boolean))];
    if (!isProgram && !unique.length) return setError(t('assign.error.date'));
    setError(undefined);
    try {
      const made = isProgram ? await assignProgram.run({ clientIds: selected, programId: program as Id, startDate }) : await assignWorkout.run({ clientIds: selected, workoutId: workout as Id, dates: unique });
      toast.show(tp('assign.done', made.length));
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <View style={{ gap: 16 }}>
      {needsPick ? (
        <>
          <Segmented
            options={[
              { id: 'workout', label: t('assign.mode.workout') },
              { id: 'program', label: t('assign.mode.program') },
            ]}
            value={mode}
            onChange={(id) => setMode(id as 'workout' | 'program')}
          />
          {mode === 'workout' ? (
            <DataBoundary query={templates} skeleton="list" rows={2} empty={{ icon: 'dumbbell', title: t('assign.empty.templates') }}>
              {(list) => <SelectField label={t('assign.workout')} options={list.map((w) => ({ id: w.id, label: w.title }))} value={pickedWorkout} onChange={setPickedWorkout} placeholder={t('assign.choose')} />}
            </DataBoundary>
          ) : (
            <DataBoundary query={programs} skeleton="list" rows={2} empty={{ icon: 'list', title: t('assign.empty.programs') }}>
              {(list) => <SelectField label={t('assign.program')} options={list.map((p) => ({ id: p.id, label: p.title }))} value={pickedProgram} onChange={setPickedProgram} placeholder={t('assign.choose')} />}
            </DataBoundary>
          )}
        </>
      ) : null}

      {!clientId ? (
        <View style={{ gap: 4 }}>
          <T variant="label" tone="muted">
            {t('assign.clients')}
          </T>
          <DataBoundary query={clients} skeleton="list" rows={3} empty={{ icon: 'users', title: t('clients.empty.title') }}>
            {(list) => list.map((c) => <CheckRow key={c.id} label={c.name} checked={selected.includes(c.id)} onChange={(on) => setSelected(on ? [...selected, c.id] : selected.filter((x) => x !== c.id))} />)}
          </DataBoundary>
        </View>
      ) : null}

      {isProgram ? (
        <DateField label={t('assign.startDate')} value={startDate} onChange={setStartDate} />
      ) : (
        <View style={{ gap: 12 }}>
          {dates.map((d, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <DateField label={dates.length > 1 ? t('assign.dateN', { n: i + 1 }) : t('assign.date')} value={d} onChange={(v) => setDates(dates.map((x, j) => (j === i ? v : x)))} />
              </View>
              {dates.length > 1 ? <IconButton icon="close" label={t('assign.removeDate', { n: i + 1 })} onPress={() => setDates(dates.filter((_, j) => j !== i))} /> : null}
            </View>
          ))}
          <View style={{ flexDirection: 'row' }}>
            <Chip label={`+ ${t('assign.addDate')}`} onPress={() => setDates([...dates, dates.at(-1) ?? todayISO()])} />
          </View>
        </View>
      )}

      {error ? (
        <T variant="label" tone="danger" accessibilityRole="alert">
          {error}
        </T>
      ) : null}
      <Button size="md" loading={busy} onPress={() => void submit()}>
        {t('assign.submit')}
      </Button>
    </View>
  );
}
