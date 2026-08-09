# Plan de datos — seis fases sobre la capa de persistencia

> **Estado del documento:** ⬜ ninguna fase empezada. Creado el **2026-08-09**.
>
> Este plan **se ejecuta**; el retrato del esquema que lo sustenta está en
> [`referencia-esquema.md`](./referencia-esquema.md) y **se consulta**.
>
> Antes de tocar nada: [`../referencia/metodo.md`](../referencia/metodo.md) y
> [`../referencia/patrones-diseno.md`](../referencia/patrones-diseno.md). Este plan **no contradice**
> a ninguno de los dos —los aplica a la capa de datos, que era el hueco que quedaba—.

---

## Por qué existe este plan

La pregunta que lo originó fue: *«¿conviene crear una clase por cada tabla?»*. La respuesta corta es
**no**, y está justificada en §0. Pero contestarla obligó a mirar la capa de datos entera por primera
vez, y ahí aparecieron **seis problemas reales** que ningún frente del plan maestro cubría: las
transacciones se abren a mano en once ficheros, el vocabulario de estados de `task_items` está
definido en cinco sitios con tres alfabetos distintos, y el esquema **no se puede alterar** en un
entorno con datos.

Las fases van **ordenadas por retorno sobre esfuerzo**, como el maestro. Estados: ⬜ sin empezar ·
🟡 a medias · ⛔ bloqueado.

| Fase | Qué | Esfuerzo | Retorno |
|---|---|---|---|
| **D1** | Unit of Work: un solo `withTransaction` | bajo | alto — elimina 20 ciclos manuales |
| **D2** | Vocabulario de estados único + detector de *drift* de metadatos | bajo | alto — cierra una incoherencia viva |
| **D3** | Migraciones versionadas | medio | alto — hoy el esquema no se puede alterar en prod |
| **D4** | Repositorios **por agregado**, y fuera el SQL de `controllers/` | medio | medio-alto |
| **D5** | Matar el traductor de dialecto MySQL→PG | medio-alto | alto — es el fichero más denso del repo |
| **D6** | Validación por esquema en el borde de entrada | medio | medio |

---

## §0 · La decisión de fondo: por qué NO una clase por tabla

Se evaluó y **se descarta**. Queda escrito aquí para que no vuelva a plantearse de cero, igual que la
pregunta arquitectónica en el plan maestro.

**El reparto de la base de datos, medido** (67 tablas, `backend/database/postgres_schema.sql`):

| Naturaleza | Tablas | % |
|---|---:|---:|
| Catálogo puro (`id + name + is_active`) | 12 | 18 % |
| Join / asociativa (solo FKs) | 10 | 15 % |
| **Entidad con comportamiento o estado** | **24** | **36 %** |
| Log append-only (ninguna tiene `updated_at`) | 9 | 13 % |
| Configuración / versionado | 9 | 13 % |
| Subtipo (`contract_origins` y sus dos hijas) | 3 | 4 % |

**Cinco razones, ninguna estética:**

1. **31 tablas de 67 (46 %) no tienen nada que encapsular.** Una clase para `unit_types`, `roles`,
   `actions`, `term_types`, `signature_statuses`… sería doce veces el mismo fichero. Eso no es
   diseño, es ceremonia con coste de mantenimiento.

2. **Ese CRUD ya está resuelto, y mejor.** `backend/config/sqlTables.js` describe **44 tablas** con
   metadatos y `SqlAdminService` las sirve por **cuatro rutas genéricas**
   (`routes/sql_admin_router.js:135-138`). El plan maestro marca su núcleo (~460 L) como *«el buen
   diseño que sostiene el registro de hooks»* y lo pone en la lista de **no tocar**. Sesenta y siete
   clases serían un segundo motor compitiendo con el primero por las mismas tablas.

3. **La unidad de trabajo real no es la tabla, es la transacción multi-tabla.** Lanzar un proceso
   toca `process_runs → tasks → task_items → task_assignments → documents → document_fill_flows`.
   Active Record modela filas; el problema aquí es la consistencia entre seis tablas bajo una
   transacción. Una clase por tabla da seis objetos que se coordinan mal — y el plan maestro ya midió
   que **de los puntos de `beginTransaction`, cero quedan dentro de un solo subdominio**.

