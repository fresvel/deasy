# Bitácora — Sistema de diseño, tercera vuelta

> Se escribe **al ejecutar**, no antes. Cada entrada con lo que se midió, no con lo que se supuso.
>
> La de la segunda vuelta está en
> [`docs-md-antiguos/planes-cerrados-2026-08/sistema-diseno-plantillas/bitacora.md`](../../docs-md-antiguos/planes-cerrados-2026-08/sistema-diseno-plantillas/bitacora.md)
> y **sigue valiendo**: es donde están las trampas ya pagadas.

## 2026-08-15 · F3.3 cerrada — el estado deja de vivir en JavaScript

**Lo que el enunciado prometía:** «el estado de grafo — 73 de los 201 colores restantes», ocho
ficheros repitiendo el trío `emerald/amber/rose`.

**Lo que había al medir**, y por eso el enunciado no sobrevivió a la primera hora:

- `ProcessConfigNode` —uno de los ocho— **no contenía ni un `emerald-50`**: ya estaba migrado.
- `rose` casi nunca significaba «retirado»: **en un solo sitio** del repo.
- No eran 3 estados sino **27 valores en 8 ejes**, en más de 20 ficheros.
- Y lo grave: **el color no vivía en el CSS sino en ~20 funciones de JavaScript** que devolvían
  cadenas de utilidades. Los diecisiete gates eran ciegos a todas ellas.

**La consecuencia medible de esa ceguera:** `processStatusClass` y `configStatusClass` leían **el
mismo campo de la misma tabla** y pintaban `draft` y `retired` **al revés una de otra**. Llevaba
meses así.

### El corte que ordenó todo, en una frase

> Si la función pregunta por los **datos**, se queda. Si pregunta por el **color**, se va. Entre las
> dos está el **nombre del tono**, y ése es el contrato.

De ahí `shared/utils/estadoTono.js` (precedente exacto del repo: `workspaceNavIcons.js`).

### Resultado

| | |
|---|---|
| Colores fuera de la paleta | **201 → 42** |
| Hex sueltos | 14 → **5** |
| Valores arbitrarios | 326 → **302** |
| Tests | 316 → **339** |
| Gates | 17 → **18** (`check-state-tone`) |

### Las siete cosas que costaron caro y no se pueden deducir leyendo el plan

1. **Un `}` mal contado dejó un bloque entero sin pintar.** `graph-node__badge` se añadió con un
   script que quitó la última llave dando por hecho que cerraba `@layer components`; cerraba otra
   regla, y las tres del contador quedaron **anidadas dentro** de un selector imposible. `css-prune`
   y `check-orphan-classes` daban verde. Nació `check-selector-reach`, y **su señal se acertó a la
   tercera**: por clase daba verde (el `:hover` sí alcanzaba) y por ancestro daba 20 falsos
   positivos. La buena es el anidamiento **en el fuente**.
2. **Un gate no puede ver un `:variant` dinámico.** En L3 la variable del tono no llegó a crearse en
   `ProcessTemplateNode` y **todas las pastillas de versión salieron azules**. Ningún gate podía
   cazarlo. Lo cazó mirar la pantalla.
3. **Las pastillas del nodo tienen ancho fijo y nadie avisa.** Al subir de 10 a 12 px, una salió a
   **181 px dentro de un nodo de 170**. Y el reparto estaba escrito con anchos mágicos
   (`max-w-[9.5rem]`), así que cedía la pastilla en vez del título. Lo vio el dueño.
4. **`--muted` murió en L1 pero dos productores seguían devolviéndolo**, y eso ya estaba roto:
   caían al *fallback* de `AppTag` avisando por consola. Invisible para `check-variants`, que lee
   atributos literales. Hoy lo cubre un test del vocabulario.
5. **Los hex sueltos del estado «pendiente» eran salmón literal.** `#fa8072` **es** el color
   `salmon` de CSS, y el sistema ya tenía ese tono en `--color-pending`. No hacía falta inventar
   nada: hacía falta reconocerlo.
6. **El eje `--solid` de `deasy-icon-box` estaba a medias** —sólo `primary` e `info`—, así que pedir
   `--solid --success` daba blanco sobre relleno `-50`: invisible. Al completarlo salió la regla que
   faltaba: **el sólido se ancla al paso que le sirve a SU contenido**; un número encima pide 4.5:1
   y un ✓ pide 3:1.
