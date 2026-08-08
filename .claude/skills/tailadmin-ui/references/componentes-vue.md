# TailAdmin Vue — Referencia de convenciones de componentes

> Fuente analizada: `scratchpad/tailadmin-vue/` (`tailadmin-vue-pro-2.0.1`, versión `2.3.0`).
> Stack: Vue 3.5.13 + `<script setup>` + TypeScript 5.7 + Tailwind **v4** + Vite 6.
> Destino (Deasy): Vue 3.5 + `<script setup>` + Tailwind v4 pero **JavaScript**.
> Todo lo marcado 🟦 **[TS]** requiere adaptación a JS.

## 0. Corrección del conteo

El enunciado hablaba de "116 componentes en `src/components`". El conteo real:

| Ruta | `.vue` |
|---|---|
| `src/components/**` | **51** |
| `src/icons/**` | **47** (los 116 solo cuadran sumando iconos + vistas) |
| `src/views/**` | **17** ✔ |

Además, **no existen** las carpetas `src/components/ui/table` ni `charts` con más de 2 gráficos: el inventario real es más pequeño de lo anunciado. Carpetas reales: `common`, `ui`, `forms`, `tables`, `charts`, `layout`, `profile`, `ecommerce`.

⚠️ **`src/components/forms/FormElements/ToggleSwitch.vue` es un archivo de 0 bytes** (vacío). No hay componente toggle/switch que copiar.

---

## 1. Inventario de componentes

### `src/components/ui/` (9) — los primitivos reutilizables

| Componente | Qué hace | Props / slots / emits |
|---|---|---|
| `Button.vue` | Botón con variantes | 🟦 props: `size?: 'sm'\|'md'` (md), `variant?: 'primary'\|'outline'` (primary), `startIcon?: object`, `endIcon?: object`, `onClick?: () => void`, `className?: string`, `disabled?: boolean`. Slot default. **Sin `emits`** — el click va por prop `onClick` (anti-patrón React-ista, ver §2.4) |
| `Badge.vue` | Etiqueta/tag de color | 🟦 props: `variant?: 'light'\|'solid'` (light), `size?: 'sm'\|'md'` (md), `color?: 'primary'\|'success'\|'error'\|'warning'\|'info'\|'light'\|'dark'` (primary), `startIcon?`, `endIcon?`. Slot default |
| `Alert.vue` | Aviso con icono + link | 🟦 props: `variant: 'success'\|'error'\|'warning'\|'info'` (**requerida**), `title: string`, `message: string`, `showLink?` (false), `linkHref?` ('#'), `linkText?` ('Learn more'). Sin slots |
| `Avatar.vue` | Avatar con badge de estado | 🟦 props: `src: string`, `alt?` ('User Avatar'), `size?: 'xsmall'…'xxlarge'` (medium), `status?: 'online'\|'offline'\|'busy'\|'none'` (none) |
| `Modal.vue` | Shell de modal (backdrop + slot) | 🟦 props: `fullScreenBackdrop?: boolean`. Slot **nombrado** `body`. Emits: `close` |
| `YouTubeEmbed.vue` | iframe de YouTube con ratio | 🟦 props: `videoId: string`, `aspectRatio?: '16:9'\|'4:3'\|'21:9'\|'1:1'` (16:9), `title?`, `className?` |
| `images/ResponsiveImage.vue` | Imagen demo con `#pane`/`#ghostpane` | **Sin props** — imagen hardcodeada. Es una demo, no reutilizable |
| `images/TwoColumnImageGrid.vue` | Grid 2 col | **Sin props** — array hardcodeado |
| `images/ThreeColumnImageGrid.vue` | Grid 3 col | **Sin props** — array hardcodeado |

### `src/components/common/` (7)

| Componente | Qué hace | Props / slots / emits |
|---|---|---|
| `ComponentCard.vue` | Card con header (título+desc) y cuerpo | 🟦 props: `title: string`, `className?`, `desc?`. Slot default |
| `PageBreadcrumb.vue` | H2 + breadcrumb "Home > página" | 🟦 props: `pageTitle: string`. Breadcrumb **fijo de 2 niveles** (no genérico) |
| `DropdownMenu.vue` | Dropdown genérico con click-outside | **JS** props: `menuItems: Array` (`{label, to?, onClick?}`), `buttonClass`, `menuClass`, `itemClass` (todas String con default de clases). Slots nombrados: `icon`, `menu` |
| `ThemeToggler.vue` | Botón sol/luna dark mode | **JS**. Sin props. Consume `useTheme()` |
| `CountDown.vue` | Cuenta atrás a fecha hardcodeada | **JS**. Sin props (fecha `December 20, 2025` en el código) |
| `CommonGridShape.vue` | Dos SVG decorativos de fondo | Sin props |
| `v-click-outside.vue` | **Directiva** (no componente) en `.vue` con `<script>` sin template | `created(el, binding)` / `unmounted(el)`. Ver §2.6 — está **rota** |

### `src/components/forms/FormElements/` (10)

⚠️ **Clave: NO son componentes reutilizables, son páginas-demo.** Salvo `MultipleSelect` y `Dropzone`, todos son *showcases* con `ref` locales y markup repetido. No hay `<AppInput>`, `<AppSelect>`, `<AppCheckbox>` como tal — hay que **extraer** las clases.

| Componente | Qué hace | Props / emits |
|---|---|---|
| `DefaultInputs.vue` | Demo: text, select, password, date, time, card | Ninguno. `reactive({...})` local + flatpickr |
| `SelectInput.vue` | Demo: select simple + `MultipleSelect` | Ninguno |
| `CheckboxInput.vue` | Demo: 3 checkboxes (default/checked/disabled) | Ninguno |
| `InputGroup.vue` | Demo: email, teléfono con prefijo país, URL, copy | Ninguno |
| `InputState.vue` | Demo: estados error/success/disabled | Ninguno |
| `TextArea.vue` | Demo: textarea normal/disabled/error | Ninguno |
| `FileInput.vue` | Input file estilizado (**solo template**, sin `<script>`) | Ninguno |
| `MultipleSelect.vue` ✅ | **Multi-select real, reutilizable** | **JS** props: `options: Array` (req), `modelValue: Array` ([]). Emits: `update:modelValue`. Único con `v-model` |
| `Dropzone.vue` ✅ | Wrapper de dropzone.js | **JS** props: `uploadUrl: String` ('/upload'). `<style>` no-scoped global |
| `ToggleSwitch.vue` | **VACÍO (0 bytes)** | — |

### `src/components/layout/` (10) — ver §4

| Componente | Qué hace | Props / slots |
|---|---|---|
| `AdminLayout.vue` | Shell admin: sidebar + backdrop + header + slot | **JS**. Slot default. Consume `useSidebar()` |
| `FullScreenLayout.vue` | Shell auth/error: solo `<main><slot/></main>` | 🟦 `<script setup lang="ts">` **vacío** |
| `AppSidebar.vue` | Sidebar con grupos, submenús, colapso, hover | **JS**. `menuGroups` **hardcodeado en el componente** |
| `AppHeader.vue` | Header sticky: toggle, logo, search, theme, notifs, user | 🟦 |
| `Backdrop.vue` | Overlay móvil | 🟦 |
| `SidebarProvider.vue` | Solo llama `useSidebarProvider()` + slot | 🟦 |
| `ThemeProvider.vue` | `provide('theme')` + slot + **exporta `useTheme()`** | 🟦 — patrón raro, ver §4.3 |
| `SidebarWidget.vue` | Banner promo "Purchase Plan" | Sin props (descartable) |
| `header/HeaderLogo.vue` | Logo móvil | **JS** |
| `header/SearchBar.vue` | Input de búsqueda + atajo ⌘K | Solo template, **no funcional** |
| `header/UserMenu.vue` | Dropdown de usuario | **JS**. Datos hardcodeados ("Musharof") |
| `header/NotificationMenu.vue` | Dropdown notificaciones | **JS**. Array hardcodeado |

