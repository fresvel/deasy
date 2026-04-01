# Implementación pendiente del flujo de firmas

## Objetivo

  Cerrar el flujo de firmas para que un documento que ya terminó llenado pueda:

  1. entrar formalmente a firma,
  2. mostrar su secuencia de firmantes,
  3. permitir operar cada firma por paso,
  4. registrar la evidencia técnica en document_signatures,
  5. cerrar el documento en estado final cuando termine el flujo.

## Estado actual

  Ya existe:

  - signature_flow_templates
  - signature_flow_steps
  - signature_flow_instances
  - signature_requests
  - document_signatures
  - sincronización desde artifacts
  - instanciación parcial desde backend
  - integración base del firmador con signature_requests
  - modal embebido de firma desde dashboard

  Falta:

  - panel real de flujo de firmas
  - transición operativa estable Listo para firma -> Pendiente de firma -> Firmado
    parcial -> Firmado completo -> Final
  - mejor trazabilidad por paso
  - cerrar la relación de negocio entre:
      - signature_requests
      - document_signatures
      - document_versions
      - documents

  ———

## Backend

### 1. Servicio de orquestación de firma

  Crear o consolidar un servicio tipo DocumentSignatureWorkflowService responsable
  de:

  - instanciar el flujo de firma cuando la versión quede Listo para firma
  - resolver el paso actual
  - validar si el documento ya es firmable
  - decidir cuándo el flujo pasa a:
      - Pendiente de firma
      - Firmado parcial
      - Firmado completo
      - Final

### 2. Reglas de entrada a firma

  Formalizar estas validaciones:

  - no instanciar firma si document_versions.status !== 'Listo para firma'
  - no instanciar firma si el working_file_path no es PDF
  - no instanciar firma si no existe signature_flow_template activo
  - no instanciar firma si faltan firmantes resolubles en pasos obligatorios

### 3. Resolver firmantes por paso

  Cerrar la resolución de actores para firma usando:

  - specific_person
  - position
  - cargo_in_scope
  - manual_pick
  - document_owner si aplica
  - task_assignee si aplica

  Y dejar materializado en signature_requests:

  - assigned_person_id
  - status_id
  - step_id
  - instance_id

### 4. Política de estados de firma

  Definir y centralizar transiciones:

  - Listo para firma -> Pendiente de firma
  - Pendiente de firma -> Firmado parcial
  - Pendiente de firma -> Firmado completo
  - Firmado parcial -> Firmado completo
  - Firmado completo -> Final

  Y reglas:

  - si firma un paso intermedio, no cerrar documento
  - si termina el último paso requerido, cerrar flujo e impulsar documento a Final

### 5. Cierre técnico de evidencia

  Consolidar document_signatures como evidencia final:

  - guardar una fila por firma aplicada
  - vincular siempre:
      - signature_request_id
      - document_version_id
      - signer_user_id
      - signature_type_id
      - signature_status_id
  - guardar metadata técnica mínima:
      - ruta del archivo firmado resultante
      - hash si aplica
      - timestamp
      - resultado de validación

### 6. Relación entre signer y workflow

  El endpoint de firma debe:

  - recibir signature_request_id
  - validar que esa request corresponde al usuario autenticado
  - validar que está en estado firmable
  - firmar el PDF de working
  - actualizar signature_requests
  - insertar document_signatures
  - recalcular progreso documental

### 7. Rechazo/cancelación en firma

  Definir semántica explícita:

  - reject en firma:
      - bloquea el paso
      - deja evidencia
      - mueve documento a estado observable o de excepción si así se decide
  - cancel en firma:
      - cierre operativo de esa solicitud o flujo

### 8. Exposición de datos al panel

  El backend del panel debe devolver por documento:

  - signature_flow
  - signature_steps
  - current_signature_step_order
  - signature_requests
  - responsable actual
  - si el usuario actual puede operar o solo visualizar

  ———

## Frontend

### 1. Modal o panel real de “Flujo de firmas”

  Implementar Flujo de firmas como se hizo con Gestionar llenado.

  Debe mostrar:

  - documento
  - versión
  - estado documental
  - archivo actual
  - secuencia de pasos de firma
  - firmante resuelto por paso
  - estado de cada paso
  - paso actual
  - historial de observaciones o notas si aplica

### 2. Acciones por paso

  En frontend, según el paso actual:

  - si el usuario es el firmante actual:
      - Firmar
  - si no le corresponde:
      - solo visualización
  - opcional futuro:
      - Rechazar
      - Cancelar
      - Solicitar corrección

