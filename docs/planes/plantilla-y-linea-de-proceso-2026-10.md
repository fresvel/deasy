# Frente 25 · Qué pareja (configuración, plantilla) es legal — y qué es una plantilla sin proceso

> **Estado**: 🟡 **8 de 26 vivas** — 28 filas en el control, dos fuera (`P2` descartada ·
> `P11` al [frente 26](./ciclos-en-los-grafos-2026-10.md)); contado con script, no a ojo · abierto el
> **2026-10-09**
> **Abierto por una observación del dueño** que corrige al frente 23.

**Nació como análisis puro y ya no lo es.** Son **cinco** preguntas de modelo (`A`…`E`) cuyo
entregable es lo medido y el espacio de diseño, para que el dueño decida en `Z`; más los **cambios
`P`**, que salen de decisiones ya tomadas. `P1` y `P7` están **hechos** (2026-10-11); el resto espera
a que las preguntas se contesten, porque pueden hacer desaparecer columnas enteras.

## 0-bis · DECISIONES YA TOMADAS por el dueño (2026-10-09 / 10-11)

**Esto no es análisis: está decidido y se ejecuta.** Se separa del control de tareas a propósito,
porque el frente nació como análisis y **todas** salieron de la conversación. Cada una con la
frase del dueño que la fija.

⚠️ **Aquí ponía «estas siete» y ya eran catorce.** La cifra se escribió el 2026-10-09 y no se
recontó al añadir las siguientes, que es el mismo fallo que el §0 documenta dos párrafos más abajo
—el denominador no se recorta ni se deja caducar— cometido en el párrafo que lo precede. Se quita la
cifra del texto: la tabla se cuenta sola.

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
| **10** | **La línea lleva `linea_anterior_id`**, el linaje que resuelve la reorganización | *«sí, agreguemos»* |
| **11** | **`linea_anterior_id` OBLIGA a retirar** la línea anterior, con su `effective_to` | *«sí debería obligar a retirar»* |
| **12** | **Si cambia el cargo que produce el documento, es otra LÍNEA** — no otra versión | *«si se va a otro cargo sería otra línea y debería serlo»* (70 % firme; el 30 % de duda lo resuelve el linaje de la decisión 10) |
| **13** | **`lineas` sustituye a `process_definition_series`** | *«de acuerdo a mi criterio la línea la sustituye»* |
| **14** | **NO se permiten ciclos** en `linea_anterior_id` — **ni en `processes.parent_id`** | *«no debería permitir ciclos (en procesos tampoco)»* |
| **15** | **La casilla ② es NECESARIA**: una obligación institucional se puede encargar a mano con el formato de la institución | *«estaríamos hablando más bien de una extensión/reasignación»* — y la evaluación de mundo real la confirmó |
| **16** | **La casilla ③ NO se permite**: un formato personal nunca detrás de una obligación institucional | *«esto no debe ser permitido»* |
| **17** | **La casilla ④ se implementa**: encargar con un formato propio. La vía de adopción se decide después | *«esta implementación era la que buscaba»* · *«la adopción se definiría después»* |
| **18** | **La matriz NO colapsa**: los dos ejes se quedan, porque son el **papel** y el **encargo**, con vidas distintas | sale de su propia pregunta: *«si esa también se bloquea entonces hay un colapso… que podría simplificarse»* — y se midió que no |
| **19** | **Los cuatro valores se renombran**, porque describen el modo y no la cosa: `origin_kind`→**`origen`** `(lanzamiento, encargo)` y `template_scope`→**`propiedad`** `(institucional, personal)` | *«evalúa si esos 4 nombres/etiquetas de la matriz pueden mejorarse por algo más entendible»* |

⚠️ **LA DECISIÓN 14 ES MÁS GRANDE QUE ESTE FRENTE, y eso se midió el 2026-10-11.** El esquema tiene
**CINCO claves ajenas autorreferenciales y CERO protección de ciclos**:

| Tabla | Columna |
|---|---|
| `processes` | `parent_id` |
| `ediciones` | `parent_version_id` |
| `process_runs` | `source_run_id` |
| `task_items` | `source_task_item_id` |
| `chat_messages` | `reply_to_message_id` |

**Y el ciclo se crea sin resistencia.** Provocado en una transacción revertida: dos procesos
apuntándose mutuamente, insertados sin un solo error. Y `processes.parent_id` está expuesto en
`/admin` como un campo `number` libre, así que **un humano puede teclear el ciclo a mano**.

✅ **DECIDIDO el 2026-10-11: frente propio.** *«Para los ciclos frente propio»* → el
**[frente 26](./ciclos-en-los-grafos-2026-10.md)**. De aquí sale `P11`, y lo único que queda en este
frente es que **`lineas.linea_anterior_id` nazca ya protegido** cuando la tabla se cree.

⚠️ **Y DOS COSAS QUE ESTE AVISO DECÍA Y LA MEDICIÓN DESMINTIÓ**, las dos mías, corregidas al abrir el
frente 26:

| Decía | Lo medido |
|---|---|
| «**cero** protección de ciclos» | **cero en el esquema**, sí — pero hay **dos guardias en código**: `wouldCreateProcessCycle` para `processes` y `existeCaminoEntreUnidades` para el organigrama. Lo que comparten es el defecto: `WITH RECURSIVE … UNION ALL` sin `CYCLE` ni límite, o sea **se cuelgan si el ciclo ya existe** |
| «**nada recorre** esas cadenas de forma recursiva, comprobado» | hay **cinco** CTEs `WITH RECURSIVE` en el backend, y una de ellas es justo el guardia. La comprobación que escribí buscaba lectores de la columna, no recorridos del grafo |
| «**cinco** claves ajenas autorreferenciales» | **seis grafos**: el censo por `conrelid = confrelid` **no ve `unit_relations`**, que es una tabla de aristas. Buscar «la columna que apunta a su tabla» encuentra los árboles y se le escapan los grafos |

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

