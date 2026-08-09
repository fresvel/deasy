# Sistema de diseño actual de Deasy — mapa para TailAdmin

> Fuente: `frontend/src/` en `develop` (2541d92). Todo verificado por lectura directa.
> Los tres hallazgos marcados **[PROBADO]** se verificaron compilando Tailwind 4.2.2 del propio
> repo y midiendo en navegador (no son deducción sobre el papel).

## 0. Hecho fundacional: **no hay `@theme` en ningún sitio**

```
grep -rn '@theme|@custom-variant|dark:' frontend/src frontend/*.config.js  →  0 resultados
```

- `tailwind.css:1-2` — `@import "tailwindcss"` + `@plugin "@tailwindcss/typography"`. Nada más.
- **No existe `tailwind.config.js` ni configuración de postcss.** `vite.config.js:10` carga `tailwindcss()` a secas.
- Stack real: Tailwind **4.2.2** (`package.json:37`), Vue 3.5.32, Vite 8.

**Consecuencia**: Deasy corre con el **tema por defecto de Tailwind, intacto**. Ni `--deasy-*` ni
`--brand-*` generan una sola utilidad — son variables CSS inertes, consumibles sólo vía `var()`.
Es la pieza que más condiciona el diagnóstico de TailAdmin (§4).

**No hay modo oscuro**: 0 ocurrencias de `dark:`, 0 `@custom-variant`.

---

## 1. Tokens

### 1.1 `--deasy-*` — semántico, en `@layer base`

`tailwind.css:5-31`, dentro de `@layer base { :root { … } }`. **25 tokens**:

| Familia | Línea | Tokens |
|---|---|---|
| Shell | `:6` | `--deasy-shell-max-width: 2560px` |
| Radio | `:7-11` | `--deasy-radius-xs/-sm/-md/-lg/-xl` (0.25 → 1rem) |
| Superficie | `:12-15` | `--deasy-surface-page` `#071927`, `-card` `#fff`, `-muted` `#f7f9fc`, `-soft` |
| Borde | `:16-17` | `--deasy-border-soft` `#e2e6f0`, `-strong` `#cfd6e4` |
| Texto | `:18-20` | `--deasy-text-strong` `#343741`, `-body` `#3f4254`, `-muted` `#7a7b80` |
| Primario | `:21-23` | `--deasy-primary` `#5e4eff`, `-strong` `#4a3ce8`, `-soft` |
| Acento | `:24-26` | `--deasy-accent` `#00b2a9`, `-strong` `#008b85`, `-soft` |
| Sidebar | `:27-28` | `--deasy-sidebar` `#071927`, `-strong` `#061521` |
| Gradiente | `:29-30` | `--deasy-brand-gradient`, `-soft` |

Efectivamente semántico (surface/text/border/radius), tal como sospechabas.

### 1.2 `--brand-*` — paleta + sombras, `:root` clásico **sin capa**

`theme.css:3-49`, `:root` plano (el fichero **no** tiene `@layer` ni `@apply`: 0 de ambos).

| Familia | Línea | Tokens |
|---|---|---|
| Marca | `:4-9` | `--brand-primary` `#5e4eff`, `-primary-strong`, `-accent`, `-accent-strong`, `-highlight`, `-highlight-rgb` |
| Neutros | `:10-19` | `--brand-secondary`, `-navy`, `-ink`, `-surface`, `-surface-alt`, `-surface-muted`, `-info-soft`, `-white`, `-border`, `-muted` |
| Sombra | `:20-22` | `--brand-shadow-strong`, `--brand-shadow`, `--brand-shadow-soft` |
| Gradiente | `:23-25` | `--brand-gradient`, `-gradient-angled`, `-workspace-gradient` |
| Triplete RGB | `:26-28` | `--brand-primary-rgb`, `-accent-rgb`, `-secondary-rgb` |
| **Estado** | `:30-34` | `--state-success` `#28a745`, `-danger` `#dc3545`, `-warning` `#fd7e14`, `-info` `#17a2b8`, `-gold` |
| **Radio** | `:36-39` | `--radius-lg: 16px`, `-md: 12px`, `-sm: 8px`, `-button: 8px` ← **ver §1.5** |
| Tipografía | `:41-48` | `--input-height: 52px`, `--font-base`, `--font-size-base`, `--font-weight-*`, `--line-height-*` |

### 1.3 Dónde chocan (redundancia)

Valores **idénticos** declarados dos veces:

| Concepto | `--deasy-*` | `--brand-*` | Valor |
|---|---|---|---|
| Primario | `tailwind.css:21` | `theme.css:4` y `:8` | `#5e4eff` |
| Primario fuerte | `tailwind.css:22` | `theme.css:5` | `#4a3ce8` |
| Acento | `tailwind.css:24` | `theme.css:6` | `#00b2a9` |
| Acento fuerte | `tailwind.css:25` | `theme.css:7` | `#008b85` |
| Borde | `tailwind.css:16` | `theme.css:18` | `#e2e6f0` |
| Texto tenue | `tailwind.css:20` | `theme.css:19` | `#7a7b80` |
| Gradiente 135° | `tailwind.css:29` | `theme.css:24` | `linear-gradient(135deg,#5e4eff,#3898ff)` |

**Divergencia silenciosa** (el peligro real, no la redundancia): `--deasy-surface-muted` `#f7f9fc`
(`tailwind.css:14`) vs `--brand-surface-alt` `#f8fafc` (`theme.css:14`). Mismo rol, **dos valores
distintos** a un punto de diferencia. Ya derivaron.

### 1.4 Quién consume cada juego — **el dato que decide el merge**

```
var(--deasy-*) fuera de shared/styles/ → 0 ficheros
var(--brand-*) fuera de shared/styles/ → 3 ficheros
```

- `modules/admin/components/tables/AdminTableManager.css`
- `modules/firmas/components/FirmarPdf.vue`
- `shared/components/buttons/BtnSera.vue`

> **Corrige a `frontend.md` §3.4.** El doc dice «Sólo 3 archivos de 144 usan un token
> `var(--deasy-*)`». Son **0**: los 3 ficheros usan `--brand-*`, no `--deasy-*`. `--deasy-*` es un
> **detalle interno de `tailwind.css`** — no ha salido nunca de su fichero.
>
> Esto invierte la dirección barata del merge de la Fase X.2: `--deasy-*` es el juego que
> `CLAUDE.md` presenta como oficial, pero es el que **no tiene consumidores externos**. Retirarlo o
> renombrarlo cuesta un fichero. Retirar `--brand-*` toca 3 módulos + 300 selectores de `theme.css`.

### 1.5 **[PROBADO]** `theme.css:36-39` reescribe la escala de radios de Tailwind

Éste no aparece en `frontend.md` y está **activo hoy en toda la app**.

`theme.css:36-39` declara `--radius-lg/-md/-sm` en un `:root` **sin capa**. Tailwind v4 declara
**esos mismos nombres** dentro de `@layer theme`. Por la cascada CSS, **lo no-capado gana a lo
capado**, así que theme.css secuestra la escala entera.

Verificado compilando el Tailwind 4.2.2 del propio repo y midiendo `getComputedStyle` en navegador:

| Utilidad | Tailwind stock | **Real en Deasy** | |
|---|---|---|---|
| `rounded-sm` | 4px | **8px** | ×2 |
| `rounded-md` | 6px | **12px** | ×2 |
| `rounded-lg` | 8px | **16px** | ×2 |
| `rounded-xl` | 12px | 12px | sin tocar |

**La escala queda invertida**: `rounded-lg` (16px) > `rounded-xl` (12px), y `rounded-md` == `rounded-xl` == 12px.

Alcance: `.deasy-btn` hace `@apply rounded-lg` (`tailwind.css:567` y `:1378`) → **todos los botones
de la app tienen 16px de radio**, no 8px. Y `--radius-button: 8px` (`theme.css:39`), que parece ser
la intención declarada, **no se aplica en ningún sitio**.

`--font-weight-medium/semibold` (`theme.css:45-46`) también colisionan con el espacio de nombres de
Tailwind, pero con **valores idénticos** (500/600) → inocuo. `--radius-*` es la única colisión viva.

### 1.6 Tercer eje de theming: `data-environment="local-dev"`

`main.js:12-14` pone `data-environment="local-dev"` en `<html>` **sólo en localhost**.
`theme.css:1700-1925` cuelga **105 reglas** de ese atributo:

- `:1701-1706` — **redeclara `--brand-surface/-alt/-muted/-border/-shadow/-shadow-soft`** (2.º sitio de declaración).
- `:1716-1751` — pisa con `!important` utilidades **de Tailwind**: `.bg-white`, `.bg-slate-50`, `.bg-slate-100`, `.bg-white/80…/95`.
- `:1787-1796` — pisa `.shadow-xl` y `.shadow-sm` con `!important`.

