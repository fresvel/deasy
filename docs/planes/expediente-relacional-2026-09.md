# Frente 18 · El expediente sale del JSON y entra en la base

> **Qué es.** `expediente_asientos.data` es un `JSONB` con diez formas distintas dentro. Este frente lo
> convierte en tablas: una por sección, con claves ajenas a los catálogos que ya existen.
>
> **Quién decide.** El dueño. Las decisiones ya tomadas están en §2 y **no se vuelven a discutir**;
> lo que sigue abierto está en §7.

---

## §0 · Control de ejecución

| Tarea | Qué entrega | Estado | Evidencia | Fecha |
|---|---|:--:|---|---|
| **E0** | Este plan, con las decisiones de diseño tomadas y medidas | 🟡 | | |
| **E1** | El catálogo CINE-F: fuente limpia localizada y evaluada, no el PDF escaneado | ✅ | `cine-f-2013-es.csv`, 220 filas, jerarquía cerrada sin huérfanos, doblemente validada. Mitad B: Anexo II 2023 del CES, PDF digital | 2026-09-04 |
| **E2** | Las tablas del catálogo académico, sembradas por el bootstrap | ⬜ | | |
| **E3** | El esquema del expediente: espina + 10 subtipos + la hija del 1:N, y **`dossiers` retirada** | ⬜ | | |
| **E4** | `dossierStore` deja de hablar JSON y habla SQL | ⬜ | | |
| **E5** | `url_documento` pasa a `documento_ref` con la convención `minio://` | ⬜ | | |
| **E6** | La vista de investigación (`UNION ALL` de las cinco) | ⬜ | | |
| **E7** | El frontend: los seis formularios contra el modelo nuevo | ⬜ | | |
| **E8** | Migración de los datos existentes, con su script | ⬜ | | |

**9 tareas.** `E1` es la primera porque condiciona `E2` y `E3`: sin saber qué catálogo entra, no se
puede fijar la clave ajena de `titulos`.

---

## 1 · Por qué, con las cifras

La página [`/complemento/expediente/`](../src/content/docs/complemento/expediente.md) **defiende el
JSONB** con este argumento:

> *«son datos que rellena el propio usuario y **cuya forma cambia cada curso**»*

**Medido contra el código el 2026-09-04: esa premisa es falsa.** Las formas están fijadas a mano en
los formularios de Vue, con `v-model` literales. `AgregarTitulo` tiene nueve. Añadir un campo obliga
a tocar el formulario **igual que obligaría a tocar una tabla**.

> **Se está pagando el precio del JSONB sin cobrar su beneficio.** El beneficio es evolucionar sin
> migración; aquí no se evoluciona sin tocar código.

### Lo que cuesta hoy

| | |
|---|---|
| **Texto libre donde hay catálogo** | `pais: "Ecuador"` cuando `paises` tiene 232 filas con su ISO; `ies: "PUCESE"` cuando existe `units` |
| **Cero integridad** | Ni `NOT NULL`, ni `CHECK`, ni clave ajena. La única garantía del expediente es que hay uno por persona |
| **No se puede preguntar nada** | **Ninguna consulta entra en el JSON**: se lee el árbol entero y se filtra en JavaScript |
| **No se puede corregir** | `expediente_asientos` no tiene `updated_at`. Corregir un asiento es **borrarlo y volver a ponerlo** |
| **Datos de terceros en un blob** | `referencias` guarda nombre, correo y teléfono **de otra persona** |

### Dos defectos que el JSONB llevaba escondiendo

1. **`isnn` no existe.** `articulos` guarda `issn` (correcto) y `libros` guarda **`isnn`** — con la
   etiqueta «ISNN» visible en pantalla y en la cabecera de la tabla. Una columna lo habría cazado al
   escribir el DDL; una clave JSON, no.
2. **Una clave con `ñ`.** El formulario guarda `anio` y lo convierte a `año` al enviar. Mapea bien —no
   es un fallo— pero como nombre de columna sería inaceptable.

---

## 2 · Las decisiones ya tomadas

### 2.1 · Diez tablas, no un JSONB. **Ninguna sección es inviable**

Se evaluó sección por sección buscando qué impediría una tabla plana. Lo único que lo impide es un
valor **no escalar**. El catálogo devuelve **uno solo en las diez**:

```
experiencia.funcion_catedra → array      ["Programación", "Bases de datos"]
```

Todo lo demás son cadenas y números. Y ese array es un **1:N de manual** —una experiencia tiene
varias cátedras—, así que se convierte en tabla hija. No es un obstáculo: es una mejora, porque hoy
no se puede preguntar *«¿quién ha dado Bases de datos?»*.

| Sección | n | Campos |
|---|:--:|---|
| `titulos` | 7 | `campo_amplio · ies · nivel · pais · sreg · tipo · titulo` |
| `formacion` | 8 | `fecha_inicio · fecha_fin · horas · institucion · pais · rol · tema · tipo` |
| `experiencia` | 6 | `funcion_catedra[] · fecha_inicio · fecha_fin · institucion · modalidad · tipo` |
| `referencias` | 6 | `nombre · cargo_parentesco · institution · email · telefono · tipo` |
| `certificaciones` | 6 | `descripcion · fecha · horas · institucion · tipo · titulo` |
| `articulos` | 9 | `base_indexada · doi · estado · fecha · issn · revista · rol · sjr · titulo` |
| `libros` | 6 | `año · editorial · isbn · isnn · tipo · titulo` |
| `ponencias` | 3 | `año · evento · titulo` |
| `tesis` | 6 | `año · ies · nivel · programa · rol · tema` |
| `proyectos` | 8 | `avance · fin · inicio · institucion · presupuesto · programa_group · tema · tipo` |

⚠️ **Las cinco de investigación NO son polimórficas.** El formulario tiene
`v-if="form.tipoProduccion === 'articulos'"` y cuatro bloques hermanos: cada sección tiene su lista
**cerrada y casi disjunta**. Lo polimórfico es el formulario, no los datos. La documentación las
agrupó por cómo se pintan, no por cómo son.

### 2.2 · Espina + subtipos, no diez tablas sueltas

⚠️ **`expediente_asientos` es una fila POR ASIENTO, no por persona.** Medido antes de decidirlo:
`dossiers` tenía 1 fila y `dossier_items` 3 —un título, una experiencia, un artículo—. **La
granularidad del respaldo documental es por título, por certificación**, y se conserva entera.

```
persons
   └── expediente_asientos              ← 1 POR ASIENTO. Aquí viven section, el respaldo y las fechas
        ├─ id=1  section=titulos      → expediente_titulos      (id=1)   PK = FK, ON DELETE CASCADE
        ├─ id=2  section=experiencia  → expediente_experiencia  (id=2)   └── ..._funciones
        └─ id=3  section=articulos    → expediente_articulos    (id=3)
```

Cada tabla de sección tiene **`id` = clave primaria = clave ajena** a `expediente_asientos.id`: un asiento
y su detalle son la misma fila partida en dos tablas.

**Es el patrón que el esquema YA usa**: `contract_origins` con discriminador `origin_type` y sus dos
hijas `contract_origin_recruitment` / `contract_origin_renewal`, ambas con PK = FK al padre y
`ON DELETE CASCADE`. `referencia-esquema.md` §2f lo llama *«el único caso de herencia
table-per-subtype del esquema»*; deja de ser el único.

