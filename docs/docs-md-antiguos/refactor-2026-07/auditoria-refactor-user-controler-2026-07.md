# Plan de refactor — `user_controler.js` (Fase 3, God Object #2)


> ⚠️ **ARCHIVADO (2026-08-06).** Los cuatro módulos M1-M4 están hechos. Lo que queda de
> `user_controler.js` se ataca en la fase D de **[`docs/plan-calidad-2026-08.md`](../../plan-calidad-2026-08.md)**.
> Motivo del archivo: [`README.md`](./README.md).

**Fecha:** 2026-07-10 · **Rama:** `refactor/auditoria-sonar`
**Archivo:** `backend/controllers/users/user_controler.js` — **4118 L**
**Antecedente del método:** `backend/index.js` 1327→234 L (golden-master byte-a-byte de `docs.json`) y `SqlAdminService.js` 6851→5925 L (extracción a módulos hermanos `.versioning/.validation/.workflows/.primitives/.artifacts`). Este plan replica **ese mismo patrón de módulos hermanos**, no una migración de capas.

---

## 1. Anatomía del archivo

| Zona | Líneas | Contenido | SQL |
|------|--------|-----------|-----|
| Imports | 1–47 | 12 imports (fs-extra, node:*, UserRepository, RbacService, postgres, SqlAdminService, DocumentState/Reset, mail…) | — |
| **Helpers privados** | 48–1911 | ~40 funciones `const` (arrow) | 60 hits |
| **Handlers exportados** | 1912–4118 | 27 `export const xHandler = async (req,res)` | 86 hits |

El primer `export` aparece en la **línea 1912**: casi la mitad del archivo (46 %) es infraestructura privada. Ahí está el objetivo real de la extracción.

### 1.1 Los 27 handlers exportados (se quedan en el archivo raíz)
```
1912 createUser              2005 updateUserPhoto        2041 getUserMenu
1982 getUsers                2415 getUserProcessDefinitionPanel
2447 getUserDocumentCenter   2511 getUserGlobalSignatureCenter
2579 createUserProcessTask   2630 listTaskItemObservations
2664 addTaskItemObservation  2721 resolveTaskItemObservation
2759 uploadDeliverablePdf    2854 downloadDeliverableTemplate
2958 downloadDeliverableFile 3055 resetDeliverableWorkflow
3115 updateMyProfile         3150 getMyProfile
3209 listDeliverableAttachments  3248 uploadDeliverableAttachment
3353 deleteDeliverableAttachment 3407 downloadDeliverableAttachment
3511 listAddableDeliverables 3566 searchTaskRecipients
3606 listFlowCatalog         3635 listMySends
3684 listMyReceived          3757 createGeneralTask
```
El router (`routes/user_router.js`) importa por nombre desde `user_controler.js`. **Los handlers NO se mueven** → el router no se toca → riesgo de imports rotos = 0.

---

## 2. Módulos hermanos a extraer (destino de los ~1900 L privados)

Mismo naming que `SqlAdminService.*`. Orden **de menor a mayor riesgo** (puras primero, acceso a datos al final).

### M1 — `user_controler.primitives.js`  ✅ HECHO *(puras, SIN pool — extracción segura primero)*
> **Refinamiento en ejecución:** `resolveStoredDocumentObject` NO era pura (depende de las constantes de módulo `MINIO_DOCUMENTS_PREFIX/BUCKET`) → se difiere a **M2 `.storage.js`**, donde encaja por dominio. M1 quedó en **14 funciones**. Resultado: raíz 4118→3931 L (−187); `primitives.js` 214 L; 21 tests nuevos (`node:test`); glob de `test:unit` ampliado con `controllers/**/*.test.js` (138→159). Regresión: unit 159/159, char 61/61, backend arranca OK.

| Fn | Líneas |
|----|--------|
| `sanitizeStorageSegment` | 48 |
| `buildDocumentVersionFolder` | 55 |
| `buildCanonicalDocumentVersionBasePath` | 60 |
| `buildWorkingObjectPathForUpload` | 84 |
| `getNumericUserId` | 188 |
| `getAuthenticatedUserId` | 220 |
| `isAuthorizedUserScope` | 225 |
| `buildRuleDisplayLabel` | 545 |
| `buildFillStepDisplayLabel` | 1292 |
| `isPendingLikeFillStatus` | 1321 |
| `isPendingLikeSignatureStatus` | 1324 |
| `canCurrentUserResetWorkflow` | 1327 |
| `createUnitSubtreeResolver` | 424 |
| `doesPositionMatchRule` | 452 |

