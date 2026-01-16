# Backend - Setup (tecnico)

## Requisitos

- Node.js 22
- MariaDB y MongoDB accesibles

## Instalacion

```bash
npm install
```

## Variables de entorno

- Copiar y completar .env:

```bash
cp .env_model .env
```

Variables clave:

- MARIADB_HOST, MARIADB_PORT, MARIADB_DATABASE, MARIADB_USER, MARIADB_PASSWORD
- URI_MONGO
- PORT

## Arranque

```bash
node index.js
```

Servidor por defecto:

- http://localhost:3000/easym/v1/

## Swagger

- UI: http://localhost:3000/easym/docs
- JSON: http://localhost:3000/easym/docs.json

## Notas de DB

- El backend crea la base `deasy` y la tabla `users` si no existen.
- El schema base esta en backend/database/mariadb_schema.sql

