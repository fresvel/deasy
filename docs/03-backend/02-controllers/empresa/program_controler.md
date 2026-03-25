# program_controler.js
## Descripción
Este archivo contiene el controlador para gestionar programas (unidades) en el sistema de empresa, compatible con rutas /program.
## Funciones
### createProgram
- **Descripción**: Crea una nueva unidad (programa) en la base de datos.
- **Parámetros**: 
  - `req`: Objeto de solicitud con datos en `req.body`.
  - `res`: Objeto de respuesta.
- **Retorna**: 
  - Éxito: JSON con la unidad creada.
  - Error: Respuesta de error 400 con mensaje.
### getPrograms
- **Descripción**: Lista las unidades con filtros opcionales.
- **Parámetros**: 
  - `req`: Objeto de solicitud con query params para filtros (unit_type_id, unit_type, is_active).
  - `res`: Objeto de respuesta.
- **Retorna**: 
  - Éxito: JSON con las unidades.
  - Error: Respuesta de error 500.
## Dependencias
- `getMariaDBPool` de `../../config/mariadb.js`
- `SqlAdminService` de `../../services/admin/SqlAdminService.js`