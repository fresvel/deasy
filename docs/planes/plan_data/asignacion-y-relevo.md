# Quién hace el entregable — y qué pasa cuando esa persona se va

> **Paso 4 de la fase D7 del frente 9.** Escrito el **2026-08-23** midiendo **el código**, no los
> datos: el camino automático apenas ha producido entregables en dev.
>
> Responde a la pregunta del dueño: *¿`task_assignments` y `task_items.responsible_position_id`
> dicen lo mismo? ¿Se puede colapsar?*

---

## 1 · Lo que se midió

### Las tres piezas

| Pieza | Grano | Qué dice |
|---|---|---|
| `task_assignments (task_id, position_id, assigned_person_id)` | por **tarea × puesto** | «en esta tarea, este puesto lo lleva esta persona» |
| `task_items.responsible_position_id` | por **entregable** | «este entregable lo produce este puesto» |
| `task_items.assigned_person_id` | por **entregable** | «y ahora mismo lo lleva esta persona» |

`task_assignments` tiene índice único `(task_id, position_id)`.

### Quién las escribe

**Las tres se escriben en el mismo sitio y en la misma transacción: el lanzamiento.** Y no en
paralelo — **en cadena**:

```js
// services/admin/generation/launch.js:107-114  (hydrateProcessDefinitionTask)
const assignments = await ensureTaskAssignmentsForDefinition(...);   // 1. escribe task_assignments
const targets     = await getTaskAssignmentTargets(connection, taskId); // 2. la vuelve a LEER
const taskItems   = await ensureTaskItemsForTaskTargets(..., targets);  // 3. copia a task_items
```

`task_items.responsible_position_id` es `targets[i].position_id` y `assigned_person_id` es
`targets[i].person_id` — o sea, **literalmente las columnas de `task_assignments`, recién escritas
y releídas**. El otro camino (`launchDefinitionInTerm:264-277`) alimenta a las dos desde el mismo
`unitPositions`, en orden inverso. En los dos casos: **una fuente, dos destinos.**

### Y ahora la parte que importa: quién las ACTUALIZA

| | Al lanzar | En un relevo |
|---|---|---|
| `task_assignments.assigned_person_id` | ✅ se escribe | ❌ **nadie la toca. Nunca.** |
| `task_items.assigned_person_id` | ✅ se escribe | ✅ los **cuatro** caminos de relevo |

Los cuatro caminos —los dos triggers de `position_assignments`, el backfill
`reconcileOpenTaskItemAssignments` y el traspaso manual `handoverTaskItem`— mueven
`task_items.assigned_person_id` y **ninguno menciona `task_assignments`**. Medido: cero apariciones
de la tabla en todo el esquema fuera de su propio `CREATE TABLE` y sus índices.

---

## 2 · El veredicto: no son duplicados — son el MISMO dato en dos MOMENTOS

Y ésa es la diferencia que importa, porque uno de los dos **se pudre**.

- `task_assignments` es una **foto del reparto en el instante del lanzamiento**.
- `task_items.assigned_person_id` es **el estado vivo**.

Mientras nadie se mueva, coinciden. En cuanto hay un relevo, divergen para siempre y **nada las
vuelve a juntar**.

### La consecuencia, medida

`DeliverableAccessService` tiene una fuente que lee la foto:

```sql
-- fuente `puesto_responsable_asignado`  (grants: ENTREGABLE)
SELECT ta.assigned_person_id
  FROM task_assignments ta ... WHERE ta.position_id = ti_src.responsible_position_id
```

Después de un relevo, esa fuente sigue devolviendo **a quien se fue**. Y le concede nivel
`ENTREGABLE`, que es el que abre el documento.

Quien llega sí entra —por `entregable_asignado`, que lee la columna viva—, así que **no hay una
puerta cerrada; hay una que no se cierra**: el predecesor conserva acceso al entregable
indefinidamente, sin que nadie lo haya decidido. Es exactamente la forma del IDOR que se cerró en
julio, por el otro lado.

