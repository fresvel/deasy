// Characterization: EL PROCESO POR DEFECTO DE PUNTA A PUNTA — crear un entregable `routed` y
// comprobar que el flujo que se materializa es EL QUE EL USUARIO DEFINIÓ AL ENVIAR.
//
// Por qué existe (sub-paso 7 de `docs/planes/plan-maestro-2026-08.md` §0.8). El sub-paso 7 borró
// `BASE_META_YAML`, el `meta.yaml` escrito a mano dentro del bootstrap. Su criterio de cierre era
// que el `count(*)` de flujos colgados del vínculo del Proceso por defecto pasara de 1 a 0 — y lo
// hizo: la clave `vinculo_competidor` es hoy `[]`, y ninguna otra de este fichero se movió.
// **El riesgo de ese paso era romper el Proceso por defecto**, y esta prueba es la que lo recorre
// entero; sigue siendo la red que protege el desmontaje del sub-paso 8.
//
// EL PROCESO POR DEFECTO ES EL PARAGUAS DE LO QUE NO PERTENECE A NINGÚN PROCESO: cualquier persona,
// en cualquier momento, crea ahí una tarea ad-hoc («haz el informe de este evento»). Su vínculo es
// `item_mode = 'routed'`, y eso significa exactamente una cosa: **el flujo NO está predefinido — el
// usuario lo define al enviar** (`CLAUDE.md` §«Modos de emisión», `docs/arquitecturas/modelo-emision-entregables.md`).
//
// ⚠️ ESTO NO DUPLICA `zzzzzz_flow_steps_db`. Aquel flow FOTOGRAFÍA en sus claves `runtime_*` el
// flujo que la FIXTURE dejó sembrado (lo crea `setup/seed_execution.mjs` antes de que corra nadie):
// es un grupo de control estático. Este EJERCITA el camino de usuario —dos POST reales, con dos
// flujos distintos que nadie ha visto antes— y comprueba que lo que llega a la base es lo que se
// pidió. Uno mira una foto vieja; el otro dispara la cámara.
//
// ⚠️ EL NOMBRE NO ES DECORATIVO, Y NO ES «AL FINAL» COMO LOS OTROS TRES QUE ESCRIBEN. Los flows
// corren en orden alfabético con `--test-concurrency=1`, así que el prefijo elige la ventana, y esta
// prueba tiene ventana por LOS DOS LADOS:
//
//   · **Techo (por qué no antes):** escribe mucho. Un solo POST toca NUEVE tablas (terms, tasks,
//     task_items, las cuatro de flujo de runtime, documents, document_versions, document_fill_flows,
//     fill_requests). Va detrás de todo lo que fotografía la fixture entera —`admin_crud`,
//     `execution`, `tasks`, `user_workspace`—, que es lo que le da la `zz_`.
//
//   · **Suelo — YA NO, y conviene saber por qué lo hubo.** `zz_template_lifecycle` ejecuta el UPDATE
//     GUIADO del Proceso por defecto: clona la configuración v1.0.0 en una v1.1.0, la activa y JUBILA
//     la anterior. Y `cloneProcessDefinitionChildren` copiaba del vínculo solo `template_artifact_id`
//     y `sort_order`, así que **`item_mode` no viajaba y la columna caía a su `DEFAULT 'single'`**:
//     a partir de ese flow la configuración ACTIVA del Proceso por defecto no tenía ya ningún vínculo
//     `routed`, el modo derivado respondía «Este entregable es de instancia única: no admite réplicas
//     ni envíos» y el camino que esta prueba existe para cubrir dejaba de ser alcanzable. **Corregido:
//     el clon conserva `item_mode`** (`processDefinitionVersion.js`, con unitarios propios en
//     `processDefinitionVersion.test.js`). El golden que lo demuestra es
//     `flow_steps_db :: plantilla_entrega`, donde la configuración clonada (`process_definition_id: 5`)
//     pasó de `single` a `routed`. **No muevas este fichero de sitio igualmente**: renombrarlo cambia
//     las claves de sus goldens, y el techo de abajo sigue mandando.
//
// La ventana es `user_workspace` < **ESTE** < `zz_task_generation` < `zz_template_lifecycle`
// ('d' < 'ta' < 'te'), y sirve porque los dos `zz_*` siguientes no leen nada de lo que esta prueba
// escribe: lanzan la definición en el término sentinela, y el periodo Custom que crea la tarea libre
// es suyo y no aparece en ningún catálogo.
//
// Es autolimpiante: `cleanupGeneralTaskGraphByItemTitlePrefix` borra el grafo completo en el
// `after`, y también en el `before` por si una corrida anterior murió a medias. Por eso los flows
// que corren DESPUÉS —incluido `zzzzzz_flow_steps_db`, que fotografía TODOS los flujos de runtime
// sin filtrar por entregable— no ven ni una fila de esta prueba.
//
// ⚠️ El `item_mode` que se perdía al clonar era un DEFECTO de producción, no un detalle del arnés:
// actualizar un proceso convertía en `single` todos sus entregables `routed` y `replicated`, en
// silencio. Ya está arreglado (ver el «Suelo» de arriba). Lo que el arreglo NO hace es reparar las
// filas que ya se convirtieron en una instalación existente; en dev da igual, porque
// `test:char:run` resetea y re-siembra la fixture entera antes de cada tanda.
//
// EL ORÁCULO ES LA BASE, y aquí no hay alternativa: la respuesta del endpoint es una lista de ids.
// La propiedad que define el modo `routed` —de QUÉ cuelga el flujo materializado— no la expone
// ninguna ruta. Es la segunda excepción declarada en `lib/db.mjs`.
//
// LAS CUATRO PROPIEDADES QUE SE FIJAN, y por qué esas:
//
//   1. **El flujo cuelga del ENTREGABLE.** `task_item_id` relleno y `template_artifact_id` en NULL.
//      Es LA definición de `routed`: un flujo que colgara de la plantilla sería `single`, y uno que
//      colgara solo del vínculo sería el flujo predefinido que `routed` promete no tener.
//      `process_definition_template_id` va relleno TAMBIÉN, y no es un descuido: la fila lleva los
//      dos portadores porque el segundo AFINA al primero («soy del vínculo 1 **y además**
//      específicamente de este entregable»). El §0.8 lo corrigió por escrito tras medirlo, y por eso
//      la resolución es por PRIORIDAD y no por «qué columna está rellena».
//
//   2. **Los pasos son los que el usuario mandó, en su orden.** No basta con que exista un flujo:
//      tiene que ser ESE. Se comparan persona a persona contra lo enviado, que es más fuerte que el
//      golden — un golden congela lo que hay, esto exige que sea lo que se pidió.
//
//   3. **El flujo de runtime GANA al del vínculo.** Era la propiedad que el sub-paso 7 ponía en
//      riesgo, y la única que se podía romper sin que se cayera nada más: el vínculo del Proceso por
//      defecto llevaba un flujo sembrado por el sync desde `BASE_META_YAML`, con un paso
//      `document_owner`. Si el escalonado hubiera fallado, el documento se habría gobernado por ESE
//      flujo y las solicitudes de llenado habrían ido al dueño en vez de a quien eligió el usuario.
//      Retirado el competidor, la mitad negativa de la comprobación (`NO por el del vínculo`) queda
//      vacua **a propósito** — no hay rival contra el que comparar; la positiva sigue entera, y la
//      lista de rivales se recorre igual para que el día que reaparezca uno, se note aquí.
//
//   4. **El estado en que queda el entregable.** Qué documento y qué versión se crean y con qué
//      estado, más las solicitudes de llenado que se abren. Es el resultado observable del camino
//      entero; si el sub-paso 7 dejara el entregable sin flujo, el documento no llegaría a
//      «Pendiente de llenado» y no habría ni una solicitud, y eso se ve aquí antes que en ningún
//      otro sitio.
//
// LOS DOS MODOS DEL ENDPOINT SE CUBREN, y no son variantes cosméticas del mismo camino:
//   · `free`    — crea la TAREA entera (periodo Custom propio + tarea + entregable endosado).
//   · `derived` — añade un entregable a una tarea que YA existe, eligiendo el vínculo `routed`.
// Recorren dos ramas separadas de `GeneralTaskService` (`createFreeTask` / `createDerivedDeliverable`)
// con destinatarios y resolución de unidad distintos. El `derived` se cuelga de la tarea que crea el
// `free`, así que el orden de los casos es una dependencia real, no una preferencia.
//
// SOBRE EL ENMASCARADO. Se enmascaran los ids ESTRUCTURALES (los de fila y los que cuelgan una fila
// de otra), porque su valor depende de qué secuencias movieron los flows anteriores. Los ids con
// significado de NEGOCIO no: `assigned_person_id`, `owner_person_id`,
// `created_by_person_id`, `responsible_position_id`, `origin_unit_id`, `unit_id`, `cargo_id` y los
// del JSONB `signers` **son el «quién»**, y el «quién» es justo lo que este camino promete respetar.
// `start_date`/`end_date` SÍ se enmascaran: la tarea libre los pone a la fecha de hoy
// (`GeneralTaskService.js:403`) y sin enmascarar el golden caducaría a medianoche.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { get, post } from "../lib/http.mjs";
import { tokenFor } from "../lib/auth.mjs";
import { normalize, snapshotShape } from "../lib/normalize.mjs";
import { matchSnapshot } from "../lib/snapshot.mjs";
import { waitForReady } from "../lib/readiness.mjs";
import { query, cleanupGeneralTaskGraphByItemTitlePrefix, closeDb } from "../lib/db.mjs";
import { FIXTURE } from "../config.mjs";

