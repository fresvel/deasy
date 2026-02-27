# Despliegue - Scripts

## start-services.sh

- Ubicacion: scripts/start-services.sh
- Objetivo: levantar servicios base del stack con Docker Compose.

### Comportamiento

1) Inicia el servicio Docker via systemd.
2) Valida que docker exista en PATH.
3) Verifica docker/docker-compose.yml.
4) Ejecuta:
   - docker compose up -d
   - docker compose --profile workers up -d

### Requisitos

- Docker instalado y habilitado en systemd.
- Permisos para ejecutar `sudo systemctl start docker`.

### Nota

Si se desea iniciar solo el stack principal, omitir el perfil workers.

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

## seed_pucese.mjs

- Ubicacion: scripts/seed_pucese.mjs
- Objetivo: capturar y reaplicar una semilla completa desde MariaDB leyendo todas las tablas.

Modos:

- `capture`: genera snapshot en JSON de todas las tablas (ordenadas por `SQL_TABLES`).
- `apply`: limpia e inserta nuevamente los datos capturados.

Uso:

- `node scripts/seed_pucese.mjs capture`
- `node scripts/seed_pucese.mjs apply`
- `node scripts/seed_pucese.mjs capture --file scripts/seeds/pucese.seed.json`
