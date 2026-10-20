import { View } from 'react-native';
import { useMe } from '../../app/auth';
import { ExerciseChart } from '../../components/ExerciseChart';
import { useData } from '../../hooks/data';
import { keys } from '../../hooks/keys';
import { formatDay, t } from '../../i18n';
import { DataBoundary, Icon, List, ListRow, Screen, T, color } from '../../ui';

export function ProgressScreen() {
  const me = useMe();
  const summary = useData(keys.summary(me.id), (s) => s.getProgressSummary(me.id));
  const records = useData(keys.records(me.id), (s) => s.listPersonalRecords(me.id));
  const progress = useData(keys.progress(me.id), (s) => s.listExerciseProgress(me.id));

  return (
    <Screen
      tabs
      title={t('progress.title')}
      accent={summary.data ? `${summary.data.completionPct}%` : undefined}
      subtitle={t('progress.subtitle')}
      refreshing={progress.isRefetching}
      onRefresh={() => {
        void summary.refetch();
        void records.refetch();
        void progress.refetch();
      }}
    >
      <View style={{ gap: 12 }}>
        <T variant="eyebrow">{t('progress.records')}</T>
        <DataBoundary query={records} rows={3} empty={{ icon: 'trophy', title: t('records.empty.title'), body: t('records.empty.client') }}>
          {(list) => (
            <List>
              {list.map((r) => (
                <ListRow
                  key={r.exerciseId}
                  title={r.exerciseName}
                  subtitle={formatDay(r.achievedOn)}
                  leading={<Icon name="trophy-duo" size={28} tint={color.brand} />}
                  trailing={<T variant="metric">{r.label}</T>}
                />
              ))}
            </List>
          )}
        </DataBoundary>
      </View>

      <View style={{ gap: 12 }}>
        <T variant="eyebrow">{t('progress.history')}</T>
        <DataBoundary query={progress} skeleton="chart" isEmpty={(d) => d.every((p) => p.points.length < 2)} empty={{ icon: 'pulse', title: t('progress.empty.title'), body: t('progress.empty.body') }}>
          {(list) => (
            <View style={{ gap: 12 }}>
              {list
                .filter((p) => p.points.length >= 2)
                .slice(0, 6)
                .map((p) => (
                  <ExerciseChart key={p.exerciseId} progress={p} />
                ))}
            </View>
          )}
        </DataBoundary>
      </View>
    </Screen>
  );
}
