# Plan maestro — lo que queda por hacer

> **Este es el ÚNICO documento del que se sacan tareas.** Todo lo demás en `docs/planes/` es
> referencia: se consulta, no se ejecuta.
>
> **Medición de partida:** SonarQube en `:9002`, rama `develop`, **2026-08-09**.
> 373 incidencias · 0 bugs · 8 vulnerabilidades · cobertura 17,7 % · notas **A / C / A**.
> Cómo reproducirla y la serie histórica: [`referencia/calidad-y-medicion.md`](./referencia/calidad-y-medicion.md).

---

## Cómo leer este plan

Los frentes van **ordenados por retorno sobre esfuerzo**, no por gravedad. Cada uno dice **qué es**,
**por qué importa**, **qué hacer** y **cuándo está cerrado**. Los estados son solo tres:

⬜ sin empezar · 🟡 a medias · ⛔ bloqueado por otra cosa

**Antes de tocar nada, dos lecturas obligatorias:** las reglas de trabajo de
[`referencia/metodo.md`](./referencia/metodo.md) —destiladas de fallos reales de este repo, romperlas
cuesta más que el trabajo que ahorran— y la lista de **lo que NO hay que tocar**, en el mismo sitio.

---

## Frente 0 · Limpiar el modelo antes de seguir refactorizando — ⬜ ← **EMPIEZA AQUÍ**

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

### 0.2 · ¿Hace falta el resolver `document_owner`? — ⬜ **decisión, bloqueada por 0.1**

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

### 0.3 · `BASE_META_YAML`: la puerta trasera del bootstrap — ⬜

`services/system/SystemBootstrapService.js:277-305` es un `meta.yaml` **escrito a mano como literal de
código**, subido en `:389`. Es **el único productor vivo de `document_owner`** y contradice la regla
del modelo nuevo («todo se autora por CRUD»). El comentario de `:553` dice que el atajo se retiró
(P1.4): **retiró un sitio y dejó este**.

Y **se auto-replica**: `createTemplateArtifactVersion` (`templateArtifact.js:362-368`) copia MinIO en
binario, así que la v1.1.0 heredó el `document_owner` de la v1.0.0 sin pasar por la web. Cada versión
nueva lo arrastra otra vez.

**Criterio de cierre:** el proceso por defecto se siembra por el mismo camino que todo lo demás.

### 0.4 · Falta el generador del código base desde los campos configurados — ⬜ **hueco, no defecto**

Es **la mitad que falta** del ciclo objetivo *configurar en web → descargar base → editar → subir*.

Hoy `_materializeDraftFormats` (`templateLifecycle.js:1138-1152`) copia `<seed>/src/` **verbatim**. Los
valores configurados en la web sí llegan al paquete de MinIO — pero **solo a `meta.yaml` y
`schema.json`, que son exactamente los dos ficheros que el ZIP de descarga NO incluye**
(`GET /template_artifacts/:id/source` zipea solo `template/jinja2/`, `sql_admin_controller.js:177`).
El `.tex.j2` que abres para editar es el del seed, **sin una sola referencia a tus campos**: hay que
escribir los `{{ … }}` a mano adivinando las claves.

Lo que falta, por impacto: (1) **generar el Jinja/LaTeX base desde `schema_fields`**; (2) incluir
`meta.yaml`+`schema.json` en el ZIP en modo lectura, para ver contra qué contrato se escribe;
(3) validar **sintaxis Jinja** al subir —hoy solo se sanea LaTeX (`artifacts.js:28-51`), y una
plantilla con `{% for %}` sin cerrar se publica y revienta en render—; (4) `fileFilter` en los
adjuntos de referencia (`sql_admin_router.js:59-62` no tiene ninguno).

> Lo que **sí** funciona y conviene no tocar: la subida por ZIP valida integridad SHA-256 del
> manifiesto, zona editable acotada a `Contenido/`, path traversal, y saneo LaTeX (`\write18`,
> `\directlua`, `\openout`, `\ShellEscape`). Está bien hecho.

### 0.5 · El vocabulario del entregable — ⬜ **tema propio**

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

### 0.6 · Censo de fósiles del camino viejo — ⬜

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

### 0.7 · La documentación miente en dos direcciones — ⬜

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

### 0.8 · Invertir la dirección del flujo: la base manda, el YAML se va — ⬜ **el que desbloquea a los demás**

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
| **1-bis** | **Simetría de los pasos de entrega**: `code`, `name` y `field_refs` en `fill_flow_steps`, que `signature_flow_steps` **ya tiene**. Sin esto, invertir pierde los nombres de paso (hallazgo 1). Nadie los escribe ni los lee todavía | Sí | Test de esquema + char sin diffs |
| **3** | **Escritura doble.** `saveTemplateArtifactDraft` escribe el flujo **en la base** (colgando de `template_artifact_id`) dentro de una transacción, **y sigue emitiendo el `meta.yaml` igual que hoy**. Las dos copias salen del **mismo objeto en memoria**: no pueden divergir. **El escalón 2 sigue ganando**, así que el runtime no nota nada | Sí | char sin diffs en los **pasos**; el golden del sub-paso 0 gana cabeceras nuevas (las de plantilla), y **eso es la prueba** |
| **4** | **Primer lector: los cuatro gates.** Pasan a contar sobre la base (`templateArtifact.js:224,278`; `templateLifecycle.js:248,920`). Efecto colateral bueno: hoy leen MinIO con un `catch {}` mudo, así que **un MinIO caído se traduce en «no define flujo» y bloquea la publicación por una razón falsa** | Sí | Goldens de `zz_template_lifecycle` |
| **5** | **Segundo lector: el editor.** `GET /admin/sql/template_artifacts/:id/schema` (`templateArtifact.js:123-181`) reconstruye el flujo desde la base. **Es el lector que faltaba en el plan** (hallazgo 2): sin él, reabrir una plantilla la muestra sin flujo | Sí | char + comprobar en navegador que el editor reabre con su flujo |
| **6** | **El versionado copia FILAS, no bytes**: `createTemplateArtifactVersion` (`templateArtifact.js:336-409`) y `forkDeliverableForConfig` (`templateLifecycle.js:531-610`). Aquí se corta la auto-replicación de `document_owner` (§0.3) | **No** | Char nuevo: versionar con flujo → la hija tiene los mismos pasos con ids distintos. **Debe cubrir entrega Y firma** |
| **7** | Borrar `BASE_META_YAML` y su upload (`SystemBootstrapService.js:277-305`, `:389`) | **No** | Bootstrap limpio y `count(*)` de flujos del vínculo por defecto = **0** (hoy 1). Criterio de cierre de §0.3 |
| **8** | **El desmontaje.** Dejar de emitir `workflows:` en el meta · **vaciar las filas de flujo colgadas del vínculo que sembró el sync** (hallazgo 4: si no, se quedan rancias y siguen tapando al escalón 3) · borrar el andamiaje (`WorkflowSyncService`, endpoints de resync/reconcile/sync-status, `sync_mode`, marcadores, `buildWorkflowsYaml`, `meta_object_key`, `anchor_refs`) · **retirar los seis resolvers de la decisión 1** | **No** | `check:imports` **obligatorio** + `test:unit` + `test:char:run`. Los goldens de `artifact_draft` se mueven (cambia `content_hash`) y **ese diff es la prueba** |
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

