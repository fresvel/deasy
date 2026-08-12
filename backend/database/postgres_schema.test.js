// Tests unitarios del ESQUEMA. Vigilan lo que `node --check`, `check:imports` y el arranque no ven:
// el SQL es una cadena de texto hasta que alguien la ejecuta.
//
// Tres bloques:
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

// --- BLOQUE 2 -------------------------------------------------------------------------------------
//
// El sitio donde vivira el flujo autorado de una plantilla (frente 0.8, sub-paso 1). Hoy es un CAJON
// VACIO: nadie escribe la columna y nadie la lee, asi que NINGUN golden puede vigilarla y ninguna ruta
// HTTP la ejercita. Lo unico que se puede romper en silencio es el esquema mismo, y son tres piezas
// que hacen falta LAS TRES:
//
//   1. la definicion de la tabla, para bases nuevas (el reset de `test:char:run` pasa por aqui);
//   2. el `ALTER` idempotente, para las bases que YA existen — `CREATE TABLE IF NOT EXISTS` es un
//      no-op sobre una tabla creada y no anade una columna ni relaja un NOT NULL; y
//   3. el ORDEN: el ALTER va ANTES del `CREATE INDEX` de la columna nueva. Al reves el arranque
//      muere con «column "template_artifact_id" does not exist» en toda base ya desplegada — medido,
//      y es un fallo que no se ve en una base recien creada, que es justo la que usan las pruebas.
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

  test(`${tabla}: un ALTER idempotente lleva la columna y el NULL a las bases que YA existen`, () => {
    assert.match(
      SCHEMA,
      new RegExp(
        `ALTER TABLE ${tabla}\\s+ADD COLUMN IF NOT EXISTS template_artifact_id INT NULL,\\s+ALTER COLUMN process_definition_template_id DROP NOT NULL;`
      ),
      "sin el ALTER el cambio solo valdria para bases recien creadas"
    );
  });

  test(`${tabla}: la FK del portador va guardada, porque no hay ADD CONSTRAINT IF NOT EXISTS`, () => {
    const desde = SCHEMA.indexOf(`WHERE conrelid = '${tabla}'::regclass`);
    assert.ok(desde > 0, "debe existir el DO $$ que anade la FK solo si falta");
    const guarda = SCHEMA.slice(desde);
    // El filtro por conrelid no es adorno: `conname` es unico por TABLA, no por esquema.
    assert.match(
      guarda.split("END $$;")[0],
      new RegExp(
        `conname = 'fk_${tabla}_artifact'[\\s\\S]*ADD CONSTRAINT fk_${tabla}_artifact`
      )
    );
  });

  test(`${tabla}: el indice del portador se crea DESPUES del ALTER que crea la columna`, () => {
    const alter = SCHEMA.indexOf(`ALTER TABLE ${tabla}\n  ADD COLUMN IF NOT EXISTS template_artifact_id`);
    const indice = SCHEMA.indexOf(
      `CREATE INDEX IF NOT EXISTS idx_${tabla}_artifact ON ${tabla} (template_artifact_id);`
    );
    assert.ok(alter > 0, "debe existir el ALTER que anade la columna");
    assert.ok(indice > 0, "debe existir el indice del portador");
    assert.ok(
      indice > alter,
      "en una base ya creada el CREATE TABLE es un no-op: indexar antes del ALTER tumba el arranque"
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
// silencio es el esquema, y son dos piezas que hacen falta LAS DOS: la definicion (para bases nuevas,
// que es por donde pasa el reset de `test:char:run`) y el `ALTER` idempotente (para las que YA
// existen, donde `CREATE TABLE IF NOT EXISTS` es un no-op).
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
    // Nulable a proposito: los pasos que ya existen no pueden inventarse un nombre, y en este
    // sub-paso nadie escribe la columna. Un NOT NULL aqui tumbaria el ALTER en cualquier base con
    // filas — que son todas.
    assert.match(entrega, new RegExp(`^${columna} VARCHAR\\(\\d+\\) NULL,$`));
    assert.doesNotMatch(entrega, /DEFAULT/);
  });
}

