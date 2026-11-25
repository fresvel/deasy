import { adminSqlService } from "@/modules/admin/services/AdminSqlService";

export class ProcessDefinitionAdminService {
  constructor(sqlService = adminSqlService) {
    this.sqlService = sqlService;
  }

  // AQUI VIVIA EL FORMULARIO DE LA REGLA DE REPARTO, y su historia es la de la tabla: siete campos,
  // dos tras `P10`, uno tras `P25`, ninguno tras `P26` — `process_target_rules` se retiro entera y
  // el «quien» es la LINEA. Lo que queda de aquella pantalla es un campo mas en `lineas`.

  createTriggerForm() {
    return {
      term_type_id: "",
      is_active: "1"
    };
  }

  createTriggerLabels() {
    return {
      term_type_id: ""
    };
  }

  createArtifactForm() {
    // creates_task ya no se expone (toda plantilla materializa un entregable) y el orden lo asigna el backend.
    return {
      edicion_id: "",
      sort_order: ""
    };
  }

  createArtifactLabels() {
    return {
      edicion_id: ""
    };
  }

  listTriggers(processDefinitionId) {
    return this.sqlService.list("process_definition_period_types", {
      filter_process_definition_id: processDefinitionId,
      orderBy: "created_at",
      order: "desc",
      limit: 200
    });
  }

  saveTrigger(triggerId, payload) {
    if (triggerId) {
      return this.sqlService.update("process_definition_period_types", { id: Number(triggerId) }, payload);
    }

    return this.sqlService.create("process_definition_period_types", payload);
  }

  deleteTrigger(triggerId) {
    return this.sqlService.remove("process_definition_period_types", { id: Number(triggerId) });
  }

  hasActiveTriggers(processDefinitionId) {
    return this.sqlService.list("process_definition_period_types", {
      filter_process_definition_id: processDefinitionId,
      filter_is_active: 1,
      limit: 1
    });
  }

  listArtifacts(processDefinitionId) {
    return this.sqlService.list("vinculos", {
      filter_process_definition_id: processDefinitionId,
      orderBy: "sort_order",
      order: "asc",
      limit: 200
    });
  }

  saveArtifact(artifactId, payload) {
    if (artifactId) {
      return this.sqlService.update("vinculos", { id: Number(artifactId) }, payload);
    }

    return this.sqlService.create("vinculos", payload);
  }

  deleteArtifact(artifactId) {
    return this.sqlService.remove("vinculos", { id: Number(artifactId) });
  }

  hasArtifacts(processDefinitionId) {
    return this.sqlService.list("vinculos", {
      filter_process_definition_id: processDefinitionId,
      limit: 1
    });
  }

  async evaluateChecklist(processDefinitionId) {
    if (!processDefinitionId) {
      return {
        triggers: false,
        artifacts: false
      };
    }

    // DOS COMPROBACIONES, Y ERAN TRES (frente 25, P26): la de las reglas contaba filas de una tabla
    // retirada, y lo que contaba no era si alguien recibia el trabajo sino si alguien habia pulsado
    // «Agregar regla».
    const [triggersResponse, artifactsResponse] = await Promise.all([
      this.hasActiveTriggers(processDefinitionId),
      this.hasArtifacts(processDefinitionId)
    ]);

    return {
      triggers: Array.isArray(triggersResponse.data) && triggersResponse.data.length > 0,
      artifacts: Array.isArray(artifactsResponse.data) && artifactsResponse.data.length > 0
    };
  }
}

export const processDefinitionAdminService = new ProcessDefinitionAdminService();
