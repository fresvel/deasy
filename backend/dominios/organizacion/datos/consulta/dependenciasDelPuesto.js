// LAS OCHO COSAS QUE PUEDEN DEPENDER DE UN PUESTO, y cuántas hay de cada una.
//
// ⚠️ `datos/consulta/` porque las ocho tablas son de SEIS dominios: `position_assignments` de
// `organizacion`, `task_items` y `task_item_tenures` de `tareas`, `vacancies` y `contracts` de
// `empleo`, `process_target_rules` de `procesos`, `fill_flow_steps` de `plantillas` y
// `signature_flow_steps` de `firmas`. Son ocho `COUNT(*)`: no se escribe nada.
//
// LA LISTA SE ESCRIBE UNA VEZ y se usa para DECIDIR y para EXPLICAR, y eso es lo que impide que las
// dos se desincronicen: el mensaje que ve el usuario sale de la misma consulta que toma la decisión.
// Por eso el singular y el plural viajan con la tabla y no se quedan en el servicio — partir la lista
// en dos sitios es exactamente el fallo que tenía antes, cuando el mensaje decía «vacantes,
// contratos o reglas» y ya eran ocho: dos las añadió la reordenación del entregable del 2026-08-23
// —`task_items.responsible_position_id`, que además es obligatorio, y `task_item_tenures.position_id`—
// y otras tres estaban desde antes sin nombrarse.
//
// ⚠️ Estas ocho consultas NO LAS VE `check:sql-aliases` ni `check:sql-comments`: el nombre de la
// tabla se interpola, así que para un recorrido que busca nombres literales aquí no hay ninguna
// tabla. Lo mismo que pasa con `services/admin/SqlAdminService.js`. Quien lo cubre es esta lista, que
// es cerrada y está a la vista.
export const DEPENDENCIAS_DE_UN_PUESTO = [
  ["position_assignments", "position_id", "ocupacion", "ocupaciones"],
  ["task_items", "responsible_position_id", "entregable", "entregables"],
  ["task_item_tenures", "position_id", "tenencia", "tenencias"],
  ["vacancies", "position_id", "vacante", "vacantes"],
  ["contracts", "position_id", "contrato", "contratos"],
  ["process_target_rules", "position_id", "regla de proceso", "reglas de proceso"],
  ["fill_flow_steps", "position_id", "paso de entrega", "pasos de entrega"],
  ["signature_flow_steps", "position_id", "paso de firma", "pasos de firma"],
];

// Devuelve SÓLO lo que bloquea —`{ singular, plural, n }` por tabla con filas—, en el orden de la
// lista. Vacío significa que el puesto está virgen y se puede borrar.
export const contarDependenciasDelPuesto = async (ejecutor, positionId) => {
  const bloqueos = [];
  for (const [tabla, columna, singular, plural] of DEPENDENCIAS_DE_UN_PUESTO) {
    const [filas] = await ejecutor.query(
      `SELECT COUNT(*) AS n FROM ${tabla} WHERE ${columna} = ?`,
      [positionId]
    );
    const n = Number(filas?.[0]?.n || 0);
    if (n > 0) {
      bloqueos.push({ singular, plural, n });
    }
  }
  return bloqueos;
};
