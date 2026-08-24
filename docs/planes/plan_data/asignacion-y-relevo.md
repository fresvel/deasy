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

## 10 · «El propietario no es uno, es el conjunto» — sí y no

Aportación del dueño (2026-08-23): *«habíamos quedado en que no existe un solo propietario; el
propietario son quienes están en el flujo de entrega y de firmas, además de otro factor»*.

**El recuerdo es correcto, y el factor que faltaba es «quien lo encargó»** — la fuente
`entregable_creador`. El conjunto completo son las **siete fuentes** de `DeliverableAccessService`:
quien lo tiene asignado, los dos del puesto responsable (asignado y **ocupante**, que es el relevo),
el asignado de la tarea (sólo conversación), **quien lo encargó**, el flujo de entrega y el de firma.

**Pero ese acuerdo era sobre el ACCESO, y hay dos preguntas distintas:**

| Pregunta | Forma de la respuesta | Dónde vive |
|---|---|---|
| ¿Quién puede **ver** esto? | **Conjunto** | `DeliverableAccessService`, 7 fuentes · ✅ resuelto |
| ¿Quién **responde** de que esto se haga? | **Una persona a la vez** | La tenencia · ⬜ por hacer |

La segunda no puede ser un conjunto, y no es un detalle técnico: **una obligación compartida es una
obligación de nadie**. Es justo lo que da sentido al relevo — se traspasa **una** responsabilidad, y
el historial guarda la sucesión. Un conjunto no se traspasa.

### Y `documents.owner_person_id` hoy intenta responder a las DOS

Medidos sus usos reales, hace **tres** trabajos distintos:

| Uso | Qué pregunta responde | Veredicto |
|---|---|---|
| Moderar observaciones (`user_controler.js:433` y el guard de `:523`) | ¿quién puede resolver una observación ajena? | **Singular.** Es de la responsabilidad, no del acceso |
| Filtrar «mis documentos» (`queries.js:359`) y el guard de firma (`PdfSigningService.js:437`) | ¿quién puede verlo/firmarlo? | **Conjunto.** Aquí la columna es demasiado estrecha |
| Resolver el paso `document_owner` (`DocumentSignatureWorkflowService.js:508`) | ¿quién ejecuta este paso? | **Rama muerta**: el resolver se retiró y el `CHECK` lo rechaza |

O sea: **una sola columna intentando ser dos cosas, y una tercera que ya no existe.** Ése es
exactamente el «owner» que el dueño recuerda haber eliminado: se retiró el **resolver**
`document_owner` («lo que la web no autora, no existe»), pero la **columna** que lo alimentaba
sobrevivió sin su consumidor principal.

### Cómo queda en el modelo limpio

`documents.owner_person_id` **desaparece**, y sus tres trabajos se reparten donde ya tienen dueño:

- lo de **moderar** → la tenencia vigente (una persona, la que responde);
- lo de **ver y firmar** → el conjunto, que ya está construido;
- lo del **resolver** → nada: está muerto.

Con eso se acaba también la tercera copia podrida: hoy la mueve **1 de los 4** caminos de relevo.

## 11 · Fundir `documents` en `task_items`, con esto encima

### El coste estructural es sorprendentemente bajo

**Sólo UNA foránea apunta a `documents(id)`**: `document_versions.document_id`. Todo lo demás
—flujos de llenado, instancias de firma, observaciones, firmas— cuelga de **`document_version_id`**,
no del documento. Fundir significa repuntar **una** foránea.

### Y la tabla se queda casi sin contenido propio

Sus cinco columnas, una por una:

| Columna | Qué le pasa |
|---|---|
| `owner_person_id` | **Desaparece** (§10) |
| `title` | **Ya está duplicada**: `task_items.title` existe (`:770` y `:842`) |
| `origin_unit_id` | **Derivable**: `resolveOriginUnitIdForTaskItem` la saca del `target_unit_id` del entregable, de la unidad de su puesto responsable o del `scope_unit_id` de la tarea. Es una caché de tres cosas que ya están |
| `status` | **Propia.** Es el estado real del documento, y sí tiene escritores |
| `comments_thread_ref` | **Propia.** El hilo de conversación |

Quedan **dos hechos propios**. Una tabla con una foránea entrante, dos columnas suyas y una relación
1:1 estricta —un solo `INSERT` en todo el backend, y siempre con `task_item_id`— es una cáscara.

### El argumento en contra, que es real

