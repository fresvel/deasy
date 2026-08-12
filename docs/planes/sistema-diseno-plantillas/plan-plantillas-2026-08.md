# Plan de ejecución — Sistema de diseño, segunda vuelta

**Base:** `develop` tras cerrar [`plan-2026-08-09.md`](../../docs-md-antiguos/planes-cerrados-2026-08/sistema-diseno/plan-2026-08-09.md) (✅ sus 6 fases)
**Evidencia:** [`auditoria-2026-08-11.md`](./auditoria-2026-08-11.md) · **Bitácora:** [`bitacora.md`](./bitacora.md)
**Reglas del sistema:** [`frontend/CLAUDE.md`](../../../frontend/CLAUDE.md)

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

## Fase 1 · Los cinco bugs

Riesgo bajo, efecto visible, cero dependencias. **Ninguno es deuda estética: son cosas rotas.**

| # | Qué | Dónde | Nota |
|---|---|---|---|
| 1.1 | **El borde de los controles.** Sacar la regla `input, select, textarea` de `overrides.css:90-103` de su limbo sin capa, o convertirla en la que declare el token correcto. Hoy gana a `.deasy-filter-control` por precedencia de capa y **mata `--brand-border-field` y `--brand-border-strong`** | `overrides.css:90-103`, `forms.css` | Afecta a **228 controles**. Ojo: los tres tokens fallan 1.4.11 (1.25 / 1.35 / 1.46), así que arreglar la cascada **no basta** — hay que subir el valor. Pero mientras el mecanismo esté en pie, subirlo no serviría de nada |
| 1.2 | **Crear `.deasy-nav-item__icon--indigo`** o cambiar el tono de «Mis envíos» | `nav.css`, `HomeSidebar.vue:74` | Medido: fondo `rgba(0,0,0,0)` frente a `rgba(255,255,255,0.04)` en sus seis hermanos |
| 1.3 | **Crear `hope-action-launch` y `hope-action-retire`**, o remapearlas a una variante existente | `buttons.css`, `AdminMainTableSection.vue:256,268,280` | 2 de 12 variantes sin regla |
| 1.4 | **Ordenar `z-index` entre aviso y modal.** Hoy `SNotify` (`z-50`) queda debajo del velo (`1075`) | `SNotify.vue`, `dialogs.css` | Se resuelve del todo en F6.2; aquí sólo lo urgente |
| 1.5 | **Desempatar el `1075`.** Está escrito en `AppDialogOverlay.vue:7` y en `.deasy-drawer-overlay`; modal y panel lateral quedan iguales y decide el DOM | idem | idem |
| 1.6 | **`AppButton` con `variant` desconocida** estampa la clase literal (`plain`, `compact`) | `AppButton.vue:92`, `AdminEditorModal.vue:43`, `AdminDraftArtifactModal.vue:187-199` | Añadir *fallback* o registrar las dos variantes |
| 1.7 | **`.graph-node__btn--accent` a 2.70:1** en las variantes `--config` y `--template` | `graph.css:179` | **Introducido el 2026-08-11 por esta misma línea de trabajo.** Blanco sobre un acento aclarado, y es la acción principal del nodo |

**Criterio de cierre:** los siete verificados en navegador; huella de `/home`, `/admin` y
`/admin/gestiones/procesos/mapa` sin más diferencias que las siete previstas.

---

## Fase 2 · Completar `@theme` y crear los tokens que faltan

**Es la fase que desbloquea el plan entero.** Hoy `@theme` registra 16 nombres de los que **9 no
llegan al CSS construido**, y deja fuera los que más se usan.

### 2.1 Registrar lo que ya existe

| Token | Por qué | Evidencia |
|---|---|---|
| `--brand-text-muted` | 14 usos por `var()` **+ 6 por valor arbitrario** = 20. Es el destino de ~500 `text-slate-400/500` | Más usos que `--brand-border-strong`, que sí está |
| `--state-warning` | Destino de 164 `amber-*`/`orange-*` | — |
| `--state-pending` | Hoy se escribe `text-[var(--state-pending)]` en `tags.css:36` | — |
| `--brand-icon` | — | — |
| `--action-view`, `--action-upload`, `--action-neutral` | — | — |

