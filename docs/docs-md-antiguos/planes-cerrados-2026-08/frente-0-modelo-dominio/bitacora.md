# Bitácora del Frente 0 — el modelo de dominio dejó de contradecirse

> **ARCHIVADO el 2026-08-14. Nada de aquí es tarea.** Es el frente tal y como se ejecutó, movido
> entero desde `docs/planes/plan-maestro-2026-08.md` el día que cerró en **9 de 9**. Se conserva
> porque **el razonamiento vale más que el diff**: aquí están las cuatro cosas que el plan daba por
> buenas y eran falsas, las tres veces que la caracterización estuvo ciega, y por qué cada resolver
> retirado se retiró.
>
> Lo que quedó vivo al cerrar está en el [`README.md`](./README.md) de esta carpeta y **solo ahí**.
> Si buscas trabajo pendiente, vuelve al [plan maestro](../../../planes/plan-maestro-2026-08.md).

---

## Frente 0 · Limpiar el modelo antes de seguir refactorizando — ✅ **CERRADO · 9 de 9** (2026-08-13)

Abierto el **2026-08-09**, y va delante de todo lo demás por un motivo que no es de gravedad sino de
orden: **el resto del plan refactoriza sobre un modelo que todavía se contradice a sí mismo**. Mientras
eso siga así, cada decisión técnica se toma sobre arena.

El diagnóstico de fondo, en una frase: **el código contiene su propia necrológica y la desmiente a la
vez.** El caso testigo es `document_owner`, declarado retirado en un comentario y vivo 250 líneas más
arriba en el mismo fichero. No es anécdota: un agente con acceso completo al repo leyó ese comentario,
lo dio por bueno, y salió con el modelo equivocado. Hizo falta consultar la base de datos para verlo.

**Lo que NO es este frente:** no es reescribir el modelo ni cambiar el diseño. La migración que se
quiso hacer —de «el código YAML siembra la base» a «la web/base manda y genera el código»— **está
hecha**, y `workflowSync.js` es el materializador del modelo NUEVO, no un resto del viejo: el
`meta.yaml` que lee **lo acaba de escribir el formulario web**. Lo que queda son residuos concretos.

> **Progreso (2026-08-10).** La limpieza se ejecuta en **cuatro pasos**, cada uno con sus commits y
> sus pruebas. **Pasos 1 y 2 cerrados**; quedan el 3 y el 4.
>
> | Paso | Qué | Estado |
> |---|---|---|
> | 1A | El eclipse de alias del propietario (§0.1) | ✅ `0790c7c` |
> | 1B | `NOT EXISTS(documents)` → `user_started_at IS NULL` en los 4 guards del relevo | ✅ `fcaeea6` |
> | 2 | Retirar el documento suelto (`origin_type` y su camino) | ✅ `c811bbb` |
> | 3 | Eliminar `documents.owner_person_id` (un solo «quién») | ⬜ **aplazado tras §0.8** |
> | 4 | Fusionar `task_items` con `documents` | ⬜ **aplazado tras §0.8** |
>
> **Reordenado el 2026-08-10.** Los pasos 3 y 4 se aplazan detrás de **§0.8, invertir la dirección del
> flujo**. Motivo: al planificar el paso 3 se propuso *editar el `meta.yaml` del bootstrap* para
> cambiar un resolver — es decir, se planificó **dentro de la dirección que el diseño elimina**. La
> inversión va primero; después, §0.2 y §0.3 se cierran casi solas.
>
> **Restricciones vigentes de esta tanda:** no se toca `frontend/`, y al terminar **no queda ningún
> alias ni parche de compatibilidad** — ni `documents` como vista, ni `documentId` como alias. Diseño
> limpio o nada. Aviso: el paso 4 **sí** tocaría el frontend (unos 5 sitios usan `documentId` como
> señal de existencia), así que habrá que replantear su alcance al llegar.
>
> **Nota de método:** el contenedor `deasy-dev-backend-1` puede estar montado sobre **otro worktree**.
> Comprobarlo con `docker inspect` antes de fiarse de cualquier resultado de prueba — dos corridas se
> midieron contra código ajeno antes de detectarlo.

### 0.1 · El propietario del entregable se resuelve con el puesto equivocado — ✅ **CERRADO (`0790c7c`)**

**Confirmado con datos de dev el 2026-08-09.** `getTaskItemsForDocumentMaterialization`
(`backend/services/admin/generation/queries.js:375`) selecciona `t.responsible_position_id` —el de la
**tarea**— cuando `task_items` **tiene su propia columna con el mismo nombre**. El alias la eclipsa en
silencio, y `resolveOwnerPersonIdForTaskItem` (`services/admin/generation/documents.js:127`) cree
estar leyendo la del entregable.

| item | puesto del **ITEM** | puesto de la **TAREA** | dueño del documento | ocupa el puesto del ITEM |
|---|---|---|---|---|
| 2 | **25** (Docente) | 21 (Coordinador) | **24** | **3** |

O sea: **el entregable del Docente acabó en la bandeja del Coordinador**. La consulta ya trae
`ti.target_position_id` (`queries.js:373`) y el resolver **nunca lo mira**.

**Cómo se arregló:** con `ti.responsible_position_id` **a secas, sin `COALESCE`** — y de paso se quitó
el `LEFT JOIN tasks`, que quedaba sin uso. El respaldo a nivel de tarea **ya existía aguas abajo** y
estaba tapado (rama 4 de `resolveOwnerPersonIdForTaskItem`, y rama 2 de
`resolveOriginUnitIdForTaskItem`, que además prefiere `t.scope_unit_id`, más correcto que la unidad del
puesto). Un `COALESCE` habría duplicado esas ramas dentro del camino genérico.

Medido con el pipeline real antes y después: `{"item":2,"ti_pos":21,"owner":24}` →
`{"item":2,"ti_pos":25,"owner":3}`. **Ningún golden se movió**, que es lo esperado: el defecto no era
observable por HTTP. La red es un unitario nuevo (`generation/documents.test.js`) cuya conexión falsa
**emula el eclipse** —devuelve el valor del ítem o el de la tarea según el alias del SELECT—, así que
5 de sus 6 casos fallan contra la consulta vieja.

> La única lectura bajo la que esto sería intencional es que el dueño del documento deba seguir al
> responsable de la **tarea** y no al del **entregable**. El código no la sostiene: la función se llama
> `…ForTaskItem` y su cascada ya cae a «cualquier asignación de la tarea» cuando falta el dato de ítem.

### 0.2 · ¿Hace falta el resolver `document_owner`? — ✅ **CERRADO (`94c56c4`)**

**Respuesta: no hacía falta, y ya no existe.** Se retiró del `CHECK` en el sub-paso 8 del §0.8, junto con los otros cuatro que la web no autora. Medido: **cero `document_owner` en la base**. La columna `documents.owner_person_id` **sigue viva** — es otra cosa, y la usan los guards de permisos.

**Hoy no se puede quitar**, aunque convenga: en los casos repartidos por puesto `task_assignee`
devuelve **NULL**, porque `task_items.assigned_person_id` está vacío y la caída es a
`tasks.created_by_user_id`. **Los dos resolvers están rotos por la misma causa de 0.1.**

Con 0.1 arreglado, `task_assignee` cubre el 100 % de los casos **y mejora**: pasa de *early-binding*
(el dueño se congela al crear el documento y no se entera de las reasignaciones por vacante) a
*late-binding*.

