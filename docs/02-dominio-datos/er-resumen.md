# Dominio y datos - ER (resumen textual)

## Estructura academica

unit_types 1─∞ units
relation_unit_types 1─∞ unit_relations
units 1─∞ unit_relations (parent_id)
units 1─∞ unit_relations (child_id)

## Procesos y plantillas

processes 1─∞ processes (parent_id)
processes 1─∞ process_units
units 1─∞ process_units
processes ∞─∞ units (via process_units)
processes 1─∞ process_versions
term_types 1─∞ terms
terms 1─∞ tasks
process_versions 1─∞ tasks
tasks 1─∞ tasks (parent_task_id)
tasks ∞─∞ unit_positions (via task_assignments)
processes 1─∞ templates
templates 1─∞ template_versions

## Usuarios, roles y cargos

units 1─∞ unit_positions
cargos 1─∞ unit_positions
persons ∞─∞ unit_positions (via position_assignments)
persons ∞─∞ roles (via role_assignments, unit-scoped)
roles ∞─∞ permissions (via role_permissions)
cargos ∞─∞ roles (via cargo_role_map)
relation_unit_types ∞─∞ role_assignments (via role_assignment_relation_types)

## Documentos y firmas

tasks 1─∞ documents
documents 1─∞ document_versions
process_versions 1─∞ signature_flow_templates
signature_flow_templates 1─∞ signature_flow_steps
document_versions 1─∞ signature_flow_instances
signature_flow_instances 1─∞ signature_requests
document_versions 1─∞ document_signatures

## Docencia/contratos

unit_positions 1─∞ vacancies
vacancies 1─∞ vacancy_visibility
units 1─∞ vacancy_visibility
roles 1─∞ vacancy_visibility
vacancies 1─∞ aplications
aplications 1─∞ offers
vacancies 1─∞ contract_origin_recruitment
persons 1─∞ contracts
unit_positions 1─∞ contracts
contracts 1─∞ contract_origins
contracts 1─∞ contract_origin_renewal
