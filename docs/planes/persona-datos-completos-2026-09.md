# Frente 20 · Lo que falta saber de una persona

**Abierto el 2026-09-05 por decisión del dueño**, con la lista de datos que el sistema todavía no
recoge. Es el siguiente paso natural del frente 14, que sacó de `persons` la identidad —documentos,
correos, teléfonos, direcciones— y la dejó en **once columnas**.

## §0 · Control de ejecución

| Tarea | Qué entrega | Estado | Evidencia | Fecha |
|---|---|:--:|---|---|
| **P0** | Este plan, con el reparto propuesto y las decisiones que faltan | 🟡 | **Pendiente de aprobación del dueño** | |
| **P1** | `parroquias`: la capa que falta en la geografía, sembrada | ⬜ | | |
| **P2** | Los datos que sí son de `persons`: nacimiento, género, autoidentificación, estado civil | ⬜ | | |
| **P3** | `direcciones` gana sector y barrio | ⬜ | | |
| **P4** | `documentos_identidad` gana el tipo de visa | ⬜ | | |
| **P5** | La **salud**: discapacidad, enfermedades catastróficas, alergias, tipo de sangre | ⛔ | Bloqueada por **P8**: son datos de categoría especial | |
| **P6** | `cuentas_bancarias` | ⬜ | | |
| **P7** | `cargas_familiares` y los contactos de emergencia | ⬜ | | |
| **P8** | El RBAC y la LOPDP para los datos sensibles | ⬜ | | |

**9 tareas.** `P1` va primera porque `P2` la necesita: sin `parroquias` no hay lugar de nacimiento
completo.

---

## 1 · De dónde sale, y el reparto propuesto

| Dato pedido | Dónde va | Por qué |
|---|---|---|
| Fecha de nacimiento | `persons` | Es de la persona, uno solo, no cambia |
| **Provincia · cantón · parroquia de nacimiento** | `persons` (tres FK) | Ver §2: **falta una tabla** |
| Género | `persons` | `CHECK`, no catálogo |
| Autoidentificación étnica | `persons` | `CHECK` con la lista del INEC |
| Estado civil | `persons` | `CHECK` |
| Tipo de sangre | **`persona_salud`** | Es dato de salud, y eso decide quién lo ve |
| Discapacidad y su tipo | **`persona_salud`** | `AUDITIVA · FÍSICA · INTELECTUAL · LENGUAJE · VISUAL`, más el porcentaje y el carné del CONADIS |
| Enfermedades catastróficas | **`persona_salud`** | |
| Alergias | **`persona_salud`** | |
| Tipo de visa | `documentos_identidad` | Acertaste: es un atributo del documento, no de la persona |
| Sector y barrio | `direcciones` | Dos columnas más |
| Cuentas bancarias | **`cuentas_bancarias`** | Varias por persona |
| Cargas familiares | **`cargas_familiares`** | Con documento propio, fecha de nacimiento y parentesco |
| Contactos de emergencia | **`expediente_referencias`** | Ver §3 |

## 2 · Falta una capa de geografía: `parroquias`

La geografía llega hoy hasta el **cantón**: `paises` (232) → `provincias` (24) → `ciudades` (221
cantones vigentes del INEC). **La parroquia no existe**, y sin ella no hay lugar de nacimiento
completo — que es exactamente como lo pide una cédula ecuatoriana.

Es la tarea `P1` y va antes que nada. Fuente: el mismo Clasificador Geográfico Estadístico del INEC
del que salieron provincias y cantones.

⚠️ **Y hay que decidir si `parroquias` cuelga de `ciudades`**, que es lo natural, sabiendo que la
tabla se llama `ciudades` y guarda **cantones**. Ese desajuste de nombre ya existe y este frente lo
hereda; conviene resolverlo ahora y no después.

## 3 · Los contactos de emergencia van en `expediente_referencias`

Yo propuse tabla aparte, y el dueño corrigió: **`expediente_referencias` no exige documento**. Puede
llevar el PDF de una carta de recomendación, pero es en el fondo **una agenda de contactos de
referencia** —nombre, vínculo, cargo, institución, correo, teléfono—, que es justo la forma de un
contacto de emergencia.

Así que no hace falta tabla nueva: basta **marcar** cuáles de esas referencias lo son.

⚠️ **Lo que sí hay que revisar es el `CHECK` de `vinculo`.** Hoy admite `laboral · personal ·
familiar`, y un contacto de emergencia suele ser familiar — pero la lista se pensó para referencias
profesionales. Hay que comprobar que sirve para las dos cosas antes de reutilizarla.

## 4 · La salud es categoría especial, y eso cambia el diseño

**Discapacidad, enfermedades catastróficas, alergias y tipo de sangre son datos de salud**, y la
LOPDP los trata como **categoría especial** (Art. 25). No es una etiqueta: cambia el diseño.

| | |
|---|---|
| **Van a tabla aparte, no a `persons`** | Para que el permiso se pueda dar sobre la tabla y no sobre la persona entera |
| **Necesitan su propio recurso RBAC** | El catálogo tiene 13; leer el nombre de alguien no puede autorizar a leer su discapacidad |
| **Quién los ve, decidido y escrito** | Recursos humanos sí; un gestor de procesos, no |
| **La bitácora deja de ser opcional** | El acceso a estos datos debería quedar registrado |

⚠️ Por eso `P5` nace **⛔ bloqueada por `P8`**: recoger el dato antes de decidir quién lo ve es
crear el problema y documentarlo a la vez. El frente 17 ya montó el consentimiento demostrable; esto
se apoya en él.

## 5 · Las tres tablas nuevas

```
persona_salud        1:1 con persons · PK = FK, como los subtipos del frente 18
cuentas_bancarias    N · banco, tipo, número, titular, principal_flag
cargas_familiares    N · nombres, documento propio, fecha de nacimiento, parentesco
```

`cargas_familiares` tiene un detalle que decidir: **su documento**. Puede ser texto, o una fila en
`documentos_identidad` —lo que daría validación de dígito verificador y escaneo gratis, pero obliga a
que esa tabla admita a alguien que **no es una `person`**.

## 6 · Lo que hay que decidir antes de escribir DDL

| | |
|---|---|
| **Los cinco vocabularios nuevos** | Género, estado civil, autoidentificación étnica, tipo de discapacidad y tipo de sangre. ¿`CHECK` o catálogo? El criterio del repo dice `CHECK`; el de género puede necesitar revisión más a menudo que un `CHECK` permite |
| **La autoidentificación étnica** | La lista del INEC es la referencia en Ecuador, pero **el modelo ya no fija Ecuador**: cuál se usa lo decidiría `instituciones.pais_id`, como el documento nacional y el catálogo académico |
| **El documento de una carga familiar** | Texto propio, o fila en `documentos_identidad` |
| **¿La cuenta bancaria es de la persona o del contrato?** | Si el pago cuelga de un contrato, quizá la cuenta también |
| **`parroquias` bajo `ciudades`** | Y qué se hace con el nombre `ciudades`, que guarda cantones |

## 7 · Alcance

**No hay datos en producción**, así que las tablas se crean y la semilla se recrea. Sin `ALTER` en el
esquema, una base viva no las recibe: hay que recrearla, que hoy es gratis.
