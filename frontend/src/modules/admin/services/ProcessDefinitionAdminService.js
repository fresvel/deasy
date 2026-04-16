import { adminSqlService } from "@/modules/admin/services/AdminSqlService";

export class ProcessDefinitionAdminService {
  constructor(sqlService = adminSqlService) {
    this.sqlService = sqlService;
  }

  createRuleForm() {
    return {
      unit_scope_type: "unit_exact",
      unit_id: "",
      unit_type_id: "",
      include_descendants: "0",
      cargo_id: "",
      position_id: "",
      recipient_policy: "all_matches",
      priority: "1",
      is_active: "1",
      effective_from: "",
      effective_to: ""
    };
  }

  createRuleLabels() {
    return {
      unit_id: "",
      unit_type_id: "",
      cargo_id: "",
      position_id: ""
    };
  }

  createTriggerForm() {
    return {
      trigger_mode: "automatic_by_term_type",
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
    return {
      template_artifact_id: "",
      usage_role: "primary",
      creates_task: "1",
      is_required: "1",
      sort_order: "1"
    };
  }

  createArtifactLabels() {
    return {
      template_artifact_id: ""
    };
  }

  applyRuleScopeChange(form, labels) {
    const scopeType = String(form.unit_scope_type || "");
    if (scopeType === "unit_type") {
      return {
        form: {
          ...form,
          unit_id: "",
          position_id: "",
          include_descendants: "0"
        },
        labels: {
          ...labels,
          unit_id: "",
          position_id: ""
        }
      };
    }
    if (scopeType === "all_units") {
      return {
        form: {
          ...form,
          unit_id: "",
          unit_type_id: "",
          position_id: "",
          include_descendants: "0"
        },
        labels: {
          ...labels,
          unit_id: "",
          unit_type_id: "",
          position_id: ""
        }
      };
    }
    return {
      form: {
        ...form,
        unit_type_id: ""
      },
      labels: {
        ...labels,
        unit_type_id: ""
      }
    };
  }

  buildRulePayload(definitionId, form) {
    return {
      process_definition_id: Number(definitionId),
      unit_scope_type: form.unit_scope_type || "unit_exact",
      unit_id: form.unit_id ? Number(form.unit_id) : null,
      unit_type_id: form.unit_type_id ? Number(form.unit_type_id) : null,
      include_descendants: Number(form.include_descendants) === 1 ? 1 : 0,
      cargo_id: form.cargo_id ? Number(form.cargo_id) : null,
      position_id: form.position_id ? Number(form.position_id) : null,
      recipient_policy: form.recipient_policy || "all_matches",
      priority: Number(form.priority || 1) || 1,
      is_active: Number(form.is_active) === 1 ? 1 : 0,
      effective_from: form.effective_from || null,
      effective_to: form.effective_to || null
    };
  }

  buildTriggerPayload(definitionId, form, requiresTermType) {
    return {
      process_definition_id: Number(definitionId),
      trigger_mode: form.trigger_mode || "automatic_by_term_type",
      term_type_id: requiresTermType && form.term_type_id
        ? Number(form.term_type_id)
        : null,
      is_active: Number(form.is_active) === 1 ? 1 : 0
    };
  }

  buildArtifactPayload(definitionId, form) {
    return {
      process_definition_id: Number(definitionId),
      template_artifact_id: Number(form.template_artifact_id),
      usage_role: form.usage_role || "primary",
      creates_task: Number(form.creates_task) === 1 ? 1 : 0,
      is_required: Number(form.is_required) === 1 ? 1 : 0,
      sort_order: Number(form.sort_order || 1) || 1
    };
  }

  listRules(processDefinitionId) {
    return this.sqlService.list("process_target_rules", {
      filter_process_definition_id: processDefinitionId,
      orderBy: "priority",
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

  hasActiveRules(processDefinitionId) {
    return this.sqlService.list("process_target_rules", {
      filter_process_definition_id: processDefinitionId,
      filter_is_active: 1,
      limit: 1
    });
  }

  listTriggers(processDefinitionId) {
    return this.sqlService.list("process_definition_triggers", {
      filter_process_definition_id: processDefinitionId,
      orderBy: "created_at",
      order: "desc",
      limit: 200
    });
  }

  saveTrigger(triggerId, payload) {
    if (triggerId) {
      return this.sqlService.update("process_definition_triggers", { id: Number(triggerId) }, payload);
    }

    return this.sqlService.create("process_definition_triggers", payload);
  }

  deleteTrigger(triggerId) {
    return this.sqlService.remove("process_definition_triggers", { id: Number(triggerId) });
  }

  hasActiveTriggers(processDefinitionId) {
    return this.sqlService.list("process_definition_triggers", {
      filter_process_definition_id: processDefinitionId,
      filter_is_active: 1,
      limit: 1
    });
  }

  listArtifacts(processDefinitionId) {
    return this.sqlService.list("process_definition_templates", {
      filter_process_definition_id: processDefinitionId,
      orderBy: "sort_order",
      order: "asc",
      limit: 200
    });
  }

  saveArtifact(artifactId, payload) {
    if (artifactId) {
      return this.sqlService.update("process_definition_templates", { id: Number(artifactId) }, payload);
    }

    return this.sqlService.create("process_definition_templates", payload);
  }

  deleteArtifact(artifactId) {
    return this.sqlService.remove("process_definition_templates", { id: Number(artifactId) });
  }

  hasArtifacts(processDefinitionId) {
    return this.sqlService.list("process_definition_templates", {
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
