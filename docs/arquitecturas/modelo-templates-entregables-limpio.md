# Modelo limpio: Plantillas, Entregables y Anexos

> Documento de diseño + estado de implementación. Define cómo queda el modelo tras limpiar el ruido
> conceptual detectado en junio 2026 alrededor de `artifact_origin`, los prefijos MinIO `System`/`Users`,
> el doble concepto de "adjunto" y el enlace entregable↔plantilla.
>
> **Estado de implementación (2026-06-02):**
> - ✅ Paso 1 — proceso `default` sembrado en bootstrap (`SystemBootstrapService.ensureDefaultProcess`)
>   con plantilla base `tpl_default_memo` (`process`) y flujo de llenado `document_owner`. Firma ad-hoc.
> - ✅ Paso 2 — tareas libres migradas: `createGeneralTask` apunta al slug `default`; proceso `general`
>   viejo y contenedor vacío `tpl_general_tarea_libre` eliminados. Verificado: la tarea libre materializa
>   documento+versión+flujo de llenado.
> - ✅ Paso 5/6 (gate) — deprecado `artifact_origin` como gate de comportamiento en
>   `TaskGenerationService` (`shouldInferSignatureFlowForContext`, `getExecutableTemplatesMap` sin filtro)
>   y `DocumentSignatureWorkflowService`. Toda plantilla materializa flujos. Sin regresión en procesos existentes.
> - ✅ Paso 4 — flujo web de creación: `saveTemplateArtifactDraft` guarda `artifact_origin='process'` +
>   propiedad `Users/{cedula}/`; ejecutores deben vincular proceso destino (fail-fast antes de subir a MinIO);
>   selector "Proceso destino" en el modal. Permisos §7bis aplicados en `rbacCatalog.js`.
> - ✅ Paso 6 — `usage_role` attachment/support deprecado: enum reducido a `["primary"]` en el editor admin;
>   eliminada la ramificación muerta en ambos `shouldInferSignatureFlowForContext`. Adjunción ad-hoc va por
>   `document_attachments`. Los gates de subida (`["primary","attachment"]` en user_controler) se dejan
>   tolerantes a propósito (no ramifican comportamiento; defensa para datos legados).
> - ✅ Publicación MinIO `tpl_default_memo` — `publishDefaultTemplateAssets()` sube schema.json/meta.yaml/
>   data.yaml + cuerpo jinja2 autocontenido (`main.tex.j2`, `make.sh`) al prefijo canónico (idempotente,
>   best-effort). Validado end-to-end: render jinja2 (StrictUndefined OK) + compilación pdflatex → PDF.
> - ✅ Limpieza de campos inútiles — DROP de columnas muertas: `template_artifacts.artifact_origin`
>   (constante 'process'; propiedad por owner_ref), `process_definition_templates.usage_role` +
>   `task_items.template_usage_role` (constantes 'primary'; UNIQUE KEY reconstruido sin la columna en un
>   ALTER atómico), y `processes.unit_id/program_id/person_id/term_id` (vestigiales, nunca usadas). Migración
>   idempotente en `mariadb_initializer.js` + `mariadb_schema.sql`. Front/back limpios; build y writes OK.
> - ⏳ Pendientes: cablear el render jinja2→PDF en runtime (hoy `render_seed.py` es tooling CLI, no lo invoca
>   el backend); revisar `documents.updated_at` (siempre NULL).

## 1. Diagnóstico del ruido actual

Tres conceptos distintos están hoy entremezclados en un solo campo (`template_artifacts.artifact_origin = process | general`):

1. **Propiedad / control** — ¿la plantilla es del sistema (curada) o de un usuario?
2. **Tipo / comportamiento** — ¿materializa documento con llenado+firma, o es un contenedor suelto?
3. **Madurez del render** — ¿es un documento ofimático subido o un contrato jinja2 curado?

Además existen dos significados de "adjunto" que se confunden:

- `process_definition_templates.usage_role = attachment|support` → *plantilla secundaria planificada en la definición*.
- `document_attachments` (Fase A) → *archivos ad-hoc que el usuario sube a un entregable*.

Y un dato inconsistente: el contenedor de tareas libres `tpl_general_tarea_libre` quedó como
`artifact_origin='general'` pero almacenado bajo `System/` (debería ser de usuario o tener marcador propio).

