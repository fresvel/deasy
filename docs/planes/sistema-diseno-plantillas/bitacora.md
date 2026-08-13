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

---

## Sesión 2026-08-12 · la paleta se colapsa, y TailAdmin se descarta

Ocho commits, `3ba869d` → `c67189e`. **La cuestión de fondo fue una pregunta tuya**: si `--color-` ya
es el namespace de Tailwind, ¿qué pinta ahí el `brand-`? Nada, y de tirar de ese hilo salió todo lo
demás.

### La decisión que reencuadró la fase: TailAdmin fuera

Se descartó como fuente de diseño. **Importa más de lo que parece**, porque el plan le había asignado
las respuestas de F4.2 y F6: «cómo se ve el foco» se iba a contestar copiando su receta. Sin eso,
esas fases no están bloqueadas por análisis sino **por una decisión de diseño que hay que tomar aquí**.

### El criterio nuevo, que es el que gobierna la paleta a partir de ahora

> **Un token propio se justifica con DOS condiciones, y hacen falta las dos:** que Tailwind no traiga
> ya ese color (ΔE ≤ 2 = es el mismo a ojo), y que **el concepto pueda cambiar de color**. Si el
> concepto ES el color, usa el de Tailwind.

De ahí salió que `--brand-white` sobraba (271 usos de un nombre más largo para `#ffffff`) y que
`--color-line` se queda (el borde del sistema cambiará algún día, y entonces es una línea y no 354).

### Lo hecho

| | Qué | Cómo se probó |
|---|---|---|
| `3ba869d` | 8 registros sin **un solo** consumidor: `--chart-1..7` y `--state-info` | El CSS construido difiere en **1 línea**. Los registros de `@theme` ni se emitían |
| `7910413` | `--brand-white` → el `white` de Tailwind (197 utilidades + 74 `var()`) | Diff = el renombrado entero; `--color-white` emitida de verdad |
| `4e29d9e` | **fix**: la transparencia de `bg-white/NN` | Medido en el DOM: el velo vuelve a `/ 0.8` |
| `c815c1b` | `--brand-surface-alt` colapsado sobre `--surface` (ΔE **0.56**) | 7 reglas, contadas una a una |
| `8887012` | **24 clases** declaradas sin un solo uso | Diff del CSS revisado selector a selector |
| `231cafe` | Una declaración por color, sin prefijo | **Huella 0** contra `ad2de56` en la misma pila |
| `c40555e` `c67189e` | `frontend/CLAUDE.md` y la skill, al día | — |

### El fallo que encontramos sin buscarlo: `bg-white/80` salía OPACO

`.bg-white` y sus cinco variantes con alfa compartían una regla **sin capa** que las pintaba a todas
con blanco sólido. Para `.bg-white` a secas eso no hace nada —pinta blanco con blanco—, pero a las
variantes les quitaba el alfa.

**Que era un accidente y no una decisión lo prueba el propio código:** cinco de los nodos afectados
combinan `bg-white/80` con `backdrop-blur`, y un desenfoque de fondo sobre un fondo opaco **no hace
absolutamente nada**. Alguien escribió un cristal esmerilado —el velo de carga, el pie del
multifirmador— y la regla lo convirtió en una losa. Y el mismo propósito escrito `bg-brand-white/80`
sí salía translúcido, porque la regla no nombraba ese selector: **el aspecto dependía de qué token
hubiera elegido quien lo escribió.**

### Tres correcciones a lo que esta misma bitácora daba por bueno

1. **Los «239 nodos» no los ponía `.deasy-table-shell`.** Esa clase **no está en una sola plantilla**;
   compartía lista de selectores con `.deasy-table-responsive`, que es la que gana. La tabla de
   supresiones de §4.4-c la nombra cuatro veces y estaba mal las cuatro.
2. **`--state-current` (el relleno menta) nunca se emitió.** Tenía cero consumidores, igual que los
   `--chart-*`; sus 4 «usos» eran de `-ink` (el `\b` del grep casaba antes del guion). Hoy vive sólo
   como `--step-rgb`, que es como se usa de verdad: al 10 % y al 35 %.
3. **`--font-base`, `--font-size-base` y `--line-height-*` ocupaban el namespace `--font-*`** sin ser
   de Tailwind. Era el mecanismo del `--radius-lg` esperando a que alguien declarase el token que
   chocara. Hoy son `--typeface` y `--type-*`.

### Cuánto de la paleta era realmente nuestro

Medido convirtiendo la paleta de Tailwind v4 desde su **OKLCH real** (no desde los hex de v3, que es
el error que ya nos costó una medición) y verificado pintando en un canvas del navegador: coincide en
los 21 comprobados.

**7 de los 22 tokens están a ΔE ≤ 2 de un color de Tailwind** — `navy`→`gray-900` 0.52,
`surface`→`slate-50` 0.56, `ink`→`gray-800` 1.00, `action-view`→`sky-800` 1.04, `icon`→`slate-600`
1.17, `success`→`emerald-700` 1.28, `line`→`slate-200` 1.61.

**Se decidió NO anclarlos**, y el motivo se ha quedado obsoleto (era «se re-decidirán con TailAdmin»).
Si se retoma, dos trampas medidas: Tailwind **sí** emite `--color-slate-600` al referenciarla desde
`:root` (probado), pero los gemelos `-rgb` se desincronizan **en silencio** — `--success-rgb` deja de
corresponder a `emerald-700` y se usa en un degradado de `auth.css`.

> Y un dato que no estaba en ningún sitio: **87 de los 288 colores de Tailwind v4 caen fuera de la
> gama sRGB**. En pantalla sRGB el navegador los recorta (coincide con el cálculo), pero en una P3 se
> ven más saturados. Nuestros hex se ven igual en las dos.

### Tres trampas del instrumental, las tres pagadas hoy

1. **`diff` a través del proxy `rtk` devolvió «Files are identical»** sobre dos ficheros que difieren
   en 70 bytes. Salió con `cmp` y con `rtk proxy diff`. Con CSS de una sola línea muy larga, no te
   fíes de un diff en verde.
2. **La pila A monta `develop`, no tu worktree.** No sirve de baseline para una rama: mide el trabajo
   entero. El A/B bueno es `git checkout <base> -- frontend/src` **sobre tu propia pila**.