test("fill_flow_steps: un ALTER idempotente lleva code y name a las bases que YA existen", () => {
  assert.match(
    SCHEMA,
    /ALTER TABLE fill_flow_steps\s+ADD COLUMN IF NOT EXISTS code VARCHAR\(120\) NULL,\s+ADD COLUMN IF NOT EXISTS name VARCHAR\(180\) NULL;/,
    "sin el ALTER las columnas solo existirian en bases recien creadas"
  );
});

test("fill_flow_steps: no se indexa code ni name — son descriptivas, no de busqueda", () => {
  // La decision, escrita para que no se cuele un indice por inercia: un paso se localiza por
  // (fill_flow_template_id, step_order), que ya tiene su indice unico, y nadie filtra por el nombre de
  // un paso. La gemela de firma tampoco los indexa: sus cinco indices son de clave ajena. Y si algun
  // dia hiciera falta uno, tendria que ir DESPUES del ALTER (la trampa del sub-paso 1); mientras no
  // exista, no hay orden que invertir.
  const indices = SCHEMA.split("\n").filter(
    (linea) => linea.startsWith("CREATE") && linea.includes("INDEX") && linea.includes("ON fill_flow_steps (")
  );
  assert.deepEqual(indices, [
    "CREATE UNIQUE INDEX IF NOT EXISTS uq_fill_flow_steps ON fill_flow_steps (fill_flow_template_id, step_order);",
  ]);
});

// --- BLOQUE 4 -------------------------------------------------------------------------------------
//
// EL RETIRO DE LOS FLUJOS QUE SEMBRO EL SYNC (frente 0.8, sub-paso 8). Es la unica DML de este
// fichero que borra alcance en vez de sembrarlo, y por eso lleva test: si alguien afloja su WHERE,
// el arranque desactiva flujos que un administrador escribio a mano, y no hay golden que lo vea
// —en una base recien creada no existe ninguna fila con marcador, asi que la sentencia es un no-op
// y la caracterizacion no la ejercita nunca—.
//
// Las cuatro condiciones del WHERE son la definicion de "lo que sembro el sync", y las cuatro hacen
// falta:
//   · `description LIKE 'artifact_sync_*:%'` — la huella del sync. Ningun otro escritor la pone.
//   · `process_definition_template_id IS NOT NULL` — cuelga del VINCULO. Es lo que tapa al flujo de
//     la plantilla en el resolvedor de runtime.
//   · `task_item_id IS NULL` — NUNCA el flujo de runtime, que lleva vinculo Y entregable.
//   · `is_active = 1` — hace la sentencia idempotente: la segunda pasada afecta a 0 filas.

const retiroDelSync = (tabla, marcador) =>
  new RegExp(
    `UPDATE ${tabla}\\s+SET is_active = 0\\s+WHERE is_active = 1\\s+`
    + `AND task_item_id IS NULL\\s+`
    + `AND process_definition_template_id IS NOT NULL\\s+`
    + `AND description LIKE '${marcador}:%';`
  );

for (const [tabla, marcador] of [
  ["fill_flow_templates", "artifact_sync_fill"],
  ["signature_flow_templates", "artifact_sync_signature"],
]) {
  test(`${tabla}: el retiro del sync desactiva SOLO lo que lleva el marcador ${marcador}`, () => {
    assert.match(SCHEMA, retiroDelSync(tabla, marcador));
  });
}

test("el retiro del sync DESACTIVA, no borra: una instancia en curso conserva su flujo", () => {
  // La razon esta medida y es doble: `document_fill_flows.fill_flow_template_id` y
  // `signature_flow_instances.template_id` referencian estas cabeceras SIN CASCADE, asi que un
  // DELETE fallaria con una entrega en curso; y borrarles los pasos le cambiaria el flujo bajo los
  // pies a esa entrega. Desactivar basta: los tres escalones del resolvedor exigen `is_active = 1`.
  const bloque = SCHEMA.slice(SCHEMA.indexOf("RETIRO DE LOS FLUJOS QUE SEMBRO EL SYNC"));
  assert.doesNotMatch(bloque, /DELETE FROM fill_flow_templates/);
  assert.doesNotMatch(bloque, /DELETE FROM fill_flow_steps/);
  assert.doesNotMatch(bloque, /DELETE FROM signature_flow_templates/);
  assert.doesNotMatch(bloque, /DELETE FROM signature_flow_steps/);
});
