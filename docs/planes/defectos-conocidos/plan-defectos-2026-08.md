# Frente 1 · Defectos conocidos y sin arreglar

> **Estado: 18 de 27 tareas · 7 de 10 defectos** — abierto el **2026-08-14**.
>
> ✅ **La suite de caracterización está VERDE** desde el 2026-08-14 (defecto 1.15 cerrado). Estuvo roja
> 4 tests, y **no por un golden malo**: el golden era correcto y lo que mentía era el entorno.
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
| `T1.10-a` | 1.10 | **Censo cerrado**: son **cinco sentencias en cuatro sitios**, no tres — se había escapado el trigger `AFTER INSERT` | ✅ | 3 en el esquema + backfill + handover; los de `fill_requests` son otra tabla y quedan fuera | 2026-08-14 |
| `T1.10-b` | 1.10 | **Decisión: EN EL TRIGGER.** Es el único sitio que no se puede puentear, y ser puenteado *es* el defecto | ✅ | `position_assignments` la escriben **4 sitios**, incluido el CRUD genérico | 2026-08-14 |
| `T1.10-c` | 1.10 | El asiento se escribe en los **cuatro** caminos automáticos; el vocabulario de causas pasa de 3 a 5 | ✅ | Control positivo contra la base: `occupancy_end` → `occupancy_start` → `reconcile` con actor. 621 unitarios, char verde, 0 goldens movidos | 2026-08-14 |
| `T1.10-d` | 1.10 | **Decisión: se ve en la app.** El entregable gana un historial de relevos legible | ✅ | Antes: 0 `SELECT` en todo el repo | 2026-08-14 |
| `T1.10-e` | 1.10 | **Nueva.** Endpoint de lectura del historial, con su permiso | ⬜ | — | — |
| `T1.10-f` | 1.10 | **Nueva.** La sección de historial en el entregable, verificada en navegador | ⬜ | — | — |
| `T1.11-a` | 1.11 | **Censo cerrado**: 423 decidibles por escáner + 61 leídos uno a uno + sonda sobre los 240 flujos | ✅ | **484/484 equilibradas · 0 de más**; sonda 0 disparos (arranque, fixture y flujos) | 2026-08-14 |
| `T1.11-d` | 1.11 | **Nueva.** `npm run check:params` como gate permanente — el artefacto que al 1.5 le faltó | ✅ | `scripts/audit_bindparams.mjs`; probado con un desajuste inyectado (salta) y con `?` en comentario/cadena/`IN (?)` (no salta) | 2026-08-14 |
| `T1.11-b` | 1.11 | **Decisión: ENDURECER.** Escrita encima de `bindParams` con su medición y con por qué no bastaba avisar | ✅ | El gate estático solo ve 423 de 484; lanzar cubre las 484 en runtime | 2026-08-14 |
| `T1.11-c` | 1.11 | Guard simétrico `paramIndex !== provided`; los 3 tests que fijaban la tolerancia, resueltos | ✅ | **602 unitarios verdes**; char: los **mismos 9 fallos preexistentes**, 0 errores de `bindParams`, 0 goldens movidos | 2026-08-14 |
| `T1.15-a` | 1.15 | **Diagnóstico**: el golden era CORRECTO y el hash determinista; lo viejo era MinIO | ✅ | Repo dice `data.json`, MinIO no; dos corridas dan el mismo hash | 2026-08-14 |
| `T1.15-b` | 1.15 | El centinela `ya_existe` deja de gobernar el catálogo `Seeds/`; la suite vuelve a verde | ✅ | **4 fallos → 0**, 0 goldens movidos, `make.sh` publicado ya lleva `data.json`. 6 unitarios nuevos, con control positivo | 2026-08-14 |
| `T1.16-a` | 1.16 | El orden de parámetros de `context_ancestor_type` arreglado, con su unitario | ✅ | `[unitId, cargoId, unitTypeId]`; **7 unitarios nuevos** con control positivo (solo falla el de posiciones al restaurar el bug); censo: 6 `unshift` en el backend, este era el único roto | 2026-08-14 |
| `T1.17-a` | 1.17 | **Decisión: publicar en el ARRANQUE.** Los otros caminos se midieron y no existen: `/bootstrap/initialize` da **409 para siempre**, el despliegue solo hace `pull`+`up -d`, y `/template_seeds/sync` va en dirección contraria | ✅ | Mapa completo de caminos, con rutas y líneas | 2026-08-14 |
| `T1.17-b` | 1.17 | **Nueva.** `publishSeedsOnBoot` en `index.js`: una semilla actualizada llega al reiniciar o desplegar, sin intervención | ✅ | Log del arranque: «Semilla base publicada en MinIO (artifact: respetado)». 48 PUT, ~92 KB, &lt;1 s | 2026-08-14 |
| `T1.17-c` | 1.17 | **Nueva.** `test:char:fixture` resetea también `storage`: MinIO deja de ser una entrada oculta | ✅ | Suite verde **sin capturar** y 0 goldens movidos; el bucket baja de 435 a 332 objetos (fuera la basura acumulada) | 2026-08-14 |
| `T1.18-a` | 1.18 | El PDF deja de renombrarse a `pdf` al editar; el golden `editar_ok` se mueve y **ese diff es la prueba** | ✅ | **Una línea en un golden**: `editar_ok` pasa a valer lo mismo que `crear_ok` — crear y editar producen ya el paquete idéntico. 4 unitarios del predicado | 2026-08-14 |

