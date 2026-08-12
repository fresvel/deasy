# Auditoría del sistema de diseño — 2026-08-11

Medición completa del frontend **después** de cerrar el plan del 2026-08-09. Cinco frentes analizados
en paralelo, cada uno con su cálculo hecho a mano (CIEDE2000 y contraste WCAG 2.1 implementados desde
cero, sin librerías) y contrastados contra la aplicación viva en la pila B.

> **Esto es evidencia, no ejecutable.** El plan que sale de aquí es
> [`plan-2026-08-11.md`](./plan-2026-08-11.md).

---

## 0. Lo que cambió el diagnóstico

El plan anterior trataba la deuda de color como un problema de **disciplina**: gente escribiendo hex
a mano. Esta medición dice que eso es la parte pequeña. La grande es otra:

> **Hay 3 590 usos de colores de Tailwind por nombre (`bg-slate-50`, `text-amber-700`…), y en buena
> parte no había alternativa.** Hoy no existen `bg-state-warning`, `text-brand-text-muted`,
> `text-brand-icon` ni ninguna `*-action-*`. Una plantilla que quiera pintar un aviso o un subtítulo
> **no tiene a qué llamar dentro del sistema**.

Ni `stylelint` ni `eslint` ven uno solo: no son hex y no son `dark:`. El contador de `lint:css` en
cero **no significa que no haya deuda**; significa que la deuda cambió de forma.

Y el segundo cambio de encuadre: **el patrón dominante de este repo no es el color mal escrito, es la
regla que no aplica.** Cuatro de los cinco frentes encontraron reglas que existen, se leen bien y no
pintan nada.

---

## 1. Cinco cosas rotas hoy

No son deuda estética. Son fallos, con su mecánica identificada.

### 1.1 Dos tokens de borde nunca llegan al DOM

`overrides.css:90-103` declara, **fuera de toda capa**:

```css
input, select, textarea { border-color: var(--brand-border); }
```

Un selector de elemento (0,0,1). Y `forms.css` declara `--brand-border-field` en
`.deasy-filter-control` (0,1,0) **dentro de `@layer components`**. En CSS la precedencia de capa gana
a la especificidad, así que **la regla menos específica gana** y los otros dos tokens no pintan nunca.

Verificado en la app viva: `.deasy-field-input` y `.deasy-field-select` renderizan
`rgb(226, 230, 240)` = `--brand-border` `#e2e6f0`, no `--brand-border-field` `#d7deea`.

| Token | Valor | Contraste s/ blanco | ¿Llega al DOM? |
|---|---|---:|---|
| `--brand-border` | `#e2e6f0` | **1.25:1** | sí — y es el peor de los tres |
| `--brand-border-field` | `#d7deea` | 1.35:1 | **no** |
| `--brand-border-strong` | `#cfd6e4` | 1.46:1 | **no** |

Afecta a **228 `<input|select|textarea>`** en 40 ficheros, más 43 `.deasy-auth-field`, 49
`.profile-*-input` y 38 `.deasy-filter-control`. El mismo mecanismo repinta el borde de
`.deasy-btn--secondary` y `--cancel` (1.46 declarado → **1.25 efectivo**).

Ninguno de los tres llega a 3:1, así que esto no se arregla sólo con la cascada — hace falta además
subir el valor. Pero mientras el mecanismo siga en pie, **subir el token no serviría de nada**.

### 1.2 «Mis envíos» sin color en la barra lateral

`HomeSidebar.vue:74` declara `tone: 'indigo'`. El helper compone
`deasy-nav-item__icon--indigo`, y **`nav.css` no tiene esa variante**.

Medido en `/home`: ese icono renderiza `background-color: rgba(0,0,0,0)` mientras sus **seis
hermanos** llevan `rgba(255,255,255,0.04)` con borde a `0.08`.

### 1.3 Dos acciones de tabla sin su tinte

`hope-action-launch` (`AdminMainTableSection.vue:268,280`) y `hope-action-retire` (`:256`) se pintan
como `hope-action-btn hope-action-<x>`, pero de las **12 variantes sólo 10 tienen regla**. «Lanzar
procesos del periodo» y «Retirar» salen con el gris neutro de la base.

### 1.4 Un aviso durante un diálogo se pinta detrás del velo

`SNotify` está en `z-[50]`; el velo del modal, en `1075`. Un *toast* que salte con un diálogo abierto
queda **debajo**. Además empata con la cabecera (`SHeader`, `z-50`), y eso lo decide el orden del DOM.

### 1.5 `1075` escrito dos veces

