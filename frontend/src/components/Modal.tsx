import { useEffect, useRef, type ReactNode } from 'react';

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Largeur réduite pour une simple confirmation. */
  compact?: boolean;
}

/**
 * Fenêtre modale accessible : focus placé sur le titre à l'ouverture et rendu à l'élément d'origine
 * à la fermeture, focus gardé dans la fenêtre (Tab et Maj+Tab bouclent), Échap ferme.
 * Le clic sur le fond ferme aussi (confort à la souris ; Échap et le bouton Fermer suffisent au clavier).
 */
export function Modal({ title, onClose, children, compact }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    titleRef.current?.focus();
    return () => previous?.focus();
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab' && dialogRef.current) {
        const focusables = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), a[href], input:not([disabled]), [tabindex="0"]',
          ),
        );
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (!first || !last) return;
        const active = document.activeElement as HTMLElement | null;
        // Focus hors de la boucle (titre à l'ouverture, ou ailleurs) : on y revient dans le bon sens.
        if (!active || !focusables.includes(active)) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        } else if (event.shiftKey && active === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="legal-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className={`legal${compact ? ' legal--compact' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="legal__head">
          <h2 id="modal-title" ref={titleRef} tabIndex={-1}>
            {title}
          </h2>
          <button type="button" className="button button--quiet button--small" onClick={onClose}>
            Fermer
          </button>
        </div>
        <div className="legal__body">{children}</div>
      </div>
    </div>
  );
}
