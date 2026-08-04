# TailAdmin PRO — Recetas de clases de componentes atómicos

Extraído literal del markup de `demo-pages/` (87 páginas Alpine.js de demo.tailadmin.com).
Cubre: buttons, buttons-group, badge, alerts, avatars, spinners, ribbons, breadcrumb, links,
list, progress-bar, tabs, pagination, dropdowns, popovers, modals, cards, carousel, images,
notifications.

**Alcance / fidelidad**
- Todas las cadenas de clases son **copia literal** del HTML. El orden de clases es el del
  original (TailAdmin **no** lo normaliza: coexiste `px-4 py-3 … rounded-lg bg-brand-500` con
  `rounded-lg bg-brand-500 px-4 py-3 …` para el mismo botón).
- `style.css` y `bundle.js` **no** se descargaron con las páginas. Los tokens custom
  (`brand-*`, `success-*`, `error-*`, `warning-*`, `blue-light-*`, `shadow-theme-*`,
  `text-theme-*`, `text-title-*`, `dark-900`, `z-99999`, `h-9.5`, `custom-scrollbar`,
  `no-scrollbar`, `xsm:`) **no** están definidos aquí — hay que replicarlos en el tema.
- Lo generado por JS (contenedor del popover, controles de Swiper) no existe en el markup
  estático; se marca abajo donde aplica.

---

## 0. Chrome común de las páginas de demo

Todas las páginas de UI kit envuelven cada demo en la misma "showcase card". No es un
componente del kit, pero domina el markup y conviene reconocerlo para no confundirlo con el
componente real.

```html
<main>
  <div class="mx-auto max-w-(--breakpoint-2xl) p-4 pb-20 md:p-6 md:pb-6">
    <!-- page heading + breadcrumb (ver §8) -->
    <div class="space-y-5 sm:space-y-6">        <!-- o: grid grid-cols-1 gap-5 xl:grid-cols-2 xl:gap-6 -->
      <div class="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div class="px-6 py-5">
          <h3 class="text-base font-medium text-gray-800 dark:text-white/90">Section title</h3>
        </div>
        <div class="border-t border-gray-100 p-4 sm:p-6 dark:border-gray-800">
          <!-- el componente demostrado -->
        </div>
      </div>
    </div>
  </div>
</main>
```

| Pieza | Clases |
|---|---|
| Contenedor de página | `mx-auto max-w-(--breakpoint-2xl) p-4 pb-20 md:p-6 md:pb-6` (avatars/carousel usan `mx-auto max-w-(--breakpoint-2xl) p-4 md:p-6`) |
| Stack de secciones | `space-y-5 sm:space-y-6` |
| Grid de secciones (2 col) | `grid grid-cols-1 gap-5 xl:grid-cols-2 xl:gap-6` (links/ribbons: `grid grid-cols-1 gap-5 sm:gap-6 lg:grid-cols-2`) |
| Card de showcase | `rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]` |
| Header de card | `px-6 py-5` + h3 `text-base font-medium text-gray-800 dark:text-white/90` |
| Body de card | `border-t border-gray-100 p-4 sm:p-6 dark:border-gray-800` (varía: `p-6`, `p-8`, `p-6 xl:p-10`, `p-3 sm:p-6`, `p-5 sm:p-6`, `px-6 py-6.5`) |

**Superficie estándar**: `bg-white` + `dark:bg-white/[0.03]`; borde `border-gray-200` +
`dark:border-gray-800`. Los divisores internos usan `border-gray-100` + `dark:border-gray-800`.
Los overlays "flotantes" (dropdown, popover, toast) rompen el patrón y usan hex crudos:
`dark:bg-[#1E2635]`, `dark:bg-[#1E2634]`, `dark:bg-[#353C49]`, `dark:bg-[#1e2636]`.

---

## 1. Buttons

Estructura DOM mínima — el icono es hermano del texto, no va envuelto:

```html
<button class="inline-flex items-center gap-2 px-4 py-3 text-sm font-medium text-white transition rounded-lg bg-brand-500 shadow-theme-xs hover:bg-brand-600">
  <svg class="fill-current" width="20" height="20" viewBox="0 0 20 20" fill="none">…</svg>
  Button Text
</button>
```

Base común a todo: `inline-flex items-center gap-2` + `text-sm font-medium` + `rounded-lg` +
`shadow-theme-xs` + `transition`. Solo hay **2 tamaños** y **2 variantes**.

| Variante | Size | Cadena literal |
|---|---|---|
| Primary | md | `inline-flex items-center gap-2 px-4 py-3 text-sm font-medium text-white transition rounded-lg bg-brand-500 shadow-theme-xs hover:bg-brand-600` |
| Primary | lg | `inline-flex items-center gap-2 rounded-lg bg-brand-500 px-5 py-3.5 text-sm font-medium text-white shadow-theme-xs transition hover:bg-brand-600` |
| Secondary | md | `inline-flex items-center gap-2 rounded-lg bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-theme-xs ring-1 ring-inset ring-gray-300 transition hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700 dark:hover:bg-white/[0.03]` |
| Secondary | lg | `inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3.5 text-sm font-medium text-gray-700 shadow-theme-xs ring-1 ring-inset ring-gray-300 transition hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700 dark:hover:bg-white/[0.03]` |

- **Sizes**: md = `px-4 py-3`; lg = `px-5 py-3.5`. No hay `sm`.
- **Icono izq/der**: misma cadena; solo cambia el orden del `<svg>` respecto al texto. El `gap-2` hace el espaciado. El svg lleva `class="fill-current"` `width/height=20`.
- ⚠️ **Inconsistencia real de la demo**: las variantes Secondary **con icono** pierden `ring-inset` → usan `ring-1 ring-gray-300` (sin `inset`). Es un bug del kit, no un matiz de diseño. Unificar a `ring-1 ring-inset ring-gray-300`.
- ⚠️ **No existe** variante `disabled`, `ghost`, `danger`, ni size `sm` en `buttons.html`. Único `disabled:` del corpus revisado está en list (§10): `disabled:opacity-50`.

### Botón con spinner (de `spinners.html`)

```html
<button type="button" class="flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-5 py-3.5 text-sm font-medium text-white shadow-theme-xs hover:bg-brand-600">
  <span class="animate-spin"><svg width="20" height="20" …></svg></span>
  Loading...
</button>
```

| Variante | Cadena |
|---|---|
| Primary loading | `flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-5 py-3.5 text-sm font-medium text-white shadow-theme-xs hover:bg-brand-600` |
| Secondary loading | `flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-5 py-3.5 text-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] dark:hover:text-gray-200` |
| Wrapper del spinner | `animate-spin` / `animate-spin stroke-brand-500 text-gray-200 dark:text-gray-800` |

⚠️ Ojo: este Secondary usa `border border-gray-300` (no `ring-1 ring-inset`) — **tercera** forma de dibujar el borde secundario en el kit. La misma cadena `border`-based se repite en pagination, notifications, modals y popovers; es **de facto la dominante** fuera de `buttons.html`.

---

## 2. Button group

```html
<div class="custom-scrollbar max-w-full overflow-x-auto pb-3 xsm:pb-0">
  <div class="min-w-[309px]">                       <!-- 393px si llevan icono -->
    <div class="inline-flex items-center shadow-theme-xs">
      <button type="button" class="…primero…">Button Text</button>
      <button type="button" class="-ml-px …resto…">Button Text</button>
      <button type="button" class="-ml-px …resto…">Button Text</button>
    </div>
  </div>
</div>
```

Mecánica: el **wrapper** lleva `shadow-theme-xs`; los botones usan `ring-1 ring-inset`,
`first:rounded-l-lg last:rounded-r-lg` para las esquinas y `-ml-px` (desde el 2º) para
colapsar los bordes.

