# Decisiones del modelo de entregables · junio 2026

## Proposito

Este documento registra las decisiones de negocio acordadas para limpiar el modelo de procesos,
plantillas, tareas y entregables. Es un documento de decision: no implica que todos los cambios ya
esten implementados.

Complementa y corrige parcialmente el enfoque descrito en
[redisenio-entregables-2026-06.md](./redisenio-entregables-2026-06.md), especialmente en lo relativo
a tareas derivadas con `parent_task_id`.

## Checklist de decisiones

- [x] Definir `task_items` como instancia de entregable.
- [x] Definir que cada entregable tiene un unico documento principal versionado.
- [x] Mantener anexos/evidencias fuera del documento principal, usando `document_attachments`.
- [x] No crear tareas hijas para entregables adicionales del usuario.
- [x] Deprecar funcionalmente `parent_task_id` para derivacion de entregables.
- [x] Separar plantilla documental de entregable definido por proceso.
- [x] Mantener la relacion M:N entre configuraciones de proceso y plantillas.
- [x] Eliminar la obligatoriedad del entregable definido por proceso (`is_required`), porque todo
  entregable vinculado a una configuracion activa se considera requerido.
- [x] Clasificar plantillas en `official`, `user_reusable` y `ad_hoc`.
- [x] Clasificar instancias de entregable solo en `process_defined` y `user_added`.
- [x] Deprecar `tasks.launch_mode`: toda tarea pertenece a un proceso; las tareas sueltas usan
  proceso `default` y los agregados manuales son `task_items.user_added`.
- [x] Definir que todo entregable pasa por revision antes de firma.
- [x] Mantener revision/llenado y firma como fases distintas, compartiendo resolucion de responsables
  y observaciones.
- [x] Definir que los entregables `user_added` crean sus flujos en runtime; pueden heredar, pero la
  herencia no es la opcion principal.
- [x] Definir responsables por cargos/contexto para `process_defined` y por personas especificas
  para `user_added`.
- [x] Definir convencion MinIO para plantillas `official`, `user_reusable` y `ad_hoc`.
- [x] Definir el proceso `default` como proceso tecnico para tareas/entregables sueltos.
- [x] Definir nomenclatura UX principal para limpiar nombres tecnicos.
- [ ] Definir tabla final de observaciones/mensajes para revision y firma.
- [ ] Definir columnas exactas para origen y destino del entregable.
- [ ] Definir migracion tecnica y UX/UI completa.

## Mapa conceptual acordado

| Concepto de negocio | Tabla actual | Decision |
|---|---|---|
| Plantilla documental versionada | `template_artifacts` | Se mantiene. Define estructura, archivos base, schema, render y metadatos de plantilla. |
| Entregable definido por proceso | `process_definition_templates` | Se mantiene como relacion entre configuracion/version de proceso y plantilla. Debe limpiarse y enriquecerse. |
| Instancia de entregable | `task_items` | Se mantiene. Es el entregable real generado dentro de una tarea. |
| Documento principal | `documents` | Se mantiene. Debe haber un documento principal por entregable. |
| Version documental | `document_versions` | Se mantiene. Versiona el documento principal. |
| Anexos/evidencias | `document_attachments` | Se mantiene para archivos secundarios. |

## Decision 1: `task_items` es la instancia de entregable

`task_items` no se reemplaza. Se declara como la entidad que representa el entregable real generado
por una tarea.

Reglas:

- Una `task` representa la ejecucion operativa de un proceso en un contexto.
- Un `task_item` representa cada entregable dentro de esa tarea.
- Un entregable adicional creado por el usuario se agrega como nuevo `task_item` dentro de la misma
  `task`.
- El entregable adicional no debe crear una tarea hija por defecto.

## Decision 2: un entregable tiene un documento principal

Se adopta la opcion A:

- Un `task_item` tiene un unico documento principal.
- Ese documento principal se versiona en `document_versions`.
- Evidencias, soportes, anexos o archivos secundarios se modelan con `document_attachments`.
- Si algo requiere revision/firma propia como entregable independiente, debe ser otro `task_item`.

Implicacion:

- `instance_mode = owner_many_documents` queda bajo revision, porque puede contradecir la regla de
  un documento principal por entregable.

## Decision 3: `parent_task_id` no modela entregables derivados

Aunque existe implementacion actual de tareas libres/derivadas usando `parent_task_id`, el nuevo
modelo no debe usar tareas hijas para representar entregables adicionales.

Reglas:

- `parent_task_id` queda deprecado funcionalmente para derivacion de entregables.
- La UI debe migrar de "Derivar tarea" a "Agregar entregable".
- El backend debe crear un nuevo `task_item` en la misma `task`, no una nueva `task` hija.
- La eliminacion fisica de `parent_task_id` debe hacerse solo despues de retirar endpoints, UI y
  logica de propagacion de estado padre-hijo.

Uso futuro posible, pero no activo:

- Subprocesos reales con ciclo independiente.
- Delegaciones formales a otra unidad con tablero propio.
- Reaperturas/correctivos con auditoria separada.

## Decision 4: plantilla documental vs entregable definido por proceso

Una plantilla no es lo mismo que un entregable definido por proceso.

Reglas:

- `template_artifacts` describe el molde documental.
- `process_definition_templates` describe que una configuracion de proceso usa una plantilla como
  entregable.
- Una misma plantilla puede usarse en varios procesos o versiones de proceso.
- Si cambian responsables, reglas, orden, contexto o flujo por proceso, no hace falta crear una nueva
  plantilla.
- Si cambia el documento en si, su estructura, campos, anclas, layout, schema o archivos base, se
  debe crear nueva version de plantilla.

## Decision 5: eliminar obligatoriedad del entregable definido por proceso

El campo `process_definition_templates.is_required` se considera obsoleto.

Regla de negocio:

- Todo entregable vinculado a una configuracion de proceso activa se considera requerido.

Implicaciones:

- Eliminar `is_required` de la UX/UI.
- Eliminar validaciones y formularios que permitan marcar un entregable definido como opcional.
- Migrar datos existentes asumiendo `is_required = 1`.
- Eliminar la columna en una migracion posterior.

Nota:

- Esto no decide aun sobre `fill_flow_steps.is_required` o `signature_flow_steps.is_required`; esos
  campos pertenecen a pasos de flujo y deben evaluarse por separado.

## Decision 6: clasificacion de plantillas

Se debe agregar una clasificacion a `template_artifacts` para distinguir gobierno, visibilidad y
reutilizacion.

Valores acordados:

- `official`: plantilla institucional, administrada o aprobada para procesos definidos.
- `user_reusable`: plantilla creada por usuario y disponible para reutilizacion.
- `ad_hoc`: plantilla/base creada solo para un entregable puntual.

Reglas:

- `official` puede vincularse a `process_definition_templates`.
- `user_reusable` puede reutilizarse por su creador o por el alcance que se defina despues.
- `ad_hoc` no debe contaminar la configuracion del proceso ni aparecer como entregable oficial.
- Una plantilla `ad_hoc` puede usarse por un `task_item user_added`.

Convencion MinIO:

- Bucket: `deasy-templates`.
- `official`: `System/{template_code}/{storage_version}/`.
- `user_reusable`: `Users/{owner_ref}/Reusable/{template_code}/{storage_version}/`.
- `ad_hoc`: `Users/{owner_ref}/AdHoc/{task_item_id_or_draft_token}/{template_code}/{storage_version}/`.

Motivo:

- Las plantillas oficiales quedan separadas del contenido de usuario.
- Las plantillas reutilizables de usuario quedan visibles como catalogo personal o compartible.
- Las plantillas ad hoc quedan atadas a un entregable puntual y no contaminan el catalogo reusable.
- La clasificacion no debe depender solo del prefijo; debe persistirse en `template_artifacts.template_scope`.

Estado actual detectado:

- El codigo actual usa `System/...` para plantillas oficiales y `Users/{cedula}/{templateCode}/{version}/`
  para plantillas web.
- El nuevo modelo requiere separar `Users/{cedula}/Reusable/...` y `Users/{cedula}/AdHoc/...`.

## Decision 7: clasificacion de instancias de entregable

Se debe agregar una clasificacion minima a `task_items`.

