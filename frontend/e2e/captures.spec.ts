import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

/**
 * Captures d'écran du dépôt (README), avec des données fictives : npm run captures.
 * Résultat dans captures/ à la racine du dépôt.
 */
const DOSSIER = path.resolve(process.cwd(), '..', 'captures');

test.beforeAll(async () => {
  await mkdir(DOSSIER, { recursive: true });
});

const BUREAU = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

async function ouvrir(page: Page, theme: 'light' | 'dark') {
  // Thème choisi dans l'application (même clé que src/domain/theme.ts) et thème de l'appareil assorti.
  await page.addInitScript((choix) => window.localStorage.setItem('invoice-pdf.theme', choix), theme);
  await page.emulateMedia({ colorScheme: theme });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Nouvelle facture' })).toBeVisible();
}

async function remplir(page: Page) {
  await page.getByLabel('Votre nom ou votre entreprise').fill('Atelier Dupont Électricité');
  await page.getByLabel('Votre adresse').fill('8 avenue des Lilas\n33000 Bordeaux');
  await page.getByLabel('SIRET').fill('362 521 879 00034');
  await page.getByLabel('IBAN').fill('FR76 3000 6000 0112 3456 7890 189');
  await page.getByLabel('E-mail').fill('contact@atelier-dupont.fr');
  await page.getByLabel('Nom du client').fill('Boulangerie Martin');
  await page.getByLabel('Adresse du client').fill('12 rue de la Paix\n75002 Paris');
  await page.getByLabel('Numéro de facture').fill('2026-042');
  await page.getByLabel('Date de la facture').fill('2026-11-27');
  await page.getByLabel('Description').fill('Mise aux normes du tableau électrique');
  await page.getByLabel('Quantité').fill('1');
  await page.getByLabel('Unité (facultatif)').fill('forfait');
  await page.getByLabel('Prix unitaire').fill('850');
  await page.getByRole('button', { name: 'Ajouter une ligne' }).click();
  await page.getByLabel('Description').nth(1).fill('Câble électrique 2,5 mm²');
  await page.getByLabel('Quantité').nth(1).fill('20');
  await page.getByLabel('Unité (facultatif)').nth(1).fill('mètre');
  await page.getByLabel('Prix unitaire').nth(1).fill('7,50');
  await page.getByLabel('Mentions particulières').fill('Paiement par virement bancaire.');
}

for (const theme of ['light', 'dark'] as const) {
  const nom = theme === 'light' ? 'clair' : 'sombre';

  test(`bureau, thème ${nom}`, async ({ page }) => {
    await page.setViewportSize(BUREAU);
    await ouvrir(page, theme);
    await remplir(page);
    // Haut de page : barre avec le thème et « Recommencer », début du formulaire, aperçu.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.mouse.move(0, 0);
    await page.screenshot({ path: path.join(DOSSIER, `bureau-${nom}.png`) });
  });

  test(`mobile, thème ${nom}`, async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await ouvrir(page, theme);
    await remplir(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(DOSSIER, `mobile-formulaire-${nom}.png`) });
    await page.getByRole('button', { name: "Voir l'aperçu" }).click();
    await page.screenshot({ path: path.join(DOSSIER, `mobile-apercu-${nom}.png`) });
  });
}

test('confirmation de « Recommencer »', async ({ page }) => {
  await page.setViewportSize(BUREAU);
  await ouvrir(page, 'light');
  await remplir(page);
  await page.getByRole('button', { name: 'Recommencer' }).click();
  await expect(page.getByRole('dialog', { name: 'Recommencer' })).toBeVisible();
  await page.screenshot({ path: path.join(DOSSIER, 'recommencer.png') });
});

test('erreurs de saisie', async ({ page }) => {
  await page.setViewportSize(BUREAU);
  await ouvrir(page, 'light');
  await page.getByRole('button', { name: 'Télécharger le PDF' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(DOSSIER, 'erreurs.png') });
});

test('PDF généré', async ({ page }) => {
  await page.setViewportSize(BUREAU);
  await ouvrir(page, 'light');
  await remplir(page);
  const telechargement = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Télécharger le PDF' }).click();
  await (await telechargement).saveAs(path.join(DOSSIER, 'facture-exemple.pdf'));
});
