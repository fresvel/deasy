---
title: Modelo de datos
description: Las 67 tablas de PostgreSQL, en ocho diagramas por dominio, generados desde el esquema.
sidebar:
  order: 1
---

Esta página **no se escribe: se genera.** Los diagramas salen de
`backend/database/postgres_schema.sql` cada vez que corre `scripts/docs/gen-dbml.sh`, y una
puerta de CI impide que el esquema y estos dibujos se separen.

Son **67 tablas y 139 relaciones**. Repartidas en ocho dominios porque un diagrama de 67 tablas
impresiona y no se lee.

:::note[Cómo leer los diagramas]
Cada dominio muestra **solo las relaciones internas**. Las que salen hacia otros dominios están
listadas como comentario al final de su fichero `.dbml` — si no, cada dominio parecería una isla,
que es justo lo que no es. El `.dbml` completo se abre en [dbdiagram.io](https://dbdiagram.io)
para explorarlo de forma interactiva.
:::

## Identidad, personas y RBAC

Quién es cada quien y qué puede hacer. `persons` es la identidad única del sistema; el expediente
(dossier) cuelga de ella. **15 tablas.**

![Diagrama del dominio de identidad](/diagramas/identidad.svg)

## Unidades, puestos y ocupación

El organigrama: unidades, cómo se relacionan entre sí, qué puestos tienen y quién los ocupa.
**6 tablas.**

![Diagrama del dominio de organización](/diagramas/organizacion.svg)

## Motor de procesos

Serie → regla → flujo. La **serie** nombra el proceso, la **regla** reparte su alcance y el
**flujo** reparte los pasos. `process_runs` es cada lanzamiento. **9 tablas.**

![Diagrama del motor de procesos](/diagramas/procesos.svg)

## Plantillas y entregables

El modelo «libro y ediciones»: `deliverables` porta la identidad estable y `template_artifacts`
las versiones. Aquí vive también la autoría del flujo de llenado. **7 tablas.**

![Diagrama del dominio de plantillas](/diagramas/plantillas.svg)

## Tareas, entregables instanciados y documentos

Lo que se genera al lanzar un proceso: tareas, sus entregables (`task_items`) y los documentos
producidos. Es el dominio con más relaciones hacia fuera — 34 — porque es donde converge todo.
**9 tablas.**

![Diagrama del dominio de tareas](/diagramas/tareas.svg)

## Firma electrónica

Plantilla de flujo, instancia, pasos y peticiones. Los lotes los procesa el microservicio
`signer` por RabbitMQ. **7 tablas.**

![Diagrama del dominio de firmas](/diagramas/firmas.svg)

## Chat y notificaciones

Mensajería en tiempo real sobre Socket.IO. **6 tablas.**

:::caution[Este dominio no tiene ni una clave ajena hacia fuera]
No es que esté aislado por diseño: `chat_conversation_participants.person_id`,
`chat_messages.sender_person_id` y `chat_notifications.recipient_person_id` **referencian personas
sin ninguna restricción que lo garantice**. Nada impide un participante huérfano. Lo mismo pasa con
`dossiers.person_id`. Salió al dibujar los diagramas y está anotado como pendiente del plan de datos.
:::

![Diagrama del dominio de chat](/diagramas/chat.svg)

## Vacantes, postulaciones y contratos

El ciclo de contratación: vacante, postulación, oferta y contrato, con el origen del contrato
desglosado. **8 tablas.**

![Diagrama del dominio de empleo](/diagramas/empleo.svg)

## Cómo se regenera

```bash
bash scripts/docs/gen-dbml.sh
```

Levanta un PostgreSQL desechable, le aplica el esquema, lo introspecciona y reescribe el `.dbml`
consolidado, los ocho por dominio y los ocho SVG. No toca ninguna pila y no publica puertos.

De paso **valida que `postgres_schema.sql` aplica de verdad** — algo que hasta ahora no comprobaba
nadie, porque para Node el SQL es una cadena de texto.

Si quieres explicar qué *significa* una tabla o una columna, eso sí se escribe a mano, y va en
`docs/02-dominio-datos/anotaciones.json`. El generador lo inyecta como nota en el diagrama y falla
si nombras algo que no existe.