`AppDialogOverlay.vue:7` y `.deasy-drawer-overlay` (`dialogs.css:162`). **Modal y panel lateral quedan
exactamente empatados**: quién tapa a quién lo decide el orden del DOM, no el diseño. Y `AppInfoTip`
está en `1100`, que es `1075 + 25` — depende del otro por un número mágico que nadie relaciona.

### 1.6 Y dos más, menores pero del mismo patrón

- **`AppButton.vue:92`** cae a `props.variant` cuando no está en `variantClassMap`. Hay dos llamadas
  con `variant="plain"` (`AdminEditorModal.vue:43`) y `variant="compact"`
  (`AdminDraftArtifactModal.vue:187-199`) que **estampan las clases literales `plain` y `compact`**,
  que no existen en ningún sitio.
- **`.deasy-filter-control` promete `display:block`** (`forms.css:27`) y `HomeView.vue:80` es un
  `<button>` que necesita `flex`. El contrato del componente y la plantilla dicen cosas distintas; la
  utilidad de Tailwind gana, así que funciona — por accidente.

---

## 2. Accesibilidad: 88 fallos de 186 pares

Medido con WCAG 2.1 implementado desde cero y la **paleta real de `tailwindcss@4.2.2`** extraída de
`node_modules` (no valores de memoria), resolviendo los `color-mix()` como interpolación en sRGB
gamma-codificado, que es lo que hace el navegador.

| Tipo | Pares | Fallos |
|---|---:|---:|
| Texto (4.5:1) | 80 | 17 |
| Límite de componente (3:1) | 79 | 66 |
| Icono informativo (3:1) | 27 | 5 |

**Matiz honesto sobre los 66**: unos 33 son límites reales de control (borde de botón, campo,
*dropzone*, conector) y sí incumplen 1.4.11; unos 21 son decorativos (bordes de tarjeta, separadores
de fila) que WCAG no exige; y 12 son mediciones del **relleno solo** de los botones de acción, donde
el trabajo lo hace el borde y ese sí cumple.

### 2.1 Los que importan

| Ratio | Umbral | Dónde | Qué |
|---:|---:|---|---|
| **1.75** | 4.5 | `forms.css:118` | Placeholder del campo **en error**: `red-300` sobre `red-50`. El peor par del sistema |
| **2.10** | 4.5 | `buttons.css:399` | Tooltip «certificado»: blanco sobre `--state-gold` |
| **2.11** | 4.5 | `auth.css:236` | Botón de login **deshabilitado** |
| **2.56** | 4.5 | `buttons.css:53` | **Todo** botón primario deshabilitado |
| **2.63** | 4.5 | 202 usos / 42 ficheros | `text-slate-400` — y es el placeholder de `.deasy-field-input` y `.deasy-auth-field` |
| **2.64** | 4.5 | `base.css:59` | `a { color: var(--brand-accent) }` — el color por defecto de **todo enlace** |
| **2.70 / 2.71** | 4.5 | `graph.css:179` | `.graph-node__btn--accent` en las variantes `--config` y `--template`. **Introducido el 2026-08-11** |
| **2.96** | 4.5 | `auth.css:238` | El botón de login: su degradado empieza en 5.24 y **acaba aquí** |
| **1.33** | 3.0 | `forms.css:155` | Borde `sky-200` de la zona de subida (con `--disabled`, 1.15) |
| **1.92 / 1.95** | 3.0 | `forms.css:103,118` | Borde del campo en error, y **el borde de foco** — que cuenta doble: es el único indicador de teclado |

`--state-gold` **no cumple en ninguno de sus usos**: icono 2.10, tooltip 2.10, chip 1.91.

### 2.2 Al filo — no tocar sin medir

- `.hope-action-delete-pdf` **pasa por 0.01** (3.01). Cualquier retoque de `--state-warning` lo tumba.
- `.deasy-tag--danger` **falla por 0.14** (4.36).
- `.deasy-btn--success` 3.65 · `.deasy-field-message--error` 3.81 · `.deasy-tag--salmon` 3.19.

### 2.3 Lo que sí está bien, y conviene no «arreglar»

La barra lateral oscura: **0 fallos de texto en 663 nodos medidos** (`white/55` = 6.08, `/76` = 10.57,
`/84` = 12.70). Lo que falla ahí son los **bordes** (`white/8` = 1.23, `/10` = 1.32, `/16` = 1.60), no
la tipografía.

### 2.4 Contradicciones con `frontend/CLAUDE.md`

Cuatro reglas están escritas y no se cumplen. Conviene saberlo porque ese documento se lee como línea
base:

