# LOPDP, consentimiento y no repudio — análisis

> ⚠️ **Esto NO es asesoría legal.** Es un análisis técnico de qué exige la norma sobre el sistema y
> qué falta para cumplirla. Antes de publicar nada de esto tiene que pasar por quien lleve el tema
> jurídico de la institución — y en particular el aviso de privacidad, que es un documento legal.
>
> Lo que sí es firme aquí son **los hallazgos medidos sobre el código**.

---

## 0 · Las fuentes, verificadas

⚠️ **La primera versión de este documento se escribió DE MEMORIA y el dueño lo señaló.** Esta se
escribió con el texto delante. Lo que sigue cita artículo por artículo.

| Norma | Identificación | Estado |
|---|---|---|
| **LOPDP** | Ley 0 · **Registro Oficial Suplemento 459 · 26-may-2021** | **Vigente** |
| **Reglamento General** | Decreto **904** · **RO Suplemento 435 · 13-nov-2023** | **Vigente**, «fecha de última modificación: No aplica» |

Complementadas por la **Norma General para el uso de sistemas de inteligencia artificial**
(Resolución SPDP-SPD-2026-0009-R, 12-feb-2026), que no aplica aquí — este sistema no toma decisiones
automatizadas sobre personas.

---

## 0bis · LA RESPUESTA A LA PREGUNTA DEL CHECK: **son DOS, y lo dice el Art. 8**

El último inciso del **Art. 8 de la Ley** lo resuelve sin ambigüedad:

> *«Cuando se pretenda fundar el tratamiento de los datos en el consentimiento del afectado para una
> **pluralidad de finalidades** será preciso que **conste que dicho consentimiento se otorga para
> todas ellas**.»*

Y el mismo artículo exige que sea **específico**:

> *«2) **Específica**, en cuanto a la determinación concreta de los medios y fines del tratamiento»*

**Un solo check para «términos y condiciones + tratamiento de datos» no cumple**, porque son
finalidades distintas y de una sola casilla **no consta** que se haya consentido cada una. Y hay una
razón práctica que lo refuerza: **el consentimiento se puede revocar** (Art. 8 y Art. 6 del
Reglamento). Con una casilla única, revocar el tratamiento de datos revocaría también la aceptación
de los términos de uso — que no es consentimiento, es un contrato.

### Pero son dos por un motivo, no tres por costumbre

⚠️ **Los términos de uso NO son consentimiento de datos.** Son la aceptación de un contrato, y su
base legal es el **Art. 7.5** (ejecución de medidas precontractuales o contractuales), no el
consentimiento. Se aceptan igual, pero no son lo mismo y por eso no pueden ir juntos.

**Y el tratamiento necesario para operar tampoco es consentimiento.** Crear la cuenta, autenticar y
verificar el teléfono caben en **Art. 7.5** (ejecución) y **Art. 7.8** (interés legítimo). Pedir
consentimiento para eso sería un error: se puede revocar, y entonces el sistema no puede hacer lo
que sí necesita hacer.

**Entonces, ¿qué se consiente de verdad?** Lo que es genuinamente opcional:

| Casilla | Qué es | Base legal |
|---|---|---|
| **1 · Términos y condiciones** | Aceptación del contrato | Art. 7.5 — *no es consentimiento de datos* |
| **2 · Tratamiento de datos personales** | Haber leído y aceptado el aviso de privacidad | Art. 8, informado por Art. 12 |
| *(en el paso 3, no en el 1)* | **Elegir WhatsApp o Telegram** = enviar su número a un tercero **fuera del país** | Art. 8 + Art. 55-56 |

**Dos casillas en el paso 1. Y la tercera decisión ya existe: es el selector de canal.**

---

## 0ter · ¿Hace falta firmar? **NO, y el Reglamento dice exactamente qué basta**

**Art. 5 del Reglamento**, literal:

> *«El consentimiento del titular deberá reflejar de manera indubitada la aceptación de éste en
> relación con el tratamiento de sus datos personales a través de **una declaración, pronunciamiento
> para darse de baja o clara acción afirmativa**. El consentimiento otorgado por el titular deberá
> ser **demostrado por el responsable que lo obtiene**, cuando así sea requerido por la autoridad
> competente.»*
>
> *«El **silencio o la inacción, por sí solos, no presumen** el consentimiento del titular.»*

