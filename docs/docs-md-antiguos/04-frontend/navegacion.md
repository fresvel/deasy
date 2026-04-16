# Frontend - Estructura y Navegación de Archivos (Técnico)

Este documento detalla cómo está organizada la arquitectura del frontend dentro del repositorio, tras la migración a un modelo **Feature-Driven (basado en módulos funcionales)** con el objetivo de promover escalabilidad y orden en las importaciones.

## Arquitectura de Directorios Principales

Todo el entorno de Vue se centraliza en `frontend/src/` y utiliza estandarizadamente el alias `@/` para la navegación interna (declarado en `vite.config.js`). Nunca se utilizan importaciones relativas (el *hell* de `../../`).

### 1. `core/` (Infraestructura Global)
Contiene la configuración vital de arranque y la infraestructura de sistema común que no pertenece a una UI explícita ni a un módulo de negocio particular:
- **`core/router/`**: Configuración de vistas (Rutas registradas: `/`, `/dashboard`, `/perfil`, `/register`, `/firmar`, `/admin`).
- **`core/services/`**: Servicios base y clientes compartidos (aquí transita también toda la gestión del `logged` del dashboard).
- **`core/utils/`**: Utilidades (ej. el setup de la capa de renderizado de PDFjs, validaciones auxiliares o el parser del Token JWT).
- **`core/constants/`**: Mapas y enumeradores estáticos inter-dominios (ej. listados globales pre-compilados).

### 2. `shared/` (Componentes Compartidos / UI Base)
Agrupa todo elemento visual de alto uso. Ninguno de estos componentes debe atar consigo lógicas de base de datos directas.
- **`shared/components/`**: Un UI Kit desglosado funcionalmente en:
  - `buttons/`: Primarios, secundarios y de alertas.
  - `data/`: Componentes agnósticos de Datatables.
  - `forms/`: Inputs enriquecidos.
  - `modals/`: Las conchas o caparazones sin contenido para dialog overlays.
  - `layout/`: Tarjetas navegables.
  - `feedback/`: Etiquetas, semáforos de estado (Tags y Badges).
  - `widgets/`: Herramientas interactivas completas (ej. PDF File Droppers generalizados).

### 3. `layouts/` (Gestor de Plantillas)
Alberga los subcomponentes del chasis ("cascarón") usado en toda la app principal. Se subdividen de forma estricta:
- **`layouts/core/`**: Las envolturas de montura principal (`SBody.vue`, `SNotify.vue`).
- **`layouts/headers/`**: Barras de cabecera (`SHeader.vue`, `AppWorkspaceHeader.vue`).
- **`layouts/menus/`**: Las barras de navegación laterales (`SNavMenu.vue`, `AppWorkspaceSidebar.vue`).

### 4. `modules/` (Patrón Feature-Driven)
El núcleo de la lógica aislada. En lugar de una estructura donde los componentes, vistas y servicios cohabitan por tipo de archivo, conviven por **Dominio de Funcionalidad**. Típicamente constan de sus propios `components/`, `composables/`, `views/` y `services/`.

- **`dashboard/`**: Módulo del espacio de trabajo del usuario que abarca el Panel Operativo, las lógicas de tareas y flujos de "ProcessDefinition".
- **`admin/`**: Dominio masivo de configuraciones y back-office. Dado su peso técnico interno, está fuertemente sub-estructurado también por categorías como `components/modals/`, `components/tables/` o `composables/fk/`.
- **`firmas/`**: Visualización de la bandeja de transacciones con token criptográfico.
- **`dossier/`**: Alojamiento de reportes y subidas documentales al expediente maestro.
- **`perfil/`, `auth/`, y `academia/`**: Dominios atómicos para sesiones, modificaciones de atributos personales e índole educativa.

---

## Patrones Operativos Importantes

### Guard de Autenticación
- El validador en ruta bloquea el acceso utilizando la lógica nativa alojada en las utilidades de `core/`.
- **Rutas Públicas**: `/` (vista de login) y `/register`. Si hay un token válido presente y alguien se direcciona aquí, se le re-conduce inmediatamente a `/dashboard`.
- Si el contexto se invalida (el token expira o la firma falla), las credenciales de storage se purgan y el flujo aterriza al usuario en la pantalla inicial de login.

### Dashboard: Variación de Estado Interno
La ruta maestra `/dashboard` aloja dos flujos interactivos dentro del mismo lienzo (`DashboardHome`):
1. **Estado General:** Resumen neutral del operador; KPI, tarjetas y avisos de estado generalizado.
2. **Estado Operativo Específico:** Se transiciona cuando el usuario interactúa con el menú lateral. El chasis es el mismo pero internamente se inyecta la consola del flujo pertinente, mostrando las "Task User", los "Entregables", las "Firmas" y las dependencias asociadas a esa unidad de negocio particular. 

Todo este panel y lógica de contexto del usuario y del menú se alimenta con los servicios localizados dentro de `core/services/` (anteriormente *UserMenuService* y afines de *"logged"*).
