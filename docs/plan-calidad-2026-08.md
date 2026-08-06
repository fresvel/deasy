# Plan de calidad y reducción de complejidad — agosto 2026

> **Documento maestro único.** Sustituye y absorbe la serie de auditorías de julio. Los documentos
> previos quedan archivados en `docs/docs-md-antiguos/refactor-2026-07/` (ver §7); lo que seguía vivo
> en ellos está recogido aquí, revalidado contra el código y contra Sonar.
>
> **Medición:** SonarQube en `:9002`, análisis del **2026-08-06 14:00 UTC**, cruzado con lectura
> directa del código y con un análisis propio de complejidad por función.
> Rama `develop`, HEAD `75fe53d`.
>
> **Cambios posteriores a la medición** (`e93cec4`, `7d39355`, `b357559`, `b86be28`). No invalidan
> el plan —ninguno toca los ficheros de §3— pero sí estas cifras y referencias:
>
> | Cambio | Efecto en este documento |
> |---|---|
> | Fotos de perfil a MinIO; fuera `express.static("/uploads")` | `user_controler.js` pierde `updateUserPhoto` (§3.1: **2 195 L** hoy). La lectura de ficheros deja de tener ruta pública |
> | `storage_uploader.js` borrado (worker muerto, nadie publicaba en su cola) | **El falso positivo `S2189` ya no existe**: §2.1, §4.1 y la Fase A-3 quedan sin objeto |
> | Entorno `qa-local` eliminado | Los comandos `docker-env.sh qa-local` de cualquier doc ya no valen |
> | Staging de borradores a `os.tmpdir()` | `templateLifecycle.js` a **1 530 L**; `saveTemplateArtifactDraft` sigue intacta (§3.2 vigente) |

---

## 1. Estado y configuración de Sonar (verificado)

### 1.1 Lo que hay

| Pieza | Ruta | Estado |
|---|---|---|
| Stack | `scripts/sonar/compose.yml` | SonarQube **community** + PostgreSQL 16, proyecto compose `deasy-sonar`, puerto **9002→9000** |
| Lanzador | `scripts/sonar/scan.sh` | `sonar-scanner-cli` dockerizado, corre dentro de la red `deasy-sonar_default`, exige `SONAR_TOKEN` |
| Config | `sonar-project.properties` | `projectKey=deasy`, `sources=backend,frontend/src,signer,scripts` |

**Ahora mismo está levantado**: `deasy-sonar-sonarqube-1` y `deasy-sonar-sonar-db-1` en marcha, la API
responde 200. Hay tres análisis registrados: `2026-07-17`, `2026-08-06 05:14` y `2026-08-06 14:00`.

**Corrección al handoff anterior sobre el acceso.** `SIGUIENTE-SESION-saveTemplateArtifactDraft.md`
afirma que «`admin:admin` NO funciona por basic auth: SonarQube 26 lo retiró de la API». **Hoy sí
funciona** — toda la medición de este documento se hizo con `-u admin:admin` contra
`/api/measures/*`, `/api/issues/search` y `/api/qualitygates/*`. El procedimiento de token por sesión
que documenta ese handoff sigue siendo válido, pero no es necesario para leer métricas.

```bash
docker compose -f scripts/sonar/compose.yml up -d                    # :9002
curl -s -u admin:admin "http://localhost:9002/api/measures/component?component=deasy&metricKeys=ncloc,cognitive_complexity,code_smells"
SONAR_TOKEN=<token> bash scripts/sonar/scan.sh                       # ~1,5 min
```

### 1.2 Cuatro huecos de configuración

Estos son defectos de la instalación, no del código. Cuestan poco y hasta que no se arreglen, las
métricas de Sonar mienten en dos frentes.

**H1 — `sonar.tests=` está VACÍO.** Las 115 pruebas de caracterización y los 15 ficheros de test
unitario se analizan **como código de producción**. Dos consecuencias medidas: las contraseñas de
fixture de `backend/tests/characterization/config.mjs` aparecen como **4 vulnerabilidades S2068 de
producción**, y ninguna métrica distingue código de prueba de código real.

**H2 — no hay informe de cobertura enchufado.** `coverage = 0.0 %` pese a que existen 209 tests
unitarios y 115 de caracterización. Sonar no miente: nunca se le ha dado un `lcov`.

