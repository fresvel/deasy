import SqlAdminService from "../../services/admin/SqlAdminService.js";
import { getPostgresPool } from "../../config/postgres.js";
import { resetDocumentWorkflowForTaskItem } from "../../services/documents/DocumentWorkflowResetService.js";

const service = new SqlAdminService();

// F-C (scope por jefe): entregables atascados (sin responsable o con titular que se fue) en las unidades que el
// usuario actual encabeza + descendientes. Accesible a cualquier persona autenticada (un jefe puede ser Usuario).
export const getMySupervisedStuckTasks = async (req, res) => {
  try {
    const result = await service.listSupervisorStuckTaskItems(req.user?.uid ?? null);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// ── LAS DOS ACCIONES DEL JEFE (DR1.b y DR2, 2026-08-23) ─────────────────────────────────────
//
// El panel llevaba desde su nacimiento diciendo «la reasignación se habilitará desde aquí en el
// siguiente paso». Éste es ese paso, y lo motiva un hueco medido: si la persona que se fue es quien
// tenía el paso actual del flujo, NO PUEDE DESATASCARLO NADIE —ni el relevo automático, porque el
// entregable está en fase de firma, ni el reset, porque exige ser el titular del paso—. Ni un
// administrador: la ruta admite roles elevados pero el servicio sigue mirando a quien llama.
//
// La legitimidad del jefe no viene de un rol sino del ALCANCE: `assertSupervisesTaskItem` comprueba
// que el entregable cae en una unidad que encabeza. Por eso estas rutas no piden permiso de admin —
// un jefe de unidad puede ser un Usuario cualquiera— y por eso el guard va SIEMPRE el primero.

export const supervisorHandoverTaskItem = async (req, res) => {
  try {
    const personId = req.user?.uid ?? null;
    await service.assertSupervisesTaskItem(personId, req.params.taskItemId);
    const result = await service.handoverTaskItem(req.params.taskItemId, {
      toPersonId: req.body?.to_person_id,
      reason: req.body?.reason || "Reasignado por la jefatura de la unidad",
      performedByUserId: personId,
    });
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const supervisorResetTaskItemWorkflow = async (req, res) => {
  const pool = getPostgresPool();
  if (!pool) {
    return res.status(500).json({ message: "Conexion PostgreSQL no disponible" });
  }
  const connection = await pool.getConnection();
  try {
    const personId = req.user?.uid ?? null;
    await service.assertSupervisesTaskItem(personId, req.params.taskItemId, connection);

    // La definición sale del propio entregable: el jefe no la conoce ni tiene por qué mandarla, y
    // aceptarla del cliente sería dejar que eligiera sobre qué proceso opera.
    const [rows] = await connection.query(
      `SELECT t.process_definition_id
         FROM task_items ti
         INNER JOIN tasks t ON t.id = ti.task_id
        WHERE ti.id = ?
        LIMIT 1`,
      [Number(req.params.taskItemId)]
    );
    const definitionId = rows?.[0]?.process_definition_id;
    if (!definitionId) {
      return res.status(404).json({ message: "El entregable no existe o no tiene proceso." });
    }

    await connection.beginTransaction();
    const result = await resetDocumentWorkflowForTaskItem({
      connection,
      userId: personId,
      definitionId,
      taskItemId: Number(req.params.taskItemId),
      bypassStepOwnership: true,
    });
    await connection.commit();
    return res.json(result);
  } catch (error) {
    await connection.rollback().catch(() => {});
    return res.status(error.status || 400).json({ message: error.message });
  } finally {
    connection.release();
  }
};
