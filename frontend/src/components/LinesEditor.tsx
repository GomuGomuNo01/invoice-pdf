import { useEffect, useId, useRef, useState } from 'react';
import type { FieldErrors, LineDraft, Totals } from '../domain/invoice';
import { LIMITS } from '../domain/invoice';
import { formatMoney } from '../domain/format';
import { InputField, TextAreaField } from './Field';
import { Icon } from './Icon';

interface Props {
  lines: LineDraft[];
  totals: Totals;
  errors: FieldErrors;
  onChange: (index: number, patch: Partial<LineDraft>) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onFieldBlur: (key: string) => void;
}

/** Menu discret pour déplacer une ligne : fermé par Échap, clic extérieur ou après l'action. */
function MoveMenu({
  number,
  canUp,
  canDown,
  onMove,
}: {
  number: number;
  canUp: boolean;
  canDown: boolean;
  onMove: (direction: -1 | 1) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function move(direction: -1 | 1) {
    onMove(direction);
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  return (
    <div className="move" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="icon-button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Déplacer la ligne ${number}`}
        title="Déplacer"
        disabled={!canUp && !canDown}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="more" />
      </button>
      {open ? (
        <div id={menuId} className="move__panel">
          <button
            type="button"
            className="move__item"
            disabled={!canUp}
            aria-label={`Monter la ligne ${number}`}
            onClick={() => move(-1)}
          >
            <Icon name="up" size={18} />
            Monter
          </button>
          <button
            type="button"
            className="move__item"
            disabled={!canDown}
            aria-label={`Descendre la ligne ${number}`}
            onClick={() => move(1)}
          >
            <Icon name="down" size={18} />
            Descendre
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function LinesEditor({ lines, totals, errors, onChange, onAdd, onRemove, onMove, onFieldBlur }: Props) {
  // Après un ajout ou une suppression, le focus va sur la description concernée.
  const focusIndex = useRef<number | null>(null);
  useEffect(() => {
    if (focusIndex.current === null) return;
    const index = Math.min(focusIndex.current, lines.length - 1);
    focusIndex.current = null;
    document.getElementById(`lines-${index}-description`)?.focus();
  }, [lines.length]);

  const atLimit = lines.length >= LIMITS.maxLines;

  return (
    <div className="lines-editor">
      {errors['lines'] ? (
        <p className="field__error" id="lines-error">
          <Icon name="alert" size={16} />
          <span>{errors['lines']}</span>
        </p>
      ) : null}

      <div className="lines__head" aria-hidden="true">
        <span>Description</span>
        <span>Quantité</span>
        <span>Unité</span>
        <span className="num">Prix unitaire</span>
        <span className="num">Montant</span>
        <span />
      </div>

      <ol className="lines">
        {lines.map((line, index) => {
          const amount = totals.lines[index]?.amountCents;
          const prefix = `lines-${index}`;
          const key = `lines.${index}`;
          const number = index + 1;
          return (
            <li key={line.id} className="line" aria-label={`Ligne ${number}`}>
              <span className="line__title" aria-hidden="true">
                Ligne {number}
              </span>
              <TextAreaField
                id={`${prefix}-description`}
                label="Description"
                fieldClassName="line__desc"
                rows={1}
                placeholder="Ex. Création du site vitrine"
                maxLength={LIMITS.maxDescription}
                value={line.description}
                error={errors[`${key}.description`]}
                onChange={(event) => onChange(index, { description: event.target.value })}
                onBlur={() => onFieldBlur(`${key}.description`)}
              />
              <InputField
                id={`${prefix}-quantity`}
                label="Quantité"
                fieldClassName="line__qty"
                inputMode="decimal"
                autoComplete="off"
                value={line.quantity}
                error={errors[`${key}.quantity`]}
                onChange={(event) => onChange(index, { quantity: event.target.value })}
                onBlur={() => onFieldBlur(`${key}.quantity`)}
              />
              <InputField
                id={`${prefix}-unit`}
                label="Unité"
                optional
                fieldClassName="line__unit"
                list="units"
                placeholder="jour"
                maxLength={LIMITS.maxUnit}
                autoComplete="off"
                value={line.unit}
                error={errors[`${key}.unit`]}
                onChange={(event) => onChange(index, { unit: event.target.value })}
                onBlur={() => onFieldBlur(`${key}.unit`)}
              />
              <InputField
                id={`${prefix}-unitPrice`}
                label="Prix unitaire (€)"
                fieldClassName="line__price"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0,00"
                value={line.unitPrice}
                error={errors[`${key}.unitPrice`]}
                onChange={(event) => onChange(index, { unitPrice: event.target.value })}
                onBlur={() => onFieldBlur(`${key}.unitPrice`)}
              />
              <p className="line__amount">
                <span className="line__amount-label">Montant</span>{' '}
                <span className="line__amount-value">{amount != null ? formatMoney(amount) : '-'}</span>
              </p>
              <div className="line__actions">
                <MoveMenu
                  number={number}
                  canUp={index > 0}
                  canDown={index < lines.length - 1}
                  onMove={(direction) => onMove(index, direction)}
                />
                <button
                  type="button"
                  className="icon-button icon-button--danger"
                  onClick={() => {
                    focusIndex.current = index;
                    onRemove(index);
                  }}
                  disabled={lines.length === 1}
                  aria-label={`Supprimer la ligne ${number}`}
                  title="Supprimer"
                >
                  <Icon name="trash" />
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
        <option value="mois" />
      </datalist>

      <div className="lines__footer">
        <button
          type="button"
          className="button button--quiet"
          onClick={() => {
            focusIndex.current = lines.length;
            onAdd();
          }}
          disabled={atLimit}
        >
          <Icon name="plus" />
          Ajouter une ligne
        </button>
        <p className="lines__total">
          <span>Total HT</span> <strong>{formatMoney(totals.totalCents)}</strong>
        </p>
      </div>
      {atLimit ? <p className="field__hint">Limite de 100 lignes atteinte.</p> : null}
    </div>
  );
}
