# Separacion de tablas runtime en Trazabilidad y soporte

## Objetivo

Reorganizar la navegacion administrativa de Tareas, Documentos, Entregas y Firmas para que las tablas tecnicas generadas durante la ejecucion no aparezcan mezcladas con las tablas de configuracion y las acciones operativas principales.

La interfaz debe priorizar lo que cada rol necesita hacer y mantener los datos tecnicos disponibles para consulta, diagnostico y soporte.

## Archivos principales

- `frontend/src/modules/admin/views/AdminView.vue`
- `frontend/src/modules/procesos/views/ProcessManagementView.vue`
- `frontend/src/modules/admin/components/tables/AdminTableManager.vue`
- `frontend/src/core/utils/accessControl.js`

Reutilizar los componentes, permisos y patrones existentes. No cambiar contratos del backend ni crear un segundo CRUD.

## Clasificacion de tablas

### Configuracion

Estas tablas definen el comportamiento de los procesos y deben permanecer en la navegacion principal de configuracion:

- `processes`
- `process_definition_series`
- `process_definition_versions`
- `process_definition_triggers`
- `process_target_rules`
- `template_seeds`
- `template_artifacts`
- `process_definition_templates`
- `fill_flow_templates`
- `fill_flow_steps`
- `signature_flow_templates`
- `signature_flow_steps`
- `signature_types`
- `signature_statuses`
- `signature_request_statuses`

### Operacion principal

Estas entidades pueden aparecer como accesos operativos o resúmenes porque representan objetos reconocibles para el gestor:

- `process_runs`
- `tasks`
- `documents`

La interfaz debe priorizar acciones de negocio como:

- generar o iniciar tareas;
- revisar tareas y responsables;
- consultar documentos y entregables;
- revisar entregas pendientes;
- revisar firmas pendientes;
- abrir el detalle operativo de un documento.

### Trazabilidad y soporte

Estas tablas son principalmente registros runtime materializados o actualizados por los flujos del sistema:

- `task_items`
- `task_item_tenures`
- `document_versions`
- `document_fill_flows`
- `fill_requests`
- `signature_flow_instances`
- `signature_requests`
- `document_signatures`

Deben agruparse en un bloque secundario llamado **Trazabilidad y soporte**.

## Comportamiento de la navegacion

### Vista normal

- Mostrar primero las secciones de Configuracion y Operacion.
- No mostrar las tablas runtime como opciones principales al entrar al modulo.
- Mostrar resúmenes agregados cuando la informacion esté disponible:
  - tareas activas y vencidas;
  - documentos por estado;
  - entregas pendientes, observadas o aprobadas;
  - firmas pendientes, parciales o completadas.
- Desde cada resumen se debe abrir el flujo o registro de negocio correspondiente, no una tabla tecnica aislada.

### Trazabilidad y soporte

- Presentar el bloque separado visualmente de Configuracion y Operacion.
- Mantenerlo colapsado por defecto.
- Incluir una descripcion breve: contiene registros tecnicos generados durante la ejecucion de tareas, entregas y firmas.
- Mostrar solamente las tablas que el usuario pueda consultar de acuerdo con los permisos existentes.
- Conservar filtros, paginacion y visualizacion de relaciones proporcionados por `AdminTableManager`.

## Reglas por rol

### Gestores

- Pueden consultar las tablas runtime si sus permisos actuales permiten lectura.
- No deben recibir acceso de edicion directa solo por poder consultar el bloque.
- Deben operar mediante acciones del modelo de negocio siempre que exista una accion equivalente.
- La informacion tecnica debe ser secundaria y no dominar la navegacion.

### AdminSistema

- Mantiene acceso completo al CRUD y a las herramientas de diagnostico.
- Puede crear, actualizar o eliminar registros cuando los permisos y validaciones actuales lo permitan.
- Debe ver una advertencia visual antes de editar directamente una tabla runtime.

### Auditor

- Puede consultar la trazabilidad según sus permisos.
- Todas las acciones de escritura deben permanecer ocultas.

## Modo avanzado

Si se implementa un modo avanzado:

- debe estar desactivado por defecto;
- debe ser visible únicamente para `AdminSistema`;
- debe habilitar las acciones directas del CRUD sobre tablas runtime;
- debe mostrar una advertencia indicando que la edición puede afectar la consistencia del flujo;
- no debe modificar ni reemplazar las validaciones del backend.

No almacenar esta preferencia como un permiso nuevo. La autorización efectiva debe seguir dependiendo del RBAC existente.

## Restricciones

- No eliminar tablas de `SQL_TABLES`.
- No eliminar endpoints de `/admin/sql`.
- No modificar contratos de datos.
- No duplicar `AdminTableManager`.
- No trasladar reglas de negocio al frontend.
- No conceder permisos adicionales.
- No ocultar información requerida para auditoría.
- No convertir las tarjetas operativas de llenado y firmas en listas planas.

## Implementacion sugerida

1. Extraer constantes compartidas para clasificar tablas en configuracion, operacion y trazabilidad.
2. Reutilizar esa clasificacion en `AdminView.vue` y `ProcessManagementView.vue`.
3. Crear el bloque colapsable **Trazabilidad y soporte** utilizando los componentes de navegacion existentes.
4. Mantener Configuracion y Operacion como secciones visibles por defecto.
5. Calcular la visibilidad de cada tabla con `canReadAdminTable`.
6. Calcular las acciones de escritura con `canCreateAdminTable`, `canUpdateAdminTable` y `canDeleteAdminTable`.
7. Para tablas runtime, ocultar acciones de escritura salvo que el usuario sea `AdminSistema` y el modo avanzado esté activo.
8. Mantener el backend como autoridad final de permisos.
9. Ejecutar lint dirigido sobre los archivos modificados.
10. Verificar visualmente la navegacion con perfiles de gestor, administrador y auditor.

## Criterios de aceptacion

- Un gestor no ve inmediatamente todas las tablas tecnicas al entrar a Gestiones o Procesos.
- Configuracion, Operacion y Trazabilidad están diferenciadas visual y semanticamente.
- **Trazabilidad y soporte** aparece colapsado por defecto.
- Las tablas runtime continúan disponibles para consulta cuando el rol tiene permiso de lectura.
- Las acciones directas de crear, editar y eliminar registros runtime no aparecen para gestores ni auditores.
- `AdminSistema` conserva acceso de escritura mediante el modo avanzado.
- Las acciones operativas normales siguen utilizando los endpoints de negocio existentes.
- No se rompen el CRUD genérico, los permisos RBAC ni la navegacion actual.
- La interfaz funciona en escritorio y movil.
- El frontend supera `pnpm run lint` o el lint dirigido de los archivos modificados.

## Resultado esperado

La navegacion principal muestra lo necesario para configurar y operar el sistema. Los registros internos de ejecución permanecen disponibles en **Trazabilidad y soporte**, sin sobrecargar la experiencia diaria de los gestores ni eliminar las capacidades de diagnóstico del administrador.
