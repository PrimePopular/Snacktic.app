import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../../features/authentication';
import { validatePassword, validatePasswordMatch } from '../../features/authentication/validation';
import { Button, EmptyState, Loading, PageHeader, PasswordField } from '../../shared/components';
import './profile.css';

/**
 * Where the link in a password-reset email lands, and also the "change password" screen for
 * signed-in students. Without a valid session (an expired or reused link) it explains and
 * points to a fresh request.
 */
export default function ResetPasswordPage() {
  const auth = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  if (auth.status === 'loading') return <Loading label="Checking your link" />;

  const allowed = auth.recovering || auth.status === 'signed-in';

  if (!allowed) {
    return (
      <>
        <PageHeader title="Reset password" />
        <EmptyState title="This link has expired" action={<Button to="/profile">Request a new link</Button>}>
          Reset links work once and only for a short time. Go to Profile, tap Sign in, then Forgot password.
        </EmptyState>
      </>
    );
  }

  if (done) {
    return (
      <>
        <PageHeader title="Password updated" />
        <EmptyState title="You're all set" action={<Button to="/">Go to Home</Button>}>
          Your new password is saved. Use it the next time you sign in.
        </EmptyState>
      </>
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormMessage(null);
    const next = {
      password: validatePassword(password) ?? undefined,
      confirm: validatePasswordMatch(password, confirm) ?? undefined,
    };
    setErrors(next);
    if (next.password || next.confirm) return;

    setBusy(true);
    const result = await auth.updatePassword(password);
    setBusy(false);
    if (result.ok) setDone(true);
    else setFormMessage(result.message);
  }

  return (
    <>
      <PageHeader
        title={auth.recovering ? 'Choose a new password' : 'Change password'}
        description="Pick something you haven't used elsewhere. At least 8 characters."
      />
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <PasswordField
          label="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          autoComplete="new-password"
        />
        <PasswordField
          label="Type it again"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={errors.confirm}
          autoComplete="new-password"
        />
        {formMessage && (
          <p className="form-error" role="alert">
            {formMessage}
          </p>
        )}
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save new password'}
        </Button>
      </form>
    </>
  );
}
