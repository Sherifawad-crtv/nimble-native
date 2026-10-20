import { Alert } from 'react-native';

/**
 * Temporary diagnostic: React Native's own crash dialog only shows one line (the error's message,
 * no stack), which has been useless for tracking down a boot-time crash with no way to attach a
 * debugger. This installs a global handler — catching every uncaught exception, not just ones
 * inside React's render tree — and shows the full message and stack in a native alert instead, so
 * a screenshot actually carries enough to find the throw site. Remove once the crash is found.
 */
type Handler = (error: unknown, isFatal?: boolean) => void;
type ErrorUtilsLike = { getGlobalHandler?: () => Handler; setGlobalHandler?: (h: Handler) => void };

const g = globalThis as unknown as { ErrorUtils?: ErrorUtilsLike };
const previous = g.ErrorUtils?.getGlobalHandler?.();

g.ErrorUtils?.setGlobalHandler?.((error, isFatal) => {
  try {
    const err = error as { message?: unknown; stack?: unknown } | undefined;
    const message = err?.message !== undefined ? String(err.message) : String(error);
    const stack = err?.stack !== undefined ? String(err.stack) : 'No stack available.';
    Alert.alert(isFatal ? 'Fatal error' : 'Error', `${message}\n\n${stack}`.slice(0, 3000));
  } catch {
    // Alert itself failing here: nothing more we can do.
  }
  previous?.(error, isFatal);
});
