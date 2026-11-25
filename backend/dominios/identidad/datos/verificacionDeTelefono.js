// LAS LLAVES con las que alguien demuestra que un número es suyo (`telefono_verification_keys`), y
// la constancia de QUÉ CANAL lo demostró (`telefono_canales`).
//
// Sólo SQL. Las reglas —cuánto vive una llave, que una nueva invalide las anteriores, que un canal no
// verifique a otro, y el veredicto de si el número coincide— están en
// `services/TelefonoVerificacionService.js`, y ahí se quedan.
//
// Vive en `datos/` porque `telefono_verification_keys`, `telefono_canales` y `canales_mensajeria` son
// las tres de `identidad`. Lo que mira `paises` está en `datos/consulta/telefonoConSuPais.js`.

// Invalida las vivas del mismo teléfono. La REGLA —si pides otra es porque la primera no te sirvió, y
// dejar dos vivas multiplica por dos lo que hay que adivinar— es del servicio; esto sólo borra.
export const borrarLlavesVivas = async (ejecutor, telefonoId) => {
  await ejecutor.query(
    `DELETE FROM telefono_verification_keys WHERE telefono_id = ? AND consumida_at IS NULL`,
    [telefonoId]
  );
};

export const insertarLlave = async (ejecutor, telefonoId, llaveHash, expiraAt) => {
  await ejecutor.query(
    `INSERT INTO telefono_verification_keys (telefono_id, llave_hash, expira_at) VALUES (?, ?, ?)`,
    [telefonoId, llaveHash, expiraAt]
  );
};

export const idDeCanalActivo = async (ejecutor, code) => {
  const [filas] = await ejecutor.query(
    `SELECT id FROM canales_mensajeria WHERE code = ? AND is_active = 1 LIMIT 1`,
    [code]
  );
  return filas?.length ? Number(filas[0].id) : null;
};

// Devuelve CUÁNTAS filas tocó, y el llamador decide qué significa cero.
//
// ⚠️ SE CUENTA POR `affectedRows`, no por la longitud del array. El adaptador decide por el PRIMER
// VERBO: un UPDATE devuelve una CABECERA `{affectedRows}`, no filas — está explicado en
// `services/admin/org/taskAssignment.js:262`, donde el mismo despiste costó el defecto 1.10. Contar
// mal aquí no daría un error: daría «ya consumida» SIEMPRE, y en silencio.
//
// El `consumida_at IS NULL` del WHERE es lo que hace que la carrera se pierda limpiamente en vez de
// verificar dos veces, así que no lo quites pensando que el estado ya se comprobó antes: entre la
// lectura y esta escritura cabe otro mensaje.
export const consumirLlave = async (ejecutor, llaveHash, canalId) => {
  const [resultado] = await ejecutor.query(
    `UPDATE telefono_verification_keys
        SET consumida_at = CURRENT_TIMESTAMP, canal_id = ?
      WHERE llave_hash = ? AND consumida_at IS NULL`,
    [canalId, llaveHash]
  );
  return Number(resultado?.affectedRows ?? 0);
};

// ⚠️ NO se toca `telefonos`: esa tabla NO tiene columna `verificado`, y es a propósito. La
// verificación es POR CANAL, que es lo que el modelo viejo no podía decir — `verify_whatsapp` era una
// bandera suelta que no distinguía «este número existe» de «este número tiene WhatsApp».
export const marcarCanalVerificado = async (ejecutor, telefonoId, canalId) => {
  await ejecutor.query(
    `INSERT INTO telefono_canales (telefono_id, canal_id, verificado, verificado_at)
     VALUES (?, ?, 1, CURRENT_TIMESTAMP)
     ON DUPLICATE KEY UPDATE verificado = 1, verificado_at = CURRENT_TIMESTAMP`,
    [telefonoId, canalId]
  );
};
