---
title: "El modelo de datos: vocabulario"
description: "Los términos del dominio que hay que tener claros antes de mirar una sola tabla."
sidebar:
  order: 9
---
**67 tablas** y una vista, en un único fichero: `backend/database/postgres_schema.sql` (1.642 líneas).

:::caution[Consecuencia de no tener migraciones]

El esquema entero se reaplica en cada arranque. Es simple y funciona bien sin datos de producción, pero significa que **no puedes hacer un `ALTER TABLE` evolutivo** de forma comoda: cualquier cambio de columna hay que pensarlo como idempotente o pasa por un reset.

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
| **Plantilla**        | El *molde* del documento: schema de campos + cuerpo (Jinja2/LaTeX u ofimatico) + formatos, versionado y almacenado en MinIO.                              | `deliverables` + `template_artifacts`      |
| **Flujo de entrega** | Cadena de pasos “quien llena y aprueba el documento antes de firmarlo”.                                                                                   | `fill_flow_*` / `fill_requests`            |
| **Firma**            | Firma electronica PAdES sobre el PDF, con certificado `.p12` del firmante.                                                                                | `signature_flow_*` / `document_signatures` |
| **Dossier**          | El **expediente o CV personal** (titulos, experiencia, publicaciones). *No* es el expediente de un proceso.                                               | `dossiers` + `dossier_items`               |
