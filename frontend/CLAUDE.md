# CLAUDE.md — Frontend

Reglas del sistema de diseño. **Cada una viene de un fallo real medido en este repo.** No son
preferencias: son las cosas que costaron una sesión entera de arreglar.

El contexto general del proyecto está en el `CLAUDE.md` de la raíz. Aquí va solo lo que afecta a
cómo se escribe la interfaz.

---

## 1. Dónde vive cada cosa

`src/shared/styles/` son **18 módulos por familia**, 2 900 líneas. `main.js` importa **sólo
`index.css`**, que los encadena.

| Módulo | Qué va aquí |
|---|---|
| `tokens.css` | La paleta. **El único sitio con literales de color** |
| `base.css` | Reset, tipografía, `html`/`body`/`#app` |
| `layout.css` · `nav.css` · `surfaces.css` | Armazón, navegación, tarjetas |
| `buttons.css` · `forms.css` · `tables.css` · `dialogs.css` · `tags.css` · `auth.css` · `admin.css` · `graph.css` · `deliverables.css` · `signatures.css` | Uno por familia de componente |
| `misc.css` | Lo que aún no tiene familia. **Si crece, es que falta un módulo** |
| `overrides.css` | Repintado de utilidades de Tailwind. **Va el último a propósito** |

⚠️ **El orden de los `@import` de `index.css` es parte del diseño, no es alfabético.** En CSS dos
reglas de igual especificidad se resuelven por orden de aparición. Está explicado dentro del
fichero. Si mueves un import, verifícalo en el navegador.

---

## 2. Color

### 2.1 Cero colores a mano. Sin excepciones fuera de `tokens.css`

Hoy hay **0 hex y 0 `rgb()/rgba()` numéricos** en todo el CSS fuera de la paleta. Se llegó ahí desde
74 hex y 100 `rgba`. **Si tu cambio los sube, has metido un color suelto.**

```css
/*  MAL  */  color: #465fff;   background: rgba(70, 95, 255, 0.12);
/* BIEN */  color: var(--color-primary);
            background: color-mix(in srgb, var(--color-primary) 12%, transparent);
```

⚠️ **Para el alfa, `color-mix()` — NO un triplete `-rgb`.** Da exactamente el mismo color y **lee
del token**. Un triplete es una copia a mano: al mover el token, la copia no se entera. Pasó el
2026-08-13 con los tres que existían —`--primary-rgb` seguía siendo el violeta viejo cuando
`--color-primary` ya era azul— y **no hay puerta que lo vea**. Los cuatro que quedan
(`--white-rgb`, `--step-rgb`, `--navy-menu-rgb`, `--elev-ink-rgb`) no tienen token gemelo del que
copiar, así que no pueden desincronizarse.

⚠️ Pero **verde no significa sin deuda**: `color-no-hex` **no ve** los hex dentro de `@apply`
(`text-[#8a93a8]`) ni los `rgb()/rgba()` numéricos. Llegó a haber 10 hex y 100 `rgba` vivos con el
contador a cero. Y `stylelint` sólo mira `src/**/*.css`.

### 2.2 DOS CAPAS: primitivas y semánticos. Sólo se escribe la segunda

Desde el 2026-08-13 `tokens.css` tiene dos bloques dentro del mismo `@theme`, y **la diferencia
entre ellos es la regla más importante de todo este fichero**:

```css
@theme {
  --color-gray-200: #e4e7ec;                 /* CAPA 1 · primitiva — un valor en bruto */
  --color-line:     var(--color-gray-200);   /* CAPA 2 · semántico — lo que SÍ se escribe */
}
```

**`border-gray-200` dice de qué color es. `border-line` dice qué es.** El día que el borde del
sistema cambie, la capa 2 es **una línea** en vez de 354 sustituciones. Por eso:

| | |
|---|---|
| **Capa 1 · primitivas** | La paleta de TailAdmin (91 colores, MIT — ver `frontend/NOTICE`). **No se escriben en una plantilla**, salvo en el markup adoptado de ellos, que viene en sus nombres |
| **Capa 2 · semánticos** | Los 22 nombres de Deasy. **Es lo que se escribe.** Cada uno es un alias sobre una primitiva, o su propio hex si no hay equivalente |

**Tres cosas verificadas al instalarlo, que evitan repetir el análisis:**

1. **El alias con `var()` funciona sin `@theme inline`.** Se temía que el *tree-shaking* de
   `@theme` se llevara la primitiva y dejara el alias sin valor —el desastre de los 114 nodos con
   el borde en `currentColor`—. **No pasa: Tailwind sigue la referencia y emite la primitiva.**
   Medido en `dist`: las 13 primitivas referenciadas están; las que nadie usa, no. Cuestan 0 bytes.
2. **Referenciar una primitiva desde el `:root` de abajo también la emite** (`--color-blue-light-500`
   entra por los degradados).
3. **La escala `gray-*` de TailAdmin pisa la de Tailwind**, y es seguro: había **cero** usos de
   `gray-*` en el árbol. Es el destino de los `slate-*` que quedan.

⚠️ **El paso `-500` NO es texto.** En su sistema el 500 es relleno o icono: `success-500` da 2.4:1
sobre blanco. El texto vive en **600-700**. La prueba de que Deasy ya estaba ahí: su `error-700`
es `#b42318`, **exactamente** nuestro `--color-danger` de siempre.

⚠️ **Un token semántico no se ancla a ojo: se mide.** `node scripts/contraste.mjs --tabla` da, para
cada token, su contraste de hoy y el escalón de su familia que no lo empeora. La familia la elige
una persona —el tono es diseño—; el escalón lo elige la medida.