Sin dependencias de `pool`/IO → testeables en aislamiento. **Primer commit**, cierra cobertura de lógica pura antes de tocar nada con estado.

### M2 — `user_controler.storage.js`  ✅ HECHO *(MinIO + ZIP + FS)*
| Fn | Líneas |
|----|--------|
| `resolveStoredDocumentObject` | 95 *(reubicada desde M1)* |
| `listMinioObjects` | 115 |
| `collectDeliverableTemplateResources` | 128 |
| `writeMinioObjectToFile` | 165 |
| `createZipArchive` | 171 |

Depende de `minio_service`/`fs-extra`/`zip`. Cohesión clara (empaquetado de entregables). Sin SQL.

**Resultado:** raíz 3931→**3839 L**; `storage.js` 111 L; 4 tests nuevos (`test:unit` 159→**163**). Regresión: unit 163/163, char 61/61, arranque limpio.

**Hallazgos en ejecución:**
- Las constantes de bucket (`MINIO_DOCUMENTS_BUCKET/PREFIX`, `MINIO_TEMPLATES_BUCKET`) **viven ahora aquí y se exportan**: los handlers de la raíz las reimportan, así la definición sigue siendo única (no duplicada).
- **`MINIO_SPOOL_BUCKET` era código muerto** (definido, cero usos) → eliminado.
- Imports que quedaron huérfanos en la raíz y se barrieron: `minioClient`, `spawn` (`node:child_process`), `pipeline` (`node:stream/promises`). `getMinioObjectStream` se queda (lo siguen usando handlers).
- **Deuda:** `collectDeliverableTemplateResources` tiene lógica de filtrado real (formatos excluidos, ocultos, nombres relativos) pero llama a `listMinioObjects` internamente → testearla exige mockear `minio_service`. Hoy solo la cubren los char tests.

### M3 — `user_controler.queries.js`  ✅ HECHO *(acceso a datos de lectura — el grueso, 60 SQL)*
> **Resultado:** raíz 3839→**2647 L**; `queries.js` 1208 L, **26 funciones**. Regresión: unit 163/163, char **72/72 con el golden IDÉNTICO** (la prueba fuerte: panel y menú consumen casi todas estas queries).
>
> **Hallazgos en ejecución:**
> - El bloque resultó **contiguo y autocontenido** (líneas 65–1228): no usa ninguna primitiva ni estado de módulo, solo el `pool` que recibe. Por eso `queries.js` **no importa nada**. Extracción hecha **por script** (`awk` + `sed`), no a mano: "extracción literal" exige cero errores de transcripción.
> - Aparecieron **4 helpers privados más, escondidos ENTRE los handlers** (después del primer `export`), que la anatomía inicial no vio por escanear solo hasta el primer export: `getActiveGeneralDefinition` y `resolveUserPositionInUnit` (SQL → van a M3, con su constante `GENERAL_PROCESS_SLUG`, que queda privada), y `buildAttachmentObjectPath` + `mapAttachmentRow` (puras → van a M1 `.primitives.js`, donde les tocaba).
> - Las 26 se siguen usando desde la raíz porque `buildUserProcessDefinitionPanel` **aún vive ahí**; se irá en M4.


Las funciones `get*Rows` / `get*ForDefinition` / `get*ForDocumentVersions`:
| Fn | Líneas |
|----|--------|
| `getActiveUserPositions` | 194 |
| `getUserDocumentCenterRows` | 230 |
| `getUserGlobalPendingSignatureRows` | 338 |
| `getOrgChildrenMap` | 406 |
| `getDefinitionContext` | 478 |
| `getActiveDefinitionRules` | 512 |
| `getActiveDefinitionPeriodTypes` | 563 |
| `getDefinitionTemplates` | 581 |
| `getAvailableTerms` | 609 |
| `getUserOwnedTemplateArtifacts` | 628 |
| `getUserAccessibleTasksForDefinition` | 648 |
| `getTaskItemsForTaskIds` | 734 |
| `getDocumentsForTaskItemIds` | 801 |
| `getUserTaskItemParticipationSummary` | 857 |
| `getAccessibleTaskItemForUser` | 898 |
| `getAccessibleTaskItemDocumentForUser` | 994 |
| `getUserPendingSignaturesForDefinition` | 1066 |
| `getSignatureWorkflowRequestsForDocumentVersions` | 1103 |
| `getSignatureWorkflowStepsForDocumentVersions` | 1140 |
| `getUserPendingFillRequestsForDefinition` | 1195 |
| `getAttachmentsForDocumentVersions` | 1231 |
| `getFillWorkflowStepsForDocumentVersions` | 1247 |
| `getUserOperationalProcessRows` | 1360 |
| `getCustomTermType` | 1497 |

