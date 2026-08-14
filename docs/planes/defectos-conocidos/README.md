# `defectos-conocidos/` — Frente 1

> Este directorio **no compite** con [`plan-maestro-2026-08.md`](../plan-maestro-2026-08.md): es el
> desarrollo del **Frente 1 · Defectos conocidos y sin arreglar**. Cuando cierre, se archiva y el
> maestro se marca ✅ — la regla 1 del [README de planes](../README.md).

Nació el **2026-08-14**. El frente llevaba **catorce fichas en una sola tabla del maestro**, nueve de
ellas cerradas con párrafos de trescientas palabras cada uno: leerlo para saber *qué queda por hacer*
costaba más que hacerlo. Y sin control de ejecución, «⬜» era lo único que se sabía del frente entero.

## Lo que queda, en una línea cada uno

| Defecto | Qué es | Superficie |
|---|---|---|
| **1.3** | Con `is_manual` y sin responsable, **cualquiera se apropia** de la solicitud | Backend · servicio |
| **1.7** | El **sello fantasma**: un guard permanentemente verdadero en el panel de firma | Frontend · Vue |
| **1.10** | La única **bitácora de auditoría** la puentean los caminos automáticos (son **tres**) | Base de datos · triggers |
| **1.11** | Los **parámetros de más** se ignoran en silencio | `backend/config/postgres.js` |

**Diez ya están cerrados.** El último, el **1.8** (2026-08-14): resultó que **no eran dos documentos en
conflicto, sino cinco**, y uno de ellos era la documentación **publicada**. Y uno de los diez —el
**1.9**— resultó **no ser un defecto**: aplicarle el arreglo «obvio» habría roto el chat a ocho de diez
personas. Está todo medido en la bitácora.

## Los ficheros

| Fichero | Qué es | ¿Hay que hacer algo? |
|---|---|---|
| **[`plan-defectos-2026-08.md`](./plan-defectos-2026-08.md)** | **El ejecutable.** Su **§0 es el control de ejecución**: 17 tareas con estado, evidencia y fecha. Cada defecto tiene ficha con diagnóstico remedido, decisiones pendientes y criterio de cierre | **SÍ. Empieza aquí** |
| [`CLAUDE.md`](./CLAUDE.md) | **La norma de la carpeta.** Cómo se lleva el control, qué cuenta como evidencia, y lo que NO se hace desde aquí | Se carga sola al trabajar aquí |
| [`bitacora.md`](./bitacora.md) | Los **diez cerrados**, con *por qué no se hizo de la otra forma*. Cinco sitios donde la corrección obvia es la equivocada | Léela antes de proponer un arreglo parecido |

## Por qué este frente rinde más que los otros

Dos motivos, y el segundo es el bueno:

1. **No es deuda estética**: son fallos que un usuario puede encontrarse.
2. **Están congelados en pruebas.** El arreglo se verifica solo — cuando el defecto muere, su golden
   cambia, y **ese diff es la prueba**. No hace falta inventar la verificación: ya existe.

La excepción es el **1.7**, que es frontend y ahí no hay golden que valga: se verifica en navegador,
con usuario y ruta escritos en su ficha.

## Su relación con el resto de `docs/planes/`

- **No duplica ninguna tarea del maestro**: el maestro delega aquí, igual que hace el frente 9 con
  [`plan_data/`](../plan_data/).
- **El 1.11 desbloquea la fase D5-b** del plan de datos, que está ⛔ esperando su censo.
- **El 1.8 NO es el frente 7.** Aquí se reconcilia la contradicción entre dos documentos; migrar las
  ~114 lecturas de `.data.error` del frontend es del frente 7, con su plan en
  [`referencia/contrato-errores-api.md`](../referencia/contrato-errores-api.md) §6.
- **El 1.10 aparece también** en el §6 del retrato del esquema de `plan_data/`.
