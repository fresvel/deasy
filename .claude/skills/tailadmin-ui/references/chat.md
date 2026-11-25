# TailAdmin PRO — Recetas de clases de la página Chat

Extraído literal de `demo-pages/chat.html` (`<main>` = líneas 2878–3789; copia de trabajo en
`chat-main.html`). Cubre **solo los dos paneles del chat**: sidebar de conversaciones y chat box.
El sidebar/header globales de la app quedan fuera (ya documentados en `out-layout-pages.md`).

**Alcance / fidelidad**
- Todas las cadenas son **copia literal**, verificadas por `grep -F` contra `chat.html`. El recuento
  de ocurrencias de cada una está anotado donde importa.
- A diferencia de `out-atoms.md`, aquí **sí** hay `demo-style.css`: los tokens de esta página están
  resueltos abajo (§8) contra el CSS compilado. `dark-900` **no existe** (ver §9).
- **La página es estática.** No hay Alpine que genere burbujas: los 5 mensajes están hardcodeados en
  el HTML. El único Alpine del chat es `isMobile` (drawer del sidebar en <xl) y `openDropDown`
  (2 menús kebab). **No hay estado de "chat activo" en runtime** — ver §9.

---

## 1. Anatomía

```
main > div.mx-auto.max-w-(--breakpoint-2xl).p-4.pb-20.md:p-6.md:pb-6
  └─ div (breadcrumb "Chat")                                  ← estándar, no del chat
  └─ div.h-[calc(100vh-186px)].overflow-hidden.sm:h-[calc(100vh-174px)]   ← ALTO FIJO de la página
       └─ div.flex.h-full.flex-col.gap-6.xl:flex-row.xl:gap-5              ← apila en móvil, 2 cols en xl
            ├─ CHAT SIDEBAR   xl:w-1/4    (card redondeada)
            │    ├─ cabecera sticky: h3 "Chats" + kebab · buscador (+ botón hamburguesa xl:hidden)
            │    └─ div.no-scrollbar  ← DRAWER: fixed a pantalla completa en <xl, estático en xl
            │         ├─ cabecera del drawer (xl:hidden): h3 "Chat" + kebab + botón cerrar (X)
            │         └─ div.custom-scrollbar.max-h-full.space-y-1.overflow-auto   ← SCROLLER lista
            │              └─ 9 × item de conversación (avatar+dot · nombre · CARGO · hora)
            └─ CHAT BOX       xl:w-3/4    (card redondeada, flex-col h-full)
                 ├─ cabecera: avatar+dot · nombre · [llamada] [vídeo] [kebab]     (border-b)
                 ├─ div.custom-scrollbar.flex-1.overflow-auto   ← SCROLLER mensajes (flex-1 = ocupa el hueco)
                 │    └─ 5 × fila de mensaje (3 recibidas, 2 enviadas)
                 └─ div.sticky.bottom-0  ← COMPOSER (border-t): [emoji] input [adjuntar] [mic] [enviar]
```

**Cómo se reparte el alto:** la página fija el alto (`h-[calc(100vh-186px)]`, `sm:h-[calc(100vh-174px)]`)
y corta con `overflow-hidden`. El chat box es `flex h-full flex-col overflow-hidden`; dentro, cabecera y
composer son de alto natural y **el scroller de mensajes lleva `flex-1`** → se come el resto. Ese es el
único sitio donde se decide el alto del scroller: **no hay `h-*` ni `max-h-[Npx]` en la lista de mensajes.**

**Las dos cards son la misma receta salvo el ancho** (`xl:w-1/4` vs `xl:w-3/4`) y el orden de clases:

| | Chat sidebar (l. 55) | Chat box (l. 546) |
|---|---|---|
| clases | `flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white xl:flex xl:w-1/4 dark:border-gray-800 dark:bg-white/[0.03]` | `flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] xl:w-3/4` |
| orden | ordenado por el plugin de Tailwind (`dark:` al final) | **sin ordenar** (`dark:` en medio) |
| `flex` base | **no** — es `block` hasta `xl:flex` (ver §9) | sí |

⚠️ Las dos convenciones de orden **coexisten en el mismo fichero** (el sidebar pasó por el formateador,
el chat box no). Da igual funcionalmente; solo no busques coherencia.

---

## 2. Panel lista de conversaciones (chat sidebar)

### 2.1 Cabecera

