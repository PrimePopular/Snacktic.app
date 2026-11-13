import { useEffect, useState } from 'react';
import { Button } from '../shared/components';
import { UPDATE_READY_EVENT } from './registration';
import './update-banner.css';

/** "A new version is ready." Shown after the app has quietly downloaded an update; one tap reloads into it. */
export function UpdateBanner() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const show = () => setReady(true);
    window.addEventListener(UPDATE_READY_EVENT, show);
    return () => window.removeEventListener(UPDATE_READY_EVENT, show);
  }, []);

  if (!ready) return null;
  return (
    <div className="update-banner" role="status">
      <span>A new version of Snacktic is ready.</span>
      <Button onClick={() => window.location.reload()}>Refresh</Button>
    </div>
  );
}
