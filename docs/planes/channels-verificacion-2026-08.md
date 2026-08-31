# `channels` — verificar que un número de teléfono es de quien dice

> **Qué es.** El plan de ejecución del microservicio de canales de mensajería y de la cadena
> de verificación que lo usa.
>
> **El diseño NO está aquí.** Está en
> [`arquitecturas/microservicio-channels.md`](../arquitecturas/microservicio-channels.md),
> aprobado por el dueño el 2026-08-29: qué vive en el servicio y qué en el backend, los tres
> canales, las tres comprobaciones y lo que se descartó con su razón. Este documento **no lo
> repite**: dice qué falta hacer y en qué orden.
>
> **De dónde sale.** De `I10` del frente 14, que quedó como deuda, y de `F4d` del frente 13,
> bloqueada porque **`verificado` no lo pone nadie salvo la siembra**. Este frente es el
> flujo que le falta a las dos.
>
> **Quién decide.** El dueño, tarea a tarea.

---

## §0 · Control de ejecución

| Tarea | Qué entrega | Estado | Evidencia | Fecha |
|---|---|:--:|---|---|
| **C1** | El contrato del canal y la política de verificación, probadas **sin red** | ✅ | 15 pruebas · 4 mutaciones cazadas: comparar números tal cual, mirar el número antes de la llave, confundir «falta el número» con un rechazo, y confundir «el backend no contesta» con «llave mala» | 2026-08-29 |
| **C2** | El backend sabe **crear, resolver y consumir** una llave; el servicio sabe preguntárselo | ✅ | `telefono_verification_keys` + 3 rutas · char **318/318** (4 casos nuevos) · unit **704** · channels **34** · **4 mutaciones cazadas**: quitar el filtro del dueño, colapsar «ya usada» con «no existe», que el guard confirme la ruta con un 401, y que pedir otra llave no invalide la anterior · `/api/internal/` da **404 desde fuera** (curl contra el proxy) · **IDOR encontrado y cerrado** al escribir las pruebas | 2026-08-30 |
| **C2b** | La comparación del número se muda al backend: el servicio **observa**, el backend **dicta** | ✅ | char **321/321** · unit **713** · channels **29** · la regla vieja (últimos 8 dígitos) daba por iguales `+51 99 111 2233` y `+593 99 111 2233` · **3 defectos más** encontrados al construir: el arranque creaba el teléfono del admin **sin país** (inverificable), `numero_completo` componía `+5930990000000`, y un 404 del guard era indistinguible de «llave desconocida» | 2026-08-30 |
| **C3** | Un número real se verifica **por Telegram**, de punta a punta | ✅ | **Verificado con un teléfono real** (iPhone y Telegram Desktop) · channels **50** · 4 mutaciones cazadas (aceptar la tarjeta ajena, offset después de tratar, borrar el error del mensaje, «hola» como llave) · rechazos comprobados uno a uno: caducada · ya usada · inventada · contacto reenviado · **llave abierta desde OTRO teléfono** · y medido que un intento de impostor **NO gasta la llave** | 2026-08-31 |
| **C4** | El servicio corre **como contenedor** en la pila, sin que lo alcance el navegador | ✅ | `docker/channels/Dockerfile` + servicio en `compose.dev.yml` · **0 puertos publicados** y el nombre no resuelve desde el host · apagado limpio en **1,2 s** con SIGTERM (tini como PID 1) · conectado a `@deasy_test_bot` desde dentro de la pila · **vuelta completa comprobada con un teléfono real contra el contenedor de la pila** | 2026-08-31 |
| **C5** | Un número real se verifica **por WhatsApp** — con el canal **reescrito de cero** | ⬜ | | |
| **C6** | Un número real se verifica **por SMS entrante** | ⛔ | **Bloqueada por una decisión del dueño**: módem propio o número alquilado | |
| **C7** | La pestaña de administración: estado de los canales y **el QR de WhatsApp** | ⬜ | | |
| **C8** | El registro es **una secuencia de tres pasos**, y el router manda a completar lo que falte | ✅ | char **326/326** · unit **735** · frontend **431** y sus 27 puertas · la puerta REAL en el backend (`exigeVerificacionCompleta`) y el guardián del router como mitad amable · **4 defectos cerrados de camino**: la verificación autodeclarable, el alta no atómica, `/email/verify` sin sesión y el envío que fallaba en silencio | 2026-08-31 |
| **C9** | 🚧 **El limitador de intentos** | ⬜ | | |

**10 tareas.** `C6` está bloqueada a propósito y no cuenta como pendiente de trabajo.

🚧 marca la que **no es sólo de este frente**: el limitador protege también el acceso, el
registro y `/recover-email`. Hoy **no existe ninguno** — 18 dependencias en el backend,
ninguna de límite ni de caché, y **no hay Redis en ninguna pila**.

### El orden, y por qué

```
C1 ──> C2 ──> C2b ─┬─> C3 ──> C4 ──> C8
                   └─> C5 ──> C7
C6   (bloqueada)
C9   (independiente — y hace falta aunque no hubiera canales)
```

- **`C2` es la costura.** Sin llaves que crear y resolver, un canal no tiene nada que
  interpretar. Va antes que cualquier canal.
- **`C3` antes que `C4`**: primero que funcione contra el backend en marcha, y después se
  empaqueta. Al revés se depura dentro de un contenedor sin saber si el fallo es del código.
- **`C7` necesita `C5`**: la pantalla existe sobre todo para **enseñar el QR de WhatsApp**.
  Con sólo Telegram no habría casi nada que administrar.
- **`C8` necesita al menos un canal vivo**, o manda a la gente a una pantalla que no funciona.
- **`C9` no depende de nada** y no lo desbloquea nada.

⚠️ **`C1` se hizo primero a propósito**, y no por comodidad: la quinta pregunta de
[`referencia/patrones-diseno.md`](./referencia/patrones-diseno.md) dice que un patrón sin red
delante no se distingue de haberlo roto. La política es lógica pura y se prueba entera sin
Telegram, sin WhatsApp y sin un módem.

