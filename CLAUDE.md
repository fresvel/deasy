# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Reglas de Testing 
Para realizar las pruebas debes considerar que todo el sistema está dockerizado.  En la ruta scripts está docker-env.sh que te permite levantar entornos y ejecutar comandos de manera rápida. 

Los usuarios de referencia son los que **crea el bootstrap** (`/setup` → "usar datos de
ejemplo"), no los de `seed-db.sh`. Ojo: la contraseña del gestor NO es `Demo1234!`.

    admin   -> cédula 1234567890  /  Demo1234!
    gestor  -> cédula 0987654321  /  Gestor1234!   (de momento tiene rol de usuario también)
    usuario -> cédula 1122334455  /  Demo1234!

El router bloquea `/home` y `/perfil` para el admin (`adminBlockedRouteNames`), así que para
probar el dossier o las firmas hay que entrar como gestor o usuario.

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
bash scripts/seed-db.sh <env> capture|apply|rbac   # PostgreSQL SQL snapshot (pucese.seed.json)
bash scripts/reset-db.sh <env>                      # reset PostgreSQL schema
```
`<env>` ∈ `dev | qa-local | qa | prod`. `apply` **drops and reinserts** the included tables — never run on data you want to keep. `seed-db.sh` only touches the relational SQL; the MinIO buckets are created by the `storage-init` Compose profile (`minio-bootstrap`), and template files live in MinIO uploaded from the web app (see `docs/07-despliegue/COMANDOS_PROYECTO.md`). Incremental DB migrations were retired with the MariaDB migration — `postgres_schema.sql` is the single source of truth for the schema.

## Architecture

### Backend (`backend/`, no `src/` — modules at root)
- `index.js` — single large entry point: Swagger definition, CORS, middleware, route mounting, and PostgreSQL bootstrap-with-retry before listen.
- Layering: `routes/*_router.js` → `controllers/` → `services/` → `models/`. Keep business logic in services/models, never in routers or the frontend.
- API base path lives in `config/apiPaths.js` (`API_PREFIX = "/deasy/v1"`, docs at `/deasy/docs`). Route mount paths come from the `ROUTES` constant — add new routers there.
- **Datastore**: PostgreSQL, single relational core (users, RBAC, processes, chat, notifications, dossier). Schema is bootstrapped from `database/postgres_schema.sql` via `database/postgres_initializer.js` on startup (`ensurePostgresSchema`). Data access goes through `config/postgres.js` — an adapter that mirrors the mysql2 interface (`?`→`$n`, `[rows]`/`insertId` shape, dialect translation), so SQL is written mysql2-style. Everything imports `config/postgres.js` directly (`getPostgresPool`, `assertPostgresConnection`, `closePostgresPool`). The former MariaDB/MongoDB engines were fully retired; no dual-datastore, no Mongoose.
- **Realtime**: Socket.IO is embedded in the backend HTTP server (`services/realtime/RealtimeGateway.js`) — there is **no external broker** (EMQX/MQTT was removed). The handshake authenticates with the app JWT; clients request to join rooms (`user:{id}`, `conversation:{id}`, `process:{id}`) and the backend validates participation before joining. Only the backend publishes.
- Async/integration: RabbitMQ queues drive the signer; MinIO stores template artifacts and signed PDFs; `workers/storage_uploader.js` handles uploads.

### Frontend (`frontend/src/`)
- `modules/` — feature modules (`auth`, `admin`, `procesos`, `dossier`, `firmas`, `academia`, `perfil`, `home`).
- `core/` — app config, constants, router, cross-cutting services/utils.
- `shared/` — reusable `components`, `composables`, `styles`, `utils`. Reuse from here before creating local primitives. (There is no `shared/services/`; cross-cutting services live in `core/services/`.)
- Vue Composition API with `<script setup>`. Global visual behavior lives in `frontend/src/shared/styles/tailwind.css` **and** `shared/styles/theme.css` (both loaded from `main.js`); do not hardcode colors/spacing/radii that already exist as shared classes. ⚠️ Ambos ficheros tienen deuda conocida (selectores redefinidos en conflicto y dos juegos de tokens `--deasy-*`/`--brand-*`): ver `docs/plan-refactor-frontend.md` §3.4 antes de migrar hardcodes.
- Approved base components to reuse: `AppButton`, `AppDataTable`, `AppModalShell` / `AppFormModalLayout`, `AppTag`, `AppNavCard`, `PdfDropField`.

### Process engine (core domain)
Processes are modeled as `processes` + `process_definition_versions` + `process_target_rules` in PostgreSQL. The series → rule → flow model governs assignment: a series names the process, a rule distributes the process scope, and the flow distributes the steps. Templates (Jinja2) linked to a process determine whether it is document-producing.

### Modos de emisión de entregables (single / replicated / routed) — LEER `docs/modelo-emision-entregables.md`
Cada plantilla ligada declara su modo en `process_definition_templates.item_mode`:
- **single**: entregable + flujo (entrega/firma) **predefinidos en la plantilla**; 1 instancia al lanzar.
- **replicated**: flujo **predefinido**; el responsable crea N réplicas etiquetadas que **heredan** ese flujo.
- **routed**: **sin flujo predefinido** — el usuario **define entrega + firma AL INSTANCIAR** (runtime).

El **"Proceso por defecto"** es un routed para **tareas ad‑hoc que no pertenecen a ningún proceso** (cualquier usuario, en cualquier momento; p. ej. "haz el informe de este evento"). **NO es "memorandums".**

Autoría de flujo (plantilla *official*): solo **`task_assignee`** ("Responsable del entregable") y **`cargo_in_scope`** ("Por cargo") — *ad_hoc* añade `specific_person`. **DEPRECADOS (no usar):** `document_owner`/"Responsable del documento", `position`, `manual_pick`. **routed no autora flujo** (es de runtime). Estado: single/replicated hechos; **routed está a medias** (hoy solo elige 1 destinatario vía atajo `document_owner` sembrado; falta el editor de flujo en runtime). Ver el doc para detalle y deuda técnica.

## Environments & ports
`dev` proxy: HTTP `8088` / HTTPS `8443` (API under `/api/deasy/v1`). `qa-local` uses `9088`/`9443`. Direct backend dev port is `3030`. Per-env infra ports (PostgreSQL/RabbitMQ/MinIO/Signer) are listed in `docs/07-despliegue/COMANDOS_PROYECTO.md`.

Env config: `docker/.env` + per-env `docker/.env.<env>`; reference model is `docker/.env_model`. Frontend uses `VITE_API_BASE_URL` (`/api` behind the Nginx proxy in Docker).

## CI/CD
`.github/workflows/cd-multienv.yml`: push to `develop` publishes `dev`-tagged images (no deploy); `qa` and `main` publish `qa`/`prod` images and deploy when `DEPLOY_DELIVERY_MODE=gh-actions`. Published images: `deasy-backend`, `deasy-frontend`, `deasy-signer`, `deasy-analytics`.

Branching: work happens on `develop`; `main` is the production branch.
