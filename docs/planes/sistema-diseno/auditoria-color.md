# Auditoría de los 74 hex restantes — 2026-08-09

Hecha con 12 agentes en paralelo sobre `refactor/sistema-diseno-css`. Todas las distancias son
**CIEDE2000**; todos los contrastes, **WCAG 2.1** con la fórmula validada contra los valores
canónicos (`#767676`/blanco = 4.54 pasa, `#777777` = 4.48 falla).

> **Conclusión en una frase:** los 74 no son una migración pendiente, son **el síntoma**. El
> problema real es que la paleta no cubre lo que la app necesita — y el contador que se está
> usando para medirlo ve el 41 % de la deuda.

---

## 1. El contador miente, y por dos vías

| Concepto | Nº |
|---|---:|
| Lo que reporta `lint:css` | **74** |
| Hex dentro de `@apply` que `color-no-hex` **no puede ver** | +10 |
| **Subtotal hex** | **84** |
| `rgb()`/`rgba()` con triplete numérico (color igual de duro) | +95 |
| **Color duro real** | **179** |

**Stylelint ve 74 de 179 = el 41 %.** Y el hueco no es teórico: `lint:css` puede llegar a **0
con 10 hex vivos en el árbol**, porque `color-no-hex` mira valores de declaración y no
parámetros de at-rule.

Los 10 invisibles, verificados: `forms.css:28,46` (`placeholder:text-[#8a93a8]`), `forms.css:62`
(`text-[#697081]`), `nav.css:7` (`text-[#5a5f6f]` + `hover:text-[#192144]`), `nav.css:138,142`
(`border-[#d6e4f2]`), `tags.css:36` (los tres del tag salmón).

### El punto ciego de `rgba()` es el más caro

100 tripletes numéricos frente a **12** que usan el token. Y el mecanismo correcto **ya existe
en el repo**: `--brand-primary-rgb: 94, 78, 255` está declarado, `buttons.css` lo usa bien…

| Color base | Veces | Alfas distintas | ¿Tiene token? |
|---|---:|---:|---|
| `rgba(255,255,255,…)` | 30 | **11** | no |
| `rgba(15,23,42,…)` | 15 | 6 | no |
| `rgba(94,78,255,…)` | **9** | 7 | **sí — `--brand-primary`, ignorado** |
| `rgba(148,163,184,…)` | 9 | 7 | no |
| `rgba(40,167,69,…)` | 4 | 4 | **sí — `--state-success`, ignorado** |

Once alfas distintas del mismo blanco. Nueve escrituras a mano de un color que ya tiene su
token y su triple RGB.

---

## 2. Seis de los 74 son código muerto — y tres **mienten**

Declaraciones que la cascada ya pisa (sin capa gana a `@layer components`):

| Declaración | Dice | Pinta de verdad |
|---|---|---|
| `buttons.css:279` `.hope-action-delete` | `#c03221` | `#b42318` (`overrides.css:200`) |
| `buttons.css:339` `.hope-action-delete-pdf` | `#f59e0b` (amber-500) | `#b45309` (amber-700) |
| `buttons.css:270` `.hope-action-delete-strong` | `#b42318` | idem, redundante |
| `tables.css:29`, `:52`, `:86` | grises de tabla | los de `overrides.css:118,123` |

**Tokenizarlas escribiría la mentira en la paleta y la convertiría en canon.** Se borran.

Y hay más código muerto alrededor, confirmado en navegador por el verificador adversarial
(`getElementsByClassName` en 13 vistas, incluidos modales):

| Clase | Veredicto |
|---|---|
| `.table-institutional` | **0 usos** — confirmado en fuente y en DOM |
| `.deasy-table-shell` / `-header` / `-title` | **0 usos** |
| `.profile-dialog-*` / `.profile-table-shell` | **0 usos** |
| `.admin-page-header__subtitle` / `__icon` | **0 consumidores** |
| `.table` (sedimento Bootstrap) | **0 usos** |
| `.admin-action-col` / `.admin-data-table` | **51 y 6 elementos en el DOM, y CERO reglas CSS** |

> ⚠️ **Dos matices que evitan un destrozo.**
> 1. **`auth.css:2-8` NO se borra entero.** Solo el `background-image` (líneas 4-7) está muerto;
>    el `@apply` de la línea 3 está vivo y aporta `min-height`, `padding`, tipografía y color.
>    Borrar el rango tumba el layout del login.
> 2. **Casi ninguna clase muerta tiene regla propia**: viven en **listas de selectores** junto a
>    clases vivas (`.bg-white, …, .table-institutional`). Es cirugía de listas, no borrado de
>    reglas — un `sed` por nombre de clase se lleva CSS vivo por delante.

---

## 3. Esto no es una migración hex→token

