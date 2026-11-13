import { useEffect, useState } from 'react';
import AdminApp from '../admin/AdminApp';
import { useAuth } from '../features/authentication';
import { FindFriendTag } from '../features/find-a-friend';
import { UpdateBanner } from '../pwa/UpdateBanner';
import FindFriendPage from '../pages/find-a-friend/FindFriendPage';
import { flushPendingResults } from '../features/points';
import DiscoverPage from '../pages/discover/DiscoverPage';
import { GameHost } from '../pages/games/GameHost';
import { SpecialEventHost } from '../pages/games/SpecialEventHost';
import GamesPage from '../pages/games/GamesPage';
import HomePage from '../pages/home/HomePage';
import PrivacyPage from '../pages/profile/PrivacyPage';
import ProfilePage from '../pages/profile/ProfilePage';
import ResetPasswordPage from '../pages/profile/ResetPasswordPage';
import RewardsPage from '../pages/rewards/RewardsPage';
import { Button, EmptyState } from '../shared/components';
import { AppNav } from './AppNav';
import { Splash } from './Splash';
import { TopBar } from './TopBar';
import { Router, useRoutePath } from './router';
import type { RouteDef } from './router';

/**
 * The route table. Foundation-owned: other developers do not add routes here directly.
 * Ask the Foundation developer, or add the route in your Pull Request description.
 */
const routes: RouteDef[] = [
  { path: '/', title: 'Home', render: () => <HomePage /> },
  { path: '/discover', title: 'Discover', render: () => <DiscoverPage /> },
  { path: '/games', title: 'Games', render: () => <GamesPage /> },
  { path: '/games/:id', title: 'Games', render: (p) => <GameHost id={p.id} /> },
  { path: '/games/events/:id', title: 'Special event', render: (p) => <SpecialEventHost id={p.id} /> },
  { path: '/find-a-friend', title: 'Find a Friend', render: () => <FindFriendPage /> },
  { path: '/rewards', title: 'Rewards', render: () => <RewardsPage /> },
  { path: '/profile', title: 'Profile', render: () => <ProfilePage /> },
  { path: '/privacy', title: 'Privacy', render: () => <PrivacyPage /> },
  { path: '/reset-password', title: 'New password', render: () => <ResetPasswordPage /> },
];

const notFound = (
  <EmptyState title="We can't find that page" action={<Button to="/">Go to Home</Button>}>
    The link may be out of date.
  </EmptyState>
);

function focusMain() {
  document.getElementById('main-content')?.focus();
}

/** Sends game results that were waiting (guest results after signing in, or saved while offline). */
function usePendingResultsSync() {
  const auth = useAuth();
  useEffect(() => {
    if (auth.status !== 'signed-in') return;
    void flushPendingResults();
    const onOnline = () => void flushPendingResults();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [auth.status]);
}

const SPLASH_KEY = 'snacktic.splashSeen';

function splashAlreadyShown(): boolean {
  try {
    return sessionStorage.getItem(SPLASH_KEY) === '1';
  } catch {
    return false;
  }
}

export default function App() {
  const path = useRoutePath();
  usePendingResultsSync();
  // The opening animation plays once each time the app is opened (not again while moving around).
  const [splash, setSplash] = useState(() => !splashAlreadyShown());

  // The admin dashboard is its own app, separate from the student shell.
  if (path === '/admin' || path.startsWith('/admin/')) {
    return <AdminApp />;
  }

  return (
    <div className="app-shell">
      {splash && (
        <Splash
          onDone={() => {
            try {
              sessionStorage.setItem(SPLASH_KEY, '1');
            } catch {
              /* private mode: the animation may play again next time */
            }
            setSplash(false);
          }}
        />
      )}
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault(); // a real hash change would trigger the router
          focusMain();
        }}
      >
        Skip to content
      </a>
      <TopBar />
      <UpdateBanner />
      <FindFriendTag />
      <main id="main-content" className="app-main" tabIndex={-1}>
        <Router routes={routes} notFound={notFound} />
      </main>
      <AppNav />
    </div>
  );
}
