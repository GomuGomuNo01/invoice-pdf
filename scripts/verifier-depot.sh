#!/usr/bin/env sh
# Garde-fous du dépôt : fichiers interdits et tirets longs.
# Usage :
#   sh scripts/verifier-depot.sh --staged   (hook pre-commit, fichiers indexés)
#   sh scripts/verifier-depot.sh            (CI, tous les fichiers suivis)
set -eu

MODE="${1:-all}"
ERREUR=0

if [ "$MODE" = "--staged" ]; then
  FICHIERS=$(git diff --cached --name-only --diff-filter=ACMR)
else
  FICHIERS=$(git ls-files)
fi

[ -z "$FICHIERS" ] && exit 0

# 1. Fichiers interdits (documentation interne, secrets)
INTERDITS=$(printf '%s\n' "$FICHIERS" | grep -E '(^|/)docs-local/|(^|/)PLAN_DE_TRAVAIL[^/]*\.md$|(^|/)AUDIT[^/]*\.md$|\.notes\.md$|(^|/)\.env($|\.)' | grep -vE '(^|/)\.env(\.prod)?\.example$' || true)
if [ -n "$INTERDITS" ]; then
  echo "ERREUR : fichiers interdits dans le dépôt :"
  printf '  %s\n' $INTERDITS
  ERREUR=1
fi

# 2. Tirets longs (U+2014 et U+2013), recherchés par leurs octets UTF-8
#    E2 80 94 (cadratin) et E2 80 93 (demi-cadratin)
TIRETS=""
for f in $FICHIERS; do
  [ -f "$f" ] || continue
  case "$f" in
    *.ttf|*.otf|*.woff|*.woff2|*.pdf|*.png|*.jpg|*.jpeg|*.ico|*.jar) continue ;;
  esac
  if [ "$MODE" = "--staged" ]; then
    CONTENU_CMD="git show :$f"
  else
    CONTENU_CMD="cat $f"
  fi
  if $CONTENU_CMD 2>/dev/null | LC_ALL=C grep -q "$(printf '\342\200\224')\|$(printf '\342\200\223')"; then
    TIRETS="$TIRETS $f"
  fi
done
if [ -n "$TIRETS" ]; then
  echo "ERREUR : tiret long (U+2014 ou U+2013) trouvé dans :"
  printf '  %s\n' $TIRETS
  echo "Remplacer par le tiret simple '-'."
  ERREUR=1
fi

# 3. Scan de secrets (gitleaks si installé)
if command -v gitleaks >/dev/null 2>&1; then
  if [ "$MODE" = "--staged" ]; then
    gitleaks protect --staged --no-banner --redact || ERREUR=1
  else
    gitleaks detect --no-banner --redact || ERREUR=1
  fi
else
  echo "Avertissement : gitleaks absent, scan de secrets ignoré en local (actif en CI)."
fi

if [ "$ERREUR" -ne 0 ]; then
  echo "Commit ou contrôle refusé. Ne pas contourner avec --no-verify."
  exit 1
fi
echo "Garde-fous du dépôt : OK"
