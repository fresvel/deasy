// Tests unitarios del escritor de FILAS de campos (sub-paso S6 del §0.4 del plan maestro).
//
// POR QUE LA RED TIENE QUE SER UNITARIA, y esto no es una preferencia de estilo: está MEDIDO. Antes
// de escribir una línea de este sub-paso se anuló el escritor de campos entero —`schema.json` a `{}`
// pasara lo que pasara— y `test:char:run` dio **281/281 EN VERDE**. La caracterización es ciega a los
// campos por construcción: NINGÚN flow manda `schema_fields` en su multipart, y el único caso que
// llega a `GET /template_artifacts/:id/schema` fija solo `topLevelKeys`, así que el contenido de
// `fields` no lo observa nadie. Es el mismo hueco que el S2 encontró del lado del lector.

import test from "node:test";
import assert from "node:assert/strict";

import {
  copySchemaFieldsToArtifact,
  replaceSchemaFieldsForArtifact,
  schemaFieldListFromJsonSchema,
} from "./schemaFieldRows.js";

const ARTIFACT_ID = 42;

// Doble de conexión que REGISTRA cada sentencia con sus parámetros y responde a los SELECT con
// `filas`. Devuelve la forma de mysql2 que usa el adaptador (`[filas]` / `[header]`).
const buildConnection = ({ filas = [] } = {}) => {
  const calls = [];
  return {
    calls,
    query: async (sql, params = []) => {
      calls.push({ sql: sql.replace(/\s+/g, " ").trim(), params });
      if (/^SELECT field_order/i.test(sql.trim())) return [filas];
      if (/^INSERT INTO/i.test(sql.trim())) return [{ insertId: 1, affectedRows: 1 }];
      return [{ affectedRows: 1 }];
    },
  };
};

const campo = (extra = {}) => ({
  order: 1,
  dataKey: "semestre",
  fieldCode: "general.semestre",
  title: "Semestre",
  component: "text",
  group: "general",
  required: true,
  ...extra,
});

const find = (connection, pattern) => connection.calls.filter((call) => pattern.test(call.sql));

// --- El escritor: DELETE + INSERT ----------------------------------------------------------------

test("replaceSchemaFieldsForArtifact borra los campos previos antes de insertar", async () => {
  const connection = buildConnection();
  await replaceSchemaFieldsForArtifact(connection, {
    artifactId: ARTIFACT_ID,
    fields: [campo(), campo({ order: 2, dataKey: "titulo", fieldCode: "general.titulo" })],
  });

  assert.match(connection.calls[0].sql, /^DELETE FROM template_artifact_fields/);
  assert.deepEqual(connection.calls[0].params, [ARTIFACT_ID]);
  assert.equal(find(connection, /^INSERT INTO template_artifact_fields/).length, 2);
});

test("cada columna recibe el valor del campo, en el orden del INSERT", async () => {
  const connection = buildConnection();
  await replaceSchemaFieldsForArtifact(connection, {
    artifactId: ARTIFACT_ID,
    fields: [campo({ order: 3, component: "switch", group: "display", required: false })],
  });

  const [insert] = find(connection, /^INSERT INTO template_artifact_fields/);
  assert.deepEqual(insert.params, [
    ARTIFACT_ID, 3, "semestre", "general.semestre", "Semestre", "switch", "display", 0,
  ]);
});

test("la lista VACIA borra igualmente: vaciar el editor deja la edicion sin campos", async () => {
  // Es la diferencia con el flujo, que solo se toca si el formulario mandó uno. `schema.json` se
  // reescribe a `{}` en CADA guardado, así que saltarse el DELETE dejaría filas viejas
  // contradiciendo un fichero ya vaciado — la divergencia que la escritura doble existe para
  // impedir.
  const connection = buildConnection();
  await replaceSchemaFieldsForArtifact(connection, { artifactId: ARTIFACT_ID, fields: [] });

  assert.equal(connection.calls.length, 1);
  assert.match(connection.calls[0].sql, /^DELETE FROM template_artifact_fields/);
});

test("sin id de artifact no escribe nada: lanza antes de tocar la base", async () => {
  const connection = buildConnection();
  await assert.rejects(
    () => replaceSchemaFieldsForArtifact(connection, { artifactId: null, fields: [campo()] }),
    /requiere el id del template_artifact/
  );
  assert.equal(connection.calls.length, 0);
});

// --- La copia al versionar / bifurcar -------------------------------------------------------------

