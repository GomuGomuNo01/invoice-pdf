#!/usr/bin/env sh
# Essai de la pile de production (deploy/docker-compose.prod.yml) sur la machine locale :
# Caddy (HTTPS, certificat local pour "localhost") -> nginx -> backend en profil prod.
# Usage : sh scripts/tester-prod.sh (depuis la racine du dépôt, ports 80 et 443 libres).
set -eu

RACINE=$(pwd)
DEPLOY="$RACINE/deploy"
ENV_ESSAI="$DEPLOY/.env.prod"
BASE="https://localhost"
CURL="curl -s -k --connect-timeout 3 --max-time 30"
UTILISATEUR="essai"
MOT_DE_PASSE="mot-de-passe-essai"
ECHEC=0

compose() {
  docker compose -f "$DEPLOY/docker-compose.prod.yml" --env-file "$ENV_ESSAI" --project-directory "$DEPLOY" "$@"
}

nettoyer() {
  if [ "$ECHEC" -ne 0 ]; then
    echo "--- Journaux des conteneurs ---"
    compose logs --no-color --tail=150 || true
  fi
  compose down -v --remove-orphans >/dev/null 2>&1 || true
  rm -f "$ENV_ESSAI"
}

echouer() {
  echo "ECHEC : $1"
  ECHEC=1
  exit 1
}

[ -e "$ENV_ESSAI" ] && { echo "deploy/.env.prod existe déjà : essai annulé pour ne pas l'écraser."; exit 1; }
trap nettoyer EXIT

echo "1. Construction des images"
docker build -q -t invoice-pdf-backend:essai "$RACINE/backend" >/dev/null
docker build -q -t invoice-pdf-frontend:essai "$RACINE/frontend" >/dev/null

echo "2. Configuration d'essai (accès restreint)"
EMPREINTE=$(docker run --rm caddy:2.10-alpine caddy hash-password --plaintext "$MOT_DE_PASSE")
{
  echo "SITE_DOMAIN=localhost"
  echo "BACKEND_IMAGE=invoice-pdf-backend:essai"
  echo "FRONTEND_IMAGE=invoice-pdf-frontend:essai"
  echo "ACCES=restreint"
  echo "BASIC_AUTH_USER=$UTILISATEUR"
  echo "BASIC_AUTH_HASH='$EMPREINTE'"
  echo "INVOICE_SITE_EDITOR_NAME=Éditeur Essai"
} > "$ENV_ESSAI"

echo "3. Démarrage"
compose up -d

echo "4. Santé publique (sans identifiant)"
i=0
until [ "$($CURL --max-time 5 -o /dev/null -w '%{http_code}' "$BASE/sante")" = "200" ]; do
  i=$((i + 1))
  [ "$i" -gt 60 ] && echouer "la pile ne répond pas sur $BASE/sante"
  sleep 2
done
SANTE=$($CURL "$BASE/sante")
[ "$SANTE" = '{"groups":["liveness","readiness"],"status":"UP"}' ] || [ "$SANTE" = '{"status":"UP"}' ] \
  || echouer "réponse de santé inattendue : $SANTE"
echo "   $SANTE"

echo "5. HTTPS, redirection et en-têtes du frontal"
CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "http://localhost/")
[ "$CODE" = "308" ] || [ "$CODE" = "301" ] || echouer "HTTP ne redirige pas vers HTTPS (code $CODE)"
ENTETES=$($CURL -D - -o /dev/null -u "$UTILISATEUR:$MOT_DE_PASSE" "$BASE/")
echo "$ENTETES" | head -1 | grep -q " 200" || echouer "page d'accueil avec identifiant : pas de 200"
echo "$ENTETES" | grep -qi "^strict-transport-security: max-age=31536000" || echouer "HSTS absent"
echo "$ENTETES" | grep -qi "^content-security-policy:" || echouer "CSP absente"
echo "$ENTETES" | grep -qi "^server:" && echouer "en-tête Server exposé"
echo "   OK"