### 3. Reutilización del modal de firma

  El modal embebido actual debe quedar como componente reutilizable del flujo de
  firmas:

  - recibe signature_request_id
  - recibe document_version_id
  - precarga PDF desde working_file_path
  - firma y vuelve al panel
  - refresca secuencia del flujo al terminar

### 4. Visibilidad correcta en dashboard

  Reglas de UI:

  - Flujo de firmas aparece cuando existe instancia o template de firma relevante
  - Firmar aparece solo si:
      - hay signature_request pendiente para el usuario actual
      - existe PDF en working
  - si no hay PDF, mostrar mensaje claro:
      - Este documento requiere PDF operativo antes de entrar a firma.

### 5. Historial y trazabilidad

  Mostrar:

  - quién firmó
  - qué paso firmó
  - cuándo firmó
  - resultado de validación
  - si el documento está en:
      - Pendiente de firma
      - Firmado parcial
      - Firmado completo
      - Final

### 6. Centro documental

  Cuando se consolide el panel:

  - Documentos debe ser vista general
  - la operación principal debe seguir naciendo desde el entregable
  - el flujo de firmas debe poder abrirse:
      - desde entregable
      - y desde centro documental

  ———

## API mínima requerida

### Backend panel

  - GET /users/:id/process-definitions/:definitionId/panel
      - debe devolver firma enriquecida por documento

### Workflow de firma

  - POST /sign/signature-requests/:requestId/start opcional si decides separar
    “tomar paso”
  - POST /sign
      - ya existe base, debe seguir usando:
          - signature_request_id
          - document_version_id
  - opcional:
      - POST /sign/signature-requests/:requestId/reject
      - POST /sign/signature-requests/:requestId/cancel

### Consulta de flujo

  - opcional:
      - GET /documents/:documentVersionId/signature-flow

  ———

## Requisitos de datos y modelo

### Debe quedar claro

  - signature_flow_templates
      - definen secuencia de firma
  - signature_flow_steps
      - definen cada paso y su criterio
  - signature_flow_instances
      - representan el flujo activo de esa versión
  - signature_requests
      - representan la solicitud operativa por persona/paso
  - document_signatures
      - representan la evidencia técnica real de firma aplicada

### Pendiente de refactor fino

  Revisar si signature_flow_steps debe guardar más metadata:

  - code
  - name
  - anchors
  - slot key
  - token field ref
  - placement strategy

  Porque hoy parte de eso sigue en meta.yaml.

  ———

## Requisitos de UX

### Flujo esperado

  1. documento termina llenado
  2. entra a Listo para firma
  3. backend instancia firma
  4. documento pasa a Pendiente de firma
  5. usuario abre Flujo de firmas
  6. ve la secuencia y su paso actual
  7. firma desde modal
  8. panel se refresca
  9. cuando termina el último paso, documento queda cerrado

### Mensajes obligatorios

  - “No existe PDF de trabajo para firma”
  - “No tienes una solicitud de firma pendiente para este documento”
  - “La firma se registró correctamente”
  - “El flujo de firmas avanzó al siguiente responsable”
  - “El documento quedó firmado completamente”

  ———

## Requisito explícito de Context7

  Toda integración nueva de librerías para el flujo de firmas debe documentarse
  usando Context7, especialmente si tocas:

  - visor PDF
  - manipulación PDF
  - validación de firmas
  - frameworks auxiliares de UI
  - librerías de colas o callbacks del microservicio firmador

  Debe registrarse:

  - library ID consultado en Context7
  - versión objetivo
  - decisión tomada
  - motivo técnico

  ———

## Backlog sugerido

  1. Consolidar servicio backend de orquestación de firma.
  2. Endurecer reglas de transición a firma.
  3. Completar resolución de firmantes por paso.
  4. Cerrar actualización de signature_requests y document_signatures.
  5. Implementar panel/modal de Flujo de firmas.
  6. Reutilizar FirmarPdf como componente del flujo.
  7. Mostrar historial de firmas y trazabilidad.
  8. Cerrar transición Firmado completo -> Final.
  9. Refinar persistencia de anchors/slots si hace falta.
  10. Documentar librerías y decisiones usando Context7.

  ———

## Criterios de aceptación

  - un documento en Listo para firma puede instanciar su flujo de firma
  - el firmante actual puede ver su paso
  - el firmante actual puede firmar desde el panel
  - la firma actualiza signature_requests
  - la firma registra document_signatures
  - el documento avanza a Firmado parcial o Firmado completo
  - al finalizar el último paso, el documento queda en Final
  - el usuario puede visualizar la secuencia completa del flujo de firmas
  - las decisiones técnicas nuevas quedan documentadas con Context7


