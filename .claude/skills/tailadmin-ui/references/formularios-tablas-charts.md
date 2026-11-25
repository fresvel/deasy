# TailAdmin PRO — Recetas de FORMULARIOS, TABLAS y GRÁFICOS

Extraído literalmente de `demo-pages/` (form-elements, form-layout, basic-tables, data-tables,
line/bar/pie/radar/radial-chart, maps) + `style.css` y `bundle.js` descargados de
`https://demo.tailadmin.com` (las páginas estáticas NO traen los assets; las options de los
gráficos viven en `bundle.js`, que resultó ser un build webpack **sin minificar** — fuente
original recuperable).

Artefactos de apoyo en el scratchpad:
- `style.css` (399 KB) — CSS compilado, fuente de los tokens.
- `bundle.js` (4.2 MB) — bundle webpack.
- `charts/` — 45 módulos `chart-NN.js` + `data-table.js` + `index.js`, extraídos del bundle.

---

## 0. Tokens de tema (prerequisito — sin esto las cadenas de clases no reproducen nada)

Tailwind v4 (`@theme`). Valores literales de `style.css`:

```css
/* Marca */
--color-brand-50:  #ecf3ff;   --color-brand-400: #7592ff;
--color-brand-100: #dde9ff;   --color-brand-500: #465fff;   /* ← color primario */
--color-brand-200: #c2d6ff;   --color-brand-600: #3641f5;
--color-brand-300: #9cb9ff;   --color-brand-800: #252dae;
                              --color-brand-950: #161950;

/* Gris (NO es el gris de Tailwind por defecto — es la escala gray de untitled-ui) */
--color-gray-50:  #f9fafb;    --color-gray-500: #667085;
--color-gray-100: #f2f4f7;    --color-gray-600: #475467;
--color-gray-200: #e4e7ec;    --color-gray-700: #344054;
--color-gray-300: #d0d5dd;    --color-gray-800: #1d2939;
--color-gray-400: #98a2b3;    --color-gray-900: #101828;
                              --color-gray-950: #0c111d;
--color-gray-dark: #1a2231;
--color-black: #101828;       /* ojo: "black" NO es #000 */

/* Semánticos */
--color-error-50: #fef3f2;   --color-error-300: #fda29b;  --color-error-500: #f04438;
--color-error-600: #d92d20;  --color-error-700: #b42318;  --color-error-800: #912018;
--color-success-50: #ecfdf3; --color-success-300: #6ce9a6; --color-success-500: #12b76a;
--color-success-600: #039855; --color-success-700: #027a48; --color-success-800: #05603a;
--color-warning-50: #fffaeb; --color-warning-500: #f79009; --color-warning-600: #dc6803;
--color-warning-700: #b54708;

/* Tipografía de tema */
--text-theme-xl: 20px;
--text-theme-sm: 14px;   /* line-height 20px */
--text-theme-xs: 12px;   --text-theme-xs--line-height: 18px;
```

Sombras de tema (utilidades compiladas, no variables):

| Clase | `box-shadow` literal |
|---|---|
| `shadow-theme-xs` | `0px 1px 2px 0px rgba(16, 24, 40, 0.05)` |
| `shadow-theme-sm` | `0px 1px 3px 0px rgba(16,24,40,0.1), 0px 1px 2px 0px rgba(16,24,40,0.06)` |
| `shadow-theme-md` | `0px 4px 8px -2px rgba(16,24,40,0.1), 0px 2px 4px -2px rgba(16,24,40,0.06)` |
| `shadow-theme-lg` | `0px 12px 16px -4px rgba(16,24,40,0.08), 0px 4px 6px -2px rgba(16,24,40,0.03)` |
| `focus:shadow-focus-ring` | `0px 0px 0px 4px rgba(70, 95, 255, 0.12)` (= brand-500 @ 12%) |

Fuente: **`Outfit, sans-serif`** (todos los charts la declaran explícitamente).

### ⚠️ Hallazgo: `dark:bg-dark-900` es una clase MUERTA

Aparece al inicio de **casi todas** las cadenas de input (`class="dark:bg-dark-900 shadow-theme-xs …"`),
pero en `style.css` **no existe** ni `--color-dark-900` ni la regla `.bg-dark-900`. Es residuo de
TailAdmin v1. El fondo oscuro real lo da el `dark:bg-gray-900` que viene después en la misma
cadena. **No la copies.**

---

## 1. FORMULARIOS

### 1.1 Contenedor de sección (card) — repetido idénticamente en todas las páginas

```html
<div class="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
  <div class="px-5 py-4 sm:px-6 sm:py-5">
    <h3 class="text-base font-medium text-gray-800 dark:text-white/90">Default Inputs</h3>
    <!-- opcional -->
    <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Subtítulo de la sección.</p>
  </div>
  <div class="space-y-6 border-t border-gray-100 p-5 sm:p-6 dark:border-gray-800">
    <!-- campos -->
  </div>
</div>
```

Nota el patrón: borde de la card = `gray-200`/`dark:gray-800`; separador interno = `gray-100`/`dark:gray-800`.

### 1.2 Label / ayuda / mensajes

```html
<!-- Label normal -->
<label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Input</label>

<!-- Label de un campo DISABLED (cambia el color, no hay :disabled en el label) -->
<label class="mb-1.5 block text-sm font-medium text-gray-300 dark:text-white/15">Email</label>

<!-- Mensaje de error -->
<p class="text-theme-xs text-error-500 mt-1.5">This is an error message.</p>

<!-- Mensaje de éxito -->
<p class="text-theme-xs text-success-500 mt-1.5">This is an success message.</p>
```

> Inconsistencia real de la demo: el `<p>` de error del **textarea** va **sin** `mt-1.5`
> (`class="text-theme-xs text-error-500"`), el de los inputs sí lo lleva.

### 1.3 Input de texto — la cadena base (LA receta canónica)

Esta cadena exacta se repite en form-elements, form-layout y data-tables:

```html
<input
  type="text"
  placeholder="info@gmail.com"
  class="dark:bg-dark-900 shadow-theme-xs focus:border-brand-300 focus:ring-brand-500/10 dark:focus:border-brand-800 h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:ring-3 focus:outline-hidden dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30"
/>
```

Descompuesta:

| Aspecto | Clases |
|---|---|
| Caja | `h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5` |
| Texto | `text-sm text-gray-800` · `placeholder:text-gray-400` |
| Sombra | `shadow-theme-xs` |
| **Focus** | `focus:border-brand-300` + `focus:ring-3` + `focus:ring-brand-500/10` + `focus:outline-hidden` |
| Dark | `dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30` |
| Dark focus | `dark:focus:border-brand-800` |
| (muerta) | `dark:bg-dark-900` |

**El anillo de focus es `ring-3` (3px) en `brand-500` al 10%**, más el borde que pasa a `brand-300`.
En dark el borde de focus pasa a `brand-800`. No hay `outline`.

### 1.4 Tabla de estados del input

| Estado | Borde | Focus borde | Focus ring | Dark borde | Dark focus borde | Extra |
|---|---|---|---|---|---|---|
| **Default** | `border-gray-300` | `focus:border-brand-300` | `focus:ring-3 focus:ring-brand-500/10` | `dark:border-gray-700` | `dark:focus:border-brand-800` | `shadow-theme-xs` |
| **Error** | `border-error-300` | `focus:border-error-300` | `focus:ring-3 focus:ring-error-500/10` | `dark:border-error-700` | `dark:focus:border-error-800` | + icono `#F04438` a la derecha, `pr-10` |
| **Success** | `border-success-300` | `focus:border-success-300` | `focus:ring-3 focus:ring-success-500/10` | `dark:border-success-700` | `dark:focus:border-success-800` | + icono `#12B76A` a la derecha, `pr-10` |
| **Disabled** | `border-gray-300` → `disabled:border-gray-100` | `focus:border-brand-300` | `focus:shadow-focus-ring` (¡no ring!) | `dark:border-gray-700` | `dark:focus:border-brand-300` | `disabled:placeholder:text-gray-300` |

Detalles finos:
- Error/Success **pierden `h-11`** (usan solo `py-2.5`) y **no llevan `border-gray-300`**: van con `border` a secas + `border-error-300`. Tampoco llevan `dark:border-gray-700`.
- Disabled **no lleva** `focus:ring-3` ni `focus:ring-brand-500/10`; usa `focus:shadow-focus-ring`. Y su `dark:focus:border-` es `brand-300`, no `brand-800` (probable inconsistencia de la demo).

#### Error (literal)

```html
<label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Email</label>
<div class="relative">
  <input
    type="text" value="demoemail"
    class="dark:bg-dark-900 border-error-300 shadow-theme-xs focus:border-error-300 focus:ring-error-500/10 dark:border-error-700 dark:focus:border-error-800 w-full rounded-lg border bg-transparent px-4 py-2.5 pr-10 text-sm text-gray-800 placeholder:text-gray-400 focus:ring-3 focus:outline-hidden dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30"
  />
  <span class="absolute top-1/2 right-3.5 -translate-y-1/2">
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="…" fill="#F04438"/></svg>
  </span>
</div>
<p class="text-theme-xs text-error-500 mt-1.5">This is an error message.</p>
```

#### Success (literal)

```html
<div class="relative">
  <input
    type="text" value="demoemail@gmail.com"
    class="dark:bg-dark-900 border-success-300 shadow-theme-xs focus:border-success-300 focus:ring-success-500/10 dark:border-success-700 dark:focus:border-success-800 w-full rounded-lg border bg-transparent px-4 py-2.5 pr-10 text-sm text-gray-800 placeholder:text-gray-400 focus:ring-3 focus:outline-hidden dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30"
  />
  <span class="absolute top-1/2 right-3.5 -translate-y-1/2">
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="…" fill="#12B76A"/></svg>
  </span>
</div>
<p class="text-theme-xs text-success-500 mt-1.5">This is an success message.</p>
```

