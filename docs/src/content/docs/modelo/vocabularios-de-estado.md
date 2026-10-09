---
title: "Los vocabularios de estado"
description: "Qué listas de estados protege la base y cuáles viven solo en el código, y por qué la ronda y el documento tienen vocabularios distintos aunque se parezcan."
sidebar:
  label: "Vocabularios de estado"
  order: 14
---

El sistema maneja varias listas de estados y **no todas están protegidas igual**. Esa diferencia es lo
primero que hay que tener claro, así que va explícita.

## Qué protege la base y qué no

| Qué describe | Columna | Valores | ¿`CHECK` en la base? |
|---|---|---|---|
| Configuración | `process_definition_versions.status` | `draft` · `active` · `retired` | **Sí** |
| Edición de plantilla | `ediciones.lifecycle_state` | `draft` · `published` · `retired` | **Sí** |
| Ámbito del entregable | `catalogo_documental.template_scope` | `official` · `ad_hoc` | **Sí** |
| Corrida | `process_runs.status` | `pending` · `active` · `completed` · `cancelled` | **Sí** |
| Modo del vínculo | `vinculos.item_mode` | `single` · `replicated` · `routed` | **Sí** |
| Origen del entregable | `task_items.origin_kind` | `process_defined` · `user_added` | **Sí** |
| Causa del turno | `task_item_tenures.opened_by` | `original` · `occupancy_start` · `occupancy_end` · `position_deactivated` · `reconcile` · `manual` | **Sí** |
| Cómo se encuentra a quien entrega o firma | `participantes_declarados.resolver_type` | `task_assignee` · `cargo_in_scope` · `specific_person` | **Sí**, y desde el 2026-10-08 **sin escapatoria**: el JSONB `signers` que se la saltaba pasó a filas |
| Ámbito del paso | `unit_scope_type` en los dos flujos | `unit_exact` · `unit_subtree` · `unit_type` · `all_units` · `context_exact` | **Sí** |
| Ámbito del que se saca a la gente | `participantes_declarados.unit_scope_type` | `unit_exact` · `context_exact` · `all_units` | **Sí**. Eran seis valores y cuatro llegaban sólo por el JSONB |
| Recorrido (entrega y firma) | `recorridos.estado` | `pendiente` · `en_progreso` · `completado` · `rechazado` · `cancelado` | **Sí** |
| Turno (a quién le toca) | `turnos.estado` | los cinco anteriores más `devuelto`, y un `CHECK` lo limita a la entrega | **Sí** |
| Instancia de entrega *(en retirada)* | `document_fill_flows.status` | los mismos cinco | **Sí**, pero ya no la escribe nadie |
| Solicitud de entrega *(en retirada)* | `fill_requests.status` | los seis | **Sí**, pero ya no la escribe nadie |
| Instancia de firma *(en retirada)* | `signature_flow_instances.status` | los mismos cinco | **Sí**, pero ya no la escribe nadie |
| Solicitud de firma *(en retirada)* | `signature_requests.status` | los mismos cinco | **Sí**, pero ya no la escribe nadie |
| Resultado de firmar | `signature_statuses` | catálogo de 4 códigos | **Es una tabla**, consultable y ampliable sin tocar el esquema |
| **Documento** | `task_items.document_status` | **11 valores** | **No.** Solo en el código |
| **Ronda** | `document_versions.status` | **12 valores** | **No.** Solo en el código |
| **Tarea** | `tasks.status` | `pendiente` · `en_proceso` · `completada` · `cancelada` | **No.** Una sola lista, en `config/sqlTables.js` |
| **Lote de firma** | `signature_batch_jobs.status` | por defecto `queued` | **No** |

Esas cuatro últimas son las que se siguen como `TD7-e`: **cuatro columnas de estado sin `CHECK`**, no
las ocho que se contaron en su día. La decisión pendiente es cuáles bajan su dominio a la base.

## El recorrido tiene UN vocabulario, y antes tenía dos

Las cuatro columnas del recorrido —instancia y solicitud, entrega y firma— describen lo mismo: cómo
va el turno de alguien. Hasta el **2026-10-08** lo describían de **dos maneras distintas**:

| | Mecanismo | Idioma |
|---|---|---|
| Entrega | `status TEXT` con `CHECK` | inglés (`pending`, `approved`…) |
| Firma | `status_id` contra la tabla `signature_request_statuses` | español (`pendiente`, `completado`…) |

Dos mecanismos y dos idiomas para un solo concepto. Hoy son **un `CHECK` y el español**:

`pendiente` · `en_progreso` · `completado` · `rechazado` · `devuelto` · `cancelado`

