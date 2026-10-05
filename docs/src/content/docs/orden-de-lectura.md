---
title: "El sistema en orden de lectura"
description: "Las 93 tablas en el único orden en que se pueden leer sin que nada dependa de algo que todavía no has visto."
---

Esta página existe porque el sistema **no se puede entender leyéndolo por temas**.

Las tablas se pueden agrupar por tema —«esto es de personas», «esto es de firmas»— y de hecho se
agrupan así en los diagramas. Pero esos grupos **se necesitan unos a otros en círculo**: medido el
2026-10-04, hay cuatro parejas que se apuntan mutuamente (identidad ↔ organización, plantillas ↔
procesos, plantillas ↔ tareas, firmas ↔ tareas). Eso significa que **no existe ningún orden** en el
que estudiar esos grupos: empieces por donde empieces, llegas a algo que depende de algo que no has
visto.

Lo que sigue es el otro reparto posible: **por altura**. Cada tabla tiene un nivel del 0 al 7, y la
regla es una sola:

> **Una tabla solo puede depender de tablas de su mismo nivel o de uno más bajo. Nunca de uno más
> alto.**

De las **182 relaciones** entre tablas del sistema: **103 bajan de nivel, 79 se quedan en el suyo y
ninguna sube**. Por eso esta página se lee de arriba abajo y nada aparece antes de haberse
explicado. Y por eso sirve cuando el sistema crezca: una tabla nueva entra en un nivel, y la única
pregunta que hay que contestar es «¿de qué depende?».

:::note[Cómo usar esto]
No hace falta leerlo entero. Si vas a tocar algo del **nivel 5**, lo que puede romperse está en el 5
y por encima; lo de abajo no se entera. Al contrario sí: si cambias algo del **nivel 0**, puede
afectar a todo.
:::

---

## Nivel 0 · Lo que se configura una vez — 22 tablas

Listas y catálogos. **No dependen de nada** y casi todo lo demás depende de ellos. Se siembran al
instalar y se editan desde `/admin`.

**El territorio**, en cadena: un país tiene provincias, una provincia tiene cantones, un cantón tiene
parroquias.

| Tabla | Qué guarda |
|---|---|
| `paises` | Los países, con su código telefónico |
| `provincias` | Las provincias de cada país |
| `cantones` | Los cantones de cada provincia |
| `parroquias` | Las parroquias de cada cantón |
| `clases_parroquia` | Si una parroquia es urbana o rural |
| `nomenclatura_territorial` | **Cómo se llama cada nivel en cada país.** En Ecuador el nivel 1 es «provincia»; en Suiza un cantón es el nivel de arriba. La etiqueta que ve el usuario sale de aquí, no del nombre de la tabla |

**La institución**:

| Tabla | Qué guarda |
|---|---|
| `instituciones` | El nombre de esta institución y **en qué país está**. De ese país sale cuál es el documento de identidad «nacional». Es la primera tabla de configuración del sistema |

**Las listas cerradas de la persona:**

| Tabla | Qué guarda |
|---|---|
| `generos` | Los géneros que esta institución ofrece |
| `estados_civiles` | Soltero, casado, viudo… |
| `autoidentificaciones_etnicas` | Las autoidentificaciones étnicas |
| `tipos_discapacidad` | Los tipos de discapacidad |
| `parentescos` | Padre, madre, cónyuge, hijo… |
| `categorias_visa` | Las categorías de visa, con la condición que acredita cada una |
| `canales_mensajeria` | Por dónde se le puede escribir a alguien: WhatsApp, Telegram |

**Las listas cerradas del resto del sistema:**

| Tabla | Qué guarda |
|---|---|
| `cargos` | Las denominaciones de puesto: Docente, Secretaria, Decano… |
| `unit_types` | Los tipos de unidad: Facultad, Carrera, Dirección… |
| `relation_unit_types` | Los tipos de vínculo entre unidades. El principal es el orgánico (quién está debajo de quién) |
| `term_types` | Los tipos de periodo: semestral, anual, permanente |
| `signature_statuses` | Los estados de una firma |
| `signature_request_statuses` | Los estados de una petición de firma |
| `actions` | Los verbos con los que se nombra un permiso: leer, crear, modificar, borrar, administrar |
| `resources` | Las cosas sobre las que se dan permisos: personas, unidades, documentos… |

