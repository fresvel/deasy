# Inventario de código muerto — 2026-09-02

> Insumo de la tarea **L10** del [frente 17](./lopdp-consentimiento-2026-09.md). Es un **inventario**,
> no una lista de tareas: nada de lo de aquí se borra sin mirarlo.

**Método:** para cada candidato se buscó el símbolo en todo el árbol (`backend/`, `frontend/src`,
`channels/src`, `docs/`, `scripts/`, `docker/`). **Confianza ALTA sólo si se comprobó que nadie lo
referencia**, y con qué búsqueda. Un test **cuenta** como referencia: donde lo único que usa un
símbolo es su prueba, se dice así.

---

## §1 · Lo que sobra, con confianza ALTA

| Qué | Dónde | Cómo se comprobó | Riesgo |
|---|---|---|---|
| `deleteFile` (fichero entero) | `backend/utils/files.js` | 0 apariciones fuera de su definición; `utils/files` no se importa. **Y está roto**: `fs.unlinkSync(path, cb)` no acepta callback | Nulo |
| Controlador `verifyEmail` | `backend/controllers/users/verify_email.js` | Ningún router lo importa. Lo sustituyó `POST /users/me/verificacion/correo` en `C8`; el propio `user_router.js:135-138` documenta la retirada | Nulo |
| `frontend/public/terms.md` | fichero | Único lector: `fetch("/terms.md")` en `TermsView.vue`. Su contenido está **duplicado** como semilla `terminos_de_uso` v1 en `postgres_schema.sql` | Bajo |
| `TermsView.vue` + ruta `/terminos` | vista + `core/router/index.js` | **Sin un solo enlace entrante.** El que había (`/register?terms=accepted`) se quitó a propósito. Superado por `DocumentoLegalModal.vue`. Lo único que lo referencia es **su propio test** | **Medio** — sigue alcanzable tecleando la URL, y **tres documentos la describen como ruta pública** |
| `canAccessManagement` | `frontend/src/core/utils/accessControl.js:168` | 1 aparición en todo el repo: su definición | Nulo |
| `resolveWorkspaceCargoIcon` · `resolveWorkspaceUnitGroupIcon` | `frontend/src/shared/utils/workspaceNavIcons.js` | 1 aparición cada una. Existe `workspaceNavIcons.test.js` y **no las cubre** | Nulo |
| `getPostgresDatabaseName` | `backend/config/postgres.js:523` | 1 aparición | Nulo |
| `collectSignatureWorkflowNormalizationIssues` | `backend/services/admin/templates/workflows.js:414` | 0 importadores, y sus vecinos sí se usan dentro del módulo | Bajo |
| Rótulo huérfano del SMS | `docker/.env.dev.runtime:21-22` · `.example:28-29` | Cabecera de sección + comentario de `SMS_NUMERO`, **pero la variable ya no está**. Y dice *«C6, bloqueada»*, que es el estado **anterior** al descarte | Nulo |
| `channels/README.md:4` | *«WhatsApp y un receptor de SMS»* | Contradice el descarte del 2026-09-01. No hay dependencia ni módulo de SMS | Nulo |
| `FRONTEND_PORT` | los cuatro `.env*` | **La única variable que nadie lee**, barridas las 100+ contra todo el árbol. Los compose usan `frontend:8080` fijo | Nulo |
| `backend/scripts/migrate_storage_keys.mjs` | fichero | Migración de un solo uso (2026-08-27). No está en `package.json`, ni en CI, ni en docs | Bajo |
| `frontend/scripts/clases-gemelas.mjs` | fichero | **El único** `.mjs` de esa carpeta que no está en ningún script de `package.json`; los otros 27 sí. Su fase (F11) cerró el 2026-08-20 | Bajo — se pierde el instrumento de medición |
| `GET /admin/sql/positions/:id/immediate-boss` | `sql_admin_router.js:103` | Sin cliente y **sin test** | Medio — la cadena es larga |
| `channels/backend/` | directorio vacío sin seguimiento | No está en `git ls-files` ni en `.gitignore` | Nulo |

### Vivas, pero sólo para su test

`GET /admin/sql/task-items/stuck` y `POST …/reconcile-assignments` (`sql_admin_router.js:97-98`) no
tienen cliente en el frontend —el panel usa otra ruta—, y **lo único que las ejerce son dos pruebas
de caracterización**. Borrarlas mueve dos goldens. Decisión aparte.