| § | Dice | Realidad |
|---|---|---|
| §3 | «el suelo de texto es `--brand-text-muted` (6.36:1)» | `text-slate-400` (2.63) se usa **202 veces**, y es el placeholder de los campos |
| §3 | «límite de componente 3:1» | Ninguno de los tres tokens de borde llega, y el que se pinta es el peor |
| §5.4 | «la elevación es una escala de tres» | **19 sombras distintas** en los `.vue`, ninguna vía token |
| §2.1 | «0 hex y 0 `rgba()` numéricos» | Cierto en `.css`; fuera viven 40 `rgba()` dentro de `shadow-[…]` y 12 hex en *arbitrary values* |

---

## 3. Qué queda por tokenizar

### 3.1 Los 89 literales fuera del CSS

**89 ocurrencias · 51 colores distintos · 18 ficheros** (68 en `.vue`, 21 en `.js`). No hay ni un
`hsl()` ni un color dentro de data-URI SVG, así que el cubo «no tokenizable» está vacío.

| Cubo | Ocurrencias | Criterio |
|---|---:|---|
| **A · sustitución invisible** | **40** (45 %) | ΔE ≤ 2 contra un token existente |
| **B · tiene familia** | 28 | Se deriva con `color-mix()` de un token; el porcentaje está calculado |
| **C · sin familia** | 20 | Pide decisión |

**Tres colores explican 51 de las 88 ocurrencias reales** (58 %).

#### A · La tinta de sombra: 31 de las 40

`#0f172a` escrito a mano con **ocho alfas distintas** (`.04`×11, `.05`×5, `.06`×4, `.07`×3, `.12`×3,
`.08`, `.16`, `.18`), más dos vecinos indistinguibles: `rgba(7,18,38,.24)` (ΔE 1.77) y
`rgba(11,31,63,.06)` (ΔE 1.09 compuesto).

**No es un color nuevo: es el token que nunca se declaró.** Vive incrustado dentro de
`--brand-shadow`, `--shadow-raised`, `--shadow-modal`, `--shadow-drawer` y `--overlay-backdrop`, pero
**no existe como token plano**, así que desde una plantilla no hay forma de referirlo.

El caso más literal: `WorkspaceChatLauncher.vue:21` contiene
`shadow-[0_1px_2px_rgba(15,23,42,0.04),0_24px_64px_rgba(15,23,42,0.16)]`, que es **`--shadow-modal`
reescrito byte por byte**, geometría incluida.

#### B · Rampas de un token que ya existe

| Familia | Ocurrencias | Qué es |
|---|---:|---|
| Salmón «pendiente» | 6 | `--state-pending` al **14 / 31 / 49 / 50 / 65 / 76 %** sobre blanco. Una sola rampa |
| Chip de perfil (`PerfilView.vue:70`) | 3 | `--action-view` al **13 / 27 / 100 %** |
| Grises de icono | 4 | `--brand-icon` al 56-72 % |
| Violetas y azules | 6 | `--brand-primary` y `#3898ff` |
| Verdes y teals | 7 | `--state-success` y `--brand-accent` (`#18b7a3` es `--brand-accent` con 2.5 % de blanco: ruido de teclado) |

En el mismo `switch` de `homeView.helpers.js`, las ramas `completed`/`current`/`rejected` usan clases
de Tailwind y **sólo `pending` está escrita a mano**.

#### C · Lo que necesita token nuevo

**La menta `#4BF1A1` — 11 usos, más `#3DE08F` y `#2ec97d` que son su rampa.**

Es el color individual más repetido después de la tinta de sombra, y **no se puede colapsar**:

```
mejor color-mix con --brand-accent  →  ΔE 19.75 al 55.9 %
mejor color-mix con --state-success →  ΔE 18.46 al 44.8 %
curva plana: 40 % → 20.35 · 56 % → 19.75 · 70 % → 20.14
```

No es cuestión de porcentaje: `--brand-accent` (`#00b2a9`, teal) y `#4BF1A1` (menta) están en tonos
distintos. Y significa algo que ningún token significa: **«este paso es el actual / te toca firmar»**,
distinto de `--state-success` («ya está hecho»). Colapsarlo perdería una distinción real — justo lo
que `frontend/CLAUDE.md` §2.3 advierte que no hay que hacer.

**Y arrastra dos fallos que tokenizar arregla:**

1. Como **borde** sobre blanco da **1.46:1** (`DeliverableCard.vue:133`, `HomeView.vue:1332`), muy por
   debajo del 3:1 de 1.4.11.
2. Su texto acompañante `#118a57` da **4.38:1 sobre blanco** y **4.18:1** sobre el fondo teñido — **no
   llega a AA**. Sustituirlo por `--state-success` lo sube a 5.48 y 5.24.

Es el único punto de la auditoría donde tokenizar **arregla** una violación en vez de sólo ordenar.

**La escala categórica de aristas — 7 colores, `UnitGraphView.vue:497`.**

