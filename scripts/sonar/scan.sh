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

# ⛔ NO SE PUEDE ESCANEAR DESDE UN WORKTREE. Medido el 2026-10-09, con dos intentos.
#
# En un worktree `.git` no es un directorio: es un FICHERO que dice
# `gitdir: /…/deasy/.git/worktrees/<nombre>`. Lo que pasa, por orden:
#
#   · montando solo la raiz, el escaner muere con «Unable to open Git repository …
#     RepositoryNotFoundException», y el mensaje no sugiere en ningun momento que sea el montaje;
#   · montando TAMBIEN el `.git` principal en su ruta absoluta, el escaner ARRANCA y lee bien la
#     revision SCM... pero `.git/worktrees/<nombre>/gitdir` guarda la ruta del ARBOL en el host, y
#     jgit la busca tal cual. Concluye que no hay NI UN fichero rastreado;
#   · y entonces sube un analisis VACIO: 0 violaciones, sin `ncloc`, las tres notas en «A».
#     VERDE Y FALSO, que es mucho peor que el fallo ruidoso del primer caso. Montar tambien la ruta
#     del arbol tampoco lo arregla: el informe sale byte a byte igual de vacio.
#
# Escanear es MEDIR, y la regla del `CLAUDE.md` de la raiz deja explicitamente la medicion en el
# worktree principal («leer, medir, consultar la base, y responder preguntas»). Asi que esto no es
# una limitacion que haya que sortear: es el sitio correcto.
if [ -f "$ROOT_DIR/.git" ]; then
  echo "ERROR: $ROOT_DIR es un WORKTREE y el escaner no puede analizarlo." >&2
  echo "       No falla de forma visible: indexa CERO ficheros y sube un analisis vacio en verde." >&2
  echo "       El detalle esta en el comentario de este script." >&2
  echo "       Escanea desde el worktree PRINCIPAL, que tiene un .git de verdad:" >&2
  echo "           cd \"$(sed -n 's#^gitdir: \(.*\)/.git/worktrees/.*#\1#p' "$ROOT_DIR/.git")\"" >&2
  echo "           SONAR_TOKEN=... bash scripts/sonar/scan.sh" >&2
  echo "       Medir ahi esta permitido: el worktree propio es para ESCRIBIR." >&2
  exit 1
fi

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
  PANEL="http://localhost:9002/dashboard?id=deasy"
  API="http://localhost:9002"
else
  PANEL="${SONAR_HOST_URL%/}/dashboard?id=deasy"
  API="${SONAR_HOST_URL%/}"
fi

# ⚠️ UN ESCANEO VERDE NO SIGNIFICA UN ESCANEO HECHO. El 2026-10-09 se subieron DOS analisis con cero
# ficheros indexados y «EXECUTION SUCCESS» en los dos: el escaner considera un exito no tener nada
# que analizar. Lo unico que lo delata es que `ncloc` venga vacio, asi que se comprueba aqui — con
# la misma logica que las demas puertas del repositorio: si la medida no existe, no hay medida.
echo "Comprobando que el analisis indexo algo..."
for _ in 1 2 3 4 5 6 7 8 9 10; do
  NCLOC="$(curl -s -u "$SONAR_TOKEN:" \
    "$API/api/measures/component?component=deasy&metricKeys=ncloc" \
    | sed -n 's/.*"metric":"ncloc","value":"\([0-9]*\)".*/\1/p')"
  [ -n "$NCLOC" ] && break
  sleep 6
done

if [ -z "${NCLOC:-}" ] || [ "$NCLOC" -lt 1000 ]; then
  echo "ERROR: el analisis subio pero `ncloc` es ${NCLOC:-vacio}: no ha indexado el repositorio." >&2
  echo "       NO te creas el panel. Borra ese analisis para no dejar un cero en la serie:" >&2
  echo "           curl -s -u \$SONAR_TOKEN: \"$API/api/project_analyses/search?project=deasy&ps=1\"" >&2
  echo "           curl -s -u \$SONAR_TOKEN: -X POST \"$API/api/project_analyses/delete?analysis=<key>\"" >&2
  exit 1
fi

echo "Indexado: $NCLOC lineas de codigo."
echo "Resultados: $PANEL"
