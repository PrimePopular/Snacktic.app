import type { ReactNode } from 'react';

interface PageHeaderProps {
  /** A bold coloured banner behind the title. Leave out for a plain header. */
  tone?: 'orange' | 'rose' | 'pistachio' | 'chocolate';
  title: string;
  description?: string;
  action?: ReactNode;
}

export function PageHeader({ tone, title, description, action }: PageHeaderProps) {
  return (
    <header className={`page-header ${tone ? `page-header--banner page-header--${tone}` : ''}`.trim()}>
      <div className="page-header__text">
        <h1>{title}</h1>
        {description && <p className="text-secondary">{description}</p>}
      </div>
      {action && <div className="page-header__action">{action}</div>}
    </header>
  );
}
