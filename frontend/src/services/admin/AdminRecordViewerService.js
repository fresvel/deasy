import axios from "axios";
import { API_ROUTES } from "@/services/apiConfig";
import { RELATED_RECORD_CONFIG } from "@/services/admin/AdminTableManagerConfig";

class AdminRecordViewerService {
  async loadRelatedSections({
    tableMeta,
    row,
    allTablesMap,
    getViewerFieldsForTable,
    isForeignKeyField,
    prefetchFkLabelsForRows,
    prefetchProcessLabelsForDefinitionRows,
    prefetchProcessDefinitionMeta
  }) {
    if (!tableMeta?.table || row?.id === null || row?.id === undefined || row?.id === "") {
      return [];
    }

    const configs = RELATED_RECORD_CONFIG[tableMeta.table] || [];
    if (!configs.length) {
      return [];
    }

    const sections = await Promise.all(
      configs.map(async (config) => {
        const sectionTableMeta = allTablesMap[config.table];
        if (!sectionTableMeta) {
          return null;
        }

        const fields = getViewerFieldsForTable(sectionTableMeta, { includeVirtual: false });

        try {
          const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE(config.table), {
            params: {
              [`filter_${config.foreignKey}`]: row.id,
              orderBy: config.orderBy,
              order: config.order,
              limit: 50
            }
          });
          const relatedRows = response.data || [];
          const fkFields = fields
            .filter((field) => isForeignKeyField(field))
            .map((field) => field.name);

          await prefetchFkLabelsForRows(relatedRows, fkFields);
          await prefetchProcessLabelsForDefinitionRows(relatedRows, sectionTableMeta);
          await prefetchProcessDefinitionMeta(relatedRows, sectionTableMeta);

          return {
            key: config.table,
            label: config.label,
            tableMeta: sectionTableMeta,
            fields,
            rows: relatedRows,
            error: ""
          };
        } catch (error) {
          return {
            key: config.table,
            label: config.label,
            tableMeta: sectionTableMeta,
            fields,
            rows: [],
            error: error?.response?.data?.message || "No se pudo cargar la relacion."
          };
        }
      })
    );

    return sections.filter(Boolean);
  }
}

export const adminRecordViewerService = new AdminRecordViewerService();
