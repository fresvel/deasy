# Plan maestro — lo que queda por hacer

> **Este es el ÚNICO documento del que se sacan tareas.** Todo lo demás en `docs/planes/` es
> referencia: se consulta, no se ejecuta.
>
> **Medición de partida:** SonarQube en `:9002`, rama `develop`, **2026-08-09**.
> 373 incidencias · 0 bugs · 8 vulnerabilidades · cobertura 17,7 % · notas **A / C / A**.
> Cómo reproducirla y la serie histórica: [`referencia/calidad-y-medicion.md`](./referencia/calidad-y-medicion.md).

---

## Cómo leer este plan

Los frentes van **ordenados por retorno sobre esfuerzo**, no por gravedad. Cada uno dice **qué es**,
**por qué importa**, **qué hacer** y **cuándo está cerrado**. Los estados son cuatro:

⬜ sin empezar · 🟡 a medias · ⛔ bloqueado por otra cosa · ✅ cerrado, con evidencia y fecha

**Antes de tocar nada, tres lecturas obligatorias:** las reglas de trabajo de
[`referencia/metodo.md`](./referencia/metodo.md) —destiladas de fallos reales de este repo, romperlas
cuesta más que el trabajo que ahorran—, la lista de **lo que NO hay que tocar**, en el mismo sitio, y
la norma de la carpeta en [`CLAUDE.md`](./CLAUDE.md).

---

## §0 · Control de ejecución

**Esta tabla es el estado del plan.** Se lee antes de elegir trabajo y **se actualiza en el mismo
commit** que la tarea que cambia de estado — la norma completa, en [`CLAUDE.md`](./CLAUDE.md).

Aquí el control es **por frente**. Las tareas concretas viven en el plan de cada uno y **no se repiten
aquí**; la columna «Control detallado» dice dónde.

| Frente | Qué entrega | Estado | Control detallado | Evidencia · fecha |
|---|---|---|---|---|
| **0** · Modelo de dominio | El modelo deja de contradecirse: cero `document_owner`, la base manda y el YAML se fue | ✅ **9 de 9** | [archivado](../docs-md-antiguos/planes-cerrados-2026-08/frente-0-modelo-dominio/) | `30654db` · medido en base · **2026-08-13** |
| **1** · Defectos conocidos | Cinco defectos que un usuario puede encontrarse, congelados en pruebas | ⬜ **5 abiertos** · 9 cerrados | [`defectos-conocidos/`](./defectos-conocidos/) — **15 tareas** | remedidos contra el código · 2026-08-14 |
| **2** · Seguridad | De nota C a B cuesta **una** incidencia; la A exige una decisión de diseño | ⬜ 8 vulnerabilidades | aquí, §Frente 2 | Sonar `:9002` · 2026-08-09 |
| **3** · Complejidad | Lo que queda son **tres componentes Vue**; el backend ya bajó | 🟡 | aquí + [`referencia/frontend.md`](./referencia/frontend.md) | — |
| **4** · Sistema de diseño | La paleta existe; ahora tiene que llegar a las plantillas | 🟡 pasos 1-3 y 5 ✅ · 4 y 6 ⬜ | [`sistema-diseno-componentes/`](./sistema-diseno-componentes/) | 3.ª vuelta reescrita · 2026-08-13 |
| **5** · Cobertura | El gate no pide 80 % global: pide 80 % **de lo nuevo** | 🟡 F0 ✅ · F1 y F2 ⬜ | [`referencia/cobertura.md`](./referencia/cobertura.md) | — |
| **6** · Signer | Cerrar los riesgos de la auditoría del microservicio de firma | 🟡 **8 de 12 abiertos** | [`referencia/signer.md`](./referencia/signer.md) | — |
| **7** · Método e infraestructura | Lo que evita que el resto se degrade: Sonar en CI, barreras de lint, contenedores vacíos | ⬜ | aquí, §Frente 7 | — |
| **8** · Deuda de volumen | Los ficheros que el plan no registraba, medidos el 2026-08-09 | ⬜ | aquí, §Frente 8 | remedido · 2026-08-13 |
| **9** · Capa de datos | **Siete fases** sobre el esquema y `config/postgres.js` — y **D7 audita el modelo**, lo que el frente 0 dejó abierto | ⬜ **0 de 7** | [`plan_data/`](./plan_data/) — D7 con **5 tareas** | D7 medido · 2026-08-14 |
| **10** · Compilador documental | Auditar la rama que ya existe, y **heredó el generador de Jinja** (S8) | ⬜ | aquí, §Frente 10 | — |
| **11** · Editor web de plantillas | **Son dos productos, no uno** | ⬜ | aquí, §Frente 11 | — |

> **Un `—` en la última columna no es un descuido: es que ese frente no se ha medido desde que se
> escribió.** Antes de empezarlo, remídelo — el frente 1 se remidió al abrirlo y **una de sus cinco
> fichas estaba mal descrita**.
>
> Y los frentes cuyo control detallado dice «aquí» **todavía no tienen tabla de tareas**. Escribirla es
> el primer paso de atacarlos, no un trámite posterior.

---

## Frente 0 · Limpiar el modelo antes de seguir refactorizando — ✅ **CERRADO · 9 de 9** (2026-08-13) · **archivado**

**Ya no hay tareas aquí.** El frente entero —las nueve fichas, los ocho sub-pasos del §0.8 y los
cuatro hallazgos que tumbaron el plan escrito— vive en
[`docs-md-antiguos/planes-cerrados-2026-08/frente-0-modelo-dominio/`](../docs-md-antiguos/planes-cerrados-2026-08/frente-0-modelo-dominio/).
Se archivó el **2026-08-14** por la regla 1 del [README de planes](./README.md): ocupaba **544 líneas
en la puerta de entrada del documento del que se sacan tareas**, y no quedaba ninguna.

**Qué era:** el resto del plan refactoriza, y el modelo se contradecía a sí mismo. El caso testigo fue
`document_owner`, **declarado retirado en un comentario y vivo 250 líneas más arriba en el mismo
fichero** — un agente con acceso completo al repo lo leyó, lo dio por bueno y salió con el modelo
equivocado.

**Cómo acabó, medido:** cero `document_owner` en la base · cero `meta.yaml` bajo
`System/tpl_informe_general/` · el vínculo del Proceso por defecto de 1 flujo a 0. La dirección quedó
invertida —**la base manda, el YAML se fue**— y con ella murieron `WorkflowSyncService`, tres
endpoints, `meta_object_key`, cinco resolvers y dos ámbitos, bajo un criterio que sigue vigente:
**lo que la web no autora, no existe.**

**Lo que dejó vivo, y ya está repartido** (no se repite aquí, regla 2 del README):

| Qué quedó | Dónde está ahora |
|---|---|
| El **botón de sincronizar del admin da 404** — era el sub-paso 9, el único de frontend | **Frente 7** |
| El **generador de Jinja** (S8): no es limpieza, es construcción, y depende del compilador | **Frente 10** |
| La **fusión `task_items`/`documents`**: el §0.8 la dejó sin urgencia, y toca frontend | Sin decidir — [README del archivo](../docs-md-antiguos/planes-cerrados-2026-08/frente-0-modelo-dominio/) |
| Las **decisiones del modelo que el frente 0 inventarió y no llegó a validar**: la edición `retired` enlazada, la invariante de `published` sin verificar, y las columnas `*_id` sin FK | **Frente 9 · fase D7** (2026-08-14) |

> Las citas a **`§0.4`, `§0.6`, `§0.8`…** que aparecen más abajo (sobre todo en el frente 10) siguen
> siendo válidas: **apuntan a ese archivo**, no a una sección desaparecida.

**Y lo que aprendió está en el método, no en el archivo:** las **reglas 14 a 17** de
[`referencia/metodo.md`](./referencia/metodo.md) —el experimento desechable, y las tres que explican
por qué **verde no significa ni seguro, ni retirable, ni protegido**— salieron de este frente y se
promovieron el día del cierre, porque vivían solo en su prosa.

---

## Frente 1 · Defectos conocidos y sin arreglar — ⬜ · vive en [`defectos-conocidos/`](./defectos-conocidos/)

**Lo más rentable que queda, y con diferencia**, porque no es deuda estética: son fallos que un
usuario puede encontrarse. Y todos están **congelados en pruebas**, así que el arreglo se verifica
solo: cuando el defecto muere, su golden cambia, y ese diff **es** la prueba.