**«Clara acción afirmativa» es exactamente marcar una casilla vacía.** No se menciona la firma en
ninguna parte, ni electrónica ni manuscrita.

⚠️ **Y de ahí sale la obligación que hoy se incumple:** *«deberá ser demostrado por el responsable»*.
No basta con obtenerlo — hay que **poder probarlo**. Es la misma idea del **Art. 10.k** de la Ley:

> *«**Responsabilidad proactiva y demostrada**.-El responsable del tratamiento de datos personales
> deberá **acreditar** el haber implementado mecanismos para la protección de datos personales…»*

**Conclusión: dos casillas, ningún documento firmado, ningún cuarto paso en el registro.** Lo que
falta está entero en el backend.

---

## 0quater · Qué hay que INFORMAR antes de la casilla — Art. 12, los 17 puntos

El **Art. 12 de la Ley** lista **diecisiete** cosas, y cierra con el momento:

> *«En el caso que los datos se obtengan directamente del titular, la información deberá ser
> comunicada **de forma previa** a este, es decir, **en el momento mismo de la recogida** del dato
> personal.»*

Y el **Art. 5 del Reglamento** repite el núcleo:

> *«el responsable deberá informar previa y detalladamente **los tipos de tratamiento, finalidades,
> el tiempo de conservación, las medidas de protección a adoptarse, las consecuencias de su
> entrega**…»*

De los 17, éstos son los que hoy **no** están en `terms.md` y son ineludibles:

| Art. 12 | Qué falta |
|---|---|
| **2** | La **base legal** de cada tratamiento |
| **4** | El **tiempo de conservación** — hoy no hay ninguno declarado, y menos el del perfil de WhatsApp |
| **8** | Identidad y contacto del **responsable**: domicilio legal, teléfono y correo |
| **9** | El **delegado de protección de datos**, si lo hay |
| **10** | **Las transferencias internacionales**: destinatarios, finalidad y garantías → **Meta y Telegram** |
| **11** | Consecuencias de entregar los datos **o de negarse** |
| **13** | Que **se puede revocar** el consentimiento |
| **14-16** | Los derechos, **cómo** ejercerlos y **dónde reclamar** — ante nosotros y ante la Autoridad |

---

## 0quinquies · Lo que arriesga la institución, con nombre

**Art. 67.2 — infracción LEVE:** *«No implementar protección de datos **desde el diseño y por
defecto**»*.
**Art. 67.3 — LEVE:** *«No mantener disponibles políticas de protección de datos personales afines
al tratamiento»*.
**Art. 68.1 — GRAVE:** no implementar medidas técnicas y organizativas.
**Art. 68.3 — GRAVE:** *«Ceder o comunicar datos personales sin cumplir con los requisitos»* — que es
donde cae una transferencia internacional no informada.

Las multas van del **0,1 % al 0,7 %** del volumen de negocio (leves) y hasta el **1 %** (graves). En
una institución pública **la responsabilidad recae sobre el servidor público**, no sobre una cifra de
facturación.

⚠️ **Y hay un dato que cambia la urgencia:** la Superintendencia **ya está operando**, con
metodología de cálculo de multas publicada (SPDP-SPD-2025-0022-R) y sanciones firmes. Esto dejó de
ser teórico.

---

## 0 · La respuesta corta a las tres preguntas del dueño

| Pregunta | Respuesta |
|---|---|
| **¿Hace falta firmar un documento?** | **No.** El Art. 5 del Reglamento admite «una declaración, pronunciamiento para darse de baja o **clara acción afirmativa**» — marcar una casilla vacía lo es |
| **¿Un check o dos?** | **DOS.** Art. 8: para «una pluralidad de finalidades» debe **constar** el consentimiento **para todas ellas**, y ser **específico** |
| **¿Basta el check?** | **Sí — «clara acción afirmativa», Art. 5 del Reglamento.** Pero el que hay hoy NO, porque no deja rastro, y el mismo artículo exige poder DEMOSTRARLO |
| **¿Un cuarto paso en el registro?** | **No.** Ninguna norma pide firma. El paso 1 ya tiene la casilla; lo que falta está en el backend |
| **¿Por qué el WhatsApp nuestro no da no repudio?** | Matizado abajo — **me pasé al decir que no aporta nada**, pero aporta mucho menos de lo que parece y cuesta caro en LOPDP |

---