```html
<div class="sticky px-4 pt-4 pb-4 sm:px-5 sm:pt-5 xl:pb-0">
  <div class="flex items-start justify-between">
    <div>
      <h3 class="text-theme-xl font-semibold text-gray-800 sm:text-2xl dark:text-white/90">Chats</h3>
    </div>
    <!-- kebab -->
    <div x-data="{openDropDown: false}" class="relative">
      <button @click="openDropDown = !openDropDown"
        :class="openDropDown ? 'text-gray-700 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white'">
        <svg class="fill-current" width="24" height="24" viewBox="0 0 24 24"><!-- 3 puntos vertical --></svg>
      </button>
      <div x-show="openDropDown" @click.outside="openDropDown = false"
        class="shadow-theme-lg dark:bg-gray-dark absolute top-full right-0 z-40 w-40 space-y-1 rounded-2xl border border-gray-200 bg-white p-2 dark:border-gray-800">
        <button class="text-theme-xs flex w-full rounded-lg px-3 py-2 text-left font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300">View More</button>
        <button class="text-theme-xs flex w-full rounded-lg px-3 py-2 text-left font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300">Delete</button>
      </div>
    </div>
  </div>
  <!-- fila buscador -->
  <div class="mt-4 flex items-center gap-3 pb-14 xl:pb-0"> … </div>
</div>
```

`sticky` aquí **no hace nada** (sin `top-*`/`bottom-*` se comporta como `relative`) — ver §9.

### 2.2 Buscador + botón hamburguesa (abre el drawer en <xl)

```html
<div class="mt-4 flex items-center gap-3 pb-14 xl:pb-0">
  <button @click="isMobile = !isMobile"
    class="flex h-11 w-full max-w-11 items-center justify-center rounded-lg border border-gray-300 text-gray-700 xl:hidden dark:border-gray-700 dark:text-gray-400">
    <svg class="fill-current" width="24" height="24" viewBox="0 0 24 24"><!-- ☰ --></svg>
  </button>

  <div class="relative my-2 w-full">
    <form>
      <button class="absolute top-1/2 left-4 -translate-y-1/2">
        <svg class="fill-gray-500 dark:fill-gray-400" width="20" height="20" viewBox="0 0 20 20"><!-- lupa --></svg>
      </button>
      <input type="text" placeholder="Search..."
        class="dark:bg-dark-900 shadow-theme-xs focus:border-brand-300 focus:ring-brand-500/10 dark:focus:border-brand-800 h-11 w-full rounded-lg border border-gray-300 bg-transparent py-2.5 pr-3.5 pl-[42px] text-sm text-gray-800 placeholder:text-gray-400 focus:ring-3 focus:outline-hidden dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30" />
    </form>
  </div>
</div>
```

- Es el **input estándar del kit con icono** (`h-11`, `pl-[42px]` para la lupa a `left-4`).
- ⚠️ Lleva `dark:bg-dark-900` (**clase muerta**, §9) *y* `dark:bg-gray-900` acto seguido. El fondo dark
  real lo pone `dark:bg-gray-900`. **Copia solo `dark:bg-gray-900`.**
- `pb-14 xl:pb-0`: reserva hueco bajo el buscador en móvil (donde el drawer se superpone).

### 2.3 El drawer / scroller (contenedor de la lista)

```html
<div class="no-scrollbar flex-col overflow-auto"
     :class="isMobile ? 'flex fixed xl:static top-0 left-0 z-999999 h-screen bg-white dark:bg-gray-900' : 'hidden xl:flex'">

  <!-- cabecera del drawer, solo <xl -->
  <div class="flex items-center justify-between border-b border-gray-200 p-5 xl:hidden dark:border-gray-800">
    <div><h3 class="text-theme-xl font-semibold text-gray-800 sm:text-2xl dark:text-white/90">Chat</h3></div>
    <div class="flex items-center gap-1">
      <div x-data="{openDropDown: false}" class="relative -mb-1.5"> … kebab idéntico al de §2.1 … </div>
      <button @click="isMobile = !isMobile"
        class="flex h-10 w-10 items-center justify-center rounded-full border border-gray-300 text-gray-700 dark:border-gray-700 dark:text-gray-400">
        <svg class="fill-current" width="24" height="24" viewBox="0 0 24 24"><!-- ✕ --></svg>
      </button>
    </div>
  </div>

  <!-- SCROLLER real de la lista -->
  <div class="flex max-h-full flex-col overflow-auto px-4 sm:px-5">
    <div class="custom-scrollbar max-h-full space-y-1 overflow-auto">
      … 9 × item …
    </div>
  </div>
</div>
```

**Dos scrollers anidados**, ambos `max-h-full overflow-auto`: el de fuera aporta el padding lateral
(`px-4 sm:px-5`) y **oculta su barra** (`no-scrollbar` en el drawer), el de dentro es el que se ve
(`custom-scrollbar`) y separa items con `space-y-1`. Redundante pero es lo que hay.

| Estado `isMobile` | clases aplicadas |
|---|---|
| `true` (drawer abierto, <xl) | `flex fixed xl:static top-0 left-0 z-999999 h-screen bg-white dark:bg-gray-900` |
| `false` (por defecto) | `hidden xl:flex` |

