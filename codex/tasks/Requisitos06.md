# Endurecimiento del flujo de firmas de Requerimiento Docente

## Objetivo

Revisar y estabilizar el flujo de firmas del proceso `Requerimiento Docente`,
priorizando:

- consistencia entre estado documental, snapshot del flujo y UX del dashboard,
- trazabilidad real de las solicitudes de firma por paso,
- y el error reportado donde una firma aparentemente correcta termina
  mostrándose como error en el modal.

La revisión debe tomar como referencia principal el código actual del
repositorio, y usar las cuentas demo documentadas en `codex/accounts.md` para
pruebas operativas reales cuando el entorno lo permita.

## Alcance de esta fase

### 1. Reproducir el flujo real de `Requerimiento Docente`

La revisión debe cubrir el flujo documental activo del proceso:

- definición `Requerimiento Docente`,
- documento pendiente de firma,
- secuencia multirol configurada para sus seis pasos,
- y navegación operativa desde dashboard hasta el entregable.

### 2. Validar consistencia backend/frontend

El sistema debe mantener coherencia entre:

- `signature_flow_instances`,
- `signature_requests`,
- `document_signatures`,
- estado de `document_versions`,
- snapshot entregado por `GET /sign/documents/:documentVersionId/signature-flow`,
- y componentes de dashboard / firmador embebido.

### 3. Revisar el error del modal post-firma

Se debe determinar si el error reportado proviene de:

- un fallo real del microservicio `signer`,
- una falla posterior al firmado al persistir evidencia o sincronizar progreso,
- un problema de cálculo de operabilidad del paso actual,
- o una desalineación puramente de UI/modal.

### 4. Probar con cuentas demo y certificados autofirmados

Para esta fase se toman como credenciales base:

- acceso de usuarios demo: `Demo1234!`
- contraseña de certificados demo autofirmados: `Demo1234!`

La matriz mínima de actores a considerar en el flujo es:

- `persona.demo1@pucese.edu.ec` como firmante del paso 1
- `responsable.financiero.demo@pucese.edu.ec`
- `director.escuela.demo@pucese.edu.ec`
- `director.docencia.demo@pucese.edu.ec`
- `jefa.talento.demo@pucese.edu.ec`
- `prorrector.demo@pucese.edu.ec`

## Hallazgos confirmados en esta revisión

### Hallazgo 1. El snapshot del flujo perdía el paso actual y dejaba `canOperate` en falso

En el endpoint del snapshot del flujo se confirmó una inconsistencia entre los
datos SQL crudos y los objetos ya serializados para frontend. Como resultado:

- `currentSignatureStepOrder` sale `null`
- `responsableActual` sale `null`
- `canOperate` sale `false`

Esto ocurre incluso cuando existen solicitudes pendientes reales y el primer
paso ya está asignado al usuario correcto.

Corrección aplicada:

- se ajustó `DocumentSignatureWorkflowService.js` para leer ambas variantes de
  claves (`snake_case` y `camelCase`) en:
  - estado de solicitud,
  - estado de firma,
  - orden de paso,
  - modo de aprobación,
  - mínimo requerido de firmantes.

Resultado validado en entorno activo:

- `currentSignatureStepOrder` pasó de `null` a `1`,
- `responsableActual` pasó a `Persona Demo Uno`,
- `canOperate` pasó a `true`,
- y tras completar el paso 1 avanzó correctamente a `stepOrder = 2`.

Impacto resuelto:

- el dashboard no puede habilitar correctamente el firmador embebido,
- la vista de flujo pierde trazabilidad operativa,
- y el estado visible del flujo no coincide con la realidad de negocio.

### Hallazgo 2. La entrada “Firmas” del hero todavía no está conectada al flujo operativo

La vista de definición muestra explícitamente que la bandeja consolidada de
firmas todavía no está conectada desde el hero, y que el ingreso operativo
sigue ocurriendo desde cada entregable.

Impacto:

- el usuario ve dos puntos de acceso con distinta madurez,
- y el flujo de firma depende todavía del contexto del entregable.

### Hallazgo 3. La firma standalone sí funciona con PDF de prueba

Se reprodujo una firma standalone correcta con:

- `persona.demo1@pucese.edu.ec`
- certificado demo autofirmado
- `frontend/public/pdf/ejemplo.pdf`
- modo coordenadas
- advertencia aceptada por certificado no confiable

Resultado observado:

- respuesta `200` del endpoint `/sign`
- modal de UI con título `Documento firmado`
- acciones disponibles para visualizar y descargar

