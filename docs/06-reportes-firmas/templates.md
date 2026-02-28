# Reportes y firmas - Templates

## Estructura

- LaTeX: backend/services/latex/templates/
- Legacy JSON/JS: backend/templates_legacy/
- Fuente versionada actual: tools/templates/
- Runtime legacy generado: backend/templates_legacy/_runtime/ (no versionar)

## Convenciones

- Mantener relacion definicion de proceso -> plantillas de definicion -> artifacts publicados.
- Los artifacts publicados se almacenan en MinIO dentro del bucket `deasy-templates`, bajo `Plantillas`, y se referencian desde `template_artifacts`.
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
   - Publica ese `dist` directo a MinIO en `deasy-templates/Plantillas`.

4. En el admin, usar `Sincronizar dist` dentro de `template_artifacts`.
   - Esto no sube archivos.
   - Lee el `dist` local y crea/actualiza una fila por paquete en `template_artifacts` con `bucket`,
     `base_object_prefix`, `available_formats` (JSON) y demas metadata.
   - Si el backend corre en Docker, el contenedor debe tener montado `tools/templates`
     en modo solo lectura para poder ver `tools/templates/dist/Plantillas/`.
   - Si acabas de agregar ese montaje, recrea `backend` antes de usar el boton.

5. Vincular los `template_artifacts` resultantes en `process_definition_templates`.
   - Esa relacion es la que usa Deasy para asociar una definicion de proceso con sus plantillas.
   - Si una fila de `process_definition_templates` tiene `creates_task = 1`, esa plantilla
     participara en la generacion automatica de tareas por periodo.
