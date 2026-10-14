// Acceso a datos (solo LECTURA) de TaskGenerationService: los lookups que alimentan la
// generación de tareas, la materialización de documentos y los flujos de llenado/firma.
// Extraído en la Fase 3. Ver docs/docs-md-antiguos/refactor-2026-07/auditoria-refactor-2026-07.md
//
// Todas reciben `connection` explícitamente: no abren conexiones ni tocan el pool. Eso
// las hace trasladables tal cual a un repositorio si algún día se separa la capa.
import { applyRecipientPolicy } from "./primitives.js";


export const getTermById = async (connection, termId) => {
  const [rows] = await connection.query(
    `SELECT id, term_type_id, start_date, end_date
     FROM terms
     WHERE id = ?
     LIMIT 1`,
    [termId]
  );
  return rows[0] || null;
};

export const getActiveAutomaticDefinitions = async (connection, term) => {
  const [rows] = await connection.query(
    `SELECT ranked.id, ranked.process_id, ranked.linea_id, ranked.definition_version
     FROM (
       SELECT
         pdv.id,
         l.process_id,
         pdv.linea_id,
         pdv.definition_version,
         -- UNA configuracion activa por LINEA. Particionaba por (process_id, variation_key), que
         -- es la pareja mas su copia; la linea es una columna y es el dato.
         ROW_NUMBER() OVER (
           PARTITION BY pdv.linea_id
           ORDER BY pdv.effective_from DESC, pdv.id DESC
         ) AS rn
       FROM process_definition_versions pdv
       -- LA OBLIGACION TIENE QUE SEGUIR EN PIE (frente 25, P18-a — 2026-10-12).
       --
       -- Esto no estaba, y era el hueco: retirar una linea NO PARABA NADA. Solo impedia crear
       -- configuraciones nuevas sobre ella y la sacaba de los selectores; las ya activas seguian
       -- generando tareas. Una vigencia que no detiene es peor que no tenerla, porque alguien la
       -- pone creyendo que surte efecto.
       INNER JOIN lineas l ON l.id = pdv.linea_id
       WHERE pdv.status = 'active'
         -- LA NORMA QUE APLICA A UN PERIODO ES LA VIGENTE AL EMPEZARLO, no la que lo solape
         -- (frente 25, P18-b). Una institucion dice «hasta 2026-2», no «hasta el 14 de noviembre»,
         -- y un periodo que empezo bajo una norma TERMINA bajo esa norma. Antes esto era una prueba
         -- de solapamiento --inicio <= fin del periodo y fin >= inicio del periodo--, asi que una
         -- configuracion que entraba en vigor el ULTIMO DIA del semestre generaba ese semestre
         -- entero. Las dos fechas se comparan ahora contra el INICIO del periodo.
         AND pdv.effective_from <= ?
         AND (pdv.effective_to IS NULL OR pdv.effective_to >= ?)
         AND l.effective_from <= ?
         AND (l.effective_to IS NULL OR l.effective_to >= ?)
     ) AS ranked
     INNER JOIN process_definition_period_types pdp
       ON pdp.process_definition_id = ranked.id
      AND pdp.is_active = 1
      AND pdp.term_type_id = ?
     WHERE ranked.rn = 1
     ORDER BY ranked.process_id ASC, ranked.linea_id ASC`,
    [term.start_date, term.start_date, term.start_date, term.start_date, term.term_type_id]
  );
  return rows;
};

