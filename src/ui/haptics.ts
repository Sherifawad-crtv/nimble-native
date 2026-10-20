import * as Haptics from 'expo-haptics';

/** Light feedback for taps that change something. Never throws: not every device has a haptic engine. */
export const tap = () => void Haptics.selectionAsync().catch(() => undefined);
export const success = () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
export const warn = () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
