# Bitácora — Sistema de diseño, tercera vuelta

> Se escribe **al ejecutar**, no antes. Cada entrada con lo que se midió, no con lo que se supuso.
>
> La de la segunda vuelta está en
> [`docs-md-antiguos/planes-cerrados-2026-08/sistema-diseno-plantillas/bitacora.md`](../../docs-md-antiguos/planes-cerrados-2026-08/sistema-diseno-plantillas/bitacora.md)
> y **sigue valiendo**: es donde están las trampas ya pagadas.

## 2026-08-20 · F9.B y F9.C — las pastillas, y las cinco trampas que dejaron

Arrancó con una pregunta del dueño: *«toda columna estado debe ser pastilla, y conviene que toda
pastilla se administre desde una misma clase CSS con variantes, `deasy-pastilla-xxx-yyy`»*.

**La mitad buena ya existía y la otra mitad iba al sitio equivocado.** El color de las pastillas
vive desde F3.3 en un solo lugar: ocho clases `deasy-tag--<tono>`. Lo disperso era el paso
anterior —*qué valor merece qué tono*—, y eso es negocio, no color: llevarlo al CSS habría metido
las tablas en la hoja de estilos, multiplicado 8 clases por ~20 ejes con el cuerpo idéntico, y
roto `check-variants.mjs`, que valida contra un mapa cerrado.

### 1 · «Migrado» significaba «migrado en admin»

F3.3 se cerró como *«un solo diccionario de color para todo el repo»*. Medido hoy: **los 12
consumidores de `estadoTono.js` eran los doce de `modules/admin/`**, y `modules/home/` mantenía
nueve traductores propios. El enunciado decía «todo el repo» y el trabajo cubrió un módulo.

**→ Al cerrar una fase de alcance «todo el repo», el criterio de cierre es un CENSO de
consumidores, no la lista de ficheros tocados.**

### 2 · No eran copias: se contradecían, y en cuatro valores

Lo caro no era la duplicación sino que **el mismo valor salía con dos colores** según qué función
lo tradujera: `pendiente` (warning vs salmon), `en proceso` (info vs warning, en dos sitios),
`cancelado` (danger vs neutral) y `activo` (warning «En curso» vs success).

Las cuatro las resolvió **la doctrina que el propio fichero ya tenía escrita desde el 15-08**, no
un criterio nuevo. Y la excepción se conserva a propósito: `completed` es INFO en una corrida
—agotó su ciclo— y SUCCESS en un documento. Ejes distintos, tonos distintos; ése es justo el
motivo de nombrar por eje y no por tabla.

**→ Cuando dos definiciones de lo mismo discrepan, la que gana no se elige: se busca si ya hay una
decisión escrita.**

### 3 · El gate probado en rojo nació ciego, y la prueba lo salvó

S2 caza el COLOR en JavaScript (dos utilidades de Tailwind en una cadena) y por eso no podía ver
esto: un mapa que devuelve el NOMBRE del tono es exactamente lo que F3.3 pedía, sólo que en el
fichero equivocado. Nace **S4**.

La primera versión usaba `exec` **sin bandera global**, así que sólo veía UNA entrada por línea:
un diccionario de tres tonos escrito en una sola línea —la forma más común— quedaba con un único
tono distinto y no llegaba al mínimo de dos. **Daba verde contra el fallo que existía para
cazar.** Lo destapó probarlo en rojo con un diccionario falso.

**→ «Probado en rojo» no es un trámite. Un gate que no se prueba con el fallo real es peor que no
tenerlo, porque además certifica.**

### 4 · Tres defectos que sólo aparecen MIRANDO LA PANTALLA

Ninguno lo habría encontrado leyendo código, porque los tres renderizan perfectamente:

- Un `variant="info"` **fijo** con el texto «Estado: **pending**» en inglés crudo, en la pantalla
  más usada de la aplicación — el mismo defecto que la auditoría de F9 había encontrado en
  `template_artifacts`, y nadie lo buscó en home.
- Una pastilla cuyo **texto decía el estado** y cuyo **color decía si puedes operar**: un
  documento «En llenado» salía en ámbar, que en este sistema significa «retirado». La capacidad
  ya la anunciaba otra pastilla tres líneas más abajo.
- Un **quinto** sitio decidiendo el tono de «acceso», y el único que lo fijaba a mano.

Y un cabo del propio arreglo: al sustituir el texto por `etiquetaLlenado(...)` se perdió el
defecto `'pending'` que el literal antiguo sí tenía, y la pastilla salió gris. **Restaurar un
defecto hay que hacerlo en los DOS lados, tono y etiqueta, no sólo en el que se ve.**

### 5 · El seed no puede probarlo todo, y hay que decir cuál