- `document_owner` **no es autorable desde la web**: `WEB_FILL_RESOLVER_TYPES_BY_SCOPE`
  (`services/admin/templates/workflows.js:34-37`) solo admite `task_assignee` y `cargo_in_scope` en
  `official`. Sí aparece en el CRUD genérico de tablas (`config/sqlTables.js:707`, `:847`), pero
  **cualquier edición ahí la borra el siguiente sync** (`workflowSync.js:240` hace `DELETE`+`INSERT`).
- **Aviso importante:** la **columna** `documents.owner_person_id` **se queda**. La usan los guards de
  permisos (`ChatAuthorizationService.js:63-77`, `user_controler.js:422,469,522`), que leen la columna
  y **no el resolver**. Lo que sobra es el resolver homónimo.

### 0.3 · `BASE_META_YAML`: la puerta trasera del bootstrap — ✅ **CERRADO (`30654db`)**

Retirado en el sub-paso 7 del §0.8, con su subida y el fósil `seeds/informe-general/workflow.yaml`. Criterio cumplido y medido: **el vínculo del Proceso por defecto pasa de 1 flujo a 0**, y no queda ni un `meta.yaml` bajo `System/tpl_informe_general/`, así que **la auto-replicación por copia binaria está muerta**.

`services/system/SystemBootstrapService.js:277-305` es un `meta.yaml` **escrito a mano como literal de
código**, subido en `:389`. Es **el único productor vivo de `document_owner`** y contradice la regla
del modelo nuevo («todo se autora por CRUD»). El comentario de `:553` dice que el atajo se retiró
(P1.4): **retiró un sitio y dejó este**.

Y **se auto-replica**: `createTemplateArtifactVersion` (`templateArtifact.js:362-368`) copia MinIO en
binario, así que la v1.1.0 heredó el `document_owner` de la v1.0.0 sin pasar por la web. Cada versión
nueva lo arrastra otra vez.

**Criterio de cierre:** el proceso por defecto se siembra por el mismo camino que todo lo demás.

### 0.4 · El generador: de la base al Jinja, para que la firma no se coloque a mano — ✅ **CERRADO (2026-08-13)** · el S8 se movió al frente 10

**El objetivo, en palabras del dueño (2026-08-13).** Esta ficha estaba mal enfocada: decía que el fin
era «descargar una base con los valores configurados». El fin real es otro, y explica todo el frente 0.

Deasy sostiene **dos mundos a la vez**, y va a seguir así:

- **El de hoy, y será la mayoría.** Automatizar todos los trámites de la institución es imposible: son
  cambiantes y variables. Así que un proceso recurrente se configura, se le **precarga su plantilla
  Word/Excel**, el responsable la descarga, la rellena fuera y **sube el PDF**. El sistema no genera
  nada: **controla quién entrega qué, lo almacena, y le pone encima el flujo de llenado y firmas** —
  preconfigurado en la base, resuelto en ejecución. **Eso es lo que el §0.8 acaba de dejar en su sitio.**
- **Al que se migra proceso a proceso.** El admin mide cuáles son cuello de botella, cuáles dan más
  problemas y cuáles producen más documentos —*lo que no se mide no mejora*— y decide **cuál automatizar**.
  Un proceso automatizado deja de necesitar Word: el usuario rellena **en la web** y el sistema
  **compila el PDF**.

**Y aquí entra el Jinja.** El PDF compilado tiene que llevar **los tokens de firma ya puestos**, «para
que se estampen las firmas necesarias **sin que el usuario coloque de manera manual la ubicación**».

> **Ése es el fin del §0.4, y no «rellenar valores».** La cadena que lo hace posible **ya existe
> entera del lado que firma**: `persons.token` → `formatTokenForSigner` → `signType: "token"` →
> `signer/find_marker.py`, que localiza el literal en el texto del PDF y devuelve página y coordenadas.
> El seed ya lo imprime en blanco para que sea invisible y extraíble. **Lo único que falta es el
> eslabón que emite el token en el sitio correcto.**

**La dirección, confirmada:** *«antes se llevaba la lógica del jinja a la base y eso fue burdo;
ahora, de la base al jinja»*. El §0.8 hizo lo primero (la base es la fuente); el §0.4 es lo segundo.

#### Lo que se decidió el 2026-08-13

- **El generador emite campos Y tokens de firma**, y deja el esqueleto para que los campos se
  almacenen como **JSON en la base**.
- **El YAML sale del camino.** Se comprobó que el render **ya lee JSON** (`make.sh` mira la extensión:
  `.yaml`/`.yml` → `yaml.safe_load`, si no → `json.load`); lo único que no lo encuentra es la búsqueda
  de fichero, que no lista ningún `.json`. **Importa porque el backend no tiene parser de YAML** desde
  el sub-paso 8 — con el payload en JSON puede **construirlo de verdad**, fusionando los defaults del
  seed con los valores configurados y los huecos de token, **sin dependencia nueva**.
- **`field_refs` queda confirmado obsoleto.** Era el mecanismo de «enviar los campos de llenado a la
  base» que el dueño da por superado. Coincide con su clasificación como fósil sin productor.

#### Los sub-pasos

| # | Qué | ¿Reversible? |
|---|---|---|
| ~~S1~~ | ✅ **HECHO (`49d41ce`, con S5).** Medido, no deducido: `make.sh` pasó de `rc=1` con `'bibliography_style' is undefined` a **un PDF de 2 páginas — y con los tokens de firma dentro** (`!-9b6D6WnuUE-!`). El segundo defecto también: el `content_hash` se movía al editar **sin que cambiara nada del paquete**. ~~El ZIP de una plantilla creada por la web NO compila~~: `data.yaml` se escribe en la raíz del prefijo y el ZIP solo lleva `template/jinja2/`, así que no viaja — y `StrictUndefined` revienta antes de LaTeX. **El admin lo usa hoy.** Además, en edición sin cambio de seed el fichero no se re-materializa y **manifiesto y bucket derivan** | Sí |
| ~~S2~~ | ✅ **HECHO (`7c3e38d`).** ⚠️ **La caracterización era ciega**: anular el lector entero daba **281/281 en verde**, porque el único caso que llega al endpoint descarta `fields` del golden a propósito. La red tuvo que ser unitaria. ~~El `catch {}` mudo de `getTemplateArtifactSchema`~~: el editor carga sin campos **y el siguiente guardado escribe `{}`**. Es el mismo borrado silencioso que el sub-paso 5 del §0.8 quitó del lector de flujo, en el mismo fichero | Sí |
| ~~S3~~ | ✅ **HECHO (`3e79282`).** Probado contra la pila viva: antes, un `payload.sh` por el campo `pdf_file` llegaba a MinIO con **200 OK**; ahora **400** con su motivo. **El gate es la extensión, no el mimetype** — la extensión es lo que decide el nombre del objeto. Y `sql_admin_router.js` **no tenía montado `uploadError`**: sus límites de multer se disparaban y Express contestaba HTML con el stack. ~~El `fileFilter` que falta.~~ Hoy un `.sh` subido por el campo `pdf_file` acaba en MinIO **y el ZIP le pone modo 0755** | Sí |
| ~~S4~~ | ✅ **HECHO (`6f381d7`).** Alcance decidido con criterio: **solo `Contenido/` y solo `.j2`**. `Preambulo/` es zona protegida y su SHA-256 tiene que casar con el manifiesto, así que validarlo sería **rechazar contenido que el usuario no escribió y no puede arreglar**. Las expresiones `{{ }}` no se comprueban a propósito: son llaves normales en LaTeX. ~~Balance de bloques Jinja al subir,~~ con los delimitadores reales `[[% %]]`. No es un parser, y hay que decirlo | Sí |
| ~~S5~~ | ✅ **HECHO (con S1).** El render **ya sabía leer JSON** (mira la extensión); lo único que fallaba era la búsqueda, que no listaba ninguno. Ahora `data.json` va **primero**. El paquete conserva el `.yaml` hasta que exista el generador, a propósito. ~~El payload pasa a JSON~~: `data.json` en la búsqueda de `make.sh` | Sí |
| ~~S6~~ | ✅ **HECHO (`38c2b56`+`351a391`).** **Una fila por campo**, no un `jsonb`: un JSONB cierra la copia binaria pero **no la validación ni el orden**, que son los dos que el generador necesita — y el §0.6 ya midió que **un `CHECK` no cubre un JSONB**. Escritura doble a la base y a `schema.json`, versionado copiando **filas** (patrón de `flowRows.js`). **Los seis tokens del seed ya son consultables por SQL.** ~~Los campos a la base, como JSON.~~ El esqueleto que pidió el dueño. Hoy viven solo en `schema.json` de MinIO, **sin tabla**: no se pueden validar contra nada, se copian en binario al versionar, y un fallo de MinIO los borra | **No** |
| ~~S7~~ | ✅ **HECHO (`5ee3b5d5` + `441ef062`).** ⚠️ **El diagnóstico de esta ficha era erróneo, y lo demostró la prueba por mutación.** Decía «reordenar renumera los slots»; medido contra la base, **reordenar conservando el `code` ya funcionaba** —el editor reenvía el `code` que el lector le dio, así que la identidad ya viajaba en la carga útil—. El defecto real era la **acuñación**: insertar un paso en el orden 2 de una plantilla con tres producía **dos filas con `slot = firma_2` y un 200**, o sea dos firmantes compartiendo el token del `.tex`, en silencio y con valor legal. Arreglado acuñando **el primer `firma_N` que nadie haya reclamado**, no el de la posición. Hicieron falta **dos mutaciones distintas** para poner los tests en rojo, y ahí se vio que preservación y acuñación eran mecanismos separados con **solo uno roto**. Y la unicidad pasó de promesa a propiedad: índice único **parcial** sobre `(template_id, slot) WHERE slot IS NOT NULL` — parcial porque los pasos de entrega no llevan slot, y **`uq_signature_flow_steps` vigilaba la POSICIÓN**, no el slot. ~~El slot es `firma_<orden>` porque el formulario nunca pone `code`~~ | **No** |
| ~~S8~~ | ➡️ **MOVIDO al frente 10 (2026-08-13).** No es limpieza, es **construcción**, y su mitad de ejecución **depende del compilador**: emite macros que algo tiene que rellenar con el token del firmante resuelto. Se queda con la pieza de la que depende, no en el frente que lo destapó | — |

