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
| **1.17** | **Nada re-publica la semilla en un entorno vivo**, y el arnés no resetea `storage` | Bootstrap · arnés |

**Catorce ya están cerrados**, y **cinco de ellos el 2026-08-14**. De esos cinco, **tres resultaron
ser otra cosa** de lo que decía su ficha:

- el **1.8** no eran dos documentos en conflicto sino **cinco**, y uno era la documentación publicada;
- la justificación del **1.11** para tolerar los parámetros de más **era falsa** — se midió y las 484
  llamadas del backend están equilibradas;
- el **1.15** no era «un golden no determinista» sino **una semilla obsoleta en MinIO**: el golden era
  correcto y lo que mentía era el entorno.

Los otros dos sí eran lo que decían, y se cerraron en dos líneas y en una: el **1.16** y el **1.18**.
Y el **1.18** es además **el primero de este frente cuyo golden se mueve** — el idioma que el plan
pide y que hasta entonces no se había podido usar ni una vez.

Aparte, uno de los catorce —el **1.9**— resultó **no ser un defecto**: aplicarle el arreglo «obvio»
habría roto el chat a ocho de diez personas. Todo medido en la bitácora.

## Los ficheros

| Fichero | Qué es | ¿Hay que hacer algo? |
|---|---|---|
| **[`plan-defectos-2026-08.md`](./plan-defectos-2026-08.md)** | **El ejecutable.** Su **§0 es el control de ejecución**: 23 tareas con estado, evidencia y fecha. Cada defecto tiene ficha con diagnóstico remedido, decisiones pendientes y criterio de cierre | **SÍ. Empieza aquí** |
| [`CLAUDE.md`](./CLAUDE.md) | **La norma de la carpeta.** Cómo se lleva el control, qué cuenta como evidencia, y lo que NO se hace desde aquí | Se carga sola al trabajar aquí |
| [`bitacora.md`](./bitacora.md) | Los **catorce cerrados**, con *por qué no se hizo de la otra forma*. **Ocho** sitios donde la corrección obvia es la equivocada | Léela antes de proponer un arreglo parecido |

## Por qué este frente rinde más que los otros

Dos motivos, y el segundo es el bueno:

1. **No es deuda estética**: son fallos que un usuario puede encontrarse.
2. **Están congelados en pruebas.** El arreglo se verifica solo — cuando el defecto muere, su golden
   cambia, y **ese diff es la prueba**. No hace falta inventar la verificación: ya existe.

⚠️ **Pero es CONDICIONAL, y costó descubrirlo**: la suite estuvo **roja 4 tests** sin que nadie lo
supiera (defecto 1.15, cerrado el 2026-08-14). Un golden solo prueba algo si la suite estaba verde
**antes** de tu cambio — compruébalo primero.

La otra excepción es el **1.7**, que es frontend y ahí no hay golden que valga: se verifica en
navegador, con usuario y ruta escritos en su ficha.

## Su relación con el resto de `docs/planes/`

- **No duplica ninguna tarea del maestro**: el maestro delega aquí, igual que hace el frente 9 con
  [`plan_data/`](../plan_data/).
- **El 1.11 retiró uno de los dos cerrojos de la fase D5-b** del plan de datos (2026-08-14). Sigue ⛔,
  pero ahora solo por el otro: cerrar D5-a primero.
- **El 1.8 NO es el frente 7.** Aquí se reconcilia la contradicción entre dos documentos; migrar las
  ~114 lecturas de `.data.error` del frontend es del frente 7, con su plan en
  [`referencia/contrato-errores-api.md`](../referencia/contrato-errores-api.md) §6.
- **El 1.10 aparece también** en el §6 del retrato del esquema de `plan_data/`.
