# Frente 23 · Plantillas y entregables: quitar lo que se dice dos veces

**Abierto el 2026-10-04**, por una objeción del dueño que resultó correcta: *«lo que yo veo es que aquí
hay una masa de puro enredo que necesita aclararse y simplificarse a un modelo claro y entendible»*.

Este plan **no se ejecuta hasta que el dueño lo apruebe**. Lo que sigue es lo medido, los dos errores
que cometí por el camino, y la propuesta.

## Estado general — **4 de 9**

| Fase | Tareas | Estado |
|---|---|---|
| **F1** · La regla de pertenencia, en la base | F1.1 ⬜ · F1.2 ⬜ · F1.3 ⬜ | ⬜ **0 de 3** |
| **F2** · Las tres copias del lado entregado | F2.1 ⬜ · F2.2 ⬜ | ⬜ **0 de 2** |
| **F3** · La semilla pasa a ser catálogo de generadores | F3.1 ✅ · F3.2 ✅ | ✅ **2 de 2** |
| **F4** · Los campos que nadie consume | F4.1 ✅ · F4.2 ✅ | ✅ **2 de 2** |

**F3 y F4 se ejecutaron el 2026-10-04**, aprobadas por el dueño y por separado del resto: no tocan
el eje de la pertenencia (`deliverables.owner_*`), que es lo que F1 espera a que se analice.

---

## Lo que se midió, y son hechos

### A · `deliverables` no guarda ningún fichero

Sus 10 columnas: 1 identificador, **3 de identidad** (`code`, `display_name`, `description`),
**3 de dueño** (`owner_process_id`, `owner_variation_key`, `owner_person_id`), 1 de scope, 1 de
semilla, 1 de fecha. **Ni una columna de archivo.** La metáfora del «libro» escondía esto: no es un
libro, es **un nombre**.

Lo único que hace de verdad, y es legítimo: **dar una identidad estable que sobreviva a las versiones
de la plantilla.** Sin ella, la v1 y la v2 serían dos cosas sin relación.

### B · Las 3 columnas de dueño las lee UN solo sitio

**33 consultas del backend leen `deliverables`.** Las 33 hacen lo mismo:
`JOIN deliverables ON id = deliverable_id`, para sacar el nombre.

**Ninguna** filtra ni selecciona por `owner_process_id` ni `owner_variation_key`. Su único lector en
todo el sistema es `assertDeliverableBelongsToConfigLine`, el guardia que las compara con la
definición. Y el índice `idx_deliverables_owner` **no lo usa nadie**: ninguna consulta puede
aprovecharlo.

> La columna duplica un dato que ya se alcanza por el vínculo → la duplicación obliga a un guardia
> que compruebe que coinciden → **el guardia es el único lector de la columna**.

### C · El esquema permite lo que el código intenta prohibir

El único índice único de `process_definition_templates` es sobre **la pareja**
`(process_definition_id, template_artifact_id)`. Así que la base **permite** que una versión de
plantilla se vincule a muchas definiciones, de distintas variaciones y de distintos procesos.

Lo único que lo intenta es el guardia, y **comprueba el proceso pero NO la variación** — mientras el
invariante que dice proteger es sobre `(proceso, variación)`.

### D · La misma pregunta, en tres sitios

«Qué versión de plantilla» está escrito tres veces. Con los datos de dev, donde los tres dicen `2`:

```
① process_definition_templates.template_artifact_id    la configuración lo dice
② task_items.template_artifact_id                      los 17 entregables lo copian
③ document_versions.template_artifact_id               cada ronda lo copia otra vez
```

Y `task_items` guarda además `process_definition_template_id`, que apunta al vínculo que **ya lo
dice**. Coinciden hoy porque solo existe una versión de cada plantilla. **Nada obliga a que coincidan.**

### E · La semilla, y lo que la opción LaTeX llegó a ser

`template_seeds` es **una fila**: `latex/informe-general`, apuntando a un prefijo de MinIO con un
**proyecto LaTeX completo** donde cada sección es una plantilla Jinja2 (`main.tex.j2`, `make.sh` de
6,6 KiB, `Preambulo/`, `Contenido/Cuerpo/01_Resumen…06_Recomendaciones`, `Anexos/`, `Firmas/`,
`defaults.yaml`, `schema.json`).

Al crear una plantilla, **ese proyecto se copia entero** a `System/<código>/<versión>/template/jinja2/`.
Del `schema.json` se escriben **18 filas** en `template_artifact_fields`.

