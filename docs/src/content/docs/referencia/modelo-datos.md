---
title: Modelo de datos
description: Las 93 tablas de PostgreSQL, en ocho diagramas por dominio, generados desde el esquema.
sidebar:
  order: 1
---

**Los diagramas y las cifras de esta página se generan; el texto se escribe a mano.** Aquí ponía
«no se escribe: se genera», y las cifras llevaban tiempo desfasadas precisamente porque nadie las
generaba. Ahora las escribe `scripts/docs/gen-mapa-campos.mjs` entre marcas. Los diagramas salen de
`backend/database/postgres_schema.sql` cada vez que corre `scripts/docs/gen-dbml.sh`, y una
puerta de CI impide que el esquema y estos dibujos se separen.

Son **<!-- gen:total-tablas -->93<!-- /gen --> tablas y <!-- gen:total-relaciones -->182<!-- /gen --> relaciones**, repartidas en ocho dominios porque un diagrama
de <!-- gen:total-tablas -->93<!-- /gen --> tablas impresiona y no se lee.

:::note[Cómo leer los diagramas]
Cada dominio muestra **solo las relaciones internas**. Las que salen hacia otros dominios están
listadas como comentario al final de su fichero `.dbml` — si no, cada dominio parecería una isla,
que es justo lo que no es.
:::

:::caution[A ancho de columna no se leen enteros]
Son **imágenes**, no diagramas del sitio, así que el visor con zoom no las alcanza: se encogen al
ancho de la columna, y la de plantillas se queda en torno a 9 px de letra. Cada una lleva debajo su
enlace para abrirla a tamaño real.

Para leer las tablas **con todos sus campos, agrupadas como en los mapas y con zoom**, están
[el mapa completo con todos sus campos](/modelo/mapa-con-campos/) y
[el del complemento](/complemento/mapa-con-campos/), que se generan del mismo esquema.
:::

## Identidad, personas y RBAC

Quién es cada quien y qué puede hacer. `persons` es la identidad única del sistema; el expediente
(dossier) cuelga de ella. **<!-- gen:tablas-dominio:identidad -->34<!-- /gen --> tablas.**

![Diagrama del dominio de identidad](/diagramas/identidad.svg)

[Abrir a tamaño real](/diagramas/identidad.svg)

## Unidades, puestos y ocupación

El organigrama: unidades, cómo se relacionan entre sí, qué puestos tienen y quién los ocupa.
**<!-- gen:tablas-dominio:organizacion -->13<!-- /gen --> tablas.**

![Diagrama del dominio de organización](/diagramas/organizacion.svg)

[Abrir a tamaño real](/diagramas/organizacion.svg)

## Motor de procesos

Serie → regla → flujo. La **serie** nombra el proceso, la **regla** reparte su alcance y el
**flujo** reparte los pasos. `process_runs` es cada lanzamiento. **<!-- gen:tablas-dominio:procesos -->9<!-- /gen --> tablas.**

![Diagrama del motor de procesos](/diagramas/procesos.svg)

[Abrir a tamaño real](/diagramas/procesos.svg)

## Plantillas y entregables

El modelo «libro y ediciones»: `deliverables` porta la identidad estable y `template_artifacts`
las versiones. Aquí vive también la autoría del flujo de llenado. **<!-- gen:tablas-dominio:plantillas -->8<!-- /gen --> tablas.**

![Diagrama del dominio de plantillas](/diagramas/plantillas.svg)

[Abrir a tamaño real](/diagramas/plantillas.svg)

## Tareas, entregables instanciados y documentos

Lo que se genera al lanzar un proceso: tareas, sus entregables (`task_items`) y los documentos
producidos. Es donde converge todo: tiene **<!-- gen:relaciones-fuera:tareas -->28<!-- /gen --> relaciones con otros dominios**.
**<!-- gen:tablas-dominio:tareas -->8<!-- /gen --> tablas.**

![Diagrama del dominio de tareas](/diagramas/tareas.svg)

[Abrir a tamaño real](/diagramas/tareas.svg)

## Firma electrónica

Plantilla de flujo, instancia, pasos y peticiones. Los lotes los procesa el microservicio
`signer` por RabbitMQ. **<!-- gen:tablas-dominio:firmas -->7<!-- /gen --> tablas.**

![Diagrama del dominio de firmas](/diagramas/firmas.svg)

[Abrir a tamaño real](/diagramas/firmas.svg)

## Chat y notificaciones

Mensajería en tiempo real sobre Socket.IO. **<!-- gen:tablas-dominio:chat -->6<!-- /gen --> tablas.**

:::note[El chat SÍ tiene claves ajenas hacia fuera]
Aquí ponía que no tenía ninguna: que `chat_conversation_participants.person_id`,
`chat_messages.sender_person_id` y `chat_notifications.recipient_person_id` referenciaban personas
sin restricción, y que lo mismo pasaba con `dossiers.person_id`. **Dejó de ser verdad con TD7-c3**
(2026-08-24), que les puso clave ajena. Hoy el chat tiene
**<!-- gen:relaciones-fuera:chat -->10<!-- /gen --> relaciones con otros dominios** —hacia `persons`, `units`,
`processes` y `process_definition_versions`—, y `dossiers.person_id` también tiene la suya.

Lo único que sigue sin restricción, a propósito, es `chat_conversations.last_message_id`: con clave
ajena habría un ciclo entre la conversación y su último mensaje.
:::

![Diagrama del dominio de chat](/diagramas/chat.svg)

[Abrir a tamaño real](/diagramas/chat.svg)

## Vacantes, postulaciones y contratos

El ciclo de contratación: vacante, postulación, oferta y contrato, con el origen del contrato
desglosado. **<!-- gen:tablas-dominio:empleo -->8<!-- /gen --> tablas.**

![Diagrama del dominio de empleo](/diagramas/empleo.svg)

[Abrir a tamaño real](/diagramas/empleo.svg)

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
