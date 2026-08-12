# `docs/planes/sistema-diseno/` — el Frente 4, con su evidencia

> Este directorio **no compite** con [`plan-maestro-2026-08.md`](../plan-maestro-2026-08.md). Es el
> desarrollo del **Frente 4 · Sistema de diseño**, que en el maestro ocupa 20 líneas y necesita más.

Nació el **2026-08-09** tras medir el estado real del CSS. Va por su **segunda vuelta**: la primera
ganó el frente del CSS, y al terminarla la medición encontró que **la deuda que queda no vive ahí**.

| Fichero | Qué es | ¿Hay que hacer algo? |
|---|---|---|
| [`plan-2026-08-11.md`](./plan-2026-08-11.md) | **Las 6 fases de la segunda vuelta** | **SÍ. Es el ejecutable.** |
| [`auditoria-2026-08-11.md`](./auditoria-2026-08-11.md) | La medición que lo justifica: 5 frentes, cifras y método | Consulta. Es el *por qué* del orden |
| [`bitacora.md`](./bitacora.md) | Qué se hizo, qué se midió y **qué se descartó y por qué** | Se escribe al ejecutar |
| [`plan-2026-08-09.md`](./plan-2026-08-09.md) | **ARCHIVADO** — las 6 fases de la primera vuelta, todas ✅ | No. Sólo referencia histórica |
| [`auditoria-css.md`](./auditoria-css.md) · [`auditoria-color.md`](./auditoria-color.md) | La evidencia de la primera vuelta | Consulta histórica |

> ⚠️ **`plan-2026-08-09.md` está archivado, no continuado.** Sus cuatro ficheros sujeto —`theme.css`,
> `tailwind.css`, `AdminTableManager.css` y `frontend/.eslintrc.js`— **ya no existen**. Un plan cuyo
> objeto desapareció no se actualiza: se cierra. Sus pendientes vivos pasaron al plan nuevo.

---

## El argumento de una frase — segunda vuelta

**Primero dar a dónde ir, luego pedir que se vaya.** Hoy no existen `bg-state-warning` ni
`text-brand-text-muted`, así que pedir que se dejen de usar `amber-*` y `slate-400` **sin registrarlos
antes en `@theme`** es pedir lo imposible. La fase que desbloquea va antes que la que migra.

> El de la primera vuelta era **«borrar antes de migrar»**, y sigue siendo cierto: se borraron
> ~1 900 líneas de CSS antes de tokenizar nada.

## Lo que la segunda vuelta añade

Cinco hallazgos, todos medidos sobre el árbol de trabajo y contrastados con la app viva:

1. **3 590 colores de Tailwind por nombre** en 98 ficheros, de los que **211 están dentro de `@apply`**
   en el CSS que damos por limpio. Ni `stylelint` ni `eslint` ven uno solo: no son hex y no son
   `dark:`. **El contador de `lint:css` en cero no significa que no haya deuda.**
2. **`@theme` es el cuello de botella, no la disciplina.** Registra 16 nombres de los que **9 no llegan
   al CSS construido**, y deja fuera `--brand-text-muted` (20 usos), `--state-warning` (destino de 164
   `amber-*`) y las tres `--action-*`.
3. **Cinco cosas rotas hoy**, todas del mismo patrón: reglas que existen, se leen bien y no aplican.
   La peor — `overlay.css` sin capa ganando a `@layer components` — deja **`--brand-border-field` y
   `--brand-border-strong` sin llegar nunca al DOM**, en 228 controles.
4. **88 fallos de contraste de 186 pares.** Entre ellos, el placeholder del campo en error (1.75:1),
   todo botón primario deshabilitado (2.56) y `text-slate-400` con **202 usos** a 2.63:1 — que
   contradice literalmente la regla escrita en `frontend/CLAUDE.md` §3.
5. **Dos colisiones de namespace activas y probadas** (`--font-weight-medium/semibold`), que son el
   mecanismo exacto del `--radius-lg` que costó meses de escala invertida.

## Lo que NO entra, y por qué

- **Los 7 colores de arista del grafo.** Son una paleta cualitativa: su separación mínima ya está en
  ΔE 7.2 y acercarlos a tokens de marca **los junta más**. Lo que falta es una escala declarada, no
  siete sustituciones.
- **`--state-danger` ↔ `--state-pending`** (ΔE 5.69, el par más cercano). Decisión tomada: «pendiente»
  no es «rechazado».
- **Los textos de la barra oscura.** 0 fallos en 663 nodos. Ahí fallan los bordes, no la tipografía.
- **Partir `HomeView.vue` y `FirmarPdf.vue`** — frente 3 del maestro, acompasado con la fase 6.3.
- **`backend/templates/email/verification-code.html`**: 47 líneas con ~15 `style=` inline y **una
  paleta paralela** (primario `#21517a` frente al `#5e4eff` de la app). Sigue fuera de todos los
  planes y sin dueño.
- **`docs/src/styles/global.css`**: andamiaje de Astro sin personalizar, en un sitio que
  `astro.config.mjs` declara que **no se publica**. Deuda muerta.

## Las reglas del sistema viven en otro sitio

[`frontend/CLAUDE.md`](../../../frontend/CLAUDE.md) — cada regla con el fallo real que la originó. Se
carga solo al trabajar en el frontend. **Este directorio es el plan; ese fichero es la norma.**
