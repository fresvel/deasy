# webtemplate_controler.js
## Descripción
Este archivo contiene el controlador para gestionar plantillas web (web templates) en el sistema de informes. Incluye procesos para cargar archivos, crear colsets, filtrar, unir, actualizar y transpilar a objetos LaTeX.
## Funciones
### createWebTemplate
- **Descripción**: Crea una nueva plantilla web en la base de datos, requiere archivos subidos y datos JSON.
- **Parámetros**: 
  - `req`: Objeto de solicitud con archivos (`req.files`) y datos en `req.body` (incluyendo `jsonData`).
  - `res`: Objeto de respuesta.
- **Retorna**: 
  - Éxito: JSON con `result: "ok"`.
  - Error: Respuesta de error 400 con mensaje.
## Dependencias
- Modelo `WebTemplate` de `../../models/informes/webtemplate_model.js`
- `fs-extra` para manejo de archivos.