| Variante | Cadena literal |
|---|---|
| Primary — activo (1º) | `inline-flex items-center gap-2 bg-brand-500 px-4 py-3 text-sm font-medium text-white ring-1 ring-inset ring-brand-500 transition first:rounded-l-lg last:rounded-r-lg hover:bg-brand-500` |
| Primary — inactivo | `-ml-px inline-flex items-center gap-2 bg-transparent px-4 py-3 text-sm font-medium text-brand-500 ring-1 ring-inset ring-brand-500 first:rounded-l-lg last:rounded-r-lg hover:bg-brand-500 hover:text-white` |
| Secondary — activo (1º) | `inline-flex items-center gap-2 bg-transparent px-4 py-3 text-sm font-medium text-gray-800 ring-1 ring-inset ring-gray-300 transition first:rounded-l-lg last:rounded-r-lg hover:bg-gray-50 dark:bg-white/[0.03] dark:text-gray-200 dark:ring-gray-700 dark:hover:bg-white/[0.03]` |
| Secondary — inactivo | `-ml-px inline-flex items-center gap-2 bg-transparent px-4 py-3 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 transition first:rounded-l-lg last:rounded-r-lg hover:bg-gray-50 hover:text-gray-800 dark:bg-transparent dark:text-gray-400 dark:ring-gray-700 dark:hover:bg-white/[0.03]` |

- **Con icono**: en Primary el `<svg>` va suelto; en Secondary va envuelto en
  `<span class="fill-gray-800 group-hover:fill-gray-800 dark:fill-gray-200 dark:group-hover:fill-gray-200">`.
  ⚠️ Ese `group-hover:` es código muerto: no hay ningún ancestro con `group`.
- ⚠️ En Secondary con icono, los botones inactivos cambian a `dark:text-gray-200` (variante
  left-icon) vs `dark:text-gray-400` (right-icon y sin icono). Inconsistencia de la demo.
- El scroll wrapper alterna `xsm:pb-0` (sin icono) y `sm:pb-0` (con icono). `xsm` es un
  breakpoint custom de TailAdmin.

---

## 3. Badge

```html
<span class="inline-flex items-center justify-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-sm font-medium text-brand-500 dark:bg-brand-500/15 dark:text-brand-400">
  Primary
</span>
```

Base: `inline-flex items-center justify-center gap-1 rounded-full text-sm font-medium`.
Ejes: **fondo** (light | solid) × **color** (7) × **icono** (none | left | right).

**Padding según icono** (único cambio que introduce el icono):

| Icono | Padding |
|---|---|
| ninguno | `px-2.5 py-0.5` |
| izquierda | `py-0.5 pl-2 pr-2.5` |
| derecha | `py-0.5 pl-2.5 pr-2` |

El `<svg>` es hermano del texto, `class="fill-current"` `width/height=12`.

**Light background**

| Color | Cadena de color |
|---|---|
| Primary | `bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400` |
| Success | `bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500` |
| Error | `bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-500` |
| Warning | `bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-orange-400` |
| Info | `bg-blue-light-50 text-blue-light-500 dark:bg-blue-light-500/15 dark:text-blue-light-500` |
| Light | `bg-gray-100 text-gray-700 dark:bg-white/5 dark:text-white/80` |
| Dark | `bg-gray-500 text-white dark:bg-white/5 dark:text-white` |

**Solid background**

| Color | Cadena de color |
|---|---|
| Primary | `bg-brand-500 text-white` |
| Success | `bg-success-500 text-white` |
| Error | `bg-error-500 text-white` |
| Warning | `bg-warning-500 text-white` |
| Info | `bg-blue-light-500 text-white` |
| Light | `bg-gray-400 text-white dark:bg-white/5 dark:text-white/80` |
| Dark | `bg-gray-800 text-white dark:bg-white/15 dark:text-white` |

- Los 5 colores solid "de marca" **no declaran dark**: se ven igual en ambos temas. Solo Light/Dark llevan override.
- ⚠️ Warning es el único que rompe la simetría en dark: `dark:text-orange-400` en vez de `dark:text-warning-*`. Se repite en alerts y notifications — es sistemático, no un desliz suelto.
- Contenedor de la demo: `flex flex-wrap gap-4 sm:items-center sm:justify-center`.

### Badge de tab (de `tabs.html`, variante compacta)
`inline-block items-center justify-center rounded-full bg-brand-50 px-2 py-0.5 text-center text-xs font-medium text-brand-500 dark:bg-brand-500/15 dark:text-brand-400`

---

## 4. Alerts

```html
<div class="rounded-xl border border-success-500 bg-success-50 p-4 dark:border-success-500/30 dark:bg-success-500/15">
  <div class="flex items-start gap-3">
    <div class="-mt-0.5 text-success-500"><svg/></div>
    <div>
      <h4 class="mb-1 text-sm font-semibold text-gray-800 dark:text-white/90">Success Message</h4>
      <p class="text-sm text-gray-500 dark:text-gray-400">You can insert a description…</p>
      <a href="#" class="mt-3 inline-block text-sm font-medium text-gray-500 underline dark:text-gray-400">Learn more</a>
    </div>
  </div>
</div>
```

Base: `rounded-xl p-4` + `border` de color. Variantes = 4 colores × {con link, sin link}.
El título, el cuerpo y el link son **neutros en las 4 variantes** (solo el borde/fondo/icono tiñen).

| Variante | Contenedor | Color del icono |
|---|---|---|
| Success | `rounded-xl border border-success-500 bg-success-50 p-4 dark:border-success-500/30 dark:bg-success-500/15` | `-mt-0.5 text-success-500` |
| Warning | `rounded-xl border border-warning-500 bg-warning-50 p-4 dark:border-warning-500/30 dark:bg-warning-500/15` | `-mt-0.5 text-warning-500 dark:text-orange-400` |
| Error | `rounded-xl border border-error-500 bg-error-50 p-4 dark:border-error-500/30 dark:bg-error-500/15` | `-mt-0.5 text-error-500` |
| Info | `rounded-xl border border-blue-light-500 bg-blue-light-50 p-4 dark:border-blue-light-500/30 dark:bg-blue-light-500/15` | `-mt-0.5 text-blue-light-500` |

| Pieza fija | Clases |
|---|---|
| Row | `flex items-start gap-3` |
| Título | `mb-1 text-sm font-semibold text-gray-800 dark:text-white/90` |
| Cuerpo | `text-sm text-gray-500 dark:text-gray-400` |
| Link "Learn more" | `mt-3 inline-block text-sm font-medium text-gray-500 underline dark:text-gray-400` |
| Stack de la demo | `space-y-6` |

Patrón dark del alert: borde a `/30`, fondo a `/15`. La variante "sin link" es idéntica menos el `<a>`.
⚠️ El Info alert de la demo titula "Success Message" (copy-paste del kit).

---

## 5. Avatars

```html
<div class="relative h-10 w-full max-w-10 rounded-full">
  <img src="…" alt="user" class="overflow-hidden rounded-full" />
  <span class="absolute bottom-0 right-0 h-2.5 w-full max-w-2.5 rounded-full border-[1.5px] border-white bg-success-500 dark:border-gray-900"></span>
</div>
```

Wrapper: `relative h-{n} w-full max-w-{n} rounded-full`. Img: `overflow-hidden rounded-full`.
Indicador: `absolute bottom-0 right-0 h-{i} w-full max-w-{i} rounded-full border-[1.5px] border-white bg-{color} dark:border-gray-900`.

