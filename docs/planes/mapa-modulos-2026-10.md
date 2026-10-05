# Frente 22 · El mapa de módulos: una sola respuesta a «¿dónde vive esto?»

**Abierto el 2026-10-04** por una pregunta del dueño: *«nuestro modelo ya tiene demasiadas tablas,
¿están creadas por módulos o no? ¿qué módulos tenemos? ya me está siendo insostenible entender».*

Y la respuesta medida fue incómoda: **no es que falte documentación, es que había cuatro y son
incompatibles.**

## Estado general — **14 de 23**

| Fase | Tareas | Estado |
|---|---|---|
| **F1** · Escribir el mapa | F1.1 ✅ · F1.2 ✅ · F1.3 ✅ | ✅ **3 de 3** |
| **F2** · La puerta de las capas | F2.1 ✅ · F2.2 ✅ | ✅ **2 de 2** |
| **F3** · La puerta de propiedad | F3.1 ✅ · F3.2 ✅ | ✅ **2 de 2** |
| **F4** · Cuadrar los otros tres caminos | F4.1 ✅ · F4.2 ✅ | ✅ **2 de 2** |
| **F5** · Cerrar la deuda de escritura | F5.1 ✅ · F5.2 ⬜ · F5.3 ⬜ · F5.4 ⬜ · F5.5 ⬜ · F5.6 ⬜ | 🟡 **1 de 6** |
| **F6** · El tema, dentro de la base | F6.1 ✅ · F6.2 ✅ · F6.3 ✅ · F6.4 ✅ · F6.5 ⛔ | ✅ **4 de 4** |
| **F7** · Reordenar el backend por temas | F7.1 ⬜ · F7.2 ⬜ · F7.3 ⬜ · F7.4 ⬜ | ⬜ **0 de 4** |

## F6 · El tema, dentro de la base — 4 de 5

| Tarea | Qué entrega | Estado |
|---|---|:--:|
| **F6.1** | Las 93 tablas en **8 esquemas de PostgreSQL**, uno por tema | ✅ |
| **F6.2** | El `search_path` en los **tres** pools que se conectan, con prueba que los compara | ✅ |
| **F6.3** | Los cuatro programas que parsean el esquema, al día | ✅ |
| **F6.4** | `scripts/migrar-a-esquemas.sql` para una base anterior | ✅ |
| **F6.5** | ⛔ **DESCARTADA** · partir el fichero del esquema en 15 | ⛔ |

### Por qué los esquemas, y no es cosmética

El tema era **una afirmación en un fichero JSON**: decía que `signature_requests` es de firmas y
había que creérselo. Ahora **lo dice la base de datos**, y si alguien crea una tabla en el esquema
equivocado falla una puerta de CI. Es la diferencia entre documentar y constatar.

**Y las 555 consultas no se tocaron.** El `search_path` resuelve los nombres sin cualificar igual que
antes. Lo que se gana: una consulta *puede* decir de qué tema es, y `pg_dump -n firmas` saca un tema
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

Se llegó a elegir la forma (carpeta = tema, nombre = nivel, 16 ficheros) y hasta el estilo de nombre.
Y el bloqueo que la tenía parada **se levantó solo**: al retirar `deliverables.owner_process_id` en el
frente 23 desapareció la dependencia circular entre `plantillas` y `procesos`, y el reparto pasó a
ser posible sin mover ninguna tabla de tema. **Medido: 15 ficheros y el orden existe.**

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
barajaron lo resolvía: el problema no es el adorno del número, es que **dos temas comparten nivel y
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

**93 tablas · 15 módulos · 8 dominios · 8 capas.** `dominios.json` dejó de repartir diagramas y pasó
a contestar «¿a qué parte del sistema pertenece esta tabla?». Cada tabla está en **un** módulo, y
cada módulo declara **dominio** (el diagrama, que sigue siendo uno de 8) y **capa** (su sitio en el
orden de dependencia).

| Capa | Módulos | Tablas |
|---|---|:--:|
| **0** · catálogos y territorio | `cat_territorio` · `cat_identidad` · `cat_firmas` · `cat_procesos` | 22 |
| **1** · identidad | `identidad` | 13 |
| **2** · organización | `organizacion` | 4 |
| **3** · acceso | `acceso` | 11 |
| **4** · declaración | `declaracion_procesos` · `declaracion_plantillas` | 11 |
| **5** · ejecución | `ejecucion` | 7 |
| **6** · flujos | `flujo_entrega` · `flujo_firma` · `flujo_rastro` | 11 |
| **7** · encima | `chat` · `empleo` | 14 |

### Lo que el cruce dominio ⨯ capa enseñó, y ningún diagrama decía

