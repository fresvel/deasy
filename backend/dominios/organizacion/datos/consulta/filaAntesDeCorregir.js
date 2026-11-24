// LO QUE UNA FILA DECÍA ANTES DE CORREGIRLA — la lectura que hace falta para la bitácora de
// correcciones (frente 27, D-05).
//
// ⚠️ `datos/consulta/` porque CRUZA: de las cinco tablas que se corrigen, tres son de `organizacion`
// y dos de `procesos` (`process_vigencias`, `process_relations`). Es una lectura; lo que se escribe
// es sólo la bitácora, que sí es de este dominio.
//
// ⚠️ `tabla` SE INTERPOLA, y por eso se comprueba aquí contra una lista cerrada aunque quien llama ya
// lo haya hecho: es la única defensa que no depende de nadie más. Esta consulta NO la ven
// `check:sql-aliases` ni `check:sql-comments`, que buscan nombres literales; la cubre esta lista.
//
// ⚠️ `FOR UPDATE`: se lee la fila que se va a corregir, dentro de la transacción que la corrige, y
// nadie la cambia entre que se anota lo que decía y que se escribe lo nuevo.
export const TABLAS_CON_CORRECCION = Object.freeze([
  "unit_vigencias",
  "position_vigencias",
  "process_vigencias",
  "unit_relations",
  "process_relations",
  "unit_equivalencias",
  "position_equivalencias",
  "process_equivalencias",
  // El fichero de un acto que ya ordena algo: se corrige desde su propia pantalla, no por el
  // editor genérico (ver `services/actoAdjuntos.js`).
  "acto_adjuntos"
]);

// Devuelve la fila como objeto —sin las dos columnas de sello, que no son parte de lo que dice—, o
// `null` si no existe. Las fechas salen como texto AAAA-MM-DD: las compone la base.
export const leerFilaAntesDeCorregir = async (ejecutor, tabla, registroId) => {
  if (!TABLAS_CON_CORRECCION.includes(tabla)) {
    throw new Error(`La tabla ${tabla} no admite correcciones.`);
  }
  const [filas] = await ejecutor.query(
    `SELECT (to_jsonb(t) - 'created_at' - 'updated_at')::text AS fila FROM ${tabla} t WHERE t.id = ? FOR UPDATE`,
    [registroId]
  );
  return filas[0] ? JSON.parse(filas[0].fila) : null;
};
