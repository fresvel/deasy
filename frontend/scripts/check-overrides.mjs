#!/usr/bin/env node
/**
 * LO DECLARADO CONTRA LO RENDERIZADO: una utilidad que pisa lo que declara un componente.
 *
 * ══ DE DONDE SALE (2026-08-20, F9.F) ════════════════════════════════════════════════════════
 * Una auditoria comparo, EN EL NAVEGADOR y elemento a elemento, lo que declara la regla de
 * `@layer components` de cada nodo contra lo que declara cualquier regla de capa superior que
 * tambien le casa. Sobre 5 rutas y 428 reglas salieron **17 propiedades pisadas**, y una era un
 * defecto de verdad:
 *
 *   `UnitNode` pintaba el badge del nodo con utilidades crudas y solo tomaba el `--<tono>`. Ese
 *   `ring-1` —capa `utilities`— pisaba el `box-shadow` que el modificador declara en
 *   `components`. Declarado `inset 0 0 0 1px var(--color-line)`; renderizado
 *   `rgb(71,84,103) 0 0 0 1px`. **Los cuatro tonos pintaban el mismo gris oscuro**: el
 *   diccionario decidia el color y el ultimo paso lo tiraba.
 *
 * Ningun gate lo veia, y no por descuido: `css-prune` da verde porque la clase tiene consumidor,
 * `check-orphan-classes` porque existe en el CSS construido, y `check-layer-debt` porque la regla
 * SI esta en su capa. El problema no es donde vive la regla: es **quien mas escribe la misma
 * propiedad en el mismo elemento**.
 *
 * ══ POR QUE ES ESTATICO Y NO UN NAVEGADOR ═══════════════════════════════════════════════════
 * La auditoria midio que **de las 8 parejas encontradas, solo 2 estaban en un `class` literal**;
 * las otras 6 se componian en `:class` con expresion. Eso parecia condenar el analisis estatico
 * — pero al mirarlas una a una result que **el trozo que no se puede resolver casi nunca es el
 * que importa**: en el defecto real, la UTILIDAD estaba en el `class` literal y la clase de
 * componente en un literal de plantilla `` `graph-node__badge--${tono}` ``, cuyo PREFIJO si es
 * texto. Basta con unir todos los literales de los dos atributos y expandir los prefijos contra
 * el CSS construido.
 *
 * Un gate con navegador habria costado una dependencia, la app levantada y un recorrido de rutas
 * que nadie garantiza completo. Este corre en `lint` y no necesita nada.
 *
 * ══ LO QUE NO INTENTA, Y SE DICE PARA QUE NADIE LO CUENTE COMO COBERTURA ═════════════════════
 *   · **Reglas de DESCENDIENTE** (`.deasy-btn svg`). Exigen conocer el arbol, y adivinarlo es
 *     como se inventan los falsos positivos que acaban con un gate apagado. La auditoria
 *     encontro un caso —el icono del boton flotante de chat— y era DELIBERADO.
 *   · Clases que solo existen en tiempo de ejecucion (`classList.add`).
 *   · Que la propiedad pisada IMPORTE. Pisar es a veces la respuesta correcta; por eso hay techo
 *     y no cero, y por eso cada resto va nombrado abajo.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const SRC = resolve(process.argv[2] ?? "src");
const DIST = resolve(new URL("../dist/assets", import.meta.url).pathname);

/* El orden de la cascada. Lo que esta FUERA de toda capa gana a todas, y por eso es el 4. */
const CAPA = { theme: 0, base: 1, components: 2, utilities: 3, "(sin capa)": 4 };

