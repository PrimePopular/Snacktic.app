import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { navigate } from '../../core/router';
import { playChime } from '../../services/sound';
import { Button, Modal } from '../../shared/components';
import { useAuth } from '../authentication';
import { listNotifications, markAllRead } from './notificationsService';
import type { AppNotification } from './notificationsService';
import './notifications.css';

const timeFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/**
 * The bell in the top bar. Shows how many messages are new and opens the list. It checks for new
 * messages when the app opens, every minute while it is on screen, and when it comes back online.
 */
export function NotificationsBell() {
  const { status } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const known = useRef<number | null>(null);
  const titleId = useId();
  const signedIn = status === 'signed-in';

  const load = useCallback(async () => {
    try {
      const next = await listNotifications();
      const unread = next.filter((n) => !n.read).length;
      if (known.current !== null && unread > known.current) playChime();
      known.current = unread;
      setItems(next);
    } catch (error) {
      console.error('[notifications] load', error);
    }
  }, []);

  useEffect(() => {
    if (!signedIn) {
      setItems([]);
      known.current = null;
      return;
    }
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 60_000);
    const onOnline = () => void load();
    window.addEventListener('online', onOnline);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('online', onOnline);
    };
  }, [signedIn, load]);

  if (!signedIn) return null;
  const unread = items.filter((n) => !n.read).length;

  function openList() {
    setFresh(new Set(items.filter((n) => !n.read).map((n) => n.id)));
    setOpen(true);
    if (unread > 0) {
      known.current = 0;
      void markAllRead()
        .then(load)
        .catch((error: unknown) => console.error('[notifications] mark read', error));
    }
  }

  return (
    <>
      <button type="button" className="bell-button" onClick={openList} aria-label={unread > 0 ? `${unread} new messages` : 'Messages'}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9z" />
          <path d="M10 20a2 2 0 0 0 4 0" />
        </svg>
        {unread > 0 && <span className="bell-button__badge">{unread > 9 ? '9+' : unread}</span>}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy={titleId}>
        <div className="notes">
          <h2 id={titleId}>Messages</h2>
          {items.length === 0 ? (
            <p className="text-secondary">Nothing here yet.</p>
          ) : (
            <ul className="notes__list">
              {items.map((n) => (
                <li key={n.id} className={fresh.has(n.id) ? 'notes__item notes__item--new' : 'notes__item'}>
                  <strong>{n.title}</strong>
                  {n.body && <p>{n.body}</p>}
                  <span className="text-xs text-secondary">{timeFormat.format(new Date(n.createdAt))}</span>
                  {n.link && (
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => {
                        setOpen(false);
                        navigate(n.link);
                      }}
                    >
                      Open
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Close
          </Button>
        </div>
      </Modal>
    </>
  );
}