Dos cosas quedaron sin verificar en pantalla, y las dos por datos, no por código:

- `vacancies` y `contracts` están **vacías** en el seed de dev.
- **Ningún flujo de llenado del seed tiene más de un paso** (18 `pending` + 2 `in_progress`, uno
  por flujo), así que el cambio de un paso pendiente NO actual de neutral a salmón no se ve: todos
  los visibles son el paso actual. Se comprobó en su lugar lo que sí era riesgo real —que
  `.deasy-flow-step--salmon` existe en `signatures.css`—, porque un tono nuevo sin regla habría
  dejado el paso sin pintar y ningún gate lo ve: la clase se compone en una plantilla de cadena.

**→ Un tono nuevo devuelto por una función es una clase CSS nueva que nadie declaró. Compruébala
antes de darla por buena.**

## 2026-08-20 (tarde) · F9.D — el booleano y la clasificación, y un censo que mentía

Ampliación de la decisión de la mañana: también son pastilla. Cuatro cosas que costaron y no eran
evidentes.

### 6 · Tres familias de celda, tres paletas — o el color inventa significado

Un **estado** tiene eje bueno/malo. Un **booleano** tiene eje sí/no. Una **clasificación** no tiene
ninguno: `TC`, `MT` y `TP` son pares entre sí, y pintarlas de verde, ámbar y rojo habría inventado
una jerarquía que el dato no tiene. Por eso la clasificación va con **contorno** y paleta
restringida —nunca `success`, `warning`, `danger` ni `salmon`—, y sólo se distinguen sus valores
cuando uno lo pone el SISTEMA y otro una PERSONA, que es procedencia y no valor. Hay un test que
recorre las 20 columnas y prohíbe los cuatro tonos de juicio.

**→ Antes de dar color a un vocabulario, pregunta si sus valores están ORDENADOS. Si no lo están,
el color miente.**

### 7 · No todo booleano es una habilitación

`tonoActividad` (sí→verde, no→ámbar) se decidió el 15-08 para «Activo», y aplicarlo a los 32 sin
mirar habría sido un error de lectura: un paso de firma que **no** es obligatorio es *opcional*;
una relación sin herencia no está rota; un WhatsApp sin verificar es una **ausencia**, no un fallo.
Nueve de las 32 van con `tonoRasgo` (sí→info, no→neutral).

### 8 · UN CENSO POR REGEX SOBRE UN FICHERO ESCRITO A MANO MIENTE, Y ÉSTE MINTIÓ UN 34 %

El censo de booleanos exigía el orden `name, label, type` dentro del literal de campo. `sqlTables.js`
**no lo respeta siempre**, así que el barrido devolvió **21 columnas de 32**. Con ellas se escribió
la lista de excepciones: dijo 3 rasgos donde había 9.

**No lo cazó `node --check`, ni el lint, ni los 23 gates, ni los tests.** Lo cazó **la pantalla**:
en el barrido de verificación aparecieron las dos columnas «Obligatorio» gemelas —la de llenado y
la de firma— una en VERDE y otra en AZUL. El fallo era invisible en el código porque la lista de
excepciones *parecía* completa.

**→ Un censo se hace dos veces con dos regex distintos, o se comprueba contra un total conocido. Y
cuando dos columnas gemelas salen de distinto color, el bug no está en la que te choca: está en el
censo.** El trinquete ahora fija las 32 con su eje.

### 9 · Poner una pastilla DESTAPA lo que el texto plano escondía

El traductor de etiquetas conocía **4 de los 20** campos de clasificación —era una lista de cuatro
nombres escrita a mano dentro de un `if`—, así que 14 valores salían en `snake_case` inglés:
`task_assignee`, `auto_one`, `and`, `routed`, `official`, `derived`, `simbolico`, `context_exact`…
Llevaban meses ahí y nadie los vio **porque como texto plano parecen un dato**; dentro de una
pastilla se leen como una etiqueta rota.

Ninguna de las 20 palabras nuevas está inventada: todas salen de los `<option>` del asistente, de
`itemModeLabel` y de `APPROVAL_LABEL`, porque inventar un segundo nombre para el mismo código es la
enfermedad que este frente lleva cuatro fases matando. Quedan anotadas —sin tocar— **cinco
divergencias conocidas** entre diccionarios de etiqueta de distinto contexto (`UnitGraphView` dice
«Esta unidad» donde la tabla dice «Unidad exacta»).

**→ Una pastilla es un detector de etiquetas sin traducir. Si vas a poner una, mira primero quién
traduce ese vocabulario y cuántos conoce.**

### 10 · Y de propina, la base de la pila B está vieja

