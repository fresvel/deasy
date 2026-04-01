# Homologacion UI Frontend

Estado general: `13/13` hecho

## Checklist

- [x] 1. Inventario y mapeo visual
- [x] 2. Sistema global en Tailwind
- [x] 3. Botones globales
- [x] 4. Inputs, tags y adopcion real de componentes globales
- [x] 5. Tablas globales
- [x] 6. Menus y layout navigation
- [x] 7. Modales globales
- [x] 8. Drag & drop de archivos
- [x] 9. Contenedores y encabezados globales
- [x] 10. Migracion y validacion por vistas
- [x] 11. Segunda pasada de revision del punto 6
- [x] 12. Revision y homologacion final de tags
- [x] 13. Generalizar menus de los layouts

## Punto 1. Inventario y mapeo visual

### Fuentes de verdad visual

| Pieza | Fuente visual aprobada | Base actual | Destino esperado |
| --- | --- | --- | --- |
| Tablas | `perfil` | `ProfileTableBlock.vue` y tablas internas de vistas de perfil | Componente global reutilizable en `perfil`, `dashboard`, `admin` y modales |
| Botones | `admin` | `AdminButton.vue` | Componente global con variantes por clase |
| Menus de layout | `firmas` | Menus laterales en `PerfilView.vue`, `DashboardHome.vue`, `AdminView.vue` y `SNavMenu.vue` | Patron unico de navegacion lateral y contextual |
| Tags | `register` | Tag tipo alerta/ayuda como `Requerido (*Haz click en el mapa*)` | Componente global por variantes, conservando colores |
| Files drag & drop | `firmas` | `PdfDropField.vue` | Componente global para subida de archivos |
| Inputs texto/password | `login` | inputs nativos en `LoginView.vue` y `RecoverPasswordView.vue` | Componente global para campos base |
| Contenedores/sections | `perfil` | `ProfileSectionShell.vue`, `ProfileHomePanel.vue` | Patron global de card, section y shell |
| Encabezados de pagina | `perfil` | `ProfileHomePanel.vue`, `AppPageIntro.vue` | Patron global de intro/hero sobrio y consistente |

### Componentes candidatos a globalizar

| Componente actual | Rol actual | Decision |
| --- | --- | --- |
| `frontend/src/views/admin/components/AdminButton.vue` | Boton con variantes funcionales | Reutilizar como base y mover a capa global |
| `frontend/src/components/PdfDropField.vue` | Dropzone con variantes `card`, `inline`, `compact` | Reutilizar como base global |
| `frontend/src/views/perfil/components/ProfileSectionShell.vue` | Shell de seccion con header y CTA | Reutilizar patron visual para sections |
| `frontend/src/views/perfil/components/ProfileTableBlock.vue` | Wrapper de tabla con header | Reutilizar patron visual para tablas |
| `frontend/src/components/AppPageIntro.vue` | Intro de pagina | Ajustar para alinearlo al estilo de `perfil` |
| `frontend/src/components/AppTag.vue` | Tag base sin sistema visual consolidado | Completar con variantes globales |
| `frontend/src/components/SInput.vue` | Input base heredado | Refactorizar al estilo de `login` |

### Hallazgos por vista

#### `dashboard`

- Mezcla hero propia con gradiente, cards propias, tabla propia y botones inline en la misma vista.
- La bienvenida actual no sigue el patron informativo de `perfil`.
- Tiene una tabla desktop embebida que debe migrar al futuro componente global de tablas.
- Tiene multiples botones hardcodeados con radios, paddings y estados distintos.

Archivos principales:

- `frontend/src/views/dashboard/DashboardHome.vue`

#### `perfil`

- Ya contiene el patron mas consistente para cards, headers de seccion y tablas.
- `ProfileHomePanel.vue` sirve como referencia para intro de usuario, tono visual y contenedores.
- `ProfileSectionShell.vue` y `ProfileTableBlock.vue` son la mejor base actual para estandarizacion.

Archivos principales:

- `frontend/src/views/perfil/PerfilView.vue`
- `frontend/src/views/perfil/components/ProfileHomePanel.vue`
- `frontend/src/views/perfil/components/ProfileSectionShell.vue`
- `frontend/src/views/perfil/components/ProfileTableBlock.vue`

#### `admin`

- Tiene el sistema de botones mas avanzado y reutilizable.
- El layout lateral usa una sintaxis visual cercana a `perfil` y `dashboard`, pero no comparte clases globales.
- Sus cards de home y tablas usan estilos propios que luego deberan converger.

Archivos principales:

- `frontend/src/views/admin/AdminView.vue`
- `frontend/src/views/admin/components/AdminButton.vue`
- `frontend/src/views/admin/components/AdminDataTable.vue`
- `frontend/src/views/admin/components/AdminTableManager.vue`