---

## 1 · Las tareas

### C2 · La costura entre el backend y el servicio

**En el backend**, tres cosas y una tabla:

- **Crear** una llave para *esta* petición de verificación de *este* número: aleatoria, de
  un solo uso y con caducidad corta.
- **Resolver**la: dado el texto que llegó, decir a qué número corresponde — o que no vale.
- **Consumirla** al confirmar, y marcar el teléfono como verificado.

⚠️ **La tabla se parece a `email_verification_codes`, y conviene mirarla antes de escribir
otra**: ya guarda el código **cifrado**, con caducidad y un solo uso, y borra el anterior al
pedir uno nuevo. Si el patrón sirve, se copia; si no, se dice por qué.

⚠️ **La llave viaja en un enlace de Telegram**, que admite **64 caracteres y sólo
`A-Z a-z 0-9 _ -`** (comprobado en su documentación). Eso condiciona cómo se genera: nada de
caracteres que haya que escapar.

**En el servicio**, `ClienteDeDeasy`: el **único** sitio que llama al backend. Ahí viven la
dirección, la clave compartida y qué hacer si no contesta.

**Cómo se comprueba:** crear una llave, resolverla, consumirla, y que la segunda vez no
valga. Y que una caducada tampoco.

#### ✅ Hecho el 2026-08-30 — y tres cosas que no estaban previstas

1. **Un IDOR, encontrado al escribir las pruebas.** La ruta vive bajo `/me/`, pero el servicio
   buscaba el teléfono **sólo por su id**: cualquiera con sesión pedía una llave para el teléfono de
   otro y se llevaba su número en la respuesta. Ahora el dueño sale del token y es **obligatorio**
   —sin valor por defecto, para que un olvido rompa la prueba en vez de abrir la consulta—, y un
   teléfono ajeno responde **igual que uno inexistente**.
2. **La petición devolvía 200 con los tres enlaces a `null`** cuando el entorno no tenía ningún canal
   configurado, quemando una llave que nadie podía usar. Ahora responde **503 antes de tocar la
   base**, y un canal sin configurar **no aparece** en vez de viajar como `null`: «no lo ofrecemos» y
   «falló» son cosas distintas.
3. **El 409 al consumir dejó de ser una excepción.** Es la carrera entre resolver y confirmar —dos
   mensajes casi a la vez—, y al usuario le toca «pide otra», no «error interno».

La composición de enlaces salió del controlador a `services/users/canalesDeVerificacion.js`: es una
regla de despliegue con tres consumidores previstos (esta ruta, la pestaña de `C7` y el registro de
`C8`), es lógica pura y se prueba sin entorno — incluido el caso de **cero canales**, que desde el
contenedor no se puede provocar.

⚠️ **En dev, `TELEGRAM_BOT_USERNAME` es un MARCADOR**: el bot no existe todavía (lo crea `C3`). Basta
para que el camino de composición se ejecute; el enlace no lleva a ninguna parte.

### C2b · La comparación se muda al backend

**Lo pidió el dueño el 2026-08-30**, mirando el contrato antes de conectar ningún canal: «el
servicio le pasa directo al backend un JSON con el número, el hash y el canal; el backend compara».

**Y tenía razón por un motivo que no era de estilo.** El servicio **no sabe de qué país es el número
guardado**, así que sólo podía comparar la cola —los últimos ocho dígitos—. Medido contra el código
de entonces:

```
✔ IGUALES   0991112233     vs  +593 99 111 2233   ← correcto
✔ IGUALES   +51 991112233  vs  +593 991112233     ← PERÚ dado por ECUADOR
```

Con eso, cualquiera registraba el número de otra persona y lo verificaba desde una línea propia de
otro país con la misma cola — que es exactamente lo que la verificación existe para impedir. El
backend sí sabe el país (`telefonos.pais_id` → `paises.phone_code`) y compara en E.164 exacto.

El principio, que vale para lo que queda del frente: **un subordinado reporta lo que OBSERVÓ, no un
veredicto.**

Tres cosas más, de propina, porque el diseño nuevo las hace visibles:

- El número **deja de salir del backend**. Antes se lo llevaba quien trajera una llave válida.
- **Desaparece la carrera** entre comparar y consumir: es una transacción.
- La sonda se conserva **sólo** porque Telegram la necesita: su bot pide el contacto en un segundo
  paso, y pedírselo con una llave muerta es hacerle compartir sus datos para nada.

#### ✅ Hecho el 2026-08-30 — y TRES defectos que salieron al construirlo

1. **El arranque creaba el teléfono del administrador SIN país**, o sea imposible de verificar por
   definición: sin prefijo no hay comparación internacional que valga. Ahora lo hereda de
   `instituciones`, igual que el documento nacional. **El golden de `auth` se movió, y ese diff es la
   prueba del arreglo.**
2. **`numero_completo` componía `+5930990000000`**, conservando el cero nacional detrás del prefijo.
   Estaba mal en **dos** consultas y no se veía porque el prefijo siempre era nulo.
3. **Un 404 del guard era indistinguible de «llave desconocida».** Una `INTERNAL_SERVICE_KEY` mal
   puesta habría hecho que el canal le dijera «tu enlace no vale» a **todo el mundo**, para siempre y
   sin una pista. Se distinguen por el cuerpo: el endpoint siempre manda `estado`.

⚠️ Y un aviso para quien mida esto: **el `rollback` del camino «número distinto» es un mutante
equivalente**. En ese punto no se ha escrito nada, así que `commit` y `rollback` hacen lo mismo y
ninguna prueba puede distinguirlos. Se queda por higiene, no porque esté cubierto.

### C3 · Telegram, de punta a punta

#### Antes de tocar código: crear el bot (lo hace el dueño)

En Telegram, hablando con **@BotFather** (el verificado, con la marca azul):

| | |
|---|---|
| `/newbot` | arranca |
| **Nombre** | lo que ve la gente, texto libre — p. ej. `Deasy Verificación` |
| **Usuario** | tiene que **terminar en `bot`** y ser único en todo Telegram — p. ej. `deasy_verificacion_bot` |
| → | BotFather devuelve el **token**: `123456789:AA…` |

