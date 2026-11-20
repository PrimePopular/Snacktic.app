import type { ReactNode } from 'react';

/** Small line icons for Find a Friend, so the page uses real icons instead of emoji. They take their colour from the text. */
function Icon({ children, size = 20 }: { children: ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

export const GiftIcon = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <rect x="3" y="8" width="18" height="4" rx="1" />
    <path d="M12 8v13M5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8" />
    <path d="M12 8c-1.5-3-5-3.5-5-1.5S10 8 12 8zM12 8c1.5-3 5-3.5 5-1.5S14 8 12 8z" />
  </Icon>
);

export const ClockIcon = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Icon>
);

export const TrophyIcon = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <path d="M8 4h8v5a4 4 0 0 1-8 0V4z" />
    <path d="M8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4" />
    <path d="M12 13v4M8 21h8M10 17h4v4h-4z" />
  </Icon>
);

export const PassIcon = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <rect x="4" y="3" width="16" height="18" rx="3" />
    <path d="M8 8h3v3H8zM13 8h3v3h-3zM8 13h3v3H8zM14 14h2M14 16h2" />
  </Icon>
);

export const ScanIcon = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
    <path d="M4 12h16" />
  </Icon>
);

export const StarIcon = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z" />
  </Icon>
);
