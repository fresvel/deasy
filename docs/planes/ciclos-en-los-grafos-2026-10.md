# Frente 26 · Los grafos del modelo no se defienden de sus propios ciclos

> **Estado**: 🟡 **1 de 9** — contado con script sobre la tabla del §0 · abierto el **2026-10-11**
> **Abierto por decisión del dueño**, que lo sacó del frente 25: *«no debería permitir ciclos (en
> procesos tampoco)»* → *«para los ciclos frente propio»*.

**Por qué sale del frente 25.** Allí era la tarea `P11`, y la tarea no cabía: el frente 25 decide la
forma de `lineas`, y de sus tablas sólo **una** tiene este problema. Lo demás toca `processes`,
`ediciones`, `process_runs`, `task_items`, `chat_messages` y el organigrama — cinco dominios y cuatro
esquemas de PostgreSQL. **Un frente no es un sitio donde aparcar lo que no encaja en otro**, así que
tiene el suyo.

---

## 0 · Control de ejecución

| Tarea | Qué entrega | Estado | Evidencia | Fecha |
|---|---|:--:|---|---|
| **CI1** | **El censo medido**: cuántos grafos hay, qué protección tiene cada uno, quién recorre su cadena, y qué hay hoy en la base | ✅ | §1 y §2: **6 grafos**, 5 por clave ajena autorreferencial + `unit_relations`; **cero** `CHECK` en el esquema; **dos** guardias en código, los dos vulnerables al estado que previenen; **cero** ciclos en los datos de hoy | 2026-10-11 |
| **CI2** | **El espacio de diseño de la protección**: `CHECK` de autoapuntado, disparador recursivo, camino materializado, `ltree`, comprobación en servicio — cada una con qué impide, qué permite y qué cuesta. **Sin elegir** | ⬜ | | |
| **Z** | **La decisión del dueño**: qué grafos necesitan protección de ciclo completa y cuáles sólo de autoapuntado, y con qué mecanismo | ⬜ | | |
| **CI3** | **Ninguna fila se apunta a sí misma**, impuesto por el ESQUEMA en los cinco autorreferenciales. Es el único ciclo que un humano teclea sin querer, y hoy **nada lo impide** en cuatro de los cinco | ⬜ | **depende de `Z`** | |
| **CI4** | **Los ciclos de longitud mayor que uno**, donde `Z` diga que hacen falta, con el mecanismo que salga de `CI2` | ⬜ | **depende de `Z`** | |
| **CI5** | **Todo recorrido recursivo del backend es seguro**: las **5** CTEs `WITH RECURSIVE` llevan `CYCLE` o límite de profundidad. Hoy **ninguna** lo lleva, así que un ciclo ya existente **las cuelga** | ⬜ | **no depende de `Z`**: vale para cualquier mecanismo que se elija | |
| **CI6** | **`processes.parent_id` deja de ser un `number` libre en `/admin`**: o el editor genérico pasa por el guardia, o el campo se retira de `sqlTables.js` y se edita sólo por el grafo | ⬜ | **es el camino que rodea el guardia** | |
| **CI7** | **Los dos guardias tienen prueba**: hoy `wouldCreateProcessCycle` está a **`FNDA:0`** —cero ejecuciones— en el informe de cobertura | ⬜ | | |
| **CI8** | **El patrón queda escrito** donde se vea al escribir el siguiente recorrido recursivo, no sólo aquí | ⬜ | **depende de `CI5`** | |

⚠️ **`CI1` ya está hecha y por eso este frente no abre en blanco.** Se midió el 2026-10-11 al
registrar la decisión que lo crea, y **corrigió dos afirmaciones** que el frente 25 había escrito:
que no había ninguna protección —hay dos— y que nada recorría esas cadenas de forma recursiva —hay
cinco recorridos—. Las dos correcciones están en el §2.

---

## 1 · Son SEIS grafos, no cinco

El frente 25 contó **cinco**, buscando claves ajenas autorreferenciales en el catálogo de PostgreSQL
(`contype='f' AND conrelid = confrelid`):

| Esquema | Tabla | Columna | `ON DELETE` |
|---|---|---|---|
| `procesos` | `processes` | `parent_id` | — |
| `plantillas` | `ediciones` | `parent_version_id` | — |
| `tareas` | `process_runs` | `source_run_id` | — |
| `tareas` | `task_items` | `source_task_item_id` | — |
| `chat` | `chat_messages` | `reply_to_message_id` | `SET NULL` |

⚠️ **Y ese censo se deja UNO fuera por construcción, que es el hallazgo de `CI1`.** El organigrama no
es una columna que apunta a su tabla: es **`unit_relations`**, una tabla de aristas
`(parent_unit_id, child_unit_id, relation_type_id)`. Un grafo escrito así **no aparece** en una
consulta de claves ajenas autorreferenciales, y es el más expuesto de los seis: lo edita un humano
arrastrando cajas en el organigrama de `/admin`.

