import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { createCategory, listCategories, updateCategory } from '../../features/events';
import type { CategoryKind, EventCategory } from '../../features/events';
import { Button, EmptyState, Loading, SelectField, TextField } from '../../shared/components';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; events: EventCategory[]; places: EventCategory[] };

/** Event categories. Each has a number that never changes, used later to learn what students like. */
export function CategoriesPage() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [newName, setNewName] = useState('');
  const [newKind, setNewKind] = useState<CategoryKind>('event');
  const [renaming, setRenaming] = useState<{ id: number; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const [events, places] = await Promise.all([listCategories('event'), listCategories('place')]);
      setState({ kind: 'ready', events, places });
    } catch (error) {
      console.error('[admin] categories', error);
      setState({ kind: 'error', message: error instanceof Error ? error.message : 'Something went wrong.' });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: () => Promise<void>, success: string) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      await load();
      setMessage({ kind: 'ok', text: success });
    } catch (error) {
      console.error('[admin] categories', error);
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Something went wrong.' });
    }
    setBusy(false);
  }

  function handleAdd(event: FormEvent) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    void run(async () => {
      await createCategory(name, newKind);
      setNewName('');
    }, `Added "${name}".`);
  }

  function renderList(items: EventCategory[]) {
    if (items.length === 0) return <p className="text-secondary">None yet.</p>;
    return (
      <ul className="team__list">
        {items.map((cat) => (
          <li key={cat.id} className="team__member">
            {renaming?.id === cat.id ? (
              <form
                className="rename"
                onSubmit={(e) => {
                  e.preventDefault();
                  const name = renaming.name.trim();
                  if (name) void run(async () => { await updateCategory(cat.id, { name }); setRenaming(null); }, 'Renamed.');
                }}
              >
                <TextField label={`Rename category ${cat.id}`} value={renaming.name} onChange={(e) => setRenaming({ id: cat.id, name: e.target.value })} maxLength={40} />
                <div className="ann__actions">
                  <Button type="submit" disabled={busy}>Save</Button>
                  <Button variant="secondary" onClick={() => setRenaming(null)}>Cancel</Button>
                </div>
              </form>
            ) : (
              <>
                <div>
                  <p className="team__name">
                    <span className="category-number">{cat.id}</span> {cat.name}
                  </p>
                  {!cat.active && <p className="text-secondary text-small">Hidden. Not offered for new items.</p>}
                </div>
                <div className="ann__actions">
                  <Button variant="secondary" disabled={busy} onClick={() => setRenaming({ id: cat.id, name: cat.name })}>
                    Rename
                  </Button>
                  <Button variant="secondary" disabled={busy} onClick={() => void run(() => updateCategory(cat.id, { active: !cat.active }), cat.active ? 'Hidden.' : 'Active again.')}>
                    {cat.active ? 'Hide' : 'Show'}
                  </Button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section aria-labelledby="cat-heading" className="team">
      <div>
        <h1 id="cat-heading">Categories</h1>
        <p className="text-secondary">
          Every category has a number. The number never changes, even if you rename or hide the category.
        </p>
      </div>

      <form className="team__add" onSubmit={handleAdd} noValidate>
        <TextField label="New category" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={40} />
        <SelectField label="For" value={newKind} onChange={(e) => setNewKind(e.target.value as CategoryKind)}>
          <option value="event">Events</option>
          <option value="place">Places</option>
        </SelectField>
        <Button type="submit" disabled={busy || !newName.trim()}>
          Add category
        </Button>
      </form>

      {message && (
        <p className={message.kind === 'ok' ? 'form-notice' : 'form-error'} role={message.kind === 'ok' ? 'status' : 'alert'}>
          {message.text}
        </p>
      )}

      {state.kind === 'loading' && <Loading label="Loading categories" />}
      {state.kind === 'error' && (
        <EmptyState title="We couldn't load categories" action={<Button onClick={() => void load()}>Try again</Button>}>
          {state.message}
        </EmptyState>
      )}
      {state.kind === 'ready' && (
        <>
          <h2>Event categories</h2>
          {renderList(state.events)}
          <h2>Place categories</h2>
          {renderList(state.places)}
        </>
      )}
    </section>
  );
}
