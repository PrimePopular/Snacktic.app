import { useSyncExternalStore } from 'react';
import { isDatabaseConfigured } from '../../services/database';
import { getLiveEvent } from './findFriendService';
import type { LiveFindFriend } from './findFriend.types';

/**
 * Whether a Find a Friend event is on right now, shared by everything that shows the "live" tag.
 * undefined = still checking, null = no event. Checked when the app opens, every five minutes, and
 * when the phone comes back online.
 */
let current: LiveFindFriend | null | undefined;
let started = false;
const listeners = new Set<() => void>();

async function refresh() {
  try {
    current = await getLiveEvent();
  } catch (error) {
    console.error('[find-a-friend] live check', error);
    if (current === undefined) current = null;
  }
  listeners.forEach((listener) => listener());
}

export function refreshLiveFindFriend(): void {
  void refresh();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!started && isDatabaseConfigured) {
    started = true;
    void refresh();
    window.setInterval(() => void refresh(), 5 * 60_000);
    window.addEventListener('online', () => void refresh());
  }
  return () => listeners.delete(listener);
}

export function useLiveFindFriend(): LiveFindFriend | null | undefined {
  return useSyncExternalStore(subscribe, () => current);
}
