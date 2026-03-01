# Reportes y firmas - Templates

## Estructura

- LaTeX: backend/services/latex/templates/
- Legacy JSON/JS: backend/templates_legacy/
- Fuente versionada actual: tools/templates/
- Runtime legacy generado: backend/templates_legacy/_runtime/ (no versionar)

## Convenciones

- Mantener relacion definicion de proceso -> plantillas de definicion -> artifacts publicados.
- Los artifacts publicados del sistema se almacenan en MinIO dentro del bucket `deasy-templates`, bajo `System`, y se referencian desde `template_artifacts`.
- Los seeds base pueden publicarse manualmente a `deasy-templates/Seeds`.
- Los artifacts creados desde el admin se encolan y se publican automaticamente a `deasy-templates/Users/<cedula>/...` por medio de `storage-uploader`.
- Documentos generados siguen saliendo a storage compartido; MinIO se usa para plantillas fuente/publicadas.
- La fuente editable vive en `tools/templates/` y se gestiona con `node tools/templates/cli.mjs`.

## Flujo recomendado

Para que una plantilla quede utilizable dentro de una definicion de proceso, sigue esta
secuencia:

1. Editar la fuente en `tools/templates/templates/`.
   - Aqui cambias la plantilla editable y su metadata.

2. Ejecutar `node tools/templates/cli.mjs package`.
   - Genera el paquete canónico en `tools/templates/dist/Plantillas/`.

3. Ejecutar `node tools/templates/cli.mjs publish`.
   - Publica ese `dist` directo a MinIO en `deasy-templates/System`.

4. En el admin, usar `Sincronizar dist` dentro de `template_artifacts`.
   - Esto no sube archivos.
   - Lee el `dist` local y crea/actualiza una fila por paquete en `template_artifacts` con `bucket`,
     `base_object_prefix`, `available_formats` (JSON), `artifact_origin=system` y demas metadata.
   - Si `meta.yaml` declara `repository_stage`, ese valor se sincroniza a `artifact_stage`.
   - El valor permitido es: `draft`, `review`, `approved`, `published`, `archived`.
   - Si el `meta.yaml` del paquete publicado incluye `seed_code`, se enlaza automaticamente `template_seed_id`.
   - Si el backend corre en Docker, el contenedor debe tener montado `tools/templates`
     en modo solo lectura para poder ver `tools/templates/dist/Plantillas/`.
   - Si acabas de agregar ese montaje, recrea `backend` antes de usar el boton.

5. Vincular los `template_artifacts` resultantes en `process_definition_templates`.
   - Esa relacion es la que usa Deasy para asociar una definicion de proceso con sus plantillas.
   - Si una fila de `process_definition_templates` tiene `creates_task = 1`, esa plantilla
     participara en la generacion automatica de tareas por periodo.

## Artifacts de usuario desde el admin

El panel de `template_seeds` y el flujo de artifacts de usuario agregan dos acciones operativas:

1. `Sincronizar seeds`
   - Registra en `template_seeds` los seeds publicados en MinIO bajo `deasy-templates/Seeds/`.
   - Si el seed tiene PDF de render, el modal de borrador puede mostrarlo como preview.
   - Si quieres publicar esos seeds a MinIO, usa:
     - `node tools/templates/cli.mjs publish-seeds`
   - `template_seeds` funciona como catalogo de esos seeds publicados; no hace falta una tabla separada.

2. `Agregar` en `template_artifacts` (flujo de usuario)
   - Abre el modal de artifact de usuario.
   - Permite crear un `template_artifact` en etapa `draft`.
   - Puede basarse en un `template_seed` y/o archivos subidos por el usuario (`pdf`, `docx`, `xlsx`, `pptx`).
   - El backend arma la estructura temporal en `backend/storage/minio-jobs/templates-drafts/...`.
   - Luego la sube directamente a MinIO en la misma operacion.
   - Solo cuando la carga termina correctamente se registra el artifact en la base de datos.
   - Guarda `owner_ref` como snapshot de cedula y `owner_person_id` como FK a `persons.id`.
   - La estructura generada sigue el mismo layout base que `System`: `meta.yaml`, `schema.json` y `template/modes/.../src/`.
   - Antes de publicar, el backend valida que esa estructura exista y que cada formato declarado tenga archivos visibles.
   - Los artifacts `system` no se crean ni se editan manualmente; se registran con `Sincronizar dist`.
   - Cuando se usa un `Seed LaTeX`, el artifact genera tanto `template/modes/system/jinja2/src/` como `template/modes/user/latex/src/`.

## Seed en meta.yaml

- Cuando el CLI crea un template `user/latex` a partir de una semilla, escribe `seed_code` en `meta.yaml`.
- Tambien agrega `seed` como alias legible derivado del mismo valor.
- El CLI tambien deja el comentario `repository_stage: draft | review | approved | published | archived` y crea `repository_stage: published` por defecto.
- `Sincronizar dist` usa `seed_code` para enlazar automaticamente `template_artifacts.template_seed_id`.
