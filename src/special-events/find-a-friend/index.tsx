import { Card } from '../../shared/components';
import type { SpecialEventProps } from '../../games/game.types';

/**
 * Find a Friend: placeholder. Owned by the Rewards developer because it feeds the central
 * points system. Rules are in docs/DECISIONS.md (one reward per finder-and-found pair, points
 * must be gifted within 7 days, finder cannot keep them).
 */
export default function FindAFriend(_props: SpecialEventProps) {
  return (
    <Card tone="warm">
      <h2>Find a Friend is almost ready</h2>
      <p>Soon you'll be able to find other students here and earn Crumb Points to gift to a friend.</p>
    </Card>
  );
}
