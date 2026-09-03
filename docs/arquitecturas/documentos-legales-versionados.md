# Los documentos legales: versionado, huella y prueba — diseño

> **Estado: EN CURSO.** El consentimiento y su registro **están hechos y probados** desde el
> 2026-09-02 (dos casillas, tabla `consentimientos`, huella del texto). Lo que queda es **dónde
> vive el texto**: se muda de una columna `TEXT` a MinIO, en dos buckets.
>
> Sale de una deducción del dueño: si guardamos la **huella** del texto aceptado, entonces el texto
> tiene que estar **versionado** — y si está versionado, hay que decidir **dónde vive**.

---

## 1 · Por qué la huella obliga a versionar

El **Art. 5 del Reglamento** exige que el consentimiento *«deberá ser **demostrado** por el
responsable»*. Demostrar significa poder contestar **cuatro** preguntas, y la cuarta arrastra todo lo
demás:

| | |
|---|---|
| ¿Quién consintió? | `person_id` |
| ¿A qué? | `concepto` |
| ¿Cuándo? | `aceptado_at` |
| **¿Qué decía el texto que le enseñamos?** | **← esto exige conservar ese texto exacto, para siempre** |

Guardar sólo la huella **no basta**: una huella prueba que un texto **no ha cambiado**, pero no
reconstruye el texto. Si dentro de tres años alguien reclama, hay que poder **enseñar el documento**,
y que su huella cuadre con la que se guardó.

> **Huella sin archivo es un candado sin puerta.** Hacen falta las dos cosas.

---

## 2 · Dónde vive el texto: las tres opciones

### ❌ Hoy: `frontend/public/terms.md`

Un fichero estático servido por el frontend. **Tres problemas**, y el tercero es el que lo descarta:

1. **Se despliega con la imagen**, así que «qué texto estaba vigente el 14 de marzo» depende de qué
   etiqueta de imagen corría ese día — un dato que no está en ninguna parte consultable.
2. **No hay forma de servir una versión antigua.** Si alguien aceptó la v2 y hoy va por la v5, la v2
   **ya no existe** en ningún sitio al que la aplicación pueda llegar.
3. **El registro no lo puede leer.** El backend, que es quien tiene que guardar la huella, **no ve
   ese fichero**: vive en otro contenedor.

⚠️ Y ese tercer punto es el que rompe la cadena entera: **el texto que se le enseña al usuario lo
sirve el frontend, y la huella la calcularía el backend sobre otra cosa.** Dos fuentes para lo que
tiene que ser una.

### 🟡 En la base de datos

Simple y consultable. Pero **el texto quedaría exactamente igual de manipulable que la fila que lo
referencia** — y ésa era la objeción del dueño al hablar de no repudio: *«¿nuestra base, que es
manipulada por nosotros?»*. Meter la prueba **en el mismo sitio que lo que hay que probar** no añade
nada.

### ✅ En MinIO, con **versionado y bloqueo de objetos**

Es el patrón que **este repositorio ya usa** para las plantillas —`template_artifacts` guarda
`storage_version`, `content_hash`, `lifecycle_state` y `parent_version_id`— así que no se inventa un
segundo mecanismo. Y MinIO añade algo que ni el repositorio ni la base tienen.

---

## 3 · 🔬 Lo que MinIO da, MEDIDO — no supuesto

Comprobado en la pila C el 2026-09-02, sobre un bucket creado con `--with-lock` y retención
`COMPLIANCE`:

```
1· sobrescribir el fichero  → la copia PASA, pero crea una versión NUEVA
2· borrar el fichero        → «borrado» aparente
3· qué queda de verdad:
     v3 DEL terminos.md   ← el borrado es un MARCADOR, no una destrucción
     v2 PUT terminos.md   ← el intento de alterarlo: quedó como versión aparte
     v1 PUT terminos.md   ← 24 B — EL TEXTO ORIGINAL, INTACTO Y RECUPERABLE
```

