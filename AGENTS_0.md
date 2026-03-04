# AGENTS.md

This repository contains a MariaDB + Node.js backend and uses MongoDB to store versioned “profiles” (job/position requirements). We are in a design phase: it is acceptable to DROP and recreate the MariaDB database (and Mongo collections) to implement the new data model cleanly.

Your job (Codex agent) is to implement, end-to-end, the redesigned staffing/recruitment model with strong traceability, consistent constraints, and clean schema initialization from a terminal.

## 1) Goal: New Domain Model (Authoritative)

We will keep only **Units** for organizational structure (no `programs` table). “Programs” become a `unit_type` (e.g., Carrera/Programa) inside `units`.

Core entities:
- Units: organizational nodes (campus/faculty/school/program/etc.).
- Persons: system users and employees.
- Cargos: catalog of cargo types (Docente, Director, Jefe, Externo, etc.).
- Puestos (unit_positions): positions/plazas defined per unit (with slot numbering).
- Ocupaciones (position_assignments): who occupies a puesto, with historical trace.
- Perfiles (Mongo): versioned profile documents referenced by puestos (and optionally captured by vacancies).
- Vacantes: recruitment openings for a puesto (posting lifecycle, applicants handled elsewhere).
- Contratos: hiring/contract records linked to a vacancy and person; should reconcile with an occupancy assignment.

Design principle:
- `unit_positions` defines the **existence of the seat/plaza**.
- `position_assignments` captures **occupancy history** of that seat.
- `vacancies` captures **recruitment lifecycle** (open/close/cancel/fill).
- `contracts` captures **employment relation** for a person filling a vacancy.
- Mongo profiles provide versioning and rich requirements payload; SQL stores references for integrity and reporting.

## 2) Repository Expectations

1) Replace the current schema file `mariadb_schema.sql` with a new schema implementing the entities above.
2) Update the existing initializer/migration logic (`ensureMariaDBSchema`) to:
   - Allow dropping all tables and recreating them (design stage).
   - Create tables in a correct order (avoid FK-order errors).
   - Create indexes, unique constraints, and FKs as described below.
3) Remove legacy program-related schema and code paths:
   - Drop `programs`, `program_unit_history`, `program_processes`, `student_program_terms`, and all `program_id` foreign keys from the redesigned scope.
   - Update any code that assumes a `program_id` scope to use `unit_id`.
4) Implement minimal data access (DAO/repository) and validation logic for:
   - creating units, cargos, puestos, ocupaciones, profiles, vacancies, contracts.
5) Add a small seed script (optional but recommended) to create one unit tree, cargos, puestos, and demonstrate one vacancy → contract → occupancy sequence.

## 3) MariaDB Schema (Required Tables + Constraints)

### 3.1 Units

Keep:
- `unit_types(id, name UNIQUE, is_active, created_at)`
- `units(id, name, slug UNIQUE, unit_type_id FK, is_active, created_at)`
- `unit_relations(parent_unit_id, child_unit_id, relation_type, created_at, PK(parent,child))`

Add (optional but recommended for traceability):
- `units.updated_at` with ON UPDATE CURRENT_TIMESTAMP.

Ensure:
- `unit_relations` prevents self-links if possible (application validation at least).

### 3.2 Persons

Use existing `persons` table (can be simplified if needed, but keep trace fields):
- `id PK`
- unique identifiers (`cedula`, `email`) as already present
- `is_active`, `created_at`, `updated_at`

### 3.3 Cargos (Catalog)

Table `cargos`:
- `id PK`
- `name UNIQUE`
- `description`
- `is_active`
- `created_at`
- Add `updated_at` (optional but recommended)

Do NOT encode unit-level uniqueness here; uniqueness is enforced at the **puesto** level.

### 3.4 Puestos (unit_positions)

