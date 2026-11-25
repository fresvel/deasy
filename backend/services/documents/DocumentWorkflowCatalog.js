// UN SOLO VOCABULARIO para el estado de un recorrido: los dos lados (entrega y firma) y los dos
// niveles (la instancia y la solicitud). Antes eran DOS mecanismos y DOS idiomas para el mismo
// concepto -- la entrega con `status TEXT` y un CHECK en ingles, la firma con `status_id` contra el
// catalogo `signature_request_statuses` en español --, y la fase 3 del frente 24 los unifico en
// CHECK y en español.
//
// ⚠️ `DEVUELTO` SOLO ES LEGAL EN ENTREGA. No se declara aparte porque el vocabulario es uno; lo que
// acota cada lado es su CHECK: `fill_requests` admite los seis, y las otras tres columnas
// --`document_fill_flows`, `signature_requests`, `signature_flow_instances`-- admiten cinco. Usar
// `DEVUELTO` en firma no se cuela: lo rechaza la base.
export const ESTADO_RECORRIDO = Object.freeze({
  PENDIENTE: "pendiente",
  EN_PROGRESO: "en_progreso",
  COMPLETADO: "completado",
  RECHAZADO: "rechazado",
  DEVUELTO: "devuelto",
  CANCELADO: "cancelado",
});

// El estado del HECHO de firmar, que es OTRA COSA y sigue siendo un catalogo: `signature_statuses`,
// leido por `document_signatures.signature_status_id`. No se unifico con el de arriba a proposito --
// no es el estado de una solicitud, es el resultado de una operacion criptografica.
export const SIGNATURE_STATUS = Object.freeze({
  SIGNED: "firmado",
  FAILED: "fallido",
  INVALID: "invalido",
  CANCELLED: "cancelado",
});

const normalizeCode = (value) => String(value || "").trim().toLowerCase();

export const getCatalogIdByCode = async (connection, tableName, code) => {
  const [rows] = await connection.query(
    `SELECT id
     FROM ${tableName}
     WHERE LOWER(code) = ?
     ORDER BY id ASC
     LIMIT 1`,
    [normalizeCode(code)]
  );
  return rows?.[0] ? Number(rows[0].id) : null;
};

export const getSignatureStatusIdByCode = (connection, code) =>
  getCatalogIdByCode(connection, "signature_statuses", code);
