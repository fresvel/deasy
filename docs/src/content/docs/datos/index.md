---
title: "El modelo de datos: vocabulario"
description: "Los términos del dominio que hay que tener claros antes de mirar una sola tabla."
sidebar:
  order: 0
---
**90 tablas** y una vista, en un único fichero: `backend/database/postgres_schema.sql` (**2 566 líneas**).

:::caution[El esquema describe la forma; no migra]

El fichero declara **cada columna una sola vez**, dentro de su `CREATE TABLE`. El arranque lo reaplica entero, pero `CREATE TABLE IF NOT EXISTS` no toca una tabla que ya existe: **una base con forma vieja no se pone al día sola, se recrea** (`node scripts/reset.mjs db`).

No hay `ALTER TABLE` evolutivo, y es deliberado desde el 2026-08-24. Antes los había —20 operaciones idempotentes repartidas entre las tablas— y el precio fue que la misma columna acabara declarada **dos veces y en contradicción**. Mientras no exista una base declarada como validada, recrear sale más barato que mantener dos versiones de la verdad.

:::

## Vocabulario del dominio

| **Termino**          | **Que es en Deasy**                                                                                                                                       | **Donde vive**                             |
|:---------------------|:----------------------------------------------------------------------------------------------------------------------------------------------------------|:-------------------------------------------|
| **Proceso**          | El tramite institucional en abstracto (“Informe de Gestion Docente”). Es solo un nombre y una jerarquía; el comportamiento esta en sus *configuraciones*. | `processes`                                |
| **Configuración**    | La versión vigente del proceso: a quien alcanza, en que periodos corre, que entregables produce. Se activa y se retira.                                   | `process_definition_versions`              |
| **Serie**            | El *eje* por el que un proceso se declina: por tipo de unidad, por cargo, o `default` (sin variación).                                                    | `process_definition_series`                |
| **Regla**            | Quien recibe el proceso: que unidades, que cargo o puesto, con que política de reparto.                                                                   | `process_target_rules`                     |
| **Corrida (run)**    | El acto de *lanzar* la configuración en un periodo. Genera las tareas.                                                                                    | `process_runs`                             |
| **Tarea**            | La instancia del proceso para un ámbito concreto (una unidad, un periodo). Es el contenedor.                                                              | `tasks`                                    |
| **Entregable**       | Cada documento concreto a producir dentro de la tarea, con responsable, vencimiento y estado.                                                             | `task_items`                               |
| **Plantilla**        | El *molde* del documento: su `schema.json` de campos + cuerpo (Jinja2/LaTeX u ofimatico) + formatos, versionado y almacenado en MinIO. **Son tres tablas, no una**: ver abajo. | `catalogo_documental` + `ediciones` + `vinculos` |
| **Flujo de entrega** | Cadena de pasos “quien llena y aprueba el documento antes de firmarlo”.                                                                                   | `fill_flow_*` / `fill_requests`            |
| **Firma**            | Firma electronica PAdES sobre el PDF, con certificado `.p12` del firmante.                                                                                | `signature_flow_*` / `document_signatures` |
| **Dossier**          | El **expediente o CV personal** (titulos, experiencia, publicaciones). *No* es el expediente de un proceso.                                               | `dossiers` + `dossier_items`               |

### Los cuatro eslabones de “entregable”, que son cuatro cosas distintas

Esta era **la confusion que mas tiempo costaba en este repositorio**: cuatro tablas distintas se
llamaban «plantilla» o «entregable» segun quien hablara. Desde el **2026-10-08** cada eslabon se llama
como lo que es, y esta tabla es el mapa — incluido **el nombre viejo**, porque la prosa anterior a esa
fecha lo usa.

| **Tabla** | **Que es** | **Se llamaba** |
|:---|:---|:---|
| `catalogo_documental` | El entregable como **tipo**: su identidad institucional y su codigo. *No es un archivo*, y desde el 2026-10-04 tampoco lleva escrito a que linea de proceso sirve: eso lo dice su vinculo. | `deliverables` |
| `ediciones` | Una **edicion** de ese tipo, con sus ficheros en MinIO y su ciclo de vida (`draft` / `published` / `retired`). | `template_artifacts`, que el codigo abreviaba `artifact` |
| `vinculos` | El **vinculo** entre una configuracion de proceso y una edicion. **Aqui vive `item_mode`**: por eso la misma edicion puede emitirse de tres maneras segun a que proceso este enlazada. | `process_definition_templates` |
| `task_items` | La **instancia con dueno**: lo que una persona concreta tiene que entregar. Es la tarjeta que el usuario ve en su Home. | — |

⚠️ **Por que no se llaman `documentos_tipo` ni `formatos`**, que fueron las dos primeras propuestas:
`tipo` ya significa la clase de un documento de identidad (`documentos_identidad.tipo`, con su
`CHECK`), y `formato` ya significa pdf/docx (`ediciones.available_formats`). Un nombre que colisiona
con otro que ya existe no resuelve una confusion: la mueve.

Y un quinto eslabon al lado de la edicion, el **generador** (`generadores_de_documento`): **quien
produce el PDF**. Lo declara `ediciones.generador_id`, y de `tipo = 'latex'` es tambien la plantilla de
fabrica cuyo paquete se copia al crear el entregable. Se llamaba `template_seed` y era *el* mecanismo;
desde el frente 23 es *uno* de los generadores posibles. La cadena completa, de molde a documento
firmado:

`catalogo_documental` → `ediciones` (← `generador`) → `vinculos` → `task_items` → `document_versions` → `document_version_uploads`

:::caution[Y “documento” tampoco es lo que parece]

**La tabla `documents` ya no existe.** Se retiró el **2026-08-23**: era una cáscara 1:1 sobre
`task_items` **sin ni una columna propia**, y `postgres_schema.sql` le deja epitafio en el sitio
donde estaba. Lo que se produce cuelga hoy **directamente del entregable**, en dos niveles:

| Nivel | Tabla | Qué es |
|---|---|---|
| **Ronda** | `document_versions` | Un intento completo del ciclo llenar → firmar. Lleva `working_file_path` (el que se está trabajando) y `final_file_path` (el firmado) |
| **Corrección** | `document_version_uploads` | Cada vez que se sube el archivo dentro de la misma ronda, **con su autor** |

`document_versions.task_item_id` es la clave: la ronda cuelga del entregable, no de un documento
intermedio.

⚠️ **Y con la tabla se cayó la frase que había aquí.** Decía que «"tiene documento" significa *se
lanzó el proceso*, no *alguien empezó a trabajar*», y que eso dejó **tres** relevos automáticos sin
ejecutarse. Hoy los caminos de relevo son **cuatro**, y la señal de trabajo empezado sigue siendo
`task_items.user_started_at`. El detalle, en
[Quién lo debe](/modelo/tenencias-y-relevo/) y en [El documento](/modelo/documento/).

:::
