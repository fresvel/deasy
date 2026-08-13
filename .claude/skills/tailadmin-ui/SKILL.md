---
name: tailadmin-ui
description: DESCARTADO como fuente de diseño el 2026-08-12 — no la invoques para decidir el aspecto de un componente nuevo. Se conserva como archivo de dos cosas que siguen valiendo: (a) `references/mapeo-deasy.md`, que describe el sistema de diseño REAL de Deasy —los 22 tokens, las 52 reglas fuera de capa y con qué pelean—, y (b) material verificado sobre TailAdmin por si alguien vuelve a plantearlo. Para escribir UI en Deasy, las reglas vinculantes están en `frontend/CLAUDE.md`, no aquí.
---

# TailAdmin — DESCARTADO, y qué queda de útil

> ## ⚠️ Decisión del 2026-08-12: **no se adopta TailAdmin.**
>
> Esta skill nació para adoptar su lenguaje visual. **Eso ya no va a pasar**, así que no la uses
> como fuente para decidir el aspecto de nada. Lo que sigue valiendo, y por eso no se borra:
>
> - **`references/mapeo-deasy.md`** describe el sistema de diseño de Deasy tal y como está hoy: los
>   22 tokens con sus nombres reales, cuántos son de verdad nuestros, y las 52 reglas fuera de capa
>   con las que va a pelear cualquier componente nuevo. **Eso es independiente de TailAdmin.**
> - El resto de `references/` es material extraído y verificado sobre TailAdmin. Si algún día se
>   replantea, está medido y no hay que volver a hacerlo.
>
> **Las reglas vinculantes para escribir UI en Deasy están en `frontend/CLAUDE.md`.**

Material extraído y **verificado** de TailAdmin (demo PRO de 87 rutas + los dos repos free). **Nunca
fue una guía para portar su código** — su código es peor que el de Deasy (ver §5). Era una fuente de
**recetas de clases y decisiones de diseño**.

## Las 3 trampas de Deasy que esto destapó — las tres arregladas

Aunque la adopción se descartara, el análisis sirvió para encontrarlas, y eso sí quedó arreglado:

| Trampa | Estado |
|---|---|
| `rounded-*` mentía: `rounded-lg`=16px y la escala invertida | ✅ **arreglada** — la escala de Tailwind está intacta |
| No había `@theme`: Tailwind no conocía ningún token | ✅ **arreglada** — **22 registros**, con una sola declaración cada uno |
| Dev y prod no renderizaban igual (105 reglas `!important` bajo `local-dev`) | ✅ **arreglada** — el gate se retiró; lo que ves es lo que hay |
| `dark:` se activaría solo | ✅ **resuelta** — decidido que no hay modo oscuro; tres capas lo impiden |

### DECIDIDO el 2026-08-11: no hay modo oscuro, y `dark:` se quita al pegar

**Deasy es una app EN CLARO y no se contempla modo oscuro.** Sus zonas oscuras —la barra lateral—
son una decisión de diseño resuelta con color explícito (`text-white/55`, `border-white/8`), no un
tema. Hoy hay **0 usos** de `dark:` en todo el frontend.

El riesgo era real: sin protección, Tailwind v4 compila `dark:` a
`@media (prefers-color-scheme: dark)`, y las recetas de TailAdmin traen **1 024**. Pegadas tal cual,
a quien tuviera el sistema en oscuro se le pintarían los componentes nuevos **en oscuro sobre el
resto de la app en claro** — invisible para el build, el lint, los tests y para ti si tu sistema
está en claro.

**Ya está resuelto, y el repo lo hace cumplir con tres capas:**

| | Qué cubre |
|---|---|
| `@custom-variant dark` en `tokens.css` | El seguro: si un `dark:` entra, queda **inerte** |
| `vue/no-restricted-class` (eslint, en `error`) | El atributo `class` de las plantillas |
| `pnpm run check:no-dark` | Lo que ninguna ve: dentro de `@apply`, dentro de `<style scoped>` y en `.js` |

