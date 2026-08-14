# Bitácora — Sistema de diseño, tercera vuelta

> Se escribe **al ejecutar**, no antes. Cada entrada con lo que se midió, no con lo que se supuso.
>
> La de la segunda vuelta está en
> [`docs-md-antiguos/planes-cerrados-2026-08/sistema-diseno-plantillas/bitacora.md`](../../docs-md-antiguos/planes-cerrados-2026-08/sistema-diseno-plantillas/bitacora.md)
> y **sigue valiendo**: es donde están las trampas ya pagadas.

## Lo que la vuelta anterior dejó aprendido, y aquí se da por sabido

Cinco cosas que costaron caro y que valen para todo lo que queda:

1. **Un test que afirma sobre el valor no protege la regla.** Dos suites se rompieron con el
   comportamiento **intacto** por comprobar `toContain('slate')`. Se afirma el contrato, no el color.
2. **Un color en `hover:`/`focus:` no es el color del elemento.** Cinco botones acabaron convertidos
   en alertas porque `\b` no impide casar dentro de una variante con prefijo.
3. **El patrón a nivel de atributo cruza las comillas de un ternario.** Para un `:class` con
   expresión, el reemplazo va a nivel de **token**.
4. **`border-*` (color) y `border` (ancho) no son lo mismo.** Colapsar unas clases dejó 29 controles
   sin borde: el reset de Tailwind pone `border-width: 0` y nada lo repone.
5. **Vue renderiza al DOM los comentarios HTML de una plantilla.** Los comentarios de componente van
   en el `<script>`.

## Lo que hay que remedir antes de empezar

Las cifras del plan son del **2026-08-13** y el frontend se mueve. Antes de la fase A, remedir:

```bash
bash scripts/stack.sh b exec -T frontend pnpm run lint       # los cuatro gates dan el estado actual
rtk proxy wc -l frontend/src/modules/home/views/HomeView.vue frontend/src/modules/firmas/components/FirmarPdf.vue
```

⚠️ Y **capturar la línea base ANTES de tocar nada**: huella de `getComputedStyle` de las pantallas de
control y el CSS construido. Sin eso no hay A/B, y en una extracción el A/B es la única prueba.

---

## 2026-08-13 · La auditoría que reescribió el plan antes de ejecutarlo

El plan de esta vuelta se escribió **antes** de medir. Tres auditorías —duplicación, hueco frente a
TailAdmin, y deuda restante— encontraron que **el orden era incorrecto** y que faltaba la mitad.

### El hallazgo central: las extracciones no se propagaron

| Componente | Cobertura real |
|---|---|
| `.deasy-control` | **3 ficheros de 228 controles** |
| `AppAlert` | 14 usos y **60 `<div class="deasy-alert">` a mano** — el 81 % lo esquiva |
| `.deasy-eyebrow` | 87 de 173 · `.deasy-card` 49 de 143 · `.deasy-empty` 19 de 37 |

Y una anomalía dentro de la anomalía: **los 14 `<AppAlert>` no pasan `variant`**, así que los 14
renderizan `--danger`. El componente declara un validador de cuatro y solo se usa una.

### Y los gates no lo impidieron porque tienen agujeros

Los cuatro daban verde. Tres estaban rotos:

1. **`stylelint` no corre en CI.** `cd-multienv.yml:127` llama a `pnpm run lint`, que **no incluye
   `lint:css`**. Tres reglas escritas que **no bloquean ningún merge**.
2. **`check-orphan-classes` ignora 341 props `*-class`** — su regex excluye el `-` de `table-class`.
   Por ahí entraron 8 usos de `admin-data-table`, clase inexistente.
3. **`check-no-arbitrary` no abre los `.css`** — 51 valores arbitrarios más dentro de `@apply`, con
   **ocho radios distintos dentro del propio sistema de diseño**.

> **La lección, y es la que reordena el plan entero:**
> **Declarar una clase no es adoptarla, y un gate con un agujero es peor que no tenerlo: da verde.**
>
> Por eso los gates pasan a ser la **fase 0**. Propagar antes de cerrarlos es repetir lo que acaba de
> fallar.

⚠️ Y lo que más escuece del punto 2: **`frontend/CLAUDE.md` §2.12 ya avisaba** de que «la utilidad
puede llegar por PROP», y listaba `body-class`, `header-class`, `panel-class`. El gate se escribió
ignorando la norma que el propio repo tenía documentada. **Antes de escribir una puerta, leer lo que
el repo ya sabe de esa puerta.**

---

## Las cuatro trampas que se pagaron en la segunda vuelta

Ninguna la vio el build, ni el lint, ni los tests. Las cuatro salieron **midiendo**.

### 1 · Un color en `hover:` NO es el color del elemento

El script de bloques de estado exigía `bg-{fam}-N` **y** `border-{fam}-N`. Pero `\b` **no impide
casar dentro de una variante**: `hover:bg-rose-50` contiene `bg-rose-50`. Resultado: **cinco
elementos que solo tenían color en el hover se convirtieron en alertas** — dos botones de borrar, el
de «quitar firmante» y dos tarjetas del escritorio de firma.

Una clase de más es markup válido: no falla nada. Lo cazó **remedir antes de abrir el grupo
siguiente**.

**→ Un patrón de clases tiene que excluir explícitamente las variantes con prefijo.**

### 2 · El patrón a nivel de atributo cruza las comillas de un ternario

`class="([^"]*…)"` aplicado sobre un `:class="a ? 'x' : 'y'"` **se come una `'`**. Rompió dos
ficheros. Lo caza `vue/no-parsing-error`, pero solo después.

**→ Para un `:class` con expresión, el reemplazo va a nivel de TOKEN, no de atributo.**

### 3 · `border-*` (color) no es lo mismo que `border` (ancho)

Al colapsar las cuatro variantes del campo en `.deasy-control` se cayó el `border` **a secas**, y los
**29 controles del modal se quedaron con `border-top-width: 0px`**: sin borde. El reset de Tailwind
pone `border-width: 0` en todo y la regla de elemento solo declara el `border-color`, así que nada lo
repuso.

Parecen lo mismo al leer una cadena de clases. No lo son. **Lo cazó comparar la forma de los 29 en
el DOM**, no una puerta.

### 4 · Vue renderiza al DOM los comentarios HTML de una plantilla

Un comentario que documentaba `FontAwesomeIcon` estaba dentro del `<template>` y **se veía repetido
en el markup de cada icono** — cuatro veces solo en el modal de editar proceso.

**→ Los comentarios de componente van en el `<script>`.**

### Y una quinta, del instrumental

**Tailwind escanea también los `.mjs` de `scripts/`.** El primer `check-orphan-classes.mjs` citaba
tres utilidades de ejemplo **en un comentario en prosa** y las tres acabaron **emitidas en el CSS
construido**. Si documentas una clase, descríbela; no la escribas.

---

## Lo que hay que remedir antes de empezar

Las cifras del plan son del **2026-08-13** y el frontend se mueve.

```bash
bash scripts/stack.sh b exec -T frontend pnpm run lint    # los gates dan el estado actual
rtk proxy wc -l frontend/src/modules/home/views/HomeView.vue \
                frontend/src/modules/firmas/components/FirmarPdf.vue
```

⚠️ Y **capturar la línea base ANTES de tocar nada**: huella de `getComputedStyle` de las pantallas de
control y el CSS construido. Sin eso no hay A/B, y en una extracción el A/B es la única prueba.
