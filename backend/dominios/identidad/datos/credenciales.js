// LO QUE HACE FALTA PARA COMPROBAR QUIÉN ES ALGUIEN: su hash y su correo principal.
//
// Vive en `datos/` porque `persons` y `emails` son las dos de `identidad`.
//
// ⚠️ Devuelve el hash y ya está: NO decide nada. Quien compara —y quien se asegura de comparar
// SIEMPRE, aunque la persona no exista, para que el tiempo de respuesta no delate si el documento
// está registrado— es `services/RecuperarCorreoService.js`. Esa es toda la defensa de ese flujo
// contra convertirse en un oráculo de existencia, así que no la muevas aquí.
export const hashYCorreoPrincipal = async (ejecutor, personId) => {
  const [filas] = await ejecutor.query(
    `SELECT p.password_hash, e.direccion AS email
       FROM persons p
       LEFT JOIN emails e ON e.person_id = p.id AND e.principal = 1 AND e.is_active = 1
      WHERE p.id = ? AND p.is_active = 1
      LIMIT 1`,
    [personId]
  );
  return filas?.[0] ?? null;
};
