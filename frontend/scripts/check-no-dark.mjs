#!/usr/bin/env node
/**
 * Rechaza cualquier `dark:` en el frontend.
 *
 * Deasy es una app EN CLARO y no se contempla modo oscuro. Sus zonas oscuras —la barra
 * lateral— son una decisión de diseño resuelta con color explícito, no un tema.
 *
 * Hay tres capas contra esto y cada una tapa lo que la anterior no ve:
 *
 *   1. `tokens.css` declara `@custom-variant dark (&:where(.dark, .dark *))`, que impide
 *      que Tailwind compile `dark:` a `prefers-color-scheme` y lo active SOLO en la
 *      máquina de quien tenga el sistema en oscuro. Es el seguro.
 *   2. `vue/no-restricted-class` lo rechaza en los atributos `class` de las plantillas.
 *   3. Esto, que es lo que cubre lo que ninguna de las dos ve:
 *        · `dark:` dentro de un `@apply` — stylelint sólo mira nombres de propiedad
 *        · cualquier CSS dentro de un `<style scoped>` de un `.vue`, que stylelint no
 *          abre porque su glob es `src/**´/*.css`
 *        · `dark:` construido en un `.js` (mapas de clases por estado)
 *
 * Existe porque las recetas de TailAdmin, de donde salen los componentes nuevos, traen
 * 1024 clases `dark:`. Al adaptar una receta se QUITAN.
 *
 * Si algún día se implementa modo oscuro, esto se retira — pero entonces hay que revisar
 * uno a uno los `dark:` que se hubieran colado, porque apuntan a la paleta de TailAdmin
 * (gray-900, gray-800…) y no a la de Deasy.
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const ficheros = execSync(
  `grep -rl --include=*.vue --include=*.css --include=*.js -e 'dark:' src || true`,
  { encoding: "utf8" },
).trim().split("\n").filter(Boolean);

const hallazgos = [];
for (const f of ficheros) {
  const lineas = readFileSync(f, "utf8").split("\n");
  let enComentario = false;
  for (const [i, l] of lineas.entries()) {
    // Los comentarios que EXPLICAN esta regla no cuentan como infracción
    if (enComentario) { if (l.includes("*/")) enComentario = false; continue; }
    if (l.includes("/*") && !l.includes("*/")) { enComentario = true; continue; }
    const limpia = l.replace(/\/\*.*?\*\//g, "").replace(/\/\/.*$/, "");
    for (const m of limpia.matchAll(/(?:^|[\s"'`:[])(dark:[a-z0-9-[\]/.]+)/g)) {
      hallazgos.push({ f, n: i + 1, clase: m[1] });
    }
  }
}

if (!hallazgos.length) {
  console.log("check:no-dark OK — ningún `dark:` en el frontend.");
  process.exit(0);
}

console.error(`\ncheck:no-dark — ${hallazgos.length} uso(s) de \`dark:\`.\n`);
for (const h of hallazgos) console.error(`  ${h.f}:${h.n}  ${h.clase}`);
console.error(`
Deasy es una app en claro y no se contempla modo oscuro. Si esto viene de una receta de
TailAdmin, quítale las clases \`dark:\` al adaptarla: apuntan a su paleta (gray-900,
gray-800…), no a la de Deasy, y aquí no pintan nada.

El motivo largo está en este mismo script y en frontend/CLAUDE.md.
`);
process.exit(1);
