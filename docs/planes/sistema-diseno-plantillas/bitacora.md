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
| F4 · El barrido familia por familia | 🟨 **4.1 y 4.3 hechas** · quedan 4.2, 4.4 y 4.5 |
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

---

## Sesión 2026-08-11 (cont.) · F4.1 y F4.3

Commit `f0fa366`. **285 sustituciones** en 65 ficheros, todas de utilidad de Tailwind a utilidad del
sistema. El único cambio visible es F4.3, y va declarado.

| | Sustituciones | Efecto |
|---|---:|---|
| **F4.3** `text-slate-400` → `text-brand-text-muted` | 206 | **2.63:1 → 6.36:1**. Es el placeholder de todos los campos |
| `text-slate-600` → `text-brand-icon` | 116 | ΔE 1.17 · contraste 7.58 → 7.58 |
| `text-emerald-700` → `text-state-success` | 44 (+4) | ΔE 1.28 · 5.36 → 5.48 |
| `text-amber-700` → `text-state-warning` | 20 | ΔE 2.29 · 5.03 → 5.02 |
| `text-sky-800` → `text-action-view` | 13 | ΔE 1.04 · 7.51 → 7.56 |

Huella de `/home`, 960 nodos: **189 declaraciones cambiadas y las propiedades afectadas son sólo
`color`** más los `border-*-color` que en un SVG siguen a `currentColor`. Cero fondos, cero
geometría, cero `z-index`. Las cinco transiciones son las cinco declaradas.

### Dos correcciones a la auditoría, las dos del mismo tipo

**1. «Siete tokens SON un color de Tailwind, con ΔE 0.00» es falso hoy.** La auditoría comparó los
tokens contra los hex **heredados de Tailwind v3**; el repo corre **v4.2, que sirve su paleta en
OKLCH**, y esos valores no vuelven al hex de v3. Medido en el DOM contra lo que renderiza:

```
text-slate-600    #475569 declarado    renderiza 69,85,108    ΔE 1.17
text-emerald-700  #047857              renderiza  0,122,85    ΔE 1.28
text-amber-700    #b45309              renderiza 187,77,0     ΔE 2.29
text-sky-800      #075985              renderiza  0,89,138    ΔE 1.04
```

Siguen dentro de la banda «demostrablemente invisible» del propio plan (ΔE ≤ 2) salvo amber, que
roza, y el contraste se mantiene o mejora en las cuatro. Pero **la premisa «cambio visual cero por
construcción» no se sostiene**: es «cambio imperceptible, medido».

> Regla que sale de aquí: **el hex de un token no se compara con el hex documentado de Tailwind, se
> compara con lo que el navegador RENDERIZA.** Son cosas distintas desde v4.

**2. `bg-slate-50` no es la migración segura que parecía. Se revierte.** Es idéntica en **color**
—247,249,252 al píxel, porque `overrides.css` ya lo repinta a `--brand-surface-muted`— pero **no en
prioridad**: ese repintado lleva `!important`, y es esa prioridad la que le gana a
`.deasy-dialog-body` y a `input`, que fijan fondo blanco **sin capa**. Migrados a
`bg-brand-surface-muted` —una utilidad normal en `@layer utilities`— dos nodos cayeron a blanco.

> **`bg-slate-50` no significaba «slate-50»; significaba «slate-50 con prioridad».** Desenredar eso
> es F4.4 («eliminar la necesidad del repintado»), no F4.1. Los 109 sitios vuelven atrás.

### Y las dos trampas conocidas volvieron a saltar

Las dos las cazó **la huella**; ni el lint, ni el build, ni los 304 tests.