**Dev y prod no renderizan igual.** Cualquier cosa que se valide en localhost se valida contra un
tema que producción no tiene.

---

## 2. Componentes base aprobados

| Componente | Ruta (`frontend/src/`) | L | Consum. |
|---|---|---:|---:|
| AppButton | `shared/components/buttons/AppButton.vue` | 99 | 60 |
| AppDataTable | `shared/components/data/AppDataTable.vue` | 106 | 20 |
| AppModalShell | `shared/components/modals/AppModalShell.vue` | 159 | 35 |
| AppFormModalLayout | `shared/components/forms/AppFormModalLayout.vue` | 66 | 6 |
| AppTag | `shared/components/data/AppTag.vue` | 26 | 11 |
| AppNavCard | `shared/components/layout/AppNavCard.vue` | 140 | 3 |
| PdfDropField | `shared/components/forms/PdfDropField.vue` | 246 | 12 |

Forks vivos (Fase X.3): `modules/admin/components/modals/AdminModalShell.vue` (22 consum.),
`modules/admin/components/tables/AdminDataTable.vue` (11 consum.).

### AppButton — **15 variantes**

`AppButton.vue:64-80`:

`primary` · `secondary` (default) · `cancel` · `outlinePrimary` · `outlineDanger` · `softPrimary` ·
`softNeutral` · `softSuccess` · `softWarning` · `softDanger` · `success` · `danger` · `close` ·
`menu` · `plain`

Tamaños (`:82-86`): `sm` · `md` (default) · `lg`. Props: `type`, `variant`, `size`, `iconOnly`,
`disabled`, `title`, `ariaLabel`, `className`. Emite `click`. Slot default.

**Doble emisión de clases** (`:65-80`): cada variante emite `deasy-btn--X admin-btn--X`. 10 de 15
tienen gemelo `admin-*`; las 5 `soft*` no. Toda variante nueva se escribe dos veces.

CSS: `.deasy-btn` `tailwind.css:566` + variantes `:570-665`; **redefinidas** en `:1376-1447`.

### AppTag — 10 variantes

Props: `variant` (default `info`), `className`. Slot default. Emite `deasy-tag deasy-tag--${variant}`.
Variantes en CSS (`tailwind.css:525-565`): `danger` · `success` · `warning` · `info` · `neutral` ·
`muted` · `salmon` · `accent` · `contrast` · `hero`.

### AppModalShell

Props: `title`, `labelledBy`, `size`, `dialogClass`, `contentClass`, `bodyClass`, `footerClass`,
`closeLabel`, `showCloseButton`, `showHeader`, `closeAction`, `closeOnBackdrop`, `controlled`, `open`.
Emite `close`. Slots: `header`, `title`, default, `footer`. `defineExpose({ el })`.

Tamaños (`:120-133`): `md`→`max-w-3xl` · `lg`→`max-w-5xl` · `xl`→`max-w-7xl` · `scrollable`→`max-w-5xl` · `centered`→`max-w-3xl`.

### AppDataTable

Props: `fields`, `rows`, `rowKey`, `emptyText`, `actionsLabel`, `tableClass`, `showHeader`,
`responsiveClass`, `scrollClass`, `headerCellClass`, `bodyCellClass`, `actionsHeaderClass`,
`actionsBodyClass`, `rowClass`, `emptyCellClass`.
Slots: `empty`, `row(row, fields)`, `cell(row, field)`, `actions(row)`.

### AppFormModalLayout

Props: `title`, `description`, `errorMessage`, `isSubmitting`, `submitText` (default `"Guardar"`).
Emite `submit`, `cancel`, `close`. Slot default. Envuelve `AppButton`.

### AppNavCard

Props: `title`, `icon`, `description`, `meta`, `layout` (default `stacked`), `showArrow`,
`showMetaDot`, `badge`, `badgeVariant`, `ariaLabel`, `className`, `iconWrapperClass`, `iconClass`,
`titleClass`. Emite `click`. **Sin slots** (todo por props).

### PdfDropField

Props: `title`, `actionText`, `helpText`, `accept`, `multiple`, `disabled`, `variant` (default
`card`), `icon`, `active`, `selectedFile`, `filled`, `inputId`. Emite `files-selected`, `clear`.
**Sin slots**. Variantes CSS (`tailwind.css:1133-1145`): `card` · `compact` · `inline`.

---

