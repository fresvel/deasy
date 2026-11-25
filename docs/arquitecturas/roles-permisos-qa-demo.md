# Roles y permisos para demo QA

## Objetivo

Validar que el backend aplique RBAC real y que la UI solo exponga accesos
compatibles con los permisos efectivos del usuario.

## Roles usados

- `AdminSistema`: acceso completo al gobierno del sistema.
- `GestorProcesos`: gestiona definiciones, reglas y disparadores de procesos.
- `GestorEjecucionProcesos`: gestiona corridas, tareas y entregables.
- `GestorDocumental`: gestiona documentos y llenado.
- `GestorFirmas`: gestiona flujos y solicitudes de firma.
- `Auditor`: solo lectura.
- `Usuario`: operaciones propias.

El demo puede crear otros roles obligatorios del catalogo (`GestorSeguridad`,
`GestorTalentoHumano`, `GestorUnidades`, `GestorAcademico`,
`GestorPlantillas`, `GestorContratacion`) aunque no todos tengan cuenta demo
dedicada.

## Rutas protegidas

- `GET /users`: requiere `people.read`.
- Panel de proceso de usuario: requiere `process_execution.read` y acceso al
  usuario objetivo.
- Creacion de tarea de usuario: requiere `process_execution.create`.
- Centros documentales: requieren `documents.read`.
- Centros de firma: requieren `signature_flows.read`.
- Certificados personales: usan `signature_flows.read/update`.
- `admin/sql`: se valida por recurso granular segun tabla.
- Firma y multifirma: usan `signature_flows.read/update`.
- Llenado documental: usa `fill_flows.update`.

## Verificacion esperada

- `admin.demo@pucese.edu.ec` queda como `AdminSistema`.
- Las asignaciones legacy `Admin` se migran a `AdminSistema`.
- Las asignaciones legacy `Gestor` se migran a `GestorProcesos`.
- Los gestores no ven seguridad global salvo `GestorSeguridad`.
- `/procesos` requiere `GestorProcesos`, `GestorEjecucionProcesos` o permisos
  equivalentes de `process_definitions`/`process_execution`.
- `/admin` queda reservado para gobierno del sistema y seguridad.
