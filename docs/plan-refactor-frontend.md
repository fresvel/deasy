# Plan de refactor y reorganización del frontend

> Auditoría completa de `frontend/src` (122 `.vue` + 62 `.js`) realizada el **16-07-2026** sobre `develop` (`ac515a7`).
> Cada afirmación de este documento está respaldada por lectura directa del código y verificada de forma independiente.
> Los nombres de smells y técnicas siguen la nomenclatura canónica de refactoring.guru.

---

## 1. Resumen

El frontend **sí tiene** `layouts/` y **sí tiene** `views/` por módulo. El problema no es que falten: es que **ninguno de los dos hace su trabajo**.

- **`AppWorkspaceShell` es un layout falso.** Lo importan 4 views que se envuelven a sí mismas. No hay `<router-view>` dentro. El router tiene **12 rutas planas y cero `children`**.
- **Las páginas ya están en el router, pero mienten.** `/home`, `/home/documentos` y `/home/firmas` apuntan **al mismo componente de 5663 líneas**. En perfil hay **8 archivos `*View.vue` y sólo 1 enrutado**.
- **Consecuencia medible**: no hay deep-link, F5 devuelve al inicio, el botón atrás sale de la sección entera, y el estado se pierde al cambiar de pestaña.

### Correcciones a las hipótesis de partida

Tres suposiciones razonables resultaron **falsas** al comprobarlas. Importan porque cada una cambia el remedio:

| Hipótesis | Realidad | Efecto en el plan |
|---|---|---|
| "Sólo hay composables y components; faltan layouts y páginas" | `layouts/` (6 archivos) y `views/` existen; están mal **conectados**, no ausentes | No hay que crearlos: hay que **enchufarlos al router** |
| "`AdminTableManager` (4245 L) es un switch gigante por entidad" | **0 switch statements.** Es un motor genérico dirigido por metadatos (44 tablas vía `getMeta()`) con ~10 casos especiales injertados | **El motor es buen diseño y no se toca.** Extract Class de los injertos, no polimorfismo |
| "`ProcessManagementView` duplica los composables de procesos de admin" | No: los consume por composición. Lo que duplica es **el shell de `AdminView`** | El objetivo del refactor es otro |

---

## 2. Diagnóstico: por qué el refactor actual rinde poco

El refactor de `HomeView` lleva 12 commits disciplinados (Fase A helpers → B composables → C componentes) y bajó de **7271 a 5663 líneas: −22% en dos días**. El rendimiento decreciente no es casualidad.

**Se está curando con extracción de hojas un problema estructural.** `HomeView` no es un componente grande: son **tres páginas fusionadas**. Y la Fase B movió *líneas* sin mover *estado*:

| Composable | Líneas | Refs propios | Veredicto |
|---|---:|---:|---|
| `useDeliverableView.js` | 1062 | **0** | Middle Man con firma de composable |
| `useProcessPanels.js` | 155 | **0** | Middle Man |
| `useGeneralTask.js` | 184 | 4 | Mixto |
| `useFlowBuilder.js` | 129 | **6** | ✅ Composable real |
| `useRecipientSearch.js` | 46 | **3** | ✅ Composable real |
| `useDeliverableCollapse.js` | 56 | **1** | ✅ Composable real |

`useDeliverableView` tiene **1062 líneas y cero estado propio**: recibe 9 refs de HomeView y los muta. El propio código lo documenta con honestidad (`useDeliverableView.js:24-27`) — fue la decisión correcta para ese paso (53 call sites intactos), pero deja la deuda a medias. **El patrón bueno ya existe en el mismo módulo** (`useFlowBuilder`): se aplicó en 3 de 6.

El mismo patrón en admin: `useProcessDefinitionManager.js` recibe **54 parámetros** y devuelve **50 funciones**. Es *Extract Method sin Extract Class*. Y su vecino `useProcessWizard.js` (574 L, **0 parámetros**, posee su estado) demuestra que el equipo sabe hacerlo bien.

