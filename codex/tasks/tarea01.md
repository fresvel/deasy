# Listado de actividades

Avance del checklist: `11/11`

Buenas practicas base para esta tarea:
- Usar `Requisitos01.md` como fuente de verdad funcional y tecnica.
- Registrar decisiones de librerias e integraciones nuevas con Context7.
- Mantener actualizado este checklist a medida que avancemos punto por punto.
- Context7 inicial consultado: `/sidorares/node-mysql2` para mantener el patron transaccional con `getConnection()`, `beginTransaction()`, `commit()`, `rollback()` y `release()` en la orquestacion de firma.

0. [x] Revisar `Requisitos01.md` para tener el contexto completo de la implementacion y usarlo como base de la hoja de ruta.
1. [x] Consolidar servicio backend de orquestacion de firma.
2. [x] Endurecer reglas de transicion a firma (validaciones de estatus, PDF y firmantes, plus registros de motivo cuando la orquestacion no se crea).
3. [x] Completar resolucion de firmantes por paso usando document_owner, task_assignee, position y cargo_in_scope cuando aplica, y registrar pasos obligatorios no resueltos antes de instanciar nuevas solicitudes.
4. [x] Cerrar actualizacion de `signature_requests` y `document_signatures` mediante `registerSignatureEvidence` y el nuevo flujo de persistencia atómica.
5. [x] Implementar panel/modal de Flujo de firmas (API `/sign/documents/:documentVersionId/signature-flow` que entrega pasos, solicitudes, responsable actual y permisos de operación).
6. [x] Reutilizar `FirmarPdf` como componente del flujo y activar firma directamente desde el panel.
7. [x] Mostrar historial de firmas y trazabilidad usando la sección de solicitudes y estados firmados.
8. [x] Cerrar transicion `Firmado completo -> Final`.
9. [x] Refinar persistencia de `anchors`/`slots` si hace falta.
10. [x] Documentar librerias y decisiones usando Context7.

## Context7 Decision Log
- Date: 2026-04-03
  - Library: `/sidorares/node-mysql2`
  - Decision: Mantener el patrón transaccional con `getConnection()`, `beginTransaction()`, `commit()`, `rollback()` y `release()` en `DocumentSignatureWorkflowService` al cerrar el flujo de firma; la transición adicional a `Final` se aplica después de que todas las firmas queden registradas para no romper la consistencia documental.
  - Reason: Las guías de `/sidorares/node-mysql2` recomiendan el uso explícito de conexiones manuales dentro de transacciones (con release en un bloque `finally`) para operaciones críticas como la persistencia de evidencia de firmas, lo cual respalda la estrategia actual y evita fugas de conexión.