**La intersección entre los 59 valores hex distintos y los 17 tokens declarados es VACÍA.**
Ni uno solo de los 74 es un token reescrito a mano. `#192144` (7 usos) no es `--brand-navy`
(ΔE 8.67) ni `--brand-ink` (9.79). `#eef0f5` (5 usos) no es ningún gris declarado.

Llevar los 74 a token exige **inventar ~25-30 tokens nuevos**, es decir **diseñar paleta** — que
es justamente lo que las fases 1-6 se prohibieron hacer para poder prometer cambio visual cero.

---

## 4. La paleta actual ya está rota por dentro

De los 25 tokens, **6 no aportan color propio**:

| Token | Problema | ΔE |
|---|---|---:|
| `--brand-highlight` | **idéntico a `--brand-primary`** (`#5e4eff` los dos) | **0.00** |
| `--brand-highlight-rgb` | cadena literalmente idéntica a `--brand-primary-rgb` | — |
| `--brand-surface-alt` | vs `--brand-surface-muted` | **0.56** |
| `--brand-border-strong` | vs `--brand-border-field` | 2.03 |
| `--brand-surface-soft` | = `--brand-surface-muted` al 92 % | — |
| `--brand-gradient-soft` | sus dos paradas ya son otros tokens | — |

Los **tres** tokens de borde suman **4.13 ΔE de recorrido total**: tres nombres para un solo
escalón perceptual.

### El cluster central: 11 grises donde caben 4

`#f7f9fc` `#f8fafc` `#f7fafc` `#f8f9fc` `#f7fbfe` `#f5f7fb` `#f1f5f9` `#f3f7fb` `#f3f5fa`
`#f1f3f8` `#eef0f5` — **ΔE mutuo máximo 2.68**, haciendo **cuatro papeles distintos** (relleno
apagado / hover de fila / banda de cabecera / lienzo de página).

No es una escala: es una escala con todos los peldaños a la misma altura. Y explica por qué cada
autor nuevo inventa un gris: **ninguno de los existentes se distingue del siguiente**.

### Falta la mitad baja de la escala de texto

| hex | Contraste s/ blanco | Usos | Token |
|---|---:|---:|---|
| `#192144` | 15.64 | **7** | **ninguno** |
| `#5a5f6f` | 6.36 | 2 | **ninguno** |
| `#697081` | 4.96 | 2 | **ninguno** |
| `#64748b` | 4.76 | 1 | **ninguno** |
| `#8a93a8` | **3.08 — falla AA** | 2 | **ninguno** |

Los cuatro tokens de texto declarados cubren el rango L\* 8-28 (casi-negro) y **no hay nada entre
L\* 28 y el blanco**, que es donde vive todo el texto secundario. Por eso se escribe a mano cada
vez, y por eso tres autores eligieron tres valores a ΔE 2-6 entre sí.

**Suelo real de la escala: `#64748b` = 4.76:1.** `#8a93a8` (placeholder) **no cumple AA** y no
debe tokenizarse tal cual.

---

## 5. ΔE **no** predice el contraste — y eso invalida el criterio obvio

**Correlación Pearson ΔE ↔ Δratio de contraste = −0.206 (n=38).**

El corte intuitivo "ΔE ≤ 5 es seguro" no protege nada:

| Sustitución | ΔE | Contraste antes → después | Veredicto |
|---|---:|---:|---|
| `nav.css:22` badge activo → `--brand-border` | **5.24** | 4.55 → **4.19** | **rompe AA** |
| `dialogs.css:89` `#334155` → `--brand-text-body` | 4.98 | 10.35 → 9.91 | empeora |
| `buttons.css:215` `#5143dc` → `--brand-primary` | 6.07 | 6.11 → **4.85** | queda a 0.35 de AA |
| `overrides.css:185` `#047857` → `--state-success` | 20.07 | 5.00 → **2.85** | **rompe 1.4.11** |
| `buttons.css:273` `#218838` → `--state-success` | 10.38 | 3.97 → **2.75** | **rompe 1.4.11** |
| `admin.css:58` `#697081` → `--brand-text-body` | **16.31** | 4.96 → **9.91** | **mejora, la mayor** |
| `overrides.css:177` `#075985` → `--brand-text-body` | **16.97** | 6.80 → 8.91 | mejora |

El ΔE mínimo que rompe un umbral es **5.24**; el ΔE máximo que no hace daño es **16.97**.
Cualquier política basada en ΔE clasifica mal los dos extremos a la vez.

**El criterio correcto es uno solo: `contraste_después ≥ contraste_antes`, o al menos ≥ umbral
con margen.** El ΔE sirve para saber si se nota, no para saber si es seguro.

### Efecto colateral no declarado del commit «dev = prod»

Quitar el gate `html[data-environment="local-dev"]` **arregló 3 de los 4 fallos de WCAG 1.4.11**
que producción tenía en la familia `.hope-action-*` (la piel de dev es opaca y legible; la de
producción era `rgba()` compuesta, con `.hope-action-delete-pdf` a **1.99:1**).