**La evidencia dura de que HomeView son tres páginas:**

- `/home/firmas` son **2 líneas de contenido** (`<template v-else-if>` + `<HomeSignatureEntry />`).
- `/home/documentos` son **93 líneas**. El resto — **93% del template** — es `/home`.
- Los **13 modales están fuera del `v-if` de ruta**: `<AppWorkspaceShell>` cierra en `:1020` y los modales arrancan en `:1022` como hermanos en la raíz. Son el **55% del template** y se instancian en las tres rutas, incluida `/home/firmas`, donde son inertes.
- Hay un `watch(route.fullPath)` (`:4428-4440`) que existe **sólo** para suplir el `onMounted` que no se re-dispara porque Vue reutiliza la instancia. Con páginas separadas, desaparece.
- El estado **se puede separar**: `/home/firmas` tiene acoplamiento **cero**. La única costura (`documentCenterItems`) ya se carga dos veces hoy, así que separar no cambia el comportamiento observable.

---

## 3. Hallazgos duros

### 3.1 Riesgo de seguridad / integridad — **prioridad máxima**

**La regla "no se puede borrar una configuración de proceso activa" vive únicamente en el frontend.**

```js
// AdminTableManager.vue:2310 — la única guardia que existe
const canDeleteProcessConfigurationRow = (row) =>
  canDeleteProcessConfiguration.value
  && String(row?.status || "").trim().toLowerCase() === "draft";
```

El backend tiene el guard escrito (`SqlAdminService.js:1185`, `ensureDraftDefinitionContext`) y lo aplica a **cuatro tablas hijas** (`process_definition_templates`, `process_target_rules`, `process_definition_period_types`, `signature_flow_templates`). **No lo aplica a `process_definition_versions`** — la configuración en sí. Ésa cae al `DELETE FROM ${tableName}` genérico de `SqlAdminService.js:5907` sin comprobar `status`.

**Alcance honesto**: no es un bypass de autenticación — el endpoint exige RBAC de admin. Es una **regla de integridad que sólo vive en el cliente**: quien llegue por API puede borrar una configuración *activa*, con procesos en curso referenciándola, pese a que la UI lo presenta como imposible.

Es la ilustración exacta de la regla del `CLAUDE.md` ("*keep business logic in services/models, never in the frontend*"): donde se cumple, el sistema aguanta; donde se saltó sin dejar nota, apareció el agujero.

### 3.2 Bugs confirmados

| Bug | Evidencia | Efecto |
|---|---|---|
| **`fieldsJson` no existe** | Aparece sólo en `FirmarPdf.vue:350` (template), nunca en el script | El panel "JSON Output" pinta vacío. Vue no avisa |
| **Sello fantasma pegado** | `isMouseOverPdf` en `MultiSignerPanel.vue` se declara (`:554`) y escribe (`:892`, `:933`) pero **nunca se lee**; `FirmarPdf.vue:302` sí lo usa en su `v-if` | El sello se queda pintado al sacar el ratón del PDF |
| **`searchTerm` se filtra entre tablas** | 0 menciones en `useAdminTableReset.js`; consumido en `useAdminTableDataSource.js:284`. Sus hermanos `vacantSearchTerm` (`:14`) y `unassignedTemplateArtifactSearch` (`:32`) **sí** se resetean | Buscas "juan" en Personas → cambias de pestaña → la tabla nueva se consulta filtrada por "juan" |
| **PDF al registro equivocado** | `recordId = list[list.length - 1]?._id` en `AgregarTitulo.vue:278` + **5 gemelos**: asume que el backend appendea al final | Si el backend ordena por fecha o alfabéticamente, el PDF se adjunta al registro equivocado, en silencio |
| **Ramas inalcanzables** | `AdminView.vue:1305,1316` ramifican sobre `managementSection`, meta que sólo existe en `/procesos` → que renderiza `ProcessManagementView` | Código muerto, vestigio de cuando AdminView servía `/procesos` |
| **Tarjeta "Orígenes" muerta** | `AdminView.vue:599-605`: sus 3 tablas no existen en el registro backend → `tableCount: 0`, pero el `v-for` no filtra por eso | La tarjeta se pinta y el clic no hace nada |
| **`exportPng` con selector global** | `UnitGraphView.vue:635` y `ProcessGraphView.vue:1098` hacen `document.querySelector` sobre la **misma clase** `.unit-graph-canvas` | Latente: hoy se excluyen mutuamente. Si se montan a la vez, el mapa de procesos exportaría el organigrama |
| **`isProcessTable` ≡ `isProcessesTable`** | `AdminTableManager.vue:1699` y `:1709` — mismo literal `"processes"`, dos nombres, ambos vivos | Confusión pura |

