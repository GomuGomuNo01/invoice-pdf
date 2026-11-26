import { describe, expect, it } from 'vitest';
import { centsToDecimalString, lineAmountCents, parseScaled, scaledToDecimalString } from './decimal';
import { NBSP, addDays, formatDate, formatMoney, formatQuantity, pdfFileName, todayIso } from './format';
import {
  computeTotals,
  emptyDraft,
  serverFieldToFormKey,
  toPayload,
  validateDraft,
  type InvoiceDraft,
} from './invoice';

function draft(overrides: Partial<InvoiceDraft> = {}): InvoiceDraft {
  return {
    invoiceNumber: '558-00178',
    invoiceDate: '2026-11-26',
    paymentTermsDays: '14',
    clientName: 'Client SAS',
    clientAddress: '5 avenue du Client\n\n69001 Lyon',
    lines: [
      { id: 'a', description: 'Développement', quantity: '5', unit: 'jour', unitPrice: '250' },
      { id: 'b', description: 'Frais', quantity: '1', unit: '', unitPrice: '0,5' },
    ],
    notes: '',
    ...overrides,
  };
}

describe('calcul décimal exact', () => {
  it('lit les décimaux avec virgule ou point', () => {
    expect(parseScaled('1,5', 3)).toBe(1500n);
    expect(parseScaled('1.5', 3)).toBe(1500n);
    expect(parseScaled(' 2 ', 2)).toBe(200n);
    expect(parseScaled('0.125', 3)).toBe(125n);
  });

  it('refuse les saisies invalides', () => {
    expect(parseScaled('', 2)).toBeNull();
    expect(parseScaled('-1', 2)).toBeNull();
    expect(parseScaled('1e3', 2)).toBeNull();
    expect(parseScaled('1,234', 2)).toBeNull();
    expect(parseScaled('abc', 2)).toBeNull();
  });

  it('arrondit en HALF_UP comme le backend', () => {
    expect(lineAmountCents(1500n, 15n)).toBe(23n); // 1,5 x 0,15 = 0,225 -> 0,23
    expect(lineAmountCents(333n, 1001n)).toBe(333n); // 0,333 x 10,01 = 3,33333 -> 3,33
    expect(lineAmountCents(1500n, 1001n)).toBe(1502n); // 1,5 x 10,01 = 15,015 -> 15,02
  });

  it('évite les erreurs de flottants', () => {
    // 0,1 + 0,2 en flottant vaut 0,30000000000000004
    const total = computeTotals(
      draft({
        lines: [
          { id: 'a', description: 'x', quantity: '1', unit: '', unitPrice: '0,1' },
          { id: 'b', description: 'y', quantity: '1', unit: '', unitPrice: '0,2' },
        ],
      }),
    ).totalCents;
    expect(total).toBe(30n);
  });

  it('convertit vers des chaînes décimales', () => {
    expect(centsToDecimalString(125050n)).toBe('1250.50');
    expect(scaledToDecimalString(1500n, 3)).toBe('1.5');
    expect(scaledToDecimalString(2000n, 3)).toBe('2');
  });
});

describe('formats français', () => {
  it('formate les montants avec espace insécable', () => {
    expect(formatMoney(125000n)).toBe(`1${NBSP}250,00${NBSP}€`);
    expect(formatMoney(0n)).toBe(`0,00${NBSP}€`);
    expect(formatMoney(1234567890n)).toBe(`12${NBSP}345${NBSP}678,90${NBSP}€`);
  });

  it('formate quantités et dates', () => {
    expect(formatQuantity(1500n)).toBe('1,5');
    expect(formatQuantity(2000n)).toBe('2');
    expect(formatDate('2026-11-26')).toBe('26/11/2026');
  });

  it("calcule l'échéance sans effet de fuseau", () => {
    expect(addDays('2026-11-26', 14)).toBe('2026-12-10');
    expect(addDays('2026-12-31', 5)).toBe('2027-01-05');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
  });

  it('donne la date du jour locale', () => {
    expect(todayIso(new Date(2026, 10, 26, 23, 30))).toBe('2026-11-26');
  });

  it('nomme le fichier comme le serveur', () => {
    expect(pdfFileName('558-00178')).toBe('Facture-558-00178.pdf');
    expect(pdfFileName('2026/001')).toBe('Facture-2026-001.pdf');
  });
});

