import { useEffect, useRef, useState } from 'react';
import { playTap } from '../../services/sound';
import { isSaved, recordInterest, toggleSaved } from '../recommendations';
import type { SavedKind } from '../recommendations';
import { shareContent } from './share';

interface Options {
  kind: SavedKind;
  id: string;
  categoryId: number | null;
  title: string;
  shareText: string;
}

/**
 * The like (heart) and share actions for one card, shared by the card and its details sheet so they
 * always agree. Liking saves it on this device and strongly teaches the feed what this student likes.
 */
export function useCardActions({ kind, id, categoryId, title, shareText }: Options) {
  const [saved, setSaved] = useState(() => isSaved(kind, id));
  const [status, setStatus] = useState('');
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function flash(message: string) {
    setStatus(message);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setStatus(''), 2500);
  }

  function toggle() {
    playTap();
    const now = toggleSaved(kind, id);
    setSaved(now);
    if (now) recordInterest(categoryId, 4);
  }

  async function share() {
    const result = await shareContent(title, shareText);
    if (result === 'copied') flash('Link copied');
    if (result === 'failed') flash("Couldn't share");
  }

  return { saved, status, toggle, share };
}
