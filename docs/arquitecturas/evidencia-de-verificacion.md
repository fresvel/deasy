# La evidencia de una verificación — ❌ DESCARTADO

> 🛑 **DESCARTADO POR EL DUEÑO EL 2026-09-02. El sello no se hace.** No es una pausa: es un descarte,
> y el razonamiento que lo tumba está abajo porque merece conservarse — se llegó a él discutiendo, y
> sin él alguien lo volverá a proponer.

---

## 0 · Por qué se descarta

El sello llegó a tener **tres propósitos**, y **los tres cayeron, uno por turno**:

| Propósito | Por qué cayó |
|---|---|
| **1 · Prueba de no repudio frente a un reclamante** | ❌ **Lo desmontó el dueño:** *«tú tenías la llave, tú pusiste el número, nada te impedía crear el sello sin mi intervención»*. Es correcto — **nada que construyamos nosotros solos prueba que el usuario actuó**. Una cadena de hashes protege contra **nuestra alteración posterior**, no contra que nos lo inventáramos desde el principio |
| **2 · Hacer aplicable la regla de retención** (guardar número y persona) | ❌ **Innecesario:** `telefono_verification_keys` **no se borra** —los dos `DELETE` que existen sólo tocan las llaves NO consumidas— así que un `JOIN` con `telefonos` contesta *«¿este número verificó alguna vez?»* con lo que **ya hay** |
| **3 · Auditoría interna** (detectar manipulación desde dentro) | 🟡 Legítimo, **pero no justifica por sí solo** crear un bucket inmutable e irreversible de diez años |

⚠️ **Y hubo un cuarto argumento del dueño que cierra el asunto:** *«la huella de todos modos no nos
dará no repudio»*. Poner criptografía encima de algo que **por construcción** no puede darlo es coste
sin beneficio.

## 0bis · Lo que sí queda de todo esto, y merece leerse

Aunque el sello no se haga, la discusión dejó tres cosas que siguen siendo ciertas y que conviene
tener a mano el día que alguien plantee «vamos a hacer esto a prueba de manipulación»:

1. **El eje que decide una disputa no es la durabilidad ni la consultabilidad: es QUIÉN PUDO
   PRODUCIRLO** (§3). Por ese eje, un mensaje entrante de WhatsApp vale más que cualquier registro
   nuestro, porque para existir **tuvo que entregarlo un tercero**.
2. **No repudio del HECHO no es autenticación de la PERSONA** (§2quinquies). Un teléfono robado o un
   cambio de SIM producen una verificación válida sobre un hecho fraudulento.
3. **El día que recuperar la contraseña pase por un canal, el teléfono se convierte en la llave de la
   cuenta** — y ahí sí hará falta algo más, pero **no un sello: la firma del propio usuario**, con una
   clave que nosotros nunca tengamos. El sistema ya tiene un firmador con certificados.

---

---

## 1 · Lo que faltaba en mi razonamiento

Yo defendí borrar los mensajes con dos argumentos correctos —el chat es débil como prueba y es un
pasivo bajo la LOPDP— y **uno que faltaba: qué pone uno en su lugar.**

Decir *«la evidencia está en la base»* no bastaba, porque la objeción del dueño a la base sigue en
pie: **la controlamos nosotros.** Quitar la prueba débil sin poner una fuerte deja el sistema **peor**
que antes.

**La decisión del bucket WORM cambia eso.** Ahora existe un sitio del que **ni nosotros** podemos
quitar lo que ya pusimos — medido: sobrescribir crea una versión nueva, borrar crea un marcador, y
la versión original sigue ahí. Ése es el sitio donde debe vivir la evidencia.

---

## 2 · El diseño: se sella el HECHO, no el mensaje

Cuando una verificación tiene éxito, se escribe **un objeto inmutable** en el bucket con bloqueo:

```json
{
  "tipo": "verificacion_de_telefono",
  "ocurrido_at": "2026-09-01T15:03:58.689Z",
  "telefono_id": 16,
  "person_id": 55,
  "canal": "whatsapp",
  "llave_hash": "6de8483b402c…",
  "numero_afirmado_por": "plataforma",
  "sello_anterior": "a91c…"
}
```

### Los tres campos que lo hacen prueba, y por qué

| Campo | Qué demuestra |
|---|---|
| **`llave_hash`** | Que **la llave la emitimos nosotros** y sólo nosotros: es la huella de un secreto de 256 bits que nadie más pudo adivinar. Sin ella, «alguien escribió» no prueba que escribiera *lo que le mandamos* |
| **`numero_afirmado_por`** | Que **el número lo afirmó la plataforma**, no lo tecleó el usuario. Es la propiedad que hace válida una verificación entrante |
| **`sello_anterior`** | ⚠️ **El encadenamiento.** Cada sello incluye la huella del anterior, así que **quitar o alterar uno rompe la cadena de todos los que vienen después**. Es lo que convierte «guardamos filas» en «se puede demostrar que no se tocaron» |

⚠️ **Ese tercer campo es el que faltaba en todo lo anterior**, y es el que contesta de verdad a
*«¿nuestra base, manipulada por nosotros?»*: **no hace falta confiar en nosotros, hace falta poder
comprobarlo.**

---

## 2bis · DÓNDE se escribe, CUÁNDO y QUIÉN — lo que no quedó claro

### El momento exacto

Hay **un solo punto** en todo el sistema donde una verificación pasa de «alguien mandó algo» a «este
número queda verificado», y es este:

```
channels ──▶ POST /internal/verificacion/confirmar
                    │
                    └─▶ TelefonoVerificacionService.confirmar()
                             ├─ comprueba la llave y el número          ← ya existe
                             ├─ marca `telefono_canales.verificado = 1` ← ya existe
                             ├─ consume la llave                        ← ya existe
                             └─ ⬅ AQUÍ SE ESCRIBE EL SELLO             ← lo nuevo
```

⚠️ **Dentro de la MISMA transacción que ya existe.** Si el sello se escribiera después, un fallo
entre medias dejaría un teléfono verificado **sin prueba de por qué** — que es justo el agujero que
esto viene a tapar.

⚠️ **Y si el sello no se puede escribir, la verificación NO se confirma.** Es la decisión incómoda
pero correcta: una verificación sin prueba es exactamente lo que no queremos tener. Mejor pedirle a
la persona que lo intente otra vez que sellar a medias.

### Dónde queda

**Un objeto por verificación**, en el mismo bucket con bloqueo que los documentos legales:

```
deasy-legal/
  terminos/v1.md                        ← los documentos
  privacidad/v1.md
  sellos/2026/09/02/telefono-16-1543.json   ← un sello por verificación
```

**Y su ruta lleva la fecha** a propósito: sin eso, «dame todo lo de septiembre» sería recorrer el
bucket entero, y con diez años de retención eso deja de ser viable pronto.

### La cadena, con un ejemplo

Cada sello incluye **la huella del anterior**. Eso es lo que convierte un montón de ficheros sueltos
en algo que se puede comprobar:

```
sello #1   { …, "sello_anterior": null       }  → su SHA-256 es  a91c…
sello #2   { …, "sello_anterior": "a91c…"    }  → su SHA-256 es  4f02…
sello #3   { …, "sello_anterior": "4f02…"    }  → su SHA-256 es  b7d5…
```

**Si alguien altera el sello #2, su huella deja de ser `4f02…`** — y entonces el `sello_anterior` del
#3 ya no cuadra. **Y del #4, y de todos los siguientes.**

> Para falsificar **uno** habría que rehacer **todos los posteriores**… y no se puede, porque en el
> bucket con bloqueo **los anteriores no se pueden sobrescribir**. Ésa es toda la idea: no es que sea
> difícil, es que el almacén no lo permite.

⚠️ **La cabeza de la cadena vive en la base** (la huella del último sello). Y esa fila **sí** se
puede tocar — pero tocarla no sirve de nada: los sellos archivados siguen apuntándose entre ellos, y
recalcular la cadena entera desde el bucket **delata la manipulación**.

