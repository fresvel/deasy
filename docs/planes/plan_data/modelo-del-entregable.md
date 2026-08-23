# El modelo del entregable — qué es, de quién es, y qué sobra

> **Fase D7 del frente 9.** Escrito el **2026-08-23**, midiendo el **código de generación** y no los
> datos: el camino automático apenas ha producido entregables en dev, así que los datos no prueban
> intención. Lo que sigue sale de leer quién escribe qué.
>
> Complementa a [`acceso-al-entregable.md`](./acceso-al-entregable.md), que resuelve *quién puede
> verlo*. Éste resuelve *qué es* y *cuántos hay*.

---

## 1 · La decisión: un entregable por PERSONA

**Decisión del dueño, 2026-08-23.** Un proceso dirigido a «todos los coordinadores de carrera», en
una carrera con tres coordinadores, produce **tres informes** — uno por coordinador, y cada uno ve
el suyo.

**Hoy el sistema no hace eso.** El lanzamiento automático produce **un entregable por plantilla y
por unidad**, compartido por todas las personas asignadas a la tarea.

### Por qué las tres versiones que circulaban tenían razón a la vez

| Fuente | Qué decía | Veredicto |
|---|---|---|
| El **código** de lanzamiento | Un entregable por plantilla | **Cierto** — es lo que hace |
| La **documentación** (comentario del IDOR) | Un entregable por persona | **Cierto como intención**, falso como descripción |
| El **test** del IDOR | Construye el caso por persona a mano | **Cierto** — con el editor genérico de tablas |

No se contradicen: **el esquema admite las dos formas**, y sólo una está implementada. Lo decide el
índice único, a través de sus columnas generadas:

```sql
target_position_key = CASE WHEN origin_kind='process_defined'
                           THEN COALESCE(target_position_id, 0) ELSE NULL END
uq_task_items_defined_target ON (task_id, process_definition_template_key,
                                 target_position_key, target_person_key)
```

- Con los destinos **vacíos** → la clave es `(tarea, plantilla, 0, 0)` → **uno por plantilla**.
- Con los destinos **rellenos** → **uno por destinatario**.

---

## 2 · Lo que se midió

### Tres de los cuatro campos de persona/puesto del entregable NO los escribe nadie

| Campo | Quién lo escribe |
|---|---|
| `task_items.target_person_id` | **nadie** — sólo el editor genérico de tablas del admin |
| `task_items.target_position_id` | **nadie** — ídem |
| `task_items.responsible_position_id` | **nadie** — ídem |
| `task_items.assigned_person_id` | los relevos y el `reconcile` |

Los `UPDATE … responsible_position_id` del generador (`taskitems.js:222`, `:246`) son sobre
**`tasks`**, no sobre `task_items`.

### `recipient_policy` ya existe, y hoy hace la mitad de su trabajo

`process_target_rules.recipient_policy` admite `all_matches` · `one_per_unit` · `exact_position`, y
`applyRecipientPolicy` (`generation/primitives.js:34`) la aplica **recortando las POSICIONES
candidatas, no los entregables**.

Consecuencia hoy: con `all_matches`, las N personas de una unidad quedan asignadas **a la misma
tarea, que tiene un solo entregable**. Es el interruptor que la decisión necesita — pero conectado a
la mitad equivocada.

### `tasks.responsible_position_id` es ruido — confirmado por el dueño

Lo pone el lanzamiento como `unitPositions[0].position_id`: **el primer puesto de la lista**. La
lista sí está ordenada (`ORDER BY up.unit_id, up.slot_no, up.id`), así que es determinista — pero
«el puesto de menor `slot_no` de la unidad» **no es un responsable**, es un puesto cualquiera. Y el
ámbito real ya vive en `tasks.scope_unit_id`.

**Decisión del dueño (2026-08-23): se retira.**

### `tasks.created_by_user_id` está duplicado

**12 de 13 tareas lo tienen NULL** — el camino automático no lo rellena. Quien lanzó la corrida ya
está en `process_runs.created_by_user_id`, con su `run_mode`, su `reason` y su `status`.

Sólo tiene valor en tareas **ad-hoc**, donde sí significa algo: **quien encargó el trabajo**. Ése es
un tercer caso legítimo de acceso, pequeño y acotado.

