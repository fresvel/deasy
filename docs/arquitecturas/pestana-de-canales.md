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
2. **Preguntar en vez de guardar** (§4), con sondeo de 5 s.
3. **Un recurso RBAC nuevo**, `channels`: 13 → 14 recursos, 65 → 70 permisos.
4. **Sólo lectura**: sin botones de reinicio (§7).
