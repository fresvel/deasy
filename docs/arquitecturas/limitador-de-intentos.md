# `C9` · El limitador de intentos — evaluación y diseño

> **Estado: PROPUESTA.** Nada implementado. La decisión es del dueño.
>
> Hoy **no existe ningún limitador en todo el sistema**. Este documento dice qué hay que frenar,
> con qué se cuenta, dónde vive el contador y qué **no** arregla.

---

## 1 · Lo que ya existe, y manda sobre el diseño

**Hay UN freno en todo el repositorio**, en `reenviarMiCodigo`, y su comentario ya decidió la mitad
de este documento:

> *«El freno se calcula sobre la fila que ya existe, no en memoria: un contador en memoria dejaría
> de proteger en cuanto hubiera dos instancias.»*

**Ese criterio se conserva.** No se propone nada que lo contradiga, y `reenviarMiCodigo` acabará
usando el mecanismo común en vez de su consulta propia.

Y dos cosas más, medidas hoy:

| | |
|---|---|
| `app.set("trust proxy", 1)` en `backend/index.js`, y nginx manda `X-Forwarded-For` | **`req.ip` es la IP real del cliente.** No hay que tocar nada para empezar a contar por IP |
| Cero dependencias de límite o caché · **no hay Redis en ninguna pila** | Lo que se elija tiene que funcionar con lo que hay, o traer infraestructura nueva |

---

## 2 · Qué hay que frenar — el inventario, medido

### 2.1 · 🔴 Dos rutas públicas que gastan DINERO de terceros

```
GET /users/validate/cedula/:cedula     → https://webservices.ec/api
GET /users/validate/whatsapp/:phone    → https://webservices.ec/api
```

**Sin autenticación, sin límite, y cada llamada consume cuota de un servicio externo de pago.**
Cualquiera con `curl` y un bucle puede agotarla o hacer que nos bloqueen — y **el daño no lo
sufrimos en nuestra máquina**, que es lo que lo hace fácil de no ver.

⚠️ Esto es un **ataque de coste**, exactamente el que el diseño de `channels` presume de no tener.
La presunción era cierta **para los canales** y falsa para el sistema: aquí había una puerta abierta
al lado.

**Es lo más urgente de `C9`.** No es hipotético: es una factura de otro y una reputación con un
proveedor.

### 2.2 · La fuerza bruta contra el acceso

`POST /users/login` no tiene freno. Y hay un detalle que cambia el diseño: la comprobación es
**bcrypt**, deliberadamente cara. Un atacante que dispare contra `/login` **no está sólo probando
contraseñas: está gastando nuestra CPU**.

⚠️ **De ahí sale una regla de implementación que no es negociable: el limitador va ANTES de bcrypt.**
Si se cuenta después, el ataque de CPU funciona igual aunque el intento se rechace.

### 2.3 · Las anónimas que crean cosas o mandan correos

| | |
|---|---|
| `POST /users` (registro) | Crea persona, correo y teléfono, y **manda un correo** |
| `POST /users/recuperar-correo` | Manda un correo |
| `POST /reset-password/request` · `/verify` · `/reset` | Manda un correo · adivinable |
| `POST /system/bootstrap/initialize` | Sólo la primera vez, pero conviene no dejarla desnuda |

### 2.4 · Las autenticadas que emiten llaves

`POST /users/me/telefonos/:id/verificacion` emite una llave de verificación. **No cuesta dinero**
—paga quien envía, que es la propiedad del frente 15— pero sí escribe una fila y permite ensuciar la
tabla.

### 2.5 · Lo que NO es de `C9`, y conviene decirlo

- **`/internal`** está tras clave de servicio y nginx devuelve 404 para `/api/internal/`.
- **`program_router` y `unit_router` no tienen NINGUNA autenticación** (documentado en el sitio).
  **Eso no lo arregla un limitador**: un limitador hace que te saqueen despacio. Es un defecto
  aparte y hay que tratarlo como tal.

---

## 3 · La decisión difícil: ¿contando QUÉ?

Aquí es donde un limitador mal diseñado hace más daño que bien.

### ❌ Sólo por IP — **rompe este despliegue en concreto**

Una universidad sale a internet **por NAT**: el campus entero comparte una IP pública. Un límite de
`5 intentos de login por IP cada 15 minutos` significa que **al quinto despiste de cualquiera, se
queda toda la facultad fuera**.

⚠️ Esto no es teórico ni general: es el patrón de red de *este* cliente. Un limitador por IP en una
institución es una avería con calendario.

### ❌ Sólo por cuenta — **regala un ataque de bloqueo**