`@click.outside="isMobile = !isMobile"` está en la **card raíz** del sidebar (l. 54), no aquí.
⚠️ Es un *toggle*, no un cierre: un clic fuera con el drawer ya cerrado **lo abre**. Usa `= false`.

### 2.4 Item de conversación

```html
<div class="flex cursor-pointer items-center gap-3 rounded-lg p-3 hover:bg-gray-100 dark:hover:bg-white/[0.03]">
  <div class="relative h-12 w-full max-w-[48px] rounded-full">
    <img src="src/images/user/user-18.jpg" alt="profile"
         class="h-full w-full overflow-hidden rounded-full object-cover object-center" />
    <span class="bg-success-500 absolute right-0 bottom-0 block h-3 w-3 rounded-full border-[1.5px] border-white dark:border-gray-900"></span>
  </div>
  <div class="w-full">
    <div class="flex items-start justify-between">
      <div>
        <h5 class="text-sm font-medium text-gray-800 dark:text-white/90">Kaiya George</h5>
        <p class="text-theme-xs mt-0.5 text-gray-500 dark:text-gray-400">Project Manager</p>
      </div>
      <span class="text-theme-xs text-gray-400"> 15 mins </span>
    </div>
  </div>
</div>
```

Verificado: la cadena del item aparece **9× idéntica** — o sea **no hay variante activa/seleccionada
ni de no-leído** (§9). El avatar usa el truco `h-12 w-full max-w-[48px]` (ancho fijo vía `max-w`, no `w-12`).

> ⚠️ **El `<p>` secundario NO es un preview del último mensaje** — es el **cargo** de la persona
> ("Project Manager", "Designer", "SEO Expert"). En esta página no existe preview de mensaje.
> Si necesitas preview, tendrás que añadir tú el truncado (`truncate`, `line-clamp-1`) — **no lo hay**.
> (Uno de los seeds está corrupto: `Project ManagerProduct Designer`, l. 430.)

### 2.5 Indicador de presencia

Misma cadena salvo el color. Los 9 items: **7× success, 1× warning, 1× error**.

| Estado | cadena literal | ocurrencias |
|---|---|---|
| online | `bg-success-500 absolute right-0 bottom-0 block h-3 w-3 rounded-full border-[1.5px] border-white dark:border-gray-900` | 7 |
| ausente | `bg-warning-500 absolute right-0 bottom-0 block h-3 w-3 rounded-full border-[1.5px] border-white dark:border-gray-900` | 1 |
| offline/ocupado | `bg-error-500 absolute right-0 bottom-0 block h-3 w-3 rounded-full border-[1.5px] border-white dark:border-gray-900` | 1 |

El `border-[1.5px] border-white dark:border-gray-900` es el anillo que recorta el dot contra el avatar:
**el color del borde debe igualar el fondo de la card**, no ser blanco por decoración.

⚠️ Los nombres de estado (online/ausente/offline) son **inferencia mía por color** — el markup no los
etiqueta: no hay `title`, `aria-label` ni texto. El dot es puramente visual e **inaccesible**.

⚠️ En `chat.html` existe otra variante del dot, `… z-10 h-2.5 w-full max-w-2.5 …` (6× success, 2× error):
es del **header global** (dropdown de usuario), **no del chat**. No la mezcles.

---

## 3. Cabecera del chat box

```html
<div class="sticky flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-800 xl:px-6">
  <div class="flex items-center gap-3">
    <div class="relative h-12 w-full max-w-[48px] rounded-full">
      <img src="src/images/user/user-17.jpg" alt="profile"
           class="h-full w-full overflow-hidden rounded-full object-cover object-center" />
      <span class="absolute bottom-0 right-0 block h-3 w-3 rounded-full border-[1.5px] border-white bg-success-500 dark:border-gray-900"></span>
    </div>
    <h5 class="text-sm font-medium text-gray-500 dark:text-gray-400">Lindsey Curtis</h5>
  </div>

  <div class="flex items-center gap-3">
    <button class="text-gray-700 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white/90">
      <svg class="stroke-current" width="24" height="24" viewBox="0 0 24 24"><!-- teléfono --></svg>
    </button>
    <button class="text-gray-700 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white/90">
      <svg class="fill-current" width="24" height="24" viewBox="0 0 24 24"><!-- cámara de vídeo --></svg>
    </button>
    <div x-data="{openDropDown: false}" class="relative -mb-1.5">
      <button @click="openDropDown = !openDropDown"
        :class="openDropDown ? 'text-gray-800 dark:text-white/90' : 'text-gray-700 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white/90'">
        <svg class="fill-current" width="24" height="24" viewBox="0 0 24 24"><!-- kebab --></svg>
      </button>
      <div x-show="openDropDown" @click.outside="openDropDown = false"
        class="absolute right-0 top-full z-40 w-40 space-y-1 rounded-2xl border border-gray-200 bg-white p-2 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark">
        <button class="flex w-full rounded-lg px-3 py-2 text-left text-theme-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300">View More</button>
        <button class="flex w-full rounded-lg px-3 py-2 text-left text-theme-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300">Delete</button>
      </div>
    </div>
  </div>
</div>
```