Create table `unit_positions` with:
- `id PK`
- `unit_id` NOT NULL FK -> `units(id)`
- `cargo_id` NOT NULL FK -> `cargos(id)`
- `slot_no` INT NOT NULL DEFAULT 1
- `title` VARCHAR(180) NULL (human-readable label; optional)
- `profile_ref` VARCHAR(64) NULL  (Mongo profile version ID or canonical reference)
- `profile_version` VARCHAR(20) NULL (optional; helpful if profile_ref is not self-describing)
- `is_active` TINYINT(1) NOT NULL DEFAULT 1
- `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
- `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
- `deactivated_at` DATETIME NULL

Constraints:
- `UNIQUE(unit_id, cargo_id, slot_no)` (position identity within a unit/cargo)
- Index `(unit_id, cargo_id, is_active)` for listing
- Application rule: do not deactivate if currently occupied (see Ocupaciones).

### 3.5 Ocupaciones (position_assignments)

Create table `position_assignments`:
- `id PK`
- `position_id` NOT NULL FK -> `unit_positions(id)`
- `person_id` NOT NULL FK -> `persons(id)`
- `start_date` DATE NOT NULL
- `end_date` DATE NULL
- `is_current` TINYINT(1) NOT NULL DEFAULT 1
- `current_flag` TINYINT(1) AS (IF(is_current=1, 1, NULL)) PERSISTENT
- `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
- `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP

Constraints:
- `UNIQUE(position_id, current_flag)` ensures only one current occupant per position.
- Index `(person_id, is_current)` for “where is this person currently assigned”.

Validation rules (application-level; triggers optional):
- If `is_current=1`, `end_date` must be NULL.
- If closing an assignment, set `is_current=0` and set `end_date`.
- Do not create a new current assignment if an existing current assignment exists for the same position (the UNIQUE will enforce).

### 3.6 Vacantes (Recruitment Entity)

Vacancies represent recruitment openings. A vacancy is tied to a single `unit_position`.

Create table `vacancies`:
- `id PK`
- `position_id` NOT NULL FK -> `unit_positions(id)`
- `title` VARCHAR(180) NOT NULL  (can default from position/cargo/unit)
- `category` VARCHAR(120) NULL
- `dedication` VARCHAR(30) NOT NULL  (e.g., TC/TP/Horas)
- `relation_type` VARCHAR(60) NOT NULL (e.g., nombramiento/contrato/servicios)
- `status` VARCHAR(30) NOT NULL DEFAULT 'abierta'
  - allowed values (enforce via ENUM or app validation): `abierta`, `cerrada`, `cancelada`, `cubierta`