1. **El script reescribió SELECTORES, no usos.** `.bg-slate-50\/70` → `.bg-brand-surface-muted\/70`
   en `overrides.css`, y el repintado dejó de casar: dos nodos pasaron de sólido a 70 % de alfa. Lo
   que burla la guarda es el **escape del `/`**: el carácter que sigue a `bg-slate-50` es `\`, así que
   un límite por la derecha `(?![\w/-])` da el match por bueno. → **Al migrar utilidades por script,
   `shared/styles/*.css` se excluye o se revisa a mano.**
2. **El script reescribió PROSA** en tres comentarios (`index.css`, `misc.css`,
   `ProcessConfigNode.vue`). Es la trampa nº 5, que ya había pasado dos veces. `tokens.css` estaba
   excluido a propósito y ahí no entró — la exclusión funcionó, lo que faltaba era extenderla.

### Estado de F4 tras esto

| Sub-fase | Estado |
|---|---|
| 4.1 · las familias de tono | ✅ hecha (menos `bg-slate-50`, que se devuelve a 4.4) |
| 4.2 · conceptos en disputa + **el foco** | ⬜ — y recordar que **las 117 utilidades de foco están muertas** |
| 4.3 · `text-slate-400` | ✅ hecha |
| 4.4 · la fuga del repintado de `overrides.css` | 🟨 **a y b hechas** — ver abajo |
| 4.5 · los 211 dentro de `@apply` | ⬜ |

---

## Sesión 2026-08-11 (cont.) · F4.4 y la decisión sobre las capas

Commit `0180e22`.

### La decisión, y por qué no era la lista blanca

Lo que bloqueaba §4.4 no era que la lista blanca se quedara corta: era que **`overrides.css` hace dos
cosas mezcladas en la misma lista de selectores** — repintar utilidades de Tailwind (A) y dar skin a
componentes (B). **Tres reglas juntaban las dos**: `.bg-white` + 16 clases de componente,
`.border-slate-*` + 7, `.shadow-*` + 6.

> **Y de ahí salían los `!important`. No resolvían un conflicto contra Tailwind: resolvían un
> conflicto del fichero CONSIGO MISMO** — la regla (A) iba antes que la (B) que pisaba la misma
> propiedad en el mismo elemento, así que hacía falta prioridad para que ganara la que debía.

Medición que fundamenta la decisión: **150 reglas fuera de capa en 12 módulos**, y sólo **dos hojas
de terceros sin capa** contra las que competir (`@vue-flow/core`, `leaflet`). Todo lo demás está sin
capa por inercia.

```
@layer components   todo skin de componente
@layer utilities    los repintados, MIENTRAS existan
sin capa            SÓLO lo que pelea con un tercero sin capa
```

Con eso vuelve el contrato de Tailwind —utilidad gana a componente— y el repintado deja de hacer
falta: `bg-brand-surface-muted` gana a `.deasy-dialog-body` **por capa**.

**Es seguro, y se midió antes de decidir:** **cero** elementos combinan una clase de skin con una
utilidad de fondo/borde/sombra que hoy pierda contra ella. Al contrario que en F1.1, aquí bajar (B)
de capa **no resucita nada**.

### Un modo de colisión nuevo: la prop de clase

Las únicas colisiones skin↔utilidad no están en las plantillas — **entran por props**:

```
FirmarPdf.vue:786   body-class="p-0 bg-slate-50 relative"   ->  .deasy-dialog-body
                    header-class="bg-slate-50 border-b …"   ->  .deasy-dialog-header
```

`AppModalShell.vue:37` hace `class="deasy-dialog-body" :class="bodyClass"`: el skin lo pone el
componente y la utilidad llega de fuera, así que **sólo se encuentran en runtime**. Un `grep` de
plantillas da cero. Es primo de la trampa de las clases compuestas, y hay que añadirlo a la lista:
**antes de mover una regla de capa, buscar también las props de clase que apuntan a ella.**

### Lo hecho

| | | |
|---|---|---|
| **4.4-a** | 104 sustituciones de las que **se escapan** | ΔE compuesto sobre blanco: 0.53 · 0.56 · 0.66 · 1.63 · 1.23 · 0.00 |
| **4.4-b** | (B) arriba, (A) al final: gana por orden | Huella **0 diferencias** |

Cae **uno de los tres `!important`**, el de `.bg-slate-50`. Los otros dos pelean contra
`.deasy-dialog-root .deasy-dialog-header button` (0,3,1) **sin capa** en `dialogs.css`, y contra una
especificidad mayor el orden no puede.

> Lo descubrí quitándolos: la huella marcó **un nodo** —el botón de cerrar de los diálogos— pasando a
> `--brand-border-field`. Es discutible cuál debería ganar (**el componente declara `-field` y el
> repintado se lo pisa**), pero eso es una decisión de diseño y no cabe en un commit que promete
> cambio visual cero. Restaurado, y anotado para cuando `dialogs.css` baje de capa.

Y se retira el `.shadow-xl` **sin capa**: F5 decía que nunca aplicaba porque el `!important` de
`@layer utilities` gana siempre. Comprobado en el DOM antes y después — sigue dando `--brand-elev-2`.
**Es la primera de las tres reglas muertas por cascada de F5 que se cierra.**

### Lo que se descartó aquí

| Descartado | Motivo |
|---|---|
| **Ampliar la lista blanca** con las 120 que se escapan | Es lo que se venía haciendo y por eso se escapaban 120. Es una lista escrita a mano: vuelve a pasar |
| **Migrar `bg-slate-200` (16 usos)** | No tiene destino en la paleta — no es `--brand-border` (eso es un borde, no una superficie) e inventarle uno no es migrar. Queda para F6 o para cuando alguien declare ese escalón |
| **Bajar las 150 reglas de capa en este commit** | Es el paso que la decisión desbloquea, pero son 12 módulos: va **módulo a módulo y con huella por módulo**, no de golpe |

---

## §4.4-c y 4.4-d · cerradas (2026-08-11/12)

Seis racimos (`ada8ff5`, `0396590`, `8020850`, `af3e2bd`, `59b2713`, `909fb60`) y la migración
(`0f726f5`). **156 → 58 reglas fuera de capa**, huella 0 en las siete rutas en todos ellos.

4.4-d migró **621 utilidades** a tokens y mató **dos reglas del repintado** — `.bg-slate-100` y
`.border-slate-100`, ambas a 0 consumidores. Es la primera vez que el bloque (A) pierde piezas.

### EL INVENTARIO DE SUPRESIONES

**Esta tabla es el entregable de §4.4.** Son las 58 reglas que se quedaron fuera de capa, y lo que
cada una está tapando hoy. Vivía sólo en los comentarios del CSS; se trae aquí porque ahí sobraba.

| Regla | Suprime | Dónde se decide |
|---|---|---|
| `base.css` `h1..h6` + `.admin-typography h1..h6` | **109 utilidades en 95 encabezados**: 77 de peso (`font-bold`, `font-semibold`…) + 32 de `tracking`/`leading` | Tipografía (§6.1) |
| `base.css` `a`, `a:hover` | 3 `router-link` con `text-*`, y `.deasy-auth-link` — que hoy sale teal en vez de violeta | Familias en disputa (§4.2) |
| `admin.css` `.admin-page-header__title` | Un `mt-1` (4 px) en `HomeView.vue` | Trivial |
| `overrides.css` `input, select, textarea` (2 reglas) | **83 radios + 44 bordes + 80 focos** en 228 controles | §4.2 y F5 |
| `overrides.css` `.deasy-field-*`, `.deasy-filter-*`, `.profile-*`, `.admin-select-field` | Los `:focus` capados de `forms.css` (borde `--brand-primary`) y el radio del select | §4.2 |
| `overrides.css` `header` | 2 cabeceras de cajón y 1 translúcida | F5 |
| `overrides.css` `.deasy-fa-icon` | 4 iconos con color propio | Trivial |
| `overrides.css` `.hope-action-*` (7) y `.deasy-btn--secondary` y hermanas (3) | **239 nodos** y 5 nodos — y **no por una utilidad**: les gana `.deasy-table-shell .deasy-btn` (0,2,0), más específica, ya dentro de la capa | Pendiente |
| `dialogs.css` `.deasy-dialog-root` | **116 nodos**: el velo de todos los modales | Pendiente |
| `dialogs.css` `.deasy-dialog-panel` | 49 bordes + 44 sombras + 5 radios, por `content-class` | Pendiente |
| `dialogs.css` `.deasy-dialog-body` | **33 utilidades de padding** (58 nodos), por `body-class` | Pendiente |
| `dialogs.css` `.deasy-dialog-footer` · `… header button` (2) · `.deasy-dialog-title` · `.process-dialog-content` (3) | 6 + 15 + 10 nodos | Pendiente |
| `forms.css` `.profile-*:focus` | El borde de foco de **49 controles** del dossier | §4.2 |
| `signatures.css` los 2 cursores | Nada hoy — preventivo, por el prop `customClass` de `SignatureBox` | — |
| `graph.css` los 3 conectores | Compiten con `@vue-flow/core`, que va sin capa | **No se toca** |

### Las tres lecciones que costaron una medición cada una

1. **Enumerar utilidades no basta.** `.hope-action-*` no pudo capar por una regla de componente **más
   específica ya en la capa de destino**, no por una utilidad. 239 nodos. El análisis estático predijo
   6 grupos peligrosos; la huella encontró 8.
2. **La huella puede dar 0 sin haber mirado nada.** Las siete rutas no renderizan ni un modal, que es
   donde vivía todo el riesgo de `dialogs`. Hubo que abrirlos y medirlos aparte. Igual con `:focus`,
   que `getComputedStyle` no captura.
3. **«No tapa nada» y «no he encontrado qué tapa» no son lo mismo.** Se intentó partir
   `input,select,textarea` por declaración —la técnica que sí funcionó en `.deasy-dialog-body`— con el
   argumento de que su `background` sobraba. Aparecieron 10 nodos: dos controles con `/alfa` que
   salían blancos y ocho inputs ocultos que perdían el fondo. Revertido.

### Y una de método, la cuarta vez que pasa

Un script de migración volvió a reescribir el mismo comentario de `ProcessConfigNode.vue`. Ya lo
habían reescrito otros tres. Sus nombres de clase van ahora **descritos y no escritos**.