`fill_flow_steps` tiene **3 filas con `document_owner`**, un resolver que `CLAUDE.md` da por
imposible («el `CHECK` admite sólo esos tres valores»). El `postgres_schema.sql` del repo **es
correcto**; lo que está viejo es la base de la pila B: su restricción es la *legacy* de seis valores
—se llama `fill_flow_steps_resolver_type_check` y no `chk_…`—, o sea que se creó antes de esa
migración y nunca se re-bootstrapeó. **No se le dio etiqueta a los tres valores retirados a
propósito**: que salgan con su código crudo es la señal correcta.

**→ Medir contra una pila cuya base no se ha re-bootstrapeado puede enseñarte datos que el esquema
actual prohíbe. Comprueba el NOMBRE de la restricción, no sólo su contenido.**

## 2026-08-20 (cierre) · La pastilla era un objeto de una línea y no lo decía

### 11 · `rounded-full` no es un radio: es la mitad de la altura

El dueño vio que las pastillas de varias palabras «perdieron simetría de ancho y alto, y muestran
el texto fuera». Medido en `/admin/gestiones/firmas/signature_flow_steps`:

    «Todas»                46,8 × 20    1 línea    correcto
    «Por cargo»            62,7 × 40    2 líneas   el óvalo se come el texto
    «Persona concreta»     62,7 × 40    2 líneas
    «Unidad del contexto»  62,3 × 60    3 líneas

`.deasy-tag` nunca declaró `white-space: nowrap`. Mientras la caja mide 20 px el radio es 10 y el
texto cabe; al partirse en dos líneas la caja pasa a 40, **el radio pasa a 20**, y la curva entra
en la zona del texto — el padding horizontal de `--sm` son 6 px y no da para tanto. Deja de ser una
pastilla y pasa a ser un óvalo con las palabras saliéndose.

Y lo de «demasiado cortos» era la otra mitad: la base es `w-fit`, o sea `fit-content`, que en una
celda estrecha **se queda en el ancho DISPONIBLE** (62 px de los 94 de la celda) en vez del ancho de
su texto. Sin envolver, `fit-content` vuelve a ser el ancho del contenido.

**→ Una geometría relativa (`rounded-full`, `fit-content`) es correcta sólo dentro del rango de
tamaños para el que se pensó. Al declararla, escribe cuál es ese rango — o ponle el límite que lo
garantice.**

### 12 · La deuda estaba desde siempre; lo que cambió fue el VOCABULARIO

No apareció con la pastilla de estado, cuyas etiquetas son de una palabra —«Activa», «Retirada»,
«Pendiente»—, sino con la de clasificación, cuyo vocabulario son frases: «Responsable del
entregable», «Todos los puestos coincidentes», «Unidad del contexto». La base llevaba meses sin
`nowrap` y nadie lo notó porque nunca se le dio texto largo.

**→ Cuando un componente estable empieza a fallar, mira primero qué DATO nuevo está recibiendo. La
regresión puede no estar en el código que cambió.**

### 13 · El arreglo es seguro porque el contenedor ya desbordaba

`nowrap` hace que la columna crezca. Se comprobó antes de aplicarlo: la tabla vive en
`.deasy-table-responsive`, que es `overflow-x: auto`, y **ya desbordaba de por sí** (1929 px sobre
un contenedor de 1502). Donde el contenedor NO puede crecer —los nodos del grafo, de ancho fijo—
se verificó una a una: las cuatro pastillas de nodo llevan etiqueta de una palabra, y la única
larga (el código de plantilla) ya pedía `--truncate`, que implica `nowrap` y por tanto no cambia.
Barrido posterior sobre organigrama, mapa de procesos, cuatro tablas y el modal de entregable:
**cero desbordes, y todas las alturas uniformes**.

## 2026-08-20 (auditoría) · Lo declarado contra lo renderizado

Encargo del dueño: *«identifica si aún lo que se declara es diferente de lo que se renderiza»*.

### 14 · El método: el detector tiene que vivir en el navegador

Se escribió un detector que, **por elemento**, compara lo que declara su regla de
`@layer components` contra lo que declara cualquier regla de capa superior que también le casa.
5 rutas, 428 reglas de `components`, ~1 100 nodos por ruta. Resultado: **17 propiedades pisadas**.

Y el hallazgo de método es más valioso que la lista: de las **8 parejas** clase-componente/utilidad
encontradas, **sólo 2 están escritas en un `class` literal**. Las otras 6 se componen en `:class`
con expresión.

**→ Ningún gate estático puede verlas.** Es la misma ceguera que `check-variants.mjs` documenta
para las variantes dinámicas, y por eso el detector tiene que correr sobre el DOM.

### 15 · Un `ring-1` mataba el color de los cuatro tonos, y no lo veía nadie

