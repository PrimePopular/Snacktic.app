import { useId, useState } from 'react';
import { Button, Modal } from '../../shared/components';
import { playTap } from '../../services/sound';
import { QrCode } from '../find-a-friend';
import { getShareLink } from './shareLinkService';
import './share.css';

/**
 * A Share button for everyone, signed in or not. It shows a QR code that opens Snacktic, so the
 * next person can scan it with their camera instead of typing the address. The link is the one the
 * owner set in the admin, or this app's own address if none was set.
 */
export function ShareButton() {
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState('');
  const [status, setStatus] = useState('');
  const titleId = useId();

  async function openSheet() {
    playTap();
    setStatus('');
    setOpen(true);
    const configured = await getShareLink();
    setLink(configured || window.location.origin);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setStatus('Link copied.');
    } catch {
      setStatus('Could not copy. Press and hold the link to copy it.');
    }
  }

  async function share() {
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: 'Snacktic', text: 'Good snacks, good moments. Join me on Snacktic!', url: link });
      } else {
        await copy();
      }
    } catch (error) {
      // Closing the share sheet counts as cancelling, not as an error.
      if (!(error instanceof DOMException && error.name === 'AbortError')) setStatus('Could not share. Try copying the link instead.');
    }
  }

  return (
    <>
      <button type="button" className="share-button" onClick={() => void openSheet()} aria-label="Share Snacktic">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="18" cy="5" r="2.6" />
          <circle cx="6" cy="12" r="2.6" />
          <circle cx="18" cy="19" r="2.6" />
          <path d="m8.3 10.7 7.4-4.4M8.3 13.3l7.4 4.4" />
        </svg>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy={titleId}>
        <div className="share-sheet">
          <h2 id={titleId}>Share Snacktic</h2>
          <p className="text-secondary">Let a friend scan this with their phone camera and it opens Snacktic.</p>
          {link ? <QrCode value={link} label="QR code that opens Snacktic" /> : <div className="qr-code qr-code--loading" aria-busy="true" />}
          {link && <p className="share-sheet__link">{link}</p>}
          <div className="share-sheet__actions">
            <Button onClick={() => void share()} disabled={!link}>
              Share link
            </Button>
            <Button variant="secondary" onClick={() => void copy()} disabled={!link}>
              Copy link
            </Button>
          </div>
          {status && <p className="text-small" role="status">{status}</p>}
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Close
          </Button>
        </div>
      </Modal>
    </>
  );
}