3. **Cuando un cambio no puede mover un píxel, pruébalo con el CSS construido.** Construir con y sin
   el cambio y comparar el emitido es más barato que una sesión de navegador y más fuerte: si el diff
   son las líneas que tocaste y nada más, no hay nada que verificar a ojo. Así se cerraron `3ba869d`
   y `7910413` sin abrir el navegador.

> ⚠️ Al comparar el CSS de antes y después de un renombrado, **no se puede comparar por nombre**: el
> viejo tenía DOS nombres por color (`--color-brand-X` cuando venía de una utilidad, `--brand-X`
> cuando venía de un `var()` a mano), y colapsar ese desdoblamiento es justo el cambio. Hay que
> canonizar ambos lados al mismo **concepto**.

---

## 2026-08-12 (cierre) · Remedida de las seis fases sobre `develop` fusionado

Al preparar el traspaso salió una **deriva del plan contra el árbol**: la tabla de ejecución de §4.4
seguía marcando **4.4-c y 4.4-d como pendientes** cuando llevaban cerradas desde el 08-11. Se veía
en una sola cifra —**52 reglas fuera de capa**, no 150— y nadie la había mirado desde entonces.

> **Un plan con una fase cerrada marcada como abierta no es un error de forma: es una trampa.** Quien
> lo retome empieza por rehacer lo hecho, y el trabajo mecánico no da señal de estar repetido: la
> huella vuelve a dar 0 y todo parece correcto.

Se remidieron **todas** las cifras del plan, no solo las de §4.4. Cuatro habían cambiado lo bastante
como para engañar a quien planifique:

| El plan decía | Hoy | Por qué cambió |
|---|---:|---|
| F3 «40 literales» | **75** | El recuento original no cubría `rgb()/rgba()` numérico, solo `#hex` |
| F4.5 «211 en `@apply`» | **151** | F4.4 se llevó parte por el camino |
| F6.3 «255 strings largos» | **205** | F4 y F5 acortaron plantillas |
| F6.2 «11 valores de `z-index`» | **20** | El recuento original no miraba `.css`, solo plantillas |

Y una que **baja el trabajo**, no lo sube: de los 75 de F3, **15 son los grafos y 3 el logo**, y los
dos bloques ya estaban excluidos en «Lo que NO se toca». La superficie real es **~57**. Merece
escribirse porque el número grande es el que se cita al planificar, y llevaba un 30 % de aire.

**Método, para no repetir la cuenta a ojo:** las cifras de este plan se sacan con `grep -rohE`
contando **ocurrencias, no ficheros**, e incluyendo `.css` cuando la deuda vive también en `@apply`.
Excluir `.css` es justo lo que escondió los 151 y la mitad de los `z-index`.

---

## Sesión 2026-08-12 (relevo) · F4.5 y F3 — y F4.5 no era mecánica

Cuatro commits, `3bffc1c` → `1942143`, en `design/f45-f3` sobre la **pila B**. F4.5 cerrada (148 de
151) y F3 cerrada (28 de los ~57).

### Lo que cambió el encargo: medir antes de migrar

El plan y el traspaso describían F4.5 como «mecánica». **Lo era para 33 de los 151.** Se midió el
ΔE de cada clase contra el OKLCH real de `tailwindcss@4.2.2` (extraído de su `theme.css`, no de los
hex de v3) y contra los 22 tokens, buscando token puro **y** derivación:

| | Cuántos | Qué pedía |
|---|---:|---|
| Familia neutra | 33 | Nada. Token del mismo concepto a ΔE ≤ 2.07 |
| Escala de texto | 29 | Una decisión: el más cercano en ΔE no siempre conserva el contraste |
| Variantes suaves | 86 | Una decisión mayor: **no hay destino a ninguna distancia** |

> **El hallazgo que reencuadra la fase:** las 86 son **F4.2 metida dentro de un `@apply`**. Mismas
> seis familias, contadas aparte sólo por dónde viven. Y la paleta no puede absorberlas porque
> **declara un solo tono por estado, y es el oscuro**: no existe «el rojo claro de fondo». El
> destino de un `bg-red-50` no es un token — es un `color-mix`.

Las dos decisiones se llevaron al usuario con la medición delante. Aprobó las dos.

### Una incoherencia que no estaba escrita en ningún sitio

**`@apply border-slate-200` NO lo alcanza el repintado de `overrides.css`.** `@apply` copia la
DECLARACIÓN, y el selector `.border-slate-200` necesita la clase en el atributo. Así que hasta hoy
la misma clase valía `#e2e8f0` escrita en un módulo y `--color-line` escrita en una plantilla.
Ahora coinciden. **Efecto colateral útil:** la trampa 2.10 (una utilidad repintada lleva prioridad,
no sólo color) **no aplica dentro de `@apply`**, así que estas 33 no tenían el riesgo que tenían
las 109 de §4.1.

### La corrección a la receta, que es una regla del sistema

**El relleno en reposo es el 6 %, no el 10 %.** El 10 % de `frontend/CLAUDE.md` §2.4 sale de los
botones de acción, donde encima del relleno hay un **icono** (mínimo 3:1). Donde encima hay
**texto** (4.5) el relleno se come parte de la diferencia:

```
relleno   danger  success  warning  pending  action-view  primary
   6 %      5.97     5.05     4.64     4.99         6.89     4.81
  10 %      5.58     4.78     4.39!    4.69         6.44     4.55
  16 %      5.03     4.35!    4.01!    4.30!        5.83     4.18!
```

En el *hover* sí vale el 16 %, porque ahí la receta **oscurece además el texto** (85 % sobre negro)
y el contraste sube en las seis. El relleno no tiene mínimo propio, **pero se lo come al texto que
lleva encima** — eso es lo que no estaba escrito.

### Tres cosas que encontró la ejecución y no estaban previstas

1. **El placeholder de un campo en error no se arregla aclarando el rojo.** Era `red-300`: 1.92:1.
   El rojo más claro que cumple sobre ese fondo es el **90 %** del token, o sea a un paso del color
   del propio texto: arreglas el contraste y pierdes la distinción valor/placeholder. La salida es
   que use el mismo `--color-muted` que todos los demás campos. 5.40:1.
