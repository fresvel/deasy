# CLAUDE.md — Frontend

Reglas del sistema de diseño. **Cada una viene de un fallo real medido en este repo**, con su
número al lado. No son preferencias: son las cosas que costaron una sesión entera de arreglar.

El contexto general del proyecto está en el `CLAUDE.md` de la raíz. Aquí va solo lo que afecta a
cómo se escribe la interfaz.

---

## 1. Dónde vive cada cosa

`src/shared/styles/` son **15 módulos por familia**. `main.js` importa **sólo `index.css`**, que
los encadena.

| Módulo | Qué va aquí |
|---|---|
| `tokens.css` | La paleta y el `@theme` que la registra en Tailwind. **El único sitio con literales de color** |
| `base.css` | Reset, tipografía, `html`/`body`/`#app` |
| `layout.css` · `nav.css` · `surfaces.css` | Armazón, navegación, tarjetas |
| `buttons.css` · `forms.css` · `tables.css` · `dialogs.css` · `tags.css` · `auth.css` · `admin.css` | Uno por familia de componente |
| `misc.css` | Lo que aún no tiene familia. **Si creces esto, es que falta un módulo** |
| `overrides.css` | Repintado de utilidades de Tailwind a la marca. **Va el último a propósito** |

⚠️ **El orden de los `@import` de `index.css` es parte del diseño, no es alfabético.** En CSS dos
reglas de igual especificidad se resuelven por orden de aparición. Está explicado dentro del
fichero. Si mueves un import, verifícalo en el navegador.

---

## 2. Color: las cinco reglas

### 2.1 Cero colores a mano. Sin excepciones fuera de `tokens.css`

Hoy hay **0 hex y 0 `rgb()/rgba()` numéricos** en todo el CSS fuera de la paleta. Se llegó ahí
desde 74 hex y 100 `rgba`. **Si tu cambio los sube, has metido un color suelto.**

```css
/*  MAL  */  color: #5e4eff;   background: rgba(94, 78, 255, 0.12);
/* BIEN */  color: var(--brand-primary);
            background: rgba(var(--brand-primary-rgb), 0.12);
```

### 2.2 Un color por concepto, y el resto se DERIVA

No declares un token para cada matiz. Declara **uno por significado** y saca los demás con
`color-mix()`. Los botones de acción son el ejemplo a copiar:

```css
fondo   reposo 10%   hover 16%   sobre var(--brand-white)
borde   reposo 71%   hover 85%   sobre var(--brand-white)
texto   reposo el token          hover 85% sobre var(--brand-black)
```

Los cinco violetas del proyecto resultaron ser `--brand-primary` al 86 %, 38 %, 33 %, 25 % y 10 %:
**no eran colores, eran porcentajes**. Antes de declarar un token nuevo, comprueba si es una mezcla
de uno que ya existe.

### 2.3 Antes de crear un token, busca a qué familia pertenece

Reutilizar gana a declarar. Medido: de 41 colores «sin token», **40 pertenecían a algo que ya
existía**; sólo uno se ganó nombre propio. Y de los 11 que parecían irreductibles, **9 tenían
familia** — el verde del login era el verde de éxito, el borde del panel era `--brand-border`.

Un token nuevo se justifica cuando el color **significa algo que ningún otro significa**, no cuando
es un poco distinto.

> **Y al revés: no colapses un significado.** El tag salmón parecía un rojo suelto y es el estado
> **«pendiente»**, distinto de «rechazado». Meterlo en rojo no habría reducido la gama: habría
> perdido una distinción que el usuario necesita. Lo que sobraba era que estuviera escrito **dos
> veces**, no el color.

### 2.4 Si el mismo valor aparece con varias opacidades, casi seguro es UNA sola

Los bordes de diálogo tenían **siete opacidades** del mismo gris. Compuestas sobre blanco, cinco
de ellas estaban a **ΔE ≤ 2**: nadie distingue 0.24 de 0.26. Las sombras, lo mismo: 0.03, 0.04 y
0.06 a ΔE ≤ 1.3.

**Antes de añadir una opacidad nueva, mira si ya existe una a menos de ΔE 2 y usa esa.**

### 2.5 No hay modo oscuro, y `dark:` está prohibido

