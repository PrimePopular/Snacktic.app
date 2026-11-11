import { useSyncExternalStore } from 'react';
import { isServingSavedData, subscribeSavedData } from '../services/offlineCache';

/** Tells the student when what they see was saved earlier because there is no connection. */
export function OfflineNotice() {
  const saved = useSyncExternalStore(subscribeSavedData, isServingSavedData, () => false);
  if (!saved) return null;
  return (
    <p className="offline-notice" role="status">
      You're offline. Showing what was saved on your phone earlier. It may be out of date.
    </p>
  );
}
