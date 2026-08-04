# TailAdmin PRO — Shell de layout y patrones de página

Fuente: 87 HTML estáticos de `demo.tailadmin.com` (Alpine.js + Tailwind v4).
**Aviso**: el mirror sólo trae HTML. `style.css` **no está**, así que las clases de componente
(`menu-item-active`, `shadow-theme-lg`, `text-theme-sm`…) se documentan por **uso y contrato**,
no por su definición CSS. Ver §7 para el inventario de lo que ese CSS debe proveer.

Tailwind v4: `max-w-(--breakpoint-2xl)` es sintaxis v4 (variable CSS), no `max-w-screen-2xl`.

---

## 1. Shell de layout

### 1.1 Esqueleto canónico

Los 87 ficheros comparten el mismo esqueleto, delimitado por comentarios `<!-- ===== X ===== -->`
(útiles como anclas de parseo). Orden idéntico en `index.html` y en `layout-one..six`:

```
<body x-data="{...}" :class="{'dark bg-gray-900': darkMode === true}">
  Preloader
  <div class="flex h-screen overflow-hidden">            <!-- Page Wrapper -->
    <aside class="sidebar ...">                          <!-- Sidebar -->
    <div class="relative flex flex-1 flex-col overflow-x-hidden overflow-y-auto">
      <div>  <!-- Small Device Overlay -->
      <main>
        <header class="sticky top-0 z-99999 ...">
        <div class="mx-auto max-w-(--breakpoint-2xl) p-4 pb-20 md:p-6 md:pb-6">  <!-- página -->
      </main>
    </div>
  </div>
</body>
```

Clases literales de cada pieza:

| Pieza | Clases |
|---|---|
| Page wrapper | `flex h-screen overflow-hidden` |
| Content area | `relative flex flex-1 flex-col overflow-x-hidden overflow-y-auto` |
| Overlay móvil | `fixed z-50 h-screen w-full bg-gray-900/50` + `:class="sidebarToggle ? 'block xl:hidden' : 'hidden'"` |
| Contenedor de página | `mx-auto max-w-(--breakpoint-2xl) p-4 pb-20 md:p-6 md:pb-6` |
| Preloader | `fixed left-0 top-0 z-999999 flex h-screen w-screen items-center justify-center bg-white dark:bg-black` (spinner: `h-16 w-16 animate-spin rounded-full border-4 border-solid border-brand-500 border-t-transparent`) |

> El scroll **no** lo lleva el `<body>` sino el *content area* (`overflow-y-auto`). El wrapper es
> `h-screen overflow-hidden`. Por eso el header `sticky top-0` pega respecto al content area.

### 1.2 Sidebar: anchos y responsive

```html
<aside
  :class="sidebarToggle ? 'translate-x-0 xl:w-[90px]' : '-translate-x-full'"
  class="sidebar fixed top-0 left-0 z-9999 flex h-screen w-[290px] flex-col overflow-y-auto
         border-r border-gray-200 bg-white px-5 transition-all duration-300
         xl:static xl:translate-x-0 dark:border-gray-800 dark:bg-black"
  @click.outside="if (window.innerWidth < 1280) sidebarToggle = false"
>
```

- **Expandido**: `w-[290px]`. **Colapsado (rail)**: `xl:w-[90px]`.
- **Breakpoint único: `xl` (1280px)**. No `lg`. El `@click.outside` lo confirma en JS
  (`window.innerWidth < 1280`).
- **Patrón responsive**: es la **misma** `<aside>` en ambos modos, no hay drawer separado.
  - `< xl`: `fixed` + `-translate-x-full` (fuera de pantalla) → `translate-x-0` (drawer entrante).
    El overlay `bg-gray-900/50` sólo se pinta en `block xl:hidden`.
  - `≥ xl`: `xl:static xl:translate-x-0` — deja de ser drawer, entra en el flujo flex.
- **`sidebarToggle` tiene doble significado**, según el ancho:
  - `< xl`: **abrir/cerrar** el drawer.
  - `≥ xl`: **colapsar/expandir** a rail de 90px.
- `z-9999` en el aside, `z-99999` en el header, `z-999999` en el preloader (escala custom v4).

### 1.3 Header sticky

```html
<header x-data="{menuToggle: false}"
  class="sticky top-0 z-99999 flex w-full border-gray-200 bg-white xl:border-b
         dark:border-gray-800 dark:bg-gray-900">
  <div class="flex grow flex-col items-center justify-between xl:flex-row xl:px-6">
```

- El borde inferior sólo existe en `xl:border-b`; por debajo lo lleva la fila interna.
- `flex-col` → `xl:flex-row`: en móvil el header se apila en dos filas y la segunda
  (acciones) se colapsa tras `menuToggle`.

### 1.4 Diferencias entre `layout-one..six`

Los seis comparten esqueleto, header y `darkMode`. **Lo único que cambia es el árbol de
navegación del sidebar.** Matriz de clases (recuento con límites de palabra):

| clase | index | L1 | L2 | L3 | L4 | L5 | L6 |
|---|---|---|---|---|---|---|---|
| `menu-item` | 17 | 9 | 0 | 0 | 0 | 0 | 0 |
| `menu-dropdown-item` | 84 | 45 | 0 | 0 | 0 | 0 | 0 |
| `docs-menu-item` | 0 | 0 | 0 | 24 | 0 | 0 | 0 |
| `nav-icon-item` | 0 | 0 | 0 | 0 | 0 | 0 | 11 |