## 1 · 🔴 Lo que está mal HOY, medido en el código

### 1.1 · El consentimiento no se guarda EN NINGUNA PARTE

```
frontend/RegisterView.vue:207   <input type="checkbox">          ← existe
frontend/RegisterView.vue:550   "Debe aceptar los términos"      ← se valida EN EL NAVEGADOR
backend/  …                      (nada)                          ← NO SE MANDA NI SE GUARDA
postgres_schema.sql              (nada)                          ← ninguna tabla lo registra
```

**La casilla se comprueba en el navegador y se pierde ahí.** El `payload` que sale hacia el backend
no la lleva; ninguna tabla la recibe.

⚠️ **Esto es exactamente lo que la LOPDP llama responsabilidad proactiva o *accountability*: no basta
con obtener el consentimiento, hay que poder PROBAR que se obtuvo.** Hoy, si alguien dice «yo nunca
acepté nada», **no tenemos con qué contestar** — y una validación de JavaScript no prueba nada,
porque se salta con la consola abierta.

**Es el hallazgo más grave de este documento, y el más barato de arreglar.**

### 1.2 · El texto que se acepta no dice lo que tiene que decir

`frontend/public/terms.md` existe y se sirve (HTTP 200), pero su §4 sobre datos personales dice, en
esencia, *«se procesan de acuerdo con la normativa aplicable»*. Eso **no es un aviso de privacidad**:
es una remisión a la norma que uno debe cumplir, no el cumplimiento.

Faltan, como mínimo:

- **Quién es el responsable** del tratamiento, con datos de contacto
- **Qué datos** se tratan y **para qué** — cada finalidad por separado
- **Con qué base legal** cada una (§3)
- **Quién más los recibe**, incluidas **Meta (WhatsApp) y Telegram**
- **Que salen del país** (§4) — y con qué garantía
- **Cuánto se conservan** (§5)
- **Los derechos** y **cómo ejercerlos**, con un canal concreto

### 1.3 · Un solo *check* para cosas que son distintas

Hoy una única casilla cubre «términos y condiciones». Los términos de uso y el tratamiento de datos
**son cosas distintas** y agruparlas es el error clásico: un consentimiento agrupado no es
*específico*, y el que no es específico no vale.

---

## 2 · Por qué NUESTRA cuenta de WhatsApp no da no repudio — y en qué me pasé

El dueño discrepó, con razón, de mi afirmación de que el chat «no aporta nada». **Corrijo: aporta
algo, pero mucho menos de lo que parece, y no lo que hace falta.**

### Lo que sí tiene

El mensaje lo entregó **una plataforma de un tercero**, con sus metadatos, y **existe una copia
espejo en el teléfono de la otra persona**. Si las dos coinciden, eso **corrobora**. Es valor real y
me equivoqué al negarlo.

### Por qué aun así no es «prueba de un tercero»

⚠️ **La copia que está en NUESTRO teléfono es NUESTRA.** La custodiamos nosotros, en un dispositivo
nuestro, y se borra con dos toques sin dejar rastro. Frente a un reclamo tiene **la misma cadena de
custodia que nuestra base de datos** — que es justo la objeción del dueño a la base, y aplica igual
aquí. No se resuelve el problema duplicándolo en un sitio peor.

Tres razones más, concretas:

1. **Se pierde sola.** Un `SIGKILL`, un `CONFLICT`, un cambio de teléfono, un reescaneo del QR: el
   historial se va entero. Lo hemos visto varias veces esta semana. **Un registro que desaparece al
   reescanear un código no sirve como respaldo.**
2. **Un chat exportado es trivial de falsificar**, y eso es conocido. Su peso no viene de existir,
   sino de que **otro** tenga la copia coincidente.
3. **La fuente de un tercero de verdad es Meta**, y sus registros existen **la guardemos o no
   nosotros**. Se piden por vía legal. Nuestra copia no los refuerza.

### Y lo que la mayoría no ve: **guardarlo tiene un COSTE en LOPDP**

Ese perfil son hoy **324 MB** con identificadores de todo el que ha escrito, **sin política de
retención, sin control de acceso, fuera del inventario de tratamientos y fuera de las copias**.
Eso incumple **minimización** y **conservación** a la vez.

> **En resumen: como prueba es débil y perecedera; como dato personal es un pasivo real.** Ésa es la
> comparación honesta, no «no vale nada».