### Quién lo escribe, y quién no

| | |
|---|---|
| **Lo escribe** | El backend, automáticamente, dentro de la transacción de confirmación |
| **Nadie lo edita** | No hay pantalla, no hay endpoint de escritura. **Sólo se crean, nunca se modifican** |
| **Se leen** | Para responder a un reclamo, y para comprobar la cadena |

### ⚠️ Y una consecuencia que hay que aceptar antes de aprobar

**Un sello contiene `person_id` y `telefono_id`, y no se puede borrar durante 10 años.**

Es defendible por el **Art. 18.4** de la Ley y el **Art. 11.2** del Reglamento —*«para la formulación,
el ejercicio o la defensa de reclamaciones»*— que es la misma base con la que se conserva el
consentimiento. Pero conviene decirlo claro: **si alguien pide la eliminación de sus datos, este
sello sobrevive**, y hay que poder explicárselo con ese artículo en la mano.

**Por eso el sello guarda identificadores y no datos:** ni nombre, ni el número de teléfono, ni el
texto de ningún mensaje. Lo mínimo que sostiene la prueba.

## 2ter · Cómo se calcula la huella, exactamente

```js
// El sello, con LAS CLAVES EN ORDEN FIJO y sin espacios. No es cosmética: si el orden variara, el
// MISMO sello daría huellas distintas y la cadena no se podría recomprobar nunca.
const canonico = JSON.stringify({
  tipo, ocurrido_at, telefono_id, person_id, canal, llave_hash, numero_afirmado_por, sello_anterior
});
const huella = crypto.createHash("sha256").update(canonico, "utf8").digest("hex");
```

⚠️ **Tres detalles que parecen menores y no lo son:**

1. **Orden fijo de claves.** `JSON.stringify` respeta el orden de inserción, así que se construye el
   objeto con las claves en un orden literal y **nunca** a partir de otro objeto.
2. **UTF-8 explícito.** Sin declararlo, un acento podría codificarse distinto en otra plataforma y la
   huella cambiaría sin que el contenido cambie.
3. **Sin espacios ni saltos.** Un formateo distinto es un contenido distinto para SHA-256.

**Comprobar la cadena** es recorrer los sellos en orden, recalcular cada huella y verificar que la
del sello *n* es el `sello_anterior` del *n+1*. Si un solo eslabón no cuadra, **el punto exacto de la
manipulación queda señalado**.

---

## 2quater · ⚠️ Qué prueba de verdad, y qué NO — la corrección importante

He venido llamando a esto **«no repudio»**, y **el término es más fuerte de lo que el mecanismo
sostiene**. Al escribir cómo se calcula la huella queda claro por qué, y prefiero corregirlo ahora
que descubrirlo en un reclamo.

### Lo que SÍ prueba

| | |
|---|---|
| **Integridad** | El registro **no se ha alterado** desde que se escribió. Eso es sólido: la cadena lo hace comprobable y el bloqueo impide rehacerla |
| **Orden** | El sello #3 se escribió después del #2. Anterioridad **relativa**, y es real |
| **Todo o nada** | No se puede alterar *un* registro discretamente. Habría que rehacer **todos los posteriores**, y el bucket no lo permite |

### Lo que NO prueba, dicho sin adornos

⚠️ **La marca de tiempo la ponemos nosotros.** `ocurrido_at` es un campo que escribe nuestro código.
El bloqueo garantiza que **no cambió después**; no garantiza que fuera cierto al escribirse. Con
control total de la infraestructura, una cadena entera se puede fabricar hoy fechada ayer.

**Lo que la cadena hace es convertir una manipulación silenciosa en una manipulación total** — y eso
es mucho, pero **no es la firma de un tercero**.

### Lo que faltaría para llamarlo no repudio con propiedad

**Un ancla externa**, algo que nosotros no controlemos:

| | |
|---|---|
| **Sellado de tiempo cualificado (TSA, RFC 3161)** | Una entidad acreditada firma la huella con su reloj. **Es la respuesta estándar**, y en Ecuador hay entidades de certificación acreditadas |
| **Publicar la cabeza de la cadena** periódicamente donde no podamos tocarla | Más barato, menos formal |
| **Firmar el sello con el certificado institucional** | Añade atribución a la institución… que sigue siendo nosotros. **No resuelve el problema de fondo** |

⚠️ **Y ese ancla no está en este diseño.** Se puede añadir después sin rehacer nada —basta sellar la
cabeza de la cadena cada X— pero **hoy no está, y llamar a esto «no repudio» sin decirlo sería
prometer de más.**

**El nombre honesto de lo que se construye es: un registro de auditoría a prueba de manipulación.**

---

## 2quinquies · ¿Prueba que fue EL USUARIO, con SU número?

Ésta es la pregunta del dueño, y la respuesta tiene dos partes que conviene no mezclar.

### La cadena de razonamiento que sí se sostiene

1. Generamos una llave **aleatoria de 256 bits** y la enseñamos **sólo a la sesión que la pidió**.
2. Esa llave volvió **desde un número que la plataforma afirmó** — no que el usuario tecleó.
3. Por tanto: **quien controlaba ese teléfono en ese momento tenía una llave que sólo esa sesión
   había visto.**

Eso es evidencia sólida de **posesión del teléfono en ese instante**, y de que **quien lo tenía
estaba coordinado con quien tenía la sesión abierta**.

### ⚠️ Pero NO prueba quién es la persona

**El sello registra fielmente lo que el sistema observó. No sabe quién estaba al otro lado.**

Si alguien roba el teléfono desbloqueado, hace un **cambio de SIM**, o secuestra una sesión de
WhatsApp Web, **la verificación sería válida y el sello la registraría como tal**. Sería un registro
correcto de un hecho fraudulento.

> **No repudio del HECHO ≠ autenticación de la PERSONA.** Confundirlos es lo que hace que un sistema
> parezca más seguro de lo que es.

### Y esto responde a la pregunta sobre el futuro

El dueño lo planteó bien: *«hoy la contraseña se recupera por correo, ¿y mañana con `channels` o con
la app propia?»*.

⚠️ **El día que recuperar el acceso pase por un canal, el teléfono se convierte en la llave de la
cuenta** — y todo lo de arriba deja de ser teórico:

| | |
|---|---|
| **Hoy** | El teléfono **sólo verifica** que el número es tuyo. Perderlo no da acceso a nada |
| **Si mañana recupera contraseñas** | Quien controle el número **entra en la cuenta**. Un cambio de SIM pasa de molestia a **toma de control** |

**Lo que haría falta antes de dar ese paso** —y conviene que esté escrito antes de que alguien lo
proponga como una mejora de comodidad—:

1. **Un segundo factor que no sea el mismo teléfono.** Si el canal es lo único, el canal es la
   cuenta.
2. **Avisar por TODOS los canales cuando se recupera el acceso**, no sólo por el usado. Es barato, y
   es lo que hace que el titular legítimo **se entere** de un intento ajeno.
3. **Un plazo antes de que el cambio surta efecto**, con posibilidad de cancelarlo. Convierte un robo
   instantáneo en uno que hay que sostener en el tiempo.
4. **Y el sello, que sí sirve aquí**: deja constancia de que la recuperación ocurrió, por dónde y
   cuándo — para que, cuando alguien reclame, **haya algo que mirar** aunque no pruebe quién fue.

## 3 · 🛑 El argumento del dueño, y por qué tiene razón

El dueño puso el caso en la mano, y **desmonta el diseño anterior**:

> *«Yo me registré con el número AA y luego borré los mensajes de mi teléfono. Voy a la empresa y
> digo que yo nunca me registré con ese número, que nunca envié ese mensaje. Tú quieres comprobarlo
> con tu base, y yo digo: **tú tenías la llave, tú pusiste el número, nada te impedía crear el sello
> sin mi intervención.** […] Todo este blockchain es inútil porque igual pude estar haciéndolo con
> mis propias claves de administrador.»*