| | Nav | Estado Alpine del `<nav>` | Aside |
|---|---|---|---|
| **layout-one** | Menú clásico **de 3 niveles**: item → dropdown → sub-dropdown | `{selected: 'Dashboard', subSelected: ''}` (**sin `$persist`**) | `bg-white dark:bg-black`, `px-5`, `top-0`, colapsa a `xl:w-[90px]` |
| **layout-two** | Menú **píldora**, 2 niveles, **sin clases de componente** — todo Tailwind inline | `{selected: 'Dashboard'}` | `bg-gray-50 dark:bg-gray-900`, añade `:data-collapsed="sidebarToggle"`, colapsa a 90px |
| **layout-three** | **Docs**: lista plana por secciones (Get Started / Components / API Reference), sin dropdowns. Selector de versión (`v2.0.8-alpha`) | `{ selected: $persist('Accordion') }` | `top-16`, `bg-white`, **no colapsa a rail**; usa `docsSidebarOpen` con `:style="width:0"` |
| **layout-four** | **Docs con acordeón**: 7 secciones plegables + **buscador dentro del sidebar** (`Search the docs`, `h-9`) | `{ selected: $persist('InstallationGuide'), openSection: 'GetStarted' }` — **una** sección abierta | `top-16`, `bg-gray-50` |
| **layout-five** | Docs con acordeón **multi-abierto** (`openSection` es un string CSV: `'GetStarted,Components'`, se testea con `.includes()`) | `{ selected: $persist('FrameworkGuides'), openSection: 'GetStarted,Components' }` | `top-0`, `bg-gray-50` |
| **layout-six** | **Rail de iconos puro** `w-[92px]` + tooltip en hover; logo en cuadro `bg-brand-500 rounded-xl` | `x-data="{ activeNav: 'dashboard' }"` **en el `<aside>`** | `w-[92px] items-center pt-7 pb-5`, `bg-gray-50`; header con `@click="sidebarToggle = false"` |

Notas transversales:
- **L3/L4/L5/L6** añaden `docsSidebarOpen: true` y `menuToggle` al `x-data` del `<body>`, y colapsan
  el aside con `:style="!docsSidebarOpen ? 'width: 0; overflow: hidden; border-right-width: 0; min-width: 0;' : ''"`
  (ancho por style inline, **no** por clase).
- **`top-16`** (L3/L4/L6) = el header ocupa todo el ancho y el sidebar arranca por debajo.
  **`top-0`** (L1/L2/L5) = el sidebar es columna completa a la izquierda del header.
- Sólo **index/L1** usan el sistema de clases `menu-item-*`. L2/L4/L5 lo reimplementan inline.
  Es decir: **el "sistema" de sidebar de TailAdmin no está unificado** entre demos.

### 1.5 Tooltip del rail (layout-six)

```html
<div class="group relative">
  <a class="nav-icon-item" :class="activeNav === 'dashboard' ? 'nav-icon-item-active' : 'nav-icon-item-inactive'">…</a>
  <span class="pointer-events-none absolute top-1/2 left-full z-50 ml-3 -translate-y-1/2
               rounded-lg bg-gray-800 px-3 py-1.5 text-sm whitespace-nowrap text-white
               opacity-0 shadow-lg transition-opacity group-hover:opacity-100">Dashboard</span>
</div>
```

---

## 2. Sidebar (sistema canónico: `index.html` / `layout-one`)

### 2.1 Estado Alpine

- En `<body>`: `sidebarToggle` (abrir/colapsar) y `page` (identidad de la página actual, string).
- En `<nav>`: `x-data="{selected: $persist('Dashboard')}"` — `selected` = **grupo desplegado**
  (persiste en localStorage vía el plugin `$persist` de Alpine).
- **Dos conceptos distintos que se combinan con OR**:
  - `selected` → el usuario ha abierto ese grupo.
  - `page` → la página que se está viendo (hardcodeada por fichero).

### 2.2 Heading de sección

```html
<h3 class="mb-4 text-xs leading-[20px] text-gray-400 uppercase">
  <span class="menu-group-title" :class="sidebarToggle ? 'xl:hidden' : ''">MENU</span>
  <svg :class="sidebarToggle ? 'xl:block hidden' : 'hidden'"
       class="menu-group-icon mx-auto fill-current" …/>   <!-- "···" cuando está en rail -->
</h3>
<ul class="mb-6 flex flex-col gap-1"> … </ul>
```

El texto se oculta al colapsar y **se sustituye por un icono de puntos suspensivos**, no
desaparece: el grupo sigue marcado visualmente en el rail.

### 2.3 Item de nav (activo vs inactivo)

