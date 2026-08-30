# `channels` — la pasarela de canales de mensajería

> **Qué es.** Un servicio aparte que **sostiene conexiones** con Telegram, WhatsApp y un
> receptor de SMS, para que una persona pueda **demostrar que un número de teléfono es
> suyo**.
>
> **Qué NO es.** No es «el servicio de verificación». No decide nada, no guarda códigos y
> no toca la base de Deasy. Esa distinción es de diseño, no de estilo: un servicio que no
> sabe decir que no crece hasta ser el sistema entero.
>
> **Estado.** Diseño aprobado por el dueño el 2026-08-29. **Sin implementar.**

---

## 1 · Por qué existe, y qué habría pasado sin él

La regla que decide qué vive dónde:

> **El servicio guarda CONEXIONES. El backend hace LLAMADAS.**

| | Qué es | Dónde vive |
|---|---|---|
| Telegram sondeando | una conexión que hay que mantener abierta | **el servicio** |
| Sesión de WhatsApp | una conexión, con navegador y estado en disco | **el servicio** |
| Módem o receptor de SMS | una conexión a hardware o a un proveedor | **el servicio** |
| Correo por SMTP | una llamada que empieza y acaba | el backend *(ya está ahí)* |
| SMS **saliente** por proveedor | una llamada que empieza y acaba | el backend *(si algún día entra)* |

**Sin esa regla, el servicio se habría comido el correo** —cuya verificación ya funciona en
el backend, con su tabla, su código cifrado, sus diez minutos y su uso único— y habría
acabado siendo un segundo backend.

**Y si sólo hubiera Telegram, este servicio no existiría.** Telegram no arrastra navegador
ni guarda nada: cabría en el backend. Lo que justifica la separación es **el navegador de
WhatsApp** y **el aparato del SMS**: procesos pesados, con estado en disco y que sólo
pueden correr en **una** instancia. Meterlos en el backend lo volvería pesado, con estado,
y lo ataría a una réplica.

---

## 2 · Los tres canales, y para quién es cada uno

| | La mejor opción para | Qué le cuesta al usuario |
|---|---|---|
| **Telegram** | Quien tiene móvil con datos y no le importa instalar | nada |
| **WhatsApp** | Quien ya lo tiene — en Ecuador, casi todo el mundo | nada |
| **SMS entrante** | Quien no quiere instalar nada, o tiene un **teléfono básico** | un SMS normal |

Se ofrecen **en ese orden**. El tercero existe porque es el único que funciona **sin
aplicación, sin datos y en cualquier teléfono**.

### En los tres, el usuario es quien empieza

No es un detalle de implementación: **es lo que hace que todo esto sea posible y barato.**

- Un bot de Telegram **no puede escribir primero** a quien no lo haya iniciado. Con el QR,
  lo inicia el usuario — y la limitación deja de existir.
- El bombeo de SMS —disparar códigos a números de tarifa premium del atacante para cobrar
  parte de lo que tú pagas— **vive de que TÚ envíes**. Si sólo recibes, **quien lo dispare
  paga él**. El ataque no se mitiga: no existe.
- Y casi todo lo que los operadores vigilan es **tráfico saliente**. Una SIM que sólo
  recibe se parece a un teléfono, no a una caja SIM.

**Coste por mensaje del sistema: cero, en los tres.**

---

## 3 · Cómo se verifica un número

### Lo común

1. El backend genera una **llave** de un solo uso, con caducidad corta, ligada a *esta*
   petición de verificación de *este* número.
2. La pantalla le enseña al usuario **cómo entregar esa llave** por el canal que elija.
3. El canal recibe algo. El servicio le pregunta al backend por la llave.
4. **Tres comprobaciones**, y las tres tienen que pasar:

   | | Qué impide |
   |---|---|
   | La llave existe, no ha caducado y no se ha usado | Reutilizar una llave vista antes |
   | El número que llega es **el que se pidió verificar** | Verificar el número de otro |
   | El remitente es **quien dice ser** (ver cada canal) | Reenviar la tarjeta de contacto ajena |

5. El servicio se lo cuenta al backend. **El backend** marca el teléfono como verificado.

### La costura, ya construida (C2, 2026-08-30)

Tres rutas y una tabla. Las dos internas **no las alcanza un navegador**:

