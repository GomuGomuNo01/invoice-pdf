#!/usr/bin/env sh
# Essai de l'image unique (Dockerfile à la racine, hébergement Render) dans les conditions de l'offre
# gratuite : 512 Mo de mémoire, port fourni par la variable PORT, profil de production.
# Usage : sh scripts/tester-image-unique.sh (depuis la racine du dépôt).
set -eu

IMAGE="invoice-pdf:essai-unique"
NOM="invoice-pdf-essai-unique"
BASE="http://localhost:10000"
CURL="curl -s --connect-timeout 3 --max-time 30"
ECHEC=0

nettoyer() {
  if [ "$ECHEC" -ne 0 ]; then
    echo "--- Journal du conteneur ---"
    docker logs --tail 150 "$NOM" 2>&1 || true
  fi
  docker rm -f "$NOM" >/dev/null 2>&1 || true
}
trap nettoyer EXIT

echouer() {
  echo "ECHEC : $1"
  ECHEC=1
  exit 1
}

echo "1. Construction de l'image unique"
docker build -q -t "$IMAGE" . >/dev/null
docker image inspect "$IMAGE" --format '   taille : {{.Size}} octets'

echo "2. Démarrage avec 512 Mo, port 10000, système de fichiers en lecture seule"
DEBUT=$(date +%s)
docker run -d --name "$NOM" --memory 512m --read-only --tmpfs /tmp \
  -e PORT=10000 -e INVOICE_API_MAX_CONCURRENT_RENDERS=2 -e INVOICE_SITE_EDITOR_NAME="Éditeur Essai" \
  -p 127.0.0.1:10000:10000 "$IMAGE" >/dev/null
i=0
until [ "$($CURL --max-time 5 -o /dev/null -w '%{http_code}' "$BASE/actuator/health")" = "200" ]; do
  i=$((i + 1))
  [ "$i" -gt 90 ] && echouer "l'application ne démarre pas"
  sleep 1
done
echo "   prête en $(( $(date +%s) - DEBUT )) s"

echo "3. Interface servie par l'application"
ENTETES=$($CURL -D - -o /tmp/index-unique.html "$BASE/")
echo "$ENTETES" | head -1 | grep -q " 200" || echouer "page d'accueil : pas de 200"
grep -q '<div id="root">' /tmp/index-unique.html || echouer "la page d'accueil n'est pas l'application"
echo "$ENTETES" | grep -qi "^content-security-policy: default-src 'self'; script-src 'self'" || echouer "CSP de l'interface absente"
echo "$ENTETES" | grep -qi "^cache-control: no-cache" || echouer "page d'accueil mise en cache"
SCRIPT=$(grep -o 'src="/assets/[^"]*\.js"' /tmp/index-unique.html | head -1 | sed 's/src="//; s/"$//')
[ -n "$SCRIPT" ] || echouer "script de l'interface introuvable dans la page"
ENTETES_JS=$($CURL -D - -o /dev/null "$BASE$SCRIPT")
echo "$ENTETES_JS" | head -1 | grep -q " 200" || echouer "script de l'interface : pas de 200"
echo "$ENTETES_JS" | grep -qi "^cache-control:.*immutable" || echouer "script de l'interface sans cache long"
echo "   OK ($SCRIPT)"

echo "4. Génération d'un PDF"
CODE=$($CURL -o /tmp/facture-unique.pdf -w '%{http_code}' -H 'Content-Type: application/json' --data-binary @- \
  "$BASE/api/v1/invoices/pdf" <<'JSON'
{
  "invoiceNumber": "UNIQUE-001",
  "invoiceDate": "2026-11-27",
  "paymentTermsDays": 14,
  "client": { "name": "Client Essai", "addressLines": ["1 rue du Test"] },
  "lines": [ { "description": "Essai image unique", "quantity": 3, "unit": "heure", "unitPrice": 45 } ],
  "notes": null,
  "issuer": { "name": "Atelier Essai", "addressLines": [], "siret": null, "email": null, "phone": null, "iban": null }
}
JSON
)
[ "$CODE" = "200" ] || echouer "génération du PDF : code $CODE"
[ "$(head -c 5 /tmp/facture-unique.pdf)" = "%PDF-" ] || echouer "la réponse n'est pas un PDF"
echo "   PDF de $(wc -c < /tmp/facture-unique.pdf) octets"

echo "5. Profil de production"
for chemin in /api/docs /api/v1/openapi.json /actuator/env; do
  CODE=$($CURL -o /dev/null -w '%{http_code}' "$BASE$chemin")
  [ "$CODE" = "404" ] || echouer "$chemin accessible (code $CODE)"
done
$CURL "$BASE/api/v1/site" | grep -q '"editorName":"Éditeur Essai"' || echouer "mentions légales non lues"
echo "   OK"

echo "6. Tenue en mémoire : 10 PDF de 100 lignes"
LIGNES=$(i=1; while [ $i -le 100 ]; do printf '{"description":"Ligne %s avec une description assez longue pour occuper de la place","quantity":1.5,"unit":"heure","unitPrice":10.01}' "$i"; [ $i -lt 100 ] && printf ','; i=$((i+1)); done)
CORPS="{\"invoiceNumber\":\"MEM-1\",\"invoiceDate\":\"2026-11-27\",\"paymentTermsDays\":14,\"client\":{\"name\":\"Client\",\"addressLines\":[]},\"lines\":[$LIGNES],\"notes\":null,\"issuer\":{\"name\":\"Atelier\",\"addressLines\":[],\"siret\":null,\"email\":null,\"phone\":null,\"iban\":null}}"
n=1
while [ "$n" -le 10 ]; do
  CODE=$($CURL -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' -H "X-Forwarded-For: 192.0.2.$n" \
    -d "$CORPS" "$BASE/api/v1/invoices/pdf")
  [ "$CODE" = "200" ] || echouer "PDF de 100 lignes n°$n : code $CODE"
  n=$((n + 1))
done
docker inspect "$NOM" --format '{{.State.OOMKilled}}' | grep -q false || echouer "conteneur arrêté faute de mémoire"
docker stats --no-stream --format '   mémoire utilisée : {{.MemUsage}}' "$NOM"

echo "7. Utilisateur non root"
UID_APP=$(docker exec "$NOM" id -u)
[ "$UID_APP" != "0" ] || echouer "le conteneur tourne en root"
echo "   uid $UID_APP"

echo "Image unique : OK"
