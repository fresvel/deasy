# Plan de refactor y reorganización del frontend


> 📌 **Referencia del frontend — VIVA.** Su diagnóstico detallado sigue valiendo. El plan por fases
> revalidado (qué queda realmente pendiente) está en la fase E de
> **[`docs/plan-calidad-2026-08.md`](./plan-calidad-2026-08.md)**.
>
> ⚠️ Correcciones verificadas el 2026-08-06: la **fase 3.5 está hecha a medias** (la ruta ya es
> `/admin/:section?/:item?/:table?` y `useAdminTableReset.js` fue borrado, pero `AdminView` conserva
> `selectedTable`/`selectedSection` como refs locales); la **fase 5 redujo su alcance**
> (`useDeliverableView` NO entra: es proyección read-only, 0 asignaciones `.value =`); y
> `AdminModalShell` tiene hoy **24** consumidores, no 21.

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
| 2.1 | **`AuthLayout.vue`** + `resolveApiErrorMessage()` | ✅ **hecha** | Ver abajo |
| 2.2 | ~~`WorkspaceLayout` como ruta padre~~ → **`useWorkspaceChrome()`** | ✅ **hecha (parcial)** | Ver abajo |
| 2.3 | Renombrar `S*` → `App*` (4 líneas: son internos a `layouts/`) y `SNotify`/`SMessage` | ~0 | Trivial |

#### 2.2 — completada, pero **NO como estaba planeada** (16-07-2026)

**El plan estaba equivocado en dos cosas.** Al medirlo:

**(1) El `<router-view>` como ruta padre no es viable todavía.** Las **4 vistas usan los dos slots** del
shell, `#header` **y** `#sidebar` (el de `AdminView` son ~50 líneas). Un `<router-view />` dentro del slot
default **no puede rellenar los otros dos**. Hacerlo bien exige *named router views* → partir cada vista en
tres componentes → **eso es exactamente la fase 3**. Hacerlo antes obligaría a `provide`/`inject` o
`<Teleport>`, indirección peor que el problema.

→ **El layout de ruta se mueve a la fase 3**, donde el split de páginas lo hace natural. No es un
aplazamiento por pereza: es que 2.2 y 3 eran el mismo trabajo mirado desde dos sitios.

**(2) El boilerplate "×4 idéntico" era menos uniforme de lo que decía la auditoría.** Lo medido:

| Pieza | ¿Idéntica? |
|---|---|
| `menuOpen`/`showNotify` + toggles | Sí, salvo **tres nombres** (`vmenu`/`menuOpen`/`showMenu`) |
| Lógica del `1280` | Idéntica en admin/perfil/procesos. **Home la lleva en la cola** de su propio escalado |
| `handleHeaderToggle` | Idéntica en 3; perfil delega en `toggleVmenu` |
| `toggleNotify` | Idéntica en 3; **home limpia `showNavMenu` antes** |
| **Estado inicial del menú** | **3 abren en escritorio; procesos arranca SIEMPRE cerrado** |
| `userPhoto` / `userFullName` | **Varía de verdad**: procesos usa `computed`, el resto `ref`; perfil la necesita **mutable** (sube la foto); el fallback cambia ("Administrador" vs "Usuario") y procesos además cae al `email` |

**Entregado**: `shared/composables/useWorkspaceChrome.js` (+12 tests). Absorbe el estado del chrome, los
toggles y `revealSidebarForNav`. Aplicado a las 4 vistas.

**Sobre el `1280`, con precisión** (la auditoría contaba 10 apariciones en 3 ficheros y no todas eran lo
mismo). Se unificaron las de **inicialización del menú** y **handler de navegación**. Quedan 6, y sólo 2
son deuda:

| Sitio | Qué es | ¿Deuda? |
|---|---|---|
| `PerfilView:322,326` · `HomeView:2390,2415` | **Listener de resize** que sincroniza el menú al cambiar el viewport. **Duplicado entre ambas** | **Sí** — próximo objetivo natural del composable |
| `HomeView:2393` | Columnas de la rejilla (3/2/1). Mismo número, **otro concepto** | No |
| `AppWorkspaceSidebar:111` | Interno del shell | No |

**Lo que NO se unificó, y es deliberado**:

- **La identidad del usuario.** Parece duplicada ×4 y no lo es (ver tabla). Unificarla cambiaría
  comportamiento en tres vistas. Queda pendiente y necesita decisión de producto sobre el fallback.
- **`handlePrimaryNavInteraction` de `HomeView`**. Antepone su escalado propio (navegar a `/home`, cerrar
  el proceso abierto, cerrar paneles) y sólo después cae en la lógica común. Se expone la pieza
  compartida, no el handler entero: home la invoca al final del suyo.
- **El arranque cerrado de `procesos`.** Se preserva con `menuOpenByDefault: false`. Es 3 contra 1 y
  probablemente sea un descuido, **pero unificarlo es decisión de producto**, no de un refactor.

**Verificación — conducida en navegador, midiendo el DOM** (el menú es puro comportamiento; los tests
unitarios no lo prueban):

