import { Link } from '../../core/router';
import { useAuth } from '../../features/authentication';
import { Button, EmptyState, Loading, PageHeader } from '../../shared/components';
import { RewardsDashboard } from './RewardsDashboard';
import './rewards.css';

export default function RewardsPage() {
  const auth = useAuth();

  if (auth.status === 'loading') return <Loading label="Loading your rewards" />;

  if (auth.status === 'unconfigured') {
    return (
      <>
        <PageHeader title="Rewards" />
        <EmptyState title="The database isn't connected yet">
          Add your Supabase keys to .env.local and restart the app. Steps are in docs/SUPABASE_SETUP.md.
        </EmptyState>
      </>
    );
  }

  if (auth.status === 'error') {
    return (
      <>
        <PageHeader title="Rewards" />
        <EmptyState title="We couldn't load your account" action={<Button onClick={auth.retry}>Try again</Button>}>
          Check your connection and try again.
        </EmptyState>
      </>
    );
  }

  if (auth.status === 'signed-out') {
    return (
      <>
        <PageHeader title="Rewards" description="Earn Crumb Points, redeem them and send treats to friends." />
        <EmptyState title="Sign in to collect Crumb Points" action={<Button to="/profile">Create account or sign in</Button>}>
          Guests can look around and play, but points are saved to accounts. <Link to="/privacy">How we use your details</Link>.
        </EmptyState>
      </>
    );
  }

  return <RewardsDashboard />;
}