**Diferencias vs. la cabecera del sidebar** (no son erratas tuyas, son del kit):
- El dot lleva las clases **en otro orden** (`absolute bottom-0 right-0 … bg-success-500` en vez de
  `bg-success-500 absolute right-0 bottom-0 …`) — mismo resultado.
- El kebab usa una **paleta distinta** (`text-gray-700`/`text-gray-800`) que el del sidebar
  (`text-gray-500`/`text-gray-700`). Elige una y úsala en los dos.
- El dropdown es el mismo componente con el orden de clases sin normalizar.

> ⚠️ **NO hay estado "online" ni "último visto" en texto.** El nombre (`<h5>`) es el único texto de la
> cabecera, y va en `text-gray-500 dark:text-gray-400` (gris apagado, *no* `text-gray-800` como en los
> items de la lista). El estado se comunica **solo** con el dot verde. Si quieres "online"/"visto hace
> 5 min" hay que añadirlo: no existe en esta página.

---

## 4. Burbujas de mensaje

### 4.1 La receta en 3 ejes

Recibido y enviado **no comparten estructura**: no es un flip de un mismo componente.

| | RECIBIDO (izq.) | ENVIADO (der.) |
|---|---|---|
| **fila** | `max-w-[350px]` (3×) | `ml-auto max-w-[350px] text-right` (2×) |
| alineación | por defecto (izq.) | `ml-auto` en la fila **y** `ml-auto` otra vez en cada burbuja |
| **avatar** | **sí** — `h-10 w-full max-w-10` a la izquierda, `flex items-start gap-4` | **no existe** |
| **burbuja** | `rounded-lg rounded-tl-sm bg-gray-100 px-3 py-2 dark:bg-white/5` | `ml-auto max-w-max rounded-lg rounded-tr-sm bg-brand-500 px-3 py-2 dark:bg-brand-500` |
| esquina recortada | **`rounded-tl-sm`** (sup. izq., hacia el avatar) | **`rounded-tr-sm`** (sup. der.) |
| fondo | `bg-gray-100` / `dark:bg-white/5` | `bg-brand-500` / `dark:bg-brand-500` (= no-op, §9) |
| **texto** | `text-sm text-gray-800 dark:text-white/90` (4×) | `text-sm text-white dark:text-white/90` (3×) |
| ancho burbuja | fluido (llena los 350−avatar) ⚠️ ver 4.4 | `max-w-max` → **se ciñe al texto** |
| **timestamp** | `Lindsey, 2 hours ago` (**nombre + hora**) | `2 hours ago` (**solo hora**) |
| clases timestamp | `mt-2 text-theme-xs text-gray-500 dark:text-gray-400` (5×, idéntica en ambos) | idem |
| posición timestamp | bajo la burbuja, **alineado con la burbuja** (dentro del `<div>` a la derecha del avatar) | bajo la burbuja, a la derecha (por `text-right` de la fila) |

Radios: `rounded-lg` = 8px en las 3 esquinas + `rounded-*-sm` = 2px en la de la "cola". **No hay cola/pico**
en SVG ni `::after`; el "apunta a" es solo ese radio pequeño.

**El nombre del emisor no tiene elemento propio**: va **concatenado en el timestamp** como texto plano
(`Lindsey, 2 hours ago`). No es un `<span>` separado ni estilable aparte.

### 4.2 Recibido (con avatar)

```html
<div class="max-w-[350px]">
  <div class="flex items-start gap-4">
    <div class="h-10 w-full max-w-10 rounded-full">
      <img src="src/images/user/user-17.jpg" alt="profile"
           class="h-full w-full overflow-hidden rounded-full object-cover object-center" />
    </div>
    <div>
      <div class="rounded-lg rounded-tl-sm bg-gray-100 px-3 py-2 dark:bg-white/5">
        <p class="text-sm text-gray-800 dark:text-white/90">I want to make an appointment tomorrow from 2:00 to 5:00pm?</p>
      </div>
      <p class="mt-2 text-theme-xs text-gray-500 dark:text-gray-400">Lindsey, 2 hours ago</p>
    </div>
  </div>
</div>
```

Avatar de mensaje = `h-10 w-full max-w-10` (40px) — **más pequeño** que el de la lista/cabecera
(`h-12 … max-w-[48px]`, 48px) y **sin dot de presencia**. `items-start` lo alinea con el borde superior.

