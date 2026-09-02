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