Y después, tres ajustes que **no** son cosméticos:

- `/setjoingroups` → **Disable**. Este bot no tiene nada que hacer en grupos; deshabilitarlo quita
  superficie de abuso.
- `/setdescription` → lo que se lee **antes** de pulsar Empezar. La gente llega aquí desde un enlace
  nuestro, y una pantalla en blanco es indistinguible de una estafa.
- `/setabouttext` → la ficha del perfil.

⚠️ **Un bot por entorno.** El sondeo de Telegram admite **un solo consumidor**: si dev y producción
comparten bot, se roban los mensajes el uno al otro y los fallos son intermitentes e incomprensibles.

⚠️ **El token ES el bot.** Quien lo tiene lee todo lo que se le escriba y puede hablar en su nombre.
Por eso va en **`docker/.env.dev.runtime`** —ignorado por git, se crea copiando
`docker/.env.dev.runtime.example`— y **nunca** en `docker/.env.dev`, que está versionado. Si se
filtra: `/revoke` en BotFather y sale otro.

⚠️ **No hace falta configurar el enlace profundo.** `t.me/<usuario>?start=<llave>` funciona solo. Lo
único que condiciona es la llave: **64 caracteres y sólo `A-Z a-z 0-9 _ -`**, que ya se cumple.

#### El resto de la tarea

El QR y **también un enlace pulsable** — ⚠️ quien se registra **desde el móvil no puede
escanear su propia pantalla**, así que las dos formas van desde el principio, no como parche.

⚠️ **El bot no recibe el número.** Lo pide con un botón, y hay que exigir que el `user_id`
del contacto **coincida con el de quien escribe**: sin eso, cualquiera reenvía la tarjeta de
contacto **de otra persona**.

⚠️ **El baile de dos pasos lo resuelve el canal**, no la política: `CanalTelegram` guarda por
dentro qué conversación corresponde a qué llave y avisa **una sola vez**, ya con el número.
Si esa memoria se pierde al reiniciar, el usuario vuelve a escanear — es aceptable.

**Cómo se comprueba:** un teléfono real queda verificado en la base, y otro distinto se
rechaza.

#### ✅ Hecho el 2026-08-31 — y lo que enseñó probarlo con un teléfono de verdad

Todo lo de abajo salió de la sesión con el dueño, y **nada de ello lo habrían encontrado las pruebas
automáticas**: son cosas del cliente de Telegram y de la persona que lo usa.

1. **EL BOTÓN NO SE PINTA SOLO.** Telegram aceptó tres variantes distintas del teclado —con y sin
   `one_time_keyboard`, con `is_persistent`, como objeto y como cadena JSON— y **ninguna apareció**
   en un iPhone real. Está plegado tras el icono de cuadrícula (▦) del campo de escribir. El código
   era correcto; lo que faltaba era **decir dónde mirar**, y sin eso la persona hace todo bien y se
   queda atascada. Un texto que dice «pulsa el botón de abajo» cuando abajo no hay botón es un
   defecto del canal aunque el código esté impecable.
2. **«Adjunta tu contacto con el clip» NO SIRVE**, y se probó: esa opción abre la agenda, y uno no
   está en su propia agenda. Se ofreció como alternativa, se comprobó que no existía, y se retiró.
   Mandar a alguien a un sitio vacío es peor que no decir nada.
3. **Telegram Desktop funciona.** Se verificó desde ahí de punta a punta: llave emitida 04:26:01,
   consumida 04:26:23.

**Los rechazos, comprobados uno a uno con el bot real:** llave caducada, llave ya usada, llave
inventada, contacto reenviado de un tercero, y **la llave abierta desde otro teléfono** — que es la
prueba que sostiene el diseño: el enlace puede circular, pero **sólo lo cierra quien tenga el
teléfono**. Medido además que **un intento de impostor NO gasta la llave**: la 17 se emitió a las
04:19:58, aguantó los rechazos y seguía viva cuando su dueño la usó a las 04:22:49.

⚠️ **Un defecto de datos que salió de rebote, y que apunta a algo mayor.** El guion de prueba guardó
el número **con el prefijo del país dentro** (`numero` = `593…` *y además* `pais_id` = EC), y la
verificación **pasó igual** — por la rama de `numerosIguales` que acepta la parte local a secas. Es
decir: un registro mal formado se verificó de chiripa. Está anotado abajo como cuestión abierta.

### C4 · El contenedor

Servicio en la pila, con su volumen para la sesión y **sin puerto publicado**: igual que el
firmador, al que el navegador no alcanza.

⚠️ **Dos ataduras que hay que escribir en el compose, no descubrir:** el sondeo de Telegram
admite **un solo consumidor**, y la sesión de WhatsApp **vive en el proceso que la abrió**.
El servicio corre en **una** instancia.

#### ✅ Hecho el 2026-08-31

| Comprobación | Resultado |
|---|---|
| Puertos publicados | **0** — y `channels` no resuelve desde el host |
| ¿Escucha algo dentro de la red? | **No.** No abre ningún puerto: sólo sondea. Superficie de ataque, ninguna |
| Apagado | **1,2 s** con `SIGTERM: cerrando canales` — `tini` como PID 1. Sin él, Node como PID 1 ignora la señal y muere de un `SIGKILL` a los diez segundos, con el sondeo a medias |
| Arranque con la pila | Sí, sin nombrarlo |
| Conexión | `@deasy_test_bot`, desde dentro de la pila |
| Verificación real | **Sí**, de punta a punta contra el contenedor de la pila |

**La imagen es `node:25.8.1-slim` y no la del backend**: `channels` no tiene ni una dependencia
—todo lo que hace es hablar HTTP, y `fetch` viene en Node—, así que no hay nada que compilar. El
paso de `npm install` se deja puesto para cuando `C5` traiga `whatsapp-web.js`.

