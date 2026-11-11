interface LoadingProps {
  label?: string;
}

/** A cookie that wobbles while crumbs fall. Calm by default; motion stops for people who prefer less. */
export function Loading({ label = 'Loading' }: LoadingProps) {
  return (
    <div className="loading" role="status" aria-live="polite">
      <div className="loading__stage" aria-hidden="true">
        <img className="loading__cookie" src="/images/logo-mark.png" width="72" height="64" alt="" />
        <span className="loading__crumb loading__crumb--1" />
        <span className="loading__crumb loading__crumb--2" />
        <span className="loading__crumb loading__crumb--3" />
      </div>
      <span className="loading__label">{label}…</span>
    </div>
  );
}
