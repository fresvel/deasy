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

> ⚠️ **El control de este frente YA NO ESTÁ AQUÍ.** Se convirtió el **2026-10-23** al formato de la
> skill `plan-trabajo`: vive en `docs/planes/deasy/tareas/F26.*.md`, un fichero por tarea, y el
> recuento lo **genera** `plan estado F26` — no se escribe a mano ni se copia a este documento.
> La puerta es `plan verificar`.
>
> **Lo que sigue aquí es el razonamiento**, que es lo que se echa de menos meses después. Las
> tareas sólo guardan qué entregan y su evidencia.
>
> ⚠️ **Sus SEIS fases no son un diseño: son un residuo.** Se crearon el 2026-10-23 porque la puerta
> exigía entonces una fase por cada etapa del ciclo `exploratorio`, así que `P5` y `P6` guardan una
> tarea cada una. Esa regla **se retiró el 2026-10-24** —leyendo a Boehm: las etapas de la espiral
> «se eligen por riesgo»— y las fases son libres. No se renumeran, porque un identificador no se
> renumera nunca; si alguna estorba, su tarea se retira ➡️ `movida` a donde toque.

**Qué era cada tarea antes.** La prosa de abajo todavía las nombra `CI1`…`CI8`:

| Antes | Ahora | Tipo | Qué entrega |
|---|---|:--:|---|
| `CI1` | `F26.P1.T1` | M | el censo medido |
| `CI2` | `F26.P1.T2` | M | el espacio de diseño de la protección |
| `Z` | `F26.P2.T1` | Q | **la pregunta**: qué grafos y con qué mecanismo |
| `Z` | `F26.P3.T1` | D | **la decisión**, con lo descartado y su razón |
| `CI3` | `F26.P4.T1` | C | ninguna fila se apunta a sí misma |
| `CI4` | `F26.P4.T2` | C | los ciclos de longitud mayor que uno |
| `CI5` | `F26.P4.T3` | C | las cinco CTEs recursivas, seguras |
| `CI6` | `F26.P4.T4` | C | `parent_id` deja de ser un `number` libre |
| `CI7` | `F26.P5.T1` | V | los dos guardias con prueba |
| `CI8` | `F26.P6.T1` | R | el patrón escrito donde se vea |

⚠️ **`Z` se partió en DOS por decisión del dueño** (2026-10-23): la pregunta guarda **qué se le
preguntó y qué contestó, literal**; la decisión guarda **lo elegido y lo descartado con su razón
medida**. Eran una sola fila y se perdía la primera mitad.

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

### ⚠️ Actualización del 2026-11-12: son SIETE, y el séptimo es el que este frente predijo

El §5 decía que `lineas.linea_anterior_id` *«nacerá con el problema puesto si este frente no ha
decidido antes el mecanismo»*. **Nació.** La columna existe desde el frente 25 y entra al censo:

| Esquema | Tabla | Columna | Protección |
|---|---|---|---|
| `procesos` | **`lineas`** | **`linea_anterior_id`** | **ninguna, en ninguna capa** |

Y la forma en que nació es peor que la de las otras cinco, no igual: medido abajo en el §6, es el
**único** de los siete que **no tiene ni una vía de escritura literal en el código** — la única
manera de escribirlo hoy es el editor genérico de `/admin`, que es justamente la vía que no pasa por
ningún guardia. Las demás tienen al menos un servicio por donde podría entrar una comprobación.

Reproducible con el censo del §6: `conrelid = confrelid` da **6** columnas (eran 5) y `unit_relations`
sigue sin aparecer, porque sigue siendo una tabla de aristas.

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

**Remedido en la pila A el 2026-11-12**, con los siete y con la profundidad real de cada cadena:

| Grafo | Filas | Con padre | Se apuntan a sí mismas | Profundidad |
|---|--:|--:|--:|--:|
| `procesos.processes` | 1 | 0 | 0 | 1 |
| `plantillas.ediciones` | 2 | 1 | 0 | 2 |
| `tareas.process_runs` | 1 | 0 | 0 | — |
| `tareas.task_items` | 3 | 0 | 0 | — |
| `chat.chat_messages` | 1 | 0 | 0 | — |
| **`procesos.lineas`** | 1 | 0 | 0 | — |
| `organizacion.unit_relations` | **12 aristas** | 12 | 0 | **5**, sobre 14 unidades |

