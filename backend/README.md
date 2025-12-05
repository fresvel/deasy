# Documentacion Backend

1. **Instala dependencias**
   ```bash
   npm install
   ```

2. **Prepara el archivo de entorno**
   ```bash
   cp .env_model .env
   ```
   Completa las variables de MongoDB, MariaDB y WebServices.ec según tu entorno.

3. **Arranca los servicios externos**
   - MongoDB accesible con la URI definida en `URI_MONGO`.
   - MariaDB escuchando en el host/puerto configurados (el backend creará la base `deasy` y la tabla `users` si no existen).

4. **Inicia el backend**
   ```bash
   node index.js
   ```

5. **Verifica la consola**
   - Debes ver mensajes de conexión a MongoDB.
   - Si la conexión a MariaDB está configurada, se registrará la verificación/creación de la base y la tabla.
   - El servidor queda escuchando en `http://localhost:3000/easym/v1/` por defecto.

6. **Accede a la documentación de la API (Swagger)**
   - Una vez que el servidor esté corriendo, puedes acceder a la documentación interactiva de Swagger en:
     ```
     http://localhost:3000/easym/docs
     ```
   - También puedes obtener el JSON de la documentación en:
     ```
     http://localhost:3000/easym/docs.json
     ```
   - La documentación incluye:
     - **Auth**: Endpoints de autenticación (registro e inicio de sesión)
     - **Dossier**: Endpoints para gestionar el dossier académico (títulos, experiencia, referencias, formación, certificaciones)
   - Desde la interfaz de Swagger puedes probar los endpoints directamente, ver los esquemas de datos requeridos y las respuestas esperadas.

