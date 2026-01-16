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

