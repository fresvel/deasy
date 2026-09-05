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
| **E0** | Este plan, con las decisiones de diseño tomadas y medidas | 🟡 | **El dueño está revisando y NO lo ha aprobado.** Escrito: §8 completo (19 tablas · 142 col · 24 FK · 28 `CHECK`, contadas del DDL) y publicado en `/complemento/expediente/`; los descartes y sus mediciones, en §7 y §8.7. **Cierra el día que el dueño lo apruebe, no antes** | |
| **E1** | El catálogo CINE-F y el nacional: fuentes localizadas y evaluadas | ✅ | `cine-f-2013-es.csv`, 220 filas, jerarquía cerrada sin huérfanos, doblemente validada. Y el anexo del CES: **no era un escaneo** (`pdfinfo` → Word 2010), la capa de texto está íntegra y las tablas se extraen limpias — lo que rompía los datos eran las celdas fusionadas | 2026-09-04 |
| **E2** | Las **siete** tablas del catálogo académico, sembradas por el bootstrap | ⬜ | Pendiente: el extractor por geometría de celda, y resolver las **2** colisiones de la forma canónica | |
| **E3** | El esquema del expediente: espina + 10 subtipos + la hija del 1:N, y **`dossiers` retirada** | ⬜ | | |
| **E4** | `dossierStore` deja de hablar JSON y habla SQL | ⬜ | | |
| **E5** | `url_documento` pasa a `documento_ref` con la convención `minio://` | ⬜ | | |
| **E6** | La vista de investigación (`UNION ALL` de las cinco) | ⬜ | | |
| **E7** | El frontend: los seis formularios contra el modelo nuevo | ⬜ | | |
| **E8** | Migración de los datos existentes, con su script | ⬜ | | |
| **E9** | Muere la lista de países duplicada del frontend (§9) | ⬜ | Decidido por el dueño el 2026-09-05. Va **después de E7** | |

**10 tareas.** `E1` es la primera porque condiciona `E2` y `E3`: sin saber qué catálogo entra, no se
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

Ganó la segunda, con un `CHECK` que exigía una de las dos.

> ⚠️ **SUPERADO el 2026-09-04, y la conclusión era la equivocada.** El razonamiento de la tabla es
> correcto —una fila «NR» pierde el nombre real— pero la salida no era una columna de texto:
>
> 1. **No existe el título imposible de clasificar.** La CINE-F trae comodines **en el nivel
>    detallado**: 10 `xx10` *sin mayor definición*, 10 `xx19` *no contemplado*, 10 `xx88`
>    *interdisciplinarios* y el `9999 Campo desconocido`.
> 2. **El nombre no necesitaba una columna paralela, necesitaba una FILA.** En texto libre no se
>    puede cotejar, ni agregar, ni deduplicar: es un segundo almacén del mismo hecho, invisible para
>    toda consulta que mire el catálogo.
>
> Así que `titulacion_libre` **se retira** y `titulacion_id` pasa a `NOT NULL`. El título que falta
> **se da de alta** con `origen = 'registro_local'`, pasando por el cotejo de duplicados. Diseño
> vigente en `docs/src/content/docs/complemento/expediente.md` §4.

### 3.5 · La divergencia CES/CINE-F: catálogo internacional + catálogo nacional + equivalencias

**Decisión del dueño, 2026-09-04.** Se evaluaron tres salidas y gana la que permite llegar a la norma
internacional sin forzar los catálogos nacionales.

#### Lo medido, que es lo que obliga a decidir

| Nivel | ¿Coinciden CES y CINE-F? |
|---|---|
| Campo amplio | ✅ **Idénticos**: los diez nombres del CES son literalmente las etiquetas españolas del CINE-F, y su código `01`–`10` **es** el código CINE de dos dígitos |
| Campo específico | 🟡 **20 de 21**; sólo falla `Humanidades` (el CINE dice `Humanidades (excepto idiomas)`) |
| Campo detallado | ❌ **Diverge**: el CES fusiona (`Diseño` vs `0212 Diseño de moda, interiores e industrial`), renombra (`Filosofía` vs `0223 Filosofía y ética`) y **añade códigos propios** (`81`, `82`: «Estudios de género») |

Y un detalle técnico que lo agrava: **el Anexo del CES no lleva el código CINE de 3 ni 4 dígitos**.
Sus columnas de específico y detallado se numeran **ordinalmente dentro del padre** (`1`, `2`, `3`… /
`A`, `B`, `C`…), así que el enlace hay que construirlo **por nombre**.

#### La norma YA trae los «desconocidos», y por campo amplio

Esto no había que inventarlo. De los 150 detallados del CINE-F, **70 son comodines de la propia
norma**, en tres familias:

| Familia | n | Para qué |
|---|---:|---|
| `xx10 · sin mayor definición` | 41 | Se sabe el campo pero no se puede afinar |
| **`xx19 · no contemplado en la clasificación`** | **35** | **Existe en el catálogo nacional y NO en el CINE-F** |
| `xx88 · interdisciplinarios` | 21 | Cruza varios campos |

Más `99 / 999 / 9999 Campo desconocido`, en los tres niveles.

⚠️ **La familia `xx19` es exactamente el caso que había que resolver, y es mejor que un «desconocido»
global**: `Estudios de género` del CES no cae en un agujero negro, cae en
`0319 Ciencias sociales y del comportamiento no contempladas en la clasificación` — se conserva el
campo amplio y el específico, y sólo se pierde el detalle. La norma ya pensó en esto.

