import { useEffect, useState, type ReactNode } from 'react';
import { fetchSite, type SiteInfo } from '../api/client';
import { Icon } from './Icon';
import { Modal } from './Modal';

export type LegalPage = 'mentions' | 'confidentialite';

interface Props {
  page: LegalPage;
  onClose: () => void;
  onClearIssuer: () => void;
}

const TITLES: Record<LegalPage, string> = {
  mentions: 'Mentions légales',
  confidentialite: 'Confidentialité',
};

function Value({ children }: { children: string | null | undefined }) {
  return children ? <>{children}</> : <span className="legal__missing">À compléter</span>;
}

/** Pages légales du site, dans une fenêtre modale (voir Modal). */
export function LegalDialog({ page, onClose, onClearIssuer }: Props) {
  const [site, setSite] = useState<SiteInfo | null>(null);
  const [cleared, setCleared] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchSite(controller.signal)
      .then(setSite)
      .catch(() => setSite(null));
    return () => controller.abort();
  }, []);

  let body: ReactNode;
  if (page === 'mentions') {
    body = (
      <>
        <h3>Éditeur du site</h3>
        <dl>
          <dt>Nom</dt>
          <dd>
            <Value>{site?.editorName}</Value>
          </dd>
          <dt>Adresse</dt>
          <dd>
            {/* Éditeur non professionnel : l'adresse peut ne pas être publiée si l'identité est
                communiquée à l'hébergeur (le compte Render la porte). */}
            {site?.editorAddress ?? (
              <span className="legal__missing">Non publiée (identité communiquée à l'hébergeur)</span>
            )}
          </dd>
          <dt>Contact</dt>
          <dd>
            <Value>{site?.editorEmail}</Value>
          </dd>
          <dt>Directeur de la publication</dt>
          <dd>
            <Value>{site?.publicationDirector ?? site?.editorName}</Value>
          </dd>
        </dl>
        <h3>Hébergeur</h3>
        <dl>
          <dt>Nom</dt>
          <dd>
            <Value>{site?.hostName}</Value>
          </dd>
          <dt>Adresse</dt>
          <dd>
            <Value>{site?.hostAddress}</Value>
          </dd>
          <dt>Contact</dt>
          <dd>
            <Value>{site?.hostContact}</Value>
          </dd>
        </dl>
        <h3>Logiciel</h3>
        <p>Logiciel libre sous licence MIT. La police des factures, Carlito, est sous licence SIL Open Font License.</p>
      </>
    );
  } else {
    body = (
      <>
        <h3>Les factures ne sont pas conservées</h3>
        <p>
          Les informations saisies sont envoyées au serveur uniquement pour fabriquer le PDF, puis oubliées. Il n'y a
          ni base de données, ni historique, ni copie des factures.
        </p>
        <h3>Vos coordonnées restent dans ce navigateur</h3>
        <p>
          Pour vous éviter de les ressaisir, vos coordonnées d'émetteur sont mémorisées dans le stockage local de ce
          navigateur, sur cet appareil uniquement. Elles ne sont envoyées au serveur qu'au moment de fabriquer un PDF.
        </p>
        <button
          type="button"
          className="button button--secondary"
          onClick={() => {
            onClearIssuer();
            setCleared(true);
          }}
          disabled={cleared}
        >
          <Icon name="trash" size={18} />
          {cleared ? 'Coordonnées effacées' : 'Effacer mes coordonnées mémorisées'}
        </button>
        <h3>Aucun suivi</h3>
        <p>
          Aucun cookie, aucune mesure d'audience, aucun service tiers. Les polices et scripts sont servis par le site. Le
          choix du thème (clair, sombre ou automatique) est gardé dans ce navigateur.
        </p>
        <h3>Journaux techniques</h3>
        <p>
          Pour la sécurité du service, le serveur garde pour une durée limitée l'adresse IP et la date des requêtes,
          jamais le contenu des factures.
        </p>
        <h3>Contact</h3>
        <p>
          Pour toute question sur vos données : <Value>{site?.editorEmail}</Value>
        </p>
      </>
    );
  }

  return (
    <Modal title={TITLES[page]} onClose={onClose}>
      {body}
    </Modal>
  );
}
