# `C7` · La pestaña de canales — diseño

> **Estado: PROPUESTA.** Nada implementado. La decisión es del dueño.
>
> **Qué resuelve:** hoy no hay **ningún** sitio donde mirar si los canales reciben. Se mira leyendo
> el registro de un contenedor con `docker logs`, o con `scripts/canales.sh`, que es un apaño.

---

## 1 · La necesidad está medida, no supuesta

| Cuándo | Qué pasó |
|---|---|
| **2026-08-31** | El contenedor murió de un `SIGKILL` y estuvo **TRECE HORAS** parado. El bot dejó de responder a todo el mundo, el backend seguía emitiendo llaves tan contento y la pantalla seguía pintando el QR. **Ningún error, en ninguna parte.** |
| **2026-09-01** | El canal de WhatsApp estuvo **mudo tres veces** en una sola sesión: un candado obsoleto de Chromium, un cierre a medias que obligaba a resincronizar seis minutos, y un remitente `@lid` que se descartaba en silencio |
| **2026-09-01** | `scripts/canales.sh` —escrito para tapar esto— **mintió dos veces**: leyó el historial entero y dio por listo un canal por un «sesión lista» de un arranque anterior; y luego dijo «sincronizando 99 %» de uno que ya funcionaba |

**La lección que deja el tercero es la que justifica esta tarea:** el estado de un canal **no se lee
de un registro de texto**. Se pregunta.

---

## 2 · Lo que hay hoy, y lo que falta

| | |
|---|---|
| `Canal.estado()` | ✅ **Ya existe en el contrato**, y los dos canales lo implementan: `{conectado, necesitaVinculacion, qr, detalle}` |
| Quién lo llama | ❌ **Nadie**, salvo `index.js` **una vez al arrancar** — por eso el resumen envejece y miente |
| Un puerto en `channels` | ❌ **No hay ninguno.** El servicio no escucha nada |
| Una ruta en el backend | ❌ |
| Un permiso | ❌ |
| La pestaña | ❌ |

**El diseño es, casi entero, conectar un cable a un método que ya existe.**

---

## 3 · 🔴 Lo que decide la forma: **el QR es una credencial**

Antes de la mecánica, la restricción que manda sobre todo lo demás.

**Quien escanea el QR decide QUÉ CUENTA DE WHATSAPP ES el canal de la institución.** No es «ver un
dato de administración»: es una **toma de control de la identidad del canal**. A partir de ese
momento, las verificaciones de teléfono del sistema pasan por un WhatsApp que eligió quien escaneó.

De ahí salen cuatro reglas que **no son ajustables**:

1. **El QR sólo se sirve cuando el canal DE VERDAD necesita vincularse** (`necesitaVinculacion`).
   Con la sesión sana, el endpoint **no devuelve QR ni a quien tenga todos los permisos**. No hay
   ningún motivo legítimo para mirar un QR de un canal que ya funciona.
2. **Ver el estado y ver el QR son PERMISOS DISTINTOS.** `channels.read` enseña si está vivo;
   **`channels.manage`** enseña el QR. Quien vigila no tiene por qué poder vincular.
3. **Pedir el QR se registra**, con quién y cuándo. Es la única acción de esta pantalla capaz de
   cambiar la identidad del canal.
4. **Ni el token del bot ni la clave de servicio salen nunca**, ni siquiera enmascarados. El número
   de WhatsApp sí: ya se publica a los usuarios en cada enlace `wa.me`.

⚠️ **Esto es también por qué la pantalla es una pestaña del admin y no un front propio del
servicio**: un segundo sistema de acceso que mantener, para enseñar una credencial, era una mala
idea con dos nombres.

---

## 4 · Cómo llega el estado: **se pregunta, no se guarda**

### Las dos opciones, y por qué gana la primera