**H3 — el Quality Gate está en ERROR y es inalcanzable por construcción.** Gate `Sonar way` (el
default). Estado actual:

| Condición | Umbral | Real | |
|---|---|---|---|
| `new_coverage` | ≥ 80 % | **0.0** | ❌ falla por H2, no por el código |
| `new_duplicated_lines_density` | ≤ 3 % | 1.96 | ✅ |
| `new_violations` | 0 | **172** | ❌ |

Mientras H2 no se arregle, el gate falla siempre por cobertura y deja de ser señal.

**H4 — Sonar no corre en CI.** `.github/workflows/cd-multienv.yml` es el único workflow y no lo
invoca. El análisis es manual y depende de que alguien se acuerde.

---

## 2. Línea base validada (2026-08-06)

**Ojo con `resolved=false` al consultar la API.** Por defecto `/api/issues/search` devuelve también
las incidencias cerradas y las marcadas *won't fix*, y eso infla los conteos (una lectura sin filtrar
da 6 BLOCKER y 58 vulnerabilidades donde en realidad hay 0 y 46). Todas las cifras de abajo son
**abiertas**.

| Métrica | Valor |
|---|---:|
| NCLOC / ficheros | 80 315 / 386 |
| **Complejidad cognitiva** | **8 781** |
| Complejidad ciclomática | 16 092 |
| Incidencias abiertas | **836** |
| — code smells | 647 |
| — bugs | 143 |
| — vulnerabilidades | 46 |
| Severidad | 0 BLOCKER · 76 CRITICAL · 536 MAJOR · 200 MINOR · 24 INFO |
| Deuda técnica (SQALE) | 4 943 min (≈ 82 h) |
| Duplicación | 3,2 % (195 bloques) |
| Fiabilidad / Seguridad / Mantenibilidad | **C / D / A** |
| Funciones sobre el umbral de complejidad cognitiva (15) | **71 abiertas** (+23 ya cerradas) |

### 2.1 El hallazgo nuevo: la nota C de fiabilidad es accesibilidad de formularios

**289 de las 836 incidencias abiertas (35 %) son dos reglas de etiquetado de formularios:**

| Nº | Regla | Qué dice |
|---:|---|---|
| 148 | `Web:S6853` | Un `<label>` debe tener texto y un control asociado |
| 141 | `Web:InputWithoutLabelCheck` | `input`/`select`/`textarea` deben estar etiquetados |

Y aquí está lo que importa: Sonar clasifica `InputWithoutLabelCheck` como **BUG**. Con 143 bugs
totales, **141 son esta regla**. Es decir, **la nota C de fiabilidad del proyecto no la causa ni un
solo defecto de lógica** — la causan etiquetas de formulario ausentes. Los bugs de lógica reales son
**dos**: `javascript:S3923` y `javascript:S1534`. (La medición incluía además el `S2189` del worker
de storage, marcado como falso positivo; ese fichero se borró en `7d39355`, así que desaparece solo.)

Esto conecta con una deuda que ya estaba anotada de pasada en el handoff del frontend («varios
`Agregar*.vue` montan `SSelect`/`SInput` sin pasar `label`/`placeholder`»). Se subestimó: no son
warnings de consola, son el 35 % del backlog de calidad y la nota entera de fiabilidad.

### 2.2 Resto del backlog por regla

| Nº | Regla | Naturaleza |
|---:|---|---|
| 63 | `javascript:S3776` | Complejidad cognitiva — **el núcleo de este plan** (§3) |
| 51 | `javascript:S3358` | Ternarios anidados |
| 43 | `javascript:S1128` | Imports sin usar — barrido mecánico |
| 33 | `css:S7924` | Contraste texto/fondo insuficiente |
| 31 | `javascript:S8786` | Regex con backtracking no lineal |
| 25 | `javascript:S7781` | `replaceAll()` en vez de `replace()` con regex global |
| 23 | `javascript:S1135` | `TODO` en el código |
| 17 | `javascript:S7780` | `String.raw` para backslashes escapados |
| 14 | `javascript:S2068` | Contraseñas hardcodeadas — **4 son de fixtures de test** (ver H1) |

### 2.3 Duplicación concentrada

