import { Share, View } from 'react-native';
import * as Linking from 'expo-linking';
import { errorMessage, useAction, useData } from '../../hooks/data';
import { keys } from '../../hooks/keys';
import { formatTimeAgo, t } from '../../i18n';
import type { Invite } from '../../types';
import { Button, DataBoundary, IconButton, List, ListRow, Sheet, T, useToast } from '../../ui';

/** The link a client opens to sign up with the code already filled in. */
export const inviteLink = (code: string) => {
  const web = process.env.EXPO_PUBLIC_WEB_URL;
  return web ? `${web.replace(/\/$/, '')}/?invite=${encodeURIComponent(code)}` : Linking.createURL('/', { queryParams: { invite: code } });
};

/** Invite codes for the workspace: create, share, revoke. */
export function InviteSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const invites = useData(keys.invites, (s) => s.listInvites(), { enabled: open });
  const create = useAction((s, _: void) => s.createInvite(), { invalidate: [keys.invites] });
  const revoke = useAction((s, code: string) => s.revokeInvite(code), { invalidate: [keys.invites] });

  const share = async (invite: Invite) => {
    try {
      await Share.share({ message: t('invites.shareText', { code: invite.code, link: inviteLink(invite.code) }) });
    } catch (e) {
      toast.show(errorMessage(e), 'error');
    }
  };

  return (
    <Sheet
      open={open}
      title={t('invites.title')}
      onClose={onClose}
      footer={
        <Button size="md" icon="plus" loading={create.isPending} onPress={() => void create.run().catch((e: unknown) => toast.show(errorMessage(e), 'error'))}>
          {t('invites.create')}
        </Button>
      }
    >
      <T tone="muted">{t('invites.body')}</T>
      <DataBoundary query={invites} rows={2} empty={<T tone="muted">{t('invites.empty')}</T>}>
        {(list) => (
          <List>
            {list.map((i) => (
              <ListRow
                key={i.code}
                title={i.code}
                subtitle={t('invites.created', { date: formatTimeAgo(i.createdAt) })}
                trailing={
                  <View style={{ flexDirection: 'row' }}>
                    <IconButton icon="share" label={t('invites.share')} variant="ghost" onPress={() => void share(i)} />
                    <IconButton
                      icon="trash"
                      label={t('invites.revoke')}
                      variant="ghost"
                      onPress={() =>
                        void revoke
                          .run(i.code)
                          .then(() => toast.show(t('invites.revoked')))
                          .catch((e: unknown) => toast.show(errorMessage(e), 'error'))
                      }
                    />
                  </View>
                }
              />
            ))}
          </List>
        )}
      </DataBoundary>
    </Sheet>
  );
}
