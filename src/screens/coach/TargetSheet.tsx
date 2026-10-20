import { useState } from 'react';
import { View } from 'react-native';
import { t } from '../../i18n';
import type { BlockType, ItemTarget, MeasuredAs } from '../../types';
import { Button, NumberField, Sheet, TextField } from '../../ui';

interface Props {
  open: boolean;
  name: string;
  blockType: BlockType;
  measuredAs: MeasuredAs;
  target: ItemTarget;
  onClose: () => void;
  onSave: (target: ItemTarget) => void;
}

export function TargetSheet({ open, name, blockType, measuredAs, target, onClose, onSave }: Props) {
  return (
    <Sheet open={open} title={name} onClose={onClose}>
      <TargetForm blockType={blockType} measuredAs={measuredAs} target={target} onSave={onSave} />
    </Sheet>
  );
}

function TargetForm({ blockType, measuredAs, target, onSave }: Omit<Props, 'open' | 'name' | 'onClose'>) {
  const standard = blockType === 'standard';
  const [draft, setDraft] = useState<ItemTarget>(target);
  const set = <K extends keyof ItemTarget>(key: K, value: ItemTarget[K]) => setDraft({ ...draft, [key]: value });
  const clean = (): ItemTarget => Object.fromEntries(Object.entries(draft).filter(([, v]) => v !== undefined && v !== '' && v !== 0)) as ItemTarget;

  return (
    <View style={{ gap: 16 }}>
      {standard ? <NumberField label={t('target.sets')} min={1} max={50} value={draft.sets ?? 3} onChange={(n) => set('sets', n)} /> : null}
      {measuredAs === 'reps' || measuredAs === 'weight_reps' || measuredAs === 'rounds' ? (
        <NumberField label={t(measuredAs === 'rounds' ? 'target.rounds' : 'target.reps')} min={1} max={500} value={draft.reps ?? 8} onChange={(n) => set('reps', n)} />
      ) : null}
      {measuredAs === 'time' ? <NumberField label={t('target.duration')} unit="s" step={5} min={5} max={3600} value={draft.durationSec ?? 30} onChange={(n) => set('durationSec', n)} /> : null}
      {measuredAs === 'distance' ? <NumberField label={t('target.distance')} unit="m" step={50} min={10} max={50000} value={draft.distanceM ?? 200} onChange={(n) => set('distanceM', n)} /> : null}
      {standard ? <NumberField label={t('target.restLabel')} unit="s" step={5} min={0} max={900} value={draft.restSec ?? 60} onChange={(n) => set('restSec', n)} /> : null}
      {measuredAs === 'weight_reps' ? <TextField label={t('target.load')} placeholder={t('target.load.placeholder')} value={draft.loadNote ?? ''} onChangeText={(v) => set('loadNote', v)} /> : null}
      <TextField label={t('target.notes')} placeholder={t('target.notes.placeholder')} multiline value={draft.notes ?? ''} onChangeText={(v) => set('notes', v)} />
      <Button fullWidth size="md" onPress={() => onSave(clean())}>
        {t('common.done')}
      </Button>
    </View>
  );
}
