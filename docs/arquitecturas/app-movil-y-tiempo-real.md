# Congelar los bots y llevarlo todo a una app propia — evaluación

> **La propuesta del dueño (2026-09-01).** Telegram y WhatsApp se quedan donde están, **sólo para
> verificar**. Todo lo demás —ubicación, QR, comandos— va a una **app móvil propia**, que usará esos
> mismos canales para verificarse y que **más adelante será ella misma un canal de verificación**.
>
> **Veredicto: es mejor que lo que yo proponía, y cancela parte de mi propio diseño.**
>
> ---
>
> 🕓 **LA APP NO SE HACE AQUÍ, NI AHORA.** Decisión del dueño (2026-09-01): *«será en un futuro
> lejano, aún tiene mucho que cocinarse»*. **No es un frente, no tiene tareas y no entra en el plan
> maestro.**
>
> **Lo que SÍ decide este documento hoy** —y es lo que hay que retener— es todo lo que se **deja de
> hacer**: `C10`, `C11`, el contrato de dos niveles y las dos tablas. Eso es efectivo ya.
>
> El resto son **notas para cuando llegue el día**, y valen precisamente porque están escritas antes
> de que nadie tenga prisa: §4 (el segundo plano no lo resuelve ningún transporte), §5 (el adaptador
> es la decisión, no el microservicio) y §7 (la app verificaría *sesiones*, no *números*).

---

## 1 · Qué ahorra, en concreto

`channels-mas-de-una-intencion.md` deja de hacer falta casi entero:

| | |
|---|---|
| El contrato de dos niveles (`tipo` · `contenido` · `remitente`) | **Ya no hace falta.** El canal puede seguir extrayendo la llave: sólo hay una intención |
| `Conserje` y el enrutado por intención en `/internal` | **Ya no hace falta** |
| La tabla `conversaciones_en_curso` | **Ya no hace falta** — nace sólo porque un mensaje de ubicación no lleva texto |
| La tabla `capturas_de_ubicacion` | Se sustituye por una llamada HTTP normal desde la app, **autenticada con su sesión** |
| `C10` y `C11` | **Se retiran del plan** |

**Y se conserva lo que ya está probado sin tocarlo.** `VerificacionDeTelefono`, `Canal`, `llave.js`
y los dos canales se quedan como están, con sus 83 pruebas.

---

## 2 · La razón más fuerte, y es de hoy mismo

**`whatsapp-web.js` no es una API: es un navegador conduciendo WhatsApp Web, y WhatsApp no lo
autoriza.** Eso ya estaba escrito, pero hoy dejó de ser un aviso teórico:

> El 2026-09-01, cinco mensajes reales llegaron con `@lid` en vez de `@c.us`. **El canal llevaba
> tiempo escrito contra una suposición que dejó de ser cierta sin avisar**, y costó tres sesiones
> averiguarlo porque descartaba en silencio.

Construir **la verificación** sobre eso es aceptable: si el canal se cae, alguien no puede
registrarse hoy y hay otro canal al lado. Construir **la operación diaria** sobre eso significa que
un cambio de WhatsApp rompe funciones de trabajo sin previo aviso y sin que nadie pueda arreglarlo.

Hay dos más, medidas también hoy:

- **El perfil de WhatsApp acumula datos personales sin que nadie lo decida** (253 MB con **un** solo
  teléfono de pruebas; ver `channels-mas-de-una-intencion.md` §5). Más intenciones son más mensajes,
  y más datos en un perfil de Chromium que nadie audita.
- **La sesión vive en el proceso que la abrió**, así que todo lo que cuelgue de ella hereda «una
  sola instancia» como restricción de arquitectura. Para verificar es asumible; para la operación
  diaria es una atadura cara.

Con la app propia, **la superficie que depende de una librería no oficial deja de crecer**. Es la
diferencia entre una dependencia acotada y una que se te mete en el negocio.

---

## 3 · ¿Sirve el WebSocket que ya hay? **Sí, y no hace falta cambiarlo**

