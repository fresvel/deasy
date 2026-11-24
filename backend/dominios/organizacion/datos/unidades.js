// LAS UNIDADES y las aristas que las unen: el grafo del organigrama.
//
// Sólo SQL. Las reglas —que una arista no cierre un ciclo, que el nombre sea obligatorio, que el slug
// repetido se traduzca a un 409— viven en `services/orgStructure.js`, que es quien llama aquí.
//
// Vive en `datos/` y no en `datos/consulta/` porque sus consultas nombran **sólo** tablas de
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
            (SELECT COUNT(*) FROM unit_positions p WHERE p.unit_id = u.id AND puesto_rige(p.id)) AS positions_count,
            (SELECT COUNT(*) FROM unit_positions p
               INNER JOIN position_assignments pa ON pa.position_id = p.id AND pa.is_current = 1
              WHERE p.unit_id = u.id AND puesto_rige(p.id)) AS occupied_count,
            (SELECT COUNT(*) FROM unit_positions p WHERE p.unit_id = u.id AND p.is_unit_head = 1 AND puesto_rige(p.id)) AS head_count,
            -- LOS PUESTOS EN BORRADOR: creados, pero sin ninguna vida. Las tres cuentas de arriba solo
            -- ven los que rigen, asi que un borrador no salia en el nodo y no habia como encontrarlo.
            (SELECT COUNT(*) FROM unit_positions p
              WHERE p.unit_id = u.id
                AND NOT EXISTS (SELECT 1 FROM position_vigencias pv WHERE pv.position_id = p.id)) AS draft_positions_count
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

// LAS EQUIVALENCIAS DE UNA UNIDAD (frente 27, D-05), en los dos sentidos. `sucesores` cuelga de cada
// vida que terminó —varios es una división—; `antecesores`, de la unidad que recibe —varios es una
// fusión—. Desde cuándo vale es la fecha de fin de la vida que termina: la equivalencia no la repite.
export const listarSucesoresDeLaUnidad = async (ejecutor, unitId) => {
  const [filas] = await ejecutor.query(
    `SELECT e.id, e.antecesor_vigencia_id, e.sucesor_unit_id AS nodo_id, s.name AS nombre
       FROM unit_equivalencias e
       INNER JOIN unit_vigencias uv ON uv.id = e.antecesor_vigencia_id
       INNER JOIN units s ON s.id = e.sucesor_unit_id
      WHERE uv.unit_id = ?
      ORDER BY s.name ASC`,
    [unitId]
  );
  return filas ?? [];
};

