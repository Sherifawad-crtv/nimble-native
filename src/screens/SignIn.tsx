import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { useSessionActions } from '../app/auth';
import { errorMessage } from '../hooks/data';
import { t } from '../i18n';
import { openLink, PRIVACY_URL, TERMS_URL } from '../lib/links';
import { sessionService, type AccountSession, type DemoSession } from '../services';
import type { Profile, Role } from '../types';
import { Avatar, Banner, Button, EmptyState, ErrorState, Screen, Segmented, Skeleton, T, TextField, color } from '../ui';

const lockup = require('../../assets/brand/nimble-lockup.png');

function Brand() {
  return <Image source={lockup} style={styles.logo} resizeMode="contain" accessibilityLabel="Nimble" />;
}

/** Sign-in for whichever backend is configured. */
export function SignInScreen() {
  return (
    <Screen>
      <Brand />
      {sessionService.kind === 'demo' ? <DemoSignIn session={sessionService} /> : <AccountSignIn session={sessionService} />}
    </Screen>
  );
}

type Mode = 'signin' | 'signup' | 'reset';

function AccountSignIn({ session }: { session: AccountSession }) {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ title: string; body: string } | null>(null);
  const { refresh } = useSessionActions();

  const [role, setRole] = useState<Role>('coach');
  const [name, setName] = useState('');
  const [workspace, setWorkspace] = useState('');
  const [code, setCode] = useState('');
  const invite = useInviteCheck(session, role === 'client' ? code : '');

  // A link like nimble://?invite=A1B2C3D4 opens straight to joining that coach.
  const url = Linking.useURL();
  useEffect(() => {
    const found = url ? Linking.parse(url).queryParams?.invite : undefined;
    if (typeof found === 'string' && found) {
      setCode(found.toUpperCase());
      setMode('signup');
      setRole('client');
    }
  }, [url]);

  const go = (next: Mode) => {
    setMode(next);
    setError(null);
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (mode === 'signin') {
        await session.signIn(email, password);
        await refresh();
      } else if (mode === 'reset') {
        await session.requestPasswordReset(email);
        setNotice({ title: t('auth.reset.sent.title'), body: t('auth.reset.sent.body', { email: email.trim() }) });
      } else {
        const input = role === 'coach' ? { role, name, email, password, workspaceName: workspace } : { role, name, email, password, inviteCode: code };
        const result = await session.signUp(input);
        if (result === 'confirm_email') setNotice({ title: t('auth.confirm.title'), body: t('auth.confirm.body', { email: email.trim() }) });
        else await refresh();
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (notice) {
    return (
      <View style={{ gap: 16 }}>
        <EmptyState icon="mail" title={notice.title} body={notice.body} />
        <Button
          size="md"
          variant="secondary"
          onPress={() => {
            setNotice(null);
            go('signin');
          }}
        >
          {t('auth.backToSignIn')}
        </Button>
      </View>
    );
  }

  const title = mode === 'signin' ? t('auth.signin.title') : mode === 'signup' ? t('auth.signup.title') : t('auth.reset.title');
  const subtitle = mode === 'signin' ? t('auth.signin.subtitle') : mode === 'signup' ? t('auth.signup.subtitle') : t('auth.reset.subtitle');

  return (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 4 }}>
        <T variant="title" accessibilityRole="header">
          {title}
        </T>
        <T variant="label" tone="muted">
          {subtitle}
        </T>
      </View>

      {mode === 'signup' && (
        <>
          <Segmented
            options={[
              { id: 'coach', label: t('auth.role.coach') },
              { id: 'client', label: t('auth.role.client') },
            ]}
            value={role}
            onChange={(id) => setRole(id as Role)}
          />
          <TextField label={t('auth.name')} required autoComplete="name" textContentType="name" autoCapitalize="words" value={name} onChangeText={setName} />
          {role === 'coach' ? (
            <TextField label={t('auth.workspace')} required autoComplete="organization" placeholder={t('auth.workspace.placeholder')} value={workspace} onChangeText={setWorkspace} />
          ) : (
            <TextField
              label={t('auth.invite')}
              required
              autoComplete="off"
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="A1B2C3D4"
              value={code}
              onChangeText={(v) => setCode(v.toUpperCase())}
              hint={invite.state === 'valid' ? t('auth.invite.valid', { workspace: invite.workspace }) : invite.state === 'idle' ? t('auth.invite.hint') : undefined}
              error={invite.state === 'invalid' ? t('auth.invite.invalid') : undefined}
            />
          )}
        </>
      )}

      <TextField label={t('auth.email')} required keyboardType="email-address" autoComplete="email" textContentType="emailAddress" autoCapitalize="none" autoCorrect={false} value={email} onChangeText={setEmail} />
      {mode !== 'reset' && (
        <TextField
          label={t('auth.password')}
          required
          secureTextEntry
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          textContentType={mode === 'signup' ? 'newPassword' : 'password'}
          value={password}
          onChangeText={setPassword}
          hint={mode === 'signup' ? t('auth.password.hint') : undefined}
          onSubmitEditing={() => void submit()}
        />
      )}

      {error ? <Banner tone="danger" title={t('auth.error.title')} message={error} /> : null}

      <Button size="md" loading={busy} disabled={busy || (mode === 'signup' && role === 'client' && invite.state === 'invalid')} onPress={() => void submit()}>
        {mode === 'signin' ? t('auth.signin.action') : mode === 'signup' ? t('auth.signup.action') : t('auth.reset.action')}
      </Button>

      {mode === 'signup' && (
        <T variant="caption" tone="muted" style={{ textAlign: 'center' }}>
          {t('legal.agree')}{' '}
          <T variant="caption" tone="brand" onPress={() => openLink(TERMS_URL)} accessibilityRole="link">
            {t('legal.terms')}
          </T>{' '}
          {t('legal.and')}{' '}
          <T variant="caption" tone="brand" onPress={() => openLink(PRIVACY_URL)} accessibilityRole="link">
            {t('legal.privacy')}
          </T>
          .
        </T>
      )}

      <View style={{ gap: 8 }}>
        {mode === 'signin' ? (
          <>
            <Button variant="tertiary" size="md" onPress={() => go('reset')}>
              {t('auth.forgot')}
            </Button>
            <Button variant="secondary" size="md" onPress={() => go('signup')}>
              {t('auth.toSignup')}
            </Button>
          </>
        ) : (
          <Button variant="tertiary" size="md" onPress={() => go('signin')}>
            {mode === 'signup' ? t('auth.toSignin') : t('auth.backToSignIn')}
          </Button>
        )}
      </View>
    </View>
  );
}

