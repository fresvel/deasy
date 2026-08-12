# `docs/planes/sistema-diseno-plantillas/` — Frente 4, segunda vuelta

> Este directorio **no compite** con [`plan-maestro-2026-08.md`](../plan-maestro-2026-08.md). Es el
> desarrollo del **Frente 4 · Sistema de diseño**, que en el maestro ocupa 20 líneas y necesita más.
> Cuando el frente cierre, esto se archiva y el maestro se marca ✅ — la regla 1 del
> [README de planes](../README.md).

Nació el **2026-08-11**, al medir el frontend después de cerrar la primera vuelta. La primera ganó el
frente del **CSS**; esta va a por lo que quedó, que **no vive ahí**.

| Fichero | Qué es | ¿Hay que hacer algo? |
|---|---|---|
| [`plan-plantillas-2026-08.md`](./plan-plantillas-2026-08.md) | **Las 6 fases, con criterio de cierre y verificación** | **SÍ. Es el ejecutable.** |
| [`auditoria-2026-08-11.md`](./auditoria-2026-08-11.md) | La medición de cinco frentes: cifras, método y **lo que NO hay que tocar** | Consulta. Es el *por qué* del orden |
| [`bitacora.md`](./bitacora.md) | Qué se hizo, qué se midió y **qué se descartó y por qué** | Se escribe al ejecutar |

La primera vuelta está cerrada y archivada en
[`docs-md-antiguos/planes-cerrados-2026-08/sistema-diseno/`](../../docs-md-antiguos/planes-cerrados-2026-08/sistema-diseno/).
Su bitácora sigue valiendo: es donde están las trampas ya pagadas.

---

## El argumento de una frase

**Primero dar a dónde ir, luego pedir que se vaya.** Hoy no existen `bg-state-warning` ni
`text-brand-text-muted`, así que pedir que se dejen de usar `amber-*` y `slate-400` **sin registrarlos
antes en `@theme`** es pedir lo imposible. La fase que desbloquea va antes que la que migra.

> El de la primera vuelta era **«borrar antes de migrar»**, y también se cumplió: se borraron
> ~1 900 líneas de CSS antes de tokenizar nada.

## Por qué es un plan nuevo y no una fase más

La primera vuelta perseguía **CSS**: ficheros gordos, tokens duplicados, hex sueltos. Ese frente está
ganado — 3 997 → ~2 100 líneas, un solo juego de tokens, **cero literales de color en los `.css`** y
**cero `<style scoped>`**.

> Lo que queda **no vive en el CSS**. Son **3 590 clases de color de Tailwind en las plantillas** que
> ningún linter ve, y un puñado de reglas que existen y no aplican.

**El contador de `lint:css` en cero no significa que no haya deuda**: significa que la deuda cambió de
forma.

## Los cinco hallazgos que justifican abrirlo

Todos medidos sobre el árbol de trabajo y contrastados con la aplicación viva.

1. **3 590 colores de Tailwind por nombre** en 98 ficheros, de los que **211 están dentro de `@apply`**
   en el CSS que damos por limpio. Ni `stylelint` ni `eslint` ven uno solo: no son hex y no son `dark:`.
2. **`@theme` es el cuello de botella, no la disciplina.** Registra 16 nombres de los que **9 no llegan
   al CSS construido**, y deja fuera `--brand-text-muted` (20 usos) y `--state-warning` (destino de 164
   `amber-*`). **~660 apariciones no tenían alternativa.**
3. **Cinco cosas rotas hoy**, todas del mismo patrón: reglas que existen, se leen bien y no aplican. La
   peor deja **`--brand-border-field` y `--brand-border-strong` sin llegar nunca al DOM**, en 228
   controles.
4. **88 fallos de contraste de 186 pares.** Entre ellos `text-slate-400` con **202 usos** a 2.63:1, que
   contradice literalmente la regla escrita en `frontend/CLAUDE.md` §3.
5. **Dos colisiones de namespace activas y probadas** (`--font-weight-medium/semibold`): el mecanismo
   exacto del `--radius-lg` que costó meses de escala invertida.

## Lo que NO entra, y por qué

- **Los 7 colores de arista del grafo.** Paleta cualitativa: su separación mínima ya está en ΔE 7.2 y
  acercarlos a tokens de marca **los junta más**. Falta una escala declarada, no siete sustituciones.
- **`--state-danger` ↔ `--state-pending`** (ΔE 5.69, el par más cercano). Decisión tomada:
  «pendiente» no es «rechazado».
- **Los textos de la barra oscura.** 0 fallos en 663 nodos. Ahí fallan los bordes, no la tipografía.
- **Partir `HomeView.vue` y `FirmarPdf.vue`** — frente 3 del maestro, acompasado con la fase 6.3.
- **`backend/templates/email/verification-code.html`**: 47 líneas con ~15 `style=` inline y **una
  paleta paralela** (primario `#21517a`). Sigue fuera de todos los planes y sin dueño.
- **`docs/src/styles/global.css`**: andamiaje de Astro sin personalizar, en un sitio que
  `astro.config.mjs` declara que **no se publica**. Deuda muerta.

## Las reglas del sistema viven en otro sitio

[`frontend/CLAUDE.md`](../../../frontend/CLAUDE.md) — cada regla con el fallo real que la originó. Se
carga solo al trabajar en el frontend. **Este directorio es el plan; ese fichero es la norma.**