2. **El borde y el fondo de `.deasy-field-input--error` no pintan**, y no por esta migración: los
   tapa el grupo `.deasy-field-*` de `overrides.css`, que sigue fuera de capa. Medido en el DOM
   antes y después. Escrito en la propia regla para que nadie lo mida y crea que se rompió.
3. **`.deasy-tag--accent` no era otro color**: es el escalón fuerte del mismo azul que `--info`
   (`sky-300`/`sky-100` frente a `sky-200`/`sky-50`). Lo mismo dicho sin decir que es lo mismo.

### El velo de los modales: la migración correcta era borrar

`.deasy-dialog-root { @apply bg-slate-950/45 backdrop-blur-[2px] }` **estaba muerto** — la regla sin
capa del final del mismo fichero gana siempre y ya usaba `--overlay-backdrop`. El comentario de esa
regla lo avisaba desde 4.4-c. Medido antes de tocar: el computado ya era `rgba(15,23,42,0.48)` +
`blur(3px)`.

> Y un falso peligro que parecía real: el `@apply` emitía `-webkit-backdrop-filter` y la regla
> ganadora no lo escribe, así que borrarlo parecía dejar sin desenfoque a Safari ≤17. **No:
> lightningcss ya prefija esa propiedad en el build.** La versión con el prefijo escrito a mano daba
> un CSS byte por byte idéntico. Se retiró por redundante.

### F3: el criterio de la fase excluía a la mitad de la fase

De los ~57, sólo **28** cumplían «ΔE ≤ 2 contra un token existente». Los 29 restantes son F4.2 (6
sombras de color, 9 paradas de degradado), una paleta cualitativa (los 6 colores de formato de
fichero — que son justo los consumidores que les faltaban a los `--color-chart-*` retirados en
`3ba869d`), la paleta azul paralela de `PerfilView`, un gris de icono sin escalón, el anillo de foco
que el propio plan ya difería, y **un falso positivo dentro de un comentario**.

Los 26 de tinta de sombra son **cambio cero demostrado**: `getComputedStyle` devuelve el mismo
string para `#0f172a0a` y para `rgba(15,23,42,0.04)`.

### Cuatro notas de instrumental

1. **`shadow-[…rgb(var(--x)/0.04)]` sigue muriendo en silencio** en `tailwindcss@4.2.2` — se
   comprobó a propósito antes de migrar 26 sombras. `box-shadow: none`. La forma con coma sí vale.
2. **Al contar dentro de `@apply`, quita los comentarios primero.** Un comentario que cita
   `` `@apply bg-slate-950/45` `` cuenta como uso. Los nombres de clase en comentarios van
   **descritos y no escritos** — es la quinta vez que esto pasa en este repo.
3. **Comparar tintas de sombra COMPUESTAS no vale para decidir.** A 0.06 de alfa sobre blanco,
   cualquier tinta oscura sale a ΔE ~1. Hay que comparar tinta contra tinta.
4. **`@media (hover: hover)` escrito a mano es exactamente lo que compila `@apply hover:`** —
   verificado en el CSS construido. Vale la pena cuando la alternativa es un
   `hover:bg-[color-mix(in_srgb,var(--tone)_16%,var(--color-white))]` de 55 caracteres.

### Qué queda de F4.5 y por qué

**3 `bg-slate-100`.** Es un segundo escalón de superficie que la paleta no declara, y colapsarlo
sobre `--color-surface` (ΔE 1.29) **mataría el hover de `.deasy-btn--soft-neutral`**, que va
justamente de slate-50 a slate-100. Mismo criterio que se aplicó a `bg-slate-200` en 4.4: sin
escalón declarado no se inventa uno.

---

## Sesión 2026-08-13 · se revierte el descarte: TailAdmin se adopta

Rama `develop-styles` (worktree `../deasy-styles`), verificación en la **pila B**. La pila A se queda
como está: monta `develop` y tiene trabajo de otra sesión.

### La decisión, y por qué se revierte

El descarte del 08-12 dejó huérfanas **las cuatro decisiones que el plan le tenía delegadas** —cómo
se ve el foco, cuántos escalones tipográficos hay bajo 14 px, qué bandas de `z-index` y qué tinte
llevan las variantes suaves—. Sin ellas el frente 4 no puede cerrarse, y contestarlas desde cero es
justo el trabajo que la skill ya tenía medido. Se adoptan **su paleta** y **su markup**; **no su
código Vue**.

**Su paleta no sustituye nuestros nombres: los sostiene.** Sus 91 colores entran como capa de
primitivas en `@theme` y los 22 tokens semánticos pasan a ser alias encima
(`--color-line: var(--color-gray-200)`), para que `border-line` siga diciendo qué *es* y no de qué
*color* es. Es la única forma de tener su paleta sin tirar el argumento de §2.2-2.3 de
`frontend/CLAUDE.md`.

### Cuatro cosas medidas que gobiernan el mapeo, y que impiden pegar la paleta tal cual

1. **Su paso `-500` es relleno o icono, NO texto.** `success-500` (`#12b76a`) da ≈2.4:1 sobre blanco;
   el nuestro (`#047857`) da 5.49. El texto vive en sus pasos **600-700** — y la prueba de que ya
   estábamos ahí es que **su `error-700` es `#b42318`, exactamente nuestro `--color-danger`**, y su
   `warning-700` (`#b54708`) está a un punto de nuestro `#b45309`.
2. **Sus tintes `-200/-300` como borde miden 1.21–1.49:1** en nuestras composiciones. Es literalmente
   lo que Deasy sustituyó por `color-mix(… 71 %, white)`. **Adoptar su markup tal cual reintroduce
   bordes que no pasan WCAG 1.4.11**, así que los porcentajes de Deasy ganan: 71 / 6 / 10.
3. **Su `--color-black` es `#101828`, no negro.** Y `black` es un nombre de Tailwind: redefinirlo
   cambia cada `bg-black`/`text-black`. En cambio **su `--color-white` sí conviene adoptarlo**: hoy
   Deasy lo referencia **108 veces sin declararlo**, colgando del tema por defecto de Tailwind y de
   que alguien siga usando `bg-white`.
4. **Su `z-index` no tiene semántica** (`z-1/9/99/999/…`), y nuestro problema no era la escala sino
   que la relación crítica `1070 < 1075` vivía **sólo en un comentario en prosa**. Se toma su
   escalera de magnitudes con alias `--z-drawer/-modal/-tip/-toast` encima.