**Un entregable que no produzca documento.** Hoy no existe: `task_items.template_artifact_id` es
`NOT NULL` y `ensureDocumentForTaskItem` corre para todos. Pero si mañana un entregable es «entregar
la llave del laboratorio», fundir obliga a arrastrar columnas de documento en una fila que no lo es.

Es la única razón de peso para no fundir, y es **hipotética**: hoy el modelo dice que todo
entregable produce documento, porque su plantilla es obligatoria.

### Veredicto

**Fundir mejora**, pero la mejora grande —matar `owner_person_id`— **se consigue sin fundir**, sólo
derivándolo de la tenencia. Fundir añade encima: un JOIN menos en muchos sitios, el fin del `title`
duplicado y el 1:1 dejando de ser una convención sobre una columna `NULL`able.

**Recomendación: hacerlo en dos tiempos.** Primero la tenencia, que es lo que arregla el daño
medido. Fundir `documents` después, como paso propio, cuando ya no haya que decidir a la vez qué
pasa con el propietario.

---

# Tercera vuelta (2026-08-23) — el diseño de la tenencia

## 12 · Corrección: `documents` no tiene DOS hechos propios. Tiene CERO.

En §11 dije que, quitado el propietario, a `documents` le quedaban `status` y `comments_thread_ref`
como hechos suyos. **Los medí después y no lo son.**

### `comments_thread_ref` está muerta — y está en DOS tablas

Aparece exactamente en cuatro sitios: `documents` (`:844`), **`tasks` (`:748`)**, y dos entradas de
`sqlTables.js` etiquetadas literalmente **«Comentarios (legacy)»** con `readOnly: true`.

**Cero lecturas y cero escrituras** en servicios y controladores. Es un fósil de cuando los
comentarios vivían fuera de PostgreSQL.

Y el dueño tiene razón en lo otro: **los comentarios ya están modelados, y ya unifican las dos
fases**. `document_workflow_observations` cuelga de `task_item_id` **y** de `document_version_id`, y
lleva `phase CHECK (phase IN ('review','signature'))` — o sea, entrega y firma en la misma tabla,
con `kind`, `message`, `author_person_id` y `resolved_by_person_id`/`resolved_at`. Exactamente lo
que decía: *«al final es lo mismo»*.

### `status` es una derivación, y su validación es código muerto

`documents.status` no lo escribe nadie por su cuenta: sale de
`deriveDocumentStatusFromVersionStatus(document_versions.status)`, un mapa 1:1 salvo que
`En llenado` y `En revisión de llenado` colapsan en `En proceso`.

Y hay algo peor: **`transitionDocumentState` tiene UN SOLO llamador** —dentro de su propio fichero
(`DocumentStateService.js:191`)— **y siempre pasa `allowDirect: true`**, que se salta la matriz de
transiciones del documento. Es decir: existe un catálogo de transiciones para `documents.status`
que **no se aplica nunca**.

### El balance corregido

| Columna de `documents` | Qué es en realidad |
|---|---|
| `owner_person_id` | Copia de `assigned_person_id`, refrescada por 1 de 4 relevos (§10) |
| `title` | Duplicada con `task_items.title` |
| `origin_unit_id` | Derivable de tres sitios que ya existen |
| `status` | **Derivada** de `document_versions.status`, con matriz muerta |
| `comments_thread_ref` | **Fósil.** Cero código. Y también en `tasks` |

**Ni una sola columna propia.** `documents` es una tabla intermedia entre `task_items` y
`document_versions` que no aporta ningún hecho que no esté en uno de los dos.

---

## 13 · La tabla de tenencias

