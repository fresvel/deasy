# Frente 25 · Qué pareja (configuración, plantilla) es legal — y qué es una plantilla sin proceso

> **Estado**: 🟡 **2 de 18 vivas** — 19 filas en el control, una descartada (`P2`) · abierto el
> **2026-10-09** · **análisis con dos cambios ya ejecutados**
> **Abierto por una observación del dueño** que corrige al frente 23.

**Nació como análisis puro y ya no lo es.** Son **cinco** preguntas de modelo (`A`…`E`) cuyo
entregable es lo medido y el espacio de diseño, para que el dueño decida en `Z`; más los **cambios
`P`**, que salen de decisiones ya tomadas. `P1` y `P7` están **hechos** (2026-10-11); el resto espera
a que las preguntas se contesten, porque pueden hacer desaparecer columnas enteras.

## 0-bis · DECISIONES YA TOMADAS por el dueño (2026-10-09 / 10-11)

**Esto no es análisis: está decidido y se ejecuta.** Se separa del control de tareas a propósito,
porque el frente nació como análisis y estas siete salieron de la conversación. Cada una con la
frase del dueño que la fija.

| # | Decisión | Cómo lo dijo |
|---|---|---|
| **1** | **Los dos caminos se quedan**: `official` y `ad_hoc` son necesarios | *«necesitamos los dos caminos»* |
| **2** | **La regla es asimétrica a propósito**, y el sentido inverso hay que controlarlo | *«creo que la regla sí debe ser asimétrica y el sentido inverso debe controlarse de la mejor manera»* |
| **3** | **Ese control va en el MODELO**, no en el código | *«creo que debemos implementar este control en el modelo»* |
| **4** | **Índice de «una sola edición publicada por formato»**, con columna generada + único parcial | se midió que es seguro —el código ya retira antes de publicar en los dos sitios— y no se objetó |
| **5** | `catalogo_documental` → **`formatos`** | *«retomar la idea de formatos»* |
| **6** | `available_formats` → **`archivos`** (libera la palabra «formato» para lo que de verdad nombra) | *«renombrando la columna de formatos de archivos a archivos»* |
| **7** | `storage_version` → **`version`** · `process_definition_versions` → **`ediciones_de_proceso`** | *«de acuerdo el cambio de nombres propuesto»* |
| **8** | **La línea tendrá fila: se elige `P2-bis`** (tabla `lineas`) frente a sólo quitar la copia | *«quedemos con P2bis y veamos esa valoración con vínculos»* |
| **9** | **`C` cambia de forma**: deja de ser «¿debe existir `ad_hoc`?» y pasa a la prueba falsable de abajo | *«de acuerdo, debemos valorar la nueva pregunta»* |

⚠️ **Y LA DECISIÓN 8 ESTÁ ATADA A LA PREGUNTA `A`, hay que decidirlas juntas.** Si la línea tiene
fila, `vinculos` **podría** apuntar a la línea en vez de a la versión, y eso contestaría `A` sin
disparador: sería una clave ajena. **Pero diría lo contrario de lo que el dueño corrigió** —que una
edición sirve a una *versión* de variación, no a una variación—. Así que dar fila a la línea **no
implica** mover el vínculo: son dos cosas y la segunda sigue abierta.

⚠️ **El orden importa y el renombrado va ÚLTIMO.** Renombrar es barato; renombrar dos veces, no. Las
decisiones 5, 6 y 7 se ejecutan **cuando el modelo ya no vaya a cambiar de forma** — o sea después de
`C` y `D`, que pueden hacer desaparecer columnas enteras (`template_scope`, `owner_person_id`,
`variation_key`). Consagrar un nombre para algo que puede morir es trabajo tirado.

⚠️ **Y DOS NOMBRES QUE NO SE PUEDEN USAR, medido:** `alcance` y `ambito` están en la lista de nombres
muertos de `doc-modelo-excepciones.json`, **reservados por el frente 18** para el expediente
relacional (el «ámbito» de un título, que es otro significado de la misma palabra). Así que
`process_target_rules` **no** puede pasar a `alcances`: hay que buscar otro —`destinatarios`,
`cobertura`, `a_quien_alcanza`—. Comprobado el 2026-10-11, junto con que `formatos`, `archivos`,
`moldes`, `configuraciones`, `variaciones`, `lineas` y `ediciones_de_proceso` **están libres**.

## 0 · Control de ejecución

⚠️ **DOS PREFIJOS, Y AQUÍ ESTÁ QUÉ SIGNIFICA CADA UNO.** Se mezclaron en la conversación sin
explicarlos y el dueño lo señaló; la norma de esta carpeta lo prohíbe expresamente («no mezcles dos
numeraciones en el mismo mensaje»):