**Deasy es una app en claro.** Sus zonas oscuras —la barra lateral— son una decisión de diseño
resuelta con color explícito (`text-white/55`, `border-white/8`), no un tema. Hoy hay **0 usos** de
`dark:` y así se queda.

Importa porque **las recetas de TailAdmin traen 1 024 clases `dark:`**, y sin protección Tailwind v4
las compila a `@media (prefers-color-scheme: dark)`: se activarían **solas** en la máquina de quien
tenga el sistema en oscuro, pintando ese componente en oscuro sobre el resto de la app en claro. No
lo ve el build, ni el lint, ni los tests, ni tú si tu sistema está en claro.

Hay **tres capas**, y cada una tapa lo que la anterior no ve:

| | Qué cubre |
|---|---|
| `@custom-variant dark` en `tokens.css` | El seguro: deja `dark:` inerte aunque entre |
| `vue/no-restricted-class` | El atributo `class` de las plantillas |
| `pnpm run check:no-dark` | Lo que ninguna ve: `dark:` dentro de `@apply`, dentro de `<style scoped>` y en `.js` |

**Al adaptar una receta de TailAdmin, los `dark:` se quitan.** No se dejan «por si acaso»: apuntan a
la paleta de TailAdmin (`gray-900`, `gray-800`…), no a la de Deasy, así que el día que hubiera modo
oscuro habría que revisarlos todos igual.

### 2.6 Ojo con los espacios de nombres de Tailwind v4

Un token llamado como un namespace de Tailwind **secuestra sus utilidades en toda la app**, en
silencio. `--radius-lg` hizo durante meses que `rounded-lg` valiera 16 px en vez de 8, dejando la
escala invertida (`rounded-lg` acabó siendo mayor que `rounded-xl`).

Nombres prohibidos salvo que sepas exactamente lo que haces: `--color-*`, `--radius-*`, `--font-*`,
`--spacing-*`, `--shadow-*`, `--text-*`, `--breakpoint-*`, `--leading-*`, `--tracking-*`.

---

## 3. Accesibilidad: los mínimos son mínimos

Todo lo de esta sección se **midió**, no se estimó. Los fallos que se corrigieron eran reales y
llevaban meses.

| Qué | Mínimo | Regla |
|---|---|---|
| Texto normal | **4.5:1** | Incluye el **placeholder** — WCAG lo trata como texto |
| Texto grande (≥18.66 px negrita o ≥24 px) | 3:1 | |
| **Límite de un componente** (borde de botón, campo, checkbox) | **3:1** | WCAG 1.4.11 |
| Icono que transmite información | 3:1 | |

**Tres cosas que no son obvias:**

1. **Un ΔE bajo no garantiza que el contraste aguante.** Medido en este repo: correlación
   ΔE ↔ Δcontraste = **−0.206**. Una sustitución con ΔE 5.2 rompió AA (4.55 → 4.19) y otra con
   ΔE 16.3 lo **mejoró** en +4.95. El criterio correcto es uno solo:
   **`contraste_después ≥ contraste_antes`**, o al menos ≥ umbral con margen.
2. **El borde es lo que dibuja el botón.** En los botones de acción el relleno está al 10 % y da
   1.1:1 contra la fila — invisible. Todo el trabajo lo hace el borde de 1 px. Los seis estaban
   entre 1.64 y 1.90, o sea que **172 botones no tenían límite perceptible**.
3. **Al derivar un color, el porcentaje importa más que la idea.** Derivar el borde al 35 % lo
   dejaba **más claro** que el valor que había. Al 71 % los seis pasan 3:1. Misma técnica, resultado
   opuesto.

**El suelo de la escala de grises de texto es `--brand-text-muted` (6.36:1).** Nada más claro que
eso para texto sobre blanco.

---

## 4. Verificación: lo que ninguna herramienta ve

**Ni el build, ni el lint, ni los 304 tests detectan que rompiste un estilo.** Está demostrado
**cuatro veces** en una sola sesión:

| Lo que se rompió | Qué dijeron build / lint / tests |
|---|---|
| Dos clases de la barra lateral se quedaron sin color | verde |
| La tipografía Inter **dejó de cargarse entera** | verde |
| 114 nodos perdieron el borde por una autorreferencia de token | verde |
| 43 botones perdieron su fondo por un hex partido a la mitad | verde |

