# `channels` con más de una intención — diseño

> **Qué decide este documento.** Qué hace falta para que los bots sirvan para algo más que
> verificar un número —recibir una ubicación, ejecutar un comando— **sin** que el diseño se
> convierta en un cajón de sastre. Y qué **no** hace falta, que resultó ser la mitad.
>
> **Estado: PROPUESTA.** Nada de esto está implementado. La decisión es del dueño.

---

## 0 · Tres suposiciones mías que el dueño tumbó, y qué queda de la propuesta

Este documento nació de una propuesta anterior con tres piezas. **Dos se caen**, y conviene
empezar por ahí porque el diseño resultante es bastante más pequeño.

| Lo que propuse | Por qué se cae |
|---|---|
| Una tabla que vincule **conversación ↔ persona** | El número **ya identifica a una persona**, y en WhatsApp se resuelve en cada mensaje. No hay nada que recordar |
| Que la ubicación la mande **el titular de la cuenta** | **Una dirección no es una afirmación sobre la identidad.** Exigirlo no compra seguridad y sí rompe casos reales |
| «Guardar las conversaciones con el bot» | **Ya se guardan**, sin que nadie lo decidiera — ver §5, que es un hallazgo, no un diseño |

Lo que sobrevive es **una sola idea**: hoy el canal sabe demasiado. Extrae la llave él mismo, así
que **sólo sabe hablar de verificación**. Eso es lo único que hay que cambiar.

---

## 1 · El problema real: el contrato tiene una sola frase

Hoy `Canal` entrega esto:

```js
new MensajeEntrante({ canal, llave, numeroProbado, contexto })
```

`llave` está **dentro del mensaje**, y la extrae el canal (`llaveDe(mensaje.body)`). De ahí salen
dos consecuencias que no se ven hasta que hace falta otra cosa:

1. **Un mensaje que no lleva llave no existe.** Una ubicación no cabe: no hay campo donde ponerla,
   y meterla en `llave` sería el injerto de caso especial en el camino genérico que el `CLAUDE.md`
   prohíbe explícitamente.
2. **El canal decide qué es relevante.** Un canal debería saber de *transporte*, no de *para qué
   sirve el sistema*.

⚠️ **Y ya hay una grieta por ahí.** `llave.js` tiene un mínimo de 20 caracteres para que «hola» no
provoque una consulta al backend. Es una heurística sobre el contenido **metida en el transporte**,
y funciona sólo mientras haya una única intención. Con dos, ese `if` empieza a crecer — que es
exactamente cómo `AdminTableManager` se convirtió en un God object.

---

## 2 · El diseño: el canal normaliza, el backend decide

**Se conserva el invariante de `C2b`, que ya está probado: el servicio OBSERVA, el backend DICTA.**
No se inventa nada nuevo; se extiende lo que ya funciona.

### Nivel 1 · El canal entrega un mensaje normalizado, sin interpretarlo

```js
new MensajeEntrante({
  canal: "whatsapp",
  tipo: "texto" | "ubicacion" | "contacto",
  contenido: { texto } | { latitud, longitud, precision } | { telefono },
  remitente: {
    idDeCanal: "…@lid",        // opaco, siempre presente
    numeroProbado: "593…"|null, // SÓLO si el transporte lo prueba
  },
  contexto: { … },
})
```

**Lo que cambia respecto a hoy:** desaparece `llave`. El canal ya no busca nada dentro del texto.

**Lo que NO cambia, y es lo que vale:** la obligación de `numeroProbado` sigue intacta. Si un canal
lo rellena, está afirmando que ese número es de quien escribe. Sigue siendo `null` cuando no puede
probarlo — y **eso ahora importa mucho más**, ver §4.

### Nivel 2 · El backend enruta por la llave, no el servicio

```
POST /internal/mensajes     { canal, tipo, contenido, remitente }
  → { atendido: true|false, motivo: "…" }
```

El backend mira la llave que venga en el texto, **la busca en su catálogo de llaves vivas** y de ahí
sale la intención. El servicio no necesita saber cuántas intenciones hay.

⚠️ **Deliberadamente NO se codifica la intención en la llave** (nada de prefijos `V-` / `U-`). Dos
razones: una llave con prefijo **dice para qué sirve a quien la intercepte**, y además volvería a
poner al canal a interpretar contenido, que es el problema que se está arreglando.

**Qué se gana:** añadir una intención es una fila en una tabla y una política en el backend.
**Cero** cambios en `channels`.

### Y la respuesta al usuario sigue componiéndola el canal

