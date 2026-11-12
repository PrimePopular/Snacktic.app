import { useEffect, useState } from 'react';
import { useAuth } from '../features/authentication';
import { NotificationsBell } from '../features/notifications';
import { ShareButton } from '../features/share';
import { getBalance, POINTS_CHANGED_EVENT } from '../features/points';
import { Logo } from '../shared/components';
import { Link } from './router';

/**
 * The bar at the top of every screen: the logo, the student's Crumb Points, and their profile.
 * The balance refreshes whenever something changes it (a game, a gift, an order).
 */
export function TopBar() {
  const auth = useAuth();
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    if (auth.status !== 'signed-in') {
      setBalance(null);
      return;
    }
    let active = true;
    const load = () => {
      getBalance()
        .then((value) => active && setBalance(value))
        .catch(() => undefined); // keep showing the last number if the connection drops
    };
    load();
    window.addEventListener(POINTS_CHANGED_EVENT, load);
    window.addEventListener('online', load);
    return () => {
      active = false;
      window.removeEventListener(POINTS_CHANGED_EVENT, load);
      window.removeEventListener('online', load);
    };
  }, [auth.status]);

  const initial = auth.profile?.username.charAt(0).toUpperCase() ?? '';

  return (
    <header className="top-bar">
      <Link to="/" className="top-bar__brand" aria-label="Snacktic home">
        <Logo size={30} showWordmark />
      </Link>
      <div className="top-bar__right">
        <ShareButton />
        <NotificationsBell />
        {balance !== null && (
          <Link to="/rewards" className="points-chip" aria-label={`${balance} Crumb Points. Open Rewards`}>
            <span className="points-chip__coin" aria-hidden="true" />
            {balance.toLocaleString()}
          </Link>
        )}
        {auth.status === 'signed-in' ? (
          <Link to="/profile" className="avatar-button" aria-label="Your profile">
            {initial}
          </Link>
        ) : (
          <Link to="/profile" className="top-bar__signin">
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
