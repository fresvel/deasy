---
title: "La organización: quién existe y dónde está sentado"
description: "Unidad, cargo, puesto y ocupación. La silla y su ocupante son cosas distintas, y de esa separación cuelga todo el sistema de responsabilidades."
sidebar:
  order: 2
---

Antes de que haya procesos tiene que haber una universidad. Deasy la modela con una distinción que es
la clave de todo el sistema de responsabilidades: **la silla y quien está sentado en ella son cosas
distintas**.

## Las cuatro piezas

| | Qué es | Tabla |
|---|---|---|
| **Unidad** | Una parte de la institución: una facultad, una carrera, una dirección | `units` |
| **Cargo** | Un rol genérico («Decano», «Coordinador de carrera»). Catálogo; no pertenece a ninguna unidad | `cargos` |
| **Puesto** | **La silla**: *este* cargo *en esta* unidad, con su número de plaza. Existe aunque nadie la ocupe | `unit_positions` |
| **Ocupación** | Una persona sentada en esa silla durante un periodo | `position_assignments` |

Las unidades se relacionan entre sí formando el organigrama, y esa relación **tiene tipo propio**
(`relation_unit_types`): la orgánica —código `org`, la que siembra el propio esquema— es la jerárquica
de toda la vida, pero puede haber otras. Cada tipo declara además si **hereda permisos hacia abajo**
(`is_inheritance_allowed`).

Un puesto se identifica por `(unit_id, cargo_id, slot_no)` —«Coordinador de carrera, plaza 1, de la
Carrera de Sistemas»— y lleva un `position_type` cerrado por `CHECK` a `real`, `promocion` o
`simbolico`.

Una ocupación tiene fecha de inicio y, cuando la persona se va, fecha de fin. **Solo puede haber una
ocupación vigente por silla**, y eso no es una costumbre del código: lo impone la base y no se puede
saltar.

:::note[Por qué importa esta separación]

Porque los documentos se le deben **al puesto**, no a la persona. Cuando alguien deja el cargo, lo que
debía no desaparece ni se queda huérfano: pasa a quien ocupe esa silla después. Toda la mecánica de
relevos se apoya en esto — el ancla de un entregable es `task_items.responsible_position_id`, que es
obligatoria.

:::

## Reglas de negocio que no viven en el código

Deasy repite un mismo idioma: una **columna generada** que vale algo solo en un caso y `NULL` en el
resto, más un índice único sobre ella. Como los `NULL` no chocan entre sí en un índice único, el
índice restringe *solo* el caso que interesa.

En esta página el idioma aparece dos veces:

- `unit_positions.head_flag` + `uq_unit_head` — **un solo jefe por unidad**.
- `position_assignments.current_flag` + `uq_position_current` — **una sola ocupación vigente por
  silla**.

:::tip[El idioma se usa nueve veces, no cuatro]

El esquema vigente lo repite en nueve índices únicos: los dos de arriba, más una vacante abierta por
puesto, un seleccionado por vacante, una oferta enviada por postulación, una asignación de rol vigente
por `(persona, rol, unidad, origen)`, una configuración activa por `(proceso, variación)`, un
entregable definido por proceso por `(tarea, vínculo, puesto)` y **un solo turno abierto por
entregable** (`uq_task_item_tenure_current`).

Aparte va `tasks.normalized_scope_unit_id`, que también es columna generada pero de la otra variante
—`COALESCE(scope_unit_id, 0)`, nunca nula— y sirve para la **idempotencia del lanzamiento**.

:::

Hay una tercera invariante en el organigrama que no usa ese idioma sino un índice único a secas:
`uq_unit_relations_child_type` sobre `(child_unit_id, relation_type_id)`. Dicho en cristiano, **una
unidad tiene como mucho un padre por tipo de relación**: el organigrama orgánico es un árbol, no un
grafo cualquiera.

## El diagrama, con todos sus campos

```mermaid
erDiagram
  unit_types ||--o{ units : "clasifica"
  units ||--o{ unit_positions : "tiene sillas"
  cargos ||--o{ unit_positions : "define el rol de"
  units ||--o{ unit_relations : "padre"
  units ||--o{ unit_relations : "hija"
  relation_unit_types ||--o{ unit_relations : "tipo de vinculo"
  unit_positions ||--o{ position_assignments : "ocupada por"
  persons ||--o{ position_assignments : "ocupa"

  unit_types {
    int id PK
    varchar name "Facultad, Carrera, Direccion"
    smallint is_active
    timestamp created_at
  }
  units {
    int id PK
    varchar name "nombre completo"
    varchar label "nombre corto para pantalla"
    varchar slug "identificador en URL"
    int unit_type_id FK
    smallint is_active
    timestamp created_at
    timestamp updated_at
  }
  relation_unit_types {
    int id PK
    varchar code "org"
    varchar name
    varchar description
    smallint is_inheritance_allowed "si hereda permisos hacia abajo"
    smallint is_active
    timestamp created_at
  }
  unit_relations {
    int id PK
    int relation_type_id FK
    int parent_unit_id FK
    int child_unit_id FK
    timestamp created_at
  }
  cargos {
    int id PK
    varchar code "identificador estable, unico"
    varchar name "Decano, Coordinador"
    varchar description
    smallint is_active
    timestamp created_at
    timestamp updated_at
  }
  unit_positions {
    int id PK "LA SILLA"
    int unit_id FK
    int cargo_id FK
    int slot_no "numero de plaza"
    varchar title "titulo propio si difiere del cargo"
    jsonb profile "perfil requerido"
    text position_type "real, promocion, simbolico"
    smallint is_active
    smallint is_unit_head "si dirige la unidad"
    smallint head_flag "generada, garantiza un solo jefe"
    timestamp created_at
    timestamp updated_at
  }
  position_assignments {
    int id PK "LA OCUPACION"
    int position_id FK
    int person_id FK
    date start_date
    date end_date "vacia mientras siga vigente"
    smallint is_current
    smallint current_flag "generada, garantiza una sola vigente"
    timestamp created_at
    timestamp updated_at
  }
  persons {
    int id PK
    varchar cedula "identidad unica"
    varchar first_name
    varchar last_name
    varchar email
    varchar whatsapp
    varchar direccion
    varchar pais
    varchar pais_residencia
    varchar provincia_residencia
    varchar ciudad_residencia
    varchar calle_primaria
    varchar calle_secundaria
    varchar codigo_postal
    varchar password_hash
    text status "Inactivo, Activo, Verificado, Reportado"
    smallint verify_email
    smallint verify_whatsapp
    text photo_url
    smallint is_active
    varchar token "marca de firma en el PDF"
    timestamp created_at
    timestamp updated_at
  }
```

:::note[Un campo que sorprende]

`persons.token` son diez caracteres únicos por persona (`VARCHAR(10) NOT NULL UNIQUE`). No son de
seguridad: son **la marca que se escribe dentro del PDF** para que el firmador sepa exactamente en qué
página y en qué coordenadas estampar la firma de esa persona. Es el hilo que une la organización con
la firma.

:::
