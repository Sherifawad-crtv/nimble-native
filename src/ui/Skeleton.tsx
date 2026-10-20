import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { color, radius } from './theme';

/** Placeholder blocks while data loads. */
export function Skeleton({ variant = 'list', rows = 3 }: { variant?: 'list' | 'card' | 'chart' | 'detail'; rows?: number }) {
  const o = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([Animated.timing(o, { toValue: 1, duration: 700, useNativeDriver: true }), Animated.timing(o, { toValue: 0.5, duration: 700, useNativeDriver: true })]));
    loop.start();
    return () => loop.stop();
  }, [o]);
  const h = variant === 'chart' ? 220 : variant === 'card' ? 124 : variant === 'detail' ? 180 : 64;
  const n = variant === 'list' ? rows : variant === 'detail' ? 3 : 1;
  return (
    <View style={{ gap: 8 }} accessibilityLabel="Loading" accessibilityRole="progressbar">
      {Array.from({ length: n }, (_, i) => (
        <Animated.View key={i} style={[styles.block, { height: h, opacity: o }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({ block: { backgroundColor: color.surfaceCard, borderRadius: radius.card } });
