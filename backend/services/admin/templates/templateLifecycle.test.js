// Tests unitarios de `finishTemplateUpdate` — el paso 2 del update guiado.
//
// Lo que fijan (defecto 1.12): activar una configuración PUBLICA sus plantillas en borrador. Eso ya
// lo hacía el camino del CRUD (`tableHooks.js:605`) y NO lo hacía el update guiado, que publicaba
// solo la plantilla que versionaba y pasaba al gate. El char lo congela extremo a extremo; aquí se
// fija el ORDEN de las operaciones dentro de la transacción, que es la parte frágil:
//
//   1. retirar hermanas publicadas de la plantilla versionada
//   2. publicarla (deja is_active = 1)          <- el gate de artefactos ACTIVOS depende de esto
//   3. publicar el RESTO de borradores de la config
//   4. el gate
//   5. retirar la config activa anterior y activar esta
//
// El paso 3 va DESPUÉS del 2 a propósito: `publishDraftTemplatesForDefinition` filtra por
// `lifecycle_state = 'draft'` y no toca `is_active`, así que si se adelantara publicaría la
// plantilla versionada sin dejarla activa y el gate del paso 4 la rechazaría.

import test from "node:test";
import assert from "node:assert/strict";

import path from "node:path";

import TemplateLifecycleService, {
  PACKAGE_DATA_FILE_NAME,
  buildPackageDataFileTargets,
  buildSchemaJsonFromFieldList,
  esClaveDeFichero,
  normalizeSchemaFieldList,
} from "./templateLifecycle.js";
import { CONTRACT_FORMAT } from "../kernel/constants.js";

const TPL_ID = 10;
const CFG_ID = 20;
const COLADO_ID = 99;

// Construye el servicio con un doble de pool/conexión que REGISTRA lo que ocurre, en orden.
// `draftRows` son los borradores que quedan enlazados a la config (sin contar la que se versiona).
// `fallaElConteo` simula que la base revienta al contar los pasos: es el modo de fallo que el
// sub-paso 4 del §0.8 vino a arreglar. Con la lectura vieja (MinIO + `catch {}`) esto se traducía en
// "0 pasos" y bloqueaba la publicación por una razón falsa; contra la base tiene que PROPAGARSE.
// `true` revienta siempre; un id revienta solo al contar ESE artifact.
const buildService = ({ draftRows = [], fillSteps = 1, fallaElConteo = false } = {}) => {
  const events = [];

  // El gate cuenta con `SELECT EXISTS(...) AS has_steps` y pasa el id del artifact dos veces.
  // La plantilla versionada (TPL_ID) siempre trae su paso: su readiness se comprueba antes de la
  // transacción y no es lo que estos casos ejercitan. `fillSteps` describe SOLO al borrador colado.
  const respondeAlConteo = (params) => {
    events.push(`cuenta-pasos:${params?.[0]}`);
    if (fallaElConteo === true || Number(fallaElConteo) === Number(params?.[0])) {
      throw new Error("no se pudo contar los pasos: la base no responde");
    }
    const hay = Number(params?.[0]) === TPL_ID ? 1 : (fillSteps ? 1 : 0);
    return [[{ has_steps: hay }]];
  };

  const connection = {
    beginTransaction: async () => { events.push("begin"); },
    commit: async () => { events.push("commit"); },
    rollback: async () => { events.push("rollback"); },
    release: () => { events.push("release"); },
    query: async (sql, params) => {
      if (sql.includes("AS has_steps")) {
        return respondeAlConteo(params);
      }
      if (sql.includes("ta.lifecycle_state = 'draft'")) {
        events.push("select:borradores-de-la-config");
        return [draftRows];
      }
      if (sql.includes("lifecycle_state = 'published', is_active = 1")) {
        events.push(`publica-y-activa:${params[0]}`);
        return [{}];
      }
      if (sql.includes("SET lifecycle_state = 'published'")) {
        events.push(`publica:${params[0]}`);
        return [{}];
      }
      if (sql.includes("SET status = 'active'")) {
        events.push(`activa-config:${params[0]}`);
        return [{}];
      }
      events.push(`sql-no-esperado:${sql}`);
      return [[]];
    },
  };

  const pool = {
    getConnection: async () => connection,
    query: async (sql, params) => {
      if (sql.includes("AS has_steps")) {
        return respondeAlConteo(params);
      }
      if (sql.includes("FROM process_definition_versions")) {
        return [[{ id: CFG_ID, process_id: 1, variation_key: "general", definition_version: "1.1.0", status: "draft" }]];
      }
      if (sql.includes("FROM process_definition_templates")) {
        return [[{ id: 500, item_mode: "single" }]];
      }
      return [[]];
    },
  };

  const service = new TemplateLifecycleService(pool, {
    getByKeys: async () => ({ id: TPL_ID, lifecycle_state: "draft", storage_version: "1.1.0" }),
    retirePriorPublishedSiblings: async (_conn, id) => { events.push(`retira-hermanas:${id}`); },
    retireActiveDefinitionsInSeries: async () => { events.push("retira-config-anterior"); return 1; },
    ensureDefinitionHasActiveRulesForActivation: async () => { events.push("gate:reglas"); },
    ensureDefinitionHasActivePeriodTypesForActivation: async () => { events.push("gate:periodos"); },
    ensureDefinitionHasArtifactsForActivation: async () => { events.push("gate:entregables"); },
  });

  return { service, events };
};

