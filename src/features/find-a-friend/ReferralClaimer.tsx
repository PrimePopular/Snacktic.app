import { useEffect } from 'react';
import { useAuth } from '../authentication';
import { claimReferral } from './findFriendService';
import { clearReferral, pendingReferral } from './referral';

/**
 * Invisible. When someone who opened an invite link is signed in, the person who invited them is credited. This runs after
 * sign-up and sign-in, so the invite survives registration. Nothing happens twice: the database counts each person once.
 */
export function ReferralClaimer() {
  const { status } = useAuth();

  useEffect(() => {
    if (status !== 'signed-in') return;
    const code = pendingReferral();
    if (!code) return;
    void claimReferral(code)
      .then(() => clearReferral())
      .catch((error: unknown) => console.error('[referral] claim', error)); // keep it and try again next time
  }, [status]);

  return null;
}
