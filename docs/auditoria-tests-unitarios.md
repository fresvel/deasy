# Auditoría de cobertura de tests unitarios — backend

Complemento de [`auditoria-refactor-2026-07.md`](./auditoria-refactor-2026-07.md).
Mientras aquella mide *complejidad*, esta mide *qué de esa complejidad está sin red*.

```bash
bash scripts/docker-env.sh dev exec backend npm run test:unit    # tests unitarios
bash scripts/docker-env.sh dev exec backend npm run test:char:run # golden-master HTTP
```

## 1. El hallazgo transversal: casi nada es testeable

Los dos ficheros más complejos del backend **no exportan** sus funciones puras:

- **`config/postgres.js`**: de toda la capa de traducción de dialecto solo
  `translatePlaceholders` estaba exportada. `bindParams`, `rewriteDialect`,
  `translateDialect`, `rewriteGroupConcat`, `rewriteIf`, `rewriteDateParts` y
  `rewriteOnDuplicate` eran privadas al módulo.
- **`services/admin/SqlAdminService.js`** (6 851 líneas): su **único** `export` es
  `export default class SqlAdminService`. Las ~28 funciones puras del módulo son
  todas `const` privadas. Ninguna se puede testear sin refactor.

No es casualidad que sea justo ahí donde se han colado los bugs.

## 2. Lo que la falta de tests ya costó

Tres residuos de la migración desde MariaDB vivían en la capa de dialecto. Ninguno
tenía test. Los tres se descubrieron **al escribir esta cobertura**, no antes:

| Residuo | Qué rompía | Estado |
|---|---|---|
| `FROM DUAL` | El **bootstrap del sistema** (`relation "dual" does not exist`) | Corregido (`e32e5cb`) |
| `FIELD()` | `processes/graph`, `processes/:id/detail`, `units/:id/processes` | Corregido (`fbcbfe0`) |
| — | Ambos ahora fijados como regresión en `postgres.dialect.test.js` | |

Un tercer defecto salió del propio test: `rewriteGroupConcat`, `rewriteField` y
`rewriteIf` **exigen código ya enmascarado**. Llamarlos con SQL crudo que contenga
literales con espacios o comas da resultados incorrectos en silencio. No es un bug de
producción (el único punto de entrada es `translateDialect`, que enmascara), pero es
una trampa sin documentar.

## 3. Implementado

| Fichero | Casos | Refactor necesario |
|---|---:|---|
| `config/postgres.dialect.test.js` | 28 | Exportar 7 funciones |
| `services/documents/DocumentStateService.test.js` | 14 | Ninguno |
| `services/system/genericCatalog.test.js` (previo) | 3 | — |
| `services/admin/SqlAdminService.processDefinitionSeries.test.js` (previo) | 6 | — |

**Trampa documentada**: `assertDocumentStatusValue` **no puede lanzar nunca**.
`normalizeDocumentStatus` ya convierte cualquier basura en `"Inicial"`, que es un
estado válido, así que el `throw` es inalcanzable. Hoy no es explotable — el único
llamador con `allowDirect: true` es `transitionDocumentVersionState`, que pasa un
estado ya derivado — pero un futuro llamador que pase entrada sin validar degradaría
el documento a `"Inicial"` sin error.

## 4. Pendiente, por prioridad

### P0 — fallo silencioso = corrupción de datos o de permisos

| Función | Ubicación | Export | Por qué |
|---|---|---|---|
| `rewriteOnDuplicate` | `config/postgres.js:343` | privada | `ON DUPLICATE KEY UPDATE` → `ON CONFLICT (target)`. Infiere el índice consultando `pg_index`. Si elige mal el target, el UPSERT **inserta duplicados o pisa la fila equivocada**. Ya recibe `executor` por parámetro → inyectable; falta exportar y poder resetear `uniqueColsCache`/`generatedColsCache`. |
| `validateTableRules` | `SqlAdminService.js:1296` | privada | Complejidad cognitiva **99**. Última barrera antes del INSERT/UPDATE de ~24 tablas. Muta `candidate.status` in-place. Ojo: su rama de `unit_relations` es **inalcanzable** desde `create()`, que tiene un guard propio antes. |
| `collectAuthoredWorkflowIssues` (+`checkResolverRefs`, CC 54) | `SqlAdminService.js:880` | privada | Valida el contrato de los flujos de firma. Es pura (recibe todo por parámetro). Distingue `errors` de `warnings` — lógica de dominio delicada. **Mejor relación coste/valor de todo el fichero.** |