```
["#6366f1","#0ea5e9","#10b981","#f59e0b","#ec4899","#8b5cf6","#14b8a6"]
```

Es una **paleta cualitativa de visualización**, no colores de marca: su valor no es lo que cada uno
significa, sino cuánto se separan. Su separación mínima ya es **ΔE 7.2**, y la segunda **ΔE 10.7**.
Acercar cualquiera a un token de marca **los junta más**.

Lo que falta no es un token por arista: es **una escala declarada como escala**, con separación
mínima objetivo y anclada en `--brand-primary`.

> Nota: `ProcessGraphView.vue:369-371` declara **otras tres** constantes de arista que no son un
> subconjunto de esa lista. **Los dos grafos del mismo módulo no comparten paleta.**

### 3.2 Los 3 590 colores de Tailwind por nombre

| Ubicación | Familias | `white` | Total |
|---|---:|---:|---:|
| `.vue` — plantilla | 2 642 | 290 | **2 932** |
| `.vue` — script | 283 | 12 | 295 |
| **`@apply` en `shared/styles/*.css`** | **153** | **58** | **211** |
| `.js` | 128 | 11 | 139 |
| Selectores de `overrides.css` | 7 | 6 | 13 |

**Por familia**: slate **1 838** (51 %) · sky 345 · emerald 223 · indigo 217 · rose 172 · amber 161 ·
red 131 · blue 66 · violet 31 · green 14 · cyan 10 · orange 3 · lime 2.

**Ausentes (0 usos)**: `gray`, `zinc`, `neutral`, `stone`, `yellow`, `teal`, `purple`, `fuchsia`,
`pink`. El gris del proyecto es **slate y sólo slate** — eso es una buena noticia.

**Concentración**: `HomeView.vue` 671 · `FirmarPdf.vue` 345 · `AdminDraftArtifactModal.vue` 185 ·
`UnitGraphView.vue` 179 · `ProcessGraphView.vue` 158. Los tres que `frontend/CLAUDE.md` §6.8 marca
como «piden ser partidos» suman **1 094 de 3 590 (30,5 %)**.

#### Siete tokens SON un color de Tailwind

Con ΔE **0.00**. Para esas familias la migración es **de nombre, no de color**: nada se mueve en
pantalla.

| Token | Hex | Tailwind |
|---|---|---|
| `--state-success` | `#047857` | **emerald-700** |
| `--state-warning` | `#b45309` | **amber-700** |
| `--action-view` | `#075985` | **sky-800** |
| `--brand-surface-alt` | `#f8fafc` | **slate-50** |
| `--brand-icon` | `#475569` | **slate-600** |
| `--brand-navy` | `#111827` | gray-900 |
| `--brand-ink` | `#1f2937` | gray-800 |

Y cerca: `--brand-surface-muted` (slate-50, ΔE 0.60) · `--brand-border` (slate-200, 1.37) ·
`--brand-border-strong` (slate-300, 1.63) · `--state-danger` (red-700, 3.55).

#### Dónde se rompe la homogeneidad

**Misma familia, significados distintos:**

| Familia | Significados simultáneos |
|---|---|
| **amber** | aviso · `draft` · `retired` · **jefatura** (la corona) — cuatro |
| **rose** | error · entidad **inactiva** · botón destructivo · `retired` — cuatro |
| **sky** | banner informativo · **seleccionado** · **anillo de foco** · `completed` · borde del dropzone |
| **indigo** | **foco de campo** (59 usos) · paso activo del asistente · «actualización guiada» |
| **emerald** | éxito · `active`/`published` · ocupación completa · dropzone con fichero |
| **slate** | estructura **y** un estado semántico: el chip «neutro/sin datos» |

**Familias distintas para el mismo significado:**

| Significado | Familias | Total |
|---|---|---:|
| info / foco / primario | sky + blue + indigo (+1 violet) | **629** |
| error | rose + red | 303 |
| éxito | emerald + green | 237 |
| aviso | amber + orange | 164 |

**Dos contradicciones concretas, verificadas:**

- **El estado `retired` está pintado de cuatro colores en cinco ficheros**: `amber-50/700`
  (`AdminEditorModal.vue:322`), `amber-200/800` (`AdminProcessWizardShell.vue:97`,
  `AdminMainTableSection.vue:458`), `slate-100/500` (`ProcessGraphView.vue:782`,
  `ProcessTemplateNode.vue:67`) y `rose-50/600` (`UnitGraphView.vue:837`).
- **El foco: 116 utilidades en 5 familias** contra el `--focus-ring` único que §5.3 da por resuelto.
  59 son `focus:border-indigo-400`, 36 sky, 17 blue.

