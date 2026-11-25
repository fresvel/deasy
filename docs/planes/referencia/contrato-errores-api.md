# Contrato de errores de la API — estado y plan de unificación

> Censo realizado el **16-07-2026** sobre `backend/` (`develop`). Los números salen de analizar todas las
> respuestas `res.status(4xx|5xx).json|send({...})` y extraer sus claves de primer nivel.
> Surge de la fase 2.1 de `frontend.md`, al descubrir por qué las vistas de auth leían el
> error de cinco maneras distintas.

## 1. El problema, en una frase

**El backend no tiene un contrato de error: tiene trece.** Y el frontend se adaptó a cada uno a mano, en
**113 sitios** repartidos por **30 ficheros**. Nadie "hizo mal" su parte: cada vista lee correctamente lo
que su endpoint le manda. El problema es que los endpoints no se parecen entre sí.

## 2. El censo

**284 respuestas de error, 13 formas distintas:**

| Nº | Forma | Ejemplo |
|---:|---|---|
| **201** | `{ message }` | `controllers/admin/sql_admin_controller.js:22` |
| 24 | `{ error }` | `controllers/sign/sign_controller.js:560` |
| 18 | `{ error, message }` | `controllers/admin/proceso_controler.js:13` |
| 11 | `{ error, ok }` | `controllers/users/reset_password.js:15` |
| 8 | `{ code, message }` | `controllers/users/login_user.js:15` |
| 6 | `{ error, message, success }` | `controllers/whatsapp/whatsapp_controler.js:14` |
| 6 | `{ message, success }` | `controllers/whatsapp/whatsapp_controler.js:46` |
| 4 | `{ message, requires_document_selection }` | `controllers/users/user_controler.js:949` |
| 2 | `{ context, message }` | `controllers/chat/chat_controller.js:195` |
| 1 | `{ details, error, error_name }` | `controllers/sign/sign_controller.js:581` |
| 1 | `{ code, error, use }` | `controllers/sign/sign_controller.js:637` |
| 1 | `{ code, details, message }` | `middlewares/val_password.js:19` |
| 1 | `{ database, message, service, status }` | `index.js:138` |

**`message` ya está en el 71% de las respuestas (201/284).** No hay que inventar un contrato: hay que
terminar el que ya ganó.

### Remedición del 2026-08-14 — **306 respuestas, 16 formas**

**La tabla de arriba NO se toca: es la línea base de julio**, y pisarla tira la serie histórica (mismo
criterio que `sonar.projectVersion`). Lo que sigue es el estado de hoy, medido con el mismo método
—emparejando paréntesis, así que coge también las respuestas multilínea— sobre `develop`:

| | 16-07-2026 | 2026-08-14 |
|---|---:|---:|
| Respuestas de error | 284 | **306** |
| Formas distintas | 13 | **16** |
| Cuota de `{ message }` | 201 (71 %) | **219 (71,6 %)** |

**Tres formas nuevas** en un mes, y ninguna hacía falta: `{ details, message }` (2, `chat_controller.js`),
`{ message, ok }` (2, `bootstrap_controller.js`) y `{ …spread, message, success }` (1, el `fail` local de
`dossier_controler.js:123`). Es exactamente lo que avisa el §7 —«no añadir una cuarta forma
provisional»— ocurriendo tres veces mientras nadie miraba.

> **Esta es la única cifra viva del contrato de errores, y no se replica** (regla 4 de
> [`../CLAUDE.md`](../CLAUDE.md)). El plan maestro decía **309 / 15** y **no se reproduce con ningún
> criterio de inclusión razonable**; desde el 2026-08-14 enlaza aquí en vez de repetirla.

## 3. Lo que hace peligrosa la divergencia

`error` significa **dos cosas opuestas** según quién responda:

```js
// (a) error = MENSAJE HUMANO — cuando no hay `message`
res.status(400).json({ error: "Se requiere el archivo PDF." });          // sign_controller.js:560
res.status(400).json({ ok: false, error: "Email requerido" });           // reset_password.js:15

// (b) error = DETALLE TÉCNICO — cuando sí hay `message`
res.status(400).send({                                                    // proceso_controler.js:13
  message: "Error al crear el proceso",
  error: error.message                    // <- de la excepción; no es para el usuario
});
```

Consecuencia directa, y no hipotética: un cliente que lea `.error` primero **muestra el detalle técnico de
la excepción al usuario** en los endpoints del grupo (b). Y uno que lea sólo `.message` **no muestra nada
útil** en los del grupo (a), porque ahí `message` no existe.

