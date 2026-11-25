#!/usr/bin/env node
/**
 * LA ESCALA DE HUECOS: cinco pasos, y cada uno significa algo.
 *
 * ══ QUE ES UN «HUECO» AQUI ══════════════════════════════════════════════════════════════════
 * El espacio entre elementos apilados o en fila: `gap-*`, `gap-x-*`, `gap-y-*`, `space-y-*`, y
 * —solo en el CSS— la propiedad `gap:` escrita en crudo. No es el padding de una caja —eso es la
 * caja— ni el margen de un titular: es la separacion que un contenedor reparte entre sus hijos.
 *
 * ══ DE DONDE SALE (F13 paso 2, 2026-08-20/21) ═══════════════════════════════════════════════
 * El dueño observo que «la distribucion de los contenidos es demasiado heterogenea». Medido:
 * **673 huecos en 80 plantillas y ONCE valores distintos** — 2 · 4 · 6 · 8 · 10 · 12 · 14 · 16 ·
 * 20 · 24 · 28 px— para expresar tres o cuatro relaciones. Y la MISMA relacion usaba huecos
 * distintos segun la pantalla: el mismo rotulo en versalita separaba 6 px de su contenido en
 * `/perfil` y 24 en `/procesos`.
 *
 * ══ DOS ESCALAS QUE SE ENCUENTRAN EN EL 8 ═══════════════════════════════════════════════════
 * Primero se cerro la de BLOQUES (cuatro pasos) y se dejaron fuera, medidos, los huecos que vivian
 * dentro del CSS. Al revisarlos se vio que no eran deriva sino OTRA POBLACION: el hueco *dentro de
 * un atomo* —el punto de una pastilla y su texto, un icono y su rotulo, la ✕ de un chip—, donde
 * 8 px ya es una separacion visible. El dueño decidio darles escala propia (2026-08-21).
 *
 *     ── el atomo ──   4 px   PEGADO     partes de una misma cosa (solo en el CSS, ver abajo)
 *     ── bloques ──    8 px   JUNTO      cosas del mismo grupo
 *                     12 px   FILA       elementos de una misma fila (icono y texto, boton y boton)
 *                     16 px   SEPARADO   bloques distintos dentro de una seccion
 *                     24 px   SECCION    secciones de la pagina
 *
 * ⚠️ **EL 4 PX SOLO VALE EN EL CSS, Y ESA ASIMETRIA ES LA REGLA, NO UN DESCUIDO.** Un atomo se
 * declara una vez y se reutiliza; si una plantilla necesita pegar dos cosas a 4 px es que esta
 * escribiendo un atomo en linea, que es justo lo que el sistema de diseño existe para evitar. Las
 * plantillas tienen cuatro pasos; el CSS, cinco.
 *
 * ══ POR QUE UN GATE Y NO UN TOKEN ═══════════════════════════════════════════════════════════
 * Se penso declarar `--ritmo-junto`, `--ritmo-fila`… y hacer que las plantillas escribieran
 * `gap-(--ritmo-junto)`. Se descarto, y el motivo importa: **la escala YA esta centralizada** en
 * `--spacing` de Tailwind, y unos tokens que ninguna plantilla consumiera serian exactamente los
 * «registros sin consumidor» que F1.3e discutio. Lo que faltaba no era un sitio donde declararla
 * sino **algo que la haga cumplir**: el vocabulario se cierra aqui, con techo CERO.
 *
 * ══ LO QUE NO MIRA ══════════════════════════════════════════════════════════════════════════
 *   · El padding de una caja. Es la caja, no el ritmo.
 *   · Huecos compuestos en runtime (`:class` con expresion). Mismo limite que el resto de gates.
 *   · Valores arbitrarios `gap-[13px]`. De eso ya se ocupa `check:no-arbitrary`.
 *   · CSS que no viva en `shared/styles`. Un `<style scoped>` con un `gap` se le escapa.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const SRC = resolve(process.argv[2] ?? "src");

/* Los pasos permitidos, en la notacion de Tailwind (paso x 4 px).
 *
 * ⚠️ EL `0` TAMBIEN ENTRA, Y NO ES UNA GRIETA. «Sin hueco» no es un paso de la escala: es la
 * decision de que el contenedor NO reparte espacio porque lo pone el hijo —el caso de las rejillas
 * de tarjetas, que traen su propio margen—. Prohibirlo obligaria a inventar un `gap-2` y a quitarle
 * el margen a la tarjeta, que es mas cambio y peor. */
const BLOQUES = { "0": 0, "2": 8, "3": 12, "4": 16, "6": 24 };
const ATOMO = { ...BLOQUES, "1": 4 };