// LA REGLA YA NO TIENE VIGENCIA NI INTERRUPTOR (frente 25, P18-d): nace y muere con su version
// de la norma, y quien decide si esa norma aplica al periodo es `getActiveAutomaticDefinitions`.
// Por eso esta funcion ya no recibe las fechas del periodo: no tiene nada que comparar con ellas.
// LAS REGLAS DE UNA CONFIGURACION, CON EL AMBITO DE SU LINEA PEGADO.
//
// El ambito y el cargo YA NO ESTAN EN LA REGLA (frente 25, P10): eran cuatro copias de la linea. La
// regla conserva el afinado --`recipient_policy` y `position_id`-- y lo demas se lee de donde se
// declara, con los dos JOIN que la consulta ya necesitaba para llegar a la obligacion.
//
// Los campos de la linea van con PREFIJO `linea_` a proposito: desde aqui se lee hacia abajo, y una
// `cargo_id` a secas no diria de quien es. El unico consumidor es `getPositionsForRule`.
//
// Y SIN `ORDER BY priority`: la columna se fue con las copias porque no ordenaba nada. Las reglas de
// una configuracion se UNEN --sus resultados se acumulan por puesto, sin mirar de que regla vienen--
// asi que el orden de evaluacion no cambia el resultado. Queda `id` para que la salida sea estable.
export const getTargetRulesMap = async (connection) => {
  const [rows] = await connection.query(
    `SELECT
       ptr.id,
       ptr.process_definition_id,
       ptr.position_id,
       ptr.recipient_policy,
       lin.unit_scope_type AS linea_unit_scope_type,
       lin.unit_id         AS linea_unit_id,
       lin.unit_type_id    AS linea_unit_type_id,
       lin.cargo_id        AS linea_cargo_id
     FROM process_target_rules ptr
     INNER JOIN process_definition_versions pdv ON pdv.id = ptr.process_definition_id
     INNER JOIN lineas lin ON lin.id = pdv.linea_id
     ORDER BY ptr.process_definition_id, ptr.id ASC`
  );
  const map = new Map();
  rows.forEach((row) => {
    if (!map.has(row.process_definition_id)) {
      map.set(row.process_definition_id, []);
    }
    map.get(row.process_definition_id).push(row);
  });
  return map;
};

export const getExecutableTemplatesMap = async (connection) => {
  const [rows] = await connection.query(
    `SELECT
       pdt.id,
       pdt.process_definition_id,
       pdt.edicion_id,
       pdt.sort_order,
       pdt.item_mode
     FROM vinculos pdt
     ORDER BY pdt.process_definition_id ASC, pdt.sort_order ASC, pdt.id ASC`
  );
  const map = new Map();
  rows.forEach((row) => {
    if (!map.has(row.process_definition_id)) {
      map.set(row.process_definition_id, []);
    }
    map.get(row.process_definition_id).push(row);
  });
  return map;
};

export const getExistingAutomaticTasksMap = async (connection, termId) => {
  const [rows] = await connection.query(
    `SELECT t.id, t.process_definition_id, t.process_run_id,
            t.scope_unit_id AS responsible_unit_id
     FROM tasks t
     WHERE t.term_id = ?`,
    [termId]
  );
  // Map<def_id, Map<unit_id, task>>  (unit_id=0 for legacy tasks with no responsible position)
  const map = new Map();
  rows.forEach((row) => {
    if (!map.has(row.process_definition_id)) {
      map.set(row.process_definition_id, new Map());
    }
    const unitKey = row.responsible_unit_id ?? 0;
    const byUnit = map.get(row.process_definition_id);
    if (!byUnit.has(unitKey)) {
      byUnit.set(unitKey, {
        id: row.id,
        process_run_id: row.process_run_id,
        process_definition_id: row.process_definition_id
      });
    }
  });
  return map;
};

export const getExistingTasksByUnitForDefinition = async (connection, definitionId, termId) => {
  const [rows] = await connection.query(
    `SELECT t.id, t.process_run_id,
            t.scope_unit_id AS responsible_unit_id
     FROM tasks t
     WHERE t.process_definition_id = ? AND t.term_id = ?`,
    [definitionId, termId]
  );
  const byUnit = new Map();
  rows.forEach((row) => {
    const unitKey = row.responsible_unit_id ?? 0;
    if (!byUnit.has(unitKey)) {
      byUnit.set(unitKey, { id: row.id, process_run_id: row.process_run_id });
    }
  });
  return byUnit;
};

export const getActiveRunForDefinitionTerm = async (connection, definitionId, termId) => {
  const [rows] = await connection.query(
    `SELECT id, run_mode
     FROM process_runs
     WHERE process_definition_id = ? AND term_id <=> ? AND status = 'active'
     ORDER BY id DESC
     LIMIT 1`,
    [definitionId, termId]
  );
  return rows?.[0] || null;
};

