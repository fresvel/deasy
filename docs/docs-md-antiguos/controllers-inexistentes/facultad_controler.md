# facultad_controler.js
## Descripción
Este archivo contiene el controlador para gestionar facultades en el sistema administrativo.
## Funciones
### createFacultad
- **Descripción**: Crea una nueva facultad en la base de datos.
- **Parámetros**: 
  - `req`: Objeto de solicitud (request), debe incluir los datos de la facultad en `req.body`.
  - `res`: Objeto de respuesta (response).
- **Retorna**: 
  - Éxito: JSON con `result: "ok"`.
  - Error: Respuesta de error 400 con mensaje de error.
- **Dependencias**: 
  - Modelo `Facultad` de `../../models/empresa/facultad_model.js`