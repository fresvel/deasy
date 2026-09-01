# `channels` — la pasarela de canales de mensajería

> **Qué es.** Un servicio aparte que **sostiene conexiones** con Telegram y WhatsApp, para que
> una persona pueda **demostrar que un número de teléfono es suyo**.
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
| Correo por SMTP | una llamada que empieza y acaba | el backend *(ya está ahí)* |

**Sin esa regla, el servicio se habría comido el correo** —cuya verificación ya funciona en
el backend, con su tabla, su código cifrado, sus diez minutos y su uso único— y habría
acabado siendo un segundo backend.

**Y si sólo hubiera Telegram, este servicio no existiría.** Telegram no arrastra navegador
ni guarda nada: cabría en el backend. Lo que justifica la separación es **el navegador de
WhatsApp**: un proceso pesado, con estado en disco —una sesión vinculada a un teléfono— y que
sólo puede correr en **una** instancia. Meterlo en el backend lo volvería pesado, con estado, y
lo ataría a una réplica. El sondeo de Telegram tiene la misma atadura por otra razón: entrega
cada actualización **una sola vez**, así que dos procesos sondeando se roban los mensajes.

---

## 2 · Los canales, y para quién es cada uno

| | La mejor opción para | Qué le cuesta al usuario |
|---|---|---|
| **Telegram** | Quien tiene móvil con datos y no le importa instalar | nada |
| **WhatsApp** | Quien ya lo tiene — en Ecuador, casi todo el mundo | nada |

Se ofrecen **en ese orden**: Telegram primero porque su sesión no se cae y su API es oficial;
WhatsApp después porque depende de una sesión vinculada a un teléfono, con una librería que la
plataforma no autoriza.

⚠️ **Hubo un tercero, el SMS entrante, y se descartó** (§3). Era el único que funcionaba sin
aplicación y sin datos — eso se pierde, y hay que decirlo: **quien no tenga ninguna de las dos
aplicaciones no puede verificar su teléfono hoy**. Lo que se gana es no aceptar como prueba algo
que no lo es.

### En los dos, el usuario es quien empieza

No es un detalle de implementación: **es lo que hace que todo esto sea posible y barato.**

- Un bot de Telegram **no puede escribir primero** a quien no lo haya iniciado. Con el QR,
  lo inicia el usuario — y la limitación deja de existir.
- El bombeo de SMS —disparar códigos a números de tarifa premium del atacante para cobrar
  parte de lo que tú pagas— **vive de que TÚ envíes**. Si sólo recibes, **quien lo dispare
  paga él**. El ataque no se mitiga: no existe. Y desde que el SMS quedó descartado
  (2026-09-01) esto es **permanente**: el OTP saliente era la única variante que lo habría
  reabierto.
- Y casi todo lo que los operadores vigilan es **tráfico saliente**. Una SIM que sólo
  recibe se parece a un teléfono, no a una caja SIM.

**Coste por mensaje del sistema: cero, en los dos.**

---

## 3 · Cómo se verifica un número

### Lo común

1. El backend genera una **llave** de un solo uso, con caducidad corta, ligada a *esta*
   petición de verificación de *este* número.
2. La pantalla le enseña al usuario **cómo entregar esa llave** por el canal que elija.
3. El canal recibe algo. El servicio le pregunta al backend por la llave.
4. **Tres comprobaciones**, y las tres tienen que pasar:

   | | Quién la hace | Qué impide |
   |---|---|---|
   | La llave existe, no ha caducado y no se ha usado | el backend | Reutilizar una llave vista antes |
   | El número que llega es **el que se pidió verificar** | **el backend** | Verificar el número de otro |
   | El remitente es **quien dice ser** (ver cada canal) | el canal | Reenviar la tarjeta de contacto ajena |

   ⚠️ **La segunda cambió de dueño el 2026-08-30 (C2b), y no por gusto.** La hacía el servicio, que
   **no sabe de qué país es el número guardado** y por eso sólo podía comparar la cola: los últimos
   ocho dígitos. Con esa regla `+51 99 111 2233` y `+593 99 111 2233` son el mismo teléfono —medido,
   no supuesto—, así que se podía registrar el número de otra persona y verificarlo desde una línea
   propia de otro país con la misma cola. El backend sí sabe el país (`telefonos.pais_id` ->
   `paises.phone_code`) y compara en E.164 exacto.

   El principio que lo ordena, y que vale para el resto del servicio: **un subordinado reporta lo
   que OBSERVÓ, no un veredicto.** El canal aporta un hecho que su transporte prueba —«este número
   mandó esta llave»—; concluir es de quien tiene los datos.

