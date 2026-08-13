# Rediseño del Modelo de Entregables (Fases A–C) · 2026-06

## Propósito

Este documento describe el rediseño del modelo de negocio de **entregables, procesos y tareas**
ejecutado en junio de 2026. Complementaba a
[`roadmap-documental-operativo-v2.md`](../docs-md-antiguos/planes-cerrados-2026-08/roadmap-documental-operativo-v2.md) y
[`roadmap-modelo-documental-y-firmas.md`](../docs-md-antiguos/planes-cerrados-2026-08/roadmap-modelo-documental-y-firmas.md),
que conservaban el diseño base del núcleo documental y que se **archivaron el 2026-08-13**: su objetivo
se cumplió, pero describen un núcleo que gira alrededor del `meta.yaml`, y el `meta.yaml` ya no existe.
Aquí se documentan tres capacidades nuevas que cierran puntos débiles del modelo:

- **Fase A** — Entregables con varios elementos (documento principal + anexos heterogéneos).
- **Fase B** — Tareas libres (proceso "General") y tareas derivadas de un entregable.
- **Fase C** — Control desde la web de plantillas/artifacts: metadatos, campos del formulario,
  flujos de llenado/firma y gobierno de versión/stage.

Todas las rutas de este documento son relativas a la raíz del repo (`deasy/`).

## Fuentes de verdad

- Esquema: [backend/database/postgres_schema.sql](../../backend/database/postgres_schema.sql)
- Instanciación de tareas: [backend/services/admin/TaskGenerationService.js](../../backend/services/admin/TaskGenerationService.js)
- Panel/entregables del usuario: [backend/controllers/users/user_controler.js](../../backend/controllers/users/user_controler.js)
- Admin SQL / artifacts: [backend/services/admin/SqlAdminService.js](../../backend/services/admin/SqlAdminService.js)
- UI de entregables: [frontend/src/modules/home/views/HomeView.vue](../../frontend/src/modules/home/views/HomeView.vue)
  y [frontend/src/modules/home/components/DeliverableCard.vue](../../frontend/src/modules/home/components/DeliverableCard.vue)
- UI admin de plantillas: [frontend/src/modules/admin/components/modals/AdminDraftArtifactModal.vue](../../frontend/src/modules/admin/components/modals/AdminDraftArtifactModal.vue)

---

## Fase A — Anexos heterogéneos

### Problema
Un `document_version` tenía un único archivo (`working_file_path`/`final_file_path`). No existía forma
de adjuntar evidencias o soportes adicionales a un entregable.

### Modelo
Nueva tabla **`document_attachments`** (FK a `document_versions`, `ON DELETE CASCADE`):

| Columna | Tipo | Notas |
|---|---|---|
| `id` | INT PK | |
| `document_version_id` | INT FK | versión documental a la que pertenece |
| `kind` | ENUM | `annex` / `evidence` / `source` / `other` |
| `file_path` | VARCHAR(255) | ruta canónica en MinIO (bucket `deasy-documents`, subcarpeta `attachments/`) |
| `file_name`, `mime_type`, `size_bytes`, `description` | | metadatos |
| `uploaded_by_person_id` | INT FK | autor |
| `sort_order`, `created_at` | | orden y auditoría |

### Backend
Handlers en `user_controler.js` y rutas en `user_router.js`:

- `GET    /users/:id/process-definitions/:definitionId/task-items/:taskItemId/attachments`
- `POST   …/attachments` (multipart, multer `uploadAttachment`, hasta 50 MB; docs/imágenes/zip)
- `GET    …/attachments/:attachmentId/download`
- `DELETE …/attachments/:attachmentId`

El panel (`buildUserProcessDefinitionPanel`) incluye por cada documento/item: `attachments[]` y
`attachment_count` (carga batch vía `getAttachmentsForDocumentVersions`).

> **Nota de implementación:** `documentsByTaskItemId` se construye **después** del array `documents`
> ya enriquecido (no desde `taskItemDocuments` crudos); de lo contrario los adjuntos no llegan al item.

### Frontend
- Tab **"Anexos"** en el modal de gestión del entregable (subir con tipo, listar, descargar, eliminar),
  con badge de conteo.
