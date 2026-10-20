import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMe } from '../../core/auth';
import { CalendarView, monthRange } from '../../components/CalendarView';
import { ProgramBar } from '../../components/CoachOverview';
import { PackageCard } from '../../components/PackageCard';
import { SummaryStats } from '../../components/ProgressHero';
import { errorMessage, useAction, useData } from '../../hooks/data';
import { keys } from '../../hooks/keys';
import { formatDateLong, formatDateShort, formatDay, t } from '../../i18n';
import { addDays, daysBetween, startOfMonth, todayISO } from '../../lib/date';
import type { Assignment, ISODate, Package, Profile } from '../../types';
import { Button, Card, ConfirmDialog, DataBoundary, DateField, EmptyState, Icon, List, ListRow, Screen, Sheet, Skeleton, StatusChip, T, color, useToast } from '../../ui';
import { AssignSheet } from './AssignSheet';
import { PackageSheet } from './PackageSheet';

const lastActive = (iso: string | null): string => {
  if (!iso) return t('clients.last.never');
  const n = daysBetween(iso, todayISO());
  return n <= 0 ? t('clients.last.today') : n === 1 ? t('clients.last.yesterday') : t('clients.last.days', { n });
};

export function ClientScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const clients = useData(keys.clients, (s) => s.listClients());
  return (
    <DataBoundary query={clients} skeleton="detail">
      {(list) => {
        const client = list.find((c) => c.id === id);
        return client ? (
          <ClientView client={client} />
        ) : (
          <Screen back title={t('client.notFound.title')}>
            <EmptyState icon="users" title={t('client.notFound.title')} body={t('client.notFound.body')} action={t('client.notFound.action')} onAction={() => router.back()} />
          </Screen>
        );
      }}
    </DataBoundary>
  );
}

function ClientView({ client }: { client: Profile }) {
  const [assignOpen, setAssignOpen] = useState(false);
  return (
    <Screen
      back
      title={client.name}
      subtitle={client.email}
      trailing={
        <Button size="sm" icon="plus" fullWidth={false} onPress={() => setAssignOpen(true)}>
          {t('client.assign')}
        </Button>
      }
    >
      <ClientSummary client={client} />
      <ProgramSection client={client} />
      <CalendarSection client={client} />
      <PackageSection client={client} />
      <RecentLogs client={client} />
      <RecordsSection client={client} />
      <AssignSheet open={assignOpen} onClose={() => setAssignOpen(false)} clientId={client.id} />
    </Screen>
  );
}

function ClientSummary({ client }: { client: Profile }) {
  const summary = useData(keys.summary(client.id), (s) => s.getProgressSummary(client.id));
  if (summary.isPending) return <Skeleton variant="card" />;
  if (!summary.data || summary.data.assigned === 0) return null;
  return <SummaryStats summary={summary.data} />;
}

function ProgramSection({ client }: { client: Profile }) {
  const overview = useData(keys.overview, (s) => s.getCoachOverview());
  const mine = overview.data?.perClient.find((c) => c.clientId === client.id);
  if (!mine) return null;
  return (
    <View style={{ gap: 12 }}>
      <T variant="eyebrow">{t('clients.panel.program')}</T>
      <Card>
        <ProgramBar progress={mine.program} />
        {mine.program ? (
          <T variant="caption" tone="muted">
            {t('clients.panel.sessions', { done: mine.program.sessionsDone, total: mine.program.sessionsTotal })}
          </T>
        ) : null}
        <T variant="caption" tone="muted">
          {t('clients.col.last')}: {lastActive(mine.lastActiveOn)}
        </T>
      </Card>
    </View>
  );
}

