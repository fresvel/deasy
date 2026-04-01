# Hoja de Ruta - Modelo Documental, Llenado y Firmas

## Objetivo

Definir y ejecutar la migración del núcleo documental de Deasy para que el sistema pase de un modelo centrado en:

- `processes`
- `process_definition_versions`
- `tasks`
- `task_items`

a un modelo operativo completo centrado en:

- documentos como entidad de negocio real
- versiones documentales
- flujo de llenado
- flujo de firmas
- separación entre metadata técnica del artifact y política de negocio del proceso

Este documento fija:

- decisiones de diseño
- alcance de la migración
- checklist técnico
- fases recomendadas
- criterios de aceptación por etapa

## Estado Actual Verificado

Fuente de verdad del esquema:

- [backend/database/mariadb_schema.sql](/home/fresvel/Sharepoint/DIR/Deploy/deasy/backend/database/mariadb_schema.sql)

Código relevante revisado:

- [backend/services/admin/TaskGenerationService.js](/home/fresvel/Sharepoint/DIR/Deploy/deasy/backend/services/admin/TaskGenerationService.js)
- [backend/controllers/users/user_controler.js](/home/fresvel/Sharepoint/DIR/Deploy/deasy/backend/controllers/users/user_controler.js)
- [backend/controllers/tareas/tareas_controler.js](/home/fresvel/Sharepoint/DIR/Deploy/deasy/backend/controllers/tareas/tareas_controler.js)
- [frontend/src/services/admin/AdminTableManagerConfig.js](/home/fresvel/Sharepoint/DIR/Deploy/deasy/frontend/src/services/admin/AdminTableManagerConfig.js)
- [tools/templates/README.md](/home/fresvel/Sharepoint/DIR/Deploy/deasy/tools/templates/README.md)

Estado real de la base viva al momento de la revisión:

- Hay datos en `processes`, `process_definition_versions`, `process_target_rules`, `process_definition_triggers`, `process_definition_templates`, `template_artifacts`, `tasks`, `task_items`.
- No hay datos en `documents`, `document_versions`, `signature_flow_templates`, `signature_flow_steps`, `signature_flow_instances`, `signature_requests`, `document_signatures`.

Conclusión:

- el núcleo de definición e instanciación de procesos existe
- el ciclo documental y de firmas está modelado pero no operativo
- el flujo de llenado no está modelado explícitamente

## Decisiones de Arquitectura

### 1. Separación entre capa técnica y capa de negocio

Se adopta esta división:

- Capa técnica del artifact/template:
  - schema de llenado
  - anchors/tokens de firma
  - metadata de render
  - formatos soportados
  - estructura de archivos y work directories

- Capa de negocio del proceso:
  - quién llena
  - quién revisa
  - quién firma
  - en qué orden
  - qué pasos son obligatorios
  - políticas de aprobación, rebote y quorum

### 2. El documento pasa a ser la entidad operativa central

Se establece que:

- un `task_item` representa el entregable esperado
- un `document` representa la instancia documental real de ese entregable

En este dominio, el documento es el entregable operativo.

### 3. Dos flujos separados y encadenados

Todo documento con ciclo completo debe pasar por:

1. flujo de llenado
2. flujo de firma

El flujo de firma no debe iniciar antes de que el documento llegue al estado `ready_for_signature` o equivalente.

### 4. El artifact define la técnica, el proceso define la política

El artifact/template debe contener o sincronizar:

- schema de datos
- campos llenables
- tokens de firma
- anchors
- formato de render
- metadatos técnicos del flujo

El proceso debe decidir:

- si usa ese artifact
- si es obligatorio
- quién lo llena
- quién lo revisa
- quién lo firma
- cómo se resuelven usuarios reales

### 5. Los documentos huérfanos no deben usar tareas falsas

No se recomienda crear tareas “genéricas” o eternas para documentos sin padre.

Se recomienda que `documents` soporte:

- origen por `task_item`
- origen standalone
- origen importado
- origen generado manualmente

### 6. La estructura de archivos de templates debe preservarse conceptualmente

La organización actual de `tools/templates/` debe inspirar la estructura operativa de trabajo de documentos:

- fuente
- metadata
- work directory
- build/render
- resultado final

Esto aplica tanto a Jinja/LaTeX como a Word/Excel y otros formatos.

## Modelo Objetivo

### Entidades actuales que se conservan

- `processes`
- `process_definition_series`
- `process_definition_versions`
- `process_target_rules`
- `process_definition_triggers`
- `template_seeds`
- `template_artifacts`
- `process_definition_templates`
- `tasks`
- `task_items`

### Entidades actuales que deben refactorizarse

- `documents`
- `document_versions`
- `signature_flow_templates`
- `signature_flow_steps`
- `signature_flow_instances`
- `signature_requests`
- `document_signatures`

### Entidades nuevas recomendadas

- `process_runs`
- `fill_flow_templates`
- `fill_flow_steps`
- `document_fill_flows`
- `fill_requests`
- `artifact_fill_schema_versions`
- `artifact_signature_anchor_versions`

Opcionales según nivel de detalle:

- `artifact_render_profiles`
- `document_reviews`
- `document_events`

## Relaciones Objetivo

### Núcleo de procesos

- `processes` 1:N `process_definition_versions`
- `process_definition_versions` 1:N `process_definition_templates`
- `process_definition_versions` 1:N `process_target_rules`
- `process_definition_versions` 1:N `process_definition_triggers`

### Instanciación

- `process_definition_versions` 1:N `process_runs`
- `process_runs` 1:N `tasks`
- `tasks` 1:N `task_items`

### Documentos

- `task_items` 1:0..1 `documents`
- `documents` 1:N `document_versions`

Para documentos standalone:

- `documents.task_item_id` puede ser `NULL`
- `documents.owner_person_id` debe existir
- `documents.origin_type` debe indicar el origen

### Flujos de llenado

- `process_definition_templates` 1:N `fill_flow_templates`
- `fill_flow_templates` 1:N `fill_flow_steps`
- `document_versions` 1:0..1 `document_fill_flows`
- `document_fill_flows` 1:N `fill_requests`

### Flujos de firma

- `process_definition_templates` 1:N `signature_flow_templates`
- `signature_flow_templates` 1:N `signature_flow_steps`
- `document_versions` 1:0..1 `document_signature_flows`
- `document_signature_flows` 1:N `signature_requests`
- `document_versions` 1:N `document_signatures`

### Metadata técnica del artifact

- `template_artifacts` 1:N `artifact_fill_schema_versions`
- `template_artifacts` 1:N `artifact_signature_anchor_versions`

## Refactor Propuesto de `document_versions`

La tabla actual:

- mezcla una noción histórica de LaTeX con el ciclo documental moderno
- todavía conserva `payload_mongo_id`
- usa `latex_path`, `pdf_path`, `signed_pdf_path` con semántica ambigua

### Dirección de cambio

Se propone evolucionar a un modelo neutral por formato:

- `document_id`
- `version_no`
- `artifact_id`
- `payload_object_path`
- `payload_hash`
- `working_file_path`
- `final_file_path`
- `format`
- `render_engine`
- `status`
- `created_at`

### Criterios

- `latex_path` debe desaparecer o migrarse a `working_file_path`
- `payload_mongo_id` debe migrarse a MinIO o a una referencia neutral de storage
- `pdf_path` y `signed_pdf_path` deben revisarse; idealmente:
  - `working_file_path`
  - `final_file_path`

Si por transición conviene mantener ambos, deben reinterpretarse así:

- `pdf_path`: salida intermedia o de trabajo
- `signed_pdf_path`: salida final firmada

## Semántica de Payload, Working y Final

Para evitar ambigüedad, se adopta esta definición:

- `payload_object_path`
  - representa la fuente editable o estructurada del documento
  - es la verdad funcional del llenado
  - ejemplos:
    - JSON de datos para Jinja/LaTeX
    - archivo DOCX editable
    - archivo XLSX editable

- `working_file_path`
  - representa el artefacto operativo intermedio
  - puede derivarse del payload o coincidir con él si el formato lo permite
  - ejemplos:
    - PDF preliminar para revisión
    - DOCX enriquecido temporal
    - salida renderizada no final

