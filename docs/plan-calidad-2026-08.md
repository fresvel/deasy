# Plan de calidad y reducción de complejidad — agosto 2026

> **Documento maestro único.** Sustituye y absorbe la serie de auditorías de julio. Los documentos
> previos quedan archivados en `docs/docs-md-antiguos/refactor-2026-07/` (ver §7); lo que seguía vivo
> en ellos está recogido aquí, revalidado contra el código y contra Sonar.
>
> **Medición:** SonarQube en `:9002`, análisis del **2026-08-06 19:22 UTC**, cruzado con lectura
> directa del código y con un análisis propio de complejidad por función.
> Rama `develop`, HEAD `514b67e` (SCM revision confirmada por el escáner).
>
> ### Estado al 2026-08-08
>
> | Fase | Estado |
> |---|---|
> | **A** instrumento | ✅ |
> | **B** etiquetado de formularios | ✅ — fiabilidad **C → A**, cero bugs |
> | **G** barridos mecánicos | ✅ |
> | **C** `saveTemplateArtifactDraft` | 🟡 CC 164 → **76** |
> | **D** controllers → servicios | 🟡 las dos grandes hechas; faltan las tres de firma |
> | **E** frontend | 🟡 puntos 1 y 3 hechos + fase X desbloqueada; faltan los forks y los colores |
> | **F** signer | 🟡 auditado, con red de 229 pruebas y 3 riesgos cerrados; falta el corte de identidad |
> | **F** `postgres.js` | ⬜ sin empezar |
>
> **Seguridad:** era **D** y sigue en D por 38 incidencias sin triar, pero se cerró la que sí era
> explotable: el broker de RabbitMQ estaba publicado en todas las interfaces en dev, qa **y prod**,
> con `guest` administrador y la protección de loopback desactivada, y la contraseña del PKCS#12 del
> firmante viaja en el cuerpo del mensaje. Ver el commit `b4a4231`.
>
> **Cobertura:** 0 % → **14 %**. El plan para seguir es `docs/plan-cobertura-2026-08.md`.
>
> **Este re-escaneo absorbe los cambios que la versión anterior del documento tenía pendientes**
> (`e93cec4`, `7d39355`, `b357559`, `b86be28`, `514b67e`): ya no hay delta que arrastrar, todas las
> cifras de §2 y §3 son post-reorg. Lo que la medición dejó demostrado sobre aquellas previsiones:
>
> | Previsión de la versión anterior | Veredicto medido |
> |---|---|
> | `S2189` del worker desaparece al borrar `storage_uploader.js` | ✅ **Cierto.** El fichero no existe y la marca ya no figura entre las vivas |
> | La marca `S6418 WONTFIX` de `tableHooks.js` **se pierde** con el reempaquetado; vulns 46 → 47 y seguridad **D → E** | ❌ **Falso.** La marca **sobrevivió** al rename (`crud/tableHooks.js:111`, RESOLVED/WONTFIX). Vulnerabilidades **46 → 45**, seguridad **sigue en D**. Ver §5-A.3 |
> | Los 12 ficheros renombrados entran como nuevos y `new_violations` «se dispara»; la medición no sería comparable | ❌ **Falso.** `new_violations` 172 → **176** (+4). El blame de git sigue el rename, así que el código movido no cuenta como nuevo. **La medición sí es comparable**; no hace falta bumpear `projectVersion`. Ver §5-A.4 |
> | El staging a `os.tmpdir()` deja `saveTemplateArtifactDraft` intacta | ⚠️ **Casi.** Sigue siendo la peor función, pero su CC **subió de 158 a 164** (§3.2) |
>
> Entorno `qa-local` eliminado: los comandos `docker-env.sh qa-local` de cualquier doc ya no valen.
>
> **Ocho artefactos de `backend/scripts/` se eliminaron DESPUÉS de esta medición** (`fc44559`, ver
> `docs/plan-limpieza-scripts-2026-08.md` §4.7). Las cifras de §2, §3 y §4.4 son **anteriores al
> borrado** y se conservan intactas para que sigan siendo comparables con el próximo escaneo; los
> ítems anotados como **cerrado por eliminación** ✅ **no son trabajo pendiente** — el próximo
> escaneo los descontará solo. Efecto agregado esperado: **−1 `S3776`**, **−1 marca `S6418`
> WONTFIX**, **−2 `S2068` de producción** y **−95 líneas duplicadas**.

---

## 1. Estado y configuración de Sonar (verificado)

### 1.1 Lo que hay

| Pieza | Ruta | Estado |
|---|---|---|
| Stack | `scripts/sonar/compose.yml` | SonarQube **community** + PostgreSQL 16, proyecto compose `deasy-sonar`, puerto **9002→9000** |
| Lanzador | `scripts/sonar/scan.sh` | `sonar-scanner-cli` dockerizado, corre dentro de la red `deasy-sonar_default`, exige `SONAR_TOKEN` |
| Config | `sonar-project.properties` | `projectKey=deasy`, `sources=backend,frontend/src,signer,scripts` |

**Ahora mismo está levantado**: `deasy-sonar-sonarqube-1` y `deasy-sonar-sonar-db-1` en marcha (SonarQube
**26.7.0**), la API responde 200. Hay **seis** análisis registrados: `2026-07-09 14:17`, `2026-07-09 17:14`,
`2026-07-17`, `2026-08-06 05:14`, `2026-08-06 14:00` y `2026-08-06 19:22` (el de este documento). Los dos
de julio-09 importan porque el New Code period (`PREVIOUS_VERSION`) está anclado al **primero de ellos**
—`projectVersion` lleva clavado en `1.0` desde entonces—, así que «código nuevo» significa hoy
*todo lo tocado desde el 2026-07-09*.

**Acceso a la API: usa un TOKEN, no usuario/contraseña.** Mientras `admin` conservó la contraseña
por defecto, el basic auth `-u admin:admin` funcionaba y con él se hizo la primera medición de este
documento. **Al cambiar la contraseña dejó de funcionar del todo**: hoy `-u admin:<lo-que-sea>`
devuelve **401** contra `/api/measures/*`, y `/api/authentication/validate` responde
`{"valid":false}` incluso con la credencial correcta. Los **tokens sí** funcionan, por `Bearer` o
como usuario del basic auth:

```bash
curl -H "Authorization: Bearer $SONAR_TOKEN" "http://localhost:9002/api/measures/component?component=deasy&metricKeys=bugs"
curl -u "$SONAR_TOKEN:" "http://localhost:9002/api/..."      # equivalente
```

Genera uno nuevo desde *My Account → Security* en la UI. **Ojo:** `POST /api/user_tokens/generate`
también exige estar autenticado, así que si no conservas ningún token vivo hay que pasar por la
interfaz. La contraseña de admin **ya no es la de por defecto** — no está escrita en este repo.

```bash
docker compose -f scripts/sonar/compose.yml up -d                    # :9002
curl -s -H "Authorization: Bearer $SONAR_TOKEN" "http://localhost:9002/api/measures/component?component=deasy&metricKeys=ncloc,cognitive_complexity,code_smells"
SONAR_TOKEN=<token> bash scripts/sonar/scan.sh                       # ~1,5 min
```

### 1.2 Cuatro huecos de configuración — **H1, H2 y H3 CERRADOS el 2026-08-06**

Estos eran defectos de la instalación, no del código. **La Fase A los cerró**; se conserva el
diagnóstico porque explica de dónde salían las cifras viejas y qué hay que vigilar para que no
vuelvan. Lo que queda vivo es **H4** (Sonar no corre en CI) y la contraseña `admin/admin`.

| | Estado | Cómo se cerró |
|---|---|---|
| **H1** tests sin declarar | ✅ | `sonar.tests` + `sonar.test.inclusions`, con `sonar.exclusions` recortado para que los conjuntos sean disjuntos |
| **H2** sin cobertura | ✅ | `test:unit:coverage` en backend y frontend → `sonar.javascript.lcov.reportPaths` |
| **H3** gate inalcanzable | ✅ | Ya mide código: `new_coverage` **30,6 %** contra un umbral del 80 %, no `0.0` por falta de instrumentación |
| **H4** Sonar fuera de CI | ⬜ | Pendiente (opcional) |

