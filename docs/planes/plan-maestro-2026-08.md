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

## Frente 1 · Defectos conocidos y sin arreglar — ⬜

**Lo más rentable que queda, y con diferencia**, porque no es deuda estética: son fallos que un
usuario puede encontrarse. Todos están **congelados en pruebas**, así que el arreglo se verifica solo:
cuando el defecto muere, su golden cambia, y ese diff **es** la prueba.

| # | Defecto | Dónde | Nota |
|---|---|---|---|
| 1.1 | **El `fileFilter` de multer suelta el stack trace completo en HTML** | `user_router` y `dossier_router` | Fuga de información. **El middleware que lo arregla YA EXISTE** (`backend/middlewares/uploadError.js`, hecho para `sign_router`): es montarlo. Lo más barato del plan |
| 1.2 | `approve` del último paso sin PDF → **500** | `FillRequestWorkflowService` | Es regla de negocio: debería ser 409/400. Y el guard mira solo la **extensión** de `working_file_path`, no que el objeto exista en MinIO |
| 1.3 | Con `is_manual = 1` y sin responsable, **cualquiera se apropia de la solicitud** al iniciarla | `FillRequestWorkflowService` | El UPDATE le pone su propio id. Congelado en `manual_autoasignacion_efecto` |
| 1.4 | Se pueden **enumerar los jobs de otros usuarios** | `BatchSigningService` | 404 (no existe) vs 403 (ajeno) distingue existencia |
| 1.5 | `bindParams` con parámetros de menos → `undefined` → **NULL silencioso** | `backend/config/postgres.js` | La consulta **no falla**: ejecuta con datos equivocados. Bug latente real |
| 1.6 | `translatePlaceholders` es **código muerto** | `backend/config/postgres.js` | Cero llamadas (`FNDA:0`). Borrar en un commit propio: quitar un export no es refactor |
| 1.7 | **El «sello fantasma»: un guard permanentemente verdadero** | `MultiSignerPanel.vue` | `previewBoxStyle` nace `{display:'none'}` pero la asignación de `:911` **no incluye `display`**, así que tras el primer `pointermove` el `v-if` de `:169` es siempre cierto: código muerto. Ojo — [`referencia/frontend.md`](./referencia/frontend.md) afirma lo contrario (que `isMouseOverPdf` «nunca se lee», y sí se lee en `:169`); el único diagnóstico correcto está en [`referencia/god-objects-2026-07.md`](./referencia/god-objects-2026-07.md) §3.4 |
| 1.8 | **Dos documentos del repo mandan formas de error contrarias** | `backend/errors/HttpError.js:20` | Su cabecera recomienda `res.json({ error: error.message })`, mientras el contrato objetivo —y `middlewares/uploadError.js`, que ya lo implementa— es `{ message, code }`. Mientras eso no se reconcilie, cada controller nuevo elige mal la mitad de las veces |
| 1.9 | **El arreglo del IDOR se aplicó copia por copia y una copia se quedó atrás** | `backend/services/chat/ChatAuthorizationService.js:61-73` | El guard canónico es `AND (ti.responsible_position_id IS NULL OR ta.position_id = ti.responsible_position_id)`, documentado en `user_controler.queries.js:121-124` («verificado: 15 de 18 eran ajenos»). Ese `EXISTS` sobre `task_assignments` **no lo lleva**, aunque el mismo `SELECT` hace `LEFT JOIN task_items ti`. Alcance menor que el IDOR original (resuelve acceso al **hilo de chat**, no descarga de documento), pero **es el mismo modo de fallo**. Comprobado en el árbol el 2026-08-09 |
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

## Frente 4 · Sistema de diseño — ⛔ desbloqueado a medias, y bloquea a otros

El orden **no es negociable**, porque hacerlo al revés significa recodificar el conflicto en 1 269
sitios:

1. ✅ Fusionar los dos `@layer components` en conflicto — hecho (`63b901e`)
2. ✅ Eliminar los componentes muertos y su CSS — hecho (2026-08-09)
3. ⬜ **Colapsar los tokens duplicados `--deasy-*` / `--brand-*`** ← *aquí estamos*
4. ⬜ Cerrar el **fork real**: `AdminButton.vue` (un consumidor, único emisor vivo de `admin-btn--*`).
   Diverge de `AppButton` en que **aplica la clase de tamaño incluso con `icon-only`**, así que
   cambiarlo mueve el aspecto: pide navegador
5. ⬜ Migrar los ~**1 269 colores** hardcodeados
6. ⬜ Y solo entonces, las **33 incidencias de contraste** (`css:S7924`), que son accesibilidad real

> **Antes de adoptar tokens de TailAdmin**, lee las tres colisiones activas del skill `tailadmin-ui`:
> `rounded-lg` vale 16 px por una escala invertida, no hay `@theme`, y `dark:` se autoactivaría.

**Defecto visual detectado y no arreglado:** en el modal «Agregar título académico» la cabecera sale
casi negra. Causa: `theme.css:1841`, un `html[data-environment="local-dev"] header { … !important }`
que golpea **cualquier `<header>`**, incluido uno dentro del cuerpo de un modal. Solo afecta a dev,
que es justo lo que lo hace traicionero: **dev ≠ prod**.

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