⚠️ **QUÉ ESTÁ HECHO Y QUÉ ESPERA A QUÉ.** `P1` y `P7` se ejecutaron el 2026-10-11 porque no
dependían de ninguna pregunta abierta: `P1` sale de una decisión del dueño y `P7` es un `CHECK` sobre
una columna cuya forma ya la daba por supuesta el código. **La pregunta `C` quedó contestada el mismo
día** —`C1`, `C2` y con ellas `P3`— y de ella salieron `P13`…`P16`. El resto **espera a que una
pregunta se conteste**, y cuál es se ve de un tirón:

| Cambio | Espera a |
|---|---|
| ~~**`P2-bis`** la línea tiene fila~~ | ✅ **`D1` contestada** el 2026-10-11 (§7). Se ejecuta con `P8`, que es la misma tabla — y **ojo**, sigue sin depender de `A`: dar fila a la línea no implica mover el vínculo a ella |
| ~~**`P3`** ¿sobreviven `template_scope` y `owner_person_id`?~~ | ✅ **contestada**: la prueba falsable encontró el caso, sobreviven las dos |
| ~~**`P13`** prohibir la casilla ③~~ | ✅ **hecha** el 2026-10-11, con dos disparadores |
| **`P14`** abrir la casilla ④ | **`P13`** |
| **`P15`** renombrar los cuatro valores · **`P16`** atar `propiedad` al dueño | **`P6`**, el renombrado completo |
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
| **C1** | **Qué es hoy `ad_hoc`, medido**: cuántos caminos lo crean, de qué configuración cuelga, qué línea le toca, y qué hace el disparador con dos plantillas `ad_hoc` de personas distintas | ✅ | **cero caminos lo crean**; las cuatro casillas de la matriz probadas en transacciones revertidas: ① `task_items` 4-5, ② `task_items` 1 y el **100 %** de lo ad-hoc, ③ **alcanzable y nadie la valida** (provocada), ④ inalcanzable. §0-quater | 2026-10-11 |
| **C2** | **El espacio de diseño de `ad_hoc`**: si sigue existiendo, con qué pertenencia, y qué pasa con el «Proceso por defecto» en cada opción | ✅ | la matriz 2×2 con las cuatro casillas analizadas y la evaluación de mundo real de la ②; el «Proceso por defecto» **es** la ② (`getActiveGeneralDefinition` toma el vínculo de una configuración `official`). Decisiones 15-18 | 2026-10-11 |
| **D1** | **El censo de lo que depende de `variation_key`**: cuántas consultas filtran o agrupan por ella, y qué `JOIN` necesitarían si se retira | ✅ | **§7**, medido con script: **130 ocurrencias en 36 ficheros** de código (el censo viejo decía 156/43 y contaba la documentación). **28 sentencias SQL**: 8 filtran · 4 escriben · 2 ordenan · 14 sólo la devuelven. **Coste neto: 10 consultas necesitan un `JOIN` nuevo; las otras 18 se simplifican o cambian uno que ya pagan.** Y el hallazgo: **dos índices ÚNICOS están sobre la copia**, que arrastra un gancho **no transaccional** — y la copia **ya está derivada en el 100 % de las filas** | 2026-10-11 |
| **D2** | **El espacio de diseño**: quitar la copia (índices sobre `series_id`) **frente a** dar fila a la línea (tabla `lineas`). El dueño ya se inclinó por la segunda; falta medir el coste | ✅ | el dueño eligió **`P2-bis`** el 2026-10-11 tras ver el modelo (§0-ter), y `D1` trajo **el coste que faltaba** (§7): 10 `JOIN` nuevos como techo, contra 18 consultas que se simplifican, 3 índices que pierden una columna y una cascada no transaccional que desaparece | 2026-10-11 |
| **E1** | **Medir el solapamiento serie ↔ alcance**: qué puede expresar cada una, y cuántas reglas reales se podrían escribir desde los dos lados | ⬜ | | |
| **E2** | **El espacio de diseño**: si la variación es una **vista** de sus alcances y no una tabla | ⬜ | | |
| **P1** | **Una sola edición publicada por entregable, garantizado por la BASE** | ✅ | `publicada_flag` + `uq_ediciones_una_publicada`; provocado: rechaza la segunda publicada y deja pasar un borrador; 320/320 char sin mover un golden; 4 puertas de documentación | 2026-10-11 |
| **P7** | **La versión de una edición tiene forma de semver**, impuesto por la base | ✅ | `CHECK (storage_version ~ '^[0-9]+\.[0-9]+\.[0-9]+$')`; provocado con `'v2'` y con `'1.0'`, rechaza las dos | 2026-10-11 |
| **P2** | ⛔ **DESCARTADA** · quitar `variation_key` dejando los índices sobre `series_id`, sin tabla nueva. La sustituye `P2-bis` | ⛔ | el dueño eligió dar fila a la línea: *«quedemos con P2bis»* | 2026-10-11 |
| **P2-bis** | **La línea tiene fila**: tabla `lineas` con `(process_id, series_id)` y único sobre la pareja; `ediciones_de_proceso` apunta a ella con **una** columna, y los dos únicos bajan de tres columnas a dos. `variation_key` desaparece | ⬜ | ✅ **desbloqueada**: `D1` cerrada el 2026-10-11 con el coste medido (§7). **Se ejecuta junto a `P8`**, que es la misma tabla con sus dos ejes | |
| **P3** | **Decidir si `template_scope` y `owner_person_id` sobreviven** en `formatos`, según la prueba falsable de `C` | ✅ | **sobreviven las dos**: la prueba **encontró el caso** —la ② es `user_added` + `official`, o sea los dos ejes toman valores independientes— así que no son una copia de `origin_kind`. Cambian de nombre (decisión 19), no de existencia | 2026-10-11 |
| **P4** | **Imponer en el modelo la dirección que falta** entre los dos ejes de versión (decisiones 2 y 3 del dueño) | ⬜ | | |
| **P5** | **Renombrar `process_target_rules`** a algo que **no sea `alcances`** —`destinatarios`, `cobertura`, `a_quien_alcanza`—, porque `alcance` y `ambito` están reservados por el frente 18 | ⬜ | | |
| **P6** | **El renombrado completo**: `catalogo_documental`→`formatos`, `available_formats`→`archivos`, `storage_version`→`version`, `process_definition_versions`→`ediciones_de_proceso` | ⬜ | | |
| **P8** | **La tabla `lineas`**, con los dos ejes (`cargo_id` + `unit_scope_type`/`unit_type_id`/`unit_id`), nombre propio, vigencia y `linea_anterior_id`; `process_definition_versions.linea_id` en lugar de `(process_id, series_id, variation_key)`; los dos únicos bajan a dos columnas | 🟡 | **HECHO**: la tabla con sus **8 garantías provocadas** una por una (el alcance y su columna van juntos ×2, la identidad con `NULLS NOT DISTINCT`, suceder a una vigente, retirar-y-suceder, la autosucesión, la vigencia al revés, y los dos ejes juntos); la columna `linea_id` (NULL-able) con su índice; el arranque crea la línea del «Proceso por defecto». 320/320 char, 894/894 unitarios, 5 puertas del backend, 5 de documentación, 4 páginas del sitio y el modelo regenerado. **DÓNDE ME QUEDÉ**: faltan las 28 sentencias (`P2-bis`) y el camino de creación, que es `P9` — hoy manda la serie | |
| **P9** | **Retira `process_definition_series`** y sus seis mecanismos (el `XOR`, el `code` derivado, las dos cascadas, `variation_key` y su hook). **65 ocurrencias en 21 ficheros**, 11 del frontend | ⬜ | **depende de `P8`** | |
| **P10** | **`process_target_rules` se queda sólo con el CÓMO y el CUÁNDO**: el `cargo_id` y el eje estructural suben a la línea; la regla conserva `recipient_policy`, `priority`, vigencia y el refinamiento `unit_exact`/`unit_subtree` **dentro** del ámbito de la línea. Hay que decidir columna por columna: hoy son **13** | ⬜ | **depende de `P8`** | |
| **P11** | ⛔ **SALE DE ESTE FRENTE** · los ciclos en las claves ajenas autorreferenciales. Se abre el **[frente 26](./ciclos-en-los-grafos-2026-10.md)**, donde al medirlo resultaron ser **seis** grafos y no cinco | ⛔ | decisión del dueño: *«para los ciclos frente propio»*. Lo que queda aquí es que **`lineas.linea_anterior_id` nazca ya protegido**, lo que el frente 26 deja escrito en su §5 | 2026-10-11 |
| **P12** | **La bifurcación del linaje es DELIBERADA**: se permite que dos líneas sucedan a la misma —una obligación que se parte es real— pero crear el segundo sucesor avisa. Las **fusiones no se pueden declarar** con una sola columna, y queda dicho | ⬜ | **depende de `P8`** | |
| **P13** | **La casilla ③ queda PROHIBIDA por el modelo** (decisión 16): un `vinculo` no puede apuntar a una edición cuyo formato sea **personal** | ✅ | **DOS** disparadores, porque con uno solo se rodea en dos pasos: `trg_vinculo_solo_formato_oficial` y `trg_formato_vinculado_sigue_oficial`. Provocados los **cinco** casos: ③ rechazada · ① pasa · el rodeo (`UPDATE` a `ad_hoc` de un formato vinculado) rechazado · un formato **sin** vincular sí puede volverse personal —lo necesita `P14`— · un `UPDATE` que sólo mueve `sort_order` pasa sin pagar el JOIN. **320/320 char sin mover un golden**, 894/894 unitarios, 5 puertas del backend, 4 de documentación, y dos páginas del sitio en el mismo commit | 2026-10-11 |
| **P14** | **La casilla ④ se abre** (decisión 17): el camino que crea un formato **personal** y encarga con él. **La vía de adopción —cómo un formato personal pasa a institucional— se decide aparte**, y es otro frente: parametrizar una tarea que se repite *es* crear un proceso | ⬜ | ✅ **`P13` hecha, así que está desbloqueada.** Y la prohibición ya deja sitio: un formato **sin vínculos** sí puede ser personal, comprobado al provocarla | |
| **P15** | **Los cuatro valores se renombran** (decisión 19): `task_items.origin_kind`→`origen` `(lanzamiento, encargo)` y `catalogo_documental.template_scope`→`propiedad` `(institucional, personal)`. **191 ocurrencias en 54 ficheros contados aparte**; toca la fachada de `sqlTables.js` y **dos columnas generadas** que leen `origin_kind` | ⬜ | **va con `P6`**, el renombrado completo, por la misma razón: renombrar dos veces cuesta el doble | |
| **P16** | **Atar `propiedad` a `owner_person_id`**, que hoy **nada relaciona**: un formato `official` puede tener dueño y uno `ad_hoc` puede no tenerlo. Si la implicación se impone, `propiedad` puede ser una **columna generada** y deja de haber dos verdades | ⬜ | **depende de `P15`** | |
| **Z** | **La decisión del dueño sobre las cinco preguntas**, registrada aquí con su porqué y con lo que se descarta y por qué | ⬜ | | |