### Sólo sobra el `export`, el código está VIVO

Veintitantos símbolos exportados con uso **dentro de su propio módulo** y cero importadores fuera:
`TRACEABILITY_TABLES`, `PROCESS_WIZARD_STEPS`, `etiquetaCorrida`, `SQL_TABLES`, `rewriteDialect`,
`TABLE_HOOKS`, `mapMessage`, `transitionDocumentState`, `resolvePersonId`, `PG_UNIQUE_VIOLATION`…
No se borran: se les quita el `export`.

---

## §2 · ⛔ Parece muerto y NO lo está

| Qué | Por qué no se toca |
|---|---|
| `case "document_owner"` del motor de firmas | **Defecto 1.19.** Salió del `CHECK`, pero el JSONB `signature_flow_steps.signers` todavía puede traerlo; borrarlo deja pasos **sin firmante, en silencio**. `assignees.test.js` existe para custodiarlo |
| Las **lápidas** del SMS en los seis `.env`, en `Canal.js` y en el esquema | Son comentarios deliberados de *«no lo reintroduzcas»*, con su cita y su DOI. **Cumplen su función precisamente por seguir ahí** |
| Claves «huérfanas» de `estadoTono.js` | El diccionario se indexa por `tabla.columna` **construido en ejecución** con valores que vienen de la base. Una clave sin acierto puede ser un estado que hoy no está en los datos de prueba |
| `backend/config/rbacCatalog.js` | Los permisos se resuelven por concatenación `recurso.acción` y **se siembran en la base**. Un `grep` textual no prueba nada |
| `channels/.wwebjs_auth/` y el volumen | Ahí vive la sesión de WhatsApp. Borrarlo deja el canal caído hasta que alguien escanee un QR **con el teléfono en la mano** |
| `docs/docs-md-antiguos/` | Archivo histórico deliberado; `docs-links.yml` lo excluye de lychee **a propósito** |
| `scripts/css-modularizar.mjs` | Un solo uso, pero el plan maestro dice literal *«archivar el script, conservar el comentario»*: su cabecera documenta por qué el orden de `index.css` es el que es |
| `docs/legal/BORRADOR-*.md` | **Pendientes de revisión jurídica.** Dejarán de vivir ahí cuando se aprueben, no antes |

---

## §3 · Tres cosas que yo daba por ciertas y **estaban mal**

1. ⚠️ **`storage-init` NO es configuración muerta.** Yo afirmé *«nada lo lanza, lo comprobé»*. Es un
   **perfil manual documentado** en `docs/07-despliegue/COMANDOS_PROYECTO.md:292`. Mi búsqueda cubrió
   `scripts/` y `docker/` y **no miré la documentación de despliegue**. Que un perfil de compose se
   lance a mano es para lo que existen los perfiles.
   *(El riesgo de fondo sigue en pie: como sólo corre a mano, el bucket legal podría acabar creándolo
   el código sin bloqueo. Pero eso se ataja en el arranque del backend, no forzando el bootstrap.)*

2. **Del «sello» no quedó nada en el código.** `pepper` → 0 aciertos. `verificaciones_historicas` →
   **0**, no existe en el esquema. Ningún `*_HMAC` en los `.env`. Lo único que quedó es
   `docs/arquitecturas/evidencia-de-verificacion.md`, **huérfano de enlaces** — y ése **se conserva**:
   es el archivo de una decisión, no basura.

3. **No hay i18n en el frontend.** 0 aciertos de `$t(`. No había claves huérfanas que buscar.

---

## §4 · Documentos de diseño sin indexar

Tres ficheros de `docs/arquitecturas/` tienen **cero enlaces entrantes**, frente a los 13 vecinos que
tienen entre 1 y 9: `evidencia-de-verificacion.md`, `vigilante-de-canales.md` y
`roles-permisos-qa-demo.md`. **No sobran: falta indexarlos.**

---

## §5 · Ejecución — 2026-09-03

### Borrado

