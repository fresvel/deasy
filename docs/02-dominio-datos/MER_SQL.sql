-- MySQL Workbench / MariaDB DDL (modelo organizacional + puestos + reclutamiento + RBAC)
-- Recomendación: ejecutar en un schema vacío o usar Reverse Engineer sobre este script.

SET FOREIGN_KEY_CHECKS=0;

DROP TABLE IF EXISTS cargo_role_map;
DROP TABLE IF EXISTS role_assignment_relation_types;
DROP TABLE IF EXISTS role_assignments;
DROP TABLE IF EXISTS role_permissions;
DROP TABLE IF EXISTS permissions;
DROP TABLE IF EXISTS roles;

DROP TABLE IF EXISTS contracts;
DROP TABLE IF EXISTS vacancy_visibility;
DROP TABLE IF EXISTS vacancies;
DROP TABLE IF EXISTS position_assignments;
DROP TABLE IF EXISTS unit_positions;

DROP TABLE IF EXISTS cargos;
DROP TABLE IF EXISTS persons;

DROP TABLE IF EXISTS unit_relations;
DROP TABLE IF EXISTS units;
DROP TABLE IF EXISTS unit_types;

SET FOREIGN_KEY_CHECKS=1;

-- 1) Units
CREATE TABLE unit_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE units (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  label VARCHAR(40) NULL,
  slug VARCHAR(180) NOT NULL UNIQUE,
  unit_type_id INT NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (unit_type_id) REFERENCES unit_types(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE unit_relations (
  parent_unit_id INT NOT NULL,
  child_unit_id INT NOT NULL,
  relation_type VARCHAR(60) NOT NULL DEFAULT 'parent',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (parent_unit_id, child_unit_id),
  FOREIGN KEY (parent_unit_id) REFERENCES units(id),
  FOREIGN KEY (child_unit_id) REFERENCES units(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2) Persons
CREATE TABLE persons (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(180) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3) Cargos (catalog)
CREATE TABLE cargos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  description VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4) Puestos (unit_positions)
CREATE TABLE unit_positions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  unit_id INT NOT NULL,
  cargo_id INT NOT NULL,
  slot_no INT NOT NULL DEFAULT 1,
  title VARCHAR(180) NULL,
  profile_ref VARCHAR(64) NULL, -- Mongo profile version id (string)
  position_type ENUM('real','promocion','simbolico') NOT NULL DEFAULT 'real',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  deactivated_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_unit_cargo_slot (unit_id, cargo_id, slot_no),
  KEY idx_positions_unit_cargo_active (unit_id, cargo_id, is_active),
  FOREIGN KEY (unit_id) REFERENCES units(id),
  FOREIGN KEY (cargo_id) REFERENCES cargos(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5) Ocupaciones (position_assignments)
CREATE TABLE position_assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  position_id INT NOT NULL,
  person_id INT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NULL,
  is_current TINYINT(1) NOT NULL DEFAULT 1,
  current_flag TINYINT(1) AS (IF(is_current=1, 1, NULL)) PERSISTENT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_position_current (position_id, current_flag),
  KEY idx_assignments_person_current (person_id, is_current),
  FOREIGN KEY (position_id) REFERENCES unit_positions(id),
  FOREIGN KEY (person_id) REFERENCES persons(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6) Vacantes (reclutamiento)
CREATE TABLE vacancies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  position_id INT NOT NULL,
  title VARCHAR(180) NOT NULL,
  category VARCHAR(120) NULL,
  dedication VARCHAR(30) NOT NULL,
  relation_type VARCHAR(60) NOT NULL, -- dependencia|servicios|promocion
  status ENUM('abierta','cubierta','cerrada','cancelada') NOT NULL DEFAULT 'abierta',
  open_flag TINYINT(1) AS (IF(status='abierta', 1, NULL)) PERSISTENT,
  profile_ref VARCHAR(64) NULL, -- optional snapshot
  opened_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_one_open_vacancy_per_position (position_id, open_flag),
  KEY idx_vacancies_position_status (position_id, status),
  FOREIGN KEY (position_id) REFERENCES unit_positions(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7) Contratos
CREATE TABLE contracts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  person_id INT NOT NULL,
  position_id INT NOT NULL,
  relation_type VARCHAR(60) NOT NULL, -- dependencia|servicios|promocion
  dedication VARCHAR(30) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NULL,
  status ENUM('activo','finalizado','cancelado') NOT NULL DEFAULT 'activo',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_contracts_person_status (person_id, status),
  KEY idx_contracts_position_status (position_id, status),
  FOREIGN KEY (person_id) REFERENCES persons(id),
  FOREIGN KEY (position_id) REFERENCES unit_positions(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8) RBAC base
CREATE TABLE roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  description VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 9) Visibilidad de vacantes
CREATE TABLE vacancy_visibility (
  id INT AUTO_INCREMENT PRIMARY KEY,
  vacancy_id INT NOT NULL,
  unit_id INT NULL,
  role_id INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_vacancy_visibility_vacancy (vacancy_id),
  KEY idx_vacancy_visibility_unit (unit_id),
  KEY idx_vacancy_visibility_role (role_id),
  FOREIGN KEY (vacancy_id) REFERENCES vacancies(id),
  FOREIGN KEY (unit_id) REFERENCES units(id),
  FOREIGN KEY (role_id) REFERENCES roles(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(120) NOT NULL UNIQUE,
  description VARCHAR(255) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE role_permissions (
  role_id INT NOT NULL,
  permission_id INT NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  FOREIGN KEY (role_id) REFERENCES roles(id),
  FOREIGN KEY (permission_id) REFERENCES permissions(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 10) Role assignments (unit-scoped + herencia por asignación + source/manual|derived)
CREATE TABLE role_assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  person_id INT NOT NULL,
  role_id INT NOT NULL,
  unit_id INT NOT NULL,
  source ENUM('manual','derived') NOT NULL DEFAULT 'manual',
  derived_from_assignment_id INT NULL,
  max_depth INT NOT NULL DEFAULT 0,
  start_date DATE NOT NULL,
  end_date DATE NULL,
  is_current TINYINT(1) NOT NULL DEFAULT 1,
  current_flag TINYINT(1) AS (IF(is_current=1, 1, NULL)) PERSISTENT,
  assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at DATETIME NULL,
  revoked_reason VARCHAR(255) NULL,
  UNIQUE KEY uq_role_assignment_current (person_id, role_id, unit_id, source, current_flag),
  KEY idx_role_assignments_person (person_id),
  KEY idx_role_assignments_unit (unit_id),
  FOREIGN KEY (person_id) REFERENCES persons(id),
  FOREIGN KEY (role_id) REFERENCES roles(id),
  FOREIGN KEY (unit_id) REFERENCES units(id),
  FOREIGN KEY (derived_from_assignment_id) REFERENCES position_assignments(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE role_assignment_relation_types (
  role_assignment_id INT NOT NULL,
  relation_type VARCHAR(60) NOT NULL,
  PRIMARY KEY (role_assignment_id, relation_type),
  FOREIGN KEY (role_assignment_id) REFERENCES role_assignments(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 10) Mapeo cargo -> roles (para roles derivados por ocupación)
CREATE TABLE cargo_role_map (
  cargo_id INT NOT NULL,
  role_id INT NOT NULL,
  PRIMARY KEY (cargo_id, role_id),
  FOREIGN KEY (cargo_id) REFERENCES cargos(id),
  FOREIGN KEY (role_id) REFERENCES roles(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