**Ni sobrescribir ni borrar destruye la versión anterior.** Eso es exactamente lo que hace falta:

> **Un archivo del que ni nosotros podemos quitar lo que ya pusimos.** Es la respuesta técnica a la
> objeción de *«¿y si la prueba la controlamos nosotros?»* — porque en modo `COMPLIANCE` **ni la
> cuenta raíz** puede borrar antes de que venza la retención.

⚠️ **Y aquí está el hallazgo que hay que decir aparte:** los tres buckets que existen hoy
—`deasy-documents`, `deasy-templates`, `deasy-users`— están **SIN VERSIONAR**. Medido:
`is un-versioned`, los tres.

**Eso no es un problema de este frente, pero sí uno del sistema**: hoy sobrescribir el objeto de un
documento firmado **destruye el anterior sin rastro**. Se registra aquí y se pasa a quien lleve el
frente documental.

---

---

## 3bis · 🔬 Tres mediciones más (2026-09-02) que **cambiaron** el diseño

### ① Un bucket con bloqueo **sí** admite objetos sin bloquear

Sobre un bucket creado con `--with-lock` pero **sin** retención por defecto:

```
borrador.md  → 3 guardados = 3 versiones → purga permanente = 0 versiones   ✅ se puede
publicado.md → retención COMPLIANCE por objeto → borrado RECHAZADO          ✅ protegido
```

Así que **un solo bucket mixto era técnicamente viable**. Se descartó igualmente, y por §3bis-③.

### ② ⚠️ El WORM protege la **VERSIÓN**, no la **CLAVE**

Es el hallazgo que más manda en el diseño:

```
publicado.md, con COMPLIANCE a 10 años
   borrar        → RECHAZADO
   SOBRESCRIBIR  → PASA
   mc cat        → «texto FALSIFICADO»
```

La versión original sobrevive intacta. Pero **quien lea «el objeto que hay en esa clave» recibe la
falsificación**. La inmutabilidad protege lo que ya se escribió; no impide escribir encima.

> **Regla no negociable: se lee SIEMPRE por `object_version_id`, jamás por clave.**

Por eso esa columna no es un adorno, y por eso hay una prueba que se rompe si alguien lee por clave.

### ③ ⚠️ El bloqueo es de **creación**, e irreversible en los dos sentidos

```
bucket creado sin --with-lock:
  mc retention set --default COMPLIANCE  → «does not support locking»
  y activando antes el versionado        → «does not support locking»
```

Y aquí está el peligro concreto, porque el código **ya crea buckets solo**:

```js
// backend/services/admin/kernel/storage.js — ensureMinioBucket
getMinioClient().makeBucket(bucket, "", ...)   // ← sin bloqueo, para siempre
```

Si el bucket legal se creara por ese camino quedaría **permanentemente sin bloqueo**, en silencio, y
aparentaría funcionar durante años. De ahí que crearlo sea **fail-closed**: si existe y no admite
bloqueo, el arranque **se niega** en vez de continuar.

⚠️ **Y el coste es real, no teórico:** los cinco buckets de estos ensayos —`prueba-lock2`,
`prueba-worm`, `ensayo-mixto`, `ensayo-mixto2`, `ensayo-defecto`— quedaron **indelebles** en el MinIO
de la pila C. `mc rb --force` se niega. Sólo salen borrando el volumen.

### ④ ⚠️ **Crear el bucket NO detecta que ya existe sin bloqueo**

Es la trampa más fina de las cuatro, porque la comprobación evidente **es la equivocada**:

```
mc mb --with-lock --ignore-existing   sobre un bucket que YA existe SIN bloqueo
  → «Bucket created successfully»     y código de salida 0
```

Un arranque que compruebe el bloqueo *intentando crear el bucket* daría **verde sobre un archivo
desprotegido**, en silencio y para siempre.

**Lo que sí lo detecta es PEDIRLE la configuración de bloqueo**, que en un bucket sin él responde
`does not support locking`. Ésa, y no la creación, es la comprobación del fail-closed.

