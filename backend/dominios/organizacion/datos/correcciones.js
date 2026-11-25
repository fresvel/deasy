// LA BITÁCORA DE CORRECCIONES DE LA ESTRUCTURA (frente 27, D-05): su único escritor.
//
// ⚠️ La entrada y la marca van juntas, y en ESTE orden. La marca —`deasy.correccion`, un ajuste que
// vive lo que la transacción— es lo que leen las reglas de la base que protegen lo que ya rigió
// (`correccion_en_curso`), y sólo vale si apunta a una entrada que existe. Así que no hay forma de
// saltarse una de esas reglas sin haber dejado escrito quién, por qué y qué decía la fila.
export const anotarCorreccion = async (ejecutor, { tabla, registroId = null, actorId, motivo, antes = null, despues }) => {
  const [resultado] = await ejecutor.query(
    `INSERT INTO correcciones_de_estructura (tabla, registro_id, actor_person_id, motivo, antes, despues)
     VALUES (?, ?, ?, ?, ?::jsonb, ?::jsonb)`,
    [tabla, registroId, actorId, motivo, antes ? JSON.stringify(antes) : null, despues ? JSON.stringify(despues) : null]
  );
  const id = Number(resultado.insertId);
  await ejecutor.query(`SELECT set_config('deasy.correccion', ?, true)`, [String(id)]);
  return id;
};