Sigue **cero ciclos y cero autoapuntados**, así que la conclusión de octubre se mantiene: cualquiera
de las protecciones del §6 entra **sin migrar ni una fila**. Y aparece el dato que faltaba para
poder hablar de coste: **el único grafo con profundidad de verdad es el organigrama, y mide 5**.

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

- **No elige el mecanismo.** `CI2` —hoy `F26.P1.T2`— entrega el espacio de diseño completo, y está
  en el **§6**, cerrado el 2026-11-12. La elección es de `F26.P2.T1` (la pregunta) y `F26.P3.T1` (la
  decisión), y **sigue abierta**: el §6 mide, no decide.
- **No toca los datos.** Hoy están limpios; lo que haya que comprobar se comprueba en transacciones
  revertidas.
- **No rediseña el organigrama.** `unit_relations` entra por su ciclo, no por su forma: su guardia
  acotado por tipo de relación **está bien** y se conserva.

## 5 · Qué bloquea, y qué NO

**No bloquea nada.** Ningún otro frente espera a esto. Y al contrario: `lineas.linea_anterior_id`
—la decisión 10 del [frente 25](./plantilla-y-linea-de-proceso-2026-10.md)— **nacerá con el problema
puesto** si este frente no ha decidido antes el mecanismo. Lo barato es que la tabla nueva salga ya
protegida; lo caro es añadírselo después, que es exactamente la historia de las otras cinco.

⚠️ **Y eso ya pasó.** `lineas.linea_anterior_id` existe desde el 2026-11-12 (ver la actualización
del §1) y nació sin protección. La predicción se cumplió, así que **lo barato ya no está
disponible**: ahora son siete columnas que proteger, no seis, y la séptima es la que peor
acompañada está.

---

## 6 · El espacio de diseño de la protección, MEDIDO

> Cerrado el **2026-11-12** por `F26.P1.T2`. **Esto mide, no decide**: la elección es `F26.P2.T1`
> (qué decide el dueño) y `F26.P3.T1`.

Las cinco candidatas no se compararon leyéndolas: se **construyeron las cuatro que viven en la base**
y se les metió un ciclo a propósito. En una base desechable, sin tocar `deasy`:

```bash
bash scripts/stack.sh a exec -T postgres psql -U deasy -d postgres \
     -c "CREATE DATABASE f26_laboratorio OWNER deasy;"
# …las cuatro tablas del laboratorio (SQL completo más abajo)…
bash scripts/stack.sh a exec -T postgres psql -U deasy -d postgres \
     -c "DROP DATABASE f26_laboratorio;"
```

PostgreSQL de la pila: **17.10**. Importa dos veces, y las dos están medidas abajo: la cláusula
`CYCLE` existe desde la 14, y `ltree` **está disponible pero NO instalada**
(`pg_available_extensions` → `default_version 1.3`, `installed_version` vacío).

### La tabla, con lo medido en cada casilla

| | Qué IMPIDE | Qué PERMITE (lo que deja pasar) | Qué CUESTA |
|---|---|---|---|
| **A · `CHECK (id <> parent_id)`** | sólo el ciclo de **longitud 1** | **un ciclo de longitud 2 entra** — medido: 2 filas en ciclo tras un `UPDATE` | 1 línea por tabla · **0 filas a migrar** · 0 coste en escritura |
| **B · disparador recursivo** | **toda longitud** en una sesión (1, 2 y 3 medidas) | **un ciclo entra con DOS sesiones a la vez** — medido: las dos confirman sin error y queda `1→2→1` | **0,669 ms** por escritura a profundidad 5 (la real) · 3,273 ms a profundidad 1000 · ~40 líneas de plpgsql **por tabla** |
| **B′ · el mismo, con `FOR UPDATE`** | **toda longitud, también concurrente** — medido: 0 filas en ciclo | nada que se haya encontrado | la segunda escritura **espera** a la primera: medido **3,2 s** de espera, y luego el error correcto. Serializa las escrituras de una misma cadena |
| **C · camino materializado** | toda longitud **por construcción** al insertar (1 y 2 medidas) | **mover un nodo deja a sus descendientes con el camino caducado** — medido: 1 descendiente mal tras mover uno | 1 columna `text` + disparador **por tabla** · y hace falta **cascada al mover**, que el disparador ingenuo no trae |
| **D · `ltree`** | lo mismo que C (1 y 2 medidas) | lo mismo que C: la cascada al mover sigue siendo tuya | **una extensión** que hay que meter en `postgres_schema.sql` y crear en cada pila y en CI · a cambio, los descendientes salen en **una** consulta indexable (`camino <@ 'n1'` → 3) |
| **E · comprobación en servicio** | lo que pase **por ese servicio** | **todo lo que no pase por él** — medido abajo: **5 de los 7** grafos se escriben desde `/admin` como un número libre | 0 en la base · pero hay que escribirla en **cada vía de escritura**, y hoy no se puede: una de las vías es un `UPDATE` con el nombre de tabla construido |

