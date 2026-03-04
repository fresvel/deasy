# Frontend - Setup (tecnico)

## Requisitos

- Node.js 22
- PNPM

## Instalacion

```bash
pnpm install
```

## Variables de entorno

- No hay .env por defecto en frontend.
- Configuracion de API en frontend/src/services/apiConfig.js

Variables soportadas:

- VUE_APP_API_BASE_URL (URL completa base)
- VUE_APP_API_PORT (puerto si no se define base URL)

Por defecto usa el host actual y puerto 3030:

- API_BASE_URL = http://<hostname>:3030
- API_PREFIX = /easym/v1

## Arranque

```bash
pnpm run dev
```

Servidor por defecto:

- http://localhost:8080/

## Build

```bash
pnpm run build
```