const finish = (service) =>
  service.finishTemplateUpdate({ templateArtifactId: TPL_ID, configDefinitionId: CFG_ID });

// El camino que ya funcionaba: si la config no tiene más borradores, la secuencia no cambia.
test("sin mas borradores en la config, finish publica la plantilla y activa la config", async () => {
  const { service, events } = buildService();
  const result = await finish(service);

  assert.equal(result.template_lifecycle_state, "published");
  assert.equal(result.config_status, "active");
  assert.deepEqual(events, [
    // El readiness se cuenta sobre la base y FUERA de la transacción, igual que cuando lo leía de
    // MinIO: rechazar no debe costar un BEGIN/ROLLBACK.
    `cuenta-pasos:${TPL_ID}`,
    "begin",
    "gate:reglas",
    "gate:periodos",
    `retira-hermanas:${TPL_ID}`,
    `publica-y-activa:${TPL_ID}`,
    "select:borradores-de-la-config",
    "gate:entregables",
    "retira-config-anterior",
    `activa-config:${CFG_ID}`,
    "commit",
    "release",
  ]);
});

// El defecto 1.12: el borrador colado se publica ANTES del gate, no se queda dentro de una config
// que acaba de quedar activa.
test("un borrador colado en la config se publica antes del gate (1.12)", async () => {
  const { service, events } = buildService({
    draftRows: [{ id: COLADO_ID, item_mode: "single", deliverable_name: "Informe de evento" }],
  });
  await finish(service);

  const publicado = events.indexOf(`publica:${COLADO_ID}`);
  const gate = events.indexOf("gate:entregables");
  assert.notEqual(publicado, -1, "el borrador colado debe publicarse");
  assert.ok(publicado < gate, "debe publicarse ANTES del gate de entregables");
  assert.ok(events.indexOf(`publica-y-activa:${TPL_ID}`) < publicado,
    "la plantilla versionada se publica PRIMERO: el gate de activos depende de su is_active");
  assert.ok(events.includes(`retira-hermanas:${COLADO_ID}`),
    "publicar el colado retira las publicadas previas de su mismo entregable");
});

// `publishDraftTemplatesForDefinition` filtra por `lifecycle_state = 'draft'`, así que la plantilla
// versionada —ya publicada en el paso anterior— no vuelve a pasar por ahí.
test("la plantilla ya publicada no se re-publica en la segunda pasada", async () => {
  const { service, events } = buildService({
    draftRows: [{ id: COLADO_ID, item_mode: "single", deliverable_name: "Informe de evento" }],
  });
  await finish(service);

  assert.equal(events.filter((e) => e === `publica-y-activa:${TPL_ID}`).length, 1);
  assert.ok(!events.includes(`publica:${TPL_ID}`), "no debe publicarse dos veces por dos vias distintas");
});

