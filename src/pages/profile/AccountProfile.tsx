import { useState } from 'react';
import { Link } from '../../core/router';
import { isAdminRole, roleLabel, useAuth } from '../../features/authentication';
import { Button, Card, CheckboxField, PageHeader } from '../../shared/components';
import { InstallCard } from '../../pwa/install';
import { DetailsForm } from './DetailsForm';
import { PushSettings } from '../../features/push';
import { MyActivity } from './MyActivity';
import { SendPoints } from './SendPoints';
import { SoundToggle } from './SoundToggle';

/** What a signed-in student sees. Points, gifts and history are added in the Rewards slice. */
export function AccountProfile() {
  const auth = useAuth();
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const profile = auth.profile;

  if (!profile) return null;

  async function toggleNews(checked: boolean) {
    setSaving(true);
    setMessage(null);
    const result = await auth.setMarketingOptIn(checked);
    setSaving(false);
    if (!result.ok) setMessage(result.message);
  }

  return (
    <>
      <PageHeader title="Profile" />

      <Card tone="dark" className="account-hero">
        <span className="avatar" aria-hidden="true">
          {profile.username.charAt(0).toUpperCase()}
        </span>
        <div className="account-hero__text">
          <h2>{profile.username}</h2>
          {auth.email && <p className="account-hero__email">{auth.email}</p>}
          {isAdminRole(profile.role) && <span className="badge">{roleLabel(profile.role)}</span>}
        </div>
      </Card>

      <Card className="account-section">
        <h3>Email preferences</h3>
        <CheckboxField
          checked={profile.marketingOptIn}
          disabled={saving}
          onChange={(e) => toggleNews(e.target.checked)}
        >
          Send me news and offers by email
        </CheckboxField>
        {message && (
          <p className="form-error" role="alert">
            {message}
          </p>
        )}
      </Card>

      {profile.suspended && (
        <p className="form-error" role="alert">
          Your account is suspended. You can't earn, send or spend points right now. Please contact the Snacktic team.
        </p>
      )}

      <SendPoints />
      <MyActivity />
      <DetailsForm />

      <InstallCard />

      <Card className="account-section">
        <h3>Settings</h3>
        <SoundToggle />
        <PushSettings />
      </Card>

      <Card className="account-section">
        <h3>Account</h3>
        <div className="account-links">
          <Button variant="secondary" to="/reset-password">
            Change password
          </Button>
          <Button variant="secondary" to="/support">
            Support & Feedback
          </Button>
          <Link to="/privacy" className="text-small">
            Privacy notice
          </Link>
        </div>
      </Card>

      <div className="account-actions">
        {isAdminRole(profile.role) && <Button to="/admin">Open admin dashboard</Button>}
        <Button variant="secondary" onClick={() => void auth.signOut()}>
          Sign out
        </Button>
      </div>
    </>
  );
}