**Segundo frente con carpeta propia** (el otro es el 9), desde el **2026-08-14**. El motivo: llevaba
**catorce fichas en una sola tabla**, nueve de ellas cerradas con párrafos de trescientas palabras, y
leerlo para saber *qué queda* costaba más que hacerlo. **Las tareas están allí**, con su control de
ejecución —15 tareas con estado, evidencia y fecha— y no se repiten aquí.

| Defecto | Qué es | Superficie |
|---|---|---|
| **1.3** | Con `is_manual` y sin responsable, **cualquiera se apropia** de la solicitud al iniciarla. Congelado en `manual_autoasignacion_efecto` | Backend · servicio |
| **1.7** | El **sello fantasma**: `previewBoxStyle` nace `{display:'none'}` y la asignación del `pointermove` no incluye `display`, así que el tercer término del `v-if` es siempre cierto | Frontend · `MultiSignerPanel.vue` |
| **1.8** | Dos documentos del repo mandan **formas de error contrarias**: la cabecera de `HttpError.js` recomienda `{ error }`, el contrato objetivo es `{ message, code }`. Cada controller nuevo elige mal la mitad de las veces | Backend · documental |
| **1.10** | La **única bitácora de auditoría** del sistema la puentea el camino automático. Remedido: son **tres** caminos que reasignan sin dejar asiento, no uno, y la tabla no la lee **nadie** (un `INSERT`, cero `SELECT`) | Base de datos · triggers |
| **1.11** | Los **parámetros de más se ignoran en silencio** — el modo de fallo del 1.5 en la otra dirección. **Bloquea la fase D5-b** del frente 9 hasta que se censen sus call sites | `backend/config/postgres.js` |

**Nueve cerrados**, en [`defectos-conocidos/bitacora.md`](./defectos-conocidos/bitacora.md) con su
razonamiento entero — que es donde está el valor: hay **cuatro sitios donde la corrección obvia es la
equivocada**. Entre ellos el **1.9**, que resultó **no ser un defecto**: aplicarle el guard del IDOR
habría dejado sin chat a 8 de 10 asignados, medido contra la base antes de tocar nada.

**Criterio de cierre:** las 15 tareas del control de ejecución cerradas con su evidencia, y la carpeta
archivada.

---

## Frente 2 · Seguridad: de C a B cuesta una marca; A exige una decisión — ⬜

Quedan **8 vulnerabilidades**, y como siempre en Sonar **la nota la fija la peor, no el volumen**.

- **C → B: una sola incidencia.** `javascript:S2612` en `backend/utils/templateArchive.js:144`, un
  `chmod 0o755` sobre los `.sh` de un workspace temporal antes de comprimirlo. El comentario del código
  ya explica por qué hace falta (zip preserva el modo unix y los scripts deben quedar ejecutables) y el
  directorio se borra tras la descarga. **Es un falso positivo defendible: márcalo con esa
  justificación**, no lo "arregles".
- **B → A: NO es alcanzable honestamente hoy**, y conviene decirlo en vez de maquillarlo. De las 7
  MINOR restantes, **4 son el riesgo R-1**: la contraseña del PKCS#12 viaja por **AMQP sin TLS**. Eso
  es un riesgo real y aceptado, no un falso positivo. Marcarlo para lucir una A sería mentirle al
  panel. Las otras 3 (`http://` a MinIO, RabbitMQ y el mailer) son endpoints internos del compose y sí
  se pueden marcar — **dejan de ser inocuas el día que MinIO salga de la red interna**.

**La decisión pendiente, que es de infraestructura y no de código:** poner TLS en el broker, o aceptar
R-1 por escrito con su justificación. Detalle en [`referencia/signer.md`](./referencia/signer.md).

**Criterio de cierre:** seguridad en **B** con el `S2612` marcado, y R-1 con una decisión escrita.

---

## Frente 3 · Complejidad: lo que queda son tres componentes Vue — 🟡

De los **~60 `S3776`** abiertos, la cabeza ya no está en el backend.

> **No cites ese número sin re-medirlo.** Al revisar el plan el 2026-08-09 había **tres cifras vivas y
> distintas** para lo mismo: 58 aquí, **67** en `referencia/calidad-y-medicion.md` §3.2, y **61** en la
> consulta directa a la API (`resolved=false`). Es deriva normal entre escaneos, pero el contador de
> `S3776` **no es un indicador de progreso** —los buenos están al final de este documento—, así que
> vale más re-medirlo el día que se necesite que mantenerlo sincronizado en tres sitios.

| Cogn. | Dónde | Qué hacer |
|---:|---|---|
| **350** | `HomeView.vue` (**5 130 L** en un solo componente — remedido 2026-08-13; el trabajo de estilos bajó 85) | **Partirlo.** Su red de regresión es [`referencia/linea-base-homeview.md`](./referencia/linea-base-homeview.md), que existe justo para esto — pero **ojo: dos de sus filas ya no son ciertas** (el aside se rediseñó). No está «intacto»: bajó de 7 445 a 5 215 L. Lo que no se ha hecho es **partirlo** |
| **290** | `AdminTableManager.vue` | **NO es un God y no se polimorfiza** (ver «lo que no se toca»). Su peso son **dos injertos concentrados** (`process_definition_versions`, `template_artifacts`): extraerlos como paneles propios |
| **262** | `FirmarPdf.vue` | God real, 6 responsabilidades. Incluye la peor función del repo, `confirmSign` (44) |

Son **900 puntos, el 11 % de toda la complejidad**, y **ningún patrón de diseño le hace nada a un
`<template>` de 2 000 líneas**: la única cura es extraer componentes y bajar la lógica a composables
(ver [`referencia/patrones-diseno.md`](./referencia/patrones-diseno.md) §5). Es trabajo artesanal, se
verifica en navegador y no admite atajos.

Detrás van, ya en tamaño manejable: `useAdminPresentationAdapters` (44), `useAdminDraftArtifactFlow`
(39), `SqlAdminService.list()` (36), `genericCatalog` (33), `assignees` (33). Y en el backend hay dos
que **nadie ha mirado nunca** y tienen el mismo olor que la fase D ya curó: `dossier_controler.js`
(97 cogn. en 299 ncloc) y `generation/documents.js` (95).

---

## Frente 4 · Sistema de diseño — 🟡 · **13 de 25 tareas** (3.ª vuelta)

> ### ⛔ El estado de este frente vive en [`sistema-diseno-componentes/plan-2026-08-13.md`](./sistema-diseno-componentes/plan-2026-08-13.md#0--control-de-ejecución), NO aquí.
>
> **Una sola numeración: `F0`…`F10`.** Si lees un número de fase de este frente en cualquier sitio,
> es de esa tabla.
>
> ⚠️ **Aquí abajo hay una tabla de «pasos 1-6» que ya no se usa, y confundirla con las fases costó
> una respuesta entera (2026-08-15).** Eran la planificación del 2026-08-09/11 —sobre **el CSS**,
> que es la 1.ª y la 2.ª vuelta, las dos archivadas— y **sus dos pendientes ya los absorbió la 3.ª**:
>
> | Paso viejo | Dónde vive hoy |
> |---|---|
> | 1 · Fusionar los `@layer` en conflicto | cerrado en la 1.ª vuelta (`63b901e`) |
> | 2 · Eliminar componentes muertos | cerrado en la 1.ª vuelta (`9ebe307`) |
> | 3 · Colapsar `--deasy-*` / `--brand-*` | cerrado en la 2.ª vuelta (`6e60d74`) |
> | 4 · Cerrar el fork `AdminButton.vue` | **= tarea `F1.3a`**, cerrada el 2026-08-14 |
> | 5 · Migrar los colores hardcodeados | cerrado el 2026-08-13 |
> | 6 · Las 33 incidencias de contraste | **= fase `F10`**, sin empezar |
>
> **La tabla se conserva porque explica de dónde viene el frente, no porque haya que seguirla.**
> Y el paso 6 dice «fase F de la 3.ª vuelta»: **eso es un error de escritura de 2026-08-11**, de
> cuando se confundieron las fases `F0…F10` con las fases `A…I` del plan de calidad, que son de otro
> documento y de otro tema.