4. **Parte del comportamiento vive en la base de datos.** Hay **5 triggers de negocio**
   (`postgres_schema.sql:1288, 1315, 1349, 1372, 1396`) que derivan roles al asignar un puesto,
   revocan al inactivar una persona y cancelan vacantes al inactivar una unidad. Clases con esa misma
   lógica crearían **dos fuentes de verdad para la misma invariante** — que es exactamente el fallo
   que la fase D2 va a cerrar en otro sitio.

5. **El molde uniforme no existe.** 5 tablas sin `id` sintético, 1 con PK compuesta
   (`chat_message_reads`), 3 en herencia *table-per-subtype*, **11 columnas generadas**, 6 columnas
   JSONB. La clase genérica se llenaría de excepciones por tabla: el olor exacto que hizo God a
   `AdminTableManager`, y contra el que avisa la regla 3 de `CLAUDE.md`.

**Lo que sí se sostiene** es un reparto en cuatro estratos, cada uno con su tratamiento:

| Estrato | Tablas | Patrón | Hoy |
|---|---:|---|---|
| Catálogos + joins | 31 | Table Data Gateway dirigido por metadatos | ✅ existe (`SqlAdminService`) |
| Entidades con estado | 24 | **Repository por agregado**, no por tabla | ⚠️ 2 repos, el resto suelto → **D4** |
| Máquinas de estado | 8 | Tabla de transiciones congelada | ✅ ejemplar en `DocumentStateService.js:30` |
| Transversal | — | **Unit of Work** | ❌ no existe → **D1** |

---

## Fase D1 · Un solo `withTransaction` — ⬜

**Qué pasa hoy.** Hay **32 `getConnection()`** y **20 `beginTransaction`** repartidos en **11
ficheros**, cada uno con su propio ciclo `begin / commit / rollback / release` escrito a mano:

```
config/postgres.js                              (el adaptador; no cuenta)
controllers/users/user_controler.js             ← 9 getConnection, 3 ciclos completos
services/admin/crud/tableHooks.js               ← el único que YA lo tiene resuelto
services/admin/templates/templateArtifact.js
services/admin/templates/templateLifecycle.js
services/admin/org/orgStructure.js
services/admin/generation/launch.js
services/documents/FillRequestWorkflowService.js
services/system/SystemBootstrapService.js
services/tasks/GeneralTaskService.js
services/sign/PdfSigningService.js
```

Cada copia es una fuga de conexión potencial: si un `throw` esquiva el `release()`, el pool
(`max = 10` por defecto, `config/postgres.js:35-44`) se agota y el backend deja de responder sin
error visible en el sitio que lo causó.

**Lo bueno: no hay que inventarlo.** `services/admin/crud/tableHooks.js:65-92` ya tiene
`runInTransaction(pool, ctx, {before, after}, execute)` con la forma correcta —`try / catch rollback /
finally release`—, pero **solo lo usa el CRUD admin**.

**Qué hacer.**

1. Promover el helper a `backend/services/kernel/` (o `config/postgres.js`) como
   `withTransaction(pool, fn)`, con la firma mínima: recibe una función, le pasa la `connection`,
   confirma si vuelve y deshace si lanza. Los hooks `before`/`after` de `tableHooks` se construyen
   **encima**, no dentro: son de su dominio.
2. Test unitario del helper primero, **antes de migrar nada**: confirma al volver, deshace al lanzar,
   libera **siempre** (incluido el caso de `rollback()` que a su vez falla, que hoy no está cubierto).
3. Migrar por lotes, empezando por los servicios cuyo ciclo ya es correcto — ahí es **refactor puro y
   los goldens no se mueven**. Los tres ciclos de `controllers/users/user_controler.js`
   (`:474-489`, `:593-618`, `:864-884`) van **al final**, porque además hay que sacar el SQL de ahí
   (fase D4) y conviene hacer un solo viaje.

**El aviso que ya costó una vez.** Mover la transacción **cambia dónde caen los errores**. Está
documentado en `../referencia/calidad-y-medicion.md` §5-D y el patrón a respetar es
`error.statusCode ?? 400/500`. Ojo especialmente con `GeneralTaskService.js:576-582`, que fija un
**500 explícito para el fallo al *adquirir* la conexión** y razona por qué en `:570-574`: eso no es
un descuido, es contrato, y el helper tiene que preservarlo.

**Criterio de cierre.** Cero `beginTransaction` fuera del helper (`grep` en `backend/`, excluyendo
`config/postgres.js` que es el adaptador). Los 256 goldens **idénticos**. Test unitario del helper
verde, incluido el caso de doble fallo.

