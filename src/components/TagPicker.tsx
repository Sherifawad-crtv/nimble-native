import { useState } from 'react';
import { View } from 'react-native';
import { t } from '../i18n';
import { Button, Chip, T, TextField } from '../ui';

interface Props {
  label: string;
  value: string[];
  options: string[];
  onChange: (next: string[]) => void;
  /** Allows typing a custom tag. */
  custom?: boolean;
}

/** Chips for picking from known tags, plus an optional custom one. Controlled. */
export function TagPicker({ label, value, options, onChange, custom }: Props) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const all = [...new Set([...options, ...value])];
  const toggle = (tag: string) => onChange(value.includes(tag) ? value.filter((x) => x !== tag) : [...value, tag]);
  const commit = () => {
    const tag = draft.trim().toLowerCase();
    if (tag && !value.includes(tag)) onChange([...value, tag]);
    setDraft('');
    setAdding(false);
  };

  return (
    <View style={{ gap: 8 }} accessibilityRole="menu" accessibilityLabel={label}>
      <T variant="label" tone="muted">
        {label}
      </T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {all.map((tag) => (
          <Chip key={tag} label={tag} selected={value.includes(tag)} onPress={() => toggle(tag)} />
        ))}
        {custom && !adding ? <Chip label={`+ ${t('tags.addCustom')}`} onPress={() => setAdding(true)} /> : null}
      </View>
      {adding ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <TextField autoFocus accessibilityLabel={t('tags.customLabel')} placeholder={t('tags.customPlaceholder')} value={draft} onChangeText={setDraft} onSubmitEditing={commit} returnKeyType="done" autoCapitalize="none" />
          </View>
          <Button size="sm" variant="secondary" onPress={commit}>
            {t('common.add')}
          </Button>
        </View>
      ) : null}
    </View>
  );
}