- Indicador 📎 (`IconPaperclip`) con `attachment_count` en `DeliverableCard.vue`.
- Servicio: métodos `list/upload/delete/downloadDeliverableAttachment` en
  `ProcessDefinitionPanelService.js`.

---

## Fase B — Tareas libres y derivadas

### Problema
El botón "Nueva tarea" estaba deshabilitado. No había forma de crear tareas fuera de los procesos
programados (punto 3c), ni derivaciones puntuales de un entregable (punto 3b).

### Modelo
Se reutiliza todo el pipeline existente mediante un **proceso raíz "General"** sembrado de forma
idempotente con `backend/scripts/seed_general_process.mjs` — **script retirado** en `0b4ce0c`
(auditoría de 8 hallazgos); la siembra la hace hoy el bootstrap del sistema:

- `processes(slug='general')` → `process_definition_versions` "Tarea general" (active, `has_document=0`)
- artifact contenedor `tpl_general_tarea_libre` (`artifact_origin='general'`, sin render real)
- `process_definition_templates` (creates_task=1) · trigger `manual_custom_term` · target rule `all_units`

### Backend
- `hydrateGeneralTask(...)` en `TaskGenerationService.js`: materializa el `task_item` contenedor +
  documento/versión (para colgar anexos) y asigna **solo a la posición del creador** — no aplica las
  target rules, de modo que la tarea libre es **privada** de quien la crea.
- `createGeneralTask` en `user_controler.js`, ruta `POST /users/:id/general-tasks`. Dos modos:
  - **`free`** (3c): tarea libre en la unidad elegida, con periodo personalizado (tipo `CUS`).
  - **`derived`** (3b): `parent_task_id` = tarea de origen; hereda su unidad de contexto.

> **Periodo:** `terms.name` es UNIQUE global; las tareas libres usan un nombre sufijado
> (` · #<uid>-<token>`) para evitar colisiones. El frontend recorta ese sufijo en
> `getDeliverablePeriodLabel`. `terms.start_date`/`end_date` son NOT NULL (si falta el fin, se usa el inicio).

### Frontend
- Botón **"Nueva tarea"** en la cabecera del panel consolidado; modal con título, descripción,
  unidad y periodo (`openGeneralTaskModal('free')`).
- Botón **"Derivar tarea"** en el modal de gestión del entregable
  (`openDerivedTaskFromWorkspace` → modo `derived` heredando tarea y unidad).
- El proceso General aparece como opción "General" en el selector de procesos y como grupo
  "Tarea general" en el panel (gracias a la target rule `all_units`).

---

## Fase C — Control de plantillas desde la web

Alcance acordado: **metadatos + campos (schema) + flujos (llenado/firma) + gobierno de versión/stage**.
Queda fuera de alcance el editor del cuerpo de render (LaTeX/docx/jinja2), que sigue viniendo de un
seed o de un archivo subido.

### Campos del formulario (schema.json)
- `buildSchemaJsonFromFields(fields)` en `SqlAdminService.js` convierte la lista de campos de la web en
  un JSON Schema con extensiones `x-deasy-field-code` / `x-deasy-data-key` / `x-deasy-ui.{component,group}`.
- `saveTemplateArtifactDraft` acepta `data.schema_fields` (JSON) y escribe el `schema.json` real en MinIO.
- Componentes UI soportados: `text, richtext, textarea, number, switch, date, date_expression, select, hidden`.

### Flujos de llenado y firma

> **Reescrito el 2026-08-13.** Esta sección se titulaba «(meta.yaml → workflows)» y describía el camino
> que el **§0.8 del frente 0** desmontó. Lo que sigue es lo que hay hoy; el mecanismo de junio queda
> descrito en `docs/planes/plan-maestro-2026-08.md`.

- **El flujo se autora en la base, no en un YAML.** El formulario alimenta directamente
  `fill_flow_templates`/`signature_flow_templates` + sus `*_steps`, vía `_persistAuthoredFlow`
  (`services/admin/templates/workflows.js`). `buildWorkflowsYaml` ya no serializa: hoy es
  `buildWorkflowsDocument`, y su salida es **la entrada del escritor**, no un fichero.