**Se omiten `--font-*: initial` y `--breakpoint-*: initial`** (destructivas), y **la tipografía sigue
siendo Inter** desde `index.html`: de TailAdmin se toma la *escala*, no la familia.

### Lo que se sincronizó primero, y por qué iba primero

La documentación estaba en la trampa que esta misma bitácora describe: **F3 y F4.5 cerradas el 08-12
y marcadas como abiertas** en el README del directorio, que además publicaba «~208 sitios mecánicos
delegables» de trabajo **ya hecho**. Quien lo retomara habría empezado por rehacerlo, y el trabajo
mecánico **no da señal de estar repetido**: la huella vuelve a dar 0 y todo parece correcto.

Corregido en cinco sitios: el README del directorio, el bloque de premisa del plan, el §Frente 4 del
maestro (congelado en el 08-11: `--brand-*` muertos, «16 colores» cuando son 22, la colisión `dark:`
marcada «⛔ viva» cuando está cerrada, y «15 ficheros» cuando son 18), la `description` de la skill
—que es lo que decide si se carga sola— y `mapeo-deasy.md`, que decía «nueve» y listaba siete, y
replicaba contadores pre-`eb9ba1e` (74 y ~2 260 en vez de 47 y ~2 112).

**Y una cifra remedida:** `shared/styles/` son **2 900 líneas**, no 2 749. Estaba replicada en dos
sitios y las dos decían lo mismo y las dos estaban desfasadas.

### Licencia — el markup no se copia de donde sea

| Fuente | Licencia | Uso |
|---|---|---|
| Repo **HTML free** | **MIT** © 2023 TailAdmin | **La única fuente de markup literal.** Requiere atribución |
| Repo **Vue free** | **sin LICENSE** (`license: null`) | Sólo referencia |
| **Demo PRO** (87 rutas) | comercial | Inspiración; **no se copia markup** |

### F3 + F4 · la paleta entra, y la medida es la que elige cada anclaje

**Se fusionaron las dos fases**, y no por ahorrar: elegir a qué primitiva se ancla un token
**exige** medir el contraste antes de escribirlo. Auditar después habría sido auditar una decisión
ya tomada.

`node scripts/contraste.mjs` (nuevo) hace las dos cosas: `--tabla` da, para cada token, su contraste
de hoy y el escalón de su familia que no lo empeora; con `token=primitiva` verifica un anclaje
concreto. **La familia la elige una persona y el escalón lo elige la medida** — la primera versión
del script buscaba «la primitiva con mejor contraste» sin restringir el tono y proponía
`primary -> success-700`, o sea la marca en verde.

**El resultado, medido token a token:**

| | |
|---|---|
| **Única regresión deliberada** | `primary` 5.24 → **4.84**. Sigue pasando AA. Es el cambio de identidad: `#5e4eff` → `#465fff` |
| Regresión de ruido | `success` 5.48 → 5.41 (−0.07) |
| **Mejoras** | `muted` **6.36 → 7.69**, `warning` 5.02 → 5.43, `step-ink` 4.78 → 5.41, `pending` 5.42 → 5.52, `line-field` 1.35 → 1.47 |
| Idéntico | **`danger`: su `error-700` ES `#b42318`**, nuestro valor de siempre |

Los tres bordes siguen por debajo de 3:1 como antes. El script distingue «ROMPE EL MINIMO» de
«ya fallaba antes» a propósito: sin esa distinción gritaba por deuda que nadie había tocado y
dejaba de servir para lo que se hizo.

**Y una pérdida de escalón que hay que registrar:** `--color-ink` y `--color-strong` caen los DOS en
`gray-800`. La escala de texto de Deasy tenía **cinco** escalones (17.7 / 14.7 / 11.9 / 9.9 / 6.4) y
la de TailAdmin sostiene cuatro. Ahora son el mismo valor, así que **uno de los dos sobra**.

### Lo que casi se queda desincronizado en silencio

Al mover el primario, **`--primary-rgb` seguía siendo `94, 78, 255`** —el violeta viejo—, y con él
el anillo de foco y dos degradados. `--surface-rgb` y `--success-rgb`, igual. Un triplete es una
**copia a mano** del token: al mover el token, la copia no se entera, y no hay puerta que lo vea.

Los siete consumidores pasan a `color-mix(in srgb, var(--token) N%, transparent)`, que da
**exactamente** el mismo color y **lee del token**. Retirados los tres tripletes. Los que quedan
(`--white-rgb`, `--step-rgb`, `--navy-menu-rgb`, `--elev-ink-rgb`) no tienen token gemelo del que
copiar, así que no pueden desincronizarse.

Los dos degradados llevaban además `#5e4eff` **escrito a mano**: se habrían quedado violetas contra
una app azul. **Prueba de cierre: `grep "5e4eff" dist/assets/*.css` → 0.**

### Tres cosas verificadas del mecanismo, para no re-analizarlas

1. **El alias con `var()` NO necesita `@theme inline`.** El miedo era que el *tree-shaking* se
   llevara la primitiva y dejara el alias sin valor. No pasa: Tailwind sigue la referencia. Medido
   en `dist` — las 13 primitivas referenciadas están, las 60 que nadie usa no, y cuestan 0 bytes.
2. **Referenciar una primitiva desde el `:root` sin capa también la emite.**
3. **Pisar la escala `gray-*` de Tailwind es seguro**: había **cero** usos de `gray-*` en el árbol.

### Qué se dejó fuera de su `@theme`, y por qué

`--font-*: initial` y `--breakpoint-*: initial` (**destructivas**: borran `font-sans`, `font-mono` y
todos los breakpoints) · `--font-outfit` (la tipografía es Inter; se toma su escala, no su familia)
· `--color-black: #101828` (su «negro» no es negro y `black` es nombre de Tailwind) ·
`--color-gray-dark` y los dos `theme-*-500` (sin rol aquí: un registro sin consumidor es basura).

### F6 · `slate-*` al token semántico — 827 sustituciones, y por qué el destino NO era `gray-*`

**El destino de una primitiva no es otra primitiva.** Mandar `text-slate-700` a `text-gray-700` es
lateral: deja el mismo problema con otro nombre. `text-slate-700` quiere decir «texto de cuerpo», y
eso se escribe **`text-body`**. Por eso el mapa va a la capa semántica y solo cae a `gray-*` donde no
hay token que lo diga (los pasos por debajo del suelo de texto).

