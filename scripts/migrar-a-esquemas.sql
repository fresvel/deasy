-- Reubicacion de una base ANTERIOR al reparto en esquemas (2026-10-04).
--
-- POR QUE ESTE FICHERO EXISTE Y NO ESTA EN EL ESQUEMA. 'postgres_schema.sql' describe la forma y
-- nada mas; no converge una base vieja. Es el contrato TD7-s, y lo vigila un test. Asi que la
-- reubicacion vive aqui, se ejecuta UNA vez y a mano.
--
-- POR QUE HACE FALTA. Sobre una base que ya existe, 'CREATE TABLE IF NOT EXISTS firmas.x' no ve la
-- 'public.x' que ya esta: crearia una tabla nueva y VACIA en 'firmas' y dejaria la vieja, con todos
-- los datos, en 'public'. El sistema arrancaria como si la instalacion fuera nueva.
--
-- QUE HACE. Mueve cada tabla al esquema de su tema. NO TOCA NI UNA FILA: 'SET SCHEMA' solo cambia
-- donde vive la tabla, y los indices y los disparadores se mueven con ella. Es idempotente: el
-- 'IF EXISTS' no falla si la tabla ya se movio o nunca estuvo en 'public'.
--
-- COMO SE USA, antes de arrancar el backend con la version nueva:
--
--     bash scripts/docker-env.sh dev exec -T postgres \
--       psql -U deasy -d deasy -v ON_ERROR_STOP=1 < scripts/migrar-a-esquemas.sql
--
-- Si la base es desechable --dev, qa-- es mas simple resetearla: 'bash scripts/reset-system.sh dev'.

CREATE SCHEMA IF NOT EXISTS identidad;
CREATE SCHEMA IF NOT EXISTS organizacion;
CREATE SCHEMA IF NOT EXISTS procesos;
CREATE SCHEMA IF NOT EXISTS plantillas;
CREATE SCHEMA IF NOT EXISTS tareas;
CREATE SCHEMA IF NOT EXISTS firmas;
CREATE SCHEMA IF NOT EXISTS chat;
CREATE SCHEMA IF NOT EXISTS empleo;

