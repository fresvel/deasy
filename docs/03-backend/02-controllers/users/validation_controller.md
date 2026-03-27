# validation_controller.js
## Descripción
Este archivo contiene el controlador para validar cédulas y números de WhatsApp utilizando servicios externos.
## Funciones
### verifyCedulaEc
- **Descripción**: Valida una cédula ecuatoriana usando WebServices.ec.
- **Parámetros**: `req` con cedula en params, `res`
- **Retorna**: JSON con resultado de validación o error.
### verifyWhatsappEc
- **Descripción**: Valida un número de WhatsApp usando WebServices.ec.
- **Parámetros**: `req` con phone en params, `res`
- **Retorna**: JSON con resultado de validación o error.
## Dependencias
- `validateCedulaEc`, `validateWhatsappEc` de `../../services/external/webservices_ec.js`