# Plan de ejecución — Sistema de diseño, segunda vuelta

**Base:** `develop` tras cerrar [`plan-2026-08-09.md`](../../docs-md-antiguos/planes-cerrados-2026-08/sistema-diseno/plan-2026-08-09.md) (✅ sus 6 fases)
**Evidencia:** [`auditoria-2026-08-11.md`](./auditoria-2026-08-11.md) · **Bitácora:** [`bitacora.md`](./bitacora.md)
**Reglas del sistema:** [`frontend/CLAUDE.md`](../../../frontend/CLAUDE.md)

---

> # ⚠️ ESTADO A 2026-08-12 — LEE ESTO ANTES QUE EL PLAN
>
> El plan de abajo se escribió el 2026-08-11 y **describe una paleta que ya no existe**. Sigue
> valiendo como mapa de lo que falta, pero **traduce mientras lees**:
>
> | El plan escribe | Hoy se llama |
> |---|---|
> | `--brand-primary` · `bg-brand-primary` | `--color-primary` · `bg-primary` |
> | `--brand-border` · `border-brand-border` | `--color-line` · `border-line` |
> | `--brand-text-muted` | `--color-muted` |
> | `--brand-text-body` · `--brand-text-strong` | `--color-body` · `--color-strong` |
> | `--brand-surface-muted` (y `-alt`, colapsado) | `--color-surface` |
> | `--state-success` · `--state-danger` · … | `--color-success` · `--color-danger` · … |
> | `--brand-elev-*` · `--brand-white` | `--elev-*` · **no existe** (se usa el `white` de Tailwind) |
> | «33 registros en `@theme`» | **22**, con **una sola declaración** cada uno |
>
> **Estado real de las fases:**
>
> | | |
> |---|---|
> | F1 · F2 · F4.1 · F4.3 · F4.4 | ✅ cerradas |
> | **F5** | ✅ **cerrada el 2026-08-12** — 24 clases muertas borradas (`8887012`) y los contadores de `CLAUDE.md` corregidos (`c40555e`). Lo que la sección de abajo lista como pendiente **ya está hecho** |
> | F3 · F4.5 | ⬜ pendientes, **mecánicas**: 74 colores a mano + 151 dentro de `@apply` |
> | F4.2 · F6 | ⬜ pendientes, y **NO son refactor: son decisión de diseño** |
>
> ## Y una premisa del plan que se cayó: **TailAdmin está descartado** (2026-08-12)
>
> F4.2 y F6 daban por hecho que el aspecto del foco, la tipografía y las escalas se decidirían
> **copiando las recetas de TailAdmin**. Eso ya no va a pasar. No las bloquea el análisis: las bloquea
> una decisión que hay que tomar mirando la pantalla.
>
> **Lo hecho el 2026-08-12 no está en las fases de abajo** porque no salió del plan, sino de tirar de
> un hilo: si `--color-` ya es el namespace de Tailwind, el `brand-` sobra. Está todo en la bitácora,
> con el criterio nuevo que gobierna la paleta a partir de ahora:
>
> > **Un token propio se justifica con DOS condiciones, y hacen falta las dos:** que Tailwind no traiga
> > ya ese color (ΔE ≤ 2 medido contra su OKLCH real, no contra los hex de v3), y que **el concepto
> > pueda cambiar de color**. Si el concepto ES el color, usa el de Tailwind.

---

## Por qué hace falta un plan nuevo y no una fase más

El plan del 2026-08-09 **está cerrado**: sus seis fases se ejecutaron y están verificadas. Pero además
está **obsoleto**, y eso importa más: sus cuatro ficheros sujeto — `theme.css`, `tailwind.css`,
`AdminTableManager.css` y `frontend/.eslintrc.js` — **ya no existen**. Un plan cuyo objeto desapareció
no se actualiza: se archiva.

Y lo que encontró la medición del 2026-08-11 **no es la continuación de aquello**. Es otro problema:

> El plan viejo perseguía **CSS**: ficheros gordos, tokens duplicados, hex sueltos. Ese frente está
> ganado — 3 997 → ~2 100 líneas, un solo juego de tokens, cero literales de color en los `.css`, cero
> `<style scoped>`.
>
> Lo que queda **no vive en el CSS**. Son 3 590 clases de Tailwind en las plantillas que ningún linter
> ve, y un puñado de reglas que existen y no aplican.

## El argumento de una frase

**Primero dar a dónde ir, luego pedir que se vaya.** Hoy no existen `bg-state-warning` ni
`text-brand-text-muted`: pedir que se dejen de usar `amber-*` y `slate-400` sin registrarlos antes en
`@theme` es pedir lo imposible. Por eso la fase que desbloquea va **antes** que la que migra.

## La regla que gobierna el plan

