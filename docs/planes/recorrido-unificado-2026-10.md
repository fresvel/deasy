# Frente 24 · El recorrido documental, unificado — y el fin de cuatro «plantillas»

> **Estado**: ✅ **CERRADO · 11 de 11 tareas en 6 fases** · abierto el **2026-10-08**, cerrado el
> **2026-10-09** · worktree `deasy-recorrido`, pila **B**
> **Decidido por el dueño** el 2026-10-08 tras el análisis de la decisión 1 de F7.0 (frente 22).

## 0 · Control de ejecución

| # | Fase | Qué entrega | Evidencia | Estado |
|---|---|---|---|:--:|
| **1** | Los tres renombrados | de `deliverables`, `template_artifacts` y `process_definition_templates` a `catalogo_documental`, `ediciones` y `vinculos` | **167 ficheros · 1.664 ocurrencias**; 7 puertas + `test:unit` 897/897 + `test:char:run` 321/321; goldens movidos y **probado que el diff es SÓLO el renombrado**; migración `scripts/migrar-recorrido.sql` aplicada y verificada | ✅ |
| **2** | Muere el escalón 2 | fuera `vinculo_id` de las dos cabeceras **y su `CHECK` de un solo portador**, fuera su campo en `/admin`, fuera el escalón de los dos resolvedores | el resolvedor baja de 3 escalones a 2 (**2 consultas, no 3**, afirmado por unitario); 5 puertas + `test:unit` **899/899** + `test:char:run` **320/320**; migración probada en sus **tres** rutas (mueve 1 cabecera, para con mensaje y **deshace el `DROP COLUMN`**, idempotente); goldens movidos en 5 ficheros y **revisado uno a uno**; `check-mapa-tablas` 100/77/0, `check-doc-modelo` y `check-enlaces-internos` en verde | ✅ |
| **3** | El vocabulario de estado | **un** mecanismo y **un** idioma para los 6 estados; muertas `signature_request_statuses` y las dos `status_id`; un mapa de tonos en vez de dos y un predicado en vez de dos | 5 puertas + `test:unit` **899/899** + `test:char:run` **320/320** + frontend lint y **498** vitest; el diff del golden es **sólo** vocabulario (60 líneas, cada valor retirado con su equivalente y los recuentos cuadrando) más 11 claves renombradas; migración probada en sus tres rutas; de 92 tablas a **91** y de 100 a **98** claves ajenas | ✅ |
| **3-bis** | El atasco del rechazo en firma | el rechazo sin firmas dadas devuelve el documento a «Observado»; al volver, el recorrido rechazado **se reabre** en vez de ignorarse; y el rechazo manda sobre el estado de la instancia | 5 puertas + `test:unit` **904/904** (5 unitarios nuevos: la transición en las dos matrices, el camino de vuelta, y las dos ramas del reabrir) + `test:char:run` 320/320 **sin mover un golden** — y eso ES el hallazgo: ningún flow rechaza una firma (§11) | ✅ |
| **4** | E1 · la unificación | **8 tablas → 4** (§3 y §10): **1 · esquema ✅** · **2 · receta ✅** · **3a · ENTREGA ✅** · **3b · FIRMA ✅** · **4 · lo que cuelga ✅** · **4-bis · los NOMBRES ✅** | paso 3b: la firma entera sobre `recorridos`/`turnos`, el **defecto 1.19 cerrado** (el JSONB `signers` a filas bajo `CHECK`, y con él 2 resolutores, 4 ámbitos y el cupo), el servicio de **1.338 a 856 líneas**, `flujoDeFirma.js` disuelto, 2 claves ajenas que dejan de cruzar (`tareas` 31→29 relaciones hacia fuera) y **2 flujos** que dejan de cruzar dominios (§15); 5 puertas + `test:unit` **919/919** —los mismos que antes, y es casualidad aritmética: el fichero de firma baja de 15 casos a 10 (seis escalones y seis ámbitos se fueron **con su sujeto**) y `assignees` sube de 8 a 13— + `test:char:run` 320/320 + frontend lint y 498; golden de 41 líneas fuera y 8 dentro, revisado línea a línea; y `verificar_firma_nueva.mjs` para los dos ejes, que char no cubre. Paso 4: de **95 tablas a 87** y de **185 claves ajenas a 158**; `flowRows.js` de 662 líneas a 224 y el escritor de runtime de 132 a 60; seis fósiles encontrados sin buscarlos —dos pestañas de `/admin` que pedían tablas inexistentes entre ellos—; 5 puertas + `test:unit` **896/896** + `test:char:run` **320/320** + frontend lint, build y **495** vitest; golden auditado (+417/−497) y 17 menciones históricas declaradas con su motivo (§16). Paso 4-bis: **147 ocurrencias** de los seis identificadores de id, las claves del panel y del snapshot, 2 columnas de observación **colapsadas en una** (158→**157** claves ajenas) y 9 mensajes de cara al usuario; **una regresión mía encontrada por el golden** —`canCurrentUserResetWorkflow` leía las claves viejas y devolvía `false` en silencio, con sus unitarios en verde— y **dos roturas del contrato #1** que el grep de verificación destapó antes de llegar a char (§17); 5 puertas + `test:unit` **894/894** + `test:char:run` **320/320** + frontend lint, build y **495** vitest + `verificar_firma_nueva.mjs`; golden revisado línea a línea y **probado que no queda un solo valor cambiado** | ✅ |
| **5** | La documentación publicada | DBML + 8 diagramas + `campos-*` regenerados, y **13 páginas de prosa** barridas una a una | `check-doc-modelo` (87 tablas, las 2 cambiadas revisadas y re-grabadas), `check-enlaces-internos` (0 roto sobre 54 páginas), `check-mapa-tablas` (86/71/0) y `gen-dbml --check` en verde; build del sitio **55 páginas**; **dos cifras caducadas corregidas** —el reparto por niveles decía 102/77 y es 86/71— y **tres excepciones estrechadas** por el propio `--update` | ✅ |

## 1 · Por qué, en una frase

Cuatro tablas se llamaban «plantilla», el recorrido documental estaba **partido en dos mitades
simétricas** con dos tablas idénticas de cabecera que no llevaban datos, y la resolución de cuál
recorrido aplica se hacía con **tres escalones, tres guardas `IS NULL` y un `ORDER BY id DESC`**
porque no había ninguna unicidad declarada.

## 2 · Los nombres

| Antes | Ahora | Qué es |
|---|---|---|
| `deliverables` | **`catalogo_documental`** | qué documento es: código, nombre, official/ad_hoc |
| `template_artifacts` | **`ediciones`** | el fichero con su versión y su estado de publicación |
| `process_definition_templates` | **`vinculos`** | una edición usada en una configuración de proceso, con su `item_mode` |
| `fill_flow_templates` · `signature_flow_templates` | **se eliminan** | cabeceras sin datos |
| `fill_flow_steps` · `signature_flow_steps` | **`pasos_declarados`** | la receta: quién pasa, en qué orden, por qué lado |
| `document_fill_flows` · `signature_flow_instances` | **`recorridos`** | el recorrido en marcha sobre una versión documental |
| `fill_requests` · `signature_requests` | **`turnos`** | a quién le toca ahora |
| `signature_request_statuses` | **se elimina** | el vocabulario pasa a un `CHECK` |

⚠️ **`documentos_tipo` se descartó** porque `tipo` ya significa la clase de un documento de identidad
(`documentos_identidad.tipo`, con su `CHECK`). Y **`formatos` se descartó** para la edición porque
`available_formats` ya usa «formato» con el sentido de pdf/docx.

⚠️ **Por qué `pasos_declarados` y no `pasos_de_recorrido`:** porque contrasta con `turnos`. Lo
declarado es la receta; el turno es lo que de verdad le tocó a alguien. Y evita que dos tablas de la
cadena lleven la palabra «recorrido».

## 3 · E1 · Un solo recorrido con dos acciones

Diseñado con el dueño el **2026-10-08**, campo a campo. Lo que sigue es la forma acordada; las
decisiones y su porqué están en §10.

