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
    `SELECT u.id, u.name, u.label, u.slug, u.unit_type_id, ut.name AS unit_type_name, u.is_active,
            (SELECT COUNT(*) FROM unit_positions p WHERE p.unit_id = u.id AND p.is_active = 1) AS positions_count,
            (SELECT COUNT(*) FROM unit_positions p
               INNER JOIN position_assignments pa ON pa.position_id = p.id AND pa.is_current = 1
              WHERE p.unit_id = u.id AND p.is_active = 1) AS occupied_count,
            (SELECT COUNT(*) FROM unit_positions p WHERE p.unit_id = u.id AND p.is_unit_head = 1 AND p.is_active = 1) AS head_count
     FROM units u
     LEFT JOIN unit_types ut ON ut.id = u.unit_type_id
     ORDER BY u.id ASC`
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
    "INSERT INTO units (name, label, slug, unit_type_id, is_active) VALUES (?, ?, ?, ?, 1)",
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