⚠️ **Un teléfono de prueba NO SOBREVIVE a `test:char:run`.** Esa tanda resetea la base entera —reset
+ bootstrap + seed—, así que el número que alguien haya puesto para probar vuelve al de la semilla.
Pasó el 2026-08-31: se dio un enlace apuntando a un número sobrescrito dos minutos antes, y el
rechazo —correcto— parecía un fallo del canal. **Si se lanza la caracterización entre medias, hay que
volver a grabar el número antes de emitir la llave.**

⚠️ **Sólo está en `compose.dev.yml`**, como el sitio de documentación: `qa` y `prod` no lo despliegan
todavía, y publicar su imagen en GHCR es parte de esa decisión, no de esta tarea.

### C5 · WhatsApp, reescrito

⚠️ **El código que hay lleva años muerto y tenía errores.** No se recicla: se escribe contra
la documentación actual de `whatsapp-web.js`, que es lo que quedó pendiente de comprobar.

⚠️ **Número dedicado**, ni el principal de la institución ni rotatorio. Su pérdida cuesta
volver a vincular y avisar, no la identidad. Y **rotar desechables empeora las cosas**: una
línea nueva se bloquea antes que una con historial, y para el usuario un número que cambia
cada pocas semanas es indistinguible de una estafa.

### C6 · ⛔ SMS entrante — bloqueada

**Es el más limpio de los tres**: el número **viene en la cabecera del mensaje**, así que lo
prueba el propio transporte. Y el único que funciona **sin aplicación, sin datos y en un
teléfono básico**.

**Lo que la bloquea es una decisión, no código:** módem propio o número alquilado a un
proveedor. Detrás de la misma interfaz, así que es una decisión de **despliegue**.

⚠️ **Y su límite hay que decirlo en la pantalla:** a quien escribe desde fuera del país le
cuesta caro, y este sistema **atiende a extranjeros a propósito**. Por eso va tercero.

### C7 · La pestaña de administración

**Sin front propio**: quien ve el QR **vincula la sesión a su propio teléfono**, así que
sería un segundo sistema de acceso que mantener. La pantalla es una pestaña del admin, el
backend retransmite, y «quién puede administrar los canales» es **un permiso más**.

### C8 · El registro en tres pasos

Guardar la persona → verificar el correo → verificar el teléfono. Y un guardián que mande a
completar lo que falte.

**Decisión del dueño (2026-08-31): el teléfono es obligatorio DESDE HOY.** No hay datos en
producción, así que la pregunta de «qué pasa con quien ya está registrado» no existe.

**Y la regla del teléfono:** vale **cualquiera de los tres canales**. Verificar Telegram no verifica
WhatsApp — cada canal guarda lo suyo en `telefono_canales`, y el teléfono cuenta como verificado si
tiene **alguno**. Comprobado en vivo antes de construir encima.

#### Las dos precondiciones, cerradas el 2026-08-31

Antes de escribir una línea de la pantalla, dos defectos que habrían hecho inútil la puerta. Los dos
encontrados con **peticiones reales**, no leyendo código.

**1 · La verificación se podía AUTODECLARAR.** Bastaba con:

```
POST /users  {"telefono": {"canales": [{"code":"telegram","verificado": true}]}}
```

y el canal quedaba verificado sin probar nada: `req.body.telefono` llegaba intacto hasta la capa que
escribe. Una puerta que se abre poniendo `true` en un JSON no es una puerta. Ahora un canal declarado
**nace sin verificar, siempre**, y sólo escriben `verificado = 1` el servicio de verificación (tras
probarlo) y el arranque (que no es alcanzable desde ninguna ruta).

**2 · El alta NO era atómica.** La persona se insertaba y sus satélites iban después, cada uno por su
cuenta — el propio código lo decía en un comentario. Dos peticiones fallidas dejaron **dos personas
colgadas**. Y lo grave no es la basura: **el teléfono quedaba ocupado**, así que el segundo intento de
la misma persona fallaba con «ese número ya está registrado por otra persona» — y la otra persona era
ella misma. Con un registro de tres pasos, quien se equivoca una vez no podría reintentar nunca.
Ahora todo el alta va en **una transacción**.

Mutaciones: reponer el agujero de `verificado` falla 1 unitaria y 1 de caracterización; cambiar el
`rollback` por un `commit` falla 1 de caracterización.

⚠️ **La verificación de correo ya existe y está entera** —tabla propia, código cifrado, diez
minutos, un solo uso, y su pantalla—. **Lo único que le falta es que `SMTP_*` esté en el
entorno** y que **alguien la obligue a usarse**: hoy se envía el código y ahí acaba.

⚠️ ~~**Y hay que decidir qué pasa con quien ya está registrado**~~ — **decidido el 2026-08-31: no
hay datos en producción, así que la pregunta no existe. El teléfono es obligatorio desde hoy.**

#### ✅ Hecho el 2026-08-31

**La puerta está en el backend**, y el guardián del router es sólo la mitad amable. No es una
preferencia: quien tenga el token llama a la API y se salta el navegador entero, y este repositorio
ya tropezó con eso —*«El bloqueo era solo visual: la API los servía igual»*, `user_controler.queries.js:486`—.

| Pieza | Dónde |
|---|---|
| Qué le falta a una persona | `services/users/estadoDeVerificacion.js` — **todo derivado, nada guardado** |
| La puerta | `middlewares/exigeVerificacionCompleta.js`, en 5 routers, **después de `authMiddleware`** |
| Los pasos 2 y 3 | `POST /users/me/verificacion/correo` y `…/reenviar`; el teléfono ya existía |
| Las pantallas | `/registro/correo` y `/registro/telefono` + `PasosDelRegistro.vue` |

**Cuatro defectos cerrados de camino**, los cuatro con peticiones reales:

1. **La verificación se podía autodeclarar** (`{"canales":[{"verificado":true}]}`).
2. **El alta no era atómica**: dejaba personas colgadas y el teléfono ocupado, así que el reintento
   chocaba consigo mismo.
3. **`POST /email/verify` aceptaba `{user_id, code}` sin sesión**: cualquiera probaba códigos contra
   la cuenta de cualquiera. Ahora va sobre `me`.
