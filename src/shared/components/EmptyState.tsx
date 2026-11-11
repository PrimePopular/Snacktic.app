import type { ReactNode } from 'react';
import { Logo } from './Logo';

interface EmptyStateProps {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}

/** Use whenever a list has nothing to show yet. Always say what the person can do next. */
export function EmptyState({ title, children, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <Logo size={56} />
      <h2>{title}</h2>
      {children && <p className="text-secondary">{children}</p>}
      {action}
    </div>
  );
}
