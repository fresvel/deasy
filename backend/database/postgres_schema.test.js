// Tests unitarios del ESQUEMA. Vigilan lo que `node --check`, `check:imports` y el arranque no ven:
// el SQL es una cadena de texto hasta que alguien la ejecuta.
//
// Cuatro bloques:
//   0. EL CONTRATO DEL FICHERO: describe la forma, NO converge bases anteriores (`TD7-s`).
//   1. `template_artifacts.lifecycle_state` nace SIN PUBLICAR (defecto 1.13).
//   2. El portador `template_artifact_id` de las dos cabeceras de flujo (frente 0.8, sub-paso 1).
//   3. `code` y `name` en los PASOS de entrega, la simetria que le faltaba a `fill_flow_steps`
//      respecto de `signature_flow_steps` (frente 0.8, sub-paso 1-bis).
//
// --- BLOQUE 1 -------------------------------------------------------------------------------------
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

// --- BLOQUE 0 -------------------------------------------------------------------------------------
//
// EL CONTRATO DEL FICHERO (`TD7-s`, 2026-08-24, decision del dueno). `postgres_schema.sql` DESCRIBE
// la forma y nada mas: cada columna, cada CHECK y cada clave se declara UNA sola vez, dentro de su
// `CREATE TABLE`. Una base con forma vieja no se pone al dia sola — se recrea.
//
// POR QUE ES UN TEST Y NO UNA NOTA. Antes el fichero hacia los dos trabajos, y el precio fue que la
// MISMA columna quedo declarada dos veces y en CONTRADICCION: `persons.token` decia
// `VARCHAR(10) NOT NULL UNIQUE` en su tabla y `VARCHAR(10) NULL` en su ALTER. Nadie lo vio porque
// sobre una base recien creada el ALTER es un no-op y todo sale verde. Esta puerta lo caza.
//
// Los `CREATE INDEX` / `CREATE UNIQUE INDEX` NO cuentan: un indice es siempre una sentencia aparte,
// no una segunda declaracion de la columna.
const SENTENCIAS_DE_MIGRACION = [
  [/^\s*ALTER TABLE /m, "ALTER TABLE"],
  [/ADD COLUMN IF NOT EXISTS/, "ADD COLUMN IF NOT EXISTS"],
  [/^\s*ALTER COLUMN /m, "ALTER COLUMN"],
  [/^\s*DROP COLUMN IF EXISTS/m, "DROP COLUMN IF EXISTS"],
  [/^UPDATE /m, "UPDATE de relleno"],
  [/^DO \$\$/m, "bloque DO $$"],
];

// Los comentarios se juzgan aparte: un `-- ALTER TABLE ...` dentro de una nota no ejecuta nada, pero
// tampoco puede quedarse describiendo un mecanismo que ya no existe.
const SIN_COMENTARIOS = SCHEMA.split("\n")
  .filter((linea) => !linea.trim().startsWith("--"))
  .join("\n");

for (const [patron, nombre] of SENTENCIAS_DE_MIGRACION) {
  test(`el esquema no contiene ${nombre}: describe la forma, no converge una base anterior`, () => {
    assert.doesNotMatch(
      SIN_COMENTARIOS,
      patron,
      "una columna se declara UNA vez, en su CREATE TABLE. Si hace falta cambiarla, se recrea la base"
    );
  });
}

test("persons.token se declara una sola vez", () => {
  const declaraciones = SIN_COMENTARIOS.split("\n").filter((linea) =>
    /^\s*token VARCHAR\(10\)/.test(linea)
  );
  assert.equal(declaraciones.length, 1, "estuvo declarada dos veces y en contradiccion (TD7-s)");
  assert.match(declaraciones[0], /NOT NULL UNIQUE/);
});

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

// El CHECK sigue admitiendo los tres estados: bajar el default no estrecha el dominio.
test("lifecycle_state sigue admitiendo draft, published y retired", () => {
  assert.match(
    createTemplateArtifacts,
    /lifecycle_state TEXT CHECK \(lifecycle_state IN \('draft','published','retired'\)\)/
  );
});