---

## Fase D2 · Un vocabulario de estados, no cinco — ⬜

**El defecto, verificado el 2026-08-09.** El conjunto de estados terminales de `task_items` está
escrito en **cinco sitios con tres vocabularios que no coinciden**:

| Dónde | Vocabulario |
|---|---|
| `config/sqlTables.js:313` (y `:269`, `:334` para `tasks` y `task_assignments`) | `pendiente · en_proceso · completada · cancelada` |
| `controllers/users/user_controler.panel.js:380, 415, 416` | `completada · cancelada` |
| `services/admin/org/taskAssignment.js:216, 239, 265, 386` | `completed · completado · cancelled · cancelado · finalizado · entregado · rechazado` |
| `database/postgres_schema.sql:1307, 1334, 1341` (dentro de los triggers) | los mismos 7 literales |
| `SqlAdminService.js:214` (sobre `tasks`) | `completada · cancelada` |

**Los dos grupos no comparten ni un literal.** El primero es femenino singular; el segundo es
masculino más variantes en inglés. Consecuencia concreta y comprobable: el panel de usuario cuenta un
entregable `completada` como **cerrado**, mientras el motor de relevos —el trigger
`trg_position_assignments_after_update_fn` y `taskAssignment.js`— lo considera **abierto** y lo
reasigna al cambiar la ocupación de un puesto. Un entregable ya completado puede cambiar de dueño.

Y no es un caso aislado: la base **no tiene ni un `CREATE TYPE`**. Los 33 dominios cerrados son
`TEXT ... CHECK (col IN (...))`, con al menos un par duplicado literalmente
(`fill_flow_steps.resolver_type`:843 y `signature_flow_steps.resolver_type`:940) y una asimetría
—`fill_flow_steps.selection_mode`:851 tiene `CHECK`, su gemelo `signature_flow_steps`:947 **no**—.
Ocho columnas de estado no tienen `CHECK` en absoluto: su dominio solo existe en JavaScript.

**Qué hacer.**

1. **Decidir el vocabulario verdadero de `task_items` mirando los datos**, no el código: qué valores
   hay realmente en la base de dev y en cualquier entorno con datos. Es un **fix**, así que aquí el
   **diff del golden es la prueba** — a diferencia de D1.
2. Un módulo único de vocabulario (extender `services/documents/DocumentWorkflowCatalog.js`, que ya
   hace justo eso para firmas y llenado, en vez de crear un tercer sitio). `Object.freeze`, como los
   de `DocumentStateService.js:1-27`.
3. `sqlTables.js` consume del módulo en lugar de repetir literales. **Esto no viola §7**: §7 protege
   el fichero como *datos* y protege su duplicación con el gemelo del frontend; sustituir un literal
   por la constante que lo define no cambia el dato, elimina la tercera copia.
4. Los `CHECK` del esquema y las consultas de `taskAssignment.js` alinean con el módulo.
5. **Detector de *drift*** — un test unitario que compare `sqlTables.js` contra `information_schema`
   y contra los `CHECK` del esquema, y falle si divergen: columna que existe en la base y no en los
   metadatos, tipo que no cuadra, `options` que no coincide con el `CHECK`. Es barato y captura
   exactamente el fallo de arriba antes de que llegue a producción. **No** genera `sqlTables.js`: las
   etiquetas en español, las categorías y los `readOnly` no están en `information_schema` y son
   trabajo humano legítimo.

**Criterio de cierre.** Un solo sitio define cada dominio de estado. El test de *drift* en verde y
dentro de los globs de `test:unit` **y** `test:unit:coverage` (los dos, ver `CLAUDE.md`). Goldens
movidos **solo** donde el fix cambia comportamiento, con el diff citado.

---

## Fase D3 · Migraciones versionadas — ⬜

**Qué pasa hoy.** `backend/database/postgres_initializer.js:23-40` lee
`database/postgres_schema.sql` **entero** (1 398 líneas, 67 tablas) y lo ejecuta como **un único
string multi-statement** en cada arranque. Funciona porque todo es `CREATE ... IF NOT EXISTS`,
`CREATE OR REPLACE` y seeds con `ON CONFLICT`.

