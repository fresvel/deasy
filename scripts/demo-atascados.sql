-- Siembra los DOS casos de entregable atascado en la unidad 8 (Tecnologías de la Información),
-- que encabeza el puesto 21 / persona 24 (cédula 9000000021, clave Demo1234!).
--
-- CASO A · «El titular se fue» — el que motiva toda la decisión D1.b:
--   el entregable 1 se pone EN FASE DE FIRMA y su responsable deja el puesto. El relevo automático
--   no lo toca (está en firma, por diseño) y el reset tampoco lo abre (exige ser el titular del
--   paso, y ese titular ya no está). Sin el panel del jefe, queda parado para siempre.
--
-- CASO B · «Sin responsable» — la silla vacante:
--   un entregable nuevo anclado al puesto 26, cuyo ocupante se retira. El trigger le abre una
--   tenencia SIN PERSONA (`occupancy_end`) y queda esperando a alguien.

BEGIN;

-- Idempotente: si ya se sembro, se limpia el caso B antes de rehacerlo.
DELETE FROM document_versions WHERE task_item_id IN
  (SELECT id FROM task_items WHERE title LIKE 'Informe de laboratorio (demo%');
DELETE FROM task_item_tenures WHERE task_item_id IN
  (SELECT id FROM task_items WHERE title LIKE 'Informe de laboratorio (demo%');
DELETE FROM task_items WHERE title LIKE 'Informe de laboratorio (demo%';
DELETE FROM document_versions WHERE task_item_id IN (SELECT id FROM task_items WHERE title LIKE '%(demo:%');
DELETE FROM task_item_tenures WHERE task_item_id IN (SELECT id FROM task_items WHERE title LIKE '%(demo:%');
DELETE FROM task_items WHERE title LIKE '%(demo:%';
UPDATE unit_positions SET is_active = 1 WHERE id = 27;

-- ── CASO A ────────────────────────────────────────────────────────────────────────────────
UPDATE task_items SET document_status = 'Pendiente de firma' WHERE id = 1;
UPDATE position_assignments SET is_current = 0, end_date = CURRENT_DATE
 WHERE position_id = 25 AND is_current = 1;

-- ── CASO B ────────────────────────────────────────────────────────────────────────────────
INSERT INTO task_items
  (task_id, process_definition_template_id, template_artifact_id, origin_kind, title,
   sort_order, created_by_person_id, responsible_position_id, assigned_person_id,
   document_status, start_date, end_date)
SELECT ti.task_id, ti.process_definition_template_id, ti.template_artifact_id, 'user_added',
       'Informe de laboratorio (demo: silla vacante)', 50, 24, 26, 29,
       'Pendiente de llenado', ti.start_date, ti.end_date
  FROM task_items ti WHERE ti.id = 1;

UPDATE position_assignments SET is_current = 0, end_date = CURRENT_DATE
 WHERE position_id = 26 AND is_current = 1;

-- ── CASO C · «El puesto se desactivó» (D2) ────────────────────────────────────────────────
--   Dos entregables en el puesto 27: uno antes de la firma y otro ya en firma. Al desactivar el
--   puesto, el primero queda huérfano con causa `position_deactivated` y el segundo NO se toca
--   —hay gente convocada— pero SÍ aparece en el panel para que el jefe decida.
INSERT INTO task_items
  (task_id, process_definition_template_id, template_artifact_id, origin_kind, title,
   sort_order, created_by_person_id, responsible_position_id, assigned_person_id,
   document_status, start_date, end_date)
SELECT ti.task_id, ti.process_definition_template_id, ti.template_artifact_id, 'user_added',
       'Plan de asignatura (demo: puesto desactivado)', 60, 24, 27, 30,
       'Pendiente de llenado', ti.start_date, ti.end_date
  FROM task_items ti WHERE ti.id = 1
UNION ALL
SELECT ti.task_id, ti.process_definition_template_id, ti.template_artifact_id, 'user_added',
       'Acta de consejo (demo: en firma, puesto desactivado)', 61, 24, 27, 30,
       'Pendiente de firma', ti.start_date, ti.end_date
  FROM task_items ti WHERE ti.id = 1;

UPDATE unit_positions SET is_active = 0 WHERE id = 27;

COMMIT;

\echo ''
\echo '=== Entregables atascados en la unidad 8 ==='
SELECT ti.id, ti.responsible_position_id AS puesto, up.is_active AS puesto_activo,
       ti.assigned_person_id AS responde, ti.document_status,
       CASE WHEN up.is_active = 0 THEN 'puesto_desactivado'
            WHEN ti.assigned_person_id IS NULL THEN 'sin_responsable'
            ELSE 'titular_se_fue' END AS motivo
  FROM task_items ti
  JOIN unit_positions up ON up.id = ti.responsible_position_id
 WHERE up.unit_id = 8
 ORDER BY ti.id;