#### Disabled (literal)

```html
<label class="mb-1.5 block text-sm font-medium text-gray-300 dark:text-white/15">Email</label>
<input
  type="text" placeholder="info@gmail.com" disabled
  class="shadow-theme-xs focus:border-brand-300 focus:shadow-focus-ring dark:focus:border-brand-300 h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-hidden disabled:border-gray-100 disabled:placeholder:text-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-gray-400 dark:disabled:border-gray-800 dark:disabled:placeholder:text-white/15"
/>
```

### 1.5 Textarea

Igual que el input **menos `h-11`**:

```html
<!-- Default -->
<textarea placeholder="Enter a description..." type="text" rows="6"
  class="dark:bg-dark-900 shadow-theme-xs focus:border-brand-300 focus:ring-brand-500/10 dark:focus:border-brand-800 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:ring-3 focus:outline-hidden dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30"
></textarea>

<!-- Disabled (añade disabled:bg-gray-50, que el input de texto NO tiene) -->
<textarea placeholder="Enter a description..." type="text" rows="6" disabled
  class="dark:bg-dark-900 shadow-theme-xs focus:border-brand-300 focus:shadow-focus-ring dark:focus:border-brand-800 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:ring-0 focus:outline-hidden disabled:border-gray-100 disabled:bg-gray-50 disabled:placeholder:text-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:disabled:border-gray-800 dark:disabled:bg-white/[0.03] dark:disabled:placeholder:text-white/15"
></textarea>

<!-- Error -->
<textarea placeholder="Enter a description..." type="text" rows="6"
  class="dark:bg-dark-900 border-error-300 shadow-theme-xs focus:border-error-300 focus:ring-error-500/10 dark:border-error-700 dark:focus:border-error-800 w-full rounded-lg border bg-transparent px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:ring-3 focus:outline-hidden dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30"
></textarea>
<p class="text-theme-xs text-error-500">Please enter a message in the textarea.</p>
```

Nota: el textarea disabled usa `focus:ring-0` (el input disabled no pone `ring-0`, simplemente omite `ring-3`).

### 1.6 Select con chevron

El `<select>` nativo se aplana (`appearance-none bg-none`), se reserva `pr-11` y el chevron es un
`<span>` absoluto. El wrapper necesita `relative z-20` y el chevron `z-30`.

```html
<label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Select Input</label>
<div x-data="{ isOptionSelected: false }" class="relative z-20 bg-transparent">
  <select
    class="dark:bg-dark-900 shadow-theme-xs focus:border-brand-300 focus:ring-brand-500/10 dark:focus:border-brand-800 h-11 w-full appearance-none rounded-lg border border-gray-300 bg-transparent bg-none px-4 py-2.5 pr-11 text-sm text-gray-800 placeholder:text-gray-400 focus:ring-3 focus:outline-hidden dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30"
    :class="isOptionSelected && 'text-gray-800 dark:text-white/90'"
    @change="isOptionSelected = true"
  >
    <option value="" class="text-gray-700 dark:bg-gray-900 dark:text-gray-400">Select Option</option>
    <option value="" class="text-gray-700 dark:bg-gray-900 dark:text-gray-400">Marketing</option>
  </select>
  <span class="pointer-events-none absolute top-1/2 right-4 z-30 -translate-y-1/2 text-gray-500 dark:text-gray-400">
    <svg class="stroke-current" width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M4.79175 7.396L10.0001 12.6043L15.2084 7.396" stroke="" stroke-width="1.5"
            stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </span>
</div>
```

Diferencias entre las dos instancias de select en la página:
- Card "Default Inputs": chevron `text-gray-500 dark:text-gray-400`.
- Card "Select Inputs": chevron `text-gray-700 dark:text-gray-400`.
- El truco `isOptionSelected` existe para simular placeholder gris → texto oscuro al elegir. En
  form-layout el `:class` es el inverso (`'text-gray-500 dark:text-gray-400'`) — inconsistente.
- `<option>` **siempre** lleva `dark:bg-gray-900` (Firefox/Windows lo necesitan).

### 1.7 Input con icono

#### Icono a la IZQUIERDA con separador (input group con prefijo)

`pl-[62px]` en el input; el `<span>` absoluto lleva el `border-r`.

```html
<div class="relative">
  <span class="absolute top-1/2 left-0 -translate-y-1/2 border-r border-gray-200 px-3.5 py-3 text-gray-500 dark:border-gray-800 dark:text-gray-400">
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="…" fill="#667085"/></svg>
  </span>
  <input type="text" placeholder="info@gmail.com"
    class="dark:bg-dark-900 shadow-theme-xs focus:border-brand-300 focus:ring-brand-500/10 dark:focus:border-brand-800 h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 pl-[62px] text-sm text-gray-800 placeholder:text-gray-400 focus:ring-3 focus:outline-hidden dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30"
  />
</div>
```

Variante "Input with Payment" — el span es una caja fija de 46px:
```html
<span class="absolute top-1/2 left-0 flex h-11 w-[46px] -translate-y-1/2 items-center justify-center border-r border-gray-200 dark:border-gray-800">…</span>
<!-- input: … px-4 py-2.5 pl-[62px] … (con appearance-none bg-none) -->
```

#### Icono a la DERECHA (password toggle)

```html
<div x-data="{ showPassword: false }" class="relative">
  <input :type="showPassword ? 'text' : 'password'" placeholder="Enter your password"
    class="dark:bg-dark-900 shadow-theme-xs focus:border-brand-300 focus:ring-brand-500/10 dark:focus:border-brand-800 h-11 w-full appearance-none rounded-lg border border-gray-300 bg-transparent bg-none px-4 py-2.5 pr-11 pl-4 text-sm text-gray-800 placeholder:text-gray-400 focus:ring-3 focus:outline-hidden dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30"
  />
  <span @click="showPassword = !showPassword"
        class="absolute top-1/2 right-4 z-30 -translate-y-1/2 cursor-pointer">
    <svg x-show="!showPassword" class="fill-gray-500 dark:fill-gray-400" width="20" height="20" …/>
    <svg x-show="showPassword"  class="fill-gray-500 dark:fill-gray-400" width="20" height="20" …/>
  </span>
</div>
```

#### Prefijo de TEXTO (`http://`)

```html
<div class="relative">
  <span class="absolute top-1/2 left-0 inline-flex h-11 -translate-y-1/2 items-center justify-center border-r border-gray-200 py-3 pr-3 pl-3.5 text-gray-500 dark:border-gray-800 dark:text-gray-400">
    http://
  </span>
  <input type="url" placeholder="www.tailadmin.com"
    class="dark:bg-dark-900 shadow-theme-xs focus:border-brand-300 focus:ring-brand-500/10 dark:focus:border-brand-800 h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 pl-[90px] text-sm text-gray-800 placeholder:text-gray-400 focus:ring-3 focus:outline-hidden dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30"
  />
</div>
```

#### Sufijo tipo BOTÓN (copy)

```html
<div class="relative">
  <button id="copy-button"
    class="absolute top-1/2 right-0 inline-flex -translate-y-1/2 cursor-pointer items-center gap-1 border-l border-gray-200 py-3 pr-3 pl-3.5 text-sm font-medium text-gray-700 dark:border-gray-800 dark:text-gray-400">
    <svg class="fill-current" width="20" height="20" …/>
    <div id="copy-text">Copy</div>
  </button>
  <input value="www.tailadmin.com" type="url" id="website-input"
    class="dark:bg-dark-900 shadow-theme-xs focus:border-brand-300 focus:ring-brand-500/10 dark:focus:border-brand-800 h-11 w-full rounded-lg border border-gray-300 bg-transparent py-3 pr-[90px] pl-4 text-sm text-gray-800 placeholder:text-gray-400 focus:ring-3 focus:outline-hidden dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30"
  />
</div>
```

**Tabla de paddings de los input groups:**

| Add-on | Padding del input | Clase del add-on |
|---|---|---|
| Icono izq. (20px + separador) | `pl-[62px]` | `left-0 … border-r … px-3.5 py-3` |
| Caja de pago 46px | `pl-[62px]` | `left-0 flex h-11 w-[46px] … border-r` |
| Texto `http://` | `pl-[90px]` | `left-0 inline-flex h-11 … border-r py-3 pr-3 pl-3.5` |
| Select de país (izq.) | `pl-[84px]` | `absolute` + select `rounded-l-lg border-0 border-r` |
| Select de país (der.) | `pr-[84px]` | `absolute right-0` + select `rounded-r-lg border-0 border-l` |
| Botón Copy (der.) | `pr-[90px]` | `right-0 inline-flex … border-l py-3 pr-3 pl-3.5` |
| Icono der. (chevron/eye) | `pr-11` | `right-4 -translate-y-1/2` |
| Icono de validación err/ok | `pr-10` | `right-3.5 -translate-y-1/2` |
| Icono date/time | `pr-11` | `right-3 -translate-y-1/2` |
| Buscador (lupa izq.) | `pl-11` | `left-4 -translate-y-1/2` |

#### Select embebido (prefijo de país)

