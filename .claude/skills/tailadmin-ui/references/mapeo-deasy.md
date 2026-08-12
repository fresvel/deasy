# Sistema de diseño actual de Deasy — mapa para TailAdmin

> **Reescrito el 2026-08-12**, medido sobre `develop-frontend` tras cerrar F1, F2 y F4.4.
> La versión anterior era de antes de ese trabajo y **mentía en seis puntos**, incluido el más
> peligroso: decía que no había `@custom-variant dark` y mandaba decidir el modo oscuro antes de
> copiar la primera receta. Esa decisión ya está tomada e implementada.

---

## 0. Las tres colisiones que impedían adoptar recetas: **las tres arregladas**

| Colisión | Estado |
|---|---|
| `rounded-lg` valía 16 px (escala invertida) | ✅ La escala de Tailwind es la suya: `sm` 4 < `md` 6 < `lg` 8 < `xl` 12 < `2xl` 16 |
| No había `@theme`: Tailwind no conocía ni un token | ✅ **43 registros**. Existen `bg-brand-primary`, `text-state-warning`, `border-brand-border`… |
| No había `@custom-variant dark` | ✅ **Declarado** en `tokens.css`. Ver §4.1 — sigue habiendo trabajo, pero no es el que decía |

Y una cuarta, que es la que de verdad te habilita a pegar recetas: **las utilidades vuelven a ganar
a los componentes**. Ver §3.

---

## 1. Dónde vive cada cosa

`frontend/src/shared/styles/` — **`main.js` importa sólo `index.css`**, que encadena el resto.
18 módulos, 2 927 líneas.

| Módulo | L | Contenido |
|---|---:|---|
| `tokens.css` | 231 | Paleta + `@theme`. **Único sitio con literales de color** |
| `base.css` | 101 | Reset, tipografía, `html`/`body`/`#app` |
| `layout.css` | 94 | Workspace, sidebar, cabecera |
| `nav.css` | 156 | Navegación y pestañas |
| `surfaces.css` | 103 | Tarjetas, paneles, scrollbars |
| `buttons.css` | 457 | `.deasy-btn*`, `.admin-btn*`, `.hope-action-*`, BtnSera |
| `forms.css` | 385 | Campos, filtros, dropzone |
| `tables.css` | 88 | Tablas |
| `dialogs.css` | 296 | Modales y panel lateral |
| `tags.css` | 54 | Insignias |
| `auth.css` | 56 | Login y registro |
| `admin.css` | 130 | Cabecera y marcos de admin |
| `graph.css` | 211 | Nodos de Vue Flow |
| `deliverables.css` | 76 | Tarjeta de entregable |
| `signatures.css` | 29 | Escritorio de firma |
| `misc.css` | 100 | Sin familia todavía |
| `overrides.css` | 328 | Skins sueltos + repintado de utilidades. **Va el último a propósito** |

⚠️ **El orden de los `@import` de `index.css` es parte del diseño**, no es alfabético.

---

## 2. La paleta

Un solo juego de tokens: `--brand-*` / `--state-*` / `--action-*` / `--chart-*`.

### 2.1 Marca y texto

```css
--brand-primary:      #5e4eff    5.24:1   /* el techo de la marca */
--brand-accent:       #00b2a9
--brand-navy:         #111827   17.74:1   /* titulares */
--brand-ink:          #1f2937   14.68:1
--brand-text-strong:  #343741   11.87:1
--brand-text-body:    #3f4254    9.91:1
--brand-text-muted:   #5a5f6f    6.36:1   ← el SUELO. Nada más claro para texto
--brand-icon:         #475569             /* iconos de acción secundaria */
```

### 2.2 Superficie, borde y elevación

```css
--brand-white:         #ffffff   --brand-surface-alt:   #f8fafc
--brand-surface-muted: #f7f9fc   --brand-navy-deep:     #071927  /* fondo del workspace */
--brand-border:        #e2e6f0   /* separadores */
--brand-border-field:  #d7deea   /* bordes de control */
--brand-border-strong: #cfd6e4

--brand-elev-1 / -2 / -3        /* la escala de elevación, tres escalones */
--brand-elev-3-left             /* el nivel 3 proyectando a la izquierda: panel lateral */
--focus-ring                    /* UNO para toda la app */
--overlay-backdrop              /* el velo del modal. NO es sombra: es fondo */
```

> ⚠️ Se llamaban `--brand-shadow` y `--shadow-raised/-modal/-drawer`. **Renombrados**: ocupaban el
> namespace `--shadow-*` de Tailwind sin estar en `@theme`, que es el mecanismo del `--radius-lg`.

### 2.3 Estados — uno por estado, y es el oscuro

```css
--state-success: #047857   5.49:1
--state-danger:  #b42318   6.57:1
--state-warning: #b45309   5.02:1
--state-pending: #b8432b   5.42:1   /* NO es danger: es 'pendiente' */
--state-info:    #2563eb   5.17:1
--state-current: #4bf1a1            /* «te toca a ti» — SÓLO relleno, da 1.46:1 */
--state-current-ink: #108353 4.78:1 /* su borde y su texto */
--state-gold:    #d4af37            /* sólo BtnSera. NO cumple en ninguno de sus usos */
```

### 2.4 Acciones y escala categórica

```css
--action-neutral: #23384f   --action-view: #075985   --action-upload: #3751a3
--chart-1 … --chart-7       /* escala categórica: ΔE mín 21, contraste mín 3.96:1 */
```

---

## 3. Lo que más te habilita: **las capas están ordenadas**

