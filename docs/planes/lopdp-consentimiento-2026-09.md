# Frente 17 · LOPDP: consentimiento demostrable y textos legales versionados

> **Qué persigue:** que el sistema pueda **PROBAR** que alguien aceptó, como exige el **Art. 5 del
> Reglamento** de la LOPDP. Hasta el 2026-09-02 la casilla se validaba **en el navegador** y no se
> guardaba **nada**.

El diseño y las mediciones viven en
[`../arquitecturas/documentos-legales-versionados.md`](../arquitecturas/documentos-legales-versionados.md)
y [`../arquitecturas/lopdp-y-consentimiento.md`](../arquitecturas/lopdp-y-consentimiento.md).
Los textos para el área jurídica, en [`../legal/`](../legal/).

---

## §0 · Control de ejecución

| Tarea | Qué entrega | Estado | Evidencia | Fecha |
|---|---|:--:|---|---|
| **L1** | Las **dos casillas** y su registro demostrable dentro de la transacción del alta | ✅ | Tablas `documentos_legales` y `consentimientos` · la validación se muda del navegador **al backend** · se guarda versión, **huella del texto** e ip · char **327/327** · el enlace a `persons` va **sin clave ajena** a propósito (Art. 18.4 de la Ley y 11.2 del Reglamento: la prueba sobrevive a la persona) | 2026-09-02 |
| **L2** | **La barrida de conversaciones**: un chat cuyo número nunca se verificó se borra | ✅ | Regla del dueño, tal cual: *si el número del chat tuvo alguna vez una verificación correcta, no se borra*. Sin tabla nueva — `telefono_verification_keys` **no se borra nunca** y el `JOIN` ya lo contesta · channels **104** (+8, **3 mutaciones cazadas**: tratar «no contesta» como «ninguno verificado», borrar grupos, y no dar periodo de gracia) · **cableada y APAGADA**: sólo `BARRIDA_CONVERSACIONES=1` la enciende, y el arranque lo dice | 2026-09-02 |
| **L3** | Los **borradores jurídicos** para revisión del área legal | ✅ | Términos de uso y tratamiento de datos, con `⟦corchetes⟧` en lo que la institución debe rellenar · escritos **citando la Ley y el Reglamento verbatim** tras leerlos (la primera versión salió de memoria y **estaba mal**) · ⏳ **pendientes del área legal**, que no es trabajo nuestro | 2026-09-02 |
| ~~**L4**~~ | ~~El **sello de verificación**~~ | ❌ | **DESCARTADO POR EL DUEÑO, entero.** Sus tres propósitos cayeron uno a uno: como **no repudio**, *«tú tenías la llave, tú pusiste el número, nada te impedía crear el sello sin mi intervención»* — correcto; para **hacer aplicable la retención**, el `JOIN` ya la contesta; para **auditoría interna**, es legítimo pero no justifica un bucket irreversible de 10 años. Con él cayeron dos inventos míos: la tabla `verificaciones_historicas` y las huellas HMAC con *pepper*. Ver §2 | 2026-09-02 |
| **L5** | Los **dos buckets** y un arranque **fail-closed** | ✅ | **Infraestructura HECHA y medida** en la pila C: `deasy-legal` con `COMPLIANCE 1DAYS` por defecto y `deasy-legal-borradores` sin bloqueo, ambos versionados · un objeto subido **sin pedir retención** sale con `X-Amz-Object-Lock-Mode: COMPLIANCE` · `mc rm --versions` y `mc rb --force` **rechazados** · los tres caminos de fallo del script ejercitados de verdad. **Y la mitad del backend hecha**: `asegurarBuckets()` comprueba **pidiendo la configuración de bloqueo**, no creando el bucket — porque `mc mb --with-lock --ignore-existing` sobre uno que ya existe sin bloqueo responde «created successfully» y **código 0**. Hay mutación que caza justamente deducirlo de `makeBucket` | 2026-09-02 |
| **L6** | El texto **sale de la base**: borrador en MinIO, con historial de edición | ✅ | Columna `texto` fuera del esquema (**−272 líneas**, semilla literal incluida) · `ArchivoLegal.js` con **24 pruebas** · **se lee SIEMPRE por `object_version_id`** · hallazgo nuevo contra MinIO real: `listObjects` con versiones **devuelve los delete markers como una entrada más**, y sin filtrarlos un borrado se tomaría por un documento | 2026-09-02 |
| **L7** | **Publicar** = copiar bytes → releer por `version_id` → comparar huella → sellar la fila | ✅ | `publicar()` **retira la versión vigente de la misma clase en la misma transacción** (lo exige el índice único parcial) · `publicados()` **verifica la huella en cada lectura** · **12 de 12 mutaciones cazadas** · backend unit **819** (+52) · `/legal/documentos` **no movió su contrato**: mismos campos y mismas huellas | 2026-09-02 |
| **L8** | La **pestaña de administración** (`draft`/`published`/`retired`) + RBAC | ✅ | **Verificada en el navegador contra el backend real**: crear borrador → escribir → guardar (aparece la huella) → historial (2 versiones de OBJETO) → confirmación de publicar → cancelar, con **cero mensajes de consola** · frontend **489** pruebas (30 ficheros) · **las 27 puertas en verde** y `lint:css` sigue en **0** · **13 de 13 mutaciones cazadas** · **cero CSS nuevo**: todo sale de los componentes y `estadoTono.js` · el archivo **no se pinta verde sin COMPLIANCE** (`GOVERNANCE` es ámbar: quien tenga el permiso *puede levantarlo*, y decirle a la institución que es inviolable sería mentirle) | 2026-09-02 |
| **L9** | La **semilla v1**, por el patrón `/import` que ya existe | ✅ | **Los OBJETOS ya están** en `docker/minio/import/Legal/`, subidos y verificados: las huellas del texto **sobreviven al viaje por MinIO** y cuadran con las que declaraba el SQL (`5e9e846e…` y `9a6773a5…`). Segunda corrida: `0 B transferred`, no sobrescribe. Comprobado además que los borradores de `docs/legal/` **NO son** el texto sembrado — son otros, y menos mal que se miró. **Y la fila la crea `adoptarDelArchivo()`**, que no puede ser un `INSERT` estático porque el `object_version_id` no existe hasta después de subir. Hace **dos** cosas: tabla vacía → indexa; filas legadas sin puntero → **las sella, y SÓLO si la huella cuadra**. Verificado en vivo: las 2 filas de la pila C quedaron selladas con su versión real **sin que la huella cambiara**, lo que prueba que el texto archivado es el mismo que aceptaron los consentimientos existentes | 2026-09-02 |
| **L10** | **Limpieza integral** de código muerto | 🟡 | **Inventario hecho** (2026-09-02): [`inventario-codigo-muerto-2026-09.md`](./inventario-codigo-muerto-2026-09.md) · **15 candidatos ALTA**, 8 marcados **NO TOCAR**, y **3 creencias mías corregidas** — entre ellas que `storage-init` era configuración muerta, que **no lo es**. Falta ejecutar | 2026-09-02 |