| Prefijo | Qué es | Ejemplo |
|---|---|---|
| **letra + número** (`A1`, `D2`…) | **una PREGUNTA que hay que contestar.** La letra es la pregunta, el número su tarea: `1` mide, `2` enumera el espacio de diseño | `C1` = medir qué es hoy `ad_hoc` |
| **`P` + número** (`P1`…`P7`) | **un CAMBIO que hay que ejecutar.** Sale de una pregunta ya contestada o de una decisión del dueño | `P1` = el índice de una sola publicada |
| **`Z`** | la decisión final del dueño sobre las cinco preguntas | |

⚠️ **POR QUÉ SÓLO `P1` y `P7` ESTÁN HECHAS, y no es que las demás se hayan perdido.** Son las dos
ÚNICAS que no dependen de ninguna pregunta abierta: `P1` sale de una decisión del dueño y `P7` es un
`CHECK` sobre una columna cuya forma ya la daba por supuesta el código. Las otras cinco **esperan a
que una pregunta se conteste**, y cuál es se ve de un tirón:

| Cambio | Espera a |
|---|---|
| **`P2-bis`** la línea tiene fila | `D1` (contar lo que depende de `variation_key`) — y **ojo**, no a `A`: dar fila a la línea no implica mover el vínculo a ella |
| **`P3`** ¿sobreviven `template_scope` y `owner_person_id`? | la prueba falsable de **`C`** |
| **`P4`** imponer la dirección que falta | **`A`**: no se puede imponer una regla sin saber qué pareja es legal |
| **`P5`** renombrar `process_target_rules` | **`E`**: si la serie y el alcance solapan, puede que una de las dos no exista |
| **`P6`** el renombrado completo | **`P2-bis` + `P3` + `P5`**, porque las tres pueden hacer desaparecer columnas |

⚠️ **Y UN AVISO SOBRE CÓMO SE CUENTA ESTO.** El 2026-10-11 se enseñó «**2 de 2** ejecutables», y el
dueño lo cazó: la palabra «ejecutables» **estrechaba el denominador de 7 a 2** para que cuadrara.
Eso es lo contrario de lo que pide el §6 de la norma de esta carpeta —*el denominador se recuenta,
no se recorta*—. Y el mismo día, en el mismo fichero, **se volvió a fallar al escribir el aviso**: la
cabecera decía «el denominador vivo es 17» cuando son **18**. La conclusión práctica no es «tener más
cuidado»: es **contar la tabla con un script antes de enseñar la cifra**, que es lo que se hizo para
corregirla. Peor: cinco de los siete cambios **no estaban en esta tabla**, sólo en la
conversación, así que el plan mentía por omisión. Están todos aquí desde entonces. **Si un cambio no
tiene fila, no existe.**

⚠️ **`Z` se llamaba `D` el 2026-10-09** y hubo que renombrarla: al entrar las preguntas `D` y `E` el
identificador colisionaba. Se hace constar en vez de borrarlo, porque la norma dice que un
identificador no se renumera — y éste se renumeró a los dos días, antes de que nadie lo citara en un
commit. Si ves un `D` suelto en un texto de ese día, habla de la decisión, no de `variation_key`.

