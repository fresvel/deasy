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

