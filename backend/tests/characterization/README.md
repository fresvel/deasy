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
    zzzz_sign_batch.test.mjs     # /sign: validación, lote y descargas (guards de sign_controller)
    zzzz_sign_workflow.test.mjs  # máquina de estados de fill_requests (MUTA)
    zzzzzz_flow_steps_db.test.mjs # pasos de flujo EN LA BASE (MUTA; corre el ÚLTIMO)
  __snapshots__/        # golden-master versionado (el diff en git = evidencia)
```

### El único flow cuyo oráculo es SQL

`zzzzzz_flow_steps_db` rompe a propósito la regla «black-box HTTP», y conviene saber por qué antes
de copiarlo: el §0.8 del plan maestro va a mover el flujo del `meta.yaml` a la base, y **ninguna ruta
expone el resultado**. La que lo parece —`GET /template_artifacts/:id/schema`— lee el flujo del
propio `meta.yaml`, o sea justo lo que se va a eliminar; y lo que hoy se fija por HTTP es el
`content_hash` del paquete de MinIO, que **incluye ese fichero** y por tanto cambiará por
construcción sin decir nada del flujo. Cuando lo que hay que caracterizar es el estado que un cambio
va a reescribir y ninguna ruta lo enseña, el oráculo es la base. Separa los **dos productores** en
claves distintas (`plantilla_*`, que la inversión cambia, y `runtime_*`, que es el grupo de control),
y enmascara los ids estructurales pero **no** los que son el «quién».

## La fixture es el BOOTSTRAP, no el seed

La fuente de verdad del sistema es lo que produce una **instalación nueva**:
`POST /system/bootstrap/initialize`. El harness se construye contra eso.

Antes se construía contra `scripts/seed-db.sh dev apply`, un snapshot SQL paralelo.
Eran dos fuentes de verdad, y el seed era la peor de las dos:

- Dejaba vacía la capa de plantillas, así que el setup tenía que inyectarla
  **escribiendo directo al pool**, saltándose el guard del endpoint.
- Su modo `--full` estaba roto por drift de esquema.
- Congelaba valores rancios: el golden guardaba `definition_name = "Proceso por
  defecto por General"`, un nombre que la aplicación **ya no genera**.

Ese snapshot y su wrapper `seed-db.sh` **ya no existen**: el bootstrap es la única
fixture del sistema. Para cargar datos de ejecución a mano en dev queda
`backend/scripts/seed_dev_rich.mjs`, que corre **sobre** un sistema ya bootstrapeado
en vez de sustituirlo.

### Los dos scripts de setup

`setup/bootstrap_system.mjs` inicializa el sistema con datos de ejemplo y
**verifica la fixture**: que `unit_position 25` viva en la unidad 8 y tenga cargo
`DOCENTE`. Esa verificación no es cosmética — `cargo_role_map` eleva DOCENTE a
`GestorEjecucionProcesos` (con `documents.*`). Con un cargo sin elevación, el test
de ownership del document-center ajeno nunca llega a comprobar la propiedad: lo
corta antes la puerta genérica de RBAC, y el test pasaría (403) sin probar lo que
dice probar.

`setup/seed_execution.mjs` produce los datos de runtime **usando el sistema**, no
sembrando:
1. Comprueba que el bootstrap dejó la capa de plantillas.
2. Asigna un puesto vigente a la persona usuario.
3. Crea una tarea ad-hoc **routed** (`POST /users/:id/general-tasks`) que
   materializa tarea + entregable + fill-flow + plantilla de firma.

Resultado: datos reales en `tasks, task_items, documents, document_versions`,
las 4 tablas de fill-flow y `signature_flow_templates/steps`. (Las
`signature_flow_instances/requests` requieren upload de PDF + aprobación del
flujo de entrega — MinIO —; quedan como ampliación futura.)

Los ids de la fixture viven en un único sitio: `FIXTURE`, en `config.mjs`.

## Cómo se corre

> **Nota**: builds/tests corren DENTRO de los contenedores vía
> `scripts/docker-env.sh` (nunca npm/npx en el host). Ver CLAUDE.md.

> **Chat y dossier**: `setup/seed_execution.mjs` purga sus tablas por el pool antes
> de crear los datos, para que el setup siga siendo determinista aunque se reejecute
> sin resetear la base.

