# Propuesta inicial de roles y permisos

## Estado actual observado

El backend ya tiene una base SQL preparada para RBAC:

- `roles`
- `resources`
- `actions`
- `permissions`
- `role_permissions`
- `role_assignments`
- `cargo_role_map`

Por eso la evolucion recomendada es extender ese modelo MariaDB y no basar la
autorizacion principal en el modelo legacy de Mongo `models/users/roles.js`.

## Roles base

### Auditor

Objetivo: lectura sin modificacion.

Permisos sugeridos:

- Leer usuarios.
- Leer procesos.
- Leer tareas.
- Leer documentos.
- Leer reportes.
- Leer configuracion administrativa.

Sin permisos para crear, editar, eliminar, firmar, aprobar, devolver o resetear.

### Admin

Objetivo: administracion completa del sistema.

Permisos sugeridos:

- Todos los permisos sobre todos los recursos.
- Gestion de roles.
- Gestion de permisos.
- Asignacion de roles a usuarios.
- Configuracion de procesos, plantillas, cargos, unidades y reglas.

### Gestor

Objetivo: operar procesos.

Permisos sugeridos:

- Crear procesos.
- Editar procesos.
- Eliminar procesos, si el proceso no tiene dependencias activas o si la regla de negocio lo permite.
- Lanzar tareas/procesos.
- Gestionar reglas de proceso.
- Gestionar plantillas asociadas al proceso, si corresponde.
- Leer usuarios necesarios para asignaciones.

No deberia administrar roles globales ni permisos del sistema.

### Usuario

Objetivo: uso funcional de la plataforma.

Permisos sugeridos:

- Leer y editar su propio perfil.
- Gestionar su dossier.
- Ver su centro documental.
- Subir entregables propios o asignados.
- Firmar documentos asignados.
- Responder solicitudes de llenado/firma asignadas.

Sin acceso a administracion global salvo que tenga otro rol adicional.

## Acciones base

Acciones minimas para poblar `actions`:

- `read`
- `create`
- `update`
- `delete`
- `manage`
- `assign`
- `approve`
- `sign`
- `download`
- `upload`

## Recursos iniciales

Recursos minimos para poblar `resources`:

- `users`
- `roles`
- `permissions`
- `units`
- `cargos`
- `processes`
- `process_definitions`
- `tasks`
- `documents`
- `templates`
- `reports`
- `dossier`
- `signatures`

## Reglas de implementacion recomendadas

1. Resolver permisos en backend mediante middleware, no solo ocultando botones en frontend.
2. Mantener los permisos como `resource.action`, por ejemplo `processes.create`.
3. Incluir permisos efectivos en `/users/me` o en un endpoint dedicado como `/users/me/permissions`.
4. Usar el frontend solo para presentar u ocultar acciones segun permisos ya calculados por backend.
5. Permitir que un usuario tenga multiples roles vigentes por unidad mediante `role_assignments`.
6. Mantener `Admin` como rol global o de maxima prioridad.
7. Tratar `Auditor` como permiso de lectura, no como bypass administrativo.

## Primera pantalla sugerida

En `admin`, crear una seccion "Roles y permisos" con tres vistas:

- Roles: listar, crear, editar, activar/desactivar roles.
- Matriz de permisos: asignar acciones por recurso a cada rol.
- Asignaciones: asignar roles a usuarios, opcionalmente por unidad.

## Nota de alcance

Esta propuesta no cambia aun reglas de negocio. Sirve como base para implementar
la seccion administrativa respetando el esquema SQL existente.