| Líneas dup. | % | Fichero |
|---:|---:|---|
| 534 | 52,9 % | `backend/config/sqlTables.js` — **son datos, es duplicación legítima. No tocar.** |
| 288 | 12,9 % | `backend/controllers/users/user_controler.js` |
| 95 | 18,1 % | `backend/scripts/apply_rbac_patch.mjs` |
| 75 | 27,5 % | `backend/services/whatsapp/WhatsAppBot.js` |
| 66 | ~23 % | `AgregarCapacitacion.vue` / `AgregarExperiencia.vue` |

---

## 3. Ranking de complejidad — la lista de trabajo real

### 3.1 Por fichero (complejidad cognitiva de Sonar)

| Cogn. | Ciclom. | NCLOC | Fichero | Veredicto |
|---:|---:|---:|---|---|
| **356** | 300 | 1 190 | `signer/app.py` | **God nunca auditado.** El peor del repo |
| 352 | 961 | 4 838 | `frontend/.../home/views/HomeView.vue` | God conocido, refactor a medias |
| 345 | 536 | 1 992 | `backend/controllers/users/user_controler.js` | **God #2** — partido, no simplificado |
| 300 | 295 | 1 271 | `backend/services/admin/templates/templateLifecycle.js` | Contiene la peor función del backend |
| 290 | 606 | 3 964 | `frontend/.../tables/AdminTableManager.vue` | **Motor legítimo**, no God |
| 262 | 476 | 2 724 | `frontend/.../firmas/FirmarPdf.vue` | **God real** (6 responsabilidades) |
| **241** | 168 | 391 | `backend/config/postgres.js` | **Densidad extrema**: 241 cogn. en 391 ncloc |
| 204 | 335 | 1 172 | `backend/services/documents/DocumentSignatureWorkflowService.js` | God moderado |
| 192 | 273 | 894 | `backend/services/admin/crud/tableHooks.js` | Creado por el refactor, ya hotspot |
| 169 | 251 | 505 | `backend/services/admin/templates/workflows.js` | Ídem |
| 153 | 273 | 1 288 | `frontend/.../admin/views/AdminView.vue` | God por duplicación |
| 144 | 253 | 853 | `backend/controllers/sign/sign_controller.js` | **Viola CLAUDE.md** (motor batch en controller) |

### 3.2 Por función (`S3776` abiertas, las 14 peores)

Esta es la cola de trabajo. Umbral de Sonar: 15.

| Cogn. | Función / ubicación |
|---:|---|
| **158** | `templates/templateLifecycle.js:966` → `saveTemplateArtifactDraft` |
| 75 | `controllers/users/user_controler.js:1868` → `createGeneralTask` |
| 67 | `frontend/.../composables/forms/useAdminSubmitFlow.js:30` |
| 59 / 49 | `backend/config/postgres.js:111` y `:47` — reescrituras de dialecto SQL |
| 44 | `frontend/.../ui/useAdminPresentationAdapters.js:94` |
| 44 | `frontend/.../firmas/FirmarPdf.vue:2482` → `confirmSign` |
| 40 | `signer/app.py:519` |
| 39 | `frontend/.../processes/useAdminDraftArtifactFlow.js:85` |
| 36 | `backend/services/admin/SqlAdminService.js:261` → `list()` |
| 33 | `backend/services/admin/generation/assignees.js:11` |
| 33 | `backend/services/system/genericCatalog.js:376` |
| 32 | `backend/scripts/seed_pucese.mjs:367` |
| 31 | `frontend/.../data/useAdminTableDataSource.js:222` |

`saveTemplateArtifactDraft` sigue teniendo **más del doble** de complejidad que la siguiente.

### 3.3 Lo que el ranking de LOC dice y Sonar no

Un análisis propio por función (contando ramas y anidamiento) señala tres cosas que la métrica de
Sonar por fichero no destaca:

- **Composables-monolito.** `useDeliverableView()` y `useProcessDefinitionManager()` son **un solo
  closure de 901 líneas cada uno**. Sonar les da complejidad cognitiva moderada (140) porque está bien
  repartida, pero no hay unidades internas extraíbles ni testeables por separado.
- **Bloques `<template>` gigantes.** `HomeView.vue` = template 2 117 L + script 3 028 L.
  `AdminTableManager.vue` = template 1 030 L + script 3 178 L. Sonar no separa los bloques del SFC.
- **`user_controler.js` concentra dos funciones de 374 y 362 líneas** (`getUserMenu`,
  `createGeneralTask`) — el 33 % del fichero en dos funciones.

