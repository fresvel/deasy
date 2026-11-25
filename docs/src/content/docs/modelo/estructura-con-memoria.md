---
title: "La estructura con memoria"
description: "Cómo recuerda Deasy su organigrama y su árbol de procesos: los cuatro estados de un nodo, la relación con fechas, el acto que ordena cada cambio y las dos lecturas de un documento antiguo."
sidebar:
  label: "La estructura con memoria"
  order: 13.5
---

Una universidad se reorganiza. Una escuela se divide en dos, una coordinación pasa a depender de
otra dirección, un proceso deja de existir. Y los documentos que esas unidades produjeron siguen
ahí, firmados por alguien que ya no ocupa ese puesto, en nombre de una unidad que ya no está.

Hasta noviembre de 2026 el modelo no sabía contar eso. Una unidad tenía una casilla «activa», y su
padre era una columna que se sobrescribía: al mover una unidad, el sistema olvidaba dónde había
estado. Esta página cuenta cómo dejó de olvidar. Vale igual para las **unidades**, los **puestos**
y los **procesos**, que guardan lo mismo con otros nombres.

Es una vista de conjunto. El detalle de cada pieza está en
[La organización](/modelo/organizacion/) y en [El proceso](/modelo/proceso/).

## Un nodo tiene vidas, no una casilla

Lo que antes era «activo: sí o no» son ahora **periodos**: una fila por cada vez que el nodo rige,
con el día en que empieza y, si termina, el primer día en que ya no rige. Viven en `unit_vigencias`,
`position_vigencias` y `process_vigencias`.

De esas dos fechas se lee el estado. Son cuatro:

| Estado | Qué significa | Cómo se reconoce |
|---|---|---|
| **Borrador** | Existe, pero nunca ha regido | No tiene ningún periodo |
| **Programado** | Tiene fecha, y todavía no ha llegado | Su inicio es futuro |
| **Vigente** | Rige hoy | Empezó, y no ha terminado |
| **Suprimido** | Rigió y dejó de regir | Su fin ya llegó |

Cuatro cosas que se siguen de ahí:

- **No hay pausas.** Apagar un nodo es siempre suprimirlo. Si vuelve, se **reactiva**: se le abre
  un periodo nuevo y el anterior queda escrito, con el hueco entre los dos a la vista.
- **Las fechas pueden ser futuras**, la de inicio y la de fin. Una supresión se puede dejar
  programada.
- **El periodo es semiabierto**: rige desde su inicio inclusive hasta su fin exclusive. Así dos
  periodos seguidos ni se solapan ni dejan un día sin dueño. Y dos vidas del mismo nodo no pueden
  solaparse: lo impide la base.
