# Frente 22 · El mapa de módulos: una sola respuesta a «¿dónde vive esto?»

**Abierto el 2026-10-04** por una pregunta del dueño: *«nuestro modelo ya tiene demasiadas tablas,
¿están creadas por módulos o no? ¿qué módulos tenemos? ya me está siendo insostenible entender».*

Y la respuesta medida fue incómoda: **no es que falte documentación, es que había cuatro y son
incompatibles.**

## Estado general — **8 de 15**

| Fase | Tareas | Estado |
|---|---|---|
| **F1** · Escribir el mapa | F1.1 ✅ · F1.2 ✅ · F1.3 ✅ | ✅ **3 de 3** |
| **F2** · La puerta de las capas | F2.1 ✅ · F2.2 ✅ | ✅ **2 de 2** |
| **F3** · La puerta de propiedad | F3.1 ✅ · F3.2 ✅ | ✅ **2 de 2** |
| **F4** · Cuadrar los otros tres caminos | F4.1 ⬜ · F4.2 ⬜ | ⬜ **0 de 2** |
| **F5** · Cerrar la deuda de escritura | F5.1 ✅ · F5.2 ⬜ · F5.3 ⬜ · F5.4 ⬜ · F5.5 ⬜ · F5.6 ⬜ | 🟡 **1 de 6** |

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

### Lo que se descartó: ordenar `backend/` por módulo

Se midió, porque es la alternativa obvia: carpetas verticales (`modules/identidad/…`) en vez de
`controllers/` + `services/`.

| | |
|---|---|
| ficheros de backend (sin tests) | 181 |
| nombran alguna tabla | 103 |
| **se moverían solos** (1 módulo) | **41** |
| **habría que partirlos** (2 o más) | **62** |

Y los peores son `config/rbacCatalog.js` y `config/sqlTables.js` (15 módulos cada uno),
`services/admin/crud/tableHooks.js` y `SystemBootstrapService.js` (12). **Ésos son transversales a
propósito**: partirlos por módulo los empeoraría. Así que la carpeta vertical cuesta 62 ficheros
partidos y pelea contra código que está bien. **Lo que se adopta es el invariante, no la carpeta.**

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
| **F5.1** | La verificación por canal y las llaves pendientes se invalidan al cambiar el número, en los tres caminos | sonda antes/después sobre la pila B (arriba) + 4 tests nuevos en `TelefonoService.test.js`; 890 unitarios en verde | 2026-10-04 |

## Lo que queda

**F4 · Cuadrar los otros tres caminos.** Que `TABLE_RESOURCE_MAP` y los dos `mapa-completo.md` se
comprueben **contra** el mapa en vez de inventar su propia agrupación. Es lo que convierte cuatro
caminos en uno; hoy el mapa manda pero los otros tres no lo saben.

**F5 · Las cinco tablas con dos escritores.** Cada una con su motivo en `dominios.json`. La de
`emails` es el caso gemelo del teléfono —el **mismo** `UPDATE` en dos ficheros— y debería ir primera.

**No se hace: varias bases de datos.** Se evaluó y el argumento es numérico: **103 de las 182** claves
ajenas cruzan de capa. Partir en bases separadas convierte cada una de esas en código de aplicación
que mantiene a mano una integridad que hoy regala PostgreSQL. Si algún día hace falta aislamiento, el
camino son los **esquemas SQL** dentro de la misma base —mismas transacciones, mismas claves ajenas,
namespaces separados—, y eso se decide después de F4, no antes.
