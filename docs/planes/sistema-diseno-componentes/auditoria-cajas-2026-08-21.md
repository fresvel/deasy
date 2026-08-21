# Auditoría de cajas y tarjetas — 2026-08-21

Encargo del dueño al revisar F13.3: *«hay sitios que tienen una caja contenedora general y otros no
la tienen… audita qué otros grupos de divergencia existen, cuáles se pueden converger y cuáles
deberían mantenerse como propias»*.

Todo lo de abajo está **medido en el navegador** (pila B, `getComputedStyle` +
`getBoundingClientRect` tras `document.fonts.ready`) sobre 9 rutas, más censo en código. Ninguna
cifra es estimada.

---

## Grupo 1 · La tarjeta pulsable en rejilla — **CINCO recetas para un trabajo**

Es el grupo que el dueño señaló. Todas hacen lo mismo: *una caja con borde que lleva a algún
sitio*. Ninguna comparte geometría con otra.

| # | Receta | Dónde | Radio | Pad | Fondo | Alto | Cols en XL | Hover |
|---|---|---|---|---|---|---|---|---|
| **A** | `deasy-tile` | `/home` (7) · `/home/firmas` (3) | 16 | 24 | **blanco al 50 %** | 304 / 331 | 3 · 4 | borde azul + fondo azul + **sombra** |
| **B** | `deasy-card` + `signature-workspace-card` | `/home/firmas` (4) | 16 | 24 | blanco | 304 | 4 | **ninguno propio** |
| **C** | `deasy-nav-card--stacked` | `/admin`, `/admin/academia`, `/admin/gestiones`, `/perfil`, `/procesos` | **12** | **20** | blanco | 152 | **3** | borde `line-strong` + fondo `surface` |
| **D** | `deasy-card p-4` | `/procesos` (4 contadores) | 16 | **16** | blanco | 70 | 4 | — |
| **E** | `deasy-picker` | 32 usos en 7 ficheros | 12 | 16 | blanco | fila | — | **translate** + azul |

⚠️ **La rejilla que el dueño quiere tomar como patrón no es uniforme ni consigo misma.** En
`/home/firmas` conviven **A y B en la MISMA rejilla**: 4 tarjetas `deasy-card` de 304 px con fondo
blanco y 3 `deasy-tile` de 331 px con fondo blanco al 50 %. Se ven casi iguales y no lo son.

⚠️ **`signature-workspace-card` no es una receta.** No existe como regla propia: en `signatures.css`
solo aparece como *selector de contexto* (`.signature-workspace-card .signature-workspace-icon`).
Es una etiqueta sin cuerpo, y por eso la geometría la pone la clase de debajo — que en 4 casos es
`deasy-card` y en 3 `deasy-tile`.

### Lo que converge, y lo que no

**CONVERGEN (A · B · C)** — son el mismo objeto con tres geometrías. Juntas son **~26 instancias
renderizadas** en 6 rutas. `deasy-tile` **ya es casi el destino**: su receta es
`rounded-2xl border-line bg-surface/50 p-6 min-h-76` con el hover de `/home`, que es exactamente lo
que el dueño pidió («la de firmas, con el hover de home»). Falta darle nombre propio, la variante
punteada y la rejilla de 4.

**NO CONVERGEN, y el motivo no es comodidad:**

- **D · los contadores de `/procesos`** miden 70 px de alto, **no son pulsables** y no llevan a
  ningún sitio: son una lectura numérica. Meterlos en la tarjeta de navegación les daría un hover
  que miente sobre lo que hacen.
- **E · `deasy-picker`** es una **fila**, no una tarjeta: `w-full`, `items-center`, `gap-3`, y vive
  dentro de formularios y modales para elegir uno de una lista. Distinta forma y distinto trabajo.
  Son **32 usos**; migrarla sería rehacer los formularios, no homogeneizar tarjetas.
- **`deasy-card` a secas (165 usos)** es la **primitiva de superficie**
  (`rounded-2xl border border-line bg-white`) sobre la que se construye todo lo demás. No es una
  tarjeta: es el material del que están hechas.

---

## Grupo 2 · La caja contenedora de página — **TRES comportamientos**

| Comportamiento | Rutas | Qué declara |
|---|---|---|
| `deasy-section-card` | `/admin` **índice** · `/procesos` **índice** | pad **32**, borde 1, radio 16, blanco |
| Un `deasy-card` haciendo ese papel | `/home/firmas` | pad **0** … y dentro otro con pad 32 |
| **Ninguna** | `/home` · `/perfil` · **y todas las rutas de tabla** | — |

⚠️ **La caja aparece y desaparece dentro de la MISMA vista, por el mismo condicional que causaba el
salto de ancho de F13.3**: `v-if="!selectedTable"`. Medido:

    /admin                              deasy-section-card  1500x587   pad 32  borde 1  radio 16
    /admin/usuarios/personas/persons    (ninguna)           1500x1937  pad  0  borde 0  radio  0

O sea: el índice va dentro de una caja blanca y la tabla flota sobre el fondo. `deasy-section-card`
tiene **2 usos en todo el proyecto** — no es «la caja del sistema», es una excepción con nombre.

---

## Grupo 3 · Las cajas dobles — **dos sitios, dos bordes concéntricos**

El dueño vio una; hay dos.

**(a) `/home` — una por tarjeta.** Cada `deasy-tile` (484×304, pad 24, radio 16, fondo blanco al
50 %) contiene un `deasy-card` (434×210, pad **32/24**, radio 16, blanco). **Dos bordes, dos fondos
y dos radios de 16 px concéntricos separados por 24 px de padding.** Son 7 tarjetas × 2 cajas.

**(b) `/home/firmas` — una en la página.** Un `deasy-card` de 1500×807 con **pad 0** que contiene
otro `deasy-card mt-4 p-6 lg:p-8` de 1434×725 con pad 32. El de fuera no aporta padding ni
separación: solo un borde y un fondo idénticos a los del de dentro.

---

## Grupo 4 · Las cajas punteadas — **2 recetas legítimas y 18 sueltas**

| Receta | Dónde | Radio | Borde | Trabajo |
|---|---|---|---|---|
| `AppEmpty` (`surfaces.css`) | 45 usos | 16 | 1 discontinuo, `line` | «aquí no hay nada» |
| `deasy-dropzone__surface` | formularios | 12 | **2** discontinuo, azul | «suelta un fichero» |

Las dos están bien y hacen cosas distintas (el de 2 px es deliberado: uno discontinuo de 1 px se ve
la mitad, y está escrito en `forms.css`). Pero hay **18 apariciones de `border-dashed`** en el
proyecto y solo 2 vienen de una receta: las otras **16 son punteados escritos a mano** en modales de
admin, paneles de firma y pestañas de entregable.

---

## Resumen de la deriva

| Grupo | Recetas hoy | Deberían ser | Instancias afectadas |
|---|---|---|---|
| Tarjeta pulsable en rejilla | **5** | **1 + variantes** (D y E se quedan) | ~26 |
| Caja contenedora de página | **3** | **1**, y siempre presente | 6 vistas |
| Cajas dobles | 2 sitios | **0** | 8 cajas |
| Punteadas | 2 recetas + 16 a mano | **2 recetas, 0 a mano** | 16 |
