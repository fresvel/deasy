# Auditoría: las páginas con tabla de admin y de perfil — 2026-08-21

Encargo del dueño tras **tres errores seguidos** en F13.4, los tres vistos por él y ninguno por un
gate: *«¿acaso no son los mismos componentes? El código de admin debe ser el mismo que el de perfil,
solo debe cambiar el contenido».*

Todo lo de abajo está medido: el árbol, en el DOM vivo; los tamaños, con `wc -l`.

---

## 1 · Qué se comparte de verdad, y qué no

| Pieza | Admin | Perfil | ¿Compartida? |
|---|---|---|---|
| La tabla | `AppDataTable` | `AppDataTable` | ✅ **sí** — 19 sitios en todo el proyecto |
| La barra | `AppTableToolbar` | `AppTableToolbar` | ✅ **sí** — desde F13.4 |
| **Quién coloca las dos** | `AdminMainTableSection` (460 L) | `ProfileSectionShell` (74 L) | ❌ **no** |
| **Quién pinta las pestañas** | `AdminTableManager`, **marcado en línea** | `ProfileSubsectionTabs` (42 L) | ❌ **no** |
| Los botones | `AdminTableHeader` (92 L) | dentro de `ProfileSectionShell` | ❌ **no** |

**La respuesta corta a la pregunta del dueño: la tabla y la barra sí; el armazón que las coloca,
no.** Y ahí es donde han salido los tres errores.

---

## 2 · Los dos árboles, uno al lado del otro

### Admin — `/admin/gestiones/firmas/signature_flow_steps`

    div.w-full flex-1 overflow-hidden relative flex flex-col   ← AdminTableManager (4 278 L)
      div.deasy-typography w-full h-full relative overflow-y-auto
        div.flex flex-col gap-3
          div.pt-0.5 pb-1                    ← ⚠️ PESTAÑAS, marcado EN LINEA, FUERA de la barra
            div.deasy-inline-tabs
              button.deasy-inline-tab  ×4
          section.space-y-4                  ← AdminMainTableSection (460 L)
            div.deasy-table-toolbar          ← AppTableToolbar
              div.deasy-table-toolbar__head        → el título
              div.deasy-table-toolbar__bar
                div.deasy-table-toolbar__filtro    → el buscador
                div.deasy-table-toolbar__actions   → 5 botones
            div
              div.deasy-table-responsive     ← AppDataTable

### Perfil — `/perfil/formacion`

    div (sin clase)                          ← PerfilView > router-view > FormacionSection
      div.w-full                             ← DossierSectionCrud (155 L)
        div.deasy-table-toolbar              ← AppTableToolbar, vía ProfileSectionShell (74 L)
          div.deasy-table-toolbar__head            → el título
          div.deasy-table-toolbar__bar
            div.deasy-table-toolbar__filtro        → ⚠️ PESTAÑAS, DENTRO de la barra
            div.deasy-table-toolbar__actions       → 2 botones
        div.mt-4
          div.deasy-table-responsive         ← AppDataTable

---

## 3 · Las tres inconsistencias, y por qué se produjeron

| # | Qué se vio | Causa real |
|---|---|---|
| **1** | El botón «Agregar» ocupaba la fila entera en el organigrama | `AdminTableHeader` pasó a ser *solo botones* y **la copia suelta se quedó sin barra**: sus hijos caían como bloques en una columna flex |
| **2** | En perfil faltaban botones y el título no salía | El título estaba puesto como *contenido por defecto* del slot de pestañas; y perfil **no tenía** «Actualizar» aunque `loadDossier` ya existía |
| **3** | En admin el título va **debajo** de las pestañas y en perfil **encima** | **Las pestañas de admin no están en la barra**: las pinta `AdminTableManager` con marcado en línea, en un `div.pt-0.5 pb-1`, **antes** de la sección |

**Las tres tienen la misma raíz**: la barra se comparte, pero **quién la rodea y en qué orden, no**.
Mientras el armazón sean dos componentes distintos, cada arreglo hay que hacerlo dos veces — y la
segunda se olvida.

---

## 4 · Lo que además queda medido

- **`AdminTableManager` tiene 4 278 líneas** y dentro lleva el marcado de las pestañas. Es uno de
  los tres ficheros de F7.
- `AdminMainTableSection` tiene **460 L** contra las **74** de `ProfileSectionShell`: no son
  comparables porque el primero carga además los filtros avanzados de cuatro tablas.
- Las clases de estilo **sí están unificadas**: las dos familias usan exactamente
  `deasy-table-toolbar`, `__head`, `__bar`, `__filtro`, `__actions`, `deasy-inline-tabs`,
  `deasy-inline-tab`, `deasy-table-responsive` y `deasy-btn`. **La divergencia no está en el CSS.**

---

## 5 · Lo que haría falta para que sea «el mismo código»

Un solo componente de página con tabla que reciba **datos**, y que ambas familias monten:

    <AppTablePage :title="…" :tabs="…" :actions="…">   ← coloca barra + tabla, en ESE orden
      <template #filtro>  …buscador o pestañas…  </template>
      <template #actions> …botones…             </template>
      <AppDataTable … />
    </AppTablePage>

Con eso, las pestañas de admin **dejan de vivir en `AdminTableManager`** y entran por el mismo slot
que las de perfil, que es lo que arregla el error 3 de raíz y no solo en una pantalla.

⚠️ **No es un cambio de disposición: es sacar marcado de un fichero de 4 278 líneas**, que es
exactamente el trabajo de F7. Por eso se propone, no se ejecuta sin decisión.