:::caution[Dos nombres que engañan]
`autoidentificaciones_etnicas`, `tipos_discapacidad` y `parentescos` **existen y se pueden editar,
pero el sistema todavía no les pide nada**: las pantallas que los van a consumir —salud y cargas
familiares— están sin construir. No son tablas muertas: son tablas que esperan.
:::

---

## Nivel 1 · Quién es cada persona — 13 tablas

Aquí vive la identidad. Todo esto depende del nivel 0 (un domicilio necesita un cantón, un documento
necesita un país) y nada más.

| Tabla | Qué guarda |
|---|---|
| `persons` | **La persona.** Nombre, fecha y lugar de nacimiento, nacionalidad, sexo, estado civil, foto y su contraseña. Es la identidad única del sistema: no hay una tabla de «usuarios» aparte |
| `documentos_identidad` | Los documentos de una persona, cada uno con **su clase** (documento nacional, pasaporte, documento extranjero o visa), **su país emisor** y su número. Cuál es el «nacional» lo decide el país de la institución |
| `persona_autoidentificacion` | El género y la etnia que la persona declara de sí misma. Está aparte **porque son datos sensibles** y no todo el mundo puede verlos |
| `direcciones` | Dónde vive, con su cantón, su calle y sus coordenadas en el mapa |
| `telefonos` | Sus números, cada uno con su país |
| `telefono_canales` | Qué canales tiene cada número **y cuál está comprobado**. Que un número tenga WhatsApp comprobado no dice nada de Telegram: cada canal se comprueba por separado |
| `emails` | Sus correos, con si están verificados |
| `person_certificates` | El certificado digital con el que la persona firma documentos |
| `dossiers` | El expediente de una persona: una fila por persona |
| `dossier_items` | Lo que hay dentro del expediente: títulos, experiencia, publicaciones, capacitaciones |
| `documentos_legales` | Los textos legales del sistema —política de privacidad, términos— **versionados**, para poder demostrar qué decía el texto el día que alguien lo aceptó |
| `consentimientos` | **Que esta persona aceptó ese texto, ese día, desde esa dirección.** Es la prueba que exige la ley de protección de datos |
| `accesos_sensibles` | **Quién miró o cambió un dato sensible de quién, y cuándo.** Solo se puede añadir: no se puede modificar ni borrar, lo impide la propia base de datos |

:::note[Se entra por correo]
Desde el 2026-08-29 se entra al sistema **con el correo**, no con el número de documento. El motivo
no es la unicidad: un pasaporte se renueva **con número nuevo**, así que quien entrara con él perdería
su acceso al renovarlo. El correo lo controla la persona y no caduca. La cédula sigue existiendo como
dato; lo que dejó de ser es una llave.
:::

---

## Nivel 2 · El organigrama — 4 tablas

Cuatro tablas, y están aquí arriba porque un puesto necesita saber **de qué tipo** es su unidad
(nivel 0) y **quién** lo ocupa (nivel 1).

| Tabla | Qué guarda |
|---|---|
| `units` | Las unidades: facultades, carreras, direcciones |
| `unit_relations` | Qué unidad está debajo de qué otra |
| `unit_positions` | Los puestos que tiene cada unidad, y si uno de ellos es el que la dirige |
| `position_assignments` | **Quién ocupa cada puesto, desde cuándo y hasta cuándo.** Es un periodo, no una foto: cuando alguien releva a otro, el periodo anterior se cierra y se abre uno nuevo |

---

## Nivel 3 · Quién puede hacer qué, y cómo se entra — 11 tablas

Este nivel va **encima del organigrama**, y es lo primero que sorprende: parece que los permisos
deberían ir antes. Pero un rol **no se da en abstracto, se da dentro de una unidad** («gestor de
procesos *de la Facultad de Ingeniería*»), así que necesita que las unidades ya existan.

**La consecuencia práctica:** quien cambia el organigrama **puede romper los permisos de alguien**.
Al revés no pasa nunca.