/* Todo lo que la escala NO admite, con su equivalente en pixeles para poder explicarlo. */
const PX = { "0.5": 2, "1": 4, "1.5": 6, "2.5": 10, "3.5": 14, "5": 20, "7": 28,
             "8": 32, "9": 36, "10": 40, "11": 44, "12": 48, "14": 56, "16": 64 };

/* Techo CERO en los dos frentes: las dos escalas estan fijadas y sus sitios, migrados. */
const TECHO = 0;

const ficheros = (dir, acc = []) => {
  for (const n of readdirSync(dir)) {
    const r = join(dir, n);
    if (statSync(r).isDirectory()) ficheros(r, acc);
    else if ((r.endsWith(".vue") || r.endsWith(".css")) && !r.includes(".test.")) acc.push(r);
  }
  return acc;
};

const PAT = /\b((?:[a-z]+:)*)(gap-y|gap-x|gap|space-y)-(\d+(?:\.\d+)?)\b/g;
/* La propiedad en crudo, que solo aparece en el CSS: `gap: 4px`, `gap: 0.25rem`. El `(?<![-\w])`
   evita capturar la cola de `row-gap`/`column-gap` y, sobre todo, de `grid-gap`. */
const CRUDO = /(?<![-\w])(gap|row-gap|column-gap)\s*:\s*([\d.]+)(px|rem)/g;

/* ⚠️ HAY QUE BORRAR LOS COMENTARIOS ANTES DE MIRAR, y no es teorico: el primer censo conto un
   `gap: 0.65rem` que estaba DENTRO de un comentario de `misc.css` describiendo una regla ya
   retirada. Un gate que lee comentarios acusa de deriva a la documentacion de la deriva. */
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "));

const fuera = [];
let total = 0;

for (const f of ficheros(SRC)) {
  const bruto = readFileSync(f, "utf8");
  const esCss = f.endsWith(".css");
  const src = esCss ? sinComentarios(bruto) : bruto;
  const escala = esCss ? ATOMO : BLOQUES;
  const linea = (i) => src.slice(0, i).split("\n").length;
  const anota = (n, clase, px) => fuera.push({ f: f.replace(SRC + "/", ""), n, clase, px, esCss });

  for (const m of src.matchAll(PAT)) {
    const [, pref, prop, paso] = m;
    total++;
    /* ⚠️ `Object.hasOwn` y NO `if (escala[paso])`: el paso `0` vale 0, que es FALSY, asi que la
       comprobacion por verdad lo daba por fuera de escala justo despues de admitirlo. Un fallo de
       dos caracteres que solo se ve ejecutando. */
    if (Object.hasOwn(escala, paso)) continue;
    anota(linea(m.index), `${pref}${prop}-${paso}`, PX[paso] ?? "?");
  }

  if (!esCss) continue;
  for (const m of src.matchAll(CRUDO)) {
    const [, prop, valor, unidad] = m;
    total++;
    const px = Number(valor) * (unidad === "rem" ? 16 : 1);
    if (Object.values(ATOMO).includes(px)) continue;
    anota(linea(m.index), `${prop}: ${valor}${unidad}`, px);
  }
}

if (fuera.length > TECHO) {
  console.error(`\ncheck:ritmo — ${fuera.length} huecos fuera de la escala (techo ${TECHO})\n`);
  for (const x of fuera.slice(0, 25)) {
    console.error(`   ${x.f}:${x.n}  ${x.clase}  (${x.px} px)${x.esCss ? "" : "   ← plantilla"}`);
  }
  if (fuera.length > 25) console.error(`   … y ${fuera.length - 25} mas`);
  console.error("\nLa escala tiene CINCO pasos y cada uno significa algo:");
  console.error("    gap-1   ( 4 px)  PEGADO     partes de una misma cosa   ← SOLO en el CSS");
  console.error("    gap-2   ( 8 px)  JUNTO      cosas del mismo grupo");
  console.error("    gap-3   (12 px)  FILA       elementos de una misma fila");
  console.error("    gap-4   (16 px)  SEPARADO   bloques de una seccion");
  console.error("    gap-6   (24 px)  SECCION    secciones de la pagina");
  console.error("\nSi lo marcado es una PLANTILLA y creias necesitar 4 px: eso es un atomo.");
  console.error("Declaralo como clase en `shared/styles/` y usa la clase, no el hueco suelto.");
  console.error("\nElige el paso por SIGNIFICADO, no por como queda.\n");
  process.exit(1);
}

const enCss = "los huecos del CSS incluidos";
console.log(`check:ritmo OK — ${total} huecos en escala (${enCss}).`);
