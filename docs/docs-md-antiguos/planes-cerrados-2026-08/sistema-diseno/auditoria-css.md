# Auditoría del CSS — 2026-08-09

Medido sobre `develop` en `d332619`. Las cifras que cambian con cada escaneo de Sonar **no se replican
aquí** (regla 2 del [README de planes](../README.md)): viven en
[`referencia/calidad-y-medicion.md`](../../../planes/referencia/calidad-y-medicion.md). Lo que hay aquí son conteos
sobre el árbol, reproducibles con `grep`.

---

## 1. Cómo está montado

Tailwind **v4.2.2** vía `@tailwindcss/vite` (`frontend/vite.config.js:3,14`). **No existe
`tailwind.config.js` ni `postcss.config.*` en todo el repo** — configuración v4 *CSS-first*. Todo el
CSS entra por `frontend/src/main.js:6-7`.

| Fichero | Líneas | Qué es |
|---|---|---|
| `frontend/src/shared/styles/tailwind.css` | 1 479 | `@layer base/components/utilities`, 262 `@apply`, ~270 clases `.deasy-*` |
| `frontend/src/shared/styles/theme.css` | 1 914 | CSS **plano**, paleta `--brand-*`, ~305 selectores, **103 `!important`** |
| `frontend/src/modules/admin/components/tables/AdminTableManager.css` | 604 | Estilo local, cargado `scoped` |

Son los **únicos tres `.css` del frontend**. En todo el repo hay un cuarto (`docs/src/styles/global.css`,
andamiaje de Astro) y **cero** `.scss`/`.sass`/`.less`.

## 2. El problema estructural: la cascada está invertida

`tailwind.css` mete todo en `@layer`. `theme.css` declara **sin capa** y con 103 `!important`. En CSS,
**lo no-capado gana siempre a lo capado**, con independencia del orden de importación. Consecuencia:
buena parte de las ~270 definiciones `@apply` de `tailwind.css` son decorativas.

Prueba reproducible — los 6 `.deasy-dialog-*` están definidos **dos veces** y siempre pinta `theme.css`:

| Clase | `tailwind.css` | `theme.css` (gana) |
|---|---|---|
| `.deasy-dialog-root` | 1446 | 1191 `!important` |
| `.deasy-dialog-panel` | 1450 | 1200 `!important` |
| `.deasy-dialog-header` | 1454 | 1208 `!important` |
| `.deasy-dialog-title` | 1458 | 1215 `!important` |
| `.deasy-dialog-body` | 1462 | 1223 `!important` |
| `.deasy-dialog-footer` | 1466 | 1231 `!important` |

Lo mismo con `body`: `tailwind.css:55-57` fija `--deasy-text-body` (`#3f4254`); `theme.css:89-96` fija
`--brand-navy` (`#111827`). El token `--deasy-text-body` **no llega a pintar el `body`**.

## 3. Colisiones de namespace con Tailwind v4

Barrido exhaustivo de `:root` en `src/`: hay **9 declaraciones** que pisan un namespace de Tailwind,
todas en `theme.css:43-53`. **No hay ninguna `--color-*`, `--spacing-*`, `--shadow-*`, `--text-*`,
`--breakpoint-*`.** El daño está acotado a los radios.

| Utilidad | Valor Tailwind | Valor efectivo | Usos en `.vue` |
|---|---|---|---|
| `rounded-lg` | 0.5rem (8px) | **16px** | 173 |
| `rounded-md` | 0.375rem (6px) | **12px** | 52 |
| `rounded-sm` | 0.25rem (4px) | **8px** | 2 |

La escala queda **no monótona**: `rounded-lg` (16px) **>** `rounded-xl` (12px), y `rounded-lg` =
`rounded-2xl`. A cambio de esto, `var(--radius-*)` tiene **4 consumidores** en todo el proyecto.

`--font-weight-medium: 500` y `--font-weight-semibold: 600` (`theme.css:52-53`) también pisan el
namespace, pero **coinciden con los valores por defecto**: hoy son inocuos, mañana son una trampa.

Añádase `tailwind.css:1476`, que **redefine `.shadow-xl` con `!important`** — 11 usos con la sombra
cambiada en silencio; y `.rounded-4xl` (`:1472`), con 0 usos.

**Cero uso de `@theme`**, la directiva de Tailwind v4 para registrar tokens. Por eso no existen
`bg-brand-primary` ni `rounded-deasy-md`, y hay que escribir el hex a mano. Los `[var(--…)]` son
**8 en todo el proyecto**, todos dentro de `tailwind.css`, **0 en cualquier `.vue`**.

