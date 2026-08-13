---
title: "El CRUD genérico de administración"
description: "Añadir una tabla al panel es añadir una entrada al catálogo. Con su contrapartida."
sidebar:
  order: 5
---
Esta es una de las piezas mas ingeniosas del backend. En vez de escribir un controlador para cada una de las 44 tablas administrables, hay tres ficheros que colaboran:

- **`backend/config/sqlTables.js`** (1.001 líneas): un **catalogo declarativo** de metadatos. Para cada tabla describe sus campos, etiquetas humanas, tipos, cuales son obligatorios y cuales de solo lectura.

- **`backend/services/admin/SqlAdminService.js`** (901 líneas): lee ese catalogo y **construye los SELECT, INSERT, UPDATE y DELETE dinamicamente**.

- **`backend/services/admin/crud/tableHooks.js`** (1.120 líneas): los “injertos” — la lógica especial que necesita cada tabla concreta.

Una entrada del catalogo tiene esta forma:

``` javascript
{
  table: "unit_types",
  label: "Tipos de unidad",
  category: "Estructura",
  primaryKeys: ["id"],
  fields: [
    { name: "name", label: "Nombre", type: "text", required: true },
    ...
  ],
  searchFields: ["name"]
}
```

**Ventaja**: anadir una tabla al panel de administración es anadir una entrada al catalogo, no escribir un CRUD entero. **Desventaja**: `tableHooks.js` se ha convertido en un cajon de sastre. El `CLAUDE.md` avisa: *“No injertes casos especiales en el camino genérico. Es el olor que hizo God a AdminTableManager”*.