### `src/components/tables/` (1)

| Componente | Qué hace | Props |
|---|---|---|
| `basic-tables/BasicTableOne.vue` | Tabla de usuarios | **Sin props** — `users` hardcodeado dentro. **No hay `AppDataTable` genérico**: no existe abstracción de tabla, columnas ni paginación |

### `src/components/profile/` (4)

| Componente | Qué hace | Props / emits |
|---|---|---|
| `ProfileCard.vue` | Card de perfil + modal de edición | **JS**. Sin props, todo hardcodeado |
| `PersonalInfoCard.vue` | Info personal + modal | **JS**. Sin props. `isProfileInfoModal = ref(false)` |
| `AddressCard.vue` | Dirección + modal | **JS**. Sin props |
| `Modal.vue` | **Duplicado** de `ui/Modal.vue` sin `fullScreenBackdrop` | Slot `body`, emit `close`. Ver §2.7 |

### `src/components/charts/` (2) y `src/components/ecommerce/` (6)

| Componente | Qué hace | Props |
|---|---|---|
| `charts/LineChart/LineChartOne.vue` | Area chart ApexCharts | 🟦. Sin props, series hardcodeadas |
| `charts/BarChart/BarChartOne.vue` | Bar chart | **JS**. Sin props |
| `ecommerce/EcommerceMetrics.vue` | 2 tarjetas KPI | Sin props |
| `ecommerce/MonthlyTarget.vue` | RadialBar + `DropdownMenu` | 🟦 `<script setup lang="ts">` **pero props con Options API**: `defineProps({ value: { type: Number, default: 75.55 } })` — el **único** que mezcla los dos estilos |
| `ecommerce/MonthlySale.vue` | Bar chart mensual | **JS** |
| `ecommerce/StatisticsChart.vue` | Area chart | **JS** |
| `ecommerce/CustomerDemographic.vue` | Mapa jsvectormap | 🟦 |
| `ecommerce/RecentOrders.vue` | Tabla de pedidos | **JS** |

**Conclusión del inventario**: de 51 componentes, los realmente reutilizables (con props y sin datos hardcodeados) son ~**10**: `Button`, `Badge`, `Alert`, `Avatar`, `Modal`, `YouTubeEmbed`, `ComponentCard`, `PageBreadcrumb`, `DropdownMenu`, `MultipleSelect`. El resto son demos o piezas de layout.

---

## 2. Convenciones de código

### 2.1 Definición de props — 🟦 **[TS] tres estilos conviviendo**

**Estilo A — `withDefaults(defineProps<T>(), {...})`** (el dominante en `ui/`):

```ts
interface ButtonProps {
  size?: 'sm' | 'md'
  variant?: 'primary' | 'outline'
  startIcon?: object
  endIcon?: object
  onClick?: () => void
  className?: string
  disabled?: boolean
}

const props = withDefaults(defineProps<ButtonProps>(), {
  size: 'md',
  variant: 'primary',
  className: '',
  disabled: false,
})
```

🟦 **Adaptación a JS** — no hay type-only props; hay que usar el objeto runtime:

```js
const props = defineProps({
  size: { type: String, default: 'md' },        // 'sm' | 'md'
  variant: { type: String, default: 'primary' },// 'primary' | 'outline'
  startIcon: { type: [Object, Function], default: null },
  endIcon: { type: [Object, Function], default: null },
  className: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
})
```
> Nota: `startIcon?: object` es **incorrecto** incluso en TS — un componente Vue puede ser `Function` (functional) u `Object`. En JS conviene `[Object, Function]`. Y para validar variantes usa `validator: (v) => ['sm','md'].includes(v)`, que TS daba gratis.

**Estilo B — `defineProps<T>()` sin defaults** (`ComponentCard`, `PageBreadcrumb`, `ui/Modal`):
```ts
interface Props { title: string; className?: string; desc?: string }
defineProps<Props>()
```
⚠️ `ComponentCard` y `PageBreadcrumb` hacen `import { defineProps } from 'vue'` — **innecesario** (es macro del compilador) y genera warning. No copiar.

**Estilo C — objeto runtime** (todo lo `<script setup>` en JS: `DropdownMenu`, `MultipleSelect`, `Dropzone`, `MonthlyTarget`):
```js
const props = defineProps({
  options: { type: Array, required: true },
  modelValue: { type: Array, default: () => [] },
})
```
→ **Este es el estilo que Deasy debe usar en todos los casos.**

### 2.2 Slots

Uso muy limitado, dos patrones:
- **Slot default**: `Button`, `Badge`, `ComponentCard`, `AdminLayout`, `FullScreenLayout`, providers.
- **Slots nombrados**: solo **`Modal`** (`<slot name="body">`) y **`DropdownMenu`** (`<slot name="icon">`, `<slot name="menu">`, ambos **con fallback** dentro del slot).

**No usan** `slot props` / scoped slots en ninguna parte. No hay `useSlots()`, ni `$slots` condicional.

`DropdownMenu` sí muestra el patrón de fallback bien hecho:
```vue
<button @click="toggleDropdown" :class="buttonClass">
  <slot name="icon">
    <!-- icono por defecto si no se pasa slot -->
    <svg class="fill-current" width="24" height="24" …/>
  </slot>
</button>
```

### 2.3 v-model

**Solo `MultipleSelect.vue`** implementa `v-model`, y con el patrón **antiguo** (`modelValue` + `emit('update:modelValue')`), no con `defineModel()` de Vue 3.4+:

```js
const props = defineProps({ modelValue: { type: Array, default: () => [] } })
const emit = defineEmits(['update:modelValue'])

const selectedItems = ref(props.modelValue)   // ⚠️ ver nota

const toggleItem = (item) => {
  const index = selectedItems.value.findIndex((s) => s.value === item.value)
  if (index === -1) selectedItems.value.push(item)
  else selectedItems.value.splice(index, 1)
  emit('update:modelValue', selectedItems.value)
}
```
⚠️ **Bug a no replicar**: `ref(props.modelValue)` captura la referencia del array del padre y luego lo **muta in-place** (`push`/`splice`), así que el padre cambia aunque no escuche el emit; y no reacciona si el padre reemplaza `modelValue`. En Deasy: usar **`defineModel()`** (Vue 3.4+), que es una línea:
```js
const model = defineModel({ type: Array, default: () => [] })
```

El resto de inputs (`DefaultInputs`, etc.) usan `v-model` **solo contra `ref`/`reactive` locales** — no exponen nada al padre.

### 2.4 Emits

Casi inexistentes. Solo `Modal` (`defineEmits(['close'])`) y `MultipleSelect` (`update:modelValue`).

⚠️ **`Button` no emite `click`** — recibe `onClick` como prop y lo invoca a mano:
```ts
const onClick = () => {
  if (!props.disabled && props.onClick) props.onClick()
}
```
Es un calco de React. **En Deasy: no copiar** — usar `defineEmits(['click'])` o simplemente dejar que el listener nativo caiga por *fallthrough* de atributos. Ojo: como `Button` bindea `:class` en la raíz, un `class` del padre se **fusiona** correctamente (Vue une `class`), pero el prop `className` existe justo para eso, duplicando el mecanismo nativo.

### 2.5 Variantes: **objeto de clases + lookup** (nada de `cva`)

**No usan `class-variance-authority`, ni `clsx`, ni `tailwind-merge`.** El patrón es un objeto plano de strings de Tailwind indexado por la prop, resuelto de dos maneras:

**(a) Lookup directo en el template** (`Button`, `Alert`, `Avatar`):
```vue
<button
  :class="[
    'inline-flex items-center justify-center font-medium gap-2 rounded-lg transition',
    sizeClasses[size],
    variantClasses[variant],
    className,
    { 'cursor-not-allowed opacity-50': disabled },
  ]"
>
```
```ts
const sizeClasses = { sm: 'px-4 py-3 text-sm', md: 'px-5 py-3.5 text-sm' }
const variantClasses = {
  primary: 'bg-brand-500 text-white shadow-theme-xs hover:bg-brand-600 disabled:bg-brand-300',
  outline: 'bg-white text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 …',
}
```
> Los objetos de clases se declaran **fuera de cualquier `computed`, como const del módulo** — se evalúan una vez, no son reactivos (correcto: son constantes).