- `final_file_path`
  - representa el resultado aprobado o firmado
  - es el archivo final de consumo o archivo oficial

Regla práctica:

- `payload` y `working` pueden coincidir en algunos formatos
- no deben colapsarse conceptualmente en el modelo
- `final` siempre debe conservarse como capa separada

### Convención de storage por versión documental

La estructura canónica de MinIO para documentos debe vivir en `deasy-documents/Unidades/...`
y cada versión documental debe separar explícitamente las capas de `payload`, `working` y `final`.

La convención recomendada por versión es:

```text
deasy-documents/Unidades/{unidad_id}/PROCESOS/{proceso_id}/ANIOS/{anio}/TIPOS_PERIODO/{tipo_periodo_id}/PERIODOS/{periodo_id}/TAREAS/{task_id}/Documentos/{document_id}/v0001/
  payload/
    json/
      payload.json
    runtime/
      runtime.json
  working/
    pdf/
      archivo.pdf
    docx/
      archivo.docx
    xlsx/
      archivo.xlsx
  final/
    pdf/
      documento-final.pdf
  firmas/
    evidencia.json
```

Esto fija tres reglas de negocio importantes:

- los JSON de trabajo de Jinja/LaTeX deben vivir en `payload/`
- el archivo aportado o editable del documento debe vivir en `working/{extension}/`
- el resultado aprobado o firmado debe vivir en `final/`

Y además una regla de infraestructura:

- `deasy-spool/Firmas/...` debe reservarse para temporales del microservicio firmador, no para almacenamiento documental estable

## Estado Actual de la Migración

La hoja de ruta nació cuando la migración documental todavía estaba en fase de diseño y primera
materialización. Ese ya no es el estado real de esta rama. A la fecha, el proyecto avanzó en
modelo, sincronización y backfill más de lo que este documento reflejaba originalmente.

### Qué ya está resuelto

En la línea principal de migración ya están implementadas y aplicadas estas piezas:

- `process_runs` ya existe y se backfilleó desde `tasks`
- `documents` y `document_versions` ya se materializan desde `task_items`
- `documents` soporta `owner_person_id` y `origin_type`
- `document_versions` ya evolucionó a:
  - `template_artifact_id`
  - `payload_object_path`
  - `working_file_path`
  - `final_file_path`
  - `format`
  - `render_engine`
- la estructura de llenado ya existe y está sincronizada:
  - `fill_flow_templates`
  - `fill_flow_steps`
  - `document_fill_flows`
  - `fill_requests`
- la estructura de firma también existe y está sincronizada:
  - `signature_flow_templates`
  - `signature_flow_steps`
  - `signature_flow_instances`
  - `signature_requests`
- la sincronización desde artifacts ya está conectada para:
  - `workflows.fill`
  - `workflows.signatures`
- la resolución de actores ya no depende solo de `task_assignments`
- existe una primera capa runtime de compilación documental en backend

### Qué sigue incompleto

Aunque la base y los sincronizadores ya existen, la operación de negocio todavía no está cerrada.
Lo pendiente principal es:

- cerrar la resolución organizacional de todos los pasos que hoy quedan sin persona real
- terminar el ciclo de estados de llenado
- activar la transición operativa entre llenado y firma
- conectar el runtime documental con el compilador documental como microservicio
- conectar la evidencia técnica final de firma con `document_signatures`

En otras palabras, la rama de “flujos de llenado y firma” ya no está en blanco, pero tampoco está
cerrada. La estructura y buena parte del sync ya existen; lo que falta es terminar la ejecución
operativa del ciclo documental completo.

## Flujos de Llenado

## Objetivo

Modelar explícitamente el ciclo de captura, revisión, corrección y aprobación de contenido documental.

### Requisitos

- un documento puede iniciar como JSON, DOCX, XLSX, Jinja/LaTeX o similar
- el flujo de llenado debe soportar:
  - asignación
  - revisión
  - rebote
  - retrabajo
  - aprobación

### Estados sugeridos para documentos

