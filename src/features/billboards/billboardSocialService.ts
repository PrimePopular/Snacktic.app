import { supabase } from '../../services/database';

export interface Social {
  likes: number;
  comments: number;
  liked: boolean;
}

export interface BillboardComment {
  id: string;
  username: string;
  body: string;
  createdAt: string;
  mine: boolean;
}

const none: Social = { likes: 0, comments: 0, liked: false };

// Cards ask one at a time. Ask the database once for all the cards that appeared together.
const waiting = new Map<string, ((s: Social) => void)[]>();
let timer: number | null = null;

async function flush() {
  timer = null;
  const batch = [...waiting.entries()];
  waiting.clear();
  const ids = batch.map(([id]) => id);
  const result = new Map<string, Social>();
  if (supabase && ids.length > 0) {
    try {
      const { data } = await supabase.rpc('billboard_social', { p_posts: ids });
      for (const r of (data ?? []) as { post_id: string; likes: number | string; comments: number | string; liked: boolean }[]) {
        result.set(r.post_id, { likes: Number(r.likes), comments: Number(r.comments), liked: r.liked });
      }
    } catch {
      /* counts are optional: show zeros */
    }
  }
  for (const [id, callbacks] of batch) callbacks.forEach((cb) => cb(result.get(id) ?? none));
}

/** Like and comment counts for a post. If the database update (supabase/029) has not been run, this is just zeros. */
export function getSocial(postId: string): Promise<Social> {
  return new Promise((resolve) => {
    waiting.set(postId, [...(waiting.get(postId) ?? []), resolve]);
    if (timer === null) timer = window.setTimeout(() => void flush(), 30);
  });
}

function client() {
  if (!supabase) throw new Error('The database is not connected yet.');
  return supabase;
}

/** Friendly wording for the few errors a student can hit. */
function friendly(message: string): string {
  if (/sign in/i.test(message)) return 'Sign in to join in.';
  if (/too fast/i.test(message)) return 'You are commenting too fast. Wait a moment.';
  if (/suspended/i.test(message)) return 'Your account is suspended.';
  if (/not available/i.test(message)) return 'That post is not available any more.';
  if (/1 to 500/i.test(message)) return 'Write a comment of 1 to 500 characters.';
  return 'Something went wrong. Please try again.';
}

export async function toggleLike(postId: string): Promise<{ liked: boolean; likes: number }> {
  const { data, error } = await client().rpc('toggle_billboard_like', { p_post: postId });
  if (error) throw new Error(friendly(error.message));
  const row = (Array.isArray(data) ? data[0] : data) as { liked: boolean; likes: number | string };
  return { liked: row.liked, likes: Number(row.likes) };
}

export async function listComments(postId: string): Promise<BillboardComment[]> {
  const { data, error } = await client().rpc('billboard_comments_for', { p_post: postId, p_limit: 30 });
  if (error) return [];
  return ((data ?? []) as { id: string; username: string; body: string; created_at: string; mine: boolean }[]).map((r) => ({ id: r.id, username: r.username, body: r.body, createdAt: r.created_at, mine: r.mine }));
}

export async function addComment(postId: string, body: string): Promise<void> {
  const { error } = await client().rpc('add_billboard_comment', { p_post: postId, p_body: body });
  if (error) throw new Error(friendly(error.message));
}

export async function removeComment(commentId: string): Promise<void> {
  const { error } = await client().rpc('delete_billboard_comment', { p_comment: commentId });
  if (error) throw new Error(friendly(error.message));
}