4. **El envío de correo fallaba en silencio** (`catch → console.error → seguir`): la persona salía
   creada, sin correo y sin forma de pedir otro. Ahora el registro responde **503 antes de crear
   nada** si el servidor no puede enviar, y dice si el envío falló para que la pantalla ofrezca
   reenviar.

⚠️ **La semilla necesitó teléfono para los tres usuarios.** Gestor y usuario no lo tenían, y con la
puerta puesta **la fixture entera dejó de servir: 71 casos en rojo**. El arranque los da por
verificados igual que ya daba por verificados su correo y su documento — los crea el instalador, que
responde por ellos.

⚠️ **`verify: {email, whatsapp}` se retiró** y el golden de `auth` se movió por eso. No lo leía nadie
y mentía por omisión: decía «whatsapp» cuando la verificación vale por cualquiera de los tres
canales.

#### Dos cosas que salieron al probarlo en el navegador (2026-08-31)

**1 · El correo de verificación no se había enviado NUNCA.** El destinatario llegaba como argumento
desde `createdUser.email` — un campo **que ya no existe**, porque el correo dejó de ser columna de
`persons` y se mudó a `emails`. Nodemailer respondía «No recipients defined» dentro de un `catch` que
lo escribía en el log y seguía.

No se notó porque **tampoco había `SMTP_*` configurado**: los dos fallos se tapaban el uno al otro, y
cada uno explicaba el silencio del otro. Ahora la dirección la lee el propio servicio del correo
principal, y con eso se cierra la clase entera: el único sitio que sabe a dónde se envía es el que lo
consulta.

**2 · El modal de «Registro exitoso» mentía, y se retiró.** Decía «ya puedes iniciar sesión» cuando
enviar el formulario es **el paso 1 de 3**. Dejaba a la persona convencida de que había terminado,
con la cuenta a medias y sin poder entrar a ningún sitio. No se sustituyó por otro modal: donde se
dice «te queda esto» es la pantalla siguiente, que ya lleva su indicador de tres pasos.

**Y un tercero, del mismo turno:** una colisión de documento respondía **400 «Error al crear el
usuario»** aunque el servicio lanzara un 409 con el motivo escrito. La persona veía un error sin
nada que corregir, y la explicación estaba en el log del servidor.

#### Lo que corrigió el dueño probándolo (2026-08-31, segunda vuelta)

**1 · «Salir» no funcionaba, y dejaba la máquina inservible.** El guard corre **antes** del
`beforeEnter` de `/logout`, así que redirigía al paso pendiente y la sesión a medio verificar quedaba
**atrapada** — nadie más podía entrar desde ese equipo. Cualquier puerta que no se pueda abrir desde
dentro está mal, por buenas que sean sus razones.

**2 · La pantalla del teléfono era vaga.** No dejaba **elegir canal**, no tenía el **QR** que este
mismo plan prometía en `C3`, y explicaba el **porqué** del diseño en vez del **cómo**. Rehecha:

| | |
|---|---|
| Selector | Los tres canales, en orden de recomendación, como **grupo de opciones** (no tres botones: elegir uno de tres es lo que un `radio` significa) |
| QR | Lo compone el **backend**, igual que los enlaces. Sin él, quien se registra desde el ordenador no tiene salida |
| Manual | En un modal, **paso a paso y por canal** — el de Telegram tiene un paso que los otros no: pedir el contacto |
| SMS | Se dice que **lo cobra la operadora** y que los otros dos son gratis, ahí donde se decide |

⚠️ **El enlace de Telegram sí era correcto** (comprobado contra `getMe`). Lo que falla es la entrega
del navegador a Telegram Desktop, que puede quedarse con la conversación y **perder el
`?start=<llave>`**. Para eso está el QR — y el bot, cuando alguien llega sin llave, ya no repite «usa
el enlace»: le dice que escanee el QR o pegue el código.

**3 · Dos ajustes de forma:** el logo centrado y «Enviar otro código» **al lado** de «Confirmar
correo», que son las dos salidas de esa pantalla.

⚠️ **Y el correo llega a SPAM en Gmail.** Medido: Gmail responde `250 OK` y lo entrega a la carpeta de
correo no deseado. **Es exactamente lo que este plan advirtió por escrito antes de que pasara**, y no
se arregla con código: hace falta que el dominio remitente tenga **SPF y DKIM**. Es el argumento
medido para pedir el SMTP institucional en vez de una cuenta suelta.

#### Tercera vuelta con el dueño (2026-08-31)

**El bot no respondía a nada, y no era el bot: el servicio llevaba TRECE HORAS muerto.** Un
`SIGKILL` lo tumbó y `channels` **no tenía política de reinicio** —el único servicio de la pila sin
ella—. El silencio fue completo: el backend seguía emitiendo llaves, la pantalla seguía pintando el
QR, y del otro lado no había nadie. Cada pieza funcionando y el conjunto roto.

Ahora lleva `restart: unless-stopped`, como el resto.

⚠️ **Y esto deja al descubierto que no hay forma de saber que un canal se ha caído.** La pestaña de
administración (`C7`) tiene ahí su primer motivo real: `estado()` existe en el contrato de `Canal`
desde `C1` y **no lo lee nadie**.

**La pantalla del teléfono, segunda pasada:** el selector a la izquierda y el QR a la derecha con el
doble de sitio. En vertical el QR quedaba pequeño y empujado hacia abajo, que es justo al revés de lo
que hace falta —es la salida de quien está en el ordenador, y se mira con la cámara en la mano—. Y el
botón va ahora **pegado a su propia frase**, no separado de ella por el otro texto.

#### Cuarta vuelta: mirar la pantalla de verdad (2026-08-31)

El dueño dijo «se ve horrible, míralo tú mismo». **Y tenía razón en todo.** Abierta en Chrome con una
sesión real, medida y corregida hasta que estuvo bien:

| Qué estaba mal | Por qué |
|---|---|
| El contenedor medía **448 px en una pantalla de 1440** | `AuthLayout size="md"`, que es el ancho de un formulario de una columna. Esta pantalla tiene dos |
| El selector **se desbordaba** sobre el panel | Consecuencia de lo anterior |
| El indicador de pasos **se estiraba** de lado a lado | Cada paso llevaba `flex-1`. Un indicador de progreso es una **frase** —«vas por el 3 de 3»— y las frases no se justifican |
| El logo **no se centraba** con `mx-auto` | `AppLogo` es `inline-flex`, y los márgenes automáticos no centran elementos en línea. Lo que centra es el `text-center` del padre |
| En **móvil** el QR ocupaba media pantalla | Y ahí no sirve para nada: no puedes escanear tu propia pantalla. Ahora el orden se invierte por tamaño |
| La columna del selector quedaba **vacía** | Se llenó con lo único que hace falta para elegir, que además faltaba: «los tres prueban lo mismo» |

**Nada de esto lo veía ninguna prueba**, y las 27 puertas del frontend tampoco: todas pasaban con la
pantalla rota. Lo único que lo encuentra es abrirla.

⚠️ Y una lección de método: **hacía falta una sesión en ese estado exacto** —correo verificado,
teléfono no— para poder mirar. Se fabrica con un alta por API y un `UPDATE` al correo; sin eso no hay
forma de llegar a la pantalla.

#### Quinta vuelta: el servidor avisa, y el código se puede renovar (2026-08-31)

**1 · El botón «Abrir Telegram» tenía `padding: 0`.** Medido: 100 px de texto en 102 px de botón, dos
de holgura. La causa es exacta y vale para cualquier `<a>` con pinta de botón: **`.deasy-btn` no lleva
relleno**, lo pone `.deasy-btn--md` (`px-4 py-2`), y `AppButton` la añade sola. Un `<a>` escrito a
mano, no. Ahora: **16 px a cada lado y 34 de holgura**.

⚠️ Y las puertas no lo cazaron: `check:buttons-g9-g11` mira `<button>`, no un enlace con clases de
botón. Queda dicho.

**2 · El enlace y el QR caducan a los 15 minutos, y no lo decía nadie.** Quien dejaba la pestaña
abierta escaneaba un código muerto y el bot le respondía «caducó» sin que la pantalla hubiera avisado.
Ahora hay cuenta atrás, y al vencer el panel se apaga y aparece **«Generar otro»** — que repite la
petición conservando el canal elegido.

**3 · El servidor AVISA por tiempo real, y eso cambia la pantalla de sitio.** Al confirmar, el
controlador emite `telefono:verificado` a la sesión de esa persona por el `RealtimeGateway` que ya
existía. **Comprobado en vivo: la pantalla saltó sola a `/home`** en cuanto el canal confirmó, sin
que nadie pulsara nada.

Quien acaba de escribirle al bot desde el móvil no tiene por qué volver al ordenador a pulsar un
botón para enterarse de algo **que el servidor ya sabe**.

⚠️ **«Ya lo hice» se queda como RESPALDO, no se retira.** Si el socket no conecta —red rara, pestaña
dormida— o si la verificación llegó por otro camino, tiene que seguir habiendo forma de continuar. Un
aviso que no llega no puede dejar a nadie encallado.

#### Sexta vuelta: una errata ya no es una cuenta muerta (2026-08-31)

**1 · UNA ERRATA ERA UNA CUENTA MUERTA, y es el peor defecto de todo el frente.** Quien escribía mal
su correo o su teléfono en el registro quedaba encerrado **para siempre**:

- El guard le exige verificar algo que **no puede recibir**.
- El perfil, que es donde se cambian esos datos, está detrás de **esa misma puerta**.
- Su correo y su teléfono quedan **ocupados**, así que tampoco puede volver a registrarse.
- Y no puede pedir ayuda: no hay a quién escribirle desde dentro.

Ahora las dos pantallas dejan corregir el dato. **Cambiarlo mientras se verifica no debilita nada**:
lo que la puerta exige es *probar el dato que se declare*, no acertar a la primera.

| | |
|---|---|
| `PUT /users/me/verificacion/correo` | Cambia el correo principal, **la verificación vuelve a cero** y sale un código nuevo |
| `PUT /users/me/verificacion/telefono` | Cambia el número y **tira las llaves vivas** — estaban emitidas contra el número anterior, y un enlace ya repartido no puede seguir sirviendo |

Comprobado en el navegador: correo `repro.registro@` → `repro.corregido@` con un solo correo
principal y código nuevo; teléfono `…700` → `…234` con un solo teléfono y una sola llave viva.

**2 · «Confirmar correo» se quedaba deshabilitado con las seis cifras puestas**, hasta recargar. No
conseguí reproducirlo de forma determinista, así que en vez de adivinar el disparador se cerró **la
clase entera**: el campo ahora normaliza a dígitos en cada pulsación y repinta lo limpio. Cualquier
cosa que el campo aceptara —un espacio del autocompletado, un pegado desde un SMS— hacía que se
vieran seis cifras y el valor tuviera siete caracteres.

⚠️ **Y una nota operativa que ya ha mordido tres veces:** al recrear el contenedor del backend,
**nginx se queda con su IP vieja** y todo responde **502**. No es el backend: se arregla con
`bash scripts/stack.sh c restart nginx-proxy`. El arreglo de raíz —`resolver` + variable en
`proxy_pass`— cambia cómo nginx reescribe la ruta, y ahí vive la regla que corta `/api/internal/`,
así que no se toca de pasada.

#### Séptima vuelta: el botón deshabilitado, cazado por la raíz (2026-08-31)

**El dueño reportó dos veces que «Confirmar correo» seguía deshabilitado con las seis cifras
puestas.** Abierto en Chrome con entrada de teclado real: **no se reproduce**. Ni escribiendo, ni
pegando, ni con el campo normalizado. El disparador está en su navegador —lo más probable, un valor
que Firefox restaura o autocompleta **sin disparar el evento `input`**, con lo que el campo enseña
seis cifras y la variable sigue vacía; recargar limpia el campo, y por eso «funcionaba después».

