<template>
  <div class="py-4">
    <AdminFeedbackToast
      :visible="feedbackToast.visible"
      :kind="feedbackToast.kind"
      :title="feedbackToast.title"
      :message="feedbackToast.message"
      @close="hideFeedbackToast"
    />

    <AdminTableHeader
      :table-header-icon="tableHeaderIcon"
      :table-header-title="tableHeaderTitle"
      :table-header-subtitle="tableHeaderSubtitle"
      :table="table"
      :loading="loading"
      :is-template-seeds-table="isTemplateSeedsTable"
      :is-template-artifacts-table="isTemplateArtifactsTable"
      @go-back="handleGoBack"
      @search="handleSearchAction"
      @sync-template-seeds="syncTemplateSeedsFromSource"
      @sync-template-artifacts="syncTemplateArtifactsFromDist"
      @create="handlePrimaryCreateAction"
    />

    <div v-if="!table" class="flex">
      <div class="w-full">
        <div class="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div class="p-5">
            <p class="mb-0 text-sm text-slate-500">Selecciona una tabla para administrar.</p>
          </div>
        </div>
      </div>
    </div>

    <AdminMainTableSection
      v-else
      ref="mainTableSection"
      :table="table"
      :loading="loading"
      :error="error"
      :search-term="searchTerm"
      :is-position-filter-table="isPositionFilterTable"
      :is-process-definition-filter-table="isProcessDefinitionFilterTable"
      :is-process-target-rule-filter-table="isProcessTargetRuleFilterTable"
      :is-template-artifacts-table="isTemplateArtifactsTable"
      :is-person-table="isPersonTable"
      :unit-position-filters="unitPositionFilters"
      :unit-position-filter-loading="unitPositionFilterLoading"
      :unit-position-unit-type-options="unitPositionUnitTypeOptions"
      :unit-position-unit-options="unitPositionUnitOptions"
      :unit-position-cargo-options="unitPositionCargoOptions"
      :process-definition-inline-filters="processDefinitionInlineFilters"
      :process-definition-process-options="processDefinitionProcessOptions"
      :process-definition-series-options="processDefinitionSeriesOptions"
      :process-target-rule-inline-filters="processTargetRuleInlineFilters"
      :template-artifact-inline-filters="templateArtifactInlineFilters"
      :has-unit-position-filters="hasUnitPositionFilters"
      :has-process-definition-inline-filters="hasProcessDefinitionInlineFilters"
      :has-process-target-rule-inline-filters="hasProcessTargetRuleInlineFilters"
      :has-template-artifact-inline-filters="hasTemplateArtifactInlineFilters"
      :table-list-fields="tableListFields"
      :rows="rows"
      :row-key="rowKey"
      :format-fk-option-label="formatFkOptionLabel"
      :format-cell="formatCell"
      :get-available-format-sections="getAvailableFormatSections"
      :get-available-format-badge-style="getAvailableFormatBadgeStyle"
      @update:search-term="searchTerm = $event"
      @update:unit-position-filters="unitPositionFilters = $event"
      @update:process-definition-inline-filters="processDefinitionInlineFilters = $event"
      @update:process-target-rule-inline-filters="processTargetRuleInlineFilters = $event"
      @update:template-artifact-inline-filters="templateArtifactInlineFilters = $event"
      @debounced-search="debouncedSearch"
      @handle-unit-position-type-change="handleUnitPositionTypeChange"
      @handle-unit-position-unit-change="handleUnitPositionUnitChange"
      @handle-unit-position-cargo-change="handleUnitPositionCargoChange"
      @clear-unit-position-inline-filters="clearUnitPositionInlineFilters"
      @clear-process-definition-inline-filters="clearProcessDefinitionInlineFilters"
      @clear-process-target-rule-inline-filters="clearProcessTargetRuleInlineFilters"
      @clear-template-artifact-inline-filters="clearTemplateArtifactInlineFilters"
      @fetch-rows="fetchRows"
      @open-record-viewer="openRecordViewer"
      @open-edit="openEdit"
      @open-delete="openDelete"
      @start-process-definition-versioning="startProcessDefinitionVersioning"
      @open-process-definition-activation-for-row="openProcessDefinitionActivationForRow"
      @open-person-assignments="openPersonAssignments"
    />

    <AdminVacantPositionsSection
      v-if="isPositionAssignmentsTable"
      :search-term="vacantSearchTerm"
      :filters="vacantPositionFilters"
      :filter-loading="vacantPositionFilterLoading"
      :has-filters="hasVacantPositionFilters"
      :loading="vacantPositionLoading"
      :error="vacantPositionError"
      :rows="vacantPositionRows"
      :unit-type-options="vacantPositionUnitTypeOptions"
      :unit-options="vacantPositionUnitOptions"
      :cargo-options="vacantPositionCargoOptions"
      :table-fields="vacantPositionTableFields"
      :format-fk-option-label="formatFkOptionLabel"
      :format-fk-list-cell="formatFkListCell"
      :format-cell="formatCell"
      :format-position-type="formatPositionType"
      @update:search-term="vacantSearchTerm = $event"
      @update:filters="vacantPositionFilters = $event"
      @debounced-search="debouncedVacantSearch"
      @handle-type-change="handleVacantPositionTypeChange"
      @handle-unit-change="handleVacantPositionUnitChange"
      @handle-cargo-change="handleVacantPositionCargoChange"
      @handle-position-type-filter-change="handleVacantPositionTypeFilterChange"
      @clear-filters="clearVacantPositionFilters"
      @load="loadVacantPositions"
      @deactivate="deactivateVacantPosition"
      @assign="assignVacantPosition"
    />

    <AdminUnassignedArtifactsSection
      v-if="isProcessDefinitionTemplatesTable"
      :search-term="unassignedTemplateArtifactSearch"
      :filters="unassignedTemplateArtifactFilters"
      :has-filters="hasUnassignedTemplateArtifactFilters"
      :loading="unassignedTemplateArtifactLoading"
      :error="unassignedTemplateArtifactError"
      :rows="unassignedTemplateArtifactRows"
      :table-fields="unassignedTemplateArtifactTableFields"
      :get-available-format-sections="getAvailableFormatSections"
      :get-available-format-badge-style="getAvailableFormatBadgeStyle"
      @update:search-term="unassignedTemplateArtifactSearch = $event"
      @update:filters="unassignedTemplateArtifactFilters = $event"
      @debounced-search="debouncedUnassignedTemplateArtifactSearch"
      @clear-filters="clearUnassignedTemplateArtifactFilters"
      @load="loadUnassignedTemplateArtifacts"
      @view="openRecordViewer($event, allTablesMap.template_artifacts)"
      @link="startProcessDefinitionTemplateFromArtifact"
    />

    <AdminPersonAssignmentsModal
      ref="personAssignmentsModal"
      :person-editor-id="personEditorId"
      :person-assignment-name="personAssignmentName"
      :person-assignment-meta="personAssignmentMeta"
      :person-assignments-loading="personAssignmentsLoading"
      :person-assignment-sections="personAssignmentSections"
      :person-assignment-section="personAssignmentSection"
      :person-cargo-error="personCargoError"
      :person-cargo-labels="personCargoLabels"
      :person-cargo-form="personCargoForm"
      :person-cargo-edit-id="personCargoEditId"
      :person-cargo-table-fields="personCargoTableFields"
      :person-cargo-rows="personCargoRows"
      :person-role-error="personRoleError"
      :person-role-labels="personRoleLabels"
      :person-role-form="personRoleForm"
      :person-role-edit-id="personRoleEditId"
      :person-role-table-fields="personRoleTableFields"
      :person-role-rows="personRoleRows"
      :person-contract-error="personContractError"
      :person-contract-labels="personContractLabels"
      :person-contract-form="personContractForm"
      :person-contract-edit-id="personContractEditId"
      :person-contract-table-fields="personContractTableFields"
      :person-contract-rows="personContractRows"
      :row-key="rowKey"
      :format-cell="formatCell"
      :format-person-cargo-unit="formatPersonCargoUnit"
      :to-date-input-value="toDateInputValue"
      @update:person-assignment-section="personAssignmentSection = $event"
      @update:person-cargo-form="personCargoForm = $event"
      @update:person-contract-form="personContractForm = $event"
      @clear-person-cargo-position="clearPersonCargoPosition"
      @open-person-cargo-fk-search="openPersonCargoFkSearch"
      @submit-person-cargo-create="submitPersonCargoCreate"
      @reset-person-cargo-form="resetPersonCargoForm"
      @view-person-cargo="openRecordViewer($event, allTablesMap.position_assignments)"
      @start-person-cargo-edit="startPersonCargoEdit"
      @delete-person-cargo="deletePersonCargo"
      @clear-person-role-field="clearPersonRoleField"
      @open-person-role-fk-search="openPersonRoleFkSearch"
      @submit-person-role-create="submitPersonRoleCreate"
      @reset-person-role-form="resetPersonRoleForm"
      @view-person-role="openRecordViewer($event, allTablesMap.role_assignments)"
      @start-person-role-edit="startPersonRoleEdit"
      @delete-person-role="deletePersonRole"
      @clear-person-contract-position="clearPersonContractPosition"
      @open-person-contract-fk-search="openPersonContractFkSearch"
      @submit-person-contract-create="submitPersonContractCreate"
      @reset-person-contract-form="resetPersonContractForm"
      @view-person-contract="openRecordViewer($event, allTablesMap.contracts)"
      @start-person-contract-edit="startPersonContractEdit"
      @delete-person-contract="deletePersonContract"
    />

    <AdminEditorModal
      ref="editorModal"
      :editor-mode="editorMode"
      :table="table"
      :is-process-table="isProcessTable"
      :modal-error="modalError"
      :visible-form-fields="visibleFormFields"
      :fk-display="fkDisplay"
      :inline-fk-loading="inlineFkLoading"
      :inline-fk-suggestions="inlineFkSuggestions"
      :form-data="formData"
      :process-definition-checklist-loading="processDefinitionChecklistLoading"
      :process-definition-checklist="processDefinitionChecklist"
      :requires-definition-artifacts="requiresDefinitionArtifacts"
      :selected-row="selectedRow"
      :is-input-field="isInputField"
      :is-foreign-key-field="isForeignKeyField"
      :is-field-locked="isFieldLocked"
      :input-type="inputType"
      :should-show-inline-fk-suggestions="shouldShowInlineFkSuggestions"
      :format-inline-fk-option="formatInlineFkOption"
      :format-select-option-label="formatSelectOptionLabel"
      @update:form-data="formData = $event"
      @update-inline-fk-display="updateInlineFkDisplay"
      @open-inline-fk-suggestions="openInlineFkSuggestions"
      @schedule-inline-fk-close="scheduleInlineFkClose"
      @clear-inline-fk-selection="clearInlineFkSelection"
      @open-fk-search="openFkSearch"
      @select-inline-fk-suggestion="selectInlineFkSuggestion"
      @handle-select-change="handleSelectChange"
      @open-definition-rules="openDefinitionRulesFromEditor"
      @open-definition-triggers="openDefinitionTriggersFromEditor"
      @open-definition-artifacts="openDefinitionArtifactsFromEditor"
      @submit="submitForm"
    />

    <AdminProcessDefinitionVersioningModal
      ref="processDefinitionVersioningModal"
      @close="closeProcessDefinitionVersioningModal"
      @cancel-edit="cancelProcessDefinitionEdit"
      @promote="promoteProcessDefinitionToNewVersion"
    />

    <AdminProcessDefinitionActivationModal
      ref="processDefinitionActivationModal"
      :checking="processDefinitionActivationChecking"
      :has-active-rules="processDefinitionActivationHasActiveRules"
      :has-active-triggers="processDefinitionActivationHasActiveTriggers"
      :has-required-artifacts="processDefinitionActivationHasRequiredArtifacts"
      :requires-artifacts="processDefinitionActivationRequiresArtifacts"
      :view="processDefinitionActivationView"
      :selected-row="selectedRow"
      :rules="processDefinitionActivationRules"
      :triggers="processDefinitionActivationTriggers"
      :artifacts="processDefinitionActivationArtifacts"
      :rule-table-fields="processDefinitionActivationRuleTableFields"
      :trigger-table-fields="processDefinitionActivationTriggerTableFields"
      :artifact-table-fields="processDefinitionActivationArtifactTableFields"
      :primary-action="processDefinitionActivationPrimaryAction"
      :primary-action-label="processDefinitionActivationPrimaryActionLabel"
      :all-requirements-met="allProcessDefinitionActivationRequirementsMet"
      :format-cell="formatCell"
      :format-definition-rule-summary="formatDefinitionRuleSummary"
      @update:view="processDefinitionActivationView = $event"
      @cancel="cancelProcessDefinitionActivation"
      @primary-action="handleProcessDefinitionActivationPrimaryAction"
      @confirm="confirmProcessDefinitionActivation"
    />

    <AdminDeleteConfirmModal ref="deleteModal" @confirm="confirmDelete" />

    <AdminDefinitionCreatedPromptModal
      ref="definitionArtifactsPromptModal"
      :context="definitionArtifactsPromptContext"
      @close="closeDefinitionArtifactsPrompt"
      @open-rules="confirmDefinitionRulesPrompt"
      @open-triggers="confirmDefinitionTriggersPrompt"
      @open-artifacts="confirmDefinitionArtifactsPrompt"
    />

    <AdminDefinitionArtifactsModal
      ref="definitionArtifactsModal"
      :context="definitionArtifactsContext"
      :error="definitionArtifactsError"
      :can-manage="canManageDefinitionArtifacts"
      :can-submit="canSubmitDefinitionArtifact"
      :labels="definitionArtifactsLabels"
      :form="definitionArtifactsForm"
      :edit-id="definitionArtifactsEditId"
      :loading="definitionArtifactsLoading"
      :rows="definitionArtifactsRows"
      :table-fields="definitionArtifactsTableFields"
      :format-cell="formatCell"
      @update:form="definitionArtifactsForm = $event"
      @clear-selection="clearDefinitionArtifactSelection"
      @open-fk-search="openDefinitionArtifactFkSearch"
      @submit="submitDefinitionArtifact"
      @reset="resetDefinitionArtifactsForm"
      @view-row="openRecordViewer($event, allTablesMap.process_definition_templates)"
      @edit-row="startDefinitionArtifactEdit"
      @delete-row="deleteDefinitionArtifact"
      @close="closeDefinitionArtifactsManager"
      @accept="acceptDefinitionArtifactsManager"
    />

    <AdminDefinitionTriggersModal
      ref="definitionTriggersModal"
      :context="definitionTriggersContext"
      :error="definitionTriggersError"
      :can-manage="canManageDefinitionTriggers"
      :can-submit="canSubmitDefinitionTrigger"
      :requires-term-type="definitionTriggerRequiresTermType"
      :labels="definitionTriggersLabels"
      :form="definitionTriggersForm"
      :edit-id="definitionTriggersEditId"
      :loading="definitionTriggersLoading"
      :rows="definitionTriggersRows"
      :table-fields="definitionTriggersTableFields"
      :format-cell="formatCell"
      @update:form="definitionTriggersForm = $event"
      @trigger-mode-change="handleDefinitionTriggerModeChange"
      @clear-term-type="clearDefinitionTriggerTermType"
      @open-fk-search="openDefinitionTriggerFkSearch"
      @submit="submitDefinitionTrigger"
      @reset="resetDefinitionTriggersForm"
      @view-row="openRecordViewer($event, allTablesMap.process_definition_triggers)"
      @edit-row="startDefinitionTriggerEdit"
      @delete-row="deleteDefinitionTrigger"
      @close="closeDefinitionTriggersManager"
      @accept="acceptDefinitionTriggersManager"
    />

    <AdminDefinitionRulesModal
      ref="definitionRulesModal"
      :context="definitionRulesContext"
      :error="definitionRulesError"
      :can-manage="canManageDefinitionRules"
      :can-submit="canSubmitDefinitionRule"
      :labels="definitionRulesLabels"
      :form="definitionRulesForm"
      :edit-id="definitionRulesEditId"
      :loading="definitionRulesLoading"
      :rows="definitionRulesRows"
      :table-fields="definitionRulesTableFields"
      :format-cell="formatDefinitionRuleCell"
      @update:form="definitionRulesForm = $event"
      @scope-change="handleDefinitionRuleScopeChange"
      @clear-field="clearDefinitionRuleField"
      @open-fk-search="openDefinitionRuleFkSearch"
      @submit="submitDefinitionRule"
      @reset="resetDefinitionRulesForm"
      @view-row="openRecordViewer($event, allTablesMap.process_target_rules)"
      @edit-row="startDefinitionRuleEdit"
      @delete-row="deleteDefinitionRule"
      @close="closeDefinitionRulesManager"
      @accept="acceptDefinitionRulesManager"
    />

    <AdminFkBrowserModal
      ref="fkModal"
      :fk-table="fkTable"
      :is-fk-units="isFkUnits"
      :is-fk-process-definitions="isFkProcessDefinitions"
      :is-fk-template-artifacts="isFkTemplateArtifacts"
      :is-fk-unit-positions="isFkUnitPositions"
      :fk-search="fkSearch"
      :fk-filters="fkFilters"
      :fk-position-filters="fkPositionFilters"
      :fk-position-filter-loading="fkPositionFilterLoading"
      :fk-unit-type-options="fkUnitTypeOptions"
      :fk-unit-options="fkUnitOptions"
      :fk-cargo-options="fkCargoOptions"
      :fk-process-definition-process-options="fkProcessDefinitionProcessOptions"
      :has-fk-process-definition-filters="hasFkProcessDefinitionFilters"
      :has-fk-template-artifact-filters="hasFkTemplateArtifactFilters"
      :fk-loading="fkLoading"
      :fk-error="fkError"
      :fk-search-table-fields="fkSearchTableFields"
      :fk-rows="fkRows"
      :can-open-fk-filter-modal="canOpenFkFilterModal"
      :can-create-fk-reference="canCreateFkReference"
      :format-fk-option-label="formatFkOptionLabel"
      :get-fk-table-field-options="getFkTableFieldOptions"
      :get-fk-table-field="getFkTableField"
      :format-select-option-label="formatSelectOptionLabel"
      :format-fk-primary-cell="formatFkPrimaryCell"
      :format-fk-list-cell="formatFkListCell"
      :get-available-format-sections="getAvailableFormatSections"
      :get-available-format-badge-style="getAvailableFormatBadgeStyle"
      @update:fk-search="fkSearch = $event"
      @update:fk-filters="fkFilters = $event"
      @update:fk-position-filters="fkPositionFilters = $event"
      @debounced-search="debouncedFkSearch"
      @fk-unit-type-change="handleFkUnitTypeChange"
      @fk-unit-change="handleFkUnitChange"
      @fk-cargo-change="handleFkCargoChange"
      @process-definition-filter-change="handleFkProcessDefinitionFilterChange"
      @template-artifact-filter-change="handleFkTemplateArtifactFilterChange"
      @clear-fk-unit-position-filters="clearFkUnitPositionFilters"
      @clear-fk-process-definition-filters="clearFkProcessDefinitionFilters"
      @clear-fk-template-artifact-filters="clearFkTemplateArtifactFilters"
      @open-fk-viewer="openFkViewer"
      @select-fk-row="selectFkRow"
      @open-fk-filter="openFkFilterModal"
      @open-fk-create="openFkCreate"
    />

    <AdminRecordViewerModal
      ref="recordViewerModal"
      :loading="recordViewerLoading"
      :error="recordViewerError"
      :record-viewer-table="recordViewerTable"
      :record-viewer-row="recordViewerRow"
      :summary-table-fields="recordViewerSummaryTableFields"
      :display-rows="recordViewerDisplayRows"
      :related-sections="recordViewerRelatedSections"
      :format-record-viewer-value="formatRecordViewerValue"
      :get-available-format-sections="getAvailableFormatSections"
      :get-available-format-badge-style="getAvailableFormatBadgeStyle"
      :row-key-for-table="rowKeyForTable"
      :format-value-for-table="formatValueForTable"
      @close="closeRecordViewer"
    />

    <AdminFkViewerModal
      ref="fkViewerModal"
      :fk-table="fkTable"
      :fk-viewer-row="fkViewerRow"
      :summary-table-fields="fkViewerSummaryTableFields"
      :display-rows="fkViewerDisplayRows"
      :format-fk-viewer-value="formatFkViewerValue"
      @close="closeFkViewer"
    />

    <AdminFkFilterModal
      ref="fkFilterModal"
      :fk-table="fkTable"
      :fk-filter-fields="fkFilterFields"
      :fk-filters="fkFilters"
      :is-input-field="isInputField"
      :input-type="inputType"
      :format-select-option-label="formatSelectOptionLabel"
      @update:fk-filters="fkFilters = $event"
      @cancel="cancelFkFilter"
      @clear="clearFkFilters"
      @apply="applyFkFilters"
    />

    <AdminFkCreateModal
      ref="fkCreateModal"
      :fk-table="fkTable"
      :fk-create-error="fkCreateError"
      :fk-create-fields="fkCreateFields"
      :fk-create-form="fkCreateForm"
      :fk-create-loading="fkCreateLoading"
      :can-create-fk-reference="canCreateFkReference"
      :is-input-field="isInputField"
      :input-type="inputType"
      :format-select-option-label="formatSelectOptionLabel"
      @update:fk-create-form="fkCreateForm = $event"
      @cancel="cancelFkCreate"
      @submit="submitFkCreate"
    />

    <AdminSearchModal
      ref="processSearchModal"
      labelled-by="processSearchModalLabel"
      title="Buscar procesos"
      @clear="clearProcessFilter"
      @search="applyProcessFilter"
    >
            <div class="grid gap-3">
              <div>
                <label class="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-slate-700">Proceso padre</label>
                <AdminLookupField
                  v-model="processFilterLabels.parent_id"
                  placeholder="Selecciona un proceso padre"
                  readonly
                  prevent-input-interaction
                  :clear-disabled="!processFilters.parent_id"
                  @clear="clearProcessParentFilter"
                  @search="openProcessFkSearch('parent_id')"
                />
              </div>
              <div>
                <label class="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-slate-700">Activo</label>
                <AdminSelectField v-model="processFilters.is_active">
                  <option value="">Todos</option>
                  <option value="1">Si</option>
                  <option value="0">No</option>
                </AdminSelectField>
              </div>
            </div>
    </AdminSearchModal>

    <AdminSearchModal
      ref="templateSearchModal"
      labelled-by="templateSearchModalLabel"
      title="Buscar plantillas"
      @clear="clearTemplateFilter"
      @search="applyTemplateFilter"
    >
            <div class="grid gap-3">
              <div>
                <label class="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-slate-700">Nombre</label>
                <AdminInputField v-model="templateFilters.name" />
              </div>
              <div>
                <label class="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-slate-700">Slug</label>
                <AdminInputField v-model="templateFilters.slug" />
              </div>
              <div>
                <label class="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-slate-700">Descripcion</label>
                <AdminInputField v-model="templateFilters.description" />
              </div>
              <div>
                <label class="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-slate-700">Proceso</label>
                <AdminLookupField
                  v-model="templateFilterLabels.process_id"
                  placeholder="Selecciona un proceso"
                  readonly
                  prevent-input-interaction
                  :clear-disabled="!templateFilters.process_id"
                  @clear="clearTemplateProcessFilter"
                  @search="openTemplateFkSearch"
                />
              </div>
            </div>
    </AdminSearchModal>

    <AdminSearchModal
      ref="documentSearchModal"
      labelled-by="documentSearchModalLabel"
      title="Buscar documentos"
      @clear="clearDocumentFilter"
      @search="applyDocumentFilter"
    >
            <div class="grid gap-3">
              <div>
                <label class="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-slate-700">Tarea</label>
                <AdminLookupField
                  v-model="documentFilterLabels.task_id"
                  placeholder="Selecciona una tarea"
                  readonly
                  prevent-input-interaction
                  :clear-disabled="!documentFilters.task_id"
                  @clear="clearDocumentTaskFilter"
                  @search="openDocumentFkSearch('task_id')"
                />
              </div>
              <div>
                <label class="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-slate-700">Estado</label>
                <AdminSelectField v-model="documentFilters.status">
                  <option value="">Todos</option>
                  <option value="Inicial">Inicial</option>
                  <option value="En proceso">En proceso</option>
                  <option value="Aprobado">Aprobado</option>
                  <option value="Rechazado">Rechazado</option>
                </AdminSelectField>
              </div>
            </div>
    </AdminSearchModal>

    <AdminSearchModal
      ref="unitPositionSearchModal"
      labelled-by="unitPositionSearchModalLabel"
      title="Buscar puestos"
      @clear="clearUnitPositionFilter"
      @search="applyUnitPositionFilter"
    >
            <div class="grid gap-3">
              <div>
                <label class="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-slate-700">Tipo de unidad</label>
                <AdminSelectField
                  v-model="unitPositionFilters.unit_type_id"
                  :disabled="unitPositionFilterLoading"
                  @change="handleUnitPositionTypeChange"
                >
                  <option value="">Todos</option>
                  <option
                    v-for="row in unitPositionUnitTypeOptions"
                    :key="row.id"
                    :value="String(row.id)"
                  >
                    {{ formatFkOptionLabel("unit_types", row) }}
                  </option>
                </AdminSelectField>
              </div>
              <div>
                <label class="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-slate-700">Unidad</label>
                <AdminSelectField
                  v-model="unitPositionFilters.unit_id"
                  :disabled="!unitPositionFilters.unit_type_id || unitPositionFilterLoading"
                >
                  <option value="">Todas</option>
                  <option
                    v-for="row in unitPositionUnitOptions"
                    :key="row.id"
                    :value="String(row.id)"
                  >
                    {{ formatFkOptionLabel("units", row) }}
                  </option>
                </AdminSelectField>
              </div>
              <div>
                <label class="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-slate-700">Cargo</label>
                <AdminSelectField
                  v-model="unitPositionFilters.cargo_id"
                  :disabled="unitPositionFilterLoading"
                >
                  <option value="">Todos</option>
                  <option
                    v-for="row in unitPositionCargoOptions"
                    :key="row.id"
                    :value="String(row.id)"
                  >
                    {{ formatFkOptionLabel("cargos", row) }}
                  </option>
                </AdminSelectField>
              </div>
            </div>
    </AdminSearchModal>

    <AdminDraftArtifactModal
      ref="draftArtifactModalRef"
      :draft-artifact-edit-id="draftArtifactEditId"
      :draft-artifact-error="draftArtifactError"
      :draft-artifact-loading="draftArtifactLoading"
      :draft-artifact-form="draftArtifactForm"
      :draft-artifact-seed-options="draftArtifactSeedOptions"
      :draft-artifact-preview-url="draftArtifactPreviewUrl"
      :get-draft-artifact-file-label="getDraftArtifactFileLabel"
      @update:form="draftArtifactForm = $event"
      @file-change="handleDraftArtifactFileChange"
      @drop="handleDraftArtifactDrop"
      @close="closeDraftArtifactModal"
      @submit="submitDraftArtifact"
    />
  </div>
