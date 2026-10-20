import { useEffect } from 'react';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

const TAG = 'nimble-timer';

/** Keeps the screen on while a timer runs. Always available on a phone. */
export function useWakeLock(active: boolean): 'on' | 'unavailable' {
  useEffect(() => {
    if (!active) return;
    void activateKeepAwakeAsync(TAG).catch(() => undefined);
    return () => {
      void deactivateKeepAwake(TAG).catch(() => undefined);
    };
  }, [active]);
  return 'on';
}
