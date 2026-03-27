# area_controler.js
## Descripción
Este archivo contiene el controlador para gestionar áreas en el sistema de empresa.
## Funciones
### createArea
- **Descripción**: Crea una nueva área en la base de datos.
- **Parámetros**: 
  - `req`: Objeto de solicitud con datos en `req.body`.
  - `res`: Objeto de respuesta.
- **Retorna**: 
  - Éxito: JSON con `result: "ok"`.
  - Error: Respuesta de error 400 con mensaje.
### getAreas
- **Descripción**: Obtiene todas las áreas de la base de datos.
- **Parámetros**: `req`, `res`
- **Retorna**: 
  - Éxito: JSON con las áreas.
  - Error: Respuesta de error 404 o 500.
## Dependencias
- Modelo `Area` de `../../models/empresa/area_model.js`