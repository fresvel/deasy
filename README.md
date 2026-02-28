# Deasy

Plataforma con backend, frontend y servicios auxiliares (mensajeria/broker, firmas, reportes).
Este README es el punto de entrada a la documentacion y el uso basico del proyecto.

## Que hay en este repositorio

- backend/: API, servicios y logica de negocio.
- frontend/: interfaz web (Vue).
- docker/: definiciones de contenedores y servicios.
- scripts/: utilidades de arranque.
- docs/: documentacion tecnica, arquitectura y modelos.
- Deploy/: notas de despliegue y contexto de cambios.

## Arquitectura (resumen)

- Frontend consume API del backend.
- Backend integra:
  - Base de datos (MariaDB + Mongo segun el modulo).
  - Motor de procesos basado en `processes` + `process_definition_versions` + `process_target_rules`.
  - Servicios de reportes/latex.
  - Servicio de firmas (signflow/multisigner).
  - Mensajeria en tiempo real via EMQX (WebSocket).

## Quick start (desarrollo)

1) Revisar variables de entorno y requisitos en docs/07-despliegue/docker.md.
2) Levantar servicios (ver docker/docker-compose.yml y scripts/start-services.sh).
3) Iniciar backend y frontend segun sus README internos:
   - backend/README.md
   - frontend/README.md

## Documentacion

Indice general: docs/00-indice.md

Arquitectura:
- docs/01-arquitectura/overview.md
- docs/01-arquitectura/decisiones.md
- docs/01-arquitectura/chat-notificaciones.md
- docs/01-arquitectura/firmas.md

Datos:
- docs/02-dominio-datos/modelo-datos.md
- docs/02-dominio-datos/MER_SQL.sql
- docs/02-dominio-datos/MER_LIMPIO.drawio

Backend:
- docs/03-backend/setup.md
- docs/03-backend/api.md
- docs/03-backend/auth.md
- docs/03-backend/servicios.md

Frontend:
- docs/04-frontend/setup.md
- docs/04-frontend/navegacion.md
- docs/04-frontend/componentes.md
- docs/04-frontend/estilos.md

Broker y notificaciones:
- docs/05-broker-notificaciones/emqx.md
- docs/05-broker-notificaciones/topics.md
- docs/05-broker-notificaciones/auth-acl.md
- docs/05-broker-notificaciones/mensajeria.md
- docs/05-broker-notificaciones/pendientes.md

Reportes y firmas:
- docs/06-reportes-firmas/latex.md
- docs/06-reportes-firmas/signflow.md
- docs/06-reportes-firmas/templates.md

Despliegue:
- docs/07-despliegue/docker.md
- docs/07-despliegue/env.md
- docs/07-despliegue/infra.md

Operacion:
- docs/08-operacion/troubleshooting.md
- docs/08-operacion/logs.md
- docs/08-operacion/monitoring.md

Requerimientos:
- docs/09-requerimientos/requerimientos.md
- docs/09-requerimientos/backlog.md

Anexos:
- docs/10-anexos/

## Broker y notificaciones (contexto actual)

Resumen clave desde Deploy/deploy_broker:

- Mensajeria en tiempo real con EMQX (WebSocket) y Mongo.
- Tipos de conversacion: direct, group, thread (thread ligado a process_id).
- Responsable del proceso puede agregar/remover participantes en threads.
- Notificaciones internas en tiempo real.
- Adjuntos hasta 100 MB en storage compartido (NFS u otro).
- Ruta de storage via variable SHARED_STORAGE_ROOT.
- EMQX con auth por usuario/clave por persona; credenciales derivadas de la contrasena del sistema.
- ACL: usuarios solo pueden suscribirse a sus conversaciones; publicar solo backend.
- Backend publica directo a EMQX (opcion A), con evolucion futura a servicio dedicado.

Topics confirmados:

- users/{userId}/notifications
- conversations/{conversationId}/messages
- processes/{processId}/thread

Pendientes:

- Definir ruta exacta de SHARED_STORAGE_ROOT en entorno docker/NFS.
- Confirmar donde vive el "responsable del proceso" en BD (tabla/campo).
- Detallar reglas ACL de EMQX segun topics y usuarios.

Nota sobre error legado:

- Error MariaDB: Field 'template_version_id' doesn't have a default value (columna legacy en process_templates).

## Siguiente paso

Si quieres, puedo seguir completando las secciones con detalle tecnico o generar diagramas en texto.
