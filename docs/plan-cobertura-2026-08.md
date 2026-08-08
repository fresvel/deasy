# Plan de cobertura — agosto 2026

> **Documento ejecutable.** Escrito para que una sesión nueva pueda arrancar sin contexto previo.
> Complementa a `docs/plan-calidad-2026-08.md`, que es el documento maestro de calidad; este solo
> trata cobertura. Si hay conflicto, manda el maestro.
>
> **Medición de partida:** SonarQube en `:9002`, análisis del **2026-08-08**, rama `develop`.
> **Cobertura global: 14,0 %.** El Quality Gate está en ERROR por `new_coverage` **34,9 %** contra un
> umbral del 80 %.

---

## 0. Lo que hay que entender antes de escribir un solo test

Cuatro hechos medidos que cambian por completo la estrategia. Si se ignoran, se trabaja mucho y la
aguja no se mueve.

### 0.1 El gate NO pide 80 % global. Pide 80 % de lo NUEVO

`new_coverage` mide el **código nuevo** desde el New Code period (anclado al 2026-07-09). Llevar el
global del 14 % al 80 % es trabajo de años y **no es el objetivo**. El objetivo es:

> **Toda línea nueva nace con test.** Eso pone el gate en verde por sí solo, y el global sube como
> efecto secundario.

Todo lo que sigue es para reducir el riesgo del código que YA existe, que es un problema distinto y
sin fecha.

### 0.2 El signer tiene 229 pruebas y aporta CERO

`signer/tests/` tiene **229 casos** que ejercen 51 de 55 funciones, validados por mutación. Y
`signer/app.py` figura con **0,0 % sobre 884 líneas**, porque **nunca se conectó la cobertura de
Python**: `sonar.python.coverage.reportPaths` no existe en `sonar-project.properties`.

**Es la mejor relación resultado/esfuerzo de todo el plan y va primero** (Fase 0).

### 0.3 El agujero del frontend son los `.vue`, y perseguirlos es una trampa

| Tipo | Ficheros a 0 % | Líneas sin cubrir | % del hueco del frontend |
|---|---:|---:|---:|
| **Componentes `.vue`** | 116 | **12 304** | **67 %** |
| Composables | 30 | 3 925 | 21 % |
| Services | 14 | 855 | 5 % |
| Utils y config | 6 | 107 | <1 % |

Dos tercios del hueco son componentes, que necesitan `jsdom`, montaje y dobles de servicios: caros por
línea cubierta y frágiles. **Los composables son el objetivo bueno**: JavaScript plano, sin DOM, y es
donde vive la lógica de verdad.

> **Aviso que ya costó caro:** montar un componente arrastra su grafo de imports entero. `AdminView`
> arrastra `AdminTableManager` (~4 000 L) y `FirmarPdf` (pdfjs). Con `environment: node` eso da
> *Failed Suite* con **0 casos**, que **es un fallo, no un cero**. Fue lo que mantuvo 17 casos de
> `PerfilView` ocultos durante semanas. **Mira siempre la línea `Test Files`, no solo la de `Tests`.**

### 0.4 En el backend, Node solo instrumenta lo que algún test CARGA

`node --test --experimental-test-coverage` no tiene modo «todos los ficheros»: solo mide los módulos
que un test llega a importar (hoy 21 de 137). Los demás los pone a 0 % el *Zero Coverage Sensor* de
Sonar, que es lo correcto. Consecuencia práctica:

- La cobertura del backend **sube solo cuando un test nuevo importa un módulo nuevo**.
- `--test-coverage-include` **no** lo arregla: filtra los ya cargados, no añade.
- Si algún día hace falta cobertura honesta por fichero sin escribir tests, la respuesta es `c8`.

El frontend no tiene este sesgo: vitest va con `all: true`.

---

## 1. Punto de partida, por zona

| Zona | Ficheros | Líneas a cubrir | Cubiertas | % | Ficheros a 0 % |
|---|---:|---:|---:|---:|---:|
| **Backend** | 137 | 17 465 | 5 295 | **30,3 %** | 104 |
| **Frontend** | 200 | 18 475 | 714 | **3,9 %** | 166 |
| **Signer** | 4 | 884 | 0 | **0,0 %** | 4 |
| **Total** | 341 | 36 824 | 6 009 | — | 274 |

