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
| **F3d** | Las claves ajenas del editor genérico se eligen escribiendo, con una sola implementación de combobox | ✅ | `useAdminFkManager` de 237 a 66 líneas · alta de persona con nacionalidad verificada en la base (`nacionalidad_pais_id=60 → EC`) · 10 tests nuevos, 3 mutaciones cazadas | 2026-08-28 |
| **F3e** | Buscar en el admin deja de distinguir mayúsculas | ✅ | «ecu» pasa de 0 a 2 países; 6 `LIKE` a `ILIKE` | 2026-08-28 |
| **F3f** | La contraseña del admin deja de disparar el gestor de credenciales de Chrome | ✅ | La contraseña reasociada por atributo `form` a un formulario vacío (0 campos de texto); el de los campos ya no contiene ninguna. **Confirmado por el dueño en pantalla**, que es la única evidencia que valía: el desplegable es interfaz nativa y la automatización no la ve. Primera vuelta fallida documentada abajo | 2026-08-28 |
| **F3g** | Campos que dependen de campos: `filterBy` + `showWhen`, declarados por el backend | ✅ | Cadena País→Provincia→Ciudad: «port» ofrece sólo Portoviejo, no Portovelo; cambiar a España vacía las dos en cascada; el caso especial de `process_definition_series` migrado y con idéntico comportamiento | 2026-08-28 |
| **F3h** | El punto se marca en un mapa, no se teclea: `AppMapPicker` extraído de `register` | ✅ | Dirección creada con lat/lng del clic (`-0.180673, -78.467875`); `RegisterView` de 864 a 776 líneas | 2026-08-28 |
| **F3i** | La lista de personas avisa de qué le falta a una cuenta | ✅ | Columna calculada `datos_faltantes`; etiqueta `deasy-tag--danger` con «Sin documento · Sin correo»; golden de `list_persons` movido | 2026-08-28 |
| **F3j** | Vuelven las dos columnas calculadas que `processes` perdió en silencio | ✅ | «Configuracion activa» = 1.1.0 y «Estado configuracion» = Activa otra vez en pantalla | 2026-08-28 |
| **F4a** | Marcar un principal desmarca al anterior, en las CUATRO tablas | ✅ | Trigger `trg_principal_unico_fn` con el ámbito por argumentos (persona / persona+tipo); 2 goldens nuevos, y las 2 mutaciones del esquema cazadas por su prueba | 2026-08-28 |
| **F4b** | El escaneo del documento se sube y se ve desde la pestaña | ⬜ | | |
| **F4c** | Los canales de un teléfono se eligen desde el teléfono | ⬜ | | |
| **F4d** | `verificado`: decidir si se construye el flujo o se deja a mano | ⛔ | **Lo desbloquea el frente 15** ([`channels-verificacion-2026-08.md`](./channels-verificacion-2026-08.md)), que es el flujo de verificación que faltaba. Antes: bloqueada por una decisión del dueño. `marcarVerificado` existe en los tres servicios y su ÚNICO llamador es el bootstrap: no hay flujo. Ponerlo de sólo lectura lo dejaría inalcanzable para siempre | |
| **F5** | `/perfil/datos` — el usuario edita sus propios datos personales | ⬜ | | |
| **F6** | Decisión del dueño sobre la dirección en el registro, y su ejecución | ✅ | **Decidido: se quita.** `RegisterView.vue` de **786 → 608 líneas** · 8 campos y el mapa fuera · el guard que bloqueaba el envío sin coordenadas, fuera · código muerto barrido: `deasy-form-grid--three`, `AuthService.listarProvincias/listarCiudades` y sus dos rutas de `apiConfig` · `AppMapPicker` **intacto** (lo usa `AdminEditorModal`) · frontend **431** y sus 27 puertas · char **327/327** | 2026-08-31 |
| **F7** | El panel de la persona: documentos, correos, teléfonos, direcciones y foto en un sitio | ⬜ | | |

**18 tareas vivas** (`F3` no cuenta: está revertida). `F1` y `F2` son la base: sin ellas, lo demás se
construye sobre un editor que enseña números.

### Por qué `F3f` estuvo en ✅ sin estarlo

La primera vuelta puso `autocomplete="new-password"` en el campo de contraseña, comprobó **que el
atributo estaba en el DOM**, y con eso se dio por cerrada. El dueño volvió diciendo que el
desplegable seguía saliendo, y tenía razón.

El fallo no fue el arreglo: fue **medir la causa equivocada**. `new-password` resuelve otra cosa —
declara que el campo no es un inicio de sesión— pero no toca a quién elige Chrome como candidato a
«usuario», que es una decisión **posicional**: el campo de texto anterior a una contraseña dentro
del mismo formulario. Comprobar que el atributo existe no comprueba que el efecto ocurra.

Queda como aviso, porque la trampa se repite: **la evidencia de una tarea tiene que ser el efecto,
no el cambio**. «El atributo está puesto» no es evidencia de «el desplegable no sale».

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

#### ✅ Decidido y hecho el 2026-08-31

**El dueño decidió quitarla.** Y para entonces había un argumento que no existía cuando se escribió
esta evaluación: **el registro ya no es un formulario, son tres pasos**. La dirección había pasado de
ser el campo más caro de una pantalla a ser el campo más caro del **primer paso de tres**, y quien
abandonaba ahí no llegaba a verificar nada. El coste de esa fricción se multiplicó justo cuando el
dato seguía sin consumirse.

`RegisterView.vue` pasa de **786 a 608 líneas**. Sale el guard que bloqueaba el envío sin
coordenadas, y con él el bloque entero: país, provincia, ciudad, dos calles, referencia y el mapa.

**Código muerto barrido en el mismo commit** —lo pidió el dueño, y las puertas ayudaron:

| Qué | Cómo apareció |
|---|---|
| `.deasy-form-grid--three` | Lo cazó `css-prune`: su único consumidor era esa sección |
| `AuthService.listarProvincias` y `listarCiudades` | Cero consumidores al quitar el formulario |
| `SYSTEM_GEO_PROVINCIAS` y `SYSTEM_GEO_CIUDADES` en `apiConfig` | Ídem |
| `IconMapPin` | Importado y sin usar |

⚠️ **`AppMapPicker` NO se borra**, y esto lo avisó el dueño antes de que fuera un problema: lo usa
`AdminEditorModal`. Lo que salió fue **su uso aquí**, no el componente.

⚠️ **Las rutas del backend `/system/geografia/{provincias,ciudades}` se quedan.** `F5`
(`/perfil/datos`) va a gestionar direcciones y las necesita. Lo que sobraba era el atajo del
frontend, no el endpoint.

🚧 **Queda pendiente el aviso de «perfil incompleto»**, que es la contrapartida de haberla quitado.
Va con `F5`, que es donde se rellenará.

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