**Para cualquier cambio de CSS la verificación es el navegador.** Y si el cambio es amplio, una
**huella de estilos computados**: recorrer el DOM guardando `getComputedStyle` (color, fondo,
bordes, sombra, tipografía, espaciado) y `getBoundingClientRect` de cada nodo, antes y después, y
comparar nodo a nodo. Un refactor que promete «cambio visual cero» **tiene que dar 0 diferencias**;
si da alguna, o el análisis estaba mal o rompiste algo.

**No hay que reinventarla: está en `scripts/css-huella.mjs`.**

```bash
node scripts/css-huella.mjs --captura              # el fragmento, para pegar en la consola
node scripts/css-huella.mjs antes.json despues.json   # 0 si no hay diferencias, 1 si las hay
```

Los dos guardas que esa huella necesita **ya los aplica el script**, y los dos se aprendieron por las
malas:

- **Espera a `await document.fonts.ready` antes de medir.** Si no, mides con la fuente de reserva y
  los anchos mienten sin que ningún estilo computado cambie.
- **Comprueba el número de nodos de la captura base.** Una salió con 4 nodos porque la página
  seguía cargando, y esa base no valía para nada. El script se planta si ve menos de 50.

Y dos límites suyos que conviene tener presentes: **no ve los pseudo-elementos** (`::-webkit-scrollbar`,
`::placeholder`, `::before`), y **empareja por ruta en el DOM**, así que si el contenido cambia de
orden entre capturas comparas nodos distintos y salen diferencias falsas.

### Los linters no bastan, y conviene saber qué NO ven

`pnpm run lint:css` está en **0 errores**. Pero `color-no-hex` **no ve** los hex dentro de `@apply`
(`text-[#8a93a8]`) ni los `rgb()/rgba()` numéricos. **Verde no significa sin deuda**: llegó a haber
10 hex y 100 `rgba` vivos con el contador a cero.

Y `stylelint` sólo mira `src/**/*.css`. **El CSS dentro de un `<style scoped>` de un `.vue` no lo
mira nadie.**

---

## 5. Recomendaciones de UX/UI

### 5.1 Un estado se distingue por más de una señal

Los botones de acción llevan color en el **fondo, el borde y el icono**. No dependas sólo del
relleno: al 10 % es prácticamente invisible. Y no dependas sólo del color — un cambio de estado
debería notarse también en forma, peso o posición.

### 5.2 El hover tiene que intensificar, siempre en la misma dirección

Antes de arreglarlo, los siete hover de los botones de acción iban cada uno a su aire: tres
oscurecían, **dos aclaraban** y dos cambiaban de matiz. Y el de «eliminar» estaba a **ΔE 1.08** de
su propio estado normal — **no se veía al pasar el ratón**.

Regla: el hover es el mismo color, más presente. Nunca otro color, nunca más claro.

### 5.3 El foco es uno solo

El anillo de foco es la señal de «aquí está el teclado». Había **seis** variantes (tres tamaños y
tres colores). Usa `var(--focus-ring)` y punto.

### 5.4 La elevación es una escala de tres, no un valor por componente

`--brand-shadow` (tarjetas) → `--shadow-raised` → `--shadow-modal`. Si necesitas una sombra que no
está, casi seguro es que el componente pertenece a un nivel que ya existe.

Y el velo del modal (`--overlay-backdrop`) **no es una sombra**: es un fondo. Estaba contado como
sombra y por eso parecía que había once.

### 5.5 Densidad: cuidado con las tablas

La tabla de administración pinta **172 botones a la vez**. Todo lo que sea sutil ahí desaparece, y
todo lo que sea pesado satura. Es el peor caso del sistema: si un componente se ve bien ahí, se ve
bien en todas partes. **Pruébalo ahí.**

---

## 6. Calidad de código

### 6.1 Las utilidades repetidas se convierten en clase

Si el mismo puñado de utilidades aparece **tres veces**, dale nombre en su módulo con `@apply`.

Hay **221 strings de clase de más de 120 caracteres** en los `.vue`. El caso extremo: el mismo
string se repetía **21 veces** cuando `.deasy-form-label` ya existía en el CSS con exactamente ese
`@apply`, byte por byte. El sistema estaba ahí y se ignoraba.

### 6.2 Nada de estilos en línea

