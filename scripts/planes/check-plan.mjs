#!/usr/bin/env node
// La puerta del plan de trabajo. Ocho comprobaciones sobre `docs/planes/<proyecto>/`.
//
//   A · ESTRUCTURA   el fichero se llama como su `id`, el `id` es una ruta, y cuelga de una fase que existe
//   B · VOCABULARIO  `tipo` y `estado` son de los declarados; nada inventado
//   C · CIERRE       terminal con fecha absoluta · ✅ con evidencia · fuera con razón · 🟡 con nota
//   D · DEPENDENCIA  `depende_de` apunta a algo que existe; no se cierra con dependencias vivas
//   E · V&V          un CAMBIO cerrado tiene quien lo verifique: una tarea V que le apunte
//   F · PROCEDENCIA  un cambio dice de dónde viene, y el referido existe
//   G · FALSABLE     la entrega no empieza por un verbo de actividad; la evidencia no usa fechas relativas
//   H · DERIVA       estas reglas y el perfil de la skill `plan-trabajo` siguen diciendo lo mismo
//
// ── Por qué existe, si la skill ya trae su propia puerta ──────────────────────────────────────
// Porque la de la skill NO PUEDE CORRER AQUÍ. `plan verificar` vive en
// `~/.claude/skills/plan-trabajo/`, que es configuración de una persona y de una máquina; el
// runner de GitHub clona el repositorio y nada más, así que nunca lo ve. Y la norma de este
// repositorio no es «hay que correr las puertas», es «las puertas corren en CI» — está medido:
// `check:imports` corría solo y las otras dos «dependían de que alguien se acordara», y no se
// ejecutaban. Sin esto, podríamos commitear un plan que miente —un cambio cerrado sin verificar,
// una evidencia vacía, una fecha relativa— y CI lo dejaría pasar en verde.
//
// El dato del plan SÍ viaja en el repositorio (`docs/planes/<proyecto>/tareas/*.md`), así que a CI
// no le falta la información: le faltaba quien la leyera. Es el mismo movimiento que
// `check-doc-modelo.mjs` hace con la documentación que genera otra herramienta.
//
// ── Lo que NO comprueba, a propósito ─────────────────────────────────────────────────────────
// El ORDEN de las fases, y qué tipo puede vivir en qué fase. Hay un caso medido (2026-10-11): dos
// cambios cerrados con preguntas del mismo frente todavía vivas, y fue correcto — sus decisiones
// ya estaban tomadas. Y tampoco la COMPLETITUD del ciclo —que cada etapa tenga su fase—, que se
// retiró de la skill el 2026-10-24 leyendo a Boehm en el original: las etapas de la espiral «se
// eligen por riesgo» («risk-driven subsetting», p. 65), así que exigirlas todas era aplicar la
// cascada con los nombres de la espiral. Una puerta que marca como infracción lo que el dueño
// decidió a propósito se desactiva sola.
//
// ⚠️ UNA TAREA `revision_pendiente` NO PONE ESTO EN ROJO: sus hallazgos salen como avisos. Es la
// postura «se convierte el día que se toca» — sin eso, migrar un plan antiguo dejaría la puerta
// roja el primer día y nadie volvería a correrla.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, "..", "..");
const PLANES = join(RAIZ, "docs", "planes");
const REGLAS = JSON.parse(readFileSync(join(AQUI, "plan-reglas.json"), "utf8"));
const PERFIL_SKILL = join(
  process.env.HOME ?? "", ".claude", "skills", "plan-trabajo", "perfiles", "codigo.yaml"
);

const RE_ID = /^F\d+(?:\.S\d+)?\.P\d+\.T\d+(?:-[a-z0-9]+)?$/;
const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;

const fallos = [];
const avisos = [];

// ── Lectura: el subconjunto de YAML que la skill escribe, y sólo ése ─────────────────────────
// No hay parser de YAML disponible: las puertas de este repositorio corren con `node` a secas,
// sin `npm install` (ver .github/workflows/docs-links.yml). El subconjunto es estrecho y
// predecible porque lo genera `yaml.safe_dump`, así que se lee a mano — y si aparece algo que no
// se entiende, se DICE en vez de ignorarlo en silencio.

function desencomilla(v) {
  if (v.length >= 2 && v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1).replaceAll("''", "'");
  if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) return v.slice(1, -1).replaceAll('\\"', '"');
  return v;
}

function valor(v) {
  const s = v.trim();
  if (s === "") return "";
  if (s.startsWith("[") && s.endsWith("]")) {
    return s.slice(1, -1).split(",").map((x) => desencomilla(x.trim())).filter((x) => x !== "");
  }
  if (s === "true") return true;
  if (s === "false") return false;
  return desencomilla(s);
}

