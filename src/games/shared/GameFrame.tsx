import { useEffect, useRef } from 'react';
import { Button } from '../../shared/components';
import './games-embed.css';

export interface GameMessage {
  type: string;
  [key: string]: unknown;
}

interface GameFrameProps {
  /** A page from /games/. It reports with window.parent.postMessage({ source: 'snacktic-game', type, ... }). */
  src: string;
  title: string;
  onMessage: (message: GameMessage) => void;
  onLeave: () => void;
  /** A short line shown above the game, for example "+2 Crumb Points". */
  notice?: string | null;
}

/** Runs a game page inside the app and passes on its messages. Only messages from this frame, on this site, are accepted. */
export function GameFrame({ src, title, onMessage, onLeave, notice }: GameFrameProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const handler = useRef(onMessage);
  handler.current = onMessage;

  useEffect(() => {
    function listen(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow) return;
      const data = event.data as { source?: unknown; type?: unknown } | null;
      if (data && data.source === 'snacktic-game' && typeof data.type === 'string') handler.current(data as GameMessage);
    }
    window.addEventListener('message', listen);
    return () => window.removeEventListener('message', listen);
  }, []);

  return (
    <div className="game-frame-wrap">
      {notice && (
        <p className="form-notice" role="status">
          {notice}
        </p>
      )}
      <iframe ref={frame} className="game-frame" src={src} title={title} allow="autoplay; vibrate" />
      <Button variant="secondary" onClick={onLeave}>
        Leave game
      </Button>
    </div>
  );
}