> **La lección de medición: buscar «la columna que apunta a su propia tabla» encuentra los árboles y
> se le escapan los grafos.** Si mañana alguien añade otra tabla de aristas, este censo no la verá.

Y **`unit_relations` lleva varios grafos sobre las mismas filas**, lo cual está bien resuelto y
conviene no romperlo: su guardia acota el recorrido **por `relation_type_id`**, porque —dice su
propio comentario— *el organigrama y la dependencia funcional son dos grafos distintos sobre las
mismas unidades, y un ciclo en uno no dice nada del otro*.

## 2 · Qué protección hay, medido

### En el esquema: ninguna

**Cero `CHECK`** sobre las cinco columnas. Ni siquiera el de longitud 1: nada impide
`UPDATE processes SET parent_id = id`. Las únicas restricciones que las tocan son las cinco claves
ajenas del §1, y una clave ajena **no** sabe de ciclos: apuntarse a sí misma satisface
`REFERENCES processes(id)` perfectamente.

### En el código: dos guardias, y los dos tienen el mismo defecto

| Grafo | Guardia | Dónde |
|---|---|---|
| `processes.parent_id` | `wouldCreateProcessCycle` + un `if (newParent === id)` explícito | `services/admin/processes/processGraph.js:76` y `:134` |
| `unit_relations` | `existeCaminoEntreUnidades`, acotado por tipo de relación | `dominios/organizacion/datos/unidades.js:61` |

**Los otros cuatro grafos no tienen nada**, en ninguna capa.

⚠️ **Y el defecto que comparten los dos guardias es el que importa: están escritos con
`WITH RECURSIVE … UNION ALL`, sin cláusula `CYCLE` y sin límite de profundidad.** O sea que **el
mecanismo que existe para que no haya ciclos se cuelga si ya hay uno**. No es una paradoja teórica:
es el orden real de los hechos, porque la vía que mete el ciclo no pasa por el guardia.

### Y la vía que lo rodea está abierta y medida

`config/sqlTables.js:362` expone **`parent_id` como `{ type: "number" }`** en el editor genérico de
`/admin`. Ese camino escribe la columna con un `UPDATE` directo: **no pasa por `setProcessParent`**,
que es el único sitio que llama al guardia. Así que la protección cubre el grafo y **no cubre el
formulario**.

Remate: `wouldCreateProcessCycle` está a **`FNDA:0`** en `backend/coverage/lcov.info` —cero
ejecuciones registradas—, igual que su fachada en `SqlAdminService.js:913`. **La única defensa que
existe no la ejecuta ninguna prueba.**

### En los datos de hoy: limpio, y eso es lo que da margen

Medido en la pila B el 2026-10-11:

| Tabla | Filas | Con padre | Se apuntan a sí mismas |
|---|---|---|---|
| `processes` | 1 | 0 | 0 |
| `ediciones` | 2 | 1 | 0 |
| `process_runs` | 1 | 0 | 0 |
| `task_items` | 3 | 0 | 0 |
| `chat_messages` | 1 | 0 | 0 |

**Cero ciclos y cero autoapuntados.** Son datos de fixture, no de producción —así que la cifra no
dice que el sistema sea seguro—, pero sí dice algo útil: **un `CHECK` de autoapuntado entra hoy sin
migrar ni una fila.**

## 3 · Por qué es latente y por qué no se puede dejar así

**Hoy no es un fallo.** Para que muerda hacen falta dos cosas a la vez: que alguien escriba el ciclo
por la vía que rodea el guardia, y que después algo recorra esa cadena. Las dos están disponibles.

**Y lo que lo hace peor que un fallo normal es cómo se manifiesta**: un `WITH RECURSIVE … UNION ALL`
sobre un ciclo no da error, **no termina**. El síntoma es una petición que se queda colgada y una
conexión del pool que no vuelve — o sea un diagnóstico que apunta a la base de datos o a la red,
no al dato que lo causó. Es la misma forma del fallo que ya documentó `CLAUDE.md` con
`getPostgresPool()` a nivel de módulo: *«no revienta, y te manda a buscar un problema que no
existe»*.

## 4 · Lo que este frente NO hace

- **No elige el mecanismo.** `CI2` entrega el espacio de diseño completo; la elección es `Z`.
- **No toca los datos.** Hoy están limpios; lo que haya que comprobar se comprueba en transacciones
  revertidas.
- **No rediseña el organigrama.** `unit_relations` entra por su ciclo, no por su forma: su guardia
  acotado por tipo de relación **está bien** y se conserva.

## 5 · Qué bloquea, y qué NO

**No bloquea nada.** Ningún otro frente espera a esto. Y al contrario: `lineas.linea_anterior_id`
—la decisión 10 del [frente 25](./plantilla-y-linea-de-proceso-2026-10.md)— **nacerá con el problema
puesto** si este frente no ha decidido antes el mecanismo. Lo barato es que la tabla nueva salga ya
protegida; lo caro es añadírselo después, que es exactamente la historia de las otras cinco.