#### `firmas`

- Es la referencia aprobada para menus visuales y drag & drop.
- `PdfDropField.vue` ya encapsula la mayor parte del comportamiento de archivos.
- `FirmarPdf.vue` y `MultiSignerPanel.vue` contienen varios wrappers y controles que hoy replican estilos de forma local.

Archivos principales:

- `frontend/src/views/funciones/FirmarPdf.vue`
- `frontend/src/views/funciones/MultiSignerPanel.vue`
- `frontend/src/components/PdfDropField.vue`

#### `login`

- Es la referencia aprobada para inputs de texto y password.
- Los estilos de campos estan hardcodeados en la vista; aun no existe un componente base equivalente.
- Tambien aporta el lenguaje visual de etiquetas auxiliares y mensajes de apoyo.

Archivos principales:

- `frontend/src/views/auth/LoginView.vue`
- `frontend/src/views/auth/RecoverPasswordView.vue`

#### `register`

- Es la referencia aprobada para tags auxiliares tipo alerta/indicacion.
- El patron a preservar es el tag visual `Requerido (*Haz click en el mapa*)`, con icono, fondo suave, borde visible, tipografia compacta y colores actuales por variante.
- La globalizacion debe conservar el lenguaje visual del tag, pero permitir variantes por clase sin perder sus colores semanticos.

Archivos principales:

- `frontend/src/views/auth/RegisterView.vue`

### Duplicaciones detectadas

- Botones con clases inline en `DashboardHome.vue`, `FirmarPdf.vue` y `MultiSignerPanel.vue`.
- Tablas embebidas en `DashboardHome.vue` y `admin` con wrappers distintos.
- Contenedores blancos con `rounded-2xl` o `rounded-[1.5rem]` repetidos en varias vistas.
- Menus laterales implementados por vista sin compartir una API visual unica.
- Inputs base duplicados entre `LoginView.vue`, `RecoverPasswordView.vue` y `SInput.vue`.

### Archivos prioritarios para la migracion

1. `frontend/src/styles/tailwind.css`
2. `frontend/src/components/SInput.vue`
3. `frontend/src/components/AppTag.vue`
4. `frontend/src/components/PdfDropField.vue`
5. `frontend/src/components/AppPageIntro.vue`
6. `frontend/src/views/admin/components/AdminButton.vue`
7. `frontend/src/views/perfil/components/ProfileSectionShell.vue`
8. `frontend/src/views/perfil/components/ProfileTableBlock.vue`
9. `frontend/src/views/dashboard/DashboardHome.vue`
10. `frontend/src/views/admin/AdminView.vue`
11. `frontend/src/views/perfil/PerfilView.vue`
12. `frontend/src/views/funciones/FirmarPdf.vue`

### Criterio de cierre del punto 1

- Quedo definido el origen visual de cada familia de componentes.
- Quedaron identificados los componentes base que pueden refactorizarse en lugar de recrearlos.
- Quedo delimitado el conjunto inicial de archivos a intervenir en los siguientes puntos.

## Punto 2. Sistema global en Tailwind

### Implementado

- Se creo una capa semantica global en `frontend/src/styles/tailwind.css`.
- Se mantuvo compatibilidad con las clases existentes `deasy-field-*` y helpers de columnas.
- Se agregaron clases globales para superficies, paneles, tipografia, inputs, tags, tablas, navegacion lateral y estados informativos.

### Familias de clases disponibles

| Familia | Clases principales |
| --- | --- |
| Shell y superficies | `deasy-shell`, `deasy-card`, `deasy-card-muted`, `deasy-card-soft`, `deasy-panel`, `deasy-panel-muted` |
| Tipografia | `deasy-heading-hero`, `deasy-heading-section`, `deasy-heading-card`, `deasy-text-body`, `deasy-text-muted`, `deasy-text-caption` |
| Formularios | `deasy-field-label`, `deasy-field-input`, `deasy-field-select`, `deasy-field-textarea`, modificadores `--icon-left`, `--icon-right`, `--error` |
| Mensajes de campo | `deasy-field-message`, `deasy-field-message--error` |
| Tags | `deasy-tag`, `deasy-tag__icon`, variantes `--danger`, `--success`, `--warning`, `--info`, `--neutral` |
| Intro de pagina | `deasy-page-intro` y sus elementos `__layout`, `__body`, `__title`, `__meta`, `__description` |
| Tablas | `deasy-table-shell`, `deasy-table-header`, `deasy-table-title`, `deasy-table-responsive`, `deasy-table` |
| Navegacion | `deasy-nav-shell`, `deasy-nav-group`, `deasy-nav-group-title`, `deasy-nav-item`, `deasy-nav-item--active`, `deasy-nav-item--subtle-active` |
| Estados | `deasy-state-info`, `deasy-state-success`, `deasy-state-warning`, `deasy-state-danger` |