const SUITE = "default_process_routed";

const { adminPersonId: ADMIN, gestorPersonId: GESTOR, usuarioPersonId: USUARIO } = FIXTURE;
const { unitId: UNIT_ID, definitionId: DEFINITION_ID } = FIXTURE;

// Prefijo común de los dos entregables. Es la llave del teardown: por el título se sube a la tarea
// y se borra el grafo entero, sin recordar ningún id.
const PREFIX = "zz char routed";
const FREE_TITLE = `${PREFIX} libre`;
const FREE_DESCRIPTION = "Entregable ad-hoc con flujo definido al enviar.";
const DERIVED_TITLE = `${PREFIX} derivado`;

const MASK_OPTS = {
  maskIdKeys: true,
  extraMask: ["start_date", "end_date"],
  keep: [
    "process_definition_id",
    "definition_id",
    "assigned_person_id",
    "owner_person_id",
    "created_by_person_id",
    "recipient_person_id",
    "responsible_position_id",
    "target_unit_id",
    "origin_unit_id",
    "unit_id",
    "unit_type_id",
    "relation_type_id",
    "cargo_id",
    "position_id",
    "required_cargo_id",
    // El JSONB `signers`, que lleva el «quién» DENTRO. `materializeRuntimeFlowForTaskItem`
    // (`generation/documents.js:288`) lo serializa en snake_case.
    "person_id",
  ],
};

