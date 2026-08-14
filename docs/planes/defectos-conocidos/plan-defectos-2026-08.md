# Frente 1 · Defectos conocidos y sin arreglar

> **Estado: 4 de 17 tareas · 1 de 5 defectos** — abierto el **2026-08-14**.
>
> Este es el **ejecutable** del frente 1. El [plan maestro](../plan-maestro-2026-08.md) delega aquí y
> no repite ninguna tarea. Lo ya cerrado —**diez fichas**— vive en [`bitacora.md`](./bitacora.md),
> con su razonamiento entero, porque la mitad de ese razonamiento es *por qué no se hizo de la otra
> forma*.
>
> **Antes de tocar nada**: [`CLAUDE.md`](./CLAUDE.md) de esta carpeta (cómo se lleva el control) y
> [`referencia/metodo.md`](../referencia/metodo.md) (las 18 reglas del repo).

**Por qué este frente va primero.** No es deuda estética: son fallos que un usuario puede encontrarse.
Y **están congelados en pruebas**, así que el arreglo se verifica solo — cuando el defecto muere, su
golden cambia, y ese diff *es* la prueba. Es la mejor relación entre riesgo y esfuerzo que queda en el
plan.

---

## §0 · Control de ejecución

> **Esta tabla es el estado del plan.** Se actualiza **en el mismo commit** que la tarea que cierra —
> la regla está en [`CLAUDE.md`](./CLAUDE.md) §2. Los identificadores no se renumeran nunca.
>
> `⬜` sin empezar · `🟡` a medias · `⛔` bloqueada (con la causa escrita) · `✅` cerrada (con evidencia y fecha)

| Tarea | Defecto | Qué entrega | Estado | Evidencia | Fecha |
|---|---|---|---|---|---|
| `T1.3-a` | 1.3 | **Decisión escrita**: quién puede reclamar una solicitud `is_manual` sin responsable, y qué pasa si ya la reclamó otro | ⬜ | — | — |
| `T1.3-b` | 1.3 | El guard implementado en `FillRequestWorkflowService`, con el golden `manual_autoasignacion_efecto` movido | ⬜ | — | — |
| `T1.3-c` | 1.3 | Unitarios del servicio cubriendo las dos ramas (reclamable / ya reclamada) | ⬜ | — | — |
| `T1.7-a` | 1.7 | **Reproducción en navegador** del sello fantasma, con la decisión: ¿el preview debe existir o es código muerto? | ⬜ | — | — |
| `T1.7-b` | 1.7 | El guard arreglado (o el código muerto borrado), verificado en navegador | ⬜ | — | — |
| `T1.7-c` | 1.7 | `referencia/frontend.md` corregido — hoy afirma lo contrario de lo que hace el código | ⬜ | — | — |
| `T1.8-a` | 1.8 | La cabecera de `errors/HttpError.js` **deja de enseñar forma**: remite al contrato §4 y dice que la clase no lleva `code` | ✅ | `grep -n "res.status" backend/errors/HttpError.js` → 0 resultados | 2026-08-14 |
| `T1.8-b` | 1.8 | Frontera escrita: el helper `fail()` es la puerta del frente 7, no de éste. Y la cifra del censo deja de estar en dos sitios | ✅ | Nota en contrato §6 + fila del frente 7 del maestro reescrita (decía 309/15, no reproducible) | 2026-08-14 |
| `T1.8-c` | 1.8 | **Nueva.** El §4.1 del contrato define qué es `code` y qué no, y retira `login_user.js` como ejemplo bendecido | ✅ | Censo: 8 de 10 emisores repiten el status; 0 lectores en front/signer/scripts | 2026-08-14 |
| `T1.8-d` | 1.8 | **Nueva.** La página publicada de Starlight remite al contrato y deja de leerse como norma | ✅ | `docs pnpm run build` verde; +1 router corregido (eran 4, no 3) | 2026-08-14 |
| `T1.10-a` | 1.10 | **Censo cerrado** de los caminos que reasignan sin dejar asiento (hoy son **tres**, no uno) | ⬜ | — | — |
| `T1.10-b` | 1.10 | **Decisión escrita**: dónde se escribe el asiento — en el trigger plpgsql o en la capa de servicio | ⬜ | — | — |
| `T1.10-c` | 1.10 | El asiento se escribe en los tres caminos; `occupancy_end` y `position_deactivated` dejan de ser inalcanzables | ⬜ | — | — |
| `T1.10-d` | 1.10 | **Decisión escrita**: quién LEE `task_item_handovers` (hoy: nadie, cero `SELECT` en el repo) | ⬜ | — | — |
| `T1.11-a` | 1.11 | **Censo** de los call sites que pasan más parámetros que placeholders a propósito | ⬜ | — | — |
| `T1.11-b` | 1.11 | **Decisión escrita**: endurecer, avisar, o dejarlo con la razón por escrito | ⬜ | — | — |
| `T1.11-c` | 1.11 | La decisión implementada, con su unitario | ⬜ | — | — |

