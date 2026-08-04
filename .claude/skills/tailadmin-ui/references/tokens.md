# TailAdmin — Referencia exhaustiva de design tokens

Material de consulta. Hex exactos, sin redondeos.

## Fuentes y autoridad

| Fuente | Ruta | Rol |
|---|---|---|
| **HTML free (MIT)** | `scratchpad/tailadmin-html/src/css/style.css` (751 líneas) | **FUENTE PRIMARIA** — `@theme` sin compilar |
| Vue free | `scratchpad/tailadmin-vue/src/assets/main.css` (761 líneas) | Idéntico en tokens (ver nota) |
| Demo PRO | `scratchpad/demo-style.css` (390 KB) | CSS compilado, **tree-shaken** |

**Los dos repos free tienen el bloque `@theme` byte-idéntico** (md5 `545e15f8…` sobre el bloque normalizado). Cambian solo en lo que viene después (el Vue añade `body { @apply … }` y `.dark .custom-scrollbar…`).

> **Corrección a dos supuestos previos:**
> 1. `--color-theme-pink-500` y `--color-theme-purple-500` **NO son PRO-only**: están en ambos repos free (líneas 136 y 138). Verificado por grep directo.
> 2. El **único token PRO-only** hallado es `--text-title-xs` (24px/32px). Ver §2.
>
> El demo PRO **no puede usarse para enumerar** la paleta: Tailwind v4 solo emite los tokens *usados*. El demo contiene 67 `--color-*` frente a los 91 del `@theme` free — la diferencia es tree-shaking, no ausencia (p. ej. `--color-brand-25/700/900` existen en el free y no aparecen compilados).

## Resumen por grupo

| Grupo | Nº tokens |
|---|---|
| Colores (`--color-*`) | **91** |
| Tipografía: familia | 1 |
| Tipografía: tamaños (`--text-*`) | 8 free (+1 PRO) × 2 decls (size + line-height) = 16 |
| Sombras (`--shadow-*`) | 9 |
| Drop shadow (`--drop-shadow-*`) | 1 |
| Breakpoints (`--breakpoint-*`) | 8 |
| Z-index (`--z-index-*`) | 7 |
| Resets (`--*: initial`) | 2 |
| **Total declaraciones en `@theme`** | **135** |

---

## 1. Paleta completa

### Base (4)

| Token | Valor |
|---|---|
| `--color-current` | `currentColor` |
| `--color-transparent` | `transparent` |
| `--color-white` | `#ffffff` |
| `--color-black` | `#101828` ⚠️ no es negro puro — es `gray-900` |

### Escalas de 12 pasos

Todas las escalas cromáticas siguen el mismo eje: `25, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950`. El paso **500** es el color nominal.

| Paso | brand | blue-light | orange | success | error | warning |
|---|---|---|---|---|---|---|
| 25 | `#f2f7ff` | `#f5fbff` | `#fffaf5` | `#f6fef9` | `#fffbfa` | `#fffcf5` |
| 50 | `#ecf3ff` | `#f0f9ff` | `#fff6ed` | `#ecfdf3` | `#fef3f2` | `#fffaeb` |
| 100 | `#dde9ff` | `#e0f2fe` | `#ffead5` | `#d1fadf` | `#fee4e2` | `#fef0c7` |
| 200 | `#c2d6ff` | `#b9e6fe` | `#fddcab` | `#a6f4c5` | `#fecdca` | `#fedf89` |
| 300 | `#9cb9ff` | `#7cd4fd` | `#feb273` | `#6ce9a6` | `#fda29b` | `#fec84b` |
| 400 | `#7592ff` | `#36bffa` | `#fd853a` | `#32d583` | `#f97066` | `#fdb022` |
| **500** | **`#465fff`** | **`#0ba5ec`** | **`#fb6514`** | **`#12b76a`** | **`#f04438`** | **`#f79009`** |
| 600 | `#3641f5` | `#0086c9` | `#ec4a0a` | `#039855` | `#d92d20` | `#dc6803` |
| 700 | `#2a31d8` | `#026aa2` | `#c4320a` | `#027a48` | `#b42318` | `#b54708` |
| 800 | `#252dae` | `#065986` | `#9c2a10` | `#05603a` | `#912018` | `#93370d` |
| 900 | `#262e89` | `#0b4a6f` | `#7e2410` | `#054f31` | `#7a271a` | `#7a2e0e` |
| 950 | `#161950` | `#062c41` | `#511c10` | `#053321` | `#55160c` | `#4e1d09` |