⚠️ **A1, B1 y C1 son MEDICIÓN; A2, B2 y C2 son ESPACIO DE DISEÑO; D es decisión.** No se mezclan, y
el orden importa: medir qué **hace** el modelo no dice qué **debe** hacer — lo dijo el dueño al abrir
el frente, y es el motivo de que las seis primeras tareas no propongan nada.

---

## 0-ter · EL MODELO AL QUE SE LLEGÓ (2026-10-11)

**Esto es el resultado del análisis, y cambia la forma del frente.** Lo que sigue no es una propuesta
entre varias: es a lo que se llegó midiendo, con las decisiones del dueño ya tomadas encima.

### La raíz del enredo, medida

El dueño lo planteó así: *«llegábamos a lo mismo desde dos lugares y eso provoca confusión en el
usuario final»*. Y al medirlo, **la causa no era la que yo creía**.

**Lo que NO era:** la serie y la regla no están duplicadas. `applyTargetRuleSeriesConstraints`
**encadena** las dos, y lo impone: si la serie fija un cargo, el de la regla se **siembra** si falta y
se **rechaza** si difiere (*«El cargo de la regla debe coincidir con el cargo de la serie»*); si la
serie fija un tipo de unidad, el alcance de la regla queda **forzado** a ese tipo (*«El alcance de la
regla lo fija la serie; no puede cambiarse»*). La pregunta `E` tal como se escribió el 2026-10-09
**partía de una premisa falsa** y queda corregida.