Verificación de datos (2026-06): `process_definition_templates` y `task_items` están **100 % en `primary`**
(no hay `attachment`/`support` en uso) → unificar adjuntos es de bajo riesgo.

## 2. Los tres ejes, separados

### Eje A — Propiedad (dónde vive / quién controla)
Expresado por el **prefijo MinIO** en `base_object_prefix`:

- `System/…` → plantilla **del sistema**, curada por el administrador.
- `Users/{cedula}/…` → plantilla **de un usuario** (gestor de procesos u operativo).

### Eje B — Tipo / comportamiento → **una sola clase: toda plantilla es de proceso**
Decisión del usuario (2026-06-02): **toda plantilla tiene flujos de llenado y firma obligatorios.**
No existen plantillas "sueltas sin flujo". En consecuencia **NO se introduce `template_kind` ni
`free_container`** — habría sido un tipo de plantilla-sin-flujo, que contradice la regla.

Implicación: `artifact_origin` (`process|general`) deja de tener sentido como discriminador de
comportamiento, porque **todo es de proceso**. Se **deprecia `artifact_origin`**:

- El gate que hoy es `artifact_origin === 'process'` (en `shouldInferFillFlow`,
  `DocumentSignatureWorkflowService`, `getExecutableTemplatesMap`) deja de ramificar: **todas las
  plantillas materializan documento + llenado + firma**.
- El antiguo valor `general` se elimina (ver §5 sobre la tarea libre, que pasa a ser un entregable real
  con su propia plantilla).

### Eje C — Madurez del render → **estado de render**
Indica el nivel del cuerpo del documento. Se apoya en `available_formats` (ya existe) + un marcador de madurez:

- `office` → cuerpo subido en Word/Excel/PDF/PPT (lo que sube el gestor/usuario).
- `jinja2` → contrato jinja2 curado (render dinámico real), producido al **promover** la plantilla.

> Principio rector del usuario: **toda plantilla aspira a llegar a un contrato jinja2 curado por el
> administrador**. Lo `office` es el punto de partida; el admin lo promueve a `jinja2`.

## 3. Matriz de casos (cómo quedan los orígenes)

Toda plantilla es de proceso y con flujos. Las columnas que quedan son **propiedad** (dónde vive) y
**render** (madurez del cuerpo):

| Caso | Quién crea | Propiedad | Render | Llenado/Firma |
|---|---|---|---|---|
| **Plantilla oficial** | Admin (CLI o web) | `System/` | `jinja2` | sí |
| **Plantilla de gestor** | Gestor de procesos (web) | `Users/{cedula}/` | `office` → (admin promueve a `jinja2`) | **sí, obligatorios** |
| **Entregable abierto / adicional** | Usuario operativo (web) | `Users/{cedula}/` | `office` → (admin promueve) | **sí, obligatorios** |
| **Tarea libre** | Usuario, bajo el **proceso `default`** | `Users/{cedula}/` (o plantilla base del proceso `default`) | `jinja2` base o `office` | **sí, obligatorios** |

Notas:
- La "creación abierta de entregable" **genera una plantilla propia** (`Users/`), no un documento suelto.
- La "tarea libre" **deja de ser un contenedor vacío**: es un entregable real bajo el **proceso por
  defecto `default`** (ver §5). No existe `free_container` ni `template_kind`.

## 4. Enlace Plantilla → Entregable → Documento → Anexos (aclarado)

La cadena real (verificada en el esquema) es de **molde → instancia → resultado → adjuntos**:

```
template_artifacts                 (EL MOLDE: schema, render, flujos, kind, propiedad)
  └─ process_definition_templates  (vínculo definición↔artifact; creates_task)
       └─ task_items               (EL ENTREGABLE: process_definition_template_id + template_artifact_id)
            └─ documents           (contenedor; origin_type: task_item|standalone|imported|generated)
                 └─ document_versions      (template_artifact_id = con qué plantilla se generó)
                      ├─ archivo principal  (working_file_path / final_file_path)
                      └─ document_attachments  (ANEXOS ad-hoc: kind=annex/evidence/source/other)
```

Claves para despejar la duda del usuario:

