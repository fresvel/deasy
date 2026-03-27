# user_controler.js
## Descripción
Este archivo contiene el controlador para gestionar usuarios, incluyendo creación, búsqueda, actualización de fotos, menús, paneles de procesos y creación de tareas.
## Funciones
### createUser
- **Descripción**: Crea un nuevo usuario en la base de datos, envía verificación de email y mensaje de bienvenida por WhatsApp.
- **Parámetros**: `req` con datos del usuario en body, `res`
- **Retorna**: JSON con usuario creado o error.
### getUsers
- **Descripción**: Busca usuarios con filtros de búsqueda, límite y estado.
- **Parámetros**: `req` con query params (search, limit, status), `res`
- **Retorna**: JSON con lista de usuarios.
### updateUserPhoto
- **Descripción**: Actualiza la foto de perfil de un usuario por cédula.
- **Parámetros**: `req` con cedula en params y archivo en req.file, `res`
- **Retorna**: JSON con resultado o error.
### getUserMenu
- **Descripción**: Construye el menú del usuario basado en sus posiciones y procesos accesibles.
- **Parámetros**: `req` con user_id, `res`
- **Retorna**: JSON con unidades, grupos y procesos consolidados.
### getUserProcessDefinitionPanel
- **Descripción**: Obtiene el panel operativo de una definición de proceso para el usuario.
- **Parámetros**: `req` con user_id y definitionId, `res`
- **Retorna**: JSON con panel de proceso o error.
### createUserProcessTask
- **Descripción**: Crea una tarea de proceso para el usuario.
- **Parámetros**: `req` con user_id y definitionId, `res`
- **Retorna**: (No implementado completamente).
## Dependencias
- `path`, `fs-extra` para manejo de archivos.
- `whatsappBot` de `../../services/whatsapp/WhatsAppBot.js`
- `UserRepository` de `../../services/auth/UserRepository.js`
- `getMariaDBPool` de `../../config/mariadb.js`
- `hydrateTaskFromDefinition` de `../../services/admin/TaskGenerationService.js`
- `sendEmailVerification` de `../../services/mail/sendEmailVerification.js`