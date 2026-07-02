# Modelo de emisión de entregables (single / replicated / routed)

> Fuente de verdad del modelo de negocio para los **modos de emisión** de entregables.
> Definido por el usuario (2026‑07‑01). Si el código contradice esto, el código está mal.

## Contexto

`procesos → tareas → entregables`. Cada **plantilla ligada** a una configuración de
proceso declara su **modo de emisión** en `process_definition_templates.item_mode`
(`ENUM('single','replicated','routed')`). El modo define **cuándo/cómo** se instancian
sus entregables y **de dónde sale su flujo** (entrega + firma).

## Los tres modos

- **single** — El entregable y su **flujo (entrega + firma) están PREDEFINIDOS en la
  plantilla** (se autoran en el editor de plantilla). Al lanzar el proceso se genera
  **una** instancia para el responsable que resuelven las reglas de alcance.
  *Ej.: Informe de Investigación Formativa.*

- **replicated** — El flujo también está **PREDEFINIDO** en la plantilla. El responsable
  crea **N réplicas** (una por caso) con una **etiqueta diferenciadora**; cada réplica
  **hereda el mismo flujo** del original. No hay fan‑out automático: el usuario crea cada
  réplica. *Ej.: requerimiento docente (una por cada nuevo docente).*

- **routed** — El entregable **NO trae flujo predefinido**. Es **al instanciar** (cuando
  el usuario crea la tarea/instancia) **cuando el usuario DEFINE su flujo de entrega y
  firma** (quién llena, quién firma). El flujo es de **runtime**, no de autoría.

## Proceso por defecto = un routed especial

El **"Proceso por defecto"** es un proceso **routed** para **tareas ad‑hoc que NO
pertenecen a ningún proceso**, que **cualquier usuario puede asignar en cualquier
momento**. *Ej.: un coordinador manda a hacer el informe de un evento casual.*
**NO tiene que ver con "memorandums"** — un memorándum, si se quisiera, sería otro routed
con su propia plantilla/uso, pero eso no es lo que define al proceso por defecto.

## Implicación de autoría (IMPORTANTE)

- **single / replicated**: se **autora** el flujo (entrega + firma) en la plantilla.
  Resolutores **autorables por web** (plantilla *official* / de proceso):
  - **Responsable del entregable** (`task_assignee`)
  - **Por cargo** (`cargo_in_scope`)
  - (*ad_hoc* añade **Persona concreta** = `specific_person`)
- **routed**: **NO se autora** flujo en la plantilla; se **construye en runtime** al crear
  la instancia.

