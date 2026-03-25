# informeparcial_ctl.js
## Descripción
Este archivo contiene el controlador para generar informes parciales en el sistema de tutorías.
## Funciones
### informe_parcial
- **Descripción**: Procesa un archivo subido para generar un informe parcial de calificaciones bajas, luego elimina el archivo.
- **Parámetros**: 
  - `req`: Objeto de solicitud con archivo subido (`req.file`).
  - `res`: Objeto de respuesta.
- **Retorna**: 
  - Éxito: JSON con el resultado del informe.
  - Error: Respuesta de error 400 con mensaje.
## Dependencias
- `getlowGrades` de `../../services/tutorias/getgrades_service.js`
- `deleteFile` de `../../utils/files.js`