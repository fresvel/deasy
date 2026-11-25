# `sistema-diseno-componentes/` — Frente 4, TERCERA vuelta

> Este directorio **no compite** con [`plan-maestro-2026-08.md`](../plan-maestro-2026-08.md): es el
> desarrollo del **Frente 4 · Sistema de diseño**. Cuando cierre, se archiva y el maestro se marca ✅
> — la regla 1 del [README de planes](../README.md).

Nació el **2026-08-13**, al cerrar la segunda vuelta. Y como las dos anteriores, **no es su
continuación: es otro problema.**

| Vuelta | Perseguía | Estado |
|---|---|---|
| 1.ª (2026-08-09) | **El CSS**: ficheros gordos, tokens duplicados, hex sueltos | ✅ archivada |
| 2.ª (2026-08-11) | **Las plantillas**: 2 117 colores de Tailwind escritos a mano, reglas que no aplicaban | ✅ archivada |
| **3.ª (ésta)** | **Los componentes**: dos ficheros de 8 000 líneas y lo que no se pudo tocar con un script | 🟡 |

## 🗺️ El mapa — dónde encaja cada cosa

**Hay TRES niveles de plan y cuatro tablas de control.** Confundirlos ya costó dos respuestas
contradictorias al dueño (2026-08-15), así que aquí está el árbol entero. **Al informar del estado
se dice de qué nivel se habla.**

```
plan-maestro-2026-08.md          12 FRENTES  (0…11)  ── el mapa de todo el repo
   └─ Frente 4 · Sistema de diseño        🟡  6 pasos, 5 cerrados
        └─ sistema-diseno-componentes/    ← ESTA CARPETA: la 3.ª vuelta del frente 4
             └─ plan-2026-08-13.md        11 FASES (F0…F10) · 22 tareas, 12 cerradas
                  └─ F3.2 · el botón      ✅ (una sola fila ahí dentro)
                       └─ fase-3-botones.md
                            ├─ 11 GRUPOS  (G1…G11) · 5 cerrados   ← la tabla que se enseña
                            └─ ~15 TAREAS (3.0, 3.1, 3.2…)        ← incluye trabajo sin grupo
```

| Nivel | Fichero | Unidad | Estado |
|---|---|---|---|
| 1 · Repo | `../plan-maestro-2026-08.md` | **Frente** 0…11 | Frente 4 en 🟡 |
| 2 · Frente 4 | `plan-2026-08-13.md` §0 | **Fase / tarea** F0…F10 | 12 de 22 |
| 3 · Fase 3 | `fase-3-botones.md` §0 | **Grupo** G1…G11 | 5 de 11 |
| 3-bis · Fase 3 | `fase-3-botones.md` §7 | **Tarea** 3.0, 3.1… | incluye lo que no es de ningún grupo |

⚠️ **Las tres trampas que ya se pisaron:**

1. **Una tarea cerrada no es un grupo cerrado.** La geometría única, los 3 gates nuevos y la
   convención de nombres son tareas de la fase 3 y **no pertenecen a ningún grupo**. Contarlas
   dio un falso «7 de 11 grupos» cuando son **5**.
2. **Cerrar F3.2 no cierra la fase 3.** La fase 3 tiene cuatro tareas (`deasy-icon-box`, el
   botón, el estado de grafo, los dos colapsos de plantilla) y **solo el botón está hecho**.
3. **El maestro se queda atrás y no avisa.** El paso 4 del Frente 4 (cerrar el fork
   `AdminButton.vue`) estuvo marcado ⬜ **desde el 14-08 hasta el 15-08**, con el fichero ya
   borrado. Un nivel se actualiza **en el commit que cierra la tarea**, y eso incluye el de
   arriba cuando le toca.

## El argumento de una frase

**Lo que queda no lo arregla una sustitución, y lo que ya se hizo no aguantó.** La segunda vuelta
extrajo seis componentes y puso cuatro gates; una auditoría del 2026-08-13 encontró que **ni los
componentes se propagaron, ni los gates cerraron** — `.deasy-control` cubre 3 de 228 controles, y
el 81 % de las alertas esquiva su componente. No fue un fallo de ejecución: fue el orden.

> El de la 1.ª vuelta era **«borrar antes de migrar»**. El de la 2.ª, **«primero dar a dónde ir,
> luego pedir que se vaya»**. El de ésta:
>
> **Declarar una clase no es adoptarla, y un gate con un agujero es peor que no tenerlo: da verde.**

Por eso **los gates son la fase 0** y **propagar lo ya extraído es la fase 2**, antes de extraer nada
nuevo. Y por eso la parte manual —los colores que viven en JavaScript, y partir los dos ficheros
gordos— va después: se decide leyendo, no con un `sed`.

> ⚠️ **Las cifras viven en el plan, no aquí.** La regla 2 del [README de planes](../README.md): un
> contador replicado en dos sitios acaba contradiciéndose — en este repo llegó a haber **cinco**
> conteos distintos de lo mismo. Si necesitas un número, está en `plan-2026-08-13.md`.

## Lo que se hereda, y que cambia cómo se trabaja

La 3.ª vuelta arranca en condiciones que las dos anteriores no tuvieron:

- **La paleta está adoptada** (TailAdmin, dos capas: 91 primitivas + 22 tokens semánticos encima).
- **Seis componentes declarados en un solo sitio**, cuatro con su geometría.
- **Cuatro gates encadenados a `lint`** — el trabajo ya no se deshace solo.
- **`overrides.css` sin repintados**: los cinco murieron.

Así que **cada trozo que salga de partir `HomeView` ya nace limpio**. Ese es el motivo de que F8 sea
ahora y no antes.

## Los ficheros

| Fichero | Qué es | ¿Hay que hacer algo? |
|---|---|---|
| [`plan-2026-08-13.md`](./plan-2026-08-13.md) | **Las once fases, con criterio de cierre y verificación** | **SÍ. Es el ejecutable** |
| `bitacora.md` | La auditoría que reescribió el plan, y **las cinco trampas ya pagadas** | Léela antes de tocar un script de migración |

La segunda vuelta está archivada en
[`docs-md-antiguos/planes-cerrados-2026-08/sistema-diseno-plantillas/`](../../docs-md-antiguos/planes-cerrados-2026-08/sistema-diseno-plantillas/).
**Su bitácora sigue valiendo**: es donde están las trampas ya pagadas.

## Las reglas del sistema viven en otro sitio

[`frontend/CLAUDE.md`](../../../frontend/CLAUDE.md) — cada regla con el fallo real que la originó. Se
carga sola al trabajar en el frontend. **Este directorio es el plan; ese fichero es la norma.**