⚠️ **Y un matiz que refuerza la regla de leer por versión:** un `rm` normal sobre un objeto
bloqueado **sí funciona** — deja un *delete marker* y el objeto **desaparece del listado**. La
versión sigue ahí, indestructible, así que la prueba no se pierde; pero **leer por clave puede
devolver «no existe»**. Leer por `object_version_id` salva también este caso.

## 4 · El diseño

### 4.1 · Los DOS buckets

```
deasy-legal-borradores     versionado, SIN bloqueo         estado draft
  terminos_de_uso/v2.md    ← cada guardado deja una versión de objeto: ése es
                             el historial de edición del borrador

deasy-legal                versionado + COMPLIANCE por DEFECTO   published · retired
  terminos_de_uso/v1.md    ← lo que entra aquí ya no sale
  tratamiento_de_datos/v1.md
```

**Por qué dos y no uno mixto**, que §3bis-① demuestra posible:

| | Un bucket mixto | **Dos buckets** |
|---|---|---|
| Quién aplica la retención | **una línea de código** al publicar | **el bucket, en cada `put`** |
| Si esa línea falla o se olvida | queda sin proteger y **nadie se entera** | no puede pasar |
| «¿está todo protegido?» | hay que auditar objeto por objeto | **lo contesta el nombre del bucket** |
| Un `rb --force` equivocado | se lleva los borradores | **el archivo se niega entero** |

> Cuando el fallo es **irreversible**, la garantía va en la infraestructura, no en una rama del
> código.

⚠️ **Bucket aparte y no una carpeta en `deasy-documents`.** El bloqueo y la retención se configuran
**por bucket**: aplicárselos a los documentos de trabajo haría que no se pudiera borrar nada nunca.

**Publicar es copiar los bytes exactos** del borrador al archivo — sin re-serializar, sin deriva de
codificación —, releer **por `object_version_id`**, comparar la huella, y sólo entonces escribir la
fila. **Retirar no mueve nada**: cambia `estado` y ya, porque el objeto ya es inmutable.

**Dos ejes de versión, y no se confunden:**

| | Dónde | Qué pregunta contesta |
|---|---|---|
| Versión de **objeto** | MinIO | *cómo evolucionó este borrador* — 40 guardados, 40 versiones |
| Versión de **negocio** (`v1`,`v2`) | la fila | *qué aceptó esta persona* — 40 guardados, **una** fila |
### 4.2 · La tabla del documento

```sql
-- LOS TEXTOS LEGALES QUE UNA PERSONA ACEPTA, VERSION A VERSION.
--
-- Sigue el patron que ya usan las plantillas (`template_artifacts`): version de almacenamiento,
-- estado de ciclo de vida, huella del contenido y enlace al padre. No se inventa un mecanismo nuevo.
CREATE TABLE IF NOT EXISTS documentos_legales (
  id             INT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  -- 'terminos_de_uso' | 'aviso_de_privacidad'
  clase          VARCHAR(60) NOT NULL,
  version        VARCHAR(40) NOT NULL,
  -- Donde vive el texto exacto. El bucket tiene bloqueo de objetos: lo que entra no se puede quitar.
  bucket         VARCHAR(120) NOT NULL,
  object_key     VARCHAR(500) NOT NULL,
  -- ⚠️ La VERSION DE OBJETO de MinIO, no solo la clave. Sin esto, «el objeto terminos/v2.md» es
  -- ambiguo en cuanto alguien lo sobrescribe: apuntamos a la version concreta, que es inmutable.
  version_id     VARCHAR(120) NOT NULL,
  -- SHA-256 del contenido. Lo que hace comprobable que el texto servido es el aceptado.
  contenido_hash CHAR(64) NOT NULL,
  -- draft: se puede cambiar. published: ya se puede aceptar. retired: no se ofrece, pero SE
  -- CONSERVA -- hay gente que acepto esa version y su prueba depende de que siga estando.
  estado         TEXT CHECK (estado IN ('draft','published','retired')) NOT NULL DEFAULT 'draft',
  publicado_at   TIMESTAMP NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_documento_legal ON documentos_legales (clase, version);
-- Solo UNA version publicada por clase a la vez: si hubiera dos, «que acepto» seria ambiguo.
CREATE UNIQUE INDEX IF NOT EXISTS uq_documento_legal_vigente
  ON documentos_legales (clase) WHERE estado = 'published';
```