> **Plan, evidencia y bitácora: [`sistema-diseno-componentes/`](./sistema-diseno-componentes/).** El frente ocupaba 20 líneas
> aquí y necesitaba más: la medición del 2026-08-09 encontró **tres cosas que no estaban en ningún
> plan** y que iban *antes* de los pasos ya escritos.
>
> **Re-auditado el 2026-08-11**, sobre el árbol de `develop` tras el merge `96f1afe`. Lo que sigue
> **no** es el resumen de los mensajes de commit: cada línea se volvió a medir con `grep`, con
> `lint:css` dentro del contenedor y —donde había que verlo— con `getComputedStyle` en el navegador.
> Tres afirmaciones de la versión anterior de esta sección **eran falsas**, y van marcadas como tales
> más abajo en vez de borradas.
>
> ---
>
> ⚠️ **ESTA SECCIÓN SE QUEDÓ EN EL 2026-08-11. NO ES EL ESTADO DE HOY.** El desarrollo del frente
> siguió en `sistema-diseno-componentes/` y el maestro no se actualizó con él. **Manda la tabla de
> `plan-plantillas-2026-08.md`**, no ésta. Lo que ha cambiado desde entonces:
>
> - **La paleta se colapsó el 08-12.** Todo `--brand-*` que se lea aquí abajo está **muerto**: hoy son
>   `--color-primary`, `--color-line`, `--color-muted`… y **no hay `--color-white`**.
> - **`@theme` registra 22 colores, no 16**, con una sola declaración cada uno.
> - **La colisión `dark:` está CERRADA.** Más abajo se marca «⛔ viva»: ya no lo está — hay
>   `@custom-variant dark` en `tokens.css`, `vue/no-restricted-class` en `error` y `check:no-dark`.
> - **Son 18 módulos, no 15.** «La estructura nueva» de más abajo cuenta 14 + `index.css`.
> - **F3 y F4.5 se cerraron el 08-12**, y con ellas el paso 5 con su criterio redefinido.
> - **El 2026-08-13 se revierte el descarte de TailAdmin**: se adoptan **su paleta** (91 primitivas,
>   con nuestros 22 tokens como alias encima) y **su markup** (repo HTML free, MIT, con atribución),
>   **no su código Vue**. Eso contesta las cuatro decisiones que bloqueaban el cierre —foco,
>   tipografía bajo 14 px, `z-index` y tinte de las suaves—. Rama `develop-styles`, pila **B**.

El orden **no es negociable**, porque hacerlo al revés significa recodificar el conflicto en cada
sitio donde hoy hay un color escrito a mano. Y la sesión del 2026-08-09 le añadió un principio:
**borrar antes de migrar** — tokenizar reglas que no aplican a ningún nodo es trabajo que se tira.

| # | Paso | Estado | Evidencia medida el 2026-08-11 |
|---|---|---|---|
| 1 | Fusionar los dos `@layer components` en conflicto | ✅ `63b901e` | Ya no existe `tailwind.css`. Los `@layer components` que quedan son **uno por módulo de familia** y no se solapan; las marcas del corte siguen anotadas en `buttons.css:36` y `auth.css:60` |
| 2 | Eliminar los componentes muertos y su CSS | ✅ `9ebe307` + `331322d` | CSS total 3 997 → **2 054 L**; `AdminTableManager.css` borrado entero |
| 3 | Colapsar los tokens `--deasy-*` / `--brand-*` | ✅ `6e60d74` | **Cero `--deasy-*` vivos.** Las 4 apariciones que quedan en el árbol son **comentarios** de `tokens.css` (`:44`, `:51`, `:52`, `:92`) que explican el colapso. Un solo juego, y `@theme` (`tokens.css:23-40`) registra 16 colores en Tailwind — **hoy son 22**, tras el colapso del 08-12 |
| 4 | Cerrar el fork `AdminButton.vue` | ✅ **cerrado el 2026-08-14** (tarea F1.3a de la 3.ª vuelta) | El fichero **ya no existe**: 88 L y 11 modificadores fuera. Llevaba 2 regresiones de contraste (3.65:1) y el bug de la variante desconocida. La única mención que queda en el árbol es un comentario en `DossierDocumentActions.vue:94`, que era **su único importador** ~~El fichero **sigue vivo**: `frontend/src/modules/admin/components/ui/AdminButton.vue`. Ver abajo: el alcance es más pequeño de lo que decía el plan, y la razón que daba era falsa |
| 5 | Migrar los colores hardcodeados | ✅ **cerrado el 2026-08-13** | `647030a` + `2f1a158` dejaron `lint:css` en **0 errores**. Pero el contador ve el CSS, no la app. Ver el desglose abajo |
| 6 | Las 33 incidencias de contraste (`css:S7924`) | ⬜ **sin medir** → **fase F** de la 3.ª vuelta | No se puede consultar: el SonarQube es local y **no se levantó** en esta auditoría. Ver abajo qué se sabe sin él |

### Paso 4 — el fork sigue ahí, pero el plan lo describía mal

**Medido:** `AdminButton.vue` tiene **un solo import real** en todo el frontend,
`modules/perfil/components/DossierDocumentActions.vue:92`. Sus **seis** usos son todos
`variant="secondary" size="sm" icon-only` (`:3-87`), o sea **exactamente el caso divergente**:

- `AdminButton.vue:82` → `props.size ? sizeClassMap[props.size] : ""` — aplica el tamaño **siempre**.
- `AppButton.vue:93` → `props.variant !== "plain" && !props.iconOnly ? … : ""` — lo **omite** con `icon-only`.

Sustituirlo quita `admin-btn--sm px-3 py-2 text-sm` a esos seis botones, así que **sí mueve el
aspecto** y sigue pidiendo navegador. Lo que ha bajado es el riesgo: no es un fork con veintiún
consumidores, es un fichero y una fila de botones del dossier.

> ⚠️ **Afirmación falsa corregida.** Esta sección decía que `AdminButton` era el «**único emisor vivo
> de `admin-btn--*`**». **No lo es, y no lo ha sido nunca desde que existe `AppButton`**:
> `AppButton.vue:65-94` emite las **dos** familias (`deasy-btn--primary admin-btn--primary`…) en cada
> botón, que es justo el peaje que `referencia/frontend.md` §3.5 ya describía. Borrar `AdminButton.vue`
> **no** deja huérfano ningún `.admin-btn--*` del CSS.

> 🪤 **Trampa de nombres, medida.** Hay 14 ficheros que escriben `<AdminButton>` en su plantilla y
> **no usan este componente**: importan `AppButton.vue` bajo el alias `AdminButton`
> (p. ej. `AdminFormActions.vue:24`, `AdminLookupField.vue:84`). Buscar `AdminButton` da 100+ líneas
> y **una sola** es el fork. El grep que vale es `grep -rn "ui/AdminButton" frontend/src`.

### Paso 5 — `lint:css` a cero no es «cero colores»

`bash scripts/docker-env.sh dev exec -T frontend pnpm run lint:css` → **`6 problems (0 errors, 6
warnings)`**, y los 6 son `!important` documentados en la propia línea (`dialogs.css:83,110`;
`overrides.css:3,14,70,86`). Eso es real y hay que sostenerlo. Pero es el estado del **CSS**, y el
grueso del color nunca estuvo ahí:

| Dónde | Cuánto | ¿Lo ve `lint:css`? |
|---|---:|---|
| Hex de la **paleta**, `tokens.css` (34 en declaración + 5 en comentarios) | 39 | Sí, y va **silenciado a propósito** (`stylelint-disable color-no-hex` con motivo, `tokens.css:63` y `:106`). Es el sitio correcto |
| Hex **dentro de `@apply`** en los módulos | **7** | **No.** `forms.css:28,46` (`placeholder:text-[#8a93a8]`), `nav.css:138,142` (`border-[#d6e4f2]`), `tags.css:36` (tres en una línea) |
| `rgb()/rgba()` con triplete numérico en los módulos | **90** | **No.** El grueso está en `nav.css` (27), `buttons.css` (18) y `overrides.css` (11) |
| Hex en `.vue` / `.js` | **123** | **No**: `lint:css` es `stylelint "src/**/*.css"`, no mira una sola plantilla |
| `rgb()/rgba()` en `.vue` / `.js` | **37** | **No** |