**Perseguir ese disparador es perseguir un navegador. La causa de fondo es nuestra y es otra:**

> El único camino para saber qué hay escrito no puede ser un evento.

Ahora **el botón no se deshabilita**. Al pulsar se lee el valor **del campo**, se normaliza a dígitos
y, si no vale, se dice por qué. Un botón deshabilitado sin explicación era además la peor forma de
decir «te falta algo»: no dice qué falta, y quien no lo adivina se queda mirando.

**Y la UI, simplificada como pidió el dueño** —«en lugar de escribir tanta lata, sólo debería existir
un campo claro que llame a la acción»—:

| Antes | Ahora |
|---|---|
| Un enlace «¿Te equivocaste de correo?» que abría un formulario | **El correo, siempre visible y editable.** «Guardar» aparece sólo cuando cambia |
| El número no se veía por ninguna parte | **El número, siempre visible y editable**, junto al selector de canal |
| Párrafos explicando el porqué | Fuera. El porqué vive en el modal de instrucciones |

Quien se equivocó **no va buscando una confesión: va buscando el campo.**

#### Octava vuelta: el dato se ve, se cambia si se pide, y «Salir» es un botón (2026-08-31)

**1 · Cambiar el correo o el número se activa SOLO SI SE PIDE.** El campo abierto de entrada era un
paso atrás: el 95 % de las veces el dato está bien, y un campo editable invita a tocarlo sin querer
—y tocarlo cuesta un correo nuevo, otra espera, y en el teléfono tira la llave viva—.

Ahora se **ve** el valor (para poder darse cuenta del error) con un botón **«Cambiar»** al lado. Al
pulsarlo aparecen el campo, **«Guardar»** —deshabilitado mientras no cambie nada— y **«Cancelar»**.

**2 · «Salir» era un enlace de texto en una fila de botones.** El dueño preguntó si estaba escrito a
mano saltándose las reglas, y la respuesta honesta es a medias: `deasy-auth-link` **sí** es del
sistema, pero es para **enlaces de navegación** («¿Olvidaste tu contraseña?»). «Salir» es una
**acción**, convivía con dos botones haciendo algo comparable, y era lo único que no lo parecía.
Ahora es `AppButton`.

⚠️ Y «Confirmar» **sigue siempre activo**, a propósito: es lo que arregló el fallo de la séptima
vuelta. Si el código no vale, lo dice; deshabilitarlo devolvería el botón muerto que no explica
nada.

#### Novena vuelta: los TRES síntomas eran UN error (2026-08-31)

El dueño reportó tres cosas que parecían tres fallos distintos:

1. Un error al registrarse que no le dio tiempo a leer, y aun así pasaba al paso siguiente.
2. En el paso del correo, **no se veía el correo y ningún botón hacía nada**.
3. Al entrar con una cuenta sin verificar, la pantalla **se congelaba**; recargando, funcionaba.

**Los tres eran esto, en `RegisterView.vue`:**

```js
onUnmounted(() => {
  if (mapInstance) { mapInstance.remove(); mapInstance = null; }   // ← mapInstance ya no existe
});
```

Al sacar la dirección del registro (`F6`) se borró el mapa y **se dejó el `onUnmounted` que lo
destruía**. Salir de esa pantalla lanzaba `ReferenceError`, y eso se tragaba la promesa del router:
la pantalla siguiente montaba a medias —su `onMounted` no llegaba a leer el correo, y sus manejadores
no quedaban atados—, y una navegación abortada dejaba la aplicación congelada. **Recargar lo
arreglaba porque monta de cero, sin desmontar nada.**

⚠️ **Y no lo cazó nadie, por un motivo concreto:** `check:imports` mira **símbolos importados**, no
variables locales; y la configuración de ESLint —`vue/flat/essential` más tres reglas de estilo— **no
lleva `no-undef`**. Activarla exige la dependencia `globals` y declarar los del navegador, o produce
cientos de falsos positivos. Queda como tarea aparte, no colada de rodillas aquí.

**Lección de método, que es la que duele:** el turno anterior se dio la limpieza por buena tras un
barrido de símbolos exportados. Un `grep` de exportaciones no ve una variable local huérfana. **Lo
que lo habría visto es abrir la pantalla y salir de ella**, que es exactamente lo que no se hizo.

**Comprobado ahora, flujo entero en Chrome sin tocar la base a mano:** registro → el correo se ve →
«Confirmar» sin código avisa → «Enviar otro» respeta su espera → «Cambiar» abre el campo → verificar
→ paso del teléfono con su número y su QR → el canal confirma → **salta solo a `/home`**. Cero
errores de consola en todo el recorrido.

⚠️ Aviso ajeno detectado de paso: `FirmarPdf` (dentro de `HomeView`) no resuelve `AppButton` —
`[Vue warn]: Failed to resolve component`. Sus botones no se pintan. No es de este frente.

#### Décima vuelta: el doble envío, y un teléfono que entraba dos veces (2026-08-31)

**Lo que reportó el dueño:** el primer clic en «Crear cuenta» no hacía nada; el segundo mostraba «el
teléfono ya está registrado» **y aun así pasaba al paso del correo**.

**Causa: no había ninguna guarda contra el doble envío.** El alta tarda un par de segundos —cifrar la
contraseña, escribir cinco tablas, mandar un correo— y en ese rato la pantalla no cambiaba **nada**:
ni el botón se apagaba, ni aparecía un «creando». Quien no ve respuesta vuelve a pulsar.

Entonces la **primera** petición creaba la cuenta y navegaba, y la **segunda** chocaba con la
unicidad y pintaba el error. Se veía un error **y** se pasaba de fase porque eran dos peticiones
distintas contando cada una su verdad. **El error no era falso: era de un intento duplicado que nunca
debió salir.**

Ahora el botón se apaga y dice «Creando cuenta…», y una segunda pulsación no hace nada. Y de paso
pasa a ser `AppButton`: el `<button>` a mano tampoco llevaba `deasy-btn--md`, o sea que iba **sin
relleno** — el mismo fallo que ya salió en «Abrir Telegram».