| Tabla | Qué guarda |
|---|---|
| `roles` | Los roles: administrador del sistema, gestor de procesos, usuario… |
| `permissions` | Cada permiso suelto, formado por **un verbo y una cosa** del nivel 0: «leer personas», «crear unidades» |
| `role_permissions` | Qué permisos tiene cada rol |
| `role_assignments` | **Que esta persona tiene este rol en esta unidad**, desde cuándo y hasta cuándo. Puede alcanzar también a las unidades de debajo, y hasta qué profundidad |
| `role_assignment_relation_types` | Por qué tipo de vínculo se propaga ese alcance hacia abajo |
| `cargo_role_map` | Qué rol le toca automáticamente a quien ocupa cierto puesto |
| `email_verification_codes` | El código que se manda al correo para comprobar que es suyo |
| `password_reset_codes` | El código para recuperar la contraseña |
| `telefono_verification_keys` | La llave de un intento de comprobar un teléfono por WhatsApp o Telegram |
| `intentos_limitados` | Los intentos de entrar, para poder frenar a quien lo intenta mil veces |
| `canales_bitacora` | Si WhatsApp y Telegram están respondiendo o están caídos |

:::caution[Lo que nadie ha revisado]
Los roles y permisos de este nivel **se generaron automáticamente y nunca se auditaron**. Que estén
aquí descritos no quiere decir que el reparto sea el correcto: quiere decir que es el que hay.
:::

---

## Nivel 4 · Lo que se declara que debe pasar — 11 tablas

A partir de aquí empieza el trabajo del sistema. **Y todo este nivel es declaración: nada de esto ha
ocurrido todavía.** Es la plantilla de un proceso, no un proceso en marcha.

El modelo se resume en tres ejes independientes: **la serie nombra, la regla reparte el alcance, y el
flujo reparte los pasos.** (El flujo es el nivel 6.)

| Tabla | Qué guarda |
|---|---|
| `processes` | El proceso, por su nombre. Puede colgar de otro |
| `process_definition_series` | **La serie:** cómo se nombra este proceso, y para qué tipo de unidad o qué puesto |
| `process_definition_versions` | **La definición, versionada.** Un proceso se puede redefinir sin perder lo que ya se lanzó con la versión anterior |
| `process_target_rules` | **La regla:** a qué unidades y a qué puestos alcanza este proceso |
| `process_definition_period_types` | En qué tipos de periodo se repite |
| `terms` | Los periodos concretos: «2026-1», «2026-2», «Permanente», con sus fechas |
| `deliverables` | **El entregable como obra**: «Informe de Gestión Docente». Es el título, no el archivo |
| `template_artifacts` | **Las ediciones de esa obra.** La versión 3 del informe. Es lo que de verdad se rellena |
| `generadores_de_documento` | **Quién produce el PDF**: el paquete LaTeX de arranque que trae el sistema, o un servicio al que se le pide |
| `process_definition_templates` | **Qué ediciones produce este proceso**, y en qué modo: una sola, varias copias, o definida al momento |

:::note[Los tres modos de un entregable]
- **una sola**: el entregable y quién lo llena y lo firma vienen decididos en la plantilla.
- **varias copias**: quien es responsable crea tantas copias etiquetadas como necesite, y todas
  heredan el mismo recorrido.
- **definido al momento**: la plantilla **no** trae recorrido; lo decide quien lo crea, en el momento.
:::

---

## Nivel 5 · Lo que de verdad pasa — 7 tablas

Aquí es donde la declaración se convierte en trabajo real de personas.

| Tabla | Qué guarda |
|---|---|
| `process_runs` | **Cada vez que se lanza un proceso.** Volver a lanzarlo es una corrida nueva, no un reemplazo |
| `tasks` | Las tareas que esa corrida crea, una por cada unidad a la que alcanza la regla |
| `task_items` | **El entregable concreto que alguien debe.** Lo que lo identifica son tres cosas: la tarea, la edición de la plantilla y **el puesto que lo produce** |
| `task_item_tenures` | **Quién lo debe ahora, y quién lo debía antes**: una fila por turno, con en calidad de qué puesto y entre qué fechas |
| `document_versions` | **Cada ronda de llenar y firmar** ese entregable |
| `document_version_uploads` | **Cada corrección del archivo** dentro de una ronda, con quién la subió |
| `document_attachments` | Los anexos que acompañan al documento |

:::caution[Tres cosas que se malinterpretan]
**El puesto manda, no la persona.** `task_items` apunta al **puesto** que debe producir el
entregable, y es obligatorio. Si al lanzar no hay nadie en ese puesto, **el entregable no se crea** —
antes se creaba huérfano.

**La persona que figura es una copia, no el dato.** `task_items` guarda también la persona asignada,
pero eso es una **caché** que mantiene la propia base de datos a partir de los turnos. Para cambiar de
responsable se hace un traspaso; no se edita ese campo.