7. **El gate encontró lo que el que migró no pensó en mirar.** `check-state-tone`, en su primera
   pasada, sacó `getFillStepCardClass`/`getFillStepAccentClass`: las **gemelas exactas** de las dos
   de firma que sí se habían migrado, con la misma forma y los mismos degradados. El censo de L6 no
   las vio porque su nombre no decía «signature». Por eso el bloque se llama `deasy-flow-step` y no
   `deasy-signature-step`.

### 🪤 Y una del instrumental, que costó estar a punto de «arreglar» algo que ya estaba bien

`deasy-alert--row` daba `display:block` en el navegador estando `display:flex` en el fuente **y en
el CSS construido**. No era el CSS: era el **HMR de Vite sirviendo una versión anterior** del
fichero. La señal que lo distingue es que las reglas escritas *antes* en la misma sesión sí aplican
y sólo falta la última. Se confirma con un `grep` al `dist` y se cura con `restart frontend`. Queda
escrito en `frontend/CLAUDE.md`, y volvió a pasar en L7 — ya con la receta, costó un minuto.

### Lo que se dejó fuera a propósito

No todo color es estado, y meterlo en el diccionario habría sido peor que dejarlo:

- **`STEP_TONES`** de `AdminDraftArtifactModal`: decoración cíclica por índice. No hay valor que traducir.
- **El medidor de fuerza de contraseña**: una **escala**, no un eje de estado.
- **Los degradados decorativos** de las tarjetas de proceso y los desenfoques de `FirmarPdf`.
- **Los 8 banners informativos** que quedan en el techo de S1: son `AppAlert` sin propagar, o sea
  **F2**, no F3.3. Meterlos aquí habría sido hacer otra fase dentro de ésta.

---

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

## 2026-08-14 · Fase 0 — cerrar los gates. Y lo que apareció al abrirlos

Worktree `deasy-diseno3`, rama `feat/sistema-diseno-v3`, **pila B**. La A se dejó intacta sobre
`develop` a propósito: es el baseline A/B de las fases 2 en adelante.

**Antes de tocar nada** se remidió, y el plan aguantó salvo en dos cifras: `HomeView` **5 130** L y
`FirmarPdf` **2 890** (el plan decía 5 215 y 2 944). Los cuatro gates daban verde y `lint:css` daba
verde **con tres avisos**, que es la forma exacta del problema: la regla estaba escrita en
`severity: "warning"` y además ningún workflow la invocaba.

### Los tres `!important` eran huérfanos — incluido el que el plan daba por vivo

El plan (§1.1) marcaba `dialogs.css:238` como «vivo y justificado». **No lo es**, y el motivo enseña
más que el arreglo:

| dónde | contra qué decía pelear | qué se midió |
|---|---|---|
| `overrides.css:59` | el `.border-slate-*` del bloque (A) | (A) es **solo comentarios** desde el 13-08: ni una regla |
| `dialogs.css:81` | el `.border-slate-200 !important` de `overrides.css` | esa regla se borró el 13-08 con sus 54 consumidores |
| `dialogs.css:238` | `.admin-typography h5` (0,1,1) gana a (0,1,0) | **la comparación de especificidad ya no aplica**: esa regla bajó a `@layer base` el 13-08, y `components` va después — gana sin ella |

> **La lección: un comentario que compara ESPECIFICIDADES caduca en silencio el día que una de las
> dos reglas cambia de CAPA.** El propio `base.css:49-53` documentaba la bajada y decía que con ella
> «deja de haber conflicto». Nadie volvió a `dialogs.css` a cobrarlo.

Y el tercero no se retiró por eso solo: `.process-dialog-content .deasy-dialog-title` (0,2,0) declara
`font-weight: 400` y **sí** le ganaría. No alcanza ningún nodo, porque `AdminEditorModal` usa
`AppModalShell` sin sobreescribir el slot `header` y todo título nace dentro de
`.deasy-dialog-header`, donde la regla (0,3,0) repone el 600. **Comprobar el adversario que el
comentario nombra no basta: hay que buscar los que no nombra.**

Verificación: **diff del CSS construido**, partido por reglas. 2 591 reglas antes y después, y el
diff son **exactamente 3 líneas**, cada una perdiendo su `!important`. 30 bytes.

