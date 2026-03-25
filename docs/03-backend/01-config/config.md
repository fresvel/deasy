# Configuración General del Backend

## Carpeta `/config`

La carpeta `/config` dentro del directorio `/backend` contiene archivos de configuración esenciales para el funcionamiento del backend de la aplicación. Estos archivos centralizan la configuración de rutas de API, conexiones a bases de datos y definiciones de tablas SQL, facilitando la gestión y mantenimiento del sistema.

### Archivos en `/config`

#### `apiPaths.js`
Este archivo define las rutas y prefijos de la API REST utilizada por el backend. Incluye:
- Prefijo base de la API (`/easym/v1`)
- Rutas específicas para diferentes módulos (academia, usuarios, tutorías, admin, etc.)
- Rutas generadas automáticamente combinando el prefijo con las rutas específicas
- Rutas para documentación (docs y docs.json)

#### `mariadb.js`
Configura la conexión a la base de datos MariaDB utilizando un pool de conexiones. Funciones principales:
- Validación de variables de entorno requeridas para la conexión
- Creación de un pool de conexiones con configuración base
- Funciones para obtener el pool, nombre de la base de datos y configuración base
- Método para verificar la conectividad de la base de datos

#### `sqlTables.js`
Define la estructura de las tablas SQL utilizadas en el sistema. Incluye:
- Metadatos de cada tabla (nombre, etiqueta, categoría)
- Definición de campos con tipos, restricciones y valores por defecto
- Claves primarias y campos de búsqueda
- Configuración para la gestión dinámica de tablas en interfaces administrativas
