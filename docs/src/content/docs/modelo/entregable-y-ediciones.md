---
title: "El entregable y sus ediciones: el libro y sus impresiones"
description: "La distinción que más confusión causa en el modelo documental: el entregable es la identidad de lo que hay que producir, y la edición es la impresión concreta que trae la maqueta, los formatos y los campos."
sidebar:
  label: "5 · Entregable y ediciones"
  order: 5
---

Aquí vive la distinción que más confusión causa si no se nombra bien, así que la nombro con una
metáfora y la sostengo toda la página.

Un **entregable** (`catalogo_documental`) es el *título del libro*: «Informe general de actividades». Es la
identidad de la cosa que hay que producir. No tiene formato, ni campos, ni maqueta — solo nombre
(`code`, `display_name`, `description`) y, si es un entregable personal, quién lo creó
(`owner_person_id`). **De qué semilla nació ya no se guarda aquí**: desde el 2026-10-04 lo que se
guarda es quién produce su PDF, y cuelga de la **edición** (`ediciones.generador_id`), no
del nombre.

**A qué línea de proceso sirve no está escrito aquí**, y desde el 2026-10-04 tampoco en ninguna otra
columna: lo dice el **vínculo** de su edición en `vinculos`, que sabe a qué
configuración está enlazada, y la configuración sabe su proceso y su variación. Hasta esa fecha
`catalogo_documental` llevaba dos columnas con la respuesta copiada —`owner_process_id` y
`owner_variation_key`—; ninguna de las 33 consultas que leen la tabla las seleccionaba, y su único
lector en todo el sistema era un guardia que comprobaba que coincidieran con el vínculo. Se
retiraron las tres cosas.

Que un entregable sirva **a una sola línea** sigue siendo la regla, y ahora la impone la base en vez
de ese guardia: el disparador `trg_pdt_linea_unica`, explicado en
[El vínculo](/modelo/vinculo). Cubre más que el guardia, porque también vigila el clon, los scripts
de siembra y un `INSERT` a mano.

Una **edición** (`ediciones`) es *una impresión concreta* de ese libro: la v1.0.0, la
v1.1.0. Ahí sí está todo lo material: dónde vive su paquete de archivos (`base_object_prefix`), qué
formatos ofrece (`available_formats`), cuál es su huella de contenido (`content_hash`) y **quién
produce su PDF** (`generador_id`).

## Cómo se encadenan y cómo se publican

Las ediciones se encadenan: cada una sabe de cuál desciende (`parent_version_id`, una clave ajena a
la propia tabla). Y tienen el mismo ciclo de tres estados que las configuraciones de proceso
—`lifecycle_state` con `draft`, `published` y `retired`— con la misma regla: **una sola publicada por
entregable**. Publicar una edición retira automáticamente la anterior.

**Cuatro cosas que la base impone**, y la primera de ellas es de hoy:

| | |
|---|---|
| **una sola publicada por entregable** | `uq_ediciones_una_publicada`, sobre la columna generada `publicada_flag` |
| `lifecycle_state` cerrado | `CHECK` con los tres valores, y **nace en `draft`** por defecto |
| la versión no se repite | `uq_ediciones_storage (catalogo_documental_id, storage_version)` |
| la versión **tiene forma de semver** | `CHECK` de tres segmentos: `1.0.0` sí, `1.0` y `v2` no |

El `draft` por defecto es el que falla cerrado: un `INSERT` despistado deja una fila que el control
de activación **rechaza**, en vez de una plantilla publicada que nunca pasó por él.

### La única publicada: cómo se garantiza, y por qué hizo falta

Hasta el **2026-10-11** esta regla la imponía **sólo el código** —`_retirePriorPublishedSiblings`,
llamado desde los dos caminos de publicación—, así que un script, un `INSERT` a mano o un camino
nuevo se la saltaban sin que nada avisara. El lado del **proceso** sí tenía red
(`uq_process_definition_one_active_series`); el de la plantilla no. Era una asimetría que nadie había
visto hasta que se buscó.