/* ── techo ────────────────────────────────────────────────────────────────────────────────
 * 37, medido el 2026-08-20 sobre el arbol entero. **No es una aspiracion: es el inventario**, y
 * cae en CINCO grupos con dueño. Baja cuando se limpia uno y NUNCA sube.
 *
 *   A · 8 · COLOR sobre una receta tipografica — `deasy-overline` ×5, `deasy-title` ×3.
 *       **LEGITIMO, y por decision escrita**: F2.T cerro el cabo de los overlines con estado
 *       diciendo que «componer una utilidad de color sobre una receta tipografica no es
 *       sobreescribir, es como funciona» — una variante cambia fondo, borde y texto; esto cambia
 *       UNA propiedad. Estos 8 no son deuda y no hay que «arreglarlos».
 *
 *   B · 4 · INTERLINEADO sobre la escala de titulares — `--page` ×1, `--panel` ×2, `--section` ×1.
 *       **Deuda, y es de F2.T**: la escala se fijo el 2026-08-19 y cuatro sitios le quitan el
 *       `line-height` con `leading-tight`/`leading-snug`. O el titular necesita un nivel apretado
 *       —y entonces es un modificador— o sobran las cuatro utilidades.
 *
 *   C · 15 · UN ESTADO ESCRITO CON UTILIDADES — `deasy-picker` ×7, `deasy-card` ×6, `deasy-tile` ×2.
 *       **La deuda mas gorda, y la mas clara.** Son «seleccionado», «resaltado» y «avisado»
 *       pintados con `bg-*` y `border-*` crudos sobre la superficie. Eso es exactamente lo que
 *       este gate dice en su mensaje: si el componente tiene que ceder ahi, es una VARIANTE y va
 *       en el CSS con nombre. Material de F11.
 *
 *   D · 8 · GEOMETRIA PUNTUAL — `deasy-control` ×4 (dos anchos, un padding en cada eje),
 *       `--textarea` sin redimensionar, dos huecos de etiqueta y el `w-auto` del boton de bloque.
 *       Deliberadas: el llamante pide una medida que el componente no puede saber.
 *
 *   E · 2 · UN BOTON DESTRUCTIVO REINVENTADO — `deasy-btn--neutral-outline` + `text-danger` +
 *       `border-red-300`. **Deuda**: G5 ya tiene variante destructiva, y esta la imita a mano —
 *       que es justo el fallo que `check-destructive-actions` vigila desde otro angulo.
 *
 * Resumen: **de las 37, ocho son legitimas por doctrina escrita y ocho son peticiones del
 * llamante; las 21 restantes son deuda con nombre.** El defecto que motivo este gate —el `ring-1`
 * que mataba el borde tintado del badge de nodo— ya esta en cero.
 */
/* [2026-08-20 · F12] BAJA DE 37 A 34 al nacer `deasy-elegible`: los sitios que pintaban
   «elegido» con `bg-*`/`border-*` crudos sobre `deasy-picker` y `deasy-card` dejan de disputarles
   el borde y el fondo. El grupo C baja de 15 a 12. */
const TECHO = 34;

const ficheros = (dir, ext, acc = []) => {
  for (const n of readdirSync(dir)) {
    const r = join(dir, n);
    if (statSync(r).isDirectory()) ficheros(r, ext, acc);
    else if (r.endsWith(ext) && !r.includes(".test.")) acc.push(r);
  }
  return acc;
};

if (!existsSync(DIST)) {
  console.error("\ncheck:overrides — no hay `dist/`. Construye: `pnpm run build`.\n");
  process.exit(1);
}
const css = ficheros(DIST, ".css");
if (!css.length) {
  console.error("\ncheck:overrides — `dist/assets` sin CSS. Construye: `pnpm run build`.\n");
  process.exit(1);
}
/* Misma guarda que `check-orphan-classes`: medir contra un `dist/` rancio da un verde falso, y
   esa trampa ya se pago una vez —el servidor de desarrollo sirvio el CSS anterior y la medicion
   dijo «el radio no cambio», que era falso—. */
const construidoEn = Math.min(...css.map((r) => statSync(r).mtimeMs));
const fuenteMasNueva = Math.max(
  ...[...ficheros(join(SRC, "shared/styles"), ".css"), ...ficheros(SRC, ".vue")].map((r) => statSync(r).mtimeMs)
);
if (fuenteMasNueva > construidoEn) {
  console.error("\ncheck:overrides — el `dist/` es mas viejo que el codigo. Construye antes.\n");
  process.exit(1);
}

/* ── 1 · el CSS construido -> clase => { propiedad: valor } con su capa ───────────────────── */
const hoja = css.map((r) => readFileSync(r, "utf8")).join("\n");
const declara = new Map();   /* clase -> { capa, props } */

const guarda = (sel, capa, cuerpo) => {
  /* Solo selectores de UNA clase, o listas de ellos. Los descendientes se ignoran a proposito. */
  for (const parte of sel.split(",")) {
    const m = /^\s*\.((?:\\.|[\w-])+)\s*$/.exec(parte);
    if (!m) continue;
    const clase = m[1].replaceAll("\\", "");
    const props = {};
    for (const d of cuerpo.split(";")) {
      const i = d.indexOf(":");
      if (i < 0) continue;
      const p = d.slice(0, i).trim();
      if (!p || p.startsWith("--") || p.startsWith("/*")) continue;
      props[p] = d.slice(i + 1).trim();
    }
    if (!Object.keys(props).length) continue;
    const previo = declara.get(clase);
    /* Si la clase se declara varias veces, gana la ultima de la capa mas alta. */
    if (previo && CAPA[previo.capa] > CAPA[capa]) { Object.assign(previo.props, {}); continue; }
    declara.set(clase, { capa, props: { ...(previo?.props ?? {}), ...props } });
  }
};

