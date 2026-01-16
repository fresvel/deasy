# Arquitectura - Overview

## Proposito

Deasy integra frontend web, backend API y servicios auxiliares (mensajeria, firmas y reportes) para gestion academica y documental.

## Componentes principales

- Frontend (Vue): UI para usuarios, panel admin y flujos de firma.
- Backend (Node.js): API REST, autenticacion, reglas de negocio.
- MariaDB: datos relacionales principales.
- MongoDB: conversaciones y mensajes (chat/notificaciones).
- EMQX: mensajeria en tiempo real (WebSocket/MQTT).
- RabbitMQ: cola de mensajes (actualmente presente en stack, uso por definir).
- Servicios de reportes/firmas: LaTeX, webtemplate y signflow.
- Storage compartido: adjuntos y documentos (volumen/FS compartido).

## Diagrama

- docs/01-arquitectura/firmas.drawio
- docs/02-dominio-datos/MER_LIMPIO.drawio
- docs/02-dominio-datos/base-datos.drawio
- docs/02-dominio-datos/mer-signflow.drawio

## Flujo general

1) Frontend consume API del backend.
2) Backend aplica reglas, persiste en MariaDB y publica eventos a EMQX cuando aplica.
3) Chat/Notificaciones: mensajes guardados en Mongo y publicados por EMQX.
4) Reportes/firma: backend orquesta plantillas, genera documentos y ejecuta firma.

## Dependencias

- Docker compose como stack de desarrollo.
- Servicios externos documentados en docs/07-despliegue/docker.md.