```sql
CREATE TABLE IF NOT EXISTS task_item_tenures (
  id INT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  task_item_id INT NOT NULL,

  -- QUIEN responde. NULL a proposito: es como se representa el ABANDONO.
  person_id INT NULL,

  -- EN CALIDAD DE QUE respondia. Instantanea historica, no cache: una tenencia cerrada no se
  -- vuelve a tocar, asi que no puede envejecer. Es la diferencia con `task_assignments`.
  position_id INT NULL,

  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at   TIMESTAMP NULL,

  -- POR QUE se abrio esta tenencia. Mismo vocabulario que `task_item_handovers.trigger_kind`
  -- mas `original`, que hoy no existe porque el primer reparto no dejaba asiento.
  opened_by TEXT CHECK (opened_by IN (
    'original', 'occupancy_start', 'occupancy_end',
    'position_deactivated', 'reconcile', 'manual'
  )) NOT NULL,

  reason VARCHAR(255) NULL,
  performed_by_user_id INT NULL,   -- solo lo rellena el traspaso a proposito

  -- Unicidad parcial con el MISMO idiom que `uq_position_current` (`postgres_schema.sql:172`).
  current_flag SMALLINT GENERATED ALWAYS AS (CASE WHEN ended_at IS NULL THEN 1 ELSE NULL END) STORED,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_task_item_tenures_item FOREIGN KEY (task_item_id) REFERENCES task_items(id) ON DELETE CASCADE,
  CONSTRAINT fk_task_item_tenures_person FOREIGN KEY (person_id) REFERENCES persons(id),
  CONSTRAINT fk_task_item_tenures_position FOREIGN KEY (position_id) REFERENCES unit_positions(id)
);

-- LA INVARIANTE: como mucho UNA tenencia abierta por entregable. Deja de ser una convencion
-- que el codigo cumple si no se equivoca, y pasa a ser algo que la base no deja romper.
CREATE UNIQUE INDEX IF NOT EXISTS uq_task_item_tenure_current
  ON task_item_tenures (task_item_id, current_flag);

CREATE INDEX IF NOT EXISTS idx_task_item_tenures_person ON task_item_tenures (person_id);
```

### Las cuatro decisiones de diseño, y por qué

**1 · `person_id` puede ser `NULL`, y eso ES el abandono.**
Un entregable siempre tiene **exactamente una** tenencia abierta; cuando su responsable deja el
puesto y no hay sucesor, se cierra la suya y se abre otra **sin persona**, con
`opened_by = 'occupancy_end'`. Así «¿desde cuándo está abandonado?» es un campo (`started_at`) y no
un cálculo, y «los abandonados» es `WHERE person_id IS NULL AND ended_at IS NULL` — que hoy se busca
a mano en `listStuckTaskItems` con `assigned_person_id IS NULL AND responsible_position_id IS NOT NULL`.

**2 · `position_id` sí va en la tenencia, aunque el ancla esté en `task_items`.**
Parece una copia y no lo es: **una tenencia cerrada es inmutable**. Guardar el puesto ahí es
registrar *en calidad de qué* respondía esa persona, y eso no puede envejecer porque nadie lo va a
reescribir. La diferencia con `task_assignments` es exactamente ésa: aquélla pretendía ser el estado
actual y nadie la refrescaba; ésta es historia y no se refresca a propósito.
Su valor difiere del ancla en el caso legítimo: una **suplencia** por traspaso manual, donde la
persona responde sin ocupar el puesto (`position_id` nulo, `opened_by = 'manual'`).

**3 · `task_items.assigned_person_id` SE QUEDA, como caché de un solo escritor.**
Medido: hay **21 referencias** en 7 ficheros, y **9 están en `taskAssignment.js`** —el servicio que
se reescribe—, así que las externas son ~12. Quitarla es viable, pero mete un JOIN en el motor de
acceso y en el panel, que son los dos caminos calientes.
La mantiene **un trigger sobre `task_item_tenures`**, y ése pasa a ser su **único** escritor. Es lo
que arregla el daño de fondo: hoy hay **cuatro** escritores del responsable y uno se olvidó de dos
copias. Con esto sólo hay **una** forma de cambiar de responsable —cerrar tenencia, abrir tenencia—
y el resto se deriva.
Y no es un patrón nuevo en este repo: `position_assignments.is_current` + `uq_position_current`
hacen exactamente lo mismo un piso más abajo.

**4 · `task_item_handovers` desaparece.** Sus seis columnas están todas aquí
(`trigger_kind`→`opened_by`, `reason`, `performed_by_user_id`, `created_at`, y el par
`from`/`to` que ahora son dos filas consecutivas). Gana el `position_id` y el `original`, que no
tenía. No hay que migrar nada: **no hay datos en producción** y la semilla se reescribe.

### Lo que la tabla NO lleva, y por qué

- **Ningún estado del trabajo.** «Congelar lo que quedó» no es de la tenencia: el trabajo está en
  `document_versions`, que ya versiona. Lo que falta ahí es **el autor**
  (`created_by_person_id`), que hoy no existe en ninguna columna. Con eso, «Juan escribió hasta la
  0.3 y María siguió desde la 0.4» sale directo; sin eso hay que cruzar fechas.
- **Ninguna copia de `documents.owner_person_id`.** Esa columna desaparece: moderar observaciones
  pasa a mirar la tenencia vigente, y ver/firmar ya lo resuelve el conjunto de acceso (§10).

### Qué preguntas responde, que hoy no se pueden responder