**H1 — `sonar.tests=` está VACÍO.** Las 161 pruebas de caracterización y los 15 ficheros de test
unitario se analizan **como código de producción** — Sonar indexa hoy 391 ficheros, 22 de ellos bajo
`backend/tests`. Dos consecuencias medidas: las contraseñas de fixture de
`backend/tests/characterization/config.mjs` aparecen como **3 vulnerabilidades S2068 de producción**
(no 4, verificado por fichero), y ninguna métrica distingue código de prueba de código real.

> **Ojo al arreglarlo (§5-A.1):** los 15 ficheros de test unitario **no viven bajo `backend/tests`** —
> están junto a su módulo (`services/**/*.test.js`, `config/*.test.js`, …), como manda CLAUDE.md. Un
> `sonar.tests=backend/tests` los dejaría fuera. Y las otras **11** S2068 son producción real
> (6 en `SystemBootstrapView.vue`, el resto en `genericCatalog.js` y scripts de seed): declarar los
> tests no las toca. **Hoy son 9**: dos eran la constante `"Deasy1234!"` de
> `backend/scripts/apply_rbac_patch.mjs` y `backend/scripts/seed_demo_accounts.mjs`, ✅ **cerradas por
> eliminación** (`fc44559`).

**H2 — no hay informe de cobertura enchufado.** `coverage = 0.0 %` pese a que existen 218 tests
unitarios y 161 de caracterización. Sonar no miente: nunca se le ha dado un `lcov`.

**H3 — el Quality Gate está en ERROR y es inalcanzable por construcción.** Gate `Sonar way` (el
default). Estado actual:

| Condición | Umbral | Real | |
|---|---|---|---|
| `new_coverage` | ≥ 80 % | **0.0** | ❌ falla por H2, no por el código |
| `new_duplicated_lines_density` | ≤ 3 % | 1.80 | ✅ |
| `new_violations` | 0 | **176** | ❌ |

El New Code period es `PREVIOUS_VERSION` con fecha **2026-07-09 14:17**. Las 176 son, en su mayoría,
barrido mecánico de la Fase G: **43** `S1128` (imports sin usar), 21 `S3776`, 19 `S1135` (`TODO`),
17 `S3358`, 17 `S8786`.

Mientras H2 no se arregle, el gate falla siempre por cobertura y deja de ser señal.

**H4 — Sonar no corre en CI.** `.github/workflows/cd-multienv.yml` es el único workflow y no lo
invoca. El análisis es manual y depende de que alguien se acuerde.

---

## 2. Línea base validada (2026-08-06 19:22, HEAD `514b67e`)

**Ojo con `resolved=false` al consultar la API.** Por defecto `/api/issues/search` devuelve también
las incidencias cerradas y las marcadas *won't fix*, y eso infla los conteos (una lectura sin filtrar
da 6 BLOCKER y 58 vulnerabilidades donde en realidad hay 0 y 46). Todas las cifras de abajo son
**abiertas**.

| Métrica | Valor | Δ vs. 14:00 |
|---|---:|---:|
| NCLOC / ficheros | 80 448 / 391 | +133 / +5 |
| **Complejidad cognitiva** | **8 797** | +16 |
| Complejidad ciclomática | 16 104 | +12 |
| Incidencias abiertas | **832** | −4 |
| — code smells | 644 | −3 |
| — bugs | 143 | = |
| — vulnerabilidades | 45 | −1 |
| Severidad | 0 BLOCKER · 76 CRITICAL · 533 MAJOR · 197 MINOR · 26 INFO | |
| Deuda técnica (SQALE) | 4 902 min (≈ 82 h) | −41 min |
| Duplicación | 3,1 % (193 bloques) | −0,1 pt |
| Fiabilidad / Seguridad / Mantenibilidad | **C / D / A** | = |
| Funciones sobre el umbral de complejidad cognitiva (15) | **71 abiertas** (63 JS + 8 Python) | = |

**Lectura del delta: el reempaquetado no movió la aguja.** Ninguna métrica cambia más de un 0,2 %, y
las notas C/D/A son idénticas. Era lo esperado de un rename puro — y confirma que **la línea base del
plan sigue siendo válida**: no hay que rehacer §3 ni reordenar las fases.

Serie histórica completa (`/api/measures/search_history`), útil para no volver a discutir si algo mejoró:

| | 07-09 14:17 | 07-09 17:14 | 07-17 | 08-06 05:14 | 08-06 14:00 | **08-06 19:22** |
|---|---:|---:|---:|---:|---:|---:|
| NCLOC | 80 668 | 80 506 | 79 964 | 80 306 | 80 315 | **80 448** |
| Cognitiva | 9 190 | 9 181 | 9 022 | 8 840 | 8 781 | **8 797** |
| Incidencias | 938 | 806 | 812 | 839 | 836 | **832** |
| SQALE (min) | 5 863 | 5 356 | 5 350 | 5 042 | 4 943 | **4 902** |

En un mes: −393 de complejidad cognitiva (−4,3 %) y −961 min de deuda (−16 %). El grueso lo hizo el
corte de `SqlAdminService` (05:14). Los tres escaneos de agosto están planos entre sí.

> **⚠️ Discontinuidad de serie: el escaneo de las 20:18 no es comparable con los anteriores.** La
> Fase A sacó 49 ficheros de test del código de producción, así que los denominadores cambian de
> golpe **sin que se haya tocado una línea**. Cifras post-Fase A, que son las que valen de aquí en
> adelante:
>
> | | 19:22 (pre-A) | **20:18 (post-A)** | |
> |---|---:|---:|---|
> | Cobertura | 0,0 % | **11,5 %** | ← el objetivo de la fase |
> | Ficheros | 391 | **342** | −49 tests |
> | NCLOC | 80 448 | 79 899 | |
> | Cognitiva | 8 797 | 8 720 | los tests dejan de sumar |
> | Ciclomática | 16 104 | 15 964 | |
> | Incidencias abiertas | 832 | **822** | |
> | — vulnerabilidades | 45 | **42** | las 3 `S2068` de fixtures |
> | — code smells | 644 | 637 | |
> | Severidad | 76 CRIT · 533 MAJ · 197 MIN · 26 INFO | 76 CRIT · 527 MAJ · 197 MIN · 22 INFO | |
> | SQALE | 4 902 min | 4 872 min | |
> | Duplicación | 3,1 % | 3,4 % | **sube**: los tests diluían el porcentaje |
> | Notas | C / D / A | **C / D / A** | sin cambios |
>
> **El ranking de §3 sigue valiendo tal cual**: ninguno de los ficheros de esa lista es un test.

*(El +5 en ficheros y +133 en NCLOC no lo explica el diff `75fe53d..514b67e`, que en `sources` es
−2 ficheros netos. Es ruido de indexación de ±0,2 %; no afecta a ninguna conclusión, pero conviene no
citar «386 ficheros» ni «80 315» como cifras estables.)*

### 2.1 El hallazgo nuevo: la nota C de fiabilidad es accesibilidad de formularios

**289 de las 832 incidencias abiertas (35 %) son dos reglas de etiquetado de formularios:**

| Nº | Regla | Qué dice |
|---:|---|---|
| 148 | `Web:S6853` | Un `<label>` debe tener texto y un control asociado |
| 141 | `Web:InputWithoutLabelCheck` | `input`/`select`/`textarea` deben estar etiquetados |

Y aquí está lo que importa: Sonar clasifica `InputWithoutLabelCheck` como **BUG**. Con 143 bugs
totales, **141 son esta regla**. Es decir, **la nota C de fiabilidad del proyecto no la causa ni un
solo defecto de lógica** — la causan etiquetas de formulario ausentes. Los bugs de lógica reales son
**dos**: `javascript:S3923` y `javascript:S1534`. (El `S2189` del worker de storage ya no aparece: el
fichero se borró en `7d39355` y el re-escaneo lo confirma.)

