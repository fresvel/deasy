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
| **C4** | El servicio corre **como contenedor** en la pila, sin que lo alcance el navegador | ⬜ | | |
| **C5** | Un número real se verifica **por WhatsApp** — con el canal **reescrito de cero** | ⬜ | | |
| **C6** | Un número real se verifica **por SMS entrante** | ⛔ | **Bloqueada por una decisión del dueño**: módem propio o número alquilado | |
| **C7** | La pestaña de administración: estado de los canales y **el QR de WhatsApp** | ⬜ | | |
| **C8** | El registro es **una secuencia de tres pasos**, y el router manda a completar lo que falte | ⬜ | | |
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

⚠️ **La verificación de correo ya existe y está entera** —tabla propia, código cifrado, diez
minutos, un solo uso, y su pantalla—. **Lo único que le falta es que `SMTP_*` esté en el
entorno** y que **alguien la obligue a usarse**: hoy se envía el código y ahí acaba.

⚠️ **Y hay que decidir qué pasa con quien ya está registrado** el día que esto sea
obligatorio: o se le respeta lo que tiene, o se le hace pasar por el circuito. No lo decide
el código.

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

## 2b · Cuestión abierta: la rama permisiva de `numerosIguales`

**Sale de una casualidad medida el 2026-08-31.** Un teléfono guardado mal —con el prefijo del país
*dentro* de `numero`— se verificó igualmente, porque la comparación acepta tres escrituras del número
que llega y una de ellas es **la parte local a secas**.

Esa tolerancia existe por el **SMS nacional desde módem propio**, que es el único transporte capaz de
entregar un número sin país. Y ese transporte es `C6`, que **está bloqueada y sin implementar**.

El problema: la rama es de la misma familia que el agujero que cerró `C2b`. Si `numero` contiene por
error un número internacional de otro país, alguien con **esa** línea lo verifica — el país deja de
pintar nada, que es justo lo que `C2b` arregló.

**Lo que propongo, y no he hecho porque es una decisión, no una corrección:** retirar la rama local y
exigir E.164 siempre. Telegram, WhatsApp y cualquier pasarela de SMS entregan el número con su país;
la rama sólo sirve al módem propio, y **estamos pagando permisividad por un canal que no existe**. Si
`C6` acaba necesitándola, se reinstaura sabiendo el país por la red del propio módem, que es donde
esa información sí está.

⚠️ Comprobado que la verificación real del 2026-08-31 **no dependía de esa rama**: con el número ya
corregido (9 dígitos locales + `+593`), lo que casó fue la forma internacional.

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