**1 · El dominio `identidad` no es un tema: son tres módulos apilados.** Sus 34 tablas se reparten
entre la capa 0 (10 catálogos), la 1 (la persona, 13) y la 3 (el acceso, 11). Era el diagrama más
difícil de leer del sitio, y ésta es la razón medible.

**2 · El acceso va ENCIMA de la organización.** El primer reparto lo puso debajo y la puerta de capas
lo rechazó con dos claves ajenas: `role_assignments.unit_id → units` y
`role_assignments.derived_from_assignment_id → position_assignments`. Un rol se asigna **dentro de**
una unidad. Consecuencia práctica: **quien cambia el organigrama puede romper permisos; al revés no
pasa nunca.**

**3 · Tres tablas tienen nombre de catálogo y no lo son.** También las cazó la puerta:

| Tabla | Parece | Es |
|---|---|---|
| `role_assignment_relation_types` | catálogo de tipos | tabla de relación de `role_assignments` (capa 3) |
| `process_definition_period_types` | catálogo de periodos | detalle de `process_definition_versions` (capa 4) |
| `contract_origins` | catálogo de orígenes | detalle de `contracts` (capa 7) |

**4 · `process_runs` estaba en el dominio equivocado** (F1.3). Vivía en `procesos`, que es la
**declaración**; un lanzamiento es **ejecución**, y `tasks.process_run_id` apunta a él. Movido al
dominio `tareas`: `procesos` 9 → 8 tablas, `tareas` 8 → 9.

⚠️ **`term_types` se evaluó y NO se movió.** Era el otro módulo de una sola tabla, y moverlo
*empeoraría* el diseño: es el catálogo de `terms`, y llevárselo a otro dominio separaría el catálogo
de la tabla a la que sirve, en dos diagramas distintos. Que un módulo tenga una tabla no es un
defecto; es la descripción honesta.

**5 · La capa 7 está medio vacía.** De las 93 tablas, **15 no aparecen en una sola línea de código**,
y 8 son el bloque de empleo entero. Más **8 que sólo se leen** y nadie escribe. No es código muerto:
es modelo declarado sin implementar, y ahora está dicho en el mapa.

## F2 · La puerta de las capas

**Una clave ajena solo puede apuntar a su capa o a una inferior.** De las **182** del esquema:

| | | |
|---|---:|---|
| apuntan a una capa **inferior** | 103 | 57 % ✔ |
| apuntan a su **misma** capa | 79 | 43 % ✔ |
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

## F7 · Reordenar el backend por temas — 0 de 4

Es **donde está el mandato de la ingeniería**, y no es una opinión: son cuatro principios con nombre
contra ninguno.

| | Qué dice | Aplicado aquí |
|---|---|---|
| **Parnas, 1972** · *On the Criteria To Be Used in Decomposing Systems into Modules* | un sistema se descompone por **ocultación de información**: cada módulo esconde una decisión que puede cambiar. Argumenta **explícitamente contra** descomponer por *pasos del procesamiento* | `routes/` + `controllers/` + `services/` **es** descomponer por pasos del procesamiento |
| **Principio de cierre común** · Robert C. Martin | *las clases que cambian juntas van en el mismo paquete* | cambiar las firmas toca **33 ficheros en 12 carpetas**, y la carpeta `sign` tiene **2 de los 33** |
| **Cohesión y acoplamiento** · Stevens, Myers y Constantine, 1974 | una carpeta debe guardar cosas que van juntas, y depender poco de las demás | cohesión **baja** (una carpeta guarda trozos de muchos temas) y acoplamiento **alto** (un tema vive en muchas carpetas). El peor cuadrante |
| **La prueba de que es alcanzable** | — | `chat`: **12 ficheros en 6 carpetas**, porque se construyó de una pieza. No es un límite del proyecto |

### Lo medido (2026-10-04)

| Tema | Ficheros | Carpetas distintas |
|---|---|---|
| personas | 64 | **20** |
| unidades | 41 | **18** |
| procesos | 32 | **17** |
| plantillas | 35 | **16** |
| tareas | 32 | **15** |
| firmas | 31 | **13** |
| chat | 12 | 6 |
| expediente | 7 | 5 |

El backend tiene ~19 carpetas de servicios: para cualquier tema grande, el código está **en casi
todas**. No es que no se sepa a dónde ir — **es que no hay un dónde**.

Y de los 103 ficheros que nombran alguna tabla: **48 tocan un solo tema** y se mueven solos; **7 son
genéricos a propósito** (el registro de todas las tablas, el editor de `/admin`, el instalador) y
**no se parten**; los demás hay que partirlos, y entre ellos están los que ya están fichados como los
peores del repositorio (`user_controler.js` toca 6 temas, `orgStructure.js` toca 7).