**Al adaptar una receta, quítale los `dark:`.** No los dejes «por si acaso»: apuntan a la paleta de
TailAdmin (`gray-900`, `gray-800`…), no a la de Deasy, así que el día que hubiera modo oscuro habría
que revisarlos todos igual. Y el lint te va a parar.

```html
<!-- TailAdmin -->
<div class="bg-white text-gray-800 dark:bg-gray-900 dark:text-white/90
            border-gray-200 dark:border-gray-800">

<!-- adaptado a Deasy -->
<div class="bg-white text-ink border-line">
```

**Media trampa que no estaba en la lista, y vale para cualquier fuente:** prefiere el utility con
nombre (`border-line`) a `border-[var(--color-line)]`. En Tailwind v4 `border-[X]`, `text-[X]` y
`ring-[X]` son **ambiguos** entre color y tamaño: con `var()` no puede deducir y elige mal.

> ⚠️ **Los nombres de token de Deasy cambiaron el 2026-08-12.** Hoy son `--color-primary`,
> `--color-line`, `--color-muted`, `--color-ink`… y **no hay `--color-white`**: se usa el de Tailwind.
> Comprobado que los demás ficheros de `references/` **no nombran ni un token de Deasy** —sólo
> describen TailAdmin—, así que no caducaron con el cambio. La paleta está en `mapeo-deasy.md`.
>
> Ojo al leerlos: `brand-50`, `brand-300`, `brand-500`… que aparecen en sus recetas son de **la
> paleta de TailAdmin**, no de la nuestra. Nunca fueron nombres de Deasy.

### La hoja de ruta de adopción: no se ejecuta

Aquí había 7 pasos para adoptar el lenguaje de TailAdmin. **La adopción se descartó el 2026-08-12**,
así que no hay nada que ejecutar. Lo que sí se hizo por el camino —y era lo que de verdad hacía
falta— fue arreglar el sistema propio: paleta única con una sola declaración por color, `@theme`
registrado, escala de radios correcta, cero literales de color en el CSS y tres gates vigilando.

> Si algún día se replantea, dos avisos ya medidos: **si copias un `@theme` de TailAdmin, omite las
> líneas `--font-*: initial` y `--breakpoint-*: initial`** (son destructivas: borran
> `font-sans`/`font-mono` y **todos** los breakpoints), y **ancla su `--color-brand-500` a `#5e4eff`**,
> el primario real de Deasy — el suyo es `#465fff`, y sin anclarlo tendrías **dos marcas** según el
> componente fuera viejo o nuevo.

## Navegación

| Necesito… | Fichero |
|---|---|
| Colores, tipografía, sombras, breakpoints, z-index, dark mode | `references/tokens.md` |
| Botón, badge, alert, avatar, spinner, tabs, pagination, dropdown, modal, card, breadcrumb… | `references/atomos-ui.md` |
| Input y sus estados, select, checkbox, toggle, tablas, ApexCharts | `references/formularios-tablas-charts.md` |
| Sidebar, header, shell responsive, anatomía de dashboards/auth/error | `references/layout-y-paginas.md` |
| **Chat**: burbujas enviado/recibido, composer, lista de conversaciones | `references/chat.md` |
| Convenciones Vue de TailAdmin y qué NO copiar de ellas | `references/componentes-vue.md` |
| **El sistema de diseño REAL de Deasy** — los 22 tokens, las 52 reglas fuera de capa, la deuda. Lo único aquí que no depende de TailAdmin | `references/mapeo-deasy.md` |

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

## Convenciones de dark mode de TailAdmin — referencia, NO se copia

> Deasy no tiene modo oscuro y las clases `dark:` están prohibidas (ver arriba). Esta tabla queda
> como referencia de **cómo piensa TailAdmin sus superficies**, que sí es útil: la idea de que una
> card anidada se aclara por composición en vez de con un gris sólido es transferible. Pero la
> columna «Dark» **no se pega**.

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
