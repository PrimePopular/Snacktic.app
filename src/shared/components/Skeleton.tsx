interface SkeletonCardsProps {
  count?: number;
  label?: string;
}

/**
 * Loading placeholders shaped like the cards that are about to appear. Calmer than a spinner:
 * the page keeps its shape and fills in. Screen readers hear one "Loading" message.
 */
export function SkeletonCards({ count = 3, label = 'Loading' }: SkeletonCardsProps) {
  return (
    <div className="skeleton-list" role="status" aria-live="polite" aria-busy="true">
      <span className="visually-hidden">{label}</span>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skeleton-card" aria-hidden="true">
          <div className="skeleton skeleton--media" />
          <div className="skeleton-card__body">
            <div className="skeleton skeleton--title" />
            <div className="skeleton skeleton--line" />
            <div className="skeleton skeleton--line skeleton--short" />
          </div>
        </div>
      ))}
    </div>
  );
}
