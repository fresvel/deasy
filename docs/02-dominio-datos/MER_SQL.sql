-- MER limpio convertido a SQL (MariaDB)
-- Nota: algunas reglas de unicidad/validacion (unit_id/program_id) se aplican en capa de aplicacion.

CREATE TABLE unit_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE units (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  slug VARCHAR(180) NOT NULL UNIQUE,
  unit_type_id INT NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (unit_type_id) REFERENCES unit_types(id)
);

CREATE TABLE unit_relations (
  parent_unit_id INT NOT NULL,
  child_unit_id INT NOT NULL,
  relation_type VARCHAR(60) DEFAULT 'parent',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (parent_unit_id, child_unit_id),
  FOREIGN KEY (parent_unit_id) REFERENCES units(id),
  FOREIGN KEY (child_unit_id) REFERENCES units(id)
);

CREATE TABLE programs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  slug VARCHAR(180) NOT NULL UNIQUE,
  level_type VARCHAR(60) NOT NULL, -- grado/maestria/doctorado/etc
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE program_unit_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  program_id INT NOT NULL,
  unit_id INT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NULL,
  is_current TINYINT(1) NOT NULL DEFAULT 1,
  FOREIGN KEY (program_id) REFERENCES programs(id),
  FOREIGN KEY (unit_id) REFERENCES units(id)
);

CREATE TABLE processes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  slug VARCHAR(180) NOT NULL UNIQUE,
  parent_id INT NULL,
  unit_id INT NULL,
  program_id INT NULL,
  has_document TINYINT(1) NOT NULL DEFAULT 1,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (unit_id IS NOT NULL OR program_id IS NOT NULL),
  FOREIGN KEY (parent_id) REFERENCES processes(id),
  FOREIGN KEY (unit_id) REFERENCES units(id),
  FOREIGN KEY (program_id) REFERENCES programs(id)
);

CREATE TABLE unit_processes (
  unit_id INT NOT NULL,
  process_id INT NOT NULL,
  PRIMARY KEY (unit_id, process_id),
  FOREIGN KEY (unit_id) REFERENCES units(id),
  FOREIGN KEY (process_id) REFERENCES processes(id)
);

CREATE TABLE program_processes (
  program_id INT NOT NULL,
  process_id INT NOT NULL,
  PRIMARY KEY (program_id, process_id),
  FOREIGN KEY (program_id) REFERENCES programs(id),
  FOREIGN KEY (process_id) REFERENCES processes(id)
);

CREATE TABLE terms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(60) NOT NULL UNIQUE, -- 2025-I, 2025-II, Verano
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1
);

CREATE TABLE templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  slug VARCHAR(180) NOT NULL UNIQUE,
  description VARCHAR(255) NULL,
  version VARCHAR(10) NOT NULL DEFAULT '0.1',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE process_templates (
  process_id INT NOT NULL,
  template_id INT NOT NULL,
  PRIMARY KEY (process_id, template_id),
  FOREIGN KEY (process_id) REFERENCES processes(id),
  FOREIGN KEY (template_id) REFERENCES templates(id)
);

CREATE TABLE persons (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cedula VARCHAR(20) UNIQUE,
  first_name VARCHAR(120) NOT NULL,
  last_name VARCHAR(120) NOT NULL,
  email VARCHAR(180) UNIQUE,
  whatsapp VARCHAR(30),
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  description VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1
);

CREATE TABLE permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(120) NOT NULL UNIQUE,
  description VARCHAR(255) NULL
);

CREATE TABLE role_permissions (
  role_id INT NOT NULL,
  permission_id INT NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  FOREIGN KEY (role_id) REFERENCES roles(id),
  FOREIGN KEY (permission_id) REFERENCES permissions(id)
);

CREATE TABLE role_assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  person_id INT NOT NULL,
  role_id INT NOT NULL,
  unit_id INT NULL,
  program_id INT NULL,
  assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (person_id) REFERENCES persons(id),
  FOREIGN KEY (role_id) REFERENCES roles(id),
  FOREIGN KEY (unit_id) REFERENCES units(id),
  FOREIGN KEY (program_id) REFERENCES programs(id)
);

