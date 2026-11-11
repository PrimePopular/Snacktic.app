import type { InputHTMLAttributes, ReactNode } from 'react';

interface CheckboxFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'children'> {
  children: ReactNode;
}

export function CheckboxField({ children, ...inputProps }: CheckboxFieldProps) {
  return (
    <label className="checkbox">
      <input type="checkbox" {...inputProps} />
      <span>{children}</span>
    </label>
  );
}
