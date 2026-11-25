#!/usr/bin/env node
/**
 * UNA PAGINA TIENE UN SOLO ANCHO, Y LO DECIDE EL CSS.
 *
 * ══ QUE CAZA ════════════════════════════════════════════════════════════════════════════════
 * Una plantilla que se pone SU PROPIO tope de ancho de pagina: un `max-w-*` de escala grande
 * (`3xl`…`7xl`, `screen-*`, `(--breakpoint-*)`, `page`) junto a `mx-auto`, que es la firma de
 * «centro mi contenido dentro de un limite mio». El limite de la pagina lo declara
 * `.deasy-page` en `layout.css`, y solo el.
 *
 * ══ DE DONDE SALE (F13.3, 2026-08-21) ═══════════════════════════════════════════════════════
 * Convivian **TRES anchos de pagina** en las seis vistas de espacio de trabajo:
 *
 *     1536 px   `.deasy-page`             el marco, en las 6
 *     1280 px   `ProfileHomePanel`        todo `/perfil`      (`max-w-7xl`)
 *     1152 px   `AdminView` · `ProcessManagementView`         (`max-w-6xl`)
 *
 * ⚠️ **Y el tercero estaba atado a `v-if="!selectedTable"`**, o sea que se aplicaba al indice de
 * tarjetas y NO a la tabla. Medido antes de corregirlo, con el cambio retirado y vuelto a poner:
 * en `/admin`, **pulsar una tarjeta ensanchaba el contenido de 1152 a 1536 px** y movia su borde
 * izquierdo de 236 a 44. La misma vista, dos anchos, sin nada que lo anunciara.
 *
 * El dueño cerro los tres en **1500 px**, registrado como `--container-page` en `tokens.css`
 * —`--container-*` es el namespace de Tailwind v4 para la escala de contenedores, asi que el
 * nombre genera la utilidad `max-w-page`—.
 *
 * ══ LO QUE NO CAZA, Y POR QUE ═══════════════════════════════════════════════════════════════
 *   · Un `max-w-*` SIN `mx-auto`: eso no es un tope de pagina, es un elemento que no quiere
 *     crecer (una columna de lectura, un aviso, un menu). Hay decenas y son legitimos.
 *   · La escala pequeña (`xs`…`2xl`, `md`, `sm`…): topes de componente, no de pagina.
 *   · `dialog-class="max-w-6xl"` y demas props de modal: un modal SI declara su ancho, es su
 *     trabajo. Solo se mira el atributo `class`.
 *   · **Las vistas de `modules/auth/`**, excluidas por decision del dueño en F13
 *     («es otro mundo», 2026-08-20) — y lo es de verdad: tienen otro armazon, centrado y sin
 *     `aside` ni barra superior, asi que no comparten el marco que esta fase unifica. Sus DOS
 *     sitios (`RegisterView.vue:3` con `max-w-5xl` y `:21` con `max-w-4xl`) quedan medidos aqui
 *     para quien abra la suya.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const SRC = resolve(process.argv[2] ?? "src");
const TECHO = 0;
const FUERA = ["modules/auth/"];

const ficheros = (dir, acc = []) => {
  for (const n of readdirSync(dir)) {
    const r = join(dir, n);
    if (statSync(r).isDirectory()) ficheros(r, acc);
    else if (r.endsWith(".vue") && !r.includes(".test.")) acc.push(r);
  }
  return acc;
};

const PAGINA = /max-w-(?:[3-7]xl|screen-[a-z]+|\(--breakpoint-[a-z0-9-]+\)|page)/;
const fuera = [];
let mirados = 0;

for (const f of ficheros(SRC)) {
  const rel = f.replace(SRC + "/", "");
  if (FUERA.some((p) => rel.startsWith(p))) continue;
  const src = readFileSync(f, "utf8");
  mirados++;
  /* Solo el atributo `class` literal. Un `:class` con expresion no se puede resolver aqui — mismo
     limite que el resto de gates estaticos del frente, y esta dicho para que nadie lo cuente como
     cobertura total. */
  for (const m of src.matchAll(/\sclass="([^"]*)"/g)) {
    const c = m.group ? m.group(1) : m[1];
    if (!PAGINA.test(c) || !/\bmx-auto\b/.test(c)) continue;
    fuera.push({ f: rel, n: src.slice(0, m.index).split("\n").length,
                 tope: c.match(PAGINA)[0], clase: c.trim().slice(0, 72) });
  }
}

if (fuera.length > TECHO) {
  console.error(`\ncheck:ancho — ${fuera.length} plantillas se ponen su propio ancho de pagina (techo ${TECHO})\n`);
  for (const x of fuera) console.error(`   ${x.f}:${x.n}  ${x.tope}\n      class="${x.clase}"`);
  console.error("\nEl ancho de una pagina lo declara `.deasy-page` en `layout.css`, y solo el.");
  console.error("Hoy es 1500 px, registrado como `--container-page` en `tokens.css`.");
  console.error("\nSi de verdad necesitas un limite distinto, cambialo AHI y para todos, o");
  console.error("quita el `mx-auto`: sin el, un `max-w-*` es un elemento que no quiere crecer,");
  console.error("que es otra cosa y este gate no lo mira.\n");
  process.exit(1);
}

console.log(`check:ancho OK — ${mirados} plantillas, ninguna declara su propio ancho de pagina.`);