/* Recorrido con conteo de llaves para saber en que `@layer` cae cada regla. */
let i = 0, capas = [];
while (i < hoja.length) {
  const abre = hoja.indexOf("{", i);
  if (abre < 0) break;
  const cabecera = hoja.slice(i, abre).trim().split("}").pop().trim();
  if (cabecera.startsWith("@")) {
    const m = /^@layer\s+([\w-]+)/.exec(cabecera);
    capas.push(m ? m[1] : (capas.at(-1) ?? null));
    i = abre + 1;
    continue;
  }
  /* Regla normal: buscar su llave de cierre. */
  let d = 1, j = abre + 1;
  while (j < hoja.length && d > 0) { if (hoja[j] === "{") d++; else if (hoja[j] === "}") d--; j++; }
  guarda(cabecera, capas.at(-1) ?? "(sin capa)", hoja.slice(abre + 1, j - 1));
  i = j;
  /* Cerrar capas cuyo bloque termino. */
  while (capas.length && hoja[i] === "}") { capas.pop(); i++; }
}

const componentes = [...declara].filter(([, v]) => v.capa === "components").map(([k]) => k);

/* ── 2 · las plantillas -> por elemento, la union de sus fichas de clase ──────────────────── */
const ATRIB = /(?::|v-bind:)?(?:class|class-name|className)\s*=\s*"([^"]*)"/g;
const ELEMENTO = /<[A-Za-z][\w.-]*((?:\s+[^<>]*?)?)\/?>/g;

const expande = (ficha) => {
  /* Un literal de plantilla con `${}` deja un PREFIJO utilizable. `graph-node__x--` casa con
     todas las clases declaradas que empiecen asi, y eso basta: comparten la propiedad. */
  if (!ficha.endsWith("--") && !ficha.endsWith("-")) return declara.has(ficha) ? [ficha] : [];
  return [...declara.keys()].filter((c) => c.startsWith(ficha));
};

const hallazgos = [];
for (const f of ficheros(SRC, ".vue")) {
  const fuente = readFileSync(f, "utf8");
  const plantilla = /<template>([\s\S]*)<\/template>/.exec(fuente)?.[1] ?? fuente;
  for (const el of plantilla.matchAll(ELEMENTO)) {
    const attrs = el[1] ?? "";
    const fichas = new Set();
    for (const [, valor] of attrs.matchAll(ATRIB)) {
      /* Del atributo estatico, sus tokens. De la expresion, todo literal de texto que contenga. */
      for (const lit of [valor, ...[...valor.matchAll(/'([^']*)'|`([^`]*)`/g)].map((m) => m[1] ?? m[2])]) {
        for (const t of String(lit).split(/[\s${}?:+]+/)) if (t) fichas.add(t.replace(/\$$/, ""));
      }
    }
    const clases = [...new Set([...fichas].flatMap(expande))];
    const propios = clases.filter((c) => declara.get(c)?.capa === "components");
    if (!propios.length) continue;
    const linea = plantilla.slice(0, el.index).split("\n").length
      + (fuente.slice(0, fuente.indexOf(plantilla)).split("\n").length - 1);
    for (const c of propios) {
      for (const o of clases) {
        if (o === c) continue;
        const ro = declara.get(o);
        if (!ro || CAPA[ro.capa] <= CAPA.components) continue;
        for (const [p, v] of Object.entries(declara.get(c).props)) {
          if (ro.props[p] !== undefined && ro.props[p] !== v) {
            hallazgos.push({ f: f.replace(SRC + "/", ""), n: linea, comp: c, prop: p, util: o, capa: ro.capa });
          }
        }
      }
    }
  }
}

/* Una pareja clase+utilidad es UN hallazgo aunque pise seis longitudes de borde a la vez. */
const parejas = new Map();
for (const h of hallazgos) {
  const k = `${h.comp} + ${h.util}`;
  if (!parejas.has(k)) parejas.set(k, { ...h, props: new Set(), sitios: new Set() });
  parejas.get(k).props.add(h.prop);
  parejas.get(k).sitios.add(`${h.f}:${h.n}`);
}
const lista = [...parejas.values()].sort((a, b) => b.sitios.size - a.sitios.size);

if (lista.length > TECHO) {
  console.error(`\ncheck:overrides — una utilidad pisa lo que declara un componente: ${lista.length} parejas (techo ${TECHO})\n`);
  for (const x of lista.slice(0, 40)) {
    console.error(`   .${x.comp}  ·  ${[...x.props].sort().join(", ")}  ←  .${x.util} [${x.capa}]`);
    for (const s of [...x.sitios].slice(0, 3)) console.error(`        ${s}`);
  }
  console.error("\nUna clase de componente solo pinta lo que ninguna utilidad del mismo elemento le dispute.");
  console.error("  · si la utilidad sobra, quitala: la clase ya lo declara;");
  console.error("  · si el componente tiene que ceder ahi, eso es una VARIANTE, y va en el CSS con nombre;");
  console.error("  · si es deliberado y puntual, subelo al techo de este fichero CON SU MOTIVO ESCRITO.\n");
  process.exit(1);
}

console.log(`check:overrides OK — ${lista.length}/${TECHO} parejas, sobre ${componentes.length} clases de componente.`);
