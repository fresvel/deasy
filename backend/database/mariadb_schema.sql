-- Canonical MariaDB schema aligned to Deploy/consolidado.dbml
-- Engine: InnoDB, charset utf8mb4

CREATE TABLE IF NOT EXISTS unit_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS units (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  label VARCHAR(75) NULL,
  slug VARCHAR(180) NOT NULL,
  unit_type_id INT NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_units_unit_type (unit_type_id),
  CONSTRAINT fk_units_unit_type FOREIGN KEY (unit_type_id) REFERENCES unit_types(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS persons (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cedula VARCHAR(20) UNIQUE,
  first_name VARCHAR(120) NOT NULL,
  last_name VARCHAR(120) NOT NULL,
  email VARCHAR(180) UNIQUE,
  whatsapp VARCHAR(30),
  direccion VARCHAR(255),
  pais VARCHAR(80),
  pais_residencia VARCHAR(80),
  provincia_residencia VARCHAR(120),
  ciudad_residencia VARCHAR(120),
  calle_primaria VARCHAR(180),
  calle_secundaria VARCHAR(180),
  codigo_postal VARCHAR(30),
  password_hash VARCHAR(255) NOT NULL,
  status ENUM('Inactivo','Activo','Verificado','Reportado') DEFAULT 'Inactivo',
  verify_email TINYINT(1) DEFAULT 0,
  verify_whatsapp TINYINT(1) DEFAULT 0,
  photo_url LONGTEXT DEFAULT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  token VARCHAR(10) NOT NULL UNIQUE, 
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE persons
  ADD COLUMN IF NOT EXISTS token VARCHAR(10) NULL AFTER is_active,
  ADD COLUMN IF NOT EXISTS pais_residencia VARCHAR(80) NULL AFTER pais,
  ADD COLUMN IF NOT EXISTS provincia_residencia VARCHAR(120) NULL AFTER pais_residencia,
  ADD COLUMN IF NOT EXISTS ciudad_residencia VARCHAR(120) NULL AFTER provincia_residencia,
  ADD COLUMN IF NOT EXISTS calle_primaria VARCHAR(180) NULL AFTER ciudad_residencia,
  ADD COLUMN IF NOT EXISTS calle_secundaria VARCHAR(180) NULL AFTER calle_primaria,
  ADD COLUMN IF NOT EXISTS codigo_postal VARCHAR(30) NULL AFTER calle_secundaria;

CREATE TABLE IF NOT EXISTS person_certificates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  person_id INT NOT NULL,
  label VARCHAR(180) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  bucket VARCHAR(120) NOT NULL,
  object_name VARCHAR(500) NOT NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_person_certificates_person (person_id),
  INDEX idx_person_certificates_default (person_id, is_default),
  CONSTRAINT fk_person_certificates_person FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS relation_unit_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(40) NOT NULL,
  description VARCHAR(255) NULL,
  is_inheritance_allowed TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO relation_unit_types (code, name, description, is_inheritance_allowed, is_active)
SELECT
  'org',
  'Organica',
  'Relacion jerarquica organizacional',
  1,
  1
WHERE NOT EXISTS (
  SELECT 1
  FROM relation_unit_types
  WHERE code = 'org'
);

CREATE TABLE IF NOT EXISTS unit_relations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  relation_type_id INT NOT NULL,
  parent_unit_id INT NOT NULL,
  child_unit_id INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unit_relations_uq (parent_unit_id, child_unit_id, relation_type_id),
  UNIQUE KEY uq_unit_relations_child_type (child_unit_id, relation_type_id),
  INDEX idx_unit_relations_parent (parent_unit_id),
  INDEX idx_unit_relations_child (child_unit_id),
  CONSTRAINT fk_unit_relations_relation_type
    FOREIGN KEY (relation_type_id) REFERENCES relation_unit_types(id),
  CONSTRAINT fk_unit_relations_parent
    FOREIGN KEY (parent_unit_id) REFERENCES units(id),
  CONSTRAINT fk_unit_relations_child
    FOREIGN KEY (child_unit_id) REFERENCES units(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cargos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(120) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL UNIQUE,
  description VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS unit_positions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  unit_id INT NOT NULL,
  slot_no INT NOT NULL,
  title VARCHAR(180) NULL,
  profile_ref VARCHAR(64) NULL,
  position_type ENUM('real','promocion','simbolico') NOT NULL DEFAULT 'real',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  deactivated_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  cargo_id INT NOT NULL,
  UNIQUE KEY uq_unit_cargo_slot (unit_id, cargo_id, slot_no),
  INDEX idx_positions_unit_cargo_active (unit_id, cargo_id, is_active),
  CONSTRAINT fk_unit_positions_unit FOREIGN KEY (unit_id) REFERENCES units(id),
  CONSTRAINT fk_unit_positions_cargo FOREIGN KEY (cargo_id) REFERENCES cargos(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS position_assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  position_id INT NOT NULL,
  person_id INT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NULL,
  is_current TINYINT(1) NOT NULL DEFAULT 1,
  current_flag TINYINT(1) AS (IF(is_current = 1, 1, NULL)) PERSISTENT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_position_current (position_id, current_flag),
  INDEX idx_assignments_person_current (person_id, is_current),
  CONSTRAINT fk_position_assignments_position FOREIGN KEY (position_id) REFERENCES unit_positions(id),
  CONSTRAINT fk_position_assignments_person FOREIGN KEY (person_id) REFERENCES persons(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS vacancies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(180) NOT NULL,
  category VARCHAR(120) NULL,
  dedication VARCHAR(30) NOT NULL,
  relation_type VARCHAR(60) NOT NULL,
  status ENUM('abierta','cubierta','cerrada','cancelada') NOT NULL DEFAULT 'abierta',
  open_flag TINYINT(1) AS (IF(status = 'abierta', 1, NULL)) PERSISTENT,
  profile_ref VARCHAR(64) NULL,
  opened_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at DATETIME NULL,
  position_id INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_one_open_vacancy_per_position (position_id, open_flag),
  INDEX idx_vacancies_position_status (position_id, status),
  CONSTRAINT fk_vacancies_position FOREIGN KEY (position_id) REFERENCES unit_positions(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS aplications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  person_id INT NOT NULL,
  vacancy_id INT NOT NULL,
  status ENUM('aplicado','preseleccionado','entrevista','rechazado','retirado','seleccionado') NOT NULL DEFAULT 'aplicado',
  selected_flag TINYINT(1) AS (IF(status = 'seleccionado', 1, NULL)) PERSISTENT,
  applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  note VARCHAR(255) NULL,
  UNIQUE KEY uq_application_once (vacancy_id, person_id),
  UNIQUE KEY uq_one_selected_per_vacancy (vacancy_id, selected_flag),
  INDEX idx_applications_vacancy_status (vacancy_id, status),
  INDEX idx_applications_person_time (person_id, applied_at),
  CONSTRAINT fk_applications_vacancy FOREIGN KEY (vacancy_id) REFERENCES vacancies(id),
  CONSTRAINT fk_applications_person FOREIGN KEY (person_id) REFERENCES persons(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS offers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  application_id INT NOT NULL,
  status ENUM('enviada','aceptada','rechazada','retractada','expirada') NOT NULL DEFAULT 'enviada',
  active_flag TINYINT(1) AS (IF(status = 'enviada', 1, NULL)) PERSISTENT,
  terms_snapshot TEXT NULL,
  sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  responded_at DATETIME NULL,
  expires_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_one_active_offer_per_application (application_id, active_flag),
  INDEX idx_offers_application_status (application_id, status),
  CONSTRAINT fk_offers_application FOREIGN KEY (application_id) REFERENCES aplications(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS contracts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  person_id INT NOT NULL,
  position_id INT NOT NULL,
  relation_type VARCHAR(60) NOT NULL,
  dedication VARCHAR(30) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NULL,
  status ENUM('activo','finalizado','cancelado') NOT NULL DEFAULT 'activo',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_contracts_person_status (person_id, status),
  INDEX idx_contracts_position_status (position_id, status),
  CONSTRAINT fk_contracts_person FOREIGN KEY (person_id) REFERENCES persons(id),
  CONSTRAINT fk_contracts_position FOREIGN KEY (position_id) REFERENCES unit_positions(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  description VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS vacancy_visibility (
  id INT AUTO_INCREMENT PRIMARY KEY,
  vacancy_id INT NOT NULL,
  unit_id INT NULL,
  role_id INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_vacancy_visibility_vacancy (vacancy_id),
  INDEX idx_vacancy_visibility_unit (unit_id),
  INDEX idx_vacancy_visibility_role (role_id),
  CONSTRAINT fk_vacancy_visibility_vacancy FOREIGN KEY (vacancy_id) REFERENCES vacancies(id),
  CONSTRAINT fk_vacancy_visibility_unit FOREIGN KEY (unit_id) REFERENCES units(id),
  CONSTRAINT fk_vacancy_visibility_role FOREIGN KEY (role_id) REFERENCES roles(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS resources (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(80) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  description VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS actions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  description VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  resource_id INT NOT NULL,
  action_id INT NOT NULL,
  code VARCHAR(120) NOT NULL,
  description VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_permissions_resource_action (resource_id, action_id),
  UNIQUE KEY uq_permissions_code (code),
  INDEX idx_permissions_resource (resource_id),
  INDEX idx_permissions_action (action_id),
  CONSTRAINT fk_permissions_resource FOREIGN KEY (resource_id) REFERENCES resources(id),
  CONSTRAINT fk_permissions_action FOREIGN KEY (action_id) REFERENCES actions(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS role_permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role_id INT NOT NULL,
  permission_id INT NOT NULL,
  UNIQUE KEY uq_role_permissions (role_id, permission_id),
  CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_id) REFERENCES roles(id),
  CONSTRAINT fk_role_permissions_permission FOREIGN KEY (permission_id) REFERENCES permissions(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS role_assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role_id INT NOT NULL,
  unit_id INT NOT NULL,
  derived_from_assignment_id INT NULL,
  source ENUM('manual','derived') NOT NULL DEFAULT 'manual',
  person_id INT NOT NULL,
  max_depth INT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NULL,
  is_current TINYINT(1) NOT NULL DEFAULT 1,
  current_flag TINYINT(1) AS (IF(is_current = 1, 1, NULL)) PERSISTENT,
  assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at DATETIME NULL,
  revoked_reason VARCHAR(255) NULL,
  UNIQUE KEY uq_role_assignment_current (person_id, role_id, unit_id, source, current_flag),
  INDEX idx_role_assignments_person (person_id),
  INDEX idx_role_assignments_unit (unit_id),
  CONSTRAINT fk_role_assignments_role FOREIGN KEY (role_id) REFERENCES roles(id),
  CONSTRAINT fk_role_assignments_unit FOREIGN KEY (unit_id) REFERENCES units(id),
  CONSTRAINT fk_role_assignments_person FOREIGN KEY (person_id) REFERENCES persons(id),
  CONSTRAINT fk_role_assignments_position_assignment FOREIGN KEY (derived_from_assignment_id) REFERENCES position_assignments(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS role_assignment_relation_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  relation_type_id INT NOT NULL,
  role_assignment_id INT NOT NULL,
  INDEX idx_role_assignment_relation_types (role_assignment_id, relation_type_id),
  CONSTRAINT fk_role_assignment_relation_types_role_assignment
    FOREIGN KEY (role_assignment_id) REFERENCES role_assignments(id),
  CONSTRAINT fk_role_assignment_relation_types_relation_type
    FOREIGN KEY (relation_type_id) REFERENCES relation_unit_types(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cargo_role_map (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role_id INT NOT NULL,
  cargo_id INT NOT NULL,
  UNIQUE KEY uq_cargo_role_map (cargo_id, role_id),
  CONSTRAINT fk_cargo_role_map_role FOREIGN KEY (role_id) REFERENCES roles(id),
  CONSTRAINT fk_cargo_role_map_cargo FOREIGN KEY (cargo_id) REFERENCES cargos(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS contract_origins (
  contract_id INT NOT NULL PRIMARY KEY,
  origin_type ENUM('recruitment','renewal') NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_contract_origins_contract FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS contract_origin_recruitment (
  contract_id INT NOT NULL PRIMARY KEY,
  offer_id INT NOT NULL UNIQUE,
  vacancy_id INT NOT NULL UNIQUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_contract_origin_recruitment_contract FOREIGN KEY (contract_id) REFERENCES contract_origins(contract_id) ON DELETE CASCADE,
  CONSTRAINT fk_contract_origin_recruitment_offer FOREIGN KEY (offer_id) REFERENCES offers(id),
  CONSTRAINT fk_contract_origin_recruitment_vacancy FOREIGN KEY (vacancy_id) REFERENCES vacancies(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS contract_origin_renewal (
  contract_id INT NOT NULL PRIMARY KEY,
  renewed_from_contract_id INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_renewed_from_contract (renewed_from_contract_id),
  CONSTRAINT fk_contract_origin_renewal_contract FOREIGN KEY (contract_id) REFERENCES contract_origins(contract_id) ON DELETE CASCADE,
  CONSTRAINT fk_contract_origin_renewal_from FOREIGN KEY (renewed_from_contract_id) REFERENCES contracts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Procesos, tareas y documentos
CREATE TABLE IF NOT EXISTS processes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  slug VARCHAR(180) NOT NULL UNIQUE,
  parent_id INT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_processes_parent FOREIGN KEY (parent_id) REFERENCES processes(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS process_definition_series (
  id INT AUTO_INCREMENT PRIMARY KEY,
  source_type ENUM('unit_type', 'cargo', 'legacy') NOT NULL DEFAULT 'legacy',
  unit_type_id INT NULL,
  cargo_id INT NULL,
  code VARCHAR(120) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_process_definition_series_code (code),
  INDEX idx_process_definition_series_state (is_active),
  CONSTRAINT fk_process_definition_series_unit_type
    FOREIGN KEY (unit_type_id) REFERENCES unit_types(id),
  CONSTRAINT fk_process_definition_series_cargo
    FOREIGN KEY (cargo_id) REFERENCES cargos(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS process_definition_versions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  process_id INT NOT NULL,
  series_id INT NOT NULL,
  variation_key VARCHAR(120) NOT NULL DEFAULT 'general',
  definition_version VARCHAR(20) NOT NULL,
  name VARCHAR(180) NOT NULL,
  description VARCHAR(255) NULL,
  has_document TINYINT(1) NOT NULL DEFAULT 1,
  status ENUM('draft', 'active', 'retired') NOT NULL DEFAULT 'draft',
  active_series_flag TINYINT(1) AS (IF(status = 'active', 1, NULL)) PERSISTENT,
  effective_from DATE NOT NULL,
  effective_to DATE NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_process_definition_versions_series (process_id, variation_key, definition_version),
  UNIQUE KEY uq_process_definition_one_active_series (process_id, variation_key, active_series_flag),
  INDEX idx_process_definition_versions_status (process_id, variation_key, status, effective_from),
  CONSTRAINT fk_process_definition_versions_process
    FOREIGN KEY (process_id) REFERENCES processes(id) ON DELETE CASCADE,
  CONSTRAINT fk_process_definition_versions_series
    FOREIGN KEY (series_id) REFERENCES process_definition_series(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS process_target_rules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  process_definition_id INT NOT NULL,
  unit_scope_type ENUM('unit_exact', 'unit_subtree', 'unit_type', 'all_units') NOT NULL DEFAULT 'unit_exact',
  unit_id INT NULL,
  unit_type_id INT NULL,
  include_descendants TINYINT(1) NOT NULL DEFAULT 0,
  cargo_id INT NULL,
  position_id INT NULL,
  recipient_policy ENUM('all_matches', 'one_per_unit', 'one_match_only', 'exact_position')
    NOT NULL DEFAULT 'all_matches',
  priority INT NOT NULL DEFAULT 1,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  effective_from DATE NULL,
  effective_to DATE NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_process_target_rules_definition (process_definition_id, is_active),
  INDEX idx_process_target_rules_scope (unit_scope_type, unit_id, unit_type_id),
  CONSTRAINT fk_process_target_rules_definition
    FOREIGN KEY (process_definition_id) REFERENCES process_definition_versions(id) ON DELETE CASCADE,
  CONSTRAINT fk_process_target_rules_unit
    FOREIGN KEY (unit_id) REFERENCES units(id),
  CONSTRAINT fk_process_target_rules_unit_type
    FOREIGN KEY (unit_type_id) REFERENCES unit_types(id),
  CONSTRAINT fk_process_target_rules_cargo
    FOREIGN KEY (cargo_id) REFERENCES cargos(id),
  CONSTRAINT fk_process_target_rules_position
    FOREIGN KEY (position_id) REFERENCES unit_positions(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS template_seeds (
  id INT AUTO_INCREMENT PRIMARY KEY,
  seed_code VARCHAR(180) NOT NULL,
  display_name VARCHAR(180) NOT NULL,
  description VARCHAR(255) NULL,
  seed_type VARCHAR(40) NOT NULL,
  source_path VARCHAR(255) NOT NULL,
  preview_path VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_template_seeds_code (seed_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS template_artifacts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  template_seed_id INT NULL,
  owner_person_id INT NULL,
  template_code VARCHAR(180) NOT NULL,
  display_name VARCHAR(180) NOT NULL,
  description VARCHAR(255) NULL,
  owner_ref VARCHAR(180) NULL,
  source_version VARCHAR(20) NOT NULL,
  storage_version VARCHAR(20) NOT NULL,
  artifact_origin ENUM('process','general') NOT NULL DEFAULT 'process',
  artifact_stage ENUM('draft','review','approved','published','archived') NOT NULL DEFAULT 'published',
  bucket VARCHAR(120) NOT NULL,
  base_object_prefix VARCHAR(255) NOT NULL,
  available_formats JSON NOT NULL,
  schema_object_key VARCHAR(255) NOT NULL,
  meta_object_key VARCHAR(255) NOT NULL,
  content_hash VARCHAR(64) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_template_artifacts_storage (template_code, storage_version),
  INDEX idx_template_artifacts_seed (template_seed_id),
  INDEX idx_template_artifacts_owner_person (owner_person_id),
  INDEX idx_template_artifacts_origin (artifact_origin),
  INDEX idx_template_artifacts_stage (artifact_stage),
  CONSTRAINT fk_template_artifacts_seed
    FOREIGN KEY (template_seed_id) REFERENCES template_seeds(id),
  CONSTRAINT fk_template_artifacts_owner_person
    FOREIGN KEY (owner_person_id) REFERENCES persons(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS process_definition_templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  process_definition_id INT NOT NULL,
  template_artifact_id INT NOT NULL,
  usage_role ENUM('primary', 'attachment', 'support') NOT NULL DEFAULT 'primary',
  creates_task TINYINT(1) NOT NULL DEFAULT 1,
  is_required TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_process_definition_templates (process_definition_id, template_artifact_id, usage_role),
  CONSTRAINT fk_process_definition_templates_definition
    FOREIGN KEY (process_definition_id) REFERENCES process_definition_versions(id) ON DELETE CASCADE,
  CONSTRAINT fk_process_definition_templates_artifact
    FOREIGN KEY (template_artifact_id) REFERENCES template_artifacts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS term_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(80) NOT NULL UNIQUE,
  description VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO term_types (id, code, name, description, is_active)
VALUES
  (1, 'SEM', 'Semestre', 'Periodo academico semestral', 1),
  (2, 'TRI', 'Trimestre', 'Periodo academico trimestral', 1),
  (3, 'INT', 'Intensivo', 'Periodo academico intensivo', 1),
  (4, 'CUS', 'Custom', 'Periodo operativo personalizado', 1)
ON DUPLICATE KEY UPDATE
  code = VALUES(code),
  name = VALUES(name),
  description = VALUES(description),
  is_active = VALUES(is_active);

CREATE TABLE IF NOT EXISTS process_definition_triggers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  process_definition_id INT NOT NULL,
  trigger_mode ENUM('automatic_by_term_type', 'manual_only', 'manual_custom_term') NOT NULL,
  term_type_id INT NULL,
  normalized_term_type_id INT AS (IFNULL(term_type_id, 0)) PERSISTENT,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_process_definition_triggers (process_definition_id, trigger_mode, normalized_term_type_id),
  INDEX idx_process_definition_triggers_lookup (process_definition_id, trigger_mode, is_active),
  CONSTRAINT fk_process_definition_triggers_definition
    FOREIGN KEY (process_definition_id) REFERENCES process_definition_versions(id) ON DELETE CASCADE,
  CONSTRAINT fk_process_definition_triggers_term_type
    FOREIGN KEY (term_type_id) REFERENCES term_types(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS terms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(60) NOT NULL UNIQUE,
  term_type_id INT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  INDEX idx_terms_term_type (term_type_id),
  CONSTRAINT fk_terms_term_type FOREIGN KEY (term_type_id) REFERENCES term_types(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS process_runs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  process_definition_id INT NOT NULL,
  term_id INT NULL,
  run_mode ENUM('automatic_term', 'manual', 'reinstanced', 'repair') NOT NULL DEFAULT 'manual',
  source_run_id INT NULL,
  created_by_user_id INT NULL,
  reason VARCHAR(255) NULL,
  status ENUM('pending', 'active', 'completed', 'cancelled') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_process_runs_automatic_term (process_definition_id, term_id, run_mode),
  INDEX idx_process_runs_definition (process_definition_id, status),
  INDEX idx_process_runs_term (term_id),
  CONSTRAINT fk_process_runs_definition
    FOREIGN KEY (process_definition_id) REFERENCES process_definition_versions(id),
  CONSTRAINT fk_process_runs_term
    FOREIGN KEY (term_id) REFERENCES terms(id),
  CONSTRAINT fk_process_runs_source
    FOREIGN KEY (source_run_id) REFERENCES process_runs(id),
  CONSTRAINT fk_process_runs_creator
    FOREIGN KEY (created_by_user_id) REFERENCES persons(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  process_definition_id INT NOT NULL,
  process_run_id INT NULL,
  term_id INT NOT NULL,
  launch_mode ENUM('automatic', 'manual') NOT NULL DEFAULT 'manual',
  created_by_user_id INT NULL,
  automatic_flag TINYINT(1) AS (IF(launch_mode = 'automatic', 1, NULL)) PERSISTENT,
  manual_user_flag INT AS (IF(launch_mode = 'manual', created_by_user_id, NULL)) PERSISTENT,
  parent_task_id INT NULL,
  responsible_position_id INT NULL,
  description TEXT NULL,
  comments_thread_ref VARCHAR(64) NULL,
  start_date DATE NOT NULL,
  end_date DATE NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pendiente',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_tasks_automatic_term (process_definition_id, term_id, automatic_flag),
  UNIQUE KEY uq_tasks_manual_term_user (process_definition_id, term_id, manual_user_flag),
  INDEX idx_tasks_definition_term (process_definition_id, term_id),
  INDEX idx_tasks_process_run (process_run_id),
  INDEX idx_tasks_launch (launch_mode, created_by_user_id),
  CONSTRAINT fk_tasks_process_definition
    FOREIGN KEY (process_definition_id) REFERENCES process_definition_versions(id),
  CONSTRAINT fk_tasks_process_run
    FOREIGN KEY (process_run_id) REFERENCES process_runs(id),
  CONSTRAINT fk_tasks_term FOREIGN KEY (term_id) REFERENCES terms(id),
  CONSTRAINT fk_tasks_created_by_user FOREIGN KEY (created_by_user_id) REFERENCES persons(id),
  CONSTRAINT fk_tasks_parent FOREIGN KEY (parent_task_id) REFERENCES tasks(id),
  CONSTRAINT fk_tasks_responsible_position FOREIGN KEY (responsible_position_id) REFERENCES unit_positions(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS task_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT NOT NULL,
  process_definition_template_id INT NOT NULL,
  template_artifact_id INT NOT NULL,
  template_usage_role ENUM('primary', 'attachment', 'support') NOT NULL DEFAULT 'primary',
  sort_order INT NOT NULL DEFAULT 1,
  responsible_position_id INT NULL,
  assigned_person_id INT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pendiente',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_task_items_task_template (task_id, process_definition_template_id),
  INDEX idx_task_items_task (task_id, sort_order),
  INDEX idx_task_items_artifact (template_artifact_id),
  CONSTRAINT fk_task_items_task
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  CONSTRAINT fk_task_items_process_definition_template
    FOREIGN KEY (process_definition_template_id) REFERENCES process_definition_templates(id),
  CONSTRAINT fk_task_items_template_artifact
    FOREIGN KEY (template_artifact_id) REFERENCES template_artifacts(id),
  CONSTRAINT fk_task_items_responsible_position
    FOREIGN KEY (responsible_position_id) REFERENCES unit_positions(id),
  CONSTRAINT fk_task_items_assigned_person
    FOREIGN KEY (assigned_person_id) REFERENCES persons(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS task_assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT NOT NULL,
  position_id INT NOT NULL,
  assigned_person_id INT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pendiente',
  assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  unassigned_at DATETIME NULL,
  UNIQUE KEY uq_task_assignment_position (task_id, position_id),
  INDEX idx_task_assignments_person (assigned_person_id),
  CONSTRAINT fk_task_assignments_task FOREIGN KEY (task_id) REFERENCES tasks(id),
  CONSTRAINT fk_task_assignments_position FOREIGN KEY (position_id) REFERENCES unit_positions(id),
  CONSTRAINT fk_task_assignments_person FOREIGN KEY (assigned_person_id) REFERENCES persons(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_item_id INT NULL,
  owner_person_id INT NULL,
  origin_unit_id INT NULL,
  origin_type ENUM('task_item', 'standalone', 'imported', 'generated') NOT NULL DEFAULT 'task_item',
  title VARCHAR(180) NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'Inicial',
  comments_thread_ref VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL,
  UNIQUE KEY uq_documents_task_item (task_item_id),
  INDEX idx_documents_owner_person (owner_person_id),
  INDEX idx_documents_origin_unit (origin_unit_id),
  INDEX idx_documents_origin_type (origin_type),
  CONSTRAINT fk_documents_task_item FOREIGN KEY (task_item_id) REFERENCES task_items(id),
  CONSTRAINT fk_documents_owner_person FOREIGN KEY (owner_person_id) REFERENCES persons(id),
  CONSTRAINT fk_documents_origin_unit FOREIGN KEY (origin_unit_id) REFERENCES units(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS document_versions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  document_id INT NOT NULL,
  version DECIMAL(4,1) NOT NULL DEFAULT 0.1,
  template_artifact_id INT NULL,
  payload_mongo_id VARCHAR(180) NULL,
  payload_hash VARCHAR(64) NULL,
  payload_object_path VARCHAR(255) NULL,
  working_file_path VARCHAR(255) NULL,
  final_file_path VARCHAR(255) NULL,
  format VARCHAR(40) NULL,
  render_engine VARCHAR(80) NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'Borrador',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_document_versions (document_id, version),
  INDEX idx_document_versions_artifact (template_artifact_id),
  CONSTRAINT fk_document_versions_document FOREIGN KEY (document_id) REFERENCES documents(id),
  CONSTRAINT fk_document_versions_artifact FOREIGN KEY (template_artifact_id) REFERENCES template_artifacts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS signature_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(80) NOT NULL,
  description VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS signature_statuses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(80) NOT NULL,
  description VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS signature_request_statuses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(80) NOT NULL,
  description VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO signature_statuses (code, name, description, is_active)
VALUES
  ('firmado', 'Firmado', 'La firma se generó y validó correctamente.', 1),
  ('fallido', 'Fallido', 'La firma no se pudo generar por error operativo.', 1),
  ('invalido', 'Inválido', 'La firma se generó pero no validó correctamente.', 1),
  ('cancelado', 'Cancelado', 'La firma fue cancelada o descartada.', 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description),
  is_active = VALUES(is_active);

INSERT INTO signature_request_statuses (code, name, description, is_active)
VALUES
  ('pendiente', 'Pendiente', 'Solicitud de firma pendiente de atención.', 1),
  ('en_progreso', 'En progreso', 'Solicitud de firma en ejecución.', 1),
  ('completado', 'Completado', 'Solicitud de firma completada con evidencia válida.', 1),
  ('rechazado', 'Rechazado', 'Solicitud de firma rechazada o con resultado no válido.', 1),
  ('cancelado', 'Cancelado', 'Solicitud de firma cancelada.', 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description),
  is_active = VALUES(is_active);

CREATE TABLE IF NOT EXISTS fill_flow_templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  process_definition_template_id INT NOT NULL,
  name VARCHAR(180) NOT NULL,
  description VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_fill_flow_templates_definition_template
    FOREIGN KEY (process_definition_template_id) REFERENCES process_definition_templates(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS fill_flow_steps (
  id INT AUTO_INCREMENT PRIMARY KEY,
  fill_flow_template_id INT NOT NULL,
  step_order INT NOT NULL,
  resolver_type ENUM('task_assignee', 'document_owner', 'specific_person', 'position', 'cargo_in_scope', 'manual_pick')
    NOT NULL DEFAULT 'task_assignee',
  assigned_person_id INT NULL,
  unit_scope_type ENUM('unit_exact', 'unit_subtree', 'unit_type', 'all_units') NOT NULL DEFAULT 'unit_exact',
  unit_id INT NULL,
  unit_type_id INT NULL,
  cargo_id INT NULL,
  position_id INT NULL,
  selection_mode ENUM('auto_one', 'auto_all', 'manual') NOT NULL DEFAULT 'auto_one',
  is_required TINYINT(1) NOT NULL DEFAULT 1,
  can_reject TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_fill_flow_steps (fill_flow_template_id, step_order),
  CONSTRAINT fk_fill_flow_steps_template
    FOREIGN KEY (fill_flow_template_id) REFERENCES fill_flow_templates(id),
  CONSTRAINT fk_fill_flow_steps_person
    FOREIGN KEY (assigned_person_id) REFERENCES persons(id),
  CONSTRAINT fk_fill_flow_steps_unit
    FOREIGN KEY (unit_id) REFERENCES units(id),
  CONSTRAINT fk_fill_flow_steps_unit_type
    FOREIGN KEY (unit_type_id) REFERENCES unit_types(id),
  CONSTRAINT fk_fill_flow_steps_cargo
    FOREIGN KEY (cargo_id) REFERENCES cargos(id),
  CONSTRAINT fk_fill_flow_steps_position
    FOREIGN KEY (position_id) REFERENCES unit_positions(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS document_fill_flows (
  id INT AUTO_INCREMENT PRIMARY KEY,
  fill_flow_template_id INT NOT NULL,
  document_version_id INT NOT NULL,
  status ENUM('pending', 'in_progress', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
  current_step_order INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_document_fill_flows_document (document_version_id),
  CONSTRAINT fk_document_fill_flows_template
    FOREIGN KEY (fill_flow_template_id) REFERENCES fill_flow_templates(id),
  CONSTRAINT fk_document_fill_flows_document
    FOREIGN KEY (document_version_id) REFERENCES document_versions(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS fill_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  document_fill_flow_id INT NOT NULL,
  fill_flow_step_id INT NOT NULL,
  assigned_person_id INT NULL,
  status ENUM('pending', 'in_progress', 'approved', 'rejected', 'returned', 'cancelled') NOT NULL DEFAULT 'pending',
  is_manual TINYINT(1) NOT NULL DEFAULT 0,
  requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  responded_at DATETIME NULL,
  response_note VARCHAR(255) NULL,
  UNIQUE KEY uq_fill_requests (document_fill_flow_id, fill_flow_step_id, assigned_person_id),
  INDEX idx_fill_requests_step (document_fill_flow_id, fill_flow_step_id),
  CONSTRAINT fk_fill_requests_instance
    FOREIGN KEY (document_fill_flow_id) REFERENCES document_fill_flows(id),
  CONSTRAINT fk_fill_requests_step
    FOREIGN KEY (fill_flow_step_id) REFERENCES fill_flow_steps(id),
  CONSTRAINT fk_fill_requests_person
    FOREIGN KEY (assigned_person_id) REFERENCES persons(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DELIMITER //

DROP TRIGGER IF EXISTS trg_process_definition_versions_before_update //
CREATE TRIGGER trg_process_definition_versions_before_update
BEFORE UPDATE ON process_definition_versions
FOR EACH ROW
BEGIN
  DECLARE linked_template_count INT DEFAULT 0;
  DECLARE active_rule_count INT DEFAULT 0;
  DECLARE active_trigger_count INT DEFAULT 0;

  IF NEW.status = 'active' AND OLD.status <> 'active' THEN
    SELECT COUNT(*)
      INTO active_rule_count
    FROM process_target_rules
    WHERE process_definition_id = NEW.id
      AND is_active = 1;

    IF active_rule_count < 1 THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'No se puede activar una definicion si no tiene al menos una regla activa en Reglas de alcance.';
    END IF;
  END IF;

  IF NEW.status = 'active' AND OLD.status <> 'active' THEN
    SELECT COUNT(*)
      INTO active_trigger_count
    FROM process_definition_triggers
    WHERE process_definition_id = NEW.id
      AND is_active = 1;

    IF active_trigger_count < 1 THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'No se puede activar una definicion si no tiene al menos un disparador activo en Disparadores de definiciones.';
    END IF;
  END IF;

  IF NEW.status = 'active' AND OLD.status <> 'active' AND NEW.has_document = 1 THEN
    SELECT COUNT(*)
      INTO linked_template_count
    FROM process_definition_templates
    WHERE process_definition_id = NEW.id;

    IF linked_template_count < 1 THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'No se puede activar una definicion con documento si no tiene al menos un artifact vinculado en Plantillas de definicion.';
    END IF;
  END IF;
END //

DROP TRIGGER IF EXISTS trg_position_assignments_after_insert //
CREATE TRIGGER trg_position_assignments_after_insert
AFTER INSERT ON position_assignments
FOR EACH ROW
BEGIN
  IF NEW.is_current = 1 THEN
    INSERT IGNORE INTO role_assignments
      (person_id, role_id, unit_id, source, derived_from_assignment_id, max_depth, start_date, is_current, assigned_at)
    SELECT
      NEW.person_id,
      crm.role_id,
      up.unit_id,
      'derived',
      NEW.id,
      0,
      NEW.start_date,
      1,
      NOW()
    FROM unit_positions up
    INNER JOIN cargo_role_map crm ON crm.cargo_id = up.cargo_id
    WHERE up.id = NEW.position_id;
  END IF;
END //

DROP TRIGGER IF EXISTS trg_position_assignments_after_update //
CREATE TRIGGER trg_position_assignments_after_update
AFTER UPDATE ON position_assignments
FOR EACH ROW
BEGIN
  IF OLD.is_current = 1 AND NEW.is_current = 0 THEN
    UPDATE role_assignments
    SET
      is_current = 0,
      end_date = IFNULL(NEW.end_date, CURDATE()),
      revoked_at = NOW(),
      revoked_reason = 'position_assignment_closed'
    WHERE source = 'derived'
      AND derived_from_assignment_id = OLD.id
      AND is_current = 1;
  END IF;
END //

DROP TRIGGER IF EXISTS trg_persons_after_update //
CREATE TRIGGER trg_persons_after_update
AFTER UPDATE ON persons
FOR EACH ROW
BEGIN
  IF OLD.is_active = 1 AND NEW.is_active = 0 THEN
    UPDATE position_assignments
    SET
      is_current = 0,
      end_date = IFNULL(end_date, CURDATE())
    WHERE person_id = NEW.id AND is_current = 1;

    UPDATE role_assignments
    SET
      is_current = 0,
      end_date = IFNULL(end_date, CURDATE()),
      revoked_at = NOW(),
      revoked_reason = 'person_inactivated'
    WHERE person_id = NEW.id AND is_current = 1;
  END IF;
END //

DROP TRIGGER IF EXISTS trg_units_after_update //
CREATE TRIGGER trg_units_after_update
AFTER UPDATE ON units
FOR EACH ROW
BEGIN
  IF OLD.is_active = 1 AND NEW.is_active = 0 THEN
    UPDATE role_assignments
    SET
      is_current = 0,
      end_date = IFNULL(end_date, CURDATE()),
      revoked_at = NOW(),
      revoked_reason = 'unit_inactivated'
    WHERE unit_id = NEW.id AND is_current = 1;

    UPDATE vacancies v
    INNER JOIN unit_positions up ON up.id = v.position_id
    SET v.status = 'cancelada',
        v.closed_at = NOW()
    WHERE up.unit_id = NEW.id AND v.status = 'abierta';
  END IF;
END //

DELIMITER ;

CREATE TABLE IF NOT EXISTS signature_flow_templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  process_definition_template_id INT NOT NULL,
  name VARCHAR(180) NOT NULL,
  description VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_signature_flow_templates_definition_template
    FOREIGN KEY (process_definition_template_id) REFERENCES process_definition_templates(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS signature_flow_steps (
  id INT AUTO_INCREMENT PRIMARY KEY,
  template_id INT NOT NULL,
  step_order INT NOT NULL,
  code VARCHAR(120) NULL,
  name VARCHAR(180) NULL,
  slot VARCHAR(80) NULL,
  step_type_id INT NOT NULL,
  resolver_type ENUM('task_assignee', 'document_owner', 'specific_person', 'position', 'cargo_in_scope', 'manual_pick') NOT NULL DEFAULT 'cargo_in_scope',
  assigned_person_id INT NULL,
  unit_scope_type ENUM('unit_exact', 'unit_subtree', 'unit_type', 'all_units', 'context_exact', 'context_subtree', 'context_ancestor_type') NOT NULL DEFAULT 'context_exact',
  unit_id INT NULL,
  unit_type_id INT NULL,
  position_id INT NULL,
  required_cargo_id INT NULL,
  selection_mode VARCHAR(20) NOT NULL DEFAULT 'auto_all',
  approval_mode ENUM('and', 'or', 'at_least') NOT NULL DEFAULT 'and',
  required_signers_min INT NULL,
  required_signers_max INT NULL,
  is_required TINYINT(1) NOT NULL DEFAULT 1,
  anchor_refs JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_signature_flow_steps (template_id, step_order),
  INDEX idx_signature_flow_steps_person (assigned_person_id),
  INDEX idx_signature_flow_steps_unit (unit_id),
  INDEX idx_signature_flow_steps_unit_type (unit_type_id),
  INDEX idx_signature_flow_steps_position (position_id),
  CONSTRAINT fk_signature_flow_steps_template FOREIGN KEY (template_id) REFERENCES signature_flow_templates(id),
  CONSTRAINT fk_signature_flow_steps_type FOREIGN KEY (step_type_id) REFERENCES signature_types(id),
  CONSTRAINT fk_signature_flow_steps_person FOREIGN KEY (assigned_person_id) REFERENCES persons(id),
  CONSTRAINT fk_signature_flow_steps_unit FOREIGN KEY (unit_id) REFERENCES units(id),
  CONSTRAINT fk_signature_flow_steps_unit_type FOREIGN KEY (unit_type_id) REFERENCES unit_types(id),
  CONSTRAINT fk_signature_flow_steps_position FOREIGN KEY (position_id) REFERENCES unit_positions(id),
  CONSTRAINT fk_signature_flow_steps_cargo FOREIGN KEY (required_cargo_id) REFERENCES cargos(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS signature_flow_instances (
  id INT AUTO_INCREMENT PRIMARY KEY,
  template_id INT NOT NULL,
  document_version_id INT NOT NULL,
  status_id INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_signature_flow_instances_document (document_version_id),
  CONSTRAINT fk_signature_flow_instances_template FOREIGN KEY (template_id) REFERENCES signature_flow_templates(id),
  CONSTRAINT fk_signature_flow_instances_document FOREIGN KEY (document_version_id) REFERENCES document_versions(id),
  CONSTRAINT fk_signature_flow_instances_status FOREIGN KEY (status_id) REFERENCES signature_request_statuses(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS signature_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  instance_id INT NOT NULL,
  step_id INT NOT NULL,
  assigned_person_id INT NULL,
  status_id INT NOT NULL,
  is_manual TINYINT(1) NOT NULL DEFAULT 0,
  requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notified_at DATETIME NULL,
  responded_at DATETIME NULL,
  UNIQUE KEY uq_signature_requests (instance_id, step_id, assigned_person_id),
  INDEX idx_signature_requests_step (instance_id, step_id),
  CONSTRAINT fk_signature_requests_instance FOREIGN KEY (instance_id) REFERENCES signature_flow_instances(id),
  CONSTRAINT fk_signature_requests_step FOREIGN KEY (step_id) REFERENCES signature_flow_steps(id),
  CONSTRAINT fk_signature_requests_person FOREIGN KEY (assigned_person_id) REFERENCES persons(id),
  CONSTRAINT fk_signature_requests_status FOREIGN KEY (status_id) REFERENCES signature_request_statuses(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS document_signatures (
  id INT AUTO_INCREMENT PRIMARY KEY,
  signature_request_id INT NULL,
  document_version_id INT NOT NULL,
  signer_user_id INT NOT NULL,
  signature_type_id INT NOT NULL,
  signature_status_id INT NOT NULL,
  note_short VARCHAR(255) NULL,
  signed_file_path VARCHAR(255) NULL,
  signed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_document_signatures_request FOREIGN KEY (signature_request_id) REFERENCES signature_requests(id),
  CONSTRAINT fk_document_signatures_document FOREIGN KEY (document_version_id) REFERENCES document_versions(id),
  CONSTRAINT fk_document_signatures_signer FOREIGN KEY (signer_user_id) REFERENCES persons(id),
  CONSTRAINT fk_document_signatures_type FOREIGN KEY (signature_type_id) REFERENCES signature_types(id),
  CONSTRAINT fk_document_signatures_status FOREIGN KEY (signature_status_id) REFERENCES signature_statuses(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP VIEW IF EXISTS unit_org_levels;
CREATE VIEW unit_org_levels AS
WITH RECURSIVE org_tree AS (
  SELECT
    u.id AS unit_id,
    CAST(NULL AS UNSIGNED) AS parent_unit_id,
    1 AS org_level,
    u.id AS root_unit_id,
    CAST(NULL AS UNSIGNED) AS level2_unit_id,
    CAST(NULL AS UNSIGNED) AS level3_unit_id
  FROM units u
  WHERE NOT EXISTS (
    SELECT 1
    FROM unit_relations ur
    INNER JOIN relation_unit_types rt ON rt.id = ur.relation_type_id AND rt.code = 'org'
    WHERE ur.child_unit_id = u.id
  )
  UNION ALL
  SELECT
    child.id AS unit_id,
    ur.parent_unit_id AS parent_unit_id,
    parent.org_level + 1 AS org_level,
    parent.root_unit_id AS root_unit_id,
    CASE WHEN parent.org_level = 1 THEN child.id ELSE parent.level2_unit_id END AS level2_unit_id,
    CASE WHEN parent.org_level = 2 THEN child.id ELSE parent.level3_unit_id END AS level3_unit_id
  FROM unit_relations ur
  INNER JOIN relation_unit_types rt ON rt.id = ur.relation_type_id AND rt.code = 'org'
  INNER JOIN units child ON child.id = ur.child_unit_id
  INNER JOIN org_tree parent ON parent.unit_id = ur.parent_unit_id
)
SELECT
  unit_id,
  parent_unit_id,
  org_level,
  root_unit_id,
  level2_unit_id,
  level3_unit_id,
  COALESCE(level3_unit_id, level2_unit_id, unit_id) AS group_unit_id
FROM org_tree;
