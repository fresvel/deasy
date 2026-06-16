# Decisiones del modelo de entregables · junio 2026

## Proposito

Este documento registra las decisiones de negocio acordadas para limpiar el modelo de procesos,
plantillas, tareas y entregables. Tambien resume el estado implementado para que otro agente de
codigo pueda continuar sin reintroducir el modelo anterior.

Complementa y corrige parcialmente el enfoque descrito en
[redisenio-entregables-2026-06.md](./redisenio-entregables-2026-06.md), especialmente en lo relativo
a tareas derivadas con `parent_task_id`.

Estado al cierre de esta implementacion:

- El esquema MariaDB activo ya fue migrado al modelo nuevo.
- El frontend/admin ya no expone `process_definition_templates.is_required`, `tasks.launch_mode`,
  `automatic_flag`, `manual_user_flag` ni `parent_task_id` como controles de negocio.
- La creacion desde Home usa "Agregar entregable" y envia `source_task_id`; el backend conserva
  `parent_task_id` solo como alias legacy temporal de entrada.
- La tabla `document_workflow_observations` existe, pero la escritura funcional de observaciones
  desde los flujos de revision/firma queda como siguiente etapa de producto.

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
- [x] Definir tabla final de observaciones/mensajes para revision y firma.
- [x] Definir columnas exactas para origen y destino del entregable.
- [x] Definir migracion tecnica y UX/UI completa.

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
- `parent_task_id` se elimina del esquema activo; los endpoints pueden aceptar temporalmente el
  payload legacy como alias de tarea origen mientras la UI termina la migracion.

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
- Eliminar la columna del esquema activo y mantener la obligatoriedad como regla implicita.

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
- Eliminar `tasks.launch_mode`; las migraciones pueden leerlo solo si existe en bases antiguas.

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

## Especificacion tecnica aprobada

### `template_artifacts`

Agregar:

- `template_scope ENUM('official', 'user_reusable', 'ad_hoc') NOT NULL DEFAULT 'official'`.

Reglas de persistencia:

- `official`: `owner_person_id = NULL` permitido y `base_object_prefix` bajo `System/...`.
- `user_reusable`: requiere `owner_person_id`/`owner_ref` y `base_object_prefix` bajo
  `Users/{owner_ref}/Reusable/...`.
- `ad_hoc`: requiere `owner_person_id`/`owner_ref` y `base_object_prefix` bajo
  `Users/{owner_ref}/AdHoc/{task_item_id_or_draft_token}/...`.

### `process_definition_templates`

Eliminar:

- `is_required`.

Regla sustituta:

- Todo registro activo/vinculado en `process_definition_templates` es requerido por definicion.

Mantener por ahora:

- `creates_task`, aunque el nombre queda pendiente de limpieza UX porque realmente expresa
  materializacion de entregables.
- `instance_mode`, pero `owner_many_documents` queda en observacion por conflicto potencial con el
  principio de un documento principal por entregable.

### `tasks`

Agregar:

- `scope_unit_id INT NULL`.
- `normalized_scope_unit_id INT AS (IFNULL(scope_unit_id, 0)) PERSISTENT`.

Reemplazar unicidad:

- Usar `UNIQUE(process_definition_id, term_id, normalized_scope_unit_id)`.

Deprecar funcionalmente y retirar del contrato activo:

- `launch_mode`.
- `automatic_flag`.
- `manual_user_flag`.
- `parent_task_id` para derivacion de entregables.

Regla:

- La diferencia automatico/manual no vive en `tasks`. Una tarea existe por configuracion de proceso,
  periodo y alcance. Los agregados manuales viven en `task_items.origin_kind = 'user_added'`.

### `task_items`

Cambiar:

- `process_definition_template_id INT NULL`.

Agregar:

- `origin_kind ENUM('process_defined', 'user_added') NOT NULL DEFAULT 'process_defined'`.
- `created_by_person_id INT NULL`.
- `source_task_item_id INT NULL`.
- `target_unit_id INT NULL`.
- `target_position_id INT NULL`.
- `target_person_id INT NULL`.
- `title VARCHAR(180) NULL`.
- `process_definition_template_key INT AS (IF(origin_kind = 'process_defined', process_definition_template_id, NULL)) PERSISTENT`.
- `target_position_key INT AS (IF(origin_kind = 'process_defined', IFNULL(target_position_id, 0), NULL)) PERSISTENT`.
- `target_person_key INT AS (IF(origin_kind = 'process_defined', IFNULL(target_person_id, 0), NULL)) PERSISTENT`.

