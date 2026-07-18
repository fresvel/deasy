# Auditoría de God Objects y tamaño — julio 2026 (re-medición)

> Re-escaneo **SonarQube 26.7** sobre `develop @ 090dd44` (código **actual**, con las fases de refactor
> de `plan-refactor-frontend.md` 0–4.2, la partición de `user_controler` M1–M4 y la extracción de
> `SqlAdminService` ya aplicadas) cruzado con lectura estructural directa del código.
> Complementa —no sustituye— a `auditoria-refactor-2026-07.md` (línea base) y
> `auditoria-refactor-user-controler-2026-07.md`.
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

## 2. Ranking real de God (por complejidad cognitiva, no por LOC)

El LOC engaña (`sqlTables.js` son 1009 L de datos; `AdminTableManager` es un motor grande y sano). La
métrica que ordena a los God es la **complejidad cognitiva** acumulada por fichero:

| CC | ncloc | Fichero | Veredicto |
|---:|---:|---|---|
| **1305** | 5295 | `backend/services/admin/SqlAdminService.js` | **God #1** — el 14 % de toda la CC del repo en un fichero |
| **356** | 1190 | `signer/app.py` | 🆕 **God nunca auditado** (microservicio firmante Python) |
| 352 | 4838 | `frontend/.../home/views/HomeView.vue` | God conocido, refactor en curso |
| 345 | 1994 | `backend/controllers/users/user_controler.js` | God conocido — **partido pero no simplificado** |
| 287 | 4001 | `frontend/.../admin/components/tables/AdminTableManager.vue` | **Motor legítimo** (injertos, no God) |
| 262 | 2724 | `frontend/.../firmas/components/FirmarPdf.vue` | **God real** (6 responsabilidades) |
| **237** | 472 | `backend/services/admin/SqlAdminService.workflows.js` | 🆕 **hermano creado POR el refactor, ya hotspot** |
| 204 | 1172 | `backend/services/documents/DocumentSignatureWorkflowService.js` | God moderado |
| 144 | 853 | `backend/controllers/sign/sign_controller.js` | **Viola CLAUDE.md** (motor de batch en el controller) |
| 140 | 850 | `frontend/.../home/composables/useDeliverableView.js` | Proyección read-only (ver nota §6) |
| 140 | 896 | `frontend/.../admin/composables/processes/useProcessDefinitionManager.js` | **God composable** (~57 params) |
| 130 | 1198 | `frontend/.../admin/views/AdminView.vue` | **God por duplicación** (5 bloques ×5) |

**Dos entradas que ninguna auditoría previa registró:** `signer/app.py` (CC 356, el segundo peor del repo)
y `SqlAdminService.workflows.js` (CC 237) — el propio refactor engendró un hermano complejo (una función
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
- **Cut #2 `OrgStructureService` HECHO** (`SqlAdminService.orgStructure.js`, 437 L): 13 métodos de unidades/puestos/grafo
  extraídos por script. El cluster era autocontenido (solo `this.pool` + `getByKeys` inyectado). `SqlAdminService` mantiene
  **12 delegadores** con la misma firma → controller y grafts de `create()`/`update()` (que llaman `this.wouldCreateUnitCycle`
  / `this.assertUnitHeadAllowed`) **no se tocan**. `SqlAdminService.js` 5924 → **5535 L** (−389). Verificado: `node --check`,
  backend arranca, **char 119/119**, unit 177/177, organigrama (15 nodos) en navegador, consola limpia.
- **Cut #1 `MinioStorageService` HECHO** (`SqlAdminService.storage.js`, 266 L): 20 funciones de **nivel de módulo** (MinIO +
  fs + zip) → patrón **módulo hermano** (no clase con estado): mover funciones + re-importar las 15 usadas fuera; el cliente
  MinIO es singleton privado del módulo. Único acoplamiento resuelto: `buildProtectedManifest` recibe ahora el prefijo editable
  por parámetro (no depende de `EDITABLE_CONTENT_SUBPATH`, const de dominio que se queda). Imports muertos podados (`Minio`,
  `spawn`). `SqlAdminService.js` 5535 → **5300 L** (−235). Verificado: `node --check`, backend arranca, **char 119/119**, unit
  177/177, y **smoke MinIO real**: `template_seeds/:id/download` → 200 (`downloadMinioPrefixToDirectory`+zip), preview ejercita
  `listMinioObjects` (404 preexistente por datos, no crash). **`SqlAdminService.js`: 5924 → 5300 L en los cuts #1+#2 (−624).**

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
2. **`SqlAdminService` (God #1)** — mayor retorno por CC, pero exige characterization tests HTTP primero.
   *Extract Class* de subsistemas + registro de hooks por tabla.
3. **Firmas: `usePdfCanvas` + `useSignatureFieldPlacement` + `signatureService`** — mata ~250 L
   duplicadas y el sello fantasma en la raíz.
4. **Controllers → services** (`FillRequestWorkflowService`, `BatchSigningService`, `GeneralTaskService`,
   `UserMenuService`) — cierra la fuga de capa que CLAUDE.md prohíbe.
5. **`signer/app.py`** (🆕 CC 356) y **`SqlAdminService.workflows.js`** (🆕 CC 237) — pases propios.

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
</content>
</invoke>
