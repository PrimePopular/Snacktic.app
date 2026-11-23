import { useEffect, useState } from 'react';
import { CROSS_KINDS, CROSS_SECTIONS, getCrossMatrix, kindNames, saveCrossMatrix, sectionNames } from '../../features/cross';
import type { CrossKind, CrossMatrix, CrossSection } from '../../features/cross';
import { Button, Card, CheckboxField, Loading } from '../../shared/components';

/**
 * Where content shows up. For each section, tick which kinds of content may drop in. Every card keeps its own label
 * (REWARD, PLACES TO VISIT, BILLBOARD, GAME), so nothing is mistaken for something else. A section never shows its own kind.
 */
export function CrossMixPage() {
  const [matrix, setMatrix] = useState<CrossMatrix | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getCrossMatrix(true).then(setMatrix);
  }, []);

  if (!matrix) return <Loading label="Loading" />;

  const own: Record<CrossSection, CrossKind | null> = { home: null, discover: null, billboards: 'billboard', games: 'game', rewards: 'reward' };

  function toggle(section: CrossSection, kind: CrossKind, on: boolean) {
    if (!matrix) return;
    const list = matrix[section].filter((k) => k !== kind);
    setMatrix({ ...matrix, [section]: on ? [...list, kind] : list });
  }

  async function save() {
    if (!matrix) return;
    setBusy(true);
    setNote(null);
    try {
      await saveCrossMatrix(matrix);
      setNote({ ok: true, text: 'Saved. Students see the new mix within a minute.' });
    } catch (e) {
      setNote({ ok: false, text: e instanceof Error ? e.message : 'Something went wrong.' });
    }
    setBusy(false);
  }

  return (
    <section aria-labelledby="cm-heading" className="ann">
      <h1 id="cm-heading">Where content appears</h1>
      <p className="text-secondary">Choose which kinds of content may drop into each section, so no screen feels thin. Events and special offers for new members are handled separately.</p>
      {CROSS_SECTIONS.map((section) => (
        <Card as="div" key={section} className="ann__item">
          <h2>{sectionNames[section]}</h2>
          {CROSS_KINDS.filter((k) => k !== own[section]).map((kind) => (
            <CheckboxField key={kind} checked={matrix[section].includes(kind)} onChange={(e) => toggle(section, kind, e.target.checked)}>
              {kindNames[kind]}
            </CheckboxField>
          ))}
        </Card>
      ))}
      {note && (
        <p className={note.ok ? 'form-notice' : 'form-error'} role={note.ok ? 'status' : 'alert'}>
          {note.text}
        </p>
      )}
      <Button disabled={busy} onClick={() => void save()}>
        {busy ? 'Saving…' : 'Save'}
      </Button>
    </section>
  );
}
