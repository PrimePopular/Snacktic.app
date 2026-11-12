import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { makeQrDataUrl } from '../../features/find-a-friend';
import { getShareLink, saveShareLink } from '../../features/share';
import { Button, Loading, TextField } from '../../shared/components';
import { safeLink } from '../../shared/url';

/**
 * Share link, owner only. Paste the address people should be sent to (your live website). It becomes
 * the QR code behind the Share button, which anyone can use without signing in.
 */
export function ShareLinkPage() {
  const [loaded, setLoaded] = useState(false);
  const [link, setLink] = useState('');
  const [saved, setSaved] = useState('');
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getShareLink().then((value) => {
      setLink(value);
      setSaved(value);
      setLoaded(true);
    });
  }, []);

  const preview = safeLink(link) ?? window.location.origin;

  useEffect(() => {
    let active = true;
    void makeQrDataUrl(preview, 768)
      .then((url) => active && setQr(url))
      .catch((err: unknown) => console.error('[admin] share qr', err));
    return () => {
      active = false;
    };
  }, [preview]);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (link.trim() && !safeLink(link)) return setError('Enter a full link that starts with https://');
    setBusy(true);
    try {
      await saveShareLink(link);
      setSaved(link.trim());
      setMessage(link.trim() ? 'Saved. The Share button now shows this code.' : 'Cleared. The Share button now uses the app\'s own address.');
    } catch (err) {
      console.error('[admin] share link', err);
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
    setBusy(false);
  }

  if (!loaded) return <Loading label="Loading" />;

  return (
    <section aria-labelledby="share-heading" className="ann">
      <h1 id="share-heading">Share link</h1>
      <p className="text-secondary">
        Type or paste the address of your live website. Anyone can tap Share at the top of the app, even before signing up, and scan the code to open it.
        Leave it empty to use the address the app is running on.
      </p>
      <form className="ann__form" onSubmit={(e) => void handleSave(e)} noValidate>
        <TextField label="Link" type="url" inputMode="url" value={link} onChange={(e) => setLink(e.target.value)} hint="For example https://snacktic.pages.dev" autoCapitalize="none" />
        {error && <p className="form-error" role="alert">{error}</p>}
        {message && <p className="form-notice" role="status">{message}</p>}
        <div className="ann__actions">
          <Button type="submit" disabled={busy || link.trim() === saved}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>
      <h2>Preview</h2>
      <p className="text-secondary text-small">{preview}</p>
      {qr && <img className="qr-code" src={qr} alt="QR code preview" width={256} height={256} />}
      {qr && (
        <p>
          <a className="btn btn--secondary" href={qr} download="snacktic-qr.png">
            Download the QR code to print
          </a>
        </p>
      )}
    </section>
  );
}