Esto conecta con una deuda que ya estaba anotada de pasada en el handoff del frontend («varios
`Agregar*.vue` montan `SSelect`/`SInput` sin pasar `label`/`placeholder`»). Se subestimó: no son
warnings de consola, son el 35 % del backlog de calidad y la nota entera de fiabilidad.

**Y está muy concentrado** (conteo por fichero, medido — esto es lo que la versión anterior dejaba
pendiente de confirmar en la Fase B):

| Nº | Fichero | ¿`Agregar*.vue`? |
|---:|---|---|
| 68 | `perfil/components/AgregarInvestigacion.vue` | sí |
| 51 | `admin/components/modals/AdminDraftArtifactModal.vue` | **no** |
| 38 | `auth/views/SystemBootstrapView.vue` | **no** |
| 28 | `auth/views/RegisterView.vue` | **no** |
| 18 | `firmas/components/FirmarPdf.vue` | **no** |
| 11 | `admin/components/tables/AdminTableManager.vue` · 11 `AgregarReferencia.vue` | |

**5 ficheros concentran 203 de las 289 (70 %).** Solo uno es un `Agregar*.vue`: la hipótesis de que
esto se arregla sobre todo en `SInput`/`SSelect` **no se sostiene tal cual** (§5-B corregida).

### 2.2 Resto del backlog por regla

| Nº | Regla | Naturaleza |
|---:|---|---|
| 63 | `javascript:S3776` | Complejidad cognitiva — **el núcleo de este plan** (§3). +8 de `python:S3776` = 71 |
| 51 | `javascript:S3358` | Ternarios anidados |
| 43 | `javascript:S1128` | Imports sin usar — barrido mecánico |
| 33 | `css:S7924` | Contraste texto/fondo insuficiente |
| 29 | `javascript:S8786` | Regex con backtracking no lineal |
| 25 | `javascript:S1135` | `TODO` en el código |
| 24 | `javascript:S7781` | `replaceAll()` en vez de `replace()` con regex global |
| 17 | `javascript:S7780` | `String.raw` para backslashes escapados |
| 15 | `javascript:S7785` · 15 `javascript:S4624` | `await` de nivel superior · plantillas anidadas |
| 14 | `javascript:S2068` | Contraseñas hardcodeadas — **3 son de fixtures** (ver H1); **11 son producción** → **9 hoy**, 2 ✅ cerradas por eliminación de scripts (`fc44559`) |

### 2.3 Duplicación concentrada

| Líneas dup. | % | Fichero |
|---:|---:|---|
| 534 | 52,9 % | `backend/config/sqlTables.js` — **son datos, es duplicación legítima. No tocar.** |
| 288 | 13,1 % | `backend/controllers/users/user_controler.js` |
| ~~95~~ | ~~18,1 %~~ | ~~`backend/scripts/apply_rbac_patch.mjs`~~ — ✅ **cerrado por eliminación** (`fc44559`) |
| 75 | 27,5 % | `backend/services/whatsapp/WhatsAppBot.js` |
| 74 | 8,2 % | `backend/services/system/SystemBootstrapService.js` |
| 66 | 21,9 / 24,7 % | `AgregarCapacitacion.vue` / `AgregarExperiencia.vue` |
| 64 | 22,6 % | `backend/services/admin/generation/assignees.js` |

---

## 3. Ranking de complejidad — la lista de trabajo real

### 3.1 Por fichero (complejidad cognitiva de Sonar)

| Cogn. | Ciclom. | NCLOC | Fichero | Veredicto |
|---:|---:|---:|---|---|
| **356** | 300 | 1 190 | `signer/app.py` | **God nunca auditado.** El peor del repo |
| 350 | 956 | 4 829 | `frontend/.../home/views/HomeView.vue` | God conocido, refactor a medias |
| 337 | 526 | 1 963 | `backend/controllers/users/user_controler.js` | **God #2** — partido, no simplificado |
| 306 | 300 | 1 277 | `backend/services/admin/templates/templateLifecycle.js` | Contiene la peor función del backend. **Subió +6** |
| 290 | 606 | 3 964 | `frontend/.../tables/AdminTableManager.vue` | **Motor legítimo**, no God |
| 262 | 476 | 2 724 | `frontend/.../firmas/FirmarPdf.vue` | **God real** (6 responsabilidades) |
| **241** | 168 | 391 | `backend/config/postgres.js` | **Densidad extrema**: 241 cogn. en 391 ncloc |
| 204 | 335 | 1 172 | `backend/services/documents/DocumentSignatureWorkflowService.js` | God moderado |
| 192 | 273 | 894 | `backend/services/admin/crud/tableHooks.js` | Creado por el refactor, ya hotspot |
| 169 | 251 | 505 | `backend/services/admin/templates/workflows.js` | Ídem |
| 153 | 273 | 1 288 | `frontend/.../admin/views/AdminView.vue` | God por duplicación |
| **153** | 284 | 780 | `backend/services/admin/SqlAdminService.js` | ⚠️ **Faltaba en este ranking.** Ver aviso abajo |
| 144 | 253 | 853 | `backend/controllers/sign/sign_controller.js` | **Viola CLAUDE.md** (motor batch en controller) |
| 140 | 541 | 850 | `frontend/.../home/composables/useDeliverableView.js` | Composable-monolito (§3.3) |
| 140 | 225 | 896 | `frontend/.../processes/useProcessDefinitionManager.js` | Composable-monolito (§3.3) |
| 139 | 317 | 1 116 | `frontend/.../modals/AdminDraftArtifactModal.vue` | **Nuevo en el radar** — y 51 incidencias de etiquetado (§2.1) |
| 138 | 321 | 1 254 | `frontend/.../firmas/MultiSignerPanel.vue` | **Nuevo en el radar** |

> **Corrección: `SqlAdminService.js` no está tan cerrado como decía §4.1.** Es verdad que sus dos
> `S3776` (CC 158 y CC 99) constan CLOSED/FIXED y que pasó de 5 924 a 914 L. Pero el **fichero**
> sigue acumulando **153 de complejidad cognitiva en 780 ncloc**, por encima de `sign_controller.js`,
> y conserva una función abierta de CC 36 (`list()`, §3.2). «God #1 cerrado» significa *dejó de ser un
> God*, no *dejó de ser complejo*. No es urgente, pero tampoco es terreno ganado del todo.

### 3.2 Por función (`S3776` abiertas, las 14 peores)

Esta es la cola de trabajo. Umbral de Sonar: 15. **71 abiertas** (63 JS + 8 Python) — **hoy 70**: la
de `seed_pucese.mjs:367` se cerró por eliminación del fichero (`fc44559`), no por refactor. Cifras y
líneas del escaneo del 19:22, ya post-reempaquetado — no hay que aplicar ningún desplazamiento.

| Cogn. | Función / ubicación | Δ |
|---:|---|---:|
| **164** | `templates/templateLifecycle.js:967` → `saveTemplateArtifactDraft` (**563 L**) | **+6** |
| 75 | `controllers/users/user_controler.js:1834` → `createGeneralTask` (362 L) | = |
| 67 | `frontend/.../composables/forms/useAdminSubmitFlow.js:30` | = |
| 59 / 49 | `backend/config/postgres.js:111` (`bindParams`) y `:47` (`translatePlaceholders`) | = |
| 44 | `frontend/.../ui/useAdminPresentationAdapters.js:94` | = |
| 44 | `frontend/.../firmas/FirmarPdf.vue:2482` → `confirmSign` | = |
| 40 | `signer/app.py:519` | = |
| 39 | `frontend/.../processes/useAdminDraftArtifactFlow.js:85` | = |
| 36 | `backend/services/admin/SqlAdminService.js:278` → `list()` | = |
| 33 | `backend/services/system/genericCatalog.js:376` · 33 `admin/generation/assignees.js:11` | = |
| ~~32~~ | ~~`backend/scripts/seed_pucese.mjs:367`~~ — ✅ **cerrado por eliminación** (`fc44559`) | = |
| 31 | `frontend/.../data/useAdminTableDataSource.js:222` | = |
| 30 | `signer/app.py:968` · 30 `admin/generation/documents.js:210` | nuevas en la lista |
| 28 | `frontend/src/core/router/index.js:84` · 28 `admin/templates/workflows.js:441` | nuevas en la lista |