**Es correcto, y el fallo de mi razonamiento tiene nombre.**

### Yo estaba ordenando las pruebas por el eje equivocado

Comparé el chat y el sello por **durabilidad**, **consultabilidad** y **coste en privacidad**. Por
esos ejes el sello gana con claridad. **Pero ése no es el eje que decide una disputa.** El eje que
decide es:

> ### ¿Quién PUDO haber producido esto?

Y ahí el orden se invierte:

| | ¿Lo pudimos fabricar nosotros solos? |
|---|---|
| **El sello encadenado en WORM** | **SÍ.** Nosotros generamos la llave, nosotros escribimos el número, nosotros creamos el objeto. La cadena y el bloqueo prueban que **no lo cambiamos después** — no que fuera cierto al escribirlo |
| **Un mensaje entrante de WhatsApp** | **NO.** Para que exista, **la infraestructura de Meta tuvo que entregarlo**, y eso es un acto de un tercero que no controlamos |

**Ésa es toda la diferencia, y es la que importa.** Una cadena de hashes protege contra *nuestra
alteración posterior* — un ataque distinto y menor. **No protege contra que nos lo inventáramos desde
el principio**, que es exactamente lo que el reclamante alegaría.

### Y el valor del chat no está donde yo lo buscaba

Yo decía «es nuestra copia, en nuestro teléfono, alterable». Cierto. **Pero su valor no está en
nuestra copia**: está en que **el mismo hecho existe en dos sitios que no controlamos** —los
registros de Meta y el teléfono de la otra persona—. Nuestra copia es **un puntero a la prueba de un
tercero**, no la prueba.

⚠️ **Y sobre el sellado de tiempo cualificado, el dueño también acierta:** una TSA certifica *cuándo*
se escribió algo, no *que fuera verdad*. Un sello falso con fecha certificada sigue siendo falso.
**Es un factor externo sobre el continente, no sobre el contenido.**

---

## 3bis · La conclusión honesta, y es incómoda

> **Nada que construyamos nosotros solos puede probar que el usuario actuó. Por construcción.**

Cualquier registro que produce nuestro sistema es una **afirmación nuestra**. Da igual cómo se
encadene, dónde se archive o quién le ponga la hora: **el autor sigue siendo el interesado en el
resultado.**

Para probar un acto del usuario hace falta **algo que sólo el usuario pudiera producir**, y sólo hay
tres formas:

| | Quién lo produce | ¿Lo tenemos? |
|---|---|---|
| **Una firma con una clave que NOSOTROS NUNCA tengamos** | El usuario | ⚠️ **Existe el firmador, pero no se usa para esto** |
| **Los registros de la plataforma** (Meta, Telegram) | Un tercero | ⚠️ **Existen — pero no guardamos con qué pedirlos** |
| **La copia del propio reclamante** | La otra parte | Existe, y no depende de nosotros |

---

## 3ter · Lo que sale de aquí, y cambia el diseño

### A · Guardar el IDENTIFICADOR DE LA PLATAFORMA — lo único verdaderamente nuevo

Cada mensaje entrante trae **el identificador que le puso la plataforma** (comprobado: la librería lo
expone en `msg.id`, y Telegram da su `update_id` y `message_id`).

**Ese identificador NO es dato nuestro: es una referencia dentro del sistema de un tercero.**

> **Es lo único de todo este diseño que no podríamos haber inventado**, porque tendría que existir en
> los servidores de Meta para ser válido. Frente al reclamo del dueño, es lo que convierte
> *«nosotros decimos que escribiste»* en *«pregúntale a Meta por este mensaje concreto»*.

Ocupa unas decenas de bytes, no contiene el texto, y es **exactamente lo que un requerimiento legal
necesita** para pedir la corroboración.

