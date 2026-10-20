import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { success, warn } from './haptics';
import { Icon } from './Icon';
import { T } from './Text';
import { color, radius } from './theme';

type Tone = 'success' | 'error' | 'info';
interface Api {
  show: (message: string, tone?: Tone) => void;
}

const ToastContext = createContext<Api | null>(null);

export const useToast = (): Api => {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast must be used inside ToastProvider');
  return api;
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<{ message: string; tone: Tone; id: number } | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const show = useCallback(
    (message: string, tone: Tone = 'success') => {
      if (tone === 'success') success();
      if (tone === 'error') warn();
      setToast({ message, tone, id: Date.now() });
      clearTimeout(timer.current);
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      timer.current = setTimeout(() => Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => setToast(null)), 3200);
    },
    [opacity],
  );
  useEffect(() => () => clearTimeout(timer.current), []);
  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast ? (
        <Animated.View pointerEvents="none" style={[styles.wrap, { bottom: insets.bottom + 72, opacity }]} accessibilityLiveRegion="polite">
          <View style={styles.toast}>
            <Icon name={toast.tone === 'error' ? 'alert' : 'check-circle'} size={20} tint={toast.tone === 'error' ? color.danger : color.green} />
            <T variant="label" style={{ flex: 1 }}>
              {toast.message}
            </T>
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  toast: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: color.surfaceRaised, borderRadius: radius.pill, paddingVertical: 12, paddingHorizontal: 18, maxWidth: 480 },
});
