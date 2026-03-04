# Requerimientos

## Estado actual del nucleo de procesos

El nucleo funcional ya quedo rediseñado sobre:

- `processes`
- `process_definition_series`
- `process_definition_versions`
- `process_target_rules`
- `process_definition_triggers`
- `process_definition_templates`
- `tasks`
- `task_items`
- `documents`
- `signature_flow_*`

Reglas ya implementadas:

- Las definiciones se crean en `draft`.
- Solo puede existir una definicion `active` por `proceso + serie`.
- Al activar una nueva definicion, la activa anterior de esa misma serie pasa a `retired`.
- No se puede activar una definicion sin:
  - al menos una regla activa,
  - al menos un disparador activo,
  - y, si `has_document = 1`, al menos un paquete vinculado.
- Reglas, disparadores y paquetes solo se editan en `draft`.
- `tasks` representa la instancia del proceso en un periodo.
- `task_items` representa los entregables derivados de `process_definition_templates`.
- `documents` cuelga de `task_items`.
- `signature_flow_templates` cuelga de `process_definition_templates`.

## Estado actual del modulo de templates

Ya quedo implementado:

- fuente de templates en `tools/templates/`
- CLI `node tools/templates/cli.mjs`
- `package`
- `publish`
- `publish-seeds`
- sincronizacion de `template_artifacts` desde `dist`
- sincronizacion de `template_seeds` desde MinIO
- paquetes de usuario (`artifact_origin = user`) creados desde el admin
- upload directo a MinIO para paquetes de usuario

Storage actual:

- `deasy-templates/System`
- `deasy-templates/Seeds`
- `deasy-templates/Users/<cedula>`

## Estado actual del dashboard operativo

Ya existe un primer panel operativo en el dashboard cuando el usuario hace click en un proceso de su menu.

Ese panel ya muestra:

- contexto de la definicion activa
- resumen rapido
- tareas del usuario actual
- entregables (`task_items`)
- documentos
- firmas del usuario
- dependencias de la definicion
- paquetes de usuario
- creacion de tarea manual

El panel actual esta enfocado solo en:

- las tareas del usuario actual

No cubre todavia:

- seguimiento de tareas de subordinados
- seguimiento por unidad/equipo
- trazabilidad de subprocesos derivados

## Pendientes inmediatos

1) Refinar UX/UI del panel operativo del dashboard.
2) Agregar una segunda vista de seguimiento para tareas derivadas, asignadas a subordinados o a la unidad.
3) Definir el flujo funcional exacto para:
   - generar documentos desde `task_items`
   - firmar desde el panel operativo
   - decidir que acciones de firma ve el usuario final y cuales quedan solo para admin.
4) Definir el flujo de promocion de paquetes de usuario:
   - `user/draft`
   - `user/review`
   - `user/approved`
   - `user/published`
   - y si existira una promocion administrativa hacia `system`.
5) Decidir si `artifact_stage` se mostrara y editara en la UI de negocio o si quedara solo como estado de repositorio.
6) Implementar el flujo de firma operativo por documento en el dashboard del usuario:
   - ver pasos
   - ver pendientes
   - firmar cuando corresponda.
7) Revisar si el flujo de documentos requiere acciones separadas por `task_item`:
   - crear documento
   - subir documento manual
   - generar documento automatico
   - versionar documento.
8) Diseñar el panel operativo para usuarios no admin que creen procesos/tareas manuales con paquetes de usuario sin pasar por el panel admin.

## Pendientes generales de plataforma

1) Completar el rol y permisos finos de usuario, coordinador, gestor y auditor.
2) Integrar EMQX en flujos visibles de notificaciones en tiempo real.
3) Definir el uso definitivo de RabbitMQ para jobs pesados:
   - firmas
   - renders
   - procesos asincronos
   - storage si luego se vuelve a desacoplar.
4) Consolidar el flujo documental con backups, limpieza y consistencia BD/MinIO.
5) Completar el modulo de chat/notificaciones segun `docs/01-arquitectura/chat-notificaciones.md`.
6) Completar el modulo de dosier editable y sus reportes asociados.
7) Completar los modulos de negocio pendientes:
   - Docencia
   - Gestion
   - Academia
   - Investigacion
   - Internacionalizacion
   - Calidad

## Documentacion pendiente

1) Mantener alineados los diagramas visuales con el modelo vigente.
2) Completar ejemplos de uso por endpoint para el flujo operativo del dashboard.
3) Documentar el flujo de vida de `task_items -> documents -> signatures`.
