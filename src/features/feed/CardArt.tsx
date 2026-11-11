import { Logo } from '../../shared/components';

/**
 * The default picture for cards that have no photo: playful doodles (stars, a ticket, a music note,
 * cookie crumbs) over the card's colour, with the Snacktic cookie in the middle.
 */
export function CardArt() {
  return (
    <span className="card-art" aria-hidden="true">
      <svg className="card-art__doodles" viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M44 38l4 10 10 4-10 4-4 10-4-10-10-4 10-4z" />
        <path d="M268 150l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" />
        <circle cx="286" cy="42" r="7" />
        <circle cx="30" cy="150" r="5" />
        <circle cx="96" cy="176" r="3" />
        <path d="M232 28v26a8 8 0 1 1-4-7V32l22-5v20" />
        <path d="M58 100c6-9 14-9 20 0s14 9 20 0" />
        <rect x="236" y="96" width="50" height="30" rx="6" transform="rotate(14 261 111)" />
        <path d="M252 104l4 9 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1z" transform="rotate(14 261 111) translate(2 -2) scale(.9)" />
        <path d="M150 20l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" />
      </svg>
      <Logo size={72} />
    </span>
  );
}
