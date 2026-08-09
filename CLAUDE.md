# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Reglas de Testing 
Para realizar las pruebas debes considerar que todo el sistema está dockerizado.  En la ruta scripts está docker-env.sh que te permite levantar entornos y ejecutar comandos de manera rápida. 

Los usuarios de referencia los **crea el bootstrap** (`/setup` → "usar datos de
ejemplo"); no hay ningún seed SQL alternativo. Ojo: la contraseña del gestor NO es `Demo1234!`.

    admin   -> cédula 1234567890  /  Demo1234!
    gestor  -> cédula 0987654321  /  Gestor1234!   (de momento tiene rol de usuario también)
    usuario -> cédula 1122334455  /  Demo1234!

El router bloquea el espacio de usuario para el admin con `meta: { blockedForAdmin: true }` (el
guard lo redirige a `/admin`): `/home`, `/home/documentos`, `/home/firmas` y `/perfil` con todas
sus hijas, porque vue-router hereda el `meta`. Así que para probar el dossier o las firmas hay que
entrar como gestor o usuario.

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
  en el mismo commit — y en los DOS sitios**: `test:unit` y `test:unit:coverage` llevan la misma lista
  duplicada (el segundo con prefijo `backend/`, porque corre desde la raíz del repo para que las rutas
  del lcov le valgan a Sonar). Si solo tocas uno, el test corre pero no cuenta para la cobertura.
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
- `scripts/` — operational wrappers for startup, deploy, reset and migrations.

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
bash scripts/docker-env.sh dev exec -T frontend pnpm run test:unit  # vitest run
bash scripts/docker-env.sh dev exec -T frontend pnpm run test:unit:coverage  # lcov para SonarQube
bash scripts/docker-env.sh dev exec -T frontend pnpm run build
```
Para cambios de FE: **lint + `test:unit`**, y además verificar aspecto/comportamiento en el navegador.
Lint solo no es la puerta de validación: hay vitest + `@vue/test-utils` y hay que usarlos.

Al **añadir dependencias** al frontend hay que instalar **dentro del contenedor** — el volumen de
`node_modules` sombrea el de la imagen y un `pnpm install` en el host no se ve dentro.

### Backend
```bash
bash scripts/docker-env.sh dev exec -T backend npm run test:unit          # unitarios, junto a su módulo
bash scripts/docker-env.sh dev exec -T backend npm run test:char:run      # contrato HTTP contra goldens
bash scripts/docker-env.sh dev exec -T backend npm run check:imports      # OBLIGATORIO tras mover código
bash scripts/docker-env.sh dev exec -T backend npm run test:unit:coverage # lcov para SonarQube
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

`backend/services/documents/DocumentWorkflowResetService.js` es el estilo objetivo: **una sola
responsabilidad**, y se lee de una sentada. Los infractores conocidos están listados en `docs/plan-calidad-2026-08.md` §5-D; no añadas
más — si un controller tuyo pasa de ~40 líneas o abre una transacción, extrae un servicio.

### Reglas al mover código

1. **Refactor = mover código, NO reescribir comportamiento.** Si cambias qué hace algo, no es un refactor.
2. **`node --check` valida SINTAXIS, no imports.** Un símbolo movido sin su `import` es sintaxis válida,
   el módulo **carga**, y revienta en tiempo de LLAMADA. Así estuvieron rotos tres semanas cuatro
   `ReferenceError`. Por eso **`npm run check:imports` es obligatorio tras mover código**, y comprobar
   que el backend arranca **no** sustituye a ejecutarlo.
3. **No injertes casos especiales en el camino genérico.** Es el olor que hizo God a `AdminTableManager`.
4. **Extrae por script, no a mano**, y verifica `count == 1` antes de borrar cada bloque.
5. **El SQL no lo valida NADIE hasta que se ejecuta esa rama.** `node --check` no lo mira,
   `check:imports` tampoco, y el backend arranca igual: es una cadena de texto. Así sobrevivieron
   meses **cuatro** `UPDATE ... INNER JOIN ... SET` (sintaxis multi-tabla de MySQL que PostgreSQL
   rechaza) y dejaron `POST /sign/fill-requests/:id/return` **roto para todo el mundo**.
   PostgreSQL quiere `UPDATE tabla alias SET col = ... FROM otra WHERE union AND filtros`, con las
   columnas del `SET` **sin cualificar**. Al escribir SQL nuevo: pruébalo con `PREPARE` en psql, y
   recuerda que **`grep "UPDATE.*JOIN"` no encuentra nada** porque el SQL ocupa varias líneas.

### Plan de calidad

`docs/plan-calidad-2026-08.md` es el **documento maestro** de deuda técnica y complejidad: línea base de
SonarQube, ranking de ficheros/funciones, fases de trabajo y la lista de **lo que NO hay que tocar**
(§7 — `sqlTables.js` y los falsos positivos de Sonar entran ahí). Léelo antes de proponer un refactor.

### SonarQube — cómo está montado

**Aquí va solo lo que no cambia.** Las cifras (complejidad, incidencias, cobertura, ranking) viven en
`docs/plan-calidad-2026-08.md` y **cambian con cada escaneo**: no las repliques en este fichero.

| Pieza | Dónde |
|---|---|
| Stack | `scripts/sonar/compose.yml` — SonarQube **community** + PostgreSQL 16, proyecto compose `deasy-sonar`, puerto **9002 → 9000** |
| Lanzador | `scripts/sonar/scan.sh` — `sonar-scanner-cli` dockerizado |
| Config | `sonar-project.properties` — `projectKey=deasy`; `sources=backend,frontend/src,signer,scripts`, con los tests **declarados aparte** |
| CI | `.github/workflows/sonar.yml` — `workflow_dispatch` |

```bash
docker compose -f scripts/sonar/compose.yml up -d           # levanta el servidor en :9002
SONAR_TOKEN=<token> bash scripts/sonar/scan.sh              # escanea (~1,5 min)
```

**Credenciales:** usuario `admin`, contraseña `Demo1234!Demo`.

**Pero la API NO acepta esa contraseña por basic auth** — desde que dejó de ser la de por defecto,
`-u admin:<pass>` devuelve 401 contra `/api/measures/*` y `/api/authentication/validate` responde
`{"valid":false}` incluso siendo correcta. **Todo va por token.** Para emitir uno sin abrir la UI:

```bash
curl -s -c cj.txt -X POST "http://localhost:9002/api/authentication/login" \
     -d "login=admin" --data-urlencode "password=Demo1234!Demo"
XSRF=$(awk '/XSRF-TOKEN/{print $7}' cj.txt)
curl -s -b cj.txt -H "X-XSRF-TOKEN: $XSRF" -X POST \
     "http://localhost:9002/api/user_tokens/generate" -d "name=deasy-scan-$(git rev-parse --short HEAD)"
```
El `X-XSRF-TOKEN` no es opcional: sin él el `POST` da 401 aunque la cookie sea válida.

**Cuatro cosas que se olvidan y cuestan una medición entera:**

1. **Regenera los DOS informes de cobertura ANTES de escanear** (`test:unit:coverage` en backend y
   frontend). Si no, Sonar lee los de la corrida anterior **sin quejarse**. Y si las rutas `SF:` del
   lcov no son relativas a la raíz del repo, los descarta **en silencio** y la cobertura vuelve a 0.
2. **Al consultar la API, filtra con `resolved=false`.** Por defecto `/api/issues/search` incluye las
   cerradas y las *won't fix*, y los conteos salen inflados.
3. **El escaneo se PROCESA después de subirse.** Consultar métricas justo al terminar devuelve las
   viejas: espera a que `/api/ce/task?id=<id>` diga `SUCCESS`.
4. **No toques `sonar.projectVersion`.** Mueve el New Code period y tira la serie histórica, que es el
   único termómetro fiable que hay.

**El servidor es solo local.** No es alcanzable desde un runner de GitHub, así que Sonar en CI está
pendiente de una decisión de infraestructura (publicarlo con TLS o migrar a SonarCloud), no de código.
El workflow ya está escrito y hace *skip* en verde mientras falten los secrets `SONAR_HOST_URL` y
`SONAR_TOKEN`.

**Marcar no es arreglar.** Los falsos positivos se marcan en Sonar con justificación; hay varios que
**no** hay que "corregir" (§7 del plan). Sonar rastrea la incidencia por el **hash de la línea**: un
rename puro conserva la marca, reescribir la línea la pierde.

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