### 4.3 Enviado (sin avatar)

```html
<div class="ml-auto max-w-[350px] text-right">
  <div class="ml-auto max-w-max rounded-lg rounded-tr-sm bg-brand-500 px-3 py-2 dark:bg-brand-500">
    <p class="text-sm text-white dark:text-white/90">If don’t like something, I’ll stay away from it.</p>
  </div>
  <p class="mt-2 text-theme-xs text-gray-500 dark:text-gray-400">2 hours ago</p>
</div>
```

⚠️ `text-right` en la fila alinea el **timestamp**; la burbuja se alinea con `ml-auto` + `max-w-max`
(el `text-right` **se hereda al texto de la burbuja** — si un mensaje enviado hace 2 líneas, queda
alineado a la derecha, no a la izquierda como sería normal). Añade `text-left` a la burbuja si te molesta.

### 4.4 Agrupación de consecutivos

**Sí la hay, pero solo en los enviados y solo a mano.** Dos burbujas dentro de la misma fila,
**un único timestamp** al final. La segunda burbuja añade **`mt-2`** — ese es el único cambio:

```html
<div class="ml-auto max-w-[350px] text-right">
  <div class="ml-auto max-w-max rounded-lg rounded-tr-sm bg-brand-500 px-3 py-2 dark:bg-brand-500 dark:text-white/90">
    <p class="text-sm text-white dark:text-white/90">If don’t like something, I’ll stay away from it.</p>
  </div>
  <div class="ml-auto mt-2 max-w-max rounded-lg rounded-tr-sm bg-brand-500 px-3 py-2 dark:bg-brand-500">
    <p class="text-sm text-white dark:text-white/90">They got there early, and got really good seats.</p>
  </div>
  <p class="mt-2 text-theme-xs text-gray-500 dark:text-gray-400">2 hours ago</p>
</div>
```

Las 3 variantes de la burbuja enviada, **cada una 1× en el fichero** (o sea: los 3 mensajes enviados
tienen chrome distinto entre sí — descuido del kit, no diseño):

| # | cadena | dónde |
|---|---|---|
| 1 | `ml-auto max-w-max rounded-lg rounded-tr-sm bg-brand-500 px-3 py-2 dark:bg-brand-500` | mensaje suelto (§4.3) |
| 2 | `ml-auto max-w-max rounded-lg rounded-tr-sm bg-brand-500 px-3 py-2 dark:bg-brand-500 dark:text-white/90` | 1ª del grupo — `dark:text-white/90` **sobra** (el `<p>` ya lo pone) |
| 3 | `ml-auto mt-2 max-w-max rounded-lg rounded-tr-sm bg-brand-500 px-3 py-2 dark:bg-brand-500` | 2ª del grupo — `mt-2` es lo único legítimo |

**Canoniza la #1**, y `+ mt-2` para las continuaciones.

⚠️ **Agrupación en recibidos: no existe.** Las 2 recibidas consecutivas repiten avatar y nombre completos.
El `rounded-tl-sm` de la 2ª burbuja del grupo enviado **no** se desactiva → en un grupo, todas las burbujas
llevan la esquina recortada, no solo la primera. Si quieres el efecto "grupo" real, hazlo tú.

Separación entre filas: **la da el scroller** con `space-y-6 xl:space-y-8` (§6), no las filas.

### 4.5 Mensaje con imagen

Solo hay **1 ejemplo** y es un **recibido**. La imagen va **fuera** de la burbuja, encima, como hermana:

```html
<div class="max-w-[350px]">
  <div class="flex items-start gap-4">
    <div class="h-10 w-full max-w-10 rounded-full">
      <img src="src/images/user/user-17.jpg" alt="profile" class="h-full w-full overflow-hidden rounded-full object-cover object-center" />
    </div>
    <div>
      <div class="mb-2 w-full max-w-[270px] overflow-hidden rounded-lg">
        <img src="src/images/chat/chat.jpg" alt="chat" />
      </div>
      <div class="max-w-max rounded-lg rounded-tl-sm bg-gray-100 px-3 py-2 dark:bg-white/5">
        <p class="text-sm text-gray-800 dark:text-white/90">Please preview the image</p>
      </div>
      <p class="mt-2 text-theme-xs text-gray-500 dark:text-gray-400">Lindsey, 2 hours ago</p>
    </div>
  </div>
</div>
```

- La imagen **no está dentro** de la burbuja: es un bloque propio `mb-2 w-full max-w-[270px] overflow-hidden rounded-lg`.
  El `overflow-hidden` + `rounded-lg` recorta la foto; el `<img>` interior **no lleva ninguna clase**
  (sin `w-full`, sin `object-cover`) → **se dibuja a su tamaño natural** y el `max-w-[270px]` del padre
  es lo único que la contiene. Frágil: mete `w-full` al `<img>`.