### Lo que sólo salió al provocarlo

**1 · El `CHECK` no es una versión pequeña de la protección: es otra cosa.** Para `id <> parent_id`
un ciclo de dos nodos es perfectamente legal, y entró:

```sql
CREATE TABLE a (id int PRIMARY KEY, parent_id int REFERENCES a(id),
                CONSTRAINT sin_autoapuntarse CHECK (id <> parent_id));
INSERT INTO a VALUES (1, NULL), (2, 1);
UPDATE a SET parent_id = id WHERE id = 1;   -- ERROR: viola sin_autoapuntarse   ✅
UPDATE a SET parent_id = 2  WHERE id = 1;   -- UPDATE 1                         ⚠️ ciclo 1→2→1
```

Sirve como **suelo** —es gratis y cierra el caso más tonto, que es el que un formulario produce al
teclear el propio id— pero **no es el mecanismo**.

**2 · El disparador recursivo se cae por donde no se mira: dos escrituras a la vez.** Cada sesión
mete **una** arista del ciclo. El disparador lee sin bloquear, y en `READ COMMITTED` lo que la otra
sesión no ha confirmado **no existe**, así que las dos se dan por válidas:

| | Sesión 1 | Sesión 2 | Resultado |
|---|---|---|---|
| sin `FOR UPDATE` | `1→2`, abierta 4 s | `2→1` mientras la 1 sigue sin confirmar | las dos confirman · **2 filas en ciclo** |
| con `FOR UPDATE` | `1→2`, abierta 4 s | `2→1` | la 2 **espera 3,2 s** y falla con «ciclo detectado» · **0 filas en ciclo** |

**Es el mismo defecto que el §2 ya le atribuyó a los dos guardias que existen** —*«vulnerables al
estado que previenen»*— y ahora está medido, no supuesto. Y da la forma de la respuesta: **la
protección tiene que bloquear la cadena que lee**, o no protege de nada que ocurra dos veces a la
vez. Eso vale para el disparador y vale para una comprobación en servicio.

**3 · El camino materializado impide el ciclo y abre otro problema.** Al insertar es imposible meter
uno —el camino del padre ya contiene el id— pero **mover** un nodo no reescribe a sus descendientes:

```
caminos iniciales          1=/1/   2=/1/2/   3=/1/2/3/
UPDATE c SET parent_id = NULL WHERE id = 2;
caminos después            1=/1/   2=/2/     3=/1/2/3/   ← el 3 quedó mintiendo
descendientes con camino caducado: 1
```

Así que la cascada al mover **es parte de la opción**, no un detalle de implementación. Y el
organigrama es el grafo que más se mueve: 12 aristas que un humano arrastra en `/admin`.

**4 · `CYCLE` protege al LECTOR y es ortogonal a todo lo anterior.** Sobre datos que **ya** tienen un
ciclo, un `WITH RECURSIVE … UNION ALL` no termina; con `CYCLE` termina y además lo señala:

```sql
WITH RECURSIVE r AS (
  SELECT id, parent_id FROM z WHERE id = 1
  UNION ALL SELECT z.id, z.parent_id FROM z JOIN r ON z.id = r.parent_id
) CYCLE id SET es_ciclo USING camino
SELECT count(*), bool_or(es_ciclo) FROM r;      -- 3 filas, ciclo = true
```