### Gray (13 = 12 pasos + 1 alias)

| Token | Hex | | Token | Hex |
|---|---|---|---|---|
| `--color-gray-25` | `#fcfcfd` | | `--color-gray-500` | `#667085` |
| `--color-gray-50` | `#f9fafb` | | `--color-gray-600` | `#475467` |
| `--color-gray-100` | `#f2f4f7` | | `--color-gray-700` | `#344054` |
| `--color-gray-200` | `#e4e7ec` | | `--color-gray-800` | `#1d2939` |
| `--color-gray-300` | `#d0d5dd` | | `--color-gray-900` | `#101828` |
| `--color-gray-400` | `#98a2b3` | | `--color-gray-950` | `#0c111d` |
| | | | **`--color-gray-dark`** | **`#1a2231`** |

`--color-gray-dark` es el outlier del sistema: nombre no numérico, sin escala. Es el fondo de superficie en dark mode.

### Acentos de un solo paso (2)

| Token | Hex | Nota |
|---|---|---|
| `--color-theme-pink-500` | `#ee46bc` | **free + PRO** (no es PRO-only) |
| `--color-theme-purple-500` | `#7a5af8` | **free + PRO** (no es PRO-only) |

Solo existe el paso `500`. Verificado en el compilado PRO: `grep -oE 'theme-(pink|purple)-[0-9]+'` → únicamente `-500`.

---

## 2. Tipografía

### Familia

| Token | Valor |
|---|---|
| `--font-outfit` | `Outfit, sans-serif` |

Cargada vía `@import url("https://fonts.googleapis.com/css2?family=Outfit:wght@100..900&display=swap") layer(base);` — variable font, ejes 100–900.

⚠️ **`--font-*: initial` borra `--font-sans` / `--font-mono` / `--font-serif` de Tailwind.** Tras el reset la única familia es `font-outfit`. Consecuencia no obvia: Tailwind mantiene `--default-font-family: var(--font-sans)` (visible en el compilado PRO), que queda **sin resolver** — por eso el repo Vue fuerza la familia en el `body`:

```css
body { @apply relative font-normal font-outfit z-1 bg-gray-50; }
```

El repo HTML **no** trae ese `body` (lo aplica por clase en el markup). Si copias el `@theme` sin esa regla, el body cae al fallback del navegador.

### Escala custom (px absolutos, no rem)

**Serie `title-*`** — display/headings:

| Utilidad | font-size | line-height | Disponibilidad |
|---|---|---|---|
| `text-title-2xl` | 72px | 90px | free + PRO |
| `text-title-xl` | 60px | 72px | free + PRO |
| `text-title-lg` | 48px | 60px | free + PRO |
| `text-title-md` | 36px | 44px | free + PRO |
| `text-title-sm` | 30px | 38px | free + PRO |
| `text-title-xs` | **24px** | **32px** | 🔒 **PRO-only** |

**Serie `theme-*`** — UI/body:

| Utilidad | font-size | line-height |
|---|---|---|
| `text-theme-xl` | 20px | 30px |
| `text-theme-sm` | 14px | 20px |
| `text-theme-xs` | 12px | 18px |

**Huecos deliberados en la serie `theme-*`**: no existen `theme-md`, `theme-lg`, `theme-2xl`. Para 16px se usa el `text-base` nativo de Tailwind (1rem) — la escala custom **convive** con la nativa, no la reemplaza (a diferencia de `--font-*` y `--breakpoint-*`, que sí se resetean).

`--text-title-xs` es el **único token PRO-only** de todo el sistema. Añadirlo al free es una línea:
```css
--text-title-xs: 24px;
--text-title-xs--line-height: 32px;
```

---

## 3. Sombras

