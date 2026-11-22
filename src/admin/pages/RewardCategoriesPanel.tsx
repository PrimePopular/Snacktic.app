import { useState } from 'react';
import { createRewardCategory, deleteRewardCategory } from '../../features/points';
import type { RewardCategory } from '../../features/points';
import { Button, Card, TextField } from '../../shared/components';

/** Make up store categories (Snacks, Drinks, Merch ...). Students can filter the Rewards Store by them. */
export function RewardCategoriesPanel({ categories, onChange }: { categories: RewardCategory[]; onChange: () => void }) {
  const [name, setName] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setNote(null);
    try {
      await action();
      onChange();
    } catch (e) {
      setNote(e instanceof Error ? `${e.message}` : 'Something went wrong.');
    }
    setBusy(false);
  }

  return (
    <details className="ann__item">
      <summary>
        <strong>Store categories</strong>
      </summary>
      <Card as="div" className="ann__item">
        <p className="text-secondary text-small">Add the groups you want, then choose one when you add or edit a reward. Deleting a category does not delete its rewards.</p>
        <TextField label="New category" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
        <Button
          disabled={busy || !name.trim()}
          onClick={() =>
            void run(async () => {
              await createRewardCategory(name);
              setName('');
            })
          }
        >
          Add category
        </Button>
        {note && (
          <p className="form-error" role="alert">
            {note} Has supabase/034 been run?
          </p>
        )}
        <ul className="activity-list">
          {categories.map((c) => (
            <li key={c.id} className="activity-row">
              <span>{c.name}</span>
              <Button variant="ghost" disabled={busy} onClick={() => void run(() => deleteRewardCategory(c.id))}>
                Delete
              </Button>
            </li>
          ))}
        </ul>
      </Card>
    </details>
  );
}