| | Qué salió |
|---|---|
| **Ficheros enteros** | `backend/utils/files.js` · `backend/controllers/users/verify_email.js` · `backend/scripts/migrate_storage_keys.mjs` · `frontend/public/terms.md` · `frontend/src/modules/auth/views/TermsView.vue` · el directorio vacío `channels/backend/` |
| **La ruta `/terminos`** | y su entrada en `publicRoutes`, su import, su `vi.mock` y sus tres apariciones en el test |
| **Símbolos** | `getPostgresDatabaseName` · `collectSignatureWorkflowNormalizationIssues` · `canAccessManagement` · `resolveWorkspaceCargoIcon` · `resolveWorkspaceUnitGroupIcon` |
| **La cadena de `immediate-boss`** | entera: ruta → controlador → delegado de `SqlAdminService` → el método de `taskAssignment` (un CTE recursivo de 43 líneas) |
| **Configuración** | `FRONTEND_PORT` de los cuatro `.env` · el rótulo huérfano del SMS en `.env.dev.runtime` y su `.example` |
| **Prosa falsa** | `channels/README.md` decía «y un receptor de SMS» · `/terminos` como ruta pública en el `.tex` y **en el sitio publicado** |

**Y dos comandos que nunca existieron**, documentados durante meses en
`docs/07-despliegue/COMANDOS_PROYECTO.md`: `minio-publish-seeds` y `minio-publish`. Comprobado: **ni
los servicios, ni los perfiles, ni las carpetas que decían leer** (`tools/templates/seeds/`,
`tools/templates/dist/Plantillas`) están en el repositorio. Quien los copiara se llevaba un error
desconcertante. Sustituidos por una lápida que dice por dónde entran hoy los seeds.

### ⚠️ Dos cascadas: borrar código muerto **descubre más**

1. **`canAccessManagement` dejó huérfana `MANAGEMENT_RESOURCES`** — una constante de 12 entradas cuya
   única lectora era esa función.
2. **Los dos resolvedores de iconos dejaron huérfanos `IconGlobe` e `IconMapPins`**, importados y sin
   usar.

**Ninguna de las dos la señaló el lint**, y ése fue el hallazgo de la jornada (§6).

### ⚠️ Un error mío, cazado por leer el diff

Al quitar `canAccessManagement` con un ancla de contenido, el ancla de cierre `  );` **coincidió más
abajo de lo previsto y se llevó también `canAccessProcessManagement`**, que **sí se usa en cuatro
sitios** (el guard del router, `AppWorkspaceShell` y dos veces en el test). Restaurada.

> Es exactamente el fallo del que avisa el `CLAUDE.md` para los `.env`, en otro lenguaje:
> **un reemplazo por texto acierta donde no quieres.** La red que lo cazó no fue una prueba —fue
> `git diff` leído entero antes de seguir.

### Lo que se decidió NO borrar, y por qué

| | |
|---|---|
| `POST /admin/sql/task-items/reconcile-assignments` | **Está documentado en un plan VIVO** (`defectos-conocidos/plan-defectos-2026-08.md:216`) como el *backfill de reconciliación*. No es código muerto: es una operación de mantenimiento pendiente de cerrar |
| `GET /admin/sql/task-items/stuck` | Diagnóstico de administración, con golden propio, hermano del anterior en el router |
| `frontend/scripts/clases-gemelas.mjs` | Instrumento de medición, no puerta. Se le aplica **la misma regla que a `css-modularizar.mjs`**, que el plan maestro fijó: *«archivar el script, conservar el comentario»* |
| Los ~24 **`export` sin importador** | ⚠️ **Esto NO es código muerto**: el código se ejecuta, sólo sobra la palabra `export`. Verifiqué mi propia sospecha de que los importaban sus tests y **era falsa** — pero la conclusión aguanta por razones mejores: `UnsupportedImageError` es una **clase de error**, y exportarla es API deliberada para que alguien pueda hacer `instanceof`; `SQL_TABLES` vive en `sqlTables.js`, que el plan de calidad marca **NO TOCAR**; y `PASSWORD_MIN_LENGTH` describe una política que otro módulo puede necesitar. Son veinte decisiones de superficie, una por una, con **cero cambio de comportamiento**. Pasa a ser un encargo aparte |
| Los tres docs huérfanos | **No sobraban: faltaba el índice.** Creado `docs/arquitecturas/README.md` con los 15 documentos |

### Verificación

`char 330/330` **sin mover un golden** — la prueba de que lo borrado estaba muerto de verdad ·
`backend unit 819` · `channels 104`. Y los contadores de las puertas **bajaron solos**, que confirma
que el borrado surtió efecto: `check:imports` de 166 a **164 ficheros**, `check:sql-aliases` de 537 a
**535 consultas**.

---

## §6 · El hallazgo de la jornada: **el lint del frontend no veía ni lo indefinido ni lo sin usar**

