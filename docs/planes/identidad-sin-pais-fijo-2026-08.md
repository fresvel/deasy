# La identidad sin país fijo — Institución, tipos por CHECK y login sólo correo

> **Qué es.** El modelo de identidad asume Ecuador en sitios donde no debería: un tipo de documento
> llamado `cedula_ec`, un validador colgado del tipo, y un login que entra por número de documento.
> Este frente lo saca, para que el mismo código sirva en cualquier país sin tocar una línea.
>
> **De dónde sale.** De la auditoría del login del 2026-08-28: `findByCedulaOrEmail` resuelve
> `d.numero = ?` **a secas**, cuando la unicidad del documento es `(tipo, país, número)`. El número
> solo **no es único**, así que la consulta puede emparejar a la persona equivocada.
>
> **Quién decide.** El dueño, tarea a tarea. Nada se implementa sin su aprobación.

---

## §0 · Control de ejecución

| Tarea | Qué entrega | Estado | Evidencia | Fecha |
|---|---|:--:|---|---|
| **I1** | `instituciones` existe con su país, y el bootstrap la siembra | ✅ | Fila sembrada (`Institución` · EC · Ecuador) tras un reset limpio; aparece sola en `/admin/institucion/unidades-y-cargos/instituciones` sin escribir pantalla, con el país como combobox que ya ofrece «Perú»; 5 tests y su mutación cazada | 2026-08-29 |
| **I2** | El validador y el nombre local del documento se resuelven **por país**, no por tipo | ✅ | **Probado moviendo la institución a Perú sin tocar código**: el número `12345678` que Ecuador rechaza («tiene exactamente 10 dígitos») queda aceptado y guardado con `pais=PE`. 8 tests del registro + 2 del servicio; 2 mutaciones cazadas | 2026-08-29 |
| **I3** | `documentos_identidad.tipo` es un `CHECK` de tres; `tipos_documento` desaparece | ✅ | **La pantalla de registro entera sigue al país**: con la institución en Perú dice «Documento (Perú)» y el número pasa de `maxlength` 10 a 20; con Ecuador, «Cédula (Ecuador)». El admin pierde la pestaña de tipos (8→7) y el «Pais emisor» sólo aparece si el tipo no es el nacional. 77 tablas, las mismas: entró `instituciones`, salió `tipos_documento` | 2026-08-29 |
| **I4** | `documentos_identidad.pais_id` es obligatorio y el índice pierde el `COALESCE` | ✅ | Índice `(tipo, pais_id, numero)` sin el cero inventado; alta de un documento nacional **sin país desde /admin** que lo hereda de la institución, y pasaporte sin país que responde «Falta «Pais emisor».» en vez del mensaje crudo. 2 goldens nuevos, 2 mutaciones del esquema cazadas | 2026-08-29 |
| **I5** | Las rutas de foto y escaneo entran por `:personId`, no por `:cedula` | ✅ | Foto subida por `PUT /users/2/photo` y guardada en `users/**2**/profile/…`; el frontend la pide por id y el avatar renderiza. Guard nuevo `requirePersonAccess`: ajeno 403, cédula 403, propio 404. 3 goldens de acceso, y abrir el guard cae por dos | 2026-08-29 |
| **I6** | 💥 El login **sólo acepta correo**. Cambian las credenciales de referencia | ✅ | Entrada por `admin@institucion.edu.ec` verificada en pantalla, y la cédula la para el propio navegador (`type="email"`). `findByCedulaOrEmail` pasa a `findByEmail`; `buscarPersonaPorNumero` borrada por muerta. Golden nuevo que fija que la cédula NO es credencial, y devolver la rama lo hace caer | 2026-08-29 |
| **I7** | La búsqueda por documento sale de `UserRepository`: con ella, la colisión | ✅ | **El mismo commit que `I6`** — no es una copia de su evidencia: al medirlo resultaron ser el mismo cambio (ver el aviso del grafo). `findByCedulaOrEmail` pasa a `findByEmail` y pierde la rama del documento; `buscarPersonaPorNumero` se borra por muerta | 2026-08-29 |
| **I9** | Las OTRAS cinco búsquedas por número de documento dejan de ignorar su ámbito | ✅ | **Colisión creada en vivo** (dos personas con el número `1122334459`): `GET /tarea?usuario=…` pasa de **200 con las tareas de una de ellas** a **409 diciéndolo**, y el expediente de **404 «no encontrado»** a **409**. 7 tests del resolutor + golden que fabrica la colisión y la retira; 2 mutaciones cazadas | 2026-08-29 |
| **I8** | Recuperación «olvidé mi correo» por documento + país | ✅ | `/recover-email` verificado en pantalla: con la contraseña devuelve el correo completo; con la contraseña mala y con un documento inexistente da **el mismo error** — y la misma latencia (67 ms contra 70 ms). 6 tests + 3 goldens | 2026-08-29 |
| **I10** | Verificar el teléfono y recuperar el acceso de quien olvidó **las dos** cosas | ⛔ | **DEUDA TÉCNICA, analizada entera el 2026-08-29.** La dirección la fijó el dueño —la app propia como dispositivo vinculado en el registro, validando el número por Telegram— y **depende de una app que todavía no existe**. Antes hace falta el limitador de intentos, que no hay. Todo lo medido está en su ficha | |

