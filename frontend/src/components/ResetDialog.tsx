import { Icon } from './Icon';
import { Modal } from './Modal';

interface Props {
  /** La facture en cours contient des informations (client, numéro, prestations, mentions). */
  invoiceHasContent: boolean;
  /** Des coordonnées d'émetteur sont saisies ou mémorisées. */
  hasIssuer: boolean;
  onNewInvoice: () => void;
  onClearAll: () => void;
  onClose: () => void;
}

/**
 * Confirmation de « Recommencer », dans l'application (la boîte native window.confirm est bloquée
 * ou supprimée par certains navigateurs intégrés ou mobiles, ce qui rendait le bouton inopérant).
 */
export function ResetDialog({ invoiceHasContent, hasIssuer, onNewInvoice, onClearAll, onClose }: Props) {
  return (
    <Modal title="Recommencer" onClose={onClose} compact>
      <p>
        {invoiceHasContent
          ? 'La facture en cours sera effacée : client, numéro, prestations et mentions.'
          : 'La facture en cours est déjà vide.'}
        {hasIssuer ? ' Vos coordonnées peuvent être gardées pour la prochaine facture.' : ''}
      </p>
      <div className="reset-actions">
        <button type="button" className="button button--primary" onClick={onNewInvoice}>
          <Icon name="refresh" size={18} />
          {hasIssuer ? 'Nouvelle facture (garder mes coordonnées)' : 'Nouvelle facture'}
        </button>
        {hasIssuer ? (
          <button type="button" className="button button--danger" onClick={onClearAll}>
            <Icon name="trash" size={18} />
            Tout effacer, y compris mes coordonnées
          </button>
        ) : null}
        <button type="button" className="button button--quiet" onClick={onClose}>
          Annuler
        </button>
      </div>
    </Modal>
  );
}