### Alcance del punto 2

- Este punto deja lista la infraestructura visual global.
- Aun no se migra markup de vistas ni componentes; eso se hace desde el punto 3 en adelante.
- Los siguientes puntos deben consumir estas clases en vez de seguir agregando estilos inline o locales.

## Punto 3. Botones globales

### Implementado

- Se creo el componente global `frontend/src/components/AppButton.vue`.
- Se agrego la familia semantica `deasy-btn*` en `frontend/src/styles/tailwind.css`.
- Se mantuvo compatibilidad con clases heredadas `admin-btn*` y con casos especiales como `person-assignment-menu-btn`.
- Los wrappers genericos `BtnEdit.vue` y `BtnDelete.vue` ya consumen `AppButton` directamente.
- La dependencia intermedia `frontend/src/views/admin/components/AdminButton.vue` fue eliminada y los consumos migraron a import directo de `AppButton`.

### Variantes disponibles

| Variante | Uso |
| --- | --- |
| `primary` | Accion principal |
| `secondary` | Accion secundaria neutral |
| `cancel` | Cancelacion suave |
| `outlinePrimary` | Accion secundaria destacada |
| `outlineDanger` | Accion destructiva secundaria |
| `success` | Confirmacion positiva |
| `danger` | Accion destructiva principal |
| `close` | Boton circular de cierre |
| `menu` | Selector tipo pills para submenus |
| `plain` | Boton sin skin para casos especiales |

### Tamaños disponibles

- `sm`
- `md`
- `lg`
- `iconOnly`

### Validacion

- Se ejecuto `pnpm run lint` en `frontend`.
- El comando falla por errores preexistentes en `frontend/FronTemplate/vue-material-dashboard`, no por los archivos modificados en este punto.

## Ajustes posteriores al punto 3

- [x] 4.1 Revisar que todos los botones visibles en `perfil`, `dashboard` y `admin` usen los componentes globales creados, sin estilos hardcodeados equivalentes.
- [x] 4.2 Eliminar la dependencia wrapper de `frontend/src/views/admin/components/AdminButton.vue` y migrar consumos directos a `frontend/src/components/AppButton.vue`.

## Punto 10. Migracion y validacion por vistas

### Implementado

- Se completo la adopcion de componentes globales en las vistas objetivo activas: `perfil`, `dashboard`, `admin`, `firmas` y `auth`.
- Se creo `frontend/src/components/DossierDocumentUploadModal.vue` para unificar la carga de documentos de respaldo del dossier.
- Se eliminaron los `input type="file"` ocultos que quedaban en las vistas de `perfil` y se migraron a modal global + `PdfDropField`.

### Vistas cerradas en esta pasada

- `frontend/src/views/perfil/TitulosView.vue`
- `frontend/src/views/perfil/LaboralView.vue`
- `frontend/src/views/perfil/ReferenciasView.vue`
- `frontend/src/views/perfil/InvestigacionView.vue`
- `frontend/src/views/perfil/CertificacionView.vue`
- `frontend/src/views/perfil/CapacitaciónView.vue`

### Validacion

- `pnpm exec eslint` paso sobre `src/views/perfil`, `src/views/dashboard`, `src/views/admin`, `src/views/funciones`, `src/views/auth`, `src/components` y `src/layouts`.
- Se hizo un barrido final de `type="file"` en `perfil`; ya no quedan entradas ocultas residuales fuera de `PdfDropField`.

## Punto 5. Tablas globales

### Implementado

- Se creo el componente global `frontend/src/components/AppDataTable.vue`.
- `frontend/src/views/perfil/components/ProfileTableBlock.vue` ya consume la capa semantica global de tablas (`deasy-table-shell`, `deasy-table-header`, `deasy-table-title`, `deasy-table-responsive`).
- `frontend/src/views/dashboard/DashboardHome.vue` dejo de usar una tabla inline para el resumen desktop y ahora consume `AppDataTable`.
- La dependencia intermedia `frontend/src/views/admin/components/AdminDataTable.vue` fue eliminada y los consumos migraron a import directo del componente global.

### Alcance actual

- `admin` mantiene compatibilidad funcional sin reescribir todos sus slots ni modales.
- `perfil` ya queda alineado en shell y wrapper de tabla con el sistema global.
- `dashboard` ya usa la tabla global en su caso visible principal.

### Validacion

- Se ejecuto `eslint` sobre `AppDataTable.vue`, `ProfileTableBlock.vue`, `DashboardHome.vue` y los componentes administrativos que consumen la tabla global.
- La validacion paso sin errores.

