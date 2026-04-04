import fs from "fs";

import { getMariaDBPool } from "../../config/mariadb.js";
import {
  ensureBucketExists,
  uploadFileToMinio,
} from "../storage/minio_service.js";
import { documentCompilationPipelineService } from "./DocumentCompilationPipelineService.js";
import {
  MINIO_DOCUMENTS_BUCKET,
  MINIO_DOCUMENTS_PREFIX,
  buildCompiledWorkingPdfPath,
} from "./DocumentStoragePaths.js";

const resolveCompiledPdfCandidate = async (artifacts) => {
  for (const candidate of [artifacts?.reportPdfPath, artifacts?.mainPdfPath]) {
    if (!candidate) {
      continue;
    }
    try {
      await fs.promises.access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }
  throw new Error("No se encontró un PDF compilado en el workspace local.");
};

export class DocumentCompilationPersistenceService {
  constructor({
    pool = getMariaDBPool(),
    pipelineService = documentCompilationPipelineService,
  } = {}) {
    this.pool = pool;
    this.pipelineService = pipelineService;
  }

  async persistDocumentVersion(documentVersionId, { preserveWorkspace = true } = {}) {
    const pipelineResult = await this.pipelineService.compileDocumentVersion(documentVersionId, {
      preserveWorkspace,
    });

    const localPdfPath = await resolveCompiledPdfCandidate(pipelineResult.artifacts);
    const storageBasePath = pipelineResult.payload?.storage?.canonicalBasePath;
    if (!storageBasePath) {
      throw new Error("No se pudo resolver canonicalBasePath para persistir el PDF compilado.");
    }

    const workingFilePath = buildCompiledWorkingPdfPath({
      basePath: storageBasePath,
      documentVersionId,
    });
    const objectName = `${MINIO_DOCUMENTS_PREFIX}/${workingFilePath}`;

    await ensureBucketExists(MINIO_DOCUMENTS_BUCKET);
    await uploadFileToMinio(MINIO_DOCUMENTS_BUCKET, objectName, localPdfPath, {
      "Content-Type": "application/pdf",
      "Document-Version-Id": String(documentVersionId),
    });

    const connection = await this.pool.getConnection();
    try {
      await connection.query(
        `UPDATE document_versions
         SET working_file_path = ?,
             format = ?,
             render_engine = ?
         WHERE id = ?`,
        [
          workingFilePath,
          pipelineResult.payload?.target?.outputFormat || "pdf",
          pipelineResult.payload?.target?.renderEngine || "jinja2",
          Number(documentVersionId),
        ]
      );
    } finally {
      connection.release();
    }

    return {
      ok: true,
      documentVersionId: Number(documentVersionId),
      workingFilePath,
      bucket: MINIO_DOCUMENTS_BUCKET,
      objectName,
      localPdfPath,
      pipelineResult,
    };
  }
}

export const documentCompilationPersistenceService = new DocumentCompilationPersistenceService();