| Size | Wrapper | Indicador (h/max-w) |
|---|---|---|
| xs | `relative h-6 w-full max-w-6 rounded-full` | `h-1.5 … max-w-1.5` |
| sm | `relative h-8 w-full max-w-8 rounded-full` | `h-2 … max-w-2` |
| md | `relative h-10 w-full max-w-10 rounded-full` | `h-2.5 … max-w-2.5` |
| lg | `relative h-12 w-full max-w-12 rounded-full` | `h-3 … max-w-3` |
| xl | `relative h-14 w-full max-w-14 rounded-full` | `h-3.5 … max-w-3.5` |
| 2xl | `relative h-16 w-full max-w-16 rounded-full` | `h-4 … max-w-4` |

| Estado | Color del indicador |
|---|---|
| online | `bg-success-500` |
| offline | `bg-error-500` |
| busy | `bg-warning-500` |

- Regla de escala: indicador = ¼ del avatar. El borde es `border-[1.5px] border-white dark:border-gray-900` en los 3 estados.
- El `w-full max-w-{n}` (en vez de `w-{n}`) es el modismo del kit para que el avatar no se estire en flex.
- ⚠️ **No hay** avatar group/stack, ni avatar con iniciales/placeholder, ni indicador "away" en `avatars.html`. Solo 4 secciones: default + 3 estados.
- Contenedor de la demo: `flex flex-col items-center justify-center gap-5 sm:flex-row`.

---

## 6. Spinners

```html
<div class="animate-spin stroke-brand-500 text-gray-200 dark:text-gray-800">
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none">…</svg>
</div>
```

Toda la variación vive en el **SVG** (que no se reproduce aquí); las clases son mínimas.

| Variante | Wrapper | Sizes disponibles (w/h del svg) |
|---|---|---|
| Spinner 1 | `animate-spin stroke-brand-500 text-gray-200 dark:text-gray-800` | 20, 28, 36, 40, 48 |
| Spinner 2 | `animate-spin` | 20, 28, 36, 40, 48 |
| Spinner 3 | `animate-spin` | 20, 28, 36, 40, **52** |
| En botón | `animate-spin` o `animate-spin stroke-brand-500 text-gray-200 dark:text-gray-800` (`<span>`, svg 20) | 20 |

- Spinner 1 es el único "theme-able" por clases: su SVG usa `stroke="currentColor"` (la pista, la
  pinta `text-gray-200 dark:text-gray-800`) y `stroke="currentStroke"` (el arco, vía `stroke-brand-500`).
- ⚠️ Spinners 2 y 3 llevan el color **hardcodeado en el SVG**: `fill="#465FFF"` inline (sin gradientes,
  sin `currentColor`) → **no se retematizan con clases** ni respetan dark mode. Al portarlos hay que
  reescribir el SVG a `fill="currentColor"`. (`#465FFF` aparece 231× en la demo siempre donde tocaría
  el color de marca → casi seguro es el valor de `brand-500`, pero **sin `style.css` no se puede
  confirmar**.)
- Contenedor: `flex items-center justify-center gap-4 sm:justify-normal`.

---

## 7. Ribbons

Contenedor común: `relative overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 dark:bg-white/[0.03]`,
con el cuerpo en `<div class="p-5 pt-16">` (el `pt-16` reserva el hueco de la cinta).

```html
<div class="relative overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 dark:bg-white/[0.03]">
  <span class="absolute -left-px mt-3 inline-block rounded-r-full bg-brand-500 px-4 py-1.5 text-sm font-medium text-white">Popular</span>
  <div class="p-5 pt-16"><p class="text-sm text-gray-500 dark:text-gray-400">…</p></div>
</div>
```

| Variante | Cinta — cadena literal |
|---|---|
| Rounded | `absolute -left-px mt-3 inline-block rounded-r-full bg-brand-500 px-4 py-1.5 text-sm font-medium text-white` |
| With Shape | `after:bottom-0-0 absolute -left-px mt-3 inline-block bg-brand-500 px-4 py-1.5 text-sm font-medium text-white before:absolute before:-right-4 before:top-0 before:border-[13px] before:border-transparent before:border-l-brand-500 before:border-t-brand-500 before:content-[''] after:absolute after:-right-4 after:border-[13px] after:border-transparent after:border-b-brand-500 after:border-l-brand-500 after:content-['']` |
| Filed (esquina 45°) | `absolute -left-9 -top-7 mt-3 flex h-14 w-24 -rotate-45 items-end justify-center bg-brand-500 px-4 py-1.5 text-sm font-medium text-white shadow-theme-xs` |
| On Hover (slide-in) | `after:bottom-0-0 group absolute -left-px mt-3 flex -translate-x-[55px] items-center gap-1 bg-brand-500 px-4 py-1.5 text-sm font-medium text-white transition-transform duration-500 ease-in-out before:absolute before:-right-4 before:top-0 before:border-[16px] before:border-transparent before:border-l-brand-500 before:border-t-brand-500 before:content-[''] after:absolute after:-right-4 after:border-[16px] after:border-transparent after:border-b-brand-500 after:border-l-brand-500 after:content-[''] group-hover:translate-x-0` |

- La "cola" en pico se dibuja con `before:`/`after:` de `border-[13px]` (o `[16px]` en hover) transparentes con dos lados teñidos.
- Hover: el **contenedor** lleva `group`; la cinta arranca en `-translate-x-[55px]` y vuelve a 0 con `group-hover:translate-x-0`. El label interior es `opacity-0 transition-opacity duration-300 ease-linear group-hover:opacity-100`.
- ⚠️ `after:bottom-0-0` **no es una clase Tailwind válida** (typo del kit, no genera CSS). Aparece en 2 de las 4 variantes. Borrable.
- ⚠️ La 4ª card se titula "Filed Ribbon" (duplicado de la 3ª); por contenido es "Ribbon on Hover".
- Layout de la página: `grid grid-cols-1 gap-5 sm:gap-6 lg:grid-cols-2`.

---

## 8. Breadcrumb

```html
<nav>
  <ol class="flex flex-wrap items-center gap-1.5">
    <li>
      <a class="flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-500 dark:text-gray-400 dark:hover:text-brand-400" href="index.html">Home</a>
    </li>
    <li class="flex items-center gap-1.5 text-sm text-gray-800 dark:text-white/90">
      <span> / </span>
      <span> Ui Kits </span>
    </li>
  </ol>
</nav>
```

Regla: **el separador vive dentro del `<li>` siguiente**, no entre items.
Link intermedio = `text-gray-500` + hover brand; item actual = `text-gray-800 dark:text-white/90` sin hover.

| Variante | `<ol>` | Link | Separador |
|---|---|---|---|
| Default | `flex flex-wrap items-center gap-1.5` | `flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-500 dark:text-gray-400 dark:hover:text-brand-400` | `<span> / </span>` |
| With Icons | `flex flex-wrap items-center gap-1.5` | `flex items-center gap-1 text-sm text-gray-500 hover:text-brand-500 dark:text-gray-400 dark:hover:text-brand-400` (gap-**1**) + `<svg>` antes del texto | `<span> / </span>` |
| Divider | `flex flex-wrap items-center gap-1.5` | igual que Default | `<span class="text-gray-500 dark:text-gray-400"><svg/></span>` (chevron) |
| Dotted | `flex flex-wrap items-center gap-2` | `flex items-center gap-2 …` (gap-**2**) | `<span class="block h-1 w-1 rounded-full bg-gray-400"> </span>` |

- Item actual: `flex items-center gap-1.5 text-sm text-gray-800 dark:text-white/90` (gap-2 en Dotted).
- En el item actual el `/` se tiñe `text-gray-500 dark:text-gray-400` para no heredar el gris oscuro del texto.

### Page header (el que usan las 87 páginas)
```html
<div class="flex flex-wrap items-center justify-between gap-3 pb-6">
  <h2 class="text-xl font-semibold text-gray-800 dark:text-white/90" x-text="pageName"></h2>
  <nav>
    <ol class="flex items-center gap-1.5">
      <li><a class="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400" href="index.html">Home <svg class="stroke-current" width="17" height="16">…</svg></a></li>
      <li class="text-sm text-gray-800 dark:text-white/90" x-text="pageName"></li>
    </ol>
  </nav>
</div>
```
Envuelto en `<div x-data="{ pageName: \`Buttons\`}">`. Aquí el chevron va **dentro** del link Home (no como separador) y el link **no** lleva hover.