> **`task_assignments` tampoco es «la tabla del histórico»**, aunque tenga `assigned_at` y
> `unassigned_at`: su índice único `(task_id, position_id)` sólo admite **una fila por puesto**, así
> que no puede guardar una sucesión. Y `unassigned_at` no la escribe nadie.

---

## 3 · Qué debería ser el modelo

Partiendo del mundo real, no del código:

1. **El puesto es durable, la persona es transitoria.** «Coordinador de la carrera de TI» sobrevive
   a quien lo ocupe. Un entregable institucional lo debe **el puesto**.
2. **Quién lo ocupa hoy ya está en la base**, y en un solo sitio: `position_assignments` con
   `is_current = 1`, con índice único que garantiza **como mucho un ocupante vigente por puesto**.
3. **Quién lo lleva no siempre es quien lo ocupa**, y por eso el dato vivo no es del todo derivable:
   un traspaso manual pone a alguien que no ocupa el puesto, y ése es un caso legítimo (una
   suplencia, una delegación).

De ahí salen las tres columnas que el modelo necesita, y sólo tres:

| Qué | Dónde | Por qué ahí |
|---|---|---|
| El **ancla durable** | `task_items.responsible_position_id` | Es la identidad del entregable —el índice único ya la usa— y el punto por el que enganchan los cuatro relevos |
| El **estado vivo** | `task_items.assigned_person_id` | Puede diferir del ocupante (suplencia), así que no es derivable |
| El **historial** | `task_item_handovers` | Ya existe, ya tiene `from`/`to`/`trigger_kind`/`created_at` |

**`task_assignments` no aparece en esa lista.** Lo que aporta —«qué puestos participan en la
tarea»— es la **unión de los `responsible_position_id` de sus entregables**, que es la misma
información sin una segunda copia que envejece.

---

## 4 · El hueco de verdad: lo empezado y sin terminar

Los cuatro relevos llevan el mismo filtro: **`ti.user_started_at IS NULL`**.

Es decir: **en cuanto alguien abre un entregable, queda congelado a su nombre para siempre.** Si
esa persona deja el puesto al día siguiente, el entregable no vuelve a moverse — ni por trigger, ni
por backfill. Sólo el traspaso manual puede sacarlo de ahí, y **ése era el que estaba muerto**
(arreglado el 2026-08-23).

El filtro no está mal puesto: protege de que un relevo automático le quite a alguien un documento
que está escribiendo. Lo que falta es **la otra mitad de la política**, la del caso en que la
persona ya no está.

### Sobre la idea de «duplicar el registro para conservar el historial»

La intuición es correcta —**mutar destruye historia**— pero `task_items` es el portador equivocado,
por tres razones medidas:

1. **`task_items` es la IDENTIDAD del entregable.** El índice único dice «un entregable por tarea,
   plantilla y productor». Duplicar filas crea **dos entregables donde la institución tiene uno**, y
   hay que decidir cuál cuenta en cada listado, contador y filtro del sistema.
2. **Todo cuelga de `task_item_id`**: el documento (con índice único `uq_documents_task_item`), sus
   versiones, los `fill_requests` y las firmas. Duplicar el ítem obliga a duplicar o a huerfanar
   toda esa cola.
3. **El historial ya tiene su tabla, y es la forma correcta**: `task_item_handovers` guarda de
   quién a quién, por qué causa y cuándo, sin tocar la identidad. Un relevo es un **evento**, no una
   versión del entregable.

**Pero la idea sí acierta en un caso**, y el modelo ya tiene la columna para él:
`task_items.source_task_item_id` —que hoy sólo usa `replicated`— es exactamente «este entregable
nace de aquél». Cuando un entregable **no se puede continuar**, lo correcto no es traspasarlo: es
**cerrarlo y reemitirlo**, con el nuevo apuntando al viejo. Eso conserva el historial *y* la
identidad.

### La política que falta, en tres casos

