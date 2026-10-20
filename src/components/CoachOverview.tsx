import { View } from 'react-native';
import { formatDateShort, t } from '../i18n';
import type { CoachOverview, ProgramProgress } from '../types';
import { ProgressBar, StatCard, StatGrid, T } from '../ui';

/** The coach's headline numbers: everything here is worked out by the service. */
export function CoachStats({ overview }: { overview: CoachOverview }) {
  return (
    <StatGrid>
      <StatCard tone="brand" icon="users-duo" value={String(overview.clients)} label={t('clients.stat.clients')} />
      <StatCard tone="green" icon="active-duo" value={String(overview.activeThisWeek)} label={t('clients.stat.active')} />
      <StatCard tone="blue" icon="today-duo" value={`${overview.todayDone}/${overview.todayPlanned}`} label={t('clients.stat.today')} />
      <StatCard tone="pink" icon="renew-duo" value={String(overview.packagesToRenew)} label={t('clients.stat.renew')} />
    </StatGrid>
  );
}

/** How far a client is through their program: the program and week, over a thin bar. */
export function ProgramBar({ progress }: { progress: ProgramProgress | null }) {
  if (!progress)
    return (
      <T variant="caption" tone="muted">
        {t('clients.prog.none')}
      </T>
    );
  const caption = progress.state === 'upcoming' ? t('clients.prog.upcoming', { date: formatDateShort(progress.startsOn) }) : progress.state === 'finished' ? t('clients.prog.finished') : t('clients.prog.week', { week: progress.week, weeks: progress.weeks });
  return (
    <View style={{ gap: 6, marginTop: 6 }} accessible accessibilityLabel={t('clients.prog.aria', { title: progress.title, percent: progress.percent })}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <T variant="caption" style={{ flexShrink: 1 }} numberOfLines={1}>
          {progress.title}
        </T>
        <T variant="caption" tone="muted">
          {caption}
        </T>
      </View>
      <ProgressBar percent={progress.percent} muted={progress.state !== 'active'} />
    </View>
  );
}