| | |
|---|---|
| **A · El backend PREGUNTA a `channels`** (pull) | ✅ **Sin estado en ninguna parte.** Lo que se ve es lo que hay en ese instante |
| **B · `channels` AVISA al backend** (push) y el backend lo guarda y lo reemite | ❌ Necesita **memoria en el backend**, que es justo lo que acabamos de fijar a una instancia; y un estado guardado **puede envejecer y mentir** — que es exactamente el fallo que esta tarea existe para arreglar |

⚠️ **La opción B es la que parece más moderna y es la que ya nos mordió dos veces hoy**, en pequeño:
el resumen del arranque y el `canales.sh` que leía historial. **Un estado copiado es un estado que
puede quedarse viejo.** Preguntar no tiene ese fallo.

### El cable, concreto

```
navegador ──GET /api/deasy/v1/admin/canales──▶ backend ──GET http://channels:3050/estado──▶ channels
   (sesión + permiso)                              (INTERNAL_SERVICE_KEY)                  Canal.estado()
```

**Tres cosas que hay que notar:**

- **`channels` estrena un puerto, y SIN publicar.** Sólo la red interna de compose, igual que el
  firmador. Al navegador no se le ha perdido nada ahí.
- **Se reutiliza `INTERNAL_SERVICE_KEY`**, que las dos partes ya tienen. Es **la misma relación de
  confianza** en el otro sentido, no una nueva: inventar una segunda clave para el mismo par de
  servicios sería más superficie sin más seguridad.
- **Si `channels` no contesta, eso ES la respuesta.** «No puedo hablar con el servicio de canales» es
  justo lo que se quería saber el día que estuvo trece horas muerto. Se enseña como un estado más,
  no como un error de la pantalla.

### Frescura: se sondea mientras la pestaña está abierta

El QR de WhatsApp **rota cada ~20 segundos**, así que un dato de hace un minuto sirve para tomar
decisiones pero **no para escanear**. La pantalla pregunta **cada 5 s mientras está abierta**, y para
cuando se cierra.

⚠️ **Se descarta usar Socket.IO aquí**, aunque exista y funcione: sería montar plumbing para una
pantalla que se abre en contadas ocasiones. **Sondear una página abierta es el caso donde sondear es
lo correcto**, y además es lo que ya hace la pantalla de verificación de teléfono — mismo problema,
misma solución, un patrón menos que aprender.

---

## 4alt · `C7A` (preguntar) contra `C7B` (eventos) — la evaluación

Encargo del dueño: comparar el diseño de este documento —**`C7A`**, el backend pregunta— con
**`C7B`**, donde `channels` mantiene un cliente WebSocket contra el backend y le **avisa** de cada
cambio.

**Veredicto: gana `C7A`**, y por un argumento que no es de gusto.

### El argumento que decide

> **Quien puede estar muerto no puede ser el responsable de avisar de que lo está.**

`C7B` funciona mientras `channels` esté vivo. Y **el caso que motivó esta tarea es exactamente el
contrario**: el 2026-08-31 el contenedor murió de un `SIGKILL` y estuvo **trece horas** parado. Un
`channels` muerto **no manda ningún evento**, y desde el backend **el silencio es indistinguible de
«no ha cambiado nada»**.

Para tapar eso, `C7B` necesita **añadir un latido periódico** —y el latido es la parte que de verdad
detecta la caída—. Es decir: `C7B` acaba siendo `C7A` con eventos encima, no una alternativa a él.

Con `C7A`, en cambio, **la ausencia de respuesta ES la respuesta**, y llega sola: el backend
pregunta y no le contestan.

### Lo demás, punto por punto

