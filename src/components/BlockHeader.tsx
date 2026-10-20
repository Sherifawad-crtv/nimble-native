import { View } from 'react-native';
import { T, color, radius } from '../ui';

/** A block's title with its type as a small chip. */
export function BlockHeader({ title, type }: { title: string; type: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <T variant="heading" style={{ flex: 1 }}>
        {title}
      </T>
      <View style={{ paddingHorizontal: 10, height: 24, borderRadius: radius.pill, backgroundColor: color.surfaceControl, justifyContent: 'center' }}>
        <T variant="chip">{type}</T>
      </View>
    </View>
  );
}
