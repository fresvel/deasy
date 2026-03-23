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
- `getMariaDBPool` de `../../config/mariadb.js`