**Y el relevo automático funciona hasta antes de la firma.** Si el entregable ya está en fase de
firma, cambiar de responsable no lo arrastra.
:::

---

## Nivel 6 · Quién lo llena y quién lo firma — 11 tablas

El recorrido de un documento. Está encima del nivel 5 porque un paso del recorrido apunta a **una
ronda concreta** de un documento concreto.

**Llenar:**

| Tabla | Qué guarda |
|---|---|
| `fill_flow_templates` | El recorrido de llenado, como plantilla |
| `fill_flow_steps` | Sus pasos, y **cómo se decide quién hace cada paso**: el responsable del entregable, o quien ocupe cierto puesto en cierto ámbito |
| `document_fill_flows` | Ese recorrido **puesto en marcha** sobre una ronda de un documento |
| `fill_requests` | Lo que le toca a cada persona, con su respuesta |

**Firmar:**

| Tabla | Qué guarda |
|---|---|
| `signature_flow_templates` | El recorrido de firma, como plantilla |
| `signature_flow_steps` | Sus pasos, con cuántas firmas hacen falta y **dónde va cada firma en el papel** |
| `signature_flow_instances` | Ese recorrido puesto en marcha sobre una ronda |
| `signature_requests` | Lo que le toca firmar a cada persona |
| `document_signatures` | **La firma ya puesta**, con el archivo firmado resultante |
| `signature_batch_jobs` | Los lotes de firma que se mandan al servicio que firma los PDF |

**Y el rastro:**

| Tabla | Qué guarda |
|---|---|
| `document_workflow_observations` | **Las devoluciones.** Cuando alguien rechaza un documento y lo manda atrás, el motivo queda aquí |

:::note[El «Para:» no existe]
A quién va dirigido un documento **no se escribe en ninguna parte**: se deduce del recorrido de firma.
Un envío sin recorrido se rechaza, así que el dato siempre está.
:::

---

## Nivel 7 · Lo que se apoya en todo lo anterior — 14 tablas

Dos bloques que usan todo lo de abajo y de los que **nada depende**. Se pueden leer al final, o no
leerse.

**La conversación** — funciona y se usa:

| Tabla | Qué guarda |
|---|---|
| `chat_conversations` | Las conversaciones: directas, de grupo, o atadas a un proceso |
| `chat_conversation_participants` | Quién está en cada una |
| `chat_messages` | Los mensajes |
| `chat_message_attachments` | Sus adjuntos |
| `chat_message_reads` | Quién ha leído qué |
| `chat_notifications` | Los avisos |

**La contratación** — declarada, a medio construir:

| Tabla | Qué guarda | ¿Se puede usar? |
|---|---|---|
| `vacancies` | Las vacantes | solo desde `/admin` |
| `vacancy_visibility` | A qué unidades y roles se les muestra una vacante | solo desde `/admin` |
| `contracts` | Los contratos | solo desde `/admin` |
| `aplications` | Las postulaciones a una vacante | **no, no hay pantalla** |
| `offers` | Las ofertas que se hacen a quien postula | **no, no hay pantalla** |
| `contract_origins` | De dónde viene un contrato | **no, no hay pantalla** |
| `contract_origin_recruitment` | …de un proceso de selección | **no, no hay pantalla** |
| `contract_origin_renewal` | …de la renovación de otro contrato | **no, no hay pantalla** |

:::caution[Las cinco tablas sin pantalla]
`aplications`, `offers` y las tres de origen de contrato **no se pueden tocar desde ninguna parte del
sistema**. Están en el modelo porque el ciclo de contratación se diseñó entero, y se construyó a
medias. No están de más: están pendientes.
:::

---

## Resumen en una tabla

| Nivel | Qué es | Tablas |
|---|---|:--:|
| **0** | Lo que se configura una vez | 22 |
| **1** | Quién es cada persona | 13 |
| **2** | El organigrama | 4 |
| **3** | Quién puede hacer qué, y cómo se entra | 11 |
| **4** | Lo que se declara que debe pasar | 11 |
| **5** | Lo que de verdad pasa | 7 |
| **6** | Quién lo llena y quién lo firma | 11 |
| **7** | Conversación y contratación | 14 |
| | | **93** |

El reparto vive en `scripts/docs/dominios.json` y lo comprueba
`node scripts/docs/check-mapa-tablas.mjs`: si alguien añade una tabla y no le pone nivel, o crea una
relación que **sube** de nivel, falla.