El único defecto real de los 17. `UnitNode` y `ProcessGraphView` pintaban el badge del nodo con
utilidades crudas y sólo tomaban el `--<tono>`; ese `ring-1` —capa `utilities`— **pisaba el
`box-shadow` que el modificador declara** en `components`:

    declarado    inset 0 0 0 1px var(--color-line)      (hilo suave, del tono)
    renderizado  rgb(71,84,103) 0 0 0 1px               (anillo por defecto de Tailwind)

Ni `inset`, ni del tono. **Los cuatro tonos pintaban el mismo gris oscuro**: el diccionario
decidía el color y el último paso lo tiraba. De regalo, radio 12 donde la clase declara 8 y letra
12 donde declara 11.

**→ Una clase de componente sólo pinta lo que ninguna utilidad del mismo elemento le dispute. Si
la plantilla escribe geometría a mano junto a un modificador, el modificador es lo único vivo.**

### 16 · El comentario que descartaba el colapso tenía razón en la MITAD

`graph.css` decía desde el 15-08 que el badge de nodo **no** es un `deasy-tag` porque «trae su
propio contenido y tiene un estado que una pastilla no tiene». Auditado: cierto para **dos** de
los cuatro usos —los `<button>` con chevron y estado expandido/colapsado— y falso para los otros
dos, que son `<span>` sin clic ni estado y ni siquiera aplicaban la clase base.

Un solo nombre, `graph-node__badge`, cubría **dos objetos distintos**. Los dos `<span>` pasan a
`AppTag`; los dos botones se quedan y se renombran a **`graph-node__toggle`**, porque «badge» era
justo lo que invitaba a confundirlos — y de esa confusión salieron las dos copias.

**→ Cuando un comentario justifica no colapsar algo, comprueba si su argumento vale para TODOS sus
consumidores. Un nombre que cubre dos objetos hace que la razón de uno proteja al otro.**

### 17 · Lo que se midió y NO es un hallazgo

- **287 de 428 reglas de `components` no alcanzaron ningún nodo.** No concluyente: cinco rutas no
  renderizan el sistema entero. Sólo valdría con un barrido completo, y decirlo como hallazgo
  sería inventar deuda.
- **199 reglas sin capa** en el navegador, que ganan a todo lo que esté en `@layer`: 121 de
  Leaflet, ~73 de Vue Flow, 2 `:root` de tokens y 3 nuestras (`graph-node__handle`), las
  excepciones que F6 declaró. **Ninguna selecciona un `deasy-*`**, así que el riesgo está
  contenido — pero existe: una regla de librería sin capa gana a cualquier regla de componente.

### 18 · La trampa del CSS rancio, pagada en esta misma sesión

Tras editar `tags.css`, el servidor de desarrollo siguió sirviendo el CSS **anterior**: traía el
`white-space: nowrap` del cambio previo pero no el radio nuevo, y `.deasy-tag--sm` seguía
declarada. **La primera medición dijo «el radio no cambió» y era falso.** Lo resolvió `touch` a
`index.css` más recarga sin caché.

Lo peligroso es que no se parecía a un CSS rancio: la página **sí** reflejaba los cambios de
plantilla —el alto y la letra habían cambiado al retirar `size="sm"`—, así que todo indicaba que
estaba viva.

**→ Antes de concluir «el CSS no aplicó», comprueba que el CSS SERVIDO es el que escribiste. Leer
la regla desde el DOM (`document.styleSheets`) cuesta una línea y evita un diagnóstico entero
equivocado.**

## 2026-08-20 (noche) · Cuando la pila impide verificar, la pila es el trabajo

### 19 · «No se puede verificar con el seed» no es una excusa: es una tarea

La primera tanda de F12 se cerró con los 14 sitios **sin comprobar en pantalla**, y el motivo era
real: `/setup` redirige a `/admin` cuando el sistema ya está arrancado, y ahí viven 7 de los 14.

La salida no era rebajar la exigencia sino **reconstruir la pila**: `reset.mjs db storage`,
bootstrap por la UI —que de paso ejercita el asistente entero—, `seed:dev` y `seed:certs`.
Resultado: **23 instancias** de `deasy-elegible` medidas en los pasos 2 y 3, con **exactamente dos
firmas geométricas**. Cero deriva, y con captura.

**→ Si una pantalla no es alcanzable, el estado de los datos es parte del cambio. Rehacer la base
cuesta cinco minutos y convierte «no verificado» en medido.**

### 20 · El re-bootstrap mató una deuda que llevaba meses invisible

`fill_flow_steps` tenía **3 filas con `document_owner`**, un resolver que `CLAUDE.md` da por
imposible. La auditoría del día había demostrado que **el `postgres_schema.sql` era correcto** y lo
viejo era la base: su restricción se llamaba `fill_flow_steps_resolver_type_check` —el nombre
*legacy* de seis valores— y no `chk_…`.

