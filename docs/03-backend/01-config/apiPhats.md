# Configuración de rutas de la API

Este archivo documenta las constantes exportadas desde `config/apiPaths.js` que se usan en el backend para construir rutas de la API y rutas de documentación.

## `API_PREFIX`

- **Valor:** `"/easym/v1"`
- Se usa como prefijo base para todos los endpoints de la API.

## `PATHS`

Objeto que contiene las rutas relativas usadas por la API.

Ejemplos de entradas:
- `academia: "/academia"`
- `users: "/users"`
- `usersLogin: "/users/login"`
- `tutorias: "/tutorias"`
- `admin: "/admin"`
- `units: "/units"`
- `program: "/program"`
- `area: "/area"`
- `tarea: "/tarea"`
- `vacancies: "/vacancies"`
- `whatsapp: "/whatsapp"`
- `dossier: "/dossier"`

## `ROUTES`

Derivado de `PATHS` anteponiendo `API_PREFIX` a cada ruta relativa.

Ejemplo:
- `ROUTES.users` => `"/easym/v1/users"`
- `ROUTES.tutorias` => `"/easym/v1/tutorias"`

## Rutas de documentación

- `DOCS_PATH` – `"/easym/docs"`
- `DOCS_JSON_PATH` – `"/easym/docs.json"`

Se usan para servir la documentación de la API y la especificación OpenAPI en JSON.