import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { NBSP } from './domain/format';

const issuer = {
  name: 'Atelier Exemple',
  addressLines: ['12 rue des Tests', '75011 Paris'],
  siret: null,
  email: null,
  phone: null,
  iban: null,
};

function jsonResponse(body: unknown, status = 200, contentType = 'application/json'): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': contentType } });
}

const site = {
  editorName: 'Atelier Éditeur',
  editorAddress: null,
  editorEmail: 'contact@atelier.example',
  publicationDirector: null,
  hostName: 'Hébergeur Exemple',
  hostAddress: null,
  hostContact: null,
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  window.localStorage.clear();
  fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/api/v1/issuer')) return jsonResponse(issuer);
    if (url.endsWith('/api/v1/site')) return jsonResponse(site);
    return new Response(new Blob(['%PDF-1.7'], { type: 'application/pdf' }), {
      status: 200,
      headers: { 'Content-Type': 'application/pdf' },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  URL.createObjectURL = vi.fn(() => 'blob:facture');
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function fillValidInvoice(user: ReturnType<typeof userEvent.setup>) {
  // L'émetteur est prérempli depuis la configuration du serveur (premier usage).
  await screen.findByDisplayValue('Atelier Exemple');
  await user.type(screen.getByLabelText(/Numéro de facture/), '558-00178');
  const date = screen.getByLabelText(/Date de la facture/);
  await user.clear(date);
  await user.type(date, '2026-11-26');
  await user.type(screen.getByLabelText(/Nom du client/), 'Société Cliente');
  await user.type(screen.getByLabelText(/Adresse du client/), '5 avenue du Client{enter}69001 Lyon');
  await user.type(screen.getByLabelText(/Description/), 'Développement');
  const quantity = screen.getByLabelText(/Quantité/);
  await user.clear(quantity);
  await user.type(quantity, '1,5');
  await user.type(screen.getByLabelText(/Prix unitaire/), '10,01');
}

describe('parcours de saisie', () => {
  it("affiche l'émetteur et calcule en direct montants, total et échéance", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByText('Atelier Exemple')).toBeInTheDocument();

    await fillValidInvoice(user);

    expect(screen.getByTestId('amount-0').textContent).toBe(`15,02${NBSP}€`);
    expect(screen.getByTestId('total-ht').textContent).toBe(`15,02${NBSP}€`);
    expect(screen.getByTestId('total-due').textContent).toBe(`15,02${NBSP}€`);
    expect(screen.getByTestId('due-date')).toHaveTextContent('10/12/2026');
    expect(screen.getAllByText('À payer avant le 10/12/2026').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Ajouter une ligne' }));
    const descriptions = screen.getAllByLabelText(/Description/);
    await user.type(descriptions[1]!, 'Frais');
    await user.type(screen.getAllByLabelText(/Prix unitaire/)[1]!, '0,5');
    expect(screen.getByTestId('form-total').textContent).toBe(`15,52${NBSP}€`);
  });

  it('génère et télécharge le PDF avec un contenu sans champ calculé', async () => {
    const user = userEvent.setup();
    render(<App />);
    await fillValidInvoice(user);

    await user.click(screen.getByRole('button', { name: 'Télécharger le PDF' }));

    expect(await screen.findByText('PDF téléchargé : Facture-558-00178.pdf')).toBeInTheDocument();
    const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/api/v1/invoices/pdf'));
    expect(call).toBeDefined();
    const body = JSON.parse(String((call![1] as RequestInit).body));
    expect(body).toEqual({
      invoiceNumber: '558-00178',
      invoiceDate: '2026-11-26',
      paymentTermsDays: 14,
      client: { name: 'Société Cliente', addressLines: ['5 avenue du Client', '69001 Lyon'] },
      lines: [{ description: 'Développement', quantity: 1.5, unit: null, unitPrice: 10.01 }],
      notes: null,
      issuer: {
        name: 'Atelier Exemple',
        addressLines: ['12 rue des Tests', '75011 Paris'],
        siret: null,
        email: null,
        phone: null,
        iban: null,
      },
    });
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
  });

  it("mémorise l'émetteur saisi pour la facture suivante", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    const name = await screen.findByDisplayValue('Atelier Exemple');
    await user.clear(name);
    await user.type(name, 'Mon Atelier');
    await user.type(screen.getByLabelText(/SIRET/), '362 521 879 00034');
    unmount();

    render(<App />);
    expect(screen.getByLabelText(/Votre nom ou votre entreprise/)).toHaveValue('Mon Atelier');
    expect(screen.getByLabelText(/SIRET/)).toHaveValue('362 521 879 00034');
    // L'émetteur mémorisé n'est pas écrasé par la configuration du serveur.
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/api/v1/issuer'))).toHaveLength(1);
  });

  it("signale un SIRET mal saisi sur le champ de l'émetteur", async () => {
    const user = userEvent.setup();
    render(<App />);
    await fillValidInvoice(user);
    await user.type(screen.getByLabelText(/SIRET/), '12');
    await user.click(screen.getByRole('button', { name: 'Télécharger le PDF' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Le SIRET compte 14 chiffres');
    expect(screen.getByLabelText(/SIRET/)).toHaveAttribute('aria-invalid', 'true');
  });

  it("bloque l'envoi et liste les erreurs si le formulaire est invalide", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Télécharger le PDF' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Il reste');
    expect(alert).toHaveTextContent('à compléter avant de télécharger le PDF');
    expect(within(alert).getByText('Le numéro de facture est obligatoire.')).toBeInTheDocument();
    expect(screen.getByLabelText(/Numéro de facture/)).toHaveAttribute('aria-invalid', 'true');
    await waitFor(() => expect(alert).toHaveFocus());
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/invoices/pdf'))).toBe(false);
  });

  it('affiche les erreurs renvoyées par le serveur sur les champs', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/api/v1/issuer')) return jsonResponse(issuer);
      return jsonResponse(
        {
          title: 'Requête invalide',
          detail: 'La facture contient des erreurs.',
          errors: [{ field: 'lines[0].unitPrice', message: 'Le prix unitaire est trop élevé.' }],
        },
        400,
        'application/problem+json',
      );
    });
    const user = userEvent.setup();
    render(<App />);
    await fillValidInvoice(user);
    await user.click(screen.getByRole('button', { name: 'Télécharger le PDF' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('La facture contient des erreurs.');
    expect(screen.getByLabelText(/Prix unitaire/)).toHaveAttribute('aria-invalid', 'true');
  });

  it('signale un serveur injoignable', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/api/v1/issuer')) return jsonResponse(issuer);
      throw new TypeError('Failed to fetch');
    });
    const user = userEvent.setup();
    render(<App />);
    await fillValidInvoice(user);
    await user.click(screen.getByRole('button', { name: 'Télécharger le PDF' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Serveur injoignable');
  });

  it('réordonne et supprime des lignes', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByLabelText(/Description/), 'Première');
    await user.click(screen.getByRole('button', { name: 'Ajouter une ligne' }));
    await user.type(screen.getAllByLabelText(/Description/)[1]!, 'Seconde');

    expect(screen.queryByRole('button', { name: 'Monter la ligne 2' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Déplacer la ligne 2' }));
    await user.click(screen.getByRole('button', { name: 'Monter la ligne 2' }));
    expect(screen.queryByRole('button', { name: 'Monter la ligne 2' })).not.toBeInTheDocument();
    expect(screen.getAllByLabelText(/Description/).map((el) => (el as HTMLTextAreaElement).value)).toEqual([
      'Seconde',
      'Première',
    ]);

    await user.click(screen.getByRole('button', { name: 'Supprimer la ligne 1' }));
    expect(screen.getAllByLabelText(/Description/)).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Supprimer la ligne 1' })).toBeDisabled();
  });

  it("n'affiche pas d'erreur avant une tentative ni sur un champ seulement traversé", async () => {
    const user = userEvent.setup();
    render(<App />);
    const number = screen.getByLabelText(/Numéro de facture/);
    await user.click(number);
    await user.tab();
    expect(number).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByText('Le numéro de facture est obligatoire.')).not.toBeInTheDocument();

    await user.type(number, '../x');
    expect(number).not.toHaveAttribute('aria-invalid');
    await user.tab();
    expect(number).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    await user.clear(number);
    await user.type(number, '2026-001');
    expect(number).not.toHaveAttribute('aria-invalid');
  });

  it('le résumé se met à jour pendant la correction', async () => {
    const user = userEvent.setup();
    render(<App />);
    await fillValidInvoice(user);
    await user.clear(screen.getByLabelText(/Nom du client/));
    await user.click(screen.getByRole('button', { name: 'Télécharger le PDF' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Il reste 1 point à compléter');
    await user.type(screen.getByLabelText(/Nom du client/), 'Client');
    expect(alert).toHaveTextContent('Tout est complet');
  });

  it('affiche les mentions légales et se ferme au clavier', async () => {
    const user = userEvent.setup();
    render(<App />);
    const lien = screen.getByRole('button', { name: 'Mentions légales' });
    await user.click(lien);

    const fenetre = screen.getByRole('dialog', { name: 'Mentions légales' });
    // Éditeur, et directeur de la publication par défaut.
    expect(await within(fenetre).findAllByText('Atelier Éditeur')).toHaveLength(2);
    expect(within(fenetre).getByText('Hébergeur Exemple')).toBeInTheDocument();
    expect(within(fenetre).getAllByText('À compléter').length).toBeGreaterThan(0);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(lien).toHaveFocus();
  });

  it('efface les coordonnées mémorisées depuis la page de confidentialité', async () => {
    const user = userEvent.setup();
    render(<App />);
    const nom = await screen.findByDisplayValue('Atelier Exemple');
    await user.type(nom, ' et fils');
    expect(window.localStorage.length).toBe(1);

    await user.click(screen.getByRole('button', { name: 'Confidentialité' }));
    const fenetre = screen.getByRole('dialog', { name: 'Confidentialité' });
    await user.click(within(fenetre).getByRole('button', { name: 'Effacer mes coordonnées mémorisées' }));

    expect(within(fenetre).getByRole('button', { name: 'Coordonnées effacées' })).toBeDisabled();
    expect(screen.getByLabelText(/Votre nom ou votre entreprise/)).toHaveValue('');
    expect(window.localStorage.length).toBe(0);
  });
});
