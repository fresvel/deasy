// QUÉ PROCESOS LE TOCAN A UNA UNIDAD, y a cuáles se la puede enganchar.
//
// ⚠️ `datos/consulta/` porque CRUZA a `procesos` (`process_target_rules`,
// `process_definition_versions`, `processes`, `process_definition_series`) y a `identidad`
// (`cargos`). De `organizacion` sólo nombra `unit_positions`.
//
// ⚠️ Y cruza HACIA ARRIBA: `units` es nivel 2 y `process_target_rules` es nivel 4. Eso es legal y no
// contradice la regla del nivel, que es del ESQUEMA —ninguna clave ajena sube— y no del código: una
// lectura puede preguntar en cualquier dirección.

// Las reglas de alcance que alcanzan a esta unidad, por tres caminos distintos, y la columna `origin`
// dice por cuál: directamente por `unit_id`, por su TIPO de unidad, o por ser de alcance global.
// Se devuelven las tres juntas porque la pantalla las muestra en una sola lista ordenada.
export const listarProcesosQueAlcanzanLaUnidad = async (ejecutor, unitId, unitTypeId) => {
  const [filas] = await ejecutor.query(
    `SELECT
            ptr.id AS rule_id,
            pdv.id AS definition_id,
            p.name AS process_name,
            pdv.name AS definition_name,
            pdv.definition_version,
            pdv.variation_key,
            pdv.status,
            ptr.unit_scope_type,
            ptr.recipient_policy,
            ptr.priority,
            ptr.is_active AS rule_active,
            ptr.unit_id,
            ptr.unit_type_id,
            ptr.cargo_id,
            ptr.position_id,
            c.name AS cargo_name,
            up.title AS position_title,
            upc.name AS position_cargo_name,
            CASE
              WHEN ptr.unit_id = ? THEN 'direct'
              WHEN ptr.unit_type_id IS NOT NULL AND ptr.unit_type_id = ? THEN 'type'
              WHEN ptr.unit_scope_type = 'all_units' THEN 'global'
              ELSE 'other'
            END AS origin
     FROM process_target_rules ptr
     INNER JOIN process_definition_versions pdv ON pdv.id = ptr.process_definition_id
     INNER JOIN processes p ON p.id = pdv.process_id
     LEFT JOIN cargos c ON c.id = ptr.cargo_id
     LEFT JOIN unit_positions up ON up.id = ptr.position_id
     LEFT JOIN cargos upc ON upc.id = up.cargo_id
     WHERE ptr.unit_id = ?
        OR (ptr.unit_type_id IS NOT NULL AND ptr.unit_type_id = ?)
        OR ptr.unit_scope_type = 'all_units'
     ORDER BY (ptr.unit_id = ?) DESC,
              FIELD(pdv.status, 'active', 'draft', 'retired'),
              p.name ASC, pdv.definition_version DESC`,
    [unitId, unitTypeId, unitId, unitTypeId, unitId]
  );
  return filas ?? [];
};

// Configuraciones a las que se PUEDE enganchar esta unidad con una regla nueva. Dos filtros, y los
// dos son del modelo de procesos, no de la unidad:
// 1) sólo las que están en 'draft' — activar congela el diseño, y cambiar el alcance exige una
//    versión nueva;
// 2) sólo las variaciones por cargo o default — una variación por tipo de unidad fija el alcance a
//    'unit_type' con `unit_id` NULL y ya aplica a todas las unidades de su tipo, así que acotarla a
//    una unidad no significa nada.
export const listarProcesosEnganchables = async (ejecutor) => {
  const [filas] = await ejecutor.query(
    `SELECT pdv.id AS definition_id,
            p.name AS process_name,
            pdv.name AS definition_name,
            pdv.definition_version,
            pdv.variation_key,
            pds.source_type AS series_source_type,
            pds.cargo_id AS series_cargo_id,
            c.name AS series_cargo_name
       FROM process_definition_versions pdv
       INNER JOIN processes p ON p.id = pdv.process_id
       INNER JOIN process_definition_series pds ON pds.id = pdv.series_id
       LEFT JOIN cargos c ON c.id = pds.cargo_id
      WHERE pdv.status = 'draft'
        AND pds.source_type <> 'unit_type'
      ORDER BY p.name ASC, pdv.definition_version DESC`
  );
  return filas ?? [];
};