Todas reciben `pool`/`connection` explícito (no capturan estado del módulo) → mover-y-reimportar directo. **Este módulo es el candidato natural a promoverse a `services/users/*Repository.js`** en la fase arquitectónica posterior (ver §6).

### M4 — `user_controler.panel.js`  ✅ HECHO *(ensamblado del panel — la función monstruo)*
> **Resultado:** raíz 2647→**2223 L**; `panel.js` 443 L. char **72/72 con el golden del panel IDÉNTICO** — la prueba más fuerte posible, porque ese golden ES la salida de la función extraída.
>
> **Señal de que el corte fue por la costura correcta:** al sacar el panel quedaron **26 imports muertos** en la raíz (18 queries + 8 primitivas). El panel era el ÚNICO consumidor de casi todo el acceso a datos; la raíz solo retiene 8 queries y 8 primitivas. Imports podados.
>
> **🔶 Deuda destapada (duplicación real, NO tocada aquí):** `getUserMenu` lleva **copias inline** del resolver de subárbol de unidades y del matcher de reglas, mientras el panel usa las primitivas `createUnitSubtreeResolver` / `doesPositionMatchRule`. **Y no son equivalentes**: la primitiva normaliza los ids con `Number()`, la copia inline **no**. Deduplicar cambia comportamiento (ids string vs number) → merece su propio commit verificado contra el golden del menú, que ya existe.


| Fn | Líneas |
|----|--------|
| `buildUserProcessDefinitionPanel` | 1507–1911 (~400 L) |

Orquesta M3. Es la de mayor complejidad cognitiva; extraerla aislada permite atacar su CC **después**, sin ruido del resto del archivo. Depende de M1 (labels/status) + M3 (queries).

**Resultado esperado:** archivo raíz `user_controler.js` → **~2200 L** (solo los 27 handlers + imports de M1–M4). ~1900 L reubicadas.

---

## 3. Grafo de dependencias (orden de extracción)

```
M1 primitives ──────────────┐         (sin deps)
M2 storage  ────────────────┤         (deps: minio/fs)
M3 queries  ── usa M1 ───────┤        (deps: pool + M1)
M4 panel    ── usa M1, M3 ───┘        (deps: M1, M3)
raíz handlers ── usa M1,M2,M3,M4
```
Regla anti-ciclo (aprendida en SqlAdminService): los helpers genéricos van a `.primitives.js`; **nada** en M3/M4 debe importar de la raíz.

---

## 4. Método por módulo (checklist, idéntico al validado)

Para **cada** módulo Mn, en su propio commit:

1. **Extraer literal**: cortar las funciones a `user_controler.<sufijo>.js`, `export` cada una.
2. **Importar** en la raíz (`import { … } from "./user_controler.<sufijo>.js"`).
3. **Barrer residuos** (2 trampas conocidas):
   - comentarios huérfanos que quedan donde estaba el `const`.
   - imports muertos en la raíz que ahora solo usa el módulo nuevo (mover el import, no duplicarlo).
4. **Verificar arranque**: `bash scripts/docker-env.sh dev up -d --build backend` → `logs -f backend` sin errores de bootstrap.
5. **Regresión**: `npm run test:unit` (138) + `npm run test:char:run` (61) dentro del contenedor → 40/40 y verdes.
6. **Escribir tests** del módulo nuevo (`user_controler.<sufijo>.test.js`) — empezar por M1 (puras, ROI máximo).

> ⚠️ Mutación in-place: revisar que ninguna query de M3 mute su argumento (como `validateTableRules` mutaba `candidate.status`). Si alguna devuelve filas que el handler luego muta, documentarlo en el test.

---

## 5. Golden-master ANTES de tocar nada  ✅ HECHO — y destapó DOS BUGS DE PRODUCCIÓN

