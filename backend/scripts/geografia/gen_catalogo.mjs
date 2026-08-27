// Genera `backend/config/geografiaCatalog.js`. NO edites el fichero generado: se pisa.
//
//   node backend/scripts/geografia/gen_catalogo.mjs <dpa.json>
//
// De donde sale cada cosa:
//
//   paises      de `frontend/src/core/constants/countries.js` (nombre EN, nombre ES y
//               prefijo telefonico). Ese fichero NO trae codigo ISO, y un catalogo de
//               paises sin ISO-3166 alfa-2 no cruza con nada, asi que el codigo se
//               DERIVA con `Intl.DisplayNames` -- que es la base de datos CLDR que ya
//               trae Node-- casando por el nombre en ingles y, si falla, por el
//               espanol. Eso resuelve 217 de 232; los 15 restantes van en ALIAS, uno a
//               uno, porque son nombres largos de la norma vieja ("Korea, Republic of")
//               que el CLDR moderno no usa.
//
//   provincias  del Clasificador Geografico Estadistico del INEC. Ver
//   cantones    `extraer_dpa.py`, que documenta la fuente, la forma y la trampa de las
//               jurisdicciones historicas.
//
//   operadoras  las cuatro operadoras moviles del Ecuador. OJO: se guardan como dato
//               DECLARADO por la persona, nunca autoritativo. Con portabilidad numerica
//               la operadora de un numero cambia sin que nadie avise, asi que este
//               campo se pudre solo. Si alguna vez hace falta de verdad, se consulta en
//               el momento de usarlo; no se confia en lo guardado.

import { readFileSync, writeFileSync } from "node:fs";

const RAIZ = new URL("../../../", import.meta.url).pathname;

// Los 15 que el CLDR no reconoce por nombre. Cada uno comprobado contra ISO-3166 alfa-2.
const ALIAS = {
  "Czech Republic": "CZ",
  "Holy See (Vatican City State)": "VA",
  "Hong Kong": "HK",
  "Macao": "MO",
  "Macedonia, The Former Yugoslav Republic of": "MK",
  "Micronesia, Federated States of": "FM",
  "Myanmar": "MM",
  "Netherlands Antilles": "AN", // disuelta en 2010; el codigo esta RETIRADO -> is_active 0
  "Palestinian Territory, Occupied": "PS",
  "Pitcairn": "PN",
  "Saint Helena": "SH",
  "Saint Kitts and Nevis": "KN",
  "Saint Vincent and the Grenadines": "VC",
  "Swaziland": "SZ",
  "Virgin Islands, U.S.": "VI",
};

// Paises cuyo codigo ISO ya no esta vigente. Se siembran inactivos en vez de borrarse:
// borrarlos silenciaria que la lista de origen esta anticuada.
const RETIRADOS = new Set(["AN"]);

const norm = (s) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();

const indiceCldr = () => {
  const idx = new Map();
  for (const loc of ["en", "es"]) {
    const dn = new Intl.DisplayNames([loc], { type: "region" });
    for (let a = 65; a <= 90; a++) {
      for (let b = 65; b <= 90; b++) {
        const code = String.fromCharCode(a) + String.fromCharCode(b);
        let nombre;
        try { nombre = dn.of(code); } catch { continue; }
        if (!nombre || nombre === code) continue;
        if (!idx.has(norm(nombre))) idx.set(norm(nombre), code);
      }
    }
  }
  return idx;
};

const leerPaises = () => {
  const src = readFileSync(`${RAIZ}frontend/src/core/constants/countries.js`, "utf8");
  const bruto = JSON.parse(src.match(/const countries = (\[[\s\S]*?\]);/)[1]);
  const idx = indiceCldr();
  const sinIso = [];
  const paises = bruto.map((c) => {
    const iso = ALIAS[c.name] ?? idx.get(norm(c.name)) ?? idx.get(norm(c.es_name)) ?? null;
    if (!iso) sinIso.push(c.name);
    return { iso, nombre: c.es_name, nombre_en: c.name, prefijo: c.phone_code,
             activo: iso && !RETIRADOS.has(iso) ? 1 : 0 };
  });
  if (sinIso.length) throw new Error(`Sin ISO: ${sinIso.join(", ")}`);
  const dup = paises.map((p) => p.iso).filter((v, i, a) => a.indexOf(v) !== i);
  if (dup.length) throw new Error(`ISO duplicado: ${dup.join(", ")}`);
  return paises;
};

const OPERADORAS = [
  { codigo: "CLARO", nombre: "Claro", pais_iso: "EC" },
  { codigo: "MOVISTAR", nombre: "Movistar", pais_iso: "EC" },
  { codigo: "CNT", nombre: "CNT", pais_iso: "EC" },
  { codigo: "TUENTI", nombre: "Tuenti", pais_iso: "EC" },
  { codigo: "OTRA", nombre: "Otra", pais_iso: null },
];

const dpa = JSON.parse(readFileSync(process.argv[2], "utf8"));
const paises = leerPaises();

const j = (v) => JSON.stringify(v);
const filas = (xs) => xs.map((x) => `  ${j(x)},`).join("\n");

const salida = `// GENERADO por backend/scripts/geografia/gen_catalogo.mjs — NO editar a mano.
//
// Paises: ${paises.length} (ISO-3166 alfa-2 derivado del CLDR de Node; ${paises.filter((p) => !p.activo).length} inactivo por
// codigo retirado). Provincias: ${dpa.provincias.length}. Cantones: ${dpa.cantones.length}. Los dos ultimos, del
// Clasificador Geografico Estadistico 2025 del INEC.
//
// La unicidad de un canton es (provincia, nombre), NUNCA el nombre: "Bolivar" y "Olmedo"
// existen en dos provincias distintas cada uno.

export const PAISES = [
${filas(paises)}
];

export const PROVINCIAS_EC = [
${filas(dpa.provincias)}
];

export const CANTONES_EC = [
${filas(dpa.cantones)}
];

export const OPERADORAS = [
${filas(OPERADORAS)}
];
`;

writeFileSync(`${RAIZ}backend/config/geografiaCatalog.js`, salida);
console.log(`✓ paises ${paises.length} · provincias ${dpa.provincias.length} · cantones ${dpa.cantones.length} · operadoras ${OPERADORAS.length}`);
