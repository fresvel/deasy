# Bitácora del frente 1 — los doce cerrados

> Esto **no es historia decorativa**. La mitad del valor de cada ficha es *por qué no se hizo de la
> otra forma*: hay **seis** sitios de este repo donde la «corrección obvia» es la equivocada, y están
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
| 1.8 | Dos documentos mandaban formas de error contrarias (**eran cinco**) | 2026-08-14 | **ninguno, y es correcto** |
| **1.9** | «Una copia del IDOR se quedó atrás» | **NO ERA UN DEFECTO** | — |
| 1.11 | Los parámetros de MÁS se ignoraban en silencio (**y la premisa era falsa**) | 2026-08-14 | **ninguno, y es correcto** |
| 1.15 | El catálogo de semillas nunca llegaba a un entorno ya arrancado | 2026-08-14 | **ninguno — el golden ya era correcto** |
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

## 1.8 · Dos documentos del repo mandaban formas de error contrarias (y eran cinco)

**Cerrado el 2026-08-14.** Ningún golden se movió, y **eso es lo correcto**: no hubo cambio de
comportamiento. El único fichero del backend que se tocó fue **un comentario**.

### Lo que la ficha decía mal

Decía «dos documentos». **Son cinco**, y el tercero no estaba en ningún plan porque **es documentación
publicada**:

| Dónde | Qué mandaba |
|---|---|
| `referencia/contrato-errores-api.md` §4 | `{ message, code }` — la norma |
| `backend/errors/HttpError.js:20` | `res.json({ error: error.message })` — **el defecto** |
| `docs/src/content/docs/explicacion/backend-errores-e-integraciones.md:7-13` | `res.json({ message: error.message })` — **tercera forma, en el sitio público** |
| `backend/middlewares/uploadError.js:10-12` | Citaba el contrato por su ruta y lo implementaba |
| `frontend/src/shared/utils/apiError.js:4-20` | Describía dos formas vivas y su precedencia |

Y decía que la cabecera debía recomendar `{ message, code }`. **No podía**: `HttpError` tiene `name`,
`message` y `statusCode`, y **ningún campo `code`** — habría pedido algo que sus cuatro fábricas no
saben rellenar.

### El arreglo, y por qué NO fue «poner el ejemplo bueno»

**A la cabecera se le retiró el ejemplo, no se le corrigió.** Dos textos solo pueden contradecirse si
**ambos deciden sobre lo mismo**; mientras la cabecera enseñe una forma, vuelve a divergir en cuanto el
contrato evolucione. Retirar la afirmación hace la contradicción **irrepetible**, no solo la corrige.
Es la regla 4 de [`../CLAUDE.md`](../CLAUDE.md) —una cosa, un sitio— aplicada a una doctrina.

A cambio la cabecera ganó lo que **sí es suyo** y no estaba escrito en ninguna parte: que aporta
`statusCode` y **no puede aportar `code`**. Es un hecho de la clase, no del contrato, así que no puede
derivar.

> **Dato de contexto que hacía obvia la dirección:** `{ message }` ya había ganado de facto —**219 de
> 306** respuestas (71,6 %), y **47 de los 57** sitios que reciben un `HttpError`—. La forma que su
> propia cabecera recomendaba la usaban **4**.

### `code` se queda, aunque no lo lea NADIE — y esta es la parte que se descartó dos veces

Medido: **cero lectores** en `frontend/src`, `signer/` y `scripts/`. Ni un `data?.code` sobre una
respuesta de error, ni una comparación contra `"SIGN_BATCH_LEGACY_GONE"` o `"UPLOAD_REJECTED"`. (La
única coincidencia de `data?.code` es `edge.data?.code` en `UnitGraphView.vue:1206`: un tipo de
relación del organigrama, nada que ver.)

**Retirarlo del contrato se evaluó y se DESCARTÓ**, y la razón es concreta:
`middlewares/uploadError.js:54` es **la única implementación conforme del backend** y emite
`{ message, code }`, con **tres goldens que congelan `claves: ["code","message"]`** (`dossier.json:8`,
`user_workspace.json:31`, `sign_batch.json:113`). Retirarlo **dejaría no conforme al único que lo hace
bien** y movería tres goldens por un cambio documental. Eso es peor que el defecto.