**Esto no es una de las cinco opciones: hace falta además de la que se elija**, y es lo que convierte
el síntoma de hoy —una petición colgada y una conexión del pool que no vuelve— en un error legible.
Son **4 recorridos en producción** (`processGraph.js`, `taskAssignment.js`, `unidades.js` y la vista
`organizacion.unit_org_levels`), más uno en un test, y **ninguno** lleva `CYCLE` ni tope de
profundidad. Es `F26.P4.T3`, y su cifra conviene precisarla: la tarea dice «las cinco CTEs», que es
literal si se cuenta la del test; **las que hay que arreglar son cuatro**, y una de ellas es una
**vista**, así que una protección que sólo cubra `processes` deja la vista colgándose igual.

### Por qué la comprobación en servicio no puede ser la única capa, con la cuenta

Una comprobación en servicio protege **los caminos que pasan por ella**. Así que lo que decide si
basta no es que exista, es **cuántos caminos la rodean**. Censadas las vías de escritura de cada
columna sobre 251 ficheros de `backend/` y `scripts/` —sin tests y **quitando los comentarios**, que
es la lección de `sinProsa()`—:

| Grafo · columna | Vías literales en el código | ¿Editable en el `/admin` genérico? | ¿Tiene guardia? |
|---|--:|---|---|
| `processes.parent_id` | 2 | **sí**, `{ type: "number" }` | sí, en **1** de las 3 |
| `unit_relations.parent_unit_id` | 3 | **sí**, requerido | sí, en **1** de las 4 |
| `process_runs.source_run_id` | 1 | **sí** | no |
| `task_items.source_task_item_id` | 1 | **sí** | no |
| `lineas.linea_anterior_id` | **0** | **sí** | no |
| `ediciones.parent_version_id` | 1 | no — `readOnly: true` | no |
| `chat_messages.reply_to_message_id` | 0 | no — no está en el catálogo | no |

**Cinco de los siete se pueden escribir desde `/admin` como un número libre**, y ese camino es un
`UPDATE` con el nombre de la tabla **construido** en `SqlAdminService`, así que no hay un sitio donde
poner la comprobación sin injertar un caso especial en el camino genérico — que es el olor que
`CLAUDE.md` prohíbe por nombre.

Y el caso que lo resume: **`lineas.linea_anterior_id` tiene CERO vías en el código y sí está en
`/admin`.** Para esa columna, «comprobación en servicio» no significa «protección parcial»: significa
**ninguna**, porque no hay servicio por donde pase.

### La pregunta del dueño: ¿alguno de los siete necesita PERMITIR un ciclo?

Preguntado el **2026-11-12**: *«En la tabla que me mostraste ninguna de las 7 debería permitir una
relación cíclica. ¿O tú puedes justificar el caso específico de que alguno lo necesite?»*

**No. Ninguno, hoy.** Repasados uno a uno, los siete son jerarquías o linajes y en los siete un ciclo
es un sinsentido: un proceso no desciende de sí mismo, una versión no sucede a sí misma, una corrida
no sale de sí misma, un mensaje no responde a uno que le responde. **Y lo medido lo confirma**: cero
ciclos y cero autoapuntados en los siete.

Lo único que se le parece es **hipotético y está en `unit_relations`**, que lleva varios grafos sobre
las mismas filas discriminados por `relation_type_id`. Un tipo de relación **no jerárquico** —una
«colabora con», simétrica— produciría `A→B` y `B→A`, que en una tabla de aristas **es** un ciclo de
longitud 2 y sería correcto. Medido hoy: existe **un** tipo, `org` («Relación jerárquica
organizacional»), con sus **12 aristas**. Así que no hay ningún ciclo legítimo hoy — pero la
protección de ese grafo tiene que ir **acotada por `relation_type_id`**, como ya va su guardia
actual, para que añadir un tipo simétrico mañana no obligue a deshacerla.

### Y entonces la medición que de verdad reparte el trabajo: ¿quién MODIFICA la arista?

⚠️ **Esto corrige lo que este documento proponía antes.** La idea de «protección completa en los dos
que edita un humano y `CHECK` de autoapuntado en los otros cinco» era un argumento de **coste**, y
dicha así significaba dejar pasar los ciclos de longitud ≥2 en cinco grafos. Eso no se sostiene, y la
medición que lo deshace es otra: no *quién escribe* la columna, sino **quién la modifica**.

