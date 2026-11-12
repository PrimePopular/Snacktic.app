import { Link } from '../../core/router';
import './ads.css';

export interface Nudge {
  to: string;
  title: string;
  text: string;
}

/** Small cards that send students to another section. Not ads, and they earn nothing. */
export const nudges: Nudge[] = [
  { to: '/rewards', title: 'Spend your Crumb Points', text: 'See what you can get in Rewards.' },
  { to: '/games', title: 'Got a minute?', text: 'Play a quick game and earn points.' },
  { to: '/discover', title: 'Find something new', text: 'Events, places and shops are waiting in Discover.' },
];

export function NudgeCard({ nudge }: { nudge: Nudge }) {
  return (
    <Link to={nudge.to} className="nudge-card">
      <strong>{nudge.title}</strong>
      <span>{nudge.text}</span>
    </Link>
  );
}