#### El repintado de `overrides.css` se queda corto por 85

`overrides.css` reasigna 12 utilidades (`.bg-slate-100`, `.bg-slate-50` + opacidades, `.bg-white` +
opacidades, `.border-slate-100/200`) a tokens de marca **en tiempo de ejecución**, y cubre **834 de
3 577 apariciones (23,3 %)**: el color acaba siendo el de marca aunque el fuente diga Tailwind.

Pero es una **lista blanca de opacidades escrita a mano**, y **85 apariciones se le escapan**:

| Utilidad no cubierta | Usos |
|---|---:|
| `bg-slate-50/50` | 35 |
| `border-slate-200/80` | 18 |
| `bg-slate-50/60` | 14 |
| `border-slate-200/90` | 9 |
| `bg-white/70` · `/40` · `/25` | 5 |
| `bg-slate-100/40` · `/50` · `/70` · `bg-slate-50/95` | 4 |

Esas 85 pintan el gris de **Tailwind**, no el de la marca, **junto a hermanas repintadas dentro del
mismo componente**. Es una diferencia de color real y silenciosa.

---

## 4. La paleta

**65 custom properties** declaradas en `tokens.css`.

### 4.1 Grasa

| | |
|---|---:|
| Tokens con **0 usos** | **11** |
| Tokens con **1 solo uso** | 10 |
| Registros de `@theme` que no llegan al CSS construido | **9 de 16** |
| Utilidades Tailwind rotas (`bg-x` sin registrar) | **0** ✅ |

Casos que merecen nombre propio:

- **`--brand-navy-menu`**: el color sólido tiene **0 usos**; sólo vive su triplete `-rgb` (3 usos). El
  «azul del botón de menú» nunca se usa opaco.
- **`--brand-accent-rgb`**: 0 usos. Pareja rota al revés.
- Los `-rgb` **no siguen ningún criterio**: `--state-danger` tiene 15 usos y **no** tiene `-rgb`,
  igual que `--brand-navy` (15) y `--brand-border` (23). El criterio real fue «se creó cuando alguien
  necesitó un `rgba()`».

### 4.2 `@theme` no se eligió por uso

Registra `--color-state-gold` (que no usa nadie como utilidad) y **deja fuera
`--brand-text-muted`**, que tiene **14 usos por `var()` + 6 por valor arbitrario = 20**.

Ese es el síntoma medible: **14 valores arbitrarios `X-[var(--token)]`** que existen sólo porque el
token no está registrado.

| Usos | Token | ¿En `@theme`? |
|---:|---|---|
| 6 | `--brand-text-muted` | **no** |
| 3 | `--brand-shadow` | **no** |
| 2 | `--shadow-modal` | **no** |
| 2 | `--focus-ring` | **no** |
| 1 | `--state-pending` | **no** |

**Lo que falta para desbloquear los 3 590:**

| Concepto | Token | Apariciones Tailwind que lo necesitarían |
|---|---|---:|
| Aviso | `--state-warning` | 164 (amber + orange) |
| Texto secundario | `--brand-text-muted` | ~500 (`text-slate-400/500`) |
| Icono secundario | `--brand-icon` | — |
| Acciones de tabla | `--action-view/-upload/-neutral` | — |
| Pendiente | `--state-pending` | — |

### 4.3 Dos colisiones de namespace **activas y probadas**

`--font-weight-medium: 500` y `--font-weight-semibold: 600` viven en el `:root` **sin capa**
(`tokens.css:212-213`), que es lo que más fuerza tiene del proyecto. El CSS construido lo confirma:

```
.font-medium{--tw-font-weight:var(--font-weight-medium);font-weight:var(--font-weight-medium)}
```

y el mismo fichero declara `--font-weight-medium:500` **dos veces**: la de Tailwind en `@layer theme`
y la del proyecto sin capa, que gana. **Es el mecanismo exacto de `--radius-lg`**, el fallo que costó
meses de escala de radios invertida.

Hoy es inocuo porque los valores coinciden. Pero cambiar `--font-weight-medium` a 550 repintaría
**cada `font-medium` de la app**, y quien lo hiciera creería estar tocando dos reglas de `base.css`.
Tres usos en total a cambio de esa mina.

`--font-weight-regular: 400` **no** colisiona (Tailwind lo llama `--font-weight-normal`), pero el
nombre divergente hace que el trío parezca homogéneo cuando dos de sus miembros son sombras de
Tailwind y el tercero no.

### 4.4 Los `--shadow-*` están en el peor de los dos mundos

