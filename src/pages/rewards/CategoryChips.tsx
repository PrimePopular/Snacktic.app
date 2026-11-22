import type { Reward, RewardCategory } from '../../features/points';

/** Filter chips for the store: All, then each category that has at least one reward. Hidden when there are no categories. */
export function CategoryChips({ categories, rewards, selected, onSelect }: { categories: RewardCategory[]; rewards: Reward[]; selected: string | null; onSelect: (id: string | null) => void }) {
  const used = categories.filter((c) => rewards.some((r) => r.categoryId === c.id));
  if (used.length === 0) return null;
  return (
    <div className="category-chips" role="group" aria-label="Filter by category">
      <button type="button" className={`category-chip${selected === null ? ' category-chip--on' : ''}`} onClick={() => onSelect(null)}>
        All
      </button>
      {used.map((c) => (
        <button key={c.id} type="button" className={`category-chip${selected === c.id ? ' category-chip--on' : ''}`} onClick={() => onSelect(c.id)}>
          {c.name}
        </button>
      ))}
    </div>
  );
}
