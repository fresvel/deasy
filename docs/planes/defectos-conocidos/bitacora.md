# Bitácora del frente 1 — los nueve cerrados

> Esto **no es historia decorativa**. La mitad del valor de cada ficha es *por qué no se hizo de la
> otra forma*: hay cuatro sitios de este repo donde la «corrección obvia» es la equivocada, y están
> aquí. Léela antes de proponer un arreglo que se le parezca.
>
> Lo pendiente está en [`plan-defectos-2026-08.md`](./plan-defectos-2026-08.md).

| # | Defecto | Cerrado | Golden |
|---|---|---|---|
| 1.1 | El `fileFilter` de multer suelta el stack trace en HTML | 2026-08-09 · `1ff3370`+`040a9d0` | 2 nuevos |
| 1.2 | `approve` del último paso sin PDF → 500 | 2026-08-09 | `approve_sin_pdf` |
| 1.4 | Se pueden enumerar los jobs de otros usuarios | 2026-08-09 | 2 movidos |
| 1.5 | `bindParams` con parámetros de menos → NULL silencioso | `e0cdae9` | **ninguno, y es correcto** |
| 1.6 | `translatePlaceholders` es código muerto | `d25034b` | — |
| **1.9** | «Una copia del IDOR se quedó atrás» | **NO ERA UN DEFECTO** | — |
| 1.12 | Se activa una configuración con una plantilla sin publicar | 2026-08-10 · `e6d291d`+`73d2e82` | 1 nuevo |
| 1.13 | `template_artifacts.lifecycle_state` nace `published` | 2026-08-10 · `673f1fb` | **ninguno, y es correcto** |
| 1.14 | Clonar una configuración convertía en `single` todo lo `routed` | 2026-08-11 · `597cd43` | 1 línea |

---

## 1.1 · El `fileFilter` de multer suelta el stack trace completo en HTML

**Dónde**: `user_router` y `dossier_router`.

**Cómo se cerró.** Goldens nuevos `dossier_mimetype_rechazado` y `certificado_mimetype_rechazado`,
capturados **antes** del fix para que el diff existiera: `status 500→400`, `esHtml true→false`,
`filtra_stack_trace true→false`.

> **Lo que hay que recordar: montar el middleware no bastaba.** `describeUploadError` convierte
> cualquier error sin `statusCode` en un 500 genérico y **se traga el motivo** (por diseño), así que
> los cuatro `fileFilter` tuvieron que pasar de `cb(new Error(…))` a `cb(badRequest(…))`. **Anótalo
> si se monta en más routers.**

---

## 1.2 · `approve` del último paso sin PDF devolvía 500

**Dónde**: `FillRequestWorkflowService`.

**Se eligió 409, no 400**, y la razón vale para cualquier guard nuevo: la petición está bien formada
—ni siquiera lleva cuerpo— y el servidor está sano; lo que no admite la operación es el **estado del
recurso**, y el remedio del usuario es subir el PDF, no corregir su petición. Es además el código que
ya usaban los otros dos guards del mismo servicio, y así lo define `errors/HttpError.js`.

Al frontend le da igual el número (`HomeView.vue` pinta `data.error` en crudo), así que **el mensaje
se dejó idéntico** y el diff del golden es solo el código. Golden renombrado
`defecto_approve_sin_pdf` → **`approve_sin_pdf`**, `500 → 409`.

> **El segundo matiz —comprobar MinIO— se evaluó y se DESCARTÓ**, con las razones escritas encima de
> la propia consulta para que no se «arregle» otra vez:
>
> 1. La comprobación que garantiza algo **ya existe en el punto de uso**: `PdfSigningService.js:259`
>    hace `statMinioObject` justo antes de firmar. Repetirla aquí sería orientativa por TOCTOU.
> 2. **Invertiría las capas**: el servicio no sabe el bucket; necesitaría `resolveStoredDocumentObject`
>    y las constantes de `controllers/users/user_controler.storage.js`.
> 3. Iría **dentro de la transacción abierta**, y `minio_service.js` no fija timeout (medido: 24 ms en
>    frío, 3 ms en caliente).
> 4. **El error no mejoraría**: los dos casos tienen el mismo remedio y hoy ya salen 409.
> 5. El camino normal **no produce ese estado**: se sube a MinIO ANTES de escribir en la base, y en
>    transacción.
>
> Coste concreto de haberlo añadido: el caso feliz `approve_ok` aprueba con una ruta `.pdf`
> **fabricada**, así que habría que sembrar MinIO en el harness.

---

## 1.4 · Se podían enumerar los jobs de otros usuarios

**Dónde**: `BatchSigningService`.