---

## 9. Links

Base: `text-sm font-normal` + color. Sin `hover:` salvo en la familia opacity-hover.

| Variante | Cadena |
|---|---|
| Gray (llamado "Primary") | `text-sm font-normal text-gray-500 dark:text-gray-400` |
| Brand ("Secondary") | `text-sm font-normal text-brand-500 dark:text-brand-500` |
| Success | `text-sm font-normal text-success-500` |
| Danger | `text-sm font-normal text-error-500` |
| Warning | `text-sm font-normal text-warning-500` |
| Info | `text-sm font-normal text-blue-light-500` |
| Muted | `text-sm font-normal text-gray-400` |
| Strong | `text-sm font-normal text-gray-800 dark:text-white/90` |

**Underline**: añadir `underline` a cualquiera de las anteriores.
Ej: `text-sm font-normal text-gray-500 underline dark:text-gray-400`; `text-sm font-normal text-brand-500 underline` (⚠️ la versión underline de brand **pierde** el `dark:text-brand-500`).

**Opacity** (estático): `text-sm font-normal text-gray-500/{op} dark:text-gray-400/{op}` con op ∈ `10 | 25 | 50 | 75` + el 100 sin sufijo (`text-gray-500 dark:text-gray-400`).

**Opacity hover**: `text-sm font-normal text-gray-500 transition-colors hover:text-gray-500/{op} dark:hover:text-gray-400/{op}` con op ∈ `10 | 25 | 50 | 75`.
⚠️ El 5º item de esa lista pierde el `hover:` light (solo `dark:hover:text-gray-400/100`) y está etiquetado "Link opacity 50" — bug de la demo.

- Los nombres de la demo son poco fiables: 4 de los 8 links "Colored" se llaman "Primary link".
- Contenedor: `flex flex-col space-y-3`.

---

## 10. List

Contenedor: `rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] sm:w-fit`.
Item base: `flex items-center gap-2 border-b border-gray-200 px-3 py-2.5 text-sm text-gray-500 last:border-b-0 dark:border-gray-800 dark:text-gray-400`.

```html
<div class="rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] sm:w-fit">
  <ul class="flex flex-col">
    <li class="flex items-center gap-2 border-b border-gray-200 px-3 py-2.5 text-sm text-gray-500 last:border-b-0 dark:border-gray-800 dark:text-gray-400">
      <span class="ml-2 block h-[3px] w-[3px] rounded-full bg-gray-500 dark:bg-gray-400"></span>
      <span> Lorem ipsum dolor sit amet </span>
    </li>
  </ul>
</div>
```

| Variante | `<ul>`/`<ol>` | Marcador / contenido del item |
|---|---|---|
| Unordered | `flex flex-col` | `<span class="ml-2 block h-[3px] w-[3px] rounded-full bg-gray-500 dark:bg-gray-400">` |
| Ordered | `flex list-decimal flex-col` | número **hardcodeado en el texto** (`1. Lorem…`) ⚠️ `list-decimal` es inerte con `flex` |
| With Icon | `flex flex-col` | `<span class="text-brand-500 dark:text-brand-400"><svg/></span>` |
| Horizontal | `flex flex-col md:flex-row` | item: `… last:border-0 md:border-r md:border-b-0 …` |
| With button | `flex flex-col` | ver abajo |
| With checkbox | `flex flex-col` | ver abajo |
| With radio | `flex flex-col` | ver abajo |

**List with button** — el `<li>` solo pone el borde; el padding y el texto van en el `<button>`:
```html
<li class="border-b border-gray-200 last:border-b-0 dark:border-gray-800">
  <button class="flex w-full items-center gap-3 px-3 py-2.5 text-sm font-medium text-gray-500 hover:bg-brand-50 hover:text-brand-500 dark:text-gray-400 dark:hover:bg-brand-500/[0.12] dark:hover:text-brand-400">
    <span><svg/></span><span> Inbox </span>
  </button>
</li>
```
- Contenedor: `w-full overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] sm:w-[228px]`
- **Disabled** (único del corpus): `flex w-full items-center gap-3 px-3 py-2.5 text-sm font-medium text-gray-500 disabled:opacity-50 dark:text-gray-400` + atributo `disabled` (pierde los `hover:`).

**List with checkbox / radio** — checkbox real `sr-only` + caja pintada por Alpine:
```html
<li class="border-b border-gray-200 px-3 py-2.5 last:border-b-0 dark:border-gray-800">
  <div x-data="{ checkboxToggle: false }">
    <label for="listCheckboxOne" class="flex cursor-pointer select-none items-center text-sm text-gray-500 dark:text-gray-400">
      <span class="relative">
        <input type="checkbox" id="listCheckboxOne" class="sr-only" @change="checkboxToggle = !checkboxToggle" />
        <span :class="checkboxToggle ? 'border-brand-500 bg-brand-500' : 'bg-transparent border-gray-300 dark:border-gray-700'"
              class="mr-2 flex h-4 w-4 items-center justify-center rounded-sm border">
          <span :class="checkboxToggle ? '' : 'opacity-0'"><svg/></span>
        </span>
      </span>
      Lorem ipsum dolor sit amet
    </label>
  </div>
</li>
```
| Pieza | Checkbox | Radio |
|---|---|---|
| Caja | `mr-2 flex h-4 w-4 items-center justify-center rounded-sm border` | `mr-2 flex h-4 w-4 items-center justify-center rounded-full border` |
| Estado on/off (`:class`) | `border-brand-500 bg-brand-500` / `bg-transparent border-gray-300 dark:border-gray-700` | idéntico |
| Marca interior | `<span :class="checkboxToggle ? '' : 'opacity-0'"><svg/></span>` | `<span class="h-1.5 w-1.5 rounded-full" :class="checkboxToggle ? 'bg-white' : 'bg-white dark:bg-[#1e2636]'">` |

⚠️ La lista "radio" usa `type="checkbox"` con `x-data` **por item** → se comportan como checkboxes redondos, no como grupo exclusivo. Bug del kit; no copiar la semántica.
Layout de la página: `grid grid-cols-1 gap-5 xl:grid-cols-2 xl:gap-6`, cards con `col-span-2 … sm:col-span-1`.

---

## 11. Progress bar

```html
<div class="relative w-full h-2 rounded-sm bg-gray-200 dark:bg-gray-800">
  <div class="absolute left-0 w-[55%] h-full bg-brand-500 rounded-sm"></div>
</div>
```

Track: `relative w-full h-{n} rounded-{r} bg-gray-200 dark:bg-gray-800`.
Fill: `absolute left-0 w-[{pct}%] h-full bg-brand-500 rounded-{r}` (el % es **clase arbitraria**, no `style`).

| Variante | Track | Fill |
|---|---|---|
| Default | `relative w-full h-2 rounded-sm bg-gray-200 dark:bg-gray-800` | `absolute left-0 w-[55%] h-full bg-brand-500 rounded-sm` |
| Sizes | `relative w-full h-{2\|3\|4\|5} rounded-full bg-gray-200 dark:bg-gray-800` | `absolute left-0 w-[55%] h-full bg-brand-500 rounded-full` |
| Outside label | `sm:max-w-[281px] relative w-full h-2 rounded-sm bg-gray-200 dark:bg-gray-800` | `absolute left-0 w-[40%] h-full bg-brand-500 rounded-sm` |
| Inside label | `relative w-full h-4 rounded-full bg-gray-200 dark:bg-gray-800` | `absolute left-0 w-[40%] h-full bg-brand-500 rounded-full flex items-center justify-center text-white font-medium text-[10px] leading-tight` |