```
plantillas ─────────────────────────────────────────────────────────
  catalogo_documental ──▶ ediciones ──▶ vinculos (item_mode)
                              │             │
                              │             │  item_mode decide DE DÓNDE sale la receta:
                              │             │    single / replicated ──▶ origen = EDICIÓN
                              │             │    routed              ──▶ origen = ENTREGABLE
                              ▼             ▼
  pasos_declarados            «qué paso es»
    accion            entrega | firma                       CHECK
    edicion_id / task_item_id                               CHECK: num_nonnulls = 1
    orden · code · nombre
    UNIQUE (edicion_id,   accion, orden)  WHERE edicion_id   IS NOT NULL
    UNIQUE (task_item_id, accion, orden)  WHERE task_item_id IS NOT NULL
         │
         │ 1..N      ← el JSONB `signers`, a filas
         ▼
  participantes_declarados    «a quién se le pide»
    paso_id · orden
    resolver_type     task_assignee | cargo_in_scope | specific_person   CHECK
    persona_id · cargo_id
    unit_scope_type   unit_exact | context_exact | all_units             CHECK
    unit_id
    slot              (sólo firma) — un hueco por FIRMANTE, no por paso

tareas ─────────────────────────────────────────────────────────────
  recorridos                  «la ronda en marcha»
    document_version_id · accion · estado · paso_actual
    UNIQUE (document_version_id, accion)
         │
         ▼
  turnos                      «a quién le tocó»
    recorrido_id · participante_id · persona_id · accion
    estado · manual · solicitado · notificado · respondido · nota

firmas ─────────────────────────────────────────────────────────────
  document_signatures · signature_statuses · signature_batch_jobs
```

De **8 tablas y 82 columnas** a **4 y del orden de 35**.

**`routed` no se toca**: es `origen = entregable`. Lo único que desaparece es que tenga que escribir
**dos** anclas a la vez, que es lo que obligaba a las guardas `IS NULL`.

### Dos claves ajenas compuestas, y por qué

Al unificar, dos reglas que antes cabían en una tabla pasan a cruzar dos. Las dos se resuelven igual:
llevando la columna discriminante también en la tabla hija y atándola con una **clave ajena
compuesta**, de modo que PostgreSQL garantice que no se desincronicen.

| Regla | Por qué cruza | Cómo se cierra |
|---|---|---|
| `devuelto` sólo es legal en entrega | el `CHECK` está en `turnos` y la `accion` vive en `recorridos` | `turnos.accion` + FK a `recorridos(id, accion)` |
| un `slot` no se repite dentro del mismo documento | el `slot` está en el participante y el origen en el paso | el origen también en el participante + FK compuesta al paso |

## 4 · Lo que esto cierra, medido antes de tocar nada

| Hallazgo | Medida |
|---|---|
| El escalón 2 (del vínculo) está **muerto** | nadie lo escribe; su productor (`meta.yaml` + `WorkflowSyncService`) se borró en el §0.8; y la puerta de publicación lo **excluye** con `vinculo_id IS NULL` |
| La cabecera **no es una entidad** | su `name` no se lee en ninguna consulta del backend, y en `routed` es el literal fijo `'Entrega (definida al enviar)'` |
| No hay unicidad | **cero** índices únicos en las tres anclas; el código compensa con `ORDER BY id DESC LIMIT 1` |
| Los dos lados son **el mismo mecanismo** | `flowRows.js` ya los resuelve con **una** función y un mapa `HEADER_TABLES[side]` |
| Y el código lo demuestra dos veces | los dos resolvedores de escalones son **44 líneas idénticas de 50**, en ficheros de dominios distintos |
| Sentencias gemelas | de las 96 (48 por lado), **10 son byte a byte la misma** normalizando el lado |

## 5 · Las decisiones que tomo yo, y por qué

**5.1 · El estado va en `CHECK`, no en tabla de catálogo.** La asimetría medida es que entrega usa
`status TEXT` con `CHECK` y firma un `status_id` contra `signature_request_statuses`. Se unifica en
`CHECK` **porque el repositorio ya tomó esa decisión y escribió el motivo** —en
`DocumentoIdentidadService`: *«Antes esto era una CONSULTA: el tipo vivía en una tabla y había que
resolver el código contra ella. Con el vocabulario cerrado en un CHECK, validar es comparar contra
tres cadenas — sin red, sin base y sin poder equivocarse de catálogo»*—, y porque `item_mode`,
`lifecycle_state`, `template_scope`, `resolver_type` y `unit_scope_type` ya son `CHECK`.

⚠️ **`signature_statuses` NO se toca**: es el estado del **hecho** de firmar
(`document_signatures.signature_status_id`), no el de la solicitud. Es otra cosa.

**5.2 · El vocabulario queda en ESPAÑOL**, igual que los nombres de tabla que se acaban de decidir:
`pendiente`, `en_progreso`, `completado`, `rechazado`, `devuelto`, `cancelado`. Entrega usaba inglés
(`pending`…) y firma español; con dos idiomas en una columna no se puede. `devuelto` sólo es legal en
el lado de entrega, y eso se declara con un `CHECK` por lado.

⚠️ **Esto mueve goldens, y es correcto que los mueva**: no es un refactor, es un cambio de modelo, y
el diff del golden **es** la prueba del cambio. Es la única fase de este frente donde eso vale.

**5.3 · Las columnas propias de un lado se quedan como columnas, acotadas por `CHECK`** — no van a
JSONB. Se evaluó el modelo del dosier (base común + `data` JSONB) y se descartó midiendo: de las
columnas del paso, **24 aparecen en JOIN** —`unit_id`, `position_id`, `cargo_id`,
`assigned_person_id`…— y **seis tienen `CHECK`**. Y el único campo del paso que ya es JSONB,
`signature_flow_steps.signers`, es **el defecto 1.19**: nadie lo valida y manda sobre la columna
`resolver_type` que sí tiene `CHECK`. El dosier puede permitírselo porque su `data` **nunca se
consulta por dentro** —cero `data->`, cero índices— y aquí el contenido decide **quién firma**.

## 6 · Lo que NO hace este frente

- **No toca `signature_batch_jobs`** ni el firmado por lotes: es otro asunto.
- **No decide dónde vive el código** del recorrido. Eso es F7.5 del frente 22, y este frente le
  quita de encima la decisión 1 de F7.0: con un solo recorrido, la pregunta «¿de qué dominio es la
  mitad de entrega?» desaparece.
- **No arregla el defecto 1.19** (`signers` en JSONB). Lo deja nombrado como prerrequisito de
  cualquier movimiento futuro hacia JSONB.


## 7 · Lo que la fase 1 enseñó

**1 · `\bnombre` dentro de un REGEX LITERAL derrota a un renombrado con `\bnombre\b`.** El carácter
anterior a `nombre` es la letra `b` del `\b`, que es carácter de palabra: no hay límite y el patrón no
casa. Sobrevivieron así dos matchers de test (`/\bprocess_definition_template_id = \?/`) y tiraron **10
pruebas**. Se encuentran con `grep -rE '\\b(nombre)'`.

**2 · El mismo `_` esconde los nombres de índices, restricciones y claves de golden.**
`uq_deliverables_code`, `list_template_artifacts`: el `_` anterior tampoco deja límite de palabra. Los
**13 identificadores** del esquema y las **2 claves de golden** hubo que renombrarlos a mano.

**3 · El golden se recaptura DESPUÉS de probar que el diff es sólo el renombrado**, no antes. Se probó
aplicando el mapa de nombres a las **90 líneas borradas** y comprobando que el multiconjunto coincide
con las **90 añadidas**: el residuo fueron exactamente los 4 nombres de tabla. Sin esa prueba, un
recapture esconde cualquier otro cambio que se hubiera colado.

**4 · Y el script de renombrado SE COMIÓ EL PLAN que documenta el renombrado.** La tabla «Antes →
Ahora» de la sección 2 quedó diciendo `catalogo_documental` → `catalogo_documental`. Si renombras en
`docs/planes/`, la columna de los nombres viejos hay que restaurarla a mano — o excluir el plan del
barrido.

⚠️ **Y la fase 1 MOVIÓ GOLDENS**, que el plan sólo preveía para la fase 3: el renombrado llega a la
API —la ruta `/admin/sql/ediciones` y los campos `edicion_id`/`vinculo_id` de las respuestas—. Es
correcto que los mueva, y dejarlo fuera de la API habría conservado justo la confusión que este frente
viene a quitar.

## 8 · Lo que la fase 2 enseñó

**1 · «0 filas movidas» puede ser correcto y a la vez no demostrar nada.** La migración del escalón 2
corrió sobre la pila y dijo `0 cabeceras movidas`, sin avisos. Era cierto: la siembra de
caracterización crea recorridos `routed`, que cuelgan del entregable, así que **la rama que mueve no
se ejercitaba**. Correr no es funcionar. Al recrear la situación a mano la migración siguió diciendo
`0` y dejó la cabecera sin ancla — y el fallo era **mi dato de prueba**: inserté `vinculo_id = 2`
cuando los vínculos de esa base eran el `1` y el `4`, así que el `UPDATE … FROM` no tenía con qué
unirse. Con un vínculo que existe: `1 cabecera movida`. **Antes de culpar al código, comprueba que el
id que inventaste exista.**