### El gate de clases huérfanas tenía DOS agujeros, no uno

El plan describía el del regex (`(?<![:@\w-])class="` excluye el `-` de `table-class`). Al taparlo
salieron los 8 `admin-data-table` anunciados… y nada más. El segundo agujero es **la lista de
prefijos**, que es la que decide qué nombres son «nuestros»: `person-` no estaba, así que
**6 clases más en 16 usos** eran invisibles aunque el regex fuera perfecto — toda la familia
`person-assignment-*`, restos del `AdminTableManager.css` que se borró (§6.3: 604 líneas, 0 de 86
reglas aplicaban).

**Las dos listas —`PREFIJOS` y `selector-class-pattern`— describen lo mismo desde los dos lados y
habían divergido.** Ahora están alineadas.

> ⚠️ **Y queda un agujero que NO se ha cerrado, escrito aquí para que no se redescubra:** una clase
> propia inventada con un prefijo nuevo sigue siendo invisible, porque **por prefijo no hay forma de
> distinguirla de una utilidad de Tailwind**. La única fuente que sabe la diferencia es el **CSS
> construido** —Tailwind emite ahí toda utilidad que genera—, y usarlo ataría `lint` a un `build`
> previo. Es una decisión de coste, no de código, y está sin tomar.

Las 24 clases se borraron **por script y a nivel de token**, no de atributo (trampa 2 de la vuelta
anterior). Diff limpio, 316/316 tests, y **cero diferencias en el CSS construido**: era la prueba de
que no pintaban nada.

### `contraste.mjs` no estaba «solo sin enganchar»: estaba fosilizado

El plan (§0.4) decía que define el criterio de aceptación y que no lo invoca nadie. Al ir a
engancharlo apareció lo otro: **llevaba los hex de los tokens copiados a mano**, y el 13-08 los
tokens se reanclaron a las primitivas de TailAdmin sin actualizar la copia.

**17 de 21 tokens tenían un valor que ya no existe en el proyecto.** `primary` decía `#5e4eff` con el
sistema en `#465fff`; `step-ink`, `#108353` por `#027a48`. Es el mismo fallo que `frontend/CLAUDE.md`
§2.1 describe para los tripletes `-rgb` —una copia no se entera de que el original se movió— pero en
la herramienta que **decide si un color es aceptable**.

Consecuencia práctica: **daba por roto lo que ya estaba arreglado.** Reportaba `info` en 4.02 (falla)
cuando el reanclaje a `blue-light-700` lo había dejado en **5.86**. Los fallos reales de hoy son
**cuatro**: `accent` 2.64 (y pinta *todos* los `<a>` por la regla sin capa de `base.css`) y los tres
`line-*` en 1.24/1.47/1.47.

> **La lección: antes de enganchar una herramienta a una puerta, comprueba que mide lo que hay.**
> Un gate que corre sobre datos fósiles no es un gate a medias: es peor que ninguno, porque su verde
> tiene autoridad.

Ahora **lee `tokens.css`** y resuelve la cadena de alias, así que no puede volver a derivar. Y falla
si aparece un token semántico sin clasificar o una fila sin token — que es lo que hace cierto el
«ningún token nuevo se escapa».

El modo `--gate` es un **trinquete**, no un aprobado: los cuatro que fallan no se arreglan en un
lint (los `line-*` son el borde de 228 controles, y `accent` repinta todos los enlaces; fases 5 y 6).
El criterio es el del §3: *contraste_después ≥ contraste_antes*.

**Y se probó en rojo antes de darlo por bueno**: bajando `--color-muted` a `gray-400`, el gate sale
con 1 y nombra las dos infracciones. Revertido.

> **Un gate que nunca se ha visto fallar no está probado.** Es la forma general de lo que esta vuelta
> descubrió: cuatro puertas en verde, tres rotas.

### La decisión que cerró la fase: la verdad la da el CSS construido

El gate de huérfanas **adivinaba**. Decidía si una clase era «nuestra» por su prefijo, con una lista
a mano, y todo lo demás lo daba por utilidad de Tailwind. Ese diseño tiene el fallo dentro: la lista
se queda corta sola.

Se midió el coste de la alternativa antes de decidir, y resultó ser el argumento: **el build tarda
2,6 s** y la cadena entera de gates **7,3 s**. La opción exacta salía prácticamente gratis. Decisión
del usuario: `pnpm run lint` construye primero y los gates leen `dist/assets/*.css`.

