import type { InvoicePayload } from '../domain/invoice';

export interface Issuer {
  name: string | null;
  addressLines: string[];
  siret: string | null;
  email: string | null;
  phone: string | null;
  iban: string | null;
}

export interface ServerFieldError {
  field: string;
  message: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors: ServerFieldError[];

  constructor(status: number, message: string, fieldErrors: ServerFieldError[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

const API = '/api/v1';

export async function fetchIssuer(signal?: AbortSignal): Promise<Issuer> {
  const response = await fetch(`${API}/issuer`, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) throw new ApiError(response.status, "Impossible de charger l'émetteur.");
  return (await response.json()) as Issuer;
}

interface Problem {
  title?: string;
  detail?: string;
  errors?: ServerFieldError[];
}

function messageForStatus(status: number, problem: Problem | null): string {
  if (status === 429) return 'Trop de générations en peu de temps. Réessayer dans une minute.';
  if (status === 413) return 'La facture est trop volumineuse.';
  if (status >= 500) return 'Le serveur a rencontré une erreur. Réessayer plus tard.';
  return problem?.detail ?? 'La facture contient des erreurs.';
}

/** Génère le PDF côté serveur et renvoie le fichier. */
export async function generatePdf(payload: InvoicePayload): Promise<Blob> {
  let response: Response;
  try {
    response = await fetch(`${API}/invoices/pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/pdf, application/problem+json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new ApiError(0, 'Serveur injoignable. Vérifier que le backend est démarré.');
  }

  if (!response.ok) {
    let problem: Problem | null = null;
    try {
      problem = (await response.json()) as Problem;
    } catch {
      problem = null;
    }
    throw new ApiError(response.status, messageForStatus(response.status, problem), problem?.errors ?? []);
  }
  return response.blob();
}

/** Déclenche le téléchargement d'un fichier dans le navigateur. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