> ⚠️ **SUPERADO el 2026-09-04.** Lo que sigue en este apartado —la tabla `campo_equivalencias`
> N:M con su columna `grado`, y `pais_id` en las tres capas de la CINE-F— **ya no es el diseño**.
> Se descartó al aclararse que **hay un solo catálogo nacional: el del país donde funciona la
> institución que instala Deasy** (`instituciones.pais_id`), y que el anclaje a la norma es una
> clave ajena 1:N en `campos_nacionales`, porque los comodines `xx10`/`xx19` de la propia CINE-F
> ya codifican el grado de la equivalencia. El diseño vigente está en
> `docs/src/content/docs/complemento/expediente.md` §4; §8 de este plan se reescribe con él.

#### El diseño: tres piezas

```
campos_amplios · campos_especificos · campos_detallados     ← CINE-F puro. SIN pais_id
        ▲                                                     norma internacional, 220 filas
        │  campo_equivalencias  (N:M, con grado)
        │
campos_nacionales  (CON pais_id)  ──→  carreras  ──→  titulaciones
        Ecuador hoy; otro país mañana, sin rediseñar nada
```

**Por qué N:M y no una simple clave ajena.** Porque las dos direcciones ocurren, y el dueño lo
anticipó: `0212 Diseño de moda, interiores e industrial` del CINE puede corresponder a **tres**
campos nacionales distintos (N:1), y un campo nacional amplio puede abarcar **dos** del CINE (1:N).
Una columna no lo expresa; una tabla de equivalencias sí.

**Y lleva el grado, porque no todas las equivalencias son iguales**: `exacta` (mismo concepto,
distinto nombre), `contenida` (el nacional es más estrecho), `amplia` (es más ancho), `sin_equivalente`
(cae en el `xx19` de su campo amplio). Sin ese grado, un informe que agregue por campo CINE trataría
igual una correspondencia perfecta y una aproximación.

#### Lo que se gana

- **Se llega al CINE-F**, que es lo que permite comparar con cualquier país y homologar un título
  extranjero.
- **Ningún catálogo nacional se fuerza**: el CES entra tal como el CES lo publica, con sus códigos
  `81` y `82` incluidos.
- **Otro país entra sin rediseñar**: es una fila más de `pais_id` en `campos_nacionales` y sus
  equivalencias.
- La equivalencia es **dato, no código**: corregir un mapeo es un `UPDATE`, no un despliegue.

#### Lo que cuesta, dicho

Construir las equivalencias de los ~627 detallados del CES **es trabajo manual**, y no todo se puede
automatizar: por nombre casan los dos primeros niveles, el tercero no. Se puede hacer por partes —
sembrar primero lo que casa por nombre, y dejar el resto en `sin_equivalente` hasta que alguien lo
revise—, pero no sale gratis. **Es el precio de no fingir una equivalencia que no existe.**

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

**Tres cerradas el 2026-09-04**, con lo que las cerró:

| Cerrada | Cómo |
|---|---|
| ~~**El CES diverge del CINE-F en el nivel detallado**~~ | El anclaje 1:N en `campos_nacionales.campo_detallado_id`, porque los comodines `xx10`/`xx19`/`9999` de la norma **ya codifican el grado** de la equivalencia. Muere la tabla N:M (§8.4) |
| ~~**El extractor del Anexo**~~ | **La fuente NO es un escaneo**: `pdfinfo` dice Word 2010, la capa de texto está íntegra y las tablas se extraen limpias. Lo que rompía los datos son las **celdas fusionadas** con un extractor por bandas, no el OCR |
| ~~**`titulaciones.carrera_id` se declaró `NOT NULL`**~~ | La extracción da la estructura anidada `carrera → titulaciones`: **no hay ni una titulación suelta**. Se queda `NOT NULL` |

**Y las que siguen abiertas:**

| | |
|---|---|
| **El Anexo II 2023, ¿sigue vigente?** | Firmado en abril de 2023. Existe referencia a `RPC-SO-03-No.047-2024` («Refórmese el Reglamento de armonización…») que **no se pudo leer**: vLex la tiene tras muro de pago y la Gaceta del CES exige sesión. Puede haber altas posteriores |
| **Los niveles superiores del catálogo nacional** | `campos_nacionales` es plano y ancla en el detallado, así que los niveles amplio y específico **se deducen** subiendo por la CINE-F. Correcto mientras el país adopte los dos de arriba —Ecuador lo hace, y en el nivel específico está medido: 20 casan literalmente—. Si alguno divergiera arriba, la salida son tres tablas nacionales simétricas |
| **Quién puede dar de alta en el catálogo** | Al retirarse `titulacion_libre`, el título que falta **se crea**. Y el catálogo oficial **ya trae duplicados** —`Especialista en …… (especificar la mención)` aparece dos veces, una con un paréntesis de más—, así que el cotejo hace falta para sembrar y no sólo para las altas de usuario. Falta decidir si un usuario cualquiera crea, o propone y un gestor aprueba |
| **Generar el CV** | Anotado como consecuencia deseable, sin decidir si entra en este frente |
| **`ies` → `units`** | Sólo vale para instituciones internas; falta decidir qué se hace con las externas |

---

## 8 · El esquema, completo