```html
<div class="relative">
  <div class="absolute"> <!-- o class="absolute right-0" para el sufijo -->
    <select x-model="selectedCountry" @change="phoneNumber = countryCodes[selectedCountry]"
      class="focus:border-brand-300 focus:ring-brand-500/10 appearance-none rounded-l-lg border-0 border-r border-gray-200 bg-transparent bg-none py-3 pr-8 pl-3.5 leading-tight text-gray-700 focus:ring-3 focus:outline-hidden dark:border-gray-800 dark:text-gray-400">
      <option value="US" class="text-gray-700 dark:bg-gray-900 dark:text-gray-400">US</option>
    </select>
    <div class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-700 dark:text-gray-400">
      <svg class="stroke-current" width="20" height="20" viewBox="0 0 20 20" fill="none">…</svg>
    </div>
  </div>
  <input placeholder="+1 (555) 000-0000" x-model="phoneNumber" type="tel"
    class="dark:bg-dark-900 shadow-theme-xs focus:border-brand-300 focus:ring-brand-500/10 dark:focus:border-brand-800 h-11 w-full rounded-lg border border-gray-300 bg-transparent py-3 pr-4 pl-[84px] text-sm text-gray-800 placeholder:text-gray-400 focus:ring-3 focus:outline-hidden dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30"
  />
</div>
```

Para el sufijo: `<div class="absolute right-0">` + select `rounded-r-lg border-0 border-l` + input `pr-[84px]` (sin `pl-`).

### 1.8 Date picker / Time

**Librería: `flatpickr`** (clase gancho `.datepickerTwo`). Config literal (`charts/index.js`):

```js
flatpickr(".datepickerTwo", {
  static: true,
  monthSelectorType: "static",
  dateFormat: "M j, Y",
  prevArrow: '<svg class="stroke-current" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15.25 6L9 12.25L15.25 18.5" stroke="" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  nextArrow: '<svg class="stroke-current" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8.75 19L15 12.75L8.75 6.5" stroke="" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  onReady(selectedDates, dateStr, instance) { instance.element.value = dateStr.replace("to", "-"); /* + data-class → calendarContainer.classList.add */ },
  onChange(selectedDates, dateStr, instance) { instance.element.value = dateStr.replace("to", "-"); },
});
```

Markup (date). El input es `type="date"` + la clase `datepickerTwo`:

```html
<div class="relative">
  <input type="date" placeholder="Select date"
    class="dark:bg-dark-900 datepickerTwo shadow-theme-xs focus:border-brand-300 focus:ring-brand-500/10 dark:focus:border-brand-800 h-11 w-full appearance-none rounded-lg border border-gray-300 bg-transparent bg-none px-4 py-2.5 pr-11 pl-4 text-sm text-gray-800 placeholder:text-gray-400 focus:ring-3 focus:outline-hidden dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30"
  />
  <span class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-gray-500 dark:text-gray-400">
    <svg class="fill-current" width="20" height="20" viewBox="0 0 20 20" fill="none">…</svg>
  </span>
</div>
```

Time — idéntico pero `type="time"`, `onclick="this.showPicker()"`, sin `datepickerTwo`, y el span
**sin** `pointer-events-none`.

### 1.9 File input

Estiliza el botón nativo con `file:*`:

```html
<label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Upload file</label>
<input type="file"
  class="focus:border-ring-brand-300 shadow-theme-xs focus:file:ring-brand-300 h-11 w-full overflow-hidden rounded-lg border border-gray-300 bg-transparent text-sm text-gray-500 transition-colors file:mr-5 file:border-collapse file:cursor-pointer file:rounded-l-lg file:border-0 file:border-r file:border-solid file:border-gray-200 file:bg-gray-50 file:py-3 file:pr-3 file:pl-3.5 file:text-sm file:text-gray-700 placeholder:text-gray-400 hover:file:bg-gray-100 focus:outline-hidden dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:text-white/90 dark:file:border-gray-800 dark:file:bg-white/[0.03] dark:file:text-gray-400 dark:placeholder:text-gray-400"
/>
```

> Ojo: `focus:border-ring-brand-300` no es una clase válida y `dark:text-gray-400 dark:text-white/90`
> están duplicadas/en conflicto. Basura de la demo — límpialo al portar.

### 1.10 Checkbox

Input real oculto (`sr-only`) + caja pintada con Alpine. **No usa `peer`** (salvo un `peer` inerte en el disabled).

```html
<div x-data="{ checkboxToggle: false }">
  <label for="checkboxLabelOne"
    class="flex cursor-pointer items-center text-sm font-medium text-gray-700 select-none dark:text-gray-400">
    <div class="relative">
      <input type="checkbox" id="checkboxLabelOne" class="sr-only" @change="checkboxToggle = !checkboxToggle" />
      <div
        :class="checkboxToggle ? 'border-brand-500 bg-brand-500' : 'bg-transparent border-gray-300 dark:border-gray-700'"
        class="hover:border-brand-500 dark:hover:border-brand-500 mr-3 flex h-5 w-5 items-center justify-center rounded-md border-[1.25px]">
        <span :class="checkboxToggle ? '' : 'opacity-0'">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M11.6666 3.5L5.24992 9.91667L2.33325 7" stroke="white" stroke-width="1.94437"
                  stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
      </div>
    </div>
    Default
  </label>
</div>
```

| Variante | Label | Caja OFF | Caja ON | Check |
|---|---|---|---|---|
| Default / Checked | `text-gray-700 dark:text-gray-400` | `bg-transparent border-gray-300 dark:border-gray-700` | `border-brand-500 bg-brand-500` | `stroke="white"` `stroke-width="1.94437"` |
| Disabled | `text-gray-300 dark:text-gray-700` | `bg-transparent border-gray-200 dark:border-gray-800` | `border-brand-500 bg-brand-500` | `class="stroke-gray-200 dark:stroke-gray-800"` `stroke-width="2.33333"` |

Constantes: caja `h-5 w-5 rounded-md border-[1.25px]`, gap con el texto vía `mr-3` en la caja.
El disabled **no** lleva `hover:border-brand-500` y su ternario está invertido (bug de la demo).
La primera instancia arrastra una clase basura `f ` al inicio (`class="f hover:border-brand-500 …"`).

### 1.11 Radio

Idéntico al checkbox salvo `rounded-full` y el punto interior:

```html
<div x-data="{ checkboxToggle: false }">
  <label for="radioLabelOne"
    class="flex cursor-pointer items-center text-sm font-medium text-gray-700 select-none dark:text-gray-400">
    <div class="relative">
      <input type="checkbox" id="radioLabelOne" class="sr-only" @change="checkboxToggle = !checkboxToggle" />
      <div
        :class="checkboxToggle ? 'border-brand-500 bg-brand-500' : 'bg-transparent border-gray-300 dark:border-gray-700'"
        class="hover:border-brand-500 dark:hover:border-brand-500 mr-3 flex h-5 w-5 items-center justify-center rounded-full border-[1.25px]">
        <span class="h-2 w-2 rounded-full"
              :class="checkboxToggle ? 'bg-white' : 'bg-white dark:bg-[#171f2e]'"></span>
      </div>
    </div>
    Default
  </label>
</div>
```

Punto interior: `h-2 w-2 rounded-full`, siempre `bg-white`; en OFF+dark se camufla con el hex
hardcodeado **`dark:bg-[#171f2e]`** (no es token — el fondo real de la card oscura).
Disabled: label `text-gray-300 dark:text-gray-700`, sin `hover:`, ternario invertido.
⚠️ La demo usa `type="checkbox"` para los radios — cámbialo a `type="radio"` al portar.

### 1.12 Toggle / Switch

Dos juegos de color (brand y gris).

```html
<div x-data="{ switcherToggle: false }">
  <label for="toggle1"
    class="flex cursor-pointer items-center gap-3 text-sm font-medium text-gray-700 select-none dark:text-gray-400">
    <div class="relative">
      <input type="checkbox" id="toggle1" class="sr-only" @change="switcherToggle = !switcherToggle" />
      <!-- pista -->
      <div class="block h-6 w-11 rounded-full"
           :class="switcherToggle ? 'bg-brand-500 dark:bg-brand-500' : 'bg-gray-200 dark:bg-white/10'"></div>
      <!-- pulgar -->
      <div :class="switcherToggle ? 'translate-x-full': 'translate-x-0'"
           class="shadow-theme-sm absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white duration-300 ease-linear"></div>
    </div>
    Default
  </label>
</div>
```

| Variante | Pista ON | Pista OFF | Pulgar |
|---|---|---|---|
| **Brand** default/checked | `bg-brand-500 dark:bg-brand-500` | `bg-gray-200 dark:bg-white/10` | `bg-white` |
| **Brand** disabled | `bg-brand-500 dark:bg-brand-500` | `bg-gray-100 dark:bg-gray-800` | `bg-gray-50` |
| **Gray** default/checked | `bg-gray-700 dark:bg-white/10` | `bg-gray-200 dark:bg-gray-800` | `bg-white` |
| **Gray** disabled | `bg-gray-700 dark:bg-white/10` | `bg-gray-100 dark:bg-gray-800` | `bg-gray-50` |

Constantes: pista `h-6 w-11 rounded-full`; pulgar `absolute top-0.5 left-0.5 h-5 w-5 rounded-full
shadow-theme-sm duration-300 ease-linear`; desplazamiento `translate-x-full` ↔ `translate-x-0`;
label con `gap-3` (el checkbox/radio usan `mr-3` en la caja).
Label disabled: `text-gray-400` (sin variante dark).

### 1.13 Multi-select con tags

