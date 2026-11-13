import { useEffect, useRef, useState } from 'react';
import { getBalance, POINTS_CHANGED_EVENT } from '../../features/points';
import { Loading } from '../../shared/components';
import { restoreProgress, saveProgress } from './gameProgress';
import type { ProgressSpec } from './gameProgress';
import './games-embed.css';

export interface GameMessage {
  type: string;
  [key: string]: unknown;
}

/** Sends a message to the game page (for example the player's Crumb Points balance). */
export type SendToGame = (message: GameMessage) => void;

interface GameFrameProps {
  /** A page from /games/. It reports with window.parent.postMessage({ source: 'snacktic-game', type, ... }). */
  src: string;
  title: string;
  onMessage: (message: GameMessage, send: SendToGame) => void;
  onLeave: () => void;
  /** Called when the game page has loaded, so the app can send it the starting balance. */
  onLoad?: (send: SendToGame) => void;
  /** Keeps this game's progress saved in the database. */
  progress?: ProgressSpec;
  /** A short line shown above the game, for example "+2 Crumb Points". */
  notice?: string | null;
}

/** Runs a game page inside the app and passes on its messages. Only messages from this frame, on this site, are accepted. */
export function GameFrame({ src, title, onMessage, onLeave, onLoad, progress, notice }: GameFrameProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const handler = useRef(onMessage);
  handler.current = onMessage;
  const loadHandler = useRef(onLoad);
  loadHandler.current = onLoad;
  const [ready, setReady] = useState(!progress);
  const [balance, setBalance] = useState<number | null>(null);

  const send: SendToGame = (message) => {
    frame.current?.contentWindow?.postMessage({ source: 'snacktic-host', ...message }, window.location.origin);
  };
  const sendRef = useRef(send);
  sendRef.current = send;

  // The page must not scroll behind a running game, or a swipe can scroll the page instead of reaching the game.
  useEffect(() => {
    document.body.classList.add('game-open');
    return () => document.body.classList.remove('game-open');
  }, []);

  // Bring saved progress back before the game opens, then keep it saved.
  useEffect(() => {
    if (!progress) return;
    let active = true;
    void restoreProgress(progress).finally(() => active && setReady(true));
    const save = () => void saveProgress(progress);
    const timer = window.setInterval(save, 20_000);
    const onHide = () => document.visibilityState === 'hidden' && save();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', save);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', save);
      save();
    };
  }, [progress]);

  useEffect(() => {
    function listen(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow) return;
      const data = event.data as { source?: unknown; type?: unknown } | null;
      if (data && data.source === 'snacktic-game' && typeof data.type === 'string') handler.current(data as GameMessage, (m) => sendRef.current(m));
    }
    window.addEventListener('message', listen);
    return () => window.removeEventListener('message', listen);
  }, []);

  // The student's Crumb Points stay visible while they play.
  useEffect(() => {
    const load = () => void getBalance().then(setBalance).catch(() => undefined);
    load();
    window.addEventListener(POINTS_CHANGED_EVENT, load);
    return () => window.removeEventListener(POINTS_CHANGED_EVENT, load);
  }, []);

  if (!ready) return <Loading label="Opening your game" />;

  return (
    <div className="game-screen">
      <header className="game-screen__bar">
        <button type="button" className="game-screen__leave" onClick={onLeave}>
          ← Leave game
        </button>
        <span className="game-screen__title">{title}</span>
        {balance !== null && (
          <span className="points-chip" aria-label={`${balance} Crumb Points`}>
            <span className="points-chip__coin" aria-hidden="true" />
            {balance}
          </span>
        )}
      </header>
      {notice && (
        <p className="game-screen__notice" role="status">
          {notice}
        </p>
      )}
      <iframe
        ref={frame}
        className="game-frame"
        src={src}
        title={title}
        allow="autoplay; vibrate"
        onLoad={() => loadHandler.current?.((m) => sendRef.current(m))}
      />
    </div>
  );
}
