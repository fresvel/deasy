# `docs/planes/` — dónde está cada cosa

> **Si vienes a hacer algo, ve directo a [`plan-maestro-2026-08.md`](./plan-maestro-2026-08.md).**
> Es el **único** documento del que se sacan tareas. Todo lo que hay en `referencia/` se consulta,
> **no se ejecuta**.

Esta carpeta nació el **2026-08-09** para arreglar un problema concreto: había once documentos sueltos
en la raíz de `docs/`, mezclando planes con auditorías y con documentación de dominio, y **ninguno
decía si tenía trabajo pendiente o era historia**. Saber por dónde empezar costaba más que empezar.

---

## Qué hay aquí

| Fichero | Qué es | ¿Hay que hacer algo? |
|---|---|---|
| **[`plan-maestro-2026-08.md`](./plan-maestro-2026-08.md)** | **Los frentes pendientes**, ordenados por retorno sobre esfuerzo, cada uno con su criterio de cierre, y un **§0 · Control de ejecución** al principio que dice de un vistazo cómo va cada uno. El **frente 0 se cerró y se archivó** (9 de 9, 2026-08-13): el modelo de dominio ya no se contradice. Lo que queda son los frentes 1-11. Incluye además **por qué la pregunta arquitectónica está cerrada** (se evaluaron 15 arquitecturas el 2026-08-09 y ninguna baja la complejidad) | **SÍ. Es la puerta de entrada.** |
| **[`CLAUDE.md`](./CLAUDE.md)** | **La norma de esta carpeta**: todo plan lleva su control de ejecución en tabla checklist, y **se actualiza en el mismo commit** que la tarea que cierra. Se carga solo al trabajar aquí | Léelo **antes** de tocar un plan |
| **[`defectos-conocidos/`](./defectos-conocidos/)** | **El frente 1 desarrollado**: los **4 defectos que quedan** (de 14), cada uno con diagnóstico remedido y criterio de cierre, más un **control de ejecución de 17 tareas** que se actualiza en el mismo commit que las cierra. Su `bitacora.md` guarda los **10 cerrados** con *por qué no se hizo de la otra forma* — cinco sitios donde la corrección obvia es la equivocada | **SÍ**, vía frente 1 |
| **[`plan_data/`](./plan_data/)** | El **plan de la capa de datos**: **7 fases**, más el retrato medido del esquema. Es el **frente 9** del maestro, con carpeta propia porque trae su propia referencia. Incluye **por qué se descarta una clase por tabla** y, desde el 2026-08-14, la **auditoría funcional del modelo** que el frente 0 dejó abierta (fase **D7**, la primera en ejecutarse) | **SÍ**, vía frente 9 |
| [`referencia/metodo.md`](./referencia/metodo.md) | Las **18 reglas** de trabajo, los comandos, y **lo que NO hay que tocar**. Las cinco últimas son de agosto y valen por sí solas: el **experimento desechable**, las tres que explican por qué **verde no significa seguro, ni retirable, ni protegido**, y la del **worktree propio antes de escribir** | Léelo **antes** de tocar código |
| [`referencia/patrones-diseno.md`](./referencia/patrones-diseno.md) | Cuándo un patrón de diseño sí y cuándo no, con la evidencia medida de este repo | Léelo **antes** de proponer un patrón |
| [`referencia/calidad-y-medicion.md`](./referencia/calidad-y-medicion.md) | La bitácora de las nueve fases cerradas, la línea base de Sonar y su serie histórica | Consulta. Es el *cómo se midió* |
| [`referencia/cobertura.md`](./referencia/cobertura.md) | El plan de cobertura. Su Fase 0 está hecha; quedan la 1 y la 2 | Sí, vía frente 5 del maestro |
| [`sistema-diseno-componentes/`](./sistema-diseno-componentes/) | **El frente 4 desarrollado, segunda vuelta**: la paleta ya existe; ahora tiene que llegar a las plantillas. La primera vuelta cerró el CSS (3 997 → ~2 100 líneas, 0 hex, 0 `<style scoped>`) y está archivada. La medición del 2026-08-11 encontró que **la deuda que queda no vive en el CSS**: son **3 590 clases de color de Tailwind** que ningún linter ve, y **`@theme` es el cuello de botella** | Sí, vía frente 4 |
| [`referencia/frontend.md`](./referencia/frontend.md) | Diagnóstico del frontend y sus fases. Layouts y split de `HomeView` sin empezar | Sí, vía frentes 3 y 4 |
| [`referencia/signer.md`](./referencia/signer.md) | Auditoría del microservicio de firma. **8 de sus 12 riesgos siguen abiertos** | Sí, vía frente 6 |
| [`referencia/contrato-errores-api.md`](./referencia/contrato-errores-api.md) | La forma que deberían tener las respuestas de error. Hoy conviven 15 | Sí, vía frentes 1 y 7 |
| [`referencia/linea-base-homeview.md`](./referencia/linea-base-homeview.md) | Contrato observable de `HomeView` **antes de partirlo**: la red del día que se haga | Solo cuando se ataque el frente 3 |
| [`referencia/god-objects-2026-07.md`](./referencia/god-objects-2026-07.md) | Bitácora de los 10 cortes de julio. **Sus cifras no valen**, pero guarda dos diagnósticos que no están en ningún otro sitio | Consulta |

## Qué NO está aquí, y dónde buscarlo

- **Dominio de negocio** → `docs/arquitecturas/` (los modos de emisión de entregables viven ahí).
- **Mecánica del backend** (bootstrap, seeds, fotos de perfil) → `docs/03-backend/`.
- **Despliegue y comandos** → `docs/07-despliegue/`.
- **Planes ya ejecutados** → `docs/docs-md-antiguos/planes-cerrados-2026-08/`. En particular el
  **frente 0** (el modelo de dominio), archivado el 2026-08-14 en
  [`frente-0-modelo-dominio/`](../docs-md-antiguos/planes-cerrados-2026-08/frente-0-modelo-dominio/):
  ahí siguen resolviéndose las citas a `§0.4`, `§0.6` y `§0.8` que otros documentos hacen.
- **Cómo está montado SonarQube y sus credenciales** → `CLAUDE.md`, que es lo único que no cambia con
  cada escaneo.

---

## Tres reglas para que esto no se vuelva a desordenar

**Las tres están desarrolladas en [`CLAUDE.md`](./CLAUDE.md)**, que es la norma de la carpeta.

1. **Un plan que se termina se archiva**, no se queda «vivo» por inercia. Va a
   `docs/docs-md-antiguos/planes-cerrados-2026-08/` con una línea diciendo cómo acabó.
2. **Las cifras que cambian con cada escaneo no se replican.** Viven en `referencia/calidad-y-medicion.md`
   y en el plan maestro; copiarlas a `CLAUDE.md` o a un tercer documento garantiza que en dos semanas
   haya tres números distintos para lo mismo. Ya pasó: llegó a haber **cinco** conteos contradictorios
   de las marcas de Sonar en cinco sitios.
3. **Todo plan lleva su control de ejecución en una tabla checklist, y se actualiza EN EL MISMO COMMIT
   que la tarea que cierra.** No al final de la sesión ni en un commit de documentación aparte: si el
   trabajo y su registro viajan separados, el día que uno de los dos se quede sin empujar **el plan
   miente** — y un plan que miente es peor que no tener plan, porque se le hace caso.
