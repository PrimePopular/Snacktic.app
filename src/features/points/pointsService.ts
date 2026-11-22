/**
 * Crumb Points data access. Owned by the Rewards developer.
 * IMPORTANT: this file never changes a balance itself. A balance is the sum of transactions, and
 * transactions are only created by trusted database functions (gift_points, redeem_reward, ...).
 * Everything here asks the database to do it, and the database checks the rules.
 */
import { supabase } from '../../services/database';
import { removePicture } from '../../services/pictures';
import type { AdminRedemption, DigitalPurchase, PointsTransaction, Redemption, RedemptionStatus, Reward, TransactionKind } from './points.types';

function client() {
  if (!supabase) throw new Error('The database is not connected yet.');
  return supabase;
}

/** Tells other parts of the app (the top bar) that the balance may have changed. */
export const POINTS_CHANGED_EVENT = 'snacktic:points-changed';
export function notifyPointsChanged(): void {
  window.dispatchEvent(new Event(POINTS_CHANGED_EVENT));
}

/** Messages written in the database functions that are safe and useful to show as they are. */
const SHOWABLE = [
  'cannot receive more gifts today',
  'can only receive',
  'cannot receive points right now',
  'Your account is suspended',
  'Add your WhatsApp number first',
  'Admins only',
  'No such account',
  'Not enough Crumb Points',
  'You cannot gift points to yourself',
  'No student with that username',
  'Gift at least 1 point',
  'That reward is not available',
  'That reward is sold out',
  'Delivery is not available to that place',
  'Only handed-over or cancelled orders can be removed',
  'This ebook is not ready yet',
  'This item is not ready yet',
  'That reward is an ebook',
  'That reward is digital',
  'This offer is for new members only',
  'That offer has ended',
  'That offer is not ready yet',
  'You have already claimed this offer',
  'Bonus offers are paused right now',
  'You have reached the limit for this reward',
  'Sign in to gift points',
  'Sign in to redeem rewards',
  'Owner only',
  'Amount cannot be zero',
  'Only pending redemptions can be changed',
  'Redemption not found',
];

function failure(message: string): Error {
  console.error('[points]', message);
  // These messages are written in the database functions in plain language, so show them whole
  // (for example "That student can only receive 20 more points today").
  const known = SHOWABLE.some((text) => message.includes(text));
  return new Error(known ? message : 'Something went wrong. Please try again.');
}

/* --------------------------------- Students -------------------------------- */

export async function getBalance(): Promise<number> {
  const { data, error } = await client().rpc('get_my_balance');
  if (error) throw failure(error.message);
  return Number(data ?? 0);
}

interface TransactionRow {
  id: string;
  amount: number;
  kind: TransactionKind;
  note: string;
  created_at: string;
}

