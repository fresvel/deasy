# Dominio y datos - ER (resumen textual)

## Estructura academica

unit_types 1─∞ units
units ∞─∞ units (via unit_relations)
units ∞─∞ programs (via program_unit_history)
terms 1─∞ processes

## Procesos y plantillas

persons 1─∞ processes (person_id = responsable)
processes 1─∞ processes (parent_id)
units 1─∞ processes (unit_id, opcional)
programs 1─∞ processes (program_id, opcional)
processes ∞─∞ templates (via process_templates)

## Personas, roles y cargos

persons ∞─∞ roles (via role_assignments)
roles ∞─∞ permissions (via role_permissions)
persons ∞─∞ cargos (via person_cargos)

## Documentos y firmas

processes 1─∞ documents
documents 1─∞ document_versions
persons 1─∞ document_signatures (signer_user_id)
document_versions 1─∞ document_signatures

## Docencia/contratos

units 1─∞ vacancies (opcional)
programs 1─∞ vacancies (opcional)
vacancies 1─∞ contracts
persons 1─∞ contracts

## Matricula

persons 1─∞ student_program_terms
programs 1─∞ student_program_terms
terms 1─∞ student_program_terms

