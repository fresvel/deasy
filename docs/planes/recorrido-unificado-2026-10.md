# Frente 24 · El recorrido documental, unificado — y el fin de cuatro «plantillas»

> **Estado**: 🟡 en ejecución · **fase 1 de 5 cerrada** · abierto el **2026-10-08** · worktree `deasy-recorrido`, pila **B**
> **Decidido por el dueño** el 2026-10-08 tras el análisis de la decisión 1 de F7.0 (frente 22).

## 0 · Control de ejecución

| # | Fase | Qué entrega | Evidencia | Estado |
|---|---|---|---|:--:|
| **1** | Los tres renombrados | de `deliverables`, `template_artifacts` y `process_definition_templates` a `catalogo_documental`, `ediciones` y `vinculos` | **167 ficheros · 1.664 ocurrencias**; 7 puertas + `test:unit` 897/897 + `test:char:run` 321/321; goldens movidos y **probado que el diff es SÓLO el renombrado**; migración `scripts/migrar-recorrido.sql` aplicada y verificada | ✅ |
| **2** | Muere el escalón 2 | fuera `vinculo_id` de las dos cabeceras **y su `CHECK` de un solo portador**, fuera su campo en `/admin`, fuera el escalón de los dos resolvedores | el resolvedor baja de 3 escalones a 2 (**2 consultas, no 3**, afirmado por unitario); 5 puertas + `test:unit` **899/899** + `test:char:run` **320/320**; migración probada en sus **tres** rutas (mueve 1 cabecera, para con mensaje y **deshace el `DROP COLUMN`**, idempotente); goldens movidos en 5 ficheros y **revisado uno a uno**; `check-mapa-tablas` 100/77/0, `check-doc-modelo` y `check-enlaces-internos` en verde | ✅ |
| **3** | El vocabulario de estado | **un** mecanismo y **un** idioma para los 6 estados; muertas `signature_request_statuses` y las dos `status_id`; un mapa de tonos en vez de dos y un predicado en vez de dos | 5 puertas + `test:unit` **899/899** + `test:char:run` **320/320** + frontend lint y **498** vitest; el diff del golden es **sólo** vocabulario (60 líneas, cada valor retirado con su equivalente y los recuentos cuadrando) más 11 claves renombradas; migración probada en sus tres rutas; de 92 tablas a **91** y de 100 a **98** claves ajenas | ✅ |
| **4** | E1 · la unificación | 6 tablas → 3: `pasos_declarados`, `recorridos`, `turnos`, con `lado` | el resolvedor pasa de 2 funciones a 1 | ⬜ |
| **5** | La documentación publicada | DBML + 8 diagramas + `campos-*` regenerados, y las páginas de prosa reescritas | `check-doc-modelo` y `gen-dbml --check` en verde | ⬜ |

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

## 3 · E1 · Un solo recorrido con dos lados

```
  catalogo_documental ──▶ ediciones ──▶ vinculos (item_mode)
                              │             │
            ┌─────────────────┴──┐          │  item_mode decide DE DÓNDE sale la receta:
            │                    │          │    single / replicated ──▶ origen = edición
            ▼                    ▼          ▼    routed             ──▶ origen = instancia
   pasos_declarados (lado: entrega | firma)
            │  origen: edicion_id XOR task_item_id
            │  UNIQUE parcial por origen, lado y orden   ← la unicidad que NO existía
            ▼  al enviar
      recorridos (document_version_id, lado, estado, paso_actual)
            │
            ▼
        turnos (recorrido_id, paso_id, persona_id, estado)
```

**`routed` no se toca**: es `origen = instancia`. Lo único que desaparece es que tenga que escribir
**dos** anclas a la vez, que es lo que obligaba a las tres guardas `IS NULL`.

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
