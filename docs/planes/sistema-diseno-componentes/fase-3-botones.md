# Fase 3 · El botón — inventario, homogeneización y mapa de revisión

> Desarrollo de la **fase 3** del [plan de la 3.ª vuelta](./plan-2026-08-13.md). Sale a fichero
> propio porque el inventario no cabe en una fila de tabla y porque **el mapa de revisión se usa en
> cada punto de control**, no una vez.

## ⓿ · Estado por GRUPO — la tabla que se mira primero

**5 de los 11 grupos cerrados · 180 botones, y los CINCO con gate de techo 0.**

> **Los cinco grupos cerrados se recensaron por estructura el 2026-08-15.** El inventario
> original contaba mal en los cinco: **29→48, 23→28, 26→63, 26→14, 23→27**. Los cinco tienen ya
> **gate propio de techo 0**, así que ninguno puede reabrirse en silencio.
> Ver 3.4-ter, 3.5a-bis, 3.5b-ter, 3.5b-2c y 3.5b-2d.

| Grupo | Botones | Estado | Dónde quedó |
|---|--:|:--:|---|
| **G1** · acción general | 303 | ⬜ | 123 son `<button>` crudo. Es el grueso que queda |
| **G2** · acción de fila | **48** | ✅ | Tareas 3.4 y **3.4-ter** · censo por estructura + gate `check:row-actions` |
| **G3** · cerrar diálogo | **63** | ✅ | Tareas 3.5b, 3.5b-bis y **3.5b-ter** · censo por estructura + gate `check:dismiss-actions` |
| **G4** · paginación | **14** | ✅ | Tareas 3.5b-2a y **3.5b-2c** · censo por estructura + gate `check:paging-actions` |
| **G5** · destructivo | **27** | ✅ | Tareas 3.5b-2b y **3.5b-2d** · censo por estructura + gate `check:destructive-actions` |
| **G6** · filtro | **28** | ✅ | Tareas 3.5a y **3.5a-bis** · censo por estructura + gate `check:filter-actions` |
| **G7** · pestaña | 19 | ⬜ | 100 % crudos. Componente propio, no variante |
| **G8** · navegación / menú | 14 | ⬜ | 100 % crudos. Con G7 |
| **G9** · auth | 9 | ⬜ | `deasy-auth-button`, vivo en 5 ficheros |
| **G10** · solo icono | 6 | ⬜ | Aquí entra unificar los 2 nombres del lienzo |
| **G11** · envío | 2 | ⬜ | — |

