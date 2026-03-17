# Frontend - Navegacion (tecnico)

## Router

Archivo: frontend/src/router/index.js

Rutas registradas:

- / (login)
- /dashboard
- /perfil
- /register
- /firmar
- /admin
- /logout

## Dashboard

La ruta `/dashboard` tiene dos estados de trabajo dentro de la misma vista:

1) Estado general
- muestra el resumen del usuario
- tarjetas de estado
- resumen rapido

2) Estado operativo por definicion de proceso
- se activa cuando el usuario hace click en un proceso del menu lateral
- no cambia de ruta; cambia el contenido de `DashboardHome.vue`
- abre la consola operativa de la `process_definition` recibida desde el menu

La consola operativa actual muestra:

- contexto de la definicion
- tareas del usuario actual
- entregables
- documentos
- firmas del usuario
- dependencias
- paquetes de usuario
- creacion manual de tareas

## Guard de autenticacion

- Se valida token JWT desde localStorage.
- Utilidades en frontend/src/utils/tokenUtils.js:
  - isTokenValid(token)
  - clearAuthData()

Reglas principales:

- Rutas publicas: /, /register
- Si hay token valido y se entra a /, se redirige a /dashboard.
- Si el token expiro, se limpia y se redirige a /.

## Logout

- Ruta /logout hace POST a API_ROUTES.USERS_LOGOUT
- Limpia token y usuario en storage y borra cookie refreshToken.

## Layouts

- frontend/src/layouts/SMenu.vue
- frontend/src/layouts/SHeader.vue
- frontend/src/layouts/SFooter.vue
- frontend/src/layouts/SBody.vue

## Servicios ligados al dashboard

- `frontend/src/services/logged/UserMenuService.js`
  - obtiene el menu del usuario y los procesos visibles por cargo
- `frontend/src/services/logged/ProcessDefinitionPanelService.js`
  - obtiene el panel operativo de una definicion
  - crea tareas manuales desde el dashboard