</template>

<script setup>
import { computed, defineEmits, defineProps, defineExpose, onBeforeUnmount, ref } from "vue";
import { useAdminFkManager } from "@/composables/useAdminFkManager";
import { useAdminFkCrud } from "@/composables/useAdminFkCrud";
import { useAdminFkSearch } from "@/composables/useAdminFkSearch";
import { useAdminEditorFlow } from "@/composables/useAdminEditorFlow";
import { useAdminDraftArtifactFlow } from "@/composables/useAdminDraftArtifactFlow";
import { useAdminFeedbackToast } from "@/composables/useAdminFeedbackToast";
import { useAdminFkLabels } from "@/composables/useAdminFkLabels";
import { useAdminFormState } from "@/composables/useAdminFormState";
import { useAdminModalRegistry } from "@/composables/useAdminModalRegistry";
import { useAdminModalStack } from "@/composables/useAdminModalStack";
import { useAdminOptionLoaders } from "@/composables/useAdminOptionLoaders";
import { useAdminPresentationAdapters } from "@/composables/useAdminPresentationAdapters";
import { useAdminShellHelpers } from "@/composables/useAdminShellHelpers";
import { useAdminShellSearchActions } from "@/composables/useAdminShellSearchActions";
import { useAdminSyncActions } from "@/composables/useAdminSyncActions";
import { useAdminTableReset } from "@/composables/useAdminTableReset";
import { usePersonAssignmentsManager } from "@/composables/usePersonAssignmentsManager";
import { useAdminRecordViewer } from "@/composables/useAdminRecordViewer";
import { useAdminSearchFilters } from "@/composables/useAdminSearchFilters";
import { useAdminTableDataSource } from "@/composables/useAdminTableDataSource";
import { useProcessDefinitionActivationFlow } from "@/composables/useProcessDefinitionActivationFlow";
import { useProcessDefinitionManager } from "@/composables/useProcessDefinitionManager";
import { useAdminSubmitFlow } from "@/composables/useAdminSubmitFlow";
import { API_ROUTES } from "@/services/apiConfig";
import { adminSqlService } from "@/services/admin/AdminSqlService";
import { adminPresentationService } from "@/services/admin/AdminPresentationService";
import {
  definitionArtifactsTableFields,
  definitionRulesTableFields,
  definitionTriggersTableFields,
  FK_TABLE_MAP,
  fkViewerSummaryTableFields,
  formatTemplateArtifactFieldLabel,
  personAssignmentSections,
  personCargoTableFields,
  personContractTableFields,
  personRoleTableFields,
  PROCESS_DEFINITION_HIDDEN_FIELDS,
  PROCESS_INLINE_HIDDEN_FIELDS,
  processDefinitionActivationArtifactTableFields,
  processDefinitionActivationRuleTableFields,
  processDefinitionActivationTriggerTableFields,
  recordViewerSummaryTableFields,
  unassignedTemplateArtifactTableFields,
  vacantPositionTableFields
} from "@/services/admin/AdminTableManagerConfig";
import AdminFeedbackToast from "@/views/admin/components/AdminFeedbackToast.vue";
import AdminDefinitionArtifactsModal from "@/views/admin/components/AdminDefinitionArtifactsModal.vue";
import AdminDefinitionCreatedPromptModal from "@/views/admin/components/AdminDefinitionCreatedPromptModal.vue";
import AdminDefinitionRulesModal from "@/views/admin/components/AdminDefinitionRulesModal.vue";
import AdminDefinitionTriggersModal from "@/views/admin/components/AdminDefinitionTriggersModal.vue";
import AdminDeleteConfirmModal from "@/views/admin/components/AdminDeleteConfirmModal.vue";
import AdminDraftArtifactModal from "@/views/admin/components/AdminDraftArtifactModal.vue";
import AdminEditorModal from "@/views/admin/components/AdminEditorModal.vue";
import AdminFkViewerModal from "@/views/admin/components/AdminFkViewerModal.vue";
import AdminMainTableSection from "@/views/admin/components/AdminMainTableSection.vue";
import AdminFieldGroup from "@/views/admin/components/AdminFieldGroup.vue";
import AdminFkBrowserModal from "@/views/admin/components/AdminFkBrowserModal.vue";
import AdminFkCreateModal from "@/views/admin/components/AdminFkCreateModal.vue";
import AdminFkFilterModal from "@/views/admin/components/AdminFkFilterModal.vue";
import AdminFormActions from "@/views/admin/components/AdminFormActions.vue";
import AdminInputField from "@/views/admin/components/AdminInputField.vue";
import AdminPersonAssignmentsModal from "@/views/admin/components/AdminPersonAssignmentsModal.vue";
import AdminProcessDefinitionActivationModal from "@/views/admin/components/AdminProcessDefinitionActivationModal.vue";
import AdminProcessDefinitionVersioningModal from "@/views/admin/components/AdminProcessDefinitionVersioningModal.vue";
import AdminRecordViewerModal from "@/views/admin/components/AdminRecordViewerModal.vue";
import AdminSelectField from "@/views/admin/components/AdminSelectField.vue";
import AdminTableHeader from "@/views/admin/components/AdminTableHeader.vue";
import AdminUnassignedArtifactsSection from "@/views/admin/components/AdminUnassignedArtifactsSection.vue";
import AdminVacantPositionsSection from "@/views/admin/components/AdminVacantPositionsSection.vue";
import AdminButton from "@/views/admin/components/AdminButton.vue";
import AdminDataTable from "@/views/admin/components/AdminDataTable.vue";
import AdminLookupField from "@/views/admin/components/AdminLookupField.vue";
import AdminModalShell from "@/views/admin/components/AdminModalShell.vue";
import AdminSearchModal from "@/views/admin/components/AdminSearchModal.vue";
import AdminTableActions from "@/views/admin/components/AdminTableActions.vue";

