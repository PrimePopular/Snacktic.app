import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { TouchEvent } from 'react';
import { GoogleButton, useAuth, useSignupBonus } from '../authentication';
import { navigate, useRoutePath } from '../../core/router';
import { Button, Modal } from '../../shared/components';
import { slides } from './slides';
import './onboarding.css';

const SEEN_KEY = 'snacktic.tourSeen';
const OPEN_EVENT = 'snacktic:open-tour';
/** People skip past the guide without reading it, so each slide holds the Next and Skip buttons for this long. */
const HOLD_MS = 2000;

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
 * A short tour of Snacktic that opens by itself once, for anyone who has not seen it. For visitors who have not signed up, a bold
 * blue Sign up bar (with Google) stays on every slide, so joining is always one tap away. Next and Skip wait two seconds on each
 * slide so the guide is actually read.
 */
export function Onboarding({ ready }: { ready: boolean }) {
  const auth = useAuth();
  const path = useRoutePath();
  const bonus = useSignupBonus();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [held, setHeld] = useState(true);
  const titleId = useId();
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    if (!ready || auth.status === 'loading' || open) return;
    if (path.startsWith('/r/') || path.startsWith('/t/') || path === '/reset-password') return;
    if (hasSeen()) return;
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

  // Hold the buttons for two seconds every time a new slide appears.
  useEffect(() => {
    if (!open) return;
    setHeld(true);
    const timer = window.setTimeout(() => setHeld(false), HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [open, index]);

  const close = useCallback(() => {
    markSeen();
    setOpen(false);
  }, []);

  const signUp = useCallback(() => {
    markSeen();
    setOpen(false);
    navigate('/profile');
  }, []);

  const last = index === slides.length - 1;
  const slide = slides[index];
  const guest = auth.status === 'signed-out';

  function next() {
    if (!held && !last) setIndex(index + 1);
  }

  function onTouchEnd(event: TouchEvent) {
    const start = touchX.current;
    touchX.current = null;
    const end = event.changedTouches[0]?.clientX;
    if (start === null || end === undefined) return;
    if (end - start < -50) next();
    if (end - start > 50 && index > 0) setIndex(index - 1);
  }

  return (
    <Modal open={open} onClose={() => !held && close()} labelledBy={titleId} className="modal--tour">
      <div className="tour" onTouchStart={(e) => (touchX.current = e.touches[0]?.clientX ?? null)} onTouchEnd={onTouchEnd}>
        {guest && (
          <div className="tour-signup">
            <p className="tour-signup__title">{bonus > 0 ? `Sign up free and get ${bonus} Crumb Points` : 'Sign up free to start earning'}</p>
            <button type="button" className="signup-cta" onClick={signUp}>
              Sign up
            </button>
            <GoogleButton label="Sign up with Google" />
          </div>
        )}
        <div className="tour__top">
          <span className="tour__count" aria-live="polite">
            {index + 1} of {slides.length}
          </span>
        </div>
        {slide.art}
        <h2 id={titleId}>{slide.title}</h2>
        <p className="tour__text">{slide.text}</p>
        {slide.extra}
        <div className="tour__dots" aria-hidden="true">
          {slides.map((s, i) => (
            <span key={s.id} className={i === index ? 'tour__dot tour__dot--on' : 'tour__dot'} />
          ))}
        </div>
        <div className="tour__hold" aria-hidden="true">
          <span key={index} className="tour__hold-fill" style={{ animationDuration: `${HOLD_MS}ms` }} />
        </div>
        <div className="tour__actions">
          {index > 0 && (
            <Button variant="secondary" onClick={() => setIndex(index - 1)}>
              Back
            </Button>
          )}
          {last ? (
            <Button disabled={held} onClick={close}>
              {guest ? 'Maybe later' : "Let's go"}
            </Button>
          ) : (
            <Button disabled={held} onClick={next}>
              Next
            </Button>
          )}
        </div>
        {!last && (
          <button type="button" className="link-button tour__skip" disabled={held} onClick={close}>
            Skip the tour
          </button>
        )}
        {guest && (
          <p className="tour__small">
            Already have an account?{' '}
            <button type="button" className="link-button" onClick={signUp}>
              Sign in
            </button>
          </p>
        )}
      </div>
    </Modal>
  );
}
