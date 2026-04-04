# Objetivo
  Construir un microservicio compilador documental que reciba un artifact/template, prepare el payload runtime del documento, renderice el archivo de trabajo correspondiente y produzca el artefacto compilado que el sistema documental necesita para revisión y firma.

# Responsabilidad del microservicio

  - Recibir solicitudes de compilación por document_version_id o por payload técnico equivalente.
  - Leer la fuente técnica del artifact desde storage.
  - Resolver schema, meta, data y runtime payload.
  - Ejecutar el pipeline de render según render_engine y format.
  - Producir salidas en working/ y, cuando aplique, metadata técnica de compilación.
  - Reportar estado, errores, warnings y artefactos generados al backend principal.

  Requisito arquitectónico de aislamiento

  - El compilador documental debe vivir como microservicio separado del backend principal.
  - Debe tener su propio contenedor, su propio proceso de arranque y su propia superficie HTTP.
  - El backend principal solo debe orquestar la compilación mediante API, callback o polling.
  - No se debe cerrar la implementación final dejando el pipeline de compilación embebido dentro de
    `backend/` como solución definitiva.
  - Si se reutilizan scripts o utilidades de `tools/` durante el desarrollo, deben migrarse o
    empaquetarse dentro del microservicio compilador antes de considerar la tarea terminada.

  Alcance inicial recomendado

  - Soporte prioritario para jinja2 + latex -> pdf.
  - Soporte de preparación de payload runtime para firmas.
  - Soporte de salida a working/pdf/.
  - Soporte de trazabilidad y errores detallados.

  Entradas mínimas del microservicio

  - document_version_id
  - template_artifact_id
  - render_engine
  - meta.yaml
  - schema.json
  - data.yaml/json
  - runtime payload
  - ubicación de storage para:
      - payload/
      - working/
      - final/

  Salidas mínimas

  - working_file_path
  - payload_object_path actualizado cuando aplique
  - compile_report.json
  - estado de compilación:
      - pending
      - running
      - succeeded
      - failed
  - errores/warnings estructurados
  - hash o fingerprint del artefacto generado

  Pipeline funcional

  1. Resolver artifact y versión documental.
  2. Cargar meta, schema, data y runtime.
  3. Validar contrato técnico del template.
  4. Materializar payload final.
  5. Renderizar fuente intermedia.
  6. Compilar a artefacto de trabajo.
  7. Guardar resultados en storage.
  8. Reportar al backend principal.
  9. Dejar listo el documento para siguiente etapa del flujo.

  Requisitos de integración con el modelo actual

  - Debe respetar la semántica:
      - payload_object_path
      - working_file_path
      - final_file_path
  - Debe operar sobre la estructura canónica:
      - deasy-documents/Unidades/.../payload/
      - deasy-documents/Unidades/.../working/{ext}/
      - deasy-documents/Unidades/.../final/
  - Debe reservar deasy-spool solo para temporales técnicos si realmente los
    necesita.
  - Debe integrarse con DocumentRuntimeService.
  - No debe decidir política de negocio.
  - No debe resolver actores del flujo.
  - No debe firmar; solo preparar el documento firmable.

  Requisitos de validación

  - Validar existencia de:
      - meta.yaml
      - schema.json
      - template fuente
  - Validar consistencia entre:
      - field_refs
      - token_field_ref
      - pattern_ref
      - campos declarados en schema
  - Validar que el render solicitado sea compatible con el artifact.
  - Validar que el output requerido sea producible.
  - Si el documento requiere firma, validar que pueda generarse un PDF operativo.

  Requisitos de observabilidad

  - Logs estructurados por compilación.
  - compile_job_id
  - correlación con:
      - document_version_id
      - process_run_id
      - task_item_id
  - guardar duración, motor usado, archivos generados, errores y warnings.
  - exponer healthcheck y readiness.
  - exponer métricas básicas:
      - compilaciones exitosas
      - compilaciones fallidas
      - duración promedio
      - errores por engine/formato

  Requisitos de API

  - POST /compile
  - GET /compile/:jobId
  - GET /health
  - GET /ready
  - opcional:
      - POST /compile/document-version/:id
      - POST /validate-template

  Requisitos de seguridad

  - autenticación entre servicios
  - autorización por servicio llamador
  - validación estricta de rutas/paths
  - aislamiento de temporales
  - no ejecutar templates arbitrarios fuera del workspace controlado
  - sanitizar nombres de archivo y entradas de render

  Requisitos de extensibilidad

  - arquitectura por drivers/engines:
      - jinja2
      - latex
  - separar:
      - preparación de payload
      - render
      - compilación
      - persistencia
  - permitir agregar nuevos render_engine sin reescribir el núcleo

  Requisitos de errores

  - errores de contrato
  - errores de artifact faltante
  - errores de render
  - errores de compilación LaTeX
  - errores de storage
  - errores de runtime incompleto
  - todos deben devolverse de forma estructurada y comprensible

  Requisitos de contenedor y compilación LaTeX

  - El contenedor del microservicio compilador debe construirse con `FROM
    texlive/texlive:<tag>` usando una variante estable o, si todavía no se fija
    versión, `texlive/texlive:latest` de forma explícita.
  - Se debe preferir una etiqueta estable fijada sobre `latest` cuando el flujo
    pase a operación reproducible.
  - La imagen del compilador no debe reimplementar manualmente una
    instalación completa de TeX Live si ya está resuelta por la imagen base.
  - La decisión final del tag usado debe quedar documentada junto con el
    contrato técnico del microservicio.

  Requisitos específicos para firmas

  - el compilador debe poblar runtime fields de firma desde signature_requests
    resueltas.
  - debe poder inyectar:
      - token
      - nombre
      - cargo
      - fecha
  - debe producir PDF operativo cuando el flujo vaya a firma.
  - no debe aplicar la firma, solo dejar el PDF listo para el microservicio
    firmador.

  Requisito explícito de uso de Context7

  - Toda decisión de implementación dependiente de librerías externas debe
    apoyarse en Context7.
  - Antes de implementar cada integración técnica, el equipo debe consultar
    Context7 para:
      - motor Jinja
      - compilación LaTeX
      - manejo de storage
      - colas o workers si aplica
      - framework HTTP del microservicio
  - El documento técnico del microservicio debe registrar:
      - librería evaluada
      - library ID de Context7 usado
      - versión objetivo
      - decisión adoptada
  - No se debe implementar integración de librería “de memoria” cuando haya
    documentación disponible en Context7.

# Backlog sugerido

  1. Definir contrato HTTP del microservicio.
  2. Definir contrato de entrada basado en document_version.
  3. Integrar lectura de artifact desde storage.
  4. Integrar DocumentRuntimeService como proveedor de payload.
  5. Implementar validador técnico de template.
  6. Implementar pipeline jinja2 -> latex -> pdf.
  7. Persistir salida en working/pdf/.
  8. Generar compile_report.json.
  9. Integrar callback o polling con backend principal.
  10. Conectar transición documental post-compilación.
  11. Agregar observabilidad.
  12. Agregar tests de contrato y compilación real.

# Criterios de aceptación

  - dado un document_version_id válido, el microservicio produce un
    working_file_path
  - si el artifact requiere firma, la salida es un PDF firmable
  - los errores se devuelven de forma estructurada
  - el backend puede consultar el estado de compilación
  - el resultado queda almacenado en la ruta documental canónica
  - el diseño deja preparada la extensión a otros formatos
  - la implementación documenta el uso de Context7 en las decisiones de librería
