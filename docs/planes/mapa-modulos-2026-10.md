# Frente 22 · El mapa de módulos: una sola respuesta a «¿dónde vive esto?»

**Abierto el 2026-10-04** por una pregunta del dueño: *«nuestro modelo ya tiene demasiadas tablas,
¿están creadas por módulos o no? ¿qué módulos tenemos? ya me está siendo insostenible entender».*

Y la respuesta medida fue incómoda: **no es que falte documentación, es que había cuatro y son
incompatibles.**

## Estado general — **15 de 25**

| Fase | Tareas | Estado |
|---|---|---|
| **F1** · Escribir el mapa | F1.1 ✅ · F1.2 ✅ · F1.3 ✅ | ✅ **3 de 3** |
| **F2** · La puerta de los niveles | F2.1 ✅ · F2.2 ✅ | ✅ **2 de 2** |
| **F3** · La puerta de propiedad | F3.1 ✅ · F3.2 ✅ | ✅ **2 de 2** |
| **F4** · Cuadrar los otros tres caminos | F4.1 ✅ · F4.2 ✅ | ✅ **2 de 2** |
| **F5** · Cerrar la deuda de escritura | F5.1 ✅ · F5.2 ⬜ · F5.3 ⬜ · F5.4 ⬜ · F5.5 ⬜ · F5.6 ⬜ | 🟡 **1 de 6** |
| **F6** · El dominio, dentro de la base | F6.1 ✅ · F6.2 ✅ · F6.3 ✅ · F6.4 ✅ · F6.5 ⛔ | ✅ **4 de 4** |
| **F7** · Reordenar el backend por dominios | F7.0 🟡 · F7.1 ✅ · F7.2 🟡 · F7.3 ⬜ · F7.4 ⬜ · F7.5 ⬜ | 🟡 **1 de 6** |

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
`relation "template_artifacts" does not exist`. Ahora importa `ESQUEMAS` en vez de copiarlo — es el
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
Y el bloqueo que la tenía parada **se levantó solo**: al retirar `deliverables.owner_process_id` en el
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

## F5 · Cerrar la deuda de escritura — 1 de 6

| Tarea | Qué entrega | Estado |
|---|---|:--:|
| **F5.1** | `telefono_verification_keys` — y con ella la verificación por canal, que sobrevivía a un cambio de número | ✅ |
| **F5.2** | `emails` — el **mismo** `UPDATE emails SET verificado = 1` en `EmailService:148` y en `emailVerification.js:58` | ⬜ |
| **F5.3** | `persons` — `UPDATE persons SET password_hash` en `UserRepository` y en `reset_password.js:121` | ⬜ |
| **F5.4** | `task_items` — `services/tasks` lo inserta y `services/documents` lo toca | ⬜ |
| **F5.5** | `document_versions` — `user_controler.js:727` hace un `UPDATE` que es de `services/documents` | ⬜ |
| **F5.6** | `chat_notifications` — `services/chat` y `services/canales`. Puede que la respuesta sea un módulo de avisos | ⬜ |

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

## F7 · Reordenar el backend por dominios — 1 de 6

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
`plantillas`, con 7 — y sus escritores ajenos son, casi todos, **los mismos ficheros que F7.1, F7.2 y
F7.3 ya tocan**. Hechas esas tres, los ocho `datos/` se montan casi solos.

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
`signature_requests` y `signature_flow_instances` las escriben 2 ficheros cada una, `fill_requests`
cinco, y hasta que se muevan los cinco la tabla tiene dos dueños.

⚠️ **Segundo hallazgo, sin resolver: un flujo depende de otro flujo.** `rehacerDocumento.js` necesita
`resolveCurrentSignatureStep`, que vive en `DocumentSignatureWorkflowService.js` — otro de los siete.
Es una **lectura de firmas** que debería acabar en `firmas/datos/`; mientras no lo esté, un flujo
importa de otro. La regla *«un dominio sólo se importa por su `index.js`»* **no dice nada de
flujo→flujo**, y eso hay que decidirlo en F7.0.

### Las tareas

| Tarea | Qué entrega | Estado |
|---|---|:--:|
| **F7.0** | **El criterio de dominio y su nombre**: una frase falsable por dominio (*«si cambia X, cambia sólo esto»*), **una sola palabra** —`dominio` o `dominio`— aplicada en `dominios.json`, en la puerta y en la prosa, y las cinco decisiones de abajo resueltas. **Sin mover un fichero** | ⬜ |
| **F7.1** | **Declarar el común y los flujos, sin mover nada**: los transversales y los 7 flujos en el mapa, con su motivo, y la puerta leyendo la **ruta** | ✅ |
| **F7.2** | **Sacar el SQL de `controllers/` y `routes/`**: de **77 a 22** en tres pasos. Las 22 que quedan están todas en `user_controler.js`, que es también uno de los 6 de F7.3. Las **transacciones** van en su propio paso | 🟡 |
| **F7.3** | **Partir los 6 sin dominio dominante**, de menor a mayor: `tareas_controler.js` (109) → `generation/queries.js` (420) → `taskAssignment.js` (633) → `UserMenuService.js` (635) → `user_controler.queries.js` (956) → `user_controler.js` (1.695) | ⬜ |
| **F7.4** | **Los cuatro que ya no tienen escritores ajenos**, que son casi gratis: `chat` (0), `empleo` (0 — carpeta **reservada vacía**, decidido el 2026-10-07), `organizacion` (2) e `identidad` (2 — los cuatro escritores son el bootstrap, ya declarado) | ⬜ |
| **F7.5** | **Los cuatro entrelazados, TABLA POR TABLA** (no fichero por fichero: lo probó el piloto), en este orden: `procesos` (4 escritores ajenos) → `firmas` (5) → `plantillas` (7) → `tareas` (7). Sus escritores ajenos son casi los mismos ficheros que F7.1–F7.3 ya tocaron | ⬜ |

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

### F7.2 🟡 — de 77 consultas a 22, y dos puertas que estaban ciegas

| Paso | Qué salió | Quedan |
|---|---|---:|
| 1 | `user_controler.queries.js` (45 consultas) → `services/users/UserWorkspaceRepository.js`. **Lo pedía su propia cabecera**, palabra por palabra | 32 |
| 2 | Los 4 controllers pequeños (5 consultas). `tareas_controler.js` pasa de **109 a 41 líneas**; `program_controler.js` de 64 a 44 | 27 |
| 3 | `sql_admin_controller.js` (3 consultas) → `services/admin/templates/artifactLookup.js`. Dos eran **la misma consulta repetida**, y queda una | 22 |

Las 22 que faltan están **todas en `user_controler.js`**, que además es uno de los 6 de F7.3: su
extracción y su partición son el mismo trabajo.

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

### Las cinco decisiones que F7.0 tiene que resolver

1. **¿De qué dominio es el flujo de entrega?** `fill_requests` está en **plantillas** y
   `signature_requests` en **firmas**: las dos mitades del mismo mecanismo, en dominios distintos.
   Y el flujo vive hoy en cuatro sitios —ruta `routes/sign_router.js:81-85`, controller
   `controllers/sign/sign_workflow_controller.js:24`, servicio
   `services/documents/FillRequestWorkflowService.js`, tabla en el esquema `plantillas`—. **Esto
   parece un defecto del mapa de datos, no del código.**
2. **¿`plantillas` y `procesos` son un dominio o dos?** La decisión del frente 23 los convierte en
   **una sola unidad de cambio**, y el cierre común dice que van juntos. Si siguen separados,
   `templateLifecycle.js` (1.874 líneas) se parte y la invariante cruza una frontera.
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
