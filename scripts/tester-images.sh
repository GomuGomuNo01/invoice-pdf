#!/usr/bin/env sh
# Construit les images Docker, démarre l'ensemble (docker compose) et vérifie qu'il fonctionne :
# frontend servi par nginx, proxy /api vers le backend, génération d'un vrai PDF, en-têtes de sécurité,
# conteneurs non root. Usage : sh scripts/tester-images.sh (depuis la racine du dépôt).
set -eu

BASE="http://localhost:8081"
ECHEC=0
# Chaque requête est bornée : un backend bloqué ne doit pas suspendre le script.
CURL="curl -s --connect-timeout 3 --max-time 30"

nettoyer() {
  if [ "$ECHEC" -ne 0 ]; then
    echo "--- Journaux des conteneurs ---"
    docker compose logs --no-color --tail=200 || true
  fi
  docker compose down -v --remove-orphans >/dev/null 2>&1 || true
}
trap nettoyer EXIT

echouer() {
  echo "ECHEC : $1"
  ECHEC=1
  exit 1
}

echo "1. Construction des images"
docker compose build --pull

echo "2. Démarrage"
docker compose up -d

echo "3. Attente du service (proxy nginx vers le backend)"
i=0
until [ "$($CURL --max-time 5 -o /dev/null -w '%{http_code}' "$BASE/api/v1/issuer")" = "200" ]; do
  i=$((i + 1))
  [ "$i" -gt 60 ] && echouer "le backend ne répond pas via nginx après 60 tentatives (2 à 7 s chacune)"
  sleep 2
done
echo "   service prêt"

echo "4. Page d'accueil et en-têtes de sécurité"
ENTETES=$($CURL -D - -o /tmp/index.html "$BASE/")
echo "$ENTETES" | head -1 | grep -q " 200" || echouer "la page d'accueil ne renvoie pas 200"
grep -q '<div id="root">' /tmp/index.html || echouer "la page d'accueil n'est pas l'application"
for entete in "Content-Security-Policy" "X-Content-Type-Options: nosniff" "X-Frame-Options: DENY" "Referrer-Policy: no-referrer"; do
  echo "$ENTETES" | grep -qi "^$entete" || echouer "en-tête manquant : $entete"
done
echo "$ENTETES" | grep -qi "^Server: nginx/" && echouer "nginx expose sa version"
echo "   OK"

echo "5. Génération d'un PDF via le proxy"
CODE=$($CURL -o /tmp/facture.pdf -D /tmp/entetes-pdf.txt -w '%{http_code}' \
  -H 'Content-Type: application/json' \
  --data-binary @- "$BASE/api/v1/invoices/pdf" <<'JSON'
{
  "invoiceNumber": "DOCKER-001",
  "invoiceDate": "2026-11-26",
  "paymentTermsDays": 14,
  "client": { "name": "Client Éàç", "addressLines": ["1 rue du Test", "75001 Paris"] },
  "lines": [ { "description": "Essai conteneur", "quantity": 1.5, "unit": "heure", "unitPrice": 10.01 } ],
  "notes": null,
  "issuer": { "name": "Atelier Docker", "addressLines": ["2 rue des Images"], "siret": null, "email": null, "phone": null, "iban": null }
}
JSON
)
[ "$CODE" = "200" ] || { cat /tmp/facture.pdf; echouer "génération du PDF : code HTTP $CODE"; }
[ "$(head -c 5 /tmp/facture.pdf)" = "%PDF-" ] || echouer "la réponse n'est pas un PDF"
grep -qi 'filename="Facture-DOCKER-001.pdf"' /tmp/entetes-pdf.txt || echouer "nom de fichier inattendu"
echo "   PDF de $(wc -c < /tmp/facture.pdf) octets"

echo "6. Requête invalide refusée proprement"
CODE=$($CURL -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' -d '{"invoiceNumber":""}' "$BASE/api/v1/invoices/pdf")
[ "$CODE" = "400" ] || echouer "requête invalide : code $CODE au lieu de 400"
echo "   OK"

echo "6 bis. Limitation de débit par adresse réelle du client (à travers nginx)"
# La limite par défaut est de 30 générations par minute et par adresse.
demande() {
  $CURL -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' -H "X-Forwarded-For: $1" \
    -d '{}' "$BASE/api/v1/invoices/pdf"
}
# La limite est comptée par minute d'horloge (conteneurs et hôte partagent la même horloge) :
# la rafale doit tenir dans une seule minute, sinon la 31e demande tomberait dans la suivante.
SECONDE=$(date -u +%S | sed 's/^0//')
if [ "$SECONDE" -gt 30 ]; then
  echo "   attente du début de la minute suivante ($((61 - SECONDE)) s)"
  sleep $((61 - SECONDE))
fi
n=1
while [ "$n" -le 30 ]; do
  CODE=$(demande 203.0.113.10)
  [ "$CODE" = "400" ] || echouer "client A, demande $n : code $CODE au lieu de 400"
  n=$((n + 1))
done
CODE=$(demande 203.0.113.10)
[ "$CODE" = "429" ] || echouer "client A, demande 31 : code $CODE au lieu de 429"
CODE=$(demande 198.51.100.20)
[ "$CODE" = "400" ] || echouer "client B bloqué par la limite du client A (code $CODE) : adresses confondues"
echo "   OK : chaque client a sa propre limite"

echo "7. Conteneurs non root"
for service in backend frontend; do
  UID_SERVICE=$(docker compose exec -T "$service" id -u)
  [ "$UID_SERVICE" != "0" ] || echouer "le conteneur $service tourne en root"
  echo "   $service : uid $UID_SERVICE"
done

echo "8. Taille des images"
docker compose images --format '{{.Service}} {{.Repository}}:{{.Tag}} {{.Size}}' 2>/dev/null \
  || docker compose images

echo "Images Docker : OK"