Y **retirar los 9 registros muertos** (`--color-brand-accent`, `-navy`, `-ink`, `-white`,
`-border-strong`, `-surface-muted`, `--color-state-success`, `-danger`, `-gold`). Son inertes —
Tailwind los poda — pero declaran una API que nadie llama, y hacen creer que `@theme` está completo.

> **Comprobación obligatoria:** Tailwind v4 hace *tree-shaking* de `@theme`. Un registro que nadie usa
> **no se emite**, así que el `grep` sobre el CSS construido es la única prueba de que un registro
> está vivo. Verificar en `frontend/dist/assets/*.css`, no en el fuente.

### 2.2 Los `--shadow-*`, decisión pendiente

`--shadow-raised/-modal/-drawer` **ocupan el namespace `--shadow-*` de Tailwind y no están en
`@theme`**: ni generan `shadow-raised` ni evitan una colisión futura. Dos salidas, y hay que elegir:

- **Registrarlos** en `@theme` → aparecen `shadow-raised`, `shadow-modal`, y desaparecen los 5
  `shadow-[var(--shadow-…)]`.
- **Renombrarlos** fuera del namespace (p. ej. `--brand-elev-*`) → coherente con `--brand-shadow`, que
  es el **primer escalón de la misma escala** y hoy tiene otro prefijo.

La segunda arregla además que un `grep '--shadow-'` no encuentre el primer nivel y un `grep '--brand-'`
no encuentre los otros dos: **cinco tokens de `box-shadow` en tres convenciones de nombre**.

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
> borde da **1.46:1** y su texto acompañante `#118a57` da **4.38:1** — ninguno cumple. Al elegir el
> valor del token, elegirlo **para que cumpla**, no para reproducir el actual.

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

### 4.1 Empezar por las siete que son ΔE 0.00

Migración **de nombre, no de color**. Nada se mueve en pantalla, y son las que más se copian.

| Token | = Tailwind | Apariciones de esa familia |
|---|---|---:|
| `--state-success` | emerald-700 | 223 emerald + 14 green |
| `--state-warning` | amber-700 | 161 amber + 3 orange |
| `--action-view` | sky-800 | (parte de 345 sky) |
| `--brand-icon` | slate-600 | — |
| `--brand-surface-alt` | slate-50 | (parte de 1 838 slate) |
| `--brand-navy` / `--brand-ink` | gray-900 / gray-800 | — |

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

### 4.3 El fallo de accesibilidad de volumen

**`text-slate-400` = 2.63:1, 202 usos en 42 ficheros**, y es el placeholder de `.deasy-field-input` y
`.deasy-auth-field`. El token equivalente da 6.36:1. Esto contradice literalmente la regla escrita en
§3 («el suelo es `--brand-text-muted`»).

### 4.4 Cerrar la fuga de `overrides.css`

El repintado cubre **834 apariciones (23,3 %)** pero es una **lista blanca de opacidades escrita a
mano**, y **85 se le escapan** (`bg-slate-50/50` ×35, `border-slate-200/80` ×18, `bg-slate-50/60` ×14…).
Esas pintan el gris de Tailwind **junto a hermanas repintadas dentro del mismo componente**.

Dos salidas: ampliar la lista (frágil, volverá a pasar) o **eliminar la necesidad** migrando esas
utilidades a tokens. La segunda es la que cierra el problema.

### 4.5 Los 211 dentro de `@apply`

`buttons.css` 50 · `forms.css` 38 · `misc.css` 27 · `tags.css` 26. **`stylelint` no ve ninguno**:
`color-no-hex` no entra en `@apply`. Es el CSS que damos por limpio.

**Criterio de cierre por familia** (no por fase entera): la familia migrada baja a 0 usos fuera de
`tokens.css`, y la huella de las rutas afectadas no se mueve salvo donde se declaró que sí.

---

## Fase 5 · Borrar lo muerto y corregir la documentación

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