- `draft`
- `in_fill`
- `filled`
- `in_review`
- `rejected_fill`
- `ready_for_signature`
- `in_signature`
- `signed_partial`
- `signed_complete`
- `finalized`
- `archived`
- `cancelled`

### Resolución de usuarios

El flujo de llenado debe funcionar como una abstracción similar a las reglas de asignación.

Las plantillas de flujo no deben guardar solo personas fijas, sino reglas de resolución:

- `task_assignee`
- `document_owner`
- `specific_person`
- `position`
- `cargo_in_scope`
- `manual_pick`

La persona real debe resolverse al instanciar el flujo y materializarse en `fill_requests`.

### Estado actual de esta rama

En esta rama ya existe:

- sincronización de `fill_flow_templates` y `fill_flow_steps` desde artifacts
- instanciación de `document_fill_flows`
- creación de `fill_requests`
- resolución parcial de actores por:
  - `document_owner`
  - `task_assignee`
  - `cargo_in_scope`
  - scope organizacional derivado del documento

Lo que todavía falta aquí es importante:

- varios `fill_requests` siguen quedando manuales o sin resolver porque el modelo organizacional no
  alcanza todavía a todos los casos
- el ciclo de estados del documento aún no expresa con suficiente claridad:
  - pendiente de llenado
  - en revisión
  - rechazado
  - corregido
  - listo para firma
- todavía no existe el servicio documental completo que aplique cambios de payload, rebotes y
  avance real por paso
- los `field_refs` ya existen en el contrato del artifact, pero aún no se usan para gobernar un
  editor documental real en frontend

## Modelo Formal de Estados Documentales

La siguiente pieza necesaria no es otra tabla, sino una máquina de estados clara. Hoy `documents` y
`document_versions` usan valores útiles, pero todavía mezclan estados heredados (`Inicial`,
`Borrador`, `Aprobado`, `Rechazado`) con estados nuevos (`Pendiente de llenado`, `Listo para
firma`). Eso sirve para la transición, pero no alcanza para gobernar el ciclo documental completo.

Se propone separar conceptualmente dos niveles:

- `documents.status`
  refleja el estado de negocio visible del entregable
- `document_versions.status`
  refleja el estado operativo de la versión concreta que se está trabajando

Mientras exista una sola versión activa por documento, ambos estados pueden moverse casi en paralelo.
Pero el modelo debe dejar claro que el control fino vive en `document_versions`.

### Estados propuestos para `document_versions`

Estos son los estados recomendados para la máquina de trabajo de una versión documental:

- `Borrador`
  La versión existe, pero todavía no entró al flujo activo de llenado.

- `Pendiente de llenado`
  La versión ya tiene flujo de llenado instanciado y espera acción del actor actual.

- `En llenado`
  Existe una edición o captura activa sobre la versión.

- `En revisión de llenado`
  El paso actual ya fue entregado y espera revisión o decisión.

- `Observado`
  El documento fue devuelto con observaciones y requiere retrabajo.

- `Listo para firma`
  El llenado terminó y la versión quedó aprobada para pasar a firma.

- `Pendiente de firma`
  Ya existe una instancia de firma y se esperan firmas operativas.

- `Firmado parcial`
  Al menos una firma fue aplicada, pero el flujo no terminó.

- `Firmado completo`
  Todas las firmas requeridas de la versión se completaron.

- `Final`
  La versión quedó cerrada como resultado oficial del documento.

- `Archivado`
  La versión ya no participa del flujo activo, pero se conserva.

- `Cancelado`
  La versión se cerró sin continuar el ciclo.

### Estados propuestos para `documents`

El documento, como entidad de negocio, puede usar una capa más resumida:

- `Inicial`
- `Pendiente de llenado`
- `En proceso`
- `Observado`
- `Listo para firma`
- `Pendiente de firma`
- `Firmado parcial`
- `Firmado completo`
- `Final`
- `Archivado`
- `Cancelado`

La regla práctica es:

- `document_versions.status` gobierna la transición operativa
- `documents.status` refleja el estado agregado visible del entregable

### Transiciones válidas del flujo

Las transiciones recomendadas son estas:

1. `Borrador` -> `Pendiente de llenado`
   Cuando se materializa el flujo de llenado o se activa el documento.

2. `Pendiente de llenado` -> `En llenado`
   Cuando el actor actual toma el documento para editar o completar.

3. `En llenado` -> `En revisión de llenado`
   Cuando el actor actual entrega su paso.

4. `En revisión de llenado` -> `Observado`
   Cuando el paso es rechazado o rebotado.

5. `Observado` -> `En llenado`
   Cuando se reabre la edición para corregir observaciones.

6. `En revisión de llenado` -> `Pendiente de llenado`
   Cuando un paso queda aprobado pero todavía existen pasos posteriores de llenado.

7. `En revisión de llenado` -> `Listo para firma`
   Cuando el último paso de llenado queda aprobado.

8. `Listo para firma` -> `Pendiente de firma`
   Cuando se instancia el flujo de firma para la versión.

9. `Pendiente de firma` -> `Firmado parcial`
   Cuando al menos una firma requerida se concreta.

10. `Pendiente de firma` -> `Firmado completo`
    Cuando todas las firmas requeridas se concretan directamente o en un mismo ciclo.

11. `Firmado parcial` -> `Firmado completo`
    Cuando se completa el resto del flujo de firma.

12. `Firmado completo` -> `Final`
    Cuando la versión queda sellada como resultado oficial.

13. Cualquier estado operativo -> `Archivado`
    Solo por una política explícita de archivo.

14. Cualquier estado no final -> `Cancelado`
    Solo por cancelación explícita del ciclo.

### Reglas de negocio importantes

- No se debe instanciar firma si la versión no está al menos en `Listo para firma`.
- No se debe mostrar una solicitud de firma al usuario si la versión todavía no está en fase de
  firma.
- Un rebote de llenado no debe crear una nueva versión automáticamente; primero debe agotar el ciclo
  de observación/retrabajo sobre la versión activa.
- Una nueva versión documental debería generarse cuando:
  - cambia el artifact base
  - cambia el payload estructural de manera mayor
  - o se requiere reemitir el documento tras un ciclo cerrado

### Mapa de compatibilidad con el estado actual

Para no romper el sistema de golpe, se propone este mapeo transitorio:

- `documents.status = Inicial`
  se interpreta como versión en `Borrador`

- `documents.status = Pendiente de llenado`
  se interpreta como versión en `Pendiente de llenado`

- `documents.status = En proceso`
  se interpreta como versión en `En llenado` o `En revisión de llenado`

- `documents.status = Rechazado`
  se interpreta como versión en `Observado`

- `documents.status = Aprobado`
  debe dejar de usarse como estado ambiguo y migrarse según el caso a:
  - `Listo para firma`
  - `Firmado completo`
  - o `Final`

- `document_versions.status = Borrador`
  se conserva

- `document_versions.status = Pendiente de llenado`
  se conserva

- `document_versions.status = Listo para firma`
  se conserva

Los nuevos estados que deben entrar después son:

- `En llenado`
- `En revisión de llenado`
- `Observado`
- `Pendiente de firma`
- `Firmado parcial`
- `Firmado completo`
- `Final`
- `Archivado`
- `Cancelado`

## Flujos de Firma

### Principios

- la firma depende del entregable real
- la ubicación técnica de la firma depende del template/artifact
- la política de quién firma depende del proceso

### Revisión del modelo actual

El modelo actual `signature_flow_templates -> signature_flow_steps -> signature_flow_instances -> signature_requests -> document_signatures` es válido conceptualmente, pero hoy no está operativo.

### Decisión

No colapsar todavía `signature_flow_templates` y `signature_flow_steps`.

Sí revisar:

- si `signature_flow_instances` debe renombrarse a algo como `document_signature_flows`
- si `signature_requests` debe representar solo solicitudes operativas por paso/persona
- si `document_signatures` queda solo como evidencia técnica final

### Estado actual de esta rama

La rama de firma ya avanzó más de lo previsto inicialmente:

- `signature_flow_templates` y `signature_flow_steps` ya se sincronizan desde artifacts
- `signature_flow_instances` y `signature_requests` ya se instancian para documentos del sistema
- existe política de inferencia para documents basados en artifacts `system`
- la visibilidad hacia el usuario ya se filtra para que las solicitudes de firma no aparezcan antes
  de la fase correcta
- los templates ya declaran anchors, tokens y `pattern_ref`

Pero aún queda trabajo importante:

- `signature_flow_steps` todavía no guarda todo el contexto técnico de anchors y slots; esa parte
  sigue viviendo en `meta.yaml`
- la transición de `ready_for_signature` a flujo operativo de firma aún es parcial
- la relación entre `signature_requests` y `document_signatures` no está cerrada como ciclo de
  evidencia final
- el compilador documental aún no materializa el PDF operativo que luego entra al microservicio de
  firma
- la firma está funcional como infraestructura, pero aún no completamente integrada al ciclo
  documental versionado

## Sincronización desde Artifacts

Así como hoy se sincronizan artifacts desde `dist`, debe existir sincronización para metadata documental.

### Metadata a sincronizar

- schema de llenado
- anchors/tokens de firma
- metadata de render
- definición técnica de work directories

### Decisión

La base de datos no debe inventar metadata técnica que el artifact ya conoce.

Se recomienda:

- extraer metadata desde el artifact
- sincronizarla a tablas técnicas versionadas
- usar esa metadata como parte del checklist de activación del proceso

## Checklist de Activación de Procesos

Para definiciones con `has_document = 1`, la activación debe validar además:

- al menos una regla activa
- al menos un trigger activo
- al menos un artifact vinculado
- artifact activo y publicable
- metadata técnica de llenado válida
- metadata técnica de firma válida cuando aplique
- flujo de llenado configurado
- flujo de firma configurado si el documento requiere firma

## Instanciación y Reinstanciación

## Problema actual

Hoy la instanciación está acoplada casi por completo a `terms`.

## Decisión

Introducir `process_runs` para soportar:

- instanciación automática por período
- instanciación manual
- reinstanciación
- regeneración parcial
- reparación de corridas

Campos sugeridos:

- `process_definition_id`
- `term_id NULL`
- `run_mode`
- `source_run_id NULL`
- `created_by_user_id`
- `reason`
- `status`
- `created_at`

`tasks` debe evolucionar para referenciar `process_run_id`.

## Roadmap por Fases

### Fase 0 - Diseño cerrado

Objetivo:

- congelar decisiones de arquitectura
- preparar tablas nuevas y migraciones

Entregables:

- documento de modelo final
- matriz de tablas: conservar / renombrar / crear / deprecar
- checklist de activación actualizado
- diseño de storage documental

### Fase 1 - Base documental

Objetivo:

- convertir `documents` y `document_versions` en piezas operativas reales

Trabajo:

- crear `process_runs`
- permitir documentos standalone
- refactorizar `document_versions`
- introducir rutas neutrales de payload y archivos
- mantener compatibilidad temporal con `task_items`

Resultado esperado:

- todo `task_item` documentable puede materializar un `document`
- un documento ya puede existir y versionarse aunque no tenga firma

Estado actual:

- mayormente completada

### Fase 2 - Flujo de llenado

Objetivo:

- modelar y operar el llenado

Trabajo:

- crear `fill_flow_templates`
- crear `fill_flow_steps`
- crear instancias y requests
- modelar aprobación y rebote
- conectar estados documentales

Resultado esperado:

- un documento puede avanzar por un flujo de llenado completo

Estado actual:

- parcialmente completada
- la estructura y sincronización existen
- la operación completa del llenado todavía no

### Fase 3 - Flujo de firma

Objetivo:

- hacer operativo el flujo de firma sobre documentos ya listos

Trabajo:

- revisar/refactorizar `signature_flow_*`
- instanciar flujos al pasar a `ready_for_signature`
- conectar `document_signatures`
- alinear con tokens/anchors del artifact

Resultado esperado:

- un documento puede solicitar firmas, registrar firmas y cerrar ciclo

Estado actual:

- parcialmente completada
- la sincronización e instanciación existen
- el cierre documental y la evidencia final todavía no