const props = defineProps({
  table: {
    type: Object,
    default: null
  },
  allTables: {
    type: Array,
    default: () => []
  }
});
const emit = defineEmits(["go-back"]);

const rows = ref([]);
const loading = ref(false);
const error = ref("");
const feedbackToast = ref({
  visible: false,
  kind: "success",
  title: "",
  message: ""
});
const searchTerm = ref("");
const vacantSearchTerm = ref("");
const processDefinitionInlineFilters = ref({
  process_id: "",
  variation_key: "",
  status: ""
});
const processTargetRuleInlineFilters = ref({
  definition_execution_mode: "",
  definition_status: ""
});
const templateArtifactInlineFilters = ref({
  artifact_origin: "",
  artifact_stage: ""
});
const processDefinitionProcessOptions = ref([]);
const processDefinitionSeriesOptions = ref([]);
const editorMode = ref("create");
const formData = ref({});
const selectedRow = ref(null);
const modalError = ref("");
const fkDisplay = ref({});

const editorModal = ref(null);
const processDefinitionVersioningModal = ref(null);
const processDefinitionActivationModal = ref(null);
const definitionRulesModal = ref(null);
const definitionTriggersModal = ref(null);
const definitionArtifactsModal = ref(null);
const definitionArtifactsPromptModal = ref(null);
const draftArtifactModalRef = ref(null);
const deleteModal = ref(null);
const recordViewerModal = ref(null);
const personAssignmentsModal = ref(null);
const fkModal = ref(null);
const fkViewerModal = ref(null);
const fkFilterModal = ref(null);
const fkCreateModal = ref(null);
const searchInput = ref(null);
const skipFkReturnRestore = ref(false);
const fkCreateExitTarget = ref("none");
const fkNestedExitTarget = ref("none");
const recordViewerTable = ref(null);
const recordViewerRow = ref(null);
const recordViewerLoading = ref(false);
const recordViewerError = ref("");
const recordViewerRelatedSections = ref([]);
const processDefinitionVersioningSource = ref(null);
const processDefinitionCloneSourceId = ref("");
const processDefinitionActivationConfirmed = ref(false);
const processDefinitionActivationFromEditor = ref(false);
const processDefinitionActivationChecking = ref(false);
const processDefinitionActivationHasActiveRules = ref(true);
const processDefinitionActivationHasActiveTriggers = ref(true);
const processDefinitionActivationHasRequiredArtifacts = ref(true);
const processDefinitionActivationRequiresArtifacts = ref(false);
const processDefinitionActivationView = ref("definition");
const processDefinitionActivationRules = ref([]);
const processDefinitionActivationTriggers = ref([]);
const processDefinitionActivationArtifacts = ref([]);
const processDefinitionChecklistLoading = ref(false);
const processDefinitionChecklist = ref({
  rules: false,
  triggers: false,
  artifacts: false
});
const definitionRulesContext = ref(null);
const definitionRulesRows = ref([]);
const definitionRulesLoading = ref(false);
const definitionRulesError = ref("");
const definitionRulesEditId = ref("");
const definitionRulesForm = ref({
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
});
const definitionRulesLabels = ref({
  unit_id: "",
  unit_type_id: "",
  cargo_id: "",
  position_id: ""
});
const definitionTriggersContext = ref(null);
const definitionTriggersRows = ref([]);
const definitionTriggersLoading = ref(false);
const definitionTriggersError = ref("");
const definitionTriggersEditId = ref("");
const definitionTriggersForm = ref({
  trigger_mode: "automatic_by_term_type",
  term_type_id: "",
  is_active: "1"
});
const definitionTriggersLabels = ref({
  term_type_id: ""
});
const definitionArtifactsContext = ref(null);
const definitionArtifactsRows = ref([]);
const definitionArtifactsLoading = ref(false);
const definitionArtifactsError = ref("");
const definitionArtifactsEditId = ref("");
const definitionArtifactsForm = ref({
  template_artifact_id: "",
  usage_role: "manual_fill",
  creates_task: "1",
  is_required: "1",
  sort_order: "1"
});
const definitionArtifactsLabels = ref({
  template_artifact_id: ""
});
const definitionArtifactsPromptContext = ref(null);
const draftArtifactSeedOptions = ref([]);
const draftArtifactError = ref("");
const draftArtifactLoading = ref(false);
const draftArtifactEditId = ref("");
const draftArtifactExistingFiles = ref({
  pdf: "",
  docx: "",
  xlsx: "",
  pptx: ""
});
const draftArtifactForm = ref({
  template_seed_id: "",
  display_name: "",
  description: "",
  source_version: "1.0.0"
});
const draftArtifactFiles = ref({
  pdf: null,
  docx: null,
  xlsx: null,
  pptx: null
});

