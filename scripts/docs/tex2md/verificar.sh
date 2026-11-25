#!/usr/bin/env bash
#
# La puerta del convertidor de LaTeX a Markdown.
#
# ── Por que existe ─────────────────────────────────────────────────────────────────────
# Pandoc convierte `docs/arquitectura-deasy.tex` SIN EMITIR UN SOLO AVISO y pierde el 26%
# del contenido: los 15 diagramas ASCII quedan reflowados a un parrafo con los `---`
# convertidos en rayas tipograficas (irreversible), las 22 tablas pierden la estructura y
# las 40 cajas colapsan al mismo div.
#
# Como el fallo es silencioso, la unica defensa es CONTAR. Estos diez numeros salen de haber
# medido el .tex a mano; si alguno no cuadra, la conversion perdio algo y hay que mirar que.
#
#   bash scripts/docs/tex2md/verificar.sh            # convierte y comprueba
#   bash scripts/docs/tex2md/verificar.sh --dejar    # ademas conserva el intermedio
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TEX="$ROOT/docs/arquitectura-deasy.tex"
AQUI="$ROOT/scripts/docs/tex2md"
TMP="$(mktemp -d)"
[ "${1:-}" = "--dejar" ] || trap 'rm -rf "$TMP"' EXIT

fallos=0
comprobar() {           # nombre  obtenido  esperado
  if [ "$2" = "$3" ]; then
    printf '  \033[32mOK\033[0m   %-32s %s\n' "$1" "$2"
  else
    printf '  \033[31mFALLA\033[0m %-32s %s  (esperado %s)\n' "$1" "$2" "$3"
    fallos=$((fallos + 1))
  fi
}

echo "▸ Pre-procesando el .tex"
perl "$AQUI/pre-tex.pl" < "$TEX" > "$TMP/pre.tex"

# Salvaguarda de bulto: la primera version del pre-procesador se comio 382 lineas del cuerpo
# EN SILENCIO (un `.*?` con /s que cruzo saltos de linea). El .tex pre-procesado tiene que
# CRECER, porque R1 baja el titulo de 40 cajas al cuerpo.
n_orig=$(wc -l < "$TEX"); n_pre=$(wc -l < "$TMP/pre.tex")
if [ "$n_pre" -lt "$n_orig" ]; then
  echo "  ✖ El pre-proceso ENCOGIO el fichero: $n_orig -> $n_pre lineas. Se comio algo." >&2
  exit 1
fi

echo "▸ Convirtiendo con Pandoc"
pandoc -f latex -t gfm --wrap=none \
  --lua-filter="$AQUI/starlight.lua" \
  "$TMP/pre.tex" -o "$TMP/intermedio.md"

MD="$TMP/intermedio.md"
echo
echo "▸ Las diez comprobaciones"
comprobar "tablas Markdown"        "$(grep -cE '^\|[[:space:]]*:?-' "$MD" || true)" 22
comprobar ":::tip (concepto)"      "$(grep -c '^:::tip' "$MD" || true)" 11
comprobar ":::caution (aviso)"     "$(grep -c '^:::caution' "$MD" || true)" 16
comprobar ":::note (nota)"         "$(grep -c '^:::note' "$MD" || true)" 13
comprobar "anclas de diagrama"     "$(grep -c '<!-- diagrama' "$MD" || true)" 15
comprobar "<div de ruido"          "$(grep -c '<div ' "$MD" || true)" 0
comprobar "spec de columna filtrada" "$(grep -cE '@P[0-9]' "$MD" || true)" 0
comprobar "rightarrow literal"     "$(grep -cF 'rightarrow' "$MD" || true)" 0
comprobar "¿ del espanol"          "$(grep -c '¿' "$MD" || true)" 8
comprobar "language=Java"          "$(grep -cF 'language=Java' "$MD" || true)" 0

# Los diagramas son lo que Pandoc destruye de forma irreversible: se comprueban aparte.
echo
echo "▸ Integridad de los diagramas ASCII"
comprobar "cajas de dibujo (+--)"  "$([ "$(grep -c '+--' "$MD" || true)" -gt 20 ] && echo si || echo no)" si
comprobar "rayas tipograficas dentro" "$(awk '/^``` text$/,/^```$/' "$MD" | grep -c '—' || true)" 0

# ── El grep de credenciales ────────────────────────────────────────────────────────────
# El .tex TIENE credenciales (usuarios de dev y la de SonarQube) y el sitio va a ser publico.
# Esto se comprueba SIEMPRE, no una vez: es la misma higiene del commit b2f3e47, que las saco
# de `guias/entorno-dev.md`. Se mira lo YA PUBLICADO, no el intermedio.
echo
echo "▸ Credenciales en lo publicado"
pub="$ROOT/docs/src/content/docs"
if [ -d "$pub" ]; then
  # El `|| true` NO es cosmetico: con `set -o pipefail`, un grep que no encuentra nada
  # devuelve 1 y mata el script. O sea que la comprobacion EN VERDE abortaba la puerta.
  n=$(grep -rniE 'Demo1234|Gestor1234|1234567890|0987654321|1122334455|deasy:deasy' "$pub" 2>/dev/null | wc -l || true)
  comprobar "credenciales en docs/src" "$n" 0
else
  echo "  (aun no hay contenido publicado)"
fi

echo
if [ "$fallos" -gt 0 ]; then
  echo "✖ $fallos comprobacion(es) fallaron. La conversion perdio algo: NO sigas." >&2
  exit 1
fi
echo "✓ Las trece comprobaciones pasan."
[ "${1:-}" = "--dejar" ] && echo "  intermedio en: $TMP/intermedio.md"
exit 0