| Pregunta | Hoy | Con tenencias |
|---|---|---|
| ¿Quién responde ahora? | una columna que 4 sitios pueden escribir | la tenencia abierta, con **un** escritor |
| ¿Quién respondía en marzo? | reproducir el log de relevos | un `BETWEEN` |
| ¿Cuánto tiempo lo tuvo cada uno? | no se puede | `ended_at - started_at` |
| ¿Qué entregables están abandonados y desde cuándo? | sólo «sin persona», sin fecha | fila abierta sin persona, con su `started_at` |
| ¿Puede haber dos responsables a la vez? | nada lo impide | **índice único** |
| ¿En calidad de qué respondía? | no se guarda | `position_id` de la tenencia |

---

# Decisiones del dueño (2026-08-23)

> ⚠️ **SE LLAMAN `DR1`, `DR2`, `DR3` — «Decisión del Relevo» — y NO `D1`, `D2`, `D3`.**
>
> Se renombraron el 2026-08-23, el mismo día, porque **`D1`…`D7` ya son las FASES del frente 9** y la
> colisión hacía ilegible el plan: en la misma tabla de control convivían un «supersedida por D2»
> que hablaba de esta decisión y un «va detrás de D2» que hablaba de la fase. El dueño lo leyó y
> dijo, con razón, que no encontraba la lógica. **No tenía lógica: eran dos cosas distintas con el
> mismo nombre.**

## DR1 · Qué pasa con lo EMPEZADO cuando su persona deja el puesto

### Los cuatro estados, y son los que ya existen

El dueño los planteó y se verificaron contra el código: **están diseñados así**.

| Estado | Cómo se representa | Relevo automático |
|---|---|---|
| Sin empezar | `user_started_at IS NULL` | **Sí** (ya funciona) |
| Empezado, aún sin fase de firma | fecha sellada, documento antes de «Pendiente de firma» | **Sí** ⬜ *por hacer* |
| En fase de firma, incompleta | «Pendiente de firma» / «Firmado parcial» | **No** |
| Cerrado | **«Final»** | **No** |

Dos precisiones que salieron al medir:

1. **El cierre es automático.** Cuando entra la última firma, el documento pasa a «Firmado completo» y
   **en la misma operación** se sella el fichero definitivo y salta a «Final»
   (`finalizeDocumentVersionIfComplete`). «Final» es uno de los tres estados terminales. Nadie tiene
   que declarar el cierre.
2. **Hoy los estados 3 y 4 se protegen POR ACCIDENTE.** No se relevan porque tienen `user_started_at`
   sellado, no porque tengan firmas ni porque estén cerrados. En cuanto se abra el estado 2, **esa
   protección desaparece para los otros dos** y hay que ponerles su guard explícito. Es la mitad del
   trabajo, y no se ve leyendo el diseño.

### Decisión DR1.a — dónde corta

**Al ENTRAR en fase de firma**, no al estamparse la primera firma. A partir de «Pendiente de firma»
hay gente convocada con solicitudes abiertas a su nombre, y cambiarles el responsable del documento
por debajo es confuso. Además se lee de `task_items.document_status`, que el entregable ya tiene.

### Decisión DR1.b — quién desatasca

**El jefe de la unidad**, desde el panel que ya existe.

El hueco que lo motiva: el reset exige ser **el titular del paso actual**, y lo comprueba contra
**quien hace la llamada** (`userId: authenticatedUserId`), no contra el usuario de la ruta. La ruta
admite roles elevados pero el servicio los rechaza igual. Así que **si la persona que se fue es quien
tiene el paso, no puede desatascar nadie**: ni el relevo lo mueve (tiene firmas) ni el reset lo abre.

El sitio ya está pensado: `SupervisorStuckPanel` lista los atascados de las unidades que uno encabeza
y dice literalmente *«La reasignación (traspaso) se habilitará desde aquí en el siguiente paso»*.
Nunca se construyó el botón.

### Lo que hay que hacer

| | Tarea |
|---|---|
| 1 | El relevo automático deja de filtrar por `user_started_at` y pasa a filtrar por `document_status`: alcanza hasta antes de «Pendiente de firma» |
| 2 | Guard explícito para el estado cerrado, que hoy sólo se protege de rebote |
| 3 | El jefe de unidad puede traspasar y reiniciar los atascados de su unidad — el botón que falta en el panel |
| 4 | Asiento propio para el relevo de algo empezado, distinto del de lo no empezado |

### ⚠️ DR1 y DR3 están acopladas