const fkTable = ref(null);
const fkRows = ref([]);
const fkSearch = ref("");
const fkLoading = ref(false);
const fkError = ref("");
const unitTypeByUnitId = ref({});
const fkField = ref("");
const fkSetter = ref(null);
const fkViewerRow = ref(null);
const fkFilters = ref({});
const fkCreateForm = ref({});
const fkCreateError = ref("");
const fkCreateLoading = ref(false);
const fkProcessDefinitionProcessOptions = ref([]);
const fkProcessDefinitionSeriesOptions = computed(() =>
  Array.from(
    new Set(
      (fkRows.value || [])
        .map((row) => (row?.variation_key ? String(row.variation_key).trim() : ""))
        .filter(Boolean)
    )
  ).sort((left, right) => left.localeCompare(right, "es"))
);
const fkPositionFilters = ref({
  unit_type_id: "",
  unit_id: "",
  cargo_id: ""
});
const fkUnitTypeOptions = ref([]);
const fkUnitOptions = ref([]);
const fkCargoOptions = ref([]);
const fkPositionFilterLoading = ref(false);

const processFilters = ref({
  parent_id: "",
  is_active: ""
});
const processFilterLabels = ref({
  parent_id: ""
});
const templateFilters = ref({
  name: "",
  slug: "",
  description: "",
  process_id: ""
});
const templateFilterLabels = ref({
  process_id: ""
});
const documentFilters = ref({
  task_id: "",
  status: ""
});
const documentFilterLabels = ref({
  task_id: ""
});
const unitPositionFilters = ref({
  unit_type_id: "",
  unit_id: "",
  cargo_id: ""
});
const unitPositionUnitTypeOptions = ref([]);
const unitPositionUnitOptions = ref([]);
const unitPositionCargoOptions = ref([]);
const unitPositionFilterLoading = ref(false);
const vacantPositionFilters = ref({
  unit_type_id: "",
  unit_id: "",
  cargo_id: "",
  position_type: ""
});
const vacantPositionUnitTypeOptions = ref([]);
const vacantPositionUnitOptions = ref([]);
const vacantPositionCargoOptions = ref([]);
const vacantPositionFilterLoading = ref(false);
const vacantPositionRows = ref([]);
const vacantPositionLoading = ref(false);
const vacantPositionError = ref("");
const unassignedTemplateArtifactSearch = ref("");
const unassignedTemplateArtifactFilters = ref({
  is_active: ""
});
const unassignedTemplateArtifactRows = ref([]);
const unassignedTemplateArtifactLoading = ref(false);
const unassignedTemplateArtifactError = ref("");
const templateSearchModal = ref(null);
const documentSearchModal = ref(null);
const processSearchModal = ref(null);
const unitPositionSearchModal = ref(null);
const personEditorId = ref("");
const personCargoRows = ref([]);
const positionMetaById = ref({});
const personCargoUnitByPositionId = ref({});
const personCargoError = ref("");
const personCargoForm = ref({
  position_id: "",
  start_date: "",
  end_date: "",
  is_current: "1"
});
const personCargoEditId = ref("");
const personCargoLabels = ref({
  position_id: ""
});
const personRoleRows = ref([]);
const personRoleError = ref("");
const personRoleForm = ref({
  role_id: "",
  unit_id: ""
});
const personRoleEditId = ref("");
const personRoleEditStartDate = ref("");
const personRoleLabels = ref({
  role_id: "",
  unit_id: ""
});
const personContractRows = ref([]);
const personContractError = ref("");
const personContractForm = ref({
  position_id: "",
  relation_type: "",
  dedication: "",
  start_date: "",
  end_date: "",
  status: "activo"
});
const personContractEditId = ref("");
const personContractLabels = ref({
  position_id: ""
});
const personAssignmentsLoading = ref(false);
const personAssignmentContext = ref(null);
const personAssignmentSection = ref("ocupaciones");

const editableFields = computed(() => {
  if (!props.table) {
    return [];
  }
  return props.table.fields.filter((field) =>
    !field.readOnly && !(isPersonTable.value && field.name === "password_hash")
  );
});

const formFields = computed(() => {
  if (!props.table) {
    return [];
  }
  if (props.table.table === "persons") {
    if (editorMode.value === "create") {
      return [
        ...editableFields.value,
        {
          name: "password",
          label: "Password",
          type: "password",
          required: true
        }
      ];
    }
    return editableFields.value;
  }
  return editableFields.value;
});
const visibleFormFields = computed(() => {
  if (!isProcessTable.value) {
    if (props.table?.table === "process_definition_versions") {
      return formFields.value.filter((field) => !PROCESS_DEFINITION_HIDDEN_FIELDS.has(field.name));
    }
    return formFields.value;
  }
  return formFields.value.filter((field) => !PROCESS_INLINE_HIDDEN_FIELDS.has(field.name));
});

