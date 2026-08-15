<template>
  <div class="admin-table-manager">
    <AdminFeedbackToast
      :visible="feedbackToast.visible"
      :kind="feedbackToast.kind"
      :title="feedbackToast.title"
      :message="feedbackToast.message"
      @close="hideFeedbackToast"
    />

    <ProcessLaunchModal
      ref="processLaunchModal"
      @notify="showFeedbackToast"
      @changed="fetchRows"
    />

    <ProcessDefinitionLaunchModal
      ref="processDefinitionLaunchModal"
      @notify="showFeedbackToast"
      @changed="fetchRows"
      @close="handleProcessGraphLaunchClose"
    />

    <AdminTemplateVersionDialog
      :open="templateVersionDialog.open"
      :template="templateVersionDialog.template"
      :busy="templateVersionBusy"
      :guided="templateVersionDialog.mode === 'guided'"
      @confirm="handleVersionDialogConfirm"
      @close="closeTemplateVersionDialog"
    />

    <div v-if="table && siblingTabs.length" class="admin-related-tabs">
      <ProfileSubsectionTabs
        :model-value="activeSiblingTab"
        :tabs="siblingTabs"
        aria-label="Tablas hermanas"
        @update:model-value="$emit('select-sibling-tab', $event)"
      />
    </div>

    <AdminTableHeader
      v-if="!(isProcessesTable && processGraphMode)"
      :table-header-icon="tableHeaderIcon"
      :table-header-title="tableHeaderTitle"
      :table-header-subtitle="tableHeaderSubtitle"
      :table="table"
      :loading="loading"
      :is-template-seeds-table="isTemplateSeedsTable"
      :is-process-definitions-table="isProcessDefinitionFilterTable"
      :can-create="canCreateCurrentTable"
      :can-update="canUpdateCurrentTable"
      @go-back="handleGoBack"
      @sync-template-seeds="syncTemplateSeedsFromSource"
      @create="handlePrimaryCreateAction"
    />

    <div v-if="table && isTemplateArtifactsTable" class="mb-3 rounded-2xl border border-blue-light-200 bg-blue-light-50 px-4 py-3">
      <p class="m-0 flex items-start gap-2 text-sm text-info">
        <font-awesome-icon icon="info-circle" class="mt-0.5 shrink-0" />
        <span>
          <strong>Consulta y versionado.</strong>
          Las plantillas se <strong>crean desde un proceso</strong> (pestaña “Plantillas” de la configuración).
          Aquí puedes consultarlas, ver sus versiones y abrir su editor; el vínculo al proceso y el modo de
          emisión se gestionan dentro de la configuración.
        </span>
      </p>
    </div>

    <div v-if="table && isPositionAssignmentsTable" class="admin-related-tabs">
      <ProfileSubsectionTabs
        :model-value="positionAssignmentsView"
        :tabs="positionAssignmentsTabs"
        aria-label="Vistas de ocupaciones"
        @update:model-value="positionAssignmentsView = $event"
      />
    </div>

    <div v-if="table && isProcessDefinitionTemplatesTable" class="admin-related-tabs">
      <ProfileSubsectionTabs
        :model-value="definitionTemplatesView"
        :tabs="definitionTemplatesTabs"
        aria-label="Vistas de plantillas"
        @update:model-value="definitionTemplatesView = $event"
      />
    </div>

    <div v-if="table && isCurrentTableTraceability" class="deasy-alert deasy-alert--warning mb-3">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <p class="m-0 flex items-start gap-2 text-sm text-warning">
          <font-awesome-icon icon="info-circle" class="mt-0.5 shrink-0" />
          <span>
            <strong>Trazabilidad y soporte.</strong>
            Registros técnicos generados por el sistema durante la ejecución; disponibles para consulta y
            diagnóstico. Editarlos directamente puede afectar la consistencia del flujo.
          </span>
        </p>
        <SToggle v-if="isAdminUser" v-model="advancedRuntimeMode" label-position="end">
          <span class="whitespace-nowrap text-sm font-semibold text-warning">Modo avanzado (edición directa)</span>
        </SToggle>
      </div>
      <p v-if="isAdminUser && advancedRuntimeMode" class="m-0 mt-2 text-xs font-bold text-danger">
        Edición directa habilitada: puede afectar la consistencia del flujo. No reemplaza las validaciones del backend.
      </p>
    </div>

    <UnitGraphView
      v-if="table && isUnitsTable && unitGraphMode"
      ref="unitGraphRef"
      relation-type="org"
      :editable="canUpdateCurrentTable"
      :can-create-process="canCreateProcessConfiguration"
      class="mb-2"
      @edit-unit="openEdit"
      @create-unit="openCreate"
      @create-process="openProcessWizardFromScratch"
    />

    <ProcessGraphView
      v-if="table && isProcessesTable && processGraphMode"
      ref="processGraphRef"
      :editable="canUpdateCurrentTable"
      class="mb-2"
      @open-config-wizard="openConfigWizardFromGraph"
      @edit-config="editConfigFromGraph"
      @launch-config="launchConfigFromGraph"
      @version-config="versionConfigFromGraph"
      @version-template="versionTemplateFromGraph"
      @open-template-editor="openTemplateEditorFromGraph"
      @guided-update-template="openGuidedTemplateUpdate"
      @notify="showFeedbackToast"
      @add-template="addTemplateFromGraph"
      @clone-template="cloneTemplateFromGraph"
      @go-back="handleGoBack"
    />

    <div v-if="!table" class="flex">
      <div class="w-full">
        <div class="deasy-card">
          <div class="p-5">
            <p class="mb-0 text-sm text-muted">Selecciona una tabla para administrar.</p>
          </div>
        </div>
      </div>
    </div>

    <AdminMainTableSection
      v-else
      v-show="!(isUnitsTable && unitGraphMode) && !(isProcessesTable && processGraphMode) && (!isPositionAssignmentsTable || positionAssignmentsView === 'ocupaciones') && (!isProcessDefinitionTemplatesTable || definitionTemplatesView === 'plantillas')"
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
      :can-update="canUpdateCurrentTable"
      :can-delete="canDeleteCurrentTable"
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
      @open-record-viewer="handleOpenRecordViewer($event, table)"
      @open-edit="openEdit"
      @version-template="openTemplateVersionDialog"
      @open-delete="openDelete"
      @start-process-definition-versioning="startProcessDefinitionVersioning"
      @open-process-definition-activation-for-row="openProcessDefinitionActivationForRow"
      @retire-process-definition="retireProcessDefinition"
      @open-person-assignments="openPersonAssignments"
      @launch-term="openProcessLaunch"
      @launch-definition="openProcessDefinitionLaunch"
    />

    <AdminVacantPositionsSection
      v-if="isPositionAssignmentsTable"
      v-show="positionAssignmentsView === 'vacantes'"
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
      :can-update="canUpdateCurrentTable"
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
      v-show="definitionTemplatesView === 'sin-vincular'"
      :search-term="unassignedTemplateArtifactSearch"
      :filters="unassignedTemplateArtifactFilters"
      :has-filters="hasUnassignedTemplateArtifactFilters"
      :loading="unassignedTemplateArtifactLoading"
      :error="unassignedTemplateArtifactError"
      :rows="unassignedTemplateArtifactRows"
      :table-fields="unassignedTemplateArtifactTableFields"
      :get-available-format-sections="getAvailableFormatSections"
      :get-available-format-badge-style="getAvailableFormatBadgeStyle"
      :can-link="canCreateCurrentTable || canUpdateCurrentTable"
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
      :cargo-position-suggest-provider="personCargoPositionSuggestProvider"
      :role-role-suggest-provider="personRoleRoleSuggestProvider"
      :role-unit-suggest-provider="personRoleUnitSuggestProvider"
      :contract-position-suggest-provider="personContractPositionSuggestProvider"
      @update:person-assignment-section="personAssignmentSection = $event"
      @update:person-cargo-form="personCargoForm = $event"
      @update:person-contract-form="personContractForm = $event"
      @clear-person-cargo-position="clearPersonCargoPosition"
      @open-person-cargo-fk-search="openPersonCargoFkSearch"
      @select-person-cargo="selectPersonCargoOption"
      @submit-person-cargo-create="submitPersonCargoCreate"
      @reset-person-cargo-form="resetPersonCargoForm"
      @view-person-cargo="openRecordViewer($event, allTablesMap.position_assignments)"
      @start-person-cargo-edit="startPersonCargoEdit"
      @delete-person-cargo="deletePersonCargo"
      @clear-person-role-field="clearPersonRoleField"
      @open-person-role-fk-search="openPersonRoleFkSearch"
      @select-person-role="selectPersonRoleOption"
      @submit-person-role-create="submitPersonRoleCreate"
      @reset-person-role-form="resetPersonRoleForm"
      @view-person-role="openRecordViewer($event, allTablesMap.role_assignments)"
      @start-person-role-edit="startPersonRoleEdit"
      @delete-person-role="deletePersonRole"
      @clear-person-contract-position="clearPersonContractPosition"
      @open-person-contract-fk-search="openPersonContractFkSearch"
      @select-person-contract="selectPersonContractOption"
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
      :is-process-table="isProcessesTable"
      :modal-error="modalError"
      :visible-form-fields="visibleFormFields"
      :fk-display="fkDisplay"
      :inline-fk-loading="inlineFkLoading"
      :inline-fk-suggestions="inlineFkSuggestions"
      :form-data="formData"
      :process-definition-checklist-loading="processDefinitionChecklistLoading"
      :process-definition-checklist="processDefinitionChecklist"
      :process-configuration-loading="processEditorConfigurationsLoading"
      :process-configuration-error="processEditorConfigurationsError"
      :process-configuration-rows="processEditorConfigurations"
      :process-configuration-table-fields="processEditorConfigurationTableFields"
      :can-create-process-configuration="canCreateProcessConfiguration"
      :can-delete-process-configuration="canDeleteProcessConfiguration"
      :selected-row="selectedRow"
      :is-input-field="isInputField"
      :is-foreign-key-field="isForeignKeyField"
      :is-field-locked="isFieldLocked"
      :input-type="inputType"
      :should-show-inline-fk-suggestions="shouldShowInlineFkSuggestions"
      :format-inline-fk-option="formatInlineFkOption"
      :format-select-option-label="formatSelectOptionLabel"
      :format-process-configuration-cell="formatProcessEditorConfigurationCell"
      :can-delete-process-configuration-row="canDeleteProcessConfigurationRow"
      @update:form-data="formData = $event"
      @update-inline-fk-display="updateInlineFkDisplay"
      @open-inline-fk-suggestions="openInlineFkSuggestions"
      @schedule-inline-fk-close="scheduleInlineFkClose"
      @clear-inline-fk-selection="clearInlineFkSelection"
      @open-fk-search="openFkSearch"
      @select-inline-fk-suggestion="selectInlineFkSuggestion"
      @handle-select-change="handleSelectChange"
      @add-process-configuration="openProcessConfigurationFromEditor"
      @delete-process-configuration="deleteProcessEditorConfiguration"
      @open-definition-rules="openDefinitionRulesFromEditor"
      @open-definition-triggers="openDefinitionTriggersFromEditor"
      @open-definition-artifacts="openDefinitionArtifactsFromEditor"
      @submit-and-configure="submitForm({ openProcessConfigurationAfterCreate: true })"
      @submit="submitForm"
    />

    <AdminProcessDefinitionVersioningModal
      ref="processDefinitionVersioningModal"
      @close="closeProcessDefinitionVersioningModal"
      @cancel-edit="cancelProcessDefinitionEdit"
      @promote="promoteProcessDefinitionToNewVersion"
    />

    <AdminProcessDefinitionActivationModal
      v-if="!processWizardOpen"
      ref="processDefinitionActivationModal"
      :checking="processDefinitionActivationChecking"
      :has-active-rules="processDefinitionActivationHasActiveRules"
      :has-active-triggers="processDefinitionActivationHasActiveTriggers"
      :has-active-artifacts="processDefinitionActivationHasActiveArtifacts"
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
      @view-row="handleActivationViewRow"
      @cancel="cancelProcessDefinitionActivation"
      @primary-action="handleProcessDefinitionActivationPrimaryAction"
      @confirm="confirmProcessDefinitionActivation"
    />

    <AdminDeleteConfirmModal ref="deleteModal" @confirm="confirmDelete" />
    <AdminDeleteConfirmModal
      ref="processConfigurationDeleteModal"
      :style="{ zIndex: 1090 }"
      @confirm="confirmDeleteProcessEditorConfiguration"
    />

    <AppModalShell
      ref="retireDefinitionModal"
      labelled-by="retireDefinitionModalLabel"
      title="Retirar configuración"
      :style="{ zIndex: 1090 }"
    >
      <p class="mb-2">
        Vas a <strong>retirar</strong> la configuración
        <strong>{{ retireDefinitionRow?.name || `#${retireDefinitionRow?.id}` }}</strong>.
      </p>
      <div class="deasy-alert deasy-alert--warning">
        Una configuración retirada deja de aplicarse a nuevos procesos y queda en <strong>solo lectura</strong>:
        no podrás reactivarla. Si más adelante necesitas estos ajustes, crea una nueva versión a partir de ella.
      </div>
      <template #footer>
        <AdminButton variant="cancel" data-modal-dismiss>Cancelar</AdminButton>
        <AdminButton variant="outlineDanger" @click="confirmRetireProcessDefinition">Retirar</AdminButton>
      </template>
    </AppModalShell>

    <AdminDefinitionCreatedPromptModal
      ref="definitionArtifactsPromptModal"
      :context="definitionArtifactsPromptContext"
      @close="closeDefinitionArtifactsPrompt"
      @open-wizard="handleOpenWizardFromPrompt"
      @open-rules="confirmDefinitionRulesPrompt"
      @open-triggers="confirmDefinitionTriggersPrompt"
      @open-artifacts="confirmDefinitionArtifactsPrompt"
    />

    <AdminDefinitionArtifactsModal
      v-if="!processWizardOpen"
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
      @edit-row="openDefinitionArtifactTemplateEditor"
      @delete-row="deleteDefinitionArtifact"
      @set-item-mode="setDefinitionArtifactItemMode($event.row, $event.itemMode)"
      @close="handleDefinitionArtifactsManagerClose"
      @accept="handleDefinitionArtifactsManagerAccept"
    />

    <AdminDefinitionTriggersModal
      v-if="!processWizardOpen"
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
      :suggest-provider="definitionTriggerSuggestProvider"
      :format-cell="formatCell"
      @update:form="definitionTriggersForm = $event"
      @trigger-mode-change="handleDefinitionTriggerModeChange"
      @clear-term-type="clearDefinitionTriggerTermType"
      @select-term-type="selectDefinitionTriggerOption"
      @open-fk-search="openDefinitionTriggerFkSearch"
      @submit="submitDefinitionTrigger"
      @reset="resetDefinitionTriggersForm"
      @view-row="openRecordViewer($event, allTablesMap.process_definition_period_types)"
      @edit-row="startDefinitionTriggerEdit"
      @delete-row="deleteDefinitionTrigger"
      @close="closeDefinitionTriggersManager"
      @accept="acceptDefinitionTriggersManager"
    />

    <AdminDefinitionRulesModal
      v-if="!processWizardOpen"
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
      :series-scope="definitionRulesSeriesScope"
      :suggest-providers="definitionRuleSuggestProviders"
      :format-cell="formatDefinitionRuleCell"
      @update:form="definitionRulesForm = $event"
      @scope-change="handleDefinitionRuleScopeChange"
      @recipient-policy-change="handleDefinitionRuleRecipientPolicyChange"
      @clear-field="clearDefinitionRuleField"
      @select-field="selectDefinitionRuleOption"
      @open-fk-search="openDefinitionRuleFkSearch"
      @submit="submitDefinitionRule"
      @reset="resetDefinitionRulesForm"
      @view-row="openRecordViewer($event, allTablesMap.process_target_rules)"
      @edit-row="startDefinitionRuleEdit"
      @delete-row="deleteDefinitionRule"
      @close="closeDefinitionRulesManager"
      @accept="acceptDefinitionRulesManager"
    />

    <AdminProcessWizardModal
      :open="processWizardOpen"
      :style="{ zIndex: 1080 }"
      :current-step="processWizardStep"
      :steps="processWizardSteps"
      :step-status="processWizardStepStatus"
      :definition-context="processWizardDefinition"
      :definition-form="processWizardDefinitionForm"
      :duplicate-definition="processWizardDuplicateDefinition"
      :process-options="processWizardProcessOptions"
      :unit-type-options="processWizardUnitTypeOptions"
      :cargo-options="processWizardCargoOptions"
      :series-options="processWizardSeriesOptions"
      :series-code-preview="processWizardSeriesCodePreview"
      :process-slug-preview="processWizardProcessSlugPreview"
      :definition-name-preview="processWizardDefinitionNamePreview"
      :creating-definition="processWizardCreating"
      :wizard-error="processWizardError"
      :readonly="processWizardReadonly"
      @update:definition-form="processWizardDefinitionForm = $event"
      @go-to-step="handleProcessWizardGoToStep"
      @create-definition="handleProcessWizardCreateDefinition"
      @edit-existing-definition="handleProcessWizardEditExistingDefinition"
      @close="handleProcessWizardClose"
    >
      <template #packages>
        <AdminDefinitionArtifactsPanel
          embedded
          :context="definitionArtifactsContext"
          :error="definitionArtifactsError"
          :can-manage="!processWizardReadonly && canManageDefinitionArtifacts"
          :can-submit="!processWizardReadonly && canSubmitDefinitionArtifact"
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
          @submit="wizardSubmitArtifact"
          @reset="resetDefinitionArtifactsForm"
          @view-row="handleWizardViewRow($event, allTablesMap.process_definition_templates)"
          @edit-row="openDefinitionArtifactTemplateEditor"
          @delete-row="deleteDefinitionArtifact"
          @set-item-mode="setDefinitionArtifactItemMode($event.row, $event.itemMode)"
        />
      </template>
      <template #rules>
        <AdminDefinitionRulesPanel
          embedded
          :context="definitionRulesContext"
          :error="definitionRulesError"
          :can-manage="!processWizardReadonly && canManageDefinitionRules"
          :can-submit="!processWizardReadonly && canSubmitDefinitionRule"
          :labels="definitionRulesLabels"
          :form="definitionRulesForm"
          :edit-id="definitionRulesEditId"
          :loading="definitionRulesLoading"
          :rows="definitionRulesRows"
          :table-fields="definitionRulesTableFields"
          :series-scope="definitionRulesSeriesScope"
          :suggest-providers="definitionRuleSuggestProviders"
          :format-cell="formatDefinitionRuleCell"
          @update:form="definitionRulesForm = $event"
          @scope-change="handleDefinitionRuleScopeChange"
          @recipient-policy-change="handleDefinitionRuleRecipientPolicyChange"
          @clear-field="clearDefinitionRuleField"
          @select-field="selectDefinitionRuleOption"
          @open-fk-search="openDefinitionRuleFkSearch"
          @submit="wizardSubmitRule"
          @reset="resetDefinitionRulesForm"
          @view-row="handleWizardViewRow($event, allTablesMap.process_target_rules)"
          @edit-row="startDefinitionRuleEdit"
          @delete-row="deleteDefinitionRule"
        />
      </template>
      <template #triggers>
        <AdminDefinitionTriggersPanel
          embedded
          :context="definitionTriggersContext"
          :error="definitionTriggersError"
          :can-manage="!processWizardReadonly && canManageDefinitionTriggers"
          :can-submit="!processWizardReadonly && canSubmitDefinitionTrigger"
          :requires-term-type="definitionTriggerRequiresTermType"
          :labels="definitionTriggersLabels"
          :form="definitionTriggersForm"
          :edit-id="definitionTriggersEditId"
          :loading="definitionTriggersLoading"
          :rows="definitionTriggersRows"
          :table-fields="definitionTriggersTableFields"
          :suggest-provider="definitionTriggerSuggestProvider"
          :format-cell="formatCell"
          @update:form="definitionTriggersForm = $event"
          @trigger-mode-change="handleDefinitionTriggerModeChange"
          @clear-term-type="clearDefinitionTriggerTermType"
          @select-term-type="selectDefinitionTriggerOption"
          @open-fk-search="openDefinitionTriggerFkSearch"
          @submit="wizardSubmitTrigger"
          @reset="resetDefinitionTriggersForm"
          @view-row="handleWizardViewRow($event, allTablesMap.process_definition_period_types)"
          @edit-row="startDefinitionTriggerEdit"
          @delete-row="deleteDefinitionTrigger"
        />
      </template>
      <template #activate>
        <ProcessActivationPanel
          :checking="processDefinitionActivationChecking"
          :has-active-rules="processDefinitionActivationHasActiveRules"
          :has-active-triggers="processDefinitionActivationHasActiveTriggers"
          :has-active-artifacts="processDefinitionActivationHasActiveArtifacts"
          :view="processDefinitionActivationView"
          :selected-row="processWizardDefinition"
          :rules="processDefinitionActivationRules"
          :triggers="processDefinitionActivationTriggers"
          :artifacts="processDefinitionActivationArtifacts"
          :rule-table-fields="processDefinitionActivationRuleTableFields"
          :trigger-table-fields="processDefinitionActivationTriggerTableFields"
          :artifact-table-fields="processDefinitionActivationArtifactTableFields"
          :format-cell="formatCell"
          :format-definition-rule-summary="formatDefinitionRuleSummary"
          @update:view="processDefinitionActivationView = $event"
          @view-row="handleActivationViewRow"
        />
        <div class="mt-4 flex items-center justify-end gap-2 border-t border-line pt-3">
          <span v-if="!allProcessDefinitionActivationRequirementsMet" class="mr-auto text-sm font-medium text-warning">
            Completa los requisitos (reglas, disparadores) para activar.
          </span>
          <AdminButton
            v-if="!processWizardReadonly"
            variant="success"
            :disabled="processDefinitionActivationChecking || !allProcessDefinitionActivationRequirementsMet"
            @click="showWizardActivateConfirm = true"
          >Activar proceso</AdminButton>
        </div>

        <!-- Confirmación con tono de advertencia: la activación es irreversible en esta versión. -->
        <AppDialogOverlay
          :open="showWizardActivateConfirm"
          title="Confirmar activación"
          panel-class="max-w-md"
          @close="showWizardActivateConfirm = false"
        >
          <div class="deasy-alert deasy-alert--warning flex items-start gap-3 leading-relaxed">
            <font-awesome-icon icon="triangle-exclamation" class="mt-0.5 h-5 w-5 shrink-0 text-warning" />
            <span>
              Al activar, <strong>ya no podrás modificar</strong> reglas, periodos ni paquetes en esta versión.
              Si ya existe una configuración activa en la misma serie, <strong>se retirará automáticamente</strong>.
            </span>
          </div>
          <AdminConfigActivationDiff v-if="showWizardActivateConfirm" :definition-id="processWizardDefinition?.id" class="mt-3" />
          <template #footer>
            <AdminButton variant="cancel" @click="showWizardActivateConfirm = false">Cancelar</AdminButton>
            <AdminButton variant="success" :disabled="processDefinitionActivationChecking" @click="confirmWizardActivation">Sí, activar</AdminButton>
          </template>
        </AppDialogOverlay>
      </template>
    </AdminProcessWizardModal>

    <AdminFkBrowserModal
      ref="fkModal"
      :style="{ zIndex: 1090 }"
      :fk-table="fkTable"
      :is-fk-units="isFkUnits"
      :is-fk-process-definitions="isFkProcessDefinitions"
      :is-fk-template-artifacts="isFkTemplateArtifacts"
      :create-tab-enabled="isFkTemplateArtifacts"
      :active-tab="fkActiveTab"
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
      :process-filter-context-id="definitionArtifactsContext?.process_id || ''"
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
      @update:active-tab="fkActiveTab = $event"
    >
      <!-- Pestaña "Crear nueva": el wizard de plantilla embebido (sin overlay propio). -->
      <template #create>
        <AdminDraftArtifactModal
          v-if="isFkTemplateArtifacts"
          embedded
          :draft-artifact-edit-id="draftArtifactEditId"
          :draft-artifact-error="draftArtifactError"
          :draft-artifact-loading="draftArtifactLoading"
          :draft-artifact-form="draftArtifactForm"
          :draft-artifact-seed-options="draftArtifactSeedOptions"
          :draft-artifact-preview-url="draftArtifactPreviewUrl"
          :draft-artifact-preview-status="draftArtifactPreviewStatus"
          :get-draft-artifact-file-label="getDraftArtifactFileLabel"
          :new-process-definition-id="draftNewProcessDefinitionId"
          :preselect-process-definition-id="draftArtifactPreselectDefinitionId"
          :guided-config-id="guidedEditorConfigId"
          @update:form="draftArtifactForm = $event"
          @file-change="handleDraftArtifactFileChange"
          @drop="handleDraftArtifactDrop"
          @close="fkActiveTab = 'select'"
          @submit="handleDraftArtifactSubmit"
          @change-active="handleArtifactActiveChange"
          @publish="handleArtifactPublish"
          @retire="handleArtifactRetire"
          @finish-guided="finishGuidedTemplateUpdate"
          @new-version="handleArtifactNewVersion"
          @create-process="handleDraftCreateProcess"
        />
      </template>
    </AdminFkBrowserModal>

    <AdminRecordViewerModal
      ref="recordViewerModal"
      :style="{ zIndex: 1100 }"
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
      :downloading="recordArchiveDownloading"
      :editable="recordViewerEditable"
      :is-admin="isAdminUser"
      :can-create-process-configuration="canCreateProcessConfiguration"
      :source-busy="templateSourceBusy"
      :sync-status="recordViewerSyncStatus"
      :sync-busy="recordViewerSyncBusy"
      @close="closeRecordViewer"
      @add-process-configuration="openProcessConfigurationFromViewer"
      @view-related-record="handleRecordViewerRelatedRecord"
      @download-archive="handleDownloadRecordArchive"
      @download-source="handleDownloadTemplateSource"
      @upload-source="handleUploadTemplateSource"
      @resync-workflows="handleResyncTemplateWorkflows"
    />

    <AdminFkFilterModal
      ref="fkFilterModal"
      :style="{ zIndex: 1100 }"
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
      :style="{ zIndex: 1100 }"
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
                <label :for="fieldId('process-filter-parent')" class="deasy-form-label deasy-form-label--inline">Proceso padre</label>
                <AdminLookupField
                  :id="fieldId('process-filter-parent')"
                  v-model="processFilterLabels.parent_id"
                  placeholder="Selecciona un proceso padre"
                  :suggest-provider="processParentSuggestProvider"
                  :clear-disabled="!processFilters.parent_id"
                  @clear="clearProcessParentFilter"
                  @select="selectProcessFilterOption('parent_id', $event)"
                  @search="openProcessFkSearch('parent_id')"
                />
              </div>
              <div>
                <label :for="fieldId('process-filter-is-active')" class="deasy-form-label deasy-form-label--inline">Activo</label>
                <AdminSelectField :id="fieldId('process-filter-is-active')" v-model="processFilters.is_active">
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
                <label :for="fieldId('template-filter-name')" class="deasy-form-label deasy-form-label--inline">Nombre</label>
                <AdminInputField :id="fieldId('template-filter-name')" v-model="templateFilters.name" />
              </div>
              <div>
                <label :for="fieldId('template-filter-slug')" class="deasy-form-label deasy-form-label--inline">Slug</label>
                <AdminInputField :id="fieldId('template-filter-slug')" v-model="templateFilters.slug" />
              </div>
              <div>
                <label :for="fieldId('template-filter-description')" class="deasy-form-label deasy-form-label--inline">Descripcion</label>
                <AdminInputField :id="fieldId('template-filter-description')" v-model="templateFilters.description" />
              </div>
              <div>
                <label :for="fieldId('template-filter-process')" class="deasy-form-label deasy-form-label--inline">Proceso</label>
                <AdminLookupField
                  :id="fieldId('template-filter-process')"
                  v-model="templateFilterLabels.process_id"
                  placeholder="Selecciona un proceso"
                  :suggest-provider="templateProcessSuggestProvider"
                  :clear-disabled="!templateFilters.process_id"
                  @clear="clearTemplateProcessFilter"
                  @select="selectTemplateProcessFilterOption($event)"
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
                <label :for="fieldId('document-filter-task')" class="deasy-form-label deasy-form-label--inline">Tarea</label>
                <AdminLookupField
                  :id="fieldId('document-filter-task')"
                  v-model="documentFilterLabels.task_id"
                  placeholder="Selecciona una tarea"
                  :suggest-provider="documentTaskSuggestProvider"
                  :clear-disabled="!documentFilters.task_id"
                  @clear="clearDocumentTaskFilter"
                  @select="selectDocumentFilterOption('task_id', $event)"
                  @search="openDocumentFkSearch('task_id')"
                />
              </div>
              <div>
                <label :for="fieldId('document-filter-status')" class="deasy-form-label deasy-form-label--inline">Estado</label>
                <AdminSelectField :id="fieldId('document-filter-status')" v-model="documentFilters.status">
                  <option value="">Todos</option>
                  <option value="Inicial">Inicial</option>
                  <option value="Pendiente de llenado">Pendiente de llenado</option>
                  <option value="En proceso">En proceso</option>
                  <option value="Observado">Observado</option>
                  <option value="Listo para firma">Listo para firma</option>
                  <option value="Pendiente de firma">Pendiente de firma</option>
                  <option value="Firmado parcial">Firmado parcial</option>
                  <option value="Firmado completo">Firmado completo</option>
                  <option value="Final">Final</option>
                  <option value="Archivado">Archivado</option>
                  <option value="Cancelado">Cancelado</option>
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
                <label :for="fieldId('unit-position-filter-unit-type')" class="deasy-form-label deasy-form-label--inline">Tipo de unidad</label>
                <AdminSelectField
                  :id="fieldId('unit-position-filter-unit-type')"
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
                <label :for="fieldId('unit-position-filter-unit')" class="deasy-form-label deasy-form-label--inline">Unidad</label>
                <AdminSelectField
                  :id="fieldId('unit-position-filter-unit')"
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
                <label :for="fieldId('unit-position-filter-cargo')" class="deasy-form-label deasy-form-label--inline">Cargo</label>
                <AdminSelectField
                  :id="fieldId('unit-position-filter-cargo')"
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
      :draft-artifact-preview-status="draftArtifactPreviewStatus"
      :get-draft-artifact-file-label="getDraftArtifactFileLabel"
      :new-process-definition-id="draftNewProcessDefinitionId"
      :preselect-process-definition-id="draftArtifactPreselectDefinitionId"
      :guided-config-id="guidedEditorConfigId"
      @update:form="draftArtifactForm = $event"
      @file-change="handleDraftArtifactFileChange"
      @drop="handleDraftArtifactDrop"
      @close="handleDraftArtifactClose"
      @submit="handleDraftArtifactSubmit"
      @change-active="handleArtifactActiveChange"
      @publish="handleArtifactPublish"
      @retire="handleArtifactRetire"
      @finish-guided="finishGuidedTemplateUpdate"
      @new-version="handleArtifactNewVersion"
      @create-process="handleDraftCreateProcess"
    />
  </div>