Reemplazar unicidad:

- Usar `UNIQUE(task_id, process_definition_template_key, target_position_key, target_person_key)`.

Reglas:

- `process_defined` requiere `process_definition_template_id`.
- `user_added` permite `process_definition_template_id = NULL`.
- Todo `task_item` requiere `template_artifact_id`.
- `created_by_person_id` identifica quien creo el entregable.
- `source_task_item_id` identifica derivacion desde otro entregable, sin crear tarea hija.
- `target_*` identifica hacia quien va dirigido el entregable.

### `document_workflow_observations`

Crear tabla compartida para observaciones de revision y firma:

- `id INT AUTO_INCREMENT PRIMARY KEY`.
- `task_item_id INT NOT NULL`.
- `document_version_id INT NOT NULL`.
- `fill_request_id INT NULL`.
- `signature_request_id INT NULL`.
- `phase ENUM('review', 'signature') NOT NULL`.
- `kind ENUM('observation', 'return_reason', 'rejection_reason', 'internal_note') NOT NULL DEFAULT 'observation'`.
- `message TEXT NOT NULL`.
- `author_person_id INT NOT NULL`.
- `target_person_id INT NULL`.
- `resolved_by_person_id INT NULL`.
- `resolved_at DATETIME NULL`.
- `created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`.

Reglas:

- Una observacion de revision debe tener `phase = 'review'` y puede referenciar `fill_request_id`.
- Una observacion de firma debe tener `phase = 'signature'` y puede referenciar
  `signature_request_id`.
- `fill_requests.response_note` y `document_signatures.note_short` quedan como campos legacy/resumen,
  no como fuente principal.

## Plan de migracion tecnica y UX/UI

1. Actualizar `mariadb_schema.sql` con las columnas y la tabla nueva.
2. Hacer el inicializador idempotente:
   - backfill de `template_scope`;
   - backfill de `tasks.scope_unit_id`;
   - backfill de `task_items.origin_kind`, `created_by_person_id` y `target_*`;
   - creacion de `document_workflow_observations`;
   - retiro seguro de indices legacy que dependan de `launch_mode` y `is_required`.
3. Actualizar generacion de tareas para crear una `task` por unidad/contexto y un `task_item` por
   persona destino.
4. Migrar creacion manual/derivada desde "crear tarea hija" a "agregar entregable".
5. Limpiar configuraciones admin/frontend para ocultar `is_required`, `launch_mode`,
   `automatic_flag`, `manual_user_flag` y `parent_task_id` como controles de negocio.
6. Cambiar nombres UX segun la tabla de nomenclatura.
7. Validar con `scripts/docker-env.sh` sobre backend/frontend y revisar que seeds no dependan de
   columnas retiradas.

## Guia de implementacion para agentes de codigo

Esta seccion describe el modelo tal como quedo implementado en el repositorio. Debe usarse como
referencia practica antes de tocar servicios de procesos, entregables, firmas, admin o seeds.

### Modelo mental obligatorio

El modelo debe leerse en este orden:

1. `process_definition_versions` define una configuracion de proceso.
2. `tasks` representa la ejecucion de esa configuracion en un periodo y un alcance operativo.
3. `task_items` representa los entregables reales dentro de la tarea.
4. `documents` representa el documento principal de un entregable.
5. `document_versions` versiona ese documento principal.
6. `document_attachments` contiene anexos, soportes o evidencias secundarias.
7. Los flujos de revision y firma operan sobre el documento/version del `task_item`.

La regla principal es: no crear tareas hijas para representar entregables adicionales. Si un usuario
agrega algo nuevo dentro de una tarea existente, se crea un `task_items.origin_kind = 'user_added'`
en la misma `task`.

### `tasks`: ejecucion por configuracion, periodo y alcance

