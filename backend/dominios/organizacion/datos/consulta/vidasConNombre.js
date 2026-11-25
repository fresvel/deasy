// CADA VIDA CON EL NOMBRE DE SU NODO — para decir «Escuela A · 2026-11-01 → 2026-11-24» donde el
// editor de /admin sólo tenía el id de la fila (la columna «Vida que termina» de las equivalencias).
//
// ⚠️ `datos/consulta/` porque CRUZA: las vidas y los nodos de un proceso son de `procesos`. Y las
// tablas SE INTERPOLAN, de esta lista cerrada: esta consulta no la ven `check:sql-aliases` ni
// `check:sql-comments`, que buscan nombres literales.
const DE_CADA_CLASE = Object.freeze({
  unidad: { vidas: "unit_vigencias", nodo: "unit_id", nodos: "units", nombre: "name" },
  puesto: { vidas: "position_vigencias", nodo: "position_id", nodos: "unit_positions", nombre: "title" },
  proceso: { vidas: "process_vigencias", nodo: "process_id", nodos: "processes", nombre: "name" }
});
export const CLASES_CON_VIDAS = Object.freeze(Object.keys(DE_CADA_CLASE));

export const listarVidasConNombre = async (ejecutor, clase) => {
  const t = DE_CADA_CLASE[clase];
  if (!t) throw new Error(`No hay vidas de la clase «${clase}».`);
  const [filas] = await ejecutor.query(
    `SELECT v.id,
            n.${t.nombre} || ' · ' || TO_CHAR(v.vigente_desde, 'YYYY-MM-DD') || ' → ' ||
              COALESCE(TO_CHAR(v.vigente_hasta, 'YYYY-MM-DD'), 'sin fecha de fin') AS etiqueta
       FROM ${t.vidas} v
       JOIN ${t.nodos} n ON n.id = v.${t.nodo}
      ORDER BY v.id`
  );
  return filas;
};