```html
<div x-data="{ open:false, selected:[1,3], options:[…], toggleOption(id){…}, isSelected(id){…} }"
     class="relative" @click.away="open = false">
  <input type="hidden" name="selected_options" :value="selected.join(',')" />

  <!-- Trigger -->
  <div @click="open = !open"
    class="shadow-theme-xs flex min-h-11 cursor-pointer gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 transition dark:border-gray-700 dark:bg-gray-900">
    <div class="flex flex-1 flex-wrap items-center gap-2">
      <template x-for="id in selected" :key="id">
        <!-- Tag -->
        <div class="group flex items-center justify-center rounded-full border-[0.7px] border-transparent bg-gray-100 py-1 pr-2 pl-2.5 text-sm text-gray-800 hover:border-gray-200 dark:bg-gray-800 dark:text-white/90 dark:hover:border-gray-800">
          <span x-text="options.find(o => o.id === id).name"></span>
          <button type="button" @click.stop="toggleOption(id)"
            class="ml-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
            <svg class="fill-current" role="button" width="14" height="14" viewBox="0 0 14 14" fill="none">…</svg>
          </button>
        </div>
      </template>
      <span x-show="selected.length === 0" class="text-sm text-gray-500 dark:text-gray-400">Select options...</span>
    </div>
    <div class="flex items-start pt-1.5">
      <svg class="h-5 w-5 shrink-0 text-gray-500 transition-transform dark:text-gray-400"
           :class="open ? 'rotate-180' : ''" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
      </svg>
    </div>
  </div>

  <!-- Dropdown -->
  <div x-show="open" style="max-height: 16rem"
    class="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
    <div class="overflow-y-auto" style="max-height: 16rem">
      <template x-for="option in options" :key="option.id">
        <div @click="toggleOption(option.id)"
          class="cursor-pointer border-b border-gray-200 px-4 py-3 text-sm transition last:border-b-0 dark:border-gray-800">
          <span class="text-gray-800 dark:text-white/90" x-text="option.name"></span>
        </div>
      </template>
    </div>
  </div>
</div>
```

Nota: el trigger usa `min-h-11` (no `h-11`) para crecer con los tags, y `bg-white` (no `bg-transparent`).

### 1.14 Dropzone

**Librería: `dropzone`** (`dropzone/dist/dropzone.css`). El `!` fuerza sobre el CSS de la librería:

```html
<form class="dropzone hover:border-brand-500! dark:hover:border-brand-500! rounded-xl border border-dashed! border-gray-300! bg-gray-50 p-7 lg:p-10 dark:border-gray-700! dark:bg-gray-900"
      id="demo-upload" action="/upload">
  <div class="dz-message m-0!">
    <div class="mb-[22px] flex justify-center">
      <div class="flex h-[68px] w-[68px] items-center justify-center rounded-full bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-400">
        <svg class="fill-current" width="29" height="28" viewBox="0 0 29 28" fill="none">…</svg>
      </div>
    </div>
    <h4 class="text-theme-xl mb-3 font-semibold text-gray-800 dark:text-white/90">Drag &amp; Drop File Here</h4>
    <span class="mx-auto mb-5 block w-full max-w-[290px] text-sm text-gray-700 dark:text-gray-400">
      Drag and drop your PNG, JPG, WebP, SVG images here or browse
    </span>
    <span class="text-theme-sm text-brand-500 font-medium underline">Browse File</span>
  </div>
</form>
```

### 1.15 Layouts de formulario (form-layout.html)

Dos recetas, nada más:

```html
<!-- A) Rejilla de 2 cards -->
<div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
  <div class="space-y-6"> …cards… </div>
  <div class="space-y-6"> …cards… </div>
</div>

<!-- B) Formulario multi-columna dentro de una card -->
<form>
  <div class="-mx-2.5 flex flex-wrap gap-y-5">
    <div class="w-full px-2.5">
      <h4 class="border-b border-gray-200 pb-4 text-base font-medium text-gray-800 dark:border-gray-800 dark:text-white/90">
        Personal Info
      </h4>
    </div>
    <div class="w-full px-2.5 xl:w-1/2"> <label …>First Name</label> <input …/> </div>
    <div class="w-full px-2.5 xl:w-1/2"> <label …>Last Name</label>  <input …/> </div>
    <div class="w-full px-2.5">         <label …>Gender</label>     <select …/> </div>
  </div>
</form>
```

No usa `grid` interno: es flex-wrap con gutter `-mx-2.5` / `px-2.5` y `gap-y-5`. Los subtítulos de
bloque son `<h4>` a ancho completo con `border-b … pb-4`.

Botón primario (única variante que aparece en formularios):
```html
<button class="bg-brand-500 hover:bg-brand-600 flex w-full items-center justify-center gap-2 rounded-lg p-3 text-sm font-medium text-white transition-colors">…</button>
<!-- variantes: px-4 py-3 · w-full xl:w-auto · sin flex (w-full rounded-lg p-3 …) -->
```

---

## 2. TABLAS

### 2.1 `basic-tables.html` — dos estructuras distintas

#### Patrón A — "Basic Table 1": bordes por fila, `<table>` real

```html
<!-- wrapper: recorta las esquinas y da el scroll horizontal -->
<div class="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
  <div class="max-w-full overflow-x-auto custom-scrollbar">
    <table class="w-full min-w-[1102px]">
      <thead>
        <tr class="border-b border-gray-100 dark:border-gray-800">
          <th class="px-5 py-3 text-left sm:px-6">
            <p class="font-medium text-gray-500 text-theme-xs dark:text-gray-400">User</p>
          </th>
          <!-- … -->
        </tr>
      </thead>
      <tbody>
        <tr class="border-b border-gray-100 dark:border-gray-800">
          <td class="px-5 py-4 sm:px-6" colspan="1"> … </td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
```

#### Patrón B — "Basic Table 2": thead con fondo, `divide-y` en tbody

```html
<div class="custom-scrollbar max-w-full overflow-x-auto">
  <table class="min-w-full">
    <thead class="border-y border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
      <tr>
        <th class="px-6 py-3 whitespace-nowrap">
          <div class="flex items-center">
            <p class="text-theme-xs font-medium text-gray-500 dark:text-gray-400">Customer</p>
          </div>
        </th>
        <!-- columna de acciones: <div class="flex items-center justify-center"> -->
      </tr>
    </thead>
    <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
      <tr>
        <td class="px-6 py-3 whitespace-nowrap"> … </td>
      </tr>
    </tbody>
  </table>
</div>
```

**Resumen de la estructura:**

| Pieza | Patrón A | Patrón B |
|---|---|---|
| Wrapper | `overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]` | — (va dentro de la card) |
| Scroller | `max-w-full overflow-x-auto custom-scrollbar` | `custom-scrollbar max-w-full overflow-x-auto` |
| `<table>` | `w-full min-w-[1102px]` | `min-w-full` |
| `<thead>` | sin clases (borde en el `<tr>`) | `border-y border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-900` |
| `<th>` | `px-5 py-3 text-left sm:px-6` | `px-6 py-3 whitespace-nowrap` + `<div class="flex items-center">` |
| Texto `<th>` | `font-medium text-gray-500 text-theme-xs dark:text-gray-400` | `text-theme-xs font-medium text-gray-500 dark:text-gray-400` |
| Separador de fila | `<tr class="border-b border-gray-100 dark:border-gray-800">` | `<tbody class="divide-y divide-gray-100 dark:divide-gray-800">` |
| `<td>` | `px-5 py-4 sm:px-6` | `px-6 py-3 whitespace-nowrap` |

**No hay hover de fila en `basic-tables.html`.** Las únicas clases de `<tr>` presentes son
`border-b border-gray-100 dark:border-gray-800`, `border-gray-100 border-y dark:border-gray-800` y
`border-t border-gray-100 dark:border-gray-800`. El hover solo existe en botones/iconos
(p. ej. `hover:fill-error-500 dark:hover:fill-error-500 cursor-pointer fill-gray-700 dark:fill-gray-400`).

### 2.2 Celda con avatar + texto (dos líneas)

```html
<td class="px-5 py-4 sm:px-6" colspan="1">
  <div class="flex items-center gap-3">
    <div class="w-10 h-10 overflow-hidden rounded-full">
      <img src="src/images/user/user-17.jpg" alt="brand" />
    </div>
    <div>
      <span class="block font-medium text-gray-800 text-theme-sm dark:text-white/90">Lindsey Curtis</span>
      <span class="block text-gray-500 text-theme-xs dark:text-gray-400">Web Designer</span>
    </div>
  </div>
</td>
```

### 2.3 Celda con grupo de avatares solapados

```html
<td class="px-5 py-4 sm:px-6">
  <div class="flex -space-x-2">
    <div class="w-6 h-6 overflow-hidden border-2 border-white rounded-full dark:border-gray-900">
      <img src="src/images/user/user-22.jpg" alt="user" />
    </div>
    <!-- repetir -->
  </div>
</td>
```

### 2.4 Badge de estado

```html
<td class="px-5 py-4 sm:px-6">
  <p class="bg-success-50 text-theme-xs text-success-700 dark:bg-success-500/15 dark:text-success-500 inline-block rounded-full px-2 py-0.5 font-medium">
    Active
  </p>
</td>
```

Base común: `inline-block rounded-full px-2 py-0.5 font-medium text-theme-xs`.

| Variante | Cadena literal |
|---|---|
| Success (700) | `bg-success-50 text-theme-xs text-success-700 dark:bg-success-500/15 dark:text-success-500 inline-block rounded-full px-2 py-0.5 font-medium` |
| Success (600) | `bg-success-50 text-theme-xs text-success-600 dark:bg-success-500/15 dark:text-success-500 inline-block rounded-full px-2 py-0.5 font-medium` |
| Error (700) | `bg-error-50 text-theme-xs text-error-700 dark:bg-error-500/15 dark:text-error-500 inline-block rounded-full px-2 py-0.5 font-medium` |
| Error (600) | `bg-error-50 text-theme-xs text-error-600 dark:bg-error-500/15 dark:text-error-500 inline-block rounded-full px-2 py-0.5 font-medium` |
| Warning (700) | `bg-warning-50 text-theme-xs text-warning-700 dark:bg-warning-500/15 dark:text-warning-400 inline-block rounded-full px-2 py-0.5 font-medium` |
| Warning (600) | `bg-warning-50 text-theme-xs text-warning-600 dark:bg-warning-500/15 dark:text-warning-400 rounded-full px-2 py-0.5 font-medium` |