- Default usa `rounded-sm`; Sizes/Inside usan `rounded-full`.
- Outside label: row `flex items-center gap-3` + `<span class="text-sm font-medium text-gray-700 dark:text-gray-400">40%</span>`.
- Wrapper: `space-y-5 sm:max-w-[320px] w-full` (Sizes: `space-y-4 …`).
- ⚠️ Sin `role="progressbar"`/`aria-valuenow`. Sin variantes de color (solo `bg-brand-500`) ni animación/striped.

---

## 12. Tabs

Alpine: `x-data="{ activeTab: 'overview' }"`, botones con `x-bind:class` (activo/inactivo) y
`x-on:click`, paneles con `x-show`.

```html
<div x-data="{ activeTab: 'overview' }">
  <div class="rounded-t-xl border border-gray-200 p-3 dark:border-gray-800">
    <nav class="flex overflow-x-auto rounded-lg bg-gray-100 p-1 dark:bg-gray-900 …scrollbar…">
      <button class="inline-flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors duration-200 ease-in-out"
              x-bind:class="activeTab === 'overview' ? 'ACTIVO' : 'INACTIVO'"
              x-on:click="activeTab = 'overview'">Overview</button>
    </nav>
  </div>
  <div class="rounded-b-xl border border-t-0 border-gray-200 p-6 pt-4 dark:border-gray-800">
    <div x-show="activeTab === 'overview'">…</div>
  </div>
</div>
```

| Variante | Nav | Botón (base) | Activo | Inactivo |
|---|---|---|---|---|
| **Default** (pill) | `flex overflow-x-auto rounded-lg bg-gray-100 p-1 dark:bg-gray-900` + scrollbar utils | `inline-flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors duration-200 ease-in-out` | `bg-white text-gray-900 shadow-theme-xs dark:bg-white/[0.03] dark:text-white` | `bg-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200` |
| **Underline** | `-mb-px flex space-x-2 overflow-x-auto` + scrollbar utils, dentro de `<div class="border-b border-gray-200 dark:border-gray-800">` | `inline-flex items-center border-b-2 px-2.5 py-2 text-sm font-medium transition-colors duration-200 ease-in-out` | `text-brand-500 dark:text-brand-400 border-brand-500 dark:border-brand-400` | `bg-transparent text-gray-500 border-transparent hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200` |
| **Underline + icon** | idem | `inline-flex items-center gap-2 border-b-2 px-2.5 py-2 text-sm font-medium transition-colors duration-200 ease-in-out` | idem | idem |
| **Con badge** | idem | `inline-flex items-center gap-2 border-b-2 …` | idem | idem |
| **Vertical** | `flex w-full flex-row sm:flex-col sm:space-y-2` en wrapper `overflow-x-auto pb-2 sm:w-[200px]` + scrollbar utils | `inline-flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 ease-in-out sm:p-3` | `text-brand-500 dark:bg-brand-400/20 dark:text-brand-400 bg-brand-50` | `bg-transparent text-gray-500 border-transparent hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200` |

**Scrollbar utils** (repetido en cada nav):
`[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-200 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-track]:bg-white dark:[&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:h-1.5`
(la variante Underline **omite** `[&::-webkit-scrollbar-track]:bg-white`; Vertical usa `bg-gray-100` en el thumb).

| Pieza | Clases |
|---|---|
| Contenedor (underline/badge/vertical) | `rounded-xl border border-gray-200 p-6 dark:border-gray-800` |
| Panel (default) | `rounded-b-xl border border-t-0 border-gray-200 p-6 pt-4 dark:border-gray-800` |
| Panel (resto) | `pt-4 dark:border-gray-800` |
| Título de panel | `mb-1 text-xl font-medium text-gray-800 dark:text-white/90` |
| Cuerpo de panel | `text-sm text-gray-500 dark:text-gray-400` |
| Layout vertical | `flex flex-col gap-6 sm:flex-row sm:gap-8` + panel `flex-1` |

⚠️ Bugs literales en las cadenas `x-bind:class` de la demo (copiar limpiando):
- Tabs-with-badge: activo contiene una clase basura **`te`** (`… dark:text-brand-400  te`) en 3 de 4 tabs.
- Underline+icon: los tabs Analytics/Customers usan `dark:text-brand-500` (no `-400`) y **no** setean `dark:border-*`.
- Vertical: el 4º botón tiene **`py-2.5å`** (con `å`) → clase inválida, ese tab pierde el padding vertical. Además el 1º usa `py-2` y el resto `py-2.5`.
- El orden de clases dentro de las cadenas Alpine es inconsistente entre tabs (mismo resultado, ruido de diff).

---

## 13. Pagination

```html
<div class="flex items-center justify-between gap-2 px-6 py-4 sm:justify-normal">
  <button class="…prev…">…</button>
  <span class="block text-sm font-medium text-gray-700 dark:text-gray-400 sm:hidden">Page 1 of 10</span>
  <ul class="hidden items-center gap-0.5 sm:flex">
    <li><a href="#" class="…activo…">1</a></li>
    <li><a href="#" class="…normal…">2</a></li>
  </ul>
  <button class="…next…">…</button>
</div>
```

Responsive: en móvil se ocultan los números (`hidden … sm:flex`) y aparece "Page 1 of 10"
(`block … sm:hidden`).

| Pieza | Cadena |
|---|---|
| Wrapper | `flex items-center justify-between gap-2 px-6 py-4 sm:justify-normal` (variante "text+icon": `gap-8`) |
| Página activa | `flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500 text-sm font-medium text-white hover:bg-brand-500 hover:text-white` |
| Página normal / `...` | `flex h-10 w-10 items-center justify-center rounded-lg text-sm font-medium text-gray-700 hover:bg-brand-500 hover:text-white dark:text-gray-400 dark:hover:text-white` |
| Prev/Next (con texto) | `flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] dark:hover:text-gray-200 sm:px-3.5 sm:py-2.5` |
| Prev/Next (solo icono) | `flex items-center gap-2 rounded-lg border border-gray-300 bg-white p-2 sm:p-2.5 text-gray-700 shadow-theme-xs hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] dark:hover:text-gray-200` |
| Lista de números | `hidden items-center gap-0.5 sm:flex` |
| Label móvil | `block text-sm font-medium text-gray-700 dark:text-gray-400 sm:hidden` |

**3 variantes**, solo cambia el contenido de Prev/Next:
1. **With Text** — icono en móvil, texto en ≥sm: `<span class="inline sm:hidden"><svg/></span>` + `<span class="hidden sm:inline"> Previous </span>`
2. **With Text and Icon** — `<svg/>` siempre + `<span class="hidden sm:inline"> Previous </span>`
3. **With Icon** — solo `<span><svg/></span>`, botón cuadrado (`p-2 sm:p-2.5`, sin `text-sm font-medium`)

- El `...` usa exactamente la misma clase que un número (es un `<a href="#">` clicable). ⚠️ Debería ser inerte.
- ⚠️ La página activa lleva `hover:bg-brand-500 hover:text-white` (no-op deliberado para matar el hover).
- Sin `aria-current`, sin estado disabled en Prev/Next.

---

## 14. Dropdowns

Alpine: `x-data="{openDropDown: false}"` en el wrapper `relative inline-block`; el panel usa
`x-show` + `@click.outside`.

```html
<div x-data="{openDropDown: false}" class="relative inline-block">
  <a href="#" @click.prevent="openDropDown = !openDropDown"
     class="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-3 text-sm font-medium text-white hover:bg-brand-600">
    Account Menu <svg/>
  </a>
  <div x-show="openDropDown" @click.outside="openDropDown = false"
       class="absolute left-0 top-full z-40 mt-2 w-full min-w-[260px] rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg dark:border-gray-800 dark:bg-[#1E2635]">
    <ul class="flex flex-col gap-1">
      <li><a href="#" class="flex rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5">Edit Profile</a></li>
    </ul>
  </div>
</div>
```

