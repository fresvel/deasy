# Despliegue - Scripts

## start-services.sh

- Ubicacion: scripts/start-services.sh
- Objetivo: levantar servicios base del stack con Docker Compose.

### Comportamiento start-services.sh

1) Inicia el servicio Docker via systemd.
2) Valida que docker exista en PATH.
3) Verifica docker/docker-compose.yml.
4) Ejecuta:
   - docker compose up -d
   - docker compose --profile workers up -d

### Requisitos start-services.sh

- Docker instalado y habilitado en systemd.
- Permisos para ejecutar `sudo systemctl start docker`.

### Nota start-services.sh

Si se desea iniciar solo el stack principal, omitir el perfil workers.

## start-services.ps1

- Ubicacion: scripts/start-services.ps1
- Objetivo: equivalente PowerShell de start-services.sh.

### Comportamiento start-services.ps1

1) Verifica Docker CLI en PATH.
2) Espera a que Docker este operativo (abre Docker Desktop si aplica).
3) Asegura `docker/.env`.
4) Ejecuta:
   - `docker compose up -d`
   - `docker compose --profile workers up -d`

## reload-services.sh

- Ubicacion: scripts/reload-services.sh
- Objetivo: recargar servicios Docker seleccionados desde menu interactivo.

### Comportamiento reload-services.sh

1) Lista servicios de compose y permite seleccion multiple.
2) Detiene, elimina y recrea solo servicios elegidos (`--no-deps`).
3) Opcional: limpieza de volumenes de cache/dependencias.
4) FULL RESET opcional con doble confirmacion para volumenes persistentes.
5) Reinstala dependencias en volumenes cuando aplica (frontend/backend).

## reload-services.ps1

- Ubicacion: scripts/reload-services.ps1
- Objetivo: equivalente PowerShell de reload-services.sh.

### Comportamiento reload-services.ps1

1) Mismo flujo interactivo de seleccion de servicios.
2) Misma logica de prune de cache y FULL RESET con token `RESET-DATA`.
3) Recreate selectivo de servicios con `docker compose up -d --build --force-recreate --no-deps`.

## run-seeds.sh

- Ubicacion: scripts/run-seeds.sh
- Objetivo: ejecutar seeds SQL (MariaDB) y/o seeds de storage (MinIO) sin levantar el stack.

### Uso run-seeds.sh

- `scripts/run-seeds.sh`
- `scripts/run-seeds.sh --skip-storage`
- `scripts/run-seeds.sh --skip-db`
- `scripts/run-seeds.sh --seed-file scripts/seeds/pucese.seed.backup.json --skip-storage`

### Comportamiento run-seeds.sh

1) Verifica comandos requeridos y carga `docker/.env`.
2) Exige que `mariadb` y/o `minio` ya esten corriendo segun opciones.
3) Espera readiness de MariaDB antes de aplicar seed SQL.
4) Resuelve el puerto host publicado de MariaDB (`docker compose port mariadb 3306`).
5) Publica seeds de MinIO con `--no-deps`.

## run-seeds.ps1

- Ubicacion: scripts/run-seeds.ps1
- Objetivo: equivalente PowerShell de run-seeds.sh.

### Comportamiento run-seeds.ps1

1) Misma validacion de servicios ya corriendo.
2) Misma resolucion dinamica del puerto de MariaDB.
3) Misma ejecucion de seeds SQL y/o storage segun flags.

## repair-seed.sh

- Ubicacion: scripts/repair-seed.sh
- Objetivo: reparar desajustes de esquema MariaDB que rompen `run-seeds` y ejecutar semillas inmediatamente.

### Uso repair-seed.sh

- `scripts/repair-seed.sh`
- `scripts/repair-seed.sh --seed-file scripts/seeds/pucese.seed.backup.json --skip-storage`
- `scripts/repair-seed.sh --skip-db`

### Comportamiento repair-seed.sh

1) Valida Docker y `docker/.env`.
2) Verifica que `mariadb` este en ejecucion.
3) Aplica `backend/database/mariadb_schema.sql` en la base objetivo.
4) Ejecuta `run-seeds.sh`.
5) Si no recibe argumentos, usa por defecto `--skip-storage`.

## reset_mariadb.mjs

- Ubicacion: scripts/reset_mariadb.mjs
- Objetivo: resetear y reconstruir el esquema MariaDB usando `backend/database/mariadb_initializer.js`.

### Uso reset_mariadb.mjs

- `node scripts/reset_mariadb.mjs`

### Nota reset_mariadb.mjs

Depende de la conectividad definida por variables MariaDB (`backend/.env` o entorno actual).

## seed_pucese.mjs

- Ubicacion: scripts/seed_pucese.mjs
- Objetivo: capturar y reaplicar una semilla completa desde MariaDB leyendo tablas del esquema.

Modos:

- `capture`: genera snapshot JSON de tablas.
- `apply`: limpia e inserta filas desde snapshot.

Uso:

- `node scripts/seed_pucese.mjs capture`
- `node scripts/seed_pucese.mjs apply`
- `node scripts/seed_pucese.mjs apply --file scripts/seeds/pucese.seed.json`

## Migraciones y ajustes SQL (scripts/*.mjs)

- `backfill_unit_labels.mjs`: rellena/normaliza etiquetas de unidades.
- `drop_legacy_tables.mjs`: elimina tablas legacy ya reemplazadas.
- `migrate_process_definition_series.mjs`: migracion de series/versiones de definiciones de proceso.
- `migrate_process_templates.mjs`: migracion de vinculos de procesos-plantillas.
- `migrate_template_artifact_owner_fk.mjs`: ajusta columna/indice/FK de owner en template_artifacts.
- `migrate_template_artifact_stage_enum.mjs`: expande enum de `artifact_stage`.
- `migrate_template_artifacts_to_json.mjs`: migra contenido de artifacts a representacion JSON.
- `migrate_template_artifact_origin.mjs`: normaliza origen de artifacts y objetos relacionados.
- `migrate_template_prefixes_to_system_users.mjs`: migra prefijos de rutas (`Plantillas*` a `System/Users`).
- `migrate_template_seed_drafts.mjs`: transforma seeds draft al nuevo modelo.
- `enforce_process_definition_active_series.mjs`: enforce de regla de serie activa por definicion.
- `enforce_process_definition_document_artifacts.mjs`: enforce de artifacts documentales requeridos.

## Validacion de diseno

- `validate_design.mjs`: wrapper que ejecuta `backend/scripts/validate_design.mjs`.

## seed_university_demo.mjs

- Ubicacion: scripts/seed_university_demo.mjs
- Objetivo: sembrar un escenario demo de unidades, personas, procesos, plantillas y un periodo.

Variables relevantes:

- `API_BASE`: base de la API (default `http://localhost:3030/easym/v1`)
- `SEED_PASSWORD`: password de los usuarios demo
- `SEED`: semilla para generar sufijo deterministico (`SEED_SUFFIX` tiene prioridad)
- `SEED_SUFFIX`: sufijo explicito para IDs/correos demo

## seed_institucion_real.mjs

- Ubicacion: scripts/seed_institucion_real.mjs
- Objetivo: sembrar una estructura institucional extendida.

Variables relevantes:

- `API_BASE`: base de la API (default `http://localhost:3030/easym/v1`)
- `SEED_PASSWORD`: password de usuarios generados
- `SEED`: semilla deterministica para asignaciones y UUID pseudoaleatorios
