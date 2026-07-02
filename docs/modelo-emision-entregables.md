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
