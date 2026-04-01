# Hoja de Ruta Operativa V2 - Núcleo Documental, Llenado y Firmas

## Propósito

Este documento reemplaza el uso operativo de la hoja de ruta anterior como referencia principal de avance.
La hoja anterior conserva valor histórico y de diseño, pero ya mezcla estados viejos de la migración con
el estado real actual del código. Esta versión se concentra en dos cosas:

- qué ya está realmente construido
- qué falta para cerrar el ciclo documental completo

El alcance sigue siendo el mismo: consolidar un modelo documental centrado en documentos, versiones,
llenado, firma, artifacts como fuente técnica y procesos como fuente de política.

## Estado Base del Proyecto

Hoy el proyecto ya no está en fase de diseño inicial. La base del modelo documental existe y una parte
importante del flujo ya opera en backend y frontend.

Ya existe, en términos reales:

- materialización de `documents` y `document_versions` desde `task_items`
- `process_runs`
- flujos de llenado sincronizados e instanciados
- flujos de firma sincronizados e instanciados
- estados documentales formales en backend
- storage documental canónico en `deasy-documents/...`
- dashboard documental parcial con acciones operativas

Lo pendiente ya no es "crear las tablas" ni "definir el modelo". Lo pendiente es cerrar la ejecución
operativa del ciclo documental completo, especialmente en la transición entre llenado y firma, el
compilador documental y la UX final del panel.

## Objetivo Operativo

Se considera cumplido el objetivo de esta migración cuando un entregable documental pueda recorrer,
sin bordes manuales ni inconsistencias de estado, este ciclo:

1. materialización del documento y su versión
2. activación del flujo de llenado
3. carga o generación del archivo de trabajo
4. revisión, devolución, retrabajo y aprobación
5. transición controlada a firma
6. ejecución del flujo de firma por pasos
7. registro de evidencia final en `document_signatures`
8. cierre del documento como resultado final del proceso

## Principios que se Mantienen

### 1. Documento como entidad operativa

El entregable real del proceso no es la tarea ni el item, sino el documento.
`task_items` sigue siendo el origen funcional del entregable, pero el flujo operativo vive en:

- `documents`
- `document_versions`
- `document_fill_flows`
- `signature_flow_instances`

### 2. Separación entre técnica y política

La técnica pertenece al artifact:

- schema
- workflow técnico
- anchors y tokens
- formatos
- runtime fields
- estructura de archivos

La política pertenece al proceso:

- quién llena
- quién revisa
- quién firma
- en qué orden
- qué se exige para aprobar

### 3. Payload, working y final no se colapsan

Las tres capas siguen siendo necesarias:

- `payload_object_path`
- `working_file_path`
- `final_file_path`

Pueden coincidir en algunos formatos, pero no deben confundirse en el modelo.

### 4. La firma opera sobre PDF

El archivo de trabajo puede ser:

- PDF
- DOCX
- XLSX
- otros formatos de trabajo

Pero la firma operativa debe cerrarse sobre un PDF real de trabajo. El compilador documental deberá
convertir o producir ese PDF cuando el artifact no sea directamente firmable.

## Estado por Fases

### Fase 0 - Diseño cerrado

Estado:

- cumplida

Qué quedó resuelto:

- separación conceptual entre proceso, documento, artifact y flujo
- modelo de storage documental
- contrato técnico entre `schema`, `data`, `meta` y runtime
- definición de estados documentales
- definición de patrones de firma y runtime fields

Qué ya no es tramo crítico:

- rediseñar tablas base desde cero
- redefinir la semántica general de payload/working/final

### Fase 1 - Base documental

Estado:

- cumplida en gran parte

Qué ya está:

- `process_runs`
- `documents`
- `document_versions`
- materialización desde `task_items`
- soporte de `owner_person_id` y `origin_type`
- refactor de `document_versions` hacia modelo neutral por formato
- rutas canónicas de storage documental

Qué falta:

- servicios más explícitos de versionado documental
- reinstanciación controlada sobre corridas existentes
- mejor trazabilidad de versiones en frontend

Resultado actual:

- un `task_item` documentable ya puede producir un documento y una versión real

### Fase 2 - Flujo de llenado

Estado:

- mucho más avanzada de lo que reflejaba la hoja anterior
- ya no es solo estructura y sincronización
- ya existe operación parcial real

Qué ya está:

