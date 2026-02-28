# Despliegue - MinIO

## Objetivo

MinIO almacena templates publicados, documentos generados, adjuntos de chat y spool de firmas.

La configuracion actual separa el storage por buckets:

- `deasy-templates`
  - raiz de templates publicados: `Plantillas`
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
   - `entry_object_key`
   - `schema_object_key`
   - `meta_object_key`
   - `format`
   - `mode`

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

## Convencion de import actual

Si usas `node tools/templates/cli.mjs publish`, el contenido de `tools/templates/dist/Plantillas/` se publica directo en:

- `s3://<MINIO_TEMPLATES_BUCKET>/Plantillas/...`

Si usas el fallback manual y colocas un paquete en `docker/minio/import/Plantillas/`, el bootstrap tambien lo publica en:

- `s3://<MINIO_TEMPLATES_BUCKET>/Plantillas/...`

Con los valores actuales de desarrollo, eso deja los templates bajo:

- `s3://deasy-templates/Plantillas/...`

El fallback manual distribuye el contenido asi:

- `docker/minio/import/Plantillas/...` -> `s3://deasy-templates/Plantillas/...`
- `docker/minio/import/Unidades/...` -> `s3://deasy-documents/Unidades/...`
- `docker/minio/import/Chat/...` -> `s3://deasy-chat/Chat/...`
- `docker/minio/import/Firmas/...` -> `s3://deasy-spool/Firmas/...`
- `docker/minio/import/Dosier/...` -> `s3://deasy-dossier/Dosier/...`

## Notas

- El bootstrap usa `mc mirror --overwrite`, asi que volver a ejecutarlo reemplaza archivos con la misma ruta.
- `minio-publish` tambien usa `mc mirror --overwrite` y evita el paso intermedio por `docker/minio/import/`.
- Si `docker/minio/import/` no contiene las raices `Plantillas`, `Unidades`, `Chat`, `Firmas` o `Dosier`, el script solo crea/verifica los buckets.
- `minio-bootstrap` no queda corriendo; termina al finalizar la carga.