Valores acordados:

- `process_defined`: entregable generado desde la configuracion del proceso.
- `user_added`: entregable agregado manualmente por un usuario dentro de una tarea.

Valores descartados por ahora:

- `system_added`: no hay caso de uso actual claro.
- `imported`: no hay caso de uso actual claro.

Reglas:

- `process_defined` requiere `process_definition_template_id`.
- `user_added` puede tener `process_definition_template_id = NULL`.
- Todo `task_item` debe tener `template_artifact_id`.
- Si un `user_added` deriva de otro entregable, debe registrar `source_task_item_id`.
- El contexto de proceso se hereda desde `tasks.process_definition_id`.

## Decision 8: unicidad y alcance de tareas

Toda `task` debe pertenecer a una configuracion de proceso. Para tareas que no correspondan a un
proceso institucional especifico se usa el proceso `default`.

Reglas:

- `tasks` representa la ejecucion operativa de una configuracion de proceso en un contexto.
- El contexto minimo acordado es proceso + periodo + unidad/ambito.
- Cuando un proceso aplica a una unidad con varias personas destino, se crea una sola `task` para la
  unidad/contexto y un `task_item` por persona destino.
- No se crea una `task` por persona si la diferencia real es el entregable individual.
- La unicidad principal de `tasks` no debe depender de `launch_mode`.

Cambios esperados:

- Agregar un campo explicito de alcance, por ejemplo `tasks.scope_unit_id`.
- Reemplazar la unicidad actual basada en `automatic_flag`/`manual_user_flag` por una unicidad basada
  en configuracion de proceso + periodo + alcance.
- Revisar `process_runs` para que tambien tenga una clave de alcance si se mantiene como entidad de
  corrida/ejecucion del proceso.

## Decision 9: deprecar `tasks.launch_mode`

`tasks.launch_mode` queda obsoleto para el nuevo modelo.

Motivo:

- Toda tarea vive dentro de un proceso.
- Las tareas "sueltas" viven dentro del proceso `default`.
- Los entregables agregados por usuario no crean tareas manuales: crean `task_items` con
  `origin_kind = 'user_added'`.
- La diferencia automatico/manual ya no debe gobernar la unicidad ni el comportamiento central de
  `tasks`.

Implicaciones:

- Eliminar `launch_mode` de UX/UI y administracion.
- Migrar `createGeneralTask` para crear tareas del proceso `default` solo cuando realmente se crea
  una nueva tarea default, no para derivar entregables.
- Migrar "Derivar tarea" a "Agregar entregable", creando `task_items.user_added` dentro de la misma
  `task`.
- Eliminar columnas generadas `automatic_flag` y `manual_user_flag`.
- Eliminar uniques `uq_tasks_automatic_term` y `uq_tasks_manual_term_user`.
- Eliminar `tasks.launch_mode` cuando las rutas, seeds y migraciones ya no dependan de ese campo.

## Decision 10: revision obligatoria antes de firma

Todo entregable debe pasar por una fase de revision/llenado antes de entrar a firma.

Motivo:

- Evita firmar documentos con errores conocidos.
- Permite devolver el entregable con observaciones antes de generar evidencias de firma.
- Mantiene una separacion clara entre validar contenido y firmar electronicamente.

Reglas:

- La fase de revision/llenado es obligatoria para todo `task_item`.
- La fase de firma ocurre solo cuando la revision queda aprobada.
- No se debe permitir paso directo a firma en el modelo normal.
- Los estados documentales deben conservar esta secuencia: borrador/llenado -> observado o aprobado
  para firma -> firma -> final.

## Decision 11: flujos separados, logica compartida

Revision/llenado y firma no deben mezclarse en una sola tabla runtime por ahora, porque representan
acciones distintas.

Reglas:

- `fill_flow_templates`, `fill_flow_steps`, `document_fill_flows` y `fill_requests` siguen
  representando la fase de revision/llenado.
- `signature_flow_templates`, `signature_flow_steps`, `signature_flow_instances` y
  `signature_requests` siguen representando la fase de firma.
- La resolucion de responsables por cargo/contexto debe compartirse conceptualmente entre ambas
  fases para evitar duplicacion.
