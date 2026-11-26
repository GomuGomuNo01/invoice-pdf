import { readFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function fillInvoice(page: Page) {
  await page.getByLabel('Votre nom ou votre entreprise').fill('Atelier Dupont');
  await page.getByLabel('Votre adresse').fill('8 avenue des Lilas\n33000 Bordeaux');
  await page.getByLabel('SIRET').fill('362 521 879 00034');
  await page.getByLabel('Numéro de facture').fill('558-00178');
  await page.getByLabel('Date de la facture').fill('2026-11-26');
  await page.getByLabel('Délai de paiement').fill('14');
  await page.getByLabel('Nom du client').fill('Société Cliente Éàç');
  await page.getByLabel('Adresse du client').fill('5 avenue du Client\n69001 Lyon');
  await page.getByLabel('Description').fill("Développement d'une fonctionnalité");
  await page.getByLabel('Quantité').fill('5');
  await page.getByLabel('Unité').fill('jour');
  await page.getByLabel('Prix unitaire (€)').fill('250');
}

test('saisie, aperçu, génération et téléchargement du PDF', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Nouvelle facture' })).toBeVisible();

  await fillInvoice(page);
  await expect(page.getByText('À payer avant le 10/12/2026').first()).toBeVisible();
  await expect(page.getByTestId('form-total')).toHaveText('1 250,00 €');
  // Sur mobile, l'aperçu est une vue séparée : on l'ouvre.
  const toggle = page.getByRole('button', { name: "Voir l'aperçu" });
  if (await toggle.isVisible()) await toggle.click();
  const preview = page.getByRole('document', { name: 'Aperçu de la facture' });
  await expect(preview).toBeVisible();
  await expect(preview.getByTestId('total-ht')).toHaveText('1 250,00 €');
  await expect(preview.getByTestId('due-date')).toHaveText('10/12/2026');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Télécharger le PDF' }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe('Facture-558-00178.pdf');
  const path = await download.path();
  const content = await readFile(path);
  expect(content.subarray(0, 5).toString()).toBe('%PDF-');
  await expect(page.getByRole('status')).toContainText('PDF téléchargé');
});

test('les erreurs sont annoncées et le focus va sur le résumé', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Télécharger le PDF' }).click();
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('à compléter avant de télécharger le PDF');
  await expect(alert).toBeFocused();
  await alert.getByRole('link', { name: 'Le numéro de facture est obligatoire.' }).click();
  await expect(page.getByLabel('Numéro de facture')).toBeFocused();
});

test('aucune violation d’accessibilité grave', async ({ page }) => {
  await page.goto('/');
  await fillInvoice(page);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious, JSON.stringify(serious.map((v) => ({ id: v.id, nodes: v.nodes.length })), null, 2)).toEqual([]);
});

test('pas de défilement horizontal', async ({ page }) => {
  await page.goto('/');
  await fillInvoice(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('accessibilité en mode sombre, avec erreurs affichées', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Télécharger le PDF' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious, JSON.stringify(serious.map((v) => ({ id: v.id, nodes: v.nodes.length })), null, 2)).toEqual([]);
});
