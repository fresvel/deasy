// WorkflowSyncService — sincronizacion de los flujos (fill/firma) de los template artifacts con sus
// plantillas de proceso, y estado/reconciliacion. Extraido de SqlAdminService.js (God #1) por Extract
// Class (cut #5). Depende de this.pool + 4 colaboradores inyectados (getCargoCodeMap, getUnitTypeNameMap,
// getTemplateArtifact, loadTemplateArtifactMetaDocument); los helpers puros de normalizacion/descripcion se
// importan de los modulos hermanos. SqlAdminService mantiene delegadores; el controller, los servicios
// que inyectan syncArtifactWorkflows (cuts #3/#4) y create()/update() no se tocan.
import {
  ARTIFACT_SYNC_FILL_DESCRIPTION_PREFIX,
  ARTIFACT_SYNC_SIGNATURE_DESCRIPTION_PREFIX,
  buildArtifactSyncedFillDescription,
  buildArtifactSyncedSignatureDescription,
  parseArtifactSyncMarker,
  isArtifactFillWorkflowSyncEnabled,
  isArtifactSignatureWorkflowSyncEnabled,
} from "./artifacts.js";
import {
  normalizeFillSteps,
  normalizeSignatureSteps,
  collectSignatureWorkflowNormalizationIssues,
} from "./workflows.js";

export default class WorkflowSyncService {
  constructor(pool, { getCargoCodeMap, getUnitTypeNameMap, getTemplateArtifact, loadTemplateArtifactMetaDocument } = {}) {
    this.pool = pool;
    this._getCargoCodeMap = getCargoCodeMap;
    this._getUnitTypeNameMap = getUnitTypeNameMap;
    this._getTemplateArtifact = getTemplateArtifact;
    this._loadTemplateArtifactMetaDocument = loadTemplateArtifactMetaDocument;
  }

  ensurePool() {
    if (!this.pool) {
      throw new Error("La conexion con PostgreSQL no esta disponible.");
    }
  }


  async syncArtifactWorkflowsForTemplateArtifactId(artifactId, connection = this.pool) {
    const artifact = await this._getTemplateArtifact(artifactId, connection);
    if (!artifact?.id) {
      return null;
    }

    const metaDocument = await this._loadTemplateArtifactMetaDocument(artifact, connection);
    const fillSyncSummary = await this.syncArtifactFillWorkflowForArtifact({
      connection,
      artifactId: Number(artifact.id),
      templateCode: artifact.template_code,
      storageVersion: artifact.storage_version,
      displayName: artifact.display_name,
      metaDocument
    });

    const signatureSyncSummary = await this.syncArtifactSignatureWorkflowForArtifact({
      connection,
      artifactId: Number(artifact.id),
      templateCode: artifact.template_code,
      storageVersion: artifact.storage_version,
      displayName: artifact.display_name,
      metaDocument
    });

    return {
      fill: fillSyncSummary,
      signatures: signatureSyncSummary
    };
  }


  async getProcessDefinitionTemplatesByArtifact(artifactId, connection = this.pool) {
    const [rows] = await connection.query(
      `SELECT
         pdt.id,
         pdt.process_definition_id,
         pdt.template_artifact_id,
         pdv.name AS process_definition_name
       FROM process_definition_templates pdt
       INNER JOIN process_definition_versions pdv ON pdv.id = pdt.process_definition_id
       WHERE pdt.template_artifact_id = ?
       ORDER BY pdt.id ASC`,
      [artifactId]
    );
    return rows;
  }


  async getSyncedFillFlowTemplate(processDefinitionTemplateId, connection = this.pool) {
    const [rows] = await connection.query(
      `SELECT id, description, is_active
       FROM fill_flow_templates
       WHERE process_definition_template_id = ?
         AND description LIKE ?
       ORDER BY id DESC
       LIMIT 1`,
      [processDefinitionTemplateId, `${ARTIFACT_SYNC_FILL_DESCRIPTION_PREFIX}%`]
    );
    return rows?.[0] || null;
  }