**El más instructivo es el del sello fantasma: nació de la duplicación.** Se copió el motor de PDF, luego se arregló una rama y la otra no. Es el argumento empírico de por qué unificar `usePdfCanvas` no es cosmética.

### 3.3 Duplicación medida (no estimada)

**Perfil — los 6 CRUD del dossier** son el mismo componente escrito seis veces. `diff` de líneas no vacías idénticas:

| Par | Idénticas | % del menor |
|---|---:|---:|
| Referencias ↔ Titulos | 181 | 68% |
| Laboral ↔ Referencias | 181 | 68% |
| Laboral ↔ Titulos | 178 | 67% |
| Certificacion ↔ Referencias | 174 | 67% |
| Investigacion ↔ Referencias | 102 | 37% ← la variación real |

`getDocumentBlob` es **byte-idéntica en las seis**. `openDocument` son 15 líneas × 6 que difieren **sólo en el string de fallback del nombre**.

**Y la solución ya está escrita al lado del problema.** `DossierService.js` contiene **tres pruebas** de que la parametrización funciona:

```
:212  async createInvestigacion(tipo, payload)     ← ya parametrizado
:244  async downloadDocument(tipo, documentoId)    ← ya parametrizado
:253  async deleteDocument(tipo, registroId)       ← ya parametrizado
```

…y al lado, **cinco quintetos escritos a mano** (`createTitulo`, `createExperiencia`, `createReferencia`, `createCertificacion`, `createCapacitacion` + sus 15 hermanos): **20 métodos que serían 4**. No es una propuesta en el vacío: es **terminar un patrón que el repo ya adoptó**.

**La copia ya se está pudriendo** — misma necesidad, soluciones divergentes:
- La validación de PDF ≤10 MB existe **sólo en `CapacitacionView.vue:296-306`**. Los otros cinco no validan nada.
- `CapacitacionView` usa `alert()`; los otros cinco fallan en silencio con `console.error`.
- `CapacitacionView` tiene un segundo modal de edición porque el `getElementById` del hijo encuentra el modal equivocado.

Ese último punto revela el acoplamiento invisible: **los 6 `Agregar*.vue` hacen `document.getElementById("<x>Modal")`** contra un id que declara el padre. Renombrar el id deja el modal imposible de cerrar, y **ningún linter ni test lo detecta**.

**Firmas** — `MultiSignerPanel` es un **fork** del motor PDF de `FirmarPdf`, no una descomposición: `renderPage`, `getViewerRect`, `toPdfUnits`/`toCssUnits`, la math del fantasma y la paginación están copiadas. Huella del copy-paste: `FirmarPdf` indenta su `<script setup>` a 2 espacios y `MultiSignerPanel` a 0. **Dos convenciones de formato en el mismo módulo.**

**Layouts** — las 4 views repiten ~14 líneas de props/handlers idénticos, el número mágico `window.innerWidth >= 1280` aparece **10 veces en 3 views**, y el mismo concepto tiene **tres nombres**: `vmenu`/`showMenu`/`menuOpen`.

### 3.4 El sistema de diseño está escrito pero no enchufado

| Categoría | Ocurrencias |
|---|---:|
| Utilidades de paleta crudas (`bg-<color>-<n>`) | **592** |
| Valores arbitrarios (`x-[...]`) | **424** |
| Hex crudos | **157** |
| `rgb()`/`rgba()` | **96** |

