#!/usr/bin/env node
// Genera, a partir de `docs/02-dominio-datos/consolidado.dbml`, las dos paginas del sitio con los
// mapas «con todos sus campos» y las cifras de `/referencia/modelo-datos/`.
//
// POR QUE EXISTE. El 2026-09-10 el dueño pidio ver los mapas «con todas sus relaciones y campos», y
// no habia donde. Medido ese dia: de las 55 tablas del complemento solo 28 salian con todos sus
// campos en algun diagrama escrito a mano, 17 salian con menos y 10 con ninguno. Y la unica vista
// completa, /referencia/modelo-datos/, agrupaba de otra forma, eran imagenes sin zoom y decia
// «90 tablas» cuando habia 93. Un diagrama con campos escrito a mano se desfasa al ritmo del
// esquema; uno generado no puede.
//
// DE DONDE SALE CADA COSA
//   - Los campos y las claves ajenas: del DBML consolidado, que `gen-dbml.sh` produce desde el
//     esquema aplicado a un PostgreSQL desechable. TODOS, sin elegir.
//   - La agrupacion: de los subgrupos (`subgraph`) de los dos mapas escritos a mano. Si una tabla
//     cambia de subgrupo en el mapa, cambia aqui. El mapa manda en la FORMA; el esquema, en el
//     CONTENIDO.
//
// ⚠️ FALLA A PROPOSITO si una tabla del esquema no esta en ninguno de los dos mapas, o esta en los
// dos. Es la regla de `dominios.json`: una tabla que no se dibuja en ninguna parte no existe para
// quien lea la documentacion.
//
// Lo llama `gen-dbml.sh` justo despues de producir el DBML, y su `--check` compara lo que escribe.
//
//   node scripts/docs/gen-mapa-campos.mjs

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DOCS = join(RAIZ, "docs", "src", "content", "docs");
const MODELO = join(RAIZ, "docs", "02-dominio-datos");

// Cuantas tablas caben en un diagrama sin que la letra baje del minimo del sitio (12 px de letra
// efectiva en una columna de 1317 px). Un subgrupo mayor se parte en trozos seguidos.
const MAX_TABLAS_POR_DIAGRAMA = 8;

// LA DISPOSICION DE CADA GRUPO SE MIDE, NO SE DEDUCE. Cuantas tablas por diagrama y en que direccion
// (de arriba abajo o de izquierda a derecha) se decidio midiendo la letra efectiva en el sitio, y se
// guarda aqui con sus medidas. Se probo antes a deducirlo de la forma del grafo (capas y anchura), y
// el motor de trazado no hace lo que esa cuenta predice: mejoraba un diagrama y empeoraba tres.
//
// Un grupo que no aparezca en el fichero va de arriba abajo y en trozos de MAX_TABLAS_POR_DIAGRAMA.
// Para volver a medir: PRUEBA_DISPOSICION=1 node scripts/docs/gen-mapa-campos.mjs escribe una pagina
// temporal con cada grupo en todas las combinaciones, que se mide en el navegador y se borra.
const DISPOSICION = join(RAIZ, "scripts", "docs", "mapa-campos-disposicion.json");
const disposicion = existsSync(DISPOSICION) ? JSON.parse(readFileSync(DISPOSICION, "utf8")) : { grupos: {} };
const clavesUsadas = new Set();

const MAPAS = [
  {
    origen: "complemento/mapa-completo.md",
    destino: "complemento/mapa-con-campos.md",
    titulo: "El mapa del complemento, con todos sus campos",
    que: "del complemento",
    url: "/complemento/mapa-completo/",
    nombreMapa: "el mapa del complemento"
  },
  {
    origen: "modelo/mapa-completo.md",
    destino: "modelo/mapa-con-campos.md",
    titulo: "El mapa completo, con todos sus campos",
    que: "de la cadena proceso → documento",
    url: "/modelo/mapa-completo/",
    nombreMapa: "el mapa completo"
  }
];

