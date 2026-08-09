# Plan de calidad y reducción de complejidad — agosto 2026

> **Documento maestro único.** Sustituye y absorbe la serie de auditorías de julio. Los documentos
> previos quedan archivados en `docs/docs-md-antiguos/refactor-2026-07/` (ver §7); lo que seguía vivo
> en ellos está recogido aquí, revalidado contra el código y contra Sonar.
>
> **Medición:** SonarQube en `:9002`, análisis del **2026-08-08 17:27 UTC**, cruzado con lectura
> directa del código y con un análisis propio de complejidad por función.
> Rama `develop`, HEAD `114651a` (SCM revision confirmada por el escáner).
>
> ### Estado al 2026-08-09
>
> **El mapa completo —qué es cada fase y qué le queda— está en §5.0.** Aviso para no perderse: las
> letras son **el orden en que se descubrieron**, no prioridad ni tema. Usa el nombre, no la letra.
>
> | Fase | Estado |
> |---|---|
> | **A** · arreglar el instrumento de medida | ✅ |
> | **B** · etiquetado de formularios | ✅ — fiabilidad **C → A**, cero bugs, **sostenido** en el re-escaneo |
> | **G** · barridos mecánicos | ✅ |
> | **F** · `postgres.js` | ✅ **(08-08)** — las dos peores funciones, **108 → 15 puntos**; 60 casos + fuzz de 200 000 entradas |
> | **H** · la nota D de seguridad | ✅ **(08-08)** — cerrada la única CRITICAL: seguridad **D → C** |
> | **I** · residuos de la migración a PostgreSQL | ✅ **(08-09)** — 4 `UPDATE … JOIN` de MySQL, uno con **una función rota para todos los usuarios** |
> | **C** · partir `saveTemplateArtifactDraft` | ✅ **(08-09)** — CC 164 → **21**. La compensación pasa a poseerla cada paso (Command) |
> | **D** · controllers → servicios | 🟡 **2 de 5** (`user_controler` cogn. 337 → **182**); faltan las tres de firma, **ya con red** |
> | **E** · frontend | 🟡 **4 de 5** — `httpClient` cerrado (08-09); falta solo colores/forks |
> | **F** · `signer/app.py` | ✅ **(08-09)** — corte de identidad hecho: bloque **142 → 84**; 266 pruebas, cobertura **89,4 %**. Queda el traslado a fichero propio |
>
> **Dos días de trabajo, medidos** (última medición: **08-09 04:0x**, HEAD `5d5482c`, tras cerrar
> D, E-4, F e I):
>
> | | Línea base | **Ahora** | Δ |
> |---|---:|---:|---:|
> | Incidencias abiertas | 832 | **375** | **−55 %** |
> | Bugs | 143 | **0** | −143 |
> | Vulnerabilidades | 45 | **8** | −82 % |
> | Deuda (SQALE) | 4 902 min | **2 906 min** | **−41 %** |
> | Complejidad cognitiva | 8 797 | **8 138** | −659 |
> | Cobertura | 0 % | **17,7 %** | |
> | Duplicación | 3,1 % | **2,9 %** | |
> | Fiabilidad / Seguridad / Mantenibilidad | C / D / A | **A / C / A** | |
>
> Los tests pasaron de 218+161 a **389 unitarios + 238 de caracterización + 304 de frontend +
> 266 del signer**.
>
> **Seguridad D → C: la fijaba UNA sola incidencia.** No eran «38 sin triar»: eran 34, y la escala de
> Sonar va por **peor severidad, no por volumen** (basta 1 CRITICAL para D). La única CRITICAL era el
> workspace del firmante bajo `/tmp`; cerrada (§5-H). Antes ya se había cerrado lo que sí era
> explotable: el broker de RabbitMQ publicado en todas las interfaces en dev, qa **y prod**, con
> `guest` administrador (`b4a4231`). Sigue abierto que la contraseña del PKCS#12 viaje por AMQP sin
> TLS (R-1, 4 de las 34).
>
> **Y la cobertura era en parte un espejismo.** El signer tenía **229 pruebas que contaban como 0 %**
> porque nunca se conectó `sonar.python.coverage.reportPaths`: `app.py`, el fichero más complejo del
> repo, está en realidad al **88 %**. Conectarlo subió el global de 14,2 a 16,2 % sin escribir un solo
> test. Ojo con la lectura del 16 %: **el gate no pide 80 % global** —eso sí serían años— sino 80 % de
> lo nuevo. Ver `docs/plan-cobertura-2026-08.md` §0.1.
>
> **Cobertura:** 0 % → **14,2 %**. El plan para seguir es `docs/plan-cobertura-2026-08.md`.
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

**Y sí se puede salir del atolladero sin abrir la UI** (corregido el 2026-08-08: este documento decía
que había que pasar por la interfaz). Lo que murió al cambiar la contraseña es el **basic auth**, no
la contraseña: el endpoint de sesión `POST /api/authentication/login` la sigue aceptando y devuelve
una cookie con la que ya se puede emitir un token. Es la receta de arranque en frío, cuando no
conservas ningún token vivo:

```bash
curl -s -c cj.txt -X POST "http://localhost:9002/api/authentication/login" \
     -d "login=admin" --data-urlencode "password=<contraseña>"
XSRF=$(awk '/XSRF-TOKEN/{print $7}' cj.txt)          # el token CSRF viaja en su propia cookie
curl -s -b cj.txt -H "X-XSRF-TOKEN: $XSRF" -X POST \
     "http://localhost:9002/api/user_tokens/generate" -d "name=deasy-scan-$(git rev-parse --short HEAD)"
```

El `X-XSRF-TOKEN` no es opcional: sin él el `POST` devuelve 401 aunque la cookie de sesión sea válida.
La contraseña de admin **ya no es la de por defecto** — no está escrita en este repo.

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

| Condición | Umbral | 08-06 (H2 vivo) | **08-08 17:27** | |
|---|---|---|---|---|
| `new_coverage` | ≥ 80 % | 0.0 | **34,5** | ❌ pero ya mide de verdad |
| `new_duplicated_lines_density` | ≤ 3 % | 1.80 | **1,56** | ✅ |
| `new_violations` | 0 | 176 | **105** | ❌ |

El New Code period es `PREVIOUS_VERSION` con fecha **2026-07-09 14:17**.

**Lo que ha cambiado en la composición de `new_violations`, y es lo que importa:** las 176 de agosto-06
eran barrido mecánico (43 `S1128`, 19 `S1135`, 17 `S3358`…). Las **105** de hoy son
**23 `S3776` + 19 `S3358` + 17 `S8786` + 13 `S7780` = 72 (69 %)**, es decir, **complejidad y criterio**.
Traducción operativa: **el gate ya no se cierra con un barrido**. Lo que queda de `new_violations` es
el mismo trabajo de las fases C/E/F, contado en el New Code.

Y el gate seguirá en ERROR aunque se cierren las 105, porque `new_coverage` está en 34,5 contra un
umbral de 80. Eso ya no es un defecto del instrumento (H2 está cerrado): es el trabajo de
`docs/plan-cobertura-2026-08.md`.

**H4 — Sonar no corre en CI, y NO es «añadir un step»: falta un servidor alcanzable**
*(diagnosticado y corregido el 2026-08-08)*.

> **Este documento llegó a decir que H4 «pasó de montar CI a añadir un step». Es falso, y conviene
> que quede escrito por qué**, porque la versión optimista llevaba derecha a un CI en rojo permanente.

Es cierto que el gancho existe: desde `76d7011`, `cd-multienv.yml` ya corre `pnpm run lint`,
`npm run check:imports` y `npm run test:unit` (`:122-151`). Lo que **no** existe es un SonarQube al que
un runner pueda llegar:

- `scripts/sonar/compose.yml` publica el servidor en `9002:9000` **solo en la máquina del
  desarrollador**: sin ingress, sin TLS y con la base de datos en `sonar/sonar`.
- `scripts/sonar/scan.sh` tenía `SONAR_HOST_URL="http://sonarqube:9000"` **cableado**, y corría con
  `--network deasy-sonar_default`: ese nombre solo resuelve dentro de la red de compose local.
- No hay ni una referencia a instancia remota en todo el repo, ni secrets `SONAR_*` declarados.

Un step de Sonar en el job de calidad **fallaría en todos los push, para siempre, sin producir una sola
medición**. Lo que falta no es trabajo de CI: es una decisión de infraestructura — publicar el
SonarQube (y antes arreglarle credenciales por defecto y TLS) o migrar a SonarCloud.

**Lo que sí queda hecho**, para que el día que haya servidor sea encender un interruptor:

| Pieza | Estado |
|---|---|
| `.github/workflows/sonar.yml` | ✅ Nuevo, `workflow_dispatch`. Un **guard** que hace *skip* limpio y **verde** si faltan `SONAR_HOST_URL`/`SONAR_TOKEN`, en vez de rojo permanente |
| `fetch-depth: 0` en el checkout | ✅ Sin blame de git, el escáner no distingue código nuevo y el New Code period deja de medir |
| Regeneración de los dos `lcov` antes de escanear | ✅ Requisito de §5-A.2 |
| **Verificador de `lcov`** | ✅ Falla si un informe está vacío o si sus rutas `SF:` no empiezan por `backend/`/`frontend/`. Es el fallo silencioso que documenta §5-A.2: Sonar descarta el informe **sin quejarse** |
| `scripts/sonar/scan.sh` parametrizado | ✅ Sin `SONAR_HOST_URL` se comporta **exactamente igual que antes** (modo local); con ella, modo remoto sin `--network` |