// --- BLOQUE 2 -------------------------------------------------------------------------------------
//
// El sitio donde vivira el flujo autorado de una plantilla (frente 0.8, sub-paso 1). Hoy es un CAJON
// VACIO: nadie escribe la columna y nadie la lee, asi que NINGUN golden puede vigilarla y ninguna ruta
// HTTP la ejercita. Lo unico que se puede romper en silencio es el esquema mismo, y son dos piezas:
//
//   1. la definicion de la tabla —columna, nulabilidad y FK—, que desde `TD7-s` es la UNICA; y
//   2. el ORDEN: el `CREATE INDEX` va DESPUES de la tabla. Al reves el arranque muere con
//      «relation does not exist» (precedentes 673f1fb, 8f9f1ad, 99fc7c7, 38c2b56).
//
// Lo que aqui NO hay, a proposito, es un CHECK de "exactamente un portador": las filas de runtime
// llevan HOY `process_definition_template_id` y `task_item_id` a la vez (`generation/documents.js:248`
// y `:278`), asi que los tres portadores no son excluyentes y ese CHECK seria falso el dia uno.

const bloqueCreate = (tabla) =>
  SCHEMA.slice(SCHEMA.indexOf(`CREATE TABLE IF NOT EXISTS ${tabla} (`)).split(");")[0];

for (const tabla of ["fill_flow_templates", "signature_flow_templates"]) {
  const create = bloqueCreate(tabla);

  test(`${tabla}: la definicion declara template_artifact_id nulable`, () => {
    const columna = create.split("\n").find((linea) => linea.trim().startsWith("template_artifact_id"));
    assert.ok(columna, "la columna debe existir en la definicion de la tabla");
    assert.match(columna, /template_artifact_id INT NULL,/);
  });

  test(`${tabla}: la FK del portador apunta a template_artifacts(id)`, () => {
    assert.match(
      create,
      new RegExp(
        `CONSTRAINT fk_${tabla}_artifact FOREIGN KEY \\(template_artifact_id\\) REFERENCES template_artifacts\\(id\\)`
      )
    );
  });

  test(`${tabla}: process_definition_template_id ya no es NOT NULL en la definicion`, () => {
    const columna = create
      .split("\n")
      .find((linea) => linea.trim().startsWith("process_definition_template_id"));
    assert.ok(columna, "la columna del portador por vinculo debe seguir existiendo");
    assert.match(columna, /process_definition_template_id INT NULL,/);
    assert.doesNotMatch(
      columna,
      /NOT NULL/,
      "el vinculo deja de ser obligatorio: una cabecera puede colgar del entregable"
    );
  });

  test(`${tabla}: el indice del portador se crea DESPUES de la tabla que lo sostiene`, () => {
    const tablaPos = SCHEMA.indexOf(`CREATE TABLE IF NOT EXISTS ${tabla} (`);
    const indice = SCHEMA.indexOf(
      `CREATE INDEX IF NOT EXISTS idx_${tabla}_artifact ON ${tabla} (template_artifact_id);`
    );
    assert.ok(tablaPos > 0, "debe existir la definicion de la tabla");
    assert.ok(indice > 0, "debe existir el indice del portador");
    assert.ok(
      indice > tablaPos,
      "un indice es una sentencia aparte: colocarlo antes de su tabla tumba el arranque"
    );
  });
}

// --- BLOQUE 3 -------------------------------------------------------------------------------------
//
// La SIMETRIA de los pasos (frente 0.8, sub-paso 1-bis). `fill_flow_steps` y `signature_flow_steps`
// son dos tablas espejo del mismo concepto —un paso de un flujo autorado— y la de entrega habia
// perdido dos columnas por el camino: `code` y `name`. El formulario deja escribir el nombre de cada
// paso de entrega (`AdminDraftArtifactModal.vue:327`), `buildWorkflowsYaml` lo emite
// (`workflows.js:167-168`) y el editor lo lee de vuelta (`templateArtifact.js:135-136`) — pero HOY ese
// texto solo vive dentro del `meta.yaml` de MinIO. Invertir la direccion del flujo sin estas columnas
// perderia el nombre de todos los pasos de entrega; eso es lo que destapo el primer intento del
// sub-paso 3.
//
// Igual que el bloque 2, aqui es un CAJON VACIO: nadie las escribe y nadie las lee todavia, asi que
// ningun golden puede vigilarlas y ninguna ruta HTTP las ejercita. Lo unico que se puede romper en
// silencio es el esquema, y desde `TD7-s` la pieza es UNA: la definicion de la tabla. La base se
// recrea (`test:char:run` ya lo hace en cada corrida), asi que no hay una segunda forma que mantener.
//
// El tipo NO es libre: se copia el de la gemela de firma (`code VARCHAR(120)`, `name VARCHAR(180)`).
// Si alguien las declara mas cortas, el mismo paso cabria en un lado y no en el otro.

