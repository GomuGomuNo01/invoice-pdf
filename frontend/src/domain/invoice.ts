import { z } from 'zod';
import {
  PRICE_SCALE,
  QUANTITY_SCALE,
  lineAmountCents,
  parseScaled,
  scaledToDecimalString,
} from './decimal';
import { addDays } from './format';

/** Bornes identiques au backend (com.invoicepdf.api.Limits). */
export const LIMITS = {
  invoiceNumberRegex: /^[A-Za-z0-9][A-Za-z0-9\-/_.]{0,29}$/,
  maxPaymentTermsDays: 365,
  maxLines: 100,
  maxName: 120,
  maxAddressLines: 5,
  maxAddressLine: 120,
  maxDescription: 500,
  maxUnit: 20,
  maxNotes: 1000,
  maxQuantity: 1_000_000n * 10n ** BigInt(QUANTITY_SCALE),
  maxUnitPriceCents: 100_000_000n * 10n ** BigInt(PRICE_SCALE),
} as const;

// Caractères de contrôle interdits (sauf \t \n \r pour les champs multilignes).
// eslint-disable-next-line no-control-regex
const SINGLE_LINE = /^[^\u0000-\u001F\u007F]*$/;
// eslint-disable-next-line no-control-regex
const MULTI_LINE = /^[^\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]*$/;
const CONTROL_MESSAGE = 'Le texte contient des caractères non autorisés.';

export interface LineDraft {
  id: string;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
}

export interface InvoiceDraft {
  invoiceNumber: string;
  invoiceDate: string;
  paymentTermsDays: string;
  clientName: string;
  clientAddress: string;
  lines: LineDraft[];
  notes: string;
}

/** Contrat de l'API POST /api/v1/invoices/pdf (sans champ calculé). */
export interface InvoicePayload {
  invoiceNumber: string;
  invoiceDate: string;
  paymentTermsDays: number;
  client: { name: string; addressLines: string[] };
  lines: { description: string; quantity: number; unit: string | null; unitPrice: number }[];
  notes: string | null;
}

export function addressLines(clientAddress: string): string[] {
  return clientAddress
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

const lineSchema = z.object({
  id: z.string(),
  description: z
    .string()
    .trim()
    .min(1, 'La description est obligatoire.')
    .max(LIMITS.maxDescription, 'La description dépasse 500 caractères.')
    .regex(MULTI_LINE, CONTROL_MESSAGE),
  quantity: z.string().superRefine((value, ctx) => {
    const scaled = parseScaled(value, QUANTITY_SCALE);
    if (value.trim() === '') ctx.addIssue({ code: 'custom', message: 'La quantité est obligatoire.' });
    else if (scaled === null) ctx.addIssue({ code: 'custom', message: 'Écrivez un nombre, avec au plus 3 chiffres après la virgule (ex. 1,5).' });
    else if (scaled <= 0n) ctx.addIssue({ code: 'custom', message: 'La quantité doit être strictement positive.' });
    else if (scaled > LIMITS.maxQuantity) ctx.addIssue({ code: 'custom', message: 'La quantité est trop élevée.' });
  }),
  unit: z
    .string()
    .trim()
    .max(LIMITS.maxUnit, "L'unité dépasse 20 caractères.")
    .regex(SINGLE_LINE, CONTROL_MESSAGE),
  unitPrice: z.string().superRefine((value, ctx) => {
    const cents = parseScaled(value, PRICE_SCALE);
    if (value.trim() === '') ctx.addIssue({ code: 'custom', message: 'Le prix unitaire est obligatoire.' });
    else if (cents === null) ctx.addIssue({ code: 'custom', message: 'Écrivez un prix, avec au plus 2 chiffres après la virgule (ex. 12,50).' });
    else if (cents > LIMITS.maxUnitPriceCents) ctx.addIssue({ code: 'custom', message: 'Le prix unitaire est trop élevé.' });
  }),
});

export const invoiceDraftSchema = z.object({
  invoiceNumber: z
    .string()
    .trim()
    .min(1, 'Le numéro de facture est obligatoire.')
    .regex(
      LIMITS.invoiceNumberRegex,
      'Utilisez seulement des lettres, des chiffres et - / _ . (30 caractères au plus, ex. 2026-001).',
    ),
  invoiceDate: z.iso.date('La date de facture est obligatoire.'),
  paymentTermsDays: z
    .string()
    .trim()
    .regex(/^\d{1,3}$/, 'Le délai de paiement doit être compris entre 0 et 365 jours.')
    .refine(
      (value) => Number(value) <= LIMITS.maxPaymentTermsDays,
      'Le délai de paiement doit être compris entre 0 et 365 jours.',
    ),
  clientName: z
    .string()
    .trim()
    .min(1, 'Le nom du client est obligatoire.')
    .max(LIMITS.maxName, 'Le nom du client dépasse 120 caractères.')
    .regex(SINGLE_LINE, CONTROL_MESSAGE),
  clientAddress: z.string().superRefine((value, ctx) => {
    const lines = addressLines(value);
    if (lines.length > LIMITS.maxAddressLines) {
      ctx.addIssue({ code: 'custom', message: "L'adresse du client contient au plus 5 lignes." });
    } else if (lines.some((line) => line.length > LIMITS.maxAddressLine)) {
      ctx.addIssue({ code: 'custom', message: "Une ligne d'adresse dépasse 120 caractères." });
    }
  }),
  lines: z
    .array(lineSchema)
    .min(1, 'Au moins une ligne est obligatoire.')
    .max(LIMITS.maxLines, 'La facture contient au plus 100 lignes.'),
  notes: z
    .string()
    .max(LIMITS.maxNotes, 'Les mentions particulières dépassent 1000 caractères.')
    .regex(MULTI_LINE, CONTROL_MESSAGE),
});

export type FieldErrors = Record<string, string>;

/** Valide le brouillon. Les clés d'erreur suivent les chemins du formulaire : "clientName", "lines.0.quantity". */
export function validateDraft(draft: InvoiceDraft): FieldErrors {
  const result = invoiceDraftSchema.safeParse(draft);
  if (result.success) return {};
  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.');
    errors[key] ??= issue.message;
  }
  return errors;
}

