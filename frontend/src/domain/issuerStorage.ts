import { EMPTY_ISSUER, ISSUER_KEYS, type IssuerDraft } from './invoice';

/**
 * Mémorise l'émetteur dans le navigateur de l'utilisateur (jamais sur le serveur),
 * pour ne pas le ressaisir à chaque facture. Tout accès est protégé : navigation privée
 * ou stockage bloqué ne doivent pas casser l'application.
 */
const KEY = 'invoice-pdf.issuer.v1';

export function loadIssuer(): IssuerDraft | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const record = parsed as Record<string, unknown>;
    const issuer = { ...EMPTY_ISSUER };
    for (const key of ISSUER_KEYS) {
      const value = record[key];
      if (typeof value === 'string') issuer[key] = value.slice(0, 1000);
    }
    return issuer;
  } catch {
    return null;
  }
}

export function saveIssuer(issuer: IssuerDraft): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(issuer));
  } catch {
    // Stockage indisponible : l'émetteur sera simplement à ressaisir.
  }
}

export function clearIssuer(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Rien à faire.
  }
}