> **Resultado:** flow `tests/characterization/flows/user_workspace.test.mjs`, 11 casos, char **61→72**.
> Determinista: 72/72 en captura y en dos corridas compare consecutivas. Ningún golden preexistente modificado.
>
> ### 🔴 Dos endpoints estaban ROTOS (500) en producción
> Al capturar el golden aparecieron dos 500 con el mismo error de PostgreSQL:
> `for SELECT DISTINCT, ORDER BY expressions must appear in select list`
>
> | Endpoint | Función | Ordenaba por | ¿Proyectada? |
> |---|---|---|---|
> | `GET /users/:id/menu` | query inline de `getUserMenu` | `ptr.priority` | ❌ |
> | `GET /users/:id/process-definitions/:defId/panel` | `getActiveUserPositions` | `up.slot_no` | ❌ |
>
> **Tercer residuo MariaDB→PostgreSQL**, de la misma familia que `FROM DUAL` y `FIELD()`: MySQL admite
> `ORDER BY` sobre columnas no proyectadas cuando hay `DISTINCT`; PostgreSQL lo prohíbe.
> **Arreglado** proyectando la columna de orden (preserva el orden intencionado; el `SELECT` ya llevaba la
> PK, así que `DISTINCT` no cambia de cardinalidad). Commit `a199a28`.
>
> **Barrido del resto del backend**: las otras 5 queries con `SELECT DISTINCT` + `ORDER BY`
> (`TaskGenerationService` ×2, `DocumentSignatureWorkflowService`, `RbacService`, `SqlAdminService`)
> **sí** proyectan sus columnas de orden. No hay más casos.
>
> **La lección**: los dos endpoints rotos eran exactamente **los dos que no tenían cobertura**. El paso 0
> de este plan no fue burocracia — era el que encontraba los bugs.

---

## 5-bis. Método original (referencia)

A diferencia de `index.js` (diff byte-a-byte de `docs.json`), aquí el contrato es **HTTP behavioral**. Paso 0 obligatorio:

1. Confirmar qué endpoints de `user_router.js` cubren ya los 61 char tests (`tests/characterization/`).
2. Para los handlers **no cubiertos** — sobre todo `getUserProcessDefinitionPanel`, `getUserDocumentCenter`, `getUserGlobalSignatureCenter`, `listMySends`, `listMyReceived` (los que consumen M3/M4) — **capturar golden-master HTTP** contra el stack `dev` sembrado (usuarios de referencia de CLAUDE.md: gestor cédula `0987654321`/`Gestor1234!`, usuario `1122334455`/`Demo1234!`; el admin tiene `/home` bloqueado).
3. Guardar snapshots como línea base. Re-ejecutar tras cada Mn: **diff vacío = extracción correcta**.

Sin este paso, M3/M4 se refactorizan a ciegas.

---

## 6. Deuda arquitectónica (fase posterior, NO en este pase)

Este plan es **extracción a módulos hermanos** (mismo nivel, `controllers/users/`), riesgo bajo. La corrección de la **fuga de capa P2** (SQL crudo en controller) es un segundo pase:

- Promover **M3 `.queries.js`** → `services/users/UserWorkspaceRepository.js` y **M4 `.panel.js`** → `services/users/UserProcessPanelService.js`.
- Unificar naming del acceso a datos: hoy conviven `UserRepository.js`, `chatStore.js`, `dossierStore.js`. Elegir `*Repository.js`.
- Es el "refactor mayor con estado" ya anotado en la memoria del plan Sonar → hacerlo **después** de que M1–M4 estén verdes y con golden-master, para que el movimiento entre capas sea un simple `git mv` + reapuntar imports, no una reescritura.

---

## 7. Secuencia de commits propuesta

```
1. refactor(user): extrae helpers puros a user_controler.primitives.js (+tests)
2. refactor(user): extrae empaquetado MinIO/ZIP a user_controler.storage.js
3. test(user): captura golden-master HTTP de panel/document-center/sends
4. refactor(user): extrae acceso a datos a user_controler.queries.js
5. refactor(user): extrae buildUserProcessDefinitionPanel a user_controler.panel.js
6. docs(calidad): user_controler 4118→~2200 L, fase 3 God Object #2 hecho
```
Cada commit: arranque OK + `test:unit` + `test:char:run` verdes antes de continuar.
