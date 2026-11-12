import { Link, useRoutePath } from '../../core/router';
import { useLiveFindFriend } from './useLiveFindFriend';
import './find-a-friend.css';

/** A slim tag shown on every screen while Find a Friend is live. It disappears on its own when the event ends. */
export function FindFriendTag() {
  const live = useLiveFindFriend();
  const path = useRoutePath();
  if (!live || path === '/find-a-friend') return null;
  return (
    <Link to="/find-a-friend" className="ff-tag">
      <span className="ff-tag__dot" aria-hidden="true" />
      <strong>{live.name} is live!</strong>
      <span>Tap to play and earn points</span>
    </Link>
  );
}