**`devuelto` sólo es legal en la entrega** —un paso de entrega se puede devolver, y firmando eso no
existe—, y eso no se declara en el código: lo acota el `CHECK` de cada columna. `fill_requests` admite
los seis; las otras tres, cinco.

:::note[Por qué `CHECK` y no una tabla, que es lo que se retiró]

Un catálogo parece más flexible —se añade un código sin tocar el esquema—, y por eso existía. Lo que
costaba era peor que lo que daba:

- **cada lectura del estado de una firma era una CONSULTA más**, un `JOIN` a una tabla de cinco filas
  que nunca creció;
- el código traducía código → `id` antes de escribir, con un «y si no existe ese estado» que sólo
  podía pasar borrando una fila del catálogo a mano;
- y **la etiqueta viajaba al frontend como si fuera el código**. «En progreso» llegaba minusculizado
  a `en progreso`, que no coincide con `en_progreso`: hubo que meter una entrada con espacio en el
  mapa de tonos para taparlo.

Con el vocabulario cerrado en un `CHECK`, validar es comparar contra cinco cadenas: sin red, sin base
y sin poder equivocarse de catálogo. Es la misma decisión que ya estaba tomada y escrita para el tipo
de documento de identidad, y la que ya usan `item_mode`, `lifecycle_state`, `template_scope`,
`resolver_type` y `unit_scope_type`.

⚠️ **`signature_statuses` no se tocó**, y conviene saber por qué: es el estado del **hecho** de
firmar —`firmado`, `fallido`, `invalido`, `cancelado`—, el resultado de una operación criptográfica,
no el de una solicitud. Las dos tablas eran idénticas en forma y distintas en significado, que es
justo lo que hacía fácil confundirlas.

:::

:::note[La tarea sí tiene vocabulario conocido, aunque la base no lo imponga]

Conviene no exagerar el caso de `tasks.status`. Su lista existe, es **una sola** y está **escrita una
sola vez**: `backend/config/sqlTables.js:266` la declara como las `options` del `select` del editor
genérico, con `pendiente` de valor por defecto. Lo que falta no es unificarla — es **bajarla al
esquema**, donde la columna es un `VARCHAR(30)` sin `CHECK`.

El frontend no la repite: `shared/utils/estadoTono.js` tiene un mapa de **presentación** —qué tono y
qué etiqueta en castellano le toca a cada código—, no una segunda declaración del dominio. Y lo pinza
un test (`estadoTono.test.js:177`), así que si la lista cambiara en el backend y no allí, salta.

Y lo peligroso de esta zona ya está cerrado: hasta el 2026-08-23 había además una
`task_items.status` con **cero escritores** —se quedaba en `pendiente` para siempre— que siete sitios
leían con dos vocabularios que no compartían ni un literal. El filtro del relevo **no excluía nada**,
así que todo entregable era reasignable para siempre, firmado incluido. Se retiró, y lo pendiente se
lee ahora del documento.

De ese retiro **queda un fósil**: `estadoTono.js:504` sigue registrando `"task_items.status"` en el
mapa de columnas, y `estadoTono.test.js:178` lo pinza. Es inofensivo —esa columna ya no llega nunca
del backend, así que la entrada no se consulta— pero es exactamente el tipo de resto que conviene
barrer al pasar por esta tabla.

:::

## Dos vocabularios, y uno se deriva del otro

La ronda y el documento **no comparten lista**, y confundirlos es el error fácil porque nueve de sus
valores se llaman igual. La ronda es la más detallada; el documento es su proyección:

| Estado de la ronda (`document_versions.status`) | Estado del documento (`task_items.document_status`) |
|---|---|
| `Borrador` | `Inicial` |
| `Pendiente de llenado` | `Pendiente de llenado` |
| `En llenado` | `En proceso` |
| `En revisión de llenado` | `En proceso` |
| `Observado` | `Observado` |
| `Listo para firma` | `Listo para firma` |
| `Pendiente de firma` | `Pendiente de firma` |
| `Firmado parcial` | `Firmado parcial` |
| `Firmado completo` | `Firmado completo` |
| `Final` | `Final` |
| `Archivado` | `Archivado` |
| `Cancelado` | `Cancelado` |

Doce arriba, once abajo: `En llenado` y `En revisión de llenado` colapsan en `En proceso`.

**La dirección importa**: quien avanza es la ronda. Al mover su estado se valida la transición contra
la matriz de la ronda, se escribe, y **acto seguido se deriva y se escribe el del documento**.
`task_items.document_status` no se escribe por su cuenta — se llama así, y no `status`, precisamente
para que no se confunda con la columna sin escritores que se retiró.

