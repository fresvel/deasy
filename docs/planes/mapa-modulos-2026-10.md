# Frente 22 · El mapa de módulos: una sola respuesta a «¿dónde vive esto?»

**Abierto el 2026-10-04** por una pregunta del dueño: *«nuestro modelo ya tiene demasiadas tablas,
¿están creadas por módulos o no? ¿qué módulos tenemos? ya me está siendo insostenible entender».*

Y la respuesta medida fue incómoda: **no es que falte documentación, es que había cuatro y son
incompatibles.**

## Estado general — **21 de 24**

| Fase | Tareas | Estado |
|---|---|---|
| **F1** · Escribir el mapa | F1.1 ✅ · F1.2 ✅ · F1.3 ✅ | ✅ **3 de 3** |
| **F2** · La puerta de los niveles | F2.1 ✅ · F2.2 ✅ | ✅ **2 de 2** |
| **F3** · La puerta de propiedad | F3.1 ✅ · F3.2 ✅ | ✅ **2 de 2** |
| **F4** · Cuadrar los otros tres caminos | F4.1 ✅ · F4.2 ✅ | ✅ **2 de 2** |
| **F5** · Cerrar la deuda de escritura | F5.1 ✅ · F5.2 ✅ · F5.3 ✅ · F5.4 ⬜ · F5.5 ✅ · F5.6 ✅ | 🟡 **5 de 6** |
| **F6** · El dominio, dentro de la base | F6.1 ✅ · F6.2 ✅ · F6.3 ✅ · F6.4 ✅ · F6.5 ⛔ | ✅ **4 de 4** |
| **F7** · Reordenar el backend por dominios | F7.0 🟡 · F7.1 ✅ · F7.2 ✅ · F7.3 ⛔ · F7.4 ✅ · F7.5 🟡 **4/26 tablas** | 🟡 **3 de 5** |

## F6 · El dominio, dentro de la base — 4 de 5

| Tarea | Qué entrega | Estado |
|---|---|:--:|
| **F6.1** | Las 93 tablas en **8 esquemas de PostgreSQL**, uno por dominio | ✅ |
| **F6.2** | El `search_path` en los **tres** pools que se conectan, con prueba que los compara | ✅ |
| **F6.3** | Los cuatro programas que parsean el esquema, al día | ✅ |
| **F6.4** | `scripts/migrar-a-esquemas.sql` para una base anterior | ✅ |
| **F6.5** | ⛔ **DESCARTADA** · partir el fichero del esquema en 15 | ⛔ |

### Por qué los esquemas, y no es cosmética

El dominio era **una afirmación en un fichero JSON**: decía que `signature_requests` es de firmas y
había que creérselo. Ahora **lo dice la base de datos**, y si alguien crea una tabla en el esquema
equivocado falla una puerta de CI. Es la diferencia entre documentar y constatar.

**Y las 555 consultas no se tocaron.** El `search_path` resuelve los nombres sin cualificar igual que
antes. Lo que se gana: una consulta *puede* decir de qué dominio es, y `pg_dump -n firmas` saca un dominio
entero.

### Lo que lo demuestra

Dos PostgreSQL desechables, el esquema viejo en uno y el nuevo en el otro, comparados objeto por
objeto:

| | Actual | Nuevo |
|---|---|---|
| tablas · columnas | 93 · 803 | **93 · 803** |
| claves ajenas · únicas · `CHECK` | 182 · 65 · 46 | **182 · 65 · 46** |
| índices · disparadores · funciones · vistas | 358 · 55 · 12 · 1 | **358 · 55 · 12 · 1** |

Todo idéntico; lo único que cambia es dónde vive cada tabla. Y la prueba más fina: **las 93 huellas
de `check-doc-modelo` no se movieron**, porque se calculan sobre la forma de la tabla. Una huella
quieta es la constatación de que esto es una reubicación pura.

### Las cuatro trampas, todas medidas

**1 · El harness tenía su propio pool.** `tests/characterization/lib/db.mjs` abre el suyo y no hereda
nada del de la aplicación. Sin el `search_path` ahí: **169 de 338 pruebas en rojo** con
`relation "ediciones" does not exist`. Ahora importa `ESQUEMAS` en vez de copiarlo — es el
tercer pool del repositorio y una copia más habría sido una copia más que quedarse atrás.

**2 · El contrato del fichero tenía razón y yo no.** Metí 94 `ALTER TABLE ... SET SCHEMA` para
reubicar una base anterior, y el test `postgres_schema.test.js` las rechazó: el contrato `TD7-s` dice
que el fichero **describe la forma y no converge una base vieja**. Salieron del esquema a
`scripts/migrar-a-esquemas.sql`. El test que me paró es de agosto y es del dueño.

**3 · `CREATE TABLE IF NOT EXISTS firmas.x` no ve `public.x`.** Sobre una base anterior crearía una
tabla **vacía** en `firmas` y dejaría la vieja con todos los datos en `public`, **en silencio**, y el
sistema arrancaría como si la instalación fuera nueva. De ahí que la migración exista y que el aviso
esté escrito en tres sitios.

**4 · Un `CREATE TABLE` dentro de un comentario cuenta como tabla.** La cabecera nueva explica la
trampa anterior citando `CREATE TABLE IF NOT EXISTS firmas.x`, y dos programas se creyeron que
existía una tabla llamada `x` —94 en vez de 93—. Citar una sentencia al explicar SQL es lo natural,
así que ahora los dos saltan las líneas de comentario.

### Y una mejora que salió de rebote

Las relaciones del modelo generado **se emiten ordenadas**. El orden de `db2dbml` es un accidente de
cómo PostgreSQL recorre el catálogo, y al repartir las tablas cambió entero: mismas 182 relaciones,
otro orden, y un diff de 198 líneas que no decía nada. Un artefacto generado tiene que salir igual si
la entrada es igual.

### F6.5 · ⛔ descartada el 2026-10-04, y el motivo NO es el coste

Se llegó a elegir la forma (carpeta = dominio, nombre = nivel, 16 ficheros) y hasta el estilo de nombre.
Y el bloqueo que la tenía parada **se levantó solo**: al retirar `catalogo_documental.owner_process_id` en el
frente 23 desapareció la dependencia circular entre `plantillas` y `procesos`, y el reparto pasó a
ser posible sin mover ninguna tabla de dominio. **Medido: 15 ficheros y el orden existe.**

Se descarta por dos razones, y la primera es la que manda:

**1 · Un fichero DDL no es un módulo.** No tiene interfaz, nadie lo importa, nadie reutiliza un trozo
por separado. El criterio de Parnas —ocultar una decisión a un cliente— no se le puede aplicar porque
no hay cliente. Y lo que sí aplica va en contra: Ousterhout advierte contra subdividir más de lo que
el problema pide, porque **añade coste de interfaz sin reducir complejidad**.

**2 · El nombre no puede llevar el orden, y eso lo descubrí DESPUÉS de elegirlo.** Para crear una
tabla con clave ajena, la tabla a la que apunta tiene que existir ya. Con un fichero el orden está
dentro; con dieciséis, alguien tiene que declararlo — y el orden alfabético **no sirve**: en el nivel
0 pondría `identidad` antes de `organizacion`, y hay **6 claves ajenas** (`generos.pais_id`,
`estados_civiles.pais_id`, `parentescos.pais_id`…) que apuntan a `paises`, que es de
`organizacion`. Hay 4 más en los niveles 4 y 6. Ninguna de las cuatro formas de nombre que se
barajaron lo resolvía: el problema no es el adorno del número, es que **dos dominios comparten nivel y
uno necesita al otro**.

Suplirlo pedía **tres mecanismos nuevos** —una lista con el orden, un test que la valide, y un
ayudante que junte los ficheros para los 8 programas que hoy leen el fichero único— cuya única razón
de existir sería la partición.

⚠️ **Error de proceso que esto dejó al descubierto:** yo ofrecí un sistema de nombres **sin comprobar
que los nombres pudieran hacer el trabajo que les estaba dando**. Es el mismo error que el índice
único de F1.1 del frente 23: proponer un mecanismo sin probarlo contra las restricciones reales. El
dueño eligió con información incompleta por mi culpa, no por capricho suyo.

**Lo que se hace en su lugar es F7**: reordenar el **código**, que sí son módulos y donde el mandato
de la ingeniería es explícito.

## F5 · Cerrar la deuda de escritura — 2 de 6

| Tarea | Qué entrega | Estado |
|---|---|:--:|
| **F5.1** | `telefono_verification_keys` — y con ella la verificación por canal, que sobrevivía a un cambio de número | ✅ |
| **F5.2** | ✅ `emails` — `emailVerification.js` llama a `marcarVerificado` del `datos/` de `identidad` por su puerta | ✅ |
| **F5.3** | ✅ `persons` — las DOS escrituras de `services/mail` (`password_hash` y `status`) pasan por la puerta de `identidad` | ✅ |
| **F5.4** | `task_items` — `services/tasks` lo inserta y `services/documents` lo toca. **Se cierra con F7.5**, cuando `tareas` se mueva a su dominio. **Es la ÚNICA línea que queda en `_deuda_escritura`**: la otra, `fill_requests`, se cerró sola el 2026-10-09 porque la tabla murió con el frente 24 | ⬜ |
| **F5.5** | `document_versions` — `user_controler.js:727` hace un `UPDATE` que es de `services/documents` | ✅ **la cerró F7.2**: el `UPDATE` se fue a `DeliverableUploadService.js` y **la puerta avisó sola** |
| **F5.6** | ✅ `chat_notifications` — `AvisoDeCanalCaido` usa `crearNotificacion` por la puerta de `chat`. **No hizo falta el módulo de avisos** | ✅ |

## Por qué existe este frente: las cuatro clasificaciones

Medido el **2026-10-04** sobre las 93 tablas del esquema:

| Camino | Dónde vivía | Grupos | Cubría |
|---|---|---|---|
| **A** · el dominio | `scripts/docs/dominios.json` | 8 | 93/93 |
| **B** · la carpeta que escribe | `backend/services/*` | 16 carpetas | 30/93 |
| **C** · el recurso RBAC | `TABLE_RESOURCE_MAP` | 19 recursos | 73/93 |
| **D** · el subgrupo dibujado | los dos `mapa-completo.md` | 13 subgrupos | 87/93 |

Y cuánto coinciden — **de los pares de tablas que alguno junta, qué porcentaje juntan los dos**:

| | |
|---|---|
| A vs B | **20 %** |
| A vs C | **28 %** |
| A vs D | **27 %** |
| B vs C | **25 %** |
| B vs D | **35 %** |
| C vs D | **69 %** |

El único par que se parece es **C vs D**, y tiene sentido: los dos se escribieron pensando en el
usuario. Los otros cinco son desacuerdo.

⚠️ **Cuidado con la medida fácil.** El índice de Rand sobre las mismas particiones da 72–96 %, y es
engañoso: con muchos grupos, la mayoría de los pares de tablas están separados en las dos
clasificaciones y eso cuenta como «acuerdo». La pregunta útil es la de arriba — *¿juntan lo mismo?* —
y ahí el número es 20–35 %.

## F1 · El mapa — qué se escribió

**93 tablas · 15 módulos · 8 dominios · 8 niveles.** `dominios.json` dejó de repartir diagramas y pasó
a contestar «¿a qué parte del sistema pertenece esta tabla?». Cada tabla está en **un** módulo, y
cada módulo declara **dominio** (el diagrama, que sigue siendo uno de 8) y **nivel** (su sitio en el
orden de dependencia).

| Nivel | Módulos | Tablas |
|---|---|:--:|
| **0** · catálogos y territorio | `cat_territorio` · `cat_identidad` · `cat_firmas` · `cat_procesos` | 22 |
| **1** · identidad | `identidad` | 13 |
| **2** · organización | `organizacion` | 4 |
| **3** · acceso | `acceso` | 11 |
| **4** · declaración | `declaracion_procesos` · `declaracion_plantillas` | 11 |
| **5** · ejecución | `ejecucion` | 7 |
| **6** · flujos | `flujo_entrega` · `flujo_firma` · `flujo_rastro` | 11 |
| **7** · encima | `chat` · `empleo` | 14 |

### Lo que el cruce dominio ⨯ nivel enseñó, y ningún diagrama decía

**1 · El dominio `identidad` no es un dominio: son tres módulos apilados.** Sus 34 tablas se reparten
entre el nivel 0 (10 catálogos), la 1 (la persona, 13) y la 3 (el acceso, 11). Era el diagrama más
difícil de leer del sitio, y ésta es la razón medible.

**2 · El acceso va ENCIMA de la organización.** El primer reparto lo puso debajo y la puerta de niveles
lo rechazó con dos claves ajenas: `role_assignments.unit_id → units` y
`role_assignments.derived_from_assignment_id → position_assignments`. Un rol se asigna **dentro de**
una unidad. Consecuencia práctica: **quien cambia el organigrama puede romper permisos; al revés no
pasa nunca.**

**3 · Tres tablas tienen nombre de catálogo y no lo son.** También las cazó la puerta:

| Tabla | Parece | Es |
|---|---|---|
| `role_assignment_relation_types` | catálogo de tipos | tabla de relación de `role_assignments` (nivel 3) |
| `process_definition_period_types` | catálogo de periodos | detalle de `process_definition_versions` (nivel 4) |
| `contract_origins` | catálogo de orígenes | detalle de `contracts` (nivel 7) |

**4 · `process_runs` estaba en el dominio equivocado** (F1.3). Vivía en `procesos`, que es la
**declaración**; un lanzamiento es **ejecución**, y `tasks.process_run_id` apunta a él. Movido al
dominio `tareas`: `procesos` 9 → 8 tablas, `tareas` 8 → 9.

⚠️ **`term_types` se evaluó y NO se movió.** Era el otro módulo de una sola tabla, y moverlo
*empeoraría* el diseño: es el catálogo de `terms`, y llevárselo a otro dominio separaría el catálogo
de la tabla a la que sirve, en dos diagramas distintos. Que un módulo tenga una tabla no es un
defecto; es la descripción honesta.

**5 · El nivel 7 está medio vacío.** De las 93 tablas, **15 no aparecen en una sola línea de código**,
y 8 son el bloque de empleo entero. Más **8 que sólo se leen** y nadie escribe. No es código muerto:
es modelo declarado sin implementar, y ahora está dicho en el mapa.

## F2 · La puerta de los niveles

**Una clave ajena solo puede apuntar a su nivel o a uno inferior.** De las **182** del esquema:

| | | |
|---|---:|---|
| apuntan a un nivel **inferior** | 103 | 57 % ✔ |
| apuntan a su **mismo** nivel | 79 | 43 % ✔ |
| apuntan **hacia arriba** | **0** | infracción |

La puerta **nace en verde**, que es el momento barato de ponerla: a partir de aquí, el día que una
tabla de abajo apunte a una de arriba, CI lo dice en vez de que el modelo se enrede en silencio.

## F3 · La puerta de propiedad de escritura

**Una tabla la escribe un módulo.** Lo que importa no es en qué carpeta vive el fichero, sino que la
misma regla no se aplique en dos sitios — porque entonces uno se queda atrás.

**23 tablas** las escriben varias carpetas, pero **17 se explican por dos escritores transversales**
que son genéricos a propósito: el **bootstrap** (`services/system`, 32 tablas) y el **editor genérico
de `/admin`** (`services/admin`, 24). Están declarados por nombre en el mapa. Descontándolos, la
ambigüedad real eran **6** tablas, hoy **5** (ver F5).

### ⚠️ Esta sección decía «descartado», y estaba mal — pasó a ser F7

**Aquí se escribió «Lo que se descartó: ordenar `backend/` por módulo», y el motivo era el COSTE**
(62 ficheros que habría que partir). El dueño rechazó ese criterio con estas palabras:

> *«no me interesa el costo lo que me interesa es que al final quede legible o se gane legibilidad.
> ¿De qué me sirve el costo si no se entiende o no sé a dónde ir?»*