## 4. Los dos juegos de tokens

- `theme.css:10-56` → **42 tokens**: 25 `--brand-*`, 5 `--state-*`, 4 `--radius-*`, 8 tipográficos.
- `tailwind.css:27-49` → **18 tokens `--deasy-*`**.

**Alcance real:** `--deasy-*` **nunca ha salido de `shared/styles/`** (2 ficheros). `--brand-*` llega a
5 (`theme.css`, `tailwind.css`, `AdminTableManager.css` con 61 usos, `FirmarPdf.vue`, `BtnSera.vue`).

Ya hay 3 alias explícitos (`tailwind.css:38,43,47`). Lo que queda son divergencias reales:

| Rol | `--brand-*` | `--deasy-*` | Δ |
|---|---|---|---|
| superficie apagada | `--brand-surface-muted: #eef2f7` | `--deasy-surface-muted: #f7f9fc` | **mismo nombre, distinto color** |
| texto oscuro | `--brand-navy: #111827`, `--brand-ink: #1f2937` | `--deasy-text-strong: #343741` | **3 valores para lo mismo** |
| borde | `--brand-border: #e2e6f0` | `--deasy-border-strong: #cfd6e4` | dos, sin criterio de uso |
| radios | `--radius-sm/md/lg`: 8/12/16px | `--deasy-radius-xs…xl`: 0.25→1rem | escalas incompatibles |

**Sin ningún consumidor:** 6 de los 18 `--deasy-*` (incluida **la escala `--deasy-radius-*` entera**) y
13 `--brand-*`/`--state-*`.

**En `theme.css`, ~93 % de las declaraciones no referencian ningún token**: 224 apariciones de hex
(111 colores distintos) y 107 `rgba()` numéricos, frente a 71 `var()`. Los más repetidos duplican un
token declarado tres líneas más arriba: `#ffffff` ×22 (`--brand-white`), `#5e4eff` ×11
(`--brand-primary`), `#e2e6f0` ×9 (`--brand-border`).

Curiosamente **`AdminTableManager.css` está mejor tokenizado que `theme.css`**: 62 `var()` frente a 28
hex, en 604 líneas. Da igual — casi ninguna de sus reglas se aplica (§6).

## 5. CSS muerto

### `theme.css` — ~106 de 196 clases sin referencia, en **dos bloques contiguos**

| Bloque | Líneas | Aprox. |
|---|---|---|
| Familia `.menu-*` / `.admin-menu` | **843-1140** | ~300 L |
| Familia `.home-*` (dashboard) | **1283-1693** | ~410 L |

Que sean contiguos es lo importante: se borran de una pieza. Los `.vue` usan `home-signature-*`,
`home-documents`, `home-pending`, `home-shortcuts`, `home-multisigner`, `home-deliverable-upload` —
**ninguna** de las que define `theme.css`. Además, **4 de las 6 media queries del proyecto viven dentro
de estos bloques muertos** (`:1128`, `:1666`, `:1673`, `:1680`).

Huérfanos dispersos: `.theme-gradient-tile` (`:58-81`), `.profile-dialog-*` (`:416,427`),
`.profile-confirm-*` (`:454`), `.profile-icon-button*` (`:488,500`), `.navbar .avatar` (`:532`),
`.alert-danger` (`:816`), `.theme-soft-panel` (`:826`), `.theme-link` (`:833,839`).

**Sedimento de Bootstrap sin dependencia declarada:** `.card`, `.btn-icon`, `.table` con 6
`--bs-table-*` (`:693-698`), `.table-striped`, `.list-group-item`, `.btn-group`, `.navbar`.

### `@layer components` de `tailwind.css` — 97 de 251 clases sin usar

Familias completas: `.deasy-tag--*` (10 variantes), `.deasy-nav-*`, `.deasy-hero-stat-card__*`,
`.deasy-page-intro*`, `.deasy-section-*`. **Ojo:** algunas podrían construirse dinámicamente en JS
(`useDeliverableView.js`, `homeView.helpers.js`); hay que verificar antes de borrar.

### El bloque que no llega a producción

`theme.css:1695-1914` (220 L, 101 selectores) es un **reskin completo** bajo
`html[data-environment="local-dev"]`, atributo que `main.js:11-13` sólo pone en localhost. **El 11 %
de `theme.css` es dev-only**, y de ahí sale el defecto ya registrado en el maestro (`theme.css:1841`,
un `header { … !important }` que golpea cualquier `<header>`, incluido el de dentro de un modal).