**Para activarlo** hacen falta dos secrets de repositorio: `SONAR_HOST_URL` (una URL alcanzable desde
internet — **no** `http://localhost:9002`) y `SONAR_TOKEN`.

---

## 2. Línea base validada (2026-08-08 17:27, HEAD `114651a`)

**Ojo con `resolved=false` al consultar la API.** Por defecto `/api/issues/search` devuelve también
las incidencias cerradas y las marcadas *won't fix*, y eso infla los conteos. Todas las cifras de
abajo son **abiertas**.

La columna Δ compara contra el **20:18 post-Fase A**, no contra el 19:22: es la última medición con
los mismos denominadores (§2.0). Entre una y otra caben las fases B, C, D, E, F-signer y G enteras.

| Métrica | Valor | Δ vs. 08-06 20:18 |
|---|---:|---:|
| NCLOC / ficheros | 77 672 / 335 | −2 227 / −7 |
| **Complejidad cognitiva** | **8 334** | **−386** |
| Complejidad ciclomática | 15 601 | −363 |
| Incidencias abiertas | **416** | **−406 (−49 %)** |
| — code smells | 382 | −255 |
| — **bugs** | **0** | **−143** |
| — vulnerabilidades | 34 | −8 |
| Severidad | 0 BLOCKER · 71 CRITICAL · 218 MAJOR · 125 MINOR · 2 INFO | |
| Deuda técnica (SQALE) | **3 708 min** (≈ 62 h) | **−1 164 min (−24 %)** |
| Duplicación | 3,0 % (178 bloques) | −0,4 pt |
| Cobertura | **14,2 %** | +2,7 pt |
| Fiabilidad / Seguridad / Mantenibilidad | **A / D / A** | **C → A** / = / = |
| Funciones sobre el umbral de complejidad cognitiva (15) | **67 abiertas** (60 JS + 7 Python) | −4 |

**Lectura: el plan funciona, y el trabajo que queda ya no es barato.** La mitad del backlog se ha ido
en dos días, la fiabilidad está en A con **cero bugs**, y la deuda baja una cuarta parte. Pero mirar
la composición del resto (§2.2) dice lo importante: **de las 416 que quedan, las que se iban con un
script ya se fueron.** Lo que queda pide criterio uno a uno — 60 `S3776` de complejidad, 48 ternarios
anidados, 33 de contraste de color, 28 de backtracking. El siguiente tramo cuesta más por incidencia
que todo lo hecho hasta ahora.

Serie histórica completa (`/api/measures/search_history`), útil para no volver a discutir si algo mejoró:

| | 07-09 14:17 | 07-17 | 08-06 20:18 | 08-07 16:01 | 08-08 01:33 | 08-08 03:48 | **08-08 17:27** |
|---|---:|---:|---:|---:|---:|---:|---:|
| NCLOC | 80 668 | 79 964 | 79 899 | 79 880 | 79 972 | 79 599 | **77 672** |
| Cognitiva | 9 190 | 9 022 | 8 720 | 8 720 | 8 720 | 8 543 | **8 334** |
| Incidencias | 938 | 812 | 822 | 528 | 442 | 441 | **416** |
| SQALE (min) | 5 863 | 5 350 | 4 872 | 4 194 | 3 969 | 3 831 | **3 708** |
| Cobertura | 0,0 | 0,0 | 11,5 | 11,5 | 11,5 | 14,0 | **14,2** |

En un mes: **−856 de complejidad cognitiva (−9,3 %)**, **−522 incidencias (−56 %)** y **−2 155 min de
deuda (−37 %)**. Los saltos son identificables uno a uno: el 08-07 16:01 es la Fase B (bugs 143 → 40),
el 08-08 01:33 la remata (→ 0) junto con la G, el 03:48 son las fases C y D, y el 17:27 recoge la
limpieza de `backend/scripts/` (−1 927 ncloc, que es el grueso de la caída de NCLOC).

### 2.0 Las dos discontinuidades de la serie — no compares a través de ellas

**(1) El 20:18 del 08-06 rompió los denominadores.** La Fase A sacó 49 ficheros de test del código de
producción, así que las métricas cambian **sin que se haya tocado una línea**:

| | 19:22 (pre-A) | **20:18 (post-A)** | |
|---|---:|---:|---|
| Cobertura | 0,0 % | **11,5 %** | ← el objetivo de la fase |
| Ficheros | 391 | **342** | −49 tests |
| NCLOC | 80 448 | 79 899 | |
| Cognitiva | 8 797 | 8 720 | los tests dejan de sumar |
| Incidencias abiertas | 832 | **822** | |
| — vulnerabilidades | 45 | **42** | las 3 `S2068` de fixtures |
| Duplicación | 3,1 % | 3,4 % | **sube**: los tests diluían el porcentaje |

**(2) La duplicación del 17:27 tampoco es comparable hacia atrás por la misma razón, al revés.**
Baja de 3,4 % a 3,0 %, pero parte de esa caída es que se borraron ficheros muy duplicados
(`apply_rbac_patch.mjs`, 95 líneas al 18,1 %), no que el código restante se haya deduplicado. Ver §2.3.

### 2.1 El hallazgo que explicaba la nota C — ✅ **cerrado, se conserva el diagnóstico**

> **Cifras históricas del 08-06.** Hoy estas dos reglas están a **0** y los bugs a **0**: la Fase B lo
> cerró y el re-escaneo del 17:27 confirma que **se sostiene** (fiabilidad **A**). Se conserva entero
> porque explica de dónde salía la nota C y, sobre todo, porque **la hipótesis de partida era falsa** —
> ese es el aprendizaje reutilizable, no el número.

**289 de las 832 incidencias abiertas (35 %) eran dos reglas de etiquetado de formularios:**

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

### 2.2 El backlog que queda, por regla (17:27) — ya no hay barrido que hacer

| Nº | Regla | Naturaleza |
|---:|---|---|
| 60 | `javascript:S3776` | Complejidad cognitiva — **el núcleo de lo que queda** (§3). +7 de `python:S3776` = **67** |
| 48 | `javascript:S3358` | Ternarios anidados — reescribirlos cambia estructura, no forma (§5-G) |
| 33 | `css:S7924` | Contraste texto/fondo insuficiente — **ligado a la Fase X**, no se toca antes del sistema de diseño |
| 28 | `javascript:S8786` | Regex con backtracking no lineal — uno a uno, incluye el ReDoS de `AgregarReferencia` |
| 16 | `javascript:S7780` | `String.raw` — convención pura sobre escapado |
| 13 | `javascript:S7770` · 13 `javascript:S4624` | Modernización de sintaxis · plantillas anidadas |
| 11 | `javascript:S7776` · 10 `javascript:S6582` | Ídem (encadenamiento opcional y similares) |
| 10 | `javascript:S2486` | Excepción capturada y silenciada — **el único grupo con olor a bug latente** |
| 10 | `Web:S6819` | Roles ARIA sobre elementos con semántica propia |
| 8 | `javascript:S2068` | Contraseñas hardcodeadas — **las credenciales demo**, triadas en §5-H |

**Lo que esta tabla dice y la anterior no:** desaparecieron por completo `S1128` (43), `S7781` (24),
`S1135` (25) y las dos de etiquetado (289). Es decir, **las cinco reglas que se cerraban en bloque ya
están cerradas**. De las 416 restantes, las tres primeras filas (141) son las fases C/E/F de este plan,
y el resto son decisiones de una en una. **Nadie va a volver a bajar 400 incidencias en dos días.**

Y hay una fila que merecía mirada propia: los **10 `S2486`** (`catch` que se traga la excepción). Era la
única regla del backlog que olía a defecto latente en vez de a estilo, y Sonar la clasifica como code
smell, así que no contaba para la nota de fiabilidad.

> **✅ Triados uno a uno el 2026-08-08, y la corazonada era correcta: había un defecto real.**
>
> **`RealtimeGateway.js:85`** envolvía en el mismo `catch` dos cosas incompatibles: `jwt.verify` (fallo
> esperado) y `await userRepository.findById(userId)` (fallo de infraestructura). **Con la base de datos
> caída, todos los usuarios recibían «Token inválido» en el WebSocket y el servidor no dejaba ni una
> línea de traza.** Un chat y unas notificaciones muertos se habrían diagnosticado como «problema de
> sesión». Arreglado con log, sin tocar el mensaje al cliente.
>
> Y aparece un segundo del mismo tipo, **`sign_controller.js:114`**, que traduce cualquier fallo de
> `statMinioObject` a *«El certificado seleccionado ya no está disponible… vuelve a cargar tus
> certificados»*: con MinIO caído se le dice al usuario que su certificado desapareció y se le invita a
> resubirlo. Es infraestructura disfrazada de error de datos — **el mismo patrón que §5-D documenta**
> con el 500 que se convertía en 400. Queda para la Fase D, que es quien toca ese fichero.
>
> Reparto final: **1 defecto real + 3 leves** arreglados con traza, **3 mudos intencionales**
> documentados con `catch {` y un comentario del porqué, **2 falsos positivos** marcados, 1 delegado.
> Ningún contrato de error alterado.
>
> **Dato útil sobre la regla, medido:** `S2486` dispara cuando **existe el binding `catch (error)` y no
> se referencia dentro del bloque**. Los `} catch {` sin binding **no** se marcan — y ya hay 86 en el
> frontend. Por eso los dos remedios legítimos son usar el error o quitar el binding, y por eso la regla
> no mide «catch vacíos» sino «bindings sin usar».

