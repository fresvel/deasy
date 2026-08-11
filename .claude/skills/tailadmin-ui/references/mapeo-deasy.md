# Sistema de diseño actual de Deasy — mapa para TailAdmin

> **Reescrito el 2026-08-11 sobre `develop` @ `18e8942`.** La versión anterior describía el repo de
> antes del frente 4 y había caducado entera: hablaba de `tailwind.css` y `theme.css`, que **ya no
> existen**, de 25 tokens `--deasy-*` que se borraron, y de 103 `!important` que hoy son 6.
> Todo lo de aquí está medido sobre el árbol, no deducido.

---

## 0. Lo que cambió, y por qué te importa

De las **tres colisiones** que impedían adoptar recetas de TailAdmin, **dos están arregladas**:

| Colisión | Estado | Qué significa para ti |
|---|---|---|
| `rounded-lg` valía **16 px** (escala invertida: `lg` > `xl`) | ✅ **arreglada** | Las recetas de TailAdmin con `rounded-*` ya se ven como en su demo |
| **No había `@theme`**: Tailwind no conocía ni un token | ✅ **arreglada** | Existen `bg-brand-primary`, `text-state-danger`… y puedes usarlos |
| **No hay `@custom-variant dark`** | ⚠️ **SIGUE VIVA** | Ver §4. Es la que te va a morder |

Y el CSS se reorganizó por completo: de 3 ficheros y 3 997 líneas a **15 módulos y 2 012**.

---

## 1. Dónde vive cada cosa

`frontend/src/shared/styles/` — **`main.js` importa sólo `index.css`**, que encadena el resto.

| Módulo | L | Contenido |
|---|---:|---|
| `tokens.css` | 191 | La paleta + el `@theme`. **Único sitio con literales de color** |
| `base.css` | 70 | Reset, tipografía, `html`/`body`/`#app` |
| `layout.css` | 97 | Workspace, sidebar, cabecera |
| `nav.css` | 161 | Navegación y pestañas |
| `surfaces.css` | 64 | Tarjetas y paneles |
| `buttons.css` | 327 | `.deasy-btn*`, `.admin-btn*`, `.hope-action-*` |
| `forms.css` | 305 | Campos, filtros, dropzone |
| `tables.css` | 81 | Tablas |
| `dialogs.css` | 145 | Modales |
| `tags.css` | 62 | Insignias |
| `auth.css` | 70 | Login y registro |
| `admin.css` | 84 | Cabecera y marcos de admin |
| `misc.css` | 114 | Sin familia todavía |
| `overrides.css` | 212 | Repintado de utilidades de Tailwind. **Va el último a propósito** |

⚠️ **El orden de los `@import` de `index.css` es parte del diseño.** En CSS dos reglas de igual
especificidad se resuelven por orden. `overrides.css` va al final porque tiene que ganar a los
componentes. Si mueves un import, verifícalo en navegador.

---

## 2. La paleta

**Un solo juego de tokens.** El juego paralelo `--deasy-*` se colapsó sobre `--brand-*`; **no queda
ninguno vivo** (las apariciones que verás son comentarios explicando el colapso).

### 2.1 Marca

```css
--brand-primary:      #5e4eff    /* 5.24:1 sobre blanco — es el techo de la marca */
--brand-accent:       #00b2a9
--brand-navy:         #111827    /* titulares */
--brand-ink:          #1f2937
--brand-white:        #ffffff    --brand-white-rgb: 255, 255, 255
--brand-black:        #000000    /* ancla para oscurecer, no es superficie */
--brand-primary-rgb:  94, 78, 255
```

### 2.2 Texto — la escala

```css
--brand-navy:         #111827    17.74:1
--brand-ink:          #1f2937    14.68:1
--brand-text-strong:  #343741    11.87:1
--brand-text-body:    #3f4254     9.91:1
--brand-text-muted:   #5a5f6f     6.36:1   ← el SUELO. Nada más claro para texto
--brand-icon:         #475569              /* iconos de acción secundaria */
```