Fórmula: `bg-{sem}-50` + `text-{sem}-600|700` en claro → `dark:bg-{sem}-500/15` + `dark:text-{sem}-500`
en oscuro. La demo mezcla 600/700 y en warning el dark es `-400` (y una instancia usa
`dark:text-orange-400`, fuera de paleta). **Elige uno y normaliza.**

Punto de estado (badge en avatar):
`bg-success-500 absolute right-0 bottom-0 z-10 h-2.5 w-full max-w-2.5 rounded-full border-[1.5px] border-white dark:border-gray-900`

### 2.5 Checkbox de selección en tabla

Variante compacta (sin `<input>` real, solo `<div>` + Alpine):

```html
<div x-data="{checked: false}" class="flex items-center gap-3">
  <div @click="checked = !checked"
    class="flex h-5 w-5 cursor-pointer items-center justify-center rounded-md border-[1.25px]"
    :class="checked ? 'border-brand-500 dark:border-brand-500 bg-brand-500' : 'bg-white dark:bg-white/0 border-gray-300 dark:border-gray-700'">
    <svg :class="checked ? 'block' : 'hidden'" width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M11.6668 3.5L5.25016 9.91667L2.3335 7" stroke="white" stroke-width="1.94437"
            stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </div>
  <span class="text-theme-xs block font-medium text-gray-500 dark:text-gray-400">Deal ID</span>
</div>
```

Diferencias vs. el checkbox de formulario: usa `block`/`hidden` (no `opacity-0`), OFF es
`bg-white dark:bg-white/0` (no `bg-transparent`), y añade `dark:border-brand-500` en ON.

### 2.6 `data-tables.html` — qué aporta

**No es un `<table>`.** Es un **CSS grid de 12 columnas** con `<div>`s, movido por Alpine.
Aporta: selector de "Show N entries", buscador, orden por columna y paginación numérica.

Contenedor (nota el `pt-4` que el basic-table no tiene):
```html
<div x-data="dataTable()"
  class="overflow-hidden rounded-xl border border-gray-200 bg-white pt-4 dark:border-gray-800 dark:bg-white/[0.03]">
```

#### Toolbar

```html
<div class="mb-4 flex flex-col gap-2 px-4 sm:flex-row sm:items-center sm:justify-between">
  <!-- Show N entries -->
  <div class="flex items-center gap-3">
    <span class="text-gray-500 dark:text-gray-400"> Show </span>
    <div x-data="{ isOptionSelected: false }" class="relative z-20 bg-transparent">
      <select
        class="dark:bg-dark-900 shadow-theme-xs focus:border-brand-300 focus:ring-brand-500/10 dark:focus:border-brand-800 h-9 w-full appearance-none rounded-lg border border-gray-300 bg-transparent bg-none py-2 pr-8 pl-3 text-sm text-gray-800 placeholder:text-gray-400 focus:ring-3 focus:outline-hidden dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30"
        :class="isOptionSelected && 'text-gray-500 dark:text-gray-400'"
        @click="isOptionSelected = true" @change="perPage = $event.target.value">
        <option value="10" class="text-gray-500 dark:bg-gray-900 dark:text-gray-400">10</option>
        <option value="8"  class="text-gray-500 dark:bg-gray-900 dark:text-gray-400">8</option>
        <option value="5"  class="text-gray-500 dark:bg-gray-900 dark:text-gray-400">5</option>
      </select>
      <span class="absolute top-1/2 right-2 z-30 -translate-y-1/2 text-gray-500 dark:text-gray-400">
        <svg class="stroke-current" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M3.8335 5.9165L8.00016 10.0832L12.1668 5.9165" stroke="" stroke-width="1.2"
                stroke-linecap="round" stroke-linejoin="round"/></svg>
      </span>
    </div>
    <span class="text-gray-500 dark:text-gray-400"> entries </span>
  </div>

  <!-- Buscador -->
  <div class="relative">
    <button class="absolute top-1/2 left-4 -translate-y-1/2 text-gray-500 dark:text-gray-400">
      <svg class="fill-current" width="20" height="20" viewBox="0 0 20 20" fill="none">…</svg>
    </button>
    <input type="text" x-model="search" placeholder="Search..."
      class="dark:bg-dark-900 shadow-theme-xs focus:border-brand-300 focus:ring-brand-500/10 dark:focus:border-brand-800 h-11 w-full rounded-lg border border-gray-300 bg-transparent py-2.5 pr-4 pl-11 text-sm text-gray-800 placeholder:text-gray-400 focus:ring-3 focus:outline-hidden xl:w-[300px] dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30"
    />
  </div>
</div>
```

Select compacto = input base con `h-9 … py-2 pr-8 pl-3` (vs. `h-11 … px-4 py-2.5 pr-11`).
Buscador = input base con `pl-11` + `xl:w-[300px]`.

#### Cabecera ordenable (grid)

```html
<div class="max-w-full overflow-x-auto">
  <div class="min-w-[1102px]">
    <!-- header -->
    <div class="grid grid-cols-12 border-t border-gray-200 dark:border-gray-800">
      <div class="col-span-3 flex items-center border-r border-gray-200 px-4 py-3 dark:border-gray-800">
        <div class="flex w-full cursor-pointer items-center justify-between" @click="sortBy('user')">
          <p class="text-theme-xs font-medium text-gray-700 dark:text-gray-400">User</p>
          <span class="flex flex-col gap-0.5">
            <!-- caret ▲ -->
            <svg class="fill-gray-300 dark:fill-gray-700" width="8" height="5" viewBox="0 0 8 5" fill="none">
              <path d="M4.40962 0.585167C4.21057 0.300808 3.78943 0.300807 3.59038 0.585166L1.05071 4.21327C0.81874 4.54466 1.05582 5 1.46033 5H6.53967C6.94418 5 7.18126 4.54466 6.94929 4.21327L4.40962 0.585167Z" fill=""/>
            </svg>
            <!-- caret ▼ -->
            <svg class="fill-gray-300 dark:fill-gray-700" width="8" height="5" viewBox="0 0 8 5" fill="none">
              <path d="M4.40962 4.41483C4.21057 4.69919 3.78943 4.69919 3.59038 4.41483L1.05071 0.786732C0.81874 0.455343 1.05582 0 1.46033 0H6.53967C6.94418 0 7.18126 0.455342 6.94929 0.786731L4.40962 4.41483Z" fill=""/>
            </svg>
          </span>
        </div>
      </div>
      <!-- resto: col-span-2 / col-span-1, misma receta; la última sin border-r -->
    </div>

    <!-- filas -->
    <template x-for="person in paginatedData" :key="person.id">
      <div class="grid grid-cols-12 border-t border-gray-100 dark:border-gray-800">
        <div class="col-span-3 flex items-center border-r border-gray-100 px-4 py-3 dark:border-gray-800">
          <div class="flex items-center gap-3">
            <div class="h-10 w-10 overflow-hidden rounded-full"><img :src="person.image" alt="user" /></div>
            <span class="text-theme-sm block font-medium text-gray-800 dark:text-white/90" x-text="person.name"></span>
          </div>
        </div>
        <div class="col-span-2 flex items-center border-r border-gray-100 px-4 py-3 dark:border-gray-800">
          <p class="text-theme-sm text-gray-700 dark:text-gray-400" x-text="person.position"></p>
        </div>
        <!-- … última celda: col-span-2 flex items-center px-4 py-3  (sin border-r) -->
      </div>
    </template>
  </div>
</div>
```

Reparto: `3 + 2 + 2 + 1 + 2 + 2 = 12`. Header usa `border-gray-200`; las filas, `border-gray-100`.
Los carets **nunca cambian de color** al ordenar — ambos quedan en `fill-gray-300 dark:fill-gray-700`
(no hay indicador visual de dirección: bug/limitación de la demo).

#### Paginación

```html
<div class="border-t border-gray-100 py-4 pr-4 pl-[18px] dark:border-gray-800">
  <div class="flex flex-col xl:flex-row xl:items-center xl:justify-between">
    <p class="border-b border-gray-100 pb-3 text-center text-sm font-medium text-gray-500 xl:border-b-0 xl:pb-0 xl:text-left dark:border-gray-800 dark:text-gray-400">
      Showing <span x-text="startEntry"></span> to <span x-text="endEntry"></span> of
      <span x-text="totalEntries"></span> entries
    </p>

    <div class="flex items-center justify-center gap-0.5 pt-4 xl:justify-end xl:pt-0">
      <!-- Prev -->
      <button @click="prevPage()" :disabled="currentPage === 1"
        class="shadow-theme-xs mr-2.5 flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03]">
        <svg class="fill-current" width="20" height="20" viewBox="0 0 20 20" fill="none">…</svg>
      </button>

      <!-- Página 1 (siempre visible) -->
      <button @click="goToPage(1)"
        :class="currentPage === 1 ? 'bg-blue-500/[0.08] text-brand-500' : 'text-gray-700 dark:text-gray-400'"
        class="hover:text-brand-500 dark:hover:text-brand-500 flex h-10 w-10 items-center justify-center rounded-lg text-sm font-medium hover:bg-blue-500/[0.08]">1</button>

      <template x-if="currentPage > 3">
        <span class="hover:text-brand-500 dark:hover:text-brand-500 flex h-10 w-10 items-center justify-center rounded-lg hover:bg-blue-500/[0.08]">...</span>
      </template>

      <template x-for="page in pagesAroundCurrent" :key="page">
        <button @click="goToPage(page)"
          :class="currentPage === page ? 'bg-blue-500/[0.08] text-brand-500' : 'text-gray-700 dark:text-gray-400'"
          class="hover:text-brand-500 dark:hover:text-brand-500 flex h-10 w-10 items-center justify-center rounded-lg text-sm font-medium hover:bg-blue-500/[0.08]">
          <span x-text="page"></span>
        </button>
      </template>

      <template x-if="currentPage < totalPages - 2">
        <span class="hover:text-brand-500 dark:hover:text-brand-500 flex h-10 w-10 items-center justify-center rounded-lg text-sm font-medium text-gray-700 hover:bg-blue-500/[0.08] dark:text-gray-400">...</span>
      </template>

      <!-- Next -->
      <button @click="nextPage()" :disabled="currentPage === totalPages"
        class="shadow-theme-xs ml-2.5 flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03]">
        <svg class="fill-current" width="20" height="20" viewBox="0 0 20 20" fill="none">…</svg>
      </button>
    </div>
  </div>
</div>
```