⚠️ **`retired` NO es borrar.** Una versión retirada **se conserva para siempre**: hay gente cuya
prueba de consentimiento apunta a ella. Borrarla destruiría exactamente lo que este diseño existe
para guardar.

### 4.3 · La tabla del consentimiento

```sql
CREATE TABLE IF NOT EXISTS consentimientos (
  id           BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  person_id    INT NOT NULL,
  -- UNA FILA POR FINALIDAD. El Art. 8 exige que el consentimiento sea ESPECIFICO y que, con varias
  -- finalidades, CONSTE para todas ellas. Una fila por finalidad es literalmente eso.
  documento_id INT NOT NULL,
  aceptado_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip           VARCHAR(60),
  -- La revocatoria es un derecho (Art. 8 de la Ley, Art. 6 del Reglamento). Se MARCA, no se borra:
  -- el tratamiento anterior fue licito y borrar el rastro destruiria la prueba de que lo fue.
  revocado_at  TIMESTAMP NULL,
  CONSTRAINT fk_consentimiento_persona FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE,
  CONSTRAINT fk_consentimiento_documento FOREIGN KEY (documento_id) REFERENCES documentos_legales(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_consentimiento ON consentimientos (person_id, documento_id);
```

⚠️ **Apunta al DOCUMENTO, no a un texto libre.** Así no se puede registrar un consentimiento a una
versión que no existe, y «qué aceptó» se responde con un `JOIN`, no con una interpretación.

⚠️ **`ON DELETE CASCADE` sobre la persona merece una decisión, y no es obvia:** si se ejerce el
derecho de eliminación y la persona desaparece, **desaparece también la prueba de que consintió**. Es
coherente con el derecho, pero conviene que sea deliberado y no un efecto secundario.

---

## 5 · Lo que arregla la cadena rota: **el texto se sirve por el BACKEND**

✅ **HECHO el 2026-09-03.** El navegador pedía `/terms.md` al frontend, y era la mitad del valor de
este diseño:

```
     ANTES                                    AHORA
navegador ──/terms.md──▶ frontend      navegador ──/legal/documentos──▶ backend ──▶ MinIO
                                                                          │
              backend (no lo veía)                          devuelve TEXTO + id + huella
```

**Y al aceptar, el navegador devuelve el `id` que le dieron.** El backend comprueba que ese
documento está `published` antes de guardar el consentimiento.

> **Así no hay dos fuentes.** Lo que se le enseñó y lo que se registra **son el mismo objeto**, y la
> huella lo demuestra. Con el fichero estático, el frontend enseñaba una cosa y el backend habría
> guardado la huella de otra — y nadie se enteraría hasta que hiciera falta.

---

## 5bis · Cómo llega el texto a MinIO — la mitad que faltaba

Pregunta del dueño, y era un hueco de verdad: había diseñado **dónde vive** el texto y **no cómo
entra**, quién lo edita ni con qué estados.

### ⚠️ El problema que lo ordena todo: **en WORM, un error tipográfico es para siempre**

Si el borrador se escribiera directamente en el bucket con bloqueo, **una errata quedaría archivada
diez años** y no habría forma de quitarla. Sólo se podría publicar otra versión encima… y la errata
seguiría ahí, recuperable, para siempre.

**De ahí sale la regla que estructura el flujo:**

> **El borrador NO vive en el archivo inmutable. Publicar es lo que lo mete dentro.**

### Los estados, que son los mismos que ya usan las plantillas