### 2.2.1 Cómo se llama un token, y por qué el nombre es corto

Un color se declara **una sola vez**, en el `@theme` de `tokens.css`:

```css
@theme { --color-primary: var(--color-brand-500); }   /* da bg-primary, text-primary, border-primary… */
```

**`--color-` no es parte del nombre: es el NAMESPACE de Tailwind**, y significa «esto es un color,
genérame sus clases». Lo que va detrás es literalmente el nombre de la utilidad. Por eso no hay
`--color-brand-primary`: el `brand-` sobraba, y eran seis caracteres en 963 sitios.

Tres nombres **no** son el recorte obvio, y el motivo importa:

| | | porque |
|---|---|---|
| el borde del sistema | `--color-line` | `--color-border` daría `border-border` |
| el texto secundario | `--color-muted` | daría `text-text-muted` |
| el paso actual | `--color-step-ink` | **`current` es de Tailwind** (`currentColor`) |

Lo que **no** es un color suelto —sombras, el velo, los degradados, los tripletes `-rgb`— va en el
`:root` de abajo, sin prefijo y sin registrar.

### 2.3 Un token nuevo se justifica, no se añade por simetría

**Dos condiciones, y hacen falta las dos.**

**(a) Que Tailwind no traiga ya ese color.** Se mide el ΔE contra su paleta; con ΔE ≤ 2 son el mismo
color a ojo y el token propio no se sostiene. Así se retiró `--brand-white`: el blanco de la marca
**es** el blanco, y eran 271 usos de un nombre más largo para `#ffffff`.

> ⚠️ Y se mide **contra lo que renderiza, no contra el hex de v3**. Ver 2.8.

**(b) Que el concepto pueda cambiar de color.** Si el concepto **es** el color, usa el de Tailwind.
`--color-line` se queda porque «el borde del sistema» cambiará algún día, y entonces es una línea en
vez de 354. El blanco no va a dejar de ser blanco.

**Y antes de declararlo, busca a qué familia pertenece.** Medido: de 41 colores «sin token», **40
pertenecían a algo que ya existía**. De los 11 que parecían irreductibles, **9 tenían familia** — el
verde del login era el verde de éxito, el borde del panel era `--color-line`.

> **Al revés también: no colapses un significado.** El tag salmón parecía un rojo suelto y es
> **«pendiente»**, distinto de «rechazado». Meterlo en rojo no habría reducido la gama: habría
> perdido una distinción que el usuario necesita. Lo que sobraba era que estuviera escrito **dos
> veces**, no el color.

**Y un registro sin consumidor no es una API: es basura.** Aquí hubo siete `--color-chart-*` y un
`--color-state-info` que nadie llamó nunca, sostenidos por la idea de que «cuestan cero bytes y son
un destino al que migrar». No lo eran — nadie migró.

### 2.4 Deriva en vez de declarar

No declares un token por matiz. Declara **uno por significado** y saca los demás con `color-mix()`.
La receta, con **dos rellenos según lo que lleve encima**:

```css
borde    reposo 71%   hover 85%   sobre var(--color-white)
texto    reposo el token          hover 85% sobre var(--black)
relleno  reposo  6%   hover 16%   sobre var(--color-white)   <- si encima va TEXTO
relleno  reposo 10%   hover 16%   sobre var(--color-white)   <- si encima va un ICONO
```

⚠️ **El 6 % no es un capricho, y el 10 % de los botones de acción no es general.** Encima del
relleno de un botón de acción hay un **icono** (mínimo 3:1); encima del de un tag o un botón suave
hay **texto** (mínimo 4.5). El relleno no tiene mínimo propio, pero **se lo come al texto que lleva
encima**: medido, `--color-warning` sobre su propio relleno al 10 % da **4.39 y no pasa AA**; al 6 %
da 4.64 y las seis familias pasan. En el *hover* sí vale el 16 %, porque ahí la receta oscurece
además el texto y el contraste **sube** en las seis.

**El 71 % del borde tampoco es arbitrario**: es el porcentaje al que llega a 3:1 sobre blanco, que
es lo que pide WCAG 1.4.11 para el límite de un componente. Los tintes `-200` de Tailwind que había
antes estaban entre **1.21 y 1.49:1**.

**Y la receta se escribe UNA vez.** Cada variante declara sólo su token en `--tone` y una regla común
lo gasta — el mecanismo de `--tooltip-bg` de `buttons.css`. Antes eran cinco copias de la misma idea.

Los cinco violetas del proyecto resultaron ser `--color-primary` al 86 %, 38 %, 33 %, 25 % y 10 %:
**no eran colores, eran porcentajes**.

**Y si el mismo valor aparece con varias opacidades, casi seguro es UNA sola.** Los bordes de diálogo
tenían **siete** opacidades del mismo gris; compuestas sobre blanco, cinco estaban a **ΔE ≤ 2**.
Antes de añadir una opacidad nueva, mira si ya existe una a menos de ΔE 2.

### 2.5 No hay modo oscuro, y `dark:` está prohibido

**Deasy es una app en claro.** Sus zonas oscuras —la barra lateral— son una decisión de diseño
resuelta con color explícito (`text-white/55`, `border-white/8`), no un tema. Hoy hay **0 usos** de
`dark:` y así se queda.

Importa porque Tailwind v4 compila `dark:` a `@media (prefers-color-scheme: dark)`: cualquier `dark:`
que entre se activaría **solo** en la máquina de quien tenga el sistema en oscuro, pintando ese
componente en oscuro sobre el resto de la app en claro. No lo ve el build, ni el lint, ni los tests,
ni tú si tu sistema está en claro.

