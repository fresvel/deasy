# Contrato HTTP del microservicio compilador documental

## Objetivo

Definir el contrato HTTP inicial del microservicio compilador documental para integrarlo con el
backend principal sin mezclar reglas de negocio, manteniendo la semántica documental actual del
repositorio:

- `payload_object_path`
- `working_file_path`
- `final_file_path`

Este contrato cubre el punto 1 de `codex/tasks/tarea02.md` y deja preparada la integración de los
siguientes puntos del backlog.

## Aclaración arquitectónica

La implementación actual en `backend/services/documents` debe leerse como prototipo técnico
transitorio para validar contrato, payload, validación y pipeline.

No debe considerarse el estado final objetivo.

El estado final requerido es:

- microservicio compilador separado del backend principal
- código fuente ubicado en una carpeta raíz propia del repositorio
- contenedor propio del compilador
- dependencia operativa cerrada dentro de ese microservicio
- backend principal limitado a orquestación por HTTP
- tratamiento análogo a `backend` y `signer` en Docker Compose y CI/CD

Estado actualizado del servicio separado:

- carpeta raíz creada en `compiler/`
- imagen Docker propia creada en `docker/compiler/Dockerfile`
- publicación de imagen incorporada al workflow de CD multiambiente
- servicio incorporado a `compose.dev`, `compose.qa` y `compose.prod`
- lectura inicial de artifact desde MinIO ya disponible dentro del servicio separado
- backend ya puede orquestar validación y solicitud de compilación por HTTP hacia `compiler`
- runtime Jinja empaquetado dentro de `compiler/python/render_seed.py`
- dependencias Python del render fijadas en `compiler/requirements.txt`
- pipeline `jinja2 -> latex -> pdf` ya ejecutable dentro del microservicio separado en workspace local
- persistencia del PDF compilado ya integrada en `working/pdf/` dentro de MinIO
- generación y persistencia de `compile_report.json` ya integrada en `working/pdf/`
- polling backend -> compiler ya integrado con `GET /compile/:jobId`
- transición documental post-compilación ya conectada en backend
- observabilidad básica ya integrada en `compiler`

## Orquestación backend -> compiler

La dependencia entre capas ya no debe cerrarse por import directo del backend hacia el runtime del
compilador.

Modelo adoptado:

1. `backend` resuelve `document_version` y construye el payload normalizado
2. `backend` envía ese payload por HTTP al `compiler`
3. `compiler` valida el contrato de entrada y acepta el job
4. la ejecución completa del pipeline se migra progresivamente dentro del microservicio separado

Piezas implementadas para esta frontera:

- `backend/services/documents/DocumentCompilerOrchestratorService.js`
- `backend/services/infrastructure/compiler_http.js`
- `backend/controllers/admin/document_compiler_controller.js`
- `compiler/src/services/payload-contract.js`
- `compiler/src/services/template-validator.js`

Endpoints de orquestación actualmente disponibles en backend:

- `POST /easym/v1/admin/compiler/document-versions/:documentVersionId/validate`
- `POST /easym/v1/admin/compiler/document-versions/:documentVersionId/compile`

## Validación técnica ya migrada al compiler

El microservicio separado ya ejecuta validación propia sobre el payload normalizado recibido por
HTTP.

Cobertura actual:

- contrato mínimo del payload
- compatibilidad `renderEngine` / `outputFormat`
- presencia del árbol fuente Jinja
- consistencia `field_refs` del workflow de llenado
- consistencia de anchors y pasos de firma

Pendiente explícito:

- validación profunda de `pattern_ref` usando patterns empaquetados localmente en `compiler/`

## Decisión técnica validada con Context7

- Librería evaluada: `express`
- Library ID: `/expressjs/express`
- Versión objetivo: `v5.1.0`
- Decisión adoptada: usar un microservicio HTTP basado en Express 5 con rutas explícitas,
  `express.json()` para payloads JSON y middleware central de errores.

Justificación breve:

- Express 5 mantiene compatibilidad con el stack backend actual del repositorio.
- Los handlers async permiten propagar errores al middleware central sin wrappers adicionales.
- El contrato puede exponerse de forma simple para polling desde el backend principal y extenderse a
  callback sin rediseñar la API base.

Decisión de contenedor validada con Context7 (`/docker/docs`):