const createFillSteps = SCHEMA.slice(SCHEMA.indexOf("CREATE TABLE IF NOT EXISTS fill_flow_steps (")).split(");")[0];
const createSignatureSteps = SCHEMA.slice(
  SCHEMA.indexOf("CREATE TABLE IF NOT EXISTS signature_flow_steps (")
).split(");")[0];

const declaracion = (create, columna) =>
  (create.split("\n").find((linea) => linea.trim().startsWith(`${columna} `)) || "").trim();

for (const columna of ["code", "name"]) {
  test(`fill_flow_steps: la definicion declara ${columna} con el MISMO tipo que signature_flow_steps`, () => {
    const entrega = declaracion(createFillSteps, columna);
    const firma = declaracion(createSignatureSteps, columna);
    assert.ok(firma, `la gemela de firma debe seguir declarando ${columna}`);
    assert.ok(entrega, `fill_flow_steps debe declarar ${columna}`);
    assert.equal(entrega, firma, "mismo concepto, mismo tipo: dos tablas espejo");
  });

  test(`fill_flow_steps: ${columna} nace NULL, sin DEFAULT`, () => {
    const entrega = declaracion(createFillSteps, columna);
    // Nulable a proposito: en este sub-paso nadie escribe la columna todavia, y su gemela de firma
    // tambien la declara NULL. Mismo concepto, misma nulabilidad.
    assert.match(entrega, new RegExp(`^${columna} VARCHAR\\(\\d+\\) NULL,$`));
    assert.doesNotMatch(entrega, /DEFAULT/);
  });
}

test("fill_flow_steps: no se indexa code ni name — son descriptivas, no de busqueda", () => {
  // La decision, escrita para que no se cuele un indice por inercia: un paso se localiza por
  // (fill_flow_template_id, step_order), que ya tiene su indice unico, y nadie filtra por el nombre de
  // un paso. La gemela de firma tampoco los indexa: sus cinco indices son de clave ajena.
  const indices = SCHEMA.split("\n").filter(
    (linea) => linea.startsWith("CREATE") && linea.includes("INDEX") && linea.includes("ON fill_flow_steps (")
  );
  assert.deepEqual(indices, [
    "CREATE UNIQUE INDEX IF NOT EXISTS uq_fill_flow_steps ON fill_flow_steps (fill_flow_template_id, step_order);",
  ]);
});

// --- BLOQUE 4: `template_artifact_fields`, los campos del formulario (frente 0.4, sub-paso S6) ----
//
// El SQL es una cadena de texto hasta que alguien la ejecuta, y ninguna de estas propiedades tiene
// disparador vivo hoy: el escritor las respeta por construccion (normaliza antes de insertar) y la
// caracterizacion no manda `schema_fields` en ningun flow — medido: con el escritor de campos
// anulado del todo, `test:char:run` da 281/281 en verde. O sea que si alguien afloja el esquema, no
// se entera nadie.

const createFields = SCHEMA.slice(
  SCHEMA.indexOf("CREATE TABLE IF NOT EXISTS template_artifact_fields")
).split(");")[0];

test("el portador de un campo es el template_artifact, y es obligatorio", () => {
  const columna = createFields.split("\n").find((l) => l.trim().startsWith("template_artifact_id"));
  assert.ok(columna, "template_artifact_id debe existir en la definicion");
  assert.match(columna, /NOT NULL/);
});