El hueco de DR1.b existe **porque la solicitud sigue a nombre de quien se fue**, que es justo lo que
decide DR3. Si las solicitudes siguieran al relevo, el sucesor sería el titular del paso y podría
desatascar solo. Se resuelve por la vía del jefe **a propósito**: una solicitud de FIRMA no debería
heredarse —le pediría al sucesor que dé conformidad a algo que él no elaboró—, así que el acoplamiento
no se rompe automatizando, se rompe con una decisión humana.

## DR2 · Qué pasa cuando se DESACTIVA un puesto

### Lo que pasa hoy: nada

Verificado ejecutandolo: se desactiva el puesto y sus entregables siguen igual —mismo puesto, mismo
responsable, ninguna tenencia se mueve—. **No hay ningun trigger sobre `unit_positions`.** Y queda la
huella de que se penso: el vocabulario de causas incluye **`position_deactivated`** y **nadie lo
escribe jamas**. Un nombre reservado para un camino que no existe.

Borrar es otra cosa: **la base lo rechaza** si el puesto tiene entregables o gente. Bien —evita
entregables apuntando al vacio— pero es un «no» seco de PostgreSQL, no una explicacion.

### Por que importa mas de lo que parece

Desactivar un puesto NO es quedarse sin ocupante:

| | Que significa | Que hace el modelo |
|---|---|---|
| Sin ocupante | la silla sigue, vacia | ✅ el entregable queda huerfano CON FECHA, y quien llegue lo recoge |
| Silla desactivada | la silla deja de existir | ❌ nada — **y no va a llegar nadie nunca** |

Un entregable huerfano por vacante espera a alguien que va a venir. Uno anclado a un puesto
desactivado **espera a alguien que no existe**. Y desde el 2026-08-23 el puesto responsable es
obligatorio, asi que el ancla apunta a algo que la institucion ya no reconoce.

El modelo **no dice que sustituye a un puesto desactivado** —no hay «se fusiono con» ni «sus
funciones pasan a»—, asi que reasignar solo seria adivinar.

### Decisión

**Se permite desactivar, y se avisa al jefe de la unidad.** Ni se bloquea la reorganizacion ni se
adivina un sucesor.

Y una consecuencia que se deriva de DR1: **el marcado no alcanza a todo**.

| Estado del entregable | Que le pasa al desactivar su puesto |
|---|---|
| Antes de la fase de firma | queda huerfano con causa `position_deactivated` — el nombre que llevaba años sin emisor |
| En fase de firma | **no se toca la tenencia** (contradiria DR1); solo se LISTA para el jefe |
| Cerrado | nada: no queda trabajo |

## DR3 · Que pasa con las SOLICITUDES pendientes en un relevo

### Lo que pasa hoy: el sucesor no puede trabajar

El guard es literal: *«No puedes operar una solicitud de entrega asignada a otro usuario.»*
(`assertFillActionAllowed`). Asi que tras un relevo el entregable es de Maria, la solicitud sigue a
nombre de Juan, y **Maria recibe un 403**. El entregable cambia de manos pero el trabajo no.

### ⚠️ Correccion de lo que se dijo en DR1

Se afirmo que «una solicitud de FIRMA no deberia heredarse porque le pediria al sucesor que de
conformidad a algo que el no elaboro». **Es falso en el caso general.** Una plantilla *official* solo
puede autorar el firmante de DOS maneras, y las dos son POSICIONALES:

| Resolutor | ¿Heredar es correcto? |
|---|---|
| `cargo_in_scope` | **Si** — firma quien ocupe el cargo |
| `task_assignee` | **Si** — y tras el relevo ese ES el sucesor |
| `specific_person` | **No** — pero solo lo autoran plantillas *ad_hoc* |

La obligacion de firmar es del PUESTO. Lo que no se hereda es una firma **ya estampada**, y eso no
esta en juego: una solicitud pendiente no ha estampado nada.

### Decisión

**Las solicitudes SIGUEN al nuevo responsable**, con dos acotaciones:

1. **Excepcion `specific_person`**: un paso definido para una persona concreta no se toca.
2. **Alcance**: solo se mueve lo que estaba a nombre de quien se fue POR SER EL RESPONSABLE del
   entregable. Un paso de firma definido para un cargo DISTINTO no tiene nada que ver con el relevo.

Nota: ya existe el mecanismo alternativo —una solicitud sin dueño y marcada `is_manual` la reclama
el primero que la toma, y esta probado en la suite—. Se descarta a proposito: deja el trabajo sin
bandeja mientras nadie lo reclame.
