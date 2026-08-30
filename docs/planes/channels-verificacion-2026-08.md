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
| **C2** | El backend sabe **crear, resolver y consumir** una llave; el servicio sabe preguntárselo | ⬜ | | |
| **C3** | Un número real se verifica **por Telegram**, de punta a punta | ⬜ | | |
| **C4** | El servicio corre **como contenedor** en la pila, sin que lo alcance el navegador | ⬜ | | |
| **C5** | Un número real se verifica **por WhatsApp** — con el canal **reescrito de cero** | ⬜ | | |
| **C6** | Un número real se verifica **por SMS entrante** | ⛔ | **Bloqueada por una decisión del dueño**: módem propio o número alquilado | |
| **C7** | La pestaña de administración: estado de los canales y **el QR de WhatsApp** | ⬜ | | |
| **C8** | El registro es **una secuencia de tres pasos**, y el router manda a completar lo que falte | ⬜ | | |
| **C9** | 🚧 **El limitador de intentos** | ⬜ | | |

**9 tareas.** `C6` está bloqueada a propósito y no cuenta como pendiente de trabajo.

🚧 marca la que **no es sólo de este frente**: el limitador protege también el acceso, el
registro y `/recover-email`. Hoy **no existe ninguno** — 18 dependencias en el backend,
ninguna de límite ni de caché, y **no hay Redis en ninguna pila**.

### El orden, y por qué

```
C1 ──> C2 ─┬─> C3 ──> C4 ──> C8
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

### C3 · Telegram, de punta a punta

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

## 3 · Lo que este frente NO hace

**No verifica correos.** Ya funciona en el backend. Sólo se le añade el paso obligatorio
(`C8`) y la configuración que le falta.

**No manda mensajes en nombre de nadie.** Escribirle a alguien por WhatsApp es **un enlace**
que abre el WhatsApp del propio usuario — front y backend, no este servicio. Las
multisesiones se descartaron por sobrediseño, y el porqué está en el documento de diseño.

**No decide el canal por el usuario.** Se ofrecen los tres en orden; elige él.

**No construye la app propia.** Cuando exista, entra **como un cuarto canal** por la misma
interfaz — que es justo para lo que sirve tenerla.