Eso explica por qué `VerifyEmail.vue` y `RecoverPasswordView.vue` leían `.error` antes que `.message`:
sus endpoints son del grupo (a). **No estaban mal escritas.**

**Nota tranquilizadora**: no hay ni un solo caso de `error: error` (el objeto de excepción crudo). Siempre
es `error.message`, una cadena. La fuga es de texto técnico, no de stacks estructurados.

## 4. El contrato objetivo

```jsonc
// Toda respuesta de error, 4xx y 5xx:
{
  "message": "Texto en español, dirigido a la persona que usa el sistema.",
  "code": "OPCIONAL. Identificador estable para que el cliente ramifique sin parsear texto."
}
```

Reglas:

1. **`message` es obligatorio y es para humanos.** Si no se puede decir nada útil, un genérico decente
   ("No se pudo completar la operación"), nunca el texto de la excepción.
2. **El detalle técnico no viaja.** Va a `console.error` en el servidor, donde ya va hoy. Mandarlo al
   cliente no ayuda a quien lo lee y expone interioridades.
3. **`ok` y `success` sobran.** El código HTTP ya dice si falló. Dos fuentes de verdad para lo mismo es
   como acabaron `--deasy-*` y `--brand-*` en el CSS (ver `frontend.md` §3.4).
4. **`code` sólo si un cliente necesita ramificar** — y hoy **ninguno lo necesita**. Ver §4.1.
5. **Nada de claves ad-hoc en la raíz.** `requires_document_selection`, `context`, `use`, `details`… si
   hacen falta datos, van bajo una clave `data`, no sueltas junto a `message`.

### 4.1 · Qué es `code`, qué NO es, y por qué sigue aquí sin que lo lea nadie

> Reescrito el **2026-08-14** al ejecutar el defecto 1.8. La versión anterior de la regla 4 decía
> *«Hoy lo usa `login_user.js`; que siga»* — y **bendecía como ejemplo el peor de los diez emisores**.

**Para qué sirve.** El status HTTP da la *familia* del fallo; `code` distingue **situaciones distintas
dentro del mismo status**, para que el cliente ramifique **sin comparar texto en español** (frágil: cambia
al reescribir el mensaje, y no se puede traducir). El caso existe en este repo: `FillRequestWorkflowService`
responde **409 en tres guards distintos** —«sin responsable resoluble», «transición ilegal» y «falta el
PDF» (defecto 1.2)— con remedios distintos y **hoy indistinguibles salvo por la cadena**.

**Qué es, entonces:** un **string estable en `SCREAMING_SNAKE`**, propio del dominio, que sobrevive a
cualquier reescritura del mensaje. El único bien puesto del backend es
`"SIGN_BATCH_LEGACY_GONE"` (`controllers/sign/sign_controller.js:132`).

**Qué NO es, y esto es lo que había que escribir:**

- ❌ **No es el status HTTP repetido.** `code: 400` / `code: 401` es el mismo dato dos veces y no permite
  ramificar nada. **8 de los 10 emisores hacen exactamente eso** (`login_user.js:15,30`, `refresh_token.js`
  ×4, `logout_user.js:21`, `val_password.js` ×2). Son **deuda del frente 7**, no el ejemplo a seguir.
- ❌ **No es el `.code` del error subyacente.** `middlewares/uploadError.js:43` hace
  `error?.code || "UPLOAD_REJECTED"`: para multer da `LIMIT_FILE_SIZE`… (correcto), pero si el error
  viniera de `fs` colaría un `ENOENT` y de `pg` un SQLSTATE. Es una fuga, no un catálogo.

**No hay catálogo.** `grep -rniE "ERROR_CODES|errorCodes"` sobre `backend/` da **cero**. Y **`HttpError` no
tiene campo `code`**, así que las excepciones de negocio **no pueden producirlo** sin tocar la clase.

**Por qué no se retira del contrato, habiéndose medido que no lo lee nadie** (cero lectores en
`frontend/src`, `signer/` y `scripts/`: la única coincidencia de `data?.code` es `edge.data?.code` de
`UnitGraphView.vue:1206`, un tipo de relación del organigrama): porque **`middlewares/uploadError.js` es la
única implementación conforme del backend** y emite `{ message, code }`, con **tres goldens que congelan
`claves: ["code","message"]`** (`dossier.json:8`, `user_workspace.json:31`, `sign_batch.json:113`).
Retirarlo dejaría **no conforme al único que lo hace bien** y movería tres goldens por un cambio
documental. Sigue siendo **opcional**, y la regla práctica es: **no lo pongas** salvo que exista un
cliente que ramifique por él.