**Medido antes de tocar nada** con `contraste.mjs --escala`, que hubo que enseñar a convertir OKLCH
→ sRGB: **Tailwind v4 sirve su paleta en OKLCH y no vuelve a los hex de v3**, así que comparar
contra `#64748b` daba respuestas falsas. Paso a paso, `slate` → `gray` es neutro (Δ entre −0.08 y
+0.21). El movimiento real es otro:

| | |
|---|---|
| `text-slate-500` → `text-muted` | **290 nodos, 4.76 → 7.69.** El cambio más visible de la fase, y el que la norma exige: 4.76 está **por debajo** del suelo de 6.36 que fija §3 |
| `text-slate-700` → `text-body` | 204 nodos, 10.36 → 10.46 |
| `text-slate-800` → `text-strong` | 135 nodos, 14.62 → 14.70 |

**Total: 2 117 → 1 334 colores de Tailwind por nombre.**

### Los 87 que quedan NO son pereza: están bloqueados, y el fichero ya lo decía

`border-slate-200` (54) y `bg-slate-50` (33) son los que `overrides.css` **repinta**. Una utilidad
repintada no lleva solo color: lleva **prioridad**. La regla vive fuera de capa y la de
`border-slate-200` además con `!important`, así que en una plantilla no significa «slate-200», sino
**«ese gris Y ganando a lo que haga falta»**. Su propio comentario dice cuáles son: los que caen
sobre `input/select/textarea`, sobre `header` y sobre el botón de cerrar de los diálogos. **Se
desbloquean al resolver las 53 reglas fuera de capa, no antes.** Ya se intentó una vez y dos nodos
cayeron a blanco.

### Y las familias de estado tampoco son un renombrado

`emerald`, `rose`, `amber`, `red` (584 usos) aparecen SIEMPRE en el mismo trío: `bg-X-50` +
`border-X-200` + `text-X-600/700`. Mandarlas a `success-50/200/700` sería lateral **y conservaría el
fallo**: los tintes `-200` como borde miden 1.21–1.49:1, que es justo por lo que Deasy los sustituyó
por la receta 71/6. Ese trío repetido **es el componente que falta** —la alerta, el tag, el empty
state—, así que se resuelve extrayéndolo, no renombrando colores. Va con F5.

### Un test que protegía la implementación en vez de la regla

`homeView.helpers.test.js` afirmaba `toContain('slate')`. La migración lo rompió con el
comportamiento **intacto**. Reescrito para afirmar lo que su propio nombre dice —que el turno manda
sobre el estado y que cada estado se distingue del resto—, que sobrevive a repintar la aplicación.
De paso ganó un caso: el estado desconocido cae en el neutro. 309 → 310.

### Los azules: `sky`/`blue` → informativo, `indigo`/`violet` → marca

**Decisión del usuario**, porque era de diseño y no de análisis: Deasy no tenía token de «info», y
con la marca ya en azul `indigo` y el primario casi se tocan. Se reparten por lo que cada uno
**quería decir**, no por lo que se parecen. 510 sustituciones.

**Y al nombrarlo salió un fallo:** `sky-600` —41 usos de texto— **renderiza a 4.02:1 y no cumple
AA**. No se veía porque nadie lo había medido: el hex de v3 que todo el mundo recuerda no es lo que
Tailwind v4 pinta. `--color-info: var(--color-blue-light-700)` lo deja en **5.86**.

**109 utilidades `focus:` quedaron intactas a propósito.** Son las muertas —59 de ellas
`focus:border-indigo-400`—: la regla sin capa de `overrides.css` sobre `input/select/textarea` les
gana a todas, así que no pintan. No se migran, **se borran** al decidir cómo se ve el foco. Migrarlas
habría sido trabajo tirado sobre código muerto.

### Recuento: 2 117 → 824, y lo que queda tiene dueño

| | | |
|---:|---|---|
| **584** | `rose`, `emerald`, `amber`, `red`, `green`, `orange` | Siempre el mismo trío `bg-X-50 + border-X-200 + text-X-700`. **Es el componente que falta** → F5 |
| **109** | `focus:` de `indigo`/`sky`/`blue` | Muertas. Se borran al encender el foco → F7 |
| **87** | `border-slate-200`, `bg-slate-50` | Repintadas: llevan **prioridad**, no solo color → F7 |
| 44 | cola larga | |

### Un segundo test acoplado a la paleta

`getSignatureStepCardClass` afirmaba `toContain('emerald')` y `toContain('sky')`. Mismo patrón que el
anterior y misma cura: ahora comprueba que **delega en el código de estado** y que **el turno manda**,
que es lo que la función promete. 310 → 311.

> **La lección, que ya va por dos:** un test que afirma sobre el valor no protege la regla, protege
> la implementación — y estorba exactamente cuando hace falta cambiarla. Los dos rompieron con el
> comportamiento **intacto**.

### F7 · el foco se enciende y se unifica, y caen dos defectos documentados

**El foco eran DOS problemas a la vez**, y confundirlos es lo que lo dejó abierto tanto tiempo:

- **80 `focus:border-*` que no pintaban nada.** La regla `input, select, textarea` de
  `overrides.css` está fuera de capa y les ganaba a todas: el borde del campo enfocado no cambiaba
  nunca. Estaban escritas, se leían bien y eran mentira. Borrarlas es **cambio visual cero**.
- **31 `focus:ring-*` de color que SÍ pintaban.** La utilidad de Tailwind vive en
  `@layer utilities` y le gana al `--focus-ring` que pone el componente desde `@layer components`.
  El anillo era azul cielo en unos campos, azul rey en otros y de marca en el resto — las «seis
  variantes de foco» que §5.3 lleva tiempo denunciando. Borrarlas **sí** cambia el aspecto, y ese
  es el arreglo.

Las 111 salen de las plantillas y el foco se declara **una vez**: borde `--color-brand-300` (la
receta de TailAdmin para el campo enfocado) + `--focus-ring`. **Cero utilidades de foco en
plantillas.** Y con eso muere el número mágico de al lado: `.admin-select-field` tenía
`border-radius: 10px` **solo para diferenciarse** del 0.5rem de la regla de elemento; los 20
selectores de administración pasan a los 8 px del sistema.