Retiré el argumento **en la conversación y no volví a este documento**. El plan siguió diciendo
«descartado» durante todo el resto de la sesión, hasta que el dueño preguntó por qué no estaba en el
mapa. Es el mismo fallo que este frente existe para arreglar —el documento separándose de la
realidad— y lo cometí en una sesión dedicada a eso.

**Lo medido sigue siendo válido; lo que cambia es la conclusión.** Pasa a ser la fase **F7**.

## F7 · Reordenar el backend por dominios — 2 de 5

**Reescrita el 2026-10-06** tras evaluar una propuesta externa de reestructuración. La versión
anterior de esta fase decía «mover `firmas` de punta a punta, sus 31 ficheros a un sitio» y **no era
realizable**: se midió, y de los ficheros que nombran una tabla de firmas **sólo 2 se mueven enteros**.
El orden estaba invertido.

Lo que sigue es lo que la medición dejó en pie, y lleva una fase nueva **delante de todas**, porque
sin ella las demás son arbitrarias.

### F7.0 · El criterio — lo que falta, y es lo primero

**No hay criterio declarado de qué es un dominio, y hay que escribirlo antes de mover un fichero.**
Los 8 dominios son **heredados**: son los 8 `.dbml` y los 8 `.svg` que se generaron en julio. Lo
único que se verificó alguna vez es la **cohesión de relaciones** —50 % de las 179 claves ajenas se
quedan dentro de un dominio— y se midió **después**, para defenderlos frente a los 15 «módulos»
(37 %). Es un resultado comparativo, no un criterio.

Tres propiedades que un criterio tendría que resolver, y que **hoy no se cumplen**:

| | Medido el 2026-10-06 |
|---|---|
| Un dominio **no es una pieza conectada** | `identidad` son **7 trozos** (27 tablas + `consentimientos`/`documentos_legales` + 5 sueltas), `organizacion` **2** (territorio 7 · organigrama 6, **sin ni una clave ajena entre ellos**), `firmas` **3** |
| Un dominio **no ocupa un nivel** | `identidad` 0/1/3 · `organizacion` 0/2 · `procesos` 0/4 · `plantillas` 4/6 · `tareas` 5/6 · `firmas` 0/6 |
| La mitad de las relaciones **cruzan** | 89 de 179 |

⚠️ **Y el grafo de claves ajenas NO puede dar el criterio.** Se probó la partición fina que parecía
obvia —`identidad` → `personas`/`acceso` y `organizacion` → `territorio`/`organigrama`— y **sale peor
en las dos medidas a la vez**: 47 % de cohesión contra 50 %, y 22 trozos contra 17. `acceso` sigue
partido en 7 porque `password_reset_codes`, `intentos_limitados` y `accesos_sensibles` **no se apuntan
entre sí**: su única clave ajena va a `persons`. Las tablas sueltas lo son por naturaleza, y un
catálogo no tiene ninguna. **Buscar conectividad es perseguir una propiedad que el modelo no tiene.**

Así que el criterio en uso es *«de qué trata la tabla», a ojo, con el diagrama como entregable*: un
criterio de **nombrado**, no de descomposición. Y por eso las **cinco** decisiones de más abajo —entre
ellas si el flujo de llenado es de `plantillas` o de `firmas`, y si `empleo` es un dominio— **no
tienen a qué apelar**.

**El criterio que hay que declarar es el de Parnas, y se verifica por dónde CAE un cambio, no por el
grafo:** una frase falsable por dominio, de la forma *«si cambia X, cambia SOLO este dominio»*. Eso ya
tiene puerta —es la comprobación **C**, la de los escritores— y `_deuda_escritura` es exactamente la
lista de los sitios donde la frontera está mal puesta.

### Por qué `dominios/` y no `modules/`

La propuesta externa llamaba a la carpeta `dominios/`. Se descarta el nombre, y `modules/` **también**,
por dos colisiones medidas:

| | |
|---|---|
| **`dominios/` no es una palabra nueva** | El repositorio ya la usa **para esta misma partición**, en tres sitios: `scripts/docs/dominios.json` (la fuente única), `docs/02-dominio-datos/dominios/<dominio>.dbml` (ocho ficheros, uno por dominio) y los ocho `docs/public/diagramas/*.svg` |
| **`modules/` choca dos veces** | (1) los **15 «módulos» retirados** el 2026-10-04, que `CLAUDE.md` prohíbe reintroducir; (2) **`frontend/src/modules/` ya existe** y su eje es **mixto** —`admin`, `home`, `perfil`, `auth` son audiencia; `firmas`, `procesos` son dominio—, así que la misma palabra significaría dos cosas distintas en las dos mitades del monorepo |
| ⚠️ **Y esta fase está escrita entera en «dominio», adelantándose a su propia F7.0** | Es deliberado para que se lea, no una decisión tomada: mientras F7.0 no elija, **`dominio` y `dominio` son la misma cosa con dos nombres** |
| ⚠️ **Pero `dominio` y `dominio` son HOY la misma cosa con dos nombres** | Y la ambigüedad **ya existía**: la fuente única se llama **`dominios.json`** y lo que declara dentro son **`dominios`**; `docs/02-dominio-datos/dominios/` guarda un fichero por **dominio**; y la puerta imprime *«8 dominios · 8 niveles · 92 tablas»*. Elegir la carpeta obliga a elegir la palabra: **va en F7.0**, y se aplica en los tres sitios de golpe o no se aplica |

### Lo medido: 169 ficheros de producción

El backend tiene **169 ficheros** de producción (sin `tests/`, sin `scripts/`, sin `*.test.js`). El
reparto, por lo que se puede **medir** —qué tablas nombra cada uno y cuáles escribe—:

| Grupo | Ficheros | Líneas | Destino |
|---|---:|---:|---|
| **Con SQL, destino único** | **46** | 11.204 | van a un solo dominio — pero **se parten por dentro**: la regla a `services/`, las consultas a `datos/` |
| **Con SQL, genéricos declarados** | 5 | 5.461 | `transversal/` — no se parten |
| **Con SQL, escriben 2+ dominios** | **7** | 5.408 | **no caben en un dominio: son flujos** |
| **Con SQL, sin dominio dominante** | **6** | 4.448 | **hay que partirlos** |
| **Sin SQL** | 105 | — | siguen a lo que envuelven — **y aquí no hay criterio medible** |

Los 46 de destino único: `identidad` 23 · `tareas` 7 · `organizacion` 6 · `plantillas` 3 · `procesos`
3 · `firmas` 2 · `chat` 1, más `services/admin/SqlAdminConBitacora.js`, que tiene SQL pero no nombra
ninguna tabla. Dos son falsos positivos de la propia medida y se corrigen a mano:
`config/postgres.js` nombra `identidad.persons` **en un comentario**, y
`controllers/admin/sql_admin_controller.js` es el controller del editor genérico → `transversal/`.

**Los 6 que hay que partir, y son los únicos:**

| Líneas | Fichero | Por qué no cabe |
|---:|---|---|
| 1.695 | `controllers/users/user_controler.js` | 6 dominios, el mayor con 37 % |
| 956 | `controllers/users/user_controler.queries.js` | 6 dominios, el mayor con **27 %** |
| 635 | `services/users/UserMenuService.js` | 6 dominios, 45 % |
| 633 | `services/admin/org/taskAssignment.js` | organizacion 48 % + tareas |
| 420 | `services/admin/generation/queries.js` | 4 dominios, 32 % |
| 109 | `controllers/tareas/tareas_controler.js` | 4 dominios, 33 % |

**Los 7 que NO se parten porque son flujos** — escriben tablas de 2 o 3 dominios **en una sola
transacción**: `templateLifecycle.js` (plantillas+procesos) · `DocumentSignatureWorkflowService.js`
(firmas+tareas) · `flowRows.js` (firmas+plantillas) · `GeneralTaskService.js` (procesos+tareas) ·
`generation/documents.js` (**firmas+plantillas+tareas**) · `FillRequestWorkflowService.js`
(plantillas+tareas) · `DocumentWorkflowResetService.js` (**firmas+plantillas+tareas**).

⚠️ **Eran 8 y son 7.** `services/system/genericCatalog.js` escribe `identidad`+`organizacion` y se
contó como flujo; su **único** usuario es `SystemBootstrapService.js`, así que es parte del
**bootstrap** y va a `transversal/` con él. Se corrigió el 2026-10-06, el mismo día.

⚠️ **Que comparten transacción no es una suposición.** El pool se abre en **18 ficheros** de producción
(`getConnection()`; `config/postgres.js` no cuenta — es quien la **define**) y la conexión **viaja como
parámetro** por **29**.
`services/admin/crud/tableHooks.js:66` la abre y `generation/documents.js` escribe con ella
`fill_requests` (plantillas), `signature_flow_steps` (firmas) y `task_items` (tareas) **en el mismo
`BEGIN`**. Partirlos por dominio obliga a elegir entre romper la atomicidad o declarar un orquestador
que cruza dominios. No hay tercera.

⚠️ **Y uno de los ocho cruza por una decisión del dueño, no por descuido.**
`templateLifecycle.js:352` y `:892` clonan la definición de proceso cuando cambia la versión de
plantilla — es la invariante del frente 23: *«si cambio una versión de plantilla, eso debe llevar a
una definición de proceso nueva»*. **Partir ese fichero por dominio partiría esa invariante en dos.**

### La estructura — CUATRO capas dentro de cada dominio

```
backend/
  index.js                 se queda; el único que importa de todos los dominios
  dominios/<dominio>/      ← los 8 nombres de ESQUEMAS
      index.js             lo único que otro dominio puede importar
      routes/              la superficie HTTP
      controllers/         sólo traduce HTTP: sin pool, sin SQL, sin reglas
      services/            reglas y transacciones; sin req/res
      datos/               el ÚNICO que ESCRIBE las tablas del dominio
                           (leer con JOIN hacia abajo, libre — ver más adelante)
  flujos/                  los 7 que cruzan dominios — ORQUESTACIÓN, SIN UNA SOLA CONSULTA
  transversal/             editor genérico de /admin + bootstrap
  plataforma/              postgres, minio, rabbit, mailer, errors, middlewares genéricos
  database/ scripts/ tests/   sin cambios
```

⚠️ **La cuarta capa estuvo descartada 24 horas y el descarte era FALSO.** Se escribió que `datos/`
«sería un fichero en `chat` y una carpeta vacía en `empleo`». Medido el 2026-10-06, fichero a fichero
y contando consultas:

| Dominio | Ficheros | Irían a `datos/` | Consultas | El mayor |
|---|---:|---:|---:|---|
| identidad/personas | 28 | **10** | 105 | `UserRepository.js` (19) |
| identidad/acceso | 32 | **11** | 45 | `sincronizarCatalogoRbac.js` (12) |
| organizacion | 10 | 4 | 31 | `orgStructure.js` (23) |
| procesos | 4 | 2 | 38 | `processGraph.js` (20) |
| plantillas | 6 | 3 | 27 | `templateArtifact.js` (11) |
| tareas | 10 | 6 | 40 | `launch.js` (15) |
| firmas | 6 | 3 | 6 | `BatchSigningService.js` (3) |
| chat | 15 | 4 | 41 | `chatStore.js` (29) |

En `chat` son **4 ficheros y 41 consultas**, no uno; y en `empleo` lo que está vacío es **el dominio
entero**, no la capa. El único argumento que quedaba en pie era el coste, y el coste **no es criterio
en este frente**.

**Y la cuarta capa DISUELVE el problema de los flujos**, que es lo que la hace estructural y no
cosmética. Si el SQL de cada tabla vive en el `datos/` de su dominio, un flujo **deja de escribir
tablas ajenas**: llama al `datos/` del vecino **con la misma conexión**, que es exactamente lo que ya
hacen 29 ficheros hoy. Entonces:

- `flujos/` no tiene **ni una consulta** — y eso lo comprueba una puerta en una línea.
  ✅ **VERIFICADO el 2026-10-06 en el flujo más pequeño** (ver más abajo).
- La transacción **no se rompe**: sigue abierta en un sitio y viajando por parámetro.
- La regla *«una tabla la escribe su dominio»* pasa a ser **verificable por ruta**, que es lo que
  F7.2 necesitaba y no tenía.

### El defecto que la cuarta capa saca a la luz

Medido el 2026-10-06: **77 sentencias SQL viven fuera de `services/`**, en 8 controllers y 1 router.
Y la dirección contraria está limpia: **0 ficheros de `services/` usan `req`/`res`** (el único
resultado era un comentario en `TelefonoService.js`).

| Fichero | Líneas | Consultas | Pool | Abre transacción |
|---|---:|---:|:--:|:--:|
| `controllers/users/user_controler.queries.js` | 956 | **45** | — | — |
| `controllers/users/user_controler.js` | 1.695 | **22** | sí | **sí** |
| `controllers/admin/sql_admin_controller.js` | 622 | 5 | sí | — |
| `controllers/tareas/tareas_controler.js` | 109 | 2 | sí | — |
| `controllers/empresa/program_controler.js` | 64 | 1 | sí | — |
| `controllers/tareas/supervision_controler.js` | 87 | 1 | sí | **sí** |
| `controllers/users/verificacion_registro_controller.js` | 157 | 1 | sí | — |
| `controllers/sign/sign_controller.js` | 305 | 0 | sí | **sí** |
| `routes/dossier_router.js` | 118 | 0 | sí | — |

**El peor no necesita discusión: lo dice el propio fichero.** La cabecera de
`user_controler.queries.js` —956 líneas, 45 consultas, 22 funciones exportadas— dice:

> *«Acceso a datos (solo LECTURA) de `user_controler.js` … Todas reciben `pool`/`connection`
> explícitamente: no capturan estado de módulo ni abren conexiones propias. Por eso este módulo NO
> importa nada — es el candidato natural a promoverse a `services/users/UserWorkspaceRepository.js`
> cuando se corrija»*

Es una capa de datos **ya escrita**, metida en `controllers/` y esperando que alguien le dé carpeta.
Eso es `datos/`.

### Cómo se monta un dominio: NO es mover ficheros, es recolectar

Es la corrección más importante de la auditoría del 2026-10-06, y cambia el *qué* de la fase. Se
había escrito «los dominios pequeños, y luego los grandes, uno a uno», como si un dominio se montara
mudando sus ficheros. **No es así.** Medido:

| Dominio | Su SQL vive hoy en | En su casa | **Fuera** |
|---|---:|---:|---:|
| tareas | 28 ficheros | 6 | **22** |
| procesos | 24 | 2 | **22** |
| organizacion | 30 | 4 | **26** |
| plantillas | 23 | 3 | **20** |
| identidad | 44 | 21 | 23 |
| firmas | 18 | 3 | **15** |
| empleo | 3 | 0 | 3 |
| chat | 2 | 2 | **0** |

De los 15 ficheros ajenos que tienen SQL de `firmas`, **sólo 3 se mudan**. Los otros 12 —
`user_controler.queries.js`, `tableHooks.js`, `orgStructure.js`, `SystemBootstrapService.js`… — **se
quedan donde están**, y lo que se extrae es *el trozo de firmas que llevan dentro*.

### Y la regla no es sobre el SQL: es sobre las ESCRITURAS

La primera redacción decía *«el SQL de una tabla sólo aparece bajo el `datos/` de su dominio»*.
**Es demasiado fuerte y había que corregirla**: obligaría a centralizar **126 lecturas** de
`organizacion` y **66** de `identidad`, y con ello **prohibiría los JOIN entre dominios** — que la
propuesta externa permitía expresamente («lecturas con JOIN hacia dominios de nivel inferior,
permitidas»). `units` se relaciona con los ocho dominios y `persons` con siete: centralizar sus
lecturas sería rehacer media aplicación para empeorarla.

**La regla, en su forma correcta:**

| | |
|---|---|
| **Escribir** | sólo el `datos/` del dominio dueño. Comprobable por ruta |
| **Leer** | libre hacia dominios de nivel **inferior o igual**, desde el `datos/` de quien pregunta |
| **`flujos/`** | ni escribe ni consulta: orquesta, y llama al `datos/` de cada dominio con la misma conexión |

