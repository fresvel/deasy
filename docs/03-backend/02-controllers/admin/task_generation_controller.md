# task_generation_controller.js
## Descripción
Este archivo contiene el controlador para la generación de tareas para un período específico.
## Funciones
### generateTasksForTermController
- **Descripción**: Genera tareas para un período dado.
- **Parámetros**: 
  - `req`: Objeto de solicitud con `termId` en params.
  - `res`: Objeto de respuesta.
- **Retorna**: 
  - Éxito: JSON con el resultado de la generación.
  - Error: Respuesta de error 400 o 500 con mensaje.
- **Dependencias**: 
  - `generateTasksForTerm` de `../../services/admin/TaskGenerationService.js`