> **Tres cosas que costaron aprenderse y no se deducen del código:**
>
> 1. **La caracterización fue ciega TRES veces seguidas** en este frente — anular el lector de campos,
>    el escritor de campos o el lector de schema daba **verde**. Ningún flow manda `schema_fields`.
>    **Aquí la verificación que manda no es un test: es compilar el ZIP y mirar el PDF.**
> 2. **El defecto del orden era peor de lo descrito**: las claves enteras no solo van primero, se
>    ordenan numéricamente entre sí, y **la corrupción ocurre al ESCRIBIR** — `schema.json` ya sale mal
>    del disco.
> 3. **Los 18 campos del seed no llegan por el formulario**: el bootstrap publica el fichero y guarda
>    solo el puntero. **La misma forma que `BASE_META_YAML`**, que costó todo el frente 0. Se siembran
>    ahora, solo si la tabla está vacía.

⚠️ **S7 era prerequisito de S8**: sin identidad estable, el generador emite código que caduca al
reordenar un paso. **Cumplido** — el S8 se llevó al frente 10 con su prerrequisito ya cerrado.

### 0.5 · El vocabulario del entregable — ✅ **CERRADO (`f5cf457`)**

El glosario ya existía en el sitio, pero **colapsaba «Plantilla» en dos tablas** y borraba justo la distinción que más tiempo cuesta. Ahora distingue los cuatro nombres —tipo, edición, vínculo e instancia— con la cadena completa `seed → deliverable → template_artifact → (vínculo) → task_item → document → document_version`, y un aviso sobre que **`documents` no guarda ningún fichero**.

**Trampa aprendida y escrita en `trocear.mjs`:** la conversión LaTeX→Markdown es **de un solo sentido**. Trocear deja *anclas*, no diagramas; los 15 Mermaid se escribieron a mano después. Regenerar sobre lo publicado **los pierde en silencio** — `verificar.sh` sigue verde porque cuenta anclas, y el sitio compila igual. Para una corrección puntual: editar el `.tex` y **replicar a mano en el `.md`**.

**Cuatro nombres, cuatro cosas distintas.** No es sinonimia, y confundirlos es la primera fuente de
error al leer este repo:

| Nombre | Qué es | Tabla |
|---|---|---|
| `deliverable` | El entregable como **tipo**: identidad, código y dueño | `deliverables` |
| `template_artifact` | Una **edición** de ese tipo, con sus ficheros en MinIO | `template_artifacts` |
| `process_definition_template` | El **vínculo** configuración↔edición. **Aquí vive `item_mode`** | `process_definition_templates` |
| `task_item` | La **instancia con dueño**: lo que una persona debe entregar | `task_items` |

`artifact` a secas **no es una entidad**: es abreviatura de `template_artifact`. Y hay un quinto
eslabón antes de todos: `template_seed`. La cadena completa es
**seed → deliverable → template_artifact → (vínculo) → task_item → document → document_version**.

Dos cosas que los datos de dev revelan y hay que decidir:

- **Un vínculo puede apuntar a una edición RETIRADA.** Hoy el vínculo 1 usa la v1.0.0 `retired`
  mientras la v1.1.0 está `published` en otro proceso — y de ese vínculo salen **los tres entregables
  del sistema**. ¿Debe permitirse? ¿Publicar una edición debería arrastrar los vínculos?
- El mismo entregable enlazado dos veces **con modos distintos** (`routed` y `single`). Esto **sí
  funciona como debe**: confirma que `item_mode` es del vínculo, no de la plantilla.

Los estados también tienen tres convenciones conviviendo (`"Pendiente de llenado"` en prosa castellana,
`"pendiente"` snake castellano, `"pending"` snake inglés) y **se filtran al frontend**. Cierre del
punto: un **glosario** concepto → nombre canónico en código → tabla → literal de estado.

### 0.6 · Censo de fósiles del camino viejo — ✅ **CERRADO (`f5fa889`+`92e7e21`+`2c1b17f`)**

Los 18 elementos del censo, **cada uno con veredicto escrito**: retirados, conservados con lápida, o «no era fósil». El criterio de cierre no era retirarlo todo, sino que ninguno quedara sin decidir.

**Y dos hallazgos que valieron más que el cambio:**

1. **Los `case` de firma NO estaban muertos.** `parseStepSigners` saca el resolver del **JSONB `signers`** sin filtrarlo, y **un `CHECK` no cubre una columna JSONB**. Ningún productor vivo puede emitir un tipo retirado, pero una fila legada sí lo lleva **y se auto-propaga a cada versión nueva**. Borrarlos habría mandado el paso al `default` con el cargo a `null`: **no firmaría nadie, y en silencio**.
2. **Al CRUD le faltaba un valor, no le sobraba.** El censo decía que omitía los `context_*`; lo que faltaba era **`context_exact`**, el valor por defecto que autora el formulario. Su gemela de firma sí lo tenía — la asimetría era el fallo.

Cosas que el YAML/CLI sembraba y la web no puede producir ni editar. **Cada una necesita una decisión
—retirar o cablear—, no un refactor.** Verificadas el 2026-08-09:

| Elemento | Estado |
|---|---|
| `seeds/informe-general/workflow.yaml` | **Fósil entero: nadie lo parsea.** `SystemBootstrapService.js:387` lo excluye. Sus `field_refs` usan rutas punteadas y el `schema.json` hermano usa claves planas — convenciones incompatibles |
| `source: "artifact"` | **Muerto** (write-only): lo escriben 4 sitios, **cero lectores**, y no hay columna |
| `field_refs` | **Fósil**: no existe columna, el frontend lo fija a `[]`, ningún consumidor runtime |
| `anchor_refs` | **Fósil con columna viva**: se escribe siempre `[]`, se lee en `DocumentSignatureWorkflowService.js:177,207` y no se consume. Sustituido por slots/token |
| `position` (resolver) | **Muerto**: nadie lo escribe. `assignees.js:153` es rama inalcanzable |
| `manual_pick` | **Vivo solo como fallback** de tipo desconocido (`workflows.js:236`); devuelve `[]` |
| `render_engine`, `payload_object_path` | **Muertos**: nadie les asigna valor; solo se copia el `NULL` de versión en versión |
| `sync_mode` | **Vivo pero constante degenerada**: gate real que nunca vale otra cosa |
| `can_reject` del YAML | **Fósil parcial**: el valor se deriva del orden e ignora el input |
| `dependencies:` | **Fósil con guardián**: solo se comprueba por regex que la línea exista |
| `unit_scope_type` `context_*` | **Implementados en runtime, no emitibles desde la web**; y el CRUD crudo (`sqlTables.js:713`) omite justo los `context_*`, que sí están en el `CHECK` |
| Claves de `defaults.yaml` (`brand_rgb`, `palette`, `layout*`…) | **Vivas pero fuera del CRUD**: las consume el render LaTeX y **el usuario no puede tocarlas desde la aplicación**. Misma familia de dolor |

Y un bloque que sería inejecutable aunque se leyera: las firmas de `workflow.yaml:74-104` ponen
`required_cargo_code` **a nivel de paso**, y el único lector lo busca **dentro** del resolver/firmante.

### 0.7 · La documentación miente en dos direcciones — ✅ **CERRADO (2026-08-11)**

Corregidas **34 afirmaciones falsas** que dejó nuestro propio trabajo y **10 desfases anteriores**, en el sitio, `CLAUDE.md`, `docs/arquitecturas/`, `docs/03-backend/` y `docs/planes/referencia/`. Los dos roadmaps de marzo **se archivaron** en vez de corregirse: eran actas fechadas, y el segundo se presentaba como «el estado real actual del código».

**El hallazgo que salvó el trabajo:** `docs/arquitectura-deasy.tex` **es la fuente** de las 21 páginas de `explicacion/`. Corregir solo los `.md` habría dejado la mentira en el origen, y la siguiente conversión la habría reintroducido entera.

**Y la prueba de por qué este frente existe:** entre el barrido y la ejecución, con horas de diferencia, las cifras **volvieron a moverse** — los unitarios pasaron de 446 a 523 por nuestros propios commits.

**30 desfases en 7 ficheros**, y no son ruido uniforme:

- **~14 dicen «pendiente» y están hechos** (servicios de flujo, paneles de firma, centro documental,
  observaciones, el editor de flujo runtime). **Abrir esos documentos buscando qué falta enseña una
  montaña ya escalada.** Es el desfase que más desmoraliza.
- **~7 dicen «vigente» o «hecho» y no lo están** — mandan a trabajar sobre cosas que no existen: un
  `artifact_stage` de cinco estados (la columna real es `lifecycle_state` con tres), endpoints
  inventados, un `usage_role` inexistente.
- **~9 son rutas y símbolos muertos**, con citas `fichero:línea` a un fichero que hoy tiene 36 líneas.

**Tres documentos se contradicen a sí mismos dentro del propio fichero**, sin fecha ni tachado: gana el
párrafo que se lea primero. `referencia/patrones-diseno.md:135-138` llega a tener una cifra
**invertida** (dice 31 ficheros importando axios crudo y 2 el `httpClient`; es exactamente al revés) dos
párrafos después de declararlo resuelto.

**Lo urgente y barato:** `CLAUDE.md:212` afirma que el `document_owner` sembrado «se retiró». **Es
falso** (ver 0.3), y es el único desfase que se propaga activamente a todo el que llega al repo.

**Criterio de cierre:** un documento de modelo vigente en `docs/arquitecturas/`, las actas de sesión
fechadas archivadas en `docs/docs-md-antiguos/`, y `CLAUDE.md` corregido.

### 0.8 · Invertir la dirección del flujo: la base manda, el YAML se va — ✅ **CERRADO en backend (2026-08-11)** · queda el sub-paso 9, que es frontend

**La doctrina, en palabras del dueño:** *«El `meta.yaml` YA NO DEBE INFLUIR SOBRE EL FLUJO. Todo se
modela primero en la base de datos y de la base de datos se va al YAML, no al revés.»*

Hoy **no se cumple en ninguna plantilla**, y no por descuido: por una razón estructural.

#### Por qué el YAML sigue vivo

Hay **exactamente dos** escritores de `fill_flow_steps` / `signature_flow_steps`:

| Escritor | De dónde saca el flujo |
|---|---|
| `services/admin/templates/workflowSync.js:246,304` | **Del `meta.yaml` de MinIO** |
| `services/admin/generation/documents.js:258,288` (`materializeRuntimeFlowForTaskItem`) | **Directo de la base** |

**El flujo de runtime (`routed`) ya cumple la doctrina. El de las plantillas no.** El formulario web
no escribe la base: escribe el `meta.yaml`, lo sube a MinIO y el sync lo proyecta con `DELETE`+`INSERT`.

Y la causa de fondo está en el esquema: **las tablas de flujo cuelgan del VÍNCULO, no de la plantilla.**
`fill_flow_templates.process_definition_template_id` es `NOT NULL` (`postgres_schema.sql:825`; firma en
`:919`) y **no existe ninguna columna `template_artifact_id`**. El formulario autora **un** flujo para
una plantilla y el sync lo abanica a los N vínculos. **El `meta.yaml` es el único sitio donde vive esa
copia única.** Para quitarlo hay que darle un portador en la base.

#### La doctrina ya se rompe, y se ve

El sync **no mira `item_mode`**: proyecta sobre todos los vínculos, incluido el del Proceso por
defecto, que es `routed` y cuyo propio bootstrap declara que **no siembra flujo**
(`SystemBootstrapService.js:545-547`). En la base de dev:

```
 id | vinculo | description                                    | item_mode
  2 |       1 | artifact_sync_fill:1:tpl_informe_general:1.0.0  | routed   ← no debería existir
  4 |       3 | artifact_sync_fill:2:tpl_informe_general:1.1.0  | single
```

Ese es el `document_owner` de §0.2 y §0.3. La v1.1.0 lo heredó por la copia binaria de MinIO, **sin que
nadie lo autorara**.

#### El `meta.yaml` no tiene otra razón de ser — verificado

**No hay motor de render en el repo** (cero `pdflatex`/`latexmk`/`jinja2.Environment`). El `signer/`
no lee YAML. Ningún script lo toca. **No sale en ninguna descarga**: vive en la raíz del prefijo y los
ZIP solo empaquetan `template/jinja2/`. Sus otras seis claves son copias literales de columnas de
`deliverables`, `template_artifacts` y `template_seeds`.

**Y los tokens de firma ya están en la base.** El diseño está escrito en `workflows.js:180-182`:
*«cada paso lleva su SLOT de token (= su code); el jinja generado embebe ahí el token del firmante
resuelto (`{{ signatures.<slot>.token }}`)»*. `slot` **es columna** (`postgres_schema.sql:937`) y se
lee en runtime. `anchor_refs` (`:950`) es su **predecesor muerto** — el «Sin anclas» del comentario—:
se escribe siempre `[]` y no se consume.