`vue/no-static-inline-styles` está en **error**. Un `style="..."` estático es una clase disfrazada.
`:style` con valor calculado sí es legítimo (posiciones de firma sobre el PDF, anchos de barra).

### 6.3 `<style scoped>` no hace lo que crees

Vue añade el `data-v-*` al **último** elemento del selector. Si ese elemento vive en un componente
hijo, **el selector no casa jamás**.

Así murió `AdminTableManager.css`: 604 líneas cargadas con `<style scoped src>` sin un solo
`:deep()`, de las que **0 de 86 reglas aplicaban**. Su columna de acciones declaraba
`position: sticky` y el DOM devolvía `static` — se diseñó y nunca funcionó.

**Y `:deep()` no te salva si el ancla también es de otro componente.** `:deep(X)` mueve el `data-v`
al selector de la **izquierda**, así que `.ancla :deep(.hijo)` compila a `.ancla[data-v-TUYO] .hijo`:
sigue exigiendo que **`.ancla`** lleve tu scope. Y un componente padre solo estampa su `data-v` en la
**raíz** del hijo, nunca en un nieto.

Así murieron las 84 líneas de `HomeView.vue`: nueve reglas `:deep()` colgando de
`.deliverable-inline-upload`, que está anidada dentro de `DeliverableCard.vue`. Medido en el
navegador: **con** el atributo el campo mide 62 px en fila; **sin** él —como se renderiza de verdad—
mide 28 px en columna. Nunca aplicó ni una.

**Si estilas un hijo desde el padre, necesitas `:deep()`. Y si lo necesitas mucho, el estilo no va
ahí: va en el módulo del hijo** — que además es el único sitio donde alguien lo va a encontrar.

> Para comprobarlo en 10 segundos: clona el nodo en la consola con y sin el `data-v-*` que aparece
> en el selector compilado, y compara `getComputedStyle`. Si los dos dan lo mismo, la regla sobra.

### 6.4 Al sacar un `<style scoped>` a un módulo, pierdes una ventaja que no habías pedido

Un `<style scoped>` **no está en ninguna capa**. Un módulo de `shared/styles/` está en
`@layer components`. Y en CSS **la precedencia de capa gana a la especificidad**: una regla sin capa
gana SIEMPRE a una capada, por muy específica que sea la segunda. Así que al mover el estilo cambian
dos cosas a la vez, y la segunda no la ves venir.

Mover cuatro nodos de Vue Flow a `graph.css` lo enseñó por partida doble:

- **Hacia abajo**: los conectores volvieron a los valores de la librería (gris `#555`, 6 px) porque
  `@vue-flow/core` trae su hoja **sin capa**. Cualificar el selector a `.vue-flow__handle.graph-node__handle`
  **no arregló nada** — no era cuestión de especificidad. La solución es sacar esas reglas del bloque
  `@layer`, como hace `overrides.css`.
- **Hacia arriba**: `.cfg-node { background:#fff }` estaba tapando tres `bg-*` de Tailwind que el
  componente declaraba por estado. Nunca se vieron. Al pasar a una capa, las utilidades ganaron y el
  tinte **resucitó** — un cambio visual que nadie pidió, en un refactor.

**Antes de mover un `<style scoped>`, pregúntate contra qué estaba ganando.** Si pisa a un tercero,
la regla va fuera de la capa; si pisa a una utilidad de Tailwind, decide a conciencia cuál de las dos
sobra y **borra la otra**, en vez de dejar las dos peleando.

### 6.5 Una clase construida en runtime es invisible para cualquier grep

```js
`deasy-tag--${props.variant}`                          // AppTag.vue
(tone, prefix = 'deasy-nav-item__icon') => `${prefix}--${tone}`   // workspaceNavIcons.js
```

La segunda es la mala: el literal va como **valor por defecto de un parámetro**, así que ni siquiera
queda pegado al `${`. Una limpieza automática se llevó dos de esas clases y **el build, el lint y
los 304 tests pasaron en verde** con la barra lateral sin color.

**Antes de borrar CSS por no encontrarlo con `grep`, comprueba si se compone en runtime.**

### 6.6 Al reemplazar colores en masa, dos trampas ya pagadas