**Orden sugerido:** ✅ 0.1 → ✅ el documento de modelo y `CLAUDE.md` → **0.8 (aquí estamos)** → 0.3 y
0.2, que 0.8 cierra casi solos → los pasos 3 y 4 de la fusión `task_items`/`documents` → 0.5 → 0.4 y
0.6, ya sin bloqueos. §0.7 (la documentación) al final, cuando lo demás haya dejado de moverse.

---

## Frente 1 · Defectos conocidos y sin arreglar — ⬜

**Lo más rentable que queda, y con diferencia**, porque no es deuda estética: son fallos que un
usuario puede encontrarse. Todos están **congelados en pruebas**, así que el arreglo se verifica solo:
cuando el defecto muere, su golden cambia, y ese diff **es** la prueba.

| # | Defecto | Dónde | Nota |
|---|---|---|---|
| ~~1.1~~ | ~~**El `fileFilter` de multer suelta el stack trace completo en HTML**~~ | `user_router` y `dossier_router` | ✅ **CERRADO (2026-08-09, `1ff3370`+`040a9d0`)**. Goldens nuevos `dossier_mimetype_rechazado` y `certificado_mimetype_rechazado`, capturados **antes** del fix para que el diff exista: `status 500→400`, `esHtml true→false`, `filtra_stack_trace true→false`. **Montar el middleware no bastaba**: `describeUploadError` convierte cualquier error sin `statusCode` en un 500 genérico y **se traga el motivo** (por diseño), así que los 4 `fileFilter` pasaron de `cb(new Error(…))` a `cb(badRequest(…))`. **Anótalo si se monta en más routers** |
| ~~1.2~~ | ~~`approve` del último paso sin PDF → **500**~~ | `FillRequestWorkflowService` | ✅ **CERRADO (2026-08-09)**. Se elige **409, no 400**: la petición está bien formada —ni siquiera lleva cuerpo— y el servidor está sano; lo que no admite la operación es el **estado del recurso**, y el remedio del usuario es subir el PDF, no corregir su petición. Es además el código que ya usan los **otros dos guards del mismo servicio** («sin responsable resoluble» y «transición ilegal»), y `errors/HttpError.js` lo define así. Al frontend le da igual el número —`HomeView.vue:4627` pinta `data.error` en crudo—, así que el mensaje se dejó **idéntico** y el diff del golden es solo el código. Golden renombrado `defecto_approve_sin_pdf` → **`approve_sin_pdf`**, `500 → 409`. **El segundo matiz —comprobar MinIO— se evaluó y se DESCARTÓ**, con las razones escritas encima de la propia consulta para que no se «arregle» otra vez: (a) la comprobación que garantiza algo **ya existe en el punto de uso**, `PdfSigningService.js:259` hace `statMinioObject` justo antes de firmar, y repetirla aquí sería orientativa por TOCTOU; (b) **invertiría las capas** —el servicio no sabe el bucket; necesitaría `resolveStoredDocumentObject` y las constantes de `controllers/users/user_controler.storage.js`—; (c) iría **dentro de la transacción abierta** y `minio_service.js` no fija timeout (medido: 24 ms en frío, 3 ms en caliente, error `NotFound`/`S3Error`); (d) el error **no mejoraría**: los dos casos tienen el mismo remedio y hoy ya salen 409; (e) el camino normal **no produce ese estado** —`user_controler.js:586-598` sube a MinIO ANTES de escribir en la base, y escribe en transacción—. Coste concreto de haberlo añadido: el caso feliz `approve_ok` aprueba hoy con una ruta `.pdf` **fabricada**, así que habría que sembrar MinIO en el harness |
| 1.3 | Con `is_manual = 1` y sin responsable, **cualquiera se apropia de la solicitud** al iniciarla | `FillRequestWorkflowService` | El UPDATE le pone su propio id. Congelado en `manual_autoasignacion_efecto` |
| ~~1.4~~ | ~~Se pueden **enumerar los jobs de otros usuarios**~~ | `BatchSigningService` | ✅ **CERRADO (2026-08-09)**. Se unifica en **404** (no en 403): es el código que no confirma existencia, ya era el del camino frecuente, y el frontend no ramifica por código —`FirmarPdf.vue:2450` solo pinta `data.error`—, así que el dueño legítimo no nota nada. El arreglo NO vive en el controller: `getBatchJob` **se dejó de exportar** (leer un lote por id y sin dueño ES el oráculo) y fuera solo se ofrece `getOwnedBatchJob`. Goldens `batch_status_ajeno` y `batch_download_ajeno`: `403 → 404` y el mensaje pasa a ser el mismo del inexistente. Los dos tests char ahora **comparan ajeno contra inexistente con `deepEqual`**, que es la propiedad de verdad —que sean indistinguibles—, no el número |
| ~~1.5~~ | ~~`bindParams` con parámetros de menos → `undefined` → **NULL silencioso**~~ | `backend/config/postgres.js` | ✅ **CERRADO (`e0cdae9`)**. Ahora lanza diciendo cuántos placeholders había y cuántos parámetros llegaron. **El mensaje NO incluye el SQL a propósito**: varios controllers responden `error.message` al cliente y sería filtrar el esquema mientras se arregla una fuga. Sin golden movido, y **eso es lo correcto**: es un bug latente sin disparador vivo. Verificado por dos vías —sonda en `bindParams` + `test:char:run` (0 casos en 240 flujos) y barrido de las 493 llamadas (0 desajustes en las 429 decidibles)— |
| ~~1.6~~ | ~~`translatePlaceholders` es **código muerto**~~ | `backend/config/postgres.js` | ✅ **CERRADO (`d25034b`)**. Aviso para el próximo borrado de código muerto: sus 33 tests **no probaban esa función**, caracterizaban el autómata `scanSql` que `bindParams` sigue usando. Borrarlos con ella habría dejado ese escáner sin red; se re-apuntaron a `bindParams` |
| 1.11 | **Parámetros de MÁS se ignoran en silencio** | `backend/config/postgres.js` | Mismo modo de fallo que 1.5, en la otra dirección, descubierto al arreglarlo. **Deliberadamente no se tocó**: mysql2 hacía lo mismo y hay call sites que reutilizan a propósito un array de argumentos más largo que la consulta, así que el radio de impacto es mucho mayor. Si se ataca, primero hay que censar esos call sites |
| 1.7 | **El «sello fantasma»: un guard permanentemente verdadero** | `MultiSignerPanel.vue` | `previewBoxStyle` nace `{display:'none'}` pero la asignación de `:911` **no incluye `display`**, así que tras el primer `pointermove` el `v-if` de `:169` es siempre cierto: código muerto. Ojo — [`referencia/frontend.md`](./referencia/frontend.md) afirma lo contrario (que `isMouseOverPdf` «nunca se lee», y sí se lee en `:169`); el único diagnóstico correcto está en [`referencia/god-objects-2026-07.md`](./referencia/god-objects-2026-07.md) §3.4 |
| 1.8 | **Dos documentos del repo mandan formas de error contrarias** | `backend/errors/HttpError.js:20` | Su cabecera recomienda `res.json({ error: error.message })`, mientras el contrato objetivo —y `middlewares/uploadError.js`, que ya lo implementa— es `{ message, code }`. Mientras eso no se reconcilie, cada controller nuevo elige mal la mitad de las veces |
| ~~1.9~~ | ~~**El arreglo del IDOR se aplicó copia por copia y una copia se quedó atrás**~~ | `backend/services/chat/ChatAuthorizationService.js` | ❌ **NO ERA UN DEFECTO (2026-08-09). No apliques el guard ahí.** El diagnóstico confundía el nivel de la fila: el guard canónico responde «¿es TUYO este entregable?» y protege consultas cuya FILA es un entregable; esta resuelve el hilo del **proceso en una unidad**, donde el `LEFT JOIN task_items` solo abanica filas y lo único proyectado —`scope_unit_id`, que sale de `t.responsible_position_id`— es idéntico en todas las filas de una tarea. Tres razones, la última **medida** contra la base de dev: (a) no cierra ninguna fuga —el guard nunca RECORTA el conjunto de unidades accesibles, lo VACÍA—; (b) la lista de participantes del hilo se construye de `task_assignments` **sin** filtrar por responsable de entregable, así que aplicarlo solo en el acceso dejaría gente dentro del hilo y con 403 al abrirlo; (c) 8 de las 10 personas asignadas a la tarea 8 (proceso 1, unidad 8) pasaban de `{8}` a **ninguna** unidad accesible, y el corte dependería de datos ajenos: en la tarea 9 (misma forma, 10 asignados, **0 entregables**) el `LEFT JOIN` deja `ti` a NULL y las diez conservan el acceso, luego el hilo se le caería a ocho de ellas **en cuanto un compañero creara el primer entregable**. Queda escrito en el propio fichero, encima de la consulta, para que no se «arregle» otra vez |
| ~~1.12~~ | ~~**Se puede activar una configuración con una plantilla SIN PUBLICAR enlazada**~~ | `templateLifecycle.js` y `SqlAdminService.js` | ✅ **CERRADO (2026-08-10, `e6d291d`+`73d2e82`)**. El diagnóstico se **ejecutó** antes de tocar nada: golden nuevo `defecto_borrador_colado_en_activacion` en `zz_template_lifecycle`, que crea un segundo entregable dentro del borrador de configuración durante la actualización guiada y deja escrito el resultado — `config_status: "active"` con `colado_lifecycle_state: "draft"`. El arreglo son **las dos cosas, no una**: (b) **`finishTemplateUpdate` publica el resto de borradores enlazados**, igual que `tableHooks.js:605`, porque publicar los borradores **es la semántica de activar una configuración** en este modelo (lo dice `publishDraftTemplatesForDefinition:226-229`: «activa la config + publica la plantilla»), no un detalle del CRUD — y no publica en silencio: para *single*/*replicated* exige ≥1 paso de entrega y **aborta la activación entera** nombrando la plantilla; y (a) **el gate rechaza la activación si queda algún entregable en `draft`**, nombrándolos, porque es el **único punto por el que pasan los dos caminos** y ahí es donde la invariante se escribe una sola vez. **Endurecer SOLO el gate se descartó**: dejaba el update guiado sin salida mientras el otro camino de activación —el `PUT` genérico de `process_definition_versions`, real y caracterizado en `graft_pdv_update_activacion`— publicaba y activaba igual; dos caminos con resultados contrarios para el mismo estado es peor que el defecto. El guard nuevo va **el último de los tres** (el orden de los mensajes es contrato). **Orden dentro de la transacción, y no es estilo**: la plantilla versionada se publica PRIMERO porque deja `is_active = 1` y el gate de artefactos activos depende de eso; `publishDraftTemplatesForDefinition` filtra por `lifecycle_state = 'draft'` y **no toca `is_active`**, así que ir después no la pisa. Medido contra la base de dev (probe con rollback): con un borrador el gate rechaza nombrándolo, y con el orden real del CRUD pasa — **camino del CRUD intacto**. SQL probado con `PREPARE`+`EXECUTE` en psql, las dos ramas. La clave del golden **NO se renombra** (mismo criterio que `defecto_deliverable_huerfano`): el diff `draft → published` **es** la prueba. 14 unitarios nuevos |
| ~~1.13~~ | ~~**`template_artifacts.lifecycle_state` nace `published` por defecto**~~ | `backend/database/postgres_schema.sql:523` | ✅ **CERRADO (2026-08-10, `673f1fb`)**. **Esta ficha se equivocaba en dos puntos y quedan corregidos**: (1) el bootstrap **NO depende del DEFAULT** — `SystemBootstrapService.js:503` fija `'published'` explícitamente; y (2) «una fila creada por el CRUD genérico» **no es alcanzable**: `pickPayload` descarta la columna por ser `readOnly`, pero antes de eso **`tableHooks.template_artifacts.beforeCreate()` lanza SIEMPRE**, así que el create genérico ni llega al INSERT. Censados los **cuatro** (y son cuatro) `INSERT INTO template_artifacts` del repo, **los cuatro fijan la columna explícitamente**. Es por tanto un **defecto latente sin disparador vivo, como el 1.5**: ningún golden se mueve, y eso es lo correcto. **Cómo se hace efectivo**: no basta con cambiar el `CREATE TABLE`, porque `CREATE TABLE IF NOT EXISTS` no toca una tabla que ya existe y el cambio solo valdría para bases nuevas; va con un `ALTER TABLE … SET DEFAULT` idempotente (mismo idioma que el `ALTER` de `persons`). **Medido: NO hace falta el reset de `test:char:run`** — tras `restart backend`, la base de dev sin resetear ya devuelve `'draft'::text` en `information_schema.columns`, y un INSERT que omite la columna nace `draft`. El test vigila el **par** (definición + `ALTER`), que es lo único que puede romperse en silencio; vive en `backend/database/`, así que el glob se amplió **en los dos sitios** de `package.json`. **Pendiente en frontend (fuera de alcance):** `backend/config/sqlTables.js:385` y su gemelo del frontend siguen declarando `defaultValue: "published"` para ese campo, y el frontend arrastra ~8 fallbacks `String(row.lifecycle_state \|\| "published")`. Hoy es inerte —el campo es `readOnly`, la columna es `NOT NULL` y el create está bloqueado— pero contradice el esquema, y **cambiarlo exige tocar los dos gemelos a la vez** |
| 1.10 | **La única bitácora de auditoría del sistema la puentea el camino automático** | `backend/database/postgres_schema.sql:1330-1344` | `trg_position_assignments_after_update_fn` reasigna `task_items.assigned_person_id` (a `NULL` al cerrar la ocupación, y a la persona nueva al abrirla) **sin escribir ni una fila en `task_item_handovers`**. En todo el backend hay **un solo INSERT** a esa tabla (`services/admin/org/taskAssignment.js:254`, el camino manual), así que **dos de los tres valores de su `CHECK` —`occupancy_end` y `position_deactivated`— son inalcanzables**. Es decir: los relevos que ocurren solos, que son justo los que nadie recuerda, no dejan rastro |

**Criterio de cierre:** cada uno con su golden actualizado y su clave renombrada si decía «defecto»
(el modelo es `return_ok`/`return_efecto`, commit `2b07180`).

> **Dos candidatos que se descartaron tras comprobarlos** (2026-08-09), para que no vuelvan a
> proponerse: `generation/launch.js:224` (`UPDATE tasks SET process_run_id`) **no es una pérdida de
> trazabilidad**, es la «Opción X» deliberada —el código lo dice en su comentario y el modelo de
> `process_runs` se diseñó así—; y `controllers/tareas/tareas_controler.js:79` **no es otra copia del
> IDOR**: lista *tareas* vía `task_assignments` y solo expone un agregado (`task_item_count`,
> `task_item_names`), no entregables individuales. Si algún día se revisa, es por otro motivo.

---

## Frente 2 · Seguridad: de C a B cuesta una marca; A exige una decisión — ⬜

Quedan **8 vulnerabilidades**, y como siempre en Sonar **la nota la fija la peor, no el volumen**.

- **C → B: una sola incidencia.** `javascript:S2612` en `backend/utils/templateArchive.js:144`, un
  `chmod 0o755` sobre los `.sh` de un workspace temporal antes de comprimirlo. El comentario del código
  ya explica por qué hace falta (zip preserva el modo unix y los scripts deben quedar ejecutables) y el
  directorio se borra tras la descarga. **Es un falso positivo defendible: márcalo con esa
  justificación**, no lo "arregles".
- **B → A: NO es alcanzable honestamente hoy**, y conviene decirlo en vez de maquillarlo. De las 7
  MINOR restantes, **4 son el riesgo R-1**: la contraseña del PKCS#12 viaja por **AMQP sin TLS**. Eso
  es un riesgo real y aceptado, no un falso positivo. Marcarlo para lucir una A sería mentirle al
  panel. Las otras 3 (`http://` a MinIO, RabbitMQ y el mailer) son endpoints internos del compose y sí
  se pueden marcar — **dejan de ser inocuas el día que MinIO salga de la red interna**.

**La decisión pendiente, que es de infraestructura y no de código:** poner TLS en el broker, o aceptar
R-1 por escrito con su justificación. Detalle en [`referencia/signer.md`](./referencia/signer.md).

**Criterio de cierre:** seguridad en **B** con el `S2612` marcado, y R-1 con una decisión escrita.

---

## Frente 3 · Complejidad: lo que queda son tres componentes Vue — 🟡

De los **~60 `S3776`** abiertos, la cabeza ya no está en el backend.

> **No cites ese número sin re-medirlo.** Al revisar el plan el 2026-08-09 había **tres cifras vivas y
> distintas** para lo mismo: 58 aquí, **67** en `referencia/calidad-y-medicion.md` §3.2, y **61** en la
> consulta directa a la API (`resolved=false`). Es deriva normal entre escaneos, pero el contador de
> `S3776` **no es un indicador de progreso** —los buenos están al final de este documento—, así que
> vale más re-medirlo el día que se necesite que mantenerlo sincronizado en tres sitios.

| Cogn. | Dónde | Qué hacer |
|---:|---|---|
| **350** | `HomeView.vue` (**5 215 L** en un solo componente) | **Partirlo.** Su red de regresión es [`referencia/linea-base-homeview.md`](./referencia/linea-base-homeview.md), que existe justo para esto — pero **ojo: dos de sus filas ya no son ciertas** (el aside se rediseñó). No está «intacto»: bajó de 7 445 a 5 215 L. Lo que no se ha hecho es **partirlo** |
| **290** | `AdminTableManager.vue` | **NO es un God y no se polimorfiza** (ver «lo que no se toca»). Su peso son **dos injertos concentrados** (`process_definition_versions`, `template_artifacts`): extraerlos como paneles propios |
| **262** | `FirmarPdf.vue` | God real, 6 responsabilidades. Incluye la peor función del repo, `confirmSign` (44) |

Son **900 puntos, el 11 % de toda la complejidad**, y **ningún patrón de diseño le hace nada a un
`<template>` de 2 000 líneas**: la única cura es extraer componentes y bajar la lógica a composables
(ver [`referencia/patrones-diseno.md`](./referencia/patrones-diseno.md) §5). Es trabajo artesanal, se
verifica en navegador y no admite atajos.

Detrás van, ya en tamaño manejable: `useAdminPresentationAdapters` (44), `useAdminDraftArtifactFlow`
(39), `SqlAdminService.list()` (36), `genericCatalog` (33), `assignees` (33). Y en el backend hay dos
que **nadie ha mirado nunca** y tienen el mismo olor que la fase D ya curó: `dossier_controler.js`
(97 cogn. en 299 ncloc) y `generation/documents.js` (95).

---

## Frente 4 · Sistema de diseño — 🟡 · pasos 1-3 cerrados, el 5 a medias, el 4 y el 6 abiertos

> **Plan, evidencia y bitácora: [`sistema-diseno/`](./sistema-diseno/).** El frente ocupaba 20 líneas
> aquí y necesitaba más: la medición del 2026-08-09 encontró **tres cosas que no estaban en ningún
> plan** y que iban *antes* de los pasos ya escritos.
>
> **Re-auditado el 2026-08-11**, sobre el árbol de `develop` tras el merge `96f1afe`. Lo que sigue
> **no** es el resumen de los mensajes de commit: cada línea se volvió a medir con `grep`, con
> `lint:css` dentro del contenedor y —donde había que verlo— con `getComputedStyle` en el navegador.
> Tres afirmaciones de la versión anterior de esta sección **eran falsas**, y van marcadas como tales
> más abajo en vez de borradas.

El orden **no es negociable**, porque hacerlo al revés significa recodificar el conflicto en cada
sitio donde hoy hay un color escrito a mano. Y la sesión del 2026-08-09 le añadió un principio:
**borrar antes de migrar** — tokenizar reglas que no aplican a ningún nodo es trabajo que se tira.

| # | Paso | Estado | Evidencia medida el 2026-08-11 |
|---|---|---|---|
| 1 | Fusionar los dos `@layer components` en conflicto | ✅ `63b901e` | Ya no existe `tailwind.css`. Los `@layer components` que quedan son **uno por módulo de familia** y no se solapan; las marcas del corte siguen anotadas en `buttons.css:36` y `auth.css:60` |
| 2 | Eliminar los componentes muertos y su CSS | ✅ `9ebe307` + `331322d` | CSS total 3 997 → **2 054 L**; `AdminTableManager.css` borrado entero |
| 3 | Colapsar los tokens `--deasy-*` / `--brand-*` | ✅ `6e60d74` | **Cero `--deasy-*` vivos.** Las 4 apariciones que quedan en el árbol son **comentarios** de `tokens.css` (`:44`, `:51`, `:52`, `:92`) que explican el colapso. Un solo juego, y `@theme` (`tokens.css:23-40`) registra 16 colores en Tailwind |
| 4 | Cerrar el fork `AdminButton.vue` | ⬜ **abierto** ← *aquí estamos* | El fichero **sigue vivo**: `frontend/src/modules/admin/components/ui/AdminButton.vue`. Ver abajo: el alcance es más pequeño de lo que decía el plan, y la razón que daba era falsa |
| 5 | Migrar los colores hardcodeados | 🟡 **el CSS sí, el `.vue` no** | `647030a` + `2f1a158` dejaron `lint:css` en **0 errores**. Pero el contador ve el CSS, no la app. Ver el desglose abajo |
| 6 | Las 33 incidencias de contraste (`css:S7924`) | ⬜ **sin medir** | No se puede consultar: el SonarQube es local y **no se levantó** en esta auditoría. Ver abajo qué se sabe sin él |

### Paso 4 — el fork sigue ahí, pero el plan lo describía mal

**Medido:** `AdminButton.vue` tiene **un solo import real** en todo el frontend,
`modules/perfil/components/DossierDocumentActions.vue:92`. Sus **seis** usos son todos
`variant="secondary" size="sm" icon-only` (`:3-87`), o sea **exactamente el caso divergente**:

- `AdminButton.vue:82` → `props.size ? sizeClassMap[props.size] : ""` — aplica el tamaño **siempre**.
- `AppButton.vue:93` → `props.variant !== "plain" && !props.iconOnly ? … : ""` — lo **omite** con `icon-only`.

Sustituirlo quita `admin-btn--sm px-3 py-2 text-sm` a esos seis botones, así que **sí mueve el
aspecto** y sigue pidiendo navegador. Lo que ha bajado es el riesgo: no es un fork con veintiún
consumidores, es un fichero y una fila de botones del dossier.

> ⚠️ **Afirmación falsa corregida.** Esta sección decía que `AdminButton` era el «**único emisor vivo
> de `admin-btn--*`**». **No lo es, y no lo ha sido nunca desde que existe `AppButton`**:
> `AppButton.vue:65-94` emite las **dos** familias (`deasy-btn--primary admin-btn--primary`…) en cada
> botón, que es justo el peaje que `referencia/frontend.md` §3.5 ya describía. Borrar `AdminButton.vue`
> **no** deja huérfano ningún `.admin-btn--*` del CSS.

> 🪤 **Trampa de nombres, medida.** Hay 14 ficheros que escriben `<AdminButton>` en su plantilla y
> **no usan este componente**: importan `AppButton.vue` bajo el alias `AdminButton`
> (p. ej. `AdminFormActions.vue:24`, `AdminLookupField.vue:84`). Buscar `AdminButton` da 100+ líneas
> y **una sola** es el fork. El grep que vale es `grep -rn "ui/AdminButton" frontend/src`.

### Paso 5 — `lint:css` a cero no es «cero colores»

`bash scripts/docker-env.sh dev exec -T frontend pnpm run lint:css` → **`6 problems (0 errors, 6
warnings)`**, y los 6 son `!important` documentados en la propia línea (`dialogs.css:83,110`;
`overrides.css:3,14,70,86`). Eso es real y hay que sostenerlo. Pero es el estado del **CSS**, y el
grueso del color nunca estuvo ahí:

| Dónde | Cuánto | ¿Lo ve `lint:css`? |
|---|---:|---|
| Hex de la **paleta**, `tokens.css` (34 en declaración + 5 en comentarios) | 39 | Sí, y va **silenciado a propósito** (`stylelint-disable color-no-hex` con motivo, `tokens.css:63` y `:106`). Es el sitio correcto |
| Hex **dentro de `@apply`** en los módulos | **7** | **No.** `forms.css:28,46` (`placeholder:text-[#8a93a8]`), `nav.css:138,142` (`border-[#d6e4f2]`), `tags.css:36` (tres en una línea) |
| `rgb()/rgba()` con triplete numérico en los módulos | **90** | **No.** El grueso está en `nav.css` (27), `buttons.css` (18) y `overrides.css` (11) |
| Hex en `.vue` / `.js` | **123** | **No**: `lint:css` es `stylelint "src/**/*.css"`, no mira una sola plantilla |
| `rgb()/rgba()` en `.vue` / `.js` | **37** | **No** |