**10 tareas.** `I10` nace del análisis de `I8` y es un frente pequeño en sí misma.

💥 marca **la única tarea que rompe algo de cara al usuario**. Está aislada a propósito: se puede
aprobar, ejecutar y revertir sola.

### El orden no es negociable

```
I1 ─┬─> I3 ──> I4
    └─> I2
I5 ──> I6+I7       (son el MISMO cambio, ver abajo)
I9                 (independiente de todo — no toca el login)
```

- **`I3` necesita `I1`**: el bootstrap tiene que saber de qué país es la institución para componer
  el nombre y elegir el validador de la fila nacional.
- **`I6` e `I7` necesitan `I5`**: `findByCedulaOrEmail` tenía **cuatro** llamadores. Borrar su rama
  de documento antes de migrar las rutas dejaba sin foto y sin escaneo a todo el mundo.

⚠️ **`I6` e `I7` son el MISMO commit, y esta tabla decía lo contrario.** Escrito el 2026-08-28, el
grafo ponía `I6` como independiente y `I7` colgando sólo de `I5`. Al llegar a ejecutarlas se midió:
después de `I5`, a `findByCedulaOrEmail` le queda **exactamente un llamador — el login**. Quitarle la
rama del documento *es* cambiar el login a sólo correo. No hay forma de hacer `I7` sin tocar las
credenciales, y se llegó a ofrecer como si la hubiera.

**Es el precedente que justifica la regla de este repositorio:** el grafo se lee, pero se MIDE antes
de ejecutar.

---

## 1 · Lo que está mal hoy, medido

### 1.1 · La consulta ignora el ámbito que hace único al documento

```js
// UserRepository.findByCedulaOrEmail
"EXISTS (SELECT 1 FROM documentos_identidad d WHERE d.person_id = p.id AND d.numero = ?)"
```

El índice es `uq_documentos_numero (tipo_id, COALESCE(pais_id, 0), numero)`. **El número solo no es
único**: dos pasaportes de países distintos con el mismo número son legales en el modelo. Hoy no hay
colisiones en dev — es latente, no visible, y es autenticación.

### 1.2 · Ecuador está escrito en el código

`cedula_ec` aparece **23 veces en 9 ficheros**, y no como dato: como *tipo*. El validador del dígito
verificador cuelga de `tipos_documento.validacion`, así que el día que esto se despliegue en Perú, el
tipo nacional sigue llamándose «cédula» y validando como ecuatoriana.

### 1.3 · `documentos_identidad` es la excepción de su propio grupo

Las tres tablas hermanas resuelven su vocabulario con un `CHECK`:

```sql
emails       tipo TEXT NOT NULL CHECK (tipo IN ('personal','institucional'))
direcciones  tipo TEXT NOT NULL CHECK (tipo IN ('residencia','trabajo'))
telefonos    tipo TEXT NOT NULL CHECK (tipo IN ('personal','trabajo'))
```

`documentos_identidad` es **la única con clave ajena a un catálogo de tres filas**. El criterio del
repositorio está claro: vocabulario cerrado sobre el que el código se ramifica → `CHECK`; catálogo
que crece y alguien administra → tabla. Tres tipos fijos son lo primero, y **un cuarto valor no debe
poder crearse**: el código no sabría qué hacer con él.

### 1.4 · El `:cedula` de la URL ya no significa eso

**28 rutas** llevan `:cedula`. El valor que resuelven es *el número del documento principal*, sea
cédula o pasaporte. Consecuencia que nadie ha visto todavía: **un pasaporte cambia de número al
renovarse**, y con él cambiaría la URL de la foto de esa persona.

### 1.5 · El front y el back normalizan distinto

| | `AB123456` acaba como |
|---|---|
| `AuthService.js:20` (front) | `123456` — `\D` borra todo lo que no sea dígito |
| `UserRepository.js:100` (back) | `AB123456` |

**El login por pasaporte ya está roto desde la pantalla.** No se ha notado porque los 43 documentos
sembrados son cédulas. `I6` lo borra de raíz.

---

## 2 · El diseño

### 2.1 · Cuatro preguntas, cuatro dueños

El error de la primera propuesta fue colgar del **tipo** cosas que dependen del **país**:

| Pregunta | ¿De qué depende? | Dónde vive |
|---|---|---|
| ¿Qué **clase** de documento es? | De nada — son tres | `CHECK` de tres valores |
| ¿**Quién** lo emitió? | De cada documento | `documentos_identidad.pais_id` |
| ¿Cómo se **valida** el número? | Del **país** | Registro **en código** |
| ¿Cómo se **llama** aquí? | Del **país** | El mismo registro |

