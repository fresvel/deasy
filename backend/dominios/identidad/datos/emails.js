// LOS CORREOS de una persona (`emails`). Sólo SQL.
//
// Las dos garantías que esto sostiene —dirección única en todo el sistema, un principal por
// persona— las dan los índices `uq_emails_direccion` y `uq_emails_principal`, y QUIÉN decide el 400
// y el 409 antes de que hable PostgreSQL es `services/EmailService.js`. Aquí no hay reglas: ni
// normaliza la dirección ni elige el tipo. Lo recibe hecho.
//
// Vive en `datos/` porque nombra sólo `emails`, de `identidad`.

// ¿La dirección la tiene OTRA persona? Se pregunta antes de insertar porque el error del índice no
// le sirve a nadie; el mensaje lo pone el servicio.
export const otroDuenoDeLaDireccion = async (ejecutor, direccion, personId) => {
  const [filas] = await ejecutor.query(
    `SELECT id FROM emails WHERE direccion = ? AND person_id <> ? LIMIT 1`,
    [direccion, personId]
  );
  return filas?.length ? Number(filas[0].id) : null;
};

// El principal tal cual está, para decidir si la dirección cambia. SIN filtrar por `is_active`: aquí
// interesa la fila que ocupa el hueco del principal, activa o no — es la que hay que actualizar.
export const principalCrudo = async (ejecutor, personId) => {
  const [filas] = await ejecutor.query(
    `SELECT id, direccion, verificado FROM emails WHERE person_id = ? AND principal = 1 LIMIT 1`,
    [personId]
  );
  return filas?.[0] ?? null;
};

// `desverificar` lo decide el servicio: cambiar de dirección desverifica, y por eso el flag entra
// como parámetro en vez de deducirse aquí. La regla y su motivo están en el servicio.
export const actualizarPrincipal = async (ejecutor, emailId, { direccion, tipo, desverificar }) => {
  await ejecutor.query(
    `UPDATE emails
        SET direccion = ?, tipo = ?${desverificar ? ", verificado = 0, verificado_at = NULL" : ""}
      WHERE id = ?`,
    [direccion, tipo, Number(emailId)]
  );
};

export const insertarPrincipal = async (ejecutor, personId, tipo, direccion) => {
  const [resultado] = await ejecutor.query(
    `INSERT INTO emails (person_id, tipo, direccion, principal) VALUES (?, ?, ?, 1)`,
    [personId, tipo, direccion]
  );
  return resultado?.insertId ?? null;
};

// El principal VIGENTE, que es lo que lee el perfil. Éste sí filtra por `is_active`.
export const principalVigente = async (ejecutor, personId) => {
  const [filas] = await ejecutor.query(
    `SELECT id, tipo, direccion, verificado, verificado_at
       FROM emails
      WHERE person_id = ? AND principal = 1 AND is_active = 1
      LIMIT 1`,
    [personId]
  );
  return filas?.[0] ?? null;
};

export const listarDeLaPersona = async (ejecutor, personId) => {
  const [filas] = await ejecutor.query(
    `SELECT id, tipo, direccion, verificado, verificado_at, principal
       FROM emails
      WHERE person_id = ? AND is_active = 1
      ORDER BY principal DESC, id ASC`,
    [personId]
  );
  return filas ?? [];
};

// POR AQUI ENTRA EL LOGIN. Busca por CUALQUIERA de los correos de la persona, no sólo el principal:
// si alguien se registró con el personal y luego declara el institucional, los dos deben seguir
// sirviendo para entrar. La dirección llega YA normalizada — normalizarla es del servicio, porque de
// eso depende que el índice único signifique algo.
export const personaConLaDireccion = async (ejecutor, direccion) => {
  const [filas] = await ejecutor.query(
    `SELECT person_id FROM emails WHERE direccion = ? AND is_active = 1 LIMIT 1`,
    [direccion]
  );
  return filas?.length ? Number(filas[0].person_id) : null;
};

export const marcarVerificado = async (ejecutor, emailId) => {
  await ejecutor.query(
    `UPDATE emails SET verificado = 1, verificado_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [Number(emailId)]
  );
};
