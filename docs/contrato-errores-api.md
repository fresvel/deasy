# Contrato de errores de la API — estado y plan de unificación

> Censo realizado el **16-07-2026** sobre `backend/` (`develop`). Los números salen de analizar todas las
> respuestas `res.status(4xx|5xx).json|send({...})` y extraer sus claves de primer nivel.
> Surge de la fase 2.1 de `plan-refactor-frontend.md`, al descubrir por qué las vistas de auth leían el
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
   como acabaron `--deasy-*` y `--brand-*` en el CSS (ver `plan-refactor-frontend.md` §3.4).
4. **`code` sólo si un cliente necesita ramificar.** Hoy lo usa `login_user.js`; que siga.
5. **Nada de claves ad-hoc en la raíz.** `requires_document_selection`, `context`, `use`, `details`… si
   hacen falta datos, van bajo una clave `data`, no sueltas junto a `message`.

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

## 7. Lo que NO hay que hacer

- **No invertir la precedencia del helper a `error → message`.** Rompería el grupo (b): pasaría a enseñar
  el detalle técnico de la excepción habiendo un texto humano al lado.
- **No migrar `LoginView` a delegar entero en el helper.** Escala por código de estado y para 401/400 el
  texto por estado debe ganar a `error.message` — que axios **siempre** rellena con `"Request failed with
  status code 401"`. Está comentado en el propio fichero.
- **No tocar las 284 respuestas de golpe.** No hay tests de backend que lo cubran, y el valor está
  concentrado: 35 respuestas (fase C) resuelven la ambigüedad de fondo.
- **No añadir una cuarta forma "provisional".** Así se llegó a trece.
