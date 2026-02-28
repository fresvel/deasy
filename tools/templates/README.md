# Templates Source

Este modulo reemplaza al repo externo `pucese-templates` como fuente integrada de templates.

## Ubicacion

- Fuente: `tools/templates/templates/`
- Semillas: `tools/templates/seeds/latex/`
- Dist generado: `tools/templates/dist/Plantillas/`
- CLI: `node tools/templates/cli.mjs`

## Comandos base

- `node tools/templates/cli.mjs new --key investigacion/formativa/informe-docente`
- `node tools/templates/cli.mjs version --key investigacion/formativa/informe-docente --from 1.0.0 --to 1.0.1`
- `node tools/templates/cli.mjs render --key investigacion/formativa/informe-docente --version 1.0.0`
- `node tools/templates/cli.mjs package`
- `node tools/templates/cli.mjs publish`

## Publicacion

`publish` empaqueta (salvo que uses `--skip-package`) y sube directo a MinIO usando el servicio Docker `minio-publish`, sin pasar por `docker/minio/import/`. La publicacion de templates va al bucket `deasy-templates`, bajo `Plantillas/`.

## Flujo operativo con Deasy

Este es el flujo recomendado para que una plantilla editable termine disponible en una
definicion de proceso:

1. Edita la fuente en `tools/templates/templates/`.
   - Aqui mantienes `meta.yaml`, `schema.json`, `assets/` y los modos/formatos del template.
   - Este paso modifica la fuente versionada, no MinIO ni la base de datos.

2. Ejecuta `node tools/templates/cli.mjs package`.
   - Construye el paquete publicable en `tools/templates/dist/Plantillas/`.
   - Aqui se genera la estructura canonica que luego se publica a storage.

3. Ejecuta `node tools/templates/cli.mjs publish`.
   - Publica el contenido de `tools/templates/dist/Plantillas/` directo a MinIO en `deasy-templates/Plantillas/`.
   - Este paso mueve archivos a storage, pero todavia no registra filas en `template_artifacts`.

4. Ejecuta `Sincronizar dist` en el panel admin, dentro de `template_artifacts`.
   - El sistema recorre el `dist` local y crea/actualiza filas en `template_artifacts`.
   - Este paso registra en MariaDB el metadata necesario para que Deasy pueda referenciar el
     artifact publicado sin cargarlo a mano.
   - Si el backend corre en Docker, `docker-compose` debe montar `tools/templates` dentro del
     contenedor backend para que pueda leer `tools/templates/dist/Plantillas/`.

5. Usa esos `template_artifacts` en `process_definition_templates`.
   - Aqui vinculas una definicion de proceso con uno o varios artifacts publicados.
   - Si el registro tiene `creates_task = 1`, esa plantilla podra generar tareas al instanciar
     un periodo.