La alternativa evaluada y descartada —**diez tablas sueltas + una vista `UNION ALL`**— obliga a
repetir las columnas comunes diez veces, y sobre todo: **nada puede referenciar un asiento**, porque
una vista no admite clave ajena. Una firma o una auditoría que quisiera decir *«esto respalda al
asiento X»* no tendría destino.

### 2.3 · `section` es el discriminador, con `CHECK`

La columna que dice en cuál de las diez tablas está el resto de la fila. El `CHECK` la limita a los
diez valores y evita un `section = 'titulso'` que dejaría el asiento huérfano. Hoy las diez secciones
**no son un `CHECK`**: viven en `SECTIONS`, dentro de `dossierStore.js`.

### 2.4 · `url_documento` es PRUEBA, y no puede generarse

Es el **respaldo escaneado**: la copia del diploma, el certificado, el PDF del artículo. Prueba un
hecho **externo**. Un PDF generado a partir de los propios datos no probaría nada — sería el sistema
certificándose a sí mismo.

**Generar el CV a partir de los datos es otra cosa, y deseable.** Hoy es incómoda porque hay que
recomponerla desde un JSON; con tablas es una consulta. Queda anotada como consecuencia del frente,
no como sustituto del respaldo.

### 2.5 · El respaldo pasa a `minio://`, como el resto

Medido: `url_documento` guarda una **URL completa** construida con `MINIO_PUBLIC_ENDPOINT`.

```js
const buildDossierFileUrl = (objectName) =>
  `${MINIO_PUBLIC_ENDPOINT}/${MINIO_DOSSIER_BUCKET}/${objectName}`;
```

Es el antipatrón que el frente 14 ya corrigió en `documentos_identidad.escaneo_ref`: el endpoint del
entorno queda **dentro del dato**, así que mover la pila o cambiar de dominio invalida todas las
filas. Pasa a **`documento_ref`** con la convención `minio://<bucket>/<objeto>` y su lectura por
handler autenticado.

### 2.6 · `referencias` se queda como tabla del expediente

Con sus columnas propias (nombre, cargo, institución, correo, teléfono). Los datos del tercero quedan
**localizables y borrables**, que es lo que la LOPDP del frente 17 pide y un blob no permite.

### 2.7 · `dossiers` se retira: era una cáscara 1:1 sin columnas propias

**Decisión del dueño, 2026-09-04.** La tabla no tenía ni una columna con contenido:

```sql
CREATE TABLE dossiers (
  id         BIGINT PRIMARY KEY,   -- sintético
  person_id  INT NOT NULL,         -- UNIQUE (uq_dossiers_person) → 1:1 con la persona
  created_at, updated_at
);
```

Es **exactamente** el criterio con el que murió `documents`, y el `CLAUDE.md` de la raíz lo dice con
estas palabras: *«Tres tablas murieron y no vuelven: … y `documents` (una cáscara 1:1 sobre
`task_items` sin ni una columna propia)»*. `dossiers` es la misma figura sobre `persons` — y ya
había perdido su única columna con contenido cuando `TD7-c5` retiró `cedula` porque *«no era
redundante: era una copia que MENTÍA»*.

Se midieron las tres consecuencias posibles antes de decidir, y ninguna se sostiene:

| Lo que podría perderse | Medido |
|---|---|
| Las fechas propias del expediente | **Nadie las lee**: cero referencias a `dossier.created_at` / `updated_at` |
| El id del expediente en el contrato HTTP | Sale como `_id` (herencia de Mongo), pero **el frontend no lo usa**: cero referencias |
| Algo que apunte a `dossiers` | **Sólo `dossier_items.dossier_id`.** Ninguna otra clave ajena en el esquema |

**Lo único que sí desaparece, y hay que decirlo:** el expediente vacío deja de ser un estado. Hoy
`getOrCreateDossier` crea la cabecera aunque no haya un solo asiento, así que se puede distinguir
«abrió su expediente y no metió nada» de «nunca lo abrió». No se encontró nada que use esa
distinción, pero es la única pérdida real.

**Y el nombre cambia con la tabla**: `dossier_items` → **`expediente_asientos`**, y las diez de
sección a `expediente_*`. Mantener `dossier_*` colgando de `persons` habría dejado el nombre de una
tabla que ya no existe.

Alcance medido: **tres ficheros** nombran `dossiers` (`dossierStore.js`, `dossier_controler.js` y el
sembrado de caracterización). Y sale gratis: `E4` ya reescribe `dossierStore` entero.

---

## 3 · El catálogo académico (CINE-F) — E1 y E2

### 3.1 · El fichero que hay NO sirve

`/home/fresvel/bor/Campos/campos_titulos.json`, medido:

| | |
|---|---:|
| campos amplios | **38** |
| campos específicos | 145 |
| campos detallados | 522 |
| carreras / ofertas | 617 |
| titulaciones | 628 |

**Los 38 campos amplios son la prueba del fallo: el CINE-F tiene ONCE** (`00`–`10`), doce contando
`99 Campo desconocido`.

⚠️ Este plan decía **diez** hasta el 2026-09-04. Era un error mío, corregido al medir la fuente
oficial: se me olvidaba `00 Programas y certificaciones genéricos`, y `99` también es oficial —
aparece en el anexo del manual de la UNESCO. Los nombres que ocupaban dos
líneas en la tabla del PDF se partieron en filas separadas:

```
03  periodismo,
03  Ciencias sociales,
03  periodismo, información y derecho        ← el nombre real
06  y la comunicación (TIC) Ingeniería,      ← dos campos pegados
```

La causa está en el origen: el PDF es la resolución **RPC-SO-27-No.289-2014 del CES**, 79 páginas, y
es un **escaneo con OCR malo** — su portada sale como `EL coNsEJo or rnuceclót¡ supERIoR`.

### 3.2 · La fuente, en dos mitades

| Nivel | Fuente | Estado |
|---|---|---|
| campo amplio · específico · detallado | **CINE-F 2013**, cosechado del vocabulario SKOS de la Oficina de Publicaciones de la UE — republicación literal del ISCED-F con las etiquetas oficiales de la UNESCO en español | ✅ **Lista para sembrar** |
| carreras · titulaciones | **Anexo II 2023 del RANT**, del CES (101 págs.). PDF **digital, no escaneado** | 🟡 La fuente está; el extractor es trabajo de `E2` |

### Lo verificado de la mitad A

`cine-f-2013-es.csv` — **220 filas**, `codigo · nivel · padre · nombre_es · nombre_en`.

| Nivel | Códigos | Sustantivos | Resto |
|---|---:|---:|---|
| Campo amplio | **12** | 11 (`00`–`10`) | `99 Campo desconocido` |
| Campo específico | 58 | 29 | interdisciplinarios, «sin mayor definición», «no contemplados» |
| Campo detallado | 150 | 80 | ídem |

**Jerarquía verificada**: 0 padres inexistentes, y en las 220 filas `padre == codigo[:-1]`. El árbol
cierra solo. Doblemente validada contra el PDF inglés de la UNESCO-UIS (mismos conjuntos de códigos)
y contra el manual español (118 de 138 etiquetas literales).