**DEPRECADO — no usar en autoría ni en guías:** `document_owner` ("Responsable del
documento"), `position`, `manual_pick`. Siguen en el `ENUM` de la BD solo por
legado/seed/runtime, pero **no** son opciones de autoría web.

## Estado de implementación (honesto, para handoff)

- **single** — ✅ implementado (autoría de flujo + generación al lanzar).
- **replicated** — ✅ implementado (réplica etiquetada que hereda el flujo del original).
- **routed** — ⚠️ **PARCIAL / NO coherente con el concepto todavía.** Lo implementado
  (F‑B/F3/R1‑R4 de la sesión previa) es una versión **simplificada**: al crear la instancia
  se elige **un solo destinatario** (`task_items.target_person_id`) que queda como dueño y
  firma vía un paso `document_owner` **SEMBRADO** en el bootstrap (no autorado). El
  "Proceso por defecto" parece funcionar solo por ese atajo sembrado, **no** por el modelo
  real. **FALTA** el pilar del concepto: el **editor de flujo en runtime** para que el
  usuario defina entrega + firma al instanciar un routed.

## Deuda / a corregir (próxima sesión)

1. **routed = flujo en runtime**: construir el editor que, al crear la instancia, permita
   definir los pasos de **entrega** y **firma** con sus resolutores/personas —
   reemplazando el atajo "un destinatario + `document_owner` sembrado".
2. Erradicar `document_owner` / "Responsable del documento" de guías y autoría.
3. Revisar que la plantilla de un routed **no** requiera flujo predefinido (hoy el default
   trae un fill `document_owner` sembrado que es el atajo a quitar).

## Modelo de datos (referencia)

- `process_definition_templates.item_mode` — el modo por plantilla ligada.
- Réplicas/instancias routed = `task_items` con `origin_kind='user_added'`.
- `task_items.target_person_id` — usado hoy por el atajo routed (dueño = destinatario, vía
  `resolveOwnerPersonIdForTaskItem`, que alimenta el resolutor `document_owner`).

---

## Auditoría modelo ↔ código (2026‑07‑01, verificado archivo:línea)

| Modo | Veredicto | Evidencia |
|---|---|---|
| **single** | ✅ **Aplica** | Siembra filtrada a `single` → 1 instancia al lanzar (`TaskGenerationService.js:1172,1236`); flujo predefinido heredado del template ligado (`746‑838`, `290‑304`). Autoría web `task_assignee`/`cargo_in_scope`. |
| **replicated** | ✅ **Aplica** | 0 siembra al lanzar; el usuario crea N réplicas `user_added` con etiqueta (`user_controler.js:3806‑3842`) que **heredan** el flujo del template vía `process_definition_template_id` (`TaskGenerationService.js:761‑776`; firma `DocumentSignatureWorkflowService.js:660‑662`). |
| **routed** | ⚠️ **Diverge** | El modelo exige flujo **definido al instanciar**; el código solo captura **etiqueta + 1 destinatario** (`user_controler.js:3685,3790‑3804`; `HomeView.vue:4829‑4842`, sin pasos) y **hereda** el flujo del template (misma vía que single). **No existe editor de flujo runtime.** |
| **Proceso por defecto** | ⚠️ **Diverge (mismo defecto)** | Funciona por un **atajo**: link `item_mode='routed'` + un paso `document_owner` **sembrado** (`SystemBootstrapService.js:537,563‑567`); el destinatario queda como owner (`resolveOwnerPersonIdForTaskItem:987‑990` → resolver `document_owner:548‑549`). |
| **Autoría de flujo** | ✅ **Aplica** | Solo `task_assignee`/`cargo_in_scope` (+`specific_person` en ad_hoc); **sin** `document_owner`/`position`/`manual_pick` (`SqlAdminService.js:261`; modal `307‑311/468‑471`). El editor **ignora `item_mode`** (el modo vive en el LINK, no en la plantilla). |

**Divergencia central:** para `routed`, el flujo se resuelve por el **template ligado**
(`getActiveFillFlowTemplateForDefinitionTemplate`, misma ruta que single/replicated). **No
hay ningún camino donde el usuario defina los pasos al instanciar.** El "editor de flujo en
runtime" —pilar del modelo— no existe. El front está limpio de `document_owner`
("Responsable del documento") — 0 coincidencias.

---

## Plan P1 — Editor de flujo en runtime para routed (cierra la brecha)

**Objetivo:** al crear una instancia routed, el usuario **define el flujo de entrega +
firma** (pasos con **personas concretas**); el backend materializa ese flujo **POR
INSTANCIA**, sin heredar el del template. Reemplaza el atajo "1 destinatario +
`document_owner` sembrado".

### Idea clave (reuso, sin resolutores nuevos)
Como es runtime, el usuario elige **personas concretas** → cada paso = resolutor
**`specific_person`** con `person_id`. No se necesita `document_owner` ni un resolutor
"destinatario". Se reusa la maquinaria de `fill_flow_*`/`signature_flow_*`.

### Decisión de esquema (a resolver primero)
`fill_requests.fill_flow_step_id` y `signature_requests.step_id` son **FK NOT NULL** a las
tablas de pasos, y `fill_flow_templates.process_definition_template_id` /
`signature_flow_instances.template_id` son **NOT NULL**. ⇒ un flujo por‑instancia necesita
filas de **template + steps propias**. **Recomendado:** añadir columna nullable
**`task_item_id`** a `fill_flow_templates` y `signature_flow_templates`:
- flujo de plantilla (single/replicated) → `task_item_id IS NULL` (como hoy);
- flujo por‑instancia (routed) → `task_item_id = <el ítem>`.
La búsqueda "activa por link" (`getActiveFillFlowTemplateForDefinitionTemplate`) añade
`AND task_item_id IS NULL`; la materialización de un routed busca el flujo por `task_item_id`.

### Backend (fases)
1. **Esquema**: `task_item_id` (nullable, FK) en `fill_flow_templates` + `signature_flow_templates` (schema + `mariadb_initializer` idempotente).
2. **Contrato**: `createGeneralTask` (routed/free) acepta `flow` en el body:
   `{ entrega:[{person_id|"me"}...], firma:[{signers:[person_id...], approval_mode, required_min}...] }`.
   Validar personas activas, ≥1 paso de entrega, orden.
3. **Materialización por instancia**: tras crear `task_item`+`documents`+`document_versions`,
   crear un `fill_flow_template`(+steps `specific_person`)/`signature_flow_template`(+steps)
   con `task_item_id` = el ítem, y materializar `fill_requests`/`signature_requests`
   (reusando la maquinaria existente, apuntada al flujo por‑instancia). Variante
   `ensureFillFlowForDocumentVersion` que prefiera el flujo por `task_item_id` si existe.
4. **Retirar el atajo**: dejar de sembrar `document_owner` en el proceso por defecto
   (`SystemBootstrapService`); su flujo también se define en runtime. Revisar el uso de
   `target_person_id` (puede quedar como metadato "destinatario principal" para "Para:").

### Frontend (fases)
1. **Componente flow‑builder runtime** (reutilizable): extraído de los sub‑forms
   "Quién hace el paso"/"Quién firma" de `AdminDraftArtifactModal`, pero eligiendo
   **personas concretas** (buscador `task-recipients`), no resolvers.
   - Entrega: lista de pasos (persona; "yo" por defecto en el 1º).
   - Firma: lista de pasos (firmantes + aprobación: todas/cualquiera/mínimo N).
2. **Modal "Nuevo envío"**: reemplazar el "1 destinatario" por el flow‑builder; enviar `flow`.
3. **P2 (aviso en Paquetes)**: "El flujo de un routed se define AL ENVIAR, no aquí."

### Decisiones a confirmar (próxima sesión)
- ¿La entrega runtime permite también resolvers (cargo) o **solo personas concretas**?
  (el modelo dice "el usuario determina" → personas concretas; cargo sería extensión).
- "Para:" / "Mis envíos" con flujo multi‑persona: ¿mostrar el/los firmantes o un
  "destinatario principal"?
- Convivencia/migración de routed existentes (default con `document_owner` sembrado).

### Verificación objetivo
Crear un routed en runtime con entrega=autor + firma=persona X → materializa
`fill_request`(autor) + `signature_request`(X) → autor llena, X firma. E2E, sin
`document_owner`.

---

## Estado P1 — IMPLEMENTADO (2026‑07‑02)

Commits: `841ba4a` (esquema), `87849ea` (materialización), `6cbe326` (frontend + fix).

- **Esquema**: `task_item_id` (nullable, FK) en `fill_flow_templates` /
  `signature_flow_templates` (+ migración idempotente). NULL = flujo de plantilla; != NULL
  = flujo por instancia (routed).
- **Backend**: `materializeRuntimeFlowForTaskItem` crea el flujo por instancia con pasos
  `specific_person` desde `flow{entrega[],firma[]}`. `getActive{Fill,Signature}FlowTemplate…`
  aceptan `taskItemId` y **prefieren** el flujo por instancia; el lookup de plantilla excluye
  los por instancia. `createGeneralTask` (routed derived + free) parsea `flow` y lo
  materializa antes de crear el documento.
- **Frontend** (`HomeView`): el modal "Nuevo envío" trae un **flow‑builder** — "Elabora
  (entrega)" + "Firma (en orden)" con personas concretas (chips + buscador; "Tú (autor)"
  por defecto). Envía `flow`; `recipient_person_id` = destinatario principal derivado
  (owner/"Para:").
