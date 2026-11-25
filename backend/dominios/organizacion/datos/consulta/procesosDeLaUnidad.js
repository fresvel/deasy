// QUÉ PROCESOS LE TOCAN A UNA UNIDAD, y a cuáles se la puede enganchar.
//
// ⚠️ `datos/consulta/` porque CRUZA a `procesos` (`process_target_rules`,
// `process_definition_versions`, `processes`, `lineas` y `cargos` (antes la series`) y a `identidad`
// (`cargos`). De `organizacion` sólo nombra `unit_positions`.
//
// ⚠️ Y cruza HACIA ARRIBA: `units` es nivel 2 y `process_target_rules` es nivel 4. Eso es legal y no
// contradice la regla del nivel, que es del ESQUEMA —ninguna clave ajena sube— y no del código: una
// lectura puede preguntar en cualquier dirección.

// Las reglas de alcance que alcanzan a esta unidad, por tres caminos distintos, y la columna `origin`
// dice por cuál: directamente por `unit_id`, por su TIPO de unidad, o por ser de alcance global.
// Se devuelven las tres juntas porque la pantalla las muestra en una sola lista ordenada.
export const listarProcesosQueAlcanzanLaUnidad = async (ejecutor, unitId, unitTypeId) => {
  // ⚠️ EL AMBITO SE LEE DE `lineas`, NO DE LA REGLA, y es el cambio de `P10` (2026-10-14).
  //
  // `unit_scope_type`, `unit_id`, `unit_type_id` y `cargo_id` estaban TAMBIEN en
  // `process_target_rules`, como copia — y este fichero fue la prueba de comportamiento de que la
  // copia hacia dano: esta consulta leia `ptr.unit_scope_type` y `ptr.cargo_id` mientras
  // `listarProcesosEnganchables`, treinta lineas mas abajo, leia `lin.*` para preguntar LO MISMO.
  // Dos sitios donde mirar, dos respuestas posibles, y nada que garantizara que coincidieran: el
  // guardia blindaba el cargo y el tipo, pero `unit_id` lo leia y no lo usaba nunca.
  //
  // El `INNER JOIN lineas` ya estaba aqui (era `LEFT`, por el nombre de la linea), asi que leer
  // bien no cuesta un salto mas. Pasa a `INNER` porque `linea_id` es `NOT NULL`: un `LEFT` prometia
  // una fila sin linea que el modelo no permite, y con el ambito colgando de ahi habria dado NULL
  // en el `CASE` en vez de 'global'.
  //
  // Y DESDE `P26` LA CONSULTA ARRANCA EN LA CONFIGURACION, no en la regla: `process_target_rules` se
  // retiro entera y `recipient_policy` es de la linea. `rule_id` se conserva como identificador de
  // la fila --lo usa la pantalla-- y hoy es el de la configuracion.
  const [filas] = await ejecutor.query(
    `SELECT
            pdv.id AS rule_id,
            pdv.id AS definition_id,
            p.name AS process_name,
            nombre_configuracion(lin.nombre, pdv.definition_version) AS definition_name,
            pdv.definition_version,
            pdv.linea_id,
            lin.nombre AS linea_nombre,
            pdv.status,
            -- el ambito sale de la LINEA (frente 25, P10); ver la cabecera de la funcion
            lin.unit_scope_type,
            lin.unit_id,
            lin.unit_type_id,
            lin.cargo_id,
            lin.recipient_policy,
            c.name AS cargo_name,
            CASE
              WHEN lin.unit_id = ? THEN 'direct'
              WHEN lin.unit_type_id IS NOT NULL AND lin.unit_type_id = ? THEN 'type'
              WHEN lin.unit_scope_type = 'all_units' THEN 'global'
              ELSE 'other'
            END AS origin
     FROM process_definition_versions pdv
     INNER JOIN lineas lin ON lin.id = pdv.linea_id
     INNER JOIN processes p ON p.id = lin.process_id
     LEFT JOIN cargos c ON c.id = lin.cargo_id
     WHERE lin.unit_id = ?
        OR (lin.unit_type_id IS NOT NULL AND lin.unit_type_id = ?)
        OR lin.unit_scope_type = 'all_units'
     ORDER BY (lin.unit_id = ?) DESC,
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
            nombre_configuracion(lin.nombre, pdv.definition_version) AS definition_name,
            pdv.definition_version,
            pdv.linea_id,
            lin.nombre AS linea_nombre,
            lin.unit_scope_type,
            lin.cargo_id AS linea_cargo_id,
            c.name AS linea_cargo_name
       FROM process_definition_versions pdv
       INNER JOIN lineas lin ON lin.id = pdv.linea_id
       INNER JOIN processes p ON p.id = lin.process_id
       LEFT JOIN cargos c ON c.id = lin.cargo_id
      WHERE pdv.status = 'draft'
        AND lin.unit_scope_type <> 'unit_type'
      ORDER BY p.name ASC, pdv.definition_version DESC`
  );
  return filas ?? [];
};
