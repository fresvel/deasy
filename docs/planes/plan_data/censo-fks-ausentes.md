# Censo de columnas `*_id` sin clave foránea (`TD7-c`)

> **Medido el 2026-08-23** sobre `backend/database/postgres_schema.sql`, y **verificado ejecutando**
> lo que se afirma. Son **18**, y la mitad no son lo que parecen.
>
> El plan pedía clasificarlas en tres categorías —decisión explícita · ciclo evitado · descuido—.
> Hicieron falta **cinco**: el censo cuenta de más, y hay dos descuidos de naturaleza distinta.

## Resumen

| | Categoría | Cuántas | ¿Hay que hacer algo? |
|---|---|---:|---|
| **A** | **No son referencias** — el censo las cuenta de más | 3 | No |
| **B** | **Ciclo evitado** — decisión correcta y ya documentada | 1 | No |
| **C** | **Decisión explícita**: «FK lógica, para no acoplar» | 10 (+1) | ✅ Revisada y revertida (`TD7-c3`, 2026-08-24) |
| **D** | **Descuido de tipo** — no pueden llevar FK porque el tipo no casa | 2 | Sí → `TD7-d` |
| **E** | **Descuido dentro del propio dominio** | 2 | ✅ Hecho (`TD7-c2`, 2026-08-24) |

---

## A · No son referencias (3)

Una columna que acaba en `_id` no es necesariamente una clave foránea. Estas tres no apuntan a
ninguna fila de ninguna tabla:

| Columna | Qué es |
|---|---|
| `tasks.normalized_scope_unit_id` | Columna **generada**. Normaliza `NULL` a `0` para emular unicidad parcial en `uq_tasks_definition_term_scope`. No apunta a nada |
| `signature_batch_jobs.job_id` | `CHAR(36)` — el **UUID del trabajo** de firma por lotes. Es su identificador, no una referencia |
| `chat_notifications.entity_id` | `VARCHAR(64)` — id **polimórfico**: a qué tabla apunta lo dice `entity_type`. Una FK es **imposible por definición**, no una omisión |

**Nada que hacer.** Y conviene que quede escrito, porque el censo se va a repetir.

## B · Ciclo evitado (1)

| Columna | Por qué |
|---|---|
| `chat_conversations.last_message_id` | Apunta a `chat_messages.id`, que a su vez apunta a la conversación. Poner la FK crearía un ciclo que complica el borrado y el orden de inserción |

**El propio esquema ya lo documenta** (`postgres_schema.sql`, cabecera del bloque de chat). Decisión
correcta y explicada: nada que hacer.

## C · Decisión explícita, y con coste medido (10)

El esquema lo declara sin ambigüedad:

> *«Los `person_id` / `process_id` / `unit_id` / `definition_id` son FKs lógicas al núcleo relacional
> (`persons`/`processes`/`units`/`process_definition_versions`); **no se ponen constraints para no
> acoplar**.»*

| Tabla | Columnas |
|---|---|
| `chat_conversations` | `process_id`, `scope_process_id`, `scope_unit_id`, `scope_current_definition_id`, `scope_origin_definition_id` |
| `chat_conversation_participants` | `person_id` |
| `chat_messages` | `sender_person_id` |
| `chat_message_reads` | `person_id` |
| `chat_notifications` | `recipient_person_id` |
| `dossiers` | `person_id` — su comentario también dice «FK lógica a persons» |

### El coste, medido — y la premisa, falsa

La decisión parecía defendible como postura: el chat vino de EMQX y podría volver a salir de la
base. Al medirla para `TD7-c3` resultó que **su premisa ya no se sostiene**:

> `ChatAuthorizationService` resuelve **quién puede ver una conversación** con `INNER JOIN` contra
> `process_definition_versions`, `processes`, `units` y `position_assignments`.

El chat **no puede funcionar sin el núcleo**: lee el organigrama y las definiciones de proceso para
decidir permisos. La atadura ya existía y sostenía peso; lo único que faltaba era que la base la
conociera. Declararla no acopla nada nuevo.

Y el precio de no declararla estaba medido, ejecutándolo: `persons` está en el CRUD genérico,
`SqlAdminService.remove()` hace `DELETE FROM <tabla>` sin restricción, y **una persona sin otros
datos se borraba sin que nada lo impidiera**. Peor que los mensajes huérfanos era el ámbito: como el
permiso se resuelve con `INNER JOIN`, borrar la unidad de una conversación **la volvía invisible para
todos**, sin error y sin que nadie supiera por qué.

**Decisión del dueño (2026-08-24): que el sistema lo impida.** Las once columnas llevan ya su
restricción, con la política por defecto —la de las otras 18 claves a `persons`—, salvo
`dossiers.person_id`, que va con `CASCADE`: un expediente es el CV de esa persona y no significa nada
sin ella, igual que `person_certificates`. Los mensajes de chat **no** llevan `CASCADE`, y es
deliberado: borrar a alguien no puede llevarse la conversación de los demás.

### ⚠️ Once, no diez: el censo tenía un punto ciego

`chat_conversations.created_by` es una persona y **el censo no la vio**, porque buscaba columnas
acabadas en `_id`. La convención de nombres escondía una referencia. Si este censo se repite, hay que
buscar por lo que la columna *significa*, no por cómo se llama.

## D · Descuido de tipo (2) → `TD7-d`

| Columna | Tipo | Contra |
|---|---|---|
| `task_item_tenures.performed_by_user_id` | `BIGINT` | `persons.id` es `INT` |
| `signature_batch_jobs.user_id` | `BIGINT` | `persons.id` es `INT` |

**No pueden llevar FK aunque se quiera: el tipo no casa.** Y ése es exactamente el descuido — no es
que se decidiera no ponerla, es que no se podía. Se arreglan en `TD7-d`.

## E · Descuido dentro del propio dominio (2)

| Columna | Apunta a |
|---|---|
| `chat_notifications.conversation_id` | `chat_conversations.id` |
| `chat_notifications.message_id` | `chat_messages.id` |

**Aquí el argumento de «no acoplar» no aplica**: las tres tablas son del **mismo dominio**, y sus
hermanas sí llevan FK — `chat_conversation_participants`, `chat_messages`, `chat_message_attachments`
y `chat_message_reads` las tienen todas. `chat_notifications` es la única del chat **sin ninguna**.

Es una omisión, no una postura — y así quedó **cerrada el 2026-08-24** (`TD7-c2`): las dos FKs viven
ya dentro del `CREATE TABLE`, con `ON DELETE CASCADE`. La política no es libre: la eligen sus
hermanas. `chat_messages.reply_to_message_id` usa `SET NULL` porque una respuesta **es contenido** y
sobrevive a que borren su padre; `participants`, `attachments` y `reads` usan CASCADE porque son
accesorios de su mensaje. Una notificación es lo segundo: **es un puntero**, y sin destino queda un
enlace muerto que el usuario puede pulsar.

Y la cabecera del bloque de chat lo dice ahora explícitamente: **el criterio de «no acoplar» mira
hacia afuera, y solo hacia afuera**. Dentro del dominio las referencias llevan constraint.
