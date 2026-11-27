import { useEffect, useRef, useState, type ReactNode } from 'react';
import { fetchSite, type SiteInfo } from '../api/client';
import { Icon } from './Icon';

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

/**
 * Fenêtre modale des pages légales. Le focus y est placé à l'ouverture, Échap la ferme,
 * et le focus revient ensuite sur le lien qui l'a ouverte.
 */
export function LegalDialog({ page, onClose, onClearIssuer }: Props) {
  const [site, setSite] = useState<SiteInfo | null>(null);
  const [cleared, setCleared] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    titleRef.current?.focus();
    return () => previous?.focus();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchSite(controller.signal)
      .then(setSite)
      .catch(() => setSite(null));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
      // Le focus reste dans la fenêtre (Tab et Maj+Tab bouclent).
      if (event.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>('button, a[href], [tabindex="0"]');
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

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
            <Value>{site?.editorAddress}</Value>
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
        <p>Aucun cookie, aucune mesure d'audience, aucun service tiers. Les polices et scripts sont servis par le site.</p>
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
    // Clic sur le fond : confort à la souris. Au clavier, Échap et le bouton Fermer font la même chose.
    <div
      className="legal-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div ref={dialogRef} className="legal" role="dialog" aria-modal="true" aria-labelledby="legal-title">
        <div className="legal__head">
          <h2 id="legal-title" ref={titleRef} tabIndex={-1}>
            {TITLES[page]}
          </h2>
          <button type="button" className="button button--quiet button--small" onClick={onClose}>
            Fermer
          </button>
        </div>
        <div className="legal__body">{body}</div>
      </div>
    </div>
  );
}
