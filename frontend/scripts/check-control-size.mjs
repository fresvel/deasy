#!/usr/bin/env node
/* ¿ALGUIEN LE ESTA PISANDO LA ALTURA AL CONTROL?
 *
 * El gate diecinueve, y el unico que nace de un aviso escrito en el propio CSS. `forms.css` dice,
 * literalmente, junto a la receta de `deasy-control`:
 *
 *   > ⚠️ EL `h-11` SOLO GANA SI LA PLANTILLA NO ESCRIBE `h-10`. Una utilidad de Tailwind vive en
 *   > `@layer utilities` y le gana a esta clase, que esta en `components`. Al adoptar la altura
 *   > hubo que quitar el `h-10 py-2` de los tres campos de admin; **si vuelve a aparecer en una
 *   > plantilla, la altura del sistema deja de aplicar y no avisa nadie**.
 *
 * Volvio a aparecer. El 2026-08-15 `AdminInputField` tenia otra vez `h-10 py-2`, con un comentario
 * que decia «altura uniforme para que inputs, selects y lookups queden alineados» — y conseguia lo
 * contrario, porque `AdminSelectField` no lo llevaba: **el input medía 40 px y el select 44 en el
 * mismo formulario**. Lo vio el dueño, no el CSS.
 *
 * O sea: el aviso estaba escrito, era exacto, y aun asi se repitio. Un aviso en un comentario no
 * es una puerta; esto si.
 *
 * ── LA SEÑAL, Y POR QUE ES LA SEGUNDA ──────────────────────────────────────────────────────────
 *
 * La primera version miraba «una utilidad de altura en el MISMO ATRIBUTO `class` que una clase de
 * control». Parecia exacta y **dio VERDE sobre el fallo que la motivo**, probada en rojo acto
 * seguido: el `h-10` de `AdminInputField` no vive en un atributo sino en un `computed` de
 * JavaScript que la plantilla enchufa con `:class="sizeClass"`. Mirar solo el atributo es mirar
 * donde no esta.
 *
 * La buena: **en un fichero que renderiza un control del sistema, cualquier utilidad de altura
 * DE RANGO DE CONTROL escrita en un literal de cadena**, venga de un atributo o del `<script>`.
 *
 * El rango importa y es lo que quita el ruido: `h-8` a `h-14` (32-56 px) son alturas de control;
 * por debajo son iconos y adornos —`h-4` en un `<svg>` es lo normal y no tiene nada que ver—, y
 * por encima son cajas y paneles. Con esa ventana, el gate no necesita entender expresiones.
 *
 * No entra `min-h-*` (una caja que crece no fija la altura), ni `h-full`/`h-auto` (delegan, no
 * imponen), ni los `textarea`, que por definicion no tienen altura de control.
 *
 * ⚠️ NI LOS CUADRADOS, y esto es lo que separa 1 acierto de 12 avisos. Con solo el rango, once de
 * los doce hallazgos eran `h-10 w-10`, `h-9 w-9`, `h-8 w-8`: iconos y avatares. **Un control nunca
 * tiene el ancho igual al alto** —es `w-full` o crece con su rejilla—, asi que un `h-N w-N` con el
 * mismo N no es un control por definicion. Con ese descarte quedan 1 acierto y CERO falsos
 * positivos, que es la unica forma de que un gate siga encendido dentro de un mes.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const RAIZ = process.argv[2] ?? "src";
const TECHO = 0;

/* Las clases que YA declaran su altura. Si una plantilla las usa, la altura ya esta decidida. */
const CONTROL = /\b(deasy-control|deasy-filter-control|deasy-filter-search-input|deasy-field-input|deasy-field-select|profile-text-input|profile-select-input)\b/;
/* Rango de altura de CONTROL: `h-8` .. `h-14`. Por debajo son iconos, por encima son cajas.
   No entra `min-h-*` ni `h-full`/`h-auto`. */
const ALTURA = /(?<!min-)\bh-(?:8|9|10|10\.5|11|12|13|14)\b/;

const listar = (d, out = []) => {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) listar(p, out);
    else if (p.endsWith(".vue")) out.push(p);
  }
  return out;
};

const sinComentarios = (s) =>
  s.replace(/<!--[\s\S]*?-->/g, (c) => c.replace(/[^\n]/g, " "))
   .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "));

const hallazgos = [];

for (const f of listar(RAIZ)) {
  const src = sinComentarios(readFileSync(f, "utf8"));
  const rel = f.replace(/^src\//, "");

  /* Solo interesan los ficheros que RENDERIZAN un control del sistema: en los demas, un `h-10`
     es un `h-10` cualquiera y no pisa nada. */
  if (!CONTROL.test(src)) continue;

  /* Y dentro de esos, cualquier literal de cadena con una altura de rango de control: da igual
     que venga de un atributo o de un `computed`, que es donde se escondio la ultima vez. */
  for (const m of src.matchAll(/(['"`])((?:[^'"`\\\n]|\\.)*)\1/g)) {
    const valor = m[2];
    if (!ALTURA.test(valor)) continue;
    if (/textarea/i.test(valor)) continue;
    /* Un cuadrado (`h-10 w-10`) es un icono o un avatar, no un control. */
    const alto = valor.match(ALTURA)[0].slice(2);
    if (new RegExp(`\\bw-${alto}\\b`).test(valor)) continue;
    hallazgos.push({
      f: rel,
      n: src.slice(0, m.index).split("\n").length,
      control: src.match(CONTROL)[0],
      altura: valor.match(ALTURA)[0],
      t: valor.slice(0, 72),
    });
  }
}

if (hallazgos.length > TECHO) {
  console.error(`\ncheck:control-size FALLA — ${hallazgos.length} controles con la altura pisada (techo ${TECHO})\n`);
  for (const h of hallazgos) {
    console.error(`  ${h.f}:${h.n}`);
    console.error(`      \`${h.altura}\` junto a \`${h.control}\`, que YA declara su altura`);
    console.error(`      ${h.t}\n`);
  }
  console.error("Una utilidad de Tailwind vive en `@layer utilities` y le gana a la clase del control,");
  console.error("que esta en `components`. Escribir `h-10` ahi no ajusta el control: lo SACA del sistema.");
  console.error("Si de verdad hace falta otra altura, se declara como variante en `forms.css` —con su");
  console.error("motivo— y no como una utilidad suelta en una plantilla.\n");
  process.exit(1);
}

console.log(`check:control-size OK — ningun control con la altura pisada.`);
