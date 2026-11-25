# Patrones de diseño en Deasy — dónde sí, dónde no, y por qué

> **Para qué sirve este documento.** Responde a una pregunta concreta: *«¿puedo usar patrones de
> diseño para que el código se entienda mejor y sea menos complejo?»*. La respuesta corta es **sí,
> pero en tres sitios, no en veinte** — y el resto de la complejidad de este proyecto se cura con
> algo más aburrido y más efectivo.
>
> **Documento de criterio, no de catálogo.** El catálogo (22 patrones, 66 técnicas, 23 olores) está
> en el skill `refactoring-guru`. Aquí solo está lo que aplica **a este repositorio**, con la
> evidencia medida que lo respalda.
>
> Complementa a `docs/planes/referencia/calidad-y-medicion.md`, que es el documento maestro y manda si hay conflicto.
> Escrito el **2026-08-09**.

---

## 1. La conclusión, antes que nada

> **La complejidad de Deasy no viene de que falte polimorfismo. Viene de duplicación y de cascadas de
> condicionales defensivos.** Lo que ha funcionado aquí, cuatro veces medidas, no es un patrón GoF:
> es **convertir condicional en datos** y **extraer**.

Cuatro casos de este repositorio, todos con cifras de Sonar antes y después:

| Caso | Antes → después | Qué lo curó |
|---|---:|---|
| `validateTableRules` (cut #10) | 99 → **0** | *Replace Conditional with Registry* |
| `postgres.js` (fase F) | 108 → **15** | Tabla de *spans* + un solo recorrido |
| `useAdminSubmitFlow` (fase E-5) | 67 → **~7** | Tabla `CREATED_ROW_BY_TABLE` + *Extract* |
| `saveTemplateArtifactDraft` (fase C) | 164 → **21** | *Extract Method* y, para el núcleo, **Command** (§3.1) |

**El caso de `postgres.js` es el que mejor lo enseña.** Se atacó pensando «esto reescribe dialecto
SQL, hazlo declarativo». El hallazgo real fue que **las dos funciones eran el mismo autómata copiado
palabra por palabra**: cinco banderas de estado y diez ramas de `continue` cada una. El olor era
*Duplicate Code*, no *Switch Statements*. Un patrón habría añadido clases sin tocar la causa.

**Moraleja operativa: antes de elegir patrón, busca duplicación.** En este proyecto es la apuesta con
mejor retorno, y dos veces ha resultado ser la respuesta cuando parecía otra cosa.

---

## 2. Los tres olores recurrentes de este código

Diagnóstico sobre el ranking real de complejidad (§3 del plan maestro), no sobre impresiones.

| Olor | Dónde se manifiesta | Tratamiento que aquí funciona |
|---|---|---|
| **Duplicate Code** | `postgres.js` (curado), `createZipArchive` en 3 ficheros, `AgregarCapacitacion`/`AgregarExperiencia`, `user_controler` (17,4 %) | *Extract*, y comprobar si son literalmente el mismo bloque antes de teorizar |
| **Cascada de condicionales defensivos** sobre formas heterogéneas | Bloque de identidad del signer, `bindParams` (curado), adaptadores de presentación del admin | **Tabla de manejadores probados en orden** |
| **Long Method / lógica en la capa equivocada** | Controllers con transacciones dentro (fase D), composables-monolito | *Extract Method* → *Move Method* a un servicio |

Ninguno de los tres se cura con una jerarquía de clases.

---

## 3. Dónde un patrón GoF SÍ se gana el sueldo

Tres. Solo tres.

### 3.1 · **Command** para la compensación de `saveTemplateArtifactDraft` — el mejor encaje del repo

**Estado: ✅ HECHO el 2026-08-09 (fase C). CC 164 → 21**, y deja de ser la peor función del repo. El
patrón hizo exactamente lo que se esperaba: **respondió a la pregunta de diseño que bloqueaba el
corte**, y con ella tres de las cuatro variables compartidas desaparecieron.

Lo que más valor tiene, y que no se ve en la métrica: **dos invariantes pasaron de «hay que
acordarse» a «se cumplen solas»** — solo se deshace lo que esta llamada hizo, y se deshace en orden
inverso. Antes eran dos comentarios pidiendo cuidado; ahora son consecuencia de desapilar.

**El aviso que sí se cumplió**, y conviene retener para el próximo: extraer la cascada de validación
llevó la función de 59 a 32 **pero el extraído se quedó en 25** — o sea, el total apenas se movió.
Separar por *responsabilidad* (disco / base de datos / compensación) bajó la métrica; separar por
*tamaño* solo la repartió.

§5-C dice que lo que queda (CC 76) no se puede extraer porque *«hay que decidir antes **quién posee la
compensación**»*. Hoy el `try` de persistencia comparte con su `catch` cuatro variables
—`createdId`, `uploadedToMinio`, `insertedDeliverableId`, `insertedLinkId`— porque **no hay
transacción** y el `catch` deshace a mano lo que se llegó a hacer.

Eso es el olor **Temporary Field** en estado puro: campos que solo tienen sentido a medias de una
operación. Y la pregunta «quién posee la compensación» **es exactamente la que Command responde**:

- Cada paso (crear el `deliverable`, subir a MinIO, insertar el `template_artifact`, vincular la
  configuración) es un objeto con **`ejecutar()` y `deshacer()`**.
- Se apilan según se ejecutan.
- El fallo desapila e invoca `deshacer()` en orden inverso.

Las cuatro variables desaparecen porque **cada compensación vive dentro de su paso**, que es su único
dueño legítimo. Es el patrón estándar para una saga sin transacción.

**Sutileza que hay que conservar**, y que ya está documentada: `_linkDraftToProcessDefinition`
devuelve el id del vínculo **solo si lo insertó esa llamada**, y `null` si ya existía — precisamente
para que el `catch` solo borre lo que insertó él. Con Command esa lógica deja de ser un valor de
retorno con truco y pasa a ser el estado interno del paso.

**Aviso:** esto **no es un refactor**. Cambia el manejo de errores, así que puede mover goldens. Va en
su propio commit, con la caracterización delante y `zzz_artifact_draft` como red.

### 3.2 · **Cadena de extractores** para la identidad de certificados del signer

**Estado: ✅ HECHO el 2026-08-09 (fase F).** El bloque pasa de **142 a 84** puntos y el fichero de
**355 a 297**; `extract_certificate_extensions` cae de **40 a 2** y con ella desaparece el anidamiento
máximo del repo. Ninguna función del bloque supera 9.

Se confirmó el patrón —una tabla de filas `(reconoce, produce)` recorrida por un motor de 6 líneas—
**y se confirmó otra vez la tesis de este documento: el bulto no lo quitó el patrón, lo quitó la
duplicación que el patrón dejó ver.** `parse_distinguished_name_text` tenía el mismo bucle de
acumulación escrito dos veces; `to_asn1_certificate`, dos `try/except` idénticos; y
`extract_name_attributes`, ocho `if` consecutivos que eran un diccionario.

**Un detalle de diseño que merece copiarse:** el `try` vive **en cada productor, no en el motor**, para
que un paso que hoy no tolera excepciones siga sin tolerarlas. Meterlo en el motor habría sido más
elegante y habría cambiado comportamiento en silencio. Hay un test que fija justo eso.

**Y dos casi-duplicados que NO se fusionaron**, que es la otra mitad del criterio: `get_status_attr`
usa `hasattr` (presencia) y se detiene en un atributo que existe y vale `None`, mientras que sus
cuatro parientes usan «el primero no nulo». Se parecen; no son lo mismo.

430 líneas, **6 de las 8 funciones complejas** del peor fichero del repositorio, y todas hacen lo
mismo: *«dado un certificado con forma impredecible, prueba varias maneras de sacar este dato»*.

Es **Chain of Responsibility**, pero en su forma ligera: **una lista de extractores probados en
orden**, guiada por datos, no una jerarquía de clases. Idéntica transformación a la que curó
`postgres.js`.

Y es el mejor sitio del proyecto para hacerlo, por un motivo que no es estético: **ese bloque no toca
red, ni disco, ni criptografía**, así que es trivial de cubrir con pruebas puras. Ya está al 88 %.

### 3.3 · **Instancia propia** (Adapter) para `httpClient`

**Estado: ✅ HECHO el 2026-08-09 (fase E-4).** De 30 importadores de axios crudo a **uno solo**, que
es el propio módulo. Confirmó la tesis de este documento: **no hacía falta un patrón, hacía falta el
objeto** — `axios.create()` y el problema se disuelve. Detalle y deuda residual en §5-E.4 del plan.

`core/services/httpClient.js` **no es un cliente**: no llama a `axios.create()`, registra el
interceptor sobre el **singleton global** y reexporta el mismo objeto. 31 ficheros importan axios
crudo y solo 2 el módulo. La cabecera `Authorization` de toda la aplicación **depende del orden de
imports**.

Aquí no hay un patrón mal elegido: **falta el objeto**. `axios.create()` da una instancia real, con su
configuración encapsulada, y el problema se disuelve. Es el caso más humilde de los tres y
probablemente el de mayor impacto en fiabilidad: ya rompió una suite entera durante semanas.

---

## 4. Dónde NO meter patrones (esto vale más que la sección anterior)

**No apliques State a la máquina de `fill_requests`.** Es el candidato que *parece* obvio —hay
estados, hay transiciones, hay un `switch` mental— y sería un error: `assertFillActionAllowed`
**ya es una tabla** (`allowedByAction`), sana y legible. La complejidad está en las ~103 líneas de
orquestación transaccional de alrededor, y eso se cura **sacándolo a un servicio**, no con cinco
clases de estado que no bajarían ni un punto.

**No polimorfices `AdminTableManager`.** §7 del plan ya lo prohíbe y tiene razón: es un motor de
metadatos legítimo. Su peso son **dos injertos concentrados**, que es el olor de *«no injertes casos
especiales en el camino genérico»* (regla 3 de `CLAUDE.md`). Se extraen como paneles propios. Sin
herencia.

**No conviertas `useDeliverableView` en dueño de su estado.** Está medido que es una proyección de
solo lectura (0 asignaciones `.value =`); hacerlo **invertiría** el acoplamiento.

**No unifiques `UnitGraphView` con `ProcessGraphView`.** 17 % de similitud y dominio irreducible: es
duplicación aparente, no real.

**Y no busques un Strategy.** No hay ningún sitio en el repo donde haga falta intercambiar algoritmos
en tiempo de ejecución. Si aparece uno, será una excepción justificada, no la regla.

---

## 5. El límite que ningún patrón cruza

Los tres peores ficheros del repositorio son **componentes Vue**:

| Cogn. | Fichero |
|---:|---|
| 350 | `home/views/HomeView.vue` |
| 290 | `admin/components/tables/AdminTableManager.vue` |
| 262 | `firmas/components/FirmarPdf.vue` |

Son **900 puntos, el 11 % de toda la complejidad del proyecto**, y **ningún patrón GoF le hace nada a
un `<template>` de 2 000 líneas**. `HomeView` son 2 117 líneas de plantilla más 3 113 de script;
Sonar ni siquiera separa los bloques del SFC.

Su única cura es **extraer componentes** y bajar la lógica a composables. Es trabajo artesanal, se
verifica en el navegador y no admite atajos. Cualquier plan de patrones que no diga esto está
vendiendo humo.

---

## 6. Cómo decidir, en cinco preguntas

Antes de introducir cualquier patrón, en este orden:

1. **¿Es duplicación?** Diffea los dos bloques de verdad. En este repo ha sido la respuesta dos veces
   cuando parecía otra cosa. Si lo es, *Extract* y para.
2. **¿Es una cascada de condicionales sobre datos?** Entonces es una **tabla**, no una jerarquía.
   Cuatro casos medidos lo respaldan.
3. **¿Hay un eje real de variación?** Si nada varía en tiempo de ejecución, **no hay patrón que
   aplicar**. Un patrón es un coste —indirección y piezas—, no un premio.
4. **¿Tengo red?** Un patrón reorganiza el flujo de control; sin caracterización o unitarios delante,
   no se distingue «lo mejoré» de «lo rompí». En este proyecto la red **va primero, siempre**.
5. **Al terminar, ¿hay menos piezas o más?** Si hay más piezas y la misma complejidad, deshazlo.
   *Code is liability.*

Y la regla que engloba a todas: **refactor = mover código, NO reescribir comportamiento**. Si cambias
qué hace algo, no es un refactor — es un cambio, va en otro commit y puede mover goldens.

---

## 7. Documentos relacionados

| Documento | Rol |
|---|---|
| `docs/planes/referencia/calidad-y-medicion.md` | **Documento maestro.** Estado de las fases (§5.0), ranking de complejidad y lo que NO hay que tocar (§7) |
| `docs/planes/referencia/cobertura.md` | **La cobertura tiene plan propio**, porque es otro problema |
| `docs/planes/referencia/signer.md` | Mapa por bandas de `signer/app.py` y sus 12 riesgos |
| `docs/planes/referencia/god-objects-2026-07.md` | Bitácora de los 10 cortes: aquí está el *qué*, allí el *cómo se hizo* |
| skill `refactoring-guru` | El catálogo completo: 22 patrones, 66 técnicas, 23 olores |
| skill `tailadmin-ui` | La fuente de diseño adoptada (2026-08-13): su paleta y su markup, **no** su código Vue |
