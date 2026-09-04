# Frente 18 · El expediente sale del JSON y entra en la base

> **Qué es.** `dossier_items.data` es un `JSONB` con diez formas distintas dentro. Este frente lo
> convierte en tablas: una por sección, con claves ajenas a los catálogos que ya existen.
>
> **Quién decide.** El dueño. Las decisiones ya tomadas están en §2 y **no se vuelven a discutir**;
> lo que sigue abierto está en §7.

---

## §0 · Control de ejecución

| Tarea | Qué entrega | Estado | Evidencia | Fecha |
|---|---|:--:|---|---|
| **E0** | Este plan, con las decisiones de diseño tomadas y medidas | 🟡 | | |
| **E1** | El catálogo CINE-F: fuente limpia localizada y evaluada, no el PDF escaneado | ⬜ | | |
| **E2** | Las tablas del catálogo académico, sembradas por el bootstrap | ⬜ | | |
| **E3** | El esquema del expediente: espina + 10 subtipos + la hija del 1:N | ⬜ | | |
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
| **No se puede corregir** | `dossier_items` no tiene `updated_at`. Corregir un asiento es **borrarlo y volver a ponerlo** |
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

⚠️ **`dossier_items` es una fila POR ASIENTO, no por expediente.** Medido: `dossiers` tiene 1 fila y
`dossier_items` tiene 3 —un título, una experiencia, un artículo—. `dossier_id` es la clave **ajena**
que dice de quién es; la primaria es `id`. **La granularidad del respaldo documental es por título,
por certificación**, y se conserva entera.

```
dossiers (1 por persona)
   └── dossier_items                    ← 1 POR ASIENTO. Aquí viven section, el respaldo y las fechas
        ├─ id=1  section=titulos      → dossier_titulos      (id=1)   PK = FK, ON DELETE CASCADE
        ├─ id=2  section=experiencia  → dossier_experiencia  (id=2)   └── dossier_experiencia_funciones
        └─ id=3  section=articulos    → dossier_articulos    (id=3)
```

Cada tabla de sección tiene **`id` = clave primaria = clave ajena** a `dossier_items.id`: un asiento
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

**Los 38 campos amplios son la prueba del fallo: el CINE-F tiene diez.** Los nombres que ocupaban dos
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

| Nivel | Fuente | Por qué |
|---|---|---|
| campo amplio · específico · detallado | **CINE-F (ISCED-F) de la UNESCO** | Norma internacional, códigos estables, comparable entre países — le sirve a una universidad que homologa títulos extranjeros |
| carreras · titulaciones | Fuente ecuatoriana **legible por máquina** | Las fija el CES y no tienen equivalente internacional. **No** del PDF escaneado |

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
- `dossier_items` **recupera `updated_at`**: corregir un asiento deja de ser borrarlo.
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
| **La fuente del CINE-F** | Hay que localizarla y evaluarla antes de sembrar nada (E1) |
| **La fuente ecuatoriana de carreras y titulaciones** | Legible por máquina; el PDF escaneado queda descartado |
| **Generar el CV** | Anotado como consecuencia deseable, sin decidir si entra en este frente |
| **`ies` → `units`** | Sólo vale para instituciones internas; falta decidir qué se hace con las externas |
