import { useEffect, useState } from 'react';
import { applyTheme, loadTheme, nextTheme, saveTheme, THEME_LABELS, type ThemeChoice } from '../domain/theme';
import { Icon, type IconName } from './Icon';

const ICONS: Record<ThemeChoice, IconName> = {
  system: 'monitor',
  light: 'sun',
  dark: 'moon',
};

/**
 * Bouton de thème : Automatique (appareil) -> Clair -> Sombre -> Automatique.
 * Le nom accessible annonce le thème actuel et l'action.
 */
export function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice>(loadTheme);

  useEffect(() => {
    applyTheme(choice);
    saveTheme(choice);
  }, [choice]);

  const label = THEME_LABELS[choice];
  return (
    <button
      type="button"
      className="button button--quiet button--small theme-toggle"
      onClick={() => setChoice(nextTheme)}
      aria-label={`Thème : ${label}. Changer de thème`}
      title={`Thème : ${label} (cliquer pour changer)`}
    >
      <Icon name={ICONS[choice]} size={18} />
      <span className="theme-toggle__label">{label}</span>
    </button>
  );
}
