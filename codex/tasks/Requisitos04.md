# Refactor general de frontend y backend

## Objetivo

Definir una hoja de ruta de refactor incremental para `frontend/` y `backend/`
que permita mejorar organización, mantenibilidad, separación de
responsabilidades y reutilización, respetando la arquitectura actual del
repositorio y las reglas establecidas en `AGENTS.md`.

El objetivo no es reescribir el sistema, sino ordenar primero los puntos de
mayor impacto para que la evolución futura sea más segura, predecible y fácil
de revisar.

## Diagnóstico resumido

### Backend

- El backend tiene puntos de entrada y controladores con exceso de
  responsabilidad.
- Existen inconsistencias de nombres y archivos legacy que hacen más difícil
  ubicar responsabilidades reales.
- Falta una base mínima homogénea de validación, manejo de errores,
  observabilidad y calidad de código.

### Frontend

- El frontend ya tiene una base reusable en `frontend/src/components`, pero
  todavía convive con componentes y patrones locales del módulo `admin` que
  generan duplicación conceptual.
- Existen vistas demasiado grandes que concentran presentación, estado,
  flujos y orquestación de servicios en un solo archivo.
- La capa de servicios y utilidades aún no está completamente unificada, por lo
  que parte de la lógica HTTP y de sesión sigue dispersa.

## Evidencia observada en el código

### Backend

- `backend/index.js` tiene `1238` líneas y mezcla bootstrap, configuración
  CORS, Swagger, conexión a bases, inicialización de esquema y montaje de rutas.
- `backend/controllers/users/user_controler.js` tiene `2021` líneas y concentra
  demasiadas responsabilidades de usuario.
- `backend/controllers/sign/sign_controller.js` tiene `624` líneas y mantiene
  mucha lógica operativa dentro del controlador.
- Persisten nombres inconsistentes como `*_controler.js`, `*_ctl.js` y archivos
  placeholder `Vacio(...)`.
- Hay residuos operativos y de depuración distribuidos en controladores,
  middlewares, modelos y servicios mediante `console.log`.
- `backend/package.json` no define scripts de calidad como `test`, `lint` o
  validaciones dirigidas.

### Frontend

- `frontend/src/views/dashboard/DashboardHome.vue` tiene `2717` líneas.
- `frontend/src/views/admin/components/AdminTableManager.vue` tiene `2541`
  líneas.
- `frontend/src/views/admin/AdminView.vue` tiene `1299` líneas.
- Conviven `frontend/src/components/AppButton.vue`,
  `frontend/src/components/AppDataTable.vue` y
  `frontend/src/components/AppModalShell.vue` con equivalentes históricos en
  `frontend/src/views/admin/components/`, aunque parte del módulo `admin` ya
  importa la capa base.
- Existen rutas de organización inconsistentes como `frontend/src/composable/`
  y `frontend/src/composables/`.
- La navegación y autenticación aún tienen lógica HTTP directa en
  `frontend/src/router/index.js`.
- `frontend/src/services/EasymServices.js` conserva estado mutable interno,
  logging de depuración y responsabilidades mezcladas.

## Requerimientos de refactor

### 1. Principio de ejecución

- El refactor debe ser incremental, por fases y con validación por módulo.
- No se deben reescribir vistas, controladores o servicios completos si antes
  pueden desacoplarse por extracciones pequeñas.
- Cada fase debe dejar una mejora estructural verificable.

### 2. Backend: bootstrap y composición de aplicación

- Separar el bootstrap del backend en módulos explícitos para:
  - creación de `app`,
  - middlewares globales,
  - documentación Swagger,
  - registro de rutas,
  - inicialización de infraestructura.
- `backend/index.js` debe quedar como entrypoint liviano.
- Centralizar configuración transversal en módulos dedicados, evitando que el
  entrypoint siga acumulando lógica de negocio u operativa.

### 3. Backend: controladores y servicios

- Dividir controladores sobredimensionados por subdominio o caso de uso.
- Mantener los controladores como capa delgada:
  - reciben request,
  - validan entrada HTTP,
  - invocan servicios,
  - traducen respuesta o error.
- Mover la lógica operativa compleja a servicios ya existentes o nuevos
  servicios internos cuando exista reutilización real.
- Normalizar nombres de archivos:
  - `controller`
  - `service`
  - `repository`
  - `middleware`