- `fill_flow_templates`
- `fill_flow_steps`
- `document_fill_flows`
- `fill_requests`
- sincronización desde artifacts
- resolución parcial de actores
- devolución, reenvío, retrabajo y aprobación
- panel de llenado en dashboard con modal operativo
- historial de notas operativas visible
- control de carga y reemplazo de archivo por responsable actual

Qué falta:

- cerrar por completo la resolución organizacional de todos los pasos
- endurecer todavía más la lógica de estados en algunos bordes
- construir un editor documental real gobernado por `field_refs`
- cerrar mejor la semántica entre elaboración y revisión en todos los pasos

Resultado actual:

- un documento ya puede recorrer un flujo de llenado real, aunque aún con bordes de UX y algunos casos finos de resolución

### Fase 3 - Flujo de firma

Estado:

- avanzada, no cerrada

Qué ya está:

- `signature_flow_templates`
- `signature_flow_steps`
- `signature_flow_instances`
- `signature_requests`
- `document_signatures`
- sincronización desde artifacts
- instanciación desde documentos listos para firma
- estados y progreso de firma en backend
- integración base del firmador con `signature_requests` y `document_signatures`
- filtrado de visibilidad para que no aparezcan firmas antes de tiempo

Qué falta:

- panel o modal real de flujo de firmas en frontend
- cerrar completamente la transición llenado -> firma
- persistir más metadata técnica de anchors y slots en BD
- conectar el compilador documental con el PDF operativo previo a firma
- cerrar el ciclo final de evidencia y estado sin bordes

Resultado actual:

- la firma ya no es solo infraestructura aislada; ya participa en el modelo documental, pero todavía
  no está cerrada como flujo operativo completo

### Fase 4 - Sincronización de metadata técnica

Estado:

- muy avanzada

Qué ya está:

- sincronización de `workflows.fill`
- sincronización de `workflows.signatures`
- contrato técnico de templates en `schema`, `data`, `meta`
- validación de `field_refs`
- validación de `token_field_ref`
- `pattern_ref`
- runtime contract para el compilador

Qué falta:

- materialización más rica de metadata técnica en tablas versionadas
- patrones y anchors persistidos con mayor detalle
- cierre completo del contrato entre runtime backend y compilador documental

Resultado actual:

- la BD ya refleja buena parte de la técnica declarada por el artifact; falta cerrar la parte más
  rica de metadata y compilación

### Fase 5 - Operación y UX

Estado:

- parcial/media
- ya no corresponde decir que esta fase está "temprana"

Qué ya está:

- dashboard documental parcial
- acciones por entregable
- inicio de flujo
- carga y reemplazo de archivo
- descarga de plantilla
- gestión de llenado por modal
- firma embebida por modal
- visualización de archivo y descarga
- etiquetas de acceso directo/derivado

Qué falta:

- panel real de flujo de firmas
- centro documental más consolidado
- trazabilidad de versiones más clara
- experiencia final de documentos standalone
- reinstanciación manual visible en UI

Resultado actual:

- el usuario ya opera parcialmente sobre documentos reales y no solo sobre tareas, pero la
  experiencia todavía no está cerrada como panel documental final

## Checklist Operativo Actual

### Ya cumplido

- modelo documental base operativo
- storage documental canónico
- estados documentales formales en backend
- flujo de llenado sincronizado, instanciado y operando parcialmente
- flujo de firma sincronizado e instanciado en backend
- registro base en `document_signatures`
- contrato técnico de templates bastante estabilizado
- runtime documental base en backend

### Pendiente crítico

- conectar el compilador documental como microservicio operativo
- asegurar `working_file_path` PDF cuando la firma lo requiera
- cerrar completamente la transición llenado -> firma
- exponer el flujo de firmas por pasos en frontend
- cerrar la evidencia final y el cierre documental completo

## Siguiente Tramo Recomendado

El tramo crítico ya no es rediseñar el modelo. El siguiente trabajo de mayor impacto es:

1. implementar el panel real de flujo de firmas
2. conectar el compilador documental al ciclo de documento
3. cerrar la transición operativa entre último paso de llenado y firma
4. consolidar `document_signatures` como evidencia final del documento

## Estado de Referencia

Este documento debe usarse como hoja de ruta operativa principal.
La hoja anterior queda como referencia histórica y de decisiones extendidas:

- [roadmap-modelo-documental-y-firmas.md](/home/fresvel/Sharepoint/DIR/Deploy/deasy/docs/arquitecturas/roadmap-modelo-documental-y-firmas.md)