| Situación del entregable | Qué debería pasar | Por qué |
|---|---|---|
| **Sin empezar** | Relevo silencioso (lo de hoy) | No hay trabajo que perder |
| **Empezado, sin firmas** | **Relevo con asiento propio** (`occupancy_end_in_progress`), y el dueño del documento se mueve con él | El borrador es de la institución, no de la persona. Hoy: no pasa nada, queda congelado |
| **Empezado y con firmas** | **No se traspasa: se cierra y se reemite** con `source_task_item_id` | Una firma es evidencia de lo que alguien hizo; no se puede heredar. Hoy: no pasa nada |

---

## 5 · La propuesta

| | Cambio | Efecto |
|---|---|---|
| **P1** | `task_items.responsible_position_id` → **NOT NULL** (paso 4 tal como estaba) | El ancla deja de poder faltar |
| **P2** | **Retirar `task_assignments`**; sus 12 lecturas pasan a `task_items` | Se acaba la foto que envejece, y con ella el acceso que no se cierra |
| **P3** | Sustituir el filtro `user_started_at IS NULL` por la **política de tres casos** de §4 | El hueco deja de existir |
| **P4** | La reemisión usa `source_task_item_id`, que ya existe | La idea del historial, en el portador correcto |

P1 y P2 son mecánicos y se pueden medir. **P3 es una decisión de negocio** y es la que hay que
tomar antes de escribir una línea.

---

## 6 · Lo que este análisis destapó de paso (ya arreglado)

Tres defectos encadenados, todos con la misma causa —**ningún contrato HTTP los tocaba**—,
corregidos en `69552c18`:

1. El guard del traspaso manual comparaba `task_items.status` contra siete literales que la columna
   **nunca tomó**: no bloqueaba nada, y un entregable firmado se podía traspasar.
2. Al retirar esa columna, el `SELECT` pasó a fallar **en ejecución** y el endpoint entero devolvía
   500. Tres commits invisible.
3. `SqlAdminService` se quedó **sin dos delegadores** desde la extracción del cluster
   (`listTaskItemHandovers`, `listSupervisorStuckTaskItems`): sus endpoints respondían 400. Ése
   venía de antes de esta tanda.

---

# Segunda vuelta (2026-08-23) — la tenencia como tabla propia

Elegida la tercera forma. Aquí van las tres cosas que el dueño pidió aclarar.

## 7 · Qué quiere decir «`task_item_handovers` se pliega dentro»

No que se borre la información: que **cambia de forma**, de *eventos* a *periodos*.

Hoy guarda **transiciones**:

| task_item | de | a | causa | cuándo |
|---|---|---|---|---|
| 12 | — | Juan | occupancy_start | 1 mar |
| 12 | Juan | — | occupancy_end | 1 jun |
| 12 | — | María | occupancy_start | 3 jun |

La tabla de tenencias guarda **estancias**, exactamente los mismos hechos:

| task_item | quién | puesto | desde | hasta | causa de entrada | motivo |
|---|---|---|---|---|---|---|
| 12 | Juan | 7 | 1 mar | 1 jun | original | — |
| 12 | — | 7 | 1 jun | 3 jun | occupancy_end | dejó el puesto |
| 12 | María | 7 | 3 jun | *(abierta)* | occupancy_start | tomó el puesto |

Son **isomorfas**: de dos eventos consecutivos sale una estancia, y de una estancia salen sus dos
eventos. No se pierde nada al pasar de una a otra. Lo que cambia es **a qué preguntas responden
directamente**:

| Pregunta | Con eventos | Con estancias |
|---|---|---|
| ¿Quién lo tiene ahora? | reproducir el log | `WHERE ended_at IS NULL` |
| ¿Quién lo tenía en marzo? | reproducir el log hasta esa fecha | `WHERE ? BETWEEN assigned_at AND ended_at` |
| ¿Qué entregables están abandonados? | imposible sin reproducir todos | entregables **sin** estancia abierta |
| ¿Puede haber dos responsables a la vez? | nada lo impide | **la base lo impide**: único parcial `(task_item_id) WHERE ended_at IS NULL` |

Esa última fila es la que decide. Con eventos, «un solo responsable vigente» es una **convención que
se cumple si el código no se equivoca**. Con estancias es un **índice**.