## 6. `AdminTableManager.css`: 604 líneas, ~1 clase efectiva

`AdminTableManager.vue:4224` → `<style scoped src="./AdminTableManager.css">`. El fichero tiene
**0 `:deep()`, 0 `::v-deep`** (verificado). Con `scoped`, Vue añade el `data-v-*` al **último** elemento
del selector; si ese elemento vive en otro componente, el selector **nunca casa**.

De sus 68 clases:

- **1 se aplica**: `.admin-feedback-toast` (`:310`), porque `AdminFeedbackToast` se renderiza en
  `AdminTableManager.vue:3` y Vue propaga el `data-v-*` del padre al **nodo raíz** del hijo.
- **45 existen en algún `.vue`, pero en ninguno es `AdminTableManager.vue`**: `.admin-feedback-toast-body/-title/-close` (nodos internos del hijo), `.person-assignment-panel*` (`:99-145`, viven en
  `AdminPersonAssignmentsModal.vue`), `.admin-modal .admin-btn…` (`:43-70`, **13 `!important`**
  inútiles), `.definition-checklist*`, `.available-formats-*`, `.draft-upload-dropzone*`, `.fk-inline-*`.
- **El resto no existe en ningún sitio.**

Y a la inversa: las 2 clases que `AdminTableManager.vue` **sí** pone en su plantilla
(`admin-table-manager`, `admin-related-tabs`) **no están definidas en su propio CSS** — están en
`theme.css`. El acoplamiento es del 0 %.

Lo que se ve en pantalla viene de `theme.css` (`.table-institutional`, `.table-title-icon`,
`.admin-btn`, definidas globalmente en `:661-816`) y de las utilidades inline de los `.vue`.

**Duplicación literal con `theme.css`**, además: `.table-title-with-icon` (`theme.css:661` `gap:0.55rem`
vs `ATM.css:1` `gap:0.6rem`), `.table-title-icon` (`:667` vs `:7`, 10 propiedades idénticas),
`.table-title-icon.is-template-artifacts` (`:681` vs `:21`). Gana `theme.css` en las tres.

## 7. Hardcodes en los `.vue`

**Corrección de una cifra que circulaba:** los `style=` **estáticos son 1**, no 24
(`DossierSectionCrud.vue:79` → `style="display:none"`, que debería ser `class="hidden"`). Los otros 23
eran falsos positivos de props kebab-case terminadas en `-style`.

Lo que sí hay:

- **~99 colores hex** en `.vue`. Mayoría en `<style scoped>` de los 8 componentes de Vue Flow
  (`modules/admin/components/units/`), pero también **en atributos del template**: `bg-[#071927]`
  (`SHeader.vue:3`, `SMenu.vue:3`), `border-[#071927]` (`UserProfile.vue:14`),
  `focus:border-[#5e4eff]` (`AdminSelectField.vue:6`), `peer-checked:bg-[#5e4eff]` (`SToggle.vue:25`).
  **`#5e4eff` es el color de marca y está a mano en dos componentes compartidos de formulario.**
- **7 z-index literales inline** en `AdminTableManager.vue` (`:409,417,533,694,778,809,824`), que
  además **compiten con `shared/utils/modalController.js:52-53`**, donde se calculan en JS. Dos
  sistemas de apilamiento a la vez.
- **452 arbitrary values**, con `text-[11px]` ×88, `text-[0.6rem]` ×25, `text-[10px]` ×23,
  `text-[0.7rem]` ×20, `text-[0.65rem]` ×12: **8 tamaños distintos por debajo de `text-sm`, mezclando
  px y rem para decir lo mismo**. No hay escala tipográfica.
- **Estilos en `.js`**: `useDeliverableView.js:459-509` (mapa tone → 30 strings de clase),
  `homeView.helpers.js:104-130` (gradientes con hex crudo),
  `AdminPresentationService.js:243-251` (paleta formato→hex completa en una capa de servicio).

### Bloques `<style>` que sobran

- `App.vue:54-77` — **global, sin scope**: `.large`, `.medium`, `.Large`, `.LARGE`, que **sólo se
  diferencian en mayúsculas**. Verificado: **cero consumidores**.
- `SInput.vue:88-90` y `SDate.vue:83-85` — **vacíos**, con `/* Agrega tus estilos aquí */`.
- `ProfileHomePanel.vue:103-105` — **vacío**, `/* Scoped styles removed in favor of Tailwind CSS */`.

### Duplicación entre `<style scoped>`