**Resumen por defecto** (se deriva de la tabla de arriba; no es una segunda lista de tareas):

| Defecto | Título corto | Superficie | Estado |
|---|---|---|---|
| **1.3** | Auto-apropiación de una solicitud manual | Backend · servicio | ⬜ |
| **1.7** | El sello fantasma: un guard permanentemente verdadero | Frontend · Vue | ⬜ |
| ~~**1.8**~~ | ~~Dos documentos del repo mandan formas de error contrarias~~ | Backend · documental | ✅ **2026-08-14** |
| **1.10** | La única bitácora de auditoría la puentea el camino automático | Base de datos · triggers | ⬜ |
| **1.11** | Parámetros de MÁS se ignoran en silencio | Backend · `config/postgres.js` | ⬜ |

---

## §1 · Cómo se cierra un defecto aquí

Tres criterios, y ninguno es «lo he probado»:

1. **Si el defecto tiene golden, el golden se mueve.** Ese diff es la prueba. Un arreglo que no mueve
   el golden que debería mover no arregló lo que creías.
2. **Si el defecto es latente** —sin disparador vivo, como el 1.5 y el 1.13— **ningún golden se
   mueve, y eso es correcto**. La evidencia entonces es un unitario que vigila la invariante *más* la
   medición que demuestra que no había disparador.
3. **La clave del golden se renombra si decía «defecto»** (modelo `return_ok`/`return_efecto`, commit
   `2b07180`) — salvo cuando el **valor** del golden es la prueba del arreglo, y entonces la clave se
   queda quieta (criterio del 1.12 y del `defecto_deliverable_huerfano`).

---

## §2 · Defecto 1.3 — con `is_manual` y sin responsable, cualquiera se apropia de la solicitud

**Dónde**: `backend/services/documents/FillRequestWorkflowService.js:237`.

```js
const assignedPersonId = context.assigned_person_id || (context.is_manual ? Number(user.id) : null);
```

**Qué pasa.** Una solicitud de entrega marcada `is_manual` y todavía sin `assigned_person_id` no tiene
dueño: la reclama quien la toque. El `UPDATE` de justo debajo le escribe **el id de quien llamó**. No
hay guard de quién puede hacerlo ni qué pasa si dos personas lo intentan; gana la última en escribir.

**Está congelado.** Golden `manual_autoasignacion_efecto` en `sign_workflow`
(`backend/tests/characterization/flows/zzzz_sign_workflow.test.mjs:326`), que hoy retrata el efecto:

```json
{ "reclamada_por_el_gestor": true, "status": "in_progress" }
```

**Lo que falta antes de tocar código, y no es una formalidad.** El comportamiento actual puede ser
*deliberado*: «manual» podría significar precisamente «quien la coja». La ficha original lo da por
defecto sin haberlo preguntado. Así que `T1.3-a` es una **decisión de producto**, no de código:

- ¿Quién puede reclamar? (¿cualquiera con acceso al flujo, solo el ámbito de la unidad, solo un cargo?)
- ¿Y si ya está reclamada? El código de respuesta correcto sería **409** por el mismo razonamiento
  escrito para el 1.2: la petición está bien formada, lo que no admite la operación es el **estado**
  del recurso.

**Criterio de cierre**: el golden `manual_autoasignacion_efecto` movido con la regla nueva, y las dos
ramas cubiertas por unitarios.

---

## §3 · Defecto 1.7 — el sello fantasma

**Dónde**: `frontend/src/modules/firmas/components/MultiSignerPanel.vue`.

Verificado el **2026-08-14**, sigue vivo, y es exactamente esta forma:

| Línea | Qué dice |
|---|---|
| `:556` | `const previewBoxStyle = ref({ display: 'none' });` — nace oculto |
| `:169` | `v-if="isMouseOverPdf && selectionMode === 'preset' && previewBoxStyle.display !== 'none' && …"` |
| `:911` | la asignación del `pointermove` escribe `left`, `top`, `width`, `height` — **y no `display`** |

Tras el primer `pointermove` en modo `preset`, `previewBoxStyle.display` es `undefined`, y
`undefined !== 'none'` es **siempre cierto**. Ese tercer término del `v-if` no vuelve a filtrar nada
en toda la vida del componente: es **un guard permanentemente verdadero**, o sea código muerto que
aparenta condicionar algo.

**El efecto visible hay que mirarlo, no deducirlo.** Los otros dos términos (`isMouseOverPdf`,
`selectionMode === 'preset'`) sí filtran, así que el fantasma no se ve *fuera* del PDF ni en modo
manual. Por eso `T1.7-a` es **navegador antes que editor**:

- Entrar como **gestor** (cédula `0987654321` / `Gestor1234!`) — el admin tiene bloqueado el espacio
  de usuario por `meta: { blockedForAdmin: true }`.
- Abrir el panel de firma múltiple con un PDF cargado, modo **preset**, y mover el puntero dentro y
  fuera del visor.
- Preguntar: ¿la caja de vista previa **debe** existir? Si sí, el arreglo es incluir `display` en la
  asignación de `:911`; si no, se borra el término del `v-if` y el `ref` sobra.

**Aviso de documentación contradictoria.** [`referencia/frontend.md`](../referencia/frontend.md)
afirma que `isMouseOverPdf` «nunca se lee», y **sí se lee, en `:169`**. El único diagnóstico correcto
está en [`referencia/god-objects-2026-07.md`](../referencia/god-objects-2026-07.md) §3.4. Corregirlo
es `T1.7-c` y no es opcional: una referencia que miente cuesta más que el defecto.

**Criterio de cierre**: comportamiento decidido y verificado en navegador (aquí no hay golden que
mover), y la referencia corregida.

---

## ~~§4 · Defecto 1.8 — dos documentos del repo mandan formas de error contrarias~~

✅ **CERRADO el 2026-08-14.** La ficha entera, con lo que se descartó y por qué, está en
[`bitacora.md` § 1.8](./bitacora.md#18--dos-documentos-del-repo-mandaban-formas-de-error-contrarias-y-eran-cinco).

En una línea: **eran cinco documentos, no dos**, y uno de ellos es la documentación **publicada**. La
cabecera de `HttpError.js` **no se corrigió, se le retiró el ejemplo** —un ejemplo duplicado vuelve a
divergir; un puntero no—, y `code` **se quedó en el contrato pese a no leerlo nadie**, porque
retirarlo dejaba no conforme a la única implementación correcta del backend.

---

## §5 · Defecto 1.10 — la única bitácora de auditoría la puentea el camino automático

**El más grande de los cinco, y el que peor está descrito en el maestro**: son **tres** caminos, no
uno. Todo lo de abajo se remidió el **2026-08-14**.

### La tabla, y su `CHECK` con dos valores inalcanzables

`backend/database/postgres_schema.sql:1121-1134`:

```sql
trigger_kind TEXT CHECK (trigger_kind IN ('occupancy_end','position_deactivated','manual'))
  NOT NULL DEFAULT 'manual',
```

### Los tres caminos que reasignan un entregable

| # | Camino | Dónde | ¿Deja asiento? |
|---|---|---|---|
| 1 | **Traspaso manual** | `services/admin/org/taskAssignment.js:285` (`handoverTaskItem`), expuesto en `POST /admin/sql/task-items/:id/handover` | ✅ **Sí** — el único `INSERT` de todo el repo |
| 2 | **Trigger de ocupación** | `postgres_schema.sql:1721-1734` (`trg_position_assignments_after_update_fn`): pone `assigned_person_id = NULL` al cerrar la ocupación, y la persona nueva al abrirla | ❌ **No** |
| 3 | **Backfill de reconciliación** | `taskAssignment.js:227-254` (`reconcileOpenTaskItemAssignments`), expuesto en `POST /admin/sql/task-items/reconcile-assignments` | ❌ **No** |

Es decir: **los relevos que ocurren solos —que son justo los que nadie recuerda— no dejan rastro**, y
por eso dos de los tres valores del `CHECK` (`occupancy_end` y `position_deactivated`) son hoy
literalmente inalcanzables. El camino 3 es peor de lo que parece: tiene superficie HTTP, mueve N filas
de golpe y devuelve solo un contador (`{ reconciled }`).

### El hallazgo nuevo: la tabla es de solo escritura

Censo del repo entero: **un `INSERT`, cero `SELECT`**. La única lectura que existe es un `DELETE` de
limpieza del harness (`tests/characterization/lib/db.mjs:233`). No hay endpoint que la consulte ni
pantalla que la muestre — el frontend no menciona `handover` en ningún sitio.

Eso convierte `T1.10-d` en una pregunta que hay que contestar **antes** de escribir más filas: si
nadie lee la bitácora, arreglar el defecto la llena de datos que nadie consulta. Las salidas honestas
son dos —darle un lector (aunque sea una pestaña de solo lectura) o justificar por escrito que es una
bitácora forense a la que se entra por SQL— y cualquiera de las dos vale; lo que no vale es no
decidir.

### La decisión de diseño de `T1.10-b`

Dónde se escribe el asiento no es indiferente:

- **En el trigger plpgsql**: captura los relevos automáticos *pase lo que pase*, incluso los que
  vengan de un `UPDATE` a mano. Pero el trigger no sabe *quién* lo provocó (`performed_by_user_id`
  quedaría `NULL`) y meter lógica de auditoría en plpgsql aumenta la superficie de lo que el esquema
  hace en silencio.
- **En la capa de servicio**: sabe el usuario y es depurable, pero **el camino 2 no pasa por ella** —
  lo dispara un `UPDATE` a `position_assignments`, que puede venir del CRUD genérico.

**Cuidado con el predicado.** Los tres caminos comparten literalmente el mismo filtro de «entregable
abierto y no iniciado» (`status NOT IN (…)` + `user_started_at IS NULL`). El día que se toque uno hay
que tocar los tres o dejarán de coincidir; y la señal correcta es `user_started_at`, **no** la
ausencia de documento — esa condición nunca se cumplía y tuvo los triggers sin mover una fila
(está contado en la cabecera de `tests/characterization/flows/zzzzz_task_item_relay.test.mjs`).

**Criterio de cierre**: los tres caminos dejan asiento con su `trigger_kind` correcto, un golden nuevo
en `task_item_relay` lo retrata, y la decisión de `T1.10-d` está escrita en el propio fichero (no solo
aquí).

---

## §6 · Defecto 1.11 — los parámetros de MÁS se ignoran en silencio

**Dónde**: `backend/config/postgres.js:142-162`.

Es el modo de fallo del 1.5 en la otra dirección, y se descubrió al arreglarlo. Hoy `bindParams`
**falla ruidosamente si faltan** parámetros —lo hace el 1.5, ya cerrado— y **calla si sobran**:

```js
// Sobrar parámetros SÍ se tolera (mysql2 hacía lo mismo): los de más se ignoran y hay
// call sites que reutilizan un array de argumentos más largo que la consulta.
```

**Se dejó así a propósito**, y la razón sigue siendo válida: mysql2 se comportaba igual y hay llamadas
que reutilizan a propósito un array más largo que la consulta. El radio de impacto es mucho mayor que
el del 1.5, donde bastó con lanzar.

**Por eso el orden importa**: `T1.11-a` es **censar** esos call sites, y hasta que ese censo exista no
se toca nada. La fase **D5-b** del [`plan_data/`](../plan_data/) está `⛔ bloqueada` por este censo,
así que la tarea rinde el doble.

Cómo censar, sin invento: la vía que ya funcionó en el 1.5 fue **sonda + barrido** — instrumentar
`bindParams` para registrar los desajustes, correr `test:char:run` (240 flujos), y barrer las llamadas
del repo contando placeholders contra parámetros. En el 1.5 el barrido cubrió 493 llamadas y 429
fueron decidibles estáticamente; el resto exige leer.

Tres salidas posibles para `T1.11-b`, y las tres son aceptables si van con su razón:

1. **Endurecer** (lanzar, como con los que faltan) — solo si el censo demuestra que nadie lo usa.
2. **Avisar** (log con el sitio) — captura los casos nuevos sin romper los viejos.
3. **Dejarlo y escribirlo** — con el censo enlazado, para que no se vuelva a proponer a ciegas.

**Criterio de cierre**: el censo publicado, la decisión escrita **encima de la propia función**, y
D5-b desbloqueada o bloqueada por otra cosa.

---

## §7 · Orden sugerido

No es arbitrario: va de lo que se decide solo a lo que necesita una decisión de producto.

1. **1.8** — es documental, no rompe nada y deja de sembrar deuda desde el minuto uno.
2. **1.11 (`T1.11-a`)** — el censo, porque además desbloquea D5-b del plan de datos.
3. **1.7** — pide navegador, pero el radio es un componente y seis líneas.
4. **1.10** — el más caro y el que más decisiones tiene; empieza por `T1.10-d`, que puede cambiar todo
   lo demás.
5. **1.3** — el último a propósito: no se puede escribir el guard hasta que la regla esté decidida, y
   la regla no es técnica.

---

## §8 · Lo que se comprobó y NO era un defecto

Escrito aquí para que no vuelva a proponerse. El detalle completo, en [`bitacora.md`](./bitacora.md).

| Candidato | Veredicto |
|---|---|
| `services/chat/ChatAuthorizationService.js` — «una copia del IDOR se quedó atrás» | ❌ **No era un defecto** (2026-08-09, medido). Aplicar el guard **rompía el chat** a 8 de 10 asignados. La razón está escrita encima de la propia consulta |
| `generation/launch.js:224` — `UPDATE tasks SET process_run_id` | ❌ No es pérdida de trazabilidad: es la «Opción X» **deliberada**, y el modelo de `process_runs` se diseñó así |
| `controllers/tareas/tareas_controler.js:79` — «otra copia del IDOR» | ❌ Lista *tareas* vía `task_assignments` y solo expone un agregado (`task_item_count`, `task_item_names`), no entregables individuales |