### `document_workflow_observations.target_person_id` es ruido puro

- **2 observaciones, 0 con destinatario.**
- El backend lo lee y compone un `target_name`…
- …y el **frontend no lo pinta en ningún sitio** (cero apariciones).
- Sale del cuerpo de la petición **sin validar**, así que como fuente de acceso sería una **vía de
  escalada de privilegios**: dar acceso a cualquiera nombrándolo destinatario.

**Decisión del dueño (2026-08-23): se borra.** El modelo de auditoría «de dónde a dónde va el
documento» quedó obsoleto; eso lo cuentan los flujos, y **quien firma al final es el destinatario**
sin necesidad de campo.

---

## 3 · Qué implica la decisión

### ⚠️ CORRECCIÓN (2026-08-23): ya estaba implementado

**Este apartado decía que el lanzamiento hay que cambiarlo. Es falso, y el error fue mío**: leí
`ensureTaskItemsForTask` (`taskitems.js:12`) —que sí crea uno por plantilla y sin destino— y
generalicé. **El lanzamiento no llama a ésa: llama a `ensureTaskItemsForTaskTargets`**
(`taskitems.js:67`), que recibe las posiciones objetivo y **crea un entregable por
(plantilla × destinatario)** con `target_position_id`, `target_person_id` y
`responsible_position_id` **rellenos**.

Sólo cae a la forma «uno por plantilla» **cuando no hay destinatarios** — y ésa es la rama que la
consulta de idempotencia cubre con su `target_position_id IS NULL`. Las dos formas conviven a
propósito, cada una con su idempotencia.

**Así que la decisión «un entregable por persona» ya está implementada.** Lo que faltaba era
entenderlo. Lo que sí queda por comprobar es que `recipient_policy` alimente bien esos
destinatarios — y `unit_head` ya corrige la mitad de eso.

> **Y de aquí sale una regla de método, porque he tropezado dos veces igual:** dos funciones cuyo
> nombre se diferencia en un sufijo (`…ForTask` y `…ForTaskTargets`) y de las que **la usada es la
> larga**. Antes de afirmar «esto no se rellena», hay que mirar **quién llama**, no sólo qué hace la
> función que sale primero en el `grep`.

### ⚠️ El riesgo concreto: la idempotencia del relanzamiento se rompe

`getExistingTaskItemTemplateIds` (`generation/queries.js:363`) —la consulta que evita duplicar
entregables al relanzar— busca así:

```sql
WHERE task_id = ? AND origin_kind = 'process_defined'
  AND target_position_id IS NULL
  AND target_person_id IS NULL
```

**Y eso es CORRECTO**, no un riesgo: esa consulta sirve a la rama «sin destinatarios»
(`ensureTaskItemsForTask`), que es la que crea entregables con los destinos vacíos. La rama con
destinatarios tiene su propia idempotencia, por `existingTargetKeys`.

⚠️ **El aviso de riesgo que este apartado tenía escrito era mío y estaba equivocado**, y venía del
mismo error de leer la función que no es. Se conserva tachado para que no se vuelva a «arreglar» lo
que no está roto.

### Lo que la decisión valida

**El arreglo del IDOR pasa a proteger un escenario real.** Hoy protege uno que sólo su propio test
produce: si un entregable es de la unidad y N personas están asignadas a la tarea, todas lo comparten
legítimamente y no hay nada que filtrar. Con un entregable por persona, el guard defiende lo que dice
defender.

### La redundancia que queda

Con la decisión tomada, **`target_position_id` y `responsible_position_id` dicen lo mismo**: si el
entregable va dirigido al puesto X, quien responde por él es el puesto X. El test del IDOR ya los
rellena **con el mismo valor**.

Se diferencian sólo por su uso hoy:

| Campo | Quién lo lee |
|---|---|
| `target_position_id` | El índice único (identidad) y la idempotencia del relanzamiento |
| `responsible_position_id` | La cascada del responsable, el guard, los relevos, el chat, el flujo de firma |

**Queda por decidir cuál sobrevive.** Y `assigned_person_id` es el ocupante actual de ese puesto,
materializado — el mismo patrón que ya se retiró en `documents.owner_person_id`.

