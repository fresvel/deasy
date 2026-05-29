# Usuarios del seed de desarrollo

Este documento lista las cuentas incluidas en `backend/scripts/seeds/pucese.seed.json`.
Estas credenciales son solo para entornos locales o de desarrollo. No deben usarse
en QA, produccion ni ambientes con datos reales.

## Credenciales

Contrasena comun para todos los usuarios del seed:

```text
Deasy1234!
```

| ID | Usuario | Cedula | Nombre | Estado | Email verificado | Activo |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `persona.demo1@pucese.edu.ec` | `1234567891` | Persona Demo Uno | Activo | No | Si |
| 2 | `persona.demo2@pucese.edu.ec` | `0987654321` | Persona Demo Dos | Inactivo | No | Si |
| 3 | `director.demo@pucese.edu.ec` | `1234567890` | Carlos Montalvo Pereira | Activo | Si | Si |
| 4 | `asistente.docencia.demo@pucese.edu.ec` | `9000000004` | Asistente Docencia Demo | Activo | Si | Si |
| 5 | `asistente.tthh.demo@pucese.edu.ec` | `9000000005` | Asistente Talento Demo | Activo | Si | Si |
| 6 | `responsable.financiero.demo@pucese.edu.ec` | `9000000006` | Responsable Financiero Demo | Activo | Si | Si |
| 7 | `director.escuela.demo@pucese.edu.ec` | `9000000007` | Director Escuela Demo | Activo | Si | Si |
| 8 | `director.docencia.demo@pucese.edu.ec` | `9000000008` | Director Docencia Demo | Activo | Si | Si |
| 9 | `jefa.talento.demo@pucese.edu.ec` | `9000000009` | Jefa Talento Demo | Activo | Si | Si |
| 10 | `prorrector.demo@pucese.edu.ec` | `9000000010` | Prorrector Demo | Activo | Si | Si |
| RBAC | `admin.demo@pucese.edu.ec` | `9000000001` | Administrador Demo | Activo | Si | Si |

La cuenta `admin.demo@pucese.edu.ec` se crea o actualiza al ejecutar el patch
RBAC. Los usuarios con cargo de director conservan su rol operativo derivado del
cargo, pero no reciben el rol `AdminSistema` por defecto.

## Recarga del seed en dev

Para limpiar y cargar los datos base en MariaDB:

```bash
bash scripts/seed-db.sh dev apply
bash scripts/seed-db.sh dev rbac
```

El paso `rbac` es importante despues de aplicar el seed, porque crea o actualiza
roles, permisos, mapeos cargo-rol y asignaciones derivadas necesarias para evitar
respuestas `403` en usuarios demo con cargos operativos.

## Usuario con procesos activos

Con la semilla actual, el usuario con procesos operativos activos es:

```text
persona.demo1@pucese.edu.ec
```

Procesos activos asociados:

- Investigacion Productiva por Carrera
- Investigacion Formativa Carreras
- Requerimiento Docente