function CalendarSection({ client }: { client: Profile }) {
  const router = useRouter();
  const toast = useToast();
  const today = todayISO();
  const [month, setMonth] = useState(startOfMonth(today));
  const [selected, setSelected] = useState<ISODate>(today);
  const { from, to } = monthRange(month);
  const assignments = useData(keys.assignments(client.id, from, to), (s) => s.listAssignments({ clientId: client.id, from, to }));
  const [moving, setMoving] = useState<Assignment | null>(null);
  const [moveDate, setMoveDate] = useState<ISODate>(today);
  const [deleting, setDeleting] = useState<Assignment | null>(null);

  const move = useAction((s, a: { id: string; date: ISODate }) => s.updateAssignment(a.id, { date: a.date }), { invalidate: [keys.assignmentsAll] });
  const remove = useAction((s, id: string) => s.deleteAssignment(id), { invalidate: [keys.assignmentsAll] });
  const day = (assignments.data ?? []).filter((a) => a.date === selected);

  return (
    <View style={{ gap: 12 }}>
      <T variant="eyebrow">{t('client.calendar')}</T>
      <CalendarView
        month={month}
        selected={selected}
        assignments={assignments.data ?? []}
        onSelect={setSelected}
        onMonthChange={(m) => {
          setMonth(m);
          setSelected(m);
        }}
      />
      <T variant="bodyStrong">{formatDateLong(selected)}</T>
      <DataBoundary query={assignments} rows={2} isEmpty={() => day.length === 0} empty={<T tone="muted">{t('client.day.empty')}</T>}>
        {() => (
          <View style={{ gap: 8 }}>
            {day.map((a) => (
              <Card key={a.id} style={{ gap: 8 }}>
                <ListRow
                  title={a.workout.title}
                  subtitle={a.workout.blocks.map((b) => b.title).join(' · ')}
                  trailing={<StatusChip kind="assignment" value={a.status} />}
                  chevron
                  onPress={() => router.push({ pathname: '/review/[id]', params: { id: a.id } })}
                />
                {a.status === 'not_started' ? (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Button
                        size="sm"
                        variant="secondary"
                        icon="calendar"
                        onPress={() => {
                          setMoveDate(a.date);
                          setMoving(a);
                        }}
                      >
                        {t('assignment.move.submit')}
                      </Button>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Button size="sm" variant="destructive" icon="trash" onPress={() => setDeleting(a)}>
                        {t('common.delete')}
                      </Button>
                    </View>
                  </View>
                ) : null}
              </Card>
            ))}
          </View>
        )}
      </DataBoundary>

      <Sheet
        open={moving !== null}
        title={t('assignment.move.title')}
        onClose={() => setMoving(null)}
        footer={
          <Button
            size="md"
            loading={move.isPending}
            onPress={() =>
              moving &&
              void move
                .run({ id: moving.id, date: moveDate })
                .then(() => {
                  toast.show(t('assignment.moved', { date: formatDateShort(moveDate) }));
                  setMoving(null);
                  setSelected(moveDate);
                  setMonth(startOfMonth(moveDate));
                })
                .catch((e: unknown) => toast.show(errorMessage(e), 'error'))
            }
          >
            {t('assignment.move.submit')}
          </Button>
        }
      >
        <DateField label={t('assignment.move.date')} value={moveDate} onChange={setMoveDate} />
      </Sheet>
      <ConfirmDialog
        open={deleting !== null}
        destructive
        title={t('assignment.delete.title')}
        body={t('assignment.delete.body', { title: deleting?.workout.title ?? '', date: deleting ? formatDay(deleting.date) : '' })}
        confirmLabel={t('common.delete')}
        busy={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() =>
          deleting &&
          void remove
            .run(deleting.id)
            .then(() => {
              toast.show(t('assignment.deleted'));
              setDeleting(null);
            })
            .catch((e: unknown) => toast.show(errorMessage(e), 'error'))
        }
      />
    </View>
  );
}

function RecentLogs({ client }: { client: Profile }) {
  const router = useRouter();
  const today = todayISO();
  const from = addDays(today, -45);
  const recent = useData(keys.assignments(client.id, from, today), (s) => s.listAssignments({ clientId: client.id, from, to: today }));
  return (
    <View style={{ gap: 12 }}>
      <T variant="eyebrow">{t('client.logs')}</T>
      <DataBoundary query={recent} rows={3} isEmpty={(d) => d.every((a) => a.status !== 'completed')} empty={{ icon: 'list', title: t('client.logs.empty.title'), body: t('client.logs.empty.body') }}>
        {(list) => (
          <List>
            {list
              .filter((a) => a.status === 'completed')
              .reverse()
              .slice(0, 5)
              .map((a) => (
                <ListRow key={a.id} title={a.workout.title} subtitle={formatDateShort(a.date)} trailing={<StatusChip kind="assignment" value="completed" />} chevron onPress={() => router.push({ pathname: '/review/[id]', params: { id: a.id } })} />
              ))}
          </List>
        )}
      </DataBoundary>
    </View>
  );
}

function RecordsSection({ client }: { client: Profile }) {
  const records = useData(keys.records(client.id), (s) => s.listPersonalRecords(client.id));
  return (
    <View style={{ gap: 12 }}>
      <T variant="eyebrow">{t('client.records')}</T>
      <DataBoundary query={records} rows={2} empty={{ icon: 'trophy', title: t('records.empty.title'), body: t('records.empty.coach') }}>
        {(list) => (
          <List>
            {list.slice(0, 6).map((r) => (
              <ListRow key={r.exerciseId} title={r.exerciseName} subtitle={formatDay(r.achievedOn)} leading={<Icon name="trophy-duo" size={28} tint={color.brand} />} trailing={<T variant="metric">{r.label}</T>} />
            ))}
          </List>
        )}
      </DataBoundary>
    </View>
  );
}

function PackageSection({ client }: { client: Profile }) {
  const me = useMe();
  const toast = useToast();
  const packages = useData(keys.packages(client.id), (s) => s.listPackages(client.id));
  const [editing, setEditing] = useState<Package | 'new' | null>(null);
  const markUsed = useAction((s, p: Package) => s.savePackage({ ...p, sessionsUsed: p.sessionsUsed + 1 }), { invalidate: [keys.packages(client.id), keys.overview] });

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <T variant="eyebrow">{t('client.package')}</T>
        <Button size="sm" variant="secondary" icon="plus" fullWidth={false} onPress={() => setEditing('new')}>
          {t('package.new')}
        </Button>
      </View>
      <DataBoundary query={packages} skeleton="card" empty={<PackageCard pkg={null} />}>
        {(list) => {
          const current = list.find((p) => p.state !== 'expired') ?? list[0];
          if (!current) return <PackageCard pkg={null} />;
          return (
            <View style={{ gap: 8 }}>
              <PackageCard pkg={current} />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Button
                    size="sm"
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
                <View style={{ flex: 1 }}>
                  <Button size="sm" variant="tertiary" icon="edit" onPress={() => setEditing(current)}>
                    {t('common.edit')}
                  </Button>
                </View>
              </View>
            </View>
          );
        }}
      </DataBoundary>
      <PackageSheet open={editing !== null} onClose={() => setEditing(null)} clientId={client.id} workspaceId={me.workspaceId} pkg={editing && editing !== 'new' ? editing : undefined} />
    </View>
  );
}
