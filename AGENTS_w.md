# AGENTS.md

This repository contains a Node.js backend with MariaDB (relational “system of record”) and MongoDB (versioned Profiles). We are in design stage: it is acceptable to DROP and recreate MariaDB tables and Mongo collections. Prioritize correctness, traceability, and enforceable constraints.

Your job (Codex agent) is to implement end-to-end the redesigned organizational + staffing + recruitment + authorization architecture described below, from a terminal, following best practices.

---

## 0) Non-negotiable design decisions (authoritative)

1) Only **Units** exist as organizational scopes. There is no `programs` table. “Programs/Carreras” are a `unit_type` inside `units`.
2) A **Puesto** is a concrete position/plaza inside a Unit (`unit_positions`). A Puesto can be active/inactive independently of occupancy.
3) **Ocupaciones** (`position_assignments`) track who occupies a Puesto, with full history. A Puesto has at most one current occupant.
4) **Vacantes** are a recruitment entity attached to one Puesto. At most one “abierta” vacancy per Puesto.
5) **Contratos** link a Person to a Vacancy (hiring) and reconcile with occupancy.
6) **Profiles** are versioned in MongoDB (immutable versions). SQL stores a reference to the chosen version.
7) Authorization is **RBAC + ABAC**:
   - RBAC controls access and general actions (“can use module X”).
   - ABAC uses current occupancy to authorize institutional acts (e.g., “sign as Coordinator”).
   - For signing/approving, authorization is **OR**: RBAC permission OR ABAC occupancy.
   - Blocking-by-state always wins: inactive person/unit/position or non-current occupancy denies.
8) No global roles (`unit_id` is always NOT NULL). Use a dedicated “SYSTEM” Unit for platform admin.
9) Role inheritance is **per role assignment**: each assignment defines `max_depth` and allowed `relation_type` edges.
10) Roles can be **derived automatically** from occupancy:
   - mapping is by Cargo (`cargo_role_map`)
   - derived role assignments are scoped to the exact unit (`max_depth=0`)
   - derived vs manual roles are distinguished (`source`, `derived_from_assignment_id`)
   - when an occupancy ends, revoke only derived assignments linked to it (manual stays).

---

## 1) Deliverables (what you must implement)

A) Replace `mariadb_schema.sql` with a canonical schema implementing:
   - Units, Persons, Cargos, Puestos, Ocupaciones, Vacantes, Contratos
   - RBAC tables + inheritance configuration + derived-role mapping
B) Update the schema bootstrap (`ensureMariaDBSchema`) to:
   - Perform a controlled database reset (drop tables in dependency order)
   - Recreate everything from `mariadb_schema.sql`
   - Remove legacy code paths related to `programs` and `program_id`
C) Implement minimal backend services (modules) for:
   - Puestos management, occupancy lifecycle, vacancy lifecycle, contract creation
   - Authorization engine (RBAC + ABAC + inheritance + OR for sign/approve)
   - Automatic derived role synchronization from occupancy
D) Implement safety-net DB triggers for state changes (revocation/closure with audit fields; no deletes)
E) Add minimal tests or a runnable script validating constraints and key scenarios

---

## 2) MariaDB schema (DDL requirements)

### 2.1 Units
Keep/create:
- `unit_types(id, name UNIQUE, is_active, created_at)`
- `units(id, name, slug UNIQUE, unit_type_id FK, is_active, created_at, updated_at)`
- `unit_relations(parent_unit_id, child_unit_id, relation_type, created_at, PK(parent,child))`

Notes:
- `relation_type` is used by role inheritance; default can be `'parent'`.
- Enforce FKs.

### 2.2 Persons
Use `persons` table as system users/employees (keep `is_active`, `created_at`, `updated_at`). It is acceptable to simplify columns, but preserve:
- `id PK`
- `email` unique (recommended)
- `password_hash` (or equivalent)
- `is_active`, `created_at`, `updated_at`

### 2.3 Cargos (catalog)
Create/keep:
- `cargos(id PK, name UNIQUE, description, is_active, created_at, updated_at)`