**Resumen por defecto** (se deriva de la tabla de arriba; no es una segunda lista de tareas):

| Defecto | Título corto | Superficie | Estado |
|---|---|---|---|
| **1.3** | Auto-apropiación de una solicitud manual | Backend · servicio | ⬜ |
| **1.7** | El sello fantasma: un guard permanentemente verdadero | Frontend · Vue | ⬜ |
| ~~**1.8**~~ | ~~Dos documentos del repo mandan formas de error contrarias~~ | Backend · documental | ✅ **2026-08-14** |
| **1.10** | La única bitácora de auditoría la puentea el camino automático | BD · triggers · UI | 🟡 **backend hecho**; falta el historial visible |
| ~~**1.11**~~ | ~~Parámetros de MÁS se ignoran en silencio~~ | Backend · `config/postgres.js` | ✅ **2026-08-14** |
| ~~**1.15**~~ | ~~El catálogo de semillas nunca llega a un entorno ya arrancado~~ | Bootstrap · MinIO | ✅ **2026-08-14** |
| ~~**1.16**~~ | ~~Orden de parámetros cruzado en `context_ancestor_type`~~ | Backend · firma | ✅ **2026-08-14** |
| ~~**1.17**~~ | ~~Nada re-publica la semilla en un entorno vivo~~ | Bootstrap · arnés | ✅ **2026-08-14** |
| ~~**1.18**~~ | ~~Al editar, `path.basename()` sobre un prefijo renombra el PDF a `pdf`~~ | Backend · plantillas | ✅ **2026-08-14** |

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

## ~~§6 · Defecto 1.11 — los parámetros de MÁS se ignoran en silencio~~