## Punto 6. Menus y layout navigation

### Implementado

- Se extendio la capa global en `frontend/src/styles/tailwind.css` con clases reutilizables para navegacion de layout: chips superiores, acciones de header, feedback lateral y arboles de submenu.
- `frontend/src/layouts/SNavMenu.vue` dejo de usar CSS `scoped` local y ahora consume la piel global `deasy-nav-*`.
- `frontend/src/layouts/AppWorkspaceHeader.vue` unifico los tabs superiores y las acciones de cabecera sobre la misma declaracion global.
- `frontend/src/views/perfil/PerfilView.vue`, `frontend/src/views/dashboard/DashboardHome.vue` y `frontend/src/views/admin/AdminView.vue` migraron sus sidebars y menus contextuales a la misma familia visual.

### Alcance actual

- El menu lateral, los submenus colapsables y los tabs superiores ya comparten bordes, radios, estados activos, espaciado, tipografia y feedback.
- La navegacion movil de `dashboard` via `SNavMenu` ya no depende de estilos aislados del componente.
- No se introdujeron wrappers nuevos; la migracion se hizo con imports y clases globales directas.

### Validacion

- Se ejecuto `pnpm exec eslint` sobre `SNavMenu.vue`, `AppWorkspaceHeader.vue`, `PerfilView.vue`, `DashboardHome.vue` y `AdminView.vue`.
- La validacion paso sin errores.

## Punto 7. Modales globales

### Implementado

- Se creo `frontend/src/components/AppModalShell.vue` como shell global reutilizable para modales controlados por `Modal` y modales reactivos por estado.
- Se creo `frontend/src/components/AppFormModalLayout.vue` para formularios modales de `perfil`, reemplazando la antigua base local.
- Los consumos previos de `AdminModalShell` migraron a import directo del componente global y la implementacion antigua fue eliminada.
- Los formularios modales de `perfil` (`titulos`, `laboral`, `referencias`, `investigacion`, `certificacion`, `capacitacion`) ahora abren dentro de `AppModalShell`.
- Se migraron tambien modales inline visibles de `dashboard`, `register`, `session`, `FirmarPdf`, `MemorandumView` y confirmaciones de borrado en `perfil`.

### Alcance actual

- La shell visual de modal ya comparte overlay, panel, header, footer, boton de cierre y jerarquia tipografica entre `admin`, `perfil`, `dashboard`, `firmas`, `register` y `session`.
- La mayor parte de modales del sistema ya usa componente global directo en lugar de declaracion HTML repetida.
- Quedan algunos modales de pagina con contenido muy especifico que ya consumen la shell global pero mantienen cuerpo propio por necesidad funcional.

### Validacion

- Se ejecuto `pnpm exec eslint` sobre `AppModalShell.vue`, `AppFormModalLayout.vue`, `SessionExpiryModal.vue`, `RegisterView.vue`, `DashboardHome.vue`, `MemorandumView.vue`, `FirmarPdf.vue`, las vistas de `perfil` con modales y los formularios `Agregar*`.
- La validacion paso sin errores.

## Punto 8. Drag & drop de archivos

### Implementado

- Se consolido el patron de carga de archivos en `frontend/src/components/PdfDropField.vue`.
- La piel visual del dropzone se movio a clases globales de `frontend/src/styles/tailwind.css` bajo la familia `deasy-dropzone*`.
- `FirmarPdf.vue`, `MultiSignerPanel.vue`, `UserCertificatesPanel.vue` y los formularios modales de `perfil` ya consumen la misma declaracion global.
- `frontend/src/views/admin/components/AdminDraftArtifactModal.vue` dejo de tener dropzones propios y ahora usa `PdfDropField` en sus cuatro cargas de archivos.
- Se elimino `frontend/src/components/SFile.vue`, ya que no tenia consumos y duplicaba el mismo patron con otra implementacion.

### Alcance actual

- El drag & drop comparte radios, borde dashed, estados `hover/active/disabled`, tipografia, bloque de archivo seleccionado y espaciado entre `firmas`, `perfil`, `admin` y certificados.
- El comportamiento de click y drop queda centralizado en un solo componente.
- `admin` conserva su logica de tipos de archivo por canal (`pdf`, `docx`, `xlsx`, `pptx`), pero ahora sobre la misma base visual global.

### Validacion

- Se ejecuto `pnpm exec eslint` sobre `PdfDropField.vue`, `AdminDraftArtifactModal.vue`, `UserCertificatesPanel.vue`, `FirmarPdf.vue`, `MultiSignerPanel.vue` y los formularios `Agregar*` de `perfil`.
- La validacion paso sin errores.
