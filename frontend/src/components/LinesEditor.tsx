import type { FieldErrors, LineDraft, Totals } from '../domain/invoice';
import { LIMITS } from '../domain/invoice';
import { formatMoney } from '../domain/format';
import { InputField, TextAreaField } from './Field';

interface Props {
  lines: LineDraft[];
  totals: Totals;
  errors: FieldErrors;
  onChange: (index: number, patch: Partial<LineDraft>) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onMove: (index: number, direction: -1 | 1) => void;
}

export function LinesEditor({ lines, totals, errors, onChange, onAdd, onRemove, onMove }: Props) {
  return (
    <fieldset className="card">
      <legend>Prestations</legend>
      {errors['lines'] ? (
        <p className="field__error" id="lines-error">
          {errors['lines']}
        </p>
      ) : null}
      <ol className="lines">
        {lines.map((line, index) => {
          const amount = totals.lines[index]?.amountCents;
          const prefix = `lines-${index}`;
          const number = index + 1;
          return (
            <li key={line.id} className="line" aria-label={`Ligne ${number}`}>
              <div className="line__header">
                <span className="line__title">Ligne {number}</span>
                <span className="line__amount" aria-live="polite">
                  Montant : {amount != null ? formatMoney(amount) : '-'}
                </span>
              </div>
              <TextAreaField
                id={`${prefix}-description`}
                label="Description"
                required
                rows={2}
                maxLength={LIMITS.maxDescription}
                value={line.description}
                error={errors[`lines.${index}.description`]}
                onChange={(event) => onChange(index, { description: event.target.value })}
              />
              <div className="line__grid">
                <InputField
                  id={`${prefix}-quantity`}
                  label="Quantité"
                  required
                  inputMode="decimal"
                  autoComplete="off"
                  value={line.quantity}
                  error={errors[`lines.${index}.quantity`]}
                  onChange={(event) => onChange(index, { quantity: event.target.value })}
                />
                <InputField
                  id={`${prefix}-unit`}
                  label="Unité (facultatif)"
                  list="units"
                  maxLength={LIMITS.maxUnit}
                  autoComplete="off"
                  value={line.unit}
                  error={errors[`lines.${index}.unit`]}
                  onChange={(event) => onChange(index, { unit: event.target.value })}
                />
                <InputField
                  id={`${prefix}-unitPrice`}
                  label="Prix unitaire (€)"
                  required
                  inputMode="decimal"
                  autoComplete="off"
                  value={line.unitPrice}
                  error={errors[`lines.${index}.unitPrice`]}
                  onChange={(event) => onChange(index, { unitPrice: event.target.value })}
                />
              </div>
              <div className="line__actions">
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => onMove(index, -1)}
                  disabled={index === 0}
                  aria-label={`Monter la ligne ${number}`}
                >
                  Monter
                </button>
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => onMove(index, 1)}
                  disabled={index === lines.length - 1}
                  aria-label={`Descendre la ligne ${number}`}
                >
                  Descendre
                </button>
                <button
                  type="button"
                  className="button button--danger"
                  onClick={() => onRemove(index)}
                  disabled={lines.length === 1}
                  aria-label={`Supprimer la ligne ${number}`}
                >
                  Supprimer
                </button>
              </div>
            </li>
          );
        })}
      </ol>
      <datalist id="units">
        <option value="heure" />
        <option value="jour" />
        <option value="forfait" />
        <option value="pièce" />
        <option value="mètre" />
      </datalist>
      <button type="button" className="button button--secondary" onClick={onAdd} disabled={lines.length >= LIMITS.maxLines}>
        Ajouter une ligne
      </button>
      {lines.length >= LIMITS.maxLines ? <p className="field__hint">Limite de 100 lignes atteinte.</p> : null}
    </fieldset>
  );
}
