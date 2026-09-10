# Frente 20 · Lo que falta saber de una persona

**Abierto el 2026-09-05 por decisión del dueño**, con la lista de datos que el sistema todavía no
recoge. Es el siguiente paso del frente 14, que sacó de `persons` la identidad —documentos, correos,
teléfonos, direcciones— y la dejó en **once columnas**.

## §0 · Control de ejecución

| Tarea | Qué entrega | Estado | Evidencia | Fecha |
|---|---|:--:|---|---|
| **P0** | Este plan, con el terreno medido y **las siete decisiones tomadas** | ✅ | Terreno medido el 2026-09-05 (la fuente del INEC, el RBAC real, la cadena geográfica). Las decisiones, aprobadas una a una por el dueño y escritas en §6 con su criterio | 2026-09-08 |
| **P1** | `parroquias` sembrada, `ciudades` → `cantones`, y las etiquetas por país | ✅ | **222 cantones · 1 314 parroquias · 3 clases · 3 etiquetas** en la base tras `test:char:run`. 330/330 char, 819 unit backend, 491 front, los 3 `check:` y los 3 gates de doc en verde. Verificado en `/admin/institucion/geografia/parroquias`. **Recupera `2302 La Concordia`**, que faltaba por un fallo del extractor | 2026-09-08 |
| **P2** | Lo que sí es de `persons`: nacimiento, **sexo**, género, autoidentificación, estado civil | ✅ | **11 → 17 columnas**, 5 claves ajenas nuevas. Verificado por `PATCH /users/me`: los seis valores llegan a la base y la provincia se deduce del cantón; y «nací en Colombia, cantón de Esmeraldas» devuelve **400** sin tocar la fila. Prueba nueva que **lee el esquema** y caza una columna olvidada en la lista blanca, con mutación comprobada. 330/330 char (1 golden movido, 7 líneas, sólo las columnas nuevas). ⚠️ **P8 (2026-09-10) sacó el género y la etnia a `persona_autoidentificacion`**: son datos sensibles (LOPDP, Art. 4) y `persons` la leen nueve roles. `persons` queda en 15 columnas | 2026-09-08 |
| **P3** | `direcciones` gana sector y barrio | ✅ | Texto y no catálogo: no los fija ninguna autoridad. Verificado escribiendo una dirección real por `PATCH /users/me` y leyéndola en la base. Se aprovechó para arreglar un defecto que vio el dueño: la lista encabezaba «Ubicacion · Longitud» para un solo punto | 2026-09-08 |
| **P4** | `documentos_identidad` gana el tipo de visa | ✅ | **91 tablas** (`categorias_visa`, 13 filas de la LOMH agrupadas 3/9/1 por `condicion`), `'visa'` en el `CHECK`, `categoria_visa_id` con `chk_documentos_categoria_visa`. Verificado en el navegador: la categoría se despliega en `/admin/usuarios/personas/documentos_identidad` y la pestaña propia lista las 13. **Tres defectos cazados y cerrados**, ninguno visible por el 200 de un `INSERT`: (a) el validador aplicaba la regla de la cédula a la visa; (b) un `ReferenceError` de un `const` que desapareció al meterla **tumbaba hasta el login**, y sobrevivió a las dos suites porque `nombreDeTipo` no tenía ni un test; (c) el peor — `guardarPrincipal` reescribe la fila principal en su sitio, así que un `PATCH /users/me` con `tipo: visa` **convertía en visa la cédula de la persona**. Cerrado en el modelo con `TIPOS_QUE_ACREDITAN_IDENTIDAD`, no con un parche por sitio. 828 unit backend · 330/330 char (1 golden, 6 líneas, sólo las 3 columnas nuevas) · 493 front · los 3 `check:` y los 4 gates de doc en verde | 2026-09-09 |
| **P5** | La **salud**: discapacidad, enfermedades catastróficas, alergias, tipo de sangre | ⬜ | **Desbloqueada el 2026-09-10**: P8 y P10 cerradas. Nace bajo `datos_sensibles` —su tabla tiene que entrar en `TABLE_RESOURCE_MAP` y llevar `person_id`, o `rbacCatalog.test.js` se pone rojo— | |
| **P6** | `cuentas_bancarias` | ⬜ | | |
| **P7** | `cargas_familiares` **con su escaneo obligatorio**, y los contactos de emergencia sobre `expediente_referencias` | ⬜ | Depende del frente 18. Necesita **P10** | |
| **P8** | El recurso RBAC de los datos sensibles, y su bitácora | ✅ | **19 tablas sin recurso, cerradas**: caían a `process_definitions` y `GestorProcesos` editaba cédulas (`PUT` de cuerpo vacío: 400 antes, **403** después). **4 recursos** → 19 × 5 = **95 permisos**, 266 asignaciones: `datos_sensibles` y `datos_pago` fuera de `Auditor` y de `Usuario`; `catalogos`; `bitacora_sensible`. **`accesos_sensibles`** sólo admite altas (verificado: `UPDATE` y `DELETE` en psql → excepción; `POST` como admin → 403). **Género y etnia** salen de `persons`. El frontend deja su copia del mapa y lo lee de `meta`. Verificado en vivo con roles temporales: `Auditor` 403 en lo sensible y 200 en la bitácora; Talento Humano lee (200, 5 entradas) y no escribe (403); una lectura de 43 filas del admin deja 42 entradas, sin la suya. 330/330 char (3 goldens: −2 columnas, +20 permisos × 2) · 494 front · 3 `check:` y 4 gates de doc | 2026-09-10 |
| **P9** | El frontend: `/perfil/datos` y las pestañas de administración | ⬜ | ⚠️ El formulario de dirección debe dejar **hueco al prellenado** por geocodificación (frente 21, `M5`): hacerlo sin preverlo obliga a rehacerlo | |
| **P10** | Los **cinco catálogos de vocabulario**, sembrados | ✅ | **28 filas** para Ecuador (2+5+8+6+7), cada lista con su fuente en el código. Entra además `instituciones.campo_sexo_genero`. Categoría propia «Datos personales» bajo Usuarios — **no en «Otros»**. 330/330 char, 819+491 unitarios, los 3 `check:` y los 4 gates de doc en verde | 2026-09-08 |
| **P11** | La **nacionalidad sale de `persons`** y pasa a tabla: una persona puede tener varias | ⬜ | Hueco detectado por el dueño al cerrar P2. Va **después de P9** | |