**Lo que SÍ es:** la serie admite **un eje O el otro, nunca los dos**, y la base lo impone:

```js
if (source_type === "unit_type" && candidate.cargo_id)     throw «no admite cargo»
if (source_type === "cargo"     && candidate.unit_type_id) throw «no admite tipo de unidad»
```

**Y los cargos son genéricos.** Medido en el catálogo: `Coordinador` · `Docente` · `Responsable` ·
`Director` · `Prorrector` · `Asistente` · `Jefe`. **No existe «Coordinador de Carrera» ni «Director
de Investigación»**: el «de Carrera» sale de en qué unidad está el puesto (`unit_positions` → `units`
→ `unit_types`), no del cargo.

Así que **ninguno de los cuatro casos del dueño cabe en un solo eje**:

| Lo que se quiere | Hace falta | ¿Cabe en una serie? |
|---|---|---|
| IF de los **Coordinadores de Carrera** | `Coordinador` **+** tipo `Carrera` | ⛔ |
| IF de los **Directores de Escuela** | `Director` **+** tipo `Escuela` | ⛔ |
| IF de la **Dirección de Investigación** | `Director` **+** esa **unidad concreta** | ⛔ (y la serie no admite `unit`) |
| IF de los **Docentes de una Carrera** | `Docente` **+** tipo `Carrera` | ⛔ |

> **De ahí salen las dos formas de llegar a lo mismo: como la serie acepta un solo eje, el otro hay
> que ponerlo en la regla — y puedes elegir cuál va dónde.** `(Coordinador en la serie, Carrera en la
> regla)` o `(Carrera en la serie, Coordinador en la regla)`. Las dos pasan, significan cosas
> ligeramente distintas y al usuario le parecen iguales. **La variación está partida en dos tablas.**

⚠️ **Y dos correcciones a lo que se dijo por el camino, las dos mías:** llamé «hueco» a que la serie
no admita una unidad concreta —y el hueco real es que falta la **pareja**—; y recomendé que el eje
fuera **sólo el cargo**, lo que el catálogo de cargos genéricos **demuele**: `cargo = Director`
confundiría al Director de Escuela con el de Investigación, que es justo el ejemplo del dueño.

### El modelo

```
processes  1 ──── N  lineas  1 ──── N  ediciones_de_proceso
```

| Tabla | Qué es | Único |
|---|---|---|
| **`lineas`** | la **obligación**: qué documento, de quién, y dónde | `(process_id, cargo_id, ambito_tipo_id, ambito_unidad_id)` |
| **`ediciones_de_proceso`** | su **historia**: las versiones de esa obligación | `(linea_id, definition_version)` y `(linea_id, activa_flag)` |

```
lineas
  id
  process_id         ──► processes      «Informe de Investigación Formativa»
  cargo_id           ──► cargos         «Coordinador»                 ◄── el QUIÉN
  ambito_tipo_id     ──► unit_types     «Carrera»                     ◄── el DÓNDE
  ambito_unidad_id   ──► units          (alternativo a lo anterior)       estructural
  nombre             «IF · Coordinadores de Carrera»                  ◄── la etiqueta
  linea_anterior_id  ──► lineas         ◄── el LINAJE
  effective_from / effective_to
  CHECK num_nonnulls(ambito_tipo_id, ambito_unidad_id) = 1
```

⚠️ **ESE CROQUIS SE QUEDÓ CORTO EN DOS COSAS, y las dos las descubrió `P8` al construirlo
(2026-10-11). Se deja tal cual y se corrige aquí, porque es donde está el aprendizaje:**

| Lo que decía el croquis | Lo que la base pide |
|---|---|
| `CHECK num_nonnulls(ambito_tipo_id, ambito_unidad_id) = 1` | **haría ilegal el único caso que existe.** La única serie de una base sembrada es `source_type = 'default'` —el «sin variación» de los memos—, que no tiene ni cargo ni tipo de unidad. Hoy es el **100 %** de lo que hay. El alcance se **nombra**: `unit_scope_type` con `all_units` (el DEFAULT), `unit_type` o `unit_exact` |
| columnas `ambito_tipo_id` / `ambito_unidad_id` | **`ambito` NO SE PUEDE USAR**: está en los nombres muertos de `doc-modelo-excepciones.json`, **reservado por el frente 18**. El `CLAUDE.md` de la raíz lo dice con esas palabras y el croquis lo ignoró. Los nombres correctos **ya existían en el esquema**: `process_target_rules` nombra este mismo concepto `unit_scope_type` + `unit_type_id` + `unit_id`, igual que `participantes_declarados`. Mismo concepto, mismo nombre |