// `routed` no autora flujo (se define al enviar), así que se publica sin exigirle paso de entrega.
test("un borrador colado en modo routed se publica sin exigirle flujo de entrega", async () => {
  const { service, events } = buildService({
    draftRows: [{ id: COLADO_ID, item_mode: "routed", deliverable_name: "Tarea ad-hoc" }],
    fillSteps: 0,
  });
  await finish(service);
  assert.ok(events.includes(`publica:${COLADO_ID}`));
  assert.ok(!events.includes(`cuenta-pasos:${COLADO_ID}`),
    "a un routed ni siquiera se le cuenta: la excepción se decide ANTES de tocar la base");
});

// --- El modo de fallo que motiva el sub-paso 4 del §0.8 -----------------------------------------
//
// Los cuatro gates contaban los pasos leyendo el `meta.yaml` de MinIO dentro de un `catch {}` mudo,
// así que MinIO caído u objeto ausente valían "0 pasos" y bloqueaban la publicación con un mensaje
// que mentía sobre la causa. Contra la base ese modo de fallo no puede volver: el error SUBE.

test("si la base falla al contar los pasos, el error SUBE en vez de valer cero (finish)", async () => {
  const { service, events } = buildService({ fallaElConteo: true });

  await assert.rejects(finish(service), /la base no responde/);
  assert.ok(!events.includes("begin"), "ni siquiera se abre la transaccion");
  assert.ok(!events.some((e) => e.startsWith("publica")), "no se publica nada");
});

test("si la base falla al contar los pasos de un colado, la activacion hace rollback", async () => {
  const { service, events } = buildService({
    draftRows: [{ id: COLADO_ID, item_mode: "single", deliverable_name: "Informe de evento" }],
    fallaElConteo: COLADO_ID,
  });

  await assert.rejects(finish(service), /la base no responde/);
  assert.ok(events.includes("rollback"), "debe deshacerse la transaccion");
  assert.ok(!events.includes("commit"));
  assert.ok(!events.includes(`activa-config:${CFG_ID}`), "la config NO debe quedar activa");
});

// Atomicidad: publicar el resto ocurre DENTRO de la transacción, así que un borrador que no está
// listo aborta la activación entera en vez de dejar la config activa a medias.
test("un borrador colado sin paso de entrega aborta la activacion y hace rollback", async () => {
  const { service, events } = buildService({
    draftRows: [{ id: COLADO_ID, item_mode: "single", deliverable_name: "Informe de evento" }],
    fillSteps: 0,
  });

  await assert.rejects(finish(service), /debe definir al menos un paso de flujo de entrega/);
  assert.ok(events.includes("rollback"), "debe deshacerse la transaccion");
  assert.ok(!events.includes("commit"), "no debe confirmarse nada");
  assert.ok(!events.includes(`activa-config:${CFG_ID}`), "la config NO debe quedar activa");
});

// --- La transacción del borrador (sub-paso 3 del §0.8) ------------------------------------------
//
// `saveTemplateArtifactDraft` no tenía transacción: compensaba a mano con una pila de deshacer. El
// flujo autorado NO se podía escribir así —cuelga del artifact por FK—, y el sub-paso 3 abrió una de
// verdad alrededor de los tres efectos de base. Estos tests fijan lo único que importa de ella: que
// un fallo a mitad NO deja nada escrito, y que la escritura del flujo va DENTRO.
//
// El resto de `saveTemplateArtifactDraft` (MinIO, staging en disco, formatos) queda fuera a
// propósito: es lo que el characterization ya recorre extremo a extremo.

const DRAFT_ARTIFACT_ID = 77;