Y medido con la regla correcta, el trabajo es **mucho menor de lo que parecía**, porque los
escritores ajenos son pocos y son **los mismos**:

| Dominio | Escritores ajenos | Cuáles |
|---|---:|---|
| **chat** | **0** | ya está recolectado |
| **empleo** | **0** | no tiene código |
| **organizacion** | **2** | `SystemBootstrapService.js` · `genericCatalog.js` — los dos del bootstrap, ya declarado transversal |
| **identidad** | **2** | los mismos dos |
| procesos | 4 | `tableHooks.js` · `templateLifecycle.js` · `SystemBootstrapService.js` · uno más |
| firmas | 5 | `tableHooks.js` · `documents.js` · `flowRows.js` · `DocumentSignatureWorkflowService.js` · `DocumentWorkflowResetService.js` |
| plantillas | 7 | los anteriores + `templateLifecycle.js` |
| tareas | 7 | los anteriores + `user_controler.js` · `taskAssignment.js` |

⚠️ **Y eso invierte el orden que esta fase traía.** Decía «`identidad` el último: es el peor, 62
ficheros en 19 carpetas». Por número de ficheros lo es; por **lo que cuesta montar su `datos/`** es de
los más fáciles: **2 escritores ajenos, y los dos ya están declarados**. Los difíciles son `tareas` y
`plantillas`, con 7 — y sus escritores ajenos son, casi todos, **los mismos ficheros que F7.1 y F7.2
ya tocaron**. Hechas esas dos, los ocho `datos/` se montan casi solos.

### Quién abre la transacción — la pieza que faltaba

La propuesta externa decía *«sólo `datos/` importa el pool»*. **No es sostenible**, y la medición dice
por qué: de los **18 ficheros** que abren transacción hoy, **15 están en la capa de servicio** (3 de
ellos entre los flujos), **2 son controllers** y 1 está entre los que hay que partir.

| | |
|---|---|
| `datos/` | **recibe** la conexión por parámetro y **nunca** la pide. Es lo que ya hacen 29 ficheros |
| `services/` y `flujos/` | **abren** la transacción, por un ayudante de `plataforma/` |
| `controllers/` | **ninguna de las dos cosas**. Los 2 que hoy la abren —`sign_controller.js` y `supervision_controler.js`— son **defecto**, y entran en F7.2 |

### Las otras dos reglas de la propuesta, medidas

**Regla 1 — un dominio sólo se importa por su `index.js`.** De los **396 imports internos** del
backend, **268 cruzan** de un destino a otro, así que 268 líneas pasarían por un `index.js`. Es la
consecuencia mecánica más grande del cambio, y la que hace que el reparto sea comprobable: un import
que no entre por el `index.js` es una infracción que se ve.

**Regla 4 — `plataforma/` nunca importa de un dominio.** Aparecen 30 cruces, y al mirarlos uno a uno:
**22 son `index.js`**, que tiene permiso explícito; **3 son colocaciones mal hechas en el reparto**
—`middlewares/val_password.js` es de `acceso`, `services/realtime/RealtimeGateway.js` es de `chat`,
`routes/internal_router.js` apunta a un controller de `personas`—; y **1 es acoplamiento real**:
`errors/sqlErrors.js` importa `config/sqlTables.js` para traducir el nombre de una restricción a un
mensaje. La regla es cumplible; lo que cazó la medición fueron **errores del reparto, no de la regla**.

**Lo que NO se adopta, y por qué:**

| | Por qué no |
|---|---|
| **La regla «los imports no suben de nivel», por nivel de DOMINIO** | **No es cumplible: un dominio no tiene un nivel.** Y si se instancia con el nivel máximo, `plantillas`, `tareas` y `firmas` quedan **las tres en el 6** —«mismo nivel», permitido— y la regla **autoriza exactamente los tres ciclos que importan**. Se reformula **por nivel de TABLA**, que es lo que la comprobación B ya calcula |
| **La regla «escrituras sobre tablas de otro dominio, no», tal cual** | Con `datos/` deja de hacer falta prohibirla. Se reformula en lo que sí se comprueba: *«una tabla la ESCRIBE sólo el `datos/` de su dominio»* y *«`flujos/` no contiene SQL»*. **Ojo: sobre las escrituras, nunca sobre todo el SQL** — la versión fuerte prohibiría los JOIN entre dominios (ver arriba) |
| **`services/admin/org/orgStructure.js` como genérico** | No lo es: escribe **sólo** tablas de `organizacion`. Se mueve, no se declara |

### La puerta de propiedad: por qué necesitaba `datos/`

La versión anterior proponía que la comprobación C pasara de *«que haya un solo escritor»* a *«que el
escritor sea el dominio dueño»*. **Sin la cuarta capa fallaría el primer día en cinco tablas**, porque
su escritor quedaría en otro dominio:

| Tabla | Dominio dueño | La escribe desde |
|---|---|---|
| `document_versions` | tareas | firmas (`DocumentSignatureWorkflowService`), plantillas (`generation/documents`) |
| `fill_requests` | plantillas | 5 ficheros, de tres dominios futuros |
| `task_items` | tareas | plantillas (`generation/documents`), procesos (`GeneralTaskService`) |
| `signature_flow_steps` | firmas | plantillas (`flowRows`, `generation/documents`) |
| `process_definition_versions` | procesos | **plantillas** (`templateLifecycle` — la invariante del frente 23) |

**Con `datos/` las cinco se arreglan sin excepciones**, y es la prueba de que la cuarta capa es
estructural: el que escribe `document_versions` pasa a ser **siempre** `tareas/datos/`, y lo que cruza
el dominio es la **llamada**, no la escritura. La puerta deja de necesitar una lista de perdonados y
pasa a comprobar dos cosas de una línea cada una: *el SQL de una tabla sólo aparece bajo el `datos/`
de su dominio* y *`flujos/` no contiene SQL*.

### Qué gana y qué pierde — el canje, dicho entero

**Gana tres preguntas que hoy no tienen carpeta:** *¿quién escribe esta tabla?* (hoy un `grep` sobre
169 ficheros; después una carpeta, **y una puerta por ruta**, que hoy es imposible); *¿quién ESCRIBE esta tabla?*
(hoy de 7 a 19 carpetas en los seis dominios grandes; después **un solo `datos/`**); *¿dónde empiezo a
leer `firmas`?* (hoy 21 ficheros en 7 carpetas; después `firmas/` **más `flujos/`** — 5 de sus 18
ficheros con SQL son flujos, así que **no es una carpeta, son dos**).

**Y pierde algo, aunque menos de lo que pareció al principio.** Hoy *«¿cómo se firma un documento?»*
se responde abriendo **un fichero**. Después se responde abriendo **el flujo** —que sigue siendo un
fichero y conserva el orden de los pasos— pero las consultas que ese flujo usa ya no están a la
vista: están en `firmas/datos/` y en `tareas/datos/`. Se gana *«¿quién toca esta tabla?»* y se paga
con un salto más al leer una operación de punta a punta.

⚠️ **Aquí se dijo primero que el canje era mucho peor** —«la pregunta se parte entre `firmas` y
`tareas`»— y eso era verdad **sólo sin la cuarta capa**. Con `flujos/` guardando la orquestación
entera y `datos/` guardando las consultas, la operación no se parte: se estratifica. El canje real es
un salto de lectura, no una pregunta sin dueño.

⚠️ **Corrección a la tabla que esta fase traía antes.** Decía «firmas: 31 ficheros, 13 carpetas». En
**código de producción** son **21 ficheros en 7 carpetas**; la cifra incluía los tests, y los tests
unitarios viven **junto a su módulo**, así que se mudan gratis. La tabla anterior inflaba la
dispersión de los ocho dominios.

### El piloto: verificado en `DocumentWorkflowResetService.js`

La suposición de que un flujo se lee bien **sin sus consultas** estuvo marcada «sin verificar» y se
comprobó el **2026-10-06** con un experimento completo sobre el flujo más pequeño de los siete — el
que `CLAUDE.md` pone como «estilo objetivo».

| | Líneas | Consultas |
|---|---:|---:|
| **`flujos/rehacerDocumento.js`** | 147 | **0** |
| `dominios/tareas/datos/documentVersions.js` | 89 | 3 |
| `dominios/plantillas/datos/flujoDeLlenado.js` | 57 | 3 |
| `dominios/firmas/datos/flujoDeFirma.js` | 60 | 3 |
| | **353** (de 277 → **+27 %**) | 9 = las 9 originales |

**Cómo se repartieron las 6 funciones internas, que es lo informativo:** **4 eran puro acceso a
datos** y se fueron enteras a un `datos/`; **2 se partieron**, y lo que se quedó en el flujo son
reglas de verdad —*«la ronda siguiente, entera»* (`max + 1`, qué se arrastra, qué se pone a `null`,
el estado `Borrador`) y *resolver el estado «cancelado» y lanzar si no existe»*—. El orquestador
exportado **no se tocó**: mismos guards 404/403, mismo orden, misma forma de retorno. Se conservaron
**los nombres originales de cada función**, justamente para que el diff probara que es un movimiento.

**Lo que lo demuestra:**

| | |
|---|---|
| Los tres `check:` | verde — **550 consultas en 275 ficheros** |
| **La puerta provocada** | se quitó un import y `check:imports` lo cazó: *«`flujos/rehacerDocumento.js:58` · `insertDocumentVersion` → falta importarlo de `dominios/tareas/datos/documentVersions.js`»*. **Ve las carpetas nuevas** y nombra el módulo de origen |
| `test:unit` | **879 / 879** |
| `test:char:run` | **321 / 321**, con su golden propio corriendo: `✔ reset · nace una versión NUEVA y la anterior se conserva` |
| **Goldens movidos** | **ninguno**. Es la prueba de que fue un movimiento y no una reescritura |

⚠️ **Y destapó un hueco que había que cerrar en el mismo commit: un test dentro de `flujos/` o
`dominios/` NO se ejecutaba, y en silencio.** Se probó metiendo un test que lanza una excepción:
`test:unit` siguió diciendo **879 / 0 fallos**. Los globs de `test:unit` son una **lista blanca**, así
que la estructura nueva obliga a ampliarlos **en los dos sitios** — hecho, y comprobado al revés: con
el glob ampliado el centinela sí falla (880 tests, 1 fallo).
**`sonar-project.properties` no tiene ese problema**: sus inclusiones de test son por **sufijo**
(`**/*.test.js`), no por ruta.

⚠️ **Y el hallazgo que más cambia el plan: el piloto NO se puede fusionar solo.**
`check-mapa-tablas.mjs` falla con **exit 1 y 4 hallazgos** en cuanto el piloto existe:

```
· C · 'document_fill_flows'      la escriben 2 sitios: dominios · services/documents
· C · 'fill_requests'            la escriben 2 sitios: dominios · services/documents
· C · 'signature_flow_instances' la escriben 2 sitios: dominios · services/documents
· C · 'signature_requests'       la escriben 2 sitios: dominios · services/documents
```

**La puerta está bien y el piloto está bien.** Lo que dice es que los otros escritores de esas cuatro
tablas siguen en su sitio viejo, así que la escritura queda repartida entre `dominios/` y `services/`.
Y de ahí sale la conclusión que reordena el trabajo:

> **La unidad de trabajo de F7 no es un fichero: son TODOS los escritores de una tabla.**

Por eso el piloto vive en la rama **`f7-flujo-piloto`** y **no se fusiona**: `develop` tiene que
quedarse con la puerta en verde. Y por eso F7.5 va **tabla por tabla**, no fichero por fichero —
`signature_requests` y `signature_flow_instances` las escribían 2 ficheros cada una, `fill_requests`
cinco, y hasta que se movieran los cinco la tabla tenía dos dueños.

⚠️ **Esas tres tablas YA NO EXISTEN**, y el ejemplo se queda a propósito porque el razonamiento sigue
valiendo. Las mató la fase 4 del **frente 24** (el recorrido unificado), que al colapsarlas en
`recorridos` + `turnos` **movió su escritura a `dominios/tareas/datos/`** — o sea, hizo el trabajo de
F7.5 para ellas sin llamarlo así. Ver «La re-medida de F7.5».

⚠️ **Segundo hallazgo, sin resolver: un flujo depende de otro flujo.** `rehacerDocumento.js` necesita
`resolveCurrentSignatureStep`, que vive en `DocumentSignatureWorkflowService.js` — otro de los siete.
Es una **lectura de firmas** que debería acabar en `firmas/datos/`; mientras no lo esté, un flujo
importa de otro. La regla *«un dominio sólo se importa por su `index.js`»* **no dice nada de
flujo→flujo**, y eso hay que decidirlo en F7.0.

### Las tareas

| Tarea | Qué entrega | Estado |
|---|---|:--:|
| **F7.0** | **El criterio de dominio y su nombre**: una frase falsable por dominio (*«si cambia X, cambia sólo esto»*), **una sola palabra** —`dominio` o `dominio`— aplicada en `dominios.json`, en la puerta y en la prosa, y las cinco decisiones de abajo resueltas. **Sin mover un fichero** | 🟡 **2 de 5 decisiones** (la 1 la resolvió el frente 24 construyendo; la 4 el dueño el 2026-10-07) |
| **F7.1** | **Declarar el común y los flujos, sin mover nada**: los transversales y los 7 flujos en el mapa, con su motivo, y la puerta leyendo la **ruta** | ✅ |
| **F7.2** | **Sacar el SQL y las transacciones de `controllers/` y `routes/`**: de **77 consultas a CERO**, y de 4 transacciones a cero. `user_controler.js`: **1.695 → 1.464 líneas** | ✅ |
| **F7.3** | ⛔ **DESCARTADA** · partir los ficheros «sin dominio dominante». El criterio no sobrevivió a su propia auditoría: **4 de los 5 que quedaban no escriben nada** | ⛔ |
| **F7.4** | **Los cuatro sin escritores ajenos**: **`chat` ✅** · **`empleo` ✅** (carpeta reservada) · **`organizacion` ✅** · **`identidad` ✅** (la PERSONA, con su subcapa; los otros cuatro asuntos son decisión de F7.0) | ✅ **4 de 4** |
| **F7.5** | **Los cuatro entrelazados, TABLA POR TABLA** (no fichero por fichero: lo probó el piloto). **RE-MEDIDA el 2026-10-09** tras cerrar el frente 24, que adelantó parte. **`firmas` ✅ cerrado** ese mismo día (ver abajo); quedan `plantillas` (3 repartidas) → `tareas` (9) → `procesos` (7, y depende de F7.0). Detalle en «La re-medida de F7.5» | 🟡 **5 de 26 tablas · `firmas` ✅** |

## La re-medida de F7.5 (2026-10-09) — lo que el frente 24 adelantó, y lo que destapó

Este plan daba F7.5 por **no empezada**, con cuatro dominios intactos y un orden razonado sobre
tablas que entonces existían. **Tres de las que nombraba están muertas** y la cuenta ya no es cero.
Medido con la misma forma que la comprobación C —quitando los comentarios antes de buscar, y sin
contar el harness ni los `scripts/`, que no son dueños—:

| Dominio | Tablas | Con **dueño único** | Repartidas | Qué hay ya en `dominios/` |
|---|--:|--:|--:|---|
| **`firmas`** ✅ | 2 | **1** | **0** | las **cuatro capas** + `datos/consulta/` |
| **`plantillas`** | 5 | **2** | 3 | `index.js` + `datos/` + `datos/consulta/` |
| **`tareas`** | 11 | **2** | 9 | `index.js` + `datos/` (2) + `datos/consulta/` (2) |
| **`procesos`** | 8 | 0 | **7** | ⛔ **la carpeta no existe** |
| | **26** | **5** | **19** | |

**`signature_statuses` y `term_types` no tienen escritor localizable**: son catálogos que siembra el
esquema, así que no son trabajo de F7.5 — y conviene no contarlas como pendientes.

