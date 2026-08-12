---
title: "El adaptador de acceso a datos"
description: "Por qué el backend traduce SQL de MySQL a PostgreSQL al vuelo, y qué se paga por ello."
sidebar:
  order: 4
---
Aquí hay algo que confunde si no se explica. El fichero `backend/config/postgres.js` (512 líneas) **no es un cliente de PostgreSQL normal**. Es un **adaptador que finge ser `mysql2/promise`**.

¿Por que? El proyecto **migro de MariaDB a PostgreSQL**. Había unos 881 sitios en el código escribiendo SQL en estilo MySQL. Reescribirlos todos era inviable, así que se escribio una capa que traduce al vuelo. Hace tres cosas.

## `bindParams`: traduce los marcadores de posición

MySQL usa `?`; PostgreSQL usa `$1`, `$2`:

``` javascript
// Lo que escribe el programador:
pool.query("SELECT * FROM persons WHERE cedula = ? AND status = ?", [ced, "Activo"])

// Lo que llega a PostgreSQL:
"SELECT * FROM persons WHERE cedula = $1 AND status = $2"
```

Y es cuidadoso: no toca los `?` que están dentro de comentarios (`--`, `/* */`) o de literales de texto, porque mantiene una tabla de “tramos protegidos”. Además expande parámetros de tipo array igual que hacía mysql2: un escalar da `$n`; un array vacio da `NULL`; `[1,2,3]` da `$1, $2, $3`; y `[[1,2],[3,4]]` da `($1,$2), ($3,$4)`.

Un cambio reciente e importante: **falla ruidosamente si faltan parámetros**. Antes mandaba `NULL` en silencio, que es peor porque el fallo aparece lejos de su causa. El mensaje de error, a propósito, *no* incluye el SQL: varios controllers responden `error.message` directamente al cliente.

## `translateDialect`: traduce funciones

`IFNULL` → `COALESCE`; `GROUP_CONCAT` → `string_agg`; `CURDATE()` y `CURTIME()` → sus equivalentes; `FROM DUAL` desaparece; `<=>` → `IS NOT DISTINCT FROM`; `INSERT IGNORE` → `ON CONFLICT DO NOTHING`; `IF()` → `CASE WHEN`; `FIELD()` → un `CASE` posicional; `YEAR()`, `MONTH()` → `EXTRACT`.

El caso mas delicado es `ON DUPLICATE KEY UPDATE` → `ON CONFLICT (...) DO UPDATE SET`, porque PostgreSQL exige que le digas *sobre que columnas* es el conflicto. El adaptador lo **infiere consultando el catalogo** de PostgreSQL (`pg_index`) y cachea el resultado en memoria.

## Transacciones al estilo mysql2

``` javascript
const conn = await pool.getConnection();
await conn.beginTransaction();     // ejecuta BEGIN
try {
  await conn.query("INSERT ...");
  await conn.query("UPDATE ...");
  await conn.commit();
} catch (e) {
  await conn.rollback();
} finally {
  conn.release();                  // devuelve la conexion al pool
}
```

Hay 11 ficheros de producción que usan transacciones, entre ellos `services/admin/generation/launch.js`, `services/admin/templates/templateLifecycle.js`, `services/documents/FillRequestWorkflowService.js`, `services/sign/PdfSigningService.js` y `services/system/SystemBootstrapService.js`.

:::tip[Que es un “pool” de conexiones]

Abrir una conexion a la base de datos es caro (decenas de milisegundos: handshake de red, autenticación, negociación). Un *pool* mantiene N conexiones ya abiertas y te presta una cuando la necesitas. Aquí `max = 10`. Por eso es **crítico** llamar siempre a `release()`: si te olvidas, se agotan las diez y la aplicación entera se cuelga esperando una conexion que nunca vuelve.

:::

:::caution[El SQL no lo válida nadie hasta que se ejecuta esa rama]

Textual del `CLAUDE.md`. El SQL es una cadena de texto: `node --check` no la mira, el detector de imports tampoco, y el backend arranca igual. Así sobrevivieron meses *cuatro* sentencias `UPDATE ... INNER JOIN ... SET` (sintaxis multi-tabla de MySQL que PostgreSQL **rechaza**) que dejaron el endpoint `POST /sign/fill-requests/:id/return` **roto para todo el mundo**.

PostgreSQL quiere `UPDATE tabla alias SET col = ... FROM otra WHERE union AND filtros`, con las columnas del `SET` **sin cualificar**. Y `grep "UPDATE.*JOIN"` *no encuentra nada*, porque el SQL ocupa varias líneas.

:::

## Donde vive el SQL

`getPostgresPool` se importa en **28 ficheros**: 17 en `services/`, 5 en `controllers/`, y el resto en `config/`, `database/` y `utils/`. Es decir, **no hay una capa de repositorios única** — es una deuda conocida. Solo `services/auth/` tiene repositorios nominales (`UserRepository.js`, `UserCertificateRepository.js`).
