# Frente 20 · Lo que falta saber de una persona

**Abierto el 2026-09-05 por decisión del dueño**, con la lista de datos que el sistema todavía no
recoge. Es el siguiente paso del frente 14, que sacó de `persons` la identidad —documentos, correos,
teléfonos, direcciones— y la dejó en **once columnas**.

## §0 · Control de ejecución

| Tarea | Qué entrega | Estado | Evidencia | Fecha |
|---|---|:--:|---|---|
| **P0** | Este plan, con el terreno medido y las decisiones que faltan | 🟡 | Medido el 2026-09-05: la fuente del INEC, el RBAC real y la cadena geográfica. **Pendiente de aprobación** | |
| **P1** | `parroquias`: la capa que falta en la geografía, sembrada | ⬜ | | |
| **P2** | Lo que sí es de `persons`: nacimiento, género, autoidentificación, estado civil | ⬜ | | |
| **P3** | `direcciones` gana sector y barrio | ⬜ | | |
| **P4** | `documentos_identidad` gana el tipo de visa | ⬜ | | |
| **P5** | La **salud**: discapacidad, enfermedades catastróficas, alergias, tipo de sangre | ⛔ | Bloqueada por **P8** | |
| **P6** | `cuentas_bancarias` | ⬜ | | |
| **P7** | `cargas_familiares`, y los contactos de emergencia sobre `expediente_referencias` | ⬜ | Depende del frente 18 | |
| **P8** | El recurso RBAC de los datos sensibles, y su bitácora | ⬜ | | |
| **P9** | El frontend: `/perfil/datos` y las pestañas de administración | ⬜ | | |

**10 tareas.** `P1` va primera —`P2` la necesita— y `P8` va **antes** que `P5`.

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
| **Bitácora de acceso** | Aquí deja de ser opcional |

**Se apoya en lo que el frente 17 ya dejó hecho** —consentimiento demostrable, documentos legales
versionados y una pestaña de administración con RBAC—, así que `P8` no parte de cero.

Por eso **`P5` nace ⛔ bloqueada por `P8`**: recoger el dato antes de decidir quién lo ve es crear el
problema y documentarlo a la vez.

## 4 · El reparto

| Dato pedido | Dónde va | Nota |
|---|---|---|
| Fecha de nacimiento | `persons` | |
| **Provincia · cantón · parroquia de nacimiento** | `persons`, tres claves ajenas | Necesita `P1` |
| Género | `persons` | `CHECK` |
| Autoidentificación étnica | `persons` | `CHECK` con la lista del INEC |
| Estado civil | `persons` | `CHECK` |
| Tipo de sangre | **`persona_salud`** | Es dato de salud |
| Discapacidad, tipo y porcentaje | **`persona_salud`** | `AUDITIVA · FÍSICA · INTELECTUAL · LENGUAJE · VISUAL` |
| Enfermedades catastróficas | **`persona_salud`** | |
| Alergias | **`persona_salud`** | |
| Tipo de visa | `documentos_identidad` | Es atributo del documento, no de la persona |
| Sector y barrio | `direcciones` | Dos columnas |
| Cuentas bancarias | **`cuentas_bancarias`** | Varias por persona |
| Cargas familiares | **`cargas_familiares`** | Con documento propio, fecha de nacimiento y parentesco |
| Contactos de emergencia | **`expediente_referencias`** | Ver §5 |

### Las tres tablas nuevas

```
persona_salud       1:1 con persons · PK = FK, el patrón de subtipo del frente 18
cuentas_bancarias   N · banco, tipo, número, titular, principal_flag generada
cargas_familiares   N · nombres, documento, fecha de nacimiento, parentesco
```

`persona_salud` reutiliza el idioma que el frente 18 ya fijó: **clave primaria que es a la vez la
ajena**, con `ON DELETE CASCADE`. `cuentas_bancarias` reutiliza el `principal_flag` generado con
índice único parcial que `direcciones` ya usa.

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

## 6 · Lo que hay que decidir antes de escribir DDL

| | |
|---|---|
| **Los cinco vocabularios nuevos** | Género, estado civil, autoidentificación étnica, tipo de discapacidad, tipo de sangre. ¿`CHECK` o catálogo? El criterio del repo dice `CHECK`; el género puede necesitar revisarse más a menudo de lo que un `CHECK` permite |
| **La autoidentificación étnica** | La lista del INEC es la referencia en Ecuador, pero **el modelo ya no fija Ecuador**: cuál se usa lo decidiría `instituciones.pais_id`, como el documento nacional |
| **El documento de una carga familiar** | Texto propio, o fila en `documentos_identidad` — lo que daría validación de dígito verificador y escaneo gratis, pero obliga a que esa tabla admita a alguien que **no es una `person`** |
| **¿La cuenta bancaria es de la persona o del contrato?** | Si el pago cuelga de un contrato, quizá la cuenta también |
| **`ciudades` → `cantones`** | Renombrar ahora, o convivir con el desajuste |
| **Quién ve la salud** | La propuesta es `AdminSistema` + `GestorTalentoHumano`. Es decisión del dueño |

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
