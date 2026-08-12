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
| F1 · Los siete bugs (+ F1.8) | ✅ **cerrada** — worktree `develop-frontend`, pila B |
| F2 · Completar `@theme` y crear los tokens que faltan | ✅ **cerrada** — ídem |
| F3 · Los 40 literales de sustitución invisible | ⬜ sin empezar — **desbloqueada** |
| F4 · El barrido familia por familia | ⬜ sin empezar — **desbloqueada** |
| F5 · Borrar lo muerto y corregir la documentación | ⬜ sin empezar |
| F6 · Las escalas | ⬜ sin empezar |

---

## Deuda propia, anotada al abrir

Dos cosas que salieron de la auditoría y **son de esta misma línea de trabajo**. Se anotan aquí para
que no parezcan hallazgos ajenos:

1. **`.graph-node__btn--accent` da 2.70:1** en las variantes `--config` y `--template`
   (`graph.css:179`). Blanco sobre un acento aclarado, y es la acción principal del nodo. Introducido
   el 2026-08-11 al deduplicar los nodos de Vue Flow. Va en **F1.7**. ✅ cerrada.
2. **`frontend/CLAUDE.md` §8 dice 221 strings de clase largos; son 255.** Va en **F5**.

---

## Sesión 2026-08-11 · F1 y F2

Ejecutadas en el worktree `develop-frontend` sobre la **pila B**, con la **pila A como línea base
viva**: la A monta `develop` sin tocar, así que las dos corren a la vez y la huella se compara entre
navegadores, no entre commits. Salió mejor que capturar antes/después en la misma pila — así no hay
manera de contaminar la base, que es el fallo que ya se pagó una vez.

Tres commits: `6546791` (F1), `291e621` (F1.8), `d0bdc5e` (F2).

### Lo que se midió

| Ruta | Nodos | Diferencias | Atribución |
|---|---:|---:|---|
| `/home` A vs B tras F1 | 954 | **15** | 9 bordes de filtro (F1.1) · 4 del icono indigo (F1.2) · 2 de `z-index` (F1.4) |
| `/home` tras F1.8 | 954 | **0** | la extracción de clase no mueve nada |
| `/home` tras F2 | 954 | **0** | F2 no cambia aspecto |
| `/login` A vs B (final) | 75 | **2** | los dos campos de auth a `--brand-border-strong` (F1.1) |

Contrastes medidos **en el DOM**, no estimados: `.graph-node__btn--accent` 2.70 → 5.24 / 7.58 / 5.24;
las 13 variantes `hope-action-*` con su tinte (eran 10 de 12, y sólo 7 tenían `:hover`).

### Hallazgos nuevos, que no estaban en la auditoría

1. **Hoy NINGÚN `border-*` de Tailwind pinta sobre un `<input>`.** La regla sin capa de
   `overrides.css` no sólo mataba `--brand-border-field` y `--brand-border-strong`: mata también las
   utilidades, porque una regla fuera de capa gana a **todas** las capadas, y las utilidades están en
   `@layer utilities`. Son **90 declaraciones muertas**: 29 `border-slate-300` en reposo, **52
   `focus:border-indigo-400` y 9 `focus:border-sky-500`** — o sea los 61 bordes de foco de los campos.
   Las variantes `--error` (`border-red-300`) caen por lo mismo.
2. **`AppButton` estampaba `class="plain"` en 16 sitios.** El plan lo tenía como caso menor junto a
   `compact`. Es al revés: `compact` **no es un bug** —es una variante legítima de `PdfDropField`— y
   `plain` sí, y peor de lo descrito: **`plain` SÍ está en el mapa**, mapeado a `""`, que es *falsy*,
   así que el `||` lo tomaba por ausente igual.
3. **Los cuatro «tonos» de la barra lateral son el mismo color.** `sky`, `emerald`, `amber` y
   `violet` tenían los tres mismos valores byte por byte. El tono no pinta el tono: sobre la barra
   oscura todo es blanco al 88 % sobre un realce al 4 %. El único que se separa es `--slate`.

### Lo que se descartó, y por qué

Esto es lo que más vale de este fichero. **No volver a proponerlo sin leer el motivo.**

| Descartado | Motivo |
|---|---|
| **Bajar `input,select,textarea` a `@layer base`** en F1.1, que es su sitio arquitectónico | Resucita de golpe las 90 declaraciones del hallazgo 1 — entre ellas los 61 bordes de foco en 5 familias. Eso es **la decisión de F4.2**, no un efecto colateral de un lote de bugs. El plan ofrecía dos salidas y se tomó la otra («convertirla en la que declare el token correcto») |
| **Resucitar las variantes `--error` del campo** | Su valor declarado (`red-300` sobre `red-50`) da **1.75:1**, el peor par del sistema. Encenderlas sin cambiar el color empeora la accesibilidad en vez de mejorarla. Van **con** el color, en F4 |
| **Encender el `border-color` de los `:focus`** | Mismo mecanismo. Y el indicador de teclado **no se pierde**: el `box-shadow: var(--focus-ring)` de esas mismas reglas sí aplica, porque nadie compite por esa propiedad |
| **Subir los tres tokens de borde a 3:1** | Decisión del usuario: repinta 228 controles + tarjetas + botones secundarios. Merece su propia huella. En su lugar se creó `deliverables.css`, que da un sitio donde subirlo **sólo** en los componentes que lo necesitan |
| **Retirar los 9 registros muertos de `@theme`**, que pedía el plan | Las dos mitades de F2.1 se contradicen. `--color-state-success` es el **destino** de los 237 `emerald`/`green` que migra F4, y `--color-brand-white` el de los 290 `white`. Están pruned — **cuestan cero bytes** — así que retirarlos es quitar la diana justo antes de disparar y volver a ponerla en F4 |
| **Colapsar `#4BF1A1` sobre `--brand-accent` o `--state-success`** | Ya estaba medido y se volvió a comprobar: el mejor `color-mix` toca fondo en **ΔE 19.75** y la curva es plana (40 % → 20.35, 56 % → 19.75, 70 % → 20.14). No es cuestión de porcentaje: son tonos distintos |
| **Aplicar `--chart-1…7` a las aristas del organigrama** | La escala se **declara**; aplicarla es cambio de aspecto y los siete están en «lo que no se toca». Esto les da a dónde ir, que es lo que hace toda la fase |
| **Oscurecer `--graph-accent` para arreglar F1.7** | Apagaría los conectores, que es lo **único** que distingue un tipo de nodo de otro. El arreglo era separar dos tokens que estaban confundidos en uno: el conector va aclarado a propósito, el relleno sólido no |