| Ruta | Ancho inicial del sidebar | Toggle | Nota |
|---|---:|---|---|
| `/admin` | **425 px** (abierto) | 425 → 81 → 425 ✅ | `revealSidebarForNav` en la sección activa: alterna ✅ |
| `/procesos` | **81 px** (cerrado) | 81 → 425 ✅ | Su divergencia, preservada |
| `/home` | 425 px | 425 → 81 → 425 ✅ | |
| `/perfil` | 425 px | 425 → 81 → 425 ✅ | Su listener de resize propio sigue vivo: 800 px → 282, 1600 px → 425 ✅ |

Consola sin errores en las cuatro.

#### 2.1 — completada (16-07-2026)

**`layouts/auth/AuthLayout.vue`** (3 props: `size`, `align`, `padded`) absorbe los tres niveles
`page > center > card` que repetían las vistas de auth. **Migradas 4 de 6**: `LoginView`,
`SystemBootstrapView`, `RecoverPasswordView`, `VerifyEmail`.

**`RegisterView` y `TermsView` NO se migraron, y es deliberado.** No comparten el patrón: montan su propio
centrado (`items-start`, `py-2 sm:py-6`, sin centrado vertical) **porque su contenido es alto y centrarlo
verticalmente lo empujaría fuera de pantalla**. Eso no era deriva: era criterio. Forzarlas dentro exigiría
props extra (`flex flex-col` en la tarjeta, padding vertical del centro…) y el layout empezaría a
parecerse a los modales de 33 props de admin — el olor que este plan denuncia en §3. Sí se migró su
lectura de error.

**`shared/utils/apiError.js`** — `resolveApiErrorMessage(error, fallback)`, con 11 tests. Sustituye las 5
lecturas manuales del error. **No es un composable** (no necesita reactividad): una función pura se
prueba mejor y se usa igual.

**Hallazgo que corrige §3.4 de este documento**: las 5 variantes de lectura del error **no eran
descuido**. El backend tiene **dos contratos de error incompatibles** y cada vista se había adaptado al
suyo:

```js
{ ok: false, error: "Código inválido o expirado" }                    // verify_email.js, reset_password.js
                                                                       //   -> el mensaje HUMANO va en `error`
{ success: false, message: "Error al…", error: "<stack>" }            // fail() de dossier_controler.js:123
                                                                       //   -> `error` es el detalle TÉCNICO
```

Por eso `VerifyEmail` leía `.error` primero: ahí *estaba* su mensaje. La precedencia `message → error`
cubre ambas formas sin mostrar nunca un stack. **El arreglo de fondo es unificar el contrato en el
backend**; mientras tanto la traducción vive en un sitio en vez de en cinco.

> 📄 **El problema es más grande de lo que se ve desde auth**: el censo completo dio **284 respuestas de
> error con 13 formas distintas**, y **113 sitios del frontend** que las leen a mano en 30 ficheros. El
> estado, el contrato objetivo y el plan de migración (que **no rompe nada** porque el helper ya actúa de
> amortiguador) están en **`docs/contrato-errores-api.md`**.

**Verificación — comparación de capturas contra golden master, no sólo "compila"**:

| Pantalla | Resultado |
|---|---|
| `/` (login) | **Idéntica píxel a píxel** |
| `/recover-password` | Difiere 1,04% dentro de la tarjeta: el padding normalizado (`p-8 sm:p-12` → `p-7 sm:p-10`). Cambio intencionado |
| `/verify-email` | Renderiza correcta (privada: requiere sesión para verla) |
| `/setup` | **No verificable en navegador**: el router redirige cuando `installationMode === "normal"`. Sólo compila + lint |

Además se ejercitó el error del login con credenciales incorrectas: sale "La contraseña es incorrecta"
(mensaje del backend), igual que antes.

> ⚠️ **Bug preexistente detectado, NO introducido por el refactor** (verificado contra la captura previa):
> en `/recover-password` y `/verify-email` el enlace "Volver al login" **se solapa con el logo**. No se
> arregla aquí para no mezclar un fix visual en un commit de refactor.

> ⚠️ **`LoginView` no delega su error entero en el helper**, a propósito: escala por código de estado y
> para 401/400 el texto por estado debe ganar a `error.message` — que axios **siempre** rellena con
> "Request failed with status code 401". Delegar sin más mostraría esa cadena técnica al usuario.

### Fase 3 — Split de páginas

Por orden de riesgo creciente. **`/home/firmas` primero**: 2 líneas, cero estado compartido, valida el patrón de extremo a extremo.

> **La fase 2.2 dejó aquí el layout de ruta.** `AppWorkspaceShell` no puede ser ruta padre hasta que las
> páginas se partan en header/sidebar/main, porque las 4 vistas usan los dos slots. Mientras tanto, cada
> página nueva se envuelve en el shell como hacen las existentes (es el patrón vigente) y usa
> `useWorkspaceChrome()`. El layout de ruta llega cuando haya suficientes páginas partidas para que los
> *named router views* valgan la pena.

| # | Acción | Riesgo |
|---|---|---|
| 3.1 | `/home/firmas` → `SignatureCenterView` | ✅ **hecha** |
| 3.2 | `/home/documentos` → `DocumentCenterView` | **Reestimada** — ver abajo |
| 3.3 | `/home` → `HomeDashboardView`; **HomeView desaparece** | Medio |
| 3.4 | `/perfil/*` con `children` + rename `*View` → `*Section` | ✅ **hecha** |
| 3.5 | `/admin` → `:section/:item/:table?`. **Reformulada** — ver abajo (3.5a–e ✅; split a children **descartado**) | Alto |
| 3.6 | Modales de HomeView → componentes (patrón `GeneralTaskModal`, ya probado) | Medio |