| | `C7A` · preguntar | `C7B` · eventos |
|---|---|---|
| **Detectar que el servicio murió** | ✅ Preguntar y no obtener respuesta | ❌ **Silencio ≠ novedad.** Necesita un latido aparte |
| **Estado que envejece** | ✅ **No hay estado guardado**: lo que se ve es de ese instante | ⚠️ El backend guarda lo último que le contaron. **Si se pierde un evento, miente hasta el siguiente** |
| **Cambios entre dos sondeos** | ⚠️ Un parpadeo `CONNECTED→TIMEOUT→CONNECTED` de 2 s **se pierde** | ✅ Los ve todos |
| **Coste en reposo** | ✅ **Cero**: sólo se pregunta con la pantalla abierta | ⚠️ Una conexión permanente, viva 24 h para una pantalla que se abre poco |
| **Piezas nuevas** | 1 endpoint | Cliente WS + reconexión + latido + estado en el backend + orden y duplicados |
| **Atadura a una instancia** | ✅ Ninguna: pregunta el backend que atienda | ⚠️ El socket vive contra **un** proceso — y acabamos de fijar `replicas: 1` justo por esto |
| **Historial de caídas** | ❌ No lo da | ✅ Sale casi gratis |

### Lo que `C7B` sí gana, y hay que decirlo

**El historial.** Con eventos, guardar «a las 03:14 pasó a `TIMEOUT`, a las 09:02 volvió» sale casi
solo, y eso responde a *«¿cuánto llevaba roto?»* — que es una pregunta legítima y que `C7A` no
contesta.

Pero ese historial **no lo necesita la pantalla**: lo necesita un **vigilante**, que es otra cosa. Y
un vigilante hecho con eventos hereda el mismo fallo de origen: **no se entera de la muerte que
importa**.

### ⚠️ Lo que `C7A` NO resuelve, dicho claro

**`C7A` arregla que la pantalla mienta. NO arregla que nadie mire.**

El día de las trece horas, `C7A` habría enseñado el fallo **perfectamente… a quien hubiera abierto la
pantalla**. Nadie la abrió, porque nadie sospechaba.

Cerrar eso es **otra tarea**: una comprobación **periódica en el backend** —cada pocos minutos, sin
navegador— que anote los cambios y avise. Y nótese que **también es `C7A` por dentro**: el backend
pregunta, y si no le contestan, eso es la noticia.

**No se cuela aquí.** `C7` entrega la pantalla; el vigilante es una decisión aparte, y el sitio donde
proponerla es el plan, no este documento.

## 4bis · 🔴 Cómo se comprueba que un canal está VIVO — y por qué `estado()` no basta

Pregunta del dueño, y **destapó un defecto en lo que esta pantalla iba a enseñar.**

### El defecto, medido el 2026-09-01

`CanalTelegram` **sabe por dentro** cuándo el sondeo falla: guarda `ultimoError`, avisa la primera
vez y avisa al recuperarse. Pero `estado()` **no lo enseña**:

```js
conectado: this.corriendo,   // ← true desde `iniciar()` hasta `detener()`. NO sabe de la red.
detalle:   this.yo ? `@${this.yo.username}` : (this.ultimoError ?? "sin iniciar"),
//         └── con `yo` puesto, el error NUNCA se ve
```

Comprobado con el fallo real de la caída de seis horas:

```
ultimoError INTERNO  : "EAI_AGAIN api.telegram.org"
lo que vería el FRONT: {"conectado":true, "detalle":"@deasy_test_bot"}
```

**Una luz verde sobre un canal muerto.** Es exactamente la forma de las dos caídas que esta tarea
existe para que no se repitan, y la pantalla las habría pintado en verde.

### Los cinco niveles, y cuál es prueba y cuál no

**«Activo» no es una cosa: son cinco preguntas distintas**, y sólo algunas se pueden contestar.

| | Pregunta | Cómo se contesta | ¿Prueba? |
|:--:|---|---|---|
| **0** | ¿Vive el proceso? | El backend alcanza `GET /estado` de `channels` | ✅ **Prueba** |
| **1** | ¿El canal CREE estar conectado? | La bandera interna | ❌ **Sólo una afirmación** — y miente, arriba está medido |
| **2** | ¿La plataforma responde AHORA? | **Telegram: `getMe`** · **WhatsApp: `client.getState()`** | ✅ **Prueba** de red y credencial |
| **3** | ¿PUEDE recibir? | **Telegram: sí** — el sondeo *es* la recepción, así que `ultimoError === null` lo prueba. **WhatsApp: no hay equivalente** | ⚠️ **Asimétrico** |
| **4** | ¿Está recibiendo DE VERDAD? | «Último mensaje hace X» | ❌ **Indicio, nunca prueba** |