**Efecto colateral que se arregla solo:** los cuatro gates que deciden si una plantilla se puede
publicar leen el meta de MinIO con un `catch {}` mudo (`templateArtifact.js:224,278`;
`templateLifecycle.js:248,920`). Hoy **un MinIO caído se traduce en «esta plantilla no define flujo» y
bloquea la publicación por una razón falsa**. Contra la base ese modo de fallo desaparece.

#### Decisiones tomadas (2026-08-10)

1. **Los seis que se quedarían sin productor SE RETIRAN.** Hoy el YAML es lo único que puede crear
   `document_owner`, `specific_person` en plantillas *official*, `position`, `manual_pick`, y los
   ámbitos `context_subtree` y `context_ancestor_type`. La web solo autora `task_assignee` y
   `cargo_in_scope` con tres ámbitos (`workflows.js:34-42`). **Criterio: lo que la web no autora, no
   existe.** Esto convierte §0.6 de censo opcional en **requisito bloqueante** del sub-paso 7.
2. **El `meta.yaml` se elimina del paquete**, no se conserva generado. Nada lo lee, y mantenerlo
   obligaría además a rechazarlo explícitamente al re-subir un ZIP o vuelve la grieta.
3. **`schema.json` es tema aparte, y es más grande.** Los campos del formulario **no tienen tabla** —
   comprobado: no existe ninguna `template_fields` ni equivalente; viven solo como fichero en MinIO
   (`template_artifacts.schema_object_key`, `:526`). Son justo los que el PDF autogenerado sustituiría.
   Modelarlos exige diseñar tipo, obligatoriedad, orden, agrupación y valores por defecto. **No entra
   aquí**: duplicaría el tamaño del cambio y escondería los dos.
4. **Cuando exista el generador de código base (§0.4), leerá de la base.** Campos y slots en la base,
   contrato Jinja en MinIO. El YAML no participa en ninguno.

#### El diseño objetivo

**Portador: el artifact.** Añadir `template_artifact_id INT NULL` a las dos cabeceras de flujo
(`fill_flow_templates` y `signature_flow_templates`; los **pasos no se tocan**, ya cuelgan de su
cabecera) y relajar `process_definition_template_id` a `NULL`. Quedan tres portadores:

- `task_item_id` → flujo de runtime (`routed`) — **ya existe y ya funciona**
- `template_artifact_id` → **el flujo autorado de la plantilla** (nuevo)
- `process_definition_template_id` → el del vínculo

> ⚠️ **Los tres NO son excluyentes, y una versión anterior de este documento decía que sí.** Corregido
> el 2026-08-10 tras medirlo: `materializeRuntimeFlowForTaskItem`
> (`services/admin/generation/documents.js:248` y `:278`) escribe **el vínculo Y el `task_item_id` en
> el mismo `INSERT`**. En la base, la cabecera de runtime lleva los dos (`vinculo=1, task_item_id=1`).
>
> Es decir: **`task_item_id` no sustituye al vínculo, lo afina.** La fila dice «pertenezco al vínculo 1
> **y además** soy específicamente para el entregable 1»; la segunda etiqueta estrecha la primera, no
> la cancela.
>
> **Consecuencia práctica, y es la que importa:** la resolución del flujo es **por PRIORIDAD, de lo más
> específico a lo más general** — nunca «mira cuál de las tres columnas está rellena», que es lo que
> sugería la redacción vieja y habría roto el camino `routed`. Y por eso **no se puso un `CHECK` de
> «exactamente uno»**: habría reventado el día uno.

El runtime (`generation/queries.js:192-220` y su gemela de firma) gana un **tercer escalón detrás de
los dos actuales**, sin tocar el orden existente: `task_item` → vínculo → artifact del vínculo.

*Descartado:* escribir N filas, una por vínculo. Reproduce el problema del sync —N copias que
reconciliar— sin el YAML de por medio. El punto de la inversión es que haya **una**.

**Validación: se queda igual.** `_validateAuthoredWorkflows` (`templateLifecycle.js:1033-1098`) **ya
valida contra la base** que cargos, unidades, puestos y personas existan. Pasa de guardia previo al
upload a guardia previo al `INSERT`: mismo sitio, semántica más fuerte.

**Transacción:** `saveTemplateArtifactDraft` no tiene una — usa compensación manual con pila de
deshacer (`:1633-1642`). El flujo **no puede escribirse así**: hay que extraer un
`replaceAuthoredFlowForArtifact(connection, artifactId, …)` y meterlo en la misma transacción que el
UPSERT de `template_artifacts`.

#### ⚠️ Lo que el primer intento del sub-paso 3 destapó (2026-08-11)

Se intentó la inversión, **se paró antes del punto de no retorno y no se commiteó nada**. El agente hizo
la mitad reversible —quitar la sección `workflows:` del meta— para **medir a quién le duele**, midió
12 pruebas en rojo, revirtió y dejó el árbol en verde. Ese informe valió más que el código.

**Cuatro cosas que este documento daba por buenas y son falsas:**

1. **«El `meta.yaml` no tiene otra razón de ser… sus otras claves son copias de columnas.»** Falso, y
   es el error de fondo: se comprobaron las claves de arriba y **no se miró dentro de los pasos**.
   `fill_flow_steps` **no tiene `code`, `name` ni `field_refs`**; `signature_flow_steps` sí tiene los
   tres. **El nombre que el usuario escribe en cada paso de entrega vive solo dentro del YAML.**
   Invertir sin más lo pierde. → resuelto con el sub-paso **1-bis**.
2. **Falta un lector, y no estaba en ninguno de los ocho pasos.** `GET /admin/sql/template_artifacts/:id/schema`
   (`templateArtifact.js:123-181`) reconstruye el flujo **desde el `meta.yaml`**, y es lo único que
   rellena el editor al reabrir una plantilla (`useAdminDraftArtifactFlow.js:119`). Medido: quitada la
   sección, guardas un paso y al reabrir sale **vacío**.
3. **Los sub-pasos 3 y 4 no eran separables.** Los cuatro gates de publicación leen
   `meta.workflows.fill.steps`; sin la sección, **ninguna plantilla guardada por el formulario se puede
   publicar ni activar**, y con ella cae su configuración. Tres de las 12 rojas eran del **grupo de
   control** `runtime_*` — no porque se tocara el runtime, sino porque la configuración nunca llegaba a
   activarse.
4. **El escalón 2 tapa al 3.** Lo ya sembrado en el vínculo por el sync gana al flujo de la plantilla.
   Durante la escritura doble no importa (el contenido es el mismo), pero **el día que se deje de
   emitir el meta, esas filas se quedan rancias y siguen ganando**: hay que vaciarlas en el desmontaje.

**Y la lección de método, que es la que evita el quinto agujero:** este plan se escribió leyendo el
código, y el código **no dijo la verdad entera** hasta que se ejecutó. De aquí en adelante, cada
sub-paso que cambie comportamiento se prueba con un **experimento desechable y reversible primero**,
para medir a quién le duele, antes de escribir el cambio de verdad.