⚠️ **Esto no lo tenía el diseño anterior, y es lo que lo salva de ser inútil.**

### B · Reabrir la decisión de borrar los chats

La decisión de borrarlos se tomó con mi comparación errónea encima de la mesa. **Con el eje correcto,
el chat vale más de lo que dije** — no como prueba en sí, sino como puntero a la de Meta.

**Sigue en pie el argumento contrario** —minimización y conservación, Art. 10— así que **es un
compromiso real, no una respuesta obvia**, y lo decide el dueño con la comparación bien hecha. Ver §6.

### C · Para lo que de verdad exija no repudio, la firma del usuario

El día que recuperar una contraseña pase por un canal, **ningún registro nuestro bastará**. Lo que
bastaría es que el usuario **firme el acto con una clave que nosotros nunca tengamos** — y el sistema
**ya tiene un firmador con certificados**. Está construido para esto y no se está usando aquí.

### D · Y el sello se queda, con su papel REAL

No como prueba frente a un tercero, sino como **auditoría interna**: detectar si alguien de dentro
manipuló los registros. **Es un control contra el fraude interno, no contra el reclamo del usuario.**
Sigue mereciendo la pena — con ese nombre y no con otro.

---

## 4 · Y sigue sin ser evidencia de un tercero — dicho claro

Esto **no** convierte nuestro registro en prueba independiente. Sigue siendo nuestro. Lo que hace es
quitarle a la objeción su parte más fuerte: ya no es *«podéis haberlo escrito ayer»*, porque el
encadenamiento y el bloqueo lo desmienten.

**La prueba de un tercero sigue siendo Meta**, obtenible por vía legal — y existe la guardemos o no.
Lo que ahora tenemos es un registro propio **que se puede contrastar con ella** en vez de competir.

---

## 5 · Lo que NO hace

- **No sella lo que falló.** Sólo las verificaciones con éxito. Los intentos fallidos ya están en
  `intentos_limitados`, que es otro problema (abuso) y no merece un objeto inmutable cada uno.
- **No guarda el mensaje.** Ni su texto ni su longitud: el hecho, no el contenido.
- **No sustituye a `telefono_canales`.** Ésa es la que el sistema consulta para operar; ésta es la
  que se enseña cuando alguien discute.

---

## 6 · La decisión que hay que rehacer: ¿se borran los chats?

Se decidió borrarlos **con mi comparación errónea encima de la mesa**. Rehecha:

| | Borrar tras atender | Conservar N días |
|---|---|---|
| **Minimización (Art. 10.f)** | ✅ lo mejor | 🟡 aceptable con plazo declarado |
| **Conservación (Art. 10.i)** | ✅ plazo mínimo | ✅ plazo declarado |
| **Puntero a la prueba de un tercero** | ❌ **se pierde** | ✅ mientras dure |
| **Poder mirar el móvil ante un reclamo** | ❌ | ✅ |
| **Volumen** | plano | acotado |

⚠️ **Y hay un matiz que quita hierro a la decisión:** con el **identificador de la plataforma
guardado en la base** (§3ter.A), **el puntero a Meta sobrevive aunque el chat se borre**. El chat
añade poder verlo con los ojos; el identificador añade poder pedirlo formalmente — **y es el segundo
el que sirve en una disputa.**

**Dicho de otro modo: si se implementa §3ter.A, borrar los chats deja de costar lo que costaba.**

---

## 7 · Lo que este documento NO puede resolver, y conviene que quede escrito

**La verificación de un teléfono es, por naturaleza, una comprobación de POSESIÓN, no un acto
firmado.** «Alguien nos escribió desde ese número» no se puede convertir en «esta persona declaró
algo», por mucha criptografía que se le ponga a nuestro lado del cable.

Quien quiera no repudio de verdad sobre un acto, tiene que hacer que **el usuario firme el acto**.
Todo lo demás —cadenas, WORM, sellos de tiempo— protege contra **nuestra propia manipulación
posterior**, que es un riesgo real pero **distinto del que plantea el reclamante**.
