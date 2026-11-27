import { defineConfig } from '@playwright/test';
import base from './playwright.config';

/**
 * Regénère les captures d'écran du dépôt (dossier captures/ à la racine) : npm run captures.
 * Même démarrage des serveurs que les tests de bout en bout ; un seul navigateur, réglages fixés dans le test.
 */
export default defineConfig({
  ...base,
  testIgnore: undefined,
  testMatch: '**/captures.spec.ts',
  retries: 0,
  reporter: 'list',
  projects: [{ name: 'captures', use: { browserName: 'chromium', locale: 'fr-FR' } }],
});