El backend devuelve un `motivo`; el canal lo traduce a texto. Es lo que ya se hace, y hay que
mantenerlo: el registro del backend no debe llenarse de literales de WhatsApp.

---

## 3 · La pregunta del dueño: ¿hace falta guardar la conversación?

**No.** Y el argumento del dueño es correcto: **un número de teléfono, con su país, pertenece a una
persona y sólo a una.** Ya es el identificador. `telefonos` lo tiene, y la verificación lo ata.

Pero hay una **asimetría medida** que el diseño tiene que respetar, porque decide qué es posible en
cada canal:

| | ¿Llega el teléfono en un mensaje cualquiera? |
|---|---|
| **WhatsApp** | **Sí.** `msg.from` es `@c.us` (el número) o `@lid`, que se resuelve con `getContactLidAndPhone`. Cada mensaje |
| **Telegram** | **NO.** Llega `from.id`, un identificador de chat. El teléfono **sólo** aparece cuando la persona pulsa «compartir contacto» — una acción deliberada, y por eso `C3` tiene dos pasos |

**Consecuencia:** si la ubicación se atara a «quién eres», **en Telegram habría que pedir el
contacto otra vez en cada uso**. Sería un peaje de identidad para una función que no necesita
identidad. Es la segunda razón por la que la §4 sale como sale.

---

## 4 · ¿Tiene que mandar la ubicación el titular de la cuenta? **No.**

Ésta es la decisión de fondo, y merece separarse en las dos preguntas que el dueño planteó.

### 4.1 · Desde la funcionalidad

El caso de uso es **rellenar un formulario de dirección**: latitud, longitud, calle, ciudad, país.
Alguien está en el ordenador con el formulario abierto y quiere no teclear.

Atar el remitente al titular **rompe casos legítimos y frecuentes**:

- La **secretaría** que da de alta a un docente que está en su despacho.
- Quien tiene el formulario abierto en un ordenador **cuyo teléfono no es el registrado**.
- Un **técnico en campo** enviando la ubicación de una sede, que no es su domicilio.
- Quien registra a **otra persona** — que en este sistema pasa, porque hay altas administrativas.

Y no compra nada a cambio: la persona **ve la dirección antes de guardarla**.

### 4.2 · Desde la seguridad

La pregunta correcta no es *«¿quién manda?»* sino **«¿qué está afirmando este mensaje?»**.

| | Verificar un teléfono | Prellenar una dirección |
|---|---|---|
| Qué afirma el mensaje | **«este número es mío»** | «estas coordenadas son útiles» |
| Quién es el remitente | **ES la carga útil** | irrelevante |
| Qué pasa si miente | Se suplanta una identidad | Sale una dirección mal, **y se ve** |
| Quién lo revisa | Nadie: el sistema lo sella | **La persona, antes de guardar** |

**Son intenciones de naturaleza distinta, y por eso el contrato de dos niveles se gana el sueldo.**
En la primera, la identidad del remitente es el producto. En la segunda, no hay ninguna afirmación
de identidad que proteger.

**Lo que ata el mensaje al formulario es la LLAVE, no el remitente.** Es una capacidad de un solo
uso, corta de vida y ligada a la sesión que la pidió. El remitente ni se comprueba.

**Radio de daño si una llave se filtra:** alguien mete **una sugerencia** de dirección en un
formulario que otra persona está mirando. No hay acceso, no hay escritura en la base, no hay
suplantación. Se rechaza cerrando el formulario.

### 4.3 · Las tres condiciones que hacen esto seguro, y son innegociables

1. **PRELLENAR, NUNCA GUARDAR.** La confirmación de la persona **es** el control de seguridad. En
   cuanto algo se guarde solo, este análisis entero deja de valer.
2. **DECIR DE DÓNDE VINO.** «Recibido de un WhatsApp terminado en ·· 11» junto al campo. Barato, y
   convierte un envío inesperado en algo evidente en vez de silencioso.
3. **NO CONVERTIRLA EN PRUEBA.** El día que una dirección así valga como justificante de domicilio,
   **pasa a ser una afirmación** y entonces sí exige al titular. Hay que dejarlo escrito donde se
   implemente, porque es el cambio que nadie ve venir.

### 4.4 · Y una que sí exige al titular

**Ningún mensaje entrante puede cambiar el teléfono, el correo o la contraseña.** Eso son
afirmaciones sobre la identidad. Si algún día se propone «cambia tu correo por WhatsApp», la
respuesta la da la tabla de §4.2, no la comodidad.

---