- **El entregable sigue atado a la plantilla** por `task_items.template_artifact_id` (+ el vínculo de
  definición). Esto **no cambió** con los anexos.
- **Los anexos cuelgan de `document_versions`, un nivel por debajo del entregable.** Son archivos
  *adicionales al resultado*, no redefinen la plantilla.
- **`documents.origin_type`** distingue cómo nació el documento: `task_item` (proceso programado),
  `standalone` (creación abierta / tarea libre), etc.

## 4bis. Proceso por defecto `default` (sembrado en bootstrap)

Decisión del usuario (2026-06-02): las **tareas libres** no son contenedores vacíos, sino **entregables
reales bajo un proceso por defecto** llamado **`default`**, que se **siembra en el primer arranque del
sistema** (`SystemBootstrapService.initializeSystem`), junto al catálogo RBAC base y la unidad raíz.

Por qué en el bootstrap (no en un script suelto):

- El bootstrap ya siembra "lo que el sistema necesita para funcionar" de forma **idempotente** y solo en
  modo `bootstrap` (instalación virgen; en `recovery` no toca datos operativos).
- Elimina el paso manual frágil de `seed_general_process.mjs` (que hoy hay que recordar correr).
- Garantiza que el proceso `default` y su plantilla base existan siempre desde el arranque.

Qué se siembra:

- Proceso `default` (slug `default`) con su definición activa + trigger `manual_custom_term` + target rule
  `all_units` (igual que el actual General, pero ahora curado en bootstrap).
- **Plantilla base del proceso `default`**: una plantilla **jinja2 mínima** tipo memo/oficio genérico
  (campos: asunto, cuerpo, fecha) **con flujo de llenado y firma** — cumpliendo la regla "toda plantilla
  tiene flujos". Reemplaza al contenedor vacío `tpl_general_tarea_libre` (que se elimina).

Resultado: una tarea libre se crea bajo `default`, materializa documento + versión + flujos como cualquier
entregable, y admite anexos (`document_attachments`). Sin tipos especiales ni parches.

## 5. Unificación del doble "adjunto" (decisión del usuario)

Se **unifica toda adjunción en `document_attachments`** y se **deprecia `usage_role = attachment|support`**:

- `process_definition_templates.usage_role` y `task_items.template_usage_role` quedan efectivamente en
  `primary` (único valor en uso). Se documenta como deprecado; el ENUM puede conservarse por
  compatibilidad pero no se generan nuevos `attachment`/`support`.
- Cualquier archivo adicional a un entregable es un **anexo ad-hoc** (`document_attachments`), no una
  plantilla secundaria planificada.
- Impacto en código: `shouldInferFillFlow` / `shouldInferSignatureFlow` / `canUploadDeliverable` dejan de
  ramificar por `usage_role === 'attachment'` (hoy ya solo hay `primary`).

## 6. Pipeline de maduración (gobierno)

```
   NIVEL USUARIO (autoservicio, Users/ + office)        NIVEL SISTEMA (curado, System/ + jinja2)
   ───────────────────────────────────────────         ────────────────────────────────────────
   Gestor/usuario sube Word/Excel/PDF            ──►     Admin revisa y promueve a contrato jinja2
   define schema + llenado + firma (obligatorios)        (render dinámico real, control institucional)
   render=office                                         render=jinja2
   stage: draft→review                                   stage: approved→published
```

El gobierno por `artifact_stage` (Fase C ya implementada: draft→review→approved→published→archived)
es el mecanismo de promoción: el admin aprueba/publica y, al curar, sube el render jinja2.

## 7. Plan de migración propuesto (por fases, aún no ejecutado)

1. **Bootstrap del proceso `default`**: mover la siembra del proceso por defecto a
   `SystemBootstrapService` (`ensureDefaultProcess`), idempotente, con su **plantilla base jinja2** (memo
   genérico con flujos de llenado y firma). Elimina el script `seed_general_process.mjs` y el artifact
   contenedor vacío `tpl_general_tarea_libre`.
2. **Gate de comportamiento**: como **toda plantilla materializa llenado/firma**, eliminar los checks de
   `artifact_origin === 'process'` en `TaskGenerationService.js` (`shouldInferFillFlow`,
   `getExecutableTemplatesMap`) y `DocumentSignatureWorkflowService.js`. **Deprecar `artifact_origin`**
   (queda sin función de gate; opcionalmente se retira o se reduce a sinónimo de propiedad).