| Ruta | Quién la llama | Qué hace |
|---|---|---|
| `POST /users/me/telefonos/:id/verificacion` | el navegador, con sesión | Emite la llave y devuelve **los enlaces ya compuestos** |
| `POST /internal/verificacion/resolver` | `channels` | De qué número es esta llave — o por qué no vale |
| `POST /internal/verificacion/consumir` | `channels` | La gasta y marca el canal |

**Dos capas protegen `/internal/`, y las dos hacen falta.** nginx devuelve **404** para
`/api/internal/`, porque el proxy publica el backend entero bajo `/api/` — sin esa regla estas rutas
estarían en internet. Y el backend exige una **clave compartida** (`INTERNAL_SERVICE_KEY`), por si
esa regla se copia mal en otro entorno. El guard responde **404 y no 401**: un 401 confirmaría que la
ruta existe. Y **503 si la clave no está puesta**, nunca 200 — un despliegue olvidadizo se queda
cerrado, no abierto.

**Lo que emite la pantalla depende del despliegue.** Un canal sin configurar **no aparece**; no viaja
como `null`. Y con **cero** canales la petición responde **503 sin gastar una llave**: devolver un
200 con tres enlaces nulos sería un fallo de despliegue disfrazado de éxito.

**Cuatro estados, no dos.** `válida`, `desconocida`, `caducada` y `consumida` — porque al usuario le
dicen cosas distintas: sólo las dos últimas significan «repite sin cambiar nada». Colapsarlas es un
cambio silencioso, ya que las cuatro respuestas comparten código HTTP.

⚠️ **Un 409 al consumir NO es una avería.** Significa que la llave dejó de valer entre resolver y
confirmar —dos mensajes casi a la vez, o dos pulsaciones—, y al usuario hay que decirle «pide otra»,
no «error interno». Es el único código que `ClienteDeDeasy` **no** convierte en excepción.

⚠️ **De la llave se guarda sólo su huella SHA-256**, y eso es deliberado frente a bcrypt: aquí hay
que **buscar por la llave** que llega, y una huella con sal no se puede buscar. No es una contraseña
—dura quince minutos, un solo uso, 256 bits aleatorios—, así que lo que bcrypt protege no aplica.

⚠️ **La ruta del navegador vive bajo `/me/`, y el dueño sale del token.** Al escribir sus pruebas se
encontró que el servicio buscaba el teléfono **sólo por su id**: cualquiera con sesión pedía una
llave para el teléfono de otro y la respuesta le devolvía su número. Es el IDOR de los entregables
otra vez, por el mismo sitio. Un teléfono ajeno responde ahora **lo mismo que uno inexistente**, para
no convertir la ruta en un oráculo.

### Telegram

El QR codifica `t.me/<bot>?start=<llave>`. **Comprobado en la documentación: el parámetro
admite hasta 64 caracteres, sólo `A-Z a-z 0-9 _ -`** — de sobra para una llave aleatoria.

⚠️ **El bot NO recibe el número de quien le escribe.** Recibe un identificador de Telegram,
un nombre y quizá un alias. **El número, no.** Para obtenerlo responde con un **botón que
pide el contacto**; al pulsarlo, Telegram envía `phone_number`, `user_id` y `first_name`
desde su propio registro — no tecleado por el usuario.

⚠️ **Y de ahí sale la tercera comprobación:** hay que exigir que el `user_id` del contacto
**coincida con el identificador de quien escribe**. Sin eso, cualquiera puede reenviar la
tarjeta de contacto **de otra persona** y verificar un número ajeno.

⚠️ **El QR no sirve si se registra desde el móvil**: no puede escanear su propia pantalla.
Hace falta **también un enlace pulsable** que abra Telegram en el mismo aparato. Es fácil,
pero hay que diseñarlo desde el principio, no parchearlo después.

### WhatsApp

Mismo patrón, con un enlace que abre WhatsApp con el mensaje ya escrito hacia el número de
la institución. El servicio lo recibe por su sesión.

Aquí el número **llega con el mensaje**: no hace falta pedir nada. La tercera comprobación
se cumple sola.

### SMS entrante

El usuario manda un SMS con la llave al número publicado.

**Es el más limpio de los tres:** el número del remitente **viene en la cabecera del
mensaje**. No hay que pedir un contacto ni comparar con nada tecleado — **lo prueba el
propio transporte**.

