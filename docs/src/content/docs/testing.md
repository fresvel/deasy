---
title: "Testing: dos niveles que no se mezclan"
description: "Unitarios junto al módulo y caracterización contra goldens. Dónde va cada uno y por qué importa."
sidebar:
  order: 9
---
Esta es una regla dura del proyecto, y la ubicación de los ficheros **no es estetica**: `sonar-project.properties` distingue tests de código de producción **por patron**, y un fichero mal colocado o mal nombrado se analiza **como código de producción**. Así es como las contrasenas de fixture acabaron contando como vulnerabilidades del sistema.

| **Nivel**           | **Donde**                               | **Nombre**                                                  | **Que prueba**                                   |
|:--------------------|:----------------------------------------|:------------------------------------------------------------|:-------------------------------------------------|
| **Unitario**        | **junto al modulo** que prueba          | `<modulo>.test.js` (`.test.mjs` si el modulo es ESM `.mjs`) | Una unidad, sin red ni base de datos             |
| **Caracterización** | `backend/tests/characterization/flows/` | `<flujo>.test.mjs`                                          | Contrato HTTP extremo a extremo contra *goldens* |

## Reglas de ubicación

- `*.test.js` y `*.test.mjs` son los **únicos sufijos válidos**. **No uses `*.spec.js`**: no hay ni uno en el repositorio, y anadirlo obliga a mantener un patron muerto en la configuración de Sonar y en los globs de `test:unit`.

- Un test unitario nuevo tiene que **caer dentro de los globs de `backend/package.json` → `test:unit`** (`config/`, `database/**`, `services/**`, `utils/**`, `middlewares/**`, `controllers/**`, `errors/**`). Si lo pones fuera, **no lo ejecuta nadie** y no te vas a enterar.

- Si el modulo vive en otra carpeta, **amplia el glob en el mismo commit y en los DOS sitios**: `test:unit` y `test:unit:coverage` llevan la misma lista duplicada (el segundo con prefijo `backend/`, porque corre desde la raiz del repo para que las rutas del lcov le valgan a Sonar). Si solo tocas uno, el test corre pero **no cuenta para la cobertura**.

- No metas tests unitarios en `backend/tests/`: esa carpeta es del harness de caracterización.

- Los tests del frontend van junto al componente o composable (vitest los descubre solo).

:::caution[Una suite que no arranca cuenta como fallo, no como “0 tests”]

Vitest marca *Failed Suite* con 0 casos cuando el error ocurre **al importar** — tipicamente un `vi.mock` incompleto de un modulo que ahora tira de otro. **Mira la línea `Test Files`**, no solo la de `Tests`.

:::

## Los tests unitarios

**Backend**: 32 ficheros, **523 casos**, con `node --test` — el runner nativo de Node, sin Jest ni Vitest. Los mas nutridos:

| **Fichero**                                             | **Casos** |
|:--------------------------------------------------------|:----------|
| `config/postgres.test.js`                               | 67        |
| `config/postgres.dialect.test.js`                       | 38        |
| `services/admin/templates/workflows.test.js`            | 37        |
| `services/admin/crud/validation.test.js`                | 33        |
| `services/admin/templates/flowRows.test.js`             | 31        |
| `services/documents/FillRequestWorkflowService.test.js` | 30        |
| `database/postgres_schema.test.js`                      | 25        |
| `services/sign/PdfSigningService.test.js`               | 24        |
| `services/sign/BatchSigningService.test.js`             | 21        |
| `controllers/users/user_controler.primitives.test.js`   | 21        |

**Frontend**: 18 ficheros, **304 casos** con Vitest y `@vue/test-utils`. La configuración vive en el bloque `test:` de `vite.config.js` (no hay `vitest.config.js`). El entorno por defecto es `node`; los once tests que montan componentes ponen la pragma `// @vitest-environment jsdom` en la primera línea. **No hay pruebas E2E** (ni Playwright ni Cypress).

## Los characterization tests (golden master)

:::tip[Que es un golden master]

En vez de escribir “espero que devuelva `{x: 1}`”, **grabas** lo que devuelve hoy y lo guardas en un JSON. En cada ejecución comparas contra el JSON grabado. Si cambia, el test falla y **el diff de git es la evidencia** de lo que cambiaste.

Sirve para **blindar refactors** en código que no entiendes del todo: no documentas lo que *debería* hacer, sino lo que *hace*, rarezas incluidas. Es la red de seguridad ideal cuando heredas un sistema.

:::

En Deasy son **19 suites, 204 tests y 281 claves de snapshot**, sin dependencias externas: `fetch` nativo mas `node:test` y `node:assert/strict`.

### Anatomia del harness