## 3. Clases utilitarias compartidas

### 3.1 `tailwind.css` — 285 `@apply`, 2 bloques `@layer components`

| Familia | Líneas | Propósito |
|---|---|---|
| Shell/workspace | `47-66` | `.deasy-shell`, `.deasy-section-gap`, `.deasy-workspace*` |
| Cabecera/contexto | `67-96` | `.deasy-workspace-header*`, `.deasy-context-header*` |
| Nav primaria/lateral | `97-182` | `.deasy-primary-nav*`, `.deasy-secondary-nav`, `.deasy-sidebar*` |
| Pestañas | `183-218` | `.deasy-secondary-tab*`, `.deasy-inline-tab*` |
| Filtros | `219-327` | `.deasy-filter-*` (shell/grid/label/control/toolbar/actions/btn) |
| **Superficies** | `329-360` | `.deasy-card`, `-muted`, `-soft`, `-padding`, `.deasy-panel`, `-muted` |
| Secciones | `361-384` | `.deasy-section-shell`, `-card`, `-header*` |
| Tipografía | `385-412` | `.deasy-heading-hero/-section/-card`, `.deasy-text-body/-muted/-caption`, `.deasy-divider` |
| Rejilla | `413-468` | `.deasy-row`, `.deasy-field-wrapper`, `.deasy-col-1..12` |
| **Formularios** | `469-516` | `.deasy-field-label`, `-input/-select/-textarea` (+`--icon-left/right`, `--error`), `-message` |
| **Tags** | `517-565` | `.deasy-tag` + 10 variantes |
| **Botones** | `566-666` | `.deasy-btn` + 15 variantes + `--sm/--md/--lg/--icon` |
| Hero | `667-760` | `.deasy-hero-*` (shell/layout/copy/media/kicker/title/stat-card…) |
| Page intro | `761-790` | `.deasy-page-intro*` |
| **Tablas** | `791-900` | `.deasy-table-shell`, `-header`, `-title`, `-responsive`, `.deasy-table` |
| Nav genérica | `901-1096` | `.deasy-nav-*` (shell/group/item/glyph/select/feedback/tree/chip/action) |
| Estados | `1101-1116` | `.deasy-state-info/-success/-warning/-danger` |
| Dropzone | `1117-1208` | `.deasy-dropzone*` (~15 — base de `PdfDropField`) |
| **Auth** | `1209-1298` | `.deasy-auth-page/-center/-card/-panel/-visual/-brand/-field/-button/-link` |
| UI surface | `1301-1308` | `.deasy-ui-surface`, `.deasy-ui-subtle-surface` |
| Form section | `1309-1347` | `.deasy-form-section*`, `.deasy-form-grid`, `.deasy-form-label`, `-help`, `.deasy-inline-icon-button` |
| Diálogo | `1488-1516` | `.deasy-dialog-root/-panel/-header/-title/-body/-footer` (+ gemelos `.admin-*`) |

### 3.2 Los ~24 selectores redefinidos (2.º `@layer components`, `1300-1517`)

Confirmado lo que dice el plan, y **es peor que redundancia — hay pérdida semántica**:

| Selector | 1.ª def. | 2.ª def. | Qué muere |
|---|---|---|---|
| `.deasy-card` | `:329` `rounded-2xl shadow-none` | `:1349` `rounded-[8px]` + sombra | radio y sombra |
| `.deasy-card-muted`/`-soft`/`.deasy-panel`/`-muted` | `:334-359` fondos **distintos** (`--surface-muted`, `--surface-soft`) | `:1354-1360` **una sola regla `bg-white`** | **la distinción muted/soft desaparece: los 4 quedan blancos** |
| `.deasy-btn--primary` | `:570` `background: var(--deasy-brand-gradient)` | `:1381` `background: var(--deasy-primary)` | **el gradiente muere** |
| `.deasy-btn` | `:566` `rounded-lg` | `:1376` `min-h-10 rounded-lg shadow-none` | — |
| `.deasy-section-card`/`.deasy-table-shell` | `:365`/`:791` | `:1362` | radio/sombra |
| `.deasy-field-input/-select/-textarea` | `:473` | `:1368` | borde |
| `.deasy-hero-*`, `.deasy-page-intro*` | `:667+` | `:1449+` | |
| `.deasy-tag--contrast`/`--hero` | `:558`/`:562` | `:1482` | |