### La asimetría del nivel 3, que hay que decir en la pantalla y no esconder

**Telegram se puede probar entero.** Su bucle pide mensajes cada pocos segundos: si esa llamada
funciona, **la recepción funciona** — no es una inferencia, es la misma operación.

**WhatsApp no.** Su sesión puede estar `CONNECTED` y aun así no entregarnos un mensaje: la página
puede quedarse a medias, o cambiar de forma bajo nuestros pies —que es **exactamente lo que pasó hoy
con `@lid`**—. Lo máximo que se puede afirmar es *«la sesión está viva»*, y la pantalla tiene que
decir eso y no *«funciona»*.

⚠️ **Prometer un verde que no se puede sostener es peor que admitir el hueco**, porque un verde
falso es justo lo que hizo que nadie mirara durante trece horas.

### El nivel 4, y por qué se enseña con cuidado

«Último mensaje recibido hace 26 horas» es **valiosísimo** en un canal que normalmente recibe varios
al día, y **ruido** en uno que pasa días sin tráfico. Se enseña como **dato**, nunca como semáforo:
el color lo ponen los niveles 0-3, que son los que se pueden probar.

### Lo que hay que cambiar para que esto sea posible

1. **`estado()` deja de esconder el error.** Devuelve `ultimoError` y `desde` **siempre**, no sólo
   cuando no hay nada mejor que contar. Es un arreglo pequeño y **es la condición para que la
   pantalla no mienta**.
2. **Se añade una comprobación ACTIVA**, que es la que distingue «arrancó» de «funciona»:
   `getMe` en Telegram, `getState()` en WhatsApp.
3. **Con caché de 30 s.** La pantalla sondea cada 5 s, y preguntar a Telegram doce veces por minuto
   es maltratar una API que tiene sus propios límites; `getState()` de WhatsApp además cruza
   Puppeteer y no es gratis. **El estado pasivo se sirve siempre fresco; el activo, cada 30 s.**
4. **Tres colores, no dos:** verde sólo con nivel 2 (y 3 donde se pueda), **ámbar cuando lo único
   que hay es la afirmación del canal**, rojo con fallo probado. **Un canal nunca se pinta verde por
   el nivel 1.**

## 4ter · Cómo se prueba cada uno, y la bandera que yo no estaba usando

Tres preguntas del dueño. **Las tres tenían razón en algo**, y una corrige el diseño.

### 4ter.1 · Telegram: el eco YA EXISTE, y es el propio funcionamiento

La explicación anterior era mala. Concretamente:

Un bot de Telegram **no recibe mensajes: los pide**. Cada pocos segundos el servicio llama a
`getUpdates` y Telegram responde con lo que haya llegado —a menudo, nada—. **Esa llamada es un ida y
vuelta completo** contra la API oficial, con el token dentro.

**Por eso no hace falta montar un eco: el eco es el bucle.** Si `getUpdates` devuelve, entonces:

- hay **red** hasta `api.telegram.org` (el fallo de las seis horas era DNS: esto lo habría cazado),
- el **token vale** (uno revocado da 401),
- **no hay un webhook** robando las actualizaciones (daría 409),
- y **la ruta por la que llegan los mensajes es exactamente ésa**.

**No es una inferencia sobre la recepción: es la recepción.** Lo único que hay que hacer es
**enseñar el resultado**, que hoy se guarda en `ultimoError` y `estado()` tapa (§4bis).

`getMe` sirve para el arranque y para dar el `@usuario`, pero **no aporta nada que el bucle no
pruebe ya**. Se mantiene sólo como comprobación de arranque.

