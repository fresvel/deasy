# Configuración de Tablas SQL

## Resumen
El archivo `sqlTables.js` ubicado en `backend/config/` define la configuración para todas las tablas SQL utilizadas en el backend del proyecto Deasy. Exporta dos objetos principales:
- `SQL_TABLES`: Un arreglo de objetos de configuración de tablas
- `SQL_TABLE_MAP`: Un objeto mapa donde las claves son nombres de tablas y los valores son las configuraciones correspondientes de las tablas
Esta configuración se utiliza para generar dinámicamente esquemas de base de datos, endpoints de API y componentes de UI para gestionar los datos de la aplicación.
## Estructura
Cada configuración de tabla en `SQL_TABLES` es un objeto con las siguientes propiedades:
- `table`: El nombre de la tabla en la base de datos (cadena)
- `label`: Etiqueta legible para humanos de la tabla (cadena)
- `category`: Agrupación de categoría para la tabla (cadena)
- `primaryKeys`: Arreglo de nombres de campos de clave primaria (arreglo de cadenas)
- `fields`: Arreglo de definiciones de campos (arreglo de objetos)
- `searchFields`: Arreglo de nombres de campos que se pueden buscar (arreglo de cadenas)
### Estructura de Definición de Campo
Cada campo en el arreglo `fields` tiene estas propiedades:
- `name`: Nombre de columna en la base de datos (cadena)
- `label`: Etiqueta legible para humanos (cadena)
- `type`: Tipo de dato (ej. "text", "number", "boolean", "date", "datetime", "email", "textarea", "select")
- `required`: Si el campo es requerido (booleano, opcional)
- `defaultValue`: Valor por defecto para el campo (cualquier tipo, opcional)
- `readOnly`: Si el campo es de solo lectura (booleano, opcional)
- `options`: Para campos select, arreglo de valores posibles (arreglo de cadenas, opcional)
- `virtual`: Si este es un campo virtual/computado (booleano, opcional)
## Lista de Tablas
Las siguientes tablas están definidas en la configuración:
### Estructura
- `unit_types`: Tipos de unidad
- `relation_unit_types`: Tipos de relacion
- `units`: Unidades
- `unit_relations`: Relaciones de unidades
- `unit_positions`: Puestos
- `position_assignments`: Ocupaciones
### Procesos
- `processes`: Procesos
- `process_definition_versions`: Definicion de procesos
- `process_definition_series`: Variantes de procesos definidos
- `process_target_rules`: Reglas de alcance
- `process_definition_triggers`: Disparadores de definiciones
- `tasks`: Tareas
- `task_items`: Items de tareas
- `task_assignments`: Asignaciones de tareas
### Académico
- `term_types`: Tipos de periodo
- `terms`: Periodos
### Plantillas
- `template_seeds`: Seeds de plantilla
- `template_artifacts`: Paquetes de plantilla
- `process_definition_templates`: Plantillas de procesos definidos
### Usuarios
- `persons`: Usuarios
### Seguridad
- `roles`: Roles
- `cargo_role_map`: Mapa cargo-rol
- `permissions`: Permisos
- `role_permissions`: Permisos por rol
- `role_assignments`: Asignaciones de rol
- `role_assignment_relation_types`: Relaciones de asignacion de rol
### Personas
- `cargos`: Cargos
### Documentos
- `documents`: Documentos
- `document_versions`: Versiones de documento
- `document_signatures`: Firmas de documento
### Firmas
- `signature_types`: Tipos de firma
- `signature_statuses`: Estados de firma
- `signature_request_statuses`: Estados de solicitud
- `signature_flow_templates`: Plantillas de flujo
- `signature_flow_steps`: Pasos de firma
- `signature_flow_instances`: Instancias de flujo
- `signature_requests`: Solicitudes de firma
### Contratos
- `vacancies`: Vacantes
- `vacancy_visibility`: Visibilidad de vacante
- `contracts`: Contratos
## Uso
Esta configuración se importa y utiliza en todo el backend para:
- Generar scripts de migración de base de datos
- Crear endpoints de API REST para operaciones CRUD
- Construir formularios y tablas dinámicas en el frontend
- Validar entrada y salida de datos
- Definir capacidades de búsqueda y filtrado
El `SQL_TABLE_MAP` proporciona acceso rápido de búsqueda a las configuraciones de tablas por nombre de tabla.