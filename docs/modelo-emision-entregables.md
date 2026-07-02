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