**Sólo 3 archivos de 144 usan un token `var(--deasy-*)`.** Y `.deasy-form-label` está definida en `tailwind.css:1337` como `@apply mb-1.5 block text-sm font-semibold text-slate-700` — **byte por byte** el string repetido 21 veces a mano.

Peor: `tailwind.css` tiene **dos `@layer components` que redefinen ~24 selectores en conflicto** (`.deasy-card` en `:329` y `:1349`; `.deasy-btn--primary` en `:570` y `:1381`, donde el gradiente muere). Y `--deasy-*` / `--brand-*` son **dos juegos de tokens redundantes** (`--deasy-primary` y `--brand-primary` son ambos `#5e4eff`).

> **La regla del `CLAUDE.md` no se incumple: no es aplicable.** Apunta a `frontend/src/styles/tailwind.css`, **que no existe** (es `shared/styles/`), ignora `theme.css` (1925 L, el 56% del CSS compartido) y lista `shared/services/`, **que tampoco existe**.

### 3.5 Forks de componentes compartidos

`AdminModalShell.vue` (118 L, 21 consumidores) es un fork de `AppModalShell.vue` (159 L, 31 consumidores). Igual `AdminDataTable` vs `AppDataTable`. La arqueología git lo explica: **el fork es el original**; `AppModalShell` se extrajo en `85653b0` y **el local nunca se borró**. La checklist que registraba lo pendiente se eliminó en `0419a90` — **se borró el rastro de la deuda, no la deuda**.

Peaje diario: `AppButton.vue:66-93` emite **las dos familias de clases en cada botón** (`deasy-btn--primary admin-btn--primary`). Toda variante nueva hay que escribirla dos veces.

### 3.6 La red de seguridad no existe

**2 archivos de test para 184 archivos fuente.** Vitest está instalado y hay script `test:unit`. Los dos tests que hay (`accessControl.test.js`, `homeView.helpers.test.js`) cubren utilidades puras — **cero tests sobre componentes, composables o vistas**.

La regla que no se negocia ("todos los tests existentes pasan al terminar") presupone que existen. **Aquí no.** Esto condiciona el orden del plan.

---

## 4. La propuesta

### 4.1 Layouts de ruta (la pieza que de verdad falta)

Hoy: `AppWorkspaceShell` es un componente que cada view importa y del que exige estado.
Debe ser: la **ruta padre** con `<router-view>` dentro, y las páginas sin saber que existe.

```js
{ path: "/", component: AuthLayout, children: [ login, register, recover, terminos, verify-email, setup ] },
{ path: "/home", component: WorkspaceLayout, children: [
    { path: "",           name: "home",            component: HomeDashboardView },
    { path: "documentos", name: "home-documents",  component: DocumentCenterView },
    { path: "firmas",     name: "home-signatures", component: SignatureCenterView },
]},
{ path: "/perfil", component: WorkspaceLayout, children: [
    { path: "",              name: "perfil",               component: ProfileHomePanel },
    { path: "titulos",       name: "perfil-titulos",       component: TitulosSection },
    { path: "experiencia",   name: "perfil-experiencia",   component: LaboralSection },
    // …6 más
]},
{ path: "/admin", component: WorkspaceLayout, meta: { requiresAdminAccess: true }, children: [
    { path: "",                        name: "admin-home",    component: AdminHomeIndex },
    { path: ":section",                name: "admin-section", component: AdminSectionIndex },
    { path: ":section/:item/:table?",  name: "admin-table",   component: AdminTablePage },
    { path: "academia/unidades/organigrama", name: "admin-org-graph",     component: UnitGraphView },
    { path: "gestiones/procesos/mapa",       name: "admin-process-graph", component: ProcessGraphView },
]},
```