```html
<li>
  <a href="#"
     @click.prevent="selected = (selected === 'Dashboard' ? '':'Dashboard')"
     class="menu-item group"
     :class="(selected === 'Dashboard') || (page === 'ecommerce' || page === 'analytics' || …)
             ? 'menu-item-active' : 'menu-item-inactive'">
    <svg :class="… ? 'menu-item-icon-active' : 'menu-item-icon-inactive'" …/>
    <span class="menu-item-text" :class="sidebarToggle ? 'xl:hidden' : ''">Dashboard</span>
    <svg class="menu-item-arrow"
         :class="[(selected === 'Dashboard') ? 'menu-item-arrow-active' : 'menu-item-arrow-inactive',
                  sidebarToggle ? 'xl:hidden' : '']" …/>
  </a>
```

Contrato: **activo/inactivo se resuelve con un par de clases**, no con `aria-current`.
Cada elemento (raíz, icono, flecha) tiene su propio par `-active`/`-inactive`.
Todo lo textual se apaga con `sidebarToggle ? 'xl:hidden' : ''` — **el rail sólo deja el icono**.

### 2.4 Grupo con submenú desplegable

```html
  <!-- Dropdown Menu Start -->
  <div class="translate transform overflow-hidden"
       :class="(selected === 'Dashboard') ? 'block' :'hidden'">
    <ul :class="sidebarToggle ? 'xl:hidden' : 'flex'"
        class="menu-dropdown mt-2 flex flex-col gap-1 pl-9">
      <li>
        <a href="index.html" class="menu-dropdown-item group"
           :class="page === 'ecommerce' ? 'menu-dropdown-item-active' : 'menu-dropdown-item-inactive'">
          eCommerce
        </a>
      </li>
```

- Apertura por `block`/`hidden` (**sin `x-collapse` ni transición real**; `translate transform`
  es vestigial).
- Sangría del submenú: `pl-9`. El submenú **se oculta entero en modo rail**.
- El activo del hijo se decide por `page`, el del padre por `selected || page ∈ {…}`.

### 2.5 Badge en item

```html
<span :class="sidebarToggle ? 'xl:hidden' : ''" class="absolute right-10 flex items-center gap-1">
  <span class="menu-dropdown-badge"
        :class="page === 'layoutOne' ? 'menu-dropdown-badge-active' : 'menu-dropdown-badge-inactive'">New</span>
</span>
<svg class="menu-item-arrow absolute top-1/2 right-2.5 -translate-y-1/2 stroke-current" …/>
```

Con badge, la flecha pasa a posicionamiento absoluto (`right-2.5`) y el badge a `right-10`.

### 2.6 Header del sidebar

```html
<div :class="sidebarToggle ? 'justify-center' : 'justify-between'"
     class="sidebar-header flex items-center gap-2 pt-8 pb-7">
  <span class="logo" :class="sidebarToggle ? 'hidden' : ''">
    <img class="dark:hidden" src="…/logo.svg"><img class="hidden dark:block" src="…/logo-dark.svg">
  </span>
  <img class="logo-icon" :class="sidebarToggle ? 'xl:block' : 'hidden'" src="…/logo-icon.svg">
</div>
```

Dos logos por tema (`dark:hidden` / `hidden dark:block`) **y** dos por estado (full / icono).

### 2.7 Docs (L3) e icon-rail (L6)

```html
<!-- L3 -->
<nav x-data="{ selected: $persist('Accordion') }">
  <div class="mb-7">
    <h3 class="mb-2 px-3 text-xs font-medium text-gray-800 dark:text-white/90">Get Started</h3>
    <ul class="flex flex-col gap-0.5">
      <li><a class="docs-menu-item"
             :class="selected === 'QuickStart' ? 'docs-menu-item-active' : 'docs-menu-item-inactive'">Quick Start</a></li>
```

```html
<!-- L4/L5 cabecera de acordeón (Tailwind inline, sin clase de componente) -->
<button @click="openSection = openSection === 'GetStarted' ? '' : 'GetStarted'"
  :class="openSection === 'GetStarted' ? 'bg-gray-100 dark:bg-gray-800' : 'hover:bg-gray-100 dark:hover:bg-gray-800'"
  class="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-sm font-normal text-gray-800 dark:text-white/90">
  Get Started
  <svg :class="openSection === 'GetStarted' ? 'rotate-180' : ''" class="transition-transform duration-200" …/>
</button>
```

---

## 3. Header

### 3.1 Fila izquierda

```html
<div class="flex w-full items-center justify-between gap-2 border-b border-gray-200 px-3 py-3
            sm:gap-4 lg:py-4 xl:justify-normal xl:border-b-0 xl:px-0 dark:border-gray-800">
```

**Hamburguesa** (3 iconos: rail-toggle en `xl`, hamburguesa y cruz en móvil):

```html
<button
  :class="sidebarToggle ? 'xl:bg-transparent dark:xl:bg-transparent bg-gray-100 dark:bg-gray-800' : ''"
  class="z-99999 flex h-10 w-10 items-center justify-center rounded-lg border-gray-200
         text-gray-500 xl:h-11 xl:w-11 xl:border dark:border-gray-800 dark:text-gray-400"
  @click.stop="sidebarToggle = !sidebarToggle">
```

**Botón menú de aplicación** (sólo móvil, colapsa la fila de acciones):

```html
<button class="z-99999 flex h-10 w-10 items-center justify-center rounded-lg text-gray-700
               hover:bg-gray-100 xl:hidden dark:text-gray-400 dark:hover:bg-gray-800"
        :class="menuToggle ? 'bg-gray-100 dark:bg-gray-800' : ''"
        @click.stop="menuToggle = !menuToggle">
```