> ⚠️ **PARTES DE ESTA SECCION ESTAN SUPERADAS desde el 2026-09-04.** El diseño vigente del
> **catalogo academico** (8.4) y de `expediente_titulos` se acordo despues de escribir esto y vive en
> `docs/src/content/docs/complemento/expediente.md` §4. Lo que cambio: **un solo catalogo nacional**
> (el del pais de `instituciones.pais_id`), el anclaje a la norma como columna 1:N en
> `campos_nacionales.campo_detallado_id`, `campos_nacionales` como tabla nueva, el **nivel en
> `carreras`** (hoy `nivel_id`, al catálogo `niveles_academicos`) con la unicidad en
> `(pais_id, nivel_id, nombre_norm)`, `origen` en tres tablas,
> `vigente_hasta`, `nombre_norm` como columna GENERADA y el cotejo de duplicados en tres capas.
> **El bloque de `expediente_titulos` de abajo YA esta reescrito; el 8.4 todavia NO.**


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
-- habia catalogo (pais, titulo, campo) y una era un vocabulario cerrado sin ninguna defensa.
--
-- SEIS COLUMNAS, y las cinco que no son la clave son de ESTA PERSONA, no de la titulacion: en que
-- universidad la curso, donde se emitio el diploma, en que modalidad y con que numero de registro.
-- El nombre, la carrera, el nivel y el campo se LEEN por titulacion_id y no se copian.
CREATE TABLE IF NOT EXISTS expediente_titulos (
  id BIGINT NOT NULL PRIMARY KEY,
  -- LA TITULACION, y es OBLIGATORIA. Hubo aqui una columna titulacion_libre para el titulo que no
  -- estuviera en el catalogo, y se retiro: la CINE-F tiene comodin para todo (10 `xx10` sin mayor
  -- definicion, 10 `xx19` no contemplado, 10 `xx88` interdisciplinarios y el 9999 desconocido), asi
  -- que no existe el titulo imposible de clasificar. Y el nombre real no necesitaba una columna
  -- paralela sino una FILA: en texto libre no se puede cotejar, ni agregar, ni deduplicar. El titulo
  -- que falta se da de alta con origen = 'registro_local', pasando por el cotejo de duplicados.
  titulacion_id INT NOT NULL,
  -- LA INSTITUCION QUE LO EMITE. Sigue siendo texto: enlazarla a units solo valdria para las
  -- internas, y el 100 % de los titulos de una universidad son de OTRAS universidades.
  ies VARCHAR(200) NOT NULL,
  -- DONDE SE EMITIO EL DIPLOMA. Es SOLO DATO: no elige catalogo. Deasy guarda el catalogo del pais
  -- donde funciona la institucion (instituciones.pais_id) y ningun otro, asi que un doctorado de
  -- Lyon en una universidad ecuatoriana se clasifica con la nomenclatura ecuatoriana.
  pais_id INT NOT NULL,
  -- LA MODALIDAD DE ESTUDIO. En el JSON esta clave se llama "tipo" y el formulario la etiqueta
  -- "Modalidad" (AgregarTitulo.vue:62): el nombre de la clave y el de la cosa no coincidian. Se
  -- renombra al pasar a columna, porque "tipo" a secas ya significa otra cosa en seis de las diez
  -- secciones. Es de la persona y no de la titulacion: la misma carrera se cursa presencial o
  -- virtual.
  modalidad TEXT NOT NULL DEFAULT 'presencial'
    CHECK (modalidad IN ('presencial','semipresencial','virtual','hibrido')),
  -- EL NUMERO DE REGISTRO ante la autoridad de educacion superior (en Ecuador, la SENESCYT). Texto,
  -- porque su formato lo fija cada pais. Es de ESTA persona.
  --
  -- LA CLAVE DEL JSON SE LLAMABA sreg, y se renombra al pasar a columna. Cuatro letras que no
  -- significan nada para quien lee el esquema, y el mismo motivo por el que modalidad dejo de
  -- llamarse tipo. Se elige numero_registro y no registro_senescyt porque el modelo no nombra a
  -- Ecuador en ninguna parte -- cual es la autoridad lo decide instituciones.pais_id--, y encaja con
  -- el numero a secas de documentos_identidad.
  numero_registro VARCHAR(60) NULL,
  CONSTRAINT fk_expediente_titulos_item FOREIGN KEY (id) REFERENCES expediente_asientos(id) ON DELETE CASCADE,
  CONSTRAINT fk_expediente_titulos_titulacion FOREIGN KEY (titulacion_id) REFERENCES titulaciones(id),
  CONSTRAINT fk_expediente_titulos_pais FOREIGN KEY (pais_id) REFERENCES paises(id)
);
CREATE INDEX IF NOT EXISTS idx_expediente_titulos_titulacion ON expediente_titulos (titulacion_id);
CREATE INDEX IF NOT EXISTS idx_expediente_titulos_pais ON expediente_titulos (pais_id);

-- NOTA: el NIVEL ya no vive aqui. Es propiedad de la OFERTA y no de quien la curso -- una maestria
-- es una maestria lo escriba quien lo escriba--, y esta medido en la fuente del CES, que trae
-- oferta_tipo a la altura de la carrera. Vive en carreras.nivel_id; ver la seccion 8.4.


