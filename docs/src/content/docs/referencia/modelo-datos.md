---
title: Modelo de datos
description: Las 74 tablas de PostgreSQL, en ocho diagramas por dominio, generados desde el esquema.
sidebar:
  order: 1
---

Esta página **no se escribe: se genera.** Los diagramas salen de
`backend/database/postgres_schema.sql` cada vez que corre `scripts/docs/gen-dbml.sh`, y una
puerta de CI impide que el esquema y estos dibujos se separen.

Son **74 tablas y 158 relaciones**. Repartidas en ocho dominios porque un diagrama de 74 tablas
impresiona y no se lee.

:::note[Cómo leer los diagramas]
Cada dominio muestra **solo las relaciones internas**. Las que salen hacia otros dominios están
listadas como comentario al final de su fichero `.dbml` — si no, cada dominio parecería una isla,
que es justo lo que no es.
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

## Explorar el modelo de forma interactiva

Los diagramas de arriba son estáticos: buenos para leer un dominio de un vistazo, inútiles para
seguir una relación de punta a punta. Para eso está **Azimutt**, autoalojado en la propia pila
(licencia MIT, ningún servicio externo):

```bash
bash scripts/stack.sh c --profile explorer up -d azimutt   # la app  -> http://localhost:4900
npx -y azimutt@latest gateway                              # la pasarela, en el host -> :4177
```

Hacen falta **las dos piezas**. El navegador no puede hablar con una base, así que Azimutt lee el
esquema a través de una pasarela; si no levantas la tuya, usa la alojada por ellos y tu cadena de
conexión sale de tu máquina. La pasarela local lo evita.

Luego se elige **«From database connection»** — no «From SQL structure», que solo da una foto que
hay que reimportar a mano. La cadena de conexión de cada pila está en `CLAUDE.md`, que no se
publica.

Dentro puedes quedarte solo con lo que te interesa: los **layouts** son vistas con nombre (admiten
carpetas con `/`), empiezan vacíos y vas añadiendo tablas por búsqueda o siguiendo relaciones; con
click derecho sobre varias tablas creas **grupos** de color; y los **memos** son notas en Markdown
sobre el propio diagrama.

Va detrás del perfil `explorer` a propósito: son **dos contenedores** (la aplicación necesita su
propia base) y es una herramienta que se abre de vez en cuando, no parte de la aplicación.

Su base es **propia y separada** de la del proyecto: `test:char:run` resetea la base de dev, y con
ella se llevaría por delante los diagramas que hayas guardado.

:::caution[Azimutt no garantiza estar al día]
Lee en vivo **cuando refrescas la fuente**, que es un clic; y un layout guardado no incorpora
tablas nuevas por su cuenta. Quien garantiza que el esquema y su documentación no se separen es la
puerta de CI de los diagramas generados, no esta herramienta. Azimutt es para *explorar*.
:::

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
