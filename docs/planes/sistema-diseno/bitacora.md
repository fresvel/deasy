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