Y el número de cabecera: **la cifra «~1 269» no es un colores-hex, es la suma de cuatro categorías de
`referencia/frontend.md` §3.4** (592 utilidades de paleta + 424 *arbitrary values* + 157 hex + 96
`rgb()`). Reproduciendo ese criterio hoy sobre `frontend/src` sale **≈1 537**, o sea que **no ha
bajado: ha subido** con el código nuevo. No es una contradicción con lo anterior — el trabajo del
frente 4 atacó el hex del CSS, y la masa es *utility soup* de Tailwind en `HomeView.vue` (673),
`FirmarPdf.vue` (345) y `AdminDraftArtifactModal.vue` (185). **Eso es frente 3, no frente 4.**

**Criterio de cierre del paso 5, redefinido para que sea alcanzable:** los **7 hex de `@apply`** y los
**90 `rgb()`** de `frontend/src/shared/styles/` a token, con la app idéntica. Lo de `.vue` se cierra
partiendo los componentes, no tokenizando.

### Paso 6 — lo que se sabe sin SonarQube

No se levantó el servidor, así que **el contador de 33 no está re-medido**. Lo que sí está medido y
sigue valiendo, de `docs-md-antiguos/planes-cerrados-2026-08/sistema-diseno/auditoria-color.md` §5:

- El barrido de parejas `color`+`background` con hex literal en la misma regla —lo único que `S7924`
  puede ver sin resolver cascada— daba **3 fallos, no 33**. Sonar no resuelve `var()`, no compone
  `rgba()` sobre el ancestro y no aplica cascada entre ficheros.
- **El contador y la accesibilidad no son la misma magnitud.** `2f1a158` dejó el CSS sin hex sueltos,
  así que lo previsible es que `S7924` **baje casi solo en el próximo escaneo sin haber arreglado
  ningún contraste** — el color no desapareció, se movió a `var()` y a `color-mix()`, que es
  precisamente lo que la regla no sabe leer.
- El fallo WCAG 1.4.11 que quedaba vivo era `.hope-action-delete-pdf:hover` a **2,90:1**. `2f1a158`
  unificó los siete `:hover` de `.hope-action-*` en `color-mix(… 85%, var(--brand-black))`, que
  oscurece, así que **debería haber subido** — pero eso **no está verificado** y el fondo de esa
  familia sigue siendo `rgba()` numérico (`buttons.css:266-346`).

**Criterio de cierre:** un escaneo con la cobertura regenerada + una medida de contraste real de
`.hope-action-*` en navegador. Sin las dos cosas no se sabe si esto está hecho.

### La estructura nueva (2026-08-10, `c45b154`)

`theme.css` y `tailwind.css` **ya no existen**. En su lugar hay **15 ficheros** en
`frontend/src/shared/styles/` —**hoy son 18**, tras `graph.css`, `deliverables.css` y `signatures.css`—:
14 módulos por familia más `index.css`, que es **lo único que importa
`main.js`** (`main.js:6`). El orden de los `@import` **no es alfabético y está explicado dentro del
propio `index.css`** (`:1-15`): `tokens.css` primero porque todo lo demás lo consume, `overrides.css`
el último porque tiene que ganar a las reglas de componente por orden, no por `!important`.

> El módulo **`misc.css` existe** y es el 14.º: la tabla de `CLAUDE.md` no lo lista.

**Los `!important` bajaron de 103 a 6**, y los 6 llevan el motivo escrito al lado.

### El defecto del `<header>`: no se perdió, y ahora es peor

La versión anterior de esta sección decía que la causa era
`html[data-environment="local-dev"] header { … !important }`, que **solo afecta a dev**, y que el
bloque `local-dev` «sigue ahí». **Las tres cosas son falsas hoy**, y conviene saber por qué:

- `c45b154` **promovió el bloque entero y retiró el gate**: `grep -rn "data-environment" frontend/src`
  da **0**. Fue lo correcto —el bloque era *el diseño* puesto tras la condición equivocada, y sin él
  producción se veía **peor**—, pero significa que **ya no hay nada acotado a desarrollo**.
- La regla sobrevivió intacta salvo el gate y el `!important`. Hoy es **`overrides.css:140`**:

  ```css
  header {
    background-color: var(--brand-navy-deep);
    border-color: rgba(255, 255, 255, 0.1);
  }
  ```

- **Medido en el navegador** (`https://localhost:8443`, con `data-environment` ya inexistente),
  inyectando el `<header>` de `AppFormModalLayout.vue:14-17` tal cual: `backgroundColor` =
  `rgb(7, 25, 39)` (= `--brand-navy-deep`) y el `<h2 class="text-slate-950">` encima, o sea texto
  casi negro sobre fondo casi negro, **≈1,1:1**.

**O sea: el defecto no se corrigió, se generalizó.** Antes salía en el modal «Agregar título
académico» y solo en dev; ahora la regla es incondicional y alcanza **todo `<header>` sin utilidad de
fondo propia** — `AppFormModalLayout.vue:14` (que es **todos** los modales de formulario del perfil),
`ProcessGraphView.vue:142`, `UnitGraphView.vue:174` y `HomeView.vue:875,1023,1048`. Los que llevan
`bg-white` (`SNotify.vue:14`) o un degradado (`WorkspaceChatLauncher.vue:24`) se salvan porque una
clase (0,1,0) gana al selector de elemento (0,0,1).

**Arreglo propuesto:** `overrides.css:140` no quiere ser `header`, quiere ser la cabecera del *shell*
de la aplicación (`SHeader.vue:2`). Darle su clase y dejar el elemento en paz. Es un cambio de una
línea, pero **cambia el aspecto de seis sitios a la vez**: pide huella de `getComputedStyle`
antes/después, no build ni tests.

> 📌 ~~`planes-cerrados-2026-08/sistema-diseno/bitacora.md` sigue diciendo que «el bloque `local-dev` de `theme.css` sigue
> vivo»~~. **Corregido el 2026-08-11**: la bitácora ya registra la sesión del 2026-08-10 donde se
> promovió (`c45b154`), y con ella el hallazgo de fondo — **`local-dev` no era una variante de
> desarrollo, era el diseño tras la condición equivocada**, y promoverlo arregló 3 de los 4 fallos de
> WCAG 1.4.11 que producción tenía.

### Las tres colisiones de `tailadmin-ui`: las tres cerradas

| Colisión | Estado | Evidencia |
|---|---|---|
| `rounded-lg` valía 16 px (escala invertida) | ✅ **cerrada** (`cdbc62b`) | No queda ni una declaración `--radius-*` en `frontend/src`. Medido en navegador: `--radius-lg` = **`0.5rem`** (8 px), o sea el valor por defecto de Tailwind v4, y la escala vuelve a ser monótona (`sm 4 < md 6 < lg 8 < xl 12 < 2xl 16`) |
| No había `@theme`, Tailwind no conocía un solo token | ✅ **cerrada** (`6e60d74`) | `tokens.css:23-40`, 16 colores bajo `--color-*`. Ya existen `bg-brand-primary`, `text-brand-text-strong`… |
| `dark:` se autoactivaría por `prefers-color-scheme` | ✅ **cerrada el 2026-08-11** — lo que sigue era el estado del 08-11 | `grep -rn "custom-variant" frontend/src` → **0**. Sin `@custom-variant dark`, Tailwind v4 compila `dark:` a `@media (prefers-color-scheme: dark)` y una receta pegada de TailAdmin pintaría en oscuro sobre una app en claro. **Fallo silencioso**, y hoy inocuo solo porque no hay **ni un** `dark:` en el árbol. El aviso está donde toca, en `tokens.css:17-20` |

### La barandilla, y lo que no vigila

- **stylelint** (`frontend/.stylelintrc.json`): `color-no-hex` en **error**, `declaration-no-important`
  en **warning**. Hoy: **0 errores, 6 avisos**, y ahí se queda.
- **`eslint-plugin-vue`** (`frontend/eslint.config.cjs:36-37`): `vue/no-static-inline-styles`
  (`allowBinding: true`) y `vue/prefer-separate-static-class`, ambas en **error** y a cero.

> ⚠️ **Afirmación obsoleta corregida.** Esta sección decía que «`pnpm run lint:css` sale en rojo a
> propósito (151 hex) y **no debe subir**». Ya no: sale en **verde**. La regla pasa a ser **no debe
> volver a rojo** — y con el matiz de arriba, que el verde solo cubre el `.css`.

### Los cuatro scripts de `scripts/`