> **Y en el sub-paso 5 destapó algo peor que un fallo: un hueco.** El experimento A —anular el lector
> y devolver flujos vacíos— dio **254/254 en verde**. Es decir: **la caracterización era ciega a ese
> lector**; el único caso que lo tocaba fijaba solo las claves de primer nivel. Y el experimento B, con
> una lectura ingenua de las columnas crudas, midió **dos derivas reales**: el valor por defecto de
> `unit_scope_type` filtrándose a todo paso no-cargo, y los `signers` en camelCase donde el formulario
> espera snake_case — lo segundo **habría vaciado todos los firmantes del editor** sin que ninguna
> prueba dijera nada.
>
> **La regla ya se pagó sola en el sub-paso 3.** El experimento midió **4 fallos, y tres no eran del
> cambio**: el limpiador del arnés (`tests/characterization/lib/db.mjs`) solo sabía borrar el flujo que
> cuelga del vínculo, así que la FK del portador nuevo reventaba el `after()` de **tres suites**. Y el
> cuarto —un golden movido— era **consecuencia**: al abortar el primer `after()`, los borradores se
> acumulaban entre suites. **Leyendo el código eso no se ve**, porque el limpiador navega
> `artifact → vínculos → flujos` y el portador nuevo no pasa por ahí. Sin el experimento, habría
> aparecido como tres suites en rojo intermitente **después** de escribir el cambio.

#### Los sub-pasos, reordenados POR LECTOR (2026-08-11)

**Decisión del dueño:** en vez de cortar por el escritor —que obliga a mover todos los lectores a la
vez y abre una ventana en rojo—, **se corta por lector**. El sub-paso 3 escribe en la base **y sigue
emitiendo el `meta.yaml`**; los lectores se mudan de uno en uno; y la sección del YAML **se borra la
última**, cuando ya no la lee nadie.

El precio es **escritura doble temporal**. Es andamiaje explícito, no deuda: mientras dure, las dos
copias salen del **mismo objeto en memoria**, así que no pueden divergir. Y cada paso queda en verde y
es reversible hasta el desmontaje final.

| # | Qué | ¿Reversible? | Qué lo verifica |
|---|---|---|---|
| 0 | ✅ **HECHO (`94500f9`).** Golden que observa el flujo **en la base**, no el hash del paquete. Siete claves, separando el flujo de plantilla del de runtime — este último es el **grupo de control**: si se mueve durante la inversión, tocamos algo que no tocaba. Descubrió que **el lado de la firma de plantilla está vacío en la fixture** (`BASE_META_YAML` declara `signatures: steps: []`), así que el test **autora un borrador propio** con los dos flujos para no nacer ciego | Sí | `test:char:run` 254/254 |
| 1 | ✅ **HECHO (`8f9f1ad`, verificado el 2026-08-10).** `template_artifact_id INT NULL` + FK + índice en las dos cabeceras; `process_definition_template_id` relajado a `NULL`. **Ningún golden se movió** y las columnas se recrean solas tras el `DROP SCHEMA` de char. Aviso para el siguiente `ALTER`: el `CREATE INDEX` va **después** del `ADD COLUMN` — al revés funciona en base nueva y **mata el arranque en bucle** en una ya creada | Sí | `check:imports` · `test:unit` 442/442 · `test:char:run` 254/254 |
| 2 | ✅ **HECHO (`ba7a55d`).** El runtime lee el tercer escalón, **detrás** de los dos actuales, en los dos gemelos (entrega y firma, que siguen simétricos). **Cada escalón exige `NULL` en los portadores de los anteriores** — sin eso la fila de runtime, que lleva dos, se colaría por el escalón del vínculo. El escalón 3 usa **subconsulta, no `JOIN`**: si el vínculo no enlaza edición da `NULL` y no casa con nada. Y exige `process_definition_template_id IS NULL`, porque **las ediciones se comparten entre configuraciones** y sin eso el flujo privado de un vínculo se colaría a los demás. **Probado por mutación**: quitar cualquiera de las dos guardas pone los unitarios en rojo | Sí | `check:imports` · `test:unit` 454/454 · `test:char:run` 254/254, ningún golden movido |
| **1-bis** | ✅ **HECHO (`99fc7c7`).** `code VARCHAR(120)` y `name VARCHAR(180)` en `fill_flow_steps`, con los **tipos copiados de `signature_flow_steps`**, no elegidos. **`field_refs` se descartó**: lo emite el escritor y lo lee el editor, pero **nadie puede darle valor** — el formulario no tiene control que lo escriba, `_writeDraftPackage` regenera siempre el meta (así que un ZIP subido no es puerta de entrada), y el único fichero que lo declara se queda en el catálogo `Seeds/`. Es el gemelo exacto de `anchor_refs`, ya clasificado como fósil. **`slot` tampoco**: es concepto de firma. **Sin índice, a propósito** — son descriptivas, y un paso se localiza por `(fill_flow_template_id, step_order)`, que ya tiene su único | Sí | `test:unit` 460/460 · `test:char:run` 254/254 · ningún golden movido |
| **3** | ✅ **HECHO (`51a3fe2` + `47e5385`).** Escritura doble: el flujo se escribe **en la base** colgando de `template_artifact_id` **y se sigue emitiendo el `meta.yaml` byte a byte igual** (`artifact_draft` y su `content_hash` no se movieron). **Las dos copias salen del mismo objeto**: `buildWorkflowsYaml` se partió en `buildWorkflowsDocument` (el objeto) + `yaml.dump`, y los dos `INSERT` se movieron a `flowRows.js`, del que el sync **delega** — con dos copias, «producen la misma fila» sería una promesa. **Transacción**: `_persistDraftToDatabase` cubre edición → vínculo → flujo; **la pila de deshacer desaparece entera** y queda una variable para el prefijo de MinIO, que ningún `ROLLBACK` revierte. Efecto lateral con test: una **edición** que falla al vincular ahora también deshace el `UPDATE` de `template_artifacts` (antes `registrarDeshacer` no apilaba en edición) | Sí | `test:unit` 479/479 · `test:char:run` 254/254 · el golden **solo gana líneas, cero borrados** |
| **4** | ✅ **HECHO (`c130d3f`).** Los cuatro gates cuentan sobre la base. **El `catch {}` mudo desaparece**: un fallo de base se propaga en vez de convertirse en «esta plantilla no define flujo». Cuentan por **los dos portadores unidos en `OR`** — **andamiaje declarado**, porque hoy *todo* lo que existe llegó por el sync (0 pasos por artifact, 1 por vínculo en los dos artifacts de la fixture): contar solo por artifact rechazaría cualquier plantilla no re-guardada. El segundo término se queda sin productor con los sub-pasos 6, 7 y 8, y **entonces se borra**.<br><br>Dos guardas del `WHERE` que no son adorno: `task_item_id IS NULL` —**medido en psql: sin ella el flujo de RUNTIME solo ya hace pasar el gate**, así que un `routed` «definiría flujo de entrega» en cuanto alguien enviara un entregable— y `is_active = 1`, porque el sync **desactiva cabeceras sin borrarles los pasos**.<br><br>**Los cuatro difieren en la excepción `routed` y NO se igualaron**: los de por-id exigen que **todos** los vínculos sean routed; los de configuración miran el `item_mode` **del vínculo concreto**, así que una plantilla compartida puede quedar exenta en una configuración y exigida en otra. Igualarlas es un cambio de comportamiento, no este sub-paso | Sí | `test:unit` 496/496 · `test:char:run` 254/254 · **ningún golden movido** |
| **5** | ✅ **HECHO (`3330e98` + `59f4049`).** El editor lee el flujo de la base. `readAuthoredFlowForArtifact` devuelve **la misma estructura que `buildWorkflowsDocument`**, así que la equivalencia campo a campo es **por construcción**, no por comparación. Lee por prioridad: artifact → vínculo → **versión padre**; los dos últimos son andamiaje y mueren con 6/7/8. Sutileza que tiene test: lo que decide el escalón es que la cabecera **exista**, no que esté activa — una desactivada significa «el autor quitó el flujo», y con `is_active = 1` en la búsqueda, quitar los pasos de una versión **los resucitaría desde el padre**.<br><br>**El `catch {}` mudo se elimina, y aquí pesaba más que en los gates:** un «flujo vacío» inventado es lo que carga el editor **y lo que el siguiente guardado escribe** — o sea, no era un fallo de lectura silencioso, era **un borrado silencioso**.<br><br>**Regresión real encontrada y cerrada**: versionar daba `steps: []` (editor vacío → guardar → flujo perdido), porque el versionado copia MinIO en binario y no crea filas. La cierra el tercer escalón, que reproduce lo que daba la copia binaria | Sí | `test:unit` 507/507 · `test:char:run` 261/261 · ningún golden movido · **verificado en navegador**, con los pasos y los firmantes cargando |
| **6** | ✅ **HECHO (`11c2ebc`).** `createTemplateArtifactVersion` y `forkDeliverableForConfig` copian **filas**. El origen se busca con **el mismo escalonado que lee el editor** (artifact → vínculo → padre), porque la propiedad buscada es *«la hija nace con el flujo que el editor mostraba para el padre»*: cualquier otro criterio haría que **versionar cambie el flujo**.<br><br>**Las cabeceras de runtime NUNCA se copian**, y la exclusión es **estructural**, no un filtro añadido: las dos consultas del escalonado ya exigen `task_item_id IS NULL`. Copiarlas convertiría la decisión de **un** envío en la definición de todas las versiones futuras.<br><br>**`is_active`**: la hija nace con cabecera activa si hay pasos, y **sin ninguna cabecera** si no los hay — una desactivada en el padre significa «el autor quitó ese flujo», así que la hija asciende y responde lo mismo. **Transacción nueva**: el flujo cuelga del artifact por FK, así que un fallo al copiar dejaría una versión insertada **y sin flujo** — inpublicable e invisible hasta intentar publicarla.<br><br>**Defecto cerrado y probado**: `PATCH .../publish` sobre una versión recién creada pasa de `400 "debe definir al menos un paso de flujo de entrega"` a **`200`**.<br><br>**Y aquí se corta la auto-replicación de `document_owner`**: deja de llegar como bytes copiados de un `meta.yaml` que nadie escribió y pasa a ser **fila explícita colgada del `template_artifact_id`** — contable, auditable y migrable con un `UPDATE`. La herencia en sí muere en el 7 | **No** | `test:unit` 514/514 · `test:char:run` 266/266 · el golden **solo gana líneas, cero borrados** |