Tras el reset: `chk_fill_flow_steps_resolver_type` con tres valores, y **`document_owner` a cero**.

**→ El nombre de una restricción dice de qué migración viene. Comprobarlo cuesta una consulta y
distingue «el código está mal» de «esta base es vieja».**

### 21 · Un relleno masivo de contraseñas dejó al admin fuera

Al automatizar el asistente rellené **todos** los `input[type=password]` de una vez, sin mirar que
dos estaban OCULTOS —los del paso 1, ya recorrido—. El admin quedó con la contraseña del gestor y
`seed:dev` murió con un 401.

Lo arregló `bootstrap_admin_recovery.mjs`, que existe justo para esto. Pero la lección es anterior:
**en un asistente por pasos, los campos de los pasos anteriores siguen en el DOM**. Rellenar por
tipo de campo, y no por lo que se ve, escribe donde no toca.

**→ Al automatizar un formulario, filtra por VISIBILIDAD (`getBoundingClientRect().height > 0`)
antes que por selector.** Y comprueba que lo que parece un valor no sea un `placeholder`: los
campos del paso 2 parecían rellenos y estaban vacíos.

## 2026-08-17 · F6 — muere `overrides.css`, y con el la deuda de capa

El fichero que daba nombre a la fase ya no existe. Empezo con **34 selectores fuera de `@layer`**
en el proyecto y termina con **9, de los que solo 4 son deuda** (3 cualifican Vue Flow y 2 son los
`:root` estructurales de `tokens.css`).

### Lo que enseñaron sus lapidas, y no debe perderse con el fichero

Se rescatan aqui porque describen trampas que se van a reencontrar:

```css
/* Solo `.bg-white` a secas, y NO por el color: pinta blanco con blanco, exactamente igual
   que la utilidad de Tailwind. Lo que aporta es PRIORIDAD — esta sin capa, asi que gana a
   las reglas de componente en 172 nodos. Quitarla no seria un cambio de color: seria
   soltar esos 172.

   Aqui estaban ademas `/80 /85 /90 /92 /95`, y esas SI hacian algo: aplastaban a blanco
   solido las cinco variantes con alfa. Cinco de los nodos afectados combinaban
   `bg-white/80` con `backdrop-blur` — un cristal esmerilado convertido en losa opaca, que
   es la prueba de que era un accidente y no una decision. Entonces existia ademas un token
   `--brand-white` propio, y `bg-brand-white/80` —el mismo proposito escrito con el otro
   nombre— SI salia translucido, porque la regla no nombraba ese selector: el aspecto
   dependia de que token hubiera elegido quien lo escribio. Ese token ya no existe. */
```

```css
/* ══ TRES REPINTADOS BORRADOS EL 2026-08-13, POR QUEDARSE SIN CONSUMIDORES ══════════════
   Era su final declarado desde el principio: «deuda con fecha de caducidad, no arquitectura».

   · `.shadow-xl` y `.shadow-sm` -> las plantillas escribian una utilidad de Tailwind CONTANDO
     con que aqui se le cambiara el valor por `--elev-2` / `--elev-1`. Ahora la escala de
     elevacion esta registrada en `@theme` (`--shadow-elev-1/2/3`), asi que la plantilla pide
     `shadow-elev-1` —lo que de verdad quiere— y el rodeo sobra. Mismos valores: cambio cero.
   · `.bg-slate-50` (+ `/70` y `/80`) -> `bg-surface`, que es el mismo `--color-surface` sin
     necesidad de una regla que lo traduzca.

   Quedaba tambien `.border-slate-200` con `!important`. Ver mas abajo. */
```

```css
/* ======================================================================================
   (A) REPINTADO DE UTILIDADES DE TAILWIND — y NADA MAS. Ni un selector de componente.
   VA AL FINAL A PROPOSITO (ver cabecera del fichero).

   ⚠️ Es DEUDA CON FECHA DE CADUCIDAD, no arquitectura: cada utilidad de aqui existe porque
   una plantilla escribe `bg-slate-50` en vez de `bg-surface`. Su final es
   quedarse sin consumidores y borrarse — NO ampliar la lista, que es lo que hacia que se
   escaparan 120 apariciones.

   ⚠️ **ESTOS SELECTORES NO SON USOS.** Un script de migracion los reescribio una vez y
   rompio el repintado en silencio (el escape del `/` en `.bg-slate-50\\/70` burla el limite
   por la derecha). Al migrar por script, excluye este fichero o revisalo a mano.
   ====================================================================================== */
```

### El gate que nacio de aqui

`check-layer-debt.mjs`, el veintidos, con dos señales:

- **S1 · una regla fuera de `@layer`**, techo cero, con dos excepciones declaradas y su motivo.
- **S2 · dos reglas de la misma especificidad disputandose una propiedad y LEJOS una de otra.**
  No evalua la cascada —eso solo lo hace el navegador—: exige que se vean en la misma pantalla,
  porque **la distancia es lo que convierte un conflicto deliberado en uno accidental**.

Las dos, probadas en rojo con los fallos reales de la fase. Y S2 **encontro uno solo en su primera
corrida, y era de verdad**: `.deasy-dialog-panel--plain` estaba declarada 137 lineas por delante de
su base, o sea que su `background: transparent` no gano nunca — el panel del modal de `BtnSera`
llevaba meses saliendo blanco. No lo habia visto ningun gate ni ningun ojo.

📌 Su primera version acuso a OCHO parejas, y seis eran ruido: variantes mutuamente excluyentes de
`.deasy-btn` que no coexisten en un elemento. La acotacion que lo arregla es precisa y vale la pena
recordarla: **solo cuenta si una de las dos es la base desnuda**, porque en BEM un elemento lleva
siempre su base y su modificador, pero no dos variantes.

### Y lo que enseño ejecutarlo

1. **Un duplicado solo es duplicado si el destino gana SIN el.** Del marco de trabajo se borraron
   primero los dos «deshacedores» dando por hecho que `admin.css` ya lo decia — y deshacian a sus
   hermanos del MISMO fichero. El marco de tabla salio blanco y con sombra. Lo cazo la huella.
