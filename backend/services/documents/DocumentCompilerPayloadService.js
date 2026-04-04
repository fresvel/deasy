import { getMariaDBPool } from "../../config/mariadb.js";
import { documentRuntimeService } from "./DocumentRuntimeService.js";
import {
  buildCanonicalDocumentVersionBasePath,
  buildFinalDirectoryPrefix,
  buildRuntimePayloadObjectPath,
  buildWorkingDirectoryPrefix,
} from "./DocumentStoragePaths.js";

const getCompilationContextRow = async (connection, documentVersionId) => {
  const [rows] = await connection.query(
    `SELECT
       dv.id AS document_version_id,
       dv.document_id,
       dv.version AS document_version,
       dv.status AS document_version_status,
       dv.payload_object_path,
       dv.working_file_path,
       dv.final_file_path,
       dv.format,
       dv.render_engine,
       d.task_item_id,
       t.id AS task_id,
       t.process_run_id,
       t.term_id,
       pdv.process_id,
       trm.term_type_id,
       trm.start_date AS term_start_date,
       YEAR(trm.start_date) AS term_year,
       COALESCE(task_pos.unit_id, responsible_pos.unit_id, owner_pos.unit_id) AS scope_unit_id,
       (
         SELECT COUNT(*)
         FROM document_versions dv_seq
         WHERE dv_seq.document_id = d.id
           AND dv_seq.id <= dv.id
       ) AS document_version_sequence
     FROM document_versions dv
     INNER JOIN documents d ON d.id = dv.document_id
     LEFT JOIN task_items ti ON ti.id = d.task_item_id
     LEFT JOIN tasks t ON t.id = ti.task_id
     LEFT JOIN process_definition_versions pdv ON pdv.id = t.process_definition_id
     LEFT JOIN terms trm ON trm.id = t.term_id
     LEFT JOIN unit_positions task_pos ON task_pos.id = t.responsible_position_id
     LEFT JOIN unit_positions responsible_pos ON responsible_pos.id = ti.responsible_position_id
     LEFT JOIN persons owner_person ON owner_person.id = d.owner_person_id
     LEFT JOIN position_assignments owner_pa
       ON owner_pa.person_id = owner_person.id
      AND owner_pa.is_current = 1
     LEFT JOIN unit_positions owner_pos ON owner_pos.id = owner_pa.position_id
     WHERE dv.id = ?
     LIMIT 1`,
    [documentVersionId]
  );

  return rows?.[0] || null;
};

const normalizeCompilationTarget = (runtimeInput, compilationContext) => ({
  renderEngine:
    String(runtimeInput?.artifact?.renderEngine || compilationContext?.render_engine || "")
      .trim() || "jinja2",
  outputFormat:
    String(runtimeInput?.artifact?.format || compilationContext?.format || "")
      .trim() || "pdf",
});

const buildStorageDescriptor = (compilationContext, target) => {
  if (
    !compilationContext?.scope_unit_id ||
    !compilationContext?.process_id ||
    !compilationContext?.term_id ||
    !compilationContext?.term_type_id ||
    !compilationContext?.task_id ||
    !compilationContext?.document_id
  ) {
    throw new Error(
      "No se pudo determinar la ruta documental canónica de la document_version para compilación."
    );
  }

  const canonicalBasePath = buildCanonicalDocumentVersionBasePath(compilationContext);
  return {
    canonicalBasePath,
    payloadObjectPath:
      String(compilationContext.payload_object_path || "").trim() ||
      buildRuntimePayloadObjectPath({ basePath: canonicalBasePath }),
    workingFilePath: String(compilationContext.working_file_path || "").trim() || null,
    finalFilePath: String(compilationContext.final_file_path || "").trim() || null,
    workingPrefix: buildWorkingDirectoryPrefix({
      basePath: canonicalBasePath,
      extension: target.outputFormat,
    }),
    finalPrefix: buildFinalDirectoryPrefix({ basePath: canonicalBasePath }),
  };
};

export class DocumentCompilerPayloadService {
  constructor({
    pool = getMariaDBPool(),
    runtimeService = documentRuntimeService,
  } = {}) {
    this.pool = pool;
    this.runtimeService = runtimeService;
  }

  async buildPayload(documentVersionId, externalConnection = null) {
    const connection = externalConnection || await this.pool.getConnection();
    const shouldRelease = !externalConnection;

    try {
      const runtimeInput = await this.runtimeService.buildDocumentCompilationInput(
        documentVersionId,
        connection
      );
      const compilationContext = await getCompilationContextRow(connection, documentVersionId);

      if (!compilationContext) {
        throw new Error(`No existe contexto documental para la document_version ${documentVersionId}.`);
      }

      const target = normalizeCompilationTarget(runtimeInput, compilationContext);
      const storage = buildStorageDescriptor(compilationContext, target);

      return {
        documentVersion: {
          id: Number(compilationContext.document_version_id),
          documentId: Number(compilationContext.document_id),
          version: Number(compilationContext.document_version),
          status: compilationContext.document_version_status,
          format: target.outputFormat,
          renderEngine: target.renderEngine,
        },
        artifact: runtimeInput.artifact,
        sources: runtimeInput.sources,
        renderSource: runtimeInput.renderSource,
        payload: {
          schema: runtimeInput.schema,
          meta: runtimeInput.meta,
          baseData: runtimeInput.baseData,
          runtimePayload: runtimeInput.runtimePayload,
          mergedPayload: runtimeInput.mergedPayload,
        },
        storage,
        target,
        context: {
          processRunId: compilationContext.process_run_id
            ? Number(compilationContext.process_run_id)
            : null,
          taskItemId: compilationContext.task_item_id
            ? Number(compilationContext.task_item_id)
            : null,
          taskId: compilationContext.task_id ? Number(compilationContext.task_id) : null,
        },
      };
    } finally {
      if (shouldRelease) {
        connection.release();
      }
    }
  }
}

export const documentCompilerPayloadService = new DocumentCompilerPayloadService();
