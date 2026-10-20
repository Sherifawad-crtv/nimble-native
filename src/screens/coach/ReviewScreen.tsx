import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Comments } from '../../components/Comments';
import { WorkoutPlan } from '../../components/WorkoutPlan';
import { WorkoutResults } from '../../components/WorkoutResults';
import { errorMessage, useAction, useData } from '../../hooks/data';
import { keys } from '../../hooks/keys';
import { formatDateLong, t } from '../../i18n';
import type { Assignment } from '../../types';
import { Banner, Button, DataBoundary, Screen, StatusChip, T, useToast } from '../../ui';

export function ReviewScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const assignment = useData(keys.assignment(id), (s) => s.getAssignment(id));
  return (
    <DataBoundary query={assignment} skeleton="detail">
      {(a) => <ReviewView assignment={a} />}
    </DataBoundary>
  );
}

function ReviewView({ assignment: a }: { assignment: Assignment }) {
  const toast = useToast();
  const clients = useData(keys.clients, (s) => s.listClients());
  const log = useData(keys.log(a.id), (s) => s.getLog(a.id), { enabled: a.status !== 'not_started' });
  const exercises = useData(keys.exercises(), (s) => s.listExercises());
  const packages = useData(keys.packages(a.clientId), (s) => s.listPackages(a.clientId), { enabled: a.status === 'completed' });
  const markUsed = useAction((s, p: NonNullable<typeof packages.data>[number]) => s.savePackage({ ...p, sessionsUsed: p.sessionsUsed + 1 }), { invalidate: [keys.packages(a.clientId), keys.overview] });

  const client = clients.data?.find((c) => c.id === a.clientId);
  const current = packages.data?.find((p) => p.state !== 'expired');

  return (
    <Screen back title={a.workout.title} subtitle={`${client?.name ?? ''} · ${formatDateLong(a.date)}`} trailing={<StatusChip kind="assignment" value={a.status} />}>
      {a.status === 'not_started' ? (
        <>
          <Banner title={t('review.notStarted')} />
          <DataBoundary query={exercises} skeleton="card">
            {(list) => <WorkoutPlan assignment={a} exercises={list} />}
          </DataBoundary>
        </>
      ) : null}
      {a.status === 'skipped' ? <Banner title={t('review.skipped')} /> : null}
      {a.status === 'in_progress' ? <Banner title={t('review.inProgress.title')} message={t('review.inProgress.body')} /> : null}
      {a.status === 'completed' || a.status === 'in_progress' ? (
        <DataBoundary query={log} skeleton="card">
          {(l) => <WorkoutResults assignment={a} log={l} />}
        </DataBoundary>
      ) : null}
      {a.status === 'completed' && current ? (
        <View style={{ gap: 8 }}>
          <T variant="eyebrow">{t('review.package')}</T>
          <T tone="muted">{t('review.package.body', { name: current.name, left: current.sessionsRemaining })}</T>
          <Button
            size="md"
            variant="secondary"
            disabled={current.sessionsRemaining === 0}
            loading={markUsed.isPending}
            onPress={() =>
              void markUsed
                .run(current)
                .then(() => toast.show(t('package.marked')))
                .catch((e: unknown) => toast.show(errorMessage(e), 'error'))
            }
          >
            {t('package.markUsed')}
          </Button>
        </View>
      ) : null}
      <Comments assignmentId={a.id} viewer="coach" />
    </Screen>
  );
}
