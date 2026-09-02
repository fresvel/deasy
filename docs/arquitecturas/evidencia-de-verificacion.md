# La evidencia de una verificación — diseño

> **Estado: PROPUESTA.**
>
> Nace de una objeción del dueño: al elegir borrar los mensajes de WhatsApp tras atenderlos, señaló
> *«parece que estás olvidando lo de no repudio en este punto»*. **Tenía razón: lo dejé cojo.**

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

## 3 · Por qué esto es MEJOR que guardar el chat, punto por punto

| | El chat de WhatsApp | El sello encadenado en WORM |
|---|---|---|
| ¿Se puede borrar? | **Sí, con dos toques y sin rastro** | **No**, ni con credenciales de raíz, durante 10 años |
| ¿Se puede alterar? | Sí, y es indetectable | **No sin romper la cadena** |
| ¿Sobrevive a re-vincular? | ❌ **Se pierde entero** | ✅ |
| ¿Se puede consultar y exportar? | ❌ | ✅ |
| ¿Entra en copias? | ❌ | ✅ |
| ¿Cuánto dato personal guarda? | **El mensaje entero de cada persona** | Identificadores mínimos, sin texto |
| ¿Tiene plazo? | ❌ ninguno | ✅ 10 años, declarado |

> **Se cambia una prueba débil, perecedera y cara en privacidad por una fuerte, duradera y mínima.**
> Ésa es la respuesta a la objeción, y sin ella borrar los chats sí habría sido un retroceso.

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