export async function listHistory(limit = 30): Promise<PointsTransaction[]> {
  const { data, error } = await client()
    .from('points_transactions')
    .select('id, amount, kind, note, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw failure(error.message);
  return ((data ?? []) as TransactionRow[]).map((r) => ({
    id: r.id,
    amount: r.amount,
    kind: r.kind,
    note: r.note,
    createdAt: r.created_at,
  }));
}

interface RewardRow {
  id: string;
  name: string;
  description: string;
  cost_points: number;
  active: boolean;
  image_path: string | null;
  stock: number | null;
  kind: 'physical' | 'digital';
  is_bonus?: boolean;
  bonus_cost?: number | null;
  bonus_ends_at?: string | null;
  bonus_limit_per_user?: number;
  product_type?: Reward['productType'];
  discount_percent?: number | null;
  discount_starts_at?: string | null;
  discount_ends_at?: string | null;
  per_user_limit?: number | null;
  category_id?: string | null;
}

const BASE_COLUMNS = 'id, name, description, cost_points, active, image_path, stock, kind';
const BONUS_COLUMNS = `${BASE_COLUMNS}, is_bonus, bonus_cost, bonus_ends_at, bonus_limit_per_user`;
const FULL_COLUMNS = `${BONUS_COLUMNS}, product_type, discount_percent, discount_starts_at, discount_ends_at, per_user_limit, category_id`;

const rewardFromRow = (r: RewardRow): Reward => ({
  id: r.id,
  name: r.name,
  description: r.description,
  costPoints: r.cost_points,
  active: r.active,
  imagePath: r.image_path,
  stock: r.stock ?? null,
  kind: r.kind ?? 'physical',
  isBonus: r.is_bonus ?? false,
  bonusCost: r.bonus_cost ?? null,
  bonusEndsAt: r.bonus_ends_at ?? null,
  bonusLimitPerUser: r.bonus_limit_per_user ?? 1,
  // Digital rewards saved before product types existed count as e-books.
  productType: (r.kind === 'digital' && (!r.product_type || r.product_type === 'item') ? 'ebook' : r.product_type) ?? 'item',
  discountPercent: r.discount_percent ?? null,
  discountStartsAt: r.discount_starts_at ?? null,
  discountEndsAt: r.discount_ends_at ?? null,
  perUserLimit: r.per_user_limit ?? null,
  categoryId: r.category_id ?? null,
});

/**
 * Public: works without signing in. If the Bonus Rewards update (supabase/022) has not been run yet, the new columns do not
 * exist, so it quietly falls back to the plain list and the Rewards Store keeps working.
 */
export async function listRewards(): Promise<Reward[]> {
  const run = (columns: string) => client().from('rewards').select(columns).eq('active', true).order('cost_points', { ascending: true });
  let { data, error } = await run(FULL_COLUMNS);
  if (error) ({ data, error } = await run(BONUS_COLUMNS));
  if (error) ({ data, error } = await run(BASE_COLUMNS));
  if (error) throw failure(error.message);
  return ((data ?? []) as unknown as RewardRow[]).map(rewardFromRow);
}

export async function giftPoints(username: string, amount: number): Promise<void> {
  const { error } = await client().rpc('gift_points', { p_recipient: username.trim(), p_amount: amount });
  if (error) throw failure(error.message);
  notifyPointsChanged();
}

export async function redeemReward(rewardId: string, locationId: string): Promise<void> {
  const { error } = await client().rpc('redeem_reward', { p_reward: rewardId, p_location: locationId });
  if (error) throw failure(error.message);
  notifyPointsChanged();
}

interface RedemptionRow {
  id: string;
  points_cost: number;
  status: RedemptionStatus;
  created_at: string;
  reward_name: string | null;
  rewards: { name: string } | null;
}

export async function listMyRedemptions(): Promise<Redemption[]> {
  const { data, error } = await client()
    .from('redemptions')
    .select('id, points_cost, status, created_at, reward_name, rewards(name)')
    .order('created_at', { ascending: false });
  if (error) throw failure(error.message);
  return ((data ?? []) as unknown as RedemptionRow[]).map((r) => ({
    id: r.id,
    rewardName: r.rewards?.name ?? r.reward_name ?? 'Reward',
    pointsCost: r.points_cost,
    status: r.status,
    createdAt: r.created_at,
  }));
}

/* ---------------------------------- Owner ---------------------------------- */

export async function adminListRewards(): Promise<Reward[]> {
  const run = (columns: string) => client().from('rewards').select(columns).order('cost_points', { ascending: true });
  let { data, error } = await run(FULL_COLUMNS);
  if (error) ({ data, error } = await run(BONUS_COLUMNS));
  if (error) ({ data, error } = await run(BASE_COLUMNS));
  if (error) throw failure(error.message);
  return ((data ?? []) as unknown as RewardRow[]).map(rewardFromRow);
}

export async function adminSaveReward(
  id: string | null,
  input: {
    name: string;
    description: string;
    costPoints: number;
    active: boolean;
    imagePath: string | null;
    stock: number | null;
    /** Leave out to keep the current type. */
    kind?: 'physical' | 'digital';
    /** For an ebook: the link to the book. Leave out to keep the current link; an empty text removes it. */
    fileUrl?: string;
    /** Bonus Reward settings. Leave out to keep them as they are. */
    bonus?: { isBonus: boolean; bonusCost: number | null; bonusEndsAt: string | null; bonusLimitPerUser: number };
    /** Store settings. Leave out to keep them as they are. Only sent when given, so saving works before supabase/034 is run. */
    store?: { productType: Reward['productType']; discountPercent: number | null; discountStartsAt: string | null; discountEndsAt: string | null; perUserLimit: number | null; categoryId: string | null };
  },
): Promise<void> {
  const row = {
    name: input.name.trim(),
    description: input.description.trim(),
    cost_points: input.costPoints,
    active: input.active,
    image_path: input.imagePath,
    stock: input.stock,
    ...(input.kind ? { kind: input.kind } : {}),
    ...(input.store ? { product_type: input.store.productType, discount_percent: input.store.discountPercent, discount_starts_at: input.store.discountStartsAt, discount_ends_at: input.store.discountEndsAt, per_user_limit: input.store.perUserLimit, category_id: input.store.categoryId } : {}),
    ...(input.bonus ? { is_bonus: input.bonus.isBonus, bonus_cost: input.bonus.bonusCost, bonus_ends_at: input.bonus.bonusEndsAt, bonus_limit_per_user: input.bonus.bonusLimitPerUser } : {}),
  };
  let rewardId = id;
  if (id) {
    const { error } = await client().from('rewards').update(row).eq('id', id);
    if (error) throw failure(error.message);
  } else {
    const { data, error } = await client().from('rewards').insert(row).select('id').single();
    if (error) throw failure(error.message);
    rewardId = (data as { id: string }).id;
  }
  if (rewardId && input.fileUrl !== undefined) {
    const { error } = await client().rpc('owner_set_reward_file', { p_reward: rewardId, p_url: input.fileUrl });
    if (error) throw failure(error.message);
  }
}

/** The link of an ebook (owner only; students cannot read it before buying). */
export async function adminGetRewardFile(rewardId: string): Promise<string> {
  const { data, error } = await client().from('reward_files').select('url').eq('reward_id', rewardId).maybeSingle();
  if (error) throw failure(error.message);
  return data ? (data as { url: string }).url : '';
}

/** Buys an ebook with Crumb Points. Returns the link to open it. Buying the same book twice just shows it again. */
export async function buyDigitalReward(rewardId: string): Promise<{ title: string; url: string }> {
  const { data, error } = await client().rpc('buy_digital_reward', { p_reward: rewardId });
  if (error) throw failure(error.message);
  const row = ((data ?? []) as { book_title: string; book_url: string }[])[0];
  if (!row) throw failure('Something went wrong');
  notifyPointsChanged();
  return { title: row.book_title, url: row.book_url };
}

export async function listMyDigitalPurchases(): Promise<DigitalPurchase[]> {
  const { data, error } = await client().from('digital_purchases').select('reward_id, title, url, created_at').order('created_at', { ascending: false });
  if (error) throw failure(error.message);
  return ((data ?? []) as { reward_id: string | null; title: string; url: string; created_at: string }[]).map((r) => ({ rewardId: r.reward_id, title: r.title, url: r.url, createdAt: r.created_at }));
}

interface AdminRedemptionRow {
  id: string;
  username: string;
  reward_name: string;
  points_cost: number;
  status: RedemptionStatus;
  created_at: string;
  phone: string | null;
  email: string | null;
  delivery_place: string | null;
}

export async function adminListRedemptions(): Promise<AdminRedemption[]> {
  const { data, error } = await client().rpc('admin_list_redemptions');
  if (error) throw failure(error.message);
  return ((data ?? []) as AdminRedemptionRow[]).map((r) => ({
    id: r.id,
    username: r.username,
    rewardName: r.reward_name,
    pointsCost: r.points_cost,
    status: r.status,
    createdAt: r.created_at,
    phone: r.phone ?? '',
    email: r.email ?? '',
    deliveryPlace: r.delivery_place ?? '',
  }));
}

/** Owner only: removes a handed-over or cancelled order right away. */
export async function adminDeleteRedemption(id: string): Promise<void> {
  const { error } = await client().rpc('owner_delete_redemption', { p_id: id });
  if (error) throw failure(error.message);
}

export async function adminSetRedemptionStatus(id: string, status: 'fulfilled' | 'cancelled'): Promise<void> {
  const { error } = await client().rpc('admin_set_redemption_status', { p_id: id, p_status: status });
  if (error) throw failure(error.message);
}

export async function adminAdjustPoints(username: string, amount: number, note: string): Promise<void> {
  const { error } = await client().rpc('admin_adjust_points', {
    p_username: username.trim(),
    p_amount: amount,
    p_note: note,
  });
  if (error) throw failure(error.message);
  notifyPointsChanged();
}

/* ------------------------------ Gift limits ------------------------------ */

export interface GiftLimits {
  /** Most gifts one student can receive per day. */
  maxCount: number;
  /** Most points one student can receive as gifts per day. */
  maxPoints: number;
}

async function readSetting(key: string, fallback: number): Promise<number> {
  const { data, error } = await client().from('app_settings').select('key, value').eq('key', key).maybeSingle();
  if (error) throw failure(error.message);
  const value = Number((data as { value: string } | null)?.value);
  return Number.isFinite(value) ? value : fallback;
}

export async function getGiftLimits(): Promise<GiftLimits> {
  const [maxCount, maxPoints] = await Promise.all([
    readSetting('gift_max_received_per_day', 3),
    readSetting('gift_max_points_per_day', 50),
  ]);
  return { maxCount, maxPoints };
}

export async function adminSaveGiftLimits(limits: GiftLimits): Promise<void> {
  const one = (key: string, value: number) => client().from('app_settings').update({ value: String(value) }).eq('key', key);
  const [a, b] = await Promise.all([one('gift_max_received_per_day', limits.maxCount), one('gift_max_points_per_day', limits.maxPoints)]);
  if (a.error) throw failure(a.error.message);
  if (b.error) throw failure(b.error.message);
}

/**
 * Deletes a reward. If past orders still point at it the database refuses, so say so plainly: the owner can hide it
 * instead, and it can be deleted once those orders have been cleaned up (Admin, Storage cleanup).
 */
export async function adminDeleteReward(reward: Reward): Promise<void> {
  const { error } = await client().from('rewards').delete().eq('id', reward.id);
  if (error) {
    if (error.code === '23503') {
      throw new Error('This reward still has orders attached. Hide it for now. It can be deleted after those orders are cleaned up.');
    }
    throw new Error(error.message);
  }
  if (reward.imagePath) await removePicture(reward.imagePath).catch(() => undefined);
}
