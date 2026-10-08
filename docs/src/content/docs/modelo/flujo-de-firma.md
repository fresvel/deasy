---
title: "El flujo de firma: quién firma, en qué orden y en qué sitio del papel"
description: "La misma estructura que la entrega, con dos añadidos: un paso puede tener varios firmantes y decidir qué basta, y cada paso tiene un hueco físico en el papel."
sidebar:
  label: "12 · El flujo de firma"
  order: 12
---

El flujo de firma tiene **la misma estructura que el de entrega** —cabecera colgada de uno de dos
portadores, pasos ordenados, instancia pegada a la ronda y solicitudes— y las mismas tres formas de
encontrar a quien le toca. Si leíste [la página anterior](/modelo/flujo-de-entrega), esta
es la misma película con dos añadidos importantes.

Los dos escalones de resolución son idénticos: primero `task_item_id` (el recorrido definido al
enviar), después `edicion_id` (el autorado en la edición), y el segundo exige `task_item_id IS NULL`.
Su `CHECK` es el mismo: exactamente un portador relleno. El tercer portador que hubo —el del
vínculo— murió igual aquí que allí, y el porqué está contado en esa página.

:::note[Dos valores por defecto que sí cambian]

`signature_flow_steps` nace con `resolver_type = 'cargo_in_scope'` y
`unit_scope_type = 'context_exact'`, mientras su gemela de entrega nace con `task_assignee` y
`unit_exact`. Tiene sentido: lo normal es que el documento lo rellene su responsable y lo firme un
cargo de la unidad del documento.

Y hay una asimetría que no es de diseño sino deuda: `fill_flow_steps.selection_mode` está cerrado por
`CHECK`; `signature_flow_steps.selection_mode` es un `VARCHAR(20)` **sin `CHECK`**. Esa asimetría es
justo lo que se sigue en `TD7-e`.

:::

## Añadido uno: varios firmantes en un paso, y qué basta

Un paso de firma declara su **modo de aprobación** en `approval_mode`, cerrado por `CHECK`:

| Valor | Qué significa |
|---|---|
| `and` | Tienen que firmar **todos**. Es el valor por defecto |
| `or` | Basta con que firme **uno cualquiera** |
| `at_least` | Tienen que firmar **al menos N** |

Eso permite modelar un consejo que aprueba por mayoría sin necesitar nombres.

:::caution[El mínimo se evalúa; el máximo no]

El paso guarda `required_signers_min` y `required_signers_max`, pero **solo el primero entra en la
decisión**. El máximo se escribe, se versiona, se proyecta al panel y se lee al hidratar el paso —
pero **no llega al resumen que decide si un paso está completo**, que solo lleva el modo de aprobación
y el mínimo. No cierra ni abre ningún paso.

:::

## Añadido dos: el hueco físico en el papel

Aquí es donde encaja el `token` de la persona, y es la parte del modelo que más cuesta ver porque
cruza tres mundos: la base, la maqueta del documento y el firmador.

Un paso de firma tiene un **hueco** (`slot`): un nombre estable para «la firma del revisor», «la
firma del aprobador». La cadena completa es esta:

1. `persons.token` son **diez caracteres únicos** por persona, guardados limpios en la base.
2. La maqueta genera Jinja que embebe en ese hueco el token del firmante resuelto:
   `{{ signatures.<slot>.token }}`.
3. Al enviarlo al servicio de firma, el token se envuelve: `aB3xKp9mQr` viaja como `!-aB3xKp9mQr-!`.
4. Compilado el documento, esa marca queda **impresa en el PDF como texto**.
5. Al firmar, el firmador **busca ese texto dentro del PDF, encuentra su página y sus coordenadas y
   estampa la firma exactamente ahí**.

Por eso nadie tiene que colocar la firma a mano: la posición ya viaja dentro del documento. Con un
matiz — el servicio admite **dos modos**, `token` y `coordinates`; lo anterior describe el primero.

:::note[Un slot repetido eran dos firmantes compartiendo un token, y respondía 200]

El slot se acuñaba por posición (`firma_${order}`), así que insertar un paso en medio le daba el slot
que otro firmante ya tenía. Medido contra la base: insertar un paso en el orden 2 de una plantilla
con tres pasos dejaba **dos filas con `slot = firma_2`** y la petición respondía **200** — en
silencio, y con valor legal.

Hoy la unicidad tiene dos capas y las dos hacen falta: la autoría la valida con un 422 legible, y la
base la impone con `uq_signature_flow_steps_slot`, un índice único parcial sobre `(template_id, slot)`
`WHERE slot IS NOT NULL`. El índice es el que cubre a los **otros dos escritores** —el flujo de
runtime y la copia de versionado—, que la validación de autoría no toca. Es parcial porque las filas
de flujo de entrega no tienen slot, y un slot ausente no es una colisión.

:::

:::danger[El punto frágil: la lista libre de firmantes]