Los dos vocabularios normalizan dos valores heredados: `rechazado` se lee como `Observado` y
`aprobado` como `Final`.

## El recorrido del documento

Estos son los once estados del documento y el orden en que puede moverse. No es un adorno: es una
máquina de estados real, con transiciones permitidas y prohibidas, que hoy vive únicamente en el
código.

```mermaid
stateDiagram-v2
    direction LR
    [*] --> Inicial
    Inicial --> PendienteLlenado: hay flujo de entrega
    Inicial --> ListoFirma: no lo hay
    PendienteLlenado --> EnProceso
    EnProceso --> PendienteLlenado
    PendienteLlenado --> Observado
    EnProceso --> Observado
    Observado --> EnProceso
    Observado --> PendienteLlenado
    PendienteLlenado --> ListoFirma
    EnProceso --> ListoFirma
    ListoFirma --> PendienteFirma
    PendienteFirma --> Observado: una firma rechazada, sin ninguna dada aún
    PendienteFirma --> FirmadoParcial
    FirmadoParcial --> PendienteFirma
    PendienteFirma --> FirmadoCompleto
    FirmadoParcial --> FirmadoCompleto
    FirmadoCompleto --> Final
    FirmadoCompleto --> Archivado
    Final --> Archivado
    Archivado --> [*]

    PendienteLlenado: Pendiente de llenado
    EnProceso: En proceso
    ListoFirma: Listo para firma
    PendienteFirma: Pendiente de firma
    FirmadoParcial: Firmado parcial
    FirmadoCompleto: Firmado completo
```

:::note[La única salida hacia atrás desde la fase de firma, y por qué sólo hay una]

`Pendiente de firma → Observado` es lo que pasa cuando **alguien rechaza una firma y todavía no hay
ninguna estampada**: el documento vuelve a revisión, se corrige, y al regresar a la fase de firma se
convoca otra vez.

**Desde `Firmado parcial` esa salida no existe, y no es una omisión.** Una firma se estampa sobre un
PDF concreto; si el documento se corrige después, esa firma habría firmado otro documento. Cuando ya
hay una, lo que corresponde es una **ronda nueva** —cancelar la versión y abrir la siguiente—, que es
lo que hace el reinicio del documento.

Antes del **2026-10-08** no había ninguna de las dos: un rechazo dejaba la *instancia* del recorrido
en `rechazado` pero **el documento no se movía**, y como el recorrido sirve siempre el primer paso no
aprobado, el paso rechazado se quedaba de actual indefinidamente. La única salida era tirar la ronda
entera, también cuando no había nada que invalidar.

:::

**`Archivado` es alcanzable desde todos los estados** salvo desde sí mismo y desde `Cancelado`.
**`Cancelado` casi**: es alcanzable desde todos menos desde `Firmado completo`, `Final` y `Archivado`
— un documento ya firmado del todo no se cancela, se archiva. Los dos se omiten del diagrama por no
llenarlo de flechas.

:::caution[Terminal no es «sin salida», y derivarlo salió mal]

Los estados terminales —donde ya no queda trabajo— son **`Final`, `Archivado` y `Cancelado`**, y la
lista es **explícita a propósito**. Se intentó derivarla del grafo como «estado del que no sale
ninguna transición», y eso da `Archivado` y `Cancelado` pero **deja fuera `Final`**, que sí tiene
salida hacia `Archivado` aunque el documento esté terminado. Con esa derivación, **todo documento
acabado habría seguido contando como pendiente**.

«Sin salidas» es una propiedad del grafo; «ya no hay trabajo» es una propiedad del negocio, y no
coinciden.

:::

## Dónde se corta el relevo automático

El traspaso automático de responsable alcanza hasta **`Listo para firma` inclusive**. En cuanto el
documento entra en `Pendiente de firma` deja de moverse solo: a partir de ahí hay gente convocada con
solicitudes abiertas a su nombre, y cambiarles el responsable por debajo es confuso. `Listo para
firma` todavía entra porque significa que el llenado terminó, no que se haya convocado a nadie.

Esa lista de cinco estados está escrita **en dos sitios a la vez** —en el código, como
`DOCUMENT_RELAYABLE_STATUSES`, y dentro de los triggers del esquema, porque el SQL no puede leer una
constante de JavaScript—. La duplicación no se vigila sola: la vigila una prueba unitaria que **lee el
fichero del esquema** y compara las dos listas.

Como en el caso anterior, tampoco se deriva: podría escribirse como «ni en fase de firma ni terminal»,
pero eso son dos propiedades del grafo y esto es una regla de negocio. El día que alguien añada un
estado nuevo tiene que decidir a mano de qué lado cae.
