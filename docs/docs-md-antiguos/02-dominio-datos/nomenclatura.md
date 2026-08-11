> ⚠️ **ARCHIVADO — no es fuente de verdad.**
> Este documento describe el sistema tal como era antes de la reorganizacion de `docs/`.
> Puede citar MariaDB, MongoDB, EMQX/MQTT o rutas que ya no existen. Se conserva por su
> valor historico. Para el estado actual, ver el `README.md` de la raiz.

# Dominio y datos - Nomenclatura (tecnico)

## Convenciones

- PK: id
- FK: <entidad>_id
- Timestamps: created_at, updated_at
- Estado: status / is_active

## Entidades clave

- persons: datos base de usuarios
- users: usuarios/autenticacion (modelo en backend/models/users/)
- processes: procesos de negocio
- template_artifacts: artefactos publicados de plantillas
- documents: documentos generados

## Abreviaturas

- ER/MER: modelo entidad-relacion
- ACL: access control list
- HMR: hot module reload