`.deasy-card-muted` y `.deasy-card-soft` **hoy son indistinguibles de `.deasy-card`**. Cuatro nombres, un render.

### 3.3 `@layer utilities` secuestra utilidades **de Tailwind** — `tailwind.css:1519-1527`

```css
@layer utilities {
    .rounded-4xl { border-radius: 1.25rem !important; }   /* Tailwind: 2rem */
    .shadow-xl   { box-shadow: 0 1px 2px …, 0 12px 32px … !important; }
}
```

No son clases propias: son **nombres de Tailwind reescritos globalmente con `!important`**. Junto con
`--radius-*` (§1.5) y el bloque `local-dev` (§1.6), son **tres mecanismos independientes** que
redefinen utilidades estándar. Relevante para TailAdmin: sus recetas usan `shadow-*` y `rounded-*` a discreción.

### 3.4 `theme.css` — 300 selectores, 0 `@apply`, **103 `!important`**, sin capa

CSS plano, sin prefijo `deasy-`, por familias: `.home-*` (69) · `.admin-*` (60) · `.profile-*` (58) ·
`.table-*` (29) · `.hope-action-*` (22) · `.deasy-*` (17) · `.menu-*` (13) · `.process-*` (12) ·
`.h1`–`.h6` · `.card` · `.btn-icon` · `.theme-gradient-tile`.

Al ser **todo no-capado**, `theme.css` gana a `@layer components` **y** a `@layer utilities` de
`tailwind.css` sin necesidad de `!important`. Es un tercer sistema, no una capa de tema.

### 3.5 Adopción real

| Métrica | Valor |
|---|---:|
| `bg-/text-/border-<color>-<n>` crudos en `.vue` | **2818** |
| Hex crudos en `.vue` | 98 |
| Ficheros que usan `var(--deasy-*)` | **0** |
| Ficheros que usan `var(--brand-*)` | 3 |
| `dark:` | **0** |

(El plan cita 592; ése contaba sólo `bg-`. Sumando `text-`/`border-` son 2818.)

---

## 4. Diagnóstico de compatibilidad con TailAdmin

### 4.1 ¿Choca `--brand-*` de Deasy con `--color-brand-*` de TailAdmin? **No.**

Son nombres distintos en espacios distintos: `--brand-primary` ≠ `--color-brand-500`. **No hay
colisión léxica y pueden convivir literalmente.** Y hay una razón de fondo: como Deasy **no tiene
`@theme`** (§0), sus `--brand-*`/`--deasy-*` **no generan ninguna utilidad**; son variables inertes.
Meter el `@theme` de TailAdmin es **puramente aditivo**: crea `bg-brand-500`, `text-error-500`, etc.,
sin tocar una sola clase existente.

**El riesgo es semántico, no técnico**: quedarían **dos conceptos de "marca"** — `--brand-primary`
(`#5e4eff`, el real, usado por 3 ficheros) y `--color-brand-500` (el de TailAdmin). Si no se fuerza
`--color-brand-500: #5e4eff`, la app tendrá dos colores de marca según el componente sea viejo o nuevo.

**La colisión real está en otro sitio y ya está activa**: `--radius-*` (§1.5). TailAdmin no la
provoca, pero **la hereda**: cualquier receta suya con `rounded-lg` renderizará a 16px con la escala
invertida (`rounded-lg` > `rounded-xl`). Esto se arregla **antes** de traer nada.

### 4.2 Equivalencias

| Token TailAdmin | Equivalente en Deasy | Estado |
|---|---|---|
| `--color-brand-50..950` (11) | `--deasy-primary/-strong/-soft` + `--brand-primary/-strong` | **Parcial** — 3-5 valores ad-hoc, sin escala |
| `--color-gray-25..950` | **ninguno** — se usan `slate-*` de Tailwind crudos (2818 usos) | **Falta** |
| `--color-success-*` | `--state-success` `#28a745` · `--deasy-accent` `#00b2a9` | **Parcial** — valor único, y **dos verdes en disputa** |
| `--color-error-*` | `--state-danger` `#dc3545` | **Parcial** + **nombre distinto** (`danger` vs `error`) |
| `--color-warning-*` | `--state-warning` `#fd7e14` | **Parcial** — valor único |
| `--shadow-theme-xs/sm/md/lg` | `--brand-shadow`, `-soft`, `-strong` | **Parcial** + nombres distintos + `.shadow-xl` secuestrado (§3.3) |
| `--text-theme-xs/sm`, `--text-title-sm/md/lg` | **ninguno** (sólo `--font-size-base: 1rem`) | **Falta** |
| Modo oscuro (`dark:`) | **ninguno** | **Falta** — y es activamente peligroso (§4.3) |
| `--radius-*` | `--deasy-radius-xs..xl` + `--radius-*` (§1.5) | **Conflicto vivo** |