### El `<header>`: la regla no le servía ni a quien la quería

Un selector de ELEMENTO pintando `--color-navy-deep` sobre los **nueve** `<header>` del proyecto, y
fuera de capa, así que ganaba a cualquier utilidad. Cinco no declaran fondo propio
—`AppFormModalLayout` (**todos** los modales de formulario del perfil), `HomeView` ×3 y las
cabeceras de panel de los dos grafos— y recibían texto casi negro sobre fondo casi negro: **≈1,1:1**.

Lo que la hacía gratuita, y no estaba medido hasta hoy: **el único `<header>` que sí quiere ese
aspecto —el del armazón, `SHeader.vue:2`— ya lo declara por utilidad** (`bg-navy-deep border-b
border-white/10`), con los mismos valores. La regla no le aportaba nada y rompía a los otros cinco.
**Borrada**, sin sustituto.

### `.deasy-fa-icon`: no había FontAwesome

`FontAwesomeIcon.vue` conserva el nombre pero **renderiza iconos de Tabler**, que ya son
`currentColor` por defecto. Así que `color: currentColor; opacity: 1` fuera de capa no deshacía nada
de ninguna librería: solo **tapaba cualquier `text-*` puesto sobre el icono**, y por eso dos
triángulos de aviso salían del color de su párrafo en vez de ámbar. Fuera la regla y fuera la clase.

**Reglas fuera de capa: 52 → 49.**

### Mueren cuatro de los cinco repintados de utilidad

Era su final declarado en su propia cabecera: «deuda con fecha de caducidad, no arquitectura».

**La escala de elevación pasa a ser una utilidad de verdad.** Las plantillas escribían `shadow-sm`
(119) y `shadow-xl` (11) **contando con que `overrides.css` les cambiara el valor** por `--elev-1` /
`--elev-2` — un repintado fuera de capa cuyo único trabajo era convertir una utilidad de Tailwind en
otra cosa. Registrando `--shadow-elev-1/2/3` en `@theme`, la plantilla pide **lo que quiere**
(`shadow-elev-1`) y el rodeo sobra. Verificado en `dist`: emite `0 1px 2px #0f172a0a`, que es
exactamente `--elev-1`. **Cambio cero.**

`bg-slate-50` (32) → `bg-surface`, y `border-slate-200` (54) → `border-line`.

**Y la condición que bloqueaba `border-slate-200` estaba mal leída.** Su comentario decía que moría
«cuando `dialogs.css` baje a `@layer components`, no antes». Esa condición era para su `!important`
—lo que peleaba contra `.deasy-dialog-root .deasy-dialog-header button`—, **no para la regla**: ese
botón no escribe `border-slate-200` en su plantilla. Sin consumidores, la regla entera sobra.

**Lo que sí cambia, y es el efecto buscado:** 37 de los 54 caían sobre CONTROLES, donde el
`!important` les imponía `--color-line` por encima del color que declara su propio componente. Ahora
manda el componente: los campos pasan a `--color-line-strong` / `--color-line-field`, que además
suben de **1.24:1 a 1.47:1**. El borde del control lo decide el control.

**Queda uno: `.bg-white`.** Ese sí está atado a `dialogs.css`: no repinta ningún color (blanco sobre
blanco), existe **solo para robar prioridad**, y lo que le gana o le pierde son las 10 reglas sin
capa de los diálogos. Muere con ellas.

| | antes | ahora |
|---|---:|---:|
| Reglas fuera de capa | 52 | **46** |
| `!important` | 5 | **3** |
| Repintados de utilidad | 5 | **1** |

### Los encabezados bajan a `@layer base`, y con ellos se desbloquea el título del diálogo

Las dos reglas de `h1..h6` llevaban fuera de capa con este motivo escrito: «bajarla resucita **109
utilidades en 77 de los 95 encabezados**», porque un `font-weight` sin capa gana a
`@layer utilities` y un `font-semibold` sobre un `<h3>` renderizaba a **500**.

**Eso no era una razón para dejarlas: era la descripción del defecto.** La norma no admite que una
declaración se quede «presente pero suprimida». Se enciende: un encabezado que pide `font-semibold`
es que quiere semibold, y estas reglas son el **suelo** tipográfico, no la última palabra.

Y era además la condición que bloqueaba otra cosa: `.deasy-dialog-title` no podía bajar porque,
capada, perdía contra el `h1..h6` suelto y **121 títulos caían de 21.6 px a 19.2 px**. Con los
encabezados en `@layer base` deja de haber conflicto — `base` va **antes** que `components` en el
orden de capas, así que el título gana **sin depender de la especificidad**. Esa es la diferencia
entre resolver el conflicto y esquivarlo.

**Reglas fuera de capa: 46 → 44.**

### Una excepción documentada que me llevé por delante

`FirmarPdf.vue:790` conservaba su `border-slate-200` **sin migrar a propósito** —única excepción de
F4.4-d, con su comentario al lado— porque migrado «la utilidad pierde el `!important` del repintado
y la regla suelta pasa a ganar: el borde iría de `--color-line` a `--color-line-field`».

La migración masiva se lo llevó, y **la predicción del comentario se cumplió exactamente**: esos 5
nodos (el botón de cerrar de «Validar documento») pasan a `--color-line-field`. Va en la dirección
buena —1.24:1 → 1.47:1— pero **no fue una decisión, fue un descuido**: el aviso estaba escrito y no
lo leí antes de pasar el script. Queda anotado como lo que enseña: **antes de un reemplazo en masa,
buscar los comentarios que documentan excepciones**, no solo los usos.

### Lo que NO se ha tocado, y por qué

Las **10 reglas de `dialogs.css`** siguen fuera de capa. Bajarlas es el último paso que desbloquea
`.bg-white`, pero cada una suprime algo medido —49 bordes, 44 sombras y 5 radios que llegan por
`content-class`; 116 velos; el `:hover` que la huella **no ve**— y el propio plan avisa de que «una
diferencia de un nodo no es casi cero». **Eso pide huella de `getComputedStyle` antes y después, en
navegador.** Hacerlo a ciegas sería exactamente el error que este repo ya ha pagado seis veces.

### `dialogs.css` baja a capa — medido en el DOM, **0 nodos de diferencia**