**(b) `computed` de lookup** (`Badge` — variantes anidadas 2 niveles, `YouTubeEmbed`):
```ts
const sizeClass = computed(() => sizeStyles[props.size])
const colorStyles = computed(() => variants[props.variant][props.color])
```

**(c) Objeto de condiciones booleanas** (`AppSidebar`, `BasicTableOne` para el status):
```vue
:class="[
  'rounded-full px-2 py-0.5 text-theme-xs font-medium',
  {
    'bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-500': user.status === 'Active',
    'bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400': user.status === 'Pending',
    'bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-500': user.status === 'Cancel',
  },
]"
```

⚠️ `Button.vue` importa `computed` y **nunca lo usa** (import muerto). Igual en `SelectInput.vue`.

### 2.6 Composables — **solo hay uno**

`src/composables/` contiene **un único archivo**: `useSidebar.ts`. No hay `useTheme` ahí (vive dentro de `ThemeProvider.vue`, §4.3), ni `useModal`, ni `useDropdown` — la lógica de "cerrar al hacer click fuera" está **copiada a mano 3 veces** (`MultipleSelect`, `UserMenu`, `NotificationMenu`) con `onMounted`/`onUnmounted` idénticos:

```js
const handleClickOutside = (event) => {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target)) closeDropdown()
}
onMounted(() => document.addEventListener('click', handleClickOutside))
onUnmounted(() => document.removeEventListener('click', handleClickOutside))
```
→ **Oportunidad clara para Deasy**: un `useClickOutside(elRef, cb)` en `shared/composables/`.

⚠️ La directiva `common/v-click-outside.vue` **está rota**: usa el hook `created` (Options API de directivas de **Vue 2**; en Vue 3 el hook equivalente es `mounted`/`beforeMount`), se registra vía un segundo `<script>` con `export default { directives: {...} }` **junto a `<script setup>`**, e importa `onMounted`/`onUnmounted` sin usarlos. No copiar.

### 2.7 Otras convenciones observadas

- **Formato** (`.prettierrc.json`): sin punto y coma, comillas simples, `printWidth: 100`. Pero `AppSidebar.vue` y `BasicTables.vue` usan **comillas dobles y `;`** → el formato no está aplicado de forma consistente.
- **Alias**: `@` → `./src` (en `vite.config.ts` + `tsconfig.app.json`). Igual que Deasy.
- **Imports de iconos**: barrel `src/icons/index.ts` que reexporta 47 iconos. Ojo: exporta **menos** de los que importa (`FolderIcon`, `HomeIcon`… sí; pero `BellIcon`/`BarChartIcon` sí y `LayoutDashboardIcon` sí — coherente salvo detalles). `AppSidebar` mezcla barrel (`from "../../icons"`) con import directo (`from "@/icons/BoxCubeIcon.vue"`).
- **Nombres de componentes**: PascalCase de archivo; en template se usan indistintamente `<AppSidebar/>` y `<app-sidebar />` (`AdminLayout` usa kebab).
- **`className` como prop**: 4 componentes (`Button`, `ComponentCard`, `YouTubeEmbed`) exponen `className?: string` — convención React. En Vue el `class` del padre ya cae por fallthrough.
- **Duplicación**: `ui/Modal.vue` y `profile/Modal.vue` son el mismo componente (el segundo sin `fullScreenBackdrop` y con clase `modal` extra).
- **Sin tests, sin Storybook, sin Pinia.** Estado global = `provide/inject`.

---

## 3. Código fuente de los componentes reutilizables

### 3.1 `ui/Button.vue` — íntegro

```vue
<template>
  <button
    :class="[
      'inline-flex items-center justify-center font-medium gap-2 rounded-lg transition',
      sizeClasses[size],
      variantClasses[variant],
      className,
      { 'cursor-not-allowed opacity-50': disabled },
    ]"
    @click="onClick"
    :disabled="disabled"
  >
    <span v-if="startIcon" class="flex items-center">
      <component :is="startIcon" />
    </span>
    <slot></slot>
    <span v-if="endIcon" class="flex items-center">
      <component :is="endIcon" />
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'   // ⚠️ import muerto

interface ButtonProps {
  size?: 'sm' | 'md'
  variant?: 'primary' | 'outline'
  startIcon?: object
  endIcon?: object
  onClick?: () => void
  className?: string
  disabled?: boolean
}

const props = withDefaults(defineProps<ButtonProps>(), {
  size: 'md',
  variant: 'primary',
  className: '',
  disabled: false,
})

const sizeClasses = {
  sm: 'px-4 py-3 text-sm',
  md: 'px-5 py-3.5 text-sm',
}

const variantClasses = {
  primary: 'bg-brand-500 text-white shadow-theme-xs hover:bg-brand-600 disabled:bg-brand-300',
  outline:
    'bg-white text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700 dark:hover:bg-white/[0.03] dark:hover:text-gray-300',
}

const onClick = () => {
  if (!props.disabled && props.onClick) {
    props.onClick()
  }
}
</script>
```
> Solo **2 variantes** (`primary`, `outline`) y **2 tamaños**. No hay `danger`, `ghost`, `link`, ni estado `loading`. Deasy's `AppButton` seguramente ya cubre más.

### 3.2 `ui/Badge.vue` — íntegro (el mejor ejemplo de variantes anidadas)

```vue
<template>
  <span :class="[baseStyles, sizeClass, colorStyles]">
    <span v-if="startIcon" class="mr-1"><component :is="startIcon" /></span>
    <slot></slot>
    <span v-if="endIcon" class="ml-1"><component :is="endIcon" /></span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type BadgeVariant = 'light' | 'solid'
type BadgeSize = 'sm' | 'md'
type BadgeColor = 'primary' | 'success' | 'error' | 'warning' | 'info' | 'light' | 'dark'

interface BadgeProps {
  variant?: BadgeVariant
  size?: BadgeSize
  color?: BadgeColor
  startIcon?: object
  endIcon?: object
}

const props = withDefaults(defineProps<BadgeProps>(), {
  variant: 'light',
  color: 'primary',
  size: 'md',
})

const baseStyles =
  'inline-flex items-center px-2.5 py-0.5 justify-center gap-1 rounded-full font-medium capitalize'

const sizeStyles = {
  sm: 'text-theme-xs',
  md: 'text-sm',
}

const variants = {
  light: {
    primary: 'bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400',
    success: 'bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500',
    error: 'bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-500',
    warning: 'bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-orange-400',
    info: 'bg-blue-light-50 text-blue-light-500 dark:bg-blue-light-500/15 dark:text-blue-light-500',
    light: 'bg-gray-100 text-gray-700 dark:bg-white/5 dark:text-white/80',
    dark: 'bg-gray-500 text-white dark:bg-white/5 dark:text-white',
  },
  solid: {
    primary: 'bg-brand-500 text-white dark:text-white',
    success: 'bg-success-500 text-white dark:text-white',
    error: 'bg-error-500 text-white dark:text-white',
    warning: 'bg-warning-500 text-white dark:text-white',
    info: 'bg-blue-light-500 text-white dark:text-white',
    light: 'bg-gray-400 dark:bg-white/5 text-white dark:text-white/80',
    dark: 'bg-gray-700 text-white dark:text-white',
  },
}

const sizeClass = computed(() => sizeStyles[props.size])
const colorStyles = computed(() => variants[props.variant][props.color])
</script>
```
🟦 En JS el `variants[props.variant][props.color]` es idéntico; solo cae el tipado. Añadir `validator` en las props para no romper con un color inexistente (en TS eso lo cubría el compilador; en JS `variants.light.foo` → `undefined` → clase vacía silenciosa).