**Por qué el validador va en código y no en una fila:** ya lo está, sólo que disimulado.
`tipos_documento.validacion` no guarda un algoritmo — guarda una **llave** a
`DocumentoIdentidadService.VALIDADORES`. Un algoritmo no cabe en una fila. La pregunta nunca fue
«dónde guardo el validador» sino «por qué lo busco por tipo si depende del país».

### 2.2 · El registro por país

```js
const POR_PAIS = {
  EC: { nombre: "Cédula", validador: cedulaEcuatoriana },
  // PE: { nombre: "DNI", validador: dniPeruano },   ← el día que haga falta
};
```

**Tiene tantas entradas como países para los que de verdad haya una regla. Hoy: una.** Los otros 231
caen al genérico alfanumérico. Ahí está la respuesta a «¿no genera duplicidad?»: no hay fila por
país, hay regla por país, y sólo donde existe.

**El pasaporte es siempre alfanumérico**, mande el país lo que mande: los formatos de pasaporte no
tienen dígito verificador público — los que hay viven en la MRZ, no en el número.

### 2.3 · «Cédula (Ecuador)» se compone, no se guarda

`POR_PAIS[EC].nombre` + el nombre del país. En un despliegue peruano la misma pantalla dice
«DNI (Perú)» sin tocar ni una fila ni una línea.

### 2.4 · El país del documento nacional no se pregunta, pero se guarda

Viene precargado de `instituciones.pais_id`. Se **guarda igual** en la instancia: es lo que mantiene
el modelo uniforme y lo que permite que el índice sea `(tipo, pais_id, numero)` sin el truco del
`COALESCE(pais_id, 0)`.

En el formulario del admin lo resuelve el `showWhen` que ya existe: el país se pregunta cuando el
tipo elegido no lo trae implícito.

### 2.5 · El login no toca documentos

Sólo correo. **43 de 43 personas tienen correo**, así que nadie se queda fuera. Y desaparece la
pregunta de la unicidad del documento en el camino de autenticación, en vez de acotarla.

---

## 3 · Las tareas

### I1 · `instituciones`

La tabla y su fila única, sembrada por el bootstrap. Empieza con lo mínimo que este frente necesita
—nombre y país— pero es la entidad que faltaba: no hay **ninguna** tabla de configuración del sistema
en el esquema (comprobado el 2026-08-28), y el membrete de los documentos generados va a pedirla.

⚠️ **No inventar campos «por si acaso».** Nombre y país. Lo demás, cuando algo lo necesite.

**Lo que se decidió al construirla (2026-08-29):**

- **Sin restricción de fila única.** Un `CHECK` de singleton habría que quitarlo el día del
  multi-inquilino, y este esquema **no tiene ni un `ALTER`**, así que quitarlo no sería gratis.
  Quien resuelve «cuál es la mía» es `InstitucionService.actual()`, que **falla si hay cero o más de
  una** en vez de elegir en silencio — elegir «la primera» ante dos daría un país equivocado y con
  él un validador equivocado, sin que nadie entendiera por qué se rechaza un número. Ese método es
  la costura por la que entraría la resolución del inquilino.
- **El país por defecto es Ecuador, y eso NO es lo que se acaba de quitar.** Antes Ecuador estaba en
  una **rama del programa** (un tipo llamado `cedula_ec`); ahora es el **valor inicial de una fila**
  que se edita en `/admin`. Un despliegue peruano cambia esa fila y lo demás le sigue.
- **Va después de `paises` en el esquema**, no donde la puse primero: la clave ajena lo exige y
  PostgreSQL lo rechaza de plano.

### I2 · El registro por país

`POR_PAIS` sustituye a `VALIDADORES` como punto de entrada. El validador de la cédula ecuatoriana
**no se toca ni se tira**: pasa a ser la entrada `EC`.

Se puede hacer sin `I3`: mientras `tipos_documento` siga existiendo, el servicio resuelve por país y
deja de mirar la columna `validacion`.

**Lo hecho (2026-08-29):**

- `documentosPorPais.js` — el registro. `validadorPara({ tipoCode, paisIso })` y `nombreLocal(iso)`.
- **El orden cambió y era necesario:** el país se resuelve **antes** de validar. No se puede saber si
  un número está bien formado sin saber de qué país es; antes se validaba primero porque el validador
  colgaba del tipo. Ningún golden se movió, así que no cambió ningún contrato observable.
- **El `SELECT ... WHERE iso_alpha2 = 'EC'` escrito a mano desapareció**: el país del documento
  nacional sale de `InstitucionService.paisActual()`.
- `TIPO_NACIONAL` queda como constante en un solo sitio, para que `I3` sólo tenga que tocar ahí.