### 2.3 Duplicación concentrada

Medido el 17:27. El total baja a 3,0 % / 178 bloques, pero el reparto es lo que importa:

| Líneas dup. | % | Fichero |
|---:|---:|---|
| 534 | 52,9 % | `backend/config/sqlTables.js` — **son datos, es duplicación legítima. No tocar** (§7) |
| 264 | **17,4 %** | `backend/controllers/users/user_controler.js` — ver el aviso de §5-D: **el % sube porque el denominador encogió** |
| 75 | 27,5 % | `backend/services/whatsapp/WhatsAppBot.js` |
| 66 | 21,2 / 23,9 % | `AgregarCapacitacion.vue` / `AgregarExperiencia.vue` |
| 64 | 22,6 % | `backend/services/admin/generation/assignees.js` |
| 64 | 5,0 % | `backend/services/documents/DocumentSignatureWorkflowService.js` |
| 63 | 15,9 % | `frontend/.../modals/AdminDefinitionRulesPanel.vue` — **nuevo en el radar** |
| 62 | **40,5 %** | `backend/utils/templateArchive.js` — **nuevo, y el peor ratio del repo tras `sqlTables`** |
| 62 | 26,2 % | `backend/config/swagger/dossierPaths.js` — es *spec* declarativa, mismo caso que `sqlTables` |

`SystemBootstrapService.js` (74 L, 8,2 %) **sale de la lista**. Entran tres que antes no estaban, y
`templateArchive.js` con un **40,5 %** merece una mirada: es utilitario pequeño, así que ese ratio son
probablemente dos funciones gemelas de empaquetado, no un God. Barato de arreglar si se confirma.

---

## 3. Ranking de complejidad — la lista de trabajo real

### 3.1 Por fichero (complejidad cognitiva de Sonar) — **re-medido el 17:27**

La columna Δ es contra el ranking del 08-06 19:22, que es el que este documento traía antes.

| Cogn. | Ciclom. | NCLOC | Δ | Fichero | Veredicto |
|---:|---:|---:|---:|---|---|
| **353** | 305 | 1 202 | −3 | `signer/app.py` | **Sigue siendo el peor del repo.** Ya auditado y con red (§5-F), pero **sin cortar** |
| 350 | 955 | 4 807 | = | `frontend/.../home/views/HomeView.vue` | God conocido, refactor a medias. **Intacto** |
| 290 | 607 | 3 972 | = | `frontend/.../tables/AdminTableManager.vue` | **Motor legítimo**, no God (§7) |
| 277 | 296 | 1 326 | **−29** | `backend/services/admin/templates/templateLifecycle.js` | La Fase C se nota, pero el fichero **crece en ncloc** |
| 262 | 477 | 2 727 | = | `frontend/.../firmas/FirmarPdf.vue` | **God real** (6 responsabilidades). Intacto |
| **241** | 168 | 391 | = | `backend/config/postgres.js` | **Densidad extrema**: 241 cogn. en 391 ncloc. **El único ⬜ puro del plan** |
| 204 | 335 | 1 172 | = | `backend/services/documents/DocumentSignatureWorkflowService.js` | God moderado |
| 192 | 273 | 894 | = | `backend/services/admin/crud/tableHooks.js` | Creado por el refactor, ya hotspot |
| **182** | 390 | 1 358 | **−155** | `backend/controllers/users/user_controler.js` | **La Fase D funcionó**: era God #2 en 337, hoy es un controller gordo |
| 172 | 257 | 517 | **+3** | `backend/services/admin/templates/workflows.js` | **Subió**: recibió las puras de la Fase C. Efecto esperado |
| 153 | 284 | 750 | = | `backend/services/admin/SqlAdminService.js` | Ver el aviso de abajo |
| 144 | 253 | 853 | = | `backend/controllers/sign/sign_controller.js` | **Viola CLAUDE.md** (motor batch en controller). Lo que queda de la Fase D |
| 140 | 541 | 850 | = | `frontend/.../home/composables/useDeliverableView.js` | Composable-monolito (§3.3). **No tocar** (§7) |
| 140 | 225 | 896 | = | `frontend/.../processes/useProcessDefinitionManager.js` | Composable-monolito (§3.3) |
| 139 | 318 | 1 123 | = | `frontend/.../modals/AdminDraftArtifactModal.vue` | Sus 51 de etiquetado se fueron con la Fase B; la complejidad sigue |
| 138 | 321 | 1 254 | = | `frontend/.../firmas/MultiSignerPanel.vue` | Sin tocar |
| 115 | 221 | 1 005 | **−38** | `frontend/.../admin/views/AdminView.vue` | **La fase 3.5 se nota** (§5-E.3): la URL manda y bajó un 25 % |
| 109 / 107 | 266 / 253 | 1 103 / 1 222 | nuevos | `ProcessGraphView.vue` / `UnitGraphView.vue` | **Entran en el radar.** Ojo: §7 dice explícitamente **no fusionarlos** |
| 100 | 112 | 377 | nuevo | `frontend/.../data/useAdminTableDataSource.js` | Entra en el radar |
| 97 | 120 | 299 | nuevo | `backend/controllers/users/dossier_controler.js` | **Controller con lógica dentro** — mismo olor que la Fase D |
| 95 | 71 | 360 | nuevo | `backend/services/admin/generation/documents.js` | Ciclomática 71 con cognitiva 95: muy anidado para su tamaño |

**Tres lecturas del nuevo ranking:**

1. **Los cuatro primeros no se han tocado nunca** (`app.py`, `HomeView`, `AdminTableManager`,
   `FirmarPdf`), y suman **1 255 puntos, el 15 % de toda la complejidad del repo**. Todo el trabajo de
   estos dos días ha ido a los puestos 4-11. La cabeza de la lista sigue intacta.
2. **`postgres.js` ha subido al 6.º puesto sin cambiar una línea** — los de arriba bajaron. Y sigue
   siendo, con diferencia, **el más denso: 0,62 puntos de complejidad por línea**, cuando `HomeView`
   está en 0,07. Es el objetivo más rentable por línea leída que queda en el backend.
3. **Aparecen cinco ficheros nuevos en el radar** que ningún documento había mirado nunca, dos de
   ellos backend (`dossier_controler.js`, `generation/documents.js`). No es que hayan empeorado: es que
   al bajar la marea se ven. `dossier_controler.js` con 97 en 299 ncloc es el mismo patrón que la
   Fase D acaba de arreglar en `user_controler.js`.

> **Corrección: `SqlAdminService.js` no está tan cerrado como decía §4.1.** Es verdad que sus dos
> `S3776` (CC 158 y CC 99) constan CLOSED/FIXED y que pasó de 5 924 a 914 L. Pero el **fichero**
> sigue acumulando **153 de complejidad cognitiva en 780 ncloc**, por encima de `sign_controller.js`,
> y conserva una función abierta de CC 36 (`list()`, §3.2). «God #1 cerrado» significa *dejó de ser un
> God*, no *dejó de ser complejo*. No es urgente, pero tampoco es terreno ganado del todo.

### 3.2 Por función (`S3776` abiertas, las 20 peores) — **re-medido el 17:27**

Esta es la cola de trabajo. Umbral de Sonar: 15. **67 abiertas** (60 JS + 7 Python). Líneas del
escaneo del 17:27: las de `templateLifecycle.js` y `FirmarPdf.vue` **se han desplazado** respecto a la
versión anterior de esta tabla, así que no cites las viejas.

| Cogn. | Función / ubicación | Δ |
|---:|---|---:|
| **76** | `templates/templateLifecycle.js:1252` → `saveTemplateArtifactDraft` | **−88** (Fase C) |
| **67** | `frontend/.../composables/forms/useAdminSubmitFlow.js:30` | = ← **la nueva segunda** |
| 59 / 49 | `backend/config/postgres.js:111` (`bindParams`) y `:47` (`translatePlaceholders`) | = |
| 44 | `frontend/.../firmas/FirmarPdf.vue:2488` → `confirmSign` | = |
| 44 | `frontend/.../ui/useAdminPresentationAdapters.js:94` | = |
| 40 | `signer/app.py:534` | = |
| 39 | `frontend/.../processes/useAdminDraftArtifactFlow.js:85` | = |
| 36 | `backend/services/admin/SqlAdminService.js:248` → `list()` | = |
| 33 | `backend/services/system/genericCatalog.js:376` · 33 `admin/generation/assignees.js:11` | = |
| 31 | `frontend/.../data/useAdminTableDataSource.js:222` | = |
| 30 | `signer/app.py:1001` · 30 `admin/generation/documents.js:210` | = |
| 28 | `frontend/src/core/router/index.js:84` · 28 `admin/templates/workflows.js:460` | = |
| 26 | `backend/services/admin/processes/processDefinitionVersion.js:457` | nueva en la lista |
| 25 | `frontend/.../perfil/AgregarInvestigacion.vue:492` · 25 `useAdminModalRegistry.js:77` | nuevas en la lista |
| 25 | `backend/services/admin/crud/tableHooks.js:453` | nueva en la lista |
| ~~75~~ | ~~`user_controler.js:1834` → `createGeneralTask`~~ | ✅ **fuera de la cola** (Fase D) |

