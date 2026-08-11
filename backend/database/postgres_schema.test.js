// Test unitario del esquema: `template_artifacts.lifecycle_state` nace SIN PUBLICAR (defecto 1.13).
//
// Por que un test sobre el TEXTO del esquema y no sobre la base: el defecto no tiene disparador vivo
// —los cuatro `INSERT INTO template_artifacts` del repo fijan `lifecycle_state` explicitamente y el
// CRUD generico ni llega al INSERT, porque `tableHooks.template_artifacts.beforeCreate()` lanza
// siempre—, asi que no hay ruta HTTP que lo ejercite y ningun golden puede vigilarlo. Lo que si se
// puede romper en silencio es el PAR que hace efectivo el arreglo, y eso es lo que se fija aqui:
//
//   1. el DEFAULT de la definicion de la tabla, para bases nuevas; y
//   2. el `ALTER TABLE ... SET DEFAULT`, para las que YA existen.
//
// Hacen falta LOS DOS. `postgres_schema.sql` se reaplica en cada arranque, pero
// `CREATE TABLE IF NOT EXISTS` no toca una tabla que ya existe: sin el ALTER, cada base desplegada
// seguiria pariendo filas `published`. Y sin el DEFAULT de la definicion, el ALTER seria un parche
// que contradice el esquema que dice ser la fuente de verdad.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCHEMA = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "postgres_schema.sql"),
  "utf8"
);

// Solo el bloque `CREATE TABLE ... template_artifacts (...)`, para no confundirlo con otras tablas.
const createTemplateArtifacts = SCHEMA.slice(
  SCHEMA.indexOf("CREATE TABLE IF NOT EXISTS template_artifacts")
).split(");")[0];

test("la definicion de template_artifacts declara lifecycle_state con DEFAULT 'draft'", () => {
  const columna = createTemplateArtifacts
    .split("\n")
    .find((linea) => linea.trim().startsWith("lifecycle_state"));
  assert.ok(columna, "la columna lifecycle_state debe existir en la definicion de la tabla");
  assert.match(columna, /NOT NULL DEFAULT 'draft'/);
});

test("el DEFAULT inseguro no vuelve por la puerta de atras", () => {
  assert.doesNotMatch(
    createTemplateArtifacts,
    /lifecycle_state[^\n]*DEFAULT 'published'/,
    "lo que nace, nace sin publicar: el default seguro es el que falla cerrado"
  );
});

test("un ALTER idempotente lleva el DEFAULT nuevo a las bases que YA existen", () => {
  assert.match(
    SCHEMA,
    /ALTER TABLE template_artifacts\s+ALTER COLUMN lifecycle_state SET DEFAULT 'draft';/,
    "CREATE TABLE IF NOT EXISTS no cambia un DEFAULT en una base ya creada"
  );
});

// El CHECK sigue admitiendo los tres estados: bajar el default no estrecha el dominio.
test("lifecycle_state sigue admitiendo draft, published y retired", () => {
  assert.match(
    createTemplateArtifacts,
    /lifecycle_state TEXT CHECK \(lifecycle_state IN \('draft','published','retired'\)\)/
  );
});