const tableListFields = computed(() => {
  if (!props.table) {
    return [];
  }
  const fields = props.table.fields.filter((field) => !(isPersonTable.value && field.name === "password_hash"));
  let normalizedFields = fields;
  if (props.table.table === "process_definition_versions") {
    normalizedFields = normalizedFields.filter((field) => !PROCESS_DEFINITION_HIDDEN_FIELDS.has(field.name));
  }
  if (props.table.table === "template_artifacts") {
    const preferredOrder = [
      "id",
      "display_name",
      "available_formats",
      "template_code",
      "source_version",
      "storage_version"
    ];
    normalizedFields = [...fields].sort((left, right) => {
      const leftIndex = preferredOrder.indexOf(left.name);
      const rightIndex = preferredOrder.indexOf(right.name);
      const normalizedLeftIndex = leftIndex < 0 ? Number.MAX_SAFE_INTEGER : leftIndex;
      const normalizedRightIndex = rightIndex < 0 ? Number.MAX_SAFE_INTEGER : rightIndex;
      if (normalizedLeftIndex !== normalizedRightIndex) {
        return normalizedLeftIndex - normalizedRightIndex;
      }
      return fields.indexOf(left) - fields.indexOf(right);
    });
    normalizedFields = normalizedFields.map((field) => formatTemplateArtifactFieldLabel(field));
  }
  if (props.table.table === "process_target_rules") {
    const expandedFields = [];
    const processField = {
      name: "__process_name",
      label: "Proceso",
      type: "text"
    };
    normalizedFields.forEach((field) => {
      if (field.name === "process_definition_id") {
        expandedFields.push(processField);
      }
      expandedFields.push(field);
    });
    return expandedFields;
  }
  if (props.table.table !== "position_assignments") {
    return normalizedFields;
  }
  const plazaField = {
    name: "__plaza",
    label: "Plaza",
    type: "number"
  };
  const positionTypeField = {
    name: "__position_type",
    label: "Tipo de puesto",
    type: "text"
  };
  const positionIndex = normalizedFields.findIndex((field) => field.name === "position_id");
  if (positionIndex < 0) {
    return [...normalizedFields, plazaField, positionTypeField];
  }
  return [
    ...normalizedFields.slice(0, positionIndex + 1),
    plazaField,
    positionTypeField,
    ...normalizedFields.slice(positionIndex + 1)
  ];
});
const fkCreateFields = computed(() => {
  if (!fkTable.value?.fields) {
    return [];
  }
  return fkTable.value.fields.filter((field) => !field.readOnly && !field.virtual);
});
const fkViewerFields = computed(() => {
  if (!fkTable.value?.fields) {
    return [];
  }
  return fkTable.value.fields.filter((field) => !field.virtual);
});
const fkFilterFields = computed(() => {
  if (!fkTable.value?.fields) {
    return [];
  }
  if (fkTable.value.table === "process_definition_versions") {
    return [];
  }
  if (fkTable.value.table === "template_artifacts") {
    return [];
  }
  return fkTable.value.fields.filter((field) => !field.virtual);
});
const fkPrimaryListField = computed(() => {
  if (!fkTable.value?.fields) {
    return null;
  }
  if (fkTable.value.table === "process_definition_versions") {
    return fkTable.value.fields.find((field) => field.name === "process_id") || null;
  }
  if (fkTable.value.table === "template_artifacts") {
    return fkTable.value.fields.find((field) => field.name === "display_name") || null;
  }
  const displayFieldName = resolveDisplayField(fkTable.value);
  return fkTable.value.fields.find((field) => field.name === displayFieldName) || null;
});
const fkPrimaryListLabel = computed(() => fkPrimaryListField.value?.label || "Detalle");
const fkListExtraFields = computed(() => {
  if (!fkTable.value?.fields) {
    return [];
  }
  if (fkTable.value.table === "process_definition_versions") {
    return fkTable.value.fields.filter((field) =>
      ["variation_key", "definition_version", "name", "description", "status", "execution_mode"].includes(field.name)
    );
  }
  if (fkTable.value.table === "units") {
    return fkTable.value.fields.filter((field) => ["unit_type_id"].includes(field.name));
  }
  if (fkTable.value.table === "template_artifacts") {
    return fkTable.value.fields
      .filter((field) =>
        ["template_code", "source_version", "storage_version", "available_formats", "is_active"].includes(field.name)
      )
      .map((field) => formatTemplateArtifactFieldLabel(field));
  }
  if (fkTable.value.table === "unit_positions") {
    const unitField = fkTable.value.fields.find((field) => field.name === "unit_id");
    const slotField = fkTable.value.fields.find((field) => field.name === "slot_no");
    const extraFields = [];
    if (unitField) {
      extraFields.push(unitField);
    }
    extraFields.push({
      name: "__unit_type_id",
      label: "Tipo de unidad",
      type: "number"
    });
    if (slotField) {
      extraFields.push(slotField);
    } else {
      extraFields.push({
        name: "slot_no",
        label: "Plaza",
        type: "number"
      });
    }
    return extraFields;
  }
  return [];
});
const fkSearchTableFields = computed(() => [
  { name: "id", label: "ID" },
  { name: "__primary", label: fkPrimaryListLabel.value },
  ...fkListExtraFields.value
]);
const canCreateFkReference = computed(() =>
  Boolean(fkTable.value)
  && fkCreateFields.value.length > 0
);
const canOpenFkFilterModal = computed(() =>
  Boolean(fkTable.value)
  && fkFilterFields.value.length > 0
);
const isFkUnitPositions = computed(() => fkTable.value?.table === "unit_positions");
const isFkUnits = computed(() => fkTable.value?.table === "units");
const isFkProcessDefinitions = computed(() => fkTable.value?.table === "process_definition_versions");
const isFkTemplateArtifacts = computed(() => fkTable.value?.table === "template_artifacts");
const hasFkProcessDefinitionFilters = computed(() =>
  Boolean(
    fkFilters.value.process_id
    || fkFilters.value.variation_key?.trim()
    || fkFilters.value.execution_mode
  )
);
const hasFkTemplateArtifactFilters = computed(() =>
  Boolean(
    fkFilters.value.template_code?.trim()
    || fkFilters.value.storage_version?.trim()
    || fkFilters.value.is_active !== ""
  )
);

const isProcessTable = computed(() => props.table?.table === "processes");
const isProcessDefinitionFilterTable = computed(() => props.table?.table === "process_definition_versions");
const isTemplateSeedsTable = computed(() => props.table?.table === "template_seeds");
const isTemplateArtifactsTable = computed(() => props.table?.table === "template_artifacts");
const isPersonTable = computed(() => props.table?.table === "persons");
const isUnitPositionsTable = computed(() => props.table?.table === "unit_positions");
const isPositionAssignmentsTable = computed(() => props.table?.table === "position_assignments");
const isProcessDefinitionTemplatesTable = computed(() => props.table?.table === "process_definition_templates");
const isPositionFilterTable = computed(() =>
  isUnitPositionsTable.value || isPositionAssignmentsTable.value
);
const isProcessTargetRuleFilterTable = computed(() => props.table?.table === "process_target_rules");
const canManageDefinitionArtifacts = computed(() =>
  String(definitionArtifactsContext.value?.status || "") === "draft"
);
const canManageDefinitionRules = computed(() =>
  String(definitionRulesContext.value?.status || "") === "draft"
);
const canManageDefinitionTriggers = computed(() =>
  String(definitionTriggersContext.value?.status || "") === "draft"
);
const canSubmitDefinitionArtifact = computed(() =>
  canManageDefinitionArtifacts.value && Boolean(definitionArtifactsForm.value.template_artifact_id)
);
const canSubmitDefinitionRule = computed(() => {
  if (!canManageDefinitionRules.value) {
    return false;
  }
  const scopeType = String(definitionRulesForm.value.unit_scope_type || "");
  if (scopeType === "unit_type") {
    return Boolean(definitionRulesForm.value.unit_type_id);
  }
  if (scopeType === "unit_exact" || scopeType === "unit_subtree") {
    return Boolean(definitionRulesForm.value.unit_id || definitionRulesForm.value.position_id);
  }
  if (scopeType === "all_units") {
    return true;
  }
  return false;
});
const definitionTriggerRequiresTermType = computed(() =>
  String(definitionTriggersForm.value.trigger_mode || "") === "automatic_by_term_type"
);
const canSubmitDefinitionTrigger = computed(() => {
  if (!canManageDefinitionTriggers.value) {
    return false;
  }
  if (definitionTriggerRequiresTermType.value) {
    return Boolean(definitionTriggersForm.value.term_type_id);
  }
  return true;
});
const requiresDefinitionArtifacts = computed(() =>
  Number(selectedRow.value?.has_document) === 1 || Number(formData.value?.has_document) === 1
);
const processDefinitionActivationPrimaryAction = computed(() => {
  if (processDefinitionActivationChecking.value) {
    return null;
  }
  if (processDefinitionActivationView.value === "definition") {
    return {
      type: "edit_definition",
      label: "Editar definicion"
    };
  }
  if (processDefinitionActivationView.value === "rules") {
    return {
      type: "rules",
      label: processDefinitionActivationRules.value.length ? "Editar reglas" : "Agregar reglas"
    };
  }
  if (processDefinitionActivationView.value === "triggers") {
    return {
      type: "triggers",
      label: processDefinitionActivationTriggers.value.length ? "Editar disparadores" : "Agregar disparadores"
    };
  }
  if (processDefinitionActivationView.value === "artifacts") {
    return {
      type: "artifacts",
      label: processDefinitionActivationArtifacts.value.length ? "Editar paquetes" : "Agregar paquetes"
    };
  }
  return null;
});
const processDefinitionActivationPrimaryActionLabel = computed(() =>
  processDefinitionActivationPrimaryAction.value?.label || "Continuar"
);
const allProcessDefinitionActivationRequirementsMet = computed(() =>
  processDefinitionActivationHasActiveRules.value
  && processDefinitionActivationHasActiveTriggers.value
  && processDefinitionActivationHasRequiredArtifacts.value
);
const draftArtifactPreviewUrl = computed(() => {
  if (!draftArtifactForm.value.template_seed_id) {
    return "";
  }
  return API_ROUTES.ADMIN_SQL_TEMPLATE_SEED_PREVIEW(draftArtifactForm.value.template_seed_id);
});
const currentLoggedUser = computed(() => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const stored = localStorage.getItem("user");
    if (!stored) {
      return null;
    }
    const parsed = JSON.parse(stored);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
});
const hasUnitPositionFilters = computed(() =>
  Boolean(
    unitPositionFilters.value.unit_type_id
    || unitPositionFilters.value.unit_id
    || unitPositionFilters.value.cargo_id
  )
);
const hasProcessDefinitionInlineFilters = computed(() =>
  Boolean(
    processDefinitionInlineFilters.value.process_id
    || processDefinitionInlineFilters.value.status
    || processDefinitionInlineFilters.value.variation_key?.trim()
  )
);
const hasProcessTargetRuleInlineFilters = computed(() =>
  Boolean(
    processTargetRuleInlineFilters.value.definition_execution_mode
    || processTargetRuleInlineFilters.value.definition_status
  )
);
const hasTemplateArtifactInlineFilters = computed(() =>
  Boolean(
    templateArtifactInlineFilters.value.artifact_origin
    || templateArtifactInlineFilters.value.artifact_stage
  )
);
const hasVacantPositionFilters = computed(() =>
  Boolean(
    vacantSearchTerm.value
    || vacantPositionFilters.value.unit_type_id
    || vacantPositionFilters.value.unit_id
    || vacantPositionFilters.value.cargo_id
    || vacantPositionFilters.value.position_type
  )
);
const hasUnassignedTemplateArtifactFilters = computed(() =>
  Boolean(
    unassignedTemplateArtifactSearch.value.trim()
    || unassignedTemplateArtifactFilters.value.is_active
  )
);
const table = computed(() => props.table);
const tableHeaderTitle = computed(() => props.table?.label || "Administracion SQL");
const tableHeaderSubtitle = computed(() => {
  if (!props.table) {
    return "Gestiona registros en la base de datos.";
  }
  if (isPersonTable.value) {
    return `Gestiona registros en ${props.table.table} y sus asignaciones relacionadas.`;
  }
  return `Gestiona registros en ${props.table.table}.`;
});
const personAssignmentName = computed(() => {
  if (!personAssignmentContext.value) {
    return "";
  }
  return personAssignmentContext.value.name;
});
const personAssignmentMeta = computed(() => {
  if (!personAssignmentContext.value) {
    return "";
  }
  const pieces = [];
  if (personAssignmentContext.value.cedula) {
    pieces.push(`CI: ${personAssignmentContext.value.cedula}`);
  }
  if (personAssignmentContext.value.email) {
    pieces.push(personAssignmentContext.value.email);
  }
  return pieces.join(" | ");
});
const recordViewerFields = computed(() =>
  getViewerFieldsForTable(recordViewerTable.value)
);
const recordViewerDisplayRows = computed(() =>
  recordViewerFields.value.map((field) => ({
    id: field.name,
    field,
    label: field.label || field.name
  }))
);
const fkViewerDisplayRows = computed(() =>
  fkViewerFields.value.map((field) => ({
    id: field.name,
    field,
    label: field.label || field.name
  }))
);
const tableHeaderIcon = computed(() => {
  const tableName = props.table?.table || "";
  if (
    [
      "processes",
      "process_definition_versions",
      "process_target_rules",
      "tasks",
      "task_assignments",
      "template_artifacts",
      "process_definition_templates"
    ].includes(tableName)
  ) {
    return "check-double";
  }
  if (["persons", "unit_positions", "position_assignments"].includes(tableName)) {
    return "user";
  }
  if (["roles", "permissions", "role_permissions", "role_assignments"].includes(tableName)) {
    return "lock";
  }
  if (["vacancies", "aplications", "offers", "contracts", "vacancy_visibility"].includes(tableName)) {
    return "id-card";
  }
  if (
    [
      "documents",
      "document_versions",
      "document_signatures",
      "signature_types",
      "signature_statuses",
      "signature_request_statuses",
      "signature_flow_templates",
      "signature_flow_steps",
      "signature_flow_instances",
      "signature_requests"
    ].includes(tableName)
  ) {
    return "certificate";
  }
  return "info-circle";
});