| Script | Qué hace | ¿Se queda? |
|---|---|---|
| `css-radios.mjs` | Deshizo la colisión `--radius-*` reescribiendo cada uso al *utility* que pintaba ese mismo valor, en **una sola pasada** (dos `sed` encadenados mandarían los 8 px a 16) | **Un solo uso.** Su trabajo está hecho y no se repite: archivar |
| `css-modularizar.mjs` | Troceó `theme.css` + `tailwind.css` en los 14 módulos + `index.css`. Sabe descender dentro del `@layer components` y asigna las reglas multi-selector a la familia **más tardía** para que ninguna se adelante | **Un solo uso**, pero su cabecera (`:1-20`) documenta *por qué* el orden de `index.css` es el que es: archivar el script, **conservar el comentario** |
| `css-prune.mjs` | Poda genérica: trocea una hoja en bloques de primer nivel y borra los que solo mencionan clases sin consumidor, con **invariante de reconstrucción byte a byte** antes de escribir. Tiene modo informe (sin `--apply`) | **Se queda.** Es reutilizable y el modo informe sirve de auditoría periódica |
| `css-hex-a-token.mjs` | Sustituye hex por `var(--token)` con dos salvaguardas ganadas a golpes: el hex corto que es prefijo del largo (`#fff` dentro de `#fff0ed`) y la autorreferencia que deja el token **sin valor** | **Se queda.** Es la herramienta del paso 5, que sigue abierto |

**Criterio de cierre del frente:** pasos 4, 5 (con el criterio redefinido) y 6 cerrados, más el
`<header>` de `overrides.css:140` acotado. Entonces `sistema-diseno-componentes/` se archiva y esto se marca ✅.

> **Actualizado el 2026-08-13, con lo medido y no con lo recordado.**
>
> - **Paso 5 ✅.** Su mitad de CSS ya estaba cerrada; la de `.vue` se cerró aquí: **2 117 colores de
>   familia a mano → 201**, y los que quedan no caen en ningún patrón (139 de cola larga en `class`
>   estático, 62 dentro de una expresión). Pasan a la **fase B** de la 3.ª vuelta.
> - **El `<header>` de `overrides.css` ✅ acotado**, y de la forma que no estaba prevista: **la regla
>   se borró entera.** Pintaba sobre los nueve `<header>` del proyecto y cinco quedaban a ≈1,1:1 —
>   y el único que quería ese aspecto ya lo declaraba por utilidad, con los mismos valores.
> - **Pasos 4 y 6 siguen abiertos** y **no se tocaron en esta vuelta**. Son las fases **E** y **F**
>   del plan nuevo, con su medición al día.

> **Actualizado el 2026-08-13.** El paso 5 se cerró con F3 y F4.5 el 08-12. Lo que queda del frente
> pasa a ser el trabajo de `develop-styles`: adoptar la paleta y el markup de TailAdmin, migrar
> `slate-*` → `gray-*` para poder **borrar el bloque de repintados de `overrides.css`**, colapsar la
> capa de clases propias (306 clases en 11 familias de nombres, de las que 133 se usan en un solo
> fichero) y resolver las 53 reglas fuera de capa — incluida la del `<header>`.

> ⚠️ **La primera vuelta ya está archivada; va la segunda.** El plan del 2026-08-09
> cerró sus 6 fases y quedó archivado —sus cuatro ficheros sujeto ya no existen—, pero la medición
> del 2026-08-11 encontró que **la deuda que queda no vive en el CSS**: son **3 590 clases de color de
> Tailwind en las plantillas** que ningún linter ve, y **`@theme` es el cuello de botella**, no la
> disciplina (hoy no existen `bg-state-warning` ni `text-brand-text-muted`, así que ~660 de esas
> apariciones **no tenían alternativa**).
>
> **Y la segunda vuelta tambien se cerro, el 2026-08-13.** Esta archivada en
> [`docs-md-antiguos/planes-cerrados-2026-08/sistema-diseno-plantillas/`](../docs-md-antiguos/planes-cerrados-2026-08/sistema-diseno-plantillas/),
> y su bitacora sigue valiendo: es donde estan las trampas ya pagadas.
>
> **El ejecutable es ahora la TERCERA vuelta:
> [`sistema-diseno-componentes/plan-2026-08-13.md`](./sistema-diseno-componentes/plan-2026-08-13.md).**
> Va a por lo que un script no puede decidir: partir `HomeView` y `FirmarPdf` (8 159 lineas entre los
> dos), los 206 colores que viven en un ternario, el `z-index` y los tags de las tablas de admin.
>
> Lo que la segunda vuelta dejo hecho, y que este frente ya puede dar por bueno: la paleta de
> TailAdmin adoptada en dos capas, seis componentes declarados en un solo sitio, **cero repintados
> de utilidad**, **cero utilidades de foco en plantillas**, y **cuatro gates encadenados a `lint`**
> —incluido el patron de nombres de clase, que estaba en `null` y no vigilaba nada—.

---

## Frente 5 · Cobertura — 🟡

Plan propio y ejecutable: [`referencia/cobertura.md`](./referencia/cobertura.md). Su **Fase 0 está
hecha**; quedan las fases 1 y 2.

**Lo único que hay que retener antes de mirar el 17,7 %:** el gate **no pide 80 % global** —eso sería
trabajo de años y no es objetivo de nadie— sino **80 % de lo nuevo**. Hoy `new_coverage` va por 39,2 %.

> **La regla que cierra el gate sola: toda línea nueva nace con test.** El global sube como efecto
> secundario.

Y dos trampas medidas que ahorran semanas: **dos tercios del hueco del frontend son componentes
`.vue`** (caros y frágiles — los composables son el objetivo bueno), y en el backend **Node solo
instrumenta lo que algún test carga**, así que la cobertura sube solo al importar módulos nuevos.

---

## Frente 6 · Signer — 🟡

- ⬜ **Trasladar el bloque de identidad a `signer/certificates.py`** (F4 de la auditoría). Ya es
  mecánico: el corte de complejidad está hecho (142 → 84).
- ⬜ **La asimetría de las dos fuentes de extensiones**, que es un fallo funcional real y está
  congelado en un test: la fuente que corre con los certificados de pyHanko **no desenvuelve los
  `OtherName` del SAN**, así que **una AC que meta ahí la cédula da `signerCedula = None` al validar un
  PDF**.
- ⛔ **Tocar la firma sigue bloqueado** hasta que exista una prueba que firme un PDF real y lo valide.
  Los 266 casos actuales sustituyen pyHanko por dobles.
- ⬜ **Quedan 8 de los 12 riesgos abiertos** (R-1, R-4, R-5, R-6, R-7, R-9, R-10, R-12), y la
  auditoría solo marca dos como cerrados: su tabla §7 está desfasada. El más llamativo es **R-10**:
  el **puerto 4000 del firmante está publicado en los tres entornos** (`4000`, `14000`, `24000`) con
  `POST /sign` operativo, **sin autenticación y sin ningún consumidor legítimo**.
- ⬜ Y **la asimetría del SAN no tiene número R**, así que no aparece donde se buscan los riesgos.

---

## Frente 7 · Deuda de método y de infraestructura — ⬜

Pequeña, pero es la que hace que lo demás no se degrade.