**El problema no es crear, es alterar.** Ese mecanismo es idempotente para *crear* y **estructuralmente
incapaz de *modificar***: añadir una columna, cambiar un tipo, renombrar o soltar un `CHECK` en un
entorno que ya tiene datos exige entrar a mano con `psql`. No hay dependencia de migración en
`package.json` (`pg` es la única de datos), ni número de versión de esquema, ni forma de saber qué
versión corre en qa o en prod. Y `qa` y `prod` **ya despliegan imágenes publicadas**
(`.github/workflows/cd-multienv.yml`).

Esto es, con diferencia, **el mayor riesgo operativo de la capa de datos**, y es el único punto de
este plan que puede provocar una pérdida de datos.

**Qué hacer.**

1. Adoptar `node-pg-migrate` (SQL plano, sin ORM detrás, encaja con el repo) o `umzug`.
2. El `postgres_schema.sql` actual pasa a ser la **migración base `0001`**, sin reescribirlo: se
   marca como aplicada en los entornos que ya existen (*baseline*), no se vuelve a ejecutar.
3. Toda alteración posterior es una migración numerada con su `down`. `postgres_initializer.js` pasa
   a aplicar las pendientes en vez de reejecutar el fichero entero.
4. `scripts/docker-env.sh` gana el comando de migrar, junto a los de reset y bootstrap.

**El aviso de `CLAUDE.md` aplica de lleno aquí:** *«el SQL no lo valida NADIE hasta que se ejecuta
esa rama»*. Cada migración se prueba con `PREPARE` en `psql` **antes** de darla por buena, y se
verifica que el `down` deja la base como estaba.

**Criterio de cierre.** Cambiar una columna en dev, desplegar a qa y ver el cambio aplicado **sin
tocar `psql` a mano**. Y `test:char:run` —que resetea y hace bootstrap— sigue pasando sobre el camino
de migraciones.

---

## Fase D4 · Repositorios **por agregado**, y fuera el SQL de `controllers/` — ⬜

**Qué pasa hoy.** Hay **531 llamadas** a `.query()`/`.execute()` en **46 ficheros**. La mayoría está
donde debe (37 en `services/`), pero **5 controllers escriben SQL**:

| Fichero | Sentencias SQL |
|---|---:|
| `controllers/users/user_controler.queries.js` | **33** |
| `controllers/users/user_controler.js` | 14 |
| `controllers/admin/sql_admin_controller.js` | 3 |
| `controllers/tareas/tareas_controler.js` | 2 |
| `controllers/empresa/program_controler.js` | 1 |

`user_controler.queries.js` son **1 091 líneas, 22 exports, 0 imports de servicios**: es una capa de
acceso a datos alojada en `controllers/`. **Su propia cabecera lo admite y nombra el destino**
(`:6-8`): *«candidato natural a promoverse a `services/users/UserWorkspaceRepository.js` cuando se
corrija la fuga de capa»*. Esto viola directamente la regla no negociable de `CLAUDE.md`
(«los controllers son transporte, no lógica»).