⚠️ **El falso de las pruebas de `DocumentoIdentidadService` iba POR ORDEN de llamada** —un array y un
contador—, así que cualquier consulta nueva del servicio lo descolocaba aunque no tuviera nada que ver
con lo que la prueba comprueba: dos pruebas de FORMATO empezaron a fallar quejándose de la institución.
Se reescribió para responder **por contenido de la consulta**. Un falso que se rompe por donde la
prueba no mira no protege: estorba.

### I3 · El `CHECK` 💣 la tabla

`documentos_identidad.tipo TEXT NOT NULL CHECK (tipo IN ('documento_nacional','documento_extranjero','pasaporte'))`,
y `tipos_documento` se borra. Es la única tabla que la referencia (comprobado contra el catálogo).

**22 usos en 6 ficheros:**

| Fichero | Usos |
|---|:--:|
| `postgres_schema.sql` | 7 |
| `DocumentoIdentidadService.js` | 6 |
| `UserRepository.js` | 3 |
| `sqlTables.js` | 3 |
| `AdminTableManagerConfig.js` | 3 |
| `genericCatalog.js` | 2 |

**Lo hecho (2026-08-29):**

- **Un endpoint público nuevo**, `GET /system/institucion`, sin autenticar como el catálogo
  geográfico: lo consume el REGISTRO, que por definición usa quien todavía no tiene cuenta. Sin él,
  la pantalla tendría que saberse el país — llevaba «Cédula (Ecuador)» escrito en una lista.
- **La validación en cliente es AYUDA, no autoridad.** El algoritmo de la cédula ecuatoriana sigue
  en `RegisterView` pero sólo se aplica si el despliegue es ecuatoriano. En otro país el usuario
  recibe la comprobación genérica mientras escribe y el mensaje exacto del servidor al enviar — que
  es preferible a aplicarle el dígito verificador de otro país y rechazarle un documento válido.
- `resolveTipo` era una CONSULTA; ahora validar el tipo es comparar contra tres cadenas.

⚠️ **Se estrenó el endpoint devolviendo 500 con las 303 pruebas en verde**, porque ninguna lo
miraba: `InstitucionService` no tenía pool por defecto. Tiene su golden desde entonces. Estrenar una
ruta sin prueba es estrenarla sin red.

Se lleva por delante, gratis:

- `resolveTipo` entero, y su consulta;
- el `JOIN` a `tipos_documento` en las tres lecturas de `UserRepository`;
- **la ambigüedad de `tipo_id`** en `FK_TABLE_MAP`, marcada al añadirla porque es un nombre genérico
  que otra tabla podría estrenar;
- una pestaña en Usuarios (de 8 a 7).

### I4 · `pais_id` obligatorio

`NOT NULL` en la instancia, e índice `(tipo, pais_id, numero)`.

✅ **Decidido por el dueño el 2026-08-29: no hay producción, así que se recrea la base y no se usa
`ALTER`.** El esquema sigue siendo `CREATE ... IF NOT EXISTS` de principio a fin.

**Lo que apareció al hacerla, y no estaba previsto.** `pais_id` es obligatorio en la base pero el
formulario **no lo pregunta** para el documento nacional (`showWhen`), y el CRUD del admin escribe
**directo a la tabla**: marcarlo `required` hacía imposible dar de alta un documento nacional, y no
marcarlo lo mataba con un `NOT NULL` crudo. Se resolvió en dos piezas, ninguna en el formulario:

- **`trg_documentos_pais_nacional`** rellena el país del nacional desde `instituciones`. Va en la
  base y no en un hook por lo mismo que `trg_principal_unico_fn`: es un invariante del dato. Y va
  `BEFORE` porque PostgreSQL evalúa el `NOT NULL` sobre la fila **ya modificada** por los triggers.
- **`sqlErrors.js` traduce el `23502`**: «Falta «Pais emisor».» en vez de
  `null value in column "pais_id" of relation "documentos_identidad"…`. No es un lujo — cuando un
  campo lo rellena un trigger, la base es el **único** que sabe si de verdad falta, porque lo
  comprueba después.

⚠️ **La fixture de índice de expresión de `sqlErrors.test.js` quedó HISTÓRICA**: se capturó de
verdad, pero de este índice, que ya no lleva `COALESCE`. Hoy el esquema no tiene **ninguno**
(comprobado: cero). Se conserva etiquetada como tal, porque borrarla dejaría ese camino del parser
sin una sola prueba esperando al día que alguien vuelva a declarar uno.

### I5 · `:cedula` → `:personId`

Las de foto y escaneo primero, que son las tres que bloquean `I7`:

```
GET|PUT /users/:cedula/photo
GET|PUT /users/:cedula/documento/escaneo
```

Con un guard nuevo, **`requirePersonAccess`**, que compara **como número**: `"7"` y `7` son la misma
persona, y una comparación de cadenas los habría dado por distintos — dejando al dueño fuera de su
propia foto.

