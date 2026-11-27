/**
 * Thème de l'interface : "system" (réglage de l'appareil, par défaut), "light" ou "dark".
 * Le choix est gardé dans ce navigateur. public/theme-init.js applique la même clé avant l'affichage
 * pour éviter un éclair de la mauvaise couleur au chargement.
 */
export type ThemeChoice = 'system' | 'light' | 'dark';

export const THEME_KEY = 'invoice-pdf.theme';
const ORDER: ThemeChoice[] = ['system', 'light', 'dark'];

export function loadTheme(): ThemeChoice {
  try {
    const value = window.localStorage.getItem(THEME_KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

export function saveTheme(choice: ThemeChoice): void {
  try {
    if (choice === 'system') window.localStorage.removeItem(THEME_KEY);
    else window.localStorage.setItem(THEME_KEY, choice);
  } catch {
    // Stockage indisponible : le choix vaut pour cette visite seulement.
  }
}

/** Pose (ou retire) l'attribut data-theme sur <html> : les couleurs suivent (styles/tokens.css). */
export function applyTheme(choice: ThemeChoice, root: HTMLElement = document.documentElement): void {
  if (choice === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', choice);
}

export function nextTheme(choice: ThemeChoice): ThemeChoice {
  return ORDER[(ORDER.indexOf(choice) + 1) % ORDER.length] ?? 'system';
}

export const THEME_LABELS: Record<ThemeChoice, string> = {
  system: 'Automatique',
  light: 'Clair',
  dark: 'Sombre',
};
