import axios from "@/core/services/httpClient";
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

  getUnitGraph(relationType = "org") {
    return this.httpClient.get(API_ROUTES.ADMIN_SQL_UNITS_GRAPH(relationType));
  }

  createUnitWithParent(payload) {
    return this.httpClient.post(API_ROUTES.ADMIN_SQL_UNITS_WITH_PARENT, payload);
  }

  getUnitDetail(unitId) {
    return this.httpClient.get(API_ROUTES.ADMIN_SQL_UNIT_DETAIL(unitId));
  }

  getProcessGraph() {
    return this.httpClient.get(API_ROUTES.ADMIN_SQL_PROCESSES_GRAPH);
  }

  getProcessDetail(processId) {
    return this.httpClient.get(API_ROUTES.ADMIN_SQL_PROCESS_DETAIL(processId));
  }

  createProcessWithParent(payload) {
    return this.httpClient.post(API_ROUTES.ADMIN_SQL_PROCESSES_WITH_PARENT, payload);
  }

  /* `extras` = { vigente_desde, origen, acto_id }: sólo hacen falta al mover una relación que ya rige. */
  setProcessParent(processId, parentId, extras = {}) {
    return this.httpClient.patch(API_ROUTES.ADMIN_SQL_PROCESS_PARENT(processId), { ...extras, parent_id: parentId });
  }

  /* Qué se cerraría al suprimir una `unidad`, un `puesto` o un `proceso`: para advertirlo antes. */
  getEfectosDeSuprimir(clase, id) {
    return this.httpClient.get(API_ROUTES.ADMIN_SQL_ESTRUCTURA_EFECTOS(clase, id));
  }

  /* CORREGIR algo de la estructura que ya rigió: { tabla, id?, cambios, motivo }. Pide un permiso
     propio (`correcciones_estructura.create`) y deja el antes y el después en su bitácora. */
  corregirEstructura(payload) {
    return this.httpClient.post(API_ROUTES.ADMIN_SQL_ESTRUCTURA_CORRECCIONES, payload);
  }

  /* payload = { parent_unit_id, relation_type_id, vigente_desde?, origen?, acto_id? } */
  setUnitParent(unitId, payload) {
    return this.httpClient.patch(API_ROUTES.ADMIN_SQL_UNIT_PARENT(unitId), payload);
  }

  getUnitProcesses(unitId) {
    return this.httpClient.get(API_ROUTES.ADMIN_SQL_UNIT_PROCESSES(unitId));
  }

  getUnitAttachableProcesses(unitId) {
    return this.httpClient.get(API_ROUTES.ADMIN_SQL_UNIT_ATTACHABLE_PROCESSES(unitId));
  }

  addUnitPosition(unitId, payload) {
    return this.httpClient.post(API_ROUTES.ADMIN_SQL_UNIT_POSITIONS(unitId), payload);
  }

  updateUnitPosition(positionId, payload) {
    return this.httpClient.put(API_ROUTES.ADMIN_SQL_UNIT_POSITION(positionId), payload);
  }

  removeUnitPosition(positionId) {
    return this.httpClient.delete(API_ROUTES.ADMIN_SQL_UNIT_POSITION(positionId));
  }

  assignUnitPosition(positionId, personId) {
    return this.httpClient.post(API_ROUTES.ADMIN_SQL_UNIT_POSITION_ASSIGN(positionId), { person_id: personId });
  }

  unassignUnitPosition(positionId) {
    return this.httpClient.post(API_ROUTES.ADMIN_SQL_UNIT_POSITION_UNASSIGN(positionId));
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

  setTemplateArtifactActive(artifactId, isActive) {
    return this.httpClient.patch(API_ROUTES.ADMIN_SQL_TEMPLATE_ARTIFACT_ACTIVE(artifactId), { is_active: isActive });
  }

  createTemplateArtifactVersion(artifactId, bumpLevel = "minor") {
    return this.httpClient.post(API_ROUTES.ADMIN_SQL_TEMPLATE_ARTIFACT_VERSION(artifactId), { bump_level: bumpLevel });
  }

  publishTemplateArtifact(artifactId) {
    return this.httpClient.patch(API_ROUTES.ADMIN_SQL_TEMPLATE_ARTIFACT_PUBLISH(artifactId));
  }

  retireTemplateArtifact(artifactId) {
    return this.httpClient.patch(API_ROUTES.ADMIN_SQL_TEMPLATE_ARTIFACT_RETIRE(artifactId));
  }

  getTemplateVersions(templateCode) {
    return this.httpClient.get(API_ROUTES.ADMIN_SQL_TEMPLATE_VERSIONS(templateCode));
  }

  getConfigActivationDiff(definitionId) {
    return this.httpClient.get(API_ROUTES.ADMIN_SQL_CONFIG_ACTIVATION_DIFF(definitionId));
  }

  useTemplateVersionInConfig(definitionId, templateArtifactId) {
    return this.httpClient.post(API_ROUTES.ADMIN_SQL_TEMPLATE_USE_IN_CONFIG(), {
      definition_id: definitionId,
      edicion_id: templateArtifactId
    });
  }

  startGuidedTemplateUpdate(definitionId, templateArtifactId, bumpLevel = "minor") {
    return this.httpClient.post(API_ROUTES.ADMIN_SQL_TEMPLATE_GUIDED_UPDATE_START(), {
      definition_id: definitionId,
      edicion_id: templateArtifactId,
      bump_level: bumpLevel
    });
  }

  finishGuidedTemplateUpdate(templateArtifactId, configDefinitionId) {
    return this.httpClient.post(API_ROUTES.ADMIN_SQL_TEMPLATE_GUIDED_UPDATE_FINISH(), {
      edicion_id: templateArtifactId,
      config_definition_id: configDefinitionId
    });
  }

  syncTemplateSeeds() {
    return this.httpClient.post(API_ROUTES.ADMIN_SQL_GENERADORES_SYNC);
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
