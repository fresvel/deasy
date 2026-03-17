# Indice general

Este indice organiza la documentacion del repositorio y enlaza a los documentos existentes.

## Actualizacion backend reciente (2026-03-17)

- Registro backend con direccion de residencia ampliada: `03-backend/api.md`.
- Auth y refresh-token (comportamiento validado): `03-backend/auth.md`.
- Estado de inicializador MariaDB y errores conocidos: `03-backend/errores-conocidos.md`.
- Detalle de cambios de schema/migracion: `02-dominio-datos/migraciones.md`.

## Vista rapida por rol

- Dev backend: docs/03-backend, docs/02-dominio-datos, backend/README.md
- Dev frontend: docs/04-frontend, frontend/README.md
- DevOps: docs/07-despliegue, docker/docker-compose.yml, scripts/start-services.sh
- Producto/QA: docs/09-requerimientos, docs/01-arquitectura

## Estructura y enlaces

1) Arquitectura
   - docs/01-arquitectura/overview.md
   - docs/01-arquitectura/arquitectura.drawio
   - docs/01-arquitectura/decisiones.md
   - docs/01-arquitectura/chat-notificaciones.md
   - docs/01-arquitectura/firmas.md
   - docs/01-arquitectura/integraciones.md
   - docs/01-arquitectura/firmas.drawio

2) Dominio y datos
   - docs/02-dominio-datos/modelo-datos.md
   - docs/02-dominio-datos/er-resumen.md
   - docs/02-dominio-datos/nomenclatura.md
   - docs/02-dominio-datos/migraciones.md
   - docs/02-dominio-datos/mariadb.dbml
   - docs/02-dominio-datos/mariadb.drawio
   - docs/02-dominio-datos/

3) Backend
   - docs/03-backend/setup.md
   - docs/03-backend/api.md
   - docs/03-backend/auth.md
   - docs/03-backend/servicios.md
   - docs/03-backend/errores-conocidos.md

4) Frontend
   - docs/04-frontend/setup.md
   - docs/04-frontend/navegacion.md
   - docs/04-frontend/componentes.md
   - docs/04-frontend/estilos.md

5) Broker y notificaciones
   - docs/05-broker-notificaciones/emqx.md
   - docs/05-broker-notificaciones/topics.md
   - docs/05-broker-notificaciones/auth-acl.md
   - docs/05-broker-notificaciones/mensajeria.md
   - docs/05-broker-notificaciones/pendientes.md

6) Reportes y firmas
   - docs/06-reportes-firmas/latex.md
   - 
   - docs/06-reportes-firmas/templates.md

7) Despliegue
   - docs/07-despliegue/docker.md
   - docs/07-despliegue/scripts.md
   - docs/07-despliegue/env.md
   - docs/07-despliegue/minio.md
   - docs/07-despliegue/infra.md
   - docs/07-despliegue/storage-layout.md

8) Operacion
   - docs/08-operacion/troubleshooting.md
   - docs/08-operacion/logs.md
   - docs/08-operacion/monitoring.md

9) Requerimientos
   - docs/09-requerimientos/requerimientos.md
   - docs/09-requerimientos/backlog.md

10) Anexos

- docs/10-anexos/tabularray.pdf
- docs/10-anexos/minted.pdf
- docs/10-anexos/UI.odg

## Documentos raiz

- backend/README.md
- frontend/README.md
- Deploy/deploy_broker
- Deploy/deploy_front