Fue una mejora real de accesibilidad hecha sin querer. Queda **un fallo vivo**:
`.hope-action-delete-pdf:hover` a **2.90:1**, porque el `:hover` de `buttons.css` (0,2,0) gana a
`overrides.css` (0,1,0).

### Las 33 `css:S7924` no son el mapa del problema

SonarQube lleva 25 h caído, así que no se pudo reconciliar. Pero el barrido de parejas
`color`+`background` con hex literal en la misma regla — lo único que `S7924` puede ver sin
resolver cascada — da **3 fallos, no 33**. Sonar no resuelve `var()`, no compone `rgba()` sobre
el ancestro, no aplica cascada entre ficheros y no conoce el umbral 3:1 de 1.4.11.

**Cerrar las 33 no arregla `delete-pdf` a 1.99:1, y arreglar `delete-pdf` no baja el contador.**

---

## 6. Lo que sí es un sistema: `.hope-action-*`

18 de los 74 no son colores sueltos. Son una **matriz 6 matices × 3 papeles** ya existente, sin
nombre:

| Acción | tint (fondo, L≈95) | line (borde, L≈75) | ink (texto, L≈35) | contraste |
|---|---|---|---|---:|
| neutro | `#f7fbfe` | `#b8cadc` | `#23384f` | 11.53 |
| ver | `#e8f5fb` | `#8ec6df` | `#075985` | 6.80 |
| editar/asignar | `#e9f8ef` | `#8ed6b2` | `#047857` | 5.00 |
| subir/descargar | `#eef3ff` | `#aabef4` | `#3751a3` | 6.59 |
| borrar | `#fff0ed` | `#f3aaa0` | `#b42318` | 5.93 |
| borrar PDF | `#fff6e5` | `#f4c26f` | `#b45309` | 4.68 |

Tres de los seis `ink` **son literalmente tokens de Tailwind** (emerald-700, amber-700, sky-800).
Las seis pasan 3:1 y también 4.5:1.

**No se puede derivar con `color-mix()`**: el `tint` sí se reproduce mezclando el `ink` con
blanco (ΔE 1.0-3.6), pero el `line` real es mucho más cromático que cualquier mezcla (ΔE hasta
27.2 en ámbar). Es una escala declarada de 3 pasos, no una función de un ancla.

**El hover rompe la estructura** y viene del fichero equivocado: `version`/`download`/`upload`
comparten base y divergen a **tres hovers en tres matices distintos**. `delete:hover` está a
ΔE 1.08 de su base — **el hover no se ve**.

---

## 7. Fuera de los 74: lo que nadie estaba contando

**123 ocurrencias de hex en `.vue`/`.js`** (47 valores únicos), que `lint:css` no mira porque su
glob es `src/**/*.css`. El 62 % vive en `<style scoped>` — CSS puro, fuera del linter solo por
la extensión del fichero.

- **De los 82 hex de Vue Flow, solo 11 son colores de grafo.** Los otros 63 son chrome de UI
  (slate/indigo de Tailwind a mano) sin razón de estar fuera de los tokens.
- **`ProcessNode.vue` es copia textual al 100 % de `UnitNode.vue`** — mismos selectores literales
  (`.unit-node__btn` dentro de `ProcessNode`). 31 de 39 ocurrencias son 7 valores escritos 4
  veces. **El arreglo es extraer una clase, no tokenizar cuatro veces.**
- **`EDGE_PALETTE` necesita rediseño como paleta categórica**, no tokenización: ΔE mínimo 7.2
  entre miembros (dos aristas indistinguibles) y 5 de 7 por debajo de 3:1.
- **El salmón está duplicado a los dos lados del linter**: `.deasy-tag--salmon` (`tags.css:36`,
  «pendiente de firma») y `homeView.helpers.js:111,128` pintan **el mismo estado** con dos
  paletas a ΔE 1-2.

---

## 8. El instrumento no está en el repositorio

`grep -rl getComputedStyle` sobre el árbol devuelve `modalController.js` y **un comentario**.

**La huella de estilos computados — lo único que detectó las cuatro regresiones de esta sesión —
no se ha commiteado.** Todos los scripts sí (`css-prune`, `css-radios`, `css-hex-a-token`,
`css-modularizar`); el instrumento de verificación, no. Es la deuda más cara de la sesión: el
método está escrito en prosa en la bitácora y la herramienta se pierde con el contexto.

Y necesita dos guardas que esta sesión ya pagó:
- abortar si el nº de nodos es absurdamente bajo (la base de `/home/documentos` salió con 4 nodos);
- abortar si `document.fonts.size === 0` (la regresión de la tipografía: todos los estilos
  computados idénticos y un `<h1>` 14 px más estrecho).

