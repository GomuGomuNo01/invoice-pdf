import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ApiError, downloadBlob, fetchIssuer, generatePdf } from './api/client';
import { InputField, TextAreaField } from './components/Field';
import { Icon } from './components/Icon';
import { InvoicePreview } from './components/InvoicePreview';
import { LegalDialog, type LegalPage } from './components/LegalDialog';
import { LinesEditor } from './components/LinesEditor';
import {
  EMPTY_ISSUER,
  LIMITS,
  computeTotals,
  emptyDraft,
  newLine,
  pickIssuer,
  serverFieldToFormKey,
  toPayload,
  validateDraft,
  type FieldErrors,
  type InvoiceDraft,
  type IssuerDraft,
  type LineDraft,
} from './domain/invoice';
import { clearIssuer, loadIssuer, saveIssuer } from './domain/issuerStorage';
import { formatDate, formatMoney, pdfFileName, todayIso } from './domain/format';

type Status =
  | { kind: 'idle' }
  | { kind: 'generating' }
  | { kind: 'success'; fileName: string }
  | { kind: 'invalid' }
  | { kind: 'error'; message: string };

type View = 'form' | 'preview';

/** Clé d'erreur ("lines.0.quantity") vers identifiant de champ ("lines-0-quantity"). */
function fieldId(key: string): string {
  const match = /^lines\.(\d+)\.(\w+)$/.exec(key);
  if (match) return `lines-${match[1]}-${match[2]}`;
  return key;
}

/** Ordre visuel des champs, pour lister les erreurs dans l'ordre de lecture. */
const FIELD_ORDER = [
  'issuerName',
  'issuerAddress',
  'issuerSiret',
  'issuerIban',
  'issuerEmail',
  'issuerPhone',
  'clientName', 'clientAddress', 'invoiceNumber', 'invoiceDate', 'paymentTermsDays', 'lines'];
const LINE_FIELD_ORDER = ['description', 'quantity', 'unit', 'unitPrice'];
function fieldRank(key: string): number {
  const line = /^lines\.(\d+)\.(\w+)$/.exec(key);
  if (line) return 100 + Number(line[1]) * 10 + LINE_FIELD_ORDER.indexOf(line[2] ?? '');
  if (key === 'notes') return 10_000;
  const index = FIELD_ORDER.indexOf(key);
  return index === -1 ? 20_000 : index;
}

/** Échéance en clair : "À payer avant le 10/12/2026". */
function dueText(dueDate: string | null, paymentTermsDays: string): string | null {
  if (!dueDate) return null;
  if (Number(paymentTermsDays.trim()) === 0) return `À payer à réception, le ${formatDate(dueDate)}`;
  return `À payer avant le ${formatDate(dueDate)}`;
}

function isBlank(draft: InvoiceDraft): boolean {
  return (
    !draft.invoiceNumber.trim() &&
    !draft.clientName.trim() &&
    !draft.clientAddress.trim() &&
    !draft.notes.trim() &&
    draft.lines.every((line) => !line.description.trim() && !line.unitPrice.trim() && !line.unit.trim())
  );
}

