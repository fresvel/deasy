# AdminTableManager Taxonomy

## Estado actual

- Archivo principal: `frontend/src/views/admin/components/AdminTableManager.vue`
- Lineas actuales: `8363`
- Distribucion:
  - template: `2808`
  - script: `5556`
  - style local: `2`

## Que queda dentro del componente

### 1. Orquestacion de modales

La mayor concentracion de funciones repetitivas sigue en la administracion de modales.

Patrones activos:
- `ensure*Instance`
- `open*`
- `close*`
- `accept*`
- `confirm*`

Esto no es logica de dominio; es flujo de interfaz. La siguiente extraccion recomendable es una capa dedicada de coordinacion de modales del admin.

### 2. FK manager

Aunque ya se extrajeron payloads y configuracion, el componente sigue concentrando:
- busqueda FK
- sugerencias inline
- labels cacheados
- filtros FK
- visores FK
- navegacion entre modales FK

Este bloque sigue siendo uno de los candidatos mas grandes para separarse.

### 3. Definiciones de proceso

Se redujo la logica declarativa y de payloads, pero siguen juntas en el componente:
- apertura/cierre de managers
- autofill desde FK
- sincronizacion de checklist con estado UI
- flujo de activacion y promocion de version

Esto sigue siendo un subdominio propio y reusable.

### 4. Asignaciones de personas

Ya salieron defaults, validaciones y CRUD base, pero quedan:
- edicion de filas
- sincronizacion de labels
- integracion con FK search
- apertura del modal y recarga de tablas

Tambien es un bloque que puede separarse sin afectar el resto del admin.

## Clasificacion de botones

Conteo actual de variantes `AdminButton` en `AdminTableManager.vue`:

- `secondary`: `42`
- `outlinePrimary`: `18`
- `outlineDanger`: `8`
- `primary`: `5`
- `success`: `1`
- `menu`: `1`
- `plain`: `1`

### Taxonomia funcional recomendada

#### 1. Action buttons

Uso:
- refrescar
- limpiar filtros
- abrir buscadores
- cerrar modales sin accion destructiva

Mapeo actual:
- `secondary`

Componente base propuesto:
- `AdminActionButton`

#### 2. Submit buttons

Uso:
- guardar
- crear
- confirmar busquedas
- aceptar flujos

Mapeo actual:
- `primary`
- `success`

Componente base propuesto:
- `AdminSubmitButton`

#### 3. Secondary confirm buttons

Uso:
- agregar reglas
- agregar disparadores
- aceptar submanagers
- CTA intermedias no destructivas

Mapeo actual:
- `outlinePrimary`

Componente base propuesto:
- `AdminConfirmButton`

#### 4. Destructive buttons

Uso:
- eliminar
- cerrar con semantica de cancelacion fuerte
- cancelar acciones sensibles

Mapeo actual:
- `outlineDanger`

Componente base propuesto:
- `AdminDangerButton`

#### 5. Navigation buttons

Uso:
- cambiar seccion del modal de asignaciones
- tabs o menues internos

Mapeo actual:
- `menu`
- `plain`

Componente base propuesto:
- `AdminNavButton`

#### 6. Row action buttons

Uso:
- ver
- editar
- eliminar
- seleccionar
- asignar

Mapeo actual:
- `AdminTableActions`
- `BtnEdit`
- `BtnDelete`

Componente base propuesto:
- mantener `AdminTableActions` como wrapper de composicion
- centralizar iconos y tokens visuales por accion

## Clasificacion de inputs

Conteo directo en `AdminTableManager.vue`:

- `AdminLookupField`: `14`
- `select`: `11`
- `input[type=text]`: `5`
- `input[type=date]`: `6`
- `input[type=number]`: `2`
- `input[type=file]`: `4`
- `textarea`: `0`

### Taxonomia funcional recomendada

#### 1. Lookup inputs

Uso:
- FK y referencias internas

Componente actual:
- `AdminLookupField`

Estado:
- ya es el input reusable mas consolidado del admin

#### 2. Text inputs

Uso:
- filtros de texto
- relacion
- dedicacion
- slug, nombre, descripcion

Componente base propuesto:
- `AdminTextField`

#### 3. Date inputs

Uso:
- inicio/fin
- vigencia

Componente base propuesto:
- `AdminDateField`

#### 4. Number inputs

Uso:
- prioridad
- orden

Componente base propuesto:
- `AdminNumberField`

#### 5. Select inputs

Uso:
- estados
- modos
- tipos
- flags booleanos tipo si/no

Componente base propuesto:
- `AdminSelectField`

#### 6. File inputs

Uso:
- draft artifact uploads

Componente actual parcial:
- dropzone inline

Componente base propuesto:
- `AdminFileDropzoneField`

## Agrupaciones reutilizables pendientes

### Filtro de tabla

Patron repetido:
- input de busqueda
- uno o mas selects/lookups
- acciones limpiar/actualizar

Componente propuesto:
- `AdminFilterBar`

### Form row

Patron repetido:
- label
- input/select/lookup
- estado disabled

Componente propuesto:
- `AdminFieldGroup`

### Form actions

Patron repetido:
- guardar
- cancelar edicion
- cerrar
- aceptar

Componente propuesto:
- `AdminFormActions`

### Modal manager shell

Patron repetido:
- contexto
- error
- formulario
- tabla
- footer

Componente propuesto:
- `AdminManagerModal`

## Siguiente fase recomendada

1. Extraer la orquestacion FK a un modulo propio.
2. Crear `AdminFieldGroup`, `AdminTextField`, `AdminDateField`, `AdminNumberField`, `AdminSelectField`.
3. Crear `AdminFormActions` y reemplazar footers repetidos.
4. Solo despues de eso iniciar la eliminacion total de clases heredadas de Bootstrap y la migracion absoluta a Tailwind.