> La cobertura global que publica Sonar (**14,0 %**) no coincide con 6 009/36 824 porque su fórmula
> mezcla líneas y condiciones. Para medir progreso usa **siempre el número de Sonar**; las líneas de
> esta tabla sirven para repartir trabajo, no para presumir.

### 1.1 Ranking de riesgo — complejidad cognitiva × líneas sin cubrir

Lo que más duele si se rompe y nadie se entera:

| Cogn. | Sin cubrir | Fichero |
|---:|---:|---|
| 350 | 1 920 | `frontend/.../home/views/HomeView.vue` |
| 290 | 1 371 | `frontend/.../tables/AdminTableManager.vue` |
| 262 | 1 351 | `frontend/.../firmas/FirmarPdf.vue` |
| 353 | 777 | `signer/app.py` ← **ya tiene red; solo falta conectarla** |
| 204 | 1 138 | `backend/services/documents/DocumentSignatureWorkflowService.js` |
| 277 | 596 | `backend/services/admin/templates/templateLifecycle.js` |
| 182 | 642 | `backend/controllers/users/user_controler.js` |
| 192 | 426 | `backend/services/admin/crud/tableHooks.js` |
| 140 | 502 | `frontend/.../processes/useProcessDefinitionManager.js` |
| 140 | 459 | `frontend/.../home/composables/useDeliverableView.js` |

---

## 2. Reglas de ejecución — NO negociables

Vienen de fallos reales de este repositorio. Romperlas cuesta más que el trabajo que ahorran.

1. **Dónde va cada test** (ver `CLAUDE.md`): unitarios **junto al módulo**, sufijo `*.test.js`
   (`.test.mjs` si el módulo es ESM `.mjs`). **`*.spec.js` está prohibido** — no hay ni uno en el repo.
2. **Los globs del backend están DUPLICADOS.** `backend/package.json` tiene la misma lista en
   `test:unit` y en `test:unit:coverage` (la segunda con prefijo `backend/`, porque corre desde la
   raíz para que las rutas del lcov le valgan a Sonar). **Si amplías una, amplía la otra**, o el test
   corre pero no cuenta para la cobertura.
3. **Una suite que no arranca es un FALLO**, no «0 tests». Mira `Test Files`.
4. **Ningún agente ejecuta `test:char:run`**: resetea la base de dev. El trabajo de cobertura no lo
   necesita. Si hiciera falta, el derecho es exclusivo de un solo agente y hay que coordinarlo.
5. **Un test no cambia el código de producción.** Si para poder testear hay que refactorizar, eso es
   otro trabajo: anótalo, no lo mezcles. Excepción tolerada: extraer una función pura a un módulo
   hermano, y **solo** si la caracterización y los unitarios siguen verdes.
6. **Regenera AMBOS lcov antes de cada escaneo**, o Sonar leerá la cobertura de la corrida anterior
   sin quejarse:
   ```bash
   bash scripts/docker-env.sh dev exec -T backend  npm run test:unit:coverage
   bash scripts/docker-env.sh dev exec -T frontend pnpm run test:unit:coverage
   ```
7. **Todo dentro de los contenedores**, nunca `npm`/`npx`/`pytest` en el host.
8. **Tests que prueban comportamiento, no implementación.** Un test que solo repite el código que
   prueba sube el porcentaje y no protege de nada. Si no puedes escribir el caso de fallo que cazaría,
   el test no vale.

### 2.1 Acceso a SonarQube

**El basic auth con usuario/contraseña ya NO funciona** (401 con cualquiera) desde que se cambió la
contraseña de admin. Todo va por token:

```bash
curl -H "Authorization: Bearer $SONAR_TOKEN" "http://localhost:9002/api/measures/component?component=deasy&metricKeys=coverage"
SONAR_TOKEN=<token> bash scripts/sonar/scan.sh
```

Genera el token en *My Account → Security*. **`POST /api/user_tokens/generate` también exige estar
autenticado**, así que sin ningún token vivo hay que pasar por la interfaz.

SonarQube se cayó **tres veces** en la sesión del 2026-08-06/08. Si la API da *connection refused*:
```bash
docker compose -f scripts/sonar/compose.yml up -d
```

---

## 3. Fase 0 — Conectar la cobertura de Python (BLOQUEANTE, hazla primero)