Hay **tres capas**, y cada una tapa lo que la anterior no ve:

| | Qué cubre |
|---|---|
| `@custom-variant dark` en `tokens.css` | El seguro: deja `dark:` inerte aunque entre |
| `vue/no-restricted-class` | El atributo `class` de las plantillas |
| `pnpm run check:no-dark` | Lo que ninguna ve: dentro de `@apply`, dentro de `<style scoped>` y en `.js` |

### 2.6 Ojo con los espacios de nombres de Tailwind v4

Un token llamado como un namespace de Tailwind **secuestra sus utilidades en toda la app**, en
silencio. `--radius-lg` hizo durante meses que `rounded-lg` valiera 16 px en vez de 8, dejando la
escala invertida (`rounded-lg` acabó siendo mayor que `rounded-xl`).

Nombres prohibidos salvo que sepas exactamente lo que haces: `--color-*`, `--radius-*`, `--font-*`,
`--spacing-*`, `--shadow-*`, `--text-*`, `--breakpoint-*`, `--leading-*`, `--tracking-*`.

**Y ya ha pasado tres veces más**, con las dos mitades del mismo mecanismo:

- `--shadow-raised/-modal/-drawer` ocupaban `--shadow-*` **sin estar en `@theme`**: ni generaban
  `shadow-raised` ni evitaban la colisión. Hoy son `--elev-*`.
- `--font-weight-medium/semibold` vivían en un `:root` **sin capa** y **pisaban los de Tailwind**:
  cambiarlos a 550 habría repintado cada `font-medium` de la app. Retirados.
- `--font-base`, `--font-size-base` y `--line-height-*` ocupaban `--font-*` sin ser de Tailwind. Hoy
  son `--typeface` y `--type-*`. Era la bomba esperando a que alguien declarase el token que chocara.

**Tampoco valen los nombres que Tailwind ya usa**, aunque no sean namespaces: `current`, `white`,
`black`, `transparent`, `inherit` y los 22 nombres de su paleta.

### 2.7 Un token con alfa se escribe `rgba(var(--x-rgb), 0.5)`, nunca `rgb(var(--x)/0.5)`

El triplete va separado por comas, y **la sintaxis heredada por comas no admite la barra del alfa**.
Lo malo es cómo falla: Tailwind emite la regla tal cual —un `grep` sobre el CSS construido la
encuentra— y **el navegador la descarta**. El color cae a `currentColor` sin un aviso en ningún sitio.

Lo mismo dentro de un `shadow-[…]`: `shadow-[0_6px_16px_rgb(var(--x)/0.04)]` deja el elemento en
`box-shadow: none`. **Una sombra con token va en `box-shadow:` a pelo.**

⚠️ Los gemelos `-rgb` **no siguen ningún criterio**: se crearon a demanda. `--color-danger` y
`--color-line` no tienen, aunque se usen mucho. Comprueba antes de escribir uno.

> Comprobación que sí vale: aplica el valor con `style=` en la consola y lee el computado. Si
> devuelve el color heredado, el valor no vale. **Mirar el CSS servido NO sirve** — la regla está ahí.

### 2.8 Antes de fiarte de `@theme`, míralo en el CSS construido

Tailwind v4 hace *tree-shaking* de `@theme`: **un registro que nadie usa no se emite**, y eso es
indistinguible de no haberlo escrito.

```bash
grep -o -- '--color-warning:' frontend/dist/assets/*.css   # la unica prueba
```

Esto vale también para **la paleta de Tailwind**: `--color-slate-600` no está en el CSS construido si
nadie usa `slate-600`. Referenciarla desde `:root` sí la hace emitir — probado — pero no lo des por
hecho sin mirarlo.

Y al revés: **una clase inyectada en runtime no prueba un valor arbitrario**, porque Tailwind genera
esas utilidades escaneando el *fuente*. Para probar un `X-[…]`, mira el CSS construido; para probar
una clase de módulo, inyectarla va bien.

### 2.9 El hex de un token no se compara con el hex de Tailwind, sino con lo que RENDERIZA

Desde v4 Tailwind sirve su paleta en **OKLCH**, y esos valores no vuelven a los hex de v3 que todo el
mundo tiene en la cabeza. Medido aquí con `tailwindcss@4.2`, y confirmado pintando en un canvas:

| Se creía | Renderiza de verdad | ΔE real |
|---|---|---:|
| `emerald-700` = `#047857` = `--color-success` | `rgb(0,122,85)` | **1.28** |
| `amber-700` = `#b45309` = `--color-warning` | `rgb(187,77,0)` | **2.29** |
| `slate-600` = `#475569` = `--color-icon` | `rgb(69,85,108)` | **1.17** |

Son diferencias imperceptibles, pero **«ΔE 0.00» era falso** y con él se prometió «cambio visual cero
por construcción» en una migración de 200 nodos.

⚠️ Y **87 de los 288 colores de Tailwind v4 caen fuera de la gama sRGB**. En una pantalla sRGB el
navegador los recorta (coincide con el cálculo), pero en una P3 se ven más saturados. Nuestros hex se
ven igual en las dos.

### 2.10 Una utilidad repintada lleva PRIORIDAD, no sólo color

`overrides.css` repinta `.border-slate-200` a `--color-line` **con `!important`**. Así que
`border-slate-200` en una plantilla no significa «slate-200»: significa **«ese gris, y ganando a lo
que haga falta»**.

Migrarlo al token da **el mismo color y menos prioridad**, y dos nodos cayeron a blanco la vez que se
intentó. Antes de sustituir una utilidad repintada, mira **contra qué estaba ganando**.

