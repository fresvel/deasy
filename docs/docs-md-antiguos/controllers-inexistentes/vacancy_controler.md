> ⚠️ **ARCHIVADO — no es fuente de verdad.**
> Este documento describe el sistema tal como era antes de la reorganizacion de `docs/`.
> Puede citar MariaDB, MongoDB, EMQX/MQTT o rutas que ya no existen. Se conserva por su
> valor historico. Para el estado actual, ver el `README.md` de la raiz.

# vacancy_controler.js
## Descripción
Este archivo contiene el controlador para gestionar vacantes (vacancies) en el sistema de empresa.
## Funciones
### listVisibleVacancies
- **Descripción**: Lista las vacantes visibles para el usuario autenticado, filtradas por estado y permisos.
- **Parámetros**: 
  - `req`: Objeto de solicitud con `uid` y query param `status` (default "abierta").
  - `res`: Objeto de respuesta.
- **Retorna**: 
  - Éxito: JSON con las vacantes.
  - Error: Respuesta de error 401, 500 con mensaje.
## Dependencias
- `getPostgresPool` de `../../config/postgres.js`