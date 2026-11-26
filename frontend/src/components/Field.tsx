import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';

interface FieldShellProps {
  id: string;
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
  required?: boolean | undefined;
  className?: string | undefined;
  children: (describedBy: string | undefined) => ReactNode;
}

/** Libellé, aide et message d'erreur reliés au champ (aria-describedby). */
function FieldShell({ id, label, error, hint, required, className, children }: FieldShellProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={`field${error ? ' field--invalid' : ''}${className ? ` ${className}` : ''}`}>
      <label htmlFor={id}>
        {label}
        {required ? (
          <span className="field__required" aria-hidden="true">
            {' '}
            *
          </span>
        ) : null}
      </label>
      {hint ? (
        <p id={hintId} className="field__hint">
          {hint}
        </p>
      ) : null}
      {children(describedBy)}
      {error ? (
        <p id={errorId} className="field__error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type InputFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  id: string;
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
  fieldClassName?: string | undefined;
};

export function InputField({ id, label, error, hint, required, fieldClassName, ...input }: InputFieldProps) {
  return (
    <FieldShell id={id} label={label} error={error} hint={hint} required={required} className={fieldClassName}>
      {(describedBy) => (
        <input
          id={id}
          name={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          aria-required={required ? true : undefined}
          {...input}
        />
      )}
    </FieldShell>
  );
}

type TextAreaFieldProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> & {
  id: string;
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
  fieldClassName?: string | undefined;
};

export function TextAreaField({ id, label, error, hint, required, fieldClassName, ...textarea }: TextAreaFieldProps) {
  return (
    <FieldShell id={id} label={label} error={error} hint={hint} required={required} className={fieldClassName}>
      {(describedBy) => (
        <textarea
          id={id}
          name={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          aria-required={required ? true : undefined}
          {...textarea}
        />
      )}
    </FieldShell>
  );
}