**Lo que cambia la estrategia:** `saveTemplateArtifactDraft` ya **no es el doble que la siguiente**.
Bajó de 164 a 76 y `createGeneralTask` (75) salió de la lista entera, así que hoy la cola arranca
**76 · 67 · 59 · 49 · 44**, que es una pendiente suave. Consecuencias prácticas:

- ~~**La segunda peor función del repo es de frontend** (`useAdminSubmitFlow.js`, CC 67) y **no tiene
  fase asignada**~~ → ✅ **CERRADA el 2026-08-08** como **Fase E-5** (§5-E.5). Era un hueco real del
  plan, detectado solo al re-medir: **67 → ~7-9**.
- **`postgres.js` aporta dos de las cinco peores** (59 + 49 = 108 puntos en dos funciones). Partirlas
  es, en puntos por hora, la mejor operación pendiente del backend.
- **Terminar la Fase C ya no es prioritario por tamaño.** Los 76 que quedan son el núcleo
  transaccional con su rollback, y §5-C explica por qué extraerlos **ya no es refactor**, es rediseñar
  la compensación de errores. Con la función fuera del podio, el argumento de «hazlo antes de que
  crezca» pierde fuerza frente a `postgres.js`.

La cabecera de `templateLifecycle.js:14` describía la función como «un metodo de 542 lineas»:
comprobar que la Fase C actualizó ese comentario, porque hoy son ~310.

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

> **El censo de marcas, medido el 2026-08-08 17:27 — son 28, no 3, ni 4, ni 6, ni 25.** Este
> documento llegó a dar cinco cifras distintas en cinco sitios (§5-A decía «4 — 3 hoy», §5-G decía
> «de 4 a 25», aquí decía «7 — 6 hoy») porque cada sección contaba un subconjunto y ninguna lo decía.
> **Esta tabla es la única fuente**; el resto del documento remite aquí.

| Nº | Regla | Resolución | Ubicación |
|---:|---|---|---|
| 23 | `javascript:S1135` | FALSE-POSITIVE | Repartidas por todo el repo — la palabra española «todo» (§5-G). **Eran 21 cuando se escribió esa fase: han crecido 2** |
| 3 | `javascript:S6418` | WONTFIX | `crud/tableHooks.js:111` ← **movido, y sobrevivió** · `SystemBootstrapService.js:26` · `utils/tokenGenerator.js:4` |
| 1 | `Web:InputWithoutLabelCheck` | FALSE-POSITIVE | `forms/AdminSelectField.vue` (Fase B) |
| 1 | `Web:MouseEventWithoutKeyboardEquivalentCheck` | FALSE-POSITIVE | `layouts/workspace/AppWorkspaceShell.vue` (Fase B) |
| ~~3~~ | ~~`S2871`~~ | ~~FALSE-POSITIVE~~ | ~~`tests/characterization/lib/`~~ — **ya no figuran**: la Fase A convirtió esos ficheros en tests y sus incidencias dejaron de existir |
| ~~1~~ | ~~`S6418`~~ | ~~WONTFIX~~ | ~~`backend/scripts/seed_pucese.mjs:256`~~ — cerrada por eliminación del fichero (`fc44559`) |

**Detalle que hay que retener sobre los `S2871`:** §7 sigue diciendo, con razón, que «arreglarlos»
rompería los golden-master. Pero **la marca ya no existe** — desapareció sola al declarar los tests en
la Fase A, no porque nadie la quitara. Si algún día se vuelve a analizar `backend/tests` como
producción, esas 3 **reaparecerán sin marcar**. No es un problema hoy; es una trampa para el futuro.

Sonar rastrea la incidencia por el **hash del contenido de la línea**, no por la ruta: un *rename*
puro la conserva. Lo que la pierde es **reescribir la línea marcada**. La regla correcta no es «no
sobreviven a moverse», es **«no sobreviven a reescribirse»** — que es lo que pasó en el cut #8, donde
la línea sí cambió. (§6 regla 8 corregida.) El re-escaneo del 17:27 lo vuelve a confirmar: las marcas
sobrevivieron a dos días de refactor intenso.

**R2 — «el reempaquetado vuelve incomparable la medición».** Falso. `new_violations` pasó de 172 a
**176** (+4), no se disparó, y el New Code sigue anclado al 2026-07-09. El blame de git sigue los
renames, así que el código movido **no** entra como código nuevo. No hay que bumpear
`sonar.projectVersion` para limpiar nada.

---

## 5. Plan por fases

> ### ⚠️ Antes de nada: las letras no significan nada
>
> Las fases se llaman A, B, C… **por el orden en que se descubrieron**, no por prioridad, ni por
> dependencia, ni por tema. La letra no te dice de qué trata la fase ni si está hecha. Es un defecto
> de este documento, heredado de haber crecido a trozos. **Usa siempre el nombre, no la letra**, y si
> escribes una fase nueva, ponle nombre antes que letra.

### 5.0 Mapa de fases — qué es cada una y cómo va

| Fase | En una frase | Estado |
|---|---|---|
| **A · Arreglar el instrumento** | Sonar medía mal: los tests contaban como código de producción y no había cobertura enchufada. Sin esto, cualquier mejora es inmedible | ✅ **Hecha** |
| **B · Etiquetado de formularios** | 289 incidencias de accesibilidad (`label` sin control asociado). Eran el 35 % del backlog y **la nota entera de fiabilidad** | ✅ **Hecha** — C → A, cero bugs |
| **C · Partir `saveTemplateArtifactDraft`** | La peor función del backend: 563 líneas que crecían solas con cada cambio | ✅ **Hecha** — 164 → **21**; ya no es la peor del repo |
| **D · Controllers → servicios** | Lógica de negocio viviendo en la capa de transporte, contra la regla no negociable de CLAUDE.md | ✅ **Hecha (5 de 5)** — las dos de `user_controler` (08-07) y las tres de firma (08-09) |
| **E · Frontend** | Cinco deudas sueltas: estado mal repartido, sistema de diseño, la URL como fuente de verdad, `httpClient`, y la 2.ª peor función del repo | 🟡 **4 de 5** — falta solo colores/forks |
| **F · Los dos nunca auditados** | `signer/app.py` (el peor fichero del repo) y `postgres.js` (el más denso) | ✅ **Los dos** — `postgres.js` 108 → 15, y el corte de identidad del signer 142 → 84 |
| **G · Barridos mecánicos** | Imports sin usar, `replace`→`replaceAll`, y 21 falsos `TODO` | ✅ **Hecha** — y lo que sobró **no es barrido**: pide criterio uno a uno |
| **H · La nota D de seguridad** | 34 incidencias sin triar, y una sola CRITICAL fijando la nota | ✅ **Hecha** — seguridad **D → C** |
| **I · Residuos de la migración** | SQL de MySQL vivo en PostgreSQL: cuatro `UPDATE … JOIN` que reventaban al ejecutarse | ✅ **Hecha** — incluía **una función rota para todos los usuarios** |

**Fuera de este documento**, porque es otro problema: la **cobertura** tiene su propio plan ejecutable
en `docs/plan-cobertura-2026-08.md`.

#### Lo único que queda pendiente, en orden

1. ~~**Fase D** — las tres de firma~~ ✅ hecha el 08-09. `sign_controller.js` baja de **853 a 263
   ncloc**; nacen `PdfSigningService`, `BatchSigningService` y `FillRequestWorkflowService`.
2. ~~**Defectos que esa red destapó**~~ ✅ arreglados en el mismo corte: `requestSign` ya devuelve
   400/404 en la validación de entrada, la solicitud sin responsable pasa de 500 a **409**, y el
   `fileFilter` de multer deja de soltar el stack trace (JSON `{ message, code }` vía
   `middlewares/uploadError.js`). Quedan vivos, congelados, los defectos 2 y 4 de
   `zzzz_sign_workflow` (approve sin PDF sale 500; una solicitud manual sin responsable se la queda
   quien la inicie).
3. ~~**Fase F** — el corte de identidad del signer~~ ✅ hecho el 08-09. Queda solo el **traslado** de ese bloque a `signer/certificates.py` (F4 de la auditoría), que ya es mecánico.
4. ~~**Fase C** — el núcleo transaccional~~ ✅ cerrada el 08-09 con Command. Queda `_resolveDraftRequest` en 25, y **no** se toca: el orden de sus guardas es contrato.
5. **Fase E** — los colores, que van detrás de limpiar los forks. (`httpClient` ✅ cerrado el 08-09.)

