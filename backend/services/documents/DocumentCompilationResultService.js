import { getMariaDBPool } from "../../config/mariadb.js";
import { ensureFillFlowForDocumentVersion } from "../admin/TaskGenerationService.js";

export class DocumentCompilationResultService {
  constructor({
    pool = getMariaDBPool(),
  } = {}) {
    this.pool = pool;
  }

  async applySuccessfulCompilation({
    documentVersionId,
    compilerResponse,
  }) {
    const workingFilePath = String(
      compilerResponse?.artifacts?.working_file_path ||
      compilerResponse?.artifacts?.workingFilePath ||
      ""
    ).trim();

    if (!workingFilePath) {
      throw new Error("La respuesta del compilador no incluye working_file_path para aplicar la transición.");
    }

    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();

      await connection.query(
        `UPDATE document_versions
         SET working_file_path = ?
         WHERE id = ?`,
        [workingFilePath, Number(documentVersionId)]
      );

      const flowResult = await ensureFillFlowForDocumentVersion(connection, Number(documentVersionId));

      await connection.commit();

      return {
        ok: true,
        documentVersionId: Number(documentVersionId),
        workingFilePath,
        flowResult: flowResult ?? null,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

export const documentCompilationResultService = new DocumentCompilationResultService();