1. **Un hex corto es prefijo de uno largo.** `#fff` está dentro de `#fff0ed`; sin límite por la
   derecha la sustitución parte el valor y deja `var(--brand-white)0ed`. Ordenar el mapa por
   longitud **no basta**.
2. **Nunca toques una línea que DECLARA el token.** Sale `--brand-border: var(--brand-border)`, una
   autorreferencia que en CSS deja la variable **sin valor** — y todo lo que la usaba cae a
   `currentColor`. Fueron 114 nodos, y sólo en desarrollo, porque la declaración culpable estaba en
   un bloque condicionado.

`scripts/css-hex-a-token.mjs` lleva las dos guardas y **aborta antes de escribir**.

### 6.7 La tipografía se carga desde `index.html`

No desde el CSS. Un `@import` remoto anidado dentro de un módulo **lo descarta Vite en silencio** y
la app entera se queda con la fuente de reserva. Además, un `@import` remoto encadena la petición
detrás del parseo del CSS; desde el HTML el navegador la pide en paralelo.

### 6.8 Componentes: tres ficheros piden ser partidos

`AdminTableManager.vue` (4 223 L), `FirmarPdf.vue` (2 944 L) y `MultiSignerPanel.vue` (1 394 L)
concentran la mayor parte de la utility soup. No añadas más a ellos: extrae.

---

## 7. Comandos

```bash
bash scripts/stack.sh b exec -T frontend pnpm run lint       # eslint .
bash scripts/stack.sh b exec -T frontend pnpm run lint:css   # stylelint — debe dar 0 errores
bash scripts/stack.sh b exec -T frontend pnpm run check:no-dark  # sin `dark:` — ver 2.5
bash scripts/stack.sh b exec -T frontend pnpm run test:unit  # vitest
bash scripts/stack.sh b exec -T frontend pnpm run build
```

Sustituye `b` por tu pila (`docker-env.sh dev` = pila A). **Nunca levantes `dev` desde un worktree**:
no crea una pila nueva, repunta la de siempre a tu código. Está explicado en el `CLAUDE.md` raíz.

---

## 8. Deuda conocida, para no redescubrirla

**No queda ni un `<style scoped>` en el frontend.** Los 13 que había se vaciaron entre el
2026-08-11 y el 2026-08-12, y el saldo dice bastante sobre qué era realmente esa deuda:

| | |
|---|---:|
| `<style scoped>` al empezar | 13 |
| **`<style scoped>` hoy** | **0** |
| Líneas movidas a módulos | ~330 |
| **Líneas que estaban MUERTAS** (0 usos, o el selector no casaba nunca) | **~180** |

Más de la mitad no había que mover: había que borrarla. Los sitios donde estaba y por qué, en 6.3
y 6.4. **Antes de mover un bloque, comprueba que aplica** — el clon con y sin `data-v-*` cuesta diez
segundos y en esta ronda descartó cinco bloques enteros.

Lo que queda de deuda de color, ya sin CSS escondido:

| Qué | Cuánto | Dónde |
|---|---:|---|
| Color a mano en plantilla o script `.vue` | 68 | *Arbitrary values* y mapas de tono |
| Color a mano en `.js` | 21 | `useDeliverableView.js`, `homeView.helpers.js`, `AdminPresentationService.js` |
| **Total fuera del CSS** | **89** | era 195 |
| Strings de clase >120 caracteres | 221 | `HomeView.vue`, `FirmarPdf.vue` |
| *Arbitrary values* (`text-[11px]`…) | 443 | 8 tamaños distintos por debajo de `text-sm` |
| `!important` con motivo escrito | 6 | `dialogs.css`, `overrides.css` |

> **Y hay deuda que los linters tampoco ven en los módulos**: `forms.css` pinta el dropzone con
> `sky-200`, `sky-500` y `sky-700` **dentro de `@apply`**, donde `color-no-hex` no entra. El azul
> cielo del dropzone es hoy el único color de familia propia que sigue fuera de la paleta.

El plan, la bitácora y la auditoría están en **`docs/planes/sistema-diseno-plantillas/`**. La
primera vuelta —la que ganó el frente del CSS— está cerrada y archivada en
`docs/docs-md-antiguos/planes-cerrados-2026-08/sistema-diseno/`; su bitácora sigue valiendo, porque
es donde están las trampas ya pagadas.
