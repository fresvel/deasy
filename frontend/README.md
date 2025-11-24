# Documentacion Frontend

1. **Instala dependencias**
   ```bash
   npm install
   ```

2. **Configura el archivo `.env` (si aplicara)**
   - El proyecto no usa variables de entorno por defecto.
   - Si necesitas apuntar a otro backend, edita las URLs directamente en `src/services/EasymServices.js` o crea tu propio `.env` siguiendo la convención de Vue CLI.

3. **Lanza el servidor de desarrollo**
   ```bash
   npm run serve
   ```
   Queda expuesto en `http://localhost:8080/` (por defecto).

4. **Compila para producción**
   ```bash
   npm run build
   ```
   Los archivos generados se guardan en `dist/`.

5. **Opcional: lint**
   ```bash
   npm run lint
   ```