⚠️ **La UNESCO NO publica el CINE-F en CSV, XLSX ni JSON** — sólo PDF. El CSV se cosechó del
vocabulario europeo, que es republicación literal.

### Y `99 Campo desconocido` ya resuelve media pregunta de §3.4

La norma **ya trae** su propio valor para «no se puede clasificar». Eso cubre el nivel del campo,
pero **no** sustituye a la clave ajena nula de la titulación: un `Diplôme d'Ingénieur` francés puede
tener campo `99` y aun así necesita que su nombre real se guarde. Son complementarios.

### 3.3 · País en las capas bajas: viable, y necesario

**Decisión del dueño**: las capas inferiores llevan `pais_id` → `paises`. Con eso:

- Si la institución es ecuatoriana, se ofrecen las titulaciones del Ecuador.
- El catálogo queda **abierto**: mañana entra el de otro país sin rediseñar nada.
- Las tres capas altas **no llevan país**: son la norma internacional y valen para todos.

### 3.4 · La flexibilidad: clave ajena nula + texto libre, NO un «NR»

**Decisión del dueño**: hay que admitir titulaciones que no estén en el catálogo. Se evaluaron las
dos formas:

| | Qué pasa con un `Diplôme d'Ingénieur` francés |
|---|---|
| Fila «NR / No registra» en el catálogo | La clave ajena queda satisfecha **y el nombre real se pierde** |
| **Clave ajena NULA + texto libre** | Se guarda el nombre tal cual, y se sabe que no viene del catálogo |

Gana la segunda, con un `CHECK` que exige una de las dos:

```sql
titulacion_id     INT NULL REFERENCES titulaciones(id),
titulacion_libre  VARCHAR(200) NULL,
CONSTRAINT chk_titulacion CHECK (titulacion_id IS NOT NULL OR titulacion_libre IS NOT NULL)
```

Así el catálogo es **preferente pero no obligatorio**, y un título extranjero no se degrada a «NR».

---

## 4 · Lo que se gana, y es lo que motivó el frente

- `pais` deja de ser texto y pasa a **clave ajena** a `paises` (232 filas con su ISO).
- `ies` puede apuntar a `units` cuando es interna.
- `campo_amplio` deja de ser texto y pasa al catálogo CINE-F.
- Las fechas dejan de ser cadenas.
- `expediente_asientos` **recupera `updated_at`**: corregir un asiento deja de ser borrarlo.
- La unión de las cinco secciones de investigación baja de JavaScript
  (`rowsFor: (records, tab) => records?.[tab] ?? []`) a **una vista SQL**.
- El JSONB desaparece **entero**: no queda cola variable que lo justifique.

---

## 5 · El alcance, medido

| | |
|---|---:|
| Ficheros que tocan el expediente | **49** |
| Asientos en la base | **3** (todos de semilla) |

⚠️ **Migrar los datos es gratis AHORA y no lo será después.** Es la única ventaja de tiempo que tiene
este frente, y se pierde en cuanto el sistema entre en uso.

---

## 6 · Cómo se verifica

```bash
bash scripts/stack.sh <letra> exec -T backend npm run test:char:run     # el contrato HTTP
bash scripts/stack.sh <letra> exec -T backend npm run check:sql-aliases # OBLIGATORIO tras tocar SQL
bash scripts/stack.sh <letra> exec -T backend npm run check:sql-comments
bash scripts/docs/gen-dbml.sh                                            # el modelo, en el mismo commit
```

⚠️ Cada tabla nueva necesita **dominio en `scripts/docs/dominios.json`** o el generador falla a
propósito. Y en el navegador: `/perfil` como **gestor** o **usuario** —el admin lo tiene bloqueado por
`blockedForAdmin`—, recorriendo las seis secciones.

---

## 7 · Lo que sigue abierto

| | |
|---|---|
| **⚠️ El CES DIVERGE del CINE-F en el nivel detallado** | Medido: coinciden en campo amplio (los diez nombres del CES son literalmente las etiquetas españolas del CINE-F) y en 20 de 21 específicos, pero en **detallado el CES fusiona, renombra y AÑADE códigos propios** (`81`, `82`, p. ej. «Estudios de género»). Si se siembra el CINE-F puro como capa 3, **algunos detallados del CES se quedan sin padre**. Dos salidas: (a) el detallado del CES como capa 3 con `pais_id`, y el CINE-F puro como capa 3 internacional; (b) el CINE-F puro y la equivalencia en una tabla de correspondencia. **Decisión del dueño** |
| **El Anexo II 2023, ¿sigue vigente?** | Firmado en abril de 2023. Existe referencia a `RPC-SO-03-No.047-2024` («Refórmese el Reglamento de armonización…») que **no se pudo leer**: vLex la tiene tras muro de pago y la Gaceta del CES exige sesión. Puede haber altas posteriores |
| **El extractor del Anexo** | El texto es limpio y se puede extraer, pero el recuento preliminar da 7–12 campos amplios por sección donde deberían ser 10: hay ruido de pies de página y celdas fusionadas. Necesita extracción **por geometría de celda**, no por bandas. Es trabajo de `E2` |
| **`titulaciones.carrera_id` se declaró `NOT NULL`** | Si la fuente trae titulaciones sin carrera, hay que aflojarlo **ANTES** de sembrar: el esquema no tiene `ALTER` |
| **Generar el CV** | Anotado como consecuencia deseable, sin decidir si entra en este frente |
| **`ies` → `units`** | Sólo vale para instituciones internas; falta decidir qué se hace con las externas |

---

## 8 · El esquema, completo

> **Esto es el DDL de diseño de `E3` (y de `E2`, `E5` y `E6`), para aprobar antes de tocar
> `backend/database/postgres_schema.sql`.** Todavía **no** está en el esquema: mientras esta sección
> exista sin su commit de implementación, la base sigue con `data JSONB`.

⚠️ **El orden de este apartado NO es el orden del fichero.** Aquí se lee primero la espina porque es
lo que explica el modelo; en `postgres_schema.sql` **el catálogo académico (§8.4) va antes**, porque
`expediente_titulos.titulacion_id` y `.campo_amplio_id` no pueden referenciar tablas que aún no existen
y este esquema **no tiene ni un `ALTER`** con el que arreglarlo después.

Los idiomas que se respetan, por si se compara con el resto del fichero: **no hay `BOOLEAN`** (todo
es `SMALLINT NOT NULL DEFAULT 1/0`), los dominios cerrados son `TEXT ... CHECK (col IN (...))` y
**no hay `CREATE TYPE`**, y toda tabla con `updated_at` lleva su trigger `set_updated_at()`.

### 8.1 · La espina: `expediente_asientos`