### 3.3 Input de texto — **clase canónica** (extraída de `DefaultInputs.vue`)

No hay componente: esta es **la string de clases** que se repite en ~15 sitios. Es lo más valioso del repo.

```html
<label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">
  Input
</label>
<input
  type="text"
  v-model="formData.input"
  class="dark:bg-dark-900 h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
/>
```

Anatomía (útil para parametrizar un `AppInput` en Deasy):

| Rol | Clases |
|---|---|
| Base | `h-11 w-full rounded-lg border bg-transparent px-4 py-2.5 text-sm shadow-theme-xs` |
| Color normal | `border-gray-300 text-gray-800 placeholder:text-gray-400` |
| Focus normal | `focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10` |
| Dark normal | `dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800` |
| **Error** | `border-error-300 focus:border-error-300 focus:ring-error-500/10 dark:border-error-700 dark:focus:border-error-800` + `<p class="mt-1.5 text-theme-xs text-error-500">` |
| **Success** | `border-success-300 focus:border-success-300 focus:ring-success-500/10 dark:border-success-700 dark:focus:border-success-800` + `<p class="mt-1.5 text-theme-xs text-success-500">` |
| **Disabled** | `disabled:border-gray-100 disabled:placeholder:text-gray-300 dark:disabled:border-gray-800 dark:disabled:placeholder:text-white/15` + label a `text-gray-300 dark:text-white/15` |
| Con icono izq. | añade `pl-[62px]` + `<span class="absolute left-0 top-1/2 flex h-11 w-[46px] -translate-y-1/2 items-center justify-center border-r border-gray-200 dark:border-gray-800">` |
| Con icono der. | añade `pr-11` + `<span class="absolute right-4 top-1/2 -translate-y-1/2">` |

> ⚠️ `dark:bg-dark-900` se usa **en todos** los inputs pero **`--color-dark-900` NO existe en `@theme`** → es una clase muerta; la que aplica es `dark:bg-gray-900`. No arrastrar el error.
> `focus:outline-hidden` es sintaxis **Tailwind v4** (era `focus:outline-none` en v3).

### 3.4 Select

```html
<div class="relative z-20 bg-transparent">
  <select
    v-model="singleSelect"
    class="dark:bg-dark-900 h-11 w-full appearance-none rounded-lg border border-gray-300 bg-transparent bg-none px-4 py-2.5 pr-11 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
    :class="{ 'text-gray-800 dark:text-white/90': singleSelect }"
  >
    <option value="" disabled>Select Option</option>
    <option value="marketing" class="text-gray-700 dark:bg-gray-900 dark:text-gray-400">
      Marketing
    </option>
  </select>
  <span class="absolute z-30 text-gray-700 -translate-y-1/2 pointer-events-none right-4 top-1/2 dark:text-gray-400">
    <svg class="stroke-current" width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M4.79175 7.396L10.0001 12.6043L15.2084 7.396" stroke="" stroke-width="1.5"
            stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  </span>
</div>
```
Claves: `appearance-none bg-none pr-11` en el `<select>` + chevron absoluto con `pointer-events-none`; `<option>` necesita `dark:bg-gray-900` propio (el nativo no hereda). El truco `:class="{ 'text-gray-800…': valor }"` es para que el placeholder se vea gris.

### 3.5 Checkbox — patrón `sr-only` + caja pintada

```html
<label
  for="checkboxLabelOne"
  class="flex items-center text-sm font-medium text-gray-700 cursor-pointer select-none dark:text-gray-400"
>
  <div class="relative">
    <input type="checkbox" id="checkboxLabelOne" v-model="checkboxOne" class="sr-only" />
    <div
      :class="
        checkboxOne
          ? 'border-brand-500 bg-brand-500'
          : 'bg-transparent border-gray-300 dark:border-gray-700'
      "
      class="mr-3 flex h-5 w-5 items-center justify-center rounded-md border-[1.25px] hover:border-brand-500 dark:hover:border-brand-500"
    >
      <span :class="checkboxOne ? '' : 'opacity-0'">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M11.6666 3.5L5.24992 9.91667L2.33325 7" stroke="white"
                stroke-width="1.94437" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </span>
    </div>
  </div>
  Default
</label>
```
- El input real es `sr-only` (accesible pero invisible), la caja es un `div` que reacciona al `ref`.
- **Disabled**: caja a `border-gray-200 dark:border-gray-800`, check con `stroke-gray-200 dark:stroke-gray-800`, label a `text-gray-300 dark:text-gray-700`.
- ⚠️ En el ejemplo "Disabled" **la ternaria está invertida** (`checkboxThree ? transparent : brand`) — bug del demo.
- Existe además una variante CSS-only en `main.css`: `.tableCheckbox:checked ~ span span { @apply opacity-100 }`.

### 3.6 `ui/Modal.vue` — íntegro

```vue
<template>
  <div class="fixed inset-0 flex items-center justify-center overflow-y-auto z-99999">
    <div
      v-if="fullScreenBackdrop"
      class="fixed inset-0 h-full w-full bg-gray-400/50 backdrop-blur-[32px]"
      aria-hidden="true"
      @click="$emit('close')"
    ></div>
    <slot name="body"></slot>
  </div>
</template>

<script setup lang="ts">
interface ModalProps {
  fullScreenBackdrop?: boolean
}
defineProps<ModalProps>()
defineEmits(['close'])
</script>
```
Uso (de `PersonalInfoCard.vue`):
```vue
<Modal v-if="isProfileInfoModal" @close="isProfileInfoModal = false">
  <template #body>
    <div class="relative w-full max-w-[700px] rounded-3xl bg-white p-4 dark:bg-gray-900 lg:p-11">
      …
    </div>
  </template>
</Modal>
```
> Extremadamente mínimo: **sin `<Teleport>`, sin trap de foco, sin cierre con `Esc`, sin bloqueo de scroll del body, sin `role="dialog"`/`aria-modal`**. El `z-99999` es un token propio (`--z-index-99999`). El backdrop es **opcional** (`v-if`), así que sin la prop no hay forma de cerrar haciendo click fuera. El `AppModalShell` de Deasy casi seguro es superior — aquí solo vale la estética: `rounded-3xl`, `bg-gray-400/50 backdrop-blur-[32px]`.

### 3.7 `common/DropdownMenu.vue` — íntegro

```vue
<template>
  <div class="relative" v-click-outside="closeDropdown" ref="dropdown">
    <button @click="toggleDropdown" :class="buttonClass">
      <slot name="icon"><!-- svg de 3 puntos por defecto --></slot>
    </button>

    <div v-if="open" :class="menuClass">
      <slot name="menu">
        <template v-for="(item, index) in menuItems">
          <router-link
            v-if="item.to" :key="`router-${index}`" :to="item.to"
            @click.native="handleMenuItemClick(item.onClick)" :class="itemClass"
          >{{ item.label }}</router-link>
          <button
            v-else :key="`button-${index}`"
            @click="handleMenuItemClick(item.onClick)" :class="itemClass"
          >{{ item.label }}</button>
        </template>
      </slot>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import vClickOutside from './v-click-outside.vue'

const props = defineProps({
  menuItems: { type: Array, default: () => [] },
  buttonClass: { type: String, default: 'text-gray-500 dark:text-gray-400' },
  menuClass: {
    type: String,
    default:
      'absolute right-0 z-40 w-40 p-2 space-y-1 bg-white border border-gray-200 top-full rounded-2xl shadow-lg dark:border-gray-800 dark:bg-gray-dark',
  },
  itemClass: {
    type: String,
    default:
      'flex w-full px-3 py-2 font-medium text-left text-gray-500 rounded-lg text-theme-xs hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300',
  },
})

const open = ref(false)
const toggleDropdown = () => { open.value = !open.value }
const closeDropdown = () => { open.value = false }
const handleMenuItemClick = (callback) => {
  if (typeof callback === 'function') callback()
  closeDropdown()
}
</script>

<script>
export default { directives: { clickOutside: vClickOutside } }   // ⚠️ no funciona
</script>
```
⚠️ **Tres bugs**: (1) la directiva `v-click-outside` está rota (hook `created` de Vue 2) → el dropdown **no cierra al click fuera**; (2) `@click.native` está **eliminado en Vue 3**; (3) `<template v-for>` con `:key` en los hijos en vez de en el `<template>`. El patrón de dropdown que **sí funciona** en este repo es el de `UserMenu.vue`/`NotificationMenu.vue` (listener manual en `document`, §2.6).

