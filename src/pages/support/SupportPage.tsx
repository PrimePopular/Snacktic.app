import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../../features/authentication';
import { categoryLabels, getSupportContacts, submitFeedback } from '../../features/support';
import type { FeedbackCategory, SupportContacts } from '../../features/support';
import { uploadFeedbackShot } from '../../services/pictures';
import { Button, Card, PageHeader, TextAreaField, TextField } from '../../shared/components';
import './support.css';

const CATEGORIES: FeedbackCategory[] = ['bug', 'feature', 'update', 'other'];

/** Support and Feedback: report a bug, ask for a feature or an update, or contact the team. Works before signing up too. */
export default function SupportPage() {
  const { status } = useAuth();
  const signedIn = status === 'signed-in';
  const [contacts, setContacts] = useState<SupportContacts | null>(null);
  const [category, setCategory] = useState<FeedbackCategory>('bug');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [expected, setExpected] = useState('');
  const [actual, setActual] = useState('');
  const [contact, setContact] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    void getSupportContacts().then(setContacts);
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (title.trim().length < 3) return setError('Please add a short title.');
    if (description.trim().length < 5) return setError('Please tell us a little more.');
    setBusy(true);
    try {
      const screenshotPath = file ? await uploadFeedbackShot(file).catch(() => null) : null;
      await submitFeedback({ category, title, description, expected, actual, contact, screenshotPath });
      setSent(true);
      setTitle('');
      setDescription('');
      setExpected('');
      setActual('');
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
    setBusy(false);
  }

  return (
    <>
      <PageHeader title="Support & Feedback" description="Found a problem or have an idea? Tell us." />

      {contacts && (
        <Card className="support-contact-card">
          <h2>Contact Snacktic</h2>
          <div className="support-contact">
            <a className="btn btn--secondary" href={`mailto:${contacts.email}`}>
              Email us
            </a>
            <a className="btn btn--secondary" href={`https://wa.me/${contacts.whatsapp}`} target="_blank" rel="noopener noreferrer">
              WhatsApp us
            </a>
          </div>
        </Card>
      )}

      <Card>
        {sent ? (
          <div className="support-form">
            <h2>Thank you!</h2>
            <p className="text-secondary">We've received it and the team has been told. We read everything.</p>
            <Button onClick={() => setSent(false)}>Send another</Button>
          </div>
        ) : (
          <form className="support-form" onSubmit={(e) => void handleSubmit(e)} noValidate>
            <div className="support-tabs" role="tablist" aria-label="What is this about?">
              {CATEGORIES.map((c) => (
                <button key={c} type="button" role="tab" aria-selected={category === c} className={`support-tab ${category === c ? 'support-tab--on' : ''}`} onClick={() => setCategory(c)}>
                  {categoryLabels[c]}
                </button>
              ))}
            </div>
            <TextField label={category === 'bug' ? 'What went wrong?' : 'Title'} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} />
            <TextAreaField label={category === 'bug' ? 'Describe the problem' : 'Tell us more'} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={3000} />
            {category === 'bug' && (
              <>
                <TextAreaField label="What did you expect to happen? (optional)" value={expected} onChange={(e) => setExpected(e.target.value)} maxLength={1000} />
                <TextAreaField label="What happened instead? (optional)" value={actual} onChange={(e) => setActual(e.target.value)} maxLength={1000} />
              </>
            )}
            <div className="support-file">
              <label htmlFor="support-shot">Screenshot (optional)</label>
              <input id="support-shot" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
            {!signedIn && (
              <TextField label="Email or WhatsApp number, so we can reply (optional)" value={contact} onChange={(e) => setContact(e.target.value)} maxLength={120} autoComplete="off" />
            )}
            <p className="text-secondary text-small">We'll also send your phone and browser type to help us fix problems. No personal files are sent.</p>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" disabled={busy}>
              {busy ? 'Sending…' : 'Send'}
            </Button>
          </form>
        )}
      </Card>
    </>
  );
}