| Tarea | Qué entrega | Estado | Evidencia | Fecha |
|---|---|:--:|---|---|
| **A1** | **El censo real de parejas**: qué combinaciones `(process_definition_versions, ediciones)` existen hoy y cuáles deja pasar `trg_pdt_linea_unica`, probadas en SQL dentro del contenedor **en transacciones revertidas**. Sin tocar datos | ⬜ | | |
| **A2** | **El espacio de diseño de la regla de pertenencia**: las formas posibles de «qué pareja es legal» —línea, versión↔versión, versión↔línea con una activa, y las que aparezcan—, cada una con qué impide, qué permite y qué cuesta imponerla. **Sin elegir** | ⬜ | | |
| **B1** | **Qué obliga a qué, medido**: los caminos que crean o mueven un `vinculo` (clon, CRUD genérico, asistente, bootstrap, scripts) y, para cada uno, qué hace con la versión de la plantilla y con la de la configuración | ⬜ | | |
| **B2** | **El espacio de diseño de las dos direcciones**: qué significaría imponer «plantilla nueva → configuración nueva», la contraria, las dos, o ninguna; y qué se rompe en cada caso | ⬜ | | |
| **C1** | **Qué es hoy `ad_hoc`, medido**: cuántos caminos lo crean, de qué configuración cuelga, qué línea le toca, y qué hace el disparador con dos plantillas `ad_hoc` de personas distintas | ⬜ | | |
| **C2** | **El espacio de diseño de `ad_hoc`**: si sigue existiendo, con qué pertenencia, y qué pasa con el «Proceso por defecto» en cada opción | ⬜ | | |
| **D1** | **El censo de lo que depende de `variation_key`**: cuántas consultas filtran o agrupan por ella, y qué `JOIN` necesitarían si se retira | ⬜ | | |
| **D2** | **El espacio de diseño**: quitar la copia (índices sobre `series_id`) **frente a** dar fila a la línea (tabla `lineas`). El dueño ya se inclinó por la segunda; falta medir el coste | 🟡 | el dueño eligió **P2-bis** el 2026-10-11, condicionado a ver el modelo | |
| **E1** | **Medir el solapamiento serie ↔ alcance**: qué puede expresar cada una, y cuántas reglas reales se podrían escribir desde los dos lados | ⬜ | | |
| **E2** | **El espacio de diseño**: si la variación es una **vista** de sus alcances y no una tabla | ⬜ | | |
| **P1** | **Una sola edición publicada por entregable, garantizado por la BASE** | ✅ | `publicada_flag` + `uq_ediciones_una_publicada`; provocado: rechaza la segunda publicada y deja pasar un borrador; 320/320 char sin mover un golden; 4 puertas de documentación | 2026-10-11 |
| **P7** | **La versión de una edición tiene forma de semver**, impuesto por la base | ✅ | `CHECK (storage_version ~ '^[0-9]+\.[0-9]+\.[0-9]+$')`; provocado con `'v2'` y con `'1.0'`, rechaza las dos | 2026-10-11 |
| **P2** | ⛔ **DESCARTADA** · quitar `variation_key` dejando los índices sobre `series_id`, sin tabla nueva. La sustituye `P2-bis` | ⛔ | el dueño eligió dar fila a la línea: *«quedemos con P2bis»* | 2026-10-11 |
| **P2-bis** | **La línea tiene fila**: tabla `lineas` con `(process_id, series_id)` y único sobre la pareja; `ediciones_de_proceso` apunta a ella con **una** columna, y los dos únicos bajan de tres columnas a dos. `variation_key` desaparece | ⬜ | | |
| **P3** | **Decidir si `template_scope` y `owner_person_id` sobreviven** en `formatos`, según la prueba falsable de `C` | ⬜ | | |
| **P4** | **Imponer en el modelo la dirección que falta** entre los dos ejes de versión (decisiones 2 y 3 del dueño) | ⬜ | | |
| **P5** | **Renombrar `process_target_rules`** a algo que **no sea `alcances`** —`destinatarios`, `cobertura`, `a_quien_alcanza`—, porque `alcance` y `ambito` están reservados por el frente 18 | ⬜ | | |
| **P6** | **El renombrado completo**: `catalogo_documental`→`formatos`, `available_formats`→`archivos`, `storage_version`→`version`, `process_definition_versions`→`ediciones_de_proceso` | ⬜ | | |
| **Z** | **La decisión del dueño sobre las cinco preguntas**, registrada aquí con su porqué y con lo que se descarta y por qué | ⬜ | | |

⚠️ **A1, B1 y C1 son MEDICIÓN; A2, B2 y C2 son ESPACIO DE DISEÑO; D es decisión.** No se mezclan, y
el orden importa: medir qué **hace** el modelo no dice qué **debe** hacer — lo dijo el dueño al abrir
el frente, y es el motivo de que las seis primeras tareas no propongan nada.

---

## 1 · Por qué, en una frase

El frente 23 cerró con esta frase del dueño, y se implementó:

> *«Una versión de plantilla debería servir a solo una variación de proceso. Si hago un cambio a la
> versión de plantilla eso debería llevar a una nueva definición de proceso.»*

Y el **2026-10-09** el propio dueño la corrigió:

> *«Creo que una versión de plantilla no sirve a una sola variación de proceso sino a una **versión de
> variación de proceso**.»*

**Tenía razón, y el modelo le da la razón a medias** — que es justamente el problema. Lo que hay hoy
es un enlace **versión↔versión** con una restricción de **línea**, y las dos cosas no son lo mismo.

---

## 2 · Lo que YA está medido (2026-10-09)

Esto no hace falta volver a medirlo; es el punto de partida.

### 2.1 El enlace apunta a una VERSIÓN; la restricción compara la LÍNEA