| Pieza | Clases |
|---|---|
| Botón prev/next | `shadow-theme-xs flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03]` (+ `mr-2.5` / `ml-2.5`) |
| Nº de página (base) | `hover:text-brand-500 dark:hover:text-brand-500 flex h-10 w-10 items-center justify-center rounded-lg text-sm font-medium hover:bg-blue-500/[0.08]` |
| Nº activo | `bg-blue-500/[0.08] text-brand-500` |
| Nº inactivo | `text-gray-700 dark:text-gray-400` |

⚠️ El activo usa **`bg-blue-500/[0.08]`** — `blue-500` es el azul de Tailwind (`#3b82f6`), **no**
`brand-500` (`#465fff`). Inconsistente con el resto del sistema; probablemente quieras
`bg-brand-500/[0.08]`.

#### El estado Alpine

`data-tables.html` define su `dataTable()` **inline** (no usa `components/data-table.js`):

```js
get filteredData() {
  const searchLower = this.search.toLowerCase();
  return this.data
    .filter((person) =>
      person.name.toLowerCase().includes(searchLower) ||
      person.position.toLowerCase().includes(searchLower) ||
      person.office.toLowerCase().includes(searchLower))
    .sort((a, b) => {
      let modifier = this.sortDirection === "asc" ? 1 : -1;
      if (a[this.sortColumn] < b[this.sortColumn]) return -1 * modifier;
      if (a[this.sortColumn] > b[this.sortColumn]) return 1 * modifier;
      return 0;
    });
},
get paginatedData() {
  const start = (this.currentPage - 1) * this.perPage;
  return this.filteredData.slice(start, start + this.perPage);
},
get totalEntries() { return this.filteredData.length; },
get startEntry()   { return (this.currentPage - 1) * this.perPage + 1; },
get endEntry()     { const end = this.currentPage * this.perPage;
                     return end > this.totalEntries ? this.totalEntries : end; },
get totalPages()   { return Math.ceil(this.filteredData.length / this.perPage); },
get pagesAroundCurrent() {                       // ventana ±2 alrededor de la actual
  let pages = [];
  const startPage = Math.max(2, this.currentPage - 2);
  const endPage = Math.min(this.totalPages - 1, this.currentPage + 2);
  for (let i = startPage; i <= endPage; i++) pages.push(i);
  return pages;
},
goToPage(page) { if (page >= 1 && page <= this.totalPages) this.currentPage = page; },
nextPage()     { if (this.currentPage < this.totalPages) this.currentPage++; },
prevPage()     { if (this.currentPage > 1) this.currentPage--; },
sortBy(column) {
  if (this.sortColumn === column) {
    this.sortDirection = this.sortDirection === "asc" ? "desc" : "asc";
  } else { this.sortDirection = "asc"; this.sortColumn = column; }
},
```

Bugs reales: filtra por `name/position/office` pero ordena por cualquier columna (incluidos
`age`/`salary`, que son **strings** → orden lexicográfico incorrecto); `startEntry` no contempla el
caso 0 resultados; `perPage` llega como **string** desde el `<select>` (`$event.target.value`).

Existe además un `src/js/components/data-table.js` en el bundle (más simple, filtra por
`name/email/package`, `perPage: 5`, elipsis con ventana de 7) — **no lo usa esta página**.

---

## 3. GRÁFICOS

**Librería: ApexCharts** (`apexcharts/dist/apexcharts.common.js`), un módulo por gráfico en
`src/js/components/charts/chart-NN.js`. Sin wrapper propio: `new ApexCharts(el, options)` + `.render()`.

### 3.1 Contenedor — receta única

El HTML solo aporta un `<div>` vacío con id; **todo** lo demás va en JS.

```html
<div class="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
  <div class="px-6 py-5">
    <h3 class="text-base font-medium text-gray-800 dark:text-white/90">Line Chart 1</h3>
  </div>
  <div class="border-t border-gray-100 p-5 sm:p-6 dark:border-gray-800">
    <div class="custom-scrollbar max-w-full overflow-x-auto">
      <div id="chartThree" class="min-w-[1000px]"></div>
    </div>
  </div>
</div>
```

`min-w-[1000px]` + scroller es lo que evita que Apex se aplaste en móvil.

Patrón de montaje (idéntico en todos):
```js
const chartSelector = document.querySelectorAll("#chartThree");
if (chartSelector.length) {
  const chartThree = new ApexCharts(document.querySelector("#chartThree"), chartThreeOptions);
  chartThree.render();
}
// variante moderna: const el = document.querySelector("#chartForty"); if (!el) return;
```

### 3.2 Mapa id → módulo

| Página | id del `<div>` | Módulo |
|---|---|---|
| line-chart | `chartThree`, `chartEight`, `chartFourteen` | chart-03, chart-08, chart-14 |
| bar-chart | `chartOne`, `chartSix`, `chartThirty`, `chartThirtyTwo`, `chartThirtyFour`, `chartThirtyFive` | chart-01, 06, 30, 32, 34, 35 |
| pie-chart | `chartSeven`, `chartSixteen`, `chartThirtySix`, `chartFortyFour`, `chartFortyFive` | chart-07, 16, 36, 44, 45 |
| radar-chart | `chartThirtySeven`, `chartThirtyEight`, `chartThirtyNine` | chart-37, 38, 39 |
| radial-chart | `chartForty`, `chartFortyOne`, `chartFortyTwo`, `chartFortyThree` | chart-40, 41, 42, 43 |

(Los 45 módulos están en `scratchpad/charts/components__charts__chart-NN.js`.)

### 3.3 Paleta de los gráficos

| Uso | Colores |
|---|---|
| Área/línea 2 series | `["#465FFF", "#9CB9FF"]` (brand-500 + brand-300) |
| Barra simple | `["#465fff"]` |
| Barra apilada 4 series | `["#2a31d8", "#465fff", "#7592ff", "#c2d6ff"]` |
| Barra 2 series | `["#C2D6FF", "#465FFF"]` / `["#465FFF", "#E4E7EC"]` |
| Donut | `["#3641f5", "#7592ff", "#dde9ff"]` (brand-600/400/100) |
| Donut categórico | `["#9b8afb", "#fd853a", "#fdb022", "#32d583"]` |
| Radial multi | `["#161950", "#252DAE", "#465FFF", "#9CB9FF"]` (brand-950/800/500/300) |
| Barras horizontales seg. | `["#7592FF", "#7CD4FD", "#BDB4FE", "#FE9EFE", "#6FEAA6", "#D0D5DD"]` |
| Track radial / barra vacía | `#F2F4F7` (gray-100) · `#E4E7EC` (gray-200) |
| Rejilla | `borderColor: "#F2F4F7"` |
| Labels ejes | `#667085` (gray-500) / `#344054` (gray-700) / `#98A2B3` (gray-400) |

### 3.4 Convenciones comunes de `options`

- `chart.fontFamily: "Outfit, sans-serif"` — **en todos**.
- `chart.toolbar: { show: false }` — **en todos**.
- `dataLabels: { enabled: false }` — **en todos**.
- Ejes “limpios”: `axisBorder: { show: false }` + `axisTicks: { show: false }`.
- Rejilla: solo horizontales (`grid.xaxis.lines.show: false`, `grid.yaxis.lines.show: true`).
- Título Y neutralizado con `yaxis.title.style.fontSize: "0px"` (hack para reservar 0 espacio).
- Leyenda: `position: "top", horizontalAlign: "left"`, marcadores circulares
  (`markers: { size: 5, shape: "circle", radius: 999, strokeWidth: 0 }`).

### 3.5 Line/Area — `chart-03` (`#chartThree`) — LITERAL

```js
const chartThreeOptions = {
  series: [{
    name: "Sales",
    data: [180, 190, 170, 160, 175, 165, 170, 205, 230, 210, 240, 235]
  }, {
    name: "Revenue",
    data: [40, 30, 50, 40, 55, 40, 70, 100, 110, 120, 150, 140]
  }],
  legend: {
    show: false,
    position: "top",
    horizontalAlign: "left"
  },
  colors: ["#465FFF", "#9CB9FF"],
  chart: {
    fontFamily: "Outfit, sans-serif",
    height: 310,
    type: "area",
    toolbar: {
      show: false
    }
  },
  fill: {
    gradient: {
      enabled: true,
      opacityFrom: 0.55,
      opacityTo: 0
    }
  },
  stroke: {
    curve: "straight",
    width: ["2", "2"]
  },
  markers: {
    size: 0
  },
  labels: {
    show: false,
    position: "top"
  },
  grid: {
    xaxis: {
      lines: {
        show: false
      }
    },
    yaxis: {
      lines: {
        show: true
      }
    }
  },
  dataLabels: {
    enabled: false
  },
  tooltip: {
    x: {
      format: "dd MMM yyyy"
    }
  },
  xaxis: {
    type: "category",
    categories: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    axisBorder: {
      show: false
    },
    axisTicks: {
      show: false
    },
    tooltip: false
  },
  yaxis: {
    title: {
      style: {
        fontSize: "0px"
      }
    }
  }
};
```