- Remover o aislar archivos placeholder `Vacio(...)` para que no formen parte
  del flujo productivo normal.

### 4. Backend: errores, validación y observabilidad

- Definir una estrategia homogénea de manejo de errores HTTP.
- Incorporar un middleware central de errores para respuestas consistentes.
- Reducir `console.log` dispersos y reemplazarlos por una política mínima de
  logging estructurado o encapsulado.
- Revisar validaciones HTTP repetidas para reutilizar middlewares o helpers.
- Documentar verificaciones manuales de los endpoints refactorizados cuando no
  exista prueba automatizada.

### 5. Backend: calidad mínima del módulo

- Incorporar scripts de calidad mínimos al backend.
- Definir al menos:
  - verificación dirigida de sintaxis o smoke tests,
  - estrategia gradual de tests para servicios críticos,
  - validación local de endpoints impactados.
- Priorizar cobertura inicial sobre:
  - autenticación,
  - panel/admin SQL,
  - firma,
  - dossier.

### 6. Frontend: consolidación de componentes base

- Tratar `frontend/src/components` como fuente principal de primitives
  compartidas.
- Eliminar duplicación conceptual en `admin` cuando ya exista un componente base
  equivalente.
- Si un componente de `admin` solo agrega estilo o composición menor, debe
  evaluarse:
  - migrarlo a wrapper legítimo,
  - o reemplazarlo por el componente base.
- No deben coexistir dos APIs públicas diferentes para botones, tablas y
  modales sin una razón funcional clara.

### 7. Frontend: vistas y composables

- Dividir vistas grandes en:
  - shells de presentación,
  - paneles especializados,
  - composables de flujo,
  - servicios de acceso a datos.
- Mantener en las vistas solo la composición de alto nivel.
- Extraer lógica stateful real a composables con contrato claro y nombre `use*`.
- Evitar mover lógica puramente estática o helpers triviales a composables si no
  existe reutilización o acoplamiento con ciclo de vida.

### 8. Frontend: capa HTTP, sesión y router

- Evitar llamadas HTTP directas dentro del router cuando ya existe una capa de
  servicios.
- Unificar autenticación, sesión, refresh y logout bajo servicios o composables
  explícitos.
- Centralizar manejo de errores HTTP recurrentes y configuración compartida de
  cliente API.
- Revisar servicios legacy como `EasymServices.js` y llevarlos al patrón actual
  del proyecto.

### 9. Frontend: consistencia de organización

- Normalizar directorios y nombres para evitar carpetas paralelas equivalentes.
- Revisar componentes repetidos entre `src/components/` y `src/views/funciones/`
  cuando el mismo caso de uso ya tenga versión compartida.
- Alinear imports para que los módulos nuevos consuman primero la capa reusable.

### 10. Documentación técnica mínima

- Documentar el mapa objetivo de responsabilidades de frontend y backend antes
  de iniciar refactors grandes.
- Registrar decisiones de arquitectura pequeñas cuando cambien:
  - entrypoints,
  - contratos internos,
  - organización de carpetas,
  - estrategia de errores,
  - componentes base.

## Buenas prácticas validadas

### Vue 3

Validado con Context7 `/vuejs/docs`:

- Extraer lógica stateful a composables cuando la lógica necesite reutilización
  o separación clara de responsabilidades.
- Mantener componentes enfocados y componer comportamiento mediante
  `composables`, no por herencia.
- Usar `script setup` como punto natural para consumir composables y mantener la
  composición de la vista limpia.

### Express 5

Validado con Context7 `/expressjs/express/v5.1.0`:

- Organizar middleware y routers mediante `app.use()` y `router.use()` como
  unidades composables.
- Centralizar la precedencia de middleware y manejo de errores en la composición
  de la aplicación, en lugar de dispersarlo en controladores.
- Mantener routers montados por dominio para reducir acoplamiento en el
  entrypoint.

## Criterios de aceptación de la hoja de ruta

- Existe una tarea formal de refactor con checklist ejecutable.
- La tarea separa frontend y backend en frentes de trabajo concretos.
- Cada actividad queda orientada a cambios incrementales y verificables.
- La hoja de ruta prioriza reutilización de componentes, servicios y patrones ya
  existentes.
- La propuesta no contradice la arquitectura vigente del repositorio.