```sql
-- ── EL EXPEDIENTE: LA ESPINA ─────────────────────────────────────────────────────────────────────
-- Una fila POR ASIENTO, no por expediente: un titulo, una experiencia, un articulo. De quien es lo
-- dice person_id; la primaria es id.
--
-- Aqui vive lo que TIENEN LOS DIEZ: de que seccion es, su respaldo escaneado, su estado de revision
-- y sus fechas. El detalle vive en la tabla de su seccion, con id = PK = FK a esta.
--
-- POR QUE ESPINA Y NO DIEZ TABLAS SUELTAS. La alternativa evaluada era diez tablas independientes
-- mas una vista UNION ALL. Obliga a repetir las columnas comunes diez veces y, sobre todo, NADA
-- PUEDE REFERENCIAR UN ASIENTO: una vista no admite clave ajena. Una firma, una revision o una
-- auditoria que quisiera decir "esto respalda al asiento X" no tendria destino. Con espina, si.
--
-- Es el patron que el esquema YA usa en contract_origins -> contract_origin_recruitment /
-- contract_origin_renewal: discriminador arriba, PK = FK abajo, ON DELETE CASCADE. Deja de ser el
-- unico caso de herencia table-per-subtype del esquema.
CREATE TABLE IF NOT EXISTS expediente_asientos (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  person_id INT NOT NULL,
  -- EL DISCRIMINADOR: en cual de las diez tablas esta el resto de la fila.
  --
  -- Hasta ahora estos diez valores NO eran un CHECK: vivian en la constante SECTIONS de
  -- backend/services/users/dossierStore.js. Un section = 'titulso' entraba sin protesta y dejaba el
  -- asiento huerfano, sin detalle y sin nadie que lo notara. Con el CHECK, ademas, la clave ajena
  -- del subtipo es exigible: un asiento de seccion titulos SOLO puede tener fila en expediente_titulos.
  section TEXT NOT NULL CHECK (section IN (
    'titulos','experiencia','referencias','formacion','certificaciones',
    'articulos','libros','ponencias','tesis','proyectos'
  )),
  -- EL ESTADO DE REVISION DEL ASIENTO, que hoy se llama "sera" dentro del JSON.
  --
  -- No estaba en la lista de campos de la seccion 2.1 de este plan y por un motivo: NO ES DE UNA
  -- SECCION, es de las diez. Lo escriben los seis formularios con el literal "Enviado", lo pinta
  -- DossierSectionCrud.vue como insignia en la PRIMERA columna de las seis tablas, y lo interpreta
  -- frontend/src/modules/perfil/utils/dossierStatus.js. Si el JSONB desaparece y esta columna no
  -- existe, el dato se pierde y la insignia se queda fija en "pendiente" para siempre.
  --
  -- El vocabulario sale de ese mapeador, que reconoce cuatro estados y sus sinonimos en ingles. Se
  -- guardan en minuscula y sin tildes; la etiqueta que se enseña es cosa del frontend.
  estado_revision TEXT NOT NULL DEFAULT 'enviado'
    CHECK (estado_revision IN ('enviado','revisado','aprobado','rechazado')),
  -- EL RESPALDO ESCANEADO: la copia del diploma, del certificado, del PDF del articulo. Prueba un
  -- hecho EXTERNO, y por eso no puede generarse a partir de los propios datos: seria el sistema
  -- certificandose a si mismo.
  --
  -- Referencia minio://<bucket>/<objeto> y NUNCA una URL, que es lo que guardaba url_documento:
  -- la componia buildDossierFileUrl() con MINIO_PUBLIC_ENDPOINT dentro, asi que mover la pila o
  -- cambiar de dominio invalidaba TODAS las filas. Es el mismo antipatron que el frente 14 corrigio
  -- en documentos_identidad.escaneo_ref, y el comentario de aquella columna cita este como el
  -- ejemplo a no repetir. La URL, si hace falta, se compone al leer, por handler autenticado.
  --
  -- NULA significa "sin respaldo subido". url_documento era NOT NULL DEFAULT '' y usaba la cadena
  -- vacia para lo mismo: dos formas de decir "no hay" en la misma columna.
  documento_ref VARCHAR(255) NULL,
  documento_subido_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- LA TABLA DEJA DE SER DE SOLO AÑADIR, y es un cambio de naturaleza, no una columna mas.
  --
  -- Sin updated_at, corregir una tilde de un titulo era BORRAR el asiento y volver a ponerlo — con
  -- lo que se iba tambien su respaldo escaneado y su fecha de alta. Un expediente academico es una
  -- entidad con estado que se corrige durante años, no un registro historico inmutable.
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_expediente_asientos_person FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_expediente_asientos ON expediente_asientos (person_id, section, id);
CREATE OR REPLACE TRIGGER trg_dossier_items_set_updated_at BEFORE UPDATE ON expediente_asientos FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

**Lo que desaparece de esta tabla:** `data JSONB NOT NULL DEFAULT '{}'` y `url_documento TEXT NOT
NULL DEFAULT ''`. No queda cola variable que justifique el JSONB, así que se va **entero**.

### 8.2 · Las diez tablas de sección

Todas comparten la misma cabecera —`id BIGINT NOT NULL PRIMARY KEY` que es a la vez clave ajena a
`expediente_asientos(id)` con `ON DELETE CASCADE`— y **ninguna repite `created_at`, `updated_at`,
`section` ni el respaldo**: eso está en la espina y borrar el asiento se lleva el detalle.

```sql
-- ── 1/10 · TITULOS ───────────────────────────────────────────────────────────────────────────────
-- La seccion que mas gana con el cambio: de sus siete claves JSON, TRES eran texto libre donde ya
-- habia catalogo (pais, titulo, campo_amplio) y una era un vocabulario cerrado sin ninguna defensa.
CREATE TABLE IF NOT EXISTS expediente_titulos (
  id BIGINT NOT NULL PRIMARY KEY,
  -- LA TITULACION, con la valvula de escape decidida en la seccion 3.4 de este plan.
  --
  -- El catalogo es PREFERENTE PERO NO OBLIGATORIO. La alternativa —una fila "NR / No registra" en
  -- titulaciones— satisface la clave ajena Y PIERDE EL NOMBRE REAL: un Diplome d'Ingenieur frances
  -- se degradaria a "NR". Con clave ajena nula mas texto libre se guarda el nombre tal cual y ademas
  -- SE SABE que no viene del catalogo, que es informacion que la fila "NR" tampoco da.
  titulacion_id INT NULL,
  titulacion_libre VARCHAR(200) NULL,
  -- LA INSTITUCION QUE LO EMITE. Sigue siendo texto: enlazarla a units solo valdria para las
  -- internas, y el 100 % de los titulos de una universidad son de OTRAS universidades. Que se hace
  -- con las externas esta abierto en la seccion 7 de este plan; hasta que se decida, texto.
  ies VARCHAR(200) NOT NULL,
  pais_id INT NOT NULL,
  -- EL NIVEL. Vocabulario CERRADO y por eso CHECK y no tabla: el criterio del esquema —el mismo que
  -- documentos_identidad.tipo escribe en su comentario— es que un vocabulario fijo sobre el que el
  -- codigo se ramifica va en CHECK, y este se ramifica: TitulosSection.vue filtra sus subpestañas
  -- con nivel === 'Grado' y nivel === 'Tecnico' || 'Tecnologo'.
  --
  -- Se guardan en minuscula y sin tildes. Los formularios enseñan "Maestria Tecnologica" con sus
  -- tildes; eso es etiqueta, no dato, y traducirla es del frontend.
  --
  -- OJO AL MIGRAR (E8): hay DOS listas de niveles en el codigo y NO coinciden. AgregarTitulo.vue
  -- tiene ocho y AgregarInvestigacion.vue tiene siete — le falta la maestria tecnologica—, pese a
  -- que ambas describen el mismo eje. El CHECK unifica en los ocho, y esa union es justamente el
  -- tipo de defecto que una columna caza y una clave JSON no.
  nivel TEXT NOT NULL CHECK (nivel IN (
    'tecnico','tecnologo','grado','maestria','maestria_tecnologica','diplomado','doctorado','posdoctorado'
  )),
  -- LA MODALIDAD DE ESTUDIO. En el JSON esta clave se llama "tipo" y el formulario la etiqueta
  -- "Modalidad" (AgregarTitulo.vue:62): el nombre de la clave y el de la cosa no coincidian. Se
  -- renombra al pasar a columna, porque "tipo" a secas ya significa otra cosa en seis de las diez
  -- secciones y tener el mismo nombre para ejes distintos es como se llega a un modelo ilegible.
  modalidad TEXT NOT NULL DEFAULT 'presencial'
    CHECK (modalidad IN ('presencial','semipresencial','virtual','hibrido')),
  -- EL NUMERO DE REGISTRO ante la autoridad de educacion superior (en Ecuador, la SENESCYT). Texto,
  -- porque su formato lo fija cada pais y aqui el catalogo ya es internacional.
  sreg VARCHAR(60) NULL,
  -- EL CAMPO AMPLIO CINE-F. Nulo mientras no se conozca: hoy es texto libre y la mitad de los
  -- asientos de semilla lo traen vacio.
  campo_amplio_id INT NULL,
  CONSTRAINT fk_dossier_titulos_item FOREIGN KEY (id) REFERENCES expediente_asientos(id) ON DELETE CASCADE,
  CONSTRAINT fk_dossier_titulos_titulacion FOREIGN KEY (titulacion_id) REFERENCES titulaciones(id),
  CONSTRAINT fk_dossier_titulos_pais FOREIGN KEY (pais_id) REFERENCES paises(id),
  CONSTRAINT fk_dossier_titulos_campo FOREIGN KEY (campo_amplio_id) REFERENCES campos_amplios(id),
  -- Una de las dos, y al menos una: sin esto la valvula de escape se convierte en un agujero por el
  -- que entran titulos sin nombre de ninguna clase.
  CONSTRAINT chk_dossier_titulos_titulacion CHECK (titulacion_id IS NOT NULL OR titulacion_libre IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_dossier_titulos_titulacion ON expediente_titulos (titulacion_id);
CREATE INDEX IF NOT EXISTS idx_dossier_titulos_pais ON expediente_titulos (pais_id);
CREATE INDEX IF NOT EXISTS idx_dossier_titulos_campo ON expediente_titulos (campo_amplio_id);


-- ── 2/10 · FORMACION CONTINUA ────────────────────────────────────────────────────────────────────
-- Cursos y eventos de capacitacion. El formulario que la alimenta se llama AgregarCapacitacion.vue
-- y la seccion se llama "formacion": se conserva el nombre de la seccion, que es el que viaja en
-- section y en la ruta del frontend.
CREATE TABLE IF NOT EXISTS expediente_formacion (
  id BIGINT NOT NULL PRIMARY KEY,
  tema VARCHAR(250) NOT NULL,
  institucion VARCHAR(200) NOT NULL,
  pais_id INT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'docente' CHECK (tipo IN ('docente','profesional')),
  -- EN CALIDAD DE QUE se asistio. No es lo mismo haber dictado un curso que haberlo aprobado, y hoy
  -- las tres cosas caen en la misma lista sin que nada distinga una de otra al consultar.
  rol TEXT NOT NULL DEFAULT 'asistencia' CHECK (rol IN ('asistencia','instructor','aprobacion')),
  -- FECHAS DE VERDAD, no cadenas. El formulario ya construye un Date y el JSON lo guardaba
  -- serializado, asi que ordenar por fecha era ordenar texto: funcionaba de milagro mientras el
  -- formato no cambiara, y comparar rangos no funcionaba en absoluto.
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NULL,
  -- Horas de duracion. INT y no texto: es lo que se suma para acreditar formacion continua.
  horas INT NULL CHECK (horas IS NULL OR horas >= 0),
  CONSTRAINT fk_dossier_formacion_item FOREIGN KEY (id) REFERENCES expediente_asientos(id) ON DELETE CASCADE,
  CONSTRAINT fk_dossier_formacion_pais FOREIGN KEY (pais_id) REFERENCES paises(id),
  -- Un curso no puede acabar antes de empezar. Es el tipo de invariante que el JSONB no podia ni
  -- enunciar.
  CONSTRAINT chk_dossier_formacion_fechas CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
);
CREATE INDEX IF NOT EXISTS idx_dossier_formacion_pais ON expediente_formacion (pais_id);


-- ── 3/10 · EXPERIENCIA ───────────────────────────────────────────────────────────────────────────
-- La UNICA de las diez secciones con un valor no escalar, y es lo que decidio que ninguna es
-- inviable: funcion_catedra era un array y pasa a tabla hija (mas abajo).
CREATE TABLE IF NOT EXISTS expediente_experiencia (
  id BIGINT NOT NULL PRIMARY KEY,
  tipo TEXT NOT NULL DEFAULT 'docencia' CHECK (tipo IN ('docencia','profesional')),
  institucion VARCHAR(200) NOT NULL,
  modalidad TEXT NOT NULL DEFAULT 'presencial'
    CHECK (modalidad IN ('presencial','semipresencial','virtual','hibrido')),
  fecha_inicio DATE NOT NULL,
  -- NULA significa "sigue en el puesto", que es la lectura habitual de un fin abierto en este
  -- esquema (position_assignments y contracts hacen lo mismo).
  fecha_fin DATE NULL,
  CONSTRAINT fk_dossier_experiencia_item FOREIGN KEY (id) REFERENCES expediente_asientos(id) ON DELETE CASCADE,
  CONSTRAINT chk_dossier_experiencia_fechas CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
);


-- ── 4/10 · REFERENCIAS ───────────────────────────────────────────────────────────────────────────
-- DATOS DE UN TERCERO, y por eso esta tabla importa mas de lo que su tamaño sugiere: guarda nombre,
-- correo y telefono de alguien que NO es el titular del expediente y que nunca acepto nada aqui.
-- En un blob JSON esos datos no son localizables ni borrables uno a uno; en columnas si, que es lo
-- que el frente 17 (LOPDP) necesita poder hacer.
CREATE TABLE IF NOT EXISTS expediente_referencias (
  id BIGINT NOT NULL PRIMARY KEY,
  nombre VARCHAR(180) NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'laboral' CHECK (tipo IN ('laboral','personal','familiar')),
  -- UNA SOLA COLUMNA PARA DOS COSAS, y se conserva a proposito: si la referencia es laboral, el
  -- cargo; si es personal o familiar, el parentesco. Partirla en dos daria una columna siempre nula
  -- segun el tipo. El nombre compuesto es feo y es honesto.
  cargo_parentesco VARCHAR(180) NULL,
  -- ERRATA CORREGIDA. En el JSON esta clave se llama "institution", en ingles, rodeada de nueve
  -- claves en español. Nadie lo vio porque una clave JSON no se declara en ningun sitio.
  institucion VARCHAR(200) NULL,
  email VARCHAR(180) NULL,
  telefono VARCHAR(40) NULL,
  CONSTRAINT fk_dossier_referencias_item FOREIGN KEY (id) REFERENCES expediente_asientos(id) ON DELETE CASCADE
);


-- ── 5/10 · CERTIFICACIONES ───────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expediente_certificaciones (
  id BIGINT NOT NULL PRIMARY KEY,
  titulo VARCHAR(250) NOT NULL,
  institucion VARCHAR(200) NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'nacional' CHECK (tipo IN ('nacional','internacional')),
  descripcion TEXT NULL,
  fecha DATE NULL,
  horas INT NULL CHECK (horas IS NULL OR horas >= 0),
  CONSTRAINT fk_dossier_certificaciones_item FOREIGN KEY (id) REFERENCES expediente_asientos(id) ON DELETE CASCADE
);


-- ── 6/10 · ARTICULOS ─────────────────────────────────────────────────────────────────────────────
-- Primera de las CINCO de produccion academica. Y hay que decirlo aqui porque la documentacion las
-- agrupo mal: NO SON POLIMORFICAS. AgregarInvestigacion.vue tiene cinco bloques hermanos bajo
-- v-if="form.tipoProduccion === ...", cada uno con su lista de campos cerrada y casi disjunta. Lo
-- polimorfico es el formulario, no los datos. Se agruparon por como se pintan, no por como son.
CREATE TABLE IF NOT EXISTS expediente_articulos (
  id BIGINT NOT NULL PRIMARY KEY,
  titulo VARCHAR(300) NOT NULL,
  revista VARCHAR(250) NOT NULL,
  -- La base donde esta indexada (Scopus, Web of Science, Latindex...). Texto libre hoy; es
  -- candidata a catalogo el dia que alguien quiera contar por base, no antes.
  base_indexada VARCHAR(120) NULL,
  doi VARCHAR(180) NULL,
  issn VARCHAR(20) NULL,
  -- El cuartil/indice SJR de la revista. NUMERIC y no texto: se ordena y se promedia.
  sjr NUMERIC(6,3) NULL CHECK (sjr IS NULL OR sjr >= 0),
  estado TEXT NOT NULL DEFAULT 'aceptado' CHECK (estado IN ('aceptado','publicado')),
  rol TEXT NOT NULL DEFAULT 'autor' CHECK (rol IN ('autor','coautor','revisor')),
  fecha DATE NULL,
  CONSTRAINT fk_dossier_articulos_item FOREIGN KEY (id) REFERENCES expediente_asientos(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_dossier_articulos_doi ON expediente_articulos (doi);


-- ── 7/10 · LIBROS Y CAPITULOS ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expediente_libros (
  id BIGINT NOT NULL PRIMARY KEY,
  titulo VARCHAR(300) NOT NULL,
  editorial VARCHAR(200) NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'libro' CHECK (tipo IN ('libro','capitulo')),
  isbn VARCHAR(20) NULL,
  -- ERRATA CORREGIDA, y es el defecto que mas tiempo llevaba escondido. La clave JSON se llama
  -- "isnn" —ene ene— y asi sale la etiqueta en el formulario y en la cabecera de la tabla, mientras
  -- la seccion de articulos guarda "issn", que es lo correcto. Dos secciones, dos nombres, el mismo
  -- identificador internacional de publicaciones seriadas.
  --
  -- Escribir el DDL lo habria cazado el primer dia: dos columnas casi homonimas en tablas hermanas
  -- saltan a la vista. Dos claves dentro de un JSONB, no: nadie las ve juntas nunca.
  issn VARCHAR(20) NULL,
  -- SIN Ñ. La clave JSON se llama literalmente "año": el formulario guarda anio y lo traduce al
  -- enviar (AgregarInvestigacion.vue:455). Mapea bien y no es un fallo, pero como nombre de columna
  -- seria inaceptable — y la traduccion desaparece con el JSON.
  anio SMALLINT NULL CHECK (anio IS NULL OR anio BETWEEN 1900 AND 2200),
  CONSTRAINT fk_dossier_libros_item FOREIGN KEY (id) REFERENCES expediente_asientos(id) ON DELETE CASCADE
);


-- ── 8/10 · PONENCIAS ─────────────────────────────────────────────────────────────────────────────
-- La seccion mas pequeña de las diez: tres campos.
CREATE TABLE IF NOT EXISTS expediente_ponencias (
  id BIGINT NOT NULL PRIMARY KEY,
  titulo VARCHAR(300) NOT NULL,
  evento VARCHAR(250) NOT NULL,
  anio SMALLINT NULL CHECK (anio IS NULL OR anio BETWEEN 1900 AND 2200),
  CONSTRAINT fk_dossier_ponencias_item FOREIGN KEY (id) REFERENCES expediente_asientos(id) ON DELETE CASCADE
);


-- ── 9/10 · TESIS DIRIGIDAS ───────────────────────────────────────────────────────────────────────
-- Tesis en las que la persona participo COMO ASESOR O REVISOR, no la suya: la suya es un titulo.
-- Por eso rol no tiene valor "autor" y nivel es el nivel del programa, no el de quien lo dirige.
CREATE TABLE IF NOT EXISTS expediente_tesis (
  id BIGINT NOT NULL PRIMARY KEY,
  tema VARCHAR(300) NOT NULL,
  ies VARCHAR(200) NOT NULL,
  programa VARCHAR(200) NULL,
  -- Mismo vocabulario que expediente_titulos.nivel, y el mismo CHECK a proposito: es el mismo eje.
  -- Que las dos listas del frontend no coincidan (ver expediente_titulos.nivel) es el defecto, no la
  -- coincidencia.
  nivel TEXT NOT NULL DEFAULT 'grado' CHECK (nivel IN (
    'tecnico','tecnologo','grado','maestria','maestria_tecnologica','diplomado','doctorado','posdoctorado'
  )),
  rol TEXT NOT NULL DEFAULT 'asesor' CHECK (rol IN ('asesor','revisor')),
  anio SMALLINT NULL CHECK (anio IS NULL OR anio BETWEEN 1900 AND 2200),
  CONSTRAINT fk_dossier_tesis_item FOREIGN KEY (id) REFERENCES expediente_asientos(id) ON DELETE CASCADE
);


-- ── 10/10 · PROYECTOS ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expediente_proyectos (
  id BIGINT NOT NULL PRIMARY KEY,
  tema VARCHAR(300) NOT NULL,
  institucion VARCHAR(200) NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'investigacion' CHECK (tipo IN ('investigacion','vinculacion')),
  -- El programa o grupo de investigacion al que pertenece. La clave JSON se llama "programa_group",
  -- mitad en español y mitad en ingles; se conserva el nombre porque partirlo o traducirlo a medias
  -- seria peor, pero queda anotado como lo que es.
  programa_group VARCHAR(200) NULL,
  inicio DATE NULL,
  fin DATE NULL,
  -- Porcentaje de avance, 0 a 100. El JSON aceptaba 350 sin inmutarse.
  avance NUMERIC(5,2) NULL CHECK (avance IS NULL OR (avance >= 0 AND avance <= 100)),
  -- NUMERIC y NUNCA float: es dinero. El JSON lo guardaba como numero de JavaScript, que es un
  -- doble binario y no representa exactamente ni 0,1.
  presupuesto NUMERIC(14,2) NULL CHECK (presupuesto IS NULL OR presupuesto >= 0),
  CONSTRAINT fk_dossier_proyectos_item FOREIGN KEY (id) REFERENCES expediente_asientos(id) ON DELETE CASCADE,
  CONSTRAINT chk_dossier_proyectos_fechas CHECK (fin IS NULL OR inicio IS NULL OR fin >= inicio)
);
```

### 8.3 · La hija del 1:N: `expediente_experiencia_funciones`

```sql
-- ── LAS CATEDRAS Y FUNCIONES DE UNA EXPERIENCIA ──────────────────────────────────────────────────
-- El unico valor no escalar de las diez secciones. Hoy es un array dentro del JSON, construido
-- partiendo un textarea por comas (AgregarExperiencia.vue:223).
--
-- NO ES UN OBSTACULO PARA SALIR DEL JSONB: ES LA MEJORA MAS DIRECTA DEL FRENTE. Con el array
-- guardado dentro del blob, la pregunta "quien ha dado Bases de datos" no se puede hacer — hay que
-- leer todos los expedientes enteros y filtrar en JavaScript. Con la tabla hija es un WHERE.
--
-- Y ojo: el esquema tiene CERO columnas de tipo array. Meter el primero aqui, para el unico caso
-- que hay, seria estrenar un idioma nuevo para no escribir seis lineas.
CREATE TABLE IF NOT EXISTS expediente_experiencia_funciones (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  experiencia_id BIGINT NOT NULL,
  nombre VARCHAR(200) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_dossier_exp_funciones_exp FOREIGN KEY (experiencia_id) REFERENCES expediente_experiencia(id) ON DELETE CASCADE
);
-- La misma catedra no se repite dentro de la misma experiencia. Hoy si puede: partir por comas un
-- texto escrito a mano produce duplicados con solo teclear una coma de mas.
CREATE UNIQUE INDEX IF NOT EXISTS uq_dossier_exp_funciones ON expediente_experiencia_funciones (experiencia_id, nombre);
CREATE INDEX IF NOT EXISTS idx_dossier_exp_funciones_nombre ON expediente_experiencia_funciones (nombre);
```

⚠️ **La cascada aquí tiene dos aristas**: `expediente_asientos` → `expediente_experiencia` →
`expediente_experiencia_funciones`. Es la misma profundidad máxima que ya tiene el esquema (`tasks` →
`task_items` → flujos), así que no estrena nada.

### 8.4 · El catálogo académico

Cinco tablas encadenadas. **Las tres de arriba son la norma internacional CINE-F (ISCED-F) de la
UNESCO y NO llevan país**; las dos de abajo las fija cada país y **sí lo llevan**.

⚠️ **Estas tablas van ANTES que `expediente_titulos` en `postgres_schema.sql`**, y sus datos los siembra
el bootstrap, no este fichero: son cientos de filas y aquí sólo hay cuatro `INSERT`, todos de
vocabularios de ocho filas o menos. Es el mismo trato que recibe la geografía.

```sql
-- ── CATALOGO ACADEMICO: CINE-F ───────────────────────────────────────────────────────────────────
-- Campo amplio -> especifico -> detallado -> carrera -> titulacion.
--
-- POR QUE LAS TRES DE ARRIBA NO LLEVAN PAIS. Son la Clasificacion Internacional Normalizada de la
-- Educacion por campos (CINE-F / ISCED-F) de la UNESCO: codigos estables y comparables entre
-- paises. Es exactamente lo que le sirve a una universidad que homologa titulos extranjeros —
-- ponerles pais las volveria incomparables, que es lo contrario de para lo que existen.
--
-- POR QUE LAS DOS DE ABAJO SI. Las carreras y las titulaciones las fija cada pais (en Ecuador, el
-- CES) y no tienen equivalente internacional. Con pais_id, si la institucion es ecuatoriana se
-- ofrecen las titulaciones del Ecuador, y mañana entra el catalogo de otro pais sin rediseñar nada.
--
-- LOS DATOS NO SALEN DEL FICHERO QUE HAY. campos_titulos.json tiene 38 campos amplios y el CINE-F
-- TIENE DIEZ: los nombres que ocupaban dos lineas en la tabla del PDF de origen se partieron en
-- filas separadas. La causa esta en el origen — la resolucion RPC-SO-27-No.289-2014 del CES, 79
-- paginas, es un escaneo con OCR malo—, y por eso la tarea E1 va antes que esta.
CREATE TABLE IF NOT EXISTS campos_amplios (
  id INT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  -- Codigo CINE-F de dos digitos, con su cero a la izquierda: por eso VARCHAR y no INT. "06" no es
  -- el numero seis.
  codigo VARCHAR(2) NOT NULL UNIQUE,
  nombre VARCHAR(180) NOT NULL,
  is_active SMALLINT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE OR REPLACE TRIGGER trg_campos_amplios_set_updated_at BEFORE UPDATE ON campos_amplios FOR EACH ROW EXECUTE FUNCTION set_updated_at();


CREATE TABLE IF NOT EXISTS campos_especificos (
  id INT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  campo_amplio_id INT NOT NULL,
  -- Tres digitos, y los dos primeros son los del campo amplio. La jerarquia esta EN EL CODIGO, pero
  -- la clave ajena se declara igual: un codigo que se explica solo sigue sin impedir que alguien
  -- cuelgue "031" de otro campo amplio.
  codigo VARCHAR(3) NOT NULL UNIQUE,
  nombre VARCHAR(180) NOT NULL,
  is_active SMALLINT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_campos_especificos_amplio FOREIGN KEY (campo_amplio_id) REFERENCES campos_amplios(id)
);
CREATE INDEX IF NOT EXISTS idx_campos_especificos_amplio ON campos_especificos (campo_amplio_id);
CREATE OR REPLACE TRIGGER trg_campos_especificos_set_updated_at BEFORE UPDATE ON campos_especificos FOR EACH ROW EXECUTE FUNCTION set_updated_at();


CREATE TABLE IF NOT EXISTS campos_detallados (
  id INT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  campo_especifico_id INT NOT NULL,
  codigo VARCHAR(4) NOT NULL UNIQUE,
  nombre VARCHAR(180) NOT NULL,
  is_active SMALLINT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_campos_detallados_especifico FOREIGN KEY (campo_especifico_id) REFERENCES campos_especificos(id)
);
CREATE INDEX IF NOT EXISTS idx_campos_detallados_especifico ON campos_detallados (campo_especifico_id);
CREATE OR REPLACE TRIGGER trg_campos_detallados_set_updated_at BEFORE UPDATE ON campos_detallados FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- LA CARRERA: la oferta academica tal como la aprueba la autoridad de cada pais.
CREATE TABLE IF NOT EXISTS carreras (
  id INT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  pais_id INT NOT NULL,
  -- El enganche con la norma internacional. NULO se admite porque la fuente ecuatoriana puede no
  -- traer el campo detallado de todas: es preferible una carrera sin clasificar a no tenerla.
  campo_detallado_id INT NULL,
  nombre VARCHAR(250) NOT NULL,
  is_active SMALLINT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_carreras_pais FOREIGN KEY (pais_id) REFERENCES paises(id),
  CONSTRAINT fk_carreras_campo FOREIGN KEY (campo_detallado_id) REFERENCES campos_detallados(id)
);
-- La unicidad de una carrera es (pais, nombre), NUNCA el nombre: dos paises pueden llamar igual a
-- carreras distintas, y es el mismo criterio con el que ciudades se hace unica por (provincia,
-- nombre) porque hay un canton Bolivar en Carchi y otro en Manabi.
CREATE UNIQUE INDEX IF NOT EXISTS uq_carreras_pais_nombre ON carreras (pais_id, nombre);
CREATE INDEX IF NOT EXISTS idx_carreras_campo ON carreras (campo_detallado_id);
CREATE OR REPLACE TRIGGER trg_carreras_set_updated_at BEFORE UPDATE ON carreras FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- LA TITULACION: el nombre exacto que aparece impreso en el diploma. No es lo mismo que la carrera
-- —una carrera puede otorgar mas de una— y es lo que el titular escribe en su expediente.
CREATE TABLE IF NOT EXISTS titulaciones (
  id INT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  pais_id INT NOT NULL,
  carrera_id INT NOT NULL,
  nombre VARCHAR(250) NOT NULL,
  is_active SMALLINT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_titulaciones_pais FOREIGN KEY (pais_id) REFERENCES paises(id),
  CONSTRAINT fk_titulaciones_carrera FOREIGN KEY (carrera_id) REFERENCES carreras(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_titulaciones_pais_nombre ON titulaciones (pais_id, nombre);
CREATE INDEX IF NOT EXISTS idx_titulaciones_carrera ON titulaciones (carrera_id);
CREATE OR REPLACE TRIGGER trg_titulaciones_set_updated_at BEFORE UPDATE ON titulaciones FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

### 8.5 · La vista `expediente_investigacion`

```sql
-- ── LA PESTAÑA DE INVESTIGACION, EN SQL ──────────────────────────────────────────────────────────
-- Las cinco secciones de produccion academica, unidas. Hoy esta union la hace JavaScript:
-- InvestigacionSection.vue reparte con rowsFor: (records, tab) => records?.[tab] ?? [], sobre un
-- arbol que el backend ya construyo leyendo todos los asientos de la persona.
--
-- ESTA VISTA NO SUSTITUYE A LA ESPINA, LA COMPLEMENTA. Una vista no admite clave ajena: si el
-- modelo fuera cinco tablas sueltas mas esta vista, nada podria apuntar a un asiento de
-- investigacion. La espina es lo que da esa identidad; la vista solo evita repetir cinco UNION en
-- cada consulta.
--
-- Es de SOLO LECTURA a proposito. Se podria hacer escribible con triggers INSTEAD OF, y seria un
-- error: dejaria dos caminos para insertar lo mismo y el segundo se saltaria los CHECK de la tabla.
CREATE OR REPLACE VIEW expediente_investigacion AS
  SELECT i.id, i.person_id, i.section AS tipo_produccion, i.estado_revision,
         i.documento_ref, i.created_at,
         a.titulo,
         EXTRACT(YEAR FROM a.fecha)::SMALLINT AS anio,
         a.revista AS entidad,
         a.rol
    FROM expediente_asientos i
    JOIN expediente_articulos a ON a.id = i.id
  UNION ALL
  SELECT i.id, i.person_id, i.section, i.estado_revision,
         i.documento_ref, i.created_at,
         l.titulo, l.anio, l.editorial, NULL
    FROM expediente_asientos i
    JOIN expediente_libros l ON l.id = i.id
  UNION ALL
  SELECT i.id, i.person_id, i.section, i.estado_revision,
         i.documento_ref, i.created_at,
         p.titulo, p.anio, p.evento, NULL
    FROM expediente_asientos i
    JOIN expediente_ponencias p ON p.id = i.id
  UNION ALL
  -- En tesis y proyectos lo que hace de titulo es el tema: no tienen columna titulo, y forzarles una
  -- para que la vista quede simetrica seria doblar el modelo por comodidad de una consulta.
  SELECT i.id, i.person_id, i.section, i.estado_revision,
         i.documento_ref, i.created_at,
         t.tema, t.anio, t.ies, t.rol
    FROM expediente_asientos i
    JOIN expediente_tesis t ON t.id = i.id
  UNION ALL
  SELECT i.id, i.person_id, i.section, i.estado_revision,
         i.documento_ref, i.created_at,
         y.tema,
         EXTRACT(YEAR FROM y.inicio)::SMALLINT,
         y.institucion, NULL
    FROM expediente_asientos i
    JOIN expediente_proyectos y ON y.id = i.id;
```

⚠️ **`entidad` es una columna de conveniencia y no debe usarse para nada más que pintar la tabla.**
Une cosas que no son la misma —una revista, una editorial, un evento, una universidad, una
institución financiadora— y sólo tiene sentido porque en la pestaña ocupan la misma casilla. Agrupar
por ella sería contar revistas y editoriales juntas.

### 8.6 · El recuento

| | |
|---|---:|
| Tablas nuevas | **17** (1 espina + 10 secciones + 1 hija + 5 catálogo) |
| Vistas nuevas | 1 |
| Columnas en total | **121** |
| Claves ajenas nuevas | **22** |
| Índices declarados | 14 |
| Restricciones `CHECK` | **28** — hoy hay **0** en el expediente |
| Triggers `set_updated_at()` | 6 |
| Columnas JSONB que quedan en el expediente | **0** |

**`dossiers` se RETIRA** (ver §2.7). `expediente_asientos` se reescribe: pierde `data` y `url_documento`, gana
`estado_revision`, `documento_ref`, `documento_subido_at`, `updated_at`, el `CHECK` de `section` y su
trigger.

### 8.7 · Lo que este diseño decidió y el plan no decía

Tres cosas que hubo que resolver al escribir el DDL. **Se listan aparte porque no son decisiones del
dueño todavía**, y cualquiera de las tres puede revertirse sin tocar el resto.

| | Qué se hizo | Por qué, y qué se pierde si se revierte |
|---|---|---|
| **`sera` → `estado_revision` en la espina** | Columna nueva en `expediente_asientos`, con `CHECK` de cuatro valores | No estaba en las listas de §2.1 porque **no es de una sección: es de las diez**. Lo escriben los seis formularios, lo pinta la primera columna de las seis tablas y lo interpreta `dossierStatus.js`. Si no se recoge, al morir el JSONB el dato se pierde y la insignia se queda en «pendiente» para siempre |
| **`titulos.tipo` → `modalidad`** | Renombrada | La clave se llamaba `tipo` y el formulario la etiquetaba «Modalidad». `tipo` ya significa otra cosa en seis de las diez secciones |
| **Vocabularios en minúscula y sin tildes** | `nivel`, `modalidad`, `rol`, `estado`, `tipo` | El esquema no usa tildes en sus literales. La etiqueta con tildes es del frontend. **Obliga a que `E8` traduzca al migrar**, y ése es el coste |

Y una que **queda abierta y afecta a `E1`**: `titulaciones.carrera_id` se declara `NOT NULL`. Si la
fuente ecuatoriana que se localice en `E1` trae titulaciones sin carrera asociada, hay que aflojarlo
a `NULL` **antes** de sembrar — y en este esquema, sin `ALTER`, aflojarlo después no es gratis.
