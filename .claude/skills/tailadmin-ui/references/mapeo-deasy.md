# Sistema de diseño actual de Deasy

> **Reescrito el 2026-08-12**, medido sobre `develop-frontend` tras colapsar la paleta.
> La versión anterior nombraba la paleta entera con nombres que **ya no existen**
> (`--brand-primary`, `bg-brand-surface-muted`…) y citaba `.deasy-table-shell`, borrada.
>
> ⚠️ **Esto describe el punto de PARTIDA, no el destino.** TailAdmin se adoptó como fuente
> de diseño el **2026-08-13** (su paleta y su markup, no su código Vue), así que la paleta de
> §2 pasa a ser una capa de **alias sobre sus 91 primitivas** y las cifras de §6 se van a
> mover. Lo que no caduca —y es por lo que este fichero sigue valiendo— es **§4: con qué van
> a pelear tus recetas**. La ejecución va en la rama `develop-styles`, pila **B**.

---

## 1. Dónde vive cada cosa

`frontend/src/shared/styles/` — **`main.js` importa sólo `index.css`**, que encadena el resto.
**18 módulos, 2 900 líneas** (remedido el 2026-08-13; decía 2 749).

| Módulo | L | Contenido |
|---|---:|---|
| `tokens.css` | 152 | La paleta. **Único sitio con literales de color** |
| `base.css` | 97 | Reset, tipografía, `html`/`body`/`#app` |
| `layout.css` | 94 | Workspace, sidebar, cabecera |
| `nav.css` | 149 | Navegación y pestañas |
| `surfaces.css` | 103 | Tarjetas, paneles, scrollbars |
| `buttons.css` | 448 | `.deasy-btn*`, `.admin-btn*`, `.hope-action-*`, BtnSera |
| `forms.css` | 373 | Campos, filtros, dropzone |
| `tables.css` | 37 | Tablas |
| `dialogs.css` | 285 | Modales y panel lateral |
| `tags.css` | 54 | Insignias |
| `auth.css` | 56 | Login y registro |
| `admin.css` | 108 | Cabecera y marcos de admin |
| `graph.css` | 211 | Nodos de Vue Flow |
| `deliverables.css` | 76 | Tarjeta de entregable |
| `signatures.css` | 29 | Escritorio de firma |
| `misc.css` | 96 | Sin familia todavía |
| `overrides.css` | 313 | Skins sueltos + repintado de utilidades. **Va el último a propósito** |

⚠️ **El orden de los `@import` de `index.css` es parte del diseño**, no es alfabético.

---

## 2. La paleta: 22 tokens, una sola declaración cada uno

Un color se declara **una vez**, en el `@theme` de `tokens.css`. **`--color-` es el namespace de
Tailwind**, no parte del nombre: lo que va detrás es literalmente el nombre de la utilidad.

```css
@theme { --color-primary: #5e4eff; }    /* -> bg-primary, text-primary, border-primary… */
```

### 2.1 Marca y texto

```css
--color-primary     #5e4eff    5.24:1   /* el techo de la marca */
--color-accent      #00b2a9
--color-navy        #111827   17.74:1   /* titulares */
--color-navy-deep   #071927             /* el fondo del workspace */
--color-ink         #1f2937   14.68:1
--color-strong      #343741   11.87:1
--color-body        #3f4254    9.91:1
--color-muted       #5a5f6f    6.36:1   ← el SUELO. Nada más claro para texto
--color-icon        #475569             /* iconos de acción secundaria */
```

### 2.2 Líneas y superficie

Se llaman `line-*` y no `border-*` porque `--color-border` daría `border-border`.

```css
--color-line          #e2e6f0    /* separadores y marcos */
--color-line-strong   #cfd6e4
--color-line-field    #d7deea    /* bordes de control */
--color-surface       #f7f9fc
```

**No hay `--color-white`**: el blanco de la marca es el blanco, así que se usa el de Tailwind.
Tampoco hay `--color-surface-alt`: estaba a ΔE 0.56 de `--color-surface`.

### 2.3 Estados — uno por estado, y es el oscuro

```css
--color-success    #047857   5.49:1
--color-danger     #b42318   6.57:1
--color-warning    #b45309   5.02:1
--color-pending    #b8432b   5.42:1   /* NO es danger: es 'pendiente' */
--color-step-ink   #108353   4.77:1   /* «te toca a ti»: borde y texto */
--color-gold       #d4af37            /* sólo BtnSera. NO cumple en ninguno de sus usos */
```

⚠️ **`current` no se puede usar como nombre**: es de Tailwind (`currentColor`). Por eso el paso
actual es `step`. Y su **relleno** menta no está en `@theme` sino como `--step-rgb` en `:root`,
porque sólo se pinta al 10 % y al 35 %.

### 2.4 Acciones de tabla

```css
--color-action-neutral  #23384f    --color-action-view  #075985    --color-action-upload  #3751a3
```

### 2.5 Lo que no es un color suelto

En el `:root` de abajo, sin registrar y sin prefijo: `--elev-1/-2/-3/-3-left` (la escala de
elevación), `--focus-ring` (uno para toda la app), `--overlay-backdrop` (el velo del modal, que **no**
es sombra: es fondo), los tripletes `--*-rgb`, los degradados, `--black` y `--typeface`/`--type-*`.

> ⚠️ `--typeface` no se llama `--font-base` **a propósito**: `--font-*` es namespace de Tailwind y
> este `:root` está sin capa, así que le ganaría. Es el mecanismo del `--radius-lg`.

---

## 3. Cuánto de la paleta es realmente nuestro