| Token | Valor |
|---|---|
| `--shadow-theme-xs` | `0px 1px 2px 0px rgba(16, 24, 40, 0.05)` |
| `--shadow-theme-sm` | `0px 1px 3px 0px rgba(16, 24, 40, 0.1), 0px 1px 2px 0px rgba(16, 24, 40, 0.06)` |
| `--shadow-theme-md` | `0px 4px 8px -2px rgba(16, 24, 40, 0.1), 0px 2px 4px -2px rgba(16, 24, 40, 0.06)` |
| `--shadow-theme-lg` | `0px 12px 16px -4px rgba(16, 24, 40, 0.08), 0px 4px 6px -2px rgba(16, 24, 40, 0.03)` |
| `--shadow-theme-xl` | `0px 20px 24px -4px rgba(16, 24, 40, 0.08), 0px 8px 8px -4px rgba(16, 24, 40, 0.03)` |
| `--shadow-focus-ring` | `0px 0px 0px 4px rgba(70, 95, 255, 0.12)` |
| `--shadow-slider-navigation` | `0px 1px 2px 0px rgba(16, 24, 40, 0.1), 0px 1px 3px 0px rgba(16, 24, 40, 0.1)` |
| `--shadow-tooltip` | `0px 4px 6px -2px rgba(16, 24, 40, 0.05), -8px 0px 20px 8px rgba(16, 24, 40, 0.05)` |
| `--shadow-datepicker` | `-5px 0 0 #262d3c, 5px 0 0 #262d3c` |
| `--drop-shadow-4xl` | `0 35px 35px rgba(0, 0, 0, 0.25), 0 45px 65px rgba(0, 0, 0, 0.15)` |

Notas:
- Todas las sombras de elevación usan **`rgba(16, 24, 40, α)`** = `#101828` = `gray-900`/`black`. Coherencia total: la sombra es el negro del sistema con alpha.
- `--shadow-focus-ring` usa **`rgba(70, 95, 255, .12)`** = `#465fff` = `brand-500`.
- `--shadow-datepicker` no es una sombra: es un **hack de relleno horizontal** (spread lateral ±5px, blur 0) para pintar el rango continuo de flatpickr en dark. El color `#262d3c` está hardcodeado y **no corresponde a ningún token** de la paleta.
- No existe `--shadow-theme-2xl`.
- Valores confirmados contra el compilado PRO (`--tw-shadow:` coinciden 1:1).

---

## 4. Breakpoints y z-index

### Breakpoints (8)

⚠️ **`--breakpoint-*: initial` borra TODOS los breakpoints de Tailwind y luego los redeclara.** Los 5 estándar se reponen con **valores idénticos** a los de fábrica; el reset existe solo para poder **insertar `2xsm`/`xsm` por debajo de `sm`** y `3xl` por arriba, manteniendo el orden de cascada correcto (Tailwind v4 ordena por declaración, no por valor).

| Token | Valor | ¿Custom? |
|---|---|---|
| `--breakpoint-2xsm` | `375px` | 🆕 custom |
| `--breakpoint-xsm` | `425px` | 🆕 custom |
| `--breakpoint-sm` | `640px` | = default |
| `--breakpoint-md` | `768px` | = default |
| `--breakpoint-lg` | `1024px` | = default |
| `--breakpoint-xl` | `1280px` | = default |
| `--breakpoint-2xl` | `1536px` | = default |
| `--breakpoint-3xl` | `2000px` | 🆕 custom |

**Efecto colateral del reset**: desaparece cualquier breakpoint que no esté en la lista. `3xl` **no** es el `3xl` de Tailwind v4 (1920px) — aquí es **2000px**.

**Orden de declaración roto**: `2xsm`/`xsm`/`3xl` se declaran *antes* que `sm`…`2xl`, no en orden ascendente de valor. Funciona, pero es frágil si se añaden más.

### Z-index (7)

| Token | Valor |
|---|---|
| `--z-index-1` | `1` |
| `--z-index-9` | `9` |
| `--z-index-99` | `99` |
| `--z-index-999` | `999` |
| `--z-index-9999` | `9999` |
| `--z-index-99999` | `99999` |
| `--z-index-999999` | `999999` |

Escala logarítmica por nº de nueves → utilidades `z-1`, `z-9`, `z-99`, `z-999`, `z-9999`, `z-99999`, `z-999999`. No hay semántica (`z-modal`, `z-tooltip`); la capa se elige por magnitud. `z-1` se aplica al `body` en el repo Vue.

---

## 5. Grupos AUSENTES del `@theme` (importante)

TailAdmin **no personaliza** estos ejes — hereda los defaults de Tailwind v4 intactos:

| Eje | Estado |
|---|---|
| **Radios** (`--radius-*`) | ❌ sin tokens custom. Usa los nativos: `xs .125rem`, `sm .25rem`, `md .375rem`, `lg .5rem`, `xl .75rem`, `2xl 1rem`, `3xl 1.5rem`. (Confirmado en el compilado PRO.) |
| **Espaciado** (`--spacing-*`) | ❌ sin tokens custom. `--spacing: 0.25rem` (base nativa v4, escala dinámica). |
| **Containers** (`--container-*`) | ❌ nativos (`xs 20rem` … `4xl 56rem`). |
| **Easings / animaciones** | ❌ nativos (`--ease-in-out`, `--animate-spin`, `--animate-ping`). |
| **Font weights** | ❌ nativos (`400/500/600/700`). |
| **Blur** | ❌ nativos (`--blur-xs 4px`, `--blur-sm 8px`). |

Es decir: el sistema custom cubre **color, tipografía, sombra, breakpoint y z-index**. Todo lo demás es Tailwind de fábrica.

---

## 6. Declaración del tema — bloque literal

Sí, es **Tailwind v4 con `@theme`** (CSS-first, sin `tailwind.config.js`). Sí, usa **`@custom-variant dark`**.

Copiado textualmente de `tailadmin-html/src/css/style.css` (líneas 1–166) — free, MIT, listo para pegar:

```css
@import url("https://fonts.googleapis.com/css2?family=Outfit:wght@100..900&display=swap")
layer(base);

@import "tailwindcss";

@custom-variant dark (&:is(.dark *));

@theme {
  --font-*: initial;
  --font-outfit: Outfit, sans-serif;

  --breakpoint-*: initial;
  --breakpoint-2xsm: 375px;
  --breakpoint-xsm: 425px;
  --breakpoint-3xl: 2000px;
  --breakpoint-sm: 640px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 1024px;
  --breakpoint-xl: 1280px;
  --breakpoint-2xl: 1536px;

  --text-title-2xl: 72px;
  --text-title-2xl--line-height: 90px;
  --text-title-xl: 60px;
  --text-title-xl--line-height: 72px;
  --text-title-lg: 48px;
  --text-title-lg--line-height: 60px;
  --text-title-md: 36px;
  --text-title-md--line-height: 44px;
  --text-title-sm: 30px;
  --text-title-sm--line-height: 38px;
  --text-theme-xl: 20px;
  --text-theme-xl--line-height: 30px;
  --text-theme-sm: 14px;
  --text-theme-sm--line-height: 20px;
  --text-theme-xs: 12px;
  --text-theme-xs--line-height: 18px;

  --color-current: currentColor;
  --color-transparent: transparent;
  --color-white: #ffffff;
  --color-black: #101828;

  --color-brand-25: #f2f7ff;
  --color-brand-50: #ecf3ff;
  --color-brand-100: #dde9ff;
  --color-brand-200: #c2d6ff;
  --color-brand-300: #9cb9ff;
  --color-brand-400: #7592ff;
  --color-brand-500: #465fff;
  --color-brand-600: #3641f5;
  --color-brand-700: #2a31d8;
  --color-brand-800: #252dae;
  --color-brand-900: #262e89;
  --color-brand-950: #161950;

  --color-blue-light-25: #f5fbff;
  --color-blue-light-50: #f0f9ff;
  --color-blue-light-100: #e0f2fe;
  --color-blue-light-200: #b9e6fe;
  --color-blue-light-300: #7cd4fd;
  --color-blue-light-400: #36bffa;
  --color-blue-light-500: #0ba5ec;
  --color-blue-light-600: #0086c9;
  --color-blue-light-700: #026aa2;
  --color-blue-light-800: #065986;
  --color-blue-light-900: #0b4a6f;
  --color-blue-light-950: #062c41;

  --color-gray-25: #fcfcfd;
  --color-gray-50: #f9fafb;
  --color-gray-100: #f2f4f7;
  --color-gray-200: #e4e7ec;
  --color-gray-300: #d0d5dd;
  --color-gray-400: #98a2b3;
  --color-gray-500: #667085;
  --color-gray-600: #475467;
  --color-gray-700: #344054;
  --color-gray-800: #1d2939;
  --color-gray-900: #101828;
  --color-gray-950: #0c111d;
  --color-gray-dark: #1a2231;

  --color-orange-25: #fffaf5;
  --color-orange-50: #fff6ed;
  --color-orange-100: #ffead5;
  --color-orange-200: #fddcab;
  --color-orange-300: #feb273;
  --color-orange-400: #fd853a;
  --color-orange-500: #fb6514;
  --color-orange-600: #ec4a0a;
  --color-orange-700: #c4320a;
  --color-orange-800: #9c2a10;
  --color-orange-900: #7e2410;
  --color-orange-950: #511c10;

  --color-success-25: #f6fef9;
  --color-success-50: #ecfdf3;
  --color-success-100: #d1fadf;
  --color-success-200: #a6f4c5;
  --color-success-300: #6ce9a6;
  --color-success-400: #32d583;
  --color-success-500: #12b76a;
  --color-success-600: #039855;
  --color-success-700: #027a48;
  --color-success-800: #05603a;
  --color-success-900: #054f31;
  --color-success-950: #053321;

  --color-error-25: #fffbfa;
  --color-error-50: #fef3f2;
  --color-error-100: #fee4e2;
  --color-error-200: #fecdca;
  --color-error-300: #fda29b;
  --color-error-400: #f97066;
  --color-error-500: #f04438;
  --color-error-600: #d92d20;
  --color-error-700: #b42318;
  --color-error-800: #912018;
  --color-error-900: #7a271a;
  --color-error-950: #55160c;

  --color-warning-25: #fffcf5;
  --color-warning-50: #fffaeb;
  --color-warning-100: #fef0c7;
  --color-warning-200: #fedf89;
  --color-warning-300: #fec84b;
  --color-warning-400: #fdb022;
  --color-warning-500: #f79009;
  --color-warning-600: #dc6803;
  --color-warning-700: #b54708;
  --color-warning-800: #93370d;
  --color-warning-900: #7a2e0e;
  --color-warning-950: #4e1d09;

  --color-theme-pink-500: #ee46bc;

  --color-theme-purple-500: #7a5af8;

  --shadow-theme-md: 0px 4px 8px -2px rgba(16, 24, 40, 0.1),
    0px 2px 4px -2px rgba(16, 24, 40, 0.06);
  --shadow-theme-lg: 0px 12px 16px -4px rgba(16, 24, 40, 0.08),
    0px 4px 6px -2px rgba(16, 24, 40, 0.03);
  --shadow-theme-sm: 0px 1px 3px 0px rgba(16, 24, 40, 0.1),
    0px 1px 2px 0px rgba(16, 24, 40, 0.06);
  --shadow-theme-xs: 0px 1px 2px 0px rgba(16, 24, 40, 0.05);
  --shadow-theme-xl: 0px 20px 24px -4px rgba(16, 24, 40, 0.08),
    0px 8px 8px -4px rgba(16, 24, 40, 0.03);
  --shadow-datepicker: -5px 0 0 #262d3c, 5px 0 0 #262d3c;
  --shadow-focus-ring: 0px 0px 0px 4px rgba(70, 95, 255, 0.12);
  --shadow-slider-navigation: 0px 1px 2px 0px rgba(16, 24, 40, 0.1),
    0px 1px 3px 0px rgba(16, 24, 40, 0.1);
  --shadow-tooltip: 0px 4px 6px -2px rgba(16, 24, 40, 0.05),
    -8px 0px 20px 8px rgba(16, 24, 40, 0.05);

  --drop-shadow-4xl: 0 35px 35px rgba(0, 0, 0, 0.25),
    0 45px 65px rgba(0, 0, 0, 0.15);

  --z-index-1: 1;
  --z-index-9: 9;
  --z-index-99: 99;
  --z-index-999: 999;
  --z-index-9999: 9999;
  --z-index-99999: 99999;
  --z-index-999999: 999999;
}
```

### ⚠️ Los `--*: initial` — leer antes de copiar

Dos líneas del bloque son **destructivas** y quien copie el `@theme` sin entenderlas pierde defaults:

| Línea | Qué borra | Qué pasa si la copias |
|---|---|---|
| `--font-*: initial;` | **Todas** las familias de Tailwind (`font-sans`, `font-mono`, `font-serif`) | `font-mono` deja de existir → los bloques de código pierden la monoespaciada. `--default-font-family: var(--font-sans)` queda sin resolver → **necesitas la regla `body`** (ver §2) |
| `--breakpoint-*: initial;` | **Todos** los breakpoints | Solo sobreviven los 8 redeclarados. Cualquier `min-*`/breakpoint no listado desaparece |