const allTablesMap = computed(() =>
  Object.fromEntries(props.allTables.map((table) => [table.table, table]))
);
const fkLabelCache = ref({});
const processIdByDefinitionId = ref({});
const processDefinitionMetaById = ref({});
const inlineFkSuggestions = ref({});
const inlineFkLoading = ref({});
const inlineFkTouched = ref({});
const inlineFkActiveField = ref("");

const formatDateOnly = (value) => adminPresentationService.formatDateOnly(value);
const formatDateTimeHour = (value) => adminPresentationService.formatDateTimeHour(value);
const formatPositionType = (value) => adminPresentationService.formatPositionType(value);
const formatSelectOptionLabel = (field, value) => adminPresentationService.formatSelectOptionLabel(field, value);
const prettifyFormatName = (value) => adminPresentationService.prettifyFormatName(value);
const getFileNameFromObjectKey = (value) => adminPresentationService.getFileNameFromObjectKey(value);
const normalizeAvailableFormats = (value) => adminPresentationService.normalizeAvailableFormats(value);
const getAvailableFormatSections = (value) => adminPresentationService.getAvailableFormatSections(value);
const getAvailableFormatBadgeStyle = (mode, entry) => adminPresentationService.getAvailableFormatBadgeStyle(mode, entry);
const formatAvailableFormatsSummary = (value) => adminPresentationService.formatAvailableFormatsSummary(value);
const {
  getViewerFieldsForTable,
  rowKeyForTable,
  rowKey,
  buildPersonAssignmentContext,
  formatValueForTable,
  formatCell,
  formatDefinitionRuleCell,
  toDateInputValue,
  toDateTimeInputValue,
  normalizeComparableFormValue,
  getChangedPayloadKeys,
  getNextSemanticVersion
} = useAdminPresentationAdapters({
  props,
  allTablesMap,
  positionMetaById,
  processIdByDefinitionId,
  processDefinitionMetaById,
  fkLabelCache,
  resolveFkTable: (...args) => resolveFkTable(...args),
  isForeignKeyField: (...args) => isForeignKeyField(...args),
  getFkCachedLabel: (...args) => getFkCachedLabel(...args),
  formatDateOnly,
  formatDateTimeHour,
  formatPositionType,
  formatSelectOptionLabel,
  formatAvailableFormatsSummary
});

const {
  pushModalOrigin,
  peekModalOrigin,
  clearModalOrigins,
  popModalOrigin,
  resolveModalElement,
  isModalShown,
  hideAndRemember
} = useAdminModalStack();
const {
  ensureEditorInstance,
  ensureProcessDefinitionVersioningInstance,
  ensureProcessDefinitionActivationInstance,
  ensureDefinitionRulesInstance,
  ensureDefinitionTriggersInstance,
  ensureDeleteInstance,
  ensureRecordViewerInstance,
  ensurePersonAssignmentsInstance,
  ensureDefinitionArtifactsInstance,
  ensureDefinitionArtifactsPromptInstance,
  ensureFkInstance,
  ensureFkCreateInstance,
  ensureFkViewerInstance,
  ensureFkFilterInstance,
  ensureProcessSearchInstance,
  ensureDocumentSearchInstance,
  ensureUnitPositionSearchInstance,
  restoreReturnModal,
  hideParentModalsForFk,
  hideParentModalsForRecordViewer,
  getPersonAssignmentsInstance,
  getDefinitionRulesInstance,
  getDefinitionTriggersInstance,
  getDefinitionArtifactsInstance,
  getDefinitionArtifactsPromptInstance,
  getRecordViewerInstance,
  getFkInstance,
  getFkViewerInstance,
  getFkFilterInstance,
  getFkCreateInstance,
  getProcessDefinitionActivationInstance,
  getEditorInstance,
  getProcessSearchInstance,
  getTemplateSearchInstance,
  getDocumentSearchInstance,
  getUnitPositionSearchInstance,
  getDeleteInstance,
  getProcessDefinitionVersioningInstance
} = useAdminModalRegistry({
  resolveModalElement,
  peekModalOrigin,
  popModalOrigin,
  hideAndRemember,
  props,
  selectedRow,
  editorModal,
  processDefinitionVersioningModal,
  processDefinitionActivationModal,
  definitionRulesModal,
  definitionTriggersModal,
  definitionArtifactsModal,
  definitionArtifactsPromptModal,
  deleteModal,
  recordViewerModal,
  personAssignmentsModal,
  fkModal,
  fkViewerModal,
  fkFilterModal,
  fkCreateModal,
  templateSearchModal,
  documentSearchModal,
  processSearchModal,
  unitPositionSearchModal,
  skipFkReturnRestore,
  fkCreateExitTarget,
  fkNestedExitTarget,
  processDefinitionVersioningSource,
  processDefinitionActivationConfirmed,
  processDefinitionActivationFromEditor,
  processDefinitionActivationChecking,
  processDefinitionActivationHasActiveRules,
  processDefinitionActivationHasActiveTriggers,
  processDefinitionActivationHasRequiredArtifacts,
  processDefinitionActivationRequiresArtifacts,
  processDefinitionActivationView,
  processDefinitionActivationRules,
  processDefinitionActivationTriggers,
  processDefinitionActivationArtifacts,
  definitionRulesError,
  definitionRulesContext,
  definitionRulesRows,
  definitionTriggersError,
  definitionTriggersContext,
  definitionTriggersRows,
  definitionArtifactsError,
  definitionArtifactsEditId,
  definitionArtifactsContext,
  definitionArtifactsRows,
  definitionArtifactsPromptContext,
  refreshProcessDefinitionChecklist: (...args) => refreshProcessDefinitionChecklist(...args),
  openProcessDefinitionActivationModal: (...args) => openProcessDefinitionActivationModal(...args),
  resetDefinitionRulesForm: (...args) => resetDefinitionRulesForm(...args),
  resetDefinitionTriggersForm: (...args) => resetDefinitionTriggersForm(...args),
  resetDefinitionArtifactsForm: (...args) => resetDefinitionArtifactsForm(...args)
});

const {
  loadUnitPositionUnitTypeOptions,
  loadUnitPositionCargoOptions,
  loadUnitPositionUnitOptions,
  loadVacantPositionUnitTypeOptions,
  loadVacantPositionCargoOptions,
  loadProcessDefinitionProcessOptions,
  loadProcessDefinitionSeriesOptions,
  loadVacantPositionUnitOptions,
  loadFkUnitTypeOptions,
  loadFkCargoOptions,
  loadFkUnitOptions,
  loadFkProcessDefinitionProcessOptions
} = useAdminOptionLoaders({
  unitPositionFilters,
  unitPositionFilterLoading,
  unitPositionUnitTypeOptions,
  unitPositionUnitOptions,
  unitPositionCargoOptions,
  vacantPositionFilters,
  vacantPositionFilterLoading,
  vacantPositionUnitTypeOptions,
  vacantPositionUnitOptions,
  vacantPositionCargoOptions,
  processDefinitionProcessOptions,
  processDefinitionSeriesOptions,
  fkPositionFilters,
  fkPositionFilterLoading,
  fkUnitTypeOptions,
  fkUnitOptions,
  fkCargoOptions,
  fkProcessDefinitionProcessOptions,
  isFkUnitPositions,
  isFkUnits
});

const {
  resetForm,
  resetFkCreateForm,
  resetFkFilters,
  buildFormFromRow,
  isFieldLocked,
  handleSelectChange,
  isInputField,
  inputType,
  buildPayload
} = useAdminFormState({
  props,
  formFields,
  editableFields,
  formData,
  fkDisplay,
  fkCreateFields,
  fkCreateForm,
  fkFilterFields,
  fkFilters,
  fkTable,
  editorMode,
  isPersonTable,
  isForeignKeyField: (...args) => isForeignKeyField(...args),
  toDateInputValue,
  toDateTimeInputValue,
  resetInlineFkState: (...args) => resetInlineFkState(...args)
});

const isForeignKeyField = (field) => FK_TABLE_MAP[field.name] !== undefined;

const resolveFkTable = (fieldName) => FK_TABLE_MAP[fieldName] || null;

const resolveDisplayField = (tableMeta) => {
  if (!tableMeta) {
    return null;
  }
  if (tableMeta.table === "template_artifacts") {
    return "display_name";
  }
  if (tableMeta.table === "template_seeds") {
    return "display_name";
  }
  const preferred = ["name", "title", "email", "label", "code", "slug"];
  const match = preferred.find((field) => tableMeta.fields.some((meta) => meta.name === field));
  return match || tableMeta.fields.find((meta) => meta.name !== "id")?.name || "id";
};

const {
  setFkLabel,
  fetchFkLabel,
  prefetchFkLabelsForRows,
  prefetchProcessLabelsForDefinitionRows,
  prefetchProcessDefinitionMeta,
  prefetchUnitTypeForUnitPositions,
  prefetchPositionMetaForAssignments,
  getFkCachedLabel
} = useAdminFkLabels({
  fkLabelCache,
  allTablesMap,
  processIdByDefinitionId,
  processDefinitionMetaById,
  unitTypeByUnitId,
  positionMetaById,
  resolveFkTable,
  resolveDisplayField
});

const formatFkOptionLabel = (tableName, row) =>
  adminPresentationService.formatFkOptionLabel(
    tableName,
    row,
    (fkTableName, fkValue) => getFkCachedLabel(fkTableName, fkValue)
  );

const getFkTableField = (fieldName) => {
  if (!fkTable.value?.fields || !fieldName) {
    return null;
  }
  return fkTable.value.fields.find((field) => field.name === fieldName) || null;
};

const getFkTableFieldOptions = (fieldName) => getFkTableField(fieldName)?.options || [];
const {
  resetInlineFkState,
  cancelInlineFkClose,
  scheduleInlineFkClose,
  shouldShowInlineFkSuggestions,
  formatInlineFkOption,
  clearInlineFkSelection,
  applyInlineFkSelection,
  fetchInlineFkSuggestions,
  openInlineFkSuggestions,
  handleInlineFkInput,
  updateInlineFkDisplay,
  selectInlineFkSuggestion
} = useAdminFkManager({
  formData,
  fkDisplay,
  inlineFkSuggestions,
  inlineFkLoading,
  inlineFkTouched,
  inlineFkActiveField,
  visibleFormFields,
  isFieldLocked: (...args) => isFieldLocked(...args),
  resolveFkTable,
  formatFkOptionLabel
});

