# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> See `AGENTS.md` for the full repository conventions (layer boundaries, reuse rules, approved base components). The notes below are the operational quick-start that complements it.

## Reglas de Testing 
Para realizar las pruebas debes considerar que todo el sistema está dockerizado.  En la ruta scripts está docker-env.sh que te permite levantar entornos y ejecutar comandos de manera rápida. 

Las contraseñas de todos los usuarios de dev son Demo1234!, se tienen los siguientes usuarios:
    admin -> user: 1234567890
    gestor -> user: 0987654321 (de momento tiene rol de usuario también)

## Monorepo layout

Each module has its own toolchain and package manager — do not mix them.

- `frontend/` — Vue 3 + Vite + TailwindCSS web app. Uses **pnpm**. `@` aliases `frontend/src`.
- `backend/` — Express 5 (ESM) API served under `/deasy/v1`. Uses **npm**. No build step; runs `node index.js`.
- `docs/` — Astro Starlight documentation site. Uses **pnpm**.
- `signer/` — Python (`pyhanko`) PDF signing microservice with a Node helper in `sigmaker/`; talks to the backend over RabbitMQ + MinIO.
- `docker/` — multi-environment Compose stacks (`compose.base.yml` + overlays per env).
- `scripts/` — operational wrappers for startup, deploy, seeds, reset, migrations.
- `tools/templates/` — Jinja2 template authoring; output published to MinIO.

## Common commands

### Run the full stack (preferred — Docker)
```bash
bash scripts/docker-env.sh dev up -d --build      # dev environment
bash scripts/docker-env.sh dev logs -f backend    # tail a service
bash scripts/docker-env.sh dev ps
bash scripts/docker-env.sh dev down
```
`qa-local` is the equivalent mode for working against QA config with **locally built** images (use it, not `dev`, when you started the stack with `qa-local`). Plain `qa`/`prod`/`ingress` pull published GHCR images.

**Builds/tests must run inside the containers via `scripts/docker-env.sh`, not with npm/npx on the host.**

### Frontend
```bash
cd frontend && pnpm install
pnpm run dev        # Vite on http://localhost:8080
pnpm run lint       # eslint . --ext .js,.vue  — the primary FE validation gate
pnpm run build
```
For FE changes, run `pnpm run lint` (or a targeted lint over touched files) and verify appearance/behavior, not just compilation.

### Backend
```bash
cd backend && npm install
npm run start       # node index.js — API on http://localhost:3030/deasy/v1, Swagger at /deasy/docs
```
The backend has **no declared lint or test scripts**. If adding tests, place them beside the module using the `*.test.js` / `*.spec.js` pattern. Validate affected endpoints manually and document the checks.

### Seeds / DB (Docker-backed, per environment)
```bash
bash scripts/seed-db.sh <env> capture|apply|rbac   # MariaDB SQL snapshot (pucese.seed.json)
bash scripts/migrate-db.sh <env> --list            # list migrations
bash scripts/migrate-db.sh <env> <migration-name>  # run one
bash scripts/reset-db.sh <env>                      # reset MariaDB
```
`<env>` ∈ `dev | qa-local | qa | prod`. `apply` **drops and reinserts** the included tables — never run on data you want to keep. `seed-db.sh` only touches MariaDB SQL; MinIO template files are published separately via the `storage-init` / `storage-publish-seeds` / `storage-publish` Compose profiles (see `COMANDOS_PROYECTO.md`).

## Architecture

