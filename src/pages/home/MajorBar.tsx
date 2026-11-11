import { useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import type { Announcement } from '../../features/announcements';
import { pictureUrl } from '../../services/pictures';
import { playChime, playTap } from '../../services/sound';
import { Logo } from '../../shared/components';

interface MajorBarProps {
  item: Announcement;
  onDismiss: (id: string) => void;
}

const SWIPE_DISTANCE = 90;

/**
 * An important announcement shown like a phone notification: it floats over the top of the screen
 * and does NOT push the page down. Tap it to open the full message and picture, swipe it sideways
 * or press × to dismiss.
 */
export function MajorBar({ item, onDismiss }: MajorBarProps) {
  const [open, setOpen] = useState(false);
  const [dx, setDx] = useState(0);
  const startX = useRef<number | null>(null);
  const dragged = useRef(false);

  // A soft chime when it appears. Phones keep sound off until the first tap, so on a fresh open it may stay silent.
  useEffect(() => {
    playChime();
  }, []);

  function onPointerDown(event: PointerEvent) {
    startX.current = event.clientX;
    dragged.current = false;
  }

  function onPointerMove(event: PointerEvent) {
    if (startX.current === null) return;
    const delta = event.clientX - startX.current;
    if (Math.abs(delta) > 8) dragged.current = true;
    setDx(delta);
  }

  function finish() {
    if (startX.current === null) return;
    startX.current = null;
    if (Math.abs(dx) > SWIPE_DISTANCE) onDismiss(item.id);
    else setDx(0);
  }

  const image = item.imagePath ? pictureUrl(item.imagePath) : null;

  return (
    <div className="major-float" role="status" style={{ transform: `translateX(${dx}px)`, opacity: Math.max(0.35, 1 - Math.abs(dx) / 260) }}>
      <div
        className="major-note"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
        onPointerLeave={finish}
      >
        <div className="major-note__row">
          {image ? (
            <img className="major-note__thumb" src={image} alt="" decoding="async" draggable={false} />
          ) : (
            <span className="major-note__icon" aria-hidden="true">
              <Logo size={26} />
            </span>
          )}
          <button
            type="button"
            className="major-note__main"
            aria-expanded={open}
            onClick={() => {
              if (dragged.current) return;
              playTap();
              setOpen((v) => !v);
            }}
          >
            <span className="major-note__label">Important</span>
            <span className="major-note__title">{item.title}</span>
            {!open && item.body && <span className="major-note__text">{item.body}</span>}
          </button>
          <button type="button" className="major-note__close" aria-label={`Dismiss: ${item.title}`} onClick={() => onDismiss(item.id)}>
            ×
          </button>
        </div>
        {open && (
          <div className="major-note__full">
            {image && <img src={image} alt="" decoding="async" draggable={false} />}
            {item.body && <p>{item.body}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