- El Dockerfile del compilador debe declarar explícitamente `FROM texlive/texlive:<tag>`.
- Se permite `texlive/texlive:latest` mientras el contenedor no esté fijado operativamente, pero se
  prefiere una etiqueta estable fijada para builds reproducibles.

Decisión de render validada con Context7:

- Librería evaluada: `Jinja`
- Library ID: `/pallets/jinja`
- Versión objetivo: `3.1.6`
- Decisión adoptada: empaquetar el runtime de render dentro de `compiler/` usando `Environment` +
  `StrictUndefined` y dependencias Python propias del microservicio.

Decisión de carga YAML validada con Context7:

- Librería evaluada: `PyYAML`
- Library ID: `/yaml/pyyaml`
- Versión objetivo: `6.0.3`
- Decisión adoptada: usar `yaml.safe_load` para defaults YAML del render dentro del runtime local
  del compilador.

## Alcance del contrato

El microservicio:

- recibe solicitudes de compilación
- resuelve la entrada técnica asociada a una `document_version`
- ejecuta la compilación documental
- devuelve estado, artefactos y errores estructurados

El microservicio no:

- decide política de negocio
- resuelve actores funcionales fuera del runtime documental ya preparado
- aplica firma electrónica
- redefine estados del backend principal

## Modelo operativo

La compilación se expone como job asíncrono. La creación del job devuelve `pending` o `running`, y
el backend principal consulta su estado por `jobId`.

Estados del job:

- `pending`
- `running`
- `succeeded`
- `failed`

## Seguridad de integración

Todas las rutas operativas del microservicio, excepto `GET /health` y `GET /ready`, deben exigir
autenticación entre servicios.

Headers esperados:

- `Authorization: Bearer <service-token>`
- `X-Correlation-Id: <uuid>` opcional pero recomendado
- `Content-Type: application/json`

## Endpoints obligatorios

### `POST /compile`

Crea un job de compilación a partir de una `document_version` o de un payload técnico equivalente.

Nota de implementación actual:

- el contrato objetivo final de este endpoint sigue siendo asíncrono
- mientras el punto `2.11` no esté cerrado, la implementación real en `compiler/` ejecuta el
  pipeline de forma inline
- por eso hoy la respuesta efectiva devuelve resultado técnico local del workspace y no un job
  persistido con polling completo

Request body mínimo recomendado:

```json
{
  "document_version_id": 123,
  "template_artifact_id": 45,
  "render_engine": "jinja2",
  "output_format": "pdf",
  "requested_by_service": "backend",
  "context": {
    "process_run_id": 987,
    "task_item_id": 654
  },
  "callback": {
    "url": "http://backend:3030/api/documents/compile-callback",
    "token": "service-callback-token"
  }
}
```

Reglas:

- `document_version_id` es la entrada prioritaria del alcance inicial.
- `template_artifact_id` puede omitirse si la `document_version` ya referencia un artifact técnico
  válido.
- `render_engine` y `output_format` deben validarse contra la compatibilidad declarada por el
  artifact.
- `callback` es opcional; si no se envía, el contrato queda operable por polling.

Respuesta `202 Accepted`:

```json
{
  "job_id": "cmp_20260403_000001",
  "status": "pending",
  "document_version_id": 123,
  "poll_url": "/compile/cmp_20260403_000001",
  "accepted_at": "2026-04-03T12:00:00.000Z"
}
```

Errores esperados:

- `400` si falta payload mínimo o el contrato es inválido
- `401` si falta autenticación entre servicios
- `403` si el servicio llamador no está autorizado
- `404` si la `document_version` o el artifact no existen
- `409` si ya existe una compilación incompatible en curso para la misma versión documental
- `422` si el artifact no puede producir el output solicitado

### `GET /compile/:jobId`

Devuelve el estado actual del job y, cuando exista, el resultado documental.

Respuesta `200 OK` para job finalizado:

```json
{
  "job_id": "cmp_20260403_000001",
  "status": "succeeded",
  "document_version_id": 123,
  "template_artifact_id": 45,
  "render_engine": "jinja2",
  "output_format": "pdf",
  "started_at": "2026-04-03T12:00:02.000Z",
  "finished_at": "2026-04-03T12:00:08.000Z",
  "duration_ms": 6000,
  "artifacts": {
    "working_file_path": "deasy-documents/Unidades/Foo/working/pdf/documento.pdf",
    "payload_object_path": "deasy-documents/Unidades/Foo/payload/runtime.data.json",
    "compile_report_path": "deasy-documents/Unidades/Foo/working/pdf/compile_report.json"
  },
  "warnings": [],
  "errors": [],
  "fingerprint": {
    "algorithm": "sha256",
    "value": "abc123"
  }
}
```

Respuesta `200 OK` para job fallido:

```json
{
  "job_id": "cmp_20260403_000001",
  "status": "failed",
  "document_version_id": 123,
  "errors": [
    {
      "code": "template_contract_invalid",
      "message": "El artifact no declara meta.yaml compatible con el render solicitado.",
      "stage": "validate-template",
      "retryable": false
    }
  ],
  "warnings": []
}
```

### `GET /health`

Verifica que el proceso HTTP responde.

Respuesta `200 OK`:

```json
{
  "status": "ok",
  "service": "document-compiler"
}
```

### `GET /ready`

Verifica que el microservicio puede atender compilaciones reales.

Debe validar como mínimo:

- configuración cargada
- acceso al storage requerido
- disponibilidad de dependencias mínimas de compilación

Respuesta `200 OK`:

```json
{
  "status": "ready",
  "service": "document-compiler"
}
```

Respuesta `503 Service Unavailable`:

```json
{
  "status": "not_ready",
  "service": "document-compiler",
  "checks": {
    "storage": "ok",
    "latex": "failed"
  }
}
```

## Endpoints opcionales

### `POST /compile/document-version/:id`

Atajo semántico para disparar la compilación usando solo la `document_version` en la URL. No es
necesario para la primera iteración si `POST /compile` ya cubre el caso.

### `POST /validate-template`

Valida contrato técnico del artifact sin ejecutar compilación completa. Queda alineado con el punto
5 del backlog, pero no es requisito para habilitar el flujo base de compilación.

## Contrato de entrada basado en `document_version`

La entrada canónica del compilador debe construirse a partir de `document_versions` y no desde un
payload ad hoc armado por el frontend u otro consumidor externo.

Motivo:

- el repositorio ya persiste `template_artifact_id`, `payload_object_path`, `working_file_path`,
  `final_file_path`, `format` y `render_engine` en `document_versions`
- `DocumentRuntimeService` ya resuelve `meta`, `schema`, `baseData`, `runtimePayload` y
  `mergedPayload`
- el compilador debe extender el flujo documental existente, no introducir otra fuente de verdad

### Entrada normalizada esperada dentro del microservicio

Una vez recibida una solicitud `POST /compile`, el backend o el propio microservicio debe
normalizarla a una estructura interna como esta:

```json
{
  "documentVersion": {
    "id": 123,
    "documentId": 77,
    "version": 1.0,
    "status": "Borrador",
    "format": "pdf",
    "renderEngine": "jinja2"
  },
  "artifact": {
    "id": 45,
    "templateCode": "investigacion/formativa/informe-docente",
    "displayName": "Informe de Investigación Formativa por Docente",
    "bucket": "deasy-documents",
    "baseObjectPrefix": "Templates/investigacion/formativa/informe-docente/1.0.0/",
    "metaObjectKey": "Templates/investigacion/formativa/informe-docente/1.0.0/meta.yaml",
    "schemaObjectKey": "Templates/investigacion/formativa/informe-docente/1.0.0/schema.json",
    "dataObjectKey": "Templates/investigacion/formativa/informe-docente/1.0.0/data.yaml"
  },
  "sources": {
    "patternRef": "signatures/three-stage-era",
    "patternPath": "tools/templates/patterns/signatures/three-stage-era.yaml"
  },
  "payload": {
    "baseData": {},
    "runtimePayload": {},
    "mergedPayload": {}
  },
  "storage": {
    "payloadObjectPath": "deasy-documents/Unidades/Foo/payload/runtime.data.json",
    "workingPrefix": "deasy-documents/Unidades/Foo/working/pdf/",
    "finalPrefix": "deasy-documents/Unidades/Foo/final/"
  },
  "target": {
    "outputFormat": "pdf",
    "renderEngine": "jinja2"
  },
  "context": {
    "processRunId": 987,
    "taskItemId": 654
  }
}
```

