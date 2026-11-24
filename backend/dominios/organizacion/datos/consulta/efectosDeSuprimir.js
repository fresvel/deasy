// QUÉ SE CIERRA AL SUPRIMIR UN NODO, y cuánto hay de cada cosa — para decirlo ANTES de suprimir.
//
// Suprimir no es sólo poner una fecha: la base cierra además lo que colgaba del nodo
// (`aplicar_supresion_de_unidad`, `aplicar_supresion_de_puesto`), y eso NO vuelve al reactivarlo. Un
// fin que ya ocurrió tampoco se puede quitar (decisión del dueño, 2026-11-25), así que el único
// momento de evitar el error es éste: antes.
//
// ⚠️ `datos/consulta/` porque CRUZA: `role_assignments` es de `identidad`, `vacancies` de `empleo`,
// `task_items` de `tareas` y `process_relations` de `procesos`. Son `COUNT(*)`: no se escribe nada.
//
// ⚠️ ESTAS CUENTAS REPITEN LAS CONDICIONES DE LAS DOS FUNCIONES DE LA BASE. Si una de ellas cambia
// lo que cierra, esto se queda diciendo otra cosa. Lo vigila `efectosDeSuprimir.test.js`, que lee el
// esquema y comprueba que cada tabla que una función toca tenga aquí su cuenta.
//
// `seCierra: true` es lo que la supresión cierra y no se recupera. `false` es lo que la IMPIDE: las
// hijas que seguirían dependiendo del nodo. La base rechaza suprimir mientras las haya
// (`rechazar_supresion_con_hijos`), así que la pantalla lo dice antes de intentarlo. Aquí se cuentan
// las relaciones que no han terminado HOY; la regla exacta —las que siguen más allá de la fecha de
// fin que se elija— la aplica la base.
const EN_CURSO = "('Inicial', 'Pendiente de llenado', 'En proceso', 'Observado', 'Listo para firma')";

const CUENTAS = Object.freeze({
  unidad: [
    { singular: "rol asignado", plural: "roles asignados", seCierra: true,
      sql: `SELECT COUNT(*) AS n FROM role_assignments WHERE unit_id = ? AND is_current = 1` },
    { singular: "vacante abierta", plural: "vacantes abiertas", seCierra: true,
      sql: `SELECT COUNT(*) AS n FROM vacancies v
              INNER JOIN unit_positions up ON up.id = v.position_id
             WHERE up.unit_id = ? AND v.status = 'abierta'` },
    { singular: "unidad que depende de ella", plural: "unidades que dependen de ella", seCierra: false,
      sql: `SELECT COUNT(*) AS n FROM unit_relations r
             WHERE r.parent_unit_id = ? AND r.vigente_desde IS NOT NULL
               AND (r.vigente_hasta IS NULL OR r.vigente_hasta > CURRENT_DATE)` }
  ],
  puesto: [
    { singular: "ocupación vigente", plural: "ocupaciones vigentes", seCierra: true,
      sql: `SELECT COUNT(*) AS n FROM position_assignments WHERE position_id = ? AND is_current = 1` },
    { singular: "entregable en curso sin responsable", plural: "entregables en curso sin responsable", seCierra: true,
      sql: `SELECT COUNT(*) AS n FROM task_items ti
             WHERE ti.responsible_position_id = ? AND ti.document_status IN ${EN_CURSO}` }
  ],
  proceso: [
    { singular: "sub-proceso que depende de él", plural: "sub-procesos que dependen de él", seCierra: false,
      sql: `SELECT COUNT(*) AS n FROM process_relations r
             WHERE r.parent_process_id = ? AND r.vigente_desde IS NOT NULL
               AND (r.vigente_hasta IS NULL OR r.vigente_hasta > CURRENT_DATE)` }
  ]
});

export const CLASES_DE_NODO = Object.freeze(Object.keys(CUENTAS));

// Devuelve SÓLO lo que hay —`{ singular, plural, n, seCierra }` por cuenta con filas—.
export const contarEfectosDeSuprimir = async (ejecutor, clase, nodoId) => {
  const efectos = [];
  for (const { sql, ...resto } of CUENTAS[clase] ?? []) {
    const [filas] = await ejecutor.query(sql, [nodoId]);
    const n = Number(filas?.[0]?.n || 0);
    if (n > 0) efectos.push({ ...resto, n });
  }
  return efectos;
};