  async getSyncedSignatureFlowTemplate(processDefinitionTemplateId, connection = this.pool) {
    const [rows] = await connection.query(
      `SELECT id, description, is_active
       FROM signature_flow_templates
       WHERE process_definition_template_id = ?
         AND description LIKE ?
       ORDER BY id DESC
       LIMIT 1`,
      [processDefinitionTemplateId, `${ARTIFACT_SYNC_SIGNATURE_DESCRIPTION_PREFIX}%`]
    );
    return rows?.[0] || null;
  }


  // Estado de sincronización del flujo de un artifact: compara el storage_version materializado en BD
  // (marca de procedencia) contra el actual del artifact, por cada vínculo a configuración. Devuelve
  // 'no_link' | 'synced' | 'stale' a nivel global y el detalle por vínculo.
  async getArtifactWorkflowSyncStatus(artifactId, connection = this.pool) {
    this.ensurePool();
    const artifact = await this._getTemplateArtifact(artifactId, connection);
    if (!artifact?.id) {
      return { artifact_id: Number(artifactId) || null, exists: false, status: "unknown", links: [] };
    }
    const currentVersion = String(artifact.storage_version || "");
    let metaDocument = null;
    try {
      metaDocument = await this._loadTemplateArtifactMetaDocument(artifact, connection);
    } catch {
      metaDocument = null;
    }
    const fillEnabled = isArtifactFillWorkflowSyncEnabled(metaDocument?.workflows?.fill || {});
    const signatureEnabled = isArtifactSignatureWorkflowSyncEnabled(metaDocument?.workflows?.signatures || {});
    const links = await this.getProcessDefinitionTemplatesByArtifact(artifactId, connection);

    // Estado por lado (fill/firmas): 'ok' | 'stale' | 'missing'.
    const sideStatus = (synced, enabled, prefix) => {
      if (!enabled) {
        // No debe materializarse; si quedó activo, está desfasado (pendiente de desactivar).
        return synced?.id && Number(synced.is_active) === 1 ? "stale" : "ok";
      }
      if (!synced?.id || Number(synced.is_active) !== 1) {
        return "missing";
      }
      const marker = parseArtifactSyncMarker(synced.description, prefix);
      return marker && String(marker.storageVersion) === currentVersion ? "ok" : "stale";
    };

    const severity = { missing: 3, stale: 2, ok: 1 };
    const links_status = [];
    for (const link of links) {
      const fill = await this.getSyncedFillFlowTemplate(link.id, connection);
      const signature = await this.getSyncedSignatureFlowTemplate(link.id, connection);
      const fillState = sideStatus(fill, fillEnabled, ARTIFACT_SYNC_FILL_DESCRIPTION_PREFIX);
      const signatureState = sideStatus(signature, signatureEnabled, ARTIFACT_SYNC_SIGNATURE_DESCRIPTION_PREFIX);
      const worst = [fillState, signatureState].sort((a, b) => severity[b] - severity[a])[0];
      links_status.push({
        process_definition_template_id: link.id,
        process_definition_id: link.process_definition_id,
        process_definition_name: link.process_definition_name,
        fill: fillState,
        signatures: signatureState,
        status: worst === "ok" ? "synced" : worst
      });
    }

    const anyStale = links_status.some((entry) => entry.status !== "synced");
    return {
      artifact_id: Number(artifact.id),
      exists: true,
      storage_version: currentVersion,
      has_workflow: fillEnabled || signatureEnabled,
      fill_enabled: fillEnabled,
      signature_enabled: signatureEnabled,
      status: !links.length ? "no_link" : (anyStale ? "stale" : "synced"),
      links: links_status
    };
  }