const resetFkUnitPositionFilters = () => {
  fkPositionFilters.value = {
    unit_type_id: "",
    unit_id: "",
    cargo_id: ""
  };
  fkUnitTypeOptions.value = [];
  fkUnitOptions.value = [];
  fkCargoOptions.value = [];
};

const clearFkUnitPositionFilters = async () => {
  fkPositionFilters.value = {
    unit_type_id: "",
    unit_id: "",
    cargo_id: ""
  };
  fkUnitOptions.value = [];
  await fetchFkRows();
};

const handleFkUnitTypeChange = async () => {
  fkPositionFilters.value = {
    ...fkPositionFilters.value,
    unit_id: ""
  };
  await loadFkUnitOptions();
  await fetchFkRows();
};

const handleFkUnitChange = async () => {
  await fetchFkRows();
};

const handleFkCargoChange = async () => {
  await fetchFkRows();
};

const handleFkProcessDefinitionFilterChange = async () => {
  await fetchFkRows();
};

const clearFkProcessDefinitionFilters = async () => {
  fkFilters.value = {
    ...fkFilters.value,
    process_id: "",
    variation_key: "",
    status: "active",
    execution_mode: ""
  };
  await fetchFkRows();
};

const handleFkTemplateArtifactFilterChange = async () => {
  await fetchFkRows();
};

const clearFkTemplateArtifactFilters = async () => {
  fkFilters.value = {
    ...fkFilters.value,
    template_code: "",
    storage_version: "",
    is_active: ""
  };
  await fetchFkRows();
};
const {
  refreshFormFkDisplayLabels,
  buildFkFilterParams,
  buildFkCreatePayload,
  buildKeys,
  handleGoBack,
  formatFkViewerValue,
  formatRecordViewerValue,
  openDelete,
  openProcessDefinitionVersioningModal,
  closeProcessDefinitionVersioningModal
} = useAdminShellHelpers({
  props,
  emit,
  formFields,
  formData,
  fkDisplay,
  fkFilters,
  fkCreateFields,
  fkCreateForm,
  resolveFkTable,
  isForeignKeyField,
  fetchFkLabel,
  getFkCachedLabel,
  fetchRows: (...args) => fetchRows(...args),
  selectedRow,
  ensureDeleteInstance,
  getDeleteInstance,
  processDefinitionVersioningSource,
  ensureProcessDefinitionVersioningInstance,
  getProcessDefinitionVersioningInstance,
  fkTable,
  recordViewerTable,
  formatValueForTable
});

const {
  hideFeedbackToast,
  showFeedbackToast
} = useAdminFeedbackToast({
  feedbackToast
});

const {
  clearProcessDefinitionInlineFilters,
  clearProcessTargetRuleInlineFilters,
  clearTemplateArtifactInlineFilters,
  debouncedFkSearch,
  debouncedSearch,
  debouncedVacantSearch,
  debouncedUnassignedTemplateArtifactSearch,
  handleSearchAction
} = useAdminShellSearchActions({
  props,
  searchInput,
  processDefinitionInlineFilters,
  processTargetRuleInlineFilters,
  templateArtifactInlineFilters,
  fetchRows: (...args) => fetchRows(...args),
  loadVacantPositions: (...args) => loadVacantPositions(...args),
  loadUnassignedTemplateArtifacts: (...args) => loadUnassignedTemplateArtifacts(...args),
  fetchFkRows: (...args) => fetchFkRows(...args),
  openProcessSearch: (...args) => openProcessSearch(...args),
  openDocumentSearch: (...args) => openDocumentSearch(...args),
  openUnitPositionSearch: (...args) => openUnitPositionSearch(...args),
  isPositionFilterTable
});

const {
  loadDraftArtifactSeedOptions,
  openDraftArtifactModal,
  closeDraftArtifactModal,
  handleDraftArtifactFileChange,
  handleDraftArtifactDrop,
  getDraftArtifactFileLabel,
  submitDraftArtifact
} = useAdminDraftArtifactFlow({
  props,
  draftArtifactModalRef,
  draftArtifactEditId,
  draftArtifactError,
  draftArtifactLoading,
  draftArtifactForm,
  draftArtifactExistingFiles,
  draftArtifactFiles,
  draftArtifactSeedOptions,
  currentLoggedUser,
  fetchRows: (...args) => fetchRows(...args),
  showFeedbackToast,
  normalizeAvailableFormats,
  getFileNameFromObjectKey,
  resolveModalElement
});

const {
  syncTemplateArtifactsFromDist,
  syncTemplateSeedsFromSource,
  applyUnitRelationDefaults
} = useAdminSyncActions({
  props,
  loading,
  error,
  formData,
  fkDisplay,
  allTablesMap,
  isTemplateArtifactsTable,
  isTemplateSeedsTable,
  fetchRows: (...args) => fetchRows(...args),
  loadDraftArtifactSeedOptions: (...args) => loadDraftArtifactSeedOptions(...args),
  showFeedbackToast,
  resolveDisplayField,
  setFkLabel
});

const {
  fetchFkRows,
  openFkSearch,
  applyFkSelection,
  selectFkRow,
  formatFkListCell,
  formatFkPrimaryCell
} = useAdminFkSearch({
  formData,
  fkDisplay,
  fkTable,
  fkRows,
  fkSearch,
  fkLoading,
  fkError,
  fkField,
  fkSetter,
  fkViewerRow,
  fkCreateForm,
  fkCreateError,
  fkCreateExitTarget,
  fkNestedExitTarget,
  unitTypeByUnitId,
  fkPositionFilters,
  resetFkFilters,
  resetFkUnitPositionFilters,
  loadFkUnitTypeOptions,
  loadFkCargoOptions,
  loadFkProcessDefinitionProcessOptions,
  resolveFkTable,
  resolveDisplayField,
  isFkUnitPositions,
  isFkUnits,
  isForeignKeyField,
  prefetchFkLabelsForRows,
  prefetchUnitTypeForUnitPositions,
  buildFkFilterParams,
  getFkCachedLabel,
  formatCell,
  fkPrimaryListField,
  ensureFkInstance,
  getFkInstance,
  hideParentModals: hideParentModalsForFk,
  allTablesMap
});

const {
  openFkViewer,
  closeFkViewer,
  openFkFilterModal,
  cancelFkFilter,
  clearFkFilters,
  applyFkFilters,
  openFkCreate,
  cancelFkCreate,
  submitFkCreate
} = useAdminFkCrud({
  fkTable,
  fkFilters,
  fkCreateFields,
  fkCreateForm,
  fkCreateError,
  fkCreateLoading,
  fkCreateExitTarget,
  fkNestedExitTarget,
  skipFkReturnRestore,
  canCreateFkReference,
  resetFkFilters,
  resetFkCreateForm,
  buildFkCreatePayload,
  applyFkSelection,
  fetchFkRows,
  ensureFkInstance,
  getFkInstance,
  ensureFkViewerInstance,
  getFkViewerInstance,
  ensureFkFilterInstance,
  getFkFilterInstance,
  ensureFkCreateInstance,
  getFkCreateInstance
});

const {
  openRecordViewer,
  closeRecordViewer
} = useAdminRecordViewer({
  recordViewerTable,
  recordViewerRow,
  recordViewerLoading,
  recordViewerError,
  recordViewerRelatedSections,
  allTablesMap,
  getViewerFieldsForTable,
  isForeignKeyField,
  prefetchFkLabelsForRows,
  prefetchProcessLabelsForDefinitionRows,
  prefetchProcessDefinitionMeta,
  ensureRecordViewerInstance,
  getRecordViewerInstance,
  hideParentModals: hideParentModalsForRecordViewer
});

const hideDefinitionArtifactsPromptModal = () => {
  definitionArtifactsPromptInstance?.hide();
  definitionArtifactsPromptContext.value = null;
};

const hideProcessDefinitionActivationModal = () => {
  processDefinitionActivationInstance?.hide();
};

const {
  resetPersonCargoForm,
  clearPersonCargoPosition,
  resetPersonRoleForm,
  clearPersonRoleField,
  resetPersonContractForm,
  clearPersonContractPosition,
  resetPersonAssignments,
  prefetchPersonCargoUnitLabels,
  formatPersonCargoUnit,
  loadPersonAssignments,
  openPersonAssignments,
  openPersonCargoFkSearch,
  openPersonRoleFkSearch,
  openPersonContractFkSearch,
  startPersonCargoEdit,
  startPersonRoleEdit,
  startPersonContractEdit,
  deletePersonCargo,
  deletePersonRole,
  deletePersonContract,
  submitPersonCargoCreate,
  submitPersonRoleCreate,
  submitPersonContractCreate
} = usePersonAssignmentsManager({
  personEditorId,
  personAssignmentContext,
  personAssignmentSection,
  personAssignmentsLoading,
  personCargoRows,
  personCargoUnitByPositionId,
  personRoleRows,
  personContractRows,
  personCargoError,
  personRoleError,
  personContractError,
  personCargoEditId,
  personCargoForm,
  personCargoLabels,
  personRoleEditId,
  personRoleEditStartDate,
  personRoleForm,
  personRoleLabels,
  personContractEditId,
  personContractForm,
  personContractLabels,
  fkTable,
  buildPersonAssignmentContext,
  ensurePersonAssignmentsInstance,
  getPersonAssignmentsInstance,
  openFkSearch,
  resolveDisplayField,
  formatCell,
  toDateInputValue,
  prefetchFkLabelsForRows,
  fetchFkLabel,
  getFkCachedLabel
});