`tasks` ya no distingue automatico/manual. Toda tarea pertenece a una configuracion de proceso. Si
el caso no corresponde a un proceso institucional real, se usa la configuracion tecnica `default`.

Columnas relevantes implementadas:

- `process_definition_id`: configuracion de proceso.
- `process_run_id`: corrida tecnica asociada, cuando aplica.
- `term_id`: periodo.
- `scope_unit_id`: unidad/ambito operativo de la tarea.
- `normalized_scope_unit_id`: columna generada para tratar `NULL` como `0`.
- `responsible_position_id`: puesto responsable principal de la tarea.

Unicidad implementada:

- `UNIQUE(process_definition_id, term_id, normalized_scope_unit_id)`.

Columnas retiradas del contrato activo:

- `launch_mode`.
- `automatic_flag`.
- `manual_user_flag`.
- `parent_task_id`.

La migracion conserva lectura defensiva de `launch_mode` solo si existe en bases antiguas, para
backfill de `process_runs`. No se debe volver a usar en codigo nuevo.

### `task_items`: instancia real de entregable

`task_items` es la entidad de negocio que representa el entregable. Antes parte del comportamiento
estaba mezclado con tareas manuales/derivadas; ahora el entregable adicional vive aqui.

Columnas relevantes implementadas:

- `origin_kind`: `process_defined` o `user_added`.
- `process_definition_template_id`: nullable. Requerido conceptualmente para `process_defined`.
- `template_artifact_id`: plantilla documental concreta usada por el entregable.
- `title`: titulo legible para entregables agregados o personalizados.
- `created_by_person_id`: quien creo el entregable.
- `source_task_item_id`: entregable origen si el nuevo entregable deriva de otro.
- `target_unit_id`: unidad destino del entregable.
- `target_position_id`: puesto/cargo destino.
- `target_person_id`: persona destino.
- `responsible_position_id` y `assigned_person_id`: compatibilidad operativa con flujos actuales.

Unicidad implementada para entregables definidos por proceso:

- `UNIQUE(task_id, process_definition_template_key, target_position_key, target_person_key)`.

Las columnas `process_definition_template_key`, `target_position_key` y `target_person_key` son
generadas. Solo aplican cuando `origin_kind = 'process_defined'`; por eso los entregables
`user_added` no colisionan con esta unicidad.

Reglas de uso:

- `process_defined` se genera desde `process_definition_templates` y reglas de destino.
- `user_added` se agrega manualmente dentro de una tarea existente.
- `user_added` puede heredar contexto de la tarea, pero no debe crear una tarea hija.
- Todo `task_item` debe tener `template_artifact_id`.
- El esquema permite `process_definition_template_id = NULL` para `user_added`. El flujo actual de
  Home todavia usa la plantilla base del proceso `default` para materializar un entregable simple,
  hasta que exista el wizard completo de plantillas/runtime.

### Plantillas y entregables definidos por proceso

Hay dos conceptos distintos que no deben mezclarse:

- `template_artifacts`: plantilla documental versionada, con archivos, schema, metadatos y rutas en
  MinIO.
- `process_definition_templates`: relacion M:N entre una configuracion de proceso y una plantilla
  documental que se convierte en entregable del proceso.

`process_definition_templates.is_required` fue eliminado. Todo entregable definido en una
configuracion activa es requerido por regla de negocio. Si en el futuro se necesita opcionalidad,
debe modelarse como una regla explicita nueva, no reintroduciendo `is_required` sin rediscutir el
modelo.

`template_artifacts.template_scope` clasifica la plantilla:

- `official`: institucional, bajo `System/{template_code}/{storage_version}/`.
- `user_reusable`: creada por usuario y reutilizable, bajo
  `Users/{owner_ref}/Reusable/{template_code}/{storage_version}/`.
- `ad_hoc`: creada para un entregable puntual, bajo
  `Users/{owner_ref}/AdHoc/{task_item_id_or_draft_token}/{template_code}/{storage_version}/`.

`SqlAdminService.saveTemplateArtifactDraft` ya usa `template_scope` para calcular rutas y persistir
la clasificacion. No se debe inferir el tipo solo por prefijo; la columna es la fuente de verdad.

### Generacion de tareas y entregables de proceso

