import { getMariaDBPool } from "../../config/mariadb.js";

export const listVisibleVacancies = async (req, res) => {
  try {
    const userIdRaw = req.uid?.uid ?? req.uid?.userId ?? req.uid?.id;
    const userId = Number(userIdRaw);
    if (!userId || Number.isNaN(userId)) {
      return res.status(401).json({ message: "Usuario no autenticado." });
    }

    const status = req.query?.status ?? "abierta";
    const pool = getMariaDBPool();
    if (!pool) {
      return res.status(500).json({ message: "Conexion MariaDB no disponible" });
    }

    const [rows] = await pool.query(
      `SELECT
         v.id,
         v.title,
         v.category,
         v.dedication,
         v.relation_type,
         v.status,
         v.profile_ref,
         v.opened_at,
         v.closed_at,
         v.position_id,
         up.title AS position_title,
         up.position_type,
         up.unit_id,
         up.cargo_id,
         u.name AS unit_name,
         c.name AS cargo_name
       FROM vacancies v
       INNER JOIN unit_positions up ON up.id = v.position_id
       INNER JOIN units u ON u.id = up.unit_id
       INNER JOIN cargos c ON c.id = up.cargo_id
       WHERE v.status = ?
         AND up.is_active = 1
         AND (
           up.position_type = 'real'
           OR (
             up.position_type = 'promocion'
             AND (
               EXISTS (
                 SELECT 1
                 FROM role_assignments ra
                 WHERE ra.person_id = ?
                   AND ra.unit_id = up.unit_id
                   AND ra.is_current = 1
               )
               OR EXISTS (
                 SELECT 1
                 FROM vacancy_visibility vv
                 INNER JOIN role_assignments ra2
                   ON ra2.person_id = ?
                  AND ra2.is_current = 1
                  AND (vv.unit_id IS NULL OR ra2.unit_id = vv.unit_id)
                  AND (vv.role_id IS NULL OR ra2.role_id = vv.role_id)
                 WHERE vv.vacancy_id = v.id
               )
             )
           )
         )
       ORDER BY v.created_at DESC`,
      [status, userId, userId]
    );

    res.json(rows);
  } catch (error) {
    console.error("Error listando vacantes visibles:", error);
    res.status(500).json({ message: "Error al obtener vacantes", error: error.message });
  }
};
