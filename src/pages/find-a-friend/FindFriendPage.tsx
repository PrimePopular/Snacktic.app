import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../features/authentication';
import { getLeaderboard, getMyCode, inviteLink, joinEvent, listMyFriends, QrCode, useLiveFindFriend } from '../../features/find-a-friend';
import type { FoundFriend, LeaderRow } from '../../features/find-a-friend';
import { playChime } from '../../services/sound';
import { Button, Card, EmptyState, Loading, PageHeader } from '../../shared/components';
import './find-a-friend-page.css';

const endFormat = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

/**
 * Find a Friend. Join to get your personal QR code. Anyone can scan it with their normal phone camera: it opens Snacktic,
 * and when they sign up (or sign in) you earn points. The page exists only while the event is live.
 */
export default function FindFriendPage() {
  const live = useLiveFindFriend();
  const { status } = useAuth();
  const [code, setCode] = useState<string | null | undefined>(undefined);
  const [link, setLink] = useState('');
  const [friends, setFriends] = useState<FoundFriend[]>([]);
  const [board, setBoard] = useState<LeaderRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const eventId = live?.id;
  const signedIn = status === 'signed-in';

  const load = useCallback(async () => {
    if (!eventId || !signedIn) return;
    try {
      const mine = await getMyCode(eventId);
      setCode(mine);
      if (mine) setLink(await inviteLink(mine));
      const [joined, leaders] = await Promise.all([listMyFriends(), getLeaderboard(eventId)]);
      setFriends(joined);
      setBoard(leaders);
      setLoadError(false);
    } catch (error) {
      console.error('[find-a-friend] load', error);
      setLoadError(true);
    }
  }, [eventId, signedIn]);

  useEffect(() => {
    void load();
  }, [load]);

  async function join() {
    setBusy(true);
    setNotice(null);
    try {
      await joinEvent();
      playChime();
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Something went wrong.');
    }
    setBusy(false);
  }

  async function share() {
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: 'Join me on Snacktic', text: 'Good snacks, good moments. Join Snacktic with my invite!', url: link });
      } else {
        await navigator.clipboard.writeText(link);
        setNotice('Invite link copied.');
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setNotice('Could not share. Show the QR code instead.');
    }
  }

  if (live === undefined) return <Loading label="Checking for the event" />;

  if (live === null) {
    return (
      <>
        <PageHeader tone="rose" title="Find a Friend" />
        <EmptyState title="No Find a Friend event right now" action={<Button to="/">Back to Home</Button>}>
          When the next one starts, you'll see a tag on every screen.
        </EmptyState>
      </>
    );
  }

  const prizes = [live.prizeFirst, live.prizeSecond, live.prizeThird].filter((p) => p > 0);

  return (
    <>
      <PageHeader tone="rose" title={live.name} description={`Live until ${endFormat.format(new Date(live.endsAt))}`} />

      <Card className="ff-rules">
        <h2>How it works</h2>
        <ol>
          <li>Tap Join to get your personal QR code.</li>
          <li>Show it to a friend. They scan it with their normal phone camera and Snacktic opens. They don't need the app yet.</li>
          <li>
            When they sign up or sign in, <strong>you earn {live.pointsPerScan} Crumb {live.pointsPerScan === 1 ? 'Point' : 'Points'}</strong>. Each person counts for one inviter only.
          </li>
        </ol>
        {prizes.length > 0 && <p className="text-secondary text-small">The people who invite the most friends win bonus points when the event ends.</p>}
      </Card>

      {!signedIn && (
        <EmptyState title="Sign in to play" action={<Button to="/profile">Go to Profile</Button>}>
          You need an account to get your QR code and earn points.
        </EmptyState>
      )}

      {signedIn && code === undefined && !loadError && <Loading label="Loading your code" />}
      {signedIn && loadError && (
        <EmptyState title="We couldn't load the event" action={<Button onClick={() => void load()}>Try again</Button>}>
          Check your connection and try again. If this keeps happening, the latest database updates may not have been run.
        </EmptyState>
      )}

      {signedIn && code === null && (
        <div className="ff-join">
          <Button onClick={() => void join()} disabled={busy}>
            {busy ? 'Joining…' : 'Join and get my QR code'}
          </Button>
        </div>
      )}

      {notice && (
        <p className="form-notice" role="status">
          {notice}
        </p>
      )}

      {signedIn && typeof code === 'string' && link && (
        <>
          <Card className="ff-code">
            <h2>Your QR code</h2>
            <QrCode value={link} label="Your Snacktic invite QR code" />
            <Button onClick={() => void share()}>Share my invite link</Button>
          </Card>

          <section aria-labelledby="ff-friends">
            <h2 id="ff-friends">Friends who joined through you ({friends.length})</h2>
            {friends.length === 0 ? (
              <p className="text-secondary">None yet. Show your code to a friend!</p>
            ) : (
              <ul className="ff-list">
                {friends.map((f) => (
                  <li key={f.name + f.foundAt}>{f.name}</li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="ff-board">
            <h2 id="ff-board">Leaderboard</h2>
            {board.length === 0 ? (
              <p className="text-secondary">Nobody has invited a friend yet. Be the first!</p>
            ) : (
              <ol className="ff-board">
                {board.map((row) => (
                  <li key={row.place + row.name}>
                    <span className="ff-board__place">{row.place}</span>
                    <span className="ff-board__name">{row.name}</span>
                    <span className="ff-board__count">{row.found}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      )}
    </>
  );
}
