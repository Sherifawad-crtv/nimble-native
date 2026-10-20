import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { keys } from '../hooks/keys';
import { pauseDevice, restorePush } from '../lib/push';
import { dataService, sessionService, ServiceError } from '../services';
import { NewPasswordScreen, SignInScreen } from '../screens/SignIn';
import type { Profile } from '../types';
import { color } from '../ui';

const MeContext = createContext<Profile | null>(null);

/** The signed-in profile. Only valid below <AuthGate>. */
export function useMe(): Profile {
  const me = useContext(MeContext);
  if (!me) throw new Error('useMe must be used inside AuthGate');
  return me;
}

/** Forgets everything cached for the previous account, then asks again who is signed in. */
const resetSession = async (client: QueryClient) => {
  client.removeQueries({ predicate: (q) => q.queryKey[0] !== keys.me[0] });
  await client.resetQueries({ queryKey: keys.me });
};

export function useSessionActions() {
  const client = useQueryClient();
  const reset = () => resetSession(client);
  return {
    /** Demo backend only: continue as one of the seeded accounts. */
    async signInAs(profileId: string) {
      if (sessionService.kind !== 'demo') return;
      await sessionService.signIn(profileId);
      await reset();
    },
    async signOut() {
      try {
        if (sessionService.kind === 'account') await pauseDevice((endpoint) => dataService.removePushDevice(endpoint));
        await sessionService.signOut();
      } finally {
        await reset();
      }
    },
    /** Deletes the account and everything in it, then returns to the sign-in screen. */
    async deleteAccount() {
      if (sessionService.kind === 'account') {
        await pauseDevice((endpoint) => dataService.removePushDevice(endpoint));
        await sessionService.deleteAccount();
      } else await sessionService.signOut();
      await reset();
    },
    refresh: reset,
  };
}

/** Decides between the sign-in screens and the app. Everything below it can call useMe(). */
export function AuthGate({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const router = useRouter();
  const [recovering, setRecovering] = useState(false);
  const me = useQuery({ queryKey: keys.me, queryFn: () => dataService.getMe(), retry: false, staleTime: Infinity });

  // Bring back this account's notifications on this phone after signing in.
  useEffect(() => {
    if (me.data && sessionService.kind === 'account') void restorePush(me.data.id, (d) => dataService.savePushDevice(d));
  }, [me.data?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // After signing out and back in, start on the home screen rather than wherever the last session ended.
  const signedIn = useRef(false);
  const signedOut = useRef(false);
  useEffect(() => {
    if (me.data) {
      if (signedOut.current) {
        signedOut.current = false;
        router.replace('/');
      }
      signedIn.current = true;
    } else if (me.isError && signedIn.current) {
      signedIn.current = false;
      signedOut.current = true;
    }
  }, [me.data, me.isError, router]);

  // Real accounts can change outside the app: email links, expiry, signing out elsewhere.
  useEffect(() => {
    if (sessionService.kind !== 'account') return;
    return sessionService.onChange((event) => {
      if (event === 'password_recovery') {
        setRecovering(true);
        return;
      }
      void resetSession(client);
    });
  }, [client]);

  if (recovering) return <NewPasswordScreen onDone={() => setRecovering(false)} />;
  if (me.isPending)
    return (
      <View style={{ flex: 1, backgroundColor: color.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={color.brand} />
      </View>
    );
  // Not signed in (or signed out/expired) is expected and sends people to the sign-in screen; any
  // other failure — like the backend itself failing to initialize — is unexpected and should be
  // visible, so it is thrown here, where the error boundary can show what actually broke.
  if (me.isError) {
    if (me.error instanceof ServiceError) return <SignInScreen />;
    throw me.error;
  }
  return <MeContext.Provider value={me.data}>{children}</MeContext.Provider>;
}