test("copySchemaFieldsToArtifact relee el origen y reescribe en el destino, sin tocar el origen", async () => {
  const connection = buildConnection({
    filas: [
      { field_order: 1, data_key: "semestre", field_code: "general.semestre", title: "Semestre", ui_component: "text", ui_group: "general", is_required: 1 },
      { field_order: 2, data_key: "show_firmas", field_code: "display.show_firmas", title: "Mostrar firmas", ui_component: "switch", ui_group: "display", is_required: 0 },
    ],
  });

  await copySchemaFieldsToArtifact(connection, { sourceArtifactId: 7, targetArtifactId: 99 });

  const [select] = find(connection, /^SELECT field_order/);
  assert.deepEqual(select.params, [7]);
  // El DELETE cae sobre el DESTINO. Si cayera sobre el origen, versionar vaciaría al padre.
  const [borrado] = find(connection, /^DELETE FROM template_artifact_fields/);
  assert.deepEqual(borrado.params, [99]);
  const inserts = find(connection, /^INSERT INTO template_artifact_fields/);
  assert.equal(inserts.length, 2);
  assert.deepEqual(inserts[0].params, [99, 1, "semestre", "general.semestre", "Semestre", "text", "general", 1]);
  assert.deepEqual(inserts[1].params, [99, 2, "show_firmas", "display.show_firmas", "Mostrar firmas", "switch", "display", 0]);
});

test("un padre SIN campos deja a la hija sin campos, y no da error", async () => {
  const connection = buildConnection({ filas: [] });
  const resultado = await copySchemaFieldsToArtifact(connection, { sourceArtifactId: 7, targetArtifactId: 99 });

  assert.deepEqual(resultado, { fields: 0 });
  assert.equal(find(connection, /^INSERT INTO template_artifact_fields/).length, 0);
});

test("copySchemaFieldsToArtifact exige los dos ids", async () => {
  const connection = buildConnection();
  await assert.rejects(
    () => copySchemaFieldsToArtifact(connection, { sourceArtifactId: 7 }),
    /requiere el id de origen y el de destino/
  );
  assert.equal(connection.calls.length, 0);
});

// --- El productor de seed: un `schema.json` que ya existe -----------------------------------------

test("schemaFieldListFromJsonSchema numera el orden por la posicion, no por la clave", async () => {
  const lista = schemaFieldListFromJsonSchema({
    type: "object",
    properties: {
      semestre: { type: "string", title: "Semestre", "x-deasy-field-code": "general.semestre", "x-deasy-data-key": "semestre", "x-deasy-ui": { component: "text", group: "general" } },
      titulo: { type: "string", title: "Titulo", "x-deasy-data-key": "titulo", "x-deasy-ui": { component: "richtext", group: "general" } },
    },
    required: ["semestre"],
  });

  assert.deepEqual(lista.map((c) => [c.order, c.dataKey, c.required]), [
    [1, "semestre", true],
    [2, "titulo", false],
  ]);
});

test("el token de firma del seed base llega entero, que es lo que el generador necesitara unir", () => {
  // `signatures.elaborado.token` es el `field_code` que el S8 tendrá que contrastar con
  // `signature_flow_steps.slot`. Mientras vivía dentro de un objeto en MinIO eso no era un JOIN;
  // como columna, lo es.
  const [campo] = schemaFieldListFromJsonSchema({
    properties: {
      firmaElaboradoToken: {
        type: "string",
        title: "Token elaborado",
        "x-deasy-field-code": "signatures.elaborado.token",
        "x-deasy-data-key": "firmaElaboradoToken",
        "x-deasy-ui": { component: "hidden", group: "signatures" },
      },
    },
  });

  assert.equal(campo.fieldCode, "signatures.elaborado.token");
  assert.equal(campo.component, "hidden");
  assert.equal(campo.group, "signatures");
});

test("sin `x-deasy-data-key` cae a la clave de properties, y sin field_code lo compone del grupo", () => {
  const [campo] = schemaFieldListFromJsonSchema({
    properties: { carrera: { title: "Carrera", "x-deasy-ui": { component: "text", group: "general" } } },
    required: ["carrera"],
  });

  assert.equal(campo.dataKey, "carrera");
  assert.equal(campo.fieldCode, "general.carrera");
  assert.equal(campo.required, true);
});

test("NO degrada un componente desconocido a `text`: lo deja pasar para que el CHECK lo rechace", () => {
  // Al revés que el formulario, y a propósito: un seed con un componente inventado es un error del
  // paquete y tiene que reventar el bootstrap, no colarse convertido en otra cosa.
  const [campo] = schemaFieldListFromJsonSchema({
    properties: { x: { "x-deasy-ui": { component: "inventado" } } },
  });

  assert.equal(campo.component, "inventado");
});

test("un schema sin properties da la lista vacia, no revienta", () => {
  assert.deepEqual(schemaFieldListFromJsonSchema({}), []);
  assert.deepEqual(schemaFieldListFromJsonSchema(null), []);
  assert.deepEqual(schemaFieldListFromJsonSchema({ properties: "roto" }), []);
});
