import axios from "axios";
import { API_ROUTES } from "@/core/config/apiConfig";

export class AdminSqlService {
  constructor(httpClient = axios) {
    this.httpClient = httpClient;
  }

  list(table, params = {}) {
    return this.httpClient.get(API_ROUTES.ADMIN_SQL_TABLE(table), { params });
  }

  getOperationStats() {
    return this.httpClient.get(API_ROUTES.ADMIN_SQL_OPERATION_STATS);
  }

  create(table, payload, config = {}) {
    return this.httpClient.post(API_ROUTES.ADMIN_SQL_TABLE(table), payload, config);
  }

  update(table, keys, data, config = {}) {
    return this.httpClient.put(
      API_ROUTES.ADMIN_SQL_TABLE(table),
      { keys, data },
      config
    );
  }

  remove(table, keys, config = {}) {
    return this.httpClient.delete(API_ROUTES.ADMIN_SQL_TABLE(table), {
      data: { keys },
      ...config
    });
  }

  getTemplateArtifactSchema(artifactId) {
    return this.httpClient.get(API_ROUTES.ADMIN_SQL_TEMPLATE_ARTIFACT_SCHEMA(artifactId));
  }

  updateTemplateArtifactStage(artifactId, stage) {
    return this.httpClient.patch(API_ROUTES.ADMIN_SQL_TEMPLATE_ARTIFACT_STAGE(artifactId), { stage });
  }

  createTemplateArtifactVersion(artifactId) {
    return this.httpClient.post(API_ROUTES.ADMIN_SQL_TEMPLATE_ARTIFACT_VERSION(artifactId));
  }

  syncTemplateSeeds() {
    return this.httpClient.post(API_ROUTES.ADMIN_SQL_TEMPLATE_SEEDS_SYNC);
  }

  saveDraftTemplateArtifact(formData, artifactId = "", config = {}) {
    if (artifactId) {
      return this.httpClient.put(
        API_ROUTES.ADMIN_SQL_TEMPLATE_ARTIFACT_DRAFT_UPDATE(artifactId),
        formData,
        config
      );
    }

    return this.httpClient.post(API_ROUTES.ADMIN_SQL_TEMPLATE_ARTIFACT_DRAFT, formData, config);
  }

  generateTermTasks(termId) {
    return this.httpClient.post(API_ROUTES.ADMIN_GENERATE_TERM_TASKS(termId));
  }

  getTermLaunchStatus(termId) {
    return this.httpClient.get(API_ROUTES.ADMIN_TERM_LAUNCH_STATUS(termId));
  }

  launchProcessDefinition(definitionId, payload = {}) {
    return this.httpClient.post(API_ROUTES.ADMIN_LAUNCH_PROCESS_DEFINITION(definitionId), payload);
  }

  getProcessDefinitionLaunchInfo(definitionId) {
    return this.httpClient.get(API_ROUTES.ADMIN_PROCESS_DEFINITION_LAUNCH_INFO(definitionId));
  }
}

export const adminSqlService = new AdminSqlService();
