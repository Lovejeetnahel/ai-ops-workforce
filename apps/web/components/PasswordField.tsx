'use client';
import { useId, useState } from 'react';

interface PasswordFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: 'current-password' | 'new-password';
  placeholder?: string;
  minLength?: number;
  required?: boolean;
  hint?: string;
}

/** A password input with an accessible show/hide toggle. Shared by login, signup and reset-password. */
export function PasswordField({ label, value, onChange, autoComplete, placeholder, minLength, required = true, hint }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const id = useId();

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="field-password-wrap">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          required={required}
          autoComplete={autoComplete}
          minLength={minLength}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          className="field-password-toggle"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={visible}
          tabIndex={-1}
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
      {hint && <div className="field-hint">{hint}</div>}
    </div>
  );
}
