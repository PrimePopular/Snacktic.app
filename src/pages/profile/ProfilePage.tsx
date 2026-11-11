import { useAuth } from '../../features/authentication';
import { Button, EmptyState, Loading, PageHeader } from '../../shared/components';
import { AccountProfile } from './AccountProfile';
import { GuestProfile } from './GuestProfile';
import './profile.css';

export default function ProfilePage() {
  const auth = useAuth();

  if (auth.status === 'loading') {
    return <Loading label="Loading your profile" />;
  }

  if (auth.status === 'unconfigured') {
    return (
      <>
        <PageHeader title="Profile" />
        <EmptyState title="The database isn't connected yet">
          Add your Supabase URL and public key to a file named .env.local in the project folder, then restart
          the app. Steps are in docs/SUPABASE_SETUP.md.
        </EmptyState>
      </>
    );
  }

  if (auth.status === 'error') {
    return (
      <>
        <PageHeader title="Profile" />
        <EmptyState
          title="We couldn't load your account"
          action={<Button onClick={auth.retry}>Try again</Button>}
        >
          Check your connection and try again.
        </EmptyState>
      </>
    );
  }

  return auth.status === 'signed-in' ? <AccountProfile /> : <GuestProfile />;
}