> Y al hacerlo por script: **`shared/styles/*.css` se excluye o se revisa a mano.** Ahí
> `.bg-slate-50` no es un uso, es el **selector** del repintado — y el escape del `/` en
> `.bg-slate-50\/70` burla cualquier límite por la derecha. El script lo reescribió y rompió el
> repintado en silencio.

### 2.11 Dónde va cada regla: la decisión de capas

```
@layer components   todo skin de componente
@layer utilities    los repintados de utilidad, MIENTRAS existan
sin capa            SÓLO lo que pelea con una hoja de tercero sin capa
```

Los únicos terceros sin capa son **`@vue-flow/core`** (el bloque suelto de `graph.css`) y **`leaflet`**
(el mapa de `RegisterView`). Quedan **52 reglas fuera de capa** —`overrides.css` 22, `dialogs.css` 10,
`buttons.css` 8, `base.css` 4— y cada una lleva escrito qué tapa.

Con esta disposición vuelve el contrato de Tailwind —**una utilidad gana a un componente**— y los
repintados de `overrides.css` dejan de hacer falta.

**Y `overrides.css` hace dos cosas: no las mezcles en la misma lista de selectores.** Repintar una
utilidad y dar skin a un componente son cosas distintas; juntarlas es lo que producía los
`!important`, que no peleaban contra Tailwind sino **contra otra regla del propio fichero**.

### 2.12 Antes de mover una regla de capa, TRES comprobaciones

Fuera de capa una regla gana **siempre**, da igual la especificidad. Dentro de la capa vuelve a
competir con todo lo que ya vive allí. Las tres cosas que hay que mirar, y las tres han fallado ya:

**1. Las utilidades de Tailwind que conviven en el DOM — incluidas las que llegan por PROPS.** Un
`grep` de plantillas no ve esto:

```vue
<!-- AppModalShell.vue -->      <div class="deasy-dialog-body" :class="bodyClass">
<!-- FirmarPdf.vue:786 -->      <AppModalShell body-class="p-0 bg-slate-50 relative" />
```

El skin lo pone el componente y la utilidad llega de fuera: sólo se encuentran en runtime. Mira
`body-class`, `header-class`, `panel-class` y cualquier prop que acabe en `class`.

**2. Si en la CAPA DE DESTINO hay una regla más específica** que pise la misma propiedad. Esto no lo
vio ningún análisis estático: lo encontró la huella, con **239 nodos rotos**.

```
buttons.css    .deasy-table-responsive .deasy-btn   (0,2,0)   <- @layer components, desde antes
overrides.css  .hope-action-btn                     (0,1,0)   <- lo que ibas a bajar
```

El `grep` útil **no es por el selector entero**: lo que te gana es un **descendiente**, así que busca
` .deasy-btn`, ` .admin-btn`, con el espacio delante.

**3. Si compite con una hoja de tercero sin capa** (`@vue-flow/core`, `leaflet`). Entonces no baja.

Y la regla de oro: **una diferencia de un nodo no es «casi cero»**. Es la señal de que el análisis
estaba mal. Vuelve a mirar antes de aceptarla.

---

## 3. Accesibilidad: los mínimos son mínimos

Todo lo de esta sección se **midió**, no se estimó.

| Qué | Mínimo | Regla |
|---|---|---|
| Texto normal | **4.5:1** | Incluye el **placeholder** — WCAG lo trata como texto |
| Texto grande (≥18.66 px negrita o ≥24 px) | 3:1 | |
| **Límite de un componente** (borde de botón, campo, checkbox) | **3:1** | WCAG 1.4.11 |
| Icono que transmite información | 3:1 | |

**Tres cosas que no son obvias:**

1. **Un ΔE bajo no garantiza que el contraste aguante.** Medido aquí: correlación ΔE ↔ Δcontraste =
   **−0.206**. Una sustitución con ΔE 5.2 rompió AA (4.55 → 4.19) y otra con ΔE 16.3 lo **mejoró** en
   +4.95. El criterio correcto es uno solo: **`contraste_después ≥ contraste_antes`**.
2. **El borde es lo que dibuja el botón.** En los botones de acción el relleno está al 10 % y da
   1.1:1 contra la fila — invisible. Todo el trabajo lo hace el borde de 1 px, y los seis estaban
   entre 1.64 y 1.90: **172 botones sin límite perceptible**.
3. **Al derivar un color, el porcentaje importa más que la idea.** Derivar el borde al 35 % lo dejaba
   **más claro** que el valor que había. Al 71 % los seis pasan 3:1. Misma técnica, resultado opuesto.

**El suelo de la escala de grises de texto es `--color-muted` (6.36:1).** Nada más claro para texto
sobre blanco.

---

## 4. Verificación: lo que ninguna herramienta ve

**Ni el build, ni el lint, ni los 304 tests detectan que rompiste un estilo.** Está demostrado
**seis** veces:

| Lo que se rompió | build / lint / tests |
|---|---|
| Dos clases de la barra lateral se quedaron sin color | verde |
| La tipografía Inter **dejó de cargarse entera** | verde |
| 114 nodos perdieron el borde por una autorreferencia de token | verde |
| 43 botones perdieron su fondo por un hex partido a la mitad | verde |
| Los conectores de Vue Flow volvieron a los valores de la librería | verde |
| Tres tarjetas de firmas perdieron los márgenes de su icono | verde |

**Para cualquier cambio de CSS la verificación es el navegador.** Y si es amplio, la **huella de
estilos computados**, que está en `scripts/css-huella.mjs`:

```bash
node scripts/css-huella.mjs --captura                 # el fragmento, para pegar en la consola
node scripts/css-huella.mjs antes.json despues.json   # 0 si no hay diferencias, 1 si las hay
```

