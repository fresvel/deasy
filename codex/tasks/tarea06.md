# Listado de actividades

Avance del checklist: `10/10`

Estado actual: `Flujo verificado en navegador; modal embebido consistente con el resultado real`.

Buenas practicas base para esta tarea:
- Usar `Requisitos06.md` como fuente de verdad funcional y tecnica.
- Validar el flujo contra el estado real del backend antes de asumir problemas
  solo de UI.
- Tratar el snapshot de firmas, el PDF de trabajo y la persistencia de
  evidencia como tres capas distintas del problema.
- Registrar por separado los resultados de pruebas standalone y las pruebas del
  flujo documental.
- Mantener las pruebas operativas con cuentas demo y certificados autofirmados
  usando `Demo1234!`.

0. [x] Revisar `Requisitos06.md` y convertirlo en hoja de ruta operativa.
1. [x] Reproducir el acceso real al proceso `Requerimiento Docente` con cuentas demo desde dashboard.
2. [x] Confirmar por API que el documento activo del flujo mantiene 6 solicitudes de firma pendientes.
3. [x] Identificar que el snapshot actual deja `currentSignatureStepOrder = null` y `canOperate = false` pese a existir solicitudes pendientes reales.
4. [x] Aplicar corrección mínima en backend para que el resumen del flujo soporte tanto filas SQL crudas como objetos serializados.
5. [x] Verificar la corrección del snapshot con el backend recargado en el entorno activo.
6. [x] Reproducir una firma standalone correcta con `persona.demo1@pucese.edu.ec` y certificado demo autofirmado.
7. [x] Confirmar que el modal standalone muestra éxito y no reproduce por sí solo el error reportado.
8. [x] Probar el documento real del flujo y registrar los fallos técnicos actuales del PDF:
   - token no encontrado
   - incompatibilidad por hybrid xref al firmar por coordenadas
9. [x] Determinar que el fallo principal del flujo activo se originaba en dos capas:
   - snapshot inconsistente en backend
   - rechazo técnico del signer a PDFs con hybrid xref
10. [x] Cerrar la fase con una revalidación visual final del modal embebido y una propuesta concreta de ajustes UX para mensajes de error específicos.

## Cambios aplicados en esta ronda

- `backend/services/documents/DocumentSignatureWorkflowService.js`
  - soporte mixto `snake_case` / `camelCase` para resumir solicitudes de firma.
- `signer/app.py`
  - apertura de PDFs con `strict=False` para permitir firmado incremental sobre
    documentos con `hybrid xref`.

## Resultado operativo confirmado

- `documentVersionId = 23`
- `signatureRequestId = 185`
- firma realizada con:
  - `persona.demo1@pucese.edu.ec`
  - certificado demo autofirmado
  - password `Demo1234!`
- respuesta observada:
  - HTTP `200`
  - `documentSignatureId = 17`
  - `signatureStatusCode = firmado`
- efecto de negocio:
  - la `document_version` pasó a `Firmado parcial`
  - el flujo avanzó al paso `2`
  - el nuevo responsable actual es `responsable.financiero.demo`

## Resultado operativo confirmado para el bug del modal

- reproduccion del bug en navegador:
  - usuario `director.docencia.demo@pucese.edu.ec`
  - `signatureRequestId = 188`
  - `POST /sign => 200`
  - el flujo avanzó al paso `5`
  - la UI mostró falsamente `Error al firmar`

- correccion aplicada:
  - en modo embebido ya no se resetea el estado del firmador antes de emitir
    `workflow-signed`

- verificacion final en navegador:
  - usuario `jefa.talento.demo@pucese.edu.ec`
  - `signatureRequestId = 189`
  - `POST /sign => 200`
  - la UI mostró mensaje de exito consistente
  - el flujo avanzó al paso `6`

## Evidencia resumida de esta ronda

- Cuenta usada para reproduccion principal:
  - `persona.demo1@pucese.edu.ec`
- Password de acceso:
  - `Demo1234!`
- Password de certificado demo:
  - `Demo1234!`

- Documento inspeccionado en flujo:
  - `documentVersionId = 23`
- Solicitudes de firma pendientes observadas:
  - `185` paso 1 -> `persona.demo1`
  - `186` paso 2 -> `responsable.financiero.demo`
  - `187` paso 3 -> `director.escuela.demo`
  - `188` paso 4 -> `director.docencia.demo`
  - `189` paso 5 -> `jefa.talento.demo`
  - `190` paso 6 -> `prorrector.demo`

- Resultado standalone confirmado:
  - firma correcta
  - respuesta `200`
  - modal `Documento firmado`

- Resultado sobre el PDF actual del flujo antes del fix:
  - firma por token falla por token ausente en PDF
  - firma por coordenadas falla por incompatibilidad técnica del PDF

- Resultado sobre el PDF actual del flujo despues del fix del signer:
  - firma por coordenadas correcta
  - evidencia persistida en backend
  - snapshot avanza al siguiente paso

- Resultado sobre el modal embebido despues del fix frontend:
  - sin modal rojo falso tras firma correcta
  - mensaje de exito visible en la vista de proceso