**Clases útiles del menú flotante** (esto sí vale):
```
absolute right-0 z-40 w-40 p-2 space-y-1 bg-white border border-gray-200 top-full
rounded-2xl shadow-lg dark:border-gray-800 dark:bg-gray-dark
```

### 3.8 Tabla — `tables/basic-tables/BasicTableOne.vue`

No hay componente de tabla genérico. El **contenedor + estilos de celda** que se repiten:

```vue
<div class="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
  <div class="max-w-full overflow-x-auto custom-scrollbar">
    <table class="min-w-full">
      <thead>
        <tr class="border-b border-gray-200 dark:border-gray-700">
          <th class="px-5 py-3 text-left w-3/11 sm:px-6">
            <p class="font-medium text-gray-500 text-theme-xs dark:text-gray-400">User</p>
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
        <tr v-for="(user, index) in users" :key="index"
            class="border-t border-gray-100 dark:border-gray-800">
          <td class="px-5 py-4 sm:px-6">
            <span class="block font-medium text-gray-800 text-theme-sm dark:text-white/90">
              {{ user.name }}
            </span>
            <span class="block text-gray-500 text-theme-xs dark:text-gray-400">
              {{ user.role }}
            </span>
          </td>
          <!-- badge de estado inline: ver §2.5 (c) -->
        </tr>
      </tbody>
    </table>
  </div>
</div>
```
Convenciones: wrapper `rounded-xl border overflow-hidden`; scroll horizontal en un div con `custom-scrollbar` (utility propia); `th` → `text-theme-xs font-medium text-gray-500`; `td` → `px-5 py-4 sm:px-6`; avatares apilados con `flex -space-x-2` + `border-2 border-white dark:border-gray-900`.
⚠️ `w-3/11` / `w-2/11` **no son clases válidas** de Tailwind por defecto (v4 solo genera fracciones con denominadores comunes… `/11` no está) → sin efecto.
⚠️ Badge de estado **duplicado a mano** en vez de usar `<Badge>`, y con colores distintos (`text-success-700` vs `text-success-600` del Badge real).

---

## 4. Patrón de layout

### 4.1 Composición

```
App.vue
└── ThemeProvider        (provide('theme'))
    └── SidebarProvider  (provide(SidebarSymbol))
        └── RouterView
            └── [cada view importa su layout]
                ├── AdminLayout      → AppSidebar + Backdrop + AppHeader + <slot/>
                └── FullScreenLayout → <main><slot/></main>   (auth, 404)
```

⚠️ **El layout NO se resuelve por el router** (nada de `meta.layout` ni rutas anidadas): **cada vista importa y envuelve su layout a mano**. 15 de 17 vistas repiten:

```vue
<template>
  <AdminLayout>
    <PageBreadcrumb :pageTitle="currentPageTitle" />
    <div class="space-y-5 sm:space-y-6">
      <ComponentCard title="Basic Table 1">
        <BasicTableOne />
      </ComponentCard>
    </div>
  </AdminLayout>
</template>

<script setup>
import { ref } from "vue";
import PageBreadcrumb from "@/components/common/PageBreadcrumb.vue";
import AdminLayout from "@/components/layout/AdminLayout.vue";
import ComponentCard from "@/components/common/ComponentCard.vue";
import BasicTableOne from "@/components/tables/basic-tables/BasicTableOne.vue";
const currentPageTitle = ref("Basic Tables");
</script>
```
`App.vue`:
```vue
<template>
  <ThemeProvider>
    <SidebarProvider>
      <RouterView />
    </SidebarProvider>
  </ThemeProvider>
</template>
```

`AdminLayout.vue` completo (**es JS, copiable tal cual**):
```vue
<template>
  <div class="min-h-screen xl:flex">
    <app-sidebar />
    <Backdrop />
    <div
      class="flex-1 transition-all duration-300 ease-in-out"
      :class="[isExpanded || isHovered ? 'lg:ml-[290px]' : 'lg:ml-[90px]']"
    >
      <app-header />
      <div class="p-4 mx-auto max-w-(--breakpoint-2xl) md:p-6">
        <slot></slot>
      </div>
    </div>
  </div>
</template>

<script setup>
import AppSidebar from './AppSidebar.vue'
import AppHeader from './AppHeader.vue'
import { useSidebar } from '@/composables/useSidebar'
import Backdrop from './Backdrop.vue'
const { isExpanded, isHovered } = useSidebar()
</script>
```
> `max-w-(--breakpoint-2xl)` es sintaxis **Tailwind v4** (valor arbitrario desde variable de tema).
> Anchos mágicos: **290px** expandido / **90px** colapsado, duplicados entre `AdminLayout` (`ml-`) y `AppSidebar` (`w-`).

### 4.2 Estado del sidebar — **`provide/inject` con Symbol**, no un composable con estado de módulo

`src/composables/useSidebar.ts` (🟦 **[TS]** — el archivo empieza con **20 líneas comentadas** de una versión anterior):

```ts
import { ref, computed, onMounted, onUnmounted, provide, inject } from 'vue'
import type { Ref } from 'vue'

interface SidebarContextType {
  isExpanded: Ref<boolean>
  isMobileOpen: Ref<boolean>
  isHovered: Ref<boolean>
  activeItem: Ref<string | null>
  openSubmenu: Ref<string | null>
  toggleSidebar: () => void
  toggleMobileSidebar: () => void
  setIsHovered: (isHovered: boolean) => void
  setActiveItem: (item: string | null) => void
  toggleSubmenu: (item: string) => void
}

const SidebarSymbol = Symbol()

export function useSidebarProvider() {
  const isExpanded = ref(true)
  const isMobileOpen = ref(false)
  const isMobile = ref(false)
  const isHovered = ref(false)
  const activeItem = ref<string | null>(null)
  const openSubmenu = ref<string | null>(null)

  const handleResize = () => {
    const mobile = window.innerWidth < 768
    isMobile.value = mobile
    if (!mobile) isMobileOpen.value = false
  }

  onMounted(() => {
    handleResize()
    window.addEventListener('resize', handleResize)
  })
  onUnmounted(() => window.removeEventListener('resize', handleResize))

  const toggleSidebar = () => {
    if (isMobile.value) isMobileOpen.value = !isMobileOpen.value
    else isExpanded.value = !isExpanded.value
  }
  const toggleMobileSidebar = () => { isMobileOpen.value = !isMobileOpen.value }
  const setIsHovered = (value: boolean) => { isHovered.value = value }
  const setActiveItem = (item: string | null) => { activeItem.value = item }
  const toggleSubmenu = (item: string) => {
    openSubmenu.value = openSubmenu.value === item ? null : item
  }

  const context: SidebarContextType = {
    isExpanded: computed(() => (isMobile.value ? false : isExpanded.value)),
    isMobileOpen, isHovered, activeItem, openSubmenu,
    toggleSidebar, toggleMobileSidebar, setIsHovered, setActiveItem, toggleSubmenu,
  }

  provide(SidebarSymbol, context)
  return context
}

export function useSidebar(): SidebarContextType {
  const context = inject<SidebarContextType>(SidebarSymbol)
  if (!context) {
    throw new Error('useSidebar must be used within a component that has SidebarProvider as an ancestor')
  }
  return context
}
```