Contar los fallos por correo y bloquear la cuenta convierte el limitador **en el arma**: cualquiera
que sepa tu correo te deja fuera fallando adrede. Se cambia una vulnerabilidad por otra.

### ✅ Por **(acción, sujeto)**, con el sujeto elegido por acción — y **frenar, nunca bloquear**

| Acción | Sujeto | Por qué ése |
|---|---|---|
| `login` | **`correo` + `ip` juntos** | Ataca al par que de verdad está fallando. Al vecino de NAT no le pasa nada, y nadie puede bloquear una cuenta ajena |
| `validar_cedula` · `validar_whatsapp` | **`ip`** | Es anónima y cuesta dinero. Aquí el corte por IP **sí** es lo correcto: es una comodidad, no el acceso |
| `registro` · `recuperar_correo` · `reset_password` | **`ip`**, holgado | Anónimas y mandan correo. Holgado porque una sala de informática registra a treinta personas seguidas y eso es legítimo |
| `emitir_llave_telefono` | **`person_id`** | Está autenticado: el sujeto correcto es la persona, no dónde está |
| `reenviar_codigo_correo` | **`person_id`** | Ya existe; se migra al mecanismo común |

**Y la regla que evita el peor efecto secundario: se responde `429` con `Retry-After`, y se
olvida.** Nada de bloqueos que haya que levantar a mano — un bloqueo persistente es un ataque de
denegación de servicio que le regalas a cualquiera.

---

## 4 · Dónde vive el contador

### Las cuatro opciones, y por qué gana la tercera

| | Veredicto |
|---|---|
| **nginx** (`limit_req_zone`) | **Sí, pero como red gruesa.** Corta antes de que Node lea nada, y eso protege la CPU. Pero **no distingue un login fallido de uno correcto**, no sabe de cuentas, y su config es de despliegue. Sirve contra inundaciones, no como control de seguridad |
| **Memoria del proceso** | **No.** Lo descartó el repo en `reenviarMiCodigo` por escrito, y sigue valiendo |
| **PostgreSQL** | **Sí.** Ya está, ya se usa para esto, sobrevive a reinicios y vale con varias instancias |
| **Redis** | **Todavía no.** Es la respuesta correcta a escala, pero hoy no hay Redis en ninguna pila y no hay medición que diga que Postgres no llega |

### Las dos capas, y qué hace cada una

```
Internet
   │
   ├─ nginx   ── red GRUESA: un tope alto por IP contra inundaciones.
   │             Generoso a propósito: por NAT pasa el campus entero.
   │
   └─ Express ── red FINA: por (acción, sujeto), en Postgres, ANTES de bcrypt
                 y ANTES de llamar a webservices.ec.
```

⚠️ **La capa de nginx no es opcional pero tampoco es el control.** Su valor es que un ataque de
volumen no llega a tocar la base — si el contador vive en Postgres, una inundación contra `/login`
convierte cada petición en una consulta. nginx corta eso; Express decide.

### Cuándo tocará Redis, para que la decisión no se tome por costumbre

- Cuando la medición diga que las consultas del limitador pesan.
- **O cuando haga falta el adaptador de Socket.IO** — que hoy no existe, y sin él una segunda
  instancia parte el tiempo real en silencio (ver `app-movil-y-tiempo-real.md` §5).

**Ese segundo motivo es el importante:** el día que Redis entre por el adaptador, mover el limitador
allí es un cambio de una clase. Diseñarlo ahora **detrás de una interfaz** hace que ese día no sea
un refactor.

---

## 5 · El diseño

### 5.1 · La tabla

```sql
-- Un intento que CUENTA para un límite. No es una bitácora general: sólo entra lo que se frena.
CREATE TABLE IF NOT EXISTS intentos_limitados (
  id          bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  -- Qué se intentó: 'login', 'validar_cedula', 'registro'…
  accion      varchar(60)  NOT NULL,
  -- CONTRA QUÉ se cuenta. Su forma la decide la acción (§3): una IP, un correo+ip, un person_id.
  -- ⚠️ Es un texto a propósito: meter aquí una clave ajena ataría el limitador al modelo, y hay
  -- acciones ANÓNIMAS en las que no hay ninguna fila a la que apuntar.
  sujeto      varchar(160) NOT NULL,
  ocurrido_at timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- La consulta del limitador es SIEMPRE (accion, sujeto, ventana). El indice es su forma exacta.
CREATE INDEX IF NOT EXISTS idx_intentos_ventana
  ON intentos_limitados (accion, sujeto, ocurrido_at DESC);
```

⚠️ **Sólo se escribe lo que se frena.** Registrar cada petición doblaría las escrituras del sistema
para no usarlas.