`TaskGenerationService` quedo adaptado al nuevo modelo:

- genera una `task` por configuracion + periodo + unidad/alcance;
- crea o actualiza `task_assignments` para las personas/puestos del alcance;
- crea `task_items.origin_kind = 'process_defined'` por entregable definido y destino;
- usa `target_unit_id`, `target_position_id` y `target_person_id` para preservar hacia quien va el
  entregable;
- usa `scope_unit_id` para evitar duplicar tareas por persona cuando el contexto real es la unidad.

Esta distincion es importante: si un proceso aplica a una unidad con varias personas, la tarea es de
la unidad y los entregables/personas viven en `task_items`.

### Creacion manual desde Home

El flujo operativo visible cambio de "Derivar tarea" a "Agregar entregable".

Contrato frontend actual:

- `mode = 'derived'`.
- `source_task_id`: tarea donde se agregara el entregable.
- `source_task_item_id`: opcional, entregable origen.
- `unit_id`: unidad sugerida o heredada.
- `title`, `description`, `custom_term`.

Contrato backend:

- `createGeneralTask` acepta `source_task_id`.
- `parent_task_id` se conserva solo como alias legacy temporal.
- Si `mode = 'derived'`, no crea una nueva `task`; inserta un nuevo `task_item` en la `task` origen.
- Si `mode = 'free'`, crea una tarea en la configuracion tecnica `default`.

No reintroducir `parent_task_id` en el frontend. Si se elimina el alias backend en el futuro, hacerlo
solo despues de confirmar que no hay clientes antiguos usandolo.

### Acceso y permisos sobre entregables

Las consultas de Home consideran varias vias de acceso:

- creador de la `task`;
- asignaciones en `task_assignments`;
- `task_items.assigned_person_id`;
- `task_items.target_person_id`;
- solicitudes activas de revision en `fill_requests`;
- solicitudes activas de firma en `signature_requests`.

Cuando se agregue una consulta nueva sobre entregables, debe considerar `target_person_id`, no solo
`assigned_person_id`. El nuevo modelo usa `target_*` para expresar destino de negocio; los campos
antiguos siguen ayudando a operar flujos existentes.

### Revision, firma y observaciones

Revision/llenado y firma siguen en tablas separadas:

- Revision: `fill_flow_templates`, `fill_flow_steps`, `document_fill_flows`, `fill_requests`.
- Firma: `signature_flow_templates`, `signature_flow_steps`, `signature_flow_instances`,
  `signature_requests`.

Se agrego `document_workflow_observations` como tabla comun para mensajes y observaciones de ambas
fases. La tabla ya existe en schema e inicializador, pero aun no reemplaza funcionalmente a
`fill_requests.response_note` ni a notas de firma. Para implementarla, los siguientes pasos deberian
ser:

- crear servicio backend para insertar/listar/resolver observaciones;
- guardar observaciones de devolucion/rechazo de revision con `phase = 'review'`;
- guardar observaciones/rechazos de firma con `phase = 'signature'`;
- mostrar el hilo de observaciones en la UI del entregable;
- mantener campos legacy como resumen o compatibilidad, no como fuente principal.

### Admin y UX ya ajustados

Cambios aplicados en admin/frontend:

- `process_definition_templates` se presenta como "Entregables del proceso".
- `template_artifacts` se presenta como "Plantillas documentales".
- `task_items` se presenta como "Entregables".
- Se retiro `is_required` de formularios/listados de entregables del proceso.
- Se retiro `parent_task_id` de los FK editables del admin.
- Se cambio "Derivar tarea" por "Agregar entregable" en Home.
- Se cambio el payload frontend a `source_task_id`.

Si otro agente modifica componentes admin, debe reutilizar estas etiquetas y no volver a exponer
nombres tecnicos como controles de negocio.

### Seeds y bootstrap

Los seeds activos fueron alineados con el esquema nuevo:

- `backend/scripts/seeds/pucese.seed.json` ya no depende de `tasks.launch_mode`,
  `automatic_flag`, `manual_user_flag`, `parent_task_id` ni
  `process_definition_templates.is_required`.