### 2.4 Puestos (unit_positions)
Create:
- `unit_positions`:
  - `id PK`
  - `unit_id` NOT NULL FK → `units(id)`
  - `cargo_id` NOT NULL FK → `cargos(id)`
  - `slot_no` INT NOT NULL DEFAULT 1
  - `title` VARCHAR(180) NULL
  - `profile_ref` VARCHAR(64) NULL  (Mongo version id string)
  - `is_active` TINYINT(1) NOT NULL DEFAULT 1
  - `deactivated_at` DATETIME NULL
  - `created_at`, `updated_at`
  - `UNIQUE(unit_id, cargo_id, slot_no)`
  - indexes for listing by `(unit_id, cargo_id, is_active)`

### 2.5 Ocupaciones (position_assignments)
Create:
- `position_assignments`:
  - `id PK`
  - `position_id` NOT NULL FK → `unit_positions(id)`
  - `person_id` NOT NULL FK → `persons(id)`
  - `start_date` DATE NOT NULL
  - `end_date` DATE NULL
  - `is_current` TINYINT(1) NOT NULL DEFAULT 1
  - `current_flag` generated: `IF(is_current=1,1,NULL)` PERSISTENT
  - `created_at`, `updated_at`
  - `UNIQUE(position_id, current_flag)` ensures only one current occupant per position
  - index `(person_id, is_current)`

Business invariants enforced in service layer (and validated in tests):
- If `is_current=1` then `end_date` must be NULL
- To close, set `is_current=0` and set `end_date`
- Do not deactivate a position while it has a current assignment (service rule)

### 2.6 Vacantes (recruitment entity)
Create:
- `vacancies`:
  - `id PK`
  - `position_id` NOT NULL FK → `unit_positions(id)`
  - `title` VARCHAR(180) NOT NULL
  - `category` VARCHAR(120) NULL
  - `dedication` VARCHAR(30) NOT NULL
  - `relation_type` VARCHAR(60) NOT NULL
  - `status` ENUM('abierta','cubierta','cerrada','cancelada') NOT NULL DEFAULT 'abierta'
  - `open_flag` generated: `IF(status='abierta',1,NULL)` PERSISTENT
  - `profile_ref` VARCHAR(64) NULL (optional snapshot of required profile)
  - `opened_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  - `closed_at` DATETIME NULL
  - `created_at`, `updated_at`
  - `UNIQUE(position_id, open_flag)` enforces max 1 open vacancy per position
  - index `(position_id, status)`

Service rules:
- vacancy can be opened only if position is active
- vacancy open should normally require “position currently unoccupied”; implement this rule unless business requires replacements (if replacements needed, add explicit `replacement_mode` flag later)

### 2.7 Contratos
Create:
- `contracts`:
  - `id PK`
  - `person_id` NOT NULL FK → `persons(id)`
  - `vacancy_id` NOT NULL FK → `vacancies(id)`
  - `relation_type` VARCHAR(60) NOT NULL
  - `dedication` VARCHAR(30) NOT NULL
  - `start_date` DATE NOT NULL
  - `end_date` DATE NULL
  - `status` ENUM('activo','finalizado','cancelado') NOT NULL DEFAULT 'activo'
  - `active_flag` generated: `IF(status='activo',1,NULL)` PERSISTENT
  - `created_at`, `updated_at`
  - `UNIQUE(vacancy_id, active_flag)` enforces one active contract per vacancy
  - index `(person_id, status)`

Reconciliation rule (service layer):
- When creating an active contract:
  - transition vacancy to `cubierta` and set `closed_at`
  - create a current occupancy assignment for the vacancy’s position and the hired person
  - synchronize derived roles for that occupancy

---

## 3) MongoDB Profiles (versioned)

Collection: `profiles` (immutable versions)

Document requirements:
- `_id` ObjectId (use as `profile_ref` in SQL)
- `profile_key` stable id across versions (string)
- `version` integer or semver string
- `title` string
- `requirements` object (free shape)
- `created_at` ISODate
- `created_by_person_id` optional int
- `status` 'active' | 'deprecated'

Rules:
- Never overwrite a version; create a new document for a new version.
- SQL stores only the chosen version reference (`profile_ref`).

(Optionally) implement a small `profiles` service in Node that creates a new version and returns `_id` for use in SQL.

---

## 4) Authorization architecture (RBAC + ABAC)

### 4.1 RBAC tables
Create/keep:
- `roles(id, name UNIQUE, description, is_active)`
- `permissions(id, code UNIQUE, description)`
- `role_permissions(role_id, permission_id, PK(role_id, permission_id))`

### 4.2 Role assignments (unit-scoped, auditable, inheritable per assignment)
Create `role_assignments` with:
- `id PK`
- `person_id` NOT NULL FK → persons
- `role_id` NOT NULL FK → roles
- `unit_id` NOT NULL FK → units (no global)
- `source` ENUM('manual','derived') NOT NULL DEFAULT 'manual'
- `derived_from_assignment_id` INT NULL FK → position_assignments(id)
- `max_depth` INT NOT NULL DEFAULT 0
- `start_date` DATE NOT NULL
- `end_date` DATE NULL
- `is_current` TINYINT(1) NOT NULL DEFAULT 1
- `current_flag` generated: `IF(is_current=1,1,NULL)` PERSISTENT
- `assigned_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
- `revoked_at` DATETIME NULL
- `revoked_reason` VARCHAR(255) NULL
- `UNIQUE(person_id, role_id, unit_id, source, current_flag)` to prevent duplicate current assignments per origin
- indexes on `(person_id)`, `(unit_id)`

