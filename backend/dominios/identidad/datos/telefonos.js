// LOS TELÉFONOS de una persona (`telefonos`) y los CANALES que declara o prueba en cada uno
// (`telefono_canales`, contra el catálogo `canales_mensajeria`). Sólo SQL.
//
// Las reglas están en `services/TelefonoService.js`, y son de las que cuestan: la forma canónica del
// número, que el país dicho gane al deducido del prefijo, que cambiar el número tire lo que se había
// probado, y que DECLARAR un canal no lo VERIFIQUE. Nada de eso se decide aquí.
//
// Vive en `datos/` porque las tres tablas son de `identidad`. Lo que mira el catálogo de países está
// en `datos/consulta/telefonosConPrefijo.js`.
//
// ⚠️ `idDeCanalActivo` y `borrarLlavesVivas` NO se repiten aquí: ya están en
// `datos/verificacionDeTelefono.js`, que es el mismo asunto por el otro lado. Son la misma consulta.

// El número es de UNA persona. Si ya lo tiene otra se dice antes, porque el error del índice único no
// le sirve a nadie.
//
// ⚠️ `IS NOT DISTINCT FROM` y no `= ? OR (… IS NULL AND ? IS NULL)`: la segunda forma deja un
// parámetro suelto comparado contra NULL y PostgreSQL no puede inferirle el tipo —«could not
// determine data type of parameter $3»—. Y no lo ve nadie hasta que se ejecuta esa rama: para todo lo
// demás el SQL es una cadena de texto.
export const otroDuenoDelNumero = async (ejecutor, numero, paisId, personId) => {
  const [filas] = await ejecutor.query(
    `SELECT t.id FROM telefonos t
      WHERE t.numero = ? AND t.pais_id IS NOT DISTINCT FROM ?
        AND t.person_id <> ? LIMIT 1`,
    [numero, paisId, personId]
  );
  return filas?.length ? Number(filas[0].id) : null;
};

export const principalDeSuTipo = async (ejecutor, personId, tipo) => {
  const [filas] = await ejecutor.query(
    `SELECT id, numero, pais_id FROM telefonos WHERE person_id = ? AND tipo = ? AND principal = 1 LIMIT 1`,
    [personId, tipo]
  );
  return filas?.[0] ?? null;
};

export const actualizarNumero = async (ejecutor, telefonoId, paisId, numero) => {
  await ejecutor.query(
    `UPDATE telefonos SET pais_id = ?, numero = ? WHERE id = ?`,
    [paisId, numero, telefonoId]
  );
};

export const insertarPrincipal = async (ejecutor, personId, tipo, paisId, numero) => {
  const [resultado] = await ejecutor.query(
    `INSERT INTO telefonos (person_id, tipo, pais_id, numero, principal) VALUES (?, ?, ?, ?, 1)`,
    [personId, tipo, paisId, numero]
  );
  return resultado?.insertId ?? null;
};

// Se marca `verificado = 0`, no se borra la fila: DECLARAR un canal no es VERIFICARLO, y la
// declaración sigue siendo verdad. Lo que deja de serlo es la prueba.
export const desverificarCanales = async (ejecutor, telefonoId) => {
  await ejecutor.query(
    `UPDATE telefono_canales SET verificado = 0, verificado_at = NULL WHERE telefono_id = ?`,
    [telefonoId]
  );
};

export const canalDelTelefono = async (ejecutor, telefonoId, canalId) => {
  const [filas] = await ejecutor.query(
    `SELECT id, verificado FROM telefono_canales WHERE telefono_id = ? AND canal_id = ? LIMIT 1`,
    [telefonoId, canalId]
  );
  return filas?.[0] ?? null;
};

// Nace SIN verificar y sin fecha. Verificarlo es otro acto, con su prueba.
//
// ⚠️ Existencia y luego INSERT o UPDATE, en vez de un `ON DUPLICATE KEY` con `GREATEST`: el adaptador
// de PostgreSQL sólo traduce `= VALUES(col)` a `EXCLUDED.col` (`config/postgres.js:442`), así que un
// `VALUES(...)` ANIDADO dentro de una función se queda sin traducir y PostgreSQL responde «syntax
// error at or near (» en tiempo de llamada.
export const declararCanal = async (ejecutor, telefonoId, canalId) => {
  await ejecutor.query(
    `INSERT INTO telefono_canales (telefono_id, canal_id, verificado, verificado_at)
     VALUES (?, ?, 0, NULL)`,
    [telefonoId, canalId]
  );
};

export const verificarCanalPorId = async (ejecutor, canalDelTelefonoId) => {
  await ejecutor.query(
    `UPDATE telefono_canales SET verificado = 1, verificado_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [Number(canalDelTelefonoId)]
  );
};

export const insertarCanalVerificado = async (ejecutor, telefonoId, canalId) => {
  await ejecutor.query(
    `INSERT INTO telefono_canales (telefono_id, canal_id, verificado, verificado_at)
     VALUES (?, ?, 1, CURRENT_TIMESTAMP)`,
    [telefonoId, canalId]
  );
};

// Los que no están en la lista se van. Con la lista vacía se van todos, y por eso son dos consultas:
// un `NOT IN ()` sin elementos no es SQL válido.
export const dejarSoloEstosCanales = async (ejecutor, telefonoId, canalIds) => {
  if (!canalIds.length) {
    await ejecutor.query(`DELETE FROM telefono_canales WHERE telefono_id = ?`, [telefonoId]);
    return;
  }
  await ejecutor.query(
    `DELETE FROM telefono_canales WHERE telefono_id = ? AND canal_id NOT IN (${canalIds.map(() => "?").join(", ")})`,
    [telefonoId, ...canalIds]
  );
};

// Los canales de varios teléfonos de una vez, con su nombre. Las dos tablas son de `identidad`.
export const canalesDeLosTelefonos = async (ejecutor, telefonoIds) => {
  const [filas] = await ejecutor.query(
    `SELECT tc.telefono_id, cm.code, cm.name, tc.verificado, tc.verificado_at
       FROM telefono_canales tc
       JOIN canales_mensajeria cm ON cm.id = tc.canal_id
      WHERE tc.telefono_id IN (${telefonoIds.map(() => "?").join(", ")})
      ORDER BY cm.code ASC`,
    telefonoIds
  );
  return filas ?? [];
};

// Los mismos canales pero SIN ordenar, para el listado en lote.
//
// ⚠️ Son dos funciones y no una a propósito: la de arriba lleva `ORDER BY cm.code` porque su
// consumidor pinta la lista, y ésta no lo llevaba. Unificarlas cambiaría el orden de `canales` en una
// respuesta de la API — un golden se movería, y un refactor no mueve goldens.
export const canalesPorTelefono = async (ejecutor, telefonoIds) => {
  const [filas] = await ejecutor.query(
    `SELECT tc.telefono_id, cm.code, cm.name, tc.verificado, tc.verificado_at
       FROM telefono_canales tc
       JOIN canales_mensajeria cm ON cm.id = tc.canal_id
      WHERE tc.telefono_id IN (${telefonoIds.map(() => "?").join(", ")})`,
    telefonoIds
  );
  return filas ?? [];
};
