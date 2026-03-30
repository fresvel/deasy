# Arquitectura - Overview

## Proposito

Deasy integra frontend web, backend API y servicios auxiliares (mensajeria, firmas y reportes) para gestion academica y documental.
El motor de negocio usa procesos base, variantes controladas, definiciones versionadas, reglas de alcance y disparadores por periodo para resolver ejecucion operativa sin perder precision organizacional.

## Componentes principales

- Frontend (Vue): dashboard de usuario, consola operativa por definicion de proceso, panel admin y flujos de firma.
- Backend (Node.js): API REST, autenticacion, reglas de negocio, instanciacion de tareas y orquestacion documental.
- MariaDB: datos relacionales principales.
- MongoDB: conversaciones y mensajes (chat/notificaciones).
- EMQX: mensajeria en tiempo real (WebSocket/MQTT), aun no integrada al flujo operativo principal.
- RabbitMQ: cola de trabajos asincronos; sigue disponible para firmas, storage y procesos pesados, aunque la carga de paquetes de usuario a MinIO ya se hace de forma directa.
- Servicios de reportes/firmas: LaTeX y signer.
- MinIO: storage S3-compatible separado por buckets de negocio.

## Diagrama

- docs/01-arquitectura/arquitectura.drawio
- docs/01-arquitectura/firmas.drawio
- docs/02-dominio-datos/mariadb.drawio
- docs/02-dominio-datos/

## Flujo general

1) Frontend consume API del backend.
2) Backend aplica reglas, persiste en MariaDB y resuelve tareas, entregables, documentos y firmas.
3) Chat/Notificaciones: mensajes guardados en Mongo y publicados por EMQX.
4) Templates del sistema se empaquetan desde `tools/templates`, se publican a MinIO y se sincronizan en `template_artifacts`.
5) El dashboard del usuario abre una consola operativa por `process_definition_id`, donde el usuario ve solo sus tareas, sus entregables, sus documentos y sus firmas.
6) Reportes/firma: backend orquesta plantillas, genera documentos y ejecuta firma.

## Storage actual

- `deasy-templates`
  - `System/`
  - `Seeds/`
  - `Users/<cedula>/`
- `deasy-documents`
  - `Unidades/`
- `deasy-chat`
  - `Chat/`
- `deasy-spool`
  - `Firmas/`
- `deasy-dossier`
  - `Dosier/`

## Dependencias

- Docker compose como stack de desarrollo.
- Servicios externos documentados en docs/07-despliegue/docker.md.