Y el número de cabecera: **la cifra «~1 269» no es un colores-hex, es la suma de cuatro categorías de
`referencia/frontend.md` §3.4** (592 utilidades de paleta + 424 *arbitrary values* + 157 hex + 96
`rgb()`). Reproduciendo ese criterio hoy sobre `frontend/src` sale **≈1 537**, o sea que **no ha
bajado: ha subido** con el código nuevo. No es una contradicción con lo anterior — el trabajo del
frente 4 atacó el hex del CSS, y la masa es *utility soup* de Tailwind en `HomeView.vue` (673),
`FirmarPdf.vue` (345) y `AdminDraftArtifactModal.vue` (185). **Eso es frente 3, no frente 4.**

**Criterio de cierre del paso 5, redefinido para que sea alcanzable:** los **7 hex de `@apply`** y los
**90 `rgb()`** de `frontend/src/shared/styles/` a token, con la app idéntica. Lo de `.vue` se cierra
partiendo los componentes, no tokenizando.

### Paso 6 — lo que se sabe sin SonarQube

No se levantó el servidor, así que **el contador de 33 no está re-medido**. Lo que sí está medido y
sigue valiendo, de `sistema-diseno/auditoria-color.md` §5:

- El barrido de parejas `color`+`background` con hex literal en la misma regla —lo único que `S7924`
  puede ver sin resolver cascada— daba **3 fallos, no 33**. Sonar no resuelve `var()`, no compone
  `rgba()` sobre el ancestro y no aplica cascada entre ficheros.
