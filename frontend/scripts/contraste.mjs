#!/usr/bin/env node
/**
 * Contraste WCAG de la paleta: el ANTES y el DESPUES de anclar cada token semantico a una
 * primitiva de TailAdmin.
 *
 * POR QUE NO VALE EL ΔE
 * Esta medido en este repo: la correlacion entre ΔE y salto de contraste es **-0.206**. Una
 * sustitucion con ΔE 5.2 rompio AA (4.55 -> 4.19) y otra con ΔE 16.3 lo MEJORO en +4.95. El
 * criterio de aceptacion es uno solo y es este:
 *
 *     contraste_despues >= contraste_antes
 *
 * MINIMOS (WCAG 2.1)
 *   4.5  texto normal — el `::placeholder` INCLUIDO, que WCAG lo trata como texto
 *   3.0  texto grande (>=18.66px negrita o >=24px)
 *   3.0  limite de un componente: borde de boton, campo, checkbox (1.4.11)
 *   3.0  icono que transmite informacion
 *
 * OJO CON EL FONDO: un token de texto se mide contra el fondo REAL sobre el que se pinta. El
 * suelo de la escala de grises de Deasy es 6.36:1 sobre blanco, y nada mas claro vale para texto.
 */
import { readFileSync } from "node:fs";

const hex = (c) => {
  const s = c.replace("#", "");
  const n = s.length === 3 ? s.split("").map((x) => x + x).join("") : s;
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
};

