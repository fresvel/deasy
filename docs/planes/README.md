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
| **[`lopdp-consentimiento-2026-09.md`](./lopdp-consentimiento-2026-09.md)** | **El frente 17**: que el sistema pueda **probar** que alguien aceptó, como exige el Art. 5 del Reglamento de la LOPDP. Las dos casillas y la barrida están hechas; lo que queda es **mudar el texto legal de una columna `TEXT` a dos buckets de MinIO** (borradores mutable + archivo WORM). Guarda además **por qué murió el sello de verificación**, que se llegó a diseñar entero | **SÍ**, vía frente 17 |
| [`channels-verificacion-2026-08.md`](./channels-verificacion-2026-08.md) | **El frente 15, cerrado** (10 de 10): que una persona pueda **demostrar que un número es suyo**, por Telegram o WhatsApp. Guarda el porqué de **descartar el SMS** —su cabecera de origen la rellena el emisor— y lo que costó el identificador `@lid` de WhatsApp: tres sesiones, porque *«no llega nada»* y *«llega y lo tiro»* se ven igual | Consulta. Frente cerrado |
| [`versionado-de-objetos-2026-09.md`](./versionado-de-objetos-2026-09.md) | **El frente 16**: los tres buckets de MinIO están **sin versionar** (medido 2026-09-02), así que sobrescribir un documento firmado **destruye el anterior sin rastro**. El sistema ya versiona por sub-ruta: hay que decidir si son capas complementarias **antes de tocar nada** | **SÍ**, vía frente 16 |
| [`expediente-relacional-2026-09.md`](./expediente-relacional-2026-09.md) | **El frente 18**: `dossier_items.data` es un **JSONB con diez formas dentro**. La documentación defiende ese diseño diciendo que «la forma cambia cada curso» y **eso es falso** — está fijada a mano en los formularios de Vue. Guarda la evaluación **sección por sección** (ninguna es inviable; el único valor no escalar es un 1:N de manual) y por qué el catálogo de campos que hay **no sirve**: sale de un PDF escaneado con OCR malo, y da 38 campos amplios donde el CINE-F tiene diez | **SÍ**, vía frente 18 |
| **[`mapa-modulos-2026-10.md`](./mapa-modulos-2026-10.md)** | **El frente 22**: una sola respuesta a «¿dónde vive esto?». Había **cuatro** clasificaciones vivas de a qué módulo pertenece una tabla y coincidían entre el 20 % y el 35 %. Hoy `dominios.json` es la fuente única —**8 dominios · 8 niveles**, con el glosario *dominio* / *nivel* / *capa* fijado por el dueño— y las tablas viven en **8 esquemas de PostgreSQL**. Lo que queda es `F7.5`: mover el backend de los cuatro dominios entrelazados, **tabla por tabla** | **SÍ**, vía frente 22 |
| [`plantillas-y-entregables-2026-10.md`](./plantillas-y-entregables-2026-10.md) | **El frente 23, cerrado** (9 de 9, 2026-10-04): quitar lo que se dice dos veces sobre «qué plantilla». Guarda **por qué el índice único que el plan proponía se descartó** —rompe el clon— y el efecto lateral que desbloqueó al frente 22: quitar `owner_process_id` deshizo la dependencia circular entre `plantillas` y `procesos` | Consulta. Frente cerrado |
| [`recorrido-unificado-2026-10.md`](./recorrido-unificado-2026-10.md) | **El frente 24, cerrado** (11 de 11): el recorrido del documento estaba partido en dos mitades simétricas y «qué plantilla» se decía con cuatro nombres. Guarda **por qué un golden caza lo que un unitario con fixture propio no puede** —una regresión que devolvía `false` en silencio con sus tres pruebas en verde— y la lección de que **renombrar el modelo no renombra la pantalla** | Consulta. Frente cerrado |
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