- **Sólo se borra lo que nunca rigió.** Un borrador, o un periodo que aún no ha empezado. Lo que
  rigió no se borra: se suprime, y queda. Ver
  [Qué se puede borrar](/modelo/proceso/#qué-se-puede-borrar).

Suprimir no es sólo poner una fecha. Cuando el fin llega, la base cierra lo que colgaba del nodo —
los roles que daba, sus vacantes, sus ocupaciones—, y eso no vuelve solo al reactivar. Por eso un
fin que ya ocurrió no se puede quitar ni aplazar, y por eso una unidad con hijas o con puestos que
siguen rigiendo no se deja suprimir hasta que se haya dicho adónde van.

## De quién depende, y desde cuándo

La relación entre un nodo y su padre es también una fila con fechas: `unit_relations` para el
organigrama y `process_relations` para el árbol de procesos. Dice quién es el padre, desde qué día
y hasta cuál.

- **Mover un nodo no reescribe nada.** Cierra la relación anterior y abre otra. La anterior se
  queda, y se puede preguntar por ella con su fecha.
- **Un hijo no tiene dos padres a la vez** en el mismo árbol. No lo vigila un programa: es una
  restricción de exclusión de la base sobre el rango de fechas.
- **La relación vive dentro de la vida de sus dos nodos.** Poner en vigor una unidad pone en marcha
  su relación con la misma fecha; suprimirla la cierra.

## Quién lo ordenó

Cada inicio y cada fin —de una vida o de una relación— lleva escrito su **origen**, y de él depende
si hace falta un papel:

| Origen | Qué es | ¿Necesita un acto? |
|---|---|---|
| **Carga inicial** | Lo que ya existía cuando se instaló el sistema | No |
| **Reorganización** | Un cambio que alguien con competencia decidió | Sí, siempre |
| **Corrección** | Arreglar algo que se registró mal | No: lleva un motivo, y un permiso propio |

El **acto** es ese papel: una resolución, un acta, un memorando. Se registra con su tipo, su
número, su asunto, quién lo emite y dos fechas —cuándo se firmó y desde cuándo rige, que no
tienen por qué coincidir—. Un mismo acto puede ordenar varios cambios a la vez.

La referencia es obligatoria; el documento puede llegar después. Si se produjo y se firmó en
Deasy, se **enlaza**; si vino de fuera, se **adjunta** su PDF. Uno de los dos, nunca ambos. Y que
falte no pasa inadvertido: el nodo al que ese acto ordenó algo lo avisa en el mapa. El detalle, en
[El papel que ordena un cambio](/modelo/organizacion/#el-papel-que-ordena-un-cambio--actos).

## Qué sucede a lo que termina

Cuando un nodo se suprime, se puede decir quién continúa lo suyo. Varios sucesores son una
**división**; varios antecesores con el mismo sucesor, una **fusión**. Viven en `unit_equivalencias`,
`position_equivalencias` y `process_equivalencias`.

El detalle que importa: quien tiene sucesores no es el nodo, es **una vida suya que terminó**. Un
nodo puede suprimirse, reactivarse y volver a suprimirse, y cada fin tiene los suyos. El sucesor,
en cambio, es el nodo entero, y tiene que regir ese día o después.

## Corregir no es reorganizar

Cambiar algo que ya rigió puede ser dos cosas opuestas. Una reorganización es un hecho nuevo: pasa
hoy, con su acto. Una corrección dice que lo escrito estaba mal: «rigió desde diciembre, no desde
enero». El sistema las separa, porque confundirlas es reescribir la historia sin dejar rastro.

Una corrección pide un permiso distinto del de editar la estructura, un motivo escrito, y deja en
una bitácora de sólo altas quién la hizo, cuándo, por qué, y qué decía la fila antes y después.
Qué cosas son corrección y cuáles no, en
[Corregir no es reorganizar](/modelo/organizacion/#corregir-no-es-reorganizar).

## Las dos lecturas de un documento antiguo

Con todo lo anterior, un documento producido hace dos años se puede leer de dos maneras, y las dos
son legítimas:

| | Como era entonces | Como es hoy |
|---|---|---|
| La pregunta | ¿Quién lo produjo, y dónde estaba sentado? | ¿Quién tiene ahora ese asunto? |
| Para qué sirve | Procedencia: el documento pertenece al contexto que lo produjo | Continuidad: quien hereda el proceso necesita sus papeles |
| De dónde sale | De las vidas y las relaciones **a la fecha del documento** | Del árbol vigente y de los sucesores |

Lo decidió el dueño del sistema: valen las dos, y cada informe o pantalla tiene que **decir cuál
de las dos está respondiendo**.

**Como es hoy** es lo que leen las pantallas. Dos vistas dan el árbol que rige,
`unit_arbol_vigente` y `process_arbol_vigente`, y las equivalencias dicen a quién pasó lo de un
nodo suprimido.

**Como era entonces** no tiene vista propia: es una consulta con una fecha. Por ejemplo, de quién
dependía una unidad un día dado:

```sql
SELECT p.name AS padre
  FROM unit_relations r
  JOIN units p ON p.id = r.parent_unit_id
 WHERE r.child_unit_id = :unidad
   AND r.vigente_desde <= :fecha
   AND (r.vigente_hasta IS NULL OR r.vigente_hasta > :fecha);
```

Si la unidad regía ese día:

```sql
SELECT v.vigente_desde <= :fecha
       AND (v.vigente_hasta IS NULL OR v.vigente_hasta > :fecha) AS regia
  FROM unit_vigencias v
 WHERE v.unit_id = :unidad;
```

Y quién continúa hoy lo de una unidad que terminó:

```sql
SELECT s.name AS sucesora, v.vigente_hasta AS desde
  FROM unit_vigencias v
  JOIN unit_equivalencias e ON e.antecesor_vigencia_id = v.id
  JOIN units s ON s.id = e.sucesor_unit_id
 WHERE v.unit_id = :unidad;
```

La comparación de fechas es siempre la misma, y es la del periodo semiabierto: empezó ese día o
antes, y no ha terminado o termina después.

:::caution[Lo que todavía no hace]
La lectura «como era entonces» está **en los datos, no en las pantallas**. Ningún informe ni
listado de documentos la ofrece todavía: el organigrama y el mapa de procesos dibujan el estado de
hoy, y lo anterior se ve nodo por nodo, en sus vidas anteriores. Recorrer un árbol entero a una
fecha pasada es una consulta recursiva que no está escrita. Si un día hiciera falta acelerarla,
la tabla que lo haga será un artefacto derivado: la fuente son las relaciones con fechas.
:::

## Dónde se ve en la aplicación

En `/admin`, el **organigrama** y el **mapa de procesos** son la cara de todo esto. Cada nodo
dice su estado con la franja de color de su izquierda y lo escribe cuando no es el normal. Al
pulsarlo se abre con sus pestañas:

- **Vigencia**: el periodo en curso, con su origen y su acto; reactivar; los sucesores; y las vidas
  anteriores.
- **Actos**: los papeles que ordenaron algo de ese nodo, cada uno con su documento, y desde donde
  se enlaza o se adjunta el que falte.

Un nodo con algo pendiente —un acto sin documento, un puesto que se quedó en borrador— lo avisa
en su esquina.

Las tablas de vidas, relaciones y equivalencias se pueden consultar enteras desde el editor de
`/admin`, pero son de **sólo consulta**: se escriben desde el nodo, que es quien avisa de lo que
se va a cerrar y pide confirmarlo.

## Lo que queda fuera

- **Las líneas de un proceso no se mudan.** A qué proceso pertenece una línea no es un cambio con
  fecha: es inmutable, y una línea que cambia de sitio es otra línea que sucede a la anterior. Ver
  [De qué línea es un entregable](/modelo/entregable-concreto/).
- **Los órganos de gobierno** —consejos, comités— no están modelados aquí.
- **El esquema no migra una base anterior.** Una instalación de antes de este cambio se resetea;
  aplicar el esquema nuevo sobre ella no convierte sus casillas «activa» en periodos.