La misma del anterior, y por el mismo motivo:

> **Cambio visual cero, salvo donde se declare lo contrario.** Las fases F1, F3, F4 y F5 no deben
> mover un píxel; si algo se mueve, la regla que toqué **sí se aplicaba** y el análisis estaba mal.
> F2 y F6 sí cambian aspecto, y por eso llevan decisión explícita antes de ejecutarse.

La verificación es la **huella de estilos computados** (`getComputedStyle` de 34 propiedades +
`getBoundingClientRect` por nodo, comparada antes/después), no el lint ni los tests. Está demostrado
seis veces en este repo que build, lint y los 304 tests pasan en verde con la interfaz rota.

---

## Orden, y por qué es este

```
F1 los 5 bugs ─── F2 completar @theme ─┬─ F3 los 40 literales invisibles
   (visible,        (DESBLOQUEA)       │
    barato)                            └─ F4 barrido familia por familia ── F5 borrar lo muerto
                                                   (el grande)              (+ corregir la doc)
                                                                                    │
                                                                        F6 escalas ─┘
                                                                     (tipografía, z-index)
```

- **F1 va primero** porque son fallos visibles, pequeños e independientes. Uno de ellos arregla de
  paso el peor incumplimiento de contraste del sistema.
- **F2 antes que F3 y F4** porque es la condición de posibilidad de las dos.
- **F5 después de F4** porque parte del CSS muerto sólo se puede confirmar con las plantillas ya
  migradas.
- **F6 al final** porque pide decisiones de diseño (¿cuántos escalones de tipografía? ¿qué bandas de
  apilamiento?) y no bloquea a nadie.

---

## Fase 1 · Los cinco bugs — ✅ CERRADA (2026-08-11)

Riesgo bajo, efecto visible, cero dependencias. **Ninguno es deuda estética: son cosas rotas.**

