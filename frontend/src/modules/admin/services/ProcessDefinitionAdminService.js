import { adminSqlService } from "@/modules/admin/services/AdminSqlService";

export class ProcessDefinitionAdminService {
  constructor(sqlService = adminSqlService) {
    this.sqlService = sqlService;
  }

  // UN CAMPO, Y ERAN SIETE. `unit_scope_type`, `unit_id`, `unit_type_id` y `cargo_id` eran copia
  // de la línea y salieron de la regla con `P10` (frente 25, 2026-10-14); `priority` se fue con
  // ellas porque sólo aparecía en un `ORDER BY`; y `position_id` con `P25`. El alcance se edita en
  // la obligación, y la regla sólo dice a quién, dentro de ella, le toca.
  createRuleForm() {
    return {
      recipient_policy: "all_matches"
    };
  }

  // Sin ningún campo de clave ajena no hay rótulo que recordar — se conserva la forma porque el
  // gestor la llama igual que las de disparadores y entregables.
  createRuleLabels() {
    return {};
  }

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

  // AQUI VIVIERON DOS LIMPIADORES, y los dos se fueron con lo que limpiaban: `applyRuleScopeChange`
  // (54 lineas) con el alcance en `P10`, y `applyRuleRecipientPolicyChange` con el puesto exacto en
  // `P25`. Cambiar de politica ya no puede dejar un campo huerfano: no hay mas campos.

  buildRulePayload(definitionId, form) {
    return {
      process_definition_id: Number(definitionId),
      recipient_policy: form.recipient_policy || "all_matches"
    };
  }

  buildTriggerPayload(definitionId, form) {
    return {
      process_definition_id: Number(definitionId),
      term_type_id: form.term_type_id ? Number(form.term_type_id) : null,
      is_active: Number(form.is_active) === 1 ? 1 : 0
    };
  }

  buildArtifactPayload(definitionId, form) {
    const payload = {
      process_definition_id: Number(definitionId),
      edicion_id: Number(form.edicion_id)
    };
    // El orden se asigna automáticamente al crear; en edición se conserva el existente si llega en el form.
    const sortOrder = Number(form.sort_order);
    if (Number.isFinite(sortOrder) && sortOrder > 0) {
      payload.sort_order = sortOrder;
    }
    // Modo de emisión del entregable (single/replicated/routed); default lo pone el backend.
    if (form.item_mode && ["single", "replicated", "routed"].includes(String(form.item_mode))) {
      payload.item_mode = String(form.item_mode);
    }
    return payload;
  }

  listRules(processDefinitionId) {
    return this.sqlService.list("process_target_rules", {
      filter_process_definition_id: processDefinitionId,
      // Ordenaba por `priority`, y esa columna se fue con `P10`: no desempataba nada, porque las
      // reglas de una configuracion se UNEN. Por `id` la lista queda estable.
      orderBy: "id",
      order: "asc",
      limit: 200
    });
  }

  saveRule(ruleId, payload) {
    if (ruleId) {
      return this.sqlService.update("process_target_rules", { id: Number(ruleId) }, payload);
    }

    return this.sqlService.create("process_target_rules", payload);
  }

  deleteRule(ruleId) {
    return this.sqlService.remove("process_target_rules", { id: Number(ruleId) });
  }

  // SIN `filter_is_active`: una regla ya no se apaga (frente 25, P18-d). Tener regla es tenerla.
  hasActiveRules(processDefinitionId) {
    return this.sqlService.list("process_target_rules", {
      filter_process_definition_id: processDefinitionId,
      limit: 1
    });
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
        rules: false,
        triggers: false,
        artifacts: false
      };
    }

    const [rulesResponse, triggersResponse, artifactsResponse] = await Promise.all([
      this.hasActiveRules(processDefinitionId),
      this.hasActiveTriggers(processDefinitionId),
      this.hasArtifacts(processDefinitionId)
    ]);

    return {
      rules: Array.isArray(rulesResponse.data) && rulesResponse.data.length > 0,
      triggers: Array.isArray(triggersResponse.data) && triggersResponse.data.length > 0,
      artifacts: Array.isArray(artifactsResponse.data) && artifactsResponse.data.length > 0
    };
  }
}

export const processDefinitionAdminService = new ProcessDefinitionAdminService();
