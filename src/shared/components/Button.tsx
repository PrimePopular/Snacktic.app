import type { MouseEventHandler, ReactNode } from 'react';
import { Link } from '../../core/router';

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost';
  children: ReactNode;
  className?: string;
  /** When set, renders a link styled as a button instead of a <button>. */
  to?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  type?: 'button' | 'submit';
}

export function Button({
  variant = 'primary',
  children,
  className = '',
  to,
  onClick,
  disabled,
  type = 'button',
}: ButtonProps) {
  const classes = `btn btn--${variant} ${className}`.trim();

  if (to !== undefined) {
    return (
      <Link to={to} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} className={classes} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}