Create child table `role_assignment_relation_types` (K2):
- `role_assignment_id` FK → role_assignments
- `relation_type` VARCHAR(60)
- PK(role_assignment_id, relation_type)

Interpretation:
- If `max_depth = 0` then inheritance is disabled and `role_assignment_relation_types` is ignored.
- If `max_depth > 0`, allowed relation types define which `unit_relations` edges are traversable.

### 4.3 Derived roles from occupancy
Create mapping table:
- `cargo_role_map(cargo_id, role_id, PK(cargo_id, role_id))`

Derivation rules:
- When a current occupancy is created for a position:
  - lookup roles mapped to that position’s cargo
  - create current `role_assignments` with:
    - `unit_id = unit_positions.unit_id`
    - `max_depth = 0`
    - `source = 'derived'`
    - `derived_from_assignment_id = position_assignments.id`
- When the occupancy is closed:
  - revoke only `role_assignments` where `source='derived'` and `derived_from_assignment_id` matches

### 4.4 Authorization evaluation algorithm (must implement)
Implement a single authorization function, e.g. `authorize(personId, permissionCode, unitScopeId, context)`.

Hard blocks (H1):
- persons.is_active must be 1
- units.is_active must be 1 for the scoped unit
- if action requires a position occupancy, the position must be active and occupancy current

RBAC resolution:
1) fetch person’s current role assignments (today within start/end and is_current=1)
2) for each role assignment, determine if it covers `unitScopeId`:
   - if unit_id == unitScopeId => covered
   - else if max_depth > 0 => covered only if unitScopeId is a descendant within max_depth hops using unit_relations edges whose relation_type is in role_assignment_relation_types for that assignment
3) if any covered role has the permission via role_permissions => RBAC allow

ABAC resolution (occupancy-based):
- For institutional actions like “sign/approve as Cargo X”:
  - verify current occupancy for the person in the unit_scope with required cargo
  - (cargo requirement can be provided in `context.requiredCargoId` or `context.requiredCargoName`)

Final decision for sign/approve actions:
- Allow if RBAC allow OR ABAC allow (G3b), after hard blocks

Implementation detail:
- Provide an API to resolve descendants with max depth and relation_type constraints.
- Use a BFS/DFS in SQL (recursive CTE if MariaDB supports it in your version) or in Node with iterative queries. Keep it correct first; optimize later.

---

## 5) Safety-net triggers (required)