const buildDraftService = ({ falla = null } = {}) => {
  const events = [];

  const connection = {
    beginTransaction: async () => { events.push("begin"); },
    commit: async () => { events.push("commit"); },
    rollback: async () => { events.push("rollback"); },
    release: () => { events.push("release"); },
    query: async (sql) => {
      const texto = String(sql).replace(/\s+/g, " ").trim();
      if (/^SELECT process_id/i.test(texto)) return [[{ process_id: 1, variation_key: "general" }]];
      if (/^SELECT id FROM deliverables/i.test(texto)) return [[]];
      if (/^INSERT INTO deliverables/i.test(texto)) { events.push("insert:deliverable"); return [{ insertId: 5 }]; }
      if (/^INSERT INTO template_artifacts/i.test(texto)) { events.push("insert:artifact"); return [{ insertId: DRAFT_ARTIFACT_ID }]; }
      if (/^UPDATE template_artifacts/i.test(texto)) { events.push("update:artifact"); return [{}]; }
      if (/^UPDATE deliverables/i.test(texto)) { events.push("update:deliverable"); return [{}]; }
      if (/^SELECT id FROM process_definition_templates/i.test(texto)) return [[]];
      if (/^INSERT INTO process_definition_templates/i.test(texto)) { events.push("insert:vinculo"); return [{ insertId: 9 }]; }
      if (/flow_templates/i.test(texto) || /flow_steps/i.test(texto)) { events.push("escribe:flujo"); return [[]]; }
      return [[]];
    },
  };

  const pool = { getConnection: async () => connection, query: async () => [[]] };

  const service = new TemplateLifecycleService(pool, {
    // El vínculo resuelve el proceso destino con `getByKeys`; devolver null es el camino real del
    // error "El proceso destino seleccionado no existe.", que es donde se rompía la compensación.
    getByKeys: async () => (falla === "vinculo" ? null : { id: 1 }),
    getCargoCodeMap: async () => new Map(),
    getUnitTypeNameMap: async () => new Map(),
  });

  if (falla === "flujo") {
    service._persistAuthoredFlow = async () => { throw new Error("fallo al escribir el flujo"); };
  }

  return { service, events };
};

const persistir = (service, extra = {}) =>
  service._persistDraftToDatabase({
    isEdit: false,
    almacenamiento: { storageVersion: "1.0.0", availableFormats: {} },
    identidad: { templateCode: "draft_x", displayName: "Borrador X" },
    processDefinitionId: 1,
    itemMode: "single",
    workflowsDocument: { workflows: { fill: { required: true, sync_mode: "artifact_to_db", steps: [{ order: 1 }] }, signatures: { steps: [] } } },
    ...extra,
  });

test("el borrador se persiste dentro de UNA transaccion, con el flujo incluido", async () => {
  const { service, events } = buildDraftService();
  const artifactId = await persistir(service);

  assert.equal(artifactId, DRAFT_ARTIFACT_ID);
  // Las cinco sentencias de flujo son: buscar la cabecera de entrega, crearla, borrar sus pasos,
  // insertar el paso, y buscar la de firma (que no llega a crearse porque el flujo no trae firmas).
  assert.deepEqual(events, [
    "begin",
    "insert:deliverable",
    "insert:artifact",
    "insert:vinculo",
    ...Array(5).fill("escribe:flujo"),
    "commit",
    "release",
  ]);
});

test("si falla el VINCULO, la transaccion se deshace y no se escribe el flujo", async () => {
  const { service, events } = buildDraftService({ falla: "vinculo" });

  await assert.rejects(persistir(service), /El proceso destino seleccionado no existe/);
  assert.ok(events.includes("rollback"), "debe deshacerse la transaccion");
  assert.ok(!events.includes("commit"), "no debe confirmarse nada");
  assert.ok(!events.includes("escribe:flujo"), "el flujo no llega a escribirse");
  assert.equal(events.at(-1), "release", "la conexion vuelve al pool pase lo que pase");
});

