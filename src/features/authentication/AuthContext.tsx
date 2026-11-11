import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { startedFromAuthEmail, startedFromRecoveryLink, supabase } from '../../services/database';
import type { AuthContextValue, AuthResult, AuthStatus, Profile, SignUpInput } from './auth.types';
import { friendlyAuthError, NETWORK_MESSAGE } from './validation';

const AuthContext = createContext<AuthContextValue | null>(null);

function fail(technicalMessage: string): AuthResult {
  console.error('[auth]', technicalMessage);
  return { ok: false, message: friendlyAuthError(technicalMessage) };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(supabase ? 'loading' : 'unconfigured');
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [reloadCount, setReloadCount] = useState(0);
  const [recovering, setRecovering] = useState(startedFromRecoveryLink);

  // Arrived from a reset email (or an expired one): go to the page that handles it.
  useEffect(() => {
    if (startedFromAuthEmail) window.location.hash = '#/reset-password';
  }, []);

  // 1. Follow the session (sign in, sign out, restored from the previous visit).
  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let active = true;

    client.auth.getSession().then(({ data }) => {
      if (!active) return;
      setUser(data.session?.user ?? null);
      if (!data.session) setStatus('signed-out');
    });

    const { data: listener } = client.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setRecovering(true);
        window.location.hash = '#/reset-password';
      }
      setUser(session?.user ?? null);
      if (!session) {
        setProfile(null);
        setStatus('signed-out');
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  // 2. Whenever there is a signed-in user, load their profile.
  useEffect(() => {
    const client = supabase;
    if (!client || !user) return;
    let active = true;

    (async () => {
      const { data, error } = await client
        .from('profiles')
        .select('id, username, full_name, phone, suspended, role, marketing_opt_in')
        .eq('id', user.id)
        .maybeSingle();
      if (!active) return;
      if (error || !data) {
        console.error('[auth] could not load profile', error?.message);
        setStatus('error');
        return;
      }
      setProfile({
        id: data.id,
        username: data.username,
        fullName: data.full_name ?? '',
        phone: data.phone ?? '',
        suspended: Boolean(data.suspended),
        role: data.role,
        marketingOptIn: data.marketing_opt_in,
      });
      setStatus('signed-in');
    })();

    return () => {
      active = false;
    };
  }, [user, reloadCount]);

  const signUp = useCallback(async (input: SignUpInput): Promise<AuthResult> => {
    const client = supabase;
    if (!client) return { ok: false, message: 'The database is not connected yet.' };
    try {
      const check = await client.rpc('username_available', { p_username: input.username });
      if (check.error) return fail(check.error.message);
      if (check.data === false) return { ok: false, message: 'That username is taken. Try another one.' };

      const { data, error } = await client.auth.signUp({
        email: input.email.trim(),
        password: input.password,
        options: {
          data: {
            username: input.username.trim(),
            full_name: input.fullName.trim(),
            phone: input.phone.trim(),
            marketing_opt_in: input.marketingOptIn,
          },
        },
      });
      if (error) return fail(error.message);
      return { ok: true, needsEmailConfirmation: !data.session };
    } catch (error) {
      console.error('[auth]', error);
      return { ok: false, message: NETWORK_MESSAGE };
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const client = supabase;
    if (!client) return { ok: false, message: 'The database is not connected yet.' };
    try {
      const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
      if (error) return fail(error.message);
      return { ok: true };
    } catch (error) {
      console.error('[auth]', error);
      return { ok: false, message: NETWORK_MESSAGE };
    }
  }, []);

  const requestPasswordReset = useCallback(async (email: string): Promise<AuthResult> => {
    const client = supabase;
    if (!client) return { ok: false, message: 'The database is not connected yet.' };
    try {
      const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin,
      });
      if (error) return fail(error.message);
      return { ok: true };
    } catch (error) {
      console.error('[auth]', error);
      return { ok: false, message: NETWORK_MESSAGE };
    }
  }, []);

  const updatePassword = useCallback(async (password: string): Promise<AuthResult> => {
    const client = supabase;
    if (!client) return { ok: false, message: 'The database is not connected yet.' };
    try {
      const { error } = await client.auth.updateUser({ password });
      if (error) return fail(error.message);
      setRecovering(false);
      return { ok: true };
    } catch (error) {
      console.error('[auth]', error);
      return { ok: false, message: NETWORK_MESSAGE };
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
  }, []);

  const setMarketingOptIn = useCallback(
    async (value: boolean): Promise<AuthResult> => {
      const client = supabase;
      if (!client || !user) return { ok: false, message: 'Sign in first.' };
      try {
        const { error } = await client.from('profiles').update({ marketing_opt_in: value }).eq('id', user.id);
        if (error) return fail(error.message);
        setProfile((current) => (current ? { ...current, marketingOptIn: value } : current));
        return { ok: true };
      } catch (error) {
        console.error('[auth]', error);
        return { ok: false, message: NETWORK_MESSAGE };
      }
    },
    [user],
  );

  const updateDetails = useCallback(
    async (patch: { username?: string; phone?: string }): Promise<AuthResult> => {
      const client = supabase;
      if (!client || !user) return { ok: false, message: 'Sign in first.' };
      try {
        const { error } = await client.from('profiles').update(patch).eq('id', user.id);
        if (error) {
          if (error.code === '23505' || error.message.includes('duplicate')) {
            return { ok: false, message: 'That nickname is taken. Try another one.' };
          }
          return fail(error.message);
        }
        setProfile((current) => (current ? { ...current, ...patch } : current));
        return { ok: true };
      } catch (error) {
        console.error('[auth]', error);
        return { ok: false, message: NETWORK_MESSAGE };
      }
    },
    [user],
  );

  const retry = useCallback(() => {
    setStatus('loading');
    setReloadCount((count) => count + 1);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      profile,
      email: user?.email ?? null,
      signUp,
      signIn,
      recovering,
      requestPasswordReset,
      updatePassword,
      signOut,
      updateDetails,
      setMarketingOptIn,
      retry,
    }),
    [status, profile, user, signUp, signIn, recovering, requestPasswordReset, updatePassword, signOut, updateDetails, setMarketingOptIn, retry],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