### Tres cosas que cambian el plan, no sólo las cifras

**1 · El orden se invierte en los extremos.** Era `procesos` → `firmas` → `plantillas` → `tareas`,
contando *escritores ajenos por dominio*. Contando **tablas repartidas**, que es la unidad que el
piloto demostró, sale al revés en las puntas: **`firmas` es hoy casi gratis** (una tabla, un escritor,
`services/sign`) y **`procesos` es el más caro** (7 de 8 repartidas, cero adelantado, y sus escritores
son `services/admin` y `services/system`, que son los dos transversales declarados — así que mover
`procesos` obliga a decidir antes qué pasa con ellos, o sea **depende de F7.0**).

**2 · Los 4 ya cerrados los cerró el frente 24, y no por este plan.** `recorridos` y `turnos` nacieron
con su escritura en `dominios/tareas/datos/`, y `pasos_declarados` y `participantes_declarados` en
`dominios/plantillas/datos/`. Es la demostración de algo que este plan ya sospechaba al revés: **es
más barato colocar bien una tabla NUEVA que mover una vieja**. Cuando un frente vaya a crear tablas,
que las cree en su dominio — sale gratis y descuenta F7.5.

**3 · El «flujo depende de flujo» se disolvió, y no hace falta decidirlo.** Este plan lo dejó abierto
como segundo hallazgo: `rehacerDocumento.js` importaba `resolveCurrentSignatureStep` de
`DocumentSignatureWorkflowService.js`, otro de los siete flujos. **Ya no**: el paso 3b del frente 24
le dejó **cero consultas**, y hoy `rehacerDocumento.js` sólo importa de `dominios/tareas/`, de
`config/` y de dos servicios de documentos. La pregunta *«¿puede un flujo importar de otro?»* sigue
sin respuesta en F7.0, pero **ya no bloquea a nadie**.

### Y una consecuencia que la puerta grita y nadie ha atendido

`check-mapa-tablas.mjs` emite **tres avisos D** que son trabajo de F7.5 creado por el frente 24:

```
⚠ D · 'services/admin/generation/documents.js' ya sólo escribe un dominio: deja de ser un flujo y se mueve a él
⚠ D · 'services/documents/DocumentSignatureWorkflowService.js' ya sólo escribe un dominio: deja de ser un flujo y se mueve a él
⚠ D · 'flujos/rehacerDocumento.js' ya sólo escribe un dominio: deja de ser un flujo y se mueve a él
```

Los tres escriben **sólo `tareas`**, porque unificar el recorrido eliminó el cruce. `_flujos` bajó de
**7 declarados a 5**, y de esos 5 sólo **2 cruzan de verdad** (`templateLifecycle.js` y
`GeneralTaskService.js`). Así que la lista de flujos, que es cerrada por diseño, está hoy **más que
duplicada respecto a lo que hace falta** — y eso se arregla moviendo los tres a `dominios/tareas/`,
que es exactamente el primer tramo de F7.5 sobre ese dominio.

⚠️ **Es un aviso, no un fallo**, así que CI sigue en verde y puede quedarse ahí indefinidamente. Esa
es la forma en que esta deuda se hace invisible: la puerta la dice en cada corrida y nadie la lee.


### `firmas` ✅ — cerrado el 2026-10-09, y lo que destapó vale más que el movimiento

**Es el primer dominio de F7.5, y salió por barato: 1 tabla propia, 5 consultas, 0 goldens movidos.**
Pero delimitarlo fue la mitad del trabajo, y arreglar lo que apareció fue la otra.

#### El dominio no era lo que su nombre dice

`firmas` **no es «el flujo de firma»**: es el **mecanismo** de firmar un PDF —poner la rúbrica,
comprobar que vale, hacerlo en lote— más el estado técnico del resultado. Dos tablas:
`signature_statuses` (nivel 0, catálogo que siembra el esquema y **nadie escribe**) y
`signature_batch_jobs` (nivel 6, los lotes).

Y eso partió la superficie HTTP en dos, porque `/sign` mezclaba dominios:

| | |
|---|---|
| `POST /` · `/validate` · `/batch` · `/batch/start` · `GET /batch/:id` · `/batch/:id/download` · `/download` | **`firmas`** → `dominios/firmas/routes/` |
| `POST /fill-requests/:id/{start,approve,return,reject,cancel}` · `GET /documents/:dv/signature-flow` | **`tareas`** → se queda, se va con su tanda |

⚠️ **`routes/sign_router.js` sigue siendo el punto de montaje a propósito**, encadenando el router
del dominio con `router.use`. Así **las URL no cambian** y el contrato HTTP no se mueve: 320/320 sin
un golden tocado. Un refactor no cambia un golden, y aquí se podía demostrar.

⚠️ **La puerta exporta UNA sola cosa, y es un hallazgo.** Al medir quién necesitaba los servicios de
`firmas` desde fuera salió que **nadie**: `buildSignContext`, `processSinglePdfSigning` y
`persistSignatureWorkflowResult` sólo las usaba el controlador que se movió con ellas. El dominio
queda **cerrado**.

⚠️ **Y `sign_controller.js` dejó de existir.** De sus ocho manejadores, siete se fueron al dominio y
**uno no era de aquí**: `getSignatureFlow` devuelve el recorrido de un documento, que es un hecho de
`tareas`. Se fue con los otros seis del recorrido, a `sign_workflow_controller.js`.

#### Lo que destapó: TRES `pool` capturados al importar

`PdfSigningService`, `BatchSigningService` y `sign_controller` hacían
**`const pool = getPostgresPool();` en la columna cero**. Captura el valor del momento del import: si
el módulo entra antes de que exista la conexión, queda `undefined` **para siempre**, y dos endpoints
—bajar un documento firmado y el snapshot del recorrido— contestarían *«La conexión a PostgreSQL no
está disponible»* mandando a buscar un problema de base de datos que no existe.

**Funcionaba por orden de carga. Y meter el dominio tras una puerta es exactamente lo que cambia ese
orden** — «la puerta sólo decide quién entra primero», que es la lección que mordió cuatro veces el
2026-10-07. O sea: este movimiento habría activado el fallo si no se arregla con él.

⚠️ **Y `check:instancias` no lo ve**: busca `new` y esto es una **llamada de función**. Es la misma
forma de fallo una llamada más allá del alcance de la puerta. **Queda apuntado como hueco medido**,
junto al de los campos de clase que esa puerta ya tiene declarado.

#### Y tres cosas más que estaban mal por el camino

| | |
|---|---|
| **Un `if (!pool)` que no comprobaba nada** | en `downloadSigned`, vigilaba el pool **del controlador** para proteger una función que usa **el suyo**. Retirado: la comprobación vive donde está la conexión |
| **Una conexión dedicada sin transacción** | `assertSignContextBeforeSigning` pedía `getConnection()` sin `beginTransaction`: no protegía nada y podía quedarse sin soltar. Había **siete** así y las cerró F7.2; ésta se quedó fuera del barrido |
| **Una transacción copiada a mano** | `persistSignatureWorkflowResult` repetía `getConnection`+`beginTransaction`+`commit`+`rollback`+`release`. Pasa a `conTransaccion`, que F7.2 construyó para esto |

Resultado: los dos servicios con **cero** `.query(`, **cero** `getConnection` y **cero**
`beginTransaction`; `PdfSigningService` de 463 a 419 líneas y `BatchSigningService` de 354 a 326.

⚠️ **Un susto que no lo era:** `guardarLote` usa `ON DUPLICATE KEY UPDATE`, sintaxis de MySQL que
PostgreSQL rechaza — y es **la quinta aparición de la familia** que dejó roto
`POST /sign/fill-requests/:id/return` durante meses. **Aquí no:** `translateDialect` la reescribe a
`ON CONFLICT (job_id) DO UPDATE SET … = EXCLUDED.…`, infiriendo el target de la clave primaria. Lo
que estaba mal era **el comentario de `config/postgres.js`**, que decía *«NO cubre ON DUPLICATE KEY
UPDATE»* cuando sí lo cubre desde hace tiempo. Corregido: un comentario caducado así manda a alguien
a «arreglar» código que funciona.

#### Las dos consultas que cruzan, y por qué están aparte

`datos/` se queda **sólo con los lotes**. Las dos de `PdfSigningService` leen `document_versions`,
`task_items`, `tasks`, `recorridos` y `turnos` —todo `tareas`— así que van a `datos/consulta/`:
firmar un PDF necesita saber **dónde está el archivo** y **quién puede bajarlo**, y las dos cosas son
hechos de la tarea.

⚠️ Y una de ellas, `puedeAccederAlDocumento`, **es un guardia de acceso y no un detalle de
almacenamiento**: aquí vivió un IDOR —el guardia miraba la TAREA y no el ENTREGABLE, así que un
docente bajaba el documento de su compañero—. Va con el aviso escrito encima.

#### Y el `index.js` del dominio decía una cosa falsa

Afirmaba que `user_certificates` era de `firmas`. **No lo es**: el mapa dice `person_certificates`,
en **`identidad`** (nivel 1) — y el nombre que citaba **no existe en el esquema**. Misma lección que
`cargos`, que es de `identidad` y no de `organizacion`: **el dominio de una tabla se le pregunta al
mapa, no se adivina por el nombre.**

### F7.1 ✅ — declarado, y lo que destapó

Cerrada el **2026-10-07**. No movió ni un fichero de sitio: lo que hizo fue **declarar** y **estrechar
la puerta**.

**1 · La exención pasó de carpeta a fichero, y eso era el agujero.** `_escritores_transversales`
eximía `services/admin` y `services/system` **enteras**: 31 ficheros, **15 de ellos escritores**,
cuando sólo **3** lo merecen (`SystemBootstrapService.js`, `genericCatalog.js`, `crud/tableHooks.js`).
Al estrecharla apareció **una** tabla que estaba tapada: `fill_requests`.

⚠️ **Y la exención del editor genérico resultó INÚTIL.** `services/admin/SqlAdminService.js` escribe
con `INSERT INTO ${tableName}` —construyendo el nombre—, así que la comprobación C, que busca el
nombre **literal** de cada tabla, **nunca pudo verlo**. Eximirlo no servía de nada: lo que cubre al
editor genérico es el catálogo de `sqlTables.js` y la comprobación A-bis.

**2 · Los 7 flujos están declarados con los dominios que escribe cada uno**, y eso habilita una puerta
nueva, la **D**: *un flujo que escribe un dominio que no declaró es un fallo*. Más dos avisos: si
declara uno que ya no escribe, y si se quedó con uno solo —entonces deja de ser un flujo y se mueve a
su dominio—.

**3 · `fill_requests` entra en `_deuda_escritura`, y no es «añadir una línea para callar la puerta».**
Estaba **tapada**, no es nueva. Y su caso **no es el de las otras cuatro**: no es la misma regla
escrita dos veces, son **dos operaciones distintas** sobre la misma tabla —`generation/assignees.js`
las **crea** al materializar el recorrido de entrega; `DocumentProgressService.js:113` **reactiva** una
devuelta al avanzar de paso—. Su línea dice eso y dice qué la cierra: **F7.5**, cuando las dos caigan
en `plantillas/datos/`. No antes, porque el piloto demostró que mover una sola deja la tabla con dos
dueños.

**Lo que lo demuestra — las tres provocaciones:**

| Provocación | Lo que dijo la puerta |
|---|---|
| Un flujo escribe un dominio sin declararlo | `D · el flujo 'GeneralTaskService.js' escribe tablas de 'identidad' y no lo declara en '_flujos'` |
| Un fichero de `services/admin` que ya no está eximido escribe una tabla ajena | `C · 'telefonos' la escriben 2 sitios: services/admin · services/users` |
| Un flujo declarado cambia de ruta | `D · '_flujos' nombra '…/MovidoDeSitio.js' y ese fichero no existe` |

El resumen de la puerta ahora dice, además de lo de siempre:
`Declarados:  3 transversales · 7 flujos que cruzan dominios`.

### F7.2 ✅ — de 77 consultas a CERO, y dos puertas que estaban ciegas

| Paso | Qué salió | Quedan |
|---|---|---:|
| 1 | `user_controler.queries.js` (45 consultas) → `services/users/UserWorkspaceRepository.js`. **Lo pedía su propia cabecera**, palabra por palabra | 32 |
| 2 | Los 4 controllers pequeños (5 consultas). `tareas_controler.js` pasa de **109 a 41 líneas**; `program_controler.js` de 64 a 44 | 27 |
| 3 | `sql_admin_controller.js` (3 consultas) → `services/admin/templates/artifactLookup.js`. Dos eran **la misma consulta repetida**, y queda una | 22 |

Y las 22 de `user_controler.js`, el peor fichero del repositorio, en tres pasos más:

| Paso | Qué salió | Consultas | Líneas |
|---|---|---:|---:|
| 4 | **Los anexos** (4 manejadores) → `services/documents/DocumentAttachmentService.js`. `document_attachments` la escribía **sólo** ese controller: su dueño pasa a ser un servicio | 22 → 16 | 1.695 → 1.670 |
| 5 | **Las cinco bandejas** → el repositorio del espacio de trabajo, que ya declaraba ser eso | 16 → 7 | → 1.553 |
| 6 | El **historial de relevos** → `taskQueries.js`, y la **descarga de plantilla** → el repositorio | 7 → **3** | → **1.510** |

**Quedan 3, todas en `uploadDeliverablePdf`**, que abre una transacción de verdad: eso es el paso de
las transacciones. Y `getConnection()` bajó de **9 a 4**.

⚠️ **Dos de los grupos no tenían NINGUNA prueba, y se comprobó antes de moverlos.** Las cuatro rutas
de anexos no las toca ni un golden —la única mención en `tests/` es un comentario— y la descarga de
plantilla tampoco, porque produce un ZIP. Así que la extracción de esos dos no tenía red de
comportamiento: ahora la tiene, con **11 pruebas unitarias nuevas** que pintan la forma del SQL, los
parámetros y los JOIN que impiden coger el anexo de otro entregable.

⚠️ **Y UNA DE ESAS PRUEBAS CAZÓ UNA SUPOSICIÓN MÍA FALSA.** Aseguré que la subconsulta de
participación compartida mira `task_item_tenures`: **no**, une **cinco** fuentes
—`entregable_asignado`, `puesto_responsable_ocupante`, `entregable_creador`, `flujo_entrega`,
`flujo_firma`—. La aserción ahora las pinta por nombre, y provocarla renombrando una tumba **10**
pruebas, no una: ese fragmento está bien cubierto.

⚠️ **Y `getConnection()` NO ES una transacción.** Lo dije mal y se midió: en `user_controler.js` había
**9 `getConnection()` y sólo 3 transacciones**; las otras 6 retenían una conexión del pool sin motivo y
se podían quedar sin soltar por cualquier camino que no pasara por el `finally`. Cinco se fueron con
las bandejas. Y en **todo** el backend sólo **dos** controllers abren transacción —`user_controler.js`
y `supervision_controler.js`—, no tres: en `sign_controller.js` hay `getConnection()` y no hay
`beginTransaction`.

**Antes de mover se comprobó lo que no se podía suponer:** ese SQL usa `GROUP_CONCAT(… SEPARATOR …)`,
que es MySQL — y funciona porque el pool trae un **traductor de dialecto** que lo reescribe a
`string_agg` (`config/postgres.js`). Y la **composición del WHERE opcional** se movió con su consulta:
dejarla en el controller era la mitad de la fuga, porque el controller decidía la forma del SQL.

⚠️ **DOS PUERTAS OBLIGATORIAS ESTABAN CIEGAS A 52 CONSULTAS, y salió de perseguir un contador que no
cuadraba.** `check:sql-aliases` bajó de 550 a 548 cuando la cuenta decía −1. Al aislarlo, el módulo
nuevo **no se contaba**: su lista de exclusión compara el **nombre** de la carpeta a cualquier
profundidad y contiene `templates` —pensado para `backend/templates/`, el de Jinja—, así que también
se saltaba `services/admin/templates/`:

| Fichero invisible | Consultas |
|---|---:|
| `templateLifecycle.js` (87 KB, el mayor del repositorio) | **45** |
| `flowRows.js` | 16 |
| `templateArtifact.js` | 10 |

`check:sql-aliases` y `check:sql-comments`, las dos a techo cero, sin mirar esa carpeta.
`check:imports` **no** lo tenía. Arregladas: se excluye sólo en la **raíz**. Ahora miran **600
consultas en 285 ficheros** —eran 548 en 274— y **están limpias**, que es la buena noticia.

**Provocada para probar que el arreglo sirve**, dentro de la carpeta que estaba ciega:
`check:sql-aliases FALLA — services/admin/templates/templateArtifact.js:624 usa "zz." y no se declara`.

Es **el mismo fallo que cometí hoy** en un script de medición propio: excluir un directorio por
nombre en vez de por ruta. La lección queda escrita en `CLAUDE.md`.

⚠️ **Y lo que NO entra en F7.2, dicho a propósito:** las **transacciones** siguen abiertas en tres
controllers (`user_controler.js`, `sign_controller.js`, `supervision_controler.js`). Mover una
frontera de transacción cambia **quién es dueño de la unidad de trabajo**: es un cambio de diseño, no
una extracción, y va en su propio paso.

### F7.2 ✅ — el cierre: la frontera de transacción

**Medido sobre `controllers/` y `routes/` al cerrar: `.query(` **0** · `beginTransaction`/`commit`/
`rollback` **0** · `getConnection()` **0**.** Lo único que queda del vocabulario de base de datos en
esa capa son **comentarios**.

**1 · Se construyó el ayudante que el frente 9 enumeró y nunca se hizo.** `conTransaccion` en
`config/postgres.js`, junto al pool, que es su única dependencia. El patrón —`getConnection`,
`beginTransaction`, `commit`, `rollback` en el catch, `release` en el finally— estaba **copiado a mano
en 19 ficheros**, y **cuatro de esas copias vivían en controllers**. Copiar una frontera de
transacción es copiar la decisión de qué es atómico, y cada copia podía olvidarse un `rollback` o un
`release` por un camino de salida.

Lleva **4 pruebas propias**, y una vigila el caso que las copias a mano hacían mal: **si el `rollback`
también falla, el error que llega al llamador es el ORIGINAL** —el que explica qué pasó— y la conexión
se suelta igual. Una fuga ahí agota el pool en producción y **no la ve ningún test de HTTP**.

**2 · Las cuatro transacciones se fueron a su servicio**, y una de ellas estaba **duplicada**:

| Dónde estaba | A dónde fue |
|---|---|
| `user_controler.addTaskItemObservation` | `DocumentObservationService.registrarObservacionDelEntregable` |
| `user_controler.uploadDeliverablePdf` | `DeliverableUploadService` (nuevo), con sus 3 consultas |
| `user_controler.resetDeliverableWorkflow` | `DocumentWorkflowResetService.rehacerFlujoDelEntregable` |
| `supervision_controler.supervisorResetTaskItemWorkflow` | **el mismo**: era la misma frontera copiada, y la diferencia real entre los dos es **un booleano** (`bypassStepOwnership`), no la atomicidad |

**3 · Lo que se dejó FUERA de la transacción, a propósito.** En la subida del entregable, resolver el
entregable, calcular el número de corrección y escribir el objeto en MinIO pasan **antes y fuera**:
una transacción de base de datos **no deshace un objeto ya escrito en MinIO**, así que abarcarla sería
prometer una atomicidad que no existe.

**4 · Y cerró una deuda de F5, sola.** `F5.5` pedía mover el `UPDATE document_versions` de
`user_controler.js:727` a `services/documents`. Al hacerlo, **la puerta avisó por su cuenta**:

```
⚠ C · 'document_versions' ya solo tiene un escritor: quita su línea de _deuda_escritura
```

Quitada. La deuda baja de **6 a 5**, y se cerró como dice que se cierran: **quitando una línea, no
añadiéndola**.

⚠️ **LO QUE NO ESTÁ HECHO, y es la regla entera y no un resto:** `controllers/` ya no tiene SQL ni
transacciones, pero **ocho ficheros siguen importando el pool** para pasárselo a un servicio como
ejecutor — 33 usos, 23 de ellos en `user_controler.js`. La regla de la estructura dice
*«`controllers/`: sólo traduce HTTP, **sin pool**, sin SQL, sin reglas»*. Cerrarlo pide que cada
función llamada resuelva el pool por su cuenta cuando no se le dé uno —como ya hace
`listDocumentObservations`—, y eso son 33 firmas: **es otra tarea, con su propio riesgo, y no se mete
de tapadillo en ésta.**

### F7.3 ⛔ — descartada, y por qué el criterio no se sostenía

Se midió el **2026-10-07** antes de partir nada, y el resultado fue que **no hay nada que partir**.

**1 · La lista había cambiado sola, y de forma reveladora.** Decía 6 ficheros y 4.448 líneas. Al
remedirla tras F7.2 son **5 y 2.975**, y lo que entra y sale cuenta la historia:

| | |
|---|---|
| **Salieron** | `controllers/users/user_controler.js` y `controllers/tareas/tareas_controler.js` — ya no tienen una sola consulta |
| **Entraron** | `services/users/UserWorkspaceRepository.js` (1.141 líneas) y `services/tasks/taskQueries.js` — **dos módulos que creó F7.2** |

⚠️ **Dicho sin adornos: F7.2 no eliminó la mezcla de dominios, la MOVIÓ.** La sacó de los controllers
—que es la parte que importaba, porque allí era una fuga de capa— y la concentró en dos repositorios
de lectura. Eso es progreso en la capa, no en la mezcla.

**2 · Pero la mezcla de un módulo de LECTURA no es una infracción**, y eso lo decidió la auditoría de
esta misma fase, no esta tarea: *escribir, sólo el `datos/` del dominio dueño; **leer** con JOIN hacia
dominios de nivel inferior o igual, **libre***. Medido en los cinco:

| Fichero | Lee de | Escribe en |
|---|---:|---|
| `services/tasks/taskQueries.js` | 5 dominios | **nada** |
| `services/admin/generation/queries.js` | 4 | **nada** |
| `services/users/UserMenuService.js` | 6 | **nada** |
| `services/users/UserWorkspaceRepository.js` | 6 | **nada** |
| `services/admin/org/taskAssignment.js` | 4 | `tareas`, **uno solo** |

**Cuatro de los cinco no escriben nada. El quinto escribe un dominio.** Ninguno infringe la regla, y
partir un módulo de lectura por dominio **esparciría la respuesta a una pregunta**: el espacio de
trabajo de una persona cruza seis dominios porque la pregunta los cruza.

**3 · Y el problema que F7.3 existía para resolver no existe.** Su premisa era de colocación: *«no
caben en un dominio, hay que partirlos antes de poder colocarlos»*. Con la regla corregida cada uno
tiene destino, y es el dominio **que pregunta**:

| Fichero | Va a | Por qué |
|---|---|---|
| `UserWorkspaceRepository.js` | `identidad/personas/datos/` | pregunta por el espacio de trabajo de **una persona** |
| `UserMenuService.js` | `identidad/personas/datos/` | el menú **de una persona** |
| `taskQueries.js` | `tareas/datos/` | lecturas de tareas y entregables |
| `generation/queries.js` | `tareas/datos/` | las búsquedas del lanzamiento |
| `taskAssignment.js` | `tareas/` | **escribe** `tareas`, y la escritura manda sobre la lectura |

**4 · Lo que sí queda, y no es de este frente.** `UserWorkspaceRepository.js` tiene **1.141 líneas**.
No es un problema de dominios —es una lista plana de funciones de consulta, sin ramas— sino de tamaño,
y el tamaño tiene su documento: [`referencia/calidad-y-medicion.md`](./referencia/calidad-y-medicion.md).
Lo que sí hay que saber de él es que, al leer de seis dominios, **un cambio en cualquiera de los seis
esquemas puede obligar a tocarlo**: es el precio de una lectura que cruza, y se paga a sabiendas.

⚠️ **Es la segunda tarea de este frente que muere midiendo**, después de `F6.5`. Y las dos por el
mismo motivo: el criterio que las justificaba no resistió su propia comprobación. Aquí, además, el
criterio lo había invalidado **la auditoría de la propia fase** cuatro commits antes — contar
referencias a tablas para decidir un corte era exactamente lo que esa auditoría había corregido, y la
tarea seguía escrita con el criterio viejo.

### F7.4 🟡 — `chat` movido, y tres hallazgos del piloto

**`backend/dominios/chat/` existe**, con las cuatro capas y su puerta:

```
dominios/chat/
   index.js       la puerta: lo único que se importa de fuera
   routes/        chat_router.js · notification_router.js
   controllers/   chat_controller.js
   services/      los 9 servicios
   datos/         chatStore.js — 28 consultas, TODAS de tablas de chat
```

Los **29 imports relativos** se recalcularon **por script** desde la nueva ubicación, no a mano. De
fuera entraban **5 imports a 5 ficheros**; ahora entran por el `index.js` y nadie se lo salta.

**1 · La comprobación E, que es lo que compra la subcapa de lecturas.** Provocada:

```
· E · 'dominios/chat/datos/chatStore.js' nombra 'task_items', que es de 'tareas'.
      El `datos/` de un dominio sólo nombra SUS tablas; lo que cruza va a 'chat/datos/consulta/'
```

Sin esa separación, `datos/` podría nombrar cualquier tabla y **nada distinguiría una lectura legítima
que cruza de un error**. Es la única regla de esta puerta que se puede comprobar sobre las lecturas.

⚠️ **2 · LA PUERTA DEL DOMINIO ROMPIÓ EL ARRANQUE, y es un coste de la regla que no estaba previsto.**

```
ReferenceError: Cannot access 'realtimeGateway' before initialization
  at new ChatRealtimePublisherService (…/ChatRealtimePublisherService.js:14)
  at …/chat_controller.js:20
```

El ciclo `chat ↔ realtime` **ya existía** —es uno de los **cinco pares mutuos** medidos el
2026-10-04—. Lo que hizo el barril fue volverlo **fatal**: antes `RealtimeGateway` importaba tres
ficheros de chat **directamente** y el controller no entraba en su cadena de inicialización; el
`index.js` arrastra **el dominio entero**, routers incluidos, y el controller **instancia 7 servicios
al cargar el módulo**, uno de los cuales leía el singleton de la pasarela como parámetro por defecto.

**No se debilitó la puerta: se arregló la fragilidad.** `this.gateway` sólo se usa dentro de los
métodos, así que se resuelve al usarse, con un getter que conserva la inyección para pruebas. La
lección, que vale para los tres dominios que faltan: **un barril no es gratis — convierte cualquier
ciclo latente en un fallo de carga, y un servicio no debe depender de otro módulo en tiempo de
carga.**

⚠️ **3 · `test:char:run` NO era reproducible en una pila recién creada — ARREGLADO el 2026-10-07.**
Dio **319 de 321**, y se probó que no era de este cambio: con el backend de **`develop` en la misma
pila** fallaban **los mismos dos** (`/legal/documentos` y su golden).

**Y la causa no era la que supuse.** Dije que el harness purga MinIO antes del bootstrap y se lleva la
semilla legal. **Falso**: `deasy-legal` no está en la lista que purga. La causa real es peor —
**ningún paso automático creaba nunca esos textos**. Viven sólo en MinIO con retención COMPLIANCE, y
en A/B/C estaban porque **alguien los publicó a mano meses atrás**. Una suite golden-master que
depende de contenido publicado a mano no es una suite: es una coincidencia.

| | |
|---|---|
| **Qué se arregló** | `npm run test:char:legal`, dentro de `test:char:fixture` **después del bootstrap y antes del seed** |
| **Cómo** | conduce el sistema **por su propia API** (borrador → texto → publicar), no escribiendo en MinIO a mano: así el object key, la huella y la retención salen por el camino de producción |
| **Los textos** | `backend/tests/characterization/setup/legal/`, **exportados byte a byte** de una pila que los tenía, para que **el golden siga valiendo**: `terminos_de_uso` son 2025 caracteres, exactamente lo que el golden afirma |
| **Idempotente** | en una pila donde el archivo ya los tiene, el bootstrap los adopta y el paso se salta. Probado: `[legal] saltado: terminos_de_uso (ya publicada, adoptada del archivo)` |
| **Y el silencio** | adoptar **cero** ya no es silencioso: el arranque avisa *«Archivo legal VACÍO: … el alta no registrará consentimiento alguno»* |

**Resultado: 321 de 321 en la pila nueva, sin mover un golden.** Y provocado al revés: sin los textos,
el paso falla diciendo *«No hay textos legales en …»* en vez de un `ENOENT` que no explica nada.

### La subcapa de lecturas, CERRADA en `chat`

**Las dos reglas se cumplen ya en un dominio entero, y las dos son comprobables:**

| | Regla | Cómo se comprueba |
|---|---|---|
| **R1** | todo el SQL vive en `datos/` | **0** consultas en `routes/`, `controllers/` y `services/` de chat |
| **R2** | `datos/` sólo nombra SUS tablas | la comprobación **E**, verde y provocada |

```
datos/chatStore.js                        28 consultas, TODAS de chat
datos/consulta/directorioDeUnidades.js     3, de `organizacion`
datos/consulta/accesoAlHilo.js             3, de `procesos` + `tareas` + `organizacion`
```

Las 6 salieron de **dos servicios con reglas**, que es lo que hacía que no fuera gratis:

| Fichero | Antes | Después | Consultas |
|---|---:|---:|---:|
| `ChatUnitDirectoryService` | 141 | **111** | 3 → **0** |
| `ChatAuthorizationService` | 230 | **137** | 3 → **0** |

**Y los servicios se quedan con todo lo que decide**: el 400, el 404 de «unidad no encontrada», el 403
de «no perteneces a esta unidad», el 403 de «no tienes acceso operativo», el 409 de «más de una unidad
accesible» y el cómputo de los conjuntos de participantes y moderadores. Lo que se fue es el SQL.

El SQL se movió **por rangos de línea, verbatim**, incluida la historia de sus comentarios — entre
ellos el párrafo de **18 líneas** que explica por qué el guard del IDOR de entregables **no** va en la
consulta del hilo, con sus tres motivos medidos. Ese párrafo **viaja con la consulta que explica**, no
se queda huérfano en el servicio.

**El veredicto de la subcapa, con el dominio hecho:** el coste real fue **dos extracciones** y el
resultado es **una regla de lectura que una puerta puede comprobar**, que es justo lo que la propuesta
sin subcapa no podía tener. En los otros siete dominios el reparto se decide igual: con su número.

### F7.4 · `empleo` reservado y `organizacion` movido

**`empleo`**: carpeta con su `index.js` **vacío a propósito** y sus 8 tablas nombradas. Queda escrito
por qué **no** repite el defecto de los 15 «módulos» retirados: allí cuatro no eran dueños de nada y
nunca lo iban a ser; aquí el trabajo está por hacer y el dueño confirmó que se hará.

**`organizacion`**: **12 ficheros** movidos, con `routes/`, `controllers/`, `services/`, `datos/` y
`catalogos/`, más su puerta. **23 imports** recalculados por script. De fuera entraban **9 imports a 7
ficheros**; ahora entran por el `index.js`.

⚠️ **Su `system_router.js` arrastra dos rutas que no son del dominio** —`/system/bootstrap/status` e
`initialize`, que son del transversal—. Viene aquí porque **6 de sus 8 rutas** son de organizacion, y
partirlo ahora obligaría a montar dos routers en el mismo prefijo sin necesidad. Está escrito en la
puerta para que el día que el bootstrap se mueva a `transversal/` se vea.

