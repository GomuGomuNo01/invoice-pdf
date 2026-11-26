import { QUANTITY_SCALE } from './decimal';

/** Espace insécable U+00A0, identique au PDF. */
export const NBSP = ' ';

function groupThousands(integer: string): string {
  return integer.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

/** 125050n -> "1 250,50 €" (espaces insécables). */
export function formatMoney(cents: bigint): string {
  const negative = cents < 0n;
  const abs = negative ? -cents : cents;
  const integer = groupThousands((abs / 100n).toString());
  const fraction = (abs % 100n).toString().padStart(2, '0');
  return `${negative ? '-' : ''}${integer},${fraction}${NBSP}€`;
}

/** 1500n (échelle 3) -> "1,5". */
export function formatQuantity(scaled: bigint): string {
  const divisor = 10n ** BigInt(QUANTITY_SCALE);
  const integer = groupThousands((scaled / divisor).toString());
  const fraction = (scaled % divisor).toString().padStart(QUANTITY_SCALE, '0').replace(/0+$/, '');
  return fraction ? `${integer},${fraction}` : integer;
}

/** "2026-11-26" -> "26/11/2026". */
export function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

/** Date ISO + n jours, calculée en UTC pour éviter les effets de fuseau et d'heure d'été. */
export function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

/** Date du jour au format ISO, dans le fuseau local de l'utilisateur. */
export function todayIso(now: Date = new Date()): string {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

/** Nom du fichier, identique à celui du serveur. */
export function pdfFileName(invoiceNumber: string): string {
  return `Facture-${invoiceNumber.trim().replace(/[^A-Za-z0-9_.-]/g, '-')}.pdf`;
}