## 5 · 🔴 Hallazgo: la conversación YA se guarda, y nadie lo decidió

El dueño preguntó si las conversaciones no estaban ya en disco. **Lo están.** Medido hoy en el
volumen `channels_whatsapp` de la pila C:

```
253,7 MB en total
 44,1 MB  IndexedDB de https_web.whatsapp.com   ← el almacén de WhatsApp Web
 50,8 MB  Cache
 59,4 MB  Code Cache
```

Y dentro de ese IndexedDB, **el número del único teléfono que ha escrito al bot aparece 25 veces**.

**Matiz, porque exagerarlo sería igual de malo que ignorarlo:** los **cuerpos** de los mensajes
**no** están en claro — WhatsApp cifra su base local, y buscar el texto de nuestras propias
respuestas da **cero** coincidencias. Pero eso **no es una frontera de seguridad**: las claves viven
en el mismo perfil, que es justo lo que permite que la sesión sobreviva a un reinicio. Protege de un
`grep`, no de quien tenga el volumen.

### Por qué importa

- **No es un dato del sistema: es un efecto secundario** de conducir un WhatsApp Web de verdad. Nadie
  lo diseñó, nadie lo revisa y no se limpia nunca.
- **Ese volumen es dato personal.** Quien lo copie tiene los identificadores de todo el que haya
  escrito. Necesita la misma política que la base: quién accede, cuánto se guarda, si va a copias de
  seguridad.
- **Crece sin techo.** Hoy 253 MB con **un** teléfono en pruebas.
- **Y es un argumento serio a favor de la API oficial** el día que se plantee escribir a usuarios:
  ahí no hay perfil de navegador que custodiar.

### Qué hacer, en orden de coste

| | |
|---|---|
| **Ya** | Decirlo donde se declara el volumen. Nadie que lea el compose sospecha que ahí hay datos personales |
| **Barato** | Excluir `Cache`, `Code Cache` y `component_crx_cache` de cualquier copia de seguridad: son **110 MB de los 253** y no contienen nada que haga falta conservar |
| **A decidir** | Si se purga el perfil cada X tiempo. Cuesta una revinculación con el teléfono en la mano, así que **es una decisión del dueño**, no una obviedad |

⚠️ **Lo que NO hay que hacer es borrar el perfil «por limpiar».** Ahí vive la sesión: borrarlo deja
el canal caído hasta que alguien escanee un QR.

---

## 6 · Lo que NO propone este documento

- **Escribirle a usuarios.** Es un servicio hermano, no éste ampliado: con la API oficial hay coste
  por conversación, plantillas que aprueba Meta y una ventana de 24 h. Todo lo que hace barato y
  seguro el diseño actual —coste cero, sin ataque de coste, sin bloqueos por envío— **viene de que
  sólo recibimos**. El 2026-09-01 se borraron 464 líneas que hacían justo eso, y mal.
- **Una tabla de conversaciones.** §3.
- **Un `Strategy` de intenciones dentro de `channels`.** Con el enrutado en el backend, el servicio
  no necesita saber que existen varias.

---

## 7 · Qué hay que hacer antes, y no es negociable

**`C9`, el limitador.** Hoy **no existe ninguno en todo el sistema**. Con una sola intención el daño
está acotado porque una llave inválida se descarta en el servicio. Con mensajes de **remitentes que
ya no se comprueban** —que es justo lo que §4 permite a propósito—, cada mensaje entrante es trabajo
no autenticado: una consulta al backend, y en WhatsApp una posible ida al servidor para resolver un
`@lid`.

**Esto no es una recomendación de orden: es una condición.** La §4 es defendible *porque* el volumen
está acotado. Sin limitador, no lo está.

Y **`C7`**, la pestaña de administración, se vuelve más necesaria: más intenciones son más formas de
que el canal esté mudo sin que nadie se entere.

---

## 8 · Resumen para decidir

| Pregunta del dueño | Respuesta |
|---|---|
| ¿Se van a guardar las conversaciones? | **No hace falta.** Y ya se guardan sin querer: §5 |
| ¿El número no identifica ya a la persona? | **Sí, y por eso no hay tabla nueva.** Pero sólo WhatsApp lo entrega en cada mensaje; Telegram no (§3) |
| ¿Tiene que mandarla el titular? | **No.** La llave ata el mensaje al formulario; el remitente es irrelevante — con tres condiciones (§4.3) |

**Lo que hay que aprobar:** el contrato de dos niveles (§2), las tres condiciones de la §4.3, y qué
se hace con el perfil de WhatsApp (§5).
