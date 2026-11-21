import { useEffect, useState } from 'react';
import { Link, navigate, useRoutePath } from '../../core/router';
import { DEFAULT_REWARD_SETTINGS, getRewardSettings } from '../points/rewardSettingsService';
import { useAuth } from './AuthContext';
import { GoogleButton } from './GoogleButton';
import './signup.css';

const HIDE_KEY = 'snacktic.hideSignupBanner';

/** The bonus a new member gets, for any "Sign up" text. */
export function useSignupBonus(): number {
  const [bonus, setBonus] = useState(DEFAULT_REWARD_SETTINGS.signupBonus);
  useEffect(() => {
    let active = true;
    void getRewardSettings().then((s) => active && setBonus(s.signupBonus));
    return () => {
      active = false;
    };
  }, []);
  return bonus;
}

/** A big, plain "Sign up" for visitors who have not joined yet. Shown at the top of Home. It can be dismissed for this visit. */
export function SignupBanner() {
  const auth = useAuth();
  const bonus = useSignupBonus();
  const [hidden, setHidden] = useState(() => {
    try {
      return sessionStorage.getItem(HIDE_KEY) === '1';
    } catch {
      return false;
    }
  });
  if (auth.status !== 'signed-out' || hidden) return null;
  return (
    <section className="signup-banner" aria-label="Sign up">
      <h2>Sign up free</h2>
      <p>{bonus > 0 ? `Join Snacktic and get ${bonus} Crumb Points right away.` : 'Join Snacktic to earn Crumb Points, play games and get rewards.'}</p>
      <button type="button" className="signup-cta" onClick={() => navigate('/profile')}>
        Sign up
      </button>
      <GoogleButton label="Sign up with Google" />
      <p className="signup-banner__small">
        Already have an account? <Link to="/profile">Sign in</Link>
      </p>
      <button
        type="button"
        className="link-button signup-banner__later"
        onClick={() => {
          try {
            sessionStorage.setItem(HIDE_KEY, '1');
          } catch {
            /* ignore */
          }
          setHidden(true);
        }}
      >
        Not now
      </button>
    </section>
  );
}

/** A slim "Sign up" strip for the other main screens, for visitors who have not joined. */
export function SignupStrip() {
  const auth = useAuth();
  const path = useRoutePath();
  const bonus = useSignupBonus();
  if (auth.status !== 'signed-out') return null;
  if (path === '/' || path.startsWith('/profile') || path.startsWith('/admin') || path.startsWith('/r/') || path.startsWith('/t/') || path === '/reset-password') return null;
  return (
    <div className="signup-strip" role="note">
      <span>{bonus > 0 ? `Sign up and get ${bonus} Crumb Points` : 'Sign up to earn Crumb Points'}</span>
      <button type="button" className="signup-strip__btn" onClick={() => navigate('/profile')}>
        Sign up
      </button>
    </div>
  );
}