-- ── 2/10 · FORMACION CONTINUA ────────────────────────────────────────────────────────────────────
-- Cursos y eventos de capacitacion. El formulario que la alimenta se llama AgregarCapacitacion.vue
-- y la seccion se llama "formacion": se conserva el nombre de la seccion, que es el que viaja en
-- section y en la ruta del frontend.
CREATE TABLE IF NOT EXISTS expediente_formacion (
  id BIGINT NOT NULL PRIMARY KEY,
  tema VARCHAR(250) NOT NULL,
  institucion VARCHAR(200) NOT NULL,
  pais_id INT NOT NULL,
  -- EL AMBITO. Se llamaba tipo, y se renombra por el mismo motivo que modalidad: tipo a secas
  -- significaba SEIS cosas distintas en seis tablas de esta seccion.
  ambito TEXT NOT NULL DEFAULT 'docente' CHECK (ambito IN ('docente','profesional')),
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
  -- EL AMBITO, el mismo eje que expediente_formacion.ambito y con EL MISMO vocabulario. Decia
  -- 'docencia' donde la otra dice 'docente': el mismo concepto escrito de dos formas en tablas
  -- hermanas. Se unifica en 'docente'.
  ambito TEXT NOT NULL DEFAULT 'docente' CHECK (ambito IN ('docente','profesional')),
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
  -- EL VINCULO con quien da la referencia. Se llamaba tipo.
  vinculo TEXT NOT NULL DEFAULT 'laboral' CHECK (vinculo IN ('laboral','personal','familiar')),
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
  -- EL ALCANCE de la certificacion. Se llamaba tipo.
  alcance TEXT NOT NULL DEFAULT 'nacional' CHECK (alcance IN ('nacional','internacional')),
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
  -- QUE PIEZA es: el libro entero o un capitulo. Se llamaba tipo.
  pieza TEXT NOT NULL DEFAULT 'libro' CHECK (pieza IN ('libro','capitulo')),
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
  -- EL NIVEL de la tesis dirigida, del catalogo niveles_academicos (ver 8.4). Era un CHECK con
  -- OCHO valores mientras carreras.nivel tenia NUEVE -- le faltaba especializacion--, que es
  -- exactamente el defecto que este mismo plan denuncia en las dos listas del frontend. Duplicar el
  -- vocabulario es lo que lo rompio; por eso ahora hay una sola fuente.
  nivel_id INT NOT NULL,
  rol TEXT NOT NULL DEFAULT 'asesor' CHECK (rol IN ('asesor','revisor')),
  anio SMALLINT NULL CHECK (anio IS NULL OR anio BETWEEN 1900 AND 2200),
  CONSTRAINT fk_expediente_tesis_item FOREIGN KEY (id) REFERENCES expediente_asientos(id) ON DELETE CASCADE,
  CONSTRAINT fk_expediente_tesis_nivel FOREIGN KEY (nivel_id) REFERENCES niveles_academicos(id)
);


