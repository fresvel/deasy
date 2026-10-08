# Frente 24 · El recorrido documental, unificado — y el fin de cuatro «plantillas»

> **Estado**: 🟡 en ejecución · abierto el **2026-10-08** · worktree `deasy-recorrido`, pila **B**
> **Decidido por el dueño** el 2026-10-08 tras el análisis de la decisión 1 de F7.0 (frente 22).

## 0 · Control de ejecución

| # | Fase | Qué entrega | Evidencia | Estado |
|---|---|---|---|:--:|
| **1** | Los tres renombrados | `deliverables`→`catalogo_documental` · `template_artifacts`→`ediciones` · `process_definition_templates`→`vinculos` | las 6 puertas + char 321/321 | ⬜ |
| **2** | Muere el escalón 2 | fuera `process_definition_template_id` de las cabeceras, fuera su campo en `/admin`, fuera el escalón del resolvedor | el resolvedor baja de 3 escalones a 2 | ⬜ |
| **3** | El vocabulario de estado | **un** mecanismo y **un** idioma para los 6 estados; mueren `signature_request_statuses` y su `status_id` | los goldens se mueven, y ese diff ES la prueba | ⬜ |
| **4** | E1 · la unificación | 6 tablas → 3: `pasos_declarados`, `recorridos`, `turnos`, con `lado` | el resolvedor pasa de 2 funciones a 1 | ⬜ |
| **5** | La documentación publicada | DBML + 8 diagramas + `campos-*` regenerados, y las páginas de prosa reescritas | `check-doc-modelo` y `gen-dbml --check` en verde | ⬜ |

## 1 · Por qué, en una frase

Cuatro tablas se llamaban «plantilla», el recorrido documental estaba **partido en dos mitades
simétricas** con dos tablas idénticas de cabecera que no llevaban datos, y la resolución de cuál
recorrido aplica se hacía con **tres escalones, tres guardas `IS NULL` y un `ORDER BY id DESC`**
porque no había ninguna unicidad declarada.

## 2 · Los nombres

| Antes | Ahora | Qué es |
|---|---|---|
| `deliverables` | **`catalogo_documental`** | qué documento es: código, nombre, official/ad_hoc |
| `template_artifacts` | **`ediciones`** | el fichero con su versión y su estado de publicación |
| `process_definition_templates` | **`vinculos`** | una edición usada en una configuración de proceso, con su `item_mode` |
| `fill_flow_templates` · `signature_flow_templates` | **se eliminan** | cabeceras sin datos |
| `fill_flow_steps` · `signature_flow_steps` | **`pasos_declarados`** | la receta: quién pasa, en qué orden, por qué lado |
| `document_fill_flows` · `signature_flow_instances` | **`recorridos`** | el recorrido en marcha sobre una versión documental |
| `fill_requests` · `signature_requests` | **`turnos`** | a quién le toca ahora |
| `signature_request_statuses` | **se elimina** | el vocabulario pasa a un `CHECK` |

⚠️ **`documentos_tipo` se descartó** porque `tipo` ya significa la clase de un documento de identidad
(`documentos_identidad.tipo`, con su `CHECK`). Y **`formatos` se descartó** para la edición porque
`available_formats` ya usa «formato» con el sentido de pdf/docx.

⚠️ **Por qué `pasos_declarados` y no `pasos_de_recorrido`:** porque contrasta con `turnos`. Lo
declarado es la receta; el turno es lo que de verdad le tocó a alguien. Y evita que dos tablas de la
cadena lleven la palabra «recorrido».

## 3 · E1 · Un solo recorrido con dos lados

```
  catalogo_documental ──▶ ediciones ──▶ vinculos (item_mode)
                              │             │
            ┌─────────────────┴──┐          │  item_mode decide DE DÓNDE sale la receta:
            │                    │          │    single / replicated ──▶ origen = edición
            ▼                    ▼          ▼    routed             ──▶ origen = instancia
   pasos_declarados (lado: entrega | firma)
            │  origen: edicion_id XOR task_item_id
            │  UNIQUE parcial por origen, lado y orden   ← la unicidad que NO existía
            ▼  al enviar
      recorridos (document_version_id, lado, estado, paso_actual)
            │
            ▼
        turnos (recorrido_id, paso_id, persona_id, estado)
```

