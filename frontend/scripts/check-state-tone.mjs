#!/usr/bin/env node
/* ¿ALGUIEN VUELVE A PINTAR UN ESTADO A MANO?
 *
 * El gate que cierra F3.3, y el unico de los dieciocho que mira DENTRO del JavaScript.
 *
 * ── POR QUE HACE FALTA ─────────────────────────────────────────────────────────────────────
 *
 * F3.3 empezo con un enunciado —«73 colores de grafo en ocho ficheros»— que no resistio la
 * medicion. Lo que habia de verdad eran **27 valores en 8 ejes repartidos por 20+ ficheros**, y el
 * color no vivia en el CSS sino en **~20 funciones de JavaScript** que devolvian cadenas de
 * utilidades:
 *
 *     const changeClass = (c) => ({ changed: "bg-amber-50 text-warning ring-amber-200", … }[c]);
 *
 * Los diecisiete gates anteriores no podian ver ni una: `css-prune` mira el CSS, `check-variants`
 * mira atributos literales de plantilla, `check-orphan-classes` mira el CSS construido. Una clase
 * dentro de una cadena de JavaScript no esta en ninguno de esos sitios. Por eso duro meses, y por
 * eso dos funciones que leian **el mismo campo de la misma tabla** pintaban `draft` y `retired`
 * **al reves una de otra** sin que nadie se enterara.
 *
 * ── LAS TRES SEÑALES ───────────────────────────────────────────────────────────────────────
 *
 * S1 · LA PASTILLA A MANO (plantillas). La coexistencia, en el MISMO atributo, de un relleno
 *      tintado y un token de texto semantico. Ese par no aparece por casualidad: es la definicion
 *      de «estoy pintando un estado a mano en vez de usar `AppTag`».
 *
 * S2 · EL COLOR EN JAVASCRIPT. Un literal de cadena con DOS O MAS utilidades portadoras de color.
 *      Es la forma exacta de las ~43 cadenas de los mapas que F3.3 desmonto. Dos y no una a
 *      proposito: una sola utilidad suele ser un `text-muted` legitimo en una plantilla; dos
 *      juntas en una cadena de JS son una receta.
 *
 * S3 · EL LITERAL `deasy-tag--X`. Escribir la clase de la pastilla saltandose `AppTag`, que es
 *      saltarse su validacion. `AdminEditorModal` lo hacia con el esquema correcto, asi que ni
 *      siquiera se veia mal — pero una variante inexistente ahi sale invisible y sin fallar.
 *
 * S4 · EL DICCIONARIO DE TONO FUERA DE SU SITIO (añadida el 2026-08-20, F9-bis). Dos o mas
 *      NOMBRES DE TONO distintos —`success`, `warning`, `salmon`…— apareciendo como valor de una
 *      entrada de objeto o de un `return`, dentro de un bloque de <=8 lineas de JavaScript. Esa
 *      forma es literalmente un diccionario valor -> tono, y su sitio es `estadoTono.js`.
 *
 *      ⚠️ ES LA SEÑAL QUE FALTABA, Y SU AUSENCIA COSTO CUATRO MESES. S2 caza el COLOR en
 *      JavaScript (dos utilidades de Tailwind en una cadena) y por eso no veia esto: un mapa que
 *      devuelve el NOMBRE del tono es exactamente lo que F3.3 pedia, solo que escrito en el
 *      fichero equivocado. Asi sobrevivieron NUEVE traductores en `modules/home/` mientras el
 *      gate daba verde — y no eran copias: se contradecian en `pendiente`, `en proceso`,
 *      `cancelado` y `activo`.
 *
 * ── LO QUE NO INTENTA ──────────────────────────────────────────────────────────────────────
 *
 * No evalua expresiones dinamicas. `check-variants.mjs` ya documenta por que adivinar expresiones
 * es como se inventan los falsos positivos que acaban con el gate apagado. Se ataca por el otro
 * extremo: los ternarios con literales SI son texto, y los mapas tambien.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const RAIZ = process.argv[2] ?? "src";
const CSS = "src/shared/styles/tags.css";

/* Los techos son trinquetes: bajan cuando se limpia algo y NUNCA suben. Estos tres son lo MEDIDO
   al cerrar F3.3, no una aspiracion, y cada resto tiene dueño:
 *
 *   S1 = 13. **Ninguno es una pastilla**: son BANNERS informativos con el trio
 *        `border-blue-light-200 + bg-blue-light-50 + text-info` repetido tal cual en 8 sitios, mas
 *        un stepper y un item seleccionado de un desplegable, que no son estado sino turno y
 *        seleccion. Los 8 banners son `AppAlert` sin migrar, o sea **trabajo de F2** («propagar
 *        las seis extracciones: 14 -> 74 alertas»), no de esta fase. Meterlos aqui habria sido
 *        hacer F2 dentro de L7.
 *
 *   S2 = 0 desde el 2026-08-20, y **eran las cuatro de `AppNavCard`**. Este comentario decia
 *        que «son material de F4/F8 si algun dia se colapsan», y ese dia fue F8: sus dos pares de
 *        cadenas resultaron ser **identicas salvo el TAMAÑO** —`h-11 w-11 shrink-0` frente a
 *        `h-12 w-12`—, con los colores escritos dos veces. La receta vive ahora en
 *        `deasy-nav-card` y `deasy-nav-card__icon`, y el `computed` solo nombra el modificador.
 *
 *        **Aqui se exige CERO a partir de hoy**, y no es aspiracion: es lo medido. S2 es la señal
 *        que define F8 —color viviendo en JavaScript— y la fase se cierra con ella vacia.
 *
 *   S3 = 0, y aqui si se exige cero: escribir `deasy-tag--*` a mano es saltarse la validacion de
 *        `AppTag`, y eso no tiene excusa ni caso legitimo. */