**Y la clave del objeto en MinIO también.** La foto se guardaba en `users/{cédula}/profile/…`, atada
a un dato que cambia; ahora es `users/{personId}/…`, que es el criterio que el escaneo ya seguía.

**Lo que NO se migra, y por qué.** Quedan **24** rutas con `:cedula`: **22 del expediente**, que son
un frente propio y se anotan sin arrastrarse, y **una que se queda para siempre** —
`GET /users/validate/cedula/:cedula`, que no identifica a nadie: valida **un número** contra el
registro civil. Ahí el parámetro *es* el dato.

⚠️ **Las cuatro rutas se migraron con las 306 pruebas EN VERDE**: ningún golden las tocaba. Los tres
casos nuevos fijan el **contrato de acceso**, que es la parte que duele — el escaneo de un documento
de identidad no lo puede leer un compañero cualquiera.

### I6 · 💥 El login sólo correo

**Lo que cambia de cara al usuario, y es lo que hay que mirar antes de aprobar:**

| | Antes | Después |
|---|---|---|
| admin | `1234567897` | `admin@institucion.edu.ec` |
| gestor | `0927654327` | `gestor@institucion.edu.ec` |
| usuario | `1122334459` | `usuario@institucion.edu.ec` |

Las contraseñas no cambian. Hay que tocar, y son pocos sitios porque todo pasa por un helper:

- `LoginView.vue` — la etiqueta y el marcador de posición;
- `AuthService.js:15-21` — se acaba el `includes("@")` y el `\D`;
- `backend/services/auth/AuthService.js:20` — deja de aceptar `cedula`;
- `tests/characterization/config.mjs` — los tres `identifier`;
- `tests/characterization/lib/auth.mjs:17` — `{ cedula: … }` pasa a `{ email: … }`. **Es una línea
  para las 209 llamadas**;
- `CLAUDE.md` de la raíz — las credenciales de referencia.

⚠️ El registro **sigue pidiendo el documento**: es un atributo legal de la persona, no una llave.
Lo que deja de existir es entrar con él.

### I7 · Fuera la búsqueda por documento

Con `I5` hecha, `findByCedulaOrEmail` se queda con un solo llamador y un solo criterio.
Pasa a `findByEmail`, y **la colisión del §1.1 desaparece porque desaparece la consulta**.

### I9 · Las otras cinco búsquedas por número

**Aparecieron al medir `I7`, no estaban en ninguna ficha**, y todas tienen el defecto del §1.1 —
`d.numero = ?` a secas, sin el ámbito que hace único al documento:

| Dónde | Para qué resuelve la persona |
|---|---|
| `dossierStore.js:63` | El **expediente** |
| `tareas_controler.js:14` | Las **tareas** |
| `templateLifecycle.js:1102` | Las **plantillas** |
| `genericCatalog.js:352` · `SystemBootstrapService.js:808` | La siembra |

Sacar la del login (`I6`+`I7`) **no arregla éstas**: sólo quita el defecto del camino de
autenticación, que es donde más duele. Aquí el daño es otro —resolver la persona equivocada al
abrir un expediente o una tarea— y no es menor.

**Es independiente de `I6`** y no toca el login: se puede hacer en cualquier momento.

**Lo hecho (2026-08-29).** No son un arreglo sino dos, porque las cinco no son lo mismo:

**Las tres de tiempo de ejecución** reciben el número **de fuera** —una URL, un formulario— sin su
tipo ni su país. Acotarlas a `documento_nacional` las haría únicas, sí, pero **dejaría inalcanzable a
todo extranjero que sólo tenga pasaporte**: acotar ahí es cambiar quién existe para esas pantallas.
Se resuelven con `resolverPersonaPorNumero`, que mira si hay **más de una** y **se niega** si la hay.
Un `LIMIT 2` cuesta lo mismo que un `LIMIT 1` y convierte «acierta mal en silencio» en «no acierta y
lo dice».

**Las dos de siembra** sí se acotan, y ahí es exacto: el seed **crea** un documento nacional, así que
buscarlo entre otros tipos era buscar donde nunca escribió.

**El expediente también dice la verdad**, y no costó lo que dije que costaría. La primera versión de
esta ficha afirmaba que distinguir «ambiguo» de «no encontrado» «obliga a propagar por los
controladores, que es el frente de las 22 rutas». **Era falso, y por no medir**: son **siete**
llamadores en **un** fichero, y ni siquiera hizo falta tocarlos.

Las 22 rutas comparten el parámetro, así que el sitio es **`router.param('cedula')`** — corre una vez
por cada ruta que lo use. Se pronuncia **sólo sobre la ambigüedad** (409); que el documento no exista
lo siguen resolviendo los controladores, con sus mensajes, que son más específicos.

⚠️ Deja `req.personId` puesto pero **hoy nadie lo usa**: los controladores vuelven a resolver por su
cuenta, así que hay **una consulta de más por petición**. Se acepta a sabiendas — quitarla es migrar
estas rutas a `:personId`, y cuando eso ocurra este `router.param` desaparece entero.

