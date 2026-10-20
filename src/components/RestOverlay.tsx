import { useEffect, useMemo, useState } from 'react';
import { Modal, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { buildRestPlan } from '../timer/engine';
import { useTimer } from '../timer/useTimer';
import { color } from '../ui';
import { RestTimer } from './TimerParts';

/** Rest between sets. Full-screen, counts against the real clock. */
export function RestOverlay({ seconds, next, onClose }: { seconds: number; next?: string; onClose: () => void }) {
  const [extra, setExtra] = useState(0);
  const plan = useMemo(() => buildRestPlan(Math.max(5, seconds + extra)), [seconds, extra]);
  const timer = useTimer(plan);
  const { start } = timer;
  const finished = timer.snap.status === 'finished';

  useEffect(() => {
    start();
  }, [start]);
  useEffect(() => {
    if (finished) onClose();
  }, [finished, onClose]);

  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <SafeAreaView style={{ flex: 1, backgroundColor: color.bg, justifyContent: 'center' }}>
        <View style={{ padding: 24 }}>
          <RestTimer remaining={timer.snap.segmentRemainingSec} total={plan.totalSec} next={next} onAdd={() => setExtra((e) => e + 15)} onSub={() => setExtra((e) => e - 15)} onSkip={onClose} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}