`template_artifacts` ya tiene exactamente esto —`draft` · `published` · `retired`, con rutas
`/version`, `/publish` y `/retire`— así que **no se inventa un ciclo nuevo**:

| Estado | Dónde vive el texto | Qué se puede hacer |
|---|---|---|
| **`draft`** | En la **base** (columna de texto) | **Editarlo cuantas veces haga falta.** Corregir, revisar con legal, rehacerlo entero |
| **`published`** | **En el bucket WORM** — se copia al publicar | **Nada.** Es inmutable, y su huella queda fijada |
| **`retired`** | Sigue en el bucket WORM | Nada. **Se conserva**: hay gente cuya prueba apunta a él |

⚠️ **El borrador en la base y no en MinIO es deliberado**: mientras se revisa con legal es un
documento vivo que va a cambiar diez veces. Meterlo en un almacén inmutable en esa fase sería
guardar diez versiones basura para siempre.

### El flujo, de principio a fin

```
1 · legal entrega el texto
        │
2 · alguien con permiso lo pega o sube  ──▶  fila `draft`, texto EN LA BASE
        │                                     (se puede corregir sin límite)
3 · se revisa: se ve exactamente como lo verá el usuario
        │
4 · PUBLICAR  ──┬─▶ se calcula el SHA-256 del texto
                ├─▶ se escribe el objeto en `deasy-legal` (WORM, 10 años)
                ├─▶ se guardan bucket, clave, `version_id` y la huella
                ├─▶ la versión anterior pasa a `retired`
                └─▶ ⚠️ IRREVERSIBLE
        │
5 · a partir de aquí, el registro sirve ESE objeto y nadie más lo toca
```

### Desde dónde se edita

**Una pestaña del admin**, con el patrón que ya existe para el organigrama, el mapa de procesos y los
canales: una pestaña que no es una tabla.

⚠️ **Y con dos protecciones que el ciclo de las plantillas no necesita**, porque aquí publicar es
irreversible:

1. **Confirmación explícita**, diciendo qué va a pasar: *«esto se archivará durante 10 años y no se
   podrá borrar»*. No un botón «Publicar» a secas.
2. **Vista previa obligatoria** antes de habilitar el botón: lo que se archiva es lo que se enseñó,
   y quien publica tiene que haberlo visto **renderizado**, no en crudo.

### Quién puede hacerlo

Un recurso RBAC propio, `legal_documents`, con la misma separación que se usó en `channels`:

| | |
|---|---|
| **`legal_documents.read`** | Ver los documentos y sus versiones |
| **`legal_documents.update`** | Crear y editar **borradores** |
| **`legal_documents.manage`** | **Publicar** — la acción irreversible |

⚠️ **Editar un borrador y publicarlo son permisos distintos a propósito**, por lo mismo que en
`channels`: quien redacta no tiene por qué poder archivar algo para diez años.

### ¿Y el fichero de antes?

✅ **Borrado el 2026-09-03**, junto con `TermsView.vue` y la ruta `/terminos` que lo servía. Dejarlo
habría sido tener dos textos con la misma pinta y sin forma de saber cuál rige — exactamente el
problema que este diseño resuelve.

⚠️ **La ruta llevaba sin un solo enlace entrante desde que el registro pasó a usar el modal.** Lo
único que la mencionaba era su propio test, así que no la echó de menos nadie — y aun así seguía
alcanzable tecleando la URL, sirviendo un texto que ya no era el vigente.

## 6 · Qué pasa cuando el texto cambia

Es la pregunta que decide si esto sirve de algo en dos años.

1. Se sube una versión **`draft`** y se revisa.
2. Al publicarla, la anterior pasa a **`retired`** — **y se conserva**.
3. **Quien ya aceptó NO tiene que volver a aceptar** por defecto: su consentimiento sigue apuntando a
   la versión que leyó, y eso es exactamente lo correcto.
4. **Pero si el cambio afecta a las finalidades o a los destinatarios**, hay que volver a pedirlo: el
   Art. 8 exige que sea **específico** e **informado**, y nadie consintió lo que no leyó.