### 3.2 Buscador (`hidden xl:block`)

```html
<input id="search-input" type="text" placeholder="Search or type command..."
  class="dark:bg-dark-900 shadow-theme-xs focus:border-brand-300 focus:ring-brand-500/10
         dark:focus:border-brand-800 h-11 w-full rounded-lg border border-gray-200 bg-transparent
         py-2.5 pr-14 pl-12 text-sm text-gray-800 placeholder:text-gray-400 focus:ring-3
         focus:outline-hidden xl:w-[430px] dark:border-gray-800 dark:bg-white/[0.03]
         dark:text-white/90 dark:placeholder:text-white/30" />
```

- Icono lupa: `pointer-events-none absolute top-1/2 left-4 -translate-y-1/2`.
- Chip **⌘K**: `absolute top-1/2 right-2.5 inline-flex -translate-y-1/2 items-center gap-0.5
  rounded-lg border border-gray-200 bg-gray-50 px-[7px] py-[4.5px] text-xs -tracking-[0.2px]
  text-gray-500 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-400`.
- **El atajo ⌘K es decorativo**: no hay listener de teclado en el HTML estático.

### 3.3 Fila derecha (acciones)

```html
<div :class="menuToggle ? 'flex' : 'hidden'"
     class="shadow-theme-md w-full items-center justify-between gap-4 px-5 py-4
            xl:flex xl:justify-end xl:px-0 xl:shadow-none">
  <div class="2xsm:gap-3 flex items-center gap-2">
```

**Botón redondo canónico** (idéntico para dark-mode y notificaciones):

```
hover:text-dark-900 relative flex h-11 w-11 items-center justify-center rounded-full
border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-100
hover:text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400
dark:hover:bg-gray-800 dark:hover:text-white
```

### 3.4 Dropdown de notificaciones

```html
<div class="relative" x-data="{ dropdownOpen: false, notifying: true }" @click.outside="dropdownOpen = false">
  <button @click.prevent="dropdownOpen = ! dropdownOpen; notifying = false" class="…botón redondo…">
    <span :class="!notifying ? 'hidden' : 'flex'"
          class="absolute top-0.5 right-0 z-1 h-2 w-2 rounded-full bg-orange-400">
      <span class="absolute -z-1 inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75"></span>
    </span>
  </button>
  <div x-show="dropdownOpen"
    class="shadow-theme-lg dark:bg-gray-dark absolute -left-15 mt-[17px] flex h-[480px] w-[350px]
           flex-col rounded-2xl border border-gray-200 bg-white p-3 sm:w-[361px]
           xl:right-0 xl:left-auto dark:border-gray-800">
```

- Punto naranja + `animate-ping`; se apaga al abrir (`notifying = false`).
- Cabecera: `mb-3 flex items-center justify-between border-b border-gray-100 pb-3 dark:border-gray-800`.
- Lista: `custom-scrollbar flex h-auto flex-col overflow-y-auto`.
- Item: `flex gap-3 rounded-lg border-b border-gray-100 p-3 px-4.5 py-3 hover:bg-gray-100
  dark:border-gray-800 dark:hover:bg-white/5`; avatar con punto de estado
  `bg-success-500 absolute right-0 bottom-0 z-10 h-2.5 w-full max-w-2.5 rounded-full border-[1.5px] border-white dark:border-gray-900`.
- Posición: anclado a la izquierda en móvil (`-left-15`), a la derecha en `xl`.

### 3.5 Dropdown de usuario

```html
<div class="relative" x-data="{ dropdownOpen: false }" @click.outside="dropdownOpen = false">
  <a href="#" class="flex items-center text-gray-700 dark:text-gray-400" @click.prevent="dropdownOpen = ! dropdownOpen">
    <span class="mr-3 h-11 w-11 overflow-hidden rounded-full"><img src="…/owner.png"></span>
    <span class="text-theme-sm mr-1 block font-medium">Musharof</span>
    <svg :class="dropdownOpen && 'rotate-180'" class="stroke-gray-500 dark:stroke-gray-400" …/>
  </a>
  <div x-show="dropdownOpen"
    class="shadow-theme-lg dark:bg-gray-dark absolute right-0 mt-[17px] flex w-[260px] flex-col
           rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800">
```

- Item de menú: `group text-theme-sm flex items-center gap-3 rounded-lg px-3 py-2 font-medium
  text-gray-700 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5
  dark:hover:text-gray-300`; icono `fill-gray-500 group-hover:fill-gray-700 dark:fill-gray-400 dark:group-hover:fill-gray-300`.
- Separador: `flex flex-col gap-1 border-b border-gray-200 pt-4 pb-3 dark:border-gray-800`.

**Los dos dropdowns comparten firma**: `relative` + `x-data="{dropdownOpen:false}"` +
`@click.outside` + panel `shadow-theme-lg dark:bg-gray-dark absolute mt-[17px] rounded-2xl border
border-gray-200 bg-white p-3 dark:border-gray-800`. Es la card base + sombra + `absolute`.
Sin `x-transition`, sin trap de foco, sin `Escape`.

---

## 4. Dark mode

