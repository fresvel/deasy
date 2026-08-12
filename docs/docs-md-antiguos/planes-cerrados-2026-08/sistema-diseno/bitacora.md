# Bitácora — Frente 4 · Sistema de diseño

Qué se hizo, qué se midió y **qué se descartó y por qué**. Lo último es lo que más vale: evita que
dentro de tres semanas alguien vuelva a proponer lo mismo.

Rama `refactor/sistema-diseno-css`, worktree `../deasy-css`, base `develop` @ `d332619`.

---

## Sesión 2026-08-09

### Fase 0 · Red de seguridad — ✅

Lint limpio y **18 suites / 304 tests** en verde antes de tocar nada.

**El método de verificación es lo importante de esta fase.** Los screenshots no sirven para demostrar
"cambio visual cero": hay que mirarlos, y el ojo perdona. Lo que se usó es una **huella de estilos
computados**: para cada nodo del DOM se registran 34 propiedades de `getComputedStyle` más su
`getBoundingClientRect`, y se compara antes/después nodo a nodo. Un `fpdiff` sobre eso da un número,
no una impresión.

Bases capturadas: `/login`, `/home`, `/home/documentos`, `/perfil`, `/admin`,
`/admin/usuarios/personas/persons` y el modal de asignaciones.

> ⚠️ La base de `/home/documentos` salió **inválida**: se capturó con la página a medio renderizar
> (4 nodos). No se detectó hasta comparar. Para esa ruta se usó la comprobación alternativa de la
> fase 1 (ninguna clase podada presente en el DOM). **Lección: comprobar el número de nodos de la
> captura base antes de fiarse de ella.**

### Fase 1 · Borrar lo muerto — ✅

**3 997 → 2 612 líneas de CSS.** `theme.css` 1 914 → 863, `tailwind.css` 1 479 → 1 145.

| Qué | Resultado |
|---|---|
| Familias `.menu-*` y `.home-*` de `theme.css` | fuera, con 4 de las 6 media queries del proyecto dentro |
| Sedimento de Bootstrap sin dependencia declarada | fuera: `.card`, `.table`, `.btn-group`, `.list-group-item`, `.table-striped` y los 6 `--bs-table-*` |
| Clases de `@layer components` sin consumidor | 75 |
| Tokens sin consumidor | 32 |
| Bloques `<style>` muertos | 4 SFC |
| `.rounded-4xl`, `frontend/.eslintrc.js` | fuera |

**`.table-institutional` también cayó, y la auditoría la daba por viva.** Se comprobó: 0 referencias
en todo el fuente y 0 nodos en el DOM. Lo que estila la tabla de admin son utilidades Tailwind.

#### El fallo que sólo vio la huella

`scripts/css-prune.mjs` v1 buscaba clases con `grep` literal y con un detector de plantillas
`algo${`. Se llevó `.deasy-nav-item__icon--emerald` y `--amber`, y **el build, el lint y los 304 tests
pasaron en verde**. La huella de `/home` lo cazó: 16 nodos con `color` y `border-top-color` cambiados.

La causa son dos formas de componer clases en runtime, y la segunda es la traicionera:

```js
AppTag.vue:23            `deasy-tag--${props.variant}`
workspaceNavIcons.js:26  (tone, prefix = 'deasy-nav-item__icon') => `${prefix}--${tone}`
```

En la segunda **el literal va como valor por defecto de un parámetro**, así que ni siquiera queda
pegado al `${`. Ningún grep lo encuentra.

La v2 razona por **prefijos**: construye un vocabulario de los 2 011 tokens con guion del fuente y
conserva la clase si ella o cualquiera de sus prefijos (cortados en cada frontera `-`/`--`) está en
él. Poda de menos a propósito — 75 clases en vez de 96.

#### Verificación

| Ruta | Nodos | Diferencias |
|---|---|---|
| `/login` | — | **PNG con MD5 idéntico** |
| `/home` | 954 | 0 |
| `/perfil` | 390 | 0 |
| `/admin` | 403 | 0 |
| `/admin/usuarios/personas/persons` | 3 233 | 0 |
| `/home/documentos`, `/home/firmas` | 282 / 1 521 | 0 clases podadas presentes |

### Fase 2 · `AdminTableManager.css` — ✅