> ⚠️ **Fase 3.4 añade funcionalidad por eliminación** (el deep-link aparece solo). Ese matiz importa: es refactor **y** feature → commits separados.
> ⚠️ **Los grafos usan `defineAsyncComponent` deliberadamente** (`AdminTableManager.vue:1107`) para mantener Vue Flow + dagre fuera del bundle. Cualquier extracción **debe quedar dentro de esa frontera async**.

#### 3.5 — reformulada: el corte es la URL, no el componente

**El plan estaba equivocado en el mecanismo** (medido antes de tocar código; misma clase de corrección que 2.2/3.2).
Decía "los dos grafos primero, luego partir en páginas hijas". Al medir:

- El contenido principal de `AdminView` (`:175-346`) **lee estado local intrincado** (`selectedTable`, los 5 índices,
  `AdminTableManager` con ~10 props, sentinelas de grafo). Moverlo a una hija `<router-view>` dejando el estado en
  `AdminView` exigiría un `provide/inject` gigante — la indirección que la **Fase 2.2 rechazó**. El main y el estado
  **no** están desacoplados como sí lo estaban las secciones de `/perfil`.
- Los grafos **no están sueltos** en `AdminView`: se inyectan como claves sentinela (`__unit_graph__`) dentro de
  `AdminTableManager` vía `:active-sibling-tab` (`:336`). "Los grafos primero" **no** es el paso más barato.

→ **La costura correcta es la URL, no el split de componente.** Primero que el estado venga de `route.params`; el split
del componente (layout + páginas) cae solo después. Orden nuevo: **3.5a** URL⇄estado aditivo → **3.5b** `section` a
params + slugs bonitos → **3.5c** `selectedTable`/refs → `route.params` (muere `useAdminTableReset`) → **3.5d** grafos a
ruta propia → **3.5e** tests.

##### 3.5a — completada. **`/admin` tiene URLs.**

`/admin/:section?/:item?/:table?` (misma `AdminView`, sin children todavía). Paso **aditivo**: los 8 refs siguen siendo
la fuente de verdad; un `watch([selectedSection, selectedTable, activeItemKey])` **escribe** la URL con `router.push`
(idempotente contra `route.params`, así que la hidratación no duplica), y `hydrateFromRoute()` en `fetchMeta`
**reconstruye** el estado al cargar. El `watch` coalesce las mutaciones síncronas de un click en **una** entrada de
historial, así que el botón atrás recorre tabla → índice → inicio.

**Verificado en navegador** (admin `1234567890`): click Usuarios → `/admin/usuarios`; Personas →
`/admin/usuarios/personas/persons`; **F5 hidrata la tabla** (43 filas), no el home; **atrás** recorre
tabla→índice→inicio; deep-link directo a `/admin/procesos` abre el índice de Gestiones. Consola limpia, 218 tests verdes,
lint limpio. **No se borró ningún ref** (eso es 3.5c).

> ⚠️ **Deuda que deja 3.5a, a cerrar en pasos siguientes:**
> - **Grafo y firma no se serializan** (llegan en 3.5d): F5 sobre el organigrama recae en su tabla `units`. Interino conocido.
> - Sigue siendo **una sola ruta parametrizada**, no children: el marcador "rutas planas" **aún es cierto** y se invierte en 3.5c.

##### 3.5b — completada. **La URL usa nombres humanos.**

El `section` de la URL pasa de la clave interna al **slug** derivado de la etiqueta: `estructura_academico` → `academia`
y, la importante, `procesos` (la `key` de "Gestiones") → `gestiones`, que **elimina la colisión conceptual** con la ruta
hermana `/procesos`. `slugifySection(label)` genera el mapa `SECTION_SLUG_BY_KEY`/`SECTION_KEY_BY_SLUG` desde `GROUP_DEFS`
(no hay tabla a mano que se desincronice). El slug solo vive en la frontera de la URL: `syncAdminUrl` convierte key→slug al
escribir y `hydrateFromRoute` slug→key al leer; `selectedSection` sigue siendo la clave interna en todo el componente.
`item` y `table` ya eran legibles (`procesos`, `personas`, `units`…) y se quedan como están.

**Verificado en navegador**: Gestiones → `/admin/gestiones` (antes `/admin/procesos`); su sub-item → `/admin/gestiones/procesos/processes`
(slug de sección + item `procesos` conviven sin choque); F5 hidrata la tabla; deep-link directo a `/admin/academia` abre el
índice de Academia (conversión slug→key en hidratación). Consola limpia, lint limpio, 218 tests.

##### 3.5c — completada. **Muere `useAdminTableReset.js` (−148 L).**

**Descubrimiento que reformula el paso**: `App.vue:2` monta la vista con `<router-view :key="route.fullPath">`, así que
**la vista se remonta en CADA navegación** (verificado: `history.back()` client-side re-hidrata sin recarga). Dos consecuencias:

1. **La inversión "refs → `route.params`" que el plan pedía NO hace falta.** Con el remount, los 8 refs de `AdminView`
   **ya se re-derivan de la URL en cada montaje** vía `hydrateFromRoute`; nada persiste entre navegaciones. La URL **ya es**
   la fuente de verdad; los refs son solo copia de trabajo intra-montaje. Borrarlos sería cosmético y de riesgo alto → **no se
   hace** (misma disciplina de "medir y corregir el plan" de 2.2/3.2).
2. **`useAdminTableReset.js` (148 L) era redundante.** Era un `watch(() => props.table?.table)` que reseteaba a mano ~40 refs
   (searchTerm, filtros, opciones, modales) al cambiar de tabla. Pero cambiar de tabla **siempre** pasa por `router.push` →
   cambia `fullPath` → **remonta** `AdminTableManager` con el `setup` fresco (searchTerm=`""`, filtros vacíos, modales
   cerrados). El reset a mano emulaba lo que el remontaje da gratis. **El bug de `searchTerm` se cura por construcción.**

Se sustituyó por un `onMounted` en `AdminTableManager` que conserva **solo la carga inicial** del composable (opciones de
filtro según el tipo de tabla + `fetchRows`); el reset de estado lo da el remount. `AdminTableManager` **no tenía `onMounted`**:
la única carga inicial era el `immediate:true` del `watch` borrado, así que había que preservarla.

**Verificado en navegador**: `persons` (43 filas) y **`unit_positions` (48 filas + los 3 selects de filtro poblados** — la rama
`isPositionFilterTable` del `onMounted` corre); el toggle del **Organigrama** (caso in-place, sin remount) sigue renderizando el
canvas de Vue Flow; consola limpia. Lint limpio, **218 tests**. `AdminView` no llama a `AdminTableManager` de forma imperativa
(solo `ref=` en template), así que el remount por tabla es seguro.

> Queda para 3.5d: grafo/firma a ruta propia (serializar `graphTabActive`), y arreglar el selector global de
> `ProcessGraphView.vue:1098`. El marcador "rutas planas" sigue cierto (aún es una ruta parametrizada, no children).

##### 3.5d — grafos con URL propia (parte 1 de 2)

Los grafos se muestran **sobre** la tabla `units`/`processes` (con `force-graph`/`force-process-graph` dentro de
`AdminTableManager`), no como componentes sueltos. Ahora tienen su propio `:table`: **`organigrama`** (sobre `units`) y
**`mapa`** (sobre `processes`). `syncAdminUrl` serializa el flag de grafo a ese slug y `hydrateFromRoute` lo reconstruye
(`selectTable(units/processes)` + activar el flag). Se añadieron `graphTabActive`/`processGraphTabActive` a las fuentes del
`watch` para que activar/desactivar el grafo (caso in-place, sin cambio de tabla) actualice la URL.

**Verificado en navegador**: activar Organigrama → `/admin/academia/unidades/organigrama`; **F5 mantiene el grafo** (15 nodos,
canvas visible, **sin** tabla CRUD); Mapa de procesos → `/admin/gestiones/procesos/mapa`, F5 → 3 nodos. Consola limpia, lint
limpio, 218 tests. **La firma (`isSigningView`) NO se enruta** — es overlay modal sobre el contexto, por diseño (§4.2).

> Parte 2 de 2 (commit aparte, es un **fix de bug**, no enrutado): el footgun del selector global de `exportPng`.
> `UnitGraphView:635` y `ProcessGraphView:1098` hacen `document.querySelector(".unit-graph-canvas .vue-flow")` sobre la
> **misma clase** (ProcessGraph copió `unit-graph-canvas`). Hoy latente (nunca se montan a la vez), pero se acota cada
> `exportPng` a su propia raíz vía template ref.

##### 3.5d parte 2 — completada. **Muere el footgun del selector global.**

Cada `exportPng` consulta ahora dentro de su **propia raíz** (`ref="graphCanvas"`), no con `document.querySelector`.
`ProcessGraphView` renombra además su clase `unit-graph-canvas` → `process-graph-canvas` (era una copia). **Verificado en
navegador**: en `/organigrama` hay **un** `.unit-graph-canvas` que contiene su `.vue-flow`; en `/mapa`, `.process-graph-canvas`
contiene el suyo y **cero** `.unit-graph-canvas`. Lint limpio, 218 tests.

##### 3.5e — completada. **El contrato de URL de admin queda congelado.**

`core/router/index.test.js` (+7, **de 218 a 225**): los param-combos resuelven a `admin` con sus params
(`/admin/usuarios/personas/persons`, `/admin/academia/unidades/organigrama`, `/admin/gestiones/procesos/mapa`), el guard
`requiresAdminAccess` cubre **una sub-ruta parametrizada** (deep-link a una tabla admin no se cuela), y un marcador vigila que
`/admin` **siga siendo una ruta parametrizada, no children** (a invertir si algún día se hace el split). **Dientes verificados
por mutación**: revertir la ruta a `/admin` plana tumba exactamente los 5 casos del nuevo contrato, ni uno más.

#### Fase 3.5 — cierre