### Entonces, ¿qué da no repudio de verdad?

| | Bajo control de | ¿Depende de que guardemos el chat? |
|---|---|---|
| Registros de **Meta**, por vía legal | **un tercero** | ❌ existen igual |
| El **teléfono de la otra parte** | la otra parte | ❌ |
| **Un registro nuestro a prueba de manipulación** — sólo-añadir, encadenado por hash, con sellado de tiempo | nosotros, **pero demostrable** | ❌ |
| Nuestra base tal cual hoy | nosotros | — |
| El chat en nuestro móvil | nosotros | *el más débil* |

**Lo que convierte un registro propio en prueba no es guardar más datos: es poder demostrar que no se
alteró.** Y eso son controles de integridad.

⚠️ **Y esto es más grande que los canales.** Si el no repudio importa, importa para toda acción con
consecuencias — quién aprobó, quién asignó, quién relevó. Hoy **ninguna** lo tiene. La única pieza
construida para eso es **el firmador con sus certificados**, y sólo cubre documentos.

---

## 3 · Qué exige la LOPDP, aplicado a este sistema

### 3.1 · Base legal: **el consentimiento NO es la única, ni suele ser la mejor**

Es el error más común. La ley admite varias bases, y elegir consentimiento donde no toca **debilita**
el sistema: un consentimiento se puede retirar, y si el tratamiento era necesario para el servicio,
retirarlo deja al sistema sin poder operar.

| Tratamiento | Base que le corresponde |
|---|---|
| Crear la cuenta, autenticar, operar tareas y documentos | **Ejecución de la relación** (contrato / medidas precontractuales), no consentimiento |
| **Verificar el teléfono** | **Interés legítimo** (seguridad de la cuenta) o ejecución. No es opcional: sin verificar no hay cuenta |
| **Elegir WhatsApp en vez de Telegram** | **Consentimiento**, y aquí sí encaja: la persona **escoge** enviar su dato a Meta pudiendo no hacerlo |
| Notificaciones no esenciales | Consentimiento |

⚠️ **De ahí sale una idea que ordena todo:** el selector de canal **ya ES el mecanismo de
consentimiento** para la transferencia a Meta o a Telegram. Sólo hay que **informarlo ahí**, y
registrar qué eligió.

### 3.2 · Principios que muerden aquí

| Principio | Dónde nos toca |
|---|---|
| **Minimización** | El perfil de WhatsApp guarda mucho más de lo necesario |
| **Conservación** | Ese perfil **no tiene plazo**. Ninguno |
| **Transparencia** | El aviso no dice que los datos van a Meta ni a Telegram |
| **Seguridad** | El volumen no tiene control de acceso declarado |
| **Responsabilidad proactiva** | **No podemos demostrar el consentimiento** (§1.1) |

### 3.3 · Transferencia internacional — la que nadie ve venir

Usar WhatsApp implica que **el número de teléfono de cada persona pasa por Meta**, fuera de Ecuador.
Es una **transferencia internacional** y hay que decirlo en el aviso, con su garantía. Lo mismo con
Telegram.

⚠️ **Y esto refuerza que el selector de canal es el sitio correcto para informarlo**: es el momento
exacto en que la persona decide a qué tercero manda su número. Ofrecer dos canales no es sólo
comodidad: es lo que hace que la elección sea real.

### 3.4 · Obligaciones de la institución, no del código

- **Registro de actividades de tratamiento**
- **Delegado de protección de datos** — probablemente exigible por ser institución educativa
- **Procedimiento de brechas** y su notificación a la Autoridad
- **Canal para ejercer derechos** (acceso, rectificación, eliminación, oposición, portabilidad…)

Esto no lo arregla un commit; lo decide la institución. Se lista para que no se dé por hecho.

---

## 4 · Lo que propongo hacer, en orden

### A · Hacer DEMOSTRABLE el consentimiento — Art. 5 del Reglamento

La obligación es literal: *«deberá ser demostrado por el responsable que lo obtiene, cuando así sea
requerido por la autoridad competente»*. Demostrable significa **cuatro cosas**, y si falta una, no
se demuestra nada:

| Hay que poder decir | Cómo |
|---|---|
| **QUIÉN** consintió | `person_id` |
| **A QUÉ** consintió | `concepto` — cada finalidad por separado (Art. 8) |
| **CUÁNDO** | `aceptado_at` |
| **QUÉ DECÍA EL TEXTO** que se le enseñó | **la huella del documento** |