Lo demás del backlog (48 ternarios anidados, 28 regex, 33 de contraste) **no está asignado a ninguna
fase a propósito**: son decisiones de una en una y no compensan como campaña.

---

Ordenado por retorno sobre esfuerzo, no por gravedad. Las fases A y B eran baratas y desbloqueaban la
medición; el resto no se podía medir bien sin ellas.

> ### Qué toca ahora — reordenado con la medición del 2026-08-08 17:27
>
> Con A, B y G cerradas y C/D/E/F a medias, el orden por retorno **ya no es el que traía este
> documento**. Lo que la medición cambia:
>
> | # | Trabajo | Por qué ahora |
> |---|---|---|
> | 1 | **Fase H** — la línea de `SIGNER_WORKSPACE_DIR` (§5-H) | Una línea de compose mueve la **seguridad de D a C**. Es el único punto del plan donde un cambio trivial mueve una nota |
> | 2 | ~~**H4** — Sonar en CI~~ → **decisión de infraestructura, no de código** (§1.2) | El workflow ya está escrito y verificado, pero **el SonarQube es local y ningún runner lo alcanza**. Lo pendiente es publicar el servidor (con TLS y credenciales propias) o migrar a SonarCloud. No es trabajo de programación |
> | 3 | **Fase F — `postgres.js`** | El **único ⬜ puro**, intacto en 241 cogn./391 ncloc (**0,62 puntos por línea**, el triple que cualquier otro). Aporta **2 de las 5 peores funciones** (59 + 49). Mejor retorno del backend |
> | 4 | **Fase D** — las tres de firma | `sign_controller.js` sigue en 936 L con el motor de batch dentro: viola CLAUDE.md, y el patrón de corte ya está probado y documentado en la propia fase |
> | 5 | Los **10 `S2486`** (§2.2) | Única regla del backlog con olor a defecto latente, y son 10, no 400 |
> | — | **Fase C, el resto** | **Baja de prioridad**: ya no es el doble que nadie (§3.2), y lo que queda no es refactor sino rediseñar la compensación de errores |
>
> **Hueco del plan detectado al re-medir:** la **segunda peor función del repo** es
> `useAdminSubmitFlow.js:30` (CC 67) y **ninguna fase la cubre** — la Fase E habla de otras tres cosas.
> Hay que asignarla o decidir explícitamente que no se toca.

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
histórica de §2) y **las 28 marcas manuales vivas** — el censo completo y actualizado está en §4.4-R1,
que es la única fuente para ese número.

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

##### Y la redacción anterior a esa (el plan original de la fase)

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

### Fase C — `saveTemplateArtifactDraft` — ✅ **CERRADA (2026-08-09)**

> **Resultado final: CC 164 → 21 (−87 %).** Ya no es la peor función del repositorio ni está cerca:
> la peor hoy es `FirmarPdf.vue` con 44. La segunda pasada (08-09) la llevó de **76 a 21** extrayendo
> `_persistDraftEdit`, `_persistDraftCreation`, `_resolveDraftRequest` y `_writeDraftPackage`.
>
> **Cómo se desbloqueó lo que este plan daba por no-refactorizable.** §5-C decía, con razón, que el
> núcleo transaccional no se podía extraer sin **decidir antes quién posee la compensación**: cuatro
> variables (`createdId`, `uploadedToMinio`, `insertedDeliverableId`, `insertedLinkId`) compartidas
> entre el `try` y el `catch` porque no hay transacción. Es el olor **Temporary Field**.
>
> La respuesta fue **Command** (`docs/patrones-diseno-2026-08.md` §3.1): **cada paso registra su
> propio deshacer en cuanto tiene éxito**, y el `catch` solo desapila. Tres de las cuatro variables
> desaparecen —`createdId` se queda porque es el resultado, no compensación— y **dos invariantes
> pasan de "hay que acordarse" a "se cumplen solas"**:
>
> 1. Solo se deshace lo que **esta** llamada hizo: un `deliverable` REUSADO no registra nada, así que
>    es imposible borrarlo por error.
> 2. Se deshace en orden **inverso** al de creación —obligatorio, porque ninguna FK cascadea— por el
>    simple hecho de desapilar, en vez de por mantener a mano el orden del `catch`.
>
> **Y el `catch` traga el fallo al compensar a propósito**, para no tapar el error original, que es el
> que se relanza.
>
> **Prueba de que es refactor puro:** char **238/238 con los goldens byte a byte intactos** en las tres
> pasadas, incluidos los dos casos que existen justo para esto —«POST draft con proceso inexistente →
> falla y NO deja el deliverable huérfano» y «reintentar tras la creación fallida → el deliverable
> nace con su proceso dueño»—. Más 389 unitarios y `check:imports`.
>
> **Lo que NO cuadró, y conviene saberlo antes de repetir el método:** extraer `_resolveDraftRequest`
> llevó la función de **59 a 32**, pero el extraído se quedó en **25** — es decir, **la primera
> extracción apenas movió el total (59 → 57 repartido)**. Mejoró la legibilidad, no la métrica: esa
> ramificación es **inherente** (una cascada de guardas de admisión), no anidamiento duplicado. Lo que
> sí bajó el total fue separar responsabilidades de verdad (disco / base de datos / compensación).
>
> **Deuda que queda anotada:** `_resolveDraftRequest` sigue en **25**. Es una cascada de guardas y
> **el ORDEN de esas guardas es contrato** —está caracterizado y el frontend distingue los mensajes—,
> así que convertirla en tabla es tentador y arriesgado. Se deja como está, con el aviso escrito en el
> propio método.

<details><summary>Estado intermedio tras la primera pasada (2026-08-06), conservado</summary>

**CC 164 → 76 (−54 %), y de 563 a ~310 líneas.** Deja de ser el doble que la siguiente.

> **Corregido con la medición del 08-08 17:27:** este párrafo decía «hoy empata con `createGeneralTask`
> (75)», y eso ya no es cierto — la Fase D sacó `createGeneralTask` de la cola de `S3776` el mismo día.
> `saveTemplateArtifactDraft` **vuelve a ser la peor función del repo**, ahora por 9 puntos sobre
> `useAdminSubmitFlow.js` (67). Lo que cambia no es el orden sino la urgencia: la pendiente de la cola
> es hoy 76·67·59·49·44, sin escalón. Ver §3.2.

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

</details>

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

**Las tres filas de firma — ✅ HECHAS (2026-08-09).**

| | Antes | Después |
|---|---:|---:|
| `sign_controller.js` ncloc | 853 | **263** (−69 %) |
| `sign_controller.js` funciones | 34 | **8** (los 8 endpoints) |
| `sign_workflow_controller.js` ncloc | 225 | **27** |

Nacen tres servicios: `services/sign/PdfSigningService.js` (contexto de firma, plan de
almacenamiento, firma del PDF, evidencia de workflow y el guard de acceso a un documento firmado),
`services/sign/BatchSigningService.js` (ciclo de vida del job de lote, bucle `setImmediate` y ZIP) y
`services/documents/FillRequestWorkflowService.js` (la máquina de estados de `fill_requests`), con
**77 tests unitarios nuevos** junto a cada módulo.

El corte se hizo con la red puesta y en dos tiempos, y eso es lo que lo hace comprobable: el
refactor dejó los 238 goldens **idénticos**, y los 8 que se movieron después lo hicieron por los
FIXES, no por el traslado. Los defectos que la red había congelado a propósito:

| Defecto | Antes | Ahora | Golden que lo prueba |
|---|---|---|---|
| Validación de entrada de `requestSign` | 500 | **400** | `sign_sin_certificado`, `sign_sin_password`, `sign_sin_sello` |
| Certificado que no es tuyo / no existe | 500 | **404** | `sign_certificado_inexistente`, `batch_start_certificado_inexistente` |
| Solicitud de entrega sin responsable resoluble | 500 a cualquiera | **409** | `sin_responsable_usuario`, `sin_responsable_gestor` (renombrados desde `defecto_*`) |
| `fileFilter` de multer sin manejar | HTML + stack trace | **JSON `{ message, code }`** | `sign_mimetype_rechazado` |
| `statMinioObject` del certificado | mentía ("vuelve a cargar tus certificados") | mismo mensaje, **causa real en el log y en `details`** | — (sin golden: el bootstrap no siembra certificados) |
| `spawn("zip", …)` (`S4036`) | nombre corto | `/usr/bin/zip` | — |

Dos aprendizajes de método:

1. **Un fallo de infraestructura no puede heredar el `statusCode` del camino de negocio.** El catch
   del controller es `error.statusCode ?? 500`, y los errores de pool/MinIO/firmante se lanzan **sin**
   `statusCode` a propósito. Hay tests unitarios que lo fijan explícitamente (que la pool caída NO
   lleve `statusCode`), porque es justo lo que se rompió en `user_controler` y char no lo ve.