### Campos mínimos obligatorios

El compilador no debe arrancar si faltan:

- `documentVersion.id`
- `artifact.id`
- `artifact.bucket`
- `artifact.metaObjectKey`
- `artifact.schemaObjectKey`
- `payload.mergedPayload`
- `target.outputFormat`
- `target.renderEngine`

### Fuente de cada bloque

- `documentVersion`:
  sale de `document_versions` y `documents`
- `artifact`:
  sale de `template_artifacts`
- `sources`:
  se deriva de `meta.yaml` y del patrón resuelto
- `payload`:
  sale de `DocumentRuntimeService`
- `storage`:
  sale de la semántica documental canónica de la versión
- `context`:
  se correlaciona con `process_run_id` y `task_item_id` cuando existan

### Relación con `DocumentRuntimeService`

La salida actual de `buildDocumentCompilationInput(documentVersionId)` ya cubre la mayor parte del
contrato interno necesario para este punto:

- `artifact`
- `sources`
- `schema`
- `meta`
- `baseData`
- `runtimePayload`
- `mergedPayload`

La integración del punto 4 queda formalizada con `DocumentCompilerPayloadService`, que toma esa
salida y la transforma en el payload operativo del compilador:

- `documentVersion`
- `artifact`
- `sources`
- `renderSource`
- `payload.schema`
- `payload.meta`
- `payload.baseData`
- `payload.runtimePayload`
- `payload.mergedPayload`
- `storage.canonicalBasePath`
- `storage.payloadObjectPath`
- `storage.workingPrefix`
- `storage.finalPrefix`
- `context.processRunId`
- `context.taskItemId`

La siguiente etapa de implementación debe completar sobre esa base:

- validación del target final de compilación
- persistencia de `compile_report.json`

### Validador técnico del template

El punto 5 queda cubierto con `DocumentTemplateTechnicalValidatorService`, que valida el payload
normalizado antes de entrar al pipeline de compilación.

Reglas aplicadas en esta etapa:

- existencia de `render_engine` y `output_format`
- compatibilidad entre `target` y `meta.modes`
- presencia de archivos fuente Jinja en `renderSource.files`
- consistencia entre `workflows.fill.steps[].field_refs` y `schema.json`
- consistencia entre anchors de firma por token y `schema.json`
- consistencia entre `steps[].anchor_refs` y `anchors[]`
- existencia y carga de `pattern_ref`
- consistencia entre `compiler_contract.runtime_fields` del patrón y `schema.json`

Salida del validador:

- `ok`
- `errors[]`
- `warnings[]`
- `payload`

### Render Jinja empaquetado en el compiler

El punto `2.7` del checklist final queda cubierto al cerrar la dependencia operativa del render
dentro del microservicio separado.

Estado adoptado:

1. el runtime Python de render vive en `compiler/python/render_seed.py`
2. sus dependencias quedan fijadas en `compiler/requirements.txt`
3. la imagen `docker/compiler/Dockerfile` instala `Jinja2` y `PyYAML` dentro del contenedor del
   compilador
4. el backend deja de ser la ubicación objetivo del runtime de render

Esto corrige el desvío arquitectónico detectado durante la revisión del backlog:

- `tools/templates/python/render_seed.py` puede seguir existiendo como utilidad del repositorio
- pero ya no debe interpretarse como dependencia operativa final del microservicio compilador
- el pipeline definitivo debe invocar el runtime empaquetado en `compiler/`

### Pipeline inicial `jinja2 -> latex -> pdf` dentro del compiler

El punto `2.8` queda cubierto al migrar la ejecución efectiva del pipeline al microservicio
separado.

Secuencia actual dentro de `compiler`:

1. valida contrato mínimo y validación técnica del payload normalizado
2. crea un workspace temporal local por `document_version`
3. descarga desde MinIO el árbol fuente declarado en `renderSource.files`
4. escribe `runtime.data.json` con `payload.mergedPayload`
5. ejecuta `compiler/python/render_seed.py`
6. exige `main.tex` como salida del render
7. ejecuta pasadas fijas de `pdflatex` controladas por el microservicio
8. resuelve el PDF compilado en `output/pdf/main.pdf`

