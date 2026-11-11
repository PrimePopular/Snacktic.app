import { useId } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  hint?: string;
  error?: string | null;
  /** Optional control shown inside the right edge of the input, e.g. a show/hide button. */
  trailing?: ReactNode;
}

/** Labelled input with an optional hint and error message. Always use this instead of a bare <input>. */
export function TextField({ label, hint, error, trailing, ...inputProps }: TextFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="field__control">
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={trailing ? 'has-trailing' : undefined}
          {...inputProps}
        />
        {trailing}
      </div>
      {hint && (
        <p id={hintId} className="field__hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
