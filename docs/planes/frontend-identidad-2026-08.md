# El frontend de la identidad — cerrar los huecos que dejó el desmontaje

> **Qué es.** El modelo de `persons` se desmontó en nueve tablas
> (`docs/planes/` · rama `develop-usuario`, fusionada el 2026-08-27). La API acepta y devuelve
> documento, correos, teléfonos y direcciones. **Las pantallas no.** Este plan las pone al día.
>
> **Quién decide.** El dueño, paso a paso: cada tarea se aprueba antes de implementarse.

---

## §0 · Control de ejecución

| Tarea | Qué entrega | Estado | Evidencia | Fecha |
|---|---|:--:|---|---|
| **F1** | El menú se deriva de `category`: se borran las TRES listas de tablas a mano | ✅ | 12 categorías · 7 grupos · Usuarios de 1 a 8 pestañas · char 301/301 | 2026-08-28 |
| **F2** | Las claves ajenas nuevas se ven como nombre y no como número en el editor genérico | ✅ | `Pais = Ecuador`, `Canal = Telegram`, `Telefono = 0991112233` en pantalla | 2026-08-28 |
| **F3** | El modal de alta de usuario crea persona **completa**: documento, correo y teléfono | ↩️ | **Revertida el mismo día.** Ver abajo | 2026-08-28 |
| **F3b** | El editor genérico de `persons` sólo muestra **sus propias columnas** | ✅ | 10 campos, todos de la tabla; char 301/301; el golden del duplicado se mudó a `documentos_identidad` | 2026-08-28 |
| **F3c** | Un duplicado dice **qué** está repetido, también con índices de expresión | ✅ | «…combinación de «Tipo», «Pais emisor», «Numero»» donde antes decía «…con esos datos.»; mutación del patrón cazada por 2 tests | 2026-08-28 |
| **F4** | Las pestañas de Usuarios operan las tablas nuevas con su lógica (principal, verificado, escaneo) | ⬜ | | |
| **F5** | `/perfil/datos` — el usuario edita sus propios datos personales | ⬜ | | |
| **F6** | Decisión del dueño sobre la dirección en el registro, y su ejecución | ⬜ | | |
| **F7** | El panel de la persona: documentos, correos, teléfonos, direcciones y foto en un sitio | ⬜ | | |

**7 tareas vivas** (`F3` no cuenta: está revertida). `F1` y `F2` son la base: sin ellas, lo demás se
construye sobre un editor que enseña números.

### Por qué se revirtió `F3` el mismo día que se cerró

`F3` metió seis **campos virtuales** en el formulario de `persons` —documento, tipo, país emisor,
correo, teléfono, país del teléfono— y un hook que al **crear** los desviaba a su tabla. Funcionaba
al crear. Al **editar** no: `beforeUpdate` nunca los tocó, así que el formulario los mostraba
rellenos y **descartaba en silencio** lo que se escribiera en ellos. Un campo que se ve, se edita y
no guarda es peor que un campo que no está.

Y por debajo había un problema de forma que el defecto sólo hizo visible: **el editor genérico de
una tabla es de esa tabla**. Meterle columnas de otras cinco lo convierte en un formulario especial
disfrazado de genérico — el mismo olor que hizo God a `AdminTableManager` (regla 3 de «al mover
código»).

**Lo que F3 quería sigue haciendo falta** —dar de alta a un extranjero de una vez— pero es trabajo
del **panel de la persona** (`F7`), no del CRUD genérico. Ahí sí caben secciones, campos
condicionales y una transacción propia.

---

## 1 · Cómo está la API, y cómo la vamos a consumir

### 1.1 · Un solo objeto de usuario, con todo colgado

`GET /users/me` y el login devuelven **el mismo objeto**, y ya trae las cuatro colecciones nuevas:

```jsonc
{
  "id": 1, "first_name": "…", "last_name": "…",
  "cedula": "1234567897",          // DERIVADO: el número del documento principal
  "documento_tipo": "cedula_ec",
  "documentos":  [ { id, tipo, tipo_nombre, numero, pais_iso, pais, principal,
                     verificado, verificado_at, tiene_escaneo, escaneo_subido_at } ],
  "email": "…",                    // DERIVADO: la dirección del correo principal
  "emails":      [ { id, tipo, direccion, verificado, verificado_at, principal } ],
  "whatsapp": "+593…",             // DERIVADO: el teléfono principal con canal whatsapp
  "telefonos":   [ { id, tipo, numero, numero_completo, prefijo, pais_iso, principal,
                     canales: [ { code, name, verificado, verificado_at } ] } ],
  "nacionalidad": "EC", "nacionalidad_nombre": "Ecuador",
  "direccion": { … },              // DERIVADO: la principal de residencia
  "direcciones": [ { id, tipo, pais, provincia, ciudad, calle_primaria,
                     calle_secundaria, referencia, latitud, longitud, principal } ],
  "verify": { "email": true, "whatsapp": false }
}
```