El paso guarda además una lista de firmantes en JSONB (`signers`). Esa lista **no la valida nadie** y
**manda sobre** `resolver_type`, que sí está cerrado por `CHECK`. Significa que un paso antiguo puede
traer por ahí una forma de resolución ya retirada, y si el código dejara de contemplarla, ese paso
**no lo firmaría nadie, y en silencio**. La copia de versionado lo propaga verbatim.

Por eso hay dos `case` legados —`document_owner` y `position`— que **no se pueden borrar todavía**:
hacerlo dejaría el paso resolviéndose por el `default` sin cargo. Está registrado como **defecto
1.19**, y el orden de cierre es filtrar **y** migrar, en ese orden. Ver
[Lo que hoy no cierra](/modelo/lo-que-no-cierra).

Hay un tercer JSONB en la tabla, `anchor_refs`, que es un contrato **sin productor ni consumidor**.

:::

## Los estados de firma son catálogo, no lista fija

Aquí hay **dos cosas distintas** que se confundían con facilidad, y una de ellas dejó de ser una
tabla el 2026-10-08:

| Dónde | Qué describe | Valores |
|---|---|---|
| `signature_requests.status` y `signature_flow_instances.status` | Cómo va **la solicitud** y cómo va la instancia | `pendiente` · `en_progreso` · `completado` · `rechazado` · `cancelado`, cerrados por `CHECK` |
| `signature_statuses` | Cómo salió **la firma en sí** | `firmado` · `fallido` · `invalido` · `cancelado`, en una tabla de catálogo |

El estado de la solicitud era un catálogo propio, `signature_request_statuses`, y se retiró: es el
mismo concepto que el del lado de entrega, así que hoy es el mismo `CHECK` y el mismo vocabulario.
El porqué, con lo que costaba la indirección, está en
[los vocabularios de estado](/modelo/vocabularios-de-estado/).

**El de `signature_statuses` sí sigue siendo una tabla**, y no por inercia: es el resultado de una
operación criptográfica, no el turno de una persona.

Y al final la **firma en sí** queda registrada en `document_signatures`: quién firmó, con qué
resultado, cuándo, y en qué archivo quedó el documento ya firmado. Un detalle del nombre:
`signer_user_id` apunta a `persons` — el `user` es un fósil de la tabla `users`, que ya no existe.

```mermaid
erDiagram
  ediciones ||--o{ signature_flow_templates : "flujo de la plantilla"
  task_items ||--o{ signature_flow_templates : "flujo definido en runtime"
  signature_flow_templates ||--o{ signature_flow_steps : "pasos ordenados"
  signature_flow_templates ||--o{ signature_flow_instances : "se instancia en"
  document_versions ||--o{ signature_flow_instances : "para esta ronda"
  signature_flow_instances ||--o{ signature_requests : "genera solicitudes"
  signature_flow_steps ||--o{ signature_requests : "de este paso"
  persons ||--o{ signature_requests : "dirigida a"
  signature_requests ||--o{ document_signatures : "produce la firma"
  document_versions ||--o{ document_signatures : "sobre esta ronda"
  persons ||--o{ document_signatures : "firmada por"
  signature_statuses ||--o{ document_signatures : "resultado"

  signature_flow_templates {
    int id PK "LA CABECERA"
    int task_item_id FK "portador 1: el entregable (runtime)"
    int edicion_id FK "portador 2: la edicion de plantilla"
    varchar name
    varchar description
    smallint is_active
    timestamp created_at
  }
  signature_flow_steps {
    int id PK "UN PASO"
    int template_id FK
    int step_order
    varchar code
    varchar name
    varchar slot "EL HUECO, único por flujo"
    text resolver_type "CHECK, por defecto cargo_in_scope"
    int assigned_person_id FK
    text unit_scope_type "CHECK, por defecto context_exact"
    int unit_id FK
    int unit_type_id FK
    int position_id FK
    int required_cargo_id FK
    varchar selection_mode "SIN CHECK"
    text approval_mode "CHECK: and, or, at_least"
    int required_signers_min "se evalúa"
    int required_signers_max "no se evalúa"
    smallint is_required
    jsonb anchor_refs "sin productor ni consumidor"
    jsonb signers "lista libre, SIN validar"
    timestamp created_at
  }
  signature_flow_instances {
    int id PK "LA INSTANCIA"
    int template_id FK
    int document_version_id FK "única por ronda"
    text status "CHECK: 5 valores"
    timestamp created_at
  }
  signature_requests {
    int id PK "LA SOLICITUD"
    int instance_id FK
    int step_id FK
    int assigned_person_id FK
    text status "CHECK: 5 valores"
    smallint is_manual
    timestamp requested_at
    timestamp notified_at
    timestamp responded_at
  }
  document_signatures {
    int id PK "LA FIRMA"
    int signature_request_id FK
    int document_version_id FK
    int signer_user_id FK "apunta a persons"
    int signature_status_id FK
    varchar note_short
    varchar signed_file_path
    timestamp signed_at
    timestamp created_at
  }
  signature_statuses {
    int id PK
    varchar code "4 códigos sembrados"
    varchar name
    varchar description
    smallint is_active
    timestamp created_at
  }
```