**El truco está en el `NULL`.** La columna `publicada_flag` vale `1` sólo cuando la edición está
publicada, y `NULL` en `draft` y en `retired`. Como PostgreSQL **no considera iguales dos `NULL`**,
el índice único deja convivir muchos borradores y muchas retiradas, y admite **una sola publicada**.
Es el mismo patrón que sostiene las otras catorce unicidades condicionales del esquema.

Comprobado provocándolo: publicar una segunda edición del mismo entregable responde
`duplicate key value violates unique constraint "uq_ediciones_una_publicada"`, y un borrador nuevo
sigue entrando sin problema.

⚠️ **Esto vuelve obligatorio el orden «retirar y luego publicar»** — que ya es el que hay, medido en
los dos sitios. Lo que cambia es que un camino que publicara primero **fallaría en el acto** en vez
de dejar dos publicadas.

⚠️ **Y no dice nada sobre a qué configuración está vinculada esa edición publicada, ni a cuántas.**
Eso lo gobierna `vinculos`, y está abierto en el frente 25. Son dos garantías independientes.

:::caution[Una asimetría que conviene conocer]

La regla «una sola configuración activa por línea» **la impone la base**: `active_series_flag` es una
columna generada y `uq_process_definition_one_active_series` la vuelve imposible de violar. La regla
«una sola edición publicada» **solo la sostiene el código** — `retirePriorPublishedSiblings()`, en
`backend/services/admin/templates/templateArtifact.js`, que retira las hermanas publicadas dentro de
la misma transacción en la que publica la nueva.

Comprobado sobre el esquema vigente: hay **ocho** columnas-bandera generadas que respaldan un índice
único parcial de este tipo —en `unit_positions`, `position_assignments`, `vacancies`, `aplications`,
`offers`, `role_assignments`, `process_definition_versions` y `task_item_tenures`— y **ninguna está
en `ediciones`**.

:::

Publicar además tiene una puerta: si la edición no se usa **solo** en modo `routed`, se exige que
tenga al menos un paso de entrega declarado en su recorrido, y si no lo tiene la publicación falla. Las
`routed` se saltan esa comprobación porque no autoran flujo: lo definen al instanciarse.

## El ámbito: oficial o personal

Un entregable declara en `template_scope` si es **oficial** (`official`) —de la institución— o
**personal** (`ad_hoc`), creado por alguien para su propio uso, y entonces `owner_person_id` dice
quién.

**Y desde el 2026-10-11 el ámbito decide algo más: un entregable personal NO puede estar vinculado a
una configuración de proceso.** Lo impiden dos disparadores —uno en `vinculos` y otro aquí, para que
no se rodee cambiando el ámbito después de vincular—, y está contado en
[el vínculo](/modelo/vinculo/). La frase: la institución obliga con su formato, y una persona encarga
con el formato de la institución o con el suyo; un formato privado nunca detrás de una obligación
institucional.

El ámbito no es decorativo tampoco para el flujo: **decide qué resolutores puede usar el que se
autora sobre sus ediciones**. En `official` solo se admiten `task_assignee` («el responsable del entregable») y
`cargo_in_scope` («por cargo»); `ad_hoc` añade `specific_person`, o sea nombrar a una persona
concreta. La lista vive en `WEB_FILL_RESOLVER_TYPES_BY_SCOPE`
(`backend/services/admin/templates/workflows.js`), y por debajo el `CHECK` de
`participantes_declarados.resolver_type` admite exactamente esos tres valores y ninguno más.

## Los campos: qué le van a pedir a quien lo rellene

Los campos de una edición viven en **un fichero**, no en una tabla: el `schema.json` del paquete de
MinIO, dentro de `base_object_prefix`. Lo escribe el editor de `/admin` y lo relee el mismo editor.

:::caution[Aquí había una tabla, y se retiró]