Lo que apareció al mirar ahí, con la lista de prefijos ya retirada — **17 clases más, en 39 usos**,
donde el gate anterior veía **cero**:

| qué | dónde | qué era |
|---|---|---|
| `animate-fade-in` | 8 usos, 3 ficheros | **una animación que nunca existió**: ni `@keyframes` ni token `--animate-*` en todo el árbol |
| `d-inline-flex`, `align-items-center` | `DossierDocumentActions` | **Bootstrap**, sobrevivido a la migración |
| `btn-inner` | `AppButton` y `AdminButton` | envoltorio con nombre y sin regla |
| `fk-*` (10) · `definition-*` (8) · `is-viewer` · `deliverable-inline-upload` | 6 modales | restos de hojas `scoped` borradas |

Nada de esto es una clase «propia mal escrita»: son **utilidades inventadas o de otro framework**, y
por definición ninguna lista de prefijos nuestra las iba a ver.

Tres cosas hubo que resolver para que el gate no mintiera, y las tres valen para el próximo:

1. **En el CSS emitido los nombres van escapados de DOS formas.** La conocida es la barra (`\/`,
   `\:`, `\.`). La que no se ve venir es el **escape hexadecimal con espacio final**: un
   identificador CSS no puede empezar por dígito, así que una utilidad con prefijo de punto de
   ruptura sale como `\32 xl\:…`, con el `2` codificado **y un espacio que forma parte del escape**.
   Leerlo como escape normal parte el nombre justo ahí y declara huérfana una clase viva.
2. **Hay clases que no pintan a propósito y es correcto.** `nodrag`/`nopan` son la **API de Vue
   Flow** —comportamiento, no aspecto— y `group`/`peer` son marcadores de Tailwind cuyo contenedor
   no genera regla. Van excluidas con su motivo, no por conveniencia.
3. **Un gate no debe leer la documentación como uso.** `AppButton` explica en prosa, dentro de su
   `<script>`, que una variante desconocida acababa estampada como clase literal — y escribe el
   atributo tal cual. El gate acusó a dos clases que nadie escribe. Ahora sólo mira el markup.

Y una guarda que no es opcional: **un `dist/` rancio daría un verde falso**, midiendo el árbol de
antes de tu cambio. El gate compara la fecha del CSS emitido con la del fuente más nuevo y se niega.
Probado en rojo.

### 🪤 Y la trampa del repo me la comí entera, con la advertencia delante

La bitácora de la vuelta anterior avisa: **Tailwind escanea también los `.mjs` de `scripts/`**, y el
primer `check-orphan-classes.mjs` citó tres utilidades en un comentario y las tres acabaron emitidas.
Escribí esa misma advertencia en un comentario nuevo **y caí igual**, de dos formas:

- El gate de colores lleva las propiedades que pintan en un **array de cadenas**. Dos de ellas son
  utilidades válidas por sí solas, y Tailwind emitió sus reglas con su `@property` detrás.
- Otro comentario citaba un escalón tipográfico **que no usa nadie**, dándole un consumidor falso
  justo cuando el plan iba a medir si sobraba.

> **La norma «documenta la clase, no la escribas» no basta: depende de acordarse, y un array de
> configuración no es prosa.** El arreglo es estructural — `@source not "../../../scripts"` en
> `tokens.css` —, y a partir de ahí lo que se escriba en un script no puede inventar CSS.

Y al aplicarlo apareció lo que llevaba ahí sin que nadie lo viera: **dos reglas fantasma vivas en
producción**, `.rounded-\[…\]` y `.text-\[…\]`, con el valor literal `…`. Las generó Tailwind a
partir de los **puntos suspensivos** de un comentario que hablaba de esas familias.

**El diff del CSS construido de toda la fase 0 son 8 líneas**: 3 reglas que pierden su `!important`
y estas 2 que desaparecen. Las 39 clases borradas de las plantillas **no movieron un solo byte**, que
es exactamente la prueba de que no pintaban nada.

### `check-no-arbitrary`: el techo subió una vez, y por qué está bien