**Se unificó en 404, no en 403**: es el código que no confirma existencia, ya era el del camino
frecuente, y el frontend no ramifica por código (`FirmarPdf.vue:2450` solo pinta `data.error`), así
que el dueño legítimo no nota nada.

> **El arreglo NO vive en el controller.** `getBatchJob` **se dejó de exportar** —leer un lote por id
> y sin dueño *es* el oráculo— y fuera solo se ofrece `getOwnedBatchJob`. Cerrar el agujero en el
> controller habría dejado la primitiva peligrosa a mano del siguiente.

Goldens `batch_status_ajeno` y `batch_download_ajeno`: `403 → 404`. Y los dos tests de caracterización
**comparan ajeno contra inexistente con `deepEqual`**, que es la propiedad de verdad —que sean
indistinguibles—, no el número.

---

## 1.5 · `bindParams` con parámetros de menos → `undefined` → NULL silencioso

**Dónde**: `backend/config/postgres.js`. Cerrado en `e0cdae9`.

Ahora lanza diciendo cuántos placeholders había y cuántos parámetros llegaron.

> **El mensaje NO incluye el SQL a propósito**: varios controllers responden `error.message` al
> cliente y sería filtrar el esquema justo mientras se arregla una fuga. El sitio exacto ya lo da el
> stack trace del log.

**Ningún golden se movió, y eso era lo correcto**: es un bug latente sin disparador vivo. Verificado
por dos vías —sonda en `bindParams` + `test:char:run` (0 casos en 240 flujos) y barrido de las 493
llamadas (0 desajustes en las 429 decidibles)—. **Ese es el método que hereda el 1.11.**

---

## 1.6 · `translatePlaceholders` era código muerto

**Dónde**: `backend/config/postgres.js`. Cerrado en `d25034b`.

> **Aviso para el próximo borrado de código muerto**: sus 33 tests **no probaban esa función** —
> caracterizaban el autómata `scanSql`, que `bindParams` sigue usando. Borrarlos junto con ella habría
> dejado ese escáner sin red. Se re-apuntaron a `bindParams`.

---

## 1.9 · NO ERA UN DEFECTO — no apliques el guard en `ChatAuthorizationService`

**Dónde**: `backend/services/chat/ChatAuthorizationService.js`. Comprobado el **2026-08-09**.

El diagnóstico original decía que el arreglo del IDOR se había aplicado copia por copia y que una
copia se quedó atrás. **Confundía el nivel de la fila.** El guard canónico responde «¿es TUYO este
entregable?» y protege consultas cuya FILA es un entregable; esta resuelve el hilo del **proceso en
una unidad**, donde el `LEFT JOIN task_items` solo abanica filas y lo único proyectado
—`scope_unit_id`, que sale de `t.responsible_position_id`— es idéntico en todas las filas de la tarea.

Tres razones, la última **medida** contra la base de dev:

1. **No cierra ninguna fuga**: el guard nunca RECORTA el conjunto de unidades accesibles, lo **vacía**.
2. La lista de participantes del hilo se construye de `task_assignments` **sin** filtrar por
   responsable de entregable, así que aplicarlo solo en el acceso dejaría gente dentro del hilo y con
   403 al abrirlo.
3. **8 de las 10 personas** asignadas a la tarea 8 (proceso 1, unidad 8) pasaban de `{8}` a **ninguna**
   unidad accesible. Y el corte dependería de datos ajenos: en la tarea 9 (misma forma, 10 asignados,
   **0 entregables**) el `LEFT JOIN` deja `ti` a NULL y las diez conservan el acceso — luego el hilo se
   les caería a ocho **en cuanto un compañero creara el primer entregable**.

Queda escrito en el propio fichero, encima de la consulta, para que no se «arregle» otra vez.

---

## 1.12 · Se podía activar una configuración con una plantilla SIN PUBLICAR enlazada

**Dónde**: `templateLifecycle.js` y `SqlAdminService.js`. Cerrado el 2026-08-10 (`e6d291d`+`73d2e82`).

**El diagnóstico se ejecutó antes de tocar nada**: golden nuevo
`defecto_borrador_colado_en_activacion` en `zz_template_lifecycle`, que crea un segundo entregable
dentro del borrador de configuración durante la actualización guiada y deja escrito el resultado —
`config_status: "active"` con `colado_lifecycle_state: "draft"`.

**El arreglo son las dos cosas, no una:**

