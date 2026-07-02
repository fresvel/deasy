# Characterization tests (golden-master)

Red de seguridad para la **migración a PostgreSQL** y el refactor posterior.

## Qué son (y qué NO son)

Estos tests **fijan el comportamiento actual** de la API tal cual es hoy — no
comprueban que sea "correcto", comprueban que **no cambió**. Son
*characterization tests* al estilo golden-master (Feathers, *Working Effectively
with Legacy Code*).

Regla de oro de la migración: **el mismo test debe pasar idéntico sobre
MariaDB/Mongo y sobre PostgreSQL**. Si el golden-master cambia, cambió el
comportamiento observable → hay que justificarlo o es una regresión.

Nivel: **black-box HTTP** contra el stack dockerizado. Deliberadamente no
tocamos internals (servicios, SQL, modelos): así el harness sobrevive al
refactor que precisamente va a reestructurar esos internals.

## Estructura

```
tests/characterization/
  config.mjs            # BASE_URL, prefijo, credenciales, modo snapshot (por env)
  lib/
    http.mjs            # cliente fetch -> { status, ok, headers, body }
    auth.mjs            # login -> token (por cédula)
    normalize.mjs       # enmascara campos volátiles (timestamps, JWT)
    snapshot.mjs        # golden-master: compara/actualiza __snapshots__/*.json
    readiness.mjs       # espera a que el stack esté listo
  flows/
    auth.test.mjs       # login OK/KO, whoami, roles
    rbac.test.mjs       # 403 esperado por permiso
    processes.test.mjs  # GETs estables de procesos/series/reglas
    tasks.test.mjs      # tareas del usuario / del proceso
    signature.test.mjs  # estado de firma / entregables
    chat.test.mjs       # conversaciones, mensajes, notificaciones
  __snapshots__/        # golden-master versionado (el diff en git = evidencia)
```

## Cómo se corre

> **Nota**: builds/tests corren DENTRO de los contenedores vía
> `scripts/docker-env.sh` (nunca npm/npx en el host). Ver CLAUDE.md.

Este harness vive en el worktree `deasy-tests`. Antes de ejecutar, hay que
**apuntar los dockers a este worktree** (el `docker-env.sh` que invocas es la
fuente de verdad de los binds):

```bash
# desde el worktree ~/Documentos/Pucese/deasy-tests
bash scripts/docker-env.sh dev up -d --build
bash scripts/docker-env.sh dev exec backend sh -lc \
  'cd /app/backend && npm run test:char'
```

### Flujo de dos fases (la clave)

1. **Capturar el golden contra el sistema ACTUAL (MariaDB/Mongo)** — una sola vez:
   ```bash
   ... exec backend sh -lc 'cd /app/backend && SNAPSHOT_MODE=update npm run test:char'
   ```
   Revisa el diff de `__snapshots__/` y **commitéalo**. Ese es el contrato.

2. **Verificar tras migrar/refactorizar** — en cada cambio:
   ```bash
   ... exec backend sh -lc 'cd /app/backend && npm run test:char'
   ```
   Si algo difiere del golden, el test falla y el `deepEqual` muestra qué campo
   cambió.

## Variables de entorno

| Variable | Default | Para qué |
|---|---|---|
| `BASE_URL` | `http://localhost:3030` | backend directo; detrás del proxy: `http://localhost:8088/api` |
| `API_PREFIX` | `/deasy/v1` | prefijo montado por el backend |
| `SNAPSHOT_MODE` | `compare` | `update` para capturar/reescribir el golden |
| `READINESS_PATH` | `/system/bootstrap/status` | endpoint de readiness |
| `TEST_ADMIN_ID` / `TEST_GESTOR_ID` | `1234567890` / `0987654321` | cédulas seed |
| `*_PASSWORD` | `Demo1234!` | password seed |

## Determinismo

El golden-master exige datos de siembra deterministas. Antes de capturar,
asegúrate del estado conocido con el seed del proyecto
(`scripts/seed-db.sh <env> apply`). Los tests que crean filas nuevas enmascaran
sus IDs no deterministas puntualmente (`mask` en `normalize`).
