---
title: "Lo que hoy no cierra"
description: "Los puntos abiertos del modelo, cuáles esperan una decisión y cuáles esperan trabajo — y lo que se cerró en la última tanda, para no volver a plantearlo."
sidebar:
  label: "Lo que no cierra"
  order: 16
---

El modelo se sostiene, y este recorrido lo atraviesa entero sin encontrar un agujero estructural. Pero
quedan puntos abiertos, y **la mayoría esperan una decisión, no más trabajo técnico**. Van aquí porque
una verificación del modelo que solo enseñe lo que funciona no sirve de nada.

Se siguen en el plan de la capa de datos del repositorio (`docs/planes/plan_data/`), fase **D7**, cuyo
control de ejecución es la fuente de esta página.

## Las decisiones pendientes

| Identificador | Dónde | Qué pasa | Qué falta |
|---|---|---|---|
| `TD7-a` | Vínculo → edición | **Publicar una edición nueva retira la anterior y no avisa a nadie.** Reproducido: el vínculo 1 usa una edición `retired` mientras otra está `published` en otro proceso — y de ese vínculo salen los tres entregables del sistema. Al lanzar, nadie mira el estado de la edición | Decidir si al publicar se **avisa** qué configuraciones quedan atrás, si se **impide publicar** hasta actualizarlas, o si se deja como está |
| `TD7-b` | Lanzamiento → edición | Un proceso puede lanzarse con una edición **todavía en borrador**. La inmutabilidad de `published` se apoya en que un `draft` nunca tenga instancias vivas, y eso **nadie lo comprueba al lanzar**: medido, `launch.js` no menciona `lifecycle_state` ni una vez | Decidir si el lanzamiento rechaza un borrador, **y una prueba que congele la respuesta** |
| `TD7-e` | Estados sin `CHECK` | **Cuatro** columnas de estado no declaran su dominio en la base: `tasks.status`, `task_items.document_status`, `document_versions.status` y `signature_batch_jobs.status`. Un valor mal escrito entra sin resistencia | Decidir cuáles bajan a la base. **Va detrás de D2**, o se cimentaría un vocabulario que aún se está unificando |
| `TD7-k2` | Silla desactivada | Desactivar un puesto **no cierra su ocupación**. La persona sigue figurando como titular vigente de una silla que ya no existe | Decidir si debe cerrarse, o si es correcto que una silla inactiva conserve a su ocupante |
| `TD7-r2` | Cadena de contratación | `aplications`, `offers` y las tres tablas de origen de contrato **no las toca ningún código**, y el rol `GestorContratacion` promete tres cosas de las que solo existe una | Decidir si la cadena **se implementa o se retira** |
| `T1.19-b` | Lista libre de firmantes | El JSONB `signers` **no lo valida nadie** y manda sobre `resolver_type`, que sí está validado. Un paso antiguo puede traer por ahí una forma de resolución retirada | Decidir **qué se hace con los tres valores retirados** que el JSONB puede traer |

:::caution[El caso de la lista de firmantes necesita decisión Y trabajo, y en un orden concreto]

Es el defecto **1.19**, y no basta con filtrar. El censo está cerrado: hay tres escritores vivos y los
tres filtran; lo que queda es legado, y **la copia de versionado lo propaga verbatim**.

Sus tareas están encadenadas a propósito:

- **Filtrar solo** dejaría pasos legítimos **sin firmante**, porque hay filas ya desplegadas que
  dependen del valor legado.
- **Migrar primero** el JSONB de esas filas es lo que desbloquea el filtro.
- Y **solo entonces** se pueden retirar los dos `case` legados (`document_owner`, `position`). Hoy
  borrarlos deja el paso resolviéndose por el `default` sin cargo: **sin firmante y en silencio**.

Por eso dos de sus cinco tareas figuran como bloqueadas, no como pendientes.

:::

:::note[Lo que estos puntos NO son]

Ninguno es un fallo de modelado, y conviene decirlo para que no se lean como alarma:

- `TD7-a` y `TD7-b` **no son de capa de datos**. Son reglas de negocio: se responden con una decisión
  y se implementan en los servicios y los guards, no en el esquema.
- `TD7-e` es higiene. Lo peligroso de esa zona —dos vocabularios de estado en conflicto y un filtro de
  relevo que no excluía nada— **ya está cerrado**.
- El mismo entregable enlazado dos veces **con modos distintos** (`routed` y `single`) es correcto y no
  entra aquí: confirma que `item_mode` es del vínculo, no de la plantilla.

:::

## Lo que sí quedó cerrado

Se apunta para que no se vuelva a proponer de cero — una decisión sin razón escrita se replantea en
tres meses.

**Tres tablas murieron y no vuelven**, todas porque guardaban lo mismo que otras y se desincronizaban:

- `task_assignments` — una foto del reparto que **ningún relevo refrescaba**.
- `task_item_handovers` — los mismos hechos como eventos sueltos. Ahora son **periodos**
  (`task_item_tenures`), y de dos eventos consecutivos sale un periodo, así que no se perdió nada. Lo
  que se ganó es que «un solo responsable vigente» pasa de convención a **índice**, y que aparecen dos
  datos que el asiento no tenía: en calidad de qué puesto respondía cada uno, y el turno `original`
  del reparto inicial — el historial viejo empezaba en el **segundo** responsable.
- `documents` — una cáscara 1:1 sobre `task_items` **sin ni una columna propia**.

**El censo de referencias sin comprobar también se cerró**: **once columnas** que guardaban un número
apuntando a una fila que podía no existir ya llevan su restricción — once, no diez, porque el censo
automático no vio una cuyo nombre no acababa en `_id`. La premisa de «no acoplar los módulos
ex-documentales al núcleo» resultó ser falsa: el servicio de autorización del chat ya resolvía permisos
uniendo contra `units` y `processes`.

Y se cerraron dos cosas más que tocan directamente a estas páginas: el **envío sin flujo** ahora se
rechaza con un 400, y `responsible_position_id` pasó a obligatorio — antes, si no se encontraba a
nadie, el lanzamiento creaba el entregable **huérfano** y avisaba en la misma respuesta.