Y lo que **no** existe, medido:

| | |
|---|---|
| El formulario web que rellena esos 18 campos | **no existe** |
| El renderizador (Jinja2 → LaTeX → PDF) | **no existe.** Nada ejecuta `make.sh` |
| El editor de campos | **no existe.** El frontend no menciona `template_artifact_fields` ni una vez |
| El único lector de los 18 campos | el código que **los copia a la versión siguiente** |

**Esa tabla existe para copiarse a sí misma.** Y la consecuencia práctica: hoy, para definir un
documento, hay que escribir un proyecto LaTeX+Jinja2. **No hay ningún camino que no pase por editar
`.tex.j2` y `schema.json`.**

---

## Los dos errores que cometí, escritos para que no se repitan

**1 · Dije «el modelo está bien» leyendo los comentarios del propio modelo.** El esquema se describe a
sí mismo como «ENTREGABLE (el "libro"): identidad + DUEÑO», y yo repetí eso como si fuera una
evaluación. No evalué nada. El dueño me había advertido expresamente de no fiarme de los comentarios
ni de la documentación.

**2 · Dije que «un entregable ad-hoc no tiene vínculo», y es FALSO.** El dueño contestó que era *«el
cuarto agente al que corrijo en eso»*, y tenía razón. Medido:

- `GeneralTaskService.js:23` → `const GENERAL_PROCESS_SLUG = "default"`: las tareas ad-hoc cuelgan
  del **Proceso por defecto**, que existe exactamente para eso;
- sus **dos** caminos de alta (líneas 273 y 445) insertan `process_definition_template_id`, tomado de
  la configuración activa de ese proceso;
- y `template_artifact_id` lo copian **del propio vínculo**;
- solo **dos ficheros** insertan en `task_items`, los dos ponen el vínculo, y en los datos son
  **17 de 17**.

**Consecuencia:** la copia ② no tiene ni la excusa que yo le había dado. Es una copia del vínculo en
**el 100 % de los casos**, ad-hoc incluidos. La propuesta de abajo es más simple por eso.

---

## La decisión del dueño, y lo que implica

> *«Una versión de plantilla debería servir a solo una variación de proceso. Si hago un cambio a la
> versión de plantilla eso debería llevar a una nueva definición de proceso.»*

Eso se expresa con **un índice único**, y la base pasa a sostener la regla sola:

```sql
-- en lugar del único actual sobre la PAREJA
CREATE UNIQUE INDEX uq_pdt_artifact ON process_definition_templates (template_artifact_id);
```

| La regla | Cómo queda sostenida |
|---|---|
| una versión de plantilla → una sola variación | **la base lo impide**. No hace falta guardia |
| cambiar la plantilla → nueva definición de proceso | **sale solo**: la versión nueva no tiene vínculo y la vieja ya ocupa el de su definición |

Verificado: los datos ya la cumplen (artefacto 1 → 1 vínculo, artefacto 2 → 1 vínculo).

---

## ANTES y DESPUÉS

### El lado de la plantilla

```
──────────────────────────── ANTES ────────────────────────────

  template_seeds                     processes
  «copia este proyecto LaTeX»            ▲
        │                                │ owner_process_id        ← 1 solo lector:
        │ template_seed_id                │                           el guardia
        ▼                                │
  deliverables ───────────────────────────┘
  code · display_name · description
  owner_process_id · owner_variation_key · owner_person_id
  template_scope · template_seed_id
        │
        ▼
  template_artifacts            ◄──── process_definition_templates
  storage_version                     UNIQUE(definicion, artefacto)   ← permite N vínculos
  lifecycle_state                     item_mode · sort_order
  base_object_prefix
  schema_object_key ──┐
        │             │
        ▼             ▼
  template_artifact_fields (18 filas)   schema.json en MinIO
  «los campos que el usuario rellenará»  ← nadie los lee para eso


──────────────────────────── DESPUÉS ───────────────────────────

  generadores_de_documento               processes
  code · nombre · tipo · destino              ▲
  source_path · preview_path                  │ (derivado por el vínculo)
  «QUIÉN produce el PDF»                      │
        │                                     │
        │                               deliverables
        │                               code · display_name · description
        │                               owner_person_id · template_scope
        │                               (las 3 columnas de dueño: FUERA) ──┘
        │                                     │
        │ generador_id                        │
        ▼                                     ▼
  template_artifacts            ◄──── process_definition_templates
  storage_version                     UNIQUE(template_artifact_id)   ← un solo vínculo
  lifecycle_state                     item_mode · sort_order
  base_object_prefix
  content_hash
  generador_id                   ← NUEVA. Era deliverables.template_seed_id
  (schema_object_key: FUERA)     ← derivable de base_object_prefix

  (template_artifact_fields: FUERA)
  (template_seeds: pasa a ser generadores_de_documento)
  (deliverables.template_seed_id: FUERA — se movió a la edición, no se duplicó)
```

