import { StyleSheet, View } from 'react-native';
import { t, type StringKey } from '../i18n';
import { Icon } from './Icon';
import { T } from './Text';
import { color, radius } from './theme';

const META: Record<string, Record<string, [string, string]>> = {
  assignment: { not_started: ['circle', color.muted], in_progress: ['clock', color.blue], completed: ['check', color.green], skipped: ['skip', color.muted] },
  link: { ok: ['check', color.green], unavailable: ['alert', color.danger], unchecked: ['clock', color.muted] },
  package: { active: ['check', color.green], expiring: ['alert', color.warning], expired: ['close', color.danger] },
};

const KEY: Record<string, string> = { assignment: 'status.', link: 'status.link.', package: 'status.package.' };

export function StatusChip({ kind, value }: { kind: 'assignment' | 'link' | 'package'; value: string }) {
  const [icon, tint] = META[kind]?.[value] ?? ['info', color.muted];
  return (
    <View style={styles.chip}>
      <Icon name={icon} size={16} tint={tint} />
      <T variant="chip">{t(`${KEY[kind]}${value}` as StringKey)}</T>
    </View>
  );
}

const styles = StyleSheet.create({ chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, height: 28, borderRadius: radius.pill, backgroundColor: color.surfaceControl, alignSelf: 'flex-start' } });