**Los cuatro campos en singular son proyecciones, no datos.** `cedula`, `email`, `whatsapp` y
`direccion` se derivan del elemento `principal` de su colección. Sirven para pintar una cabecera sin
recorrer arrays; **no se editan por ahí**.

### 1.2 · La escritura: un solo endpoint, objetos anidados

```
PATCH /users/me        (auth · permiso account.update — lo tienen TODOS los roles)
```

Acepta, y **sólo**, estos campos — la lista blanca vive en `UserRepository.updateMe`:

| Campo | Forma | Notas |
|---|---|---|
| `first_name` · `last_name` | texto | |
| `email` | texto o `{ tipo, direccion }` | Cambiarlo **desverifica** |
| `nacionalidad` | ISO-3166 alfa-2 (`"EC"`) | También acepta `nacionalidad_pais_id` |
| `documento` | `{ tipo, pais, numero }` | `tipo` ∈ `cedula_ec` · `pasaporte` · `documento_extranjero` |
| `telefono` | `{ tipo, pais, numero, canales: ["whatsapp"] }` | |
| `direccion` | `{ tipo, pais, provincia, ciudad, calle_primaria, calle_secundaria, referencia, latitud, longitud }` | País por ISO; provincia y ciudad **por nombre**, acotadas por el nivel de arriba |

**Escribe siempre el elemento *principal*.** Para gestionar varios correos o teléfonos habría que
añadir endpoints; hoy el perfil maneja uno de cada, que es lo que la pantalla necesita.

**Errores que hay que saber pintar:**

- **`400`** — dato mal formado, con el motivo en `message`: *«La cédula ecuatoriana no es válida: el
  dígito verificador no cuadra»*, *«La ciudad 'Cuenca' no está en el catálogo de esa provincia»*.
- **`409`** — el dato está bien pero **ya está cogido**: *«Ese correo ya está registrado por otra
  persona»*. Es otra cosa que un 400 y merece otro mensaje en pantalla.

### 1.3 · El catálogo geográfico, público

```
GET /system/geografia/paises                      → [{ id, iso_alpha2, name, phone_code }]
GET /system/geografia/provincias?pais=EC          → [{ id, dpa_code, name }]
GET /system/geografia/ciudades?provincia_id=8     → [{ id, dpa_code, name }]
```

**Sin autenticar a propósito**: lo consume el registro, que por definición usa quien no tiene cuenta.
Ya lo envuelve `AuthService.listarPaises/listarProvincias/listarCiudades`, y `RegisterView` lo usa
para sus selectores encadenados. **El perfil los reutiliza tal cual** — no hay que escribir nada.

⚠️ `core/constants/countries.js` sigue existiendo y lo usan tres pantallas del expediente. **Para lo
nuevo se usa la API**, no esa constante.

### 1.4 · El escaneo del documento

```
GET /users/:cedula/documento/escaneo    → el PDF (o 404 si no hay)
PUT /users/:cedula/documento/escaneo    → multipart, campo 'escaneo', sólo PDF, 10 MB
```

Las **dos** exigen ser el dueño o rol elevado (`AdminSistema`, `GestorTalentoHumano`): más
restringido que la foto, que la ve cualquier compañero. El fichero **nunca** se expone por URL —
se pide al endpoint, como la foto de perfil.

### 1.5 · Lo que el editor genérico de `/admin` consume

Otro camino, y conviene no confundirlos: `/admin` no usa `PATCH /users/me`, usa el **CRUD genérico**
(`/admin/sql/:tabla`) guiado por los metadatos de `backend/config/sqlTables.js`. Por eso las tablas
nuevas ya aparecen ahí sin escribir pantallas — y por eso salen **crudas**, que es lo que arreglan
`F1`–`F4`.

---

## 2 · Las tareas

### F1 · Sacar las 11 tablas de «Otros»

**La causa, medida:** `AdminView.vue` tiene `GROUP_DEFS`, una **lista de nombres de tabla escrita a
mano** por grupo de menú. Lo que no está en ninguna cae en un cajón «Otros» que se genera solo
(`AdminView.vue:614`). Y **el `category` de `sqlTables.js` no lo lee nadie en el frontend** — son dos
fuentes de verdad y sólo manda la del frontend.

Las once: `paises` · `provincias` · `ciudades` · `documentos_identidad` · `tipos_documento` ·
`emails` · `telefonos` · `canales_mensajeria` · `telefono_canales` · `direcciones` ·
`document_version_uploads`.

