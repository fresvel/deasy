---
name: tailadmin-ui
description: Referencia de estilos de TailAdmin (dashboard Tailwind v4) para construir UI en el frontend Vue de Deasy — tokens, recetas de clases verificadas de botones/inputs/tablas/modales/cards/charts, shell de layout y patrones de página. Úsala al crear o rediseñar cualquier componente visual, al buscar "cómo se hace un X bonito", o al elegir colores/sombras/tipografía. El mapa de Deasy está al día a 2026-08-11: la paleta ya está unificada y con @theme, así que las recetas se pegan casi directas — pero queda UNA trampa viva, `dark:`, que se activa sola y pinta en oscuro sobre la app en claro.
---

# TailAdmin como fuente de referencia visual para Deasy

Material extraído y **verificado** de TailAdmin (demo PRO de 87 rutas + los dos repos free) para
construir componentes en Deasy con un lenguaje visual coherente. **No es una guía para portar el
código de TailAdmin** — su código es peor que el de Deasy (ver §5). Es una fuente de **recetas de
clases y decisiones de diseño**.

## Antes que nada: de las 3 trampas de Deasy, quedan 1½

> **Actualizado el 2026-08-11 sobre `develop` @ `18e8942`.** Esta sección describía el repo de antes
> del frente 4. Dos de las tres trampas se arreglaron; los ficheros que citaba (`theme.css`,
> `tailwind.css`) **ya no existen**. Detalle en `references/mapeo-deasy.md`.

| Trampa | Estado |
|---|---|
| `rounded-*` mentía: `rounded-lg`=16px y la escala invertida | ✅ **arreglada** — la escala de Tailwind está intacta |
| No había `@theme`: Tailwind no conocía ningún token | ✅ **arreglada** — 16 colores registrados |
| Dev y prod no renderizaban igual (105 reglas `!important` bajo `local-dev`) | ✅ **arreglada** — el gate se retiró; lo que ves es lo que hay |
| **`dark:` se activaría solo** | ⚠️ **SIGUE VIVA** |

### La que queda, y es la peor

**Deasy no declara `@custom-variant dark`**, así que Tailwind v4 compila `dark:` a
`@media (prefers-color-scheme: dark)`. Las recetas de TailAdmin van **saturadas** de `dark:`.

Pegadas hoy: a quien tenga el sistema operativo en oscuro se le pintan los componentes nuevos **en
oscuro sobre el resto de la app en claro**. No lo verás en una máquina en claro, ni lo ve el build,
ni el lint, ni los tests.

**Decide antes de copiar la primera receta:**

- **Opción A — limpiar los `dark:` al pegar.** Cero riesgo, cero infraestructura. Es lo correcto si
  el modo oscuro no está en el plan.
- **Opción B — declarar el modo oscuro de verdad**: `@custom-variant dark (&:where(.dark, .dark *))`
  en `tokens.css` **más** un conmutador que ponga la clase. Sin el conmutador, el `@custom-variant`
  a secas desactiva el comportamiento automático — que es lo que quieres — pero deja los `dark:`
  inertes y acumulando.

**Media trampa que no estaba en la lista:** al adaptar una receta, prefiere el utility con nombre
(`border-brand-border`) a `border-[var(--brand-border)]`. En Tailwind v4 `border-[X]`, `text-[X]` y
`ring-[X]` son **ambiguos** entre color y tamaño: con `var()` no puede deducir y elige mal.

### Media hoja de ruta que ya no hace falta

El orden de adopción que había aquí (7 pasos: `@theme`, radios, `local-dev`, colapsar tokens…)
**está ejecutado**. Hoy el punto de partida es: paleta única, `@theme` registrado, escala de radios
correcta, cero literales de color en el CSS y dos linters vigilando.

Lo único que queda por decidir antes de adoptar es `dark:`.

> **Si copias un `@theme` de TailAdmin, omite las líneas `--font-*: initial` y
> `--breakpoint-*: initial`.** Son destructivas (borran `font-sans`/`font-mono` y **todos** los
> breakpoints). Sin ellas los tokens quedan **puramente aditivos**.
>
> Y **no dupliques la paleta**: Deasy ya tiene la suya en `tokens.css` con su `@theme`. Añade sólo
> lo que falte, referenciando los tokens existentes.

> **Ancla `--color-brand-500: #5e4eff`** (el primario real de Deasy). El de TailAdmin es `#465fff`.
> No hay colisión técnica (`--brand-primary` ≠ `--color-brand-500`, son espacios distintos), pero sin
> anclar tendrás **dos marcas** según el componente sea viejo o nuevo.

## Navegación

