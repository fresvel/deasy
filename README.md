# Deasy

Plataforma con backend, frontend y servicios auxiliares (mensajeria/broker, firmas, reportes).
Este README es el punto de entrada a la documentacion y el uso basico del proyecto.

## Que hay en este repositorio

- backend/: API, servicios y logica de negocio.
- frontend/: interfaz web (Vue).
- docker/: definiciones de contenedores y servicios.
- scripts/: utilidades de arranque.
- backend/scripts/: scripts de datos, seeds, reset y migraciones del backend.
- docs/: documentacion tecnica, arquitectura y modelos.
- deploy/: unidades systemd de despliegue (server-pull).

## Arquitectura (resumen)

- Frontend consume API del backend.
- Backend integra:
  - Base de datos (PostgreSQL).
  - Motor de procesos basado en `processes` + `process_definition_versions` + `process_target_rules`.
  - Storage de artifacts de plantillas via MinIO.
  - Authoring de templates integrado en `tools/templates`.
  - Servicios de reportes/latex.
  - Servicio de firmas (signer).
  - Mensajeria en tiempo real via WebSockets (Socket.IO) integrados en el backend.

## Quick start (desarrollo)

1) Revisar variables de entorno y requisitos en docs/07-despliegue/docker.md.
2) Levantar servicios con `bash scripts/docker-env.sh dev up -d --build` (ver scripts/docker-env.sh).
3) Iniciar backend y frontend segun sus README internos:
   - backend/README.md
   - frontend/README.md

Operaciones DB con Docker por ambiente:

- `bash scripts/seed-db.sh dev capture`
- `bash scripts/reset-db.sh qa`

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
- 
- docs/06-reportes-firmas/templates.md

Despliegue:
- docs/07-despliegue/docker.md
- docs/07-despliegue/env.md
- docs/07-despliegue/minio.md
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

Resumen clave:

- Mensajeria en tiempo real con WebSockets (Socket.IO) integrados en el backend.
- Tipos de conversacion: direct, group, thread (thread ligado a process_id).
- Responsable del proceso puede agregar/remover participantes en threads.
- Notificaciones internas en tiempo real.
- Adjuntos hasta 100 MB en storage compartido (NFS u otro).
- Ruta de storage via variable SHARED_STORAGE_ROOT.
- El handshake del socket se autentica con el mismo JWT de la app; el backend resuelve la persona a partir del token.
- ACL: el cliente pide unirse a un room (conversation:{id} / process:{id}) y el backend valida la participacion antes de unirlo; publicar solo backend.
- El backend emite directo a los rooms de Socket.IO (user:{id}, conversation:{id}, process:{id}).

Rooms en tiempo real (antes topics MQTT):

- user:{personId}            (notificaciones dirigidas)
- conversation:{conversationId}  (mensajes de la conversacion)
- process:{processId}        (hilo del proceso)

Pendientes:

- Definir ruta exacta de SHARED_STORAGE_ROOT en entorno docker/NFS.
- Confirmar donde vive el "responsable del proceso" en BD (tabla/campo).
- Escalado horizontal: si se corren varias instancias de backend, anadir el adapter de Redis de Socket.IO.

## Siguiente paso

Si quieres, puedo seguir completando las secciones con detalle tecnico o generar diagramas en texto.
