# Patrones Reusables de Firma

Este documento fija cómo debe modelarse un patrón reusable de firmas para que varios templates no
repliquen a mano la misma estructura de campos, anchors y pasos. La idea no es que el template deje
de declarar firmas en su `meta.yaml`, sino que esa declaración pueda basarse en un patrón conocido y
estable, mantenido una sola vez y reutilizado por seeds, templates del sistema y, más adelante,
artifacts creados por usuarios.

## Qué problema resuelve

Hoy muchos templates usan el mismo esquema conceptual de firmas. Por ejemplo, en varios documentos
académicos existe la secuencia de `elaborado`, `revisado` y `aprobado`. Si cada template define por
su cuenta los campos del schema, los anchors y los pasos del workflow, terminamos duplicando tres
veces la misma intención:

- en `schema.json`
- en `meta.yaml`
- y luego en la lógica del compilador

Ese modelo funciona al inicio, pero escala mal. En cuanto cambia el tamaño del bounding box, el
nombre de un campo o la forma de inyectar el token de firma, hay que corregir muchos templates a
la vez.

## Principio del patrón reusable

El patrón reusable de firma no debe contener nombres de personas reales ni tokens concretos. Debe
contener solo la estructura reusable del documento:

- qué slots de firma existen
- qué campos necesita cada slot
- qué anchors técnicos existen
- qué pasos del workflow corresponden a cada slot
- qué espera el compilador para inyectar valores reales

Los valores concretos del usuario deben seguir viniendo en tiempo de ejecución desde la base de
datos y desde la resolución operativa del proceso.

## Diferencia entre patrón y datos reales

El patrón reusable define el molde técnico. Por ejemplo, puede decir que existe un slot
`signatures.elaborado.token` y que la estampa debe colocarse donde se renderice ese token.

Pero el patrón no decide cuál es el token final. Ese valor debe resolverse al momento de compilar el
documento. El compilador o renderizador debe tomar el firmante real resuelto por el flujo, leer su
`persons.token` y escribir ese valor en el payload del documento antes del render final. Con eso,
el PDF o el LaTeX resultante ya sale con el token correcto en la posición correcta, y el microservicio
de firma luego solo detecta ese token y estampa encima.

En otras palabras:

- el patrón dice qué slot existe
- el workflow dice quién debe ocupar ese slot
- la base de datos resuelve la persona concreta
- el compilador inyecta el token real de esa persona
- el signer aplica la firma en ese anchor

## Patrón propuesto para DEASY

Se deja como referencia técnica el archivo:

- [three-stage-era.yaml](/home/fresvel/Sharepoint/DIR/Deploy/deasy/tools/templates/patterns/signatures/three-stage-era.yaml)

Ese patrón modela la secuencia más común que hoy vemos en los templates académicos:

- `elaborado`
- `revisado`
- `aprobado`

Cada slot define cuatro campos lógicos:

- token
- nombre
- cargo
- fecha

Además, el patrón define:

- `anchors`
- `steps`
- y el `compiler_contract` necesario para que el compilador sepa qué valores runtime debe inyectar

## Qué debería hacer un template con este patrón

Un template que use este patrón no debería volver a inventar toda la estructura. Lo correcto sería:

1. declarar qué patrón usa
2. heredar o materializar desde él los campos del schema de firma
3. heredar o materializar desde él los anchors
4. heredar o materializar desde él los pasos del workflow
5. permitir overrides solo cuando el documento realmente lo necesite

Eso significa que el patrón reusable no reemplaza por completo al `meta.yaml`, sino que sirve como
fuente de una parte repetible de su contenido.

En la transición actual del proyecto, el template todavía mantiene `anchors` y `steps`
materializados en su propio `meta.yaml`, porque el sync hacia MariaDB ya opera sobre esa forma. Por
eso el uso práctico hoy es mixto: el template declara `pattern_ref` para dejar explícito el patrón
que adopta, pero conserva también la definición concreta que el backend ya sincroniza. De esa
manera ganamos trazabilidad y validación sin romper el flujo operativo actual.

## Contrato esperado para el compilador

El compilador documental futuro debe asumir este comportamiento:

1. recibe el template ya resuelto
2. recibe el documento con su payload de llenado
3. recibe la resolución de firmantes para cada slot
4. para cada slot, toma desde la base:
   - `persons.token`
   - nombre visible
   - cargo visible
   - fecha operativa si aplica
5. inyecta esos valores en los `field_refs` correspondientes
6. renderiza el documento final con los tokens visibles en las posiciones previstas

Si el documento es de sistema y tiene plantilla vigente, esta inferencia sí debe ser automática.
Ese es justamente el caso donde el artifact del sistema ya conoce su patrón técnico y el proceso ya
conoce la política de quién debe llenar y firmar.

## Qué pasa con templates de usuario

En templates de usuario la idea sigue siendo la misma, pero con una exigencia adicional: el usuario
debe declarar el flujo de firma o elegir un patrón conocido. Si no lo hace, el artifact no debería
considerarse listo para sincronizarse como entregable firmable.

Eso evita que entren al sistema plantillas subidas manualmente que tengan archivo, pero no contrato
técnico suficiente para saber cómo llenarlas o firmarlas.

## Recomendación operativa

La recomendación práctica para la siguiente etapa es:

1. mantener el patrón reusable en `tools/templates/patterns/signatures/`
2. permitir que seeds y templates lo referencien de forma explícita
3. seguir sincronizando a MariaDB el resultado materializado
4. cuando exista el compilador, hacer que lea el patrón y no solo los campos sueltos del template

Con eso el patrón común de firmas no desaparece. Al contrario, queda formalizado como una pieza
técnica reusable y deja de estar implícito o repetido a mano.