type InviteState = { state: 'idle' } | { state: 'checking' } | { state: 'valid'; workspace: string } | { state: 'invalid' };

/** Confirms an invite code as it is typed, so the client knows which coach they are joining. */
function useInviteCheck(session: AccountSession, code: string): InviteState {
  const [result, setResult] = useState<InviteState>({ state: 'idle' });
  useEffect(() => {
    const clean = code.trim();
    if (clean.length < 8) {
      setResult({ state: 'idle' });
      return;
    }
    let live = true;
    setResult({ state: 'checking' });
    const timer = setTimeout(() => {
      session
        .checkInvite(clean)
        .then((workspace) => live && setResult(workspace ? { state: 'valid', workspace } : { state: 'invalid' }))
        .catch(() => live && setResult({ state: 'idle' }));
    }, 300);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [session, code]);
  return result;
}

/** Shown after opening a password-reset link. */
export function NewPasswordScreen({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { refresh } = useSessionActions();

  const submit = async () => {
    if (sessionService.kind !== 'account') return;
    setBusy(true);
    setError(null);
    try {
      await sessionService.updatePassword(password);
      await refresh();
      onDone();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Brand />
      <View style={{ gap: 4 }}>
        <T variant="title">{t('auth.newPassword.title')}</T>
        <T variant="label" tone="muted">
          {t('auth.newPassword.subtitle')}
        </T>
      </View>
      <TextField label={t('auth.password')} required secureTextEntry autoComplete="new-password" textContentType="newPassword" value={password} onChangeText={setPassword} hint={t('auth.password.hint')} />
      {error ? <Banner tone="danger" title={t('auth.error.title')} message={error} /> : null}
      <Button size="md" loading={busy} disabled={busy} onPress={() => void submit()}>
        {t('auth.newPassword.action')}
      </Button>
    </Screen>
  );
}

// ---------- demo backend (development only) ----------

function DemoSignIn({ session }: { session: DemoSession }) {
  const { signInAs } = useSessionActions();
  const accounts = useQuery({ queryKey: ['demo-accounts'], queryFn: () => session.listDemoAccounts() });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pick = async (p: Profile) => {
    setBusy(p.id);
    setError(null);
    try {
      await signInAs(p.id);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(null);
    }
  };

  const group = (label: string, list: Profile[]) => (
    <View style={{ gap: 8 }}>
      <T variant="caption" tone="muted">
        {label}
      </T>
      {list.map((p) => (
        <Pressable key={p.id} disabled={busy !== null} onPress={() => void pick(p)} style={styles.account} accessibilityRole="button" accessibilityLabel={p.name}>
          <Avatar name={p.name} />
          <View style={{ flex: 1 }}>
            <T variant="bodyStrong">{p.name}</T>
            <T variant="label" tone="muted">
              {p.email}
            </T>
          </View>
        </Pressable>
      ))}
    </View>
  );

  return (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 4 }}>
        <T variant="title">{t('signin.title')}</T>
        <T variant="label" tone="muted">
          {t('signin.subtitle')}
        </T>
      </View>
      {accounts.isPending && <Skeleton variant="list" rows={3} />}
      {accounts.isError && <ErrorState title={t('error.generic.title')} body={accounts.error.message} onRetry={() => void accounts.refetch()} />}
      {error ? <Banner tone="danger" title={t('error.generic.title')} message={error} /> : null}
      {accounts.data && (
        <>
          {group(t('signin.coach'), accounts.data.filter((p) => p.role === 'coach'))}
          {group(t('signin.clients'), accounts.data.filter((p) => p.role === 'client'))}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  logo: { width: 200, height: 40, marginTop: 24, marginBottom: 8 },
  account: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 24, backgroundColor: color.surfaceCard },
});