Even though the service layer must enforce H1, implement DB triggers that revoke/close data when entities are inactivated, without deleting rows.

1) `AFTER UPDATE persons` when `is_active` transitions 1 → 0:
   - close current `position_assignments` for that person:
     - set `is_current=0`, `end_date=CURDATE()` if NULL
   - revoke current `role_assignments` for that person:
     - set `is_current=0`, `end_date=CURDATE()` if NULL
     - set `revoked_at=NOW()`, `revoked_reason='person_inactivated'`

2) `AFTER UPDATE units` when `is_active` transitions 1 → 0:
   - revoke current `role_assignments` scoped to that unit:
     - set `is_current=0`, `end_date=CURDATE()` if NULL
     - set `revoked_at=NOW()`, `revoked_reason='unit_inactivated'`
   - optional but recommended: close open vacancies for positions in that unit:
     - set status='cancelada', closed_at=NOW()

Do not use DELETE for these operations.

---

## 6) Schema bootstrap/reset

Update `ensureMariaDBSchema`:
- In design stage, implement a reset that drops tables in reverse dependency order:
  - contracts
  - vacancies
  - role_assignment_relation_types
  - role_assignments
  - cargo_role_map
  - role_permissions
  - permissions
  - roles
  - position_assignments
  - unit_positions
  - cargos
  - unit_relations
  - units
  - unit_types
  - persons (optional; decide based on whether you seed admin user)
- Then run `mariadb_schema.sql` statements sequentially.

Remove legacy patches:
- remove any references to `programs`, `program_id`, `program_*` tables, `users` legacy drops not applicable, and ad-hoc ALTERs for removed columns.

---

## 7) Minimal services to implement (Node)

Implement modules with transaction-safe operations:
1) PositionsService:
   - createPosition(unit_id, cargo_id, slot_no, profile_ref, ...)
   - activatePosition(id) / deactivatePosition(id) (block if currently occupied)
2) OccupancyService:
   - assignPersonToPosition(position_id, person_id, start_date)
     - must fail if position inactive
     - must fail if position has current occupant (UNIQUE will enforce; handle error)
     - in same transaction: create derived role_assignments for mapped cargo roles
   - closeAssignment(assignment_id, end_date)
     - revoke derived roles linked to assignment_id
3) VacancyService:
   - openVacancy(position_id, ...)
     - must fail if position inactive
     - must fail if already open vacancy exists (UNIQUE)
   - closeVacancy / cancelVacancy / markCovered
4) ContractService:
   - createActiveContract(vacancy_id, person_id, start_date, ...)
     - must set vacancy to `cubierta`, create occupancy assignment, sync derived roles (single transaction)
5) AuthorizationService:
   - authorize(permission_code, unit_scope_id, context) implementing RBAC+ABAC rules above

---

## 8) Acceptance tests / validation script (required)

Provide either automated tests or a runnable script `scripts/validate_design.mjs` that proves:

A) Puesto occupancy uniqueness:
- create a position
- assign person A as current
- attempt assign person B as current → must fail (unique constraint)

B) Vacancy uniqueness:
- open vacancy for position
- attempt open another vacancy with status=abierta → must fail (unique constraint)

C) Derived role sync:
- map cargo “Coordinator” to a role “CoordinatorRole”
- create occupancy for a Coordinator position
- verify role_assignment exists with source='derived', max_depth=0, derived_from_assignment_id set
- close occupancy
- verify derived role_assignment revoked (is_current=0) but manual remains untouched

D) Inheritance by assignment:
- create unit tree using unit_relations with multiple relation_type values
- create role_assignment with max_depth>0 and allowed relation_types
- verify authorize() works for descendants within depth and allowed edges, and fails outside

E) Hard blocks:
- inactivate person or unit
- verify authorize() denies

---

## 9) Notes

- Use InnoDB and utf8mb4 everywhere.
- Ensure all FK columns are indexed.
- Prefer transactions for any operation that touches multiple tables (vacancy->contract->occupancy->roles).
- Do not delete for revocations; always close by dates and set audit fields.

End.