**`AuthLayout` es el cambio de mejor relación beneficio/riesgo del informe**: el CSS ya existe (`tailwind.css:1209-1298`), sólo falta el componente. Absorbe las 6 copias del chrome y unifica de un plumazo los 4 paddings, los 4 espaciados de logo, los 2 radios de alerta y las 5 formas distintas de leer el mismo error de API.

### 4.2 Páginas que deben existir

| Página nueva | Hoy es | Justificación |
|---|---|---|
| `SignatureCenterView` | 2 líneas dentro de HomeView | **Acoplamiento cero.** Ya delega el 100% en `HomeSignatureEntry` |
| `DocumentCenterView` | 93 líneas dentro de HomeView | Estado propio; la costura ya se resuelve con doble carga que **ya ocurre hoy** |
| `HomeDashboardView` | 405 líneas dentro de HomeView | Lo que queda de `/home` |
| `/perfil/*` (7 páginas) | 7 `*View.vue` **no enrutados** | Deep-link, F5, botón atrás — hoy los tres rotos |
| `/admin/:section/:item/:table` | 7 refs booleanas paralelas | **`useAdminTableReset.js` (148 L) se borra entero** |
| Organigrama / Mapa de procesos | **Pseudo-tablas** con claves sentinela `"__unit_graph__"` | Son vistas fingiendo ser tablas porque no hay ruta |
| `/firmas/*` | Modo de pantalla completa sin ruta | `HomeView:3491` **ya reimplementa enrutamiento anidado con hashes y `scrollIntoView`** |

**Dos pruebas de que el router hace falta y ya se echó de menos:**
1. `HomeView.vue:3491-3511` hace `router.replace({name, hash})` + un watcher que scrollea al ancla. Es **enrutamiento anidado reimplementado a mano**.
2. `AdminView.vue:1305` ramifica sobre `route.meta.managementSection`, un hack para que `/procesos` (otro componente) empuje a AdminView a una sección.

**Matiz importante**: la firma **embebida** (`HomeView:1339,2025`) es legítimamente modal-sobre-contexto — firmas un entregable sin perder el dossier detrás. **Eso no debe volverse ruta.** Hay dos modos fusionados en un componente; sólo el modo *destino* necesita ruta propia.

### 4.3 Ganancias verificables

- **`useAdminTableReset.js` (148 L) desaparece.** Es un destructor escrito a mano que emula lo que `unmount` hace gratis. **El bug de `searchTerm` se cura por construcción**, no con un parche.
- **7 refs booleanas paralelas → 0.** Son `route.params`. Con ellas se van las ~20 asignaciones `= ""` manuales de `selectTable` y las 7 funciones `openXIndex`.
- **Los 13 modales dejan de montarse en `/home/firmas`.**
- **Lazy-loading por ruta gratis**: hoy los 37 componentes de `/admin` entran en el bundle aunque mires `roles`.
- **El `watch(route.fullPath)` de HomeView y las 9 guardas de `workspaceRouteMode` desaparecen.**

---

## 5. Plan por fases

> Regla de oro en todas: **pasos pequeños, el programa funcionando después de cada uno, y refactor y feature en commits distintos.**

### Fase 0 — Bugs y código muerto ✅ **COMPLETADA (16-07-2026)**

Fue primero porque era barato, algunos eran visibles al usuario, y **no debía mezclarse** con el refactor.