### 2.3 Superficie y borde

```css
--brand-surface-muted: #f7f9fc     --brand-surface-alt:   #f8fafc
--brand-border:        #e2e6f0     /* separadores y marcos */
--brand-border-field:  #d7deea     /* bordes de control */
--brand-navy-deep:     #071927     /* el fondo del workspace */
--brand-navy-menu:     #123f88     /* sólo el botón de menú */
```

### 2.4 Estados — **uno por estado, y es el oscuro**

Los brillantes (`#28a745`, `#dc3545`, `#f59e0b`) se retiraron: daban 2.85, 4.08 y 1.99 sobre
blanco. **Ninguno cumplía.**

```css
--state-success: #047857   5.00:1
--state-danger:  #b42318   5.93:1
--state-warning: #b45309   4.68:1
--state-pending: #b8432b   5.42:1   /* NO es danger: es 'pendiente', otro significado */
--state-gold:    #d4af37            /* sólo BtnSera */
```

### 2.5 Botones de acción — un color por acción

```css
--action-neutral: #23384f    --action-view: #075985    --action-upload: #3751a3
```
(`assign`, `delete` y `warning` usan el token de estado correspondiente.)

### 2.6 Elevación, foco y velo

```css
--brand-shadow:     0 1px 2px rgba(15,23,42,.04)                              /* tarjetas */
--shadow-raised:    0 1px 2px rgba(15,23,42,.04), 0 12px 32px rgba(15,23,42,.06)
--shadow-modal:     0 1px 2px rgba(15,23,42,.04), 0 24px 64px rgba(15,23,42,.16)
--focus-ring:       0 0 0 4px rgba(var(--brand-primary-rgb), .1)   /* UNO para todo */
--overlay-backdrop: rgba(15,23,42,.48)                             /* NO es sombra: es fondo */
```

### 2.7 `@theme` — 16 colores registrados en Tailwind

Ya **existen** como utilidades: `bg-brand-primary`, `text-brand-ink`, `border-brand-border`,
`text-state-danger`… Están declaradas referenciando la paleta, así que no hay valores duplicados.

> ⚠️ **Prefiere el utility con nombre a `[var(--x)]`.** En Tailwind v4, `border-[X]`, `text-[X]` y
> `ring-[X]` son **ambiguos** entre color y tamaño: con un hex deduce «color», con `var(--x)` no
> puede y elige mal. Costó 114 nodos con el borde caído a `currentColor`.

---

## 3. Reglas de derivación — cópialas antes de inventar un color

**No declares un token por matiz. Declara uno por significado y deriva.** Los cinco violetas del
proyecto resultaron ser `--brand-primary` al 86/38/33/25/10 %: eran porcentajes, no colores.

El patrón de los botones de acción, que es el que hay que copiar:

```css
fondo   reposo 10%   hover 16%   sobre var(--brand-white)
borde   reposo 71%   hover 85%   sobre var(--brand-white)
texto   reposo el token          hover 85% sobre var(--brand-black)
```

**El 71 % no es arbitrario**: es el único porcentaje con el que los seis bordes llegan a **3:1**
contra la fila blanca, que es lo que pide WCAG 1.4.11 para el límite de un componente. Al 35 % el
borde salía *más claro* que el original y el botón se veía peor.

---

## 4. Diagnóstico de compatibilidad con TailAdmin

### 4.1 ⚠️ `dark:` — la colisión que sigue viva, y la que te va a morder

**El repo no declara `@custom-variant dark`.** Tailwind v4 compila entonces `dark:` a
`@media (prefers-color-scheme: dark)`.

Las recetas de TailAdmin vienen **llenas** de `dark:`. Si pegas una tal cual:

- se verá bien en tu máquina si tienes el sistema en claro;
- y **se pintará en oscuro, sobre una app en claro**, para cualquiera con el sistema en oscuro.

