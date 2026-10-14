// Fixture RICA de desarrollo: crea un segundo proceso, de modo `single`, dirigido al cargo
// Docente de "Tecnologías de la Información" (unidad 8), y lo lanza en el periodo Permanente.
//
// POR QUÉ EXISTE
// El bootstrap con datos de ejemplo deja un organigrama completo pero UN SOLO proceso: el
// "Proceso por defecto" (routed). Con eso, /home no se puede verificar de verdad: no hay
// multi-selección de procesos, ni encabezados de grupo, ni entregables single/replicated,
// que es justo la parte más intrincada de HomeView. Este script cierra ese hueco.
//
// CÓMO
// Casi todo por la API de admin (/admin/sql/...), NO con SQL directo: así pasa por
// SqlAdminService.validateTableRules y los datos quedan válidos para el esquema de hoy.
// El entregable se obtiene "forkeando" el que ya sembró el bootstrap (tpl_informe_general):
// un entregable pertenece a UNA línea y no se puede prestar a otra, así que el fork crea uno
// propio y copia sus objetos en MinIO. No hace falta subir nada a mano.
//
// RESULTADO
// La persona 3 ("usuario", cédula 1122334459) pasa a ver DOS procesos en /home:
//   - "Proceso por defecto"  (routed)  -> se muestra como "Tareas"
//   - "Informe de Gestión Docente" (single) -> con entregable, flujo de entrega y de firma
//
// USO:  node scripts/seed_dev_rich.mjs        (dentro del contenedor backend)
// Es IDEMPOTENTE: si el proceso ya existe, no lo duplica.

import { get, patch, post, put } from "../tests/characterization/lib/http.mjs";
import { tokenFor } from "../tests/characterization/lib/auth.mjs";
import SqlAdminService from "../services/admin/SqlAdminService.js";

let _sqlAdmin = null;
const sqlAdmin = () => (_sqlAdmin ??= new SqlAdminService());

const SLUG = "informe-gestion-docente";
const UNIT_ID = 8;            // Tecnologías de la Información
const UNIT_2_ID = 9;          // Sistemas de Información (2ª unidad de la persona 3)
const CARGO_DOCENTE = 2;      // destinatario del proceso (quien elabora)
const UNIT_TYPE_CARRERA = 7;  // el tipo de las unidades 8 y 9 — y las dos UNICAS de su tipo
const CARGO_COORDINADOR = 1;  // quien firma
const TERM_TYPE_PERM = 5;     // Permanente
const TERM_PERM = 1;
// Objetos que el bootstrap ya publicó en MinIO: los reutilizamos apuntando a ellos.
const SEED_ARTIFACT_ID = 1;   // tpl_informe_general, ya publicado por el bootstrap

const rowsOf = (res) => (Array.isArray(res.body) ? res.body : res.body?.data ?? res.body?.rows ?? []);

const create = async (table, body, token) => {
  const res = await post(`/admin/sql/${table}`, { token, body });
  if (res.status >= 400) {
    throw new Error(`POST /admin/sql/${table} -> ${res.status}: ${JSON.stringify(res.body)}`);
  }
  const id = res.body?.insertId ?? res.body?.id ?? res.body?.data?.id;
  console.log(`  ✔ ${table} #${id}`);
  return id;
};

// FASE 2 — Segunda unidad para la persona 3.
//
// Con una sola unidad no se pueden verificar ni la vista consolidada (nivel 1 = unidades)
// ni la fusión de cargos entre unidades que hace buildGroupCargos() en HomeView. Aquí se
// le da a la persona 3 un segundo puesto de Docente en "Sistemas de Información" (unidad 9,
// hermana de la 8) y se extiende el proceso a esa unidad.
//
// Se crea un puesto NUEVO (slot 9) en vez de reutilizar uno: los 8 existentes están
// ocupados y el endpoint /assign desplazaría a su ocupante (le pone is_current=0).
const addSecondUnit = async (token) => {
  const UNIT_2 = UNIT_2_ID;

  const assignments = rowsOf(await get("/admin/sql/position_assignments", { token }));
  const positions = rowsOf(await get("/admin/sql/unit_positions", { token }));
  const yaTiene = assignments.some((a) => {
    if (Number(a.person_id) !== 3 || Number(a.is_current) !== 1) return false;
    const pos = positions.find((p) => Number(p.id) === Number(a.position_id));
    return Number(pos?.unit_id) === UNIT_2;
  });
  // Guardas SEPARADAS: el puesto y la regla se comprueban por su cuenta. Si se comprueban
  // juntas, un fallo a mitad deja el puesto creado y la regla nunca se añade en el reintento.
  if (yaTiene) {
    console.log("La persona 3 ya tiene puesto en la unidad 9 (salto la asignación).");
  } else {
    console.log("\nDando a la persona 3 un segundo puesto (Docente en 'Sistemas de Información')...");
    const positionId = await create("unit_positions", {
      unit_id: UNIT_2,
      cargo_id: CARGO_DOCENTE,
      slot_no: 9,
      title: "Docente",
      position_type: "real",
      is_active: 1,
    }, token);

    const assign = await post(`/admin/sql/units/positions/${positionId}/assign`, {
      token,
      body: { person_id: 3 },
    });
    if (assign.status >= 400) {
      throw new Error(`Asignación falló -> ${assign.status}: ${JSON.stringify(assign.body)}`);
    }
    console.log(`  ✔ persona 3 asignada al puesto #${positionId}`);
  }


};