- La UX no debe exponer opciones tecnicas de scope; debe expresar responsables de negocio.

## Decision 12: observaciones y mensajes de flujo

`fill_requests.response_note` y `document_signatures.note_short` son insuficientes para el nuevo
modelo de observaciones.

Problemas:

- Guardan una sola nota corta por accion.
- No modelan conversaciones ni multiples observaciones por ciclo.
- No cubren de forma simetrica revision y firma.
- No permiten resolver/cerrar observaciones individualmente.

Se requiere una tabla nueva compartida para observaciones de entregables/documentos.

Modelo conceptual sugerido:

- `document_workflow_observations`
- FK a `task_item_id`.
- FK a `document_version_id`.
- FK opcional a `fill_request_id`.
- FK opcional a `signature_request_id`.
- `phase`: `review` o `signature`.
- `kind`: `observation`, `return_reason`, `rejection_reason`, `internal_note`.
- `message`.
- `author_person_id`.
- `target_person_id` opcional.
- `resolved_by_person_id` opcional.
- `resolved_at` opcional.
- `created_at`.

Reglas:

- Observaciones de revision se vinculan a `fill_requests`.
- Observaciones de firma se vinculan a `signature_requests`.
- La cadena completa de responsables sigue viviendo en los requests.
- Las observaciones viven en esta tabla compartida.
- `response_note` puede quedar como campo legado o resumen, pero no debe ser la fuente principal.

## Decision 13: flujos para entregables agregados por usuario

Los entregables `task_items.origin_kind = 'user_added'` deben crear sus flujos de revision y firma en
runtime.

Reglas:

- El usuario que agrega el entregable debe configurar la cadena de revision y firma durante la
  creacion del entregable.
- La UI debe ofrecer una opcion explicita para heredar flujo, pero no debe ser la primera opcion.
- La herencia puede venir del entregable de proceso, del proceso/contexto o de una plantilla
  reutilizable, segun se defina en la UX.
- Aunque el flujo se configure en runtime, sigue siendo obligatorio tener revision antes de firma.
- No se debe permitir crear un entregable `user_added` sin cadena minima de revision y firma.
- La configuracion runtime debe quedar persistida como templates/steps o como instancia congelada
  para ese entregable, de manera que cambios futuros en el proceso o plantilla no alteren la cadena
  historica.

Implicacion:

- Para `process_defined`, el flujo viene del entregable definido por proceso.
- Para `user_added`, el flujo se captura al crear el entregable.
- "Heredar flujo" es una accion explicita de conveniencia, no el default silencioso.

## Decision 14: resolucion de responsables

La resolucion de responsables depende del origen del entregable.

Para `task_items.origin_kind = 'process_defined'`:

- Los pasos deben definirse por cargos/roles dentro del contexto del proceso.
- Ejemplo: "Coordinador" se resuelve como coordinador de Sistemas, Enfermeria, etc., segun la unidad
  del entregable.
- La UI no debe exponer `unit_exact`, `unit_subtree`, `context_exact` ni otras opciones tecnicas.
- La configuracion de proceso y el alcance de la `task` deben aportar la unidad/contexto.

Para `task_items.origin_kind = 'user_added'`:

- Los pasos deben configurarse en runtime.
- La opcion principal debe ser seleccionar personas especificas.
- Se puede ofrecer heredar flujo como accion explicita.
- Tambien puede permitirse seleccionar cargos/contexto si el usuario tiene permisos y el caso lo
  justifica, pero no debe ser la ruta principal.

Regla de UX:

- Procesos definidos: "responsables por cargo en el contexto".
- Entregables agregados por usuario: "responsables concretos seleccionados en runtime".

## Decision 15: rol del proceso `default`

El proceso `default` es un proceso tecnico.

Reglas:

- Se usa para tareas o entregables que no tienen un proceso institucional especifico.
- No debe competir visualmente con procesos academicos/administrativos reales.
- No debe mostrarse como un proceso funcional normal salvo en vistas tecnicas/admin.
- Debe servir como ancla obligatoria para cumplir la regla: toda `task` pertenece a un proceso.
- Los entregables creados dentro de una `task` institucional no deben moverse a `default`; heredan el
  proceso de su `task`.