export const listarAntecesoresDeLaUnidad = async (ejecutor, unitId) => {
  const [filas] = await ejecutor.query(
    `SELECT e.id, uv.unit_id AS nodo_id, a.name AS nombre, uv.vigente_hasta::text AS desde
       FROM unit_equivalencias e
       INNER JOIN unit_vigencias uv ON uv.id = e.antecesor_vigencia_id
       INNER JOIN units a ON a.id = uv.unit_id
      WHERE e.sucesor_unit_id = ?
      ORDER BY uv.vigente_hasta DESC, a.name ASC`,
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

// Las aristas QUE SE DIBUJAN, filtradas por tipo de relación: una por hijo, la que cuenta hoy —la
// que rige; si no, la programada; si no, el borrador; si no, la última que tuvo—. Sale de la vista
// unit_relacion_actual. `codigo` vacío o "all" devuelve todas; cualquier otro valor se compara contra
// `relation_unit_types.code`, nunca se interpola.
export const listarAristasDelGrafo = async (ejecutor, codigo) => {
  let sql =
    `SELECT ur.id, ur.parent_unit_id, ur.child_unit_id, ur.relation_type_id, rt.code AS relation_type_code,
            ur.vigente_desde::text AS vigente_desde, ur.vigente_hasta::text AS vigente_hasta, ur.estado,
            -- EL CAMBIO QUE YA ESTA PROGRAMADO: de quien dependera despues. Sin esto, tras fechar un
            -- cambio a futuro el organigrama seguiria dibujando el padre de hoy sin decir nada.
            prox.parent_unit_id AS proximo_padre_id, prox.desde AS proximo_padre_desde
     FROM unit_relacion_actual ur
     INNER JOIN relation_unit_types rt ON rt.id = ur.relation_type_id
     LEFT JOIN LATERAL (
       SELECT sig.parent_unit_id, sig.vigente_desde::text AS desde
         FROM unit_relations sig
        WHERE sig.child_unit_id = ur.child_unit_id AND sig.relation_type_id = ur.relation_type_id
          AND sig.vigente_desde > CURRENT_DATE AND sig.id <> ur.id
        ORDER BY sig.vigente_desde ASC
        LIMIT 1
     ) prox ON TRUE`;
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
//
// Mira las aristas QUE NO HAN TERMINADO —las que rigen, las programadas y los borradores—: son las
// que pueden coincidir en el tiempo con la nueva. Una que ya se cerró no cierra ningún ciclo.
export const existeCaminoEntreUnidades = async (ejecutor, desdeUnitId, hastaUnitId, relationTypeId) => {
  const [filas] = await ejecutor.query(
    `WITH RECURSIVE descendants AS (
       SELECT child_unit_id FROM unit_relations
        WHERE parent_unit_id = ? AND relation_type_id = ?
          AND (vigente_hasta IS NULL OR vigente_hasta > CURRENT_DATE)
       UNION
       SELECT ur.child_unit_id FROM unit_relations ur
       INNER JOIN descendants d ON ur.parent_unit_id = d.child_unit_id
        WHERE ur.relation_type_id = ?
          AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > CURRENT_DATE)
     )
     SELECT 1 FROM descendants WHERE child_unit_id = ? LIMIT 1`,
    [desdeUnitId, relationTypeId, relationTypeId, hastaUnitId]
  );
  return filas.length > 0;
};

// LA ARISTA QUE CUENTA HOY para una unidad en un tipo de relación, y si la unidad rige. Es lo que
// necesita `planDeMovimiento` para decidir si mover es reemparejar o cerrar y abrir.
export const aristaActualDeLaUnidad = async (ejecutor, childUnitId, relationTypeId) => {
  const [filas] = await ejecutor.query(
    `SELECT ur.id, ur.parent_unit_id AS "padreId", ur.estado, ur.vigente_desde::text AS vigente_desde
       FROM unit_relacion_actual ur
      WHERE ur.child_unit_id = ? AND ur.relation_type_id = ?`,
    [childUnitId, relationTypeId]
  );
  return filas[0] ?? null;
};

// ¿Tiene la unidad una vida EN CURSO —que rige o que está programada—? No es lo mismo que «rige
// hoy»: una unidad programada ya tiene su fecha, y una relación sin fecha no arrancaría nunca,
// porque lo que pone en marcha un borrador de relación es que se ABRA la vida.
export const laUnidadTieneVidaEnCurso = async (ejecutor, unitId) => {
  const [filas] = await ejecutor.query(
    `SELECT EXISTS (
       SELECT 1 FROM unit_vigencias uv
        WHERE uv.unit_id = ? AND (uv.vigente_hasta IS NULL OR uv.vigente_hasta > CURRENT_DATE)
     ) AS en_curso`,
    [unitId]
  );
  return Boolean(filas[0]?.en_curso);
};

export const reemparejarRelacion = async (ejecutor, relationId, parentUnitId) => {
  await ejecutor.query(`UPDATE unit_relations SET parent_unit_id = ? WHERE id = ?`, [parentUnitId, relationId]);
};

export const cerrarRelacion = async (ejecutor, relationId, { hasta, origen, actoId }) => {
  await ejecutor.query(
    `UPDATE unit_relations SET vigente_hasta = ?, fin_origen = ?, fin_acto_id = ? WHERE id = ?`,
    [hasta, origen, actoId, relationId]
  );
};

export const borrarRelacion = async (ejecutor, relationId) => {
  await ejecutor.query(`DELETE FROM unit_relations WHERE id = ?`, [relationId]);
};

export const insertarUnidad = async (ejecutor, { name, label, slug, unitTypeId }) => {
  const [resultado] = await ejecutor.query(
    // NACE EN BORRADOR (frente 27, D-03): sin ninguna vida. Ponerla en vigor es un paso aparte.
    "INSERT INTO units (name, label, slug, unit_type_id) VALUES (?, ?, ?, ?)",
    [name, label, slug, unitTypeId]
  );
  return Number(resultado.insertId);
};

// Sin fecha la relación nace en BORRADOR, que es como nace la unidad: empezará a regir con ella.
export const insertarRelacion = async (
  ejecutor,
  { relationTypeId, parentUnitId, childUnitId, desde = null, origen = null, actoId = null }
) => {
  const [resultado] = await ejecutor.query(
    `INSERT INTO unit_relations
       (relation_type_id, parent_unit_id, child_unit_id, vigente_desde, inicio_origen, inicio_acto_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [relationTypeId, parentUnitId, childUnitId, desde, origen, actoId]
  );
  return Number(resultado.insertId);
};
