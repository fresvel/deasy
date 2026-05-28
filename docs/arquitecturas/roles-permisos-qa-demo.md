# Roles y permisos para demo QA

## Objetivo

Cerrar el primer punto critico del demo: que el sistema no dependa solo de
ocultar botones, sino que el backend valide roles y permisos antes de permitir
operaciones sensibles.

La meta para QA no es cubrir todo el modelo final de seguridad, sino dejar un
flujo demo confiable:

- `Admin`: acceso completo.
- `Gestor`: opera procesos y documentos, sin administrar seguridad global.
- `Auditor`: solo lectura.
- `Usuario`: operaciones propias de cuenta, dossier, documentos y firmas.

Para el demo QA, `Admin` se asigna a una cuenta dedicada
`admin.demo@pucese.edu.ec`. Los usuarios con cargo de director se mantienen como
roles operativos derivados de su cargo y no deben usarse como administradores
globales.

## Modelo usado

Se reutiliza el modelo SQL existente:

- `roles`
- `resources`
- `actions`
- `permissions`
- `role_permissions`
- `role_assignments`
- `cargo_role_map`

Los permisos efectivos se calculan desde las asignaciones vigentes del usuario.
Si un usuario no tiene asignacion activa, se usa `Usuario` como rol funcional de
respaldo cuando ese rol existe en la base.

## Politica aplicada para QA

| Rol | Lectura | Crear | Actualizar | Eliminar | Administrar |
| --- | --- | --- | --- | --- | --- |
| Admin | Todo | Todo | Todo | Todo | Todo |
| Gestor | Usuarios, roles y procesos necesarios para operar | Procesos y documentos | Procesos, documentos, cuenta y dossier | Procesos | No seguridad global |
| Auditor | Usuarios, roles, procesos, documentos y dossier | No | No | No | No |
| Usuario | Datos propios | Dossier propio | Cuenta, dossier y documentos propios | No | No |

## Rutas protegidas

Backend:

- `GET /users`: requiere `users.read`.
- `GET /users/:id/menu`: requiere ser el mismo usuario o rol operativo.
- `GET /users/:id/process-definitions/:definitionId/panel`: requiere ser el
  mismo usuario o rol operativo.
- Centros de documentos y firmas por usuario: requieren acceso propio o rol
  operativo de lectura.
- Rutas de carga, reset y creacion documental: mantienen validacion de usuario
  propietario y ahora tambien pasan por autenticacion consistente.
- `admin/sql`: protegido por token y permisos por recurso/accion.
- `dossier/:cedula`: lectura propia u operativa; escritura segun permiso y
  nunca para `Auditor`.
- `sign`: firma y acciones de workflow requieren permisos de documentos; lectura
  de flujo/validacion requiere lectura.

Frontend:

- El usuario autenticado guarda `access.roles` y `access.permissions`.
- El enlace a administracion se oculta para usuarios sin acceso administrativo.
- La ruta `/admin` exige permiso administrativo antes de renderizar.
- Axios adjunta automaticamente el `Bearer token` a las llamadas API.

## Verificacion esperada

Con la semilla demo y el patch RBAC:

- `admin.demo@pucese.edu.ec` puede entrar a `/admin` y operar tablas.
- `director.demo@pucese.edu.ec` no conserva `Admin` manual por defecto.
- `Gestor` puede leer usuarios/roles y operar procesos, pero no crear roles.
- `Auditor` puede leer tablas permitidas, pero recibe `403` si intenta crear,
  editar o eliminar.
- Un request sin token a `/admin/sql/meta` responde `401`.
- El home sigue cargando documentos y firmas del usuario autenticado.

## Pendientes fuera del alcance

- Crear una pantalla dedicada de matriz de permisos mas amigable que el CRUD SQL.
- Separar permisos `own.*` y `global.*` para reglas mas finas.
- Agregar pruebas automatizadas de autorizacion por rol.
- Auditar todos los endpoints legacy fuera del flujo principal del demo.