`saveTemplateArtifactDraft` sigue teniendo **más del doble** de complejidad que la siguiente — y ahora
**más**: el staging a `os.tmpdir()` (`b86be28`) le sumó 6 puntos y la dejó en **563 líneas**. La
cabecera del propio `templateLifecycle.js:14` todavía la describe como «un metodo de 542 lineas»:
comentario desfasado. **La Fase C se encarece un poco cada vez que se toca sin partirla.**

### 3.3 Lo que el ranking de LOC dice y Sonar no

Un análisis propio por función (contando ramas y anidamiento) señala tres cosas que la métrica de
Sonar por fichero no destaca:

- **Composables-monolito.** `useDeliverableView()` (**964 L**) y `useProcessDefinitionManager()`
  (**969 L**) son un solo closure cada uno. Sonar les da complejidad cognitiva moderada (140 ambos)
  porque está bien repartida, pero no hay unidades internas extraíbles ni testeables por separado.
  Ojo al contraste: `useDeliverableView` tiene **ciclomática 541** con cognitiva 140 — muchísimas
  ramas planas, ninguna anidada. Es exactamente el perfil de una proyección read-only (§7).
- **Bloques `<template>` gigantes.** `HomeView.vue` = template 2 117 L + script 3 113 L (total 5 233).
  `AdminTableManager.vue` = template 1 030 L + script 3 180 L (total 4 213). Sonar no separa los
  bloques del SFC.
- **`user_controler.js` concentra dos funciones de 374 y 362 líneas** (`getUserMenu` en `:167`,
  `createGeneralTask` en `:1834`) — el 33 % del fichero en dos funciones.

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
| God #1 cerrado: `SqlAdminService.js` 5 924 → 897 L | god-objects §3.1 | ⚠️ **Matizado.** Hoy **914 L**; sus `S3776` de CC 158 y CC 99 constan CLOSED/FIXED. Pero el fichero acumula **cogn. 153** y una función abierta de CC 36 → ver el aviso de §3.1 |
| Cut #10: `validateTableRules` bajo umbral | god-objects §3.1 cut #10 | ✅ CLOSED/FIXED |
| `saveTemplateArtifactDraft` sigue sin partir | god-objects §3.1.c | ✅ CC **164** (subió de 158), 563 L, la peor del backend |
| Fase 1 de la red de `saveTemplateArtifactDraft` hecha | god-objects §3.1.c | ✅ `zzz_artifact_draft.test.mjs` existe (11,9 K), **161 casos char** en 13 flows (eran 115 cuando se escribió el plan) |
| `S2189` del worker es falso positivo | auditoria-refactor §2.2 | ✅ era cierto (`for(;;)` = bucle del daemon), pero **ya no aplica**: el worker era código muerto y se borró en `7d39355`. El re-escaneo confirma que `backend/workers/` no existe |
| Marcas *won't fix* no sobreviven a mover código | god-objects §1 | ❌ **REFUTADO por medición.** Ver §4.4 |

### 4.2 Desactualizado — corregido en este documento

| Afirmación obsoleta | Realidad hoy |
|---|---|
| «Fase 3.5 (admin → subrutas) **sin ejecutar**» — god-objects §4 y §5 | **Hecha a medias.** La ruta ya es `/admin/:section?/:item?/:table?` y `useAdminTableReset.js` fue borrado, pero `AdminView.vue` conserva `selectedTable`/`selectedSection` como refs locales y solo usa `route.params` en 3 sitios. Es una ruta con params, no un layout con `children` |
| «`admin:admin` no funciona por basic auth» — handoff saveTemplate | **El handoff tenía razón, por el motivo equivocado.** Funcionó mientras la contraseña fue la de por defecto; al cambiarla, el basic auth con contraseña dejó de valer del todo. Hoy **todo va por token** (§1.1) |
| «FASE 1 es el entregable de esta sesión» — handoff saveTemplate | **Fase 1 cerrada.** Lo pendiente es la **fase 2**, el corte |
| `AdminModalShell`: 21 consumidores — fase5-y-X | **24** (ha crecido) |
| `backend/index.js`, 467 L duplicadas — auditoria-refactor §3.2 | **Resuelto**: 233 L |
| `HomeView.vue`, 7 709 L — auditoria-refactor §3.3 | **5 233 L** |
| Ruta `frontend/src/views/admin/components/AdminTableManager.vue` — admin-table-manager-refactor | **No existe** desde la reorganización a `modules/` |

### 4.3 Referencias rotas — **ya corregidas** (verificado 2026-08-06 19:2x)

Las dos que listaba la versión anterior están arregladas. Se dejan anotadas para que nadie las vuelva
a "arreglar":

- ~~`SIGUIENTE-SESION-fase5-y-X.md:8` remite a `SIGUIENTE-SESION-complejidad-backend.md`~~ → **hecho**:
  hoy remite a `SIGUIENTE-SESION-saveTemplateArtifactDraft.md` y deja constancia del cambio.
- ~~`docs/auditoria-god-objects-2026-07.md` termina con basura XML~~ → **hecho**: `grep` de
  `</content>|</invoke>` da **0 coincidencias**.

### 4.4 Lo que este re-escaneo REFUTÓ

Dos afirmaciones que se venían arrastrando desde julio y que la medición del 19:22 tumba. Importan
porque una de ellas estaba a punto de generar trabajo inútil (§5-A.3 y §5-A.4).

**R1 — «las marcas de Sonar no sobreviven a mover código».** Falso como regla general. El
reempaquetado `514b67e` movió `SqlAdminService.tableHooks.js` → `crud/tableHooks.js`, y su marca
`S6418 WONTFIX` **sigue viva en `crud/tableHooks.js:111`**. Las **7** marcas manuales existentes
sobrevivieron sin excepción (**hoy quedan 6**: la de `seed_pucese.mjs:256` se fue con el fichero en
`fc44559`, lo que **no** contradice R1 — borrar no es reescribir):

| Regla | Resolución | Ubicación hoy |
|---|---|---|
| `S6418` | WONTFIX | `backend/services/admin/crud/tableHooks.js:111` ← **movido, y sobrevivió** |
| `S6418` | WONTFIX | `backend/services/system/SystemBootstrapService.js:26` |
| ~~`S6418`~~ | ~~WONTFIX~~ | ~~`backend/scripts/seed_pucese.mjs:256`~~ — ✅ **cerrada por eliminación del fichero** (`fc44559`), **no** por reescribir la línea: la regla de R1 sigue en pie |
| `S6418` | WONTFIX | `backend/utils/tokenGenerator.js:4` |
| `S2871` ×2 | FALSE-POSITIVE | `backend/tests/characterization/lib/normalize.mjs:52,94` |
| `S2871` | FALSE-POSITIVE | `backend/tests/characterization/lib/snapshot.mjs:32` |

Sonar rastrea la incidencia por el **hash del contenido de la línea**, no por la ruta: un *rename*
puro la conserva. Lo que la pierde es **reescribir la línea marcada**. La regla correcta no es «no
sobreviven a moverse», es **«no sobreviven a reescribirse»** — que es lo que pasó en el cut #8, donde
la línea sí cambió. (§6 regla 8 corregida.)

**R2 — «el reempaquetado vuelve incomparable la medición».** Falso. `new_violations` pasó de 172 a
**176** (+4), no se disparó, y el New Code sigue anclado al 2026-07-09. El blame de git sigue los
renames, así que el código movido **no** entra como código nuevo. No hay que bumpear
`sonar.projectVersion` para limpiar nada.

---

## 5. Plan por fases

Ordenado por retorno sobre esfuerzo, no por gravedad. Las fases A y B son baratas y desbloquean la
medición; el resto ya no se puede medir bien sin ellas.