- `saveTemplateArtifactDraft` sigue aceptando `fill_workflow` y `signature_workflow`, pero **no dispara
  ninguna sincronización**: `syncArtifactWorkflowsForTemplateArtifactId` y el resto de
  `WorkflowSyncService` se borraron. El portador del flujo es el propio `template_artifact_id`.
- Llenado: pasos con `resolver_type` — y hoy solo hay **tres**: `task_assignee`, `cargo_in_scope` y
  `specific_person`. `document_owner`, `position` y `manual_pick` salieron del `CHECK`; la base rechaza
  la fila. Siguen valiendo `selection_mode`, `cargo_code` + `unit_scope_type` y `can_reject`.
  `field_refs` es un fósil: nadie puede ponerle un valor.
- Firmas: pasos (cargo firmante, tipo electrónico). Quien marca **dónde va la firma en el PDF** es la
  columna `slot`, que el cuerpo Jinja2 embebe como `{{ signatures.<slot>.token }}`. La columna
  `anchor_refs` que se describía como «anchors por token» **no la escribe ni la lee nadie**.

### Gobierno del ciclo de vida

- El gobierno **no es** `artifact_stage` con cinco estados. Esa columna nunca llegó a existir: hoy es
  `template_artifacts.lifecycle_state` con **tres** — `draft`, `published`, `retired` — y por defecto
  `draft`. `updateTemplateArtifactStage` y `ARTIFACT_STAGE_TRANSITIONS` no existen.
- `createTemplateArtifactVersion(id)` — clona el artifact a la siguiente `storage_version` (copia objetos
  MinIO + nuevo registro en BD en `draft`). Desde el §0.8 **copia también las filas de flujo**: antes solo
  copiaba MinIO, y la versión nueva nacía sin flujo.

### Endpoints admin (sql_admin_router.js)
- `GET   /admin/sql/template_artifacts/:id/schema` — lee campos + flujo.
- `POST  /admin/sql/template_artifacts/:id/publish` y `.../retire` — las transiciones de ciclo de vida.
- `POST  /admin/sql/template_artifacts/:id/version`
- (existentes) `POST/PUT /admin/sql/template_artifacts/draft[/:id]` — alta/edición del artifact general.

### Frontend
Editor integrado en `AdminDraftArtifactModal.vue`: secciones "Campos del formulario",
"Flujo de llenado", "Flujo de firmas", y barra de gobierno (badge de estado/versión + transiciones +
"Nueva versión"). RBAC: requiere `templates.create`/`update` (rol `GestorPlantillas` o `AdminSistema`).

---

## Estado de consistencia de la documentación (auditoría 2026-06)

Hallazgos al verificar código ↔ docs existentes:

1. **Rutas obsoletas** en `roadmap-modelo-documental-y-firmas.md` (hoy archivado en
   `docs/docs-md-antiguos/planes-cerrados-2026-08/`): apuntan a
   `/home/fresvel/Sharepoint/DIR/Deploy/deasy/…` (ubicación antigua; hoy el repo está en
   `Documentos/Pucese/deasy`). También cita `frontend/src/services/admin/AdminTableManagerConfig.js`,
   que hoy vive en `frontend/src/modules/admin/services/AdminTableManagerConfig.js`.
2. **Estado desactualizado**: los roadmaps describen flujos de llenado/firma como "modelados pero no
   operativos"; el código actual los materializa y los ejecuta. *(La sincronización que se citaba aquí
   —`syncArtifactFillWorkflowForArtifact`, `syncArtifactSignatureWorkflowForArtifact`— desapareció con
   `WorkflowSyncService` en el §0.8: ya no hay nada que sincronizar, porque el flujo se escribe
   directamente en la base.)*
3. **Funcionalidad no documentada** (cubierta por este archivo): `document_attachments`, proceso General /
   tareas libres-derivadas, y el editor web de plantillas (campos, flujos, stage/versión).

> Estas observaciones se dejan registradas aquí; los roadmaps previos se conservan como referencia
> histórica de diseño. Este documento es la referencia vigente para las Fases A–C.
