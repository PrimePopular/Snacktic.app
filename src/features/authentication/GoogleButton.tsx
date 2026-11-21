import { useState } from 'react';
import { useAuth } from './AuthContext';
import './signup.css';

const GoogleG = () => (
  <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
    <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z" />
    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
  </svg>
);

/** "Continue with Google": signs up a new student or signs in an existing one, with no form to fill. */
export function GoogleButton({ label = 'Continue with Google' }: { label?: string }) {
  const auth = useAuth();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  if (auth.status === 'unconfigured') return null;
  return (
    <div className="google-wrap">
      <button
        type="button"
        className="google-btn"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setProblem(null);
          const result = await auth.signInWithGoogle();
          if (!result.ok) {
            setProblem(result.message);
            setBusy(false);
          }
        }}
      >
        <GoogleG /> {busy ? 'Opening Google…' : label}
      </button>
      {problem && (
        <p className="form-error" role="alert">
          {problem}
        </p>
      )}
    </div>
  );
}