| # | Acción | Estado | Verificación |
|---|---|---|---|
| 0.1 | **Guard de backend** para `DELETE` de `process_definition_versions` (§3.1) | ✅ | E2E por API: borrar config `active` → **400** y fila intacta; borrar config `draft` → **200** y borrada |
| 0.2 | Resetear `searchTerm` en `useAdminTableReset.js` | ✅ | E2E en navegador: buscar "Carrera" en *Tipos de unidad* → saltar a *Tipos de relacion* → caja vacía y tabla sin filtrar |
| 0.3 | `fieldsJson`: panel de depuración borrado | ✅ | Nunca renderizó contenido (el computed no existía): sólo pintaba una caja negra vacía |
| 0.4 | `isMouseOverPdf` añadido al `v-if` de `MultiSignerPanel` | ✅ | Alineado con `FirmarPdf.vue:302` |
| 0.5 | Ramas `managementSection` de `AdminView` + duplicado `isProcessTable` borrados | ✅ | Arrastró `watch`, `useRoute` y `route`, que quedaban huérfanos |
| 0.6 | "Orígenes" y las 7 tablas fantasma | ✅ | Filtro genérico `tableCount > 0` en `buildIndexMenuItems` + 7 referencias muertas eliminadas. Verificado en navegador: la tarjeta desapareció, "Vacantes" y "Contratos" siguen operativas |
| 0.7 | `recordId = list[last]` → `createdId` del backend | ✅ | `addItem` ya devolvía `insertId`; el controller lo tiraba. E2E: crear título con PDF → `url_documento` = `…/titulo/6.pdf` sobre el registro 6 correcto |
| 0.8 | Rutas del `CLAUDE.md` corregidas (§3.4) | ✅ | |

**Validación**: `pnpm run lint` limpio · `pnpm run test:unit` 51/51 · consola del navegador sin errores · BD dev restaurada a su estado original.

**Notas de la ejecución** (cosas que cambiaron respecto al diagnóstico):
- **0.7 era un bug latente, no activo.** `loadTree` consulta con `ORDER BY id ASC`, así que `list[último]` acertaba *hoy*. El arreglo elimina el acoplamiento a ese `ORDER BY`, que era la bomba.
- **0.6 aplicó Extract Method antes del fix**: los 5 `*MenuItems` eran idénticos, así que se extrajo `buildIndexMenuItems()` y el filtro se escribió **una** vez en vez de cinco (adelanta parte de la Fase 4.5). `tableCount` era una propiedad que sólo se escribía y nunca se leía; ahora es la base del filtro.
- Se corrigieron además las descripciones de "Vacantes" y "Permisos", que prometían tablas que la UI no podía mostrar.
- **`actions`, `resources`, `aplications`, `offers` y los 3 `contract_origin*` siguen existiendo en la BD** y sin exponerse. Si alguna vez deben gestionarse desde el admin, basta con añadirlas a `sqlTables.js`. Ojo con `actions`/`resources`: son primitivas de RBAC y hacerlas editables a mano puede romper permisos.

### Fase 1 — Red de seguridad ✅ **COMPLETADA (16-07-2026)**

**Sin esto, todo lo demás era temerario** (§3.6). No hacía falta cobertura total: bastaban
**characterization tests** sobre lo que se va a mover.

**De 2 tests a 102** (4 ficheros, todos verdes):

| Fichero | Tests | Qué congela |
|---|---:|---|
| `core/router/index.test.js` | **37** | La tabla de 12 rutas (URL → nombre → componente) y los 7 comportamientos del guard: modo de instalación, sesión, `adminBlockedRouteNames`, permisos por `meta`, y logout |
| `modules/perfil/views/PerfilView.test.js` | **14** | El contrato `etiqueta → componente` de las 7 pestañas, su exclusión mutua, y que el estado **no** sobrevive al cambio de pestaña |
| `core/utils/accessControl.test.js` | 18 | *(ya existía)* |
| `modules/home/views/homeView.helpers.test.js` | 33 | *(ya existía)* |

**Infraestructura añadida**: `jsdom` + `@vue/test-utils` (dev). `environment` sigue en `node` por defecto
para no ralentizar los tests puros; los nuevos declaran `// @vitest-environment jsdom` por fichero.

**Los tests tienen dientes — verificado por mutación**, no por fe:

| Mutación introducida | Tests que la detectan |
|---|---:|
| Quitar `"home"` de `adminBlockedRouteNames` (fuga del admin al espacio de usuario) | 1 |
| `/home/documentos` apuntando a otro componente | 2 |
| Eliminar el guard `requiresAdminAccess` de `/admin` | 1 |
| Quitar la tilde a la etiqueta `'Formación'` del menú de perfil | **5** |
| `Experiencia` apuntando al componente equivocado | 2 |