- Los `tasks` del seed incluyen `scope_unit_id`.
- Los `task_items` del seed incluyen `origin_kind`, `created_by_person_id` y `target_*`.
- `template_artifacts` incluye `template_scope`.
- `seed_demo_accounts.mjs` crea tareas/entregables demo con el nuevo modelo.

El backup `pucese.seed.backup.json` conserva el esquema antiguo porque es historico. No usarlo como
referencia del modelo vigente.

### Migracion idempotente

`backend/database/mariadb_initializer.js` hace migracion incremental sin reset:

- agrega `template_artifacts.template_scope`;
- elimina `process_definition_templates.is_required`;
- agrega `tasks.scope_unit_id` y `normalized_scope_unit_id`;
- backfillea `scope_unit_id` desde el puesto responsable cuando puede;
- crea la nueva unicidad de `tasks`;
- retira indices legacy dependientes de `launch_mode`/flags;
- elimina `launch_mode`, `automatic_flag`, `manual_user_flag` y `parent_task_id`;
- hace nullable `task_items.process_definition_template_id`;
- agrega `origin_kind`, `title`, `created_by_person_id`, `source_task_item_id` y `target_*`;
- crea claves generadas/unicidad de `task_items`;
- crea `document_workflow_observations`.

La migracion fue probada contra dev con:

```bash
bash scripts/docker-env.sh dev exec -T backend sh -lc "cd /app/backend && node -e 'import(\"./database/mariadb_initializer.js\").then(async (m)=>{ await m.ensureMariaDBDatabase(); await m.ensureMariaDBSchema({ reset:false }); process.exit(0); }).catch((error)=>{ console.error(error); process.exit(1); })'"
```

### Validaciones ejecutadas

Comandos ejecutados y resultado:

```bash
bash scripts/docker-env.sh dev exec -T frontend sh -lc "cd /app/frontend && pnpm run lint"
bash scripts/docker-env.sh dev exec -T frontend sh -lc "cd /app/frontend && pnpm run build"
bash scripts/docker-env.sh dev exec -T backend node --check /app/backend/database/mariadb_initializer.js
bash scripts/docker-env.sh dev exec -T backend node --check /app/backend/services/admin/TaskGenerationService.js
bash scripts/docker-env.sh dev exec -T backend node --check /app/backend/services/admin/SqlAdminService.js
bash scripts/docker-env.sh dev exec -T backend node --check /app/backend/controllers/users/user_controler.js
bash scripts/docker-env.sh dev exec -T backend node --check /app/backend/scripts/seed_demo_accounts.mjs
git diff --check
```

Resultado: OK. El build frontend conserva advertencias no bloqueantes de Vite sobre `oxc/esbuild` y
chunks grandes.

### Reglas de no regresion

No hacer lo siguiente sin una nueva decision explicita:

- no volver a crear tareas hijas para entregables adicionales;
- no reintroducir `tasks.launch_mode`;
- no usar `automatic_flag` ni `manual_user_flag`;
- no volver a exponer `parent_task_id` en frontend/admin;
- no reintroducir `process_definition_templates.is_required`;
- no tratar plantilla documental como sinonimo de entregable de proceso;
- no inferir `template_scope` solo por ruta MinIO;
- no consultar acceso a entregables usando solo `assigned_person_id`; considerar tambien
  `target_person_id`;
- no mezclar revision y firma en una sola tabla runtime sin rediscutir el modelo.

## Notas historicas previas a la implementacion

Las notas de esta seccion fueron parte del analisis previo. Se conservan como trazabilidad, pero la
fuente operativa para codigo nuevo es la seccion **Guia de implementacion para agentes de codigo**.
Si hay conflicto entre ambas, prevalece la guia de implementacion.

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

## Siguientes decisiones pendientes

El modelo estructural ya esta definido e implementado. Las decisiones pendientes son de producto y
flujo operativo:

- Definir el wizard completo para crear entregables `user_added` con plantilla `user_reusable` o
  `ad_hoc`.
- Definir como se captura la cadena minima de revision y firma para `user_added`.
- Definir la UX exacta para la accion explicita "Heredar flujo".
- Implementar endpoints y UI para `document_workflow_observations`.
- Decidir si `instance_mode = owner_many_documents` sigue existiendo o se migra a un `task_item` por
  documento principal.
