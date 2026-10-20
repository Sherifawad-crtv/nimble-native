import { View } from 'react-native';
import { t } from '../i18n';
import { blockTypeLabel, isTimerBlock, settingsSummary, targetText } from '../lib/workout';
import type { Assignment, Exercise, MeasuredAs } from '../types';
import { Card, T } from '../ui';
import { BlockHeader } from './BlockHeader';

/** The prescribed workout, read-only. */
export function WorkoutPlan({ assignment, exercises }: { assignment: Assignment; exercises: Exercise[] }) {
  const measured = new Map<string, MeasuredAs>(exercises.map((e) => [e.id, e.measuredAs]));
  return (
    <View style={{ gap: 12 }}>
      {assignment.workout.blocks.map((b) => {
        const timer = isTimerBlock(b);
        return (
          <Card key={b.id}>
            <BlockHeader title={b.title} type={blockTypeLabel(b.settings.type)} />
            {timer ? (
              <T variant="label" tone="muted">
                {settingsSummary(b.settings)}
              </T>
            ) : null}
            {b.items.length === 0 && b.settings.type !== 'custom' ? <T tone="muted">{t('plan.noItems')}</T> : null}
            {b.items.map((it) => (
              <View key={it.id} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 4 }}>
                <T variant="bodyStrong" style={{ flexShrink: 1 }}>
                  {it.exerciseName}
                </T>
                <T tone="muted" style={{ flexShrink: 1, textAlign: 'right' }}>
                  {targetText(it.target, measured.get(it.exerciseId) ?? 'reps', timer)}
                </T>
              </View>
            ))}
          </Card>
        );
      })}
    </View>
  );
}
