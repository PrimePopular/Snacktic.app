import { EmptyState } from './EmptyState';
import { PageHeader } from './PageHeader';

interface PlaceholderPageProps {
  title: string;
  description: string;
  emptyTitle: string;
  emptyBody: string;
  /** Developer-facing scaffolding note, e.g. "Phase 2 · Developer 2 (Home)". Delete with the placeholder. */
  scaffoldNote: string;
}

/** Phase 1 stand-in for a section that has not been built yet. Replace it, don't extend it. */
export function PlaceholderPage({
  title,
  description,
  emptyTitle,
  emptyBody,
  scaffoldNote,
}: PlaceholderPageProps) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <EmptyState title={emptyTitle}>{emptyBody}</EmptyState>
      <p className="scaffold-note text-xs text-secondary">{scaffoldNote}</p>
    </>
  );
}
