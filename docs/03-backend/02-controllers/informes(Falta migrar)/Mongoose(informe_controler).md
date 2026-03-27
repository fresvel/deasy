# informe_controler.js
## Descripción
Este archivo contiene el controlador para gestionar informes (reports) en el sistema.
## Funciones
### createInforme
- **Descripción**: Crea un nuevo informe en la base de datos.
- **Parámetros**: 
  - `req`: Objeto de solicitud con datos en `req.body`.
  - `res`: Objeto de respuesta.
- **Retorna**: 
  - Éxito: JSON con `result: "ok"`.
  - Error: Logs error.
### getInforme
- **Descripción**: Busca un informe por parámetros específicos (año, período, programa, proceso).
- **Parámetros**: `req`, `res`
- **Retorna**: 
  - Éxito: JSON con el informe.
  - Error: Respuesta de error 404, 400, o 500.
## Dependencias
- Modelo `Informe` de `../../models/informes/informe_model.js`