**Lo que sí había que arreglar era su semántica**, y es el hallazgo que más rendía: la regla 4 decía
*«Hoy lo usa `login_user.js`; que siga»* — y `login_user.js:15,30` emite `code: 400` / `code: 401`,
**un número que repite el status HTTP**, que no permite ramificar nada. **El contrato bendecía como
ejemplo el peor de sus diez emisores**, y era el que se iba a copiar: 8 de los 10 ya lo hacen así. El
§4.1 nuevo dice qué es (string estable en `SCREAMING_SNAKE`), qué no es (ni el status repetido, ni el
`.code` del error subyacente — `uploadError.js` colaría un `ENOENT` de `fs` o un SQLSTATE de `pg`), y
cuál es el único bien puesto: `"SIGN_BATCH_LEGACY_GONE"`.

**Y la necesidad existe, aunque hoy no se use**: `FillRequestWorkflowService` responde **409 en tres
guards distintos** —«sin responsable resoluble», «transición ilegal» y «falta el PDF» (el 1.2)— con
remedios distintos e indistinguibles salvo por la cadena de texto.

### La página publicada: se enlaza, no se reescribe

Es *explicación* en el sentido de Diátaxis: su trabajo es **describir**, y lo que afirma es **cierto**
—verificado leyendo `backend/index.js` entero y los routers: **no hay `app.use((err, req, res, next))`
en ninguna parte**—. El defecto no era lo que decía, sino que **no mencionaba que existe una norma**, y
por eso se leía como prescripción. Se le puso un aviso al principio y el enlace. De paso se corrigió un
error de hecho: `handleUploadError` se monta en **cuatro** routers, no en tres (faltaba
`sql_admin_router`).

### Lo que NO entró, y a dónde se fue

- **El helper `fail()`** que el contrato §6 propone (`backend/utils/httpError.js`, que **no existe**).
  Crearlo sin migrar ni un controller añade **un decimoséptimo productor de forma sin un solo
  consumidor** — el olor que el documento persigue. **Nace con la fase C del frente 7**, no antes.
- **La migración de las respuestas.** Es el frente 7 entero. Aquí solo murió la desinformación.

### Un hallazgo estructural que hay que tener delante antes de la fase C

**No hay error handler central.** Ni en `index.js` ni en los routers; el único middleware de aridad 4
es `handleUploadError`, y es de ámbito de router. **No existe un punto donde normalizar la forma de un
golpe**: o se tocan los sitios uno a uno, o primero hay que crear ese handler. Quedó escrito en el §6
del contrato, que es donde se leerá.

Y el censo se remidió: **306 respuestas y 16 formas**, no las 309/15 que decía el maestro —que **no se
reproducen con ningún criterio razonable**—. Han aparecido **tres formas nuevas en un mes**, que es
exactamente lo que el §7 del contrato prohíbe, ocurriendo mientras nadie miraba.

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

## 1.11 · Los parámetros de MÁS se ignoraban en silencio (y la premisa era falsa)

**Cerrado el 2026-08-14.** Ningún golden se movió, y **eso es lo correcto**: el guard nuevo solo
cambia el comportamiento de un call site equivocado, y no había ninguno.

### La premisa que sostenía la tolerancia, y que nadie había comprobado

`bindParams` lanzaba si FALTABAN parámetros (defecto 1.5) y callaba si SOBRABAN, con esta
justificación escrita en el propio fichero:

> *«Sobrar parámetros SÍ se tolera (mysql2 hacía lo mismo): los de más se ignoran y hay call sites
> que reutilizan un array de argumentos más largo que la consulta.»*

La primera mitad era cierta. **La segunda era falsa.** Medido por tres vías que se cubren entre sí:

| Vía | Alcance | Resultado |
|---|---|---|
| Escáner estático (`npm run check:params`) | 423 llamadas decidibles | **0 con parámetros de más** |
| Lectura una a una | los 61 indecidibles (24 con `.push()` condicional) | **61 equilibrados** |
| Sonda que registra sin lanzar | arranque + fixture + los 240 flujos | **0 disparos** |

**484 de 484 equilibradas.** El único reuso genuino del mismo array en dos consultas
—`processDefinitionVersion.js:227` y `:240`— **está equilibrado**: ambas comparten el fragmento
`${excludeSql}`. El `COUNT(*)` + `LIMIT` compartiendo array **no existe**: los seis sitios con esa
forma usan `[...params, limit, offset]`, que *añade* en vez de reutilizar.

### Por qué se eligió LANZAR y no solo avisar

Avisar (log permanente) era la opción sin riesgo, y se descartó por una razón concreta y medida:
**el gate estático solo alcanza a 423 de las 484 llamadas.** Las otras 61 —SQL con `${}`, parámetros
en variable— quedaban protegidas por una **lectura**, y una lectura caduca en cuanto alguien toca el
código. Lanzar en `bindParams` es lo único que cubre las 484 en tiempo de ejecución.

Y la simetría no es estética: sobrar es **el mismo fallo** que faltar —el SQL y su lista de
argumentos se han desincronizado— solo que en la otra dirección. Que el mismo fallo se comportara de
dos maneras opuestas según hacia dónde se desviara es lo que mantenía uno de los dos invisible.

### La tolerancia era CONTRATO en tres sitios, y se resolvieron, no se borraron

1. **El bucle de 32 casos del escáner** se alimentaba con un array de 32 escalares *a propósito*,
   apoyándose en la tolerancia para medir solo la numeración. Se arregló **derivando la cuenta del
   texto esperado** (`(expected.match(/\$\d+/g) || []).length`), sin tocar ninguno de los 32 casos.
   Queda **mejor test que antes**: el número de placeholders pasa a ser parte de lo que el caso fija,
   en vez de quedar tapado por un array de sobra.
2. **Los dos tests que fijaban «sobran parámetros: se ignoran»** se **invirtieron**. Ese diff **es**
   la prueba del arreglo.
3. **El test `RAREZA` del bloque sin cerrar** pasaba `[1, 2]` y eso ahora lanza. **No es una
   regresión**: con dos parámetros el SQL ya salía inválido (un `?` crudo que PostgreSQL rechaza), así
   que se cambia un error confuso por uno localizado. Por eso el mensaje de «sobran» **nombra el tramo
   sin cerrar**: en ese caso el desajuste lo produce el escáner, no quien llamó.

### Lo que deja vivo

- **`npm run check:params`** (`scripts/audit_bindparams.mjs`), con el idioma de `check:imports`. El
  barrido del 1.5 **se hizo y se tiró** —solo quedó una frase en `postgres.test.js`— y por eso hubo
  que rehacerlo entero. Este no se tira. Declara además sus indecidibles con su motivo: un auditor
  que dice «0 problemas» sin decir cuántas no miró es el verde engañoso que el método prohíbe.
- **Dos defectos nuevos encontrados de rebote**: el **1.15** (la suite de caracterización está roja
  por un golden no determinista) y el **1.16** (orden de parámetros cruzado en la firma, que
  `bindParams` no puede ver porque el número cuadra).
- En `plan_data` §D5-b: **retirado el cerrojo del 1.11** —sigue el otro, cerrar D5-a— y corregida una
  cifra muerta que era su argumento de peso: decía «`bindParams` (CC 59)» y **la Fase F la dejó en ~1**.

### Cómo se verificó

**602 unitarios verdes.** Y la suite de caracterización completa **antes y después**: los **mismos 9
fallos preexistentes** (defecto 1.15), en el mismo fichero, **cero errores de `bindParams`** y **cero
goldens movidos**. La predicción se escribió antes de correr, que es lo que la hace valer.

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

---

## 1.15 · El catálogo de semillas nunca llegaba a un entorno ya arrancado