- **Geografía** (`paises`, `provincias`, `ciudades`) → **Academia**, junto a unidades y periodos: es
  el catálogo territorial.
- **Identidad** (las siete de persona) → **Usuarios**, como pediste.
- `document_version_uploads` → **Gestiones**, con los documentos. Es de otro dominio y estaba
  huérfana de antes.

### F2 · Que las claves ajenas se lean

`FK_TABLE_MAP` (`AdminTableManagerConfig.js:108`) mapea nombre de columna → tabla, y es lo que hace
que un `unit_id` se pinte como el nombre de la unidad. Faltan las nuevas: `pais_id`, `provincia_id`,
`ciudad_id`, `tipo_id`, `canal_id`, `telefono_id`.

⚠️ `tipo_id` es ambiguo si algún día otra tabla lo usa para otra cosa. Se resuelve ahora y se deja
dicho.

### F3 · El modal de alta de usuario

Hoy el formulario de `persons` tiene `cedula` y `email` como **campos virtuales** (`virtual: true`):
el hook los desvía a sus tablas al crear. Funciona, pero:

- **no hay teléfono**, así que el usuario nace sin forma de contacto móvil;
- el **tipo de documento** no se puede elegir: el hook asume `cedula_ec`, o sea que **por el admin no
  se puede dar de alta a un extranjero**, que es justo lo que acabamos de habilitar;
- no valida el dígito verificador antes de enviar, así que el error llega del servidor.

### F4 · La lógica de las tablas nuevas en las pestañas de Usuarios

Lo que el editor genérico no sabe hacer solo:

- **«principal»**: marcar uno debería desmarcar el anterior. Hoy el índice único lo **rechaza** con
  un 409 y el usuario no entiende por qué.
- **«verificado»** y su fecha: son de sólo lectura desde la pantalla; se ponen por el flujo de
  verificación, no a mano.
- **El escaneo**: hoy `escaneo_ref` se ve como texto crudo. Debería ser subir/ver/quitar.
- **Los canales de un teléfono**: `telefono_canales` es una tabla de unión; operarla a mano es
  hostil. Debería editarse desde el teléfono.

### F5 · `/perfil/datos` — datos personales

Sección nueva en `PROFILE_SECTIONS` (`profileSections.js`, que ya es fuente única) + su ruta hija en
`core/router/index.js`. Cuatro bloques, todos contra `PATCH /users/me`:

**Identidad** (nombres, tipo de documento, número, país emisor, nacionalidad, + el escaneo) ·
**Contacto** (correo principal y su estado de verificación) · **Teléfono** (país, número, canales) ·
**Dirección** (los tres selectores encadenados, calles, referencia y el mapa).

⚠️ El router **bloquea `/perfil` para el admin** (`blockedForAdmin`), así que esto se prueba con
**gestor** o **usuario**.

### F6 · La dirección en el registro — evaluación

**Lo medido:** la sección ocupa ~120 de las 864 líneas de `RegisterView.vue`, son 6 campos más el
mapa, y **la ubicación exacta es obligatoria** — hay un guard que bloquea el envío sin coordenadas.

**Y el dato no lo consume nadie hoy.** Ninguna pantalla ni flujo lee `direcciones`; se recoge y se
guarda.

**Recomiendo quitarla del registro y dejarla sólo en el perfil.** Un alta que exige poner un punto en
un mapa antes de existir es la barrera más cara del formulario, y a cambio se obtiene un dato que
nadie usa todavía. El registro se queda con lo que **define la cuenta**: quién eres (documento),
cómo te contactamos (correo, teléfono) y tu contraseña.

**El riesgo de quitarla, dicho:** si nadie la pide después, no se rellena nunca. La contrapartida
barata es un aviso de «perfil incompleto» tras el primer acceso — lo propongo como opcional, no lo
doy por hecho.

---

## 3 · Cómo se verifica cada tarea

Pila **C** desde este worktree, en **https://localhost:8643**:

```bash
bash scripts/stack.sh c exec -T frontend pnpm run lint
bash scripts/stack.sh c exec -T frontend pnpm run test:unit
bash scripts/stack.sh c exec -T backend  npm run test:char:run   # si se toca backend
```

Y en el navegador, porque ni el lint ni los tests ven un formulario roto:

| Tarea | Ruta | Con quién |
|---|---|---|
| F1 · F2 | `/admin/usuarios` y sus pestañas | admin `1234567897` / `Demo1234!` |
| F3 | `/admin/usuarios/personas/persons` → «Agregar» | admin |
| F4 | `/admin/usuarios/personas/{documentos_identidad,emails,telefonos,direcciones}` | admin |
| F5 | `/perfil/datos` | **gestor** `0927654327` / `Gestor1234!` |
| F6 | `/registro` (sin sesión) | — |