  // Job de reconciliación: re-sincroniza los artifacts vinculados cuya proyección en BD está desfasada
  // (o todos si onlyStale=false). Best-effort por artifact: un fallo no aborta el resto. Sirve como
  // auto-reparación al arranque y como acción admin a demanda (cierra la ventana de escritura dual).
  async reconcileArtifactWorkflows({ onlyStale = true } = {}) {
    this.ensurePool();
    const [rows] = await this.pool.query(
      `SELECT DISTINCT template_artifact_id AS id
       FROM process_definition_templates
       WHERE template_artifact_id IS NOT NULL`
    );
    const summary = { scanned: 0, stale: 0, resynced: 0, failed: 0, details: [] };
    for (const row of rows || []) {
      const artifactId = Number(row.id);
      if (!artifactId) {
        continue;
      }
      summary.scanned += 1;
      try {
        const before = await this.getArtifactWorkflowSyncStatus(artifactId);
        if (onlyStale && before.status !== "stale") {
          continue;
        }
        if (before.status === "stale") {
          summary.stale += 1;
        }
        await this.syncArtifactWorkflowsForTemplateArtifactId(artifactId);
        const after = await this.getArtifactWorkflowSyncStatus(artifactId);
        summary.resynced += 1;
        summary.details.push({ artifact_id: artifactId, before: before.status, after: after.status });
      } catch (error) {
        summary.failed += 1;
        summary.details.push({ artifact_id: artifactId, error: error?.message || "error" });
      }
    }
    return summary;
  }


  // Sets de ids válidos (activos) para validar EN AUTORÍA que las referencias del flujo existen en la DB,
  // antes de escribir el meta.yaml en MinIO (no solo confiar en el select del front ni en las FKs al
  // materializar). Espejo de getCargoCodeMap para persona/posición/unidad/tipo de unidad.
  async getWorkflowReferenceIdSets(connection = this.pool) {
    const [persons, positions, units, unitTypes] = await Promise.all([
      connection.query("SELECT id FROM persons WHERE is_active = 1"),
      connection.query("SELECT id FROM unit_positions WHERE is_active = 1"),
      connection.query("SELECT id FROM units WHERE is_active = 1"),
      connection.query("SELECT id FROM unit_types WHERE is_active = 1")
    ]);
    const toSet = (result) => new Set((result?.[0] || []).map((row) => Number(row.id)));
    return {
      personIds: toSet(persons),
      positionIds: toSet(positions),
      unitIds: toSet(units),
      unitTypeIds: toSet(unitTypes)
    };
  }


  async replaceSyncedFillFlowSteps(fillFlowTemplateId, steps, connection = this.pool) {
    await connection.query(
      "DELETE FROM fill_flow_steps WHERE fill_flow_template_id = ?",
      [fillFlowTemplateId]
    );

    for (const step of steps) {
      await connection.query(
        `INSERT INTO fill_flow_steps (
           fill_flow_template_id,
           step_order,
           resolver_type,
           assigned_person_id,
           unit_scope_type,
           unit_id,
           unit_type_id,
           relation_type_id,
           cargo_id,
           position_id,
           selection_mode,
           is_required,
           can_reject
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          fillFlowTemplateId,
          step.stepOrder,
          step.resolverType,
          step.assignedPersonId,
          step.unitScopeType,
          step.unitId,
          step.unitTypeId,
          step.relationTypeId ?? null,
          step.cargoId,
          step.positionId,
          step.selectionMode,
          step.isRequired,
          step.canReject
        ]
      );
    }
  }


  async hasFillFlowTemplateRuntimeUsage(fillFlowTemplateId, connection = this.pool) {
    const [rows] = await connection.query(
      `SELECT EXISTS(
         SELECT 1
         FROM document_fill_flows dff
         LEFT JOIN fill_requests fr ON fr.document_fill_flow_id = dff.id
         WHERE dff.fill_flow_template_id = ?
         LIMIT 1
       ) AS has_usage`,
      [fillFlowTemplateId]
    );
    return Boolean(Number(rows?.[0]?.has_usage || 0));
  }


  async replaceSyncedSignatureFlowSteps(signatureFlowTemplateId, steps, connection = this.pool) {
    await connection.query(
      "DELETE FROM signature_flow_steps WHERE template_id = ?",
      [signatureFlowTemplateId]
    );

    for (const step of steps) {
      await connection.query(
        `INSERT INTO signature_flow_steps (
           template_id,
           step_order,
           code,
           name,
           slot,
           resolver_type,
           assigned_person_id,
           unit_scope_type,
           unit_id,
           unit_type_id,
           position_id,
           required_cargo_id,
           selection_mode,
           approval_mode,
         required_signers_min,
         required_signers_max,
         is_required,
         anchor_refs,
         signers
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          signatureFlowTemplateId,
          step.stepOrder,
          step.code,
          step.name,
          step.slot,
          step.resolverType,
          step.assignedPersonId,
          step.unitScopeType,
          step.unitId,
          step.unitTypeId,
          step.positionId,
          step.requiredCargoId,
          step.selectionMode,
          step.approvalMode,
          step.requiredSignersMin,
          step.requiredSignersMax,
          step.isRequired,
          JSON.stringify(Array.isArray(step.anchorRefs) ? step.anchorRefs : []),
          JSON.stringify(Array.isArray(step.signers) ? step.signers : [])
        ]
      );
    }
  }


