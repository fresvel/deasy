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
| **I3** | `documentos_identidad.tipo` es un `CHECK` de tres; `tipos_documento` desaparece | ⬜ | | |
| **I4** | `documentos_identidad.pais_id` es obligatorio y el índice pierde el `COALESCE` | ⬜ | | |
| **I5** | Las rutas de foto y escaneo entran por `:personId`, no por `:cedula` | ⬜ | | |
| **I6** | 💥 El login **sólo acepta correo**. Cambian las credenciales de referencia | ⬜ | | |
| **I7** | La búsqueda por documento sale de `UserRepository`: con ella, la colisión | ⬜ | | |
| **I8** | Recuperación «olvidé mi correo» por documento + país | ⛔ | **Aplazada por el dueño** al 2026-08-28: se trata en otra sesión | |

**8 tareas.** `I8` está aparcada a propósito y no cuenta como pendiente de este frente.

💥 marca **la única tarea que rompe algo de cara al usuario**. Está aislada a propósito: se puede
aprobar, ejecutar y revertir sola.

### El orden no es negociable

```
I1 ─┬─> I3 ──> I4
    └─> I2
I5 ──> I7          (I7 no se puede hacer antes: I5 le quita los últimos tres llamadores)
I6                 (independiente — se puede hacer en cualquier momento)
```

- **`I3` necesita `I1`**: el bootstrap tiene que saber de qué país es la institución para componer
  el nombre y elegir el validador de la fila nacional.
- **`I7` necesita `I5`**, y esto es lo que más se olvida: `findByCedulaOrEmail` tiene **cuatro**
  llamadores y sólo uno es el login. Borrar su rama de documento antes de migrar las rutas deja sin
  foto y sin escaneo a todo el mundo.
- **`I6` es independiente**: quitar la cédula del login no exige haber borrado nada por dentro.

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

Se lleva por delante, gratis:

- `resolveTipo` entero, y su consulta;
- el `JOIN` a `tipos_documento` en las tres lecturas de `UserRepository`;
- **la ambigüedad de `tipo_id`** en `FK_TABLE_MAP`, marcada al añadirla porque es un nombre genérico
  que otra tabla podría estrenar;
- una pestaña en Usuarios (de 8 a 7).

### I4 · `pais_id` obligatorio

`NOT NULL` en la instancia, e índice `(tipo, pais_id, numero)`.

⚠️ **Y aquí hay que decidir algo.** El esquema **no tiene ni un `ALTER`**: es todo
`CREATE ... IF NOT EXISTS`. Un `NOT NULL` o un `CHECK` nuevos **no se aplican sobre una base que ya
existe** — ni fallan, simplemente no están. En dev da igual (`test:char:run` la recrea); para
cualquier otro despliegue hace falta decidir si esto pide migración o si basta con recrear.

### I5 · `:cedula` → `:personId`

Las de foto y escaneo primero, que son las tres que bloquean `I7`:

```
GET|PUT /users/:cedula/photo
GET|PUT /users/:cedula/documento/escaneo
```

Y `requireCedulaAccess` con ellas. Las **28 rutas** con `:cedula` no se migran todas en esta tarea:
el resto (el expediente, sobre todo) es un frente propio y se anota, no se arrastra.

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

### I8 · ⛔ La recuperación — aplazada

Documento + país, con el nacional preseleccionado. **Lo que ya se midió el 2026-08-28**, para que no
haya que repetirlo:

- **Correo** es el único canal real: SMTP montado y el reset de contraseña ya va por ahí.
- **WhatsApp** es un bot de 272 líneas atado a una sesión con QR (*«escanea el código QR primero»*):
  depende de un teléfono atendido por una persona. No es infraestructura.
- **Telegram** y **Signal** son **sólo filas del catálogo**. Cero código.
- **1 de 43 personas tiene teléfono.** Un canal que no alcanza a 42 de 43 no es recuperación.

Y el hallazgo que cambia la forma de la tarea: **«olvidé mi correo» no necesita canal.** No se envía
nada — se enseña una **pista enmascarada** (`a***n@institucion.edu.ec`), que es suficiente para
reconocerlo y no revela la dirección.

⚠️ Con **límite de intentos y registro**: en Ecuador el número de cédula es semipúblico, y sin esa
protección se estaría publicando un directorio de cédula → correo institucional.

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