- ⚠️ Aquí la burbuja **sí** lleva `max-w-max` (`max-w-max rounded-lg rounded-tl-sm bg-gray-100 …`, 1×),
  al contrario que las otras 2 recibidas que **no** lo llevan (2×). Otra incoherencia: los recibidos sin
  `max-w-max` estiran el fondo gris hasta los 350px aunque el texto sea corto. **`max-w-max` es lo correcto.**
- **No hay adjunto de fichero** (PDF/doc) en ninguna página del chat. Solo imagen.

---

## 5. Composer

```html
<div class="sticky bottom-0 border-t border-gray-200 p-3 dark:border-gray-800">
  <form class="flex items-center justify-between">
    <div class="relative w-full">
      <!-- EMOJI: va DENTRO del input, a la izquierda -->
      <button class="absolute left-1 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white/90 sm:left-3">
        <svg class="fill-current" width="24" height="24" viewBox="0 0 24 24"><!-- smiley --></svg>
      </button>
      <input type="text" placeholder="Type a message"
        class="h-9 w-full border-none bg-transparent pl-12 pr-5 text-sm text-gray-800 outline-hidden placeholder:text-gray-400 focus:border-0 focus:ring-0 dark:text-white/90" />
    </div>

    <div class="flex items-center">
      <!-- ADJUNTAR (clip) -->
      <button class="mr-2 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white/90">
        <svg class="fill-current" width="24" height="24" viewBox="0 0 24 24"><!-- paperclip --></svg>
      </button>
      <!-- MICRÓFONO -->
      <button class="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white/90">
        <svg class="stroke-current" width="24" height="24" viewBox="0 0 24 24"><!-- mic --></svg>
      </button>
      <!-- ENVIAR -->
      <button class="ml-3 flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500 text-white hover:bg-brand-600 xl:ml-5">
        <svg width="20" height="20" viewBox="0 0 20 20"><path … fill="white" /></svg>
      </button>
    </div>
  </form>
</div>
```

| pieza | receta | notas |
|---|---|---|
| barra | `sticky bottom-0 border-t border-gray-200 p-3 dark:border-gray-800` | el **único `sticky` que sí funciona** (tiene `bottom-0`) |
| input | `h-9 w-full border-none bg-transparent pl-12 pr-5 text-sm text-gray-800 outline-hidden placeholder:text-gray-400 focus:border-0 focus:ring-0 dark:text-white/90` | **sin borde, sin foco visible**, transparente. Nada que ver con el input del buscador (§2.2). `pl-12` = hueco del emoji |
| emoji | `absolute left-1 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white/90 sm:left-3` | dentro del input, **izquierda** |
| adjuntar | `mr-2 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white/90` | icono clip, `fill-current` |
| micrófono | `text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white/90` | `stroke-current` |
| **enviar** | `ml-3 flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500 text-white hover:bg-brand-600 xl:ml-5` | cuadrado 36px, **el único botón sólido**; `hover:bg-brand-600` |

⚠️ Es un `<input type="text">` de **una línea con `h-9` fijo**, no un textarea: no crece. Ningún botón
tiene `type="button"` → dentro del `<form>` **todos son `type="submit"`** (el clip y el mic envían el
formulario). Y el SVG de enviar lleva `fill="white"` **hardcodeado**, no `currentColor`.

---

## 6. Scroller de mensajes

```html
<div class="custom-scrollbar max-h-full flex-1 space-y-6 overflow-auto p-5 xl:space-y-8 xl:p-6">
```

| aspecto | valor | comentario |
|---|---|---|
| alto | **ninguno propio** | lo da `flex-1` dentro del padre `flex h-full flex-col` |
| `max-h-full` | sí | redundante con `flex-1` + `overflow-hidden` del padre |
| overflow | `overflow-auto` | |
| scrollbar | **`custom-scrollbar`** sí | (la lista de conv. también; el drawer usa `no-scrollbar`) |
| separación filas | `space-y-6 xl:space-y-8` | 24px → 32px en xl |
| padding | `p-5 xl:p-6` | |

⚠️ **No hay auto-scroll al final**, ni `flex-col-reverse`, ni ancla: la página estática arranca arriba.
Eso lo pones tú.

Resumen de scrollers de la página:

| nodo | clases | barra |
|---|---|---|
| drawer del sidebar | `no-scrollbar flex-col overflow-auto` | **oculta** |
| envoltorio de la lista | `flex max-h-full flex-col overflow-auto px-4 sm:px-5` | por defecto del navegador |
| lista de conv. | `custom-scrollbar max-h-full space-y-1 overflow-auto` | fina, tematizada |
| mensajes | `custom-scrollbar max-h-full flex-1 space-y-6 overflow-auto p-5 xl:space-y-8 xl:p-6` | fina, tematizada |