🟦 **Adaptación a JS**: borrar `interface SidebarContextType`, `import type { Ref }`, los `ref<string | null>(null)` → `ref(null)`, las anotaciones de parámetros y el `inject<T>()` → `inject(SidebarSymbol)`. La lógica queda idéntica. Recomendado: `const SidebarSymbol = Symbol('sidebar')` (con descripción, ayuda al debug).

⚠️ **Bugs a no replicar**:
- `isExpanded` se expone como **`computed` de solo lectura**, pero `AppSidebar.vue` hace `@mouseenter="!isExpanded && (isHovered = true)"` **y muta `isHovered` directamente** en vez de usar `setIsHovered` — los setters expuestos (`setIsHovered`, `setActiveItem`, `toggleSubmenu`) **no los usa nadie**.
- `AppSidebar` **reimplementa** `toggleSubmenu` localmente (con clave `` `${groupIndex}-${itemIndex}` ``) e ignora el del contexto, aunque escribe sobre el mismo `openSubmenu.value`.
- `activeItem`/`setActiveItem` son **código muerto** (la activación real se calcula con `route.path === path`).
- El breakpoint de "móvil" es **768px en el composable** pero **1024px (`lg:`) en las clases** y en `AppHeader.handleToggle` (`window.innerWidth >= 1024`) → **inconsistencia real** entre 768 y 1024.
- `onMounted`/`onUnmounted` dentro del provider: correcto porque `useSidebarProvider()` se llama desde `SidebarProvider.vue` (contexto de setup).

**Consumo** (`Backdrop.vue`, completo):
```vue
<template>
  <div v-if="isMobileOpen" class="fixed inset-0 bg-gray-900/50 z-9999 lg:hidden"
       @click="toggleMobileSidebar"></div>
</template>

<script setup lang="ts">
import { useSidebar } from '@/composables/useSidebar'
const { toggleMobileSidebar, isMobileOpen } = useSidebar()
</script>
```

**Sidebar colapsable con hover** (`AppSidebar.vue`) — el núcleo:
```vue
<aside
  :class="[
    'fixed mt-16 flex flex-col lg:mt-0 top-0 px-5 left-0 bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-900 h-screen transition-all duration-300 ease-in-out z-99999 border-r border-gray-200',
    {
      'lg:w-[290px]': isExpanded || isMobileOpen || isHovered,
      'lg:w-[90px]': !isExpanded && !isHovered,
      'translate-x-0 w-[290px]': isMobileOpen,
      '-translate-x-full': !isMobileOpen,
      'lg:translate-x-0': true,
    },
  ]"
  @mouseenter="!isExpanded && (isHovered = true)"
  @mouseleave="isHovered = false"
>
```
La condición `isExpanded || isHovered || isMobileOpen` se repite **7 veces** en el template para decidir si se muestra texto/logo/chevron. Menú declarado como **array de objetos dentro del propio componente**:
```js
const menuGroups = [
  {
    title: "Menu",
    items: [
      { icon: GridIcon, name: "Dashboard", subItems: [{ name: "Ecommerce", path: "/", pro: false }] },
      { icon: CalenderIcon, name: "Calendar", path: "/calendar" },
      { name: "Forms", icon: ListIcon, subItems: [{ name: "Form Elements", path: "/form-elements", pro: false }] },
    ],
  },
  { title: "Others", items: [ /* … */ ] },
]

const isActive = (path) => route.path === path
```
Animación de submenú con **hooks de transición JS** (height auto → scrollHeight):
```js
const startTransition = (el) => {
  el.style.height = "auto"
  const height = el.scrollHeight
  el.style.height = "0px"
  el.offsetHeight // force reflow
  el.style.height = height + "px"
}
const endTransition = (el) => { el.style.height = "" }
```
```vue
<transition @enter="startTransition" @after-enter="endTransition"
            @before-leave="startTransition" @after-leave="endTransition">
  <div v-show="isSubmenuOpen(groupIndex, index) && (isExpanded || isHovered || isMobileOpen)">
```
⚠️ Falta `overflow-hidden` y `transition-all` en el div → la animación de altura probablemente no se ve.

### 4.3 Dark mode — `provide/inject` + clase `.dark` en `<html>` + `localStorage`

🟦 **`ThemeProvider.vue`** usa un patrón inusual: **dos bloques `<script>`**, uno `setup` con el estado y otro normal que **exporta `useTheme()` desde el `.vue`**:

```vue
<template>
  <slot></slot>
</template>

<script setup lang="ts">
import { ref, provide, onMounted, watch, computed } from 'vue'

type Theme = 'light' | 'dark'

const theme = ref<Theme>('light')
const isInitialized = ref(false)
const isDarkMode = computed(() => theme.value === 'dark')

const toggleTheme = () => {
  theme.value = theme.value === 'light' ? 'dark' : 'light'
}

onMounted(() => {
  const savedTheme = localStorage.getItem('theme') as Theme | null
  const initialTheme = savedTheme || 'light' // Default to light theme
  theme.value = initialTheme
  isInitialized.value = true
})

watch([theme, isInitialized], ([newTheme, newIsInitialized]) => {
  if (newIsInitialized) {
    localStorage.setItem('theme', newTheme)
    if (newTheme === 'dark') document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
  }
})

provide('theme', { isDarkMode, toggleTheme })
</script>

<script lang="ts">
import { inject } from 'vue'

export function useTheme() {
  const theme = inject('theme')
  if (!theme) throw new Error('useTheme must be used within a ThemeProvider')
  return theme
}
</script>
```

Consumo (`ThemeToggler.vue`, **JS**):
```vue
<script setup>
import { useTheme } from '../layout/ThemeProvider.vue'   // ⚠️ importar una función de un .vue
const { toggleTheme } = useTheme()
</script>
```
Y el botón **no usa `isDarkMode` en JS** — alterna los dos SVG con **CSS puro**:
```html
<svg class="hidden dark:block" …/>   <!-- sol: visible en dark -->
<svg class="dark:hidden" …/>          <!-- luna: visible en light -->
```

⚠️ **Problemas** (relevantes si Deasy copia esto):
- **Clave `'theme'` como string**, no Symbol → colisionable. `useSidebar` sí usa Symbol: **incoherencia dentro del mismo repo**.
- `useTheme()` exportada desde un `.vue` en un `<script>` extra → funciona pero es frágil y confunde a los linters. **Debería vivir en `composables/useTheme.js`**.
- **FOUC**: la clase `.dark` solo se aplica en `onMounted` → primer frame siempre en claro. Lo correcto es un script inline en `index.html` antes de montar.
- **Ignora `prefers-color-scheme`** (`savedTheme || 'light'`).
- El `isInitialized` existe solo para no pisar `localStorage` antes de leerlo — se resolvería con `watch(..., { immediate: false })` y lectura síncrona.

**Tailwind v4** — el dark mode se declara en CSS, no en `tailwind.config.js` (que **no existe** en este repo):
```css
@import 'tailwindcss';
@custom-variant dark (&:is(.dark *));
```

### 4.4 Sistema de diseño (`src/assets/main.css`, 760 líneas)

**No hay `tailwind.config.js`** — todo el tema va en `@theme` (Tailwind v4):