### El lado entregado

```
──────────────────────────── ANTES ────────────────────────────

  process_definition_templates ─── template_artifact_id = 2   ①
        │
        │ process_definition_template_id
        ▼
  task_items ───────────────────── template_artifact_id = 2   ② copia
        │
        ▼
  document_versions ───────────── template_artifact_id = 2    ③ copia
        │
        ▼
  document_version_uploads

  Los tres coinciden hoy. NADIE lo obliga.


──────────────────────────── DESPUÉS ───────────────────────────

  process_definition_templates ─── template_artifact_id       ① la ÚNICA fuente
        │
        │ process_definition_template_id   (NOT NULL: los 17 ya lo tienen)
        ▼
  task_items                      (sin template_artifact_id)
        │
        ▼
  document_versions ───────────── template_artifact_id
        │                          ↑ significa otra cosa: «con qué versión
        │                            se generó ESTA ronda». Obligatoria
        ▼                            en cuanto hay render
  document_version_uploads
```

---

## Las fases

### F1 · La regla de pertenencia, en la base — 0 de 3

| Tarea | Qué entrega |
|---|---|
| **F1.1** | El índice único sobre `template_artifact_id`, sustituyendo el de la pareja |
| **F1.2** | Fuera `deliverables.owner_process_id`, `owner_variation_key` y el índice muerto `idx_deliverables_owner` |
| **F1.3** | Fuera `assertDeliverableBelongsToConfigLine` y sus llamadas (`tableHooks.js:662`, `templateLifecycle.js:407`), y el guardia incompleto del clon |

**Efecto lateral medido:** quitando `owner_process_id` desaparece la dependencia circular entre los
temas `plantillas` y `procesos`, y el esquema **se puede partir en 15 ficheros sin mover ninguna tabla
de tema** — el bloqueo del frente 22 (F6.5) era un síntoma de esta redundancia.

### F2 · Las tres copias del lado entregado — 0 de 2

| Tarea | Qué entrega |
|---|---|
| **F2.1** | `task_items.process_definition_template_id` pasa a `NOT NULL` y se retira `task_items.template_artifact_id`: se lee por el vínculo. Los 9 sitios que la consultan pasan por el `JOIN` que ya hacen |
| **F2.2** | `document_versions.template_artifact_id` se queda, **documentada como lo que es**: con qué versión se generó esa ronda. Obligatoria en cuanto hay render |

### F3 · La semilla pasa a ser catálogo de generadores — 0 de 2

**Es la propuesta del dueño, y es mejor que la mía.** Yo preguntaba «¿quién dice de dónde sale el
fichero de la plantilla?» —hoy lo dice `template_seeds`, porque el fichero es **una copia de la
semilla**—. Si se borra la tabla, esa pregunta queda sin respuesta.

Su propuesta cambia el **significado** de la tabla en vez de borrarla: deja de ser *«el esqueleto que
se copia»* y pasa a ser *«el **servicio** que produce este documento»* — los procesos automáticos que
se irán programando desde los Word.

| Tarea | Qué entrega |
|---|---|
| **F3.1** | ✅ `template_seeds` → `generadores_de_documento`: `code`, `nombre`, `tipo` (`latex`\|`servicio`, con CHECK), `destino`, `source_path`, `preview_path`, `description`, `is_active` |
| **F3.2** | ✅ `template_artifacts.generador_id` apunta ahí, y **sustituye a `deliverables.template_seed_id`**, que se retira |

⚠️ **AQUÍ DECÍA QUE `generador_id` SUSTITUÍA A `render_engine`, Y ERA FALSO.** Corregido al
ejecutar, el 2026-10-04. `render_engine` **no está en `template_artifacts`**: está en
`document_versions`, y significa otra cosa — *con qué motor se renderizó ESTA ronda*, que es un hecho
de la ejecución y no una declaración de la plantilla. Son dos columnas distintas en dos tablas
distintas, y **`render_engine` NO se toca: queda fuera de este frente.** Lo fija una prueba en
`backend/database/postgres_schema.test.js` para que la confusión no vuelva por inercia.