describe('calcul en direct', () => {
  it('calcule montants, total et échéance', () => {
    const totals = computeTotals(draft());
    expect(totals.lines.map((line) => line.amountCents)).toEqual([125000n, 50n]);
    expect(totals.totalCents).toBe(125050n);
    expect(totals.dueDate).toBe('2026-12-10');
  });

  it('ignore les lignes incomplètes', () => {
    const totals = computeTotals(
      draft({ lines: [{ id: 'a', description: '', quantity: '2', unit: '', unitPrice: '' }] }),
    );
    expect(totals.lines[0]?.amountCents).toBeNull();
    expect(totals.totalCents).toBe(0n);
  });

  it("n'a pas d'échéance si les conditions sont invalides", () => {
    expect(computeTotals(draft({ paymentTermsDays: 'abc' })).dueDate).toBeNull();
    expect(computeTotals(draft({ paymentTermsDays: '400' })).dueDate).toBeNull();
  });
});

describe('validation', () => {
  it('accepte une facture valide', () => {
    expect(validateDraft(draft())).toEqual({});
  });

  it('signale chaque champ en erreur', () => {
    const errors = validateDraft(
      draft({
        invoiceNumber: '',
        paymentTermsDays: '400',
        clientName: ' ',
        lines: [{ id: 'a', description: '', quantity: '0', unit: '', unitPrice: '1,234' }],
      }),
    );
    expect(Object.keys(errors).sort()).toEqual(
      [
        'clientName',
        'invoiceNumber',
        'lines.0.description',
        'lines.0.quantity',
        'lines.0.unitPrice',
        'paymentTermsDays',
      ].sort(),
    );
  });

  it('refuse un numéro mal formé et trop de lignes', () => {
    expect(validateDraft(draft({ invoiceNumber: '../x' }))['invoiceNumber']).toBeDefined();
    const many = Array.from({ length: 101 }, (_, i) => ({
      id: String(i),
      description: 'x',
      quantity: '1',
      unit: '',
      unitPrice: '1',
    }));
    expect(validateDraft(draft({ lines: many }))['lines']).toBeDefined();
    expect(validateDraft(draft({ lines: [] }))['lines']).toBeDefined();
  });

  it("limite l'adresse à 5 lignes", () => {
    expect(validateDraft(draft({ clientAddress: 'a\nb\nc\nd\ne\nf' }))['clientAddress']).toBeDefined();
  });

  it('refuse les caractères de contrôle', () => {
    expect(validateDraft(draft({ clientName: 'A\u0007B' }))['clientName']).toBeDefined();
    expect(validateDraft(draft({ notes: 'ligne 1\nligne 2' }))).toEqual({});
  });

  it('le brouillon vide est invalide', () => {
    expect(Object.keys(validateDraft(emptyDraft('2026-11-26')))).toContain('invoiceNumber');
  });
});

describe("contenu envoyé à l'API", () => {
  it('ne contient aucun champ calculé', () => {
    const payload = toPayload(draft({ notes: '  ' }));
    expect(payload).toEqual({
      invoiceNumber: '558-00178',
      invoiceDate: '2026-11-26',
      paymentTermsDays: 14,
      client: { name: 'Client SAS', addressLines: ['5 avenue du Client', '69001 Lyon'] },
      lines: [
        { description: 'Développement', quantity: 5, unit: 'jour', unitPrice: 250 },
        { description: 'Frais', quantity: 1, unit: null, unitPrice: 0.5 },
      ],
      notes: null,
    });
  });

  it('traduit les chemins d’erreur du serveur', () => {
    expect(serverFieldToFormKey('lines[3].unitPrice')).toBe('lines.3.unitPrice');
    expect(serverFieldToFormKey('client.name')).toBe('clientName');
    expect(serverFieldToFormKey('client.addressLines[2]')).toBe('clientAddress');
    expect(serverFieldToFormKey('invoiceNumber')).toBe('invoiceNumber');
  });
});
