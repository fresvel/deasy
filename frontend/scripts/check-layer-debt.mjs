#!/usr/bin/env node
/* ¿HAY UNA REGLA QUE GANE POR DECRETO, O DOS QUE SE DISPUTEN LO MISMO?
 *
 * El gate veintidos, y nace de la fase que mas defectos invisibles destapo.
 *
 * ── LO QUE VIGILA, Y POR QUE NINGUN OTRO LO VE ─────────────────────────────────────────────────
 *
 * En CSS, una regla FUERA de `@layer` gana **siempre** a una capada, por especifica que sea. No es
 * una preferencia de estilo: es que la regla capada deja de existir a efectos practicos, aunque se
 * lea perfecta en su fichero. `frontend/CLAUDE.md` §8 llama a esto «el patron dominante del repo».
 *
 * F6 lo desmonto y el recuento fue: **34 selectores fuera de capa -> 8**, de los que 5 son
 * legitimos. Por el camino aparecieron, todos invisibles para las 21 puertas que ya existian:
 *
 *   · 223 utilidades escritas sobre controles que **no llegaban al DOM**;
 *   · el **estado de error de un campo** que no se veia — lo usa el formulario de crear cuenta;
 *   · los 40 campos de autenticacion pintando 8 px de radio cuando su receta pedia 16;
 *   · **cuatro ficheros desmentidos en silencio** desde el final del CSS: `surfaces.css` retiraba
 *     una sombra a proposito, `admin.css` la ponia en `none`, `auth.css` pedia una mayor y
 *     `nav.css` pedia fondo transparente;
 *   · dos halos radiales del fondo de autenticacion que **no se habian visto nunca**, borrados por
 *     una propiedad ABREVIADA que vacia las longhand que no nombra.
 *
 * ── LAS DOS SEÑALES ───────────────────────────────────────────────────────────────────────────
 *
 * **S1 · una regla fuera de `@layer` en nuestro CSS.** Techo CERO, con una lista blanca explicita
 * y corta. La doctrina (§2.11) reserva ese privilegio para lo que pelea con una hoja de tercero
 * sin capa, y hoy solo hay una: `@vue-flow/core`.
 *
 * **S2 · dos reglas de la MISMA especificidad disputandose la misma propiedad sobre el mismo
 * selector base.** Esta es la que faltaba, y tiene nombre y fecha: al capar el foco del control lo
 * deje al final de `forms.css`, y desde ahi se comio el borde rojo del estado de error — **un
 * campo invalido se veia AZUL justo mientras el usuario lo corregia**. Las tres puertas que
 * podrian haberlo visto dieron verde, porque miden otra cosa:
 *
 *     css-prune              que la clase declarada tenga consumidor
 *     check-orphan-classes   que la clase escrita exista en el CSS construido
 *     check-selector-reach   que el selector pueda casar con algun nodo
 *
 * Ninguna mira **quien gana**. A igual especificidad y misma capa decide el orden del fichero, y
 * eso no es un empate: es una regla muerta y otra viva, sin que nada avise.
 *
 * ⚠️ Lo que S2 NO pretende: no evalua la cascada de verdad —eso solo lo hace el navegador— ni
 * senala como error toda pareja. Muchas son legitimas (`:hover` sobre reposo, un modificador sobre
 * su base). Lo que hace es EXIGIR QUE ESTEN JUNTAS: si dos reglas se disputan una propiedad, tienen
 * que verse en la misma pantalla del editor, no a 250 lineas. La distancia es lo que convierte un
 * conflicto deliberado en uno accidental.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const RAIZ = new URL("..", import.meta.url).pathname;
const ESTILOS = join(RAIZ, "src/shared/styles");

/* ── LA LISTA BLANCA DE S1, y cada entrada con su motivo ─────────────────────────────────────────
 * Corta a proposito. Si crece, la fase se esta deshaciendo. */
const PERMITIDO = [
    {
        prueba: (sel) => sel.startsWith(".vue-flow__"),
        motivo: "@vue-flow/core sirve su CSS sin capa; cualificarlo desde una capa no le ganaria"
    },
    {
        prueba: (sel) => sel === ":root",
        motivo: "los tokens no pueden ir en capa: `@theme` y `:root` son la definicion, no una regla"
    }
];

/* Distancia maxima, en lineas, entre dos reglas que se disputan una propiedad. Cincuenta caben en
   una pantalla; a partir de ahi el conflicto deja de ser visible para quien edita. */
const CERCA = 50;

/* Propiedades cuyo conflicto duele y se puede leer sin ejecutar CSS. No estan todas a proposito:
   una lista larga produce ruido, y un gate ruidoso se apaga. */
const DISPUTABLES = new Set([
    "border-color", "background", "background-color", "color", "box-shadow", "border-radius"
]);

const ficheros = (dir) =>
    readdirSync(dir)
        .filter((n) => n.endsWith(".css"))
        .map((n) => join(dir, n));

const sinComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));

/* Un solo recorrido lineal con pila de bloques. Devuelve cada regla con su linea real y si esta
   dentro de alguna `@layer` — la version anterior calculaba las lineas con desplazamientos y daba
   61 donde habia 13, lo que invalidaba la señal entera. Medir mal es peor que no medir. */