⚠️ **Y el diagrama de ANTES/DESPUÉS de más arriba se contradecía con esta tabla**: dibujaba
`generador_id` colgando de `deliverables` (donde estaba `template_seed_id`) mientras el texto lo
ponía en `template_artifacts`. Se resolvió **a favor del texto**, con un argumento y no por
desempate: `sqlTables.js` ya listaba «Semilla» como campo de `template_artifacts` y
`SqlAdminService` lo traía por JOIN desde `deliverables` — o sea que la fachada del admin ya decía
que el sitio del dato era la edición. **Es un MOVIMIENTO, no una suma**: la columna vieja se retira
en el mismo commit, para no dejar dos punteros al mismo catálogo.

⚠️ **La semilla LaTeX no se borra**: sigue siendo un generador válido, el primero del catálogo. Lo que
cambia es que deja de ser **el** mecanismo para ser **uno**.

**Qué se conservó de la semilla, y por qué** (ejecutado el 2026-10-04):

| Columna | Por qué se queda |
|---|---|
| `source_path` | Es el prefijo de MinIO del proyecto LaTeX, y `_materializeDraftFormats` lo necesita para copiar `src/`, `defaults.yaml` y `render/` al crear una plantilla. Sin él no se puede crear ninguna. **Pasa a NULL**: un generador `servicio` no copia paquete |
| `preview_path` | Lo rellena el descubrimiento (`syncTemplateSeeds`) y lo sirven las rutas de vista previa y descarga. Tiene productor y lector |
| `description` | Se edita y se lista en `/admin`. Conserva su nombre a propósito: se renombra lo que **cambia de significado** (`seed_code`, `display_name`, `seed_type`), no lo que sigue queriendo decir lo mismo |

Y `destino` es NULL por el mismo motivo por el que `source_path` lo es: son **las dos mitades
excluyentes** del catálogo. Un `latex` trae paquete y no llama a nadie; un `servicio` tiene cola o
endpoint y no trae paquete. Se guarda como **texto libre** y no como dos columnas porque hoy no hay
ni un consumidor, y partirla antes de saber cómo se invoca sería inventar la forma del contrato por
adelantado.

### F4 · Los campos que nadie consume — 0 de 2

| Tarea | Qué entrega |
|---|---|
| **F4.1** | ✅ Fuera `template_artifact_fields` (18 filas por plantilla que solo se copian a sí mismas) y `schemaFieldRows.js` |
| **F4.2** | ✅ Fuera `template_artifacts.schema_object_key`, que apunta al `schema.json` copiado |

El `schema.json` de MinIO **sigue existiendo** y el editor de `/admin` lo sigue leyendo y
escribiendo: lo que se fue es su REFLEJO en la base. Y la clave del fichero se **deriva** de
`base_object_prefix` (`schemaObjectKeyForPrefix`, en `services/admin/templates/artifacts.js`), que es
exactamente lo que los dos productores de la columna escribían.

⚠️ **El día que un generador tenga que decirle a la web qué preguntar, ese contrato tendrá que vivir
en algún sitio.** Quitar la tabla ahora es correcto —no está haciendo ese trabajo—; volver a
necesitarlo será **otro diseño**, no esta tabla resucitada. El argumento de por qué no es la misma
tabla, escrito en el esquema donde ella estaba: **el modelo cambió debajo**. Ahora el productor es
`generadores_de_documento`, no una semilla que se copia, así que el contrato cuelga del **generador**
—uno por servicio, estable— y no de **cada edición de cada plantilla**, que es exactamente la copia
que no pagaba nada.

---

## La decisión de arquitectura que hay detrás

El dueño planteó dos caminos:

| | |
|---|---|
| **Opción 1** | La semilla LaTeX reutilizable + un JSON controlado por `template_artifact_fields` → PDF directo |
| **Opción 2** | Las plantillas como están, y el llenado web **desacoplado de la semilla**: servicios separados, programados caso a caso, que generan el PDF |

**Elegida: la 2**, y el argumento es medido, no estético:

- de la opción 1 está hecho el **20 % fácil** (copiar ficheros, reflejar un esquema) y **no paga
  nada**: ni formulario, ni editor de campos, ni render;