| **Pieza**                    | **Que hace**                                                                                                                                                                       |
|:-----------------------------|:-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `config.mjs`                 | Todo parametrizable por entorno: `API_PREFIX`, `BASE_URL`, timeouts, `SNAPSHOT_MODE` (`compare` o `update`), los tres usuarios de referencia y la `FIXTURE` con los IDs esperados. |
| `lib/http.mjs`               | `request/get/post/put/patch/del`; devuelve siempre `{status, ok, headers, body}` y **nunca lanza por código de estado**.                                                           |
| `lib/auth.mjs`               | `login(user)` y `tokenFor(userKey)` con cache por ejecución.                                                                                                                       |
| `lib/snapshot.mjs`           | El motor: `matchSnapshot(suite, key, actual)`. En modo `update` escribe y pasa; en `compare` falla, **y también falla si la clave no existe**.                                     |
| `lib/normalize.mjs`          | Enmascara lo volatil (timestamps, `iat`, `exp`, tokens) con `"<normalized>"`. Los IDs **se conservan** a propósito.                                                                |
| `lib/readiness.mjs`          | Polling cada 2 segundos hasta que el sistema responde.                                                                                                                             |
| `lib/db.mjs`                 | **Excepción declarada**: pool de PostgreSQL directo **solo para limpieza**. La regla escrita es *“se usa para LIMPIAR, nunca para ASERTAR”*.                                       |
| `setup/bootstrap_system.mjs` | Construye la fixture con el **bootstrap real por HTTP**, no con un seed SQL paralelo (que era la fuente de verdad anterior y derivaba). Idempotente, y falla si los IDs divergen.  |
| `setup/seed_execution.mjs`   | Siembra datos de ejecución vía API.                                                                                                                                                |
| `__snapshots__/`             | 19 JSON, uno por suite, con claves ordenadas alfabeticamente e indentación 2, para que el **diff de git sea legible**.                                                             |

### El ciclo de trabajo

``` bash
test:char:fixture  = reset.mjs db --yes && test:char:bootstrap && test:char:seed
test:char:run      = test:char:fixture && test:char
test:char:capture  = test:char:fixture && SNAPSHOT_MODE=update npm run test:char
test:char          = node --test --test-concurrency=1 tests/characterization/flows/*.test.mjs
```

Los prefijos de `z` en los nombres de fichero **fuerzan el orden alfabetico** de ejecución (el runner corre con `--test-concurrency=1`), poniendo al final las suites que *escriben* datos. Hoy son **nueve**, y la escalera llega hasta siete `z`: `zz_default_process_routed`, `zz_task_generation`, `zz_template_lifecycle`, `zzz_artifact_draft`, `zzzz_sign_batch`, `zzzz_sign_workflow`, `zzzzz_task_item_relay`, `zzzzzz_flow_steps_db` y `zzzzzzz_schema_flow_reread`.

:::caution[test:char:run RESETEA la base de dev]

Hace reset, bootstrap y seed. Es lo normal para caracterización, pero **no lo lances si tienes datos que quieras conservar**. Para actualizar los goldens: `test:char:capture`.

:::

:::caution[La regla de oro]

**Un refactor no cambia un golden.** Si un snapshot se mueve durante un refactor puro, o rompiste algo o el test estaba mal. En un *fix*, el diff del golden **es** la prueba del arreglo.

:::

## Comandos de validación por modulo

``` bash
# Frontend: lint + tests unitarios, y ademas verificar en el navegador
bash scripts/docker-env.sh dev exec -T frontend pnpm run lint
bash scripts/docker-env.sh dev exec -T frontend pnpm run test:unit
bash scripts/docker-env.sh dev exec -T frontend pnpm run test:unit:coverage
bash scripts/docker-env.sh dev exec -T frontend pnpm run build

# Backend: no tiene lint, pero SI tiene tests
bash scripts/docker-env.sh dev exec -T backend npm run test:unit
bash scripts/docker-env.sh dev exec -T backend npm run test:char:run
bash scripts/docker-env.sh dev exec -T backend npm run check:imports   # OBLIGATORIO tras mover codigo
bash scripts/docker-env.sh dev exec -T backend npm run test:unit:coverage
```

## Las reglas al mover código

Del `CLAUDE.md`, porque cada una nacio de un incidente real:

1.  **Refactor = mover código, NO reescribir comportamiento.** Si cambias que hace algo, no es un refactor.

2.  **`node --check` válida SINTAXIS, no imports.** Por eso `check:imports` es obligatorio, y comprobar que el backend arranca **no** lo sustituye.

3.  **No injertes casos especiales en el camino genérico.**

4.  **Extrae por script, no a mano**, y verifica `count == 1` antes de borrar cada bloque.

5.  **El SQL no lo válida nadie** hasta que se ejecuta esa rama. Pruebalo con `PREPARE` en psql.
