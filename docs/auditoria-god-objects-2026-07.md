# Auditoría de God Objects y tamaño — julio 2026 (re-medición)


> 📌 **BITÁCORA HISTÓRICA — CERRADA. No hay nada que ejecutar aquí.** Este documento es el *cómo se
> hizo* (los 10 cuts, los 3 defectos de producción, el nacimiento de la red de caracterización), y como
> método sigue siendo la mejor referencia del repositorio. **Pero sus cifras son de julio de 2026 y
> ninguna vale ya.**
>
> Para el estado actual y el *qué hacer*: **[`docs/plan-calidad-2026-08.md`](./plan-calidad-2026-08.md)**
> —mapa de fases en §5.0—. Para elegir o descartar un patrón:
> **[`docs/patrones-diseno-2026-08.md`](./patrones-diseno-2026-08.md)**.
>
> ⚠️ **Cuatro afirmaciones de este documento son FALSAS hoy.** Se dejan sin borrar para que el relato
> se entienda, pero no las cites:
>
> | Dice | Realidad |
> |---|---|
> | `admin:admin` funciona por basic auth contra la API de Sonar | **Falso.** La contraseña cambió y el basic auth murió del todo: **todo va por token** (`CLAUDE.md`, sección SonarQube) |
> | La fase 3.5 del frontend está sin ejecutar | **Hecha** (08-07) |
> | `saveTemplateArtifactDraft` sigue sin partir, CC 164 | **Partida.** CC **21** desde el 08-09 |
> | Las marcas *won't fix* no sobreviven a mover código | **Refutado por medición**: sobreviven a un *rename*; lo que las tumba es **reescribir la línea** (§4.4-R1 del plan) |

> Re-escaneo **SonarQube 26.7** sobre `develop @ 090dd44` (código **actual**, con las fases de refactor
> de `plan-refactor-frontend.md` 0–4.2, la partición de `user_controler` M1–M4 y la extracción de
> `SqlAdminService` ya aplicadas) cruzado con lectura estructural directa del código.
> Complementa —no sustituye— a `auditoria-refactor-2026-07.md` (línea base) y
> `auditoria-refactor-user-controler-2026-07.md`, **hoy archivados** en
> [`docs-md-antiguos/refactor-2026-07/`](./docs-md-antiguos/refactor-2026-07/).
>
> Reproducir: `docker compose -f scripts/sonar/compose.yml up -d` (Sonar en :9002) ·
> `SONAR_TOKEN=<token> bash scripts/sonar/scan.sh` · dashboard `http://localhost:9002/dashboard?id=deasy`.

---

## 1. El hallazgo de fondo: el refactor movió *tamaño*, no *complejidad*

Comparación con el último estado Sonar registrado (post-fases 0–2 de julio):

| Métrica | Jul (post 0-2) | **Hoy (`develop`)** | Δ |
|---|---:|---:|---:|
| Code smells | 608 | **623** | +15 |
| Bugs | 148 | **143** | −5 |
| Vulnerabilidades | 47 | **46** | −1 |
| Complejidad cognitiva total | 9 190 | **9 022** | −168 |
| Deuda técnica (SQALE) | 5 356 min | **5 350 min** | ≈0 |
| Duplicación | 3,8 % | **3,2 %** | −0,6 |
| Fiabilidad / Seguridad | C / D | **C / D** | = |
| NCLOC | 80 506 | **79 964** | −542 |

Las grandes reducciones de LOC de esta serie (HomeView 7709→4838 ncloc, `user_controler` 4118→1994,
`SqlAdminService` 6851→5295) **no aparecen en las métricas agregadas de Sonar**. La razón es estructural:
**partir a módulos hermanos mueve el código, no lo simplifica** — el *smell* viaja con la función. La
prueba dura es que la peor función del repositorio sigue **idéntica**:

```
CC 218   backend/services/admin/SqlAdminService.js:2634   update()   ← sin cambio desde julio
CC  99   backend/services/admin/SqlAdminService.js         validateTableRules
```

**Lectura:** la extracción hecha hasta ahora (helpers **puros** a `.primitives/.queries/.workflows/…`)
mejora navegabilidad y testabilidad —objetivos legítimos— pero **no** ha tocado la complejidad real, que
vive en los métodos con estado. El siguiente pase de God Objects tiene que ser *Extract Class* con estado
y *Replace Conditional*, no más *Extract Function* de lo fácil.

> ⚠️ **BLOCKER=5 reaparece.** Son los mismos falsos positivos que julio marcó como *won't fix*
> (`for(;;)` del worker daemon `S2189`, alfabetos de tokens `S6418` ×4). El marcado manual **no sobrevive
> a un re-análisis limpio**; hay que re-marcarlos en Sonar, no "arreglarlos".

---

## 1.b RE-ESCANEO tras los cuts #1–#9 (2026-08-06, `develop @3721069`)

**La pregunta que esta auditoría dejó abierta era si el refactor tocaba la complejidad o solo el tamaño. Ya hay respuesta, y
es distinta según la técnica.**

| Métrica | Jul (`@090dd44`) | **Hoy (`@3721069`)** | Δ |
|---|---:|---:|---:|
| Complejidad cognitiva total | 9 022 | **8 840** | −182 (−2 %) |
| Deuda técnica (SQALE) | 5 350 min | **5 042 min** | −308 (−5,8 %) |
| Code smells | 623 | 649 | +26 |
| Bugs | 143 | **143** | = |
| Vulnerabilidades | 46 | **46** | = |
| Duplicación | 3,2 % | **3,2 %** | = |
| Fiabilidad / Seguridad | C / D | **C / D** | = |
| **BLOCKER** | **5** | **0** | −5 |
| NCLOC | 79 964 | 80 306 | +342 |

### Lo que sí bajó: la peor función del repositorio

| | Jul | Hoy |
|---|---:|---:|
| `SqlAdminService.update()` | **CC 218** (la peor del repo) | **CC 16** (−93 %) |
| `SqlAdminService.create()` | CC 163 | **CC 16** |
| `SqlAdminService.remove()` | — | **bajo el umbral** (ya no aparece) |
| fichero `SqlAdminService.js` | CC 1 305 | **CC 153** (−88 %) |