CREATE TABLE cargos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  description VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1
);

CREATE TABLE person_cargos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  person_id INT NOT NULL,
  cargo_id INT NOT NULL,
  unit_id INT NULL,
  program_id INT NULL,
  start_date DATE NOT NULL,
  end_date DATE NULL,
  is_current TINYINT(1) NOT NULL DEFAULT 1,
  current_flag TINYINT(1) AS (IF(is_current = 1, 1, NULL)) PERSISTENT,
  UNIQUE (person_id, cargo_id, current_flag),
  FOREIGN KEY (person_id) REFERENCES persons(id),
  FOREIGN KEY (cargo_id) REFERENCES cargos(id),
  FOREIGN KEY (unit_id) REFERENCES units(id),
  FOREIGN KEY (program_id) REFERENCES programs(id)
);

CREATE TABLE documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  process_id INT NOT NULL,
  term_id INT NOT NULL,
  unit_id INT NULL,
  program_id INT NULL,
  unit_id_key INT AS (IFNULL(unit_id, -1)) PERSISTENT,
  program_id_key INT AS (IFNULL(program_id, -1)) PERSISTENT,
  status VARCHAR(30) NOT NULL DEFAULT 'Inicial',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL,
  CHECK (unit_id IS NOT NULL OR program_id IS NOT NULL),
  UNIQUE (process_id, term_id, unit_id_key, program_id_key),
  FOREIGN KEY (process_id) REFERENCES processes(id),
  FOREIGN KEY (term_id) REFERENCES terms(id),
  FOREIGN KEY (unit_id) REFERENCES units(id),
  FOREIGN KEY (program_id) REFERENCES programs(id)
);

CREATE TABLE document_versions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  document_id INT NOT NULL,
  version INT NOT NULL,
  payload_mongo_id VARCHAR(180) NOT NULL,
  payload_hash VARCHAR(64) NOT NULL,
  latex_path VARCHAR(255) NULL,
  pdf_path VARCHAR(255) NULL,
  signed_pdf_path VARCHAR(255) NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'Borrador',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (document_id, version),
  FOREIGN KEY (document_id) REFERENCES documents(id)
);

CREATE TABLE document_signatures (
  id INT AUTO_INCREMENT PRIMARY KEY,
  document_version_id INT NOT NULL,
  signer_user_id INT NOT NULL,
  signature_role VARCHAR(30) NOT NULL, -- autor/revisor/aprobador
  signature_status VARCHAR(30) NOT NULL DEFAULT 'pendiente',
  note_short VARCHAR(255) NULL,
  signed_file_path VARCHAR(255) NULL,
  signed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (document_version_id) REFERENCES document_versions(id),
  FOREIGN KEY (signer_user_id) REFERENCES persons(id)
);

CREATE TABLE vacancies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  unit_id INT NULL,
  program_id INT NULL,
  title VARCHAR(180) NOT NULL,
  category VARCHAR(120) NULL, -- titular, ocasional, auxiliar, principal, etc
  dedication VARCHAR(30) NOT NULL, -- TC/MT/TP
  relation_type VARCHAR(60) NOT NULL, -- dependencia/servicios
  status VARCHAR(30) NOT NULL DEFAULT 'abierta',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ((unit_id IS NULL) <> (program_id IS NULL)),
  FOREIGN KEY (unit_id) REFERENCES units(id),
  FOREIGN KEY (program_id) REFERENCES programs(id)
);

CREATE TABLE contracts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  person_id INT NOT NULL,
  vacancy_id INT NOT NULL,
  relation_type VARCHAR(60) NOT NULL,
  dedication VARCHAR(30) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'activo',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (person_id) REFERENCES persons(id),
  FOREIGN KEY (vacancy_id) REFERENCES vacancies(id)
);

CREATE TABLE student_program_terms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  person_id INT NOT NULL,
  program_id INT NOT NULL,
  term_id INT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'activo',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (person_id, program_id, term_id),
  FOREIGN KEY (person_id) REFERENCES persons(id),
  FOREIGN KEY (program_id) REFERENCES programs(id),
  FOREIGN KEY (term_id) REFERENCES terms(id)
);