⚠️ Y **`DocumentoIdentidadService.buscarPersonaPorNumero` no la llama nadie** (comprobado el
2026-08-29). Se borra con `I6`+`I7`, que es donde caen sus vecinas.

### I10 · ⛔ Verificar el teléfono y recuperar sin correo ni contraseña — DEUDA TÉCNICA

**Parada a propósito, no olvidada.** Se analizó entera el 2026-08-29 y se detuvo en la decisión que
la ordena. Lo de aquí abajo es para que **nadie tenga que volver a medirlo**.

#### Qué resuelve

El hueco que `I8` deja abierto: quien olvidó **el correo Y la contraseña** no tiene camino
automático, porque el reset de contraseña también empieza pidiendo el correo. Y de paso, `F4d` del
otro plan: `verificado` y `verificado_at` existen en `emails`, `telefonos` y `documentos_identidad`
**y ningún flujo los pone** — `marcarVerificado` sólo lo llama el bootstrap.

#### Lo que YA está construido y sólo espera configuración

**Verificar el CORREO cuesta cero.** `sendEmailVerification.js` existe y está cableado
(`user_controler.js:104`), como el reset de contraseña. Lo único que falta es que
**`SMTP_*` esté en el entorno** — no está ni en `.env.dev` ni en `.env_model`. Esto se puede hacer
sin ninguna decisión comercial y cubre media `F4d`.

#### El diseño al que se llegó

Tres capas. La 1 está hecha; la 2 es esta tarea; la 3 es el residuo.

| | Qué pide | Para quién |
|---|---|---|
| **1 · hecha (`I8`)** | documento + **contraseña** → el correo | cualquiera |
| **2 · esta tarea** | documento + país + **teléfono** → código → correo y reinicio de clave | cualquiera |
| **3 · el residuo** | una **persona** verifica y resuelve | quien cambió de teléfono |

**La capa 2 no pide ni un dato nuevo**: el registro ya guarda dirección, teléfono, correo y documento
(los cuatro por `guardarPrincipal`, ver `UserRepository.create`). El teléfono se declara **en el
alta**, antes de que exista ningún ataque, que es lo que le da valor como segundo factor.

⚠️ Pero está **declarado, no verificado**. Por eso `F4d` deja de ser una tarea sin dueño: verificarlo
en el alta convierte la capa 2 de «posesión de un canal declarado» en «posesión de un canal probado».

#### Lo que se descartó, con su razón

- **Foto por cámara.** Un `getUserMedia` se engaña con una cámara virtual y una foto de redes
  sociales sirve de fuente. Da sensación de rigor sin darlo.
- **Custodiar el escaneo del documento.** Guardar documentos de identidad y caras —de gente que puede
  que ni sea usuaria— para devolver una dirección de correo es desproporcionado, y cae bajo la
  **LOPDP** (régimen sancionador vigente desde 2023). Crea un riesgo mayor que el que resuelve.
- **Preguntas de seguridad.** Los hechos que el sistema sabe de un interno —cargo, unidad, jefe—
  **los ve cualquiera con sesión** en el organigrama. Y de un externo no sabe ninguno.
- **Enrutar la solicitud a su jefe.** Sirve para internos y **no existe para los aspirantes
  externos**, que se registran sin unidad, sin jefe y sin expediente. El sistema atiende a las dos
  poblaciones.

#### Los canales, evaluados por estabilidad y funcionalidad

| | **SMS** | **WhatsApp Business** | **Telegram Gateway** |
|---|---|---|---|
| Madurez | décadas | años | **joven** (2024) |
| Cómo falla | **en silencio** | **suspensión de número o plantilla** | no entrega, **y se sabe antes** |
| Riesgo de proveedor | bajo, se cambia de operador | **alto** — un dueño que ya cambió su modelo de precios en 2025 | alto, pero API mínima |
| Qué obliga a mantener | poco | verificación de empresa, calidad del número, plantillas, escalones de volumen | casi nada |
| Alcance sin pedir nada | **total** | alto | bajo |
| Tarifa orientativa | US$0,06–0,11 | US$0,02–0,04 | **~US$0,01** |

⚠️ **Las tarifas son indicativas y hay que cotizarlas.** Cambian por corredor, volumen y año.

**Dos cosas decidieron la evaluación, y ninguna es el precio:**

1. **El Gateway permite PREGUNTAR ANTES si un número puede recibir**, sin gastar. Ni SMS ni WhatsApp
   lo hacen limpiamente. Con eso, sólo se le pide instalar Telegram a quien no lo tiene, y el
   respaldo a SMS se elige **sabiéndolo**, no descubriéndolo cuando el usuario se queja.
2. **En Telegram no hay reparto de ingresos.** El *bombeo* de SMS —disparar códigos a números de
   tarifa premium del propio atacante para cobrar parte de lo que tú pagas— **no tiene equivalente**.
   El ataque pasa de negocio a vandalismo.