test("si falla al escribir el FLUJO, el artifact y el vinculo tampoco quedan escritos", async () => {
  // Esto es lo que la compensación manual no podía dar: el flujo cuelga del artifact por FK, así que
  // o se escriben los dos o ninguno.
  const { service, events } = buildDraftService({ falla: "flujo" });

  await assert.rejects(persistir(service), /fallo al escribir el flujo/);
  assert.ok(events.includes("insert:artifact"), "el INSERT llegó a ejecutarse...");
  assert.ok(events.includes("rollback"), "...y es el ROLLBACK quien lo deshace");
  assert.ok(!events.includes("commit"));
});

// Efecto lateral bueno de la transacción, y no era el objetivo: la pila de deshacer NO apilaba en
// EDICIÓN, así que una edición que fallaba al vincular dejaba aplicado el UPDATE de
// `template_artifacts`. Ahora también se deshace.
test("una EDICION que falla al vincular tambien se deshace (antes no)", async () => {
  const { service, events } = buildDraftService({ falla: "vinculo" });

  await assert.rejects(
    persistir(service, { isEdit: true, existingArtifact: { id: DRAFT_ARTIFACT_ID, deliverable_id: 5 } }),
    /El proceso destino seleccionado no existe/,
  );
  assert.ok(events.includes("update:artifact"), "el UPDATE llegó a ejecutarse...");
  assert.ok(events.includes("rollback"), "...y ahora se deshace");
});

test("sin flujo autorado la transaccion sigue siendo la misma, sin escribir flujo", async () => {
  const { service, events } = buildDraftService();
  await persistir(service, { workflowsDocument: null });

  assert.ok(!events.includes("escribe:flujo"));
  assert.ok(events.includes("commit"));
});

// --- El payload de datos del paquete (S1) --------------------------------------------------------
//
// `buildPackageDataFileTargets` existe como costura verificable porque el defecto que arregla es
// INVISIBLE desde el backend: el paquete quedaba bien en MinIO y el error solo aparecia al
// renderizar el ZIP en la maquina del usuario.
//
// Medido en la pila A antes del arreglo, con una plantilla creada por la web:
//   - la raiz del ZIP traia `Contenido main.tex.j2 make.sh Preambulo Referencias`, sin fichero de datos
//   - `bash make.sh` -> rc=1, «Fallo al renderizar ./Contenido/Referencias.tex.j2:
//     'bibliography_style' is undefined» (StrictUndefined), sin PDF.
//
// La causa es que `GET /template_artifacts/:id/source` zipea SOLO el prefijo del contrato jinja2, con
// las rutas relativas a el; y `make.sh` busca el fichero de datos relativo a su propio directorio,
// que en el ZIP es la raiz. De ahi que las dos copias no sean redundantes: la de la raiz del paquete
// es la que consume el backend, la del contrato es la UNICA que viaja al usuario.

test("el payload del paquete se escribe en DOS sitios, no en uno", () => {
  const targets = buildPackageDataFileTargets("/tmp/draft");
  assert.equal(targets.length, 2, "una sola copia es justo el defecto que esto arregla");
  assert.deepEqual(
    targets.map((target) => path.basename(target)),
    [PACKAGE_DATA_FILE_NAME, PACKAGE_DATA_FILE_NAME],
    "las dos copias se llaman igual: make.sh busca por nombre",
  );
});

test("la primera copia es la raiz del paquete (la que lee el backend)", () => {
  const [raiz] = buildPackageDataFileTargets("/tmp/draft");
  assert.equal(raiz, path.join("/tmp/draft", PACKAGE_DATA_FILE_NAME));
});

