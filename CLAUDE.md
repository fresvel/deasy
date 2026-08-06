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

### Dónde va cada test (y cómo se llama)

Hay **dos niveles** y no se mezclan. La ubicación no es estética: `sonar-project.properties` los
distingue por patrón, y un fichero mal colocado o mal nombrado se analiza **como código de producción**
(así es como las contraseñas de fixture acabaron contando como vulnerabilidades del sistema).

| Nivel | Dónde | Nombre | Qué prueba |
|---|---|---|---|
| **Unitario** | **junto al módulo** que prueba | `<modulo>.test.js` (`.test.mjs` si el módulo es ESM `.mjs`) | Una unidad, sin red ni base de datos |
| **Caracterización** | `backend/tests/characterization/flows/` | `<flujo>.test.mjs` | Contrato HTTP extremo a extremo contra goldens |

Reglas:

- **`*.test.js` / `*.test.mjs` son los únicos sufijos válidos. No uses `*.spec.js`** — no hay ni uno
  en el repo y añadirlo obliga a mantener un patrón muerto en la config de Sonar y en los globs de
  `test:unit`.
- Un test unitario nuevo tiene que **caer dentro de los globs de `backend/package.json → test:unit`**
  (`config/`, `services/**`, `utils/**`, `middlewares/**`, `controllers/**`, `errors/**`). Si lo pones
  fuera, no lo ejecuta nadie y no te vas a enterar. Si el módulo vive en otra carpeta, **amplía el glob
  en el mismo commit**.
- No metas tests unitarios en `backend/tests/`: esa carpeta es del harness de caracterización
  (`config.mjs`, `lib/`, `setup/`, `__snapshots__/`).
- Los tests del frontend van junto al componente/composable (`vitest` los descubre solo).
- **Un refactor no cambia un golden.** Si un snapshot se mueve durante un refactor puro, o rompiste
  algo o el test estaba mal. En un *fix*, el diff del golden **es** la prueba del arreglo.
- **Una suite que no arranca cuenta como fallo, no como "0 tests".** Vitest marca *Failed Suite* con
  0 casos cuando el error ocurre al importar (un `vi.mock` incompleto de un módulo que ahora tira de
  otro, típicamente). Mira la línea `Test Files`, no solo la de `Tests`.

## Monorepo layout

Each module has its own toolchain and package manager — do not mix them.

- `frontend/` — Vue 3 + Vite + TailwindCSS web app. Uses **pnpm**. `@` aliases `frontend/src`.
- `backend/` — Express 5 (ESM) API served under `/deasy/v1`. Uses **npm**. No build step; runs `node index.js`.
- `docs/` — Astro Starlight documentation site. Uses **pnpm**.
- `signer/` — Python (`pyhanko`) PDF signing microservice with a Node helper in `sigmaker/`; talks to the backend over RabbitMQ + MinIO.
- `docker/` — multi-environment Compose stacks (`compose.base.yml` + overlays per env).
- `scripts/` — operational wrappers for startup, deploy, seeds, reset, migrations.

## Common commands

### Run the full stack (preferred — Docker)
```bash
bash scripts/docker-env.sh dev up -d --build      # dev environment
bash scripts/docker-env.sh dev logs -f backend    # tail a service
bash scripts/docker-env.sh dev ps
bash scripts/docker-env.sh dev down
```
`qa`/`prod`/`ingress` pull published GHCR images; local work happens in `dev`.

**Builds/tests must run inside the containers via `scripts/docker-env.sh`, not with npm/npx on the host.**

### Frontend
```bash
bash scripts/docker-env.sh dev exec -T frontend pnpm run lint       # eslint . --ext .js,.vue
bash scripts/docker-env.sh dev exec -T frontend pnpm run test:unit  # vitest run — 12 ficheros, 208 casos
bash scripts/docker-env.sh dev exec -T frontend pnpm run build
```
Para cambios de FE: **lint + `test:unit`**, y además verificar aspecto/comportamiento en el navegador.
Lint solo no es la puerta de validación: hay vitest + `@vue/test-utils` y hay que usarlos.