`frontend/eslint.config.cjs` **nunca cargó `eslint:recommended`**. Sólo `vue/flat/essential` y
cuatro reglas propias. Así que en un frontend con **27 puertas de lint**, ni `no-undef` ni
`no-unused-vars` estaban activas.

Se activaron el 2026-09-03. Lo que salió mide el hueco:

| | |
|---|---|
| `no-undef` | **2 reales** (más 3 falsos de mi sonda, por globals que no le puse) |
| `no-unused-vars` | **70, y 71 con la cascada** que apareció al quitar el primero |

### El `no-undef` que era un defecto VIVO

En `AdminTableManager.vue`, dos funciones llamaban a `definitionArtifactsPromptInstance?.hide()` y
`processDefinitionActivationInstance?.hide()`. Esos identificadores **no existen en ese ámbito**:
viven como `let` locales dentro de `useAdminModalRegistry.js`.

⚠️ **El `?.` no protege.** Un identificador **no declarado** lanza `ReferenceError`; el encadenamiento
opcional sólo cubre `null`/`undefined` de algo **declarado**. Sólo `typeof` es seguro.

**De las dos, una estaba en camino vivo**: `closeProcessDefinitionActivationModal` lo llama
`useProcessDefinitionManager` en tres sitios, así que **«Gestionar reglas» y «Gestionar plantilla
vinculada» desde el modal de activación lanzaban `ReferenceError`**. La otra era un **duplicado roto
e inalcanzable** — el manager define su propia versión, ya correcta.

**Y hay prueba, vista roja antes de arreglar** (`AdminTableManager.test.js`, 3 casos): monta el
componente, **captura el objeto de opciones** que entrega al manager e invoca las dos funciones.
Antes: `2 failed`, con el `ReferenceError` literal en el mensaje.

### Las dos reglas, probadas rompiéndolas

Se metieron dos ficheros con las cuatro infracciones —una de ellas **reproduciendo literalmente el
defecto del icono**— y las dos reglas los cazaron. Después se borraron.

> **Una puerta que nunca se ha visto roja no está probada.**

### Cinco cosas que salieron de los 71, y son síntoma, no ruido

| | |
|---|---|
| `openMultiSigner` | Un **punto de entrada al que no llega ningún botón**: abría el firmador múltiple en blanco. La única vía expuesta delega en `onAddFiles`, que **con lista vacía retorna sin hacer nada**. Si «firmar varios en blanco» debía existir, **lo que falta es el botón, no el código** — misma forma que el `IconMessage2`. **Decisión pendiente del dueño** |
| `groupIconMap` · `buildPerfilMenu` | **60 líneas de la época FontAwesome** (`"map-marked-alt"`, `"check-double"`), sustituidas hace tiempo |
| `searchColumnClass` · `actionColumnClass` | 16 líneas de anchos de columna **que nunca se aplicaron**: la fila de filtros *debería* variar de ancho por tabla y **hoy no lo hace** |
| `tableHeaderSubtitle` · `tableHeaderIcon` | 50 líneas: la cabecera de la tabla de admin **no pinta ni subtítulo ni icono** |
| Las opciones de `useDeliverableView` | Su comentario dice que «el composable RECIBE esos refs», y `currentUser` y `deliverableWorkspaceState` **no se leían nunca**: la firma mentía en las dos direcciones |

### Antes/después medido de lo único que podía mover un píxel

De las cinco utilidades que vivían en los `computed` borrados, **una sola dejó de emitirse**
(`lg:col-span-6`) — y **ninguna plantilla la escribe**: existía únicamente dentro del `computed`
muerto, con cero nodos del DOM referenciándola. Lo respaldan `check:orphan-classes` (mide contra el
CSS **construido**) y `css-prune` (396 clases propias, todas con consumidor).

### ⚠️ Y una corrección de tercer grado en `frontend/CLAUDE.md`

Su §5.5 llevaba desde el 2026-08-24 una «CORRECCIÓN» que decía *«el gate `check:z-index` NO
EXISTE»*. **Es falsa** — el fichero está y corre en la cadena de `lint`, como imprime su propia
salida. El `CLAUDE.md` raíz ya lo había desmentido el 2026-08-26; el de la carpeta seguía mintiendo.

**Cómo se equivocó la auditoría**, que es lo aprovechable: buscó **el alias de npm** en vez de **el
fichero**. Confundir *«no hay atajo»* con *«no hay puerta»* es error de método: **se comprueba con
`ls`, no con `grep` en el `package.json`**.