⚠️ **Y cómo se cazó, que es lo que importa:** `check-doc-modelo.mjs --update` **amplió la excepción de
`ambito` con las cinco páginas nuevas** en vez de quejarse. O sea que el gate se habría callado
tapando el choque, que es exactamente lo que la norma prohíbe. **Cuando `--update` toca la lista de
EXCEPCIONES y no sólo las huellas, para y mira qué acabas de hacer.**

Y una tercera, que el croquis no decía y la tabla sí necesita: **`NULLS NOT DISTINCT` en el único.**
En PostgreSQL `NULL <> NULL`, así que un único corriente dejaría crear **dos** líneas «sin variación»
del mismo proceso. Disponible desde PostgreSQL 15; aquí corre **17.10**.

**La cardinalidad ya está decidida en el modelo de hoy y no se invierte:** `series_id` es una sola
columna `NOT NULL` en la versión, o sea **una versión pertenece a UNA línea y una línea tiene MUCHAS
versiones**. Eso da la simetría completa con el lado del documento:

```
formatos  1 ──── N  ediciones              el documento y sus versiones
lineas    1 ──── N  ediciones_de_proceso    la obligación y su historia
```

⚠️ **`vinculos` sigue apuntando a la VERSIÓN, no a la línea.** Lo corrigió el dueño y sigue en pie:
una edición de plantilla sirve a una *versión de variación*, no a una variación.

### Lo que parecía una pérdida y es la mayor ganancia

Se presentó como coste: *«"la versión 2 de esta configuración va a otro cargo" deja de poder
expresarse»*. **Medido, hoy eso se puede hacer y produce una historia FALSA.**

`series_id` se elige **en cada versión** (`resolveProcessDefinitionSeries` la pide al crearla), así
que se puede escribir:

```
Informe de IF
  v1 · series = Coordinador     ← lo hacían los coordinadores
  v2 · series = Director        ← ahora los directores
```

Y el resultado es que *«la configuración del Informe de IF»* tiene dos versiones que **obligan a
gente distinta**, sin que nada diga que hubo un traspaso: hay que comparar las series de cada versión
a mano. **Peor:** el número de versión se calcula **por línea**
(`WHERE process_id = ? AND variation_key = ?`), así que esa `v2` es la **primera** versión de la línea
del Director… numerada 2. El contador y la realidad dejan de coincidir y nada lo impide.

Con el modelo nuevo eso **no se puede escribir**, y en su lugar queda el hecho declarado:

| Pregunta | Hoy | Con el modelo |
|---|---|---|
| ¿quién producía este informe en 2026? | mirar la serie de la versión vigente entonces | la línea lo dice, con su vigencia |
| ¿cambió de manos alguna vez? | **no se sabe sin comparar versiones** | `linea_anterior_id` lo declara |
| ¿cuántas versiones ha tenido la obligación de los coordinadores? | el contador miente si alguien cambió la serie | exacto: las de esa línea |
| ¿es el mismo documento? | ambiguo | **no**: son dos líneas, y una sucede a la otra |

**Es la misma idea que el frente 9 aplicó a las personas** —`task_item_tenures`, «una fila por turno,
con desde y hasta cuándo»— pero un nivel más arriba: **el relevo de la OBLIGACIÓN, no el del
responsable.**

### Lo que muere con esto

| | Por qué |
|---|---|
| `process_definition_series` | era «(cargo XOR tipo) + un `code` derivado». `lineas` lleva los dos ejes y nombre propio. **65 ocurrencias en 21 ficheros**, 11 de ellos del frontend |
| `source_type` y su `XOR` | el eje único **era la causa** de las dos formas |
| `code` derivado por `slugify(cargo.name)` | la línea tiene nombre escrito |
| `variation_key` | la línea tiene `id` |
| `resolveProcessDefinitionSeriesIdentity` | no hay identidad que derivar |
| `refreshSeriesNamesOnRename` ×2 + `refreshProcessDefinitionVersionNames` | **dos cascadas no transaccionales** que se disparaban al renombrar un cargo |

**Seis mecanismos.** Y la cadena de tres copias —`cargos.name` → `series.code` → `variation_key`— se
queda en una sola verdad.

## 0-quater · LA MATRIZ DE LOS DOS EJES, y por qué los cuatro nombres cambian (2026-10-11)

**Esto cierra la prueba falsable de `C`**, y el resultado es que la prueba **encontró el caso**: los
dos ejes son distinciones distintas y las dos columnas se quedan. Lo que no se queda son sus nombres.

### Los dos ejes, y qué clasifica cada uno

```
el FORMATO vive años          ← un formato, sus versiones, su linaje     ¿de quién es el papel?
el ENCARGO vive un periodo    ← un entregable, su recorrido, su cierre   ¿de dónde vino la obligación?
```

| Dónde | Columna | Valores | ¿La escribe alguien? |
|---|---|---|---|
| **el entregable** | `task_items.origin_kind` | `process_defined` / `user_added` | **SÍ**, los dos caminos de `GeneralTaskService` |
| **el formato** | `catalogo_documental.template_scope` | `official` / `ad_hoc` | **NO**: ningún camino escribe `ad_hoc` jamás |

### Las cuatro casillas, probadas una por una

Probado el 2026-10-11 **en transacciones revertidas**, sin tocar datos:

| | `official` | `ad_hoc` |
|---|---|---|
| **`process_defined`** | ✅ **①** existe — `task_items` 4 y 5 de la semilla | ⛔ **③** **ALCANZABLE Y NADIE LA VALIDA** |
| **`user_added`** | ✅ **②** existe — `task_items` 1, y es el **100 %** de lo ad-hoc de hoy | ⬜ **④** **inalcanzable**: ningún camino crea un formato `ad_hoc` |

**La ③ se provocó**: se insertó un `catalogo_documental` con `template_scope='ad_hoc'`, su `edicion`, y
un `vinculo` de esa edición a una configuración **institucional**. Pasó sin un solo error — ni `CHECK`,
ni disparador, ni guardia. `trg_pdt_linea_unica` comprueba la **línea**, no la propiedad del formato.

**La ② es el único camino ad-hoc que funciona**, y eso lo decide `GeneralTaskService`:
`getActiveGeneralDefinition` toma el `vinculo_id` de la **configuración activa del «Proceso por
defecto»**, cuyo formato es `official`. Así que hoy toda tarea ad-hoc es `user_added` + `official`.

### Por qué la ② hace falta en el mundo real

La alternativa era *«quien encarga algo siempre debe subir la plantilla con la que encarga»*. **El
problema no es la fricción, es el efecto de segundo orden: bloquear la ② no elimina el uso del
formato institucional fuera del lanzamiento — lo obliga a pasar por una COPIA.**

| Caso | Qué pasa si la ② está bloqueada |
|---|---|
| **La carrera creada tarde.** El Informe de IF se lanzó en marzo; en abril nace una carrera y su coordinador nunca recibió la tarea | el Director **sube una copia del formato institucional como suyo**. A partir de ahí hay **dos papeles** que dicen ser el Informe de IF, y cuando el catálogo saque la v1.1 la copia no se entera |
| **El acta que ya existe.** *«Para este convenio necesito un Acta de Reunión, la oficial»* | se sube **otra acta**. Y otra el mes siguiente. El catálogo deja de ser la fuente del formato |
| **La pregunta que nadie podrá responder.** *«¿Cuántos documentos se han producido con el Informe de IF?»* | hay que buscar entre N copias privadas con nombres distintos |

**Y la reformulación del dueño es la correcta: la ② no es «una tarea suelta», es EXTENDER una
obligación institucional a un caso que el lanzamiento no cubrió.**

| El lanzamiento cubre | La realidad trae |
|---|---|
| lo **planificado**: las unidades que existían, los cargos ocupados, el periodo abierto | la unidad nueva, el puesto que se llenó tarde, el caso imprevisto, la entrega que hay que repetir |

Un sistema que sólo permite obligar **por lanzamiento** obliga a mentir para cubrir lo imprevisto: o
relanzas el proceso entero para una persona, o duplicas el papel.

### Por qué la matriz NO colapsa

La hipótesis del dueño: si se bloquean ② y ③, queda `official ⟺ process_defined` y
`ad_hoc ⟺ user_added`, y una columna sobra. **El razonamiento es correcto; la premisa no se sostiene,
por dos medidas:**

1. **La ② es el único camino ad-hoc que existe.** Bloquearla rompe lo que hoy funciona: el entregable
   1 de la semilla, «Mis envíos», `GeneralTaskService` entero. No es una capacidad teórica que se
   pueda cerrar.
2. **Y aun abriendo la ④, siguen haciendo falta las dos**, porque un formato institucional sirve a
   **miles** de encargos, unos lanzados y otros pedidos a mano. Si el formato llevara pegado «esto se
   lanza» o «esto se pide», estaríamos metiendo una propiedad del **encargo** dentro del **papel** —
   y el papel tendría que duplicarse cada vez que cambia el modo de encargarlo. **Es exactamente el
   error que `owner_process_id` cometía, y que el frente 23 ya quitó.**

**La regla sale en una frase, y es la decisión 16:**

> **Un formato personal nunca puede estar detrás de una obligación institucional.**
> Todo lo demás vale: la institución obliga con su formato, y una persona encarga con el formato de la
> institución **o con el suyo**.

### Y los cuatro nombres son el defecto, con prueba

El dueño preguntó si `user_added` y `ad_hoc` son lo mismo. **No lo son** —la ② sería una
contradicción y es el 100 % de lo real— **pero la pantalla YA los confundió**, y está en el código:

```
AdminDraftArtifactModal.vue:114
  {{ isAdHoc ? "De usuario (ad-hoc)" : "De proceso (oficial)" }}
```

**El eje del formato rotulado con las palabras del eje del encargo.** Quien escribió ese rótulo leyó
`ad_hoc` y entendió «lo hizo un usuario». Y `AdminPresentationService.js:84` traduce
`{ official: "Oficial", ad_hoc: "Ad hoc" }` — **uno de los dos no se traduce**, se deja en latín.

| | Qué falla, medido |
|---|---|
| **`scope` significa otra cosa** | `template_scope` no dice *alcance*, dice *de quién es*. Y `alcance`/`ambito` están **reservados por el frente 18**, así que ni traducirlo literalmente se puede |
| **`ad_hoc` es latín** | ni castellano ni inglés; no significa nada para quien usa el sistema |
| **los cuatro describen el MODO, no la COSA** | «definido por proceso», «añadido por usuario», «oficial», «ad hoc»: los cuatro cuentan *cómo apareció*, ninguno dice *qué se clasifica* |
| **el precedente ya está en el esquema** | **`emails.tipo IN ('personal','institucional')`** — la misma distinción, ya en castellano. No hay que inventar nada |
| **y nada ata `owner_person_id` a `template_scope`** | no hay `CHECK`: hoy un formato `official` puede tener dueño y uno `ad_hoc` puede no tenerlo |