### Fase A — Arreglar el instrumento — ✅ **HECHA (2026-08-06)**

Sin esto, cualquier mejora posterior es inmedible. Resultado medido tras aplicarla:

| Métrica | Antes | Después |
|---|---:|---:|
| **Cobertura** | **0,0 %** | **11,5 %** (33 815 líneas a cubrir, 29 334 sin cubrir) |
| `new_coverage` (gate) | 0,0 | **30,6** |
| Ficheros de producción | 391 | **342** (49 pasan a ser tests) |
| NCLOC | 80 448 | 79 899 |
| Vulnerabilidades | 45 | **42** — se van las 3 `S2068` de fixtures, exactamente lo previsto |
| Incidencias abiertas | 832 | **822** |
| `new_violations` | 176 | 171 |

La cobertura del **11,5 %** es real, no optimista: el *Zero Coverage Sensor* de Sonar cuenta como
**0 %** todo fichero analizado que no aparezca en ningún informe, así que los ~300 sin test tiran de
la media hacia abajo como deben. El backend sí tiene un sesgo que hay que conocer: el runner de Node
solo instrumenta los ficheros que **algún test llega a cargar** (21 de ~170), y `--test-coverage-include`
no lo arregla —solo filtra los ya cargados—. El frontend no lo tiene, porque vitest va con `all: true`.
Si algún día hace falta cobertura honesta *por fichero* en el backend, la respuesta es `c8`, no Node.

**Lo que NO hay que volver a tocar:** `sonar.projectVersion` (mueve el New Code period y tira la serie
histórica de §2) y las 4 marcas manuales vivas (§4.4-R1) — **3 hoy**, tras irse la de `seed_pucese.mjs`
con el fichero (`fc44559`).

1. ✅ **Declarar los tests** en `sonar-project.properties`. **La receta que traía este plan estaba mal**
   por dos motivos medidos: (a) los 15 ficheros de test unitario **no viven bajo `backend/tests`**,
   sino junto a su módulo (`services/**/*.test.js`, `config/*.test.js`, …), así que
   `sonar.tests=backend/tests` los seguiría contando como producción; (b) `sonar.sources` y
   `sonar.tests` no pueden solaparse sin patrones **disjuntos**, o el escáner aborta con
   *«File can't be indexed twice»*. La versión correcta excluye los tests de `sources` a la vez que
   los incluye en `tests`:

   ```properties
   # a sonar.exclusions ya existente hay que AÑADIRLE los patrones de test
   sonar.exclusions=<...lo de ahora...>,**/*.test.js,**/*.test.mjs,**/*.spec.js,backend/tests/**

   sonar.tests=backend,frontend/src
   sonar.test.inclusions=**/*.test.js,**/*.test.mjs,**/*.spec.js,backend/tests/**
   ```
   Efecto esperado, ya acotado: **28 ficheros** salen de producción (15 unitarios + 13 flows de char)
   y con ellos **3** vulnerabilidades S2068 y las 3 marcas `S2871`. **No** las 4 que decía este plan,
   y **no** las otras 11 S2068, que son producción real (6 en `SystemBootstrapView.vue`) — **hoy 9**,
   tras cerrarse por eliminación las de `apply_rbac_patch.mjs` y `seed_demo_accounts.mjs` (`fc44559`).
   Verificar tras el cambio que el total de ficheros indexados baja de 391 a ~363.
2. ✅ **Enchufar cobertura** (H2). Hecho con dos scripts nuevos, ambos emitiendo rutas `SF:` relativas
   a la **raíz del repo** (si salen relativas al módulo, Sonar las descarta **en silencio** y la
   cobertura vuelve a 0 sin avisar de nada):

   ```bash
   bash scripts/docker-env.sh dev exec -T backend  npm run test:unit:coverage
   bash scripts/docker-env.sh dev exec -T frontend pnpm run test:unit:coverage
   ```
   - Backend: `node --test --experimental-test-coverage` con **doble reporter** (`spec` a stdout +
     `lcov` a fichero), lanzado desde `cd ..` para que las rutas queden como `backend/…`.
   - Frontend: `vitest run --coverage` (`@vitest/coverage-v8`, añadido como devDependency) con
     `all: true` en `vite.config.js`, y un `sed` que antepone `frontend/` a las rutas `SF:`.
   - **Regenerar ambos informes antes de cada escaneo**, o Sonar leerá la cobertura de la corrida
     anterior sin quejarse.
3. ~~**Re-marcar los falsos positivos.**~~ **HECHO / sin objeto.** El re-escaneo del 19:22 demuestra
   que las **7** marcas vivas (**6 hoy**, §4.4) sobrevivieron enteras al reempaquetado, incluida la de `tableHooks.js`
   que este plan daba por perdida (§4.4-R1). Vulnerabilidades **46 → 45**, seguridad **sigue en D**.
   Sigue en pie lo único que importaba: **no "arreglar" ninguna** — los `S6418` son alfabetos de
   tokens, no secretos, y los `S2871` romperían los golden-master. Lo que sí hay que hacer es
   **revisarlas tras cada refactor que reescriba una línea marcada** (no tras moverla).
4. ~~**Descontar el ruido del reempaquetado.**~~ **Sin objeto** (§4.4-R2): `new_violations` 172 → 176,
   el New Code sigue anclado al 2026-07-09 y las cifras son comparables. **No bumpear
   `sonar.projectVersion`** — hacerlo ahora movería el New Code period y perdería la serie histórica
   de §2, que es el único termómetro fiable que hay.
5. ✅ **Contraseña de admin de Sonar cambiada** (2026-08-06). Efecto colateral que hay que conocer:
   **el basic auth con contraseña dejó de funcionar** y toda la API pide token (§1.1).
6. *(Opcional)* Sonar en CI sobre `develop` (H4).

**Criterio de cierre:** cobertura reportada > 0 y las condiciones del gate reflejan el código y no la
falta de instrumentación.

### Fase B — Etiquetado de formularios — ✅ **HECHA (2026-08-06)**

**Fiabilidad C → A. Cero bugs.** Que era el objetivo entero de la fase.

| | Antes | Después |
|---|---:|---:|
| Etiquetado (`S6853` + `InputWithoutLabelCheck`) | 289 | **0** |
| **Bugs** | 143 | **0** |
| **Fiabilidad** | **C** | **A** |
| Incidencias abiertas | 734 | **442** |
| Deuda (SQALE) | 4 709 min | **3 969 min** |

**186 pares `label`/control enlazados** en 39 ficheros, más ~30 `aria-label`/`aria-labelledby`.

#### Las tres técnicas, y cuándo toca cada una

1. **`for`/`id`** cuando hay un `<label>` con texto y un control al que apuntar. **Siempre con
   `fieldId()` sobre `useId()`, jamás ids literales:** estos modales y widgets se montan varias veces
   en la misma página y un id duplicado es peor que ninguno. Si el control está en un `v-for`, el id
   lleva el índice; si hay bucles anidados, los dos.
2. **`aria-label`** cuando el nombre visible no es un `<label>` sino un `<h4>`, un `<span>`, la
   cabecera de una columna o un `placeholder`, y en los inputs ocultos que se disparan por código.
   **Tiene que ser estático, no `:aria-label`**: la comprobación busca el atributo por nombre literal
   y un binding no cierra la incidencia.
3. **Cambiar la etiqueta HTML** en los rótulos **huérfanos** — los que encabezan un mapa, un grupo de
   botones o un `<iframe>`. Un `<label>` sin control que asociar no se arregla con `aria-*`. Pasan a
   `<div>`/`<span>` conservando las clases exactas.

#### Lo que hay que retener

- **La hipótesis con la que nació la fase era falsa.** No se arreglaba en `SInput`/`SSelect`: `SInput`
  ya emitía `<label :for>` + `<input :id>`. El problema eran `<input>` sueltos en las vistas.
