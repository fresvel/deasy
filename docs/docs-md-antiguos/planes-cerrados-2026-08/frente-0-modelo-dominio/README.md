# Frente 0 — limpiar el modelo antes de seguir refactorizando

> **CERRADO en 9 de 9 el 2026-08-13. Archivado el 2026-08-14.** No hay tareas aquí.
> Lo pendiente vive en [`docs/planes/plan-maestro-2026-08.md`](../../../planes/plan-maestro-2026-08.md).

| Fichero | Qué es |
|---|---|
| [`bitacora.md`](./bitacora.md) | **El frente entero**, tal y como se ejecutó: las nueve fichas, los ocho sub-pasos del §0.8 con su commit y su medición, y los cuatro hallazgos que tumbaron el plan escrito |
| Este README | Cómo acabó, **qué quedó vivo**, y qué se aprendió que ya no está solo aquí |

---

## Por qué existió

Abierto el **2026-08-09** con un diagnóstico de una frase: **el código contenía su propia necrológica
y la desmentía a la vez.** El caso testigo fue `document_owner` —declarado retirado en un comentario y
vivo 250 líneas más arriba **en el mismo fichero**—, y no fue anécdota: un agente con acceso completo
al repo leyó ese comentario, lo dio por bueno y salió con el modelo equivocado. Hizo falta consultar
la base de datos para verlo.

Iba delante de todo lo demás **por orden, no por gravedad**: el resto del plan refactoriza, y
refactorizar sobre un modelo que se contradice es trabajar sobre arena.

## Cómo acabó

| § | Qué era | Cierre |
|---|---|---|
| **0.1** | El propietario del entregable se resolvía con el puesto de la **tarea**, no el del entregable: un alias eclipsaba la columna | `0790c7c` |
| **0.2** | ¿Hacía falta el resolver `document_owner`? **No.** Retirado del `CHECK` | `94c56c4` |
| **0.3** | `BASE_META_YAML`, la puerta trasera del bootstrap — y **el único productor vivo** de ese resolver | `30654db` |
| **0.4** | El generador: de la base al Jinja, para que la firma no se coloque a mano. S1–S7 hechos; **el S8 se movió al frente 10** | 2026-08-13 |
| **0.5** | El vocabulario del entregable: **cuatro nombres, cuatro cosas** | `f5cf457` |
| **0.6** | Censo de fósiles del camino viejo: **18 elementos, cada uno con veredicto escrito** | `f5fa889`+`92e7e21`+`2c1b17f` |
| **0.7** | La documentación mentía en dos direcciones: **34 afirmaciones falsas** corregidas | 2026-08-11 |
| **0.8** | **Invertir la dirección del flujo**: la base manda, el YAML se va. Ocho sub-pasos de backend | 2026-08-11 |
| — | La fusión `task_items`/`documents` (pasos 3 y 4) | **No se ejecutó** — ver abajo |

**El criterio que lo abrió es el que lo cerró, y se midió:** cero `document_owner` en la base, cero
`meta.yaml` bajo `System/tpl_informe_general/`, y el vínculo del Proceso por defecto de 1 flujo a 0.

---

## Lo que quedó vivo — y dónde está ahora

Tres cosas salieron de aquí sin terminar. **No se pierden al archivar porque están en el maestro**;
esta lista es el índice, no su ficha.

1. **El botón de sincronizar del frontend da 404.** Era el sub-paso 9 del §0.8 y es lo único que no se
   hizo de ese sub-plan. `apiConfig.js:101-102` sigue declarando `sync-status` y `resync`, y
   `AdminTableManager.vue:796,804` + `AdminRecordViewerModal.vue:180-188,286-318` cablean el botón —
   contra endpoints que **el sub-paso 8 borró**. Verificado el 2026-08-14: siguen ahí. → **frente 7**.
2. **El S8, el generador de Jinja.** No se abandonó: **se movió al frente 10**, porque no es limpieza
   sino construcción, y su mitad de ejecución depende del compilador. Su prerrequisito (el slot
   estable, S7) **sí quedó cerrado aquí**.
3. **La fusión `task_items` / `documents`** (los pasos 3 y 4 del plan original de este frente).
   Se aplazaron detrás del §0.8 y **el §0.8 los dejó sin urgencia**: el modelo quedó coherente sin
   ellos. Siguen sin decidir, y el paso 4 **toca frontend** (unos 5 sitios usan `documentId` como
   señal de existencia). Si se retoman, se retoman como frente propio, no como resto de éste.
4. **Las decisiones del modelo que este frente inventarió y no llegó a validar.** → **frente 9,
   fase D7**, abierta el 2026-08-14. Son tres, y las tres estaban escritas aquí sin dueño:
   - **La edición `retired` que sigue enlazada** (§0.5): el vínculo 1 usa la v1.0.0 `retired` mientras
     la v1.1.0 está `published`, y de ese vínculo salen los tres entregables del sistema.
   - **La invariante de `published` sin verificar** (§0.8, «Riesgos»): descansa en que un `draft` no
     tenga instancias, y `launch.js` **no mira `lifecycle_state`** — remedido el 2026-08-14, cero
     ocurrencias.
   - **Las columnas `*_id` sin FK**, dos de ellas por **descuido de tipo** (`BIGINT` contra
     `persons.id INT`), medidas en `plan_data/referencia-esquema.md` §5.

> **Y la lección de archivar, que vale para el próximo cierre:** las tres de arriba se quedaron dentro
> de este documento cuando se archivó, el 2026-08-14, y hubo que rescatarlas el mismo día. **Un frente
> hace el inventario de un modelo; validarlo contra el negocio es otro trabajo** — si no se le pone
> dueño antes de archivar, se va con lo cerrado.

## Lo que se aprendió, y ya no vive solo aquí

Cuatro cosas se sacaron de este frente y se escribieron como **reglas 14 a 17** de
[`referencia/metodo.md`](../../../planes/referencia/metodo.md), que es lectura obligatoria. Se
promovieron el día del cierre justamente porque **estaban solo en la prosa de este documento**: una
sesión nueva habría leído el método completo y no las habría recibido.

- **14 · El experimento desechable antes de escribir.** Se pagó **ocho veces** en este frente, y dos
  de ellas destapando fallos **que no eran del cambio**.
- **15 · Verde no es seguro.** La caracterización fue ciega **tres veces seguidas** en el §0.4: anular
  el lector del schema, el de campos o el escritor de campos daba **281/281 en verde**.
- **16 · Verde no es retirable.** Char daba 266/266 con el `OR` de los gates quitado — y su productor
  seguía vivo.
- **17 · Prueba por mutación.** Arreglar el slot de firma necesitó **dos** mutaciones distintas, y eso
  reveló que el diagnóstico escrito era falso.

Y una quinta, que no es de método sino de criterio, y sigue vigente:
**lo que la web no autora, no existe.** Con ella se retiraron cinco resolvers y dos ámbitos, y hoy la
base los rechaza por `CHECK`.