- **El contador y la accesibilidad no son la misma magnitud.** `2f1a158` dejó el CSS sin hex sueltos,
  así que lo previsible es que `S7924` **baje casi solo en el próximo escaneo sin haber arreglado
  ningún contraste** — el color no desapareció, se movió a `var()` y a `color-mix()`, que es
  precisamente lo que la regla no sabe leer.
- El fallo WCAG 1.4.11 que quedaba vivo era `.hope-action-delete-pdf:hover` a **2,90:1**. `2f1a158`
  unificó los siete `:hover` de `.hope-action-*` en `color-mix(… 85%, var(--brand-black))`, que
  oscurece, así que **debería haber subido** — pero eso **no está verificado** y el fondo de esa
  familia sigue siendo `rgba()` numérico (`buttons.css:266-346`).

**Criterio de cierre:** un escaneo con la cobertura regenerada + una medida de contraste real de
`.hope-action-*` en navegador. Sin las dos cosas no se sabe si esto está hecho.

### La estructura nueva (2026-08-10, `c45b154`)

`theme.css` y `tailwind.css` **ya no existen**. En su lugar hay **15 ficheros** en
`frontend/src/shared/styles/`: 14 módulos por familia más `index.css`, que es **lo único que importa
`main.js`** (`main.js:6`). El orden de los `@import` **no es alfabético y está explicado dentro del
propio `index.css`** (`:1-15`): `tokens.css` primero porque todo lo demás lo consume, `overrides.css`
el último porque tiene que ganar a las reglas de componente por orden, no por `!important`.

