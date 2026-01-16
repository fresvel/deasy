# MER Limpio (Propuesto)

## Entidades principales
- `Person` (empleado/estudiante/externo)
- `Role` (permisos funcionales globales)
- `RoleAssignment` (rol por contexto: unit/program)
- `Cargo` (catálogo de cargos institucionales)
- `UnitType` (tipos de unidad dinámicos)
- `Unit` (jerarquía flexible)
- `UnitRelation` (Unit ↔ Unit, N:N)
- `Program`
- `ProgramUnitHistory` (historial de pertenencia del programa a unidades)
- `Process` (catálogo de procesos; `parent_id` opcional; `has_document`)
- `UnitProcess` (Proceso aplica a Unidad)
- `ProgramProcess` (Proceso aplica a Programa)
- `Term` (periodo configurable)
- `Document` (instancia única por proceso + term + unidad/programa)
- `DocumentVersion`
- `DocumentSignature`
- `Vacancy`
- `Contract`
- `StudentProgramTerm` (historial de matrícula)
- `Template` (catálogo de plantillas LaTeX con versión actual)

## Relaciones y cardinalidades
1) **Unit jerarquía**
- `Unit` N:N `Unit` mediante `UnitRelation` (parent_id, child_id)

2) **UnitType**
- `UnitType` 1:N `Unit`

3) **Program pertenencia a Unit (con historial)**
- `Program` 1:N `ProgramUnitHistory`
- `Unit` 1:N `ProgramUnitHistory`

4) **Process jerarquía**
- `Process` 1:N `Process` (parent_id opcional, un solo padre)

5) **Process aplica a**
- `Process` N:N `Unit` via `UnitProcess`
- `Process` N:N `Program` via `ProgramProcess`
- Regla: un `Process` debe estar al menos en una de esas dos tablas.

6) **Term**
- `Term` 1:N `Document`

7) **Document**
- `Document` único por {process + term + unit_id o program_id}
- `Document` 1:N `DocumentVersion`

8) **DocumentVersion**
- `DocumentVersion` 1:N `DocumentSignature`

9) **Firmas**
- `DocumentSignature` N:1 `Person`
- Flujo por defecto autor→revisor→aprobador, configurable por proceso.

10) **Roles y cargos**
- `Person` N:N `Role` vía `RoleAssignment` (global o por unit/program)
- `Person` N:N `Cargo` vía `PersonCargo` (con unit_id/program_id)

11) **Vacantes y contratos**
- `Vacancy` N:1 `Unit` (opcional) y N:1 `Program` (opcional)
- `Vacancy` 1:N `Contract`
- `Person` 1:N `Contract` (segundo contrato permitido)

12) **Estudiantes**
- `Person` 1:N `StudentProgramTerm`
- `Program` 1:N `StudentProgramTerm`
- `Term` 1:N `StudentProgramTerm`

13) **Plantillas**
- `Template` N:N `Process` vía `ProcessTemplate`