### Los flujos de chat MUTAN estado: la fixture se reconstruye siempre

Un test como *"GET /chat/processes/:id/thread antes de crear → 404"* solo dice la
verdad la primera vez: al correrlo, el siguiente test crea el hilo. Correr
`test:char` dos veces sobre la misma base falla, y —mucho peor— capturar el golden
sobre una base ya usada congela un **200** donde debía haber un 404.

Por eso los comandos reconstruyen la fixture ellos mismos. **No los partas a mano.**

```bash
# verificar (reset -> bootstrap -> datos de ejecución -> comparar)
bash scripts/docker-env.sh dev exec backend npm run test:char:run

# capturar el golden (mismo pipeline, pero reescribe __snapshots__)
bash scripts/docker-env.sh dev exec backend npm run test:char:capture
```

> `test:char:fixture` **resetea la base de datos**. Es lo que la hace determinista.
> No la apuntes a un entorno cuyos datos te importen.

Tras capturar, revisa el diff de `__snapshots__/` y **commitéalo**: ese es el
contrato. Recapturar solo es legítimo cuando sabes que el comportamiento actual es
correcto; a mitad de un refactor, un diff de snapshot deja de distinguir "cambió el
código" de "cambió la fixture".

`npm run test:char` a secas solo compara, y asume que la fixture ya está recién
construida.

## Variables de entorno

| Variable | Default | Para qué |
|---|---|---|
| `BASE_URL` | `http://localhost:3030` | backend directo; detrás del proxy: `http://localhost:8088/api` |
| `API_PREFIX` | `/deasy/v1` | prefijo montado por el backend |
| `SNAPSHOT_MODE` | `compare` | `update` para capturar/reescribir el golden |
| `READINESS_PATH` | `/system/bootstrap/status` | endpoint de readiness |
| `TEST_ADMIN_ID` / `TEST_GESTOR_ID` / `TEST_USUARIO_ID` | `1234567890` / `0987654321` / `1122334455` | cédulas del bootstrap |
| `TEST_ADMIN_PASSWORD` / `TEST_USUARIO_PASSWORD` | `Demo1234!` | contraseñas del bootstrap |
| `TEST_GESTOR_PASSWORD` | `Gestor1234!` | **ojo**: la del gestor es distinta |
| `FIXTURE_*` | ver `config.mjs` | ids de la fixture (persona, unidad, puesto, proceso) |

## Determinismo

El golden-master exige el estado determinista **reset + bootstrap + setup**, que es
lo que hace `test:char:fixture`. Además:
- Las listas se fijan con **huella estructural** (`listFingerprint`: status +
  count + columnas), no fila a fila.
- Los snapshots de objeto de ejecución usan `maskIdKeys: true` (enmascara toda
  clave `id`/`_id`/`*Id`) + máscara de rutas y `term_name`.

Verificado: `npm run test:char:run` da 40/40 dos veces seguidas.

## Cobertura: lo que este harness NO protege

Es una red de seguridad **parcial**, y conviene saber dónde no hay red.
`sql_admin_router` expone ~48 endpoints; aquí se tocan tres, y de forma superficial:
seis `GET /admin/sql/<tabla>` que solo comparan estado, número de filas y nombres de
columna (`listFingerprint` no mira valores), un `GET document_versions`, y un POST
con cuerpo vacío que solo comprueba un 403.

En particular **no hay cobertura** de `SqlAdminService.create()` ni `update()` (las
dos funciones más complejas del repositorio), ni del grafo de unidades, ni del de
procesos, ni del ciclo de borrador/publicación de plantillas. Ampliarla es requisito
previo para partir `SqlAdminService`.

Del **dominio de firma** (Fase D del plan de calidad) queda fuera todo lo que exige el
microservicio Python: el camino feliz de `requestSign` y de `POST /sign/batch/start`, y
`validateSignedDocument` más allá de su 400. El bootstrap **no siembra certificados**
(`person_certificates` vacía), así que `buildSignContext` siempre corta en «Certificado no
encontrado» y los guards posteriores (el `statMinioObject` del certificado y «Modo de firma
inválido») no tienen golden. Tampoco lo tiene `reactivatePreviousFillStepIfNeeded`: los
flujos de entrega de la fixture tienen **un solo paso**.