Hubo un `template_artifact_fields` con una fila por campo (`field_order`, `data_key`, `field_code`,
`title`, `ui_component`, `ui_group` y una bandera de obligatoriedad). Nació para ser el esqueleto de un generador que
emitiera el Jinja2 con los tokens de firma ya colocados, uniendo `field_code` con
`participantes_declarados.slot`.

Se retiró en el frente 23 porque **ese generador no se construyó**, y la tabla se quedó sin ningún
consumidor: su único lector en todo el sistema era el código que copiaba sus filas a la versión
siguiente. Existía para copiarse a sí misma. Con ella se fue `ediciones.schema_object_key`,
que era `base_object_prefix` + `schema.json` — un valor derivable, y por tanto una tercera forma de
decir lo mismo. Hoy esa clave se deriva al leer.

**El día que un generador tenga que decirle a la web qué preguntar, ese contrato hará falta** — pero
será otro diseño, no esta tabla de vuelta: colgará del **generador** (uno por servicio, estable) y
no de cada edición de cada plantilla.

:::

## El generador: quién produce el PDF

El catálogo `generadores_de_documento` dice **quién produce** cada tipo de documento, y cada edición
declara el suyo en `generador_id`. Su `tipo` tiene `CHECK` con dos valores y parte el catálogo en dos
mitades excluyentes:

- **`latex`** — trae un paquete de partida en MinIO (`source_path`): un proyecto LaTeX+Jinja2
  completo que se copia entero al crear una plantilla, con su maqueta y su `schema.json`. No llama a
  nadie, así que su `destino` es nulo. Es lo que antes se llamaba «la semilla».
- **`servicio`** — un servicio programado que devuelve el PDF, al que se llama por su `destino`
  (nombre de cola o URL de endpoint). No trae paquete, así que su `source_path` es nulo.

:::note[La semilla no murió: dejó de ser EL mecanismo]

Esta tabla se llamaba `template_seeds` y significaba otra cosa: «la semilla», el esqueleto LaTeX que
**todo** documento tenía que copiar. De ese camino sólo se construyó la copia —no hay renderizador,
ni formulario de llenado, ni editor de campos—, así que exigía escribir `.tex.j2` para definir
cualquier documento. El frente 23 lo desacopló: el llenado web lo harán servicios programados caso a
caso, y la semilla LaTeX se queda como **el primer generador del catálogo**, no como el único camino.

:::

```mermaid
erDiagram
  catalogo_documental ||--o{ ediciones : "tiene ediciones"
  generadores_de_documento ||--o{ ediciones : "produce el PDF de"
  persons ||--o{ catalogo_documental : "autor si es personal"
  ediciones ||--o{ ediciones : "desciende de"

  catalogo_documental {
    int id PK "EL LIBRO"
    varchar code "identificador estable, unico"
    varchar display_name "nombre visible"
    varchar description
    text template_scope "official, ad_hoc"
    int owner_person_id FK "solo si es personal"
    timestamp created_at
  }
  ediciones {
    int id PK "LA EDICION"
    int catalogo_documental_id FK
    varchar storage_version "1.1.0 -- CHECK de semver"
    text lifecycle_state "draft, published, retired -- nace en draft"
    varchar base_object_prefix "carpeta de su paquete"
    jsonb available_formats "pdf, docx, tex"
    int generador_id FK "quien produce el PDF"
    varchar content_hash "huella del paquete"
    int parent_version_id FK "edicion de la que desciende"
    int publicada_flag "generada: 1 si publicada, NULL si no"
    smallint is_active
    timestamp created_at
  }
  generadores_de_documento {
    int id PK "EL CATALOGO DE QUIEN PRODUCE"
    varchar code
    varchar nombre
    varchar description
    text tipo "latex, servicio -- con CHECK"
    varchar destino "cola o endpoint -- nulo si es latex"
    varchar source_path "paquete de partida -- nulo si es servicio"
    varchar preview_path "vista previa"
    smallint is_active
    timestamp created_at
  }
```