const {
  resetDefinitionArtifactsForm,
  resetDefinitionRulesForm,
  resetDefinitionTriggersForm,
  formatDefinitionRuleSummary,
  handleDefinitionRuleScopeChange,
  refreshProcessDefinitionChecklist,
  loadDefinitionRules,
  openDefinitionRulesManager,
  closeDefinitionRulesManager,
  acceptDefinitionRulesManager,
  confirmDefinitionRulesPrompt,
  openDefinitionRulesFromEditor,
  openDefinitionRulesFromActivation,
  openDefinitionArtifactsFromActivation,
  openDefinitionRuleFkSearch,
  clearDefinitionRuleField,
  startDefinitionRuleEdit,
  submitDefinitionRule,
  deleteDefinitionRule,
  loadDefinitionTriggers,
  openDefinitionTriggersManager,
  closeDefinitionTriggersManager,
  acceptDefinitionTriggersManager,
  confirmDefinitionTriggersPrompt,
  openDefinitionTriggersFromEditor,
  openDefinitionTriggersFromActivation,
  handleDefinitionTriggerModeChange,
  openDefinitionTriggerFkSearch,
  clearDefinitionTriggerTermType,
  startDefinitionTriggerEdit,
  submitDefinitionTrigger,
  deleteDefinitionTrigger,
  loadDefinitionArtifacts,
  openDefinitionArtifactsManager,
  closeDefinitionArtifactsManager,
  acceptDefinitionArtifactsManager,
  openDefinitionArtifactsPrompt,
  closeDefinitionArtifactsPrompt,
  confirmDefinitionArtifactsPrompt,
  openDefinitionArtifactsFromEditor,
  openDefinitionArtifactFkSearch,
  clearDefinitionArtifactSelection,
  startDefinitionArtifactEdit,
  submitDefinitionArtifact,
  deleteDefinitionArtifact
} = useProcessDefinitionManager({
  props,
  editorMode,
  selectedRow,
  getEditorInstance,
  definitionRulesContext,
  definitionRulesRows,
  definitionRulesLoading,
  definitionRulesError,
  definitionRulesEditId,
  definitionRulesForm,
  definitionRulesLabels,
  definitionTriggersContext,
  definitionTriggersRows,
  definitionTriggersLoading,
  definitionTriggersError,
  definitionTriggersEditId,
  definitionTriggersForm,
  definitionTriggersLabels,
  definitionArtifactsContext,
  definitionArtifactsRows,
  definitionArtifactsLoading,
  definitionArtifactsError,
  definitionArtifactsEditId,
  definitionArtifactsForm,
  definitionArtifactsLabels,
  definitionArtifactsPromptContext,
  processDefinitionChecklistLoading,
  processDefinitionChecklist,
  definitionTriggerRequiresTermType,
  canManageDefinitionRules,
  canManageDefinitionTriggers,
  canManageDefinitionArtifacts,
  canSubmitDefinitionRule,
  canSubmitDefinitionTrigger,
  clearModalOrigins,
  pushModalOrigin,
  closeProcessDefinitionActivationModal: hideProcessDefinitionActivationModal,
  closeDefinitionArtifactsPrompt: hideDefinitionArtifactsPromptModal,
  openFkSearch,
  resolveFkTable,
  formatFkOptionLabel,
  fetchFkLabel,
  getFkCachedLabel,
  formatCell,
  formatDateOnly,
  prefetchFkLabelsForRows,
  ensureDefinitionRulesInstance,
  ensureDefinitionTriggersInstance,
  ensureDefinitionArtifactsInstance,
  ensureDefinitionArtifactsPromptInstance,
  getDefinitionRulesInstance,
  getDefinitionTriggersInstance,
  getDefinitionArtifactsInstance,
  getDefinitionArtifactsPromptInstance
});

const {
  fetchUnitPositionsForCurrentFilters,
  loadVacantPositions,
  loadUnassignedTemplateArtifacts,
  fetchRows
} = useAdminTableDataSource({
  props,
  rows,
  loading,
  error,
  searchTerm,
  processFilters,
  documentFilters,
  processDefinitionInlineFilters,
  processTargetRuleInlineFilters,
  templateArtifactInlineFilters,
  unitPositionFilters,
  vacantSearchTerm,
  vacantPositionFilters,
  vacantPositionRows,
  vacantPositionLoading,
  vacantPositionError,
  unassignedTemplateArtifactSearch,
  unassignedTemplateArtifactFilters,
  unassignedTemplateArtifactRows,
  unassignedTemplateArtifactLoading,
  unassignedTemplateArtifactError,
  personEditorId,
  personAssignmentContext,
  isPositionFilterTable,
  isUnitPositionsTable,
  isPositionAssignmentsTable,
  isProcessDefinitionTemplatesTable,
  isPersonTable,
  prefetchFkLabelsForRows,
  prefetchProcessLabelsForDefinitionRows,
  prefetchPositionMetaForAssignments,
  prefetchUnitTypeForUnitPositions,
  isForeignKeyField,
  buildPersonAssignmentContext,
  resetPersonAssignments
});

const {
  loadProcessDefinitionActivationDetail,
  openProcessDefinitionActivationModal,
  closeProcessDefinitionActivationModal,
  openProcessDefinitionActivationForRow,
  cancelProcessDefinitionActivation,
  openDefinitionEditorFromActivation,
  handleProcessDefinitionActivationPrimaryAction,
  confirmProcessDefinitionActivation,
  cancelProcessDefinitionEdit,
  promoteProcessDefinitionToNewVersion
} = useProcessDefinitionActivationFlow({
  props,
  formData,
  fkDisplay,
  editorMode,
  selectedRow,
  modalError,
  editorModal,
  getEditorInstance,
  processDefinitionVersioningSource,
  processDefinitionCloneSourceId,
  processDefinitionChecklistLoading,
  processDefinitionChecklist,
  processDefinitionActivationConfirmed,
  processDefinitionActivationFromEditor,
  processDefinitionActivationChecking,
  processDefinitionActivationHasActiveRules,
  processDefinitionActivationHasActiveTriggers,
  processDefinitionActivationHasRequiredArtifacts,
  processDefinitionActivationRequiresArtifacts,
  processDefinitionActivationView,
  processDefinitionActivationRules,
  processDefinitionActivationTriggers,
  processDefinitionActivationArtifacts,
  clearModalOrigins,
  isModalShown,
  ensureProcessDefinitionActivationInstance,
  getProcessDefinitionActivationInstance,
  buildFormFromRow,
  refreshFormFkDisplayLabels,
  prefetchFkLabelsForRows,
  normalizeComparableFormValue,
  getNextSemanticVersion,
  setFkLabel,
  formatFkOptionLabel,
  openEdit: (...args) => openEdit(...args),
  openDefinitionRulesFromActivation,
  openDefinitionTriggersFromActivation,
  openDefinitionArtifactsFromActivation,
  submitForm: async () => submitForm()
});

const {
  openCreate,
  handlePrimaryCreateAction,
  openEdit,
  startProcessDefinitionTemplateFromArtifact,
  startProcessDefinitionVersioning
} = useAdminEditorFlow({
  props,
  formData,
  fkDisplay,
  editorMode,
  selectedRow,
  modalError,
  processDefinitionCloneSourceId,
  processDefinitionChecklistLoading,
  processDefinitionChecklist,
  isTemplateArtifactsTable,
  isProcessDefinitionTemplatesTable,
  resetInlineFkState,
  closeProcessDefinitionVersioningModal: (...args) => closeProcessDefinitionVersioningModal(...args),
  resetForm,
  applyUnitRelationDefaults,
  ensureEditorInstance,
  getEditorInstance,
  openDraftArtifactModal,
  showFeedbackToast,
  buildFormFromRow,
  refreshFormFkDisplayLabels,
  refreshProcessDefinitionChecklist,
  setFkLabel,
  formatFkOptionLabel,
  getNextSemanticVersion
});

const {
  openProcessSearch,
  openDocumentSearch,
  openUnitPositionSearch,
  applyProcessFilter,
  clearProcessFilter,
  clearProcessParentFilter,
  applyTemplateFilter,
  clearTemplateFilter,
  clearTemplateProcessFilter,
  applyDocumentFilter,
  clearDocumentFilter,
  clearDocumentTaskFilter,
  refreshUnitPositionScope,
  handleUnitPositionTypeChange,
  handleUnitPositionUnitChange,
  handleUnitPositionCargoChange,
  applyUnitPositionFilter,
  clearUnitPositionFilter,
  clearUnitPositionInlineFilters,
  clearVacantPositionFilters,
  clearUnassignedTemplateArtifactFilters,
  handleVacantPositionTypeChange,
  handleVacantPositionUnitChange,
  handleVacantPositionCargoChange,
  handleVacantPositionTypeFilterChange,
  deactivateVacantPosition,
  assignVacantPosition,
  openTemplateFkSearch,
  openDocumentFkSearch,
  openProcessFkSearch
} = useAdminSearchFilters({
  props,
  formData,
  fkDisplay,
  fkTable,
  processFilters,
  processFilterLabels,
  templateFilters,
  templateFilterLabels,
  documentFilters,
  documentFilterLabels,
  unitPositionFilters,
  unitPositionUnitOptions,
  unitPositionUnitTypeOptions,
  unitPositionCargoOptions,
  vacantSearchTerm,
  vacantPositionFilters,
  vacantPositionUnitOptions,
  unassignedTemplateArtifactSearch,
  unassignedTemplateArtifactFilters,
  getTemplateSearchInstance,
  getProcessSearchInstance,
  getDocumentSearchInstance,
  getUnitPositionSearchInstance,
  isUnitPositionsTable,
  isPositionAssignmentsTable,
  isPositionFilterTable,
  fetchRows,
  loadVacantPositions,
  loadUnassignedTemplateArtifacts,
  loadUnitPositionUnitTypeOptions,
  loadUnitPositionCargoOptions,
  loadUnitPositionUnitOptions,
  loadVacantPositionUnitOptions,
  openFkSearch,
  resolveDisplayField,
  fetchFkLabel,
  getFkCachedLabel,
  openCreate,
  ensureProcessSearchInstance,
  ensureDocumentSearchInstance,
  ensureUnitPositionSearchInstance
});

const {
  submitForm,
  confirmDelete
} = useAdminSubmitFlow({
  props,
  rows,
  error,
  modalError,
  formData,
  editorMode,
  selectedRow,
  processDefinitionCloneSourceId,
  processDefinitionActivationConfirmed,
  processDefinitionActivationFromEditor,
  isPersonTable,
  buildPayload,
  buildKeys,
  adminSqlService,
  getChangedPayloadKeys,
  getEditorInstance,
  fetchRows,
  personEditorId,
  resetPersonAssignments,
  openPersonAssignments,
  openDefinitionArtifactsPrompt,
  openProcessDefinitionActivationModal,
  openProcessDefinitionVersioningModal,
  showFeedbackToast,
  getDeleteInstance
});


useAdminTableReset({
  props,
  isModalShown,
  personAssignmentsModal,
  unitPositionSearchModal,
  getPersonAssignmentsInstance,
  getUnitPositionSearchInstance,
  resetInlineFkState,
  resetForm,
  resetPersonAssignments,
  positionMetaById,
  vacantSearchTerm,
  vacantPositionRows,
  vacantPositionError,
  vacantPositionLoading,
  processFilters,
  processFilterLabels,
  templateFilters,
  templateFilterLabels,
  documentFilters,
  documentFilterLabels,
  unitPositionFilters,
  vacantPositionFilters,
  unitPositionUnitTypeOptions,
  unitPositionUnitOptions,
  unitPositionCargoOptions,
  vacantPositionUnitTypeOptions,
  vacantPositionUnitOptions,
  vacantPositionCargoOptions,
  unassignedTemplateArtifactSearch,
  unassignedTemplateArtifactFilters,
  unassignedTemplateArtifactRows,
  unassignedTemplateArtifactError,
  unassignedTemplateArtifactLoading,
  processDefinitionInlineFilters,
  processTargetRuleInlineFilters,
  templateArtifactInlineFilters,
  processDefinitionProcessOptions,
  processDefinitionSeriesOptions,
  isPositionFilterTable,
  isPositionAssignmentsTable,
  isProcessDefinitionFilterTable,
  loadUnitPositionUnitTypeOptions,
  loadUnitPositionCargoOptions,
  loadVacantPositionUnitTypeOptions,
  loadVacantPositionCargoOptions,
  loadProcessDefinitionProcessOptions,
  loadProcessDefinitionSeriesOptions,
  fetchRows
});

onBeforeUnmount(() => {
  resetInlineFkState();
});

defineExpose({
  openCreate,
  openDraftArtifactModal
});
</script>

<style scoped src="./AdminTableManager.css"></style>
