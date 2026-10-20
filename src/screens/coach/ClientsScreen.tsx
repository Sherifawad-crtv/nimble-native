import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CoachStats, ProgramBar } from '../../components/CoachOverview';
import { NotifyPrompt } from '../../components/NotifyPrompt';
import { useData } from '../../hooks/data';
import { keys } from '../../hooks/keys';
import { t } from '../../i18n';
import { todayISO } from '../../lib/date';
import type { Assignment } from '../../types';
import { Avatar, DataBoundary, IconButton, Screen, Skeleton, StatusChip, T, color } from '../../ui';
import { InviteSheet } from './InviteSheet';

export function ClientsScreen() {
  const router = useRouter();
  const today = todayISO();
  const clients = useData(keys.clients, (s) => s.listClients());
  const overview = useData(keys.overview, (s) => s.getCoachOverview());
  const progress = new Map((overview.data?.perClient ?? []).map((c) => [c.clientId, c.program]));
  const todays = useData(keys.assignments(undefined, today, today), (s) => s.listAssignments({ from: today, to: today }));
  const byClient = new Map<string, Assignment>();
  for (const a of todays.data ?? []) byClient.set(a.clientId, a);
  const [inviting, setInviting] = useState(false);

  return (
    <Screen
      tabs
      title={t('clients.title')}
      subtitle={t('clients.subtitle')}
      trailing={<IconButton icon="plus" label={t('clients.invite')} onPress={() => setInviting(true)} />}
      refreshing={clients.isRefetching}
      onRefresh={() => {
        void clients.refetch();
        void overview.refetch();
        void todays.refetch();
      }}
    >
      {overview.isPending ? <Skeleton variant="card" /> : overview.data && overview.data.clients > 0 ? <CoachStats overview={overview.data} /> : null}
      <DataBoundary query={clients} empty={{ icon: 'users', title: t('clients.empty.title'), body: t('clients.empty.body'), action: t('clients.invite'), onAction: () => setInviting(true) }}>
        {(list) => (
          <View style={{ backgroundColor: color.surfaceCard, borderRadius: 24, overflow: 'hidden' }}>
            {list.map((c) => {
              const a = byClient.get(c.id);
              return (
                <Pressable key={c.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/client/[id]', params: { id: c.id } })} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 0.5, borderBottomColor: color.line }, pressed && { backgroundColor: color.surfaceControl }]}>
                  <Avatar name={c.name} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <T variant="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>
                        {c.name}
                      </T>
                      {a ? <StatusChip kind="assignment" value={a.status} /> : null}
                    </View>
                    <T variant="caption" tone="muted" numberOfLines={1}>
                      {todays.isPending ? '…' : a ? a.workout.title : t('clients.today.none')}
                    </T>
                    {overview.data ? <ProgramBar progress={progress.get(c.id) ?? null} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </DataBoundary>
      <InviteSheet open={inviting} onClose={() => setInviting(false)} />
      <NotifyPrompt />
    </Screen>
  );
}