---

## 4. Qué de la documentación previa sigue siendo cierto

Revalidé las afirmaciones operativas de los seis documentos de julio contra el código actual.

### 4.1 Confirmado — se conserva

| Afirmación | Origen | Verificación |
|---|---|---|
| `useDeliverableView` **no** es Middle Man: 0 asignaciones `.value =` | god-objects §6 | ✅ `grep -c` → **0** |
| `useProcessPanels.js` sí muta refs ajenos: 155 L, 28 asignaciones | fase5-y-X | ✅ **155 L, 28** exactas |
| Dos `@layer components` en conflicto en `tailwind.css` | fase5-y-X | ✅ líneas **46** y **1300** |
| `.deasy-card` y `.deasy-btn--primary` redefinidos | fase5-y-X | ✅ `.deasy-card` en **329** y **1349**; `.deasy-btn--primary` en **570** y **1381** |
| `AdminDataTable` es fork vivo, 11 consumidores | fase5-y-X | ✅ **11** |
| God #1 cerrado: `SqlAdminService.js` 5 924 → 897 L | god-objects §3.1 | ✅ **897 L**; su `S3776` de CC 158 y el de CC 99 constan **CLOSED/FIXED** en Sonar |
| Cut #10: `validateTableRules` bajo umbral | god-objects §3.1 cut #10 | ✅ CLOSED/FIXED |
| `saveTemplateArtifactDraft` sigue sin partir | god-objects §3.1.c | ✅ CC **158**, la peor del backend |
| Fase 1 de la red de `saveTemplateArtifactDraft` hecha | god-objects §3.1.c | ✅ `zzz_artifact_draft.test.mjs` existe (11,9 K), **115 casos char** en 13 flows |
| `S2189` del worker es falso positivo | auditoria-refactor §2.2 | ✅ era cierto (`for(;;)` = bucle del daemon), pero **ya no aplica**: el worker era código muerto y se borró en `7d39355` |
| Marcas *won't fix* no sobreviven a mover código | god-objects §1 | ✅ mecanismo confirmado: los 6 BLOCKER y 12 vulns "extra" que aparecen sin filtrar son exactamente las marcadas |

### 4.2 Desactualizado — corregido en este documento

| Afirmación obsoleta | Realidad hoy |
|---|---|
| «Fase 3.5 (admin → subrutas) **sin ejecutar**» — god-objects §4 y §5 | **Hecha a medias.** La ruta ya es `/admin/:section?/:item?/:table?` y `useAdminTableReset.js` fue borrado, pero `AdminView.vue` conserva `selectedTable`/`selectedSection` como refs locales y solo usa `route.params` en 3 sitios. Es una ruta con params, no un layout con `children` |
| «`admin:admin` no funciona por basic auth» — handoff saveTemplate | **Funciona hoy** (§1.1) |
| «FASE 1 es el entregable de esta sesión» — handoff saveTemplate | **Fase 1 cerrada.** Lo pendiente es la **fase 2**, el corte |
| `AdminModalShell`: 21 consumidores — fase5-y-X | **24** (ha crecido) |
| `backend/index.js`, 467 L duplicadas — auditoria-refactor §3.2 | **Resuelto**: 233 L |
| `HomeView.vue`, 7 709 L — auditoria-refactor §3.3 | **5 233 L** |
| Ruta `frontend/src/views/admin/components/AdminTableManager.vue` — admin-table-manager-refactor | **No existe** desde la reorganización a `modules/` |

### 4.3 Referencias rotas encontradas

- `SIGUIENTE-SESION-fase5-y-X.md:8` remite a `SIGUIENTE-SESION-complejidad-backend.md`, **borrado** en
  el commit `47f9784`.
- `docs/auditoria-god-objects-2026-07.md` termina con `</content>` y `</invoke>` — **basura XML de una
  escritura fallida**, no contenido.

---

## 5. Plan por fases

Ordenado por retorno sobre esfuerzo, no por gravedad. Las fases A y B son baratas y desbloquean la
medición; el resto ya no se puede medir bien sin ellas.

### Fase A — Arreglar el instrumento (antes de tocar código)

Sin esto, cualquier mejora posterior es inmedible.