// --- Lectura del oráculo -------------------------------------------------------------------------

const FILL_TEMPLATE_COLUMNS = `
  id, process_definition_template_id, task_item_id, template_artifact_id, name, description, is_active`;
const SIGNATURE_TEMPLATE_COLUMNS = FILL_TEMPLATE_COLUMNS;

const FILL_STEP_COLUMNS = `
  id, fill_flow_template_id, step_order, code, name, resolver_type, assigned_person_id,
  unit_scope_type, unit_id, unit_type_id, relation_type_id, cargo_id, position_id,
  selection_mode, is_required, can_reject`;

const SIGNATURE_STEP_COLUMNS = `
  id, template_id, step_order, code, name, slot, resolver_type, assigned_person_id,
  unit_scope_type, unit_id, unit_type_id, position_id, required_cargo_id,
  selection_mode, approval_mode, required_signers_min, required_signers_max,
  is_required, signers`;

// Cabecera + pasos anidados, para que el golden se lea como el flujo y no como dos tablas.
async function readRuntimeFillFlow(taskItemId) {
  const [header] = await query(
    `SELECT ${FILL_TEMPLATE_COLUMNS} FROM fill_flow_templates WHERE task_item_id = $1 ORDER BY id`,
    [taskItemId],
  );
  if (!header) return null;
  const steps = await query(
    `SELECT ${FILL_STEP_COLUMNS} FROM fill_flow_steps WHERE fill_flow_template_id = $1 ORDER BY step_order`,
    [header.id],
  );
  return { ...header, steps: steps.map(({ fill_flow_template_id: _fk, ...rest }) => rest) };
}

async function readRuntimeSignatureFlow(taskItemId) {
  const [header] = await query(
    `SELECT ${SIGNATURE_TEMPLATE_COLUMNS} FROM signature_flow_templates WHERE task_item_id = $1 ORDER BY id`,
    [taskItemId],
  );
  if (!header) return null;
  const steps = await query(
    `SELECT ${SIGNATURE_STEP_COLUMNS} FROM signature_flow_steps WHERE template_id = $1 ORDER BY step_order`,
    [header.id],
  );
  return { ...header, steps: steps.map(({ template_id: _fk, ...rest }) => rest) };
}