</template>

<script setup>
import { computed, defineAsyncComponent, defineEmits, defineProps, defineExpose, onBeforeUnmount, onMounted, ref, useId, watch } from "vue";
import { useAdminFkManager } from "@/modules/admin/composables/fk/useAdminFkManager";
import { useAdminFkCrud } from "@/modules/admin/composables/fk/useAdminFkCrud";
import { useAdminFkSearch } from "@/modules/admin/composables/fk/useAdminFkSearch";
import { useAdminEditorFlow } from "@/modules/admin/composables/forms/useAdminEditorFlow";
import { useAdminDraftArtifactFlow } from "@/modules/admin/composables/processes/useAdminDraftArtifactFlow";
import { useAdminFeedbackToast } from "@/modules/admin/composables/ui/useAdminFeedbackToast";
import { useAdminFkLabels } from "@/modules/admin/composables/fk/useAdminFkLabels";
import { useAdminFormState } from "@/modules/admin/composables/forms/useAdminFormState";
import { useAdminModalRegistry } from "@/modules/admin/composables/modals/useAdminModalRegistry";
import { useAdminModalStack } from "@/modules/admin/composables/modals/useAdminModalStack";
import { useAdminOptionLoaders } from "@/modules/admin/composables/forms/useAdminOptionLoaders";
import { useAdminPresentationAdapters } from "@/modules/admin/composables/ui/useAdminPresentationAdapters";
import { useAdminShellHelpers } from "@/modules/admin/composables/ui/useAdminShellHelpers";
import { useAdminShellSearchActions } from "@/modules/admin/composables/data/useAdminShellSearchActions";
import { useAdminSyncActions } from "@/modules/admin/composables/data/useAdminSyncActions";
import { usePersonAssignmentsManager } from "@/modules/admin/composables/processes/usePersonAssignmentsManager";
import { useAdminRecordViewer } from "@/modules/admin/composables/data/useAdminRecordViewer";
import { useAdminSearchFilters } from "@/modules/admin/composables/data/useAdminSearchFilters";
import { useAdminTableDataSource } from "@/modules/admin/composables/data/useAdminTableDataSource";
import { useProcessDefinitionActivationFlow } from "@/modules/admin/composables/processes/useProcessDefinitionActivationFlow";
import { useProcessDefinitionManager } from "@/modules/admin/composables/processes/useProcessDefinitionManager";
import axios from "@/core/services/httpClient";
import { useProcessWizard } from "@/modules/admin/composables/processes/useProcessWizard";
import { useAdminSubmitFlow } from "@/modules/admin/composables/forms/useAdminSubmitFlow";
import { API_ROUTES } from "@/core/config/apiConfig";
import {
  canCreateAdminTable,
  canDeleteAdminTable,
  canUpdateAdminTable,
  hasAnyRole,
  isTraceabilityTable
} from "@/core/utils/accessControl.js";
import { adminSqlService } from "@/modules/admin/services/AdminSqlService";
import { adminPresentationService } from "@/modules/admin/services/AdminPresentationService";
import { processDefinitionAdminService } from "@/modules/admin/services/ProcessDefinitionAdminService";
import {
  definitionArtifactsTableFields,
  definitionRulesTableFields,
  definitionTriggersTableFields,
  FK_TABLE_MAP,
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
} from "@/modules/admin/services/AdminTableManagerConfig";
import AdminFeedbackToast from "@/modules/admin/components/ui/AdminFeedbackToast.vue";
import SToggle from "@/shared/components/forms/SToggle.vue";
import AdminDefinitionArtifactsModal from "@/modules/admin/components/modals/AdminDefinitionArtifactsModal.vue";
import AdminDefinitionArtifactsPanel from "@/modules/admin/components/modals/AdminDefinitionArtifactsPanel.vue";
import AdminDefinitionCreatedPromptModal from "@/modules/admin/components/modals/AdminDefinitionCreatedPromptModal.vue";
import AdminDefinitionRulesModal from "@/modules/admin/components/modals/AdminDefinitionRulesModal.vue";
import AdminDefinitionRulesPanel from "@/modules/admin/components/modals/AdminDefinitionRulesPanel.vue";
import AdminDefinitionTriggersModal from "@/modules/admin/components/modals/AdminDefinitionTriggersModal.vue";
import AdminDefinitionTriggersPanel from "@/modules/admin/components/modals/AdminDefinitionTriggersPanel.vue";
import AdminDeleteConfirmModal from "@/modules/admin/components/modals/AdminDeleteConfirmModal.vue";
import AdminDraftArtifactModal from "@/modules/admin/components/modals/AdminDraftArtifactModal.vue";
import AdminTemplateVersionDialog from "@/modules/admin/components/modals/AdminTemplateVersionDialog.vue";
import ProcessLaunchModal from "@/modules/admin/components/modals/ProcessLaunchModal.vue";
import ProcessDefinitionLaunchModal from "@/modules/admin/components/modals/ProcessDefinitionLaunchModal.vue";
import AdminEditorModal from "@/modules/admin/components/modals/AdminEditorModal.vue";
import AdminMainTableSection from "@/modules/admin/components/tables/AdminMainTableSection.vue";
// Lazy-load: Vue Flow + dagre solo se cargan al abrir el organigrama / mapa de procesos (fuera del bundle).
const UnitGraphView = defineAsyncComponent(() => import("@/modules/admin/components/units/UnitGraphView.vue"));
const ProcessGraphView = defineAsyncComponent(() => import("@/modules/admin/components/units/ProcessGraphView.vue"));
import AdminFkBrowserModal from "@/modules/admin/components/modals/AdminFkBrowserModal.vue";
import AdminFkCreateModal from "@/modules/admin/components/modals/AdminFkCreateModal.vue";
import AdminFkFilterModal from "@/modules/admin/components/modals/AdminFkFilterModal.vue";
import AdminInputField from "@/modules/admin/components/forms/AdminInputField.vue";
import AdminPersonAssignmentsModal from "@/modules/admin/components/modals/AdminPersonAssignmentsModal.vue";
import AdminProcessDefinitionActivationModal from "@/modules/admin/components/modals/AdminProcessDefinitionActivationModal.vue";
import AdminConfigActivationDiff from "@/modules/admin/components/modals/AdminConfigActivationDiff.vue";
import AdminProcessDefinitionVersioningModal from "@/modules/admin/components/modals/AdminProcessDefinitionVersioningModal.vue";
import AdminProcessWizardModal from "@/modules/admin/components/modals/AdminProcessWizardModal.vue";
import ProcessActivationPanel from "@/modules/admin/components/modals/ProcessActivationPanel.vue";
import AdminRecordViewerModal from "@/modules/admin/components/modals/AdminRecordViewerModal.vue";
import AdminSelectField from "@/modules/admin/components/forms/AdminSelectField.vue";
import AdminTableHeader from "@/modules/admin/components/tables/AdminTableHeader.vue";
import AdminUnassignedArtifactsSection from "@/modules/admin/components/tables/AdminUnassignedArtifactsSection.vue";
import AdminVacantPositionsSection from "@/modules/admin/components/tables/AdminVacantPositionsSection.vue";
import AdminButton from "@/shared/components/buttons/AppButton.vue";
import AdminLookupField from "@/modules/admin/components/forms/AdminLookupField.vue";
import AppModalShell from "@/shared/components/modals/AppModalShell.vue";
import AppDialogOverlay from "@/shared/components/modals/AppDialogOverlay.vue";
import AdminSearchModal from "@/modules/admin/components/modals/AdminSearchModal.vue";
import ProfileSubsectionTabs from "@/modules/perfil/components/ProfileSubsectionTabs.vue";
import { Modal } from "@/shared/utils/modalController";