> **Dos deudas que el 6 deja listas para retirar, y que a propósito NO se retiraron:**
>
> - **El `OR` de los gates**: medido con el segundo término borrado, char da **266/266**. Pero
>   `BASE_META_YAML` sigue dejando al artifact del bootstrap con flujo **solo** en el vínculo, y char
>   **no lo publica nunca**. **Verde ≠ retirable.** Se retira en el 7/8.
> - **El tercer escalón del lector** (versión padre): con el ascenso anulado, char da **266/266**,
>   incluido el caso de la versión que hereda. Sobra — pero los artifacts versionados **antes** de este
>   commit siguen sin filas propias. Quitarlo es cambio de comportamiento y merece su commit y su golden.
| **7** | ✅ **HECHO (`b5ae001` + `30654db`).** Retirados `BASE_META_YAML`, su subida y el fósil `seeds/informe-general/workflow.yaml`. **Criterio de cierre cumplido y medido: el vínculo del Proceso por defecto pasa de 1 flujo a 0**, y en toda la base **queda cero `document_owner`** — que es el criterio de §0.2 y §0.3, y lo que abrió el frente 0. Tampoco queda ni un `meta.yaml` bajo `System/tpl_informe_general/`, así que **la auto-replicación por copia binaria está muerta**. Tres goldens se movieron, los tres **a vacío**, y ninguna otra clave de `zz_default_process_routed` se tocó.<br><br>**Dos cosas que ninguna auditoría había recogido y que costarán una tarde a quien no las sepa:** `test:char:fixture` **NO purga MinIO** (`reset.mjs db --yes` es solo base), así que el `meta.yaml` viejo sobrevive y **el cambio es invisible** — hay que usar `reset.mjs db storage --yes`. Y **el flujo no lo siembra el bootstrap: lo siembra el reconcile del arranque** (`index.js:215-229`); bootstrap sin reiniciar deja cero flujos.<br><br>**La ventana resultó MENOS grave que lo auditado**, medido: con la plantilla base **no se llega a los dos hooks sin `catch`** —antes interceptan la pared de línea (422) y el guard de borrador (400)—, y el clonado la convierte en aviso no bloqueante. **Lo único que falla de verdad es `POST /template_artifacts/:id/resync` → 400 «The specified key does not exist»**. Documentada en el código con lo medido, no con lo anticipado | **No** | `check:imports` 128 · `test:unit` 524/524 · `test:char:run` 278/278 |

<!-- histórico del bloqueo, conservado porque explica por qué el 7 esperó al 1.14 -->
| ~~7 (bloqueos)~~ | ✅ **Desbloqueado**: el defecto **1.14** (`597cd43`) era su bloqueo — el gate mira el `item_mode` **del vínculo**, y como el clonado lo perdía, el vínculo de la config activa era `single` y exigía un paso de entrega que solo `BASE_META_YAML` sembraba. Con el modo conservado, la exención de `routed` vuelve a aplicar y el 400 desaparece.<br><br>⚠️ **Segundo bloqueo — DECIDIDO el 2026-08-11: se acepta la ventana hasta el sub-paso 8.** Retirar la subida deja `meta_object_key` (**`NOT NULL`**) apuntando a un objeto inexistente, y hay **dos llamadores del sync sin `catch`** (`tableHooks.js:656-663` y `:701-711`): entre el 7 y el 8, **vincular la plantilla base a otra configuración desde el admin revienta la transacción**. Se descartaron las otras dos salidas — dejar la clave vacía choca con el `NOT NULL` y con `sqlTables.js:391`, y hacer que el cargador tolere el objeto ausente **reintroduciría el `catch {}` mudo que los pasos 4 y 5 quitaron a propósito**.<br><br>**La ventana es un préstamo, no una deuda aceptada**: el sub-paso 8 va inmediatamente después y **tiene que cerrarla**, no heredarla | **No** | Bootstrap limpio y `count(*)` de flujos del vínculo por defecto = **0** (hoy 1). Criterio de cierre de §0.3. **Red ya puesta**: `zz_default_process_routed` (`7fa92e9`) |
| **8** | **El desmontaje.** Dejar de emitir `workflows:` en el meta · **vaciar las filas de flujo colgadas del vínculo que sembró el sync** (hallazgo 4: si no, se quedan rancias y siguen tapando al escalón 3) · borrar el andamiaje (`WorkflowSyncService`, endpoints de resync/reconcile/sync-status, `sync_mode`, marcadores, `buildWorkflowsYaml`, **`meta_object_key`**, `anchor_refs`) · retirar el **`OR`** de los gates y el **tercer escalón** del lector, los dos ya medidos como retirables · **retirar los seis resolvers de la decisión 1**.<br><br>🔒 **Obligación heredada del 7, y es criterio de cierre, no un extra:** el 7 dejó abierta a propósito una ventana — `meta_object_key` `NOT NULL` apuntando a un objeto que ya no existe. **Medida al hacerlo, la ventana es más estrecha de lo que se temía**: los dos llamadores sin `catch` no se alcanzan con la plantilla base, y el clonado la degrada a aviso. **Lo único que revienta de verdad es `POST /template_artifacts/:id/resync` → 400 «The specified key does not exist»**, y ese endpoint **desaparece en este mismo sub-paso**. Aun así el 8 **tiene que cerrarla del todo** borrando `meta_object_key`, y dejar una prueba del camino roto. Si el 8 termina y algo de esto sigue en pie, el 8 **no está hecho**.<br><br>Y hereda dos avisos del 7: **`test:char:fixture` no purga MinIO** (usa `reset.mjs db storage --yes` o el cambio será invisible), y **el flujo lo siembra el reconcile del arranque, no el bootstrap** | **No** | `check:imports` **obligatorio** + `test:unit` + `test:char:run`. Los goldens de `artifact_draft` se mueven (cambia `content_hash`) y **ese diff es la prueba**. Y una prueba nueva del camino que el 7 dejó roto |
| **9** | Frontend: quitar badge y botón de sync (~30 L en 3 ficheros) | Sí | `lint` + `test:unit` + navegador |