// El entregable tal como queda: la fila del `task_item`, su documento, su versión, la instancia de
// flujo de llenado y las solicitudes abiertas. Es el «estado resultante» del punto 4.
async function readEntregable(taskItemId) {
  const [item] = await query(
    `SELECT id, task_id, process_definition_template_id, template_artifact_id, origin_kind, title,
            sort_order, created_by_person_id, source_task_item_id, target_unit_id,
            responsible_position_id, assigned_person_id, start_date, end_date,
            user_started_at
       FROM task_items WHERE id = $1`,
    [taskItemId],
  );
  const [document] = await query(
    `SELECT id, task_item_id, owner_person_id, origin_unit_id, title, status
       FROM documents WHERE task_item_id = $1`,
    [taskItemId],
  );
  const versions = document
    ? await query(
        `SELECT id, document_id, version, template_artifact_id, payload_object_path, working_file_path,
                final_file_path, format, status
           FROM document_versions WHERE document_id = $1 ORDER BY version, id`,
        [document.id],
      )
    : [];
  const versionIds = versions.map((row) => row.id);
  const fillFlows = versionIds.length
    ? await query(
        `SELECT id, fill_flow_template_id, document_version_id, status, current_step_order
           FROM document_fill_flows WHERE document_version_id = ANY($1::int[]) ORDER BY id`,
        [versionIds],
      )
    : [];
  const requests = fillFlows.length
    ? await query(
        `SELECT fr.id, fr.document_fill_flow_id, fr.fill_flow_step_id, fr.assigned_person_id,
                fr.status, fr.is_manual, ffs.step_order
           FROM fill_requests fr
           INNER JOIN fill_flow_steps ffs ON ffs.id = fr.fill_flow_step_id
          WHERE fr.document_fill_flow_id = ANY($1::int[])
          ORDER BY ffs.step_order, fr.id`,
        [fillFlows.map((row) => row.id)],
      )
    : [];
  return { task_item: item ?? null, document: document ?? null, versions, fill_flows: fillFlows, fill_requests: requests };
}

// El título genérico `Documento <id>` lleva DENTRO un autoincremental, así que no puede ir crudo al
// golden: su valor depende de cuántos entregables crearon los flows anteriores, no del
// comportamiento. Se colapsa aquí, justo antes de fotografiar, y la forma del título —genérico o
// no— se comprueba aparte con una aserción, que es donde ese hecho SÍ significa algo.
const TITULO_GENERICO = /^Documento \d+$/;
const sinAutoincrementalEnElTitulo = (resultado) => ({
  ...resultado,
  document: resultado.document
    ? {
        ...resultado.document,
        title: TITULO_GENERICO.test(String(resultado.document.title ?? ""))
          ? "Documento <normalized>"
          : resultado.document.title,
      }
    : null,
});

// El COMPETIDOR: el flujo que colgaba del vínculo del Proceso por defecto, sembrado por el sync
// desde `BASE_META_YAML`. Era el que ganaría si el escalonado se rompiera, y el que el sub-paso 7
// tenía que dejar a cero. **Ya está a cero; que vuelva a llenarse significa que reapareció un
// productor de flujo fuera del formulario.**
async function readVinculoCompetidor(linkId) {
  const headers = await query(
    `SELECT ${FILL_TEMPLATE_COLUMNS} FROM fill_flow_templates
      WHERE process_definition_template_id = $1 AND task_item_id IS NULL
      ORDER BY id`,
    [linkId],
  );
  const ids = headers.map((row) => row.id);
  const steps = ids.length
    ? await query(
        `SELECT ${FILL_STEP_COLUMNS} FROM fill_flow_steps
          WHERE fill_flow_template_id = ANY($1::int[]) ORDER BY fill_flow_template_id, step_order`,
        [ids],
      )
    : [];
  return headers.map((header) => ({
    ...header,
    steps: steps
      .filter((step) => Number(step.fill_flow_template_id) === Number(header.id))
      .map(({ fill_flow_template_id: _fk, ...rest }) => rest),
  }));
}

// --- Aserciones compartidas por los dos modos -----------------------------------------------------

// Punto 1: la propiedad que DEFINE `routed`. Se comprueba sobre la fila CRUDA, antes de normalizar:
// `normalize` enmascara las claves de id **aunque valgan null**, así que en el golden no se
// distingue un `template_artifact_id` vacío de uno relleno.
const cuelgaDelEntregable = (flow, { taskItemId, linkId }, lado) => {
  assert.ok(flow, `${lado}: el envío routed debe materializar un flujo`);
  assert.equal(Number(flow.task_item_id), Number(taskItemId), `${lado}: el flujo cuelga del ENTREGABLE`);
  assert.equal(flow.template_artifact_id, null, `${lado}: y NO de la plantilla — eso sería 'single'`);
  assert.equal(
    Number(flow.process_definition_template_id),
    Number(linkId),
    `${lado}: el vínculo va relleno TAMBIÉN — el portador del entregable lo AFINA, no lo cancela`,
  );
  assert.equal(Number(flow.is_active), 1, `${lado}: la cabecera nace activa`);
};

