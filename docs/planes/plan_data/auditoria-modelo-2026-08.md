# Auditoría del modelo de negocio — bitácora

> **Qué es esto.** El recorrido tabla por tabla del modelo, buscando contradicciones entre lo que el
> negocio necesita, lo que el esquema declara y lo que el código hace. **No es un plan**: es el
> registro de lo que se ha mirado, con qué método y qué salió.
>
> El modelo explicado está en el sitio de documentación:
> [Del proceso al documento firmado](../../src/content/docs/explicacion/modelo-proceso-documento.md)
> y [Campos de la cadena](../../src/content/docs/referencia/campos-proceso-documento.md).

## ⚠️ Antes de auditar nada: recrea la base

Desde `TD7-s` (2026-08-24) el esquema **describe la forma y no converge bases anteriores**. Una pila
levantada hace tiempo conserva la forma vieja, y **medir contra ella da respuestas falsas**.

Pasó en esta misma auditoría: la pila B decía que `process_target_rules.recipient_policy` admitía
`one_per_unit`, y el esquema del repo dice `unit_head`. La página de documentación llevaba el valor
viejo y estuvo a punto de darse por buena.

**Recrea la base antes de medir** (`npm run test:char:run` la resetea, siembra y deja los 301
contratos verdes) y comprueba una constante conocida antes de fiarte del resto.

## Método

Cuatro barridos mecánicos, en este orden. Los cuatro se pueden repetir y los cuatro dieron algo:

| | Qué busca | Cómo |
|---|---|---|
| **1** | Valores que la base admite y **nadie escribe** | Cada `CHECK` cerrado contra `grep` en `.js/.mjs/.vue` |
| **2** | Tablas que **ningún código consulta** | `FROM/INTO/UPDATE/JOIN <tabla>` en el backend, más `sqlTables.js` |
| **3** | Columnas que **nadie nombra** | `grep` del nombre de columna en backend y frontend |
| **4** | Afirmaciones de la documentación **contra la base** | Consultar el catálogo y comparar |

⚠️ **Los barridos 1 y 3 tienen falsos positivos y hay que resolverlos a mano.** Un valor puede
escribirlo un **trigger** del propio esquema (invisible a `grep` en JavaScript) y una columna puede
leerse por `SELECT *`. Los tres primeros hallazgos del barrido 1 fueron exactamente eso.

## Hallazgos · 2026-08-24

### H1 · La documentación decía un valor que la base no admite — ✅ corregido

`datos-motor-de-procesos.md` documentaba `recipient_policy` como
`all_matches` / `one_per_unit` / `exact_position`. El valor real es **`unit_head`**. Alguien que
escribiera una regla siguiendo la documentación se habría encontrado con un rechazo de la base.

### H2 · Un diagrama publicado dibujaba una tabla muerta — ✅ corregido

El diagrama del motor de procesos seguía dibujando `documents`, retirada el 2026-08-23. El
recorrido publicado enseñaba `task_items → documents → document_versions`, y hoy los documentos
cuelgan **directamente del entregable**. Se aprovechó para añadir `task_item_tenures` y
`document_version_uploads`, que no aparecían.

### H3 · Cinco tablas que ningún código consulta — ⬜ decisión pendiente

De las **67** tablas del esquema, exactamente cinco no las toca ninguna consulta **ni** están en el
CRUD genérico:

`aplications` · `offers` · `contract_origins` · `contract_origin_recruitment` · `contract_origin_renewal`

Son la cadena de contratación: postulación → oferta → origen del contrato. Existen sus tablas, sus
`CHECK` con vocabulario completo (`aplicado`, `preseleccionado`, `entrevista`, `seleccionado`…) y sus
claves ajenas. **No existe ni una línea de código que las lea o escriba.**

Y hay una promesa colgando: el rol **`GestorContratacion`** se describe como *«Gestiona vacantes,
postulaciones, ofertas…»* y de las tres **solo existe `vacancies`** — que además solo se maneja desde
el editor genérico de tablas, sin pantalla propia.

**Es una decisión del dueño, no un defecto**: o el dominio se implementa, o se retira del esquema y
del catálogo de roles. Lo que no puede quedarse es a medias y sin decir que lo está.

### H4 · Una regla de negocio real que no estaba documentada — ✅ documentada

`task_items` tiene dos columnas que nadie nombra desde el código:
`process_definition_template_key` y `responsible_position_key`. **No son copias de seguridad** —así
las describía la primera versión de la página del modelo, y era falso—.

Son **generadas**: valen el identificador original solo si `origin_kind = 'process_defined'`, y vacío
si el entregable lo añadió una persona. Existen para que el índice único
`uq_task_items_defined_target` sobre `(tarea, vínculo, puesto)` **se aplique solo a lo que genera el
proceso**. El efecto es la regla que se buscaba:

> **El disparo no puede crear dos veces el mismo entregable para la misma silla, pero una persona sí
> puede crear tantas réplicas como necesite.**

Es el cuarto uso del mismo idioma en el esquema, y merece leerse junto: `head_flag` (un solo jefe por
unidad), `current_flag` (una sola ocupación vigente), `uq_task_item_tenure_current` (un solo turno
abierto) y `normalized_scope_unit_id` (idempotencia del lanzamiento). **Cuatro reglas de negocio que
no viven en el código**: las impone la base y no se pueden saltar.

## Lo que falta por auditar

| Alcance | Estado |
|---|---|
| Las **39 tablas** de la cadena proceso → documento | 🟡 Barridos 1-4 hechos; falta el recorrido semántico tabla por tabla |
| Las **28 restantes** (chat, RBAC, expediente, contratación, catálogos) | ⬜ Sin empezar |
| Los **estados sin `CHECK`** (documento, ronda, tarea) | ⬜ Es `TD7-e`, decisión pendiente |
| El **JSONB `signers`** | ⬜ Es el defecto 1.19, con plan escrito |