export const getDocumentVersionFillContext = async (connection, documentVersionId) => {
  const [rows] = await connection.query(
    `SELECT
       dv.id AS document_version_id,
       dv.task_item_id,
       dv.status AS document_version_status,
       ti.document_status,
       ti.vinculo_id,
       ti.assigned_person_id AS task_item_assigned_person_id,
       ti.responsible_position_id AS task_item_responsible_position_id,
       ti.created_by_person_id AS item_created_by_person_id,
       COALESCE(ti.target_unit_id, up_item.unit_id, t.scope_unit_id) AS scope_unit_id
     -- "scope_unit_type_id" y sus tres JOIN a "units" salieron en el paso 3b de la fase 4 del
     -- frente 24: lo leia la rama "unit_type" de resolveScopeForStep, y ese ambito murio con el
     -- JSONB "signers". Ningun ambito del participante mira el tipo de unidad.
     FROM document_versions dv
     LEFT JOIN task_items ti ON ti.id = dv.task_item_id
     LEFT JOIN tasks t ON t.id = ti.task_id
     LEFT JOIN unit_positions up_item ON up_item.id = ti.responsible_position_id
     WHERE dv.id = ?
     LIMIT 1`,
    [documentVersionId]
  );
  return rows?.[0] || null;
};

// AQUI VIVIAN `getActiveFillFlowTemplateForDefinitionTemplate` y `getFillFlowSteps`, los DOS pasos
// con que se resolvia la receta de entrega: primero la cabecera del origen, despues sus pasos. Las
// dos murieron en la fase 4 del frente 24.
//
// Sin cabecera, el paso lleva su propio origen y la receta se lee de UNA consulta. Y la resolucion
// por escalones --la del entregable primero, la de la edicion despues-- ya no esta duplicada entre
// este fichero y `DocumentSignatureWorkflowService`: vive una sola vez, en `resolverReceta`
// (`dominios/plantillas/datos/recetaDelRecorrido.js`), y sirve a los dos lados.

export const resolveCurrentPersonsForPosition = async (connection, positionId) => {
  if (!positionId) {
    return [];
  }
  const [rows] = await connection.query(
    `SELECT DISTINCT pa.person_id
     FROM position_assignments pa
     WHERE pa.position_id = ?
       AND pa.is_current = 1
       AND pa.person_id IS NOT NULL
     ORDER BY pa.person_id ASC`,
    [positionId]
  );
  return rows.map((row) => Number(row.person_id)).filter(Boolean);
};

export const getPositionsForRule = async (connection, rule) => {
  const useExactPosition = rule.position_id || rule.recipient_policy === "exact_position";
  if (useExactPosition && !rule.position_id) {
    return [];
  }

  const params = [];
  let query = `
    SELECT DISTINCT
      up.id AS position_id,
      up.unit_id,
      up.is_unit_head,
      pa.person_id,
      up.slot_no
    FROM unit_positions up
    INNER JOIN units u ON u.id = up.unit_id
    LEFT JOIN position_assignments pa
      ON pa.position_id = up.id
     AND pa.is_current = 1
    WHERE up.is_active = 1
      AND u.is_active = 1`;

  if (useExactPosition) {
    query += "\n      AND up.id = ?";
    params.push(rule.position_id);
  } else {
    // EL CARGO Y EL AMBITO SALEN DE LA LINEA, no de la regla (frente 25, P10). Antes la regla
    // llevaba su copia y esto leia `rule.cargo_id`; hoy `getTargetRulesMap` los trae con prefijo.
    if (rule.linea_cargo_id) {
      query += "\n      AND up.cargo_id = ?";
      params.push(rule.linea_cargo_id);
    }

    // AQUI VIVIA LA RAMA `unit_subtree`, con una CTE RECURSIVA sin proteccion de ciclos. Se fue
    // con el valor (frente 25, P19): un subarbol cruza tipos de unidad y por tanto cargos, que es
    // incompatible con una obligacion que fija UN cargo.
    if (rule.linea_unit_scope_type === "unit_exact") {
      if (!rule.linea_unit_id) {
        return [];
      }
      query += "\n      AND up.unit_id = ?";
      params.push(rule.linea_unit_id);
    } else if (rule.linea_unit_scope_type === "unit_type") {
      if (!rule.linea_unit_type_id) {
        return [];
      }
      query += "\n      AND u.unit_type_id = ?";
      params.push(rule.linea_unit_type_id);
    }
  }

  query += "\n    ORDER BY up.unit_id ASC, up.slot_no ASC, up.id ASC";
  const [rows] = await connection.query(query, params);
  return applyRecipientPolicy(rows, rule.recipient_policy, rule.position_id);
};

