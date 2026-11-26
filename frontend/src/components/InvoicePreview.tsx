import type { Issuer } from '../api/client';
import { addressLines, type InvoiceDraft, type Totals } from '../domain/invoice';
import { formatDate, formatMoney, formatQuantity } from '../domain/format';

interface Props {
  draft: InvoiceDraft;
  totals: Totals;
  issuer: Issuer | null;
}

const PLACEHOLDER = '-';

/**
 * Aperçu HTML fidèle au gabarit PDF (mêmes tokens, même structure).
 * Le PDF reste la référence : pagination et coupures de page sont calculées par le serveur.
 */
export function InvoicePreview({ draft, totals, issuer }: Props) {
  const client = addressLines(draft.clientAddress);
  const terms = draft.paymentTermsDays.trim();

  return (
    <div className="sheet" aria-label="Aperçu de la facture" role="document">
      <p className="sheet__page">Page 1 sur 1</p>

      <div className="sheet__issuer">
        <p className="sheet__issuer-name">{issuer?.name ?? "Nom de l'entreprise"}</p>
        {(issuer?.addressLines ?? []).map((line, index) => (
          <p key={index}>{line}</p>
        ))}
        {issuer?.siret ? <p className="sheet__issuer-extra">SIRET : {issuer.siret}</p> : null}
        {issuer?.email || issuer?.phone ? (
          <p className="sheet__issuer-extra">{[issuer.email, issuer.phone].filter(Boolean).join(' - ')}</p>
        ) : null}
      </div>

      <div className="sheet__row">
        <div className="sheet__client">
          <p className="sheet__client-name">{draft.clientName.trim() || 'Nom du client'}</p>
          {client.map((line, index) => (
            <p key={index}>{line}</p>
          ))}
        </div>

        <table className="sheet__box">
          <tbody>
            <tr>
              <th className="sheet__band" colSpan={2} scope="colgroup">
                FACTURE
              </th>
            </tr>
            <tr>
              <th scope="row">Date de facture</th>
              <td>{draft.invoiceDate ? formatDate(draft.invoiceDate) : PLACEHOLDER}</td>
            </tr>
            <tr>
              <th scope="row">Numéro de facture</th>
              <td>{draft.invoiceNumber.trim() || PLACEHOLDER}</td>
            </tr>
            <tr>
              <th scope="row">Conditions de paiement</th>
              <td>{terms ? `${terms} jours` : PLACEHOLDER}</td>
            </tr>
            <tr>
              <th scope="row">Date d'échéance</th>
              <td data-testid="due-date">{totals.dueDate ? formatDate(totals.dueDate) : PLACEHOLDER}</td>
            </tr>
            <tr className="sheet__due">
              <th scope="row">Total à payer</th>
              <td data-testid="total-due">{formatMoney(totals.totalCents)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <table className="sheet__lines">
        <thead>
          <tr>
            <th scope="col" className="desc">
              Description
            </th>
            <th scope="col" className="num">
              Quantité
            </th>
            <th scope="col" className="unit">
              Unité
            </th>
            <th scope="col" className="num">
              Prix
            </th>
            <th scope="col" className="num">
              Montant
            </th>
          </tr>
        </thead>
        <tbody>
          {draft.lines.map((line, index) => {
            const computed = totals.lines[index];
            return (
              <tr key={line.id}>
                <td className="desc">{line.description.trim() || PLACEHOLDER}</td>
                <td className="num">{computed?.quantity != null ? formatQuantity(computed.quantity) : PLACEHOLDER}</td>
                <td className="unit">{line.unit.trim()}</td>
                <td className="num">
                  {computed?.unitPriceCents != null ? formatMoney(computed.unitPriceCents) : PLACEHOLDER}
                </td>
                <td className="num" data-testid={`amount-${index}`}>
                  {computed?.amountCents != null ? formatMoney(computed.amountCents) : PLACEHOLDER}
                </td>
              </tr>
            );
          })}
          <tr className="sheet__total">
            <td className="empty" colSpan={3} />
            <th scope="row">TOTAL HT</th>
            <td className="num" data-testid="total-ht">
              {formatMoney(totals.totalCents)}
            </td>
          </tr>
        </tbody>
      </table>

      <div className="sheet__footer">
        <p className="sheet__footer-title">Conditions de paiement et mentions particulières :</p>
        {draft.notes.trim() ? <p className="sheet__notes">{draft.notes.trim()}</p> : null}
        <p>TVA non applicable, article 293B du code général des impôts</p>
        {issuer?.iban ? <p>IBAN : {issuer.iban}</p> : null}
      </div>
    </div>
  );
}
