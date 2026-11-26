/**
 * Calculs décimaux exacts sans flottants : les valeurs sont manipulées en entiers (BigInt)
 * à échelle fixe, avec arrondi HALF_UP à 2 décimales, comme le backend (BigDecimal).
 */

export const QUANTITY_SCALE = 3;
export const PRICE_SCALE = 2;

const DECIMAL_INPUT = /^\s*(\d+)(?:[.,](\d*))?\s*$/;

/** "1,5" -> 1500n à l'échelle 3. Renvoie null si la saisie n'est pas un décimal positif ou si elle dépasse l'échelle. */
export function parseScaled(input: string, scale: number): bigint | null {
  const match = DECIMAL_INPUT.exec(input);
  if (!match) return null;
  const integer = match[1] ?? '0';
  const fraction = match[2] ?? '';
  if (fraction.length > scale) return null;
  return BigInt(integer + fraction.padEnd(scale, '0'));
}

/** Montant en centimes = arrondi HALF_UP(quantité x prix) à 2 décimales. */
export function lineAmountCents(quantity: bigint, unitPriceCents: bigint): bigint {
  const product = quantity * unitPriceCents; // échelle QUANTITY_SCALE + PRICE_SCALE
  const divisor = 10n ** BigInt(QUANTITY_SCALE);
  return (product + divisor / 2n) / divisor;
}

/** Centimes vers chaîne décimale "1234.50" (pour l'API). */
export function centsToDecimalString(cents: bigint): string {
  const negative = cents < 0n;
  const abs = negative ? -cents : cents;
  const units = abs / 100n;
  const rest = (abs % 100n).toString().padStart(2, '0');
  return `${negative ? '-' : ''}${units}.${rest}`;
}

/** Valeur à l'échelle donnée vers chaîne décimale normalisée ("1.5", "2"). */
export function scaledToDecimalString(value: bigint, scale: number): string {
  const divisor = 10n ** BigInt(scale);
  const integer = value / divisor;
  const fraction = (value % divisor).toString().padStart(scale, '0').replace(/0+$/, '');
  return fraction ? `${integer}.${fraction}` : integer.toString();
}