- **De los 6 componentes compartidos implicados, solo 2 necesitaban cambio.** `AdminSelectField`
  (`inheritAttrs:false` + `v-bind`), `AdminInputField` (fallthrough al elemento raíz) y `PdfDropField`
  (prop `input-id`) ya dejaban pasar un id; sus consumidores nunca se lo pasaron.
- **`AdminFieldGroup` necesitó API nueva** (prop `labelFor`): un envoltorio genérico no puede saber a
  qué control apunta su `<label>`.
- **Los 3 bugs finales eran falsos positivos**, verificados uno a uno: `S7727` sobre
  `map(store.mapNotification)` (aridad 1, sin `this` — aun así se hizo explícita, y el guardia
  descubrió que eran 4 llamadas y no 3); `InputWithoutLabelCheck` en `AdminSelectField` (la etiqueta
  vive en el consumidor y Sonar analiza fichero a fichero); y
  `MouseEventWithoutKeyboardEquivalentCheck` sobre `<SHeader @onclick>`, que es un componente cuyo
  interior es un `<button>` real. Los dos últimos **marcados**, no "arreglados" (§7).

#### Deuda que queda anotada

**`SSelect` declara `label` como `required: true` y ninguno de sus 15 usos la pasa** — Vue emite un
warning de prop obligatoria en los 15 y el `<label>` interno se renderiza vacío. El arreglo natural es
`v-if="label"`, pero `deasy-field-label` lleva `mb-2 block`: quitarlo **sube el select 8 px** en los 5
formularios del dossier. Es cambio de aspecto y pide navegador delante.

<details><summary>Redacción original de la fase (referencia)</summary>

| | Antes | Después |
|---|---:|---:|
| Etiquetado (`S6853` + `InputWithoutLabelCheck`) | 289 | **83** (−71 %) |
| **Bugs** | 143 | **40** (−72 %) |
| Incidencias abiertas | 734 | **528** |
| Deuda (SQALE) | 4 709 min | **4 194 min** |
| Fiabilidad | C | **C** — sigue en C: pasa a A solo con **0 bugs** |

**103 pares `label`/control enlazados** con `for`/`id` en 11 ficheros. Los ids se generan con
`fieldId(nombre)` sobre `useId()` de Vue 3.5, **no con literales**: dos instancias del mismo modal
montadas a la vez tendrían ids duplicados, que es peor que no tener ninguno.

**La hipótesis con la que nació la fase era falsa y conviene no repetirla:** esto no se arreglaba en
`SInput`/`SSelect`. `SInput` ya emite `<label :for>` + `<input :id>` correctamente. El problema eran
`<input>` sueltos en las vistas, y por eso hubo que ir fichero a fichero.

#### Las 83 que quedan NO son un barrido — se parten en dos grupos

Verificado leyendo el contexto de cada una. Ninguna se arregla con `for`/`id`, porque **no hay un
`<label>` con el que emparejar**:

| Nº | Grupo | Qué hace falta |
|---:|---|---|
| ~45 | **Control sin `<label>` ninguno.** El nombre visible es un `<h4>`, un `<span>`, la cabecera de una columna de tabla, o un `placeholder`. Incluye un `<input type="file">` oculto (`DossierSectionCrud.vue:78`) que se dispara por código | `aria-label`, o `aria-labelledby` apuntando al encabezado que ya existe. **Decisión de accesibilidad, una a una** |
| ~33 | **`<label>` seguido de un COMPONENTE**, no de un control nativo: `AdminLookupField` (8), `s-select` (8), `AdminSelectField` (5), `SSelect` (4), `PdfDropField` (4), `AdminInputField` (3) | Que el componente acepte y reenvíe un `id` (o que emita su propio `<label>`, como ya hace `SInput`). **Cambia la API de 6 componentes compartidos**; aquí sí aplica el "arreglar en origen", pero sobre este conjunto, no sobre `SInput` |

Ambos grupos piden criterio y **verificación en navegador** (que un lector de pantalla anuncie el
nombre correcto), no un script. El segundo es el de mejor retorno: 6 componentes para 33 incidencias.

<details><summary>Redacción original de la fase (referencia)</summary>

#### Fase B — Etiquetado de formularios (35 % del backlog, y la nota C)

289 incidencias, 141 de ellas clasificadas como BUG. **El conteo por fichero ya está hecho** (§2.1) y
corrige la hipótesis con la que nació esta fase: no es principalmente cosa de `SInput`/`SSelect` ni de
los `Agregar*.vue`. **5 ficheros concentran 203 de las 289 (70 %)**, y cuatro de los cinco son vistas
concretas, no componentes compartidos.

Orden de ataque, por retorno decreciente:

| # | Fichero | Incidencias | Nota |
|---|---|---:|---|
| 1 | `perfil/components/AgregarInvestigacion.vue` | 68 | También tiene el ReDoS-vecino de `AgregarReferencia` (§5-G) y un `S3776` de CC 25 |
| 2 | `admin/components/modals/AdminDraftArtifactModal.vue` | 51 | Además cogn. 139 (§3.1) — vale la pena tocarlo una sola vez para las dos cosas |
| 3 | `auth/views/SystemBootstrapView.vue` | 38 | Y **6 de las 14 `S2068`** del repo. Mismo fichero, dos fases |
| 4 | `auth/views/RegisterView.vue` | 28 | |
| 5 | `firmas/components/FirmarPdf.vue` | 18 | Ya está en la Fase E por otros motivos |

**Antes de tocar los cinco, mirar `SInput`/`SSelect`/`SDate`**: si generan el `<label for>` con la
prop puesta, arreglar el componente compartido puede tumbar parte de esas 203 de golpe. Pero **ya no
es la hipótesis por defecto** — hay que abrir uno de los cinco y comprobar si usa el componente
compartido o `<input>` suelto antes de decidir por dónde entrar. Medir tras el primer fichero.

**Retorno esperado:** fiabilidad **C → A**, backlog −35 %, y accesibilidad real, que es el punto.

</details>

### Fase C — `saveTemplateArtifactDraft` — 🟡 **cortada a la mitad (2026-08-06)**

**CC 164 → 76 (−54 %), y de 563 a ~310 líneas.** Deja de ser el doble que la siguiente: hoy empata
con `createGeneralTask` (75).

| Extracción | Qué se llevó | CC propia |
|---|---|---:|
| `parseWorkflowPayload` + `workflowHasSteps` | JSON.parse defensivo del flujo, en `workflows.js` (puras). Se fue una duplicación: estaba escrito dos veces | — |
| `_resolveDraftOwner` | Cédula + id de persona, con su precedencia y sus 3 consultas | <15 |
| `_validateAuthoredWorkflows` | Cargos resolubles por ubicación + `collectAuthoredWorkflowIssues` | 22 |
| `_materializeDraftFormats` | Semilla, preservación de formatos y ficheros subidos — el bloque mayor | 23 |
| `_linkDraftToProcessDefinition` | Vínculo con la configuración de proceso destino | <15 |

**El aviso del plan se cumplió:** no es un registro, y la caída (54 %) es proporcionalmente menor que
el 100 % del cut #10. Lo que bajó fue el anidamiento, como estaba previsto.

**Sutileza que los cortes tuvieron que conservar:** `_linkDraftToProcessDefinition` devuelve el id del
vínculo **solo si lo insertó esa llamada**, y `null` si ya existía. Quien llama lo necesita así porque
su `catch` compensa a mano —no hay transacción— y solo debe borrar lo que insertó él.

**Lo que queda dentro (los 76):** el `try` de persistencia con su rollback. Es el núcleo transaccional
y comparte cuatro variables de compensación (`createdId`, `uploadedToMinio`, `insertedDeliverableId`,
`insertedLinkId`) entre el `try` y el `catch`. Extraerlo exige decidir antes **quién posee la
compensación**, y eso ya no es mover código: es rediseñar el manejo de errores. Candidatos claros si
se sigue: la rama de creación (`deliverable` + `template_artifact`) y la identidad/rutas de storage.

Verde en cada corte: `node --check`, `check:imports`, unit 218/218 y **caracterización 161/161 con los
goldens intactos**, que es la prueba de que son refactor puro.

