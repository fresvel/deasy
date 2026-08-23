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
