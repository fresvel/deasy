> ⚠️ **ARCHIVADO — no es fuente de verdad.**
> Este documento describe el sistema tal como era antes de la reorganizacion de `docs/`.
> Puede citar MariaDB, MongoDB, EMQX/MQTT o rutas que ya no existen. Se conserva por su
> valor historico. Para el estado actual, ver el `README.md` de la raiz.

# Auditoría de cobertura de tests unitarios — backend


> ⚠️ **ARCHIVADO (2026-08-06).** Sustituido por el hallazgo H2 de
> **[`docs/plan-calidad-2026-08.md`](../../plan-calidad-2026-08.md)**: Sonar nunca tuvo informe de
> cobertura enchufado, así que la cobertura real está sin medir.
> Motivo del archivo: [`README.md`](./README.md).

Complemento de [`auditoria-refactor-2026-07.md`](./auditoria-refactor-2026-07.md).
Mientras aquella mide *complejidad*, esta mide *qué de esa complejidad está sin red*.

```bash
bash scripts/docker-env.sh dev exec backend npm run test:unit    # tests unitarios
bash scripts/docker-env.sh dev exec backend npm run test:char:run # golden-master HTTP
```

**Estado**: 138 tests unitarios en backend (desde 9) + 18 en frontend (Vitest, nuevo). Los **tres P0 de fallo silencioso están
cubiertos**. `SqlAdminService.js` bajó de 6 851 a 5 925 líneas al extraer las funciones
puras a módulos hermanos, que es lo que las hizo testeables. Quedan P1/P2.

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
| `services/admin/SqlAdminService.validation.test.js` | 18 | Extraer `SqlAdminService.validation.js` |
| `services/admin/SqlAdminService.versioning.test.js` | 8 | Extraer `SqlAdminService.versioning.js` |
| `services/admin/SqlAdminService.workflows.test.js` | 17 | Extraer `SqlAdminService.workflows.js` + `.primitives.js` |
| `services/admin/SqlAdminService.artifacts.test.js` | 17 | Extraer `SqlAdminService.artifacts.js` |
| `config/postgres.dialect.test.js` (applyOnConflict incluido) | 35 | Exportar `applyOnConflict` |
| `services/system/genericCatalog.test.js` (previo) | 3 | — |
| `services/admin/SqlAdminService.processDefinitionSeries.test.js` (previo) | 6 | — |

**Trampa documentada** en `validateTableRules`: las ramas `documents` y
`document_versions` no solo validan, **mutan `candidate.status` in-place** para
normalizar los estados legacy. Un refactor que pierda ese efecto guardaría el valor
sin normalizar sin que ningún error lo delate.

**Trampa documentada**: `assertDocumentStatusValue` **no puede lanzar nunca**.
`normalizeDocumentStatus` ya convierte cualquier basura en `"Inicial"`, que es un
estado válido, así que el `throw` es inalcanzable. Hoy no es explotable — el único
llamador con `allowDirect: true` es `transitionDocumentVersionState`, que pasa un
estado ya derivado — pero un futuro llamador que pase entrada sin validar degradaría
el documento a `"Inicial"` sin error.

## 4. Pendiente, por prioridad

### P0 — todos cubiertos ✓

Los tres P0 de fallo silencioso están cerrados:
- `rewriteOnDuplicate` → parte pura `applyOnConflict` extraída y testeada (§3).
- `validateTableRules` → `SqlAdminService.validation.js` (§3).
- `collectAuthoredWorkflowIssues` y la familia de flujos de firma →
  `SqlAdminService.workflows.js` (§3).

### P1

- `normalizeValue` + `pickPayload` — coerción antes de escribir. Aún en `SqlAdminService.js`; irían a un futuro `SqlAdminService.validation.js` ampliado.
- ~~`RbacService.hasAnyRole/hasPermission/can`~~ — hecho (`RbacService.test.js`, 11 casos).
- ~~`frontend/src/core/utils/accessControl.js`~~ — hecho. Se montó Vitest en el frontend
  (`pnpm run test:unit`, environment node) y se escribieron 18 tests que fijan el espejo
  del `RbacService`. Ambos lados testeados + comentarios cruzados.
- ~~`validatePasswordPolicy`~~ — hecho: unificada en `utils/passwordPolicy.js` (9 tests + 3 de caracterización HTTP).

### Divergencias resueltas

- **`parseAvailableFormats`** existía TRIPLICADA — ahora en un solo sitio
  (`SqlAdminService.artifacts.js`). Las dos copias idénticas se deduplicaron directo; la
  tercera (`sql_admin_controller.js`) divergía (más laxa), pero se caracterizó que la
  diferencia solo aparece con arrays/números y `available_formats` es siempre un objeto
  jsonb, así que unificar fue un no-op sobre datos reales (verificado en vivo + golden del
  endpoint schema).
- **`validatePasswordPolicy`** ↔ `val_password.js` — unificada la lógica; cada llamador
  conserva su mensaje. `special` sigue siendo informativo (no cuenta).
- **`accessControl.js`** ↔ `RbacService` — marcadas como espejo con comentarios cruzados;
  backend testeado.

### P2

`summarizeFillRequests`/`firstPendingStepOrder`/`arePreviousStepsApproved`
(`DocumentProgressService.js`), mappers de `chatStore.js` (ya exportados),
`parseJsonObject`, `normalizeNumericId`, `buildSchemaJsonFromFields`,
`resolveTableResource`/`actionForHttpMethod` (`rbacPolicy.js`, ya exportados).

Ya cubiertos al extraer sus módulos: `parseArtifactSyncMarker`, `sanitizeLatexSource`,
`findPreferredPdfObject`, `parseAvailableFormats`, `parseYamlDocument` (artifacts §3);
`normalizeBooleanFlag` (primitives, vía workflows).

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

- ~~`SqlAdminService.workflows.js`~~ — hecho (+ `SqlAdminService.primitives.js` para los helpers compartidos).
- `SqlAdminService.validation.js` — `validateTableRules`, `normalizeValue`, `pickPayload`, `validateFieldTypes`, `ensureDateOrder`, `validatePasswordPolicy`.
- ~~`SqlAdminService.artifacts.js`~~ — hecho.
- ~~`SqlAdminService.versioning.js`~~ — hecho.
- ~~`validateTableRules`, `ensureDateOrder`, `parseJsonObject`~~ — hechos en `SqlAdminService.validation.js`; faltan `normalizeValue`, `pickPayload`, `validateFieldTypes`, `validatePasswordPolicy`.

Esa extracción **es** el primer paso de la Fase 3 del plan de refactorización: parte
el God Object por sus costuras naturales y, de paso, hace testeable lo que hoy no lo es.

### Bug encontrado de paso

`utils/files.js:4` — `deleteFile` llama `fs.unlinkSync(path, (err) => {…})`.
`unlinkSync` **no acepta callback**: el segundo argumento se ignora, el callback nunca
se ejecuta y los errores se lanzan de forma síncrona. El manejo de error es código
muerto.
