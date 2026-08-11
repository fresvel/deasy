# Deasy

Plataforma con backend, frontend y servicios auxiliares (mensajeria/broker, firmas, reportes).
Este README es el punto de entrada a la documentacion y el uso basico del proyecto.

## Que hay en este repositorio

- backend/: API, servicios y logica de negocio.
- frontend/: interfaz web (Vue).
- docker/: definiciones de contenedores y servicios.
- scripts/: utilidades de arranque.
- backend/scripts/: scripts de datos, fixtures de desarrollo y reset del backend.
- docs/: documentacion tecnica, arquitectura y modelos.
- deploy/: unidades systemd de despliegue (server-pull).

## Arquitectura (resumen)

- Frontend consume API del backend.
- Backend integra:
  - Base de datos (PostgreSQL).
  - Motor de procesos basado en `processes` + `process_definition_versions` + `process_target_rules`.
  - Storage de artifacts de plantillas via MinIO.
  - Authoring de plantillas desde el editor web, con los artifacts en MinIO
    (la carpeta `tools/` se elimino en `3ac3db7`).
  - Servicios de reportes/latex.
  - Servicio de firmas (signer).
  - Mensajeria en tiempo real via WebSockets (Socket.IO) integrados en el backend.

## Quick start (desarrollo)

1) Revisar variables de entorno y requisitos en [docs/07-despliegue/COMANDOS_PROYECTO.md](docs/07-despliegue/COMANDOS_PROYECTO.md).
2) Levantar servicios con `bash scripts/docker-env.sh dev up -d --build` (ver scripts/docker-env.sh).
3) Iniciar backend y frontend segun sus README internos:
   - backend/README.md
   - frontend/README.md

Operaciones DB con Docker por ambiente:

- `bash scripts/reset-db.sh qa`: resetea el esquema PostgreSQL del ambiente.
- `bash scripts/reset-system.sh dev`: vacia PostgreSQL + MinIO y deja el backend en modo bootstrap.

## Documentacion

> El indice anterior listaba 34 rutas y **las 34 estaban muertas**: apuntaban al arbol de
> `docs/` previo a la reorganizacion, hoy archivado en `docs/docs-md-antiguos/`. Este indice
> lista solo ficheros que existen, y un comprobador de enlaces en CI impide que vuelva a
> pudrirse (`.github/workflows/docs-links.yml`).

**Empieza aqui:**

- [docs/arquitectura-deasy.tex](docs/arquitectura-deasy.tex) — el recorrido completo del sistema
  en 8 capitulos (backend, datos, frontend, signer, infraestructura, testing). Es el documento
  mas completo que hay; se compila a PDF con `pdflatex`.
- [CLAUDE.md](CLAUDE.md) — las reglas de trabajo del repositorio, los comandos de cada modulo y
  las trampas conocidas.

**Datos:**

- [docs/02-dominio-datos/consolidado.dbml](docs/02-dominio-datos/consolidado.dbml) — las 67 tablas
  de PostgreSQL. Se visualiza en dbdiagram.io.
- [docs/03-backend/auditoria-campos-bases-datos.md](docs/03-backend/auditoria-campos-bases-datos.md)

**Backend:**

- [docs/03-backend/bootstrap-system.md](docs/03-backend/bootstrap-system.md) — el arranque del sistema
- [docs/03-backend/seed-users-dev.md](docs/03-backend/seed-users-dev.md) — usuarios de desarrollo
- [docs/03-backend/01-config/](docs/03-backend/01-config/) — `config`, `apiPaths`, `sqlTables`
- [docs/03-backend/02-controllers/](docs/03-backend/02-controllers/) — por controller
- API viva: Swagger en `/deasy/docs` (hoy cubre 13 de 162 endpoints)

**Frontend:**

- [docs/08-frontend/admin-table-manager-taxonomy.md](docs/08-frontend/admin-table-manager-taxonomy.md)
- [docs/08-frontend/runtime-tables-traceability-ui.md](docs/08-frontend/runtime-tables-traceability-ui.md)
- Estilos: `frontend/src/shared/styles/` — 15 modulos por familia; ver `CLAUDE.md`

**Dominio y decisiones de arquitectura:**

- [docs/arquitecturas/modelo-emision-entregables.md](docs/arquitecturas/modelo-emision-entregables.md)
  — los tres modos (`single` / `replicated` / `routed`)
- [docs/arquitecturas/modelo-templates-entregables-limpio.md](docs/arquitecturas/modelo-templates-entregables-limpio.md)
- [docs/arquitecturas/roles-permisos-propuesta.md](docs/arquitecturas/roles-permisos-propuesta.md)

**Despliegue y operacion:**

- [docs/07-despliegue/COMANDOS_PROYECTO.md](docs/07-despliegue/COMANDOS_PROYECTO.md) — puertos por ambiente
- [docs/07-despliegue/MANUAL_CICD.md](docs/07-despliegue/MANUAL_CICD.md)
- [docs/07-despliegue/server-pull.md](docs/07-despliegue/server-pull.md)
- [docs/07-despliegue/DEPLOY_INGRESS_CONTEXT.md](docs/07-despliegue/DEPLOY_INGRESS_CONTEXT.md)

**Planes y calidad** (trabajo pendiente, no documentacion del producto):

- [docs/planes/](docs/planes/) — empieza por su `README.md`, que dice cual es la puerta de entrada

**Archivo:**

- [docs/docs-md-antiguos/](docs/docs-md-antiguos/) — documentacion historica, con referencias a
  MariaDB, MongoDB y EMQX que **ya no describen el sistema**. Cada fichero lleva un aviso.
  No es fuente de verdad.

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

## Contribuir

- El trabajo va en `develop`; `main` es la rama de produccion.
- Todo se construye y se prueba **dentro de los contenedores**, via `scripts/docker-env.sh`
  (o `scripts/stack.sh <a|b|c|d>` si hay varias sesiones en paralelo).
- Antes de tocar codigo, lee [CLAUDE.md](CLAUDE.md) y
  [docs/planes/referencia/metodo.md](docs/planes/referencia/metodo.md).