### 4ter.2 · WhatsApp: **SÍ hay una bandera, y es mejor de lo que yo decía**

Pregunta directa del dueño: *«¿estás seguro de que no existe ninguna bandera, un `on error`?»*.

**No hay un evento genérico de error** —comprobados los 31 eventos de la librería, no existe—
**pero hay algo mejor: `change_state`**, con doce estados explícitos:

| Estado | Qué significa |
|---|---|
| `CONNECTED` | La sesión funciona |
| `OPENING` · `PAIRING` · `UNLAUNCHED` | Arrancando |
| **`CONFLICT`** | **Otro dispositivo se llevó la sesión.** El canal está muerto y lo dice |
| **`TOS_BLOCK` · `SMB_TOS_BLOCK`** | **BLOQUEADO POR WHATSAPP.** El baneo, con nombre propio |
| **`DEPRECATED_VERSION`** | La versión de WhatsApp Web que usa la librería ya no vale — *«WhatsApp cambió bajo nuestros pies»*, señalado |
| `PROXYBLOCK` · `TIMEOUT` | Red bloqueada o caída |
| `UNPAIRED` · `UNPAIRED_IDLE` | Sesión perdida |

⚠️ **Y nuestro canal NO escucha `change_state`.** Comprobado: escucha `qr`, `authenticated`,
`loading_screen`, `ready`, `disconnected`, `auth_failure` y `message`. **Ninguno de los siete cubre
`CONFLICT`, `TOS_BLOCK` ni `DEPRECATED_VERSION`**, así que hoy los tres pasarían en silencio dejando
`conectado: true` — la misma mentira que el de Telegram, por otra puerta.

**Esto sube el nivel 3 de WhatsApp de «imposible» a «casi».** No prueba que un mensaje ajeno llegue,
pero **sí detecta explícitamente los tres modos de muerte que importan**, incluido el baneo, que era
justo lo que había que adivinar.

### 4ter.3 · El eco: qué probaría, qué no, y el riesgo de baneo

Propuesta del dueño: que el bot **mande o responda mensajes cada cierto tiempo** para comprobar que
la recepción va.

**En Telegram no hace falta** (§4ter.1). Y además un bot **no puede escribir primero** a quien no lo
haya iniciado, así que ni siquiera habría a quién.

**En WhatsApp hay dos formas, y no valen lo mismo:**

| | Qué prueba | Riesgo |
|---|---|---|
| **Eco a uno mismo** — el número se escribe a su propio chat | Que la página vive y que **el envío** funciona | Bajo: nadie lo recibe, **nadie puede bloquear ni reportar** |
| **Canario** — un SEGUNDO número escribe al bot cada X | **La recepción de verdad, extremo a extremo** | Bajo, y es la respuesta *dentro de una conversación*, la más segura |

⚠️ **El eco a uno mismo NO habría cazado el fallo de hoy.** Los mensajes propios llegan con
`fromMe` y por otro camino; el `@lid` sólo aparece en un mensaje **de otra persona**. Un eco que no
prueba lo que se rompe **es un verde falso más**, y de ésos ya hemos tenido bastantes.

**El canario sí lo habría cazado**, porque es exactamente un desconocido escribiendo.

#### El riesgo de baneo, con lo que se sabe

Lo que dispara los bloqueos de WhatsApp es **el envío masivo, el mensaje no solicitado a quien no te
tiene, y los bloqueos y denuncias que eso provoca**. Un eco a uno mismo no tiene destinatario que
pueda denunciar; un canario responde **dentro de una conversación que abrió el otro**.

**El riesgo de fondo no lo pone el eco: lo pone usar una librería no oficial**, y ese riesgo ya está
asumido y escrito. Lo que sí importa es **la frecuencia**: uno por minuto son 1 440 mensajes
automáticos al día, un patrón que se ve; **uno cada 30 minutos son 48**, y con `change_state` como
detector principal, con eso sobra.