Lo que hay hoy, medido:

| | |
|---|---|
| Socket.IO **4.8.3**, backend y frontend | `backend/services/realtime/RealtimeGateway.js`, **179 líneas** |
| Autenticación | **JWT en el handshake** (`auth.token` o cabecera `Authorization`) |
| Salas | por persona, por conversación y por proceso |
| nginx | **ya proxya el `Upgrade`** en app e ingress |
| EMQX | **ya no existe**: las cuatro menciones que quedan son comentarios que explican su retirada |

**Para una app móvil, esto vale tal cual.** El handshake por JWT es exactamente lo que necesita un
cliente nativo, y hay clientes oficiales de Socket.IO para **Java/Kotlin (Android)**, **Swift
(iOS)** y **Dart (Flutter)**; React Native usa el de JavaScript.

⚠️ **Con un matiz honesto:** esos clientes van por detrás del de JavaScript y los mantiene la
comunidad. Si el equipo va a Flutter o React Native, cero fricción. Si va a nativo puro, conviene
comprobar la versión del cliente **antes** de comprometerse.

---

## 4 · Pero la pregunta importante es otra, y ningún transporte la resuelve

**Una app móvil necesita recibir avisos cuando está cerrada. Eso NO es una decisión de transporte:
es una restricción del sistema operativo.**

- **iOS suspende los sockets** en cuanto la app pasa a segundo plano. No es configurable.
- **Android los mata** con Doze y los límites de servicios en segundo plano.

Así que **da igual qué elijas**: Socket.IO, MQTT, EMQX, gRPC o lo que sea. Con la app cerrada, **la
única forma de que suene el teléfono es APNs (iOS) y FCM (Android)**.

⚠️ **Este es el error clásico al elegir MQTT para móvil**: se elige creyendo que resuelve el segundo
plano, y no lo hace. MQTT es excelente **con la app abierta y la red mala**; con la app cerrada, el
sistema operativo manda igual.

**La consecuencia práctica:** hagas lo que hagas, el frente de la app móvil incluye **integrar FCM y
APNs**, y eso es trabajo de infraestructura y de cuentas (certificados de Apple, proyecto de
Firebase), no de código. **Conviene meterlo en el plan desde el principio**, porque es lo que más
tarda por motivos ajenos a nosotros.

El reparto queda así, y es el mismo con cualquier transporte:

| Situación | Quién entrega |
|---|---|
| App abierta | **Socket.IO** — lo que ya hay |
| App en segundo plano o cerrada | **FCM / APNs**, obligatorio |
| El usuario abre la app | Se reconecta y **pide lo que se perdió por HTTP** |

⚠️ Esa tercera fila importa: **el WebSocket no debe ser la única vía de un dato**. Si un aviso sólo
existe como evento emitido, quien estuviera desconectado no se entera nunca. El estado se lee por
HTTP; el socket sólo **avisa antes**.

---

## 5 · ¿Microservicio de tiempo real? **Ésa no es la decisión**

Aplicando la misma regla que justificó `channels` —se separa lo que **sostiene conexiones**, no lo
que queda bonito— un servidor de WebSockets **sí** es candidato: mantiene conexiones vivas con
estado.

**Pero extraerlo no arregla el problema que de verdad hay.** Medido hoy:

> **No hay adaptador de Socket.IO y no hay Redis en ninguna pila.**

Sin adaptador, **una segunda instancia rompe el tiempo real en silencio**: quien esté conectado a la
instancia A no recibe lo que emite la instancia B. No falla, no avisa: simplemente unos usuarios ven
las cosas y otros no, de forma intermitente. Es exactamente el tipo de fallo que este repositorio ya
ha pagado tres veces.

Y **un microservicio de tiempo real con dos réplicas tiene el mismo problema**. Extraerlo no lo
resuelve; **lo resuelve el adaptador**.

**Lo que sí hay que decidir, entonces, es Redis** — y resulta que ya hay **dos** cosas que lo
quieren:

1. El **adaptador** de Socket.IO, el día que haya más de una instancia.
2. **`C9`, el limitador**, que hoy no existe en todo el sistema y que un contador en memoria no
   resuelve en cuanto hay más de un proceso.

**Recomendación:** no extraer el gateway. Son 179 líneas que funcionan. Añadir Redis **cuando `C9`
lo pida**, y con él llega el adaptador casi gratis. Extraer un microservicio se plantea el día que
el tiempo real tenga un ciclo de despliegue distinto del de la API — que hoy no lo tiene.

---

## 6 · ¿EMQX? Volver tiene que costar más que quedarse

**Ya se salió de EMQX a propósito**, y el motivo sigue en pie: el backend ya tiene un servidor HTTP,
así que el broker era una pieza más que operar para hacer lo mismo.

**Cuándo MQTT sí ganaría**, para que quede escrito y no se decida por costumbre:

- **Muchos dispositivos con red mala.** MQTT pesa mucho menos por mensaje.
- **Hace falta cola de sin conexión de verdad.** Sesiones persistentes + QoS 1/2: el broker guarda lo
  no entregado y lo suelta al reconectar. Socket.IO no hace esto: si estabas desconectado, te lo
  perdiste — de ahí la regla de §4 de leer el estado por HTTP al abrir.
- **Telemetría**, muchos mensajes pequeños y continuos.

⚠️ **Y ojo con el caso del técnico en campo**, que el propio dueño mencionó: *si* la app tiene que
**recoger datos sin cobertura y enviarlos al recuperarla**, eso **no** lo resuelve el transporte —lo
resuelve **una cola local en el dispositivo** y reintentos por HTTP. Es trabajo de la app, y es más
simple y más robusto que montar un broker.

**Veredicto: no volver a EMQX.** No aporta nada que la app necesite hoy, y añade un broker que
operar, autenticar y vigilar.

**Alternativas gestionadas** (Firebase Realtime, Supabase, Ably, Pusher): resuelven esto sin
operarlas, pero **el tiempo real pasaría por un tercero**. Para un sistema con datos de personas de
una institución, esa decisión es del dueño y no técnica.

---

## 7 · La app como canal de verificación: es el caso que faltaba

Cuando la app propia sea un canal más, **será el mejor de los tres**, y por una razón concreta:
**controlamos los dos extremos**. No hay identificador opaco que resolver ni librería no oficial que
se mueva bajo los pies.

Y encaja sin tocar nada: `Canal` ya existe para eso. Hoy tiene dos implementaciones que prueban el
número de formas que no se parecen; la tercera será una más.

⚠️ **Con una trampa que conviene decir ahora:** la app **no puede probar un número por sí sola**. Un
teléfono con la app instalada no demuestra qué línea tiene. Para que sea un canal de verificación de
verdad hace falta que la app lea un SMS —que es lo que se acaba de descartar— o que **el primer alta
siga pasando por Telegram o WhatsApp**. **Lo segundo es lo coherente**: la app verifica *sesiones*
—«este dispositivo es de esta persona ya verificada»—, no *números*.

Eso convierte a la app en algo distinto y mejor: **un canal de confianza de dispositivo**, no un
tercer transporte para el mismo truco.

---

## 8 · Recomendación, en orden

1. **Aceptar la propuesta.** Congelar los bots en verificación y retirar `C10`/`C11` del plan.
2. **Cerrar `C9`** (el limitador) y **`C7`** (la pestaña). Siguen siendo lo que falta del frente 15,
   y `C9` es ahora la puerta de entrada natural a Redis.
3. **Dejar el tiempo real donde está.** No extraer, no volver a EMQX.
4. **Al planificar la app, meter FCM/APNs desde el primer día** — es lo que más tarda y no depende
   de nosotros.
5. **Escribir la regla de §4 antes de la primera pantalla**: el socket avisa, el estado se lee por
   HTTP. Retrofitarla después es rehacer la app entera.
