import { useState } from 'react';
import type { EventCategory } from '../../features/events';
import { Button, TextField } from '../../shared/components';

interface CategoryPickerProps {
  label: string;
  categories: EventCategory[];
  /** The chosen category number as text, or '' for none. */
  value: string;
  onChange: (value: string) => void;
  /** Creates a new category and selects it. */
  onAdd: (name: string) => Promise<void>;
}

/**
 * Choose a category with big, named buttons, or add a new one on the spot. Each category has a
 * number that never changes; the feed uses it to learn what students like.
 */
export function CategoryPicker({ label, categories, value, onChange, onAdd }: CategoryPickerProps) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hidden categories are not offered, unless this item already uses one.
  const options = categories.filter((c) => c.active || String(c.id) === value);

  async function add() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      await onAdd(trimmed);
      setName('');
      setAdding(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add that category.');
    }
    setBusy(false);
  }

  return (
    <fieldset className="form-group">
      <legend>{label}</legend>
      {options.length === 0 && <p className="text-secondary text-small">No categories yet. Add the first one below.</p>}
      <div className="picker" role="group" aria-label={label}>
        <button type="button" aria-pressed={value === ''} onClick={() => onChange('')}>
          None
        </button>
        {options.map((c) => (
          <button key={c.id} type="button" aria-pressed={value === String(c.id)} onClick={() => onChange(String(c.id))}>
            <span className="category-number">{c.id}</span>
            {c.name}
          </button>
        ))}
        {!adding && (
          <button type="button" className="picker__add" onClick={() => setAdding(true)}>
            + New category
          </button>
        )}
      </div>
      {adding && (
        <div className="picker__new">
          <TextField label="New category name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} error={error} autoComplete="off" />
          <div className="ann__actions">
            <Button disabled={busy || !name.trim()} onClick={() => void add()}>
              {busy ? 'Adding…' : 'Add and choose it'}
            </Button>
            <Button variant="secondary" onClick={() => { setAdding(false); setError(null); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      <p className="field__hint">The number is used to show students more of what they like.</p>
    </fieldset>
  );
}