`--shadow-raised`, `--shadow-modal` y `--shadow-drawer` **ocupan el namespace** `--shadow-*` de
Tailwind v4 y **no están en `@theme`**, así que no generan `shadow-raised` y el código tiene que
escribir `shadow-[var(--shadow-modal)]`. Ocupan el sitio sin cobrar el beneficio, y si Tailwind
añadiera un `--shadow-raised` propio la colisión sería instantánea y silenciosa.

Añádase que el **primer escalón de la misma escala se llama `--brand-shadow`**: un `grep '--shadow-'`
no lo encuentra, y un `grep '--brand-'` no encuentra los otros dos. Cinco tokens de la propiedad
`box-shadow` repartidos en **tres convenciones de nombre** (contando `--focus-ring`).

### 4.5 Dos racimos perceptuales

Calculado con CIEDE2000 entre todos los pares. **9 pares con ΔE ≤ 3**, y no son nueve problemas sino
dos:

**Superficies — 4 tokens, 101 usos, los seis pares posibles entre ΔE 0.50 y 2.04.**
`--brand-white` (76) · `--brand-surface-alt` (7) · `--brand-surface-soft` (1) ·
`--brand-surface-muted` (17). Contraste sobre blanco: 1.00 / 1.05 / 1.05 / 1.05. **Perceptualmente son
un color**, y los nombres `alt`/`soft`/`muted` no forman escala. `--brand-surface-soft` es
literalmente `--brand-surface-muted` al 92 %: una opacidad, no un color.

**Bordes — 4 tokens, 43 usos.** `--brand-border` ↔ `--brand-border-strong` sí se separan (ΔE 4.13),
pero **`--brand-border-field` cae en medio de los dos** (2.33 y 2.03): no añade un escalón, lo
emborrona. Y `--brand-info-soft` compuesto sobre blanco da `#e9effd`, a **ΔE 2.51 de `--brand-border`**
— el azul informativo y el borde gris son el mismo color.

> **`--state-danger` ↔ `--state-pending` (ΔE 5.69)** es el par de estados más cercano, y está
> **defendido a propósito** en `frontend/CLAUDE.md` §2.3. Queda anotado como decisión, no como
> hallazgo. Para calibrar: `--state-warning` ↔ `--state-pending` = 11.15.

### 4.6 Nombres que no dicen su papel

- **Cuatro azules oscuros nombrados por tono**: `--brand-navy-deep` (fondo del workspace),
  `--brand-navy` (hover de navegación), `--brand-ink` (texto) y `--brand-navy-menu` (0 usos). Con 4.85
  y 5.74 de separación, la única forma de elegir el correcto es leer el comentario.
- **`--brand-icon` es un cuarto gris de texto que se salvó de la unificación porque se llama
  «icon»**. Está a ΔE 5.52 de `--brand-text-muted`. El nombre lo blindó, no la función.
- **`--state-gold` no es un estado**: el comentario admite «solo BtnSera». Es el color de un
  componente con prefijo de familia semántica, y el único de los cinco que no cumple contraste.
- **`--brand-black` es un operador, no un color**: 12 usos, todos `color-mix(… var(--brand-black))`.
  El comentario avisa «no pintes nada con él», pero el nombre invita a lo contrario.

### 4.7 Deriva documental dentro del propio `tokens.css`

Los comentarios referencian **seis veces** dos ficheros que **ya no existen**: `theme.css`
(líneas 37, 68, 69, 80, 84, 117) y `tailwind.css` (117-118). Se fusionaron en `tokens.css` y los
comentarios se arrastraron.

**Consecuencia práctica:** el aviso más importante del fichero — «`--font-weight-medium/semibold`
pisan el namespace de Tailwind» — **apunta a un fichero fantasma**, cuando el culpable está 136 líneas
más abajo **en el mismo fichero**.

Y las líneas 39-42 afirman:

> ⚠️ **Este repo no declara `@custom-variant dark`**, así que Tailwind v4 compila `dark:` a
> `@media (prefers-color-scheme: dark)`…

cuando **la línea 24 del mismo fichero es exactamente esa declaración**. La conclusión operativa sigue
siendo correcta, pero la razón que da es falsa — y es el tipo de contradicción que hace que alguien
«arregle» el seguro creyendo que sobra.

### 4.8 Lo que sí está sano

- **Cero literales de color fuera de `tokens.css`** en todo el CSS. La regla se cumple al 100 %.
- **Cero utilidades rotas**: no hay ni un `bg-brand-x` que apunte a un nombre no registrado.
- **Cero `--radius-*`**: el secuestro de la escala está resuelto y verificado en el CSS construido.
- Las tres custom properties locales (`--graph-accent`, `--tooltip-bg`, `--tw-ring-color`) derivan de
  la paleta. Sólo la última merece reparo: es una **variable interna de Tailwind** escrita a mano
  (`forms.css:102`), un contrato privado que puede cambiar en una versión menor y dejar el foco de los
  campos sin anillo **en silencio**.
