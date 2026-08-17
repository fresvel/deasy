#!/usr/bin/env node
/* ¿HAY UNA ALTURA SIN NOMBRE?
 *
 * El gate veintiuno. Vigila el eje que decide QUIEN TAPA A QUIEN, que hasta F5.3 se escribia con
 * numeros sueltos y sin ninguna puerta.
 *
 * ── LO QUE HABIA ───────────────────────────────────────────────────────────────────────────────
 *
 * Diecinueve pisos, ninguno con nombre, en CUATRO grafias que ningun gate podia relacionar:
 *
 *   utilidad          `z-50`, `z-1080`, `z-1190`      en las plantillas
 *   arbitraria        `z-[1075]`, `z-[1100]`          se saltan hasta el gate de arbitrarios? no,
 *                                                     ese si las veia — pero como numero, no como
 *                                                     capa: para el eran dos mas del monton
 *   CSS crudo         `z-index: 1070;`                cuatro reglas
 *   JavaScript        `:style="{ zIndex: 1090 }"`     SIETE, y estas no las veia NADIE
 *
 * Se coordinaban por comentario. `dialogs.css` decia «un escalon por debajo del 1075 de
 * AppDialogOverlay.vue» y ese fichero llevaba dos dias borrado. `SNotify.vue` documentaba con
 * detalle que sus 1190/1200 eran «numeros PROVISIONALES». Asi salieron tres fallos que nadie vio:
 *
 *   1. el aviso valia 1080 y los modales apilados 1090 y 1100, o sea que **un «guardado» disparado
 *      desde un modal quedaba detras del propio modal** — justo cuando mas falta hacia;
 *   2. la confirmacion del asistente valia 1075 y el asistente 1080: **el hijo por debajo del
 *      padre**;
 *   3. el contenedor del mapa llevaba un `z-10` que parecia un no-op y era lo unico que impedia
 *      que los 1000 de Leaflet taparan la barra superior.
 *
 * Ninguno lo ve el build, ni el lint, ni los tests: los tres renderizan perfectamente.
 *
 * ── LA SEÑAL ───────────────────────────────────────────────────────────────────────────────────
 *
 * Tres, una por grafia, y las tres con techo CERO porque la escala ya cubre los dos ejes enteros:
 *
 *   S1 · plantilla     una utilidad `z-N` o `z-[N]`. La forma con nombre —`z-(--z-modal)`— lleva
 *                      parentesis y no casa, que es justo lo que se quiere.
 *   S2 · CSS propio    un `z-index:` con un numero literal en `src/shared/styles/`. Con `var()` no
 *                      casa. No se mira el CSS de librerias: sus numeros son suyos.
 *   S3 · JavaScript    un `zIndex` con numero literal, en `<script>` o en `.js`.
 *
 * ⚠️ S3 tiene UNA excepcion declarada, y conviene entender por que no es una grieta:
 * `modalController.js` reparte alturas EN EJECUCION (`el.style.zIndex = topZ + 1`) para que un
 * modal abierto desde otro quede encima sin que nadie tenga que numerarlo. Eso es legitimo y es la
 * pieza que hace que los cinco niveles no se queden cortos. Lo que NO puede es inventarse el
 * suelo: lo lee de `--z-modal`. Por eso la excepcion es el fichero, no el patron — si aparece un
 * segundo repartidor, el gate lo caza.
 *
 * Y una cosa que este gate NO comprueba, para que no se confie en el: **que la altura sirva de
 * algo**. Un `z-index` sobre un elemento `static` no hace nada, y un hijo dentro de un ancestro
 * posicionado con altura propia no puede salir de el por mucho que suba. Eso sigue siendo trabajo
 * del navegador y de mirar.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const RAIZ = new URL("..", import.meta.url).pathname;
const SRC = join(RAIZ, "src");
const ESTILOS = join(SRC, "shared/styles");

/* El unico repartidor de alturas en ejecucion. Ver la nota de S3. */
const REPARTIDOR = "src/shared/utils/modalController.js";

const TECHO = { S1: 0, S2: 0, S3: 0 };

const ficheros = (dir, ext) => {
    const salida = [];
    for (const nombre of readdirSync(dir)) {
        if (nombre === "node_modules" || nombre === "dist") continue;
        const ruta = join(dir, nombre);
        if (statSync(ruta).isDirectory()) salida.push(...ficheros(ruta, ext));
        else if (ext.some((e) => nombre.endsWith(e))) salida.push(ruta);
    }
    return salida;
};

/* Los comentarios cuentan la historia vieja a proposito —«este panel vivia en z-[50]»— y no son
   codigo. Se quitan antes de mirar, o el gate se dispara con su propia documentacion. */
const sinComentarios = (texto) =>
    texto
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");

const hallazgos = { S1: [], S2: [], S3: [] };

const anota = (senal, ruta, texto, patron) => {
    const limpio = sinComentarios(texto);
    const lineas = limpio.split("\n");
    lineas.forEach((linea, i) => {
        for (const m of linea.matchAll(patron)) {
            hallazgos[senal].push({
                fichero: relative(RAIZ, ruta),
                linea: i + 1,
                texto: m[0]
            });
        }
    });
};

/* S1 · la utilidad numerica. `(?![\w(-])` descarta `z-(--z-modal)` y cualquier `z-10x` inventado. */
const S1 = /(?<![\w-])z-(?:\[[^\]]+\]|\d+)(?![\w-])/g;
for (const f of ficheros(SRC, [".vue"])) anota("S1", f, readFileSync(f, "utf8"), S1);

/* S2 · el numero crudo en nuestro CSS. `z-index: var(--z-…)` no casa. */
const S2 = /z-index:\s*-?\d+/g;
for (const f of ficheros(ESTILOS, [".css"])) anota("S2", f, readFileSync(f, "utf8"), S2);

/* S3 · el numero en JavaScript. */
const S3 = /zIndex\s*[:=]\s*['"`]?-?\d+/g;
for (const f of ficheros(SRC, [".vue", ".js", ".mjs"])) {
    if (relative(RAIZ, f) === REPARTIDOR) continue;
    anota("S3", f, readFileSync(f, "utf8"), S3);
}

const NOMBRE = {
    S1: "utilidad numerica en plantilla",
    S2: "z-index literal en el CSS propio",
    S3: "zIndex literal en JavaScript"
};

let roto = false;
for (const senal of ["S1", "S2", "S3"]) {
    const n = hallazgos[senal].length;
    if (n > TECHO[senal]) {
        roto = true;
        console.error(`\n✗ ${senal} · ${NOMBRE[senal]}: ${n} (techo ${TECHO[senal]})`);
        for (const h of hallazgos[senal].slice(0, 20)) {
            console.error(`    ${h.fichero}:${h.linea}  ${h.texto}`);
        }
        if (n > 20) console.error(`    … y ${n - 20} mas`);
    }
}

if (roto) {
    console.error(`
  La escala esta en src/shared/styles/tokens.css. Elige por MAGNITUD:

    dentro de un contenedor    z-(--z-capa-fondo|base|elemento|activo|controles|emergente|velo)
    en toda la pagina          z-(--z-menu-lateral|barra-superior|panel-chat|aviso|…)
    un modal                   no escribas altura: <AppModalShell nivel="2">
`);
    process.exit(1);
}

console.log(
    `check:z-index OK — ninguna altura sin nombre (S1 ${hallazgos.S1.length}/0 · ` +
        `S2 ${hallazgos.S2.length}/0 · S3 ${hallazgos.S3.length}/0).`
);
