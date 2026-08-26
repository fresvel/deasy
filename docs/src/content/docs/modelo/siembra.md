---
title: "La siembra: de qué parte un sistema vacío"
description: "Qué construye el arranque de una instalación virgen: siete eslabones que son, en miniatura, la cadena entera del modelo."
sidebar:
  label: "1 · La siembra"
  order: 1
---

Una instalación nueva de Deasy no tiene nada. El arranque no siembra datos de prueba sueltos:
**construye el ejemplo mínimo completo de la cadena entera**, y por eso es el mejor sitio para
empezar a entenderla. Hace siete cosas, en este orden, y cada una es un eslabón.

:::note[Esto no es la casilla de «datos de ejemplo»]

La siembra vive en `ensureDefaultProcess`, y la llama `initializeSystem` **siempre** — es decir, en el
`/setup` de una instalación virgen, la marques como la marques. Lo que sí es opcional en ese
formulario es el gestor, el usuario de prueba y los catálogos genéricos. Todo ocurre dentro de **una
sola transacción**: si algo falla, no queda medio sembrado.

:::

1. **Crea un proceso** llamado «Proceso por defecto» (`processes`). Es el cajón para las tareas que no
   pertenecen a ningún proceso formal: «hazme el informe de este evento».
2. **Le da una serie** (`process_definition_series`, con `source_type = 'default'`). La serie es el
   criterio por el que ese proceso se reparte: por tipo de unidad, por cargo, o general.
3. **Le da una configuración activa** (`process_definition_versions`, versión `1.0.0`, con
   `status = 'active'`), que es la versión concreta de sus reglas.
4. **Publica una semilla** (`template_seeds`): el paquete base del que nacen las plantillas, con su
   contrato de campos y su maqueta. En el mismo paso, los campos que declara el `schema.json` del seed
   se vuelcan a `template_artifact_fields` — antes vivían solo como fichero en MinIO.
5. **Crea el entregable y su primera edición publicada** (`deliverables` + `template_artifacts` con
   `lifecycle_state = 'published'`). Aquí aparece la distinción que gobierna todo lo documental: el
   entregable es el *título del libro*, la edición es *una impresión concreta* de ese libro. A
   continuación publica los objetos del seed en MinIO, en dos destinos: el catálogo `Seeds/` y el
   artefacto instanciado en `System/`.
6. **Vincula la configuración con esa edición** (`process_definition_templates`) en modo
   **`routed`**: quien lo use define sobre la marcha quién entrega y quién firma. Por eso este paso
   **no siembra ningún flujo**.
7. **Crea el periodo «Permanente»** (`terms`, del tipo `PERM`), lo declara como tipo de periodo de la
   configuración (`process_definition_period_types`) y añade una regla de reparto
   (`process_target_rules`) con alcance `all_units` y política `all_matches`, para que el proceso
   pueda dispararse en cualquier momento y para cualquiera.

Si esos siete pasos te resultan claros, el resto de estas páginas es el detalle de cada uno.

:::caution[La publicación en MinIO puede abortar el arranque entero]

El paso 5 propaga el error si MinIO no está o el seed no viene empaquetado, y con la transacción
abierta eso deshace todo lo anterior. Es deliberado: lo contrario dejaría filas de
`template_artifacts` apuntando a objetos que no existen. Todos los pasos son idempotentes, así que
repetir el arranque sobre lo ya sembrado no duplica nada.

:::