- **`--action-*` no está incompleto**: hay 11 clases `hope-action-*` y 3 tokens porque las otras ocho
  derivan de `--state-*`. El reparto es deliberado.

---

## 5. CSS muerto: ~117 líneas

De **324 clases** declaradas en los 16 módulos, 55 no aparecen literalmente en el fuente. De esas,
**16 están vivas por composición en runtime** y **39 están muertas**.

> **Las 16 que un `grep` habría matado** — y que no hay que tocar: las 8 `deasy-tag--*` (compuestas en
> `AppTag.vue:23`), las 4 `deasy-nav-item__icon--*` y 2 `deasy-nav-glyph--*` (por
> `workspaceNavIcons.js:26`, **con el literal en un valor por defecto de parámetro**),
> `router-link-active`, `vue-flow__handle`, `process-dialog-content` y `signature-workspace-icon`.
> Es exactamente la trampa que en la sesión del 2026-08-09 se llevó dos clases por delante con el
> build, el lint y los 304 tests en verde.

**Reglas 100 % muertas — 12 reglas, 59 líneas:**

| Fichero:líneas | L | Selector |
|---|---:|---|
| `admin.css:61-73` | 13 | `.admin-page-header__icon` |
| `admin.css:54-59` | 6 | `.admin-page-header__subtitle` |
| `nav.css:95-101` | 7 | `.deasy-nav-glyph--violet`, `.deasy-nav-item__icon--violet`, `--derived` |
| `nav.css:154-158` | 5 | `.deasy-nav-action--active` |
| `tables.css:2-5,7-9,11-14` | 11 | `.deasy-table-shell`, `-header`, `-title` |
| `tags.css:45-48,52-55` | 8 | `.deasy-tag--contrast`, `--hero` |
| `forms.css:107-113` | 6 | `.deasy-field-input--icon-left`, `--icon-right` |
| `misc.css:44-46` | 3 | `.deasy-hero-kicker--ghost` |

**Selectores muertos dentro de una lista viva — 30 reglas, 58 líneas.** El bloque más podrido es
`overrides.css:17-40`: **10 de sus 22 selectores** no tienen consumidor. Y `buttons.css:180-230` tiene
**7 reglas** en las que la mitad `.deasy-table-shell …` está muerta (la gemela `.deasy-table-responsive
…` sí vive, por eso los botones de tabla se ven bien).

> Contraste útil: `auditoria-color.md:68-70` ya marcaba `.deasy-table-shell/-header/-title`,
> `.profile-dialog-*` y `.admin-page-header__subtitle/__icon` como «0 usos». **Siguen ahí.**

### 5.1 Reglas que no aplican por la cascada

- **`.shadow-xl` en `overrides.css:73` no aplica nunca.** Cinco líneas más arriba,
  `overrides.css:1-5` declara la misma clase dentro de `@layer utilities` **con `!important`**, y un
  `!important` gana siempre a una declaración normal esté en la capa que esté. Los 22 usos reciben
  `--shadow-raised`; el `--brand-shadow` de la línea 73 es letra muerta para esa clase. Es el único de
  los 6 `!important` **sin comentario que lo justifique**.
- **`overrides.css:99` anula el `rounded-2xl` de `forms.css`** con `border-radius: 0.5rem`. El
  `@apply` del módulo promete 16 px y el DOM da 8. El contrato del componente miente.
- **33 selectores duplicados entre módulos.** Todos los resuelve la misma mecánica: `overrides.css` va
  el último **y sus reglas están fuera de capa**, así que gana por partida doble (orden + capa). Es el
  diseño documentado — pero conviene saber que gana **siempre**, no por especificidad.

### 5.2 El problema inverso: 7 clases usadas sin regla

Además de las tres de §1.2 y §1.3, cuatro marcadores sin estilo: `deasy-embedded-shell`
(`AppInlineShell.vue:4`, y **es la única clase de ese `<div>`**), `deasy-info-tip`, `-tip__trigger` y
`-tip__bubble`.

---

## 6. Escalas rotas

### 6.1 Tipografía: 3 escalones escritos de 9 formas

**443 *arbitrary values*** en 51 ficheros y 28 prefijos. El peor es `text-[…]`: **193 usos, 18 valores
distintos**, de los que **12 están por debajo de `text-sm`** (14 px) sumando 185 usos.

