// Acceso a datos del dossier sobre el núcleo relacional (Fase 6, ex-MongoDB).
// Modelo de 2 tablas: dossiers (raíz por person_id) + dossier_items (una fila
// por ítem, con `section` + `data` JSONB/JSON + url_documento). Engine-transparente
// vía el adaptador (config/postgres.js).
//
// IDs opacos como String (era ObjectId). `data` guarda los campos del ítem; los
// defaults por sección replican exactamente los del schema Mongoose.

import { getPostgresPool } from "../../config/postgres.js";

const pool = () => getPostgresPool();

export const SECTIONS = [
  "titulos", "experiencia", "referencias", "formacion", "certificaciones",
  "articulos", "libros", "ponencias", "tesis", "proyectos",
];
export const INVESTIGACION_SECTIONS = ["articulos", "libros", "ponencias", "tesis", "proyectos"];

// Defaults que aplicaba cada subschema Mongoose (excluye url_documento, que es
// columna). Replican models/users/dossiers.js exactamente.
const SECTION_DEFAULTS = {
  titulos: { pais: "Ecuador", sera: "Enviado" },
  experiencia: {},
  referencias: { cargo_parentesco: "", institution: "" },
  formacion: { pais: "Ecuador" },
  certificaciones: {},
  articulos: { pais: "Ecuador" },
  libros: { pais: "Ecuador" },
  ponencias: { pais: "Ecuador" },
  tesis: { pais: "Ecuador" },
  proyectos: { pais: "Ecuador" },
};

export const isValidId = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0;
};

const parseData = (v) => {
  if (v === null || v === undefined) return {};
  if (typeof v === "string") { try { return JSON.parse(v); } catch { return {}; } }
  return v;
};

const mapItem = (row) => {
  const data = parseData(row.data);
  const { _id, url_documento, ...rest } = data; // defensivo por si quedaron en data
  return { ...rest, _id: String(row.id), url_documento: row.url_documento ?? "" };
};

// Separa el body en (campos de data) y url_documento (columna); descarta _id.
const splitBody = (body = {}) => {
  const { _id, url_documento, ...rest } = body || {};
  return { rest, url_documento };
};

// --- Raíz ---

export async function resolvePersonId(cedula) {
  const [rows] = await pool().query(`SELECT id FROM persons WHERE cedula = ? LIMIT 1`, [String(cedula)]);
  return rows[0]?.id ?? null;
}

// getOrCreate: crea el dossier si la persona existe; null si no hay persona.
export async function getOrCreateDossier(cedula) {
  const personId = await resolvePersonId(cedula);
  if (!personId) return null;
  await pool().query(`INSERT IGNORE INTO dossiers (person_id, cedula) VALUES (?, ?)`, [personId, String(cedula)]);
  const [rows] = await pool().query(`SELECT * FROM dossiers WHERE person_id = ? LIMIT 1`, [personId]);
  return rows[0] || null;
}

export async function findDossierByCedula(cedula) {
  const personId = await resolvePersonId(cedula);
  if (!personId) return null;
  const [rows] = await pool().query(`SELECT * FROM dossiers WHERE person_id = ? LIMIT 1`, [personId]);
  return rows[0] || null;
}

// Árbol completo con la forma que exponía Mongo (secciones raíz + investigacion).
export async function loadTree(dossier) {
  const [items] = await pool().query(
    `SELECT id, section, data, url_documento FROM dossier_items WHERE dossier_id = ? ORDER BY id ASC`,
    [dossier.id]
  );
  const bySection = Object.fromEntries(SECTIONS.map((s) => [s, []]));
  for (const it of items) (bySection[it.section] ||= []).push(mapItem(it));
  return {
    _id: String(dossier.id),
    cedula: dossier.cedula,
    titulos: bySection.titulos,
    experiencia: bySection.experiencia,
    referencias: bySection.referencias,
    formacion: bySection.formacion,
    certificaciones: bySection.certificaciones,
    investigacion: {
      articulos: bySection.articulos,
      libros: bySection.libros,
      ponencias: bySection.ponencias,
      tesis: bySection.tesis,
      proyectos: bySection.proyectos,
    },
  };
}

// --- Ítems ---

export async function addItem(dossierId, section, body) {
  const { rest, url_documento } = splitBody(body);
  const data = { ...(SECTION_DEFAULTS[section] || {}), ...rest };
  const [res] = await pool().query(
    `INSERT INTO dossier_items (dossier_id, section, data, url_documento) VALUES (?, ?, ?, ?)`,
    [dossierId, section, JSON.stringify(data), url_documento ?? ""]
  );
  return res.insertId;
}

export async function findItem(itemId, dossierId, section) {
  if (!isValidId(itemId)) return null;
  const [rows] = await pool().query(
    `SELECT * FROM dossier_items WHERE id = ? AND dossier_id = ? AND section = ? LIMIT 1`,
    [Number(itemId), dossierId, section]
  );
  return rows[0] || null;
}

export async function updateItem(itemId, dossierId, section, patch) {
  const item = await findItem(itemId, dossierId, section);
  if (!item) return false;
  const { rest, url_documento } = splitBody(patch);
  const data = { ...parseData(item.data), ...rest };
  const fields = ["data = ?"];
  const params = [JSON.stringify(data)];
  if (url_documento !== undefined) { fields.push("url_documento = ?"); params.push(url_documento); }
  params.push(Number(itemId));
  await pool().query(`UPDATE dossier_items SET ${fields.join(", ")} WHERE id = ?`, params);
  return true;
}

export async function deleteItem(itemId, dossierId, section) {
  if (!isValidId(itemId)) return false;
  const [res] = await pool().query(
    `DELETE FROM dossier_items WHERE id = ? AND dossier_id = ? AND section = ?`,
    [Number(itemId), dossierId, section]
  );
  return (res.affectedRows || 0) > 0;
}

export async function setItemUrl(itemId, dossierId, section, url) {
  if (!isValidId(itemId)) return false;
  const [res] = await pool().query(
    `UPDATE dossier_items SET url_documento = ? WHERE id = ? AND dossier_id = ? AND section = ?`,
    [url ?? "", Number(itemId), dossierId, section]
  );
  return (res.affectedRows || 0) > 0;
}