1. **Declarar los tests** en `sonar-project.properties`:
   ```properties
   sonar.tests=backend/tests,frontend/src
   sonar.test.inclusions=**/*.test.js,**/*.test.mjs,**/*.spec.js,backend/tests/**
   ```
   Efecto esperado: las 4 vulnerabilidades S2068 de `config.mjs` dejan de contar como producción.
2. **Enchufar cobertura** (H2). Backend: `node --test --experimental-test-coverage` con reporter
   `lcov` → `sonar.javascript.lcov.reportPaths`. Frontend: `vitest --coverage`. Es el prerrequisito
   del Quality Gate.
3. **Re-marcar los falsos positivos** que perdieron su marca al moverse el código: los 4-5 `S6418` de
   alfabetos de tokens. **No arreglarlos** — no son secretos. (El `S2189` del worker ya no hace falta:
   el fichero se borró.)
4. **Cambiar la contraseña de admin de Sonar**, que sigue en `admin/admin` y así lleva desde julio.
5. *(Opcional)* Sonar en CI sobre `develop` (H4).

**Criterio de cierre:** cobertura reportada > 0 y las condiciones del gate reflejan el código y no la
falta de instrumentación.

### Fase B — Etiquetado de formularios (35 % del backlog, y la nota C)

289 incidencias, 141 de ellas clasificadas como BUG. El origen está concentrado: los componentes
compartidos `SInput`/`SSelect`/`SDate` y los `Agregar*.vue` que los montan sin `label`.

Empezar por los componentes compartidos: si `SInput`/`SSelect` generan el `<label for>` correcto y
avisan cuando falta la prop, se corrige en origen la mayor parte de las apariciones en lugar de
parchear 289 sitios. Medir tras el primer arreglo antes de seguir — el reparto real entre
"componente compartido" y "uso suelto" hay que confirmarlo con el conteo por fichero.

**Retorno esperado:** fiabilidad **C → A**, backlog −35 %, y accesibilidad real, que es el punto.

### Fase C — `saveTemplateArtifactDraft`, fase 2 (el corte)

La peor función del backend (CC 158, el doble que la siguiente). **La red ya existe** — esto es lo que
cambia respecto a todos los intentos anteriores: `zzz_artifact_draft.test.mjs` fija 13 casos, char
está en 115 casos / 13 flows, y el harness ya habla multipart.

Anatomía en 8 fases secuenciales documentada en el handoff (validación → resolución de propietario →
identidad y rutas → materialización de semilla → escritura de ficheros → parseo → validación de flujo
→ escritura). Son los candidatos naturales a *Extract Method*, y las fases 1-3 son puras.

**Aviso que hay que retener:** esto **no es un registro**. El cut #10 bajó CC 99 → 0 porque
*Replace Conditional with Registry* convierte condicional en datos; aquí hay una secuencia, no un
despacho por clave. Lo que sí baja de verdad es el anidamiento (buena parte de esos 158 son `if` a dos
y tres niveles dentro del `try` gigante). Esperar una caída **proporcionalmente menor** que en el cut
#10 y no engañarse con la analogía.

### Fase D — Controllers que violan CLAUDE.md

Lógica de negocio que vive en la capa de controller. `DocumentWorkflowResetService.js` (258 L, una
responsabilidad) es el estilo objetivo.

| Origen | Qué | Destino |
|---|---|---|
| `user_controler.js:1868` | `createGeneralTask` — 362 L, **CC 75** | `GeneralTaskService` |
| `user_controler.js:201` | `getUserMenu` — 374 L, jerarquía org + RBAC | `UserMenuService` |
| `sign_controller.js` | Motor de batch-jobs (persistencia + bucle `setImmediate`) | `BatchSigningService` |
| `sign_controller.js` | Plan de almacenamiento + firma de PDF | `PdfSigningService` |
| `sign_workflow_controller.js` | Máquina de estados de `fill_requests` | `FillRequestWorkflowService` |

Ataca a la vez el God #2 (`user_controler.js`, cogn. 345) y su 12,9 % de duplicación.

### Fase E — Frontend: las tres piezas pendientes del plan de julio

Lo que sobrevive de `plan-refactor-frontend.md` tras revalidarlo:

1. **Fase 5 (alcance reducido)** — `useProcessPanels.js` pasa a poseer su estado (155 L, 28
   asignaciones a refs ajenos). Imitar `useDeliverableFilePreview` / `useDocumentCenter` /
   `useDossierSection`. **`useDeliverableView` NO entra**: está medido que es proyección read-only.