Alcance explícito de este punto:

- el pipeline ya corre dentro de `compiler`
- la respuesta de `POST /compile` devuelve artefactos técnicos locales del workspace

### Persistencia en `working/pdf/`

El punto `2.9` queda cubierto al subir el PDF compilado desde el microservicio separado hacia el
bucket documental.

Secuencia actual:

1. el pipeline local resuelve el PDF compilado
2. `compiler` toma `storage.canonicalBasePath` del payload normalizado enviado por backend
3. construye `workingFilePath` como:

```text
<canonicalBasePath>/working/pdf/document-version-<documentVersionId>.pdf
```

4. compone el objeto remoto final como:

```text
<MINIO_DOCUMENTS_PREFIX>/<workingFilePath>
```

5. sube el archivo al bucket `MINIO_DOCUMENTS_BUCKET`
6. devuelve en la respuesta de `POST /compile`:
   - `artifacts.workingFilePath`
   - `artifacts.bucket`
   - `artifacts.objectName`

Límite explícito de este punto:

- el compilador ya persiste el PDF en MinIO
- todavía no actualiza MariaDB directamente
- la actualización de estado/DB y la transición documental quedan para los puntos siguientes de
  orquestación con backend

## Flujo de entrada desde MinIO

En este punto ya queda tocada la entrada real del compilador desde storage. El comportamiento
actual es este:

### 1. Qué se lee desde MinIO

Por cada `document_version`, el compilador resuelve:

- `meta.yaml`
- `schema.json`
- `data.yaml` o `data.json`
- el árbol fuente del render, normalmente `modes/system/jinja2/src`

Eso sale del bucket y prefijos declarados por el artifact técnico:

- `template_artifacts.bucket`
- `template_artifacts.base_object_prefix`
- `template_artifacts.meta_object_key`
- `template_artifacts.schema_object_key`
- `meta.modes.system.<render_engine>.path`

### 2. Cómo se baja el source tree

`DocumentRuntimeService` lista los objetos remotos bajo:

- `renderSource.objectPrefix`

Ejemplo conceptual:

```text
<bucket>: deasy-documents
<objectPrefix>: Templates/.../modes/system/jinja2/src/
```

Luego `DocumentCompilationPipelineService` descarga cada objeto del inventario `renderSource.files`
al workspace temporal local preservando su ruta relativa.

### 3. Qué entra realmente al render

El render Jinja no usa `data.yaml` crudo cuando existe runtime documental. Lo que entra al render es:

- `payload.baseData`
- `payload.runtimePayload`
- `payload.mergedPayload`

Y el archivo que se escribe para el render es:

- `workspace/runtime.data.json`

Ese JSON se entrega al runtime local del compilador, `compiler/python/render_seed.py`, que
materializa el árbol `rendered/` a partir del source Jinja descargado.

### 4. Qué todavía no hace MinIO en este punto

En el punto 6, MinIO solo participa como entrada técnica del compilador.

Todavía no se hace desde este servicio:

- subida del PDF a `working/pdf/`
- actualización de `working_file_path`
- escritura de `compile_report.json` en storage
- publicación del payload runtime actualizado

Eso se cierra en los puntos 7 y 8.

## Flujo de salida hacia MinIO

El punto `2.9` ya deja implementada la persistencia del PDF compilado en la ruta documental
canónica desde el microservicio `compiler`.

### 1. Qué sale del pipeline local

Después de compilar, el servicio busca primero:

- `rendered/output/pdf/report.pdf`

Y, si no existe, cae a:

- `rendered/output/pdf/main.pdf`

Ese archivo sigue siendo local y temporal hasta la persistencia.

### 2. Cómo se construye la ruta canónica remota

La base documental se arma así:

```text
<scope_unit_id>/PROCESOS/<process_id>/ANIOS/<year>/TIPOS_PERIODO/<term_type_id>/PERIODOS/<term_id>/TAREAS/<task_id>/Documentos/<document_id>/v000N
```

Sobre esa base, el PDF compilado queda en:

```text
<basePath>/working/pdf/document-version-<documentVersionId>.pdf
```

### 3. Qué se sube exactamente a MinIO

Bucket de salida:

- `MINIO_DOCUMENTS_BUCKET`
  valor por defecto: `deasy-documents`