Sin esto, cualquier medición de progreso del plan está mal, porque 884 líneas ya probadas cuentan como
cero.

**Qué hay:** 229 casos en `signer/tests/`, con `unittest` de la stdlib. La imagen **no trae**
`coverage`, pero **sí trae `pip`** (Python 3.14).

**Pasos:**
1. Añadir `coverage` a las dependencias del signer (`signer/requirements.txt` o el Dockerfile — mira
   cuál usa la imagen) y reconstruir.
2. Un script que genere el informe en formato **Cobertura XML**, que es el que lee Sonar:
   ```bash
   python -m coverage run -m unittest discover -s tests
   python -m coverage xml -o coverage.xml
   ```
3. **Las rutas del XML deben ser relativas a la RAÍZ DEL REPO** (`signer/app.py`, no `app.py`). Es el
   mismo problema que ya costó tiempo con los lcov: si no resuelven, **Sonar las descarta en silencio
   y la cobertura se queda en 0 sin avisar de nada**. Verifícalo mirando el XML antes de escanear.
4. `sonar-project.properties`: añadir `sonar.python.coverage.reportPaths=signer/coverage.xml`.
5. Añadir `signer/coverage.xml` y `.coverage` al `.gitignore`.

**Criterio de cierre:** `signer/app.py` deja de figurar a 0,0 % y la cobertura global sube.
**Si no sube, NO sigas con las demás fases**: significa que las rutas no resuelven.

---

## 4. Fase 1 — Cuatro agentes en paralelo, sobre conjuntos disjuntos

Ninguno necesita char ni base de datos, así que **no hay recurso compartido que serializar** — al
contrario que en el trabajo de refactor. Reparto por directorio para que no se pisen.

### Agente A — `backend/services/admin/**`

| Objetivo | Sin cubrir | Cogn. |
|---|---:|---:|
| `templates/templateLifecycle.js` | 596 | 277 |
| `crud/tableHooks.js` | 426 | 192 |
| `SqlAdminService.js` | 392 | 153 |
| `generation/documents.js` | 366 | 95 |
| `generation/assignees.js`, `processes/**`, `org/**`, `kernel/**` | resto | |

**Empieza por `kernel/`**, que son funciones puras sin pool ni ficheros y ya tiene tests que imitar
(`primitives.test.js`, `versioning.test.js`). Sigue por `generation/` y `templates/workflows.js`
(cabecera del propio fichero: *«funciones PURAS: no tocan base de datos ni sistema de ficheros»*).

Deja para el final lo que exige doble del pool. Modelo de doble: `GeneralTaskService.test.js` y
`UserMenuService.test.js`, creados el 2026-08-07.

### Agente B — `backend/services/**` EXCEPTO `admin/`

| Objetivo | Sin cubrir | Cogn. |
|---|---:|---:|
| `documents/DocumentSignatureWorkflowService.js` | **1 138** | 204 |
| `documents/**` resto, `users/**`, `storage/**`, `system/**`, `chat/**`, `realtime/**` | | |

`DocumentSignatureWorkflowService` es **el mayor hueco del backend** y ya está al 11,7 %: hay por
dónde agarrarlo.

### Agente C — Frontend: composables, services y utils. **CERO `.vue`**

| Objetivo | Ficheros | Sin cubrir |
|---|---:|---:|
| `frontend/src/**/composables/**` | 30 | 3 925 |
| `frontend/src/**/services/**` | 14 | 855 |
| `frontend/src/core/utils/**`, `frontend/src/shared/utils/**` | 6 | 107 |

**Es el mejor retorno del frontend.** Prohibido tocar `.vue` en esta fase: son la Fase 2 y solo si
compensa. Modelos a imitar: `useProcessPanels.test.js` (21 casos, del 2026-08-07),
`useWorkspaceChrome.test.js`, `homeView.helpers.test.js`.

`useDeliverableView.js` (459 sin cubrir) es **proyección read-only**, sin efectos: de los más fáciles
de la lista pese a su tamaño.

### Agente D — `backend/controllers/**`, `backend/utils/**`, `backend/config/**`, `backend/errors/**`

