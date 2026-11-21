import type { ReactNode } from 'react';
import { InstallCard } from '../../pwa/install';

export interface Slide {
  id: string;
  title: string;
  text: string;
  art: ReactNode;
  /** Extra content under the text, for example the install button. */
  extra?: ReactNode;
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
    text: 'Your campus in one app. Discover what is on, play games, and earn Crumb Points you can swap for real rewards.',
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
    id: 'points',
    title: 'How Crumb Points work',
    text: 'Earn them by playing games, joining events, finding friends, hunting treasure and logging in every day. Spend them in the Rewards Store.',
    art: frame(
      <g>
        <circle cx="100" cy="72" r="38" fill="#f2b705" stroke="#35231f" strokeWidth="4" />
        <circle cx="100" cy="72" r="26" fill="none" stroke="#35231f" strokeWidth="3" strokeDasharray="3 5" />
        <path d="M100 56v32M90 66c0-8 20-8 20 0s-20 8-20 16 20 8 20 0" fill="none" stroke="#35231f" strokeWidth="4" strokeLinecap="round" />
      </g>,
      '#fff0c2',
    ),
  },
  {
    id: 'discover',
    title: 'Discover',
    text: 'Events, places to visit, shops, announcements and news around campus, all in one place.',
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
    text: 'Play quick games and the Daily Challenge to earn points. If you lose a Daily Challenge, retry with points or by watching an ad.',
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
    id: 'events',
    title: 'Events you can join',
    text: 'Take part in Find a Friend, Treasure Hunt and more. Scan QR codes, invite friends and win Crumb Points.',
    art: frame(
      <g>
        <rect x="58" y="34" width="84" height="84" rx="10" fill="#fff8ef" stroke="#35231f" strokeWidth="4" />
        <path d="M70 46h22v22H70zM108 46h22v22h-22zM70 84h22v22H70z" fill="none" stroke="#35231f" strokeWidth="4" />
        <path d="M108 84h8v8h-8zM122 98h8v8h-8zM108 102h6" fill="#35231f" stroke="#35231f" strokeWidth="3" />
        <path d="M150 104l10 10M160 104l-10 10" stroke="#e96b73" strokeWidth="5" strokeLinecap="round" />
      </g>,
      '#ffd9dc',
    ),
  },
  {
    id: 'billboards',
    title: 'Billboards',
    text: 'A feed of music, creators, stories and things worth a look. Like and comment on what you enjoy.',
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
  {
    id: 'rewards',
    title: 'Rewards',
    text: 'Browse the Rewards Store and spend your points on snacks, gifts and digital items. New members get special offers.',
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
    id: 'feedback',
    title: 'Tell us what you think',
    text: 'Found a bug or have an idea? Open Profile, then Support & Feedback, and tell us. We read everything.',
    art: frame(
      <g>
        <path d="M54 40h92a8 8 0 0 1 8 8v44a8 8 0 0 1-8 8h-48l-22 18v-18H54a8 8 0 0 1-8-8V48a8 8 0 0 1 8-8z" fill="#fff8ef" stroke="#35231f" strokeWidth="4" strokeLinejoin="round" />
        <path d="M66 58h68M66 72h44" stroke="#e96b73" strokeWidth="6" strokeLinecap="round" />
      </g>,
      '#ffe0c2',
    ),
  },
  {
    id: 'install',
    title: 'Add Snacktic to your home screen',
    text: 'Open it like any other app, with one tap, and it loads fast even on a weak connection.',
    art: frame(
      <g>
        <rect x="76" y="26" width="48" height="88" rx="10" fill="#fff8ef" stroke="#35231f" strokeWidth="4" />
        <circle cx="100" cy="102" r="4" fill="#35231f" />
        <path d="M100 44v32M88 66l12 12 12-12" fill="none" stroke="#e96b73" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      </g>,
      '#e4eed0',
    ),
    extra: <InstallCard />,
  },
];