/** Frontmatter de una ficha de tarea: claves planas entre dos `---`. */
function leerFicha(ruta) {
  const lineas = readFileSync(ruta, "utf8").split("\n");
  if (lineas[0]?.trim() !== "---") return { meta: null, cuerpo: "" };
  const meta = {};
  let i = 1;
  for (; i < lineas.length && lineas[i].trim() !== "---"; i++) {
    const m = /^([a-z_]+):(.*)$/.exec(lineas[i]);
    if (m) meta[m[1]] = valor(m[2]);
    else if (lineas[i].trim() !== "")
      fallos.push(`A · ${basename(ruta)}: no entiendo la línea ${i + 1} del frontmatter: «${lineas[i].trim()}»`);
  }
  return { meta, cuerpo: lineas.slice(i + 1).join("\n") };
}

/** Las fases de un frente: `fases:` con claves P<n>, y `subfrentes:` con S<n> dentro. */
function leerFrente(ruta) {
  const lineas = readFileSync(ruta, "utf8").split("\n");
  const cab = {};
  const fases = new Set();
  let fid = null;
  let dentro = null; // "fases" | "subfrentes"
  let sub = null;
  for (const linea of lineas) {
    if (linea.trim() === "" || linea.trimStart().startsWith("#")) continue;
    const sangria = linea.length - linea.trimStart().length;
    const m = /^([A-Za-z_][\w]*):(.*)$/.exec(linea.trim());
    if (!m) continue; // los títulos multilínea no nos interesan
    const [, clave, resto] = m;
    if (sangria === 0) {
      dentro = clave === "fases" || clave === "subfrentes" ? clave : null;
      sub = null;
      if (resto.trim() !== "") cab[clave] = valor(resto);
      if (clave === "id") fid = cab.id;
      continue;
    }
    if (dentro === "fases" && sangria === 2 && /^P\d+$/.test(clave)) fases.add(`${fid}.${clave}`);
    if (dentro === "subfrentes" && sangria === 2 && /^S\d+$/.test(clave)) sub = clave;
    if (dentro === "subfrentes" && sangria === 6 && /^P\d+$/.test(clave) && sub)
      fases.add(`${fid}.${sub}.${clave}`);
  }
  return { id: fid, ciclo: cab.ciclo, fases };
}

// ── Qué proyectos hay ─────────────────────────────────────────────────────────────────────────
if (!existsSync(join(PLANES, "plan.yaml"))) {
  console.log("No hay plan gobernado por `plan` en docs/planes (falta plan.yaml). Nada que comprobar.");
  process.exit(0);
}

const proyectos = readdirSync(PLANES)
  .map((d) => join(PLANES, d))
  .filter((d) => statSync(d).isDirectory() && existsSync(join(d, "proyecto.yaml")));

let nTareas = 0;
let nVivas = 0;
let nHechas = 0;
let nFuera = 0;

