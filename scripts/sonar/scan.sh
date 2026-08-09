#!/usr/bin/env bash
# Ejecuta sonar-scanner sobre el monorepo.
#
# Dos modos, y el que se usa depende de si defines SONAR_HOST_URL:
#
#   MODO LOCAL (por defecto, es el del día a día) — SonarQube autoalojado en :9002:
#     docker compose -f scripts/sonar/compose.yml up -d
#     SONAR_TOKEN=<token> bash scripts/sonar/scan.sh
#   El escáner entra en la red de compose (deasy-sonar_default) para resolver el host "sonarqube".
#
#   MODO REMOTO — cualquier servidor alcanzable por red (SonarCloud, un SonarQube publicado, CI):
#     SONAR_HOST_URL=https://sonar.example.org SONAR_TOKEN=<token> bash scripts/sonar/scan.sh
#   Aquí NO se usa --network: el contenedor sale por la red por defecto de Docker.
#
# El token se genera en Administration > Security > Users > Tokens,
# o vía API:  curl -u admin:<pass> -X POST "$SONAR_URL/api/user_tokens/generate" -d "name=deasy-scan"
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SONAR_NETWORK="${SONAR_NETWORK:-deasy-sonar_default}"
SONAR_HOST_URL="${SONAR_HOST_URL:-}"

if [ -z "${SONAR_TOKEN:-}" ]; then
  echo "Falta SONAR_TOKEN. Genera uno en http://localhost:9002 y expórtalo." >&2
  exit 1
fi

DOCKER_ARGS=(--rm)

if [ -n "$SONAR_HOST_URL" ]; then
  # Servidor alcanzable por red: nada de meterse en la red de compose.
  echo "Escaneando contra $SONAR_HOST_URL (modo remoto)."
else
  # Servidor local dentro de la red de compose: el nombre "sonarqube" solo resuelve ahí dentro.
  SONAR_HOST_URL="http://sonarqube:9000"
  DOCKER_ARGS+=(--network "$SONAR_NETWORK")
  echo "Escaneando contra el SonarQube local de scripts/sonar/compose.yml (red $SONAR_NETWORK)."
fi

docker run "${DOCKER_ARGS[@]}" \
  -e SONAR_HOST_URL="$SONAR_HOST_URL" \
  -e SONAR_TOKEN="$SONAR_TOKEN" \
  -v "$ROOT_DIR:/usr/src:ro" \
  -v sonar_scanner_cache:/opt/sonar-scanner/.sonar/cache \
  sonarsource/sonar-scanner-cli

if [ "$SONAR_HOST_URL" = "http://sonarqube:9000" ]; then
  echo "Resultados: http://localhost:9002/dashboard?id=deasy"
else
  echo "Resultados: ${SONAR_HOST_URL%/}/dashboard?id=deasy"
fi