**Borrado entero: 604 líneas, 86 reglas.** Cambio visual cero, porque no aplicaba **ninguna**.

Medido en el navegador, no deducido. En `/admin/usuarios/personas/persons`:

```
total de reglas del fichero      86
casan con el DOM                  0
casarían sin `scoped`             8
no casarían nunca                78
```

Y con el modal de asignaciones abierto — el escenario **más favorable** al fichero, porque es donde
viven la mitad de sus selectores — sigue siendo **0 de 86**.

La prueba más limpia: `.admin-action-col` declara `position: sticky; right: 0; z-index: 2` en su
propio CSS, y el DOM devuelve `position: static`. **La columna de acciones pegajosa se diseñó y nunca
funcionó.**

La causa es la mecánica de `scoped` en Vue: el `data-v-*` se añade al **último** elemento del
selector. Si ese elemento vive en un componente hijo (`AdminFeedbackToast`,
`AdminPersonAssignmentsModal`), el selector no casa jamás. El fichero no tenía **ni un `:deep()`**.

#### Intención de diseño perdida — anotada, NO resucitada

15 reglas *casarían* sin el `scoped`. No son basura: son estilos que alguien escribió con intención y
que nunca se vieron. Resucitarlas **cambiaría el aspecto**, así que es otra decisión y otro commit:

| Selector | Nodos que tocaría |
|---|---|
| `.hope-action-view` / `.hope-action-assign` | 44 / 43 |
| `.person-assignment-table` | 7 |
| `.definition-activation-panel .definition-activation-menu .admin-btn` | 4 |
| `.person-assignment-menu-btn` (+ `.is-active`) | 3 (+1) |
| `.definition-activation-panel` | 2 |
| `.person-assignment-panel` / `-context` / `-menu` / `-form` / `-form-actions` | 1 cada uno |
| `.definition-activation-shell` / `-menu` | 1 cada uno |

**El panel de asignaciones de personas se está pintando hoy sin ninguno de sus estilos propios.** Si
alguien mira ese modal y le parece pobre, esta tabla es la explicación.

También se retiraron con él las 3 duplicaciones literales que tenía con `theme.css`
(`.table-title-with-icon`, `.table-title-icon`, `.table-title-icon.is-template-artifacts`), que ya
perdían la cascada.

#### Verificación

| Vista | Nodos | Diferencias |
|---|---|---|
| `/admin/usuarios/personas/persons` | 3 233 | 0 |
| El mismo, con el modal de asignaciones abierto | 3 339 | 0 |

### Fase 3 · Colapsar tokens — ✅ *(paso 3 del maestro)*

**Ya no hay dos juegos de tokens.** 54 sustituciones y `--deasy-*` desaparece.

La distinción que gobierna la fase: **colapsar el espacio de nombres no es fusionar valores.** Lo
primero es mecánico y no mueve un píxel; lo segundo es una decisión de diseño.

- Los tres que ya eran alias (`--deasy-border-soft`, `--deasy-primary`, `--deasy-brand-gradient`) se
  sustituyen por su destino y la indirección desaparece.
- Los otros siete **no tenían gemelo con el mismo valor**, así que se **renombran** conservándolo.
- `--brand-navy-deep` es nuevo: el navy `#071927` estaba escrito tres veces y no tenía token plano.

> **Trampa si se repite el colapso en otro sitio:** sustituir el nombre a secas deja
> `--brand-border: var(--brand-border)`, que es una **autorreferencia** y en CSS invalida la
> declaración. Los tres alias hay que **borrarlos**, no renombrarlos. Pasó y se corrigió.

**Además, `@theme`.** El proyecto usaba Tailwind v4 como si fuera v3 — cero `@theme`, con lo que
Tailwind no conocía ni un token y la única forma de usar un color de marca en una plantilla era
escribir el hex a mano. **Sin esto la fase 6 no tiene destino al que migrar.**

Verificado con una **sonda temporal** en `App.vue`, porque Tailwind es JIT y no emite lo que no ve
usado — inyectar la clase en runtime da un falso negativo:

```
.bg-brand-primary{background-color:var(--color-brand-primary)}
--color-brand-primary:var(--brand-primary);
```

### Fase 4 · Radios — ✅

**224 usos reescritos, mismo aspecto.** Los cuatro `--radius-*` fuera.