> **Cerrada** en `develop-frontend`, commits `6546791` y `291e621`. Salieron **ocho**, no siete: se
> añadió **F1.8** a petición del usuario. Lo que la ejecución corrigió del plan está marcado en la
> tabla; el detalle y lo descartado, en la [bitácora](./bitacora.md#sesión-2026-08-11--f1-y-f2).

| # | Qué | Dónde | Nota |
|---|---|---|---|
| 1.1 | **El borde de los controles.** Sacar la regla `input, select, textarea` de `overrides.css:90-103` de su limbo sin capa, o convertirla en la que declare el token correcto. Hoy gana a `.deasy-filter-control` por precedencia de capa y **mata `--brand-border-field` y `--brand-border-strong`** | `overrides.css:90-103`, `forms.css` | Afecta a **228 controles**. Ojo: los tres tokens fallan 1.4.11 (1.25 / 1.35 / 1.46), así que arreglar la cascada **no basta** — hay que subir el valor. Pero mientras el mecanismo esté en pie, subirlo no serviría de nada |
| 1.2 | **Crear `.deasy-nav-item__icon--indigo`** o cambiar el tono de «Mis envíos» | `nav.css`, `HomeSidebar.vue:74` | Medido: fondo `rgba(0,0,0,0)` frente a `rgba(255,255,255,0.04)` en sus seis hermanos |
| 1.3 | **Crear `hope-action-launch` y `hope-action-retire`**, o remapearlas a una variante existente | `buttons.css`, `AdminMainTableSection.vue:256,268,280` | 2 de 12 variantes sin regla |
| 1.4 | **Ordenar `z-index` entre aviso y modal.** Hoy `SNotify` (`z-50`) queda debajo del velo (`1075`) | `SNotify.vue`, `dialogs.css` | Se resuelve del todo en F6.2; aquí sólo lo urgente |
| 1.5 | **Desempatar el `1075`.** Está escrito en `AppDialogOverlay.vue:7` y en `.deasy-drawer-overlay`; modal y panel lateral quedan iguales y decide el DOM | idem | idem |
| 1.6 | **`AppButton` con `variant` desconocida** estampa la clase literal | `AppButton.vue:92` | ⚠️ **El plan se equivocaba en las dos mitades.** `compact` (`AdminDraftArtifactModal.vue:187-199`) **NO es un bug**: es una variante legítima de `PdfDropField.vue:111`. Y `plain` era **peor** de lo descrito — sí está en `variantClassMap`, mapeado a `""`, que es *falsy*, así que el `\|\|` caía al literal igual. **16 usos** |
| 1.7 | **`.graph-node__btn--accent` a 2.70:1** en las variantes `--config` y `--template` | `graph.css:179` | **Introducido el 2026-08-11 por esta misma línea de trabajo.** Blanco sobre un acento aclarado, y es la acción principal del nodo |
| **1.8** | **Dar nombre a la tarjeta de entregable** (`deliverables.css`) | `DeliverableCard.vue`, `useDeliverableView.js` | **Añadido por el usuario** al aprobar el plan, como alternativa a subir el borde global: da un sitio donde declarar un borde que cumpla **sólo** en estos componentes. Tres strings de ~300 caracteres → `.deasy-deliverable-action(--start\|--sign\|--open)` |

**Criterio de cierre:** los siete verificados en navegador; huella de `/home`, `/admin` y
`/admin/gestiones/procesos/mapa` sin más diferencias que las siete previstas.

✅ **Cumplido.** `/home` A-vs-B: 954 nodos, **15 diferencias**, todas atribuibles (9 bordes de filtro,
4 del icono indigo, 2 de `z-index`). `/login`: 75 nodos, **2 diferencias**, los campos de auth.
La base fue la **pila A viva**, no una captura previa.

⚠️ **F1.1 tomó la SEGUNDA salida** de las dos que ofrecía el plan («convertirla en la que declare el
token correcto»), no la primera. Bajarla a `@layer base` resucita **90 declaraciones hoy muertas** —
29 `border-slate-300` y los **61 bordes de foco** de los campos —, que es la decisión de F4.2 y no un
efecto colateral. Y **no** se subió el valor a 3:1: decisión del usuario, va con su propia huella.

---

## Fase 2 · Completar `@theme` y crear los tokens que faltan — ✅ CERRADA (2026-08-11)

**Es la fase que desbloquea el plan entero.** Hoy `@theme` registra 16 nombres de los que **9 no
llegan al CSS construido**, y deja fuera los que más se usan.

> **Cerrada** en `develop-frontend`, commit `d0bdc5e`. `@theme` pasa de 16 registros a 33 y de **7
> vivos a 11** en el CSS construido; los `X-[var(--token)]` por falta de registro bajan de 14 a **0**
> (los 5 que quedan son `shadow-[var(--brand-elev-*)]`, que no son colores y no tienen namespace).
> **Cambio visual cero**, verificado con huella. Ver la [bitácora](./bitacora.md#sesión-2026-08-11--f1-y-f2).

### 2.1 Registrar lo que ya existe

| Token | Por qué | Evidencia |
|---|---|---|
| `--brand-text-muted` | 14 usos por `var()` **+ 6 por valor arbitrario** = 20. Es el destino de ~500 `text-slate-400/500` | Más usos que `--brand-border-strong`, que sí está |
| `--state-warning` | Destino de 164 `amber-*`/`orange-*` | — |
| `--state-pending` | Hoy se escribe `text-[var(--state-pending)]` en `tags.css:36` | — |
| `--brand-icon` | — | — |
| `--action-view`, `--action-upload`, `--action-neutral` | — | — |

~~Y **retirar los 9 registros muertos**~~ (`--color-brand-accent`, `-navy`, `-ink`, `-white`,
`-border-strong`, `-surface-muted`, `--color-state-success`, `-danger`, `-gold`).

> ⚠️ **NO SE HIZO, y a propósito.** Al ejecutarlo se vio que **las dos mitades de §2.1 se
> contradicen**: `--color-state-success` es el **destino** de los 237 `emerald`/`green` que migra F4,
> y `--color-brand-white` el de los 290 `white`. El argumento a favor de retirarlos —«declaran una API
> que nadie llama»— es cierto sólo *hasta* F4, que es la fase siguiente; y como Tailwind los poda,
> **cuestan cero bytes**. Retirarlos es quitar la diana justo antes de disparar y volver a ponerla.
> Quedan, y quedan documentados en `tokens.css` como lo que son: la API completa de destinos, no un
> inventario de lo ya usado. Revertible en una línea si se prefiere lo contrario.

> **Comprobación obligatoria:** Tailwind v4 hace *tree-shaking* de `@theme`. Un registro que nadie usa
> **no se emite**, así que el `grep` sobre el CSS construido es la única prueba de que un registro
> está vivo. Verificar en `frontend/dist/assets/*.css`, no en el fuente.

### 2.2 Los `--shadow-*` — ✅ decisión tomada: **renombrar**

`--shadow-raised/-modal/-drawer` **ocupaban el namespace `--shadow-*` de Tailwind y no estaban en
`@theme`**: ni generaban `shadow-raised` ni evitaban una colisión futura. Había dos salidas:

- ~~**Registrarlos** en `@theme`~~ → deja el problema de namespace en pie.
- ✅ **Renombrarlos** fuera del namespace → **elegida por el usuario**. Arregla además que un
  `grep '--shadow-'` no encontrara el primer nivel y un `grep '--brand-'` no encontrara los otros dos:
  eran **cinco tokens de `box-shadow` en tres convenciones de nombre**.

| Antes | Ahora |
|---|---|
| `--brand-shadow` | `--brand-elev-1` |
| `--shadow-raised` | `--brand-elev-2` |
| `--shadow-modal` | `--brand-elev-3` |
| `--shadow-drawer` | `--brand-elev-3-left` |
| `--focus-ring` | *sin cambio* — no es un escalón de elevación, es un indicador de estado |

### 2.3 Retirar las dos colisiones de namespace **activas**

`--font-weight-medium: 500` y `--font-weight-semibold: 600` (`tokens.css:212-213`, `:root` **sin
capa**) pisan los de Tailwind. Probado en el CSS construido:

```
.font-medium{--tw-font-weight:var(--font-weight-medium);font-weight:var(--font-weight-medium)}
```

Es **el mecanismo exacto de `--radius-lg`**. Tres usos en total (`base.css:29,54`, `dialogs.css:135`),
a cambio de que cambiar uno repinte **cada `font-medium` de la app**. Se sustituyen por las utilidades
`font-medium`/`font-semibold` y se borran.

### 2.4 Crear los tokens que faltan

| Token nuevo | Resuelve | Nota |
|---|---:|---|
| **La tinta de sombra** (`#0f172a`) | **31 ocurrencias** | Vive dentro de 5 tokens compuestos y **no existe plano**, que es por lo que nadie puede referirlo desde una plantilla |
| **`--state-current`** (la menta `#4BF1A1`) | 13 | **No se puede derivar**: el mejor `color-mix` toca fondo en ΔE 19.75 y la curva es plana. Significa «te toca a ti», distinto de «hecho» |
| **`--state-info`** | parte de los 629 de sky/blue | Hoy no hay token para «informativo» |
| **Una escala categórica** `--chart-1…7` | 7 | Con separación mínima objetivo y anclada en `--brand-primary`. **No es un token por arista** |

> **`--state-current` es el único punto donde tokenizar arregla una violación.** Hoy la menta como
> borde da **1.46:1** y su texto acompañante `#118a57` da **4.38:1** — ninguno cumple. ~~Al elegir el
> valor del token, elegirlo **para que cumpla**, no para reproducir el actual.~~
>
> ⚠️ **Eso se contradice con el motivo de existir del token, y se vio al medirlo.** Para que la menta
> llegue a 3:1 hay que bajarla al 69.8 % sobre negro (`#34a870`), y ahí su **ΔE contra
> `--state-success` cae de 34.96 a 17.51**: se arregla el contraste a costa de la distinción
> «te toca» ≠ «hecho», que es lo que §2.3 de `frontend/CLAUDE.md` avisa de no hacer.
>
> **Salida tomada:** la menta cambia de **papel**, no de color. Su fallo venía de usarse como
> *límite de componente* (3:1), no de ser clara; un tinte de fondo al 10 % no tiene mínimo. Relleno
> `--state-current` `#4bf1a1`; borde y texto `--state-current-ink` `#108353` (**4.78:1**, vale para
> los dos). La distinción se conserva entera —ΔE 34.96— porque vive en el relleno.

### 2.5 Y de paso, corregir la paleta

| Qué | Dónde |
|---|---|
| Los comentarios mandan **6 veces** a `theme.css` y `tailwind.css`, que no existen | `tokens.css:37,68,69,80,84,117-118` |
| Las líneas 39-42 dicen «este repo no declara `@custom-variant dark`» y **la línea 24 es esa declaración** | `tokens.css:24` vs `:39-42` |
| Los contrastes anotados están subestimados en 3 de 4 (`success` 5.49 no 5.00; `danger` 6.57 no 5.93; `warning` 5.02 no 4.68) | comentarios de `tokens.css` |
| `--brand-navy-menu` sólido: **0 usos** (sólo vive su `-rgb`). `--brand-accent-rgb`: **0 usos** | `tokens.css` |

**Criterio de cierre:** `@theme` verificado **contra el CSS construido**; cero `X-[var(--token)]` por
falta de registro; los `--font-weight-*` fuera; cambio visual cero.

---

## Fase 3 · Los 40 literales de sustitución invisible

Con el token de sombra ya creado en F2, esta fase es casi mecánica: **ΔE ≤ 2 contra un token
existente**, o sea demostrablemente invisible.

| Bloque | Ocurrencias | Qué |
|---|---:|---|
| Tinta de sombra `#0f172a` con 8 alfas | **31** | Incluye `rgba(7,18,38,.24)` (ΔE 1.77) y `rgba(11,31,63,.06)` (ΔE 1.09) |
| Blancos y `--brand-navy-menu` | 5 | ΔE 0.00 |
| `#cbd5e1` → `--brand-border-strong` | 2 | ΔE 1.97 |
| `#2563eb` → tinta de `--brand-info-soft` | 2 | ΔE 0.00 |

**Caso de cabecera:** `WorkspaceChatLauncher.vue:21` contiene
`shadow-[0_1px_2px_rgba(15,23,42,0.04),0_24px_64px_rgba(15,23,42,0.16)]`, que es **`--shadow-modal`
reescrito byte por byte**. Sustituirlo por el token es cambio cero literal.

Y en el mismo barrido, las **21 sombras arbitrarias frente a una escala de tres**: 13 geometrías
distintas, cinco de ellas la misma sombra con la opacidad movida entre `.04` y `.07`.

> ⚠️ **Los dos anillos de foco competidores** (`AppCounterNavigator.vue:23` a 3 px azul cielo y
> `AppLogo.vue:64` con `ring-2` y la tinta de `--brand-navy-menu` exacta) **no** entran aquí:
> unificarlos con `--focus-ring` cambia el aspecto. Van a F4 con los otros 116.

**Criterio de cierre:** los 40 fuera; huella sin diferencias en `/home`, `/perfil`, `/home/firmas`.

---

## Fase 4 · El barrido, familia por familia

**3 590 apariciones. Es trabajo de varias sesiones y se hace por familias, no por ficheros.**

### 4.1 Empezar por las siete que son ΔE 0.00 — ✅ HECHA (2026-08-11), con dos correcciones

⚠️ **No son ΔE 0.00.** La auditoría comparó los tokens contra los hex **heredados de Tailwind v3**;
el repo corre **v4.2, que sirve su paleta en OKLCH** y no vuelve a esos hex. Medido en el DOM contra
lo que renderiza, y **es lo que hay que comparar**:

| Migración | Usos | ΔE real | Contraste |
|---|---:|---:|---|
| `text-slate-600` → `text-brand-icon` | 116 | **1.17** | 7.58 → 7.58 |
| `text-emerald-700` → `text-state-success` | 44 (+4) | **1.28** | 5.36 → 5.48 |
| `text-amber-700` → `text-state-warning` | 20 | **2.29** | 5.03 → 5.02 |
| `text-sky-800` → `text-action-view` | 13 | **1.04** | 7.51 → 7.56 |

Dentro de la banda «demostrablemente invisible» del plan (ΔE ≤ 2) salvo amber, que roza; el contraste
se mantiene o mejora en las cuatro. Pero la promesa correcta es «imperceptible, medido», no «cero por
construcción».

⚠️ **`bg-slate-50` → `--brand-surface-alt` se REVIERTE, y su destino no era ése.** `overrides.css`
ya lo repinta a `--brand-surface-muted`, así que renderiza `#f7f9fc` y no `#f8fafc`: la tabla original
comparaba *fuente contra token* en vez de *renderizado contra token*. Y aun con el token correcto no
vale, porque **el repintado lleva `!important`** y esa prioridad es la que le gana a
`.deasy-dialog-body` y a `input`, que fijan blanco sin capa. Migrados, dos nodos cayeron a blanco.
`bg-slate-50` no significaba «slate-50», significaba «slate-50 **con prioridad**». Los 109 sitios
pasan a **§4.4**, que es donde se desenreda el repintado.

`gray-900` y `gray-800` tienen **0 usos**: el gris del proyecto es slate y sólo slate.

### 4.2 Resolver los cuatro conceptos con familias en disputa

| Concepto | Familias hoy | Apariciones |
|---|---|---:|
| info / foco / primario | sky + blue + indigo (+1 violet) | **629** |
| error | rose + red | 303 |
| éxito | emerald + green | 237 |
| aviso | amber + orange | 164 |

Y los dos casos donde la incoherencia **se ve**:

- **El estado `retired`, pintado de cuatro colores en cinco ficheros** (ámbar claro, ámbar fuerte,
  slate y rose). `draft`, de dos.
- **El foco: 116 utilidades en 5 familias** contra el `--focus-ring` único que `frontend/CLAUDE.md`
  §5.3 da por resuelto. 59 son `focus:border-indigo-400`.

  > ⚠️ **Y ninguna pinta.** Medido al ejecutar F1.1: la regla sin capa de `overrides.css` gana a
  > `@layer utilities`, así que **las 117 declaraciones de foco sobre campos están MUERTAS**
  > (61 indigo · 37 sky · 15 blue · 4 sueltas). El anillo sí funciona —`--focus-ring` es un
  > `box-shadow` que nadie disputa—; lo muerto es el `border-color` del campo enfocado.
  >
  > Eso cambia la naturaleza de §4.2: no es «unificar cinco familias», es **decidir cómo se ve el
  > foco y encenderlo**. Encenderlo *es* el cambio visible, y por eso F1.1 lo dejó como estaba.

### 4.3 El fallo de accesibilidad de volumen — ✅ HECHA (2026-08-11)

**`text-slate-400` = 2.63:1, 202 usos en 42 ficheros**, y es el placeholder de `.deasy-field-input` y
`.deasy-auth-field`. El token equivalente da 6.36:1. Esto contradice literalmente la regla escrita en
§3 («el suelo es `--brand-text-muted`»).

> **206 sustituciones**, y **0 de los 208 usos iban sobre fondo oscuro** — comprobado antes de tocar,
> porque sobre la barra lateral el cambio habría dejado el texto casi invisible. Es el único cambio
> visible del commit `f0fa366`: el texto secundario se oscurece en toda la app.

### 4.4 Cerrar la fuga de `overrides.css`

El repintado cubre **834 apariciones (23,3 %)** pero es una **lista blanca de opacidades escrita a
mano**, y **85 se le escapan** (`bg-slate-50/50` ×35, `border-slate-200/80` ×18, `bg-slate-50/60` ×14…).
Esas pintan el gris de Tailwind **junto a hermanas repintadas dentro del mismo componente**.

Dos salidas: ampliar la lista (frágil, volverá a pasar) o **eliminar la necesidad** migrando esas
utilidades a tokens. La segunda es la que cierra el problema.

> ⚠️ **Y aquí cae `bg-slate-50` (109 usos), que venía de §4.1.** Migrarlo a un token falla porque el
> repintado lleva **`!important`**: `bg-slate-50` no significa «slate-50», significa «slate-50 **con
> prioridad**», y esa prioridad es la que le gana a `.deasy-dialog-body` y a `input`, que fijan blanco
> **sin capa**.
>
> Y una nota de método, pagada: **el script de migración reescribió los propios selectores del
> repintado** (`.bg-slate-50\/70` → `.bg-brand-surface-muted\/70`) y lo rompió en silencio. El escape
> del `/` burla el límite por la derecha. `shared/styles/*.css` se excluye o se revisa a mano.

---

#### 🔑 LA DECISIÓN SOBRE LAS REGLAS SIN CAPA — tomada el 2026-08-11

Lo que bloqueaba §4.4 no era la lista blanca: era que **`overrides.css` hace dos cosas mezcladas en
la misma lista de selectores**.

| | Qué es | Ejemplos |
|---|---|---|
| **(A)** | Repintar utilidades de Tailwind a la marca | `.bg-white`, `.bg-slate-50`, `.border-slate-200`, `.shadow-sm` |
| **(B)** | Dar skin a componentes | `.deasy-card`, `.deasy-dialog-body`, `input`, `.hope-action-*`, `header` |

**Tres reglas juntaban las dos** (`.bg-white` + 16 componentes, `.border-slate-*` + 7, `.shadow-*`
+ 6). Y de ahí salían los `!important`: **no resolvían un conflicto contra Tailwind, resolvían un
conflicto del fichero consigo mismo** — (A) iba antes que la (B) que pisaba la misma propiedad.

**Medición que fundamenta la decisión:** hay **150 reglas fuera de capa en 12 módulos**, y sólo
**dos hojas de terceros sin capa** contra las que competir — `@vue-flow/core` y `leaflet`. Todo lo
demás está sin capa por inercia, no por necesidad.

```
@layer components   todo skin de componente
@layer utilities    los repintados, MIENTRAS existan
sin capa            SÓLO lo que pelea con un tercero sin capa
                    (hoy: graph.css / Vue Flow, y el mapa de RegisterView)
```

Con eso vuelve el contrato de Tailwind —**utilidad gana a componente**— y el repintado deja de hacer
falta: una plantilla que escriba `bg-brand-surface-muted` gana a `.deasy-dialog-body` **por capa**,
sin `!important` y sin lista blanca. Eso es «eliminar la necesidad», que es la salida que este mismo
§4.4 prefería.

**Y es seguro, medido antes de decidirlo:** **cero** elementos combinan una clase de skin con una
utilidad de fondo/borde/sombra que hoy pierda contra ella. Bajar (B) a `@layer components` **no
resucita nada** — al contrario que en F1.1, donde bajar la regla de `input` habría resucitado 90
declaraciones. Las únicas colisiones entran por **props de clase**
(`body-class="p-0 bg-slate-50 relative"` en `FirmarPdf.vue:786`, `header-class="bg-slate-50 …"`):
son dos y se revisan a mano. Ese es un modo de colisión nuevo — **una clase de skin y una utilidad
que sólo se encuentran en runtime, a través de una prop**, invisible a cualquier `grep` de plantilla.

#### Ejecución de §4.4, por partes

| | Qué | Estado |
|---|---|---|
| **4.4-a** | Migrar las que **se escapan** a la lista blanca. Cascade-neutral: no están repintadas, así que la utilidad de token cae en la misma capa y con la misma especificidad | ✅ **104 sustituciones** (ΔE 0.00–1.63) |
| **4.4-b** | Separar (A) de (B) en `overrides.css`; (A) al final, gana por orden | ✅ **0 diferencias** en la huella |
| **4.4-c** | Bajar las **150 reglas** a `@layer components`, módulo a módulo y con huella por módulo | ⬜ |
| **4.4-d** | Borrar los repintados según se quedan sin consumidores | ⬜ |

### 4.5 Los 211 dentro de `@apply`

`buttons.css` 50 · `forms.css` 38 · `misc.css` 27 · `tags.css` 26. **`stylelint` no ve ninguno**:
`color-no-hex` no entra en `@apply`. Es el CSS que damos por limpio.

**Criterio de cierre por familia** (no por fase entera): la familia migrada baja a 0 usos fuera de
`tokens.css`, y la huella de las rutas afectadas no se mueve salvo donde se declaró que sí.

---

## Fase 5 · Borrar lo muerto y corregir la documentación — ✅ CERRADA (2026-08-12)

> **Ejecutada en `8887012` y `c40555e`.** Salieron **24 clases** (165 líneas), no 39: el resto de la
> lista de abajo o estaba viva, o se compone en runtime, o ya había caído en F4.4. Lo que sigue se
> conserva porque su parte de método —cómo distinguir una clase muerta de una viva— es la que hay que
> repetir la próxima vez.
>
> **Dos cosas que la ejecución desmintió de esta sección:**
>
> 1. **`.deasy-table-shell` no era una regla viva que ganase en 239 nodos**: no está en una sola
>    plantilla. Compartía lista de selectores con `.deasy-table-responsive`, que es la que gana.
> 2. **Los contadores de `frontend/CLAUDE.md` §8 ya no son «221 vs 255»**: hoy son **205**, y el
>    fichero entero se remidió.
>
> Y dos clases más que la lista de runtime no tenía, y que un `grep` tampoco encuentra: **`.box`**
> (`FirmarPdf.vue:1340`) y **`.show`** (`modalController.js`), las dos por `classList.add`.

**~117 líneas** de CSS que no aplica a nada, en 39 clases.

| Qué | Líneas |
|---|---:|
| 12 reglas 100 % muertas (`admin.css`, `nav.css`, `tables.css`, `tags.css`, `forms.css`, `misc.css`) | 59 |
| 30 reglas con selectores muertos dentro de una lista viva | 58 |

El bloque peor: **`overrides.css:17-40`, con 10 de sus 22 selectores sin consumidor**.

Y tres reglas que no aplican por la cascada:

- **`.shadow-xl` en `overrides.css:73`** — el `!important` de la línea 3 gana siempre. Es además el
  único de los 6 `!important` **sin comentario que lo justifique**.
- **`overrides.css:99` anula el `rounded-2xl` de `forms.css`** con `border-radius: 0.5rem`: el `@apply`
  promete 16 px y el DOM da 8.
- **`.deasy-filter-control` promete `display:block`** y `HomeView.vue:80` necesita `flex`.

> ⚠️ **Antes de borrar, comprobar composición en runtime.** De las 55 clases sin uso literal, **16
> están vivas**: las 8 `deasy-tag--*`, las 6 de navegación (con el literal **en un valor por defecto de
> parámetro**, que ningún `grep` encuentra), `router-link-active` y `vue-flow__handle`. En la sesión
> del 2026-08-09 una poda automática se llevó dos de esas **con build, lint y 304 tests en verde**.

Y corregir los contadores de `frontend/CLAUDE.md` §8: dice 221 strings largos, son **255**.

**Criterio de cierre:** `lint:css` sin subir; huella sin diferencias en las seis rutas de referencia.

---

## Fase 6 · Las escalas — pide decisión de diseño

No bloquea nada, y por eso va al final. Pero son las tres deudas que **vuelven solas** si no se
declaran.

### 6.1 Tipografía

**193 usos de `text-[…]` con 18 valores distintos**, 12 por debajo de `text-sm`. Medido: son **tres
escalones reales escritos de nueve formas** — nadie distingue `9px` de `0.6rem` de `0.62rem`.

La decisión no es técnica: **cuántos escalones tiene la escala por debajo de 14 px**. Con eso, la
sustitución es mecánica.

### 6.2 `z-index`

**11 valores en 14 grafías, tres bandas que no se hablan**: la de Tailwind (0-50, usada sin criterio
de capa), tres números a ojo (6, 25, 90) y la herencia de Bootstrap (1075, 1100 — y 1075 **ni siquiera
es un valor de Bootstrap**).

La decisión: **qué capas de apilamiento tiene la app** (contenido / flotante / navegación / modal /
aviso / tip) y qué número le toca a cada una. Luego es sustituir.

### 6.3 *Utility soup*

**255 strings de clase de más de 120 caracteres**, 99 de ellos en `HomeView.vue` y `FirmarPdf.vue`.
**33 strings distintos se repiten**, sumando 84 usos; el peor **7 veces**. Son clases sin nombre.

Esto va acompasado con el **frente 3 del maestro** (partir `HomeView`): extraer la clase y partir el
componente son el mismo trabajo hecho dos veces si se separan.

---

## Lo que NO se toca, con motivo

| Qué | Por qué |
|---|---|
| **Los 7 colores de arista del grafo** | Paleta cualitativa. Su separación mínima ya es ΔE 7.2; acercarlos a tokens de marca **los junta** y rompe lo único que los hace útiles. Lo que falta es una escala declarada (F2.4), no siete sustituciones |
| **`--state-danger` ↔ `--state-pending`** (ΔE 5.69) | Decisión tomada y documentada en §2.3: «pendiente» ≠ «rechazado» |
| **Los textos blancos de la barra oscura** | 0 fallos en 663 nodos medidos. Ahí fallan los bordes, no la tipografía. Las 20 opacidades del blanco sí son deuda, pero de §2.4, no de accesibilidad |
| **`--tw-ring-color`** (`forms.css:102`) | Es una variable **interna** de Tailwind escrita a mano. Anotada como riesgo — puede desaparecer en una versión menor y dejar el foco sin anillo en silencio — pero sustituirla es cambiar el aspecto del foco, que va en F4.2 |
| **Las 16 clases compuestas en runtime** | Un `grep` las da por muertas y no lo están |

## Lo que queda fuera de este plan

| Pendiente | Dónde va |
|---|---|
| Fork de `AdminButton.vue` | Paso 4 del maestro. Mueve el aspecto y pide decisión de diseño |
| Partir `HomeView.vue` y `FirmarPdf.vue` | **Frente 3 del maestro**, acompasado con F6.3 |
| `backend/templates/email/verification-code.html` | 47 líneas con ~15 `style=` inline y **una paleta paralela** (primario `#21517a`). Fuera del frontend y de todos los planes. Sigue sin dueño |
| `docs/src/styles/global.css` | Andamiaje de Astro sin personalizar, en un sitio que `astro.config.mjs` declara que **no se publica**. Deuda muerta |
| Las 15 reglas de intención perdida de `AdminTableManager.css` | Resucitarlas cambia el aspecto. Anotadas en la bitácora del plan anterior |

---

## Cómo se verifica cada fase

El instrumento está construido, probado y **versionado**: [`scripts/css-huella.mjs`](../../../scripts/css-huella.mjs).
No hay que inventarlo otra vez.

```bash
node scripts/css-huella.mjs --captura                  # el fragmento, para la consola del navegador
node scripts/css-huella.mjs antes.json despues.json    # 0 = sin diferencias · 1 = las hay · 2 = base inválida
```

1. **Huella de estilos computados** — `getComputedStyle` de 37 propiedades + `getBoundingClientRect`
   por nodo, antes/después, comparado nodo a nodo. El script **ya espera a `document.fonts.ready`** y
   **ya rechaza una base con menos de 50 nodos**: en la sesión del 2026-08-09 una salió con 4 (página
   a medio renderizar) y no se detectó hasta comparar. Agrupa las diferencias **por propiedad**, que
   es lo que distingue un cambio previsto de una regresión: 28 diferencias todas en
   `background-color` son el cambio que buscabas; repartidas en seis propiedades, no.
2. **Rutas de referencia**: `/login`, `/home`, `/home/firmas`, `/perfil`, `/admin`,
   `/admin/academia/unidades/organigrama`, `/admin/gestiones/procesos/mapa`. El admin **no puede ver**
   `/home` ni `/perfil` (`meta.blockedForAdmin`): hay que entrar como usuario o gestor.
3. **Estados que no salen solos**: el drawer del organigrama se abre pulsando un nodo; el mapa de
   procesos necesita los toggles «Configuraciones» y «Entregables»; la tarjeta de entregable necesita
   `npm run seed:dev` y pulsar «Iniciar».
4. **Lo que la huella NO ve**: los pseudo-elementos `::-webkit-scrollbar` (y en el Chrome de la pila B
   las barras son superpuestas, así que tampoco reservan ancho). Eso se verifica leyendo el CSS
   servido y mirando.
5. **Puertas**: `pnpm run build`, `lint`, `lint:css` (sin subir), `check:no-dark`, `test:unit`.
   **Ninguna de las cinco detecta un estilo roto** — están para lo demás.