const falla = (mensaje) => {
  console.error(`✖ gen-mapa-campos: ${mensaje}`);
  process.exit(1);
};

// ── El DBML ─────────────────────────────────────────────────────────────────────────────────────
function leerDbml(texto) {
  const tablas = new Map();
  for (const m of texto.matchAll(/^Table "([a-z0-9_]+)" \{\n([\s\S]*?)^\}/gm)) {
    // Fuera las notas —pueden ocupar varias lineas y decir «not null» o «pk» en prosa— y lo que va
    // entre acentos graves (checks y defaults), ANTES de buscar las marcas de cada columna.
    const cuerpo = m[2].replace(/'''[\s\S]*?'''/g, "''").replace(/`[^`]*`/g, "``");
    const columnas = [];
    for (const linea of cuerpo.split("\n")) {
      if (/^\s*(Indexes|Note)\b/.test(linea)) break;
      const c = linea.match(/^\s+"([a-z0-9_]+)" (\S+)(.*)$/);
      if (!c) continue;
      columnas.push({
        nombre: c[1],
        tipo: c[2],
        pk: /\bpk\b/.test(c[3]),
        unica: /\bunique\b/.test(c[3]),
        noNula: /\bnot null\b/.test(c[3])
      });
    }
    if (!columnas.length) falla(`la tabla ${m[1]} no trae columnas en el DBML`);
    tablas.set(m[1], columnas);
  }
  const refs = [];
  for (const linea of texto.split("\n").filter((l) => l.startsWith("Ref "))) {
    // Cada lado es `"tabla"."columna"` o, si la clave ajena es COMPUESTA, `"tabla".("col", "col")`.
    // La segunda forma la estrena `fk_turnos_recorrido` en la fase 4 del frente 24: `turnos` lleva
    // `accion` duplicada a proposito y la clave ajena compuesta es lo que impide que mienta.
    const lado = '"([a-z0-9_]+)"\\.(?:"([a-z0-9_]+)"|\\(([^)]*)\\))';
    const r = linea.match(new RegExp(`^Ref "([^"]+)":${lado} \\??<\\?? ${lado}`));
    if (!r) falla(`una clave ajena que no se sabe leer — ¿cardinalidad no contemplada?: ${linea}`);
    // En la compuesta se etiquetan las DOS columnas: el diagrama miente si solo ensena una.
    const columnaHija = r[6] ?? String(r[7]).replace(/"/g, "").replace(/\s*,\s*/g, ", ");
    refs.push({ nombre: r[1], padre: r[2], hija: r[5], columna: columnaHija });
  }
  return { tablas, refs };
}

// Los tipos, en la forma corta que ya usan los diagramas del sitio, y siempre como una palabra:
// mermaid no acepta una coma dentro del tipo (`numeric(9,6)`).
const TIPOS = { int2: "smallint", int4: "int", int8: "bigint", float4: "real", float8: "float", bool: "boolean", bpchar: "char" };
function tipoMermaid(tipo) {
  const base = tipo.replace(/^"|"$/g, "").replace(/\(.*\)$/, "");
  return (TIPOS[base] ?? base).replace(/\[\]$/, "_array").replace(/[^A-Za-z0-9_]/g, "_");
}