2. **Fase X — sistema de diseño (BLOQUEANTE).** No migrar los ~1 269 hardcodes de color antes de:
   fusionar los dos `@layer components` (líneas 46 y 1300 de `tailwind.css`), colapsar los tokens
   duplicados `--deasy-*` / `--brand-*`, y borrar los forks `AdminModalShell` (24 consumidores) y
   `AdminDataTable` (11). Migrar antes = recodificar el conflicto en 1 269 sitios.
   > Antes de adoptar tokens de TailAdmin, leer las tres colisiones activas documentadas en el skill
   > `tailadmin-ui` (`rounded-lg` = 16px por escala invertida, ausencia de `@theme`, `dark:` se
   > autoactivaría).
3. **Terminar la fase 3.5** — `AdminView` conserva `selectedTable`/`selectedSection` como estado local
   junto a los `route.params`. Mientras conviva el doble origen de verdad, la duplicación ×5 de
   `AdminView` (CC 153) no colapsa.

### Fase F — Los dos nunca auditados

- **`signer/app.py`** (cogn. **356**, el peor del repo, anidamiento máx. 14). Microservicio Python de
  firma. Nunca ha tenido un pase. Su peor función está en `:519` (CC 40) — lo que significa que la
  complejidad está **repartida por todo el fichero**, no concentrada: es un problema de estructura, no
  de una función mala.
- **`backend/config/postgres.js`** (cogn. **241 en 391 ncloc** — la densidad más alta del repo). Dos
  funciones en `:47` y `:111` (CC 49 y 59) que reescriben dialecto SQL. Candidato a tabla de
  traducción declarativa.

### Fase G — Barridos mecánicos

Baratos, sin riesgo, en cualquier momento entre fases: 43 imports sin usar (`S1128`), 51 ternarios
anidados (`S3358`), 25 `replace()` → `replaceAll()` (`S7781`), 23 `TODO` (triar: convertir en issue o
borrar). Los 31 `S8786` (backtracking no lineal) **no** son mecánicos — hay que mirarlos uno a uno,
incluyen el ReDoS de `AgregarReferencia.vue`.

---

## 6. Reglas de trabajo (destiladas de diez cuts)

No son consejos genéricos: cada una viene de un fallo real registrado en las auditorías de julio.

1. **Extraer POR SCRIPT, no a mano**, y verificar `count == 1` antes de borrar cada bloque. Si el
   script trocea, darle un **invariante de reconstrucción** (las piezas deben reproducir el original
   línea a línea): en el cut #10 eso cazó un troceador que contaba llaves pero no paréntesis y partía
   un `if` multilínea por la mitad.
2. **`node --check` valida SINTAXIS, no imports — y comprobar que arranca tampoco basta.** Un símbolo
   movido sin su `import` es sintaxis válida, el módulo **carga**, y revienta en tiempo de LLAMADA.
   Así estuvieron rotos tres semanas cuatro `ReferenceError` de los cuts #2/#3/#6. Por eso existe
   `npm run check:imports`: **ejecutarlo siempre tras mover código**.
3. **char verde ANTES y DESPUÉS, con goldens IDÉNTICOS.** Si un golden cambia durante un refactor
   puro, o rompiste algo o el test estaba mal. En un *fix* sí cambian — y entonces el diff del golden
   **es** la prueba del arreglo.
4. **Round-trips autolimpiantes**, para que los conteos `list_*` no se muevan.
5. **Preservar el ORDEN de los guards**: los contratos de error caracterizados lo fijan.
6. **La red unitaria ve lo que char no puede.** En el cut #10 dos validaciones de fecha se quedaron
   mudas y char pasó igual, porque ninguna ruta caracterizada manda vigencias invertidas.
7. **No injertar casos especiales en el camino genérico** — es el olor de `AdminTableManager`.
8. **Revisar las marcas de Sonar después de cada refactor**: no sobreviven a que el código cambie de
   fichero (§4.1).
9. **Refactor = mover código, NO reescribir comportamiento.**
10. **Verificar en el navegador**, no solo con lint y tests.

### Comandos (todo dentro de los contenedores)

