# Templates Source

Este modulo reemplaza al repo externo `pucese-templates` como fuente integrada de templates.

## Ubicacion

- Fuente: `tools/templates/templates/`
- Semillas: `tools/templates/seeds/latex/`
- Patrones reusables: `tools/templates/patterns/`
- Dist generado: `tools/templates/dist/Plantillas/`
- CLI: `node tools/templates/cli.mjs`
- TUI: `node tools/templates/tui.mjs` o `node tools/templates/cli.mjs tui`

## Comandos base

- `node tools/templates/cli.mjs new --key investigacion/formativa/informe-docente`
- `node tools/templates/cli.mjs version --key investigacion/formativa/informe-docente --from 1.0.0 --to 1.0.1`
- `node tools/templates/cli.mjs render --key investigacion/formativa/informe-docente --version 1.0.0`
- `node tools/templates/cli.mjs prepare-runtime --key investigacion/formativa/informe-docente --version 1.0.0 --runtime /tmp/runtime.json`
- `node tools/templates/cli.mjs package`
- `node tools/templates/cli.mjs publish --env dev`
- `node tools/templates/tui.mjs`

## Publicacion

La CLI sigue siendo útil para automatización y scripts. La TUI se agrega como una capa interactiva
para navegar templates, versiones, seeds y operaciones comunes sin recordar todas las banderas.

`publish` empaqueta (salvo que uses `--skip-package`) y sube directo a MinIO usando el servicio Docker `minio-publish`, sin pasar por `docker/minio/import/`. La publicacion de templates va al bucket `deasy-templates`, bajo `System/`. Si no indicas `--env`, la CLI usa `dev` por defecto.

Para publicar seeds locales a MinIO, usa:

- `node tools/templates/cli.mjs publish-seeds --env dev`

Eso copia `tools/templates/seeds/` a `deasy-templates/Seeds/`.

## Flujo operativo con Deasy

Este es el flujo recomendado para que una plantilla editable termine disponible en una
definicion de proceso:

1. Edita la fuente en `tools/templates/templates/`.
   - Aqui mantienes `meta.yaml`, `schema.json`, `assets/` y los modos/formatos del template.
   - Este paso modifica la fuente versionada, no MinIO ni la base de datos.

2. Ejecuta `node tools/templates/cli.mjs package`.
   - Construye el paquete publicable en `tools/templates/dist/Plantillas/`.
   - Aqui se genera la estructura canonica que luego se publica a storage.

3. Ejecuta `node tools/templates/cli.mjs publish --env <dev|qa|prod>`.
   - Publica el contenido de `tools/templates/dist/Plantillas/` directo a MinIO en `deasy-templates/System/`.
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

## Metadata de flujos y dependencias

Los artifacts ya no deben describir solo el render. A partir de esta migración, `meta.yaml` debe
ser la fuente de verdad técnica también para el flujo de llenado, el flujo de firmas y las
dependencias mínimas del template. La base de datos puede sincronizar esa información, pero no debe
inventarla primero.

Esto significa que cada template versionado debe declarar en `meta.yaml` una estructura mínima de
`workflows` y `dependencies`. En términos prácticos:

- `workflows.fill` describe la intención técnica del llenado del entregable
- `workflows.signatures` describe la intención técnica del firmado del entregable
- `dependencies` declara dependencias técnicas que el artifact necesita para operar o sincronizar

Aquí `dependencies` no significa relaciones relacionales entre tablas de negocio. Ese plano sigue
perteneciendo al modelo de MariaDB. En `meta.yaml`, `dependencies` debe leerse como dependencia
técnica del artifact: plantillas base, archivos auxiliares, datos requeridos o cualquier insumo que
el template necesite para poder renderizarse, llenarse o sincronizarse correctamente.

La CLI ya genera esa estructura por defecto para templates nuevos y el empaquetado valida que
exista antes de producir `dist/`. Con esto, el `dist` deja de ser solamente un empaquetado visual y
pasa a ser también un contrato técnico sincronizable hacia MariaDB.

En el caso de templates del sistema basados en Jinja/LaTeX, esa estructura debe existir desde el
origen para que el artifact se pueda empaquetar. En el caso de templates creados por usuarios con
formatos como DOCX, XLSX o PDF, también debe ser obligatoria, porque el sistema necesita conocer
desde el artifact cómo se espera llenar y firmar ese documento, incluso si luego la política de
negocio se termina de resolver en la definición del proceso.

Cuando varios documentos comparten el mismo esquema de firmas, no conviene duplicarlo a mano en cada
template. Para eso se deja la carpeta `tools/templates/patterns/`, donde pueden mantenerse patrones
reusables de campos, anchors y pasos de firma. Esos patrones no reemplazan el `meta.yaml`, pero sí
sirven como fuente común para materializar estructuras repetidas y para que el compilador futuro
entienda cómo inyectar tokens y datos reales de firmantes.

En la etapa actual, el uso esperado es mixto. El template puede declarar `pattern_ref` dentro de
`workflows.signatures` para dejar explícito qué patrón reutilizable adopta, pero sigue manteniendo
`anchors` y `steps` materializados en su propio `meta.yaml`, porque esa es la forma que hoy
sincroniza el backend hacia MariaDB. De este modo se gana trazabilidad y validación sin romper el
flujo operativo vigente.

La conexión práctica de ese patrón con el compilador ya puede empezar por la preparación de payload
runtime. Para eso existe el comando `prepare-runtime`, que toma `data + meta + schema + runtime` y
genera un JSON listo para el render Jinja. El detalle del contrato quedó documentado en
`tools/templates/docs/compiler-runtime-contract.md`.

## Artifacts de usuario desde el admin

Cuando un usuario crea un borrador desde el panel admin:

1. El backend construye el paquete temporal en `backend/storage/minio-jobs/templates-drafts/...`.
2. Publica un trabajo en RabbitMQ (`RABBITMQ_STORAGE_QUEUE`).
3. `storage-uploader` toma ese trabajo y lo sube automaticamente a `deasy-templates/Users/<cedula>/...`.
4. Cuando termina la carga, el artifact queda activo en `template_artifacts`.