**La forma correcta: por agregado, no por tabla.** Diez repositorios, no sesenta y siete. Y la
frontera **no hay que inventarla**: ya está dibujada en el esquema por los `ON DELETE CASCADE`. La
propuesta completa, con sus tablas, está en
[`referencia-esquema.md` §4](./referencia-esquema.md#4-los-agregados-que-la-base-ya-dibuja).

**Qué hacer.**

1. Empezar por `user_controler.queries.js` → `services/users/UserWorkspaceRepository.js`. Es
   **movimiento puro**: el fichero no importa servicios, así que no hay ciclo que romper. Aplican las
   reglas de mover código de `CLAUDE.md` — extracción por script, `count == 1` antes de borrar, y
   **`npm run check:imports` obligatorio**, porque un símbolo movido sin su `import` carga bien y
   revienta en la llamada.
2. Los 14 SQL de `user_controler.js` van al mismo repositorio, junto con sus tres transacciones
   (coordinado con D1).
3. `sql_admin_controller.js` deja de importar `getPostgresPool` (`:7`): ya tiene `SqlAdminService`
   delante, esas tres consultas no tienen por qué esquivarlo.
4. `tareas_controler.js` y `program_controler.js` son una y dos sentencias: van con los servicios que
   ya existen para su dominio.
5. Los repositorios nuevos siguen la forma de los dos que ya hay
   (`services/auth/UserRepository.js:6`): clase, `constructor(pool = getPostgresPool())`, SQL
   encapsulado. Y **arreglan de paso** lo que aquellos hacen mal: `UserRepository.update()` (`:294`)
   monta `SET ${key} = ?` **con las claves sin lista blanca** — la allowlist solo existe en
   `updateMe` (`:321`).

**Lo que esta fase NO hace.** No toca el motor genérico de `SqlAdminService` (§7). No convierte
`chatStore.js` ni `dossierStore.js` en clases: ya son repositorios de facto, funcionan, y renombrarlos
son cero puntos de complejidad.

**Criterio de cierre.** Cero `.query(` en `backend/controllers/`. `check:imports` en verde. Goldens
idénticos —es refactor, no fix—.

---

## Fase D5 · Matar el traductor de dialecto — ⬜

**Qué pasa hoy.** `backend/config/postgres.js` no es una capa de acceso a datos: es un **shim que
emula la API de `mysql2/promise` sobre `pg`**, y su propia cabecera lo dice (`:1-20`). Existe para no
haber tenido que reescribir los call sites durante la migración.

Lo que cuesta, medido (`../referencia/calidad-y-medicion.md` §3.1 y §3.2):

- **391 ncloc con 241 de complejidad cognitiva → 0,62 por línea: el fichero más denso del
  repositorio**, por encima de `signer/app.py` en densidad.
- `bindParams` (**CC 59**) y `translateDialect` (**CC 49**) están entre las **cinco peores funciones
  vivas** del backend.
- Y **ya se pagó tres veces**: los defectos 1.5, 1.6 y 1.11 del plan maestro son los tres de esta
  capa. Dos cerrados, uno abierto a propósito.

**El plan se parte en dos, y solo la primera mitad está aprobada.**

### D5-a · Borrar los reescritores de dialecto, uno a uno — ⬜

Cada construcción MySQL viva tiene su reescritor: `rewriteGroupConcat` (`:170`), `rewriteIf` (`:208`),
`rewriteField` (`:239`), `rewriteDateParts` (`:272`), `applyOnConflict` (`:397`). El trabajo es
mecánico y **medible solo**:

1. Censar los call sites de cada construcción (`GROUP_CONCAT`, `IF()`, `FIELD()`, `DATE_FORMAT`,
   `CURDATE`, `NOW`, `ON DUPLICATE KEY`, `INSERT IGNORE`, `FROM DUAL`).
2. Reescribirlos a PostgreSQL nativo por lotes, **probando cada uno con `PREPARE` en `psql`** antes
   de tocar nada — el aviso de `CLAUDE.md` sobre los cuatro `UPDATE ... JOIN` que sobrevivieron meses
   vale aquí literalmente.
3. Cuando el contador de una construcción llega a **0**, se borra su reescritor. Cada borrado es
   complejidad que baja y no vuelve.

Los goldens **no se mueven**: es traducción, no cambio de comportamiento. Los 578 L de
`postgres.test.js` + `postgres.dialect.test.js` son la red, y van adelgazando con el fichero.

Foco especial en `services/system/genericCatalog.js`: sus 28 sentencias usan `FROM DUAL`,
`INSERT IGNORE`, `CURDATE()` y `NOW()` y **solo funcionan gracias al traductor** — es el bloque más
concentrado.

### D5-b · Placeholders `?` → `$n` — ⛔ **decisión pendiente, no empezar**

`bindParams` (CC 59) existe porque ~493 llamadas usan `?` estilo mysql2. Eliminarlo obliga a tocarlas
todas. Hay dos caminos y **ninguno se elige aquí**:

- **A mano / por script**: 493 sitios, radio de impacto enorme, y el defecto **1.11** del maestro
  avisa de que hay call sites que **reutilizan a propósito un array más largo que la consulta**. Ese
  censo es prerrequisito.
- **Con un query builder** (Knex o Kysely): resuelve `$n`, paginación y el `ON CONFLICT` de una vez, y
  Knex trae migraciones —solaparía con D3, que entonces habría que decidir antes—. Pero **sin
  TypeScript, Kysely pierde su ventaja principal**, que es el tipado; y añadir una dependencia que
  toca 531 call sites es exactamente el tipo de decisión que el plan maestro exige justificar con
  medición, no con doctrina.

**No se ataca D5-b hasta que D5-a esté cerrada** y se pueda medir cuánta complejidad queda de verdad
en el fichero. Puede que después no compense.

**Criterio de cierre de D5-a.** Los cinco reescritores borrados, `translateDialect` reducida a lo que
quede, y la caída de complejidad de `postgres.js` medida contra la línea base de Sonar. Goldens
idénticos.

---

## Fase D6 · Validación por esquema en el borde de entrada — ⬜

**Qué pasa hoy.** Cero dependencias de validación (`zod|joi|ajv|yup` → 0 resultados). La validación
vive en **tres capas artesanales e independientes**:

1. `validateFieldTypes(config, payload)` — `SqlAdminService.js:123-147`, imperativa por `field.type`.
2. `validateTableRules(tableName, candidate)` — `services/admin/crud/validation.js:305`, con
   `TABLE_RULES` para **24 tablas** (`:208-302`).
3. El `required` derivado de los metadatos — `SqlAdminService.js:646-651`.

Ninguna es mala en sí —`validateTableRules` es de hecho el caso de éxito citado en
`patrones-diseno.md` (CC 99 → 0)—, pero **están desconectadas**, cada endpoint nuevo elige mal la
mitad de las veces cuál usar, y **las rutas fuera del CRUD admin no tienen ninguna**.

**Qué hacer.** Un esquema declarativo por endpoint en el borde, que valide **antes** de llegar al
servicio. Las tres capas actuales siguen donde están: `TABLE_RULES` son reglas de negocio, no de
forma, y no se tocan.

**Lo que esta fase NO hace, y conviene que quede escrito.** **No normaliza la salida.** Hoy la API
expone `snake_case` y nombres físicos de columna, y hay tres mappers con tres convenciones distintas
(`UserRepository.toPublicUser`:205 mezcla `snake` y `camel` y arrastra un `_id` string heredado de
Mongo; `UserCertificateRepository.toPublic`:86 es `snake` puro; `BatchSigningService.rowToBatchJob`:83
es `camel` puro). Es feo, **y arreglarlo movería los 256 goldens y rompería el frontend a la vez**.
Es deuda **decidida, no olvidada**: si algún día se ataca, es con su propio plan y su propia red, no
de rebote.

**Criterio de cierre.** Los endpoints de escritura fuera del CRUD admin validan su entrada por
esquema. Los goldens de error se mueven —el código pasa a 400 con mensaje de forma— y **ese diff es
la prueba**; el contrato objetivo es el de
[`../referencia/contrato-errores-api.md`](../referencia/contrato-errores-api.md).

---

## Lo que este plan NO va a hacer

Igual que §7 del maestro, esto vale tanto como las fases:

- **Una clase por tabla.** Descartado en §0 con cinco razones medidas.
- **Un ORM** (Sequelize, TypeORM, Prisma, Objection). Ninguno de los seis problemas de arriba es «nos
  falta un ORM»; cuatro son *falta de un único sitio* y dos son deuda de migración. Un ORM añade una
  capa que hay que aprender, no quita ninguna.
- **Tocar el núcleo CRUD de `SqlAdminService`** (~460 L). Está en la lista de no tocar del maestro y
  este plan lo respeta: D2 y D4 trabajan **alrededor**, nunca dentro.
- **State para `fill_requests`.** `patrones-diseno.md` §4 ya lo descartó con cifras: su tabla
  `ALLOWED_STATUSES_BY_ACTION` (`FillRequestWorkflowService.js:140-146`) **es** la cura, y cinco
  clases de estado no bajarían ni un punto.
- **Normalizar `snake_case` → `camelCase` en la salida.** Ver D6.
- **Partir la base de datos.** El plan maestro lo cerró: el 45 % de las FKs cruza cualquier frontera
  que se dibuje, y `persons` sola recibe **26 FKs entrantes**.

---

## Riesgo y red

La red de este plan es la que ya existe: **256 goldens en 15 flujos** de caracterización y **350
casos unitarios**. Con una advertencia que sale de `../referencia/cobertura.md`: la cobertura global
es del **14 %**, y **`SqlAdminService.js`, `tableHooks.js` y `templateLifecycle.js` no tienen test
unitario propio** —su única red son los goldens—. Es decir: en D4 y D5, si un golden no se mueve, no
significa que esté bien; significa que ese camino está caracterizado. Los que no lo están hay que
ejercitarlos a mano.

Y la regla que engloba todo, de `CLAUDE.md`: **refactor = mover código, NO reescribir comportamiento**.
D1, D4 y D5-a son refactor y sus goldens no se mueven. D2 y D6 son fixes y **el diff del golden es la
prueba**. D3 no es ninguna de las dos: es infraestructura, y su prueba es un despliegue.