Censado sobre los mismos 251 ficheros, separando el `INSERT` del `UPDATE` —y descartando los `UPDATE`
que sólo la nombran en el `WHERE`, que no la modifican—:

| Grafo · columna | `INSERT` | `UPDATE` que la modifica | Quién |
|---|--:|--:|---|
| `processes.parent_id` | 2 | **1** | `processGraph.js` (`setProcessParent`) |
| `ediciones.parent_version_id` | 1 | **0** | — |
| `process_runs.source_run_id` | 2 | **0** | — |
| `task_items.source_task_item_id` | 1 | **0** | — |
| `chat_messages.reply_to_message_id` | 0 | **0** | — |
| `lineas.linea_anterior_id` | 0 | **0** | — |
| `unit_relations.parent_unit_id` | 2 | **0** literal · **1** por `/admin` | el editor genérico, con un `beforeUpdate` propio |

⚠️ **Corregido el 2026-11-17: aquí ponía «seis de los siete no los modifica NADIE en toda la
aplicación», y es falso para `unit_relations`.** El censo buscaba el `UPDATE` **literal**, y el
editor genérico lo **construye** (`SqlAdminService`), así que no lo vio — el mismo punto ciego que
`CLAUDE.md` ya nombra para la comprobación C del mapa. Y no es un camino accidental:
`services/admin/crud/tableHooks.js` tiene un `beforeUpdate` de `unit_relations` **escrito a
propósito para reemparejar una relación que ya existe**, que llama a `wouldCreateUnitCycle` antes de
dejar pasar el cambio. O sea que al organigrama **sí se le cambia el padre desde la aplicación**, y
con guardia.

Lo que queda en pie, dicho con precisión: **seis de los siete no tienen ningún `UPDATE` literal que
los modifique**, y de ésos, **cinco los puede modificar igualmente el editor genérico** (la tabla de
arriba), uno de ellos —`unit_relations`— con un gancho propio. Así que la inmutabilidad de los cinco
linajes **no es un hecho que se observe: es una regla que hay que IMPONER**, en la base. El
razonamiento que sigue no cambia —dice qué pasa *si* la columna no se modifica—, pero deja de ser
una descripción de lo que hay.

Y eso vale una protección distinta, porque **un ciclo necesita que una arista existente cambie de
destino**:

> Al insertar **una fila con su arista**, el `id` es nuevo y no puede estar en ninguna cadena previa,
> así que la arista va **de un nodo nuevo hacia el grafo que ya estaba**. Si ese grafo era acíclico,
> sigue siéndolo. Por inducción: **si la columna no se modifica nunca, no puede haber ciclo.**

O sea que para esas columnas **la inmutabilidad basta, y prohíbe el ciclo por completo** —no sólo el
de longitud 1, como haría el `CHECK`— a coste **O(1)**: ni recorrido, ni bloqueo, ni ~40 líneas de
plpgsql por tabla. Y el camino que hoy permite modificarlas no es ninguna regla de negocio: es el
editor genérico de `/admin`, que las expone en **cinco** de los siete.

⚠️ **Y la excepción que rompe la inducción, que es el hallazgo:** en una **tabla de aristas** el
razonamiento no vale. `insertarRelacion` inserta `(parent_unit_id, child_unit_id)` entre **dos
unidades que ya existen**, así que **una arista nueva puede cerrar un ciclo sin que nadie modifique
nada**. Por eso su guardia corre *antes de insertar* y no al modificar — y por eso `unit_relations`
necesita la comprobación completa aunque su columna fuese inmutable — que hoy **no lo es**: ver la
corrección de arriba. (Medido además: **cero** `DELETE FROM unit_relations` en el código dedicado;
reubicar una unidad pasa hoy por el editor genérico, que la reempareja con un `UPDATE` y **no deja
rastro del padre anterior** más que el `updated_at`. Esa falta de memoria es el frente **F27**.)

**El reparto que sale de medir, y no de estimar:**

