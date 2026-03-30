# proceso_controler.js
## Descripción
Este archivo contiene el controlador para gestionar procesos en el sistema administrativo utilizando servicios SQL.
## Funciones
### createProceso
- **Descripción**: Crea un nuevo proceso en la base de datos utilizando el servicio SQL.
- **Parámetros**: 
  - `req`: Objeto de solicitud (request), puede incluir los datos del proceso en `req.body`.
  - `res`: Objeto de respuesta (response).
- **Retorna**: 
  - Éxito: JSON con el resultado de la creación.
  - Error: Respuesta de error 400 con mensaje de error.
- **Dependencias**: 
  - `SqlAdminService` de `../../services/admin/SqlAdminService.js`