// Qué verá realmente la persona 3 en /home tras correr el script.
const resumen = async (token) => {
  const menu = await get("/users/3/menu", { token });
  const units = menu.body?.units ?? [];
  console.log("\n── Lo que ve la persona 3 en /home ──");
  for (const u of units) {
    console.log(`  Unidad: ${u.name}`);
    for (const c of u.cargos ?? []) {
      console.log(`    Cargo: ${c.name}`);
      for (const p of c.processes ?? []) {
        console.log(`      - ${p.name}${p.is_routed ? " (routed)" : " (single)"}`);
      }
    }
  }
  if (units.length >= 2) {
    console.log("\n✅ Fixture lista: 2 unidades y multi-proceso. /home ya es verificable.");
  } else {
    console.warn("\n⚠ Solo se ve 1 unidad: la vista consolidada no será verificable.");
  }
};

const main = async () => {
  const token = await tokenFor("admin");

  // Idempotencia: si el proceso ya está, saltamos la fase 1 pero seguimos con la 2.
  const existing = rowsOf(await get("/admin/sql/processes", { token }));
  if (existing.some((p) => p.slug === SLUG)) {
    console.log(`El proceso "${SLUG}" ya existe. Salto a la fase 2.`);
    await addSecondUnit(token);
    await resumen(token);
    return;
  }

  console.log("Creando proceso 'Informe de Gestión Docente' (modo single)...");

  // 1. Proceso.
  const processId = await create("processes", {
    name: "Informe de Gestión Docente",
    slug: SLUG,
    is_active: 1,
  }, token);

  // 2. LA LÍNEA: la obligación con sus dos ejes. Aquí se creaba una SERIE —un eje o el otro—, y por
  //    eso «de los Docentes» tenía que escribirse en la regla de reparto. La línea lo dice entero y
  //    le pone nombre, que es el que la configuración hereda.
  const today = new Date().toISOString().slice(0, 10);
  //
  //    ⚠️ ESTO DECIA `all_units` Y LO ACOTABAN DOS REGLAS, una por Carrera. Las cuatro columnas de
  //    ámbito de la regla se fueron con `P10` (2026-10-14) porque eran copia de aquí, así que el
  //    acotado sube a donde se declara. Y la traducción es MEJOR que lo que sustituye: la obligación
  //    no es «los Docentes de las unidades 8 y 9» —dos ids sueltos que nadie puede leer como una
  //    idea— sino «los Docentes de las Carreras», que es lo que la institución diría. Da lo mismo
  //    porque esas dos son las únicas Carreras del organigrama sembrado, pero lo dice entendiéndolo.
  const lineaId = await create("lineas", {
    process_id: processId,
    nombre: "Informe de Gestión Docente",
    cargo_id: CARGO_DOCENTE,
    unit_scope_type: "unit_type",
    unit_type_id: UNIT_TYPE_CARRERA,
    effective_from: today,
  }, token);

  // 3. Definición. REGLA DE NEGOCIO: sólo puede crearse en `draft`; se activa al final,
  //    cuando ya tiene plantilla, flujos y regla de reparto (SqlAdminService lo exige).
  // SIN `process_id`: lo dice la línea (frente 25, P22). Y SIN `name`: lo dice la línea más la
  // versión, derivado al leer (frente 25, P23) — aquí se escribía EL MISMO literal que el nombre de
  // la línea de arriba, copiado a mano, que es la copia en su forma más desnuda.
  const definitionId = await create("process_definition_versions", {
    linea_id: lineaId,
    definition_version: "1.0.0",
    description: "Informe semestral de gestión que elabora cada docente y firma su coordinador.",
    status: "draft",
    active_series_flag: 1,
    effective_from: today,
  }, token);

  // 4. Periodo en el que puede lanzarse: Permanente (para poder lanzar en el term 1).
  await create("process_definition_period_types", {
    process_definition_id: definitionId,
    term_type_id: TERM_TYPE_PERM,
    is_active: 1,
  }, token);

  // 5. Entregable PROPIO de esta línea, "forkeado" del que sembró el bootstrap.
  //
  //    REGLA DE NEGOCIO: un entregable sirve a UNA SOLA LÍNEA (proceso + variación). Por eso aquí
  //    NO se reutiliza "tpl_informe_general" (es del proceso por defecto) y se forkea.
  //
  //    Y desde el 2026-10-04 lo impide la BASE: `trg_vinculo_formato_un_proceso`. Si quitas el fork y vinculas
  //    el artefacto del proceso por defecto, este script muere con
  //    «El entregable "tpl_informe_general" pertenece a otra línea...». Antes lo intentaba un
  //    guardia de JavaScript (`assertDeliverableBelongsToConfigLine`), que este script **se
  //    saltaba** porque no pasa por el hook de alta del CRUD.
  //
  //    forkDeliverableForConfig es justo la operación que la UI llama "Crear a partir de
  //    este": crea el entregable de la línea destino, COPIA los objetos de MinIO a un
  //    prefijo propio y publica el artefacto. Hoy no está expuesta como endpoint, así que se
  //    invoca directamente sobre el servicio (este script corre dentro del backend).
  //
  //    Se llama ANTES de crear el vínculo: el fork solo hace UPDATE del enlace existente
  //    (que aún no hay, así que no afecta a nada) y nos devuelve el artefacto nuevo, que no tiene
  //    vínculo todavía y por tanto SÍ se puede vincular.
  console.log("Forkeando el entregable a la nueva línea (copia objetos en MinIO)...");
  const fork = await sqlAdmin().forkDeliverableForConfig({
    sourceArtifactId: SEED_ARTIFACT_ID,
    definitionId,
    newCode: "tpl_informe_gestion_docente",
  });
  console.log(`  ✔ entregable #${fork.catalogo_documental_id}, artefacto #${fork.artifact_id} (${fork.base_object_prefix})`);

  // 6. Plantilla vinculada en modo SINGLE: 1 instancia al lanzar, con flujo predefinido.
  const pdtId = await create("vinculos", {
    process_definition_id: definitionId,
    edicion_id: fork.artifact_id,
    sort_order: 1,
    item_mode: "single",
  }, token);

  // 6-bis. UNA VERSIÓN EN BORRADOR PARA PODER AUTORAR EL RECORRIDO.
  //
  //    ⚠️ ESTE PASO FALTABA Y EL SEED ESTABA ROTO DESDE EL 2026-10-08. El fork inserta su edición
  //    ya PUBLICADA (lo hace desde el 2026-08-06), y el frente 24 añadió un guard que prohíbe
  //    tocar los pasos de una edición publicada: «Crea una version nueva para cambiar su
  //    recorrido». Entre las dos cosas, `npm run seed:dev` moría con un 409 justo aquí, y nadie
  //    lo vio porque este script no lo ejecuta ninguna puerta. No tiene nada que ver con el frente
  //    25; se arregla aquí porque sin seed no hay con qué probar.
  //
  //    El fork TAMPOCO hereda recorrido: el entregable del que sale es `routed`, o sea sin receta
  //    autorada, así que no hay nada que copiar. Hay que escribirla.
  const verRes = await post(`/admin/sql/ediciones/${fork.artifact_id}/version`, { token, body: {} });
  if (verRes.status >= 400) {
    throw new Error(`No se pudo versionar la edicion del fork: ${verRes.status} ${JSON.stringify(verRes.body)}`);
  }
  const edicionBorradorId = Number(verRes.body?.id || verRes.body?.artifact_id);
  if (!edicionBorradorId) {
    throw new Error(`La version nueva no devolvio id: ${JSON.stringify(verRes.body)}`);
  }
  console.log(`  ✔ edicion en borrador #${edicionBorradorId} (para autorar el recorrido)`);

  // 7. LA RECETA DEL RECORRIDO, anclada en la EDICION. Eran CUATRO altas --dos cabeceras y dos
  //    pasos, con sus `selection_mode`, `is_required` y `approval_mode`-- y son cuatro sobre dos
  //    tablas: el paso y su participante, para cada accion. Sin cabeceras no hay nada que nombrar ni
  //    que activar: un paso lleva su propio origen.
  //
  //    ENTREGA: lo llena el responsable de la tarea (el docente).
  const pasoEntregaId = await create("pasos_declarados", {
    accion: "entrega",
    edicion_id: edicionBorradorId,
    orden: 1,
    nombre: "Elaboración del informe",
  }, token);
  await create("participantes_declarados", {
    paso_id: pasoEntregaId,
    orden: 1,
    resolver_type: "task_assignee",   // "Responsable del entregable"
  }, token);

  // 8. FIRMA: la firma el Coordinador de la misma unidad. El `slot` es el hueco donde se estampa, y
  //    va en el PARTICIPANTE: un firmante, un hueco.
  const pasoFirmaId = await create("pasos_declarados", {
    accion: "firma",
    edicion_id: edicionBorradorId,
    orden: 1,
    code: "firma_1",
    nombre: "Coordinador de carrera",
  }, token);
  await create("participantes_declarados", {
    paso_id: pasoFirmaId,
    orden: 1,
    resolver_type: "cargo_in_scope",  // "Por cargo"
    cargo_id: CARGO_COORDINADOR,
    unit_scope_type: "unit_exact",
    unit_id: UNIT_ID,
    slot: "firma_1",
  }, token);

  // 8-bis. PUBLICAR el borrador con su recorrido, y apuntar el vínculo a él.
  const pubRes = await patch(`/admin/sql/ediciones/${edicionBorradorId}/publish`, { token, body: {} });
  if (pubRes.status >= 400) {
    throw new Error(`No se pudo publicar la edicion del recorrido: ${pubRes.status} ${JSON.stringify(pubRes.body)}`);
  }
  const reapunta = await put("/admin/sql/vinculos", {
    token,
    body: { keys: { id: pdtId }, data: { edicion_id: edicionBorradorId } },
  });
  if (reapunta.status >= 400) {
    throw new Error(`No se pudo reapuntar el vinculo: ${reapunta.status} ${JSON.stringify(reapunta.body)}`);
  }
  console.log(`  ✔ recorrido publicado y vinculo apuntando a la edicion #${edicionBorradorId}`);

  // 9. La regla de reparto: UNA, y sin ámbito.
  //    Eran DOS —una por unidad, con su cargo y su prioridad— y las cuatro columnas que las
  //    distinguían eran copia de la línea (`P10`). Hoy el alcance lo dice la línea y la regla sólo
  //    declara el afinado: aquí `all_matches`, o sea sin recorte.
  //    REGLA DE NEGOCIO: las reglas solo se pueden tocar con la config en `draft`, y una
  //    config `active` NO puede volver a draft (para cambiar el alcance hay que versionar).
  //    Por eso se crea AQUÍ, antes de activar: añadirla luego es imposible.
  await create("process_target_rules", {
    process_definition_id: definitionId,
    recipient_policy: "all_matches",
  }, token);

  // 10. ACTIVAR la definición: ya tiene plantilla, flujos y regla. Hasta ahora era draft.
  console.log("Activando la definición...");
  // La ruta es PUT /:table (sin :id): la fila se identifica con `keys` en el cuerpo.
  const act = await put("/admin/sql/process_definition_versions", {
    token,
    body: { keys: { id: definitionId }, data: { status: "active" } },
  });
  if (act.status >= 400) {
    throw new Error(`Activación falló -> ${act.status}: ${JSON.stringify(act.body)}`);
  }
  console.log("  ✔ activa");

  // 11. Segundo puesto ANTES de lanzar. EL ORDEN IMPORTA: el lanzamiento reparte
  //     asignaciones a los puestos que existen EN ESE MOMENTO. Si se crea el puesto después,
  //     la persona ve el proceso pero sin entregable asignado (no hay task_assignment).
  await addSecondUnit(token);

  // 12. Lanzar en el periodo Permanente -> materializa tareas, task_items y flujos.
  console.log("\nLanzando la definición en el periodo Permanente...");
  const launch = await post(`/admin/process-definitions/${definitionId}/launch`, {
    token,
    body: { term_id: TERM_PERM },
  });
  if (launch.status >= 400) {
    throw new Error(`Lanzamiento falló -> ${launch.status}: ${JSON.stringify(launch.body)}`);
  }
  console.log("  ✔ lanzado:", JSON.stringify(launch.body).slice(0, 160));

  await resumen(token);
};

main().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