El injerto más complejo que sobrevive es el hook `beforeUpdate` de `process_definition_versions` (**CC 25**): es la máquina de
estados draft→active→retired, complejidad legítima, ahora aislada y con nombre en vez de diluida en un método de 533 L.

### Lo que NO bajó, y por qué importa

**La familia entera** (`SqlAdminService.*`) suma hoy **CC 1 444**; en julio eran ≈1 688 (los 1 305 del fichero + 237 de
`.workflows.js` + los helpers puros que ya existían). Es decir **−14 % a nivel de familia frente a −88 % a nivel de fichero**:
buena parte de la complejidad **se movió**, no desapareció. Los dos casos límite lo enseñan sin ambigüedad:

- `saveTemplateArtifactDraft` — **CC 158**, hoy la peor de la familia. Se movió LITERAL en el cut #8 (documentado ahí
  mismo): Sonar mide exactamente lo que ese commit dijo que no hacía.
- `validateTableRules` — **CC 99**, intacta desde julio: nunca entró en el alcance.

**Conclusión de método, que corrige la lectura de §1:** no es que "el refactor mueva tamaño y no complejidad" en general —
depende de la TÉCNICA. *Extract Class* mueve (cuts #1–#6, #8, #9). *Replace Conditional with Registry* **simplifica** (cut #7:
218→16). El §1 observó lo primero porque hasta entonces solo se había hecho *Extract Function/Class*.

### Siguientes objetivos por complejidad (ya sin `SqlAdminService.update`)

| CC | Dónde |
|---:|---|
| **158** | `templates/templateLifecycle.js:966` → `saveTemplateArtifactDraft` (needs caracterización multipart antes) |
| ~~99~~ | ~~`crud/validation.js` → `validateTableRules`~~ — **HECHO, cut #10** (ver abajo) |
| 75 | `user_controler.js:1868` → `createGeneralTask` (ya listado en §3.2) |
| 67 | `frontend/.../useAdminSubmitFlow.js:30` |
| 59 / 49 | `backend/config/postgres.js:111` / `:47` → reescrituras de dialecto |
| 44 | `frontend/.../FirmarPdf.vue:2482` y `.../useAdminPresentationAdapters.js:94` |
| 36 | `SqlAdminService.js:261` → `list()`, el motor de lectura con sus 6 injertos |

Tras el cut #10 **la peor función del backend es `saveTemplateArtifactDraft` (158)**, con el doble de complejidad que la
siguiente. Es el objetivo obvio, y sigue bloqueado por lo mismo: necesita caracterización multipart antes de tocarlo.

> **Nota sobre el marcado manual.** Se confirmó otra vez lo que avisa §1: al mover `PERSON_TOKEN_CHARS` de
> `SqlAdminService.js` a `.tableHooks.js`, su `S6418` marcado *won't fix* se cerró y **reapareció sin marcar en el fichero
> nuevo**, llevándose la nota de seguridad de D a **E**. No era un defecto nuevo: re-marcado (como sus tres gemelos ya lo
> estaban), vuelve a D y a 46 vulnerabilidades. **Las marcas manuales no sobreviven a que el código cambie de fichero** — hay
> que revisarlas después de cada refactor.

---

## 2. Ranking real de God (por complejidad cognitiva, no por LOC)

El LOC engaña (`sqlTables.js` son 1009 L de datos; `AdminTableManager` es un motor grande y sano). La
métrica que ordena a los God es la **complejidad cognitiva** acumulada por fichero:

| CC | ncloc | Fichero | Veredicto |
|---:|---:|---|---|
| **1305** | 5295 | `backend/services/admin/SqlAdminService.js` | **God #1 — CERRADO.** Cuts #1–#9: 5924 → **897 L (−85 %)**; `create()`/`update()`/`remove()` sin un solo injerto (§3.1). Falta re-escanear con Sonar. |
| **356** | 1190 | `signer/app.py` | 🆕 **God nunca auditado** (microservicio firmante Python) |
| 352 | 4838 | `frontend/.../home/views/HomeView.vue` | God conocido, refactor en curso |
| 345 | 1994 | `backend/controllers/users/user_controler.js` | God conocido — **partido pero no simplificado** |
| 287 | 4001 | `frontend/.../admin/components/tables/AdminTableManager.vue` | **Motor legítimo** (injertos, no God) |
| 262 | 2724 | `frontend/.../firmas/components/FirmarPdf.vue` | **God real** (6 responsabilidades) |
| **237** | 472 | `backend/services/admin/templates/workflows.js` | 🆕 **hermano creado POR el refactor, ya hotspot** |
| 204 | 1172 | `backend/services/documents/DocumentSignatureWorkflowService.js` | God moderado |
| 144 | 853 | `backend/controllers/sign/sign_controller.js` | **Viola CLAUDE.md** (motor de batch en el controller) |
| 140 | 850 | `frontend/.../home/composables/useDeliverableView.js` | Proyección read-only (ver nota §6) |
| 140 | 896 | `frontend/.../admin/composables/processes/useProcessDefinitionManager.js` | **God composable** (~57 params) |
| 130 | 1198 | `frontend/.../admin/views/AdminView.vue` | **God por duplicación** (5 bloques ×5) |

**Dos entradas que ninguna auditoría previa registró:** `signer/app.py` (CC 356, el segundo peor del repo)
y `templates/workflows.js` (CC 237) — el propio refactor engendró un hermano complejo (una función
en `:425` con CC 54). Ambos merecen su propio pase.

---

## 3. Diagnóstico y cura por God

### 3.1 `SqlAdminService.js` (CC 1305) — el de mayor retorno

Motor genérico **bueno en su núcleo** (`list`/`getByKeys`/`create`/`update` dirigidos por
`sqlTables.js` + `pickPayload`), ahogado por dos cosas:

- **23 entidades cosidas** como cadenas `if (tableName === "…")` dentro de `create()` (`:2128-2634`, ~506 L)
  y `update()` (`:2634-3165`, ~531 L). No es un `switch` (0 coincidencias); es control-flow por-entidad
  inline — lo contrario de `FK_TABLE_MAP` (que es *datos*).