**Cerrado el 2026-08-14.** La suite pasó de **4 fallos a 0** y **ningún golden se movió** — porque el
golden ya era correcto.

### La ficha original decía DOS cosas falsas, y las dos las escribí yo

Decía «un golden que congela un hash SHA-256 **no determinista**» y «**9 casos**».

- **El hash es determinista.** Dos corridas completas e independientes de `test:char:run`, cada una con
  reset de base, bootstrap y seed, dan **el mismo** `709460…`. Lo di por volátil al ver el diff y no lo
  comprobé.
- **Son 4 tests, no 9.** Conté líneas `✖`, y cada test aparece dos veces (subtest + resumen). De los 4,
  **solo 2 fallan por el hash**; los otros dos caen **en cascada**, porque `matchSnapshot` lanza antes
  de `happy.id = res.body?.id` y los siguientes hacen `assert.ok(happy.id)`.

> **Y la lección de método**: un diff de golden invita a concluir «el valor es inestable». La pregunta
> barata que lo desmiente es **¿cambia entre dos corridas, o es estable y distinto del golden?**. Cuesta
> un `grep` sobre dos salidas ya guardadas, y ahorra el arreglo equivocado — que aquí habría sido
> **recapturar**, congelando el defecto que `49d41ce4` acababa de arreglar.

### Lo que pasaba de verdad

El paquete del borrador se arma leyendo `Seeds/latex/informe-general/src/**` **de MinIO**, y la pila
servía un `make.sh` **anterior** a `49d41ce4` (2026-08-13, *«el ZIP de una plantilla creada por la web ya
se puede renderizar»*). Comprobado leyendo el objeto: el repo dice `for candidate in data.json data.yaml
…` y MinIO decía `for candidate in data.yaml …`. **El golden era correcto y el entorno el que mentía.**

### El arreglo: un centinela que guardaba dos cosas y solo una lo justificaba

`publishBaseSeedAssets` salía por un `return` temprano si existía `main.tex.j2`:

| Destino | Quién lo edita | Qué se hace ahora |
|---|---|---|
| `Seeds/<tipo>/<nombre>/**` (catálogo) | **nadie** — es la copia publicada del repo | **se republica siempre** |
| `System/<code>/v0001/**` (artifact) | **el admin**, desde la web | el centinela **se queda intacto** |

El comentario decía «respeta ediciones del admin», y para el artifact es cierto. Aplicarlo al catálogo
era el fallo, y su efecto no era «no reescribir»: era que **ningún cambio en
`services/system/seeds/**` alcanzara un entorno ya arrancado**.

### Lo que el arreglo NO cubre, y por eso nació el 1.17

Verificando se descubrió que **`publishBaseSeedAssets` no corre en cada arranque**: cuelga de
`ensureDefaultProcess`, que solo se ejecuta en el bootstrap. Así que reiniciar el backend **no** basta —
lo comprobé y el catálogo seguía viejo. Lo que sí lo ejercita es `test:char:fixture`, que re-bootstrapea.

**Partir el centinela era necesario pero no suficiente**: en producción sigue sin haber camino. Eso es
el defecto **1.17**, abierto en el mismo commit.

### Dos trampas de verificación que caí y conviene no repetir

1. **Mi primer chequeo daba falso verde.** Hacía `grep data.json` sobre el fichero entero, y esa cadena
   aparece en otro punto del `make.sh`. El chequeo correcto compara **la línea `for candidate in`**.
2. **El test unitario se validó con control positivo**: se restauró temporalmente el `return` temprano y
   se comprobó que los dos tests que cubren el defecto **fallan**. Un test que no se ha visto fallar no
   prueba nada.

### Cómo se probó sin MinIO

`publishBaseSeedAssets` acepta sus ayudantes **por parámetro con valor por defecto**. No es API para
nadie —ningún llamador pasa nada, el comportamiento en producción es idéntico— sino la costura mínima
para observar **qué claves se suben**, ya que `mock.module` en este Node exige un flag experimental y
cambiar el `test:unit` global por un test habría sido peor negocio. **6 unitarios nuevos.**

---

