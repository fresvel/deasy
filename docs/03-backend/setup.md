# Backend - Setup (tecnico)

## Requisitos

- Bun 1.2+
- MariaDB y MongoDB accesibles

## Instalacion

```bash
bun install
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
bun run dev
```

Opcional (hot reload sin reinicio de proceso):

```bash
bun run dev:hot
```

Servidor por defecto:

- `http://localhost:3000/easym/v1/`

## Swagger

- UI: `http://localhost:3000/easym/docs`
- JSON: `http://localhost:3000/easym/docs.json`

## Notas de DB

- El backend crea la base `deasy` y la tabla `users` si no existen.
- El schema base esta en backend/database/mariadb_schema.sql
- Catalogo de periodos: `term_types`; cada `terms` referencia `term_type_id`.