**12 tareas · 7 cerradas.**

⚠️ **El identificador no es el orden.** `P10` nació al cerrar P0 y **va tercero**, no último: los
cinco catálogos los necesitan P2, P5 y P7. El orden de ejecución es:

```
P1 (geografía)  →  P10 (catálogos)  →  P2 · P3 · P4 · P6  →  P8 (RBAC)  →  P5 (salud)  →  P7  →  P9  →  P11
```

`P8` va **antes** que `P5` a propósito: recoger un dato de salud antes de decidir quién lo ve es crear
el problema y documentarlo a la vez. Y `P7` espera al frente 18, porque `expediente_referencias`
todavía no existe.

---

## 1 · El terreno, medido el 2026-09-05

| | |
|---|---:|
| Tablas del esquema | **82** |
| Columnas de `persons` tras el frente 14 | **11** |
| Columnas de `direcciones` | 16 |
| Columnas de `documentos_identidad` | 16 |
| Recursos del RBAC | **15** ⚠️ |
| Roles con acceso a `people` | **9** |

⚠️ **El RBAC tiene 15 recursos, no 13.** `CLAUDE.md` y la página de permisos dicen «13 recursos × 5
acciones = 65 permisos». Son **15 × 5 = 75**: los frentes 15 y 17 añadieron `channels` y
`legal_documents` y no se actualizó el conteo. Es deuda de documentación que este frente hereda,
porque va a añadir el recurso número 16.

## 2 · `parroquias` no existe, y la fuente ya está medida

La cadena llega hoy hasta el **cantón**:

```
paises (232)  →  provincias (24)  →  ciudades (221 CANTONES, dpa_code VARCHAR(4))
```

Sin parroquia no hay lugar de nacimiento completo, que es exactamente como lo pide una cédula
ecuatoriana.

