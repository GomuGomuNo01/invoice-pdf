import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';
import { Icon } from './Icon';

interface FieldShellProps {
  id: string;
  label: string;
  error?: string | undefined;
  hint?: ReactNode;
  optional?: boolean | undefined;
  className?: string | undefined;
  children: (describedBy: string | undefined) => ReactNode;
}

/**
 * Libellé, aide et message d'erreur reliés au champ (aria-describedby).
 * Les champs sont obligatoires par défaut : seuls les champs facultatifs sont signalés.
 */
function FieldShell({ id, label, error, hint, optional, className, children }: FieldShellProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={`field${error ? ' field--invalid' : ''}${className ? ` ${className}` : ''}`}>
      <label className="field__label" htmlFor={id}>
        {label}
        {optional ? <span className="field__optional"> (facultatif)</span> : null}
      </label>
      {children(describedBy)}
      {hint ? (
        <p id={hintId} className="field__hint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="field__error">
          <Icon name="alert" size={16} />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}

type InputFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  id: string;
  label: string;
  error?: string | undefined;
  hint?: ReactNode;
  optional?: boolean | undefined;
  /** Unité affichée dans le champ (ex. "jours"), décorative : elle doit aussi figurer dans l'aide ou le libellé. */
  suffix?: string | undefined;
  fieldClassName?: string | undefined;
};

export function InputField({ id, label, error, hint, optional, suffix, fieldClassName, ...input }: InputFieldProps) {
  return (
    <FieldShell id={id} label={label} error={error} hint={hint} optional={optional} className={fieldClassName}>
      {(describedBy) => {
        const control = (
          <input
            id={id}
            name={id}
            className="field__control"
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            aria-required={optional ? undefined : true}
            {...input}
          />
        );
        return suffix ? (
          <div className="field__group">
            {control}
            <span className="field__suffix" aria-hidden="true">
              {suffix}
            </span>
          </div>
        ) : (
          control
        );
      }}
    </FieldShell>
  );
}

type TextAreaFieldProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> & {
  id: string;
  label: string;
  error?: string | undefined;
  hint?: ReactNode;
  optional?: boolean | undefined;
  fieldClassName?: string | undefined;
};

export function TextAreaField({ id, label, error, hint, optional, fieldClassName, ...textarea }: TextAreaFieldProps) {
  return (
    <FieldShell id={id} label={label} error={error} hint={hint} optional={optional} className={fieldClassName}>
      {(describedBy) => (
        <textarea
          id={id}
          name={id}
          className="field__control"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          aria-required={optional ? undefined : true}
          {...textarea}
        />
      )}
    </FieldShell>
  );
}