**WhatsApp queda fuera:** su coste no es el dinero, es lo que obliga a mantener y su modo de fallo —
puedes perder el canal por una decisión ajena, justo cuando alguien no puede entrar.

**Un bot de Telegram NO sirve**: no puede escribir primero a quien no lo haya iniciado. El *Gateway*
es otro producto y sí alcanza a un número sin contacto previo.

#### 🚧 LO QUE BLOQUEA: no hay limitador de intentos, y no es sólo de aquí

**El backend no tiene ninguno.** Medido el 2026-08-29: 18 dependencias, ni una de límite ni de caché,
y **no hay Redis en ninguna pila**. Un limitador en memoria sirve para una instancia y deja de servir
con dos.

Sin él, un canal que cuesta dinero por mensaje se convierte en dos problemas:

- alguien agota el saldo;
- **o acosa a un tercero** llenándole el móvil de códigos que no pidió — lo que exige limitar **por
  número de destino**, no sólo por IP.

**Y hace falta igual sin ningún canal**: protege el login, el registro y el propio `/recover-email`.

**LA DECISIÓN DEL DUEÑO, que es lo que para esta tarea:** construirlo o comprarlo.

- **Construirlo** — sirve para todo el sistema, y entonces el proveedor de SMS puede ser crudo:
  **Infobip** (presencia regional y conexión directa con operadoras) o **Twilio** (mejor documentado).
  También valen **Vonage**, **Amazon SNS** (el más barato si ya hay AWS, con soporte de entrega
  mínimo) y los **agregadores locales**, que conectan directo con Claro, Movistar y CNT — mejor
  tarifa a volumen, pero exigen contrato y están peor documentados.
- **Comprarlo** — **Twilio Verify** no vende mensajes sino *verificaciones*: trae el limitador, la
  protección contra bombeo y el salto de canal. Se paga más por verificación y no se mantiene nada.
  Para un equipo que hoy no tiene ninguna de las tres piezas, puede salir más barato.

#### 🎯 LA DIRECCIÓN QUE EL DUEÑO QUIERE (2026-08-29)

No es «un canal de códigos» suelto. Es esto:

> **Al registrarse, la persona instala la APP propia y la REGISTRA. El número se valida desde la
> app, recibiendo el código por Telegram.**

La app deja de ser un cliente más y pasa a ser **el dispositivo vinculado a la cuenta**. Telegram
sólo interviene **una vez**, para validar el número en el alta.

**Lo que esto arregla, y no es poco:** el hueco de los aspirantes externos desaparece. Antes la app
no servía para recuperarlos porque no la tendrían vinculada; si la vinculación ocurre **en el
registro**, la tienen todos —externos incluidos— desde el primer minuto. Y entonces **la app es el
canal de recuperación** y Telegram deja de hacer falta después del alta.

**Lo que esto mueve:** la fricción se traslada al registro, que pasa a exigir instalar una app. Esa
es una decisión de producto —cuánta gente abandona un alta así— y **no la resuelve el código**.

**De qué depende:** de que exista la app, que hoy no existe. Es el plan de llevar el chat a una
aplicación propia. Hasta entonces, esta dirección no se puede empezar.

#### 📐 El diseño del servicio, aprobado el 2026-08-29

Está entero en **[`arquitecturas/microservicio-channels.md`](../arquitecturas/microservicio-channels.md)**
y no se repite aquí. En una línea: un servicio aparte que **sostiene conexiones** con
**Telegram, WhatsApp y un receptor de SMS**; el backend sigue decidiendo, y el correo se queda donde
está.

Tres cosas de ese diseño que cambian lo que esta ficha decía antes:

- **El SMS vuelve, pero al revés.** No lo envía el sistema: **lo envía el usuario**. Con eso el
  bombeo —el ataque que obligaba a un limitador antes de arrancar— **deja de existir**, porque vive
  de que seas tú quien paga el envío.
- **Coste por mensaje: cero, en los tres canales.** Toda la evaluación de tarifas de este documento
  queda como historia: el usuario siempre empieza la conversación.
- **Las multisesiones de WhatsApp se descartaron por sobrediseño.** Escribirle a alguien es **un
  enlace** que abre el WhatsApp del propio usuario.

#### Una decisión de arquitectura que cuesta poco ahora y mucho después

El envío, **detrás de una interfaz** con implementaciones intercambiables: un solo punto —«manda este
código a este número»— y detrás Telegram, SMS o la app propia. Sin eso el canal se mete en los
controladores y cambiarlo es un refactor.

#### Y una regla del modelo que sale de aquí

`emails.tipo` admite `personal` e `institucional`, **y una persona puede tener los dos**. Cuando un
externo entra en plantilla y recibe su correo institucional, **el personal no se sustituye: se
queda**. El institucional pasa a `principal` y el personal sigue como contacto de recuperación. No
cuesta ni una tabla ni un campo: es **no borrar** lo que ya está.