Los dos guardas que necesita ya los aplica el script, y los dos se aprendieron por las malas: espera
a **`await document.fonts.ready`** antes de medir (si no, los anchos mienten) y **comprueba el número
de nodos de la base** (una salió con 4 porque la página seguía cargando). Dos límites suyos: **no ve
pseudo-elementos** (`::placeholder`, `::before`) ni estados (`:hover`, `:focus`), y **empareja por
ruta en el DOM**, así que un cambio de orden da diferencias falsas.

### Tres trampas del instrumental, todas pagadas

1. **`diff` a través del proxy `rtk` puede mentir.** Devolvió «Files are identical» sobre dos ficheros
   que difieren en 70 bytes, con CSS de una sola línea muy larga. Comprueba con `cmp`, o salta el
   filtro con `rtk proxy diff`.
2. **La pila A monta `develop`, no tu worktree.** No sirve de baseline para una rama: mide el trabajo
   entero, no tu cambio. El A/B bueno es `git checkout <commit-base> -- frontend/src` **sobre tu
   propia pila**, capturar, restaurar y comparar.
3. **Cuando un cambio no puede mover un píxel, pruébalo con el CSS construido, no con la huella.**
   Construir con y sin el cambio y comparar el emitido es más barato que una sesión de navegador y
   más fuerte: si el diff son las líneas que tocaste y nada más, no hay nada que verificar a ojo.

### Cómo se ENTREGA un cambio visual — obligatorio, no cortesía

Verificar no basta: **el dueño tiene que poder ver lo mismo que tú viste, sin adivinar dónde.** Un
cambio de estilo entregado sin decir dónde mirar es un cambio sin revisar, porque el único
instrumento que ve un estilo roto es un par de ojos delante de la pantalla.

**Toda entrega de un cambio visual lleva estas cuatro cosas. Sin excepción, y aunque el cambio
parezca trivial:**

1. **La auditoría** que lo motivó, con su resultado en números — cuántos elementos hay, cuántos no
   conformaban, cuántos quedan. Un «ya está arreglado» sin cifras no se puede comprobar.
2. **La comparación antes/después, MEDIDA y no descrita.** Los valores computados que cambiaron
   (`getComputedStyle`), el diff del CSS construido, o la huella de `scripts/css-huella.mjs`.
   «Ahora se ve mejor» no es una comparación; «el subrayado pasa de 0 a 2 px en `rgb(70,95,255)`, y
   las tres barras de esa pantalla miden ya lo mismo» sí lo es.
3. **La ruta EXACTA para verlo**, con todo lo necesario para llegar:
   - **La URL MÁS PROFUNDA a la que el router llegue solo**, con protocolo y puerto de la pila
     usada. No la raíz: `https://localhost:8543/admin/gestiones/procesos/process_definition_versions`,
     **no** `https://localhost:8543` seguido de cuatro clics de menú. Casi toda pantalla de Deasy
     tiene URL propia —las pestañas de admin son segmentos de ruta, no estado interno—, así que si
     estás escribiendo «→ Gestiones → Procesos → pestaña X», **esa cadena es una URL que no
     buscaste**. Míralas en la barra de direcciones mientras verificas: es de donde salen.
   - **con qué usuario y contraseña**, porque el mismo cambio no se ve desde todas las cuentas;
   - **los clics que la URL NO puede sustituir, y solo esos**: abrir un modal, desplegar un panel,
     activar un conmutador, elegir una fila concreta. Ahí sí hacen falta y hay que darlos enteros
     —qué botón, en qué fila, con qué rótulo—, porque un modal no tiene dirección propia.
4. **Lo que NO se pudo verificar y por qué**, cuando toque. Si a una pantalla no se llegó porque la
   base no tenía datos, se dice — así el dueño sabe que un vacío es del entorno y no del cambio.

⚠️ **«Mira los campos», «revisa el admin» o «entra a /home» NO son rutas.** Son tres formas de
devolverle al dueño el trabajo de encontrar lo que acabas de tocar. Ya pasó dos veces: una revisión
se perdió porque la ruta valía para dos pantallas distintas, y otra porque la cuenta indicada no
tenía permiso para ver el cambio.

⚠️ **Y dar la raíz más una lista de clics es la MISMA falta, más disimulada.** Pasó el 2026-08-15
con el stepper: la entrega decía `https://localhost:8543` → Gestiones → Procesos → pestaña
«Configuración de procesos», cuando esa pantalla **es**
`/admin/gestiones/procesos/process_definition_versions` y se pega en la barra de una vez. Cada clic
que la URL podía ahorrar es una oportunidad de acabar en otro sitio, y quien verifica no tiene por
qué reconstruir un camino que tú ya recorriste.

**Ejemplo de lo que sí vale:**

> **Pila B, por HTTPS** (acepta el aviso del certificado). Entra como **admin**:
> `1234567890` / `Demo1234!`
>
> 1. **La columna ESTADO de la tabla** —
>    `https://localhost:8543/admin/gestiones/procesos/process_definition_versions`
>    *(la pestaña «Configuración de procesos» ES esta URL: no hay que navegar el menú)*
> 2. **El asistente, paso actual** — en esa misma página, botón **«Configurar proceso»** (arriba a
>    la derecha). Es un modal: aquí el clic sí es imprescindible.
> 3. **El asistente, paso completado** — en la fila con estado **Borrador**, el botón **«Editar»**
>    (el lápiz verde de la columna ACCION).
> 4. **El visor de registro** — `https://localhost:8543/admin/gestiones/plantillas/template_artifacts`
>    → botón **«Visualizar»** (el ojo) de cualquier fila.
>
> Fíjate en que dos de los cuatro son URL directa y los otros dos llevan un clic **porque abren un
> modal**, que es la única razón válida para pedir uno.

