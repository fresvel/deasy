# Backend - Auth (tecnico)

## Flujo de autenticacion

1) Registro o login via endpoints de /user.
2) Generacion de token desde backend/services/auth/TokenService.js
3) Validacion de token en middleware backend/middlewares/val_token.js

## Componentes clave

- Servicios:
  - backend/services/auth/AuthService.js
  - backend/services/auth/TokenService.js
  - backend/services/auth/PasswordService.js
  - backend/services/auth/UserRepository.js

- Utilidades:
  - backend/utils/login/generate_token.js

## Endpoints relacionados

- Documentados en Swagger (ver /easym/docs).
- Controladores en backend/controllers/users/.

## 2FA

- Controlador: backend/controllers/users/auth_2fa.js

## Roles y permisos

- Modelos: backend/models/users/roles.js, permisos.js
- Validaciones adicionales en middlewares.

## Cambios y validaciones recientes (2026-03-17)

### Endpoint de refresh token

Ruta:

- `POST /users/refresh-token`

Comportamiento esperado:

- Lee `refreshToken` desde cookie HTTP.
- Si no existe cookie, responde `401` con mensaje `No se encontro refresh token`.
- Si es invalido o expiro, responde `401`.
- Si es valido, genera nuevo access token y retorna `token` + `expiresIn`.

Configuracion de secretos:

- Usa `JWT_REFRESH` o `JWT_SECRET`.
- En no-produccion, si no hay variables, usa un fallback de desarrollo.

Validacion ejecutada:

- Se corrio smoke test de `POST /users/refresh-token` sin cookie y devolvio `401` (resultado esperado).