/* ⚠️ S1 BAJA DE 13 A 9 el 2026-08-19, y el motivo estaba escrito ARRIBA desde F3.3: los banners
   con el trio `border-blue-light-200 + bg-blue-light-50 + text-info` eran «`AppAlert` sin migrar,
   o sea trabajo de F2». **F2 se cerro sin llevarselos**, porque su migracion busco la clase
   `deasy-alert` y estos estaban escritos con utilidades crudas — la misma frase de esta cabecera
   los daba por pendientes y nadie la releyo al cerrar F2.
   Los cuatro que quedaban son `<AppAlert variant="info">` desde hoy. De los nueve que restan,
   NINGUNO es un estado: 2 son fila seleccionada, 2 son firmante/campo elegido, 1 es paso de
   asistente, 1 una caja de icono con hover, y 3 son «Cargando…» — que no son estado sino ESPERA,
   y tienen su propio hallazgo abierto (`Loading.vue`, 1 consumidor frente a 35 a mano). */
/* S4 = 4, medido el 2026-08-20 tras mudar los nueve traductores. Los cuatro que quedan NO
   traducen un vocabulario: deciden por PREDICADO, que es justo lo que la doctrina de
   `estadoTono.js` deja en el componente («si la funcion pregunta por los DATOS, se queda»).
     · `AdminProcessWizardShell.tonoPaso`        — paso completo / paso actual
     · `RoutedProcessPanel.receivedRole`         — que te toca hacer con lo recibido
     · `useDeliverableView` (responsabilidad)    — en que fase esta el entregable
     · `useDeliverableView` (vencimiento)        — dias al vencimiento, un continuo como
                                                   `coberturaEstado`, no un enum
   Si tu caso es uno de esos, deja el techo. Si traduce un `status` de la base, no. */
const TECHO = { s1: 7, s2: 0, s3: 0, s4: 4 };
/* [2026-08-20 · F12] S1 BAJA DE 9 A 7. Los dos que se van son el aviso de requisitos de
   `AdminDefinitionRulesPanel` —que era `AppAlert` escrito a mano con `amber`— y la caja de
   «Todo al dia» de `HomeView`. La cabecera de arriba ya los daba por \«`AppAlert` sin migrar\»
   desde F3.3; F2 no se los llevo porque buscaba la clase `deasy-alert` y estos estaban escritos
   con utilidades crudas. Es la SEGUNDA vez que ese mismo hueco cuesta una tanda. */

/* ── vocabulario ─────────────────────────────────────────────────────────────────────────────
 *
 * ⚠️ LOS NEUTROS QUEDAN FUERA DE LOS DOS LADOS, y la primera version del gate no lo hacia: admitia
 * `bg-surface` como relleno y `text-muted`/`text-icon` como tinta, y con eso daba **79 avisos de
 * los que casi ninguno era un estado**. Una caja gris con texto apagado es una superficie —un
 * vacio, un panel, un contador—, no una pastilla. Medir de mas es como se apaga un gate.
 *
 * Un ESTADO pintado a mano tiene las dos mitades tintadas por una familia que SIGNIFICA algo. */