**La fuente está descargada y contada** — el mismo Clasificador Geográfico Estadístico del INEC del
que salieron provincias y cantones ([`cge2022.xls`](https://aplicaciones2.ecuadorencifras.gob.ec/SIN/descargas/cge2022.xls),
actualizado al 31-12-2021, `HTTP 200`, 339 KB):

| | |
|---|---:|
| Filas con DPA de 6 dígitos | **1 442** |
| Marcadas con `*` (históricas) | **131** |
| **Vigentes** | **1 311** |
| De la provincia de Esmeraldas (08) | 69 |

Es el mismo patrón que ya se aplicó a los cantones —231 en el fichero, 221 vigentes tras descartar
los marcados—, así que el criterio no se inventa: se repite.

⚠️ **El extractor necesita una vuelta más.** El código de parroquia codifica su clase en el número:
**01–49 urbanas**, **50 la cabecera cantonal**, **51+ rurales**. Mi conteo preliminar mete las
cabeceras en el saco rural. Distinguirlas es trabajo de `P1`, y probablemente una columna `clase`.

⚠️ **Y hay que decidir el nombre.** `parroquias` colgaría de `ciudades`… que **guarda cantones**. El
desajuste ya existe y este frente lo hereda: o se convive con él documentándolo, o se renombra
`ciudades` → `cantones` en el mismo commit, que hoy es barato porque **no hay datos en producción**.

## 3 · La salud es categoría especial, y el RBAC lo demuestra

**Discapacidad, enfermedades catastróficas, alergias y tipo de sangre** son datos de salud, y la
LOPDP los trata como **categoría especial** (Art. 25). No es una etiqueta: cambia el diseño, y hay
una medición que lo prueba.

**Estos nueve roles pueden leer `people` hoy:**

| Rol | Sobre `people` |
|---|---|
| `AdminSistema` · `GestorTalentoHumano` | `read create update delete manage` |
| `GestorSeguridad` · `GestorUnidades` · `GestorProcesos` · `GestorEjecucionProcesos` · `GestorFirmas` · `GestorContratacion` · `Auditor` | `read` |

⚠️ **Si la salud cuelga de `persons`, siete roles que no tienen nada que ver la leen** — incluido
`GestorFirmas`, cuyo trabajo es un flujo de firma, y `Auditor`, que existe para consultar sin
escribir. Por eso:

| | |
|---|---|
| **Tabla aparte, no columnas en `persons`** | Para que el permiso se dé sobre la tabla, no sobre la persona entera |
| **Recurso RBAC propio** (el 16.º) | Leer el nombre de alguien no puede autorizar a leer su discapacidad |
| **Quién lo ve, decidido y escrito** | Propuesta: sólo `AdminSistema` y `GestorTalentoHumano` |
| **Bitácora de acceso** | Una medida técnica que elegimos, **no** una obligación con ese nombre — ver §6 · P8 |

**Se apoya en lo que el frente 17 ya dejó hecho** —consentimiento demostrable, documentos legales
versionados y una pestaña de administración con RBAC—, así que `P8` no parte de cero.

Por eso **`P5` nace ⛔ bloqueada por `P8`**: recoger el dato antes de decidir quién lo ve es crear el
problema y documentarlo a la vez.

## 4 · El reparto

| Dato pedido | Dónde va | Forma |
|---|---|---|
| Fecha de nacimiento | `persons` | `DATE` |
| **Provincia · cantón · parroquia de nacimiento** | `persons` | Tres claves ajenas · necesita `P1` |
| **Sexo** | `persons` | **`CHECK`** |
| **Género** | **`persona_autoidentificacion`** (P8) | **FK a `generos`** |
| Autoidentificación étnica | **`persona_autoidentificacion`** (P8) | FK a `autoidentificaciones_etnicas` |
| Estado civil | `persons` | FK a `estados_civiles` |
| Tipo de sangre | **`persona_salud`** | `CHECK` · 8 valores |
| Discapacidad, tipo, porcentaje y carné | **`persona_salud`** | FK a `tipos_discapacidad` |
| Enfermedades catastróficas | **`persona_salud`** | |
| Alergias | **`persona_salud`** | |
| Tipo de visa | `documentos_identidad` | Es atributo del documento, no de la persona |
| Sector y barrio | `direcciones` | Dos columnas |
| Cuentas bancarias | **`cuentas_bancarias`** | N por persona, con `principal_flag` |
| Cargas familiares | **`cargas_familiares`** | Documento propio **con escaneo obligatorio** |
| Contactos de emergencia | **`expediente_referencias`** | Ver §5 |

### Las nueve tablas nuevas

```
parroquias                        P1 · 1 314 filas del INEC
generos                           ┐
estados_civiles                   │  P10 · los cinco catalogos de vocabulario,
autoidentificaciones_etnicas      │  todos con pais_id, code, name, orden, is_active
tipos_discapacidad                │
parentescos                       ┘
persona_salud       1:1 con persons · PK = FK, el patrón de subtipo del frente 18
cuentas_bancarias   N · banco, tipo, número, titular, principal_flag generada
cargas_familiares   N · nombres, fecha de nacimiento, parentesco y su documento escaneado
```

`persona_salud` reutiliza el idioma que el frente 18 ya fijó: **clave primaria que es a la vez la
ajena**, con `ON DELETE CASCADE`. `cuentas_bancarias` reutiliza el `principal_flag` generado con
índice único parcial que `direcciones` ya usa.

#### `cargas_familiares`, con el diseño aprobado

```sql
CREATE TABLE IF NOT EXISTS cargas_familiares (
  id INT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  person_id INT NOT NULL,
  nombres VARCHAR(180) NOT NULL,
  fecha_nacimiento DATE NOT NULL,
  parentesco_id INT NOT NULL,
  -- EL DOCUMENTO, embebido. Una carga tiene UNO, no varios: es 1:1 y por eso va en columnas.
  documento_tipo TEXT NOT NULL CHECK (documento_tipo IN
    ('documento_nacional','documento_extranjero','pasaporte')),
  -- POR QUE LLEVA PAIS: "documento_nacional" no dice DE QUE PAIS. Lo dice esta columna, y cual es
  -- "el nacional" lo dice instituciones.pais_id. Es la misma frase que ya esta en
  -- documentos_identidad, y es lo que quito "cedula ecuatoriana" del modelo en el frente 14. El
  -- caso concreto: el hijo de un docente extranjero tiene documento extranjero.
  documento_pais_id INT NOT NULL,
  documento_numero VARCHAR(40) NOT NULL,
  -- LA EVIDENCIA, y va NOT NULL -- mas fuerte que en documentos_identidad, donde es nulable.
  -- Decision del dueño: el escaneo es evidencia de realidad y sin el no se registra la carga.
  -- Misma convencion `minio://<bucket>/<objeto>`, nunca una URL con el endpoint del entorno dentro.
  -- La ruta cuelga del arbol que ya existe: users/<person_id>/cargas/<carga_id>.pdf, por los IDS y
  -- no por el numero, que cambia al renovar el documento.
  escaneo_ref VARCHAR(255) NOT NULL,
  escaneo_subido_at TIMESTAMP NOT NULL,
  is_active SMALLINT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cargas_person FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE,
  CONSTRAINT fk_cargas_parentesco FOREIGN KEY (parentesco_id) REFERENCES parentescos(id),
  CONSTRAINT fk_cargas_pais FOREIGN KEY (documento_pais_id) REFERENCES paises(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_cargas_documento
  ON cargas_familiares (documento_tipo, documento_pais_id, documento_numero);
```

## 5 · Los contactos de emergencia van en `expediente_referencias`

Yo propuse tabla aparte, y el dueño corrigió: **esa tabla no exige documento**. Puede llevar el PDF de
una carta de recomendación, pero es en el fondo **una agenda de contactos de referencia** —nombre,
vínculo, cargo, institución, correo, teléfono—, que es la forma exacta de un contacto de emergencia.

Basta **marcar** cuáles lo son.

⚠️ **Hay que revisar su `CHECK` de `vinculo`.** Admite `laboral · personal · familiar`, pensado para
referencias profesionales. Un contacto de emergencia suele ser familiar, así que probablemente sirve
— pero hay que comprobarlo, no suponerlo.

⚠️ **Dependencia real con el frente 18:** `expediente_referencias` **todavía no existe**, es diseño
sin implementar. `P7` no puede cerrarse antes que `E3`.

## 6 · Las decisiones, tomadas

**Cerradas por el dueño el 2026-09-08.** Cada una con lo que se decidió y el criterio que la sostiene.

### La regla que ordena los vocabularios

Salió de decidir el tipo de discapacidad, y vale para los seis:

> **Lo que define una autoridad NACIONAL va a catálogo con `pais_id`. Lo universal se queda en `CHECK`.**

Es un cuarto motivo que no estaba en el criterio del repo —que hablaba de ordenación, atributos por
fila y referencias de otras tablas—: **un `CHECK` es global por definición y no puede tener un valor
para Ecuador y otro para Colombia.** Es la misma tensión que el frente 18 resolvió con
`campos_nacionales`.

| Vocabulario | Quién lo define | Decisión |
|---|---|---|
| **Tipo de sangre** | Biología · 8 valores | **`CHECK`** |
| **Sexo** | El dato administrativo del documento | **`CHECK`** |
| **Género** | Revisable, y por eso va aparte del sexo | **Catálogo** |
| **Estado civil** | El registro civil de cada país | **Catálogo** |
| **Autoidentificación étnica** | El instituto estadístico de cada país | **Catálogo** |
| **Tipo de discapacidad** | El CONADIS en Ecuador | **Catálogo** |
| **Parentesco** | El IESS y el código laboral de cada país | **Catálogo** |

**Cinco catálogos**, todos con la misma forma —`pais_id`, `code`, `name`, `orden`, `is_active`— y en
**tablas separadas**, no en una genérica con columna `eje`: es lo que hace el repo, donde
`signature_statuses` y `signature_request_statuses` son idénticas en forma y viven aparte.

### Sexo Y género, los dos

- **`persons.sexo`** — `CHECK`. El dato administrativo, el que va en la cédula.
- **`persona_autoidentificacion.genero_id`** — catálogo. La identidad autodeclarada. Estuvo en `persons` hasta P8, que la sacó por dato sensible.

No son lo mismo y no se guardan igual. El propio registro civil ecuatoriano los distingue desde 2016.

### La autoidentificación étnica: 8 valores del INEC

`indígena` · `afroecuatoriano` · `negro` · `mulato` · `montubio` · `mestizo` · `blanco` · `otro`.

**Va a catálogo y no a `CHECK` por dos hechos**: «montubio» se incorporó en **2010** —la lista
cambia— y **ningún otro país la usa**.

### El tipo de discapacidad: SEIS, no cinco

`fisica` · `intelectual` · `visual` · `auditiva` · `lenguaje` · **`psicosocial`**.

El sexto es el que maneja el CONADIS y faltaba en la lista de partida. **Añadir un valor a un `CHECK`
después obliga a recrear la base**, y por eso se decide antes de escribir el DDL — aunque aquí acabe
siendo catálogo.

### La cuenta bancaria es de la PERSONA

`contracts` ya existe con `person_id`, así que colgarla del contrato era posible. Se descarta porque
**una persona conserva su cuenta entre contratos**, y aquí las renovaciones son el caso normal:
colgarla del contrato obligaría a recapturarla en cada una.

Lleva `principal_flag` generado, el idioma que ya usan `direcciones` y `documentos_identidad`. Si
algún día un contrato concreto necesita otra cuenta, se añade `contracts.cuenta_bancaria_id` nulable.
**Ese orden es reversible; el contrario no.**

### El documento de una carga familiar: columnas propias, con escaneo obligatorio

Reutilizar `documentos_identidad` **no es viable**, y está medido:

```sql
person_id INT NOT NULL,
CONSTRAINT fk_documentos_person FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE
```

Una carga familiar no puede ser una `person`: `password_hash` y `token` son `NOT NULL`, así que habría
que inventarle credenciales — y aparecería en el listado de personas, en el RBAC y en los desplegables
de asignación. La alternativa —aflojar `person_id` y añadir `carga_familiar_id`, las dos nulables con
un `CHECK`— es **el patrón que el frente 18 acaba de retirar**.

**El escaneo va `NOT NULL`**, que es más fuerte que en `documentos_identidad`: por decisión del dueño
es **evidencia de realidad**, y sin él no se registra la carga.

**Y el validador del dígito verificador se reutiliza tal cual**: vive en un servicio, no en una
restricción de tabla.

### Quién ve la salud: `Auditor` NO

El patrón de referencia es `dossier` —`Usuario` lee y edita lo suyo, `Auditor` lee, `AdminSistema`
todo—, y se copia **con una diferencia deliberada**:

| Rol | `dossier` hoy | Salud |
|---|---|---|
| `Usuario` (lo suyo) | `read create update` | `read create update` |
| `GestorTalentoHumano` | — | `read` |
| `AdminSistema` | todo | todo |
| **`Auditor`** | `read` | **nada** |

`Auditor` existe para consultar sin escribir, y hoy lee `people` y `dossier`. **Una discapacidad no es
información de auditoría.**

### `ciudades` → `cantones`

Se renombra. La tabla nunca guardó ciudades: guarda el cantón.

⚠️ **Con una objeción anotada**: «cantón» es la nomenclatura de **Ecuador** —en España es municipio,
en Francia commune—, y el modelo lleva dos frentes quitando «Ecuador» de los nombres. La **etiqueta
que ve el usuario** debe salir de `instituciones.pais_id`, no del nombre de la tabla.

### P8 · Lo sensible, decidido el 2026-09-10

El diseño se aprobó con las cuatro recomendaciones, después de medir tres cosas que lo cambiaron.

**Lo que se midió antes de diseñar:**

| Hallazgo | Evidencia |
|---|---|
| **19 tablas del editor sin recurso** caían a `process_definitions` | `GestorProcesos` · `PUT documentos_identidad {}` → **400** «Falta la llave primaria»: había pasado el guard. `PUT persons {}` → 403. 9 de las 19 eran de este frente (P1, P10, P4) |
| La matriz de `Auditor` se derivaba del catálogo **entero** | `Auditor: READ_ALL_RESOURCES`: un recurso nuevo le daba lectura sin decidirlo |
| **Datos sensibles ya expuestos** | Etnia y género (P2) en `persons`, que leen 9 roles; la categoría de visa (P4) —«Solicitante de protección internacional»— la leían 8 |
| El plan decía que la bitácora «deja de ser opcional» | El Art. 38 del Reglamento es el **registro de actividades de tratamiento**, no un registro de accesos. La bitácora se apoya en el Art. 41.4 de la Ley |

**Las cuatro decisiones:**

1. **Tres clases de dato y el reparto de las 19 tablas**: sensible (`datos_sensibles`), pago (`datos_pago`), identificación (`people`) y `catalogos`.
2. **Etnia e identidad de género salen de `persons`** a `persona_autoidentificacion`. Reabre P2.
3. **`documentos_identidad` entera es sensible**, cédulas incluidas, en vez de sacar la visa a tabla propia (que habría revertido P4).
4. **Una cuenta bancaria nueva o cambiada queda pendiente hasta que la confirme Talento Humano.** Se construye en **P6**. El motivo: en el desvío de nómina (IC3, I-091818-PSA, que nombra a la educación entre los sectores más afectados) el atacante ya tiene la contraseña y oculta los avisos del correo, así que ni la re-autenticación ni el aviso bastan.

**Las cuentas bancarias NO son datos sensibles para la LOPDP**: no están en la lista del Art. 4 ni son «crediticios» (Art. 4 y 28: comportamiento económico para analizar la capacidad financiera). Van aparte por integridad, no por confidencialidad. **Las cargas familiares SÍ**: Art. 25.b, datos de niñas, niños y adolescentes.

**Fuentes verificadas, con su huella:**

| Documento | Origen | sha256 |
|---|---|---|
| LOPDP (R.O. Suplemento 459, 26-may-2021) | consejodecomunicacion.gob.ec | `57370709bc4d282549f5a4fecf399bb3b2d5ef1cefbe1189067c7c11f678475a` |
| LOPDP, segunda copia oficial | finanzaspopulares.gob.ec | `220d49f9e6cd420e9820ea47522a9f7e4890fbd6c607f522dc4f17bc5a5dcb5d` |
| Reglamento General de la LOPDP | cosede.gob.ec | `11c3152691befe0dc0d61f5d16e931c6487be3cfcdfc9abfac35a33c7ebe0d47` |

Las dos copias de la Ley traen **dos redacciones** de la definición de datos sensibles; una añade «datos relativos a las personas apátridas y refugiados que requieren protección internacional». Las dos incluyen la condición migratoria.

**Lo que P8 deja escrito para después:** una base ya instalada no recibe los permisos nuevos sin resembrar (`POST /system/bootstrap/initialize` o `recover:admin`), y con la tabla cerrada por defecto sus catálogos quedarían cerrados para todos menos `AdminSistema`. El titular **escribe** su género y su etnia por `PATCH /users/me`; **leerlos** por `/users/me` es de P9, que compone el perfil entero.

## 6bis · P11 · La nacionalidad sale de `persons`

**Hueco detectado por el dueño el 2026-09-08**, al cerrar P2: si `persons` gana `nacimiento_pais_id`
junto al `nacionalidad_pais_id` que ya tenía, salta la pregunta de si esa segunda columna aguanta.

### Una persona puede tener varias, y no es un caso raro

**Constitución del Ecuador, Art. 6**: la nacionalidad ecuatoriana *«no se pierde por el matrimonio o
su disolución, ni por la adquisición de otra nacionalidad»*. Y quien se naturaliza ecuatoriano puede
**mantener la de origen**.

La doble nacionalidad no es algo que haya que tolerar: **está protegida constitucionalmente**. Una
columna sola no lo representa.

### La principal NO la da el país de nacimiento

Se evaluó y se descarta, por dos motivos:

- **Muchos países dan la nacionalidad por sangre, no por suelo.** Un hijo de ecuatorianos nacido en
  Madrid es ecuatoriano y no nació en Ecuador.
- **La naturalización no tiene ninguna relación con dónde naciste**, que es justo el caso del Art. 6.

Derivarla del nacimiento sería **deshacer lo que P2 acaba de separar**: `nacionalidad_pais_id` nació
precisamente de distinguir dos campos que se llamaban «país».

**Decisión del dueño: la principal es DECLARADA**, con el país del documento nacional como valor por
defecto al crear. Un ecuatoriano-español con cédula ecuatoriana puede considerar principal la otra, y
eso es una declaración suya, no un hecho que el sistema pueda deducir.

### El diseño

```sql
CREATE TABLE IF NOT EXISTS nacionalidades_persona (
  id INT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  person_id INT NOT NULL,
  pais_id INT NOT NULL,
  -- COMO SE ADQUIRIO. Son los dos del Art. 6 de la Constitucion, y no cuatro inventados: el
  -- matrimonio y la descendencia son formas de una de las dos, no ejes propios. Universal, asi
  -- que CHECK y no catalogo.
  origen TEXT NOT NULL DEFAULT 'nacimiento' CHECK (origen IN ('nacimiento','naturalizacion')),
  principal SMALLINT NOT NULL DEFAULT 0,
  principal_flag SMALLINT GENERATED ALWAYS AS (CASE WHEN principal = 1 THEN 1 ELSE NULL END) STORED,
  is_active SMALLINT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_nacionalidades_person FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE,
  CONSTRAINT fk_nacionalidades_pais FOREIGN KEY (pais_id) REFERENCES paises(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_nacionalidades_persona ON nacionalidades_persona (person_id, pais_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_nacionalidades_principal ON nacionalidades_persona (person_id, principal_flag);
```

**Nada de esto se inventa**: es el mismo idioma que `direcciones` y `documentos_identidad` ya usan
—`principal` + bandera generada + índice único parcial— y que garantiza **una sola principal sin
trigger**. Y es el mismo desmontaje que el frente 14 hizo con documentos, correos, teléfonos y
direcciones; **la nacionalidad se quedó atrás**, y no por criterio: nadie preguntó si podía haber
varias.

### Lo que cuesta

| | |
|---|---:|
| Ocurrencias de `nacionalidad` | **78** en 11 ficheros |
| Prueba que ya existe y hay que rehacer | `UserRepository.nacionalidad.test.js` |
| Endpoint afectado | El registro, que la manda por código ISO |

⚠️ **Va DESPUÉS de `P9`**, no antes: el formulario de datos personales tendrá que pintarla como lista
con una principal, y hacerlo primero como desplegable único es trabajo tirado.

## 7 · Alcance y verificación

**No hay datos en producción**: las tablas se crean y la semilla se recrea. Sin `ALTER` en el esquema,
una base viva no las recibe — hay que recrearla, que hoy es gratis.

```bash
bash scripts/stack.sh c exec -T backend npm run test:char:run
bash scripts/stack.sh c exec -T backend npm run check:sql-aliases
bash scripts/stack.sh c exec -T backend npm run check:sql-comments
bash scripts/docs/gen-dbml.sh                    # cada tabla nueva necesita dominio
node scripts/docs/check-doc-modelo.mjs
```

⚠️ Cada tabla nueva necesita **dominio en `scripts/docs/dominios.json`** o el generador falla a
propósito.