**`chart-08` (`#chartEight`) es byte-a-byte idéntico salvo `stroke.curve: "smooth"`** (vs `"straight"`).
Esa es la única diferencia entre "Line Chart 1" y "Line Chart 2".

**`chart-14` (`#chartFourteen`)** — área con eje temporal. Diferencias:
```js
colors: ["#465FFF"],
chart: { fontFamily: "Outfit, sans-serif", height: 335, id: "area-datetime", type: "area", toolbar: { show: false } },
stroke: { curve: "straight", width: ["1", "1"] },
xaxis: { type: "datetime", tickAmount: 10, axisBorder: { show: false }, axisTicks: { show: false }, tooltip: false },
// series: [{ name: "Portfolio Performance", data }] con data = [[timestamp, valor], …] (224 puntos)
// resto (fill.gradient, grid, yaxis.title 0px, tooltip.x.format) idéntico a chart-03
```

### 3.6 Bar — `chart-01` (`#chartOne`) — LITERAL

```js
const chartOneOptions = {
  series: [{
    name: "Sales",
    data: [168, 385, 201, 298, 187, 195, 291, 110, 215, 390, 280, 112]
  }],
  colors: ["#465fff"],
  chart: {
    fontFamily: "Outfit, sans-serif",
    type: "bar",
    height: 180,
    toolbar: {
      show: false
    }
  },
  plotOptions: {
    bar: {
      horizontal: false,
      columnWidth: "39%",
      borderRadius: 5,
      borderRadiusApplication: "end"
    }
  },
  dataLabels: {
    enabled: false
  },
  stroke: {
    show: true,
    width: 4,
    colors: ["transparent"]
  },
  xaxis: {
    categories: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    axisBorder: {
      show: false
    },
    axisTicks: {
      show: false
    }
  },
  legend: {
    show: true,
    position: "top",
    horizontalAlign: "left",
    fontFamily: "Outfit",
    markers: {
      radius: 99
    }
  },
  yaxis: {
    title: false
  },
  grid: {
    yaxis: {
      lines: {
        show: true
      }
    }
  },
  fill: {
    opacity: 1
  },
  tooltip: {
    x: {
      show: false
    },
    y: {
      formatter: function (val) {
        return val;
      }
    }
  }
};
```

El truco de separación entre barras: `stroke: { show: true, width: 4, colors: ["transparent"] }`.
El redondeo solo arriba: `borderRadius: 5, borderRadiusApplication: "end"`.

### 3.7 Bar apilada — `chart-06` (`#chartSix`) — LITERAL (fragmentos clave)

```js
colors: ["#2a31d8", "#465fff", "#7592ff", "#c2d6ff"],
chart: {
  fontFamily: "Outfit, sans-serif",
  type: "bar",
  stacked: true,
  height: 315,
  toolbar: { show: false },
  zoom: { enabled: false }
},
plotOptions: {
  bar: {
    horizontal: false,
    columnWidth: "39%",
    borderRadius: 10,
    borderRadiusApplication: "end",
    borderRadiusWhenStacked: "last"
  }
},
legend: {
  show: true,
  position: "top",
  horizontalAlign: "left",
  fontFamily: "Outfit",
  fontSize: "14px",
  fontWeight: 400,
  markers: { size: 5, shape: "circle", radius: 999, strokeWidth: 0 },
  itemMargin: { horizontal: 10, vertical: 0 }
},
yaxis: { title: false },
grid: { yaxis: { lines: { show: true } } },
fill: { opacity: 1 },
tooltip: { x: { show: false }, y: { formatter: function (val) { return val; } } }
```

`borderRadiusWhenStacked: "last"` = solo la serie superior se redondea. **Esta `legend` es el bloque
canónico** — se repite igual en donut y otros.

### 3.8 Bar — variantes notables

**`chart-30` (`#chartThirty`)** — sparkline de barras tricolor, sin ejes:
```js
const darkCount = 14, lightCount = 14, grayCount = 14;
const totalBars = darkCount + lightCount + grayCount;
const colors = [...Array(darkCount).fill("#465FFF"), ...Array(lightCount).fill("#36BFFA"), ...Array(grayCount).fill("#E4E7EC")];
const options = {
  series: [{ data: Array(totalBars).fill(100) }],
  chart: {
    fontFamily: "Outfit, sans-serif", type: "bar", height: 32,
    sparkline: { enabled: true }, toolbar: { show: false }, animations: { enabled: false }
  },
  plotOptions: { bar: { horizontal: false, distributed: true, columnWidth: "70%", borderRadius: 1, borderRadiusApplication: "around" } },
  colors, dataLabels: { enabled: false },
  xaxis: { labels: { show: false }, axisBorder: { show: false }, axisTicks: { show: false } },
  yaxis: { show: false },
  grid: { show: false, padding: { top: 0, right: 0, bottom: 0, left: 0 } },
  tooltip: { enabled: false }, legend: { show: false }
};
```

**`chart-32` (`#chartThirtyTwo`)** — barra horizontal apilada tipo "meter", **con dark mode reactivo**:
```js
const getDarkMode = () => document.body.classList.contains("dark");
// …
plotOptions: { bar: { horizontal: true, barHeight: "32px", borderRadius: 4,
                      borderRadiusApplication: "around", borderRadiusWhenStacked: "all" } },
grid: { show: false, padding: { top: -30, bottom: -20, left: -10, right: 0 } },
stroke: { show: true, width: 2, colors: [getDarkMode() ? "#111827" : "#ffffff"] },
states: { hover: { filter: { type: "none" } }, active: { filter: { type: "none" } } },
// …
const observer = new MutationObserver(() => chart.updateOptions({
  stroke: { colors: [getDarkMode() ? "#111827" : "#ffffff"] }
}));
observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
```
Nota: `#111827` es el `gray-900` de Tailwind, **no** el `--color-gray-900` (`#101828`) del tema. Fuera de paleta.

**`chart-34` (`#chartThirtyFour`)** — barras horizontales con rejilla vertical:
```js
plotOptions: { bar: { horizontal: true, barHeight: "40%", borderRadius: 4,
                      borderRadiusApplication: "end", dataLabels: { position: "top" } } },
colors: ["#465FFF", "#E4E7EC"],
xaxis: { categories: [...], min: 0, max: 700, tickAmount: 7,
         labels: { style: { fontSize: "12px", colors: "#667085" } },
         axisBorder: { show: false }, axisTicks: { show: false } },
yaxis: { labels: { style: { fontSize: "12px", colors: "#344054" } } },
legend: { show: true, position: "top", horizontalAlign: "left",
          markers: { shape: "circle", size: 6 }, itemMargin: { horizontal: 12 },
          labels: { colors: "#344054" } },
grid: { borderColor: "#F2F4F7", strokeDashArray: 0,
        xaxis: { lines: { show: true } }, yaxis: { lines: { show: false } } },
fill: { opacity: 1 }, tooltip: { x: { show: true } }
```

**`chart-35` (`#chartThirtyFive`)** — barras con eje en %:
```js
plotOptions: { bar: { horizontal: false, columnWidth: "50%", endingShape: "rounded",
                      borderRadius: 4, borderRadiusApplication: "end" } },
stroke: { show: true, width: 4, colors: ["transparent"] },
colors: ["#C2D6FF", "#465FFF"],  // Light and dark blue
yaxis: { labels: { formatter: val => `${val}%`, style: { fontSize: "12px", colors: "#344054" } }, max: 100 },
tooltip: { y: { formatter: val => `${val}%` } },
legend: { show: false },
grid: { borderColor: "#F2F4F7", strokeDashArray: 0 }
```

### 3.9 Donut — `chart-07` (`#chartSeven`) — LITERAL

```js
const chartSevenOptions = {
  series: [45, 65, 25],
  colors: ["#3641f5", "#7592ff", "#dde9ff"],
  labels: ["Desktop", "Mobile", "Tablet"],
  chart: {
    fontFamily: "Outfit, sans-serif",
    type: "donut",
    width: 445,
    height: 290
  },
  plotOptions: {
    pie: {
      donut: {
        size: "65%",
        background: "transparent",
        labels: {
          show: true,
          value: {
            show: true,
            offsetY: 0
          }
        }
      }
    }
  },
  dataLabels: {
    enabled: false
  },
  tooltip: {
    enabled: false
  },
  stroke: {
    show: false,
    width: 4,
    // Creates a gap between the series
    colors: "transparent" // Gap color (use background color to make it seamless)
  },
  legend: {
    show: true,
    position: "bottom",
    horizontalAlign: "center",
    fontFamily: "Outfit",
    fontSize: "14px",
    fontWeight: 400,
    markers: {
      size: 5,
      shape: "circle",
      radius: 999,
      strokeWidth: 0
    },
    itemMargin: {
      horizontal: 10,
      vertical: 0
    }
  },
  responsive: [{
    breakpoint: 640,
    options: {
      chart: {
        width: 370,
        height: 290
      }
    }
  }]
};
```

**`chart-16` (`#chartSixteen`)** — donut con etiquetas centrales y dark mode (leído **una vez**, no reactivo):
```js
const isDarkMode = document.documentElement.classList.contains("dark");
// …
colors: ["#9b8afb", "#fd853a", "#fdb022", "#32d583"],
plotOptions: {
  pie: {
    donut: {
      lineCap: "smooth", size: "65%", background: "transparent",
      labels: {
        show: true,
        name:  { show: true, offsetY: 0,  color: isDarkMode ? "#ffffff" : "#1D2939", fontSize: "12px", fontWeight: "normal", text: "Total 135GB" },
        value: { show: true, offsetY: 10, color: isDarkMode ? "#1D2939" : "#667085", fontSize: "14px", formatter: () => "Used of 135 GB" },
        total: { show: true, label: "Total 135 GB", color: isDarkMode ? "#1D2939" : "#000000", fontSize: "24px", fontWeight: "bold" }
      }
    },
    expandOnClick: false
  }
},
legend: { …igual que chart-07 pero horizontalAlign: "left", itemMargin: { horizontal: 10, vertical: 6 } },
responsive: [{ breakpoint: 640, … }, { breakpoint: 375, … }, { breakpoint: 1500, … }]
```
⚠️ Bugs: `isDarkMode` mira `documentElement` mientras chart-32/37 miran `document.body`; y los
colores de `value`/`total` están **invertidos** (en dark pintan `#1D2939`, casi negro sobre negro).