---

## 4 · El modelo de acceso, reducido

De las once fuentes del diseño inicial quedan **tres**, y las tres tienen justificación medida:

| | Fuente | Por qué no se puede quitar |
|---|---|---|
| 1 | **Debe entregarlo** | Al crearse, el entregable **no tiene ningún flujo**. Sin esta fuente nadie podría abrir lo suyo el primer día |
| 2 | **Intervino** — entrega o firma | El criterio del dueño. Y cubre al firmante, que interviene sin ser el dueño |
| 3 | **Encargó la tarea ad-hoc** | Sólo se dispara en tareas ad-hoc, donde significa «quien pidió el trabajo» |

Más el **custodio** cuando el puesto se queda sin nadie (decidido el 2026-08-22: el jefe de la
unidad, subiendo por la rama orgánica).

**Y se caen, con su razón:**

- **Quien comentó** — para comentar hay que haber pasado el guard: nunca añade a nadie.
- **El destinatario de una observación** — ruido, y agujero.
- **El dueño materializado** (`documents.owner_person_id`) — retirado en P2a: su valor puede estar
  rancio.
- **Los asignados de la tarea, sin acotar** — es el IDOR. Sólo alcanza al hilo del proceso.
- **Ocupante pasado del puesto y relevos** — el caso que justificaba estas dos fuentes era «alguien
  preparó el documento y se fue», y al mirarlo de cerca **no existe**: si lo preparó dentro del
  sistema entró en un flujo, y si lo preparó fuera el sistema no sabe que existe. Medido además: los
  relevos registrados **no aportan ni una persona** que no esté ya en `assigned_person_id`.

> **Para lo que sí sirve el registro de relevos es para EXPLICAR**, no para conceder: *«¿por qué esto
> que era de Juan ahora es de María?»*. Eso no lo contesta el historial de flujos, y es el defecto
> 1.10 — otro trabajo.


---

## 5 · Veredictos (2026-08-23)

Aceptados por el dueño para empezar a caminar en el código. Cada uno con lo que hay que hacer
**antes** de tocarlo, que es donde están las trampas.

| Elemento | Veredicto | Lo que hay que hacer antes |
|---|---|---|
| `task_items.target_person_id` | **Se retira** | Cerrar el camino *legacy sin flujo* y derivar el «Para:» del **último paso de firma**. En `replicated` no hace falta: es copia de `created_by_person_id` |
| `task_items.target_position_id` | **Se retira** | Nada. En `routed` el código ya lo pone a `NULL`; en `replicated` es copia de `responsible_position_id` |
| `task_items.responsible_position_id` | **Se queda, y pasa a ser OBLIGATORIO** | Que el lanzamiento automático lo rellene. Es el ancla de los tres relevos y, con la decisión de «uno por productor», es quien dice el productor |
| `task_items.assigned_person_id` | Se queda | Es el estado; lo mueve el relevo |
| `task_items.status` | ✅ **HECHO (2026-08-23)** | Retirados **cinco filtros muertos** (3 triggers + 2 del backfill) y **tres proyecciones**. Lo pendiente se lee ahora del documento con `isDocumentPending`. Los goldens se movieron: **6 líneas, todas borradas, todas `status: \"pendiente\"`** |
| `tasks.responsible_position_id` | ✅ **HECHO (2026-08-23)** | **27 lecturas**, y todas hacían lo mismo: unir con `unit_positions` para sacar la unidad, que ya está en `scope_unit_id` — medido, coinciden en las 13 tareas. De paso `scope_unit_id` pasa a **NOT NULL** (los dos escritores la rellenan siempre) y **los moderadores del hilo de chat pasan a ser la JEFATURA** en vez de quien ocupara un puesto cualquiera |
| `tasks.created_by_user_id` | ✅ **HECHO (2026-08-23)** | Repuntados sus dos *fallbacks* de resolución de actores (entrega y firma), el predicado de propiedad de la descarga, el filtro de tareas accesibles, la fuente de acceso y los participantes del chat — todos a `task_items.created_by_person_id`, que en la tarea ad-hoc vale **exactamente lo mismo**. Cae también `is_current_user_creator`, que el frontend no leía |
| `document_workflow_observations.target_person_id` | ✅ **HECHO (2026-08-23)** | Cayeron con él **las dos fuentes de acceso por observación**: la del autor por redundante, la del destinatario por ser una vía de escalada |
| `recipient_policy.one_per_unit` | ✅ **HECHO (2026-08-23).** Desaparece; nace `unit_head` (opción 3) | Medido antes: **cero reglas** lo usaban. Y aparecieron **TRES** diccionarios de etiqueta, no dos — el tercero en `AdminPresentationService`, con un comentario que ya reconocía la divergencia |
| Índice único | Pasa a **`(tarea, plantilla, productor)`** | La idempotencia del relanzamiento se reescribe con él |

