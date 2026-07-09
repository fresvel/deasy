#!/usr/bin/env bash
# Ejecuta sonar-scanner sobre el monorepo contra el SonarQube local.
#
#   docker compose -f scripts/sonar/compose.yml up -d   # SonarQube en http://localhost:9002
#   SONAR_TOKEN=<token> bash scripts/sonar/scan.sh
#
# El token se genera en Administration > Security > Users > Tokens,
# o vía API:  curl -u admin:<pass> -X POST "$SONAR_URL/api/user_tokens/generate" -d "name=deasy-scan"
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SONAR_NETWORK="${SONAR_NETWORK:-deasy-sonar_default}"

if [ -z "${SONAR_TOKEN:-}" ]; then
  echo "Falta SONAR_TOKEN. Genera uno en http://localhost:9002 y expórtalo." >&2
  exit 1
fi

# El escáner corre dentro de la red de compose para resolver el host "sonarqube".
docker run --rm \
  --network "$SONAR_NETWORK" \
  -e SONAR_HOST_URL="http://sonarqube:9000" \
  -e SONAR_TOKEN="$SONAR_TOKEN" \
  -v "$ROOT_DIR:/usr/src:ro" \
  -v sonar_scanner_cache:/opt/sonar-scanner/.sonar/cache \
  sonarsource/sonar-scanner-cli

echo "Resultados: http://localhost:9002/dashboard?id=deasy"
