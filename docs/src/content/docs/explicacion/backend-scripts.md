---
title: "Los scripts del backend"
description: "Qué hace cada script operativo y cuál resetea la base sin avisar."
sidebar:
  order: 8
---
| **Fichero**                      | **L.** | **Para que**                                                                                                                                                                                                                                                    |
|:---------------------------------|:-------|:----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `reset.mjs`                      | 114    | CLI de reset con **objetivos positivos y explícitos**: `node scripts/reset.mjs <db|storage> [--yes]`. Sin argumentos imprime el uso y sale **sin tocar nada**. Antes eran tres ficheros con borrado por defecto y opt-out (`--keep-db`); se invirtio la lógica. |
| `lib/reset_targets.mjs`          | 155    | Libreria: `resetPostgres()`, `resetMinio()` (vacia los 7 buckets) y `describeContents()` (inventario previo al borrado).                                                                                                                                        |
| `bootstrap_admin_recovery.mjs`   | 46     | Recupera o recrea el administrador. `npm run recover:admin`.                                                                                                                                                                                                    |
| `check_missing_imports.mjs`      | 124    | **Detector de “simbolo movido pero no importado”**. Ver el aviso de abajo.                                                                                                                                                                                      |
| `seed_dev_rich.mjs`              | 284    | Fixture rica de desarrollo: crea un segundo proceso en modo `single` y lo lanza, porque con el proceso único del bootstrap la pantalla `/home` no se puede verificar.                                                                                           |
| `generate_demo_certificates.mjs` | 220    | Genera certificados PKCS#12 autofirmados con openssl y los sube a `deasy-certificates`, porque la interfaz solo permite *subir* un `.p12`.                                                                                                                      |

:::caution[npm run check:imports es obligatorio tras mover código]

`node --check` válida **sintaxis, no imports**. Un simbolo movido sin su `import` es sintaxis perfectamente válida, el modulo **carga sin quejarse**, y revienta en tiempo de **llamada**. Así estuvieron rotos tres semanas cuatro `ReferenceError` en producción (`createUnitWithParent`, `getCargoCodeMap`, `getNextStorageVersionForTemplateCode`, `loadTemplateArtifactMetaDocument` — esta última ya retirada con el `meta.yaml`, pero sigue nombrada en el script como caso de prueba histórico).

Comprobar que el backend arranca **no sustituye** a ejecutar este script. Esta en CI.

:::

:::note[No hay migraciones incrementales]

No existe nada tipo Flyway o Knex. El esquema se aplica **entero** en cada arranque desde `backend/database/postgres_schema.sql`, apoyandose en que es idempotente (`CREATE TABLE IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, siembras con `ON CONFLICT`).

:::