```html
<body
  x-data="{ page: 'ecommerce', 'loaded': true, 'darkMode': false, 'stickyMenu': false,
            'sidebarToggle': false, 'scrollTop': false }"
  x-init="
       darkMode = JSON.parse(localStorage.getItem('darkMode')) ?? false;
       $watch('darkMode', value => localStorage.setItem('darkMode', JSON.stringify(value)))"
  :class="{'dark bg-gray-900': darkMode === true}"
>
```

Mecánica:
1. **Origen**: `localStorage['darkMode']` = `"true"` / `"false"` (JSON). Default `false`
   — **no** se consulta `prefers-color-scheme`.
2. **Persistencia**: `$watch` sobre `darkMode` reescribe localStorage en cada cambio.
3. **Aplicación**: `:class="{'dark bg-gray-900': darkMode === true}"` pone `dark` **en el `<body>`**
   (junto con `bg-gray-900`). Basta para las variantes `dark:` porque `<body>` es ancestro de todo.
4. **Toggle**:
   ```js
   darkMode = !darkMode;
   document.documentElement.classList.toggle('dark', darkMode);
   localStorage.setItem('darkMode', JSON.stringify(darkMode))
   ```
   Añade `dark` también en `<html>`, y **reescribe localStorage aunque el `$watch` ya lo haga**
   (doble escritura, inofensiva).

**Incoherencias reales** (a no replicar):
- `dark` acaba en **dos sitios** (`<body>` por Alpine, `<html>` por el botón) y **se desincronizan**:
  al cargar con `darkMode=true` desde localStorage, `x-init` **no** toca `documentElement`, así que
  `<html>` se queda sin `dark` hasta que se pulse el botón. Funciona sólo porque el `dark` del body
  es el que gobierna las variantes.
- No hay script anti-FOUC en `<head>`; el preloader (500 ms) tapa el flash.
- El toggler de las páginas de auth **no** llama a `localStorage.setItem` — depende del `$watch`.

**Estado muerto**: `stickyMenu` y `scrollTop` aparecen **exactamente 87 veces cada uno = 1 por
fichero**, sólo en la declaración `x-data`. Nunca se leen ni se escriben. Son vestigios.
(`sidebarToggle`: 5026 usos; `darkMode`: 911.)

---

## 5. Patrones de página

**Contenedor de página universal** (todas las páginas con shell salvo `task-list`):
`mx-auto max-w-(--breakpoint-2xl) p-4 pb-20 md:p-6 md:pb-6`
(`task-list` usa `mx-auto max-w-(--breakpoint-2xl) p-4 md:p-6`, sin el `pb-20`).

**Breadcrumb** (cabecera estándar de toda página que no sea dashboard):

```html
<div x-data="{ pageName: `User Profile`}">
  <div class="flex flex-wrap items-center justify-between gap-3 pb-6">
    <h2 class="text-xl font-semibold text-gray-800 dark:text-white/90" x-text="pageName"></h2>
    <nav><ol class="flex items-center gap-1.5">
      <li><a class="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400" href="index.html">Home <svg …/></a></li>
```

**Cabecera de card estándar**:

```html
<div class="flex justify-between">
  <div>
    <h3 class="text-lg font-semibold text-gray-800 dark:text-white/90">Monthly Target</h3>
    <p class="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">Target you've set…</p>
  </div>
  <div x-data="{openDropDown: false}" class="relative h-fit"> … kebab ⋯ … </div>
</div>
```

### 5.1 Dashboards

Todos: wrapper universal + `grid grid-cols-12 gap-4 md:gap-6`, sin breadcrumb.

| Página | `page` | Anatomía | Rejilla |
|---|---|---|---|
| **index** (eCommerce) | `ecommerce` | Metric Group One (2 KPI) → Chart One (ventas mensuales) → Chart Two (Monthly Target, radial) → Chart Three (Statistics) → Map One (demográfico) → Table One (Recent Orders) | `col-span-12 xl:col-span-7` + `col-span-12 xl:col-span-5` → `col-span-12` → `xl:col-span-5` + `xl:col-span-7` |
| **analytics** | `analytics` | Metric Group Two → Chart Four → Top Card Group (`Card item`) → Chart Five/Six/Seven → Map One → Table Two | 12-col |
| **crm** | `crm` | Metric Group Four → Chart Eleven/Twelve/Thirteen → Upcoming Schedule → Table Four | 12-col |
| **saas** | `saas` | Metrics → Chart → Funnel Chart → Invoice Table → Product Performance (**Tab Panels**: Daily Sales / Online Sales / New Users) → **Activities** (timeline vertical con `Timeline line`) | 12-col |
| **stocks** | `stocks` | Metric Group Five → Chart Fourteen → **Trending Stocks** (`Stocks Item`) → Chart Fifteen → **Watchlist** (`Watchlist item`) → Table Five | 12-col |

Cards de dashboard (variantes de padding sobre la base):
- KPI: `rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6`
- Chart: `overflow-hidden rounded-2xl border border-gray-200 bg-white px-5 pt-5 sm:px-6 sm:pt-6 dark:border-gray-800 dark:bg-white/[0.03]`
- **Chart Two (Monthly Target)** — card **anidada**, único caso: exterior
  `rounded-2xl border border-gray-200 bg-gray-100 dark:border-gray-800 dark:bg-white/[0.03]`,
  interior `shadow-default rounded-2xl bg-white px-5 pb-11 pt-5 dark:bg-gray-900 sm:px-6 sm:pt-6`.