- **Verificado E2E** (UI + API): envío entrega=autor(24)/firma=CAE(12), owner=12 →
  `fill_request` para el **autor (24)** desde el flujo por instancia (`specific_person`),
  **no** vía `document_owner`. La firma (CAE) se activa tras la entrega (secuencial).

**Completado después de P1:**
- **P1.4 (2026‑07‑02, `1e40434`)**: retirado el `document_owner` sembrado del proceso por
  defecto. El default define su flujo al enviar (runtime). Verificado: un envío sigue
  materializando el fill al autor desde el flujo por instancia; el modelo ya no depende del
  seed.
- **P2 — pasos por cargo + aprobación (`51c7f13` back, `923565d` front)**: cada paso de
  entrega/firma puede ser **persona concreta** (`specific_person`) o **por cargo**
  (`cargo_in_scope` + ámbito unidad/tipo). La **firma por cargo** lleva `approval_mode`
  (todas / cualquiera / mínimo N). Nuevo endpoint `GET /:id/flow-catalog` (unidades +
  cargos). El destinatario "Para:" pasa a ser opcional (puede ser null si la firma es por
  cargo). Verificado E2E (UI + API).

**Multi‑firmante — CERRADO (`c2555ce`).** (La nota anterior era errónea: el esquema **sí**
soporta varios firmantes por paso vía `signature_flow_steps.signers JSON`, resuelto por
`parseStepSigners`/`resolveSignatureStepAssignees`, con quórum por `approval_mode`.) Ahora se
expone en runtime: la firma se arma por **pasos**, cada paso con **1..N firmantes** (persona
o cargo) y **aprobación** (todas/cualquiera/mínimo N). Materialización escribe `signers` JSON
+ `approval_mode` + `required_signers_min`. Contrato: `flow.firma = [{ signers:[…],
approval_mode, required_min }]`. Verificado E2E (API + UI): 2 personas concretas en un paso
paralelo con quórum.