// Punto 2: los pasos son los que se mandaron, en su orden. `can_reject` no se manda: lo DERIVA el
// orden (`generation/documents.js:255`), y por eso el flujo de entrega del modo `free` lleva dos
// pasos — con uno solo nunca se demostraría.
const pasosDeEntregaSegunLoEnviado = (flow, personIds, lado) => {
  assert.equal(flow.steps.length, personIds.length, `${lado}: un paso por persona enviada`);
  flow.steps.forEach((step, index) => {
    assert.equal(Number(step.step_order), index + 1, `${lado}: los pasos conservan el orden enviado`);
    assert.equal(step.resolver_type, "specific_person", `${lado}: persona concreta, elegida al enviar`);
    assert.equal(Number(step.assigned_person_id), personIds[index], `${lado}: el paso ${index + 1} es de quien se eligió`);
    assert.equal(Number(step.can_reject), index === 0 ? 0 : 1, `${lado}: can_reject lo deriva el orden`);
  });
};

// Punto 3: el documento se gobierna por el flujo de RUNTIME, no por el del vínculo. Es la propiedad
// que el sub-paso 7 puede romper sin que se caiga nada más, y se comprueba en las dos direcciones.
const gobiernaElFlujoDeRuntime = (estado, flow, competidor, lado) => {
  assert.equal(estado.fill_flows.length, 1, `${lado}: una instancia de flujo de llenado`);
  assert.equal(
    Number(estado.fill_flows[0].fill_flow_template_id),
    Number(flow.id),
    `${lado}: el documento se gobierna por el flujo que definió el usuario`,
  );
  for (const rival of competidor) {
    assert.notEqual(
      Number(estado.fill_flows[0].fill_flow_template_id),
      Number(rival.id),
      `${lado}: y NO por el flujo predefinido del vínculo`,
    );
  }
};

// Y su consecuencia visible: a quién se le pide llenar. Si el escalonado fallara, la solicitud iría
// al `document_owner` del flujo del vínculo, que es UNA sola y para el dueño del documento.
const solicitudesParaQuienSeEligio = (estado, personIds, lado) => {
  assert.deepEqual(
    estado.fill_requests.map((row) => Number(row.assigned_person_id)),
    personIds,
    `${lado}: las solicitudes de llenado son para las personas elegidas, en su orden`,
  );
  for (const row of estado.fill_requests) {
    assert.equal(Number(row.is_manual), 0, `${lado}: resueltas, no pendientes de asignar a mano`);
  }
};

// --- Ciclo de vida --------------------------------------------------------------------------------

const estado = { linkId: null, artifactId: null, freeTaskId: null, freeItemId: null, derivedItemId: null };

before(async () => {
  await waitForReady();
  await cleanupGeneralTaskGraphByItemTitlePrefix(PREFIX);
});

after(async () => {
  await cleanupGeneralTaskGraphByItemTitlePrefix(PREFIX);
  await closeDb();
});

// --- 0) El vínculo routed del Proceso por defecto -------------------------------------------------

test("el Proceso por defecto ofrece su vínculo ROUTED como entregable agregable", async () => {
  const token = await tokenFor("usuario");
  const res = await get(`/users/${USUARIO}/addable-deliverables?definition_id=${DEFINITION_ID}`, { token });
  assert.equal(res.status, 200, `addable-deliverables debe responder 200: ${JSON.stringify(res.body)}`);
  const routed = (res.body?.deliverables ?? []).filter((row) => row.item_mode === "routed");
  assert.equal(routed.length, 1, "el Proceso por defecto tiene exactamente un vínculo routed");
  estado.linkId = Number(routed[0].id);
  estado.artifactId = Number(routed[0].template_artifact_id);
  matchSnapshot(SUITE, "vinculo_routed", snapshotShape(res, MASK_OPTS));
});

// --- 1) Modo FREE: la tarea ad-hoc completa -------------------------------------------------------
//
// El camino que describe `CLAUDE.md`: cualquier usuario, en cualquier momento, crea una tarea que no
// pertenece a ningún proceso. El flujo va DENTRO de la petición porque no existe en ninguna parte
// hasta que él lo escribe.

// Entrega en DOS pasos (gestor y luego el propio usuario) y firma del admin. Dos pasos de entrega no
// es adorno: es lo único que demuestra el `can_reject` derivado del orden.
const FREE_ENTREGA = [GESTOR, USUARIO];
const FREE_FIRMA = [ADMIN];

test("free · POST /users/:id/general-tasks crea la tarea ad-hoc con su flujo definido al enviar", async () => {
  const token = await tokenFor("usuario");
  const res = await post(`/users/${USUARIO}/general-tasks`, {
    token,
    body: {
      mode: "free",
      title: FREE_TITLE,
      description: FREE_DESCRIPTION,
      unit_id: UNIT_ID,
      // El destinatario es el GESTOR, no el creador: así el dueño del documento y el autor son
      // personas distintas y el golden no puede confundirlos.
      recipient_person_id: GESTOR,
      flow: {
        entrega: FREE_ENTREGA.map((personId) => ({ person_id: personId })),
        firma: FREE_FIRMA.map((personId) => ({ person_id: personId })),
      },
    },
  });
  assert.equal(res.status, 200, `crear la tarea libre debe responder 200: ${JSON.stringify(res.body)}`);
  estado.freeTaskId = Number(res.body?.task_id);
  estado.freeItemId = Number(res.body?.task_item_id);
  assert.ok(estado.freeTaskId && estado.freeItemId, "deben devolverse los ids de la tarea y del entregable");
  matchSnapshot(SUITE, "free_respuesta", snapshotShape(res, MASK_OPTS));
});