| Qué | Por qué importa |
|---|---|
| **Sonar en CI** | El workflow ya está escrito y verificado (`.github/workflows/sonar.yml`, hace *skip* en verde sin secrets). **Lo que falta no es código**: el SonarQube es local y ningún runner lo alcanza. Hay que publicarlo con TLS o migrar a SonarCloud |
| **`no-restricted-imports` sobre `"axios"`** | Sin esa barrera, la migración de `httpClient` se deshace sola con el primer import despistado. Es una regla en `frontend/eslint.config.cjs` con excepción para `httpClient.js` |
| **Reconstruir las imágenes del backend** | El `unzip` explícito de los Dockerfiles **no está verificado por build** |
| **`tmpfs: /tmp` del signer en prod** | Ya no cubre el workspace, que se movió a `/var/lib/deasy-signer`. Volverlo a RAM exige `--mount type=tmpfs,tmpfs-mode=0700` con uid: la sintaxis corta dejaría la raíz `root:root 1777`, que es el problema que se cerró |
| **26 ficheros migrados a `httpClient` sin red unitaria** | Tres no se pudieron ejercitar ni en navegador: `FirmarPdf.vue`, `VerifyEmail.vue`, `SessionExpiryModal.vue` |
| **El contrato de errores no se cumple** | El backend usa hoy **15 formas distintas** de responder un error en 309 respuestas, y **han aparecido dos nuevas** desde el censo. El plan está en [`referencia/contrato-errores-api.md`](./referencia/contrato-errores-api.md) §6, fases B–G, **ninguna empezada**: quedan ~114 lecturas manuales de `.data.error`/`.data.message` en 33 ficheros del frontend |
| **El botón de sincronizar del admin llama a endpoints borrados** | Herencia del frente 0: su sub-paso 9 era el único de frontend y se quedó fuera. `apiConfig.js:101-102` declara `sync-status` y `resync`; `AdminTableManager.vue:796,804` y `AdminRecordViewerModal.vue:180-188,286-318` cablean el badge y el botón. El backend los borró en el sub-paso 8, así que **hoy dan 404 al pulsarlos** — un botón visible en el admin que no puede funcionar. Verificado el 2026-08-14. Son ~30 líneas en 3 ficheros, y **el criterio de cierre es el navegador**, no el lint |
| **Duplicación de `createZipArchive`** | Copiado en `templateArchive.js` y `user_controler.storage.js`. Es el 40,5 % de duplicación de `templateArchive` |
| **`deasy-analytics` es un contenedor vacío desplegado en QA y en producción** | `docker/analytics/Dockerfile` son 9 líneas que acaban en `CMD ["sleep","infinity"]`: sin `COPY`, sin `pip install`, y **no existe ningún directorio `analytics/` en el repo**. Aun así se construye en cada push, se publica en GHCR y corre con `restart: always` (`docker/compose.prod.yml:92`). **Decidir: construirlo o sacarlo del pipeline.** Mantener el sobre vacío cuesta build, superficie en prod y confusión documental |
| **El bot de WhatsApp no puede arrancar en las imágenes publicadas** | `docker/backend/Dockerfile` fija `PUPPETEER_SKIP_DOWNLOAD=true` (líneas 4 y 31) y **no instala Chromium en ninguna de las dos etapas** — las libs de `apt` que sí instala son las de `node-canvas` (cairo/pango/jpeg/gif/rsvg), no las de un navegador. `services/whatsapp/WhatsAppBot.js` levanta Puppeteer en proceso, así que en QA y prod hay **6 rutas HTTP vivas sobre código que no puede iniciarse**. Decidir: instalar Chromium, o retirar el bot y sus rutas |
| **`amqplib` es dependencia muerta, y el signer habla por la API de *management*** | Está en `backend/package.json:27` con **cero imports en todo el backend**. Lo que se usa de verdad es `services/infrastructure/rabbitmq_http.js`, que publica y consume por la **API HTTP de gestión** de RabbitMQ (`POST /exchanges/.../publish`, `POST /queues/.../get`), con `rabbit_signer.js:27-41` haciendo *busy-polling* cada segundo hasta 120 s. RabbitMQ documenta que `basic.get` por management API no es un consumidor de producción. Efecto medido: hasta ~240 llamadas HTTP por firma, y **una cola durable huérfana por cada timeout** (`rabbit_signer.js:20` las crea `auto_delete:false` y nadie las borra) |

---

## Frente 8 · Deuda de volumen que el plan no registra — ⬜

Descubierto al medir el repo entero el **2026-08-09** (99 039 líneas de código: frontend 54 074 ·
backend 40 350 · signer 4 341). El plan maestro publica **una sola** cifra de líneas —HomeView, 5 215—
y es **exacta al dígito**. El problema no es que mienta: es que **no cubre**. Hay ~16 000 líneas en
ficheros grandes que solo aparecen en `referencia/`, y `referencia/` **se consulta, no se ejecuta**.
Resultado: masa sin ruta de trabajo asignada.

| Qué | L | Por qué está aquí |
|---|---:|---|
| `backend/services/admin/templates/templateLifecycle.js` | **1 908** | **4.º fichero del repo** y cero menciones en este documento. Su carpeta (`services/admin/templates/`, 4 128 L) es el **6.º directorio**. Contradice de frente el «la cabeza ya no está en el backend» del frente 3 |
| `frontend/src/shared/components/widgets/WorkspaceChatLauncher.vue` | 813 | **Deuda 100 % invisible: no aparece en NINGÚN fichero de `docs/planes/`.** Componente compartido, 517 L de script |
| `backend/controllers/users/user_controler.queries.js` | 1 091 | **Fuga de capa autodeclarada**: su propia cabecera dice que es «el candidato natural a promoverse a `services/users/UserWorkspaceRepository.js` cuando se corrija la fuga de capa (SQL crudo en un controller)». El código pide el arreglo y ningún plan lo recoge. Ojo: su CC es ≈0 (824 de sus líneas son literales SQL), así que **esto no es trabajo de complejidad, es de capas** |
| `backend/services/admin/crud/tableHooks.js` | 1 137 | **El caso que hay que decidir, no asumir.** Su cabecera lo presenta como «el equivalente backend de `FK_TABLE_MAP`» —o sea datos declarativos— pero contiene ~180 bloques de función. No está declarado no-tocar en ninguna parte |

**Y una corrección a la receta del frente 3, medida:** «un `<template>` de 2 000 líneas» **solo aplica
a HomeView** (2 118 L de marcado frente a 3 011 de script). En los otros diez `.vue` grandes el
`<script>` es el **60–75 %** — `AdminTableManager` es 1 037 / 3 184. Tratarlos igual desperdicia
esfuerzo: HomeView pide extraer **componentes**; los demás, **composables**.

**Criterio de cierre:** los cuatro con una decisión escrita (atacar, o declarar no-tocar con su
motivo). No hace falta refactorizarlos para cerrar el frente; hace falta que dejen de ser invisibles.

---

## Frente 10 · El compilador documental: auditar la rama que existe — ⬜

**Existe, tiene commit propio y nunca se fusionó.** `e53a59a` (2026-04-03), en
**`origin/feature/compilador-latex`**: *«Compilador: Implementación del micro-servicio de compilación
de latex»*. **21 ficheros**, y no era un boceto — la carpeta `compiler/` con su README y su superficie
HTTP, siete servicios en el backend (`DocumentCompilationPipelineService`,
`DocumentCompilerOrchestratorService`, `DocumentCompilerPayloadService`,
`DocumentTemplateTechnicalValidatorService` con 366 líneas, `compiler_http.js`…) y su entrada en el
workflow de CI. **Nada de eso existe en `develop`.**

Su README describe lo que el §0.4 va a necesitar: *«vivir como servicio raíz independiente,
desplegarse con imagen propia, exponer API de compilación al backend, encapsular render, compilación
LaTeX, storage y reportes»*, con `POST /compile`, `GET /compile/:jobId` y `POST /validate-template`.

**No tiene nada que ver con `deasy-analytics`** —que sigue en pie, con su `sleep infinity`, porque la
decisión de sacarlo del pipeline (frente 7) se tomó y **nunca se ejecutó**.

#### Por qué este microservicio SÍ se gana el sueldo, y los demás no