**Deuda restante (menor):**
- Ciclo humano entrega→firma end‑to‑end no ejercitado (usa la misma maquinaria de `single`).
- "Para:" cuando el destinatario es un cargo (no muestra 1 persona).
- Migración de instalaciones previas con `document_owner` sembrado (solo afecta a instalados
  antes de P1.4; en dev se resuelve con reset).

---

## Plan P3 — Consolidar administración de plantillas en el proceso + `item_mode` al crear

**Motivación (verificada archivo:línea):** `item_mode` vive en el LINK
`process_definition_templates`, no en la plantilla. Hoy el link se inserta **sin `item_mode`**
→ queda en `DEFAULT 'single'` (`SqlAdminService.js` INSERT del link). El selector de modo solo
existe en `AdminDefinitionArtifactsPanel.vue` (panel del proceso), **no** en la creación de la
plantilla (`AdminDraftArtifactModal.vue`, que además exige elegir proceso con
`requireProcessLink=true`). El esquema ya asume dueño único por plantilla
(`deliverables.owner_process_id`), así que el "proceso destino" del modal es redundante.

**Objetivo:** (A) fijar el modo de emisión **al crear** la plantilla; (B) entrada única desde
el proceso (proceso implícito por contexto), reduciendo campos del modal.

**Decisiones asumidas:** dueño único por plantilla (`owner_process_id`); `ad_hoc` fuera de
alcance (ciclo de runtime); la pestaña global "Plantillas" pasa a solo lectura/descubrimiento.

### Fases
1. **Backend — aceptar `item_mode` al crear/vincular** (`SqlAdminService.js`,
   `sql_admin_router.js`): validar ENUM `single|replicated|routed` (default `single`),
   incluirlo en el INSERT de `process_definition_templates`; **relajar** el fail‑fast de
   "≥1 paso de entrega" cuando el modo es `routed` (routed no autora flujo). Aditivo, sin ruptura.
2. **Frontend — selector de modo en el modal de creación** (`AdminDraftArtifactModal.vue`,
   `useAdminDraftArtifactFlow.js`): `<select>` `item_mode` en *General* (reusar labels/aviso de
   `AdminDefinitionArtifactsPanel`); si `routed` ocultar/deshabilitar pestañas de flujo.