| Pieza | Cadena |
|---|---|
| Wrapper | `relative inline-block` |
| Trigger | `inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-3 text-sm font-medium text-white hover:bg-brand-600` (⚠️ es un `<a>`, sin `shadow-theme-xs`) |
| Panel | `absolute left-0 top-full z-40 mt-2 w-full min-w-[260px] rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg dark:border-gray-800 dark:bg-[#1E2635]` |
| Lista | `flex flex-col gap-1` |
| Item (sin icono) | `flex rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5` |
| Item (con icono) | `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/5` |
| Divider | `<li><span class="my-1.5 block h-px w-full bg-gray-200 dark:bg-[#353C49]"></span></li>` |

**4 variantes** = {sin icono, con icono} × {sin divider, con divider}. El panel es idéntico en las 4.
- ⚠️ El item **sin icono de la 1ª card** usa `hover:bg-gray-100`; todas las demás usan `hover:bg-gray-50`. Elegir uno.
- El divider va como `<li>` dentro del `<ul>` (rompe la semántica de lista; mejor `<hr>` o `role="separator"`).
- Layout: `grid grid-cols-1 gap-5 xl:grid-cols-2 xl:gap-6`; cada demo se reserva alto con `pb-[300px]` / `pb-[350px]`.

---

## 15. Popovers

⚠️ **El contenedor visible del popover lo construye `bundle.js` en runtime** (`window.initPopovers()`),
y `bundle.js` no está descargado → **las clases de la burbuja (fondo, sombra, flecha,
posicionamiento) no son recuperables de este corpus.** Lo que sigue es solo lo que existe en
el markup estático: el trigger y el contenido del `<template>`.

API declarativa:
```html
<template id="popover-right">
  <div class="max-w-[300px]">
    <div class="relative z-20 rounded-t-xl border-b border-gray-200 px-5 py-3 dark:border-white/[0.03]">
      <h4 class="text-base font-semibold text-gray-800 dark:text-white/90">Popover on Right</h4>
    </div>
    <div class="p-5">
      <p class="text-sm text-gray-500 dark:text-gray-400">Lorem ipsum…</p>
    </div>
  </div>
</template>

<button data-popover="#popover-right" data-popover-placement="right"
        class="bg-brand-500 shadow-theme-xs hover:bg-brand-600 inline-flex rounded-lg px-4 py-3 text-sm font-medium text-white">
  Popover on Right
</button>
```

| Atributo | Valores |
|---|---|
| `data-popover` | selector CSS del `<template>` (requerido) |
| `data-popover-placement` | `top` \| `right` \| `bottom` \| `left` (opcional, default `right`) |

| Pieza | Cadena |
|---|---|
| Trigger | `bg-brand-500 shadow-theme-xs hover:bg-brand-600 inline-flex rounded-lg px-4 py-3 text-sm font-medium text-white` |
| Root del contenido | `max-w-[300px]` (variante default) / `max-w-[390px]` (con button y con link) |
| Header | `relative z-20 rounded-t-xl border-b border-gray-200 px-5 py-3 dark:border-white/[0.03]` |
| Título | `text-base font-semibold text-gray-800 dark:text-white/90` |
| Body | `p-5` + `<p class="text-sm text-gray-500 dark:text-gray-400">` |
| Footer botones | `mt-5 flex items-center gap-3` |
| Botón primario (footer) | `bg-brand-500 shadow-theme-xs hover:bg-brand-600 flex justify-center rounded-lg px-4 py-2 text-sm font-medium text-white` |
| Botón secundario (footer) | `shadow-theme-xs flex justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] dark:hover:text-gray-200` |
| Link (footer) | `text-brand-500 hover:text-brand-600 mt-5 flex items-center gap-1 text-sm font-medium` |
| Contenedor de triggers | `flex flex-wrap gap-4 p-8` |

**3 variantes** × 4 placements = 12 templates: *Default* (solo texto), *With Button* (2 botones,
padding `py-2` — más compacto que el `py-3` estándar), *With Link*.
- ⚠️ El header usa `border-gray-200` en light pero `dark:border-white/[0.03]` — un borde casi invisible en dark (el resto del kit usa `dark:border-gray-800`). Probable bug.
- ⚠️ `relative z-20` en el header aparece en unos templates y no en otros (`popover-03-top`/`-bottom` lo omiten).

---

## 16. Modals

Alpine: `x-data="{isModalOpen: false}"`. Backdrop y panel son **hermanos**; el cierre por fuera
va con `@click.outside` en el panel.

```html
<div x-data="{isModalOpen: false}">
  <button class="px-4 py-3 text-sm font-medium text-white rounded-lg bg-brand-500 shadow-theme-xs hover:bg-brand-600"
          @click="isModalOpen = !isModalOpen">Open Modal</button>
  <div x-show="isModalOpen" class="fixed inset-0 flex items-center justify-center p-5 overflow-y-auto modal z-99999">
    <div class="modal-close-btn fixed inset-0 h-full w-full bg-gray-400/50 backdrop-blur-[32px]"></div>
    <div @click.outside="isModalOpen = false"
         class="relative w-full max-w-[600px] rounded-3xl bg-white p-6 dark:bg-gray-900 lg:p-10">
      <button @click="isModalOpen = false" class="…close…"><svg/></button>
      <h4 class="font-semibold text-gray-800 mb-7 text-title-sm dark:text-white/90">Modal Heading</h4>
      <p class="text-sm leading-6 text-gray-500 dark:text-gray-400">…</p>
      <div class="flex items-center justify-end w-full gap-3 mt-8">…</div>
    </div>
  </div>
</div>
```

| Pieza | Cadena |
|---|---|
| Root | `fixed inset-0 flex items-center justify-center p-5 overflow-y-auto modal z-99999` |
| Backdrop | `modal-close-btn fixed inset-0 h-full w-full bg-gray-400/50 backdrop-blur-[32px]` |
| Panel | `relative w-full max-w-[600px] rounded-3xl bg-white p-6 dark:bg-gray-900 lg:p-10` |
| Close btn | `absolute right-3 top-3 z-999 flex h-9.5 w-9.5 items-center justify-center rounded-full bg-gray-100 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white sm:right-6 sm:top-6 sm:h-11 sm:w-11` |
| Título | `font-semibold text-gray-800 mb-7 text-title-sm dark:text-white/90` |
| Cuerpo | `text-sm leading-6 text-gray-500 dark:text-gray-400` (párrafos siguientes: `mt-5 …`) |
| Footer | `flex items-center justify-end w-full gap-3 mt-8` |
| Footer — Close | `flex w-full justify-center rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] dark:hover:text-gray-200 sm:w-auto` |
| Footer — Save | `flex justify-center w-full px-4 py-3 text-sm font-medium text-white rounded-lg bg-brand-500 shadow-theme-xs hover:bg-brand-600 sm:w-auto` |

**Variantes**