Object name final:

```text
<MINIO_DOCUMENTS_PREFIX>/<workingFilePath>
```

Con el prefijo actual por defecto, el objeto queda conceptualmente así:

```text
Unidades/<scope_unit_id>/PROCESOS/.../Documentos/<document_id>/v000N/working/pdf/document-version-<id>.pdf
```

### 4. Qué se devuelve hoy al backend

`POST /compile` devuelve al backend:

- `artifacts.workingFilePath`
  sin el prefijo `Unidades/`, consistente con el resto del backend documental actual
- `artifacts.bucket`
- `artifacts.objectName`

Con eso el backend ya puede usar la misma semántica documental para registrar o transicionar el
resultado en etapas posteriores.

### 5. Qué falta todavía en storage

Aunque el PDF y `compile_report.json` ya se persisten en `working/pdf/`, todavía no queda cerrado
en este tramo:

- publicación del payload runtime final en `payload/`
- transición documental post-compilación
- callback o polling hacia backend principal

### Lectura del artifact desde storage

El punto 3 del backlog queda cubierto en backend al extender `DocumentRuntimeService` para que,
además de `meta/schema/data`, también resuelva el árbol fuente del artifact desde MinIO.

La salida interna ahora debe incluir:

- `renderSource.bucket`
- `renderSource.renderEngine`
- `renderSource.objectPrefix`
- `renderSource.entryObjectKey`
- `renderSource.fileCount`
- `renderSource.files`

Con esto el compilador ya tiene identificados:

- el prefijo remoto del template fuente
- el archivo de entrada preferente del render
- el inventario de archivos necesarios para materializar el workspace local de compilación

## Contrato de errores

Todas las respuestas de error deben usar estructura JSON homogénea:

```json
{
  "error": {
    "code": "template_not_found",
    "message": "No se encontró el artifact técnico asociado.",
    "stage": "load-artifact",
    "retryable": false,
    "details": {}
  }
}
```

Campos obligatorios:

- `code`
- `message`
- `stage`
- `retryable`

## Relación con el backend actual

Este contrato se apoya directamente en piezas ya existentes del repositorio:

- `backend/services/documents/DocumentRuntimeService.js` como base para construir el payload técnico
- la semántica persistida de `document_versions`
- el layout documental canónico en storage para `payload/`, `working/` y `final/`

La integración posterior con el backend principal debe seguir este flujo:

1. el backend solicita `POST /compile`
2. el microservicio crea el job
3. el microservicio resuelve artifact, runtime y compilación
4. el microservicio persiste `working_file_path` y `compile_report.json`
5. el backend consulta `GET /compile/:jobId` o recibe callback
6. el backend decide la transición documental siguiente

## Decisiones explícitas del punto 1

- se adopta polling como mecanismo base obligatorio
- callback queda soportado como extensión opcional del mismo contrato
- la entrada prioritaria es `document_version_id`
- la API devuelve jobs, no compilaciones síncronas bloqueantes
- los errores deben ser estructurados desde el primer release

## Estado actual del punto 2.11

La integración backend <-> compiler ya soporta polling real sobre jobs de compilación:

- `compiler` crea un `job_id` en `POST /compile`
- `compiler` registra el job en memoria con estados `pending`, `running`, `succeeded`, `failed`
- `compiler` expone `GET /compile/:jobId`
- `backend` expone `GET /easym/v1/admin/compiler/jobs/:jobId` como proxy de consulta

Límite explícito de esta iteración:

- el registro de jobs es volátil y vive en memoria del contenedor `compiler`
- si el contenedor reinicia, los jobs en memoria se pierden
- esto resuelve la integración de polling del contrato sin introducir todavía cola durable ni tabla de jobs

Callback:

- si el payload incluye `callback.url`, el `compiler` intenta entregar el resultado final por HTTP
- callback sigue siendo opcional y complementario; polling sigue siendo el mecanismo base soportado

Garantía de recuperación ante pérdida de jobs:

- si `compiler` responde `compile_job_not_found` durante el polling
- `backend` detecta que el job se perdió en memoria
- `backend` reemite automáticamente `POST /compile` para la misma `document_version`
- el consumidor recibe una respuesta de recuperación con el nuevo `job_id`
- así se evita que la pérdida del job volátil se traduzca en un error terminal del backend