### `replicated` no se ve afectado — verificado

Sus réplicas nacen con `origin_kind = 'user_added'`, y las tres columnas generadas del índice único
valen `NULL` fuera de `process_defined`. PostgreSQL admite múltiples `NULL` en un índice único, así
que **N réplicas del mismo creador, plantilla y tarea no colisionan**. El cambio de identidad sólo
alcanza al camino automático.

### El hueco que ninguna de las dos propuestas cubre

**¿Qué pasa con un entregable YA EMPEZADO cuando su persona deja el puesto?** Hoy: **nada**. Los tres
relevos filtran por `ti.user_started_at IS NULL`, así que en cuanto alguien lo abre queda congelado
con él. Puede ser correcto —lo estaba trabajando— o puede dejar documentos abandonados que nadie
reclama. **Sin decidir.**

> Y por eso se descartó modelar el relevo creando un entregable hijo con su padre y su motivo: **el
> congelado ya existe**, y lo hace una columna (`user_started_at`) en vez de una tabla. La columna de
> padre que la idea proponía **también existe ya** (`task_items.source_task_item_id`, con su FK y su
> índice), y hoy la usa el camino ad-hoc para derivar un entregable de otro.


---

## 6 · Dos aclaraciones del 2026-08-23

### `replicated` no se toca, y no puede ser automático

Está escrito como decisión en `taskitems.js:13`: *«solo las plantillas en modo `single` auto-generan
su entregable; `replicated`/`routed` no siembran ítem»*. Y a nivel de modelo **no puede serlo
mientras el número de réplicas lo decida una persona**: el sistema no sabe cuántas actas de reunión
vas a tener este mes.

La decisión de «uno por productor» **no lo solapa**, porque multiplican por ejes distintos:

| Modo | Multiplica por | ¿Lo sabe el sistema? |
|---|---|---|
| `single` (modelo nuevo) | **personas** — un entregable por productor | **Sí**, salen de las reglas de alcance |
| `replicated` | **ocurrencias** — N actas, N informes de evento | **No**, lo decide la persona |

Podría ser automático el día que exista una fuente que enumere las ocurrencias — y entonces dejaría
de ser `replicated`: sería `single` con una ocurrencia por destinatario.

### Sin código de migración

**Decisión del dueño (2026-08-23): el esquema declara el modelo objetivo y la semilla se
reescribe. No se escriben `ALTER` para llevar bases existentes de una forma a otra** — no hay datos
en producción, y ese código nace muerto.

Se aplicó de inmediato: el `CHECK` de `recipient_policy` se había escrito con su bloque de migración
—siguiendo el precedente del fichero— y **se retiró**. Verificado reconstruyendo la base con
`test:char:run`: la definición limpia basta, el `CHECK` nuevo aparece, y char sigue en **294/294**.

> **Y eso destapa una limpieza que antes no era posible:** el esquema arrastra **25 piezas de código
> de migración** —`ALTER TABLE`, bloques `DO $$`, `ADD COLUMN IF NOT EXISTS`, `DROP COLUMN IF
> EXISTS`, `DROP CONSTRAINT IF EXISTS`—. Con esta regla, todas pueden colapsar dentro de la
> definición de su tabla, y el fichero pasaría a decir **qué es** el esquema en vez de **cómo llegó
> a serlo**. Es trabajo aparte y tiene un riesgo concreto: cada `ALTER` que se colapse mal **pierde
> una columna**, así que se hace tabla a tabla y con la base recreada como prueba.