- **stocks** rompe el patrón con tiles sin borde: `rounded-2xl bg-gray-100 p-5 dark:bg-white/[0.03]`.
- Los kebab de stocks/invoices usan `fixed` en vez de `absolute` (`shadow-theme-lg dark:bg-gray-dark fixed w-40 …`).

### 5.2 Páginas de aplicación

| Página | `page` / estado extra | Anatomía | Wrapper del bloque |
|---|---|---|---|
| **profile** | `isProfileInfoModal`, `isProfileAddressModal` | Breadcrumb → card contenedora → 4 sub-cards: **Info / Address / Security / Danger Zone** (cada una editable por modal) | Contenedora: `rounded-2xl border border-gray-200 bg-white p-5 lg:p-6 dark:border-gray-800 dark:bg-white/[0.03]`; sub-card: `mb-6 rounded-2xl border border-gray-200 p-5 lg:p-6 dark:border-gray-800` (**sin fondo** — anidada) |
| **calendar** | — | Breadcrumb → **una sola card** con `<div id="calendar">` (FullCalendar monta aquí) → modal de evento (`BEGIN MODAL`) | `rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]` |
| **chat** → interior completo en **`chat.md`** | `isMobile: false` | Breadcrumb → **dos paneles** lado a lado: Chat Sidebar (lista) + Chat Box | Alto: `h-[calc(100vh-186px)] overflow-hidden sm:h-[calc(100vh-174px)]`; fila `flex h-full flex-col gap-6 xl:flex-row xl:gap-5`; sidebar `flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white xl:flex xl:w-1/4 dark:…`; box `flex h-full flex-col overflow-hidden rounded-2xl … xl:w-3/4` |
| **inbox** | — | Breadcrumb → Inbox Sidebar (Mailbox / Filter / Label groups) + Mailbox (lista de correos) | Sidebar `flex flex-col rounded-2xl border border-gray-200 bg-white p-4 dark:… xl:w-1/5`; lista `flex h-screen flex-col overflow-hidden rounded-2xl … xl:h-full xl:w-4/5` |
| **task-kanban** | `isTaskModalModal` | Breadcrumb → Task header (tabs+filtros) → Task wrapper → 3 `swim-lane` (To do / Progress / Completed) | **`mt-7 grid grid-cols-1 border-t border-gray-200 sm:mt-0 sm:grid-cols-2 xl:grid-cols-3 dark:border-gray-800`**; lane `swim-lane flex flex-col gap-5 p-4 xl:p-6` |
| **task-list** | `isTaskModalModal` | **Idéntico a kanban** (mismo header, mismas 3 listas) | **`mt-7 space-y-8 border-t border-gray-200 p-4 sm:mt-0 xl:p-6 dark:border-gray-800`**; lane `swim-lane flex flex-col gap-4` |

> **kanban vs list = una sola clase de wrapper.** Mismos datos, mismas `swim-lane`, mismo modal:
> `grid xl:grid-cols-3` (columnas) vs `space-y-8` (apilado). Patrón muy reutilizable.

Contador de lane (ambos): `text-theme-xs inline-flex rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-700 dark:bg-white/[0.03] dark:text-white/80`.

### 5.3 Documentos / contenido

| Página | Anatomía | Wrapper |
|---|---|---|
| **invoices** | Breadcrumb → Content → **Overview** (KPIs) → **Table** (listado) | `mb-6 rounded-2xl border border-gray-200 bg-white p-4 sm:p-6 dark:border-gray-800 dark:bg-white/[0.03]` |
| **single-invoice** | Breadcrumb → Invoice Mainbox (emisor/receptor/meta) → Invoice Table (líneas + totales) | **Una card**: `w-full rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]` |
| **file-manager** | Breadcrumb → **Media Card** (`Media item`) → **Folders Card** (`Folders item`) → Chart Sixteen (uso de espacio) → Table Seven (ficheros recientes) | Tile de media: `flex items-center justify-between rounded-2xl border border-gray-100 bg-white py-4 pl-4 pr-4 dark:border-gray-800 dark:bg-white/[0.03] xl:pr-5`; tile de carpeta: `rounded-2xl border border-gray-100 bg-gray-50 px-6 py-6 dark:border-gray-800 dark:bg-white/[0.03] xl:py-[27px]` — **`border-gray-100`, no `-200`** |
| **pricing-tables** | Breadcrumb → 3 variantes (Pricing Table One / Two / Three), cada una con `Pricing item` | Normal: `rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] xl:p-8`; **destacado**: `rounded-2xl border-2 border-brand-500 bg-white p-6 dark:border-brand-500 dark:bg-white/[0.03] xl:p-8`; invertido: `rounded-2xl border border-gray-800 bg-gray-800 p-6 dark:border-white/10 dark:bg-white/10`; brand: `relative p-6 z-1 rounded-2xl bg-brand-500` |
| **faq** | Breadcrumb → 3 variantes (FAQ One/Two/Three) de acordeón, con `divider` | `overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]` (el `overflow-hidden` recorta el acordeón) |

