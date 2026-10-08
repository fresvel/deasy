#!/usr/bin/env node
// Detector de "alias de SQL usado sin declarar".
//
// POR QUÉ EXISTE. El SQL de este backend vive dentro de plantillas de JavaScript, así que **nadie
// lo mira hasta que se ejecuta esa rama**: `node --check` sólo ve una cadena, `check:imports` no
// entra, y el backend arranca igual. Un `ti.id` cuya tabla ya no se une es sintaxis perfecta para
// todo el mundo menos para PostgreSQL, que responde `missing FROM-clause entry for table "ti"`
// **en tiempo de llamada**.
//
// Coste medido (2026-08-23, retirada de la tabla `documents`): un reemplazo global de una línea de
// `JOIN` se llevó por delante TRES joins legítimos a `task_items` en consultas que no tenían nada
// que ver con el cambio. Tres endpoints distintos en 500, y el diff era de 91 sitios: leerlo no
// servía. Esto los encontró los tres de golpe.
//
// QUÉ MIRA Y QUÉ NO. Sólo revisa plantillas que son una SENTENCIA COMPLETA —empiezan por SELECT,
// WITH, INSERT, UPDATE o DELETE—. Los FRAGMENTOS (`EXISTS (...)`, `AND ...`) se saltan a propósito:
// este repo los compone para embeberlos en otra consulta, así que sus alias los declara quien los
// embebe. Es el caso de `DeliverableAccessService`, por diseño.
//
// Es hermano de `check_sql_comment_backticks.mjs` y del mismo tipo de fallo: algo que ni el linter
// ni los tests ven, y que sale caro cada vez.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = path.resolve(AQUI, "..");
// ⚠️ `templates` SE EXCLUYE SÓLO EN LA RAÍZ DE `backend/`, y el matiz costó 73 consultas: la lista
// se comparaba con el NOMBRE de cada carpeta a cualquier profundidad, así que también se saltaba
// `services/admin/templates/` --`templateLifecycle.js` (45 consultas), `flowRows.js` (16),
// `templateArtifact.js` (10)--. Una puerta obligatoria, a techo cero, ciega al fichero más grande del
// repositorio. Se descubrió el 2026-10-07 al mover una consulta ahí y ver que el contador no subía.
const IGNORAR_RAIZ = new Set(["node_modules", "coverage", ".git", "public", "templates"]);
const IGNORAR = new Set(["node_modules", "coverage", ".git"]);

// Pseudo-tablas y esquemas que se cualifican sin declararse en ningún FROM.
const CALIFICADORES_LIBRES = new Set([
  "excluded", "new", "old",                       // upsert y triggers
  "information_schema", "pg_catalog", "public",   // esquemas
]);

// Palabras que pueden seguir a `FROM tabla` sin ser un alias.
const NO_SON_ALIAS = new Set([
  "on", "where", "set", "values", "using", "group", "order", "having", "limit", "offset",
  "left", "right", "inner", "outer", "full", "cross", "join", "lateral", "as", "and", "or",
  "union", "intersect", "except", "returning", "for", "window", "fetch", "into", "select",
]);

const listar = (dir, raiz = true) => {
  const salida = [];
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    if (raiz ? IGNORAR_RAIZ.has(entrada.name) : IGNORAR.has(entrada.name)) continue;
    const ruta = path.join(dir, entrada.name);
    if (entrada.isDirectory()) salida.push(...listar(ruta, false));
    else if (/\.(js|mjs)$/.test(entrada.name)) salida.push(ruta);
  }
  return salida;
};

// Quita las interpolaciones `${...}` respetando llaves anidadas. Se sustituyen por un espacio: lo
// que hay dentro es JavaScript, y sus puntos (`row.id`) no son alias de SQL.
const sinInterpolaciones = (texto) => {
  let salida = "";
  for (let i = 0; i < texto.length; i += 1) {
    if (texto[i] === "$" && texto[i + 1] === "{") {
      let profundidad = 1;
      i += 2;
      while (i < texto.length && profundidad > 0) {
        if (texto[i] === "{") profundidad += 1;
        else if (texto[i] === "}") profundidad -= 1;
        i += 1;
      }
      i -= 1;
      salida += " ";
    } else {
      salida += texto[i];
    }
  }
  return salida;
};