<details><summary>Redacción original de la fase (referencia)</summary>

#### Fase C — `saveTemplateArtifactDraft`, fase 2 (el corte)

La peor función del backend (**CC 164**, 563 L, el doble que la siguiente). **La red ya existe** — esto es lo que
cambia respecto a todos los intentos anteriores: `zzz_artifact_draft.test.mjs` fija 13 casos, char
está en 161 casos / 13 flows, y el harness ya habla multipart.

Anatomía en 8 fases secuenciales documentada en el handoff (validación → resolución de propietario →
identidad y rutas → materialización de semilla → escritura de ficheros → parseo → validación de flujo
→ escritura). Son los candidatos naturales a *Extract Method*, y las fases 1-3 son puras.

**Aviso que hay que retener:** esto **no es un registro**. El cut #10 bajó CC 99 → 0 porque
*Replace Conditional with Registry* convierte condicional en datos; aquí hay una secuencia, no un
despacho por clave. Lo que sí baja de verdad es el anidamiento (buena parte de esos 164 son `if` a dos
y tres niveles dentro del `try` gigante). Esperar una caída **proporcionalmente menor** que en el cut
#10 y no engañarse con la analogía.

**Segundo aviso, nuevo:** la función **crece sola**. En un solo commit de fontanería (`b86be28`, mover
el staging a `os.tmpdir()`) pasó de CC 158 a 164 y de 542 a 563 líneas. Es el sumidero por defecto de
cualquier cambio que roce los borradores. Cada mes que se posponga esta fase, el corte cuesta más.
Antes de empezar, actualizar el comentario desfasado de `templateLifecycle.js:14` («542 lineas»).

</details>

### Fase D — Controllers que violan CLAUDE.md — 🟡 **las dos grandes, hechas (2026-08-07)**

| | Antes | Después |
|---|---:|---:|
| `user_controler.js` cognitiva | 337 | **182** (−46 %) |
| `user_controler.js` líneas | 1 963 | **1 513** |
| `createGeneralTask` | CC **75**, 362 L | fuera de la cola de `S3776`; controller de **28 líneas** |
| `getUserMenu` | 374 L | 24 líneas en el controller |

Nacen `GeneralTaskService` (dueño de la transacción entera) y `UserMenuService` (proyección de solo
lectura), con 34 tests nuevos junto al módulo.

> **Aviso que vale para cualquier corte de este tipo:** mover una transacción del controller al
> servicio **cambia dónde caen los errores**. Aquí `pool.getConnection()` estaba en el controller
> **fuera** de su `try`, así que un fallo de la pool llegaba a Express como 500; al moverlo, pasaba a
> salir como **400** — infraestructura disfrazada de culpa del cliente. Se conserva marcando
> `statusCode` en el error y honrándolo en el controller (`error.statusCode ?? 400`), que es el patrón
> que ya usaban `task_generation_controller` y `sign_workflow_controller`. **Ningún test caracterizado
> cubría ese camino.**

**Quedan las tres filas de firma** (`sign_controller.js` ×2 y `sign_workflow_controller.js`).

<details><summary>Redacción original de la fase (referencia)</summary>

Lógica de negocio que vive en la capa de controller. `DocumentWorkflowResetService.js` (258 L, una
responsabilidad) es el estilo objetivo.

| Origen | Qué | Destino |
|---|---|---|
| `user_controler.js:1834` | `createGeneralTask` — 362 L (hasta `:2195`), **CC 75** | `GeneralTaskService` |
| `user_controler.js:167` | `getUserMenu` — 374 L (hasta `:540`), jerarquía org + RBAC | `UserMenuService` |
| `sign_controller.js` | Motor de batch-jobs (persistencia + bucle `setImmediate`) | `BatchSigningService` |
| `sign_controller.js` | Plan de almacenamiento + firma de PDF | `PdfSigningService` |
| `sign_workflow_controller.js` | Máquina de estados de `fill_requests` | `FillRequestWorkflowService` |

Ataca a la vez el God #2 (`user_controler.js`, cogn. **337**) y su **13,1 %** de duplicación (288 L,
el segundo peor del repo tras los datos de `sqlTables.js`).

</details>

> **Ojo al leer la duplicación después del corte:** la densidad de `user_controler.js` **sube** de
> 13,1 % a 17,5 % aunque las líneas duplicadas **bajen** de 288 a 264. Es el denominador, que encogió
> un 31 %. No es una regresión.

### Fase E — Frontend: las piezas pendientes del plan de julio

Lo que sobrevive de `plan-refactor-frontend.md` tras revalidarlo, más una deuda nueva (E-4):

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
4. **`httpClient` no es un cliente — es un efecto secundario global** *(deuda nueva, 2026-08-06)*.
   `core/services/httpClient.js` no llama a `axios.create()`: registra el interceptor sobre el
   **singleton** de axios y hace `export default axios`, o sea devuelve el mismo objeto que ya tenías.
   Medido: **31 ficheros importan `axios` crudo y solo 2 importan `httpClient`** —`userPhotoService.js`
   y `main.js:5`, este último como import a pelo. **La cabecera `Authorization` de toda la aplicación
   depende de que `main.js` importe ese módulo antes que nadie.** Funciona, pero es orden de imports,
   no diseño; y `PerfilView.vue` ya hace las dos cosas a la vez (axios crudo en `:97`, `httpClient`
   por transitividad en `:113`).
   **Coste:** tocar los 31 ficheros. **No es un arreglo de paso, es un refactor con nombre propio.**
   **Síntoma ya cobrado:** rompió la suite de `PerfilView` durante semanas (ver §6 regla 11).

### Fase F — Los dos nunca auditados

- **`signer/app.py`** — 🟡 **auditado y con red (2026-08-07)**, ver `docs/auditoria-signer-2026-08.md`.
  **El diagnóstico de este plan estaba invertido.** Se daba por hecho que lo temido era la firma; es al
  revés: la firma real son **88 líneas con cognitiva 17**, y el **81 % de la complejidad marcada**
  (148 de 183 puntos, 6 de las 8 funciones) está en **leer identidad de certificados ecuatorianos**,
  430 líneas. Eso invierte la estrategia: ese bloque es el **más fácil** de cubrir con pruebas puras,
  porque no toca red, disco ni criptografía.
  - **Red: 224 casos** (`signer/tests/`, `unittest` de la stdlib, sin dependencias nuevas), validada
    **por mutación**. No cubre firmar un PDF de verdad: pyHanko está sustituido por dobles.
  - **Se fueron 762 líneas de código muerto**: un signer Node anterior que ni arrancaría.
  - **Tres riesgos que no se arreglan moviendo código** y piden decisión: **R-1** la contraseña del
    PKCS#12 viaja en claro por AMQP sin TLS; **R-2** `validate_signed_pdf_with_policy` da por válido un
    PDF que salió **sin firmas embebidas** (el dict de ese caso no trae `bottomLine` y el
    `.get(..., True)` lo da por bueno); **R-3** una rama inalcanzable deja salir la cédula sucia.
  - Siguiente corte recomendado: las 430 líneas de identidad. **Tocar la firma está bloqueado** hasta
    que exista una prueba que firme un PDF real y lo valide.
- **`backend/config/postgres.js`** (cogn. **241 en 391 ncloc** — la densidad más alta del repo). Dos
  funciones en `:47` y `:111` (CC 49 y 59) que reescriben dialecto SQL. Candidato a tabla de
  traducción declarativa.

### Fase G — Barridos mecánicos — ✅ **HECHA la parte mecánica de verdad (2026-08-06)**

