import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from '../../core/router';
import { useAuth } from '../../features/authentication';
import {
  validateEmail,
  validateFullName,
  validatePassword,
  validatePhone,
  validateUsername,
} from '../../features/authentication/validation';
import { Button, Card, CheckboxField, Logo, PasswordField, TextField } from '../../shared/components';
import { InstallCard } from '../../pwa/install';
import { SoundToggle } from './SoundToggle';

type Mode = 'signup' | 'signin' | 'reset';

/** What a guest sees: a welcome and the account forms. Guests can still use the rest of the app. */
export function GuestProfile() {
  const auth = useAuth();
  const [mode, setMode] = useState<Mode>('signup');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [errors, setErrors] = useState<{ fullName?: string; username?: string; phone?: string; email?: string; password?: string }>({});
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setErrors({});
    setFormMessage(null);
    setNotice(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormMessage(null);
    setNotice(null);

    if (mode === 'reset') {
      const emailError = validateEmail(email) ?? undefined;
      setErrors({ email: emailError });
      if (emailError) return;
      setBusy(true);
      const result = await auth.requestPasswordReset(email);
      setBusy(false);
      if (!result.ok) setFormMessage(result.message);
      else setNotice('If an account exists for that email, a reset link is on its way. Check your inbox and your spam folder.');
      return;
    }

    const nextErrors = {
      fullName: mode === 'signup' ? validateFullName(fullName) ?? undefined : undefined,
      username: mode === 'signup' ? validateUsername(username) ?? undefined : undefined,
      phone: mode === 'signup' ? validatePhone(phone) ?? undefined : undefined,
      email: validateEmail(email) ?? undefined,
      password: mode === 'signup' ? validatePassword(password) ?? undefined : password ? undefined : 'Enter your password.',
    };
    setErrors(nextErrors);
    if (nextErrors.fullName || nextErrors.username || nextErrors.phone || nextErrors.email || nextErrors.password) return;

    setBusy(true);
    const result =
      mode === 'signup'
        ? await auth.signUp({ fullName, phone, email, password, username, marketingOptIn })
        : await auth.signIn(email, password);
    setBusy(false);

    if (!result.ok) {
      setFormMessage(result.message);
    } else if (result.needsEmailConfirmation) {
      setNotice('Almost there! Check your email and tap the confirmation link, then sign in.');
      setMode('signin');
      setPassword('');
    }
    // On success without confirmation, the auth state changes and this screen is replaced.
  }

  return (
    <>
      <Card tone="dark" className="guest-hero">
        <Logo size={56} tone="light" />
        <h1>Browsing as a guest</h1>
        <p>Create an account to keep your Crumb Points, send gifts to friends and sync across devices.</p>
      </Card>

      <div className="segmented" role="group" aria-label="Account options">
        <button type="button" aria-pressed={mode === 'signup'} onClick={() => switchMode('signup')}>
          Create account
        </button>
        <button type="button" aria-pressed={mode === 'signin'} onClick={() => switchMode('signin')}>
          Sign in
        </button>
      </div>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {mode === 'reset' && (
          <div className="auth-form__intro">
            <h2>Reset your password</h2>
            <p className="text-secondary">Enter the email you signed up with and we'll send you a link to choose a new password.</p>
          </div>
        )}

        {notice && (
          <p className="form-notice" role="status">
            {notice}
          </p>
        )}

        {mode === 'signup' && (
          <>
            <TextField
              label="Your name"
              hint="Your real name. Only the Snacktic team can see it."
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              error={errors.fullName}
              autoComplete="name"
              maxLength={60}
            />
            <TextField
              label="Nickname"
              hint="The name you'd like to be called. Friends use it to send you points. Letters, numbers and underscores only."
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              error={errors.username}
              autoComplete="username"
              autoCapitalize="none"
              maxLength={20}
            />
          </>
        )}

        {mode === 'signup' && (
          <TextField
            label="WhatsApp number (optional)"
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            error={errors.phone}
            hint="Only used to contact you about rewards you order. You can add it later."
            autoComplete="tel"
            maxLength={25}
          />
        )}

        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          autoComplete="email"
          inputMode="email"
        />

        {mode !== 'reset' && (
          <PasswordField
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            hint={mode === 'signup' ? 'At least 8 characters.' : undefined}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          />
        )}

        {mode === 'signin' && (
          <button type="button" className="link-button" onClick={() => switchMode('reset')}>
            Forgot password?
          </button>
        )}

        {mode === 'signup' && (
          <CheckboxField checked={marketingOptIn} onChange={(e) => setMarketingOptIn(e.target.checked)}>
            Send me news and offers by email. Optional, and you can change this any time in your profile.
          </CheckboxField>
        )}

        {formMessage && (
          <p className="form-error" role="alert">
            {formMessage}
          </p>
        )}

        {mode === 'signup' && (
          <p className="text-xs text-secondary">
            We store your name and email to run your account. <Link to="/privacy">How we use them</Link>.
          </p>
        )}

        <Button type="submit" disabled={busy}>
          {busy ? 'One moment…' : mode === 'signup' ? 'Create account' : mode === 'signin' ? 'Sign in' : 'Send reset link'}
        </Button>

        {mode === 'reset' && (
          <button type="button" className="link-button" onClick={() => switchMode('signin')}>
            Back to sign in
          </button>
        )}
      </form>

      <div className="guest-settings">
        <InstallCard />
        <SoundToggle />
      </div>
    </>
  );
}