**Y su subcapa, cerrada el mismo 2026-10-07.** `routes/`, `controllers/`, `services/` y `catalogos/`
quedan con **CERO consultas**; las **24 que se movieron** viven en 5 ficheros de `datos/` (20 propias)
y 3 de `datos/consulta/` (4 que cruzan). `orgStructure.js`: **487 → 355 líneas**, sus **26 `throw`**
intactos y sus dos transacciones pasadas a `conTransaccion`.

| Dónde | Qué, y por qué ahí |
|---|---|
| `datos/unidades.js` | 6 · el grafo (nodos, tipos, aristas), la CTE del ciclo y los dos INSERT de «crear hijo» |
| `datos/puestos.js` | 7 · los puestos y las ocupaciones |
| `datos/geografia.js` | 6 · países y divisiones administrativas |
| `datos/instituciones.js` | 1 · la institución con su país resuelto |
| `datos/unitListing.js` | 1 · ya estaba, de F7.2 |
| `datos/consulta/ocupantesDeLaUnidad.js` | 1 · cruza a `identidad` (`cargos`, `persons`, `documentos_identidad`) |
| `datos/consulta/procesosDeLaUnidad.js` | 2 · cruza a `procesos` y a `identidad` |
| `datos/consulta/dependenciasDelPuesto.js` | 1 · los `COUNT` de las **8 tablas de 6 dominios** que pueden depender de un puesto |

**Tres cosas que esto enseñó, y ninguna es el tamaño:**

**1 · `cargos` es de `identidad`, no de `organizacion`.** Tres consultas que parecían propias cruzan
sólo por eso. No se adivina leyendo el nombre de la tabla: se pregunta al mapa. La comprobación **E**
lo dice sola, y se verificó que **no está ciega** a los ficheros nuevos provocándola a propósito
—un `JOIN persons` en `datos/unidades.js`— antes de dar la fase por buena.

**2 · «12 propias y 3 que cruzan» era la cuenta de la PUERTA, no la real.** Las de verdad eran
**20 y 4**. `check:sql-aliases` cuenta plantillas de JavaScript, así que no ve una consulta escrita
con comillas dobles (la de `paises` por ISO) ni una con el nombre de tabla interpolado (las ocho
dependencias del puesto). Una puerta a techo cero no es un censo, y usarla como censo subestima el
trabajo en un tercio.

**3 · Lo único que NO fue un movimiento verbatim fue el `UPDATE` dinámico**, y por eso es lo único
con test nuevo. El `SET` se construía con las claves que llegaban; ahora las columnas salen de una
lista **cerrada** del propio módulo de datos y una clave que no esté en ella se ignora. Tres tests
(`datos/puestos.test.js`) fijan el SET, el caso sin cambios —que antes habría sido
`SET  WHERE id = ?`— y el borde: `unit_id` y `id` no son editables desde el organigrama.

⚠️ **La lista de las 8 dependencias del puesto viajó COMPLETA, con su singular y su plural.** Se
escribe una vez y se usa para **decidir** y para **explicar**, y eso es lo que impide que las dos se
desincronicen —ya pasó: el mensaje decía «vacantes, contratos o reglas» cuando ya eran ocho—. Partirla
entre el servicio (el texto) y los datos (las tablas) habría reintroducido exactamente ese fallo.

**Verificado en la pila D**: `check:imports` · `check:sql-aliases` (**600 consultas en 304 ficheros**;
las de producción son las mismas **599** de antes — el +1 es el fichero de test nuevo, porque la
puerta cuenta también los tests, comprobado por sustracción) · `check:sql-comments` ·
`check-mapa-tablas` · `test:unit`
**897/897** · `test:char:run` **321/321**, **sin que se moviera un golden**.

**Y a mano, porque los goldens no llegan.** De los **12 endpoints** del dominio, char sólo cubre dos
—`GET /admin/sql/units` y `/units/graph`—. Los otros diez se probaron con sesión de admin: el detalle
de la unidad devolviendo cargo, nombre y cédula (las tres columnas que **cruzan a `identidad`**), los
procesos que la alcanzan, crear/editar/borrar puesto, asignar y desasignar ocupante, crear unidad con
padre, y los dos 409 —la segunda jefatura y el puesto con dependencias, que respondió
*«1 ocupacion depende de este puesto»* con el singular bien elegido—. **Las filas de prueba se
borraron**; quedan 14 unidades, las de la siembra.

⚠️ **HALLAZGO AJENO, destapado al probar: `units.slug` NO ES ÚNICO en la base.** El esquema lo declara
`VARCHAR(180) NOT NULL` y **sin `UNIQUE`** (`backend/database/postgres_schema.sql:414`), así que:

1. `createUnitWithParent` promete *«Ya existe una unidad con ese slug. Cambia el nombre o el slug.»* y
   ese `catch` de `isUniqueViolation` **es inalcanzable** — se comprobó creando dos veces la misma
   unidad: **201 y 201**, dos filas con `slug = 'unidad-de-prueba-f7-4'`;
2. y `SystemBootstrapService.js:561` resuelve una unidad con
   `SELECT id FROM units WHERE slug = ? LIMIT 1`, **sin `ORDER BY`**: con dos filas iguales el
   bootstrap engancha a **una cualquiera**.

Es **la misma forma** que el defecto del login por número de documento —`d.numero = ?` a secas— que se
retiró el 2026-08-29: una consulta que asume unicidad donde la base no la impone. **No se arregla
aquí**: poner el `UNIQUE` es un cambio de modelo, hay que decidir qué se hace con las filas que ya
estén duplicadas, y lleva documentación publicada en el mismo commit. Es ficha del **frente 1**.

### ✅ EL PRERREQUISITO QUE ESTE FRENTE DESTAPÓ, y que ya está cerrado — con puerta

**El mismo fallo mordió CUATRO veces en un día**, y no es el barril:

| Dónde | Qué hacía |
|---|---|
| `ChatRealtimePublisherService` | la pasarela como **parámetro por defecto** |
| `SqlAdminService` | **6 subservicios** en el constructor |
| `program_controler` | `const service = new SqlAdminService()` |
| `bootstrap_controller` | `const bootstrapService = new SystemBootstrapService()` |

**ESM tolera los ciclos; lo que no tolera es USAR una referencia antes de que se inicialice.** La
puerta de un dominio sólo cambia **quién entra primero**, así que **cada dominio que se mueve destapa
otra**. Y hacer perezoso un campo **sólo mueve qué orden rompe**: se vio aquí — el backend arrancaba y
`SqlAdminService.test.js` fallaba.

**Verificación, y la lección de cómo se verifica:** hay que probar **los dos órdenes de carga**,
porque uno solo miente. El backend arrancando no dice nada si el test que importa el servicio directo
revienta.

#### Cerrado el 2026-10-07: de 30 a CERO, en una tanda

La cifra que estaba escrita aquí —33 en 17— **era mía y estaba vencida**: contaba antes de arreglar
`program_controler` y `bootstrap_controller`, y además metía 12 `new Router`/`new Set`/`new URL`, que
no instancian nada nuestro y no pueden entrar en un ciclo. Remedido: **30 en 16 ficheros**.

| Cómo | Cuántas | Qué tenían de particular |
|---|---|---|
| Por script | **26** | La forma simple, en una línea. 149 sitios de uso reescritos, con el recuento de cada identificador cuadrado contra el censo previo |
| A mano | **3** | `sql_admin_controller` (`editor` envuelve a `service`: las dos perezosas, y el editor resuelve el servicio al resolverse) · `dossier_controler` (constructor de varias líneas, y **lee el entorno**: importarlo en un test fijaba el cliente con las variables de ese instante) |
| Borrada | **1** | `SqlAdminService` en `user_controler.js` con **CERO usos** |

⚠️ **Lo de la borrada merece su línea: el servicio más grande del backend, instanciado al cargar el
controlador más grande, para nada.** Importado y construido, nunca llamado. No lo veía nadie — el
backend no tiene lint y una instancia sin usar es sintaxis perfecta.

⚠️ **Y una trampa del método «extrae por script»: el regex también reescribe la PROSA.** `ident.`
aparece en los comentarios, y un «Ver el porqué del diseño en el servicio.» quedó como «en el
servicio().». Ningún test lo ve. Se caza mirando las líneas de comentario del diff, y conviene
hacerlo siempre que se convierta por patrón.

**La puerta, que es lo que lo cierra de verdad:** `npm run check:instancias`
(`backend/scripts/check_module_instances.mjs`), en el job `backend-checks` de CI con las otras tres.
Mira la **columna cero** de `controllers/`, `routes/` y `dominios/`, y cuando falla **dice qué
escribir**. Se comprobó que muerde devolviendo una de las 30 a su forma vieja: la cazó y salió con 1.
Una regla sin puerta se vuelve a romper — aquí está medido cuatro veces en un día.

**Verificado**: las cuatro puertas + la nueva · `test:unit` **897/897** (primer orden de carga) ·
arranque del backend y `test:char:run` **321/321** (segundo orden) · y **a mano los 9 endpoints que
ningún golden ejercita** —los cinco de geografía, la institución, `/admin/canales`, el certificado, la
foto, el escaneo del documento, `supervised-stuck`, `recuperar-correo` y `/admin/process`—, todos
respondiendo con su respuesta de dominio y no con un `TypeError`.

**`identidad` queda desbloqueado**, y es el grande: **62 ficheros**.

### F5.2 · F5.3 · F5.6 — las tres deudas que eran UNA, cerradas el 2026-10-07

**Se vio al medir qué quedaba fuera de `dominios/`, y no antes.** Las tres deudas de escritura tenían
la misma forma: **un escritor dentro del dominio dueño y otro fuera, en los mecanismos**.

| Deuda | Dueño | Quien escribía por su cuenta |
|---|---|---|
| **F5.3** `persons` | `identidad/datos/personas.js` | `services/mail/reset_password.js` (`password_hash`) **y** `emailVerification.js` (`status`) |
| **F5.2** `emails` | `identidad/datos/emails.js` | `services/mail/emailVerification.js` — el **mismo** `UPDATE` literal |
| **F5.6** `chat_notifications` | `chat/datos/chatStore.js` | `services/canales/AvisoDeCanalCaido.js` |

**Y la parte que importaba NO dependía de ninguna decisión pendiente.** La pregunta abierta —dónde
viven los mecanismos: dominio propio, `transversal/`, o repartidos— es de **colocación**. La deuda es
de **propiedad**, y se cierra haciendo que el de fuera deje de escribir y pida por la puerta del
dueño. Eso vale igual en cualquiera de las tres formas, así que se hizo primero.

⚠️ **TRES ESCRITURAS DEL `datos/` SALEN POR LA PUERTA, y no es una grieta en la regla: es la regla.**
«Una tabla la escribe sólo el `datos/` de su dominio dueño» no dice que nadie más pueda PEDIRLO —dice
que nadie más escriba—. El escritor vuelve a ser uno; lo que hay ahora son llamadores.

⚠️ **Y `F5.6` no necesitó el «módulo de avisos» que su propia línea proponía.** `chat` ya tenía un
creador genérico (`insertNotification`, que recibe las columnas); un aviso de canal caído es una
notificación como las demás y lo único que cambia es el `type`. **La respuesta estaba escrita antes
que la pregunta.** Coste medido y aceptado: ese creador relee la fila que inserta, así que hace una
consulta más que el INSERT suelto — y ese camino lo recorre el vigilante cuando un canal se cae, no el
tráfico normal.

#### La C tenía la misma ceguera que la E, y ya van dos

Al quitar las tres líneas de `_deuda_escritura`, la comprobación **C** falló: contaba como escritores
de `persons` y `emails` dos ficheros cuyo único `UPDATE persons` estaba **dentro de un comentario que
explica que ya no lo hacen**. Es exactamente lo que le había pasado a la **E** unas horas antes con
una frase correcta sobre `paises`.

Arreglado **en la raíz y una sola vez**: `sinProsa()` quita los comentarios de bloque, de línea y de
SQL, y la usan **C, D y E**. El `//` no se quita detrás de dos puntos, para no cortar una `minio://` y
perder con ella lo que venga después en la línea. Comprobado que la C sigue mordiendo con un
`UPDATE persons` de verdad.

⚠️ **Es la misma lección que `lib/mapa.mjs` lleva escrita sobre el esquema**, y conviene decirla
entera: una comprobación que mire la prosa **castiga al que explica**, que es el peor incentivo que se
le puede poner a este repositorio.

⚠️ **Y las cinco líneas de `_deuda_escritura` nombraban rutas que ya no existían** —`services/auth/
UserRepository.js`, `services/users/EmailService.js`, `services/chat/chatStore.js`—, vencidas por el
movimiento de dominios de F7.4. La puerta usa esa lista **por nombre de tabla**, no por ruta, así que
seguía verde mientras la prosa mentía. Las dos que quedan llevan ahora qué las cierra: `task_items`
con **F7.5**, y `fill_requests` con la **decisión 1 de F7.0** — no con una línea de código.

**Verificado en la pila D**: las seis puertas · `check-mapa-tablas` con la deuda de **5 a 2** ·
`test:unit` **897/897** · `test:char:run` **321/321** sin que se moviera un golden. Y a mano, porque
char no cubre dos de los tres caminos: las **cuatro escrituras ejecutadas por la puerta del dueño**
contra la base de la pila —`crearNotificacion`, `marcarEmailVerificado`, `marcarPersonaVerificada` y
`actualizarHashDeContrasena`—, comprobando el efecto en la fila y dejándola como estaba.

### F7.4 · `identidad`, primera tanda: la persona

**Lo primero que hizo la medición fue encoger la tarea, y la cifra vieja era mía.** «62 ficheros»
contaba cualquier mención del nombre de una tabla, **comentarios incluidos**. Apretado a referencias
dentro del SQL: **36 ficheros y 379 consultas**, y de esos 36 sólo **19 son del dominio** — los otros
15 leen `identidad` pero escriben en otro dominio, así que se van con el suyo.

**Y lo segundo fue partir el dominio en cinco.** Este plan y `CLAUDE.md` decían «tres cosas
apiladas»; son **cinco**, y los niveles no las separan porque el RBAC ocupa el 0 **y** el 3:

| Asunto | Tablas | Estado |
|---|---|---|
| **La persona** | 10 — `persons`, `documentos_identidad`, `emails`, `telefonos`, `direcciones`, `dossiers`… | ✅ movida |
| **Catálogos** (n0) | 10 — `generos`, `estados_civiles`, `cargos`… | ⬜ las escribe el catálogo genérico, transversal declarado |
| **El acceso / RBAC** (n0 y n3) | 8 — `roles`, `permissions`, `role_assignments`, `actions`, `resources` | ⬜ **decisión de F7.0** |
| **Los mecanismos** (n3) | 5 — verificación, `intentos_limitados`, `canales_bitacora` | ⬜ candidatos a `transversal/` |
| **Lo legal** (n1) | 2 — `consentimientos`, `documentos_legales` | ⬜ |

**Movidos: 50 ficheros** — la puerta, **2 routers** (`user_router` y `dossier_router`), **18
controllers** (todo `controllers/users/`) y **31 servicios**. **102 imports** recalculados por script,
y la puerta exporta **14 símbolos**: los 8 que de verdad se usaban de fuera (medido: 14 importadores
en 11 ficheros), los 2 routers y 6 manejadores que montan otros routers.

⚠️ **El RBAC se quedó fuera por una razón de diseño, no por tamaño**: lo usa **todo router**, así que
meterlo tras la puerta obligaría a **todos** los dominios a importar `identidad` para resolver un
permiso.

#### Lo que esta tanda rompió, que es lo que enseña

**1 · El ciclo entre puertas mordió por primera vez.** `identidad` ⇄ `organizacion` se necesitan
mutuamente —el país de la institución decide cuál es el documento nacional— y el mapa ya las declaraba
mutuamente dependientes. El ciclo existía con `chat` y `organizacion` sin molestar; aquí dejó **9
suites en rojo** con `ReferenceError: Cannot access 'UserRepository' before initialization`.

