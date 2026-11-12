/**
 * Find a Friend data access. The rules (each code scanned once, nobody scans their own code, no
 * scanning back, points per find) are enforced by database functions in
 * supabase/012_find_a_friend_and_notifications.sql. This file only asks the database to act.
 */
import { supabase } from '../../services/database';
import { notifyPointsChanged } from '../points';
import type { FindFriendOverview, FoundFriend, LeaderRow, LiveFindFriend, ScanResult, StartEventInput } from './findFriend.types';

function client() {
  if (!supabase) throw new Error('The database is not connected yet.');
  return supabase;
}

/** Messages written in the database functions that are safe and useful to show as they are. */
const SHOWABLE = [
  'Sign in to join',
  'Your account is suspended',
  'There is no Find a Friend event right now',
  'Tap Join first',
  'That code is not part of this event',
  'That is your own code',
  'That code has already been scanned',
  'That student already found you',
  'That student cannot be found right now',
  'Sign in to see the leaderboard',
  'That event is over',
  'Owner only',
  'Choose an end time in the future',
  'This event has already ended',
  'Prizes were already paid',
  'Event not found',
];

function failure(message: string): Error {
  console.error('[find-a-friend]', message);
  return new Error(SHOWABLE.some((text) => message.includes(text)) ? message : 'Something went wrong. Please try again.');
}

interface LiveRow {
  id: string;
  name: string;
  points_per_scan: number;
  ends_at: string;
  prize_first: number;
  prize_second: number;
  prize_third: number;
}

/** The live event, or null. The database only shows an event that is switched on and between its dates. */
export async function getLiveEvent(): Promise<LiveFindFriend | null> {
  const { data, error } = await client()
    .from('campaigns')
    .select('id, name, points_per_scan, ends_at, prize_first, prize_second, prize_third')
    .eq('kind', 'find_a_friend')
    .order('starts_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as LiveRow;
  return {
    id: row.id,
    name: row.name,
    pointsPerScan: row.points_per_scan,
    endsAt: row.ends_at,
    prizeFirst: row.prize_first,
    prizeSecond: row.prize_second,
    prizeThird: row.prize_third,
  };
}

/** This student's personal code for the event, or null if they have not joined yet. */
export async function getMyCode(eventId: string): Promise<string | null> {
  const { data, error } = await client().from('find_friend_players').select('code').eq('campaign_id', eventId).maybeSingle();
  if (error) throw failure(error.message);
  return data ? (data as { code: string }).code : null;
}

export async function joinEvent(): Promise<string> {
  const { data, error } = await client().rpc('join_find_a_friend');
  if (error) throw failure(error.message);
  return String(data);
}

export async function scanCode(code: string): Promise<ScanResult> {
  const { data, error } = await client().rpc('scan_friend_code', { p_code: code });
  if (error) throw failure(error.message);
  const row = ((data ?? []) as { awarded_points: number; found_nickname: string }[])[0];
  if (!row) throw failure('That code could not be read');
  if (row.awarded_points > 0) notifyPointsChanged();
  return { points: row.awarded_points, name: row.found_nickname };
}

export async function listMyFriends(): Promise<FoundFriend[]> {
  const { data, error } = await client().rpc('my_found_friends');
  if (error) throw failure(error.message);
  return ((data ?? []) as { friend_name: string; found_at: string }[]).map((r) => ({ name: r.friend_name, foundAt: r.found_at }));
}

export async function getLeaderboard(eventId: string): Promise<LeaderRow[]> {
  const { data, error } = await client().rpc('find_friend_leaderboard', { p_campaign: eventId });
  if (error) throw failure(error.message);
  return ((data ?? []) as { place: number | string; player_name: string; found_count: number | string }[]).map((r) => ({
    place: Number(r.place),
    name: r.player_name,
    found: Number(r.found_count),
  }));
}

// ---- Owner only -----------------------------------------------------------

interface OverviewRow {
  campaign_id: string;
  campaign_name: string;
  is_active: boolean;
  is_live: boolean;
  starts_at: string;
  ends_at: string;
  points_per_scan: number;
  prize_first: number;
  prize_second: number;
  prize_third: number;
  prizes_paid: boolean;
  players: number | string;
  scans: number | string;
}

export async function ownerOverview(): Promise<FindFriendOverview[]> {
  const { data, error } = await client().rpc('owner_find_friend_overview');
  if (error) throw failure(error.message);
  return ((data ?? []) as OverviewRow[]).map((r) => ({
    id: r.campaign_id,
    name: r.campaign_name,
    active: r.is_active,
    live: r.is_live,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    pointsPerScan: r.points_per_scan,
    prizeFirst: r.prize_first,
    prizeSecond: r.prize_second,
    prizeThird: r.prize_third,
    prizesPaid: r.prizes_paid,
    players: Number(r.players),
    scans: Number(r.scans),
  }));
}

export async function ownerStartEvent(input: StartEventInput): Promise<void> {
  const { error } = await client().rpc('owner_start_find_a_friend', {
    p_name: input.name,
    p_points: input.pointsPerScan,
    p_first: input.prizeFirst,
    p_second: input.prizeSecond,
    p_third: input.prizeThird,
    p_ends_at: input.endsAt,
  });
  if (error) throw failure(error.message);
}

export async function ownerSetActive(id: string, active: boolean): Promise<void> {
  const { error } = await client().rpc('owner_set_find_friend_active', { p_campaign: id, p_active: active });
  if (error) throw failure(error.message);
}

/** Pays first, second and third place once. Returns how many students were paid. */
export async function ownerPayPrizes(id: string): Promise<number> {
  const { data, error } = await client().rpc('owner_pay_find_friend_prizes', { p_campaign: id });
  if (error) throw failure(error.message);
  return Number(data ?? 0);
}
