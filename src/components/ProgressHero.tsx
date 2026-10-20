import { useMe } from '../core/auth';
import { useData } from '../hooks/data';
import { keys } from '../hooks/keys';
import { t } from '../i18n';
import { compact } from '../lib/chart';
import type { ProgressSummary } from '../types';
import { DataBoundary, Skeleton, StatCard, StatGrid } from '../ui';

/** The four headline numbers for a client, all worked out by the service. */
export function SummaryStats({ summary: s }: { summary: ProgressSummary }) {
  return (
    <StatGrid>
      <StatCard tone="brand" icon="weight-duo" value={s.weightLiftedKg < 100_000 ? s.weightLiftedKg.toLocaleString() : compact(s.weightLiftedKg)} label={t('progress.stat.weight')} />
      <StatCard tone="blue" icon="check-circle-duo" value={String(s.completed)} label={t('progress.stat.workouts')} />
      <StatCard tone="pink" icon="flame-duo" value={String(s.streakWeeks)} label={t('progress.stat.streak')} />
      <StatCard tone="green" icon="trophy-duo" value={String(s.personalRecords)} label={t('progress.stat.records')} />
    </StatGrid>
  );
}

/** The top of the client's home: the four headline numbers. Nothing is shown until there is history. */
export function ProgressHero({ quietWhenEmpty = false }: { quietWhenEmpty?: boolean }) {
  const me = useMe();
  const summary = useData(keys.summary(me.id), (s) => s.getProgressSummary(me.id));
  if (summary.isPending) return <Skeleton variant="card" />;
  if (quietWhenEmpty && (summary.isError || summary.data?.assigned === 0)) return null;
  return (
    <DataBoundary query={summary} skeleton="card" isEmpty={(s) => s.assigned === 0} empty={{ icon: 'calendar', title: t('progress.none.title'), body: t('progress.none.body') }}>
      {(s) => <SummaryStats summary={s} />}
    </DataBoundary>
  );
}