**Si el cambio toca varios grupos o varias pantallas, se dan las rutas de TODOS.** Enseñar uno y
callar los otros deja el resto sin revisar, que a efectos prácticos es no haberlos hecho.

---

## 5. Recomendaciones de UX/UI

### 5.1 Un estado se distingue por más de una señal

Los botones de acción llevan color en el **fondo, el borde y el icono**. No dependas sólo del relleno:
al 10 % es prácticamente invisible. Y no dependas sólo del color — un cambio de estado debería notarse
también en forma, peso o posición.

### 5.2 El hover intensifica, siempre en la misma dirección

Antes de arreglarlo, los siete hover de los botones de acción iban cada uno a su aire: tres
oscurecían, **dos aclaraban** y dos cambiaban de matiz. Y el de «eliminar» estaba a **ΔE 1.08** de su
propio estado normal — **no se veía al pasar el ratón**.

Regla: el hover es el mismo color, más presente. Nunca otro color, nunca más claro.

### 5.3 El foco es uno solo

El anillo de foco es la señal de «aquí está el teclado». Había **seis** variantes. Usa
`var(--focus-ring)` y punto.

### 5.4 La elevación es una escala de tres

`--elev-1` (tarjetas) → `--elev-2` → `--elev-3`, más `--elev-3-left` para el panel lateral (mismo
nivel, otra dirección). Si necesitas una sombra que no está, casi seguro el componente pertenece a un
nivel que ya existe.

`--focus-ring` **no** entra en la escala aunque use la misma propiedad: es un indicador de estado. Y
el velo del modal (`--overlay-backdrop`) **no es una sombra**: es un fondo. Estaba contado como
sombra y por eso parecía que había once.

### 5.5 Densidad: cuidado con las tablas

La tabla de administración pinta **172 botones a la vez**. Todo lo sutil desaparece ahí y todo lo
pesado satura. Es el peor caso del sistema: **si un componente se ve bien ahí, se ve bien en todas
partes.**

---

## 6. Calidad de código

### 6.1 Las utilidades repetidas se convierten en clase

Si el mismo puñado de utilidades aparece **tres veces**, dale nombre en su módulo con `@apply`.

Hay **205 strings de clase de más de 120 caracteres** en los `.vue`. El caso extremo: el mismo string
se repetía **21 veces** cuando `.deasy-form-label` ya existía con exactamente ese `@apply`, byte por
byte. El sistema estaba ahí y se ignoraba.

### 6.2 Nada de estilos en línea

`vue/no-static-inline-styles` está en **error**. Un `style="..."` estático es una clase disfrazada.
`:style` con valor calculado sí es legítimo (posiciones de firma sobre el PDF, anchos de barra).

### 6.3 `<style scoped>`: no queda ninguno, y no vuelvas a meter uno

Los 13 que había se vaciaron; **más de la mitad de sus líneas estaban muertas**, no había que
moverlas. Dos motivos por los que un `<style scoped>` casi nunca hace lo que crees:

- **Vue añade el `data-v-*` al ÚLTIMO elemento del selector.** Si ese elemento vive en un componente
  hijo, el selector **no casa jamás**. Así murió `AdminTableManager.css`: 604 líneas de las que **0 de
  86 reglas aplicaban**; su columna de acciones declaraba `position: sticky` y el DOM daba `static`.
- **`:deep()` no te salva si el ancla también es de otro componente.** `.ancla :deep(.hijo)` compila a
  `.ancla[data-v-TUYO] .hijo`: sigue exigiendo que `.ancla` lleve tu scope. Y un padre solo estampa su
  `data-v` en la **raíz** del hijo, nunca en un nieto.

⚠️ **Y un `<style scoped>` no está en ninguna capa**, así que gana a todo lo capado. Al sacarlo a un
módulo cambian dos cosas a la vez: mover cuatro nodos de Vue Flow hizo que los conectores volvieran a
los valores de la librería (hacia abajo) y que tres `bg-*` de Tailwind **resucitaran** tras años
tapados por un `background:#fff` (hacia arriba). Antes de mover uno, pregúntate **contra qué estaba
ganando**.

> Para comprobarlo en 10 segundos: clona el nodo en la consola con y sin el `data-v-*` del selector
> compilado, y compara `getComputedStyle`. Si dan lo mismo, la regla sobra.

### 6.4 Una clase construida en runtime es invisible para cualquier grep

```js
`deasy-tag--${props.variant}`                                    // AppTag.vue
(tone, prefix = 'deasy-nav-item__icon') => `${prefix}--${tone}`   // workspaceNavIcons.js
box.classList.add('box')                                         // FirmarPdf.vue
this.element.classList.add('show')                               // modalController.js
```

La segunda es la peor: el literal va como **valor por defecto de un parámetro**, así que ni siquiera
queda pegado al `${`. Una limpieza automática se llevó dos de esas clases y **el build, el lint y los
304 tests pasaron en verde** con la barra lateral sin color.

**Antes de borrar CSS por no encontrarlo con `grep`, comprueba si se compone en runtime.**

### 6.5 Al borrar una clase muerta, mira si es el único selector

Confundir los dos casos rompe reglas vivas:

```css
.muerta { … }                    /* único selector  -> se va la regla entera */
.viva, .muerta { … }             /* en lista        -> se va SOLO su línea   */
.viva,
.muerta { … }                    /* y la coma de la anterior, si cerraba     */
```

