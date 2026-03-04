# Documentacion Frontend

Proyecto frontend basado en Vue 3 + Vite + Tailwind CSS.

1. **Instala dependencias**

   ```bash
   pnpm install
   ```

2. **Configura variables de entorno (opcional)**
   - El proyecto no requiere variables de entorno para correr en local.
   - Si necesitas apuntar a otro backend, puedes:
     - editar `src/services/EasymServices.js`, o
     - crear un `.env` compatible con Vite (`VITE_*`).

3. **Lanza el servidor de desarrollo**

   ```bash
   pnpm run dev
   ```

   Por defecto Vite expone la app en `http://localhost:5173/`.

4. **Compila para produccion**

   ```bash
   pnpm run build
   ```

   Los archivos generados se guardan en `dist/`.

5. **Previsualiza build local**

   ```bash
   pnpm run preview
   ```

6. **Lint (opcional)**

   ```bash
   pnpm run lint
   ```
