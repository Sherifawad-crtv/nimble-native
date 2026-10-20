import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { errorMessage, useAction, useData } from '../hooks/data';
import { keys } from '../hooks/keys';
import { formatTimeAgo, t } from '../i18n';
import type { Id, Role } from '../types';
import { Button, DataBoundary, T, color, radius, useToast } from '../ui';

/** Workout comments, for both coach and client. */
export function Comments({ assignmentId, viewer }: { assignmentId: Id; viewer: Role }) {
  const toast = useToast();
  const [draft, setDraft] = useState('');
  const comments = useData(keys.comments(assignmentId), (s) => s.listComments(assignmentId));
  const add = useAction((s, body: string) => s.addComment(assignmentId, body), { invalidate: [keys.comments(assignmentId)] });

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    void add
      .run(text)
      .then(() => setDraft(''))
      .catch((e: unknown) => toast.show(errorMessage(e), 'error'));
  };

  return (
    <View style={{ gap: 12 }}>
      <T variant="eyebrow">{t('comments.title')}</T>
      <DataBoundary query={comments} skeleton="list" rows={2} isEmpty={() => false}>
        {(list) => (
          <View style={{ gap: 8 }}>
            {list.length === 0 ? (
              <T tone="muted">{t('comments.empty')}</T>
            ) : (
              list.map((c) => {
                const mine = c.authorRole === viewer;
                return (
                  <View key={c.id} style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                    <T variant="caption" style={{ color: mine ? 'rgba(0,0,0,0.6)' : color.muted }}>
                      {mine ? t('comments.you') : c.authorName} · {formatTimeAgo(c.createdAt)}
                    </T>
                    <T variant="body" tone={mine ? 'onBrand' : 'ink'}>
                      {c.body}
                    </T>
                  </View>
                );
              })
            )}
          </View>
        )}
      </DataBoundary>
      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder={t('comments.placeholder')}
          placeholderTextColor={color.faint}
          multiline
          maxLength={1000}
          accessibilityLabel={t('comments.placeholder')}
        />
        <Button size="sm" fullWidth={false} loading={add.isPending} disabled={!draft.trim()} onPress={send}>
          {t('comments.send')}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: { maxWidth: '88%', padding: 12, borderRadius: 20, gap: 2 },
  mine: { alignSelf: 'flex-end', backgroundColor: color.brand, borderBottomRightRadius: 6 },
  theirs: { alignSelf: 'flex-start', backgroundColor: color.surfaceControl, borderBottomLeftRadius: 6 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: { flex: 1, minHeight: 48, maxHeight: 120, borderRadius: radius.card, backgroundColor: color.fieldBg, color: color.ink, paddingHorizontal: 16, paddingTop: 13, paddingBottom: 13, fontSize: 16 },
});