---

## 7. Tabla maestra de variantes

| pieza | variante | cadena literal |
|---|---|---|
| card panel | sidebar | `flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white xl:flex xl:w-1/4 dark:border-gray-800 dark:bg-white/[0.03]` |
| card panel | chat box | `flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] xl:w-3/4` |
| item conv. | único (9×) | `flex cursor-pointer items-center gap-3 rounded-lg p-3 hover:bg-gray-100 dark:hover:bg-white/[0.03]` |
| item conv. | **activo** | **NO EXISTE** |
| item conv. | **no leído** | **NO EXISTE** |
| avatar | lista / cabecera (48px) | `relative h-12 w-full max-w-[48px] rounded-full` |
| avatar | mensaje (40px) | `h-10 w-full max-w-10 rounded-full` |
| avatar `<img>` | todos | `h-full w-full overflow-hidden rounded-full object-cover object-center` |
| dot | online | `bg-success-500 absolute right-0 bottom-0 block h-3 w-3 rounded-full border-[1.5px] border-white dark:border-gray-900` |
| dot | ausente | `bg-warning-500 absolute …` (idem) |
| dot | offline | `bg-error-500 absolute …` (idem) |
| nombre | item lista | `text-sm font-medium text-gray-800 dark:text-white/90` |
| nombre | cabecera chat box | `text-sm font-medium text-gray-500 dark:text-gray-400` |
| cargo/2ª línea | item lista | `text-theme-xs mt-0.5 text-gray-500 dark:text-gray-400` |
| hora | item lista | `text-theme-xs text-gray-400` |
| título panel | ambos h3 | `text-theme-xl font-semibold text-gray-800 sm:text-2xl dark:text-white/90` |
| burbuja | recibida | `rounded-lg rounded-tl-sm bg-gray-100 px-3 py-2 dark:bg-white/5` |
| burbuja | recibida + img | `max-w-max rounded-lg rounded-tl-sm bg-gray-100 px-3 py-2 dark:bg-white/5` |
| burbuja | enviada | `ml-auto max-w-max rounded-lg rounded-tr-sm bg-brand-500 px-3 py-2 dark:bg-brand-500` |
| burbuja | enviada continuación | `ml-auto mt-2 max-w-max rounded-lg rounded-tr-sm bg-brand-500 px-3 py-2 dark:bg-brand-500` |
| texto burbuja | recibida | `text-sm text-gray-800 dark:text-white/90` |
| texto burbuja | enviada | `text-sm text-white dark:text-white/90` |
| fila mensaje | recibida | `max-w-[350px]` |
| fila mensaje | enviada | `ml-auto max-w-[350px] text-right` |
| timestamp | ambos | `mt-2 text-theme-xs text-gray-500 dark:text-gray-400` |
| marco imagen | única | `mb-2 w-full max-w-[270px] overflow-hidden rounded-lg` |
| botón enviar | única | `ml-3 flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500 text-white hover:bg-brand-600 xl:ml-5` |
| icono composer | los 3 | `text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white/90` |

---

## 8. Tokens usados en esta página (resueltos contra `demo-style.css`)

| clase | definición | línea CSS |
|---|---|---|
| `brand-500` | `#465fff` | var |
| `brand-600` | `#3641f5` | var |
| `success-500` | `#12b76a` | var |
| `warning-500` | `#f79009` | var |
| `error-500` | `#f04438` | var |
| `gray-dark` | `#1a2231` (fondo de los dropdowns en dark) | var |
| `text-theme-xs` | `12px` | var |
| `text-theme-xl` | `20px` | var |
| `shadow-theme-xs` | `0px 1px 2px 0px rgba(16, 24, 40, 0.05)` | 3743 |
| `shadow-theme-lg` | `0px 12px 16px -4px rgba(16, 24, 40, 0.08), 0px 4px 6px -2px rgba(16, 24, 40, 0.03)` | 3728 |
| `custom-scrollbar` | thumb+track 6px (`--spacing`×1.5), `rounded-full`, thumb `--color-gray-200`; **en dark** `.dark .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #344054 }` | 1177 / 7506 |
| `no-scrollbar` | `::-webkit-scrollbar{display:none}` + `-ms-overflow-style:none` + `scrollbar-width:none` | 1130 |
| `z-999999` | definido | ✔ |
| `max-w-(--breakpoint-2xl)` | definido | ✔ |

Todos existen salvo lo de §9.

---

## 9. Qué NO copiar

1. **`dark:bg-dark-900`** — 1× en el input del buscador (§2.2). **Clase muerta**: `grep` de
   `.dark\:bg-dark-900` y de `--color-dark-900` en `demo-style.css` da **0**. Ni token ni regla.
   El fondo dark lo pone el `dark:bg-gray-900` que va detrás en la misma cadena. **Bórrala.**