### La decisión de `--state-current`, que el plan no había visto venir

F2.4 decía: «al elegir el valor del token, elegirlo **para que cumpla**». Al medirlo salió que eso
**se contradice con el motivo de existir del token**:

| Para que la menta llegue a 3:1 como borde | Resultado |
|---|---|
| `color-mix(--state-current 69.8%, negro)` = `#34a870` | 3.00:1 ✓ … pero **ΔE contra `--state-success` cae de 34.96 a 17.51** |
| La tinta a 4.50:1 exactos = `#118856` | ΔE 6.86 de `--state-success` — y justo en el umbral |

O sea: cumplir oscureciendo cuesta la distinción que este token existe para sostener («te toca» ≠
«hecho»), que es literalmente lo que §2.3 de `frontend/CLAUDE.md` avisa que no se haga.

**Salida tomada (decisión del usuario): la menta cambia de PAPEL, no de color.** Su fallo no venía de
ser clara, venía de usarse como **límite de componente**, que es a lo que 1.4.11 exige 3:1. Un tinte
de fondo al 10 % no tiene mínimo ninguno.

```
relleno   --state-current       #4bf1a1   sin mínimo — es un fondo
borde     --state-current-ink   #108353   4.78:1  ≥ 3:1    (era 1.46 ✗)
texto     --state-current-ink   #108353   4.78:1  ≥ 4.5:1  (era 4.38 ✗)
```

Es el patrón que el repo ya usaba en los botones de acción («el borde SÍ es un valor propio»). La
distinción se conserva entera porque vive en el relleno, que es el elemento dominante: **ΔE 34.96**.

Y de paso salió un tercer fallo que nadie había anotado: **el hover de ese botón ACLARABA** el borde
(de la menta al 75 % a la menta al 100 %), que es justo lo que §5.2 prohíbe. Ahora oscurece al 85 %,
como el resto.

> Cifras medidas **en el DOM**, no estimadas. El valor exacto para 4.50:1 sería `#118856`; se eligió
> `#108353` (4.78) para no quedarse en el umbral, donde el próximo retoque lo tumba.

### Dos trampas nuevas, las dos silenciosas

Van aquí porque **el CSS servido decía que la utilidad existía** en los dos casos.

1. **`rgb(var(--token-rgb)/0.65)` es CSS INVÁLIDO.** El triplete de un token va separado por comas, y
   la sintaxis heredada por comas **no admite la barra del alfa**. Tailwind emite la regla tal cual
   —un `grep` sobre el CSS construido la encuentra— y el navegador la descarta: el borde cae a
   `currentColor` sin un aviso en ningún sitio. Se usa **`rgba(var(--token-rgb), 0.65)`**.
   Comprobación que sí vale: aplicar el valor con `style=` en la consola y leer el computado; si
   devuelve el color heredado, el valor no vale.
2. **`shadow-[0_6px_16px_rgb(var(--x)/0.04)]` falla por lo mismo** y deja el elemento en
   `box-shadow: none`. Las sombras con token van en `box-shadow:` a pelo, asumiendo que el valor
   computado pierde la cadena de anillos vacíos de Tailwind (misma pintura, distinta representación —
   verificado leyendo el píxel en un canvas).

Y una tercera, de método: **una clase inyectada en runtime no sirve para probar un valor arbitrario
de Tailwind**, porque Tailwind genera esas utilidades escaneando el *fuente*. Para probar un valor
arbitrario hay que mirar el CSS construido; para probar una clase de módulo, inyectarla va bien.

### Pendientes que se abren

- **F3 tiene parte del trabajo medido**: el degradado `from-[#4BF1A1] via-[#3DE08F] to-[#2ec97d]`
  (`homeView.helpers.js:123`) es una rampa derivable — **93 % y 83.5 % sobre negro, ΔE 1.20 y 1.81**.
  Sustitución invisible; no hay que volver a calcularla.
- **F5 hereda dos cosas de F1**: el `border-radius: 0.5rem` de `overrides.css` sigue anulando el
  `rounded-2xl` de `forms.css` (16 px prometidos, 8 reales) en 228 controles — se dejó a propósito
  porque moverlo no era F1; y `.deasy-nav-glyph--violet` sigue sin consumidor.
- **F6.2 hereda los números provisionales** del apilamiento (drawer 1070, modal 1075, tip 1100,
  aviso 1190/1200). Están elegidos para que la relación sea correcta, no como escala.
- **Sin cerrar y sin dueño**: `workspaceNavIcons.js` compone `${prefix}--${tone}` sin comprobar que
  la variante exista, que es el fallo de fondo de F1.2 — la falta de `indigo` era el síntoma.