> **Destacar un plan = `border-2 border-brand-500`** sustituyendo `border border-gray-200`.
> Ojo: `border-2` cambia el ancho → *layout shift* de 1px respecto a las cards vecinas.

### 5.4 Auth (`signin`, `signup`, `reset-password`) — **split screen**

```html
<div class="relative z-1 bg-white p-6 sm:p-0 dark:bg-gray-900">
  <div class="relative flex h-screen w-full flex-col justify-center sm:p-0 lg:flex-row dark:bg-gray-900">

    <!-- Izquierda: formulario -->
    <div class="flex w-full flex-1 flex-col lg:w-1/2">
      <div class="mx-auto w-full max-w-md pt-10">…back link…</div>
      <div class="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">…form…</div>
    </div>

    <!-- Derecha: panel de marca (oculto < lg) -->
    <div class="bg-brand-950 relative hidden h-full w-full items-center lg:grid lg:w-1/2 dark:bg-white/5">
      <div class="z-1 flex items-center justify-center">
        …grid-01.svg decorativos (absolute right-0 top-0 -z-1 …max-w-[250px] xl:max-w-[450px])…
        <div class="flex max-w-xs flex-col items-center">
          <a href="index.html" class="mb-4 block"><img src="src/images/logo/auth-logo.svg"></a>
          <p class="text-center text-gray-400 dark:text-white/60">Free and Open-Source…</p>
        </div>
      </div>
    </div>

    <!-- Toggler dark flotante -->
    <div class="fixed right-6 bottom-6 z-50">
      <button class="bg-brand-500 hover:bg-brand-600 inline-flex size-14 items-center justify-center
                     rounded-full text-white transition-colors"
              @click.prevent="darkMode = !darkMode; document.documentElement.classList.toggle('dark', darkMode)">
```

- **Sí, split screen**: 50/50 a partir de `lg` (1024px). Panel derecho `hidden lg:grid`,
  fondo `bg-brand-950` (en dark baja a `dark:bg-white/5`).
- Formulario centrado con `max-w-md`, **sin card** — va directo sobre el fondo.
- Sin shell: no hay sidebar ni header. Toggler de tema flotante `fixed right-6 bottom-6`.
- Diferencias entre las tres: sólo el padding del bloque superior
  (`pt-10` en signin/reset, `pt-5 sm:py-10` en signup) y el contenido del form.
- **Bug del demo**: los tres declaran `page: 'comingSoon'` en el `x-data` (copy-paste).
  Irrelevante sin sidebar, pero delata el origen.

### 5.5 Error / estado (`404`, `coming-soon`, `maintenance`)

Patrón único, sin shell y **sin card**:

```html
<div class="relative z-1 flex min-h-screen flex-col items-center justify-center overflow-hidden p-6">
  <div class="absolute right-0 top-0 -z-1 w-full max-w-[250px] xl:max-w-[450px]"><img src="…/grid-01.svg"></div>
  <div class="absolute bottom-0 left-0 -z-1 w-full max-w-[250px] rotate-180 xl:max-w-[450px]"><img src="…/grid-01.svg"></div>
  <div class="mx-auto w-full max-w-[242px] text-center sm:max-w-[472px]">…</div>
</div>
```

- Los dos `grid-01.svg` en esquinas opuestas (uno `rotate-180`) son **el mismo recurso** que el
  panel de auth: es el "Common Grid Shape".
- El bloque central es siempre `mx-auto w-full … text-center`; **sólo cambia su `max-w`**:
  - `404`: `mx-auto w-full max-w-[242px] text-center sm:max-w-[472px]`
  - `coming-soon`: `mx-auto w-full max-w-[460px] text-center` (+ bloque `mb-10` con countdown)
  - `maintenance`: `mx-auto w-full max-w-[274px] text-center sm:max-w-[555px]`
    (+ ilustración `mx-auto mb-10 w-full max-w-[155px] sm:max-w-[204px]`)
- El contenedor externo es idéntico en `404` y `maintenance`; **`coming-soon` añade `w-full`**
  (`relative z-1 flex min-h-screen w-full flex-col …`) — inconsistencia sin efecto visible.
- `500.html` / `503.html` / `success.html` siguen el mismo molde (3-3.5 K cada uno).

---

## 6. La card base

**Cadena canónica** (149 ocurrencias exactas sin padding, la más repetida del sistema):

```
rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]
```

Descomposición del contrato:

| Eje | Light | Dark |
|---|---|---|
| Radio | `rounded-2xl` (16px) — **invariante absoluto** | — |
| Borde | `border border-gray-200` | `dark:border-gray-800` |
| Fondo | `bg-white` | `dark:bg-white/[0.03]` ← **no un gris sólido: blanco al 3%** |

La decisión de diseño clave: en dark, la card **no** usa un color sólido sino un **velo blanco
translúcido al 3%** sobre el fondo de página. Así las cards anidadas se aclaran solas por
composición, sin escalas de gris nuevas.

**Variantes de padding** (la base + padding, todas presentes en el demo):

