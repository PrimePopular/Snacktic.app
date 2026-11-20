import { useEffect, useState } from 'react';
import { Link } from '../../core/router';
import { isAdminRole, useAuth } from '../authentication';
import { addComment, getSocial, listComments, removeComment, toggleLike } from './billboardSocialService';
import type { BillboardComment, Social } from './billboardSocialService';

const when = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

const Heart = ({ filled }: { filled: boolean }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.7 5 6 5c2 0 3.4 1.1 4.2 2.4h.1C11.1 6.1 12.5 5 14.5 5 17.8 5 19.6 8.4 18.1 11.8 16 16.4 12 21 12 21z" transform="translate(0 -1)" />
  </svg>
);

const Bubble = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12a8 8 0 0 1-11.6 7.1L3 20l1-4.6A8 8 0 1 1 21 12z" />
  </svg>
);

/** Like button, comment button, and the comments themselves for one Billboard post. Signing in is needed to like or comment. */
export function BillboardSocial({ postId }: { postId: string }) {
  const auth = useAuth();
  const signedIn = auth.status === 'signed-in';
  const staff = auth.profile ? isAdminRole(auth.profile.role) : false;
  const [social, setSocial] = useState<Social>({ likes: 0, comments: 0, liked: false });
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<BillboardComment[] | null>(null);
  const [text, setText] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void getSocial(postId).then((s) => active && setSocial(s));
    return () => {
      active = false;
    };
  }, [postId, signedIn]);

  async function like() {
    if (!signedIn) return setNote('Sign in to like posts.');
    setNote(null);
    const before = social;
    setSocial({ ...social, liked: !social.liked, likes: social.likes + (social.liked ? -1 : 1) });
    try {
      const r = await toggleLike(postId);
      setSocial((s) => ({ ...s, liked: r.liked, likes: r.likes }));
    } catch (e) {
      setSocial(before);
      setNote(e instanceof Error ? e.message : 'Something went wrong.');
    }
  }

  async function show() {
    const next = !open;
    setOpen(next);
    if (next && comments === null) setComments(await listComments(postId));
  }

  async function send() {
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    setNote(null);
    try {
      await addComment(postId, body);
      setText('');
      setComments(await listComments(postId));
      setSocial((s) => ({ ...s, comments: s.comments + 1 }));
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Something went wrong.');
    }
    setBusy(false);
  }

  async function remove(id: string) {
    try {
      await removeComment(id);
      setComments(await listComments(postId));
      setSocial((s) => ({ ...s, comments: Math.max(0, s.comments - 1) }));
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Something went wrong.');
    }
  }

  return (
    <div className="billboard__social">
      <div className="billboard__social-bar">
        <button type="button" className={`billboard__action${social.liked ? ' billboard__action--on' : ''}`} onClick={() => void like()} aria-pressed={social.liked} aria-label={social.liked ? 'Unlike' : 'Like'}>
          <Heart filled={social.liked} /> {social.likes}
        </button>
        <button type="button" className="billboard__action" onClick={() => void show()} aria-expanded={open}>
          <Bubble /> {social.comments}
        </button>
      </div>
      {note && (
        <p className="text-small" role="status">
          {note}
        </p>
      )}
      {open && (
        <div className="billboard__comments">
          {signedIn ? (
            <div className="billboard__comment-form">
              <input type="text" value={text} maxLength={500} placeholder="Write a comment" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void send()} aria-label="Write a comment" />
              <button type="button" className="btn btn--primary" disabled={busy || !text.trim()} onClick={() => void send()}>
                Post
              </button>
            </div>
          ) : (
            <p className="text-small">
              <Link to="/profile">Sign in</Link> to comment.
            </p>
          )}
          {comments === null ? (
            <p className="text-small text-secondary">Loading…</p>
          ) : comments.length === 0 ? (
            <p className="text-small text-secondary">No comments yet. Be the first.</p>
          ) : (
            <ul className="billboard__comment-list">
              {comments.map((c) => (
                <li key={c.id}>
                  <strong>{c.username}</strong> <span className="text-xs text-secondary">{when.format(new Date(c.createdAt))}</span>
                  <p>{c.body}</p>
                  {(c.mine || staff) && (
                    <button type="button" className="link-button" onClick={() => void remove(c.id)}>
                      Delete
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
