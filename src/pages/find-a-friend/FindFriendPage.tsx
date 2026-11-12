import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../../features/authentication';
import {
  CODE_PREFIX,
  getLeaderboard,
  getMyCode,
  joinEvent,
  listMyFriends,
  QrCode,
  QrScanner,
  scanCode,
  useLiveFindFriend,
} from '../../features/find-a-friend';
import type { FoundFriend, LeaderRow } from '../../features/find-a-friend';
import { playChime, playTap } from '../../services/sound';
import { Button, Card, EmptyState, Loading, PageHeader, TextField } from '../../shared/components';
import './find-a-friend-page.css';

const endFormat = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

interface Notice {
  ok: boolean;
  text: string;
}

/**
 * Find a Friend. Join to get your personal QR code, scan a friend's code to earn points, and watch
 * the leaderboard. Everything is checked by the database. The page exists only while the event is live.
 */
export default function FindFriendPage() {
  const live = useLiveFindFriend();
  const { status } = useAuth();
  const [code, setCode] = useState<string | null | undefined>(undefined);
  const [friends, setFriends] = useState<FoundFriend[]>([]);
  const [board, setBoard] = useState<LeaderRow[]>([]);
  const [scanning, setScanning] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loadError, setLoadError] = useState(false);
  const eventId = live?.id;
  const signedIn = status === 'signed-in';

  const load = useCallback(async () => {
    if (!eventId || !signedIn) return;
    try {
      const mine = await getMyCode(eventId);
      setCode(mine);
      const [found, leaders] = await Promise.all([listMyFriends(), getLeaderboard(eventId)]);
      setFriends(found);
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
      setCode(await joinEvent());
      playChime();
      await load();
    } catch (error) {
      setNotice({ ok: false, text: error instanceof Error ? error.message : 'Something went wrong.' });
    }
    setBusy(false);
  }

  async function submit(value: string) {
    const cleaned = value.trim().replace(CODE_PREFIX, '');
    if (!cleaned) return;
    setScanning(false);
    setBusy(true);
    setNotice(null);
    try {
      const result = await scanCode(cleaned);
      playChime();
      setNotice({
        ok: true,
        text: result.points > 0 ? `You found ${result.name}! +${result.points} Crumb Points.` : `You found ${result.name}!`,
      });
      setTyped('');
      await load();
    } catch (error) {
      setNotice({ ok: false, text: error instanceof Error ? error.message : 'Something went wrong.' });
    }
    setBusy(false);
  }

  function handleTyped(event: FormEvent) {
    event.preventDefault();
    void submit(typed);
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
          <li>Tap Join to get your personal code.</li>
          <li>Find a friend and scan their code. You earn {live.pointsPerScan} Crumb {live.pointsPerScan === 1 ? 'Point' : 'Points'} for each friend you find.</li>
          <li>Each code can be scanned only once. If you found someone, they need to find somebody else.</li>
        </ol>
        {prizes.length > 0 && <p className="text-secondary text-small">The top finders win bonus points when the event ends.</p>}
      </Card>

      {!signedIn && (
        <EmptyState title="Sign in to play" action={<Button to="/profile">Go to Profile</Button>}>
          You need an account to get a code and earn points.
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
            {busy ? 'Joining…' : 'Join and get my code'}
          </Button>
        </div>
      )}

      {notice && (
        <p className={notice.ok ? 'form-notice' : 'form-error'} role={notice.ok ? 'status' : 'alert'}>
          {notice.text}
        </p>
      )}

      {signedIn && typeof code === 'string' && (
        <>
          <Card className="ff-code">
            <h2>Your code</h2>
            <QrCode value={`${CODE_PREFIX}${code}`} label="Your Snacktic Find a Friend code" />
            <p className="text-secondary text-small">
              Let a friend scan this. No camera? They can type <strong>{code}</strong> instead.
            </p>
          </Card>

          <Card className="ff-scan">
            <h2>Find a friend</h2>
            {scanning ? (
              <QrScanner onCode={(value) => void submit(value)} onClose={() => setScanning(false)} />
            ) : (
              <>
                <Button
                  disabled={busy}
                  onClick={() => {
                    playTap();
                    setNotice(null);
                    setScanning(true);
                  }}
                >
                  Scan a friend's code
                </Button>
                <form className="ff-typed" onSubmit={handleTyped}>
                  <TextField label="Or type their code" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoCapitalize="none" maxLength={40} />
                  <Button type="submit" variant="secondary" disabled={busy || typed.trim() === ''}>
                    Check code
                  </Button>
                </form>
              </>
            )}
          </Card>

          <section aria-labelledby="ff-friends">
            <h2 id="ff-friends">Friends you found ({friends.length})</h2>
            {friends.length === 0 ? (
              <p className="text-secondary">None yet. Go find someone!</p>
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
              <p className="text-secondary">Nobody has found a friend yet. Be the first!</p>
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