/** Convertit un brouillon valide en contenu d'API (les montants restent calculés par le serveur). */
export function toPayload(draft: InvoiceDraft): InvoicePayload {
  const notes = draft.notes.trim();
  return {
    invoiceNumber: draft.invoiceNumber.trim(),
    invoiceDate: draft.invoiceDate,
    paymentTermsDays: Number(draft.paymentTermsDays.trim()),
    client: { name: draft.clientName.trim(), addressLines: addressLines(draft.clientAddress) },
    lines: draft.lines.map((line) => ({
      description: line.description.trim(),
      quantity: Number(scaledToDecimalString(parseScaled(line.quantity, QUANTITY_SCALE) ?? 0n, QUANTITY_SCALE)),
      unit: line.unit.trim() === '' ? null : line.unit.trim(),
      unitPrice: Number(scaledToDecimalString(parseScaled(line.unitPrice, PRICE_SCALE) ?? 0n, PRICE_SCALE)),
    })),
    notes: notes === '' ? null : notes,
  };
}

/** Convertit un chemin d'erreur serveur ("lines[0].quantity", "client.name") en clé du formulaire. */
export function serverFieldToFormKey(field: string): string {
  if (field === 'client.name') return 'clientName';
  if (field.startsWith('client.addressLines')) return 'clientAddress';
  return field.replace(/\[(\d+)\]/g, '.$1');
}

export interface ComputedLine {
  id: string;
  quantity: bigint | null;
  unitPriceCents: bigint | null;
  amountCents: bigint | null;
}

export interface Totals {
  lines: ComputedLine[];
  totalCents: bigint;
  dueDate: string | null;
}

/** Calcul en direct pour l'aperçu. Les lignes incomplètes n'entrent pas dans le total. */
export function computeTotals(draft: InvoiceDraft): Totals {
  const lines = draft.lines.map((line) => {
    const quantity = parseScaled(line.quantity, QUANTITY_SCALE);
    const unitPriceCents = parseScaled(line.unitPrice, PRICE_SCALE);
    const amountCents =
      quantity !== null && unitPriceCents !== null ? lineAmountCents(quantity, unitPriceCents) : null;
    return { id: line.id, quantity, unitPriceCents, amountCents };
  });
  const totalCents = lines.reduce((sum, line) => sum + (line.amountCents ?? 0n), 0n);
  const terms = /^\d{1,3}$/.test(draft.paymentTermsDays.trim()) ? Number(draft.paymentTermsDays.trim()) : null;
  const dueDate =
    terms !== null && terms <= LIMITS.maxPaymentTermsDays && /^\d{4}-\d{2}-\d{2}$/.test(draft.invoiceDate)
      ? addDays(draft.invoiceDate, terms)
      : null;
  return { lines, totalCents, dueDate };
}

let lineCounter = 0;
export function newLine(): LineDraft {
  lineCounter += 1;
  return { id: `l${Date.now().toString(36)}${lineCounter}`, description: '', quantity: '1', unit: '', unitPrice: '' };
}

export function emptyDraft(today: string): InvoiceDraft {
  return {
    invoiceNumber: '',
    invoiceDate: today,
    paymentTermsDays: '14',
    clientName: '',
    clientAddress: '',
    lines: [newLine()],
    notes: '',
  };
}