⚠️ **Y hay una razón para no tener prisa con el eco:** `TOS_BLOCK` **avisa del baneo directamente**.
Montar tráfico automático para detectar un problema que la propia plataforma ya nos notifica sería
pagar riesgo por una información que llega gratis.

### 4ter.4 · Lo que queda, entonces

| | Telegram | WhatsApp |
|---|---|---|
| **Nivel 2** — la plataforma responde | ✅ el bucle | ✅ `getState()` + `change_state` |
| **Nivel 3** — puede recibir | ✅ **probado**: el bucle *es* la recepción | 🟡 **los modos de muerte, detectados** (conflicto, baneo, versión caduca). La entrega de un mensaje ajeno, no |
| **Cerrar el hueco del todo** | — | **canario**, y cuesta un segundo número |

**Lo que hay que decidir:** si se monta el canario. **No entra en `C7`**: requiere una línea más y es
una decisión del dueño, no de diseño. Con `change_state` la pantalla ya deja de mentir, que es lo
que esta tarea tenía que resolver.

## 5 · Qué se ve

```
┌─ Canales de mensajería ─────────────────────────────────────────────┐
│                                                                     │
│  ● Telegram        conectado · @deasy_test_bot                      │
│                    desde hace 3 h 12 min                            │
│                                                                     │
│  ● WhatsApp        SIN VINCULAR · esperando que alguien escanee     │
│                    ┌───────────────┐                                │
│                    │   [ QR ]      │  ⚠️ Quien escanee este código   │
│                    │               │  vincula el canal a SU cuenta  │
│                    └───────────────┘  de WhatsApp.                  │
│                    caduca en 14 s · se renueva solo                 │
│                                                                     │
│  ○ Servicio        NO RESPONDE — el contenedor puede estar caído    │
└─────────────────────────────────────────────────────────────────────┘
```

**El aviso junto al QR no es decoración**: es lo único que separa «vincular el canal» de «escanear
un código porque estaba ahí».

---

## 6 · Dónde encaja, pieza por pieza

| | Qué se añade |
|---|---|
| **`channels`** | Un servidor HTTP mínimo con **`GET /estado`**, protegido por la clave de servicio. Devuelve el `estado()` de cada canal montado. **Sin puerto publicado** |
| **Backend** | `GET /admin/canales` (estado) y `GET /admin/canales/qr` (el QR, sólo si hace falta vincular). Un cliente hacia `channels`, hermano del que ya existe hacia el firmador |
| **RBAC** | Un recurso nuevo, **`channels`** — el catálogo pasa de 13 recursos a 14, y de 65 permisos a 70. `read` para ver, **`manage` para el QR** |
| **Frontend** | Una **pestaña hermana** en la sección `institucion`, con el patrón que ya usan el Organigrama y el Mapa de procesos (`__unit_graph__`, `__process_graph__`) — **no es una tabla y ya hay sitio para eso** |
| **Ruta** | `/admin/institucion/canales`. La URL **es** el estado de navegación, como el resto del admin |

⚠️ **Se aprovecha un patrón que ya existe.** Organigrama y Mapa de procesos ya son pestañas que no
son tablas: esto es la tercera, no una excepción nueva.

---

## 6bis · El JSON que viaja, campo por campo

Son **dos saltos y cuatro rutas**. El QR **viaja por su propia ruta**, nunca dentro del estado: así
no acaba en un registro, en una caché del navegador ni en la respuesta que ve quien sólo tiene
permiso de lectura.

```
navegador ─GET /admin/canales──────────▶ backend ─GET /estado───▶ channels
navegador ─GET /admin/canales/wa/qr────▶ backend ─GET /qr───────▶ channels
```

### Salto 1 · `channels` → backend · `GET /estado`