Abrir los `.css` añade **42** valores arbitrarios que nadie contaba, dentro de los `@apply` del
propio sistema de diseño: **cinco radios distintos** y **once tamaños de texto**, con `tables.css`
escribiendo `text-[12px]` mientras `misc.css` usa `text-theme-xs`. El techo pasa de 374 a 416 **por
ampliación de alcance, no por deuda nueva**, y queda escrito en el fichero. A partir de ahí, solo
baja; bajarlo es la fase 5.

Detalle que costaría un contador falso: **en un `.css` hay que quitar los comentarios antes de
contar.** Estos módulos se documentan citando las clases de las que hablan, y esas citas ni son usos
ni bajarían nunca al arreglar el código. El plan decía 51; medido sin comentarios son 42.

---

## 2026-08-14 · Fase 1 — borrar lo que ya no pelea

**El patrón de la fase, en una frase: de nueve afirmaciones del plan, tres eran falsas y una era
peligrosa.** Remedir antes de borrar no es burocracia; aquí evitó romper tres formularios.

| El plan decía | Lo medido |
|---|---|
| «`SInput.vue` — 0 usos» | **3 importadores** (`AgregarCapacitacion`, `AgregarCertificacion`, `AgregarTitulo`) y test propio. **Borrarlo rompe el dossier** |
| «`deasy-alert--info`, la única clase muerta de verdad» | `AppAlert.vue:2` la compone en runtime: está cableada. Lo muerto es la **variante**, no la clase |
| «`dialogs.css:238` vivo y justificado» | Huérfano (ver la entrada de la fase 0) |
| «`FirmarPdf` conserva su `border-slate-200` sin migrar» | Ya migrado, y **0 `slate-200` en todo el árbol** |

Ese último tiene una lección propia. El comentario que documentaba la excepción decía
«`border-line` SIN MIGRAR a proposito» — una frase sin sentido. Lo que paso es que **un rename
masivo entro dentro del comentario** y sustituyo ahí el nombre viejo, dejando la explicación
diciendo lo contrario de lo que significaba. Es la trampa 6.6 del `CLAUDE.md` del frontend vista
desde otro lado: no solo hay que no tocar la línea que DECLARA algo — tampoco la que lo EXPLICA.

### Lo que sí se fue, y lo que destapó

**El fork `AdminButton.vue`** (88 L, **un** importador). No era duplicación inocente: se quedó sin
recibir tres arreglos que su hermano sí tuvo —dos regresiones de contraste a **3.65:1**, el bug de
la variante desconocida estampada como clase literal, y el `px-3 py-2` que gana al `p-0` del botón
de icono—. Con él, **los 11 modificadores `admin-btn--*`**, que `buttons.css` declaraba en la misma
lista de selectores que su gemelo `deasy-btn--*`: dos nombres para una regla.

Cuatro de esos strings eran peores que redundantes: **`admin-btn--icon`, `--sm`, `--lg` y
`person-assignment-menu-btn` no los declaraba ningún CSS**. Llevaban meses viajando al DOM sin
pintar.

> 🪤 **Y ningún gate podía verlos, incluido el que acabo de escribir.** Los gates leen atributos
> `class` del **markup**; estos viven en un **mapa de JavaScript**. Es el punto ciego que queda:
> una clase escrita en un `.js` no la mira nadie. La forma de cerrarlo sin falsos positivos está
> anotada abajo.

**Y borrarlo desbloqueó medio F6.** `buttons.css` documentaba **dos** motivos por los que los 12
botones de acción no pueden bajar de capa. El segundo era, literalmente, que `AdminButton` estampaba
utilidades crudas. Ese componente ya no existe: queda un blocker, no dos.

### El gate nuevo falló a las dos horas de escribirlo, y el fallo es instructivo

Al retirar la familia `admin-btn--*` **documenté la retirada nombrándola** en un comentario del
componente que la escribía. `css-prune` leyó ese comentario como un USO, y dejó pasar seis reglas
que acababan de quedarse muertas en `overrides.css`. Las encontró un `grep` a mano.

Es la misma forma que la trampa de Tailwind escaneando los `.mjs`, pero con una diferencia que
importa: **ahí la salida es «no escribas la clase», y aquí no puede serlo** — explicar por qué
borraste algo es exactamente lo que hay que hacer. Así que quien tiene que aprender a distinguir
documentación de uso es el script. Ahora `css-prune` quita los comentarios del código antes de
buscar, y al hacerlo apareció una tercera regla muerta que nadie había contado: `deasy-fa-icon`,
escondida detrás de otro comentario que la nombraba.

