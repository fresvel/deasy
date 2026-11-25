> ⚠️ **ARCHIVADO — no es fuente de verdad.**
> Este documento describe el sistema tal como era antes de la reorganizacion de `docs/`.
> Puede citar MariaDB, MongoDB, EMQX/MQTT o rutas que ya no existen. Se conserva por su
> valor historico. Para el estado actual, ver el `README.md` de la raiz.

# Frontend - Componentes y servicios (tecnico)

## Componentes base

- Formularios: frontend/src/components/SInput.vue, SSelect.vue, STextarea.vue, SDate.vue, SFile.vue
- Modales: frontend/src/components/ModalPage.vue, ModalHeader.vue
- Acciones: frontend/src/components/BtnEdit.vue, BtnDelete.vue, BtnSera.vue

## Vistas destacadas

- Perfil: frontend/src/sections/perfil/
- Academia: frontend/src/sections/academia/
- Admin: frontend/src/pages/admin/

## Servicios API

- Configuracion de endpoints: frontend/src/services/apiConfig.js
- Cliente principal: frontend/src/services/EasymServices.js
- Servicios adicionales:
  - frontend/src/services/logged/PerfilService.js
  - frontend/src/services/layout/LayoutService.js

## Auth y token

- Utilidades JWT: frontend/src/utils/tokenUtils.js
- Token guardado en localStorage (clave: token)