  async hasSignatureFlowTemplateRuntimeUsage(signatureFlowTemplateId, connection = this.pool) {
    const [rows] = await connection.query(
      `SELECT EXISTS(
         SELECT 1
         FROM signature_flow_instances sfi
         LEFT JOIN signature_requests sr ON sr.instance_id = sfi.id
         LEFT JOIN document_signatures ds ON ds.signature_request_id = sr.id
         WHERE sfi.template_id = ?
         LIMIT 1
       ) AS has_usage`,
      [signatureFlowTemplateId]
    );
    return Boolean(Number(rows?.[0]?.has_usage || 0));
  }


  async syncArtifactFillWorkflowForArtifact({
    connection,
    artifactId,
    templateCode,
    storageVersion,
    displayName,
    metaDocument
  }) {
    const workflow = metaDocument?.workflows?.fill || {};
    const processTemplates = await this.getProcessDefinitionTemplatesByArtifact(artifactId, connection);

    if (!processTemplates.length) {
      return {
        linkedTemplates: 0,
        syncedTemplates: 0,
        syncedSteps: 0,
        deactivatedTemplates: 0
      };
    }

    const syncEnabled = isArtifactFillWorkflowSyncEnabled(workflow);
    const cargoCodeMap = syncEnabled ? await this._getCargoCodeMap(connection) : new Map();
    const normalizedSteps = syncEnabled
      ? normalizeFillSteps(workflow, { cargoCodeMap })
      : [];
    const templateName = String(workflow?.name || "").trim() || `Flujo de entrega - ${displayName}`;
    const templateDescription = buildArtifactSyncedFillDescription({
      artifactId,
      templateCode,
      storageVersion
    });

    let syncedTemplates = 0;
    let syncedSteps = 0;
    let deactivatedTemplates = 0;

    for (const processTemplate of processTemplates) {
      const existingTemplate = await this.getSyncedFillFlowTemplate(processTemplate.id, connection);

      if (!syncEnabled || !normalizedSteps.length) {
        if (existingTemplate?.id) {
          await connection.query(
            `UPDATE fill_flow_templates
             SET is_active = 0,
                 name = ?,
                 description = ?
             WHERE id = ?`,
            [templateName, templateDescription, existingTemplate.id]
          );
          deactivatedTemplates += 1;
        }
        continue;
      }

      let fillFlowTemplateId = existingTemplate?.id ? Number(existingTemplate.id) : null;
      const templateHasRuntimeUsage = fillFlowTemplateId
        ? await this.hasFillFlowTemplateRuntimeUsage(fillFlowTemplateId, connection)
        : false;

      if (!fillFlowTemplateId || templateHasRuntimeUsage) {
        const [insertResult] = await connection.query(
          `INSERT INTO fill_flow_templates (
             process_definition_template_id,
             name,
             description,
             is_active
           ) VALUES (?, ?, ?, 1)`,
          [processTemplate.id, templateName, templateDescription]
        );
        fillFlowTemplateId = Number(insertResult.insertId);
      } else {
        await connection.query(
          `UPDATE fill_flow_templates
           SET name = ?,
               description = ?,
               is_active = 1
           WHERE id = ?`,
          [templateName, templateDescription, fillFlowTemplateId]
        );
      }

      await connection.query(
        `UPDATE fill_flow_templates
         SET is_active = 0
         WHERE process_definition_template_id = ?
           AND description LIKE ?
           AND id <> ?`,
        [processTemplate.id, `${ARTIFACT_SYNC_FILL_DESCRIPTION_PREFIX}%`, fillFlowTemplateId]
      );

      await this.replaceSyncedFillFlowSteps(fillFlowTemplateId, normalizedSteps, connection);
      syncedTemplates += 1;
      syncedSteps += normalizedSteps.length;
    }

    return {
      linkedTemplates: processTemplates.length,
      syncedTemplates,
      syncedSteps,
      deactivatedTemplates
    };
  }