No lo verás ni tú, ni el build, ni el lint, ni los tests. **Antes de copiar la primera receta hay
que decidir**: o se limpian los `dark:` al pegar, o se declara el modo oscuro de verdad
(`@custom-variant dark (&:where(.dark, .dark *))` + un conmutador). Es una decisión de producto.

### 4.2 Radios: ya coinciden

La escala de Tailwind está intacta (`sm` 4 < `md` 6 < `lg` 8 < `xl` 12 < `2xl` 16). Una receta de
TailAdmin con `rounded-xl` se ve como en su demo. **Antes no**: `rounded-lg` valía el doble.

### 4.3 Colores: traduce, no pegues

TailAdmin usa la paleta de Tailwind (`slate-*`, `blue-*`, `gray-*`). Deasy tiene la suya. Al
adaptar una receta, **cambia el color por el token equivalente**, no lo dejes en `slate-700`.

Ojo: Tailwind v4 define su paleta en **OKLCH**. Convertida a sRGB, `red-800` se desvía hasta 20 por
canal de lo que esperas. **Ningún mapeo a la paleta de Tailwind es cambio nulo.**

### 4.4 Sombras y foco: usa los tokens, no los de la receta

TailAdmin trae sus propias sombras y anillos. Deasy tiene **tres niveles de elevación y un solo
anillo de foco**, y llegar ahí costó colapsar once valores. Usa `var(--shadow-raised)` y
`var(--focus-ring)`.

### 4.5 Dónde probar

La tabla de administración (`/admin/usuarios/personas/persons`) pinta **172 botones a la vez**. Es
el peor caso del sistema: lo sutil desaparece y lo pesado satura. **Si un componente se ve bien
ahí, se ve bien en todas partes.**

---

## 5. Lo que NO está migrado, y condiciona el plan

**«Cero colores a mano» vale para los `.css`. Los `.vue` siguen sucios:**

| | |
|---|---:|
| Color a mano dentro de `<style scoped>` | **108** |
| En plantilla o script | 67 |
| En ficheros `.js` | 20 |
| **Total fuera del CSS** | **195** |

Los 108 son **CSS puro que ningún linter mira**: el glob de stylelint es `src/**/*.css`.

**78 de los 175 de `.vue` están en los seis componentes de Vue Flow**
(`modules/admin/components/units/`) y 30 en `HomeView.vue`.

> **Antes de tokenizar los nodos del grafo, mira si son copias.** `ProcessNode.vue` estila
> `.unit-node__btn`, `.unit-node__handle` y `.unit-node__toolbar` — **los mismos selectores que
> `UnitNode.vue`**. Es copia literal. El arreglo no es dar token cuatro veces al mismo valor: es
> extraer una clase y borrar copias.

### Por qué esto ordena el trabajo

Los `<style scoped>` son justo lo que TailAdmin viene a sustituir. **Tokenizarlos primero es dar
nombre a colores de reglas que vas a borrar.** El orden que rinde:

1. Deduplicar Vue Flow (extraer la clase compartida).
2. Sacar los `<style scoped>` a módulos, componente por componente — **aquí entra TailAdmin**: en
   vez de traducir el CSS viejo, escribes la receta nueva.
3. Tokenizar lo que sobreviva, que será mucho menos.

---

## 6. Reglas que no se negocian

Están en **`frontend/CLAUDE.md`**, que se carga solo al trabajar ahí. Las tres que más afectan a
quien copia recetas:

1. **Cero literales de color fuera de `tokens.css`.** Hoy hay 0 y el gate está en 0.
2. **`<style scoped>` no casa con hijos sin `:deep()`.** Así murió `AdminTableManager.css`: 604
   líneas de las que **0 de 86 reglas aplicaban**.
3. **Ni el build, ni el lint, ni los 304 tests ven un estilo roto.** Demostrado cuatro veces en una
   sesión. Para un cambio de CSS la verificación es el navegador.