| | |
|---|---|
| `vinculos.process_definition_id` → | `process_definition_versions` — una **versión** |
| Único de `vinculos` | `(process_definition_id, edicion_id)` — **la pareja**, no la edición sola |
| Lo que compara `trg_pdt_linea_unica` | `(process_id, series_id)` — la **línea** |

Y el disparador lo dice de sí mismo:

> *«EL ENTREGABLE, no la edición. La regla es del libro: sus ediciones son la v1 y la v2 de la misma
> cosa, y lo que no puede partirse entre dos líneas es la cosa.»*

**Consecuencia: una edición PUEDE estar vinculada a varias versiones de la misma variación.** No es
teoría — `cloneProcessDefinitionChildren` lo hace, y su propio comentario lo explica:

> *«Copia el MISMO `edicion_id` a una definición nueva de la MISMA línea, así que un único sobre esa
> columna sola lo rechazaba.»*

Esa es la razón de que `F1.1` del frente 23 **no** se pudiera hacer con el índice único que su plan
proponía, y de que acabara siendo un disparador. El plan registró el cambio de mecanismo; **no
registró que eso cambiaba la regla**.

### 2.2 Ninguna de las dos direcciones está impuesta

| Dirección | ¿La impone algo? |
|---|---|
| plantilla nueva → configuración nueva | **No.** El disparador sólo rechaza el cruce de línea. Vincular la v1.1 a la **misma** configuración pasa |
| configuración nueva → plantilla nueva | **No, y es lo contrario**: el clon reutiliza la misma edición a propósito |

### 2.3 Hay dos ejes de versión y nada dice cómo se cruzan

```
configuración:   v1 ─── v2 ─── v3        (process_definition_versions)
plantilla:       v1.0 ─ v1.1              (ediciones)
                  ╲   ╳   ╱
            cualquier pareja de la misma línea es legal hoy
```

### 2.4 `ad_hoc` existe, está implementado, y su pertenencia no está clara

`catalogo_documental.template_scope` admite `official` | `ad_hoc`, y el esquema distingue:

> *«`owner_person_id` SE QUEDA, y no es lo mismo: es la persona dueña de un entregable `ad_hoc` —el
> que alguien crea **para sí, fuera de toda configuración**—, no la línea de proceso a la que sirve.»*

**Y no es un vestigio.** Medido en el código, no en los datos:

| | |
|---|---|
| `templateLifecycle.js:1753` | lo escribe, con su propio prefijo de MinIO |
| `workflows.js:52-55, 576` | le abre un resolutor extra (`specific_person`) que `official` no tiene |
| `AdminDraftArtifactModal.vue:681-683` | su etiqueta y el gateado de opciones |
| `ProcessGraphView.vue:846` | versionar sólo está disponible para `ad_hoc` |

⚠️ **En la base de dev hay 0 `ad_hoc` y 1 `official`, y eso NO prueba nada**: los datos de dev son
fixtures. La pregunta se contesta sobre el modelo y el código.

**La tensión, dicha entera:** una plantilla `ad_hoc` es **de una persona**, pero para existir tiene
que colgar de una configuración, y la que le dan es la del **«Proceso por defecto»** — un centinela
que existe precisamente para lo que no tiene proceso. Si su línea es la del centinela, entonces
**todas las plantillas propias de todo el mundo comparten línea**, y el disparador las juzga juntas.
Eso es `C1`, y **está sin medir a propósito**.

---

## 3 · Las tres preguntas, con lo que se sabe y lo que no

### A · ¿Qué pareja (configuración, plantilla) es legal?

| | |
|---|---|
| **Se sabe** | hoy es cualquiera de la misma línea; el enlace es a una versión y la guarda compara la línea |
| **No se sabe** | si la intención era línea, versión↔versión, o «una activa por línea» |
| **Lo que lo contesta** | `A1` (qué deja pasar hoy) + `A2` (qué opciones hay) + la decisión |

⚠️ **Y ojo con el impulso de apretar la regla.** Si se pasa a versión↔versión estricto, **el clon de
configuraciones deja de funcionar** tal como está: copia la misma edición a propósito. Esa es la
medida que `A2` tiene que traer, no una opinión.

### B · ¿Qué obliga a qué, entre los dos ejes de versión?

| | |
|---|---|
| **Se sabe** | ninguna de las dos direcciones está impuesta, y el clon va en contra de una de ellas |
| **No se sabe** | si la frase original del dueño era una regla a imponer o una descripción de la intención |
| **Lo que lo contesta** | `B1` (qué hace cada camino) + `B2` (qué significaría imponer cada dirección) |

### C · ¿`ad_hoc` dice algo que `origin_kind` no diga ya? — **LA PRUEBA FALSABLE**