### 3.10 Radar — `chart-37` (`#chartThirtySeven`) — LITERAL

Único patrón del set con **options como función de `isDark`** + `MutationObserver`. Es el modelo a copiar
si quieres dark mode reactivo:

```js
const getOptions = isDark => ({
  chart: {
    type: "radar",
    height: 320,
    toolbar: { show: false },
    fontFamily: "Outfit, sans-serif",
    background: "transparent"
  },
  series: [{ name: "Data", data: [9, 7, 3, 5, 3, 4, 6, 8] }],
  labels: ["Estonia", "Germany", "France", "Spain", "Italy", "Canada", "Japan", "Brazil"],
  colors: ["#465FFF"],
  fill: { opacity: 0.3 },
  stroke: { show: true, width: 3, colors: ["#465FFF"] },
  markers: {
    size: 4,
    colors: ["#465FFF"],
    strokeColors: isDark ? "#1D2939" : "#fff",
    strokeWidth: 2
  },
  dataLabels: { enabled: false },
  plotOptions: {
    radar: {
      polygons: {
        strokeColors:    isDark ? "#313D4F" : "#E4E7EC",
        connectorColors: isDark ? "#313D4F" : "#E4E7EC",
        fill: { colors: isDark ? ["#1e2d40", "#1a2535"] : ["#ffffff", "#ffffff"] }
      }
    }
  },
  yaxis: {
    show: true, min: 0, max: 9, tickAmount: 3,
    labels: { style: { fontSize: "11px", colors: "#98A2B3" }, formatter: val => val }
  },
  xaxis: {
    labels: { style: { fontSize: "13px", colors: Array(8).fill(isDark ? "#98A2B3" : "#344054") } }
  },
  legend: { show: false },
  tooltip: { y: { formatter: val => val } }
});

const isDark = () => document.body.classList.contains("dark");
const chart = new ApexCharts(el, getOptions(isDark()));
chart.render();
const observer = new MutationObserver(() => { chart.updateOptions(getOptions(isDark())); });
observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
```
`#313D4F`, `#1e2d40`, `#1a2535` son hex hardcodeados fuera de la paleta del tema.

### 3.11 Radial — `chart-40` (`#chartForty`) — LITERAL

```js
const options = {
  chart: {
    type: "radialBar",
    height: 300,
    toolbar: { show: false },
    fontFamily: "Outfit, sans-serif"
  },
  series: [62.25],
  colors: ["#465FFF"],
  plotOptions: {
    radialBar: {
      startAngle: 0,
      endAngle: 360,
      hollow: { size: "72%", background: "transparent" },
      track: { background: "#F2F4F7", strokeWidth: "100%", startAngle: 0, endAngle: 360 },
      dataLabels: {
        name:  { show: true, fontSize: "15px", fontWeight: "600", color: "#344054", offsetY: -4,  formatter: () => "Total" },
        value: { show: true, fontSize: "20px", fontWeight: "700", color: "#101828", offsetY: 16, formatter: val => `${val}%` }
      }
    }
  },
  stroke: { lineCap: "butt" },
  legend: { show: false },
  tooltip: { enabled: false }
};
```

### 3.12 Radial multi + tooltip custom con clases Tailwind — `chart-43` (`#chartFortyThree`)

Interesante: **inyecta CSS para neutralizar el tooltip de Apex** y renderiza el suyo con clases del sistema.

```js
const styleEl = document.createElement("style");
styleEl.textContent = `
  #chartFortyThree .apexcharts-tooltip {
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    padding: 0 !important;
  }
`;
document.head.appendChild(styleEl);

const dataLabels = ["Loans", "Mortgage", "Savings", "Credit Card"];
const dataValues = [20, 20, 20, 20];
const options = {
  chart: { type: "radialBar", height: 320, toolbar: { show: false }, fontFamily: "Outfit, sans-serif" },
  series: [80, 80, 80, 80],
  colors: ["#161950", "#252DAE", "#465FFF", "#9CB9FF"],
  plotOptions: {
    radialBar: {
      startAngle: 0, endAngle: 360,
      hollow: { margin: 0, size: "45%", background: "transparent" },
      track: { show: true, background: "#F2F4F7", strokeWidth: "100%", margin: 0 },
      dataLabels: { show: false }
    }
  },
  labels: dataLabels,
  stroke: { lineCap: "butt" },
  legend: {
    show: true, position: "left", verticalAlign: "middle", floating: false,
    markers: { shape: "circle", size: 6, offsetX: -2, strokeWidth: 0 },
    formatter: (seriesName, opts) => {
      const pct = dataValues[opts.seriesIndex];
      return `${seriesName} &nbsp;&nbsp; <strong>${pct}%</strong>`;
    },
    itemMargin: { vertical: 6 },
    labels: { colors: "#344054" },
    fontSize: "13px"
  },
  tooltip: {
    enabled: true,
    custom: ({ seriesIndex, w }) => {
      const label = w.globals.labels[seriesIndex];
      const pct = dataValues[seriesIndex];
      const color = w.globals.colors[seriesIndex];
      return `<div class="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800" style="font-family: Outfit, sans-serif; font-size: 13px;">
        <span style="width:10px;height:10px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0;"></span>
        <span class="text-gray-600 dark:text-gray-400">${label}:</span>
        <strong class="text-gray-900 dark:text-white">${pct}%</strong>
      </div>`;
    }
  }
};
```

Receta del tooltip custom (reutilizable):
`flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800`.

### 3.13 Dark mode en gráficos — resumen del estado real

**No hay una estrategia única.** Tres enfoques conviven:

| Enfoque | Módulos | Cómo |
|---|---|---|
| Ninguno (colores fijos) | 01, 03, 06, 07, 08, 14, 30, 34, 35, 40, 43 | Los labels quedan con el color por defecto de Apex |
| Leído 1 vez al montar | 16 | `document.documentElement.classList.contains("dark")` — **no reacciona** al toggle |
| Reactivo con observer | 32, 37 | `document.body.classList.contains("dark")` + `MutationObserver` sobre `body[class]` |

Si portas esto, unifica: **options como función de `isDark` + `MutationObserver`** (patrón de chart-37),
y decide de una vez si el flag va en `<html>` o en `<body>`.

---

## 4. MAPS (`maps.html`)

**Librería: Leaflet** (`leaflet/dist/leaflet-src.js` + `leaflet/dist/leaflet.css`), no ApexCharts.
(`vector-maps.html` — fuera de mi lote — usa `jsvectormap`.)

```html
<div id="mapLocationView" class="h-[300px] w-full"></div>
<!-- controles propios: #mapLocationZoomIn / #mapLocationZoomOut -->
```

```js
const map = L.map("mapLocationView", {
  center: [40.772, -74.43],
  zoom: 13,
  scrollWheelZoom: false,
  zoomControl: false,          // se sustituye por botones propios
  attributionControl: false
});
L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
}).addTo(map);
```

Tiles: **CARTO `light_all`** (solo tema claro — no hay swap a `dark_all`).
Marcadores: `L.divIcon` con HTML inline (círculo 40px, `border:1px solid #c7d7fe`, `background:#eff4ff`,
`color:#3538CD`; pastilla de label `background:#fff; color:#1d2939; border-radius:999px; padding:2px 10px;
font-size:11px; font-weight:500; box-shadow:0 2px 8px rgba(0,0,0,0.12)`). Todo con estilos inline,
**sin clases Tailwind** — es la parte menos integrada con el sistema.
Requiere el parche de iconos de webpack (`delete L.Icon.Default.prototype._getIconUrl` + `mergeOptions`).

---

## 5. Deuda / trampas al portar (checklist)

1. `dark:bg-dark-900` — **clase muerta**, presente en casi todos los inputs. Bórrala.
2. `focus:border-ring-brand-300` (file input) — clase inválida. Y `dark:text-gray-400 dark:text-white/90` duplicadas.
3. `class="f hover:border-brand-500 …"` — `f` suelta en el primer checkbox.
4. Radios con `type="checkbox"` — cámbialo a `type="radio"` + `name`.
5. Checkbox/radio **disabled** tienen el ternario invertido (marcado ⇄ desmarcado).
6. `dark:bg-[#171f2e]` (radio) y `#111827` (chart-32) — hex fuera de paleta.
7. Badges: mezcla `text-{sem}-600` y `-700`; warning en dark usa `-400` y una vez `dark:text-orange-400`.
8. Paginación activa usa `bg-blue-500/[0.08]` (azul Tailwind), no `brand-500`.
9. Dark mode de charts: `documentElement` vs `body`, reactivo vs no. Unifica.
10. `dataTable()` ordena `age`/`salary` como strings; `perPage` llega como string.
11. Los carets de sort nunca reflejan la dirección activa.
12. Sin `hover` de fila en las tablas — si lo quieres, no lo copies de aquí porque no existe.
13. `select` con el patrón `isOptionSelected`: el `:class` es `text-gray-800 dark:text-white/90` en
    form-elements y `text-gray-500 dark:text-gray-400` en form-layout/data-tables. Contradictorio.