| Variante | Panel | Notas |
|---|---|---|
| Default | `relative w-full max-w-[600px] rounded-3xl bg-white p-6 dark:bg-gray-900 lg:p-10` | close btn + título + 2 párrafos + footer `justify-end` |
| Vertically Centered | `relative w-full max-w-[507px] rounded-3xl bg-white p-6 dark:bg-gray-900 lg:p-10` | **sin** close btn; contenido `text-center`; envuelto en `<div class="flex flex-col px-4 py-4 overflow-y-auto no-scrollbar">`; footer `justify-center`; título `mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90 sm:text-title-sm` |
| Form in Modal | `relative w-full max-w-[584px] rounded-3xl bg-white p-6 dark:bg-gray-900 lg:p-10` | close btn variante `group … bg-gray-200 text-gray-500 hover:bg-gray-300 hover:text-gray-500 …`; grid `grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2`; footer `mt-6` |
| Full Screen | `fixed top-0 left-0 z-99999 flex h-screen w-full flex-col items-center justify-between overflow-x-hidden bg-white p-6 lg:p-10 dark:bg-gray-900` | **sin** backdrop ni root; el panel *es* el root; footer `mt-8 flex w-full items-center justify-end gap-3 pb-16` |
| Modal Based Alerts | `relative w-full max-w-[600px] rounded-3xl …` | 4 colores, contenido `text-center`, icono decorativo `relative flex items-center justify-center z-1 mb-7` |

**Modal Based Alerts** — trigger y CTA por color:

| Color | Trigger / CTA |
|---|---|
| Success | `… rounded-lg bg-success-500 shadow-theme-xs hover:bg-success-600` |
| Info | `… rounded-lg bg-blue-light-500 shadow-theme-xs hover:bg-blue-light-600` |
| Warning | `… rounded-lg bg-warning-500 shadow-theme-xs hover:bg-warning-600` |
| Danger | `… rounded-lg bg-error-500 shadow-theme-xs hover:bg-error-600` |

Trigger completo: `px-4 py-3 text-sm font-medium text-white rounded-lg bg-{c}-500 shadow-theme-xs hover:bg-{c}-600`
CTA completo: `flex justify-center w-full px-4 py-3 text-sm font-medium text-white rounded-lg bg-{c}-500 shadow-theme-xs hover:bg-{c}-600 sm:w-auto`
Título del alert: `mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90 sm:text-title-sm`

**Input del Form in Modal** (recibo completo, útil como base de form):
```
dark:bg-dark-900 h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800
```
Label: `mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400`
⚠️ El input declara `dark:bg-dark-900` **y** `dark:bg-gray-900` — la segunda gana; la primera es muerta.

Notas transversales:
- `modal` y `modal-close-btn` son ganchos de CSS/JS externos (no Tailwind).
- El panel usa `dark:bg-gray-900`, **no** el `dark:bg-white/[0.03]` del resto del kit.
- ⚠️ `@click.outside` en el panel se dispara también al pulsar el trigger (los modales de la demo tienen ese jitter conocido).
- Sin `role="dialog"`, `aria-modal`, focus trap ni cierre con `Esc`.

---

## 17. Cards

```html
<div class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
  <div class="mb-5 overflow-hidden rounded-lg">
    <img src="…" alt="card" class="overflow-hidden rounded-lg" />
  </div>
  <div>
    <h4 class="mb-1 text-theme-xl font-medium text-gray-800 dark:text-white/90">Card title</h4>
    <p class="text-sm text-gray-500 dark:text-gray-400">Lorem ipsum…</p>
    <a href="#" class="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-3 text-sm font-medium text-white shadow-theme-xs hover:bg-brand-600">Read more</a>
  </div>
</div>
```

| Variante | Card |
|---|---|
| With Image (vertical) | `rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]` |
| Horizontal with Image | `flex flex-col gap-5 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03] sm:flex-row sm:items-center sm:gap-6` |
| With Link (sin imagen) | `rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] sm:p-6` |
| With Icon | `rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] sm:p-6` |

| Pieza | Clases |
|---|---|
| Wrap de imagen | `mb-5 overflow-hidden rounded-lg` (horizontal: `overflow-hidden rounded-lg`, sin `mb-5`) |
| `<img>` | `overflow-hidden rounded-lg` |
| Título | `mb-1 text-theme-xl font-medium text-gray-800 dark:text-white/90` |
| Cuerpo | `text-sm text-gray-500 dark:text-gray-400` |
| CTA botón | `mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-3 text-sm font-medium text-white shadow-theme-xs hover:bg-brand-600` |
| CTA link | `mt-4 inline-flex items-center gap-1 text-sm text-brand-500 hover:text-brand-600` |
| Icon tile | `mb-5 flex h-14 max-w-14 items-center justify-center rounded-[10.5px] bg-brand-50 text-brand-500 dark:bg-brand-500/10` |
| Grid 3-col | `grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3` |
| Grid 2-col | `grid grid-cols-1 gap-5 xl:grid-cols-2` |

- La card **no** lleva `shadow`; se apoya solo en el borde. `rounded-xl` (la showcase card exterior usa `rounded-2xl`).
- El icon tile usa `rounded-[10.5px]` — valor arbitrario, no hay token. `bg-brand-500/10` en dark (no `/15` como los badges).
- El CTA link admite icono a izq o der (mismo `gap-1`, cambia el orden del `<svg>`).
- El `overflow-hidden rounded-lg` duplicado (wrapper + img) es redundante.
- ⚠️ No hay variantes de card con header/footer, ni hover/interactive state.

---

## 18. Carousel

Swiper (JS externo). Las clases `swiper*` **no son Tailwind**; el look de flechas/bullets lo
pone el CSS de Swiper + `style.css` (no disponible).

```html
<div class="swiper carouselOne rounded-lg border border-gray-200 dark:border-gray-800">
  <div class="swiper-wrapper">
    <div class="swiper-slide">
      <div class="overflow-hidden"><img src="src/images/carousel/carousel-01.png" alt="carousel" /></div>
    </div>
  </div>
  <div class="swiper-pagination"></div>          <!-- indicadores -->
  <div class="swiper-button-prev"><svg/></div>   <!-- controles -->
  <div class="swiper-button-next"><svg/></div>
</div>
```

| Variante | Clase raíz | Extras dentro de la raíz |
|---|---|---|
| Slides only | `swiper carouselOne rounded-lg border border-gray-200 dark:border-gray-800` | — |
| With controls | `swiper carouselTwo rounded-lg border border-gray-200 dark:border-gray-800` | `swiper-button-prev` + `swiper-button-next` |
| With indicators | `swiper carouselThree rounded-lg border border-gray-200 dark:border-gray-800` | `swiper-pagination` |
| Controls + indicators | `swiper carouselFour rounded-lg border border-gray-200 dark:border-gray-800` | `swiper-pagination` + prev/next |

- `carouselOne…Four` son los **selectores de init** de cada instancia (en `bundle.js`), no clases de estilo.
- Las flechas llevan un `<svg>` custom inyectado a mano dentro de `swiper-button-prev/next` (Swiper normalmente usa `::after`).
- El `<img>` no lleva clases (ni `w-full`); el `rounded-lg` del root + el `overflow-hidden` del slide hacen el recorte.
- Body de la showcase card: `border-t border-gray-100 p-3 sm:p-6 dark:border-gray-800`.

---

## 19. Images

Sin componente propiamente dicho: `rounded-xl` + borde, y grids.

| Variante | Cadena |
|---|---|
| Responsive | `w-full border border-gray-200 rounded-xl dark:border-gray-800` |
| En grid (2 y 3 col) | `rounded-xl border border-gray-200 dark:border-gray-800` (sin `w-full`) |
| Grid 2 col | `grid grid-cols-1 gap-5 sm:grid-cols-2` |
| Grid 3 col | `grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3` |

```html
<!-- Responsive -->
<div class="relative">
  <div id="pane" class="overflow-hidden">
    <img src="…" alt="Cover" class="w-full border border-gray-200 rounded-xl dark:border-gray-800" />
  </div>
  <div id="ghostpane" class="absolute top-0 left-0 duration-300 ease-in-out"></div>
</div>

<!-- Grid -->
<div class="grid grid-cols-1 gap-5 sm:grid-cols-2">
  <div><img src="…" alt="image grid" class="rounded-xl border border-gray-200 dark:border-gray-800" /></div>
  <div><img src="…" alt="image grid" class="rounded-xl border border-gray-200 dark:border-gray-800" /></div>
</div>
```
`#pane` / `#ghostpane` son ganchos de un script de resize; no aportan estilo.
Body de la showcase card: `border-t border-gray-100 p-4 sm:p-6 dark:border-gray-800`.

