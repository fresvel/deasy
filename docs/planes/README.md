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
| **[`plan-maestro-2026-08.md`](./plan-maestro-2026-08.md)** | **Los frentes pendientes**, ordenados por retorno sobre esfuerzo, cada uno con su criterio de cierre. Empieza por el **frente 0**, que va delante de todo: limpia las contradicciones del modelo de dominio antes de seguir refactorizando. Incluye además **por qué la pregunta arquitectónica está cerrada** (se evaluaron 15 arquitecturas el 2026-08-09 y ninguna baja la complejidad) | **SÍ. Es la puerta de entrada.** |
| **[`plan_data/`](./plan_data/)** | El **plan de la capa de datos**: 6 fases (D1–D6), más el retrato medido del esquema. Es el **frente 9** del maestro, con carpeta propia porque trae su propia referencia. Incluye **por qué se descarta una clase por tabla** | **SÍ**, vía frente 9 |
| [`referencia/metodo.md`](./referencia/metodo.md) | Las 13 reglas de trabajo, los comandos, y **lo que NO hay que tocar** | Léelo **antes** de tocar código |
| [`referencia/patrones-diseno.md`](./referencia/patrones-diseno.md) | Cuándo un patrón de diseño sí y cuándo no, con la evidencia medida de este repo | Léelo **antes** de proponer un patrón |
| [`referencia/calidad-y-medicion.md`](./referencia/calidad-y-medicion.md) | La bitácora de las nueve fases cerradas, la línea base de Sonar y su serie histórica | Consulta. Es el *cómo se midió* |
| [`referencia/cobertura.md`](./referencia/cobertura.md) | El plan de cobertura. Su Fase 0 está hecha; quedan la 1 y la 2 | Sí, vía frente 5 del maestro |
| [`sistema-diseno/`](./sistema-diseno/) | **El frente 4 desarrollado**: auditoría medida del CSS, plan por fases y bitácora. Sus 6 fases se ejecutaron entre el 2026-08-09 y el 2026-08-10 (`96f1afe`): CSS a la mitad, un solo juego de tokens, 15 módulos por familia y `lint:css` en verde. **Ojo: `bitacora.md:274` quedó obsoleto** — dice que el bloque `local-dev` sigue vivo y `c45b154` lo retiró | Sí, vía frente 4 — que **no está cerrado**: quedan el fork `AdminButton`, los colores del `.vue` y el contraste |
| [`referencia/frontend.md`](./referencia/frontend.md) | Diagnóstico del frontend y sus fases. Layouts y split de `HomeView` sin empezar | Sí, vía frentes 3 y 4 |
| [`referencia/signer.md`](./referencia/signer.md) | Auditoría del microservicio de firma. **8 de sus 12 riesgos siguen abiertos** | Sí, vía frente 6 |
| [`referencia/contrato-errores-api.md`](./referencia/contrato-errores-api.md) | La forma que deberían tener las respuestas de error. Hoy conviven 15 | Sí, vía frentes 1 y 7 |
| [`referencia/linea-base-homeview.md`](./referencia/linea-base-homeview.md) | Contrato observable de `HomeView` **antes de partirlo**: la red del día que se haga | Solo cuando se ataque el frente 3 |
| [`referencia/god-objects-2026-07.md`](./referencia/god-objects-2026-07.md) | Bitácora de los 10 cortes de julio. **Sus cifras no valen**, pero guarda dos diagnósticos que no están en ningún otro sitio | Consulta |

## Qué NO está aquí, y dónde buscarlo

- **Dominio de negocio** → `docs/arquitecturas/` (los modos de emisión de entregables viven ahí).
- **Mecánica del backend** (bootstrap, seeds, fotos de perfil) → `docs/03-backend/`.
- **Despliegue y comandos** → `docs/07-despliegue/`.
- **Planes ya ejecutados** → `docs/docs-md-antiguos/planes-cerrados-2026-08/`.
- **Cómo está montado SonarQube y sus credenciales** → `CLAUDE.md`, que es lo único que no cambia con
  cada escaneo.

---

## Dos reglas para que esto no se vuelva a desordenar

1. **Un plan que se termina se archiva**, no se queda «vivo» por inercia. Va a
   `docs/docs-md-antiguos/planes-cerrados-2026-08/` con una línea diciendo cómo acabó.
2. **Las cifras que cambian con cada escaneo no se replican.** Viven en `referencia/calidad-y-medicion.md`
   y en el plan maestro; copiarlas a `CLAUDE.md` o a un tercer documento garantiza que en dos semanas
   haya tres números distintos para lo mismo. Ya pasó: llegó a haber **cinco** conteos contradictorios
   de las marcas de Sonar en cinco sitios.
