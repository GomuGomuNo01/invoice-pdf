# invoice-pdf

Application web de génération de factures PDF. L'utilisateur saisit la facture dans un formulaire, voit un aperçu calculé en direct, puis télécharge un PDF au visuel fixe.

- Montants calculés par le serveur en décimal exact (BigDecimal, arrondi HALF_UP à 2 décimales).
- Mention "TVA non applicable, article 293B du code général des impôts".
- EUR, français. L'émetteur (vos coordonnées) se saisit dans le formulaire et reste mémorisé dans le navigateur ; le fichier `.env` peut fournir des valeurs par défaut.
- Aucune donnée conservée : l'application est sans état et sans base de données.

## Pile

| Partie | Technologies |
|---|---|
| Backend | Java 21, Spring Boot 4.1, Thymeleaf, OpenHTMLToPDF (PDFBox 3), springdoc |
| Frontend | React 19, TypeScript 5.9, Vite 8, Zod 4, Vitest, Playwright |
| Police du PDF | Carlito (licence OFL, métriquement compatible avec Calibri), embarquée |

## Démarrage local

Prérequis : Java 21 et Node 24. Maven est fourni par le wrapper (`mvnw`).

1. Configuration de l'émetteur :
   ```
   cp .env.example .env
   ```
   puis renseigner les valeurs dans `.env` (fichier jamais versionné, lu en UTF-8).

2. Activer les garde-fous Git (une fois par clone) :
   ```
   git config core.hooksPath .githooks
   ```

3. Backend (port 8080) :
   ```
   cd backend
   ./mvnw spring-boot:run
   ```
   Sous Windows : `.\mvnw.cmd spring-boot:run`.

4. Frontend (port 5173, appels `/api` relayés vers le backend) :
   ```
   cd frontend
   npm install
   npm run dev
   ```

Ouvrir http://localhost:5173.

Documentation de l'API : http://localhost:8080/api/docs (désactivable par `INVOICE_SWAGGER_UI_ENABLED=false`).

### Avec Docker

```
docker compose up --build
```

Puis ouvrir http://localhost:8081.

## API

`POST /api/v1/invoices/pdf` (JSON) renvoie `application/pdf` en pièce jointe `Facture-<numéro>.pdf`.

```json
{
  "invoiceNumber": "558-00178",
  "invoiceDate": "2026-11-26",
  "paymentTermsDays": 14,
  "client": { "name": "Client SAS", "addressLines": ["5 avenue du Client", "69001 Lyon"] },
  "lines": [
    { "description": "Développement", "quantity": 5, "unit": "jour", "unitPrice": 250.00 }
  ],
  "notes": null,
  "issuer": {
    "name": "Atelier Dupont",
    "addressLines": ["8 avenue des Lilas", "33000 Bordeaux"],
    "siret": "362 521 879 00034",
    "email": null,
    "phone": null,
    "iban": null
  }
}
```

Le bloc `issuer` est facultatif : s'il est absent, l'émetteur de la configuration (`.env`) est utilisé.

Les montants de ligne, le total HT, le total à payer et la date d'échéance sont toujours calculés par le serveur. Tout champ inconnu est refusé. Les erreurs suivent le format `application/problem+json` (RFC 9457) avec la liste `errors` des champs invalides.

`GET /api/v1/issuer` renvoie l'émetteur configuré, utilisé pour préremplir le formulaire au premier usage.

### Règles de validation

| Champ | Règle |
|---|---|
| Numéro | 1 à 30 caractères : lettres, chiffres, `-` `/` `_` `.` |
| Conditions de paiement | 0 à 365 jours |
| Lignes | 1 à 100 |
| Quantité | strictement positive, 3 décimales au plus |
| Prix unitaire | positif ou nul, 2 décimales au plus |
| Textes | longueurs bornées, caractères de contrôle refusés |

## Tests

```
cd backend && ./mvnw verify        # calculs, formats, API, contenu et pagination du PDF
cd frontend && npm test            # calculs, validation, parcours du formulaire
cd frontend && npm run lint        # ESLint (dont accessibilité jsx-a11y)
cd frontend && npm run test:e2e    # Playwright : parcours complet, accessibilité, mobile
```

Les tests backend écrivent des PDF d'exemple dans `backend/target/pdf-output/` pour le contrôle visuel.

## Sécurité

- Données saisies échappées dans le gabarit, aucune ressource externe chargée pendant le rendu PDF.
- Validation stricte côté serveur, corps limité à 256 Ko, limitation de débit par IP sur la génération.
- En-têtes de sécurité HTTP, CORS restreint, aucune trace d'erreur renvoyée au client.
- Aucun contenu de facture dans les journaux (identifiants techniques uniquement).
- Hook `pre-commit` et CI : refus des fichiers internes, des tirets longs et des secrets (gitleaks).

## Licence

MIT. La police Carlito est distribuée sous licence SIL Open Font License (`backend/src/main/resources/fonts/OFL.txt`).