| Regla | Antes | Después | Qué se hizo |
|---|---:|---:|---|
| `S1128` imports sin usar | 43 | **0** | Retirados. 33 eran el rastro de los cuts #1-#9 en `SqlAdminService` |
| `S7781` `replace`→`replaceAll` | 24 | **0** | Dos pasadas: método primero, y luego el regex de un carácter a literal |
| `S1135` «TODO» | 21 | **0** | **Marcadas como falso positivo.** Ver el aviso de abajo — no había nada que arreglar |
| `S3358` ternarios anidados | 51 | 51 | **No entra**: reescribirlos cambia estructura, no forma |
| `S7780` `String.raw` | 17 | 17 | **No entra**: convención pura sobre escapado de strings, y 5 están en `templateLifecycle`, que la Fase C reescribe |
| `S8786` backtracking | 28 | 28 | **No entra**, como ya decía el plan: uno a uno |

**Resultado global:** incidencias abiertas **822 → 734** (−88), code smells 644 → **549**, deuda
4 872 → **4 709 min**, y `new_violations` **176 → 101** (−43 %, la mitad del gate).

> ### ⚠️ Las 21 `S1135` eran TODAS falsos positivos: la regla casa con la palabra española «todo»
>
> Ni uno solo de los 21 avisos era un marcador de tarea. Todos son prosa: *«**todo** entregable de
> proceso admite carga manual»*, *«Singleton compartido por **todo** el backend»*, *«Casi **todo** por
> la API de admin»*, *«**Todo** lo demás es interno»*. Un `grep` de `\bTODO\b` sobre `backend`,
> `frontend/src`, `signer` y `scripts` **no devuelve un solo marcador real** — las tres únicas
> apariciones en mayúsculas son la palabra española escrita con énfasis (*«deshacer TODO lo que
> insertó»*).
>
> **Marcadas en bloque como FALSE-POSITIVE en Sonar, no "arregladas".** Reescribir comentarios en
> castellano correctos para contentar a una regla que no entiende el idioma sería destrozar prosa
> legible. Esto sube las marcas manuales vivas de 4 a 25 (§4.4-R1) y **entra en §7**.
>
> Corrige lo que decía este plan: «23 `TODO` (triar: convertir en issue o borrar)». No hay nada que
> triar. Y explica de paso por qué `S1135` engorda en un repo con comentarios en español: cualquier
> comentario nuevo que use la palabra «todo» reaparecerá. Si molesta, se desactiva la regla en el
> perfil de calidad.

Lo que queda (`S3358`, `S7780`, `S8786`) **ya no es barrido**: son 96 incidencias que piden criterio
una a una. Ver la tabla de arriba.

<details><summary>Redacción original de la fase (referencia)</summary>

Baratos, sin riesgo, en cualquier momento entre fases: **43** imports sin usar (`S1128`), **51**
ternarios anidados (`S3358`), **24** `replace()` → `replaceAll()` (`S7781`), **25** `TODO` (`S1135`,
triar: convertir en issue o borrar), **17** `S7780` (`String.raw`). Los **29** `S8786` (backtracking no
lineal) **no** son mecánicos — hay que mirarlos uno a uno, incluyen el ReDoS de `AgregarReferencia.vue`.

**Esta fase es la que más mueve el Quality Gate**, y eso es nuevo: de las **176** `new_violations` que
suspenden el gate (§1.2 H3), **43 son `S1128`, 19 `S1135`, 17 `S3358` y 11 `S7781` = 90 (51 %)**.
Es decir, medio gate se cierra con un barrido sin riesgo. Hacerlo **después** de la Fase A-2
(cobertura), porque hasta entonces el gate falla igual por `new_coverage`.

</details>

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
8. **Revisar las marcas de Sonar después de cada refactor** — pero por el motivo correcto: Sonar
   rastrea la incidencia por el **hash de la línea**, así que **un rename puro las conserva**
   (medido: las 7 sobrevivieron a `514b67e`, §4.4-R1). Lo que las tumba es **reescribir la línea
   marcada**. No perder tiempo re-marcando después de mover ficheros; sí después de editarlos.
9. **Refactor = mover código, NO reescribir comportamiento.**
10. **Verificar en el navegador**, no solo con lint y tests.
11. **Una suite que no arranca no es "0 tests", es un fallo.** Vitest la marca *Failed Suite* con 0
    casos cuando el error ocurre al importar. Así estuvo muerta `PerfilView.test.js` (17 casos) desde
    `0de813c`: un import nuevo metió `httpClient` en su grafo, el `vi.mock("axios")` no declaraba
    `interceptors` y la suite moría antes del primer caso. **Mirar la línea `Test Files`, no solo la de
    `Tests`.** Y al añadir un import a un componente con test, revisar que su mock siga teniendo la
    forma del módulo real.

### Comandos (todo dentro de los contenedores)

```bash
bash scripts/docker-env.sh dev exec -T backend npm run check:imports      # tras mover código
bash scripts/docker-env.sh dev exec -T backend npm run test:char:run      # 161 casos, 13 flows
bash scripts/docker-env.sh dev exec -T backend npm run test:char:capture  # actualiza el golden
bash scripts/docker-env.sh dev exec -T backend npm run test:unit          # 218 (15 ficheros)
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
- **`S1135` («TODO») al completo.** Las 21 son la palabra española «todo» en comentarios en prosa; no
  existe ni un marcador de tarea real en el repo. Están marcadas como FALSE-POSITIVE. **No reescribas
  comentarios en castellano para silenciar la regla.** Si vuelven a aparecer al escribir comentarios
  nuevos, márcalas otra vez o desactiva la regla en el perfil de calidad (§5-G).
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
| `docs/plan-cobertura-2026-08.md` | **Vivo — plan ejecutable de cobertura.** El gate falla por `new_coverage`, y subir el global es otro problema. Lleva el reparto en cuatro agentes paralelos y las trampas medidas (los `.vue` son 2/3 del hueco; Node solo instrumenta lo que un test carga) |
| `docs/auditoria-signer-2026-08.md` | **Vivo — auditoría del microservicio de firma.** Mapa por bandas, 12 riesgos y plan de corte por fases |
| `docs/plan-limpieza-scripts-2026-08.md` | **Vivo** |
| ~~`SIGUIENTE-SESION-fase5-y-X.md`~~ | **Archivado el 2026-08-08**: lo que pedía está hecho (§5-E) |
| ~~`SIGUIENTE-SESION-saveTemplateArtifactDraft.md`~~ | **Archivado el 2026-08-08**: fase 1 cerrada y fase 2 hecha a medias y medida (§5-C) |
| `docs/docs-md-antiguos/refactor-2026-07/` | **Archivados** (§7 del README de esa carpeta): la auditoría base de julio, el plan de `user_controler` con sus M1-M4 hechos, la auditoría de tests unitarios y el plan de `AdminTableManager` de marzo |

---

## 9. Cómo reproducir esta medición

```bash
docker compose -f scripts/sonar/compose.yml up -d
# Requiere un token (ver §1.1): el basic auth con contraseña ya no vale.
S="curl -s -H \"Authorization: Bearer $SONAR_TOKEN\" http://localhost:9002"

# re-escanear (~1 min). El token es de un solo uso práctico: generar uno por sesión
TOKEN=$($S/api/user_tokens/generate -X POST -d "name=deasy-scan-$(git rev-parse --short HEAD)" \
        | python3 -c 'import json,sys;print(json.load(sys.stdin)["token"])')   # necesita un token previo
SONAR_TOKEN=$TOKEN bash scripts/sonar/scan.sh

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

# serie histórica — el termómetro real, no la foto de un día (§2)
$S/api/measures/search_history?component=deasy'&'metrics=ncloc,cognitive_complexity,violations,sqale_index

# marcas manuales vivas (§4.4-R1) — WONTFIX y FALSE-POSITIVE
$S/api/issues/search?componentKeys=deasy'&'resolutions=WONTFIX,FALSE-POSITIVE'&'ps=50

# reparto por fichero de una regla — así se hizo la tabla de §2.1
$S/api/issues/search?componentKeys=deasy'&'rules=Web:S6853,Web:InputWithoutLabelCheck'&'resolved=false'&'facets=files'&'ps=1

# qué compone las new_violations que suspenden el gate (§5-G)
$S/api/issues/search?componentKeys=deasy'&'resolved=false'&'inNewCodePeriod=true'&'facets=rules'&'ps=1
```