**`routed` no se toca**: es `origen = instancia`. Lo único que desaparece es que tenga que escribir
**dos** anclas a la vez, que es lo que obligaba a las tres guardas `IS NULL`.

## 4 · Lo que esto cierra, medido antes de tocar nada

| Hallazgo | Medida |
|---|---|
| El escalón 2 (del vínculo) está **muerto** | nadie lo escribe; su productor (`meta.yaml` + `WorkflowSyncService`) se borró en el §0.8; y la puerta de publicación lo **excluye** con `process_definition_template_id IS NULL` |
| La cabecera **no es una entidad** | su `name` no se lee en ninguna consulta del backend, y en `routed` es el literal fijo `'Entrega (definida al enviar)'` |
| No hay unicidad | **cero** índices únicos en las tres anclas; el código compensa con `ORDER BY id DESC LIMIT 1` |
| Los dos lados son **el mismo mecanismo** | `flowRows.js` ya los resuelve con **una** función y un mapa `HEADER_TABLES[side]` |
| Y el código lo demuestra dos veces | los dos resolvedores de escalones son **44 líneas idénticas de 50**, en ficheros de dominios distintos |
| Sentencias gemelas | de las 96 (48 por lado), **10 son byte a byte la misma** normalizando el lado |

## 5 · Las decisiones que tomo yo, y por qué

**5.1 · El estado va en `CHECK`, no en tabla de catálogo.** La asimetría medida es que entrega usa
`status TEXT` con `CHECK` y firma un `status_id` contra `signature_request_statuses`. Se unifica en
`CHECK` **porque el repositorio ya tomó esa decisión y escribió el motivo** —en
`DocumentoIdentidadService`: *«Antes esto era una CONSULTA: el tipo vivía en una tabla y había que
resolver el código contra ella. Con el vocabulario cerrado en un CHECK, validar es comparar contra
tres cadenas — sin red, sin base y sin poder equivocarse de catálogo»*—, y porque `item_mode`,
`lifecycle_state`, `template_scope`, `resolver_type` y `unit_scope_type` ya son `CHECK`.

⚠️ **`signature_statuses` NO se toca**: es el estado del **hecho** de firmar
(`document_signatures.signature_status_id`), no el de la solicitud. Es otra cosa.

**5.2 · El vocabulario queda en ESPAÑOL**, igual que los nombres de tabla que se acaban de decidir:
`pendiente`, `en_progreso`, `completado`, `rechazado`, `devuelto`, `cancelado`. Entrega usaba inglés
(`pending`…) y firma español; con dos idiomas en una columna no se puede. `devuelto` sólo es legal en
el lado de entrega, y eso se declara con un `CHECK` por lado.

⚠️ **Esto mueve goldens, y es correcto que los mueva**: no es un refactor, es un cambio de modelo, y
el diff del golden **es** la prueba del cambio. Es la única fase de este frente donde eso vale.

**5.3 · Las columnas propias de un lado se quedan como columnas, acotadas por `CHECK`** — no van a
JSONB. Se evaluó el modelo del dosier (base común + `data` JSONB) y se descartó midiendo: de las
columnas del paso, **24 aparecen en JOIN** —`unit_id`, `position_id`, `cargo_id`,
`assigned_person_id`…— y **seis tienen `CHECK`**. Y el único campo del paso que ya es JSONB,
`signature_flow_steps.signers`, es **el defecto 1.19**: nadie lo valida y manda sobre la columna
`resolver_type` que sí tiene `CHECK`. El dosier puede permitírselo porque su `data` **nunca se
consulta por dentro** —cero `data->`, cero índices— y aquí el contenido decide **quién firma**.

## 6 · Lo que NO hace este frente

- **No toca `signature_batch_jobs`** ni el firmado por lotes: es otro asunto.
- **No decide dónde vive el código** del recorrido. Eso es F7.5 del frente 22, y este frente le
  quita de encima la decisión 1 de F7.0: con un solo recorrido, la pregunta «¿de qué dominio es la
  mitad de entrega?» desaparece.
- **No arregla el defecto 1.19** (`signers` en JSONB). Lo deja nombrado como prerrequisito de
  cualquier movimiento futuro hacia JSONB.