Al **añadir dependencias** al frontend hay que instalar **dentro del contenedor** — el volumen de
`node_modules` sombrea el de la imagen y un `pnpm install` en el host no se ve dentro.

### Backend
```bash
bash scripts/docker-env.sh dev exec -T backend npm run test:unit       # 15 ficheros, 218 casos
bash scripts/docker-env.sh dev exec -T backend npm run test:char:run   # 13 flows, 115 casos golden-master
bash scripts/docker-env.sh dev exec -T backend npm run check:imports   # OBLIGATORIO tras mover código
```
El backend **no tiene lint**, pero **sí tiene tests** — ejecútalos, no valides "a mano".
`npm run start` (`node index.js`) sirve la API en `/deasy/v1`, Swagger en `/deasy/docs`.

⚠️ **`test:char:run` RESETEA la base de dev** (reset + bootstrap + seed). Es lo normal para char, pero
no lo lances si tienes datos que quieras conservar. Para actualizar los goldens: `test:char:capture`.

## Architecture

### Capas del backend — regla no negociable

**Los controllers son transporte, no lógica.** Un controller valida la entrada, llama a **un** servicio
y traduce el resultado a HTTP. La lógica de negocio, las transacciones de varios pasos, las máquinas de
estados y cualquier bucle de trabajo viven en `backend/services/`.

`backend/services/documents/DocumentWorkflowResetService.js` (258 L, una responsabilidad) es el estilo
objetivo. Los infractores conocidos están listados en `docs/plan-calidad-2026-08.md` §5-D; no añadas
más — si un controller tuyo pasa de ~40 líneas o abre una transacción, extrae un servicio.

### Reglas al mover código

1. **Refactor = mover código, NO reescribir comportamiento.** Si cambias qué hace algo, no es un refactor.
2. **`node --check` valida SINTAXIS, no imports.** Un símbolo movido sin su `import` es sintaxis válida,
   el módulo **carga**, y revienta en tiempo de LLAMADA. Así estuvieron rotos tres semanas cuatro
   `ReferenceError`. Por eso **`npm run check:imports` es obligatorio tras mover código**, y comprobar
   que el backend arranca **no** sustituye a ejecutarlo.
3. **No injertes casos especiales en el camino genérico.** Es el olor que hizo God a `AdminTableManager`.
4. **Extrae por script, no a mano**, y verifica `count == 1` antes de borrar cada bloque.

### Plan de calidad

`docs/plan-calidad-2026-08.md` es el **documento maestro** de deuda técnica y complejidad: línea base de
SonarQube, ranking de ficheros/funciones, fases de trabajo y la lista de **lo que NO hay que tocar**
(§7 — `sqlTables.js` y los falsos positivos de Sonar entran ahí). Léelo antes de proponer un refactor.

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
`dev` proxy: HTTP `8088` / HTTPS `8443` (API under `/api/deasy/v1`). Direct backend dev port is `3030`. Per-env infra ports (PostgreSQL/RabbitMQ/MinIO/Signer) are listed in `docs/07-despliegue/COMANDOS_PROYECTO.md`.

Env config: `docker/.env` + per-env `docker/.env.<env>`; reference model is `docker/.env_model`. Frontend uses `VITE_API_BASE_URL` (`/api` behind the Nginx proxy in Docker).

## CI/CD
`.github/workflows/cd-multienv.yml`: push to `develop` publishes `dev`-tagged images (no deploy); `qa` and `main` publish `qa`/`prod` images and deploy when `DEPLOY_DELIVERY_MODE=gh-actions`. Published images: `deasy-backend`, `deasy-frontend`, `deasy-signer`, `deasy-analytics`.

Branching: work happens on `develop`; `main` is the production branch.
