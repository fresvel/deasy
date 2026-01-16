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