3. **Render maduro**: derivar la madurez del cuerpo de `available_formats` (presencia de `process.jinja2`
   ⇒ `jinja2`; si solo hay `general/*` ⇒ `office`). No requiere campo nuevo.
4. **Flujo web de creación** (`saveTemplateArtifactDraft`): dejar de fijar `artifact_origin='general'`;
   propiedad `Users/` para gestor/usuario, render `office`; **validar llenado+firma obligatorios** antes
   de permitir guardar/publicar.
5. **Migrar tareas libres** existentes al proceso `default` con plantilla base; retirar el contenedor vacío.
6. **Deprecación de `usage_role` attachment/support**: documentar; limpiar ramas de código (hoy ya solo
   hay `primary`). Toda adjunción ad-hoc va por `document_attachments`.
7. **Permisos** (ver §7bis): dar a `GestorEjecucionProcesos` `templates: [read, create, update]` y subir
   `documents` a control total; mantener `process_definitions: [read]` (no crea definiciones). Validar que
   sus plantillas se creen **siempre vinculadas** a un proceso existente o a `default`. `GestorProcesos`
   sube a `templates: [read, create, update, delete, manage]`.

## 7bis. Matriz de permisos sobre plantillas (decisión usuario 2026-06-02)

| Rol | `process_definitions` | `templates` | Puede crear plantillas | Restricción |
|---|---|---|---|---|
| **AdminSistema** | manage (todo) | manage (todo) | Sí | ninguna |
| **GestorProcesos** | read/create/update/delete/manage | **read/create/update/delete/manage** | Sí, **control total** (incl. borrar/archivar maestras) | ninguna; diseña procesos y sus plantillas |
| **GestorEjecucionProcesos** | **read** (no crea definiciones) | **read/create/update** | Sí, pero **solo vinculadas** a un proceso ya definido o a `default` | no puede crear definiciones ni borrar plantillas |

Reglas derivadas:

- **GestorProcesos = diseñador**: crea definiciones, plantillas, las vincula, y puede borrar/archivar
  plantillas maestras (control total, igual que sobre definiciones).
- **GestorEjecucionProcesos = operador**: puede **crear plantillas**, pero al crearlas **debe elegir un
  proceso destino** (existente o `default`) — quedan vinculadas vía `process_definition_templates` en el
  acto de creación. Como no tiene `process_definitions.create`, **no puede inventar procesos nuevos** ni
  dejar plantillas "sueltas". Su techo es `update` sobre plantillas (sin delete/manage).
- **Implicación técnica**: el flujo web de creación debe, para este rol, **exigir `process_definition_id`
  destino** y crear el vínculo `process_definition_templates` en la misma transacción. Para GestorProcesos
  el vínculo puede ser opcional/posterior.

## 8. Decisiones registradas (usuario, 2026-06)

- Creación abierta de entregable → **genera plantilla propia** (`Users/`).
- Doble adjunto → **unificar en `document_attachments`**, deprecar `usage_role` attachment/support.
- **Toda plantilla tiene flujos de llenado y firma obligatorios** → NO existe `free_container` ni
  `template_kind`; se **deprecia `artifact_origin`** como gate (todo es de proceso).
- **Tarea libre = entregable real bajo el proceso `default`**, sembrado en **bootstrap** con plantilla base
  **jinja2** (memo genérico). Reemplaza el contenedor vacío.
- Toda plantilla aspira a un **contrato jinja2 curado por el administrador** (pipeline office→jinja2 vía
  `artifact_stage`).
- **Permisos** (ver §7bis): GestorProcesos = control total sobre plantillas; GestorEjecucionProcesos =
  crear/editar plantillas **siempre vinculadas** a un proceso existente o `default`, sin crear definiciones.

## 9. Pendiente de confirmar antes de implementar

- Rol `GestorPlantillas`: el usuario indicó "de momento no" → se deja para después (existe pero sin asignar;
  su función queda cubierta por GestorProcesos/GestorEjecucionProcesos según §7bis).
- Diseño del **render base jinja2** del proceso `default` (campos del memo/oficio genérico) — a concretar
  al implementar el bootstrap.