| Objetivo | Sin cubrir | Nota |
|---|---:|---|
| `controllers/users/user_controler.js` | 642 | Ya adelgazado: 1 513 L |
| `controllers/sign/sign_controller.js` | 373 | |
| `config/postgres.js` | 181 | Ya al 68,6 %, el mejor del backend |
| `utils/templateArchive.js` | 84 | **Puro. Empieza por aquí** |
| `utils/login/generate_token.js`, `utils/tokenGenerator.js` | 52 | Puros |

Los controllers son transporte: sus tests son sobre **códigos de estado y forma de la respuesta**, con
el servicio doblado. Hay un contrato escrito en `docs/contrato-errores-api.md` — **léelo antes**, y no
inventes contratos nuevos.

### 4.1 Qué se le pide a cada agente

- **No hacer commit.** Dejar los cambios en el working tree; integra quien orquesta.
- Dejar en verde: `pnpm run lint` (frontend), `npm run test:unit` (backend) y `npm run check:imports`.
- Reportar: líneas cubiertas ganadas por fichero, y **qué dejó sin cubrir y por qué**.
- **No perseguir el porcentaje.** Es preferible un módulo bien cubierto que cinco a medias.

---

## 5. Fase 2 — Componentes `.vue`, y solo los que compensen

**Solo después de la Fase 1**, y con una regla de entrada: un componente entra si tiene lógica propia
que no se pueda extraer a un composable. Si la lógica se puede extraer, **extraerla y testear el
composable sale más barato y deja mejor código**.

Candidatos, por riesgo: `HomeView.vue` (1 920), `AdminTableManager.vue` (1 371), `FirmarPdf.vue`
(1 351), `MultiSignerPanel.vue` (557), `AdminDraftArtifactModal.vue` (545).

Para montar un componente: pragma `// @vitest-environment jsdom` (el entorno por defecto es `node`) y
`vi.mock` de los hijos pesados. **El mock tiene que tener la FORMA del módulo real**: un
`vi.mock("axios")` sin `interceptors` mató la suite de `PerfilView` durante semanas.

---

## 6. Cómo medir el progreso

```bash
# 1. Regenerar AMBOS lcov (+ el XML del signer tras la Fase 0)
bash scripts/docker-env.sh dev exec -T backend  npm run test:unit:coverage
bash scripts/docker-env.sh dev exec -T frontend pnpm run test:unit:coverage

# 2. Escanear
SONAR_TOKEN=<token> bash scripts/sonar/scan.sh

# 3. Leer
curl -s -H "Authorization: Bearer $SONAR_TOKEN" \
  "http://localhost:9002/api/measures/component?component=deasy&metricKeys=coverage,lines_to_cover,uncovered_lines"
```

Cobertura por fichero, que es lo que sirve para repartir:
```bash
curl -s -H "Authorization: Bearer $SONAR_TOKEN" \
  "http://localhost:9002/api/measures/component_tree?component=deasy&metricKeys=coverage,uncovered_lines,cognitive_complexity&qualifiers=FIL&ps=500"
```

### Criterios de cierre

| Fase | Criterio |
|---|---|
| **0** | `signer/app.py` deja de estar a 0,0 % |
| **1** | Backend por encima del **50 %** y frontend por encima del **25 %** |
| **2** | Se abre solo si la 1 se cerró y sigue compensando |

Y el criterio que de verdad importa, que no es un porcentaje: **`new_coverage` por encima del 80 %**,
o sea que lo que se escriba de hoy en adelante venga con test. Es lo único que pone el gate en verde.

---

## 7. Lo que NO hay que hacer

- **No perseguir el 80 % global.** El gate no lo pide y es trabajo de años.
- **No escribir tests que repitan la implementación** para subir el número. Si no puedes describir el
  fallo que cazaría, no vale.
- **No tocar los goldens de caracterización.** Están en
  `backend/tests/characterization/__snapshots__/` y son de otro nivel de pruebas. Un cambio ahí
  durante trabajo de cobertura significa que algo se rompió.
- **No empezar por los `.vue`.** Es dos tercios del hueco y el peor retorno por hora.
- **No añadir dependencias sin comprobar que el contenedor las tiene.** El volumen de `node_modules`
  sombrea el de la imagen: en el frontend hay que instalar **dentro** del contenedor.
- **No usar `*.spec.js`.** Obliga a mantener un patrón muerto en la config de Sonar y en los globs.