## 5. Por qué se puede migrar sin romper nada (y por qué ahora)

La fase 2.1 dejó el amortiguador puesto: **`frontend/src/shared/utils/apiError.js`**.

```js
resolveApiErrorMessage(error, fallback)   // precedencia: data.message -> data.error -> error.message -> fallback
```

Esa precedencia es correcta **para las dos familias a la vez**, y no por suerte:

- Grupo (a) `{ error: "humano" }` → no hay `message` → cae a `error` → **texto correcto**.
- Grupo (b) `{ message: "humano", error: "técnico" }` → gana `message` → **el detalle técnico se ignora**.

Es decir: **el cliente ya tolera las dos formas**, así que el backend puede converger endpoint a endpoint
sin coordinar despliegues ni romper pantallas. Ese es justo el momento de hacerlo.

## 6. Plan de migración

| Fase | Acción | Rompe algo | Nota |
|---|---|---|---|
| **A** | Amortiguador en el cliente: `resolveApiErrorMessage` | No | ✅ **hecho** (fase 2.1). Usado en las 5 vistas de auth |
| **B** | Migrar los **113 sitios** del frontend que aún leen el error a mano al helper | No | Mecánico. Empezar por los módulos con más sitios |
| **C** | Añadir `message` a las **35 respuestas** que hoy sólo mandan `error` (formas `{error}` y `{error, ok}`) | No | Aditivo: los clientes viejos siguen leyendo `.error`, el helper ya prefiere `.message` |
| **D** | Dejar de mandar el detalle técnico: quitar `error` de las 18 respuestas `{error, message}` | No | El texto útil ya viaja en `message`; el técnico sigue en los logs |
| **E** | Quitar `error` de las 35 de la fase C, ya redundante | **Sí**, si queda algún cliente leyendo `.error` | Sólo tras B. El helper ya no lo necesitaría |
| **F** | Quitar `ok`/`success` (23 respuestas) | **Sí**, si algún cliente los comprueba | Auditar primero `grep -rn "\.ok\b\|\.success" frontend/src` |
| **G** | Normalizar las claves sueltas bajo `data` | **Sí** | Las de menos uso; una a una |

**B → C → D son las tres útiles y ninguna rompe nada.** E, F y G son limpieza y exigen auditar clientes
antes.

Un helper de servidor haría la fase C trivial y evitaría la recaída — el patrón ya existe en el repo, en
`dossier_controler.js:123`:

```js
const fail = (res, status, message, error) =>
  res.status(status).json({ success: false, message, ...(error ? { error } : {}) });
```

Convendría uno equivalente, compartido, que **no** exponga el detalle técnico:

```js
// p. ej. backend/utils/httpError.js
export const fail = (res, status, message, { code, cause } = {}) => {
  if (cause) console.error(`[${status}] ${message}`, cause);   // el detalle se queda en el servidor
  return res.status(status).json({ message, ...(code ? { code } : {}) });
};
```

> **Ese helper es la puerta de entrada del frente 7, y ahí se queda** (anotado el 2026-08-14 al
> ejecutar el defecto 1.8). Se evaluó crearlo entonces y **se descartó**: `backend/utils/httpError.js`
> **no existe**, y crearlo sin migrar ni un controller añade **un decimoséptimo productor de forma sin
> un solo consumidor** — justo el olor que este documento persigue. Nace **con** la fase C, no antes.
>
> Dato estructural que conviene tener delante antes de empezar esa fase, verificado el 2026-08-14
> leyendo `backend/index.js` entero y los routers: **no hay error handler central**. Ni un
> `app.use((err, req, res, next))` en toda la app. El único middleware de aridad 4 es
> `handleUploadError`, y es **de ámbito de router** (montado en 4). No existe ningún punto donde
> normalizar la forma de un golpe: o se tocan los sitios uno a uno, o primero hay que crear ese
> handler.

## 7. Lo que NO hay que hacer

- **No invertir la precedencia del helper a `error → message`.** Rompería el grupo (b): pasaría a enseñar
  el detalle técnico de la excepción habiendo un texto humano al lado.
- **No migrar `LoginView` a delegar entero en el helper.** Escala por código de estado y para 401/400 el
  texto por estado debe ganar a `error.message` — que axios **siempre** rellena con `"Request failed with
  status code 401"`. Está comentado en el propio fichero.
- **No tocar las 284 respuestas de golpe.** No hay tests de backend que lo cubran, y el valor está
  concentrado: 35 respuestas (fase C) resuelven la ambigüedad de fondo.
- **No añadir una cuarta forma "provisional".** Así se llegó a trece.