**Y persiguiéndolo salió uno peor: EL MISMO TELÉFONO PODÍA REGISTRARSE DOS VECES.**

```
Ocupa   987651100     ← el mismo número
Choca  0987651100     ← y la base lo dejó pasar
```

`uq_telefonos_numero` es un índice sobre la **cadena cruda**, así que el cero de marcación nacional
lo convertía en «otro número». Y lo llamativo es que **el resto del código ya daba por hecho la forma
sin cero al LEER** —`aFormatoInternacional`, `numerosIguales`, el `numero_completo` del SQL—; lo que
faltaba era **escribirla igual**. Ahora se guarda en su forma canónica y el índice significa lo que
dice. El golden de `auth` se movió (`0990000000` → `990000000`), y ese diff es la prueba.

⚠️ **Sobre los triggers que propuso el dueño: no hacen falta, y serían MÁS DÉBILES.** La unicidad ya
la garantizan `uq_emails_direccion` y `uq_telefonos_numero (pais_id, numero)`. Un `BEFORE INSERT` que
consulte antes de escribir **pierde la carrera**: dos altas simultáneas pasan la comprobación y una
falla igual en el índice. **El índice único es lo único atómico aquí.** Lo que faltaba no era una
comprobación más, era normalizar el dato antes de compararlo — que es lo que se acaba de hacer.

⚠️ **Sobre avisar al salir del campo: es mejor UX, y es un ORÁCULO DE ENUMERACIÓN.** Un endpoint sin
sesión que responda «ese correo ya existe» deja que cualquiera compruebe si una persona está
registrada. Queda para después de `C9` (el limitador), que es lo que lo hace defendible.

#### 🚧 Lo que queda abierto de esta tarea

**Un administrador creado SIN teléfono se queda fuera.** El `/setup` lo acepta como opcional, y la
pantalla del paso 3 sabe pedir la verificación pero **no sabe dar de alta un número**. Hoy no muerde
porque la semilla siempre pone uno, pero un `/setup` a mano sin teléfono produce una instalación
cuyo administrador no puede entrar. Va con `F5` del frente 13 (`/perfil/datos`), que es donde se
gestionan los teléfonos.

⚠️ **Y hay cuatro routers SIN autenticación ninguna** —`program`, `units`, `whatsapp` y parte de
`tarea`—, así que la puerta no se pudo montar ahí. No es de este frente, pero es más grave que lo
que sí se arregló, y conviene que no se pierda.

### C9 · 🚧 El limitador de intentos

**Hace falta aunque no hubiera canales**: protege el acceso, el registro y `/recover-email`.

⚠️ **Se limita por NÚMERO DE DESTINO, no sólo por origen.** Si no, el sistema sirve para
llenarle el móvil a un tercero con códigos que no pidió.

⚠️ **Sin Redis, un limitador en memoria protege UNA instancia** y deja de proteger en cuanto
haya dos. Hay que escribirlo donde se vea, no dejarlo implícito.

---

## 2 · Cómo se verifica cada tarea

Pila **C** desde el worktree `deasy-channels`, en **https://localhost:8643**.

```bash
cd channels && npm test                                   # la lógica, sin red
bash scripts/stack.sh c exec -T backend npm run test:unit
bash scripts/stack.sh c exec -T backend npm run test:char:run
node scripts/docs/check-doc-modelo.mjs                    # la doc del modelo
```

⚠️ **Y lo que las pruebas no ven:** que un QR se escanee de verdad, que llegue un mensaje y
que el teléfono quede verificado. Eso se comprueba **con un teléfono en la mano**, y las
tareas `C3`, `C5` y `C6` **no se cierran sin eso**.

---

## 2b · ✅ Cerrada: la rama permisiva de `numerosIguales`

**Salió de una casualidad medida el 2026-08-31**, probando `C3` con un teléfono real. Un teléfono
guardado mal —con el prefijo del país *dentro* de `numero`— se verificó igualmente, porque la
comparación aceptaba tres escrituras y una era **la parte local a secas**.

Esa tolerancia existía por el **SMS nacional desde módem propio**: `C6`, **bloqueada y sin
implementar**. Se pagaba permisividad por un canal que no existe, y la factura llegó antes que el
canal. Y es de la misma familia que el agujero de `C2b`: **en cuanto se compara algo que no lleva
país, el país deja de pintar nada.**

**Decisión del dueño (2026-08-31): cerrarla.** Ahora se exige E.164 siempre. Telegram, WhatsApp y
cualquier pasarela entregan el número con su país; si `C6` acaba necesitando la forma local, se
reinstaura sabiendo el país **por la red del propio módem**, que es donde ese dato sí está.

Y una segunda mitad, porque cerrar la rama sola habría empeorado el mensaje: un registro corrupto
pasaría a fallar **al final del camino**, diciendo «ese número no es el tuyo» — que es mentira y no
dice qué arreglar. Ahora `numeroMalGuardado` lo detecta **al pedir la llave**:

> Ese teléfono está guardado con el prefijo del país dentro del número. Edítalo y deja sólo la parte local.

Es la misma lección que el teléfono sin país: **un fallo del dato no se le cuenta a nadie como un
fallo suyo.**

Mutaciones: reponer la rama local falla 2 unitarias y 1 de caracterización; quitar el detector falla
1 y 1.

---

## 3 · Lo que este frente NO hace

**No verifica correos.** Ya funciona en el backend. Sólo se le añade el paso obligatorio
(`C8`) y la configuración que le falta.

**No manda mensajes en nombre de nadie.** Escribirle a alguien por WhatsApp es **un enlace**
que abre el WhatsApp del propio usuario — front y backend, no este servicio. Las
multisesiones se descartaron por sobrediseño, y el porqué está en el documento de diseño.

**No decide el canal por el usuario.** Se ofrecen los tres en orden; elige él.

**No construye la app propia.** Cuando exista, entra **como un cuarto canal** por la misma
interfaz — que es justo para lo que sirve tenerla.