**La prueba de que un nombre es mejor no es estética, y se puede comprobar: una buena pareja de
nombres hace que la casilla ilegal se lea sola como ilegal.**

| | Cómo se lee la ③ |
|---|---|
| **Hoy** | «`process_defined` + `ad_hoc`» → **suena razonable**. Por eso la casilla era alcanzable y nadie lo notó en meses |
| **Con los nombres nuevos** | «lanzamiento + personal» → *la institución obliga a cientos de personas con el papel privado de alguien*. **Se lee mal sin que nadie lo explique** |

| Eje | Qué clasifica | Hoy | **Decisión 19** |
|---|---|---|---|
| **el encargo** (`task_items`) | de dónde viene la obligación | `origin_kind ∈ (process_defined, user_added)` | **`origen ∈ (lanzamiento, encargo)`** |
| **el formato** (`formatos`) | de quién es el papel | `template_scope ∈ (official, ad_hoc)` | **`propiedad ∈ (institucional, personal)`** |

«lanzamiento» ya es la palabra del repositorio (`process_runs`, «al lanzar») y «encargo» es la del
dueño. Ninguna se inventa. Y con ellas **ningún valor se repite entre ejes**, que es justo lo que hoy
no pasa:

| | **institucional** | **personal** |
|---|---|---|
| **lanzamiento** | ✅ **①** la institución obliga con su formato | ⛔ **③** la institución obliga con el formato de alguien |
| **encargo** | ✅ **②** alguien encarga con el formato de la institución | ✅ **④** alguien encarga con el suyo |

⚠️ **Coste del renombrado, contado:** `template_scope` 50 ocurrencias en 22 ficheros · `ad_hoc` 55 en
18 · `origin_kind` 42 en 26 · `user_added` 22 en 17 · `process_defined` 22 en 12. Y **dos trampas**:
`sqlTables.js` expone `template_scope` como campo de `ediciones` **por fachada** (`confusiones.md` §4),
así que el renombrado toca el JOIN y no sólo la columna; y `origin_kind` **gobierna dos columnas
generadas** (`process_definition_template_key`, `responsible_position_key`), que se anulan cuando vale
`user_added` — renombrar el valor obliga a reescribir las dos expresiones generadas.

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

✅ **CONTESTADA el 2026-10-11, y el caso EXISTE: la casilla ②.** `task_items` 1 es `user_added` **+**
`official`, o sea los dos ejes toman valores independientes sobre la misma fila — y no es un caso de
laboratorio: es el **100 %** de lo ad-hoc que funciona hoy. **Las dos columnas se quedan**, y lo que
cambia son sus nombres. La matriz completa, la evaluación de mundo real y el análisis de los cuatro
nombres están en **§0-quater**.

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

- ⚠️ **«No cambia código ni esquema» DEJÓ DE SER CIERTO el 2026-10-11**, y se deja escrito en vez de
  borrarlo: `P1` y `P7` tocaron `postgres_schema.sql`. El frente nació como análisis y dejó de serlo
  en cuanto el dueño fijó decisiones. Lo que **sigue** siendo cierto es que las tareas `A1`…`E2` sólo
  miden y enumeran.
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
dentro de `procesos`. **Ese argumento dependía de la pregunta `C`, y `C` se contestó el 2026-10-11.**

✅ **La condición se levanta, y la respuesta es DOS DOMINIOS.** La prueba falsable encontró el caso
—la casilla ②, `user_added` + `official`— así que el formato y el encargo son ejes independientes: un
formato existe y se versiona **sin** que ninguna configuración lo reclame, y con la decisión 17 habrá
además formatos **personales**. Un `plantillas` metido dentro de `procesos` no podría expresar eso.

⚠️ **Y eso DESBLOQUEA el tramo `plantillas` de `F7.5`**, que llevaba esperando aquí. Lo que sigue
bloqueado es la **forma** de las tablas —`P2-bis`, `P8`…`P10`, `P13`…`P16`—, no a qué dominio
pertenecen: mover el código no depende de cómo se llamen las columnas.

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


---

## 7 · `D1` · El censo de `variation_key`, medido (2026-10-11)

**El entregable de `D1`**: cuántas consultas dependen de ella, qué hace cada una, y qué `JOIN`
necesitaría si se retira. Medido con script sobre el repositorio, no a ojo.

⚠️ **Y la primera corrección es del censo anterior.** El 2026-10-09 se dijo «**156 ocurrencias en 43
ficheros**». Esa cifra **contaba la documentación y los artefactos generados** (`.dbml`, `dist/`, los
planes). En **código** son **130 en 36 ficheros**, y el reparto importa más que el total:

| Dónde | Ocurrencias | Ficheros |
|---|---|---|
| `backend/database/postgres_schema.sql` | 22 (16 de ellas en prosa) | 1 |
| Backend (servicios, dominios, config, scripts) | **63** | 12 |
| Frontend | **34** | 17 |
| Pruebas y arneses | 11 | 6 |

### Las 28 sentencias SQL, y qué le pide cada una

| Qué hace con ella | Sentencias | ¿Ya traen `series_id` o el `JOIN` a la serie? | Qué pasa al retirarla |
|---|:--:|:--:|---|
| **La FILTRA o AGRUPA** | **8** | **0 de 8** | `WHERE process_id = ? AND variation_key = ?` → **`WHERE linea_id = ?`**. **Sin `JOIN` nuevo**, y pierden una columna y un parámetro |
| **La ESCRIBE** | **4** | **4 de 4** | se cae la columna de la lista: `(process_id, series_id, variation_key, …)` → `(linea_id, …)` |
| **ORDENA por ella** | **2** | **2 de 2** | `ORDER BY l.nombre` — el `JOIN` se **cambia**, no se añade: ya pagan el de la serie |
| **SÓLO LA DEVUELVE** | **14** | 4 de 14 | las 4 cambian de `JOIN`; **las otras 10 necesitan uno nuevo** a `lineas` si la pantalla tiene que seguir enseñando la variación |

