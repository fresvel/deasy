# Prompt para la siguiente sesión — Fases 5 y X del refactor del frontend

> Copia el bloque de abajo como primer mensaje de una sesión nueva de Claude Code.
> Contexto: continúa el refactor del frontend descrito en `docs/plan-refactor-frontend.md`.
> Las fases 0 a 4.2 están hechas y commiteadas en `develop` (17 commits, de 2 a 218 tests).

---

```
Continúo el refactor del frontend de Deasy (Vue 3 + Vite, dockerizado). El plan completo y el
estado de cada fase están en docs/plan-refactor-frontend.md — léelo primero. Las fases 0 a 4.2
están hechas y commiteadas en `develop`; ahora quiero las fases 5 y X.

FASE 5 — useDeliverableView posee su estado.
`modules/home/composables/useDeliverableView.js` (~964 L) es el "Middle Man" que la auditoría
señaló: recibe 9 refs de HomeView y los muta, cero estado propio. Es el acoplamiento de fondo de
HomeView. El objetivo es que POSEA su estado (crear los refs dentro y devolverlos), como ya se hizo
tres veces esta serie: useDeliverableFilePreview, useDocumentCenter y useDossierSection son el patrón
bueno a imitar. useProcessPanels.js (155 L, 0 refs propios) es el mismo problema, más pequeño, y
puede ir en el mismo lote. HomeView ya sirve una sola ruta (/home) tras la fase 3, así que es el
momento. Cuidado: el propio useDeliverableView.js:24-27 documenta por qué NO se hizo puro en su día
(53 call sites) — hay que mover el estado sin romper esos call sites, un paso cada vez.

FASE X — sistema de diseño (BLOQUEANTE de los hardcodes; hacer ANTES de migrar colores).
No migres los ~1269 valores hardcodeados todavía. Primero hay que arreglar el sistema, o se
re-codifica el conflicto en 1269 sitios. En orden:
1. shared/styles/tailwind.css tiene DOS `@layer components` que redefinen ~24 selectores en conflicto
   (.deasy-card en :329 y :1349, .deasy-btn--primary en :570 y :1381 donde el gradiente muere).
   Fusionarlos.
2. Colapsar los dos juegos de tokens redundantes: --deasy-* (tailwind.css) y --brand-* (theme.css)
   son el mismo valor (--deasy-primary y --brand-primary son ambos #5e4eff).
3. Terminar la homologación de 85653b0: borrar AdminModalShell (21 consumidores) y AdminDataTable
   (11), que son forks vivos de AppModalShell/AppDataTable; migrar sus consumidores. Eso elimina el
   doble emisor de clases de AppButton.vue:66-93 (emite deasy-btn--X Y admin-btn--X en cada botón).
4. SOLO ENTONCES, migrar módulos a los tokens.

CÓMO TRABAJO EN ESTE REPO (mantén estas convenciones):
- Builds/tests/lint SIEMPRE dentro de los contenedores:
  `bash scripts/docker-env.sh dev exec -T frontend pnpm run lint` (y `test:unit`). El stack dev ya
  suele estar levantado. Instalar deps del frontend: dentro del contenedor con
  `pnpm add -D --store-dir /pnpm/store <pkg>` (el volumen sombrea node_modules).
- VERIFICA EN EL NAVEGADOR, no sólo con lint/tests. Chrome DevTools MCP contra
  https://localhost:8443. Usuarios: admin cédula 1234567890 / Demo1234!, gestor 0987654321 /
  Gestor1234!, usuario 1122334455 / Demo1234! (este último tiene dossier con datos sembrados en
  cada subsección — útil para perfil). El admin tiene /home y /perfil bloqueados por el router.
  Guarda el token en localStorage tras login por fetch para sesión estable; ojo con el
  SessionExpiryModal si la sesión lleva rato.
- Tests con DIENTES: cada test nuevo, verifícalo por mutación (rompe el código a propósito, confirma
  que el test falla). Hay 218 tests; algunos son "marcadores" que DEBEN romperse cuando ocurre el
  refactor que vigilan — reescríbelos a propósito, no los silencies.
- Refactor = mover código, NO reescribir comportamiento. No injertes casos especiales en código
  genérico (es el olor de AdminTableManager). Si algo no encaja limpio, generaliza de forma
  retrocompatible o déjalo aparte y dilo.
- Commits pequeños por fase, en develop, con el detalle de qué se verificó. Actualiza
  docs/plan-refactor-frontend.md al cerrar cada fase.
- Bajo vitest 4, jsdom expone window.localStorage vacío: los tests instalan un stub propio (ver
  core/router/index.test.js).

Empieza por la Fase 5 (es la que desbloquea de verdad HomeView) salvo que veas mejor orden.
Antes de escribir código, mide el estado real y proponme el plan de ataque.
```

---

## Contexto extra (para ti, no hace falta pegarlo)

- **Deuda menor pendiente**: varios `Agregar*.vue` montan `SSelect`/`SInput` sin pasar `label`/`placeholder`
  (props requeridas) → warnings de Vue en consola. No rompen nada; barrido aparte.
- **Datos sembrados**: el usuario `1122334455` tiene un registro editable en la subpestaña por defecto de
  cada sección del dossier (se sembraron vía API para verificar la fase 4.2). No molestan.
- **Estado al cierre de esta sesión**: `HomeView` sirve una sola ruta; el dossier tiene URLs propias
  (`/perfil/<seccion>`); las 6 secciones del dossier comparten `DossierSectionCrud` + `useDossierSection`
  (−1061 L). El guard del admin usa `meta.blockedForAdmin` (heredado a las rutas hijas).