  async syncArtifactSignatureWorkflowForArtifact({
    connection,
    artifactId,
    templateCode,
    storageVersion,
    displayName,
    metaDocument
  }) {
    const workflow = metaDocument?.workflows?.signatures || {};
    const processTemplates = await this.getProcessDefinitionTemplatesByArtifact(artifactId, connection);

    if (!processTemplates.length) {
      return {
        linkedTemplates: 0,
        syncedTemplates: 0,
        syncedSteps: 0,
        deactivatedTemplates: 0
      };
    }

    const syncEnabled = isArtifactSignatureWorkflowSyncEnabled(workflow);
    const templateName = String(workflow?.name || "").trim() || `Flujo de firma - ${displayName}`;
    const templateDescription = buildArtifactSyncedSignatureDescription({
      artifactId,
      templateCode,
      storageVersion
    });

    const cargoCodeMap = await this._getCargoCodeMap(connection);
    const unitTypeNameMap = await this._getUnitTypeNameMap(connection);
    const normalizationIssues = syncEnabled
      ? collectSignatureWorkflowNormalizationIssues(workflow, { cargoCodeMap, unitTypeNameMap })
      : [];
    if (normalizationIssues.length) {
      throw new Error(
        `No se pudo sincronizar el flujo de firmas de ${templateCode}: ${normalizationIssues.join(" ")}`
      );
    }
    const normalizedSteps = syncEnabled
      ? normalizeSignatureSteps(workflow, { cargoCodeMap, unitTypeNameMap })
      : [];

    let syncedTemplates = 0;
    let syncedSteps = 0;
    let deactivatedTemplates = 0;

    for (const processTemplate of processTemplates) {
      const existingTemplate = await this.getSyncedSignatureFlowTemplate(processTemplate.id, connection);

      if (!syncEnabled || !normalizedSteps.length) {
        if (existingTemplate?.id) {
          await connection.query(
            `UPDATE signature_flow_templates
             SET is_active = 0,
                 name = ?,
                 description = ?
             WHERE id = ?`,
            [templateName, templateDescription, existingTemplate.id]
          );
          deactivatedTemplates += 1;
        }
        continue;
      }

      let signatureFlowTemplateId = existingTemplate?.id ? Number(existingTemplate.id) : null;
      const templateHasRuntimeUsage = signatureFlowTemplateId
        ? await this.hasSignatureFlowTemplateRuntimeUsage(signatureFlowTemplateId, connection)
        : false;

      if (!signatureFlowTemplateId || templateHasRuntimeUsage) {
        const [insertResult] = await connection.query(
          `INSERT INTO signature_flow_templates (
             process_definition_template_id,
             name,
             description,
             is_active
           ) VALUES (?, ?, ?, 1)`,
          [processTemplate.id, templateName, templateDescription]
        );
        signatureFlowTemplateId = Number(insertResult.insertId);
      } else {
        await connection.query(
          `UPDATE signature_flow_templates
           SET name = ?,
               description = ?,
               is_active = 1
           WHERE id = ?`,
          [templateName, templateDescription, signatureFlowTemplateId]
        );
      }

      await connection.query(
        `UPDATE signature_flow_templates
         SET is_active = 0
         WHERE process_definition_template_id = ?
           AND description LIKE ?
           AND id <> ?`,
        [processTemplate.id, `${ARTIFACT_SYNC_SIGNATURE_DESCRIPTION_PREFIX}%`, signatureFlowTemplateId]
      );

      await this.replaceSyncedSignatureFlowSteps(signatureFlowTemplateId, normalizedSteps, connection);
      syncedTemplates += 1;
      syncedSteps += normalizedSteps.length;
    }

    return {
      linkedTemplates: processTemplates.length,
      syncedTemplates,
      syncedSteps,
      deactivatedTemplates
    };
  }
}
