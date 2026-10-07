// LA PERSONA CON SUS CLAVES RESUELTAS: nacionalidad, correo principal y documento principal.
//
// ⚠️ `datos/consulta/` porque CRUZA a `paises` (de **organizacion**) y, en la búsqueda, a toda la
// estructura organizativa —`position_assignments`, `unit_positions`, `units`, `unit_types`—.
//
// ⚠️ LAS TRES PRIMERAS SON LA MISMA PROYECCIÓN CON TRES FILTROS, y están escritas tres veces A
// PROPÓSITO. Componerlas desde una constante las dejaría empezando por `${…}`, y entonces
// `check:sql-aliases` —que sólo analiza sentencias completas— dejaría de verlas: tres consultas que
// hoy vigila pasarían a ser cero. Mover código no es rescribirlo, y aquí el duplicado compra
// vigilancia.

export const personaPorId = async (ejecutor, id) => {
  const [filas] = await ejecutor.query(
    `SELECT p.*, na.iso_alpha2 AS nacionalidad, na.name AS nacionalidad_nombre,
            em.direccion AS email, em.verificado AS email_verificado, em.id AS email_id,
            di.numero AS cedula, di.verificado AS documento_verificado, di.tipo AS documento_tipo
     FROM persons p
     LEFT JOIN paises na ON na.id = p.nacionalidad_pais_id
     LEFT JOIN emails em ON em.person_id = p.id AND em.principal = 1 AND em.is_active = 1
     LEFT JOIN documentos_identidad di ON di.person_id = p.id AND di.principal = 1 AND di.is_active = 1
     WHERE p.id = ? LIMIT 1`,
    [id]
  );
  return filas?.[0] ?? null;
};

// POR AQUI ENTRA EL LOGIN. El correo se busca por CUALQUIERA de los suyos, no sólo el principal:
// quien se registró con el personal y luego declara el institucional debe poder seguir entrando con
// los dos. Lo que NO acepta es el número de documento — ver la nota del servicio, que cuenta por qué
// se quitó y por qué no se acotó.
export const personaPorCorreo = async (ejecutor, correo) => {
  const [filas] = await ejecutor.query(
    `SELECT p.*, na.iso_alpha2 AS nacionalidad, na.name AS nacionalidad_nombre,
            em.direccion AS email, em.verificado AS email_verificado, em.id AS email_id,
            di.numero AS cedula, di.verificado AS documento_verificado, di.tipo AS documento_tipo
     FROM persons p
     LEFT JOIN paises na ON na.id = p.nacionalidad_pais_id
     LEFT JOIN emails em ON em.person_id = p.id AND em.principal = 1 AND em.is_active = 1
     LEFT JOIN documentos_identidad di ON di.person_id = p.id AND di.principal = 1 AND di.is_active = 1
     WHERE EXISTS (SELECT 1 FROM emails e WHERE e.person_id = p.id AND e.direccion = ? AND e.is_active = 1) LIMIT 1`,
    [correo]
  );
  return filas?.[0] ?? null;
};

export const todasLasPersonas = async (ejecutor) => {
  const [filas] = await ejecutor.query(
    `SELECT p.*, na.iso_alpha2 AS nacionalidad, na.name AS nacionalidad_nombre,
            em.direccion AS email, em.verificado AS email_verificado, em.id AS email_id,
            di.numero AS cedula, di.verificado AS documento_verificado, di.tipo AS documento_tipo
     FROM persons p
     LEFT JOIN paises na ON na.id = p.nacionalidad_pais_id
     LEFT JOIN emails em ON em.person_id = p.id AND em.principal = 1 AND em.is_active = 1
     LEFT JOIN documentos_identidad di ON di.person_id = p.id AND di.principal = 1 AND di.is_active = 1
     ORDER BY p.created_at DESC`
  );
  return filas ?? [];
};

// La búsqueda del listado de /admin, con su unidad, su tipo de unidad y su cargo agrupados.
//
// ⚠️ El `WHERE` llega COMPUESTO desde el servicio, que es quien conoce los filtros y quien mete cada
// valor como parámetro. Aquí no se interpola ni un dato: `whereClause` sólo trae nombres de columna y
// `?`. Y los `GROUP_CONCAT` los traduce el adaptador a `string_agg` (`config/postgres.js`).
export const buscarPersonas = async (ejecutor, whereClause, params, limite) => {
  const [filas] = await ejecutor.query(
    `SELECT
       p.*,
       sdoc.numero AS cedula,
       semail.direccion AS email,
       GROUP_CONCAT(DISTINCT ut.id ORDER BY ut.name SEPARATOR ',') AS unit_type_ids,
       GROUP_CONCAT(DISTINCT ut.name ORDER BY ut.name SEPARATOR ' | ') AS unit_type_names,
       GROUP_CONCAT(DISTINCT u.id ORDER BY COALESCE(u.label, u.name) SEPARATOR ',') AS unit_ids,
       GROUP_CONCAT(DISTINCT COALESCE(u.label, u.name) ORDER BY COALESCE(u.label, u.name) SEPARATOR ' | ') AS unit_names,
       GROUP_CONCAT(DISTINCT c.id ORDER BY c.name SEPARATOR ',') AS cargo_ids,
       GROUP_CONCAT(DISTINCT c.name ORDER BY c.name SEPARATOR ' | ') AS cargo_names
     FROM persons p
     LEFT JOIN documentos_identidad sdoc
       ON sdoc.person_id = p.id AND sdoc.principal = 1 AND sdoc.is_active = 1
     LEFT JOIN emails semail
       ON semail.person_id = p.id AND semail.principal = 1 AND semail.is_active = 1
     LEFT JOIN position_assignments pa
       ON pa.person_id = p.id
      AND pa.is_current = 1
     LEFT JOIN unit_positions up
       ON up.id = pa.position_id
      AND up.is_active = 1
     LEFT JOIN units u
       ON u.id = up.unit_id
      AND u.is_active = 1
     LEFT JOIN unit_types ut
       ON ut.id = u.unit_type_id
     LEFT JOIN cargos c
       ON c.id = up.cargo_id
      AND c.is_active = 1
      ${whereClause}
     GROUP BY p.id, sdoc.numero, semail.direccion
      ORDER BY p.created_at DESC
      LIMIT ?`,
    [...params, limite]
  );
  return filas ?? [];
};
