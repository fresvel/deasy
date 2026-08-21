#!/usr/bin/env node
/**
 * LA ESCALA DE HUECOS: cuatro pasos y ni uno mas.
 *
 * ══ QUE ES UN «HUECO» AQUI ══════════════════════════════════════════════════════════════════
 * El espacio entre elementos apilados o en fila: `gap-*`, `gap-x-*`, `gap-y-*`, `space-y-*`.
 * No es el padding de una caja —eso es la caja— ni el margen de un titular: es la separacion que
 * un contenedor reparte entre sus hijos.
 *
 * ══ DE DONDE SALE (F13 paso 2, 2026-08-20) ══════════════════════════════════════════════════
 * El dueño observo que «la distribucion de los contenidos es demasiado heterogenea». Medido:
 * **673 huecos en 80 ficheros y ONCE valores distintos** — 2 · 4 · 6 · 8 · 10 · 12 · 14 · 16 ·
 * 20 · 24 · 28 px— para expresar tres o cuatro relaciones. Y la MISMA relacion usaba huecos
 * distintos segun la pantalla: el mismo rotulo en versalita separaba 6 px de su contenido en
 * `/perfil` y 24 en `/procesos`.
 *
 * ══ POR QUE CUATRO Y NO TRES ════════════════════════════════════════════════════════════════
 * El dueño eligio primero TRES (8 · 16 · 24), y el censo completo le hizo cambiar de opinion con
 * razon: **el 12 px es el segundo valor mas usado del proyecto (175 sitios)** y, sobre todo,
 * **647 de los 673 huecos estan escritos como `gap-N`, que fija LOS DOS EJES**. O sea que esto no
 * es «la escala vertical» sino la escala a secas — y en horizontal el 12 es el hueco natural
 * entre un icono y su texto, donde 8 aprieta y 16 separa de mas.
 *
 *     8 px   JUNTO      cosas del mismo grupo
 *    12 px   FILA       elementos de una misma fila (icono y texto, boton y boton)
 *    16 px   SEPARADO   bloques distintos dentro de una seccion
 *    24 px   SECCION    secciones de la pagina
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
 *   · **LOS HUECOS DECLARADOS EN EL CSS**, y esto es deliberado, no un olvido. Censados el
 *     2026-08-20: **35 en escala y 23 fuera**, repartidos por `tags.css`, `nav.css`, `forms.css`,
 *     `buttons.css`… Casi todos son de 2, 4, 6 o 10 px y son **el hueco DENTRO de un atomo** —el
 *     punto de una pastilla y su texto, un icono y su rotulo, la ✕ de un chip—, que es otra cosa
 *     que el ritmo entre bloques: alli 8 px ya es una separacion visible.
 *     Meterlos en esta escala sin decidirlo antes engordaria todos los atomos del sistema. Queda
 *     medido y sin tocar; si algun dia se les da escala propia, sera otra decision y otro techo.
 *   · Un hueco que el CSS pone a un COMPONENTE tampoco se ve aqui aunque salga en pantalla: el
 *     6 px entre el rotulo y el titulo de una cabecera lo declara `.deasy-page-header__copy`, no
 *     una plantilla.
 *   · Huecos compuestos en runtime (`:class` con expresion). Mismo limite que el resto de gates.
 *   · Valores arbitrarios `gap-[13px]`. De eso ya se ocupa `check:no-arbitrary`.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const SRC = resolve(process.argv[2] ?? "src");

/* Los cuatro pasos permitidos, en la notacion de Tailwind (paso x 4 px).
 *
 * ⚠️ EL `0` TAMBIEN ENTRA, Y NO ES UNA GRIETA. «Sin hueco» no es un paso de la escala: es la
 * decision de que el contenedor NO reparte espacio porque lo pone el hijo —el caso de las rejillas
 * de tarjetas, que traen su propio margen—. Prohibirlo obligaria a inventar un `gap-2` y a quitarle
 * el margen a la tarjeta, que es mas cambio y peor. */
const ESCALA = { "0": 0, "2": 8, "3": 12, "4": 16, "6": 24 };

/* Todo lo que la escala NO admite, con su equivalente en pixeles para poder explicarlo. */
const PX = { "0.5": 2, "1": 4, "1.5": 6, "2.5": 10, "3.5": 14, "5": 20, "7": 28,
             "8": 32, "9": 36, "10": 40, "11": 44, "12": 48, "14": 56, "16": 64 };

/* Techo CERO, y aqui si se exige: la escala se acaba de fijar y los 172 sitios fuera de ella
   estan migrados. Un hueco nuevo fuera de los cuatro pasos no es un caso legitimo, es deriva. */
const TECHO = 0;

const ficheros = (dir, acc = []) => {
  for (const n of readdirSync(dir)) {
    const r = join(dir, n);
    if (statSync(r).isDirectory()) ficheros(r, acc);
    else if (r.endsWith(".vue") && !r.includes(".test.")) acc.push(r);
  }
  return acc;
};

const PAT = /\b((?:[a-z]+:)*)(gap-y|gap-x|gap|space-y)-(\d+(?:\.\d+)?)\b/g;
const fuera = [];
let total = 0;

for (const f of ficheros(SRC)) {
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(PAT)) {
    const [, pref, prop, paso] = m;
    total++;
    /* ⚠️ `Object.hasOwn` y NO `if (ESCALA[paso])`: el paso `0` vale 0, que es FALSY, asi que la
       comprobacion por verdad lo daba por fuera de escala justo despues de admitirlo. Un fallo de
       dos caracteres que solo se ve ejecutando. */
    if (Object.hasOwn(ESCALA, paso)) continue;
    fuera.push({
      f: f.replace(SRC + "/", ""),
      n: src.slice(0, m.index).split("\n").length,
      clase: `${pref}${prop}-${paso}`,
      px: PX[paso] ?? "?"
    });
  }
}

if (fuera.length > TECHO) {
  console.error(`\ncheck:ritmo — ${fuera.length} huecos fuera de la escala (techo ${TECHO})\n`);
  for (const x of fuera.slice(0, 25)) console.error(`   ${x.f}:${x.n}  ${x.clase}  (${x.px} px)`);
  if (fuera.length > 25) console.error(`   … y ${fuera.length - 25} mas`);
  console.error("\nLa escala tiene CUATRO pasos y cada uno significa algo:");
  console.error("    gap-2   ( 8 px)  JUNTO      cosas del mismo grupo");
  console.error("    gap-3   (12 px)  FILA       elementos de una misma fila");
  console.error("    gap-4   (16 px)  SEPARADO   bloques de una seccion");
  console.error("    gap-6   (24 px)  SECCION    secciones de la pagina");
  console.error("\nElige el que corresponda por SIGNIFICADO, no por como queda.\n");
  process.exit(1);
}

console.log(`check:ritmo OK — ${total} huecos, los ${total} en la escala de cuatro pasos.`);
