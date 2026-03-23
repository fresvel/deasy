# tareas_controler.js
## Descripción
Este archivo contiene el controlador para gestionar tareas (tasks) en el sistema, incluyendo creación, listado y búsqueda por usuario.
## Funciones
### createTarea
- **Descripción**: Crea una nueva tarea en la base de datos.
- **Parámetros**: 
  - `req`: Objeto de solicitud con datos en `req.body`.
  - `res`: Objeto de respuesta.
- **Retorna**: 
  - Éxito: JSON con la tarea creada.
  - Error: Respuesta de error 400.
### createLoteTareas
- **Descripción**: Crea un lote de tareas en la base de datos.
- **Parámetros**: 
  - `req`: Objeto de solicitud con array de tareas en `req.body.tareas`.
  - `res`: Objeto de respuesta.
- **Retorna**: 
  - Éxito: JSON con IDs creados.
  - Error: Respuesta de error 400.
### getuserTarea
- **Descripción**: Busca tareas asignadas a un usuario por cédula, con filtros opcionales.
- **Parámetros**: 
  - `req`: Query params: usuario (cedula), process_id, process_slug, term_id, status.
  - `res`: Objeto de respuesta.
- **Retorna**: 
  - Éxito: JSON con tareas.
  - Error: Respuesta de error 400, 404, 500.
### getTareas
- **Descripción**: Obtiene todas las tareas ordenadas por fecha de creación.
- **Parámetros**: `req`, `res`
- **Retorna**: 
  - Éxito: JSON con tareas.
  - Error: Respuesta de error 400.
### getTareaspendientes
- **Descripción**: Obtiene tareas pendientes para un usuario por cédula.
- **Parámetros**: 
  - `req`: Query param: usuario (cedula).
  - `res`: Objeto de respuesta.
- **Retorna**: 
  - Éxito: JSON con tareas pendientes.
  - Error: Respuesta de error 404, 500.
## Dependencias
- `getMariaDBPool` de `../../config/mariadb.js`
- `SqlAdminService` de `../../services/admin/SqlAdminService.js`