- Los **4 nodos de Vue Flow** (`UnitNode:110-127`, `ProcessNode:102-118`, `ProcessConfigNode:100-116`,
  `ProcessTemplateNode:101-127`) repiten `.X-node__btn` con los mismos valores. ~60 líneas clonadas.
- `ProcessGraphView.vue:1150-1205` y `UnitGraphView.vue:1283-1334` son **el mismo drawer lateral con
  distinto prefijo** (mismo `z-index:1075`, mismo `rgba(15,23,42,.35)`, mismo `width:min(30rem,100vw)`).
- **Tres componentes deforman `deasy-dropzone` de tres maneras distintas** vía `:deep()`:
  `HomeView.vue:5131-5215` (85 L, 10 reglas, hasta `display:none`), `MultiSignerPanel.vue:1341-1372`,
  `FirmarPdf.vue:2886-2913`. **No es override de terceros: es bypass de un componente propio.**

> Dato relevante: **el 100 % de los `:deep()` apunta a clases propias `deasy-*`**. No hay ni un solo
> override real de Vue Flow, pdfjs o Leaflet.

## 8. Utility soup: el design system existe y se ignora

221 strings de clase de **más de 120 caracteres**. `HomeView.vue` (51) y `FirmarPdf.vue` (41)
concentran el 42 %.

| String repetido **literalmente** | Veces |
|---|---|
| `mb-2 inline-flex items-center gap-1 text-sm font-semibold text-slate-700` | 22 |
| `mb-1.5 block text-sm font-semibold text-slate-700` | **21** |
| `mb-1 block text-[0.6rem] font-semibold uppercase tracking-wide text-slate-400` | 18 |
| `w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm…` | 15 (+4 variantes → ~43 inputs con 5 recetas) |
| `rounded-2xl border border-slate-200 bg-white p-4` | 8 |
| `admin-data-table min-w-full border-separate border-spacing-0 text-sm` | 8 |
| `rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700` | 7 |

El segundo duele especialmente: **`tailwind.css:1337` ya define `.deasy-form-label` con exactamente ese
`@apply`, byte por byte**.

Ratio semántico/utilidades por módulo — **no hay separación por módulo, hay un gradiente**:

| Módulo | ratio | strings >120 chars | arbitrary values |
|---|---|---|---|
| `modules/procesos` | 0.65 | 2 | 5 |
| `shared/` | 0.59 | 19 | 41 |
| `layouts/` | 0.46 | 5 | 22 |
| `modules/auth` | 0.33 | 8 | 12 |
| `modules/perfil` | 0.17 | 1 | 10 |
| `modules/admin` | 0.15 | 39 | 109 |
| `modules/home` | 0.13 | **86** | **205** |
| `modules/firmas` | **0.08** | **61** (en 7 ficheros) | 48 |

Hay un design system de ~400 clases y **los módulos pesados lo ignoran**.

## 9. Nada lo vigila

- **No existe stylelint**: cero `.stylelintrc*`, cero dependencia. **Ninguna herramienta valida el CSS.**
- `frontend/eslint.config.cjs:7` usa **sólo `flat/essential`** (el preset mínimo) y `:18` tiene
  `rules: {}`. No están activas `vue/no-static-inline-styles`, `vue/prefer-separate-static-class` ni
  `vue/attributes-order`. **Nada impide un `class="…"` de 300 caracteres nuevo mañana.**
- `frontend/.eslintrc.js` es **legado inerte** (formato eslintrc, que ESLint 10 ya no lee al existir el
  flat config). Dos configs, una muerta.
- **Verificado en contenedor: el lint sí analiza los `.vue`** pese al `--ext` obsoleto del script
  (`package.json:9`). No es el problema; el problema es que no hay reglas.
- Sonar **sí** indexa el CSS (`sonar-project.properties:16`), sin exclusiones de estilo. De ahí salen
  las 33 `css:S7924`.

---

## 10. Qué se descarta explícitamente

- **`--font-weight-*` de `theme.css:52-53`**: pisan el namespace pero con los valores por defecto de
  Tailwind. Tocarlos ahora es riesgo sin beneficio; se anotan y se dejan.
- **La media query `theme.css:366`** (`min-width: 640px`, = `sm`): está viva y es correcta en
  dirección. La de `tailwind.css:171` (`min-width:1280px`, = `xl`) también está viva, aunque debería
  ser el prefijo `xl:`. Ninguna de las dos entra en esta pasada.
- **Los `<style scoped>` de Vue Flow que tocan `.X-node__handle`**: son integración legítima con
  `@vue-flow/core`. Se quedan.