---

## 20. Notifications

Dos familias distintas: **banners** (announcement/toast) y **toasts de estado** (4 colores).

### Announcement Bar
```html
<div class="w-full max-w-[607px] rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-[#1E2634]">
  <div class="flex items-start gap-3">
    <div><svg/></div>
    <div class="flex flex-col items-center gap-5 sm:flex-row">
      <div>
        <h5 class="mb-1 text-base font-medium text-gray-800 dark:text-white/90">New update! Available</h5>
        <p class="text-sm text-gray-500 dark:text-gray-400">Enjoy improved functionality…</p>
      </div>
      <div class="flex w-full items-center gap-3 sm:max-w-fit">
        <button type="button" class="flex justify-center rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] dark:hover:text-gray-200">Later</button>
        <button type="button" class="flex justify-center rounded-lg bg-brand-500 px-4 py-3 text-sm font-medium text-white shadow-theme-xs hover:bg-brand-600">Update Now</button>
      </div>
    </div>
  </div>
</div>
```

### Toast Notification (cookies)
| Pieza | Cadena |
|---|---|
| Contenedor | `relative w-full max-w-[577px] rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-[#1E2634]` |
| Close btn | `absolute right-3 top-3 text-gray-400 hover:text-gray-800 dark:hover:text-white/90` |
| Texto | `text-sm text-gray-700 dark:text-gray-400 mb-6 pr-4` |
| Footer | `flex flex-col sm:flex-row sm:items-center justify-end gap-6 sm:gap-4` |
| Link-button | `text-sm text-left font-medium text-gray-700 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200` |
| Botón secundario | `flex w-full sm:w-auto justify-center rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] dark:hover:text-gray-200` |
| Botón primario | `flex w-full sm:w-auto justify-center rounded-lg bg-brand-500 px-4 py-3 text-sm font-medium text-white shadow-theme-xs hover:bg-brand-600` |

### Status Toasts (Success / Info / Warning / Error)
```html
<div class="flex w-full sm:max-w-[340px] items-center justify-between gap-3 rounded-md border-b-4 border-success-500 bg-white p-3 shadow-theme-sm dark:bg-[#1E2634]">
  <div class="flex items-center gap-4">
    <div class="flex h-10 w-10 items-center justify-center rounded-lg text-success-600 dark:text-success-500 bg-success-50 dark:bg-success-500/[0.15]"><svg/></div>
    <h4 class="text-sm text-gray-800 dark:text-white/90 sm:text-base">Success! Action Completed</h4>
  </div>
  <button class="text-gray-400 hover:text-gray-800 dark:hover:text-white/90"><svg/></button>
</div>
```
Firma: `rounded-md` + **`border-b-4 border-{color}-500`** (barra inferior, no borde completo) + `bg-white dark:bg-[#1E2634]` + `p-3`.

| Color | Contenedor (parte variable) | Icon tile |
|---|---|---|
| Success | `border-b-4 border-success-500 … shadow-theme-sm` | `flex h-10 w-10 items-center justify-center rounded-lg text-success-600 dark:text-success-500 bg-success-50 dark:bg-success-500/[0.15]` |
| Info | `border-b-4 border-blue-light-500 … shadow-theme-lg` ⚠️ | `flex h-10 w-10 items-center justify-center rounded-lg bg-blue-light-50 text-blue-light-500 dark:bg-blue-light-500/[0.15] dark:text-blue-light-500` |
| Warning | `border-b-4 border-warning-500 … shadow-theme-sm` | `flex h-10 w-10 items-center justify-center rounded-lg bg-warning-50 text-warning-600 dark:bg-warning-500/[0.15] dark:text-orange-400` |
| Error | `border-b-4 border-error-500 … shadow-theme-sm` | `flex h-10 w-10 items-center justify-center rounded-lg bg-error-50 text-error-600 dark:bg-error-500/[0.15] dark:text-error-500` |

| Pieza fija | Clases |
|---|---|
| Row | `flex items-center gap-4` |
| Título | `text-sm text-gray-800 dark:text-white/90 sm:text-base` |
| Close btn | `text-gray-400 hover:text-gray-800 dark:hover:text-white/90` |

⚠️ Inconsistencias reales:
- **Info usa `shadow-theme-lg`**; los otros 3 usan `shadow-theme-sm`. Casi seguro un desliz.
- Success ordena `flex items-center justify-between gap-3 w-full sm:max-w-[340px]`; los otros 3 `flex w-full sm:max-w-[340px] items-center justify-between gap-3`. Mismo resultado.
- Success titula con `sm:text-base text-sm`; los demás `text-sm … sm:text-base`.
- Estos toasts usan opacidad `/[0.15]` (corchetes) mientras los badges usan `/15`. Equivalente, notación distinta.

---

## Apéndice — Patrones transversales para portar a Deasy

**Escala de radios**: `rounded-2xl` (showcase card, dropdown panel) › `rounded-3xl` (modal panel) ›
`rounded-xl` (card, alert, ribbon, announcement) › `rounded-lg` (botón, input, list, icon tile) ›
`rounded-md` (status toast, tab pill) › `rounded-sm` (progress, checkbox) › `rounded-full` (badge, avatar, radio).

**Texto**: cuerpo `text-sm text-gray-500 dark:text-gray-400`; heading de sección
`text-base font-medium text-gray-800 dark:text-white/90`; título de card
`text-theme-xl font-medium text-gray-800 dark:text-white/90`; título de modal `text-title-sm`.

**Dark mode, reglas observadas**:
- Superficie: `bg-white` → `dark:bg-white/[0.03]` (paneles flotantes → hex crudo `#1E2635`/`#1E2634`).
- Borde: `border-gray-200` → `dark:border-gray-800`; divisor `border-gray-100` → `dark:border-gray-800`.
- Texto: `text-gray-800` → `dark:text-white/90`; `text-gray-500` → `dark:text-gray-400`; `text-gray-700` → `dark:text-gray-400`.
- Tinte de color: fondo `-50` → `dark:bg-{c}-500/15`; texto `-600` → `dark:text-{c}-500`.
- **Excepción sistemática**: warning en dark siempre va a `dark:text-orange-400` (badge, alert, notification).

**Los 3 dialectos del botón secundario** (elegir **uno** al portar):
1. `ring-1 ring-inset ring-gray-300 … dark:ring-gray-700` — solo `buttons.html` (sin icono)
2. `ring-1 ring-gray-300 …` — `buttons.html` con icono (bug)
3. `border border-gray-300 … dark:border-gray-700` — **dominante**: pagination, modals, popovers, notifications, spinners

**Basura literal a no copiar**: `after:bottom-0-0` (ribbons ×2), `te` (tabs badge ×3),
`py-2.5å` (tabs vertical), `dark:bg-dark-900` muerto (input de modal), `group-hover:fill-*` sin
`group` (button group), `list-decimal` sobre `flex` (list), radios que son checkboxes (list).

**Tokens custom que hay que definir** (no vienen en este corpus):
`brand-{50,300,400,500,600,800}`, `success-{50,500,600}`, `error-{50,500,600}`,
`warning-{50,500,600}`, `blue-light-{50,500,600}`, `dark-900`,
`shadow-theme-{xs,sm,lg}`, `text-theme-xl`, `text-title-sm`, `z-99999`, `z-999`, `h-9.5`/`w-9.5`,
`py-6.5`, breakpoint `xsm`, utilidades `custom-scrollbar` / `no-scrollbar`, ganchos `modal` /
`modal-close-btn`, y `max-w-(--breakpoint-2xl)` (sintaxis Tailwind v4).