5. El servicio se lo cuenta al backend. **El backend** marca el teléfono como verificado.

### La costura, ya construida (C2, 2026-08-30)

Tres rutas y una tabla. Las dos internas **no las alcanza un navegador**:

| Ruta | Quién la llama | Qué hace |
|---|---|---|
| `POST /users/me/telefonos/:id/verificacion` | el navegador, con sesión | Emite la llave y devuelve **los enlaces ya compuestos** |
| `POST /internal/verificacion/estado` | `channels` | **Sonda**: ¿esta llave sigue viva? Y nada más — **no devuelve el número** |
| `POST /internal/verificacion/confirmar` | `channels` | «Este número mandó esta llave por este canal». **Compara y consume, en una transacción** |

⚠️ **La sonda existe por Telegram**, y no es un resto del diseño anterior: su bot tiene que **pedir
el contacto en un segundo paso**, y pedírselo a alguien cuya llave no vale es hacerle compartir sus
datos para nada. Devuelve el estado y nunca el número.

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

⚠️ **Un 409 al confirmar NO es una avería.** Cubre los cuatro rechazos —llave desconocida, caducada,
consumida y **número distinto**—, y al usuario hay que decirle qué pasó, no «error interno». Es el
único código que `ClienteDeDeasy` **no** convierte en excepción.

⚠️ **Comparar y consumir van en UNA transacción**, y el `UPDATE` lleva `consumida_at IS NULL` con el
número de filas comprobado. Sin eso, dos mensajes a la vez confirmarían los dos. Se prueba con dos
peticiones en paralelo: gana una y la otra pierde limpiamente — **secuencialmente esa rama no se
alcanza nunca**, porque la segunda ya lee la llave como consumida.

⚠️ **Dos cosas distintas responden 404 a `channels`**: el endpoint cuando la llave no vale, y el
guard cuando la clave compartida no es la buena —que contesta 404 a propósito—. Se distinguen por el
cuerpo: el endpoint siempre manda `estado`; el guard, un `message`. **Sin distinguirlas, una clave
mal puesta le diría «tu enlace no vale» a todo el mundo, para siempre y sin una pista de por qué.**

⚠️ **Un teléfono sin país NO se puede verificar**, y se dice al pedir la llave, no al final del
camino. `telefonos.pais_id` es nullable y el caso existía de verdad: **el arranque creaba el teléfono
del administrador sin país**, o sea imposible de verificar por definición. Ahora lo hereda de
`instituciones`, igual que el documento nacional.

⚠️ **De la llave se guarda sólo su huella SHA-256**, y eso es deliberado frente a bcrypt: aquí hay
que **buscar por la llave** que llega, y una huella con sal no se puede buscar. No es una contraseña
—dura quince minutos, un solo uso, 256 bits aleatorios—, así que lo que bcrypt protege no aplica.

⚠️ **La ruta del navegador vive bajo `/me/`, y el dueño sale del token.** Al escribir sus pruebas se
encontró que el servicio buscaba el teléfono **sólo por su id**: cualquiera con sesión pedía una
llave para el teléfono de otro y la respuesta le devolvía su número. Es el IDOR de los entregables
otra vez, por el mismo sitio. Un teléfono ajeno responde ahora **lo mismo que uno inexistente**, para
no convertir la ruta en un oráculo.

### Telegram

⚠️ **EL BOTÓN DE CONTACTO NO SE PINTA SOLO**, y hay que decirle a la persona dónde está. Comprobado
con un iPhone real el 2026-08-30: Telegram aceptó **tres variantes distintas** del teclado y ninguna
apareció; estaba plegado tras el icono de cuadrícula (▦) del campo de escribir. En escritorio pasa
lo mismo. El texto del canal lleva esa instrucción, y quitarla vuelve a dejar a la gente atascada
sin saber por qué.

⚠️ **No ofrezcas «adjunta tu contacto con el clip» como alternativa.** Se probó y NO existe: esa
opción abre la agenda, y uno no está en su propia agenda.

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

⚠️ **«El número llega con el mensaje» ERA verdad y ya no lo es.** Aquí ponía que la tercera
comprobación se cumplía sola. **Falso desde `@lid`**, el identificador **opaco** al que WhatsApp
está migrando y con el que llegan hoy los mensajes: del `@lid` **no se deduce el teléfono** — está
diseñado precisamente para que no se pueda. Medido el 2026-09-01: cinco mensajes reales, los cinco
con `@lid`, y el canal los descartaba **en silencio**.