ALTER VIEW IF EXISTS public.unit_org_levels SET SCHEMA organizacion;
ALTER TABLE IF EXISTS public.chat_conversation_participants SET SCHEMA chat;
ALTER TABLE IF EXISTS public.chat_conversations SET SCHEMA chat;
ALTER TABLE IF EXISTS public.chat_message_attachments SET SCHEMA chat;
ALTER TABLE IF EXISTS public.chat_message_reads SET SCHEMA chat;
ALTER TABLE IF EXISTS public.chat_messages SET SCHEMA chat;
ALTER TABLE IF EXISTS public.chat_notifications SET SCHEMA chat;
ALTER TABLE IF EXISTS public.aplications SET SCHEMA empleo;
ALTER TABLE IF EXISTS public.contract_origin_recruitment SET SCHEMA empleo;
ALTER TABLE IF EXISTS public.contract_origin_renewal SET SCHEMA empleo;
ALTER TABLE IF EXISTS public.contract_origins SET SCHEMA empleo;
ALTER TABLE IF EXISTS public.contracts SET SCHEMA empleo;
ALTER TABLE IF EXISTS public.offers SET SCHEMA empleo;
ALTER TABLE IF EXISTS public.vacancies SET SCHEMA empleo;
ALTER TABLE IF EXISTS public.vacancy_visibility SET SCHEMA empleo;
ALTER TABLE IF EXISTS public.signature_batch_jobs SET SCHEMA firmas;
ALTER TABLE IF EXISTS public.signature_flow_instances SET SCHEMA firmas;
ALTER TABLE IF EXISTS public.signature_flow_steps SET SCHEMA firmas;
ALTER TABLE IF EXISTS public.signature_flow_templates SET SCHEMA firmas;
ALTER TABLE IF EXISTS public.signature_request_statuses SET SCHEMA firmas;
ALTER TABLE IF EXISTS public.signature_requests SET SCHEMA firmas;
ALTER TABLE IF EXISTS public.signature_statuses SET SCHEMA firmas;
ALTER TABLE IF EXISTS public.accesos_sensibles SET SCHEMA identidad;
ALTER TABLE IF EXISTS public.actions SET SCHEMA identidad;
ALTER TABLE IF EXISTS public.autoidentificaciones_etnicas SET SCHEMA identidad;
ALTER TABLE IF EXISTS public.canales_bitacora SET SCHEMA identidad;
ALTER TABLE IF EXISTS public.canales_mensajeria SET SCHEMA identidad;
ALTER TABLE IF EXISTS public.cargo_role_map SET SCHEMA identidad;
ALTER TABLE IF EXISTS public.cargos SET SCHEMA identidad;
ALTER TABLE IF EXISTS public.categorias_visa SET SCHEMA identidad;
ALTER TABLE IF EXISTS public.consentimientos SET SCHEMA identidad;
ALTER TABLE IF EXISTS public.direcciones SET SCHEMA identidad;
ALTER TABLE IF EXISTS public.documentos_identidad SET SCHEMA identidad;
ALTER TABLE IF EXISTS public.documentos_legales SET SCHEMA identidad;
ALTER TABLE IF EXISTS public.dossier_items SET SCHEMA identidad;
ALTER TABLE IF EXISTS public.dossiers SET SCHEMA identidad;
ALTER TABLE IF EXISTS public.email_verification_codes SET SCHEMA identidad;
ALTER TABLE IF EXISTS public.emails SET SCHEMA identidad;
ALTER TABLE IF EXISTS public.estados_civiles SET SCHEMA identidad;
ALTER TABLE IF EXISTS public.generos SET SCHEMA identidad;
ALTER TABLE IF EXISTS public.intentos_limitados SET SCHEMA identidad;
ALTER TABLE IF EXISTS public.parentescos SET SCHEMA identidad;
ALTER TABLE IF EXISTS public.password_reset_codes SET SCHEMA identidad;
ALTER TABLE IF EXISTS public.permissions SET SCHEMA identidad;
ALTER TABLE IF EXISTS public.person_certificates SET SCHEMA identidad;
ALTER TABLE IF EXISTS public.persona_autoidentificacion SET SCHEMA identidad;
ALTER TABLE IF EXISTS public.persons SET SCHEMA identidad;
ALTER TABLE IF EXISTS public.resources SET SCHEMA identidad;
ALTER TABLE IF EXISTS public.role_assignment_relation_types SET SCHEMA identidad;
ALTER TABLE IF EXISTS public.role_assignments SET SCHEMA identidad;
ALTER TABLE IF EXISTS public.role_permissions SET SCHEMA identidad;
ALTER TABLE IF EXISTS public.roles SET SCHEMA identidad;
ALTER TABLE IF EXISTS public.telefono_canales SET SCHEMA identidad;
ALTER TABLE IF EXISTS public.telefono_verification_keys SET SCHEMA identidad;
ALTER TABLE IF EXISTS public.telefonos SET SCHEMA identidad;
ALTER TABLE IF EXISTS public.tipos_discapacidad SET SCHEMA identidad;
ALTER TABLE IF EXISTS public.cantones SET SCHEMA organizacion;
ALTER TABLE IF EXISTS public.clases_parroquia SET SCHEMA organizacion;
ALTER TABLE IF EXISTS public.instituciones SET SCHEMA organizacion;
ALTER TABLE IF EXISTS public.nomenclatura_territorial SET SCHEMA organizacion;
ALTER TABLE IF EXISTS public.paises SET SCHEMA organizacion;
ALTER TABLE IF EXISTS public.parroquias SET SCHEMA organizacion;
ALTER TABLE IF EXISTS public.position_assignments SET SCHEMA organizacion;
ALTER TABLE IF EXISTS public.provincias SET SCHEMA organizacion;
ALTER TABLE IF EXISTS public.relation_unit_types SET SCHEMA organizacion;
ALTER TABLE IF EXISTS public.unit_positions SET SCHEMA organizacion;
ALTER TABLE IF EXISTS public.unit_relations SET SCHEMA organizacion;
ALTER TABLE IF EXISTS public.unit_types SET SCHEMA organizacion;
ALTER TABLE IF EXISTS public.units SET SCHEMA organizacion;
ALTER TABLE IF EXISTS public.catalogo_documental SET SCHEMA plantillas;
ALTER TABLE IF EXISTS public.document_fill_flows SET SCHEMA plantillas;
ALTER TABLE IF EXISTS public.fill_flow_steps SET SCHEMA plantillas;
ALTER TABLE IF EXISTS public.fill_flow_templates SET SCHEMA plantillas;
ALTER TABLE IF EXISTS public.fill_requests SET SCHEMA plantillas;
ALTER TABLE IF EXISTS public.template_artifact_fields SET SCHEMA plantillas;
ALTER TABLE IF EXISTS public.ediciones SET SCHEMA plantillas;
ALTER TABLE IF EXISTS public.template_seeds SET SCHEMA plantillas;
ALTER TABLE IF EXISTS public.process_definition_period_types SET SCHEMA procesos;
ALTER TABLE IF EXISTS public.process_definition_series SET SCHEMA procesos;
ALTER TABLE IF EXISTS public.vinculos SET SCHEMA procesos;
ALTER TABLE IF EXISTS public.process_definition_versions SET SCHEMA procesos;
ALTER TABLE IF EXISTS public.process_target_rules SET SCHEMA procesos;
ALTER TABLE IF EXISTS public.processes SET SCHEMA procesos;
ALTER TABLE IF EXISTS public.term_types SET SCHEMA procesos;
ALTER TABLE IF EXISTS public.terms SET SCHEMA procesos;
ALTER TABLE IF EXISTS public.document_attachments SET SCHEMA tareas;
ALTER TABLE IF EXISTS public.document_signatures SET SCHEMA tareas;
ALTER TABLE IF EXISTS public.document_version_uploads SET SCHEMA tareas;
ALTER TABLE IF EXISTS public.document_versions SET SCHEMA tareas;
ALTER TABLE IF EXISTS public.document_workflow_observations SET SCHEMA tareas;
ALTER TABLE IF EXISTS public.process_runs SET SCHEMA tareas;
ALTER TABLE IF EXISTS public.task_item_tenures SET SCHEMA tareas;
ALTER TABLE IF EXISTS public.task_items SET SCHEMA tareas;
ALTER TABLE IF EXISTS public.tasks SET SCHEMA tareas;