✅ **CERRADO el 2026-08-14.** La ficha entera está en
[`bitacora.md` § 1.11](./bitacora.md#111--los-parametros-de-mas-se-ignoraban-en-silencio-y-la-premisa-era-falsa).

En una línea: **la justificación de la tolerancia era falsa** —se midió y las 484 llamadas están
equilibradas—, así que `bindParams` **lanza también cuando sobran**. Dejó dos cosas vivas: el gate
`npm run check:params`, y dos defectos nuevos encontrados de rebote (**1.15** y **1.16**).

---

## ~~§8 · Defecto 1.15 — la suite de caracterización está ROJA~~

✅ **CERRADO el 2026-08-14.** Y **no era lo que decía esta ficha**: afirmaba «un golden que congela un
hash no determinista» y «9 casos», y **las dos cosas eran falsas**. La ficha corregida está en
[`bitacora.md` § 1.15](./bitacora.md#115--el-catalogo-de-semillas-nunca-llegaba-a-un-entorno-ya-arrancado).

En una línea: el hash **es** determinista, el golden **era** correcto, y lo que mentía era **MinIO** —
servía una semilla anterior al arreglo del ZIP renderizable. Causa raíz: un centinela que protegía
ediciones del admin sobre el artifact **y de paso bloqueaba el catálogo, que nadie edita**.

---

## ~~§9 · Defecto 1.16 — orden de parámetros cruzado en `context_ancestor_type`~~

✅ **CERRADO el 2026-08-14.** Ficha completa en
[`bitacora.md` § 1.16](./bitacora.md#116--orden-de-parametros-cruzado-en-context_ancestor_type).

En una línea: dos `unshift` donde hacía falta **un `unshift` y un `push`**. El censo dice que es la
**única rama del backend que antepone Y añade a la cola a la vez** — por eso rompió aquí y no en las
otras cinco.

---

## ~~§10 · Defecto 1.17 — nada re-publica la semilla en un entorno ya arrancado~~

✅ **CERRADO el 2026-08-14.** Ficha completa en
[`bitacora.md` § 1.17](./bitacora.md#117--nada-re-publicaba-la-semilla-en-un-entorno-ya-arrancado).

En una línea: la semilla ahora se publica **en cada arranque**, así que llega al reiniciar o
desplegar; y `test:char:fixture` resetea también `storage`, con lo que MinIO deja de ser una entrada
oculta al sistema bajo prueba.

---

## ~~§11 · Defecto 1.18 — al editar, el PDF se renombra a `pdf`~~

✅ **CERRADO el 2026-08-14.** Ficha completa en
[`bitacora.md` § 1.18](./bitacora.md#118--al-editar-el-pdf-se-renombraba-a-pdf).

En una línea: `entry_object_key` **es un prefijo por diseño**, y la rama de subida le hacía
`path.basename()` a pelo. El predicado correcto **ya existía duplicado en dos sitios** y faltaba justo
en el tercero. **Es el primer defecto de este frente cuyo golden se mueve**, y el diff es de una línea.

---

## §7 · Orden sugerido — **reescrito el 2026-08-14**

Los tres cerrados fueron **1.8 → 1.11 → 1.15**, en ese orden, y el orden funcionó por un motivo que
conviene conservar: **cada uno destapó al siguiente**. El 1.11 obligó a correr la suite y ahí salió el
1.15; el 1.15 obligó a leer el bootstrap y ahí salieron el 1.17 y el 1.18. Medir es lo que produce
trabajo nuevo, no planificarlo.

Para lo que queda, el criterio sigue siendo el mismo: **lo que se decide solo, antes de lo que necesita
una decisión tuya**.

1. **1.16** — el más barato del tablero, y ya está diagnosticado: dos líneas, `[unitId, unitTypeId,
   cargoId]` pasa a `[unitId, cargoId, unitTypeId]`. La rama gemela `context_subtree` está bien y sirve
   de prueba de contraste. Latente hoy (0 filas en el JSONB de la base), así que **ningún golden se
   moverá** — su evidencia es un unitario, como en el 1.5 y el 1.13.
2. **1.18** — también acotado, y su golden `editar_ok` **ya está congelado**, así que el diff *es* la
   prueba. Cuidado con una cosa: `entry_object_key` guarda un prefijo, y hay que ver si eso es un dato
   correcto mal usado o un dato mal escrito.
3. ~~**1.17**~~ ✅ — cerrado el 2026-08-14. Era el que más rendía, y se confirmó: **cerró una clase de
   fallo, no un caso**.

**Lo que queda son los tres que estaban desde el principio**, y los tres piden una decisión tuya antes
que trabajo:

4. **1.10** — el más caro y el que más decisiones tiene; empieza por `T1.10-d`, que puede cambiar todo
   lo demás.
5. **1.7** — pide navegador, pero el radio es un componente y seis líneas.
6. **1.3** — el último a propósito: no se puede escribir el guard hasta que la regla esté decidida, y
   la regla no es técnica.

> **Lo que enseñó la tanda del 2026-08-14.** Se cerraron seis defectos y **aparecieron cuatro nuevos**
> (1.15, 1.16, 1.17, 1.18), todos de *medir*, ninguno de planificar. Y **tres de los seis resultaron
> ser otra cosa** de lo que decía su ficha. La moraleja para el que siga: **remide la ficha antes de
> creértela**, y desconfía especialmente de los diagnósticos que suenan a explicación cómoda —
> «el hash no es determinista» lo era, y costó una corrida entera descubrirlo.

> **Y una advertencia sobre el argumento de este frente.** «Están congelados en pruebas, así que el
> arreglo se verifica solo» resultó ser **condicional**: la suite estuvo roja 4 tests y nadie lo sabía.
> Antes de apoyarte en un golden, comprueba que la suite esté verde **antes** de tu cambio. Es lo que
> convirtió el 1.15 en un hallazgo en vez de en una confusión.

---

## §8 · Lo que se comprobó y NO era un defecto

Escrito aquí para que no vuelva a proponerse. El detalle completo, en [`bitacora.md`](./bitacora.md).

| Candidato | Veredicto |
|---|---|
| `services/chat/ChatAuthorizationService.js` — «una copia del IDOR se quedó atrás» | ❌ **No era un defecto** (2026-08-09, medido). Aplicar el guard **rompía el chat** a 8 de 10 asignados. La razón está escrita encima de la propia consulta |
| `generation/launch.js:224` — `UPDATE tasks SET process_run_id` | ❌ No es pérdida de trazabilidad: es la «Opción X» **deliberada**, y el modelo de `process_runs` se diseñó así |
| `controllers/tareas/tareas_controler.js:79` — «otra copia del IDOR» | ❌ Lista *tareas* vía `task_assignments` y solo expone un agregado (`task_item_count`, `task_item_names`), no entregables individuales |
