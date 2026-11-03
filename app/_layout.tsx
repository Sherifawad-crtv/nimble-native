import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Urbanist_600SemiBold, Urbanist_700Bold } from '@expo-google-fonts/urbanist';
import { RedHatDisplay_400Regular, RedHatDisplay_500Medium, RedHatDisplay_600SemiBold, RedHatDisplay_700Bold } from '@expo-google-fonts/red-hat-display';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { AuthGate } from '../src/core/auth';
import { AppErrorBoundary } from '../src/core/AppErrorBoundary';
import { configureNotifications, routeFor } from '../src/lib/push';
import { hydratePrefs } from '../src/lib/prefs';
import { sessionService } from '../src/services';
import { ToastProvider, color } from '../src/ui';

void SplashScreen.preventAutoHideAsync();
try {
  configureNotifications();
} catch (e) {
  // Runs before the error boundary exists; notifications not working is never worth a hard crash.
  console.error('configureNotifications failed:', e);
}

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } });

function Links() {
  const router = useRouter();

  // Email links (confirm, reset password) come back as nimble://auth?code=...
  useEffect(() => {
    const session = sessionService;
    if (session.kind !== 'account') return;
    const handle = (url: string | null) => {
      if (url && url.includes('code=')) void session.handleLink(url).catch(() => undefined);
    };
    void Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener('url', (e) => handle(e.url));
    return () => sub.remove();
  }, []);

  // Tapping a notification opens the screen it is about.
  useEffect(() => {
    const open = (url: unknown) => {
      const route = routeFor(typeof url === 'string' ? url : undefined);
      if (route) router.push(route as never);
    };
    void Notifications.getLastNotificationResponseAsync().then((r) => open(r?.notification.request.content.data?.url));
    const sub = Notifications.addNotificationResponseReceivedListener((r) => open(r.notification.request.content.data?.url));
    return () => sub.remove();
  }, [router]);
  return null;
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [fonts] = useFonts({ Urbanist_600SemiBold, Urbanist_700Bold, RedHatDisplay_400Regular, RedHatDisplay_500Medium, RedHatDisplay_600SemiBold, RedHatDisplay_700Bold });

  useEffect(() => {
    void hydratePrefs().finally(() => setReady(true));
  }, []);
  useEffect(() => {
    if (ready && fonts) void SplashScreen.hideAsync();
  }, [ready, fonts]);

  if (!ready || !fonts) return null;
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AppErrorBoundary>
            <ToastProvider>
              <StatusBar style="light" />
              <AuthGate>
                <Links />
                <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.bg }, animation: 'slide_from_right' }}>
                  <Stack.Screen name="(coach)" />
                  <Stack.Screen name="(client)" />
                </Stack>
              </AuthGate>
            </ToastProvider>
          </AppErrorBoundary>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: color.bg } });
