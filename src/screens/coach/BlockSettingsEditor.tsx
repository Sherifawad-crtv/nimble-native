import { TextInput, View } from 'react-native';
import { t } from '../../i18n';
import type { BlockSettings, CustomStep } from '../../types';
import { Button, IconButton, NumberField, Segmented, T, color } from '../../ui';

interface Props {
  value: BlockSettings;
  onChange: (next: BlockSettings) => void;
}

/** Controlled editor for a block's timer settings. Standard blocks have none. */
export function BlockSettingsEditor({ value, onChange }: Props) {
  switch (value.type) {
    case 'standard':
      return null;
    case 'amrap':
      return <NumberField label={t('settings.cap')} unit="min" min={1} max={180} value={Math.round(value.capSec / 60)} onChange={(n) => onChange({ ...value, capSec: n * 60 })} />;
    case 'emom':
      return (
        <View style={{ gap: 12 }}>
          <NumberField label={t('settings.totalMin')} unit="min" min={1} max={180} value={value.totalMin} onChange={(n) => onChange({ ...value, totalMin: n })} />
          <NumberField label={t('settings.interval')} unit="s" step={5} min={10} max={600} value={value.intervalSec} onChange={(n) => onChange({ ...value, intervalSec: n })} />
        </View>
      );
    case 'for_time':
      return (
        <View style={{ gap: 12 }}>
          <NumberField label={t('settings.rounds')} min={1} max={100} value={value.rounds} onChange={(n) => onChange({ ...value, rounds: n })} />
          <NumberField
            label={t('settings.capOptional')}
            unit="min"
            min={0}
            max={180}
            value={value.capSec ? Math.round(value.capSec / 60) : 0}
            onChange={(n) => {
              const { capSec: _drop, ...rest } = value;
              onChange(n > 0 ? { ...rest, capSec: n * 60 } : rest);
            }}
          />
        </View>
      );
    case 'tabata':
      return (
        <View style={{ gap: 12 }}>
          <NumberField label={t('settings.work')} unit="s" step={5} min={5} max={300} value={value.workSec} onChange={(n) => onChange({ ...value, workSec: n })} />
          <NumberField label={t('settings.rest')} unit="s" step={5} min={0} max={300} value={value.restSec} onChange={(n) => onChange({ ...value, restSec: n })} />
          <NumberField label={t('settings.rounds')} min={1} max={50} value={value.rounds} onChange={(n) => onChange({ ...value, rounds: n })} />
        </View>
      );
    case 'custom':
      return <StepsEditor steps={value.steps} onChange={(steps) => onChange({ ...value, steps })} />;
  }
}

function StepsEditor({ steps, onChange }: { steps: CustomStep[]; onChange: (s: CustomStep[]) => void }) {
  const patch = (i: number, p: Partial<CustomStep>) => onChange(steps.map((s, j) => (j === i ? { ...s, ...p } : s)));
  const move = (i: number, by: number) => {
    const next = [...steps];
    const [item] = next.splice(i, 1);
    if (item) next.splice(i + by, 0, item);
    onChange(next);
  };
  const input = { color: color.ink, fontSize: 16, minHeight: 44, borderRadius: 14, backgroundColor: color.fieldBg, borderWidth: 1, borderColor: color.fieldEdge, paddingHorizontal: 12 } as const;
  return (
    <View style={{ gap: 12 }}>
      {steps.length === 0 ? (
        <T tone="muted">{t('settings.steps.empty')}</T>
      ) : null}
      {steps.map((s, i) => (
        <View key={i} style={{ gap: 8, padding: 12, borderRadius: 16, backgroundColor: color.surfaceControl }}>
          <TextInput style={input} value={s.label} accessibilityLabel={t('settings.step.label', { n: i + 1 })} onChangeText={(v) => patch(i, { label: v })} placeholderTextColor={color.faint} />
          <Segmented
            options={[
              { id: 'work', label: t('builder.step.work') },
              { id: 'rest', label: t('builder.step.rest') },
            ]}
            value={s.kind}
            onChange={(id) => patch(i, { kind: id as CustomStep['kind'] })}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TextInput
              style={[input, { width: 84, textAlign: 'center' }]}
              keyboardType="number-pad"
              value={String(s.durationSec)}
              accessibilityLabel={t('settings.step.seconds', { n: i + 1 })}
              onChangeText={(v) => patch(i, { durationSec: Math.max(1, parseInt(v, 10) || 0) })}
            />
            <T tone="muted" style={{ flex: 1 }}>
              s
            </T>
            <IconButton icon="arrow-up" label={t('common.moveUp')} size={18} variant="ghost" disabled={i === 0} onPress={() => move(i, -1)} />
            <IconButton icon="arrow-down" label={t('common.moveDown')} size={18} variant="ghost" disabled={i === steps.length - 1} onPress={() => move(i, 1)} />
            <IconButton icon="close" label={t('settings.step.remove', { n: i + 1 })} size={18} variant="ghost" onPress={() => onChange(steps.filter((_, j) => j !== i))} />
          </View>
        </View>
      ))}
      <Button size="sm" variant="secondary" icon="plus" onPress={() => onChange([...steps, { label: t('builder.step.work'), kind: 'work', durationSec: 30 }])}>
        {t('settings.step.add')}
      </Button>
    </View>
  );
}