echo "6. Accès restreint"
CODE=$($CURL -o /dev/null -w '%{http_code}' "$BASE/")
[ "$CODE" = "401" ] || echouer "page d'accueil sans identifiant : code $CODE au lieu de 401"
CODE=$($CURL -o /dev/null -w '%{http_code}' -u "$UTILISATEUR:mauvais" "$BASE/api/v1/issuer")
[ "$CODE" = "401" ] || echouer "API avec mauvais mot de passe : code $CODE au lieu de 401"
echo "   OK"

echo "7. Génération d'un PDF à travers Caddy, nginx et le backend"
CODE=$($CURL -o /tmp/facture-prod.pdf -w '%{http_code}' -u "$UTILISATEUR:$MOT_DE_PASSE" \
  -H 'Content-Type: application/json' --data-binary @- "$BASE/api/v1/invoices/pdf" <<'JSON'
{
  "invoiceNumber": "PROD-001",
  "invoiceDate": "2026-11-27",
  "paymentTermsDays": 30,
  "client": { "name": "Client Production", "addressLines": ["1 rue du Test"] },
  "lines": [ { "description": "Essai de production", "quantity": 2, "unit": "jour", "unitPrice": 450 } ],
  "notes": null,
  "issuer": { "name": "Atelier Essai", "addressLines": [], "siret": null, "email": null, "phone": null, "iban": null }
}
JSON
)
[ "$CODE" = "200" ] || echouer "génération du PDF : code $CODE"
[ "$(head -c 5 /tmp/facture-prod.pdf)" = "%PDF-" ] || echouer "la réponse n'est pas un PDF"
echo "   PDF de $(wc -c < /tmp/facture-prod.pdf) octets"

echo "8. Profil de production : pas de documentation d'API, mentions légales configurées"
for chemin in /api/docs /api/v1/openapi.json; do
  CODE=$($CURL -o /dev/null -w '%{http_code}' -u "$UTILISATEUR:$MOT_DE_PASSE" "$BASE$chemin")
  [ "$CODE" = "404" ] || echouer "$chemin accessible en production (code $CODE)"
done
$CURL -u "$UTILISATEUR:$MOT_DE_PASSE" "$BASE/api/v1/site" | grep -q '"editorName":"Éditeur Essai"' \
  || echouer "mentions légales du site non transmises au backend"
echo "   OK"

echo "9. Une adresse X-Forwarded-For inventée par le client ne contourne pas la limite"
SECONDE=$(date -u +%S | sed 's/^0//')
if [ "$SECONDE" -gt 30 ]; then
  echo "   attente du début de la minute suivante ($((61 - SECONDE)) s)"
  sleep $((61 - SECONDE))
fi
n=1
while [ "$n" -le 30 ]; do
  CODE=$($CURL -o /dev/null -w '%{http_code}' -u "$UTILISATEUR:$MOT_DE_PASSE" -H 'Content-Type: application/json' \
    -H "X-Forwarded-For: 198.51.100.$n" -d '{}' "$BASE/api/v1/invoices/pdf")
  [ "$CODE" = "400" ] || echouer "demande $n : code $CODE au lieu de 400"
  n=$((n + 1))
done
CODE=$($CURL -o /dev/null -w '%{http_code}' -u "$UTILISATEUR:$MOT_DE_PASSE" -H 'Content-Type: application/json' \
  -H "X-Forwarded-For: 192.0.2.99" -d '{}' "$BASE/api/v1/invoices/pdf")
[ "$CODE" = "429" ] || echouer "31e demande avec une adresse inventée : code $CODE au lieu de 429 (en-tête du client cru)"
echo "   OK : la limite s'applique à l'adresse réelle"

echo "10. Conteneurs"
for service in frontend backend; do
  UID_SERVICE=$(compose exec -T "$service" id -u)
  [ "$UID_SERVICE" != "0" ] || echouer "le conteneur $service tourne en root"
  echo "   $service : uid $UID_SERVICE"
done
compose exec -T backend sh -c 'touch /app/essai 2>/dev/null' && echouer "le système de fichiers du backend est modifiable"
echo "   backend en lecture seule"

echo "Pile de production : OK"