- `opened_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
- `closed_at` DATETIME NULL
- `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
- `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
- Optional: `profile_ref` VARCHAR(64) NULL to snapshot the profile version required by the vacancy.

Constraints:
- Index `(position_id, status)`
- Consider enforcing “at most one open vacancy per position”:
  - Use generated flag + UNIQUE pattern if you want DB-enforced:
    - `open_flag AS (IF(status='abierta',1,NULL))` and `UNIQUE(position_id, open_flag)`
  - If you prefer app-only validation, still implement consistent checks.

Business rules:
- A vacancy can be opened only if the position is active.
- If the position is already occupied (has a current assignment), you may either block opening a vacancy or allow it only for replacement workflows; choose one and implement consistently.
- On hiring, vacancy transitions to `cubierta` (or `cerrada`), and `closed_at` is set.

### 3.7 Contratos

Contracts link a person to a vacancy (hiring event) and should also reconcile with occupancy.

Create table `contracts`:
- `id PK`
- `person_id` NOT NULL FK -> `persons(id)`
- `vacancy_id` NOT NULL FK -> `vacancies(id)`
- `relation_type` VARCHAR(60) NOT NULL
- `dedication` VARCHAR(30) NOT NULL
- `start_date` DATE NOT NULL
- `end_date` DATE NULL
- `status` VARCHAR(30) NOT NULL DEFAULT 'activo'
  - allowed values: `activo`, `finalizado`, `cancelado`
- `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
- `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP

Constraints:
- Index `(vacancy_id, status)`
- Optionally, prevent multiple active contracts for the same vacancy:
  - `active_flag AS (IF(status='activo',1,NULL))` and `UNIQUE(vacancy_id, active_flag)`

Reconciliation rule:
- When a contract becomes `activo`, ensure an occupancy (`position_assignments`) exists for the vacancy’s position and person, marked current, with matching start_date.
  - Implement in application service logic (preferred), or via DB trigger if necessary.

## 4) MongoDB Profiles (Versioned)

Profiles live in MongoDB and are referenced from SQL.

Create collection `profiles` with versioned documents. Use immutable versions.
Recommended document shape:
- `_id`: ObjectId
- `profile_key`: stable identifier across versions (string/uuid)
- `version`: integer or semver string
- `title`: string
- `requirements`: object (skills, education, experience, etc.)
- `created_at`: ISODate
- `created_by_person_id`: optional int (for traceability)
- `status`: `active`/`deprecated`

Versioning rule:
- Do not overwrite a profile version; create a new document for each version.
- In SQL, store `profile_ref` as either:
  - Mongo `_id` string of the specific version, OR
  - a composite reference `{profile_key, version}` (if you also store both fields).
Prefer storing the specific version `_id` to be unambiguous.

Relationship:
- One profile version can be reused by many positions and/or vacancies (1:N).
- A position typically points to the “current required profile version”; when profile updates, update the position’s `profile_ref` to the new version (optionally record a SQL history row if needed).

Optional traceability table in MariaDB (recommended if you need audits of profile changes):
- `position_profile_history(position_id, profile_ref, effective_from, effective_to, created_at)`
This is not mandatory but is the simplest way to answer “what profile did this position require in term X”.

## 5) Implementation Steps (Codex Checklist)

1) Update schema file:
   - Replace existing `mariadb_schema.sql` content with the new DDL.
   - Ensure correct creation order:
     - unit_types → units → unit_relations
     - persons
     - cargos
     - unit_positions
     - position_assignments
     - vacancies
     - contracts
2) Update `ensureMariaDBSchema`:
   - Because this is design stage, implement a controlled “reset”:
     - Drop tables in reverse dependency order (contracts, vacancies, assignments, positions, cargos, relations, units, unit_types, persons if desired).
     - Recreate schema from file.
   - Remove legacy patch logic that targets deleted tables/columns (programs/program_id paths).
3) Refactor code references:
   - Remove `program_id` usage in business logic for staffing/recruitment.
   - Ensure any “scope” is based on `unit_id`.
4) Add service-level logic (minimal):
   - Create/activate/deactivate positions.
   - Assign/unassign occupants (create/close `position_assignments`).
   - Open/close/cancel vacancies.
   - Create contracts and enforce reconciliation with an occupancy assignment.
5) Add validations:
   - Do not allow two current occupants for a position (DB constraint).
   - Do not allow opening vacancy for inactive position.
   - Do not allow deactivating a position that is currently occupied (service validation).
   - Enforce state transitions for vacancy/contract statuses.
6) Add basic tests (recommended):
   - Attempt to insert two current assignments for same position → must fail.
   - Attempt to open two “abierta” vacancies for same position (if enforced) → must fail.
   - Contract creation triggers/ensures occupancy exists.

## 6) Operational Notes

- We accept database resets; do not write incremental migrations for this stage.
- Prefer consistent naming:
  - `unit_positions` / `position_assignments` / `vacancies` / `contracts`.
- Prefer using InnoDB and utf8mb4.
- Ensure all FK columns are indexed (MariaDB usually requires/creates indexes, but define explicitly where helpful).

## 7) Deliverables

After implementation, provide:
- Updated `mariadb_schema.sql`
- Updated `ensureMariaDBSchema` logic (no legacy program patches)
- New repository modules for:
  - positions, assignments, vacancies, contracts (DAO + services)
- A small seed or script demonstrating:
  - create unit + cargo + 10 positions for Docente
  - open vacancy for one position
  - create contract for a person and confirm occupancy current

End.

