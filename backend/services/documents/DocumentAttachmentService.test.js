// Tests unitarios de los anexos de una versión documental.
//
// ⚠️ ESTE FICHERO NACE CON LA EXTRACCIÓN (2026-10-07, F7.2) Y ES LA PRIMERA COBERTURA QUE TIENEN ESAS
// CUATRO RUTAS. Se comprobó antes de escribirlo: ni un test de caracterización llama a
// `/users/:id/.../attachments` —la única mención en `tests/` es un comentario—, así que mover sus
// consultas no tenía ninguna red de comportamiento. Ahora la tiene al nivel que importa: la forma del
// SQL y los parámetros con que se llama.
//
// No hay base de datos: se pasa una conexión de mentira que apunta qué SQL recibió y con qué.

import test from "node:test";
import assert from "node:assert/strict";

import {
  deleteAttachment,
  findAttachmentOfTaskItem,
  insertAttachment,
  listAttachmentsOfDocumentVersion,
  nextAttachmentOrder,
} from "./DocumentAttachmentService.js";

const conexionFalsa = (respuesta = [[]]) => {
  const llamadas = [];
  return {
    llamadas,
    query: async (sql, params) => {
      llamadas.push({ sql: String(sql).replace(/\s+/g, " ").trim(), params });
      return respuesta;
    },
  };
};

test("listAttachmentsOfDocumentVersion ordena por sort_order y luego por id", async () => {
  const c = conexionFalsa([[{ id: 7 }]]);
  const filas = await listAttachmentsOfDocumentVersion(c, "41");
  assert.deepEqual(filas, [{ id: 7 }]);
  assert.match(c.llamadas[0].sql, /FROM document_attachments WHERE document_version_id = \?/);
  assert.match(c.llamadas[0].sql, /ORDER BY sort_order ASC, id ASC/);
  // el id llega como texto desde la ruta y se fuerza a número
  assert.deepEqual(c.llamadas[0].params, [41]);
});

test("listAttachmentsOfDocumentVersion devuelve lista vacía, nunca undefined", async () => {
  const c = conexionFalsa([undefined]);
  assert.deepEqual(await listAttachmentsOfDocumentVersion(c, 1), []);
});

test("nextAttachmentOrder es el máximo más uno, y vale 1 cuando no hay ninguno", async () => {
  const conMax = conexionFalsa([[{ next_order: 4 }]]);
  assert.equal(await nextAttachmentOrder(conMax, 41), 4);
  assert.match(conMax.llamadas[0].sql, /COALESCE\(MAX\(sort_order\), 0\) \+ 1 AS next_order/);

  const sinFilas = conexionFalsa([[]]);
  assert.equal(await nextAttachmentOrder(sinFilas, 41), 1);
});

test("insertAttachment escribe las nueve columnas en orden y devuelve el id nuevo", async () => {
  const c = conexionFalsa([{ insertId: 99 }]);
  const id = await insertAttachment(c, {
    documentVersionId: "41",
    kind: "annex",
    filePath: "ruta/anexo.pdf",
    fileName: "anexo.pdf",
    mimeType: "application/pdf",
    sizeBytes: 1234,
    description: null,
    uploadedByPersonId: 5,
    sortOrder: 2,
  });
  assert.equal(id, 99);
  assert.match(c.llamadas[0].sql, /^INSERT INTO document_attachments/);
  assert.deepEqual(c.llamadas[0].params, [
    41, "annex", "ruta/anexo.pdf", "anexo.pdf", "application/pdf", 1234, null, 5, 2,
  ]);
});

// ⚠️ ÉSTA ES LA QUE VIGILA LA FUSIÓN. El controller tenía la misma consulta DOS VECES con dos
// proyecciones distintas —`id, file_path` para borrar y `file_path, file_name, mime_type` para
// descargar—. Quedó una que proyecta las cuatro, así que las cuatro tienen que seguir estando.
test("findAttachmentOfTaskItem proyecta las CUATRO columnas que necesitan sus dos llamadores", async () => {
  const c = conexionFalsa([[{ id: 3, file_path: "p", file_name: "n", mime_type: "m" }]]);
  const fila = await findAttachmentOfTaskItem(c, "3", "41");
  assert.deepEqual(fila, { id: 3, file_path: "p", file_name: "n", mime_type: "m" });
  for (const col of ["da.id", "da.file_path", "da.file_name", "da.mime_type"]) {
    assert.ok(c.llamadas[0].sql.includes(col), `falta ${col} en la proyección`);
  }
  assert.deepEqual(c.llamadas[0].params, [3, 41]);
});

// El JOIN es la comprobación que importa: un anexo sólo se encuentra si pertenece a una versión
// documental DE ESE entregable. Sin él, cualquiera con un id adivinado se lo lleva.
test("findAttachmentOfTaskItem exige que el anexo sea de una versión de ESE entregable", async () => {
  const c = conexionFalsa([[]]);
  assert.equal(await findAttachmentOfTaskItem(c, 1, 2), null);
  assert.match(c.llamadas[0].sql, /INNER JOIN document_versions dv ON dv\.id = da\.document_version_id/);
  assert.match(c.llamadas[0].sql, /WHERE da\.id = \? AND dv\.task_item_id = \?/);
});

test("deleteAttachment borra por id, y sólo por id", async () => {
  const c = conexionFalsa([{}]);
  await deleteAttachment(c, "8");
  assert.equal(c.llamadas[0].sql, "DELETE FROM document_attachments WHERE id = ?");
  assert.deepEqual(c.llamadas[0].params, [8]);
});