**Hallazgos de la fase** (los tests corrigieron el diagnóstico):

- **El desajuste de etiquetas NO deja la sección en blanco: es un no-op silencioso.** `onmenuClick`
  (`PerfilView.vue:424`) recorre `mainmenu` y sólo asigna `process` si la etiqueta casa. Una etiqueta
  errónea emitida por `ProfileHomePanel` simplemente **se traga el clic**. La pantalla en blanco sí es
  posible, pero por el otro desajuste (`mainmenu` ↔ los `v-else-if`), y hay un test para cada lado.
- **`ProfileHomePanel` sólo existe dentro de la sección Inicio**, así que el único conductor de
  navegación siempre disponible es el menú lateral. No es trivia: condiciona cómo se prueba y
  desaparece al pasar a rutas hijas.

**Estos tests describen el router y las pestañas que HAY, no los que queremos.** Dos de ellos
(`las 12 rutas son planas: ninguna declara children` y el contrato de etiquetas de perfil) **deben
romperse** en las fases 2 y 3: son el marcador de que el refactor estructural ocurrió. Romperlos a
propósito y reescribirlos es la señal de éxito; romperlos sin darse cuenta es un bug.

> ⚠️ **Deuda conocida**: bajo vitest 4, jsdom expone `window.localStorage` como un objeto vacío sin
> métodos. Ambos ficheros instalan un stub propio de `localStorage` (documentado en el código). Si
> algún día se arregla la incompatibilidad, se pueden borrar.

### Fase 2 — Layouts de ruta

| # | Acción | Δ | Riesgo |
|---|---|---:|---|
| 2.1 | **`AuthLayout.vue`** + `useApiError()` | −250 L | **Bajo** — sólo template. *Empezar por aquí* |
| 2.2 | `WorkspaceLayout`: `AppWorkspaceShell` pasa a ruta padre con `<router-view>`; absorbe `menuOpen`, identidad y el `1280` | −150 L | Medio |
| 2.3 | Renombrar `S*` → `App*` (4 líneas: son internos a `layouts/`) y `SNotify`/`SMessage` | ~0 | Trivial |

### Fase 3 — Split de páginas

Por orden de riesgo creciente. **`/home/firmas` primero**: 2 líneas, cero estado compartido, valida el patrón de extremo a extremo.

| # | Acción | Riesgo |
|---|---|---|
| 3.1 | `/home/firmas` → `SignatureCenterView` | **Bajo** |
| 3.2 | `/home/documentos` → `DocumentCenterView` + `useDocumentCenter` | Bajo |
| 3.3 | `/home` → `HomeDashboardView`; **HomeView desaparece** | Medio |
| 3.4 | `/perfil/*` con `children` + rename `*View` → `*Section` (mismo commit: el archivo se toca igual) | Medio — ajustar `adminBlockedRouteNames` |
| 3.5 | `/admin`: los dos grafos primero (ya son lazy y autónomos), luego `:section/:item/:table` | Alto |
| 3.6 | Modales de HomeView → componentes (patrón `GeneralTaskModal`, ya probado) | Medio |

> ⚠️ **Fase 3.4 añade funcionalidad por eliminación** (el deep-link aparece solo). Ese matiz importa: es refactor **y** feature → commits separados.
> ⚠️ **Los grafos usan `defineAsyncComponent` deliberadamente** (`AdminTableManager.vue:1107`) para mantener Vue Flow + dagre fuera del bundle. Cualquier extracción **debe quedar dentro de esa frontera async**.

### Fase 4 — Colapsar duplicación

