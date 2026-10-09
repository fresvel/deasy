---
title: Modelo de datos
description: Las 95 tablas de PostgreSQL, en ocho diagramas por dominio, generados desde el esquema.
sidebar:
  order: 1
---

**Los diagramas y las cifras de esta página se generan; el texto se escribe a mano.** Aquí ponía
«no se escribe: se genera», y las cifras llevaban tiempo desfasadas precisamente porque nadie las
generaba. Ahora las escribe `scripts/docs/gen-mapa-campos.mjs` entre marcas. Los diagramas salen de
`backend/database/postgres_schema.sql` cada vez que corre `scripts/docs/gen-dbml.sh`, y una
puerta de CI impide que el esquema y estos dibujos se separen.

Son **<!-- gen:total-tablas -->95<!-- /gen --> tablas y <!-- gen:total-relaciones -->185<!-- /gen --> relaciones**, repartidas en ocho dominios porque un diagrama
de <!-- gen:total-tablas -->95<!-- /gen --> tablas impresiona y no se lee.

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
**flujo** reparte los pasos. Todo esto es **declaración**: nada ha ocurrido todavía. El lanzamiento
(`process_runs`) se dibuja desde el 2026-10-04 en el dominio de tareas, que es donde ocurren las
cosas. **<!-- gen:tablas-dominio:procesos -->8<!-- /gen --> tablas.**

![Diagrama del motor de procesos](/diagramas/procesos.svg)

[Abrir a tamaño real](/diagramas/procesos.svg)

## Plantillas y entregables

El modelo «libro y ediciones»: `catalogo_documental` porta la identidad estable y `ediciones`
las versiones. Aquí vive también la autoría del flujo de llenado. **<!-- gen:tablas-dominio:plantillas -->9<!-- /gen --> tablas.**

![Diagrama del dominio de plantillas](/diagramas/plantillas.svg)

[Abrir a tamaño real](/diagramas/plantillas.svg)

## Tareas, entregables instanciados y documentos

Lo que se genera al lanzar un proceso: la corrida (`process_runs`), sus tareas, los entregables
(`task_items`) y los documentos producidos. Es donde converge todo: tiene
**<!-- gen:relaciones-fuera:tareas -->31<!-- /gen --> relaciones con otros dominios**.
**<!-- gen:tablas-dominio:tareas -->11<!-- /gen --> tablas.**

![Diagrama del dominio de tareas](/diagramas/tareas.svg)

[Abrir a tamaño real](/diagramas/tareas.svg)

## Firma electrónica

Plantilla de flujo, instancia, pasos y peticiones. Los lotes los procesa el microservicio
`signer` por RabbitMQ. **<!-- gen:tablas-dominio:firmas -->6<!-- /gen --> tablas.**

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

## Los ocho niveles: qué puede depender de qué

Los ocho dominios agrupan por **dominio**, para que un diagrama se pueda leer. No dicen **qué rompe
qué**, y ésa es otra pregunta. Para eso cada tabla declara además su **nivel**, de 0 abajo a 7 arriba:

| Nivel | Qué vive aquí |
|---|---|
| **0 · catálogos y territorio** | Lo que no cambia y de lo que depende todo el mundo: la cadena país → provincia → cantón → parroquia, la institución y las listas cerradas |
| **1 · identidad** | La persona y lo que es suyo: documento, domicilio, teléfonos, correos, expediente |
| **2 · organización** | El organigrama: unidades, puestos y quién los ocupa |
| **3 · acceso** | Roles, permisos y credenciales |
| **4 · declaración** | Lo que alguien declara que debe ocurrir: procesos, reglas, periodos, plantillas |
| **5 · ejecución** | Lo que ocurre: la corrida, las tareas, los entregables y sus documentos |
| **6 · flujos** | Entrega y firma, con su rastro |
| **7 · encima** | Conversación y empleo: se apoyan en todo lo anterior y nada depende de ellos |

**La regla es una sola: una clave ajena puede apuntar a su propio nivel o a uno inferior, nunca a una
superior.** Medido sobre las <!-- gen:total-relaciones -->185<!-- /gen --> relaciones del esquema: 102 bajan de nivel, 77 se quedan
en la suya y **ninguna sube**. Lo comprueba `scripts/docs/check-mapa-tablas.mjs`.

Dos cosas que los niveles enseñan y que ningún diagrama por dominio decía:

**El acceso va ENCIMA de la organización, no al lado.** Un rol se asigna *dentro de* una unidad
(`role_assignments.unit_id`, `role_assignments.derived_from_assignment_id`). Así que quien cambia el
organigrama puede romper los permisos de alguien; al contrario no pasa nunca.

**El dominio de identidad son en realidad tres cosas apiladas.** Sus 34 tablas se reparten entre la
nivel 0 (los catálogos: género, estado civil, parentesco…), la 1 (la persona) y la 3 (el acceso). Por
eso era el diagrama más difícil de leer: no es un dominio, son tres.

El reparto completo —qué tabla está en qué módulo y en qué nivel— vive en `scripts/docs/dominios.json`,
que es la **fuente única**: de ahí salen los diagramas, estas cifras y las comprobaciones.

## El dominio no es una etiqueta: es una carpeta dentro de la base

Desde el **2026-10-04**, cada tabla vive en un **esquema de PostgreSQL** con el nombre de su dominio. Un
esquema es, literalmente, una carpeta dentro de la base de datos:

| | |
|---|---|
| `identidad.persons` | la persona |
| `organizacion.units` | las unidades |
| `firmas.signature_requests` | las peticiones de firma |
| `plantillas.ediciones` | las ediciones de una plantilla |

Son ocho —uno por dominio— y en `public` no queda ninguna tabla: solo las doce funciones que usan los
disparadores.

**Y las consultas del sistema no cambiaron.** Las 555 siguen escribiendo `signature_requests` sin
decir de qué dominio es, porque la conexión declara los ocho esquemas y PostgreSQL resuelve el nombre
igual que antes. Lo que se gana es otra cosa:

- una consulta **puede** decir de qué dominio es, cuando eso ayude a leerla;
- `pg_dump -n firmas` saca **un dominio entero**, para inspeccionarlo o copiarlo aparte;
- y, lo que más vale: **el dominio de una tabla dejó de ser una afirmación en un fichero.** Antes un
  JSON decía «`signature_requests` es de firmas» y había que creérselo. Ahora lo dice la propia base
  de datos, y si alguien crea una tabla en el esquema equivocado, falla una puerta de CI.

:::note[Lo que esto NO resuelve]
Separar en esquemas **no sirve para separar instituciones**. Una conversación entre personas de dos
empresas distintas no tendría dónde vivir, y un directorio de funcionarios públicos pasaría a ser una
consulta sobre N esquemas que no se puede indexar. La pertenencia a una institución se resuelve por
el organigrama, no partiendo la base.
:::

:::caution[Para quien tenga una base anterior]
`postgres_schema.sql` describe la forma y **no pone al día una base vieja** — es una decisión
deliberada, y hay un test que la vigila. Sobre una base anterior a los esquemas,
`CREATE TABLE IF NOT EXISTS firmas.x` **no ve** la `public.x` que ya existe: crearía una tabla nueva
y **vacía**, dejando la vieja con todos los datos donde estaba, **en silencio**.

Así que una base de antes se **resetea**, o se reubica con `scripts/migrar-a-esquemas.sql` antes de
arrancar. Ese script mueve cada tabla a su esquema y **no toca ni una fila**.
:::

### Y los permisos agrupan de otra manera, a propósito

Las tablas se agrupan **tres** veces en este sistema y las tres agrupaciones son distintas:

| Agrupación | Responde a | Dónde se ve |
|---|---|---|
| **módulo y nivel** | ¿qué depende de qué? | esta página |
| **recurso de permiso** | ¿quién puede actuar sobre esto? | [Qué puedes hacer](/complemento/permisos/) |
| **subgrupo del mapa** | ¿cómo se cuenta esto a alguien que no lo conoce? | los dos mapas completos |

Medido: el recurso de permiso y el subgrupo dibujado coinciden con los módulos en un **28 %** y un
**27 %**. **No es un descuadre que haya que arreglar**: el recurso `catalogos` junta a propósito las
listas cerradas de la persona y las del territorio, porque administrarlas es un solo trabajo; y el
subgrupo «Cómo se te localiza» junta el correo, el teléfono, el canal y la llave de verificación
—tres niveles distintos— porque es una sola frase.

Lo que sí está vigilado es que ninguna de las tres crezca sin que alguien lo decida: cada recurso y
cada subgrupo **declara los módulos que abarca, con su motivo**, y una tabla que caiga en el recurso
o en la caja equivocada pone CI en rojo. Antes no rompía nada y no se enteraba nadie.

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
