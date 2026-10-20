import { View } from 'react-native';
import { t } from '../i18n';
import { formatSet, formatTimerResult } from '../lib/results';
import { blockTypeLabel, isTimerBlock, settingsSummary } from '../lib/workout';
import type { Assignment, WorkoutLog } from '../types';
import { Card, T } from '../ui';
import { BlockHeader } from './BlockHeader';

/** Read-only account of what the client did, block by block. Used by both roles. */
export function WorkoutResults({ assignment, log }: { assignment: Assignment; log: WorkoutLog | null | undefined }) {
  return (
    <View style={{ gap: 12 }}>
      {assignment.workout.blocks.map((b) => {
        const timer = isTimerBlock(b);
        const timerResult = log?.timerResults.find((r) => r.blockId === b.id)?.result;
        return (
          <Card key={b.id}>
            <BlockHeader title={b.title} type={blockTypeLabel(b.settings.type)} />
            {timer ? (
              <>
                <T variant="label" tone="muted">
                  {settingsSummary(b.settings)}
                </T>
                <T variant="metric" tone="brand">
                  {timerResult ? formatTimerResult(timerResult) : t('results.noTimer')}
                </T>
              </>
            ) : null}
            {b.items.map((it) => {
              const sets = log?.itemResults.find((r) => r.itemId === it.id)?.sets ?? [];
              return (
                <View key={it.id} style={{ gap: 2, paddingVertical: 4 }}>
                  <T variant="bodyStrong">{it.exerciseName}</T>
                  {!timer ? (
                    <T tone="muted">{sets.length ? sets.map((s) => formatSet(s)).join('  ·  ') : t('results.noSets')}</T>
                  ) : null}
                </View>
              );
            })}
          </Card>
        );
      })}
      {log?.clientNote ? (
        <Card>
          <T variant="heading">{t('results.note')}</T>
          <T>{log.clientNote}</T>
        </Card>
      ) : null}
    </View>
  );
}
