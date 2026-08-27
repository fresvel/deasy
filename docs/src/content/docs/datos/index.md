---
title: "El modelo de datos: vocabulario"
description: "Los términos del dominio que hay que tener claros antes de mirar una sola tabla."
sidebar:
  order: 0
---
**74 tablas** y una vista, en un único fichero: `backend/database/postgres_schema.sql` (**2 266 líneas**).

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
| **Plantilla**        | El *molde* del documento: schema de campos + cuerpo (Jinja2/LaTeX u ofimatico) + formatos, versionado y almacenado en MinIO. **Son tres tablas, no una**: ver abajo. | `deliverables` + `template_artifacts` + `process_definition_templates` |
| **Flujo de entrega** | Cadena de pasos “quien llena y aprueba el documento antes de firmarlo”.                                                                                   | `fill_flow_*` / `fill_requests`            |
| **Firma**            | Firma electronica PAdES sobre el PDF, con certificado `.p12` del firmante.                                                                                | `signature_flow_*` / `document_signatures` |
| **Dossier**          | El **expediente o CV personal** (titulos, experiencia, publicaciones). *No* es el expediente de un proceso.                                               | `dossiers` + `dossier_items`               |

### Los cuatro nombres de “entregable”, que son cuatro cosas distintas

Esta es la confusion que mas tiempo cuesta en este repositorio, y **no es sinonimia**: cada nombre es un eslabon distinto. Leer `artifact` donde el codigo dice `template_artifact` y creer que habla del entregable de una persona lleva media tarde de despiste.

| **Nombre en el codigo** | **Que es** | **Donde vive** |
|:---|:---|:---|
| `deliverable` | El entregable como **tipo**: su identidad institucional, su codigo y su dueno. *No es un archivo.* | `deliverables` |
| `template_artifact` | Una **edicion** de ese tipo, con sus ficheros en MinIO y su ciclo de vida (`draft` / `published` / `retired`). El codigo lo abrevia `artifact`; no hay ninguna tabla `artifacts`. | `template_artifacts` |
| `process_definition_template` | El **vinculo** entre una configuracion de proceso y una edicion. **Aqui vive `item_mode`**: por eso la misma plantilla puede emitirse de tres maneras segun a que proceso este enlazada. | `process_definition_templates` |
| `task_item` | La **instancia con dueno**: lo que una persona concreta tiene que entregar. Es la tarjeta que el usuario ve en su Home. | `task_items` |

Y un quinto eslabon antes de todos, la `template_seed`: la plantilla de fabrica de la que nace el entregable. La cadena completa, de molde a documento firmado:

`seed` → `deliverable` → `template_artifact` → (vinculo) → `task_item` → `document_version` → `document_version_upload`

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
