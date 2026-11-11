import type { ElementType, ReactNode } from 'react';

type Tone = 'default' | 'warm' | 'dark';

interface CardProps {
  as?: ElementType;
  tone?: Tone;
  className?: string;
  children: ReactNode;
}

/** Base surface for content. Product, event and location cards build on this. */
export function Card({ as: Tag = 'div', tone = 'default', className = '', children }: CardProps) {
  return <Tag className={`card card--${tone} ${className}`.trim()}>{children}</Tag>;
}