for (const dir of proyectos) {
  const slug = basename(dir);

  // fases declaradas por los frentes
  const dirFrentes = join(dir, "frentes");
  const fases = new Set();
  const frentes = [];
  if (existsSync(dirFrentes)) {
    for (const f of readdirSync(dirFrentes).filter((x) => x.endsWith(".yaml"))) {
      const fr = leerFrente(join(dirFrentes, f));
      frentes.push(fr);
      for (const p of fr.fases) fases.add(p);
      if (fr.fases.size === 0) avisos.push(`${slug}/${fr.id}: no tiene ninguna fase`);
    }
  }

  // decisiones, para la procedencia
  const dirDec = join(dir, "decisiones");
  const decisiones = existsSync(dirDec)
    ? new Set(readdirSync(dirDec).filter((x) => x.endsWith(".md")).map((x) => x.replace(/\.md$/, "")))
    : new Set();

  // tareas
  const dirTareas = join(dir, "tareas");
  const tareas = new Map();
  if (existsSync(dirTareas)) {
    for (const f of readdirSync(dirTareas).filter((x) => x.endsWith(".md"))) {
      const { meta, cuerpo } = leerFicha(join(dirTareas, f));
      if (!meta) {
        fallos.push(`A · ${slug}/tareas/${f}: no empieza por frontmatter`);
        continue;
      }
      const id = String(meta.id ?? f.replace(/\.md$/, ""));
      if (f !== `${id}.md`) fallos.push(`A · ${slug}/tareas/${f}: su \`id\` dice ${id}`);
      tareas.set(id, { ...meta, _cuerpo: cuerpo });
    }
  }

  // `revision_pendiente` degrada los hallazgos de esa tarea a aviso
  const falla = (id, msg) =>
    (tareas.get(id)?.revision_pendiente ? avisos : fallos).push(
      tareas.get(id)?.revision_pendiente ? `${slug}/${id}: (migrada) ${msg}` : `${slug}/${id}: ${msg}`
    );
  const avisa = (id, msg) => avisos.push(`${slug}/${id}: ${msg}`);

  const deps = (t) => (Array.isArray(t.depende_de) ? t.depende_de : t.depende_de ? [String(t.depende_de)] : []);

  for (const [id, t] of [...tareas].sort(([a], [b]) => a.localeCompare(b, "en", { numeric: true }))) {
    nTareas++;

    // A · estructura
    if (!RE_ID.test(id)) {
      falla(id, "el identificador no es una ruta F<n>[.S<n>].P<n>.T<n>");
      continue;
    }
    const fase = id.slice(0, id.lastIndexOf("."));
    if (fases.size && !fases.has(fase)) falla(id, `cuelga de la fase ${fase}, que no existe`);

    // B · vocabulario
    const tipo = String(t.tipo ?? "");
    const estado = String(t.estado ?? "");
    if (!REGLAS.tipos[tipo]) {
      falla(id, `tipo desconocido: «${tipo}»`);
      continue;
    }
    if (!REGLAS.estados[estado]) {
      falla(id, `estado desconocido: «${estado}»`);
      continue;
    }
    const e = REGLAS.estados[estado];
    if (e.fuera) nFuera++;
    else nVivas++;
    if (estado === "cerrada") nHechas++;

    const evidencia = String(t.evidencia ?? "").trim();
    const fecha = String(t.fecha ?? "").trim();

    // C · cierre
    if (e.terminal && !fecha) falla(id, `«${estado}» sin fecha`);
    else if (e.terminal && !RE_FECHA.test(fecha)) falla(id, `fecha «${fecha}» no es absoluta (AAAA-MM-DD)`);
    if (estado === "cerrada" && !evidencia) falla(id, "cerrada con la casilla de evidencia vacía");
    if (e.fuera && !evidencia) falla(id, `«${estado}» sin razón escrita en la evidencia`);
    if (estado === "encurso" && !t._cuerpo.trim())
      falla(id, "🟡 sin nota de dónde te quedaste: es indistinguible de ⬜");
    if (estado === "cerrada")
      for (const campo of REGLAS.tipos[tipo].exige)
        if (!String(t[campo] ?? "").trim())
          falla(id, `tipo ${tipo} cerrado sin «${campo}» (cierra con: ${REGLAS.tipos[tipo].cierra})`);

    // D · dependencia
    const misDeps = deps(t);
    for (const d of misDeps) if (!tareas.has(d)) falla(id, `depende de ${d}, que no existe`);
    const vivas = misDeps.filter((d) => tareas.has(d) && !REGLAS.estados[String(tareas.get(d).estado)]?.terminal);
    if (estado === "bloqueada") {
      if (!misDeps.length && !t._cuerpo.trim())
        falla(id, "⛔ sin causa: declara `depende_de` o escribe por qué y por quién");
      else if (misDeps.length && !vivas.length)
        falla(id, "⛔ pero TODAS sus dependencias están terminales — se desbloqueó y nadie la retomó");
    }
    if (estado === "cerrada" && vivas.length) falla(id, `cerrada con dependencias vivas: ${vivas.join(", ")}`);

    // F · procedencia
    const proc = REGLAS.procedencia;
    const origen = String(t[proc.campo] ?? "").trim();
    if (tipo === proc.tipo && origen) {
      const nombre = Object.entries(proc.origenes).find(([, p]) => origen.startsWith(p))?.[0];
      if (!nombre)
        falla(
          id,
          `«${proc.campo}: ${origen}» no es un origen válido. Admitidos: ${Object.values(proc.origenes)
            .map((p) => `${p}…`)
            .join(", ")}`
        );
      else if (nombre === "decision" && !decisiones.has(origen))
        falla(id, `${proc.campo} ${origen}, que no es una ficha de decisión de este proyecto`);
      else if (nombre === "medicion") {
        const ref = origen.slice(proc.origenes.medicion.length).trim();
        if (!tareas.has(ref)) falla(id, `${proc.campo} M:${ref}, que no es una tarea de este proyecto`);
        else if (tareas.get(ref).tipo !== "M") falla(id, `${proc.campo} M:${ref}, que no es una medición`);
      }
    }

    // G · falsable
    const entrega = String(t.entrega ?? "").trim();
    const primera = entrega.toLowerCase().split(/[\s,.:]/)[0] ?? "";
    if (REGLAS.verbos_de_actividad.includes(primera))
      falla(
        id,
        `«${entrega.slice(0, 48)}…» describe una ACTIVIDAD, no un resultado observable. Si no sabes enunciarlo, la tarea mezcla dos cosas: pártela`
      );
    for (const r of REGLAS.fechas_prohibidas)
      if (evidencia.toLowerCase().includes(r)) {
        falla(id, `la evidencia usa una fecha relativa («${r}»); escríbela en absoluto`);
        break;
      }
  }

  // E · V&V — sustituye a la completitud del ciclo. Planificar una fase de verificación no
  // verifica nada: `mapa-modulos-2026-10.md` tenía 16 tareas en ✅ sin evidencia en ninguna parte,
  // y fases tenía todas. Lo que vale es que exista la tarea que lo verifica y apunte al cambio.
  const vv = REGLAS.procesos.verificacion;
  const verifican = new Map();
  for (const [vid, v] of tareas)
    if (v.tipo === vv.la_hace) for (const d of deps(v)) verifican.set(d, [...(verifican.get(d) ?? []), vid]);
  for (const [id, t] of tareas) {
    if (t.tipo !== vv.tipo || t.estado !== "cerrada") continue;
    const quienes = verifican.get(id) ?? [];
    if (!quienes.length)
      falla(
        id,
        `cerrada sin verificación: ninguna tarea ${vv.la_hace} depende de ella. Crea la ${vv.la_hace} y apúntala con \`--depende-de ${id}\``
      );
    else if (quienes.every((q) => !REGLAS.estados[String(tareas.get(q)?.estado)]?.terminal))
      avisa(id, `cerrada y su verificación sigue abierta: ${quienes.join(", ")}`);
  }
}