### Backend (`backend/`, no `src/` — modules at root)
- `index.js` — single large entry point: Swagger definition, CORS, middleware, route mounting, and MariaDB bootstrap-with-retry before listen.
- Layering: `routes/*_router.js` → `controllers/` → `services/` → `models/`. Keep business logic in services/models, never in routers or the frontend.
- API base path lives in `config/apiPaths.js` (`API_PREFIX = "/deasy/v1"`, docs at `/deasy/docs`). Route mount paths come from the `ROUTES` constant — add new routers there.
- **Dual datastore**: MariaDB (relational core — users, RBAC, processes) + MongoDB/Mongoose (`models/chat`, notifications). MariaDB schema is bootstrapped from `database/mariadb_schema.sql` via `database/mariadb_initializer.js` on startup (`ensureMariaDBDatabase` / `ensureMariaDBSchema`).
- **Realtime**: Socket.IO is embedded in the backend HTTP server (`services/realtime/RealtimeGateway.js`) — there is **no external broker** (EMQX/MQTT was removed). The handshake authenticates with the app JWT; clients request to join rooms (`user:{id}`, `conversation:{id}`, `process:{id}`) and the backend validates participation before joining. Only the backend publishes.
- Async/integration: RabbitMQ queues drive the signer; MinIO stores template artifacts and signed PDFs; `workers/storage_uploader.js` handles uploads.

### Frontend (`frontend/src/`)
- `modules/` — feature modules (`auth`, `admin`, `procesos`, `dossier`, `firmas`, `academia`, `perfil`, `home`).
- `core/` — app config, constants, router, cross-cutting services/utils.
- `shared/` — reusable `components`, `composables`, `services`, `styles`, `utils`. Reuse from here before creating local primitives.
- Vue Composition API with `<script setup>`. Global visual behavior lives in `frontend/src/styles/tailwind.css`; do not hardcode colors/spacing/radii that already exist as shared classes.
- Approved base components to reuse: `AppButton`, `AppDataTable`, `AppModalShell` / `AppFormModalLayout`, `AppTag`, `AppNavCard`, `PdfDropField`.

### Process engine (core domain)
Processes are modeled as `processes` + `process_definition_versions` + `process_target_rules` in MariaDB. The series → rule → flow model governs assignment: a series names the process, a rule distributes the process scope, and the flow distributes the steps. Templates (Jinja2) linked to a process determine whether it is document-producing.

### Modos de emisión de entregables (single / replicated / routed) — LEER `docs/modelo-emision-entregables.md`
Cada plantilla ligada declara su modo en `process_definition_templates.item_mode`:
- **single**: entregable + flujo (entrega/firma) **predefinidos en la plantilla**; 1 instancia al lanzar.
- **replicated**: flujo **predefinido**; el responsable crea N réplicas etiquetadas que **heredan** ese flujo.
- **routed**: **sin flujo predefinido** — el usuario **define entrega + firma AL INSTANCIAR** (runtime).

El **"Proceso por defecto"** es un routed para **tareas ad‑hoc que no pertenecen a ningún proceso** (cualquier usuario, en cualquier momento; p. ej. "haz el informe de este evento"). **NO es "memorandums".**

Autoría de flujo (plantilla *official*): solo **`task_assignee`** ("Responsable del entregable") y **`cargo_in_scope`** ("Por cargo") — *ad_hoc* añade `specific_person`. **DEPRECADOS (no usar):** `document_owner`/"Responsable del documento", `position`, `manual_pick`. **routed no autora flujo** (es de runtime). Estado: single/replicated hechos; **routed está a medias** (hoy solo elige 1 destinatario vía atajo `document_owner` sembrado; falta el editor de flujo en runtime). Ver el doc para detalle y deuda técnica.

## Environments & ports
`dev` proxy: HTTP `8088` / HTTPS `8443` (API under `/api/deasy/v1`). `qa-local` uses `9088`/`9443`. Direct backend dev port is `3030`. Per-env infra ports (MariaDB/Mongo/RabbitMQ/MinIO/Signer) are listed in `COMANDOS_PROYECTO.md`.

Env config: `docker/.env` + per-env `docker/.env.<env>`; reference model is `docker/.env_model`. Frontend uses `VITE_API_BASE_URL` (`/api` behind the Nginx proxy in Docker).

## CI/CD
`.github/workflows/cd-multienv.yml`: push to `develop` publishes `dev`-tagged images (no deploy); `qa` and `main` publish `qa`/`prod` images and deploy when `DEPLOY_DELIVERY_MODE=gh-actions`. Published images: `deasy-backend`, `deasy-frontend`, `deasy-signer`, `deasy-analytics`.

Branching: work happens on `develop`; `main` is the production branch.