- **7 subsistemas sin relación** (Divergent Change de manual): MinIO (`:243-412`), versionado/series de
  process-definitions (`:600-817`), ciclo de vida de template artifacts (`:4251-5824`), sync de workflows
  fill/signature (`:3799-4139`), grafos de unidades/procesos (`:1507-2126`), asignación/handover de
  task-items (`:3503-3720`), y el CRUD genérico.

**Cura (por orden):**
1. *Extract Class* de los 7 subsistemas → `MinioStorageService`, `ProcessDefinitionVersionService`,
   `TemplateArtifactService`, `WorkflowSyncService` (ya tiene su mitad pura en `.workflows.js`),
   `OrgStructureService`, `TaskAssignmentService`, y el núcleo `SqlCrudEngine`.
2. *Replace Conditional with Registry*: las 23 ramas por tabla → un **registro de hooks por tabla**
   (`beforeCreate/afterCreate/beforeUpdate`), el equivalente backend de `FK_TABLE_MAP`. Baja `update()`
   de ~500 L a ~40 y convierte la lógica por-entidad en **datos localizables**.
3. **Precondición innegociable:** characterization tests HTTP sobre los endpoints admin **antes** de mover
   nada (el harness `backend/tests/characterization/` ya existe; ampliarlo).

**Progreso (2026-07-17):**
- **Caracterización ampliada** (char 86 → **119**): contrato de lectura del `list()` genérico (26 tablas) + 7 GET de
  subsistemas (activation-diff, target-scope, resolvable-cargos, series-scope, stuck, attachable-processes, artifact-versions).
  Es la red para los cuts. Puramente aditiva (goldens previos intactos).
- **Cut #2 `OrgStructureService` HECHO** (`org/orgStructure.js`, 437 L): 13 métodos de unidades/puestos/grafo
  extraídos por script. El cluster era autocontenido (solo `this.pool` + `getByKeys` inyectado). `SqlAdminService` mantiene
  **12 delegadores** con la misma firma → controller y grafts de `create()`/`update()` (que llaman `this.wouldCreateUnitCycle`
  / `this.assertUnitHeadAllowed`) **no se tocan**. `SqlAdminService.js` 5924 → **5535 L** (−389). Verificado: `node --check`,
  backend arranca, **char 119/119**, unit 177/177, organigrama (15 nodos) en navegador, consola limpia.
- **Cut #1 `MinioStorageService` HECHO** (`kernel/storage.js`, 266 L): 20 funciones de **nivel de módulo** (MinIO +
  fs + zip) → patrón **módulo hermano** (no clase con estado): mover funciones + re-importar las 15 usadas fuera; el cliente
  MinIO es singleton privado del módulo. Único acoplamiento resuelto: `buildProtectedManifest` recibe ahora el prefijo editable
  por parámetro (no depende de `EDITABLE_CONTENT_SUBPATH`, const de dominio que se queda). Imports muertos podados (`Minio`,
  `spawn`). `SqlAdminService.js` 5535 → **5300 L** (−235). Verificado: `node --check`, backend arranca, **char 119/119**, unit
  177/177, y **smoke MinIO real**: `template_seeds/:id/download` → 200 (`downloadMinioPrefixToDirectory`+zip), preview ejercita
  `listMinioObjects` (404 preexistente por datos, no crash). **`SqlAdminService.js`: 5924 → 5300 L en los cuts #1+#2 (−624).**
