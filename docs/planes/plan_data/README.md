# `plan_data/` — la capa de datos

Esta carpeta nació el **2026-08-09** al contestar una pregunta concreta: *«¿conviene crear una clase
por cada tabla?»*. La respuesta es **no** —está razonada con cifras en el §0 del plan—, pero para
contestarla hubo que mirar la capa de persistencia entera por primera vez, y aparecieron **seis
problemas que ningún frente del plan maestro cubría**.

| Fichero | Qué es | ¿Hay que hacer algo? |
|---|---|---|
| **[`plan-datos-2026-08.md`](./plan-datos-2026-08.md)** | Las **6 fases** (D1–D6), ordenadas por retorno sobre esfuerzo, cada una con su criterio de cierre. Incluye **por qué se descarta una clase por tabla** y la lista de lo que el plan **no** va a hacer | **SÍ** |
| [`referencia-esquema.md`](./referencia-esquema.md) | El retrato medido del esquema: 67 tablas clasificadas, los 33 dominios `CHECK`, el grafo de FKs, los 5 triggers de negocio y **los 10 agregados que la base ya dibuja** | Consulta |

## Las seis fases, en una línea cada una

| | Fase | Estado |
|---|---|---|
| **D1** | Un solo `withTransaction` — hoy hay 20 ciclos manuales en 11 ficheros | ⬜ |
| **D2** | Un vocabulario de estados, no cinco — `task_items` está definido en 5 sitios con 3 alfabetos | ⬜ |
| **D3** | Migraciones versionadas — hoy el esquema **no se puede alterar** en un entorno con datos | ⬜ |
| **D4** | Repositorios **por agregado** (10, no 67) y fuera el SQL de `controllers/` | ⬜ |
| **D5** | Matar el traductor de dialecto MySQL→PG — el fichero más denso del repo | ⬜ |
| **D6** | Validación por esquema en el borde de entrada | ⬜ |

## Su relación con el resto de `docs/planes/`

- El **plan maestro** sigue siendo la puerta de entrada: este plan es su **frente 9**, y desde allí
  se delega aquí. No duplica ninguna tarea del maestro.
- **No contradice** a [`referencia/patrones-diseno.md`](../referencia/patrones-diseno.md) ni al cierre
  de la pregunta arquitectónica: los aplica a la capa de datos, que era el hueco que quedaba. La
  conclusión es la misma —tablas y extracción, no jerarquías— y por eso se rechaza tanto la clase por
  tabla como el ORM.
- Toca dos defectos que el maestro ya registra: **1.10** (la bitácora de relevos que puentea el camino
  automático) aparece en el retrato del esquema §6, y **1.11** (parámetros de más ignorados) es
  prerrequisito de la fase D5-b.
- Respeta la lista de **no tocar** del maestro: el núcleo CRUD de `SqlAdminService` y `sqlTables.js`
  como *datos*. Las fases D2 y D4 trabajan alrededor, nunca dentro.

## La regla de siempre

Cuando las seis fases estén cerradas, esta carpeta **se archiva** en
`docs/docs-md-antiguos/planes-cerrados-2026-08/` con una línea diciendo cómo acabó. No se queda viva
por inercia.
