# Compiler — Microservicio Compilador Documental

Servicio HTTP independiente del backend principal para compilar artifacts documentales.

## Estado actual

Esta carpeta define el microservicio separado y su superficie HTTP mínima. La migración completa
del pipeline desde el prototipo interno en `backend/services/documents` sigue pendiente.

## Objetivo arquitectónico

- vivir como servicio raíz independiente del repositorio
- desplegarse con imagen propia
- operar con su propio contenedor
- exponer API de compilación al backend principal
- encapsular internamente render, compilación LaTeX, storage y reportes

## Endpoints previstos

- `GET /health`
- `GET /ready`
- `GET /metrics`
- `POST /compile`
- `GET /compile/:jobId`
- `POST /validate-template`

## Estado funcional actual

Hoy el servicio separado ya puede:

- levantar su propia API
- vivir en carpeta raíz propia: `compiler/`
- desplegarse con Docker y CI/CD análogos a `backend`
- leer `meta.yaml`, `schema.json`, `data` y el source tree del artifact desde MinIO
- validar un payload normalizado enviado por el backend
- ejecutar validación técnica propia del template dentro del microservicio
- empaquetar localmente el runtime Python de render en `compiler/python/render_seed.py`
- instalar dentro de su imagen sus dependencias `Jinja2` y `PyYAML`
- ejecutar el pipeline `jinja2 -> latex -> pdf` dentro del propio microservicio, en workspace local temporal
- persistir el PDF compilado en `MINIO_DOCUMENTS_BUCKET` bajo la ruta canónica `working/pdf/`
- generar y persistir `compile_report.json` junto al PDF compilado
- exponer jobs de compilación consultables por polling con `GET /compile/:jobId`
- emitir logs estructurados JSON y métricas básicas en `GET /metrics`

Payload mínimo actual para `POST /validate-template` y `POST /compile`:

```json
{
  "bucket": "deasy-templates",
  "metaObjectKey": "System/.../meta.yaml",
  "schemaObjectKey": "System/.../schema.json",
  "dataObjectKey": "System/.../data.yaml",
  "renderSourcePrefix": "System/.../modes/system/jinja2/src/"
}
```

Payload normalizado aceptado hoy por `POST /compile`:

- `documentVersion`
- `artifact`
- `sources`
- `renderSource`
- `payload`
- `storage`
- `target`

La validación técnica actual dentro del compilador cubre:

- compatibilidad `renderEngine` / `outputFormat`
- presencia de source tree Jinja
- consistencia `field_refs` vs `schema.json`
- consistencia de anchors y `anchor_refs`

La validación profunda de `pattern_ref` queda marcada como pendiente hasta empaquetar los patterns
localmente dentro del microservicio.

## Contrato de template compilable

Para que una semilla publicada en MinIO sea compilable por este microservicio sin lógica ad hoc,
debe cumplir este contrato técnico:

- declarar `renderEngine = jinja2`
- publicar un árbol fuente en `modes/system/jinja2/src/`
- incluir al menos un archivo `.j2`
- renderizar un `main.tex`
- puede incluir scripts auxiliares como `make.sh` para uso manual fuera del microservicio
- el compilador ignorará `.sh` y otros archivos no permitidos al materializar el workspace
- delegar la compilación LaTeX a un comando fijo interno del microservicio
- depender solo del payload JSON normalizado y de los archivos del propio árbol fuente
- no enviar ni requerir un renderizador propio externo al microservicio

## Variables de entorno base

- `COMPILER_PORT`
- `MINIO_ENDPOINT`
- `MINIO_ACCESS_KEY`
- `MINIO_SECRET_KEY`
- `MINIO_USE_SSL`
- `MINIO_TEMPLATES_BUCKET`
- `MINIO_DOCUMENTS_BUCKET`
- `MINIO_SPOOL_BUCKET`
- `RABBITMQ_URL`

## Nota operativa

Mientras la migración no termine, el comportamiento implementado aquí es de esqueleto de servicio.
El pipeline funcional validado hasta ahora sigue viviendo provisionalmente en `backend/services/documents`.

La dependencia operativa del render ya no debe tomarse desde `tools/`; el microservicio separado
mantiene su propio runtime empaquetado en:

- `compiler/python/render_seed.py`
- `compiler/requirements.txt`

Mientras no exista la capa de jobs asíncronos, `POST /compile` ejecuta el pipeline de forma inline y
devuelve el resultado técnico local del workspace junto con la persistencia remota en MinIO. El
tracking actual de jobs vive en memoria del proceso `compiler`, suficiente para integrar polling con
backend pero no durable ante reinicios del contenedor. Callback HTTP queda soportado como extensión
opcional del mismo contrato.

Si un job se pierde por reinicio del contenedor, la garantía de reintento queda del lado de
`backend`, que detecta `compile_job_not_found` y reemite la compilación para la misma
`document_version`.