// ── H · deriva contra el perfil de la skill ───────────────────────────────────────────────────
// El coste declarado de tener dos implementaciones es que pueden discrepar. Esto lo hace visible
// en local, donde la skill existe. En CI no está, y entonces se dice que no se comparó — que no es
// lo mismo que decir que coinciden.
let deriva = "no comparado (la skill no está en esta máquina)";
if (existsSync(PERFIL_SKILL)) {
  const py = spawnSync(
    "python3",
    ["-c", "import sys,yaml,json;print(json.dumps(yaml.safe_load(open(sys.argv[1]))))", PERFIL_SKILL],
    { encoding: "utf8" }
  );
  if (py.status !== 0) {
    deriva = "no comparado (no pude leer el perfil de la skill)";
    avisos.push(`H · el perfil de la skill existe y no se pudo leer: ${String(py.stderr).trim().slice(0, 120)}`);
  } else {
    const p = JSON.parse(py.stdout);
    const dif = [];
    const comp = (que, a, b) => {
      if (JSON.stringify(a) !== JSON.stringify(b)) dif.push(`${que}: aquí ${JSON.stringify(a)} · skill ${JSON.stringify(b)}`);
    };
    comp("tipos", Object.keys(REGLAS.tipos).sort(), Object.keys(p.tipos ?? {}).sort());
    for (const sigla of Object.keys(REGLAS.tipos))
      comp(`tipos.${sigla}.exige`, REGLAS.tipos[sigla].exige ?? [], p.tipos?.[sigla]?.exige ?? []);
    comp("procesos.verificacion", REGLAS.procesos.verificacion, p.procesos?.verificacion ?? null);
    comp("procedencia.tipo", REGLAS.procedencia.tipo, p.procedencia?.tipo ?? null);
    comp("procedencia.campo", REGLAS.procedencia.campo, p.procedencia?.campo ?? null);
    comp(
      "origenes",
      Object.values(REGLAS.procedencia.origenes).sort(),
      Object.values(p.origenes ?? {}).map((o) => o.prefijo).sort()
    );
    comp("verbos_de_actividad", [...REGLAS.verbos_de_actividad].sort(), [...(p.verbos_de_actividad ?? [])].sort());
    comp("fechas_prohibidas", [...REGLAS.fechas_prohibidas].sort(), [...(p.fechas_prohibidas ?? [])].sort());
    if (dif.length) {
      deriva = `✗ ${dif.length} diferencia(s)`;
      for (const d of dif) fallos.push(`H · deriva con el perfil de la skill — ${d}`);
    } else {
      deriva = "✔ coinciden";
    }
  }
}

// ── Veredicto ─────────────────────────────────────────────────────────────────────────────────
console.log(`Plan:    ${proyectos.length} proyecto(s) · ${nTareas} tareas`);
console.log(`Estado:  ${nVivas} vivas · ${nHechas} hechas · ${nFuera} fuera`);
console.log(`Reglas:  ${Object.keys(REGLAS.tipos).length} tipos · ${Object.keys(REGLAS.estados).length} desenlaces · deriva ${deriva}`);

for (const a of avisos) console.log(`\n  ⚠ ${a}`);

if (fallos.length) {
  console.error(`\n✖ ${fallos.length} fallo(s):\n`);
  for (const f of fallos) console.error(`   · ${f}`);
  console.error("");
  process.exit(1);
}
console.log("\n✔ El plan no se contradice.");