// Enlaza cada <label for> con su control. useId() da un prefijo distinto por
// instancia, para que dos montajes simultaneos no compartan el mismo id.
const uid = useId();
const fieldId = (name) => `${uid}-${name}`;

const props = defineProps({
  table: {
    type: Object,
    default: null
  },
  siblingTabs: {
    type: Array,
    default: () => []
  },
  activeSiblingTab: {
    type: String,
    default: ""
  },
  allTables: {
    type: Array,
    default: () => []
  },
  // Filtros iniciales (filter_<col>) al abrir una tabla desde un resumen de operación. Se limpian al cambiar de tabla.
  initialFilters: {
    type: Object,
    default: null
  },
  // Lo controla la pestaña hermana "Organigrama": muestra el grafo en vez de la tabla de unidades.
  forceGraph: {
    type: Boolean,
    default: false
  },
  // Lo controla la pestaña hermana "Mapa de procesos": muestra el grafo en vez de la tabla de procesos.
  forceProcessGraph: {
    type: Boolean,
    default: false
  }
});
const emit = defineEmits(["go-back", "select-sibling-tab"]);

const rows = ref([]);
const loading = ref(false);
const error = ref("");
const processLaunchModal = ref(null);
const processDefinitionLaunchModal = ref(null);
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
  definition_status: ""
});
const templateArtifactInlineFilters = ref({
  is_active: ""
});
const processDefinitionProcessOptions = ref([]);
const processDefinitionSeriesOptions = ref([]);
const editorMode = ref("create");
const formData = ref({});
const selectedRow = ref(null);
const modalError = ref("");
const fkDisplay = ref({});
const processEditorConfigurations = ref([]);
const processEditorConfigurationsLoading = ref(false);
const processEditorConfigurationsError = ref("");
const processEditorContext = ref(null);
const processConfigurationDeleteRow = ref(null);