const analiza = (ruta) => {
    const t = sinComentarios(readFileSync(ruta, "utf8"));
    const reglas = [];
    const fuera = [];
    const pila = [];
    let linea = 1;
    let inicioSel = 0;
    for (let i = 0; i < t.length; i++) {
        const ch = t[i];
        if (ch === "\n") { linea++; continue; }
        if (ch === "{") {
            const prelude = t.slice(inicioSel, i).trim().replace(/\s+/g, " ");
            const esLayer = /^@layer\b/.test(prelude);
            const esAtRule = prelude.startsWith("@");
            const capado = esLayer || pila.some((b) => b.capado);
            if (!esAtRule && prelude) {
                /* el cuerpo llega hasta su llave de cierre */
                let d = 1, j = i + 1;
                while (j < t.length && d) {
                    if (t[j] === "{") d++;
                    else if (t[j] === "}") d--;
                    j++;
                }
                const cuerpo = t.slice(i + 1, j - 1);
                for (const s of prelude.split(",").map((x) => x.trim()).filter(Boolean)) {
                    reglas.push({ sel: s, cuerpo, linea });
                    if (!capado) fuera.push({ sel: s, linea });
                }
            }
            pila.push({ capado });
            inicioSel = i + 1;
            continue;
        }
        if (ch === "}") { pila.pop(); inicioSel = i + 1; }
    }
    return { fuera, reglas };
};

/* ── S1 ─────────────────────────────────────────────────────────────────────────────────────── */
const s1 = [];
for (const f of ficheros(ESTILOS)) {
    const { fuera } = analiza(f);
    for (const r of fuera) {
        if (PERMITIDO.some((p) => p.prueba(r.sel))) continue;
        s1.push({ fichero: relative(RAIZ, f), ...r });
    }
}

/* ── S2 ─────────────────────────────────────────────────────────────────────────────────────── */
const especificidad = (sel) =>
    (sel.match(/#[\w-]+/g) || []).length * 100 +
    (sel.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+/g) || []).length * 10 +
    (sel.match(/(?:^|[\s>+~])[a-z][\w-]*/gi) || []).length;

/* La «base» de un selector: su primera clase, sin modificador.
   `.deasy-control:focus` y `.deasy-control--error:focus` comparten base `.deasy-control`. */
const base = (sel) => (sel.match(/\.[a-z][\w-]*/i) || [sel])[0].replace(/--.*$/, "");

/* ⚠️ SOLO CUENTA SI UNA DE LAS DOS ES LA BASE DESNUDA, y esta acotacion es la que hace util la
   señal. Sin ella, la primera corrida acuso a ocho parejas y **seis eran variantes mutuamente
   excluyentes** —`.deasy-btn--neutral-outline` contra `.deasy-btn--primary-soft`—, que no
   coexisten nunca en un elemento y por tanto no se disputan nada.
   Una BASE y su modificador, en cambio, van siempre juntos: en BEM el elemento lleva las dos. Ahi
   el conflicto es real, y es exactamente la forma del fallo que motivo el gate
   (`.deasy-control:focus` contra `.deasy-control--error:focus`). */
const esBaseDesnuda = (sel) => !/--/.test(sel);

const s2 = [];
for (const f of ficheros(ESTILOS)) {
    const { reglas } = analiza(f);
    const porClave = new Map();
    for (const r of reglas) {
        const props = [...r.cuerpo.matchAll(/(^|;)\s*([a-z-]+)\s*:/g)].map((m) => m[2]);
        for (const p of props) {
            if (!DISPUTABLES.has(p)) continue;
            const clave = `${base(r.sel)}|${p}|${especificidad(r.sel)}`;
            if (!porClave.has(clave)) porClave.set(clave, []);
            porClave.get(clave).push({ sel: r.sel, linea: r.linea, prop: p });
        }
    }
    for (const [clave, lista] of porClave) {
        if (lista.length < 2) continue;
        lista.sort((a, b) => a.linea - b.linea);
        for (let k = 1; k < lista.length; k++) {
            const d = lista[k].linea - lista[k - 1].linea;
            const unaEsBase = esBaseDesnuda(lista[k - 1].sel) || esBaseDesnuda(lista[k].sel);
            if (d > CERCA && unaEsBase) {
                s2.push({
                    fichero: relative(RAIZ, f),
                    prop: lista[k].prop,
                    a: lista[k - 1],
                    b: lista[k],
                    distancia: d
                });
            }
        }
    }
}

let roto = false;

if (s1.length) {
    roto = true;
    console.error(`\n✗ S1 · reglas fuera de \`@layer\`: ${s1.length} (techo 0)\n`);
    for (const r of s1) console.error(`    ${r.fichero}:${r.linea}  ${r.sel}`);
    console.error(`
  Fuera de capa una regla gana SIEMPRE, da igual la especificidad — la contraria
  deja de existir aunque se lea perfecta en su fichero. Llevala a la capa que le
  toque (§2.11 de frontend/CLAUDE.md), y si de verdad pelea con una hoja de
  tercero sin capa, añadela a PERMITIDO con su motivo escrito.`);
}

if (s2.length) {
    roto = true;
    console.error(`\n✗ S2 · reglas que se disputan una propiedad y estan LEJOS: ${s2.length} (techo 0)\n`);
    for (const r of s2) {
        console.error(`    ${r.fichero}  ${r.prop}`);
        console.error(`        :${r.a.linea}  ${r.a.sel}`);
        console.error(`        :${r.b.linea}  ${r.b.sel}      (${r.distancia} lineas mas abajo)`);
    }
    console.error(`
  Misma especificidad, misma capa y misma propiedad: decide el ORDEN del fichero.
  Eso no es un empate, es una regla muerta y otra viva. Asi un campo en error se
  vio AZUL mientras se corregia, y ningun gate lo noto.
  Ponlas juntas —que se vean en la misma pantalla— o resuelve el conflicto.`);
}

if (roto) process.exit(1);

console.log(
    `check:layer-debt OK — 0 reglas fuera de capa (${PERMITIDO.length} excepciones declaradas) · ` +
        `ninguna disputa a mas de ${CERCA} lineas.`
);
