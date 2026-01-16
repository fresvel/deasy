# Frontend - Componentes y servicios (tecnico)

## Componentes base

- Formularios: frontend/src/components/SInput.vue, SSelect.vue, STextarea.vue, SDate.vue, SFile.vue
- Modales: frontend/src/components/ModalPage.vue, ModalHeader.vue
- Acciones: frontend/src/components/BtnEdit.vue, BtnDelete.vue, BtnSera.vue

## Vistas destacadas

- Perfil: frontend/src/sections/perfil/
- Academia: frontend/src/sections/academia/
- Informes: frontend/src/views/logged/informes/WebTemplate.vue
- Admin: frontend/src/pages/admin/

## Servicios API

- Configuracion de endpoints: frontend/src/services/apiConfig.js
- Cliente principal: frontend/src/services/EasymServices.js
- Servicios adicionales:
  - frontend/src/services/TemplateService.js
  - frontend/src/services/logged/PerfilService.js
  - frontend/src/services/layout/LayoutService.js

## Auth y token

- Utilidades JWT: frontend/src/utils/tokenUtils.js
- Token guardado en localStorage (clave: token)