**2 · Y entonces se probaron las TRES rutas, no sólo la buena.** Mueve; para con un mensaje que trae
el `DELETE` exacto a ejecutar **y deshace el `DROP COLUMN`** porque todo va en una transacción; y al
relanzarla termina. La del fallo es la que nadie prueba y es la que deja una base a medias.

**3 · Borrar una columna NO lo ven las puertas obligatorias.** `check:sql-aliases` y `check:imports`
dieron verde con **tres consultas de `flowRows.js` nombrando `vinculo_id`** — un alias correcto sobre
una columna que ya no existe es sintaxis perfecta para todo el mundo menos para PostgreSQL, y sólo en
tiempo de llamada. Lo cazó `test:char:run`. Es la lección que `CLAUDE.md` ya lleva escrita —«el SQL no
lo valida NADIE hasta que se ejecuta esa rama»— y aquí volvió a morder. **El barrido hay que hacerlo
por inventario, no con `grep | head`**: fueron 111 referencias, de las que sólo 14 eran del portador
muerto; las demás son `task_items.vinculo_id`, que es legítimo y se parece muchísimo.

**4 · La columna muerta tapaba un agujero.** Los hooks de las dos cabeceras guardaban «sólo en
borrador» preguntando por el vínculo. Sin esa columna, `ctx.payload.vinculo_id` es siempre
`undefined` y el `return` temprano **apagaba la comprobación entera**, en silencio. Y al reanclarla en
la edición apareció lo de verdad: la cabecera **autorada** nunca estuvo guardada —tenía `vinculo_id`
en `NULL`, así que `getTaskTemplate(null)` devolvía `null` y el `if (template)` se saltaba el guard—.
Se editaba el recorrido de una edición publicada sin que nadie dijera nada.

**5 · Un golden que se mueve puede ser la prueba de un fallo ARREGLADO.** `signature_flow_count` del
panel operativo pasó de `1` a `0`, y no es una pérdida: la unión vieja era
`sft.vinculo_id = pdt.id` **sin** `task_item_id IS NULL`, así que contaba como «recorrido autorado de
este vínculo» una cabecera de runtime que pertenecía a **un** entregable ya enviado. Medido con las
dos uniones sobre la misma base: la vieja da 1, la nueva 0, y los recorridos autorados de ese vínculo
son **cero**. El `1` era el fallo.

**6 · Un `CHECK` imposible se volvió posible, y pagó el mismo día.** «Exactamente un portador» no se
podía declarar mientras runtime escribiera dos columnas a la vez. Con dos portadores excluyentes sí,
y gracias a él se puede **deducir** el ancla de runtime sin leerla — que hizo falta, porque
`sqlTables.js` no cataloga `task_item_id` en estas tablas y la rama que la miraba **no se disparó
nunca**. Lo delató que la corrida saliera 320/320 cuando esperaba un fallo.

⚠️ **Y una de operación: `test:char` a secas no es `test:char:run`.** Sin rehacer la fixture, la base
arrastra lo que mutó la corrida anterior: **58 fallos** que no son del código. La fixture es parte de
la prueba.


## 9 · Lo que la fase 3 enseñó

**1 · El vocabulario de un sitio NO es el vocabulario de todos.** `pending`, `approved` y `cancelled`
aparecían **260 veces en 28 ficheros**, y sólo una parte era del recorrido: las demás son
`process_runs.status` (`pending`·`active`·`completed`·`cancelled`), el estado de un **lote de firma**,
los del **dosier** y hasta **modos de interfaz** (`canShowLauncher('pending')`, que no es un estado).
Un reemplazo global habría roto cuatro vocabularios para arreglar uno. Lo que permitió acotarlo fue
una página del sitio que ya mapeaba **quién gobierna cada columna**
(`modelo/vocabularios-de-estado.md`): el perímetro real eran **cuatro columnas**, no 260 literales.

**2 · El `CHECK` viejo rechaza el `UPDATE` que traduce.** La migración paró con
`new row ... violates check constraint`, y es obvio al verlo: mientras el `CHECK` en inglés esté
puesto, no se puede escribir español debajo. El orden es **quitar el viejo → traducir → poner el
nuevo**, y no hay forma de adelantar ningún paso. La transacción lo deshizo entero, que es por lo que
el bloque va en una sola.

**3 · Dos funciones gemelas eran el SÍNTOMA, no la causa.** `isPendingLikeFillStatus` miraba el
vocabulario inglés y `isPendingLikeSignatureStatus` toleraba **los dos idiomas a la vez**. Lo mismo en
el frontend: `LLENADO` (inglés) y `SOLICITUD_FIRMA` (español) eran dos mapas de tonos para el mismo
concepto. Con un vocabulario se colapsan en uno, y lo que queda es **menos código**, no más.

**4 · Y una clave con DOS significados, que es el hallazgo que paga la fase.** `status_name` traía
en el lado de ENTREGA el **código** (`fr.status AS status_name`) y en el de FIRMA la **etiqueta** del
catálogo (`srs.name`). El frontend la leía primero y la minusculizaba **como si fuera un código**, así
que «En progreso» llegaba como `en progreso` — que no coincide con `en_progreso` en ningún mapa. El
parche estaba a la vista y nadie lo había leído así: una entrada `"en progreso"` **con espacio** en
`estadoTono.js`. Muerto el catálogo, el parche sobra y la clave se llama `status`.

**5 · El motivo de una exclusión caduca antes que la exclusión.** `estadoTono.js` dejaba
`signature_flow_instances.status_id` y `signature_requests.status_id` **fuera** del registro de
columnas-pastilla, con su razón escrita: «llegan como número, la celda no tiene el nombre que
traducir». Era cierta y dejó de serlo el mismo día en que pasaron a ser texto. Las columnas-pastilla
van de 13 a **15** sin tocar una línea de presentación: sólo quitando una exclusión que ya no aplicaba.

**6 · Un `JOIN` muerto se esconde a plena vista.** `UserMenuService` unía
`signature_request_statuses` y **no usaba ni una de sus columnas**. No lo ve ningún test —el resultado
es idéntico con y sin él— y no lo ve ninguna puerta. Lo delató contar los usos del alias (`srs.`)
antes de reescribir, en vez de ir consulta por consulta.

⚠️ **Y una de método: renombrar una clave de golden NO es lo mismo que cambiar su valor.** Las 11
claves `terminal_<estado>_<accion>` se renombraron **a mano en el JSON**, conservando el valor y la
posición, porque `test:char:capture` añade las nuevas pero **no borra las viejas**: hacerlo por
captura habría dejado 11 claves huérfanas que ningún test lee y que nadie volvería a mirar.

## 10 · Las decisiones de la fase 4, campo a campo (2026-10-08)

Revisión con el dueño de las **21 columnas** de los dos pasos. Cada retirada va con lo que se midió
para justificarla; ninguna es «parece que no se usa».

### Lo que se queda, y con qué forma

| Campo | Decisión |
|---|---|
| `accion` (antes `lado`) | **se renombra.** `lado` nombraba la estructura que E1 elimina: después de unificar no hay lados, hay pasos de dos clases. El repositorio nombra sus discriminadores por lo que discriminan (`item_mode`, `origin_kind`, `run_mode`), y un paso pide **una de dos acciones**. Se descartó `fase` para no chocar con las fases de `document_versions.status` |
| origen | **dos columnas y un `CHECK`**, no una columna polimórfica: con un `origen_id` genérico se pierden las claves ajenas. Es la misma forma que la fase 2 puso en las cabeceras |
| `orden` · `code` · `nombre` | sin cambios |
| resolutor (7 columnas) | **bajan al participante**. Hoy en firma están escritas **dos veces** —en el paso y dentro del JSONB— y gana el JSONB |
| `slot` | **baja al participante** (ver abajo) |

### Lo que se retira, con su medida

