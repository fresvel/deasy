# Frente 25 · Qué pareja (configuración, plantilla) es legal — y qué es una plantilla sin proceso

> **Estado**: ⬜ **0 de 7** · abierto el **2026-10-09** · **ANÁLISIS, no ejecución**
> **Abierto por una observación del dueño** que corrige al frente 23.

**Este frente NO toca una línea de código.** Son tres preguntas de modelo, y lo único que entrega es
**lo medido y el espacio de diseño de cada una**, para que el dueño decida. Las decisiones van en la
tarea `D`, con su porqué escrito.

## 0 · Control de ejecución

| Tarea | Qué entrega | Estado | Evidencia | Fecha |
|---|---|:--:|---|---|
| **A1** | **El censo real de parejas**: qué combinaciones `(process_definition_versions, ediciones)` existen hoy y cuáles deja pasar `trg_pdt_linea_unica`, probadas en SQL dentro del contenedor **en transacciones revertidas**. Sin tocar datos | ⬜ | | |
| **A2** | **El espacio de diseño de la regla de pertenencia**: las formas posibles de «qué pareja es legal» —línea, versión↔versión, versión↔línea con una activa, y las que aparezcan—, cada una con qué impide, qué permite y qué cuesta imponerla. **Sin elegir** | ⬜ | | |
| **B1** | **Qué obliga a qué, medido**: los caminos que crean o mueven un `vinculo` (clon, CRUD genérico, asistente, bootstrap, scripts) y, para cada uno, qué hace con la versión de la plantilla y con la de la configuración | ⬜ | | |
| **B2** | **El espacio de diseño de las dos direcciones**: qué significaría imponer «plantilla nueva → configuración nueva», la contraria, las dos, o ninguna; y qué se rompe en cada caso | ⬜ | | |
| **C1** | **Qué es hoy `ad_hoc`, medido**: cuántos caminos lo crean, de qué configuración cuelga, qué línea le toca, y qué hace el disparador con dos plantillas `ad_hoc` de personas distintas | ⬜ | | |
| **C2** | **El espacio de diseño de `ad_hoc`**: si sigue existiendo, con qué pertenencia, y qué pasa con el «Proceso por defecto» en cada opción | ⬜ | | |
| **D** | **La decisión del dueño sobre las tres**, registrada aquí con su porqué y con lo que se descarta y por qué | ⬜ | | |

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

### C · ¿Qué es una plantilla que no es de ningún proceso?

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