Antes, casi todo el CSS estaba **fuera de capa**, y una regla sin capa gana SIEMPRE a una capada.
Consecuencia: si pegabas una receta de TailAdmin, **la mitad de sus utilidades no pintaba nada**, y
no lo veía el build, ni el lint, ni los tests.

Hoy la disposición es:

```
@layer components   los skins de componente
@layer utilities    los repintados que aún quedan
sin capa            SÓLO lo que pelea con una hoja de tercero (Vue Flow, Leaflet)
```

**Quedan 53 reglas fuera de capa**, y no son inercia: cada una tapa algo a propósito y lleva su
motivo escrito. Concentradas en `overrides.css` (22), `dialogs.css` (10) y `buttons.css` (8).

### ⚠️ Y son justo las que van a pelear con tus recetas

| Si tocas… | Te encontrarás con |
|---|---|
| **Un campo de formulario** | `input, select, textarea` sin capa: suprime **83 radios, 44 bordes y 80 focos** ya escritos. Un `rounded-xl` tuyo NO va a pintar |
| **Un modal** | `.deasy-dialog-body`, `-panel`, `-footer` y el velo, sin capa: suprimen 33 paddings, 49 bordes y 44 sombras |
| **Un encabezado** | `h1..h6` sin capa fija peso 500: suprime **77 `font-bold`/`font-semibold`** en 95 encabezados |
| **Un botón de acción de tabla** | `.hope-action-*` sin capa, y no por una utilidad: le gana `.deasy-table-shell .deasy-btn` |

**Inventario completo con la cifra de cada una** en
`docs/planes/sistema-diseno-plantillas/bitacora.md`, §4.4-c/d.

Estas reglas no son un obstáculo a rodear: **son las preguntas de diseño que TailAdmin viene a
contestar.** Al rediseñar un componente, su regla suprimida se resuelve — o se borra la declaración
muerta, o se capa la regla y se enciende. Nada se queda «presente pero suprimido».

---

## 4. Compatibilidad al copiar una receta

### 4.1 `dark:` — el seguro está puesto, pero límpialas igual

`tokens.css` declara `@custom-variant dark (&:where(.dark, .dark *))`, así que un `dark:` que se
cuele queda **inerte**: depende de una clase `.dark` que nadie pone. Ya no se activa solo en la
máquina de quien tenga el sistema en oscuro.

Aun así **se quitan al pegar**, y hay un gate que lo comprueba (`pnpm run check:no-dark`): apuntan a
la paleta de TailAdmin (`gray-900`…), no a la de Deasy, así que el día que hubiera modo oscuro habría
que revisarlas todas igual. Hoy hay **0 usos**.

### 4.2 Radios: coinciden

La escala de Tailwind está intacta. Una receta con `rounded-xl` se ve como en su demo — **salvo que
el componente esté en la lista de §3**, donde el radio está suprimido.

### 4.3 Colores: traduce, no pegues

TailAdmin usa la paleta de Tailwind. Cambia cada color por su token.

⚠️ **Tailwind v4 sirve su paleta en OKLCH**, y no vuelve a los hex de v3 que todos tenemos en la
cabeza. Medido aquí: `emerald-700` renderiza `rgb(0,122,85)`, no `#047857`. **Ningún mapeo a la
paleta de Tailwind es cambio nulo** — mide en el DOM, no compares hex.

### 4.4 Sombras y foco: usa los tokens

Tres niveles de elevación y **un solo** anillo de foco. Usa `var(--brand-elev-2)` y
`var(--focus-ring)`, no los de la receta.

⚠️ **Un token con alfa se escribe `rgba(var(--x-rgb), 0.5)`**, nunca `rgb(var(--x-rgb)/0.5)`: lo
segundo es CSS inválido, Tailwind lo emite igual y el navegador lo descarta en silencio.

### 4.5 Dónde probar

La tabla de administración pinta **172 botones a la vez**. Es el peor caso del sistema: lo sutil
desaparece y lo pesado satura. **Si un componente se ve bien ahí, se ve bien en todas partes.**

---

## 5. Estado real de la deuda

| | |
|---:|---|
| **0** | `<style scoped>` con CSS vivo (eran 13) |
| **75** | colores a mano fuera del CSS (eran 195) |
| **0** | literales de color en los `.css` fuera de `tokens.css` |
| **~2 900** | clases de color de Tailwind por nombre (eran 3 590): slate 984 · sky 332 · indigo 217 · emerald 173 · rose 172 |
| **53** | reglas fuera de capa, todas con motivo |
| **~30** | clases declaradas sin un solo uso — pendiente de borrar |

El barrido de las ~2 900 va por familias, no por ficheros, y **no bloquea nada de TailAdmin**: los
tokens de destino ya existen todos en `@theme`.

---

## 6. Reglas que no se negocian

Están en **`frontend/CLAUDE.md`**, que se carga solo al trabajar ahí. Las cuatro que más afectan a
quien copia recetas:

1. **Cero literales de color fuera de `tokens.css`.** El gate está en 0 y ahí se queda.
2. **Antes de fiarte de `@theme`, míralo en el CSS construido.** Tailwind hace *tree-shaking*: un
   registro que nadie usa no se emite, y eso es indistinguible de no haberlo escrito.
3. **Una utilidad repintada lleva PRIORIDAD además de color.** Antes de sustituirla, mira contra qué
   estaba ganando.
4. **Ni el build, ni el lint, ni los 304 tests ven un estilo roto.** Para un cambio de CSS la
   verificación es el navegador, y si es amplio, `scripts/css-huella.mjs`.
