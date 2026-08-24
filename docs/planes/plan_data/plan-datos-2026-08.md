# Plan de datos — siete fases sobre la capa de persistencia

> **Estado: 0 de 7 fases.** Creado el **2026-08-09**; D7 añadida el **2026-08-14**.
> El estado por tarea vive en el [§0 · Control de ejecución](#0--control-de-ejecución), y **se
> actualiza en el mismo commit** que la tarea que cierra.
>
> Este plan **se ejecuta**; el retrato del esquema que lo sustenta está en
> [`referencia-esquema.md`](./referencia-esquema.md) y **se consulta**.
>
> Antes de tocar nada: [`../referencia/metodo.md`](../referencia/metodo.md) y
> [`../referencia/patrones-diseno.md`](../referencia/patrones-diseno.md). Este plan **no contradice**
> a ninguno de los dos —los aplica a la capa de datos, que era el hueco que quedaba—.

---

## Por qué existe este plan

La pregunta que lo originó fue: *«¿conviene crear una clase por cada tabla?»*. La respuesta corta es
**no**, y está justificada en §1. Pero contestarla obligó a mirar la capa de datos entera por primera
vez, y ahí aparecieron **seis problemas reales** que ningún frente del plan maestro cubría: las
transacciones se abren a mano en once ficheros, el vocabulario de estados de `task_items` está
definido en cinco sitios con tres alfabetos distintos, y el esquema **no se puede alterar** en un
entorno con datos.

**Y una séptima fase, añadida el 2026-08-14: D7.** Ésa no salió de mirar la capa de datos, sino de
archivar el frente 0 y encontrar que **la auditoría funcional del modelo nunca se abrió como trabajo**.
Por qué vive aquí y no en un frente propio, en su propia sección.

Las fases van **ordenadas por retorno sobre esfuerzo**, como el maestro. Estados: ⬜ sin empezar ·
🟡 a medias · ⛔ bloqueado · ✅ cerrada, con evidencia y fecha.

| Fase | Qué | Esfuerzo | Retorno |
|---|---|---|---|
| **D7** | **Auditoría funcional del modelo documental** — las decisiones que quedaron abiertas | bajo | alto — dos de ellas están vivas hoy en la base |
| **D1** | Unit of Work: un solo `withTransaction` | bajo | alto — elimina 20 ciclos manuales |
| **D2** | Vocabulario de estados único + detector de *drift* de metadatos | bajo | alto — cierra una incoherencia viva |
| **D3** | Migraciones versionadas | medio | alto — hoy el esquema no se puede alterar en prod |
| **D4** | Repositorios **por agregado**, y fuera el SQL de `controllers/` | medio | medio-alto |
| **D5** | Matar el traductor de dialecto MySQL→PG | medio-alto | alto — es el fichero más denso del repo |
| **D6** | Validación por esquema en el borde de entrada | medio | medio |

⚠️ **D7 va la primera pese a llevar el número más alto.** El número es **orden de descubrimiento, no
de ejecución** — la misma convención que los frentes A…I del plan de calidad. Y va primera por una
razón concreta: **es la única fase que no es refactor**. Sus dos primeras tareas son decisiones del
dueño, y si esperan detrás de D1–D6 esperan meses mientras el efecto sigue vivo en la base.

---

## §0 · Control de ejecución

> **Esta tabla es el estado del plan.** Se actualiza **en el mismo commit** que la tarea que cierra —
> la norma está en [`../CLAUDE.md`](../CLAUDE.md). Los identificadores **no se renumeran nunca**.
>
> `⬜` sin empezar · `🟡` a medias · `⛔` bloqueada (con la causa escrita) · `✅` cerrada (con evidencia y fecha)

**Estado: 0 de 7 fases · 12 de 22 tareas de D7.**

| Tarea | Fase | Qué entrega | Estado | Evidencia | Fecha |
|---|---|---|---|---|---|
| `TD7-a` | D7 | **Decisión escrita**: si un vínculo puede apuntar a una edición `retired`, y si publicar una edición debe arrastrar sus vínculos | ⬜ | — | — |
| `TD7-b` | D7 | **La invariante de `published`, verificada**: hoy descansa en que un `draft` no tenga instancias, y `launch.js` **no mira `lifecycle_state`**. Decisión + prueba que la congele | ⬜ | — | — |
| `TD7-c` | D7 | **Censo de columnas `*_id` sin FK**, clasificadas | ✅ | [`censo-fks-ausentes.md`](./censo-fks-ausentes.md) · **18**, y hicieron falta CINCO categorías, no tres: 3 **no son referencias** (una generada, un UUID, un id polimórfico), 1 ciclo evitado, 10 decisión explícita **con su coste medido**, 2 descuido de tipo (→`TD7-d`) y 2 descuido dentro del propio chat | 2026-08-23 |
| `TD7-c2` | D7 | `chat_notifications` gana sus dos FKs internas (`conversation_id`, `message_id`) | ✅ | Era la **única tabla del chat sin ninguna** FK, y el «no acoplar» de la cabecera del bloque no le aplicaba: apunta a sus hermanas, no al núcleo. **CASCADE**, como sus tres hermanas accesorias —una notificación es un PUNTERO, no contenido; sin destino es un enlace muerto—. **Probado por mutación**: un `message_id` inexistente es rechazado, y borrar la conversación se lleva su notificación (1→0). El generador de DBML pasa de **5 a 7 refs internas** en el chat. Ningún golden movido | 2026-08-24 |
| `TD7-c4` | D7 | El mismo hecho, guardado dos veces en `chat_notifications` | ✅ | Fuera `entity_type`/`entity_id`: su único escritor los llenaba con **constantes**, nadie consultaba por ellos, el frontend no los leía, y al ser polimórficos **no podían llevar FK**. Sobrevive la pareja tipada, que se consulta, tiene integridad desde `TD7-c2` y guarda además el `message_id`, que un par polimórfico **no puede** representar. **El golden vigilaba de verdad**: quitarlos puso `chat.json` en rojo en 3 sitios antes de recapturar. Movido **solo** `chat.json`, −6 líneas | 2026-08-24 |
| `TD7-c3` | D7 | **Decisión del dueño**: ¿las «FKs lógicas» del chat y el dossier al núcleo se quedan así? | ⬜ | Medido: una persona sin otros datos **se borra y nada lo impide**, y `chat_messages` no tiene FK a `persons` — sus mensajes quedarían huérfanos. Es una postura defendible, pero ahora se conoce su precio | — |
| `TD7-d` | D7 | Los dos `BIGINT` contra `persons.id INT` corregidos, con su FK | ✅ | `INT` + `REFERENCES persons(id)` (política por defecto, como las otras 18). **Probado por mutación**: un `person_id` inexistente es rechazado por la base en las DOS tablas. `performed_by_user_id` → `performed_by_person_id` de paso: `user` era fósil de la tabla `users`, que ya no existe. Golden movido: **una línea** de `admin_crud.json`, que es la prueba | 2026-08-24 |
| `TD7-e` | D7 | **Decisión escrita**: cuáles de las columnas de estado sin `CHECK` bajan su dominio a la base. **Va detrás de D2** | ⬜ | **Remedido 2026-08-23: son 4, no 8** (`tasks.status`, `task_items.document_status`, `document_versions.status`, `signature_batch_jobs.status`) | — |
| `TD7-f` | D7 | **El diseño del acceso al entregable**, con las dos decisiones del dueño escritas y su evidencia | ✅ | [`acceso-al-entregable.md`](./acceso-al-entregable.md) · 2 decisiones · 4 defectos nuevos | 2026-08-22 |
| `TD7-g` | D7 | **P1** · La función única de participantes, con las fuentes que ya existen. Ningún guard cambia todavía | ✅ | `DeliverableAccessService.js` · 642/642 unit · 291/291 char sin mover goldens · 2 mutaciones en rojo | 2026-08-22 |
| `TD7-h` | D7 | **P2a** · El guard del entregable y los de observación usan la función; `isUserInTaskItemChain` desaparece | ✅ | 646/646 unit · 294/294 char · golden nuevo `deliverable_access` · mutación del IDOR: **52 en rojo** | 2026-08-22 |
| `TD7-h2` | D7 | **P2b** · Las tres copias restantes del guard: descarga de plantilla, panel y Centro Documental | ✅ | 650/650 unit · 294/294 char · alcance correlacionado nuevo · mutación limpia: **2 en rojo, los dos del IDOR** | 2026-08-22 |
| `TD7-h3` | D7 | **P2c** · El chat usa la función al nivel ancho; se podan las funciones sin llamador | ✅ | 639/639 unit · 294/294 char · `ChatAuthorizationService` de **332 a 223 líneas** · ningún golden movido | 2026-08-22 |
| ~~TD7-i~~ | D7 | **P3** · Las fuentes que faltaban | ❌ **RETIRADA (2026-08-23).** El caso que las justificaba —«alguien preparó el documento y se fue»— **no existe**: si lo preparó dentro del sistema entró en un flujo; si lo preparó fuera, el sistema no lo sabe. Y medido: los relevos registrados no aportan **ni una persona** que no esté ya en `assigned_person_id` | — | 2026-08-23 |
| `TD7-m` | D7 | **El modelo del entregable**, con las tres decisiones del dueño y lo que hay que implementar | ✅ | [`modelo-del-entregable.md`](./modelo-del-entregable.md) · 3 decisiones · 1 riesgo concreto | 2026-08-23 |
| ~~`TD7-n`~~ | D7 | Decisión: cuál sobrevive entre `target_position_id` y `responsible_position_id` | ❌ **RETIRADA (2026-08-23): la PREGUNTA estaba mal planteada**, no el plan. Yo los daba por duplicados —dos nombres para el mismo dato— y no lo son: `target_*` es a quién va dirigido, `responsible_position_id` quién lo produce. **`target_*` se retira igual, pero por otro motivo**: es derivable del flujo. No hay que elegir entre dos copias | — | 2026-08-23 |
| `TD7-v` | D7 | **Paso 1 · el envío sin flujo, eliminado** (`routed` y `free` lo exigen) | ✅ | 641/641 unit · 296/296 char · golden nuevo con 400 y su mensaje · ningún golden existente movido | 2026-08-23 |
| `TD7-w` | D7 | ~~**Paso 2** · derivar el «Para:» en el servidor~~ — **DESCARTADO** por decisión del dueño: el destinatario desaparece de la vista y lo que se verá es el flujo | ✅ | Descartado, no pendiente: derivar habría reconstruido en el servidor un dato que la pantalla deja de enseñar | 2026-08-23 |
| `TD7-x` | D7 | **Paso 3** · retirar `target_person_id` y `target_position_id` | ✅ | `f92b6256` + `2a75eb3e` · char 295/295 · unit 642/642 · la cascada del dueño del documento empieza ahora en quien lo ELABORA · 3 sitios del frontend con pastilla de hueco | 2026-08-23 |
| `TD7-y` | D7 | **Paso 4** · `responsible_position_id` pasa a NOT NULL; el índice único queda en (tarea, plantilla, productor) | ✅ | `4a403201` · char 294/294 **sin mover un golden** · el respaldo que sembraba entregables huérfanos, retirado · red probada por mutación | 2026-08-23 |
| `TD7-n` | D7 | **La TENENCIA como tabla propia**: `task_item_tenures`, con `task_item_handovers` plegada dentro | ✅ | `0e1a82e7` · char 297/297 · unit 645/645 · invariante «un solo responsable vigente» pasa de convención a **índice** · verificado ejecutando los triggers | 2026-08-23 |
| `TD7-o` | D7 | **`task_assignments` retirada**: era una foto del reparto que ningún relevo refrescaba | ✅ | `4cbfdd5e` · 12 lecturas repuntadas · el lanzamiento deja de escribirla-y-releerla · caen 3 fósiles (`hydrateGeneralTask` con **cero llamadores**) | 2026-08-23 |
| `TD7-p` | D7 | **`documents.owner_person_id` retirada**: la tercera copia del responsable | ✅ | `80fcf960` · goldens: **9 líneas y las 9 son esa columna** · el resolver legado `document_owner` delega en `task_assignee` | 2026-08-23 |
| `TD7-z` | D7 | **D1** · el relevo llega hasta ANTES de la firma; el cierre gana guard explícito; la tenencia sella `work_started` | ✅ | `a81a8547` · char 294/294 sin mover golden · lista duplicada JS/SQL vigilada por una prueba que **lee el esquema** · 2 mutaciones en rojo | 2026-08-23 |
| `TD7-z2` | D7 | **DR1.b y DR2** · el jefe de unidad puede reasignar y reiniciar desde su panel | ✅ | `1dcc0b66` · el botón que el panel prometía desde su nacimiento · 3 defectos hallados en el navegador (`AppButton` sin importar, `DISTINCT`+`ORDER BY`, `ANY(?)`) | 2026-08-23 |
| `TD7-z3` | D7 | **D2** · desactivar un puesto emite `position_deactivated` y lo hace visible al jefe | ✅ | `78fd13c0` · estrena una causa que llevaba años **sin un solo emisor** · el término `is_active = 0` del panel, probado por mutación | 2026-08-23 |
| `TD7-z4` | D7 | **D3** · las solicitudes pendientes siguen al responsable | ✅ | `044c9a68` · en UN solo sitio (el trigger de sincronía), no en los cinco caminos · regla «alinear al vigente», no «mover de X a Y» · 2 mutaciones en rojo | 2026-08-23 |
| `TD7-z5` | D7 | **La versión mayor/menor y la bitácora de subidas**: ya consta quién elaboró un documento | ✅ | `a6d2d7b2` · `document_version_uploads` · numeración propuesta por el dueño · se descartó el JSON por el precedente del **defecto 1.19** | 2026-08-23 |
| ~~`TD7-o`~~ | D7 | Arreglar la idempotencia del relanzamiento | ❌ **RETIRADA (2026-08-23): no estaba rota.** La consulta sirve a la rama «sin destinatarios»; la rama con destinatarios tiene su propia idempotencia. El riesgo lo inventé leyendo la función equivocada | — | 2026-08-23 |
| ~~`TD7-p`~~ | D7 | El lanzamiento crea un entregable por destinatario | ❌ **RETIRADA (2026-08-23): ya estaba implementado.** `ensureTaskItemsForTaskTargets` lo hace; leí `ensureTaskItemsForTask`, que es otra función | — | 2026-08-23 |
| `TD7-q` | D7 | **`tasks.responsible_position_id` retirado**; `scope_unit_id` pasa a NOT NULL | ✅ | 27 lecturas repuntadas · 641/641 unit · 294/294 char · el golden del chat gana **al Coordinador de Carrera como moderador**, que es `is_unit_head` de su unidad | 2026-08-23 |
| `TD7-q2` | D7 | **`tasks.created_by_user_id` retirado** (duplicaba `process_runs`) | ✅ | 641/641 unit · 294/294 char · 403/403 front · la fuente de acceso pasa a `entregable_creador` | 2026-08-23 |
| `TD7-t` | D7 | **`document_workflow_observations.target_person_id` borrado**, y con él las dos fuentes de acceso por observación | ✅ | 641/641 unit · 294/294 char · el chat lo destapó con un 500 antes de que llegara a producción | 2026-08-23 |
| `TD7-u` | D7 | **`task_items.status` borrado**: 5 filtros muertos y 3 proyecciones | ✅ | 641/641 unit · 294/294 char · goldens: **6 líneas, todas `status: pendiente`, cero adiciones** · `isDocumentPending` derivado del catálogo con guardia | 2026-08-23 |
| `TD7-r` | D7 | **`one_per_unit` → `unit_head`**: el valor hace lo que su etiqueta promete | ✅ | `is_unit_head` en la consulta · 641/641 unit · 294/294 char · `CHECK` verificado en base recreada · **3** diccionarios de etiqueta unificados | 2026-08-23 |
| `TD7-s` | D7 | Colapsar las piezas de código de migración del esquema dentro de su tabla | ✅ | **Remedido: eran 20 operaciones en 11 sentencias** (6 `ALTER`, 2 `UPDATE`, 3 bloques `DO`), no 18. Las 20 eran **no-op sobre una base recién creada** —verificado una por una— y su precio era que `persons.token` estaba declarada **dos veces y en contradicción** (`NOT NULL UNIQUE` en la tabla, `NULL` en el `ALTER`). Prueba de que la forma no cambia: **`gen-dbml --check` exit 0**, o sea que el modelo introspectado de una base nueva sale byte a byte igual al commiteado. Puerta nueva en `postgres_schema.test.js` (6 patrones + `token`), **probada por mutación**. −185 líneas | 2026-08-24 |
| `TD7-j` | D7 | ~~**P4** · El custodio: recorrido orgánico hasta el primer jefe~~ — **SUPERSEDIDA por `DR2`** (2026-08-23), la decisión del dueño sobre el puesto desactivado — **no por la fase D2**, que es otra cosa | ✅ | El dueño decidió que **no se adivina sucesor**: el modelo no dice qué sustituye a un puesto desactivado. Lo decide una persona, desde el panel de supervisión (`TD7-z2` + `TD7-z3`). El custodio automático dejó de tener sitio | 2026-08-23 |
| `TD7-k` | D7 | **P5** · Eliminar un puesto deja de borrar su historia | ✅ | El endpoint estaba **MUERTO al 100%**: su primer `DELETE` era sintaxis multi-tabla de MySQL y **cualquier** llamada daba `400 · syntax error` — incluso la de un puesto inexistente. Ahora: 404 · 409 nombrando qué bloquea con conteos · 200 si está virgen. La historia ya no se toca. Contrato HTTP nuevo (no tenía, por eso murió) y **2 mutaciones en rojo**. char 301/301 · unit 652/652 | 2026-08-23 |
| `TD7-k2` | D7 | **P5 (2.ª mitad)** · Desactivar un puesto debería CERRAR su ocupación | ⬜ | Medido el 2026-08-23: hoy no la cierra, así que la persona sigue figurando como **titular vigente de un puesto que ya no existe**. Es una decisión del dueño: ¿cerrarla, o es correcto que un puesto inactivo conserve a su ocupante? | — |
| `TD7-l` | D7 | **P6** · La fusión: `documents` se absorbe en `task_items`; mueren `owner_person_id` y `task_items.status` | ✅ | `ae29e12e` (6a: las columnas) + `cdf66b39` (6b: la tabla) · `documents` no tenía **ni una columna propia** · las versiones cuelgan ya del entregable · gate nuevo `check:sql-aliases` nacido de este cambio | 2026-08-23 |
| `D1` | — | Un solo `withTransaction`; los 20 ciclos manuales, fuera | ⬜ | — | — |
| `D2` | — | Un vocabulario de estados, no cinco, + detector de *drift* | ⬜ | — | — |
| `D3` | — | Migraciones versionadas: el esquema se puede alterar con datos dentro | ⬜ | — | — |
| `D4` | — | Diez repositorios por agregado; cero SQL en `controllers/` | ⬜ | — | — |
| `D5` | — | El traductor de dialecto, muerto (**D5-b ⛔** hasta cerrar D5-a; el cerrojo del defecto 1.11 se retiró el 2026-08-14) | ⬜ | — | — |
| `D6` | — | Validación por esquema en el borde de entrada | ⬜ | — | — |

**D1–D6 llevan control por fase y no por tarea, a propósito:** ninguna está empezada, y descomponerlas
hoy sería inventarse el trabajo. **La descomposición es el primer paso de atacar cada una** y va en el
mismo commit que su arranque. D7 sí viene descompuesta porque sus tareas ya estaban medidas.

---

## §1 · La decisión de fondo: por qué NO una clase por tabla

Se evaluó y **se descarta**. Queda escrito aquí para que no vuelva a plantearse de cero, igual que la
pregunta arquitectónica en el plan maestro.

**El reparto de la base de datos, medido** (67 tablas, `backend/database/postgres_schema.sql`):

| Naturaleza | Tablas | % |
|---|---:|---:|
| Catálogo puro (`id + name + is_active`) | 12 | 18 % |
| Join / asociativa (solo FKs) | 10 | 15 % |
| **Entidad con comportamiento o estado** | **24** | **36 %** |
| Log append-only (ninguna tiene `updated_at`) | 9 | 13 % |
| Configuración / versionado | 9 | 13 % |
| Subtipo (`contract_origins` y sus dos hijas) | 3 | 4 % |

**Cinco razones, ninguna estética:**

1. **31 tablas de 67 (46 %) no tienen nada que encapsular.** Una clase para `unit_types`, `roles`,
   `actions`, `term_types`, `signature_statuses`… sería doce veces el mismo fichero. Eso no es
   diseño, es ceremonia con coste de mantenimiento.

2. **Ese CRUD ya está resuelto, y mejor.** `backend/config/sqlTables.js` describe **44 tablas** con
   metadatos y `SqlAdminService` las sirve por **cuatro rutas genéricas**
   (`routes/sql_admin_router.js:135-138`). El plan maestro marca su núcleo (~460 L) como *«el buen
   diseño que sostiene el registro de hooks»* y lo pone en la lista de **no tocar**. Sesenta y siete
   clases serían un segundo motor compitiendo con el primero por las mismas tablas.

3. **La unidad de trabajo real no es la tabla, es la transacción multi-tabla.** Lanzar un proceso
   toca `process_runs → tasks → task_items → task_assignments → documents → document_fill_flows`.
   Active Record modela filas; el problema aquí es la consistencia entre seis tablas bajo una
   transacción. Una clase por tabla da seis objetos que se coordinan mal — y el plan maestro ya midió
   que **de los puntos de `beginTransaction`, cero quedan dentro de un solo subdominio**.

4. **Parte del comportamiento vive en la base de datos.** Hay **5 triggers de negocio**
   (`postgres_schema.sql:1288, 1315, 1349, 1372, 1396`) que derivan roles al asignar un puesto,
   revocan al inactivar una persona y cancelan vacantes al inactivar una unidad. Clases con esa misma
   lógica crearían **dos fuentes de verdad para la misma invariante** — que es exactamente el fallo
   que la fase D2 va a cerrar en otro sitio.

5. **El molde uniforme no existe.** 5 tablas sin `id` sintético, 1 con PK compuesta
   (`chat_message_reads`), 3 en herencia *table-per-subtype*, **11 columnas generadas**, 6 columnas
   JSONB. La clase genérica se llenaría de excepciones por tabla: el olor exacto que hizo God a
   `AdminTableManager`, y contra el que avisa la regla 3 de `CLAUDE.md`.

**Lo que sí se sostiene** es un reparto en cuatro estratos, cada uno con su tratamiento:

| Estrato | Tablas | Patrón | Hoy |
|---|---:|---|---|
| Catálogos + joins | 31 | Table Data Gateway dirigido por metadatos | ✅ existe (`SqlAdminService`) |
| Entidades con estado | 24 | **Repository por agregado**, no por tabla | ⚠️ 2 repos, el resto suelto → **D4** |
| Máquinas de estado | 8 | Tabla de transiciones congelada | ✅ ejemplar en `DocumentStateService.js:30` |
| Transversal | — | **Unit of Work** | ❌ no existe → **D1** |

---

## Fase D7 · Auditoría funcional del modelo documental — ⬜

**Añadida el 2026-08-14**, y no salió de medir la capa de datos: salió de **archivar el frente 0**. Al
hacerlo se vio que ese frente había hecho el **inventario** del modelo —los cuatro nombres del
entregable (§0.5) y el censo de 18 fósiles (§0.6)— pero **nunca la validación funcional**: contrastar
lo que el modelo hace contra lo que el negocio dice que debe hacer. Son cosas distintas, y la segunda
no tenía dueño en ningún frente.

Peor: **tres hallazgos concretos se quedaron sin asignar**, y dos de ellos siguen vivos en la base hoy.
Estaban escritos —en el frente 0 y en [`referencia-esquema.md`](./referencia-esquema.md)— pero escrito
no es asignado, que es exactamente el modo de fallo que abrió el frente 0.

### Por qué vive aquí y no en un frente propio

Decisión del dueño, el 2026-08-14, y las razones aguantan:

- **El material de prueba ya está medido aquí.** `referencia-esquema.md` tiene el grafo de las 137 FKs,
  las 8 columnas de estado sin `CHECK` y los 10 agregados. Abrir un frente nuevo obligaría a citarlo
  desde fuera o —peor— a remedirlo.
- **D3 es su habilitador.** `TD7-d` es un cambio de tipo de columna, o sea **una migración**; y hoy el
  esquema no se puede alterar en un entorno con datos. En un frente aparte esa dependencia sería un
  enlace; aquí es la fase de al lado.
- **`TD7-e` y D2 comparten material**, y hay que decir en qué se diferencian o se pisarán: **D2 unifica
  el vocabulario de estados en JavaScript; `TD7-e` decide si además baja a la base como `CHECK`.**
  Primero D2, o se estaría cimentando en la base un vocabulario que aún tiene tres alfabetos.

⚠️ **Y el reparo que va con la decisión, para que no se pierda:** `TD7-a` y `TD7-b` **no son de capa de
datos**. Son reglas de negocio, se responden con una decisión del dueño y se implementan en
`services/` y en los guards, no en el esquema. Por eso **D7 va la primera** — si se lee como «trabajo
de esquema» y se pone en la cola detrás de seis fases de refactor, el efecto sigue vivo mientras tanto.

### `TD7-a` · Un vínculo puede apuntar a una edición RETIRADA

Medido en el §0.5 y sin decidir desde entonces: hoy **el vínculo 1 usa la v1.0.0 `retired`** mientras
la v1.1.0 está `published` en otro proceso — y de ese vínculo salen **los tres entregables del
sistema**. Las dos preguntas son: ¿debe permitirse? ¿y publicar una edición debería arrastrar los
vínculos que apuntan a la anterior?

*No confundir con lo que sí funciona bien*: el mismo entregable enlazado dos veces **con modos
distintos** (`routed` y `single`) es correcto, y confirma que `item_mode` es del vínculo, no de la
plantilla.

### `TD7-b` · La inmutabilidad de `published` descansa en un razonamiento

Es el único punto del diseño del §0.8 que se apoyaba en un razonamiento y no en una lectura, y quedó
escrito así. La invariante buscada —*una instancia en curso no cambia sus pasos bajo los pies*— se
sustituyó por la inmutabilidad de `published`, **pero eso exige que un `draft` no pueda tener
instancias**.

Medido el 2026-08-14: **`launch.js` no menciona `lifecycle_state` ni una vez** (cero ocurrencias). Lo
que sí se cerró en su momento (defectos 1.12 y 1.13) es la otra mitad: que un `draft` no llegue a estar
**dentro de una configuración activa**. Que `launch` lo mire, no.

**Entrega:** la decisión —¿`launch` rechaza un `draft`, o la invariante se sostiene por otro sitio?— y
**una prueba que la congele**, porque una invariante sin prueba se rompe en el siguiente refactor.

### `TD7-c` · Censo de columnas `*_id` sin FK

El retrato ya distingue **tres categorías**, y mezclarlas es lo que hace que este tema se lea como
alarmismo:

| Categoría | Ejemplos | Veredicto |
|---|---|---|
| **Decisión explícita** | `chat_*` y `dossiers`: `person_id`, `process_id`, `unit_id` | Correcto: no acoplar los módulos ex-documentales al núcleo relacional. Comentado en el esquema |
| **Ciclo evitado** | `chat_conversations.last_message_id` | Correcto, y comentado |
| **Descuido** | los dos de `TD7-d` | **No es decisión: es un tipo mal puesto** |

**Entrega:** el barrido completo, sacado **del esquema y no de la memoria**, con cada columna en una de
las tres. Lo que hoy hay es una muestra, no un censo.

### `TD7-d` · Dos columnas que no pueden llevar FK aunque se quiera

`signature_batch_jobs.user_id` y `task_item_tenures.performed_by_person_id` son **`BIGINT`** contra
`persons.id INT` (verificado el 2026-08-14 en `postgres_schema.sql`). No es que les falte la
restricción: **con ese tipo no se puede declarar**.

`task_item_handovers` es además la tabla del **defecto 1.10** —la bitácora de relevos—, así que las dos
cosas se tocan: no tiene sentido llenarla de filas sin arreglarle antes la columna que identifica a
quién hizo el relevo.

### `TD7-e` · Las ocho columnas de estado sin `CHECK`

Su dominio **solo existe en JavaScript**, y una (`signature_flow_steps.selection_mode`) tiene un gemelo
que **sí** lo lleva: la asimetría es el olor. **Va detrás de D2**, y la razón está arriba.

### `TD7-f` a `TD7-l` · El acceso al entregable

**Salieron de contestar «¿fusionamos `task_items` y `documents`?»**, el 2026-08-22, y son el grueso de
la fase. Al medirla se vio que la pregunta que el sistema resuelve está mal planteada: contesta *«¿de
quién es?»* cuando debería contestar *«¿quién tiene derecho a verlo?»*, y eso no es una persona sino
un conjunto que crece.

**Diseño completo, con las dos decisiones del dueño y los cuatro defectos que destapó:**
[`acceso-al-entregable.md`](./acceso-al-entregable.md). No se repite aquí.

Lo que conviene saber sin abrirlo:

- **El modelo ya está construido a medias, dos veces** —el guard del documento y el del chat— con
  conjuntos distintos. El trabajo es unificar, no inventar.
- **`P1` y `P2` valen aunque la fusión se aplace**: cierran una asimetría de permisos viva hoy.
- **`P6` (la fusión) va la última** y es el único paso que toca el frontend.

### Criterio de cierre

Las cinco tareas con su decisión escrita —**incluidas las que se decidan «se queda como está»**, con su
razón medida— y las dos correcciones aplicadas con prueba. **Una decisión sin razón escrita se vuelve a
proponer en tres meses**; ya pasó con `document_owner`.

### Lo que D7 NO es

- **No es rediseñar el modelo de entregables.** Eso está decidido y documentado en
  `docs/arquitecturas/modelo-emision-entregables.md`; D7 audita el cumplimiento, no el diseño.
- **No es el generador ni el compilador** (frentes 10 y 11).
- **No es el vocabulario de estados**, que es D2. Aquí solo se decide si baja a la base.

---

## Fase D1 · Un solo `withTransaction` — ⬜

**Qué pasa hoy.** Hay **32 `getConnection()`** y **20 `beginTransaction`** repartidos en **11
ficheros**, cada uno con su propio ciclo `begin / commit / rollback / release` escrito a mano:

```
config/postgres.js                              (el adaptador; no cuenta)
controllers/users/user_controler.js             ← 9 getConnection, 3 ciclos completos
services/admin/crud/tableHooks.js               ← el único que YA lo tiene resuelto
services/admin/templates/templateArtifact.js
services/admin/templates/templateLifecycle.js
services/admin/org/orgStructure.js
services/admin/generation/launch.js
services/documents/FillRequestWorkflowService.js
services/system/SystemBootstrapService.js
services/tasks/GeneralTaskService.js
services/sign/PdfSigningService.js
```

Cada copia es una fuga de conexión potencial: si un `throw` esquiva el `release()`, el pool
(`max = 10` por defecto, `config/postgres.js:35-44`) se agota y el backend deja de responder sin
error visible en el sitio que lo causó.

**Lo bueno: no hay que inventarlo.** `services/admin/crud/tableHooks.js:65-92` ya tiene
`runInTransaction(pool, ctx, {before, after}, execute)` con la forma correcta —`try / catch rollback /
finally release`—, pero **solo lo usa el CRUD admin**.

**Qué hacer.**

1. Promover el helper a `backend/services/kernel/` (o `config/postgres.js`) como
   `withTransaction(pool, fn)`, con la firma mínima: recibe una función, le pasa la `connection`,
   confirma si vuelve y deshace si lanza. Los hooks `before`/`after` de `tableHooks` se construyen
   **encima**, no dentro: son de su dominio.
2. Test unitario del helper primero, **antes de migrar nada**: confirma al volver, deshace al lanzar,
   libera **siempre** (incluido el caso de `rollback()` que a su vez falla, que hoy no está cubierto).
3. Migrar por lotes, empezando por los servicios cuyo ciclo ya es correcto — ahí es **refactor puro y
   los goldens no se mueven**. Los tres ciclos de `controllers/users/user_controler.js`
   (`:474-489`, `:593-618`, `:864-884`) van **al final**, porque además hay que sacar el SQL de ahí
   (fase D4) y conviene hacer un solo viaje.

**El aviso que ya costó una vez.** Mover la transacción **cambia dónde caen los errores**. Está
documentado en `../referencia/calidad-y-medicion.md` §5-D y el patrón a respetar es
`error.statusCode ?? 400/500`. Ojo especialmente con `GeneralTaskService.js:576-582`, que fija un
**500 explícito para el fallo al *adquirir* la conexión** y razona por qué en `:570-574`: eso no es
un descuido, es contrato, y el helper tiene que preservarlo.

**Criterio de cierre.** Cero `beginTransaction` fuera del helper (`grep` en `backend/`, excluyendo
`config/postgres.js` que es el adaptador). Los 256 goldens **idénticos**. Test unitario del helper
verde, incluido el caso de doble fallo.

---

## Fase D2 · Un vocabulario de estados, no cinco — ⬜

> ⚠️ **REMEDIDA EL 2026-08-23, y ha encogido mucho.** Lo que sigue describe el estado del
> **2026-08-09** y ya no es cierto: `task_items.status` **se retiró** (tenía cero escritores) y con
> ella los dos vocabularios en conflicto. Lo medido hoy:
>
> | Entonces | Ahora |
> |---|---|
> | 5 sitios, **3 vocabularios** que no comparten un literal | **1 vocabulario** (`tasks.status`) repetido en **3 sitios** |
> | «un entregable completado puede cambiar de dueño» | **cerrado**: el relevo ya no mira ese estado, mira `document_status` y tiene guard explícito del cierre |
> | 8 columnas de estado sin `CHECK` | **4** |
>
> Los tres sitios que quedan son `config/sqlTables.js:266`, `services/admin/SqlAdminService.js:212` y
> `controllers/users/user_controler.panel.js:427`, los tres con
> `pendiente · en_proceso · completada · cancelada` — **el mismo vocabulario**, no tres. Lo que falta
> ya no es unificar alfabetos: es **bajar ese dominio a la base** con su `CHECK`, que es exactamente
> lo que pide `TD7-e`. Las dos tareas se han convertido en una.
>
> **Lo peligroso de esta fase ya está cerrado.** Lo que queda es higiene.

**El defecto, verificado el 2026-08-09** (y superado; ver el aviso de arriba)**.** El conjunto de estados terminales de `task_items` está
escrito en **cinco sitios con tres vocabularios que no coinciden**:

| Dónde | Vocabulario |
|---|---|
| `config/sqlTables.js:313` (y `:269`, `:334` para `tasks` y `task_assignments`) | `pendiente · en_proceso · completada · cancelada` |
| `controllers/users/user_controler.panel.js:380, 415, 416` | `completada · cancelada` |
| `services/admin/org/taskAssignment.js:216, 239, 265, 386` | `completed · completado · cancelled · cancelado · finalizado · entregado · rechazado` |
| `database/postgres_schema.sql:1307, 1334, 1341` (dentro de los triggers) | los mismos 7 literales |
| `SqlAdminService.js:214` (sobre `tasks`) | `completada · cancelada` |

**Los dos grupos no comparten ni un literal.** El primero es femenino singular; el segundo es
masculino más variantes en inglés. Consecuencia concreta y comprobable: el panel de usuario cuenta un
entregable `completada` como **cerrado**, mientras el motor de relevos —el trigger
`trg_position_assignments_after_update_fn` y `taskAssignment.js`— lo considera **abierto** y lo
reasigna al cambiar la ocupación de un puesto. Un entregable ya completado puede cambiar de dueño.

Y no es un caso aislado: la base **no tiene ni un `CREATE TYPE`**. Los 33 dominios cerrados son
`TEXT ... CHECK (col IN (...))`, con al menos un par duplicado literalmente
(`fill_flow_steps.resolver_type`:843 y `signature_flow_steps.resolver_type`:940) y una asimetría
—`fill_flow_steps.selection_mode`:851 tiene `CHECK`, su gemelo `signature_flow_steps`:947 **no**—.
Ocho columnas de estado no tienen `CHECK` en absoluto: su dominio solo existe en JavaScript.

**Qué hacer.**

1. **Decidir el vocabulario verdadero de `task_items` mirando los datos**, no el código: qué valores
   hay realmente en la base de dev y en cualquier entorno con datos. Es un **fix**, así que aquí el
   **diff del golden es la prueba** — a diferencia de D1.
2. Un módulo único de vocabulario (extender `services/documents/DocumentWorkflowCatalog.js`, que ya
   hace justo eso para firmas y llenado, en vez de crear un tercer sitio). `Object.freeze`, como los
   de `DocumentStateService.js:1-27`.
3. `sqlTables.js` consume del módulo en lugar de repetir literales. **Esto no viola §7**: §7 protege
   el fichero como *datos* y protege su duplicación con el gemelo del frontend; sustituir un literal
   por la constante que lo define no cambia el dato, elimina la tercera copia.
4. Los `CHECK` del esquema y las consultas de `taskAssignment.js` alinean con el módulo.
5. **Detector de *drift*** — un test unitario que compare `sqlTables.js` contra `information_schema`
   y contra los `CHECK` del esquema, y falle si divergen: columna que existe en la base y no en los
   metadatos, tipo que no cuadra, `options` que no coincide con el `CHECK`. Es barato y captura
   exactamente el fallo de arriba antes de que llegue a producción. **No** genera `sqlTables.js`: las
   etiquetas en español, las categorías y los `readOnly` no están en `information_schema` y son
   trabajo humano legítimo.

**Criterio de cierre.** Un solo sitio define cada dominio de estado. El test de *drift* en verde y
dentro de los globs de `test:unit` **y** `test:unit:coverage` (los dos, ver `CLAUDE.md`). Goldens
movidos **solo** donde el fix cambia comportamiento, con el diff citado.

---

## Fase D3 · Migraciones versionadas — ⬜

**Qué pasa hoy.** `backend/database/postgres_initializer.js:23-40` lee
`database/postgres_schema.sql` **entero** (1 398 líneas, 67 tablas) y lo ejecuta como **un único
string multi-statement** en cada arranque. Funciona porque todo es `CREATE ... IF NOT EXISTS`,
`CREATE OR REPLACE` y seeds con `ON CONFLICT`.

**El problema no es crear, es alterar.** Ese mecanismo es idempotente para *crear* y **estructuralmente
incapaz de *modificar***: añadir una columna, cambiar un tipo, renombrar o soltar un `CHECK` en un
entorno que ya tiene datos exige entrar a mano con `psql`. No hay dependencia de migración en
`package.json` (`pg` es la única de datos), ni número de versión de esquema, ni forma de saber qué
versión corre en qa o en prod. Y `qa` y `prod` **ya despliegan imágenes publicadas**
(`.github/workflows/cd-multienv.yml`).

Esto es, con diferencia, **el mayor riesgo operativo de la capa de datos**, y es el único punto de
este plan que puede provocar una pérdida de datos.

**Qué hacer.**

1. Adoptar `node-pg-migrate` (SQL plano, sin ORM detrás, encaja con el repo) o `umzug`.
2. El `postgres_schema.sql` actual pasa a ser la **migración base `0001`**, sin reescribirlo: se
   marca como aplicada en los entornos que ya existen (*baseline*), no se vuelve a ejecutar.
3. Toda alteración posterior es una migración numerada con su `down`. `postgres_initializer.js` pasa
   a aplicar las pendientes en vez de reejecutar el fichero entero.
4. `scripts/docker-env.sh` gana el comando de migrar, junto a los de reset y bootstrap.

**El aviso de `CLAUDE.md` aplica de lleno aquí:** *«el SQL no lo valida NADIE hasta que se ejecuta
esa rama»*. Cada migración se prueba con `PREPARE` en `psql` **antes** de darla por buena, y se
verifica que el `down` deja la base como estaba.

**Criterio de cierre.** Cambiar una columna en dev, desplegar a qa y ver el cambio aplicado **sin
tocar `psql` a mano**. Y `test:char:run` —que resetea y hace bootstrap— sigue pasando sobre el camino
de migraciones.

---

## Fase D4 · Repositorios **por agregado**, y fuera el SQL de `controllers/` — ⬜

**Qué pasa hoy.** Hay **531 llamadas** a `.query()`/`.execute()` en **46 ficheros**. La mayoría está
donde debe (37 en `services/`), pero **5 controllers escriben SQL**:

| Fichero | Sentencias SQL |
|---|---:|
| `controllers/users/user_controler.queries.js` | **33** |
| `controllers/users/user_controler.js` | 14 |
| `controllers/admin/sql_admin_controller.js` | 3 |
| `controllers/tareas/tareas_controler.js` | 2 |
| `controllers/empresa/program_controler.js` | 1 |

`user_controler.queries.js` son **1 091 líneas, 22 exports, 0 imports de servicios**: es una capa de
acceso a datos alojada en `controllers/`. **Su propia cabecera lo admite y nombra el destino**
(`:6-8`): *«candidato natural a promoverse a `services/users/UserWorkspaceRepository.js` cuando se
corrija la fuga de capa»*. Esto viola directamente la regla no negociable de `CLAUDE.md`
(«los controllers son transporte, no lógica»).

**La forma correcta: por agregado, no por tabla.** Diez repositorios, no sesenta y siete. Y la
frontera **no hay que inventarla**: ya está dibujada en el esquema por los `ON DELETE CASCADE`. La
propuesta completa, con sus tablas, está en
[`referencia-esquema.md` §4](./referencia-esquema.md#4-los-agregados-que-la-base-ya-dibuja).

**Qué hacer.**

1. Empezar por `user_controler.queries.js` → `services/users/UserWorkspaceRepository.js`. Es
   **movimiento puro**: el fichero no importa servicios, así que no hay ciclo que romper. Aplican las
   reglas de mover código de `CLAUDE.md` — extracción por script, `count == 1` antes de borrar, y
   **`npm run check:imports` obligatorio**, porque un símbolo movido sin su `import` carga bien y
   revienta en la llamada.
2. Los 14 SQL de `user_controler.js` van al mismo repositorio, junto con sus tres transacciones
   (coordinado con D1).
3. `sql_admin_controller.js` deja de importar `getPostgresPool` (`:7`): ya tiene `SqlAdminService`
   delante, esas tres consultas no tienen por qué esquivarlo.
4. `tareas_controler.js` y `program_controler.js` son una y dos sentencias: van con los servicios que
   ya existen para su dominio.
5. Los repositorios nuevos siguen la forma de los dos que ya hay
   (`services/auth/UserRepository.js:6`): clase, `constructor(pool = getPostgresPool())`, SQL
   encapsulado. Y **arreglan de paso** lo que aquellos hacen mal: `UserRepository.update()` (`:294`)
   monta `SET ${key} = ?` **con las claves sin lista blanca** — la allowlist solo existe en
   `updateMe` (`:321`).

**Lo que esta fase NO hace.** No toca el motor genérico de `SqlAdminService` (§7). No convierte
`chatStore.js` ni `dossierStore.js` en clases: ya son repositorios de facto, funcionan, y renombrarlos
son cero puntos de complejidad.

**Criterio de cierre.** Cero `.query(` en `backend/controllers/`. `check:imports` en verde. Goldens
idénticos —es refactor, no fix—.

---

## Fase D5 · Matar el traductor de dialecto — ⬜

**Qué pasa hoy.** `backend/config/postgres.js` no es una capa de acceso a datos: es un **shim que
emula la API de `mysql2/promise` sobre `pg`**, y su propia cabecera lo dice (`:1-20`). Existe para no
haber tenido que reescribir los call sites durante la migración.

Lo que cuesta, medido (`../referencia/calidad-y-medicion.md` §3.1 y §3.2):

- **391 ncloc con 241 de complejidad cognitiva → 0,62 por línea: el fichero más denso del
  repositorio**, por encima de `signer/app.py` en densidad.
- `bindParams` (**CC 59**) y `translateDialect` (**CC 49**) están entre las **cinco peores funciones
  vivas** del backend.
- Y **ya se pagó tres veces**: los defectos 1.5, 1.6 y 1.11 del plan maestro son los tres de esta
  capa. Dos cerrados, uno abierto a propósito.

**El plan se parte en dos, y solo la primera mitad está aprobada.**

### D5-a · Borrar los reescritores de dialecto, uno a uno — ⬜

Cada construcción MySQL viva tiene su reescritor: `rewriteGroupConcat` (`:170`), `rewriteIf` (`:208`),
`rewriteField` (`:239`), `rewriteDateParts` (`:272`), `applyOnConflict` (`:397`). El trabajo es
mecánico y **medible solo**:

1. Censar los call sites de cada construcción (`GROUP_CONCAT`, `IF()`, `FIELD()`, `DATE_FORMAT`,
   `CURDATE`, `NOW`, `ON DUPLICATE KEY`, `INSERT IGNORE`, `FROM DUAL`).
2. Reescribirlos a PostgreSQL nativo por lotes, **probando cada uno con `PREPARE` en `psql`** antes
   de tocar nada — el aviso de `CLAUDE.md` sobre los cuatro `UPDATE ... JOIN` que sobrevivieron meses
   vale aquí literalmente.
3. Cuando el contador de una construcción llega a **0**, se borra su reescritor. Cada borrado es
   complejidad que baja y no vuelve.

Los goldens **no se mueven**: es traducción, no cambio de comportamiento. Los 578 L de
`postgres.test.js` + `postgres.dialect.test.js` son la red, y van adelgazando con el fichero.

Foco especial en `services/system/genericCatalog.js`: sus 28 sentencias usan `FROM DUAL`,
`INSERT IGNORE`, `CURDATE()` y `NOW()` y **solo funcionan gracias al traductor** — es el bloque más
concentrado.

### D5-b · Placeholders `?` → `$n` — ⛔ **decisión pendiente, no empezar**

`bindParams` existe porque **484 llamadas** usan `?` estilo mysql2 (contadas por
`npm run check:params` el 2026-08-14; el «~493» de antes venía del barrido perdido del defecto 1.5).
Eliminarlo obliga a tocarlas todas. Hay dos caminos y **ninguno se elige aquí**:

> ⚠️ **Aquí ponía «`bindParams` (CC 59)» y esa cifra está muerta.** La **Fase F la dejó en ~1**
> (`../referencia/calidad-y-medicion.md:475`), y `translatePlaceholders` está borrada. Importa porque
> era el argumento de peso para D5-b: **el manejo de parámetros ya no es lo que hace denso a este
> fichero**. Los 241 de complejidad se reparten hoy sobre los reescritores de dialecto — o sea, sobre
> **D5-a**. Al reabrir D5-b, remídelo antes de justificarlo.

- **A mano / por script**: 484 sitios y radio de impacto enorme. Aquí había un segundo motivo —que el
  defecto **1.11** avisaba de call sites que «reutilizan a propósito un array más largo que la
  consulta»— y **ese motivo ya no existe: era falso**. Medido el 2026-08-14 sobre el árbol entero:
  **cero** de las 423 llamadas decidibles pasa parámetros de más, y el patrón invocado no aparece ni
  una vez. **Este cerrojo de D5-b queda retirado**; sigue puesto el otro (D5-a cerrada primero).
- **Con un query builder** (Knex o Kysely): resuelve `$n`, paginación y el `ON CONFLICT` de una vez, y
  Knex trae migraciones —solaparía con D3, que entonces habría que decidir antes—. Pero **sin
  TypeScript, Kysely pierde su ventaja principal**, que es el tipado; y añadir una dependencia que
  toca 531 call sites es exactamente el tipo de decisión que el plan maestro exige justificar con
  medición, no con doctrina.

**No se ataca D5-b hasta que D5-a esté cerrada** y se pueda medir cuánta complejidad queda de verdad
en el fichero. Puede que después no compense.

**Criterio de cierre de D5-a.** Los cinco reescritores borrados, `translateDialect` reducida a lo que
quede, y la caída de complejidad de `postgres.js` medida contra la línea base de Sonar. Goldens
idénticos.

---

## Fase D6 · Validación por esquema en el borde de entrada — ⬜

**Qué pasa hoy.** Cero dependencias de validación (`zod|joi|ajv|yup` → 0 resultados). La validación
vive en **tres capas artesanales e independientes**:

1. `validateFieldTypes(config, payload)` — `SqlAdminService.js:123-147`, imperativa por `field.type`.
2. `validateTableRules(tableName, candidate)` — `services/admin/crud/validation.js:305`, con
   `TABLE_RULES` para **24 tablas** (`:208-302`).
3. El `required` derivado de los metadatos — `SqlAdminService.js:646-651`.

Ninguna es mala en sí —`validateTableRules` es de hecho el caso de éxito citado en
`patrones-diseno.md` (CC 99 → 0)—, pero **están desconectadas**, cada endpoint nuevo elige mal la
mitad de las veces cuál usar, y **las rutas fuera del CRUD admin no tienen ninguna**.

**Qué hacer.** Un esquema declarativo por endpoint en el borde, que valide **antes** de llegar al
servicio. Las tres capas actuales siguen donde están: `TABLE_RULES` son reglas de negocio, no de
forma, y no se tocan.

**Lo que esta fase NO hace, y conviene que quede escrito.** **No normaliza la salida.** Hoy la API
expone `snake_case` y nombres físicos de columna, y hay tres mappers con tres convenciones distintas
(`UserRepository.toPublicUser`:205 mezcla `snake` y `camel` y arrastra un `_id` string heredado de
Mongo; `UserCertificateRepository.toPublic`:86 es `snake` puro; `BatchSigningService.rowToBatchJob`:83
es `camel` puro). Es feo, **y arreglarlo movería los 256 goldens y rompería el frontend a la vez**.
Es deuda **decidida, no olvidada**: si algún día se ataca, es con su propio plan y su propia red, no
de rebote.

**Criterio de cierre.** Los endpoints de escritura fuera del CRUD admin validan su entrada por
esquema. Los goldens de error se mueven —el código pasa a 400 con mensaje de forma— y **ese diff es
la prueba**; el contrato objetivo es el de
[`../referencia/contrato-errores-api.md`](../referencia/contrato-errores-api.md).

---

## Lo que este plan NO va a hacer

Igual que §7 del maestro, esto vale tanto como las fases:

- **Una clase por tabla.** Descartado en §1 con cinco razones medidas.
- **Un ORM** (Sequelize, TypeORM, Prisma, Objection). Ninguno de los seis problemas de arriba es «nos
  falta un ORM»; cuatro son *falta de un único sitio* y dos son deuda de migración. Un ORM añade una
  capa que hay que aprender, no quita ninguna.
- **Tocar el núcleo CRUD de `SqlAdminService`** (~460 L). Está en la lista de no tocar del maestro y
  este plan lo respeta: D2 y D4 trabajan **alrededor**, nunca dentro.
- **State para `fill_requests`.** `patrones-diseno.md` §4 ya lo descartó con cifras: su tabla
  `ALLOWED_STATUSES_BY_ACTION` (`FillRequestWorkflowService.js:140-146`) **es** la cura, y cinco
  clases de estado no bajarían ni un punto.
- **Normalizar `snake_case` → `camelCase` en la salida.** Ver D6.
- **Partir la base de datos.** El plan maestro lo cerró: el 45 % de las FKs cruza cualquier frontera
  que se dibuje, y `persons` sola recibe **26 FKs entrantes**.

---

## Riesgo y red

La red de este plan es la que ya existe: **256 goldens en 15 flujos** de caracterización y **350
casos unitarios**. Con una advertencia que sale de `../referencia/cobertura.md`: la cobertura global
es del **14 %**, y **`SqlAdminService.js`, `tableHooks.js` y `templateLifecycle.js` no tienen test
unitario propio** —su única red son los goldens—. Es decir: en D4 y D5, si un golden no se mueve, no
significa que esté bien; significa que ese camino está caracterizado. Los que no lo están hay que
ejercitarlos a mano.

Y la regla que engloba todo, de `CLAUDE.md`: **refactor = mover código, NO reescribir comportamiento**.
D1, D4 y D5-a son refactor y sus goldens no se mueven. D2 y D6 son fixes y **el diff del golden es la
prueba**. D3 no es ninguna de las dos: es infraestructura, y su prueba es un despliegue.