## Estado actual del punto 2.12

La transición documental post-compilación ya se ejecuta en `backend`, no en `compiler`.

Flujo adoptado:

1. `compiler` compila, persiste artefactos y devuelve o envía callback con `working_file_path`
2. `backend` recibe el resultado por callback o por polling
3. `backend` actualiza `document_versions.working_file_path`
4. `backend` ejecuta `ensureFillFlowForDocumentVersion(documentVersionId)`
5. el flujo documental existente decide el siguiente estado operativo:
   - si hay fill flow, asegura o repara el flujo de llenado
   - si no hay fill flow, puede dejar la versión en `Listo para firma`
   - si aplica, también asegura el flujo de firma derivado

Piezas implementadas:

- `backend/services/documents/DocumentCompilationResultService.js`
- `backend/services/documents/DocumentCompilationTrackingService.js`
- `POST /easym/v1/admin/compiler/callback`
- `GET /easym/v1/admin/compiler/jobs/:jobId`

Límite explícito de esta iteración:

- la transición ya está conectada y es idempotente para `working_file_path`
- el tracking de recovery sigue siendo en memoria del backend
- todavía no existe una tabla durable de jobs de compilación

## Estado actual del punto 2.13

La observabilidad base ya queda integrada sin incorporar una plataforma externa:

- logs estructurados JSON en `compiler`
- correlación por `job_id` y `document_version_id` en eventos de compilación
- métricas básicas expuestas por `GET /metrics`
- últimos eventos recientes mantenidos en memoria para diagnóstico rápido

Cobertura actual:

- `compile.accepted`
- `compile.running`
- `compile.succeeded`
- `compile.failed`
- `compile.callback`
- `compile.status_polled`
- `compile.status_not_found`
- `http.request`
- `http.error`

Métricas actuales:

- compilaciones aceptadas
- compilaciones en ejecución
- compilaciones exitosas
- compilaciones fallidas
- callbacks intentados, entregados y fallidos
- duración promedio, mínima y máxima de compilación

Límite explícito:

- las métricas viven en memoria del contenedor `compiler`
- no hay exportador Prometheus ni almacenamiento histórico persistente todavía

## Estado actual del punto 2.14

La cobertura de tests agregada en `compiler/` queda dividida en dos niveles:

- tests unitarios de contrato y utilidades con `node:test`
- smoke test condicionado para compilación real contra un servicio levantado

Cobertura implementada:

- validación del payload normalizado
- construcción de rutas canónicas `working/pdf/`
- observabilidad básica y acumulación de métricas
- smoke test de compilación real habilitable por entorno

Límite explícito:

- en este turno se ejecutaron localmente los tests unitarios
- el smoke de compilación real queda preparado pero depende de contar con `compiler`, MinIO, TeX Live
  y un `document_version_id` válido disponibles en entorno de ejecución

## Estado actual del punto 2.15

Revisión final del contrato técnico de template compilable para semillas Jinja genéricas publicadas
en MinIO.

Conclusión adoptada:

- el renderizador debe permanecer fijo dentro del microservicio `compiler`
- las semillas no deben enviar su propio ejecutor ni scripts arbitrarios
- el compilador debe aceptar cualquier template que respete un contrato técnico único y estable

Contrato mínimo de template compilable:

1. el artifact declara `render_engine = jinja2`
2. el árbol fuente se publica bajo `modes/system/jinja2/src/`
3. existe al menos un archivo fuente `.j2`
4. el render produce `main.tex`
5. el template puede incluir archivos auxiliares de desarrollo como `make.sh`, pero el microservicio
   no los ejecuta
6. el microservicio sanea el árbol fuente y materializa solo tipos de archivo permitidos
7. el microservicio compila `main.tex` con un comando LaTeX fijo controlado internamente
8. el PDF resultante se produce en `output/pdf/main.pdf`
9. el template consume únicamente datos provenientes del payload JSON normalizado y sus recursos
   locales
10. la semilla no puede exigir un renderizador externo descargado desde storage

Implicación práctica:

- cualquier template que cumpla este contrato puede ser publicado en MinIO y compilado por el
  microservicio sin extensiones específicas por plantilla
- cualquier template que no lo cumpla debe considerarse incompatible con el release actual del
  compilador
