import { ClockIcon, GiftIcon, PassIcon, ScanIcon, StarIcon, TrophyIcon } from '../../features/find-a-friend/FfIcons';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../features/authentication';
import { claimReferral, getLeaderboard, getMyCode, inviteLink, joinEvent, listMyFriends, QrCode, QrScanner, useLiveFindFriend } from '../../features/find-a-friend';
import type { FoundFriend, LeaderRow } from '../../features/find-a-friend';
import { playChime, playTap } from '../../services/sound';
import { Button, Card, EmptyState, Loading } from '../../shared/components';
import './find-a-friend-page.css';

const endFormat = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

const SCAN_RESULTS: Record<string, string> = {
  self: "That's your own code. Show it to a friend instead!",
  already_referred: "You've already joined through an invite, and each person can only be invited once. Enjoy Snacktic!",
  limit: 'That player has reached their invite limit for now.',
  invalid: "That code isn't part of this event.",
  no_event: 'There is no Find a Friend event right now.',
};

/**
 * Find a Friend. Join to get your personal QR pass. Anyone can scan it with a normal phone camera: it opens Snacktic, and
 * when they sign up or sign in you earn points. People who already have Snacktic can scan a friend's pass right here.
 */
export default function FindFriendPage() {
  const live = useLiveFindFriend();
  const { status, profile } = useAuth();
  const [code, setCode] = useState<string | null | undefined>(undefined);
  const [link, setLink] = useState('');
  const [friends, setFriends] = useState<FoundFriend[]>([]);
  const [board, setBoard] = useState<LeaderRow[]>([]);
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
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
      setNotice({ ok: false, text: error instanceof Error ? error.message : 'Something went wrong.' });
    }
    setBusy(false);
  }

  async function share() {
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: 'Join me on Snacktic', text: 'Good snacks, good moments. Join Snacktic with my invite!', url: link });
      } else {
        await navigator.clipboard.writeText(link);
        setNotice({ ok: true, text: 'Invite link copied.' });
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setNotice({ ok: false, text: 'Could not share. Show the QR code instead.' });
    }
  }

  async function handleScanned(scanned: string) {
    setScanning(false);
    setBusy(true);
    setNotice(null);
    try {
      const result = await claimReferral(scanned);
      if (result.result === 'rewarded') {
        playChime();
        setNotice({ ok: true, text: `Done! ${result.name ?? 'Your friend'} has been rewarded for inviting you. Welcome to Snacktic!` });
      } else {
        setNotice({ ok: false, text: SCAN_RESULTS[result.result] ?? 'That code could not be used.' });
      }
    } catch (error) {
      setNotice({ ok: false, text: error instanceof Error ? error.message : 'Something went wrong.' });
    }
    setBusy(false);
  }

  if (live === undefined) return <Loading label="Checking for the event" />;

  if (live === null) {
    return (
      <>
        <section className="ff-hero ff-hero--quiet">
          <h1>Find a Friend</h1>
          <p>Nothing is running right now. When the next one starts, you'll see a tag on every screen.</p>
        </section>
        <EmptyState title="No Find a Friend event right now" action={<Button to="/">Back to Home</Button>}>
          Check back soon.
        </EmptyState>
      </>
    );
  }

  const prizes = [live.prizeFirst, live.prizeSecond, live.prizeThird].filter((p) => p > 0);
  const podium = [board[1], board[0], board[2]];
  const rest = board.slice(3);

  return (
    <>
      <section className="ff-hero">
        <p className="ff-hero__kicker">LIVE NOW</p>
        <h1>{live.name}</h1>
        <p className="ff-hero__lead">Bring your friends to Snacktic and earn Crumb Points for every one who joins.</p>
        <div className="ff-chips">
          <span className="ff-chip">
            <GiftIcon size={16} /> <strong>{live.pointsPerScan}</strong> {live.pointsPerScan === 1 ? 'point' : 'points'} per friend
          </span>
          <span className="ff-chip">
            <ClockIcon size={16} /> Ends {endFormat.format(new Date(live.endsAt))}
          </span>
          {prizes.length > 0 && (
            <span className="ff-chip">
              <TrophyIcon size={16} /> Top 3 win bonus
            </span>
          )}
        </div>
      </section>

      <ol className="ff-steps">
        <li>
          <span className="ff-steps__icon"><PassIcon /></span>
          <div>
            <strong>Get your pass</strong>
            <p>Tap Join to get your personal QR pass.</p>
          </div>
        </li>
        <li>
          <span className="ff-steps__icon"><ScanIcon /></span>
          <div>
            <strong>Let them scan it</strong>
            <p>A friend scans it with their normal camera. Snacktic opens, even if they don't have it yet.</p>
          </div>
        </li>
        <li>
          <span className="ff-steps__icon"><StarIcon /></span>
          <div>
            <strong>You earn points</strong>
            <p>When they sign up or sign in, you get {live.pointsPerScan} Crumb {live.pointsPerScan === 1 ? 'Point' : 'Points'}. Each person can only be invited once.</p>
          </div>
        </li>
      </ol>

      {!signedIn && (
        <EmptyState title="Sign in to play" action={<Button to="/profile">Go to Profile</Button>}>
          You need an account to get your QR pass and earn points.
        </EmptyState>
      )}

      {signedIn && code === undefined && !loadError && <Loading label="Loading your pass" />}
      {signedIn && loadError && (
        <EmptyState title="We couldn't load the event" action={<Button onClick={() => void load()}>Try again</Button>}>
          Check your connection and try again. If this keeps happening, the latest database updates may not have been run.
        </EmptyState>
      )}

      {signedIn && code === null && (
        <div className="ff-join">
          <Button onClick={() => void join()} disabled={busy}>
            {busy ? 'Joining…' : 'Join and get my QR pass'}
          </Button>
        </div>
      )}

      {notice && (
        <p className={notice.ok ? 'form-notice' : 'form-error'} role={notice.ok ? 'status' : 'alert'}>
          {notice.text}
        </p>
      )}

      {signedIn && typeof code === 'string' && link && (
        <section className="ff-pass" aria-label="Your invite pass">
          <p className="ff-pass__label">SNACKTIC INVITE PASS</p>
          <p className="ff-pass__name">{profile?.username ?? 'You'}</p>
          <div className="ff-pass__qr">
            <QrCode value={link} label="Your Snacktic invite QR code" />
          </div>
          <div className="ff-pass__stats">
            <span>
              <strong>{friends.length}</strong> invited
            </span>
            <span>
              <strong>{friends.length * live.pointsPerScan}</strong> points earned
            </span>
          </div>
          <Button onClick={() => void share()}>Share my invite link</Button>
        </section>
      )}

      {signedIn && (
        <Card className="ff-scan">
          <h2>Scan a friend's pass</h2>
          {scanning ? (
            <QrScanner onCode={(scanned) => void handleScanned(scanned)} onClose={() => setScanning(false)} />
          ) : (
            <>
              <p className="text-secondary text-small">Already on Snacktic? Scan a friend's QR pass here, and they earn the points.</p>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  playTap();
                  setNotice(null);
                  setScanning(true);
                }}
              >
                Open the scanner
              </Button>
            </>
          )}
        </Card>
      )}

      {signedIn && typeof code === 'string' && (
        <section aria-labelledby="ff-friends">
          <h2 id="ff-friends">Friends who joined through you ({friends.length})</h2>
          {friends.length === 0 ? (
            <p className="text-secondary">None yet. Show your pass to a friend!</p>
          ) : (
            <ul className="ff-list">
              {friends.map((f) => (
                <li key={f.name + f.foundAt}>{f.name}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      {signedIn && (
        <section aria-labelledby="ff-board">
          <h2 id="ff-board">Leaderboard</h2>
          {board.length === 0 ? (
            <p className="text-secondary">Nobody has invited a friend yet. Be the first!</p>
          ) : (
            <>
              <ol className="ff-podium">
                {podium.map((row, i) =>
                  row ? (
                    <li key={row.place + row.name} className={`ff-podium__step ff-podium__step--${row.place}`}>
                      <span className={`ff-podium__medal ff-podium__medal--${row.place}`} aria-label={`Place ${row.place}`}>
                        {row.place}
                      </span>
                      <span className="ff-podium__name">{row.name}</span>
                      <span className="ff-podium__count">{row.found}</span>
                    </li>
                  ) : (
                    <li key={`empty-${i}`} aria-hidden="true" />
                  ),
                )}
              </ol>
              {rest.length > 0 && (
                <ol className="ff-board" start={4}>
                  {rest.map((row) => (
                    <li key={row.place + row.name}>
                      <span className="ff-board__place">{row.place}</span>
                      <span className="ff-board__name">{row.name}</span>
                      <span className="ff-board__count">{row.found}</span>
                    </li>
                  ))}
                </ol>
              )}
            </>
          )}
        </section>
      )}
    </>
  );
}
