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