| Campo | Qué se midió |
|---|---|
| `is_required` | **no controla el orden** —eso es `step_order`, y los firmantes de un paso van en paralelo—. En entrega **no tiene ni un lector**. En firma sólo decide *cuándo* te enteras de que falta alguien: con `1` el recorrido no abre y te lo dice; con `0` abre y el paso **se aparca** con una solicitud sin persona que en firma **nadie puede atender**, y como `resolveCurrentSignatureStep` devuelve el primer paso no aprobado, ese paso es el actual para siempre. La variante `0` no es «opcional»: es un bloqueo silencioso y más tarde. Queda el comportamiento de `1` como único |
| `can_reject` | **derivada y muerta**: se escribe como `order > 1` en tres sitios y **no la lee nadie**. Había **tres reglas** para la misma idea y ninguna era la otra — la columna, el guard (que no mira ni el orden ni la columna) y el frontend (que decide por `resolver_type`) |
| `selection_mode` | se van sus tres valores. `auto_one` es **heurístico**: `ORDER BY person_id ASC` + `slice(0,1)`, o sea «el id más bajo» — la misma arbitrariedad que el repositorio ya retiró en `one_per_unit`. `manual` **no lo puede crear ninguna pantalla**, en firma deja el recorrido colgado —no hay auto-reclamo ni endpoint de asignación— y en entrega **se ignora**: `resolveFillStepAssignees` no lo mira. Con los dos fuera queda un valor, y una columna con un valor no es una columna |
| `unit_subtree` · `unit_type` | **ninguna pantalla los produce**: el editor de pasos ofrece dos ámbitos («en la misma unidad del entregable» y «en una unidad específica») y el constructor *routed* emite `unit_exact` o `all_units`. `unit_subtree` sí existe en el frontend, pero en el panel de reglas — **otra columna con el mismo nombre**, `process_target_rules.unit_scope_type`, que es la que reparte el proceso |
| `unit_type_id` | cae con `unit_type`: lo leen exactamente las dos ramas de ese ámbito |
| `position_id` | cae al filtrar el JSONB: `position` no es un `resolver_type` legal, y era su único lector |
| `relation_type_id` | huérfana ya declarada en el esquema. Muere **sin migración**: basta con no llevarla |
| `approval_mode` · `required_signers_min` · `required_signers_max` | el cupo entero. `required_signers_max` **ya estaba muerto** (se selecciona, se parsea, no decide). El cupo existía porque el conjunto era indeterminado —`auto_all` con ámbito amplio—, y eso es lo que se quita. Además `or` **produce basura medible**: al cerrar el paso con una firma, las solicitudes hermanas **siguen abiertas**, se listan en el espacio de trabajo de quienes no firmaron y al pincharlas dan «no pertenece al paso actual». El constructor *routed* sólo emite `and` |
| `anchor_refs` | **ciclo cerrado**: se escribe `[]`, se relee, se vuelve a escribir. Cero consumidores |
| `signers` | **a filas**. Era 1→N sin validar, mandando sobre columnas que sí tienen `CHECK`, y la copia de versionado lo propaga verbatim. A filas entra bajo el mismo `CHECK` y deshace la duplicación |
| cabeceras enteras | de sus 7 columnas sólo se leen `id` e `is_active`; `name` se escribe y **no se consulta nunca**, y `description` no la toca nadie |

### `slot` baja al participante, y no es estética

Un `slot` es **un sitio físico en el papel**: la maqueta imprime ahí el token de **una** persona
(`{{ signatures.<slot>.token }}`), queda impreso en el PDF como texto, y el firmador **busca ese
texto para estampar en sus coordenadas**.

Con N firmantes y **un** hueco, el paso imprime el token del primero (`primary = signers[0]`) y los
demás **no tienen marca en el papel**: el firmador lanza `Token marker '<token>' not found in PDF`.
No es una ambigüedad de diseño — es un fallo que estalla al firmar.

### Lo que NO se hace

- **No se añade `devuelto` a firma.** Devolver significa «vuelve atrás y rehaz», y en firma los dos
  destinos chocan con lo que una firma es: la del paso anterior **ya está estampada en el PDF**, y
  si el documento cambia, las firmas dadas firmaron otro documento. **Crear una ronda nueva no es la
  alternativa torpe a devolver: es lo que devolver significaría aquí**, y eso ya existe
  (`rehacerDocumento`). El `CHECK` por lado se queda como lo dejó la fase 3.
- **No se añade prelación** entre los firmantes de un paso. Es la forma determinista de decir «basta
  uno», y si algún día hace falta, el `orden` del participante ya está puesto.
- **No se toca la ambigüedad de `item_mode`** ni el firmado por lotes.

### Sin migración

Decisión del dueño: **no hay datos en producción**, así que `scripts/migrar-recorrido.sql` se queda
en las fases 1–3 y lo nuevo se entrega **sólo como esquema**, con `scripts/reset-system.sh` como
camino. Es lo que el contrato `TD7-s` ya dice: el esquema describe la forma, no converge una base
anterior.

## 11 · El atasco del rechazo en firma — arreglo previo a la fase 4

Hallado al evaluar si firma debía poder devolver, y **confirmado por el dueño que se arregla**. No es
fase 4 (no cambia la forma de ninguna tabla), así que va **antes y en su propio commit**: así el diff
del golden es la prueba del arreglo y no se mezcla con el del reestructurado.

**Qué pasa hoy.** Al rechazar una firma, `anyRejected` pone la **instancia** en `rechazado`, pero el
bloque que mueve el documento **no tiene rama para el rechazo**: sus tres salidas son «Firmado
completo», «Firmado parcial» y «Pendiente de firma». El documento **no se mueve**, y
`resolveCurrentSignatureStep` devuelve el paso rechazado como actual **para siempre**. La única
salida es `rehacerDocumento`, que cancela la ronda entera.

**Qué debe pasar**, con la regla que sale de lo criptográfico y usando un dato que el código ya
calcula (`anyApproved`):

| Al rechazar | Destino |
|---|---|
| **nadie ha firmado aún** en esa ronda | el documento vuelve a **«Observado»** — la misma salida que el rechazo de entrega. No hay firma que invalidar, así que la ronda se puede corregir |
| **ya hay alguna firma** | **ronda nueva**. Aquí sí es proporcionado, porque hay algo que invalidar |


## 12 · Fase 4, paso 1 — el esquema

**Aditivo a propósito.** Las cuatro tablas nacen **junto a las ocho viejas** y vacías: nadie las
escribe todavía. Así este paso queda verde y revisable por sí solo, y las viejas se retiran en el
paso 4, cuando ya no las referencie nadie. Sin migración: la base se recrea.

### Las once restricciones, ejercitadas contra la base

No basta con que el esquema compile. Cada regla del diseño se probó en vivo, en una transacción
deshecha:

| | Caso | Resultado |
|---|---|---|
| 1 | un paso con **los dos** orígenes | rechazado · `ck_pasos_declarados_un_origen` |
| 2 | un paso **sin** origen | rechazado · el mismo |
| 3 | un paso con un origen | aceptado |
| 4 | el **mismo orden** en la misma edición y acción | rechazado · `uq_pasos_declarados_edicion` |
| 5 | el mismo orden con **otra acción** | aceptado |
| 6 | dos firmantes con el **mismo hueco** en el mismo documento | rechazado · `trg_participantes_slot_unico` |
| 7 | huecos distintos | aceptado |
| 8 | un turno **devuelto** en entrega | aceptado |
| 9 | un turno **devuelto** en firma | rechazado · `ck_turnos_devuelto_solo_entrega` |
| 10 | un turno que **miente** sobre su acción | rechazado · `fk_turnos_recorrido`, la compuesta |
| 11 | dos recorridos de la misma acción para una versión | rechazado · `uq_recorridos_version_accion` |

El 10 es el que justifica la clave ajena compuesta: sin ella la `accion` duplicada podría derivar y
el `CHECK` del 9 se estaría aplicando **contra una mentira**.

### Tres cosas que costaron, y que no estaban previstas

**1 · El generador del modelo no sabía leer una clave ajena compuesta.** Son **dos** parsers de DBML
—`postprocess-dbml.mjs` y `gen-mapa-campos.mjs`—, y los dos fallaban: el primero ni siquiera
despegaba el prefijo de esquema, porque su expresión esperaba `"esq"."tabla"."col"` y una compuesta
viene `"esq"."tabla".("a", "b")`. Se les enseñó la forma en lugar de evitar la clave compuesta; en el
mapa con campos la relación se etiqueta con **las dos columnas**, porque con una sola el diagrama
mentiría.

**2 · `SCHEMA` viene normalizado en `postgres_schema.test.js`.** `sinEsquema` le quita el prefijo de
dominio a cada `CREATE` para que los once sitios que buscan una tabla por su nombre no tengan que
saber dónde vive. Comprobar justamente **en qué esquema nace** una tabla necesita el fichero crudo.

**3 · Y una comprobación mía castigó al que explica.** Un `assert.doesNotMatch(create, /unit_subtree/)`
saltaba por culpa del **comentario** que explica por qué ese ámbito se retiró. Es la lección que
`check-mapa-tablas.mjs` lleva escrita en su `sinProsa()`: si miras nombres dentro del código, quita
los comentarios **antes** de mirar.