| Necesito… | Fichero |
|---|---|
| Colores, tipografía, sombras, breakpoints, z-index, dark mode | `references/tokens.md` |
| Botón, badge, alert, avatar, spinner, tabs, pagination, dropdown, modal, card, breadcrumb… | `references/atomos-ui.md` |
| Input y sus estados, select, checkbox, toggle, tablas, ApexCharts | `references/formularios-tablas-charts.md` |
| Sidebar, header, shell responsive, anatomía de dashboards/auth/error | `references/layout-y-paginas.md` |
| **Chat**: burbujas enviado/recibido, composer, lista de conversaciones | `references/chat.md` |
| Convenciones Vue de TailAdmin y qué NO copiar de ellas | `references/componentes-vue.md` |
| Qué tiene Deasy hoy y cómo encaja (o no) con TailAdmin | `references/mapeo-deasy.md` |

## Las dos piezas más reutilizables

**La card base** — 149 usos exactos en el demo. Es el bloque que sostiene todo el sistema:

```html
<div class="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
```

Su decisión central: en dark **no usa un gris sólido sino un velo blanco al 3%**, de modo que las
cards anidadas se aclaran por composición. Todo lo demás (padding, `overflow-hidden`, sombra) es
modificador. Un dropdown es esa misma card + `shadow-theme-lg` + `dark:bg-gray-dark` sólido (un panel
flotante sí necesita opacidad real).

**El input** — cadena canónica:

```html
<input class="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 shadow-theme-xs
              focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 focus:outline-hidden
              dark:border-gray-700 dark:bg-gray-900 dark:focus:border-brand-800">
```

Error/success sólo cambian el prefijo semántico (`border-error-300`, `focus:ring-error-500/10`).

## Convenciones de dark mode (el contrato de uso)

| Rol | Light | Dark |
|---|---|---|
| Fondo página | `bg-gray-50` | `dark:bg-gray-900` |
| Superficie/card | `bg-white` | `dark:bg-white/[0.03]` |
| Borde | `border-gray-200` | `dark:border-gray-800` |
| Texto principal | `text-gray-800` | `dark:text-white/90` |
| Texto secundario | `text-gray-500` | `dark:text-gray-400` |
| Acento activo | `bg-brand-50 text-brand-500` | `dark:bg-brand-500/[0.12] dark:text-brand-400` |

El texto blanco **nunca es `#fff` puro**: siempre `white/90`.

## Qué NO copiar

TailAdmin tiene basura literal en su markup. Verificado por script contra el HTML fuente:

- **`dark:bg-dark-900`** — token y regla **inexistentes**. Aparece al inicio de casi todos los inputs;
  el fondo oscuro real lo da el `dark:bg-gray-900` posterior. Es la trampa más repetida.
- `after:bottom-0-0` (clase inválida), una clase `te` suelta, `py-2.5å` **con carácter acentuado**.
- Radios declarados como `type="checkbox"`; `group-hover:` sin ancestro `group`; paginación activa en
  `blue-500` en vez de `brand-500`.
- **El kit no tiene** variantes `disabled`/`ghost`/`danger` ni botón tamaño `sm` (sólo md y lg), y
  conviven **tres dialectos** del botón secundario (`ring-inset` / `ring` / `border` — el dominante
  fuera de `buttons.html` es el de `border`).
- Accesibilidad ausente en todo el shell: sin `aria-expanded`/`aria-current`, sin trap de foco,
  `viewport` con `user-scalable=no`.

**Del lado Vue, aún menos**: `Button` recibe `onClick` como prop (calco de React), `v-click-outside`
está roto (hook `created` de Vue 2) y deja `DropdownMenu` sin cerrar, `MultipleSelect` muta el array
del padre, `ToggleSwitch.vue` es un **fichero de 0 bytes**, y 9 de sus 20 dependencias están muertas.
**Deasy ya tiene mejores componentes** (`AppButton` con 15 variantes, `AppModalShell`, `AppDataTable`):
mapea recetas sobre ellos, no los sustituyas.

## Procedencia y licencia

| Fuente | Licencia | Uso |
|---|---|---|
| Repo **HTML free** (`tailadmin-free-tailwind-dashboard-template`) | **MIT** © 2023 TailAdmin | fuente primaria para código literal |
| Repo **Vue free** (`vue-tailwind-admin-dashboard`) | **sin LICENSE** (`license: null`) | sólo referencia; no copiar verbatim |
| **Demo PRO** (87 rutas) | comercial | inspiración y recetas; no copiar markup |

El `@theme` de los repos HTML y Vue es **byte-idéntico**, así que **los tokens se citan desde el repo
MIT** y el problema de licencia desaparece para ellos. Tokens y recetas de clases son hechos sobre
cómo se ve el sistema; el código ajeno no se porta.

⚠️ **El CSS del demo PRO está tree-shaken** (67 de 91 colores): no sirve para enumerar la paleta. La
autoridad es el `@theme` de los repos free.