```css
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@100..900&display=swap') layer(base);
@import 'tailwindcss';
@custom-variant dark (&:is(.dark *));

@theme {
  --font-*: initial;                 /* resetea la escala por defecto */
  --font-outfit: Outfit, sans-serif;

  --breakpoint-*: initial;
  --breakpoint-2xsm: 375px;  --breakpoint-xsm: 425px;  --breakpoint-3xl: 2000px;
  --breakpoint-sm: 640px;    --breakpoint-md: 768px;   --breakpoint-lg: 1024px;
  --breakpoint-xl: 1280px;   --breakpoint-2xl: 1536px;

  --text-title-2xl: 72px;  --text-title-2xl--line-height: 90px;
  --text-title-md: 36px;   --text-title-md--line-height: 44px;
  --text-theme-xl: 20px;   --text-theme-xl--line-height: 30px;
  --text-theme-sm: 14px;   --text-theme-sm--line-height: 20px;
  --text-theme-xs: 12px;   --text-theme-xs--line-height: 18px;

  --color-brand-25: #f2f7ff;  --color-brand-50: #ecf3ff;  --color-brand-500: #465fff;
  --color-brand-600: #3641f5; --color-brand-950: #161950;
  --color-gray-50: #f9fafb;   --color-gray-500: #667085;  --color-gray-900: #101828;
  --color-gray-dark: #1a2231;
  --color-success-500: #12b76a;  --color-error-500: #f04438;  --color-warning-500: #f79009;
  --color-blue-light-500: #0ba5ec;
  --color-theme-pink-500: #ee46bc;  --color-theme-purple-500: #7a5af8;

  --shadow-theme-xs: 0px 1px 2px 0px rgba(16, 24, 40, 0.05);
  --shadow-theme-sm: 0px 1px 3px 0px rgba(16,24,40,0.1), 0px 1px 2px 0px rgba(16,24,40,0.06);
  --shadow-theme-md: 0px 4px 8px -2px rgba(16,24,40,0.1), 0px 2px 4px -2px rgba(16,24,40,0.06);
  --shadow-theme-lg: 0px 12px 16px -4px rgba(16,24,40,0.08), 0px 4px 6px -2px rgba(16,24,40,0.03);
  --shadow-theme-xl: 0px 20px 24px -4px rgba(16,24,40,0.08), 0px 8px 8px -4px rgba(16,24,40,0.03);
  --shadow-focus-ring: 0px 0px 0px 4px rgba(70, 95, 255, 0.12);

  --z-index-1: 1;  --z-index-9: 9;  --z-index-99: 99;  --z-index-999: 999;
  --z-index-9999: 9999;  --z-index-99999: 99999;  --z-index-999999: 999999;
}
```

**Paleta**: escalas `brand` (índigo `#465fff`), `gray`, `success`, `error`, `warning`, `orange`, `blue-light`, cada una de 25→950. Colores tomados de **Untitled UI**.

**`@layer base`** — compatibilidad v3 + cursor + body:
```css
@layer base {
  *, ::after, ::before, ::backdrop, ::file-selector-button {
    border-color: var(--color-gray-200, currentColor);   /* v4 usa currentColor por defecto */
  }
  button:not(:disabled), [role='button']:not(:disabled) { cursor: pointer; }
  body { @apply relative font-normal font-outfit z-1 bg-gray-50; }
}
```

**`@utility`** (API nueva de v4, sustituye `@layer components`) — el sistema de menú:
```css
@utility menu-item {
  @apply relative flex items-center w-full gap-3 px-3 py-2 font-medium rounded-lg text-theme-sm;
}
@utility menu-item-active {
  @apply bg-brand-50 text-brand-500 dark:bg-brand-500/[0.12] dark:text-brand-400;
}
@utility menu-item-inactive {
  @apply text-gray-700 hover:bg-gray-100 group-hover:text-gray-700 dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-gray-300;
}
@utility menu-item-icon-active { @apply text-brand-500 dark:text-brand-400; }
@utility menu-item-icon-inactive {
  @apply text-gray-500 group-hover:text-gray-700 dark:text-gray-400 dark:group-hover:text-gray-300;
}
@utility menu-dropdown-item {
  @apply relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-theme-sm font-medium;
}
@utility menu-dropdown-item-active { @apply bg-brand-50 text-brand-500 dark:bg-brand-500/[0.12] dark:text-brand-400; }
@utility menu-dropdown-badge { @apply block rounded-full px-2.5 py-0.5 text-xs font-medium uppercase text-brand-500 dark:text-brand-400; }

@utility no-scrollbar {
  &::-webkit-scrollbar { display: none; }
  -ms-overflow-style: none;
  scrollbar-width: none;
}
@utility custom-scrollbar {
  &::-webkit-scrollbar { @apply size-1.5; }
  &::-webkit-scrollbar-track { @apply rounded-full; }
  &::-webkit-scrollbar-thumb { @apply bg-gray-200 rounded-full dark:bg-gray-700; }
}
```
Utilities completas: `menu-item{,-active,-inactive}`, `menu-item-icon{,-active,-inactive}`, `menu-item-arrow{,-active,-inactive}`, `menu-dropdown-item{,-active,-inactive}`, `menu-dropdown-badge{,-active,-inactive}`, `no-scrollbar`, `custom-scrollbar`.

**El resto de `main.css` (~430 líneas)** son overrides de terceros con `!` (importante para Deasy si adopta alguna lib): `.apexcharts-*` (tooltip, legend, gridline), `.jvm-*` (jsvectormap), `.swiper-button-*`, `.flatpickr-*` (el bloque más largo, ~100 líneas), `.dropzone` (además dentro de `Dropzone.vue` en `<style>` **no scoped**, con hex hardcodeados `#465fff`, `#d0d5dd`).
⚠️ `.flatpickr-calendar { @apply … bg-black … }` — `bg-black` en modo claro parece un bug.
⚠️ Hay CSS **muerto**: `.sidebar:hover .menu-item-text { display: inline }` etc. — ningún elemento tiene la clase `sidebar` (el sidebar real usa `<aside>` sin clase). Es un resto de la versión HTML del template.

---

## 5. Router

`src/router/index.ts` — 🟦 **[TS]** pero sin tipos propios (renombrar a `.js` funciona quitando nada).

```ts
import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior(to, from, savedPosition) {
    return savedPosition || { left: 0, top: 0 }
  },
  routes: [
    {
      path: '/',
      name: 'Ecommerce',
      component: () => import('../views/Ecommerce.vue'),
      meta: { title: 'eCommerce Dashboard' },
    },
    {
      path: '/form-elements',
      name: 'Form Elements',
      component: () => import('../views/Forms/FormElements.vue'),
      meta: { title: 'Form Elements' },
    },
    // … 17 rutas planas
  ],
})

export default router

router.beforeEach((to, from, next) => {
  document.title = `Vue.js ${to.meta.title} | TailAdmin - Vue.js Tailwind CSS Dashboard Template`
  next()
})
</script>
```

Convenciones:
- **Todas las rutas planas** (sin `children`, sin rutas anidadas) → por eso el layout se importa en cada vista (§4.1).
- **Lazy loading siempre**: `component: () => import('../views/…')`. Rutas relativas `../views/…`, **no** el alias `@/`.
- `name` en **Title Case con espacios** (`'Form Elements'`, `'Basic Tables'`, `'404 Error'`) — inusual; complica `router.push({ name: … })`.
- **`meta` solo tiene `title`** (string). No hay `meta.requiresAuth`, `meta.layout`, `meta.roles`, ni guard de autenticación alguno. `/signin` y `/signup` son rutas normales.
- El único guard es un `beforeEach` que fija `document.title`, y está **declarado después de `export default router`** (funciona por hoisting del `const`, pero es raro).
- ⚠️ **Sin `catch-all`** (`/:pathMatch(.*)*`) → la vista `FourZeroFour.vue` solo es alcanzable navegando a `/error-404` a mano; una URL inexistente da página en blanco.
- ⚠️ `meta.title` sin declarar en `RouteMeta` → en TS estricto `to.meta.title` sería `unknown`. En JS este problema desaparece.
- ⚠️ 2 rutas (`/line-chart`, `/bar-chart`) **no tienen `meta`** → `document.title` = "Vue.js undefined | …".

**Para Deasy**: el router existente ya usa `meta` (p. ej. `meta.blockedForAdmin`) y rutas con nombre — no hay nada que importar de aquí; el patrón de TailAdmin es **más pobre** que el actual.

---

## 6. Dependencias externas

### `dependencies`