test("la segunda copia cae DENTRO del contrato jinja2, que es lo unico que se zipea", () => {
  const [, enElContrato] = buildPackageDataFileTargets("/tmp/draft");
  const dirDelContrato = path.join("/tmp/draft", "template", CONTRACT_FORMAT);

  assert.equal(enElContrato, path.join(dirDelContrato, PACKAGE_DATA_FILE_NAME));
  // Y en la RAIZ de ese prefijo, no en un subdirectorio: `make.sh` viaja a la raiz del ZIP y busca
  // el fichero de datos a su lado. Un nivel mas abajo y no lo encuentra.
  assert.equal(path.dirname(enElContrato), dirDelContrato);
});

test("las dos copias son rutas distintas (si colapsaran, el ZIP volveria a salir sin datos)", () => {
  const [raiz, enElContrato] = buildPackageDataFileTargets("/tmp/draft");
  assert.notEqual(raiz, enElContrato);
});

// --- Los CAMPOS del formulario: la lista y el fichero (sub-paso S6 del §0.4) ----------------------
//
// `normalizeSchemaFieldList` + `buildSchemaJsonFromFieldList` son las dos mitades en que se partió
// `buildSchemaJsonFromFields`. El corte es el que hace posible la escritura doble: la lista alimenta
// A LA VEZ el `schema.json` de MinIO y las filas de `template_artifact_fields`, saliendo del MISMO
// objeto en memoria (misma receta que el sub-paso 3 del §0.8 con `buildWorkflowsDocument`).
//
// Y el contrato del sub-paso es que el FICHERO NO SE MUEVA: `schema.json` entra en el `content_hash`
// del paquete, que está fijado en el golden `artifact_draft`. Los tests de abajo lo fijan aquí
// también, porque char no manda `schema_fields` en ningún flow y no vería el cambio.

const CAMPOS_WEB = [
  { key: "semestre", title: "Semestre", component: "text", group: "general", required: true },
  { key: "Mostrar firmas", title: "Mostrar firmas", component: "switch", group: "display" },
  { key: "cuantos", title: "Cuantos", component: "number", group: "general" },
  { key: "inventado", title: "Inventado", component: "no_existe", group: "general" },
];

test("la lista conserva el orden del formulario y numera 1..N", () => {
  const lista = normalizeSchemaFieldList(CAMPOS_WEB);
  assert.deepEqual(lista.map((c) => [c.order, c.dataKey]), [
    [1, "semestre"], [2, "mostrar_firmas"], [3, "cuantos"], [4, "inventado"],
  ]);
});

test("EL ORDEN AUTORADO SOLO SOBREVIVE EN LA LISTA: el objeto lo pierde con una clave entera", () => {
  // El hallazgo que justifica la columna `field_order`, medido con un experimento desechable antes
  // de escribir el cambio: el slug de `slugifyFieldKey` deja pasar los enteros, y JS itera primero
  // las claves de índice de array ORDENÁNDOLAS numéricamente. O sea que la corrupción no ocurre al
  // releer el fichero, ocurre al ESCRIBIRLO.
  const entrada = [
    { key: "anio_lectivo", title: "Anio" },
    { key: "2025", title: "Periodo" },
    { key: "responsable", title: "Responsable" },
    { key: "10", title: "Decimo" },
  ];
  const lista = normalizeSchemaFieldList(entrada);
  assert.deepEqual(lista.map((c) => c.dataKey), ["anio_lectivo", "2025", "responsable", "10"]);

  const json = buildSchemaJsonFromFieldList(lista);
  assert.deepEqual(Object.keys(json.properties), ["10", "2025", "anio_lectivo", "responsable"]);
});

test("el slug repetido se descarta en silencio, como siempre (y el unico de la base lo respalda)", () => {
  const lista = normalizeSchemaFieldList([
    { key: "titulo", title: "Titulo" },
    { key: "Titulo", title: "Otro titulo" },
  ]);
  assert.equal(lista.length, 1);
  assert.equal(lista[0].title, "Titulo");
});

test("el componente desconocido cae a `text` y el `type` se deriva del componente", () => {
  const lista = normalizeSchemaFieldList(CAMPOS_WEB);
  assert.equal(lista[3].component, "text");

  const json = buildSchemaJsonFromFieldList(lista);
  assert.equal(json.properties.semestre.type, "string");
  assert.equal(json.properties.mostrar_firmas.type, "boolean");
  assert.equal(json.properties.cuantos.type, "number");
});

