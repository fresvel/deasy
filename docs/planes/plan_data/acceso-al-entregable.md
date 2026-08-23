# El acceso al entregable — diseño

> **Fase D7 del frente 9.** Escrito el **2026-08-22** con las dos decisiones del dueño tomadas ese
> día. Este documento **se ejecuta**: sus pasos están en el `§0 · Control de ejecución` de
> [`plan-datos-2026-08.md`](./plan-datos-2026-08.md).
>
> Nació de una pregunta que parecía pequeña —«¿fusionamos `task_items` y `documents`?»— y que al
> medirla destapó que **la pregunta que el sistema resuelve está mal planteada**.

---

## 1 · El diagnóstico

Hoy el sistema pregunta **«¿de quién es este entregable?»** y responde con una persona. La pregunta
correcta es **«¿quién tiene derecho a verlo?»**, y la respuesta no es una persona: es un **conjunto
que crece con el tiempo** — quien lo recibió, quien lo llenó, quien lo firmó, quien lo heredó al
cambiar de puesto.

En palabras del dueño (2026-08-22):

> *«Todos quienes participaron en el documento deberían tener acceso al mismo (flujo de entrega,
> flujo de firma), además de quien tome el relevo del puesto. Además se debe considerar qué pasará
> cuando un puesto se elimine: su documentación debe ser accesible para alguien, y eso aún es un
> vacío enorme.»*

### Lo que ya existe, y es más de lo que parece

**El modelo de participantes está construido a medias, dos veces, con conjuntos distintos.** Ésa es
la verdadera deuda: no falta el diseño, falta unificarlo.

| Fuente de acceso | Guard del **documento**<br>`isUserInTaskItemChain`<br><small>`DocumentObservationService.js:85`</small> | Guard del **chat**<br>`ChatAuthorizationService`<br><small>`:55-80`, `:200-270`</small> |
|---|:--:|:--:|
| Quien lanzó la tarea (`tasks.created_by_user_id`) | — | ✓ |
| Asignado de la tarea por puesto (`task_assignments`) | — | ✓ |
| Asignado del entregable (`task_items.assigned_person_id`) | — | ✓ |
| Dueño materializado (`documents.owner_person_id`) | ✓ *(vía cascada)* | ✓ |
| Participó en el flujo de **entrega** (`fill_requests`) | ✓ | ✓ |
| Participó en el flujo de **firma** (`signature_requests`) | ✓ | ✓ |

Dos listas distintas para la misma pregunta. Y a las dos les faltan las mismas tres cosas.

### Los tres huecos, medidos el 2026-08-22

**H1 · El ocupante del puesto no es fuente de acceso en ningún guard.** Ninguno de los dos consulta
`position_assignments`. Un entregable dirigido «a quien ocupe el puesto de Coordinador» **no da
acceso al coordinador actual por serlo**: sólo si algo, en algún momento, escribió su id en
`task_items.assigned_person_id`.

**H2 · El registro de relevos está completo y no lo lee nadie.** `task_item_handovers` guarda
`from_person_id`, `to_person_id`, `reason` y `trigger_kind` con cinco causas. Medido: **6 sitios la
escriben, 0 la leen.** Es, fila a fila, la historia de quién tuvo cada entregable.

**H3 · Al eliminar un puesto se borra su historia.** `removeUnitPosition`
(`services/admin/org/orgStructure.js:328`) hace:

```sql
DELETE FROM position_assignments WHERE position_id = ?
DELETE FROM unit_positions WHERE id = ?
```

`position_assignments` no es sólo «quién lo ocupa hoy»: con `start_date`, `end_date` e `is_current`
es **el único sitio donde consta quién ocupaba ese puesto cuando se generó un documento**. Borrarlo
destruye esa prueba.

> Hoy el daño está **tapado por accidente**: las FK de `task_items` y `task_assignments` hacia
> `unit_positions` son restrictivas, así que un puesto **con entregables no se deja borrar** y sale
> un 409 «Desactívalo en su lugar». Un puesto sin entregables sí se borra — y su historia con él.

Y el hueco ya se había intuido: el vocabulario de `task_item_handovers` **declara la causa
`position_deactivated`** y su propio comentario admite que **no tiene emisor** — *«ningún trigger
desactiva un puesto reasignando; se conserva porque el día que exista ese camino, éste es su
nombre»*. El nombre puesto, el camino no.

---

## 2 · Las decisiones tomadas (2026-08-22)

### D-1 · El nombre superviviente de la fusión: `task_items`

`documents` desaparece y sus columnas se absorben. Motivos medidos:

- **Seis FK apuntan a `task_items` y sólo una a `documents`** (`document_versions.document_id`). La
  fusión cuesta **repuntar una**, no seis.
- El glosario del §0.5 ya define `task_item` como *«la instancia con dueño: lo que una persona debe
  entregar»*, que es exactamente lo que queda al fusionar.
- El nombre **no viaja al frontend**: los 74 nombres de tabla de `AdminTableManager` no se mueven.

**Consecuencia asumida:** las cinco tablas `document_*` (`document_versions`, `document_attachments`,
`document_fill_flows`, `document_workflow_observations`, `document_signatures`) pasan a colgar de una
tabla que no se llama documento. **Renombrarlas es un commit aparte y no bloquea nada.**

### D-2 · La custodia cuando el puesto se queda sin ocupante

**El jefe de la unidad**, subiendo por la rama **orgánica** hasta el primero que exista; si se llega
a una unidad sin padre y sin jefe, **el rol `AdminSistema`**.

```
Carrera Sistemas de Información (9)   ¿jefe? → sube
        ↓
Escuela Hábitat… (7)                  ¿jefe? SÍ  ← CUSTODIO
        ↓
Prorrectorado (2)                     ¿jefe? SÍ
        ↓
Raíz del sistema (1)                  ¿jefe? NO  → AdminSistema
```

- **Se recorre sólo la relación `Orgánica`.** Hoy es el único tipo que existe (12 relaciones) y no
  hay ninguna unidad con dos padres — pero **el modelo permite las dos cosas**, así que la regla lo
  dice explícitamente en vez de confiar en los datos.
- **El caso «sin jefe» no es hipotético**: hoy lo cumplen **2 de 13 unidades** (la `Raíz del sistema`
  y la `Jefatura de Tecnologías de la Información`).
- **Coste asumido y consciente:** un documento de una carrera puede quedar accesible para el
  Prorrectorado si hay dos niveles sin jefe. Es lo que una jerarquía significa; queda escrito para
  que no sorprenda.

---

## 3 · El modelo objetivo

**El acceso deja de ser un campo y pasa a ser una pregunta con respuesta calculada:** *¿está esta
persona en el conjunto de participantes de este entregable?* **Una función, un solo sitio**, que
consultan los dos guards.

| # | Fuente | De dónde sale | Hoy |
|---|---|---|---|
| 1 | Destinatario explícito | `task_items.target_person_id` | existe |
| 2 | Asignado del entregable | `task_items.assigned_person_id` | existe |
| 3 | Asignado de la tarea por puesto | `task_assignments.assigned_person_id` | sólo chat |
| 4 | Quien lanzó la tarea | `tasks.created_by_user_id` | sólo chat |
| 5 | Participó en la **entrega** | `fill_requests.assigned_person_id` | los dos |
| 6 | Participó en la **firma** | `signature_requests.assigned_person_id` | los dos |
| 7 | Comentó u observó | `document_workflow_observations` (autor y destinatario) | existe, sin usar |
| 8 | **Ocupa hoy el puesto responsable** | `position_assignments` con `is_current = 1` | **falta (H1)** |
| 9 | **Lo ocupó mientras el entregable vivía** | `position_assignments` por solape de fechas | **falta** |
| 10 | **Entró o salió por relevo** | `task_item_handovers` (`from_` y `to_person_id`) | **falta (H2)** |
| 11 | **Custodio** | la regla D-2 | **falta** |

**Ocho de las once ya están escritas en algún sitio.** El trabajo no es inventar un resolver: es
unificarlas y añadir las que faltan.

### Lo que desaparece, y por qué

**`documents.owner_person_id` no sobrevive en ninguna forma** —ni materializado ni derivado—, porque
la pregunta que contestaba deja de existir. Se comprobó que hoy es **la misma cascada de cuatro
pasos** que los guards recalculan al vuelo (`resolveOwnerPersonIdForTaskItem`, `documents.js:119-150`
frente a `resolved_owner_person_id`, `user_controler.queries.js:497-518`), materializada en el
`INSERT`.

> ⚠️ **Queda un «de quién es» legítimo, y es OTRA cosa: a quién se le RECLAMA la entrega.** Eso es
> responsabilidad, no permiso, y sí se deriva de la cascada. **Un campo distinto y una pregunta
> distinta**; confundirlos es lo que produjo este diseño.

---

## 4 · Los defectos que esto destapa

Ninguno estaba en el plan. Los cuatro salieron de medir para contestar la pregunta de la fusión.