const editorModal = ref(null);
const processDefinitionVersioningModal = ref(null);
const processDefinitionActivationModal = ref(null);
const definitionRulesModal = ref(null);
const definitionTriggersModal = ref(null);
const definitionArtifactsModal = ref(null);
const definitionArtifactsPromptModal = ref(null);
const draftArtifactModalRef = ref(null);
const deleteModal = ref(null);
const processConfigurationDeleteModal = ref(null);
const recordViewerModal = ref(null);
const personAssignmentsModal = ref(null);
const fkModal = ref(null);
const fkFilterModal = ref(null);
const fkCreateModal = ref(null);
const searchInput = ref(null);
const skipFkReturnRestore = ref(false);
const fkCreateExitTarget = ref("none");
const fkNestedExitTarget = ref("none");
const recordViewerTable = ref(null);
const recordViewerRow = ref(null);
const recordViewerEditable = ref(false);
const recordViewerLoading = ref(false);
const recordViewerError = ref("");
const recordViewerRelatedSections = ref([]);
const recordArchiveDownloading = ref(false);
const processWizardReadonly = ref(false);
const restoreProcessWizardAfterRecordViewer = ref(false);
const processDefinitionVersioningSource = ref(null);
const processDefinitionCloneSourceId = ref("");
const processDefinitionActivationConfirmed = ref(false);
const processDefinitionActivationFromEditor = ref(false);
const processDefinitionActivationChecking = ref(false);
const processDefinitionActivationHasActiveRules = ref(true);
const processDefinitionActivationHasActiveTriggers = ref(true);
const processDefinitionActivationHasActiveArtifacts = ref(true);
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
// Cargo/tipo de unidad que la serie del proceso fija; bloquea el cargo en el panel de reglas.
const definitionRulesSeriesScope = ref(null);
const definitionRulesForm = ref({
  unit_scope_type: "unit_exact",
  unit_id: "",
  unit_type_id: "",
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
  sort_order: ""
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
  storage_version: "",
  is_active: 1,
  process_definition_id: "",
  schema_fields: [],
  fill_workflow: { required: true, steps: [] },
  signature_workflow: { required: true, steps: [] }
});
const draftArtifactFiles = ref({
  pdf: null,
  docx: null,
  xlsx: null,
  pptx: null
});
const draftArtifactFkCreateMode = ref(false);

const fkTable = ref(null);
const fkRows = ref([]);
const fkSearch = ref("");
const fkLoading = ref(false);
const fkError = ref("");
const unitTypeByUnitId = ref({});
const fkField = ref("");
const fkSetter = ref(null);
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
let processConfigurationDeleteInstance = null;
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
  if (props.table?.table === "process_definition_series") {
    const sourceType = String(formData.value?.source_type || "").trim();
    const showUnitType = sourceType === "unit_type";
    const showCargo = sourceType === "cargo";

    return formFields.value
      .filter((field) => {
        if (field.name === "unit_type_id") {
          return showUnitType;
        }
        if (field.name === "cargo_id") {
          return showCargo;
        }
        return true;
      })
      .map((field) => (
        ["unit_type_id", "cargo_id"].includes(field.name)
          ? { ...field, required: true }
          : field
      ));
  }
  if (!isProcessesTable.value) {
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
      ["variation_key", "definition_version", "name", "description", "status"].includes(field.name)
    );
  }
  if (fkTable.value.table === "units") {
    return fkTable.value.fields.filter((field) => ["unit_type_id"].includes(field.name));
  }
  if (fkTable.value.table === "template_artifacts") {
    return fkTable.value.fields
      .filter((field) =>
        ["template_code", "storage_version", "available_formats", "is_active"].includes(field.name)
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
  && (fkTable.value.table === "template_artifacts"
    ? canCreateAdminTable("template_artifacts")
    : fkCreateFields.value.length > 0)
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
  )
);
const hasFkTemplateArtifactFilters = computed(() =>
  Boolean(
    (fkFilters.value.process_id ?? "") !== ""
    || fkFilters.value.is_active !== ""
  )
);

const isProcessDefinitionFilterTable = computed(() => props.table?.table === "process_definition_versions");
const isTemplateSeedsTable = computed(() => props.table?.table === "template_seeds");
const isTemplateArtifactsTable = computed(() => props.table?.table === "template_artifacts");
const isPersonTable = computed(() => props.table?.table === "persons");
const isUnitsTable = computed(() => props.table?.table === "units");
// El modo grafo lo activa la pestaña hermana "Organigrama" (prop forceGraph).
const unitGraphMode = computed(() => props.forceGraph && isUnitsTable.value);
const unitGraphRef = ref(null);
// Mapa de procesos: pestaña hermana "Mapa de procesos" (prop forceProcessGraph) sobre la tabla processes.
const isProcessesTable = computed(() => props.table?.table === "processes");
const processGraphMode = computed(() => props.forceProcessGraph && isProcessesTable.value);
const processGraphRef = ref(null);
// Tras editar/crear una unidad (fetchRows actualiza rows), refresca el organigrama si está visible.
watch(rows, () => {
  if (isUnitsTable.value && unitGraphMode.value) {
    unitGraphRef.value?.reloadGraph?.();
  }
  if (isProcessesTable.value && processGraphMode.value) {
    processGraphRef.value?.reloadGraph?.();
  }
});
const isUnitPositionsTable = computed(() => props.table?.table === "unit_positions");
const isPositionAssignmentsTable = computed(() => props.table?.table === "position_assignments");

// Subpestañas de la vista de ocupaciones: una tabla por pestaña (ocupaciones / puestos sin ocupacion)
// en lugar de apilarlas verticalmente.
const positionAssignmentsView = ref("ocupaciones");
const positionAssignmentsTabs = computed(() => [
  { key: "ocupaciones", label: "Ocupaciones", count: rows.value?.length || 0 },
  { key: "vacantes", label: "Puestos sin ocupacion", count: vacantPositionRows.value?.length || 0 }
]);

const isProcessDefinitionTemplatesTable = computed(() => props.table?.table === "process_definition_templates");

// Subpestañas de la vista de plantillas de procesos configurados (plantillas vinculadas / plantillas sin configuracion).
const definitionTemplatesView = ref("plantillas");
const definitionTemplatesTabs = computed(() => [
  { key: "plantillas", label: "Plantillas", count: rows.value?.length || 0 },
  { key: "sin-vincular", label: "Plantillas sin configuracion", count: unassignedTemplateArtifactRows.value?.length || 0 }
]);

watch(
  () => props.table?.table,
  () => {
    positionAssignmentsView.value = "ocupaciones";
    definitionTemplatesView.value = "plantillas";
  }
);

const isPositionFilterTable = computed(() =>
  isUnitPositionsTable.value || isPositionAssignmentsTable.value
);
const isProcessTargetRuleFilterTable = computed(() => props.table?.table === "process_target_rules");
const isDraftDefinitionStatus = (...candidates) =>
  candidates.some((value) => String(value || "").trim().toLowerCase() === "draft");