Esto confirma que el firmador genérico y el modal base no están rotos de forma
global.

### Hallazgo 4. El PDF actual del flujo `Requerimiento Docente` presentaba problemas específicos

Al intentar firmar el documento del flujo activo se observaron dos problemas
distintos:

- en modo token:
  - `Token marker '!-9b6D6WnuUE-!' not found in PDF`
- en modo coordenadas sobre el documento actual:
  - `Attempting to sign document with hybrid cross-reference sections while hybrid xrefs are disabled`

Esto confirmó que el problema del flujo documental no era solo de UI:

- el PDF de trabajo actual no está alineado con la estrategia de firma por
  token del flujo,
- y además el archivo actual presenta incompatibilidad técnica de firmado por
  coordenadas en el `signer`.

Corrección aplicada:

- en `signer/app.py` se reemplazó la apertura estricta del PDF por
  `PdfFileReader(..., strict=False)` en:
  - detección de firmas embebidas,
  - construcción de `IncrementalPdfFileWriter`,
  - validación posterior de PDF firmado,
  - y lectura para resumen de validación.

Resultado validado en entorno activo:

- una nueva firma por coordenadas sobre `documentVersionId = 23` devolvió
  `200`,
- el backend registró `documentSignatureId = 17`,
- `signatureRequestId = 185` pasó a `completado`,
- y la `document_version` cambió a `Firmado parcial`.

### Hallazgo 5. El modal embebido podía mostrar error después de una firma ya exitosa

Este bug quedó reproducido en navegador con `director.docencia.demo@pucese.edu.ec`
en el paso 4 del mismo flujo:

- la UI hizo `POST /sign`
- el backend respondió `200 OK`
- `signatureRequestId = 188` quedó `completado`
- el flujo avanzó al paso 5
- pero el componente mostró el modal rojo `Error al firmar`

La causa observable fue de frontend:

- en modo embebido, después de una firma correcta el componente podía resetear su
  estado antes de terminar la ruta de éxito,
- y luego abría `signResultModal` con `signSuccess = false`, lo que renderizaba
  un falso error.

Corrección aplicada:

- en `FirmarPdf.vue` se evitó ocultar/resetear el modal de certificado antes de
  emitir `workflow-signed` en modo embebido,
- y se mantuvo la reconciliación defensiva para casos donde el backend ya dejó
  la solicitud como `completado`.

Validación posterior en navegador:

- se repitió la prueba completa con `jefa.talento.demo@pucese.edu.ec`
- la firma del paso 5 devolvió éxito real
- la UI mostró mensaje de éxito consistente
- y el flujo avanzó al paso 6 sin abrir el modal rojo.

## Implicaciones técnicas

### Sobre el bug del modal reportado

Con la evidencia actual, el problema reportado debe separarse en dos capas:

1. caso standalone:
   - no quedó reproducido el error; el modal mostró éxito.
2. caso workflow documental:
   - primero estuvo afectado por snapshot inconsistente,
   - y además fallaba técnicamente al firmarse por incompatibilidad del PDF.

Tras esta ronda, los dos bloqueos técnicos principales ya quedaron resueltos:

- cálculo correcto de paso actual,
- habilitación correcta de `canOperate`,
- compatibilidad del PDF de trabajo con el microservicio de firma.

Lo que sigue pendiente es revalidar el modal de éxito dentro del flujo embebido
con interacción completa sobre el canvas, ahora que backend y signer ya
responden correctamente.

### Sobre la prioridad de corrección

La prioridad técnica inmediata ahora debe ser:

1. revalidar el modal post-firma dentro del flujo embebido con interacción
   completa del canvas,
2. probar el paso 2 con `responsable.financiero.demo@pucese.edu.ec`,
3. verificar si el modo token debe mantenerse habilitado para este flujo o
   mostrarse como no disponible cuando el PDF no contiene marcador,
4. y revisar si el mensaje genérico de error del modal debe mapear errores
   técnicos específicos del backend.

## Criterio de cierre

Esta fase se considera cerrada cuando se cumplan todos estos puntos:

- el snapshot del flujo devuelve paso actual y `canOperate` correctos,
- `persona.demo1` puede operar el paso 1 desde el flujo de `Requerimiento
  Docente`,
- la firma del documento del flujo se ejecuta sin inconsistencias técnicas de
  PDF,
- el resultado final mostrado en modal coincide con la respuesta real del
  backend,
- y el avance del documento hacia el siguiente paso de firma queda reflejado en
  dashboard y backend.