> **El orden de los lectores no es caprichoso:** los gates (4) van antes que el editor (5) porque son los
> que rompen más ruidosamente —tumban la publicación entera— y porque su prueba ya existe. El editor
> pide navegador, que es más lento de verificar.
>
> **Y el `meta.yaml` no se toca hasta el 8.** Mientras exista la escritura doble, cualquier paso se
> puede deshacer volviendo a leer del YAML.

⚠️ **El sub-paso 8 toca `frontend/`, que está fuera del alcance de esta tanda.** Se deja anotado y se
ejecuta aparte.

⚠️ **Orden crítico en el 7:** `normalizeFillSteps` convierte **cualquier tipo desconocido** en
`manual_pick`, que resuelve a nadie (`workflows.js:236`). Retirar un resolver del catálogo antes de
quitar su productor **degrada los pasos en silencio** en vez de fallar.

#### Qué cae y qué sobrevive

**Cae:** `sync_mode` y sus dos predicados (`artifacts.js:102-112`) · `source: "artifact"` · los
marcadores `artifact_sync_*` y su parser (`artifacts.js:14-100`) · `WorkflowSyncService` entero
(583 L) **salvo `getWorkflowReferenceIdSets`** (`:221-235`), que se muda con la validación · los
endpoints `sync-status`/`resync`/`workflows/reconcile` y el reconcile de arranque (`index.js:215-229`)
· `BASE_META_YAML` · `buildWorkflowsYaml`/`buildStepResolver` (`workflows.js:120-208`) ·
`ARTIFACT_WORKFLOW_CONTRACT` y el regex de `validatePackagedArtifactDraft` · `meta_object_key` ·
`anchor_refs` · `seeds/informe-general/workflow.yaml` (ya muerto, se borra por higiene).

**Sobrevive:** `_validateAuthoredWorkflows` · las **reglas** de
`collectSignatureWorkflowNormalizationIssues` (aunque no su papel de traductor) ·
`materializeRuntimeFlowForTaskItem`, intacto · el ZIP, el manifiesto y el saneo LaTeX.

#### Decisión de modelo: los entregables SE COMPARTEN entre configuraciones (2026-08-10)

Se planteó la alternativa —«un entregable pertenece a una sola configuración, y el borrador de la
config gobierna todo»— y **se descartó**. Queda escrito para que no se reabra:

- **El esquema ya permite compartir**: `uq_process_definition_templates` es
  `(process_definition_id, template_artifact_id)`, o sea **una vez por config, configuraciones
  ilimitadas**. Nada impide el mismo entregable en varias.
- **Y se comparte por diseño, no por accidente**: `cloneProcessDefinitionChildren`
  (`services/admin/processes/processDefinitionVersion.js:280-320`) copia los `template_artifact_id` de
  la config origen a la destino **apuntando a los mismos artifacts**, con un remap solo para el que se
  actualiza. Durante una actualización guiada, la config **activa** y la **borrador** comparten todos
  los entregables menos uno. `forkDeliverableForConfig` existe justo para bifurcar cuando no quieres eso.
- **Por eso `lifecycle_state` vive en el entregable y no en la config**: si el mismo artifact está a la
  vez en una activa y en una borrador, el estado de la config no puede decidir si es editable.
- **Lo que costaría la alternativa:** la actualización guiada **depende** de compartir. Bajo «uno por
  config» habría que bifurcar todas las plantillas en cada clonado, lo que multiplica filas y rompe la
  identidad del entregable entre versiones. Y `template_artifacts` dejaría de tener sentido como tabla.

**Consecuencia para el §0.8:** el portador `template_artifact_id` del flujo es correcto — un entregable
compartido lleva su flujo consigo a todas las configuraciones donde esté enlazado, que es lo que el
sync hace hoy abanicando el YAML.

**Y el `lifecycle_state` queda como estado propio, con dos defectos a cerrar antes del §0.8** (ver
[Frente 1](#frente-1--defectos-conocidos-y-sin-arreglar--) 1.12 y 1.13). ✅ **Los dos cerrados el
2026-08-10** (`e6d291d`+`73d2e82` y `673f1fb`): el sub-paso 5 queda desbloqueado. La invariante «una
configuración activa no lleva dentro un entregable sin publicar» ya no es un razonamiento — está
escrita en `ensureDefinitionHasArtifactsForActivation`, el único punto por el que pasan los dos
caminos de activación. **Sigue SIN verificar la otra mitad del riesgo**: que un `draft` no pueda
tener instancias. `launch.js` no comprueba `lifecycle_state` en ningún sitio; lo que se cerró es que
un `draft` llegue a estar dentro de una config activa, no que `launch` lo mire.

#### Riesgos

- **El paquete deja de ser autocontenido.** Hoy prefijo + meta = plantilla reproducible desde MinIO sin
  base. Después, un paquete sin sus filas es una plantilla sin flujo. Afecta a cualquier exportación
  futura entre instalaciones.
- **La invariante de `hasFillFlowTemplateRuntimeUsage`** (`workflowSync.js:281-293`) protege que *una
  instancia en curso no cambie sus pasos bajo los pies*. Se sustituye por la inmutabilidad de
  `published` — **pero eso descansa en que un `draft` no pueda tener instancias, y eso NO está
  verificado.** Es el único punto del diseño que se apoya en un razonamiento y no en una lectura.
- **`normalizeSignatureSteps` descarta en silencio** firmantes sin cargo resoluble y los pasos que
  quedan vacíos (`workflows.js:9-11`). Al escribir directo eso pasa a ser error de autoría: mejor, pero
  **es cambio de comportamiento** — commit y golden propios.
- **Fuera del backend no depende nada** (verificado: `signer/`, `scripts/`, `docker/`).

---

<!-- Se conserva el orden que se planificó el 2026-08-09, no el que se siguió: la diferencia entre
     los dos es el aprendizaje. -->

**Orden sugerido (2026-08-09, tal y como se escribió):** 0.1 → el documento de modelo y `CLAUDE.md` →
0.8 → 0.3 y 0.2, que 0.8 cierra casi solos → los pasos 3 y 4 de la fusión `task_items`/`documents` →
0.5 → 0.4 y 0.6, ya sin bloqueos. §0.7 (la documentación) al final, cuando lo demás haya dejado de
moverse.

**Y el que se siguió**, que no es el mismo: 0.1 → 0.5 y 0.6 → **0.8 entero, que se comió ocho
sub-pasos y cerró 0.2 y 0.3 de paso** → 0.7 → 0.4. **Los pasos 3 y 4 de la fusión
`task_items`/`documents` nunca se ejecutaron**, y no por falta de tiempo: 0.8 dejó el modelo coherente
sin necesitarlos, y el paso 4 toca frontend. Siguen sin decidir — ver el [`README.md`](./README.md).
