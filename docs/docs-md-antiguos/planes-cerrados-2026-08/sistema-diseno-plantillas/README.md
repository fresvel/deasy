# `sistema-diseno-plantillas/` — Frente 4, SEGUNDA vuelta · ARCHIVADO

> ## ⚠️ ARCHIVADO el 2026-08-13. No es fuente de verdad y no se sacan tareas de aquí.
>
> Sus seis fases se ejecutaron. Lo que quedó pendiente **no es la continuación de esto**: es otro
> problema, y vive en [`docs/planes/sistema-diseno-componentes/`](../../../planes/sistema-diseno-componentes/).
>
> Se conserva por una razón concreta: **`bitacora.md` es donde están las trampas ya pagadas.**
> Cuarenta y pico hallazgos medidos que no se pueden reconstruir leyendo el código.

## Qué ganó esta vuelta

| | antes | después |
|---|---:|---:|
| Colores de Tailwind por nombre en plantillas | 2 117 | **206** |
| Reglas fuera de capa | 52 | **33** |
| Repintados de utilidad en `overrides.css` | 5 | **0** |
| Utilidades de foco en plantillas | 111 | **0** |
| Valores arbitrarios `X-[…]` | 423 | **374** |
| Strings de clase >120 caracteres | 203 | **174** |
| Clases propias sin regla | 23 | **0** |
| `!important` | 5 | **3** |
| Tests | 304 | **316** |
| Gates automáticos | 1 (suelto) | **4 encadenados** |

Y lo que no es un número: **se adoptó la paleta de TailAdmin** en dos capas —91 primitivas más los
22 tokens semánticos como alias encima— y **seis componentes pasaron a declararse en un solo sitio**,
cuatro de ellos con la geometría de TailAdmin.

⚠️ **Las cifras del plan y de la auditoría son del 08-11 y ya no son ciertas.** Manda esta tabla, y
el estado de hoy está en el plan nuevo.

---

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

## ⚠️ Estado a 2026-08-13 — si vas a retomar esto, empieza aquí

**El plan describe una paleta que ya no existe.** Lleva su propia tabla de traducción arriba del
todo; léela antes de tocar nada, o vas a migrar hacia nombres muertos.

**Las seis fases, remedidas sobre `develop` fusionado (`3b01a60`).** El plan tiene el detalle; esta
tabla tiene el estado.

| Fase | Estado | Queda |
|---|---|---|
| **F1** Los 5 bugs | ✅ 08-11 | — |
| **F2** Completar `@theme` | ✅ 08-11 | — |
| **F3** Literales invisibles | ✅ **08-12** | 28 sustituciones (`eb72dd6`). Los **29 restantes NO son de F3**: ninguno baja de ΔE 2 contra un token |
| **F4.1 · 4.3 · 4.4** | ✅ | 4.4-c bajó **156 → 52** reglas fuera de capa |
| **F4.2** Familias en disputa | ⬜ **decisión** | **~1 190** en plantillas. Su mitad de CSS ya está resuelta y **fija el criterio**: derivar del token, no elegir un tinte |
| **F4.5** Dentro de `@apply` | ✅ **08-12** | 148 de 151 (`3bffc1c`, `2128d51`, `1942143`). Quedan **3 `bg-slate-100`**, fuera a propósito |
| **F5** Borrar lo muerto | ✅ 08-12 | — |
| **F6.1** Tipografía | ⬜ **decisión** | **200 usos, 21 grafías** de `text-[…]` |
| **F6.2** `z-index` | ⬜ **decisión** | **20 valores**, tres bandas |
| **F6.3** *Utility soup* | ⬜ **atada al maestro** | **203** strings largos — va con partir `HomeView` |

> ⚠️ **Esta tabla decía «abiertas» F3 y F4.5 hasta el 2026-08-13**, cuando el plan ya las daba
> cerradas desde `eb9ba1e`, y publicaba «~208 sitios mecánicos delegables» de trabajo **ya hecho**.
> Es literalmente la trampa que la bitácora describe: quien lo retome empieza por rehacer lo hecho, y
> el trabajo mecánico **no da señal de estar repetido** — la huella vuelve a dar 0 y todo parece bien.

**Lo que queda son dos trabajos de naturaleza distinta, y conviene no mezclarlos:**

- **Mecánico de volumen (~1 190)**: F4.2. **Avisado**: es la clase de trabajo que la retrospectiva del
  2026-08-12 juzgó *«correcto pero mecánico; unifica la paleta, no arregla nada visible»*. Con el
  rediseño de abajo a la vista, ahora sí compensa.
- **Decisión de diseño**: el foco (**113 utilidades muertas** — encenderlas *es* el cambio), las **52
  reglas fuera de capa** que suprimen 83 radios y 90 bordes ya escritos, y F6.1/F6.2. Esto no es
  trabajo de agente: se decide mirando la pantalla. **Una vez decidido, sustituir sí es mecánico.**

> **Y la premisa que se cayó el 2026-08-12 volvió el 2026-08-13: se adopta TailAdmin.** Su descarte
> dejó huérfanas las cuatro decisiones que F4.2 y F6 le habían delegado —foco, escalones tipográficos
> bajo 14 px, bandas de `z-index` y tinte de las variantes suaves—. Se adoptan **su paleta** (las 91
> primitivas, más sus escalas de tipografía, sombra y `z-index`) y **su markup** (sólo desde el repo
> HTML free, MIT, con atribución); **no su código Vue**. Nuestros 22 tokens semánticos pasan a ser
> **alias sobre sus primitivas**, y los porcentajes de contraste de Deasy siguen mandando sobre sus
> tintes. Plan y trazas: rama `develop-styles`, verificación en la **pila B**.

La sesión del 2026-08-12 (8 commits: colapso de la paleta, 24 clases muertas, un fallo de
transparencia y la documentación) **no salió de estas fases** y está entera en la bitácora.

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