La [pregunta arquitectónica](#la-pregunta-arquitectónica-está-cerrada-2026-08-09) está cerrada: se
evaluaron 15 arquitecturas y ninguna baja la complejidad. **Este caso es la excepción, y por los
mismos criterios que descartaron a los demás:**

- Lo que mató partir el backend fue que **el 45 % de las FKs cruzan cualquier frontera** y que **de
  las 18 transacciones, cero quedan dentro de un solo subdominio**. Un compilador **no toca ni una
  tabla**: no tiene ninguno de los dos problemas.
- Los dos aislamientos que sí existen aquí se justifican por **runtime ajeno**: el `signer` está fuera
  porque pyHanko es Python. LaTeX necesita una imagen de **TeX Live de gigabytes**, y meterla en la
  imagen del backend —que atiende 162 endpoints— es lo contrario de lo que se hizo al sacar Puppeteer.
- **Y hay un argumento de seguridad que los otros no tienen: compilar LaTeX es ejecutar código.**
  `artifacts.js:16-38` ya sanea `\write18`, `\directlua`, `\openout` y `\ShellEscape` — pero eso es
  una **lista negra**, y las listas negras se rodean. Un contenedor efímero y sin red es una defensa
  de otra categoría.

#### Lo que hay que auditar antes de fusionar nada

**La rama es de abril, anterior a todo el §0.8**, y su pipeline se construyó sobre el modelo que
acabamos de retirar — su `DocumentRuntimeService` y su `DocumentCompilerPayloadService` leían el
`meta.yaml`. **No se fusiona a ciegas.** La auditoría tiene que decir, con evidencia:

1. Qué sobrevive del diseño y qué está construido sobre lo que ya no existe.
2. Si `DocumentTemplateTechnicalValidatorService` (366 L) cubre lo que el **S4 del §0.4** acaba de
   hacer a mano —el balance de bloques Jinja— y si lo hace mejor.
3. Cómo integrarlo **sin heredar la factura del `signer`**, que tiene **8 de 12 riesgos abiertos**:
   RPC bloqueante con *busy-polling*, cero reintentos, cero DLQ, cero idempotencia, una cola durable
   huérfana por timeout, y el puerto publicado sin autenticación en los tres entornos.
   **Ventaja que el signer no tiene: compilar es idempotente por naturaleza** —mismo código, mismo
   PDF—, así que reintentar es gratis y no hace falta inventar nada.

**Criterio de cierre:** una decisión escrita —retomar la rama, reescribir desde su diseño, o
descartarla— con el inventario de qué se aprovecha.

> ⚠️ **PRIORIDAD SUBIDA el 2026-08-13.** Cuando se abrió este frente era «material real que estaba a
> punto de perderse». Ya no: **el compilador es camino crítico de tres cosas a la vez**.
>
> 1. **La mitad de ejecución del generador (§0.4 S8).** El generador emite macros que algo tiene que
>    rellenar con el token del firmante resuelto. Sin compilador, el §0.4 entrega el andamio pero no
>    el circuito.
> 2. **La vista previa del editor web (frente 11).** Y ahí es *la* pieza que da el valor — ver el
>    resultado en segundos en vez de descargar, compilar en local y volver a subir.
> 3. **La generación automática de PDFs**, que es el segundo mundo entero del modelo de negocio.
>
> Deja de ser una curiosidad histórica: **es de lo que cuelgan tres frentes.**

#### Y hereda el S8 del §0.4 — el generador

**Movido aquí el 2026-08-13**, al cerrar el Frente 0. El §0.4 dejó **todo el terreno preparado** —el
ZIP compila, los campos tienen tabla y son consultables por SQL, el slot de firma es estable— pero
**el generador en sí es construcción, no limpieza**, y su mitad de ejecución depende de este frente.

**Qué falta, en concreto:**

- **La mitad de autoría**: emitir `template/jinja2/Preambulo/campos.tex.j2` al guardar la plantilla, con
  una macro por campo configurado y una por paso de firma con su token. Va en la **zona protegida**, y
  eso no es un detalle: el re-upload rechaza protegidos modificados, así que **el usuario no puede
  haber editado el fichero generado** — la pregunta de «¿y si ya lo tocó?» se disuelve por mecanismo.
  Esta mitad **no depende del compilador** y se puede hacer en cualquier momento.
- **La mitad de ejecución**: rellenar esas macros con los valores del usuario y **el token del firmante
  resuelto**, y compilar. **Ésta sí depende de este frente.**

**El criterio de éxito no es un test verde** —char fue ciega tres veces en el §0.4—: es **descargar el
ZIP, compilar y ver el PDF con los tokens dentro**, como ya consiguió el S1 (`rc=0`, 2 páginas,
`!-9b6D6WnuUE-!` en el texto).

**Y una decisión que sigue abierta:** el modelo de campo **no tiene valor por defecto**
(`template_artifact_fields` guarda clave, título, código, componente, grupo y obligatoriedad, pero ni
`default` ni opciones de `select`). Sin eso, «una base con los valores configurados» solo puede emitir
**nombres**. No bloquea la mitad de autoría —los tokens no necesitan valor— pero hay que decidirlo.

---

## Frente 11 · El editor web de plantillas — ⬜ · **son DOS productos, no uno**

Idea del dueño (2026-08-13). Hoy el gestor sube su plantilla en Word/Excel y **un admin la pasa a
LaTeX a mano**. La propuesta: un editor tipo Overleaf, en la web, para hacer ese paso.

**Verificado antes de analizar: no existe nada.** Ni CodeMirror, ni Monaco, ni TipTap, ni ninguna
dependencia de editor en `frontend/package.json`. La única rama relacionada es la del compilador.

#### Producto A — el taller del admin (puntos 1-3) · **viable, y con el andamiaje medio construido**

Controlar las semillas con interfaz de edición, crear las plantillas a partir de los formatos Word que
la medición marque como prioritarios, y **a la larga, que el gestor las cree solo**.

Técnicamente es: editor de código en el navegador + árbol de ficheros + compilar con vista previa +
guardar. **Y casi todo lo caro ya existe, sin que se construyera para esto:**

| Lo que necesita | Ya está |
|---|---|
| Estructura del paquete y zona editable | `Contenido/` vs protegido, con manifiesto |
| Validación al guardar | SHA-256 del manifiesto, path traversal, saneo LaTeX |
| Validar el Jinja | El balance de bloques del **§0.4 S4** |
| Leer y escribir el paquete | La API de `draft` y `/source` |
| Compilar | **Frente 10** |

El editor de código es una biblioteca de estantería. **Lo que suele costar un producto así —el sandbox
de compilación, el modelo de ficheros, la validación de lo que se sube— ya está.**

**Y el punto 3 es el premio estratégico, aunque venía tercero en la lista:** *«que el gestor pueda
crear las plantillas de manera autónoma»* es **quitar al admin del cuello de botella**, que es la
lógica del modelo entero — medir, automatizar, delegar.

#### Producto B — el editor del usuario final (punto 4) · **otro producto, decisión aparte**

Que el usuario redacte sus propios informes (memorandos con tablas, figuras, imágenes) en la web.

**No es lo mismo.** El usuario no debe escribir LaTeX, así que hace falta un editor visual **y una
traducción de texto enriquecido a LaTeX** — tablas anidadas, imágenes posicionadas, saltos de página:
donde estos proyectos se atascan.

Encaja en el modelo (sería para los `routed`, libres por diseño), pero **su valor es distinto**:
sustituye «escribo en Word, exporto, subo» por «escribo en la web». Es mejora de **experiencia**, no de
**control** — y el control es lo que este sistema aporta. **Compartir la palabra «editor» no los hace
el mismo producto.**

#### La arquitectura: el editor NO es un microservicio

Se propuso como servicio separado. **El compilador sí lo es; el editor no.**

El editor es **frontend**: un navegador que habla con la API que ya existe y con el compilador. **No
tiene runtime ajeno, no ejecuta código y no tiene estado propio** — que son los tres criterios por los
que el `signer` y el compilador sí se ganan estar fuera. Meterlo en un servicio propio sería otra app,
otro despliegue y otra sesión **sin ganar nada**, y es justo el error que
[la pregunta arquitectónica](#la-pregunta-arquitectónica-está-cerrada-2026-08-09) descartó.

**La forma son tres piezas, no cuatro:** editor (frontend) → backend (API existente) → compilador
(servicio). *(La excepción sería edición colaborativa en vivo, que sí pide estado y websockets. No se
ha pedido.)*

#### El empujón en contra, que es lo que hay que tener delante

**¿El dolor del admin es que no tiene buen editor, o que convertir un Word en una plantilla LaTeX
parametrizada es trabajo de DISEÑO?** Decidir qué es fijo, qué es campo, dónde van las firmas y cómo se
comporta con datos variables **no es teclear**. Un editor no hace ese trabajo más fácil.

**Pero sí acorta brutalmente el bucle de realimentación**, y ahí es donde se va el tiempo de diseño:
probar, mirar, ajustar. Hoy ese ciclo es descargar, editar, compilar en local, mirar, volver a subir.

> **Corolario que cambia la prioridad interna: la VISTA PREVIA vale más que el editor.** Si hubiera que
> partir este frente, lo primero no es el editor de código — es poder compilar y ver el resultado.

**Criterio de cierre:** una decisión escrita sobre el producto A, con su alcance separado del B. **No
antes del frente 10**: sin compilador, la pieza que da el valor no existe.

---

## Frente 9 · La capa de datos — ⬜ · vive en [`plan_data/`](./plan_data/)

**Tiene carpeta propia** —como el 1 y el 4— porque trae su propia referencia medida del esquema, y desde
el 2026-08-14 **también su `§0 · Control de ejecución`**. Nació el
**2026-08-09** al contestar *«¿conviene una clase por cada tabla?»* —la respuesta es **no**, razonada
con cifras en su §1—, pero la pregunta obligó a mirar la persistencia entera y aparecieron seis
problemas que ningún frente de aquí cubría. **Las tareas están allí**, no en este documento:

| | Fase | Por qué |
|---|---|---|
| **D7** | **Auditoría funcional del modelo** | Lo que el **frente 0 inventarió y no llegó a validar**, recogido aquí el 2026-08-14 al archivarlo: la edición `retired` que sigue enlazada, la invariante de `published` que descansa en un razonamiento —`launch.js` **no mira `lifecycle_state`**—, y las columnas `*_id` sin FK, dos de ellas por **descuido de tipo** (`BIGINT` contra `persons.id INT`). **Va la primera pese al número**: es la única fase que no es refactor, y sus dos primeras tareas son decisiones del dueño |
| **D1** | Un solo `withTransaction` | **20 `beginTransaction` a mano en 11 ficheros**, cada uno con su ciclo. El helper correcto ya existe (`crud/tableHooks.js:65-92`) y solo lo usa el CRUD admin |
| **D2** | Un vocabulario de estados, no cinco | `task_items.status` está definido en **5 sitios con 3 alfabetos**, y los dos grupos **no comparten ni un literal**. Efecto vivo: el panel cuenta `completada` como cerrado; el motor de relevos lo reasigna |
| **D3** | Migraciones versionadas | El esquema se reaplica entero en cada arranque (`postgres_initializer.js:23-40`). Idempotente para crear, **incapaz de alterar**. Es el mayor riesgo operativo de la capa |
| **D4** | Repositorios **por agregado** (10, no 67) | Cierra la fuga de capa del frente 8: `user_controler.queries.js` → `UserWorkspaceRepository` |
| **D5** | Matar el traductor de dialecto | `config/postgres.js`: **241 cognitiva en 391 ncloc**, el más denso del repo, y los defectos 1.5/1.6/1.11 salieron todos de ahí. **D5-b está ⛔ hasta censar los call sites del 1.11** |
| **D6** | Validación por esquema en el borde | 0 dependencias de validación; tres capas artesanales desconectadas, y las rutas fuera del CRUD admin sin ninguna |

**No contradice nada de lo de abajo.** Rechaza la clase por tabla y el ORM por el mismo criterio que
cierra la pregunta arquitectónica: tablas y extracción, no jerarquías. Y respeta la lista de no-tocar
—el núcleo CRUD de `SqlAdminService` y `sqlTables.js` como datos—: D2 y D4 trabajan **alrededor**.

**Criterio de cierre:** las **siete** fases cerradas con sus criterios, y la carpeta archivada.

---

## Lo que NO se toca, y por qué

Está detallado en [`referencia/metodo.md`](./referencia/metodo.md). El resumen, para que nadie «mejore»
lo que ya está bien:

- **`backend/config/sqlTables.js`** y su gemelo del frontend: son **datos**. La duplicación es la forma correcta.
- **`AdminTableManager.vue`**: motor de metadatos legítimo. Extraer los injertos, **sin polimorfismo**.
- **`useDeliverableView.js`**: proyección de solo lectura, medido. Hacerlo dueño de su estado **invertiría** el acoplamiento.
- **`_resolveDraftRequest`** (CC 25): es una cascada de guardas y **su ORDEN es contrato** —caracterizado, y el frontend distingue los mensajes—. Convertirla en tabla es tentador y arriesgado.
- **Los falsos positivos ya marcados** (§7 de la referencia): 28 marcas vivas, entre ellas las 23 de `S1135`, que son la palabra española «todo» en comentarios.
- **Las 48 incidencias de ternarios anidados y las 28 de regex**: sin fase **a propósito**. Reescribir un ternario cambia estructura, no forma; las regex piden mirarse una a una y solo el ReDoS de `AgregarReferencia` tiene riesgo real. **Es deuda decidida, no olvidada.** Si se atacan, que sea por un motivo concreto, no por bajar el contador.

---

## La pregunta arquitectónica está cerrada (2026-08-09)

Se evaluaron **quince arquitecturas** contra este repo, con medición y no con doctrina: monolítica,
monolito modular, en capas, N-capas, SOA, microservicios, serverless, event-driven, P2P, space-based,
hexagonal, clean, onion, DDD, y los patrones CQRS / Event Sourcing / Pipes & Filters / Blackboard /
Broker. **Ninguna baja la complejidad cognitiva de este sistema.** Queda escrito aquí para que no
vuelva a plantearse de cero dentro de tres meses.

**Las tres pruebas son internas, no teóricas:**

1. **El signer ya está distribuido al máximo** —proceso propio, runtime propio, RabbitMQ + MinIO— y es
   **el peor fichero del repositorio** (`app.py`, cogn ~353). La separación no le quitó un punto, y le
   añadió R-1 y R-10, que **existen únicamente porque está fuera**.
2. **El realtime se distribuyó y se deshizo, y salió bien.** EMQX exigía un sistema de credenciales y
   ACL espejo del de la app que nunca se construyó; al colapsarlo dentro (`RealtimeGateway.js:14-20`)
   la autorización se **reutiliza** en vez de duplicarse.
3. **`deasy-analytics` es el aviso**: un microservicio sin código lleva meses desplegado en QA y prod.
   En este repo el sobre del microservicio se paga aunque esté vacío (ver frente 7).

**Lo que impide cualquier corte, medido:** el **45 % de las FKs** cruzan cualquier frontera de dominio
que se dibuje; hay **ciclos de FK bidireccionales** entre procesos ↔ plantillas ↔ firma, así que
ningún lado puede ser dueño del dato; y de los **18 puntos de `beginTransaction`, cero quedan dentro
de un solo subdominio** —todos abarcan 3 o 4—. Cada corte convierte transacciones ACID en sagas, sin
tracing, sin métricas, sin logging estructurado y con un mantenedor.

**Y las que «sí aplican» ya están implementadas.** Monolito modular y capas: 0 violaciones
`routes→services`, 0 `services→controllers`, 0 `req`/`res` filtrados a `services/`. Hexagonal/Clean:
la inyección ya existe (`constructor(pool = getPostgresPool())`), y **sin TypeScript un «puerto» es un
comentario**. Adoptarlas formalmente es reetiquetar carpetas: **0 puntos de complejidad**.

**El dato que reencuadra el problema:** `HomeView.vue`, con ~350 de complejidad agregada, tiene **cero
incidencias `S3776` abiertas**. Su complejidad no está en ninguna función —está repartida en cientos
de ramas planas y 2 118 líneas de `<template>`—, y **ninguna arquitectura opera a esa escala**. Lo que
sí funcionó aquí está medido cuatro veces y es intra-función: `validateTableRules` 99→0,
`postgres.js` 108→15, `useAdminSubmitFlow` 67→7, `saveTemplateArtifactDraft` 164→21.

> Esto **extiende** la postura de [`referencia/patrones-diseno.md`](./referencia/patrones-diseno.md)
> un piso hacia arriba: si los patrones GoF solo se ganan el sueldo en tres sitios de este repo, los
> patrones **arquitectónicos** no se lo ganan en ninguno.

**Lo único de las quince con retorno medible en complejidad**, y llega por la puerta que este repo ya
aprueba (quitar duplicación, no añadir jerarquía): **extraer el CTE del subárbol organizacional**,
hoy duplicado **8 veces en 5 ficheros**, con **dos bloques byte-idénticos dentro de una sola función**
(`services/admin/generation/assignees.js:11`, cogn 33). Vale **−30 a −50 puntos**. Si se ataca, el SQL
va probado con `PREPARE` antes de borrar cada copia, y los goldens **no se mueven**.

---

## Una advertencia sobre las expectativas

Entre el 2026-08-06 y el 08-09 las incidencias cayeron de 832 a 373 y la deuda de 4 902 a 2 846
minutos. **Eso no se va a repetir.** Aquella caída la produjeron seis reglas que se cerraban en bloque
—imports muertos, `replace`→`replaceAll`, falsos `TODO`, etiquetado de formularios— y **ya están las
seis cerradas**. Lo que queda pide criterio de una en una.

Medir progreso por el contador de incidencias a partir de aquí lleva a la frustración. Los indicadores
buenos ahora son otros: **defectos reales cerrados**, **cobertura de lo nuevo**, y que las notas no
bajen.