| Tarea | Qué entrega | Estado |
|---|---|:--:|
| **F7.1** | **Un tema de punta a punta: `firmas`.** Sus 31 ficheros a un sitio, con el común declarado | ⬜ |
| **F7.2** | La comprobación **C** de la puerta pasa de *«que haya un solo escritor»* a *«que el escritor sea el tema dueño»* — verificable por **ruta**, no por convención | ⬜ |
| **F7.3** | Los temas pequeños, que ya están casi: `expediente` (7 ficheros, 5 carpetas) y `chat` (12 en 6) | ⬜ |
| **F7.4** | Los grandes, uno a uno, en el orden que el dueño decida. `personas` el último: es el peor (64 ficheros en 20 carpetas) | ⬜ |

⚠️ **Un reparto vertical sin COMÚN declarado miente.** Esos 7 ficheros genéricos no caben en ningún
tema, y es correcto que no quepan: su contrato *es* ser genéricos. Partirlos por tema los empeoraría.

⚠️ **Y el frontend no entra en esta fase.** Está repartido por **audiencia** —`admin`, `home`,
`perfil`, `auth`— y ese eje es legítimo: son tres aplicaciones para tres personas distintas. Lo que
está mal allí es otra cosa: `modules/procesos` tiene **1 fichero** mientras el asistente de procesos
vive en `modules/admin/`. El arreglo es que el tema sea el **segundo** nivel dentro de cada
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
| un grupo no mezcla **capas** | falla en **5 de 14** | falla |
| un módulo no está **partido** entre grupos | falla en **6 de 14** | falla |

Si tres reglas razonables fallan todas, la hipótesis era mala. Y lo era: **las tres agrupaciones
contestan preguntas distintas**, y las tres hacen falta.

| Agrupación | Pregunta |
|---|---|
| **módulo y capa** | ¿qué depende de qué? |
| **recurso de permiso** | ¿quién puede actuar sobre esto? |
| **subgrupo del mapa** | ¿cómo se le cuenta esto a alguien que no lo conoce? |

Dos ejemplos de por qué forzarlas a coincidir sería un error:

- El recurso **`catalogos`** junta las listas cerradas de la persona (`generos`, `parentescos`…) con
  las del territorio (`cantones`, `instituciones`…), de **dos módulos**. Correcto: administrar
  catálogos es un solo trabajo, y partir el permiso en dos no serviría a nadie.
- El subgrupo **«Cómo se te localiza»** junta el correo y el teléfono (capa 1), el canal por el que se
  escribe (capa 0) y la llave con que se prueba el número (capa 3). **Tres capas, una sola frase** — y
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
| **F1.1** | `dominios.json` pasa a tabla → módulo → {dominio, capa}: 93 tablas, 15 módulos | `node scripts/docs/check-mapa-modulos.mjs` → 93 tablas, 15 módulos, 0 fallos | 2026-10-04 |
| **F1.2** | `scripts/docs/lib/mapa.mjs` — un solo parser, con las `tablas` de un dominio **derivadas** de sus módulos | `postprocess-dbml.mjs` lo consume; `gen-dbml.sh` regenera los 8 diagramas | 2026-10-04 |
| **F1.3** | `process_runs` al dominio `tareas`; `term_types` evaluado y **no** movido, con el motivo escrito | `procesos` 9→8 y `tareas` 8→9 en `modelo-datos.md`; diff de `procesos.svg` y `tareas.svg` | 2026-10-04 |
| **F2.1** | La regla de las capas, comprobada | 103 bajan · 79 igual · **0 suben** de 182 | 2026-10-04 |
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
| **Las 8 capas** | 8 | 43 % | **SÍ** |

Tres conclusiones, y dos son contra mí:

1. **Los 15 módulos son la peor de las cuatro agrupaciones**, y encima tienen un bucle
   (`declaracion_plantillas` ↔ `declaracion_procesos`), así que no tienen ni la propiedad que
   justificaba inventarlos.
2. **Todas las agrupaciones por tema tienen bucles.** Ésa es la razón medible de que el sistema no se
   pueda entender leyéndolo: no falta documentación, falta un **orden** posible.
3. **Lo único que da un orden son las capas**, que es lo que este frente produjo casi de rebote y
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
ajenas cruzan de capa. Partir en bases separadas convierte cada una de esas en código de aplicación
que mantiene a mano una integridad que hoy regala PostgreSQL. Si algún día hace falta aislamiento, el
camino son los **esquemas SQL** dentro de la misma base —mismas transacciones, mismas claves ajenas,
namespaces separados—, y eso se decide después de F4, no antes.