**El coste neto, que es la respuesta a `D1`: 10 consultas necesitan un `JOIN` que hoy no tienen. Las
otras 18 se simplifican o cambian un `JOIN` que ya pagan.**

⚠️ **Y 10 es el TECHO, no el suelo.** Esas 10 la devuelven **como rótulo**, y el frontend ya no se lo
cree: en **7 sitios** escribe ``row.variation_key || `Variación ${row.series_id}` `` —o sea *«usa la etiqueta y, si
no hay, el id de la línea»*—. Si lo que la pantalla necesita es el **nombre** de la línea, ese `JOIN`
compra algo que hoy no existe; si le basta un identificador, `linea_id` ya viaja en la fila y **no
hace falta ningún `JOIN`**. Eso lo decide `P8`, no `D1`.

### Los tres índices están sobre la COPIA, y dos son ÚNICOS

| Índice | Hoy | Con la línea |
|---|---|---|
| `uq_process_definition_versions_series` | ÚNICO `(process_id, variation_key, definition_version)` | ÚNICO `(linea_id, definition_version)` — **3 columnas a 2** |
| `uq_process_definition_one_active_series` | ÚNICO `(process_id, variation_key, active_series_flag)` | ÚNICO `(linea_id, active_series_flag)` — **3 a 2** |
| `idx_process_definition_versions_status` | `(process_id, variation_key, status, effective_from)` | `(linea_id, status, effective_from)` — **4 a 3** |

⚠️ **Esto no es cosmética, y es EL hallazgo de `D1`: la unicidad de «una versión por línea» y de «una
sola activa por línea» está impuesta SOBRE UNA COPIA**, no sobre el dato. Y la copia la arrastra un
gancho que **lo dice de sí mismo en su propio comentario**:

```
// Si la identidad cambió, arrastra el `variation_key` de todas sus configuraciones y regenera
// sus nombres. No es transaccional (no lo era antes).
async afterUpdate(ctx) { … UPDATE process_definition_versions SET variation_key = ? WHERE series_id = ? … }
```

Renombrar una serie dispara un `UPDATE` masivo **fuera de transacción** sobre la columna que sostiene
dos índices únicos. Si se queda a medias, los dos únicos quedan vigilando etiquetas viejas.

### Y la copia YA está derivada — en el 100 % de las filas

El esquema avisaba de que el bootstrap usa **dos constantes para una sola cosa**
(`DEFAULT_SERIES_CODE = "default"` y `DEFAULT_VARIATION = "general"`) y decía que esa configuración
era *«la ÚNICA fila del sistema con `variation_key <> series.code`»*. Medido en la pila B el
2026-10-11, sobre una base recién sembrada:

| `pdv.id` | `variation_key` | `series.code` | |
|---|---|---|---|
| 1 | `general` | `default` | **deriva** |
| 6 | `general` | `default` | **deriva** |

**Las dos configuraciones que existen tienen la copia desincronizada de su origen.** No es «una fila
excepcional»: es el 100 % de lo que hay. La frase del esquema era cierta cuando se escribió y hoy
engaña — deja de importar con `P8`, que es cuando la columna desaparece.

### Lo que el frontend hace con ella

34 ocurrencias en 17 ficheros, y **ninguna la usa como dato**:

| Uso | Sitios | Qué pasa con la línea |
|---|:--:|---|
| **Rótulo** (`Variación {{ … }}`, `label: "Variación"`, `|| "—"`) | 9 | pasa a ser el **nombre** de la línea, escrito, no un `slug` derivado |
| **Respaldo al id** (``|| `Variación ${row.series_id}` ``) | 7 | **desaparece**: la línea siempre tiene nombre |
| **Filtro** (buscador de claves ajenas y filtro en línea de la tabla) | 5 | filtra por `linea_id`, que es lo que identifica |
| **La terna de identidad**, escrita a mano en dos sitios | 2 | `["process_id", "variation_key", "definition_version"]` → `["linea_id", "definition_version"]` |
| Resto (reinicios, paso de datos) | 11 | mecánico |

⚠️ **Los 7 respaldos son la prueba de que la pantalla ya sabe que la identidad es la línea y no la
etiqueta.** ``row.variation_key || `Variación ${row.series_id}` `` dice literalmente *«usa la copia; si está
vacía, usa el id del dato»*.

### Y la fachada del editor genérico

`config/sqlTables.js` la expone como campo **de sólo lectura** con la etiqueta «Codigo de serie» —no
«Variación»— y la mete en `searchFields`. O sea que **el editor genérico ya la trata como etiqueta
derivada**: se puede buscar por ella, no se puede escribir.

### Conclusión de `D1`, sin elegir

| | |
|---|---|
| **Lo que cuesta** | **10 consultas** necesitan un `JOIN` nuevo a `lineas` — y sólo si la pantalla necesita el **nombre** |
| **Lo que ahorra** | 8 consultas pierden una columna y un parámetro · 4 inserciones pierden una columna · 3 índices pierden una columna cada uno · **2 índices únicos dejan de depender de una copia** · 7 respaldos del frontend desaparecen · 1 cascada no transaccional desaparece |
| **Lo que arregla** | la unicidad de «una versión por línea» deja de vigilar una etiqueta que **hoy está derivada en todas las filas** |

**Y con esto `P2-bis` queda desbloqueada**, que era lo único que esperaba a `D1`.
