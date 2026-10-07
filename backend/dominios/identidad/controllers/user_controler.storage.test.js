// Tests del módulo de almacenamiento extraído de user_controler.js (Fase 3).
//
// Solo se prueba `resolveStoredDocumentObject`: es la única con lógica de ramas real
// (normalizar la ruta y decidir si ya viene prefijada o hay que prefijarla). El resto
// —listMinioObjects, writeMinioObjectToFile, createZipArchive— son envoltorios de IO
// (stream de MinIO, spawn de `zip`) sin ramas que merezcan un doble; se ejercen de
// extremo a extremo en los characterization tests de descarga de entregables.
//
// Deuda anotada: `collectDeliverableTemplateResources` SÍ tiene lógica de filtrado
// (formatos excluidos, ficheros ocultos, nombres relativos) pero llama a
// listMinioObjects internamente; testearla exige mockear el módulo minio_service.
//
// Ojo: el prefijo/bucket se leen de env AL IMPORTAR el módulo, así que estos tests
// asumen los valores por defecto (deasy-documents / Unidades).

import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveStoredDocumentObject,
  MINIO_DOCUMENTS_BUCKET,
  MINIO_DOCUMENTS_PREFIX
} from "./user_controler.storage.js";

test("resolveStoredDocumentObject devuelve null ante una ruta vacía", () => {
  assert.equal(resolveStoredDocumentObject(""), null);
  assert.equal(resolveStoredDocumentObject(null), null);
  assert.equal(resolveStoredDocumentObject("   "), null);
  assert.equal(resolveStoredDocumentObject("///"), null, "solo barras → vacío tras normalizar");
});

test("resolveStoredDocumentObject respeta una ruta que ya viene con el prefijo", () => {
  const stored = `${MINIO_DOCUMENTS_PREFIX}/5/PROCESOS/9/doc.pdf`;
  assert.deepEqual(resolveStoredDocumentObject(stored), {
    bucket: MINIO_DOCUMENTS_BUCKET,
    objectName: stored,
    relativePath: "5/PROCESOS/9/doc.pdf"
  });
});

test("resolveStoredDocumentObject añade el prefijo a una ruta relativa", () => {
  assert.deepEqual(resolveStoredDocumentObject("5/PROCESOS/9/doc.pdf"), {
    bucket: MINIO_DOCUMENTS_BUCKET,
    objectName: `${MINIO_DOCUMENTS_PREFIX}/5/PROCESOS/9/doc.pdf`,
    relativePath: "5/PROCESOS/9/doc.pdf"
  });
});

test("resolveStoredDocumentObject normaliza barras iniciales y espacios", () => {
  const resolved = resolveStoredDocumentObject("  /5/doc.pdf  ");
  assert.equal(resolved.objectName, `${MINIO_DOCUMENTS_PREFIX}/5/doc.pdf`);
  assert.equal(resolved.relativePath, "5/doc.pdf");
});
