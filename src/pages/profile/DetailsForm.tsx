import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../../features/authentication';
import { validatePhone, validateUsername } from '../../features/authentication/validation';
import { Button, Card, TextField } from '../../shared/components';

/** Change your nickname and WhatsApp number. The number is needed to order rewards. */
export function DetailsForm() {
  const auth = useAuth();
  const profile = auth.profile;
  const [nickname, setNickname] = useState(profile?.username ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [errors, setErrors] = useState<{ nickname?: string; phone?: string }>({});
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (!profile) return null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    const next = { nickname: validateUsername(nickname) ?? undefined, phone: validatePhone(phone) ?? undefined };
    setErrors(next);
    if (next.nickname || next.phone) return;
    setBusy(true);
    const result = await auth.updateDetails({ username: nickname.trim(), phone: phone.trim() });
    setBusy(false);
    setMessage(result.ok ? { kind: 'ok', text: 'Saved.' } : { kind: 'error', text: result.message });
  }

  return (
    <Card className="account-section">
      <h3>Your details</h3>
      <form className="gift-form" onSubmit={handleSubmit} noValidate>
        <TextField label="Nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} error={errors.nickname} autoCapitalize="none" maxLength={20} hint="Friends use this to send you points." />
        <TextField label="WhatsApp number" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} error={errors.phone} maxLength={25} hint="Needed to order a reward, so the team can reach you. Only the Snacktic team can see it." />
        {message && (
          <p className={message.kind === 'ok' ? 'form-notice' : 'form-error'} role={message.kind === 'ok' ? 'status' : 'alert'}>
            {message.text}
          </p>
        )}
        <Button type="submit" disabled={busy}>
          Save
        </Button>
      </form>
    </Card>
  );
}
