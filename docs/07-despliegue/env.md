# Despliegue - Variables de entorno

## Archivo base

- docker/.env

Contenido actual:

- BACKEND_PORT=3030
- FRONTEND_PORT=8080
- MARIADB_ROOT_PASSWORD=deasy_root
- MARIADB_DATABASE=deasy
- MARIADB_USER=deasy
- MARIADB_PASSWORD=deasy
- URI_MONGO=mongodb://mongodb:27017/deasy

## Backend (docker env)

Variables inyectadas en el contenedor backend desde docker-compose:

- MARIADB_HOST=mariadb
- MARIADB_PORT=3306
- MARIADB_DATABASE
- MARIADB_USER
- MARIADB_PASSWORD
- URI_MONGO
- PORT (usa BACKEND_PORT)

## Frontend (docker env)

- FRONTEND_PORT (mapea el puerto 8080 del contenedor)

## Broker

- EMQX_ALLOW_ANONYMOUS (en docker-compose, por defecto true)

## Storage compartido

- SHARED_STORAGE_ROOT (ruta base para adjuntos y documentos)
- Definirla en entorno backend cuando se habilite storage compartido.

