# LOPDP, consentimiento y no repudio — análisis

> ⚠️ **Esto NO es asesoría legal.** Es un análisis técnico de qué exige la norma sobre el sistema y
> qué falta para cumplirla. Antes de publicar nada de esto tiene que pasar por quien lleve el tema
> jurídico de la institución — y en particular el aviso de privacidad, que es un documento legal.
>
> Lo que sí es firme aquí son **los hallazgos medidos sobre el código**.

---

## 0 · La respuesta corta a las tres preguntas del dueño

| Pregunta | Respuesta |
|---|---|
| **¿Hace falta firmar un documento?** | **No.** La LOPDP no exige firma para el consentimiento; exige que se pueda **DEMOSTRAR**. Un *check* con su registro basta — y **eso es justo lo que hoy falta** |
| **¿Basta el check?** | El check sí. **Lo que hay hoy NO**, porque no deja rastro: es sólo una validación de navegador |
| **¿Un cuarto paso en el registro?** | **No hace falta.** El paso 1 ya tiene el check; lo que falta está en el backend |
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

### A · Guardar el consentimiento (barato, y es el hallazgo grave)

```sql
-- QUE SE ACEPTO, QUIEN, CUANDO Y QUE VERSION. Sin la version no vale de nada: dentro de un año el
-- texto habra cambiado y no se podra decir a que se dijo que si.
CREATE TABLE IF NOT EXISTS consentimientos (
  id          bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  person_id   integer NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  -- 'terminos_de_uso' · 'tratamiento_de_datos' · 'canal_whatsapp' · 'canal_telegram'
  concepto    varchar(60) NOT NULL,
  version     varchar(40) NOT NULL,
  -- La huella del texto exacto que se le enseño. Si alguien cambia el fichero, deja de cuadrar.
  texto_hash  char(64) NOT NULL,
  aceptado_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Se anota, no se publica: es lo que permite situar el acto.
  ip          varchar(60),
  CONSTRAINT uq_consentimiento UNIQUE (person_id, concepto, version)
);
```

Y **el alta lo exige en el BACKEND**, no en el navegador: sin consentimiento, no hay cuenta.

⚠️ **La huella del texto es la pieza que lo hace útil.** Sin ella se guarda «aceptó la versión 2»
y no se puede demostrar qué decía la versión 2.

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