`/admin` pasó de ruta plana con 8 refs locales a `/admin/:section?/:item?/:table?` con deep-link, F5 y botón atrás, slugs
humanos, grafos enlazables y `useAdminTableReset` borrado. **El split a páginas hijas (layout + `router-view`) se descartó, no
se pospuso**: `App.vue` monta la vista con `:key="route.fullPath"`, así que la vista **ya se remonta e hidrata desde la URL en
cada navegación** — la URL es la fuente de verdad y los refs son copia de trabajo intra-montaje. Partir el componente sería
cosmético y de riesgo alto sin ganancia observable. Queda como deuda menor: los ~40 `= ""` de exclusión mutua de `selectTable`
(inofensivos; el remount los haría redundantes solo si se borraran los refs) y el ítem posicional con marcador `-`.

#### 3.1 — completada (16-07-2026)

**`modules/firmas/views/SignatureCenterView.vue`** sirve `/home/firmas`. El corte salió barato porque el
acoplamiento era **cero**: la pantalla ya delegaba el 100% en `HomeSignatureEntry`, y `homeSignatureItems`
—el estado de firmas de HomeView— lo lee el *dashboard*, no esa ruta.

Se llevó consigo la lista del aside, las anclas y el watcher del hash — **enrutamiento anidado
reimplementado a mano** con `router.replace` + `scrollIntoView`. Era la mejor prueba de que la pantalla
pedía ruta propia: alguien ya necesitó deep-link y lo resolvió sin el router. Se conserva tal cual;
convertir las anclas en rutas hijas es otro cambio.

**`SignatureSidebar.vue`** sale de `HomeSidebar`, que llevaba **dos variantes en un componente** (el mismo
*type code* un nivel más abajo). Con ella se va el booleano `isGlobalSignatureRoute` que elegía cuál pintar.

**Lo que NO se llevó, a propósito**: el handler `@refresh-home`. En esa ruta llamaba a `loadUserMenu()`
—que no alimenta nada visible: el aside de firmas es una lista estática— y a `refreshActiveProcessPanel()`,
que refresca un panel de **otra** página. Con las páginas separadas, `/home` se remonta al volver y su
`onMounted` recarga. **Verificado**: al volver disparan 5 llamadas (`menu`, `document-center`,
`signature-center`, `dossier`, `certificates`). Los datos quedan **más frescos**, no menos.

**Resultado**: `workspaceRouteMode` pasa de tres modos a dos. `HomeView` 5657 → **5588 L**. La reducción es
modesta porque la rama eran literalmente dos líneas: **el valor está en la estructura, no en el LOC** —
`/home/firmas` ya no monta los 13 modales de HomeView ni su dashboard.

**Los dos tests marcadores se rompieron, que era el plan**, y sólo esos (los otros 35 verdes, incluidos los
4 guards de `adminBlockedRouteNames`). Reescritos: uno vigila ahora que firmas **no vuelva** a fusionarse;
el otro congela que `/home` y `/home/documentos` **todavía** comparten componente — y **deberá romperse** en
la fase 3.2.

**Verificación en navegador**: la página sirve la pantalla completa; las anclas siguen navegando (hash +
item activo + scroll); **el deep-link directo con F5 funciona** (`/home/firmas#signature-launcher-pending`
abre con "Bandeja de pendientes" marcada); `/home` conserva sus 7 accesos directos y **cero** items de
firmas; el ciclo `/home` → firmas → vuelta mantiene cabecera y aside correctos. Consola limpia.

> ⚠️ **Deuda que el corte deja a la vista**: `SignatureCenterView` deriva la identidad del usuario con su
> propia copia de `userPhoto`/`userFullName`. Es la **quinta**. Refuerza lo dicho en 2.2: la identidad pide
> su composable, y ahora hay un caso más para justificarlo.

#### 3.2 — reestimada: son tres pasos, no uno

**La estimación original era falsa.** Decía *"93 líneas + `useDocumentCenter`; la única costura
(`documentCenterItems`) ya se carga dos veces hoy"*. La costura que importa es otra: las filas tienen
**"Ver PDF" y "Descargar"**, y esas acciones arrastraban 5 refs de preview, el modal de vista previa, el
toast, y helpers atrapados en `useDeliverableView`.

| Paso | Qué | Estado |
|---|---|---|
| **3.2a** | `buildDeliverableSubject(payload, { fallbacks })` — parametrizar sus dos dependencias de estado | ✅ **hecha** |
| **3.2b** | `DeliverablePreviewModal` + `useDeliverableFilePreview()` | ✅ **hecha** |
| **3.2c** | `DocumentCenterView` + `useDocumentCenter` + router + tests | ✅ **hecha** |

##### 3.2a y 3.2c — completadas (16-07-2026)

**3.2a**: el núcleo de `getDeliverableSubject` (102 L) se va a `shared/utils/deliverableSubject.js`
(+22 tests) con sus **dos** fallbacks como parámetro. `useDeliverableView` se queda un envoltorio de 10
líneas que le sirve sus refs: **la firma no cambia y ninguno de sus ~40 call sites se entera**.
`useDeliverableView` **1055 → 964 L**.

**3.2c**: `DocumentCenterView` + `useDocumentCenter` (+15 tests). Llama a `buildDeliverableSubject`
**sin fallbacks**: esta pantalla no tiene proceso seleccionado, así que `processId`/`scopeUnitId` quedan
en `null`. Antes heredaba los del proceso que HomeView tuviera abierto — funcionaba **de casualidad**
porque las filas traen su propio `process_id`.

