import axios from "axios";
import { API_ROUTES } from "@/core/config/apiConfig";
import { adminSqlService } from "@/modules/admin/services/AdminSqlService";

export function useAdminSyncActions({
  props,
  loading,
  error,
  formData,
  fkDisplay,
  allTablesMap,
  isTemplateArtifactsTable,
  isTemplateSeedsTable,
  fetchRows,
  loadDraftArtifactSeedOptions,
  showFeedbackToast,
  resolveDisplayField,
  setFkLabel
}) {
  const syncTemplateArtifactsFromDist = async () => {
    if (!isTemplateArtifactsTable.value) {
      return;
    }
    loading.value = true;
    error.value = "";
    try {
      const response = await adminSqlService.syncTemplateArtifacts();
      const { discovered = 0, outputs = 0, inserted = 0, updated = 0 } = response.data || {};
      await fetchRows();
      showFeedbackToast({
        kind: "success",
        title: "Sincronizacion completada",
        message: `Paquetes: ${discovered}. Salidas detectadas: ${outputs}. Insertados: ${inserted}. Actualizados: ${updated}.`
      });
    } catch (err) {
      error.value = err?.response?.data?.message || "No se pudo sincronizar template_artifacts.";
      showFeedbackToast({
        kind: "error",
        title: "No se pudo sincronizar",
        message: error.value,
        duration: 7000
      });
    } finally {
      loading.value = false;
    }
  };

  const syncTemplateSeedsFromSource = async () => {
    loading.value = true;
    error.value = "";
    try {
      const response = await adminSqlService.syncTemplateSeeds();
      const { discovered = 0, inserted = 0, updated = 0 } = response.data || {};
      if (isTemplateSeedsTable.value) {
        await fetchRows();
      }
      await loadDraftArtifactSeedOptions();
      showFeedbackToast({
        kind: "success",
        title: "Seeds sincronizados",
        message: `Detectados: ${discovered}. Insertados: ${inserted}. Actualizados: ${updated}.`
      });
    } catch (err) {
      error.value = err?.response?.data?.message || "No se pudieron sincronizar los seeds.";
      showFeedbackToast({
        kind: "error",
        title: "No se pudieron sincronizar",
        message: error.value,
        duration: 7000
      });
    } finally {
      loading.value = false;
    }
  };

  const applyUnitRelationDefaults = async () => {
    if (props.table?.table !== "unit_relations") {
      return;
    }
    try {
      const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE("relation_unit_types"), {
        params: {
          filter_code: "org",
          limit: 1
        }
      });
      const row = response.data?.[0];
      if (!row?.id) {
        return;
      }
      formData.value = {
        ...formData.value,
        relation_type_id: String(row.id)
      };
      const displayField = resolveDisplayField(allTablesMap.value?.relation_unit_types);
      const labelValue = row[displayField] ?? row.id;
      setFkLabel("relation_unit_types", row.id, String(labelValue));
      fkDisplay.value = {
        ...fkDisplay.value,
        relation_type_id: String(labelValue)
      };
    } catch {
      // Default remains empty if org type cannot be resolved.
    }
  };

  return {
    syncTemplateArtifactsFromDist,
    syncTemplateSeedsFromSource,
    applyUnitRelationDefaults
  };
}
