# perfil_controler.js
## Descripción
Este archivo contiene el controlador para gestionar perfiles en el sistema administrativo.
## Funciones
### createPerfil
- **Descripción**: Crea un nuevo perfil en la base de datos.
- **Parámetros**: 
  - `req`: Objeto de solicitud (request), debe incluir los datos del perfil en `req.body`.
  - `res`: Objeto de respuesta (response).
- **Retorna**: 
  - Éxito: JSON con `result: "ok"`.
  - Error: Respuesta de error 400 con mensaje de error.
- **Dependencias**: 
  - Modelo `Perfil` de `../../models/empresa/perfil_model.js`