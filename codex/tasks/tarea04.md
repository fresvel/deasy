# Listado de actividades

Avance del checklist: `0/18`

Buenas practicas base para esta tarea:
- Usar `Requisitos04.md` como fuente de verdad funcional y tecnica.
- Mantener el refactor incremental, sin reescrituras completas salvo evidencia tecnica clara.
- Validar decisiones de organizacion con el codigo actual del repositorio antes de introducir nuevas abstracciones.
- Registrar decisiones de frontend con Context7 `/vuejs/docs` y decisiones de backend con Context7 `/expressjs/express/v5.1.0` cuando el cambio dependa de APIs o patrones del framework.

0. [ ] Revisar `Requisitos04.md` y convertir este listado en hoja de ruta operativa del refactor general.
1. [ ] Crear un inventario tecnico inicial con los archivos de mayor tamano, duplicaciones visibles y modulos legacy de frontend y backend.
2. [ ] Definir el mapa objetivo de responsabilidades del backend: bootstrap, rutas, controladores, servicios, repositorios, middlewares y modulos de infraestructura.
3. [ ] Refactorizar `backend/index.js` para dejar un entrypoint liviano y extraer configuracion global, Swagger, middlewares y registro de rutas a modulos dedicados.
4. [ ] Diseñar una estrategia comun de manejo de errores HTTP y agregar un middleware central de errores para el backend.
5. [ ] Dividir progresivamente `backend/controllers/users/user_controler.js` por casos de uso o subdominios sin romper contratos HTTP existentes.
6. [ ] Dividir progresivamente `backend/controllers/sign/sign_controller.js`, dejando la logica operativa principal en servicios reutilizables.
7. [ ] Normalizar nombres backend inconsistentes como `*_controler.js`, `*_ctl.js` y revisar el tratamiento correcto de archivos placeholder `Vacio(...)`.
8. [ ] Reducir logging disperso en backend y establecer una politica minima de logs operativos y logs de error.
9. [ ] Definir scripts minimos de calidad del backend y documentar validaciones locales para endpoints refactorizados.
10. [ ] Definir el mapa objetivo de responsabilidades del frontend: vistas shell, componentes base, componentes de seccion, composables y servicios.
11. [ ] Consolidar la capa base de componentes del frontend usando `frontend/src/components` como fuente principal para botones, tablas, modales y primitives compartidas.
12. [ ] Auditar el modulo `admin` para eliminar duplicacion conceptual y dejar wrappers o imports directos solo cuando exista una diferencia funcional real.
13. [ ] Particionar vistas sobredimensionadas como `DashboardHome.vue`, `AdminView.vue` y `AdminTableManager.vue` en subcomponentes y composables con contratos claros.
14. [ ] Unificar la capa HTTP del frontend para evitar llamadas directas desde router u otras zonas transversales cuando ya exista un servicio adecuado.
15. [ ] Refactorizar servicios legacy, especialmente `frontend/src/services/EasymServices.js`, para alinearlos con el patron actual de servicios y estado del proyecto.
16. [ ] Normalizar organizacion de frontend, incluyendo carpetas paralelas como `composable/` y `composables/`, y revisar duplicados entre componentes compartidos y vistas funcionales.
17. [ ] Ejecutar validaciones finales por modulo impactado, incluyendo `cd frontend && pnpm run lint` para cambios de frontend y verificaciones manuales de endpoints backend afectados.

## Context7 Decision Log
- Date: 2026-04-03
  - Library: `/vuejs/docs`
  - Decision: Priorizar la extraccion de logica stateful a composables y mantener las vistas grandes como shells de composicion en lugar de seguir agregando logica directamente en componentes sobredimensionados.
  - Reason: La documentacion oficial de Vue 3 recomienda encapsular logica stateful reutilizable en composables y mantener la composicion con `script setup`, lo que encaja con el estado actual de `AdminView.vue`, `DashboardHome.vue` y `AdminTableManager.vue`.
- Date: 2026-04-03
  - Library: `/expressjs/express/v5.1.0`
  - Decision: Separar el bootstrap del backend en middleware y routers montados por dominio, con manejo de errores centralizado en la composicion de `app`.
  - Reason: La organizacion oficial de Express favorece el montaje de routers y middlewares mediante `app.use()` y `router.use()`, lo que reduce acoplamiento en `backend/index.js` y deja a los controladores con menor responsabilidad transversal.
