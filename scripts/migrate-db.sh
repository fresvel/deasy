#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=./_backend_db_exec.sh
. "$ROOT_DIR/scripts/_backend_db_exec.sh"

usage() {
  cat <<'EOF'
Uso:
  bash scripts/migrate-db.sh <dev|qa|prod> <migracion>
  bash scripts/migrate-db.sh <dev|qa|prod> --list

Ejemplos:
  bash scripts/migrate-db.sh dev --list
  bash scripts/migrate-db.sh qa process-definition-series
  bash scripts/migrate-db.sh qa drop-legacy-tables

Notas:
  - prod exige DEASY_PROD_DB_APPROVAL_FILE apuntando a un archivo dentro del repo e ignorado por git.
EOF
}

list_migrations() {
  cat <<'EOF'
Migraciones disponibles:
  backfill-unit-labels                     -> /app/backend/scripts/backfill_unit_labels.mjs
  drop-legacy-tables                      -> /app/backend/scripts/drop_legacy_tables.mjs
  enforce-process-definition-active-series -> /app/backend/scripts/enforce_process_definition_active_series.mjs
  enforce-process-definition-document-artifacts -> /app/backend/scripts/enforce_process_definition_document_artifacts.mjs
  migrate-process-definition-series       -> /app/backend/scripts/migrate_process_definition_series.mjs
  migrate-process-templates               -> /app/backend/scripts/migrate_process_templates.mjs
  migrate-template-artifact-origin        -> /app/backend/scripts/migrate_template_artifact_origin.mjs
  migrate-template-artifact-owner-fk      -> /app/backend/scripts/migrate_template_artifact_owner_fk.mjs
  migrate-template-artifact-stage-enum    -> /app/backend/scripts/migrate_template_artifact_stage_enum.mjs
  migrate-template-artifacts-to-json      -> /app/backend/scripts/migrate_template_artifacts_to_json.mjs
  migrate-template-prefixes-to-system-users -> /app/backend/scripts/migrate_template_prefixes_to_system_users.mjs
  migrate-template-seed-drafts            -> /app/backend/scripts/migrate_template_seed_drafts.mjs
EOF
}

resolve_script_path() {
  case "$1" in
    backfill-unit-labels)
      echo "/app/backend/scripts/backfill_unit_labels.mjs"
      ;;
    drop-legacy-tables)
      echo "/app/backend/scripts/drop_legacy_tables.mjs"
      ;;
    enforce-process-definition-active-series)
      echo "/app/backend/scripts/enforce_process_definition_active_series.mjs"
      ;;
    enforce-process-definition-document-artifacts)
      echo "/app/backend/scripts/enforce_process_definition_document_artifacts.mjs"
      ;;
    migrate-process-definition-series|process-definition-series)
      echo "/app/backend/scripts/migrate_process_definition_series.mjs"
      ;;
    migrate-process-templates|process-templates)
      echo "/app/backend/scripts/migrate_process_templates.mjs"
      ;;
    migrate-template-artifact-origin|template-artifact-origin)
      echo "/app/backend/scripts/migrate_template_artifact_origin.mjs"
      ;;
    migrate-template-artifact-owner-fk|template-artifact-owner-fk)
      echo "/app/backend/scripts/migrate_template_artifact_owner_fk.mjs"
      ;;
    migrate-template-artifact-stage-enum|template-artifact-stage-enum)
      echo "/app/backend/scripts/migrate_template_artifact_stage_enum.mjs"
      ;;
    migrate-template-artifacts-to-json|template-artifacts-to-json)
      echo "/app/backend/scripts/migrate_template_artifacts_to_json.mjs"
      ;;
    migrate-template-prefixes-to-system-users|template-prefixes-to-system-users)
      echo "/app/backend/scripts/migrate_template_prefixes_to_system_users.mjs"
      ;;
    migrate-template-seed-drafts|template-seed-drafts)
      echo "/app/backend/scripts/migrate_template_seed_drafts.mjs"
      ;;
    *)
      return 1
      ;;
  esac
}

if [ "$#" -ne 2 ]; then
  usage
  exit 1
fi

ENVIRONMENT="$1"
MIGRATION_NAME="$2"

if [ "$MIGRATION_NAME" = "--list" ]; then
  list_migrations
  exit 0
fi

SCRIPT_PATH="$(resolve_script_path "$MIGRATION_NAME")" || {
  echo "Migracion no soportada: $MIGRATION_NAME"
  echo
  list_migrations
  exit 1
}

ensure_environment "$ENVIRONMENT"
ensure_docker_ready
ensure_backend_running "$ENVIRONMENT"

run_in_backend "$ENVIRONMENT" node "$SCRIPT_PATH"