- **(b)** `finishTemplateUpdate` **publica el resto de borradores enlazados**, igual que
  `tableHooks.js:605`, porque publicar los borradores **es la semántica de activar una configuración**
  en este modelo, no un detalle del CRUD. Y no publica en silencio: para *single*/*replicated* exige
  ≥1 paso de entrega y **aborta la activación entera** nombrando la plantilla.
- **(a)** El gate **rechaza la activación si queda algún entregable en `draft`**, nombrándolos, porque
  es el **único punto por el que pasan los dos caminos** y ahí la invariante se escribe una sola vez.

> **Endurecer SOLO el gate se descartó**: dejaba el update guiado sin salida mientras el otro camino
> de activación —el `PUT` genérico de `process_definition_versions`, real y caracterizado en
> `graft_pdv_update_activacion`— publicaba y activaba igual. **Dos caminos con resultados contrarios
> para el mismo estado es peor que el defecto.**

Dos detalles que no son estilo:

- El guard nuevo va **el último de los tres**: el orden de los mensajes es contrato.
- Dentro de la transacción, **la plantilla versionada se publica PRIMERO**, porque deja `is_active = 1`
  y el gate de artefactos activos depende de eso. `publishDraftTemplatesForDefinition` filtra por
  `lifecycle_state = 'draft'` y **no toca `is_active`**, así que ir después no la pisa.

Medido contra la base de dev (probe con rollback), SQL probado con `PREPARE`+`EXECUTE` en psql en las
dos ramas, 14 unitarios nuevos. **La clave del golden NO se renombró**: el diff `draft → published`
**es** la prueba (mismo criterio que `defecto_deliverable_huerfano`).

---

## 1.13 · `template_artifacts.lifecycle_state` nacía `published` por defecto

**Dónde**: `backend/database/postgres_schema.sql:523`. Cerrado el 2026-08-10 (`673f1fb`).

**La ficha original se equivocaba en dos puntos**, y quedan corregidos:

1. El bootstrap **NO dependía del DEFAULT** — `SystemBootstrapService.js:503` fija `'published'`
   explícitamente.
2. «Una fila creada por el CRUD genérico» **no era alcanzable**: `pickPayload` descarta la columna por
   `readOnly`, pero antes de eso `tableHooks.template_artifacts.beforeCreate()` **lanza siempre**.

Censados los **cuatro** `INSERT INTO template_artifacts` del repo: los cuatro fijan la columna. Era
por tanto un **defecto latente sin disparador vivo, como el 1.5** — ningún golden se movió.

> **Cómo se hizo efectivo, y esto se olvida:** no basta con cambiar el `CREATE TABLE`, porque
> `CREATE TABLE IF NOT EXISTS` **no toca una tabla que ya existe** y el cambio solo valdría para bases
> nuevas. Va con un `ALTER TABLE … SET DEFAULT` idempotente (mismo idioma que el `ALTER` de `persons`).
> El test vigila **el par** (definición + `ALTER`), que es lo único que puede romperse en silencio.

**Pendiente, y fuera del alcance de este frente:** `backend/config/sqlTables.js:385` y su gemelo del
frontend siguen declarando `defaultValue: "published"`, y el frontend arrastra ~8 fallbacks
`String(row.lifecycle_state || "published")`. Hoy es inerte, pero contradice el esquema, y **cambiarlo
exige tocar los dos gemelos a la vez**.

---

## 1.14 · Clonar una configuración convertía en `single` todos sus entregables `routed` y `replicated`

**Dónde**: `services/admin/processes/processDefinitionVersion.js:303-340`. Cerrado el 2026-08-11
(`597cd43`).

El `SELECT` del clonado copiaba `template_artifact_id, sort_order` y **`item_mode` no**; la columna
tiene `NOT NULL DEFAULT 'single'`, así que el modo se perdía **en silencio**. Como la actualización
guiada clona la configuración, **actualizar un proceso deshacía su modelo de emisión**.

Ya había pasado: la configuración **activa** del Proceso por defecto decía `single` debiendo decir
`routed`, y por eso el envío con flujo definido al enviar no era alcanzable ahí.

> **Lo encontraron dos agentes por caminos independientes** —uno leyendo el clonado, otro porque su
> prueba medía un vínculo distinto del esperado—. De las tres tablas hijas que clona, **solo la de
> plantillas estaba rota**. Por eso el test nuevo no fija el caso: fija **la invariante genérica para
> las tres — toda columna del `SELECT` aparece en el `INSERT`**.

Golden movido: **una línea**, `single` → `routed`.

---

## Dos candidatos más que se descartaron tras comprobarlos (2026-08-09)

- **`generation/launch.js:224`** (`UPDATE tasks SET process_run_id`) **no es una pérdida de
  trazabilidad**: es la «Opción X» deliberada — el código lo dice en su comentario y el modelo de
  `process_runs` se diseñó así.
- **`controllers/tareas/tareas_controler.js:79`** **no es otra copia del IDOR**: lista *tareas* vía
  `task_assignments` y solo expone un agregado (`task_item_count`, `task_item_names`), no entregables
  individuales. Si algún día se revisa, será por otro motivo.