```
rounded-lg (16px) -> rounded-2xl (16px)   170
rounded-md (12px) -> rounded-xl  (12px)    52
rounded-sm ( 8px) -> rounded-lg  ( 8px)     2
```

**El orden importa**, y por eso no se hizo con tres `sed` seguidos: si `sm→lg` va antes que
`lg→2xl`, el resultado del primero lo captura el segundo y los 8px acaban en 16.
`scripts/css-radios.mjs` lo resuelve con **una** pasada por regex alternada.

Escala resultante, leída de `:root` en el navegador — **monótona**:

```
sm 4px  <  md 6px  <  lg 8px  <  xl 12px  <  2xl 16px
```

> **Efecto colateral que hubo que deshacer a mano:** el script también reescribió **4 comentarios**
> que describían el comportamiento *antiguo*, dejándolos diciendo lo contrario de lo que pasó
> ("hacen que `rounded-2xl` valga 16px"). Un reemplazo masivo sobre código fuente también toca la
> prosa; hay que revisarla.

### Fase 5 · Barandilla — ✅

**stylelint** + `stylelint-config-standard`, con las reglas cosméticas apagadas para que quede señal
y no ruido. Se apagó `color-function-alias-notation` (106 avisos de `rgba`→`rgb`), `color-hex-length`
y compañía: son estilo de escritura, no deuda.

`color-no-hex` está acotada con `stylelint-disable` **sólo sobre la declaración de la paleta**. Ahí un
hex es correcto — es donde se *define* el token; en cualquier otro sitio es una fuga.

**`pnpm run lint:css` sale en rojo a propósito y NO entra en el gate de CI** hasta llegar a cero. Lo
que importa es que no **suba**.

En ESLint, `vue/no-static-inline-styles` y `vue/prefer-separate-static-class`. Entraron en `warn` con
6 infracciones, se arreglaron las 6 en el mismo commit y quedan en **`error`**.

De paso, `lint` pierde el `--ext .js,.vue`, eliminado en ESLint 9 con flat config. No rompía nada
(verificado: sí analiza los `.vue`), pero era una trampa esperando.

### Fase 6 · Colores (parcial) — ✅ *(paso 5 del maestro, arañado)*

Sólo el subconjunto de mayor valor: hex en **componentes compartidos** que duplican **exactamente**
un token. Ahí el cambio es demostrablemente cero y el retorno máximo, porque son los que se copian.

| Qué | Dónde |
|---|---|
| `#5e4eff` → `brand-primary` | `AdminSelectField.vue`, `SToggle.vue` |
| `#071927` → `brand-navy-deep` | `SHeader.vue`, `SMenu.vue`, `UserProfile.vue` |
| `#343741` → `brand-text-strong` | `AdminSelectField.vue` |
| `#d7deea` → `brand-border-field` **(token nuevo)** | 6 sitios |
| `#f8fafc` → `brand-surface-alt` **(token nuevo)** | 7 sitios |
| 21 labels → `.deasy-form-label` | `LoginView`, `SystemBootstrapView` |
| `style="display: none"` → `class="hidden"` | `DossierSectionCrud.vue:79` |
| `{ borderWidth: '2px' }` → `border-2` | `SignatureBox.vue` |

`#d7deea` y `#f8fafc` recibieron token porque aparecían 6 y 7 veces con un **papel claro** (borde de
control de formulario, superficie alterna). `#7a869a` aparece **una** vez: no es un valor sistémico y
se dejó — un token por cada color de un único uso es una paleta que no dice nada.

Los 21 labels son el caso más doloroso del informe: **`.deasy-form-label` ya existía en
`tailwind.css` con exactamente ese `@apply`, byte por byte**. El design system estaba ahí y se
ignoraba.

---

## Cifras

| Métrica | Antes | Después | Δ |
|---|---|---|---|
| Líneas `theme.css` | 1 914 | **875** | −54 % |
| Líneas `tailwind.css` | 1 479 | **1 179** | −20 % |
| Líneas `AdminTableManager.css` | 604 | **0** | borrado |
| **Total CSS** | **3 997** | **2 054** | **−49 %** |
| Tokens declarados | 71 | **52** | −27 % |
| Juegos de tokens | **2** | **1** | — |
| `rounded-*` con valor secuestrado | 224 | **0** | — |
| Escala de radios | invertida | **monótona** | — |
| `@theme` | no existía | **16 colores** | — |
| Hex en `.vue` | 98 | **87** | −11 |
| Incidencias `lint:css` | (no había linter) | **151 + 103** | línea base |
| Linters de estilo | **0** | **2** | — |