export default function App() {
  const [storedIssuer] = useState<IssuerDraft | null>(loadIssuer);
  const [draft, setDraft] = useState<InvoiceDraft>(() => emptyDraft(todayIso(), storedIssuer ?? EMPTY_ISSUER));
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState<ReadonlySet<string>>(() => new Set());
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [view, setView] = useState<View>('form');
  const [legalPage, setLegalPage] = useState<LegalPage | null>(null);
  const edited = useRef(new Set<string>());
  const summaryRef = useRef<HTMLDivElement>(null);
  const previewTitleRef = useRef<HTMLHeadingElement>(null);

  // Premier usage : préremplir l'émetteur avec la configuration du serveur, si elle existe.
  useEffect(() => {
    if (storedIssuer) return;
    const controller = new AbortController();
    fetchIssuer(controller.signal)
      .then((issuer) => {
        if (!issuer.name) return;
        setDraft((current) =>
          current.issuerName.trim()
            ? current
            : {
                ...current,
                issuerName: issuer.name ?? '',
                issuerAddress: issuer.addressLines.join('\n'),
                issuerSiret: issuer.siret ?? '',
                issuerEmail: issuer.email ?? '',
                issuerPhone: issuer.phone ?? '',
                issuerIban: issuer.iban ?? '',
              },
        );
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [storedIssuer]);

  // L'émetteur est mémorisé dans ce navigateur à chaque modification.
  const issuerSnapshot = JSON.stringify(pickIssuer(draft));
  const firstSave = useRef(true);
  useEffect(() => {
    if (firstSave.current) {
      firstSave.current = false;
      return;
    }
    const issuer = JSON.parse(issuerSnapshot) as IssuerDraft;
    // Un émetteur entièrement vide (après effacement) n'est pas mémorisé.
    if (Object.values(issuer).every((value) => value.trim() === '')) clearIssuer();
    else saveIssuer(issuer);
  }, [issuerSnapshot]);

  const totals = useMemo(() => computeTotals(draft), [draft]);
  const allClientErrors = useMemo(() => validateDraft(draft), [draft]);

  // Erreurs visibles : toutes après une tentative, sinon seulement celles des champs modifiés puis quittés.
  const clientErrors: FieldErrors = submitted
    ? allClientErrors
    : Object.fromEntries(Object.entries(allClientErrors).filter(([key]) => touched.has(key)));
  const errors: FieldErrors = { ...serverErrors, ...clientErrors };
  const summaryEntries = Object.entries(status.kind === 'invalid' ? allClientErrors : serverErrors).sort(
    ([a], [b]) => fieldRank(a) - fieldRank(b),
  );
  const due = dueText(totals.dueDate, draft.paymentTermsDays);

  function markEdited(key: string) {
    edited.current.add(key);
  }

  function handleBlur(key: string) {
    if (!edited.current.has(key) || touched.has(key)) return;
    setTouched((current) => new Set(current).add(key));
  }

  function clearTransientStatus() {
    setServerErrors({});
    setStatus((current) => (current.kind === 'success' || current.kind === 'error' ? { kind: 'idle' } : current));
  }

  function update<K extends keyof InvoiceDraft>(key: K, value: InvoiceDraft[K]) {
    markEdited(key);
    setDraft((current) => ({ ...current, [key]: value }));
    clearTransientStatus();
  }

  function updateLine(index: number, patch: Partial<LineDraft>) {
    for (const field of Object.keys(patch)) markEdited(`lines.${index}.${field}`);
    setDraft((current) => ({
      ...current,
      lines: current.lines.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    }));
    clearTransientStatus();
  }

  function moveLine(index: number, direction: -1 | 1) {
    setDraft((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.lines.length) return current;
      const lines = [...current.lines];
      [lines[index], lines[target]] = [lines[target]!, lines[index]!];
      return { ...current, lines };
    });
    clearTransientStatus();
  }

  // Le focus va sur le résumé une fois celui-ci affiché (après le rendu).
  const [summaryFocusRequest, setSummaryFocusRequest] = useState(0);
  useEffect(() => {
    if (summaryFocusRequest > 0) summaryRef.current?.focus();
  }, [summaryFocusRequest]);
  function focusSummary() {
    setSummaryFocusRequest((value) => value + 1);
  }

  function showView(next: View) {
    setView(next);
    window.scrollTo({ top: 0 });
    if (next === 'preview') requestAnimationFrame(() => previewTitleRef.current?.focus());
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status.kind === 'generating') return;
    setSubmitted(true);
    if (Object.keys(allClientErrors).length > 0) {
      setView('form');
      setStatus({ kind: 'invalid' });
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
        setStatus({ kind: 'error', message: 'Une erreur inattendue est survenue. Réessayez dans un instant.' });
      }
      setView('form');
      focusSummary();
    }
  }

  function reset() {
    if (!isBlank(draft) && !window.confirm('Effacer la facture en cours et recommencer ?')) return;
    setDraft((current) => emptyDraft(todayIso(), pickIssuer(current)));
    setSubmitted(false);
    setTouched(new Set());
    edited.current = new Set();
    setServerErrors({});
    setStatus({ kind: 'idle' });
    showView('form');
  }

  const showSummary = status.kind === 'invalid' || status.kind === 'error';
  const remaining = summaryEntries.length;
  let summaryTitle = '';
  if (status.kind === 'error') summaryTitle = status.message;
  else if (remaining > 0)
    summaryTitle = `Il reste ${remaining} point${remaining > 1 ? 's' : ''} à compléter avant de télécharger le PDF :`;
  else summaryTitle = 'Tout est complet. Vous pouvez télécharger le PDF.';

  return (
    <>
      <a className="skip-link" href="#formulaire">
        Aller au formulaire
      </a>
      <header className="topbar">
        <div className="topbar__inner">
          <p className="brand">
            <span className="brand__mark" aria-hidden="true" />
            Factures
          </p>
          <button type="button" className="button button--quiet button--small" onClick={reset}>
            <Icon name="refresh" size={18} />
            Recommencer
          </button>
        </div>
      </header>

      <main className="layout" data-view={view}>
        <div className="editor">
          <div className="intro">
            <h1>Nouvelle facture</h1>
            <p>
              Remplissez les cinq étapes. L'aperçu se met à jour pendant la saisie. Rien n'est enregistré sur nos
              serveurs : vos coordonnées sont seulement mémorisées dans ce navigateur.
            </p>
          </div>

          {showSummary ? (
            <div
              ref={summaryRef}
              tabIndex={-1}
              className={`summary${remaining === 0 && status.kind === 'invalid' ? ' summary--ok' : ''}`}
              role="alert"
            >
              <p className="summary__title">
                <Icon name={remaining === 0 && status.kind === 'invalid' ? 'check' : 'alert'} />
                <span>{summaryTitle}</span>
              </p>
              {remaining > 0 ? (
                <ul>
                  {summaryEntries.map(([key, message]) => (
                    <li key={key}>
                      <a href={`#${fieldId(key)}`}>{message}</a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <form id="formulaire" className="form" noValidate onSubmit={handleSubmit}>
            <fieldset className="step">
              <legend className="step__title">
                <span className="step__num" aria-hidden="true">
                  1
                </span>
                Vous
              </legend>
              <p className="step__help">
                Vos coordonnées, en haut de la facture. Elles sont gardées pour vos prochaines factures.
              </p>
              <div className="grid grid--client">
                <InputField
                  id="issuerName"
                  label="Votre nom ou votre entreprise"
                  autoComplete="organization"
                  placeholder="Ex. Atelier Dupont"
                  maxLength={LIMITS.maxName}
                  value={draft.issuerName}
                  error={errors['issuerName']}
                  onChange={(event) => update('issuerName', event.target.value)}
                  onBlur={() => handleBlur('issuerName')}
                />
                <TextAreaField
                  id="issuerAddress"
                  label="Votre adresse"
                  optional
                  hint="Allez à la ligne comme sur une enveloppe."
                  rows={3}
                  autoComplete="street-address"
                  placeholder={'8 avenue des Lilas\n33000 Bordeaux'}
                  value={draft.issuerAddress}
                  error={errors['issuerAddress']}
                  onChange={(event) => update('issuerAddress', event.target.value)}
                  onBlur={() => handleBlur('issuerAddress')}
                />
              </div>
              <div className="grid grid--2">
                <InputField
                  id="issuerSiret"
                  label="SIRET"
                  optional
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="Ex. 362 521 879 00034"
                  maxLength={20}
                  value={draft.issuerSiret}
                  error={errors['issuerSiret']}
                  onChange={(event) => update('issuerSiret', event.target.value)}
                  onBlur={() => handleBlur('issuerSiret')}
                />
                <InputField
                  id="issuerIban"
                  label="IBAN"
                  optional
                  hint="Affiché en bas de la facture pour le virement."
                  autoComplete="off"
                  placeholder="Ex. FR76 3000 6000 0112 3456 7890 189"
                  maxLength={42}
                  value={draft.issuerIban}
                  error={errors['issuerIban']}
                  onChange={(event) => update('issuerIban', event.target.value)}
                  onBlur={() => handleBlur('issuerIban')}
                />
                <InputField
                  id="issuerEmail"
                  label="E-mail"
                  optional
                  type="email"
                  autoComplete="email"
                  placeholder="Ex. contact@atelier.fr"
                  maxLength={LIMITS.maxEmail}
                  value={draft.issuerEmail}
                  error={errors['issuerEmail']}
                  onChange={(event) => update('issuerEmail', event.target.value)}
                  onBlur={() => handleBlur('issuerEmail')}
                />
                <InputField
                  id="issuerPhone"
                  label="Téléphone"
                  optional
                  type="tel"
                  autoComplete="tel"
                  placeholder="Ex. 06 12 34 56 78"
                  maxLength={30}
                  value={draft.issuerPhone}
                  error={errors['issuerPhone']}
                  onChange={(event) => update('issuerPhone', event.target.value)}
                  onBlur={() => handleBlur('issuerPhone')}
                />
              </div>
            </fieldset>

            <fieldset className="step">
              <legend className="step__title">
                <span className="step__num" aria-hidden="true">
                  2
                </span>
                Client
              </legend>
              <p className="step__help">À qui adressez-vous cette facture ?</p>
              <div className="grid grid--client">
                <InputField
                  id="clientName"
                  label="Nom du client"
                  autoComplete="organization"
                  placeholder="Ex. Boulangerie Martin"
                  maxLength={LIMITS.maxName}
                  value={draft.clientName}
                  error={errors['clientName']}
                  onChange={(event) => update('clientName', event.target.value)}
                  onBlur={() => handleBlur('clientName')}
                />
                <TextAreaField
                  id="clientAddress"
                  label="Adresse du client"
                  optional
                  hint="Allez à la ligne comme sur une enveloppe (5 lignes au plus)."
                  rows={3}
                  autoComplete="street-address"
                  placeholder={'12 rue de la Paix\n75002 Paris'}
                  value={draft.clientAddress}
                  error={errors['clientAddress']}
                  onChange={(event) => update('clientAddress', event.target.value)}
                  onBlur={() => handleBlur('clientAddress')}
                />
              </div>
            </fieldset>

            <fieldset className="step">
              <legend className="step__title">
                <span className="step__num" aria-hidden="true">
                  3
                </span>
                Facture
              </legend>
              <p className="step__help">Le numéro, la date et le délai laissé au client pour payer.</p>
              <div className="grid grid--3">
                <InputField
                  id="invoiceNumber"
                  label="Numéro de facture"
                  hint="Unique, et qui se suit d'une facture à l'autre."
                  autoComplete="off"
                  placeholder="Ex. 2026-001"
                  maxLength={30}
                  value={draft.invoiceNumber}
                  error={errors['invoiceNumber']}
                  onChange={(event) => update('invoiceNumber', event.target.value)}
                  onBlur={() => handleBlur('invoiceNumber')}
                />
                <InputField
                  id="invoiceDate"
                  label="Date de la facture"
                  type="date"
                  value={draft.invoiceDate}
                  error={errors['invoiceDate']}
                  onChange={(event) => update('invoiceDate', event.target.value)}
                  onBlur={() => handleBlur('invoiceDate')}
                />
                <InputField
                  id="paymentTermsDays"
                  label="Délai de paiement"
                  suffix="jours"
                  hint={due ? `En jours. ${due}.` : 'En jours, de 0 à 365.'}
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={3}
                  value={draft.paymentTermsDays}
                  error={errors['paymentTermsDays']}
                  onChange={(event) => update('paymentTermsDays', event.target.value)}
                  onBlur={() => handleBlur('paymentTermsDays')}
                />
              </div>
            </fieldset>

            <fieldset className="step">
              <legend className="step__title">
                <span className="step__num" aria-hidden="true">
                  4
                </span>
                Prestations
              </legend>
              <p className="step__help">Ce que vous avez vendu ou réalisé, une ligne par élément.</p>
              <LinesEditor
                lines={draft.lines}
                totals={totals}
                errors={errors}
                onChange={updateLine}
                onAdd={() => update('lines', [...draft.lines, newLine()])}
                onRemove={(index) =>
                  update(
                    'lines',
                    draft.lines.filter((_, i) => i !== index),
                  )
                }
                onMove={moveLine}
                onFieldBlur={handleBlur}
              />
            </fieldset>

            <fieldset className="step">
              <legend className="step__title">
                <span className="step__num" aria-hidden="true">
                  5
                </span>
                Mentions
              </legend>
              <TextAreaField
                id="notes"
                label="Mentions particulières"
                optional
                hint="Affichées en bas de la facture. La mention « TVA non applicable » est ajoutée automatiquement."
                rows={3}
                placeholder="Ex. Paiement par virement bancaire. Pas d'escompte pour paiement anticipé."
                maxLength={LIMITS.maxNotes}
                value={draft.notes}
                error={errors['notes']}
                onChange={(event) => update('notes', event.target.value)}
                onBlur={() => handleBlur('notes')}
              />
            </fieldset>
          </form>

          <footer className="site-footer">
            <button type="button" className="link-button" onClick={() => setLegalPage('mentions')}>
              Mentions légales
            </button>
            <button type="button" className="link-button" onClick={() => setLegalPage('confidentialite')}>
              Confidentialité
            </button>
          </footer>

          <div className="bar">
            <div className="bar__inner">
              <div className="bar__total">
                <span className="bar__label">Total à payer</span>
                <strong className="bar__amount" data-testid="form-total">
                  {formatMoney(totals.totalCents)}
                </strong>
                {due ? <span className="bar__due">{due}</span> : null}
              </div>
              <div className="bar__actions">
                <button
                  type="button"
                  className="button button--secondary bar__toggle"
                  onClick={() => showView(view === 'form' ? 'preview' : 'form')}
                >
                  <Icon name={view === 'form' ? 'eye' : 'edit'} />
                  {view === 'form' ? "Voir l'aperçu" : 'Modifier'}
                </button>
                <button
                  type="submit"
                  form="formulaire"
                  className="button button--primary bar__download"
                  aria-busy={status.kind === 'generating' || undefined}
                  disabled={status.kind === 'generating'}
                >
                  {status.kind === 'generating' ? <span className="spinner" aria-hidden="true" /> : <Icon name="download" />}
                  {status.kind === 'generating' ? (
                    'Préparation...'
                  ) : (
                    <span>
                      Télécharger{' '}
                      <span className="narrow-hide">le PDF</span>
                    </span>
                  )}
                </button>
              </div>
            </div>
            <div className="bar__status" role="status">
              {status.kind === 'generating' ? <p>Préparation du PDF en cours...</p> : null}
              {status.kind === 'success' ? (
                <p className="bar__success">
                  <Icon name="check" size={18} />
                  <span>PDF téléchargé : {status.fileName}</span>
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <section className="preview" aria-labelledby="preview-title">
          <div className="preview__head">
            <h2 id="preview-title" ref={previewTitleRef} tabIndex={-1}>
              Aperçu
            </h2>
            <p>Le PDF téléchargé fait foi.</p>
          </div>
          <div className="preview__paper">
            <InvoicePreview draft={draft} totals={totals} />
          </div>
        </section>
      </main>

      {legalPage ? (
        <LegalDialog
          page={legalPage}
          onClose={() => setLegalPage(null)}
          onClearIssuer={() => {
            clearIssuer();
            setDraft((current) => ({ ...current, ...EMPTY_ISSUER }));
          }}
        />
      ) : null}
    </>
  );
}
