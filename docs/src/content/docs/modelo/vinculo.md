---
title: "El vínculo: qué edición usa cada configuración, y en qué modo"
description: "La tabla pequeña que cierra la mitad declarativa del modelo: une una configuración de proceso con una edición de plantilla y declara en qué modo se emitirá el entregable."
sidebar:
  label: "6 · El vínculo y los modos"
  order: 6
---

El **vínculo** (`vinculos`) es la frase que cierra la mitad declarativa: *«en
esta configuración del proceso, se entrega este documento, usando esta edición de la plantilla, de
esta manera»*.

Es una tabla pequeña y hace mucho. Además de unir configuración (`process_definition_id`) con
edición (`edicion_id`), guarda el **orden** en que aparecen los documentos de un proceso
(`sort_order`) y, sobre todo, el **modo** (`item_mode`).

## Los tres modos, que no son variantes técnicas sino tres formas de trabajar

`item_mode` tiene un `CHECK` con tres valores, y por defecto vale `single`.

| Modo | Flujo | Cuántos entregables | Cuándo se decide quién entrega y quién firma |
|---|---|---|---|
| `single` | predefinido en la plantilla | uno por puesto alcanzado, al disparar | en la autoría de la plantilla |
| `replicated` | predefinido en la plantilla | los que cree el responsable, con su etiqueta | en la autoría de la plantilla |
| `routed` | **no hay** | los que se creen a mano | **al instanciar**, en runtime |

- **Único** (`single`) — el documento y su recorrido están decididos de antemano. Al dispararse el
  proceso aparece *un* entregable por puesto alcanzado, ya con su flujo de entrega y de firma
  puestos. Es el caso del informe que todos los coordinadores deben entregar igual. **Es el único
  modo que el lanzamiento materializa solo**: `ensureTaskItemsForTaskTargets()` filtra
  explícitamente por `item_mode === 'single'`.
- **Replicado** (`replicated`) — el recorrido está decidido, pero la cantidad no. El responsable
  crea tantas copias como necesite, cada una con su etiqueta (`task_items.title`), y todas heredan
  el mismo recorrido. Es el caso de «un acta por cada reunión que hayas tenido».
- **Abierto** (`routed`) — no hay recorrido predefinido. Quien lo usa **define en el momento** quién
  entrega y quién firma. Es el modo del «Proceso por defecto», y es lo que permite «hazme el informe
  de este evento y que lo firme el decano» sin que nadie haya configurado nada antes.

:::note[El modo es del vínculo, no de la plantilla]

`item_mode` es una columna de la tabla que **une**, no de `ediciones`. Su único índice
único es `uq_vinculos (process_definition_id, edicion_id)`: la misma
edición puede vincularse a varias configuraciones, y **cada vínculo lleva su propio modo**.

O sea que una misma plantilla puede usarse de forma rígida en un proceso y de forma abierta en otro
sin necesidad de duplicarla. Es una propiedad del modelo que conviene no perder.

:::

:::caution[Pero no a varias LÍNEAS: eso lo impide un disparador]

Lo de arriba es cierto dentro de **una línea**: la misma edición puede estar vinculada a varias
configuraciones de esa línea —que es lo que pasa al versionar una configuración, porque clonar copia
sus vínculos— y cada vínculo lleva su modo.

Lo que **no** puede es cruzar de línea. Desde el 2026-10-04 lo impone la base, con el disparador
`trg_pdt_linea_unica`: al vincular una edición, **todas** las definiciones ya vinculadas a cualquier
edición de ese mismo entregable tienen que compartir `(proceso, variación)` con la definición que se
vincula. El primer vínculo de un entregable siempre pasa — no hay con qué comparar.

Si se cruza, el `INSERT` muere con un mensaje escrito para una persona, y la API lo devuelve como
400: *«El entregable "X" pertenece a otra línea (proceso/variación) y no se puede vincular a esta
configuración. Crea o usa un entregable propio de esta línea.»*

**Por qué un disparador y no un índice único.** Se intentó con
`UNIQUE (edicion_id)` y rompía el versionado de configuraciones: ese índice prohíbe el
mismo artefacto en dos *definiciones*, cuando la regla habla de dos *líneas*, y una línea contiene
muchas versiones de definición. Y la regla no cabe en un índice de esta tabla, porque la línea se
identifica con `process_definition_versions.(process_id, series_id)`: pedirla en un índice obligaría
a copiar esa columna aquí, que es la duplicación que este frente vino a quitar.

Antes lo intentaba un guardia de JavaScript que comparaba dos columnas copiadas en `catalogo_documental`.
Comprobaba la regla entera, pero solo en el alta por el CRUD de administración: el clon, los scripts
de siembra y un `INSERT` a mano se lo saltaban. El disparador no se lo salta nadie.

:::

## Dos consecuencias del modo que no se ven en la tabla

**Publicar exige flujo, salvo en `routed`.** Al publicar una edición se comprueba que tenga al menos
un paso de flujo de entrega; la comprobación se omite si la edición está vinculada **solo** en modo
`routed`, porque en ese modo el flujo no se autora, se define al enviar.

**El modo viaja con el clon, y hubo que arreglarlo.** Versionar una configuración copia sus
vínculos, y `item_mode` es `NOT NULL DEFAULT 'single'`: dejarla fuera de la copia no daba error,
convertía en `single` —en silencio— todo vínculo `routed` o `replicated`. Como clonar es lo que hace
la actualización guiada de plantillas, cada actualización deshacía el modo. Le pasó al «Proceso por
defecto» en la base de dev, cuyo vínculo original decía `routed` y el de la configuración activa
decía `single`. Hoy `cloneProcessDefinitionChildren()`
(`backend/services/admin/processes/processDefinitionVersion.js`) selecciona e inserta `item_mode`
explícitamente. Si añades una columna de datos a esta tabla, añádela también ahí.

## Qué cuelga del vínculo aguas abajo

El vínculo no desaparece al dispararse el proceso: cada entregable concreto guarda de qué vínculo
nació (`task_items.vinculo_id`), y esa referencia forma parte de su identidad.
El detalle está en [El entregable concreto](/modelo/entregable-concreto/).

```mermaid
erDiagram
  process_definition_versions ||--o{ vinculos : "declara que se entrega"
  ediciones ||--o{ vinculos : "con esta edicion"
  vinculos ||--o{ task_items : "materializa"

  vinculos {
    int id PK "EL VINCULO"
    int process_definition_id FK "que configuracion"
    int edicion_id FK "que edicion de la plantilla"
    int sort_order "orden entre los documentos del proceso"
    text item_mode "single, replicated, routed -- CHECK, default single"
    timestamp created_at
  }
```