| Padding | Uso |
|---|---|
| *(sin padding)* | La card la rellena un hijo (tablas, calendar, chat) — 149× |
| `p-5 md:p-6` | KPI de dashboard |
| `p-5 sm:p-6` | Card genérica |
| `p-6` / `p-6 xl:p-8` | saas / pricing |
| `p-5 lg:p-6` | profile |
| `p-4 sm:p-6` | invoices |
| `px-5 pt-5 sm:px-6 sm:pt-6` | Cards de chart (sin `pb`: el chart lo aporta) |

**Modificadores observados**:
- `overflow-hidden` + base → cuando el hijo debe recortarse al radio (faq, charts, single-invoice).
- `dark:bg-white/3` (**100 usos**) vs `dark:bg-white/[0.03]` (**576 usos**): mismo valor, dos
  notaciones conviviendo en el mismo build. Deuda del demo — normalizar a `/[0.03]` (mayoritaria).
- `border-gray-100` en vez de `-200` → sólo file-manager y algún tile (`dark:` no cambia).
- `bg-gray-50` / `bg-gray-100` + `rounded-2xl` **sin borde** → tiles internos (stocks, file-manager).
- Panel de dropdown = card base + `shadow-theme-lg dark:bg-gray-dark absolute … p-2|p-3`.
  Nótese que el dropdown usa **`dark:bg-gray-dark` (sólido)**, no `dark:bg-white/[0.03]`:
  un panel flotante necesita opacidad real.

**Regla derivada**: card = `rounded-2xl` + `border-gray-200/800` + `bg-white` / `white/[0.03]`.
Todo lo demás (padding, `overflow-hidden`, sombra) es modificador. Si se porta un solo token de
TailAdmin a otro sistema, es éste.

---

## 7. Contrato que `style.css` debe proveer

El HTML depende de clases que **no están en el mirror**. Inventario por uso (87 ficheros):

**Componentes de sidebar** (el bloque más grande de CSS custom):
`menu-item` (1216), `menu-item-active`, `menu-item-inactive`, `menu-item-icon-active`,
`menu-item-icon-inactive`, `menu-item-text` (1230), `menu-item-arrow` (994), `menu-item-arrow-active`,
`menu-item-arrow-inactive`, `menu-dropdown` (1002), `menu-dropdown-item` (6009),
`menu-dropdown-item-active`, `menu-dropdown-item-inactive`, `menu-dropdown-badge` (784),
`menu-dropdown-badge-active`, `menu-dropdown-badge-inactive`, `menu-group-title` (217),
`menu-group-icon` (217), `sidebar` (76), `sidebar-header` (73), `logo` (73), `logo-icon` (73).

**Variantes de layout**: `docs-menu-item[-active|-inactive]` (24, sólo L3),
`nav-icon-item[-active|-inactive]` (11, sólo L6), `swim-lane` (6, kanban/list).

**Escalas de tema** (tokens, no componentes):
- Sombra: `shadow-theme-xs` (589), `shadow-theme-sm` (53), `shadow-theme-md` (132),
  `shadow-theme-lg` (224), `shadow-default` (1).
- Texto: `text-theme-xs` (1147), `text-theme-sm` (1770), `text-theme-xl` (27).
- Scroll: `custom-scrollbar` (139), `no-scrollbar` (88).

**Colores custom** (config de Tailwind, no CSS suelto): `brand-*` (`brand-500`, `brand-950`,
`brand-300/400/600/800`), `success-500`, `gray-dark`, `dark-900`, `theme-pink-500`, `theme-purple-500`.

**Escala z custom**: `z-1`, `-z-1`, `z-9999` (aside), `z-99999` (header), `z-999999` (preloader).

**Terceros montados por JS**: ApexCharts (`apexcharts-*`), jsVectorMap (`jvm-*`),
Flatpickr (`flatpickr-right`), FullCalendar (`#calendar`), `form-check-*`, `tableCheckbox`.

---

## 8. Observaciones para portar

1. **`stickyMenu` y `scrollTop` son estado muerto** — 1 aparición por fichero, sólo en `x-data`. No portar.
2. **`dark` se aplica en dos sitios y se desincroniza** al recargar (§4). Elegir **uno** (`<html>`)
   y añadir script anti-FOUC en `<head>`.
3. **El breakpoint del shell es `xl` (1280px)**, no `lg`. Está hardcodeado también en JS
   (`window.innerWidth < 1280`) → duplicación CSS/JS a unificar.
4. **`sidebarToggle` significa dos cosas** según el ancho (drawer vs rail). Si se porta a Vue,
   conviene separar en `drawerOpen` + `railCollapsed`.
5. **El sistema de sidebar no es único**: index/L1 usan `menu-item-*`; L2/L4/L5 lo reescriben inline.
   Portar **uno** (el de index) y descartar el resto.
6. **Accesibilidad ausente** en todo el shell: sin `aria-expanded`, `aria-current`, `role`, sin trap
   de foco ni `Escape` en dropdowns/modales, `<a href="#">` como botón. El activo se comunica sólo
   por color.
7. `dark:bg-white/[0.03]` (576) vs `dark:bg-white/3` (100) conviven — normalizar a uno.
8. Los dropdowns no tienen `x-transition`; los submenús abren con `block`/`hidden` (sin animación
   pese a la clase `translate transform` vestigial).
9. `viewport` con `user-scalable=no, maximum-scale=1.0` — bloquea el zoom, fallo de accesibilidad.
