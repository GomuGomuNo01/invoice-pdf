import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ApiError, downloadBlob, fetchIssuer, generatePdf, type Issuer } from './api/client';
import { InputField, TextAreaField } from './components/Field';
import { InvoicePreview } from './components/InvoicePreview';
import { LinesEditor } from './components/LinesEditor';
import {
  LIMITS,
  computeTotals,
  emptyDraft,
  newLine,
  serverFieldToFormKey,
  toPayload,
  validateDraft,
  type FieldErrors,
  type InvoiceDraft,
  type LineDraft,
} from './domain/invoice';
import { formatMoney, pdfFileName, todayIso } from './domain/format';

type Status =
  | { kind: 'idle' }
  | { kind: 'generating' }
  | { kind: 'success'; fileName: string }
  | { kind: 'error'; message: string };

/** Ordre des champs pour placer le focus sur la première erreur. */
function fieldId(key: string): string {
  const match = /^lines\.(\d+)\.(\w+)$/.exec(key);
  if (match) return `lines-${match[1]}-${match[2]}`;
  return key;
}

export default function App() {
  const [draft, setDraft] = useState<InvoiceDraft>(() => emptyDraft(todayIso()));
  const [issuer, setIssuer] = useState<Issuer | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const summaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchIssuer(controller.signal)
      .then(setIssuer)
      .catch(() => setIssuer(null));
    return () => controller.abort();
  }, []);

  const totals = useMemo(() => computeTotals(draft), [draft]);
  const clientErrors = useMemo(() => (submitted ? validateDraft(draft) : {}), [draft, submitted]);
  const errors: FieldErrors = { ...serverErrors, ...clientErrors };
  const errorEntries = Object.entries(errors);

  function update(patch: Partial<InvoiceDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
    setServerErrors({});
    if (status.kind !== 'generating') setStatus({ kind: 'idle' });
  }

  function updateLine(index: number, patch: Partial<LineDraft>) {
    setDraft((current) => ({
      ...current,
      lines: current.lines.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    }));
    setServerErrors({});
  }

  function moveLine(index: number, direction: -1 | 1) {
    setDraft((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.lines.length) return current;
      const lines = [...current.lines];
      [lines[index], lines[target]] = [lines[target]!, lines[index]!];
      return { ...current, lines };
    });
  }

  function focusSummary() {
    requestAnimationFrame(() => summaryRef.current?.focus());
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    const validation = validateDraft(draft);
    if (Object.keys(validation).length > 0) {
      setStatus({ kind: 'error', message: 'Corriger les erreurs avant de générer le PDF.' });
      focusSummary();
      return;
    }

    setStatus({ kind: 'generating' });
    try {
      const blob = await generatePdf(toPayload(draft));
      const fileName = pdfFileName(draft.invoiceNumber);
      downloadBlob(blob, fileName);
      setStatus({ kind: 'success', fileName });
    } catch (error) {
      if (error instanceof ApiError) {
        const mapped: FieldErrors = {};
        for (const fieldError of error.fieldErrors) {
          mapped[serverFieldToFormKey(fieldError.field)] ??= fieldError.message;
        }
        setServerErrors(mapped);
        setStatus({ kind: 'error', message: error.message });
      } else {
        setStatus({ kind: 'error', message: 'Une erreur inattendue est survenue.' });
      }
      focusSummary();
    }
  }

  function reset() {
    setDraft(emptyDraft(todayIso()));
    setSubmitted(false);
    setServerErrors({});
    setStatus({ kind: 'idle' });
  }

  return (
    <>
      <a className="skip-link" href="#formulaire">
        Aller au formulaire
      </a>
      <header className="app-header">
        <h1>Nouvelle facture</h1>
        <p>Saisir les informations, vérifier l'aperçu, puis générer le PDF. Aucune donnée n'est conservée.</p>
      </header>

      <main className="layout">
        <form id="formulaire" className="form" noValidate onSubmit={handleSubmit} aria-describedby="form-help">
          <p id="form-help" className="field__hint">
            Les champs marqués d'un astérisque sont obligatoires.
          </p>

          <div
            ref={summaryRef}
            tabIndex={-1}
            className={`status${status.kind === 'error' ? ' status--error' : ''}${status.kind === 'success' ? ' status--success' : ''}`}
            role={status.kind === 'error' ? 'alert' : 'status'}
            aria-live="polite"
          >
            {status.kind === 'generating' ? <p>Génération du PDF en cours...</p> : null}
            {status.kind === 'success' ? <p>PDF généré : {status.fileName}</p> : null}
            {status.kind === 'error' ? (
              <>
                <p>{status.message}</p>
                {errorEntries.length > 0 ? (
                  <ul>
                    {errorEntries.map(([key, message]) => (
                      <li key={key}>
                        <a href={`#${fieldId(key)}`}>{message}</a>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            ) : null}
          </div>

          <fieldset className="card">
            <legend>Facture</legend>
            <div className="grid grid--3">
              <InputField
                id="invoiceNumber"
                label="Numéro de facture"
                required
                autoComplete="off"
                placeholder="558-00178"
                maxLength={30}
                value={draft.invoiceNumber}
                error={errors['invoiceNumber']}
                onChange={(event) => update({ invoiceNumber: event.target.value })}
              />
              <InputField
                id="invoiceDate"
                label="Date de facture"
                type="date"
                required
                value={draft.invoiceDate}
                error={errors['invoiceDate']}
                onChange={(event) => update({ invoiceDate: event.target.value })}
              />
              <InputField
                id="paymentTermsDays"
                label="Conditions de paiement (jours)"
                required
                inputMode="numeric"
                autoComplete="off"
                hint="Entre 0 et 365"
                value={draft.paymentTermsDays}
                error={errors['paymentTermsDays']}
                onChange={(event) => update({ paymentTermsDays: event.target.value })}
              />
            </div>
          </fieldset>

          <fieldset className="card">
            <legend>Client</legend>
            <InputField
              id="clientName"
              label="Nom du client"
              required
              autoComplete="organization"
              maxLength={LIMITS.maxName}
              value={draft.clientName}
              error={errors['clientName']}
              onChange={(event) => update({ clientName: event.target.value })}
            />
            <TextAreaField
              id="clientAddress"
              label="Adresse du client"
              hint="Une ligne par ligne d'adresse, 5 lignes au plus"
              rows={3}
              autoComplete="street-address"
              value={draft.clientAddress}
              error={errors['clientAddress']}
              onChange={(event) => update({ clientAddress: event.target.value })}
            />
          </fieldset>

          <LinesEditor
            lines={draft.lines}
            totals={totals}
            errors={errors}
            onChange={updateLine}
            onAdd={() => update({ lines: [...draft.lines, newLine()] })}
            onRemove={(index) => update({ lines: draft.lines.filter((_, i) => i !== index) })}
            onMove={moveLine}
          />

          <fieldset className="card">
            <legend>Mentions particulières</legend>
            <TextAreaField
              id="notes"
              label="Conditions de paiement et mentions particulières"
              hint="Facultatif. La mention de TVA non applicable est ajoutée automatiquement."
              rows={3}
              maxLength={LIMITS.maxNotes}
              value={draft.notes}
              error={errors['notes']}
              onChange={(event) => update({ notes: event.target.value })}
            />
          </fieldset>

          <div className="actions">
            <p className="actions__total">
              Total à payer : <strong data-testid="form-total">{formatMoney(totals.totalCents)}</strong>
            </p>
            <div className="actions__buttons">
              <button type="button" className="button button--ghost" onClick={reset}>
                Nouvelle facture
              </button>
              <button type="submit" className="button button--primary" disabled={status.kind === 'generating'}>
                {status.kind === 'generating' ? 'Génération...' : 'Générer le PDF'}
              </button>
            </div>
          </div>
        </form>

        <section className="preview" aria-labelledby="preview-title">
          <h2 id="preview-title">Aperçu</h2>
          <InvoicePreview draft={draft} totals={totals} issuer={issuer} />
        </section>
      </main>
    </>
  );
}