test("el JSON Schema sale EXACTAMENTE con la forma de siempre (el content_hash no se mueve)", () => {
  const json = buildSchemaJsonFromFieldList(normalizeSchemaFieldList([CAMPOS_WEB[0]]));
  assert.deepEqual(json, {
    type: "object",
    properties: {
      semestre: {
        type: "string",
        title: "Semestre",
        "x-deasy-field-code": "general.semestre",
        "x-deasy-data-key": "semestre",
        "x-deasy-ui": { component: "text", group: "general" },
      },
    },
    required: ["semestre"],
    additionalProperties: true,
  });
});

test("`required` sale en el orden del formulario, no en el de las claves del objeto", () => {
  const json = buildSchemaJsonFromFieldList(normalizeSchemaFieldList([
    { key: "zeta", title: "Z", required: true },
    { key: "alfa", title: "A", required: true },
    { key: "beta", title: "B" },
  ]));
  assert.deepEqual(json.required, ["zeta", "alfa"]);
});

test("`field_code` se compone del grupo cuando el formulario no lo manda", () => {
  const [campo] = normalizeSchemaFieldList([{ key: "token", title: "Token", group: "signatures" }]);
  assert.equal(campo.fieldCode, "signatures.token");
});

test("una entrada que no es lista da lista vacia (y el escritor deja `{}` en el paquete)", () => {
  assert.deepEqual(normalizeSchemaFieldList(null), []);
  assert.deepEqual(normalizeSchemaFieldList("roto"), []);
  assert.deepEqual(normalizeSchemaFieldList([]), []);
});


// --- `entry_object_key`: prefijo o fichero (defecto 1.18) ------------------------------------
//
// `setAvailableFormatEntry` escribe SIEMPRE un prefijo terminado en `/`, pero pueden existir filas
// antiguas que apunten a un fichero. Quien lo consume tiene que preguntar de cuál se trata, y esa
// pregunta vivía DUPLICADA en dos sitios y FALTABA en un tercero: la rama de subida hacía
// `path.basename()` a pelo. El basename de `".../template/pdf/"` es `"pdf"`, así que al editar el
// PDF se guardaba como `template/pdf/pdf`, sin extensión.
//
// Lo que hace peligroso este fallo no es el nombre feo: **el nombre del fichero entra en
// `hashDirectory`**, así que el golden `editar_ok` de `zzz_artifact_draft` llevaba congelado el
// nombre roto — y ahí se ve el arreglo.

test("una clave que apunta a un FICHERO se reconoce como tal", () => {
  assert.equal(esClaveDeFichero("System/tpl/1.0.0/template/pdf/referencia.pdf"), true);
  assert.equal(esClaveDeFichero("Seeds/latex/informe/src/main.tex.j2"), true);
  assert.equal(esClaveDeFichero("a/b/documento.DOCX"), true, "la extensión puede venir en mayúsculas");
});

test("un PREFIJO no se confunde con un fichero", () => {
  // El caso del defecto: `path.basename` de esto devuelve "pdf".
  assert.equal(esClaveDeFichero("System/draft_x/1.0.0/template/pdf/"), false);
  assert.equal(esClaveDeFichero("System/draft_x/1.0.0/template/jinja2/"), false);
});

test("una clave vacía o ausente tampoco es un fichero", () => {
  for (const vacio of [undefined, null, "", "   "]) {
    assert.equal(esClaveDeFichero(vacio), false, `${JSON.stringify(vacio)} no es un fichero`);
  }
});

test("un segmento con punto pero sin extensión al final NO cuenta", () => {
  // `main.tex.j2/` es un directorio aunque su nombre lleve puntos.
  assert.equal(esClaveDeFichero("System/tpl/1.0.0/template/main.tex.j2/"), false);
});
