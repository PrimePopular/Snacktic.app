import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { TouchEvent } from 'react';
import { useAuth } from '../authentication';
import { useRoutePath } from '../../core/router';
import { Button, Modal } from '../../shared/components';
import { slides } from './slides';
import './onboarding.css';

const SEEN_KEY = 'snacktic.tourSeen';
const OPEN_EVENT = 'snacktic:open-tour';

function hasSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return true; // storage blocked: do not nag on every visit
  }
}

function markSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    /* ignore */
  }
}

/** Opens the guide again (used by the "Take the tour" buttons in Profile and Support). */
export function openOnboarding(): void {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

/**
 * A short, skippable tour of Snacktic. It opens by itself once, for a first-time visitor who is not signed in, after the
 * opening animation. Anyone can open it again from Profile or Support.
 */
export function Onboarding({ ready }: { ready: boolean }) {
  const auth = useAuth();
  const path = useRoutePath();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const titleId = useId();
  const touchX = useRef<number | null>(null);

  // First visit: show once. Students who are already signed in do not need it. Invite and password-reset pages stay clear.
  useEffect(() => {
    if (!ready || auth.status === 'loading' || open) return;
    if (path.startsWith('/r/') || path === '/reset-password') return;
    if (hasSeen()) return;
    if (auth.status === 'signed-in') {
      markSeen();
      return;
    }
    setIndex(0);
    setOpen(true);
  }, [ready, auth.status, path, open]);

  useEffect(() => {
    const show = () => {
      setIndex(0);
      setOpen(true);
    };
    window.addEventListener(OPEN_EVENT, show);
    return () => window.removeEventListener(OPEN_EVENT, show);
  }, []);

  const close = useCallback(() => {
    markSeen();
    setOpen(false);
  }, []);

  const last = index === slides.length - 1;
  const slide = slides[index];

  function onTouchEnd(event: TouchEvent) {
    const start = touchX.current;
    touchX.current = null;
    const end = event.changedTouches[0]?.clientX;
    if (start === null || end === undefined) return;
    if (end - start < -50 && !last) setIndex(index + 1);
    if (end - start > 50 && index > 0) setIndex(index - 1);
  }

  return (
    <Modal open={open} onClose={close} labelledBy={titleId} className="modal--tour">
      <div className="tour" onTouchStart={(e) => (touchX.current = e.touches[0]?.clientX ?? null)} onTouchEnd={onTouchEnd}>
        <div className="tour__top">
          <span className="tour__count" aria-live="polite">
            {index + 1} of {slides.length}
          </span>
          {!last && (
            <button type="button" className="link-button" onClick={close}>
              Skip
            </button>
          )}
        </div>
        {slide.art}
        <h2 id={titleId}>{slide.title}</h2>
        <p className="tour__text">{slide.text}</p>
        <div className="tour__dots" aria-hidden="true">
          {slides.map((s, i) => (
            <span key={s.id} className={i === index ? 'tour__dot tour__dot--on' : 'tour__dot'} />
          ))}
        </div>
        <div className="tour__actions">
          {index > 0 && (
            <Button variant="secondary" onClick={() => setIndex(index - 1)}>
              Back
            </Button>
          )}
          {last ? <Button onClick={close}>Let's go</Button> : <Button onClick={() => setIndex(index + 1)}>Next</Button>}
        </div>
      </div>
    </Modal>
  );
}