### El script de migración tiene un fallo vivo, verificado

`css-hex-a-token.mjs` **sigue reescribiendo comentarios**. Ejecutado sobre una copia de
`tokens.css` convierte la prosa de la cabecera en `bg-[var(--brand-navy-deep)]`. El post-check no
lo caza porque **quita los comentarios antes de validar**. Es el mismo accidente de la fase 4, no
corregido.

Y el detector de autorreferencia es más estrecho que la guarda: caza `--x: var(--x)` adyacente,
pero **no el ciclo de dos saltos** (`--a: var(--b)` con `--b: var(--a)`), que es exactamente el
resultado de aliasar dos navies «casi iguales» en vez de elegir uno.

---

## 9. Cobertura de verificación: falta el 25 %

| Estado | Hex | ¿Lo ve la huella actual? |
|---|---:|---|
| Base | 62 | Sí, si la vista está capturada |
| **`:hover`** | **21** | **No** |
| `@media (min-width:1280px)` | 1 | Solo a ese ancho |
| `placeholder:` | 2 | Solo con `getComputedStyle(el,'::placeholder')` |

**El 25 % de los hex vive en `:hover` y la huella no puede verlos.** Y el peor caso es el más
enredado: en `.hope-action-*` la base la gana `overrides.css`, el `color` del hover lo gana
`buttons.css` (0,2,0) y el `border-color` del hover lo gana `overrides.css:209`. **Un solo hover
se pinta con dos ficheros y dos familias de color.**

Escenarios que faltan, por riesgo: hover de `.hope-action-*` · tabla en responsive a 1024 px ·
hover de fila y de cerrar-diálogo · modal de perfil y del wizard de procesos · pestañas inline ·
flyout a ≥1280 px · `::placeholder` · tag salmón · `/register` y `/setup`.

---

## 10. Recomendación

**Lo que NO hay que hacer**, por orden de tentación:

1. **Tokenizar las 6 declaraciones muertas.** Crea tokens que no pintan y canoniza tres mentiras.
2. **Fusionar `#192144` / `--brand-navy` / `--brand-ink` «porque son el mismo azul».** Son tres, y
   uno tiene el doble de saturación. Es diseño, con su commit y su diff ≠ 0.
3. **Mapear los hex a la paleta de Tailwind «porque es lo mismo».** Tailwind v4 define en OKLCH:
   convertido a sRGB, `red-800` se desvía 20 por canal. Ninguno es cambio nulo.
4. **Cerrar `lint:css` a 0 y dar la fase por terminada.** Quedarían 10 hex y 100 `rgba()` vivos.
   Un gate verde con eso dentro es peor que no tener gate.
5. **Declarar los tokens nuevos en el módulo que los usa.** Un `:root` en `overrides.css`
   (importado el último) gana al de `tokens.css` en toda la app, en silencio.
6. **Resucitar las 15 reglas de intención perdida de `AdminTableManager.css`.** Están en la misma
   zona y la tentación es real. Cambia el aspecto: otro frente.

**El orden que sí rinde:**

| # | Commit | Hex | Valor |
|---|---|---:|---|
| C0 | Commitear la huella + sus dos guardas | 0 | **El más alto.** Sin esto nada es verificable |
| C1 | Borrar las 6 declaraciones muertas | −6 | Corrige tres mentiras del código |
| C2 | Arreglar `css-hex-a-token` (comentarios + ciclos) | 0 | Evita repetir un fallo ya cometido dos veces |
| C3 | Declarar `.hope-action-*` como escala de 18 tokens | −18 | La única familia que **es** un sistema |
| C4 | Un token por gris repetido (`#192144`×7, `#eef0f5`×5, `#0f172a`×4) | −13 | Duplicación real |
| C5 | Los 10 hex de `@apply` | −10 | Los que el linter **nunca** vigilará |
| — | **Los ~15 de un solo uso** | — | **Punto de rendimientos decrecientes** |

**Dónde parar:** los ~15 hex de un solo uso no son un sistema. Darles token no reduce
duplicación (no hay), no facilita un cambio de marca, y convierte `tokens.css` en un vertedero de
nombres que nadie reutiliza. La bitácora ya sentó el precedente correcto con `#7a869a`.

Lo honesto es **cambiar la meta**: de «0 incidencias de `color-no-hex`» a **«0 hex repetidos»**,
que es la métrica que de verdad mide duplicación.

**Y lo que rinde más que C6, y no está en los 74:** cerrar los **100 `rgba()` numéricos** sobre
los tokens `*-rgb` que ya existen. Son más que los hex, codifican los mismos colores, no los ve
ningún linter, y son la vía por la que la paleta se desincronizará en cuanto alguien cambie
`--state-success` y los cuatro `rgba(40,167,69,…)` se queden atrás.
