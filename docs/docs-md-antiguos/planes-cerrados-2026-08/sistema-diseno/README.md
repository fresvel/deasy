> ⚠️ **ARCHIVADO — no es fuente de verdad.**
> Este directorio describe el CSS tal como era entre el **2026-08-09** y el **2026-08-10**. Cita
> `theme.css`, `tailwind.css` y `AdminTableManager.css`, que **ya no existen**. Se conserva por su
> valor histórico: documenta *por qué* se hizo en ese orden, y esa parte no caduca.
>
> **La continuación viva está en
> [`docs/planes/sistema-diseno-plantillas/`](../../../planes/sistema-diseno-plantillas/).**

# Frente 4 · Sistema de diseño — primera vuelta (cerrada)

Nació el **2026-08-09** tras medir el estado real del CSS. Sus **seis fases se ejecutaron** entre el
2026-08-09 y el 2026-08-11, en 21 commits.

| Fichero | Qué es |
|---|---|
| [`plan-2026-08-09.md`](./plan-2026-08-09.md) | Las 6 fases, con criterio de cierre y verificación |
| [`auditoria-css.md`](./auditoria-css.md) | El diagnóstico medido de partida |
| [`auditoria-color.md`](./auditoria-color.md) | El de los 74 hex, del 2026-08-10 |
| [`bitacora.md`](./bitacora.md) | **Lo más valioso**: qué se hizo, qué se midió y **qué se descartó y por qué** |

## Cómo acabó

| Métrica | Al abrir | Al cerrar |
|---|---:|---:|
| Líneas de CSS | 3 997 | **~2 100** |
| Ficheros de CSS | 3 | **16 módulos por familia** |
| Juegos de tokens | 2 | **1** |
| Hex en los `.css` | 74 | **0** |
| `rgba()` numéricos en los `.css` | 100 | **0** |
| `<style scoped>` | 13 | **0** |
| `!important` | 80 | **6** |
| Linters de estilo | 0 | **3** |
| dev ≠ prod | sí | **no** |
| Escala de radios | invertida | **monótona** |

## Su argumento, que sigue siendo válido como método

**Borrar antes de migrar.** El maestro mandaba colapsar tokens y migrar colores sobre un CSS del que
**más de la mitad estaba muerto o era inerte**. Se borraron ~1 900 líneas antes de tokenizar nada.

## Los cuatro hallazgos que justificaron abrirlo

1. **`AdminTableManager.css`: 0 de 86 reglas aplicaban.** 604 líneas cargadas con `<style scoped src>`
   sin un solo `:deep()`. Su columna de acciones declaraba `position: sticky` y el DOM devolvía
   `static` — **se diseñó y nunca funcionó**.
2. **~710 líneas de `theme.css` sin un solo consumidor.**
3. **Nada vigilaba el CSS**: sin stylelint, y `eslint.config.cjs` con `rules: {}`.
4. **`local-dev` no era una variante de desarrollo, era el diseño** tras la condición equivocada.
   Promoverlo arregló **3 de los 4 fallos de WCAG 1.4.11** que producción tenía y nadie veía.

## Lo que quedó abierto, y adónde fue

| Pendiente | Dónde está ahora |
|---|---|
| Escala tipográfica, `z-index`, *utility soup* | [`sistema-diseno-plantillas/`](../../../planes/sistema-diseno-plantillas/), fase 6 |
| Los colores del `.vue` | Ídem, fases 2-4 — **con el diagnóstico cambiado**: no eran 87 hex, son 3 590 clases de Tailwind |
| Fork de `AdminButton.vue` | Paso 4 del maestro |
| Las 15 reglas de intención perdida de `AdminTableManager.css` | Anotadas en la bitácora. Resucitarlas cambia el aspecto: es decisión de diseño |
| `backend/templates/email/verification-code.html` | Sigue sin dueño |