| # | Acción | Δ | Nota |
|---|---|---:|---|
| 4.1 | `AppFormModalLayout` con `@close` → **mata los 6 `getElementById`** | −60 L | **Antes que 4.2**, o las seis no convergen |
| 4.2 | `DossierSectionCrud.vue` + `useDossierSection(descriptor)`: 6 CRUD → 1 | **−1000 L** | `InvestigacionView` **el último** (es la variación real) |
| 4.3 | Colapsar los 5 quintetos de `DossierService` a `(tipo, …)` | −120 L | Patrón ya probado en `:212,:244,:253` |
| 4.4 | `useProcessDefinitionManager` → factory ×3 | **−700 L** | **Mejor ratio del módulo admin** |
| 4.5 | `AdminView`: los 5 bloques ×5 → un bucle sobre config | −400 L | Sin tocar el router |
| 4.6 | `usePdfCanvas()` + `useSignatureFieldPlacement()` | −? | **Mata el bug del fantasma en la raíz** |
| 4.7 | `<PersonForm>`, `<LocationPicker>`, `<PasswordStrengthMeter>` | −250 L | Saca ~125 L de `RegisterView` |
| 4.8 | Extraer fontanería Vue Flow (`useGraphExport`, `useGraphLayout`…) | −175 L/archivo | Mata el footgun del selector global |

### Fase 5 — Cerrar la deuda de composables

**El paso que de verdad baja el acoplamiento**, y el que más necesita la Fase 1 debajo.

*Move Field* sobre `useDeliverableView` (1062 L / 0 refs propios) y `useProcessPanels` (155 L / 0 refs propios): que el estado baje al composable. Modelo a imitar: `useFlowBuilder` y `useProcessWizard`.

### Fase X — Sistema de diseño (independiente y bloqueante)

**No migrar los 1269 hardcodes antes de esto**, o se re-codifica el conflicto en 1269 call sites.

1. Fusionar los dos `@layer components` de `tailwind.css` (~24 selectores en conflicto).
2. Colapsar `--deasy-*` / `--brand-*` en un solo juego.
3. Terminar la homologación de `85653b0`: borrar `AdminModalShell` / `AdminDataTable`, migrar sus 32 consumidores → elimina el doble emisor de clases de `AppButton:66-93`.
4. Sólo entonces, migrar módulos al sistema de tokens.

---

## 6. Lo que NO hay que tocar

Tan importante como el plan. Un patrón que parece un smell y no lo es:

- **El motor de metadatos de `AdminTableManager` es buen diseño.** `sqlTables.js` (44 tablas) + `getMeta()` + `props.table.fields` da CRUD gratis para 44 entidades sin una línea por entidad. **El problema son los injertos, no el motor.** `FK_TABLE_MAP` y `RELATED_RECORD_CONFIG` son ejemplares: el patrón a imitar.
- **`useProcessWizard` (574 L) es grande pero sano**: 0 params, posee su estado, helpers puros. **Tamaño ≠ smell.**
- **No fusionar los dos graph views**: 17,6% de similitud global. ~80% de cada uno es dominio irreducible. Extraer sólo la fontanería.
- **Los 4 nodos de grafo** son legítimamente componentes distintos; sólo su CSS/shell está duplicado.
- **La firma embebida es correctamente un modal**, no una ruta.
- **`accessControl.js:101-106` y `AdminTableManager.vue:1929` duplican reglas del backend — y son seguros**, porque se autodocumentan como espejos y uno tiene test. Son el modelo: **cada hallazgo grave de §3.1 es un sitio donde ocurrió la misma duplicación sin el comentario y sin el test.**

⚠️ **Deuda a marcar antes de que derive**: `useDeliverableView.js:361-393` transcribe a mano la máquina de estados de `sign_workflow_controller.js:119-141`. **Hoy coincide exactamente.** Son 1062 líneas sin comentario "ESPEJO" y sin test — el mayor riesgo de deriva silenciosa **precisamente porque hoy es correcto**.

---

## 7. Orden recomendado en una línea

**0 (bugs + guard de backend) → 1 (tests de caracterización) → 2.1 (`AuthLayout`) → 3.1 (`/home/firmas`) → 2.2 (`WorkspaceLayout`) → 3.2-3.4 → 4.1-4.2 (dossier) → 4.4 (admin) → 5 → X (diseño).**

Las tres primeras son baratas, de bajo riesgo y validan el patrón. El resto se apoya en ellas.