Así que «plegarse dentro» = `task_item_handovers` **deja de existir como tabla aparte** y sus datos
pasan a ser columnas de la tenencia (`handover_kind` es su `trigger_kind`, `reason` es su `reason`,
`performed_by_user_id` el mismo). Gana además el `position_id`, que hoy no tiene.

## 8 · Auditoría: las tres piezas YA existen — y dos están mal puestas

El dueño lo planteó y es correcto. Éste es el mapa:

| Lo que hace falta | Qué hay hoy | Diagnóstico |
|---|---|---|
| **Qué se debe** (identidad) | `task_items` | ✅ **Bien.** Su índice único ya es la identidad correcta desde el 2026-08-23 |
| **Quién lo debe, y desde cuándo** | **TRES sitios distintos** | ❌ Repartida y sin dueño |
| **Qué se produjo** | `documents` + `document_versions` | ⚠️ Existe, pero **sin autor** |

### Los tres sitios donde vive «quién lo lleva» — y cuál sobrevive a un relevo

| Copia | Grano | Se actualiza en un relevo |
|---|---|---|
| `task_items.assigned_person_id` | entregable | ✅ en los **4** caminos |
| `documents.owner_person_id` | documento (1:1 con el entregable) | ⚠️ **sólo en 1 de 4** — sólo el traspaso manual (`taskAssignment.js:318`). Los dos triggers y el backfill **no lo tocan** |
| `task_assignments.assigned_person_id` | tarea × puesto | ❌ **en ninguno** |

**Tres copias del mismo hecho y dos se pudren.** Y la de `documents` es peor de lo que parece: es
la que decide de quién es el documento en 41 lecturas del backend, así que después de un relevo
automático el documento sigue figurando a nombre de quien se fue.

Con la tenencia, «quién lo lleva» tiene **un solo sitio** y las otras dos dejan de ser copias:
`documents.owner_person_id` pasa a ser derivable, y `task_assignments` se retira entera.

### Lo que falta de verdad: el autor de la versión

`document_versions` guarda `version`, `status`, `payload_hash`, las rutas de fichero, el formato y
`created_at` — **y ninguna columna de persona**. Así que «¿quién escribió esta versión?» hoy **no
tiene respuesta en la base**, con ninguno de los tres diseños.

Es lo que completa el modelo: la tenencia dice *quién respondía* y el autor de la versión dice
*quién hizo*. Cruzados, sale la historia entera sin duplicar un solo entregable.

## 9 · Sobre colapsar `documents`

**No hay ninguna decisión escrita de colapsarla.** Lo que existe es el *catálogo* de las cuatro
relaciones 1:1 por índice (`referencia-esquema.md:252`); nadie acordó actuar sobre ellas. Lo que sí
se colapsó en su día fue otra cosa: las columnas duplicadas de `template_artifacts` sobre
`deliverables`.

### ¿Basta con `document_versions`?

**No.** `documents` no es una tabla vacía: lleva cinco hechos que son **del documento entero**, no
de cada versión — `title`, `status`, `comments_thread_ref`, `owner_person_id`, `origin_unit_id`.
Fundirla en `document_versions` los repetiría en cada versión, que es el problema contrario.

### Pero sí es una cáscara 1:1 sobre `task_items`

Medido: hay **un solo `INSERT INTO documents`** en todo el backend
(`generation/documents.js:325`) y **siempre** rellena `task_item_id`. La columna es `NULL`able y el
índice es único, así que la base *permitiría* un documento sin entregable — pero **ningún camino lo
crea**. En la práctica: 1:1 estricto.

Y dos de sus cinco columnas ya están duplicadas contra el entregable:

- **`documents.title` y `task_items.title`** existen las dos (`postgres_schema.sql:842` y `:770`).
- **`documents.owner_person_id` y `task_items.assigned_person_id`** son casi el mismo hecho, y
  divergen en 3 de los 4 relevos.

Así que la pregunta razonable **no** es «¿fundimos `documents` en `document_versions`?» sino
**«¿fundimos `documents` en `task_items`?»** — y entonces las versiones colgarían directamente del
entregable. Queda planteada, no decidida.