⚠️ **Su límite, y hay que decirlo en la pantalla:** un SMS internacional a Ecuador no
cuesta céntimos, y este sistema **atiende a extranjeros a propósito**. Es justo la
población para la que este canal es peor — por eso va tercero, no primero.

---

## 4 · Quién posee qué

| | Backend | `channels` |
|---|---|---|
| Generar la llave y caducarla | ✅ | |
| Decidir si una verificación vale | ✅ | |
| Marcar el teléfono como verificado | ✅ | |
| Verificación de **correo** | ✅ *(ya funciona)* | |
| Mantener las conexiones | | ✅ |
| La sesión de WhatsApp | | ✅ **lo único que guarda** |

**El servicio no toca la base de Deasy.** Pregunta y cuenta por HTTP; el backend decide.

---

## 5 · Las piezas

### `Canal` — el contrato, y lo único polimórfico

```
iniciar()  ·  detener()  ·  estado()
                          ↳ emite: mensajeRecibido(remitente, texto, contacto?)
```

Tres implementaciones:

- **`CanalTelegram`** — sondeo, enlace profundo, petición de contacto. Sin navegador y sin
  estado: sólo una credencial.
- **`CanalWhatsApp`** — una sesión, un navegador, su carpeta en un volumen.
- **`CanalSmsEntrante`** — un módem o un número alquilado. Sólo recibe.

### `VerificacionDeTelefono`

Recibe un mensaje ya normalizado y hace **las tres comprobaciones**. **Una clase, sin
jerarquía**: hay una política, no varias. Si algún día hay otra cosa que interpretar, será
**otro manejador**, no una jerarquía sobre éste.

### `ClienteDeDeasy`

**El único sitio del servicio que llama al backend.** Ahí viven la dirección, la clave
compartida, qué hacer si no responde y la forma exacta de las dos peticiones. Si cambia
cualquiera de las cuatro, **se toca un fichero**.

Es el mismo criterio que `httpClient` en el frontend, que
[`referencia/patrones-diseno.md`](../planes/referencia/patrones-diseno.md) nombra como uno
de los tres sitios donde un patrón se gana el sueldo.

### La capa HTTP

Transporte y nada más, como manda la norma de capas del repositorio.

---

## 6 · Las cinco preguntas de la norma, contestadas

De [`referencia/patrones-diseno.md`](../planes/referencia/patrones-diseno.md) §6, en su orden.

**1 · ¿Es duplicación?** No. Los tres canales no comparten una línea: uno sondea una API,
otro conduce un navegador, el tercero lee de un puerto.

**2 · ¿Es una cascada de condicionales sobre datos?** No. No es un `switch` sobre un valor:
son **tres formas de conectarse** que no se parecen en nada.

**3 · ¿Hay un eje real de variación?** **Sí, y es el único del diseño.** El canal se elige
**en ejecución**, y son tres —con un cuarto posible: la app propia—. Con dos era
defendible; **con tres deja de discutirse**.

**4 · ¿Tengo red?** **No, y eso fija el orden.** La política de verificación se prueba con
**canales falsos** antes de conectar nada real. Las tres comprobaciones son lógica pura y
no necesitan ni Telegram ni un módem para probarse.

**5 · ¿Menos piezas o más?** Cuatro clases con un oficio cada una y **una sola jerarquía**,
la del canal. La política **no** se polimorfiza «por si acaso».

⚠️ **Lo que este diseño NO hace, y se documenta para que no vuelva:** en una versión
anterior tenía `Sesion` con dueño y un `RegistroDeSesiones` con tope y desalojo, para que
cada usuario vinculara **su** WhatsApp. Era **sobrediseño**, y además ponía a los usuarios
en riesgo de bloqueo. Se descartó el 2026-08-29 a favor de algo más simple: para escribirle
a alguien basta **un enlace** que abre el WhatsApp del propio usuario (ver §9).

---

## 7 · Escalar: por qué dejó de ser un problema

Con multisesiones habría **una sesión por persona**, y con ella un tope de memoria, desalojo
de inactivas y reparto entre instancias.

Quitado eso, son **tres conexiones fijas que no crecen con los usuarios**. El servicio corre
en **una instancia**, y eso no es una limitación disfrazada: **no hay nada que repartir**.

⚠️ **Dos ataduras que hay que escribir para que no sorprendan:**