const RELLENO = /\bbg-(?:success|error|warning|blue-light|orange|brand)-(?:50|100)\b/;
const TINTA = /\btext-(?:success|danger|warning|info|pending)\b/;
const PORTA = /\b(?:bg|text|border|ring|from|via|to|fill|stroke|divide|outline)-(?:[a-z-]+-\d{2,3}|success|danger|warning|info|muted|icon|primary|pending|line|line-strong|surface)\b/g;

/* Ficheros que declaran el vocabulario en vez de gastarlo: el diccionario nombra tonos, y los
   gates hablan de clases porque su trabajo es buscarlas. */
const EXENTOS = [
  "shared/utils/estadoTono.js",
  "shared/components/data/AppTag.vue",
  "shared/components/feedback/AppAlert.vue",
];

const listar = (d, out = []) => {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) listar(p, out);
    else if (/\.(vue|js|mjs)$/.test(p) && !/\.test\.(js|mjs)$/.test(p)) out.push(p);
  }
  return out;
};

/* Blanquea comentarios CONSERVANDO los saltos de linea, para no mover la numeracion: los
   comentarios de este repo citan clases a punta pala y ninguna de esas citas es codigo. */
const sinComentarios = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "))
   .replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p + " ".repeat(m.length - p.length));

const linea = (src, i) => src.slice(0, i).split("\n").length;

const variantesVivas = new Set(
  [...readFileSync(CSS, "utf8").matchAll(/\.deasy-tag--([a-z]+)\b/g)].map((m) => m[1])
);

const s1 = [], s2 = [], s3 = [], s4 = [];

/* Los ocho nombres del vocabulario, que declara `TONOS` en `estadoTono.js`. */
const TONO = "success|warning|danger|info|salmon|accent|primary|neutral";
/* Un valor de entrada de objeto (`clave: "success"`) o un `return "success"`. NO una cadena
   suelta: `mostrarToast(msg, "success")` es una severidad, no un diccionario, y contarla era
   el 90 % del ruido de la primera calibracion. */
/* ⚠️ CON `g`, Y NO ES UN DETALLE: la primera version usaba `exec` sin bandera global y por eso
   solo veia UNA entrada por linea. Un diccionario de tres tonos escrito en una sola linea
   —`{ pendiente: "warning", hecho: "success", roto: "danger" }`, que es la forma mas comun—
   quedaba con un unico tono distinto y no llegaba al minimo de dos. Lo destapo probar el gate
   en rojo; sin esa prueba habria nacido ciego y dando verde, que es peor que no tenerlo. */
const DICCIONARIO = new RegExp(
  `(?:[{,]\\s*|^\\s*)["']?[\\w .]+["']?\\s*:\\s*["'](${TONO})["']|return\\s+["'](${TONO})["']`,
  "g"
);