⚠️ **Y sobre la app propia como canal de recuperación:** sólo sirve si estaba instalada **y vinculada
antes** de la emergencia. Instalarla estando bloqueado no vale — lo primero que pide es iniciar
sesión, que es justo lo que no se puede. Vincularla **en el registro** lo arregla, y entonces también
vale para externos; la pregunta pasa a ser cuánta gente abandona un alta que exige instalar una app.

### I8 · La recuperación «olvidé mi correo»

Documento + país, con el nacional preseleccionado. **Lo que ya se midió el 2026-08-28**, para que no
haya que repetirlo:

- **Correo** es el único canal real: SMTP montado y el reset de contraseña ya va por ahí.
- **WhatsApp** es un bot de 272 líneas atado a una sesión con QR (*«escanea el código QR primero»*):
  depende de un teléfono atendido por una persona. No es infraestructura.
- **Telegram** y **Signal** son **sólo filas del catálogo**. Cero código.
- **1 de 43 personas tiene teléfono.** Un canal que no alcanza a 42 de 43 no es recuperación.

Y el hallazgo que cambió la forma de la tarea: **no necesita canal, y tampoco la pista enmascarada
que se propuso primero.**

«Recuérdame mi correo» y «no reveles quién está registrado» son **opuestos**: cualquier cosa que le
diga a alguien su correo se lo dice también a quien pruebe con una cédula ajena — y en Ecuador el
número de cédula es **semipúblico**. Con documento + país solo, el endpoint es un **oráculo de
existencia**, y protegerlo obligaba a construir un limitador de intentos y una bitácora que el
backend **no tiene**.

**La salida fue pedir la contraseña.** «Olvidé mi correo» no es «olvidé mi contraseña»: quien no
recuerda con qué correo se registró **sigue sabiendo su clave**. Con eso deja de ser un oráculo, y no
hace falta ni limitador ni bitácora.

**Se devuelve el correo COMPLETO, no enmascarado**: si has probado tu identidad con la contraseña,
`a***n@…` no te sirve para entrar y no protege de nada que la contraseña no proteja ya.

**Los dos fallos son indistinguibles** —«no existe» y «contraseña incorrecta» dan el mismo 401 con el
mismo texto— y la contraseña **se compara siempre**, contra un hash señuelo si la persona no existe:
sin eso el tiempo de respuesta delataría lo que el mensaje calla. Medido: **67 ms contra 70 ms**.

**Su límite, asumido y escrito en la pantalla:** quien olvidó las dos cosas se queda fuera, y el
destino es una persona. Eso es `I10`.

---

## 4 · Cómo se verifica

Pila **C** desde este worktree, en **https://localhost:8643**.

```bash
bash scripts/stack.sh c exec -T backend  npm run test:char:run
bash scripts/stack.sh c exec -T backend  npm run test:unit
bash scripts/stack.sh c exec -T backend  npm run check:sql-aliases
bash scripts/stack.sh c exec -T frontend pnpm run lint
bash scripts/stack.sh c exec -T frontend pnpm run test:unit
bash scripts/docs/gen-dbml.sh --check          # I3 e I4 cambian el modelo publicado
```

| Tarea | Qué mirar en el navegador | Con quién |
|---|---|---|
| **I3** · **I4** | `/admin/usuarios/personas/documentos_identidad` → Agregar: «Tipo» es un select de tres | admin |
| **I5** | La foto de una persona sigue viéndose en `/admin/usuarios/personas/persons` | admin |
| **I6** | `/` → entrar con **correo**; y comprobar que la cédula **ya no entra** | los tres |

⚠️ **Dos trampas ya pagadas en este repositorio, y las dos aplican aquí:**

1. **Mutar un trigger o un `CHECK` en la base viva no prueba nada:** `test:char:run` resetea y
   reaplica el esquema antes de correr, así que restaura lo que acabas de romper. Para saber si una
   prueba protege un objeto del esquema, hay que **mutar el fichero**.
2. **La evidencia es el efecto, no el cambio.** Comprobar que un atributo está en el DOM no prueba
   que el navegador se comporte distinto; eso costó dar `F3f` por cerrada sin estarlo en el plan
   `frontend-identidad-2026-08`.

---

## 5 · Lo que este frente NO hace

- **No migra las 28 rutas con `:cedula`.** Sólo las tres que bloquean `I7`. El resto —el expediente,
  sobre todo— es un frente propio.
- **No toca el registro** más allá de que el documento deje de ser llave. Sigue pidiéndolo.
- **No construye la verificación** de correo ni de teléfono. `marcarVerificado` existe en los tres
  servicios y su único llamador es el bootstrap; eso está anotado como `F4d` en
  [`frontend-identidad-2026-08.md`](./frontend-identidad-2026-08.md) y bloqueado por decisión del dueño.
- **No añade campos a `instituciones`** más allá de nombre y país.