2. **`node --watch` no siempre recarga.** Durante el corte, el router quedó cargado a medias
   (`ReferenceError: badRequest is not defined`) y una tanda de char midió el backend viejo. Antes de
   capturar goldens, `restart backend` y comprobar `Servidor iniciado`.

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
   >
   > **Los forks: ✅ CERRADOS el 2026-08-08 — y el diagnóstico de este plan era falso.**
   > `AdminModalShell` y `AdminDataTable` **no tenían consumidores: tenían cero.** Los 24 + 11 que
   > contaba este documento eran `grep` del *identificador*, no del import: los 35 ficheros hacían
   > `import AdminModalShell from "@/shared/components/modals/AppModalShell.vue"`. La unificación ya
   > había ocurrido en `e8fc739` (reorganización del frontend); lo que quedó fue el **fichero viejo
   > huérfano** y un **alias de import que mentía**. `git log -S` sobre la ruta del fork no devuelve
   > ni un commit. Lo hecho: borrados los dos ficheros muertos, renombrados los 35 alias a
   > `AppModalShell` / `AppDataTable`, y retirada la familia de selectores CSS **muerta** que sólo
   > ellos emitían (`.admin-dialog-*` en `theme.css` y `tailwind.css`, `.table-actions-scroll`
   > duplicada) — todos eran alias pegados al `.deasy-dialog-*` gemelo en la **misma** regla, así que
   > el borrado es demostrablemente cero-cambio visual (verificado en navegador: 0 elementos casan
   > los selectores retirados).
   >
   > **Queda un tercer fork, éste real: `modules/admin/components/ui/AdminButton.vue`** — 1 consumidor
   > (`perfil/components/DossierDocumentActions.vue`) y divergencia de comportamiento frente a
   > `AppButton`: no pinta el icono de `variant="close"`, no tiene las variantes `soft*`, y aplica
   > clase de tamaño **también** con `icon-only` (`AppButton` no). Es el único emisor vivo de la
   > familia de alias `admin-btn--*`, así que el CSS de botones no se puede colapsar hasta cerrarlo.
   > Swap no trivial: cambia el padding de 6 botones del dossier.
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

   > ✅ **HECHO el 2026-08-09.** Hoy `axios` se importa en **un solo sitio de producción**
   > (`httpClient.js`), que es una instancia propia de `axios.create()` con su interceptor; los **30
   > consumidores** importan el cliente. Ya no hay orden de carga del que depender: quien importe
   > axios a pelo se queda sin token y falla **en claro** (401) en vez de funcionar por suerte, y hay
   > un test que lo fija.
   >
   > **Lo que hizo segura la migración mecánica**, y conviene repetir antes de una así: se verificó
   > que **ningún fichero usaba estáticos de axios** (`isAxiosError`, `CancelToken`, `all`, `spread`,
   > `defaults`…). Importa porque **las instancias de `axios.create()` NO los llevan**: si alguno
   > estuviera en uso, la migración lo habría roto en silencio. El inventario real era solo
   > `get` (92), `post` (43), `put` (8) y `delete` (8).
   >
   > **`baseURL` se dejó SIN fijar, y es una decisión.** La base ya está centralizada en
   > `core/config/apiConfig.js` (`API_PREFIX`), y el 100 % de las llamadas pasan una URL absoluta
   > construida desde ahí. Un `baseURL` sería **inerte** (axios lo ignora con URL absoluta) y crearía
   > una segunda fuente de verdad.
   >
   > **Los dos `vi.mock("axios")` del repo hubo que ajustarlos**: el doble tenía forma del singleton y
   > el módulo ahora llama a `create()`, que el doble no tenía — sin eso, las dos suites morían **al
   > importar**, que es exactamente la regla 11 otra vez. Verde: **18 ficheros / 304 casos**, build OK,
   > y comprobado en navegador con gestor y admin que la cabecera `Authorization` viaja de verdad.
   >
   > **Deuda que queda:** 26 de los 30 ficheros migrados **no tienen red unitaria**; el cambio es de
   > una línea y homogéneo, pero tres no se pudieron ejercitar en navegador por exigir datos o
   > acciones destructivas (`FirmarPdf.vue`, `VerifyEmail.vue`, `SessionExpiryModal.vue`). Y falta la
   > barrera dura: una regla `no-restricted-imports` sobre `"axios"` en `frontend/eslint.config.cjs`,
   > con excepción para `httpClient.js`, que impida la recaída.
5. **`useAdminSubmitFlow` y los ids de formulario** — ✅ **HECHA (2026-08-08)**. *Fase que no existía:
   salió del re-escaneo, no del plan de julio.*
   - `submitForm`: **CC 67 → ~7-9**. Se extrajeron 12 helpers puros y 5 unidades con nombre
     (`runPreSaveGuards`, `persistForm`, `closeEditorAfterSave`, `runCreationFollowUps`,
     `handleSaveError`). Los cuatro bloques `{...payload, ...responseRow}` repetidos literalmente para
     persona/definición/proceso/periodo colapsan en una tabla `CREATED_ROW_BY_TABLE`.
   - **Red nueva de 38 casos escrita ANTES del corte** y verde después **sin editar ni uno**.
   - `SInput`/`SDate`/`SToggle` pasan de `Math.random().toString(36).substr(2,9)` al patrón `fieldId()`
     sobre `useId()` de la Fase B, con 15 casos que verifican que `label[for] === input[id]`, que el id
     **no cambia entre renders** (lo que el `computed` con `Math.random` sí hacía) y que dos instancias
     no colisionan. `SToggle` conserva la precedencia de `props.id`.

   > **Dos aprendizajes de método que valen para el resto del plan:**
   >
   > 1. **Montar dos veces con `mount()` NO detecta colisiones de id**: `useId()` reinicia su contador
   >    por aplicación y ambas instancias devuelven `v-0-input`. La colisión real —la que tenía
   >    `Math.random`— solo se reproduce montando las dos instancias **dentro del mismo árbol**.
   > 2. **SonarJS mide la complejidad de cada función SIN agregar las anidadas.** Comprobado
   >    calibrando una calculadora AST propia contra cuatro funciones de valor conocido de §3.2:
   >    `useAdminTableDataSource.js:222` da 36 propia y 59 con anidadas, y Sonar reporta 31. Útil para
   >    no perseguir un número que Sonar nunca va a contar.

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
  - ✅ **El corte de identidad, HECHO el 2026-08-09.** Bloque **142 → 84** puntos; fichero **355 → 297**.
    `extract_certificate_extensions` **40 → 2**, y con ella **desaparece el anidamiento máximo del
    repo** (era 14): hoy es un bucle de dos filas. Ninguna función del bloque pasa de 9.
    - El patrón es una tabla de filas `(reconoce, produce)` con un motor de 6 líneas. **Pero lo que
      quitó el bulto fue la duplicación que el patrón dejó ver**: el mismo bucle de acumulación
      escrito dos veces en `parse_distinguished_name_text`, dos `try/except` idénticos en
      `to_asn1_certificate`, ocho `if` consecutivos que eran un diccionario en
      `extract_name_attributes`, y `_DN_ALIASES` (26 entradas) reconstruyéndose en **cada llamada**.
    - **El `try` se dejó en cada productor, no en el motor**, para que un paso que hoy no tolera
      excepciones siga sin tolerarlas. Meterlo en el motor era más elegante y cambiaba comportamiento
      en silencio. Hay un test que lo fija.
    - Red: **229 → 266 casos**, ninguno existente modificado (0 líneas borradas), con certificados
      **reales** de las tres ACs ecuatorianas. Cobertura **85,6 → 89,4 %**. Más una prueba diferencial
      de un solo uso contra la implementación anterior: **778 comparaciones, 0 divergencias**.
    - **Lo que NO se tocó, con criterio:** `get_status_attr` **parece** duplicado de sus cuatro
      parientes pero usa `hasattr` (presencia) y se detiene en un atributo que existe valiendo `None`,
      mientras los otros usan «el primero no nulo». Unificarlos cambiaría comportamiento.
    - ⚠️ **Hallazgo nuevo, previo a este cambio y confirmado por el diferencial:** las dos fuentes de
      extensiones son **asimétricas**. Un certificado de `asn1crypto` —el que entrega pyHanko— no
      expone `.extensions`, así que corre la fuente 2; y **la fuente 2 no desenvuelve los `OtherName`
      del SAN**: vuelca el SAN entero en hexadecimal. Consecuencia práctica: **una AC que meta la
      cédula en un `OtherName` da `signerCedula = None` al validar un PDF.** Congelado en el test
      `AsimetriaEntreLasDosFuentes`, sin arreglar.
  - Sigue pendiente el **movimiento físico** a `signer/certificates.py` (F4 de la auditoría), ahora
    más fácil. Y **tocar la firma sigue bloqueado** hasta que exista una prueba que firme un PDF real
    y lo valide.