| Paquete | Versión | Para qué se usa | ¿Dónde? |
|---|---|---|---|
| `vue` | `^3.5.13` | Framework | — |
| `vue-router` | `^4.5.0` | Router | `src/router/index.ts` |
| `apexcharts` | `^4.4.0` | Motor de gráficos | peer de `vue3-apexcharts` |
| `vue3-apexcharts` | `^1.8.0` | Wrapper Vue. **Registrado global** (`app.use(VueApexCharts)`) **y además importado localmente** en cada chart (redundante) | `LineChartOne`, `BarChartOne`, `MonthlyTarget`, `MonthlySale`, `StatisticsChart` |
| `jsvectormap` | `^1.6.0` | Mapa mundial de clientes. CSS en `main.ts`, mapa `jsvectormap/dist/maps/world` | `ecommerce/CustomerDemographic.vue` (**único uso**) |
| `flatpickr` | `^4.6.13` | Date/time picker | `DefaultInputs.vue` (**único uso**) |
| `vue-flatpickr-component` | `^11.0.5` | Wrapper Vue de flatpickr (`<flat-pickr v-model :config>`) | `DefaultInputs.vue` |
| `swiper` | `^11.2.1` | Carrusel. **CSS importado en `main.ts`** (`swiper/css`, `/navigation`, `/pagination`) y estilado en `main.css` (`.stocks-slider-outer`) pero ⚠️ **NINGÚN componente lo importa** → **dependencia muerta** en esta build |
| `dropzone` | `^6.0.0-beta.2` | Subida drag&drop (⚠️ **beta**) | `forms/FormElements/Dropzone.vue` |
| `lucide-vue-next` | `^0.474.0` | Librería de iconos | ⚠️ **Sin uso** — los 47 iconos son SVG inline propios en `src/icons/`. **Dependencia muerta** |
| `@fullcalendar/core` + `daygrid` + `interaction` + `list` + `timegrid` + `vue3` | `^6.1.15` (×6) | Calendario | `views/Others/Calendar.vue` |
| `vue-kanban` | `^1.8.0` | Tablero kanban | ⚠️ **Sin uso** en esta build (vista Pro no incluida). **Muerta** |
| `vuedraggable` | `^4.1.0` | Drag & drop de listas | ⚠️ **Sin uso**. **Muerta** |
| `vuevectormap` | `^2.0.1` | Wrapper Vue de jsvectormap | ⚠️ **Sin uso** — `CustomerDemographic` usa `jsvectormap` directo. **Muerta** |
| `@tailwindcss/forms` | `^0.5.10` | Reset de formularios | ⚠️ **No se carga** — `main.css` no tiene `@plugin "@tailwindcss/forms"`. **Muerta** |
| `@tailwindcss/typography` | `^0.5.16` | Clases `prose` | ⚠️ **No se carga** ni se usa `prose`. **Muerta** |

### `devDependencies` (relevantes)

| Paquete | Versión | Nota |
|---|---|---|
| `vite` | `^6.0.11` | + `@vitejs/plugin-vue` `^5.2.1`, `@vitejs/plugin-vue-jsx` `^4.1.1` (JSX **sin usar**), `vite-plugin-vue-devtools` `^7.7.0` |
| `tailwindcss` | `^4.0.0` | v4 vía PostCSS: `@tailwindcss/postcss` `^4.0.0` en `postcss.config.js`. **No hay `tailwind.config.js`** |
| `typescript` | `~5.7.3` | + `vue-tsc` `^2.2.0` (`npm run type-check`) |
| `eslint` | `^9.18.0` | Flat config en **`eslint.config.ts`** con `defineConfigWithVueTs` + `pluginVue.configs['flat/essential']` + `vueTsConfigs.recommended` + `skipFormatting` |
| `prettier` | `^3.4.2` | `semi: false`, `singleQuote: true`, `printWidth: 100` |
| `sass-embedded` | `^1.83.4` | ⚠️ **Sin uso** — no hay ningún `.scss` ni `lang="scss"`. **Muerta** |
| `npm-run-all2` | `^7.0.2` | `build` = `run-p type-check "build-only {@}"` |
| `jiti` | `^2.4.2` | Permite `eslint.config.ts` |

**Resumen para Deasy**: de 20 dependencias de producción, **9 están muertas** (`lucide-vue-next`, `swiper`, `vue-kanban`, `vuedraggable`, `vuevectormap`, `@tailwindcss/forms`, `@tailwindcss/typography` + `sass-embedded` en dev). Solo son necesarias de verdad: `vue`, `vue-router`, `apexcharts`+`vue3-apexcharts`, `flatpickr`+`vue-flatpickr-component`, `jsvectormap`, `dropzone`, `@fullcalendar/*`. **No copiar el `package.json`.**

---

## 7. Recomendaciones para Deasy

### Qué merece la pena copiar
1. **El bloque `@theme` de `main.css`** — escalas de color completas (25→950), `--shadow-theme-*`, `--text-theme-*`. Es la parte más madura y encaja con la deuda conocida de `tailwind.css`/`theme.css` (§3.4 del plan de refactor: dos juegos de tokens `--deasy-*`/`--brand-*`). Ojo: TailAdmin también usa `--color-brand-*`, así que **puede colisionar** con el juego `--brand-*` existente — decidir cuál gana antes de mezclar.
2. **Las strings de clases de inputs/select/checkbox/tabla** (§3.3–3.5, §3.8) — el verdadero valor del repo, ya que los componentes de formulario no existen como tales.
3. **El patrón "objeto de variantes + lookup"** de `Badge`/`Button` (§2.5) — simple, sin dependencias, traducible a JS 1:1.
4. **`@utility` de Tailwind v4** para `menu-item*` y `custom-scrollbar`/`no-scrollbar`.
5. **`useSidebarProvider`/`useSidebar` con `provide/inject` + Symbol** (§4.2) — buen esqueleto, corrigiendo el breakpoint 768 vs 1024 y quitando el código muerto.

### Qué NO copiar
- `Button` con prop `onClick` en vez de emit; props `className` (§2.4).
- `v-click-outside.vue` (roto, Vue 2) y `DropdownMenu` (`@click.native` eliminado en Vue 3) — usar el patrón de `UserMenu` o un `useClickOutside` propio (§2.6).
- `ui/Modal` — sin Teleport/foco/Esc/aria. `AppModalShell` de Deasy es mejor punto de partida; tomar solo la estética.
- `MultipleSelect` con `ref(props.modelValue)` mutado in-place → usar `defineModel()` (§2.3).
- `useTheme()` exportada desde un `.vue`, clave `'theme'` como string, y el FOUC de aplicar `.dark` en `onMounted` (§4.3).
- El layout resuelto por importación manual en cada vista (§4.1) — Deasy ya lo hace por router.
- `dark:bg-dark-900` (token inexistente), `w-3/11` (clase inválida), y las 9 deps muertas.

### Checklist de conversión TS → JS
| En TS | En JS |
|---|---|
| `<script setup lang="ts">` | `<script setup>` |
| `interface Props {…}` + `withDefaults(defineProps<Props>(), {…})` | `defineProps({ x: { type: String, default: 'md', validator: … } })` |
| `type Theme = 'light' \| 'dark'` | comentario + `validator` |
| `ref<string \| null>(null)` | `ref(null)` |
| `import type { Ref } from 'vue'` | eliminar |
| `inject<SidebarContextType>(Sym)` | `inject(Sym)` |
| `localStorage.getItem('theme') as Theme \| null` | `localStorage.getItem('theme')` |
| `const colors = [...] as const` | `const colors = [...]` |
| `countryCodes[k as keyof typeof countryCodes]` | `countryCodes[k]` |
| `interface Props` con `startIcon?: object` | `{ type: [Object, Function], default: null }` |
| `eslint.config.ts` / `vue-tsc --build` / `env.d.ts` / `vue.shims.d.ts` / `tsconfig*.json` | no aplican |

Además, al pasar a JS **se pierden** las garantías que TS daba gratis: que `variant`/`color`/`size` sean valores válidos del objeto de variantes. Compensar con `validator` en `defineProps` (o el lookup devolverá `undefined` → clase vacía sin aviso).
