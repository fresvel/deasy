# AdminTableManager Refactor

## Estado actual

`frontend/src/views/admin/components/AdminTableManager.vue` concentra actualmente:

- render de toolbar y listado principal
- buscadores inline y filtros por tabla
- CRUD genérico de tablas SQL
- resolución de foreign keys
- visualización de registros relacionados
- modales anidados de búsqueda, edición, borrado y detalle
- gestión especializada de `process_definition_versions`
- gestión especializada de `process_target_rules`
- gestión especializada de `process_definition_triggers`
- gestión especializada de `process_definition_templates`
- gestión especializada de `template_artifacts`
- gestión especializada de asignaciones de personas

El archivo supera las 10k líneas porque mezcla:

- UI
- estado local
- navegación entre modales
- acceso HTTP
- validaciones
- formateo de datos
- lógica de negocio específica

## Problemas detectados

- Acoplamiento fuerte entre UI y reglas de negocio.
- Dependencia semántica de Bootstrap en markup y estilos.
- Flujo de modales centralizado en un único componente.
- Muchas operaciones HTTP directas con `axios`.
- Dificultad alta para probar, mantener o migrar estilos.

## Componentes candidatos

### Shell y navegación

- `AdminTableManagerShell`
- `AdminTableToolbar`
- `AdminTableFeedbackToast`
- `AdminTableGrid`
- `AdminTableEmptyState`

### CRUD base

- `AdminEditorModal`
- `AdminDeleteModal`
- `AdminRecordViewerModal`

### Foreign keys

- `ForeignKeySearchModal`
- `ForeignKeyViewerModal`
- `ForeignKeyFilterModal`
- `ForeignKeyCreateModal`
- `ForeignKeyInlineAutocomplete`

### Proceso definido

- `ProcessDefinitionVersioningModal`
- `ProcessDefinitionActivationModal`
- `DefinitionRulesManagerModal`
- `DefinitionTriggersManagerModal`
- `DefinitionArtifactsManagerModal`
- `DefinitionArtifactsPromptModal`

### Personas

- `PersonAssignmentsModal`
- `PersonCargoSection`
- `PersonRoleSection`
- `PersonContractSection`

### Filtros por dominio

- `ProcessFiltersBar`
- `ProcessDefinitionFiltersBar`
- `ProcessTargetRuleFiltersBar`
- `TemplateArtifactFiltersBar`
- `UnitPositionFiltersBar`

## Servicios POO candidatos

- `AdminSqlService`
  - CRUD genérico
  - sincronización de seeds y artifacts
  - creación y actualización de drafts

- `AdminFkService`
  - búsqueda de referencias
  - etiquetas de FK
  - filtros específicos para tablas relacionadas

- `ProcessDefinitionAdminService`
  - versionado
  - activación
  - checklist
  - reglas
  - triggers
  - artifacts

- `PersonAssignmentsAdminService`
  - cargos
  - roles
  - contratos

- `AdminModalFlowService`
  - pila de retorno entre modales
  - restauración de modal padre
  - coordinación de cierres

## Orden recomendado

1. Corregir compatibilidad funcional de modales y validar flujos críticos.
2. Extraer acceso HTTP base a servicios POO.
3. Separar subcomponentes de modal sin cambiar comportamiento.
4. Extraer servicios de dominio.
5. Reemplazar markup Bootstrap-like por componentes y utilidades Tailwind.
6. Eliminar capa de compatibilidad Bootstrap en `theme.css` y `tailwind.css`.

## Criterio de finalización

La migración se considerará completa cuando:

- `AdminTableManager.vue` deje de concentrar modales de dominio.
- no haya llamadas HTTP directas en el componente principal
- no existan clases Bootstrap ni alias Bootstrap en templates
- `frontend/src/styles/tailwind.css` no redefina `.btn`, `.modal`, `.row`, `.col-*`, `.form-control`, `.table`
- `frontend/src/styles/theme.css` no contenga selectores ni variables `--bs-*`