- **Cut #3 `TemplateArtifactService` HECHO** (`templates/templateArtifact.js`, 544 L): ciclo de vida de artifacts
  (publicar/retirar/versionar, esquema, fuente, activación) — 12 métodos. **Alcance reducido a propósito**: se deja fuera
  `saveTemplateArtifactDraft` (542 L, God-method que llama 6 colaboradores de scope/workflow → necesita su propia
  descomposición). El cluster reducido solo depende de `ensurePool`+`getByKeys` (patrón clase con estado + 11 delegadores,
  como #2). El módulo importa 6 funciones de `storage.js` + `parseAvailableFormats` de `.artifacts.js`; 3 consts de config
  espejadas (deuda menor: unificar en módulo de constantes). `SqlAdminService.js` 5300 → **4823 L** (−477). Verificado:
  `node --check`, backend arranca, **char 119/119** (schema+versions vía delegador→módulo), unit 177/177, smoke de escritura
  (`POST .../version` ejecuta el módulo hasta una regla de negocio preexistente, no crash). **Acumulado #1+#2+#3: 5924 → 4823
  L (−1101, −19%).**
- **Cut #4 `ProcessDefinitionVersionService` HECHO** (`processes/processDefinitionVersion.js`, 540 L): series, versionado,
  clonado y contexto de borrador — 13 métodos. Cluster limpio: solo `ensurePool` + `getByKeys` + **`syncArtifactWorkflows`**
  (1 dep de workflow, inyectada); helpers puros importados de `processes/processDefinitionSeries.js` / `.versioning.js` / `.primitives.js`.
  Patrón clase con estado + 13 delegadores → controller y los grafts de `create()`/`update()` (que llaman resolve/ensure/clone/
  refresh — las tablas más "grafted") **no se tocan**. `SqlAdminService.js` 4823 → **4341 L** (−482). **Acumulado #1-#4: 5924 →
  4341 L (−1583, −27%).** Verificado: backend arranca, **char 119/119** (series-scope + flujo de launch que ejercita versionado
  + grafts), unit 177/177.
  > ⚠️ **Lección de la ejecución**: `node --check` valida SINTAXIS, **no resolución de imports**. El primer intento importó
  > `buildProcessDefinitionVersionName` de `.versioning.js` cuando en realidad vive en `processes/processDefinitionSeries.js` → el backend
  > **crasheó al arrancar** (`does not provide an export`), no en `node --check`. **Verificar SIEMPRE que el backend arranca
  > (logs "Servidor iniciado", sin SyntaxError) antes de correr char.**
- **Cut #5 `WorkflowSyncService` HECHO** (`templates/workflowSync.js`, 584 L): sincronización de flujos fill/firma de los
  artifacts con sus plantillas de proceso, estado y reconciliación — 13 métodos. Depende de `this.pool` + **4 colaboradores
  inyectados** (`getCargoCodeMap`, `getUnitTypeNameMap`, `getTemplateArtifact`, `loadTemplateArtifactMetaDocument` — los 2
  últimos ya delegadores del #3); helpers puros de `.artifacts.js`/`.workflows.js`. **Sin `getByKeys`.** Clase con estado + 4
  delegadores; los servicios #3/#4 que inyectan `syncArtifactWorkflows` siguen funcionando (su binding llama el delegador).
  `SqlAdminService.js` 4341 → **3816 L** (−525). **Acumulado #1-#5: 5924 → 3816 L (−2108, −36%).** Verificado: backend arranca,
  **char 119/119**, unit 177/177, **smoke** `GET sync-status` → 200 + `POST workflows/reconcile` → 200 (vía delegador→módulo).
- **Cut #6 `TaskAssignmentService` HECHO** (`org/taskAssignment.js`, 413 L): asignación/reconciliación de task items,
  handover, atascados, jefe inmediato, + mapas de referencia (cargo/unit-type) y resolución de scope/cargos-resolubles — 10
  métodos. **El cut más limpio: cluster AUTOCONTENIDO, cero colaboradores** (solo `this.pool` + el import `normalizeNumericId`;
  las llamadas intra-cluster se quedan dentro) → **sin inyección**. Clase con estado + 9 delegadores; el controller,
  `saveTemplateArtifactDraft` y `WorkflowSyncService` (que llaman `getCargoCodeMap`/`getProcessTargetScope`/… vía `this.`) no se
  tocan. `SqlAdminService.js` 3816 → **3441 L** (−375). **Acumulado #1-#6: 5924 → 3441 L (−2483, −42%).** Verificado: backend
  arranca, **char 119/119** (target-scope, resolvable-cargos, stuck), unit 177/177, smoke `resolvable-cargos` → 200.

#### Preparación del cut #7 — mapa de cobertura de los grafts (2026-07-18)

El cut #7 (convertir los ~20 injertos `if (tableName === X)` de `create()`/`update()` en un **registro de hooks por tabla**)
es el de mayor valor y mayor riesgo. Antes de tocarlo se preparó la red de caracterización de sus **caminos de ÉXITO** (hoy
solo había contratos de ERROR). **char 119 → 121.**

**Hallazgo que fija la estrategia:** los grafts se alcanzan **SOLO por el CRUD admin** (`POST`/`PUT` `/admin/sql/:table`). Los
flujos de la app (launch, ejecución, firma) **NO** pasan por `create()`/`update()`: `TaskGenerationService` y compañía hacen
`INSERT INTO tasks/task_items/documents` **directo** (verificado). Así que caracterizar un graft = **round-trip admin
autolimpiante** (crear → fijar la respuesta normalizada → borrar, para no alterar los conteos `list_*`).

| Grupo | Tablas | Cobertura hoy |
|---|---|---|
| **Éxito caracterizado** (nuevos round-trips) | `persons` (hash de contraseña + token, con asserts de que NO devuelve la contraseña), `unit_positions` (validación cabeza/tipo) | ✅ golden + asserts |
| **Solo contrato de error** | `unit_relations`, `process_definition_series`, `vacancies`, `cargos`, `unit_types`, `processes` | ⚠️ falta éxito (payloads simples, añadir en el cut) |
| **Solo error + estado complejo** | `process_definition_versions`, `process_definition_templates`, `process_target_rules`, `process_definition_period_types`, `template_artifacts` | ⚠️ requieren contexto de **borrador de definición** (cascada); caracterizar con setup previo |
| **Runtime, CRUD-admin-only** | `tasks`, `task_items`, `documents`, `document_versions`, `fill_/signature_flow_*`, `*_requests`, `document_signatures` | ⚠️ los flujos NO los ejercitan (usan SQL directo); su graft admin es funcionalidad de borde |

**Estrategia recomendada para el cut #7: TABLA POR TABLA, no todo de golpe.** Para cada tabla grafted: (1) añadir su round-trip
de éxito (patrón ya establecido con `persons`/`unit_positions`); (2) extraer su rama a un hook `{ beforeCreate/afterCreate/…}`;
(3) verificar golden idéntico + arranque + char. Empezar por el grupo de payloads simples; las de estado complejo, con su setup;
las runtime, valorar si su create admin merece hook o puede quedar en el catch-all. El registro de hooks es el equivalente
backend de `FK_TABLE_MAP` que el §6 cita como buen diseño.

#### Cut #7 HECHO (2026-08-05) — `crud/tableHooks.js`, 1060 L

**`create()` y `update()` quedan SIN UN SOLO `if (tableName === X)`.** Son ya motores genéricos puros dirigidos por
`sqlTables.js`. Las 20 tablas injertadas son ahora 20 entradas declarativas del registro.

| | antes | después |
|---|---:|---:|
| `create()` | 506 L, 20 tablas, CC 163 | **81 L, 0 injertos** |
| `update()` | 533 L, 22 tablas, **CC 218** (la peor función del repo) | **91 L, 0 injertos** |
| `SqlAdminService.js` | 3440 L | **2538 L** (−902, −26 %) |

**Acumulado God #1 (cuts #1–#7): 5924 → 2538 L (−57 %).** Falta re-escanear con Sonar para medir la CC real.

**Hallazgo estructural que hizo esto seguro:** los injertos no vivían en un punto sino en **tres zonas** —pre-escritura,
estrategia de escritura (transacción + efectos) y remapeo de error—, de ahí que el registro necesite más superficie que
`beforeCreate/afterCreate`: `beforeCreate` · `afterValidateCreate` · `beforeInsertTx` · `afterInsertTx` · `mapCreateError` ·
`beforeUpdate` · `needsUpdateTransaction` · `beforeUpdateTx` · `afterUpdateTx` · `afterUpdate` · `mapUpdateError`.
Y el que permitió migrar **tabla por tabla sin big-bang**: el orden RELATIVO entre tablas distintas es irrelevante (las ramas
son mutuamente excluyentes), así que basta un punto de despacho por zona y el registro convive con los `if` sin migrar.

**Dónde paga de verdad:** las 7 ramas transaccionales de `create()` y las 6 de `update()` eran **idénticas salvo su efecto**
(getConnection → begin → escribir → efecto → commit/rollback/release) y colapsan a un único `runInTransaction()`.

**Red de caracterización: char 121 → 131**, en tres tandas, siempre **puramente aditiva** (0 borrados en el golden, prueba de
que los round-trips autolimpiantes no mueven los conteos `list_*`). Lo nuevo: los dos sentidos del merge de `unit_positions`,
el rehash de `persons` en PUT, la unicidad de padre de `unit_relations`, el orden post-`validateTableRules` de `vacancies`, el
refresco de nombres de `cargos`/`processes`, el `document_versions` transaccional, y una **cadena completa
proceso → serie → borrador → regla → periodo → clon** fabricada y destruida por el propio test (fija la identidad derivada, el
nombre generado, el `__notice` del clonado y en qué guard se detiene la activación).

**Tres cosas preexistentes que salieron al extraer** (todas preservadas, ninguna "arreglada" dentro del refactor):
1. El injerto de `fill_flow_templates` asignaba `payload.process_definition_id` y lo borraba 3 líneas después: **código muerto**
   (no es campo de la tabla en `sqlTables.js`, `pickPayload` nunca lo pone). No se trasladó; queda documentado en el hook.
2. **Los remapeos de `ER_DUP_ENTRY` no disparan**: `ER_DUP_ENTRY` es código de **MySQL** y la base es PostgreSQL desde la
   migración (verificado por smoke: emerge el mensaje crudo del constraint). Afecta a `tasks` y a
   `uq_process_definition_one_active_series`. **Deuda abierta**: mapear los códigos de PG (`23505`).
3. 23 imports huérfanos en `SqlAdminService.js` que arrastraban los cuts #1–#6 (el #7 no dejó ninguno). Podados en su propio
   commit.

**Verificación de cada tanda:** `node --check` + backend arranca ("Servidor iniciado") + char en modo compare con los goldens
**idénticos** + unit 177/177 + smoke por API de los hooks que el char no alcanza (los tres de `tasks`).

#### Cuts #7b, #8 y #9 — God #1 CERRADO (2026-08-06)

| cut | qué | `SqlAdminService.js` |
|---|---|---:|
| **#7b** | `remove()` al registro (5 tablas + su rama en cascada) → 99 → **47 L, 0 injertos** | 2538 → 2459 |
| **#8** | `TemplateLifecycleService` (ciclo de vida de plantillas/entregables): 14 métodos + 11 helpers de módulo, 1 507 L | 2459 → **1094** |
| **#9** | `ProcessGraphService` (jerarquía y grafo de procesos, 5 métodos): gemelo exacto de `OrgStructureService` | 1094 → **897** |

**Acumulado God #1 (cuts #1–#9): 5 924 → 897 L (−85 %).** Quedan 24 métodos propios (~640 L): el motor CRUD (~460 L, el
"buen diseño" que §3.1 dice no tocar), los tres guards de activación y seis lecturas cortas que usan los hooks; más 68
delegadores de una línea a los ocho servicios extraídos. Los 8 `tableName === X` que sobreviven están **solo en el motor de
LECTURA** (`list` ×6, `getByKeys` ×1 + `sanitizePersonRow`): son fragmentos de SELECT/JOIN y overrides de orden, otra forma
distinta, que necesitarían hooks propios.

**Red de caracterización: char 121 → 148**, con un flow nuevo `zz_template_lifecycle` (prefijo `zz_` deliberado: muta la base)
que fija el update guiado de punta a punta — crear borradores de plantilla + configuración clonada, y publicarlos, que es
donde se encadena casi todo el cluster del cut #8.

**`saveTemplateArtifactDraft` (542 L) sigue sin descomponer**, dicho claro: se movió LITERAL. Su ruta es multipart con subida
de ficheros y no tiene caracterización propia; partirlo a ciegas sería el error que §1 señala. Es el siguiente trabajo, y
necesita su red antes. Sí quedó verificado por smoke en sus dos ramas (POST con PDF de referencia y PUT `isEdit`).

#### Cut #10 — `validateTableRules` a registro (2026-08-06, `develop @9e91711`)

El `switch (tableName)` de `crud/validation.js`: 22 `case`, 159 ncloc, **CC 99**, la densidad más alta de la
familia (0,49 CC/ncloc). Mismo olor que los cuts #7/#7b quitaron de create/update/remove, pero en forma de switch — por eso
§3.1 lo pasó por alto en su momento ("no es un switch", dicho mirando el otro fichero).

**Resultado medido (re-escaneo del mismo día, tras el de `@3721069`):**

| | Antes | Después |
|---|---:|---:|
| función `validateTableRules` | **CC 99** | **bajo el umbral** — su `S3776` cerró como *FIXED*, ninguna función del fichero pasa de 15 |
| fichero `crud/validation.js` | ≈106 | **CC 50** |
| `validateTableRules` en ncloc | 185 | **10** |
| complejidad cognitiva del proyecto | 8 840 | **8 781** (−59) |

Batió la estimación por analogía del handoff (55–65), y por un motivo que conviene retener: **esa estimación asumía una
función por tabla**. El resultado real reparte el trabajo entre 13 tablas que son **datos puros** (`requires` /
`datesInOrder`, cero ramas) y 9 funciones pequeñas. Los datos no tienen complejidad; una función por tabla sí la habría
tenido. *Replace Conditional with Registry* rinde más cuanto más del condicional se pueda expresar como tabla.

**Dónde vive, y por qué no en `tableHooks.js`.** El registro se quedó en `validation.js` en contra de lo que proponía el
handoff del cut #10. Motivo: los hooks son `(ctx)` asíncronos con pool, estas reglas son puras y síncronas; meterlas allí
exigía un tercer módulo solo para romper el ciclo `validation ↔ tableHooks` y haría que el test puro cargase bcrypt,
`TaskGenerationService` y `DocumentProgressService`. **La ganancia de CC no depende del fichero de destino** — la da aplanar
el anidamiento.

**Lo que cazó la red** (dos veces, y ninguna la habría visto char):
- El script troceador contaba llaves pero no paréntesis y partía `task_items` a mitad de su condición multilínea. Lo paró un
  invariante del propio script: las sentencias troceadas deben reconstruir el cuerpo línea a línea.
- `datesInOrder` se emitió con los campos de fecha para las tablas que versionan vigencias (`effective_from`/`effective_to`)
  **antes de generalizar el helper**, que seguía leyendo `start_date`/`end_date`. Dos validaciones quedaron mudas. Lo cazaron
  los unit tests de orden de fechas; char no, porque ninguna ruta caracterizada manda vigencias invertidas.

**Guards INTERCALADOS — la trampa de esta familia.** Tres tablas no siguen el patrón "requeridos primero":
`process_definition_versions` mete el semver entre sus requeridos, `process_target_rules` valida fechas ANTES de su
requerido y `task_items` mete el guard de origen en medio. Normalizarlas cambiaría el mensaje que ve el usuario sin romper
nada visible. Hay unit tests dedicados a clavar ese orden (`202 → 209`; la red total pasó de 194 a 209).

Verificado: unit 209, char 148 con **goldens idénticos** (0 bytes de diff), `check:imports` OK, arranque limpio. Ratings sin
mover: 0 BLOCKER, 46 vulnerabilidades, C/D — esta vez no hubo marcas manuales que rescatar porque nada cambió de fichero.

> **Nota de acceso a Sonar.** La instancia de `:9002` **ya no admite `admin:admin`**: SonarQube 26 retiró el basic-auth
> usuario/contraseña de la API, y además la contraseña de esa instancia había cambiado. Se reseteó por base de datos
> (`UPDATE users ... WHERE login='admin'` en el contenedor `sonar-db`) y quedó de nuevo en `admin`. Cuidado: **el snippet
> canónico que circula para ese reset no vale en esta versión**. El hash correcto es PBKDF2-HMAC-SHA512, 100 000
> iteraciones, 64 bytes, con el **salt base64-DECODIFICADO** a bytes (no el string), y `crypted_password` = `100000$<b64>`.
> Los tokens se generan por sesión: `POST /api/authentication/login` con cookie jar + cabecera `X-XSRF-TOKEN`.

### 3.1.b Deuda encontrada al revisar (2026-08-06) — tres defectos de producción

Revisando la deuda antes de re-escanear con Sonar aparecieron **tres fallos reales**, ninguno introducido por los cuts:

**1. Los mapeos de error hablaban MySQL sobre una base PostgreSQL.** Ocho `if (error.code === "ER_DUP_ENTRY")` /
`"ER_ROW_IS_REFERENCED"` repartidos por cuatro ficheros llevaban muertos desde la migración: PostgreSQL usa **SQLSTATE**
(`23505`, `23503`). El usuario recibía el esquema de la base en la cara —
`duplicate key value violates unique constraint "persons_cedula_key"`. Arreglado en `errors/sqlErrors.js`, que además
aprovecha lo que el driver ya daba y nadie usaba: `constraint` (nombre exacto, sustituye al frágil
`String(message).includes(...)`), `table` y `detail` (de donde salen las columnas), y las etiquetas de `sqlTables.js` para
hablar el idioma del formulario. Se conectó una **red genérica en `create`/`update`/`remove`**: sin ella solo estaban
cubiertas las tablas con mensaje propio y las otras ~40 seguían filtrando el texto crudo. Dos defectos adyacentes lo
bloqueaban: `sql_admin_controller` tenía **39 de 47 catch con el status hardcodeado** (aplastaba a 400 no solo los 409
nuevos, también seis `statusCode` deliberados —403 y 422— que ya existían), y `createUser` devolvía el mensaje crudo en un
campo hermano.

**2. Cuatro `ReferenceError` latentes de los cuts #2/#3/#6.** Helpers movidos a módulos hermanos sin su `import`:
`slugify` en `orgStructure`(→`createUnitWithParent`) y en `taskAssignment`(→`getCargoCodeMap`), `parseYamlDocument` y
`bumpSemanticVersion` en `templateArtifact` (→ meta de plantilla y update guiado). **Rotos en producción tres semanas.**
Es una clase de fallo que se cuela por todas las puertas: `node --check` valida sintaxis y un identificador libre es sintaxis
válida; el backend **arranca** sin quejarse porque el fallo es en tiempo de LLAMADA; y char/unit solo lo ven si cubren esa
ruta exacta. La lección registrada tras el cut #4 ("`node --check` no valida resolución de imports") se quedaba corta:
**verificar el arranque tampoco basta.** Arreglo duradero: `npm run check:imports`
(`scripts/check_missing_imports.mjs`), que construye el vocabulario de lo que exporta cada módulo y busca usos en ficheros
que ni lo importan ni lo declaran. Verificado que caza los cuatro.

**3. `saveTemplateArtifactDraft` compensaba de menos: la creación fallida dejaba el `deliverable` huérfano.** La función
no corre en transacción; el `catch` compensa a mano y borraba la fila de `template_artifacts` y el prefijo de MinIO, pero
**no** la fila de `deliverables` recién insertada ni el vínculo a la configuración. Reproducido contra dev: un POST con
`process_definition_id` inexistente falla con "El proceso destino seleccionado no existe." (400) **después** del INSERT, y
la fila sobrevive con `owner_process_id` NULL. El daño real no es la fila suelta: el alta busca el deliverable por `code`
(`draft_<slug(display_name)>`), así que el siguiente intento con el mismo nombre **reusa la huérfana** y hereda sus NULL —
aunque el artifact sí quede bien vinculado. Ese entregable se queda sin proceso dueño, en silencio y para siempre.
Arreglado anotando lo que insertó *esa* llamada (`insertedDeliverableId`, `insertedLinkId`) y deshaciéndolo en orden
inverso (vínculo → artifact → deliverable; ninguna FK cascadea). Se distingue **insertar de REUSAR**: un deliverable
preexistente con ese `code` pertenece a versiones anteriores y no se toca. Es el caso de libro del patrón de esta sección:
el golden se capturó primero con el comportamiento **roto** (`zzz_artifact_draft`, clave `defecto_deliverable_huerfano`,
que **no se renombra** para no borrar la prueba) y el diff de ese golden —`{owner_process_id: null}` → `null`— **es** la
evidencia del arreglo.

### 3.1.c Red de seguridad para `saveTemplateArtifactDraft` (fase 1, 2026-08-06)

Antes de partir la peor función del backend (`templateLifecycle.js:966`, 541 L, CC 158 — el doble que la siguiente) hacía
falta la red, porque su ruta es **multipart con subida de ficheros**, escribe en **cinco sitios** (MinIO incluido) y no
tenía ningún golden. **`char 148 → 161`**, con tres piezas nuevas:

1. **Multipart en el harness.** `lib/http.mjs` forzaba `Content-Type: application/json` en cuanto había `body`. Se añade
   una opción `form` que envía `FormData`; el camino JSON queda intacto. La trampa: **no fijar el `Content-Type` a mano** —
   sin el `boundary` que genera `fetch`, multer rechaza la petición.
2. **`lib/db.mjs`, SQL directo SOLO para teardown.** Excepción medida al harness HTTP-only, porque la limpieza **no se
   puede hacer por HTTP**: `deliverables` no está en `config/sqlTables.js` ni tiene método de servicio que la borre (no
   existe ninguna ruta que elimine esa fila); `DELETE process_definition_templates` responde 400 mientras la configuración
   destino no esté en `draft` (la de la fixture está `active`); y sin borrar el vínculo, `DELETE template_artifacts`
   responde 409 por FK. Se usa para **limpiar, nunca para asertar**.
3. **`flows/zzz_artifact_draft.test.mjs`** — 13 casos: contratos de error de la validación, que `routed` **no** exige flujo
   de entrega, los caminos felices de crear (POST) y editar (PUT), y el defecto de compensación de §3.1.b.

**Prefijo `zzz_`, no `zz_`.** Los flows corren en orden alfabético; `zz_artifact_draft` habría corrido el **primero** de
los `zz_` ("artifact" < "task" < "template") y habría movido secuencias y conteos que observan `zz_task_generation` y
`zz_template_lifecycle`. Con `zzz_` corre el último y no puede perturbar ningún golden previo.

**Solo se enmascara `id`** — y esto corrige el supuesto de partida. Medido: `storage_version` sale de la **base**
(`getNextStorageVersionForTemplateCode` une `template_artifacts`→`deliverables` por `code`), **no de MinIO**, así que con
el round-trip autolimpiante vuelve a `1.0.0` en cada corrida; y `content_hash` es **determinista** (idéntico entre corridas
con la base reseteada y MinIO en distinto estado). Fijarlos literalmente convierte el golden en una **huella byte a byte**
del `meta.yaml`, el `schema.json`, el contrato de la semilla y el fichero subido — mucho más fuerte que enmascararlos.

**MinIO no se limpia, a propósito.** El prefijo es determinista y la subida lo reescribe idéntico en cada corrida; ningún
golden lo observa. No hacía falta buscarle una ruta de borrado.

Verificado: char 161/161, unit 209/209, diff de goldens **puramente aditivo** (0 borrados) en la fase 1, `check:imports`
OK, arranque limpio y **cero residuos** en la base tras la corrida. **Pendiente: el corte (fase 2).**

### 3.2 Controllers que violan CLAUDE.md (lógica de negocio arriba)

| Fichero:línea | Qué hay | Baja a |
|---|---|---|
| `sign_controller.js:412-490,644-763` | Motor de batch-jobs completo (persistencia + bucle `setImmediate`) | `BatchSigningService` |
| `sign_controller.js:182-359` | Plan de almacenamiento + firma de PDF | `PdfSigningService` |
| `sign_workflow_controller.js:143-244` | Máquina de estados de `fill_requests` (transacción, transiciones, reactivación de pasos) | `FillRequestWorkflowService` |
| `user_controler.js:1867-2228` | `createGeneralTask` — creación transaccional con reglas de `item_mode` | `GeneralTaskService` |
| `user_controler.js:200-575` | `getUserMenu` — jerarquía org + resolución RBAC por posición (375 L) | `UserMenuService` |

`DocumentWorkflowResetService.js` (258 L, una responsabilidad) es el **estilo objetivo** hacia el que
converger.

### 3.3 `DocumentSignatureWorkflowService.js` (CC 204) — God moderado

Todo gira alrededor del mismo agregado (flujo de firma), pero dos subresponsabilidades tienen eje de
cambio propio: **resolución de asignados por scope RBAC** (`:269-518` → `SignatureAssigneeResolver`) y
**sincronización de progreso/estado del documento** (`:1088-1288` → `DocumentProgressSyncService`). El
núcleo (readiness/ensure/register/snapshot) se queda.

### 3.4 Firmas front — `FirmarPdf.vue` (CC 262) es God **y** origen de un fork

`MultiSignerPanel.vue` es un **fork** del motor PDF de `FirmarPdf`, no una descomposición: **~230-260 L
duplicadas** (transformadas `toPdfUnits`/`toCssUnits`, `renderPage`, math del sello fantasma, paginación).
Mapa verificado: `FirmarPdf:1293-1417,1517-1604` ≡ `MultiSignerPanel:736-944,1079-1109`.

`FirmarPdf` mezcla **6 responsabilidades**: render PDF, colocación de campos, envío/firma (`confirmSign`
`:2482-2707` = **225 L** + 17 `fetch` inline), certificados, búsqueda de firmantes, validación+UI.

**Cura (§4.6 del plan, ampliada):** `usePdfCanvas()` (render+transformadas) + `useSignatureFieldPlacement()`
(interacción+ghost, **aquí se arregla el bug del sello fantasma en la raíz**) — corta por la costura del
fork. **Insuficiente sin un tercer entregable**: `signatureService`/`useSignatureSubmission()` que absorba
`confirmSign` + polling + los 17 `fetch` (lo que de verdad viola "no business logic en el frontend").

> **Corrección al diagnóstico previo del sello fantasma** (§3.2 de `plan-refactor-frontend.md`): en
> `MultiSignerPanel` el ref `isMouseOverPdf` **sí se lee** (`:169`); el mecanismo real del bug es que
> `handlePointerMove` (`:906-911`) reescribe `previewBoxStyle` **sin** la clave `display`, dejando
> `display !== 'none'` permanentemente verdadero. Reverificar antes de escribir el test de caracterización.

### 3.5 Admin front — `AdminView.vue` (CC 130) y `useProcessDefinitionManager.js` (CC 140)

- `AdminView` es **God por duplicación**: 5 bloques ×5 idénticos (`openXIndex`/`openXItem`/`resolveXItem…`
  para Academia/Gestión/Usuarios/Contratos/Seguridad, `:1038-1185`) + 7 refs paralelas. Se colapsa a un
  bucle sobre config **al mismo tiempo** que se enruta (ver §4).
- `useProcessDefinitionManager` recibe **~57 parámetros** (`:5-90`) — *Extract Method sin Extract Class*.
  Cura: **factory ×3** (definiciones/versiones/activación), como su vecino sano `useProcessWizard.js`
  (0 params, posee su estado).

### 3.6 Lo que **NO** es God (no tocar el motor)

- `sqlTables.js` (1009 L) y `frontend/.../sqlTables.js` — **datos**, no código.
- `AdminTableManager.vue` (4001 ncloc) — motor de metadatos legítimo; el peso son ~2 injertos concentrados
  (`process_definition_versions`, `template_artifacts`), a extraer como paneles propios, sin polimorfismo.
- `UnitGraphView`/`ProcessGraphView` — 17 % de similitud; dominio irreducible. Sólo extraer fontanería
  (`useGraphExport`/`useGraphLayout`) y **arreglar el selector global** de `ProcessGraphView.vue:1098`
  (apunta a `.unit-graph-canvas` ajeno — footgun latente que las subrutas pueden activar).

---

## 4. Admin → subrutas

**Frontend: SÍ. Es la Fase 3.5 de `plan-refactor-frontend.md` sin ejecutar** — el último gran bloque sin
migrar (`/home/*` y `/perfil/*` ya son rutas reales).

- `/admin` es una **ruta plana** (`core/router/index.js:61`), sin `children`.
- Todo el enrutado interno es **estado local**: 8 refs (`selectedTable`, `selectedSection`, 5
  `selected*Item` gemelas, 2 `graphTabActive`) — `AdminView.vue:390-403`. Cero `route.params`.
- Los grafos son **pseudo-tablas con claves sentinela** (`"__unit_graph__"`, `"__process_graph__"`).

**Migrar a `:section/:item/:table?`** (patrón ya validado en `/perfil`):
1. `/admin` → layout con `children` (o shell + `useWorkspaceChrome`, el patrón intermedio de la Fase 2.2).
2. Las 8 refs → `route.params`; `selectedTable` → `computed` sobre `route.params.table`. Elimina las ~40
   asignaciones `= ""` de exclusión mutua.
3. Grafos → ruta propia dentro de la frontera `defineAsyncComponent` existente.

**Ganancias por construcción:** `useAdminTableReset.js` (148 L) **desaparece** y el bug de `searchTerm`
se cura solo (lo hace el `unmount` de vue-router); lazy-loading por ruta; deep-link/F5/atrás arreglados.
El guard del admin debe migrar a `meta.blockedForAdmin` heredado (como se hizo en la Fase 3.4 de perfil).

**Backend: las rutas ya están bien.** `sql_admin_router.js` está sectorizado + un comodín `/:table` cubre
44 tablas con 4 handlers. **Partir routers sería cosmético**: el problema no es la superficie de rutas sino
el God de la capa de servicio (§3.1). Reordenar fachadas sin partir `SqlAdminService` no gana nada.

---

## 5. Orden recomendado

1. **Admin front → subrutas (Fase 3.5)** — riesgo medio, gana funcionalidad (deep-link), borra
   `useAdminTableReset` y colapsa `AdminView`. *En curso.*
2. ~~**`SqlAdminService` (God #1)**~~ — ✅ **HECHO** (cuts #1–#9, §3.1): *Extract Class* de 8 subsistemas +
   registro de hooks por tabla en los tres verbos de escritura. 5924 → 897 L (−85 %). Los códigos de error de
   PostgreSQL ya están mapeados (§3.1.b). **Pendiente: re-escaneo Sonar** (el objetivo era complejidad, no
   líneas, y solo Sonar lo confirma) y **descomponer `saveTemplateArtifactDraft`** (542 L, movido literal).
3. **Firmas: `usePdfCanvas` + `useSignatureFieldPlacement` + `signatureService`** — mata ~250 L
   duplicadas y el sello fantasma en la raíz.
4. **Controllers → services** (`FillRequestWorkflowService`, `BatchSigningService`, `GeneralTaskService`,
   `UserMenuService`) — cierra la fuga de capa que CLAUDE.md prohíbe.
5. **`signer/app.py`** (🆕 CC 356) y **`templates/workflows.js`** (🆕 CC 237) — pases propios.

---

## 6. Notas

- **`useDeliverableView.js` (CC 140) NO es Middle Man**: se midió que **lee 9 refs y no muta ninguno**
  (cero `.value =`). Es una **proyección/derivación read-only** legítima; su "cero estado propio" es la
  forma correcta, no un smell. Los 7 refs que recibe son estado transversal aguas-arriba (identidad,
  unidades, proceso abierto) compartido con otras piezas; hacer que los "posea" **invertiría** el
  acoplamiento en vez de reducirlo. Sólo `deliverableWorkspaceState` y `startedDeliverableIds` son
  candidatos genuinos a *Move Field* (a un pequeño `useDeliverableWorkspace`).
- **Instancia Sonar**: la contraseña de admin de julio se perdió (la generó un agente); se reseteó en la
  BD a `admin/admin`. **Cambiarla.** Token de análisis actual: `deasy-rescan` (revocable en *My Account →
  Security*).