// ─── El camino LEGACY, cerrado el 2026-08-23 ───────────────────────────────────────────────
// Antes se admitia un envio SIN flujo si traia destinatario, y entonces NO se materializaba ningun
// flujo de firma: el unico rastro del destinatario era la columna `target_person_id`. Esa rama era
// lo que impedia retirarla.
//
// La interfaz no la podia producir —`useGeneralTask.js:110` manda flujo siempre que el modo sea
// routed o free— asi que cerrarla no rompio ninguna prueba... y por eso mismo NADIE la vigilaba.
// Este caso existe para que reabrirla se note.
// ─── El camino sin flujo, ELIMINADO el 2026-08-23 ─────────────────────────────────────────
// Antes se admitia un envio SIN flujo si traia destinatario, y entonces NO se materializaba ningun
// flujo de firma: el unico rastro de a quien iba dirigido el documento era la columna
// `target_person_id`. Esa rama era lo que impedia retirarla.
//
// Decision del dueño (2026-08-23): ese caso NO EXISTE en la institucion. Solo hay una forma de
// enviar — diciendo quien elabora y quien firma— y de ese flujo se deriva el destinatario.
//
// La interfaz ya lo hacia asi, asi que cerrarlo no rompio ninguna prueba... y por eso mismo NADIE
// lo vigilaba. Este caso existe para que reabrirlo se note.
test("free · un envio SIN flujo se rechaza: el destinatario vive en el flujo, no en una columna", async () => {
  const token = await tokenFor("usuario");
  const res = await post(`/users/${USUARIO}/general-tasks`, {
    token,
    body: {
      mode: "free",
      title: `${FREE_TITLE} (sin flujo)`,
      unit_id: UNIT_ID,
      recipient_person_id: GESTOR,   // traer destinatario ya NO basta
    },
  });
  assert.ok(res.status >= 400, `esperaba un rechazo y vino ${res.status}`);
  assert.notEqual(res.status, 500, "un guard de entrada no debe salir por 500");
  await matchSnapshot(SUITE, "free_sin_flujo_rechazado", snapshotShape(res, MASK_OPTS));
});

test("free · el flujo de ENTREGA cuelga del ENTREGABLE y es el que definió el usuario", async () => {
  assert.ok(estado.freeItemId, "depende del paso anterior");
  const flow = await readRuntimeFillFlow(estado.freeItemId);
  cuelgaDelEntregable(flow, { taskItemId: estado.freeItemId, linkId: estado.linkId }, "free/entrega");
  pasosDeEntregaSegunLoEnviado(flow, FREE_ENTREGA, "free/entrega");
  matchSnapshot(SUITE, "free_flujo_entrega", normalize(flow, MASK_OPTS));
});

test("free · el flujo de FIRMA cuelga del ENTREGABLE y es el que definió el usuario", async () => {
  assert.ok(estado.freeItemId, "depende del paso anterior");
  const flow = await readRuntimeSignatureFlow(estado.freeItemId);
  cuelgaDelEntregable(flow, { taskItemId: estado.freeItemId, linkId: estado.linkId }, "free/firma");
  assert.equal(flow.steps.length, FREE_FIRMA.length, "free/firma: un paso por firmante enviado");
  assert.equal(Number(flow.steps[0].assigned_person_id), ADMIN, "free/firma: firma quien se eligió");
  matchSnapshot(SUITE, "free_flujo_firma", normalize(flow, MASK_OPTS));
});

