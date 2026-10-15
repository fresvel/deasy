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
2. **Le da su LÍNEA** (`lineas`): la obligación en sí, con los dos ejes juntos. La del «Proceso por
   defecto» es *«cualquier cargo, en todas las unidades»* —`cargo_id` vacío y
   `unit_scope_type = 'all_units'` **en su línea**—, porque un memo lo escribe quien lo necesita
   donde lo necesita. La regla que el arranque crea no declara alcance ninguno desde el 2026-10-14:
   lo hereda de la obligación.
   Aquí se sembraba antes una **serie**, que se retiró el 2026-10-11: el porqué está en
   [el proceso](/modelo/proceso/).

3. **Le da una configuración activa** (`process_definition_versions`, versión `1.0.0`, con
   `status = 'active'`), que es la versión concreta de sus reglas.
4. **Registra el primer generador del catálogo** (`generadores_de_documento`, de `tipo = 'latex'`):
   el paquete base del que nacen las plantillas, con su maqueta y su contrato de campos. Es la
   «semilla» de siempre; lo que cambió en el frente 23 es que ya no es *el* mecanismo sino *uno* de
   los generadores posibles. Los campos que declara su `schema.json` **se quedan en el fichero**: la
   tabla que los reflejaba se retiró por no tener ningún consumidor.
5. **Crea el entregable y su primera edición publicada** (`catalogo_documental` + `ediciones` con
   `lifecycle_state = 'published'`). Aquí aparece la distinción que gobierna todo lo documental: el
   entregable es el *título del libro*, la edición es *una impresión concreta* de ese libro. A
   continuación publica los objetos del seed en MinIO, en dos destinos: el catálogo `Seeds/` y el
   artefacto instanciado en `System/`.
6. **Vincula la configuración con esa edición** (`vinculos`) en modo
   **`routed`**: quien lo use define sobre la marcha quién entrega y quién firma. Por eso este paso
   **no siembra ningún flujo**.
7. **Crea el periodo «Permanente»** (`terms`, del tipo `PERM`), lo declara como tipo de periodo de la
   configuración (`process_definition_period_types`) y añade una regla de reparto
   (`process_target_rules`) con política `all_matches` —el alcance lo pone su línea, `all_units`—, para que el proceso
   pueda dispararse en cualquier momento y para cualquiera.

Si esos siete pasos te resultan claros, el resto de estas páginas es el detalle de cada uno.

:::caution[La publicación en MinIO puede abortar el arranque entero]

El paso 5 propaga el error si MinIO no está o el seed no viene empaquetado, y con la transacción
abierta eso deshace todo lo anterior. Es deliberado: lo contrario dejaría filas de
`ediciones` apuntando a objetos que no existen. Todos los pasos son idempotentes, así que
repetir el arranque sobre lo ya sembrado no duplica nada.

:::