-- ── 10/10 · PROYECTOS ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expediente_proyectos (
  id BIGINT NOT NULL PRIMARY KEY,
  tema VARCHAR(300) NOT NULL,
  institucion VARCHAR(200) NOT NULL,
  -- LA LINEA del proyecto. Se llamaba tipo.
  linea TEXT NOT NULL DEFAULT 'investigacion' CHECK (linea IN ('investigacion','vinculacion')),
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

**Seis tablas y dos extensiones.** Las tres primeras son la norma internacional **CINE-F (ISCED-F)** de
la UNESCO y **no llevan país**; las tres últimas son el **único catálogo nacional** que existe: el del
país donde funciona la institución que instala Deasy (`instituciones.pais_id`).

⚠️ **Estas tablas van ANTES que `expediente_titulos` en `postgres_schema.sql`**, y sus datos los
siembra el bootstrap: son cientos de filas. Es el mismo trato que recibe la geografía.

```sql
-- ── EXTENSIONES ──────────────────────────────────────────────────────────────────────────────────
-- Las PRIMERAS del proyecto: hasta aqui postgres_schema.sql no declaraba ninguna. Comprobado que
-- estan disponibles en postgres:17 y que el rol de la aplicacion puede crearlas.
--
-- Las dos son la regla del cotejo de duplicados, y NINGUNA sobra: se midio sobre las 863
-- titulaciones del anexo del CES generando erratas realistas, y los trigramas solos a umbral 0,75
-- cazan el 97 %. Las 41 que se escapan son TRANSPOSICIONES -- Ingeneiria por Ingenieria-- que
-- arrasan los trigramas y dejan la distancia de edicion en 2. Con las dos, el 100 %, y el coste es
-- una falsa alarma mas por cada cien altas.
--
-- unaccent NO hace falta: la forma canonica se calcula con translate(), que si es IMMUTABLE y por
-- tanto vale en una columna generada.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;


-- ── LA NORMA INTERNACIONAL: CINE-F ───────────────────────────────────────────────────────────────
-- Campo amplio -> especifico -> detallado. 12 + 58 + 150 = 220 filas.
--
-- POR QUE NO LLEVAN PAIS. Existen para que un titulo frances y uno ecuatoriano se puedan comparar;
-- ponerles pais las volveria incomparables, que es lo contrario de para lo que existen.
--
-- Y TRAEN COMODIN PARA TODO, en el nivel detallado, que es donde hace falta: 10 codigos xx10 (sin
-- mayor definicion), 10 xx19 (no contemplado en la clasificacion), 10 xx88 (interdisciplinarios) y
-- el 9999 (campo desconocido). Por eso NO EXISTE el titulo imposible de clasificar, y por eso se
-- pudo retirar titulacion_libre de expediente_titulos.
CREATE TABLE IF NOT EXISTS campos_amplios (
  id INT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  -- Codigo CINE-F de dos digitos, con su cero a la izquierda: por eso VARCHAR y no INT. El 06 no es
  -- el numero seis, y perder el cero rompe el codigo.
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
  -- cuelgue el 031 de otro campo amplio.
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


-- ── EL CATALOGO NACIONAL ─────────────────────────────────────────────────────────────────────────
-- LOS CAMPOS DEL PAIS. En Ecuador, los del CES.
--
-- ES LA UNICA TABLA QUE APUNTA A campos_detallados, y ese anclaje es lo que sostiene el modelo: hace
-- que las carreras clasificadas con el catalogo nacional y las de un pais sin catalogo acaben en el
-- MISMO eje, asi que un informe puede agregar por codigo internacional sin distinguir. Hubo un
-- diseño con TRES tablas apuntando aqui -- desde el asiento, desde la carrera y desde el campo
-- nacional-- y era una dependencia transitiva: dos sitios donde discrepar.
--
-- SE DESCARTO una tabla de equivalencias N:M con una columna grado (exacta / contenida / amplia /
-- sin_equivalente), porque la norma YA codifica el grado en el propio codigo y a nivel detallado:
-- aterrizar en 0613 es equivalencia exacta, en 0610 es que el nacional es mas ancho, y en 0619 es
-- que el nacional tiene algo que la norma no. Una columna grado repetiria en dato lo que el codigo
-- ya dice, con el riesgo de que discrepen.
CREATE TABLE IF NOT EXISTS campos_nacionales (
  id INT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  pais_id INT NOT NULL,
  -- EL ANCLAJE A LA NORMA. NOT NULL a proposito: los comodines garantizan que siempre hay donde
  -- aterrizar, y el 9999 (campo desconocido) es el valor honesto mientras nadie lo mapee. Con una
  -- columna nula, subir a la norma podria fallar justo cuando hace falta.
  campo_detallado_id INT NOT NULL,
  -- COMO LLEGO LA TAXONOMIA. OJO: este eje NO ES el mismo que el origen de carreras y titulaciones.
  -- Aqui se distingue si el pais publico su propia lista o si adopto la internacional; alli, si la
  -- fila la sembro el catalogo oficial o la creo un usuario. Confundirlos seria marcar como
  -- "creado por un usuario" un campo que es la norma de la UNESCO.
  origen TEXT NOT NULL CHECK (origen IN ('autoridad_nacional','cine_f')),
  codigo VARCHAR(10) NOT NULL,
  nombre VARCHAR(180) NOT NULL,
  -- LA FORMA CANONICA, generada y por tanto imposible de derivar: no hay INSERT capaz de olvidarse
  -- de ponerla. Minusculas, sin tildes, sin puntuacion, espacios colapsados y LAS FORMAS DE GENERO
  -- PLEGADAS, que es lo que ni la unicidad exacta ni quitar tildes juntan.
  --
  -- Se usa translate() y NO unaccent(): una columna generada exige expresion IMMUTABLE y unaccent no
  -- lo es, porque depende de un diccionario que puede cambiar.
  nombre_norm VARCHAR(180) GENERATED ALWAYS AS (
    btrim(regexp_replace(regexp_replace(regexp_replace(
      translate(lower(nombre), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunaeiouun'),
      '([a-z])[[:space:]]*/[[:space:]]*a([^a-z]|$)', '\1\2', 'g'),
      '\([[:space:]]*a[[:space:]]*\)', '', 'g'),
      '[^a-z0-9]+', ' ', 'g'))
  ) STORED,
  is_active SMALLINT NOT NULL DEFAULT 1,
  -- CUANDO DEJO DE OFRECERSE, que is_active no dice. La regla es RETIRAR Y CREAR, NUNCA RENOMBRAR:
  -- el asiento lee el nombre por la clave ajena y no lo copia, asi que editar el nombre cambiaria en
  -- silencio el titulo de todo el que lo tenga -- y el regulador registro la denominacion vigente
  -- ENTONCES.
  vigente_hasta DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_campos_nacionales_pais FOREIGN KEY (pais_id) REFERENCES paises(id),
  CONSTRAINT fk_campos_nacionales_detallado FOREIGN KEY (campo_detallado_id) REFERENCES campos_detallados(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_campos_nacionales ON campos_nacionales (pais_id, codigo);
CREATE INDEX IF NOT EXISTS idx_campos_nacionales_detallado ON campos_nacionales (campo_detallado_id);
CREATE INDEX IF NOT EXISTS idx_campos_nacionales_trgm ON campos_nacionales USING GIN (nombre_norm gin_trgm_ops);
CREATE OR REPLACE TRIGGER trg_campos_nacionales_set_updated_at BEFORE UPDATE ON campos_nacionales FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── EL NIVEL ACADEMICO: catalogo, y no un CHECK ──────────────────────────────────────────────────
-- Es el UNICO vocabulario de este frente que se pasa a tabla, y por dos motivos medidos.
--
-- 1 · ESTABA DUPLICADO Y YA HABIA DERIVADO. La lista vivia en dos CHECK -- carreras.nivel con NUEVE
--     valores y expediente_tesis.nivel con OCHO, sin especializacion--, que es el mismo defecto que
--     este plan denuncia en las dos listas del frontend. Duplicar un vocabulario es lo que lo rompe.
--
-- 2 · HAY QUE ORDENARLO, Y EL TEXTO NO ORDENA. El desplegable de titulaciones agrupa por nivel, y
--     con una columna de texto el ORDER BY sale alfabetico: diplomado, doctorado, especializacion,
--     grado, maestria... que no es el orden academico de nada. La columna orden lo arregla, y una
--     columna de ordenacion es justamente lo que un CHECK no puede llevar.
--
-- POR QUE LOS DEMAS NO PASAN A TABLA. El criterio del esquema es que un vocabulario fijo sobre el
-- que el codigo se ramifica va en CHECK. section, modalidad, ambito, vinculo, alcance, pieza, linea,
-- rol, estado, estado_revision y origen cumplen las tres condiciones para quedarse: los fija el
-- dominio y no la institucion, no necesitan atributos por fila mas alla de la etiqueta -- que es del
-- frontend-- y ninguna otra tabla los referencia.
--
-- La forma es la de los catalogos que ya existen (signature_statuses, term_types, canales_mensajeria):
-- code + name + is_active. La columna orden es lo unico que se añade, y es el motivo 2.
CREATE TABLE IF NOT EXISTS niveles_academicos (
  id INT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  code VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(80) NOT NULL,
  -- De menor a mayor. Lo siembra el bootstrap: tecnico 10, tecnologo 20, grado 30,
  -- especializacion 40, diplomado 45, maestria 50, maestria_tecnologica 55, doctorado 60,
  -- posdoctorado 70. Con huecos de diez, para poder intercalar sin renumerar.
  orden SMALLINT NOT NULL,
  is_active SMALLINT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE OR REPLACE TRIGGER trg_niveles_academicos_set_updated_at BEFORE UPDATE ON niveles_academicos FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- LA CARRERA: la oferta academica tal como la aprueba la autoridad del pais.
CREATE TABLE IF NOT EXISTS carreras (
  id INT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  pais_id INT NOT NULL,
  -- EL UNICO CAMINO de la carrera a su campo. La norma internacional se deduce subiendo por
  -- campos_nacionales.campo_detallado_id, asi que aqui no hay una segunda clave ajena ni un CHECK
  -- de exclusion. Si el pais no publico taxonomia propia, campos_nacionales se siembra desde la
  -- CINE-F con origen = 'cine_f' -- 150 filas-- y esta columna sigue apuntando a un solo sitio.
  campo_nacional_id INT NOT NULL,
  -- EL NIVEL, y vive AQUI y no en el asiento porque es propiedad de la OFERTA y no de quien la
  -- curso: una maestria es una maestria lo escriba quien lo escriba. Esta medido en la fuente del
  -- CES, que trae oferta_tipo a la altura de la carrera.
  --
  -- Del catalogo niveles_academicos, que ademas ORDENA. Con nivel como texto, el ORDER BY del
  -- desplegable salia alfabetico -- diplomado, doctorado, especializacion, grado...-- y eso no es
  -- el orden academico de nada.
  nivel_id INT NOT NULL,
  -- COMO LLEGO LA FILA. Distinto del origen de campos_nacionales: aqui se distingue lo que sembro
  -- el catalogo oficial de lo que creo un usuario al registrar un titulo que faltaba. Es lo que
  -- sustituye a la retirada titulacion_libre, y dice lo mismo mejor -- porque es consultable,
  -- revisable y reutilizable por la siguiente persona con el mismo titulo.
  origen TEXT NOT NULL DEFAULT 'registro_local' CHECK (origen IN ('catalogo_nacional','registro_local')),
  nombre VARCHAR(250) NOT NULL,
  nombre_norm VARCHAR(250) GENERATED ALWAYS AS (
    btrim(regexp_replace(regexp_replace(regexp_replace(
      translate(lower(nombre), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunaeiouun'),
      '([a-z])[[:space:]]*/[[:space:]]*a([^a-z]|$)', '\1\2', 'g'),
      '\([[:space:]]*a[[:space:]]*\)', '', 'g'),
      '[^a-z0-9]+', ' ', 'g'))
  ) STORED,
  is_active SMALLINT NOT NULL DEFAULT 1,
  vigente_hasta DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_carreras_pais FOREIGN KEY (pais_id) REFERENCES paises(id),
  CONSTRAINT fk_carreras_campo FOREIGN KEY (campo_nacional_id) REFERENCES campos_nacionales(id),
  CONSTRAINT fk_carreras_nivel FOREIGN KEY (nivel_id) REFERENCES niveles_academicos(id)
);
-- LA UNICIDAD LLEVA EL NIVEL, y no es cosmetico: 109 de 443 nombres de carrera del anexo del CES
-- existen en MAS DE UN NIVEL -- EDUCACION es a la vez programa de especializacion y de maestria, y
-- lo mismo EDUCACION INICIAL, EDUCACION BASICA y PEDAGOGIA DE LA LENGUA Y LA LITERATURA--. Con la
-- clave corta, sembrar el catalogo FALLA en la segunda fila.
--
-- Y va sobre nombre_norm y no sobre nombre: es lo que convierte el aviso del cotejo en
-- imposibilidad. Comprobado contra PostgreSQL 17 -- insertar Ingeniero/a Maritimo y despues
-- Ingeniero/a Maritimo/a devuelve duplicate key value violates unique constraint. Coste medido
-- sobre las 863 titulaciones del anexo: DOS conflictos en todo el catalogo oficial, y plegar el
-- genero añade exactamente uno, sin ni un falso positivo.
CREATE UNIQUE INDEX IF NOT EXISTS uq_carreras_pais_nivel_nombre ON carreras (pais_id, nivel_id, nombre_norm);
CREATE INDEX IF NOT EXISTS idx_carreras_campo ON carreras (campo_nacional_id);
CREATE INDEX IF NOT EXISTS idx_carreras_nivel ON carreras (nivel_id);
CREATE INDEX IF NOT EXISTS idx_carreras_trgm ON carreras USING GIN (nombre_norm gin_trgm_ops);
CREATE OR REPLACE TRIGGER trg_carreras_set_updated_at BEFORE UPDATE ON carreras FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- LA TITULACION: el nombre exacto que aparece impreso en el diploma. No es lo mismo que la carrera
-- y NO es 1:1 con ella: medido sobre el anexo del CES, 41 de 266 carreras de maestria (15 %) y 14 de
-- 286 de especializacion otorgan varias. Una de cada siete maestrias.
--
-- NO LLEVA pais_id: se llega por carrera_id. Una columna copiada que nadie sincroniza es el problema
-- que ya tiene task_items.assigned_person_id, que necesita un trigger para no mentir.
CREATE TABLE IF NOT EXISTS titulaciones (
  id INT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  carrera_id INT NOT NULL,
  origen TEXT NOT NULL DEFAULT 'registro_local' CHECK (origen IN ('catalogo_nacional','registro_local')),
  nombre VARCHAR(250) NOT NULL,
  nombre_norm VARCHAR(250) GENERATED ALWAYS AS (
    btrim(regexp_replace(regexp_replace(regexp_replace(
      translate(lower(nombre), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunaeiouun'),
      '([a-z])[[:space:]]*/[[:space:]]*a([^a-z]|$)', '\1\2', 'g'),
      '\([[:space:]]*a[[:space:]]*\)', '', 'g'),
      '[^a-z0-9]+', ' ', 'g'))
  ) STORED,
  is_active SMALLINT NOT NULL DEFAULT 1,
  vigente_hasta DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_titulaciones_carrera FOREIGN KEY (carrera_id) REFERENCES carreras(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_titulaciones_carrera_nombre ON titulaciones (carrera_id, nombre_norm);
CREATE INDEX IF NOT EXISTS idx_titulaciones_trgm ON titulaciones USING GIN (nombre_norm gin_trgm_ops);
CREATE OR REPLACE TRIGGER trg_titulaciones_set_updated_at BEFORE UPDATE ON titulaciones FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

#### El cotejo de duplicados: la regla, y por qué NO va en el esquema

Las capas 1 y 2 son la columna generada y el índice único de arriba. La **capa 3 avisa y no impide**
—`Ingeniería Civil` e `Ingeniería Vial` están a distancia de edición 4 y son carreras distintas—, así
que vive en el servicio, antes de insertar. No en un `CHECK` ni en un trigger, que no pueden preguntar.

```sql
-- Candidatos: la puerta va en 0,30 y NO en 0,40. A 0,40 se pierde una errata de 1 571, porque la
-- peor transposicion medida baja a 0,38.
SELECT t.id, t.nombre,
       similarity(t.nombre_norm, $1) AS sim,
       levenshtein(t.nombre_norm, $1) AS dist
  FROM titulaciones t
  INNER JOIN carreras c ON c.id = t.carrera_id
 WHERE c.pais_id = $2
   AND t.is_active = 1
   AND similarity(t.nombre_norm, $1) >= 0.30
 ORDER BY sim DESC;
-- Se le enseña al usuario lo que cumpla:  sim >= 0.75  OR  dist <= 2
```

A la escala de hoy —**863 titulaciones por país**— el barrido exhaustivo son 863 comparaciones y el
índice GIN ni hace falta; está puesto para cuando crezca.

#### Lo que la siembra tiene que resolver

| | |
|---|---|
| Colisiones en el catálogo oficial bajo la forma canónica | **2** — el índice único las rechaza, y hay que decidir cuál vale |
| Carreras cuyo nombre existe en más de un nivel | **109 de 443** — por eso la clave lleva `nivel` |
| Campos nacionales sin mapear a la norma | aterrizan en `9999`, y el sembrador debe **contar cuántos** |

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
| Tablas nuevas | **19** (1 espina + 10 secciones + 1 hija + **7** catálogo) |
| Vistas nuevas | 1 |
| Columnas en total | **142** — 3 de ellas **generadas** (`nombre_norm`) |
| Claves ajenas nuevas | **24** |
| Índices declarados | 18 — 3 de ellos **GIN** para el cotejo |
| Restricciones `CHECK` | **28** — hoy hay **0** en el expediente |
| Triggers `set_updated_at()` | 8 |
| Extensiones de PostgreSQL | **2** — las primeras del proyecto |
| Columnas JSONB que quedan en el expediente | **0** |

Las siete del catálogo son las tres de la CINE-F (`campos_amplios` · `campos_especificos` ·
`campos_detallados`), `campos_nacionales`, `niveles_academicos`, `carreras` y `titulaciones`.
**Contado del propio DDL de esta sección, no estimado.**

**`dossiers` se RETIRA** (ver §2.7). `expediente_asientos` se reescribe: pierde `data` y `url_documento`, gana
`estado_revision`, `documento_ref`, `documento_subido_at`, `updated_at`, el `CHECK` de `section` y su
trigger.

### 8.7 · Lo que este diseño decidió y el plan no decía

Decisiones que hubo que tomar al escribir el DDL. **Nada de esto está aprobado todavía** — el plan
entero está en revisión. La diferencia entre las dos tablas es de dónde salió cada decisión: las
primeras se acordaron contigo durante la revisión; las segundas las tomé yo, y cualquiera puede
revertirse sin tocar el resto.

| Acordado en la revisión | Qué se hizo |
|---|---|
| **`sera` → `estado_revision`** | Columna nueva en la espina, con `CHECK` de cuatro valores. No estaba en las listas de §2.1 porque **no es de una sección: es de las diez**. Si no se recoge, al morir el `JSONB` la insignia se queda en «pendiente» para siempre |
| **`tipo` → `modalidad`, `ambito`, `vinculo`, `alcance`, `pieza`, `linea`** | Siete columnas se llamaban `tipo` y significaban siete cosas. Renombradas por lo que cada una es; **ya no queda ninguna** |
| **`sreg` → `numero_registro`** | Cuatro letras que no significan nada para quien lee el esquema |
| **`nivel` pasa a catálogo** | `niveles_academicos`. Estaba duplicado en dos `CHECK` que ya habían derivado, y hay que **ordenarlo** — cosa que un `CHECK` no puede hacer |
| **`titulacion_libre` se retira** | El título que falta se da de alta con `origen = 'registro_local'` |

| Decidido sin preguntar | Por qué, y qué se pierde si se revierte |
|---|---|
| **`pais_id` se queda** en `campos_nacionales` y `carreras` | Es la costura del multi-inquilino que `InstitucionService` ya documenta. Quitarlo es una línea, pero deja el catálogo como lo único que no puede ir a varias instituciones |
| **`origen` son DOS ejes distintos** | `campos_nacionales.origen` dice cómo llegó la *taxonomía*; el de `carreras`/`titulaciones`, cómo llegó *la fila*. Unificarlos marcaría como «creado por un usuario» un campo que es la norma de la UNESCO |
| **`vigente_hasta`** en las tres del catálogo nacional | `is_active` no dice **cuándo**, y la regla es retirar y crear, nunca renombrar |
| **`nombre_norm` con `translate()` y no `unaccent()`** | Una columna generada exige expresión `IMMUTABLE`, y `unaccent()` no lo es. Efecto secundario: la extensión `unaccent` no hace falta |
| **Umbrales del cotejo: `sim >= 0,75` o `lev <= 2`** | Medido sobre 863 titulaciones reales: 100 % de erratas cazadas con 0,15 falsas alarmas por alta. Subir el umbral pierde transposiciones; bajarlo multiplica el ruido |
| **Vocabularios en minúscula y sin tildes** | El esquema no usa tildes en sus literales; la etiqueta con tildes es del frontend. **Obliga a que `E8` traduzca al migrar**, y ése es el coste |

#### Una pregunta que estaba abierta y ya se puede cerrar

`titulaciones.carrera_id` se declaró `NOT NULL`, con la duda de si la fuente traería titulaciones sin
carrera —y sin `ALTER`, aflojarlo después no es gratis—.

**Ya no es duda.** La extracción de la capa de texto del anexo del CES da la estructura anidada
`carrera → titulaciones`: **no hay ni una titulación que no cuelgue de una carrera**. El `NOT NULL`
se queda.

---

## 9 · La lista de países duplicada — E9

**Decisión del dueño (2026-09-05): al cerrar el diseño se borra `frontend/src/core/constants/countries.js`
y se revisa que no quede código muerto.**

Salió al preguntar qué significaba el comentario `antes la cadena Ecuador` en `expediente_titulos.pais_id`.
Significa que hoy el país de un título se guarda como **texto**: `"pais": "Ecuador"` en el `JSONB`.
Pero al comprobarlo apareció algo más grande que un tipo de dato.

### Hay DOS listas de países, con las mismas 232 filas

| | Filas | Trae | Quién la usa |
|---|---:|---|---|
| Tabla `paises` (frente 14) | **232** | `iso_alpha2` · `name` · `name_en` · `phone_code` | El registro, el admin, `documentos_identidad`, `direcciones` |
| `frontend/src/core/constants/countries.js` | **232** | `name` · `es_name` · `phone_code` — **sin ISO** | Dos formularios del expediente |

El desplegable «País de emisión» de `AgregarTitulo.vue:48` es un `s-select` alimentado por la lista
del frontend, **no por la tabla**. Guarda el nombre elegido, y **nada garantiza que ese nombre exista
en `paises`**.

### El sustituto ya existe, y la migración está a medias

`SYSTEM_GEO_PAISES` (`/system/geografia/paises`) es público a propósito, y su comentario en
`apiConfig.js:161` ya dice que **sustituye a `countries.js`**. Lo mismo en `AuthService.js:61`. El
registro y el admin ya leen de ahí; los dos formularios del expediente se quedaron atrás.

### Tres de los cuatro exports YA están muertos

| Export | Consumidores fuera del propio fichero |
|---|---:|
| `escountries` | **2** — `AgregarTitulo.vue`, `AgregarCapacitacion.vue` |
| `encountries` | **0** |
| `getPhoneCodeByCountry` | **0** |
| `countries` | **0** |

⚠️ Y `encountries` **no es lo que su nombre dice**: `countries.map(c => c.es_name)` — la lista
«inglesa» es la española, idéntica a `escountries`. Un defecto que lleva ahí desde que se escribió y
que nadie ha notado porque **no la usa nadie**.

### Qué entrega E9

1. `AgregarTitulo.vue` y `AgregarCapacitacion.vue` piden los países a `SYSTEM_GEO_PAISES` y mandan
   **el `id`**, no el nombre.
2. Se borra `frontend/src/core/constants/countries.js` **entero** — las 245 líneas.
3. Se comprueba que no queda nada colgando: `pnpm run lint` y una búsqueda de los cuatro símbolos.

⚠️ **Va DESPUÉS de `E7`**, no antes: mientras los formularios sigan mandando el nombre, borrar la
lista los deja sin desplegable.