test("free · el entregable resultante: documento, versión y solicitudes de llenado", async () => {
  assert.ok(estado.freeItemId, "depende del paso anterior");
  const resultado = await readEntregable(estado.freeItemId);
  assert.equal(Number(resultado.task_item.template_artifact_id), estado.artifactId, "instancia la plantilla del vínculo");
  // EL DUEÑO YA NO ES EL DESTINATARIO (2026-08-23). La cascada de
  // `resolveOwnerPersonIdForTaskItem` empezaba en `target_person_id` —el «Para:»—, y eso decia que
  // responde del documento QUIEN LO RECIBE. Retirada la columna, la cascada empieza donde tiene que
  // empezar: en `assigned_person_id`, quien lo ELABORA. El destinatario, si importa, se lee del
  // flujo de firma; no hay ninguna columna que lo guarde.
  assert.equal(Number(resultado.document.owner_person_id), USUARIO, "el dueño del documento es quien lo ELABORA, no quien lo recibe");
  assert.equal(resultado.versions.length, 1, "se crea UNA versión");
  assert.equal(String(resultado.versions[0].version), "0.1", "la versión inicial es 0.1");
  assert.equal(resultado.versions[0].status, "Pendiente de llenado", "y queda esperando a que la llenen");
  // ASIMETRÍA REAL DEL CÓDIGO, no un descuido de la prueba: la tarea LIBRE titula su documento
  // `Documento <id>` mientras que la derivada usa el título del entregable. La causa está en el
  // servicio: `loadFreeTaskItemRow` (`GeneralTaskService.js:465`) no selecciona
  // `template_artifact_name` y `loadDerivedTaskItemRow` (`:304`) sí, así que
  // `ensureDocumentForTaskItem` cae al nombre de relleno (`generation/documents.js:337`). El comentario
  // del propio servicio avisa de la asimetría; congelarla aquí es lo que hará ruido el día que alguien
  // "unifique" las dos consultas sin mirar qué hace el nombre aguas abajo.
  assert.match(
    String(resultado.document.title),
    TITULO_GENERICO,
    "free: el documento nace con título genérico porque su consulta no trae el nombre de la plantilla",
  );
  matchSnapshot(SUITE, "free_entregable", normalize(sinAutoincrementalEnElTitulo(resultado), MASK_OPTS));
});

test("free · el documento lo gobierna el flujo de RUNTIME, no el predefinido del vínculo", async () => {
  assert.ok(estado.freeItemId, "depende del paso anterior");
  const flow = await readRuntimeFillFlow(estado.freeItemId);
  const competidor = await readVinculoCompetidor(estado.linkId);
  const resultado = await readEntregable(estado.freeItemId);
  gobiernaElFlujoDeRuntime(resultado, flow, competidor, "free");
  solicitudesParaQuienSeEligio(resultado, FREE_ENTREGA, "free");
});

// --- 2) Modo DERIVED: un entregable añadido a una tarea que ya existe ------------------------------
//
// La otra rama del mismo endpoint (`createDerivedDeliverable`). No es una variante del `free`: no
// crea periodo ni tarea, elige el vínculo por id, resuelve la unidad desde la TAREA ORIGEN y deja a
// quien lo elabora como dueño del documento. Se cuelga de la tarea que creó el caso anterior,
// así que la dependencia de orden es real.

const DERIVED_ENTREGA = [ADMIN];
// Un paso con DOS firmantes y `at_least` — es lo único que ejercita `approval_mode`,
// `required_signers_min` y el JSONB `signers` con más de un elemento.
const DERIVED_FIRMA = [
  { signers: [{ person_id: GESTOR }, { person_id: USUARIO }], approval_mode: "at_least", required_min: 1 },
  { person_id: ADMIN },
];

test("derived · POST /users/:id/general-tasks añade el entregable routed a la tarea existente", async () => {
  const token = await tokenFor("usuario");
  assert.ok(estado.freeTaskId && estado.linkId, "depende de la tarea creada en modo free");
  const res = await post(`/users/${USUARIO}/general-tasks`, {
    token,
    body: {
      mode: "derived",
      title: DERIVED_TITLE,
      source_task_id: estado.freeTaskId,
      process_definition_template_id: estado.linkId,
      recipient_person_id: ADMIN,
      flow: {
        entrega: DERIVED_ENTREGA.map((personId) => ({ person_id: personId })),
        firma: DERIVED_FIRMA,
      },
    },
  });
  assert.equal(res.status, 200, `añadir el entregable debe responder 200: ${JSON.stringify(res.body)}`);
  assert.equal(res.body?.item_mode, "routed", "el vínculo elegido es routed");
  estado.derivedItemId = Number(res.body?.task_item_id);
  assert.ok(estado.derivedItemId, "debe devolverse el id del entregable creado");
  matchSnapshot(SUITE, "derived_respuesta", snapshotShape(res, MASK_OPTS));
});

test("derived · el flujo de ENTREGA cuelga del ENTREGABLE y es el que definió el usuario", async () => {
  assert.ok(estado.derivedItemId, "depende del paso anterior");
  const flow = await readRuntimeFillFlow(estado.derivedItemId);
  cuelgaDelEntregable(flow, { taskItemId: estado.derivedItemId, linkId: estado.linkId }, "derived/entrega");
  pasosDeEntregaSegunLoEnviado(flow, DERIVED_ENTREGA, "derived/entrega");
  matchSnapshot(SUITE, "derived_flujo_entrega", normalize(flow, MASK_OPTS));
});