const limpiar = (sql) =>
  sinInterpolaciones(sql)
    .replace(/--[^\n]*/g, " ")        // comentarios de línea
    .replace(/\/\*[\s\S]*?\*\//g, " ") // comentarios de bloque
    .replace(/'(?:[^']|'')*'/g, " ");  // literales de texto

// Extrae las plantillas de JavaScript que son una sentencia SQL completa.
const plantillasSql = (fuente) => {
  const salida = [];
  const re = /`/g;
  let m;
  while ((m = re.exec(fuente))) {
    if (m.index > 0 && fuente[m.index - 1] === "\\") continue;
    const cierre = fuente.indexOf("`", m.index + 1);
    if (cierre === -1) break;
    const cuerpo = fuente.slice(m.index + 1, cierre);
    re.lastIndex = cierre + 1;
    if (/^\s*(SELECT|WITH|INSERT|UPDATE|DELETE)\b/i.test(cuerpo)) {
      salida.push({ cuerpo, linea: fuente.slice(0, m.index).split("\n").length });
    }
  }
  return salida;
};

const declarados = (sql) => {
  const nombres = new Set();
  // `FROM tabla alias`, `JOIN tabla AS alias`, `UPDATE tabla alias`, `INSERT INTO tabla`
  //
  // ⚠️ LA TABLA PUEDE IR CUALIFICADA CON SU ESQUEMA (`plantillas.ediciones e`), y hasta el
  // 2026-10-08 esto no lo contemplaba: el nombre se leia con `[a-z_][\w]*`, que NO incluye el
  // punto, asi que de `FROM plantillas.ediciones e` se quedaba con `plantillas` y el alias `e`
  // **no lo veia nunca**. La consulta corre perfectamente y la puerta la reportaba como alias sin
  // declarar.
  //
  // No salto antes porque el repositorio no cualifica --las 555 consultas se apoyan en el
  // `search_path`--, pero desde que el esquema se partio en ocho (2026-10-04) cualificar es
  // legitimo, y la primera consulta que lo hizo cayo aqui.
  //
  // Se registran LOS DOS nombres, el cualificado y el corto: una consulta puede referirse a la
  // tabla por cualquiera de ellos.
  for (const m of sql.matchAll(/\b(?:FROM|JOIN|UPDATE|INTO)\s+([a-z_][\w]*(?:\.[a-z_][\w]*)?)(?:\s+(?:AS\s+)?([a-z_][\w]*))?/gi)) {
    const tabla = m[1].toLowerCase();
    nombres.add(tabla);
    if (tabla.includes(".")) nombres.add(tabla.split(".").pop());
    if (m[2] && !NO_SON_ALIAS.has(m[2].toLowerCase())) nombres.add(m[2].toLowerCase());
  }
  // alias de subconsulta: `) alias` o `) AS alias`
  for (const m of sql.matchAll(/\)\s*(?:AS\s+)?([a-z_][\w]*)/gi)) {
    if (!NO_SON_ALIAS.has(m[1].toLowerCase())) nombres.add(m[1].toLowerCase());
  }
  // `unnest(...) WITH ORDINALITY AS alias(col, col)`. El alias va DESPUES de ORDINALITY, asi que el
  // patron de `) alias` de arriba NO lo ve: se topa con `WITH` y se para ahi. Sin esta linea, una
  // consulta perfectamente valida se reporta como alias sin declarar (paso el 2026-08-24 con
  // `backend/scripts/docs/gen-campos-md.mjs`, que desdobla `conkey`/`confkey` en pares).
  //
  // Probado por mutacion: con esta linea puesta, un alias huerfano de verdad (`zz.inventado`) SIGUE
  // reportandose. No ensancha la puerta, le enseña una sintaxis que no conocia.
  for (const m of sql.matchAll(/\bWITH\s+ORDINALITY\s+(?:AS\s+)?([a-z_][\w]*)/gi)) {
    nombres.add(m[1].toLowerCase());
  }
  // CTEs: `WITH x AS (` y `, y AS (`
  for (const m of sql.matchAll(/(?:\bWITH\b|,)\s*([a-z_][\w]*)\s+AS\s*\(/gi)) {
    nombres.add(m[1].toLowerCase());
  }
  return nombres;
};