```json
{
  "servicio": {
    "arrancado": "2026-09-01T14:44:47.698Z",
    "reinicios": 0
  },
  "canales": [
    {
      "nombre": "telegram",
      "cuenta": "@deasy_test_bot",
      "salud": "sano",
      "evidencia": "sondeo",
      "detalle": "el sondeo responde",
      "desde": "2026-09-01T14:44:49.102Z",
      "ultimoError": null,
      "ultimoMensajeEn": "2026-09-01T15:03:58.689Z",
      "necesitaVinculacion": false
    },
    {
      "nombre": "whatsapp",
      "cuenta": "593983069990",
      "salud": "degradado",
      "evidencia": "afirmacion",
      "detalle": "la sesión dice estar lista, pero la plataforma no contesta",
      "estadoPlataforma": "TIMEOUT",
      "desde": "2026-09-01T14:44:55.031Z",
      "ultimoError": "Evaluation failed: page closed",
      "ultimoMensajeEn": "2026-09-01T15:03:58.689Z",
      "necesitaVinculacion": false
    }
  ]
}
```

### Los dos campos que son el diseño entero

**`salud`** — el veredicto. **Nunca un booleano**, porque un booleano fue exactamente lo que mintió:

| Valor | Cuándo |
|---|---|
| `sano` | Probado por el nivel 2 o 3 |
| `degradado` | **El canal dice estar bien pero la comprobación activa no lo confirma**, o arrastra un `ultimoError` |
| `sin_vincular` | WhatsApp esperando que alguien escanee |
| `bloqueado` | `TOS_BLOCK` · `CONFLICT` · `DEPRECATED_VERSION` — **merece ser distinto de «caído»**: no se arregla reiniciando |
| `caido` | Sin arrancar, o `disconnected` |
| `desconocido` | No se pudo comprobar nada |

**`evidencia`** — **de dónde sale ese veredicto**, y es lo que permite el ámbar:

| Valor | Qué lo respalda |
|---|---|
| `sondeo` | El bucle de Telegram funcionó. **El nivel 3: es la recepción misma** |
| `plataforma` | `getState()` de WhatsApp contestó. Nivel 2 |
| `afirmacion` | **Sólo la bandera interna del canal.** Nivel 1 — el que mintió |

> ⚠️ **La regla de pintado sale de aquí y no se negocia: con `evidencia: "afirmacion"` la pantalla
> NUNCA pinta verde.** Ámbar, y dice por qué. Todo lo anterior de esta tarea existe porque una
> afirmación se pintó como una prueba.

### Los demás campos, y qué defecto cierra cada uno

| Campo | Por qué está |
|---|---|
| `desde` | Sin él, «caído» no distingue *un minuto* de *trece horas*. La caída del 2026-08-31 duró trece |
| `ultimoError` | **Existía y `estado()` lo tapaba** (§4bis). Es el `EAI_AGAIN` que nadie vio en seis horas |
| `ultimoMensajeEn` | El nivel 4. **Dato, no semáforo**: valioso en un canal con tráfico diario, ruido en uno que pasa días quieto |
| `estadoPlataforma` | El `WAState` **crudo**. Que la pantalla pueda decir `TOS_BLOCK` con su nombre en vez de traducirlo a un genérico que no ayuda a nadie |
| `reinicios` | Un canal que se reinicia solo cada pocos minutos está *sano* en cada foto y roto en conjunto |
| `necesitaVinculacion` | Lo único que autoriza a pedir el QR |

⚠️ **Lo que NO viaja, en ninguno de los dos saltos:** el token del bot, `INTERNAL_SERVICE_KEY`, el
texto de ningún mensaje, ni el número de nadie que haya escrito. `cuenta` es **nuestra** —el bot y el
número dedicado—, y ya es pública: va en cada enlace `wa.me` que se le enseña a un usuario.

### Salto 2 · backend → navegador · `GET /admin/canales`

Lo mismo, **más dos cosas que sólo el backend sabe**:

```json
{
  "servicio": {
    "alcanzable": true,
    "arrancado": "2026-09-01T14:44:47.698Z",
    "reinicios": 0,
    "comprobadoEn": "2026-09-01T22:31:05.412Z"
  },
  "puedeVerQr": true,
  "canales": [ … igual que arriba … ]
}
```

**Y cuando `channels` no contesta —que es el caso que motivó esta pantalla:**

```json
{
  "servicio": {
    "alcanzable": false,
    "error": "connect ECONNREFUSED channels:3050",
    "comprobadoEn": "2026-09-01T22:31:05.412Z"
  },
  "puedeVerQr": false,
  "canales": []
}
```

⚠️ **`canales: []` y no `null`, y la respuesta es `200`.** No poder hablar con el servicio **no es
un error de la pantalla: es el estado del sistema**, y es exactamente lo que se quería saber el día
que estuvo trece horas muerto. Un `500` lo habría enseñado como «la pantalla falla», que es la
lectura equivocada.

**`comprobadoEn`** es del backend a propósito: dice **cuándo se preguntó**, no cuándo se generó nada.
Si por lo que sea la respuesta viniera de una caché, se vería en ese campo.

### Salto 2 · el QR · `GET /admin/canales/whatsapp/qr`

```json
{ "qr": "data:image/png;base64,iVBORw0KGgo…", "generadoEn": "2026-09-01T22:31:02.006Z" }
```

| Situación | Respuesta |
|---|---|
| Sin `channels.manage` | **`403`** — con `read` se ve el estado, no el QR |
| `necesitaVinculacion: false` | **`409`**, con motivo. **No hay QR que dar**, y no lo hay para nadie |
| El canal no está montado | `404` |

⚠️ **`generadoEn`, y no `expiraEn`.** La librería **no dice** cuánto vive un QR: rondan los 20 s pero
no lo promete nadie. Mandar un `expiraEn` sería inventarse una precisión que no tenemos; con
`generadoEn` la pantalla enseña *«generado hace 6 s»* y **se renueva sola**, que es verdad y basta.

## 7 · Lo que este diseño NO hace, y por qué

- **Ningún botón de reiniciar el canal.** Sería un apagado remoto a disposición de quien tenga el
  permiso, y para reiniciar ya está `stack.sh`. Si algún día se quiere, va con confirmación y
  registro — pero **no entra aquí de gorra**.
- **Ningún botón de «regenerar QR».** No hace falta: mientras el canal está sin vincular,
  `whatsapp-web.js` emite uno nuevo solo cada ~20 s. Un botón que promete algo que ya pasa sin él
  sólo sirve para que alguien lo pulse y crea que hizo algo.
- **No sustituye a `scripts/canales.sh`.** El script sigue siendo la vía cuando **la propia
  aplicación está caída**, que es justo cuando más falta hace mirar.

---

## 8 · Lo que hay que aprobar

1. **Las cuatro reglas del QR** (§3), en especial que `read` y `manage` sean permisos distintos.
1bis. **Los cinco niveles de comprobación** (§4bis): comprobación activa con caché de 30 s, tres
   colores, y **decir en pantalla que la recepción de WhatsApp no se puede probar**.
1ter. **Escuchar `change_state`** (§4ter): detecta el conflicto de sesión, la versión caduca y **el
   baneo**, que hoy pasan en silencio.
1quater. **El contrato JSON** (§6bis): `salud` como enumeración en vez de un booleano, `evidencia`
   para saber qué respalda cada veredicto, y el **QR por su propia ruta**.

⚠️ **El canario queda DESCARTADO por decisión del dueño (2026-09-01).** Telegram se prueba con su
propio sondeo y WhatsApp con `change_state`; no se monta tráfico automático ni un segundo número.
2. **Preguntar en vez de guardar** (§4), con sondeo de 5 s.
3. **Un recurso RBAC nuevo**, `channels`: 13 → 14 recursos, 65 → 70 permisos.
4. **Sólo lectura**: sin botones de reinicio (§7).