test("derived · el flujo de FIRMA conserva los DOS firmantes del paso y su modo de aprobación", async () => {
  assert.ok(estado.derivedItemId, "depende del paso anterior");
  const flow = await readRuntimeSignatureFlow(estado.derivedItemId);
  cuelgaDelEntregable(flow, { taskItemId: estado.derivedItemId, linkId: estado.linkId }, "derived/firma");
  assert.equal(flow.steps.length, 2, "derived/firma: dos pasos de firma");
  const [multiple, unico] = flow.steps;
  assert.equal(multiple.approval_mode, "at_least", "el primer paso conserva su modo de aprobación");
  assert.equal(Number(multiple.required_signers_min), 1, "y su mínimo de firmantes");
  assert.deepEqual(
    (typeof multiple.signers === "string" ? JSON.parse(multiple.signers) : multiple.signers).map((s) => Number(s.person_id)),
    [GESTOR, USUARIO],
    "los dos firmantes del paso son los enviados, en su orden",
  );
  assert.equal(unico.approval_mode, "and", "un paso de un solo firmante siempre es 'and'");
  matchSnapshot(SUITE, "derived_flujo_firma", normalize(flow, MASK_OPTS));
});

test("derived · el entregable resultante: documento, versión y solicitudes de llenado", async () => {
  assert.ok(estado.derivedItemId, "depende del paso anterior");
  const resultado = await readEntregable(estado.derivedItemId);
  assert.equal(resultado.task_item.origin_kind, "user_added", "el entregable es añadido por el usuario");
  assert.equal(Number(resultado.task_item.created_by_person_id), USUARIO, "el creador queda como autor");
  // EL DUEÑO YA NO ES EL DESTINATARIO (2026-08-23). La cascada de
  // `resolveOwnerPersonIdForTaskItem` empezaba en `target_person_id` —el «Para:»—, y eso decia que
  // responde del documento QUIEN LO RECIBE. Retirada la columna, la cascada empieza donde tiene que
  // empezar: en `assigned_person_id`, quien lo ELABORA. El destinatario, si importa, se lee del
  // flujo de firma; no hay ninguna columna que lo guarde.
  assert.equal(Number(resultado.document.owner_person_id), USUARIO, "el dueño del documento es quien lo ELABORA, no quien lo recibe");
  assert.equal(resultado.versions.length, 1, "se crea UNA versión");
  assert.equal(String(resultado.versions[0].version), "0.1", "la versión inicial es 0.1");
  assert.equal(resultado.versions[0].status, "Pendiente de llenado", "y queda esperando a que la llenen");
  // La otra mitad de la asimetría: aquí SÍ se hereda el título del entregable (ver el caso `free`).
  assert.equal(resultado.document.title, DERIVED_TITLE, "derived: el documento hereda el título del entregable");
  matchSnapshot(SUITE, "derived_entregable", normalize(sinAutoincrementalEnElTitulo(resultado), MASK_OPTS));
});

test("derived · el documento lo gobierna el flujo de RUNTIME, no el predefinido del vínculo", async () => {
  assert.ok(estado.derivedItemId, "depende del paso anterior");
  const flow = await readRuntimeFillFlow(estado.derivedItemId);
  const competidor = await readVinculoCompetidor(estado.linkId);
  const resultado = await readEntregable(estado.derivedItemId);
  gobiernaElFlujoDeRuntime(resultado, flow, competidor, "derived");
  solicitudesParaQuienSeEligio(resultado, DERIVED_ENTREGA, "derived");
});

// --- 3) El competidor, congelado -----------------------------------------------------------------

test("el vínculo del Proceso por defecto YA NO lleva ningún flujo predefinido", async () => {
  // Ésta fue la ÚNICA clave de este flow que movió el sub-paso 7, y su criterio de cierre era
  // quedarse en `[]`. Documentaba el `document_owner` que nadie autoró: llegaba del `meta.yaml`
  // escrito a mano dentro del bootstrap, sobre un vínculo `routed` cuyo propio bootstrap declara que
  // NO siembra flujo (punto 6 de `ensureDefaultProcess`). El sync no mira `item_mode`, y por eso lo
  // proyectaba igual.
  //
  // Que vuelva a tener contenido significa una de dos: reapareció un productor fuera del formulario,
  // o el desmontaje del sub-paso 8 dejó filas rancias colgando del vínculo.
  assert.ok(estado.linkId, "depende del primer caso");
  const competidor = await readVinculoCompetidor(estado.linkId);
  matchSnapshot(SUITE, "vinculo_competidor", normalize(competidor, MASK_OPTS));
});