- **`backend/config/postgres.js`** — ✅ **HECHA (2026-08-08). 108 → 15 puntos de complejidad.**

  | Función | Antes | Después |
  |---|---:|---:|
  | `translatePlaceholders` (`:47`) | **49** | **0** — dos líneas |
  | `bindParams` (`:111`) | **59** | **~1** — seis líneas |
  | *(nueva)* `scanSql` | — | 5 |
  | *(nueva)* `findSpanEnd` | — | 6 |
  | *(nueva)* `expandParam` | — | 3 |

  **Ninguna supera el umbral de 15**, y la mayor es un 6. El fichero debería caer de 241 a ~148, con lo
  que deja de ser el más denso del repo. *(Cifras del «después» calculadas a mano con las reglas de
  `S3776`, no medidas: re-escanear con agentes trabajando en paralelo habría publicado un análisis con
  el árbol a medias.)*

  **La hipótesis del plan era correcta pero se quedaba corta.** No es que fueran «candidatas a tabla
  declarativa»: es que **las dos funciones eran el mismo autómata copiado palabra por palabra** —cinco
  banderas (`inSingle`/`inDouble`/`inBacktick`/`inLine`/`inBlock`) y diez ramas de `continue` cada una.
  Hoy las cinco banderas son cinco filas de `PROTECTED_SPANS` y un único `scanSql(sql, onPlaceholder)`
  recorre el SQL; las dos funciones se diferencian **solo en la lambda** que emite cada `?`. La
  duplicación era la causa de la mitad de la complejidad, y no estaba anotada en ningún sitio.

  **La red, que es lo que hace esto un refactor y no una apuesta:** `backend/config/postgres.test.js`,
  **60 casos** escritos y verdes **antes** de tocar el código y no modificados después, con entradas
  sacadas de consultas reales del repo (`IN (?)` de `RbacService`, `LIMIT ? OFFSET ?` de
  `SqlAdminService`, backticks, `<=>`, `ON DUPLICATE KEY`, casts `::`, `->>`). Además **fuzz diferencial
  contra una copia literal de la implementación original: 200 000 entradas, cero divergencias.**

  > **Seis rarezas congeladas, no arregladas** — están marcadas `RAREZA CONGELADA` en el test, para que
  > el día que se arreglen el diff del golden **sea** la prueba del arreglo. Dos merecen atención propia:
  >
  > - **`translatePlaceholders` es código muerto.** Cero llamadas en todo el repo (`FNDA:0` en el lcov);
  >   `runQuery` usa solo `bindParams`. Ya lo decía la auditoría de tests de julio. Se ha mantenido
  >   exportada porque borrar un export no es refactor — **bórrala en un commit aparte**.
  > - **Faltan parámetros → `undefined` silencioso, y es un bug latente real.**
  >   `bindParams("SELECT ?,?,?", [1])` produce `values: [1, undefined, undefined]`, y `pg` los manda
  >   como NULL: **la consulta no falla, ejecuta con NULLs**. Un error de programación se convierte en
  >   datos silenciosamente equivocados.
  >
  > Las otras cuatro: comentario de bloque sin cerrar deja `?` crudos; fila vacía en bulk insert genera
  > `VALUES ()`; solo se inspecciona el primer elemento para decidir si es bulk; y `/*/` cuenta como
  > bloque ya cerrado.

  **Corrección al encargo:** el módulo **sí** tenía test propio (`postgres.dialect.test.js`, 38 casos).
  Lo que no tenía cobertura era `translatePlaceholders`, que no se ejecutaba ni una vez.

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
> legible. Esto es lo que hace que las marcas manuales vivas sean hoy **28** (§4.4-R1) y **entra en §7**.
> Medido el 08-08: **son 23, no 21** — han aparecido 2 nuevas en dos días, exactamente por el motivo
> que predice el párrafo de abajo (comentarios nuevos en castellano con la palabra «todo»).
>
> Corrige lo que decía este plan: «23 `TODO` (triar: convertir en issue o borrar)». No hay nada que
> triar. Y explica de paso por qué `S1135` engorda en un repo con comentarios en español: cualquier
> comentario nuevo que use la palabra «todo» reaparecerá. Si molesta, se desactiva la regla en el
> perfil de calidad.

Lo que queda (`S3358`, `S7780`, `S8786`) **ya no es barrido**: son **92** incidencias (medido el 08-08)
que piden criterio una a una. Ver la tabla de arriba.

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

### Fase H — La nota D de seguridad — ✅ **TRIADA Y EJECUTADA (2026-08-08)**

> **Resultado.** La única CRITICAL está cerrada, 3 de los 4 `S4036` arreglados (el 4.º espera a que la
> Fase D libere `sign_controller.js`), los 6 `S2245` **arreglados en vez de marcados**, y 15
> incidencias marcadas como falso positivo con justificación escrita en Sonar. El diagnóstico de abajo
> se conserva porque es el que sostiene cada decisión.
>
> | Qué | Cómo se cerró |
> |---|---|
> | `python:S5443` (la CRITICAL) | Default de `SIGNER_WORKSPACE_DIR` movido a `/var/lib/deasy-signer/workspace` **en `app.py` Y en `compose.base.yml`**, dir creado en `docker/signer/Dockerfile` con dueño `appuser` y modo `0700`, y los dos `mkdir` del código pasan a `mode=0o700` |
> | 3 × `S4036` | `spawn("zip"/"unzip")` → ruta absoluta `/usr/bin/…`, y `unzip` declarado explícito en los Dockerfiles del backend (venía por herencia de la imagen base) |
> | 6 × `S2245` | Arreglados: `useId()` en `SInput`/`SDate`/`SToggle`, `randomUUID()` en `dossier_router` y `ChatAttachmentService`, secuencia monotónica en `MultiSignerPanel` |
> | 7 × `S5693` + 8 × `S2068` | Marcadas FALSE-POSITIVE con justificación (§7) |
>
> **Corrección a lo que decía este documento:** «se cierra con una línea de compose» era **inexacto**.
> Sonar analiza el **fuente**, así que el literal `/tmp/…` de `app.py:59` seguiría marcado por mucho
> que el compose lo sobreescriba. Hay que cambiar el default en el código *además* de fijarlo en el
> compose. Es un error de razonamiento que conviene no repetir con otras reglas de este tipo.
>
> **Y un hallazgo que el triaje inicial no vio: los `S4036` sí eran riesgo real, pero solo en producción.**
> El PATH de la imagen es todo `root:root` y no lo muta nadie, así que parecían inocuos. Pero el CMD de
> `docker/backend/Dockerfile` es **`npm run start`**, y npm antepone al PATH
> `/app/backend/node_modules/.bin`, que es `drwxr-xr-x node node` — **escribible por el mismo uid que
> corre el backend**. Es literalmente la precondición de la regla, y falla solo en la imagen de
> producción (en dev el CMD es `node --watch` directo, sin npm). No es una escalada por sí sola —
> requiere una primitiva de escritura previa— pero el arreglo costaba una línea.
>
> **Deuda abierta que deja esta fase, anotada para no perderla:**
> 1. `prod` tenía `tmpfs: - /tmp` en el signer, que **ya no cubre el workspace**: los PDF y el PKCS#12
>    desempaquetado pasan de RAM a la capa de escritura del contenedor (se siguen borrando al salir del
>    `with`). Volver a RAM exige `--mount type=tmpfs,tmpfs-mode=0700` con uid, porque la sintaxis corta
>    de `tmpfs:` no admite `uid`/`gid` y dejaría la raíz `root:root 1777` — justo el problema que esta
>    fase cierra.
> 2. Los Dockerfiles del backend **no se reconstruyeron** (había agentes usando el contenedor). El
>    `unzip` explícito está sin verificar por build: hace falta un `up -d --build backend`.
> 3. `createZipArchive` está **duplicado byte a byte** en `templateArchive.js` y
>    `user_controler.storage.js`, y casi igual en `sign_controller.js`. Es el 40,5 % de duplicación que
>    §2.3 señalaba. Unificarlo es trabajo de la Fase D, que ya toca el tercero.

#### El diagnóstico (conservado)

Es la única nota que no está en A y el único apartado que este plan arrastraba sin abrir («38
incidencias sin triar»). Ya está triado: **son 34, y ninguna es explotable tal como está desplegado**.
Pero la nota no depende del total.

> **La escala de seguridad de Sonar va por PEOR severidad, no por volumen:** A = 0 vulnerabilidades,
> B = ≥1 MINOR, C = ≥1 MAJOR, D = ≥1 CRITICAL, E = ≥1 BLOCKER. Con 34 incidencias repartidas en
> 1 CRITICAL + 22 MAJOR + 11 MINOR, **la D entera la fija una sola línea**. Cerrar las otras 33 no
> movería la nota ni un escalón.

**La única CRITICAL — `python:S5443`, `signer/app.py:59`.** Así estaba **antes** del arreglo (el código
de hoy usa `/var/lib/deasy-signer/workspace`; se cita el original porque es lo que explica el hallazgo):

```python
SIGNER_WORKSPACE_DIR = os.getenv("SIGNER_WORKSPACE_DIR", "/tmp/deasy-signer-workspace")
```

Verificado: **esa variable no está definida en ningún compose ni Dockerfile**, así que el valor por
defecto es el que corre en dev, qa y prod. Ahí es donde el firmante deja el PDF de entrada, el limpio,
el firmado y el PKCS#12 desempaquetado. Atenuante medido: los ficheros no caen sueltos en el
directorio raíz, sino dentro de `tempfile.TemporaryDirectory(dir=workspace_root)`
(`app.py:1190` y `:1262`), que crea el subdirectorio en modo `0700`. Lo expuesto es solo la **raíz**,
creada con `mkdir` y el umask por defecto, bajo un `/tmp` de escritura pública. En un contenedor de un
solo proceso el riesgo real es cercano a cero; en un host compartido sería una carrera de symlinks.