Si quieres los tokens de TailAdmin **sin** perder los defaults, **omite las dos líneas `: initial`** y quedarán aditivos (`sm`…`2xl` se redeclaran con valores idénticos a los nativos, así que no hay conflicto; solo se suman `2xsm`, `xsm`, `3xl`, `font-outfit`).

### Complemento obligatorio (compatibilidad v3)

Va **fuera** del `@theme`. En v4 el borde por defecto es `currentColor`; sin esto, todo borde sin clase explícita cambia de color:

```css
@layer base {
  *, ::after, ::before, ::backdrop, ::file-selector-button {
    border-color: var(--color-gray-200, currentColor);
  }
  button:not(:disabled), [role="button"]:not(:disabled) { cursor: pointer; }
}
```

El repo **Vue** añade además:
```css
@layer base {
  body { @apply relative font-normal font-outfit z-1 bg-gray-50; }
}
```

---

## 7. Estrategia de dark mode

**Clase `.dark` en `<html>`, propagada a descendientes.**

```css
@custom-variant dark (&:is(.dark *));
```

Mecánica:
- Redefine la variante `dark:` de Tailwind, que por defecto es `prefers-color-scheme`. **`prefers-color-scheme` no se consulta nunca** — el tema es 100 % manual.
- `&:is(.dark *)` = "este elemento, si es **descendiente** de algo con `.dark`". Nótese el espacio: `.dark *`. El propio `<html.dark>` **no** matchea sus propias utilidades `dark:` (irrelevante en la práctica, las clases van en el body hacia abajo).
- `:is()` mantiene la especificidad en (0,1,0) — no escala con el anidamiento.
- Compilado: **265 ocurrencias** de `:is(.dark *)` en el CSS PRO.
- En las utilidades se usa como prefijo estándar: `dark:bg-gray-900`, `dark:text-white/90`, `dark:border-gray-800`.

**Activación** (`tailadmin-vue/src/components/layout/ThemeProvider.vue`):

```js
// onMounted: lee localStorage, default 'light'
const savedTheme = localStorage.getItem('theme') as Theme | null
const initialTheme = savedTheme || 'light'

// watch([theme, isInitialized]):
localStorage.setItem('theme', newTheme)
if (newTheme === 'dark') document.documentElement.classList.add('dark')
else                     document.documentElement.classList.remove('dark')
```

- Provide/inject: `provide('theme', { isDarkMode, toggleTheme })` + `useTheme()` que lanza si se usa fuera del provider.
- Persistencia en `localStorage['theme']` (`'light'` | `'dark'`).
- **Default `light`**, ignorando la preferencia del SO.
- ⚠️ **FOUC**: la clase se aplica en `onMounted`, no en un script bloqueante en `<head>`. Un usuario con tema oscuro guardado ve un flash claro en cada carga. Si se adopta, conviene un script inline en el `<head>` que lea `localStorage` antes del primer paint.

### Convenciones de dark mode observadas

Patrones recurrentes en el CSS del repo (no son tokens, pero son el contrato de uso):

| Rol | Light | Dark |
|---|---|---|
| Fondo página | `bg-gray-50` | `dark:bg-gray-900` |
| Superficie/card | `bg-white` | `dark:bg-gray-800` / `dark:bg-white/[0.03]` |
| Borde | `border-gray-200` | `dark:border-gray-800` |
| Texto principal | `text-gray-800` | `dark:text-white/90` |
| Texto secundario | `text-gray-700` / `text-gray-500` | `dark:text-gray-400` |
| Hover sutil | `hover:bg-gray-100` | `dark:hover:bg-white/5` |
| Acento activo | `bg-brand-50 text-brand-500` | `dark:bg-brand-500/[0.12] dark:text-brand-400` |

Dos observaciones sobre el dark:
1. El texto blanco **nunca es `#fff` puro**: siempre `white/90`. El blanco puro solo aparece como fondo en light.
2. En dark, las superficies elevadas se hacen con **alpha sobre blanco** (`white/[0.03]`, `white/5`), no con grises sólidos — salvo `gray-800` para cards. `--color-gray-dark` (`#1a2231`) existe para este rol pero apenas se usa.