## 13 · Fase 4, paso 2 — la receta

**En paralelo, no en sustitución.** Los tres escritores de receta —el editor de plantillas, la copia
de versionado y la materialización de `routed`— llenan **además** `pasos_declarados` y
`participantes_declarados`. No se puede hacer de otra forma: la ejecución apunta por clave ajena a
los pasos viejos (`fill_requests.fill_flow_step_id`), así que receta y ejecución se mudan juntas o
no se mudan. El paso 3 mueve la ejecución; el 4 retira lo viejo.

Lo que esto compra es la **prueba de que la forma nueva representa lo mismo**, sobre datos reales,
antes de apostar un solo lector.

### La comprobación cruzada

`backend/scripts/verificar_receta_nueva.mjs` escribe una receta por el camino real y compara las dos
formas fila a fila, con un `FULL OUTER JOIN` sobre los seis campos que importan. La siembra de
caracterización es **pobre** para esto —deja dos participantes y ningún paso de firma con varios
firmantes—, así que el script construye el caso de riesgo y lo deshace sin dejar rastro:

```
participantes · forma vieja: 5 · forma nueva: 5 · diferencias: 0
huecos del paso de firma (uno por firmante): firma_1 · firma_1_2 · firma_1_3
```

La segunda línea es la propiedad que la forma vieja **no podía tener**: tres firmantes, tres huecos.

### Tres cosas que costaron

**1 · El ámbito por defecto era distinto por lado, y lo delató el cruce.** `fill_flow_steps` traía
`DEFAULT 'unit_exact'` y `signature_flow_steps` `'context_exact'`. El convertidor usaba uno solo, y
la comprobación marcó una diferencia en un paso `specific_person` —donde el ámbito es **inerte**,
porque el resolutor devuelve la persona sin mirarlo—. Se alineó con la columna vieja: mientras las
dos formas convivan, la nueva tiene que **reproducir** la vieja, y unificar el defecto es una
limpieza del paso 4. Sin el cruce, esto no se habría visto.

**2 · La limpieza del arnés rompió cuatro suites, y el fallo se leyó en otro sitio.** La clave ajena
`fk_pasos_declarados_edicion` **no** es `ON DELETE CASCADE` —a propósito: no se borra una edición que
tenga recorrido—, así que el `DELETE FROM ediciones` del `after()` empezó a fallar. El síntoma
aparente fue otro: un caso posterior afirmando «ningún flujo nace fuera del formulario» veía **1**,
porque las limpiezas caídas habían dejado residuo. La línea que lo delata es `Test Files`, no `Tests`.

**3 · `check:sql-aliases` estaba CIEGA a los alias sobre tablas cualificadas** —y eso no es un
problema del script nuevo, es un hueco de la puerta—. Su patrón leía el nombre de tabla con
`[a-z_][\w]*`, que no incluye el punto: de `FROM plantillas.ediciones e` se quedaba con
`plantillas` y **el alias `e` no lo veía nunca**. No había saltado porque el repositorio no
cualifica —las consultas se apoyan en el `search_path`—, pero cualificar es legítimo desde que el
esquema se partió en ocho. Se le enseñaron las dos mitades: la tabla puede traer esquema, y el
esquema pegado a un `FROM`/`JOIN` **no es un alias**.

⚠️ **Y al documentarlo, la puerta se reportó a sí misma.** El ejemplo `SELECT e.id` que escribí entre
acentos graves dentro de su propio comentario lo leyó como una consulta. Los ejemplos de SQL en ese
fichero van entre comillas. Es la tercera vez en este frente que una comprobación que mira texto
castiga al que explica.

**Probado por mutación**, que es el estándar que esa puerta se puso: con el ensanche puesto, un alias
huérfano de verdad sigue reportándose, tanto en una consulta sin cualificar como en una cualificada.


## 14 · Fase 4, paso 3a — la ejecución de la ENTREGA

**Partido en dos mitades, y eso lo hizo posible:** las dos ejecuciones todavía eran tablas
independientes, así que la de entrega se pudo mudar entera dejando la de firma sobre lo viejo. Dos
entregas verdes en vez de una grande y roja.

### Lo que se unificó de verdad

| Antes | Ahora |
|---|---|
| dos resolutores de paso, **44 líneas idénticas de 50** en dominios distintos | **uno**, `resolverParticipante`, que sirve a los dos lados |
| la resolución por escalones, duplicada en `queries.js` y en el servicio de firma | **una**, `resolverReceta`, y sin buscar cabecera |
| `plantillas/datos/flujoDeLlenado.js`, cinco funciones de ejecución de entrega | **disuelto**: las cinco preguntas eran las mismas que las de firma |
| `document_fill_flows` + `fill_requests` | `recorridos` + `turnos`, con el turno apuntando al **participante** |

Y el resolutor resuelve un **participante**, no un paso: antes el resolutor vivía en las columnas del
paso —y en firma, duplicado dentro del JSONB, que ganaba—, así que un paso sólo sabía expresar **una**
forma de encontrar a alguien.

### Lo que la puerta de arquitectura obligó a corregir, y tenía razón

`check-mapa-tablas` falló **tres veces** y las tres eran de fondo:

1. **`recetaDelRecorrido.js` nombraba `vinculos`**, que es de `procesos`. El segundo escalón cruza, así
   que su consulta se fue a `datos/consulta/`.
2. **`recorrido.js` nombraba `pasos_declarados`**: un turno se lee **siempre** con lo que su paso
   declara. Tres funciones a `consulta/`.
3. **`turnos` lo escribían dos sitios** — el dominio y el servicio de acciones. Al llevar esas
   escrituras a la puerta apareció un caso que merece la pena contar: «reabrir el paso anterior» es
   una escritura **cuya condición cruza de dominio**. No cabe ni en `datos/` (nombraría otra tabla) ni
   en `consulta/` (es un `UPDATE`). Se parte en dos: la **lectura de ids** cruza y vive en `consulta/`,
   y la **escritura recibe ids** y no cruza nada.

### Dos deudas que se cierran solas

- **`fill_requests` deja de tener dos escritores**: su línea de `_deuda_escritura` se quita, y las
  declaradas bajan de 2 a 1.
- **`FillRequestWorkflowService` deja de ser un flujo**: ya sólo escribe `tareas`. Los flujos que
  cruzan dominios bajan de 7 a 6. Y `rehacerDocumento` pasa de declarar tres dominios a dos.

### Lo que costó

**1 · El golden cazó una fusión mal hecha.** Hay **dos** reaperturas de turnos y no significan lo
mismo: al **devolver** se reabre el paso *anterior* y su nota se limpia; cuando **todos** los turnos
del paso actual quedan devueltos se reabre *ese* paso, y ahí la nota **es el motivo** por el que
volvió. Las fundí en una función que borraba siempre, y `return_efecto` lo detectó: *«faltan datos en
el formulario»* se perdía.

**2 · El doble de conexión de un test empezó a tragarse la consulta equivocada.** La del último paso
ahora también lee `FROM turnos t`, igual que la del contexto, y la rama genérica iba primero. El
síntoma no se parecía a la causa: `max_step_order` llegaba `undefined`, o sea «no es el último paso».

**3 · Y el hueco de siempre: que un módulo EXPORTE lo que le importan.** Retirar cuatro funciones dejó
**18 suites en rojo** por un solo import roto; `check:imports` da verde porque mira lo contrario.

## 15 · Fase 4, paso 3b — la ejecución de la FIRMA, y el cierre del defecto 1.19

La otra mitad. `DocumentSignatureWorkflowService.js` baja de **1.338 a 856 líneas**, y lo que se va no
es código repetido: es un **segundo motor completo** —su propio resolvedor de receta por escalones, su
propio resolutor de personas con seis ámbitos, su propio lector de pasos y su propio convertidor del
JSONB `signers`—.

### Aquí se cierra el defecto 1.19, y lo que lo cierra es el modelo

El resolutor de firma leía `signature_flow_steps.signers`, un JSONB que **ningún `CHECK` cubría** y que
**mandaba sobre** las columnas que sí lo tenían. Por eso este fichero conservaba resolutores que su
gemela de entrega ya había retirado: **no eran ramas muertas, eran la única defensa** contra un valor
que la base no podía rechazar.

Con los firmantes en **filas** (`participantes_declarados`, con sus dos `CHECK`), el valor retirado no
se puede ni insertar. Se van:

| Qué | Cuánto |
|---|---|
| resolutores legados (`document_owner`, `position`) | 2 `case` + 3 funciones de apoyo |
| ámbitos inalcanzables (`unit_subtree`, `unit_type`, `context_subtree`, `context_ancestor_type`) | 4 ramas, dos con su `WITH RECURSIVE` |
| el cupo (`approval_mode`, `required_signers_min`/`_max`) | un `switch` de 3 casos y 2 lectores |
| `selection_mode` y `auto_one` | el recorte «quédate con el id más bajo» |

**El efecto que mejor lo demuestra está fuera del fichero.** El disparador del relevo tenía **dos**
`UPDATE`, y el de firma llevaba esta guarda:

```sql
AND (sfs.signers IS NULL OR sfs.signers::text NOT LIKE '%specific_person%')
```

«Ante la duda no se mueve» — y la duda la creaba exactamente el 1.19. Hoy el disparador es **un**
`UPDATE` sin guarda defensiva, porque el `resolver_type` del participante es la verdad.

### Lo que se unificó, además

| Antes | Ahora |
|---|---|
| `dominios/firmas/datos/flujoDeFirma.js`, 4 funciones de ejecución | **disuelto**: las cuatro preguntas eran las de entrega. `dominios/firmas/` se queda con una puerta vacía y su lápida |
| `rehacerDocumento` con dos comprobaciones de titularidad y dos cancelaciones | **una de cada**, con `accion` distinta |
| la instancia de firma **no guardaba `paso_actual`**: se recalculaba en cada lectura | el recorrido lo lleva en los dos lados — y **eso** es lo que permite la línea anterior |
| el escalón de firma escrito en `FillRequestWorkflowService` con su propio `COALESCE` | `resolverReceta`, la misma de todos |
| dos injertos del CRUD genérico, uno por tabla de solicitudes | **uno**, en `turnos`, que elige la reconciliación mirando el recorrido |

### Dos claves ajenas cruzan de dominio, y dejan de cruzar

`document_signatures.signature_request_id` y `document_workflow_observations.signature_request_id`
apuntaban a `signature_requests` (dominio `firmas`) y ahora apuntan a `turnos` (dominio `tareas`).
Medido: las relaciones de `tareas` **hacia fuera bajan de 31 a 29**.

Y con eso **dos flujos dejan de cruzar dominios**: `DocumentSignatureWorkflowService` y
`rehacerDocumento` escriben sólo `tareas`. La puerta lo avisa —«deja de ser un flujo y se mueve a
él»— y el aviso se deja a la vista: **dónde** aterriza un orquestador de `tareas` es la decisión de
F7.5, no de este paso.

### Lo que la caracterización NO cubre, medido

Tras `test:char:run` hay **1 recorrido y 1 turno con `accion = 'firma'`** —la aprobación de la entrega
los abre— pero **`document_signatures` se queda a cero**: firmar necesita un certificado y el
microservicio. Así que los 320 goldens cubren `ensureSignatureFlowForDocumentVersion` y **dejan sin
tocar** `registerSignatureEvidence` y `syncDocumentProgressFromSignatureRequest`, que son las dos que
mueven el estado.

Lo cubre **`backend/scripts/verificar_firma_nueva.mjs`**, que ejecuta las dos sobre el recorrido real
que la caracterización deja abierto y comprueba los **dos ejes**, en transacciones que se deshacen:

```
turnos del recorrido de firma: 1 · estado de partida: pendiente
firma VALIDA   -> recorrido completado · paso_actual null · documento "Final"
firma INVALIDA -> recorrido rechazado · paso_actual 1 · documento "Observado"
```

El segundo es el que no se podía afirmar sin esto: es el arreglo del §11 corriendo sobre las tablas
nuevas.

### Lo que costó

**1 · La puerta de alias dio un FALSO POSITIVO, y era del tipo peor.** Los dos lectores del panel
necesitan resolver los escalones **dentro de una consulta**, y lo hacían dos veces — con un `OR` en el
de entrega, que **no es una prioridad**: un entregable *routed* con receta propia cuya edición también
tenga receta autorada casaba con las dos y el panel recibía **los pasos duplicados**. Ningún golden lo
cazó porque el proceso por defecto no tiene receta de edición.

Al escribir el escalón **una vez**, como fragmento interpolado, `check:sql-aliases` lo reportó: el
alias que trae el fragmento se usa en la lista del `SELECT` —zona revisada— y se declaraba dentro de un
hueco, que la puerta sustituía por un espacio. **Eso empuja justo a lo contrario de lo que se quiere:
duplicar la regla para callar la puerta.** Se arregló la puerta: ahora resuelve los fragmentos que son
un `const` sin huecos. Probado por mutación por los dos lados, y su nota dice **exactamente** cuánto
alcanza —los usos del fragmento siguen fuera de la zona revisada, y eso está medido, no supuesto—.

**2 · Un backtick dentro de un comentario `--` de SQL**, séptima vez en el frente. `node --check` lo
cazó señalando la primera línea de la plantilla, como está escrito que pasa.

**3 · El panel MAPEABA las claves, no las pasaba verbatim.** Asumí que `signature_steps` viajaba tal
cual y el golden me corrigió: hay un `.push({...})` con las catorce claves escritas a mano. Siete se
retiran, y una entra —`signer_count`—, porque es lo único que de verdad se puede decir **de un paso**
con N firmantes: `resolver_type` y `cargo_name` son hechos **de cada firmante**, y la columna del paso
traía la del primero.

**4 · Y una fila por PASO, no por firmante.** El primer borrador del lector devolvía una fila por
participante, que es lo natural… y `total_signature_steps` del panel sale de `length`, así que un paso
con tres firmantes habría enseñado **«3 pasos»**. El golden lo confirma al revés: `total_signature_steps`
no se movió.

**5 · La puerta del mapa cazó MI PROPIO script de comprobación**, y tenía razón: escribía `turnos` y
`document_versions` con un `UPDATE` directo, o sea un **segundo escritor** de dos tablas con dueño. Se
arregló llevándolo por `actualizarTurno` y `actualizarEstado`, los del `datos/` de `tareas`. Escribe a
mano una sola tabla —`document_signatures`, la evidencia, que es justo lo que no se puede simular—.

**6 · El teardown de caracterización pasó a tener un ORDEN obligatorio.** Con las dos claves ajenas
apuntando a `turnos`, lo que cuelga del turno hay que borrarlo antes que el turno. Antes el orden entre
los dos bloques daba igual porque cada mitad tenía sus propias tablas.

### Los unitarios: cinco casos se fueron CON SU SUJETO, y cinco entraron

`DocumentSignatureWorkflowService.test.js` baja de **15 casos a 10**, y los que se van no se borran
por conveniencia:

- **seis** vigilaban la prioridad de los escalones. Hoy la resuelve `resolverReceta`, que es una para
  los dos lados y tiene los suyos en `recetaDelRecorrido.test.js`: mantenerlos aquí sería probar dos
  veces la misma función.
- **seis** vigilaban el orden de los parámetros del ámbito (el defecto 1.16), y su cabecera decía por
  qué no podían ser un golden: esos ámbitos llegaban por el JSONB. **Ese era el 1.19.** Cerrado, cuatro
  de los seis ámbitos no son inalcanzables por descuido — no se pueden ni insertar.

Lo que queda que vigilar se movió a `assignees.test.js`, que sube de 8 a 13: los tres ámbitos vivos con
la posición de sus parámetros, la guarda de «ámbito que exige unidad sin unidad» y un caso que afirma
que los **cuatro retirados no traen su filtro de vuelta**.

Y entran cinco en el fichero de firma, todos sobre lo que de verdad es suyo: los **dos ejes** (un turno
`completado` con firma `invalido` cuenta como rechazo; sin estado técnico no se penaliza), el cupo
entero (dos firmantes, una firma, el paso no cierra) y la **aptitud** —un paso cuyo cargo no resuelve a
nadie bloquea el recorrido y dice qué paso y por qué, que es lo único que sobrevive de `is_required`—.

### El diff del golden es exactamente lo que se retiró

41 líneas fuera, 8 dentro, en 2 ficheros:

| Línea | Veces | Qué es |
|---|--:|---|
| `approval_mode`, `required_signers_min`, `required_signers_max`, `is_required`, `selection_mode`, `resolver_type`, `cargo_code`, `cargo_name`, `template_id` | 4 | las 9 claves retiradas del paso de firma del panel |
| `signer_count` | 4 | la que entra |
| `scope_unit_type_id` | 1 | el tipo de unidad del contexto, que ya no lo lee ningún ámbito |