> El módulo **`misc.css` existe** y es el 14.º: la tabla de `CLAUDE.md` no lo lista.

**Los `!important` bajaron de 103 a 6**, y los 6 llevan el motivo escrito al lado.

### El defecto del `<header>`: no se perdió, y ahora es peor

La versión anterior de esta sección decía que la causa era
`html[data-environment="local-dev"] header { … !important }`, que **solo afecta a dev**, y que el
bloque `local-dev` «sigue ahí». **Las tres cosas son falsas hoy**, y conviene saber por qué:

- `c45b154` **promovió el bloque entero y retiró el gate**: `grep -rn "data-environment" frontend/src`
  da **0**. Fue lo correcto —el bloque era *el diseño* puesto tras la condición equivocada, y sin él
  producción se veía **peor**—, pero significa que **ya no hay nada acotado a desarrollo**.
- La regla sobrevivió intacta salvo el gate y el `!important`. Hoy es **`overrides.css:140`**:

  ```css
  header {
    background-color: var(--brand-navy-deep);
    border-color: rgba(255, 255, 255, 0.1);
  }
  ```

- **Medido en el navegador** (`https://localhost:8443`, con `data-environment` ya inexistente),
  inyectando el `<header>` de `AppFormModalLayout.vue:14-17` tal cual: `backgroundColor` =
  `rgb(7, 25, 39)` (= `--brand-navy-deep`) y el `<h2 class="text-slate-950">` encima, o sea texto
  casi negro sobre fondo casi negro, **≈1,1:1**.

**O sea: el defecto no se corrigió, se generalizó.** Antes salía en el modal «Agregar título
académico» y solo en dev; ahora la regla es incondicional y alcanza **todo `<header>` sin utilidad de
fondo propia** — `AppFormModalLayout.vue:14` (que es **todos** los modales de formulario del perfil),
`ProcessGraphView.vue:142`, `UnitGraphView.vue:174` y `HomeView.vue:875,1023,1048`. Los que llevan
`bg-white` (`SNotify.vue:14`) o un degradado (`WorkspaceChatLauncher.vue:24`) se salvan porque una
clase (0,1,0) gana al selector de elemento (0,0,1).