⚠️ **Ese cuarto punto es una decisión editorial, no técnica**, y por eso el modelo no la automatiza:
lo que sí da es **la capacidad de saber quién aceptó qué versión**, que es lo que permite tomarla.

---

## 7 · Lo que hay que decidir antes de implementar

| | |
|---|---|
| ~~Bucket con bloqueo~~ | ✅ **DECIDIDO: WORM, modo COMPLIANCE** |
| ~~Cuánta retención~~ | ✅ **DECIDIDO: 10 años.** Cubre la prescripción ordinaria del Art. 2415 del Código Civil — **a confirmar por legal** |
| ~~Qué pasa al eliminar una persona~~ | ✅ **DECIDIDO: se conserva entero.** Ver §8 |
| ~~Los tres buckets sin versionar~~ | ➡️ **Pasa a un FRENTE PROPIO**: el dueño maneja las versiones por sub-rutas y quiere analizar la migración a fondo. Ver `docs/planes/versionado-de-objetos-2026-09.md` |
| ~~Un bucket mixto o dos~~ | ✅ **DECIDIDO: DOS.** Con retención por defecto el bucket bloquea **cada `put`** sin que el código pida nada; en uno mixto la protección depende de una línea que se puede olvidar. Ver §3bis-① |
| ~~Cuánta retención en dev~~ | ✅ **DECIDIDO: por entorno — 1 día en dev, 3650 en producción.** `test:char:run` resetea la base pero **no** MinIO: con 10 años cada corrida dejaría documentos indelebles acumulándose para siempre |
| ~~Configurable desde `instituciones`~~ | ❌ **DESCARTADO.** COMPLIANCE **no permite acortar**, así que un ajuste que la bajara parecería guardarse y no haría nada — y un mando que miente es peor que ninguno. Es configuración de despliegue; la retención **efectiva se lee del bucket** y se enseña en el admin de **sólo lectura** |

---

## 8 · ⚠️ Una corrección: yo dije que conservar el consentimiento incumplía el derecho de eliminación. **Estaba mal.**

Al ofrecer las opciones etiqueté «conservar entero» como *«probable incumplimiento»*. **El dueño
eligió esa opción, y el texto de la norma le da la razón.** Literal:

> **Ley, Art. 18** — *«**No proceden** los derechos de rectificación, actualización, **eliminación**,
> oposición, anulación y portabilidad, en los siguientes casos: […] **4) Cuando los datos son
> necesarios para la formulación, ejercicio o defensa de reclamos o recursos**»*

> **Reglamento, Art. 11** — *«La eliminación de datos personales **no aplicará** cuando el
> tratamiento sea necesario en los siguientes supuestos: […] **2. Para la formulación, el ejercicio o
> la defensa de reclamaciones**»*

**La prueba de que alguien consintió es exactamente eso**: lo que permite defenderse de un reclamo de
que nunca consintió. Conservarla no es una excepción que nos inventemos — **es un supuesto expreso**
en los dos textos.

### Pero con dos condiciones que sí manda la norma

1. **Se conserva SÓLO lo necesario para esa defensa.** El consentimiento —quién, a qué versión,
   cuándo— sí. **El resto de sus datos, no**: el Art. 18 exceptúa *los datos necesarios*, no la ficha
   entera de la persona.
2. **Hay que poder explicarlo.** El Art. 18.5 exige que el responsable **acredite** el motivo al
   responder la solicitud. No basta con conservar: hay que decir por qué, y ese porqué es este
   artículo.

⚠️ **Consecuencia técnica concreta:** `consentimientos` **NO puede llevar `ON DELETE CASCADE`** sobre
`persons`, que es lo que yo había escrito. Si la persona se elimina, la fila del consentimiento tiene
que **sobrevivir**. Y como una clave ajena impediría borrar a la persona, el enlace se guarda **sin
constraint**, con el porqué escrito al lado.