**Ni un recuento, ni un estado, ni un id se movieron** — `total_signature_steps` incluido.

## 16 · Fase 4, paso 4 — lo que cuelga: las ocho tablas se van

**De 95 tablas a 87, y de 185 claves ajenas a 158.** El esquema deja de crear las ocho del recorrido
partido en dos, y todo lo que colgaba de ellas se retira con ellas.

| Lo que había | Lo que hay |
|---|---|
| `fill_flow_templates` · `signature_flow_templates` | *nada*: la cabecera desaparece |
| `fill_flow_steps` · `signature_flow_steps` | `pasos_declarados` + `participantes_declarados` |
| `document_fill_flows` · `signature_flow_instances` | `recorridos` |
| `fill_requests` · `signature_requests` | `turnos` |

### `flowRows.js` de 662 líneas a 224, y lo que se va no es duplicación

Era el escritor, el lector y el copiador de la receta autorada, y la mitad de su tamaño venía de que
los dos recorridos vivían en cuatro tablas con dos juegos de columnas distintos:

- los **dos escritores de pasos**, con sus 14 y 19 columnas escritas a mano;
- la **maquinaria de cabeceras**: buscarla, crearla, reutilizarla, reactivarla y desactivarla cuando
  el autor quita un lado;
- los **dos lectores Y los dos lectores de copia** —cuatro—, que eran distintos porque la proyección
  al editor pierde columnas y una copia no puede perder ninguna;
- y el **parseo del JSONB `signers`**, con sus dos convenciones de nombre vivas en la misma columna.

**La copia pasó a ser una copia de verdad.** Antes se leían las columnas y se volvían a escribir con
el escritor de siempre —para no tener un segundo escritor—, y eso obligaba a mantener dos lectores
con listas de columnas distintas. Ahora se leen filas y se escriben filas: si mañana el participante
gana una columna, la copia la arrastra sola.

Y `materializeRuntimeFlowForTaskItem` baja de **132 líneas a 60**: escribía la receta DOS veces, con
un `primary` que duplicaba al primer firmante en las columnas del paso.

### El guard de `/admin` se simplificó de verdad, no sólo de nombre

Eran **tres** injertos —las dos cabeceras y los pasos de entrega— y son **dos**. Y un paso de entrega
tenía que ir a buscar su CABECERA para saber de qué edición era (`getFillFlowTemplate` →
`edicion_id`); hoy el paso **lleva su origen**. Un salto menos, y la deducción que
`exigirRecorridoEditable` tenía que hacer —el portador de runtime no se podía leer de la fila, así que
se deducía por descarte— desaparece: `pasos_declarados` cataloga las dos columnas y la fila lo dice.

### Lo que se encontró roto por el camino, sin buscarlo

Al pasar por cada registro apareció lo que llevaba tiempo apuntando al vacío:

| Dónde | Qué |
|---|---|
| `ProcessManagementView.vue` | la pestaña **«Documentos» pedía `documents`**, retirada el 2026-08-23, y **«Firmas» pedía `signature_request_statuses`**, retirado en la fase 3 de *este* frente. Dos pestañas que respondían con un error que nadie miraba |
| `AdminTableManagerConfig.js` | `document_id: "documents"` en el mapa de claves ajenas —el editor pedía un catálogo inexistente— y `task_items → documents` entre los registros relacionados |
| `estadoTono.js` | `documents.status` en el registro de columnas de estado, apuntando a la misma tabla muerta |
| `dependenciasDelPuesto.js` | contaba por `fill_flow_steps.position_id` y `signature_flow_steps.position_id`, una columna cuyo único lector —el resolutor `position`— salió del vocabulario hace meses. **En la receta nueva no hay columna de puesto**, así que un puesto ya no puede estar bloqueado por un paso de recorrido: afirmarlo era contar filas de una regla muerta |
| `tableHooks.js` | los injertos de `fill_requests` y `signature_requests` seguían ahí tras el paso 3b, y el `id` de esas tablas ya no identifica un turno: habrían reconciliado **el documento equivocado** |
| `reset_targets.mjs` | `documents` en la lista de tablas que delatan uso real, tragada por un `try/catch` desde agosto |

### Los contadores que bajan, y qué significan

| | Antes | Ahora |
|---|--:|--:|
| Tablas del esquema | 95 | **87** |
| Claves ajenas | 185 | **158** |
| Consultas vigiladas por `check:sql-aliases` | 626 | **605** |
| Columnas booleanas del frontend con su eje | 31 | **25** |
| Columnas de estado del editor genérico | 15 | **12** |
| Columnas de clasificación del editor | 20 | **16** |
| Flujos que cruzan dominios (`_flujos`) | 6 | **5**, y tres de los cinco ya no cruzan |
| Grupos del generador de campos | «entrega» + «firma» | **uno**, más «la firma en sí» |

### Tres flujos dejan de cruzar dominios, y por qué se quedan declarados

`generation/documents.js`, `DocumentSignatureWorkflowService.js` y `rehacerDocumento.js` escriben hoy
**un solo dominio**, `tareas`. La puerta lo avisa —«deja de ser un flujo y se mueve a él»— y el aviso
se deja a la vista, con su motivo escrito en `_flujos`.

No se salen de la lista, y la razón es medible: la comprobación C los eximía, y sin la exención
`document_versions` tendría **dos escritores** —el `datos/` de `tareas` y estos servicios—. Eso no se
arregla moviendo una declaración: se arregla cuando `tareas` tenga su dominio y esas escrituras entren
por su puerta, que es **F7.5**.

`flowRows.js` sí salió: se quedó con **cero SQL**, así que no cruza nada.

### Los unitarios: de 919 a 896, y cinco casos se fueron CON SU SUJETO

| Fichero | Antes | Ahora | Qué cambió |
|---|--:|--:|---|
| `postgres_schema.test.js` | 44 | 33 | **once** casos vigilaban el portador de las dos cabeceras y la SIMETRÍA de los dos pasos (`code` y `name` con el mismo tipo en los dos lados). Lo primero lo vigila hoy el `CHECK` de un solo origen; lo segundo **ya no hace falta porque no hay dos tablas que simetrizar**. Entran 8: que las ocho no vuelvan |
| `flowRows.test.js` | 31 | 15 | trece casos eran sobre LA FORMA DE LA CABECERA, y no era paranoia: una cabecera con el portador equivocado dejaba el flujo escrito y **sin lector**, sin error en ningún sitio |
| `validation.test.js` | 3 de receta | 3 | pedían la cabecera y su paso; piden el paso, su participante y el recorrido. **Y uno afirma que el ORIGEN no se exige aquí**: son dos columnas excluyentes y lo que hay que validar es que haya *exactamente una*, algo que `requires` no sabe decir |

### El diff del golden, auditado

**417 líneas dentro, 497 fuera** en cinco ficheros, y cada línea es una de estas tres cosas:

- **sale** lo retirado: `selection_mode`, `is_required`, `can_reject`, `position_id`, `unit_type_id`,
  `relation_type_id`, `required_cargo_id`, `approval_mode`, `required_signers_min`/`_max`, `signers`
  y las ocho claves camelCase de su JSONB, más las de cabecera (`name`, `description`, `is_active`);
- **entra** la forma nueva: `accion`, `orden`, `nombre`, `participantes`, `persona_id`, `slot`;
- y **tres claves nuevas** de golden (`sql_pasos_declarados`, `sql_participantes_declarados`,
  `remove_guard_paso_de_recorrido_de_configuracion_activa`).

Lo único que entra en `schema_flow_reread` y parece contradictorio son `selection_mode`, `required` y
`approval_mode`: siguen viajando en el contrato del editor, pero ya **no round-trippean**. Lo que el
editor recibe es el DEFECTO DEL CONTRATO, no lo que el autor escribió, y hay un test que lo afirma
así de explícito.

### Lo que costó

**1 · El recorte de `sqlTables.js` por llaves, dos veces mal.** Las ocho configuraciones son objetos
de un array con objetos anidados (los `options` de cada `select`), así que ni «hasta la línea que es
`},`» ni una regex no codiciosa valen: la primera para en un cierre anidado y la segunda engancha una
llave de apertura muy anterior. Lo que funciona es **equilibrar llaves contando por línea** desde el
`{` que abre. Dos intentos, los dos cazados por `node --check`.

**2 · `gen-dbml` falló por el fichero de DISPOSICIÓN, no por el esquema.** Los diagramas con campos
llevan apuntada la disposición medida de cada subgrupo, y el generador **falla a propósito** si nombra
un grupo que ya no existe. Al fusionar «Flujo de entrega» y «Flujo de firma» en «El recorrido del
documento», los dos nombres viejos quedaron huérfanos. Es un acierto del generador: avisa de que un
grupo se renombró en vez de dibujarlo mal en silencio.