3. **Frontend — entrada única desde el proceso** (`AdminDefinitionArtifactsPanel.vue`,
   `AdminTableManager.vue`): botón "Crear plantilla nueva" en el panel → abre el modal con
   `preselectProcessDefinitionId`; ocultar el bloque "Configuración destino" cuando llega
   preseleccionado (chip de solo lectura). Gate a `draft` (ya existe).
4. **Frontend — pestaña global "Plantillas" → solo lectura** (`AdminTableManagerConfig.js`):
   sin "crear" fuera de contexto; editar/versionar ancla al `owner_process_id`.
5. **Verificación E2E (Docker)**: crear single/replicated/routed dentro de un proceso draft;
   confirmar `item_mode` en el link y que routed no exige flujo; `pnpm run lint`.
6. **Docs/memoria**: actualizar este doc y `project_item_emission_modes.md`.

### Estado (2026‑07‑02)
- **F1 — HECHO**. Backend acepta `item_mode` al crear el link (`SqlAdminService.createTemplateArtifactDraft`):
  constante `ITEM_EMISSION_MODES` + `normalizeItemMode`, INSERT del link con el modo solicitado
  (antes caía siempre a `DEFAULT 'single'`), y **fail‑fast de flujo relajado para `routed`**
  (routed no autora flujo). Verificado E2E por API: crear routed sin flujo → 200 con link
  `item_mode='routed'`; crear single sin flujo → 400 (gate intacto). *Nota: backend corre
  `node index.js` sin hot‑reload; requiere reiniciar el contenedor tras editar.*
- **F2 — HECHO**. `AdminDraftArtifactModal`: selector "Modo de emisión" (solo al crear); si `routed`
  se ocultan las pestañas Entrega/Firmas (`visibleTabKeys`) y `canSubmit` no exige flujo.
  `useAdminDraftArtifactFlow`: envía `item_mode` en el FormData (solo al crear). Lint OK.
- **F3 — HECHO**. La creación desde el proceso ya existía (botón "Agregar plantilla" → pestaña
  "Crear" con `preselectDefinitionId`). Se redujeron campos del modal **omitiendo los de solo
  lectura redundantes en la creación**: (a) "Configuración destino" no se muestra cuando la config
  llega por contexto (`hasPreselectedProcess`) — el vínculo se resuelve por `preselectProcessDefinitionId`;
  (b) el badge "Tipo de plantilla" solo aparece en edición/consulta (al crear desde admin siempre es
  oficial). Lint OK.
- **F4 — HECHO**. La tabla global "Plantillas" (`template_artifacts`) pasa a **consulta/versionado**:
  se oculta el botón "Crear" (`canCreateCurrentTable && !isTemplateArtifactsTable`) y se añade un
  banner informativo ("las plantillas se crean desde un proceso"). En el modal, "Configuración
  destino" tampoco se muestra al **editar** (el vínculo se conserva; se gestiona desde el proceso).
  Editar/versionar desde la tabla sigue disponible. Lint OK.
- **F5 — HECHO** (E2E de UI, Chrome DevTools MCP, admin). Verificado: (a) tabla global "Plantillas"
  muestra el banner y **no** tiene botón "Crear"; (b) en la config Memorandum (draft) → Paquetes →
  "Agregar plantilla" → "Crear nueva", el modal muestra **Modo de emisión** y **oculta**
  "Configuración destino" y el badge "Tipo de plantilla"; (c) al elegir **Ruteado** desaparecen las
  pestañas **Entrega/Firmas** y aparece el aviso "el flujo se define AL ENVIAR". Capturas en scratchpad.
- **F6 — HECHO** (memoria `project_item_emission_modes.md` actualizada con el cierre P3).
- **Deuda del tooltip — RESUELTA.** El `title` del botón "Crear plantilla" deshabilitado ahora es
  dinámico (`submitBlockReason`): lista SOLO lo que falta según modo/contexto. Verificado en UI: un
  `routed` desde el proceso muestra "Faltan: documento de referencia." (sin "proceso destino" ni "flujo").

**PLAN P3 COMPLETO (F1–F6).**