### Y un bug mío, cazado por el diff del CSS construido

El script que retiró los selectores gemelos dejó **tres `:hover:hover`**: casó `,\n .admin-btn--X`
y abandonó el `:hover` pegado al selector anterior. No cambia el aspecto —`:hover:hover` se
comporta igual— pero **sube la especificidad de (0,2,0) a (0,3,0)**, que es justo la clase de
cambio invisible que arruina una comparación posterior.

**No lo vio el lint, ni los 316 tests, ni el navegador.** Lo vio el diff del CSS emitido, que es
para lo que existe el criterio de esta fase.

Resultado final: **15 reglas menos, 75 líneas de diff, y las 75 explicadas** — los gemelos
retirados, las utilidades crudas del fork borrado, los dos anillos que no pintaban, la regla sin
nodo, y dos primitivas (`red-600`, `red-700`) que Tailwind deja de emitir porque ya no las
referencia nadie.

### Los tres `slate-100`: el plan y la norma decían cosas contrarias, y lo resolvió una medida

El plan mandaba borrarlos («las últimas tres apariciones de `slate`»). `frontend/CLAUDE.md` §8 decía
mantenerlos, con un motivo bueno: eran un **segundo escalón de superficie que la paleta no
declaraba**, y colapsarlos sobre `--color-surface` (ΔE 1.29) mataría el *hover* de
`.deasy-btn--soft-neutral`. La regla era «sin escalón declarado no se inventa uno».

**Lo que ninguno de los dos tenía en cuenta es que el escalón ya está declarado**: al adoptar
TailAdmin entró `gray-100` en `@theme`. `slate-100` es `#f1f5f9` y `gray-100` es `#f2f4f7` —
**Δcontraste +0.01**. Migrados los tres, y el diff del CSS son exactamente tres reglas.

> **Cuando un plan y una norma se contradicen, casi siempre es que una de las dos se escribió antes
> de un cambio que las afecta a las dos.** No hay que elegir bando: hay que buscar qué cambió.

### 🪤 Y la trampa, por TERCERA vez — ahora en el propio fichero de normas

Migrados los tres, `slate` **seguía en el CSS de producción**: cuatro utilidades
(`.bg-slate-50/100/200`, `.border-slate-200`) con sus primitivas detrás, sin que **una sola
plantilla las escribiera**. Búsqueda exhaustiva en `src/`: cero.

El origen es **`frontend/CLAUDE.md`** — el fichero que contiene, literalmente, la frase «si
documentas una clase, descríbela; no la escribas». Las nombra al explicar por qué se retiraron, y
Tailwind escanea los `.md`. **La documentación de un borrado impidiendo el borrado.**

Dos cosas se midieron antes de arreglarlo, y las dos ahorran trabajo al siguiente:

1. **`@source not` no puede excluir un `.css` del propio grafo de la hoja.** Se probó con ruta de
   directorio y con glob: ninguna de las dos formas cambia nada.
2. **Los comentarios de los `.css` NO generan utilidades.** Comprobado escribiendo una clase inédita
   en un comentario de `misc.css` y midiendo el build: no se emitió. Así que **dentro del CSS del
   sistema sí se pueden nombrar las clases**, que es donde más falta hace. Antes de saberlo se
   habían neutralizado 11 nombres en comentarios «por si acaso»; se restauraron todos.

El corte definitivo es una línea en `tokens.css`: `@source not "../../../**/*.md"`. Tras ella,
**cero** rastro de la paleta `slate` de Tailwind en el CSS servido. Lo único que queda con esa
cadena son `.deasy-nav-glyph--slate` —modificador BEM **nuestro**, el único tono real de
navegación— y `.prose-slate`, del plugin de tipografía.

> ⚠️ **Y una lección de instrumental, pagada en el momento:** para revertir una prueba temporal se
> usó `git checkout -- misc.css`, y **se llevó por delante un cambio bueno del mismo fichero**. En
> un árbol con trabajo sin commitear, `git checkout` de un fichero no es «deshacer lo último»: es
> «tirar TODO lo que ese fichero tenga sin guardar». Se detectó al releer el fichero, no por el
> lint — ningún gate ve que un cambio correcto haya desaparecido.

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
