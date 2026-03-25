# logros_coweb.js
## Descripción
Este archivo contiene el controlador para procesar logros (logros) en formato web. Maneja la subida de archivos, renderiza los logros y devuelve el resultado en JSON.
## Funciones
### logros_coweb
- **Descripción**: Procesa un archivo subido para extraer logros, renderiza el contenido y devuelve el JSON resultante. Elimina el archivo subido después del procesamiento.
- **Parámetros**: 
  - `req`: Objeto de solicitud (request), debe incluir un archivo subido (`req.file`).
  - `res`: Objeto de respuesta (response).
- **Retorna**: 
  - Éxito: JSON con los logros renderizados.
  - Error: Respuesta de error 400 con mensaje de error.
- **Dependencias**: 
  - `renderLogros` de `../../../services/academia/coordinador/render_logros.js`
  - `deleteFile` de `../../../utils/files.js`