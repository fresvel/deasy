# Auditoría de calidad y plan de refactorización — julio 2026

Auditoría estática del monorepo con **SonarQube 26.7** (Community, levantado en Docker)
cruzada con el catálogo de *code smells* y técnicas de **[refactoring.guru](https://refactoring.guru/refactoring)**
(Fowler / Shvets).

Reproducir el análisis:

```bash
docker compose -f scripts/sonar/compose.yml up -d      # SonarQube en :9002
bash scripts/sonar/scan.sh                              # sonar-scanner sobre el monorepo
```

---

## 1. Línea base medida

| Métrica | Valor | Lectura |
|---|---:|---|
| Líneas de código (NCLOC) | 80 668 | 301 ficheros, 5 103 funciones |
| Issues totales | 938 | 730 smells · 155 bugs · 53 vulnerabilidades |
| Rating de fiabilidad | **E** | el peor de la escala |
| Rating de seguridad | **E** | el peor de la escala |
| Rating de mantenibilidad | A | *engañoso* — ver §1.1 |
| Complejidad cognitiva total | 9 190 | 63 funciones sobre el umbral de 15 |
| Densidad de duplicación | 4,0 % | 218 bloques duplicados |
| Densidad de comentarios | 2,0 % | |
| Deuda técnica (SQALE) | 5 863 min | ≈ 98 h |

### 1.1 Por qué el rating A de mantenibilidad miente

SonarQube calcula la mantenibilidad como *ratio de deuda* = deuda estimada / coste de reescribir.
Con 80 kLOC el denominador es enorme, así que 98 h de deuda dan un 0,2 % → «A».

Ese número esconde que **una sola función tiene complejidad cognitiva 218** (el umbral es 15).
El rating A no significa que el código sea mantenible; significa que es *grande*.
Las métricas que sí importan aquí son la complejidad cognitiva y la concentración de issues.

### 1.2 El lint actual no ve nada de esto

`pnpm run lint` en el frontend pasa **limpio**, con 0 errores, mientras Sonar reporta
más de 400 issues en `frontend/src`. La puerta de calidad existente no cubre complejidad,
duplicación, accesibilidad ni seguridad. Es la causa raíz de que la deuda se haya acumulado
sin señal (refactoring.guru, *Technical debt* → «ausencia de monitoreo de cumplimiento»).

---

## 2. Hallazgos verificados

Los 155 «bugs» de Sonar son **146 de accesibilidad** (`InputWithoutLabelCheck`) más
**9 defectos**. Leí los 9 en el código; sobreviven 4.

### 2.1 Defectos reales

| # | Fichero | Qué pasa |
|---|---|---|
| B1 | `frontend/src/modules/admin/components/modals/AdminDraftArtifactModal.vue:1153,1156` | La clave `anchors` aparece **dos veces** en el mismo literal, con un spread en medio. Investigado: `anchors` se **escribe en 9 sitios y no se lee en ninguno**, nunca se persiste (no está en el esquema SQL) y `buildWorkflowsYaml` no lo emite — su comentario dice literalmente *«Sin anclas: cada paso lleva su SLOT de token»*. No es pérdida de datos: es **Speculative Generality**. El campo real es `anchor_refs`, que vive en cada paso. |
| B2 | `frontend/src/modules/firmas/components/MultiSignerPanel.vue:830` | `pageValue: cond ? selection.page : selection.page` — las dos ramas son idénticas. `pageValue` solo se lee cuando `pageReference === "start"`, y siempre vale `selection.page`: el ternario es redundante, sin cambio de comportamiento. |
| B3 | `frontend/src/modules/perfil/components/AgregarReferencia.vue:194` | Regex vulnerable a *backtracking* exponencial (ReDoS), por cuantificadores anidados `\w+([.-]?\w+)*`. |
| B4 | `signer/sigmaker/index.js:49` | `new Promise(async (resolve, reject) => …)` — si el `async` rechaza fuera del `try`, la promesa nunca se resuelve ni se rechaza. |
| B5 | `backend/config/postgres.js` (dialecto) | **No lo encontró Sonar, sino la cobertura nueva.** Dos residuos de MariaDB sin traducir: `FROM DUAL` rompía el **bootstrap del sistema**, y `FIELD()` devolvía 400 en `processes/graph`, `processes/:id/detail` y `units/:id/processes`. Ver [`auditoria-tests-unitarios.md`](./auditoria-tests-unitarios.md). |

### 2.2 Falsos positivos (marcar en Sonar, no «arreglar»)

| Regla | Dónde | Por qué no es un bug |
|---|---|---|
| `S2189` (BLOCKER) | `backend/workers/storage_uploader.js:140` | `for(;;)` es el bucle de sondeo de un worker daemon. Es intencional. |
| `S6418` (BLOCKER ×4) | `TOKEN_CHARS`, `PERSON_TOKEN_CHARS` | Son alfabetos de generación de tokens (`"ABC…xyz0123"`), no secretos. |
| `S7727` | `ChatNotificationService.js:54` | `rows.map(store.mapNotification)` — `mapNotification` es una arrow de un solo parámetro; los argumentos extra de `.map` son inocuos. |
| `S2871` (CRITICAL ×3) | `tests/characterization/lib/{normalize,snapshot}.mjs` | Son `Object.keys(...).sort()` para ordenar claves de snapshot de forma **determinista**. Sonar propone `localeCompare`, que es *dependiente del locale*: seguir su consejo haría los golden-master irreproducibles entre máquinas y los reescribiría. Consejo activamente malo aquí. |

Los 5 BLOCKER del proyecto son, los 5, falsos positivos. El rating **E de fiabilidad**
lo dispara `S2189`; marcarlo lo sube a **C** (no a A: el techo lo ponen los 146 avisos
de accesibilidad, que Sonar clasifica como *bugs* MAJOR — ver Fase 5).

### 2.3 Seguridad — lo que sí hay que mirar

- **`S5693` — un solo hueco real.** Sonar marca 7 puntos, pero **6 de los 7 `multer(...)` ya declaran `limits.fileSize`** (la regla solo pide revisarlos). El único sin límite alguno es `sql_admin_router.js:57`: `multer({ storage: multer.memoryStorage() })`, que acepta hasta 4 ficheros por petición **directos a RAM**. Ese sí es un vector de agotamiento de memoria.
- `S2245` (×9): `Math.random()` para IDs de campo de firma, códigos de email (`utils/email/generateCode.js`) y nombres de adjuntos de chat. Para el **código de verificación de email** esto sí importa: debe ser `crypto.randomInt`. El generador de tokens de producción (`utils/tokenGenerator.js`) ya usa `crypto.randomBytes`; solo el seed de dev usa `Math.random()`, y ahí es irrelevante.
- `S2612` (`utils/templateArchive.js:138`): permisos de fichero permisivos.
- `S5443` (×2): uso de directorios temporales públicamente escribibles en `signer/`.
- `S2068` (×14): contraseñas embebidas — casi todas en seeds y tests (`Demo1234!`), aceptable; revisar `genericCatalog.js:283`.
- `docker:S6470` (`signer/Dockerfile:26`): el fichero está **huérfano**. El build real usa `docker/signer/Dockerfile` (referenciado por los tres compose y por el workflow de CI); `signer/Dockerfile` no lo referencia nadie y está desfasado (`python:3.12` frente a `3.14`). Es código muerto: borrarlo elimina esta vulnerabilidad crítica.

---

## 3. Los tres *God Objects*

Concentración de la deuda, medida por complejidad cognitiva acumulada:

| Fichero | Líneas | CC acum. | Issues |
|---|---:|---:|---:|
| `backend/services/admin/SqlAdminService.js` | 6 851 | **1 688** | 120 |
| `frontend/src/modules/home/views/HomeView.vue` | 7 709 | 731 | 34 |
| `backend/controllers/users/user_controler.js` | 4 132 | 494 | 24 |

Tres ficheros — el 3 % del código — concentran el 32 % de la complejidad cognitiva.

### 3.1 `SqlAdminService.js` — *Large Class* + *Divergent Change*

Una sola clase con **al menos ocho responsabilidades** sin relación entre sí:

1. Cliente y helpers de MinIO (`getMinioClient`, `uploadDirectoryToMinio`, `removeMinioPrefix`…)
2. Empaquetado LaTeX/plantillas (`unzipToDirectory`, `sanitizeLatexSource`, `hashDirectory`)
3. Construcción de YAML/JSON-schema (`buildWorkflowsYaml`, `buildSchemaJsonFromFields`)
4. CRUD genérico sobre tablas (`list`, `create`, `update`, `getByKeys`, `pickPayload`)
5. Dominio de definiciones de proceso y series
6. Grafo de unidades y puestos (`getUnitGraph`, `addUnitPosition`, `wouldCreateUnitCycle`)
7. Grafo de procesos (`getProcessGraph`, `wouldCreateProcessCycle`)
8. Normalización/validación de flujos de firma
9. Política de contraseñas (`validatePasswordPolicy`)

Es el smell **Divergent Change** en estado puro: añadir un tipo de plantilla obliga a tocar
la misma clase que gestiona el organigrama.

### 3.2 `backend/index.js` — 467 líneas duplicadas

De sus 1 327 líneas, la mayor parte es una definición **OpenAPI inline** en la que los
bloques CRUD del dossier (`titulos`, `capacitaciones`, `experiencias`, `certificaciones`,
`referencias`, `investigaciones`) están **copiados literalmente**: cinco bloques idénticos
de 48 líneas, cuatro más de 45.

Es el caso de libro de **Parameterize Method**: una función
`buildDossierSectionPaths(section, schemaRef)` genera los seis.

### 3.3 `HomeView.vue` — 7 709 líneas

2 686 de plantilla, 4 935 de `<script setup>`, con **460 funciones y 210 refs** en un solo
componente. *Large Class* aplicado a Vue.

---

## 4. Duplicación

| Caso | Detalle |
|---|---|
| **`PdfDropField.vue` duplicado** | Existe en `shared/components/forms/` (166 L) y en `modules/firmas/components/` (246 L, superconjunto con drag & drop). Seis componentes importan una versión y seis la otra. `CLAUDE.md` designa `PdfDropField` como componente base aprobado — hay dos. |
| `backend/config/sqlTables.js` | 534 líneas duplicadas en 27 grupos: definiciones de columnas de auditoría repetidas tabla a tabla. |
| `backend/index.js` | 467 líneas (§3.2). |
| `AgregarCapacitacion` / `AgregarExperiencia` | 66 líneas duplicadas cada uno — el formulario del dossier repetido por sección. |

---

## 5. Complejidad cognitiva — las funciones que hay que partir

63 funciones superan el umbral de 15. Las peores:

| CC | Función | Fichero |
|---:|---|---|
| **218** | `update(tableName, keys, data)` | `SqlAdminService.js:3575` |
| **163** | `create(tableName, data)` | `SqlAdminService.js:3069` |
| **158** | `saveTemplateArtifactDraft(...)` | `SqlAdminService.js:6225` |
| **99** | `validateTableRules(tableName, candidate)` | `SqlAdminService.js:1296` |
| **75** | `createGeneralTask(req, res)` | `user_controler.js:3771` |
| **67** | `submitForm(...)` | `useAdminSubmitFlow.js:30` |
| **59** | `bindParams(sql, params)` | `config/postgres.js:111` |
| **54** | `checkResolverRefs(...)` | `SqlAdminService.js:942` |
| 49 | traducción de dialecto | `config/postgres.js:47` |
| 44 | adaptadores de presentación | `useAdminPresentationAdapters.js:94` |

`validateTableRules` es un `switch (tableName)` gigante → **Replace Conditional with Polymorphism**
(un mapa de estrategias de validación por tabla).

---

## 6. Plan de refactorización

Ordenado por relación valor/riesgo. Cada fase deja el sistema funcionando
(refactoring.guru, *How to*: «una serie de cambios pequeños, cada uno dejando el programa en
estado de funcionamiento»).

### Fase 0 — Red de seguridad (precondición, no negociable)

Sin tests que pasen no hay refactor, sólo cambios con esperanza.

- El harness de *characterization tests* (`backend/tests/characterization/`) existe y es
  el activo más valioso del repo para esto: golden-master HTTP de caja negra, diseñado
  para sobrevivir precisamente al refactor de los internals.
- **Estado actual: 33/40 pasan.** Los 7 fallos son todos de `chat.test.mjs` y todos por
  dependencia de estado previo en la BD (el hilo ya existe, la conversación ya está leída,
  el «404 antes de crear» ya no da 404). No son regresiones: el harness no es idempotente.
- Acciones:
  1. Hacer idempotente `chat.test.mjs` (o resetear la BD antes de la suite) → 40/40 verde.
  2. Congelar la firma de la línea base.
  3. Añadir SonarQube y `pnpm lint` al pipeline (`cd-multienv.yml`) como puerta de calidad.

### Fase 1 — Reparación (esto no es refactorizar; es arreglar)

Refactorizar y arreglar bugs no se mezclan en el mismo commit.

- B1 `anchors` vestigial (9 sitios) en frontend y backend.
- B2 ternario idéntico en `MultiSignerPanel.vue`.
- B3 ReDoS en `AgregarReferencia.vue`.
- B4 `async` en el ejecutor de Promise en `signer/sigmaker`.
- `limits` en `draftArtifactUpload` (`sql_admin_router.js`), el único `multer` sin tope.
- `crypto.randomInt` en `utils/email/generateCode.js`.
- Marcar en Sonar los falsos positivos (5 BLOCKER + 3 `S2871`) → fiabilidad E → C.

### Fase 2 — *Dispensables* (barrido barato, alto retorno)

- **Duplicate Code**: unificar `PdfDropField` en `shared/components/forms/` (quedarse con
  el superconjunto de `firmas/`), repuntar 6 imports, borrar la copia.
- **Dead Code**: 22 imports sin usar (`S1128`).
- 69 × `node:` protocol (`S7772`), 31 × `Object.hasOwn` (`S6653`) — mecánicos.
- 10 × `catch` que se traga la excepción (`S2486`).

### Fase 3 — *Bloaters*: partir los God Objects

Por orden de riesgo creciente:

1. ~~**`backend/index.js`**~~ — **HECHO**. Definición OpenAPI extraída a
   `config/swagger/definition.js`; los paths del dossier colapsados en
   `config/swagger/dossierPaths.js` (tabla data-driven + helpers). `index.js`: 1 327 →
   **234 líneas**. Auto-verificado: `/deasy/docs.json` idéntico byte a byte antes/después.

2. **`SqlAdminService.js`** → funciones puras ya extraídas a módulos hermanos
   (`.versioning`, `.validation`, `.workflows`, `.artifacts`, `.primitives`): 6 851 →
   **5 925 líneas**, y con ello 100 tests unitarios nuevos. Lo que queda dentro son los
   **métodos de clase que tocan el pool** — la siguiente capa sería *Extract Class* de
   servicios con estado (MinIO, grafos, borradores de plantilla), un refactor mayor que
   requiere mover también acceso a datos, no solo funciones puras.

3. **`user_controler.js`** → *Extract Class* hacia servicios; el controlador no debe tener
   86 funciones (`CLAUDE.md`: la lógica de negocio vive en services/models).

4. **`HomeView.vue`** → *Extract Component*, guiado por las 210 refs.

### Fase 4 — *Simplifying Conditional Expressions*

Sobre las funciones de §5, una a una, con los tests de la Fase 0 como red:

- `validateTableRules` (CC 99): **Replace Conditional with Polymorphism** — el `switch (tableName)`
  se convierte en un mapa `tableName → validador`.
- `update` (218) / `create` (163): **Replace Nested Conditional with Guard Clauses** +
  **Extract Method** por etapa (validar → normalizar → construir SQL → ejecutar → auditar).
- `createGeneralTask` (75) y `submitForm` (67): **Decompose Conditional**.
- 53 × ternario anidado (`S3358`): **Extract Variable**.

### Fase 5 — Accesibilidad y pulido

- 146 inputs sin `<label>` asociado + 149 `Web:S6853`. Es una única corrección sistemática
  sobre los componentes de formulario compartidos (`SInput`, `SSelect`, `SDate`, `SToggle`),
  no 295 correcciones.
- 12 `TODO` sin ticket.

---

## 7. Resultado de las Fases 0–2 (ejecutadas)

Rama `refactor/auditoria-sonar`.

| Métrica | Antes | Después |
|---|---:|---:|
| Issues totales | 938 | **803** |
| Code smells | 730 | **608** |
| Bugs | 155 | **148** |
| Vulnerabilidades | 53 | **47** |
| Violaciones BLOCKER | 5 | **0** |
| Rating de fiabilidad | E | **C** |
| Rating de seguridad | E | **D** |
| Deuda técnica | 5 863 min | **5 356 min** (−8,5 h) |
| Duplicación | 4,0 % | **3,8 %** |
| NCLOC | 80 668 | 80 506 |

**Verificación** (no solo compilación):

- *Characterization tests*: **40/40** antes y después, sobre BD reseteada y resembrada.
- `pnpm run lint`: limpio. `pnpm run build`: correcto.
- `generateStampImage` ejercitada dentro del contenedor del signer: genera un PNG de 19 915 B,
  y el camino de error **rechaza** en lugar de colgarse (que era el defecto original).
- Backend, worker y signer arrancan limpios; recorrido de UI (login → admin → plantillas)
  sin errores ni avisos de consola.

**Cambio visual introducido a propósito**: al unificar `PdfDropField`, los seis formularios
del dossier (`perfil/Agregar*.vue`) pasan a mostrar el estado *filled* (borde y texto
esmeralda) al seleccionar un fichero, como ya hacía el módulo de firmas, y ganan soporte
para soltar carpetas. Además se corrige un `@drop` sin `preventDefault` que dejaba al
navegador abrir el fichero soltado.

**`signer/Dockerfile` eliminado**: era huérfano (§2.3) — el build real usa
`docker/signer/Dockerfile`. Con ello desaparece la vulnerabilidad `docker:S6470`.

---

## 8. Qué NO hacer

- **No reescribir `SqlAdminService` desde cero.** refactoring.guru es explícito: la reescritura
  sólo se justifica con tests previos y un bloque de tiempo reservado, y el fracaso típico
  viene de «mezclar muchos refactors en un gran cambio».
- **No perseguir el rating A de mantenibilidad de Sonar.** Ya es A, y no significa nada
  (§1.1). La métrica útil aquí es la complejidad cognitiva por función y la duplicación.
- **No tocar los 146 inputs uno a uno.** Arreglar los 4 componentes base compartidos.
- **No arreglar los 5 BLOCKER ni los 3 `S2871`.** Son falsos positivos; márcalos. Seguir
  el consejo de Sonar en `S2871` rompería los golden-master.
- **No aplicar las reglas de Sonar en masa sin leer el código.** De los 9 «bugs» reales
  que reportó, 4 resultaron falsos positivos al verificarlos; y de los 7 `multer` marcados,
  6 ya estaban correctos.
