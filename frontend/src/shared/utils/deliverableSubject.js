import { canPreviewInline } from "@/shared/utils/filePath.js";

/**
 * Normaliza el payload de un entregable a una forma estable.
 *
 * Existe porque el mismo entregable llega con tres formas distintas segun de donde venga: envuelto en
 * `document`, plano, y en snake_case o camelCase segun el endpoint. Toda esa cadena de `||` es la
 * traduccion, y por eso hay tanta.
 *
 * Vivia dentro de useDeliverableView (1062 L) por DOS lineas: el fallback de `processId` y el de
 * `scopeUnitId` leian el proceso seleccionado de HomeView. Ahora esos dos fallbacks entran por parametro,
 * asi que la funcion es pura y la puede usar cualquier pantalla. useDeliverableView sigue exponiendo su
 * `getDeliverableSubject(payload)` con la firma de siempre --le pasa sus refs por dentro--, de modo que
 * ninguno de sus call sites se entera.
 *
 * @param {object} payload Entregable tal como lo devuelve el backend (o el que arma una pantalla).
 * @param {{processId?: any, scopeUnitId?: any}} fallbacks Contexto ambiente cuando el payload no lo trae.
 *   Quien no tenga proceso seleccionado --el centro documental-- no pasa nada y se queda en null.
 */
export const buildDeliverableSubject = (payload = {}, fallbacks = {}) => {
  const documentPayload = payload?.document || payload;
  const workingFilePath = documentPayload?.working_file_path || documentPayload?.workingFilePath || payload?.workingFilePath || '';
  const finalFilePath = documentPayload?.final_file_path || documentPayload?.finalFilePath || payload?.finalFilePath || '';
  const preloadFilePath = finalFilePath || workingFilePath;
  const preloadPdfPath = [finalFilePath, workingFilePath].find((value) => canPreviewInline(value)) || '';
  return {
    id: payload?.id || documentPayload?.id || documentPayload?.task_item_id || null,
    itemId: payload?.id || payload?.itemId || documentPayload?.task_item_id || documentPayload?.itemId || null,
    taskId: payload?.task_id || payload?.taskId || documentPayload?.task_id || documentPayload?.taskId || null,
    processDefinitionId:
      payload?.process_definition_id
      || payload?.processDefinitionId
      || documentPayload?.process_definition_id
      || documentPayload?.processDefinitionId
      || null,
    documentId: documentPayload?.document_id || documentPayload?.documentId || payload?.documentId || null,
    documentVersionId: documentPayload?.document_version_id || documentPayload?.documentVersionId || payload?.documentVersionId || null,
    documentVersion: documentPayload?.document_version || documentPayload?.documentVersion || payload?.documentVersion || null,
    processId:
      payload?.process_id
      || payload?.processId
      || payload?.workflow?.process_id
      || payload?.workflow?.processId
      || fallbacks?.processId
      || null,
    scopeUnitId:
      payload?.scope_unit_id
      || documentPayload?.scope_unit_id
      || payload?.scopeUnitId
      || documentPayload?.scopeUnitId
      || fallbacks?.scopeUnitId
      || null,
    originUnitId:
      payload?.origin_unit_id
      || documentPayload?.origin_unit_id
      || payload?.originUnitId
      || documentPayload?.originUnitId
      || null,
    title: payload?.title || payload?.template_artifact_name || documentPayload?.title || documentPayload?.template_artifact_name || `Entregable #${payload?.id || documentPayload?.document_id || 's/n'}`,
    templateArtifactName: payload?.template_artifact_name || payload?.templateArtifactName || documentPayload?.template_artifact_name || documentPayload?.templateArtifactName || '',
    actions: payload?.actions || documentPayload?.actions || {},
    workflow: payload?.workflow || documentPayload?.workflow || {},
    status: payload?.status || payload?.status_name || payload?.statusName || documentPayload?.status || documentPayload?.status_name || documentPayload?.statusName || '',
    documentStatus: payload?.document_status || payload?.documentStatus || documentPayload?.document_status || documentPayload?.documentStatus || '',
    pendingFillCount: payload?.pending_fill_count || payload?.pendingFillCount || documentPayload?.pending_fill_count || documentPayload?.pendingFillCount || 0,
    pendingSignatureCount: payload?.pending_signature_count || payload?.pendingSignatureCount || documentPayload?.pending_signature_count || documentPayload?.pendingSignatureCount || 0,
    itemStartDate:
      payload?.item_start_date
      || payload?.itemStartDate
      || documentPayload?.item_start_date
      || documentPayload?.itemStartDate
      || payload?.start_date
      || payload?.startDate
      || documentPayload?.start_date
      || documentPayload?.startDate
      || null,
    itemEndDate:
      payload?.item_end_date
      || payload?.itemEndDate
      || documentPayload?.item_end_date
      || documentPayload?.itemEndDate
      || payload?.end_date
      || payload?.endDate
      || documentPayload?.end_date
      || documentPayload?.endDate
      || null,
    userStartedAt:
      payload?.user_started_at
      || payload?.userStartedAt
      || documentPayload?.user_started_at
      || documentPayload?.userStartedAt
      || null,
    taskStartDate: payload?.task_start_date || payload?.taskStartDate || documentPayload?.task_start_date || documentPayload?.taskStartDate || null,
    taskEndDate: payload?.task_end_date || payload?.taskEndDate || documentPayload?.task_end_date || documentPayload?.taskEndDate || null,
    periodLabel: payload?.period_label || payload?.periodLabel || '',
    unitLabel:
      payload?.unit_label
      || payload?.unitLabel
      || payload?.origin_unit_label
      || payload?.originUnitLabel
      || documentPayload?.unit_label
      || documentPayload?.unitLabel
      || documentPayload?.origin_unit_label
      || documentPayload?.originUnitLabel
      || '',
    processLabel: payload?.process_label || payload?.processLabel || '',
    description:
      payload?.template_artifact_description
      || payload?.templateArtifactDescription
      || payload?.description
      || documentPayload?.template_artifact_description
      || documentPayload?.templateArtifactDescription
      || documentPayload?.description
      || '',
    workingFilePath,
    finalFilePath,
    preloadFilePath,
    preloadPdfPath
  };
};