for (const f of listar(RAIZ)) {
  if (EXENTOS.some((e) => f.endsWith(e))) continue;
  const bruto = readFileSync(f, "utf8");
  const src = sinComentarios(bruto);
  const rel = f.replace(/^src\//, "");

  /* ── S1: relleno tintado + tinta semantica en el MISMO atributo ─────────────────────────── */
  for (const m of src.matchAll(/(?::?class(?:-name)?)\s*=\s*"([^"]*)"/g)) {
    if (RELLENO.test(m[1]) && TINTA.test(m[1])) {
      s1.push({ f: rel, n: linea(src, m.index), t: m[1].slice(0, 70) });
    }
  }

  /* ── S2: una cadena de JS con dos o mas portadoras de color ─────────────────────────────── */
  const guion = f.endsWith(".vue")
    ? [...src.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => ({ txt: m[1], off: m.index }))
    : [{ txt: src, off: 0 }];
  for (const { txt, off } of guion) {
    for (const m of txt.matchAll(/(['"`])((?:[^'"`\\\n]|\\.)*)\1/g)) {
      const u = m[2].match(PORTA);
      if (u && u.length >= 2) s2.push({ f: rel, n: linea(src, off + m.index), t: m[2].slice(0, 66), c: u.length });
    }
  }

  /* ── S4: dos o mas NOMBRES de tono juntos = un diccionario fuera de `estadoTono.js` ────── */
  if (!rel.startsWith("shared/utils/estadoTono")) {
    for (const { txt, off } of guion) {
      const filas = txt.split("\n");
      const marcas = [];
      filas.forEach((l, i) => {
        for (const m of l.matchAll(DICCIONARIO)) marcas.push({ n: linea(src, off) + i, t: m[1] ?? m[2] });
      });
      /* Agrupar por cercania: un diccionario ocupa lineas contiguas. */
      let grupo = [];
      const cerrar = () => {
        const tonos = new Set(grupo.map((x) => x.t));
        if (tonos.size >= 2) {
          s4.push({ f: rel, n: grupo[0].n, hasta: grupo.at(-1).n, tonos: [...tonos].sort().join(" ") });
        }
        grupo = [];
      };
      for (const m of marcas) {
        if (grupo.length && m.n - grupo.at(-1).n > 8) cerrar();
        grupo.push(m);
      }
      if (grupo.length) cerrar();
    }
  }

  /* ── S3: el literal `deasy-tag--X` fuera de AppTag ──────────────────────────────────────── */
  for (const m of src.matchAll(/deasy-tag--([a-z]+)/g)) {
    const v = m[1];
    if (["sm", "outlined", "truncate"].includes(v)) continue;   /* modificadores, no variantes */
    s3.push({ f: rel, n: linea(src, m.index), v, existe: variantesVivas.has(v) });
  }
}

const informe = (nombre, lista, techo, pinta) => {
  if (lista.length <= techo) return false;
  console.error(`\ncheck:state-tone — ${nombre}: ${lista.length} (techo ${techo})\n`);
  for (const x of lista.slice(0, 25)) console.error("   " + pinta(x));
  if (lista.length > 25) console.error(`   … y ${lista.length - 25} mas`);
  return true;
};

let falla = false;
falla = informe("S1 · pastillas de estado escritas a mano", s1, TECHO.s1,
  (x) => `${x.f}:${x.n}  ${x.t}`) || falla;
falla = informe("S2 · color viviendo en JavaScript", s2, TECHO.s2,
  (x) => `${x.f}:${x.n}  [${x.c}] ${x.t}`) || falla;
falla = informe("S3 · `deasy-tag--*` escrito a mano, saltandose AppTag", s3, TECHO.s3,
  (x) => `${x.f}:${x.n}  deasy-tag--${x.v}${x.existe ? "" : "   ⚠️ ESA VARIANTE NO EXISTE"}`) || falla;
falla = informe("S4 · un diccionario valor -> tono fuera de `estadoTono.js`", s4, TECHO.s4,
  (x) => `${x.f}:${x.n}${x.hasta > x.n ? `-${x.hasta}` : ""}  ${x.tonos}`) || falla;

/* El resumen se imprime SIEMPRE, tambien al fallar. Un gate que al ponerse rojo esconde los
   otros contadores obliga a bajar techos a ciegas: la primera version de este callaba S2 y S3
   mientras S1 estuviera por encima, y hubo que tocarlo para poder calibrarlo. */
console.error(`\n   [resumen] S1 ${s1.length}/${TECHO.s1} · S2 ${s2.length}/${TECHO.s2} · S3 ${s3.length}/${TECHO.s3} · S4 ${s4.length}/${TECHO.s4}`);

if (falla) {
  console.error("\nEl estado se nombra, no se pinta:");
  console.error("  · el valor -> tono se traduce en `shared/utils/estadoTono.js`;");
  console.error("  · el tono -> color lo resuelve el CSS (`deasy-tag--*`, `deasy-icon-box--*`, …);");
  console.error("  · en la plantilla van `<AppTag :variant>` o `<AppAlert :variant>`, nunca la clase cruda.");
  console.error("Si tu caso NO es estado sino decoracion (un degradado, una escala, un tono ciclico),");
  console.error("no lo metas en el diccionario: dilo en el codigo y deja el techo donde esta.\n");
  process.exit(1);
}

console.log(`check:state-tone OK — S1 ${s1.length}/${TECHO.s1} · S2 ${s2.length}/${TECHO.s2} · S3 ${s3.length}/${TECHO.s3} · S4 ${s4.length}/${TECHO.s4}.`);