Y **corrige los comentarios que la nombren**: `.deasy-table-shell` aparecía en cuatro explicaciones de
por qué ciertas reglas están fuera de capa, y no estaba en una sola plantilla — los 239 nodos los
ponía su hermana `.deasy-table-responsive`, con la que compartía lista de selectores.

### 6.6 Al reemplazar en masa, dos trampas pagadas

1. **Un hex corto es prefijo de uno largo.** `#fff` está dentro de `#fff0ed`; sin límite por la
   derecha la sustitución parte el valor. Ordenar el mapa por longitud **no basta**.
2. **Nunca toques una línea que DECLARA el token.** Sale `--color-line: var(--color-line)`, una
   autorreferencia que en CSS deja la variable **sin valor** — y todo lo que la usaba cae a
   `currentColor`. Fueron 114 nodos.

Lo mismo con los nombres: **sustituye por longitud descendente**, o `--color-line` se come a
`--color-line-strong`. `scripts/css-hex-a-token.mjs` lleva las dos guardas y **aborta antes de
escribir**.

### 6.7 La tipografía se carga desde `index.html`

No desde el CSS. Un `@import` remoto anidado dentro de un módulo **lo descarta Vite en silencio** y la
app entera se queda con la fuente de reserva. Además, desde el HTML el navegador lo pide en paralelo.

### 6.8 Componentes: tres ficheros piden ser partidos

`AdminTableManager.vue` (4 223 L), `FirmarPdf.vue` (2 944 L) y `MultiSignerPanel.vue` (1 394 L)
concentran la mayor parte de la utility soup. No añadas más a ellos: extrae.

---

## 7. Comandos

```bash
bash scripts/stack.sh b exec -T frontend pnpm run lint       # eslint + no-dark + orphan-classes
bash scripts/stack.sh b exec -T frontend pnpm run lint:css   # stylelint — debe dar 0 errores
bash scripts/stack.sh b exec -T frontend pnpm run test:unit  # vitest
bash scripts/stack.sh b exec -T frontend pnpm run build

# El contraste, antes de mover un token de sitio:
bash scripts/stack.sh b exec -T frontend node scripts/contraste.mjs --tabla
bash scripts/stack.sh b exec -T frontend node scripts/contraste.mjs muted=gray-600 primary=brand-500
```

**`lint` CONSTRUYE y encadena los siete gates y stylelint desde el 2026-08-14**: `build` →
`eslint` → `check:no-dark` → `check:orphan-classes` → `check:no-arbitrary` → `check:color-theme` →
`check:css-prune` → `check:contraste` → `lint:css`. Son **7,3 s** en total. Cada uno sigue siendo
llamable por separado para depurar.

⚠️ **Construye a propósito, y no es un rodeo: `check:orphan-classes` mide contra el CSS CONSTRUIDO.**
Es el único sitio donde consta qué existe de verdad — Tailwind no tiene un catálogo fijo de
utilidades, las **emite escaneando el código fuente**. Antes el gate adivinaba por prefijo con una
lista a mano, y esa lista se queda corta sola: le faltaba `person-` y dejó pasar 6 clases muertas.
Contra el CSS emitido caen también las utilidades **mal escritas** y los restos de otro framework
(así salieron `d-inline-flex` y `align-items-center`, de Bootstrap). Hay guarda contra un `dist/`
rancio: medir contra un CSS viejo daría un verde falso.

⚠️ **Y ahí es donde hay que enganchar un gate nuevo, no en el workflow.** El job `frontend-lint` de
`cd-multienv.yml` ejecuta `pnpm run lint` y nada más, así que lo que entre en esta cadena entra en CI
solo. Hasta el 2026-08-14 `lint:css` era un script suelto que **no invocaba ningún workflow**: sus
tres reglas estaban escritas y no bloqueaban un merge, y `declaration-no-important` estaba además en
`severity: "warning"`, o sea que aunque se ejecutara no fallaba.

⚠️ **Un gate que nunca se ha visto rojo no está probado.** Los cuatro que había daban verde y tres
estaban rotos. Al escribir uno, rómpelo a propósito y comprueba que sale con 1 — así se validó
`check:contraste`, bajando `--color-muted` a `gray-400`.

> **`check:orphan-classes` es nuevo** y cubre el sentido que no vigilaba nadie: una clase **propia**
> que una plantilla escribe y **ningún CSS declara**. Eran 23 nombres en 40 sitios, restos de
> refactores donde el CSS se borró y el atributo se quedó. `css-prune.mjs` cubre el contrario
> (regla declarada sin consumidor). Ojo: **no ve las clases compuestas en runtime** —a propósito—,
> así que su salida es «revisa esto», no «borra esto».

Sustituye `b` por tu pila (`docker-env.sh dev` = pila A). **Nunca levantes `dev` desde un worktree**:
no crea una pila nueva, repunta la de siempre a tu código. Está en el `CLAUDE.md` raíz.

---

## 8. Deuda conocida, para no redescubrirla

| Qué | Cuánto | Dónde |
|---|---:|---|
| Colores a mano fuera del CSS | **47** | *Arbitrary values* y mapas de tono en `.vue` y `.js` |
| Strings de clase >120 caracteres | **203** | `HomeView.vue`, `FirmarPdf.vue` |
| *Arbitrary values* (`text-[11px]`…) | **436** | 8 tamaños distintos por debajo de `text-sm` |
| `!important` en el CSS propio | **0** | Eran 3, y los **tres** eran huérfanos (2026-08-14). Lo vigila `declaration-no-important`, ya en `error` |
| Reglas fuera de capa | **33** | Todas con su motivo escrito al lado |
| **Colores de Tailwind por nombre** | **824** | Eran 2 117. Ningún linter ve uno. Ver el desglose abajo |
| Colores de Tailwind **dentro de `@apply`** | **3** | Los `bg-slate-100`, abajo |
| Clases propias sin regla | **0** | Eran 23 en 40 sitios. Lo vigila `check:orphan-classes` |