- **El sondeo de Telegram admite exactamente un consumidor.** Con dos instancias se pelean
  por los mismos mensajes. Se resuelve pasando al modo en que Telegram llama al servicio
  —que sí se reparte— pero eso exige una dirección pública.
- **La sesión de WhatsApp vive en el proceso que la abrió** y no se puede mover en caliente.

---

## 8 · Despliegue y administración

**No lo alcanza el navegador**, igual que el firmador — comprobado: el firmador no está
publicado en el proxy y sólo el backend habla con él.

**Lo que hay que administrar es una cosa:** alguien tiene que **ver un QR y escanearlo** con
un teléfono para vincular la sesión de WhatsApp. Más el estado de cada canal.

⚠️ **Y ahí está el riesgo:** quien vea ese QR **vincula la sesión a su propio teléfono**. Es
una toma de control. Por eso **no tiene front propio**: sería un segundo sistema de acceso
que mantener, con su propia lista de quién puede qué.

**La pantalla es una pestaña del admin de Deasy, y el backend retransmite.** Así «quién puede
administrar los canales» es **un permiso más** de los que ya existen, y el servicio se queda
en la red interna.

**El número de WhatsApp es una línea dedicada**, ni la principal de la institución ni
rotatoria: su pérdida cuesta volver a vincular y avisar, no la identidad.

**Y el SMS no ata a un aparato.** Existe la misma idea alquilando a un proveedor un número
que recibe. Detrás **de la misma interfaz**, así que «módem propio o número alquilado» es una
decisión de **despliegue**, no de diseño.

---

## 9 · Escribirle a alguien por WhatsApp: eso NO es este servicio

Cuando alguien de la institución quiera escribir a un aspirante, la pantalla compone
`https://wa.me/<prefijo><número>` y abre **el WhatsApp del propio usuario**.

**Sin sesión, sin navegador, sin memoria y sin riesgo de bloqueo** — porque escribe la
persona desde su móvil, no el servidor. Es **front y backend**, no `channels`.

El dato está: el modelo guarda **el número local y el prefijo del país por separado**
(`telefonos.numero` y `paises.phone_code`), y el propio esquema explica que es a propósito.

⚠️ **El formato muerde:** prefijo **sin el `+`** y número **sin el cero inicial**.
`0991112233` de Ecuador es `593991112233`, no `5930991112233`. Va en **una función con
pruebas, en un solo sitio** — no repetida en cada pantalla que quiera un botón.

---

## 10 · Lo que falta decidir, y no lo decide el código

**El límite de intentos.** No existe ninguno en el backend: 18 dependencias, ninguna de
límite ni de caché, y **no hay Redis en ninguna pila**. Hace falta aunque no hubiera
canales: protege el acceso, el registro y `/recover-email`. Y hay que limitar **por número
de destino**, no sólo por origen, o el sistema sirve para molestar a terceros.

**Si el SMS entrante arranca con módem propio o con número alquilado.**

**Qué pasa con quien ya está registrado** el día que la verificación se vuelva obligatoria:
o se les respeta lo que tienen, o se les hace pasar por el circuito.

---

## 11 · Lo que NO puedo afirmar sin comprobarlo

Está verificado contra la documentación de Telegram: el límite de 64 caracteres del enlace
profundo, que el bot **no** recibe el número, que el contacto trae `phone_number` y
`user_id`, y que sondeo y aviso por dirección pública son **excluyentes**.

**No** está verificado, y hay que mirarlo antes de escribir código:

- El detalle actual de `whatsapp-web.js` — **su código anterior en este repositorio lleva
  años muerto y tenía errores; se escribe de nuevo**, contra su documentación de hoy.
- El detalle regulatorio ecuatoriano de recibir SMS en líneas de consumidor. El riesgo es
  **mucho menor** que enviando, pero eso lo confirma quien conozca la norma local.

---

## Documentos relacionados

- [`referencia/patrones-diseno.md`](../planes/referencia/patrones-diseno.md) — cuándo un
  patrón se gana el sueldo. Sus cinco preguntas están contestadas en §6.
- [`identidad-sin-pais-fijo-2026-08.md`](../planes/identidad-sin-pais-fijo-2026-08.md) — la
  tarea `I10`, que este servicio desbloquea.
- [`frontend-identidad-2026-08.md`](../planes/frontend-identidad-2026-08.md) — la tarea
  `F4d`: `verificado` no lo pone nadie salvo la siembra. Este servicio es el flujo que le falta.