export const getExistingTaskItemTemplateIds = async (connection, taskId) => {
  const [rows] = await connection.query(
    `SELECT vinculo_id
     FROM task_items
     WHERE task_id = ?
       AND origin_kind = 'process_defined'
       AND responsible_position_id IS NULL`,
    [taskId]
  );
  return new Set(rows.map((row) => Number(row.vinculo_id)));
};

export const getExistingTaskItemTargetKeys = async (connection, taskId) => {
  const [rows] = await connection.query(
    // La clave de idempotencia es la MISMA que la identidad del entregable: tarea, plantilla y
    // QUIEN LO PRODUCE. Antes iba por los dos destinos —el receptor—, que es el eje equivocado
    // desde que el dueño decidio «un entregable por persona que lo entrega» (2026-08-23).
    `SELECT
       vinculo_id,
       COALESCE(responsible_position_id, 0) AS responsible_position_id
     FROM task_items
     WHERE task_id = ?
       AND origin_kind = 'process_defined'`,
    [taskId]
  );
  return new Set(rows.map((row) => [
    Number(row.vinculo_id || 0),
    Number(row.responsible_position_id || 0)
  ].join(":")));
};

// Fila que consume `ensureDocumentForTaskItem`. `responsible_position_id` es el DEL ENTREGABLE
// (`ti.`), no el de la tarea: es lo que `resolveOwnerPersonIdForTaskItem` cree estar leyendo cuando
// busca el ocupante en `task_assignments`. Proyectar `t.responsible_position_id` eclipsaba la
// columna homónima del ítem y le daba el puesto de la TAREA, con lo que todo entregable dirigido a
// un puesto distinto del de su tarea heredaba el dueño equivocado. El otro alimentador del mismo
// resolver (`GeneralTaskService.loadDerivedTaskItemRow`) siempre proyectó `ti.`; esta es la forma
// que los iguala. El respaldo a nivel de tarea ya existe aguas abajo (rama 4 del resolver, y rama 2
// de `resolveOriginUnitIdForTaskItem`), así que aquí no hace falta ningún COALESCE.
export const getTaskItemsForDocumentMaterialization = async (connection, taskId) => {
  const [rows] = await connection.query(
    `SELECT
       ti.id,
       ti.task_id,
       ti.vinculo_id,
       pdt.edicion_id,
       ti.assigned_person_id,
       ti.target_unit_id,
       ti.responsible_position_id,
       tar_dl.display_name AS template_artifact_name
     FROM task_items ti
     LEFT JOIN vinculos pdt ON pdt.id = ti.vinculo_id
     LEFT JOIN ediciones tar ON tar.id = pdt.edicion_id
     LEFT JOIN catalogo_documental tar_dl ON tar_dl.id = tar.catalogo_documental_id
     WHERE ti.task_id = ?
     ORDER BY ti.sort_order ASC, ti.id ASC`,
    [taskId]
  );
  return rows;
};

// `getTaskAssignmentTargets` VIVIO AQUI hasta el 2026-08-23. Leia `task_assignments` para devolver
// los puestos que `launch.js` acababa de escribir en ella dos lineas antes. Con la tabla retirada,
// `resolveTaskTargetsForDefinition` devuelve esos mismos puestos sin pasar por la base.
