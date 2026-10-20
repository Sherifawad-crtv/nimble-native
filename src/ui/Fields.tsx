import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Switch, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { formatDateLong } from '../i18n';
import { parseISODate, toISODate } from '../lib/date';
import type { ISODate } from '../types';
import { Icon } from './Icon';
import { Sheet } from './Sheet';
import { IconButton } from './IconButton';
import { tap } from './haptics';
import { T } from './Text';
import { color, radius } from './theme';

/** A date shown as text; tapping opens the system date picker. Values are ISO dates (YYYY-MM-DD). */
export function DateField({ label, value, onChange }: { label?: string; value: ISODate; onChange: (v: ISODate) => void }) {
  const [open, setOpen] = useState(false);
  const pick = (e: DateTimePickerEvent, d?: Date) => {
    if (Platform.OS === 'android') setOpen(false);
    if (e.type === 'set' && d) onChange(toISODate(d));
  };
  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <T variant="label" tone="muted">
          {label}
        </T>
      ) : null}
      <Pressable accessibilityRole="button" accessibilityLabel={`${label ?? ''} ${formatDateLong(value)}`} onPress={() => setOpen(true)} style={styles.field}>
        <T variant="input" style={{ flex: 1 }}>
          {formatDateLong(value)}
        </T>
        <Icon name="calendar" size={20} tint={color.muted} />
      </Pressable>
      {open && Platform.OS === 'android' ? <DateTimePicker value={parseISODate(value)} mode="date" onChange={pick} /> : null}
      {Platform.OS === 'ios' ? (
        <Sheet open={open} title={label ?? ''} onClose={() => setOpen(false)}>
          <DateTimePicker value={parseISODate(value)} mode="date" display="inline" themeVariant="dark" accentColor={color.brand} onChange={pick} />
        </Sheet>
      ) : null}
    </View>
  );
}

/** Choose one option from a list in a sheet. */
export function SelectField({ label, options, value, onChange, placeholder }: { label?: string; options: { id: string; label: string }[]; value?: string; onChange: (id: string) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.id === value);
  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <T variant="label" tone="muted">
          {label}
        </T>
      ) : null}
      <Pressable accessibilityRole="button" accessibilityLabel={`${label ?? ''} ${current?.label ?? placeholder ?? ''}`} onPress={() => setOpen(true)} style={styles.field}>
        <T variant="input" tone={current ? 'ink' : 'muted'} style={{ flex: 1 }} numberOfLines={1}>
          {current?.label ?? placeholder ?? ''}
        </T>
        <Icon name="chev-d" size={20} tint={color.muted} />
      </Pressable>
      <Sheet open={open} title={label ?? placeholder ?? ''} onClose={() => setOpen(false)}>
        {options.map((o) => (
          <Pressable
            key={o.id}
            accessibilityRole="radio"
            accessibilityState={{ selected: o.id === value }}
            onPress={() => {
              tap();
              onChange(o.id);
              setOpen(false);
            }}
            style={[styles.option, o.id === value && { backgroundColor: 'rgba(201,247,17,0.12)' }]}
          >
            <T variant="bodyStrong" style={{ flex: 1 }}>
              {o.label}
            </T>
            {o.id === value ? <Icon name="check" size={20} tint={color.brand} /> : null}
          </Pressable>
        ))}
      </Sheet>
    </View>
  );
}

export function CheckRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={() => {
        tap();
        onChange(!checked);
      }}
      style={styles.option}
    >
      <View style={[styles.box, checked && { backgroundColor: color.brand, borderColor: color.brand }]}>{checked ? <Icon name="check" size={16} tint={color.onBrand} /> : null}</View>
      <T variant="bodyStrong">{label}</T>
    </Pressable>
  );
}

export function SwitchRow({ label, description, value, onChange }: { label: string; description?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <T variant="bodyStrong">{label}</T>
        {description ? (
          <T variant="caption" tone="muted">
            {description}
          </T>
        ) : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: color.brand, false: color.surfaceRaised }} thumbColor="#fff" ios_backgroundColor={color.surfaceRaised} accessibilityLabel={label} />
    </View>
  );
}

/** A whole number with minus and plus. */
export function NumberField({ label, value, unit, min = 0, max = 999, step = 1, onChange }: { label: string; value: number; unit?: string; min?: number; max?: number; step?: number; onChange: (n: number) => void }) {
  return (
    <View style={{ gap: 6 }}>
      <T variant="label" tone="muted">
        {label}
      </T>
      <View style={[styles.field, { justifyContent: 'space-between', paddingHorizontal: 6 }]}>
        <IconButton icon="minus" label={`${label} -`} variant="ghost" onPress={() => onChange(Math.max(min, value - step))} />
        <T variant="heading" accessibilityLabel={`${label} ${value}`}>
          {value}
          {unit ? <T variant="label" tone="muted"> {unit}</T> : null}
        </T>
        <IconButton icon="plus" label={`${label} +`} variant="ghost" onPress={() => onChange(Math.min(max, value + step))} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { minHeight: 52, borderRadius: 26, borderWidth: 1, borderColor: color.fieldEdge, backgroundColor: color.fieldBg, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 8 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 12, borderRadius: radius.md },
  box: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: color.lineStrong, alignItems: 'center', justifyContent: 'center' },
});