/* Luminancia relativa: canal a [0,1], se linealiza y se pesa. La formula es la de WCAG 2.1. */
const luminancia = (rgb) => {
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const contraste = (a, b) => {
  const [la, lb] = [luminancia(hex(a)), luminancia(hex(b))];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

/* OKLCH -> sRGB. Hace falta porque **Tailwind v4 sirve su paleta en OKLCH y NO vuelve a los hex
   de v3 que todo el mundo tiene en la cabeza**: `emerald-700` no es `#047857`, renderiza
   `rgb(0,122,85)`. Comparar contra los hex de v3 da respuestas falsas, y con una de ellas se
   prometio «cambio visual cero por construccion» en una migracion de 200 nodos.
   Los valores de entrada se sacan del CSS CONSTRUIDO, que es la unica fuente fiable. */
export const oklchAHex = (L, C, H) => {
  const a = C * Math.cos((H * Math.PI) / 180);
  const b = C * Math.sin((H * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  const lineal = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
  /* El recorte a [0,1] no es cosmetico: 87 de los 288 colores de Tailwind v4 caen FUERA de la
     gama sRGB. En una pantalla sRGB el navegador los recorta igual que aqui; en una P3 se ven
     mas saturados. Nuestros hex propios se ven igual en las dos. */
  return `#${lineal
    .map((v) => {
      const g = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
      return Math.round(Math.min(1, Math.max(0, g)) * 255).toString(16).padStart(2, "0");
    })
    .join("")}`;
};

/* Las primitivas de TailAdmin que son candidatas a sostener un token nuestro.
   Fuente: el `@theme` del repo HTML free (MIT). */
const TA = {
  "brand-400": "#7592ff", "brand-500": "#465fff", "brand-600": "#3641f5", "brand-700": "#2a31d8",
  "gray-50": "#f9fafb", "gray-100": "#f2f4f7", "gray-200": "#e4e7ec", "gray-300": "#d0d5dd",
  "gray-400": "#98a2b3", "gray-500": "#667085", "gray-600": "#475467", "gray-700": "#344054",
  "gray-800": "#1d2939", "gray-900": "#101828", "gray-950": "#0c111d",
  "success-500": "#12b76a", "success-600": "#039855", "success-700": "#027a48", "success-800": "#05603a",
  "error-500": "#f04438", "error-600": "#d92d20", "error-700": "#b42318", "error-800": "#912018",
  "warning-500": "#f79009", "warning-600": "#dc6803", "warning-700": "#b54708", "warning-800": "#93370d",
  "orange-700": "#c4320a", "orange-800": "#9c2a10",
  "blue-light-700": "#026aa2", "blue-light-800": "#065986",
};

/* QUE SE EXIGE A CADA TOKEN: [fondo sobre el que se juzga, minimo, rol].
 *
 * ⚠️ Aqui NO va el color. Aqui iba, y esa fue la averia: era una copia a mano de `tokens.css`, y
 * el 2026-08-13 los tokens se reanclaron a las primitivas de TailAdmin sin actualizarla. El
 * 2026-08-14 se midio la deriva: **17 de 21 tokens tenian aqui un valor que ya no existia en el
 * proyecto** — `primary` decia `#5e4eff` cuando el sistema ya pintaba `#465fff`, `step-ink` decia
 * `#108353` por `#027a48`. La herramienta que define el criterio de aceptacion llevaba un mes
 * midiendo un fosil, y ningun gate lo veia porque no estaba enganchada a nada.
 *
 * Es exactamente el fallo que `frontend/CLAUDE.md` §2.1 describe para los tripletes `-rgb`: una
 * copia no se entera de que el original se movio. Asi que el color se LEE de `tokens.css`, y lo
 * unico que se escribe aqui es lo que no se puede deducir de un hex: sobre que fondo se juzga el
 * token, que minimo le toca y para que sirve. Eso es diseño, y va a mano a proposito. */
const META = {
  "primary":        ["#ffffff", 4.5, "texto y relleno de marca"],
  "info":           ["#ffffff", 4.5, "texto informativo (era sky-600)"],
  "accent":         ["#ffffff", 3.0, "acento — pinta TODOS los <a> por `base.css`"],
  "navy":           ["#ffffff", 4.5, "titulares"],
  "ink":            ["#ffffff", 4.5, "texto"],
  "strong":         ["#ffffff", 4.5, "texto"],
  "body":           ["#ffffff", 4.5, "texto"],
  "muted":          ["#ffffff", 4.5, "texto secundario — EL SUELO"],
  "icon":           ["#ffffff", 3.0, "icono"],
  "line":           ["#ffffff", 3.0, "separador (no es limite de control)"],
  "line-strong":    ["#ffffff", 3.0, "limite"],
  "line-field":     ["#ffffff", 3.0, "limite de control (1.4.11)"],
  "surface":        ["#ffffff", 1.0, "fondo"],
  "success":        ["#ffffff", 4.5, "estado"],
  "danger":         ["#ffffff", 4.5, "estado"],
  "warning":        ["#ffffff", 4.5, "estado"],
  "pending":        ["#ffffff", 4.5, "estado"],
  "step-ink":       ["#ffffff", 4.5, "«te toca a ti»"],
  /* [2026-08-14] Eran TRES tonos de accion y queda uno. `action-neutral` se quedo sin
     consumidores al colapsar los 12 botones de accion sobre el componente, y `action-view` se
     unifico con `info`: eran `blue-light-800` y `blue-light-700`, la misma familia en pasos
     contiguos con dos nombres segun quien lo escribiera. `action-upload` sobrevive porque su
     accion —subir/versionar/descargar— si es una categoria propia, pero deja de ser un hex
     inventado: pasa a `brand-900`. */
  "action-upload":  ["#ffffff", 3.0, "icono de accion"],
  /* Los tres FONDOS. Su contraste contra blanco no dice nada por si mismo —un fondo no se lee—,
     asi que llevan minimo 1.0 y estan aqui para que el gate no los de por sin clasificar. Lo que
     de verdad hay que medir en ellos es el TEXTO que se les pone encima, y eso no lo hace esta
     tabla: `navy-deep` es la barra lateral, que escribe su texto con alfa (`text-white/55`). */
  "white":          ["#ffffff", 1.0, "el fondo del sistema"],
  "navy-deep":      ["#ffffff", 1.0, "fondo oscuro de la barra lateral"],
  "gold":           ["#ffffff", 1.0, "acento decorativo"],
};

/* EL COLOR SE LEE DE `tokens.css`, siguiendo la cadena de alias hasta la primitiva. Un token que
   no resuelva a un hex (un `color-mix`, un degradado) sale como `null` y se informa: no se puede
   medir su contraste, pero tampoco se calla. */
const TOKENS_CSS = new URL("../src/shared/styles/tokens.css", import.meta.url);

const cargarTokens = () => {
  const css = readFileSync(TOKENS_CSS, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const declarado = new Map();
  for (const [, nombre, valor] of css.matchAll(/(--color-[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    declarado.set(nombre, valor.trim());
  }
  const resolver = (valor, saltos = 0) => {
    if (saltos > 8) return null;                      /* ciclo de alias: no cuelga, informa */
    if (/^#[0-9a-f]{3,8}$/i.test(valor)) return valor;
    const alias = valor.match(/^var\((--color-[a-z0-9-]+)\)$/);
    return alias && declarado.has(alias[1]) ? resolver(declarado.get(alias[1]), saltos + 1) : null;
  };
  /* Una primitiva es la que acaba en `-<numero>` (`gray-200`, `brand-500`). El resto son los
     nombres semanticos de Deasy, que son los que hay que clasificar en META. */
  const semanticos = new Map();
  for (const [nombre, valor] of declarado) {
    const corto = nombre.slice("--color-".length);
    if (!/-\d+$/.test(corto)) semanticos.set(corto, resolver(valor));
  }
  return semanticos;
};

const LEIDOS = cargarTokens();

/* El gate que hace que «ningun token nuevo se escape»: los dos conjuntos tienen que coincidir.
   Un token semantico nuevo sin fila en META aborta, y una fila de META cuyo token ya no exista,
   tambien — es la unica forma de que esta tabla no vuelva a fosilizarse. */
const sinClasificar = [...LEIDOS.keys()].filter((n) => !(n in META));
const fantasmas = Object.keys(META).filter((n) => !LEIDOS.has(n));
if (sinClasificar.length || fantasmas.length) {
  if (sinClasificar.length) {
    console.error(`✖ ${sinClasificar.length} token(s) semantico(s) de tokens.css SIN clasificar aqui: ${sinClasificar.join(", ")}`);
    console.error("  Añade su fila en META: sobre que fondo se juzga, que minimo le toca y para que sirve.");
  }
  if (fantasmas.length) {
    console.error(`✖ ${fantasmas.length} fila(s) de META que ya no existen en tokens.css: ${fantasmas.join(", ")}`);
    console.error("  Borralas: una fila sin token es la copia desincronizada que este cambio vino a matar.");
  }
  process.exit(1);
}

/* token -> [valor de hoy, fondo sobre el que se juzga, minimo que debe cumplir, rol] */
const HOY = Object.fromEntries(
  Object.entries(META).map(([nombre, [fondo, min, rol]]) => [nombre, [LEIDOS.get(nombre), fondo, min, rol]]),
);

const sinHex = Object.entries(HOY).filter(([, [valor]]) => !valor).map(([n]) => n);
if (sinHex.length) {
  console.error(`✖ ${sinHex.length} token(s) que no resuelven a un hex y no se pueden medir: ${sinHex.join(", ")}`);
  process.exit(1);
}

/* LA FAMILIA LA ELIGE UNA PERSONA, EL PASO LO ELIGE LA MEDIDA.
   Buscar «la primitiva con mejor contraste» sin restringir el tono da respuestas absurdas —la
   primera version proponia `primary -> success-700`, o sea la marca en verde—. El tono es una
   decision de diseno; lo unico que se automatiza es a que ESCALON de esa familia se ancla. */
const FAMILIA = {
  primary: "brand", navy: "gray", ink: "gray", strong: "gray", body: "gray", muted: "gray",
  icon: "gray", line: "gray", "line-strong": "gray", "line-field": "gray", surface: "gray",
  success: "success", danger: "error", warning: "warning", pending: "orange",
  "step-ink": "success", "action-view": "blue-light", info: "blue-light",
  /* Sin familia en TailAdmin: `accent` (turquesa), `action-neutral` y `action-upload` (azules
     grisaceos que no son su `brand`). Se quedan con su hex propio. */
};

const f = (n) => n.toFixed(2).padStart(5);

/* ── EL GATE ────────────────────────────────────────────────────────────────────────────────────
 * `--gate` es lo que corre `pnpm run lint`. Es un TRINQUETE, no un aprobado: cuatro tokens estan
 * hoy por debajo de su minimo y subirlos no es un arreglo de lint —los tres `line-*` son el borde
 * de 228 controles, y `accent` pinta todos los `<a>` por la regla sin capa de `base.css`—, es un
 * rediseño que decide una persona (fases 5 y 6 del plan de la 3.ª vuelta).
 *
 * Asi que el criterio es el del §3 de `frontend/CLAUDE.md`, y es uno solo:
 *
 *     contraste_despues >= contraste_antes
 *
 * Falla si un token EMPEORA respecto de esta linea base, o si uno que cumplia su minimo deja de
 * cumplirlo. Cuando una fase arregle un token, se sube su linea base aqui EN EL MISMO COMMIT.
 *
 * Linea base medida el 2026-08-14, ya leyendo `tokens.css` (la tabla anterior estaba fosilizada y
 * daba cifras de tokens que no existian: decia que `info` fallaba con 4.02 cuando el reanclaje a
 * `blue-light-700` lo habia dejado en 5.86).
 */
const BASE = {
  "primary": 4.84, "info": 5.86, "accent": 2.64, "navy": 17.75, "ink": 14.70, "strong": 14.70,
  "body": 10.46, "muted": 7.69, "icon": 7.69, "line": 1.24, "line-strong": 1.47,
  "line-field": 1.47, "surface": 1.05, "success": 5.41, "danger": 6.57, "warning": 5.43,
  "pending": 5.52, "step-ink": 5.41,
  /* 7.32 -> 11.45 el 2026-08-14, al dejar de ser `#3751a3` y anclarse a `brand-900`. Sube. */
  "action-upload": 11.45,
  "white": 1.00, "navy-deep": 17.84, "gold": 2.10,
};

if (process.argv.includes("--gate")) {
  /* Un salto de centesimas es ruido de redondeo, no una regresion — mismo umbral que el modo de
     comprobar un mapeo concreto, mas abajo. */
  const TOLERANCIA = 0.05;
  const fallos = [];
  const mejoras = [];
  for (const [nombre, [valor, fondo, min]] of Object.entries(HOY)) {
    const hoy = contraste(valor, fondo);
    const base = BASE[nombre];
    if (base === undefined) { fallos.push(`${nombre}: sin linea base — añadela a BASE`); continue; }
    if (hoy < base - TOLERANCIA) fallos.push(`${nombre}: ${f(hoy)} < ${f(base)} (linea base) — EMPEORA`);
    else if (hoy > base + TOLERANCIA) mejoras.push(`${nombre} ${f(base)} -> ${f(hoy)}`);
    if (base >= min && hoy < min) fallos.push(`${nombre}: ${f(hoy)} rompe su minimo de ${min.toFixed(1)}`);
  }
  if (fallos.length) {
    console.error("✖ check:contraste\n");
    for (const linea of fallos) console.error(`  ${linea}`);
    console.error("\nEl criterio es `contraste_despues >= contraste_antes`. Si el cambio es deliberado y");
    console.error("mejora, sube la linea base en `scripts/contraste.mjs` EN EL MISMO COMMIT.");
    process.exit(1);
  }
  const bajoMinimo = Object.entries(HOY).filter(([, [v, fo, m]]) => contraste(v, fo) < m).length;
  console.log(
    `check:contraste OK — ${Object.keys(HOY).length} tokens, ninguno empeora` +
    (bajoMinimo ? ` (${bajoMinimo} siguen bajo su minimo: fases 5 y 6).` : ".") +
    (mejoras.length ? ` MEJORAN, sube su linea base: ${mejoras.join(", ")}.` : ""),
  );
  process.exit(0);
}

if (process.argv.includes("--tabla")) {
  console.log("TOKEN            HOY    MIN  ESTADO  FAMILIA      PASO QUE NO EMPEORA");
  for (const [nombre, [valor, fondo, min, rol]] of Object.entries(HOY)) {
    const antes = contraste(valor, fondo);
    const ok = antes >= min ? "  ok " : "FALLA";
    const familia = FAMILIA[nombre];
    let suf = "— se queda con su hex (sin familia equivalente)";
    if (familia) {
      const cand = Object.entries(TA)
        .filter(([k]) => k.startsWith(`${familia}-`))
        .map(([k, v]) => [k, v, contraste(v, fondo)])
        /* No empeorar es el criterio. El minimo se exige solo si HOY ya se cumplia: los bordes
           llevan anos por debajo de 3:1 y subirlos es un rediseno de 228 controles, no esto. */
        .filter(([, , c]) => c >= antes - 0.001 && (antes >= min ? c >= min : true))
        .sort((a, b) => Math.abs(a[2] - antes) - Math.abs(b[2] - antes))[0];
      suf = cand
        ? `${familia.padEnd(11)}  ${cand[0].padEnd(14)} ${cand[1]}  ${f(cand[2])}`
        : `${familia.padEnd(11)}  — ningun paso sin empeorar`;
    }
    console.log(`${nombre.padEnd(16)}${f(antes)} ${min.toFixed(1)}  ${ok}   ${suf}`);
  }
  console.log("\n(el minimo se exige donde HOY se cumple; donde ya fallaba, el criterio es no empeorar)");
  process.exit(0);
}

/* `--escala` compara paso a paso la escala `slate` de Tailwind (que es la que escriben hoy las
   plantillas) con la `gray` de TailAdmin (que es el destino). Los valores de slate se leen del
   CSS CONSTRUIDO en OKLCH y se convierten aqui — ver `oklchAHex`. */
const SLATE_OKLCH = {
  50: [0.984, 0.003, 247.858], 100: [0.968, 0.007, 247.896], 200: [0.929, 0.013, 255.508],
  300: [0.869, 0.022, 252.894], 400: [0.704, 0.040, 256.788], 500: [0.554, 0.046, 257.417],
  600: [0.446, 0.043, 257.281], 700: [0.372, 0.044, 257.287], 800: [0.279, 0.041, 260.031],
  900: [0.208, 0.042, 265.755], 950: [0.129, 0.042, 264.695],
};

if (process.argv.includes("--escala")) {
  console.log("PASO   slate (renderizado)      gray (TailAdmin)       Δcontraste   ¿texto?");
  for (const paso of Object.keys(SLATE_OKLCH)) {
    const s = oklchAHex(...SLATE_OKLCH[paso]);
    const g = TA[`gray-${paso}`];
    if (!g) { console.log(`${String(paso).padEnd(6)} ${s}  ${f(contraste(s, "#ffffff"))}   — sin gray-${paso} declarado`); continue; }
    const cs = contraste(s, "#ffffff");
    const cg = contraste(g, "#ffffff");
    const d = cg - cs;
    const texto = cs >= 4.5 || cg >= 4.5
      ? (cg >= 4.5 ? (cs >= 4.5 ? "sirve para texto" : "GANA texto") : "PIERDE texto")
      : "no es de texto";
    console.log(
      `${String(paso).padEnd(6)} ${s} ${f(cs)}   ->   ${g} ${f(cg)}   ${(d >= 0 ? "+" : "") + d.toFixed(2).padStart(6)}   ${texto}`,
    );
  }
  console.log("\nEl unico paso que importa de verdad es el que se usa para TEXTO: por debajo de 4.5 no vale.");
  process.exit(0);
}

/* Comprobacion de un mapeo concreto: `node contraste.mjs muted=gray-600 primary=brand-500` */
let fallos = 0;
for (const arg of process.argv.slice(2)) {
  const [token, primitiva] = arg.split("=");
  if (!HOY[token]) { console.error(`token desconocido: ${token}`); process.exit(2); }
  if (!TA[primitiva]) { console.error(`primitiva desconocida: ${primitiva}`); process.exit(2); }
  const [valor, fondo, min] = HOY[token];
  const antes = contraste(valor, fondo);
  const despues = contraste(TA[primitiva], fondo);
  /* Un salto de centesimas es ruido de redondeo, no una regresion: el umbral es 0.05. */
  const baja = despues < antes - 0.05;
  /* El minimo solo se exige donde HOY se cumple. Los tres bordes llevan anos por debajo de 3:1
     y subirlos repinta 228 controles — es un rediseno decidido aparte, no el criterio de esto.
     Sin esta distincion la herramienta grita por lo que no ha tocado nadie y deja de servir. */
  const yaFallaba = antes < min;
  const rompe = despues < min && !yaFallaba;
  if (baja || rompe) fallos += 1;
  const marca = rompe ? "ROMPE EL MINIMO" : baja ? "BAJA" : yaFallaba ? "ok (ya fallaba antes)" : "ok";
  console.log(`${token.padEnd(16)} ${valor} ${f(antes)}  ->  ${primitiva.padEnd(14)} ${TA[primitiva]} ${f(despues)}   ${marca}`);
}
process.exit(fallos > 0 ? 1 : 0);
