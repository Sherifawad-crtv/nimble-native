import { useState } from 'react';
import { View } from 'react-native';
import { errorMessage, useAction } from '../../hooks/data';
import { keys } from '../../hooks/keys';
import { t } from '../../i18n';
import { addDays, todayISO } from '../../lib/date';
import type { Id, Package } from '../../types';
import { Button, DateField, NumberField, Sheet, SwitchRow, T, TextField, useToast } from '../../ui';

interface Props {
  open: boolean;
  onClose: () => void;
  clientId: Id;
  workspaceId: Id;
  /** Editing when present, creating when absent. */
  pkg?: Package;
}

export function PackageSheet({ open, onClose, clientId, workspaceId, pkg }: Props) {
  return (
    <Sheet open={open} title={t(pkg ? 'package.edit' : 'package.new')} onClose={onClose}>
      <PackageForm key={pkg?.id ?? 'new'} onClose={onClose} clientId={clientId} workspaceId={workspaceId} pkg={pkg} />
    </Sheet>
  );
}

function PackageForm({ onClose, clientId, workspaceId, pkg }: Omit<Props, 'open'>) {
  const toast = useToast();
  const [name, setName] = useState(pkg?.name ?? '');
  const [included, setIncluded] = useState(pkg?.sessionsIncluded ?? 10);
  const [used, setUsed] = useState(pkg?.sessionsUsed ?? 0);
  const [expires, setExpires] = useState(pkg?.expiresOn ?? addDays(todayISO(), 90));
  const [paid, setPaid] = useState(pkg?.paymentReceived ?? false);
  const [error, setError] = useState<string>();
  const save = useAction((s, p: Parameters<typeof s.savePackage>[0]) => s.savePackage(p), { invalidate: [keys.packages(clientId), keys.overview] });

  const submit = async () => {
    if (!name.trim()) return setError(t('package.error.name'));
    setError(undefined);
    try {
      await save.run({ ...(pkg && { id: pkg.id }), workspaceId, clientId, name, sessionsIncluded: included, sessionsUsed: used, expiresOn: expires, paymentReceived: paid });
      toast.show(t('package.saved'));
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <View style={{ gap: 16 }}>
      <TextField label={t('package.name')} required value={name} onChangeText={setName} placeholder={t('package.name.placeholder')} />
      <NumberField label={t('package.included')} value={included} min={1} max={200} onChange={setIncluded} />
      <NumberField label={t('package.used')} value={used} min={0} max={included} onChange={setUsed} />
      <DateField label={t('package.expires')} value={expires} onChange={setExpires} />
      <SwitchRow label={t('package.paid')} description={t('package.paid.hint')} value={paid} onChange={setPaid} />
      {error ? (
        <T variant="label" tone="danger" accessibilityRole="alert">
          {error}
        </T>
      ) : null}
      <Button size="md" loading={save.isPending} onPress={() => void submit()}>
        {t('common.save')}
      </Button>
    </View>
  );
}
