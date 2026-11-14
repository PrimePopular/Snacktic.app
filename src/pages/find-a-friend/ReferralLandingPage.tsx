import { useEffect, useState } from 'react';
import { useAuth } from '../../features/authentication';
import { claimReferral, getReferralInfo, rememberReferral } from '../../features/find-a-friend';
import { Button, Card, Loading, PageHeader } from '../../shared/components';

/** Where a scanned invite QR code lands. Remembers the invite so it survives sign-up and sign-in. */
export default function ReferralLandingPage({ code }: { code: string }) {
  const { status } = useAuth();
  const [name, setName] = useState<string | null | undefined>(undefined);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    rememberReferral(code);
    let active = true;
    void getReferralInfo(code).then((info) => active && setName(info ? info.name : null));
    return () => {
      active = false;
    };
  }, [code]);

  // Already signed in (an existing student): credit the inviter right away.
  useEffect(() => {
    if (status !== 'signed-in') return;
    void claimReferral(code)
      .then((r) => {
        setDone(
          r.result === 'rewarded'
            ? `Welcome! ${r.name ?? 'Your friend'} has been rewarded for inviting you.`
            : r.result === 'self'
              ? "That's your own invite code. Share it with a friend instead!"
              : r.result === 'already_referred'
                ? "You've already joined through an invite. Enjoy Snacktic!"
                : 'Welcome to Snacktic!',
        );
      })
      .catch(() => setDone('Welcome to Snacktic!'));
  }, [status, code]);

  if (status === 'loading' || name === undefined) return <Loading label="Opening your invite" />;

  return (
    <>
      <PageHeader tone="rose" title="Welcome to Snacktic" description="Good snacks, good moments." />
      <Card tone="warm">
        {name && <h2>{name} invited you!</h2>}
        {status === 'signed-in' ? (
          <>
            <p>{done ?? 'One moment…'}</p>
            <Button to="/">Go to Home</Button>
          </>
        ) : (
          <>
            <p>Create an account or sign in to join. It only takes a minute.</p>
            <Button to="/profile">Create an account or sign in</Button>
          </>
        )}
      </Card>
    </>
  );
}