⚠️ **Hay DOS tablas de control en este plan y confundirlas ya costó una respuesta entera
(2026-08-15).** Ésta —por **grupo de botón**, G1…G11— es la que sigue el dueño y la que se enseña
cuando pregunta «cómo va». La otra, más abajo en §7, es por **tarea de ejecución** (3.0, 3.1,
3.2…) e incluye trabajo que no es de ningún grupo: la geometría única, los tres gates nuevos, la
convención de nombres. **Una tarea cerrada no es un grupo cerrado.** Y por encima de las dos está
el control de ejecución del [plan maestro](./plan-2026-08-13.md#0--control-de-ejecución), donde
todo esto es **una sola fila, F3.2**.

**Al informar del estado se dice de qué tabla se habla.** Si no, pasa lo del 15-08: «7 de 11
grupos» contando la geometría y los gates, que no son grupos. Son **5**.

## Contexto — por qué esta fase, y por qué ahora

El plan la tenía como «las tres extracciones que faltan». La ejecución de las fases 0 y 1 cambió dos
cosas que la adelantan:

- **Su blocker murió.** `buttons.css` documentaba **dos** motivos por los que los 12 botones de
  acción de tabla no pueden bajar de capa. El segundo era que `AdminButton.vue` estampaba utilidades
  crudas; ese fork se borró el 2026-08-14. Queda uno.
- **El dueño lo pidió al ver el efecto.** Al revisar el cambio de los botones del dossier: *«no
  entiendo por qué tenemos botones para perfil y botones para admin; si son para la misma
  funcionalidad deberían colapsar en un mismo componente»*. Y el dato que le da la razón: el fork se
  llamaba `AdminButton` y **su único importador era de perfil**. La división no era arquitectónica,
  era accidental.

**El objetivo, en sus palabras: homogeneización estricta.** Si dos botones hacen lo mismo, son
exactamente el mismo — y su estilo vive **dentro del componente**, no viajando por el atributo.

---

## 1 · El inventario — 480 botones

Medido el 2026-08-14 sobre `frontend/src`, excluyendo comentarios.

| Función | nº | Cómo se pintan hoy | El problema |
|---|--:|---|---|
| **Acción general** | **303** | 173 por componente · **123 `<button>` crudo** | 123 llevan el estilo entero en el atributo |
| **Acción de fila** | 29 | componente + `hope-action-*` | **las 29 piden `variant="secondary"` y se repintan por fuera: la prop es mentira** |
| Cerrar diálogo | 26 | 23 comp · 3 crudos | |
| Paginación | 26 | 12 comp · 14 crudos | 17 con clases por fuera |
| Destructivo | 23 | 14 comp · 7 crudos · 2 `BtnDelete` | tres caminos para «borrar» |
| Filtro | 23 | componente, **los 23 con clases por fuera** | |
| Pestaña | 19 | **100 % crudos** | |
| Navegación / menú | 14 | **100 % crudos** | |
| Auth | 9 | **100 % crudos** | |
| Solo icono | 6 | componente, sin clases por fuera | **el único grupo limpio** |
| Envío | 2 | | |

**248 de los 480 llevan estilo viajando por el atributo.** Y hay **106 recetas de clase distintas**
entre los `<button>` crudos.

### Cinco geometrías para el mismo objeto

| Familia | Radio | Alto | Peso | Sombra |
|---|--:|--:|--:|---|
| `deasy-btn` (base) | **16 px** | 40 | **600** | ninguna |
| `deasy-btn--close` | 16 px | 36 | — | ninguna |
| `deasy-filter-btn` | **10 px** | 40 | 500 | ninguna |
| `hope-action-btn` | **10 px** | 36 | — | ninguna |
| `deasy-auth-button` | propia | | | |
| **TailAdmin (destino)** | **8 px** | **44** | **500** | `shadow-theme-xs` |

### Ocho formas de nombrar lo mismo — 48 clases

```
A  deasy-btn--MOD          18   ← BEM correcto, y ya es la mayoría
B  deasy-btn                1   ← el bloque base
C  deasy-XXX-btn            2   deasy-filter-btn, deasy-filter-btn--icon
D  deasy-XXX-button         5   deasy-auth-button, deasy-hero-back-button, deasy-inline-icon-button
E  hope-action-XXX          1   hope-action-btn (+ 12 modificadores)
F  admin-btn                1   la estampa AppButton en TODOS para casar UNA regla
G  bloque__btn             11   graph-node__btn, btnsera__icon…
H  otras                    8   graph-edge-btn, graph-icon-btn, btnsera
```

### Dos defectos vivos que salieron al contar

| Dónde | Qué | Efecto |
|---|---|---|
| `AdminProcessWizardModal.vue:24` | `variant="outline-primary"` (kebab); el mapa tiene `outlinePrimary` | El botón se renderiza **sin variante** |
| `HomeView.vue:2028` | `variant="warning"`; **no existe** en el mapa (hay `softWarning`) | Igual |

`resolveClass` solo avisa por consola **en desarrollo**, así que en producción el botón sale sin
color y sin que falle nada. **Cerrado el 2026-08-14** con `check-variants.mjs` (tarea 3.2), que lee
los mapas del propio componente — no una copia, que es la avería que tenía `contraste.mjs`.

Y el segundo defecto destapó un hueco real del sistema, no un typo: **los sólidos eran `primary`,
`success` y `danger`, sin el de aviso**, mientras las suaves sí tenían los cuatro tonos. Se añade
`deasy-btn--warning` con la receta de sus hermanas; `--color-warning` sobre blanco da **5.43:1**.

---

## 1-bis · La regla, corregida el 2026-08-14 — y por qué la anterior hacía daño

La fase arrancó con **«si dos botones hacen lo mismo, son exactamente el mismo»**, y eso es
correcto. Lo que se aplicó mal fue lo contrario: **empujar hacia el mismo componente cosas que no
hacen lo mismo**, y resolver la diferencia con una variante. Eso no es reutilizar: es forzar.

> **Se reutiliza cuando la FUNCIÓN es la misma. Si no, es otro componente.**
>
> Y una variante solo es legítima cuando cambia el **aspecto**. En cuanto cambia la
> **estructura** o el **contrato**, ya no es una variante.

Las tres señales de que una «variante» es en realidad otro componente — las tres las cumplía la ✕
antes de separarla, y las tres estaban a la vista:

1. **Trae su propio contenido** e ignora el slot (una rama `v-if` en la plantilla solo para ella).
2. **Rechaza props que todas las demás aceptan** — y eso no está escrito en ninguna parte, así que
   quien la usa no puede saberlo.
3. **Tiene un estado o un papel que las otras no tienen** (activo/actual, una etiqueta fija).

⚠️ **El coste de no verlo se paga en silencio.** `close` prohibía el tamaño sin decirlo:
`AppFormModalLayout` le pasó el `--md` por defecto, el `px-4 py-2` dejó la caja interna en 4 px y
**el icono se aplastó a 2 px — invisible durante meses**. Y como su contrato no estaba claro, dos
armazones se saltaron el componente y copiaron el markup a mano, que es justo la duplicación que
esta fase venía a eliminar. **Forzar la reutilización produjo más copias, no menos.**

## 2 · El alcance decidido

**447 son ACCIÓN → un solo componente.** Acción general, acción de fila, destructivo, filtro,
cerrar, envío, solo icono, auth y paginación.

**33 son NAVEGACIÓN → componente propio.** 19 pestañas y 14 elementos de menú. Son `<button>` por
accesibilidad, pero su función es *navegar*, no *ejecutar*, y necesitan un estado que un botón no
tiene: **activo / actual**. Meterlos como variante obliga al botón a cargar con ese estado y con una
geometría que no es la suya (una pestaña lleva subrayado y no lleva borde). Es el injerto que el
repo tiene documentado como causa de que `AdminTableManager` se hiciera God.

---

## 2-bis · La convención de nombres — DECIDIDA el 2026-08-14

**`deasy-btn` es UN bloque, y todo lo demás es modificador con DOS guiones.**

```
deasy-btn                    el bloque
deasy-btn--primary           variante semántica
deasy-btn--soft-danger
deasy-btn--icon              forma
deasy-btn--sm  --md  --lg    tamaño

deasy-tab        deasy-tab--active        ← NO son botones: bloques propios
deasy-nav-item   deasy-nav-item--active
```

**Mueren:** `deasy-filter-btn`, `deasy-auth-button`, los 12 `hope-action-*`, `admin-btn`,
`deasy-inline-icon-button`, `deasy-hero-back-button`.

⚠️ **Corrección del 2026-08-15.** Esta lista incluía también `graph-icon-btn` y `graph-edge-btn`, y
eso se escribió **antes** de la regla corregida de §1-bis. Los botones del lienzo tienen geometría
propia (24 px) y contexto propio: forzarlos a `deasy-btn` sería el mismo error que forzar la ✕ a ser
una variante. **Se quedan.** Lo que sí es defecto es que el lienzo escriba el mismo botón con
**tres** nombres —`graph-node__btn`, `graph-icon-btn`, `graph-edge-btn`—, y eso es lo que unifica
G10.

⚠️ **Por qué DOS guiones y no uno.** Se consideró `deasy-btn-xxx` (un guion, más corto). No se toma,
y el motivo es que no son dos estilos de lo mismo: **son dos conceptos**. En BEM, `--` significa «esto
es una variante del bloque»; un guion simple significa «esto es otro bloque que empieza igual». Esa
ambigüedad **es** el desorden actual: `deasy-filter-btn` parece un botón de filtro y en realidad es
un bloque aparte con su propia geometría (10 px de radio frente a 16). Con la convención plana,
`deasy-btn-filter` y `deasy-btn-primary` serían indistinguibles aunque uno sea un bloque con
geometría propia y el otro un tono. Además **18 de las 48 clases ya están en la forma correcta**: no
hay que inventar convención, hay que someter a las otras 30.

**Y navegación no se llama botón.** `deasy-btn--nav` volvería a mezclar lo que esta fase separa: un
elemento de navegación tiene un estado —activo/actual— que un botón no tiene, y una geometría que no
es la suya. El nombre pasa a decir la verdad: **si empieza por `deasy-btn--`, es un botón; si no, no
lo es.**

---

## 3 · El mapa de revisión — dónde se mira cada grupo

**Pila B.** URL base `http://localhost:8188` (o `https://localhost:8543`).

| Usuario | Cédula | Contraseña |
|---|---|---|
| admin | `1234567890` | `Demo1234!` |
| gestor | `0987654321` | `Gestor1234!` |
| usuario | `1122334455` | `Demo1234!` |

⚠️ El router bloquea `/home`, `/home/*` y `/perfil` **para el admin**. El dossier, los entregables y
las firmas se ven **como gestor o usuario**.

### Los deep-links de `/admin` — no vale `/admin` a secas

`/admin` es `/admin/:section?/:item?/:table?`, y **el contrato de esas URLs está congelado en un
test** (`core/router/index.test.js`, «contrato de URL de /admin»). Las tres que hacen falta aquí:

| URL | Qué abre |
|---|---|
| `/admin/usuarios/personas/persons` | La tabla de personas — **la pantalla de control: 172 botones a la vez** |
| `/admin/academia/unidades/organigrama` | El organigrama de unidades (`UnitGraphView`) |
| `/admin/gestiones/procesos/mapa` | El mapa de procesos (`ProcessGraphView`) |

⚠️ **Y una ruta no basta cuando el elemento vive tras un estado.** Dos de los casos de esta fase solo
aparecen si el dato lo permite, y decirlo es parte de la instrucción:

- **El asistente de proceso** no sale de una tabla: sale del **organigrama** → clic en un nodo de
  unidad → pestaña **«Procesos»** del panel → botón **«+ Nueva configuración»** (`UnitGraphView.vue:301`,
  visible solo con permiso de crear configuración).
- **El reseteo de un entregable** exige que el backend declare `can_reset_workflow` **y**
  `implemented.reset_workflow` (`useDeliverableView.js:387`): hace falta un entregable **con el flujo
  ya empezado**. Si no, el botón «Reiniciar» no existe en el DOM.

### G1 · Acción general — 303 · el grueso

| Dónde mirar | Ruta | Usuario | Qué abrir |
|---|---|---|---|
| `HomeView` (55) | `/home` | gestor | La pantalla completa: tarjetas de entregable y sus acciones |
| `UnitGraphView` (28) | `/admin/academia/unidades/organigrama` | admin | Barra superior del grafo, y el panel que sale al pulsar un nodo |
| `ProcessGraphView` (26) | `/admin/gestiones/procesos/mapa` | admin | Barra del mapa y botones de cada nodo de proceso |
| `FirmarPdf` (20) | `/home/firmas` | gestor | Abrir un documento a firmar |
| `AdminDraftArtifactModal` (12) | `/admin/gestiones/procesos/mapa` | admin | Nodo de proceso → gestionar sus entregables |
| `GeneralTaskModal` (10) | `/home` | gestor | Botón de tarea ad-hoc |

### G2 · Acción de fila — 29 · los `hope-action-*`

| Dónde | Ruta | Usuario | Qué abrir |
|---|---|---|---|
| `AdminMainTableSection` (8) | `/admin/usuarios/personas/persons` | admin | **La pantalla de control: 172 botones a la vez** |
| `DossierDocumentActions` (6) | `/perfil/formacion` | gestor | La fila de acciones de cualquier título |
| `AdminDraftArtifactModal` (4) | `/admin` → plantillas | admin | Dentro del modal, la tabla de borradores |
| `AdminTableActions` (3) | cualquier tabla de `/admin` | admin | Columna de acciones |

### G3 · Cerrar diálogo — 26

`/home` (7) y `/home/firmas` (5) como gestor; `AppFormModalLayout` (2) en `/perfil/formacion` →
**Agregar**. En admin, el aspa de cualquier modal.

### G4 · Paginación — 26

`/home` (6, listas de entregables) · `/home/firmas` → panel multi-firmante (8) · `AppCounterNavigator`
en `/admin` sobre cualquier tabla larga.

### G5 · Destructivo — 23

`/home/firmas` → quitar firmante (4) · `/perfil/formacion` → **Eliminar** en una fila (2) ·
`/admin` → **Organigrama** → borrar relación (2) · `AdminDeleteConfirmModal` en cualquier borrado.

### G6 · Filtro — 23

`/admin/usuarios/personas/persons` → barra de filtros (8) · `/admin` → vacantes (4) ·
`/admin` → artefactos sin asignar (3) · `/home` (3) · `/home/documentos` (2).

### G7 · Pestaña — 19 · NO entra en el botón

`/home` (11, pestañas de listas) · `/procesos` → mapa (3) · `/admin` → Organigrama (2) ·
`/perfil` → subsecciones (1) · `AdminFkBrowserModal` (2), que sale al pulsar la lupa de un campo FK.

### G8 · Navegación — 14 · NO entra en el botón

`/admin` → barra lateral (9) · `/procesos` (2) · `/home` → barra lateral (1) ·
`/home/firmas` → barra lateral (1) · `/perfil` → barra lateral (1).

### G9 · Auth — 9

`/` (login) · `/register` · `/recover-password` · `/verify-email` · `/setup`. **Sin sesión.**

### G10 · Solo icono — 6

`/procesos` → mapa (3) · `AdminLookupField` (2) en cualquier formulario de `/admin` con campo de
búsqueda · `AdminDefinitionRulesPanel` (1).

### G11 · Envío — 2

`/register` (1) · `AppFormModalLayout` (1), en `/perfil/formacion` → **Agregar** → botón Guardar.

---

## 3-bis · G2, cerrado el 2026-08-14 — qué se aprendió

**Los 12 no eran un componente: eran `--icon` + la familia suave escritos otra vez.** La prueba, byte
a byte: su `:hover` es la receta de `--soft-*` (borde 85 %, relleno 16 %, texto 85 % sobre negro) y
su caja es la de `--icon` (2.25 rem cuadrados, `padding: 0`). Lo único que los distinguía era el
relleno de reposo —**9, 10 y 11 %** frente al 6 %—, y eso no es una variante: es la regla de §2.4
para lo que lleva un **icono** encima. Hoy es un eje, `--tone-fill`.

**Faltaban dos tonos en la familia suave** (`--soft-action-view`, `--soft-action-upload`): existían
solo dentro de `hope-action-*`. Con ellos, los 12 colapsan a cinco.

**El blocker de la fase 6 se resolvió donde tocaba.** `.deasy-table-responsive .deasy-btn` (0,2,0)
es una regla de **densidad** —padding, tamaño de letra, altura— y nada de eso gobierna a un botón
cuadrado de icono. Excluyendo la forma que no le corresponde, los dos bloques fuera de capa pudieron
morir. **La deuda de la F6 pasa de 28 reglas a 14.**

### Tres cosas que solo vio el navegador

1. **`min-height` gana a `height`.** Al quitar la regla de densidad, el botón de icono recuperó el
   `min-h-10` de `.deasy-btn` y salió de **36 de ancho por 40 de alto**: dejó de ser cuadrado. El
   fallo apareció *al arreglar otra cosa*, y no lo vio ni el lint ni el CSS servido — lo cazó
   `getComputedStyle`. Arreglado con `min-h-9` explícito.
2. **`color-mix()` con una variable como porcentaje SÍ funciona**, pero había que comprobarlo: el
   repo tiene documentado el caso gemelo (`rgb(var(--x)/0.5)`) que se emite y el navegador descarta
   en silencio. Medido: el mismo tono da 6 % con texto y 10 % con icono.
3. **`text-primary` y `text-danger` iban pegados a dos de estos botones y no pintaban nada**: la
   regla del tono estaba fuera de capa y le ganaba a la utilidad. Clases muertas, retiradas.

### Y la unificación de color — decidida el 2026-08-14

Al terminar el colapso, los cinco tonos eran: cuatro de TailAdmin y **uno propio**. Medido:

| tono | era | ahora | origen |
|---|---|---|---|
| success | `success-700` | igual | TailAdmin, **idéntico al del tag** |
| danger | `error-700` | igual | TailAdmin, **idéntico al del tag** |
| warning | `warning-700` | igual | TailAdmin, **idéntico al del tag** |
| ver | `--color-action-view` = `blue-light-800` | **`--color-info`** = `blue-light-700` | TailAdmin, **ahora sí el del tag** |
| subir/versionar/descargar | `--color-action-upload` = **`#3751a3` propio** | `--color-action-upload` = **`brand-900`** | TailAdmin |

**Se borran dos tokens.** `--color-action-neutral` se quedó con **cero consumidores** al morir la
caja `hope-action-btn` — un token que sobrevivía a su único usuario. Y `--color-action-view` era
`blue-light-800` mientras `info` era `blue-light-700`: **la misma familia en pasos contiguos, con
dos nombres según qué componente lo escribiera** — el tag y la alerta usaban uno, los botones, la
zona de subida y las tarjetas de entregable el otro. 27 consumidores migrados.

⚠️ **El índigo no tenía equivalente: el paso más cercano de la paleta está a ΔE 17.2.** No era una
sustitución mecánica sino decidir si ese tono debía existir. Se decidió que sí —subir/descargar/
versionar es una categoría propia— y se ancla a `brand-900`, que es un cambio de color visible y
sube el contraste de 7.32 a 11.45.

Contraste final, medido sobre los valores **reales del DOM** (no los teóricos):

```
tono                      icono/relleno  borde/fila
success (editar…)              4.71         3.14
info (ver)                     5.06         3.32
action-upload (subir…)         9.55         4.95
danger (borrar)                5.56         3.86
warning (retirar)              4.72         3.23      todos ≥3
```

**Cero colores propios en los botones.** Los tokens del sistema bajan de 24 a 22.

### Dos defectos de producto que salieron al unificar

- **`AdminMainTableSection` tenía «Versionar» en dos aspectos.** La línea 232 usaba
  `hope-action-version` (índigo) y la 323 —la misma acción— iba **sin tono**, gris. Unificadas.
- **`DossierDocumentActions` pedía su fila con `d-inline-flex align-items-center`, de BOOTSTRAP.**
  Esas clases no existen en el proyecto: el `<div>` llevaba años siendo un bloque normal y su `gap`
  no hacía nada. Ahora es flex de verdad.

## 4 · Verificación

Cada grupo se cierra con **su fila del mapa de arriba abierta en el navegador**, y con la huella
antes/después:

```bash
node scripts/css-huella.mjs --captura                 # fragmento para pegar en la consola
node scripts/css-huella.mjs antes.json despues.json   # 0 si no hay diferencias
```

⚠️ **Aquí se ESPERA que la huella difiera**: cambian radio, alto, peso y sombra en 447 nodos. Cada
diferencia tiene que poder explicarse; lo que no vale es una que no se sepa de dónde sale. La huella
**no ve** `:hover`, `:focus` ni `::placeholder` — esos, a mano.

Y los gates de siempre, que ninguno ve un estilo roto pero sí una clase inventada:

```bash
bash scripts/stack.sh b exec -T frontend pnpm run lint       # los 8 gates, con build
bash scripts/stack.sh b exec -T frontend pnpm run test:unit
```

---

## 5 · Control de ejecución

> ⚠️ **Los grupos son ONCE: G1…G11.** Durante la ejecución se dijo «12» en varios sitios: el
> script del inventario parte *acción general* en dos (173 por componente + 130 escritos a mano) y
> al unirlos en la fila G1 no se corrigió el conteo. **G1 es uno solo, con dos mitades.**
>
> ⚠️ **Y el orden de ejecución NO es el del inventario.** El inventario los ordena por tamaño; se
> atacan por otro criterio. Hasta ahora: G2 (aprobado), luego la geometría (3.3) y con ella G6, que
> se cayó sola. Los saltos se anotan aquí para que la tabla, no la memoria, diga qué queda.

| # | Qué entrega | Estado | Evidencia | Fecha |
|---|---|:--:|---|---|
| **3.0** | Inventario de los 480 botones clasificados por función | ✅ | Este documento. **11 grupos** (G1…G11), 8 formas de nombre, 5 geometrías, 2 defectos vivos | 2026-08-14 |
| **3.1** | La convención de nombres, decidida y escrita | ✅ | §2-bis. `deasy-btn--MOD` (BEM, dos guiones); navegación en bloques propios `deasy-tab` / `deasy-nav-item`. **18 de las 48 clases ya cumplían**; se someten las otras 30 | 2026-08-14 |
| **3.2** | Gate: toda `variant="…"` de plantilla existe en el componente | ✅ | `check-variants.mjs`, encadenado a `lint`: **386 atributos** contrastados contra los mapas **del propio componente** (no una copia). Cazó los 2 defectos vivos y los dos están corregidos | 2026-08-14 |
| **3.3** | Geometría única (TailAdmin) dentro del componente | ✅ | Radio 16→**8**, peso 600→**500**, `shadow-theme-xs`. Medido en la pantalla de control: **248 de 248 botones en UNA geometría**, donde convivían cinco. Cae también `.admin-lookup-field .deasy-btn--icon` (6 px «para no ser el estándar de 16», y ganaba **por orden de `@import`**). Techo de arbitrarios 416→414 | 2026-08-14 |
| **3.4** | G2 · los 12 `hope-action-*` colapsan a variantes | ✅ | **0 `hope-action` en el CSS servido.** 29 botones en 9 ficheros pasan a `variant`, sin una sola clase de estilo por fuera. Mueren **2 bloques enteros fuera de capa**: la deuda de la F6 baja de **28 a 14**. 9 gates verdes, 316/316 tests | 2026-08-14 |
| **3.4-bis** | El botón de icono suave adopta el badge de TailAdmin | ✅ | Sus colores no eran los suyos: relleno derivado al 10 % (más gris que el paso `-50` real) e icono en `-700` en vez de `-600`. Ahora relleno `-50`, icono `-600`, **sin borde** — el borde derivado del tono claro caía a 2.41-2.64 y no llega a 3:1. Se probó el sólido sobre 178 botones y se descartó | 2026-08-14 |
| **3.5a** | **G6 · filtro** (23) | ✅ | `deasy-filter-btn` muere entera: existía por geometría (ya resuelta en 3.3) y por **repintar 5 variantes en 3 aspectos** — `secondary`≡`softNeutral` y `primary`≡`softPrimary`, o sea la prop mintiendo en 2 de cada 5. Seis variantes corregidas a lo que ya renderizaban | 2026-08-14 |
| **3.5b** | **G3 · cerrar** (26) | ✅ | La ✕ tenía **tres radios** tras 3.3 (base 8 · `--close` 16 · `dialogs.css` 8.8) y ahora tiene uno: la regla del panel se sube a la clase base y muere. Dos «Cerrar» pintados en **rojo de contorno** pasan a `secondary` — cerrar no es destruir. Un `<button>` crudo de 15 utilidades pasa a componente. La decisión pendiente («`cancel` o `secondary` para el mismo botón de pie») **la resolvió el censo de 3.5b-bis**: manda la etiqueta — «Cancelar» es `cancel`, «Cerrar» es `secondary`, y 6 botones decían una cosa y pintaban la otra | 2026-08-15 |
| **3.4-ter** | **G2 recensado por ESTRUCTURA** + gate `check:row-actions` | ✅ | Los tres censos anteriores buscaban **donde ya se sabía que había algo**; éste busca la señal estructural: **un botón dentro de un `v-for` actúa sobre un elemento de una colección**. G2 pasa de 29 a **48**, con **21 no conformes** que ningún censo por función vio. Cerrado en **48/48** y **atornillado con un gate de techo 0**, probado en rojo. Nacen `deasy-chip-remove`, `deasy-pdf-action` y 3 tonos de `deasy-inline-action`. Arbitrarios **397→394**, colores fuera de paleta **244→240** | 2026-08-15 |
| **3.5a-bis** | **G6 recensado por ESTRUCTURA** + gate `check:filter-actions` | ✅ | Su señal no es el `v-for` sino **el contenedor**: un botón dentro de `deasy-filter-*` filtra, se llame como se llame; y para lo que vive fuera de una shell, el manejador. **28 botones, 4 no conformes**, y los 4 resultaron ser **controles de formulario disfrazados de `<button>`**: un switch `role="switch"` de 13 líneas **con `SToggle` ya en el repo**, el disparador de un desplegable y sus opciones. Nacen `deasy-filter-control--trigger` y `deasy-option`. Gate de techo 0, probado en rojo | 2026-08-15 |
| **3.5b-bis** | **Censo por función sobre G2 y G3** | ✅ | Buscando por lo que el botón **dice que hace** (no por cómo está escrito), G3 pasa de 22 a **62** elementos: 14 huecos que los dos censos por implementación no vieron. **G2 limpio** (`AdminTableActions`, `DossierDocumentActions`, `HomeSignatureEntry`: componente + `soft*` + `icon-only`). G3 cerrado en **55/55**. Detalle en §5-bis | 2026-08-15 |
| **3.5b-ter** | **G3 recensado por ESTRUCTURA** + gate `check:dismiss-actions` | ✅ | Tercera señal distinta: ni el `v-for` de G2 ni el contenedor de G6, sino **lo que el botón le hace al contenedor** — emitir `close`, poner a `null`/`false` la variable que lo abre, llamar a `closeX()`. **63 botones y 0 no conformes**: el censo por función de 3.5b-bis ya los había cerrado. Pero encuentra **10 que aquel no habría visto nunca** («Ahora no», «Aplicar» y siete ✕ sin etiqueta), o sea que el verde es real y no suerte. Gate probado en rojo por dos vías | 2026-08-15 |
| **3.5b-2a** | **G4 · paginación** | ✅ | El navegador de contador estaba escrito **cuatro veces**: el componente y tres copias a mano. Le faltaban cuatro cosas y por eso se copiaba (`valueLabel`, `size="sm"`, `tone="floating"`, `controls`); ahora las tiene y no viaja ni una utilidad. Las copias **ocultaban** las flechas donde el componente las **deshabilita**, así que el contador saltaba de sitio al llegar al extremo. Estilo entero en `nav.css` como `deasy-counter-nav`. Arbitrarios **412→404** | 2026-08-15 |
| **3.5b-2b** | **G5 · destructivo** | ✅ | Censo por función: **19 destructivos reales**, 11 no conformes → **13/14 conformes** (queda el `graph-edge-btn` del lienzo, que es G10). `BtnDelete`→**`AppDeleteButton`**: sobrevive como componente (cumple las 3 señales, como la ✕) pero pierde el `<svg>` a mano, el `@onpress` inventado, el `className` y una **prop `variant` fantasma que no declaraba**. Nace `deasy-inline-action--danger` para los 4 «Quitar»/«Desvincular» que tenían **dos tamaños y dos hovers**, uno de ellos inerte. `FirmarPdf` llamaba a la **misma** función desde dos botones distintos. Arbitrarios **404→401**, colores fuera de paleta **257→244** | 2026-08-15 |
| **3.5b-2c** | **G4 recensado por ESTRUCTURA** + gate `check:paging-actions` | ✅ | Señal: **el @click mueve un índice** (`prevX`/`nextX`, `goToPage`, `++`/`--` sobre él). **14 botones, 3 no conformes**. Los dos «Atrás»/«Siguiente» del arranque llevaban `w-auto px-5` y `w-auto px-6` — **dos paddings distintos en la misma barra**; nace `deasy-auth-button--compact`. El tercero destapó un `AppButton` **sin variante**, que salía sin color | 2026-08-15 |
| **3.5b-2d** | **G5 recensado por ESTRUCTURA** + gate `check:destructive-actions` | ✅ | Señal: **el @click invoca un borrado**. Buscar el verbo solo como *prefijo* perdía 5 de 19 (`requestDeleteField`, `handleAttachmentDelete`, `confirmDeleteEdge`). **27 botones**. Sale el **gemelo rojo de `deasy-pdf-action`** en `SignatureBox`, que G2 no vio por no estar en un `v-for` | 2026-08-15 |
| **3.5c** | **G9 · auth** (9) · **G10 · solo icono** (6) · **G11 · envío** (2) | ⬜ | — | — |
| **3.6** | G1 · los 123 `<button>` crudos de acción general | ⬜ | — | — |
| **3.7** | G7 y G8 · pestaña y navegación a su propio componente | ⬜ | — | — |
| **3.8** | `BtnDelete` y `BtnSera` absorbidos o justificados | 🟡 | **`BtnDelete` cerrado en 3.5b-2b**: justificado como componente propio (`AppDeleteButton`) por las 3 señales de §1-bis, y reescrito. Falta `BtnSera` | 2026-08-15 |

---

## §5-bis · El censo por función (2026-08-15)

Los dos huecos de G3 salieron del mismo error, cometido dos veces: **buscar por implementación**.
El primer censo buscó `data-modal-dismiss` y no vio los 5 «Cerrar» rojos que cierran por su propio
`@click`; el de G6 buscó `deasy-filter-btn` y no vio ni uno de home ni de perfil. Un botón no se
identifica por cómo está escrito — se identifica por **lo que su etiqueta dice que hace**.

El censo de `censo-funcional.mjs` recorre todo elemento pulsable (componente o `<button>` crudo),
le saca la etiqueta de `title` / `aria-label` / el texto del cuerpo, y clasifica por el **verbo**.
G3 pasa de 22 elementos a **62**. Los 14 no conformes, en tres familias:

| Familia | Cuántos | Qué pasaba |
|---|---|---|
| La etiqueta y la variante no dicen lo mismo | 6 | 5 dicen «Cancelar» y usaban `secondary`/`softNeutral`; 1 dice «Cerrar» y usaba `cancel` |
| La ✕ escrita a mano | 6 | `<button>` + `IconX` en notificaciones, dos paneles de grafo, dos alertas de auth y el chat |
| Copiar el botón en vez de usarlo | 2 | uno pega `deasy-btn deasy-btn--secondary` en un `<button>` crudo; otro reimplementa la caja entera en el `class-name` de un `variant="plain"` |

**G2 está limpio**, y eso también lo dice el censo: los tres únicos sitios que emiten acciones de
fila —`AdminTableActions`, `DossierDocumentActions`, `HomeSignatureEntry`— usan componente,
variante `soft*` y `icon-only`, sin una clase de estilo por fuera.

### Lo que destapó de paso, y NO es de G2 ni de G3

Ampliar el censo a **todo botón de solo icono** saca 60 fuera del componente, concentrados donde
la fase 3 aún no ha entrado. La familia grande es el **grafo**: `ProcessNode`, `UnitNode`,
`UnitEdge`, `ProcessConfigNode` y `ProcessTemplateNode` escriben el mismo botón con **tres nombres
de clase distintos** —`graph-node__btn`, `graph-icon-btn`, `graph-edge-btn`—. Detrás va
`FirmarPdf` con cuatro más, cada uno con su propio juego de utilidades.

Por la regla de §1-bis esto **no** se resuelve metiéndolos todos en `AppButton`: un botón sobre un
nodo del lienzo tiene una función propia (y una geometría propia, que es la razón de que exista
`graph-node__btn`). Lo que sí es defecto es que esa función esté escrita tres veces con tres
nombres. Es material de G10, no de aquí.

---

## §6 · G4 y G5 (2026-08-15)

### G4 · el navegador de contador, escrito cuatro veces

`AppCounterNavigator` **ya existía**, y aun así el mismo widget estaba copiado a mano tres veces
más: dos en `MultiSignerBatchStatusPanel` y dos en `MultiSignerPanel`. Eso no se arregla con
disciplina, porque al que copiaba le faltaba algo real y copiar salía más barato que ampliarlo:

| Faltaba | Quién lo necesitaba |
|---|---|
| `valueLabel` — leer un **estado** («Coordenadas compartidas») en vez de `n / total` | `MultiSignerBatchStatusPanel` navega modos, no números |
| `size="sm"` — 24 px en vez de 36 | el navegador superpuesto sobre la página del PDF |
| `tone="floating"` — desenfoque y sombra | sobre un PDF el fondo es variable y un borde de línea no se ve |
| `controls` — mostrar solo la lectura | el panel de lotes, cuando no hay campos |

⚠️ **Y una diferencia que no era de aspecto sino un defecto.** Las copias **ocultaban** las flechas
con `v-if` cuando no había a dónde ir; el componente las **deshabilita**. No es lo mismo: al
ocultarlas el widget cambia de ancho y **el contador salta de sitio** justo al llegar al primero o
al último, que es cuando el usuario está mirando. `controls: false` sigue existiendo para el caso
legítimo —un contador que de verdad no navega—, que es otra cosa.

### G5 · destructivo — y la lección de que el verbo no basta

El primer criterio marcó **50 elementos y 38 no conformes**, y estaba mal: incluía los 17
«Limpiar filtros». **Limpiar un filtro no destruye nada** — restablece una vista, y por eso es
`secondary` y está bien así. La distinción que importa no es el verbo sino qué se pierde:

> **Destructivo es lo que borra datos del servidor. Restablecer un control de la interfaz no lo es.**

Con eso: **19 destructivos reales**, 11 no conformes, ahora 13 de 14 conformes.

#### `BtnDelete` → `AppDeleteButton`

Cumple las **tres señales de §1-bis** igual que la ✕ —trae su propio contenido, no admite variante
ni tamaño, su papel es siempre el mismo—, así que **sobrevive como componente**. Lo que no
sobrevive es cómo estaba escrito: un `<svg>` de papelera pegado a mano en vez del `IconTrash` que
usa el resto del repo (dos papeleras distintas en la misma pantalla), un evento `@onpress` que no
comparte ningún otro componente, y un `className` que dejaba viajar estilo.

Y el fallo que demuestra que el contrato no estaba claro: `MultiSignerPanel` le pasaba
**`variant="softDanger"`, una prop que `BtnDelete` no declara**. Vue la deja caer como atributo
suelto en el `<button>` del DOM y no falla nada. `check-variants` no lo veía porque solo mira los
mapas de `AppButton` — es el mismo agujero que el gate cerró para `AppButton` en 3.2, abierto un
nivel más arriba.

#### La acción en línea — cuatro copias, dos tamaños, un hover inerte

«Quitar» y «Desvincular» aparecen cuatro veces como texto rojo diminuto dentro de una lista. Las
cuatro copias discrepaban en las **dos únicas** cosas que tenían: el tamaño (`text-[11px]` en tres,
`text-[0.7rem]` = 11.2 px en la cuarta — distintos de verdad, pero por 0.2 px, así que nadie lo
decidió) y el hover (`hover:underline` en tres, `hover:text-danger` en la cuarta, que sobre un
texto **que ya es** `text-danger` no hace absolutamente nada: uno de los cuatro no tenía
realimentación al pasar el ratón).

No es un `deasy-btn` ni debe serlo — el bloque base pone caja, borde, alto mínimo de 40 px y
sombra, y un modificador tendría que deshacer las cuatro. Bloque propio, `deasy-inline-action`,
como `deasy-tab` en §2-bis. Se queda el subrayado: sobre 11 px un cambio de color no se percibe, y
es además lo que WCAG pide cuando el color es el único distintivo.

#### El mismo botón dos veces en la misma pantalla

`FirmarPdf` llama a **`requestDeleteField(field.id)` desde dos botones distintos**: una papelera
flotante que aparece al pasar el ratón sobre el campo, y un botón con borde y texto «Eliminar» en
la lista lateral. Misma función exacta, dos aspectos sin relación. Ahora los dos son
`AppDeleteButton`.

### Lo que queda vivo a propósito

`UnitEdge` y `UnitGraphView` conservan `graph-edge-btn` y `graph-icon-btn`: son los botones del
**lienzo**, con geometría propia (24 px) y contexto propio. Por §1-bis no se fuerzan a `AppButton`.
Lo que sí se corrigió es que `graph-icon-btn` no tenía modificador destructivo mientras
`graph-edge-btn` sí, y por eso «Eliminar puesto» llevaba `text-muted hover:text-danger` sueltos en
el atributo — exactamente la pareja de utilidades que la clase ya intentaba resolver. Ahora existe
`graph-icon-btn--danger`. La unificación de los tres nombres del grafo sigue siendo material de G10.

---

## §7 · El censo por ESTRUCTURA — y por qué los tres anteriores fallaron igual (2026-08-15)

Cuatro veces se dio un grupo por cerrado y cuatro veces apareció una familia entera fuera. Siempre
el mismo error, cada vez con otra cara:

| Grupo | Se buscó por… | Qué se perdió |
|---|---|---|
| G3 | `data-modal-dismiss` | 5 «Cerrar» que cierran por su propio `@click` |
| G6 | `deasy-filter-btn` | todos los de home y de perfil |
| G2 | los ficheros donde yo sabía que había acciones de fila | **los paneles de los grafos** |
| G2 (2.º intento) | `<td>` | **cero resultados** — aquí las tablas se pintan por metadata y las listas de panel son `<ul>` |

El censo por función (§5-bis) corrigió los dos primeros y aun así **no habría encontrado el
tercero**: busca por el verbo de la etiqueta, y «Cambiar» o «Abrir» no son verbos de ningún grupo.

**La señal fiable no es el contenedor ni la etiqueta: es el `v-for`.**

> Un botón dentro de un `v-for` actúa sobre **un** elemento de una colección repetida. Eso *es*
> una acción de fila — de un `<tr>`, de un `<li>` de panel o de una tarjeta, da igual.

Con eso G2 pasa de 29 botones a **48**, con **21 no conformes** que ningún censo anterior vio.

### Los dos refinamientos que hicieron falta, y qué enseñan

1. **`v-for` en el propio botón ≠ `v-for` en un ancestro.** Si el `v-for` está en el botón, el
   botón **es** el elemento (una pestaña de `deasy-inline-tab`, un `deasy-nav-item`): eso es G7/G8.
   Si está en un ancestro, el botón es una **acción sobre** el elemento: eso es G2. Sin distinguirlo
   el censo marcaba 55 y mezclaba navegación con acción.
2. **`text-left` o `w-full` = el botón ocupa la fila entera.** Es el ítem seleccionable —un
   resultado de búsqueda de persona, un documento de la cola de firma—, no una acción dentro de él.

### Lo que salió, por familias

- **Seis enlaces de texto en la fila de una configuración** (`ProcessGraphView`): «Editar»,
  «Reglas», «Disparadores», «Plantillas», «Ver», «Lanzar», los seis con
  `font-semibold text-X hover:underline` a mano. Son el mismo objeto que el «Quitar» de G5, así que
  entran en `deasy-inline-action`, que estrena tres tonos.
- **La ✕ de una pastilla, escrita tres veces** — y las tres discrepaban en el hover: dos a
  `text-danger` y una a `text-icon`, o sea que **quitar un adjunto del chat no avisaba de que era
  destructivo**. Nace `deasy-chip-remove`, que no es `AppCloseButton` (36 px, cierra un diálogo) ni
  `AppDeleteButton` (trae caja): vive dentro de un chip de 24 px.
- **El botón verde de firmar, escrito dos veces para la misma acción**: `FirmarPdf` lo pintaba
  redondo con `p-1.5` y `MultiSignerPanel` cuadrado con `h-8 w-8 rounded-xl`, uno en
  `bg-emerald-500` y otro en `bg-emerald-500/88` con desenfoque. Nace `deasy-pdf-action`. **No sale
  de `AppButton` a propósito**, por el mismo motivo que los del lienzo del grafo: va encima de la
  página del PDF y el borde blanco es lo único que lo separa del papel.
- Cinco más con caja propia que sí eran `AppButton` sin saberlo.

### Y esta vez queda atornillado

`frontend/scripts/check-row-actions.mjs`, encadenado a `lint`, **con techo 0**. Probado en rojo
(devolviendo un botón a sus utilidades → exit 1) y en verde al revertir. Es el décimo gate.

**Sin esto, G2 se vuelve a abrir en silencio**, que es exactamente lo que pasó entre el 14 y el 15
de agosto sin que ningún gate dijera nada — lo vio el dueño mirando la pantalla.

---

## §8 · G6 por estructura — y lo que enseña que su señal sea otra (2026-08-15)

G6 se cerró el 14-08 buscando `deasy-filter-btn`, y esa búsqueda **no vio ni uno de home ni de
perfil**: la clase acababa de morir justo ahí. Mismo error que dejó G2 abierto, así que se recensa
igual — por dónde vive el botón, no por cómo está escrito.

**Pero su señal no puede ser el `v-for`.** Un botón de filtro no se repite: hay uno por zona de
filtros. La suya es el **contenedor**:

> Un botón dentro de `deasy-filter-shell`, `-toolbar`, `-field`, `-search-row`, `-actions` o
> `-grid` filtra, se llame como se llame. Y para lo que vive fuera de una shell —el organigrama
> tiene su barra suelta— la segunda señal es el manejador: `resetXFilters`, `clearXFilters`,
> `applyFilters`, `searchAndCenter`.

⚠️ **Tres falsos amigos descartados a propósito**, y los tres empiezan por «clear»: `clearToast`
cierra una alerta (G3), `clearQueue` borra la cola de firma (G5) y `closeTaskFiltersModal` cierra un
diálogo (G3). Ninguno filtra nada. Buscar por prefijo de nombre habría metido los tres.

**Resultado: 28 botones, 4 no conformes** — bastante mejor que G2, que tenía 21. Y el hallazgo
interesante no es el número: **los cuatro resultaron no ser botones**.

### Los cuatro eran controles de formulario disfrazados de `<button>`

| Dónde | Qué era | A dónde va |
|---|---|---|
| `AdminFkBrowserModal:152` | un `role="switch"` de **13 líneas escrito a mano** | **`SToggle`, que ya existía en el repo** |
| `HomeView:80` | el disparador de un desplegable multiselect | `deasy-filter-control--trigger` |
| `HomeView:93` y `:104` | dos opciones de ese desplegable | `deasy-option` |

El del switch es el que más duele: `SToggle` lleva en el repo desde antes de esta vuelta y ya lo
usan el wizard de procesos y el editor de borradores. La copia tenía **36 px de ancho frente a los
44 del componente** y **`blue-light-600` como color activo en vez de `primary`**, o sea que el
mismo interruptor se veía de dos tamaños y dos azules según la pantalla.

Y las dos opciones discrepaban en peso y color —`font-medium text-icon` para cada proceso,
`font-semibold text-body` para el «Todos» de arriba—. Esa diferencia **sí era intencionada**: el
«Todos» manda sobre la lista. Se queda, pero como `deasy-option--strong`, no como nueve utilidades
repetidas.

### La lección, que ya va por tres

`v-for` para G2, contenedor para G6. **La señal estructural existe siempre, pero es distinta en cada
grupo**, y encontrarla es el trabajo. Lo que se repite es el error de no buscarla: mirar por dónde
sabes que hay algo encuentra lo que ya sabías.

Gate: `frontend/scripts/check-filter-actions.mjs`, techo 0, probado en rojo. Es el **undécimo**.

---

## §9 · G3 por estructura — y la tercera señal (2026-08-15)

G3 se había censado **dos veces**: por `data-modal-dismiss` (perdió 5) y por función (encontró 14
huecos más). El segundo fue el que arregló el grupo, pero seguía dependiendo de que alguien
**escribiera** «Cerrar» o «Cancelar». Un botón que ponga «Volver», «Listo» o «Ahora no» cierra
igual, y ninguno de los dos censos lo habría visto.

Ni el `v-for` de G2 ni el contenedor de G6 sirven aquí: un botón de cerrar **no se repite** y vive
en cualquier sitio —un modal, una alerta, un panel lateral, el chat—. Su señal es lo que le **hace**
al contenedor:

> **Un botón es de cierre cuando su acción hace desaparecer aquello en lo que vive.**

Y eso se lee en el `@click`: emitir `close`/`cancel`/`dismiss`, poner a `null` o `false` la variable
que abre el contenedor, llamar a un `closeX()` / `dismissX()` / `hideX()`, o vaciar a `""` el mensaje
de una alerta.

### 63 botones, 0 no conformes — y por qué eso no es suerte

Un verde a la primera es sospechoso, así que se comprobó al revés: **¿ve el censo algo que el
anterior no veía?** Sí — **10 de los 63 no tienen ningún verbo de cierre en la etiqueta**:

- **«Ahora no»** (`AdminDefinitionCreatedPromptModal`) y **«Aplicar»** (`HomeView`). El segundo
  llama **al mismo manejador que el «Cerrar»** de al lado: los filtros se aplican en vivo, así que
  «Aplicar» no aplica nada, solo cierra. Es correcto que sea `primary` —es la confirmación— pero
  es un botón de cierre y ningún censo por etiqueta lo habría clasificado.
- **Siete ✕ sin etiqueta visible**, en los dos armazones (`AppDialogOverlay`, `AppFormModalLayout`),
  los dos paneles de grafo, el visor de PDF y el toast de admin.
- Y el `{{ cancelLabel }}` de `AdminFormActions`, cuya etiqueta **es una variable**: por definición
  ningún censo de texto puede leerla.

El gate se probó en rojo **por dos vías distintas** —devolviendo una ✕ a `<button>` crudo, y
pintando de `cancel` un «Cerrar»— y en verde al revertir ambas.

### Las tres señales, juntas

| Grupo | Señal estructural | Por qué esa |
|---|---|---|
| **G2** · acción de fila | está **dentro de un `v-for`** | actúa sobre un elemento de una colección |
| **G6** · filtro | está **dentro de `deasy-filter-*`** | no se repite: hay uno por zona de filtros |
| **G3** · cerrar | **hace desaparecer su contenedor** | no se repite y vive en cualquier sitio |

**La señal estructural existe siempre, pero es distinta en cada grupo, y encontrarla es el
trabajo.** Los tres grupos que se cerraron «a ojo» estaban mal contados: **29→48, 23→28, 26→63**.

---

## §10 · G4 y G5 por estructura — las cinco señales, completas (2026-08-15)

### G4 · mueve un índice

Un botón de paginación lleva de un elemento al siguiente de una secuencia ordenada — página 3 de
12, paso 2 de 5, documento 4 de 9. Eso se ve en el `@click`: `prevX`/`nextX`, `goToPage`, o un
`++`/`--` sobre el índice.

Aquí caen **dos cosas que parecen distintas y no lo son**: el navegador de páginas de un PDF y el
«Atrás»/«Siguiente» de un wizard. Las dos mueven un índice; lo que cambia es el destino —una usa
`AppCounterNavigator` (el widget con la lectura en medio) y la otra `AppButton`, porque un wizard
no muestra «2 / 5» dentro del propio botón—.

**14 botones, 3 no conformes.** Los dos «Atrás»/«Siguiente» del arranque llevaban `w-auto px-5` y
`w-auto px-6`: **dos paddings distintos en la misma barra**, así que los dos botones que van uno a
cada lado no medían lo mismo. Nace `deasy-auth-button--compact` — que **no prejuzga G9**: la familia
`deasy-auth-button` sigue pendiente de decidir si muere, y lo único que hace el modificador es sacar
el estilo del atributo.

⚠️ Y un **falso positivo que enseña**: `goToLogin` casaba con `goTo`. Navegar a una **ruta** no es
mover un índice, y el censo se afinó a `goToPage|Step|Slide|Index|Item`. Pero el botón que destapó
tenía un defecto real: era un `AppButton` **sin variante**, o sea que salía sin color.

### G5 · invoca un borrado

El censo por función de G5 empezó marcando 38 no conformes y **estaba mal**: contaba los 17
«Limpiar filtros». El verbo de la etiqueta no distingue *borrar* de *restablecer*; lo que el
`@click` invoca, sí.

🪤 **Buscar el verbo solo como prefijo perdía 5 de 19.** Los botones que confirman o envuelven se
llaman `requestDeleteField`, `handleAttachmentDelete`, `confirmDeleteEdge` — el verbo va **en medio**.
Con la señal corregida: **27 botones**.

Y salió el hallazgo que cierra el círculo: **el gemelo rojo de `deasy-pdf-action`**. `SignatureBox`
tenía la receta entera copiada otra vez —`h-8 w-8 rounded-xl`, `border-white/80`, `shadow-md`,
`backdrop-blur-sm`, `active:scale-95`— cambiando solo `emerald` por `rose`. **El censo de G2 no lo
vio porque ese botón no vive en un `v-for`**: hizo falta la señal de G5 para que apareciera. Es la
prueba de que las señales no se solapan y de que cada grupo necesita la suya.

Dos decisiones que quedaron escritas en el gate, para que nadie las «corrija»:

- **El ámbar cuenta como aviso destructivo.** «Eliminar solo PDF» va en `softWarning` a propósito:
  distingue borrar el PDF —conservando el registro del entregable— de borrar el entregable entero,
  que está al lado en rojo. Los dos destruyen; uno destruye menos.
- **`showDeleteModal = false` no es destructivo**: cancela el borrado. La palabra «Delete» está en
  el nombre de la variable, no en la acción. Eso es G3.

### Las cinco señales

| Grupo | Señal estructural | Nº |
|---|---|--:|
| **G2** · acción de fila | está dentro de un **`v-for`** | 48 |
| **G3** · cerrar | **hace desaparecer su contenedor** | 63 |
| **G4** · paginación | **mueve un índice** | 14 |
| **G5** · destructivo | **invoca un borrado** | 27 |
| **G6** · filtro | está dentro de **`deasy-filter-*`** | 28 |

**El inventario original contaba mal en los cinco: 29→48, 23→28, 26→63, 26→14, 23→27.** No por
descuido al contar, sino porque contar «botones que se parecen» no es contar «botones que hacen lo
mismo». Los cinco tienen ya gate de techo 0.
