# Bitácora — Frente 4, segunda vuelta

Qué se hizo, qué se midió y **qué se descartó y por qué**. Lo último es lo que más vale: evita que
dentro de tres semanas alguien vuelva a proponer lo mismo.

> La bitácora de la primera vuelta está en
> [`docs-md-antiguos/planes-cerrados-2026-08/sistema-diseno/bitacora.md`](../../docs-md-antiguos/planes-cerrados-2026-08/sistema-diseno/bitacora.md).
> **Sigue valiendo**: es donde están las trampas ya pagadas, y varias se repiten.

---

## Antes de empezar: las trampas heredadas

No se vuelven a descubrir. Están medidas y documentadas, y **todas volvieron a aparecer** en la
primera vuelta después de darlas por sabidas.

| Trampa | Qué pasó |
|---|---|
| **Clases compuestas en runtime** | `` `${prefix}--${tone}` `` con el literal **en un valor por defecto de parámetro**: ningún `grep` lo encuentra. Una poda automática se llevó dos clases y **el build, el lint y los 304 tests pasaron en verde** con la barra lateral sin color |
| **Precedencia de capa > especificidad** | Una regla **sin capa** gana **siempre** a una capada, por muy específica que sea. Causó tres fallos distintos: los conectores de Vue Flow, el tinte del nodo de configuración y —vivo hoy— el borde de los 228 controles |
| **Hex corto dentro de hex largo** | `#fff` casa dentro de `#fff0ed`. Ordenar el mapa por longitud **no basta**: hace falta `(?![0-9a-fA-F])`. Costó 43 botones sin fondo |
| **Autorreferencia de token** | Sustituir el nombre a secas deja `--brand-border: var(--brand-border)`, inválido en tiempo de cómputo. 114 nodos cayeron a `currentColor` |
| **Los scripts reescriben la prosa** | Pasó **dos veces**. Un reemplazo masivo sobre código fuente también toca los comentarios, y los deja diciendo lo contrario de lo que ocurrió |
| **La base de la huella puede salir inválida** | Una captura salió con 4 nodos (página a medio renderizar) y no se detectó hasta comparar. **Comprobar el número de nodos antes de fiarse** |
| **Tailwind poda `@theme`** | Un registro que nadie usa **no se emite**. El `grep` sobre el CSS construido es la única prueba de que un registro está vivo |

## Y una que es de esta vuelta

**`:deep()` no salva si el ancla también es de otro componente.** `.ancla :deep(.hijo)` compila a
`.ancla[data-v-TUYO] .hijo`: sigue exigiendo que **`.ancla`** lleve tu scope, y un padre sólo estampa
su `data-v` en la **raíz** del hijo, nunca en un nieto. Así murieron 84 líneas de `HomeView.vue` sin
que nadie lo notara.

> Comprobación de diez segundos: clona el nodo en la consola **con y sin** el `data-v-*` que aparece
> en el selector compilado, y compara `getComputedStyle`. Si dan lo mismo, la regla sobra.

---

## Sesión 2026-08-11 · Apertura

Medición de cinco frentes en paralelo sobre `develop`. Resultado completo en
[`auditoria-2026-08-11.md`](./auditoria-2026-08-11.md).

**Lo que cambió el encuadre:** la deuda de color no era de disciplina sino de configuración. `@theme`
registra 16 nombres —9 de ellos muertos— y deja fuera los que más se usan, así que ~660 de las 3 590
apariciones de Tailwind **no tenían alternativa dentro del sistema**.

**Dos mediciones se cruzaron sin saberlo** y coincidieron al decimal: los contrastes anotados en
`tokens.css` están **subestimados en 3 de 4** (`--state-success` es 5.49 y no 5.00). Los desvíos son
conservadores, así que no hay riesgo — pero quien quiera aclarar `--state-warning` creerá tener menos
margen del que tiene.

**Verificado a mano, no delegado:** los dos hallazgos que dirigen el orden del plan.

- `.deasy-field-input` y `.deasy-field-select` renderizan `rgb(226,230,240)` = `--brand-border`, **no**
  `--brand-border-field`. Los dos tokens específicos de controles no llegan al DOM.
- «Mis envíos» (tono `indigo`) renderiza fondo `rgba(0,0,0,0)` mientras sus **seis hermanos** llevan
  `rgba(255,255,255,0.04)`. La variante no existe en `nav.css`.

### Fases — estado

| Fase | Estado |
|---|---|
| F1 · Los cinco bugs | ⬜ sin empezar |
| F2 · Completar `@theme` y crear los tokens que faltan | ⬜ sin empezar |
| F3 · Los 40 literales de sustitución invisible | ⬜ sin empezar |
| F4 · El barrido familia por familia | ⬜ sin empezar |
| F5 · Borrar lo muerto y corregir la documentación | ⬜ sin empezar |
| F6 · Las escalas | ⬜ sin empezar |

---

## Deuda propia, anotada al abrir

Dos cosas que salieron de la auditoría y **son de esta misma línea de trabajo**. Se anotan aquí para
que no parezcan hallazgos ajenos:

1. **`.graph-node__btn--accent` da 2.70:1** en las variantes `--config` y `--template`
   (`graph.css:179`). Blanco sobre un acento aclarado, y es la acción principal del nodo. Introducido
   el 2026-08-11 al deduplicar los nodos de Vue Flow. Va en **F1.7**.
2. **`frontend/CLAUDE.md` §8 dice 221 strings de clase largos; son 255.** Va en **F5**.