**3 · Y las anotaciones a mano también se validan.** `anotaciones.json` es lo único escrito a mano del
modelo generado, y el post-procesado falla si nombra algo que no existe. Tenía dos entradas de
`fill_flow_templates`, y lo correcto no era borrarlas: las cuatro tablas nuevas **no tenían ninguna**.
Se escribieron las cuatro, más tres notas de columna (`accion`, `slot`, la `accion` duplicada de
`turnos`).

### La documentación publicada: dos capítulos simétricos pasan a ser uno y medio

`modelo/flujo-de-entrega.md` y `modelo/flujo-de-firma.md` contaban lo mismo dos veces, 459 líneas
entre las dos. Reescritas:

- el **11** pasa a ser *«El recorrido del documento: quién hace cada paso»* y cuenta el mecanismo una
  vez: la receta, los tres resolutores, los tres ámbitos y la ejecución;
- el **12** pasa a ser *«La firma: el hueco en el papel y si la firma vale»* y cuenta **sólo lo que la
  firma tiene de propio**: la cadena del token y los dos ejes.

Se conservan los dos *slugs* y los dos números de capítulo a propósito: cambiarlos movería los enlaces
de otras once páginas y la numeración de los siguientes, que es trabajo de la fase 5.

Otras **nueve páginas** nombraban las ocho tablas como hechos vivos y se corrigieron una a una
(`orden-de-lectura`, `datos/motor-de-procesos`, `datos/index`, `datos/modos-y-plantillas`,
`datos/firmas-y-dominios`, `modelo/index`, `modelo/documento`, `modelo/cierre`,
`modelo/entregable-y-ediciones`, `modelo/vocabularios-de-estado`, `modelo/mapa-completo` y
`frontend/composables-y-deuda`).

⚠️ **Y 17 nombres quedan como EXCEPCIÓN DECLARADA, con su motivo y atados a su página.** No es callar
la puerta: son las lápidas que cuentan por qué cada cosa se fue, y eso es lo que impide que vuelva por
inercia. Cada motivo dice además cuándo deja de valer: *si el nombre reaparece en el esquema, hay que
quitar la excepción*.

## 17 · Fase 4, paso 4-bis — los NOMBRES, y lo que el renombre destapó

El paso 4 dejó el modelo unificado y **el vocabulario partido**: `turnos` y `recorridos` en la base,
`fill_requests` y `signature_flow` en la API. Lo dijo el dueño mirando el navegador —*«en front veo
que aún se usan nombres obsoletos, ¿esos nombres vienen desde back?»*— y la respuesta era sí.

**Cuatro contratos, porque son cuatro superficies y cada una tiene su consumidor**:

| | Contrato | Qué cambia |
|---|---|---|
| **#1** | el **panel** (`/users/:id/process-definitions/:def/panel`) | `fill_requests`→`turnos_entrega`, `fill_flow`→`recorrido_entrega`, `fill_steps`→`pasos_entrega`, `signature_steps`→`pasos_firma`, `signature_requests`→`turnos_firma`, los dos `current_*_step_order`→`paso_actual_*`, y dentro del recorrido `status`/`current_step_order`/`steps`→`estado`/`paso_actual`/`pasos` |
| **#2** | el **snapshot de firma** (`/sign/documents/:dv/signature-flow`) | `signatureFlow`→`recorrido`, `signatureSteps`→`pasos`, `signatureRequests`→`turnos`, `currentSignatureStepOrder`→`pasoActual` |
| **#3** | `signature_request_id` · `signatureRequestId` | → `turno_id` · `turnoId`, **columna incluida** |
| **#4** | `fill_request_id` · `document_fill_flow_id` y sus camellos | → `turno_id` · `recorrido_id`, y **las dos columnas de observación colapsadas en una** |

**147 ocurrencias** de los seis identificadores, en 27 ficheros. Más las claves de fila, los mensajes
de cara al usuario y la etiqueta «Solicitud» del editor de `/admin`.

### La regresión que el golden cazó y el unitario NO

`canCurrentUserResetWorkflow` —la que decide si aparece el botón de rehacer— leía
`fillWorkflow.current_step_order`, `fillWorkflow.steps` y `step.request_status`. El contrato #1 había
renombrado las tres. La función no fallaba: **devolvía `false` para todo el mundo, en silencio**, con
el botón simplemente ausente.

Sus **tres pruebas unitarias siguieron en verde**, y el motivo es la lección:

> **Un test que construye su propio fixture no se entera de que el productor cambió de forma.**

Lo cazó el golden del panel, donde `can_reset_workflow` pasó de `true` a `false` — **la única línea
del diff que no era un renombre**, entre 229 que sí lo eran. Está arreglado, con el aviso escrito en
la función y en sus fixtures, que ahora dicen de dónde sale su forma.

⚠️ **Y por eso el diff del golden se audita por VALORES, no por tamaño.** La forma de mirarlo que
funcionó: agrupar las líneas `+`/`-` y comprobar que **cada retirada tiene su equivalente**, dejando
sólo las que no emparejan. Quedaron tres grupos: las claves nuevas, los nueve mensajes, y un bloque
de **reordenación alfabética** —renombrar `request_status` a `estado` mueve su posición y arrastra a
sus vecinas sin tocar un valor—. Y en medio, el `can_reset_workflow`.

### Dos roturas del contrato #1 que no habían llegado a char todavía

El grep de verificación, antes de lanzar nada, encontró que el paso anterior había dejado:

1. **Los tres literales de reserva con las claves viejas** (`{ status, current_step_order, steps }`),
   así que un entregable sin pasos emitía una forma y uno con pasos emitía otra.
2. **`fillWorkflow.steps.length` dos veces**, que con el mapa relleno es `undefined.length` — un
   `TypeError` en el panel entero.

Las dos eran mías, del contrato #1, y **ninguna habría sobrevivido a char**; lo que importa es que
las encontró *mirar lo que el renombre dejó atrás*, no la corrida. **Después de renombrar por script,
el grep de las claves viejas es parte del trabajo, no una comprobación opcional.** Igual pasó con las
**11 lecturas del frontend** que seguían pidiendo `recorrido_entrega?.current_step_order` y
`?.steps`.

### Y una clave que resultó ser DOS columnas para la misma cosa

`document_workflow_observations` tenía `fill_request_id` **y** `signature_request_id`, y desde el paso
3b las dos apuntaban a `turnos`: era **la misma clave ajena escrita dos veces**, con `phase` diciendo
cuál valía. Hoy es `turno_id`, `phase` sigue siendo quien lo dice, y el esquema baja de 158 a **157**
claves ajenas sin perder un solo hecho. Comprobado en la base viva: las dos observaciones sembradas
resuelven su turno y su `accion` es `entrega`, que es lo que su `phase = review` afirma.

### Lo que SIGUE sin hacerse, y es a propósito

- **Los identificadores compuestos**: `updateFillRequestStatus`, `getFillRequestContext`,
  `syncDocumentProgressFromSignatureRequest`, `FillRequestWorkflowService`… son **~570 ocurrencias**
  en unos 60 nombres, y son **invisibles para quien usa la aplicación**. Van en una tanda aparte de
  puro renombre, donde el golden que **no** se mueve es la prueba — al contrario que aquí.
- **Las etiquetas de pantalla «Flujo de entrega» y «Flujo de firmas»** siguen en
  `AdminDraftArtifactModal.vue` y en `HomeView.vue`. Cómo se llaman de cara a la persona es decisión
  del dueño, no de un `sed`: en la prosa publicada ya son *el recorrido* y *la firma*, y la pantalla
  debería decir lo mismo, pero eso se pregunta antes de hacerlo.

### Lo que NO se hizo, y queda dicho

- ~~**`document_workflow_observations` sigue con DOS columnas**~~ y ~~**las claves de la API conservan
  sus nombres**~~ — **los dos se hicieron en el paso 4-bis** (§17), que es justo «ese cambio aparte».
- **`useFlowBuilder.js` sigue enviando `approval_mode` y `required_min`**, que el backend ignora. Lo
  que las mata es quitarlas del formulario.
- **`field_refs` sigue en el contrato HTTP del editor** como literal `[]`, fijado por el golden
  `schema_flow_reread`.
- Y **`verificar_receta_nueva.mjs` se retiró**: comparaba la forma vieja con la nueva, y sin la vieja
  no puede ni ejecutarse.