**Arreglo propuesto:** `overrides.css:140` no quiere ser `header`, quiere ser la cabecera del *shell*
de la aplicación (`SHeader.vue:2`). Darle su clase y dejar el elemento en paz. Es un cambio de una
línea, pero **cambia el aspecto de seis sitios a la vez**: pide huella de `getComputedStyle`
antes/después, no build ni tests.

> 📌 ~~`sistema-diseno/bitacora.md:274` sigue diciendo que «el bloque `local-dev` de `theme.css` sigue
> vivo»~~. **Corregido el 2026-08-11**: la bitácora ya registra la sesión del 2026-08-10 donde se
> promovió (`c45b154`), y con ella el hallazgo de fondo — **`local-dev` no era una variante de
> desarrollo, era el diseño tras la condición equivocada**, y promoverlo arregló 3 de los 4 fallos de
> WCAG 1.4.11 que producción tenía.

### Las tres colisiones de `tailadmin-ui`: dos cerradas, una viva

| Colisión | Estado | Evidencia |
|---|---|---|
| `rounded-lg` valía 16 px (escala invertida) | ✅ **cerrada** (`cdbc62b`) | No queda ni una declaración `--radius-*` en `frontend/src`. Medido en navegador: `--radius-lg` = **`0.5rem`** (8 px), o sea el valor por defecto de Tailwind v4, y la escala vuelve a ser monótona (`sm 4 < md 6 < lg 8 < xl 12 < 2xl 16`) |
| No había `@theme`, Tailwind no conocía un solo token | ✅ **cerrada** (`6e60d74`) | `tokens.css:23-40`, 16 colores bajo `--color-*`. Ya existen `bg-brand-primary`, `text-brand-text-strong`… |
| `dark:` se autoactivaría por `prefers-color-scheme` | ⛔ **viva** | `grep -rn "custom-variant" frontend/src` → **0**. Sin `@custom-variant dark`, Tailwind v4 compila `dark:` a `@media (prefers-color-scheme: dark)` y una receta pegada de TailAdmin pintaría en oscuro sobre una app en claro. **Fallo silencioso**, y hoy inocuo solo porque no hay **ni un** `dark:` en el árbol. El aviso está donde toca, en `tokens.css:17-20` |

### La barandilla, y lo que no vigila

- **stylelint** (`frontend/.stylelintrc.json`): `color-no-hex` en **error**, `declaration-no-important`
  en **warning**. Hoy: **0 errores, 6 avisos**, y ahí se queda.
- **`eslint-plugin-vue`** (`frontend/eslint.config.cjs:36-37`): `vue/no-static-inline-styles`
  (`allowBinding: true`) y `vue/prefer-separate-static-class`, ambas en **error** y a cero.

> ⚠️ **Afirmación obsoleta corregida.** Esta sección decía que «`pnpm run lint:css` sale en rojo a
> propósito (151 hex) y **no debe subir**». Ya no: sale en **verde**. La regla pasa a ser **no debe
> volver a rojo** — y con el matiz de arriba, que el verde solo cubre el `.css`.

### Los cuatro scripts de `scripts/`

| Script | Qué hace | ¿Se queda? |
|---|---|---|
| `css-radios.mjs` | Deshizo la colisión `--radius-*` reescribiendo cada uso al *utility* que pintaba ese mismo valor, en **una sola pasada** (dos `sed` encadenados mandarían los 8 px a 16) | **Un solo uso.** Su trabajo está hecho y no se repite: archivar |
| `css-modularizar.mjs` | Troceó `theme.css` + `tailwind.css` en los 14 módulos + `index.css`. Sabe descender dentro del `@layer components` y asigna las reglas multi-selector a la familia **más tardía** para que ninguna se adelante | **Un solo uso**, pero su cabecera (`:1-20`) documenta *por qué* el orden de `index.css` es el que es: archivar el script, **conservar el comentario** |
| `css-prune.mjs` | Poda genérica: trocea una hoja en bloques de primer nivel y borra los que solo mencionan clases sin consumidor, con **invariante de reconstrucción byte a byte** antes de escribir. Tiene modo informe (sin `--apply`) | **Se queda.** Es reutilizable y el modo informe sirve de auditoría periódica |
| `css-hex-a-token.mjs` | Sustituye hex por `var(--token)` con dos salvaguardas ganadas a golpes: el hex corto que es prefijo del largo (`#fff` dentro de `#fff0ed`) y la autorreferencia que deja el token **sin valor** | **Se queda.** Es la herramienta del paso 5, que sigue abierto |

**Criterio de cierre del frente:** pasos 4, 5 (con el criterio redefinido) y 6 cerrados, más el
`<header>` de `overrides.css:140` acotado. Entonces `sistema-diseno/` se archiva y esto se marca ✅.

> ⚠️ **`sistema-diseno/` NO se archiva todavía: va por su segunda vuelta.** El plan del 2026-08-09
> cerró sus 6 fases y quedó archivado —sus cuatro ficheros sujeto ya no existen—, pero la medición
> del 2026-08-11 encontró que **la deuda que queda no vive en el CSS**: son **3 590 clases de color de
> Tailwind en las plantillas** que ningún linter ve, y **`@theme` es el cuello de botella**, no la
> disciplina (hoy no existen `bg-state-warning` ni `text-brand-text-muted`, así que ~660 de esas
> apariciones **no tenían alternativa**).
>
> El ejecutable es ahora [`sistema-diseno/plan-2026-08-11.md`](./sistema-diseno/plan-2026-08-11.md);
> la evidencia, [`auditoria-2026-08-11.md`](./sistema-diseno/auditoria-2026-08-11.md). **Eso redefine
> el paso 5 de este frente**, que aquí seguía contado como «hex en `.vue`».

---

## Frente 5 · Cobertura — 🟡

Plan propio y ejecutable: [`referencia/cobertura.md`](./referencia/cobertura.md). Su **Fase 0 está
hecha**; quedan las fases 1 y 2.

**Lo único que hay que retener antes de mirar el 17,7 %:** el gate **no pide 80 % global** —eso sería
trabajo de años y no es objetivo de nadie— sino **80 % de lo nuevo**. Hoy `new_coverage` va por 39,2 %.

> **La regla que cierra el gate sola: toda línea nueva nace con test.** El global sube como efecto
> secundario.

Y dos trampas medidas que ahorran semanas: **dos tercios del hueco del frontend son componentes
`.vue`** (caros y frágiles — los composables son el objetivo bueno), y en el backend **Node solo
instrumenta lo que algún test carga**, así que la cobertura sube solo al importar módulos nuevos.

---

## Frente 6 · Signer — 🟡

- ⬜ **Trasladar el bloque de identidad a `signer/certificates.py`** (F4 de la auditoría). Ya es
  mecánico: el corte de complejidad está hecho (142 → 84).
- ⬜ **La asimetría de las dos fuentes de extensiones**, que es un fallo funcional real y está
  congelado en un test: la fuente que corre con los certificados de pyHanko **no desenvuelve los
  `OtherName` del SAN**, así que **una AC que meta ahí la cédula da `signerCedula = None` al validar un
  PDF**.
- ⛔ **Tocar la firma sigue bloqueado** hasta que exista una prueba que firme un PDF real y lo valide.
  Los 266 casos actuales sustituyen pyHanko por dobles.