Resumen: de los 8 grupos de TailAdmin, **0 completos**, 5 parciales, 3 ausentes.

### 4.3 **[PROBADO]** El `dark:` de TailAdmin se activaría solo

Sin `@custom-variant dark (&:is(.dark *))`, Tailwind v4 compila `dark:` a
**`@media (prefers-color-scheme: dark)`** — verificado compilando con el Tailwind del repo:

```css
.dark\:bg-gray-900 {
  @media (prefers-color-scheme: dark) { background-color: var(--color-gray-900); }
}
```

Las recetas de TailAdmin van saturadas de `dark:`. Si se pegan tal cual **hoy**, a todo usuario con
el SO en oscuro se le pintarían las tarjetas nuevas en oscuro **sobre el resto de Deasy en claro**,
sin que nadie active nada. Es un fallo silencioso y dependiente del SO del visitante — no se ve en
una máquina en modo claro.

### 4.4 Qué hacer para usar recetas de TailAdmin sin romper lo existente

En orden. Los pasos 1-3 son bloqueantes: sin ellos, cada receta importada nace rota.

1. **Deshacer el secuestro de `--radius-*`** (`theme.css:36-39`) → renombrar a `--deasy-radius-*`
   (o meterlos en `@theme` con la escala intencionada). ⚠️ **Cambia el aspecto de toda la app**
   (radios a la mitad, botones 16px→8px): es un cambio visual, va en su propio commit y con capturas.
   Es *el* prerrequisito: mientras siga, cualquier `rounded-*` —viejo o de TailAdmin— miente.
2. **Añadir `@custom-variant dark (&:is(.dark *))`** en `tailwind.css` **antes** de pegar markup con
   `dark:` (§4.3). Barato e inocuo hoy (0 usos de `dark:`), y evita el fallo silencioso.
3. **Retirar `@layer utilities` de `tailwind.css:1519-1527`** — `.rounded-4xl`/`.shadow-xl` con
   `!important` reescribirían las sombras de TailAdmin. Convertirlas en clases propias con nombre propio.
4. **Añadir un único bloque `@theme`** en `tailwind.css` con las escalas de TailAdmin
   (`--color-brand-*`, `--color-gray-*`, `--color-success/error/warning-*`, `--shadow-theme-*`,
   `--text-theme-*`), anclando **`--color-brand-500: #5e4eff`** para que no nazcan dos marcas (§4.1).
   Es aditivo: no toca ninguna clase existente.
5. **Neutralizar o acotar `html[data-environment="local-dev"]`** (`theme.css:1700-1925`, 105 reglas,
   `!important` sobre `.bg-white`/`.bg-slate-*`/`.shadow-*`). Si no, los componentes de TailAdmin se
   repintan en dev y **lo que valides en localhost no es lo que verá producción** (§1.6).
6. **Fusionar los dos `@layer components`** (Fase X.1) **antes** de mapear nada: si mapeas una receta
   sobre `.deasy-card`, `:1349` te la pisa sin avisar. Aprovechar para decidir si `.deasy-card-muted`
   y `-soft` deben existir (hoy no se distinguen, §3.2).
7. **Colapsar `--deasy-*`/`--brand-*`** (Fase X.2) — **el orden barato es el contrario al que sugiere
   `CLAUDE.md`**: `--deasy-*` tiene **0 consumidores externos** (§1.4), así que se retira tocando un
   solo fichero. Si además `@theme` pasa a ser la fuente de verdad, ambos juegos quedan como alias
   de compatibilidad y se borran cuando `theme.css` se desmonte.

**Orden sugerido**: 2 → 3 → 4 (aditivos, sin riesgo visual; ya permiten pegar una receta de prueba)
→ 1 → 5 → 6 → 7 (cambios de aspecto, uno a uno con capturas).

> El paso 1 y la §3.6 del plan chocan: `frontend.md` §Fase X dice «no migrar los 1269
> hardcodes antes de esto». Con 2818 utilidades crudas y **0 tests de componente**, la Fase X necesita
> capturas golden-master (el método que ya se usó en la Fase 2.1) antes de tocar `--radius-*`.