La regla que lo hacía posible ya estaba escrita en el propio fichero: **las diez bajan a la vez, y
así su orden relativo se conserva**, de modo que no cambia cómo compiten entre sí. Lo único que
cambia es su relación con las utilidades que llegan por prop (`body-class`, `content-class`,
`footer-class`), que pasan a ganar.

**Verificado con huella de `getComputedStyle` sobre el DOM real** —no sobre el CSS— en el modal de
«Agregar» de `/admin/usuarios/personas/persons`, la pantalla de control:

| | nodos con diferencia |
|---|---|
| Bajar las 10 a `@layer components` | **1 de 14** |
| Tras resolver ese 1 | **0 de 14** |

**Y ese único nodo era exactamente el que el comentario predecía**: el velo. `AppModalShell` y
`AppDialogOverlay` escribían `bg-navy/45 backdrop-blur-[2px]` **a mano**, duplicando
`--overlay-backdrop`; suelto el token ganaba, capado ganaba la plantilla (0.48→0.45 de alfa,
3px→2px de desenfoque). Eran **116 velos diciendo lo mismo tres veces**. Gana el token: las dos
plantillas se quedan sin su copia.

Es la diferencia entre medir y suponer: el aviso de que «una diferencia de un nodo no es casi cero»
se cumplió al pie de la letra —había exactamente uno, y era real—, y era además el que estaba
documentado desde el principio como «elegir cuál vale es F5».

**Reglas fuera de capa: 44 → 34.**

### Muere el bloque (A) entero: se va `.bg-white`, el último repintado

Era el más raro de los cinco: **no repintaba ningún color** —blanco sobre blanco, exactamente igual
que la utilidad de Tailwind—. Existía **solo para robar prioridad**, y lo que le daba sentido eran
las 10 reglas sin capa de `dialogs.css`. Capadas ésas, `bg-white` vive en `@layer utilities`, que ya
gana a `@layer components` por el orden de capas. **La muleta sobraba.**

Medido dos veces, porque un modal de 14 nodos no prueba nada sobre 246 usos:

- Huella del modal, contra la línea base: **0 diferencias de 14**.
- Barrido de **los 50 `.bg-white` de la pantalla de control**: `0` con el fondo perdido.

**El bloque (A) de `overrides.css` ya no existe.** Nació declarándose «deuda con fecha de caducidad,
no arquitectura», y esa fecha era hoy.

### Balance de F7

| | antes | ahora |
|---|---:|---:|
| Reglas fuera de capa | **52** | **33** |
| `!important` | 5 | **3** |
| Repintados de utilidad | 5 | **0** |
| Utilidades de foco en plantillas | 111 | **0** |

Lo que queda fuera de capa es de otra naturaleza: los `.hope-action-*` (16 entre `buttons.css` y
`overrides.css`, que pelean contra `.deasy-table-responsive .deasy-btn` y no contra una utilidad),
los tres de Vue Flow —tercero **sin capa**, así que se quedan—, los controles de formulario, y el
`:root` de `tokens.css`, que no es una regla de estilo.

### F5 arranca: `AppAlert`, y el patrón para los cinco que faltan

El trío `bg-X-50 + border-X-200 + text-X-700` estaba copiado a mano **15 veces en 12 ficheros**, con
derivas entre copias (`rounded-2xl` en unas, `mb-3` en otras, `font-medium` según el día). Migradas
**14** al componente; la 15.ª vive en `AppFormModalLayout` con otra estructura y va aparte.

**Y confirma por qué renombrar el color no valía.** Mandar esos `red-200`/`red-50` a
`error-200`/`error-50` habría alineado la paleta **conservando el fallo**: el tinte `-200` como
borde mide 1.21–1.49:1 y no cumple WCAG 1.4.11. `AppAlert` no elige tinte: **deriva del token** con
la receta de §2.4 —borde al 71 %, que es donde llega a 3:1; relleno al 6 %, que es el que deja pasar
AA al texto—, y cada variante declara **un** token en `--tone` que gasta una regla común.

**Lo que gana el usuario, y que no se veía en el CSS:** las 15 copias **no tenían `role`**. El
mensaje de error aparecía y un lector de pantalla no lo anunciaba. El componente lo trae, y hay un
test que lo fija.

**Tres cosas del instrumental, para los cinco componentes que faltan:**

1. **El entorno por defecto de vitest aquí es `node`.** Montar un componente pide
   `// @vitest-environment jsdom` en la cabecera del test, o falla con `document is not defined`.
2. **`vue/prefer-separate-static-class` está en `error`**: la parte estática va en `class` y solo la
   variable en `:class`. El lint lo caza al primer intento.
3. **El test NO afirma de qué color acaba siendo.** `getComputedStyle` en jsdom no resuelve
   `color-mix()` ni las capas, y —más importante— un test acoplado al valor protege la
   implementación en vez de la regla. Eso ya rompió dos suites este mismo día con el comportamiento
   intacto. Se comprueba el contrato; el color se verifica en el navegador.

**Quedan cinco:** `AppTextInput` (el más valioso: unifica las 4 variantes divergentes del mismo
campo), `AppFieldLabel` (58 repeticiones), `AppEyebrow` (~45), `AppEmptyState` (12) y `AppCard` (8).

### `.deasy-control`: las cuatro variantes del mismo campo, colapsadas

Era el hallazgo canónico de la auditoría. Cuatro recetas del mismo control conviviendo:
`AdminInputField` (`rounded-2xl` + `border-line-strong` + `text-body`), `AdminSelectField`
(`rounded-[10px]` + `border-line-field` + `text-strong` + `font-medium`), `AdminLookupField` sobre
una **clase fantasma** que ningún CSS declaraba, y 15 copias sueltas en `AdminDraftArtifactModal`.
**Las diferencias no eran decisiones: eran deriva.**

Y colapsarlas resultó casi gratis por un motivo que conviene retener: **el radio y el color de borde
sobre un control no pintaban nada**. La regla de elemento sigue fuera de capa y les gana, así que los
cuatro radios distintos ya renderizaban 8 px. Lo único que de verdad variaba era el color del texto.

**Medido en el DOM, sobre los 29 controles del modal de «Agregar»:** de cuatro recetas divergentes a
**3 formas** que solo difieren en el tono del borde (`--color-line` para el campo desnudo,
`--color-line-field` para el que lleva clase) y una en el color de texto. Mismo radio, misma altura,
misma tipografía, mismo padding.

