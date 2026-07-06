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
  setup/
    seed_execution.mjs  # genera datos de EJECUCIÓN vía API (ver más abajo)
  flows/
    auth.test.mjs       # login OK/KO, whoami, roles
    rbac.test.mjs       # 403 esperado por permiso
    processes.test.mjs  # GETs estables de procesos/series/reglas
    tasks.test.mjs      # tareas del usuario / del proceso
    signature.test.mjs  # estado de firma / entregables (usuario admin)
    chat.test.mjs       # conversaciones, mensajes, notificaciones
    execution.test.mjs  # capa de ejecución poblada (requiere el setup)
  __snapshots__/        # golden-master versionado (el diff en git = evidencia)
```

## Datos de ejecución (setup/seed_execution.mjs) — importante

El seed **baseline** deja vacía toda la capa de plantillas+ejecución (y el seed
`--full` está roto por drift de esquema). Los datos de runtime (tareas,
entregables, flujos de firma) se producen **usando el sistema**, no sembrando.

`setup/seed_execution.mjs` maneja el sistema por HTTP para materializarlos, de
forma determinista e idempotente:
1. Siembra el mínimo que el baseline omite: 1 `template_artifact` (ligado al
   deliverable del proceso por defecto) + su link en `process_definition_templates`.
   Se hace **directo por el pool** porque el endpoint CRUD lo bloquea (los
   artifacts solo se registran por sync desde MinIO / flujo de plantilla).
2. Asigna un puesto vigente a la persona usuario (id 3).
3. Crea una tarea ad-hoc **routed** (`POST /users/3/general-tasks`) que
   materializa tarea + entregable + fill-flow + plantilla de firma.

Resultado: datos reales en `tasks, task_items, documents, document_versions`,
las 4 tablas de fill-flow y `signature_flow_templates/steps`. (Las
`signature_flow_instances/requests` requieren upload de PDF + aprobación del
flujo de entrega — MinIO —; quedan como ampliación futura.)

## Cómo se corre

> **Nota**: builds/tests corren DENTRO de los contenedores vía
> `scripts/docker-env.sh` (nunca npm/npx en el host). Ver CLAUDE.md.

> **Chat / determinismo**: el chat ya es relacional (Fase 5). El seed baseline no
> limpia sus tablas, así que `setup/seed_execution.mjs` las purga por el pool
> antes de crear los datos de chat — determinista entre corridas sin pasos extra.

> **Dossier / determinismo (temporal)**: el dossier aún vive en MongoDB (migración
> en curso). Purga sus colecciones antes del setup para un golden determinista:
> ```bash
> docker exec deasy-dev-mongodb-1 mongosh deasy --quiet --eval \
>   'db.dossiers.deleteMany({}); db.usuarios.deleteMany({})'
> ```
> Cuando el dossier pase a relacional, el setup limpiará sus tablas y este paso
> desaparece.

Este harness vive en el worktree `deasy-tests`. Antes de ejecutar, hay que
**apuntar los dockers a este worktree** (el `docker-env.sh` que invocas es la
fuente de verdad de los binds):

```bash
# desde el worktree ~/Documentos/Pucese/deasy-tests
bash scripts/docker-env.sh dev up -d --build
bash scripts/docker-env.sh dev exec backend sh -lc \
  'cd /app/backend && npm run test:char'
```

### Protocolo de 3 fases (la clave)

El estado determinista es **baseline + setup**. Siempre en ese orden:

```bash
# 1) estado relacional conocido (borra+reinserta las tablas incluidas)
bash scripts/seed-db.sh dev apply
# 2) datos de ejecución vía API (idempotente sobre baseline fresco)
bash scripts/docker-env.sh dev exec backend sh -lc 'cd /app/backend && npm run test:char:seed'
```

Luego:

1. **Capturar el golden contra el sistema ACTUAL (MariaDB/Mongo)** — una sola vez:
   ```bash
   ... exec backend sh -lc 'cd /app/backend && SNAPSHOT_MODE=update npm run test:char'
   ```
   Revisa el diff de `__snapshots__/` y **commitéalo**. Ese es el contrato.

2. **Verificar tras migrar/refactorizar** — en cada cambio (reseed+setup primero):
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

El golden-master exige el estado determinista **baseline + setup** (ver arriba).
El reseed baseline usa DELETE y **no reinicia AUTO_INCREMENT**, así que los ids
de la capa de ejecución (y el nombre del term ad-hoc) **derivan** entre
corridas. Por eso:
- Las listas se fijan con **huella estructural** (`listFingerprint`: status +
  count + columnas), no fila a fila.
- Los snapshots de objeto de ejecución usan `maskIdKeys: true` (enmascara toda
  clave `id`/`_id`/`*Id`) + máscara de rutas y `term_name`.

Verificado reproducible en dos corridas limpias independientes (ids distintos,
golden idéntico).