const canManageDefinitionArtifacts = computed(() =>
  isDraftDefinitionStatus(
    definitionArtifactsContext.value?.status,
    selectedRow.value?.status,
    formData.value?.status
  )
);
const canManageDefinitionRules = computed(() =>
  isDraftDefinitionStatus(
    definitionRulesContext.value?.status,
    selectedRow.value?.status,
    formData.value?.status
  )
);
const canManageDefinitionTriggers = computed(() =>
  isDraftDefinitionStatus(
    definitionTriggersContext.value?.status,
    selectedRow.value?.status,
    formData.value?.status
  )
);
const canSubmitDefinitionArtifact = computed(() =>
  canManageDefinitionArtifacts.value && Boolean(definitionArtifactsForm.value.template_artifact_id)
);
const canSubmitDefinitionRule = computed(() => {
  if (!canManageDefinitionRules.value) {
    return false;
  }
  const scopeType = String(definitionRulesForm.value.unit_scope_type || "");
  const recipientPolicy = String(definitionRulesForm.value.recipient_policy || "");
  if (recipientPolicy === "exact_position") {
    return Boolean(definitionRulesForm.value.position_id);
  }
  if (scopeType === "unit_type") {
    return Boolean(definitionRulesForm.value.unit_type_id);
  }
  if (scopeType === "unit_exact" || scopeType === "unit_subtree") {
    return Boolean(definitionRulesForm.value.unit_id);
  }
  if (scopeType === "all_units") {
    return true;
  }
  return false;
});
// El tipo de periodo siempre es obligatorio: el proceso corre en uno o varios tipos de periodo.
const definitionTriggerRequiresTermType = computed(() => true);
const canSubmitDefinitionTrigger = computed(() => {
  if (!canManageDefinitionTriggers.value) {
    return false;
  }
  return Boolean(definitionTriggersForm.value.term_type_id);
});
const processDefinitionActivationPrimaryAction = computed(() => {
  if (processDefinitionActivationChecking.value) {
    return null;
  }
  if (processDefinitionActivationView.value === "definition") {
    return {
      type: "edit_definition",
      label: "Editar configuracion"
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
      label: processDefinitionActivationTriggers.value.length ? "Editar periodos" : "Agregar periodos"
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
  && processDefinitionActivationHasActiveArtifacts.value
);
// El preview del seed se descarga por axios (responseType blob) para que lleve el header Bearer del
// interceptor; un <iframe src="..."> con la URL cruda no manda el token → backend responde "Token requerido".
const draftArtifactPreviewUrl = ref("");
// idle = sin seed; loading = descargando; ready = PDF disponible; empty = seed sin preview PDF.
const draftArtifactPreviewStatus = ref("idle");
let draftArtifactPreviewObjectUrl = "";
const loadDraftArtifactPreview = async (seedId) => {
  if (draftArtifactPreviewObjectUrl) {
    URL.revokeObjectURL(draftArtifactPreviewObjectUrl);
    draftArtifactPreviewObjectUrl = "";
  }
  draftArtifactPreviewUrl.value = "";
  if (!seedId) {
    draftArtifactPreviewStatus.value = "idle";
    return;
  }
  draftArtifactPreviewStatus.value = "loading";
  try {
    const response = await axios.get(API_ROUTES.ADMIN_SQL_TEMPLATE_SEED_PREVIEW(seedId), { responseType: "blob" });
    draftArtifactPreviewObjectUrl = URL.createObjectURL(response.data);
    draftArtifactPreviewUrl.value = draftArtifactPreviewObjectUrl;
    draftArtifactPreviewStatus.value = "ready";
  } catch {
    draftArtifactPreviewUrl.value = "";
    draftArtifactPreviewStatus.value = "empty";
  }
};
watch(() => draftArtifactForm.value.template_seed_id, (seedId) => loadDraftArtifactPreview(seedId), { immediate: true });
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
    processTargetRuleInlineFilters.value.definition_status
  )
);
const hasTemplateArtifactInlineFilters = computed(() =>
  Boolean(
    templateArtifactInlineFilters.value.is_active
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
const currentTableName = computed(() => props.table?.table || "");
// Tablas runtime (Trazabilidad y soporte): la escritura directa se restringe a AdminSistema con modo avanzado
// activo. Estado local de UI (advancedRuntimeMode), NO es un permiso ni se persiste; el backend valida igual.
const advancedRuntimeMode = ref(false);
const isCurrentTableTraceability = computed(() => isTraceabilityTable(currentTableName.value));
const runtimeWriteAllowed = computed(() =>
  !isCurrentTableTraceability.value || (isAdminUser.value && advancedRuntimeMode.value));
const canCreateCurrentTable = computed(() =>
  canCreateAdminTable(currentTableName.value)
  && runtimeWriteAllowed.value
  // Las plantillas se crean SOLO desde un proceso (pestaña "Plantillas" de la configuración). La tabla
  // global es de consulta/versionado: se oculta el botón "Crear".
  && !isTemplateArtifactsTable.value
);
const canCreateProcessConfiguration = computed(() => canCreateAdminTable("process_definition_versions"));
const canDeleteProcessConfiguration = computed(() => canDeleteAdminTable("process_definition_versions"));
const canUpdateCurrentTable = computed(() => canUpdateAdminTable(currentTableName.value) && runtimeWriteAllowed.value);
const canDeleteCurrentTable = computed(() => canDeleteAdminTable(currentTableName.value) && runtimeWriteAllowed.value);
const processEditorConfigurationTableFields = [
  { name: "variation_key", label: "Variación" },
  { name: "definition_version", label: "Version" },
  { name: "name", label: "Nombre" },
  { name: "status", label: "Estado" },
  { name: "effective_from", label: "Vigencia desde" }
];
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
  processDefinitionActivationHasActiveArtifacts,
  processDefinitionActivationView,
  processDefinitionActivationPrimaryAction,
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
  restoreProcessWizardFromRecordViewer: () => restoreProcessWizardFromRecordViewer(),
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

const processDefinitionVersionsTableMeta = computed(() =>
  allTablesMap.value.process_definition_versions || {
    table: "process_definition_versions",
    fields: processEditorConfigurationTableFields
  }
);

const formatProcessEditorConfigurationCell = (row, field) =>
  formatValueForTable(processDefinitionVersionsTableMeta.value, row?.[field.name], field, row);

const canDeleteProcessConfigurationRow = (row) =>
  canDeleteProcessConfiguration.value
  && String(row?.status || "").trim().toLowerCase() === "draft";

const loadProcessEditorConfigurations = async (processId = selectedRow.value?.id) => {
  if (!processId) {
    processEditorConfigurations.value = [];
    processEditorConfigurationsError.value = "";
    processEditorConfigurationsLoading.value = false;
    return;
  }
  processEditorConfigurationsLoading.value = true;
  processEditorConfigurationsError.value = "";
  try {
    const response = await adminSqlService.list("process_definition_versions", {
      filter_process_id: processId,
      orderBy: "effective_from",
      order: "desc",
      limit: 100
    });
    processEditorConfigurations.value = response.data || [];
    await prefetchFkLabelsForRows(processEditorConfigurations.value, ["series_id"]);
  } catch {
    processEditorConfigurations.value = [];
    processEditorConfigurationsError.value = "No se pudieron cargar las configuraciones del proceso.";
  } finally {
    processEditorConfigurationsLoading.value = false;
  }
};

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
    status: "active"
  };
  await fetchFkRows();
};

const handleFkTemplateArtifactFilterChange = async () => {
  await fetchFkRows();
};

const clearFkTemplateArtifactFilters = async () => {
  fkFilters.value = {
    ...fkFilters.value,
    process_id: "",
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
  debouncedUnassignedTemplateArtifactSearch
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

const handleArtifactActiveChange = async (nextActive) => {
  const id = draftArtifactEditId.value;
  if (!id) return;
  try {
    const { data } = await adminSqlService.setTemplateArtifactActive(id, nextActive ? 1 : 0);
    draftArtifactForm.value = { ...draftArtifactForm.value, is_active: data?.is_active };
    await fetchRows();
    showFeedbackToast({
      kind: "success",
      title: data?.is_active ? "Plantilla activada" : "Plantilla desactivada",
      message: data?.is_active ? "La plantilla quedó activa y disponible." : "La plantilla quedó inactiva."
    });
  } catch (err) {
    showFeedbackToast({ kind: "error", title: "No se pudo cambiar el estado", message: err?.response?.data?.message || "Error al actualizar el estado." });
  }
};

const handleArtifactPublish = async () => {
  const id = draftArtifactEditId.value;
  if (!id) return;
  try {
    const { data } = await adminSqlService.publishTemplateArtifact(id);
    draftArtifactForm.value = {
      ...draftArtifactForm.value,
      lifecycle_state: data?.lifecycle_state || "published",
      is_active: data?.is_active ?? draftArtifactForm.value.is_active
    };
    await fetchRows();
    showFeedbackToast({ kind: "success", title: "Plantilla publicada", message: data?.__notice || "La plantilla quedó publicada (inmutable)." });
  } catch (err) {
    showFeedbackToast({ kind: "error", title: "No se pudo publicar", message: err?.response?.data?.message || "Error al publicar la plantilla." });
  }
};

const handleArtifactRetire = async () => {
  const id = draftArtifactEditId.value;
  if (!id) return;
  try {
    const { data } = await adminSqlService.retireTemplateArtifact(id);
    draftArtifactForm.value = { ...draftArtifactForm.value, lifecycle_state: data?.lifecycle_state || "retired", is_active: 0 };
    await fetchRows();
    showFeedbackToast({ kind: "success", title: "Plantilla retirada", message: "La plantilla quedó retirada (se conserva para auditoría)." });
  } catch (err) {
    showFeedbackToast({ kind: "error", title: "No se pudo retirar", message: err?.response?.data?.message || "Error al retirar la plantilla." });
  }
};

const handleArtifactNewVersion = async (bumpLevel = "minor") => {
  const id = draftArtifactEditId.value;
  if (!id) return;
  try {
    const { data } = await adminSqlService.createTemplateArtifactVersion(id, bumpLevel);
    await fetchRows();
    closeDraftArtifactModal();
    showFeedbackToast({ kind: "success", title: "Nueva versión creada", message: data?.__notice || "Se creó una nueva versión (inactiva)." });
  } catch (err) {
    showFeedbackToast({ kind: "error", title: "No se pudo crear la versión", message: err?.response?.data?.message || "Error al crear la nueva versión." });
  }
};

const {
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
  resolveFkSuggestions,
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
  fkCreateForm,
  fkCreateError,
  fkCreateExitTarget,
  fkNestedExitTarget,
  unitTypeByUnitId,
  fkPositionFilters,
  resetFkFilters,
  resetFkUnitPositionFilters,
  loadFkUnitTypeOptions,
  loadFkUnitOptions,
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
  openRecordViewer,
  closeRecordViewer
} = useAdminRecordViewer({
  recordViewerTable,
  recordViewerRow,
  recordViewerEditable,
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

const {
  openFkViewer,
  openFkFilterModal,
  cancelFkFilter,
  clearFkFilters,
  applyFkFilters,
  openFkCreate: openFkCreateBase,
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
  openRecordViewer,
  ensureFkInstance,
  getFkInstance,
  ensureFkFilterInstance,
  getFkFilterInstance,
  ensureFkCreateInstance,
  getFkCreateInstance
});

// Pestaña activa del picker de plantillas (Crear/Seleccionar). Por defecto "Seleccionar".
const fkActiveTab = ref("select");
// Al abrir el picker para plantillas, prepara el form embebido del wizard (sin abrir el modal standalone) y
// lo marca en modo "crear desde FK" (al guardar, aplica la plantilla creada como selección). Al cerrarse, limpia.
watch(isFkTemplateArtifacts, async (isTpl) => {
  if (isTpl) {
    draftArtifactFkCreateMode.value = true;
    fkActiveTab.value = "create";
    draftArtifactPreselectDefinitionId.value = String(definitionArtifactsContext.value?.id || "");
    await openDraftArtifactModal(null, { force: true, show: false, preselectDefinitionId: draftArtifactPreselectDefinitionId.value });
  } else {
    draftArtifactFkCreateMode.value = false;
    draftArtifactPreselectDefinitionId.value = "";
  }
});

const openFkCreate = async () => {
  if (!canCreateFkReference.value) {
    return;
  }
  if (isFkTemplateArtifacts.value) {
    draftArtifactFkCreateMode.value = true;
    fkCreateExitTarget.value = "none";
    skipFkReturnRestore.value = true;
    // Si se está creando la plantilla desde la edición de una configuración, preselecciona esa config.
    draftArtifactPreselectDefinitionId.value = String(definitionArtifactsContext.value?.id || "");
    getFkInstance()?.hide();
    await openDraftArtifactModal(null, { force: true, preselectDefinitionId: draftArtifactPreselectDefinitionId.value });
    return;
  }
  openFkCreateBase();
};

// Editar una plantilla vinculada desde la pestaña Paquetes: abre el editor de la plantilla (modo edición).
// Se preserva el modal de paquetes vía el origen "definitionArtifacts" para volver a él al cerrar/guardar.
const draftArtifactReturnToPackages = ref(false);
const openDefinitionArtifactTemplateEditor = async (row, { fromPackages = true } = {}) => {
  const artifactId = row?.template_artifact_id;
  if (!artifactId) {
    return;
  }
  let artifactRow = null;
  try {
    const { data } = await adminSqlService.list("template_artifacts", { filter_id: artifactId, limit: 1 });
    artifactRow = Array.isArray(data) ? data[0] : (data?.rows?.[0] || data?.data?.[0] || null);
  } catch {
    artifactRow = null;
  }
  if (!artifactRow?.id) {
    return;
  }
  // El contenido solo se EDITA en borrador. Si está publicada/retirada, el editor abre en SOLO LECTURA (el
  // propio modal lo gobierna por lifecycle_state) con la acción "Nueva versión" para crear una versión editable.
  const isDraft = String(artifactRow.lifecycle_state || "published") === "draft";
  // Advertencia de impacto multi-config solo cuando se va a editar (borrador): afecta a todas las configuraciones.
  if (isDraft) {
    try {
      const { data } = await adminSqlService.list("process_definition_templates", {
        filter_template_artifact_id: artifactId,
        limit: 500
      });
      const rows = Array.isArray(data) ? data : (data?.rows || data?.data || []);
      const usageCount = rows.filter((r) => String(r.template_artifact_id) === String(artifactId)).length;
      if (usageCount > 1) {
        const ok = window.confirm(
          `Esta plantilla está vinculada a ${usageCount} configuraciones. Si editas su contenido, los cambios `
          + "afectarán a TODAS esas configuraciones. ¿Deseas continuar?"
        );
        if (!ok) {
          return;
        }
      }
    } catch {
      // Si no se pudo calcular el uso, no se bloquea la edición.
    }
  }
  // Desde el grafo (fromPackages=false) NO hay modal de paquetes al que volver: se abre el editor directo.
  if (fromPackages) {
    draftArtifactReturnToPackages.value = true;
    pushModalOrigin("definitionArtifacts");
    getDefinitionArtifactsInstance()?.hide();
  } else {
    draftArtifactReturnToPackages.value = false;
  }
  // force: estamos en el contexto de process_definition_versions, no de template_artifacts; sin force el
  // editor abortaría por el guard de tabla.
  await openDraftArtifactModal(artifactRow, { force: true });
};

// Click en un nodo de entregable en el grafo → abre el editor del entregable directamente (no el wizard de config).
const openTemplateEditorFromGraph = ({ templateArtifactId } = {}) => {
  if (!templateArtifactId) return;
  openDefinitionArtifactTemplateEditor({ template_artifact_id: templateArtifactId }, { fromPackages: false });
};

const returnToDefinitionArtifactsAfterEdit = async () => {
  draftArtifactReturnToPackages.value = false;
  restoreReturnModal();          // saca "definitionArtifacts" del stack y vuelve a mostrar el modal de paquetes
  await loadDefinitionArtifacts(); // refresca nombres/estado tras editar la plantilla
};

const handleDraftArtifactClose = () => {
  const shouldReturnToFkSearch = draftArtifactFkCreateMode.value;
  const shouldReturnToPackages = !shouldReturnToFkSearch && draftArtifactReturnToPackages.value;
  draftArtifactPreselectDefinitionId.value = "";
  closeDraftArtifactModal();
  if (shouldReturnToFkSearch) {
    draftArtifactFkCreateMode.value = false;
    ensureFkInstance();
    getFkInstance()?.show();
  } else if (shouldReturnToPackages) {
    returnToDefinitionArtifactsAfterEdit();
  }
};

const handleDraftArtifactSubmit = async () => {
  const createdRow = await submitDraftArtifact();
  // Edición desde Paquetes: al guardar correctamente, vuelve a la gestión de plantillas y refresca.
  if (!draftArtifactFkCreateMode.value && draftArtifactReturnToPackages.value && createdRow?.id) {
    await returnToDefinitionArtifactsAfterEdit();
    return;
  }
  if (!draftArtifactFkCreateMode.value || !createdRow?.id) {
    return;
  }
  draftArtifactFkCreateMode.value = false;
  applyFkSelection(createdRow);
  // Cierra el picker "Seleccionar plantilla" tras crear; su handler hidden.bs.modal restaura el modal de
  // origen (gestión de plantillas del proceso). Antes quedaba abierto encima.
  getFkInstance()?.hide();
  // La plantilla recién creada ya quedó vinculada a la configuración (auto-link del backend). Refresca la
  // tabla de plantillas del proceso para que aparezca de inmediato y limpia el form (ya no es "Agregar").
  if (definitionArtifactsContext.value?.id) {
    resetDefinitionArtifactsForm();
    await loadDefinitionArtifacts();
  }
};

// Descarga el ZIP de formatos del registro abierto en el visor (paquetes de plantilla o seeds).
const handleDownloadRecordArchive = async () => {
  const row = recordViewerRow.value;
  const tableName = recordViewerTable.value?.table;
  if (!row?.id || recordArchiveDownloading.value) {
    return;
  }
  let url = null;
  if (tableName === "template_artifacts") {
    url = API_ROUTES.ADMIN_SQL_TEMPLATE_ARTIFACT_DOWNLOAD(row.id);
  } else if (tableName === "template_seeds") {
    url = API_ROUTES.ADMIN_SQL_TEMPLATE_SEED_DOWNLOAD(row.id);
  }
  if (!url) {
    return;
  }
  recordArchiveDownloading.value = true;
  try {
    const response = await axios.get(url, { responseType: "blob" });
    const disposition = response.headers?.["content-disposition"] || "";
    const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
    const fallbackName = `${row.template_code || row.seed_code || row.display_name || "formatos"}.zip`.replaceAll("/", "-");
    const fileName = match ? decodeURIComponent(match[1]) : fallbackName;
    const blobUrl = URL.createObjectURL(response.data);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(blobUrl);
  } catch (error) {
    let message = error?.response?.data?.message || "No se pudo descargar el ZIP de formatos.";
    if (error?.response?.data instanceof Blob) {
      try {
        message = JSON.parse(await error.response.data.text())?.message || message;
      } catch {
        // se conserva el mensaje por defecto
      }
    }
    showFeedbackToast({ kind: "error", title: "Descarga fallida", message });
  } finally {
    recordArchiveDownloading.value = false;
  }
};

// Edición de código LaTeX (solo admin): descargar el contrato y re-subir el ZIP editado.
const isAdminUser = computed(() => hasAnyRole(["AdminSistema"]));
const templateSourceBusy = ref(false);

// Estado de sincronización del flujo (synced/stale/no_link) de la plantilla abierta en el visor.
const recordViewerSyncStatus = ref(null);
const recordViewerSyncBusy = ref(false);

const loadRecordViewerSyncStatus = async (artifactId) => {
  recordViewerSyncStatus.value = null;
  if (!artifactId) return;
  try {
    const { data } = await axios.get(API_ROUTES.ADMIN_SQL_TEMPLATE_ARTIFACT_SYNC_STATUS(artifactId));
    recordViewerSyncStatus.value = data;
  } catch {
    recordViewerSyncStatus.value = null;
  }
};

const handleResyncTemplateWorkflows = async () => {
  const row = recordViewerRow.value;
  if (!row?.id || recordViewerSyncBusy.value) return;
  recordViewerSyncBusy.value = true;
  try {
    const { data } = await axios.post(API_ROUTES.ADMIN_SQL_TEMPLATE_ARTIFACT_RESYNC(row.id));
    recordViewerSyncStatus.value = data;
    showFeedbackToast({ kind: "success", title: "Flujos sincronizados", message: "La proyección del flujo en la base de datos quedó al día." });
  } catch (error) {
    showFeedbackToast({ kind: "error", title: "No se pudo sincronizar", message: error?.response?.data?.message || "No se pudo re-sincronizar el flujo." });
  } finally {
    recordViewerSyncBusy.value = false;
  }
};

const handleDownloadTemplateSource = async () => {
  const row = recordViewerRow.value;
  if (!recordViewerEditable.value || !row?.id || templateSourceBusy.value) return;
  templateSourceBusy.value = true;
  try {
    const response = await axios.get(API_ROUTES.ADMIN_SQL_TEMPLATE_ARTIFACT_SOURCE(row.id), { responseType: "blob" });
    const blobUrl = URL.createObjectURL(response.data);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `${row.template_code || `plantilla-${row.id}`}-source.zip`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(blobUrl);
  } catch (error) {
    showFeedbackToast({ kind: "error", title: "Descarga fallida", message: error?.response?.data?.message || "No se pudo descargar el código." });
  } finally {
    templateSourceBusy.value = false;
  }
};

const handleUploadTemplateSource = async (file) => {
  const row = recordViewerRow.value;
  if (!recordViewerEditable.value || !row?.id || !file || templateSourceBusy.value) return;
  templateSourceBusy.value = true;
  try {
    const form = new FormData();
    form.append("source", file);
    const { data } = await axios.post(API_ROUTES.ADMIN_SQL_TEMPLATE_ARTIFACT_SOURCE(row.id), form);
    showFeedbackToast({ kind: "success", title: "Código actualizado", message: data?.__notice || "Se creó una nueva versión con el código editado." });
  } catch (error) {
    showFeedbackToast({ kind: "error", title: "No se pudo actualizar el código", message: error?.response?.data?.message || "La re-subida no cumple el contrato o falló." });
  } finally {
    templateSourceBusy.value = false;
  }
};

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
  personCargoPositionSuggestProvider,
  personRoleRoleSuggestProvider,
  personRoleUnitSuggestProvider,
  personContractPositionSuggestProvider,
  selectPersonCargoOption,
  selectPersonRoleOption,
  selectPersonContractOption,
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
  resolveFkSuggestions,
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
  handleDefinitionRuleRecipientPolicyChange,
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
  definitionTriggerSuggestProvider,
  selectDefinitionTriggerOption,
  definitionRuleSuggestProviders,
  selectDefinitionRuleOption,
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
  submitDefinitionArtifact,
  setDefinitionArtifactItemMode,
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
  definitionRulesSeriesScope,
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
  resolveFkSuggestions,
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
  processDefinitionActivationHasActiveArtifacts,
  processDefinitionActivationView,
  processDefinitionActivationPrimaryAction,
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

// ── Wizard guiado de proceso (creación → activación) ──
const {
  wizardOpen: processWizardOpen,
  currentStep: processWizardStep,
  definitionContext: processWizardDefinition,
  definitionForm: processWizardDefinitionForm,
  duplicateDefinition: processWizardDuplicateDefinition,
  processOptions: processWizardProcessOptions,
  unitTypeOptions: processWizardUnitTypeOptions,
  cargoOptions: processWizardCargoOptions,
  seriesOptions: processWizardSeriesOptions,
  seriesCodePreview: processWizardSeriesCodePreview,
  processSlugPreview: processWizardProcessSlugPreview,
  definitionNamePreview: processWizardDefinitionNamePreview,
  creatingDefinition: processWizardCreating,
  wizardError: processWizardError,
  stepStatus: processWizardStepStatus,
  steps: processWizardSteps,
  openWizard: openProcessWizard,
  closeWizard: closeProcessWizard,
  goToStep: processWizardGoToStep,
  createDefinition: runProcessWizardCreateDefinition,
  refreshStepStatus: refreshProcessWizardStatus
} = useProcessWizard();

const loadProcessWizardStep = async (key) => {
  const def = processWizardDefinition.value;
  if (!def?.id) {
    return;
  }
  if (key === "packages") {
    await openDefinitionArtifactsManager(def, { showModal: false });
  } else if (key === "rules") {
    await openDefinitionRulesManager(def, { showModal: false });
  } else if (key === "triggers") {
    await openDefinitionTriggersManager(def, { showModal: false });
  } else if (key === "activate") {
    selectedRow.value = def;
    await loadProcessWizardActivationStep(def);
  }
};

const loadProcessWizardActivationStep = async (definitionRow) => {
  if (!definitionRow?.id) {
    return;
  }
  processDefinitionActivationChecking.value = true;
  processDefinitionActivationView.value = "activate";
  try {
    const checklist = await processDefinitionAdminService.evaluateChecklist(definitionRow.id);
    await loadProcessDefinitionActivationDetail(definitionRow.id);
    processDefinitionActivationHasActiveRules.value = Boolean(checklist?.rules);
    processDefinitionActivationHasActiveTriggers.value = Boolean(checklist?.triggers);
  } catch {
    processDefinitionActivationHasActiveRules.value = false;
    processDefinitionActivationHasActiveTriggers.value = true;
    processDefinitionActivationRules.value = [];
    processDefinitionActivationTriggers.value = [];
    processDefinitionActivationArtifacts.value = [];
  } finally {
    processDefinitionActivationChecking.value = false;
  }
};

const handleProcessWizardGoToStep = async (key) => {
  processWizardGoToStep(key);
  if (processWizardStep.value === key && key !== "definition") {
    await loadProcessWizardStep(key);
    await refreshProcessWizardStatus();
  }
};

// Vinculación con el modal de plantilla: cuando el wizard se abre desde "Crear proceso", al crear la
// configuración se devuelve su id al modal para preseleccionarla.
const wizardFromDraft = ref(false);
const draftNewProcessDefinitionId = ref("");
// Configuración de origen a preseleccionar cuando se crea una plantilla desde el flujo de edición.
const draftArtifactPreselectDefinitionId = ref("");

const handleProcessWizardCreateDefinition = async () => {
  // Tras crear/confirmar la definición se avanza a Reglas (paso siguiente), que deben definirse antes
  // que los Paquetes para que los ámbitos de contexto del flujo de entrega sean resolubles.
  if (processWizardDefinition.value?.id) {
    await handleProcessWizardGoToStep("rules");
    return;
  }
  const created = await runProcessWizardCreateDefinition();
  if (created?.id) {
    if (wizardFromDraft.value) {
      draftNewProcessDefinitionId.value = String(created.id);
    }
    await loadProcessWizardStep("rules");
  }
};

const handleProcessWizardEditExistingDefinition = async (definitionRow) => {
  if (!definitionRow?.id) {
    return;
  }
  processWizardReadonly.value = false;
  await openProcessDefinitionWizard(definitionRow, { step: "definition", readonly: false });
};

const handleDraftCreateProcess = async () => {
  wizardFromDraft.value = true;
  processWizardReadonly.value = false;
  await openProcessWizard();
};

const handleProcessWizardClose = async () => {
  closeProcessWizard();
  wizardFromDraft.value = false;
  processWizardReadonly.value = false;
  processDefinitionCloneSourceId.value = "";
  // Si el wizard se abrió desde el organigrama, refresca los procesos de la unidad abierta.
  if (unitGraphMode.value) {
    await unitGraphRef.value?.refreshProcesses?.();
  }
  // Si se abrió desde el mapa de procesos, recarga el grafo y reabre el drawer del proceso.
  if (processGraphMode.value && processGraphReturnId.value) {
    const pid = processGraphReturnId.value;
    processGraphReturnId.value = null;
    await processGraphRef.value?.reopenDetail(pid);
  }
  if (props.table?.table === "process_definition_versions") {
    await fetchRows();
  }
  if (props.table?.table === "processes" && editorMode.value === "edit" && processEditorContext.value?.id) {
    selectedRow.value = processEditorContext.value;
    await loadProcessEditorConfigurations(processEditorContext.value.id);
  }
};

// Tras guardar dentro de un paso embebido, refresca el estado del stepper.
const refreshWizardAfter = async (action) => {
  await action();
  if (processWizardOpen.value) {
    await refreshProcessWizardStatus();
  }
};
const wizardSubmitArtifact = () => refreshWizardAfter(submitDefinitionArtifact);
const wizardSubmitRule = () => refreshWizardAfter(submitDefinitionRule);
const wizardSubmitTrigger = () => refreshWizardAfter(submitDefinitionTrigger);
const showWizardActivateConfirm = ref(false);
const confirmWizardActivation = async () => {
  showWizardActivateConfirm.value = false;
  await wizardConfirmActivation();
};
const wizardConfirmActivation = async () => {
  const definitionRow = processWizardDefinition.value;
  if (!definitionRow?.id) {
    return;
  }
  if (props.table?.table === "process_definition_versions") {
    await confirmProcessDefinitionActivation();
    closeProcessWizard();
    await fetchRows();
    return;
  }
  processDefinitionActivationChecking.value = true;
  processWizardError.value = "";
  try {
    const response = await adminSqlService.update(
      "process_definition_versions",
      { id: Number(definitionRow.id) },
      { status: "active" }
    );
    processWizardDefinition.value = {
      ...definitionRow,
      ...(response?.data && typeof response.data === "object" ? response.data : {}),
      status: "active"
    };
    if (response?.data?.__notice) {
      showFeedbackToast({
        kind: "success",
        title: "Configuracion activada",
        message: response.data.__notice,
        duration: 6200
      });
    } else {
      showFeedbackToast({
        kind: "success",
        title: "Configuracion activada",
        message: "La configuracion del proceso fue activada."
      });
    }
    await handleProcessWizardClose();
  } catch (error) {
    processWizardError.value = error?.response?.data?.message || "No se pudo activar la configuracion.";
    showFeedbackToast({
      kind: "error",
      title: "No se pudo activar",
      message: processWizardError.value
    });
  } finally {
    processDefinitionActivationChecking.value = false;
  }
};

const handleOpenWizardFromPrompt = async () => {
  const context = definitionArtifactsPromptContext.value;
  closeDefinitionArtifactsPrompt();
  if (context?.id) {
    processWizardReadonly.value = false;
    await openProcessWizard({ definitionRow: context, step: "packages" });
  }
};

// Punto de entrada para crear un proceso desde otros flujos (p.ej. el modal de plantilla).
const openProcessWizardFromScratch = async () => {
  processWizardReadonly.value = false;
  processDefinitionCloneSourceId.value = "";
  await openProcessWizard();
};

// --- Mapa de procesos: acciones del drawer (un modal a la vez). El grafo cierra su drawer y delega aquí;
// al cerrarse el wizard/lanzamiento se reabre el drawer vía processGraphRef.reopenDetail(processGraphReturnId).
const processGraphReturnId = ref(null);

const openConfigWizardFromGraph = async ({ processId, processName } = {}) => {
  processGraphReturnId.value = processId || null;
  processWizardReadonly.value = false;
  processDefinitionCloneSourceId.value = "";
  await openProcessWizard({
    processRow: processId ? { id: processId, name: processName || `Proceso ${processId}` } : null
  });
};

const editConfigFromGraph = async ({ processId, definition, step = "definition", readonly = false } = {}) => {
  if (!definition?.definition_id) return;
  processGraphReturnId.value = processId || null;
  await openProcessDefinitionWizard(
    {
      id: definition.definition_id,
      name: definition.definition_name,
      process_id: processId,
      process_name: definition.process_name,
      status: definition.status,
      variation_key: definition.variation_key,
      definition_version: definition.definition_version,
      series_id: definition.series_id
    },
    { step, readonly }
  );
};

const launchConfigFromGraph = async ({ processId, definition } = {}) => {
  if (!definition?.definition_id) return;
  processGraphReturnId.value = processId || null;
  await processDefinitionLaunchModal.value?.openModal({
    id: definition.definition_id,
    name: definition.definition_name
  });
};

// Versionar una configuración desde su nodo: abre el wizard de nueva versión (clona la definición).
const versionConfigFromGraph = async ({ processId, definition } = {}) => {
  if (!definition?.definition_id) return;
  processGraphReturnId.value = processId || null;
  await openProcessDefinitionVersionWizard({
    id: definition.definition_id,
    process_id: processId,
    process_name: definition.process_name,
    series_id: definition.series_id,
    variation_key: definition.variation_key,
    definition_version: definition.definition_version
  });
};

// --- Versionado de plantillas con diálogo de nivel (Parche/Menor/Mayor), reutilizado por tabla y grafo ---
// mode 'version' = versión simple de plantilla; mode 'guided' = actualización guiada plantilla+config activa (F2).
const templateVersionDialog = ref({ open: false, template: null, mode: "version", definitionId: null });
const templateVersionBusy = ref(false);
// Contexto de la actualización guiada en curso (borradores creados, pendientes de publicar/activar).
const guidedUpdateContext = ref(null);
// configDraftId solo cuando el editor abierto ES la plantilla borrador de la actualización guiada en curso.
const guidedEditorConfigId = computed(() => {
  const ctx = guidedUpdateContext.value;
  if (!ctx?.templateDraftId || !ctx?.configDraftId) return null;
  return Number(draftArtifactEditId.value) === ctx.templateDraftId ? ctx.configDraftId : null;
});

const openTemplateVersionDialog = (template) => {
  if (!template?.id && !template?.template_artifact_id) return;
  templateVersionDialog.value = {
    open: true,
    mode: "version",
    definitionId: null,
    template: {
      id: template.id || template.template_artifact_id,
      template_code: template.template_code,
      display_name: template.display_name,
      storage_version: template.storage_version
    }
  };
};
const openGuidedTemplateUpdate = ({ definitionId, templateArtifactId, displayName, templateCode, storageVersion } = {}) => {
  if (!definitionId || !templateArtifactId) return;
  templateVersionDialog.value = {
    open: true,
    mode: "guided",
    definitionId,
    template: {
      id: templateArtifactId,
      template_code: templateCode,
      display_name: displayName,
      storage_version: storageVersion
    }
  };
};
const closeTemplateVersionDialog = () => {
  templateVersionDialog.value = { open: false, template: null, mode: "version", definitionId: null };
};
const handleVersionDialogConfirm = (level) => {
  if (templateVersionDialog.value.mode === "guided") {
    return confirmGuidedTemplateUpdateStart(level);
  }
  return confirmTemplateVersion(level);
};
const confirmTemplateVersion = async (level) => {
  const tpl = templateVersionDialog.value.template;
  if (!tpl?.id || templateVersionBusy.value) return;
  templateVersionBusy.value = true;
  try {
    const { data } = await adminSqlService.createTemplateArtifactVersion(tpl.id, level || "minor");
    showFeedbackToast({
      kind: "success",
      title: "Nueva versión creada",
      message: data?.__notice || "Se creó una nueva versión en borrador. Edítala y publícala cuando esté lista."
    });
    closeTemplateVersionDialog();
    await fetchRows();
    if (processGraphMode.value) {
      await processGraphRef.value?.reloadGraph?.();
    }
    // Abre la nueva versión (borrador) en el editor para editarla de inmediato.
    const newId = data?.id;
    if (newId) {
      try {
        const { data: rowData } = await adminSqlService.list("template_artifacts", { filter_id: newId, limit: 1 });
        const row = Array.isArray(rowData) ? rowData[0] : (rowData?.rows?.[0] || rowData?.data?.[0] || null);
        if (row?.id) {
          await openDraftArtifactModal(row, { force: true });
        }
      } catch {
        // Si falla la apertura, la nueva versión ya quedó creada y visible en la tabla.
      }
    }
  } catch (err) {
    showFeedbackToast({
      kind: "error",
      title: "No se pudo versionar",
      message: err?.response?.data?.message || "Error al crear la nueva versión."
    });
  } finally {
    templateVersionBusy.value = false;
  }
};

// Versionar desde el grafo (nodo de entregable): abre el mismo diálogo de nivel.
const versionTemplateFromGraph = ({ templateArtifactId, displayName, templateCode } = {}) => {
  if (!templateArtifactId) return;
  openTemplateVersionDialog({ id: templateArtifactId, display_name: displayName, template_code: templateCode });
};

// F2 paso 1: crea borradores de plantilla + config (re-apuntada) y abre la plantilla borrador en el editor.
const confirmGuidedTemplateUpdateStart = async (level) => {
  const tpl = templateVersionDialog.value.template;
  const definitionId = templateVersionDialog.value.definitionId;
  if (!tpl?.id || !definitionId || templateVersionBusy.value) return;
  templateVersionBusy.value = true;
  try {
    const { data } = await adminSqlService.startGuidedTemplateUpdate(definitionId, tpl.id, level || "minor");
    guidedUpdateContext.value = {
      templateDraftId: Number(data?.template_draft_id),
      configDraftId: Number(data?.config_draft_id)
    };
    showFeedbackToast({
      kind: "success",
      title: "Borradores creados",
      message: data?.__notice || "Edita la plantilla y publica para activar la nueva configuración."
    });
    closeTemplateVersionDialog();
    await fetchRows();
    if (processGraphMode.value) {
      await processGraphRef.value?.reloadGraph?.();
    }
    const newId = guidedUpdateContext.value.templateDraftId;
    if (newId) {
      try {
        const { data: rowData } = await adminSqlService.list("template_artifacts", { filter_id: newId, limit: 1 });
        const row = Array.isArray(rowData) ? rowData[0] : (rowData?.rows?.[0] || rowData?.data?.[0] || null);
        if (row?.id) {
          await openDraftArtifactModal(row, { force: true });
        }
      } catch {
        // La plantilla borrador quedó creada y visible aunque no se abra el editor.
      }
    }
  } catch (err) {
    showFeedbackToast({
      kind: "error",
      title: "No se pudo iniciar la actualización",
      message: err?.response?.data?.message || "Error al crear los borradores."
    });
  } finally {
    templateVersionBusy.value = false;
  }
};

// F2 paso 2: publica la plantilla borrador y activa la config borrador (atómico en el backend).
const finishGuidedTemplateUpdate = async () => {
  const ctx = guidedUpdateContext.value;
  if (!ctx?.templateDraftId || !ctx?.configDraftId) return;
  try {
    const { data } = await adminSqlService.finishGuidedTemplateUpdate(ctx.templateDraftId, ctx.configDraftId);
    showFeedbackToast({
      kind: "success",
      title: "Plantilla publicada y configuración activada",
      message: data?.__notice || "La nueva versión quedó publicada y la configuración activa."
    });
    guidedUpdateContext.value = null;
    closeDraftArtifactModal();
    await fetchRows();
    if (processGraphMode.value) {
      await processGraphRef.value?.reloadGraph?.();
    }
  } catch (err) {
    showFeedbackToast({
      kind: "error",
      title: "No se pudo publicar/activar",
      message: err?.response?.data?.message || "Error al publicar la plantilla y activar la configuración."
    });
  }
};

// Agregar entregable desde el grafo: abre el gestor de plantillas de esa configuración (modal enfocado
// "Plantillas del proceso", NO el wizard de proceso). Desde ahí se crea/selecciona la plantilla.
const addTemplateFromGraph = async ({ definition } = {}) => {
  const id = definition?.definition_id || definition?.id;
  if (!id) return;
  processGraphReturnId.value = definition?.process_id || null;
  await openDefinitionArtifactsManager(
    {
      id,
      status: definition?.status,
      name: definition?.definition_name,
      variation_key: definition?.variation_key,
      definition_version: definition?.definition_version,
      process_id: definition?.process_id,
      process_name: definition?.process_name
    },
    { showModal: true }
  );
};

// Al cerrar/aceptar el gestor de plantillas: si vino del grafo, recarga el grafo para reflejar el cambio.
const reloadGraphAfterArtifacts = async () => {
  if (processGraphMode.value && processGraphReturnId.value) {
    processGraphReturnId.value = null;
    await processGraphRef.value?.reloadGraph?.();
  }
};
const handleDefinitionArtifactsManagerClose = async () => {
  closeDefinitionArtifactsManager();
  await reloadGraphAfterArtifacts();
};
const handleDefinitionArtifactsManagerAccept = async () => {
  acceptDefinitionArtifactsManager();
  await reloadGraphAfterArtifacts();
};

// Crear un entregable a partir de otro: precarga el modal en modo creación con los datos del origen
// (nombre "(copia)", semilla, campos y flujos), vinculado a la misma configuración. Útil para variar una
// plantilla oficial sin tocar la original (su contenido se gestiona por el pipeline).
const cloneTemplateFromGraph = async ({ templateArtifactId, definitionId } = {}) => {
  if (!templateArtifactId) return;
  let source = null;
  try {
    const { data } = await adminSqlService.list("template_artifacts", { filter_id: templateArtifactId, limit: 1 });
    source = Array.isArray(data) ? data[0] : (data?.rows?.[0] || data?.data?.[0] || null);
  } catch {
    source = null;
  }
  if (!source?.id) {
    showFeedbackToast({ kind: "error", title: "No se pudo clonar", message: "No se encontró la plantilla de origen." });
    return;
  }
  await openDraftArtifactModal(null, { force: true, preselectDefinitionId: definitionId ? String(definitionId) : "", cloneFrom: source });
};

// Reabre el drawer del proceso tras cerrar el modal de lanzamiento (solo si vino del grafo).
const handleProcessGraphLaunchClose = async () => {
  if (!processGraphMode.value || !processGraphReturnId.value) return;
  const pid = processGraphReturnId.value;
  processGraphReturnId.value = null;
  await processGraphRef.value?.reopenDetail(pid);
};

const openProcessDefinitionWizard = async (row, { step = "definition", readonly = false } = {}) => {
  if (!row?.id) {
    return;
  }
  processWizardReadonly.value = Boolean(readonly);
  processDefinitionCloneSourceId.value = "";
  selectedRow.value = row;
  await openProcessWizard({ definitionRow: row, step });
  if (step !== "definition") {
    await loadProcessWizardStep(step);
  }
};

const openProcessDefinitionVersionWizard = async (row) => {
  if (!row?.id) {
    return;
  }
  const processId = row.process_id ?? "";
  processWizardReadonly.value = false;
  processDefinitionCloneSourceId.value = row.id ? String(row.id) : "";
  await openProcessWizard({
    processRow: processId
      ? {
          id: processId,
          name: row.process_name || row.process_label || `Proceso ${processId}`
        }
      : null
  });
  if (
    row.series_id
    && !processWizardSeriesOptions.value.some((option) => String(option.id) === String(row.series_id))
  ) {
    processWizardSeriesOptions.value.push({
      id: row.series_id,
      code: row.variation_key || `variacion-${row.series_id}`,
      displayName: row.variation_key || `Variación ${row.series_id}`,
      label: row.variation_key || `Variación ${row.series_id}`,
      is_active: 1
    });
  }
  processWizardDefinitionForm.value = {
    ...processWizardDefinitionForm.value,
    process_mode: "existing",
    process_id: processId ? String(processId) : "",
    series_id: row.series_id ? String(row.series_id) : "",
    definition_version: getNextSemanticVersion(row.definition_version),
    description: row.description || "",
    source_process_definition_id: row.id ? String(row.id) : ""
  };
};

const hideProcessWizardForRecordViewer = () => {
  if (!processWizardOpen.value) {
    return;
  }
  restoreProcessWizardAfterRecordViewer.value = true;
  closeProcessWizard();
};

const restoreProcessWizardFromRecordViewer = () => {
  if (!restoreProcessWizardAfterRecordViewer.value) {
    return;
  }
  restoreProcessWizardAfterRecordViewer.value = false;
  processWizardOpen.value = true;
};

const handleOpenRecordViewer = async (row, tableRef) => {
  if (tableRef?.table === "process_definition_versions") {
    if (isModalShown(recordViewerModal.value)) {
      closeRecordViewer();
    }
    await openProcessDefinitionWizard(row, { step: "definition", readonly: true });
    return;
  }
  await openRecordViewer(row, tableRef);
  if (tableRef?.table === "template_artifacts") {
    await loadRecordViewerSyncStatus(row?.id);
  }
};

const handleWizardViewRow = async (row, tableMeta) => {
  if (!row || !tableMeta) {
    return;
  }
  hideProcessWizardForRecordViewer();
  await handleOpenRecordViewer(row, tableMeta);
};

const handleRecordViewerRelatedRecord = async ({ row, tableMeta } = {}) => {
  if (!row || !tableMeta) {
    return;
  }
  await handleOpenRecordViewer(row, tableMeta);
};

const handleActivationViewRow = async ({ row, table } = {}) => {
  const tableMeta = typeof table === "string" ? allTablesMap.value?.[table] : table;
  if (!row || !tableMeta) {
    return;
  }
  hideProcessWizardForRecordViewer();
  await handleOpenRecordViewer(row, tableMeta);
};

const openProcessConfiguration = async (processRow) => {
  if (!processRow?.id || !canCreateProcessConfiguration.value) {
    return;
  }
  processWizardReadonly.value = false;
  await openProcessWizard({ processRow });
};

// Abre el modal de lanzamiento de procesos para un periodo (term).
const openProcessLaunch = async (termRow) => {
  if (!termRow?.id) return;
  await processLaunchModal.value?.openModal(termRow);
};

// Abre el modal de lanzamiento desde una configuración de proceso (elegir periodo + historial).
const openProcessDefinitionLaunch = async (definitionRow) => {
  if (!definitionRow?.id) return;
  await processDefinitionLaunchModal.value?.openModal(definitionRow);
};

const openProcessConfigurationFromEditor = async () => {
  const processRow = processEditorContext.value || selectedRow.value;
  if (props.table?.table !== "processes" || editorMode.value !== "edit" || !processRow?.id) {
    return;
  }
  await openProcessConfiguration(processRow);
};

const openProcessConfigurationFromViewer = async () => {
  if (!recordViewerEditable.value) {
    return;
  }
  const processRow = recordViewerTable.value?.table === "processes"
    ? recordViewerRow.value
    : null;
  if (!processRow?.id) {
    return;
  }
  closeRecordViewer();
  await openProcessConfiguration(processRow);
};

const ensureProcessConfigurationDeleteInstance = () => {
  const modalElement = resolveModalElement(processConfigurationDeleteModal.value);
  if (!processConfigurationDeleteInstance && modalElement) {
    processConfigurationDeleteInstance = new Modal(modalElement);
    modalElement.addEventListener("hidden.bs.modal", () => {
      processConfigurationDeleteRow.value = null;
    });
  }
};

const deleteProcessEditorConfiguration = (row) => {
  if (!row?.id || !canDeleteProcessConfigurationRow(row)) {
    return;
  }
  processConfigurationDeleteRow.value = row;
  ensureProcessConfigurationDeleteInstance();
  processConfigurationDeleteInstance?.show();
};

const confirmDeleteProcessEditorConfiguration = async () => {
  const row = processConfigurationDeleteRow.value;
  if (!row?.id || !canDeleteProcessConfigurationRow(row)) {
    return;
  }
  processEditorConfigurationsLoading.value = true;
  processEditorConfigurationsError.value = "";
  try {
    await adminSqlService.remove("process_definition_versions", { id: Number(row.id) });
    await loadProcessEditorConfigurations(processEditorContext.value?.id || selectedRow.value?.id);
    await fetchRows();
    processConfigurationDeleteInstance?.hide();
    processConfigurationDeleteRow.value = null;
    showFeedbackToast({
      kind: "success",
      title: "Configuracion eliminada",
      message: "La configuracion en borrador fue eliminada del proceso."
    });
  } catch (error) {
    processEditorConfigurationsError.value = error?.response?.data?.message || "No se pudo eliminar la configuracion.";
    showFeedbackToast({
      kind: "error",
      title: "No se pudo eliminar",
      message: processEditorConfigurationsError.value
    });
  } finally {
    processEditorConfigurationsLoading.value = false;
  }
};

// Retiro (desactivación) de una configuración activa. En el modelo, una configuración activa solo
// admite retirarse (active -> retired); no puede volver a borrador ni editarse en su versión actual.
const retireDefinitionModal = ref(null);
const retireDefinitionRow = ref(null);
let retireDefinitionInstance = null;

const ensureRetireDefinitionInstance = () => {
  const modalElement = resolveModalElement(retireDefinitionModal.value);
  if (!retireDefinitionInstance && modalElement) {
    retireDefinitionInstance = new Modal(modalElement);
    modalElement.addEventListener("hidden.bs.modal", () => {
      retireDefinitionRow.value = null;
    });
  }
};

const retireProcessDefinition = (row) => {
  if (!row?.id || String(row.status || "").toLowerCase() !== "active") {
    return;
  }
  retireDefinitionRow.value = { ...row };
  ensureRetireDefinitionInstance();
  retireDefinitionInstance?.show();
};

const confirmRetireProcessDefinition = async () => {
  const row = retireDefinitionRow.value;
  if (!row?.id) {
    return;
  }
  try {
    const payload = { status: "retired" };
    if (!row.effective_to) {
      payload.effective_to = new Date().toISOString().slice(0, 10);
    }
    await adminSqlService.update(
      "process_definition_versions",
      { id: Number(row.id) },
      payload
    );
    retireDefinitionInstance?.hide();
    retireDefinitionRow.value = null;
    showFeedbackToast({
      kind: "success",
      title: "Configuración retirada",
      message: "La configuración fue retirada y quedó en solo lectura."
    });
    await fetchRows();
  } catch (error) {
    showFeedbackToast({
      kind: "error",
      title: "No se pudo retirar",
      message: error?.response?.data?.message || "No se pudo retirar la configuración."
    });
  }
};

const {
  openCreate: openCreateBase,
  handlePrimaryCreateAction: handlePrimaryCreateActionBase,
  openEdit: openEditBase,
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
  isProcessDefinitionFilterTable,
  isProcessDefinitionTemplatesTable,
  resetInlineFkState,
  closeProcessDefinitionVersioningModal: (...args) => closeProcessDefinitionVersioningModal(...args),
  resetForm,
  applyUnitRelationDefaults,
  ensureEditorInstance,
  getEditorInstance,
  openDraftArtifactModal,
  openProcessWizardFromScratch,
  openProcessDefinitionWizard,
  openProcessDefinitionVersionWizard,
  showFeedbackToast,
  buildFormFromRow,
  refreshFormFkDisplayLabels,
  refreshProcessDefinitionChecklist,
  setFkLabel,
  formatFkOptionLabel,
  getNextSemanticVersion
});

const resetProcessEditorConfigurationState = () => {
  processEditorContext.value = null;
  processEditorConfigurations.value = [];
  processEditorConfigurationsError.value = "";
  processEditorConfigurationsLoading.value = false;
  processConfigurationDeleteRow.value = null;
};

const openCreate = async (...args) => {
  resetProcessEditorConfigurationState();
  return openCreateBase(...args);
};

const handlePrimaryCreateAction = async (...args) => {
  resetProcessEditorConfigurationState();
  return handlePrimaryCreateActionBase(...args);
};

const openEdit = async (row) => {
  const result = await openEditBase(row);
  if (props.table?.table === "processes" && !result?.blocked && !result?.redirected && row?.id) {
    processEditorContext.value = { ...row };
    await loadProcessEditorConfigurations(row.id);
  } else if (props.table?.table !== "processes") {
    processEditorContext.value = null;
    processEditorConfigurations.value = [];
    processEditorConfigurationsError.value = "";
  }
  return result;
};

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
  openProcessFkSearch,
  processParentSuggestProvider,
  templateProcessSuggestProvider,
  documentTaskSuggestProvider,
  selectProcessFilterOption,
  selectTemplateProcessFilterOption,
  selectDocumentFilterOption
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
  resolveFkSuggestions,
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
  openProcessConfiguration,
  openProcessDefinitionActivationModal,
  openProcessDefinitionVersioningModal,
  openProcessLaunch,
  showFeedbackToast,
  getDeleteInstance
});


// El estado por-tabla se resetea SOLO por el remontaje: App.vue monta la vista con
// :key="route.fullPath", asi que cambiar de tabla/seccion recrea AdminTableManager con el setup
// fresco (searchTerm="", filtros vacios, modales cerrados, opciones vacias). Antes esto lo emulaba
// a mano useAdminTableReset (watch sobre props.table + reset de ~40 refs); con el remontaje solo
// queda su carga inicial (opciones de filtro segun el tipo de tabla + fetch de filas).
onMounted(async () => {
  if (isPositionFilterTable.value) {
    await loadUnitPositionUnitTypeOptions();
    await loadUnitPositionCargoOptions();
  }
  if (isPositionAssignmentsTable.value) {
    await loadVacantPositionUnitTypeOptions();
    await loadVacantPositionCargoOptions();
  }
  if (isProcessDefinitionFilterTable.value) {
    await loadProcessDefinitionProcessOptions();
    await loadProcessDefinitionSeriesOptions();
  }
  await fetchRows();
});

onBeforeUnmount(() => {
  resetInlineFkState();
});

defineExpose({
  openCreate,
  openDraftArtifactModal
});
</script>

