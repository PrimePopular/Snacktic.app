import { useEffect, useState } from 'react';
import { GoogleButton, useAuth, useSignupBonus } from '../../features/authentication';
import { claimTreasure, forgetTreasure, rememberTreasure } from '../../features/treasure';
import type { ClaimResult } from '../../features/treasure';
import { navigate } from '../../core/router';
import { Button, Card, Loading } from '../../shared/components';

/**
 * Where a scanned Treasure Hunt QR code lands. A signed-in student claims it straight away; a visitor is asked to sign up first and
 * is brought back here afterwards. The database decides the result: found, already found, too late, or not active.
 */
export default function TreasurePage({ token }: { token: string }) {
  const auth = useAuth();
  const bonus = useSignupBonus();
  const [result, setResult] = useState<ClaimResult | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (auth.status === 'signed-out') rememberTreasure(token);
    if (auth.status !== 'signed-in') return;
    let active = true;
    claimTreasure(token)
      .then((r) => {
        if (!active) return;
        forgetTreasure();
        setResult(r);
      })
      .catch((e: unknown) => active && setProblem(e instanceof Error ? e.message : 'Something went wrong.'));
    return () => {
      active = false;
    };
  }, [auth.status, token]);

  if (auth.status === 'loading') return <Loading label="Checking the treasure" />;

  if (auth.status === 'signed-out') {
    return (
      <Card as="section" className="treasure-card">
        <h1>You found a treasure code!</h1>
        <p>Sign up or sign in to claim it. {bonus > 0 ? `New members also get ${bonus} Crumb Points.` : ''}</p>
        <button type="button" className="signup-cta treasure-cta" onClick={() => navigate('/profile')}>
          Sign up to claim
        </button>
        <GoogleButton label="Sign up with Google" />
        <p className="text-secondary text-small">Your treasure is saved. Once you are signed in you will come straight back here.</p>
      </Card>
    );
  }

  if (problem) {
    return (
      <Card as="section" className="treasure-card">
        <h1>Hmm.</h1>
        <p role="alert">{problem}</p>
        <Button onClick={() => window.location.reload()}>Try again</Button>
      </Card>
    );
  }
  if (!result) return <Loading label="Claiming your treasure" />;

  const messages: Record<ClaimResult['status'], { title: string; text: string }> = {
    found: { title: 'Treasure found!', text: `You earned ${result.points.toLocaleString()} Crumb Points${result.name ? ` for finding "${result.name}"` : ''}. Well done, hunter.` },
    already: { title: 'You already found this one', text: 'Each treasure can only be claimed once per person. Go and find another!' },
    too_late: { title: 'Too late!', text: 'Someone else got there first. This treasure has been found by everyone it was meant for. Keep hunting for another.' },
    closed: { title: 'This treasure is closed', text: 'The hunt for this code has ended.' },
    invalid: { title: 'We do not know this code', text: 'The code could not be read. Check that you scanned the whole QR code.' },
  };
  const m = messages[result.status];
  return (
    <Card as="section" className={`treasure-card${result.status === 'found' ? ' treasure-card--win' : ''}`}>
      <h1>{m.title}</h1>
      <p>{m.text}</p>
      <div className="game-result__actions">
        <Button onClick={() => navigate('/rewards')}>See rewards</Button>
        <Button variant="secondary" onClick={() => navigate('/')}>
          Back home
        </Button>
      </div>
    </Card>
  );
}
