# Despliegue - MinIO

## Objetivo

MinIO almacena templates publicados, documentos generados, adjuntos de chat y spool de firmas.

La configuracion actual separa el storage por buckets:

- `deasy-templates`
  - raiz de templates publicados: `System`
  - raiz de seeds publicados: `Seeds`
  - raiz de artifacts de usuario: `Users`
- `deasy-documents`
  - raiz de documentos generados: `Unidades`
- `deasy-chat`
  - raiz de adjuntos: `Chat`
- `deasy-spool`
  - raiz de spool temporal: `Firmas`
- `deasy-dossier`
  - raiz de archivos del dosier: `Dosier`

La carpeta fuente para la carga manual en desarrollo es:

- `docker/minio/import/`

## Servicios involucrados

- `minio`: expone el storage S3-compatible.
- `minio-bootstrap`: tarea puntual que crea el bucket y sincroniza el contenido de `docker/minio/import/`.
- `minio-publish`: publica `tools/templates/dist/Plantillas/` hacia MinIO.
- `minio-publish-seeds`: publica `tools/templates/seeds/` hacia MinIO.
- `storage-uploader`: worker disponible para jobs asincronos de storage (no es el camino principal para paquetes de usuario).

## Flujo de uso en desarrollo

1. Levanta el stack base:
   - `cd docker`
   - `docker compose up -d`

2. Flujo principal recomendado:
   - `node tools/templates/cli.mjs package`
   - `node tools/templates/cli.mjs publish`

3. Fallback manual:
   - copia tu `dist` dentro de `docker/minio/import/Plantillas/`

   Para otras areas, usa rutas explicitas:
   - `docker/minio/import/Seeds/`
   - `docker/minio/import/Unidades/`
   - `docker/minio/import/Chat/`
   - `docker/minio/import/Firmas/`
   - `docker/minio/import/Dosier/`

4. Si usas el fallback manual, ejecuta la carga hacia MinIO:
   - `docker compose --profile storage-init run --rm minio-bootstrap`

5. Verifica en la consola de MinIO:
   - URL: `http://localhost:9001`
   - Usuario: valor de `MINIO_ROOT_USER`
   - Clave: valor de `MINIO_ROOT_PASSWORD`

6. Registra en Deasy los datos del artifact publicado en `template_artifacts`:
   - `bucket`
   - `base_object_prefix`
   - `available_formats`
   - `schema_object_key`
   - `meta_object_key`

## Relacion con el flujo funcional de Deasy

En el flujo normal del sistema, MinIO participa asi:

1. Editar la fuente del template en `tools/templates/templates/`.
2. Ejecutar `node tools/templates/cli.mjs package` para construir `dist`.
3. Ejecutar `node tools/templates/cli.mjs publish` para subir ese `dist` a MinIO.
4. En el admin, usar `Sincronizar dist` en `template_artifacts`.
   - Este paso registra en MariaDB los artifacts detectados en el `dist` local.
   - No vuelve a subir archivos; solo sincroniza metadata.
5. Vincular esos `template_artifacts` en `process_definition_templates`.
   - Desde ahi, una definicion de proceso ya puede usar esos templates.

Flujo adicional para paquetes de usuario creados desde el admin:

1. En `template_artifacts`, usa `Sincronizar seeds`.
2. Crea el paquete de usuario desde el modal del admin.
3. El backend escribe el paquete temporal en `backend/storage/minio-jobs/templates-drafts/...`.
4. El backend lo sube directamente a:
   - `s3://<MINIO_TEMPLATES_BUCKET>/Users/<cedula>/...`
5. Solo cuando la carga termina correctamente, se inserta o actualiza `template_artifacts`.

Flujo manual para publicar seeds locales:

1. Mantener los seeds en `tools/templates/seeds/`.
2. Ejecutar:
   - `node tools/templates/cli.mjs publish-seeds`
3. Ese comando publica:
   - `tools/templates/seeds/...` -> `s3://<MINIO_TEMPLATES_BUCKET>/Seeds/...`

## Convencion de import actual

Si usas `node tools/templates/cli.mjs publish`, el contenido de `tools/templates/dist/Plantillas/` se publica directo en:

- `s3://<MINIO_TEMPLATES_BUCKET>/System/...`

Si usas el fallback manual y colocas un paquete en `docker/minio/import/Plantillas/`, el bootstrap tambien lo publica en:

- `s3://<MINIO_TEMPLATES_BUCKET>/System/...`

Con los valores actuales de desarrollo, eso deja los templates bajo:

- `s3://deasy-templates/System/...`

El fallback manual distribuye el contenido asi:

- `docker/minio/import/Plantillas/...` -> `s3://deasy-templates/System/...`
- `docker/minio/import/Seeds/...` -> `s3://deasy-templates/Seeds/...`
- `docker/minio/import/Unidades/...` -> `s3://deasy-documents/Unidades/...`
- `docker/minio/import/Chat/...` -> `s3://deasy-chat/Chat/...`
- `docker/minio/import/Firmas/...` -> `s3://deasy-spool/Firmas/...`
- `docker/minio/import/Dosier/...` -> `s3://deasy-dossier/Dosier/...`

## Notas

- El bootstrap usa `mc mirror --overwrite`, asi que volver a ejecutarlo reemplaza archivos con la misma ruta.
- `minio-publish` tambien usa `mc mirror --overwrite` y evita el paso intermedio por `docker/minio/import/`.
- `minio-publish-seeds` tambien usa `mc mirror --overwrite` y publica directo desde `tools/templates/seeds/`.
- Si `docker/minio/import/` no contiene las raices `Plantillas`, `Seeds`, `Unidades`, `Chat`, `Firmas` o `Dosier`, el script solo crea/verifica los buckets.
- `minio-bootstrap` no queda corriendo; termina al finalizar la carga.