| Protección que hace falta | Grafos | Por qué |
|---|---|---|
| **Recursiva, con bloqueo de la cadena** | `processes.parent_id` · `unit_relations` | los dos porque la aplicación los reempareja a propósito; y el segundo, además, porque una arista nueva entre dos nodos existentes basta para cerrar el ciclo |
| **Inmutabilidad** (rechazar que cambie una vez puesta) | `ediciones` · `process_runs` · `task_items` | ningún código dedicado los modifica (el editor genérico **sí puede** en los dos últimos), y el hijo siempre es nuevo al insertar |
| **Inmutabilidad**, y además salir de `/admin` | `lineas` · y revisar `chat_messages` | `lineas` es el caso extremo: **cero** vías en el código y editable en `/admin`, o sea que su única vía de escritura es la que no debería existir |

**Ninguno de los siete queda permitiendo ciclos.** Lo que cambia es que cinco se cierran por O(1) y
dos necesitan el mecanismo caro, en vez de los siete.

⚠️ **Y el mecanismo de esos dos depende de F27** (abierto el 2026-11-17). Si `unit_relations` pasa a
guardar su historia con **aristas fechadas** —lo decidido en `F27.P2.T2`—, reemparejar deja de ser
un `UPDATE` de la arista y pasa a ser *cerrar una fila y abrir otra*: la arista se vuelve inmutable
y el caso que queda es sólo el de la inserción entre dos nodos existentes, acotado además a las
filas **vigentes**. Lo mismo para `processes.parent_id` si sale a su propia relación. Por eso
`F26.P2.T1` espera a `F27.P3.T1`: elegir el disparador antes de saber la forma de la tabla sería
elegirlo dos veces.

### Lo que las mediciones implican (y que la decisión tendrá que resolver)

1. **Lo que se elija tiene que vivir en la base**, porque el camino que hay que cubrir —el editor
   genérico— no tiene servicio propio. Las opciones A, B, B′, C y D cumplen; la E, no.
2. **Y donde haga falta recorrer, tiene que bloquear la cadena**, o cae con dos escrituras a la vez.
   Medido: B entra en ciclo, B′ no.
3. **Pero sólo DOS grafos necesitan recorrer.** Los otros cinco se cierran con **inmutabilidad**, a
   O(1), porque nadie los modifica y el hijo siempre es nuevo al insertar. Eso reduce las ~40 líneas
   de plpgsql «por tabla» de siete tablas a dos.
4. **`CYCLE` va igual**, se elija lo que se elija: es lo que separa «error legible» de «petición
   colgada», y son cuatro recorridos, uno de ellos una **vista**.
5. **El `CHECK` de autoapuntado es gratis y entra hoy sin migrar nada** — pero **no es un sustituto
   de nada**: deja pasar el ciclo de longitud 2. Vale como suelo mientras se implementa el resto, no
   como protección de ningún grafo.
6. **Y una pregunta que la medición pone encima de la mesa sin responderla**: cinco de los siete
   están expuestos en `sqlTables.js` como un número libre, y a cinco de los siete **no los modifica
   nadie en la aplicación**. Proteger una columna que ningún código modifica y que sólo el editor
   genérico puede tocar es, en parte, proteger de una capacidad que quizá no debería existir. Si esos
   linajes no se editan a mano nunca, **retirarlos del catálogo** es más barato que protegerlos — y
   es una decisión de propiedad del dato, no de integridad.

### El SQL del laboratorio, para poder repetirlo

Las cuatro tablas, los disparadores y las provocaciones están en el `§6` de este documento en forma
de fragmentos; el guion completo que produjo cada cifra se reconstruye con ellos y con:

```sql
-- la carrera de dos sesiones (lo que destapa B)
-- sesión 1:  BEGIN; UPDATE b SET parent_id = 2 WHERE id = 1; SELECT pg_sleep(4); COMMIT;
-- sesión 2:  BEGIN; UPDATE b SET parent_id = 1 WHERE id = 2; COMMIT;
-- y luego:
SELECT count(*) FROM b x JOIN b y ON x.parent_id = y.id AND y.parent_id = x.id;
```

El coste por profundidad se midió con una cadena de 1 000 nodos y `\timing on`:
**0,669 ms** a profundidad 5, **3,273 ms** a profundidad 1 000.