**Y el culpable estaba donde la puerta nueva NO miraba**: `services/realtime/RealtimeGateway.js`, con
un singleton de módulo cuyo **constructor** construía tres servicios de **dos** dominios. O sea: el
prerrequisito que se cerró hace tres commits estaba cerrado **sólo en el alcance que yo le había
recortado**.

**2 · El recorte de alcance era el mismo error de las puertas del SQL.** `check:instancias` miraba
`controllers/`, `routes/` y `dominios/` «porque el problema vive en los controladores». Fuera había
**once** sitios más —7 en `services/`, 1 en `middlewares/`, 3 en `scripts/`— y tres construían justo
lo que pasa por la puerta de un dominio. **73 ficheros vistos contra 203 reales.** Ampliada a todo el
backend, y las dos excepciones que parecían razonables (`index.js` y los `scripts/*.mjs`, que son
puntos de entrada) **se arreglaron en vez de eximirse**: cuatro líneas.

**3 · Se probó mirar los constructores y se retiró MIDIENDO.** Marcaba **13 sitios y 11 eran
inofensivos**: un constructor sólo corre al cargar si alguien instancia esa clase a nivel de módulo,
así que con el nivel de módulo a cero es redundante **por construcción**. Eso sí exige que la puerta
no tenga excepciones, y por eso no las tiene.

**4 · Un import con comillas SIMPLES sobrevivió a cuatro barridos y dejó el backend sin arrancar.**
`routes/dossier_router.js` escribe sus imports con `'`; todos mis regex miraban `"`. Se descubrió por
el log del arranque, no por una puerta. Y de paso resolvió bien la pregunta de dónde va ese router:
el dosier es el expediente de **la persona**, así que entró al dominio.

**5 · Y hay rutas relativas que no son imports.** `new URL("../../database/postgres_schema.sql",
import.meta.url)` se rompe igual al mover el fichero y ningún reescritor de imports la toca: dos tests
en rojo.

**Puerta nueva para 4 y 5: `npm run check:rutas`** (`backend/scripts/check_relative_paths.mjs`), en
CI. Resuelve las **679 rutas relativas** del backend —imports con cualquier comilla, `import()`
dinámico y `new URL(…, import.meta.url)`— y falla si alguna no existe. **Era el hueco que `CLAUDE.md`
nombraba y nadie tapaba**: ni `node --check` ni `check:imports` la ven, y antes sólo la veía el backend
al arrancar, que es un mal detector porque para entonces ya perdiste la corrida. Comprobado que muerde
con un import de comillas simples.

**Verificado en la pila D**: las **seis** puertas (`imports`, `instancias`, `rutas`, `sql-aliases`,
`sql-comments`, `check-mapa-tablas`) · `test:unit` **897/897 en 50 suites** —el mismo número que antes,
que es lo que dice que ninguna se quedó sin arrancar— · arranque del backend · `test:char:run`
**321/321**, **sin que se moviera un golden**.

#### La subcapa, cerrada el mismo 2026-10-07

`routes/`, `controllers/` y `services/` del dominio quedan con **CERO consultas**. Las **103** viven
en 9 ficheros de `datos/` (**82 propias**) y 8 de `datos/consulta/` (**21 que cruzan**).

| Servicio | Antes | Después |
|---|---|---|
| `UserRepository.js` | 866 L · 15 consultas · 2 transacciones a mano | **708 L** · 0 · 0 |
| `TelefonoService.js` | 337 L · 19 consultas | **269 L** · 0 |
| `DocumentoIdentidadService.js` | 390 L · 14 consultas · 1 transacción | **323 L** · 0 · 0 |
| `TelefonoVerificacionService.js` | 299 L · 8 consultas · 1 transacción | **243 L** · 0 · 0 |
| `EmailService.js` · `DireccionService.js` · `RecuperarCorreoService.js` | 425 L · 17 consultas | **351 L** · 0 |

**Las cuatro transacciones a mano pasaron a `conTransaccion`**, y en `confirmar` eso exigió un
argumento, no una suposición: sus tres retornos de «no verificado» hacían `rollback` explícito, y
**ninguno de los tres ha escrito nada** cuando sale, así que confirmar una transacción vacía y
deshacerla son indistinguibles. Lo que sigue deshaciendo es el canal inexistente, porque ése lanza.

**Dos ficheros no se extrajeron: se RECONOCIERON.** `UserCertificateRepository.js` (7 consultas, un
`throw` que es el guard del pool) y `dossierStore.js` (8 consultas, **cero** `throw`) ya *eran* módulos
de datos —el segundo lo dice en su propia cabecera—. Se movieron a `datos/` sin tocar su API: reescribir
la de un módulo que ya estaba bien no es mover código.

#### Lo que esto enseñó, y las tres puertas que cambió

**1 · «La puerta no es un censo» se volvió medible, y en la dirección contraria a la esperada.** Al
cerrar la subcapa de `organizacion` quedó escrito que `check:sql-aliases` no ve las consultas con
comillas dobles. Aquí se cuantificó: **35 consultas del dominio estaban escritas con comillas dobles y
la puerta no las miraba** —ni ésa ni la de los backticks—. Pasarlas a plantilla, que es lo que hacen
las demás, subió lo vigilado de **486 a 521 sentencias reales**. No se añadió ni una consulta: se hizo
visible lo que ya existía. *(El contador de la puerta dice 638 y no 521 porque además cuenta prosa: un
`` `UPDATE` `` citado en un comentario le parece una sentencia.)*

**2 · La comprobación E marcaba la PROSA.** `datos/verificacionDeTelefono.js` decía «lo que mira
`paises` está en `datos/consulta/`» —una frase **correcta**, que señala precisamente dónde va lo que
cruza— y la puerta la marcó como infracción. Ya quitaba los comentarios `--` de SQL; ahora quita
también los de JavaScript. **Es la misma lección que ya estaba escrita en `lib/mapa.mjs`**: citar una
tabla al explicar algo es lo natural, así que una comprobación que mire la prosa muerde justo cuando
alguien documenta bien. Verificado que sigue mordiendo con un `JOIN paises` de verdad.

**3 · `check:rutas` tenía su propio punto ciego: una ruta SIN `./`.** Un `os.path.relpath` devolvió
`datos/certificados.js` sin prefijo, y para ESM eso no es una ruta: es un paquete. El error —`Cannot
find package 'datos'`— no se parece al problema, y dejó **14 suites en rojo**. La puerta sólo miraba lo
que empieza por `.`; ahora marca también un especificador con extensión que **existe en disco** junto
al fichero que lo importa, que es la señal inequívoca de que perdió el prefijo.

⚠️ **Y un punto ciego que queda abierto, medido y no cerrado**: `check:instancias` **no ve los campos
de clase**. `UserRepository` tiene `documentosLegales = new DocumentosLegales();` como campo, que se
ejecuta en el constructor igual que si estuviera dentro. Hoy es inofensivo —nadie instancia
`UserRepository` a nivel de módulo, y eso sí está a cero—, así que es **latente, no un fallo**. Queda
escrito porque es exactamente la forma que la puerta no mira.

**Verificado en la pila D**: las **seis** puertas · `test:unit` **897/897 en 50 suites** · arranque del
backend · `test:char:run` **321/321**, **sin que se moviera un golden**.

**Queda de `identidad`** los cuatro asuntos de arriba —catálogos, acceso/RBAC, mecanismos y legal—, que
son **decisión de F7.0** y no trabajo mecánico.

### El piloto, integrado el 2026-10-07 — y lo que la fusión destapó

La rama `f7-flujo-piloto` llevaba **28 commits sin fusionar** y su propio mensaje decía por qué: «a
solas pone la puerta en rojo». Al integrarla, la puerta dijo **exactamente qué** y la mitad no existía
cuando se escribió el piloto.

**Tres conflictos de git, y los tres eran lo mismo: el piloto se había quedado ATRÁS, no obsoleto.**

| Conflicto | Qué pasaba |
|---|---|
| `supervision_controler.js` | F7.2 había **renombrado** la entrada: `rehacerFlujoDelEntregable` en vez de `resetDocumentWorkflowForTaskItem` |
| `user_controler.js` | el fichero **se movió** a `dominios/identidad/controllers/` (git siguió el rename solo), y el piloto traía de vuelta el `SqlAdminService` que resultó estar **muerto** |
| `DocumentWorkflowResetService.js` | el piloto lo **borra** y F7.2 le había **añadido** el envoltorio de la transacción |

⚠️ **Ese envoltorio es lo que se habría perdido tomando la rama tal cual**, y no es un detalle:
`rehacerFlujoDelEntregable` existe porque la frontera de transacción **la abrían DOS controllers con el
mismo código copiado**, y la diferencia real entre ellos es un booleano. Tomar el piloto sin él
devolvía el `beginTransaction` a los controllers, que es justo lo que F7.2 dejó a cero. Se portó al
flujo, con la nota de dónde viene.

#### Y la puerta encontró cuatro cosas que el piloto no podía saber

**1 · La comprobación E no existía.** `dominios/tareas/datos/documentVersions.js` tenía una consulta que
cruza a `procesos` (`process_definition_versions`, `terms`). Movida a
`tareas/datos/consulta/ultimaVersionDelEntregable.js`. **No es que el piloto estuviera mal: es que la
regla que lo ordena llegó después**, y eso es para lo que sirve una puerta.

**2 · La C destapó tres escrituras ajenas**, y se cerraron como las de F5 —por la puerta del dueño, no
declarando deuda—:

| Tabla | Quien escribía por su cuenta | Ahora |
|---|---|---|
| `document_versions` | `DeliverableUploadService` (el archivo vigente) | `tareas/datos/documentVersions.js` |
| `document_versions` | `DocumentStateService` (el estado) | ídem — la máquina de estados **decide**, no escribe |
| `document_fill_flows` | `DocumentProgressService` (el avance) | `plantillas/datos/flujoDeLlenado.js` |

**Eso obligó a abrir dos puertas parciales**, `dominios/tareas/index.js` y
`dominios/plantillas/index.js`: hoy esos dominios **sólo tienen `datos/`** —su `services/` se mueve en
F7.5— y su `index.js` lo dice en la primera línea, para que nadie los lea como un dominio terminado.

**3 · LA COMPROBACIÓN D MEDÍA MAL, y el piloto es el contraejemplo.** Contaba los dominios de un flujo
**buscando escrituras dentro del fichero**, o sea dando por supuesto que un flujo lleva su SQL. El
piloto demuestra lo contrario —**cero consultas**—, así que la D emitió **cuatro avisos que decían lo
contrario de la verdad**: que ya no cruzaba y que debía dejar de ser un flujo. Ahora los dominios de un
flujo son la unión de **lo que escribe él** y **los dominios cuyo `datos/` importa**.

⚠️ **Y al arreglarlo, la primera versión contaba también los imports de la PUERTA — y eso daba dos
fallos falsos**: `templateLifecycle.js` y `FillRequestWorkflowService.js` importan
`dominios/identidad/index.js` para **leer**. Importar el `datos/` de otro dominio es usar su capa de
escritura; importar su puerta puede ser cualquier cosa. La regla quedó acotada a `datos/`.

**4 · Un hueco que sigue abierto, y que esta fusión encontró:** el flujo importaba
`getLatestDocumentVersionForTaskItem` del módulo donde ya no está. **Eso no lo ve ninguna puerta** —
`check:rutas` comprueba que el fichero exista, `check:imports` que un símbolo usado esté importado, y
ninguna que el módulo **exporte** lo que le piden—. Lo vio node al cargar, con seis suites en rojo.

⚠️ **Y una pregunta de diseño que esto plantea y F7.0 debe cerrar:** el flujo importa
`dominios/<d>/datos/…` **directamente**, saltándose la puerta. Para los seis flujos que llevan su SQL
no se planteaba; para éste sí. La regla «un dominio sólo se importa por su `index.js`» no dice nada de
**flujo→`datos/`**, igual que no decía nada de flujo→flujo.

**Verificado en la pila D**: las seis puertas · `check-mapa-tablas` **sin un solo aviso** ·
`test:unit` **897/897 en 50 suites** · arranque · `test:char:run` **321/321**, **sin que se moviera un
golden** — que en un merge de 28 commits de divergencia es la única prueba que vale.

### Las cinco decisiones que F7.0 tiene que resolver

1. ✅ **RESUELTA el 2026-10-09 por el frente 24, y no decidiendo sino CONSTRUYENDO.** La pregunta era
   de qué dominio es el flujo de entrega, con `fill_requests` en **plantillas** y `signature_requests`
   en **firmas**: las dos mitades del mismo mecanismo en dominios distintos. El frente 24 las unificó
   en **`recorridos` + `turnos`**, que viven en **`tareas`**, y con eso la pregunta desaparece: no hay
   dos mitades que repartir. **Era un defecto del mapa de datos, como el plan sospechaba** — y la
   forma de cerrarlo no fue elegir un dominio, fue quitar la duplicación que obligaba a elegir.

   ⚠️ Esto deja `_deuda_escritura` con **una** línea (`task_items`): la de `fill_requests`, que esta
   decisión tenía que cerrar, se cerró sola al morir la tabla.
2. 🟡 **¿`plantillas` y `procesos` son un dominio o dos?** — **MEDIDA el 2026-10-09, y la respuesta
   de hoy es DOS, pero queda CONDICIONADA** al frente 25.

   **Lo que el plan decía y es FALSO:** *«si siguen separados, `templateLifecycle.js` (1.874 líneas)
   se parte y la invariante cruza una frontera»*. Ni hay que partirlo ni eso es un problema: una
   invariante que cruza una frontera **es para lo que existen los flujos**, y `templateLifecycle.js`
   **ya está declarado** en `_flujos` como `["plantillas","procesos"]`. El coste de tenerlos
   separados es **una línea en una lista declarada**, no partir un fichero de 1.868 líneas.

   **Lo medido, y la primera medida salió mal:** contar commits que tocan «un fichero que escribe
   `procesos`» da **73 % tocando los dos** — y es un artefacto, porque los dos ficheros más grandes
   escriben ambos dominios y se tocan constantemente por motivos ajenos. Con **sólo el código propio
   de cada dominio**, desde julio: **14 commits sólo `plantillas` · 22 sólo `procesos` · 3 los dos**.
   **92 % cambió uno solo.** Ésa es la prueba de Parnas bien aplicada.

   El grafo de claves ajenas **no decide**: juntarlos sube la cohesión del 52 % al 56 %, o sea cruza
   **una sola** clave ajena (`vinculos.edicion_id`).

   ⚠️ **Y POR QUÉ QUEDA CONDICIONADA.** El argumento decisivo no fue ninguna de esas cifras: fue que
   **`ad_hoc` existe** — una plantilla puede ser de una **persona** y de ningún proceso
   (`catalogo_documental.template_scope`, `owner_person_id`), con su propio resolutor y su propio
   camino en la pantalla. Si eso es cierto, `plantillas` **no cabe** dentro de `procesos`. Pero si el
   dueño decide que `ad_hoc` no debe existir, el argumento se cae y la respuesta cambia.
   **Eso es la pregunta `C` del [frente 25](./plantilla-y-linea-de-proceso-2026-10.md).**
3. **¿Quién es dueño de `document_versions`?** El mapa dice `tareas`; lo escriben 5 ficheros de 3
   dominios futuros.
4. ✅ **RESUELTA el 2026-10-07 por el dueño: `empleo` ES un dominio y se le reserva la carpeta.**
   *«Si se tendrá módulo de empleo.»* Hoy son 8 tablas con **0 servicios propios y 0 escritores** salvo
   el editor genérico —las 8 **sí** aparecen en el código, todas en `config/rbacCatalog.js` y
   `vacancies` en 6 ficheros, así que no es que no existan: es que nadie las escribe—. La carpeta nace
   **vacía a propósito**, como el sitio al que ir cuando se construya.

   ⚠️ **Y esto NO repite el defecto de los 15 «módulos» retirados**, aunque se parezca. Allí el
   problema era que cuatro de los quince **no eran dueños de ni un fichero y nunca lo iban a ser**:
   eran una clasificación inventada sobre código que no existía. Aquí la carpeta está vacía **porque
   el trabajo está por hacer y el dueño confirma que se va a hacer**. Una carpeta vacía por reserva
   declarada es una promesa; una carpeta vacía por clasificación inventada es un error. No son lo
   mismo.