**9 tareas vivas · 8 cerradas · 1 pendiente** (`L10`, la limpieza).

⚠️ **El denominador subió de 4 a 9 el 2026-09-02**, y no por descubrir trabajo nuevo: lo que era
*«falta el archivo inmutable»* —una casilla— resultó ser **seis tareas** al medir cómo se comporta de
verdad el bloqueo de objetos. `L4` sale de la cuenta por descartada, no por hecha.

---

## §1 · Las tres decisiones del dueño, con su porqué

| Decisión | |
|---|---|
| **Dos casillas, no una** | El **Art. 8** exige que el consentimiento sea **específico**, y que con varias finalidades **conste para todas**. Además los términos son un **contrato** (Art. 7.5), no consentimiento de datos: mezclarlos en una casilla haría que revocar el consentimiento pareciera rescindir el contrato |
| **La barrida, sólo en producción** | En dev los números son de prueba. Se enciende cuando la línea dedicada sea **una cuenta limpia** |
| **Retención por entorno** | **1 día en dev, 3650 en producción.** `test:char:run` resetea la base pero **no** MinIO: con 10 años, cada corrida dejaría documentos indelebles acumulándose para siempre |

### Y una que se descartó: la retención **no** se configura desde `instituciones`

Se preguntó si podía ajustarse desde la tabla y el bootstrap. **No**, por cuatro razones, y la
primera basta:

1. **El mando mentiría.** COMPLIANCE **no permite acortar**: subirla afecta a los objetos nuevos,
   **bajarla no toca los ya escritos**. Quien la bajara de 10 años a 1 vería «guardado» y no pasaría
   nada. *Un ajuste que no hace lo que dice es peor que no tenerlo.*
2. **Es una decisión jurídica**, no una preferencia: el plazo sale de la prescripción de acciones.
3. **El ámbito no cuadra.** `instituciones` es por institución; el bucket es **por despliegue**. Con
   dos instituciones, ¿cuál retención gana? El modelo no lo contesta.