⚠️ **Y en `login` sólo se escriben los FALLOS.** Contar los aciertos castigaría a quien trabaja: en
esta aplicación se entra y se sale muchas veces al día.

**La limpieza es parte del diseño, no un extra:** sin ella la tabla crece para siempre. Se borra
oportunistamente en el mismo camino —una de cada N peticiones borra lo anterior a la ventana más
larga— para no depender de un cron que nadie vigila.

### 5.2 · La interfaz, que es lo que permite mover esto a Redis sin refactor

```js
// backend/services/limites/Limitador.js
export default class Limitador {
  constructor(almacen, reglas) { this.almacen = almacen; this.reglas = reglas; }

  /**
   * @returns {Promise<{permitido: boolean, reintentarEn?: number}>}
   * ⚠️ NO lanza y NO responde HTTP: devuelve un hecho. Quien traduce a 429 es el middleware, y
   *    quien decide si un fallo cuenta es quien conoce el resultado (el controlador de login).
   */
  async comprobar(accion, sujeto) { … }
  async registrar(accion, sujeto) { … }
}
```

```js
// backend/services/limites/AlmacenEnPostgres.js   ← hoy
// backend/services/limites/AlmacenEnRedis.js      ← el día que Redis entre
```

**Dos métodos, no uno.** `comprobar` va antes de trabajar; `registrar` va **después de saber si el
intento falló**. Fundirlos obligaría a contar los aciertos.

### 5.3 · Las reglas, en un solo sitio

```js
export const REGLAS = Object.freeze({
  // Cuesta CPU (bcrypt). El sujeto es correo+ip: ni el vecino de NAT paga, ni se puede
  // bloquear una cuenta ajena.
  login:                  { ventana: "15 min", tope: 10, sujeto: "correo+ip" },
  // ⚠️ Cuesta DINERO DE UN TERCERO. Es el más estricto del sistema, y por eso.
  validar_cedula:         { ventana: "1 min",  tope: 10, sujeto: "ip" },
  validar_whatsapp:       { ventana: "1 min",  tope: 10, sujeto: "ip" },
  // Holgadas: una sala de informática dando de alta a treinta personas es LEGÍTIMO.
  registro:               { ventana: "1 h",    tope: 40, sujeto: "ip" },
  recuperar_correo:       { ventana: "1 h",    tope: 10, sujeto: "ip" },
  reset_password:         { ventana: "1 h",    tope: 10, sujeto: "ip" },
  // Autenticadas: el sujeto es la persona, no dónde está.
  emitir_llave_telefono:  { ventana: "1 h",    tope: 20, sujeto: "person_id" },
  reenviar_codigo_correo: { ventana: "1 min",  tope: 1,  sujeto: "person_id" },
});
```

**Los números son una propuesta y se ajustan midiendo.** Lo que no se ajusta es qué sujeto lleva
cada acción: eso es el diseño.

### 5.4 · Qué pasa si la base no contesta

**No hay una respuesta única, y elegir una sola sería un error:**

- **`login`, `registro`, `reset_password`** → **abrir**. Sin base no funcionan igualmente: el
  limitador no puede ser lo que las rompa.
- **`validar_cedula`, `validar_whatsapp`** → **CERRAR**. Son una comodidad, y detrás hay dinero de
  otro. Sin poder contar, no se llama.

---

## 6 · Lo que `C9` NO arregla, y hay que decirlo

**Un limitador no cura una enumeración: la hace más lenta.**

`/users/validate/cedula/:cedula` y la comprobación de disponibilidad al salir del campo **dicen si
un dato existe**. Con límite, quien quiera la lista tarda más; con paciencia, la obtiene igual.

**El arreglo de verdad es no contestar esa pregunta**: comprobar en el envío del formulario y
responder igual en los dos casos. **Es un defecto aparte, no una tarea de `C9`.**

Y lo mismo con `program_router` y `unit_router` **sin ninguna autenticación**: un limitador hace que
te saqueen despacio.

---

## 7 · Orden propuesto

| | | Por qué |
|---|---|---|
| **1** | El limitador + almacén en Postgres + `validar_cedula` y `validar_whatsapp` | **Es la que gasta dinero de otro** |
| **2** | `login` | Fuerza bruta y CPU, **antes de bcrypt** |
| **3** | Las anónimas que mandan correo, y migrar `reenviarMiCodigo` | Deja **un solo** mecanismo |
| **4** | La capa de nginx | Protege a la base del limitador mismo |

⚠️ **La 1 antes que la 2 puede sorprender.** El razonamiento: la fuerza bruta contra el acceso choca
además con una contraseña, mientras que las de validación **no tienen ninguna defensa** y el daño
ocurre fuera, donde no lo vemos.
