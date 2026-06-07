# Bootstrap del sistema

## Catálogos genéricos

`GET /deasy/v1/system/bootstrap/status` incluye `catalogOptions` con los registros permitidos para:

- `unit_types`
- `cargos`
- `term_types`

Cada opción contiene un `id` estable y una etiqueta para la interfaz. Los tipos de periodo también incluyen su descripción.

`POST /deasy/v1/system/bootstrap/initialize` recibe la selección dentro de `preconfig`:

```json
{
  "preconfig": {
    "unit_types": ["Dirección", "Carrera", "Sede"],
    "relation_unit_types": true,
    "cargos": ["COORDINADOR", "DOCENTE"],
    "term_types": ["SEM", "INT"]
  }
}
```

Los arreglos solo aceptan identificadores publicados por `catalogOptions`; cualquier valor desconocido se descarta. Para compatibilidad con clientes anteriores, el valor booleano `true` continúa seleccionando el bloque completo.

El catálogo fuente se mantiene en `backend/services/system/genericCatalog.js`. El frontend no duplica esos registros.