### F-1 · `task_items.status` es una columna muerta con seis lectores

**Cero escritores.** Los cinco `UPDATE task_items` del repositorio escriben `assigned_person_id`
(cuatro) o `user_started_at` (uno). Ninguno toca `status`, que se queda en su `DEFAULT 'pendiente'`
para siempre. Medido en la base: los tres entregables están en `pendiente` mientras sus documentos
van por `Listo para firma` y `Pendiente de firma`.

**Efecto colateral, y es grave:** el motor de relevos filtra
`ti.status NOT IN ('completed','completado','cancelled','cancelado','finalizado','entregado','rechazado')`.
**`pendiente` no está en esa lista**, así que **todo entregable es reasignable para siempre**,
incluidos los ya entregados y firmados. Y lo activamos nosotros: el commit `fcaeea6` del frente 0
fue el que hizo que esos relevos se ejecutaran de verdad.

**Consecuencia para la fusión:** no hay dos estados que reconciliar. Hay **uno** —el del documento,
con sus 11 valores y su matriz de transiciones— y una columna muerta que se borra.

### F-2 · `removeUnitPosition` destruye el historial de ocupación

Ver H3. **Un puesto no debe poder borrarse si tiene historia**: se desactiva. Y `position_assignments`
no se borra nunca en ese camino.

### F-3 · `task_item_handovers` es de sólo escritura

Ver H2. Es el defecto **1.10** del frente 1 visto desde el otro lado: aquel preguntaba *«¿quién
escribe el asiento?»*; éste contesta *«¿quién lo lee?»* — la fuente 10 del modelo de arriba.

### F-4 · `position_deactivated` no tiene emisor

Desactivar un puesto no reasigna ni deja asiento. Con D-2 tomada, **ése es el camino que hay que
escribir**: al desactivar, el custodio entra y el asiento se escribe con esa causa.

---

## 5 · Plan de ejecución

Por pasos reversibles, cada uno en verde, siguiendo la regla 14 del método: **experimento desechable
antes de cada cambio de comportamiento**.

| # | Paso | ¿Reversible? | Qué lo verifica |
|---|---|---|---|
| **P1** | **La función única de participantes**, con las 8 fuentes que ya existen. Sin cambiar ningún guard todavía | Sí | Unitarios de la función; ningún golden se mueve |
| **P2** | Los **dos guards** pasan a llamarla. Aquí el comportamiento **sí cambia**: el guard del documento gana las fuentes que sólo tenía el chat | **No** | Goldens del contrato HTTP; **el diff ES la prueba** |
| **P3** | Añadir las fuentes **8, 9 y 10** (ocupante actual, ocupantes durante la vida, relevos) | **No** | Unitarios por fuente + golden |
| **P4** | **El custodio** (D-2), con su recorrido orgánico y su reserva a `AdminSistema` | **No** | Unitarios del recorrido, incluido el caso «sin jefe» que hoy dan 2 de 13 unidades |
| **P5** | `removeUnitPosition` deja de borrar historia; desactivar emite `position_deactivated` | **No** | Prueba del camino roto (F-2) y del asiento (F-4) |
| **P6** | **La fusión**: `documents` se absorbe en `task_items`, `document_versions` repunta su FK, `owner_person_id` y `task_items.status` desaparecen | **No** | `check:imports` · `test:unit` · `test:char:run`; los goldens de documento se mueven |
| **P7** | El filtro del relevo deja de mirar `status` y mira el estado real | **No** | El entregable firmado deja de ser reasignable |

> **P1 y P2 valen por sí solos** aunque la fusión se aplace: cierran la asimetría entre los dos
> guards, que es un fallo de permisos vivo hoy.
>
> **P6 va detrás de todo lo demás a propósito.** Es el paso caro y el único que toca el frontend
> (41 usos de `documentId`, 9 de ellos en `HomeView`), y ninguno de los anteriores lo necesita.

---

## 6 · Lo que NO entra aquí

- **Renombrar las cinco tablas `document_*`.** Commit aparte, cosmético, sin prisa.
- **El vocabulario de estados** (fase D2). `task_items.status` se borra aquí porque está muerto; el
  vocabulario del documento se unifica allí.
- **La partición de `AdminTableManager`** (frente 4, fase F7). Este documento no toca el frontend
  salvo en P6.
- **Quién ocupó el puesto pero nunca tocó el documento.** La fuente 9 les da acceso por solape de
  fechas. Si se quiere distinguir *«ocupó el puesto»* de *«participó»*, es una decisión posterior y
  no bloquea nada.