Lo que **no** se movió, y era esperable: 221 strings de clase de más de 120 caracteres y 441
*arbitrary values*. Eso es el paso 5 completo del maestro y la utility soup de `HomeView`/`FirmarPdf`;
son varias sesiones y van con el frente 3 (partir `HomeView`).

## Verificación

Huella de `getComputedStyle` (34 propiedades) + `getBoundingClientRect` por nodo, antes/después:

| Vista | Nodos | Diferencias |
|---|---|---|
| `/login` | — | **PNG idéntico byte a byte** (`cmp`) |
| `/home` | 954 | **0** |
| `/perfil` | 390 | **0** |
| `/admin` | 403 | **0** |
| `/admin/usuarios/personas/persons` | 3 233 | **0** |
| … con el modal de asignaciones abierto | 3 339 | **0** |

Build OK · `lint` **limpio** · 18 suites / **304 tests**.

---

## Descartado, con motivo

- **`--radius-sm` y `--radius-button`** no se borraron en la fase 1 aunque el grep los daba sin
  consumidor. `--radius-sm` **sí lo tiene**: el `rounded-sm` que genera Tailwind, que no aparece en
  ningún fuente porque se emite en build. Borrarlo ahí habría sido un cambio visual colado dentro de
  una fase que promete no tener ninguno. Va en la fase 4, que es donde se decide.
- **`--tw-ring-color`**: es interno de Tailwind. No se toca.
- **Las 15 reglas de intención perdida de `AdminTableManager.css`**: resucitarlas cambia el aspecto.
  Es una decisión de diseño, no limpieza.
- **El bloque `local-dev` de `theme.css`**: sigue vivo. Que sólo actúe en desarrollo es el problema
  de fondo (**dev ≠ prod**), no el CSS en sí.

---

## Sesión 2026-08-10 · Módulos, dev = prod, y el primer barrido de color

No estaba en el plan del 2026-08-09: salió al preguntar por qué había un `theme.css` **y** un
`tailwind.css`, y por qué el aspecto era distinto en desarrollo.

### `local-dev` no era una variante de desarrollo — era el diseño

El bloque `local-dev` (220 líneas, 105 `!important`) estaba tras la condición equivocada. No hacía
que dev se viera *distinto*: hacía que **prod se viera mal**. Promoverlo arregló **3 de los 4 fallos
de WCAG 1.4.11** que producción tenía y nadie veía, porque nadie miraba producción.

**`dev = prod` a partir de aquí.** Y 80 `!important` → 5.

### 15 módulos por familia

`theme.css` + `tailwind.css` + `AdminTableManager.css` → **15 ficheros**, uno por familia, encadenados
por `index.css`. El orden de los `@import` **es parte del diseño**: `overrides.css` va el último a
propósito, y está explicado dentro del propio fichero.

Tres regresiones que sólo vio la huella, y las tres del mismo tipo — **reordenar CSS cambia quién
gana**:

1. Las listas de selectores que cruzaban familias se asignaban por el **primer** selector; hay que
   asignarlas a la familia **más tardía en el orden de importación**.
2. `.deasy-filter-btn` se clasificó como formulario y es un botón.
3. La cola del fichero (repintado de utilidades **y sus excepciones**) tenía que viajar junta.

### 74 hex → 0

Por script, y con dos trampas pagadas:

- **Hex corto dentro de hex largo.** `#fff` casaba dentro de `#fff0ed` y dejaba
  `var(--brand-white)0ed`: **43 botones se quedaron sin fondo**. Ordenar el mapa por longitud **no
  basta**; hace falta `(?![0-9a-fA-F])`.
- **Autorreferencia de token.** La sustitución masiva tocó una *redeclaración* y produjo
  `--brand-border: var(--brand-border)`, inválido en tiempo de cómputo: **114 nodos cayeron a
  `currentColor`**, sólo en dev.

Y el script **volvió a reescribir prosa** en los comentarios, como en la fase 4. Segunda vez: al
reemplazar en masa sobre código fuente, la prosa también se toca.

### La tipografía dejó de cargarse entera

