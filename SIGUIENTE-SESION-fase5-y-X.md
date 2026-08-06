# Prompt para la siguiente sesión — Fases 5 y X del refactor del FRONTEND

> Copia el bloque de abajo como primer mensaje de una sesión nueva de Claude Code.
> Contexto: continúa el refactor del frontend descrito en `docs/plan-refactor-frontend.md`.
> Las fases 0 a 4.2 están hechas y commiteadas en `develop`, y también la **3.5** (admin → subrutas).
>
> **Track distinto del backend.** Para bajar complejidad en el backend (God Objects, registro de
> hooks, Sonar) el handoff es `SIGUIENTE-SESION-complejidad-backend.md`. No los mezcles.
>
> **Verificado el 2026-08-06 de que esto sigue vigente**: los dos `@layer components` en conflicto
> siguen ahí (`.deasy-card` en :329, `.deasy-btn--primary` en :570), `AdminModalShell` y
> `AdminDataTable` siguen existiendo, y los tokens `--brand-*` siguen duplicados en `theme.css`.
> La **fase 5 se redujo de alcance** — lee la corrección dentro del prompt.

---

```
Continúo el refactor del frontend de Deasy (Vue 3 + Vite, dockerizado). El plan completo y el
estado de cada fase están en docs/plan-refactor-frontend.md — léelo primero. Las fases 0 a 4.2
están hechas y commiteadas en `develop`; ahora quiero las fases 5 y X.

FASE 5 — useProcessPanels posee su estado. (OJO: el alcance de esta fase se REDUJO, lee esto.)
El plan original decía que `useDeliverableView.js` (~964 L) era un "Middle Man" que recibía 9 refs
de HomeView y LOS MUTABA. Eso se midió después y es FALSO: tiene CERO asignaciones `.value =` (se
puede reverificar con `grep -cE '^\s*[a-zA-Z_.]+\.value\s*=' useDeliverableView.js` → 0). Es una
proyección/derivación READ-ONLY legítima; su "cero estado propio" es la forma correcta, no un smell.
Los refs que recibe son estado transversal aguas-arriba (identidad, unidades, proceso abierto)
compartido con otras piezas: hacer que los "posea" INVERTIRÍA el acoplamiento en vez de reducirlo.
Está documentado en docs/auditoria-god-objects-2026-07.md §6. NO lo conviertas en dueño de su estado.
Lo único que sí son candidatos genuinos ahí son dos refs sueltos (`deliverableWorkspaceState` y
`startedDeliverableIds`) a un pequeño `useDeliverableWorkspace` — Move Field, no rediseño.

Lo que SÍ sigue en pie es `useProcessPanels.js` (155 L): ese sí muta refs ajenos (28 asignaciones
`.value =`), y ese sí debe pasar a poseer su estado. El patrón bueno a imitar:
useDeliverableFilePreview, useDocumentCenter y useDossierSection.

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
