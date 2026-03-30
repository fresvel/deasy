import axios from "axios";
import { API_ROUTES } from "@/services/apiConfig";

export class AdminSqlService {
  constructor(httpClient = axios) {
    this.httpClient = httpClient;
  }

  list(table, params = {}) {
    return this.httpClient.get(API_ROUTES.ADMIN_SQL_TABLE(table), { params });
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

  syncTemplateArtifacts() {
    return this.httpClient.post(API_ROUTES.ADMIN_SQL_TEMPLATE_ARTIFACTS_SYNC);
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
}

export const adminSqlService = new AdminSqlService();