- `default` solo aplica cuando la tarea misma nace sin proceso institucional especifico.

UX:

- En vistas operativas, evitar mostrar "Proceso default" como categoria principal.
- Usar etiquetas como "Sin proceso institucional" o "Tarea suelta" si hace falta explicarlo.
- En admin, puede mantenerse visible como `default` para configuracion y auditoria.

## Decision 16: nomenclatura UX

Los nombres tecnicos actuales no deben exponerse directamente al usuario.

Mapa de nombres acordado:

| Tabla/concepto tecnico | Nombre UX recomendado |
|---|---|
| `template_artifacts` | Plantillas documentales |
| `process_definition_templates` | Entregables del proceso |
| `task_items` | Entregables |
| `documents` | Documento principal |
| `document_versions` | Versiones del documento |
| `document_attachments` | Anexos / evidencias |
| `fill_flow_templates` / `fill_flow_steps` | Flujo de revision |
| `document_fill_flows` / `fill_requests` | Revision del entregable |
| `signature_flow_templates` / `signature_flow_steps` | Flujo de firmas |
| `signature_flow_instances` / `signature_requests` | Solicitudes de firma |
| `process_definition_versions` | Configuraciones de proceso |
| `process_definition_series` | Variaciones de proceso |
| `process_target_rules` | Reglas de destino |
| `process_definition_triggers` | Disparadores del proceso |
| `tasks` | Tareas del proceso / ejecuciones del proceso, segun contexto |
| `default` | Tarea suelta / Sin proceso institucional en UI operativa |

Reglas:

- Usar "Configuracion de proceso", no "Version de proceso", en UI.
- Usar "Entregables del proceso", no "Plantillas de procesos definidos", para la relacion
  `process_definition_templates`.
- Usar "Revision del entregable", no "llenado", cuando el usuario esta aprobando/devolviendo.
- Reservar nombres tecnicos para admin avanzado, logs y documentacion tecnica.

## Implicaciones tecnicas preliminares

Cambios probables en `task_items`:

- Permitir `process_definition_template_id NULL`.
- Agregar `origin_kind ENUM('process_defined', 'user_added')`.
- Agregar `created_by_person_id`.
- Agregar `source_task_item_id NULL`.
- Evaluar `title` o `display_name` para entregables `user_added`.

Cambios probables en `template_artifacts`:

- Agregar `template_scope ENUM('official', 'user_reusable', 'ad_hoc')`.
- Ajustar `base_object_prefix` segun `template_scope`:
  - `System/{template_code}/{storage_version}/` para `official`.
  - `Users/{owner_ref}/Reusable/{template_code}/{storage_version}/` para `user_reusable`.
  - `Users/{owner_ref}/AdHoc/{task_item_id_or_draft_token}/{template_code}/{storage_version}/`
    para `ad_hoc`.

Cambios probables en `process_definition_templates`:

- Eliminar `is_required`.
- Renombrar conceptualmente a "entregables definidos por proceso" en UX/UI.
- Revisar `instance_mode`.
- Revisar `creates_task`, porque el nombre no expresa bien que materializa entregables.

Cambios probables en `tasks`:

- Agregar `scope_unit_id` o un campo equivalente de alcance.
- Deprecar y eliminar `launch_mode`.
- Eliminar `automatic_flag` y `manual_user_flag`.
- Reemplazar las uniques actuales por una clave de proceso + periodo + alcance.

Cambios probables en flujos:

- Crear `document_workflow_observations`.
- Migrar `fill_requests.response_note` a observaciones cuando aplique.
- Agregar soporte equivalente para observaciones de firma.
- Extraer la resolucion de responsables de revision/firma a una logica compartida.
- Para `process_defined`, resolver responsables por cargo/contexto.
- Para `user_added`, capturar responsables especificos en runtime y permitir herencia explicita.

## Siguiente decision pendiente

Definir como funcionan los flujos de revision y firma para entregables `user_added`:

- si heredan flujo por defecto desde el proceso;
- si usan el flujo de la plantilla seleccionada;
- si pueden quedar sin flujo;
- o si se requiere una regla combinada.