**Reformulada el 2026-10-11, y el mérito es del dueño**: *«lo que debemos analizar bien es si es un
proceso o es una tarea a la que se le carga una plantilla»*. Al medirlo, **el modelo ya tenía la
respuesta escrita en otra tabla**:

```sql
task_items.origin_kind TEXT CHECK (origin_kind IN ('process_defined','user_added'))
```

| Dónde | Columna | Valores | ¿La escribe alguien? |
|---|---|---|---|
| **el entregable** | `task_items.origin_kind` | `process_defined` / `user_added` | **SÍ**: los dos caminos de alta de `GeneralTaskService` (líneas 285 y 447) |
| **la plantilla** | `catalogo_documental.template_scope` | `official` / `ad_hoc` | **NO**: ningún camino escribe `ad_hoc` jamás |

Y la del entregable no es decorativa: **dos columnas generadas dependen de ella** y se anulan cuando
es `user_added` —`process_definition_template_key` y `responsible_position_key`—, o sea que el modelo
**ya sabe** que un entregable añadido por una persona no cuelga de un vínculo ni de un puesto
predefinido.

**La prueba, y por eso es falsable y no una preferencia:**

> **Encontrar UN caso que `origin_kind = 'user_added'` no pueda expresar y `template_scope = 'ad_hoc'`
> sí.**

- **Si existe** → son dos distinciones distintas y las dos columnas se quedan.
- **Si no existe** → `template_scope` y `owner_person_id` son **el `owner_process_id` del frente 23
  otra vez**: una copia mal colocada de algo que vive un nivel más abajo, y se retiran. La
  distinción se queda donde funciona: en la tarea.

⚠️ **Y eso cambia también la pregunta 4a del dueño** («¿cómo pasar de `ad_hoc` a `official`?»). Si la
distinción es de la tarea, promover no es «ascender una plantilla»: es **parametrizar una tarea que
se repite**, que es exactamente *crear un proceso*. La pregunta deja de ser de plantillas y pasa a
ser del motor de procesos.

### C-viejo · ¿Qué es una plantilla que no es de ningún proceso?

| | |
|---|---|
| **Se sabe** | `ad_hoc` existe, está implementado en los dos lados, y su dueño es una persona |
| **No se sabe** | de qué línea es cuando cuelga del Proceso por defecto, ni qué hace el disparador con dos de personas distintas |
| **Lo que lo contesta** | `C1` (medirlo) + `C2` (si sigue existiendo y con qué pertenencia) |

---

## 4 · Lo que este frente NO hace

- **No cambia código ni esquema.** Las seis primeras tareas sólo miden y enumeran.
- **No elige por el dueño.** `A2`, `B2` y `C2` entregan el espacio de diseño **completo**, con el
  coste de cada opción y lo que cada una rompe. La elección es `D`.
- **No toca datos.** `A1` y `C1` prueban en SQL **dentro de transacciones revertidas**.
- **No retira `ad_hoc`.** Si de `C2` saliera que debe morir, eso es otro frente: retirar una
  capacidad del producto no es reordenar un modelo.

---

## 5 · Qué bloquea este frente, y qué NO

**Bloquea la decisión 2 de `F7.0`** del [frente 22](./mapa-modulos-2026-10.md) —¿`plantillas` y
`procesos` son un dominio o dos?— y con ella el tramo `plantillas` de `F7.5`.

El 2026-10-09 se midió que la respuesta de hoy es **dos**, y el argumento decisivo resultó ser que
`ad_hoc` existe: si una plantilla puede ser de una persona y de ningún proceso, `plantillas` no cabe
dentro de `procesos`. **Pero ese argumento depende justo de la pregunta `C`.** Así que la decisión 2
queda **condicionada**, no resuelta.

⚠️ **NO bloquea `F7.5` entera.** El tramo `tareas` —9 tablas repartidas, el más grande— no depende de
nada de aquí. Si este frente tarda, hay trabajo que avanzar al lado.

---

## 6 · Lo que corrige del frente 23

El [frente 23](./plantillas-y-entregables-2026-10.md) está **cerrado y bien cerrado**: sus nueve
tareas hicieron lo que decían. Lo que hay que corregir es **una frase**, no el trabajo:

> «una versión de plantilla sirve a una sola variación de proceso»

Es cierta al nivel de la **línea** y falsa si se lee como «una sola versión de configuración». El
propio plan registró que el índice único se descartó por el clon; lo que no registró es que ese
cambio de mecanismo **cambiaba el alcance de la regla**. Se anota allí cuando `D` esté decidida — no
antes, para no dejar dos versiones de la misma afirmación en dos sitios.