Lo que se hace es **preguntarle a WhatsApp** (`getContactLidAndPhone`, que consulta al servidor si
el mapeo no está en caché) y **rechazar si no responde con un teléfono**. La regla:
**quedarse sin saber es un resultado legítimo; inventárselo, no.**

Así que hoy **ninguno de los dos canales entrega el número gratis**: Telegram pide un segundo paso,
WhatsApp pide una resolución. Lo que ambos conservan —y es lo que vale— es que **el número lo afirma
la plataforma sobre una sesión autenticada**, no quien escribe.

### ❌ SMS entrante — descartado el 2026-09-01

⚠️ **Aquí ponía: «Es el más limpio de los tres: el número del remitente viene en la cabecera
del mensaje… lo prueba el propio transporte». ERA FALSO,** y era el cimiento sobre el que este
documento lo ponía por encima de los otros dos.

**El número de origen de un SMS lo rellena el emisor** y es falsificable desde una pasarela
SMPP ([`10.1145/3615667`](https://doi.org/10.1145/3615667)): en la demostración se entregaron
mensajes con origen arbitrario a **cualquier número internacional en TODAS las operadoras
verificadas**, y de ahí sale un ataque completo
([`10.1145/3696011`](https://doi.org/10.1145/3696011)). El propio autor advierte que la
falsificabilidad depende de la red que entrega — es decir, **no es una propiedad del SMS, sino
de cada operadora**, que es peor: no se puede razonar sobre ella.

**Aplicado aquí el ataque es directo, y la llave la damos nosotros:** alguien declara el
teléfono de otro al registrarse, recibe una llave válida y la devuelve falsificando el origen.
Suplanta la identidad en el alta y **bloquea el número de la víctima**. Y es peor contra un
número **extranjero** —falsificación internacional, la que funcionó en todas las operadoras—,
que es justo a quien este sistema atiende a propósito.

**Esto invierte el orden de mérito que tenía este documento.** Telegram y WhatsApp entregan el
número a través de una **sesión autenticada con la plataforma**; el SMS entrante es el único de
los tres **cuyo número no lo autentica nadie**. Era el último por incómodo, y resultó ser el
único inaceptable.

Se suman dos razones prácticas: **en Ecuador no existe alquilar un número que reciba** (§7), y
la alternativa saliente —mandar nosotros el código— cuesta por mensaje, reabre el bombeo de SMS
y no aporta nada a quien ya puede usar WhatsApp o Telegram.

El análisis completo, con las cifras, en el frente 15 del plan
([`channels-verificacion-2026-08.md`](../planes/channels-verificacion-2026-08.md), §C6).

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

**1 · ¿Es duplicación?** No. Los canales no comparten una línea: uno sondea una API oficial,
otro conduce un navegador.

**2 · ¿Es una cascada de condicionales sobre datos?** No. No es un `switch` sobre un valor:
son **formas de conectarse que no se parecen en nada**, y sobre todo **formas distintas de
probar el número** — Telegram lo pide con un botón, WhatsApp lo resuelve desde un identificador
opaco. Es eso, y no cuántos haya, lo que justifica el polimorfismo.

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

⚠️ **Aquí ponía que «el SMS no ata a un aparato» porque se podía alquilar un número que
recibe. En Ecuador eso NO EXISTE** — Twilio lo dice explícitamente («Two-way SMS supported:
No») y las operadoras sustituyen el remitente por un número local, lo que rompe cualquier
respuesta. No había dos caminos: había uno. Es una de las razones del descarte.

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
- ~~El detalle regulatorio ecuatoriano de recibir SMS en líneas de consumidor.~~ **Ya no hace
  falta: el SMS se descartó el 2026-09-01.**

---

## Documentos relacionados

- [`referencia/patrones-diseno.md`](../planes/referencia/patrones-diseno.md) — cuándo un
  patrón se gana el sueldo. Sus cinco preguntas están contestadas en §6.
- [`identidad-sin-pais-fijo-2026-08.md`](../planes/identidad-sin-pais-fijo-2026-08.md) — la
  tarea `I10`, que este servicio desbloquea.
- [`frontend-identidad-2026-08.md`](../planes/frontend-identidad-2026-08.md) — la tarea
  `F4d`: `verificado` no lo pone nadie salvo la siembra. Este servicio es el flujo que le falta.
