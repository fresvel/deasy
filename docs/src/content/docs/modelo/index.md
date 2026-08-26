---
title: "El modelo, de punta a punta"
description: "Cómo Deasy pasa de «esta universidad tiene un proceso» a «este documento existe, lo hizo esta persona y lo firmaron estas otras». Treinta y ocho tablas, contadas en orden y sin tecnicismos."
sidebar:
  label: "Cómo leer esto"
  order: 0
---

Cómo Deasy pasa de «esta universidad tiene un proceso» a «este documento existe, lo hizo esta
persona y lo firmaron estas otras». **Treinta y ocho tablas**, contadas en orden y sin
tecnicismos, con el detalle completo de cada una.

## Cómo leer esto

El modelo tiene **dos mitades**, y confundirlas es lo que hace que parezca más complicado de lo
que es.

**La primera mitad es lo que se declara**: la universidad dice qué procesos existen, quién debe
participar, qué documentos hay que producir y con qué plantilla. Es una descripción, no ha pasado
nada todavía.

**La segunda es lo que ocurre**: llega un periodo, el proceso se dispara, aparecen tareas con
nombre y apellido, alguien rellena un documento, otros lo firman.

La frontera entre las dos es exacta y conviene tenerla presente: **declarar no crea trabajo**. El
trabajo aparece en un momento concreto —el disparo— y a partir de ahí todo lo que ocurre queda
anclado a la versión de la declaración que estaba vigente entonces. Por eso las declaraciones se
versionan y no se editan: si se pudieran cambiar, un documento a medio firmar cambiaría de reglas
mientras lo firman.

<div class="cadena">

<p class="cadena-mitad cadena-declara"><span class="cadena-eti">Lo que se declara</span>
<code>proceso</code> → <code>configuración</code> → <code>regla de reparto</code> → <code>plantilla vinculada</code></p>

<p class="cadena-frontera">↓ &nbsp;el disparo</p>

<p class="cadena-mitad cadena-ocurre"><span class="cadena-eti">Lo que ocurre</span>
<code>corrida</code> → <code>tarea</code> → <code>entregable</code> → <code>ronda</code> → <code>entrega</code> → <code>firma</code> → <code>archivo final</code></p>

</div>

Si esos pasos te resultan claros, el resto de la sección es el detalle de cada uno.

## Una palabra sobre los nombres

Los nombres en `letra de máquina` son los de las **tablas y columnas reales**. No se traducen
porque son los que verás si abres la base, y la idea es que puedas contrastar cada afirmación de
estas páginas con lo que hay dentro. Al lado de cada uno va siempre qué significa en castellano
llano.

## De dónde sale cada cosa

Para que puedas juzgar cuánto fiarte de cada afirmación, aquí está de dónde sale cada cosa.

Los **campos, los tipos y las relaciones** están leídos del catálogo de PostgreSQL en ejecución, no
del código ni de la documentación. Si un campo aparece en un diagrama, existe con ese nombre y ese
tipo. Las cifras, con su alcance dicho, porque mezclarlos es fácil:

| | |
|---|---|
| Tablas de la cadena, las que dibuja el [mapa completo](/modelo/mapa-completo/) | **38** |
| Columnas de esas 38 | **375** |
| Claves foráneas entre esas 38 | **97** |
| Tablas del esquema entero (con chat, empleo y dossier) | **67** |
| Claves foráneas del esquema entero | **147** |
| Restricciones `CHECK` del esquema entero | **33** |

Los **comportamientos** —qué pasa al publicar, qué mira el lanzamiento, hasta dónde llega el
relevo— se comprobaron ejecutándolos, no leyéndolos.

Las **listas de estados protegidas** salen de esas 33 restricciones `CHECK`. Las no protegidas salen
de leer el código que las define, y por eso están marcadas como tales en
[Vocabularios de estado](/modelo/vocabularios-de-estado/).

Lo que **es interpretación** son las metáforas: el libro y sus ediciones, la silla y quien se
sienta en ella. No están en el código; son la forma de contarlo sin tecnicismos. Si alguna no
encaja con cómo lo piensas tú, la metáfora es lo que sobra, no el modelo.

:::note[Cómo verificar lo que lees aquí]
El esquema vigente está en `backend/database/postgres_schema.sql`, y el modelo generado desde él
—con sus ocho diagramas por dominio— en [Modelo de datos](/referencia/modelo-datos/).

Ese modelo **no se escribe: se genera**, y una puerta de CI falla si el esquema y los diagramas se
separan. Estas páginas, en cambio, **sí están escritas a mano**: si encuentras una discrepancia,
gana el esquema.
:::

## El recorrido

| # | Página | Qué responde |
|---|---|---|
| 1 | [La siembra](/modelo/siembra/) | De qué parte un sistema vacío |
| 2 | [La organización](/modelo/organizacion/) | Quién existe y dónde está sentado |
| 3 | [El proceso](/modelo/proceso/) | Qué se hace, y en qué versión de sus reglas |
| 4 | [El reparto](/modelo/reparto/) | A quién le toca cuando esto se dispare |
| 5 | [Entregable y ediciones](/modelo/entregable-y-ediciones/) | El libro y sus impresiones |
| 6 | [El vínculo y los modos](/modelo/vinculo/) | Qué edición usa cada configuración, y en qué modo |
| 7 | [El disparo](/modelo/disparo/) | Cuándo la declaración se convierte en trabajo |
| 8 | [El entregable concreto](/modelo/entregable-concreto/) | La unidad de trabajo real |
| 9 | [Quién lo debe](/modelo/tenencias-y-relevo/) | Las tenencias y el relevo |
| 10 | [Rondas y correcciones](/modelo/documento/) | Qué se produjo, y quién subió cada archivo |
| 11 | [El flujo de entrega](/modelo/flujo-de-entrega/) | Quién lo rellena y quién lo revisa |
| 12 | [El flujo de firma](/modelo/flujo-de-firma/) | Quién firma, en qué orden y en qué sitio del papel |
| 13 | [El documento final](/modelo/cierre/) | El archivo sellado y lo que se dijo por el camino |
| · | [Vocabularios de estado](/modelo/vocabularios-de-estado/) | Qué estados existen y cuáles protege la base |
| · | [Mapa completo](/modelo/mapa-completo/) | Todo junto, de un vistazo |
| · | [Lo que no cierra](/modelo/lo-que-no-cierra/) | Las deudas conocidas del modelo |