| Valor | px | Usos | | Valor | px | Usos |
|---|---:|---:|---|---|---:|---:|
| `9px` | 9.00 | 3 | | `0.7rem` | 11.20 | 20 |
| `0.6rem` | 9.60 | 25 | | `0.72rem` | 11.52 | 1 |
| `0.62rem` | 9.92 | 1 | | `12px` | 12.00 | 3 |
| `10px` | 10.00 | 24 | | `0.78rem` | 12.48 | 2 |
| `0.65rem` | 10.40 | 12 | | `13px` | 13.00 | 5 |
| `0.68rem` | 10.88 | 1 | | `11px` | 11.00 | **88** |

Nadie distingue `9px` de `0.6rem` (9.60) de `0.62rem` (9.92); ni `10px` de `0.65rem` de `0.68rem`; ni
`11px` de `0.7rem` de `0.72rem`. **Son tres escalones reales.** Y `text-[0.9rem]` (14.40) y
`text-[0.95rem]` (15.20) existen teniendo `text-sm` (14) y `text-base` (16) a un paso.

Le siguen `rounded-[…]` (37 usos, **14 valores**, una escala de radios paralela a la de Tailwind que
se acaba de arreglar) y `shadow-[…]` (**33 usos, 19 valores**, ninguno vía token).

### 6.2 `z-index`: tres bandas que no se hablan

**11 valores numéricos en 14 grafías.**

| Banda | Valores | Origen |
|---|---|---|
| **0–50** | `z-0`, `z-10` (×18), `z-20`, `z-30`, `z-40`, `z-50` | La escala de Tailwind, usada sin criterio de capa. 10 de los 18 `z-10` están en `FirmarPdf.vue` sobre texto donde no hay nada que apilar |
| **6, 25, 90** | `graph.css:140`, `buttons.css:408`, `WorkspaceChatLauncher.vue:5` | Números elegidos a ojo, en tres sitios distintos |
| **1075, 1100** | `AppDialogOverlay.vue:7` + `dialogs.css:162`, `AppInfoTip.vue:24` | Herencia de Bootstrap. Y **1075 no es ni siquiera un valor de Bootstrap** (modal 1055, popover 1070, tooltip 1080): está *entre* dos |

Añádase que `z-[20]` y `z-[50]` en `SNotify.vue` **compilan exactamente igual** que `z-20` y `z-50`:
dos grafías más del mismo valor sin ganar nada.

### 6.3 *Utility soup*: 255 strings de más de 120 caracteres

En **51 de 126 ficheros**. `HomeView.vue` **58** · `FirmarPdf.vue` **41** ·
`WorkspaceChatLauncher.vue` 16 · `GeneralTaskModal.vue` 13. El más largo tiene **418 caracteres**
(`HomeView.vue:623`).

**33 strings distintos aparecen más de una vez**, sumando 84 usos — el peor se repite **7 veces**.
Son clases sin nombre esperando a existir.

> `frontend/CLAUDE.md` §8 dice 221; hoy son **255**. Ese contador está desactualizado. Los otros dos
> (443 *arbitrary values*, 89 colores fuera del CSS) **sí están vigentes**, y tres mediciones
> independientes coinciden en ellos.

---

## 7. Lo que NO hay que tocar

| Qué | Por qué |
|---|---|
| **Los 7 colores de arista del grafo** | Paleta cualitativa. Separación mínima ya en ΔE 7.2; acercarlos a tokens de marca **los junta más** y rompe lo que los hace legibles |
| **`--state-danger` ↔ `--state-pending`** (ΔE 5.69) | Decisión tomada y documentada: «pendiente» ≠ «rechazado». Colapsarlo pierde una distinción que el usuario necesita |
| **Los textos blancos de la barra oscura** | 0 fallos en 663 nodos medidos. Ahí fallan los bordes, no la tipografía |
| **`--tw-ring-color`** | Interno de Tailwind. Anotado como reparo, pero no se «arregla» sin reemplazarlo por la API pública |
| **Las 16 clases compuestas en runtime** | Un `grep` las da por muertas y no lo están |

---

## 8. Corrección de cifras

Dos mediciones independientes coincidieron al decimal: **los contrastes anotados en `tokens.css` están
subestimados en 3 de 4.**

| Token | Comentario | Real |
|---|---:|---:|
| `--state-success` `#047857` | 5.00:1 | **5.49:1** |
| `--state-danger` `#b42318` | 5.93:1 | **6.57:1** |
| `--state-warning` `#b45309` | 4.68:1 | **5.02:1** |
| `--state-pending` `#b8432b` | 5.42:1 | 5.42:1 ✓ |

Los tres desvíos son **conservadores** (el color contrasta más de lo que dice el comentario), así que
no hay riesgo — pero alguien que quiera aclarar `--state-warning` creerá tener menos margen del que
tiene. `--brand-text-muted` (6.36:1) sí coincide exactamente.