### Y la medida cazó una regresión que el CSS no enseñaba

Al colapsar las cadenas se cayó el `border` **a secas** —el ANCHO, no el color— y los 29 controles
se quedaron con `border-top-width: 0px`: **sin borde**. El reset de Tailwind pone `border-width: 0`
en todo y la regla de elemento solo declara el `border-color`, así que nada lo repuso.

No lo vio el CSS, ni el lint, ni los 316 tests. Lo cazó comparar la forma de los 29 en el DOM. Es la
séptima vez que este repo demuestra lo mismo: **para un cambio de estilo, la verificación es el
navegador.** Y el matiz que lo hace fácil de repetir: `border-*` (color) y `border` (ancho) parecen
lo mismo al leer una cadena de clases, y no lo son.

### `.deasy-form-label`: la clase existía y se estaba ignorando

52 etiquetas escritas a mano en **cuatro formas casi iguales** que diferían en margen, peso y color
sin que ninguna diferencia fuera una decisión. Y `.deasy-form-label` llevaba declarada desde
siempre. Es exactamente el caso que §6.1 ya describía —«el mismo string se repetía 21 veces cuando
`.deasy-form-label` ya existía con exactamente ese `@apply`, byte por byte»—, sin resolver.

**Y aquí NO tocaba componente Vue.** Una etiqueta no tiene estado ni markup propio: solo texto. El
nivel correcto de la regla de decisión es la **clase**, y añadir un `AppFieldLabel` habría sido
ceremonia. El componente se gana el sueldo cuando hay markup y estados que unificar —`AppAlert` lo
tiene, y por eso trajo el `role="alert"` que faltaba en 15 sitios—; una etiqueta, no.

Una sola variante nueva, `--inline`, para las 23 que llevan icono al lado.
Verificado en el DOM: 40 etiquetas, una forma, ninguna invisible.
**Strings de clase de +120 caracteres: 203 → 174.**

### Nota de método: los commits de esta tanda

Se pidió un commit por fase y las cinco primeras ya estaban entrelazadas: `tokens.css` y
`overrides.css` los tocan F2, F3, F6 y F7 **en las mismas líneas**, así que partirlas a posteriori
habría producido commits que no pasan su propia verificación — peor que uno honesto. Van en dos:
la documentación por su lado (es separable de verdad) y el código con las cinco fases enumeradas.
De F5 en adelante, uno por fase.

### `.deasy-eyebrow`: 69 kickers, y media F6.1 contestada de paso

Había **75 kickers escritos a mano en DIEZ formas**, y entre ellas **cuatro tamaños de fuente
distintos** —`text-[0.6rem]` (9.6px), `text-[11px]`, `text-[0.7rem]` (11.2px) y `text-xs`—, cuatro
valores de `tracking`, dos pesos y dos colores. Nadie distingue 9.6 de 11 de 11.2 px: eran **tres
formas de escribir el mismo escalón**.

Eso contesta media F6.1 en la práctica sin necesidad de una sesión de diseño: la escala por debajo
de 14 px tiene **dos** escalones y éste es el de abajo, `text-theme-xs` (12/18), que es el de la
paleta adoptada.

**Migrados 69.** Valores arbitrarios: 423 → **376**; `text-[…]`: 189 → **146**.

⚠️ **No están todos.** Quedan ~6 formas de cola larga (`tracking-[0.16em]`, `text-[10px]`…): medido
en `/procesos`, 3 nodos en versalitas siguen con tres formas distintas. Se anota en vez de darlo por
cerrado — es exactamente el tipo de «casi» que luego se lee como hecho.

### `.deasy-empty`: cuatro formas que decían exactamente lo mismo

14 estados vacíos escritos a mano en **cuatro formas que no se ponían de acuerdo en nada**: radio
`xl` o `2xl`, borde de 1 px o de 2 px, fondo transparente o `surface` o `surface/50`, padding de 4 a
8, y el texto en `muted` o en `icon`. **Ninguna de esas diferencias significaba nada distinto** — los
cuatro dicen «aquí no hay nada todavía».

Lo único que no se toca es el **borde discontinuo**, que es lo que comunica «vacío».

### Lo que queda de F5, y por qué no se cierra hoy

**540 colores de estado.** Y no son un patrón: son alertas y paneles con **paddings y radios todos
distintos** (`p-4`, `p-5`, `p-6`, `rounded-xl`, `rounded-2xl`, pesos `medium`/`semibold`/`bold`).
`.deasy-alert` ya cubre la forma canónica y absorbió 14; el resto pide mirar **caso por caso** si es
una alerta, un panel o un chip, y eso no es sustitución mecánica. Forzarlo con un script sería
inventar equivalencias que no están medidas.

`AppCard` (8 repeticiones) queda igualmente pendiente.

### Los colores de estado, clasificados POR ROL — 183 atributos en 6 grupos

Contarlos por utilidad (540) no servía para decidir nada: cada atributo lleva tres. Clasificados por
**la forma que tienen**, que es lo que dice qué son, salen seis grupos con tratamientos distintos:

| # | Grupo | Atributos | Qué hacer |
|---|---|---:|---|
| 1 | **CHIP / badge** (píldora inline) | 14 | `AppTag` ya existe con 9 variantes. Es sustitución |
| 2 | **BLOQUE de estado** (fondo+borde+texto) | 50 | **Es `AppAlert`.** El grupo más grande y el más claro |
| 3 | **SUPERFICIE tintada** (fondo+borde, texto aparte) | 24 | Falta la clase. Misma receta 71/6, sin el texto |
| 4 | **TEXTO suelto** (solo color de letra) | 69 | Sustitución directa al token semántico |
| 5 | **BORDE suelto** | 6 | Cola larga, caso a caso |
| 6 | **RELLENO suelto** | 20 | Hay que mirar si es sólido (icono encima) o tinte |

**Los grupos 1, 2 y 4 son 133 de los 183 y tienen destino conocido.** Los grupos 3 y 6 piden una
decisión pequeña cada uno; el 5 es cola larga.

Lo que este corte deja claro y el recuento por color escondía: **no son 540 problemas, son seis** —y
dos de ellos ya tienen su componente escrito.