Medido convirtiendo la paleta de Tailwind v4 desde su OKLCH real y verificado contra el canvas del
navegador. **Siete de los 22 tokens están a ΔE ≤ 2 de un color de Tailwind**:

| Token | ΔE al más cercano | |
|---|---:|---|
| `--color-navy` → `gray-900` | 0.52 | |
| `--color-surface` → `slate-50` | 0.56 | |
| `--color-ink` → `gray-800` | 1.00 | |
| `--color-action-view` → `sky-800` | 1.04 | |
| `--color-icon` → `slate-600` | 1.17 | |
| `--color-success` → `emerald-700` | 1.28 | |
| `--color-line` → `slate-200` | 1.61 | |

Se decidió **no anclarlos** a Tailwind: conservan su hex. El resto (`primary`, `accent`, `muted`,
`body`, `strong`, los estados, las acciones) está a ΔE 2.07–4.94, o sea que **sí son colores propios**.

⚠️ **Tailwind v4 sirve su paleta en OKLCH y no vuelve a los hex de v3.** `emerald-700` renderiza
`#007a55`, no `#047857`. **Ningún mapeo a la paleta de Tailwind es cambio nulo** — mide en el DOM.
Y **87 de sus 288 colores caen fuera de la gama sRGB**: en una pantalla P3 se ven más saturados.

---

## 4. Las capas están ordenadas

Antes, casi todo el CSS estaba **fuera de capa**, y una regla sin capa gana SIEMPRE a una capada.
Consecuencia: al pegar una receta externa, **la mitad de sus utilidades no pintaba nada**, y no lo
veía el build, ni el lint, ni los tests.

```
@layer components   los skins de componente
@layer utilities    los repintados que aún quedan
sin capa            SÓLO lo que pelea con una hoja de tercero (Vue Flow, Leaflet)
```

**Quedan 52 reglas fuera de capa**, cada una con su motivo escrito: `overrides.css` 22,
`dialogs.css` 10, `buttons.css` 8, `base.css` 4, `graph.css` 3.

### Con qué van a pelear tus recetas

| Si tocas… | Te encontrarás con |
|---|---|
| **Un campo de formulario** | `input, select, textarea` sin capa: suprime **83 radios, 44 bordes y 80 focos** ya escritos. Un `rounded-xl` tuyo NO va a pintar |
| **Un modal** | `.deasy-dialog-body`, `-panel`, `-footer` y el velo, sin capa: 33 paddings, 49 bordes y 44 sombras |
| **Un encabezado** | `.admin-typography h1..h6` sin capa fija peso 500 |
| **Un botón de acción de tabla** | `.hope-action-*` sin capa, y no por una utilidad: le gana `.deasy-table-responsive .deasy-btn` (0,2,0) en 239 nodos |

Estas reglas **son preguntas de diseño abiertas**. Al rediseñar un componente, su regla suprimida se
resuelve: o se borra la declaración muerta, o se capa la regla y se enciende. **Nada se queda
«presente pero suprimido».**

---

## 5. Al adaptar una receta de fuera

1. **Traduce los colores a tokens.** Y prefiere el utility con nombre (`border-line`) a
   `border-[var(--color-line)]`: en Tailwind v4 `border-[X]`, `text-[X]` y `ring-[X]` son **ambiguos**
   entre color y tamaño, y con `var()` elige mal. Costó 114 nodos con el borde en `currentColor`.
2. **Quita los `dark:`.** Deasy no tiene modo oscuro; hay un `@custom-variant` que los deja inertes,
   una regla de eslint y `pnpm run check:no-dark`. Hoy hay **0 usos**.
3. **Los radios coinciden**: la escala de Tailwind está intacta (`sm` 4 < `md` 6 < `lg` 8 < `xl` 12 <
   `2xl` 16) — salvo en los componentes de §4, donde el radio está suprimido.
4. **Sombras y foco**: usa `var(--elev-2)` y `var(--focus-ring)`, no los de la receta.
5. **Un token con alfa es `rgba(var(--x-rgb), 0.5)`**, nunca `rgb(var(--x)/0.5)`: lo segundo es CSS
   inválido, Tailwind lo emite igual y el navegador lo descarta en silencio.
6. **Pruébalo en la tabla de administración**, que pinta 172 botones a la vez. Es el peor caso del
   sistema: si se ve bien ahí, se ve bien en todas partes.

---

## 6. Estado de la deuda

| | |
|---:|---|
| **0** | `<style scoped>` con CSS vivo (eran 13) |
| **0** | literales de color en los `.css` fuera de `tokens.css` |
| **0** | clases declaradas sin usar (eran ~30; borradas el 2026-08-12) |
| **47** | colores a mano fuera del CSS (eran 195) |
| **52** | reglas fuera de capa, todas con motivo |
| **~2 112** | clases de color de Tailwind por nombre (eran 3 590) |

---

## 7. Reglas que no se negocian

Están en **`frontend/CLAUDE.md`**, que se carga solo al trabajar ahí. Las cuatro que más afectan:

1. **Cero literales de color fuera de `tokens.css`.** El gate está en 0 y ahí se queda.
2. **Un token nuevo se justifica con DOS condiciones**: que Tailwind no traiga ya ese color (mide el
   ΔE), y que el concepto pueda cambiar de color. Si el concepto **es** el color, usa el de Tailwind.
3. **Antes de fiarte de `@theme`, míralo en el CSS construido.** Tailwind hace *tree-shaking*: un
   registro que nadie usa no se emite, y eso es indistinguible de no haberlo escrito.
4. **Ni el build, ni el lint, ni los 304 tests ven un estilo roto.** Para un cambio de CSS la
   verificación es el navegador, y si es amplio, `scripts/css-huella.mjs`.