```bash
bash scripts/docker-env.sh dev exec -T backend npm run check:imports      # tras mover código
bash scripts/docker-env.sh dev exec -T backend npm run test:char:run      # 115 casos, 13 flows
bash scripts/docker-env.sh dev exec -T backend npm run test:char:capture  # actualiza el golden
bash scripts/docker-env.sh dev exec -T backend npm run test:unit          # 209
bash scripts/docker-env.sh dev exec -T frontend pnpm run lint

bash scripts/docker-env.sh dev restart backend
bash scripts/docker-env.sh dev logs --tail 15 backend | grep -E "Servidor iniciado|SyntaxError|does not provide"
```

`test:char:run` **RESETEA la base de dev** (reset + bootstrap + seed). Es lo normal para char.

---

## 7. Lo que NO hay que tocar

- **`backend/config/sqlTables.js`** (1 009 L, 52,9 % duplicado) y su gemelo del frontend: son
  **datos**, no código. La duplicación es la forma correcta.
- **`AdminTableManager.vue`** (3 964 ncloc): motor de metadatos legítimo. El peso son ~2 injertos
  concentrados (`process_definition_versions`, `template_artifacts`), a extraer como paneles propios.
  Sin polimorfismo.
- **`useDeliverableView.js`**: proyección read-only, medido. Convertirlo en dueño de su estado
  **invertiría** el acoplamiento.
- **El núcleo CRUD de `SqlAdminService`** (~460 L): es el buen diseño que sostiene el registro de hooks.
- **Los falsos positivos de §4.1** (`S6418` de alfabetos de tokens): marcar en Sonar, no "arreglar".
  `S2871` en particular rompería los golden-master.
- **`UnitGraphView` / `ProcessGraphView`**: 17 % de similitud, dominio irreducible. Solo extraer
  fontanería y arreglar el selector global de `ProcessGraphView.vue:1098`, que apunta a
  `.unit-graph-canvas` ajeno.

---

## 8. Mapa documental

**Este documento es la entrada única.** Lo demás:

| Documento | Rol |
|---|---|
| `docs/auditoria-god-objects-2026-07.md` | **Vivo — bitácora histórica.** El detalle de los 10 cuts, los 3 defectos de producción y la red de caracterización. Aquí está el *qué hacer*; allí, el *cómo se hizo* |
| `docs/plan-refactor-frontend.md` | **Vivo — referencia del frontend.** Su plan por fases se recoge en §5-E; el diagnóstico detallado sigue valiendo |
| `docs/linea-base-homeview-2026-07.md` | **Vivo — contrato observable** de HomeView antes de partirlo. Es la red de regresión |
| `docs/fotos-perfil-minio.md` | **Vivo — diseño.** Dónde y cómo se guardan las fotos de perfil, y por qué salieron del disco local |
| `SIGUIENTE-SESION-fase5-y-X.md` | Handoff activo del frontend (§5-E) |
| `SIGUIENTE-SESION-saveTemplateArtifactDraft.md` | Handoff activo del backend (§5-C), **con su fase 1 ya cerrada** |
| `docs/docs-md-antiguos/refactor-2026-07/` | **Archivados** (§7 del README de esa carpeta): la auditoría base de julio, el plan de `user_controler` con sus M1-M4 hechos, la auditoría de tests unitarios y el plan de `AdminTableManager` de marzo |

---

## 9. Cómo reproducir esta medición

```bash
docker compose -f scripts/sonar/compose.yml up -d
S='curl -s -u admin:admin http://localhost:9002'

# línea base (§2)
$S/api/measures/component?component=deasy'&'metricKeys=ncloc,cognitive_complexity,complexity,code_smells,coverage,duplicated_lines_density,sqale_index

# incidencias abiertas — OJO con resolved=false (§2)
$S/api/issues/search?componentKeys=deasy'&'resolved=false'&'facets=rules,severities,types'&'ps=1

# ranking por fichero (§3.1)
$S/api/measures/component_tree?component=deasy'&'metricKeys=cognitive_complexity,complexity,ncloc'&'qualifiers=FIL'&'s=metric'&'metricSort=cognitive_complexity'&'asc=false'&'ps=25

# cola de funciones (§3.2)
$S/api/issues/search?componentKeys=deasy'&'rules=javascript:S3776,python:S3776'&'resolved=false'&'ps=100

# estado del quality gate (§1.2 H3)
$S/api/qualitygates/project_status?projectKey=deasy
```