⚠️ **La huella es la pieza que casi todo el mundo olvida, y sin ella lo demás no vale.** Guardar
«aceptó la versión 2» no demuestra nada si dentro de un año nadie puede probar qué decía la versión
2 — y el fichero `terms.md` está en el repositorio, donde se edita sin dejar rastro para quien mire
la base. Con la huella, **si alguien cambia el texto, deja de cuadrar con lo aceptado**, y eso es
justamente lo que hace la prueba creíble.

```sql
-- LO QUE HACE DEMOSTRABLE EL CONSENTIMIENTO (Art. 5 del Reglamento; Art. 10.k de la Ley).
--
-- ⚠️ Hoy NO SE GUARDA NADA: la casilla se valida en el navegador (`RegisterView.vue:550`) y muere
-- ahi. Una validacion de JavaScript no prueba nada -- se salta con la consola abierta.
CREATE TABLE IF NOT EXISTS consentimientos (
  id          BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  person_id   INT NOT NULL,
  -- UNA FILA POR FINALIDAD, no una por registro. El Art. 8 exige que el consentimiento sea
  -- ESPECIFICO y que, con varias finalidades, CONSTE para todas ellas. Una fila por finalidad es
  -- literalmente eso: que conste, por separado, cada una.
  --   'terminos_de_uso' -- contrato (Art. 7.5), NO es consentimiento de datos
  --   'tratamiento_de_datos'
  --   'canal_whatsapp' / 'canal_telegram' -- transferencia internacional (Art. 55)
  concepto    VARCHAR(60) NOT NULL,
  version     VARCHAR(40) NOT NULL,
  -- ⚠️ LA HUELLA DEL TEXTO EXACTO. Sin esto se guarda «acepto la version 2» y NO SE PUEDE DEMOSTRAR
  -- que decia la version 2: el fichero vive en el repositorio y se edita sin dejar rastro aqui.
  texto_hash  CHAR(64) NOT NULL,
  aceptado_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Se anota para situar el acto. NO se publica ni se usa para nada mas.
  ip          VARCHAR(60),
  -- La revocatoria es un DERECHO (Art. 8 de la Ley, Art. 6 del Reglamento) y necesita sitio donde
  -- constar. Se marca, NO se borra la fila: el tratamiento anterior a la revocatoria fue licito y
  -- borrar el rastro destruiria la prueba de que lo fue.
  revocado_at TIMESTAMP NULL,
  CONSTRAINT fk_consentimiento_persona FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE
);
-- Una persona no consiente dos veces la MISMA version de lo MISMO.
CREATE UNIQUE INDEX IF NOT EXISTS uq_consentimiento
  ON consentimientos (person_id, concepto, version);
```

**Y el alta lo exige en el BACKEND.** Hoy la puerta está en el navegador, que es como no tenerla:
sin las dos filas, no hay cuenta.

### B · Separar los *checks*

Dos casillas, no una: **términos de uso** y **tratamiento de datos personales**. Y el aviso de
privacidad accesible **en ese momento**, no escondido.

**Sigue siendo el paso 1. No hace falta un cuarto paso ni firmar nada.**

### C · Informar la transferencia donde se elige el canal

Una línea en el paso 3, junto al selector: qué se manda, a quién, y que puede elegir el otro.

### D · Ponerle plazo al perfil de WhatsApp

Es lo que quedó pendiente de la conversación anterior, y ahora tiene un motivo que no es el espacio
en disco: **conservación y minimización**. La decisión es del dueño; lo que no es defendible es «sin
plazo».

### E · Reescribir el aviso de privacidad

Con lo de §1.2. **Esto lo tiene que revisar quien lleve lo jurídico**, y probablemente redactarlo.

---

## 5 · Lo que NO hay que hacer

- **No pedir firma electrónica para el registro.** La ley no la exige para consentir, y añadiría un
  cuarto paso, un certificado por persona y un motivo para abandonar el alta. **La firma es para
  documentos**, y para eso ya está el firmador.
- **No apoyar el no repudio en el chat de WhatsApp** (§2).
- **No usar «consentimiento» como base para lo que es necesario** para el servicio (§3.1): se puede
  retirar, y entonces el sistema no puede operar lo que sí necesita.