4. **El orden no da.** La capacidad de bloqueo se fija **al crear** el bucket — antes de que la tabla
   tenga datos.

**Lo que sí se hace:** variable de entorno, y la retención **efectiva se lee del bucket** y se enseña
en el admin de **sólo lectura**. La institución puede **verificarla** sin poder romperla.

---

## §2 · Por qué murió el sello, y qué se aprendió

El sello iba a ser un registro firmado de cada verificación, en un bucket WORM. Se defendió como
prueba de **no repudio** hasta que el dueño puso el caso en la mesa:

> *«Yo me registré con el número AA, luego borré los mensajes. Voy a la empresa y digo que yo nunca
> envié esa confirmación. Tú quieres comprobarlo con tu base, y yo digo: tú tenías la llave, tú
> pusiste el número, nada te impedía crear el sello sin mi intervención.»*

**Tiene razón, y el error de fondo era mío**: yo estaba ordenando las pruebas por **durabilidad**
—qué tan difícil es alterarlas— cuando lo que importa es **quién pudo haberlas producido**. Nada que
construyamos nosotros solos prueba que actuó la otra parte. El único rastro con esa propiedad está
**en el teléfono de la persona y en los servidores de la plataforma**, y no es nuestro.

Con el sello cayeron **dos cosas que yo había inventado**:

| | Por qué sobraba |
|---|---|
| Tabla `verificaciones_historicas` | La justifiqué con *«y si cambió de teléfono»* — y resulta que **borrar esa conversación es lo correcto**: la base legal era *«este número interactúa con nosotros»*, y ya no lo hace |
| Huellas **HMAC** con *pepper* | Las propuse *«para no guardar el número»*, y **ya lo guardamos en claro** en `telefonos`, con base legal. Cifrar una copia del mismo dato es ceremonia |

⚠️ **Queda escrito porque se llegó a él discutiendo.** Sin este apartado, alguien lo vuelve a
proponer dentro de seis meses.

---

## §3 · Dos agujeros que aparecieron **al integrar**, no al construir

Ninguno lo vio un agente trabajando en su parte. Los dos salieron de medir el sistema entero.

### ⚠️ El reset dejaba el consentimiento sin nada que exigir — **y en verde**

Al mudar el texto a MinIO, la fila que indexa el objeto pasó a crearla la **adopción**, que corría
sólo **al arrancar el backend**. Pero `test:char:fixture` —y cualquier reset— **vacía la base sin
reiniciar el backend**. Medido:

```
antes del reset   2 filas · GET /legal/documentos -> los dos textos
despues del reset 0 filas · GET /legal/documentos -> {"documentos":[]}
```

**Y lo grave no es el vacío, sino que nadie se enteraba.** `idsDeConsentimiento` devuelve `[]`, el
alta lo acepta, y `validarAceptacion` da por **válida** una lista vacía porque no hay clases
publicadas que exigir. El registro seguía verde **sin registrar un solo consentimiento** — el mismo
agujero que este frente vino a cerrar, reabierto por otro camino.

**Cierre:** `conectarArchivoLegal()` tras el commit de `initialize` **y** de `recoverAdmin`, que es
donde ya se siembra el catálogo RBAC. Best-effort y después del commit: un MinIO caído no debe tumbar
una instalación que ya funcionó.

**Y su prueba, vista fallar antes de darla por buena:** el flujo nuevo
`tests/characterization/flows/legal.test.mjs` lleva **aserciones explícitas**, no sólo un golden —
*un snapshot de `[]` se captura tan contento y congela el fallo*. Con el enganche desactivado a
propósito, la prueba falla y el mensaje apunta al arreglo.

### ⚠️ La puerta de la documentación **no vigilaba las tablas nuevas**

`check-doc-modelo.mjs` daba **verde con `documentos_legales` cambiada**. El motivo:

```
tablas con huella grabada: 77   de 82
sin huella: documentos_legales · consentimientos · intentos_limitados · canales_bitacora  (+1)
```

El filtro es `huellasGrabadas[t] && huellasGrabadas[t].huella !== v.huella`: una tabla **que no está
en el fichero de huellas se salta en silencio**. La puerta B (tabla sin página) sí las cazaba; la
**C —la que avisa de que una tabla cambió— no llegaba a mirarlas**.

Se re-grabaron las **82**, así que a partir de ahora sí. ⚠️ **Pero el hueco sigue abierto para la
próxima tabla nueva**: entre que se crea y que alguien corre `--update`, su deriva no se vigila. Y el
mensaje de éxito —*«82 tablas con página y huella al día»*— **decía la verdad de 77**.