### Fase 4 - Sincronización de metadata técnica

Objetivo:

- sincronizar desde artifacts la metadata técnica documental

Trabajo:

- sincronización de schema de llenado
- sincronización de anchors de firma
- validación técnica en checklist de activación

Resultado esperado:

- la BD refleja lo que el artifact declara técnicamente

Estado actual:

- muy avanzada
- ya sincroniza llenado y firma
- falta cerrar materialización automática de patrones y metadata técnica más rica

### Fase 5 - Operación y UX

Objetivo:

- exponer el flujo completo al usuario final

Trabajo:

- dashboard documental real
- seguimiento de llenado
- seguimiento de firmas
- reinstanciación manual
- documentos standalone

Resultado esperado:

- el usuario opera sobre documentos y no solo sobre tareas abstractas

Estado actual:

- temprana
- existe trabajo puntual en frontend y tooling, pero no el panel documental final

## Checklist de Migración Técnica

### Diseño

- [x] Definir modelo final de `process_runs`
- [x] Definir si `documents.task_item_id` será nullable
- [x] Definir `documents.origin_type`
- [x] Definir nuevo contrato de `document_versions`
- [ ] Definir estados formales del documento
- [x] Definir modelo de flujo de llenado
- [ ] Revisar modelo final de flujo de firma
- [x] Definir sincronización desde artifacts
- [x] Definir estructura de storage y work directories

### Base de datos

- [x] Crear migraciones para tablas nuevas
- [x] Refactorizar tablas existentes sin pérdida de datos
- [x] Agregar índices y restricciones nuevas
- [ ] Preparar migraciones reversibles cuando aplique

### Backend

- [ ] Crear servicios de instanciación manual/reinstanciación
- [x] Crear servicios de materialización de documentos
- [ ] Crear servicios de versionado documental
- [ ] Crear servicios de flujo de llenado
- [ ] Crear servicios de flujo de firma
- [x] Crear sincronizador de metadata técnica desde artifacts

### Frontend

- [ ] Rediseñar panel documental del dashboard
- [ ] Separar visualización de tareas y documentos
- [ ] Exponer llenado, revisión y rebote
- [ ] Exponer firma por pasos
- [ ] Exponer estado y trazabilidad de versiones

### Storage

- [ ] Definir rutas de payload
- [ ] Definir rutas de working files
- [ ] Definir rutas de final files
- [ ] Definir política de limpieza y retención

## Criterios de Aceptación

La migración podrá considerarse bien encaminada cuando se cumpla, como mínimo:

- una definición de proceso puede instanciarse manualmente
- un `task_item` puede materializar un `document`
- un documento puede tener versiones reales
- existe un flujo de llenado explícito
- el documento puede pasar de llenado a firma
- la técnica del artifact y la política del proceso están separadas
- la activación del proceso valida la configuración documental completa

## Tramo Crítico Actual

El proyecto ya no está en el punto de “crear tablas y diseñar el modelo”. El tramo crítico actual
es otro:

1. cerrar la resolución organizacional faltante de `fill_requests` y `signature_requests`
2. formalizar los estados documentales y su transición
3. conectar el runtime documental con el compilador documental como microservicio
4. producir `working_file_path` real por `document_version`
5. pasar de llenado a firma con transición operativa completa
6. registrar el cierre técnico en `document_signatures`

## Riesgos a Vigilar

- mezclar de nuevo metadata técnica con reglas de negocio
- usar tareas falsas para representar documentos standalone
- seguir arrastrando conceptos heredados de LaTeX como si fueran universales
- acoplar demasiado el flujo de firma al frontend en vez del documento
- activar procesos documentales sin checklist completo

## Siguiente Paso Recomendado

El siguiente paso ya no debería ser rediseñar tablas base. Esa parte ya avanzó.

El siguiente entregable crítico sugerido es:

- cerrar el contrato operativo entre `DocumentRuntimeService` y el compilador documental como
  microservicio

Después de eso:

- conectar generación de `working_file_path`
- cerrar transición de llenado a firma
- materializar `document_signatures` como evidencia final
