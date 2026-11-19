import type { ReactNode } from 'react';

export interface Slide {
  id: string;
  title: string;
  text: string;
  art: ReactNode;
}

/** Simple friendly pictures drawn in code, so the guide needs no image files and loads instantly. */
const frame = (children: ReactNode, bg: string) => (
  <svg viewBox="0 0 200 140" role="img" aria-hidden="true" className="tour__art">
    <rect width="200" height="140" rx="22" fill={bg} />
    <circle cx="168" cy="26" r="18" fill="#fff" opacity="0.35" />
    <circle cx="26" cy="118" r="24" fill="#fff" opacity="0.25" />
    {children}
  </svg>
);

export const slides: Slide[] = [
  {
    id: 'welcome',
    title: 'Welcome to Snacktic',
    text: 'Your campus, one app. Find what is on, play games, collect Crumb Points and swap them for rewards.',
    art: frame(
      <g>
        <circle cx="100" cy="72" r="40" fill="#e0a45a" stroke="#35231f" strokeWidth="4" />
        <circle cx="86" cy="60" r="5" fill="#35231f" />
        <circle cx="112" cy="66" r="5" fill="#35231f" />
        <circle cx="96" cy="88" r="5" fill="#35231f" />
        <circle cx="116" cy="90" r="4" fill="#35231f" />
        <circle cx="78" cy="80" r="4" fill="#35231f" />
      </g>,
      '#ffd9b0',
    ),
  },
  {
    id: 'discover',
    title: 'Discover',
    text: 'Find interesting places, events and campus news. Tap Discover to see what is happening near you.',
    art: frame(
      <g>
        <path d="M100 28c-18 0-32 14-32 32 0 24 32 56 32 56s32-32 32-56c0-18-14-32-32-32z" fill="#e96b73" stroke="#35231f" strokeWidth="4" />
        <circle cx="100" cy="60" r="12" fill="#fff" stroke="#35231f" strokeWidth="4" />
        <circle cx="146" cy="96" r="14" fill="none" stroke="#35231f" strokeWidth="5" />
        <path d="M156 106l16 16" stroke="#35231f" strokeWidth="6" strokeLinecap="round" />
      </g>,
      '#ffc9cd',
    ),
  },
  {
    id: 'games',
    title: 'Games',
    text: 'Play quick games and earn Crumb Points every time you do well.',
    art: frame(
      <g>
        <rect x="52" y="52" width="96" height="52" rx="26" fill="#b8c99a" stroke="#35231f" strokeWidth="4" />
        <path d="M78 66v24M66 78h24" stroke="#35231f" strokeWidth="6" strokeLinecap="round" />
        <circle cx="120" cy="72" r="6" fill="#e96b73" stroke="#35231f" strokeWidth="3" />
        <circle cx="134" cy="86" r="6" fill="#ff8a3d" stroke="#35231f" strokeWidth="3" />
      </g>,
      '#e4eed0',
    ),
  },
  {
    id: 'rewards',
    title: 'Rewards',
    text: 'Browse the Rewards Store and spend your points on things you actually want. New members get special offers.',
    art: frame(
      <g>
        <rect x="62" y="64" width="76" height="52" rx="8" fill="#ff8a3d" stroke="#35231f" strokeWidth="4" />
        <rect x="56" y="50" width="88" height="20" rx="8" fill="#ffb273" stroke="#35231f" strokeWidth="4" />
        <path d="M100 50v66" stroke="#35231f" strokeWidth="4" />
        <path d="M100 50c-14-20-34-8-22 0M100 50c14-20 34-8 22 0" fill="none" stroke="#35231f" strokeWidth="4" strokeLinecap="round" />
      </g>,
      '#ffe0c2',
    ),
  },
  {
    id: 'friends',
    title: 'Find a Friend',
    text: 'Invite friends with your personal pass. When they join, you both get points.',
    art: frame(
      <g>
        <circle cx="70" cy="58" r="14" fill="#ffb273" stroke="#35231f" strokeWidth="4" />
        <path d="M46 108c0-18 10-28 24-28s24 10 24 28" fill="#e96b73" stroke="#35231f" strokeWidth="4" />
        <circle cx="132" cy="58" r="14" fill="#ffb273" stroke="#35231f" strokeWidth="4" />
        <path d="M108 108c0-18 10-28 24-28s24 10 24 28" fill="#b8c99a" stroke="#35231f" strokeWidth="4" />
        <path d="M86 70h30" stroke="#35231f" strokeWidth="4" strokeDasharray="2 7" strokeLinecap="round" />
      </g>,
      '#ffd9dc',
    ),
  },
  {
    id: 'shops',
    title: 'Shops',
    text: 'Explore participating businesses and their products around campus.',
    art: frame(
      <g>
        <rect x="56" y="62" width="88" height="54" rx="6" fill="#fff8ef" stroke="#35231f" strokeWidth="4" />
        <path d="M52 62l8-24h80l8 24z" fill="#e96b73" stroke="#35231f" strokeWidth="4" strokeLinejoin="round" />
        <rect x="88" y="84" width="24" height="32" fill="#ff8a3d" stroke="#35231f" strokeWidth="4" />
      </g>,
      '#fde8c8',
    ),
  },
  {
    id: 'billboards',
    title: 'Billboards',
    text: 'Spot interesting posts, creators, entertainment and more from around the community.',
    art: frame(
      <g>
        <rect x="46" y="34" width="108" height="56" rx="8" fill="#fff8ef" stroke="#35231f" strokeWidth="4" />
        <path d="M60 52h50M60 66h34" stroke="#e96b73" strokeWidth="6" strokeLinecap="round" />
        <circle cx="132" cy="62" r="12" fill="#ff8a3d" stroke="#35231f" strokeWidth="4" />
        <path d="M84 90v28M116 90v28" stroke="#35231f" strokeWidth="6" strokeLinecap="round" />
      </g>,
      '#ffe9b8',
    ),
  },
];