2. **`sticky` sin offset** — 2 de los 3 `sticky` de la página **no hacen nada**:
   - `class="sticky px-4 pt-4 pb-4 …"` (cabecera del sidebar) → sin `top-*`, es `relative`.
   - `class="sticky flex items-center justify-between border-b …"` (cabecera del chat box) → idem.
   - Solo `sticky bottom-0` (composer) es real.
   Además, ninguna de las dos cabeceras necesita `sticky`: **no scrollean** (están fuera del scroller).
   Ruido: bórralo o añade `top-0` si de verdad lo quieres pegajoso.

3. **`dark:bg-brand-500`** — 3× en las burbujas enviadas. **No-op**: repite el `bg-brand-500` del modo
   claro. Inofensivo pero inútil.

4. **`dark:text-white/90` sobre `bg-brand-500`** — en `text-sm text-white dark:text-white/90`, el modo
   oscuro **baja el texto a 90% de opacidad sobre un fondo de marca sólido** (que no cambia en dark).
   Es un degradado de contraste gratuito. Usa `text-white` a secas.

5. **`dark:text-white/90` en el *chrome* de la burbuja enviada #2** (§4.4) — el `<p>` interior ya define
   su color; en el div padre no pinta nada.

6. **`flex-col` sin `flex` en la card del sidebar** — `class="flex-col overflow-hidden … xl:flex …"`:
   hasta `xl` el elemento es `display:block`, así que `flex-col` es inerte. Funciona por accidente
   (el drawer es `fixed`/`hidden`). Si tocas ese panel, pon `flex` explícito.

7. **`@click.outside="isMobile = !isMobile"`** (§2.3) — **toggle**, no cierre. Con el drawer cerrado, un
   clic fuera lo **abre**. Debe ser `isMobile = false`.

8. **Botones sin `type="button"` dentro de `<form>`** — composer (clip, mic) y buscador (lupa). Todos
   son `submit` implícito. Bug real en cuanto conectes el form.

9. **`<img>` sin clases dentro del marco de imagen** (§4.5) — se renderiza a tamaño natural; añade `w-full`.

10. **`fill="white"` hardcodeado** en el SVG del botón enviar — no se retematiza. Pásalo a `currentColor`
    (el botón ya tiene `text-white`).

11. **Dot de presencia sin etiqueta** — sin `aria-label`/`title`. Añádelo al portar.

12. **`max-h-full` sobre elementos `flex-1`/ya acotados** — aparece 4×; redundante en todos.

13. **El `<p>` bajo el nombre del item NO es un preview de mensaje**, es el cargo (§2.4). No copies la
    semántica pensando que es un preview: si lo conviertes en preview, **hace falta `truncate`** que
    la receta original no trae.

14. **Orden de clases incoherente** entre panel y panel (§1) y **paletas distintas** para el mismo kebab
    (§3). No intentes reproducir la incoherencia; elige una.

---

## 10. Lo que esta página NO tiene (no lo busques, no lo inventes)

Verificado por `grep` sobre `chat-main.html` — todo esto **da 0 resultados**:

- ❌ **Badge de no-leídos** — `grep -icE "badge|unread|notification"` → **0**. No hay contador, ni punto,
  ni negrita de "no leído". El item de conversación tiene **una sola forma**.
- ❌ **Estado activo/seleccionado** — `grep -inE "active|selected"` → **0**. La cadena del item aparece
  **9× byte a byte idéntica**: no hay `bg-brand-50`, ni borde, ni `aria-current`. El único feedback es
  `hover:bg-gray-100 dark:hover:bg-white/[0.03]`. **La conversación abierta no se marca en la lista.**
- ❌ **Texto de estado en la cabecera** ("online", "last seen…") — solo el dot verde (§3).
- ❌ **Preview del último mensaje** — es el cargo (§2.4).
- ❌ **Adjunto de fichero** (PDF/doc), **audio**, **respuesta citada**, **reacciones**, **separador de fecha**
  ("Today"/"Yesterday"), **indicador de escribiendo…**, **checks de entregado/leído**, **estado vacío**,
  **buscador funcional** (el `<form>` no filtra nada), **auto-scroll**.
- ❌ **Agrupación en recibidos** (§4.4) y **desactivación del radio de cola** en continuaciones.

Nada de esto lo genera Alpine tampoco: el `x-data` de la página es solo `isMobile` + `openDropDown`,
y **los 5 mensajes están escritos a mano en el HTML** — no hay `x-for`, ni plantilla, ni fuente de datos.
Si el skill necesita cualquiera de esos estados, **hay que diseñarlos**: TailAdmin no los da aquí.