Anidar el `@import` de Google Fonts dentro de un módulo hizo que **Vite lo descartara en silencio**.
`document.fonts.size === 0`, la app entera con la fuente de reserva. Lo detectó un `<h1>` **14 px más
estrecho con todos los estilos computados idénticos**. Se movió a `<link>` en `index.html`.

---

## Sesión 2026-08-11 (i) · Homogeneizar el color

Rama `color/rgba-y-apply`. Prioridad fijada por el usuario: **gama reducida y tonalidades homogéneas**.

| Qué | Resultado |
|---|---|
| `rgba()` numéricos fuera de `tokens.css` | **100 → 0** |
| Los 7 hex escondidos dentro de `@apply` | fuera |
| Sombras, foco, bordes y navegación | colapsados por familia |

**Dos mediciones que cambiaron decisiones:**

1. **ΔE no predice el contraste.** Correlación medida sobre 38 sustituciones: **−0.206**. Una con
   ΔE 5.2 rompió AA (4.55 → 4.19) y otra con ΔE 16.3 lo **mejoró** en +4.95. El criterio correcto es
   `contraste_después ≥ contraste_antes`, no «se parece».
2. **El borde es lo que dibuja el botón de acción.** El relleno al 10 % da 1.1:1 contra la fila: es
   invisible. Los seis bordes estaban entre **1.64 y 1.90**, o sea que **172 botones no tenían límite
   perceptible**. Derivarlos al 35 % los dejaba **más claros** que antes; al **71 %** los seis pasan
   3:1. Misma técnica, resultado opuesto según el porcentaje.

También: el placeholder pasó de **2.85 a 6.36:1**.

---

## Sesión 2026-08-11 (ii) · Modo oscuro: decidido que no

**Deasy es una app en claro y no se contempla modo oscuro.** Sus zonas oscuras —la barra lateral— son
color explícito, no un tema.

El riesgo era real y silencioso: sin protección, Tailwind v4 compila `dark:` a
`@media (prefers-color-scheme: dark)`, y **las recetas de TailAdmin traen 1 024**. Pegadas tal cual, a
quien tuviera el sistema en oscuro se le pintarían los componentes nuevos en oscuro sobre el resto en
claro — invisible para el build, el lint, los tests y para quien tenga el sistema en claro.

Tres capas, cada una tapa lo que la anterior no ve:

| | Qué cubre |
|---|---|
| `@custom-variant dark` en `tokens.css` | El seguro: deja `dark:` **inerte** aunque entre |
| `vue/no-restricted-class` (eslint, en `error`) | El atributo `class` de las plantillas |
| `pnpm run check:no-dark` | Lo que ninguna ve: dentro de `@apply`, dentro de `<style scoped>` y en `.js` |

---

## Sesión 2026-08-11 (iii) · Los 13 `<style scoped>`

**El frontend se queda en CERO `<style scoped>`.** Y el saldo dice más que el número de líneas:

| | |
|---|---:|
| Bloques al empezar | 13 |
| Líneas totales | ~330 |
| **Líneas que estaban MUERTAS** | **~180** |

**Más de la mitad no había que moverla: había que borrarla.**

### La trampa de las capas, en las dos direcciones

Un `<style scoped>` **no está en ninguna capa**; un módulo está en `@layer components`. Y en CSS **la
precedencia de capa gana a la especificidad**. Al mover el estilo cambian dos cosas a la vez:

- **Hacia abajo**: los conectores de Vue Flow volvieron a los valores de la librería (gris `#555`,
  6 px) porque su hoja va **sin capa**. Cualificar el selector a `.vue-flow__handle.graph-node__handle`
  **no arregló nada** — no era especificidad. La solución fue sacar esas reglas del `@layer`.
- **Hacia arriba**: `.cfg-node { background:#fff }` tapaba tres `bg-*` por estado que el componente
  declaraba y **que nunca se vieron**. Al pasar a una capa, el tinte **resucitó**. Se borraron las
  clases muertas: el estado ya se lee en el borde izquierdo y en la etiqueta.

### `:deep()` no salva si el ancla también es de otro componente

