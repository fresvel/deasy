// EL TELÉFONO CON EL PREFIJO DE SU PAÍS.
//
// ⚠️ `datos/consulta/` porque CRUZA: `paises` es de **organizacion**. De `identidad` nombra
// `telefonos` y `telefono_verification_keys`. Las tres son lecturas.
//
// ⚠️ Y el prefijo NO es un adorno: sin él no hay comparación internacional posible — `+51 99 111
// 2233` y `+593 99 111 2233` tienen la misma cola, y eso está **medido**, no supuesto. Por eso las
// tres consultas traen `phone_code` aunque parezca que sólo hace falta el número.

// El teléfono de ESE dueño. El `person_id` en el WHERE no es opcional: un teléfono ajeno tiene que
// responder lo mismo que uno inexistente, o la ruta se convierte en un oráculo de identificadores
// ocupados. Es el mismo fallo que el IDOR de los entregables.
export const telefonoDelDueno = async (ejecutor, telefonoId, personId) => {
  const [filas] = await ejecutor.query(
    `SELECT t.id, t.numero, p.phone_code
       FROM telefonos t
       LEFT JOIN paises p ON p.id = t.pais_id
      WHERE t.id = ? AND t.person_id = ? AND t.is_active = 1
      LIMIT 1`,
    [telefonoId, personId]
  );
  return filas?.[0] ?? null;
};

// La llave con el teléfono al que pertenece. Quien decide en qué estado está —viva, caducada,
// consumida, desconocida— es el servicio: aquí sólo se traen las fechas.
export const llavePorHuella = async (ejecutor, llaveHash) => {
  const [filas] = await ejecutor.query(
    `SELECT k.id, k.telefono_id, k.expira_at, k.consumida_at, t.numero, t.person_id, p.phone_code
       FROM telefono_verification_keys k
       INNER JOIN telefonos t ON t.id = k.telefono_id
       LEFT JOIN paises p ON p.id = t.pais_id
      WHERE k.llave_hash = ?
      LIMIT 1`,
    [llaveHash]
  );
  return filas?.[0] ?? null;
};

// Cuáles de estos números internacionales verificaron alguna vez.
//
// ⚠️ NO HACE FALTA NINGUNA TABLA NUEVA para esto, y se llegó a proponer una:
// `telefono_verification_keys` **no se borra** —los dos `DELETE` que existen sólo tocan las llaves no
// consumidas—, así que una llave usada se queda para siempre y con eso la pregunta ya tiene respuesta.
//
// El número se compone igual que en el resto del sistema: prefijo del país + parte local. Se compara
// así y no por partes porque lo que llega del canal es UNA cadena internacional.
export const cualesVerificaron = async (ejecutor, numerosInternacionales) => {
  const huecos = numerosInternacionales.map(() => "?").join(", ");
  const [filas] = await ejecutor.query(
    `SELECT DISTINCT regexp_replace(p.phone_code, '\\D', '', 'g') || t.numero AS internacional
       FROM telefonos t
       INNER JOIN paises p ON p.id = t.pais_id
       INNER JOIN telefono_verification_keys k
               ON k.telefono_id = t.id AND k.consumida_at IS NOT NULL
      WHERE regexp_replace(p.phone_code, '\\D', '', 'g') || t.numero IN (${huecos})`,
    numerosInternacionales
  );
  return filas ?? [];
};
