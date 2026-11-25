import { getPostgresPool } from "../../config/postgres.js";
import { resolverPersonaPorNumero, MENSAJE_DOCUMENTO_AMBIGUO } from "../../dominios/identidad/index.js";
import { listTasksForPerson } from "../../services/tasks/taskQueries.js";

export const getuserTarea = async (req, res) => {
  console.log("Buscando Tareas por parámetros (SQL)");
  try {
    const cedula = req.query?.usuario || req.body?.usuario;
    if (!cedula) {
      return res.status(400).json({ message: "Se requiere la cedula del usuario." });
    }
    const pool = getPostgresPool();
    if (!pool) {
      return res.status(500).json({ message: "Conexion PostgreSQL no disponible" });
    }
    // Aqui habia un `LIMIT 1` sobre `numero`: la unicidad de un documento es (tipo, pais, numero),
    // asi que ante dos coincidencias devolvia LAS TAREAS de otra persona, sin avisar.
    const { personId, ambiguo } = await resolverPersonaPorNumero(pool, cedula);
    if (ambiguo) {
      return res.status(409).json({ message: MENSAJE_DOCUMENTO_AMBIGUO });
    }
    if (!personId) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const rows = await listTasksForPerson(pool, personId, {
      processId: req.query?.process_id,
      processSlug: req.query?.process_slug,
      termId: req.query?.term_id,
      status: req.query?.status,
    });
    res.json(rows);
  } catch (error) {
    console.log("Error Buscando Tareas por Usuario");
    console.error(error.message);
    res.status(500).json({ message: error.message });
  }
};