test("el CHECK de ui_component lista los NUEVE componentes que autora la web, y ninguno mas", () => {
  // Es la razon de fondo por la que se descarto la columna `schema_json JSONB`: un CHECK no cubre un
  // JSONB (medido en el §0.6), asi que dentro de un JSONB estos nueve serian para siempre una
  // promesa del `Set` `SCHEMA_FIELD_COMPONENTS` de JavaScript. Esta lista queda alineada con ese
  // `Set` (`templateLifecycle.js`): si uno cambia, el otro cambia en el mismo commit.
  const componentes = createFields.match(/ui_component IN \(([^)]+)\)/);
  assert.ok(componentes, "ui_component debe llevar su CHECK");
  const listados = componentes[1].split(",").map((v) => v.trim().replace(/'/g, ""));
  assert.deepEqual(listados, [
    "text", "richtext", "textarea", "number", "switch", "date", "date_expression", "select", "hidden",
  ]);
});

test("`field_order` es columna, que es lo que hace que el orden autorado exista", () => {
  // El fichero `schema.json` no puede llevarlo: su orden es el de las claves de un objeto JS, y JS
  // itera primero las claves de indice de array ordenandolas numericamente. Medido: la entrada
  // `anio_lectivo, 2025, responsable, 10` sale como `10, 2025, anio_lectivo, responsable`.
  const columna = createFields.split("\n").find((l) => l.trim().startsWith("field_order"));
  assert.ok(columna, "field_order debe existir");
  assert.match(columna, /INT NOT NULL/);
});

test("`field_code` es columna, que es lo que permitira unirlo con signature_flow_steps.slot", () => {
  const columna = createFields.split("\n").find((l) => l.trim().startsWith("field_code"));
  assert.ok(columna, "field_code debe existir");
  assert.match(columna, /NOT NULL/);
});

test("no se guarda el `type` de JSON Schema: es funcion pura del componente", () => {
  // Guardarlo seria una segunda copia que reconciliar. Se deriva al leer (`jsonTypeForComponent`).
  assert.doesNotMatch(createFields, /^\s*json_type/m);
});

test("el unico por (artifact, data_key) hace estructural el descarte del slug repetido", () => {
  assert.match(
    SCHEMA,
    /CREATE UNIQUE INDEX IF NOT EXISTS uq_template_artifact_fields_key ON template_artifact_fields \(template_artifact_id, data_key\);/
  );
});

test("borrar una edicion se lleva sus campos: la FK va con ON DELETE CASCADE", () => {
  // La asimetria con las cabeceras de flujo es del MODELO, no un descuido: una cabecera tiene TRES
  // portadores posibles y quedarse huerfana es un error que hay que ver; un campo tiene uno y no
  // significa nada sin su edicion. Ademas conserva el comportamiento de
  // `DELETE /admin/sql/template_artifacts`, que con NO ACTION pasaria a responder 409 en una
  // plantilla `routed` con campos y sin flujo. Verificado en psql antes de escribirlo.
  assert.match(
    createFields,
    /CONSTRAINT fk_template_artifact_fields_artifact FOREIGN KEY \(template_artifact_id\) REFERENCES template_artifacts\(id\) ON DELETE CASCADE/
  );
});

test("el CREATE INDEX de la tabla nueva va DESPUES de su CREATE TABLE", () => {
  // Precedentes `673f1fb`, `8f9f1ad`, `99fc7c7`: este fichero se reaplica en CADA arranque, y un
  // indice colocado antes de existir su columna mata el arranque en bucle.
  assert.ok(
    SCHEMA.indexOf("CREATE TABLE IF NOT EXISTS template_artifact_fields")
      < SCHEMA.indexOf("CREATE INDEX IF NOT EXISTS idx_template_artifact_fields_order")
  );
});

test("la tabla se declara DESPUES de template_artifacts, a la que referencia", () => {
  assert.ok(
    SCHEMA.indexOf("CREATE TABLE IF NOT EXISTS template_artifacts")
      < SCHEMA.indexOf("CREATE TABLE IF NOT EXISTS template_artifact_fields")
  );
});