- ⬜ **Quedan 8 de los 12 riesgos abiertos** (R-1, R-4, R-5, R-6, R-7, R-9, R-10, R-12), y la
  auditoría solo marca dos como cerrados: su tabla §7 está desfasada. El más llamativo es **R-10**:
  el **puerto 4000 del firmante está publicado en los tres entornos** (`4000`, `14000`, `24000`) con
  `POST /sign` operativo, **sin autenticación y sin ningún consumidor legítimo**.
- ⬜ Y **la asimetría del SAN no tiene número R**, así que no aparece donde se buscan los riesgos.

---

## Frente 7 · Deuda de método y de infraestructura — ⬜

Pequeña, pero es la que hace que lo demás no se degrade.

| Qué | Por qué importa |
|---|---|
| **Sonar en CI** | El workflow ya está escrito y verificado (`.github/workflows/sonar.yml`, hace *skip* en verde sin secrets). **Lo que falta no es código**: el SonarQube es local y ningún runner lo alcanza. Hay que publicarlo con TLS o migrar a SonarCloud |
| **`no-restricted-imports` sobre `"axios"`** | Sin esa barrera, la migración de `httpClient` se deshace sola con el primer import despistado. Es una regla en `frontend/eslint.config.cjs` con excepción para `httpClient.js` |
| **Reconstruir las imágenes del backend** | El `unzip` explícito de los Dockerfiles **no está verificado por build** |
| **`tmpfs: /tmp` del signer en prod** | Ya no cubre el workspace, que se movió a `/var/lib/deasy-signer`. Volverlo a RAM exige `--mount type=tmpfs,tmpfs-mode=0700` con uid: la sintaxis corta dejaría la raíz `root:root 1777`, que es el problema que se cerró |
| **26 ficheros migrados a `httpClient` sin red unitaria** | Tres no se pudieron ejercitar ni en navegador: `FirmarPdf.vue`, `VerifyEmail.vue`, `SessionExpiryModal.vue` |
| **El contrato de errores no se cumple** | El backend usa hoy **15 formas distintas** de responder un error en 309 respuestas, y **han aparecido dos nuevas** desde el censo. El plan está en [`referencia/contrato-errores-api.md`](./referencia/contrato-errores-api.md) §6, fases B–G, **ninguna empezada**: quedan ~114 lecturas manuales de `.data.error`/`.data.message` en 33 ficheros del frontend |
| **Duplicación de `createZipArchive`** | Copiado en `templateArchive.js` y `user_controler.storage.js`. Es el 40,5 % de duplicación de `templateArchive` |
| **`deasy-analytics` es un contenedor vacío desplegado en QA y en producción** | `docker/analytics/Dockerfile` son 9 líneas que acaban en `CMD ["sleep","infinity"]`: sin `COPY`, sin `pip install`, y **no existe ningún directorio `analytics/` en el repo**. Aun así se construye en cada push, se publica en GHCR y corre con `restart: always` (`docker/compose.prod.yml:92`). **Decidir: construirlo o sacarlo del pipeline.** Mantener el sobre vacío cuesta build, superficie en prod y confusión documental |
| **El bot de WhatsApp no puede arrancar en las imágenes publicadas** | `docker/backend/Dockerfile` fija `PUPPETEER_SKIP_DOWNLOAD=true` (líneas 4 y 31) y **no instala Chromium en ninguna de las dos etapas** — las libs de `apt` que sí instala son las de `node-canvas` (cairo/pango/jpeg/gif/rsvg), no las de un navegador. `services/whatsapp/WhatsAppBot.js` levanta Puppeteer en proceso, así que en QA y prod hay **6 rutas HTTP vivas sobre código que no puede iniciarse**. Decidir: instalar Chromium, o retirar el bot y sus rutas |
| **`amqplib` es dependencia muerta, y el signer habla por la API de *management*** | Está en `backend/package.json:27` con **cero imports en todo el backend**. Lo que se usa de verdad es `services/infrastructure/rabbitmq_http.js`, que publica y consume por la **API HTTP de gestión** de RabbitMQ (`POST /exchanges/.../publish`, `POST /queues/.../get`), con `rabbit_signer.js:27-41` haciendo *busy-polling* cada segundo hasta 120 s. RabbitMQ documenta que `basic.get` por management API no es un consumidor de producción. Efecto medido: hasta ~240 llamadas HTTP por firma, y **una cola durable huérfana por cada timeout** (`rabbit_signer.js:20` las crea `auto_delete:false` y nadie las borra) |

---

## Frente 8 · Deuda de volumen que el plan no registra — ⬜

Descubierto al medir el repo entero el **2026-08-09** (99 039 líneas de código: frontend 54 074 ·
backend 40 350 · signer 4 341). El plan maestro publica **una sola** cifra de líneas —HomeView, 5 215—
y es **exacta al dígito**. El problema no es que mienta: es que **no cubre**. Hay ~16 000 líneas en
ficheros grandes que solo aparecen en `referencia/`, y `referencia/` **se consulta, no se ejecuta**.
Resultado: masa sin ruta de trabajo asignada.

| Qué | L | Por qué está aquí |
|---|---:|---|
| `backend/services/admin/templates/templateLifecycle.js` | **1 749** | **4.º fichero del repo** y cero menciones en este documento. Su carpeta (`services/admin/templates/`, 4 128 L) es el **6.º directorio**. Contradice de frente el «la cabeza ya no está en el backend» del frente 3 |
| `frontend/src/shared/components/widgets/WorkspaceChatLauncher.vue` | 813 | **Deuda 100 % invisible: no aparece en NINGÚN fichero de `docs/planes/`.** Componente compartido, 517 L de script |
| `backend/controllers/users/user_controler.queries.js` | 1 091 | **Fuga de capa autodeclarada**: su propia cabecera dice que es «el candidato natural a promoverse a `services/users/UserWorkspaceRepository.js` cuando se corrija la fuga de capa (SQL crudo en un controller)». El código pide el arreglo y ningún plan lo recoge. Ojo: su CC es ≈0 (824 de sus líneas son literales SQL), así que **esto no es trabajo de complejidad, es de capas** |
| `backend/services/admin/crud/tableHooks.js` | 1 137 | **El caso que hay que decidir, no asumir.** Su cabecera lo presenta como «el equivalente backend de `FK_TABLE_MAP`» —o sea datos declarativos— pero contiene ~180 bloques de función. No está declarado no-tocar en ninguna parte |

**Y una corrección a la receta del frente 3, medida:** «un `<template>` de 2 000 líneas» **solo aplica
a HomeView** (2 118 L de marcado frente a 3 011 de script). En los otros diez `.vue` grandes el
`<script>` es el **60–75 %** — `AdminTableManager` es 1 037 / 3 184. Tratarlos igual desperdicia
esfuerzo: HomeView pide extraer **componentes**; los demás, **composables**.

**Criterio de cierre:** los cuatro con una decisión escrita (atacar, o declarar no-tocar con su
motivo). No hace falta refactorizarlos para cerrar el frente; hace falta que dejen de ser invisibles.

---

## Frente 9 · La capa de datos — ⬜ · vive en [`plan_data/`](./plan_data/)

**El único frente con carpeta propia**, porque trae su propia referencia medida del esquema. Nació el
**2026-08-09** al contestar *«¿conviene una clase por cada tabla?»* —la respuesta es **no**, razonada
con cifras en su §0—, pero la pregunta obligó a mirar la persistencia entera y aparecieron seis
problemas que ningún frente de aquí cubría. **Las tareas están allí**, no en este documento:

| | Fase | Por qué |
|---|---|---|
| **D1** | Un solo `withTransaction` | **20 `beginTransaction` a mano en 11 ficheros**, cada uno con su ciclo. El helper correcto ya existe (`crud/tableHooks.js:65-92`) y solo lo usa el CRUD admin |
| **D2** | Un vocabulario de estados, no cinco | `task_items.status` está definido en **5 sitios con 3 alfabetos**, y los dos grupos **no comparten ni un literal**. Efecto vivo: el panel cuenta `completada` como cerrado; el motor de relevos lo reasigna |
| **D3** | Migraciones versionadas | El esquema se reaplica entero en cada arranque (`postgres_initializer.js:23-40`). Idempotente para crear, **incapaz de alterar**. Es el mayor riesgo operativo de la capa |
| **D4** | Repositorios **por agregado** (10, no 67) | Cierra la fuga de capa del frente 8: `user_controler.queries.js` → `UserWorkspaceRepository` |
| **D5** | Matar el traductor de dialecto | `config/postgres.js`: **241 cognitiva en 391 ncloc**, el más denso del repo, y los defectos 1.5/1.6/1.11 salieron todos de ahí. **D5-b está ⛔ hasta censar los call sites del 1.11** |
| **D6** | Validación por esquema en el borde | 0 dependencias de validación; tres capas artesanales desconectadas, y las rutas fuera del CRUD admin sin ninguna |

**No contradice nada de lo de abajo.** Rechaza la clase por tabla y el ORM por el mismo criterio que
cierra la pregunta arquitectónica: tablas y extracción, no jerarquías. Y respeta la lista de no-tocar
—el núcleo CRUD de `SqlAdminService` y `sqlTables.js` como datos—: D2 y D4 trabajan **alrededor**.

**Criterio de cierre:** las seis fases cerradas con sus criterios, y la carpeta archivada.

---

## Lo que NO se toca, y por qué

Está detallado en [`referencia/metodo.md`](./referencia/metodo.md). El resumen, para que nadie «mejore»
lo que ya está bien:

- **`backend/config/sqlTables.js`** y su gemelo del frontend: son **datos**. La duplicación es la forma correcta.
- **`AdminTableManager.vue`**: motor de metadatos legítimo. Extraer los injertos, **sin polimorfismo**.
- **`useDeliverableView.js`**: proyección de solo lectura, medido. Hacerlo dueño de su estado **invertiría** el acoplamiento.
- **`_resolveDraftRequest`** (CC 25): es una cascada de guardas y **su ORDEN es contrato** —caracterizado, y el frontend distingue los mensajes—. Convertirla en tabla es tentador y arriesgado.
- **Los falsos positivos ya marcados** (§7 de la referencia): 28 marcas vivas, entre ellas las 23 de `S1135`, que son la palabra española «todo» en comentarios.
- **Las 48 incidencias de ternarios anidados y las 28 de regex**: sin fase **a propósito**. Reescribir un ternario cambia estructura, no forma; las regex piden mirarse una a una y solo el ReDoS de `AgregarReferencia` tiene riesgo real. **Es deuda decidida, no olvidada.** Si se atacan, que sea por un motivo concreto, no por bajar el contador.

---

## La pregunta arquitectónica está cerrada (2026-08-09)

Se evaluaron **quince arquitecturas** contra este repo, con medición y no con doctrina: monolítica,
monolito modular, en capas, N-capas, SOA, microservicios, serverless, event-driven, P2P, space-based,
hexagonal, clean, onion, DDD, y los patrones CQRS / Event Sourcing / Pipes & Filters / Blackboard /
Broker. **Ninguna baja la complejidad cognitiva de este sistema.** Queda escrito aquí para que no
vuelva a plantearse de cero dentro de tres meses.

**Las tres pruebas son internas, no teóricas:**

1. **El signer ya está distribuido al máximo** —proceso propio, runtime propio, RabbitMQ + MinIO— y es
   **el peor fichero del repositorio** (`app.py`, cogn ~353). La separación no le quitó un punto, y le
   añadió R-1 y R-10, que **existen únicamente porque está fuera**.
2. **El realtime se distribuyó y se deshizo, y salió bien.** EMQX exigía un sistema de credenciales y
   ACL espejo del de la app que nunca se construyó; al colapsarlo dentro (`RealtimeGateway.js:14-20`)
   la autorización se **reutiliza** en vez de duplicarse.
3. **`deasy-analytics` es el aviso**: un microservicio sin código lleva meses desplegado en QA y prod.
   En este repo el sobre del microservicio se paga aunque esté vacío (ver frente 7).

**Lo que impide cualquier corte, medido:** el **45 % de las FKs** cruzan cualquier frontera de dominio
que se dibuje; hay **ciclos de FK bidireccionales** entre procesos ↔ plantillas ↔ firma, así que
ningún lado puede ser dueño del dato; y de los **18 puntos de `beginTransaction`, cero quedan dentro
de un solo subdominio** —todos abarcan 3 o 4—. Cada corte convierte transacciones ACID en sagas, sin
tracing, sin métricas, sin logging estructurado y con un mantenedor.

**Y las que «sí aplican» ya están implementadas.** Monolito modular y capas: 0 violaciones
`routes→services`, 0 `services→controllers`, 0 `req`/`res` filtrados a `services/`. Hexagonal/Clean:
la inyección ya existe (`constructor(pool = getPostgresPool())`), y **sin TypeScript un «puerto» es un
comentario**. Adoptarlas formalmente es reetiquetar carpetas: **0 puntos de complejidad**.

**El dato que reencuadra el problema:** `HomeView.vue`, con ~350 de complejidad agregada, tiene **cero
incidencias `S3776` abiertas**. Su complejidad no está en ninguna función —está repartida en cientos
de ramas planas y 2 118 líneas de `<template>`—, y **ninguna arquitectura opera a esa escala**. Lo que
sí funcionó aquí está medido cuatro veces y es intra-función: `validateTableRules` 99→0,
`postgres.js` 108→15, `useAdminSubmitFlow` 67→7, `saveTemplateArtifactDraft` 164→21.

> Esto **extiende** la postura de [`referencia/patrones-diseno.md`](./referencia/patrones-diseno.md)
> un piso hacia arriba: si los patrones GoF solo se ganan el sueldo en tres sitios de este repo, los
> patrones **arquitectónicos** no se lo ganan en ninguno.

**Lo único de las quince con retorno medible en complejidad**, y llega por la puerta que este repo ya
aprueba (quitar duplicación, no añadir jerarquía): **extraer el CTE del subárbol organizacional**,
hoy duplicado **8 veces en 5 ficheros**, con **dos bloques byte-idénticos dentro de una sola función**
(`services/admin/generation/assignees.js:11`, cogn 33). Vale **−30 a −50 puntos**. Si se ataca, el SQL
va probado con `PREPARE` antes de borrar cada copia, y los goldens **no se mueven**.

---

## Una advertencia sobre las expectativas

Entre el 2026-08-06 y el 08-09 las incidencias cayeron de 832 a 373 y la deuda de 4 902 a 2 846
minutos. **Eso no se va a repetir.** Aquella caída la produjeron seis reglas que se cerraban en bloque
—imports muertos, `replace`→`replaceAll`, falsos `TODO`, etiquetado de formularios— y **ya están las
seis cerradas**. Lo que queda pide criterio de una en una.

Medir progreso por el contador de incidencias a partir de aquí lleva a la frustración. Los indicadores
buenos ahora son otros: **defectos reales cerrados**, **cobertura de lo nuevo**, y que las notas no
bajen.
