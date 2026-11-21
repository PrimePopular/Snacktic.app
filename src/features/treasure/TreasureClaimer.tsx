import { useEffect } from 'react';
import { navigate } from '../../core/router';
import { useAuth } from '../authentication';
import { pendingTreasure } from './treasureService';

/** Invisible. If someone scanned a treasure code before signing up, take them back to it once they are signed in. */
export function TreasureClaimer() {
  const { status } = useAuth();
  useEffect(() => {
    if (status !== 'signed-in') return;
    const token = pendingTreasure();
    if (token) navigate(`/t/${token}`);
  }, [status]);
  return null;
}