5. **¿Se reparte `services/admin`?** Dos de sus cuatro subcarpetas no van donde parecía:
   `processes/` → procesos ✅ y `org/` → organizacion ✅, pero `templates/` **no** es plantillas a
   secas (`templateLifecycle` escribe también procesos) y `generation/` **no** es tareas
   (`documents.js` escribe tres dominios).

### Y dónde está `identidad` partido

El corte `personas`/`acceso` **es el correcto y ya está en los datos** —pero son **tres**, no dos, y
no mejora la cohesión (ver F7.0):

| | Tablas | Qué es |
|---|---:|---|
| **nivel 0** | 10 | catálogos, y **se reparten**: `generos`, `estados_civiles`, `parentescos`, `tipos_discapacidad`, `autoidentificaciones_etnicas`, `categorias_visa` → personas; `actions`, `resources` → acceso; `cargos`, `canales_mensajeria` → discutibles |
| **nivel 1** | 13 | **personas**: `persons`, `documentos_identidad`, `direcciones`, `telefonos`, `emails`, `dossiers`… |
| **nivel 3** | 11 | **acceso**: `roles`, `permissions`, `role_assignments`, `password_reset_codes`, `intentos_limitados`… |

Y las carpetas que hoy no se sabe dónde van, por lo que **escriben**: `services/legal` →
`documentos_legales`, `consentimientos` (nivel 1) → **personas**. `services/limites` →
`intentos_limitados` (nivel 3) → **acceso**. `services/canales` es el único que **no cabe**: escribe
`canales_bitacora` (acceso) **y** `chat_notifications` (chat) — es la entrada que `_deuda_escritura`
ya marca diciendo *«puede que la respuesta sea un módulo de avisos»*. Y `services/mail` se parte
igual: escribe `persons.password_hash` (la otra deuda declarada), `emails` y
`email_verification_codes` — el **envío** es plataforma, los **códigos** son acceso.

### El riesgo que no tiene red

Los **105 ficheros sin SQL** —el 62 % del árbol— no los cubre ninguna medida ni ninguna puerta. El
criterio de tablas **no los atribuye**: propagarlo por imports da **7 dominios** a
`routes/dossier_router.js`, porque importa el middleware de permisos. Son 15 routers, 14 controllers
de `users`, 11 de `services/admin`, 9 middlewares, 7 de chat. Su sitio es un **juicio**, y una
equivocación ahí es invisible para `check:imports`, para los tests y para la puerta del mapa.

Lo demás sí tiene red: `check:imports` es obligatorio, y los tests de caracterización son un
golden-master del contrato HTTP — **un movimiento puro no debe mover ni un golden**. Y el segundo
riesgo real es el conocido: el SQL no lo valida nadie hasta que se ejecuta esa rama, así que partir
6 ficheros con 4.448 líneas de consultas es el escenario de los `UPDATE … INNER JOIN` que
sobrevivieron meses; `check:sql-aliases` y `check:sql-comments` sólo ven sentencias completas.

### Las cifras corregidas de la propuesta externa

Se verificaron sus once afirmaciones sobre el código. Ocho se confirman; estas cuatro no:

| Decía | Es |
|---|---|
| ~48 sentencias SQL en `controllers/` | **77** (22 sólo en `user_controler.js`) |
| `controllers/users` importa de 11 carpetas de `services/` | **10** |
| `services/admin` concentra ~260 de ~635 consultas de `services/` | **219 de 643** — y el segundo no es `documents` sino **`services/system` con 126** |
| Las 8 tablas de `empleo` no aparecen en el código | **Falso**: aparecen las ocho. Lo que no tienen es **escritor** |

Y hay un **quinto ciclo** que no listaba, y cruza capas: **`config ↔ services/documents`** —
`config/sqlTables.js` importa `services/documents/DocumentStateService.js`.

⚠️ **Y el frontend no entra en esta fase.** Está repartido por **audiencia** —`admin`, `home`,
`perfil`, `auth`— y ese eje es legítimo: son tres aplicaciones para tres personas distintas. Lo que
está mal allí es otra cosa: `modules/procesos` tiene **1 fichero** mientras el asistente de procesos
vive en `modules/admin/`. El arreglo es que el dominio sea el **segundo** nivel dentro de cada
audiencia, y eso es una fase aparte.

## F5.1 · El teléfono — lo que se arregló, y lo que resultó NO ser

⚠️ **Se afirmó primero que había un agujero de verificación y no lo había.** La hipótesis era que una
llave emitida contra el número anterior podía verificar el nuevo. **Es falsa**: `confirmar()` hace
`INNER JOIN telefonos` y compara contra el número **actual** —la llave no guarda ninguno— y además
exige que la prueba venga **de ese número** («el canal asegura que ESTE número le mandó ESTA llave»).
Gastar una llave vieja exige escribir desde el número guardado, lo que prueba controlarlo.

**Lo que sí había, y es peor que la llave: la verificación por canal sobrevivía al cambio de número.**
Medido sobre la pila B antes de tocar nada:

```
ANTES      numero=990000000  canales=[telegram:1, whatsapp:1]  llaves_vivas=0
con llave  numero=990000000  canales=[telegram:1, whatsapp:1]  llaves_vivas=1
guardarPrincipal devolvió id=1 (la MISMA fila)
DESPUÉS    numero=990000001  canales=[telegram:1, whatsapp:1]  llaves_vivas=1
```

La fila se reutiliza —mismo `id`, número nuevo—, así que el número nuevo heredaba **dos canales
verificados sin haber demostrado nada**. Y «¿está verificado este teléfono?» se responde con «¿tiene
algún canal verificado?», así que respondía que sí. Después del arreglo:

```
DESPUÉS    numero=990000001  canales=[telegram:0, whatsapp:0]  llaves_vivas=0
```

**Por qué estaba así, y es la lección del frente:** la invalidación existía, pero en **un llamador**
—el controller de verificación— y no en los otros **dos** que cambian un número
(`UserRepository.updateUser`, que es el perfil, y el bootstrap). El resultado dependía de por qué
pantalla entraras. Ahora vive en `TelefonoService.guardarPrincipal`, por donde pasan los tres.

Es el mismo razonamiento que ya estaba escrito **tres líneas más arriba** en
`UserRepository.updateUser` sobre el cantón de nacimiento: *«se valida aquí, en el único sitio por el
que pasan todas las escrituras, por el mismo motivo que la nacionalidad: parchear cada llamador es
exactamente como se olvida uno»*. Y es lo que `EmailService` ya hacía con la dirección.

Se marca `verificado = 0`, **no se borra** la fila del canal: declarar un canal nunca fue
verificarlo, así que la declaración sigue siendo verdad; lo que deja de serlo es la prueba.

## F4 · Cuadrar los otros tres caminos — qué resultó, y no era lo que esperaba

**Fui a buscar deriva y encontré tres ejes legítimos.** Probé las tres reglas candidatas y las tres
fallan a lo ancho:

| Regla candidata | Recurso RBAC | Subgrupo dibujado |
|---|---|---|
| un grupo cabe dentro de **un** módulo | falla en **7 de 14** | falla en **8 de 13** |
| un grupo no mezcla **niveles** | falla en **5 de 14** | falla |
| un módulo no está **partido** entre grupos | falla en **6 de 14** | falla |

Si tres reglas razonables fallan todas, la hipótesis era mala. Y lo era: **las tres agrupaciones
contestan preguntas distintas**, y las tres hacen falta.

| Agrupación | Pregunta |
|---|---|
| **módulo y nivel** | ¿qué depende de qué? |
| **recurso de permiso** | ¿quién puede actuar sobre esto? |
| **subgrupo del mapa** | ¿cómo se le cuenta esto a alguien que no lo conoce? |

Dos ejemplos de por qué forzarlas a coincidir sería un error:

- El recurso **`catalogos`** junta las listas cerradas de la persona (`generos`, `parentescos`…) con
  las del territorio (`cantones`, `instituciones`…), de **dos módulos**. Correcto: administrar
  catálogos es un solo trabajo, y partir el permiso en dos no serviría a nadie.
- El subgrupo **«Cómo se te localiza»** junta el correo y el teléfono (nivel 1), el canal por el que se
  escribe (nivel 0) y la llave con que se prueba el número (nivel 3). **Tres niveles, una sola frase** — y
  la frase es lo que hace legible el dibujo.

### Entonces, ¿qué se vigila?

**Que ninguna de las tres crezca sin que alguien lo decida.** Cada recurso y cada subgrupo declara en
`dominios.json` los módulos que abarca; los que abarcan varios llevan **el motivo escrito**. La puerta
falla si aparece un módulo no declarado — y si no puedes escribir el motivo, el reparto está mal.

Más dos huecos que se cerraron por el camino:

**La red del `/admin`.** Una tabla que `sqlTables.js` expone y que no tiene recurso en
`TABLE_RESOURCE_MAP` queda **denegada para todo el mundo**, porque el camino es *fail-closed* a
propósito, y eso se descubre cuando alguien no puede editar algo. Medido: **0 de 65**, así que hoy está
bien — y a partir de ahora no se puede romper en silencio.

**Las seis tablas dibujadas fuera de todo subgrupo.** Están así a conciencia —cada una se cuenta en el
otro mapa o en su propia página— y lo explicaba la prosa, pero nada lo sostenía. Ahora están declaradas
en `_sueltas`: una séptima pone CI en rojo.

### La puerta se provocó, no se dio por buena

Una puerta que nace verde no prueba nada hasta que se rompe a mano. Tres roturas, las tres cazadas:

| Rotura | Lo que dijo |
|---|---|
| `tasks` con el recurso `people` | *el recurso 'people' ha crecido al módulo 'ejecucion' y no estaba declarado* |
| `chat_messages` dentro de «Lo que decide el país» | *el subgrupo 'PAIS' ha crecido al módulo 'chat' y no estaba declarado* |
| `task_item_tenures` dibujada suelta | *está dibujada en modelo FUERA de todo subgrupo y no está en `_sueltas`* |

⚠️ **La tercera no saltó al primer intento, y la culpa era de la prueba**: inyecté el nodo buscando
`DWO["document_workflow_observations"]` y en el fichero se llama `OBS`, así que no inyecté nada. Queda
escrito porque una puerta «probada» con una rotura que nunca ocurrió es peor que una sin probar: da
confianza falsa.

## Control de ejecución

| Tarea | Qué entrega | Evidencia | Fecha |
|---|---|---|---|
| **F1.1** | `dominios.json` pasa a tabla → módulo → {dominio, capa} —así se llamaban los dos ejes entonces: hoy son `dominio` y `nivel`—: 93 tablas, 15 módulos | `node scripts/docs/check-mapa-modulos.mjs` → 93 tablas, 15 módulos, 0 fallos | 2026-10-04 |
| **F1.2** | `scripts/docs/lib/mapa.mjs` — un solo parser, con las `tablas` de un dominio **derivadas** de sus módulos | `postprocess-dbml.mjs` lo consume; `gen-dbml.sh` regenera los 8 diagramas | 2026-10-04 |
| **F1.3** | `process_runs` al dominio `tareas`; `term_types` evaluado y **no** movido, con el motivo escrito | `procesos` 9→8 y `tareas` 8→9 en `modelo-datos.md`; diff de `procesos.svg` y `tareas.svg` | 2026-10-04 |
| **F2.1** | La regla de los niveles, comprobada | 103 bajan · 79 igual · **0 suben** de 182 | 2026-10-04 |
| **F2.2** | En CI, en los **dos** sitios que hacen falta | `docs-dbml.yml` (esquema y mapa) y `backend-checks` de `cd-multienv.yml` (código) | 2026-10-04 |
| **F3.1** | La regla de propiedad, con los dos transversales declarados por nombre | la puerta lista las 5 tablas de deuda y pasa | 2026-10-04 |
| **F3.2** | `_deuda_escritura` con el motivo de cada una y la instrucción de cerrarla quitando líneas | 5 entradas, cada una con fichero y línea | 2026-10-04 |
| **F4.1** | Los 14 recursos RBAC declaran los módulos que abarcan, con motivo los 7 que abarcan varios; y toda tabla expuesta por `/admin` tiene recurso | comprobación **D**; 0 de 65 expuestas sin recurso; rotura provocada y cazada | 2026-10-04 |
| **F4.2** | Los 13 subgrupos dibujados declaran lo mismo, y las 6 tablas sueltas quedan declaradas | comprobación **E**; grupos + sueltas = 93 = las tablas del esquema; dos roturas provocadas y cazadas | 2026-10-04 |
| **F5.1** | La verificación por canal y las llaves pendientes se invalidan al cambiar el número, en los tres caminos | sonda antes/después sobre la pila B (arriba) + 4 tests nuevos en `TelefonoService.test.js`; 890 unitarios en verde | 2026-10-04 |

## Lo que de verdad hacía falta, y no era nada de esto

El 2026-10-04, al enseñar el avance, el dueño respondió que seguía sin entender el sistema y que el
día había sido una pérdida de tiempo. Tenía razón, y la medición lo confirma. Añadí una pregunta que
no me había hecho —**¿se puede leer el sistema en algún orden?**— y salió esto:

| Agrupación | Grupos | Relaciones dentro | ¿Se puede leer en orden? |
|---|---|---|---|
| Los 8 dominios de la documentación (ya existían) | 8 | **50 %** | **NO** — 4 parejas mutuas |
| Los 18 grupos de permisos | 18 | 44 % | **NO** — 2 parejas |
| **Los 15 módulos de este frente** | 15 | **37 %** | **NO** — 1 pareja |
| **Los 8 niveles** | 8 | 43 % | **SÍ** |

Tres conclusiones, y dos son contra mí:

1. **Los 15 módulos son la peor de las cuatro agrupaciones**, y encima tienen un bucle
   (`declaracion_plantillas` ↔ `declaracion_procesos`), así que no tienen ni la propiedad que
   justificaba inventarlos.
2. **Todas las agrupaciones por dominio tienen bucles.** Ésa es la razón medible de que el sistema no se
   pueda entender leyéndolo: no falta documentación, falta un **orden** posible.
3. **Lo único que da un orden son los niveles**, que es lo que este frente produjo casi de rebote y
   luego dejó de mencionar.

De ahí sale **[`orden-de-lectura.md`](../src/content/docs/orden-de-lectura.md)**: las 93 tablas en sus
8 niveles, en lenguaje llano, leíble de arriba abajo sin que nada se mencione antes de explicarse. Es
el entregable que este frente debió producir en la primera sesión.

⚠️ **Y una propuesta retirada:** llegué a proponer los **grupos de permisos** como fuente única,
apoyándome en que «algo real depende de ellos». El dueño lo tumbó con el dato que yo no tenía: **los
roles y permisos los generó un agente y nunca se auditaron.** Un permiso equivocado que nadie ha
pisado está igual de podrido que un diagrama equivocado. **La auditoría del RBAC queda abierta como
trabajo propio** —19 recursos, 95 permisos, 13 roles— y es más grave que todo lo de este frente.

## Lo que queda

**F5 · Las cinco tablas con dos escritores.** Cada una con su motivo en `dominios.json`. La de
`emails` es el caso gemelo del teléfono —el **mismo** `UPDATE` en dos ficheros— y debería ir primera.

**No se hace: varias bases de datos.** Se evaluó y el argumento es numérico: **103 de las 182** claves
ajenas cruzan de nivel. Partir en bases separadas convierte cada una de esas en código de aplicación
que mantiene a mano una integridad que hoy regala PostgreSQL. Si algún día hace falta aislamiento, el
camino son los **esquemas SQL** dentro de la misma base —mismas transacciones, mismas claves ajenas,
namespaces separados—, y eso se decide después de F4, no antes.
