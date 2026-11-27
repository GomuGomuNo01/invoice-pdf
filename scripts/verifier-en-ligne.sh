#!/usr/bin/env sh
# Vérification de la version en ligne (après un déploiement).
# Usage : sh scripts/verifier-en-ligne.sh https://invoice-pdf.onrender.com [--limite]
#   --limite : vérifie aussi qu'une adresse inventée ne contourne pas la limite de débit.
#              Envoie 31 demandes : la génération est bloquée une minute pour votre adresse ensuite.
set -eu

BASE="${1:?Usage : sh scripts/verifier-en-ligne.sh https://adresse-du-site [--limite]}"
BASE="${BASE%/}"
OPTION="${2:-}"
CURL="curl -s --connect-timeout 10 --max-time 120"

echouer() {
  echo "ECHEC : $1"
  exit 1
}

echo "1. Santé (le premier appel peut réveiller le service : jusqu'à une minute)"
CODE=$($CURL -o /dev/null -w '%{http_code}' "$BASE/actuator/health")
[ "$CODE" = "200" ] || echouer "santé : code $CODE"
echo "   OK, version en ligne : $($CURL "$BASE/api/v1/version")"

echo "2. HTTPS et en-têtes de sécurité"
case "$BASE" in https://*) ;; *) echouer "l'adresse doit commencer par https://" ;; esac
CODE_HTTP=$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 "http://${BASE#https://}/")
case "$CODE_HTTP" in 301|302|307|308) ;; *) echo "   attention : HTTP ne redirige pas vers HTTPS (code $CODE_HTTP)" ;; esac
ENTETES=$($CURL -D - -o /tmp/index-en-ligne.html "$BASE/")
echo "$ENTETES" | head -1 | grep -q " 200" || echouer "page d'accueil : pas de 200"
grep -q '<div id="root">' /tmp/index-en-ligne.html || echouer "la page d'accueil n'est pas l'application"
for entete in "strict-transport-security" "content-security-policy: default-src 'self'" "x-frame-options: deny" "x-content-type-options: nosniff"; do
  echo "$ENTETES" | grep -qi "^$entete" || echouer "en-tête manquant : $entete"
done
echo "   OK"

echo "3. Génération d'un PDF"
CODE=$($CURL -o /tmp/facture-en-ligne.pdf -w '%{http_code}' -H 'Content-Type: application/json' --data-binary @- \
  "$BASE/api/v1/invoices/pdf" <<'JSON'
{
  "invoiceNumber": "VERIF-001",
  "invoiceDate": "2026-11-27",
  "paymentTermsDays": 14,
  "client": { "name": "Vérification", "addressLines": [] },
  "lines": [ { "description": "Vérification de la mise en ligne", "quantity": 1, "unit": null, "unitPrice": 1 } ],
  "notes": null,
  "issuer": { "name": "Vérification", "addressLines": [], "siret": null, "email": null, "phone": null, "iban": null }
}
JSON
)
[ "$CODE" = "200" ] || echouer "génération du PDF : code $CODE"
[ "$(head -c 5 /tmp/facture-en-ligne.pdf)" = "%PDF-" ] || echouer "la réponse n'est pas un PDF"
echo "   OK"

echo "4. Profil de production"
for chemin in /api/docs /api/v1/openapi.json /actuator/env; do
  CODE=$($CURL -o /dev/null -w '%{http_code}' "$BASE$chemin")
  [ "$CODE" = "404" ] || echouer "$chemin accessible en production (code $CODE)"
done
echo "   OK"

if [ "$OPTION" = "--limite" ]; then
  echo "5. Une adresse inventée ne doit pas contourner la limite (31 demandes)"
  n=1
  DERNIER=""
  while [ "$n" -le 31 ]; do
    DERNIER=$($CURL -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' \
      -H "X-Forwarded-For: 198.51.100.$n" -H "CF-Connecting-IP: 198.51.100.$n" -H "True-Client-IP: 198.51.100.$n" \
      -d '{}' "$BASE/api/v1/invoices/pdf")
    [ "$DERNIER" = "429" ] && break
    n=$((n + 1))
  done
  if [ "$DERNIER" = "429" ]; then
    echo "   OK : bloqué à la demande $n malgré des adresses inventées"
  else
    echo "   ATTENTION : 31 demandes passées avec des adresses inventées."
    echo "   Un en-tête est cru alors que le client peut l'inventer : régler INVOICE_API_CLIENT_IP_HEADER"
    echo "   (voir le guide de mise en ligne) puis relancer cette vérification."
    exit 1
  fi
fi

echo "Version en ligne : OK"
