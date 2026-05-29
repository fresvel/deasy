# Roles y permisos granulares

## Decision vigente

El rol generico `Gestor` queda reemplazado por roles de gestion por dominio.
El rol de maxima prioridad del sistema es `AdminSistema`.

## Roles obligatorios

- `AdminSistema`: seguridad, bootstrap, configuracion critica y gobierno global.
- `GestorSeguridad`: roles, permisos, asignaciones y mapas cargo-rol.
- `GestorTalentoHumano`: personas, cargos, puestos y ocupaciones.
- `GestorUnidades`: unidades, tipos de unidad y relaciones jerarquicas.
- `GestorAcademico`: tipos de periodo y periodos academicos.
- `GestorProcesos`: procesos base, definiciones, versiones, reglas y disparadores.
- `GestorPlantillas`: seeds, artifacts y plantillas de procesos definidos.
- `GestorEjecucionProcesos`: corridas, tareas, entregables y asignaciones operativas.
- `GestorDocumental`: documentos, versiones y flujos de llenado.
- `GestorFirmas`: flujos, solicitudes, estados y firmas documentales.
- `GestorContratacion`: vacantes, postulaciones, ofertas, contratos y origenes.
- `Auditor`: lectura transversal sin escritura.
- `Usuario`: acceso operativo propio.

## Recursos RBAC

Los permisos se expresan como `resource.action`.

- `account`
- `dossier`
- `security`
- `people`
- `units`
- `academic_terms`
- `process_definitions`
- `process_execution`
- `templates`
- `documents`
- `fill_flows`
- `signature_flows`
- `contracts`

## Migracion

La migracion RBAC conserva asignaciones existentes y las mueve asi:

- `Admin` -> `AdminSistema`
- `Gestor` -> `GestorProcesos`

Los roles legacy quedan inactivos y sin permisos en los roles base. Los permisos
vigentes se reconstruyen desde el catalogo central del backend.