### P1

- `bumpSemanticVersion` (`:44`) — versionado de plantillas.
- `normalizeFillSteps` (`:693`) / `normalizeSignatureSteps` (`:747`) — este último
  **descarta en silencio** firmantes sin cargo resoluble y pasos sin firmantes válidos.
- `buildWorkflowsYaml` (`:146`) + `buildStepResolver` (`:113`) — round-trip con `normalizeFillSteps`.
- `normalizeValue` (`:1183`) + `pickPayload` (`:1223`) — coerción antes de escribir.
- `parseArtifactSyncMarker` (`:845`) — detección de drift; `templateCode` puede contener `:`.
- `RbacService.hasAnyRole/hasPermission/can` (`:161-176`) — **sin refactor**: los tres métodos no tocan `this.pool`.
- `frontend/src/core/utils/accessControl.js` — **sin refactor**. Es el espejo del `RbacService`; Sonar marca 53 líneas duplicadas. Conviene un test que compare ambas lógicas para que no deriven.
- `validatePasswordPolicy` (`:1485`) — **duplicada** con `middlewares/val_password.js:14-30`, con mensajes distintos y un criterio (`special`) que el middleware calcula pero no cuenta. Unificar en `utils/passwordPolicy.js`.

### P2

`sanitizeLatexSource` (anti-inyección LaTeX; sube a P1 si se prioriza seguridad),
`summarizeFillRequests`/`firstPendingStepOrder`/`arePreviousStepsApproved`
(`DocumentProgressService.js`), mappers de `chatStore.js` (ya exportados),
`parseJsonObject`/`parseAvailableFormats`, `findPreferredPdfObject`,
`normalizeBooleanFlag`/`normalizeNumericId`, `buildSchemaJsonFromFields`,
`resolveTableResource`/`actionForHttpMethod` (`rbacPolicy.js`, ya exportados).

## 5. Lo que NO merece test unitario

- **`translatePlaceholders`**: es un subconjunto de `bindParams`, que es lo que se usa
  siempre en producción. Testear `bindParams` ya lo cubre.
- **`runQuery`, `wrapConnection`, `ensureUniqueCols`, `ensureGeneratedCols`**: I/O puro
  contra `pg`. Se cubren mejor con los characterization tests.
- **`slugify`, `humanizeSlug`, `formatTokenForSigner`, `sid`/`num`**: one-liners.
- **`generateUniqueToken`, `generateVerificationCode`**: aleatoriedad + BD; a lo sumo
  verificar rango y alfabeto.
- **Todo método `async` que reciba `connection`**: integración, no unitario.

## 6. Refactors mínimos para desbloquear el resto

`SqlAdminService.js` no necesita partirse entero para ganar cobertura. El patrón ya
existe en el repo (`processDefinitionSeries.js`): extraer las funciones puras a
módulos hermanos con named exports.

- `SqlAdminService.workflows.js` — `buildStepResolver`, `buildWorkflowsYaml`, `normalizeFillSteps`, `normalizeSignatureSteps`, `collectAuthoredWorkflowIssues`, `resolveStepCargoId` + constantes.
- `SqlAdminService.validation.js` — `validateTableRules`, `normalizeValue`, `pickPayload`, `validateFieldTypes`, `ensureDateOrder`, `validatePasswordPolicy`.
- `SqlAdminService.artifacts.js` — `parseArtifactSyncMarker`, `parseAvailableFormats`, `findPreferredPdfObject`, `sanitizeLatexSource`, `parseYamlDocument`.
- `SqlAdminService.versioning.js` — `bumpSemanticVersion`, `normalizeItemMode`.

Esa extracción **es** el primer paso de la Fase 3 del plan de refactorización: parte
el God Object por sus costuras naturales y, de paso, hace testeable lo que hoy no lo es.

### Bug encontrado de paso

`utils/files.js:4` — `deleteFile` llama `fs.unlinkSync(path, (err) => {…})`.
`unlinkSync` **no acepta callback**: el segundo argumento se ignora, el callback nunca
se ejecuta y los errores se lanzan de forma síncrona. El manejo de error es código
muerto.
