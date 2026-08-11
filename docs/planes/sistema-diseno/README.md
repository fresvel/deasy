# `docs/planes/sistema-diseno/` — el Frente 4, con su evidencia

> Este directorio **no compite** con [`plan-maestro-2026-08.md`](../plan-maestro-2026-08.md). Es el
> desarrollo del **Frente 4 · Sistema de diseño**, que en el maestro ocupa 20 líneas y necesita más.
> Cuando el frente cierre, esto se archiva y el maestro se marca ✅ — la regla 1 del
> [README de planes](../README.md).

Nació el **2026-08-09**, tras medir el estado real del CSS del repositorio. Existe porque el maestro
daba el Frente 4 por «desbloqueado a medias» con seis pasos, y la medición encontró **tres cosas más
que no estaban en ningún plan** y que, por orden, van *antes* de los pasos que sí estaban escritos.

| Fichero | Qué es | ¿Hay que hacer algo? |
|---|---|---|
| [`plan-2026-08-09.md`](./plan-2026-08-09.md) | **Las 6 fases, con criterio de cierre y verificación** | **SÍ. Es el ejecutable.** |
| [`auditoria-css.md`](./auditoria-css.md) | El diagnóstico medido: qué hay, dónde, cuánto | Consulta. Es el *por qué* del orden |
| [`bitacora.md`](./bitacora.md) | Qué se hizo, qué se midió, qué se descartó y por qué | Se escribe al ejecutar |

---

## El argumento de una frase

**Borrar antes de migrar.** El maestro manda colapsar tokens (paso 3) y migrar ~1 269 colores (paso 5)
sobre un CSS del que **más de la mitad está muerto o es inerte**. Hacerlo en ese orden significa
tokenizar reglas que nadie aplica y migrar colores de selectores que no casan con ningún nodo.

## Lo que este directorio añade al maestro

Tres hallazgos nuevos, todos verificados sobre el árbol de trabajo:

1. **`AdminTableManager.css` casi no estiliza nada.** 604 líneas cargadas como
   `<style scoped src="./AdminTableManager.css">` (`AdminTableManager.vue:4224`) con **cero `:deep()`**.
   De sus 68 clases, **1** llega a aplicarse. No es una sospecha: es la mecánica de `scoped` de Vue.
2. **~710 líneas de `theme.css` sin un solo consumidor**, en dos bloques contiguos (`.menu-*` y
   `.home-*`). Contiguos importa: se borran de una pieza, no clase a clase.
3. **Nada vigila el CSS.** Sin stylelint, y `eslint.config.cjs` usa `flat/essential` con `rules: {}`.
   Sin barandilla, el paso 5 del maestro se revierte solo.

## Lo que NO entra aquí

- **El fork `AdminButton.vue`** (paso 4 del maestro): mueve el aspecto y pide navegador con decisión
  de diseño. Sigue en el maestro.
- **Las 33 incidencias `css:S7924`** (paso 6): accesibilidad real, va detrás de todo esto.
- **`backend/templates/email/verification-code.html`**: 47 líneas con ~15 `style=` inline y **una
  paleta paralela** (primario `#21517a` frente al `#5e4eff` de la app). Está fuera de todos los planes
  y fuera de este también — pero queda anotado, porque nadie lo había mirado.
- **El CSS de `docs/`**: `docs/src/styles/global.css` es andamiaje de Astro sin personalizar, en un
  sitio que `docs/astro.config.mjs:33-39` declara que **no se publica**. Deuda muerta, no deuda activa.