### Lo que salió el 2026-08-13, y qué enseñó cada cosa

Todo verificado con el **diff del CSS construido**: 8 reglas nuevas, 12 bajas, y ninguna baja
inesperada. Cambio visual cero.

- **Once selectores de tono de navegación.** `--sky`, `--emerald`, `--amber`, `--indigo`,
  `--violet`, `--direct`, `--derived` en dos prefijos **compartían un solo cuerpo**: doce selectores
  para dos aspectos. Plegado sobre la clase base, el aspecto correcto pasa a ser el **por defecto**
  y con eso muere el fallo que el comentario describía sin arreglar — `workspaceNavIcons.js`
  componía `${prefix}--${tone}` sin validar, y un tono nuevo salía transparente. Ahora la función
  solo emite la clase de `slate`, el único tono real, y **tiene test**.
- **`.card`, `.h1`–`.h6`, `.deasy-tag--contrast` y `--hero`** (estas dos, idénticas byte a byte
  entre sí), sin un solo consumidor.
- **`--elev-ink` y `--surface-soft`**, tokens con cero consumidores. El primero era el único sitio
  que guardaba `#0f172a` sin gastarlo; el segundo duplicaba `--color-surface` con alfa.
- **El fondo del `body` estaba declarado CINCO veces** entre `tokens.css` y `base.css`, y el `color`
  tres, ganando el último **por orden de `@import`**. Consolidado en `base.css`, que es su módulo.
- **`graph.css` escribía `rgba(15,23,42,.12)`**, el mismo triplete que `--elev-ink-rgb`.

> 🪤 **Tailwind escaneaba también los `.mjs` de `scripts/`, y ya no.** Pasó **dos veces**: el primer
> `check-orphan-classes.mjs` citaba tres utilidades en prosa y las tres acabaron emitidas; y el
> 2026-08-14, un gate nuevo llevaba nombres de propiedad en un **array de configuración** (dos eran
> utilidades válidas y se emitieron) mientras otro citaba un escalón tipográfico **sin consumidores**,
> creándole uno falso. Al taparlo aparecieron además **dos reglas fantasma vivas en producción**,
> `.rounded-\[…\]` y `.text-\[…\]`, con el valor literal `…`, nacidas de unos puntos suspensivos.
>
> La norma «descríbela, no la escribas» **no basta: depende de acordarse, y un array no es prosa**.
> El corte es estructural y está en `tokens.css`: `@source not "../../../scripts"`. **No lo quites.**

**Dentro de los módulos no queda ni un color de familia propia fuera de la paleta, y desde el
2026-08-14 tampoco queda `slate`: son CERO.** Eran 151, luego tres (`buttons.css`, `forms.css`,
`misc.css`), y esos tres se mantenían con un motivo correcto en su momento: eran un **segundo
escalón de superficie que la paleta no declaraba**, y colapsarlos sobre `--color-surface` (ΔE 1.29)
mataría el *hover* de `.deasy-btn--soft-neutral`. La regla era «sin escalón declarado no se inventa
uno».

**Lo que cambió es que el escalón SÍ está declarado**: al adoptar TailAdmin entró `gray-100`
(`#f2f4f7`) en `@theme`. Frente a `slate-100` (`#f1f5f9`) el Δcontraste es **+0.01** — el mismo
escalón, ya con nombre propio. Migrados los tres.

⚠️ Y al comprobarlo salió lo de verdad interesante: **`slate` seguía en el CSS de producción sin que
una sola plantilla lo escribiera**. Cuatro utilidades y sus primitivas, emitidas porque **este mismo
fichero las nombra** al explicar por qué se retiraron. Tailwind escanea los `.md`. Está cortado en
`tokens.css` con `@source not "../../../**/*.md"` — la documentación no es código fuente. (Los `.css`
del propio sistema **no** generan clases: comprobado escribiendo una en un comentario y midiendo el
build. Ahí sí puedes nombrarlas.)

### La que ningún contador recoge: reglas que existen y no aplican

Es **el patrón dominante de este repo**, y por eso va aquí y no en una lista de números:

- **Ningún `border-*` de Tailwind pinta sobre un `<input>`.** La regla sin capa de `overrides.css`
  gana a todas las capadas. Son 90 declaraciones muertas, entre ellas **los 61 bordes de foco**.
  Encenderlas es decidir qué color tiene el foco: es una decisión de diseño, no un refactor.
  **Y se lleva por delante el borde y el fondo de `.deasy-field-input--error`**, medido en el DOM:
  un campo en error da `--color-line-strong` y blanco. Lo único suyo que llega es el `color`.
- **`overrides.css` anula el `rounded-2xl` de `forms.css`** con `border-radius: 0.5rem`: el `@apply`
  promete 16 px y el DOM da 8, en 228 controles.
- **`workspaceNavIcons.js` compone `` `${prefix}--${tone}` `` sin comprobar que la variante exista** —
  que es como «Mis envíos» estuvo sin color. Un tono nuevo desaparece en silencio.

El plan y la bitácora están en **`docs/planes/sistema-diseno-componentes/`**. La primera vuelta está
archivada en `docs/docs-md-antiguos/planes-cerrados-2026-08/sistema-diseno/`; su bitácora sigue
valiendo, porque es donde están las trampas ya pagadas.
