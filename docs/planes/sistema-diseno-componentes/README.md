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

## El argumento de una frase

**Lo que queda no lo arregla una sustitución.** La segunda vuelta bajó los colores a mano de 2 117 a
206, y los 206 que quedan son mayoritariamente `:class` con ternario — se deciden leyendo la
condición, no con un `sed`. Lo mismo con la *utility soup*: no es que esté mal escrita, es que vive
dentro de dos componentes que nadie puede leer enteros.

> El de la 1.ª vuelta era **«borrar antes de migrar»**. El de la 2.ª, **«primero dar a dónde ir,
> luego pedir que se vaya»**. El de ésta es: **lo que un script no puede decidir, no lo decide un
> script.**

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
| [`plan-2026-08-13.md`](./plan-2026-08-13.md) | **Las fases, con criterio de cierre y verificación** | **SÍ. Es el ejecutable** |
| `bitacora.md` | Qué se hizo, qué se midió y qué se descartó | Se escribe al ejecutar |

La segunda vuelta está archivada en
[`docs-md-antiguos/planes-cerrados-2026-08/sistema-diseno-plantillas/`](../../docs-md-antiguos/planes-cerrados-2026-08/sistema-diseno-plantillas/).
**Su bitácora sigue valiendo**: es donde están las trampas ya pagadas.

## Las reglas del sistema viven en otro sitio

[`frontend/CLAUDE.md`](../../../frontend/CLAUDE.md) — cada regla con el fallo real que la originó. Se
carga sola al trabajar en el frontend. **Este directorio es el plan; ese fichero es la norma.**