2. **En CSS se sustituye texto exacto, nunca rangos.** Tres recortes por indice salieron mal en una
   sola sesion: uno destrozo la estructura del fichero, otro se llevo la apertura de un `@layer`
   —el build murio con «Missing opening {»— y el tercero, al repararlo, se llevo por delante una
   regla que no tenia nada que ver. La cazo `check:orphan-classes`.
3. **Una propiedad abreviada BORRA las longhand que no nombra.** El fondo de autenticacion no
   ganaba por capa ni por especificidad: escribia `background:` sin `-image` y eso vacia. Los dos
   halos radiales que `auth.css` declara no se habian visto nunca.
4. **Bajar de capa no basta si las RECETAS declaran lo que el estado necesita pisar.** El campo en
   error siguio invisible tras capar, porque `.deasy-auth-field` y `.deasy-control` ponian su
   propio borde, fondo y color. De ahi la regla que queda: el reposo se declara UNA vez en el
   suelo, la receta declara geometria, y el estado gana porque es lo unico que reclama esa
   propiedad.
5. **A igual especificidad decide el ORDEN del fichero.** Al capar el foco lo deje al final y se
   comio el borde rojo del error: un campo invalido se veia AZUL justo mientras lo corregias. No
   lo vio ningun gate — ninguno mira quien gana.

---

## 2026-08-17 · F5.4 — tres nombres para dos tamaños, y el que sobraba era el más elegido

### Las cifras del plan estaban mal, y no por poco

Decía «`sm` es 156 de 198 usos». Al medir: **317 botones**, repartidos **md 181 · sm 132 · lg 4**.
La mayoría era `md`, no `sm`.

El motivo del desajuste importa más que el número: **el componente se importa con dos nombres**.
`AppButton` (160 usos) y `AdminButton` (157) son **el mismo fichero** —`AdminButton` es un alias de
import en 33 ficheros—, resto del fork que F1.3a borró. Cualquier censo que cuente uno solo se deja
la mitad fuera, y eso es exactamente lo que había pasado.

### Lo que sí se confirmó

Medido en el navegador con la misma etiqueta en los tres:

    sm   40 px de alto · 14 px de letra · padding-x 12
    md   40 px de alto · 14 px de letra · padding-x 16
    lg   46 px de alto · 16 px de letra · padding-x 20

`sm` y `md` son **la misma altura y la misma letra**. Lo único que las separa son 8 px de anchura
total. La causa está escrita en el CSS: la base pone `min-h-10` (40 px) y se come el `py-1.5` de `sm`.

Y el dato que decidió: **de los 181 `md`, 179 son por defecto**; sólo 2 lo piden a propósito. O sea
que la única talla que alguien elige activamente es `sm` — y 132 sitios creían estar pidiendo un
botón pequeño sin recibirlo.

### La decisión

El dueño eligió **que `sm` desaparezca** (opción A de tres). Sus 132 usos pasan a `md`; se van también
su regla de CSS, su override de barra de acción y el único botón escrito a mano que la llevaba.
`lg` se queda: aunque sean 4 usos por componente, **sí es una altura distinta con un papel claro**.

### Lo que apareció de paso, y no se tocó

- **`lg` tiene 13 usos más escritos a mano** (`class="deasy-btn … deasy-btn--lg"`), o sea que la
  mayoría de los botones grandes **se salta el componente**. En `RegisterView`, «Cancelar» va por
  `AppButton` y su pareja «Registrarme» es un `<button>` a mano: la misma fila, dos caminos.
- El botón de chat lleva a la vez `deasy-btn--icon` (36 px) y `deasy-fab` (64 px), más un `admin-btn`
  superviviente del fork.

Ninguno es de esta fase, pero los dos son la misma señal: **el censo de un componente sólo vale si
antes compruebas por cuántos nombres se le llama.**

---

## 2026-08-17 · F5.2 — el radio: la cola no era ruido, era una pieza repetida

### El enunciado decía «no se sostiene»; el problema era otro

Prometía que «el sistema tiene dos radios» no se sostiene, y apuntaba a que `rounded-lg` era el
menos usado. Al medir, la conclusión es la contraria de lo que sugiere el enunciado: **no hay que
inventar una escala, ya existe y la usa casi todo el mundo**.

    16 px  218 usos  ┐
    12 px  167 usos  ├── 434 de 534 = el 81 %
    pastilla 49      ┘
    …y 17 valores más, usados entre 1 y 3 veces cada uno

Lo que había era una **cola**. Y la cola tampoco era ruido: los cinco valores por encima de 16 px
(1.35 / 1.5 / 1.75 / 1.8 / 2rem) eran **la misma pieza escrita de cinco maneras** — el panel grande
de `/home`, con su borde y su degradado, repartido entre cuatro ficheros. El dueño eligió colapsarlos
a **16 px**, sabiendo que el panel pierde identidad frente a una tarjeta: a cambio, la escala queda en
tres pasos.

### Los dos últimos tenían respuesta medida, no de gusto

- **El chevron del select** llevaba un radio interior de 9 px. Un radio interior es *el exterior menos
  el borde*, y el campo mide 8 con borde de 1: tocaba 7. El 9 es correcto **para un campo de 10 px**,
  que es lo que era `AdminSelectField` antes del control canónico — está escrito en el comentario de
  `forms.css`. Al bajar el campo a 8, nadie bajó el interior. **No era un radio de diseño: era un
  resto.** El dueño eligió 8 en vez de 7: pierde el sub-píxel de exactitud geométrica y gana que sea
  un paso de la escala en vez de un arbitrario más. Medido: la caja no se sale del campo.
- **El marco del logo** valía 14 px y no casaba con nada de su pantalla — la tarjeta de al lado pinta
  12 y el botón 8. Ahora 12.

### La trampa latente que apareció al mirarlo

`AppLogo` ponía el radio en **dos ramas**: una al enmarcar y otra al ser enlace. Hoy no chocan porque
ninguna de las cuatro vistas de autenticación enmarca un logo enlazado — pero el día que alguien lo
hiciera, **dos utilidades de la misma especificidad se pelean y gana el orden de la hoja, no la
intención**. Se colapsaron en un solo cálculo con precedencia explícita: manda el marco, que es la
caja que se ve.

### Y una lección sobre el instrumento, que me tocó pagar dos veces

1. **Corrección a mí mismo:** dije que el gate contaba los comentarios de los `.css`. **No los
   cuenta** —`check-no-arbitrary.mjs:105` los quita—; quien los contaba era mi script de censo. Por
   eso el «22 radios distintos» estaba inflado por prosa. Comprobado en el CSS **construido**: de los
   literales que sólo viven en comentarios no existe ni una regla.
2. **Pero en un `.vue` sí cuentan, y con razón**, porque Tailwind escanea el fichero entero y emitiría
   la clase. Lo comprobé escribiendo un comentario que citaba la clase que acababa de retirar: la
   mantuvo viva. Es la norma «documenta la clase, no la escribas», y la incumplí dos veces en la misma
   sesión — una en `surfaces.css`, donde además **rompí una prosa que documentaba historia** al
   sustituirle los nombres, dejándola diciendo «16 y 16» como si fueran distintos.

**La regla que queda:** en un comentario, cita la **medida**, no la clase.

---

## 2026-08-17 · F5.3 — la altura, y por qué los niveles fijos duraron dos días

> ⚠️ **Hueco declarado:** entre esta entrada y la del 15-ago falta lo de F3.4, F4, F4.C y F5.1. Se
> quedó sin escribir mientras se ejecutaba; está en los mensajes de commit y en la tabla §0 del
> plan, pero no aquí. Se anota para no darlo por documentado.

### Lo que el enunciado decía, y lo que había

El plan prometía «`z-index` — **cinco pisos** coordinados solo por comentarios». Eran **diecinueve**,
y el problema no era el orden sino que **no había forma de verlos juntos**: se escribían en cuatro
grafías que ningún gate podía relacionar —utilidad, arbitraria, `z-index:` en CSS crudo, y siete
`:style="{ zIndex: 1090 }"` que no veía nadie—. Se coordinaban por comentario, y uno remitía a un
fichero borrado dos días antes.

De ahí salieron **tres fallos que ni el build, ni el lint, ni los 347 tests ven, porque los tres
renderizan perfectamente**: el aviso quedaba detrás del modal que lo disparaba; la confirmación del
asistente (1075) por debajo del asistente (1080); y el contenedor del mapa llevaba un `z-10` que
**parecía un no-op** —un `z-index` sobre un elemento `static` no hace nada— y era lo único que
impedía que los 1000 de Leaflet taparan la barra superior.

### La primera versión era elegante y estaba mal

Se diseñó una escala de dos ejes (la magnitud dice en cuál estás: 1-2 cifras local, 4 cifras global)
con **cinco niveles de modal declarados por componente**, y el dueño la aprobó tras preguntar
expresamente si tres niveles bastaban. Se implementó, se midió, pasó los 21 gates y se cerró.

**Duró dos días.** La tumbó una pregunta suya, no un test:

> «como se reutilizan modales, estos podrían ir cambiando de nivel mientras se les va llamando,
> ¿consideraste eso?»

No se había considerado. Al medirlo: **`openProcessWizard()` se llama desde SIETE sitios** de la
misma vista — seis desde la tabla, con nada abierto, y uno desde dentro del editor de registro. Un
componente, un número, dos profundidades.

**El caso lo encontró él antes que nadie**, y no como un fallo de altura: «di clic en agregar
configuración y no pasó nada». El modal se abría — en 4020, debajo del editor en 4021. Invisible.

### Por qué la corrección obvia también era la equivocada

La reacción inmediata fue `nivel="1"` → `nivel="2"`. **También está mal**: arregla ese camino y miente
en los otros seis. Y pasar el nivel desde quien abre reparte el problema entre siete llamadas, ninguna
comprueba nada, y la octava falla en silencio — que es exactamente el acuerdo por convención que esta
fase venía a quitar.

**El dato no cabe en el componente.** La altura de un modal no es una propiedad suya: es consecuencia
de la pila que hay cuando se abre.

### Lo que no hubo que inventar

`modalController.js` **ya lo hacía** para la mitad antigua de los modales: al mostrarse, un escalón
sobre el más alto visible. Y ésa es precisamente la mitad que **nunca se rompió**. Lo que faltaba era
que la mitad nueva —la de Vue, con `:open`— llamara al mismo sitio. Se extrajo a
`elevarSobreLoVisible` / `liberarAltura`, y las dos mitades pasaron a obedecer una regla.

Al hacerlo se vio algo que invalidaba media narración anterior: **el controlador pisa la clase**,
porque escribe en línea. O sea que los cinco niveles eran ya inertes para la mitad antigua, y sólo
gobernaban la de Vue — que es, otra vez, la única que se podía romper.

Se retiraron `--z-modal-2`…`-5`. Queda `--z-modal` como **suelo** (dónde caen si el cálculo no llega
a correr) y la banda 4030-4090 libre a propósito: es el margen por el que trepa el apilado. Y la
pregunta «¿bastan cinco niveles?» **desaparece en vez de responderse**, porque la profundidad deja de
tener tope.

### Lo que enseñó, más allá del z-index

1. **Un diseño aprobado no es un diseño verificado.** Éste pasó gates, tests y navegador, y aun así
   era estructuralmente incapaz de funcionar. Lo que lo destapó fue una pregunta sobre el *modelo*,
   no una medición del *resultado*.
2. **Antes de dar un valor a un componente reutilizable, cuenta sus llamadas.** Siete, a dos
   profundidades, se ven con un `grep` de treinta segundos. No se hizo.
3. **Cuando ya existe un mecanismo que resuelve el problema en la mitad del sistema, la pregunta no
   es qué inventar sino por qué la otra mitad no lo usa.**
4. **Un `z-index` que parece un no-op puede ser lo único que sostiene algo.** El del mapa. Ahora es
   `isolate`, que hace lo mismo sin depender de la altura y dice lo que hace.

### Y una trampa nueva del instrumental

`check:no-arbitrary` **lee los comentarios**. Al documentar en prosa las dos utilidades que un commit
retiraba, las mantuvo vivas en el censo y el gate salió **rojo por un cambio que sólo restaba**. Es la
misma trampa que `tokens.css` corta para Tailwind con `@source not`, vista por el otro lado: allí la
prosa **crea** la utilidad, aquí la **mantiene**.

---

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