const usados = (sql) => {
  const nombres = new Map();
  for (const m of sql.matchAll(/(\b(?:FROM|JOIN|UPDATE|INTO)\s+)?\b([a-z_][\w]*)\.([a-z_][\w]*)/gi)) {
    // ⚠️ EL ESQUEMA DE UNA TABLA NO ES UN ALIAS. En "FROM plantillas.ediciones e" el prefijo
    // cualifica a la TABLA; en "SELECT e.id" cualifica a una COLUMNA y ahi si tiene que estar
    // declarado.
    //
    // (Los ejemplos van entre comillas y NO entre acentos graves a proposito: este comprobador
    // busca plantillas de JavaScript que empiecen por SELECT o WITH, asi que un ejemplo entre
    // acentos dentro de su propio comentario se lee como una consulta y se reporta a si mismo.
    // Paso al escribir esta nota.) Se distinguen por lo que llevan DELANTE, y por eso el patron captura el
    // `FROM`/`JOIN`/`UPDATE`/`INTO` opcional: sin esto, la primera consulta que cualificara con su
    // esquema --legitimo desde que el esquema se partio en ocho-- se reportaba como alias huerfano.
    //
    // No ensancha la puerta: lo que se salta es UNA aparicion concreta, la que va pegada a un
    // FROM/JOIN. Un `plantillas.x` suelto en el SELECT sigue reportandose.
    if (m[1]) continue;
    const alias = m[2].toLowerCase();
    if (CALIFICADORES_LIBRES.has(alias)) continue;
    if (!nombres.has(alias)) nombres.set(alias, `${m[2]}.${m[3]}`);
  }
  return nombres;
};

const hallazgos = [];
const ficheros = listar(BACKEND_ROOT);
let consultas = 0;

for (const fichero of ficheros) {
  const fuente = fs.readFileSync(fichero, "utf8");
  for (const { cuerpo, linea } of plantillasSql(fuente)) {
    consultas += 1;
    const sql = limpiar(cuerpo);
    // ⚠️ LAS DECLARACIONES SE LEEN DEL TEXTO ENTERO; LOS USOS, SÓLO HASTA EL PRIMER HUECO. Es la
    // única concesión de este comprobador, y tiene su motivo.
    //
    // Este repo COMPONE consultas: `WITH ... ${query} AND up.unit_id ...` mete por el hueco un
    // fragmento que trae su propio `FROM`, así que un alias usado DESPUÉS del hueco puede estar
    // declarado en algo que aquí no se ve. Reportarlo sería ruido, y un comprobador con ruido se
    // ignora — que es la peor manera de tener uno.
    //
    // Lo de antes del hueco sí se revisa entero, y ahí es donde vive el defecto que esto caza: el
    // alias roto estaba siempre en la lista del SELECT o en un JOIN, y los `${placeholders}` de
    // este repo van al final, en el WHERE. Los TRES casos reales del 2026-08-23 caen dentro.
    const declara = declarados(sql);
    const corte = cuerpo.indexOf("${");
    const zonaRevisada = corte === -1 ? sql : limpiar(cuerpo.slice(0, corte));
    for (const [alias, muestra] of usados(zonaRevisada)) {
      if (!declara.has(alias)) {
        hallazgos.push({
          file: path.relative(BACKEND_ROOT, fichero),
          line: linea,
          alias,
          muestra,
        });
      }
    }
  }
}

if (!hallazgos.length) {
  console.log(
    `check:sql-aliases OK — ${consultas} consultas en ${ficheros.length} ficheros, ningún alias usado sin declarar.`
  );
  process.exit(0);
}

console.error(
  `check:sql-aliases FALLA — ${hallazgos.length} alias usado(s) sin declarar.\n` +
    `PostgreSQL responde "missing FROM-clause entry" EN TIEMPO DE LLAMADA: ni el lint ni el arranque lo ven.\n`
);
for (const h of hallazgos.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)) {
  console.error(`  ${h.file}:${h.line}  usa "${h.alias}." y no se declara  (p. ej. ${h.muestra})`);
}
process.exit(1);