Las 84 líneas de `HomeView.vue` **nunca pintaron nada**. `.ancla :deep(.hijo)` compila a
`.ancla[data-v-TUYO] .hijo`: sigue exigiendo que **`.ancla`** lleve tu scope. Y
`.deliverable-inline-upload` vive anidada dentro de `DeliverableCard.vue` — un padre sólo estampa su
`data-v` en la **raíz** del hijo, nunca en un nieto.

Probado tres veces, no deducido:

1. El selector compilado es `.deliverable-inline-upload[data-v-d694e610] …`.
2. Clon en consola con y sin el atributo: **62 px en fila** frente a **28 px en columna**.
3. Sobre el elemento **real**, con la tarjeta en pantalla: sus atributos son exactamente `["class"]`,
   **ningún `data-v`**, y la superficie mide 76 px en columna.

Y una variante del mismo fallo: `:deep(.deasy-dropzone)` buscaba el dropzone como **descendiente** de
un ancla que era **el mismo elemento** (la raíz de `PdfDropField` **es** `.deasy-dropzone`).

### Lo que se descubrió al mover

- **`.custom-scrollbar` se usa en 22 sitios de 7 componentes**, pero estaba definida en **tres**
  `<style scoped>` con **tres pieles distintas**, y en los otros cuatro componentes **no hacía nada**.
  Un nombre, cuatro resultados según dónde mirases.
- **`BtnSera` llamaba a sus clases `.icon` y `.tooltip` a secas.** Dentro del scope da igual; en un
  módulo, `.icon` habría redimensionado iconos en **8 componentes**.
- Los cuatro nodos de Vue Flow: **163 líneas con sólo tres reglas propias**. `ProcessNode.vue` era
  copia **byte a byte** de `UnitNode.vue`, usando incluso sus clases `.unit-node__*`. Convivían porque
  cada `<style scoped>` lleva su propio `data-v`.
- Los cuatro chips de `BtnSera` mezclaban **un token en el texto con un color de Tailwind sin relación
  en el fondo**: turquesa sobre azul cielo, `#047857` sobre un fondo derivado de `#22c55e`.

### Una regresión propia, encontrada midiendo

Al reanclar el icono de las tarjetas de firma al dropzone, **las tres tarjetas que son lanzadores** —y
no tienen dropzone— se quedaron sin márgenes. La regla cuelga de la tarjeta, no del campo. Corregido y
vuelto a medir: **1 522 nodos, 0 diferencias**.

### Nota operativa

La pila B tenía los datos equivocados: alguien lanzó `test:char:run` contra ella, **que resetea la
base**, y sólo quedaban los fixtures de caracterización. `npm run seed:dev` la deja con dos procesos y
17 entregables para la persona 3 — existe exactamente para eso.

---

## Cierre del plan del 2026-08-09

**Las seis fases están ✅.** Y el plan queda **archivado, no continuado**: sus cuatro ficheros sujeto
(`theme.css`, `tailwind.css`, `AdminTableManager.css`, `frontend/.eslintrc.js`) **ya no existen**.

Tres de sus «F-pendientes» se cerraron por el camino sin que el documento se enterase: las
deformaciones del dropzone vía `:deep()` (hoy son variantes `--workspace` y `--rail` en `forms.css`),
los clones de Vue Flow y los dos drawers gemelos, y el bloque `local-dev`.

Siguen abiertos, y pasan al plan nuevo: la escala tipográfica, los `z-index` y la *utility soup*.

### Cifras acumuladas del frente

| Métrica | Al abrir | Hoy |
|---|---:|---:|
| Líneas de CSS | 3 997 | **~2 100** |
| Ficheros de CSS | 3 | **16 módulos** |
| Juegos de tokens | 2 | **1** |
| Hex en los `.css` | 74 | **0** |
| `rgba()` numéricos en los `.css` | 100 | **0** |
| `<style scoped>` | 13 | **0** |
| `!important` | 80 | **6** |
| Linters de estilo | 0 | **3** |
| dev ≠ prod | sí | **no** |

**La medición del 2026-08-11 abre la segunda vuelta**, con otro objeto: no el CSS, sino las 3 590
clases de Tailwind en las plantillas que ningún linter ve. Evidencia en
[`auditoria-2026-08-11.md`](../../../planes/sistema-diseno-plantillas/auditoria-2026-08-11.md), ejecutable en
[`plan-plantillas-2026-08.md`](../../../planes/sistema-diseno-plantillas/plan-plantillas-2026-08.md).
