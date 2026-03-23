# sql_admin_controller.js

## Descripción

Este archivo contiene el controlador para operaciones administrativas SQL, incluyendo gestión de metadatos, sincronización de plantillas, y operaciones CRUD en tablas.
## Funciones
### getSqlMeta
- **Descripción**: Obtiene los metadatos de las tablas de la base de datos.
- **Parámetros**: `req`, `res`
- **Retorna**: JSON con las tablas.
### syncTemplateArtifacts
- **Descripción**: Sincroniza los artefactos de plantillas desde la distribución.
- **Parámetros**: `_req`, `res`
- **Retorna**: JSON con el resultado de la sincronización.
### syncTemplateSeeds
- **Descripción**: Sincroniza las semillas de plantillas desde la fuente.
- **Parámetros**: `_req`, `res`
- **Retorna**: JSON con el resultado de la sincronización.
### getTemplateSeedPreview
- **Descripción**: Obtiene una vista previa de la semilla de plantilla en PDF.
- **Parámetros**: `req` (con `id` en params), `res`
- **Retorna**: Stream de PDF.
### createTemplateArtifactDraft
- **Descripción**: Crea un borrador de artefacto de plantilla.
- **Parámetros**: `req` (con body y files), `res`
- **Retorna**: JSON con el borrador creado.
### updateTemplateArtifactDraft
- **Descripción**: Actualiza un borrador de artefacto de plantilla.
- **Parámetros**: `req` (con id en params, body y files), `res`
- **Retorna**: JSON con el borrador actualizado.
### listSqlRows
- **Descripción**: Lista filas de una tabla SQL con filtros y paginación.
- **Parámetros**: `req` (con table en params, query params), `res`
- **Retorna**: JSON con las filas.
### createSqlRow
- **Descripción**: Crea una nueva fila en una tabla SQL.
- **Parámetros**: `req` (con table en params, body), `res`
- **Retorna**: JSON con la fila creada.
### updateSqlRow
- **Descripción**: Actualiza una fila en una tabla SQL.
- **Parámetros**: `req` (con table en params, body con keys y data), `res`
- **Retorna**: JSON con la fila actualizada.
### deleteSqlRow
- **Descripción**: Elimina una fila de una tabla SQL.
- **Parámetros**: `req` (con table en params, body con keys), `res`
- **Retorna**: JSON con el resultado de la eliminación.
## Dependencias
- `SqlAdminService` de `../../services/admin/SqlAdminService.js`