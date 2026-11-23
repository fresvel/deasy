// LAS UNIDADES y las aristas que las unen: el grafo del organigrama.
//
// Sólo SQL. Las reglas —que una arista no cierre un ciclo, que el nombre sea obligatorio, que el slug
// repetido se traduzca a un 409— viven en `services/orgStructure.js`, que es quien llama aquí.
//
// Vive en `datos/` y no en `datos/consulta/` porque las cuatro consultas nombran **sólo** tablas de
// `organizacion`: `units`, `unit_types`, `unit_relations`, `relation_unit_types`, `unit_positions`,
// `position_assignments`. Lo comprueba la comprobación **E**.
//
// ⚠️ `ejecutor` es el pool o una conexión en transacción, y aquí importa: `insertarUnidad` e
// `insertarRelacion` se llaman **las dos dentro de la misma transacción** —una unidad creada sin su
// arista queda flotando en el organigrama—, y es el servicio quien la abre con `conTransaccion`.

// Los nodos, con tres contadores que la vista pinta como insignias: cuántos puestos tiene la unidad,
// cuántos de ellos están ocupados y si tiene jefatura. Van como subconsultas y no como JOIN con
// GROUP BY porque son tres agregados independientes sobre la misma tabla.
export const listarNodosDelGrafo = async (ejecutor) => {
  const [filas] = await ejecutor.query(
    `SELECT u.id, u.name, u.label, u.slug, u.unit_type_id, ut.name AS unit_type_name,
            -- LA VIGENCIA sale de la vista unit_vigencia_actual: el periodo que cuenta hoy. Sin fila
            -- alli la unidad no ha regido nunca y es un borrador. Las fechas van como TEXTO.
            v.vigencia_id, v.vigente_desde::text AS vigente_desde, v.vigente_hasta::text AS vigente_hasta,
            v.inicio_origen, v.inicio_acto_id, v.fin_origen, v.fin_acto_id,
            COALESCE(v.estado, 'borrador') AS estado,
            (SELECT COUNT(*) FROM unit_positions p WHERE p.unit_id = u.id AND p.is_active = 1) AS positions_count,
            (SELECT COUNT(*) FROM unit_positions p
               INNER JOIN position_assignments pa ON pa.position_id = p.id AND pa.is_current = 1
              WHERE p.unit_id = u.id AND p.is_active = 1) AS occupied_count,
            (SELECT COUNT(*) FROM unit_positions p WHERE p.unit_id = u.id AND p.is_unit_head = 1 AND p.is_active = 1) AS head_count
     FROM units u
     LEFT JOIN unit_types ut ON ut.id = u.unit_type_id
     LEFT JOIN unit_vigencia_actual v ON v.unit_id = u.id
     ORDER BY u.id ASC`
  );
  return filas ?? [];
};

// TODAS LAS VIDAS de una unidad, la más reciente primero: la historia que enseña la pestaña
// «Vigencia» del organigrama, con el número del acto de cada extremo para no pedir otra consulta.
export const listarVidasDeLaUnidad = async (ejecutor, unitId) => {
  const [filas] = await ejecutor.query(
    `SELECT uv.id, uv.vigente_desde::text AS vigente_desde, uv.vigente_hasta::text AS vigente_hasta,
            uv.inicio_origen, uv.inicio_acto_id, ai.numero AS inicio_acto_numero,
            uv.fin_origen, uv.fin_acto_id, af.numero AS fin_acto_numero,
            estado_de_vigencia(uv.vigente_desde, uv.vigente_hasta) AS estado
       FROM unit_vigencias uv
       LEFT JOIN actos ai ON ai.id = uv.inicio_acto_id
       LEFT JOIN actos af ON af.id = uv.fin_acto_id
      WHERE uv.unit_id = ?
      ORDER BY uv.vigente_desde DESC`,
    [unitId]
  );
  return filas ?? [];
};

export const listarTiposDeRelacion = async (ejecutor) => {
  const [filas] = await ejecutor.query(
    "SELECT id, code, name FROM relation_unit_types ORDER BY id ASC"
  );
  return filas ?? [];
};

// Las aristas, filtradas por tipo de relación. `codigo` vacío o "all" devuelve todas; cualquier otro
// valor se compara contra `relation_unit_types.code`, nunca se interpola.
export const listarAristasDelGrafo = async (ejecutor, codigo) => {
  let sql =
    `SELECT ur.id, ur.parent_unit_id, ur.child_unit_id, ur.relation_type_id, rt.code AS relation_type_code
     FROM unit_relations ur
     INNER JOIN relation_unit_types rt ON rt.id = ur.relation_type_id`;
  const params = [];
  const code = String(codigo || "").trim();
  if (code && code !== "all") {
    sql += " WHERE rt.code = ?";
    params.push(code);
  }
  sql += " ORDER BY ur.id ASC";
  const [filas] = await ejecutor.query(sql, params);
  return filas ?? [];
};

// ¿Es `parentUnitId` ya descendiente de `childUnitId` dentro de ESE tipo de relación? Si lo es, la
// arista nueva cerraría un ciclo. CTE recursiva acotada al tipo: el organigrama y, digamos, la
// dependencia funcional son dos grafos distintos sobre las mismas unidades, y un ciclo en uno no
// dice nada del otro.
export const existeCaminoEntreUnidades = async (ejecutor, desdeUnitId, hastaUnitId, relationTypeId) => {
  const [filas] = await ejecutor.query(
    `WITH RECURSIVE descendants AS (
       SELECT child_unit_id FROM unit_relations
        WHERE parent_unit_id = ? AND relation_type_id = ?
       UNION ALL
       SELECT ur.child_unit_id FROM unit_relations ur
       INNER JOIN descendants d ON ur.parent_unit_id = d.child_unit_id
        WHERE ur.relation_type_id = ?
     )
     SELECT 1 FROM descendants WHERE child_unit_id = ? LIMIT 1`,
    [desdeUnitId, relationTypeId, relationTypeId, hastaUnitId]
  );
  return filas.length > 0;
};

export const insertarUnidad = async (ejecutor, { name, label, slug, unitTypeId }) => {
  const [resultado] = await ejecutor.query(
    // NACE EN BORRADOR (frente 27, D-03): sin ninguna vida. Ponerla en vigor es un paso aparte.
    "INSERT INTO units (name, label, slug, unit_type_id) VALUES (?, ?, ?, ?)",
    [name, label, slug, unitTypeId]
  );
  return Number(resultado.insertId);
};

export const insertarRelacion = async (ejecutor, { relationTypeId, parentUnitId, childUnitId }) => {
  const [resultado] = await ejecutor.query(
    "INSERT INTO unit_relations (relation_type_id, parent_unit_id, child_unit_id) VALUES (?, ?, ?)",
    [relationTypeId, parentUnitId, childUnitId]
  );
  return Number(resultado.insertId);
};