**El premio de la fase: `HomeView` deja de saber en qué ruta está.** `workspaceRouteMode` desaparece
entero, y con él:

- Las **8 guardas** repartidas por la pantalla (`if (workspaceRouteMode === 'documents')`…).
- El **ternario de `homeErrorMessage`** (`workspaceRouteMode === 'default' ? documentCenterError : ''`),
  que §5 de este documento señaló como la prueba de la fuga: dashboard y centro compartían el error.
  Se borró **sin sustituto**, como estaba previsto.
- El **`watch(route.fullPath)`**, que existía **sólo** para suplir el `onMounted` que no se re-disparaba
  porque tres rutas compartían instancia. Deuda estructural pura: se fue con su causa.
- Un **modal "Centro documental" muerto** (41 L): nadie lo abría nunca, y su texto —*"Este espacio quedará
  para la consulta general de documentos con filtros"*— revela que era el **predecesor** de la ruta que lo
  dejó obsoleto.

**`HomeView` 5501 → 5243 L.** Desde el inicio de esta sesión: **5663 → 5243 (−420)**, y ahora sirve **una**
ruta en vez de tres.

**Los dos tests marcadores volvieron a romperse, como estaba escrito en la 3.1** (*"deberá romperse en la
fase 3.2"*). Reescritos: uno afirma ahora que **las tres rutas tienen cada una su componente**.

**Verificación en navegador**: `/home/documentos` sirve la pantalla completa (6 documentos, 4 filtros,
1 "Ver PDF"); búsqueda, vacío y Reset funcionan; el preview abre con blob real y **sin** panel de acciones;
`/home` conserva su dashboard y ya **no** embebe la tabla. Consola limpia.

> ⚠️ **Incidente durante la ejecución**: un script de borrado por anclas de texto se llevó **894 líneas de
> más** (`HomeView` 5501 → 4444) porque el ancla de cierre estaba lejísimos. Se detectó con `git diff
> --stat`, se revirtió con `git checkout`, y se rehízo **cortando por rangos de línea validados**, con un
> `assert` que aborta si un bloque supera las 40 líneas. Lección: en ficheros de 5000 líneas, borrar
> "desde X hasta Y" es una escopeta; hay que acotar cada bloque por su propio cierre y verificar el tamaño.

#### 3.4 — completada (17-07-2026). **El dossier ya tiene URLs.**

Las 7 secciones del dossier son rutas hijas de `/perfil`. Los tres fallos que §1 y §5.2 documentaron están
**corregidos y verificados en el navegador**:

| Antes | Ahora |
|---|---|
| No se podía enlazar a "mis títulos" | `/perfil/investigacion` abre directo en Investigación, con sus 5 subpestañas |
| **F5 devolvía a Inicio** siempre | `/perfil/certificados-firma` + F5 → sigue ahí |
| **El botón atrás salía de `/perfil` entero** | Vuelve a la sección anterior |

**Muere el contrato por magic string.** `modules/perfil/profileSections.js` es la única fuente: el aside y
las tarjetas de Inicio la leen. Antes cada uno tenía **su propia lista a mano** y el acuerdo era la
etiqueta en español con tilde — el desajuste que §"fragilidad" caracterizó como *no-op silencioso*.
**Ahora el acuerdo es el `name` de la ruta, y vue-router valida**: equivocarse deja de ser mudo.

**Renombrados los 7 `*View.vue` → `components/sections/*Section.vue`.** `views/` contiene ya sólo
`PerfilView`, que **sí** es una ruta. El sufijo vuelve a informar.

**Código muerto que se va con el conmutador**: `openSigningWorkspace` + `syncViewFromRoute` + el deep-link
`?view=firmar`. Era doblemente muerto — apuntaba a un módulo desactivado (*"en migración"*) y su único
emisor no se llamaba desde ningún sitio. `PerfilView` **428 → 383 L**.

> 🔐 **El riesgo real de esta fase era de seguridad, y se resolvió con evidencia.** El guard miraba una
> lista de **nombres** (`adminBlockedRouteNames`), pero las hijas tienen nombre propio
> (`perfil-formacion`…): **se habrían colado**. Se cambió a `meta.blockedForAdmin`, que vue-router
> **hereda del padre a los hijos**. Cubierto por 3 casos nuevos en el test del guard y **verificado en
> vivo**: el admin pide `/perfil/formacion` y acaba en `/admin`.

**Los tests**: se rompieron **15**, todos por diseño — el marcador de la fase 2 (*"las 12 rutas son planas:
ninguna declara children"*) y los 14 de la caracterización de pestañas, que la 3.4 volvió obsoletos. El
marcador se invirtió: ahora afirma que **`/perfil` tiene 8 hijas**. `PerfilView.test.js` se reescribió para
describir el **layout** (17 tests); el contrato de URLs vive donde le toca, en el test del router. **207
tests** en total.

> Dos tests que escribí mal y el fallo lo delató: `getRoutes()` **aplana** el árbol (deja dos registros con
> path `/perfil`, el layout y su hija de path `""`), y el `meta` del registro hijo **no** viene fusionado —
> `to.meta` sí, que es lo que lee el guard. Se corrigieron para afirmar sobre `options.routes` y sobre el
> meta **resuelto**.

##### 3.2b — completada

- **`shared/utils/filePath.js`** (+18 tests): `getFileNameFromPath`, `getFileExtension`, `canPreviewInline`.
  Eran **puros** y vivían dentro del closure de 1062 líneas de `useDeliverableView` sin motivo, obligando a
  inyectar el composable entero sólo para saber si una ruta acaba en `.pdf`. El composable los sigue
  devolviendo, así que sus consumidores no se enteran.
- **`DeliverablePreviewModal.vue`** (+9 tests) con **slot `#actions`**, y **`useDeliverableFilePreview()`**,
  que recibe tres **funciones** (`getSubject`, `fetchBlob`, `onError`) y **posee su estado** — al revés que
  `useDeliverableView`, que recibe estado ajeno y por eso es un Middle Man.
- `HomeView` **5588 → 5501 L**.

**Corrección importante a lo dicho en la fase 3.1**: se afirmó que "el modal de preview es autocontenido".
**Es falso.** Su pie **es** el panel de acciones del flujo de llenado (aprobar/devolver/rechazar/reemplazar),
que depende de `useDeliverableView`, de `submitDeliverableCardFillAction` (63 L) y de otro modal. De ahí el
slot: quien tenga el panel lo inyecta; el centro documental no, y obtiene la vista previa a secas.

**Que el slot es la costura correcta está probado, no supuesto**: las filas del centro **no llevan `actions`
ni `workflow`** (verificado por API), los cuatro predicados dependen justo de esos campos, y al abrir la
vista previa desde el centro el panel **ya no se pintaba**. Comprobado en pantalla antes y después: el modal
renderiza idéntico (PDF + "Cerrar" + "Descargar archivo", sin panel).

> ⚠️ **El caso positivo del slot no es verificable en dev**: el único entregable con fichero está en
> *"Pendiente de firma"*, y los predicados exigen `!isSignaturePhaseDocumentStatus()`. **No existe el dato
> que haría aparecer el panel.** Por eso vive en un test de componente (`DeliverablePreviewModal.test.js`),
> verificado por mutación: borrar el slot tumba el test.

> ⚠️ **Aviso sobre este documento**: el §"centro documental sin datos" que llegó a afirmarse **era falso**,
> por un fallo en la sonda (el endpoint devuelve `{ total, documents }`, no `items`). El usuario
> `1122334455` tiene **6 documentos** y uno con PDF real. **3.2 no está bloqueado por datos.**

### Fase 4 — Colapsar duplicación

| # | Acción | Δ | Nota |
|---|---|---:|---|
| 4.1 | `AppFormModalLayout` con `@close` → **mata los 6 `getElementById`** | ✅ **hecha (17-07-2026)** | Ver abajo |
| 4.2 | `DossierSectionCrud.vue` + `useDossierSection(descriptor)`: 6 CRUD → 1 | ✅ **6/6 hechas (17-07)** | Investigación incluida, sin injertar casos especiales |
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

#### 4.1 — completada (17-07-2026). **Muere el acoplamiento invisible.**

Los 6 `Agregar*.vue` cerraban su modal con `document.getElementById("<x>Modal")` contra un id que
declaraba el **padre**. Ahora piden el cierre con `@close` y lo ejecuta quien monta el modal. Los 5 ids
se borran: sólo existían para ese `getElementById`.

**La predicción del plan se cumplió.** §3 decía: *"E antes que C desbloquea `CapacitacionView` y hace que
las seis converjan de verdad"*. Al mirarlo de cerca, la causa estaba clara:
`AgregarCapacitacion.getElementById("capacitacionModal")` encontraba **siempre el modal de agregar**, así
que editar necesitó un **segundo modal `controlled`** y un handler que lo cerrara a mano. Con el `emit`,
los dos modales colapsan en uno y la sección vuelve al patrón de sus cinco hermanas. `showEditModal` muere.

> ⚠️ **Bug evitado al colapsar**: `openModal` de `CapacitacionSection` **no limpiaba `pendingEdit`** — no
> le hacía falta con modales separados. Compartiendo modal, pulsar "Agregar" tras editar habría abierto el
> formulario **en modo edición**. Sus cinco hermanas ya lo limpiaban; se alineó.

**Verificación**: en `/perfil/capacitacion`, Agregar abre el modal y **Cancelar lo cierra** (1 → 0
diálogos): el camino `emit` funciona en vivo.

> ⚠️ **El caso de EDITAR no es conducible en dev**: las subsecciones que tienen registros no son las que
> abren por defecto (Formación tiene 1 en "Grado", pero abre en "Cuarto Nivel"; Capacitación tiene 0).
> Como usa el mismo `closeModal`, el contrato vive en `AgregarTitulo.test.js` (+5 tests), **verificado por
> mutación**: devolver el `getElementById` tumba 2 tests, incluido uno que espía `document.getElementById`
> y falla si alguien lo reintroduce.

#### 4.2 — 5 de 6 secciones colapsadas (17-07-2026)

Las 5 secciones clásicas del dossier (Títulos, Experiencia, Referencias, Capacitación, Certificación)
pasan de ~285 L cada una a **~48 L de descriptor**. La lógica CRUD (~180 L byte-idénticas) vive ahora en
`useDossierSection(descriptor)`, y el template común (shell + tabs + tabla + 2 modales + input + visor) en
`DossierSectionCrud.vue`. Cada sección rellena tres slots con lo suyo: `#form`, `#cell`, `#delete-question`.

| Sección | Antes | Ahora |
|---|---:|---:|
| Títulos | 273 | 50 |
| Experiencia | 271 | 49 |
| Referencias | 285 | 43 |
| Capacitación | 334 | 53 |
| Certificación | 265 | 48 |

**Balance neto: 1428 → 577 L (−851).** No las −1000 prometidas, y la razón es honesta: **Investigación queda
fuera** (su modelo de 5 sub-listas con columnas por pestaña es otra bestia, como el plan advirtió), y las
celdas especiales **no se forzaron** a un descriptor declarativo. Esa decisión fue deliberada: Laboral pone
`'Actualidad'` si no hay fecha_fin y su columna se llama FUNCIONES/CÁTEDRAS según la pestaña; Certificación
trunca la descripción. Modelar eso en datos habría sido frágil. El slot `#cell` deja esas celdas **exactas**,
copiadas sin reinterpretar — el principio de toda la sesión: mover código, no reescribir comportamiento.

**`useDossierSection` posee su estado** (crea los refs de modal/preview/fileInput y los devuelve; el
componente los ata con `ref="..."`). Es el patrón de `useDeliverableFilePreview`, no el Middle Man de
`useDeliverableView`.

**Verificación en navegador, las 5 con datos sembrados** (una por una, no de muestreo):

| Sección | Comprobado en vivo |
|---|---|
| Títulos | Subpestañas con contador (Cuarto Nivel/Grado), celda `sreg` (slot) y genérica (`—`), editar→cerrar, cambio de pestaña |
| **Experiencia** | Los 3 casos irreductibles: columna **FUNCIONES→CÁTEDRAS** al cambiar de pestaña, join de funciones, fecha y **"Actualidad"** |
| Referencias | Tabs por tipo con contador, editar→cerrar |
| Capacitación | Celdas de fecha, tabs, y **el colapso de 4.1 sigue** (editar = 1 modal) |
| Certificación | **Sin** subpestañas (subsections vacío), descripción truncada, columnas |

**Lo que no fue conducible en dev, cubierto por test**: el flujo de borrado (el usuario de dev no tiene
permiso `dossier.delete`, así que el botón sale deshabilitado — comportamiento correcto e idéntico al
original). `DossierSectionCrud.test.js` (+6) prueba que el slot `#delete-question` recibe el registro y que
confirmar llama a `deleteRecord` con el `_id`, **verificado por mutación**. **218 tests** en total.

> ⚠️ **Warnings preexistentes, NO introducidos**: `AgregarCapacitacion` monta `SSelect`/`SInput` sin pasar
> `label`/`placeholder` (props requeridas) → avisos de Vue en consola. Están en varios `Agregar*` desde
> antes de esta fase; no rompen nada. Deuda menor para un barrido aparte.

#### 4.2 — COMPLETA, 6/6 (17-07-2026). **−1061 líneas.**

Investigación se colapsó en el mismo `DossierSectionCrud` (331 → 100 L), y el composable **se generalizó sin
una sola rama `if (investigacion)`** — que habría sido el injerto de caso especial que este plan critica en
`AdminTableManager`. Los tres campos nuevos del descriptor son genuinamente generales:

- `docType` como **función de la pestaña** (además de string fijo): Investigación tiene un tipo por pestaña.
- `rowsFor(records, tab)` / `countFor(records, key)`: de dónde salen las filas. Investigación no es un array
  plano sino un objeto de 5 sub-listas; las clásicas omiten estos campos y siguen filtrando el array.
- La pestaña activa se pasa **siempre** a `deleteRecord`/`uploadDocument`; las clásicas la ignoran.

Se caracterizó una trampa heredada: en Investigación conviven la **clave plural** (`"articulos"`, la usa
`deleteInvestigacion` y el árbol) y el **docType singular** (`"articulo"`, lo usa `downloadDocument`). El
descriptor mapea de una a otro; documentado para que nadie lo "arregle".

**Balance final de las 6**: 1759 → 698 L (**−1061**), superando la estimación de −1000.

**Verificación en navegador**: las 5 clásicas **re-verificadas** tras generalizar el composable (Experiencia,
la más sensible, mantiene FUNCIONES→CÁTEDRAS, join y "Actualidad"). Investigación: 5 subpestañas con
contador, **columnas que cambian por pestaña** (artículos → proyectos), editar pre-selecciona el tipo de la
pestaña, agregar arranca en artículos, todo cierra a 0 modales. Consola sin errores.

> Un susto instructivo: la primera medición dio "2 modales al editar, 1 tras cerrar". No era un fallo —
> era el **SessionExpiryModal** ("Sesión por expirar") que saltó por el tiempo de sesión. Renovada la
> sesión y filtrado ese modal, el conteo es 1 → 0 limpio. Recordatorio de no dar por bueno *ni* por malo un
> número sin mirar qué lo compone.
