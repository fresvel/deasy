> ⚠️ **ARCHIVADO — no es fuente de verdad.**
> Este documento describe el sistema tal como era antes de la reorganizacion de `docs/`.
> Puede citar MariaDB, MongoDB, EMQX/MQTT o rutas que ya no existen. Se conserva por su
> valor historico. Para el estado actual, ver el `README.md` de la raiz.

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
npm run start
```

Servidor por defecto:

- http://localhost:3000/deasy/v1/

## Swagger

- UI: http://localhost:3000/deasy/docs
- JSON: http://localhost:3000/deasy/docs.json

## Notas de DB

- El backend crea la base `deasy` y la tabla `users` si no existen.
- El schema base esta en backend/database/mariadb_schema.sql
- Catalogo de periodos: `term_types`; cada `terms` referencia `term_type_id`.