**Coste de cerrarla: una línea de compose** (`SIGNER_WORKSPACE_DIR=/var/lib/deasy-signer/workspace`,
con su volumen), o marcarla como aceptada con este párrafo como justificación. **Cualquiera de las dos
mueve la seguridad de D a C**, y es el mejor retorno por esfuerzo de todo el documento.

**El resto, agrupado por qué son de verdad:**

| Nº | Regla | Veredicto tras leer el código |
|---:|---|---|
| 8 | `S2068` contraseñas | **Son las credenciales demo documentadas**: `SystemBootstrapView.vue:389-397` (los 3 usuarios de ejemplo, contados x2 porque cada línea lleva `password` y `confirm_password`), `genericCatalog.js:283` (`DEMO_USER_PASSWORD`) y `generate_demo_certificates.mjs:26`. Reales y deliberadas — están hasta en CLAUDE.md. **Decisión pendiente**: sacarlas a variable de entorno con default, o marcarlas |
| 7 | `S5693` límite de tamaño | **Falsos positivos.** La regla no dice «falta límite», dice «revisa que el límite sea seguro» — y **los 7 declaran `limits.fileSize`** (10/30/50 MB). El único discutible es `chat_router.js:27`: **100 MB × 5 ficheros = 500 MB por petición** |
| 6 | `S2245` `Math.random` | **Falsos positivos de seguridad**, pero uno es deuda real: `SInput.vue:64` genera **ids del DOM** con `Math.random().toString(36).substr(2,9)` — justo lo que la Fase B sustituyó por `useId()` en todo lo demás, y con `substr` deprecado encima. Cambiarlo cierra la marca y alinea el componente |
| 4 | `python:S5332` AMQP | **Es el riesgo R-1 ya conocido** de `docs/auditoria-signer-2026-08.md`: la contraseña del PKCS#12 viaja en el cuerpo del mensaje por AMQP sin TLS. No es hallazgo nuevo; es el mismo, contado cuatro veces |
| 4 | `S4036` `PATH` en `execFile` | `kernel/storage.js:78`, `user_controler.storage.js:98`, `sign_controller.js:499`, `templateArchive.js:111`. **Piden lectura una a una** — es el único grupo del que no puedo afirmar que sea inocuo sin mirar cada invocación |
| 3 | `javascript:S5332` `http://` | Endpoints internos de la red Docker (`minio_service.js`, `rabbitmq_http.js`, `mailer.js`). Inocuos dentro del compose; **dejan de serlo si algún día MinIO sale de la red interna** |
| 1 | `S2612` permisos | `templateArchive.js:138` |

**Orden recomendado:** la CRITICAL primero (una línea, sube la nota), después los 4 `S4036` (los
únicos sin veredicto), y el resto es marcar con justificación. **No** «arreglar» los `S5693` ni los
`S2245`: los límites ya están puestos y `Math.random` para un id de DOM no es criptografía.

---

### Fase I — Residuos de la migración a PostgreSQL — ✅ **CUATRO SITIOS CORREGIDOS (2026-08-09)**

*Fase que no estaba en ningún plan. La destapó la red de caracterización de firma, no un escaneo.*

**`POST /sign/fill-requests/:id/return` estaba roto para todo el mundo.**
`DocumentProgressService.syncDocumentProgressFromFillRequest` ejecutaba un
`UPDATE fill_requests fr INNER JOIN fill_flow_steps ... SET ...`: sintaxis **multi-tabla de MySQL**
que PostgreSQL rechaza con `syntax error at or near "INNER"`. Respondía **500** y deshacía la
transacción entera — ni siquiera se guardaba el motivo de la devolución. Con flujos de un solo paso
la rama se toma **siempre**, así que devolver un entregable no funcionaba nunca.

**Y no era un caso aislado: eran CUATRO.** Un `grep` de una línea no los encuentra (el SQL es
multilínea, y por eso llevaban meses invisibles):

| Fichero | Qué hacía |
|---|---|
| `services/documents/DocumentProgressService.js:109` | Reactivar el paso al devolver — **el 500 confirmado** |
| `services/documents/DocumentWorkflowResetService.js:159` | Cancelar solicitudes de firma al resetear. **Es el fichero que CLAUDE.md pone de ejemplo de buen estilo** |
| `services/admin/templates/templateLifecycle.js:355` | Repuntar el enlace de plantilla de una configuración |
| `services/admin/org/taskAssignment.js:205` | Reconciliar responsables por puesto vigente |

**La conversión.** PostgreSQL usa `UPDATE … SET … FROM … WHERE`; la tabla que se actualiza **no se
repite** en el `FROM` y su condición de unión pasa al `WHERE`. Dos detalles que se escapan:

- **Las columnas del `SET` van SIN cualificar.** `SET fr.status = …` es error de sintaxis en PG,
  aunque `fr.` sí valga en la parte derecha (`COALESCE(sr.responded_at, NOW())`).
- **El `FROM` se evalúa contra los valores VIEJOS**, así que buscar por `ta.id = pdt.template_artifact_id`
  y reasignar esa misma columna es correcto y conserva la semántica de MySQL.

**Por qué no lo cazó nada hasta ahora, que es la lección de verdad:**

> **`node --check` no lo ve, `check:imports` no lo ve, y el backend arranca tan feliz.** Es SQL
> dentro de una cadena: **solo revienta cuando esa rama se ejecuta**. Es la misma familia que los
> cuatro `ReferenceError` que estuvieron vivos tres semanas (§6 regla 2), un escalón más abajo: ahí
> el símbolo faltaba en tiempo de llamada; aquí la sintaxis falla en tiempo de **consulta**. Ninguna
> herramienta estática del proyecto cubre este hueco — **solo una prueba que recorra esa rama**.
>
> **Cómo buscar los que queden**, porque `grep "UPDATE.*JOIN"` **no vale** (el SQL ocupa varias
> líneas): hay que escanear con una expresión multilínea sobre el fichero entero. Lo mismo aplica a
> `DELETE … JOIN`, que hoy no tiene ningún caso.

**Verificación en cuatro niveles**, porque la caracterización solo alcanza al primero:

1. `PREPARE` en psql de las cuatro consultas → sintaxis, tablas y columnas válidas.
2. Ejecución real de las otras tres dentro de una transacción **deshecha**: `UPDATE 1`, `UPDATE 2`,
   `UPDATE 0`. Afectan filas de verdad, no solo compilan.
3. **Caracterización: los dos goldens del defecto ROMPIERON, y solo esos dos** (236 de 238 seguían
   verdes). Ese diff **es** la prueba del arreglo, según §6 regla 3. Reescritos a `return_ok` /
   `return_efecto` (200, `status: returned`, `flowStatus: pending`, motivo guardado) y **eliminadas
   las claves huérfanas** — un golden que ya no comprueba nadie es ruido.
4. `check:imports` OK y 312/312 unitarios.

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
  `S2871` en particular rompería los golden-master — aunque **su marca ya no figura**, porque la Fase A
  convirtió esos ficheros en tests (§4.4-R1). El censo real de marcas vivas, **28**, está en §4.4-R1 y
  es la única fuente para ese número.
- **`S5693` (límite de tamaño de subida) y `S2245` (`Math.random`)**: verificado en §5-H que los 7
  límites existen y que los `Math.random` generan ids de DOM, no secretos. **Marcar, no "arreglar"** —
  salvo `SInput.vue:64`, que sí conviene pasar a `useId()` por coherencia con la Fase B.
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
| `docs/patrones-diseno-2026-08.md` | **Vivo — criterio de diseño.** Dónde un patrón GoF se gana el sueldo en este repo (son **tres**) y, sobre todo, dónde NO. Con la evidencia medida de que aquí la complejidad se cura con tablas y extracción, no con jerarquías. Léelo antes de proponer un patrón |
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
# Requiere un token (ver §1.1): el basic auth con contraseña ya no vale, pero el login de sesión SÍ,
# y con él se emite un token sin abrir la UI. Receta de arranque en frío en §1.1.
S="curl -s -H \"Authorization: Bearer $SONAR_TOKEN\" http://localhost:9002"

# REGENERAR LA COBERTURA ANTES DE ESCANEAR, o Sonar lee la de la corrida anterior sin quejarse (§5-A.2)
bash scripts/docker-env.sh dev exec -T backend  npm run test:unit:coverage
bash scripts/docker-env.sh dev exec -T frontend pnpm run test:unit:coverage

# re-escanear (~1,5 min)
SONAR_TOKEN=$TOKEN bash scripts/sonar/scan.sh

# el escaneo devuelve un id de tarea: el servidor la PROCESA después de subirla, así que consultar
# las métricas inmediatamente devuelve las viejas. Esperar a SUCCESS antes de medir:
$S/api/ce/task?id=<task-id-que-imprime-el-escáner>

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
