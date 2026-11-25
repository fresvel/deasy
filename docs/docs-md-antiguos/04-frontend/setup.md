> ⚠️ **ARCHIVADO — no es fuente de verdad.**
> Este documento describe el sistema tal como era antes de la reorganizacion de `docs/`.
> Puede citar MariaDB, MongoDB, EMQX/MQTT o rutas que ya no existen. Se conserva por su
> valor historico. Para el estado actual, ver el `README.md` de la raiz.

# Frontend - Setup (tecnico)

## Requisitos

- Node.js `^20.19.0` o `>=22.12.0`
- pnpm `>=10`

## Instalacion

```bash
pnpm install
```

## Variables de entorno

- No hay .env por defecto en frontend.
- Configuracion de API en frontend/src/services/apiConfig.js

Variables soportadas:

- VITE_API_BASE_URL (URL completa base)
- VITE_API_PORT (puerto si no se define base URL)

Por defecto usa el host actual y puerto 3030:

- `API_BASE_URL = http://hostname:3030`
- API_PREFIX = /deasy/v1

## Arranque

```bash
pnpm run dev
```

Servidor por defecto:

- `http://localhost:8080/`

## Build

```bash
pnpm run build
```