- lo que falta es el 80 % duro —motor de formularios genérico, servicio de compilación LaTeX, editor
  de campos, editor de código—, que **es un producto en sí mismo**;
- y aunque se construyera, un documento real necesita maquetación: el gestor acabaría tocando LaTeX
  igual. El *«el gestor no programa»* se cumpliría solo para documentos triviales.

Como dijo el dueño: *«la opción 1 es querer convertir al gestor en programador y no es buena idea»*.

---

## Lo que queda fuera de este plan

**Variaciones frente a reglas de alcance.** El dueño sospecha duplicación entre
`process_definition_versions.variation_key` y la tabla `process_target_rules`. Es un análisis propio y
se abre aparte: puede cambiar parte de F1, así que **F1 no se ejecuta antes de ese análisis**.

## Control de ejecución

| Tarea | Qué entrega | Evidencia | Fecha |
|---|---|---|---|
| **F3.1** | `template_seeds` → `generadores_de_documento`, con `tipo` bajo `CHECK` y `destino`. La semilla LaTeX queda como su primera fila, sembrada por el bootstrap | `postgres_schema.sql`; 4 pruebas nuevas en `postgres_schema.test.js`; `validation.js` pasa a exigir identidad siempre y paquete sólo al tipo `latex`; **las 3 rutas del catálogo renombradas** (`/admin/sql/generadores_de_documento/{sync,:id/preview,:id/download}`) con su frontend; golden `admin_crud :: list_generadores_de_documento` capturado y `list_template_seeds` retirado | 2026-10-04 |
| **F3.2** | `template_artifacts.generador_id` con su FK, **movida** desde `deliverables.template_seed_id` | `postgres_schema.sql`; `sqlTables.js` (de campo de fachada a columna física) y `SqlAdminService` (fuera del `TA_DELIV_COLS`); el generador se **hereda** al versionar y al bifurcar; goldens `artifact_draft` y `user_workspace :: panel_usuario` movidos | 2026-10-04 |
| **F4.1** | Fuera `template_artifact_fields`, `schemaFieldRows.js` (+ su test) y la suite `zzzzzzzz_schema_fields_db` (+ su golden) | 3 lectores resueltos: `templateArtifact.js` (copia al versionar), `templateLifecycle.js` (escritura doble + copia al bifurcar) y `SystemBootstrapService.js` (volcado de los 18 campos del seed). **Epitafio en el esquema** con el por qué y dónde vivirá el contrato el día que haga falta; 8 pruebas de la tabla sustituidas por 3 en negativo | 2026-10-04 |
| **F4.2** | Fuera `template_artifacts.schema_object_key` | `schemaObjectKeyForPrefix` en `artifacts.js` deriva la clave del prefijo; `getTemplateArtifactSchema` la usa; los 4 `INSERT`/`UPDATE` que la escribían dejan de hacerlo | 2026-10-04 |

**Verificación de F3+F4** (pila C, 2026-10-04): `test:unit` 879/879 · `test:char:run` 320/320 ·
`check:imports` OK (167 ficheros) · `check:sql-comments` OK (272 ficheros) · `check:sql-aliases` OK
(548 consultas) · `check-mapa-tablas` OK (92 tablas) · `check-doc-modelo` OK (92 tablas, 837 nombres)
· `check-enlaces-internos` OK (0 roto / 54 páginas) · `check-diagramas-coherentes` OK (94 tablas).

**Goldens que se movieron, y por qué** — ninguno por sorpresa, los cuatro son la forma de la fila:

| Golden | Qué cambió |
|---|---|
| `admin_crud :: list_template_artifacts` | `itemKeys`: entra `generador_id`, salen `schema_object_key` y `template_seed_id` |
| `admin_crud :: list_generadores_de_documento` | Golden NUEVO (y se borra `list_template_seeds`): la tabla cambió de nombre y de columnas |
| `artifact_draft` (3 casos) | La respuesta del borrador devuelve `generador_id` en vez de `template_seed_id`, y ya no devuelve `schema_object_key`. **El `content_hash` NO se movió**, que es la prueba de que el paquete de MinIO es idéntico |
| `user_workspace :: panel_usuario` | El panel servía `tar_dl.template_seed_id`; ahora sirve `tar.generador_id` |

**Lo que NO se tocó, a propósito:** `document_versions.render_engine` (otra tabla, otro significado
— ver el aviso de F3.2), el `schema.json` de MinIO y su editor de `/admin`, y todo el eje de la
pertenencia que F1/F2 esperan.