// ── Los mapas escritos a mano: de ellos sale la agrupacion ─────────────────────────────────────
function leerMapa(texto, tablasDelEsquema) {
  const secciones = [];
  let seccion = { titulo: null, grupos: [] };
  let enMermaid = false;
  let subgrafo = null;
  let bloque = null;
  const vistas = new Set();
  for (const linea of texto.split("\n")) {
    if (!enMermaid) {
      const h2 = linea.match(/^## (.+)$/);
      if (h2) {
        if (seccion.grupos.length) secciones.push(seccion);
        seccion = { titulo: h2[1].trim(), grupos: [] };
        continue;
      }
      if (/^```mermaid/.test(linea)) {
        enMermaid = true;
        subgrafo = null;
        bloque = { grupos: [], sueltas: [] };
      }
      continue;
    }
    if (/^```\s*$/.test(linea)) {
      enMermaid = false;
      seccion.grupos.push(...bloque.grupos.filter((g) => g.tablas.length));
      if (bloque.sueltas.length) seccion.grupos.push({ titulo: "Fuera de los subgrupos", tablas: bloque.sueltas });
      continue;
    }
    const sg = linea.match(/^\s*subgraph\s+\w+\s*\["([^"]+)"\]/);
    if (sg) {
      subgrafo = { titulo: sg[1], tablas: [] };
      bloque.grupos.push(subgrafo);
      continue;
    }
    if (/^\s*end\s*$/.test(linea)) {
      subgrafo = null;
      continue;
    }
    // Solo cuenta un nodo cuya etiqueta ES el nombre de una tabla: `P(["persons · de la cadena"])`
    // o `PA(["paises · en el dibujo anterior"])` son referencias a otro dibujo, no declaraciones.
    for (const n of linea.matchAll(/[A-Za-z][A-Za-z0-9_]*\["([a-z0-9_]+)"\]/g)) {
      const tabla = n[1];
      if (!tablasDelEsquema.has(tabla) || vistas.has(tabla)) continue;
      vistas.add(tabla);
      (subgrafo ? subgrafo.tablas : bloque.sueltas).push(tabla);
    }
  }
  if (seccion.grupos.length) secciones.push(seccion);
  return { secciones, tablas: vistas };
}

// ── Un diagrama por grupo (o por trozo de grupo) ────────────────────────────────────────────────
//
// CADA CLAVE AJENA SE DIBUJA UNA SOLA VEZ: en el diagrama de la tabla que la GUARDA. Si apunta a una
// tabla de otro diagrama, esa tabla sale como caja vacia. Las claves que LLEGAN desde otros diagramas
// no se dibujan aqui —ya estan dibujadas donde se guardan—: se listan debajo, en un desplegable.
//
// ⚠️ No es estetica, y esta medido (2026-09-10, columna de 1317 px). Dibujando tambien las que llegan,
// «La organizacion» —que contiene `persons`, a la que apunta medio centenar de tablas— salia a 9254 px
// de ancho y 2,3 px de letra, y «Lo que decide el pais» a 7,8. Una tabla a la que apunta todo el
// esquema convierte su diagrama en una fila de cajas vacias.
// La clave de un grupo en el fichero de disposicion: pagina › seccion › subgrupo, sin marcas de Markdown.
const claveDeGrupo = (mapa, seccion, grupo) =>
  [mapa.destino, (seccion.titulo ?? "—").replace(/[*`]/g, ""), grupo.titulo].join(" › ");

function trocear(tablas, max = MAX_TABLAS_POR_DIAGRAMA) {
  if (tablas.length <= max) return [tablas];
  const partes = Math.ceil(tablas.length / max);
  const tam = Math.ceil(tablas.length / partes);
  return Array.from({ length: partes }, (_, i) => tablas.slice(i * tam, (i + 1) * tam));
}

function diagrama(grupo, modelo, fks, direccion = "TB") {
  const dentro = new Set(grupo);
  const propias = modelo.refs.filter((r) => dentro.has(r.hija));
  const entrantes = modelo.refs.filter((r) => dentro.has(r.padre) && !dentro.has(r.hija));
  const lineas = ["```mermaid", "erDiagram", "  %% generado por scripts/docs/gen-mapa-campos.mjs: no se edita a mano"];
  if (direccion === "LR") lineas.push("  direction LR");
  for (const tabla of grupo) {
    lineas.push(`  ${tabla} {`);
    for (const c of modelo.tablas.get(tabla)) {
      const claves = [c.pk && "PK", fks.has(`${tabla}.${c.nombre}`) && "FK", c.unica && !c.pk && "UK"].filter(Boolean);
      lineas.push(`    ${tipoMermaid(c.tipo)} ${c.nombre}${claves.length ? ` ${claves.join(", ")}` : ""}`);
    }
    lineas.push("  }");
  }
  for (const r of propias) {
    const columnas = modelo.tablas.get(r.hija);
    const col = columnas.find((c) => c.nombre === r.columna);
    const lado = col?.noNula ? "||" : "|o";
    const unoAUno = col && (col.unica || (col.pk && columnas.filter((c) => c.pk).length === 1));
    lineas.push(`  ${r.padre} ${lado}--${unoAUno ? "o|" : "o{"} ${r.hija} : "${r.columna}"`);
  }
  lineas.push("```");
  const apunta = [...new Set(propias.map((r) => r.padre).filter((t) => !dentro.has(t)))].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const columnas = grupo.reduce((n, t) => n + modelo.tablas.get(t).length, 0);
  return { bloque: lineas.join("\n"), propias, entrantes, apunta, columnas };
}

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
const codigo = (lista) => lista.map((t) => `\`${t}\``).join(", ");

function pagina(mapa, secciones, modelo, fks) {
  const cuerpo = [];
  let nTablas = 0;
  let nColumnas = 0;
  let nClaves = 0;
  let nDiagramas = 0;
  for (const s of secciones) {
    const nivel = s.titulo ? "###" : "##";
    if (s.titulo) cuerpo.push(`## ${s.titulo}`, "");
    for (const g of s.grupos) {
      const clave = claveDeGrupo(mapa, s, g);
      const decidido = disposicion.grupos?.[clave];
      if (decidido) clavesUsadas.add(clave);
      const partes = trocear(g.tablas, decidido?.maxTablas);
      partes.forEach((parte, i) => {
        const d = diagrama(parte, modelo, fks, decidido?.direcciones?.[i] ?? "TB");
        nTablas += parte.length;
        nColumnas += d.columnas;
        nClaves += d.propias.length;
        nDiagramas += 1;
        cuerpo.push(`${nivel} ${partes.length > 1 ? `${g.titulo} (${i + 1} de ${partes.length})` : g.titulo}`, "");
        const apunta = d.apunta.length
          ? ` Apunta a ${codigo(d.apunta)}, ${d.apunta.length === 1 ? "que sale" : "que salen"} como caja vacía.`
          : "";
        cuerpo.push(`**${plural(parte.length, "tabla", "tablas")}** · ${plural(d.columnas, "columna", "columnas")} · ${plural(d.propias.length, "clave ajena propia", "claves ajenas propias")}.${apunta}`, "");
        cuerpo.push(d.bloque, "");
        if (d.entrantes.length) {
          cuerpo.push(
            "<details>",
            `<summary>${d.entrantes.length === 1 ? "Llega 1 clave ajena" : `Llegan ${d.entrantes.length} claves ajenas`} desde otros diagramas</summary>`,
            "",
            d.entrantes.map((r) => `\`${r.hija}.${r.columna}\` → \`${r.padre}\``).join(" · "),
            "",
            "</details>",
            ""
          );
        }
      });
    }
  }
  const cabecera = [
    "---",
    `title: "${mapa.titulo}"`,
    `description: "Las ${nTablas} tablas ${mapa.que}, agrupadas como en el mapa, con todas sus columnas y claves ajenas. Se genera desde el esquema."`,
    "sidebar:",
    '  label: "Mapa con campos"',
    "  order: 15.5",
    "---",
    "",
    ":::note[Esta página se genera: no se edita a mano]",
    "La escribe `scripts/docs/gen-mapa-campos.mjs` cada vez que corre `bash scripts/docs/gen-dbml.sh`,",
    "a partir del esquema, y la puerta de CI falla si se separa de él. Una edición a mano se pierde en",
    "la siguiente regeneración.",
    "",
    `**La agrupación sale de [${mapa.nombreMapa}](${mapa.url})**: si una tabla cambia de subgrupo allí,`,
    "cambia aquí. **Los campos y las relaciones salen del esquema, sin elegir**: están todos.",
    ":::",
    "",
    `**${nTablas} tablas · ${nColumnas} columnas · ${nClaves} claves ajenas · ${nDiagramas} diagramas.**`,
    "",
    "## Cómo leerla",
    "",
    "- Cada **caja con campos** es una tabla del grupo, con **todas** sus columnas: tipo, nombre y, si",
    "  lo es, `PK` (clave primaria), `FK` (clave ajena) o `UK` (única).",
    "- **Cada clave ajena se dibuja una sola vez: en el diagrama de la tabla que la guarda.** Si apunta a",
    "  una tabla de otro diagrama, esa tabla sale como **caja vacía**; sus campos están en el suyo.",
    "- Las claves que **llegan** desde otros diagramas se listan debajo de cada uno, en un desplegable.",
    "  Dibujarlas también hacía ilegible cualquier grupo con una tabla a la que apunta medio esquema,",
    "  como `persons`.",
    "- En cada línea, `||` quiere decir que la clave ajena es obligatoria y `|o` que admite nulos; `o{`",
    "  son varias filas y `o|` como mucho una. La etiqueta es la columna que guarda la clave.",
    "- Un subgrupo grande va en varios diagramas seguidos, y algunos se leen de izquierda a derecha:",
    "  se decidió midiendo la letra de cada uno, para que ninguno baje de 12 px a ancho de columna.",
    "- Para acercar, **Ctrl + rueda** sobre el diagrama, o su botón de pantalla completa.",
    ""
  ];
  return { texto: `${[...cabecera, ...cuerpo].join("\n").replace(/\n+$/, "")}\n`, nTablas, nColumnas, nClaves, nDiagramas };
}

// ── Las cifras de /referencia/modelo-datos/ ──────────────────────────────────────────────────────
function cifras(modelo) {
  const valores = { "total-tablas": modelo.tablas.size, "total-relaciones": modelo.refs.length };
  const dominios = JSON.parse(readFileSync(join(RAIZ, "scripts", "docs", "dominios.json"), "utf8"));
  for (const clave of Object.keys(dominios).filter((k) => !k.startsWith("_"))) {
    const ruta = join(MODELO, "dominios", `${clave}.dbml`);
    if (!existsSync(ruta)) falla(`no existe ${ruta}: ¿se ha renombrado un dominio?`);
    const dbml = readFileSync(ruta, "utf8");
    valores[`tablas-dominio:${clave}`] = (dbml.match(/^Table "/gm) ?? []).length;
    valores[`relaciones-fuera:${clave}`] = (dbml.match(/^\/\/\s+\S+ -> \S+\s+\[/gm) ?? []).length;
  }
  return valores;
}

function rellenarCifras(ruta, valores) {
  const antes = readFileSync(ruta, "utf8");
  let texto = antes.replace(/<!-- gen:([a-z0-9:_-]+) -->[\s\S]*?<!-- \/gen -->/g, (_, clave) => {
    if (!(clave in valores)) falla(`${ruta}: marca desconocida «gen:${clave}»`);
    return `<!-- gen:${clave} -->${valores[clave]}<!-- /gen -->`;
  });
  texto = texto.replace(/^(description: Las )\d+( tablas)/m, `$1${valores["total-tablas"]}$2`);
  if (!texto.includes("<!-- gen:total-tablas -->")) falla(`${ruta}: le falta la marca «gen:total-tablas»`);
  if (texto !== antes) writeFileSync(ruta, texto);
}

// ── Todo junto ───────────────────────────────────────────────────────────────────────────────────
const modelo = leerDbml(readFileSync(join(MODELO, "consolidado.dbml"), "utf8"));
const fks = new Set(modelo.refs.map((r) => `${r.hija}.${r.columna}`));
const esquema = new Set(modelo.tablas.keys());

const leidos = MAPAS.map((mapa) => ({ mapa, ...leerMapa(readFileSync(join(DOCS, mapa.origen), "utf8"), esquema) }));
const union = new Set(leidos.flatMap((l) => [...l.tablas]));
const enNinguno = [...esquema].filter((t) => !union.has(t)).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
const enLosDos = [...leidos[0].tablas].filter((t) => leidos[1].tablas.has(t)).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
if (enNinguno.length) {
  falla(`${enNinguno.length} tabla(s) del esquema no estan en ningun mapa: ${enNinguno.join(", ")}.\n` +
    "  Dibujala en complemento/mapa-completo.md o en modelo/mapa-completo.md, dentro del subgrupo que le toque.");
}
if (enLosDos.length) falla(`tabla(s) dibujadas en los DOS mapas: ${enLosDos.join(", ")}. Cada tabla va en uno.`);

if (process.env.PRUEBA_DISPOSICION) {
  const cuerpo = ["---", 'title: "Prueba de disposición (temporal, se borra)"', "---", "",
    "Página TEMPORAL para medir la letra de cada combinación. No se commitea.", ""];
  for (const { mapa, secciones } of leidos) {
    for (const s of secciones) {
      for (const g of s.grupos) {
        const clave = claveDeGrupo(mapa, s, g);
        if (process.env.PRUEBA_GRUPO && !clave.includes(process.env.PRUEBA_GRUPO)) continue;
        const vistas = new Set();
        for (const max of (process.env.PRUEBA_TAMANOS ?? "8,6,5,4").split(",").map(Number)) {
          const partes = trocear(g.tablas, max);
          const firma = partes.map((p) => p.length).join("+");
          if (vistas.has(firma)) continue;
          vistas.add(firma);
          partes.forEach((parte, i) => {
            for (const direccion of ["TB", "LR"]) {
              cuerpo.push(`### ${clave} ¦ ${max} ¦ ${i + 1}/${partes.length} ¦ ${direccion}`, "",
                diagrama(parte, modelo, fks, direccion).bloque, "");
            }
          });
        }
      }
    }
  }
  const ruta = join(DOCS, "referencia", "prueba-disposicion.md");
  writeFileSync(ruta, `${cuerpo.join("\n")}\n`);
  console.log(`  prueba escrita: ${ruta} (${cuerpo.filter((l) => l.startsWith("### ")).length} diagramas)`);
  process.exit(0);
}

let clavesDibujadas = 0;
for (const { mapa, secciones } of leidos) {
  const p = pagina(mapa, secciones, modelo, fks);
  const ruta = join(DOCS, mapa.destino);
  if (!existsSync(ruta) || readFileSync(ruta, "utf8") !== p.texto) writeFileSync(ruta, p.texto);
  clavesDibujadas += p.nClaves;
  console.log(`  ${mapa.destino}: ${p.nTablas} tablas · ${p.nColumnas} columnas · ${p.nClaves} claves ajenas · ${p.nDiagramas} diagramas`);
}
// Cada clave ajena la guarda una tabla, y cada tabla esta en un solo mapa: entre las dos paginas
// tienen que salir dibujadas TODAS, y cada una una sola vez.
if (clavesDibujadas !== modelo.refs.length) {
  falla(`se dibujaron ${clavesDibujadas} claves ajenas y el esquema tiene ${modelo.refs.length}`);
}
const sobrantes = Object.keys(disposicion.grupos ?? {}).filter((k) => !clavesUsadas.has(k));
if (sobrantes.length) {
  falla(`el fichero de disposicion nombra grupos que ya no existen: ${sobrantes.join(" · ")}.\n` +
    "  Se renombro o se movio un subgrupo en el mapa: vuelve a medir y corrige el fichero.");
}
rellenarCifras(join(DOCS, "referencia", "modelo-datos.md"), cifras(modelo));
console.log(`  referencia/modelo-datos.md: ${modelo.tablas.size} tablas · ${modelo.refs.length} relaciones`);
