<template>
  <div class="container-fluid py-4">
    <div
      v-if="feedbackToast.visible"
      class="admin-feedback-toast"
      :class="`is-${feedbackToast.kind}`"
      role="status"
      aria-live="polite"
    >
      <div class="admin-feedback-toast-body">
        <div class="admin-feedback-toast-copy">
          <strong class="admin-feedback-toast-title">{{ feedbackToast.title }}</strong>
          <div class="admin-feedback-toast-message">{{ feedbackToast.message }}</div>
        </div>
        <button
          type="button"
          class="btn btn-sm btn-icon admin-feedback-toast-close"
          title="Cerrar"
          aria-label="Cerrar"
          @click="hideFeedbackToast"
        >
          <font-awesome-icon icon="times" />
        </button>
      </div>
    </div>

    <div class="profile-section-header">
      <div>
        <h2 class="text-start profile-section-title table-title-with-icon">
          <span
            class="table-title-icon"
            :class="{ 'is-template-artifacts': isTemplateArtifactsTable }"
            aria-hidden="true"
          >
            <font-awesome-icon :icon="tableHeaderIcon" />
          </span>
          <span>{{ tableHeaderTitle }}</span>
        </h2>
        <p class="profile-section-subtitle">
          {{ tableHeaderSubtitle }}
        </p>
      </div>
      <div class="profile-section-actions">
        <div class="d-flex gap-2">
          <button
            class="btn btn-outline-secondary btn-lg"
            type="button"
            :disabled="!table"
            title="Regresar"
            aria-label="Regresar"
            @click="handleGoBack"
          >
            <font-awesome-icon icon="backward" />
          </button>
          <button
            class="btn btn-outline-secondary btn-lg"
            type="button"
            :disabled="!table"
            @click="handleSearchAction"
          >
            Buscar
          </button>
          <button
            v-if="isTemplateSeedsTable"
            class="btn btn-outline-secondary btn-lg"
            type="button"
            :disabled="!table || loading"
            @click="syncTemplateSeedsFromSource"
          >
            <font-awesome-icon icon="rotate-right" class="me-2" />
            Sincronizar seeds
          </button>
          <button
            v-if="isTemplateArtifactsTable"
            class="btn btn-outline-secondary btn-lg"
            type="button"
            :disabled="!table || loading"
            @click="syncTemplateArtifactsFromDist"
          >
            <font-awesome-icon icon="rotate-right" class="me-2" />
            Sincronizar dist
          </button>
          <button
            class="btn btn-primary btn-lg profile-add-btn"
            type="button"
            :disabled="!table"
            @click="handlePrimaryCreateAction"
          >
            <font-awesome-icon icon="plus" class="me-2" />
            Agregar
          </button>
        </div>
      </div>
    </div>

    <div v-if="!table" class="row">
      <div class="col-12">
        <div class="card shadow-sm">
          <div class="card-body">
            <p class="text-muted mb-0">Selecciona una tabla para administrar.</p>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="row">
      <div class="col-12">
        <div class="card shadow-sm">
          <div class="card-body">
            <div class="row g-3 align-items-center mb-3">
              <div :class="isPositionFilterTable ? 'col-12 col-lg-3' : isProcessDefinitionFilterTable ? 'col-12 col-md-6 col-lg-2' : isProcessTargetRuleFilterTable ? 'col-12 col-md-6 col-lg-3' : isTemplateArtifactsTable ? 'col-12 col-md-6 col-lg-3' : 'col-12 col-md-6'">
                <input
                  ref="searchInput"
                  v-model="searchTerm"
                  type="text"
                  class="form-control"
                  placeholder="Buscar en la tabla"
                  @input="debouncedSearch"
                />
              </div>
              <template v-if="isPositionFilterTable">
                <div class="col-12 col-md-4 col-lg-2">
                  <select
                    v-model="unitPositionFilters.unit_type_id"
                    class="form-select"
                    :disabled="unitPositionFilterLoading"
                    @change="handleUnitPositionTypeChange"
                  >
                    <option value="">Tipo de unidad</option>
                    <option
                      v-for="row in unitPositionUnitTypeOptions"
                      :key="row.id"
                      :value="String(row.id)"
                    >
                      {{ formatFkOptionLabel("unit_types", row) }}
                    </option>
                  </select>
                </div>
                <div class="col-12 col-md-4 col-lg-2">
                  <select
                    v-model="unitPositionFilters.unit_id"
                    class="form-select"
                    :disabled="!unitPositionFilters.unit_type_id || unitPositionFilterLoading"
                    @change="handleUnitPositionUnitChange"
                  >
                    <option value="">Unidad</option>
                    <option
                      v-for="row in unitPositionUnitOptions"
                      :key="row.id"
                      :value="String(row.id)"
                    >
                      {{ formatFkOptionLabel("units", row) }}
                    </option>
                  </select>
                </div>
                <div class="col-12 col-md-4 col-lg-2">
                  <select
                    v-model="unitPositionFilters.cargo_id"
                    class="form-select"
                    :disabled="unitPositionFilterLoading"
                    @change="handleUnitPositionCargoChange"
                  >
                    <option value="">Cargo</option>
                    <option
                      v-for="row in unitPositionCargoOptions"
                      :key="row.id"
                      :value="String(row.id)"
                    >
                      {{ formatFkOptionLabel("cargos", row) }}
                    </option>
                  </select>
                </div>
              </template>
              <template v-else-if="isProcessDefinitionFilterTable">
                <div class="col-12 col-md-6 col-lg-2">
                  <select
                    v-model="processDefinitionInlineFilters.process_id"
                    class="form-select"
                    @change="fetchRows"
                  >
                    <option value="">Proceso</option>
                    <option
                      v-for="row in processDefinitionProcessOptions"
                      :key="row.id"
                      :value="String(row.id)"
                    >
                      {{ formatFkOptionLabel("processes", row) }}
                    </option>
                  </select>
                </div>
                <div class="col-12 col-md-6 col-lg-2">
                  <select
                    v-model="processDefinitionInlineFilters.status"
                    class="form-select"
                    @change="fetchRows"
                  >
                    <option value="">Estado</option>
                    <option value="draft">draft</option>
                    <option value="active">active</option>
                    <option value="retired">retired</option>
                  </select>
                </div>
                <div class="col-12 col-md-12 col-lg-3">
                  <select
                    v-model="processDefinitionInlineFilters.variation_key"
                    class="form-select"
                    @change="fetchRows"
                  >
                    <option value="">Serie</option>
                    <option
                      v-for="row in processDefinitionSeriesOptions"
                      :key="row.id"
                      :value="String(row.code || '')"
                    >
                      {{ formatFkOptionLabel("process_definition_series", row) }}
                    </option>
                  </select>
                </div>
              </template>
              <template v-else-if="isProcessTargetRuleFilterTable">
                <div class="col-12 col-md-6 col-lg-2">
                  <select
                    v-model="processTargetRuleInlineFilters.definition_execution_mode"
                    class="form-select"
                    @change="fetchRows"
                  >
                    <option value="">Modo</option>
                    <option value="manual">manual</option>
                    <option value="system">system</option>
                    <option value="hybrid">hybrid</option>
                  </select>
                </div>
                <div class="col-12 col-md-6 col-lg-2">
                  <select
                    v-model="processTargetRuleInlineFilters.definition_status"
                    class="form-select"
                    @change="fetchRows"
                  >
                    <option value="">Estado</option>
                    <option value="draft">draft</option>
                    <option value="active">active</option>
                    <option value="retired">retired</option>
                  </select>
                </div>
              </template>
              <template v-else-if="isTemplateArtifactsTable">
                <div class="col-12 col-md-6 col-lg-2">
                  <select
                    v-model="templateArtifactInlineFilters.artifact_origin"
                    class="form-select"
                    @change="fetchRows"
                  >
                    <option value="">Origen</option>
                    <option value="system">system</option>
                    <option value="user">user</option>
                  </select>
                </div>
                <div class="col-12 col-md-6 col-lg-2">
                  <select
                    v-model="templateArtifactInlineFilters.artifact_stage"
                    class="form-select"
                    @change="fetchRows"
                  >
                    <option value="">Etapa</option>
                    <option value="draft">draft</option>
                    <option value="published">published</option>
                  </select>
                </div>
              </template>
              <div :class="isPositionFilterTable ? 'col-12 col-lg-2 text-lg-end' : isProcessDefinitionFilterTable ? 'col-12 col-lg-3 text-lg-end' : isProcessTargetRuleFilterTable ? 'col-12 col-lg-3 text-lg-end' : isTemplateArtifactsTable ? 'col-12 col-lg-3 text-lg-end' : 'col-12 col-md-6 text-md-end'">
                <div class="d-inline-flex align-items-center gap-2">
                  <button
                    v-if="isPositionFilterTable"
                    class="btn btn-outline-secondary btn-lg"
                    type="button"
                    title="Limpiar filtros"
                    aria-label="Limpiar filtros"
                    :disabled="!hasUnitPositionFilters"
                    @click="clearUnitPositionInlineFilters"
                  >
                    <font-awesome-icon icon="times" />
                  </button>
                  <button
                    v-else-if="isProcessDefinitionFilterTable"
                    class="btn btn-outline-secondary btn-lg"
                    type="button"
                    title="Limpiar filtros"
                    aria-label="Limpiar filtros"
                    :disabled="!hasProcessDefinitionInlineFilters"
                    @click="clearProcessDefinitionInlineFilters"
                  >
                    <font-awesome-icon icon="times" />
                  </button>
                  <button
                    v-else-if="isProcessTargetRuleFilterTable"
                    class="btn btn-outline-secondary btn-lg"
                    type="button"
                    title="Limpiar filtros"
                    aria-label="Limpiar filtros"
                    :disabled="!hasProcessTargetRuleInlineFilters"
                    @click="clearProcessTargetRuleInlineFilters"
                  >
                    <font-awesome-icon icon="times" />
                  </button>
                  <button
                    v-else-if="isTemplateArtifactsTable"
                    class="btn btn-outline-secondary btn-lg"
                    type="button"
                    title="Limpiar filtros"
                    aria-label="Limpiar filtros"
                    :disabled="!hasTemplateArtifactInlineFilters"
                    @click="clearTemplateArtifactInlineFilters"
                  >
                    <font-awesome-icon icon="times" />
                  </button>
                  <button
                    class="btn btn-outline-secondary btn-lg"
                    type="button"
                    title="Actualizar"
                    aria-label="Actualizar"
                    @click="fetchRows"
                  >
                    <font-awesome-icon icon="rotate-right" />
                  </button>
                </div>
              </div>
            </div>

            <div v-if="loading" class="text-muted">Cargando datos...</div>
            <div v-else-if="error" class="admin-inline-error" role="alert">{{ error }}</div>
            <div v-else class="table-responsive table-actions">
              <div class="table-actions-scroll">
                <table class="table table-striped table-hover align-middle table-institutional table-actions">
                <thead>
                  <tr>
                    <th v-for="field in tableListFields" :key="field.name" class="text-start">
                      {{ field.label || field.name }}
                    </th>
                    <th class="text-start admin-action-col">ACCION</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="rows.length === 0">
                    <td :colspan="tableListFields.length + 1" class="text-center text-muted">
                      <p class="my-3">No hay registros disponibles</p>
                    </td>
                  </tr>
                  <tr v-for="row in rows" :key="rowKey(row)">
                    <td v-for="field in tableListFields" :key="field.name">
                      <template v-if="field.name === 'available_formats'">
                        <div class="available-formats-cell">
                          <template v-if="getAvailableFormatSections(row[field.name]).length">
                            <div
                              v-for="section in getAvailableFormatSections(row[field.name])"
                              :key="section.mode"
                              class="available-formats-group"
                              :class="{ 'is-inline': section.mode === 'user' }"
                            >
                              <span class="available-formats-mode">{{ section.label }}</span>
                              <div class="available-formats-badges">
                                <span
                                  v-for="entry in section.entries"
                                  :key="`${section.mode}-${entry.format}`"
                                  class="available-formats-badge"
                                  :style="getAvailableFormatBadgeStyle(section.mode, entry)"
                                >
                                  {{ entry.formatLabel }}
                                </span>
                              </div>
                            </div>
                          </template>
                          <span v-else>—</span>
                        </div>
                      </template>
                      <template v-else>
                        {{ formatCell(row[field.name], field, row) }}
                      </template>
                    </td>
                    <td class="text-end admin-action-col">
                      <div class="d-inline-flex align-items-center gap-1">
                        <button
                          type="button"
                          class="btn btn-sm btn-icon hope-action-btn hope-action-view"
                          title="Visualizar"
                          aria-label="Visualizar"
                          @click="openRecordViewer(row)"
                        >
                          <span class="btn-inner">
                            <font-awesome-icon icon="eye" />
                          </span>
                        </button>
                        <button
                          v-if="table?.table === 'process_definition_versions'"
                          type="button"
                          class="btn btn-sm btn-icon hope-action-btn hope-action-version"
                          title="Versionar"
                          aria-label="Versionar"
                          @click="startProcessDefinitionVersioning(row)"
                        >
                          <span class="btn-inner">
                            <font-awesome-icon icon="rotate-right" />
                          </span>
                        </button>
                        <button
                          v-if="table?.table === 'process_definition_versions' && String(row?.status || '') === 'draft'"
                          type="button"
                          class="btn btn-sm btn-icon hope-action-btn hope-action-assign"
                          title="Activar"
                          aria-label="Activar"
                          @click="openProcessDefinitionActivationForRow(row)"
                        >
                          <span class="btn-inner">
                            <font-awesome-icon icon="check" />
                          </span>
                        </button>
                        <button
                          v-if="isPersonTable"
                          type="button"
                          class="btn btn-sm btn-icon hope-action-btn hope-action-assign"
                          title="Gestionar asignaciones"
                          aria-label="Gestionar asignaciones"
                          @click="openPersonAssignments(row)"
                        >
                          <span class="btn-inner">
                            <font-awesome-icon icon="list-check" />
                          </span>
                        </button>
                        <template v-if="isTemplateArtifactsTable">
                          <button
                            type="button"
                            class="btn btn-sm btn-icon text-primary hope-action-btn hope-action-edit"
                            :title="String(row?.artifact_origin || '') === 'system' ? 'Los artifacts del sistema se sincronizan desde MinIO' : 'Editar'"
                            :aria-label="String(row?.artifact_origin || '') === 'system' ? 'Edicion bloqueada para artifacts del sistema' : 'Editar'"
                            :disabled="String(row?.artifact_origin || '') === 'system'"
                            @click="String(row?.artifact_origin || '') === 'system' ? undefined : openEdit(row)"
                          >
                            <span class="btn-inner">
                              <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                                aria-hidden="true"
                              >
                                <path
                                  d="M11.4925 2.78906H7.75349C4.67849 2.78906 2.75049 4.96606 2.75049 8.04806V16.3621C2.75049 19.4441 4.66949 21.6211 7.75349 21.6211H16.5775C19.6625 21.6211 21.5815 19.4441 21.5815 16.3621V12.3341"
                                  stroke="currentColor"
                                  stroke-width="1.5"
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                />
                                <path
                                  fill-rule="evenodd"
                                  clip-rule="evenodd"
                                  d="M8.82812 10.921L16.3011 3.44799C17.2321 2.51799 18.7411 2.51799 19.6721 3.44799L20.8891 4.66499C21.8201 5.59599 21.8201 7.10599 20.8891 8.03599L13.3801 15.545C12.9731 15.952 12.4211 16.181 11.8451 16.181H8.09912L8.19312 12.401C8.20712 11.845 8.43412 11.315 8.82812 10.921Z"
                                  stroke="currentColor"
                                  stroke-width="1.5"
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                />
                                <path
                                  d="M15.1655 4.60254L19.7315 9.16854"
                                  stroke="currentColor"
                                  stroke-width="1.5"
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                />
                              </svg>
                            </span>
                          </button>
                        </template>
                        <BtnEdit v-else @onpress="openEdit(row)" />
                        <BtnDelete @onpress="openDelete(row)" />
                      </div>
                    </td>
                  </tr>
                </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="isPositionAssignmentsTable" class="row mt-4">
      <div class="col-12">
        <div class="profile-section-header mb-3">
          <div>
            <h2 class="text-start profile-section-title table-title-with-icon">
              <span class="table-title-icon" aria-hidden="true">
                <font-awesome-icon icon="id-card" />
              </span>
              <span>Puestos sin ocupaciones</span>
            </h2>
            <p class="profile-section-subtitle mb-0">
              Gestiona puestos activos sin ocupacion actual.
            </p>
          </div>
          <div class="profile-section-actions">
            <span class="badge text-bg-light">{{ vacantPositionRows.length }}</span>
          </div>
        </div>
        <div class="card shadow-sm">
          <div class="card-body">
            <div class="row g-3 align-items-center mb-3">
              <div class="col-12 col-md-4 col-lg-2">
                <input
                  v-model="vacantSearchTerm"
                  type="text"
                  class="form-control"
                  placeholder="Buscar puestos sin ocupaciones"
                  @input="debouncedVacantSearch"
                />
              </div>
              <div class="col-12 col-md-4 col-lg-2">
                <select
                  v-model="vacantPositionFilters.unit_type_id"
                  class="form-select"
                  :disabled="vacantPositionFilterLoading"
                  @change="handleVacantPositionTypeChange"
                >
                  <option value="">Tipo de unidad</option>
                  <option
                    v-for="row in vacantPositionUnitTypeOptions"
                    :key="row.id"
                    :value="String(row.id)"
                  >
                    {{ formatFkOptionLabel("unit_types", row) }}
                  </option>
                </select>
              </div>
              <div class="col-12 col-md-4 col-lg-2">
                <select
                  v-model="vacantPositionFilters.unit_id"
                  class="form-select"
                  :disabled="!vacantPositionFilters.unit_type_id || vacantPositionFilterLoading"
                  @change="handleVacantPositionUnitChange"
                >
                  <option value="">Unidad</option>
                  <option
                    v-for="row in vacantPositionUnitOptions"
                    :key="row.id"
                    :value="String(row.id)"
                  >
                    {{ formatFkOptionLabel("units", row) }}
                  </option>
                </select>
              </div>
              <div class="col-12 col-md-4 col-lg-2">
                <select
                  v-model="vacantPositionFilters.cargo_id"
                  class="form-select"
                  :disabled="vacantPositionFilterLoading"
                  @change="handleVacantPositionCargoChange"
                >
                  <option value="">Cargo</option>
                  <option
                    v-for="row in vacantPositionCargoOptions"
                    :key="row.id"
                    :value="String(row.id)"
                  >
                    {{ formatFkOptionLabel("cargos", row) }}
                  </option>
                </select>
              </div>
              <div class="col-12 col-md-4 col-lg-2">
                <select
                  v-model="vacantPositionFilters.position_type"
                  class="form-select"
                  :disabled="vacantPositionFilterLoading"
                  @change="handleVacantPositionTypeFilterChange"
                >
                  <option value="">Tipo de puesto</option>
                  <option value="real">Real</option>
                  <option value="promocion">Promocion</option>
                  <option value="simbolico">Simbolico</option>
                </select>
              </div>
              <div class="col-12 col-md-4 col-lg-2 text-lg-end">
                <div class="d-inline-flex align-items-center gap-2">
                  <button
                    class="btn btn-outline-secondary btn-lg"
                    type="button"
                    title="Limpiar filtros"
                    aria-label="Limpiar filtros"
                    :disabled="!hasVacantPositionFilters"
                    @click="clearVacantPositionFilters"
                  >
                    <font-awesome-icon icon="times" />
                  </button>
                  <button
                    class="btn btn-outline-secondary btn-lg"
                    type="button"
                    title="Actualizar"
                    aria-label="Actualizar"
                    @click="loadVacantPositions"
                  >
                    <font-awesome-icon icon="rotate-right" />
                  </button>
                </div>
              </div>
            </div>

            <div v-if="vacantPositionLoading" class="text-muted">Cargando puestos sin ocupaciones...</div>
            <div v-else-if="vacantPositionError" class="admin-inline-error" role="alert">{{ vacantPositionError }}</div>
            <div v-else class="table-responsive table-actions">
              <div class="table-actions-scroll">
                <table class="table table-striped table-hover align-middle table-institutional table-actions">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Tipo de unidad</th>
                      <th>Unidad</th>
                      <th>Cargo</th>
                      <th>Tipo de puesto</th>
                      <th>Plaza</th>
                      <th>Titulo</th>
                      <th class="text-start admin-action-col">ACCION</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="vacantPositionRows.length === 0">
                      <td colspan="8" class="text-center text-muted">No hay puestos disponibles sin ocupaciones.</td>
                    </tr>
                    <tr v-for="row in vacantPositionRows" :key="`vacant-${row.id}`">
                      <td>{{ row.id }}</td>
                      <td>{{ formatFkListCell(row, { name: "__unit_type_id" }) }}</td>
                      <td>{{ formatCell(row.unit_id, { name: "unit_id" }, row) }}</td>
                      <td>{{ formatCell(row.cargo_id, { name: "cargo_id" }, row) }}</td>
                      <td>{{ formatPositionType(row.position_type) }}</td>
                      <td>{{ row.slot_no ?? "—" }}</td>
                      <td>{{ row.title || "—" }}</td>
                      <td class="text-end admin-action-col">
                        <div class="d-inline-flex align-items-center gap-1">
                          <button
                            type="button"
                            class="btn btn-sm btn-icon hope-action-btn hope-action-delete"
                            title="Desactivar"
                            aria-label="Desactivar"
                            @click="deactivateVacantPosition(row)"
                          >
                            <span class="btn-inner">
                              <font-awesome-icon icon="times-circle" />
                            </span>
                          </button>
                          <button
                            type="button"
                            class="btn btn-sm btn-icon hope-action-btn hope-action-edit"
                            title="Asignar"
                            aria-label="Asignar"
                            @click="assignVacantPosition(row)"
                          >
                            <span class="btn-inner">
                              <font-awesome-icon icon="user-plus" />
                            </span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="isProcessDefinitionTemplatesTable" class="row mt-4">
      <div class="col-12">
        <div class="profile-section-header mb-3">
          <div>
            <h2 class="text-start profile-section-title table-title-with-icon">
              <span class="table-title-icon" aria-hidden="true">
                <font-awesome-icon icon="layer-group" />
              </span>
              <span>Artifacts sin definicion</span>
            </h2>
            <p class="profile-section-subtitle mb-0">
              Muestra artifacts que aun no tienen ningun vinculo en plantillas de definicion.
            </p>
          </div>
          <div class="profile-section-actions">
            <span class="badge text-bg-light">{{ unassignedTemplateArtifactRows.length }}</span>
          </div>
        </div>
        <div class="card shadow-sm">
          <div class="card-body">
            <div class="row g-3 align-items-center mb-3">
              <div class="col-12 col-md-4 col-lg-3">
                <input
                  v-model="unassignedTemplateArtifactSearch"
                  type="text"
                  class="form-control"
                  placeholder="Buscar artifacts sin definicion"
                  @input="debouncedUnassignedTemplateArtifactSearch"
                />
              </div>
              <div class="col-12 col-md-4 col-lg-2">
                <select
                  v-model="unassignedTemplateArtifactFilters.is_active"
                  class="form-select"
                  :disabled="unassignedTemplateArtifactLoading"
                  @change="loadUnassignedTemplateArtifacts"
                >
                  <option value="">Activo</option>
                  <option value="1">Si</option>
                  <option value="0">No</option>
                </select>
              </div>
              <div class="col-12 col-md-4 col-lg-2 text-lg-end ms-lg-auto">
                <div class="d-inline-flex align-items-center gap-2">
                  <button
                    class="btn btn-outline-secondary btn-lg"
                    type="button"
                    title="Limpiar filtros"
                    aria-label="Limpiar filtros"
                    :disabled="!hasUnassignedTemplateArtifactFilters"
                    @click="clearUnassignedTemplateArtifactFilters"
                  >
                    <font-awesome-icon icon="times" />
                  </button>
                  <button
                    class="btn btn-outline-secondary btn-lg"
                    type="button"
                    title="Actualizar"
                    aria-label="Actualizar"
                    @click="loadUnassignedTemplateArtifacts"
                  >
                    <font-awesome-icon icon="rotate-right" />
                  </button>
                </div>
              </div>
            </div>

            <div v-if="unassignedTemplateArtifactLoading" class="text-muted">Cargando artifacts sin definicion...</div>
            <div v-else-if="unassignedTemplateArtifactError" class="admin-inline-error" role="alert">{{ unassignedTemplateArtifactError }}</div>
            <div v-else class="table-responsive table-actions">
              <div class="table-actions-scroll">
                <table class="table table-striped table-hover align-middle table-institutional table-actions">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Nombre</th>
                      <th>Formatos</th>
                      <th>Codigo</th>
                      <th>Version fuente</th>
                      <th>Version storage</th>
                      <th>Activo</th>
                      <th class="text-start admin-action-col">ACCION</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="unassignedTemplateArtifactRows.length === 0">
                      <td colspan="8" class="text-center text-muted">No hay artifacts sin definicion.</td>
                    </tr>
                    <tr v-for="row in unassignedTemplateArtifactRows" :key="`artifact-free-${row.id}`">
                      <td>{{ row.id }}</td>
                      <td>{{ row.display_name || "—" }}</td>
                      <td>
                        <div class="available-formats-cell">
                          <template v-if="getAvailableFormatSections(row.available_formats).length">
                            <div
                              v-for="section in getAvailableFormatSections(row.available_formats)"
                              :key="section.mode"
                              class="available-formats-group"
                              :class="{ 'is-inline': section.mode === 'user' }"
                            >
                              <span class="available-formats-mode">{{ section.label }}</span>
                              <div class="available-formats-badges">
                                <span
                                  v-for="entry in section.entries"
                                  :key="`${section.mode}-${entry.format}`"
                                  class="available-formats-badge"
                                  :style="getAvailableFormatBadgeStyle(section.mode, entry)"
                                >
                                  {{ entry.formatLabel }}
                                </span>
                              </div>
                            </div>
                          </template>
                          <span v-else>—</span>
                        </div>
                      </td>
                      <td>{{ row.template_code || "—" }}</td>
                      <td>{{ row.source_version || "—" }}</td>
                      <td>{{ row.storage_version || "—" }}</td>
                      <td>{{ Number(row.is_active) === 1 ? "Si" : "No" }}</td>
                      <td class="text-end admin-action-col">
                        <div class="d-inline-flex align-items-center gap-1">
                          <button
                            type="button"
                            class="btn btn-sm btn-icon hope-action-btn hope-action-view"
                            title="Visualizar"
                            aria-label="Visualizar"
                            @click="openRecordViewer(row, allTablesMap.template_artifacts)"
                          >
                            <span class="btn-inner">
                              <font-awesome-icon icon="eye" />
                            </span>
                          </button>
                          <button
                            type="button"
                            class="btn btn-sm btn-icon hope-action-btn hope-action-edit"
                            title="Vincular"
                            aria-label="Vincular"
                            @click="startProcessDefinitionTemplateFromArtifact(row)"
                          >
                            <span class="btn-inner">
                              <font-awesome-icon icon="link" />
                            </span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div
      class="modal fade"
      id="personAssignmentsModal"
      tabindex="-1"
      aria-labelledby="personAssignmentsModalLabel"
      aria-hidden="true"
      ref="personAssignmentsModal"
    >
      <div class="modal-dialog modal-xl">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="personAssignmentsModalLabel">Asignaciones del usuario</h5>
            <button type="button" class="btn-close" data-modal-dismiss aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <div class="person-assignment-panel">
              <div v-if="!personEditorId" class="alert alert-info mb-0">
                Usa el botón de asignaciones en la fila de una persona para empezar.
              </div>
              <template v-else>
                <div class="person-assignment-context mb-3">
                  <strong>{{ personAssignmentName }}</strong>
                  <span class="text-muted ms-2">{{ personAssignmentMeta }}</span>
                </div>

                <div v-if="personAssignmentsLoading" class="text-muted mb-2">Cargando asignaciones...</div>
                <div v-else class="row g-4">
                  <div class="col-12">
                    <div class="person-assignment-menu">
                      <button
                        v-for="section in personAssignmentSections"
                        :key="section.key"
                        type="button"
                        class="btn person-assignment-menu-btn"
                        :class="{ 'is-active': personAssignmentSection === section.key }"
                        @click="personAssignmentSection = section.key"
                      >
                        <font-awesome-icon :icon="section.icon" class="me-2" />
                        {{ section.label }}
                      </button>
                    </div>
                  </div>

                  <div v-if="personAssignmentSection === 'ocupaciones'" class="col-12">
                    <h6 class="mb-2 person-subtitle">
                      <font-awesome-icon icon="id-card" />
                      <span>Ocupaciones</span>
                    </h6>
                    <div v-if="personCargoError" class="alert alert-danger">{{ personCargoError }}</div>
                    <div class="person-assignment-form">
                      <div class="row g-3">
                        <div class="col-12 col-md-6">
                          <label class="form-label text-dark">Puesto</label>
                          <div class="input-group">
                            <input
                              v-model="personCargoLabels.position_id"
                              type="text"
                              class="form-control"
                              placeholder="Selecciona un puesto"
                              readonly
                              @keydown.prevent
                              @paste.prevent
                            />
                            <button
                              class="btn btn-outline-secondary"
                              type="button"
                              title="Limpiar"
                              aria-label="Limpiar"
                              :disabled="!personCargoForm.position_id"
                              @click="clearPersonCargoPosition"
                            >
                              <font-awesome-icon icon="times" />
                            </button>
                            <button class="btn btn-outline-secondary" type="button" title="Buscar" aria-label="Buscar" @click="openPersonCargoFkSearch('position_id')">
                              <font-awesome-icon icon="search" />
                            </button>
                          </div>
                        </div>
                        <div class="col-12 col-md-4">
                          <label class="form-label text-dark">Inicio</label>
                          <input v-model="personCargoForm.start_date" type="date" class="form-control" />
                        </div>
                        <div class="col-12 col-md-4">
                          <label class="form-label text-dark">Fin</label>
                          <input v-model="personCargoForm.end_date" type="date" class="form-control" />
                        </div>
                        <div class="col-12 col-md-4">
                          <label class="form-label text-dark">Actual</label>
                          <select v-model="personCargoForm.is_current" class="form-select">
                            <option value="1">Si</option>
                            <option value="0">No</option>
                          </select>
                        </div>
                      </div>
                      <div class="person-assignment-form-actions">
                        <button
                          type="button"
                          class="btn btn-outline-primary"
                          @click="submitPersonCargoCreate"
                        >
                          {{ personCargoEditId ? "Guardar ocupacion" : "Agregar ocupacion" }}
                        </button>
                        <button
                          v-if="personCargoEditId"
                          type="button"
                          class="btn btn-outline-secondary"
                          @click="resetPersonCargoForm"
                        >
                          Cancelar edicion
                        </button>
                      </div>
                    </div>

                    <div class="table-responsive mt-3 person-assignment-table">
                      <table class="table table-sm table-striped align-middle">
                        <thead>
                          <tr>
                            <th>ID</th>
                            <th>Puesto</th>
                            <th>Unidad</th>
                            <th>Inicio</th>
                            <th>Fin</th>
                            <th>Actual</th>
                            <th class="text-end">Accion</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-if="personCargoRows.length === 0">
                            <td colspan="7" class="text-center text-muted">Sin ocupaciones asignadas.</td>
                          </tr>
                          <tr v-for="row in personCargoRows" :key="row.id">
                            <td>{{ row.id }}</td>
                            <td>{{ formatCell(row.position_id, { name: "position_id" }) }}</td>
                            <td>{{ formatPersonCargoUnit(row) }}</td>
                            <td>{{ toDateInputValue(row.start_date) }}</td>
                            <td>{{ toDateInputValue(row.end_date) || "—" }}</td>
                            <td>{{ Number(row.is_current) === 1 ? "Si" : "No" }}</td>
                            <td class="text-end">
                              <div class="d-inline-flex align-items-center gap-1">
                                <button
                                  type="button"
                                  class="btn btn-sm btn-icon hope-action-btn hope-action-view"
                                  title="Visualizar"
                                  aria-label="Visualizar"
                                  @click="openRecordViewer(row, allTablesMap.position_assignments)"
                                >
                                  <span class="btn-inner">
                                    <font-awesome-icon icon="eye" />
                                  </span>
                                </button>
                                <BtnEdit tooltip="Editar ocupacion" @onpress="startPersonCargoEdit(row)" />
                                <BtnDelete message="Eliminar ocupacion" @onpress="deletePersonCargo(row)" />
                              </div>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div v-if="personAssignmentSection === 'roles'" class="col-12">
                    <h6 class="mb-2 person-subtitle">
                      <font-awesome-icon icon="lock" />
                      <span>Roles</span>
                    </h6>
                    <div v-if="personRoleError" class="alert alert-danger">{{ personRoleError }}</div>
                    <div class="person-assignment-form">
                      <div class="row g-3">
                        <div class="col-12 col-md-6">
                          <label class="form-label text-dark">Rol</label>
                          <div class="input-group">
                            <input
                              v-model="personRoleLabels.role_id"
                              type="text"
                              class="form-control"
                              placeholder="Selecciona un rol"
                              readonly
                              @keydown.prevent
                              @paste.prevent
                            />
                            <button
                              class="btn btn-outline-secondary"
                              type="button"
                              title="Limpiar"
                              aria-label="Limpiar"
                              :disabled="!personRoleForm.role_id"
                              @click="clearPersonRoleField('role_id')"
                            >
                              <font-awesome-icon icon="times" />
                            </button>
                            <button class="btn btn-outline-secondary" type="button" title="Buscar" aria-label="Buscar" @click="openPersonRoleFkSearch('role_id')">
                              <font-awesome-icon icon="search" />
                            </button>
                          </div>
                        </div>
                        <div class="col-12 col-md-6">
                          <label class="form-label text-dark">Unidad</label>
                          <div class="input-group">
                            <input
                              v-model="personRoleLabels.unit_id"
                              type="text"
                              class="form-control"
                              placeholder="Selecciona una unidad"
                              readonly
                              @keydown.prevent
                              @paste.prevent
                            />
                            <button
                              class="btn btn-outline-secondary"
                              type="button"
                              title="Limpiar"
                              aria-label="Limpiar"
                              :disabled="!personRoleForm.unit_id"
                              @click="clearPersonRoleField('unit_id')"
                            >
                              <font-awesome-icon icon="times" />
                            </button>
                            <button class="btn btn-outline-secondary" type="button" title="Buscar" aria-label="Buscar" @click="openPersonRoleFkSearch('unit_id')">
                              <font-awesome-icon icon="search" />
                            </button>
                          </div>
                        </div>
                      </div>
                      <div class="person-assignment-form-actions">
                        <button
                          type="button"
                          class="btn btn-outline-primary"
                          @click="submitPersonRoleCreate"
                        >
                          {{ personRoleEditId ? "Guardar rol" : "Agregar rol" }}
                        </button>
                        <button
                          v-if="personRoleEditId"
                          type="button"
                          class="btn btn-outline-secondary"
                          @click="resetPersonRoleForm"
                        >
                          Cancelar edicion
                        </button>
                      </div>
                    </div>

                    <div class="table-responsive mt-3 person-assignment-table">
                      <table class="table table-sm table-striped align-middle">
                        <thead>
                          <tr>
                            <th>ID</th>
                            <th>Rol</th>
                            <th>Unidad</th>
                            <th>Asignado</th>
                            <th class="text-end">Accion</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-if="personRoleRows.length === 0">
                            <td colspan="5" class="text-center text-muted">Sin roles asignados.</td>
                          </tr>
                          <tr v-for="row in personRoleRows" :key="row.id">
                            <td>{{ row.id }}</td>
                            <td>{{ formatCell(row.role_id, { name: "role_id" }) }}</td>
                            <td>{{ formatCell(row.unit_id, { name: "unit_id" }) }}</td>
                            <td>{{ row.assigned_at ?? "—" }}</td>
                            <td class="text-end">
                              <div class="d-inline-flex align-items-center gap-1">
                                <button
                                  type="button"
                                  class="btn btn-sm btn-icon hope-action-btn hope-action-view"
                                  title="Visualizar"
                                  aria-label="Visualizar"
                                  @click="openRecordViewer(row, allTablesMap.role_assignments)"
                                >
                                  <span class="btn-inner">
                                    <font-awesome-icon icon="eye" />
                                  </span>
                                </button>
                                <BtnEdit tooltip="Editar rol" @onpress="startPersonRoleEdit(row)" />
                                <BtnDelete message="Eliminar rol" @onpress="deletePersonRole(row)" />
                              </div>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div v-if="personAssignmentSection === 'contratos'" class="col-12">
                    <h6 class="mb-2 person-subtitle">
                      <font-awesome-icon icon="check-double" />
                      <span>Contratos / Puestos</span>
                    </h6>
                    <div v-if="personContractError" class="alert alert-danger">{{ personContractError }}</div>
                    <div class="person-assignment-form">
                      <div class="row g-3">
                        <div class="col-12 col-md-4">
                          <label class="form-label text-dark">Puesto</label>
                          <div class="input-group">
                            <input
                              v-model="personContractLabels.position_id"
                              type="text"
                              class="form-control"
                              placeholder="Selecciona un puesto"
                              readonly
                              @keydown.prevent
                              @paste.prevent
                            />
                            <button
                              class="btn btn-outline-secondary"
                              type="button"
                              title="Limpiar"
                              aria-label="Limpiar"
                              :disabled="!personContractForm.position_id"
                              @click="clearPersonContractPosition"
                            >
                              <font-awesome-icon icon="times" />
                            </button>
                            <button class="btn btn-outline-secondary" type="button" title="Buscar" aria-label="Buscar" @click="openPersonContractFkSearch">
                              <font-awesome-icon icon="search" />
                            </button>
                          </div>
                        </div>
                        <div class="col-12 col-md-4">
                          <label class="form-label text-dark">Relacion</label>
                          <input v-model="personContractForm.relation_type" type="text" class="form-control" />
                        </div>
                        <div class="col-12 col-md-4">
                          <label class="form-label text-dark">Dedicacion</label>
                          <input v-model="personContractForm.dedication" type="text" class="form-control" />
                        </div>
                        <div class="col-12 col-md-4">
                          <label class="form-label text-dark">Inicio</label>
                          <input v-model="personContractForm.start_date" type="date" class="form-control" />
                        </div>
                        <div class="col-12 col-md-4">
                          <label class="form-label text-dark">Fin</label>
                          <input v-model="personContractForm.end_date" type="date" class="form-control" />
                        </div>
                        <div class="col-12 col-md-4">
                          <label class="form-label text-dark">Estado</label>
                          <select v-model="personContractForm.status" class="form-select">
                            <option value="activo">activo</option>
                            <option value="finalizado">finalizado</option>
                            <option value="cancelado">cancelado</option>
                          </select>
                        </div>
                      </div>
                      <div class="person-assignment-form-actions">
                        <button
                          type="button"
                          class="btn btn-outline-primary"
                          @click="submitPersonContractCreate"
                        >
                          {{ personContractEditId ? "Guardar contrato" : "Agregar contrato" }}
                        </button>
                        <button
                          v-if="personContractEditId"
                          type="button"
                          class="btn btn-outline-secondary"
                          @click="resetPersonContractForm"
                        >
                          Cancelar edicion
                        </button>
                      </div>
                    </div>

                    <div class="table-responsive mt-3 person-assignment-table">
                      <table class="table table-sm table-striped align-middle">
                        <thead>
                          <tr>
                            <th>ID</th>
                            <th>Puesto</th>
                            <th>Relacion</th>
                            <th>Dedicacion</th>
                            <th>Inicio</th>
                            <th>Fin</th>
                            <th>Estado</th>
                            <th class="text-end">Accion</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-if="personContractRows.length === 0">
                            <td colspan="8" class="text-center text-muted">Sin contratos asignados.</td>
                          </tr>
                          <tr v-for="row in personContractRows" :key="row.id">
                            <td>{{ row.id }}</td>
                            <td>{{ formatCell(row.position_id, { name: "position_id" }) }}</td>
                            <td>{{ row.relation_type }}</td>
                            <td>{{ row.dedication }}</td>
                            <td>{{ toDateInputValue(row.start_date) }}</td>
                            <td>{{ toDateInputValue(row.end_date) || "—" }}</td>
                            <td>{{ row.status }}</td>
                            <td class="text-end">
                              <div class="d-inline-flex align-items-center gap-1">
                                <button
                                  type="button"
                                  class="btn btn-sm btn-icon hope-action-btn hope-action-view"
                                  title="Visualizar"
                                  aria-label="Visualizar"
                                  @click="openRecordViewer(row, allTablesMap.contracts)"
                                >
                                  <span class="btn-inner">
                                    <font-awesome-icon icon="eye" />
                                  </span>
                                </button>
                                <BtnEdit tooltip="Editar contrato" @onpress="startPersonContractEdit(row)" />
                                <BtnDelete message="Eliminar contrato" @onpress="deletePersonContract(row)" />
                              </div>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </template>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-danger" data-modal-dismiss>Cerrar</button>
          </div>
        </div>
      </div>
    </div>

    <div
      class="modal fade"
      id="sqlEditorModal"
      tabindex="-1"
      aria-labelledby="sqlEditorModalLabel"
      aria-hidden="true"
      ref="editorModal"
    >
      <div class="modal-dialog modal-xl">
        <div class="modal-content" :class="{ 'process-modal-content': isProcessTable }">
          <div class="modal-header">
            <h5 class="modal-title" id="sqlEditorModalLabel">
              {{
                editorMode === "create"
                  ? `Añadir ${table?.label || "registro"}`
                  : "Editar registro"
              }}
            </h5>
            <button type="button" class="btn-close" data-modal-dismiss aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <div v-if="modalError" class="alert alert-danger mb-3">
              {{ modalError }}
            </div>
            <form class="row g-3">
              <div
                v-for="field in visibleFormFields"
                :key="field.name"
                class="col-12 col-md-6"
              >
                <label class="form-label">
                  {{ field.label || field.name }}
                  <span v-if="field.required" class="text-danger">*</span>
                </label>
                <div v-if="isInputField(field) && isForeignKeyField(field)" class="position-relative">
                  <div class="input-group">
                    <input
                      v-model="fkDisplay[field.name]"
                      type="text"
                      class="form-control"
                      :placeholder="field.placeholder || ''"
                      :disabled="isFieldLocked(field)"
                      autocomplete="off"
                      @focus="openInlineFkSuggestions(field)"
                      @blur="scheduleInlineFkClose(field.name)"
                      @input="handleInlineFkInput(field)"
                    />
                    <button
                      class="btn btn-outline-secondary"
                      type="button"
                      title="Limpiar"
                      aria-label="Limpiar"
                      :disabled="isFieldLocked(field) || !fkDisplay[field.name]"
                      @mousedown.prevent
                      @click="clearInlineFkSelection(field.name)"
                    >
                      <font-awesome-icon icon="times" />
                    </button>
                    <button
                      class="btn btn-outline-secondary"
                      type="button"
                      title="Buscar"
                      aria-label="Buscar"
                      :disabled="isFieldLocked(field)"
                      @mousedown.prevent
                      @click="openFkSearch(field)"
                    >
                      <font-awesome-icon icon="search" />
                    </button>
                  </div>
                  <div
                    v-if="shouldShowInlineFkSuggestions(field.name)"
                    class="list-group fk-inline-suggestions shadow-sm"
                    @mousedown.prevent
                  >
                    <div v-if="inlineFkLoading[field.name]" class="list-group-item text-muted small">
                      Buscando...
                    </div>
                    <template v-else-if="(inlineFkSuggestions[field.name] || []).length">
                      <button
                        v-for="option in inlineFkSuggestions[field.name]"
                        :key="`${field.name}-${option.id}`"
                        type="button"
                        class="list-group-item list-group-item-action"
                        @mousedown.prevent="selectInlineFkSuggestion(field, option)"
                      >
                        {{ formatInlineFkOption(field, option) }}
                      </button>
                    </template>
                    <div v-else class="list-group-item text-muted small">
                      Sin coincidencias. Usa Buscar.
                    </div>
                  </div>
                </div>
                <input
                  v-else-if="isInputField(field)"
                  v-model="formData[field.name]"
                  :type="inputType(field)"
                  class="form-control"
                  :placeholder="field.placeholder || ''"
                  :disabled="isFieldLocked(field)"
                />
                <textarea
                  v-else-if="field.type === 'textarea'"
                  v-model="formData[field.name]"
                  class="form-control"
                  rows="3"
                  :disabled="isFieldLocked(field)"
                ></textarea>
                <select
                  v-else-if="field.type === 'select'"
                  v-model="formData[field.name]"
                  class="form-select"
                  :disabled="isFieldLocked(field)"
                  @change="handleSelectChange(field)"
                >
                  <option value="">Seleccionar</option>
                  <option v-for="option in field.options || []" :key="option" :value="option">
                    {{ formatSelectOptionLabel(field, option) }}
                  </option>
                </select>
                <select
                  v-else-if="field.type === 'boolean'"
                  v-model="formData[field.name]"
                  class="form-select"
                  :disabled="isFieldLocked(field)"
                >
                  <option value="1">Si</option>
                  <option value="0">No</option>
                </select>
                <input
                  v-else
                  v-model="formData[field.name]"
                  type="text"
                  class="form-control"
                  :disabled="isFieldLocked(field)"
                />
              </div>
            </form>
            <div
              v-if="table?.table === 'process_definition_versions'"
              class="definition-checklist mt-4"
            >
              <div class="definition-checklist-head">
                <strong>Checklist de activacion</strong>
                <span v-if="processDefinitionChecklistLoading" class="text-muted">Validando...</span>
                <span
                  v-else-if="!selectedRow?.id || editorMode === 'create'"
                  class="text-muted"
                >
                  Disponible despues de guardar la definicion.
                </span>
              </div>
              <div class="definition-checklist-items">
                <div class="definition-checklist-item" :class="{ 'is-complete': processDefinitionChecklist.rules }">
                  <font-awesome-icon :icon="processDefinitionChecklist.rules ? 'check' : 'times'" />
                  <span>Al menos una regla activa</span>
                </div>
                <div class="definition-checklist-item" :class="{ 'is-complete': processDefinitionChecklist.triggers }">
                  <font-awesome-icon :icon="processDefinitionChecklist.triggers ? 'check' : 'times'" />
                  <span>Al menos un disparador activo</span>
                </div>
                <div
                  class="definition-checklist-item"
                  :class="{ 'is-complete': processDefinitionChecklist.artifacts || !requiresDefinitionArtifacts }"
                >
                  <font-awesome-icon :icon="(processDefinitionChecklist.artifacts || !requiresDefinitionArtifacts) ? 'check' : 'times'" />
                  <span>
                    {{ requiresDefinitionArtifacts ? "Al menos un paquete vinculado" : "No requiere paquetes" }}
                  </span>
                </div>
              </div>
            </div>

          </div>
          <div class="modal-footer">
            <button
              v-if="table?.table === 'process_definition_versions' && editorMode === 'edit' && selectedRow?.id"
              type="button"
              class="btn btn-outline-primary"
              @click="openDefinitionRulesFromEditor"
            >
              <font-awesome-icon icon="sitemap" class="me-2" />
              Reglas
            </button>
            <button
              v-if="table?.table === 'process_definition_versions' && editorMode === 'edit' && selectedRow?.id"
              type="button"
              class="btn btn-outline-primary"
              @click="openDefinitionTriggersFromEditor"
            >
              <font-awesome-icon icon="sitemap" class="me-2" />
              Disparadores
            </button>
            <button
              v-if="table?.table === 'process_definition_versions' && editorMode === 'edit' && selectedRow?.id"
              type="button"
              class="btn btn-outline-primary"
              @click="openDefinitionArtifactsFromEditor"
            >
              <font-awesome-icon icon="link" class="me-2" />
              Paquetes
            </button>
            <button type="button" class="btn btn-outline-secondary" data-modal-dismiss>
              Cancelar
            </button>
            <button type="button" class="btn btn-primary" @click="submitForm">
              Guardar
            </button>
          </div>
        </div>
      </div>
    </div>

    <div
      class="modal fade"
      id="processDefinitionVersioningModal"
      tabindex="-1"
      aria-labelledby="processDefinitionVersioningModalLabel"
      aria-hidden="true"
      ref="processDefinitionVersioningModal"
    >
      <div class="modal-dialog modal-xl">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="processDefinitionVersioningModalLabel">Crear nueva version</h5>
            <button
              type="button"
              class="btn-close"
              aria-label="Close"
              @click="closeProcessDefinitionVersioningModal"
            ></button>
          </div>
          <div class="modal-body">
            <p class="mb-2">
              La definicion activa no puede modificarse directamente en sus campos funcionales.
            </p>
            <p class="mb-0 text-muted">
              Puedes cancelar esta edicion o convertir el formulario actual en una nueva version en borrador.
            </p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" @click="cancelProcessDefinitionEdit">
              Cancelar edicion
            </button>
            <button type="button" class="btn btn-primary" @click="promoteProcessDefinitionToNewVersion">
              Crear nueva version
            </button>
          </div>
        </div>
      </div>
    </div>

    <div
      class="modal fade"
      id="processDefinitionActivationModal"
      tabindex="-1"
      aria-labelledby="processDefinitionActivationModalLabel"
      aria-hidden="true"
      ref="processDefinitionActivationModal"
    >
      <div class="modal-dialog definition-activation-modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="processDefinitionActivationModalLabel">Activar definicion</h5>
            <button
              type="button"
              class="btn-close"
              aria-label="Close"
              @click="cancelProcessDefinitionActivation"
            ></button>
          </div>
          <div class="modal-body">
            <div v-if="processDefinitionActivationChecking" class="text-muted">
              Validando configuracion de la definicion...
            </div>
            <template v-else>
              <p class="mb-2">
                Vas a activar una definicion en borrador.
              </p>
              <div class="definition-activation-warning mt-3">
                Despues de activarla ya no podras modificar reglas, disparadores ni paquetes en esta misma version.
                Si ya existe una definicion activa en esta misma serie, se retirara automaticamente.
              </div>

              <div class="definition-activation-checklist mt-3">
                <div class="definition-checklist-items">
                  <div class="definition-checklist-item" :class="{ 'is-complete': processDefinitionActivationHasActiveRules }">
                    <font-awesome-icon :icon="processDefinitionActivationHasActiveRules ? 'check' : 'times'" />
                    <span>Al menos una regla activa</span>
                  </div>
                  <div class="definition-checklist-item" :class="{ 'is-complete': processDefinitionActivationHasActiveTriggers }">
                    <font-awesome-icon :icon="processDefinitionActivationHasActiveTriggers ? 'check' : 'times'" />
                    <span>Al menos un disparador activo</span>
                  </div>
                  <div
                    class="definition-checklist-item"
                    :class="{ 'is-complete': processDefinitionActivationHasRequiredArtifacts || !processDefinitionActivationRequiresArtifacts }"
                  >
                    <font-awesome-icon :icon="(processDefinitionActivationHasRequiredArtifacts || !processDefinitionActivationRequiresArtifacts) ? 'check' : 'times'" />
                    <span>
                      {{ processDefinitionActivationRequiresArtifacts ? "Al menos un paquete vinculado" : "No requiere paquetes" }}
                    </span>
                  </div>
                </div>
              </div>

              <div class="definition-activation-panel mt-3">
                <div class="btn-group btn-group-sm definition-activation-menu" role="group" aria-label="Resumen de activacion">
                  <button
                    type="button"
                    class="btn btn-outline-secondary"
                    :class="{ active: processDefinitionActivationView === 'definition' }"
                    @click="processDefinitionActivationView = 'definition'"
                  >
                    Definicion
                  </button>
                  <button
                    type="button"
                    class="btn btn-outline-secondary"
                    :class="{ active: processDefinitionActivationView === 'rules' }"
                    @click="processDefinitionActivationView = 'rules'"
                  >
                    Reglas
                  </button>
                  <button
                    type="button"
                    class="btn btn-outline-secondary"
                    :class="{ active: processDefinitionActivationView === 'triggers' }"
                    @click="processDefinitionActivationView = 'triggers'"
                  >
                    Disparadores
                  </button>
                  <button
                    type="button"
                    class="btn btn-outline-secondary"
                    :class="{ active: processDefinitionActivationView === 'artifacts' }"
                    @click="processDefinitionActivationView = 'artifacts'"
                  >
                    Paquetes
                  </button>
                </div>

                <div v-if="processDefinitionActivationView === 'definition'" class="mt-3">
                  <div class="row g-2 small">
                    <div class="col-12 col-md-6"><strong>Proceso:</strong> {{ formatCell(selectedRow?.process_id, { name: 'process_id' }, selectedRow || {}) }}</div>
                    <div class="col-12 col-md-6"><strong>Serie:</strong> {{ formatCell(selectedRow?.series_id, { name: 'series_id' }, selectedRow || {}) }}</div>
                    <div class="col-12 col-md-6"><strong>Version:</strong> {{ selectedRow?.definition_version || "—" }}</div>
                    <div class="col-12 col-md-6"><strong>Modo:</strong> {{ selectedRow?.execution_mode || "—" }}</div>
                    <div class="col-12"><strong>Nombre:</strong> {{ selectedRow?.name || "—" }}</div>
                    <div class="col-12"><strong>Descripcion:</strong> {{ selectedRow?.description || "—" }}</div>
                  </div>
                </div>

                <div v-else-if="processDefinitionActivationView === 'rules'" class="mt-3">
                  <div v-if="processDefinitionActivationRules.length" class="table-responsive">
                    <table class="table table-sm table-striped align-middle">
                      <thead>
                        <tr>
                          <th>Alcance</th>
                          <th>Destino</th>
                          <th>Activo</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="row in processDefinitionActivationRules" :key="`activation-rule-${row.id}`">
                          <td>{{ row.unit_scope_type || "—" }}</td>
                          <td>{{ formatDefinitionRuleSummary(row) }}</td>
                          <td>{{ Number(row.is_active) === 1 ? "Si" : "No" }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div v-else class="text-muted small">Sin reglas registradas.</div>
                </div>

                <div v-else-if="processDefinitionActivationView === 'triggers'" class="mt-3">
                  <div v-if="processDefinitionActivationTriggers.length" class="table-responsive">
                    <table class="table table-sm table-striped align-middle">
                      <thead>
                        <tr>
                          <th>Modo</th>
                          <th>Tipo de periodo</th>
                          <th>Activo</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="row in processDefinitionActivationTriggers" :key="`activation-trigger-${row.id}`">
                          <td>{{ row.trigger_mode || "—" }}</td>
                          <td>{{ formatCell(row.term_type_id, { name: 'term_type_id' }, row) }}</td>
                          <td>{{ Number(row.is_active) === 1 ? "Si" : "No" }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div v-else class="text-muted small">Sin disparadores registrados.</div>
                </div>

                <div v-else class="mt-3">
                  <div v-if="processDefinitionActivationArtifacts.length" class="table-responsive">
                    <table class="table table-sm table-striped align-middle">
                      <thead>
                        <tr>
                          <th>Paquete</th>
                          <th>Uso</th>
                          <th>Genera tarea</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="row in processDefinitionActivationArtifacts" :key="`activation-artifact-${row.id}`">
                          <td>{{ formatCell(row.template_artifact_id, { name: 'template_artifact_id' }, row) }}</td>
                          <td>{{ row.usage_role || "—" }}</td>
                          <td>{{ Number(row.creates_task) === 1 ? "Si" : "No" }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div v-else class="text-muted small">Sin paquetes vinculados.</div>
                </div>
              </div>
            </template>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" @click="cancelProcessDefinitionActivation">
              Cancelar
            </button>
            <button
              type="button"
              class="btn btn-outline-primary"
              :disabled="processDefinitionActivationChecking || !processDefinitionActivationPrimaryAction"
              @click="handleProcessDefinitionActivationPrimaryAction"
            >
              {{ processDefinitionActivationPrimaryActionLabel }}
            </button>
            <button
              type="button"
              class="btn btn-success"
              :disabled="processDefinitionActivationChecking || !allProcessDefinitionActivationRequirementsMet"
              @click="confirmProcessDefinitionActivation"
            >
              Activar
            </button>
          </div>
        </div>
      </div>
    </div>

    <div
      class="modal fade"
      id="sqlDeleteModal"
      tabindex="-1"
      aria-labelledby="sqlDeleteModalLabel"
      aria-hidden="true"
      ref="deleteModal"
    >
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="sqlDeleteModalLabel">Eliminar registro</h5>
            <button type="button" class="btn-close" data-modal-dismiss aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <p>Confirma la eliminacion del registro seleccionado.</p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" data-modal-dismiss>
              Cancelar
            </button>
            <button type="button" class="btn btn-outline-danger" @click="confirmDelete">
              Eliminar
            </button>
          </div>
        </div>
      </div>
    </div>

    <div
      class="modal fade"
      id="definitionArtifactsPromptModal"
      tabindex="-1"
      aria-labelledby="definitionArtifactsPromptModalLabel"
      aria-hidden="true"
      ref="definitionArtifactsPromptModal"
    >
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="definitionArtifactsPromptModalLabel">Definicion creada</h5>
            <button type="button" class="btn-close" @click="closeDefinitionArtifactsPrompt" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <p class="mb-0">
              La definicion se creo correctamente.
              <span v-if="definitionArtifactsPromptContext?.name">
                <strong>{{ definitionArtifactsPromptContext.name }}</strong>.
              </span>
              ¿Deseas agregar reglas o paquetes ahora? Recuerda registrar disparadores antes de activarla.
            </p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" @click="closeDefinitionArtifactsPrompt">
              Ahora no
            </button>
            <button type="button" class="btn btn-outline-primary" @click="confirmDefinitionRulesPrompt">
              Agregar reglas
            </button>
            <button type="button" class="btn btn-outline-primary" @click="confirmDefinitionTriggersPrompt">
              Agregar disparadores
            </button>
            <button type="button" class="btn btn-primary" @click="confirmDefinitionArtifactsPrompt">
              Agregar paquetes
            </button>
          </div>
        </div>
      </div>
    </div>

    <div
      class="modal fade"
      id="definitionArtifactsModal"
      tabindex="-1"
      aria-labelledby="definitionArtifactsModalLabel"
      aria-hidden="true"
      ref="definitionArtifactsModal"
    >
      <div class="modal-dialog modal-xl">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="definitionArtifactsModalLabel">Artifacts de la definicion</h5>
            <button type="button" class="btn-close" @click="closeDefinitionArtifactsManager" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <div v-if="definitionArtifactsContext" class="person-assignment-context mb-3">
              <strong>{{ definitionArtifactsContext.name || `Definicion #${definitionArtifactsContext.id}` }}</strong>
              <span class="text-muted ms-2">
                Serie {{ definitionArtifactsContext.variation_key || "—" }} | Version {{ definitionArtifactsContext.definition_version || "—" }} | Estado {{ definitionArtifactsContext.status || "—" }}
              </span>
            </div>

            <div v-if="definitionArtifactsError" class="alert alert-danger">{{ definitionArtifactsError }}</div>
            <div v-if="definitionArtifactsContext && !canManageDefinitionArtifacts" class="alert alert-info">
              Esta definicion no esta en draft. Solo puedes gestionar artifacts cuando la definicion este en draft.
            </div>
            <div
              v-else-if="canManageDefinitionArtifacts && !definitionArtifactsForm.template_artifact_id"
              class="alert alert-secondary"
            >
              Selecciona un artifact para habilitar el boton de agregar.
            </div>

            <div class="person-assignment-form">
              <div class="row g-3">
                <div class="col-12 col-md-6">
                  <label class="form-label text-dark">Artifact</label>
                  <div class="input-group">
                    <input
                      v-model="definitionArtifactsLabels.template_artifact_id"
                      type="text"
                      class="form-control"
                      placeholder="Selecciona un artifact"
                      readonly
                      @keydown.prevent
                      @paste.prevent
                    />
                    <button
                      class="btn btn-outline-secondary"
                      type="button"
                      title="Limpiar"
                      aria-label="Limpiar"
                      :disabled="!canManageDefinitionArtifacts || !definitionArtifactsForm.template_artifact_id"
                      @click="clearDefinitionArtifactSelection"
                    >
                      <font-awesome-icon icon="times" />
                    </button>
                    <button
                      class="btn btn-outline-secondary"
                      type="button"
                      title="Buscar"
                      aria-label="Buscar"
                      :disabled="!canManageDefinitionArtifacts"
                      @click="openDefinitionArtifactFkSearch"
                    >
                      <font-awesome-icon icon="search" />
                    </button>
                  </div>
                </div>
                <div class="col-12 col-md-3">
                  <label class="form-label text-dark">Uso</label>
                  <select v-model="definitionArtifactsForm.usage_role" class="form-select" :disabled="!canManageDefinitionArtifacts">
                    <option value="manual_fill">manual_fill</option>
                    <option value="system_render">system_render</option>
                    <option value="attachment">attachment</option>
                    <option value="support">support</option>
                  </select>
                </div>
                <div class="col-12 col-md-3">
                  <label class="form-label text-dark">Orden</label>
                  <input v-model="definitionArtifactsForm.sort_order" type="number" min="1" class="form-control" :disabled="!canManageDefinitionArtifacts" />
                </div>
                <div class="col-12 col-md-3">
                  <label class="form-label text-dark">Genera tarea</label>
                  <select v-model="definitionArtifactsForm.creates_task" class="form-select" :disabled="!canManageDefinitionArtifacts">
                    <option value="1">Si</option>
                    <option value="0">No</option>
                  </select>
                </div>
                <div class="col-12 col-md-3">
                  <label class="form-label text-dark">Requerido</label>
                  <select v-model="definitionArtifactsForm.is_required" class="form-select" :disabled="!canManageDefinitionArtifacts">
                    <option value="1">Si</option>
                    <option value="0">No</option>
                  </select>
                </div>
              </div>
              <div class="person-assignment-form-actions">
                <button
                  type="button"
                  class="btn btn-outline-primary"
                  :disabled="!canSubmitDefinitionArtifact"
                  @click="submitDefinitionArtifact"
                >
                  {{ definitionArtifactsEditId ? "Guardar artifact" : "Agregar artifact" }}
                </button>
                <button
                  v-if="definitionArtifactsEditId"
                  type="button"
                  class="btn btn-outline-secondary"
                  @click="resetDefinitionArtifactsForm"
                >
                  Cancelar edicion
                </button>
              </div>
            </div>

            <div v-if="definitionArtifactsLoading" class="text-muted mt-3">Cargando artifacts vinculados...</div>
            <div v-else class="table-responsive mt-3 person-assignment-table">
              <table class="table table-sm table-striped align-middle">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Artifact</th>
                    <th>Uso</th>
                    <th>Genera tarea</th>
                    <th>Requerido</th>
                    <th>Orden</th>
                    <th class="text-end">Accion</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="definitionArtifactsRows.length === 0">
                    <td colspan="7" class="text-center text-muted">Sin artifacts vinculados.</td>
                  </tr>
                  <tr v-for="row in definitionArtifactsRows" :key="row.id">
                    <td>{{ row.id }}</td>
                    <td>{{ formatCell(row.template_artifact_id, { name: 'template_artifact_id' }) }}</td>
                    <td>{{ row.usage_role }}</td>
                    <td>{{ Number(row.creates_task) === 1 ? "Si" : "No" }}</td>
                    <td>{{ Number(row.is_required) === 1 ? "Si" : "No" }}</td>
                    <td>{{ row.sort_order ?? "—" }}</td>
                    <td class="text-end">
                      <div class="d-inline-flex align-items-center gap-1">
                        <button
                          type="button"
                          class="btn btn-sm btn-icon hope-action-btn hope-action-view"
                          title="Visualizar"
                          aria-label="Visualizar"
                          @click="openRecordViewer(row, allTablesMap.process_definition_templates)"
                        >
                          <span class="btn-inner">
                            <font-awesome-icon icon="eye" />
                          </span>
                        </button>
                        <BtnEdit tooltip="Editar artifact" @onpress="startDefinitionArtifactEdit(row)" />
                        <BtnDelete message="Eliminar artifact" @onpress="deleteDefinitionArtifact(row)" />
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-danger" @click="closeDefinitionArtifactsManager">Cerrar</button>
            <button type="button" class="btn btn-outline-primary" @click="acceptDefinitionArtifactsManager">Aceptar</button>
          </div>
        </div>
      </div>
    </div>

    <div
      class="modal fade"
      id="definitionTriggersModal"
      tabindex="-1"
      aria-labelledby="definitionTriggersModalLabel"
      aria-hidden="true"
      ref="definitionTriggersModal"
    >
      <div class="modal-dialog modal-xl">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="definitionTriggersModalLabel">Disparadores de la definicion</h5>
            <button type="button" class="btn-close" @click="closeDefinitionTriggersManager" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <div v-if="definitionTriggersContext" class="person-assignment-context mb-3">
              <strong>{{ definitionTriggersContext.name || `Definicion #${definitionTriggersContext.id}` }}</strong>
              <span class="text-muted ms-2">
                Serie {{ definitionTriggersContext.variation_key || "—" }} | Version {{ definitionTriggersContext.definition_version || "—" }} | Estado {{ definitionTriggersContext.status || "—" }}
              </span>
            </div>

            <div v-if="definitionTriggersError" class="alert alert-danger">{{ definitionTriggersError }}</div>
            <div v-if="definitionTriggersContext && !canManageDefinitionTriggers" class="alert alert-info">
              Esta definicion no esta en draft. Solo puedes gestionar disparadores cuando la definicion este en draft.
            </div>

            <div class="person-assignment-form">
              <div class="row g-3">
                <div class="col-12 col-md-4">
                  <label class="form-label text-dark">Modo de disparo</label>
                  <select
                    v-model="definitionTriggersForm.trigger_mode"
                    class="form-select"
                    :disabled="!canManageDefinitionTriggers"
                    @change="handleDefinitionTriggerModeChange"
                  >
                    <option value="automatic_by_term_type">automatic_by_term_type</option>
                    <option value="manual_only">manual_only</option>
                    <option value="manual_custom_term">manual_custom_term</option>
                  </select>
                </div>
                <div class="col-12 col-md-4">
                  <label class="form-label text-dark">Tipo de periodo</label>
                  <div class="input-group">
                    <input
                      v-model="definitionTriggersLabels.term_type_id"
                      type="text"
                      class="form-control"
                      placeholder="Selecciona un tipo"
                      readonly
                      @keydown.prevent
                      @paste.prevent
                    />
                    <button
                      class="btn btn-outline-secondary"
                      type="button"
                      title="Limpiar"
                      aria-label="Limpiar"
                      :disabled="!canManageDefinitionTriggers || !definitionTriggersForm.term_type_id || !definitionTriggerRequiresTermType"
                      @click="clearDefinitionTriggerTermType"
                    >
                      <font-awesome-icon icon="times" />
                    </button>
                    <button
                      class="btn btn-outline-secondary"
                      type="button"
                      title="Buscar"
                      aria-label="Buscar"
                      :disabled="!canManageDefinitionTriggers || !definitionTriggerRequiresTermType"
                      @click="openDefinitionTriggerFkSearch"
                    >
                      <font-awesome-icon icon="search" />
                    </button>
                  </div>
                </div>
                <div class="col-12 col-md-4">
                  <label class="form-label text-dark">Activo</label>
                  <select v-model="definitionTriggersForm.is_active" class="form-select" :disabled="!canManageDefinitionTriggers">
                    <option value="1">Si</option>
                    <option value="0">No</option>
                  </select>
                </div>
              </div>
              <div class="person-assignment-form-actions">
                <button
                  type="button"
                  class="btn btn-outline-primary"
                  :disabled="!canSubmitDefinitionTrigger"
                  @click="submitDefinitionTrigger"
                >
                  {{ definitionTriggersEditId ? "Guardar disparador" : "Agregar disparador" }}
                </button>
                <button
                  v-if="definitionTriggersEditId"
                  type="button"
                  class="btn btn-outline-secondary"
                  @click="resetDefinitionTriggersForm"
                >
                  Cancelar edicion
                </button>
              </div>
            </div>

            <div v-if="definitionTriggersLoading" class="text-muted mt-3">Cargando disparadores vinculados...</div>
            <div v-else class="table-responsive mt-3 person-assignment-table">
              <table class="table table-sm table-striped align-middle">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Modo</th>
                    <th>Tipo de periodo</th>
                    <th>Activo</th>
                    <th class="text-end">Accion</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="definitionTriggersRows.length === 0">
                    <td colspan="5" class="text-center text-muted">Sin disparadores vinculados.</td>
                  </tr>
                  <tr v-for="row in definitionTriggersRows" :key="row.id">
                    <td>{{ row.id }}</td>
                    <td>{{ row.trigger_mode }}</td>
                    <td>{{ formatCell(row.term_type_id, { name: 'term_type_id' }) }}</td>
                    <td>{{ Number(row.is_active) === 1 ? "Si" : "No" }}</td>
                    <td class="text-end">
                      <div class="d-inline-flex align-items-center gap-1">
                        <button
                          type="button"
                          class="btn btn-sm btn-icon hope-action-btn hope-action-view"
                          title="Visualizar"
                          aria-label="Visualizar"
                          @click="openRecordViewer(row, allTablesMap.process_definition_triggers)"
                        >
                          <span class="btn-inner">
                            <font-awesome-icon icon="eye" />
                          </span>
                        </button>
                        <BtnEdit tooltip="Editar disparador" @onpress="startDefinitionTriggerEdit(row)" />
                        <BtnDelete message="Eliminar disparador" @onpress="deleteDefinitionTrigger(row)" />
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-danger" @click="closeDefinitionTriggersManager">Cerrar</button>
            <button type="button" class="btn btn-outline-primary" @click="acceptDefinitionTriggersManager">Aceptar</button>
          </div>
        </div>
      </div>
    </div>

    <div
      class="modal fade"
      id="definitionRulesModal"
      tabindex="-1"
      aria-labelledby="definitionRulesModalLabel"
      aria-hidden="true"
      ref="definitionRulesModal"
    >
      <div class="modal-dialog modal-xl">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="definitionRulesModalLabel">Reglas de la definicion</h5>
            <button type="button" class="btn-close" @click="closeDefinitionRulesManager" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <div v-if="definitionRulesContext" class="person-assignment-context mb-3">
              <strong>{{ definitionRulesContext.name || `Definicion #${definitionRulesContext.id}` }}</strong>
              <span class="text-muted ms-2">
                Serie {{ definitionRulesContext.variation_key || "—" }} | Version {{ definitionRulesContext.definition_version || "—" }} | Estado {{ definitionRulesContext.status || "—" }}
              </span>
            </div>

            <div v-if="definitionRulesError" class="alert alert-danger">{{ definitionRulesError }}</div>
            <div v-if="definitionRulesContext && !canManageDefinitionRules" class="alert alert-info">
              Esta definicion no esta en draft. Solo puedes gestionar reglas cuando la definicion este en draft.
            </div>
            <div
              v-else-if="canManageDefinitionRules && !canSubmitDefinitionRule"
              class="alert alert-secondary"
            >
              Completa el alcance requerido para habilitar el boton de guardar.
            </div>

            <div class="person-assignment-form">
              <div class="row g-3">
                <div class="col-12 col-md-3">
                  <label class="form-label text-dark">Alcance</label>
                  <select
                    v-model="definitionRulesForm.unit_scope_type"
                    class="form-select"
                    :disabled="!canManageDefinitionRules"
                    @change="handleDefinitionRuleScopeChange"
                  >
                    <option value="unit_exact">unit_exact</option>
                    <option value="unit_subtree">unit_subtree</option>
                    <option value="unit_type">unit_type</option>
                    <option value="all_units">all_units</option>
                  </select>
                </div>
                <div class="col-12 col-md-3">
                  <label class="form-label text-dark">Unidad</label>
                  <div class="input-group">
                    <input
                      v-model="definitionRulesLabels.unit_id"
                      type="text"
                      class="form-control"
                      placeholder="Selecciona una unidad"
                      readonly
                      @keydown.prevent
                      @paste.prevent
                    />
                    <button
                      class="btn btn-outline-secondary"
                      type="button"
                      title="Limpiar"
                      aria-label="Limpiar"
                      :disabled="!canManageDefinitionRules || !definitionRulesForm.unit_id"
                      @click="clearDefinitionRuleField('unit_id')"
                    >
                      <font-awesome-icon icon="times" />
                    </button>
                    <button
                      class="btn btn-outline-secondary"
                      type="button"
                      title="Buscar"
                      aria-label="Buscar"
                      :disabled="!canManageDefinitionRules"
                      @click="openDefinitionRuleFkSearch('unit_id')"
                    >
                      <font-awesome-icon icon="search" />
                    </button>
                  </div>
                </div>
                <div class="col-12 col-md-3">
                  <label class="form-label text-dark">Tipo de unidad</label>
                  <div class="input-group">
                    <input
                      v-model="definitionRulesLabels.unit_type_id"
                      type="text"
                      class="form-control"
                      placeholder="Selecciona un tipo"
                      readonly
                      @keydown.prevent
                      @paste.prevent
                    />
                    <button
                      class="btn btn-outline-secondary"
                      type="button"
                      title="Limpiar"
                      aria-label="Limpiar"
                      :disabled="!canManageDefinitionRules || !definitionRulesForm.unit_type_id"
                      @click="clearDefinitionRuleField('unit_type_id')"
                    >
                      <font-awesome-icon icon="times" />
                    </button>
                    <button
                      class="btn btn-outline-secondary"
                      type="button"
                      title="Buscar"
                      aria-label="Buscar"
                      :disabled="!canManageDefinitionRules"
                      @click="openDefinitionRuleFkSearch('unit_type_id')"
                    >
                      <font-awesome-icon icon="search" />
                    </button>
                  </div>
                </div>
                <div class="col-12 col-md-3">
                  <label class="form-label text-dark">Cargo</label>
                  <div class="input-group">
                    <input
                      v-model="definitionRulesLabels.cargo_id"
                      type="text"
                      class="form-control"
                      placeholder="Selecciona un cargo"
                      readonly
                      @keydown.prevent
                      @paste.prevent
                    />
                    <button
                      class="btn btn-outline-secondary"
                      type="button"
                      title="Limpiar"
                      aria-label="Limpiar"
                      :disabled="!canManageDefinitionRules || !definitionRulesForm.cargo_id"
                      @click="clearDefinitionRuleField('cargo_id')"
                    >
                      <font-awesome-icon icon="times" />
                    </button>
                    <button
                      class="btn btn-outline-secondary"
                      type="button"
                      title="Buscar"
                      aria-label="Buscar"
                      :disabled="!canManageDefinitionRules"
                      @click="openDefinitionRuleFkSearch('cargo_id')"
                    >
                      <font-awesome-icon icon="search" />
                    </button>
                  </div>
                </div>
                <div class="col-12 col-md-4">
                  <label class="form-label text-dark">Puesto exacto</label>
                  <div class="input-group">
                    <input
                      v-model="definitionRulesLabels.position_id"
                      type="text"
                      class="form-control"
                      placeholder="Selecciona un puesto"
                      readonly
                      @keydown.prevent
                      @paste.prevent
                    />
                    <button
                      class="btn btn-outline-secondary"
                      type="button"
                      title="Limpiar"
                      aria-label="Limpiar"
                      :disabled="!canManageDefinitionRules || !definitionRulesForm.position_id"
                      @click="clearDefinitionRuleField('position_id')"
                    >
                      <font-awesome-icon icon="times" />
                    </button>
                    <button
                      class="btn btn-outline-secondary"
                      type="button"
                      title="Buscar"
                      aria-label="Buscar"
                      :disabled="!canManageDefinitionRules"
                      @click="openDefinitionRuleFkSearch('position_id')"
                    >
                      <font-awesome-icon icon="search" />
                    </button>
                  </div>
                </div>
                <div class="col-12 col-md-3">
                  <label class="form-label text-dark">Entrega</label>
                  <select v-model="definitionRulesForm.recipient_policy" class="form-select" :disabled="!canManageDefinitionRules">
                    <option value="all_matches">all_matches</option>
                    <option value="one_per_unit">one_per_unit</option>
                    <option value="one_match_only">one_match_only</option>
                    <option value="exact_position">exact_position</option>
                  </select>
                </div>
                <div class="col-12 col-md-2">
                  <label class="form-label text-dark">Prioridad</label>
                  <input v-model="definitionRulesForm.priority" type="number" min="1" class="form-control" :disabled="!canManageDefinitionRules" />
                </div>
                <div class="col-12 col-md-3">
                  <label class="form-label text-dark">Activo</label>
                  <select v-model="definitionRulesForm.is_active" class="form-select" :disabled="!canManageDefinitionRules">
                    <option value="1">Si</option>
                    <option value="0">No</option>
                  </select>
                </div>
                <div class="col-12 col-md-3">
                  <label class="form-label text-dark">Incluye descendientes</label>
                  <select v-model="definitionRulesForm.include_descendants" class="form-select" :disabled="!canManageDefinitionRules">
                    <option value="1">Si</option>
                    <option value="0">No</option>
                  </select>
                </div>
                <div class="col-12 col-md-3">
                  <label class="form-label text-dark">Vigencia desde</label>
                  <input v-model="definitionRulesForm.effective_from" type="date" class="form-control" :disabled="!canManageDefinitionRules" />
                </div>
                <div class="col-12 col-md-3">
                  <label class="form-label text-dark">Vigencia hasta</label>
                  <input v-model="definitionRulesForm.effective_to" type="date" class="form-control" :disabled="!canManageDefinitionRules" />
                </div>
              </div>
              <div class="person-assignment-form-actions">
                <button
                  type="button"
                  class="btn btn-outline-primary"
                  :disabled="!canSubmitDefinitionRule"
                  @click="submitDefinitionRule"
                >
                  {{ definitionRulesEditId ? "Guardar regla" : "Agregar regla" }}
                </button>
                <button
                  v-if="definitionRulesEditId"
                  type="button"
                  class="btn btn-outline-secondary"
                  @click="resetDefinitionRulesForm"
                >
                  Cancelar edicion
                </button>
              </div>
            </div>

            <div v-if="definitionRulesLoading" class="text-muted mt-3">Cargando reglas vinculadas...</div>
            <div v-else class="table-responsive mt-3 person-assignment-table">
              <table class="table table-sm table-striped align-middle">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Alcance</th>
                    <th>Unidad</th>
                    <th>Tipo de unidad</th>
                    <th>Cargo</th>
                    <th>Puesto</th>
                    <th>Entrega</th>
                    <th>Activo</th>
                    <th class="text-end">Accion</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="definitionRulesRows.length === 0">
                    <td colspan="9" class="text-center text-muted">Sin reglas vinculadas.</td>
                  </tr>
                  <tr v-for="row in definitionRulesRows" :key="row.id">
                    <td>{{ row.id }}</td>
                    <td>{{ formatDefinitionRuleCell(row, "unit_scope_type") }}</td>
                    <td>{{ formatDefinitionRuleCell(row, "unit_id") }}</td>
                    <td>{{ formatDefinitionRuleCell(row, "unit_type_id") }}</td>
                    <td>{{ formatDefinitionRuleCell(row, "cargo_id") }}</td>
                    <td>{{ formatDefinitionRuleCell(row, "position_id") }}</td>
                    <td>{{ formatDefinitionRuleCell(row, "recipient_policy") }}</td>
                    <td>{{ Number(row.is_active) === 1 ? "Si" : "No" }}</td>
                    <td class="text-end">
                      <div class="d-inline-flex align-items-center gap-1">
                        <button
                          type="button"
                          class="btn btn-sm btn-icon hope-action-btn hope-action-view"
                          title="Visualizar"
                          aria-label="Visualizar"
                          @click="openRecordViewer(row, allTablesMap.process_target_rules)"
                        >
                          <span class="btn-inner">
                            <font-awesome-icon icon="eye" />
                          </span>
                        </button>
                        <BtnEdit tooltip="Editar regla" @onpress="startDefinitionRuleEdit(row)" />
                        <BtnDelete message="Eliminar regla" @onpress="deleteDefinitionRule(row)" />
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-danger" @click="closeDefinitionRulesManager">Cerrar</button>
            <button type="button" class="btn btn-outline-primary" @click="acceptDefinitionRulesManager">Aceptar</button>
          </div>
        </div>
      </div>
    </div>

    <div
      class="modal fade"
      id="sqlFkModal"
      tabindex="-1"
      aria-labelledby="sqlFkModalLabel"
      aria-hidden="true"
      ref="fkModal"
    >
      <div
        class="modal-dialog"
        :class="isFkTemplateArtifacts || isFkProcessDefinitions ? 'modal-xl' : 'modal-lg'"
      >
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="sqlFkModalLabel">
              Buscar referencia {{ fkTable?.label || "" }}
            </h5>
            <button type="button" class="btn-close" data-modal-dismiss aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <div class="row g-3 align-items-end mb-3">
              <template v-if="isFkUnits">
                <div class="col-12 col-md-7">
                  <label class="form-label text-dark">Busqueda</label>
                  <input
                    v-model="fkSearch"
                    type="text"
                    class="form-control"
                    placeholder="Buscar referencia"
                    @input="debouncedFkSearch"
                  />
                </div>
                <div class="col-12 col-md-4">
                  <label class="form-label text-dark">Tipo de unidad</label>
                  <select
                    v-model="fkPositionFilters.unit_type_id"
                    class="form-select"
                    :disabled="fkPositionFilterLoading"
                    @change="handleFkUnitTypeChange"
                  >
                    <option value="">Todos</option>
                    <option
                      v-for="row in fkUnitTypeOptions"
                      :key="row.id"
                      :value="String(row.id)"
                    >
                      {{ formatFkOptionLabel("unit_types", row) }}
                    </option>
                  </select>
                </div>
                <div class="col-12 col-md-auto d-flex align-items-end justify-content-md-end fk-inline-clear-col">
                  <button
                    type="button"
                    class="btn btn-outline-secondary fk-inline-clear-btn"
                    title="Limpiar filtro"
                    aria-label="Limpiar filtro"
                    :disabled="!fkPositionFilters.unit_type_id"
                    @click="clearFkUnitPositionFilters"
                  >
                    <span class="btn-inner">
                      <font-awesome-icon icon="times" />
                    </span>
                  </button>
                </div>
              </template>
              <template v-else-if="isFkProcessDefinitions">
                <div class="col-12 col-md-3">
                  <label class="form-label text-dark">Busqueda</label>
                  <input
                    v-model="fkSearch"
                    type="text"
                    class="form-control"
                    placeholder="Buscar referencia"
                    @input="debouncedFkSearch"
                  />
                </div>
                <div class="col-12 col-md-3">
                  <label class="form-label text-dark">Proceso</label>
                  <select
                    v-model="fkFilters.process_id"
                    class="form-select"
                    @change="handleFkProcessDefinitionFilterChange"
                  >
                    <option value="">Todos</option>
                    <option
                      v-for="row in fkProcessDefinitionProcessOptions"
                      :key="row.id"
                      :value="String(row.id)"
                    >
                      {{ formatFkOptionLabel("processes", row) }}
                    </option>
                  </select>
                </div>
                <div class="col-12 col-md-3">
                  <label class="form-label text-dark">Serie</label>
                  <input
                    v-model="fkFilters.variation_key"
                    type="text"
                    class="form-control"
                    placeholder="Filtrar por serie"
                    list="fkProcessDefinitionSeriesList"
                    @input="debouncedFkSearch"
                  />
                  <datalist id="fkProcessDefinitionSeriesList">
                    <option
                      v-for="option in fkProcessDefinitionSeriesOptions"
                      :key="option"
                      :value="option"
                    />
                  </datalist>
                </div>
                <div class="col-12 col-md-2">
                  <label class="form-label text-dark">Modo</label>
                  <select
                    v-model="fkFilters.execution_mode"
                    class="form-select"
                    @change="handleFkProcessDefinitionFilterChange"
                  >
                    <option value="">Todos</option>
                    <option
                      v-for="option in getFkTableFieldOptions('execution_mode')"
                      :key="option"
                      :value="option"
                    >
                      {{ formatSelectOptionLabel(getFkTableField('execution_mode'), option) }}
                    </option>
                  </select>
                </div>
                <div class="col-12 col-md-auto d-flex align-items-end justify-content-md-end fk-inline-clear-col">
                  <button
                    type="button"
                    class="btn btn-outline-secondary fk-inline-clear-btn"
                    title="Limpiar filtro"
                    aria-label="Limpiar filtro"
                    :disabled="!hasFkProcessDefinitionFilters"
                    @click="clearFkProcessDefinitionFilters"
                  >
                    <span class="btn-inner">
                      <font-awesome-icon icon="times" />
                    </span>
                  </button>
                </div>
              </template>
              <template v-else-if="isFkTemplateArtifacts">
                <div class="col-12 col-md-3">
                  <label class="form-label text-dark">Busqueda</label>
                  <input
                    v-model="fkSearch"
                    type="text"
                    class="form-control"
                    placeholder="Buscar referencia"
                    @input="debouncedFkSearch"
                  />
                </div>
                <div class="col-12 col-md-3">
                  <label class="form-label text-dark">Codigo</label>
                  <input
                    v-model="fkFilters.template_code"
                    type="text"
                    class="form-control"
                    placeholder="Filtrar por codigo"
                    @input="debouncedFkSearch"
                  />
                </div>
                <div class="col-12 col-md-3">
                  <label class="form-label text-dark">Version storage</label>
                  <input
                    v-model="fkFilters.storage_version"
                    type="text"
                    class="form-control"
                    placeholder="Filtrar por version"
                    @input="debouncedFkSearch"
                  />
                </div>
                <div class="col-12 col-md-2">
                  <label class="form-label text-dark">Activo</label>
                  <select
                    v-model="fkFilters.is_active"
                    class="form-select"
                    @change="handleFkTemplateArtifactFilterChange"
                  >
                    <option value="">Todos</option>
                    <option value="1">Si</option>
                    <option value="0">No</option>
                  </select>
                </div>
                <div class="col-12 col-md-auto d-flex align-items-end justify-content-md-end fk-inline-clear-col">
                  <button
                    type="button"
                    class="btn btn-outline-secondary fk-inline-clear-btn"
                    title="Limpiar filtro"
                    aria-label="Limpiar filtro"
                    :disabled="!hasFkTemplateArtifactFilters"
                    @click="clearFkTemplateArtifactFilters"
                  >
                    <span class="btn-inner">
                      <font-awesome-icon icon="times" />
                    </span>
                  </button>
                </div>
              </template>
              <div v-else class="col-12">
                <label class="form-label text-dark">Busqueda</label>
                <input
                  v-model="fkSearch"
                  type="text"
                  class="form-control"
                  placeholder="Buscar referencia"
                  @input="debouncedFkSearch"
                />
              </div>
            </div>
            <div v-if="isFkUnitPositions" class="row g-3 align-items-end mb-3">
              <div class="col-12 col-md-4">
                <label class="form-label text-dark">Tipo de unidad</label>
                <select
                  v-model="fkPositionFilters.unit_type_id"
                  class="form-select"
                  :disabled="fkPositionFilterLoading"
                  @change="handleFkUnitTypeChange"
                >
                  <option value="">Todos</option>
                  <option
                    v-for="row in fkUnitTypeOptions"
                    :key="row.id"
                    :value="String(row.id)"
                  >
                    {{ formatFkOptionLabel("unit_types", row) }}
                  </option>
                </select>
              </div>
              <div class="col-12 col-md-4">
                <label class="form-label text-dark">Unidad</label>
                <select
                  v-model="fkPositionFilters.unit_id"
                  class="form-select"
                  :disabled="!fkPositionFilters.unit_type_id || fkPositionFilterLoading"
                  @change="handleFkUnitChange"
                >
                  <option value="">Todas</option>
                  <option
                    v-for="row in fkUnitOptions"
                    :key="row.id"
                    :value="String(row.id)"
                  >
                    {{ formatFkOptionLabel("units", row) }}
                  </option>
                </select>
              </div>
              <div class="col-12 col-md-4">
                <label class="form-label text-dark">Cargo</label>
                <select
                  v-model="fkPositionFilters.cargo_id"
                  class="form-select"
                  :disabled="fkPositionFilterLoading"
                  @change="handleFkCargoChange"
                >
                  <option value="">Todos</option>
                  <option
                    v-for="row in fkCargoOptions"
                    :key="row.id"
                    :value="String(row.id)"
                  >
                    {{ formatFkOptionLabel("cargos", row) }}
                  </option>
                </select>
              </div>
              <div class="col-12 d-flex justify-content-end fk-inline-clear-col">
                <button
                  type="button"
                  class="btn btn-outline-secondary fk-inline-clear-btn"
                  title="Limpiar filtro"
                  aria-label="Limpiar filtro"
                  :disabled="!fkPositionFilters.unit_type_id && !fkPositionFilters.unit_id && !fkPositionFilters.cargo_id"
                  @click="clearFkUnitPositionFilters"
                >
                  <span class="btn-inner">
                    <font-awesome-icon icon="times" />
                  </span>
                </button>
              </div>
            </div>
            <div v-if="fkLoading" class="text-muted">Cargando...</div>
            <div v-else-if="fkError" class="admin-inline-error" role="alert">{{ fkError }}</div>
            <div v-else class="table-responsive table-actions">
              <div class="table-actions-scroll">
                <table class="table table-striped table-hover align-middle table-institutional table-actions">
                  <thead>
                    <tr>
                      <th class="text-start">ID</th>
                      <th class="text-start">{{ fkPrimaryListLabel }}</th>
                      <th
                        v-for="field in fkListExtraFields"
                        :key="field.name"
                        class="text-start"
                      >
                        {{ field.label || field.name }}
                      </th>
                      <th class="text-start admin-action-col">Accion</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="fkRows.length === 0">
                      <td :colspan="3 + fkListExtraFields.length" class="text-center text-muted">
                        <p class="my-3">No hay registros disponibles</p>
                      </td>
                    </tr>
                    <tr v-for="row in fkRows" :key="row.id">
                      <td>{{ row.id }}</td>
                      <td>
                        {{ formatFkPrimaryCell(row) }}
                      </td>
                      <td v-for="field in fkListExtraFields" :key="field.name">
                        <template v-if="field.name === 'available_formats'">
                          <div class="available-formats-cell">
                            <template v-if="getAvailableFormatSections(row[field.name]).length">
                              <div
                                v-for="section in getAvailableFormatSections(row[field.name])"
                                :key="section.mode"
                                class="available-formats-group"
                                :class="{ 'is-inline': section.mode === 'user' }"
                              >
                                <span class="available-formats-mode">{{ section.label }}</span>
                                <div class="available-formats-badges">
                                  <span
                                    v-for="entry in section.entries"
                                    :key="`${section.mode}-${entry.format}`"
                                    class="available-formats-badge"
                                    :style="getAvailableFormatBadgeStyle(section.mode, entry)"
                                  >
                                    {{ entry.formatLabel }}
                                  </span>
                                </div>
                              </div>
                            </template>
                            <span v-else>—</span>
                          </div>
                        </template>
                        <template v-else>
                          {{ formatFkListCell(row, field) }}
                        </template>
                      </td>
                      <td class="text-end admin-action-col">
                        <div class="d-inline-flex align-items-center gap-1 fk-row-actions">
                          <button
                            type="button"
                            class="btn btn-sm btn-icon hope-action-btn hope-action-view"
                            title="Visualizar"
                            aria-label="Visualizar"
                            @click="openFkViewer(row)"
                          >
                            <span class="btn-inner">
                              <font-awesome-icon icon="eye" />
                            </span>
                          </button>
                          <button
                            type="button"
                            class="btn btn-sm btn-icon hope-action-btn hope-action-select"
                            title="Seleccionar"
                            aria-label="Seleccionar"
                            @click="selectFkRow(row)"
                          >
                            <span class="btn-inner">
                              <font-awesome-icon icon="check" />
                            </span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button
              v-if="canOpenFkFilterModal"
              type="button"
              class="btn btn-outline-secondary"
              title="Buscar"
              aria-label="Buscar"
              @click="openFkFilterModal"
            >
              <font-awesome-icon icon="search" />
            </button>
            <button
              type="button"
              class="btn btn-outline-primary"
              :disabled="!canCreateFkReference"
              @click="openFkCreate"
            >
              <font-awesome-icon icon="plus" class="me-2" />
              Crear nuevo
            </button>
            <button type="button" class="btn btn-outline-danger" data-modal-dismiss>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>

    <div
      class="modal fade"
      id="recordViewerModal"
      tabindex="-1"
      aria-labelledby="recordViewerModalLabel"
      aria-hidden="true"
      ref="recordViewerModal"
    >
      <div class="modal-dialog modal-xl">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="recordViewerModalLabel">
              Visualizar registro {{ recordViewerTable?.label || "" }}
            </h5>
            <button type="button" class="btn-close" aria-label="Close" @click="closeRecordViewer"></button>
          </div>
          <div class="modal-body">
            <div v-if="recordViewerLoading" class="text-muted">
              Cargando información del registro...
            </div>
            <div v-else-if="recordViewerError" class="alert alert-danger mb-0">
              {{ recordViewerError }}
            </div>
            <div v-else-if="recordViewerTable && recordViewerRow">
              <div class="table-responsive">
                <table class="table table-striped align-middle table-institutional">
                  <tbody>
                    <tr v-for="field in recordViewerFields" :key="field.name">
                      <th class="text-start">{{ field.label || field.name }}</th>
                      <td>
                        <template v-if="field.name === 'available_formats'">
                          <div class="available-formats-viewer">
                            <template v-if="getAvailableFormatSections(recordViewerRow[field.name]).length">
                              <div
                                v-for="section in getAvailableFormatSections(recordViewerRow[field.name])"
                                :key="section.mode"
                                class="available-formats-viewer-section"
                              >
                                <div class="available-formats-viewer-title">{{ section.label }}</div>
                                <div
                                  v-for="entry in section.entries"
                                  :key="`${section.mode}-${entry.format}`"
                                  class="available-formats-viewer-entry"
                                >
                                  <span
                                    class="available-formats-badge is-viewer"
                                    :style="getAvailableFormatBadgeStyle(section.mode, entry)"
                                  >
                                    {{ entry.formatLabel }}
                                  </span>
                                  <code class="available-formats-path">
                                    {{ entry.entryObjectKey }}
                                  </code>
                                </div>
                              </div>
                            </template>
                            <span v-else>—</span>
                          </div>
                        </template>
                        <template v-else>
                          {{ formatRecordViewerValue(field, recordViewerRow) }}
                        </template>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div
                v-for="section in recordViewerRelatedSections"
                :key="section.key"
                class="mt-4"
              >
                <h6 class="mb-2 person-subtitle">
                  <font-awesome-icon icon="list-check" />
                  <span>{{ section.label }}</span>
                </h6>
                <div v-if="section.error" class="alert alert-danger py-2 mb-0">
                  {{ section.error }}
                </div>
                <div v-else-if="section.rows.length === 0" class="text-muted">
                  Sin registros relacionados.
                </div>
                <div v-else class="table-responsive">
                  <table class="table table-sm table-striped align-middle">
                    <thead>
                      <tr>
                        <th
                          v-for="field in section.fields"
                          :key="field.name"
                          class="text-start"
                        >
                          {{ field.label || field.name }}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="sectionRow in section.rows"
                        :key="rowKeyForTable(section.tableMeta, sectionRow)"
                      >
                        <td v-for="field in section.fields" :key="field.name">
                          {{ formatValueForTable(section.tableMeta, sectionRow[field.name], field, sectionRow) }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div v-else class="text-muted">
              No hay información para visualizar.
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-danger" @click="closeRecordViewer">
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>

    <div
      class="modal fade"
      id="sqlFkViewerModal"
      tabindex="-1"
      aria-labelledby="sqlFkViewerModalLabel"
      aria-hidden="true"
      ref="fkViewerModal"
    >
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="sqlFkViewerModalLabel">
              Visualizar referencia {{ fkTable?.label || "" }}
            </h5>
            <button type="button" class="btn-close" aria-label="Close" @click="closeFkViewer"></button>
          </div>
          <div class="modal-body">
            <div v-if="!fkViewerRow" class="text-muted">
              No hay información para visualizar.
            </div>
            <div v-else class="table-responsive">
              <table class="table table-striped align-middle table-institutional">
                <tbody>
                  <tr v-for="field in fkViewerFields" :key="field.name">
                    <th class="text-start">{{ field.label || field.name }}</th>
                    <td>{{ formatFkViewerValue(field, fkViewerRow) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-danger" @click="closeFkViewer">
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>

    <div
      class="modal fade"
      id="sqlFkFilterModal"
      tabindex="-1"
      aria-labelledby="sqlFkFilterModalLabel"
      aria-hidden="true"
      ref="fkFilterModal"
    >
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="sqlFkFilterModalLabel">
              Buscar referencia {{ fkTable?.label || "" }}
            </h5>
            <button type="button" class="btn-close" aria-label="Close" @click="cancelFkFilter"></button>
          </div>
          <div class="modal-body">
            <div v-if="!fkFilterFields.length" class="text-muted">
              No hay campos disponibles para aplicar filtros.
            </div>
            <form v-else class="row g-3">
              <div
                v-for="field in fkFilterFields"
                :key="field.name"
                class="col-12 col-md-6"
              >
                <label class="form-label">
                  {{ field.label || field.name }}
                </label>
                <input
                  v-if="isInputField(field)"
                  v-model="fkFilters[field.name]"
                  :type="inputType(field)"
                  class="form-control"
                  :placeholder="field.placeholder || ''"
                />
                <textarea
                  v-else-if="field.type === 'textarea'"
                  v-model="fkFilters[field.name]"
                  class="form-control"
                  rows="3"
                ></textarea>
                <select
                  v-else-if="field.type === 'select'"
                  v-model="fkFilters[field.name]"
                  class="form-select"
                >
                  <option value="">Todos</option>
                  <option v-for="option in field.options || []" :key="option" :value="option">
                    {{ formatSelectOptionLabel(field, option) }}
                  </option>
                </select>
                <select
                  v-else-if="field.type === 'boolean'"
                  v-model="fkFilters[field.name]"
                  class="form-select"
                >
                  <option value="">Todos</option>
                  <option value="1">Si</option>
                  <option value="0">No</option>
                </select>
                <input
                  v-else
                  v-model="fkFilters[field.name]"
                  type="text"
                  class="form-control"
                  :placeholder="field.placeholder || ''"
                />
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" @click="cancelFkFilter">
              Cancelar
            </button>
            <button type="button" class="btn btn-outline-primary" @click="clearFkFilters">
              Limpiar
            </button>
            <button type="button" class="btn btn-primary" title="Buscar" aria-label="Buscar" @click="applyFkFilters">
              <font-awesome-icon icon="search" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <div
      class="modal fade"
      id="sqlFkCreateModal"
      tabindex="-1"
      aria-labelledby="sqlFkCreateModalLabel"
      aria-hidden="true"
      ref="fkCreateModal"
    >
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="sqlFkCreateModalLabel">
              Crear referencia {{ fkTable?.label || "" }}
            </h5>
            <button type="button" class="btn-close" aria-label="Close" @click="cancelFkCreate"></button>
          </div>
          <div class="modal-body">
            <div v-if="fkCreateError" class="alert alert-danger mb-3">
              {{ fkCreateError }}
            </div>
            <div v-if="!fkCreateFields.length" class="text-muted">
              No hay campos editables disponibles para crear esta referencia.
            </div>
            <form v-else class="row g-3">
              <div
                v-for="field in fkCreateFields"
                :key="field.name"
                class="col-12 col-md-6"
              >
                <label class="form-label">
                  {{ field.label || field.name }}
                  <span v-if="field.required" class="text-danger">*</span>
                </label>
                <input
                  v-if="isInputField(field)"
                  v-model="fkCreateForm[field.name]"
                  :type="inputType(field)"
                  class="form-control"
                  :placeholder="field.placeholder || ''"
                />
                <textarea
                  v-else-if="field.type === 'textarea'"
                  v-model="fkCreateForm[field.name]"
                  class="form-control"
                  rows="3"
                ></textarea>
                <select
                  v-else-if="field.type === 'select'"
                  v-model="fkCreateForm[field.name]"
                  class="form-select"
                >
                  <option value="">Seleccionar</option>
                  <option v-for="option in field.options || []" :key="option" :value="option">
                    {{ formatSelectOptionLabel(field, option) }}
                  </option>
                </select>
                <select
                  v-else-if="field.type === 'boolean'"
                  v-model="fkCreateForm[field.name]"
                  class="form-select"
                >
                  <option value="1">Si</option>
                  <option value="0">No</option>
                </select>
                <input
                  v-else
                  v-model="fkCreateForm[field.name]"
                  type="text"
                  class="form-control"
                  :placeholder="field.placeholder || ''"
                />
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button
              type="button"
              class="btn btn-outline-secondary"
              :disabled="fkCreateLoading"
              @click="cancelFkCreate"
            >
              Cancelar
            </button>
            <button
              type="button"
              class="btn btn-primary"
              :disabled="!canCreateFkReference || fkCreateLoading"
              @click="submitFkCreate"
            >
              {{ fkCreateLoading ? "Guardando..." : "Guardar y seleccionar" }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div
      class="modal fade"
      id="processSearchModal"
      tabindex="-1"
      aria-labelledby="processSearchModalLabel"
      aria-hidden="true"
      ref="processSearchModal"
    >
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="processSearchModalLabel">Buscar procesos</h5>
            <button type="button" class="btn-close" data-modal-dismiss aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <div class="row g-3">
              <div class="col-12">
                <label class="form-label text-dark">Proceso padre</label>
                <div class="input-group">
                  <input
                    v-model="processFilterLabels.parent_id"
                    type="text"
                    class="form-control"
                    placeholder="Selecciona un proceso padre"
                    readonly
                    @keydown.prevent
                    @paste.prevent
                  />
                  <button
                    class="btn btn-outline-secondary"
                    type="button"
                    title="Limpiar"
                    aria-label="Limpiar"
                    :disabled="!processFilters.parent_id"
                    @click="clearProcessParentFilter"
                  >
                    <font-awesome-icon icon="times" />
                  </button>
                  <button
                    class="btn btn-outline-secondary"
                    type="button"
                    title="Buscar"
                    aria-label="Buscar"
                    @click="openProcessFkSearch('parent_id')"
                  >
                    <font-awesome-icon icon="search" />
                  </button>
                </div>
              </div>
              <div class="col-12">
                <label class="form-label text-dark">Activo</label>
                <select v-model="processFilters.is_active" class="form-select">
                  <option value="">Todos</option>
                  <option value="1">Si</option>
                  <option value="0">No</option>
                </select>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" data-modal-dismiss>
              Cancelar
            </button>
            <button type="button" class="btn btn-outline-primary" @click="clearProcessFilter">
              Limpiar
            </button>
            <button type="button" class="btn btn-primary" title="Buscar" aria-label="Buscar" @click="applyProcessFilter">
              <font-awesome-icon icon="search" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <div
      class="modal fade"
      id="templateSearchModal"
      tabindex="-1"
      aria-labelledby="templateSearchModalLabel"
      aria-hidden="true"
      ref="templateSearchModal"
    >
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="templateSearchModalLabel">Buscar plantillas</h5>
            <button type="button" class="btn-close" data-modal-dismiss aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <div class="row g-3">
              <div class="col-12">
                <label class="form-label text-dark">Nombre</label>
                <input v-model="templateFilters.name" type="text" class="form-control" />
              </div>
              <div class="col-12">
                <label class="form-label text-dark">Slug</label>
                <input v-model="templateFilters.slug" type="text" class="form-control" />
              </div>
              <div class="col-12">
                <label class="form-label text-dark">Descripcion</label>
                <input v-model="templateFilters.description" type="text" class="form-control" />
              </div>
              <div class="col-12">
                <label class="form-label text-dark">Proceso</label>
                <div class="input-group">
                  <input
                    v-model="templateFilterLabels.process_id"
                    type="text"
                    class="form-control"
                    placeholder="Selecciona un proceso"
                    readonly
                    @keydown.prevent
                    @paste.prevent
                  />
                  <button
                    class="btn btn-outline-secondary"
                    type="button"
                    title="Limpiar"
                    aria-label="Limpiar"
                    :disabled="!templateFilters.process_id"
                    @click="clearTemplateProcessFilter"
                  >
                    <font-awesome-icon icon="times" />
                  </button>
                  <button
                    class="btn btn-outline-secondary"
                    type="button"
                    title="Buscar"
                    aria-label="Buscar"
                    @click="openTemplateFkSearch"
                  >
                    <font-awesome-icon icon="search" />
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" data-modal-dismiss>
              Cancelar
            </button>
            <button type="button" class="btn btn-outline-primary" @click="clearTemplateFilter">
              Limpiar
            </button>
            <button type="button" class="btn btn-primary" title="Buscar" aria-label="Buscar" @click="applyTemplateFilter">
              <font-awesome-icon icon="search" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <div
      class="modal fade"
      id="documentSearchModal"
      tabindex="-1"
      aria-labelledby="documentSearchModalLabel"
      aria-hidden="true"
      ref="documentSearchModal"
    >
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="documentSearchModalLabel">Buscar documentos</h5>
            <button type="button" class="btn-close" data-modal-dismiss aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <div class="row g-3">
              <div class="col-12">
                <label class="form-label text-dark">Tarea</label>
                <div class="input-group">
                  <input
                    v-model="documentFilterLabels.task_id"
                    type="text"
                    class="form-control"
                    placeholder="Selecciona una tarea"
                    readonly
                    @keydown.prevent
                    @paste.prevent
                  />
                  <button
                    class="btn btn-outline-secondary"
                    type="button"
                    title="Limpiar"
                    aria-label="Limpiar"
                    :disabled="!documentFilters.task_id"
                    @click="clearDocumentTaskFilter"
                  >
                    <font-awesome-icon icon="times" />
                  </button>
                  <button
                    class="btn btn-outline-secondary"
                    type="button"
                    title="Buscar"
                    aria-label="Buscar"
                    @click="openDocumentFkSearch('task_id')"
                  >
                    <font-awesome-icon icon="search" />
                  </button>
                </div>
              </div>
              <div class="col-12">
                <label class="form-label text-dark">Estado</label>
                <select v-model="documentFilters.status" class="form-select">
                  <option value="">Todos</option>
                  <option value="Inicial">Inicial</option>
                  <option value="En proceso">En proceso</option>
                  <option value="Aprobado">Aprobado</option>
                  <option value="Rechazado">Rechazado</option>
                </select>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" data-modal-dismiss>
              Cancelar
            </button>
            <button type="button" class="btn btn-outline-primary" @click="clearDocumentFilter">
              Limpiar
            </button>
            <button type="button" class="btn btn-primary" title="Buscar" aria-label="Buscar" @click="applyDocumentFilter">
              <font-awesome-icon icon="search" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <div
      class="modal fade"
      id="unitPositionSearchModal"
      tabindex="-1"
      aria-labelledby="unitPositionSearchModalLabel"
      aria-hidden="true"
      ref="unitPositionSearchModal"
    >
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="unitPositionSearchModalLabel">Buscar puestos</h5>
            <button type="button" class="btn-close" data-modal-dismiss aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <div class="row g-3">
              <div class="col-12">
                <label class="form-label text-dark">Tipo de unidad</label>
                <select
                  v-model="unitPositionFilters.unit_type_id"
                  class="form-select"
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
                </select>
              </div>
              <div class="col-12">
                <label class="form-label text-dark">Unidad</label>
                <select
                  v-model="unitPositionFilters.unit_id"
                  class="form-select"
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
                </select>
              </div>
              <div class="col-12">
                <label class="form-label text-dark">Cargo</label>
                <select
                  v-model="unitPositionFilters.cargo_id"
                  class="form-select"
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
                </select>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" data-modal-dismiss>
              Cancelar
            </button>
            <button type="button" class="btn btn-outline-primary" @click="clearUnitPositionFilter">
              Limpiar
            </button>
            <button type="button" class="btn btn-primary" title="Buscar" aria-label="Buscar" @click="applyUnitPositionFilter">
              <font-awesome-icon icon="search" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <div
      ref="draftArtifactModalRef"
      class="modal fade"
      tabindex="-1"
      aria-hidden="true"
    >
      <div class="modal-dialog modal-xl modal-dialog-scrollable">
        <div class="modal-content border-0 shadow">
          <div class="modal-header">
            <h5 class="modal-title">{{ draftArtifactEditId ? "Editar paquete de usuario" : "Crear paquete de usuario" }}</h5>
            <button type="button" class="btn-close" aria-label="Cerrar" @click="closeDraftArtifactModal"></button>
          </div>
          <div class="modal-body">
            <div v-if="draftArtifactError" class="alert alert-danger">{{ draftArtifactError }}</div>
            <div class="alert alert-info">
              Este flujo {{ draftArtifactEditId ? "actualiza" : "crea" }} el paquete de usuario y lo sube directamente a <strong>MinIO</strong>. Solo cuando la carga termine correctamente se guarda el registro en el sistema.
            </div>
            <div v-if="draftArtifactLoading" class="alert alert-warning">
              Subiendo archivos a <strong>MinIO</strong>. Espera a que termine la carga para continuar.
            </div>
            <div class="row g-3">
              <div class="col-12 col-md-6">
                <label class="form-label text-dark">Seed LaTeX</label>
                <select
                  v-model="draftArtifactForm.template_seed_id"
                  class="form-select"
                >
                  <option value="">Sin seed</option>
                  <option
                    v-for="row in draftArtifactSeedOptions"
                    :key="row.id"
                    :value="String(row.id)"
                  >
                    {{ row.display_name }}
                  </option>
                </select>
              </div>
              <div class="col-12 col-md-6">
                <label class="form-label text-dark">Version fuente</label>
                <input
                  v-model="draftArtifactForm.source_version"
                  type="text"
                  class="form-control"
                  placeholder="1.0.0"
                />
              </div>
              <div class="col-12 col-md-6">
                <label class="form-label text-dark">Nombre del artifact</label>
                <input
                  v-model="draftArtifactForm.display_name"
                  type="text"
                  class="form-control"
                  placeholder="Nombre del artifact"
                />
              </div>
              <div class="col-12 col-md-6">
                <label class="form-label text-dark">Descripcion</label>
                <input
                  v-model="draftArtifactForm.description"
                  type="text"
                  class="form-control"
                  placeholder="Descripcion breve"
                />
              </div>
              <div class="col-12 col-md-3">
                <label class="form-label text-dark">PDF</label>
                <label
                  class="draft-upload-dropzone"
                  for="draft-upload-pdf"
                  @dragover.prevent
                  @drop.prevent="handleDraftArtifactDrop('pdf', $event)"
                >
                  <span class="draft-upload-dropzone-title">Arrastra o haz clic</span>
                  <span class="draft-upload-dropzone-meta">{{ getDraftArtifactFileLabel("pdf") }}</span>
                </label>
                <input id="draft-upload-pdf" class="d-none" type="file" accept=".pdf" @change="handleDraftArtifactFileChange('pdf', $event)" />
              </div>
              <div class="col-12 col-md-3">
                <label class="form-label text-dark">Word</label>
                <label
                  class="draft-upload-dropzone"
                  for="draft-upload-docx"
                  @dragover.prevent
                  @drop.prevent="handleDraftArtifactDrop('docx', $event)"
                >
                  <span class="draft-upload-dropzone-title">Arrastra o haz clic</span>
                  <span class="draft-upload-dropzone-meta">{{ getDraftArtifactFileLabel("docx") }}</span>
                </label>
                <input id="draft-upload-docx" class="d-none" type="file" accept=".doc,.docx" @change="handleDraftArtifactFileChange('docx', $event)" />
              </div>
              <div class="col-12 col-md-3">
                <label class="form-label text-dark">Excel</label>
                <label
                  class="draft-upload-dropzone"
                  for="draft-upload-xlsx"
                  @dragover.prevent
                  @drop.prevent="handleDraftArtifactDrop('xlsx', $event)"
                >
                  <span class="draft-upload-dropzone-title">Arrastra o haz clic</span>
                  <span class="draft-upload-dropzone-meta">{{ getDraftArtifactFileLabel("xlsx") }}</span>
                </label>
                <input id="draft-upload-xlsx" class="d-none" type="file" accept=".xls,.xlsx" @change="handleDraftArtifactFileChange('xlsx', $event)" />
              </div>
              <div class="col-12 col-md-3">
                <label class="form-label text-dark">PowerPoint</label>
                <label
                  class="draft-upload-dropzone"
                  for="draft-upload-pptx"
                  @dragover.prevent
                  @drop.prevent="handleDraftArtifactDrop('pptx', $event)"
                >
                  <span class="draft-upload-dropzone-title">Arrastra o haz clic</span>
                  <span class="draft-upload-dropzone-meta">{{ getDraftArtifactFileLabel("pptx") }}</span>
                </label>
                <input id="draft-upload-pptx" class="d-none" type="file" accept=".ppt,.pptx" @change="handleDraftArtifactFileChange('pptx', $event)" />
              </div>
              <div v-if="draftArtifactPreviewUrl" class="col-12">
                <label class="form-label text-dark">Preview del seed</label>
                <iframe
                  :src="draftArtifactPreviewUrl"
                  class="w-100 border rounded"
                  style="min-height: 420px; background: #fff;"
                  title="Preview del seed"
                ></iframe>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button
              type="button"
              class="btn btn-outline-secondary"
              @click="closeDraftArtifactModal"
            >
              Cancelar
            </button>
            <button
              type="button"
              class="btn btn-outline-primary"
              :disabled="draftArtifactLoading"
              @click="submitDraftArtifact"
            >
              {{ draftArtifactLoading ? "Subiendo a MinIO..." : (draftArtifactEditId ? "Guardar cambios" : "Crear artifact") }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, defineEmits, defineProps, defineExpose, onBeforeUnmount, ref, watch } from "vue";
import axios from "axios";
import { Modal } from "@/utils/modalController";
import { API_ROUTES } from "@/services/apiConfig";
import BtnDelete from "@/components/BtnDelete.vue";
import BtnEdit from "@/components/BtnEdit.vue";

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
let editorInstance = null;
let processDefinitionVersioningInstance = null;
let processDefinitionActivationInstance = null;
let definitionRulesInstance = null;
let definitionTriggersInstance = null;
let definitionArtifactsInstance = null;
let definitionArtifactsPromptInstance = null;
let draftArtifactInstance = null;
let deleteInstance = null;
let recordViewerInstance = null;
let personAssignmentsInstance = null;
let fkInstance = null;
let fkViewerInstance = null;
let fkFilterInstance = null;
let fkCreateInstance = null;
const modalOriginStack = ref([]);
let searchTimeout = null;
let vacantSearchTimeout = null;
let unassignedTemplateArtifactSearchTimeout = null;
let feedbackToastTimeout = null;
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
let templateSearchInstance = null;
const documentSearchModal = ref(null);
let documentSearchInstance = null;
const processSearchModal = ref(null);
let processSearchInstance = null;
const unitPositionSearchModal = ref(null);
let unitPositionSearchInstance = null;
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
const personAssignmentSections = [
  { key: "ocupaciones", label: "Ocupación", icon: "id-card" },
  { key: "roles", label: "Rol", icon: "lock" },
  { key: "contratos", label: "Contrato", icon: "certificate" }
];
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
const PROCESS_INLINE_HIDDEN_FIELDS = new Set([
  "version",
  "version_name",
  "version_slug",
  "version_effective_to",
  "version_parent_version_id"
]);
const PROCESS_DEFINITION_HIDDEN_FIELDS = new Set([
  "variation_key"
]);
const visibleFormFields = computed(() => {
  if (!isProcessTable.value) {
    if (props.table?.table === "process_definition_versions") {
      return formFields.value.filter((field) => !PROCESS_DEFINITION_HIDDEN_FIELDS.has(field.name));
    }
    return formFields.value;
  }
  return formFields.value.filter((field) => !PROCESS_INLINE_HIDDEN_FIELDS.has(field.name));
});

const formatTemplateArtifactFieldLabel = (field) => {
  if (!field) {
    return field;
  }
  if (field.name !== "available_formats") {
    return field;
  }
  return {
    ...field,
    label: "Formatos"
  };
};

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
const inlineFkCloseTimers = {};
const inlineFkQueryTimers = {};

const getViewerFieldsForTable = (tableMeta, { includeVirtual = true } = {}) => {
  if (!tableMeta?.fields) {
    return [];
  }
  const fields = tableMeta.fields.filter((field) => {
    if (field.name === "password_hash") {
      return false;
    }
    if (!includeVirtual && field.virtual) {
      return false;
    }
    return true;
  });
  if (tableMeta.table === "process_target_rules") {
    const expandedFields = [];
    fields.forEach((field) => {
      expandedFields.push(field);
      if (field.name === "process_definition_id") {
        expandedFields.push({
          name: "__process_name",
          label: "Proceso",
          type: "text"
        });
      }
    });
    return expandedFields;
  }
  if (tableMeta.table === "template_artifacts") {
    return fields.map((field) => formatTemplateArtifactFieldLabel(field));
  }
  if (tableMeta.table === "process_definition_versions") {
    return fields.filter((field) => !PROCESS_DEFINITION_HIDDEN_FIELDS.has(field.name));
  }
  if (tableMeta.table === "process_definition_templates" && includeVirtual) {
    const expandedFields = [];
    fields.forEach((field) => {
      expandedFields.push(field);
      if (field.name === "process_definition_id") {
        expandedFields.push(
          { name: "__definition_series", label: "Serie", type: "text" },
          { name: "__definition_version", label: "Version", type: "text" },
          { name: "__definition_status", label: "Estado de definicion", type: "text" }
        );
      }
    });
    return expandedFields;
  }
  return fields;
};

const rowKeyForTable = (tableMeta, row) => {
  if (!tableMeta) {
    return JSON.stringify(row);
  }
  const primaryKeys = tableMeta.primaryKeys?.length ? tableMeta.primaryKeys : ["id"];
  return primaryKeys.map((key) => row?.[key]).join("-");
};

const rowKey = (row) => rowKeyForTable(props.table, row);

const buildPersonAssignmentContext = (row) => {
  const firstName = row?.first_name ? String(row.first_name).trim() : "";
  const lastName = row?.last_name ? String(row.last_name).trim() : "";
  const fullName = `${firstName} ${lastName}`.trim();
  return {
    id: row?.id ? String(row.id) : "",
    name: fullName || `Persona #${row?.id ?? ""}`,
    cedula: row?.cedula ? String(row.cedula) : "",
    email: row?.email ? String(row.email) : ""
  };
};

const pad2 = (value) => String(value).padStart(2, "0");

const formatDateOnly = (value) => {
  if (!value) {
    return "—";
  }
  if (typeof value === "string") {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) {
      return match[1];
    }
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
};

const formatDateTimeHour = (value) => {
  if (!value) {
    return "—";
  }
  if (typeof value === "string") {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2})/);
    if (match) {
      return `${match[1]} ${match[2]}`;
    }
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}`;
};

const formatPositionType = (value) => {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  const labels = {
    real: "Real",
    promocion: "Promocion",
    simbolico: "Simbolico"
  };
  return labels[value] || value;
};

const formatSelectOptionLabel = (field, value) => {
  if (field?.name === "scope") {
    const labels = {
      owner: "Propietario",
      collaborator: "Operativo"
    };
    return labels[value] || value;
  }
  return value;
};

const prettifyFormatName = (value) => {
  if (value === null || value === undefined || value === "") {
    return "";
  }
  return String(value).replaceAll("_", " ");
};

const getFileNameFromObjectKey = (value) => {
  if (value === null || value === undefined || value === "") {
    return "";
  }
  const normalized = String(value).replace(/\\/g, "/").replace(/\/+$/g, "");
  const pieces = normalized.split("/").filter(Boolean);
  const fileName = pieces.length ? pieces[pieces.length - 1] : "";
  if (fileName.toLowerCase() === "src") {
    return "Contenido actual";
  }
  return fileName;
};

const normalizeAvailableFormats = (value) => {
  if (!value) {
    return null;
  }
  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }
  return parsed;
};

const getAvailableFormatSections = (value) => {
  const parsed = normalizeAvailableFormats(value);
  if (!parsed) {
    return [];
  }
  const modeLabels = {
    system: "Sistema",
    user: "Usuario"
  };
  return Object.entries(parsed)
    .map(([mode, formats]) => {
      if (!formats || typeof formats !== "object" || Array.isArray(formats)) {
        return null;
      }
      const entries = Object.entries(formats)
        .map(([format, meta]) => {
          const entryObjectKey =
            meta && typeof meta === "object" && !Array.isArray(meta)
              ? meta.entry_object_key || meta.entryObjectKey || ""
              : "";
          return {
            format,
            formatLabel: prettifyFormatName(format),
            entryObjectKey
          };
        })
        .filter((entry) => entry.format);
      if (!entries.length) {
        return null;
      }
      return {
        mode,
        label: modeLabels[mode] || mode,
        entries
      };
    })
    .filter(Boolean);
};

const expandHexColor = (hex) => {
  if (!hex) {
    return "";
  }
  const normalized = hex.replace("#", "");
  if (normalized.length === 3) {
    return normalized
      .split("")
      .map((char) => `${char}${char}`)
      .join("");
  }
  return normalized;
};

const toRgbaFromHex = (hex, alpha) => {
  const expanded = expandHexColor(hex);
  if (!expanded || expanded.length !== 6) {
    return "";
  }
  const red = Number.parseInt(expanded.slice(0, 2), 16);
  const green = Number.parseInt(expanded.slice(2, 4), 16);
  const blue = Number.parseInt(expanded.slice(4, 6), 16);
  if ([red, green, blue].some((value) => Number.isNaN(value))) {
    return "";
  }
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

const getDefaultAvailableFormatColor = (mode, format) => {
  const palette = {
    "system:jinja2": "#18b7a3",
    "user:latex": "#8b5cf6",
    "user:docx": "#2563eb",
    "user:pdf": "#ef4444",
    "user:xlsx": "#16a34a"
  };
  return palette[`${mode}:${format}`] || "#8a94a6";
};

const getAvailableFormatBadgeStyle = (mode, entry) => {
  const color = getDefaultAvailableFormatColor(mode, entry?.format);
  const backgroundColor = toRgbaFromHex(color, 0.2);
  const borderColor = toRgbaFromHex(color, 0.44);
  return {
    color,
    backgroundColor: backgroundColor || undefined,
    borderColor: borderColor || undefined
  };
};

const formatAvailableFormatsSummary = (value) => {
  const parts = getAvailableFormatSections(value).map(
    (section) => `${section.label}: ${section.entries.map((entry) => entry.formatLabel).join(", ")}`
  );
  return parts.length ? parts.join(" | ") : "—";
};

const formatValueForTable = (tableMeta, value, field, row = null) => {
  if (value === null || value === undefined || value === "") {
    if (!["__plaza", "__position_type", "__process_name", "__definition_series", "__definition_version", "__definition_status"].includes(field?.name)) {
      return "—";
    }
  }
  const fieldName = field?.name || "";
  if (["__plaza", "__position_type"].includes(fieldName)) {
    const positionId = row?.position_id;
    if (positionId === null || positionId === undefined || positionId === "") {
      return "—";
    }
    const positionMeta = positionMetaById.value[String(positionId)];
    if (!positionMeta) {
      return "—";
    }
    if (fieldName === "__position_type") {
      return formatPositionType(positionMeta.position_type);
    }
    const slotNo = positionMeta.slot_no;
    return slotNo === null || slotNo === undefined || slotNo === "" ? "—" : slotNo;
  }
  if (fieldName === "__process_name") {
    const definitionId = row?.process_definition_id;
    if (definitionId === null || definitionId === undefined || definitionId === "") {
      return "—";
    }
    const processId = processIdByDefinitionId.value[String(definitionId)];
    if (processId === null || processId === undefined || processId === "") {
      return "—";
    }
    const label = getFkCachedLabel("processes", processId);
    return label ?? processId;
  }
  if (["__definition_series", "__definition_version", "__definition_status"].includes(fieldName)) {
    const definitionId = row?.process_definition_id;
    if (definitionId === null || definitionId === undefined || definitionId === "") {
      return "—";
    }
    const definitionMeta = processDefinitionMetaById.value[String(definitionId)];
    if (!definitionMeta) {
      return "—";
    }
    if (fieldName === "__definition_series") {
      return definitionMeta.variation_key || "—";
    }
    if (fieldName === "__definition_version") {
      return definitionMeta.definition_version || "—";
    }
    return definitionMeta.status || "—";
  }
  if (["created_at", "updated_at", "created", "updated"].includes(fieldName)) {
    return formatDateTimeHour(value);
  }
  if (tableMeta?.table === "process_definition_versions" && fieldName === "series_id") {
    const seriesLabel = getFkCachedLabel("process_definition_series", value);
    if (seriesLabel !== null && seriesLabel !== undefined && seriesLabel !== "") {
      return seriesLabel;
    }
    return row?.variation_key || value || "—";
  }
  if (tableMeta?.table === "process_target_rules") {
    if (["effective_from", "effective_to"].includes(fieldName)) {
      return formatDateOnly(value);
    }
  }
  if (tableMeta?.table === "position_assignments") {
    if (["start_date", "end_date"].includes(field?.name)) {
      return formatDateOnly(value);
    }
  }
  if (fieldName === "scope") {
    return formatSelectOptionLabel(field, value);
  }
  if (fieldName === "available_formats") {
    return formatAvailableFormatsSummary(value);
  }
  if (field.type === "boolean") {
    return Number(value) === 1 ? "Si" : "No";
  }
  if (isForeignKeyField(field)) {
    const tableName = resolveFkTable(field.name);
    if (!tableName) {
      return value;
    }
    const cache = fkLabelCache.value[tableName];
    const label = cache?.[value];
    return label ?? value;
  }
  return value;
};

const formatCell = (value, field, row = null) =>
  formatValueForTable(props.table, value, field, row);

const formatDefinitionRuleCell = (row, fieldName) =>
  formatValueForTable(
    allTablesMap.value.process_target_rules || { table: "process_target_rules", fields: [] },
    row?.[fieldName],
    { name: fieldName },
    row
  );

const toDateInputValue = (value) => {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString().slice(0, 10);
};

const toDateTimeInputValue = (value) => {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString().slice(0, 16);
};

const normalizeComparableFormValue = (fieldName, value, tableMeta = props.table) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const fieldMeta = tableMeta?.fields?.find((field) => field.name === fieldName) || null;
  if (fieldMeta?.type === "date") {
    return formatDateOnly(value);
  }
  if (fieldMeta?.type === "datetime") {
    return toDateTimeInputValue(value);
  }
  if (fieldMeta?.type === "number" || fieldMeta?.type === "boolean") {
    const numeric = Number(value);
    return Number.isNaN(numeric) ? String(value) : String(numeric);
  }
  return String(value).trim();
};

const getChangedPayloadKeys = (baseRow, payload, tableMeta = props.table) => {
  if (!payload || typeof payload !== "object") {
    return [];
  }
  return Object.keys(payload).filter((key) => (
    normalizeComparableFormValue(key, payload[key], tableMeta)
    !== normalizeComparableFormValue(key, baseRow?.[key], tableMeta)
  ));
};

const getNextSemanticVersion = (value) => {
  const source = String(value || "").trim();
  const match = source.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    return "0.1.0";
  }
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]) + 1;
  return `${major}.${minor}.${patch}`;
};

const pushModalOrigin = (origin) => {
  if (!origin) {
    return;
  }
  modalOriginStack.value.push(origin);
};

const peekModalOrigin = () => (
  modalOriginStack.value.length ? modalOriginStack.value[modalOriginStack.value.length - 1] : null
);

const clearModalOrigins = () => {
  modalOriginStack.value = [];
};

const ensureEditorInstance = () => {
  if (!editorInstance && editorModal.value) {
    editorInstance = new Modal(editorModal.value);
  }
};

const ensureProcessDefinitionVersioningInstance = () => {
  if (!processDefinitionVersioningInstance && processDefinitionVersioningModal.value) {
    processDefinitionVersioningInstance = new Modal(processDefinitionVersioningModal.value);
    processDefinitionVersioningModal.value.addEventListener("hidden.bs.modal", () => {
      processDefinitionVersioningSource.value = null;
    });
  }
};

const ensureProcessDefinitionActivationInstance = () => {
  if (!processDefinitionActivationInstance && processDefinitionActivationModal.value) {
    processDefinitionActivationInstance = new Modal(processDefinitionActivationModal.value);
    processDefinitionActivationModal.value.addEventListener("hidden.bs.modal", () => {
      if (peekModalOrigin() === "definitionActivation") {
        return;
      }
      processDefinitionActivationConfirmed.value = false;
      processDefinitionActivationFromEditor.value = false;
      processDefinitionActivationChecking.value = false;
      processDefinitionActivationHasActiveRules.value = true;
      processDefinitionActivationHasActiveTriggers.value = true;
      processDefinitionActivationHasRequiredArtifacts.value = true;
      processDefinitionActivationRequiresArtifacts.value = false;
      processDefinitionActivationView.value = "definition";
      processDefinitionActivationRules.value = [];
      processDefinitionActivationTriggers.value = [];
      processDefinitionActivationArtifacts.value = [];
    });
  }
};

const ensureDefinitionRulesInstance = () => {
  if (!definitionRulesInstance && definitionRulesModal.value) {
    definitionRulesInstance = new Modal(definitionRulesModal.value);
    definitionRulesModal.value.addEventListener("hidden.bs.modal", () => {
      if (peekModalOrigin() === "definitionRules") {
        return;
      }
      definitionRulesError.value = "";
      definitionRulesContext.value = null;
      definitionRulesRows.value = [];
      resetDefinitionRulesForm();
      restoreReturnModal();
    });
  }
};

const ensureDefinitionTriggersInstance = () => {
  if (!definitionTriggersInstance && definitionTriggersModal.value) {
    definitionTriggersInstance = new Modal(definitionTriggersModal.value);
    definitionTriggersModal.value.addEventListener("hidden.bs.modal", () => {
      if (peekModalOrigin() === "definitionTriggers") {
        return;
      }
      definitionTriggersError.value = "";
      definitionTriggersContext.value = null;
      definitionTriggersRows.value = [];
      resetDefinitionTriggersForm();
      restoreReturnModal();
    });
  }
};

const ensureDeleteInstance = () => {
  if (!deleteInstance && deleteModal.value) {
    deleteInstance = new Modal(deleteModal.value);
  }
};

const ensureRecordViewerInstance = () => {
  if (!recordViewerInstance && recordViewerModal.value) {
    recordViewerInstance = new Modal(recordViewerModal.value);
    recordViewerModal.value.addEventListener("hidden.bs.modal", () => {
      restoreReturnModal();
    });
  }
};

const ensurePersonAssignmentsInstance = () => {
  if (!personAssignmentsInstance && personAssignmentsModal.value) {
    personAssignmentsInstance = new Modal(personAssignmentsModal.value);
  }
};

const ensureDefinitionArtifactsInstance = () => {
  if (!definitionArtifactsInstance && definitionArtifactsModal.value) {
    definitionArtifactsInstance = new Modal(definitionArtifactsModal.value);
    definitionArtifactsModal.value.addEventListener("hidden.bs.modal", () => {
      if (peekModalOrigin() === "definitionArtifacts") {
        return;
      }
      definitionArtifactsError.value = "";
      definitionArtifactsEditId.value = "";
      definitionArtifactsContext.value = null;
      definitionArtifactsRows.value = [];
      resetDefinitionArtifactsForm();
      restoreReturnModal();
    });
  }
};

const ensureDefinitionArtifactsPromptInstance = () => {
  if (!definitionArtifactsPromptInstance && definitionArtifactsPromptModal.value) {
    definitionArtifactsPromptInstance = new Modal(definitionArtifactsPromptModal.value);
    definitionArtifactsPromptModal.value.addEventListener("hidden.bs.modal", () => {
      definitionArtifactsPromptContext.value = null;
    });
  }
};

const ensureDraftArtifactInstance = () => {
  if (!draftArtifactInstance && draftArtifactModalRef.value) {
    draftArtifactInstance = new Modal(draftArtifactModalRef.value);
    draftArtifactModalRef.value.addEventListener("hidden.bs.modal", () => {
      draftArtifactError.value = "";
      draftArtifactLoading.value = false;
      draftArtifactEditId.value = "";
      draftArtifactExistingFiles.value = {
        pdf: "",
        docx: "",
        xlsx: "",
        pptx: ""
      };
      draftArtifactForm.value = {
        template_seed_id: "",
        display_name: "",
        description: "",
        source_version: "1.0.0"
      };
      draftArtifactFiles.value = {
        pdf: null,
        docx: null,
        xlsx: null,
        pptx: null
      };
    });
  }
};

const restoreReturnModal = () => {
  const returnModal = modalOriginStack.value.length ? modalOriginStack.value.pop() : null;
  if (returnModal === "editor" && editorInstance) {
    if (props.table?.table === "process_definition_versions" && selectedRow.value?.id) {
      refreshProcessDefinitionChecklist(selectedRow.value);
    }
    editorInstance.show();
  }
  if (returnModal === "processSearch" && processSearchInstance) {
    processSearchInstance.show();
  }
  if (returnModal === "templateSearch" && templateSearchInstance) {
    templateSearchInstance.show();
  }
  if (returnModal === "documentSearch" && documentSearchInstance) {
    documentSearchInstance.show();
  }
  if (returnModal === "personAssignments" && personAssignmentsInstance) {
    personAssignmentsInstance.show();
  }
  if (returnModal === "definitionRules" && definitionRulesInstance) {
    definitionRulesInstance.show();
  }
  if (returnModal === "definitionActivation" && processDefinitionActivationInstance) {
    if (selectedRow.value?.id) {
      openProcessDefinitionActivationModal();
      return;
    }
    processDefinitionActivationInstance.show();
  }
  if (returnModal === "definitionTriggers" && definitionTriggersInstance) {
    definitionTriggersInstance.show();
  }
  if (returnModal === "definitionArtifacts" && definitionArtifactsInstance) {
    definitionArtifactsInstance.show();
  }
};

const ensureFkInstance = () => {
  if (!fkInstance && fkModal.value) {
    fkInstance = new Modal(fkModal.value);
    fkModal.value.addEventListener("hidden.bs.modal", () => {
      if (skipFkReturnRestore.value) {
        skipFkReturnRestore.value = false;
        return;
      }
      restoreReturnModal();
    });
  }
};

const ensureFkCreateInstance = () => {
  if (!fkCreateInstance && fkCreateModal.value) {
    fkCreateInstance = new Modal(fkCreateModal.value);
    fkCreateModal.value.addEventListener("hidden.bs.modal", () => {
      if (fkCreateExitTarget.value === "search") {
        ensureFkInstance();
        fkInstance?.show();
      }
      if (fkCreateExitTarget.value === "parent") {
        restoreReturnModal();
      }
      fkCreateExitTarget.value = "none";
    });
  }
};

const ensureFkViewerInstance = () => {
  if (!fkViewerInstance && fkViewerModal.value) {
    fkViewerInstance = new Modal(fkViewerModal.value);
    fkViewerModal.value.addEventListener("hidden.bs.modal", () => {
      if (fkNestedExitTarget.value === "search") {
        ensureFkInstance();
        fkInstance?.show();
      }
      fkNestedExitTarget.value = "none";
    });
  }
};

const ensureFkFilterInstance = () => {
  if (!fkFilterInstance && fkFilterModal.value) {
    fkFilterInstance = new Modal(fkFilterModal.value);
    fkFilterModal.value.addEventListener("hidden.bs.modal", () => {
      if (fkNestedExitTarget.value === "search") {
        ensureFkInstance();
        fkInstance?.show();
      }
      fkNestedExitTarget.value = "none";
    });
  }
};

const ensureProcessSearchInstance = () => {
  if (!processSearchInstance && processSearchModal.value) {
    processSearchInstance = new Modal(processSearchModal.value);
  }
};

const ensureDocumentSearchInstance = () => {
  if (!documentSearchInstance && documentSearchModal.value) {
    documentSearchInstance = new Modal(documentSearchModal.value);
  }
};

const ensureUnitPositionSearchInstance = () => {
  if (!unitPositionSearchInstance && unitPositionSearchModal.value) {
    unitPositionSearchInstance = new Modal(unitPositionSearchModal.value);
  }
};

const loadUnitPositionUnitTypeOptions = async () => {
  unitPositionFilterLoading.value = true;
  try {
    const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE("unit_types"), {
      params: { limit: 500 }
    });
    unitPositionUnitTypeOptions.value = response.data || [];
  } catch (error) {
    unitPositionUnitTypeOptions.value = [];
  } finally {
    unitPositionFilterLoading.value = false;
  }
};

const loadUnitPositionCargoOptions = async () => {
  unitPositionFilterLoading.value = true;
  try {
    const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE("cargos"), {
      params: { limit: 500 }
    });
    unitPositionCargoOptions.value = response.data || [];
  } catch (error) {
    unitPositionCargoOptions.value = [];
  } finally {
    unitPositionFilterLoading.value = false;
  }
};

const loadUnitPositionUnitOptions = async () => {
  if (!unitPositionFilters.value.unit_type_id) {
    unitPositionUnitOptions.value = [];
    return;
  }
  unitPositionFilterLoading.value = true;
  try {
    const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE("units"), {
      params: {
        filter_unit_type_id: unitPositionFilters.value.unit_type_id,
        limit: 500
      }
    });
    unitPositionUnitOptions.value = response.data || [];
    const selectedUnitId = unitPositionFilters.value.unit_id;
    if (
      selectedUnitId
      && !unitPositionUnitOptions.value.some((row) => String(row?.id) === String(selectedUnitId))
    ) {
      unitPositionFilters.value = {
        ...unitPositionFilters.value,
        unit_id: ""
      };
    }
  } catch (error) {
    unitPositionUnitOptions.value = [];
  } finally {
    unitPositionFilterLoading.value = false;
  }
};

const loadVacantPositionUnitTypeOptions = async () => {
  vacantPositionFilterLoading.value = true;
  try {
    const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE("unit_types"), {
      params: { limit: 500 }
    });
    vacantPositionUnitTypeOptions.value = response.data || [];
  } catch (error) {
    vacantPositionUnitTypeOptions.value = [];
  } finally {
    vacantPositionFilterLoading.value = false;
  }
};

const loadVacantPositionCargoOptions = async () => {
  vacantPositionFilterLoading.value = true;
  try {
    const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE("cargos"), {
      params: { limit: 500 }
    });
    vacantPositionCargoOptions.value = response.data || [];
  } catch (error) {
    vacantPositionCargoOptions.value = [];
  } finally {
    vacantPositionFilterLoading.value = false;
  }
};

const loadProcessDefinitionProcessOptions = async () => {
  try {
    const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE("processes"), {
      params: {
        orderBy: "name",
        order: "asc",
        limit: 500
      }
    });
    processDefinitionProcessOptions.value = response.data || [];
  } catch (error) {
    processDefinitionProcessOptions.value = [];
  }
};

const loadProcessDefinitionSeriesOptions = async () => {
  try {
    const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE("process_definition_series"), {
      params: {
        filter_is_active: 1,
        orderBy: "code",
        order: "asc",
        limit: 500
      }
    });
    processDefinitionSeriesOptions.value = (response.data || []).filter(
      (row) => String(row?.source_type || "") !== "legacy"
    );
  } catch (error) {
    processDefinitionSeriesOptions.value = [];
  }
};

const loadVacantPositionUnitOptions = async () => {
  if (!vacantPositionFilters.value.unit_type_id) {
    vacantPositionUnitOptions.value = [];
    return;
  }
  vacantPositionFilterLoading.value = true;
  try {
    const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE("units"), {
      params: {
        filter_unit_type_id: vacantPositionFilters.value.unit_type_id,
        limit: 500
      }
    });
    vacantPositionUnitOptions.value = response.data || [];
    const selectedUnitId = vacantPositionFilters.value.unit_id;
    if (
      selectedUnitId
      && !vacantPositionUnitOptions.value.some((row) => String(row?.id) === String(selectedUnitId))
    ) {
      vacantPositionFilters.value = {
        ...vacantPositionFilters.value,
        unit_id: ""
      };
    }
  } catch (error) {
    vacantPositionUnitOptions.value = [];
  } finally {
    vacantPositionFilterLoading.value = false;
  }
};

const resetForm = () => {
  resetInlineFkState();
  const payload = {};
  formFields.value.forEach((field) => {
    if (field.type === "boolean") {
      payload[field.name] = String(field.defaultValue ?? 1);
      return;
    }
    if (field.type === "date") {
      payload[field.name] = "";
      return;
    }
    if (field.type === "datetime") {
      payload[field.name] = "";
      return;
    }
    payload[field.name] = field.defaultValue ?? "";
  });
  formData.value = payload;
};

const resetFkCreateForm = () => {
  const payload = {};
  fkCreateFields.value.forEach((field) => {
    if (field.type === "boolean") {
      payload[field.name] = String(field.defaultValue ?? 1);
      return;
    }
    if (field.type === "date" || field.type === "datetime") {
      payload[field.name] = "";
      return;
    }
    payload[field.name] = field.defaultValue ?? "";
  });
  fkCreateForm.value = payload;
};

const resetFkFilters = () => {
  const payload = {};
  fkFilterFields.value.forEach((field) => {
    payload[field.name] = "";
  });
  if (fkTable.value?.table === "process_definition_versions") {
    payload.process_id = "";
    payload.variation_key = "";
    payload.status = "active";
    payload.execution_mode = "";
  }
  if (fkTable.value?.table === "template_artifacts") {
    payload.template_code = "";
    payload.storage_version = "";
    payload.is_active = "";
  }
  fkFilters.value = payload;
};

const buildFormFromRow = (row) => {
  const payload = {};
  const displayPayload = {};
  formFields.value.forEach((field) => {
    let value = row?.[field.name] ?? "";
    if (field.type === "boolean") {
      value = String(Number(value) === 1 ? 1 : 0);
    }
    if (field.type === "date") {
      value = toDateInputValue(value);
    }
    if (field.type === "datetime") {
      value = toDateTimeInputValue(value);
    }
    payload[field.name] = value;
    if (isForeignKeyField(field)) {
      displayPayload[field.name] = value ? String(value) : "";
    }
  });
  formData.value = payload;
  fkDisplay.value = displayPayload;
};

const isFieldLocked = (field) => {
  if (field.readOnly) {
    return true;
  }
  if (props.table?.table === "process_definition_series") {
    const sourceType = String(formData.value?.source_type || "").trim();
    if (field.name === "unit_type_id") {
      return sourceType !== "unit_type";
    }
    if (field.name === "cargo_id") {
      return sourceType !== "cargo";
    }
  }
  if (
    props.table?.table === "process_definition_versions"
    && editorMode.value === "create"
    && field.name === "status"
  ) {
    return true;
  }
  if (
    props.table?.table === "process_definition_versions"
    && editorMode.value === "edit"
    && ["process_id", "variation_key", "definition_version"].includes(field.name)
  ) {
    return true;
  }
  if (
    editorMode.value === "edit" &&
    props.table?.primaryKeys?.includes(field.name) &&
    !props.table?.allowPrimaryKeyUpdate
  ) {
    return true;
  }
  return false;
};

const handleSelectChange = (field) => {
  if (props.table?.table !== "process_definition_series" || field?.name !== "source_type") {
    return;
  }
  const sourceType = String(formData.value?.source_type || "").trim();
  if (sourceType === "unit_type") {
    formData.value = {
      ...formData.value,
      cargo_id: ""
    };
    fkDisplay.value = {
      ...fkDisplay.value,
      cargo_id: ""
    };
    return;
  }
  if (sourceType === "cargo") {
    formData.value = {
      ...formData.value,
      unit_type_id: ""
    };
    fkDisplay.value = {
      ...fkDisplay.value,
      unit_type_id: ""
    };
    return;
  }
  formData.value = {
    ...formData.value,
    unit_type_id: "",
    cargo_id: ""
  };
  fkDisplay.value = {
    ...fkDisplay.value,
    unit_type_id: "",
    cargo_id: ""
  };
};

const isInputField = (field) => {
  return ["text", "email", "number", "date", "datetime", "password"].includes(field.type);
};

const inputType = (field) => {
  if (field.type === "datetime") {
    return "datetime-local";
  }
  return field.type || "text";
};

const buildPayload = () => {
  const payload = {};
  editableFields.value.forEach((field) => {
    if (
      props.table?.table === "process_definition_versions"
      && editorMode.value === "create"
      && field.name === "status"
    ) {
      payload.status = "draft";
      return;
    }
    if (
      props.table?.table === "process_definition_versions"
      && editorMode.value === "edit"
      && ["process_id", "variation_key", "definition_version"].includes(field.name)
    ) {
      return;
    }
    let value = formData.value[field.name];
    if (value === "") {
      value = null;
    }
    if (field.type === "number") {
      value = value === null ? null : Number(value);
      if (Number.isNaN(value)) {
        value = null;
      }
    }
    if (field.type === "boolean") {
      value = Number(value) === 1 ? 1 : 0;
    }
    payload[field.name] = value;
  });
  if (
    props.table?.table === "process_definition_versions"
    && editorMode.value === "create"
    && processDefinitionCloneSourceId.value
  ) {
    payload.source_process_definition_id = Number(processDefinitionCloneSourceId.value);
  }
  if (isPersonTable.value && editorMode.value === "create") {
    const password = formData.value.password;
    if (typeof password === "string" && password !== "") {
      payload.password = password;
    }
  }
  return payload;
};

const FK_TABLE_MAP = {
  parent_id: "processes",
  parent_task_id: "tasks",
  process_id: "processes",
  series_id: "process_definition_series",
  process_definition_id: "process_definition_versions",
  process_definition_template_id: "process_definition_templates",
  template_seed_id: "template_seeds",
  term_type_id: "term_types",
  term_id: "terms",
  task_id: "tasks",
  unit_type_id: "unit_types",
  unit_id: "units",
  parent_unit_id: "units",
  child_unit_id: "units",
  relation_type_id: "relation_unit_types",
  template_id: "signature_flow_templates",
  template_artifact_id: "template_artifacts",
  task_item_id: "task_items",
  document_id: "documents",
  document_version_id: "document_versions",
  person_id: "persons",
  responsible_position_id: "unit_positions",
  role_id: "roles",
  permission_id: "permissions",
  resource_id: "resources",
  action_id: "actions",
  cargo_id: "cargos",
  required_cargo_id: "cargos",
  signer_user_id: "persons",
  position_id: "unit_positions",
  assigned_person_id: "persons",
  vacancy_id: "vacancies",
  role_assignment_id: "role_assignments",
  signature_request_id: "signature_requests",
  signature_type_id: "signature_types",
  signature_status_id: "signature_statuses",
  step_id: "signature_flow_steps",
  step_type_id: "signature_types",
  instance_id: "signature_flow_instances",
  status_id: "signature_request_statuses"
};

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

const formatFkOptionLabel = (tableName, row) => {
  if (!row) {
    return "—";
  }
  if (tableName === "process_definition_versions") {
    const parts = [
      row.variation_key,
      row.definition_version,
      row.name
    ].filter((part) => part !== null && part !== undefined && String(part).trim() !== "");
    if (parts.length) {
      return parts.join(" · ");
    }
  }
  if (tableName === "process_definition_templates") {
    const parts = [
      row.process_definition_id ? `Def ${row.process_definition_id}` : null,
      row.template_artifact_id
        ? (getFkCachedLabel("template_artifacts", row.template_artifact_id) || `Paquete ${row.template_artifact_id}`)
        : null,
      row.usage_role
    ].filter((part) => part !== null && part !== undefined && String(part).trim() !== "");
    if (parts.length) {
      return parts.join(" · ");
    }
  }
  if (tableName === "template_artifacts") {
    const value = row.display_name ?? row.template_code ?? row.id;
    return value !== null && value !== undefined && value !== "" ? String(value) : "—";
  }
  if (tableName === "template_seeds") {
    const value = row.display_name ?? row.seed_code ?? row.id;
    return value !== null && value !== undefined && value !== "" ? String(value) : "—";
  }
  const displayField = resolveDisplayField(allTablesMap.value?.[tableName]);
  const value = row[displayField] ?? row.name ?? row.title ?? row.code ?? row.id;
  return value !== null && value !== undefined && value !== "" ? String(value) : "—";
};

const getFkTableField = (fieldName) => {
  if (!fkTable.value?.fields || !fieldName) {
    return null;
  }
  return fkTable.value.fields.find((field) => field.name === fieldName) || null;
};

const getFkTableFieldOptions = (fieldName) => getFkTableField(fieldName)?.options || [];

const resetInlineFkState = () => {
  inlineFkSuggestions.value = {};
  inlineFkLoading.value = {};
  inlineFkTouched.value = {};
  inlineFkActiveField.value = "";
  Object.values(inlineFkCloseTimers).forEach((timerId) => {
    clearTimeout(timerId);
  });
  Object.keys(inlineFkCloseTimers).forEach((key) => {
    delete inlineFkCloseTimers[key];
  });
  Object.values(inlineFkQueryTimers).forEach((timerId) => {
    clearTimeout(timerId);
  });
  Object.keys(inlineFkQueryTimers).forEach((key) => {
    delete inlineFkQueryTimers[key];
  });
};

const cancelInlineFkClose = (fieldName) => {
  if (!fieldName || !inlineFkCloseTimers[fieldName]) {
    return;
  }
  clearTimeout(inlineFkCloseTimers[fieldName]);
  delete inlineFkCloseTimers[fieldName];
};

const scheduleInlineFkClose = (fieldName) => {
  if (!fieldName) {
    return;
  }
  cancelInlineFkClose(fieldName);
  inlineFkCloseTimers[fieldName] = setTimeout(() => {
    if (inlineFkActiveField.value === fieldName) {
      inlineFkActiveField.value = "";
    }
    delete inlineFkCloseTimers[fieldName];
  }, 150);
};

const shouldShowInlineFkSuggestions = (fieldName) => (
  inlineFkActiveField.value === fieldName
  && (
    inlineFkLoading.value[fieldName]
    || inlineFkTouched.value[fieldName]
  )
);

const formatInlineFkOption = (field, row) => {
  const tableName = resolveFkTable(field?.name);
  if (!tableName) {
    return row?.id ?? "—";
  }
  return formatFkOptionLabel(tableName, row);
};

const clearInlineFkSelection = (fieldName) => {
  if (!fieldName) {
    return;
  }
  cancelInlineFkClose(fieldName);
  formData.value = {
    ...formData.value,
    [fieldName]: ""
  };
  fkDisplay.value = {
    ...fkDisplay.value,
    [fieldName]: ""
  };
  inlineFkSuggestions.value = {
    ...inlineFkSuggestions.value,
    [fieldName]: []
  };
  inlineFkTouched.value = {
    ...inlineFkTouched.value,
    [fieldName]: false
  };
  inlineFkActiveField.value = fieldName;
};

const applyInlineFkSelection = (field, row) => {
  if (!field?.name || !row) {
    return;
  }
  cancelInlineFkClose(field.name);
  const tableName = resolveFkTable(field.name);
  const labelValue = formatFkOptionLabel(tableName, row);
  formData.value = {
    ...formData.value,
    [field.name]: row.id ?? ""
  };
  fkDisplay.value = {
    ...fkDisplay.value,
    [field.name]: labelValue
  };
  inlineFkSuggestions.value = {
    ...inlineFkSuggestions.value,
    [field.name]: []
  };
  inlineFkTouched.value = {
    ...inlineFkTouched.value,
    [field.name]: false
  };
  inlineFkActiveField.value = "";
};

const fetchInlineFkSuggestions = async (field) => {
  if (!field?.name) {
    return;
  }
  const tableName = resolveFkTable(field.name);
  if (!tableName) {
    return;
  }
  const query = String(fkDisplay.value[field.name] ?? "").trim();
  if (!query) {
    inlineFkSuggestions.value = {
      ...inlineFkSuggestions.value,
      [field.name]: []
    };
    inlineFkTouched.value = {
      ...inlineFkTouched.value,
      [field.name]: false
    };
    return;
  }

  inlineFkLoading.value = {
    ...inlineFkLoading.value,
    [field.name]: true
  };
  inlineFkTouched.value = {
    ...inlineFkTouched.value,
    [field.name]: true
  };

  try {
    const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE(tableName), {
      params: {
        q: query,
        limit: 8
      }
    });
    inlineFkSuggestions.value = {
      ...inlineFkSuggestions.value,
      [field.name]: response.data || []
    };
  } catch (error) {
    inlineFkSuggestions.value = {
      ...inlineFkSuggestions.value,
      [field.name]: []
    };
  } finally {
    inlineFkLoading.value = {
      ...inlineFkLoading.value,
      [field.name]: false
    };
  }
};

const openInlineFkSuggestions = (field) => {
  if (!field?.name || isFieldLocked(field)) {
    return;
  }
  cancelInlineFkClose(field.name);
  inlineFkActiveField.value = field.name;
  if (fkDisplay.value[field.name]) {
    fetchInlineFkSuggestions(field);
  }
};

const handleInlineFkInput = async (field) => {
  if (!field?.name || isFieldLocked(field)) {
    return;
  }
  formData.value = {
    ...formData.value,
    [field.name]: ""
  };
  inlineFkActiveField.value = field.name;
  if (inlineFkQueryTimers[field.name]) {
    clearTimeout(inlineFkQueryTimers[field.name]);
  }
  inlineFkQueryTimers[field.name] = setTimeout(() => {
    fetchInlineFkSuggestions(field);
    delete inlineFkQueryTimers[field.name];
  }, 220);
};

const selectInlineFkSuggestion = (field, row) => {
  applyInlineFkSelection(field, row);
};

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

const loadFkUnitTypeOptions = async () => {
  if (!isFkUnitPositions.value && !isFkUnits.value) {
    return;
  }
  fkPositionFilterLoading.value = true;
  try {
    const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE("unit_types"), {
      params: { limit: 500 }
    });
    fkUnitTypeOptions.value = response.data || [];
  } catch (error) {
    fkUnitTypeOptions.value = [];
  } finally {
    fkPositionFilterLoading.value = false;
  }
};

const loadFkCargoOptions = async () => {
  if (!isFkUnitPositions.value) {
    return;
  }
  fkPositionFilterLoading.value = true;
  try {
    const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE("cargos"), {
      params: { limit: 500 }
    });
    fkCargoOptions.value = response.data || [];
  } catch (error) {
    fkCargoOptions.value = [];
  } finally {
    fkPositionFilterLoading.value = false;
  }
};

const loadFkUnitOptions = async () => {
  if (!isFkUnitPositions.value || !fkPositionFilters.value.unit_type_id) {
    fkUnitOptions.value = [];
    return;
  }
  fkPositionFilterLoading.value = true;
  try {
    const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE("units"), {
      params: {
        filter_unit_type_id: fkPositionFilters.value.unit_type_id,
        limit: 500
      }
    });
    fkUnitOptions.value = response.data || [];
    const selectedUnitId = fkPositionFilters.value.unit_id;
    if (
      selectedUnitId
      && !fkUnitOptions.value.some((row) => String(row?.id) === String(selectedUnitId))
    ) {
      fkPositionFilters.value = {
        ...fkPositionFilters.value,
        unit_id: ""
      };
    }
  } catch (error) {
    fkUnitOptions.value = [];
  } finally {
    fkPositionFilterLoading.value = false;
  }
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

const loadFkProcessDefinitionProcessOptions = async () => {
  try {
    const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE("processes"), {
      params: {
        orderBy: "name",
        order: "asc",
        limit: 500
      }
    });
    fkProcessDefinitionProcessOptions.value = response.data || [];
  } catch (error) {
    fkProcessDefinitionProcessOptions.value = [];
  }
};

const setFkLabel = (tableName, id, label) => {
  if (!tableName || id === null || id === undefined || id === "") {
    return;
  }
  if (!fkLabelCache.value[tableName]) {
    fkLabelCache.value[tableName] = {};
  }
  fkLabelCache.value[tableName][id] = label;
};

const fetchFkLabel = async (tableName, id) => {
  if (!tableName || id === null || id === undefined || id === "") {
    return;
  }
  if (fkLabelCache.value[tableName]?.[id] !== undefined) {
    return;
  }
  try {
    const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE(tableName), {
      params: { filter_id: id, limit: 1 }
    });
    const row = response.data?.[0];
    if (row && tableName === "persons") {
      const lastName = row.last_name ? String(row.last_name).trim() : "";
      const firstName = row.first_name ? String(row.first_name).trim() : "";
      const fullName = `${lastName} ${firstName}`.trim();
      const label = fullName || String(row.email ?? row.id ?? id);
      setFkLabel(tableName, id, label);
      return;
    }
    const displayField = resolveDisplayField(allTablesMap.value?.[tableName]);
    const label = row ? String(row[displayField] ?? row.id ?? id) : String(id);
    setFkLabel(tableName, id, label);
  } catch (error) {
    setFkLabel(tableName, id, String(id));
  }
};

const prefetchFkLabelsForRows = async (rowsToScan, fieldNames) => {
  if (!rowsToScan?.length || !fieldNames?.length) {
    return;
  }
  const tasks = [];
  fieldNames.forEach((fieldName) => {
    const tableName = resolveFkTable(fieldName);
    if (!tableName) {
      return;
    }
    const ids = Array.from(
      new Set(
        rowsToScan
          .map((row) => row?.[fieldName])
          .filter((value) => value !== null && value !== undefined && value !== "")
      )
    );
    ids.forEach((id) => tasks.push(fetchFkLabel(tableName, id)));
  });
  await Promise.all(tasks);
};

const prefetchProcessLabelsForDefinitionRows = async (rowsToScan, tableMeta = null) => {
  const effectiveTable = tableMeta || props.table;
  if (!rowsToScan?.length || effectiveTable?.table !== "process_target_rules") {
    return;
  }

  const definitionIds = Array.from(
    new Set(
      rowsToScan
        .map((row) => row?.process_definition_id)
        .filter((value) => value !== null && value !== undefined && value !== "")
    )
  );

  const missingDefinitionIds = definitionIds.filter(
    (definitionId) => processIdByDefinitionId.value[String(definitionId)] === undefined
  );

  if (!missingDefinitionIds.length) {
    return;
  }

  const resolved = await Promise.all(
    missingDefinitionIds.map(async (definitionId) => {
      try {
        const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE("process_definition_versions"), {
          params: { filter_id: definitionId, limit: 1 }
        });
        const definitionRow = response.data?.[0];
        const processId = definitionRow?.process_id;
        if (processId !== null && processId !== undefined && processId !== "") {
          await fetchFkLabel("processes", processId);
        }
        return {
          definitionId: String(definitionId),
          processId: processId ?? null
        };
      } catch (error) {
        return {
          definitionId: String(definitionId),
          processId: null
        };
      }
    })
  );

  const nextMap = { ...processIdByDefinitionId.value };
  resolved.forEach(({ definitionId, processId }) => {
    nextMap[definitionId] = processId;
  });
  processIdByDefinitionId.value = nextMap;
};

const prefetchProcessDefinitionMeta = async (rowsToScan, tableMeta = null) => {
  if (!rowsToScan?.length) {
    return;
  }
  if (
    tableMeta?.table !== "process_definition_templates"
    && !rowsToScan.some((row) => row?.process_definition_id !== null && row?.process_definition_id !== undefined && row?.process_definition_id !== "")
  ) {
    return;
  }

  const definitionIds = Array.from(
    new Set(
      rowsToScan
        .map((row) => row?.process_definition_id)
        .filter((value) => value !== null && value !== undefined && value !== "")
    )
  );

  if (!definitionIds.length) {
    return;
  }

  const missingDefinitionIds = definitionIds.filter(
    (definitionId) => processDefinitionMetaById.value[String(definitionId)] === undefined
  );

  if (!missingDefinitionIds.length) {
    return;
  }

  const resolved = await Promise.all(
    missingDefinitionIds.map(async (definitionId) => {
      try {
        const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE("process_definition_versions"), {
          params: {
            filter_id: definitionId,
            limit: 1
          }
        });
        return {
          definitionId: String(definitionId),
          row: response.data?.[0] || null
        };
      } catch (error) {
        return {
          definitionId: String(definitionId),
          row: null
        };
      }
    })
  );

  const nextMap = { ...processDefinitionMetaById.value };
  resolved.forEach(({ definitionId, row }) => {
    nextMap[definitionId] = row;
  });
  processDefinitionMetaById.value = nextMap;
};

const prefetchUnitTypeForUnitPositions = async (rowsToScan) => {
  if (!rowsToScan?.length) {
    return;
  }
  const unitIds = Array.from(
    new Set(
      rowsToScan
        .map((row) => row?.unit_id)
        .filter((value) => value !== null && value !== undefined && value !== "")
    )
  );
  if (!unitIds.length) {
    return;
  }

  const missingUnitIds = unitIds.filter(
    (unitId) => unitTypeByUnitId.value[String(unitId)] === undefined
  );

  if (missingUnitIds.length) {
    const resolved = await Promise.all(
      missingUnitIds.map(async (unitId) => {
        try {
          const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE("units"), {
            params: { filter_id: unitId, limit: 1 }
          });
          return {
            unitId: String(unitId),
            unitTypeId: response.data?.[0]?.unit_type_id ?? null
          };
        } catch (error) {
          return {
            unitId: String(unitId),
            unitTypeId: null
          };
        }
      })
    );
    const nextMap = { ...unitTypeByUnitId.value };
    resolved.forEach(({ unitId, unitTypeId }) => {
      nextMap[unitId] = unitTypeId;
    });
    unitTypeByUnitId.value = nextMap;
  }

  const unitTypeIds = Array.from(
    new Set(
      unitIds
        .map((unitId) => unitTypeByUnitId.value[String(unitId)])
        .filter((value) => value !== null && value !== undefined && value !== "")
    )
  );
  await Promise.all(unitTypeIds.map((unitTypeId) => fetchFkLabel("unit_types", unitTypeId)));
};

const prefetchPositionMetaForAssignments = async (rowsToScan) => {
  if (!rowsToScan?.length) {
    return;
  }
  const positionIds = Array.from(
    new Set(
      rowsToScan
        .map((row) => row?.position_id)
        .filter((value) => value !== null && value !== undefined && value !== "")
    )
  );
  if (!positionIds.length) {
    return;
  }
  const missingPositionIds = positionIds.filter(
    (positionId) => positionMetaById.value[String(positionId)] === undefined
  );
  if (!missingPositionIds.length) {
    return;
  }
  const resolved = await Promise.all(
    missingPositionIds.map(async (positionId) => {
      try {
        const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE("unit_positions"), {
          params: { filter_id: positionId, limit: 1 }
        });
        const row = response.data?.[0] || null;
        return {
          positionId: String(positionId),
          row
        };
      } catch (error) {
        return {
          positionId: String(positionId),
          row: null
        };
      }
    })
  );
  const nextMap = { ...positionMetaById.value };
  resolved.forEach(({ positionId, row }) => {
    nextMap[positionId] = row;
  });
  positionMetaById.value = nextMap;
};

const getFkCachedLabel = (tableName, value) => {
  if (!tableName || value === null || value === undefined || value === "") {
    return null;
  }
  const cache = fkLabelCache.value[tableName];
  if (!cache) {
    return null;
  }
  const key = String(value);
  if (cache[key] !== undefined) {
    return cache[key];
  }
  return null;
};

const refreshFormFkDisplayLabels = async () => {
  const fkFields = formFields.value.filter((field) => isForeignKeyField(field));
  if (!fkFields.length) {
    return;
  }
  const lookups = fkFields
    .map((field) => ({
      fieldName: field.name,
      tableName: resolveFkTable(field.name),
      value: formData.value[field.name]
    }))
    .filter(({ tableName, value }) => tableName && value !== null && value !== undefined && value !== "");

  await Promise.all(
    lookups.map(({ tableName, value }) => fetchFkLabel(tableName, value))
  );

  const nextDisplay = { ...fkDisplay.value };
  fkFields.forEach((field) => {
    const value = formData.value[field.name];
    if (value === null || value === undefined || value === "") {
      nextDisplay[field.name] = "";
      return;
    }
    const tableName = resolveFkTable(field.name);
    const label = getFkCachedLabel(tableName, value);
    nextDisplay[field.name] = label !== null && label !== undefined
      ? String(label)
      : String(value);
  });
  fkDisplay.value = nextDisplay;
};

const buildFkFilterParams = () => {
  const params = {};
  Object.entries(fkFilters.value || {}).forEach(([field, value]) => {
    if (value === "" || value === null || value === undefined) {
      return;
    }
    params[`filter_${field}`] = value;
  });
  return params;
};

const fetchFkRows = async () => {
  if (!fkTable.value) {
    fkRows.value = [];
    return;
  }
  fkLoading.value = true;
  fkError.value = "";
  try {
    const filterParams = buildFkFilterParams();
    const inheritedUnitId = filterParams.filter_unit_id;
    if (filterParams.filter_unit_id !== undefined) {
      delete filterParams.filter_unit_id;
    }
    const baseParams = {
      q: fkSearch.value || undefined,
      ...filterParams
    };

    let rowsData = [];
    if (isFkUnitPositions.value) {
      const selectedUnitId = fkPositionFilters.value.unit_id || inheritedUnitId || "";
      const selectedUnitTypeId = fkPositionFilters.value.unit_type_id || "";
      const selectedCargoId = fkPositionFilters.value.cargo_id || "";
      const cargoFilter = selectedCargoId ? { filter_cargo_id: selectedCargoId } : {};
      const activeFilter = { filter_is_active: 1 };
      if (selectedUnitId) {
        const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE("unit_positions"), {
          params: {
            ...baseParams,
            filter_unit_id: selectedUnitId,
            ...cargoFilter,
            ...activeFilter,
            limit: 200
          }
        });
        rowsData = response.data || [];
      } else if (selectedUnitTypeId) {
        const unitsResponse = await axios.get(API_ROUTES.ADMIN_SQL_TABLE("units"), {
          params: {
            filter_unit_type_id: selectedUnitTypeId,
            limit: 500
          }
        });
        const unitIds = Array.from(
          new Set(
            (unitsResponse.data || [])
              .map((row) => row?.id)
              .filter((value) => value !== null && value !== undefined && value !== "")
          )
        );
        if (!unitIds.length) {
          rowsData = [];
        } else {
          const responses = await Promise.all(
            unitIds.map((unitId) =>
              axios.get(API_ROUTES.ADMIN_SQL_TABLE("unit_positions"), {
                params: {
                  ...baseParams,
                  filter_unit_id: unitId,
                  ...cargoFilter,
                  ...activeFilter,
                  limit: 200
                }
              })
            )
          );
          const mergedRows = new Map();
          responses.forEach((response) => {
            (response.data || []).forEach((row) => {
              const key = row?.id !== undefined ? String(row.id) : JSON.stringify(row);
              mergedRows.set(key, row);
            });
          });
          rowsData = Array.from(mergedRows.values());
        }
      } else {
        const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE("unit_positions"), {
          params: {
            ...baseParams,
            ...cargoFilter,
            ...activeFilter,
            limit: 25
          }
        });
        rowsData = response.data || [];
      }

      const activeAssignmentsResponse = await axios.get(API_ROUTES.ADMIN_SQL_TABLE("position_assignments"), {
        params: {
          filter_is_current: 1,
          limit: 5000
        }
      });
      const assignedPositionIds = new Set(
        (activeAssignmentsResponse.data || [])
          .map((row) => row?.position_id)
          .filter((value) => value !== null && value !== undefined && value !== "")
          .map((value) => String(value))
      );
      rowsData = rowsData.filter((row) => !assignedPositionIds.has(String(row?.id)));
    } else if (isFkUnits.value) {
      const selectedUnitTypeId = fkPositionFilters.value.unit_type_id || "";
      const unitTypeFilter = selectedUnitTypeId
        ? { filter_unit_type_id: selectedUnitTypeId }
        : {};
      const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE("units"), {
        params: {
          ...baseParams,
          ...unitTypeFilter,
          limit: 100
        }
      });
      rowsData = response.data || [];
    } else {
      const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE(fkTable.value.table), {
        params: {
          ...baseParams,
          limit: 25
        }
      });
      rowsData = response.data || [];
    }
    if (fkTable.value.table === "process_definition_series" && fkField.value === "series_id") {
      rowsData = rowsData.filter(
        (row) => Number(row?.is_active) === 1 && String(row?.source_type || "") !== "legacy"
      );
    }
    fkRows.value = rowsData;
    const fkFields = (fkTable.value.fields || [])
      .filter((field) => isForeignKeyField(field))
      .map((field) => field.name);
    await prefetchFkLabelsForRows(fkRows.value, fkFields);
    if (fkTable.value.table === "unit_positions") {
      await prefetchUnitTypeForUnitPositions(fkRows.value);
    }
  } catch (err) {
    fkError.value = err?.response?.data?.message || "No se pudo cargar la informacion.";
  } finally {
    fkLoading.value = false;
  }
};

const openFkSearch = async (field, onSelect = null) => {
  const tableName = resolveFkTable(field.name);
  if (!tableName) {
    return;
  }
  if (editorInstance && editorModal.value?.classList.contains("show")) {
    editorInstance.hide();
    pushModalOrigin("editor");
  }
  if (processSearchInstance && processSearchModal.value?.classList.contains("show")) {
    processSearchInstance.hide();
    pushModalOrigin("processSearch");
  }
  if (templateSearchInstance && templateSearchModal.value?.classList.contains("show")) {
    templateSearchInstance.hide();
    pushModalOrigin("templateSearch");
  }
  if (documentSearchInstance && documentSearchModal.value?.classList.contains("show")) {
    documentSearchInstance.hide();
    pushModalOrigin("documentSearch");
  }
  if (personAssignmentsInstance && personAssignmentsModal.value?.classList.contains("show")) {
    personAssignmentsInstance.hide();
    pushModalOrigin("personAssignments");
  }
  if (definitionRulesInstance && definitionRulesModal.value?.classList.contains("show")) {
    definitionRulesInstance.hide();
    pushModalOrigin("definitionRules");
  }
  if (definitionTriggersInstance && definitionTriggersModal.value?.classList.contains("show")) {
    definitionTriggersInstance.hide();
    pushModalOrigin("definitionTriggers");
  }
  if (definitionArtifactsInstance && definitionArtifactsModal.value?.classList.contains("show")) {
    definitionArtifactsInstance.hide();
    pushModalOrigin("definitionArtifacts");
  }
  fkSetter.value = onSelect;
  fkField.value = field.name;
  fkTable.value = allTablesMap.value[tableName] || null;
  unitTypeByUnitId.value = {};
  fkViewerRow.value = null;
  resetFkFilters();
  fkCreateForm.value = {};
  fkCreateError.value = "";
  fkCreateExitTarget.value = "none";
  fkNestedExitTarget.value = "none";
  fkSearch.value = "";
  resetFkUnitPositionFilters();
  if (tableName === "unit_positions" || tableName === "units") {
    await loadFkUnitTypeOptions();
  }
  if (tableName === "unit_positions") {
    await loadFkCargoOptions();
  }
  if (tableName === "process_definition_versions") {
    await loadFkProcessDefinitionProcessOptions();
  }
  await fetchFkRows();
  ensureFkInstance();
  fkInstance?.show();
};

const applyFkSelection = (row) => {
  if (!fkField.value || !row) {
    return;
  }
  if (fkSetter.value) {
    fkSetter.value(row);
    fkSetter.value = null;
  } else {
    formData.value[fkField.value] = row.id ?? row[fkField.value] ?? "";
    const displayField = resolveDisplayField(fkTable.value);
    const labelValue = row[displayField] ?? row.id;
    fkDisplay.value = {
      ...fkDisplay.value,
      [fkField.value]: labelValue ? String(labelValue) : ""
    };
  }
};

const selectFkRow = (row) => {
  applyFkSelection(row);
  fkInstance?.hide();
};

const formatFkListCell = (row, field) => {
  if (!row || !field) {
    return "—";
  }
  if (field.name === "__unit_type_id") {
    const unitId = row.unit_id;
    if (unitId === null || unitId === undefined || unitId === "") {
      return "—";
    }
    const unitTypeId = unitTypeByUnitId.value[String(unitId)];
    if (unitTypeId === null || unitTypeId === undefined || unitTypeId === "") {
      return "—";
    }
    const unitTypeLabel = getFkCachedLabel("unit_types", unitTypeId);
    return unitTypeLabel ?? unitTypeId;
  }
  return formatCell(row[field.name], field);
};

const formatFkPrimaryCell = (row) => {
  if (!row) {
    return "—";
  }
  if (!fkPrimaryListField.value) {
    const displayField = resolveDisplayField(fkTable.value) || "id";
    const value = row[displayField];
    return value === null || value === undefined || value === "" ? "—" : String(value);
  }
  return formatFkListCell(row, fkPrimaryListField.value);
};

const formatFkViewerValue = (field, row) => {
  if (!row || !field) {
    return "—";
  }
  return formatValueForTable(fkTable.value, row[field.name], field, row);
};

const RELATED_RECORD_CONFIG = {
  persons: [
    { table: "position_assignments", label: "Ocupaciones", foreignKey: "person_id", orderBy: "start_date", order: "desc" },
    { table: "role_assignments", label: "Roles", foreignKey: "person_id", orderBy: "assigned_at", order: "desc" },
    { table: "contracts", label: "Contratos", foreignKey: "person_id", orderBy: "start_date", order: "desc" }
  ],
  processes: [
    { table: "process_definition_versions", label: "Definiciones", foreignKey: "process_id", orderBy: "effective_from", order: "desc" }
  ],
  process_definition_versions: [
    { table: "process_definition_triggers", label: "Disparadores", foreignKey: "process_definition_id", orderBy: "created_at", order: "desc" },
    { table: "process_target_rules", label: "Reglas de alcance", foreignKey: "process_definition_id", orderBy: "priority", order: "asc" },
    { table: "process_definition_templates", label: "Plantillas", foreignKey: "process_definition_id", orderBy: "sort_order", order: "asc" },
    { table: "tasks", label: "Tareas", foreignKey: "process_definition_id", orderBy: "created_at", order: "desc" }
  ],
  process_definition_templates: [
    { table: "signature_flow_templates", label: "Flujos de firma", foreignKey: "process_definition_template_id", orderBy: "created_at", order: "desc" }
  ],
  tasks: [
    { table: "task_items", label: "Items", foreignKey: "task_id", orderBy: "sort_order", order: "asc" },
    { table: "task_assignments", label: "Asignaciones", foreignKey: "task_id", orderBy: "assigned_at", order: "desc" }
  ],
  task_items: [
    { table: "documents", label: "Documentos", foreignKey: "task_item_id", orderBy: "created_at", order: "desc" }
  ],
  documents: [
    { table: "document_versions", label: "Versiones del documento", foreignKey: "document_id", orderBy: "created_at", order: "desc" }
  ],
  units: [
    { table: "unit_positions", label: "Puestos", foreignKey: "unit_id", orderBy: "created_at", order: "desc" },
    { table: "role_assignments", label: "Roles asignados", foreignKey: "unit_id", orderBy: "assigned_at", order: "desc" }
  ],
  vacancies: [
    { table: "vacancy_visibility", label: "Visibilidad", foreignKey: "vacancy_id", orderBy: "created_at", order: "desc" },
    { table: "aplications", label: "Aplicaciones", foreignKey: "vacancy_id", orderBy: "applied_at", order: "desc" }
  ]
};

const formatRecordViewerValue = (field, row) => {
  if (!row || !field) {
    return "—";
  }
  return formatValueForTable(recordViewerTable.value, row[field.name], field, row);
};

const loadRecordViewerRelatedSections = async (tableMeta, row) => {
  if (!tableMeta?.table || row?.id === null || row?.id === undefined || row?.id === "") {
    recordViewerRelatedSections.value = [];
    return;
  }

  const configs = RELATED_RECORD_CONFIG[tableMeta.table] || [];
  if (!configs.length) {
    recordViewerRelatedSections.value = [];
    return;
  }

  const sections = await Promise.all(
    configs.map(async (config) => {
      const sectionTableMeta = allTablesMap.value[config.table];
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
      } catch (err) {
        return {
          key: config.table,
          label: config.label,
          tableMeta: sectionTableMeta,
          fields,
          rows: [],
          error: err?.response?.data?.message || "No se pudo cargar la relacion."
        };
      }
    })
  );

  recordViewerRelatedSections.value = sections.filter(Boolean);
};

const openRecordViewer = async (row, tableMeta = props.table) => {
  if (!row || !tableMeta) {
    return;
  }

  if (personAssignmentsInstance && personAssignmentsModal.value?.classList.contains("show")) {
    personAssignmentsInstance.hide();
    pushModalOrigin("personAssignments");
  }
  if (definitionRulesInstance && definitionRulesModal.value?.classList.contains("show")) {
    definitionRulesInstance.hide();
    pushModalOrigin("definitionRules");
  }
  if (definitionTriggersInstance && definitionTriggersModal.value?.classList.contains("show")) {
    definitionTriggersInstance.hide();
    pushModalOrigin("definitionTriggers");
  }
  if (definitionArtifactsInstance && definitionArtifactsModal.value?.classList.contains("show")) {
    definitionArtifactsInstance.hide();
    pushModalOrigin("definitionArtifacts");
  }

  recordViewerTable.value = tableMeta;
  recordViewerRow.value = row;
  recordViewerError.value = "";
  recordViewerLoading.value = true;
  recordViewerRelatedSections.value = [];

  try {
    const fkFields = getViewerFieldsForTable(tableMeta)
      .filter((field) => isForeignKeyField(field))
      .map((field) => field.name);
    await prefetchFkLabelsForRows([row], fkFields);
    await prefetchProcessLabelsForDefinitionRows([row], tableMeta);
    await prefetchProcessDefinitionMeta([row], tableMeta);
    await loadRecordViewerRelatedSections(tableMeta, row);
  } catch (err) {
    recordViewerError.value = err?.response?.data?.message || "No se pudo cargar el registro.";
  } finally {
    recordViewerLoading.value = false;
  }

  ensureRecordViewerInstance();
  recordViewerInstance?.show();
};

const closeRecordViewer = () => {
  recordViewerInstance?.hide();
};

const openFkViewer = (row) => {
  if (!row) {
    return;
  }
  fkViewerRow.value = row;
  fkNestedExitTarget.value = "search";
  skipFkReturnRestore.value = true;
  fkInstance?.hide();
  ensureFkViewerInstance();
  fkViewerInstance?.show();
};

const closeFkViewer = () => {
  fkViewerInstance?.hide();
};

const openFkFilterModal = () => {
  if (!fkTable.value) {
    return;
  }
  fkNestedExitTarget.value = "search";
  skipFkReturnRestore.value = true;
  fkInstance?.hide();
  ensureFkFilterInstance();
  fkFilterInstance?.show();
};

const cancelFkFilter = () => {
  fkFilterInstance?.hide();
};

const clearFkFilters = async () => {
  resetFkFilters();
  await fetchFkRows();
  fkFilterInstance?.hide();
};

const applyFkFilters = async () => {
  await fetchFkRows();
  fkFilterInstance?.hide();
};

const openFkCreate = () => {
  if (!canCreateFkReference.value) {
    return;
  }
  fkCreateError.value = "";
  fkCreateLoading.value = false;
  resetFkCreateForm();
  fkCreateExitTarget.value = "search";
  skipFkReturnRestore.value = true;
  fkInstance?.hide();
  ensureFkCreateInstance();
  fkCreateInstance?.show();
};

const cancelFkCreate = () => {
  fkCreateError.value = "";
  fkCreateExitTarget.value = "search";
  fkCreateInstance?.hide();
};

const buildFkCreatePayload = () => {
  const payload = {};
  fkCreateFields.value.forEach((field) => {
    let value = fkCreateForm.value[field.name];
    if (value === "") {
      value = null;
    }
    if (field.type === "number") {
      value = value === null ? null : Number(value);
      if (Number.isNaN(value)) {
        value = null;
      }
    }
    if (field.type === "boolean") {
      value = Number(value) === 1 ? 1 : 0;
    }
    payload[field.name] = value;
  });
  return payload;
};

const submitFkCreate = async () => {
  if (!fkTable.value || !canCreateFkReference.value) {
    return;
  }
  const missingRequired = fkCreateFields.value.filter((field) => {
    if (!field.required) {
      return false;
    }
    const value = fkCreateForm.value[field.name];
    return value === "" || value === null || value === undefined;
  });
  if (missingRequired.length) {
    fkCreateError.value = `Completa los campos requeridos: ${missingRequired
      .map((field) => field.label || field.name)
      .join(", ")}.`;
    return;
  }

  fkCreateLoading.value = true;
  fkCreateError.value = "";
  try {
    const payload = buildFkCreatePayload();
    const { data } = await axios.post(API_ROUTES.ADMIN_SQL_TABLE(fkTable.value.table), payload);
    const createdRow = data && typeof data === "object" ? { ...payload, ...data } : { ...payload };
    if (createdRow.id === undefined || createdRow.id === null || createdRow.id === "") {
      const fallbackKey = fkTable.value?.primaryKeys?.[0];
      if (fallbackKey && createdRow[fallbackKey] !== undefined) {
        createdRow.id = createdRow[fallbackKey];
      }
    }
    applyFkSelection(createdRow);
    await fetchFkRows();
    fkCreateExitTarget.value = "parent";
    fkCreateInstance?.hide();
  } catch (err) {
    fkCreateError.value = err?.response?.data?.message || "No se pudo crear la referencia.";
  } finally {
    fkCreateLoading.value = false;
  }
};

const debouncedFkSearch = () => {
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
  searchTimeout = setTimeout(() => {
    fetchFkRows();
  }, 350);
};

const buildKeys = (row) => {
  const keys = {};
  props.table?.primaryKeys?.forEach((key) => {
    keys[key] = row?.[key];
  });
  return keys;
};

const fetchUnitPositionsForCurrentFilters = async ({
  baseParams = {},
  limit = 500,
  includePositionTypeFilter = false,
  onlyActive = false,
  filters = null
} = {}) => {
  const sourceFilters = filters || unitPositionFilters.value;
  const selectedUnitId = sourceFilters.unit_id;
  const selectedUnitTypeId = sourceFilters.unit_type_id;
  const selectedCargoId = sourceFilters.cargo_id;
  const selectedPositionType = includePositionTypeFilter ? sourceFilters.position_type : "";
  const cargoFilter = selectedCargoId ? { filter_cargo_id: selectedCargoId } : {};
  const positionTypeFilter = selectedPositionType ? { filter_position_type: selectedPositionType } : {};
  const positionActiveFilter = onlyActive ? { filter_is_active: 1 } : {};

  if (selectedUnitId) {
    const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE("unit_positions"), {
      params: {
        ...baseParams,
        filter_unit_id: selectedUnitId,
        ...cargoFilter,
        ...positionTypeFilter,
        ...positionActiveFilter,
        limit
      }
    });
    return response.data || [];
  }

  if (selectedUnitTypeId) {
    const unitsResponse = await axios.get(API_ROUTES.ADMIN_SQL_TABLE("units"), {
      params: {
        filter_unit_type_id: selectedUnitTypeId,
        limit: 500
      }
    });
    const unitIds = Array.from(
      new Set(
        (unitsResponse.data || [])
          .map((row) => row?.id)
          .filter((value) => value !== null && value !== undefined && value !== "")
      )
    );
    if (!unitIds.length) {
      return [];
    }
    const responses = await Promise.all(
      unitIds.map((unitId) =>
        axios.get(API_ROUTES.ADMIN_SQL_TABLE("unit_positions"), {
          params: {
            ...baseParams,
            filter_unit_id: unitId,
            ...cargoFilter,
            ...positionTypeFilter,
            ...positionActiveFilter,
            limit
          }
        })
      )
    );
    const mergedRows = new Map();
    responses.forEach((response) => {
      (response.data || []).forEach((row) => {
        const key = row?.id !== undefined ? String(row.id) : JSON.stringify(row);
        mergedRows.set(key, row);
      });
    });
    return Array.from(mergedRows.values());
  }

  const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE("unit_positions"), {
    params: {
      ...baseParams,
      ...cargoFilter,
      ...positionTypeFilter,
      ...positionActiveFilter,
      limit
    }
  });
  return response.data || [];
};

const loadVacantPositions = async () => {
  if (!isPositionAssignmentsTable.value) {
    vacantPositionRows.value = [];
    vacantPositionError.value = "";
    vacantPositionLoading.value = false;
    return;
  }
  vacantPositionLoading.value = true;
  vacantPositionError.value = "";
  try {
    const positionRows = await fetchUnitPositionsForCurrentFilters({
      baseParams: { q: vacantSearchTerm.value || undefined },
      limit: 500,
      includePositionTypeFilter: true,
      onlyActive: true,
      filters: vacantPositionFilters.value
    });
    if (!positionRows.length) {
      vacantPositionRows.value = [];
      return;
    }
    const activeAssignmentsResponse = await axios.get(API_ROUTES.ADMIN_SQL_TABLE("position_assignments"), {
      params: {
        filter_is_current: 1,
        limit: 5000
      }
    });
    const assignedPositionIds = new Set(
      (activeAssignmentsResponse.data || [])
        .map((row) => row?.position_id)
        .filter((value) => value !== null && value !== undefined && value !== "")
        .map((value) => String(value))
    );
    vacantPositionRows.value = positionRows.filter(
      (row) => !assignedPositionIds.has(String(row.id))
    );
    await prefetchFkLabelsForRows(vacantPositionRows.value, ["unit_id", "cargo_id"]);
    await prefetchUnitTypeForUnitPositions(vacantPositionRows.value);
  } catch (error) {
    vacantPositionRows.value = [];
    vacantPositionError.value = "No se pudo cargar los puestos sin ocupaciones.";
  } finally {
    vacantPositionLoading.value = false;
  }
};

const loadUnassignedTemplateArtifacts = async () => {
  if (!isProcessDefinitionTemplatesTable.value) {
    unassignedTemplateArtifactRows.value = [];
    unassignedTemplateArtifactError.value = "";
    unassignedTemplateArtifactLoading.value = false;
    return;
  }
  unassignedTemplateArtifactLoading.value = true;
  unassignedTemplateArtifactError.value = "";
  try {
    const artifactParams = {
      q: unassignedTemplateArtifactSearch.value.trim() || undefined,
      limit: 500
    };
    if (
      unassignedTemplateArtifactFilters.value.is_active !== ""
      && unassignedTemplateArtifactFilters.value.is_active !== null
      && unassignedTemplateArtifactFilters.value.is_active !== undefined
    ) {
      artifactParams.filter_is_active = unassignedTemplateArtifactFilters.value.is_active;
    }

    const [artifactResponse, linkedResponse] = await Promise.all([
      axios.get(API_ROUTES.ADMIN_SQL_TABLE("template_artifacts"), {
        params: artifactParams
      }),
      axios.get(API_ROUTES.ADMIN_SQL_TABLE("process_definition_templates"), {
        params: {
          limit: 5000
        }
      })
    ]);

    const linkedArtifactIds = new Set(
      (linkedResponse.data || [])
        .map((row) => row?.template_artifact_id)
        .filter((value) => value !== null && value !== undefined && value !== "")
        .map((value) => String(value))
    );

    unassignedTemplateArtifactRows.value = (artifactResponse.data || []).filter(
      (row) => !linkedArtifactIds.has(String(row.id))
    );
  } catch (error) {
    unassignedTemplateArtifactRows.value = [];
    unassignedTemplateArtifactError.value = "No se pudo cargar los artifacts sin definicion.";
  } finally {
    unassignedTemplateArtifactLoading.value = false;
  }
};

const fetchRows = async () => {
  if (!props.table) {
    rows.value = [];
    vacantSearchTerm.value = "";
    vacantPositionRows.value = [];
    vacantPositionError.value = "";
    vacantPositionLoading.value = false;
    unassignedTemplateArtifactSearch.value = "";
    unassignedTemplateArtifactRows.value = [];
    unassignedTemplateArtifactError.value = "";
    unassignedTemplateArtifactLoading.value = false;
    return;
  }
  loading.value = true;
  error.value = "";
  try {
    const filters = {};
    if (props.table?.table === "processes") {
      Object.entries(processFilters.value).forEach(([key, value]) => {
        if (value !== "" && value !== null && value !== undefined) {
          filters[`filter_${key}`] = value;
        }
      });
    }
    if (props.table?.table === "documents") {
      Object.entries(documentFilters.value).forEach(([key, value]) => {
        if (value !== "" && value !== null && value !== undefined) {
          filters[`filter_${key}`] = value;
        }
      });
    }
    if (props.table?.table === "process_definition_versions") {
      Object.entries(processDefinitionInlineFilters.value).forEach(([key, value]) => {
        if (value !== "" && value !== null && value !== undefined) {
          filters[`filter_${key}`] = typeof value === "string" ? value.trim() : value;
        }
      });
    }
    if (props.table?.table === "process_target_rules") {
      Object.entries(processTargetRuleInlineFilters.value).forEach(([key, value]) => {
        if (value !== "" && value !== null && value !== undefined) {
          filters[`filter_${key}`] = typeof value === "string" ? value.trim() : value;
        }
      });
    }
    if (props.table?.table === "template_artifacts") {
      Object.entries(templateArtifactInlineFilters.value).forEach(([key, value]) => {
        if (value !== "" && value !== null && value !== undefined) {
          filters[`filter_${key}`] = typeof value === "string" ? value.trim() : value;
        }
      });
    }
    const baseParams = {
      q: searchTerm.value || undefined,
      ...filters
    };

    if (isPositionFilterTable.value) {
      const hasPositionScopeFilter = Boolean(
        unitPositionFilters.value.unit_id
        || unitPositionFilters.value.unit_type_id
        || unitPositionFilters.value.cargo_id
      );
      if (isPositionAssignmentsTable.value && hasPositionScopeFilter) {
        const positionRows = await fetchUnitPositionsForCurrentFilters({
          baseParams: {},
          limit: 500
        });
        const positionIds = Array.from(
          new Set(
            positionRows
              .map((row) => row?.id)
              .filter((value) => value !== null && value !== undefined && value !== "")
          )
        );
        if (!positionIds.length) {
          rows.value = [];
        } else {
          const responses = await Promise.all(
            positionIds.map((positionId) =>
              axios.get(API_ROUTES.ADMIN_SQL_TABLE("position_assignments"), {
                params: {
                  ...baseParams,
                  filter_position_id: positionId,
                  limit: 200
                }
              })
            )
          );
          const mergedRows = new Map();
          responses.forEach((response) => {
            (response.data || []).forEach((row) => {
              const key = row?.id !== undefined ? String(row.id) : JSON.stringify(row);
              mergedRows.set(key, row);
            });
          });
          rows.value = Array.from(mergedRows.values());
        }
      } else if (isUnitPositionsTable.value) {
        rows.value = await fetchUnitPositionsForCurrentFilters({
          baseParams,
          limit: hasPositionScopeFilter ? 200 : 50
        });
      } else {
        const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE(props.table.table), {
          params: {
            ...baseParams,
            limit: 50
          }
        });
        rows.value = response.data || [];
      }
    } else {
      const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE(props.table.table), {
        params: {
          ...baseParams,
          limit: 50
        }
      });
      rows.value = response.data || [];
    }
    const fkFields = props.table.fields
      .filter((field) => isForeignKeyField(field))
      .map((field) => field.name);
    await prefetchFkLabelsForRows(rows.value, fkFields);
    await prefetchProcessLabelsForDefinitionRows(rows.value, props.table);
    if (isPositionAssignmentsTable.value) {
      await prefetchPositionMetaForAssignments(rows.value);
      await loadVacantPositions();
    } else {
      vacantPositionRows.value = [];
      vacantPositionError.value = "";
      vacantPositionLoading.value = false;
    }
    if (isProcessDefinitionTemplatesTable.value) {
      await loadUnassignedTemplateArtifacts();
    } else {
      unassignedTemplateArtifactRows.value = [];
      unassignedTemplateArtifactError.value = "";
      unassignedTemplateArtifactLoading.value = false;
    }
    if (isPersonTable.value && personEditorId.value) {
      const selectedPerson = rows.value.find(
        (row) => String(row.id) === String(personEditorId.value)
      );
      if (!selectedPerson) {
        resetPersonAssignments();
      } else {
        personAssignmentContext.value = buildPersonAssignmentContext(selectedPerson);
      }
    }
  } catch (err) {
    error.value = err?.response?.data?.message || "No se pudo cargar la informacion.";
  } finally {
    loading.value = false;
  }
};

const clearProcessDefinitionInlineFilters = async () => {
  processDefinitionInlineFilters.value = {
    process_id: "",
    variation_key: "",
    status: ""
  };
  await fetchRows();
};

const clearProcessTargetRuleInlineFilters = async () => {
  processTargetRuleInlineFilters.value = {
    definition_execution_mode: "",
    definition_status: ""
  };
  await fetchRows();
};

const clearTemplateArtifactInlineFilters = async () => {
  templateArtifactInlineFilters.value = {
    artifact_origin: "",
    artifact_stage: ""
  };
  await fetchRows();
};

const debouncedSearch = () => {
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
  searchTimeout = setTimeout(() => {
    fetchRows();
  }, 400);
};

const debouncedVacantSearch = () => {
  if (vacantSearchTimeout) {
    clearTimeout(vacantSearchTimeout);
  }
  vacantSearchTimeout = setTimeout(() => {
    loadVacantPositions();
  }, 400);
};

const debouncedUnassignedTemplateArtifactSearch = () => {
  if (unassignedTemplateArtifactSearchTimeout) {
    clearTimeout(unassignedTemplateArtifactSearchTimeout);
  }
  unassignedTemplateArtifactSearchTimeout = setTimeout(() => {
    loadUnassignedTemplateArtifacts();
  }, 400);
};

const focusSearch = () => {
  searchInput.value?.focus();
};

const handleSearchAction = () => {
  if (props.table?.table === "processes") {
    openProcessSearch();
    return;
  }
  if (props.table?.table === "documents") {
    openDocumentSearch();
    return;
  }
  if (isPositionFilterTable.value) {
    openUnitPositionSearch();
    return;
  }
  focusSearch();
};

const hideFeedbackToast = () => {
  if (feedbackToastTimeout) {
    clearTimeout(feedbackToastTimeout);
    feedbackToastTimeout = null;
  }
  feedbackToast.value = {
    visible: false,
    kind: "success",
    title: "",
    message: ""
  };
};

const showFeedbackToast = ({ kind = "success", title, message, duration = 5200 }) => {
  if (feedbackToastTimeout) {
    clearTimeout(feedbackToastTimeout);
    feedbackToastTimeout = null;
  }
  feedbackToast.value = {
    visible: true,
    kind,
    title,
    message
  };
  feedbackToastTimeout = setTimeout(() => {
    hideFeedbackToast();
  }, duration);
};

const syncTemplateArtifactsFromDist = async () => {
  if (!isTemplateArtifactsTable.value) {
    return;
  }
  loading.value = true;
  error.value = "";
  try {
    const response = await axios.post(API_ROUTES.ADMIN_SQL_TEMPLATE_ARTIFACTS_SYNC);
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

const loadDraftArtifactSeedOptions = async () => {
  try {
    const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE("template_seeds"), {
      params: {
        filter_is_active: 1,
        orderBy: "display_name",
        order: "asc",
        limit: 500
      }
    });
    draftArtifactSeedOptions.value = response.data || [];
  } catch (err) {
    draftArtifactSeedOptions.value = [];
  }
};

const syncTemplateSeedsFromSource = async () => {
  loading.value = true;
  error.value = "";
  try {
    const response = await axios.post(API_ROUTES.ADMIN_SQL_TEMPLATE_SEEDS_SYNC);
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

const openDraftArtifactModal = async (row = null) => {
  if (!props.table || props.table.table !== "template_artifacts") {
    return;
  }
  draftArtifactError.value = "";
  draftArtifactEditId.value = row?.id ? String(row.id) : "";
  draftArtifactExistingFiles.value = {
    pdf: "",
    docx: "",
    xlsx: "",
    pptx: ""
  };
  if (row) {
    const availableFormats = normalizeAvailableFormats(row.available_formats) || {};
    draftArtifactForm.value = {
      template_seed_id: row.template_seed_id ? String(row.template_seed_id) : "",
      display_name: row.display_name ? String(row.display_name) : "",
      description: row.description ? String(row.description) : "",
      source_version: row.source_version ? String(row.source_version) : "1.0.0"
    };
    draftArtifactExistingFiles.value = {
      pdf: getFileNameFromObjectKey(availableFormats?.user?.pdf?.entry_object_key),
      docx: getFileNameFromObjectKey(availableFormats?.user?.docx?.entry_object_key),
      xlsx: getFileNameFromObjectKey(availableFormats?.user?.xlsx?.entry_object_key),
      pptx: getFileNameFromObjectKey(availableFormats?.user?.pptx?.entry_object_key)
    };
  } else {
    draftArtifactForm.value = {
      template_seed_id: "",
      display_name: "",
      description: "",
      source_version: "1.0.0"
    };
  }
  await loadDraftArtifactSeedOptions();
  ensureDraftArtifactInstance();
  draftArtifactInstance?.show();
};

const closeDraftArtifactModal = () => {
  draftArtifactInstance?.hide();
};

const handleDraftArtifactFileChange = (kind, event) => {
  draftArtifactFiles.value = {
    ...draftArtifactFiles.value,
    [kind]: event?.target?.files?.[0] || null
  };
};

const handleDraftArtifactDrop = (kind, event) => {
  const file = event?.dataTransfer?.files?.[0] || null;
  draftArtifactFiles.value = {
    ...draftArtifactFiles.value,
    [kind]: file
  };
};

const getDraftArtifactFileLabel = (kind) => {
  const file = draftArtifactFiles.value[kind];
  return file?.name || draftArtifactExistingFiles.value[kind] || "Sin archivo";
};

const submitDraftArtifact = async () => {
  draftArtifactLoading.value = true;
  draftArtifactError.value = "";
  const isEditingDraft = Boolean(draftArtifactEditId.value);
  try {
    const ownerCedula = currentLoggedUser.value?.cedula ? String(currentLoggedUser.value.cedula).trim() : "";
    const ownerPersonId = currentLoggedUser.value?.id ? String(currentLoggedUser.value.id).trim() : "";
    if (!ownerCedula) {
      throw new Error("No se pudo inferir la cedula del usuario logueado.");
    }
    const form = new FormData();
    form.append("template_seed_id", draftArtifactForm.value.template_seed_id || "");
    form.append("owner_cedula", ownerCedula);
    if (ownerPersonId) {
      form.append("owner_person_id", ownerPersonId);
    }
    form.append("display_name", draftArtifactForm.value.display_name || "");
    form.append("description", draftArtifactForm.value.description || "");
    form.append("source_version", draftArtifactForm.value.source_version || "1.0.0");
    if (draftArtifactFiles.value.pdf) {
      form.append("pdf_file", draftArtifactFiles.value.pdf);
    }
    if (draftArtifactFiles.value.docx) {
      form.append("docx_file", draftArtifactFiles.value.docx);
    }
    if (draftArtifactFiles.value.xlsx) {
      form.append("xlsx_file", draftArtifactFiles.value.xlsx);
    }
    if (draftArtifactFiles.value.pptx) {
      form.append("pptx_file", draftArtifactFiles.value.pptx);
    }

    const requestConfig = {
      headers: {
        "Content-Type": "multipart/form-data"
      }
    };
    const response = isEditingDraft
      ? await axios.put(API_ROUTES.ADMIN_SQL_TEMPLATE_ARTIFACT_DRAFT_UPDATE(draftArtifactEditId.value), form, requestConfig)
      : await axios.post(API_ROUTES.ADMIN_SQL_TEMPLATE_ARTIFACT_DRAFT, form, requestConfig);
    await fetchRows();
    closeDraftArtifactModal();
    showFeedbackToast({
      kind: "success",
      title: isEditingDraft ? "Artifact actualizado" : "Artifact creado",
      message: response.data?.__notice || (isEditingDraft
        ? "El paquete de usuario fue actualizado correctamente."
        : "El paquete de usuario fue creado correctamente.")
    });
  } catch (err) {
    draftArtifactError.value = err?.response?.data?.message || (isEditingDraft
      ? "No se pudo actualizar el paquete de usuario."
      : "No se pudo crear el paquete de usuario.");
  } finally {
    draftArtifactLoading.value = false;
  }
};

const handleGoBack = () => {
  emit("go-back");
};

const openProcessSearch = () => {
  ensureProcessSearchInstance();
  processSearchInstance?.show();
};

const openDocumentSearch = () => {
  ensureDocumentSearchInstance();
  documentSearchInstance?.show();
};

const openUnitPositionSearch = async () => {
  ensureUnitPositionSearchInstance();
  if (!unitPositionUnitTypeOptions.value.length) {
    await loadUnitPositionUnitTypeOptions();
  }
  if (!unitPositionCargoOptions.value.length) {
    await loadUnitPositionCargoOptions();
  }
  if (unitPositionFilters.value.unit_type_id) {
    await loadUnitPositionUnitOptions();
  }
  unitPositionSearchInstance?.show();
};

const applyProcessFilter = async () => {
  await fetchRows();
  processSearchInstance?.hide();
};

const clearProcessFilter = async () => {
  processFilters.value = {
    parent_id: "",
    is_active: ""
  };
  processFilterLabels.value = {
    parent_id: ""
  };
  await fetchRows();
};

const clearProcessParentFilter = () => {
  processFilters.value = {
    ...processFilters.value,
    parent_id: ""
  };
  processFilterLabels.value = {
    ...processFilterLabels.value,
    parent_id: ""
  };
};

const applyTemplateFilter = async () => {
  await fetchRows();
  templateSearchInstance?.hide();
};

const clearTemplateFilter = async () => {
  templateFilters.value = {
    name: "",
    slug: "",
    description: "",
    process_id: ""
  };
  templateFilterLabels.value = {
    process_id: ""
  };
  await fetchRows();
};

const clearTemplateProcessFilter = () => {
  templateFilters.value = {
    ...templateFilters.value,
    process_id: ""
  };
  templateFilterLabels.value = {
    ...templateFilterLabels.value,
    process_id: ""
  };
};

const applyDocumentFilter = async () => {
  await fetchRows();
  documentSearchInstance?.hide();
};

const clearDocumentFilter = async () => {
  documentFilters.value = {
    task_id: "",
    status: ""
  };
  documentFilterLabels.value = {
    task_id: ""
  };
  await fetchRows();
};

const clearDocumentTaskFilter = () => {
  documentFilters.value = {
    ...documentFilters.value,
    task_id: ""
  };
  documentFilterLabels.value = {
    ...documentFilterLabels.value,
    task_id: ""
  };
};

const refreshUnitPositionScope = async () => {
  if (isUnitPositionsTable.value || isPositionAssignmentsTable.value) {
    await fetchRows();
  }
};

const handleUnitPositionTypeChange = async () => {
  unitPositionFilters.value = {
    ...unitPositionFilters.value,
    unit_id: ""
  };
  await loadUnitPositionUnitOptions();
  await refreshUnitPositionScope();
};

const handleUnitPositionUnitChange = async () => {
  await refreshUnitPositionScope();
};

const handleUnitPositionCargoChange = async () => {
  await refreshUnitPositionScope();
};

const applyUnitPositionFilter = async () => {
  await refreshUnitPositionScope();
  unitPositionSearchInstance?.hide();
};

const clearUnitPositionFilter = async () => {
  unitPositionFilters.value = {
    unit_type_id: "",
    unit_id: "",
    cargo_id: ""
  };
  unitPositionUnitOptions.value = [];
  await refreshUnitPositionScope();
};

const clearUnitPositionInlineFilters = async () => {
  unitPositionFilters.value = {
    unit_type_id: "",
    unit_id: "",
    cargo_id: ""
  };
  unitPositionUnitOptions.value = [];
  await refreshUnitPositionScope();
};

const clearVacantPositionFilters = async () => {
  vacantSearchTerm.value = "";
  vacantPositionFilters.value = {
    unit_type_id: "",
    unit_id: "",
    cargo_id: "",
    position_type: ""
  };
  vacantPositionUnitOptions.value = [];
  await loadVacantPositions();
};

const clearUnassignedTemplateArtifactFilters = async () => {
  unassignedTemplateArtifactSearch.value = "";
  unassignedTemplateArtifactFilters.value = {
    is_active: ""
  };
  await loadUnassignedTemplateArtifacts();
};

const handleVacantPositionTypeChange = async () => {
  vacantPositionFilters.value = {
    ...vacantPositionFilters.value,
    unit_id: ""
  };
  await loadVacantPositionUnitOptions();
  await loadVacantPositions();
};

const handleVacantPositionUnitChange = async () => {
  await loadVacantPositions();
};

const handleVacantPositionCargoChange = async () => {
  await loadVacantPositions();
};

const handleVacantPositionTypeFilterChange = async () => {
  await loadVacantPositions();
};

const deactivateVacantPosition = async (row) => {
  const positionId = row?.id;
  if (!positionId) {
    return;
  }
  const confirmed = window.confirm("¿Deseas desactivar este puesto?");
  if (!confirmed) {
    return;
  }
  try {
    await axios.put(API_ROUTES.ADMIN_SQL_TABLE("unit_positions"), {
      keys: { id: positionId },
      data: {
        is_active: 0,
        deactivated_at: new Date().toISOString().slice(0, 19).replace("T", " ")
      }
    });
    await loadVacantPositions();
  } catch (err) {
    vacantPositionError.value = err?.response?.data?.message || "No se pudo desactivar el puesto.";
  }
};

const assignVacantPosition = async (row) => {
  const positionId = row?.id;
  if (!positionId || !isPositionAssignmentsTable.value) {
    return;
  }
  await openCreate();
  formData.value = {
    ...formData.value,
    position_id: String(positionId),
    start_date: formData.value.start_date || toDateInputValue(new Date()),
    is_current: "1"
  };
  await fetchFkLabel("unit_positions", positionId);
  const label = getFkCachedLabel("unit_positions", positionId);
  fkDisplay.value = {
    ...fkDisplay.value,
    position_id: label !== null && label !== undefined ? String(label) : String(positionId)
  };
};

const openTemplateFkSearch = () => {
  openFkSearch({ name: "process_id" }, (row) => {
    const idValue = row.id ?? "";
    templateFilters.value = {
      ...templateFilters.value,
      process_id: idValue
    };
    const displayField = resolveDisplayField(fkTable.value);
    const labelValue = row[displayField] ?? row.id;
    templateFilterLabels.value = {
      process_id: labelValue ? String(labelValue) : ""
    };
  });
};

const openDocumentFkSearch = (fieldName) => {
  if (!fieldName) {
    return;
  }
  openFkSearch({ name: fieldName }, (row) => {
    const idValue = row.id ?? "";
    documentFilters.value = {
      ...documentFilters.value,
      [fieldName]: idValue
    };
    const displayField = resolveDisplayField(fkTable.value);
    const labelValue = row[displayField] ?? row.id;
    documentFilterLabels.value = {
      ...documentFilterLabels.value,
      [fieldName]: labelValue ? String(labelValue) : ""
    };
  });
};

const openProcessFkSearch = (fieldName) => {
  if (!fieldName) {
    return;
  }
  openFkSearch({ name: fieldName }, (row) => {
    const idValue = row.id ?? "";
    processFilters.value = {
      ...processFilters.value,
      [fieldName]: idValue
    };
    const displayField = resolveDisplayField(fkTable.value);
    const labelValue = row[displayField] ?? row.id;
    processFilterLabels.value = {
      ...processFilterLabels.value,
      [fieldName]: labelValue ? String(labelValue) : ""
    };
  });
};

const resetPersonCargoForm = () => {
  personCargoEditId.value = "";
  personCargoForm.value = {
    position_id: "",
    start_date: "",
    end_date: "",
    is_current: "1"
  };
  personCargoLabels.value = {
    position_id: ""
  };
};

const clearPersonCargoPosition = () => {
  personCargoForm.value = {
    ...personCargoForm.value,
    position_id: ""
  };
  personCargoLabels.value = {
    ...personCargoLabels.value,
    position_id: ""
  };
};

const resetPersonRoleForm = () => {
  personRoleEditId.value = "";
  personRoleEditStartDate.value = "";
  personRoleForm.value = {
    role_id: "",
    unit_id: ""
  };
  personRoleLabels.value = {
    role_id: "",
    unit_id: ""
  };
};

const clearPersonRoleField = (fieldName) => {
  if (!["role_id", "unit_id"].includes(fieldName)) {
    return;
  }
  personRoleForm.value = {
    ...personRoleForm.value,
    [fieldName]: ""
  };
  personRoleLabels.value = {
    ...personRoleLabels.value,
    [fieldName]: ""
  };
};

const resetPersonContractForm = () => {
  personContractEditId.value = "";
  personContractForm.value = {
    position_id: "",
    relation_type: "",
    dedication: "",
    start_date: "",
    end_date: "",
    status: "activo"
  };
  personContractLabels.value = {
    position_id: ""
  };
};

const clearPersonContractPosition = () => {
  personContractForm.value = {
    ...personContractForm.value,
    position_id: ""
  };
  personContractLabels.value = {
    ...personContractLabels.value,
    position_id: ""
  };
};

const resetPersonAssignments = () => {
  personEditorId.value = "";
  personAssignmentContext.value = null;
  personAssignmentSection.value = "ocupaciones";
  personAssignmentsLoading.value = false;
  personCargoRows.value = [];
  personCargoUnitByPositionId.value = {};
  personRoleRows.value = [];
  personContractRows.value = [];
  personCargoError.value = "";
  personRoleError.value = "";
  personContractError.value = "";
  resetPersonCargoForm();
  resetPersonRoleForm();
  resetPersonContractForm();
};

const resetDefinitionArtifactsForm = () => {
  definitionArtifactsEditId.value = "";
  definitionArtifactsForm.value = {
    template_artifact_id: "",
    usage_role: "manual_fill",
    creates_task: "1",
    is_required: "1",
    sort_order: "1"
  };
  definitionArtifactsLabels.value = {
    template_artifact_id: ""
  };
};

const resetDefinitionRulesForm = () => {
  definitionRulesEditId.value = "";
  definitionRulesForm.value = {
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
  definitionRulesLabels.value = {
    unit_id: "",
    unit_type_id: "",
    cargo_id: "",
    position_id: ""
  };
};

const resetDefinitionTriggersForm = () => {
  definitionTriggersEditId.value = "";
  definitionTriggersForm.value = {
    trigger_mode: "automatic_by_term_type",
    term_type_id: "",
    is_active: "1"
  };
  definitionTriggersLabels.value = {
    term_type_id: ""
  };
};

const formatDefinitionRuleSummary = (row) => {
  if (!row) {
    return "—";
  }
  const scopeType = String(row.unit_scope_type || "");
  if (scopeType === "all_units") {
    return "Todas las unidades";
  }
  if (scopeType === "unit_type") {
    return formatCell(row.unit_type_id, { name: "unit_type_id" }, row);
  }
  const primaryLabel = row.position_id
    ? formatCell(row.position_id, { name: "position_id" }, row)
    : formatCell(row.unit_id, { name: "unit_id" }, row);
  const cargoLabel = row.cargo_id ? formatCell(row.cargo_id, { name: "cargo_id" }, row) : "";
  return cargoLabel ? `${primaryLabel} | ${cargoLabel}` : primaryLabel;
};

const handleDefinitionRuleScopeChange = () => {
  const scopeType = String(definitionRulesForm.value.unit_scope_type || "");
  if (scopeType === "unit_type") {
    definitionRulesForm.value = {
      ...definitionRulesForm.value,
      unit_id: "",
      position_id: "",
      include_descendants: "0"
    };
    definitionRulesLabels.value = {
      ...definitionRulesLabels.value,
      unit_id: "",
      position_id: ""
    };
    return;
  }
  if (scopeType === "all_units") {
    definitionRulesForm.value = {
      ...definitionRulesForm.value,
      unit_id: "",
      unit_type_id: "",
      position_id: "",
      include_descendants: "0"
    };
    definitionRulesLabels.value = {
      ...definitionRulesLabels.value,
      unit_id: "",
      unit_type_id: "",
      position_id: ""
    };
    return;
  }
  definitionRulesForm.value = {
    ...definitionRulesForm.value,
    unit_type_id: ""
  };
  definitionRulesLabels.value = {
    ...definitionRulesLabels.value,
    unit_type_id: ""
  };
};

const loadDefinitionRules = async () => {
  const definitionId = definitionRulesContext.value?.id;
  if (!definitionId) {
    definitionRulesRows.value = [];
    definitionRulesError.value = "";
    definitionRulesLoading.value = false;
    return;
  }
  definitionRulesLoading.value = true;
  definitionRulesError.value = "";
  try {
    const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE("process_target_rules"), {
      params: {
        filter_process_definition_id: definitionId,
        orderBy: "priority",
        order: "asc",
        limit: 200
      }
    });
    definitionRulesRows.value = response.data || [];
    await prefetchFkLabelsForRows(definitionRulesRows.value, ["unit_id", "unit_type_id", "cargo_id", "position_id"]);
  } catch (error) {
    definitionRulesRows.value = [];
    definitionRulesError.value = "No se pudieron cargar las reglas vinculadas.";
  } finally {
    definitionRulesLoading.value = false;
  }
  await refreshProcessDefinitionChecklist(definitionRulesContext.value);
};

const openDefinitionRulesManager = async (definitionRow) => {
  if (!definitionRow?.id) {
    return;
  }
  definitionRulesContext.value = {
    ...definitionRow
  };
  definitionRulesError.value = "";
  resetDefinitionRulesForm();
  ensureDefinitionRulesInstance();
  definitionRulesInstance?.show();
  await loadDefinitionRules();
};

const closeDefinitionRulesManager = () => {
  clearModalOrigins();
  definitionRulesInstance?.hide();
};

const acceptDefinitionRulesManager = () => {
  definitionRulesInstance?.hide();
};

const confirmDefinitionRulesPrompt = async () => {
  const context = definitionArtifactsPromptContext.value;
  closeDefinitionArtifactsPrompt();
  if (context?.id) {
    await openDefinitionRulesManager(context);
  }
};

const openDefinitionRulesFromEditor = async () => {
  if (props.table?.table !== "process_definition_versions" || editorMode.value !== "edit" || !selectedRow.value?.id) {
    return;
  }
  clearModalOrigins();
  pushModalOrigin("editor");
  editorInstance?.hide();
  await openDefinitionRulesManager(selectedRow.value);
};

const openDefinitionRulesFromActivation = async () => {
  const context = selectedRow.value;
  clearModalOrigins();
  pushModalOrigin("definitionActivation");
  closeProcessDefinitionActivationModal();
  if (context?.id) {
    await openDefinitionRulesManager(context);
  }
};

const openDefinitionArtifactsFromActivation = async () => {
  const context = selectedRow.value;
  clearModalOrigins();
  pushModalOrigin("definitionActivation");
  closeProcessDefinitionActivationModal();
  if (context?.id) {
    await openDefinitionArtifactsManager(context);
  }
};

const openDefinitionRuleFkSearch = (fieldName) => {
  if (!fieldName) {
    return;
  }
  openFkSearch({ name: fieldName }, async (row) => {
    const idValue = row.id ?? "";
    definitionRulesForm.value = {
      ...definitionRulesForm.value,
      [fieldName]: idValue ? String(idValue) : ""
    };
    definitionRulesLabels.value = {
      ...definitionRulesLabels.value,
      [fieldName]: formatFkOptionLabel(resolveFkTable(fieldName), row)
    };
    if (fieldName === "position_id" && idValue) {
      try {
        const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE("unit_positions"), {
          params: { filter_id: idValue, limit: 1 }
        });
        const positionRow = response.data?.[0];
        if (positionRow?.unit_id) {
          await fetchFkLabel("units", positionRow.unit_id);
          definitionRulesForm.value = {
            ...definitionRulesForm.value,
            unit_id: String(positionRow.unit_id)
          };
          definitionRulesLabels.value = {
            ...definitionRulesLabels.value,
            unit_id: String(getFkCachedLabel("units", positionRow.unit_id) || positionRow.unit_id)
          };
        }
        if (positionRow?.cargo_id) {
          await fetchFkLabel("cargos", positionRow.cargo_id);
          definitionRulesForm.value = {
            ...definitionRulesForm.value,
            cargo_id: String(positionRow.cargo_id)
          };
          definitionRulesLabels.value = {
            ...definitionRulesLabels.value,
            cargo_id: String(getFkCachedLabel("cargos", positionRow.cargo_id) || positionRow.cargo_id)
          };
        }
      } catch {
        // Best-effort autofill.
      }
    }
  });
};

const clearDefinitionRuleField = (fieldName) => {
  if (!fieldName) {
    return;
  }
  definitionRulesForm.value = {
    ...definitionRulesForm.value,
    [fieldName]: ""
  };
  if (Object.prototype.hasOwnProperty.call(definitionRulesLabels.value, fieldName)) {
    definitionRulesLabels.value = {
      ...definitionRulesLabels.value,
      [fieldName]: ""
    };
  }
};

const startDefinitionRuleEdit = (row) => {
  if (!row) {
    return;
  }
  if (!canManageDefinitionRules.value) {
    definitionRulesError.value = "Solo puedes modificar reglas mientras la definicion este en draft.";
    return;
  }
  definitionRulesEditId.value = row.id ? String(row.id) : "";
  definitionRulesForm.value = {
    unit_scope_type: row.unit_scope_type || "unit_exact",
    unit_id: row.unit_id ? String(row.unit_id) : "",
    unit_type_id: row.unit_type_id ? String(row.unit_type_id) : "",
    include_descendants: Number(row.include_descendants) === 1 ? "1" : "0",
    cargo_id: row.cargo_id ? String(row.cargo_id) : "",
    position_id: row.position_id ? String(row.position_id) : "",
    recipient_policy: row.recipient_policy || "all_matches",
    priority: row.priority !== null && row.priority !== undefined ? String(row.priority) : "1",
    is_active: Number(row.is_active) === 1 ? "1" : "0",
    effective_from: row.effective_from ? formatDateOnly(row.effective_from) : "",
    effective_to: row.effective_to ? formatDateOnly(row.effective_to) : ""
  };
  definitionRulesLabels.value = {
    unit_id: row.unit_id ? String(getFkCachedLabel("units", row.unit_id) || row.unit_id) : "",
    unit_type_id: row.unit_type_id ? String(getFkCachedLabel("unit_types", row.unit_type_id) || row.unit_type_id) : "",
    cargo_id: row.cargo_id ? String(getFkCachedLabel("cargos", row.cargo_id) || row.cargo_id) : "",
    position_id: row.position_id ? String(getFkCachedLabel("unit_positions", row.position_id) || row.position_id) : ""
  };
};

const submitDefinitionRule = async () => {
  const definitionId = definitionRulesContext.value?.id;
  if (!definitionId) {
    definitionRulesError.value = "No hay una definicion seleccionada.";
    return;
  }
  if (!canManageDefinitionRules.value) {
    definitionRulesError.value = "Solo puedes modificar reglas mientras la definicion este en draft.";
    return;
  }
  if (!canSubmitDefinitionRule.value) {
    definitionRulesError.value = "Completa el alcance requerido para guardar la regla.";
    return;
  }
  const payload = {
    process_definition_id: Number(definitionId),
    unit_scope_type: definitionRulesForm.value.unit_scope_type || "unit_exact",
    unit_id: definitionRulesForm.value.unit_id ? Number(definitionRulesForm.value.unit_id) : null,
    unit_type_id: definitionRulesForm.value.unit_type_id ? Number(definitionRulesForm.value.unit_type_id) : null,
    include_descendants: Number(definitionRulesForm.value.include_descendants) === 1 ? 1 : 0,
    cargo_id: definitionRulesForm.value.cargo_id ? Number(definitionRulesForm.value.cargo_id) : null,
    position_id: definitionRulesForm.value.position_id ? Number(definitionRulesForm.value.position_id) : null,
    recipient_policy: definitionRulesForm.value.recipient_policy || "all_matches",
    priority: Number(definitionRulesForm.value.priority || 1) || 1,
    is_active: Number(definitionRulesForm.value.is_active) === 1 ? 1 : 0,
    effective_from: definitionRulesForm.value.effective_from || null,
    effective_to: definitionRulesForm.value.effective_to || null
  };

  definitionRulesError.value = "";
  try {
    if (definitionRulesEditId.value) {
      await axios.put(API_ROUTES.ADMIN_SQL_TABLE("process_target_rules"), {
        keys: { id: Number(definitionRulesEditId.value) },
        data: payload
      });
    } else {
      await axios.post(API_ROUTES.ADMIN_SQL_TABLE("process_target_rules"), payload);
    }
    resetDefinitionRulesForm();
    await loadDefinitionRules();
  } catch (error) {
    definitionRulesError.value = error?.response?.data?.message || "No se pudo guardar la regla.";
  }
};

const deleteDefinitionRule = async (row) => {
  if (!row?.id) {
    return;
  }
  if (!canManageDefinitionRules.value) {
    definitionRulesError.value = "Solo puedes modificar reglas mientras la definicion este en draft.";
    return;
  }
  const confirmed = window.confirm("¿Deseas eliminar esta regla de la definicion?");
  if (!confirmed) {
    return;
  }
  definitionRulesError.value = "";
  try {
    await axios.delete(API_ROUTES.ADMIN_SQL_TABLE("process_target_rules"), {
      data: {
        keys: { id: row.id }
      }
    });
    if (String(definitionRulesEditId.value) === String(row.id)) {
      resetDefinitionRulesForm();
    }
    await loadDefinitionRules();
  } catch (error) {
    definitionRulesError.value = error?.response?.data?.message || "No se pudo eliminar la regla.";
  }
};

const checkDefinitionHasActiveRules = async (definitionId) => {
  if (!definitionId) {
    return false;
  }
  const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE("process_target_rules"), {
    params: {
      filter_process_definition_id: definitionId,
      filter_is_active: 1,
      limit: 1
    }
  });
  return Array.isArray(response.data) && response.data.length > 0;
};

const checkDefinitionHasActiveTriggers = async (definitionId) => {
  if (!definitionId) {
    return false;
  }
  const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE("process_definition_triggers"), {
    params: {
      filter_process_definition_id: definitionId,
      filter_is_active: 1,
      limit: 1
    }
  });
  return Array.isArray(response.data) && response.data.length > 0;
};

const checkDefinitionHasArtifactsForActivation = async (definitionId) => {
  if (!definitionId) {
    return false;
  }
  const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE("process_definition_templates"), {
    params: {
      filter_process_definition_id: definitionId,
      limit: 1
    }
  });
  return Array.isArray(response.data) && response.data.length > 0;
};

const refreshProcessDefinitionChecklist = async (definitionRow = selectedRow.value) => {
  const definitionId = definitionRow?.id;
  processDefinitionChecklistLoading.value = true;
  processDefinitionChecklist.value = {
    rules: false,
    triggers: false,
    artifacts: false
  };
  if (!definitionId) {
    processDefinitionChecklistLoading.value = false;
    return;
  }
  try {
    const [hasRules, hasTriggers, hasArtifacts] = await Promise.all([
      checkDefinitionHasActiveRules(definitionId),
      checkDefinitionHasActiveTriggers(definitionId),
      checkDefinitionHasArtifactsForActivation(definitionId)
    ]);
    processDefinitionChecklist.value = {
      rules: hasRules,
      triggers: hasTriggers,
      artifacts: hasArtifacts
    };
  } catch {
    processDefinitionChecklist.value = {
      rules: false,
      triggers: false,
      artifacts: false
    };
  } finally {
    processDefinitionChecklistLoading.value = false;
  }
};

const loadDefinitionTriggers = async () => {
  const definitionId = definitionTriggersContext.value?.id;
  if (!definitionId) {
    definitionTriggersRows.value = [];
    definitionTriggersError.value = "";
    definitionTriggersLoading.value = false;
    return;
  }
  definitionTriggersLoading.value = true;
  definitionTriggersError.value = "";
  try {
    const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE("process_definition_triggers"), {
      params: {
        filter_process_definition_id: definitionId,
        orderBy: "created_at",
        order: "desc",
        limit: 200
      }
    });
    definitionTriggersRows.value = response.data || [];
    await prefetchFkLabelsForRows(definitionTriggersRows.value, ["term_type_id"]);
  } catch (error) {
    definitionTriggersRows.value = [];
    definitionTriggersError.value = "No se pudieron cargar los disparadores vinculados.";
  } finally {
    definitionTriggersLoading.value = false;
  }
};

const openDefinitionTriggersManager = async (definitionRow) => {
  if (!definitionRow?.id) {
    return;
  }
  definitionTriggersContext.value = {
    ...definitionRow
  };
  definitionTriggersError.value = "";
  resetDefinitionTriggersForm();
  ensureDefinitionTriggersInstance();
  definitionTriggersInstance?.show();
  await loadDefinitionTriggers();
};

const closeDefinitionTriggersManager = () => {
  clearModalOrigins();
  definitionTriggersInstance?.hide();
};

const acceptDefinitionTriggersManager = () => {
  definitionTriggersInstance?.hide();
};

const confirmDefinitionTriggersPrompt = async () => {
  const context = definitionArtifactsPromptContext.value;
  closeDefinitionArtifactsPrompt();
  if (context?.id) {
    await openDefinitionTriggersManager(context);
  }
};

const openDefinitionTriggersFromEditor = async () => {
  if (props.table?.table !== "process_definition_versions" || editorMode.value !== "edit" || !selectedRow.value?.id) {
    return;
  }
  clearModalOrigins();
  pushModalOrigin("editor");
  editorInstance?.hide();
  await openDefinitionTriggersManager(selectedRow.value);
};

const openDefinitionTriggersFromActivation = async () => {
  const context = selectedRow.value;
  clearModalOrigins();
  pushModalOrigin("definitionActivation");
  closeProcessDefinitionActivationModal();
  if (context?.id) {
    await openDefinitionTriggersManager(context);
  }
};

const handleDefinitionTriggerModeChange = () => {
  if (!definitionTriggerRequiresTermType.value) {
    definitionTriggersForm.value = {
      ...definitionTriggersForm.value,
      term_type_id: ""
    };
    definitionTriggersLabels.value = {
      ...definitionTriggersLabels.value,
      term_type_id: ""
    };
  }
};

const openDefinitionTriggerFkSearch = () => {
  openFkSearch({ name: "term_type_id" }, (row) => {
    const idValue = row.id ?? "";
    definitionTriggersForm.value = {
      ...definitionTriggersForm.value,
      term_type_id: idValue ? String(idValue) : ""
    };
    definitionTriggersLabels.value = {
      ...definitionTriggersLabels.value,
      term_type_id: formatFkOptionLabel("term_types", row)
    };
  });
};

const clearDefinitionTriggerTermType = () => {
  definitionTriggersForm.value = {
    ...definitionTriggersForm.value,
    term_type_id: ""
  };
  definitionTriggersLabels.value = {
    ...definitionTriggersLabels.value,
    term_type_id: ""
  };
};

const startDefinitionTriggerEdit = (row) => {
  if (!row) {
    return;
  }
  if (!canManageDefinitionTriggers.value) {
    definitionTriggersError.value = "Solo puedes modificar disparadores mientras la definicion este en draft.";
    return;
  }
  definitionTriggersEditId.value = row.id ? String(row.id) : "";
  definitionTriggersForm.value = {
    trigger_mode: row.trigger_mode || "automatic_by_term_type",
    term_type_id: row.term_type_id ? String(row.term_type_id) : "",
    is_active: Number(row.is_active) === 1 ? "1" : "0"
  };
  definitionTriggersLabels.value = {
    term_type_id: row.term_type_id
      ? String(getFkCachedLabel("term_types", row.term_type_id) || row.term_type_id)
      : ""
  };
};

const submitDefinitionTrigger = async () => {
  const definitionId = definitionTriggersContext.value?.id;
  if (!definitionId) {
    definitionTriggersError.value = "No hay una definicion seleccionada.";
    return;
  }
  if (!canManageDefinitionTriggers.value) {
    definitionTriggersError.value = "Solo puedes modificar disparadores mientras la definicion este en draft.";
    return;
  }
  if (!canSubmitDefinitionTrigger.value) {
    definitionTriggersError.value = "Selecciona el tipo de periodo requerido para este disparador.";
    return;
  }
  const payload = {
    process_definition_id: Number(definitionId),
    trigger_mode: definitionTriggersForm.value.trigger_mode || "automatic_by_term_type",
    term_type_id: definitionTriggerRequiresTermType.value && definitionTriggersForm.value.term_type_id
      ? Number(definitionTriggersForm.value.term_type_id)
      : null,
    is_active: Number(definitionTriggersForm.value.is_active) === 1 ? 1 : 0
  };

  definitionTriggersError.value = "";
  try {
    if (definitionTriggersEditId.value) {
      await axios.put(API_ROUTES.ADMIN_SQL_TABLE("process_definition_triggers"), {
        keys: { id: Number(definitionTriggersEditId.value) },
        data: payload
      });
    } else {
      await axios.post(API_ROUTES.ADMIN_SQL_TABLE("process_definition_triggers"), payload);
    }
    resetDefinitionTriggersForm();
    await loadDefinitionTriggers();
    await refreshProcessDefinitionChecklist(definitionTriggersContext.value);
  } catch (error) {
    definitionTriggersError.value = error?.response?.data?.message || "No se pudo guardar el disparador.";
  }
};

const deleteDefinitionTrigger = async (row) => {
  if (!row?.id) {
    return;
  }
  if (!canManageDefinitionTriggers.value) {
    definitionTriggersError.value = "Solo puedes modificar disparadores mientras la definicion este en draft.";
    return;
  }
  const confirmed = window.confirm("¿Deseas eliminar este disparador de la definicion?");
  if (!confirmed) {
    return;
  }
  definitionTriggersError.value = "";
  try {
    await axios.delete(API_ROUTES.ADMIN_SQL_TABLE("process_definition_triggers"), {
      data: {
        keys: { id: row.id }
      }
    });
    if (String(definitionTriggersEditId.value) === String(row.id)) {
      resetDefinitionTriggersForm();
    }
    await loadDefinitionTriggers();
    await refreshProcessDefinitionChecklist(definitionTriggersContext.value);
  } catch (error) {
    definitionTriggersError.value = error?.response?.data?.message || "No se pudo eliminar el disparador.";
  }
};

const loadDefinitionArtifacts = async () => {
  const definitionId = definitionArtifactsContext.value?.id;
  if (!definitionId) {
    definitionArtifactsRows.value = [];
    definitionArtifactsError.value = "";
    definitionArtifactsLoading.value = false;
    return;
  }
  definitionArtifactsLoading.value = true;
  definitionArtifactsError.value = "";
  try {
    const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE("process_definition_templates"), {
      params: {
        filter_process_definition_id: definitionId,
        orderBy: "sort_order",
        order: "asc",
        limit: 200
      }
    });
    definitionArtifactsRows.value = response.data || [];
    await prefetchFkLabelsForRows(definitionArtifactsRows.value, ["template_artifact_id"]);
  } catch (error) {
    definitionArtifactsRows.value = [];
    definitionArtifactsError.value = "No se pudieron cargar los artifacts vinculados.";
  } finally {
    definitionArtifactsLoading.value = false;
  }
  await refreshProcessDefinitionChecklist(definitionArtifactsContext.value);
};

const openDefinitionArtifactsManager = async (definitionRow) => {
  if (!definitionRow?.id) {
    return;
  }
  definitionArtifactsContext.value = {
    ...definitionRow
  };
  definitionArtifactsError.value = "";
  resetDefinitionArtifactsForm();
  ensureDefinitionArtifactsInstance();
  definitionArtifactsInstance?.show();
  await loadDefinitionArtifacts();
};

const closeDefinitionArtifactsManager = () => {
  clearModalOrigins();
  definitionArtifactsInstance?.hide();
};

const acceptDefinitionArtifactsManager = () => {
  definitionArtifactsInstance?.hide();
};

const openDefinitionArtifactsPrompt = (definitionRow) => {
  if (!definitionRow?.id) {
    return;
  }
  definitionArtifactsPromptContext.value = { ...definitionRow };
  ensureDefinitionArtifactsPromptInstance();
  definitionArtifactsPromptInstance?.show();
};

const closeDefinitionArtifactsPrompt = () => {
  definitionArtifactsPromptInstance?.hide();
  definitionArtifactsPromptContext.value = null;
};

const confirmDefinitionArtifactsPrompt = async () => {
  const context = definitionArtifactsPromptContext.value;
  closeDefinitionArtifactsPrompt();
  if (context?.id) {
    await openDefinitionArtifactsManager(context);
  }
};

const openDefinitionArtifactsFromEditor = async () => {
  if (props.table?.table !== "process_definition_versions" || editorMode.value !== "edit" || !selectedRow.value?.id) {
    return;
  }
  clearModalOrigins();
  pushModalOrigin("editor");
  editorInstance?.hide();
  await openDefinitionArtifactsManager(selectedRow.value);
};

const openDefinitionArtifactFkSearch = () => {
  openFkSearch({ name: "template_artifact_id" }, (row) => {
    const idValue = row.id ?? "";
    definitionArtifactsForm.value = {
      ...definitionArtifactsForm.value,
      template_artifact_id: idValue ? String(idValue) : ""
    };
    const labelValue = formatFkOptionLabel("template_artifacts", row);
    definitionArtifactsLabels.value = {
      ...definitionArtifactsLabels.value,
      template_artifact_id: labelValue ? String(labelValue) : ""
    };
  });
};

const clearDefinitionArtifactSelection = () => {
  definitionArtifactsForm.value = {
    ...definitionArtifactsForm.value,
    template_artifact_id: ""
  };
  definitionArtifactsLabels.value = {
    ...definitionArtifactsLabels.value,
    template_artifact_id: ""
  };
};

const startDefinitionArtifactEdit = (row) => {
  if (!row) {
    return;
  }
  if (!canManageDefinitionArtifacts.value) {
    definitionArtifactsError.value = "Solo puedes modificar artifacts mientras la definicion este en draft.";
    return;
  }
  definitionArtifactsEditId.value = row.id ? String(row.id) : "";
  definitionArtifactsForm.value = {
    template_artifact_id: row.template_artifact_id ? String(row.template_artifact_id) : "",
    usage_role: row.usage_role || "manual_fill",
    creates_task: Number(row.creates_task) === 1 ? "1" : "0",
    is_required: Number(row.is_required) === 1 ? "1" : "0",
    sort_order: row.sort_order !== null && row.sort_order !== undefined ? String(row.sort_order) : "1"
  };
  definitionArtifactsLabels.value = {
    template_artifact_id: row.template_artifact_id
      ? String(getFkCachedLabel("template_artifacts", row.template_artifact_id) || row.template_artifact_id)
      : ""
  };
};

const submitDefinitionArtifact = async () => {
  const definitionId = definitionArtifactsContext.value?.id;
  if (!definitionId) {
    definitionArtifactsError.value = "No hay una definicion seleccionada.";
    return;
  }
  if (!canManageDefinitionArtifacts.value) {
    definitionArtifactsError.value = "Solo puedes modificar artifacts mientras la definicion este en draft.";
    return;
  }
  if (!definitionArtifactsForm.value.template_artifact_id) {
    definitionArtifactsError.value = "Selecciona un artifact.";
    return;
  }
  const payload = {
    process_definition_id: Number(definitionId),
    template_artifact_id: Number(definitionArtifactsForm.value.template_artifact_id),
    usage_role: definitionArtifactsForm.value.usage_role || "manual_fill",
    creates_task: Number(definitionArtifactsForm.value.creates_task) === 1 ? 1 : 0,
    is_required: Number(definitionArtifactsForm.value.is_required) === 1 ? 1 : 0,
    sort_order: Number(definitionArtifactsForm.value.sort_order || 1) || 1
  };

  definitionArtifactsError.value = "";
  try {
    if (definitionArtifactsEditId.value) {
      await axios.put(API_ROUTES.ADMIN_SQL_TABLE("process_definition_templates"), {
        keys: { id: Number(definitionArtifactsEditId.value) },
        data: payload
      });
    } else {
      await axios.post(API_ROUTES.ADMIN_SQL_TABLE("process_definition_templates"), payload);
    }
    resetDefinitionArtifactsForm();
    await loadDefinitionArtifacts();
  } catch (error) {
    definitionArtifactsError.value = error?.response?.data?.message || "No se pudo guardar el artifact.";
  }
};

const deleteDefinitionArtifact = async (row) => {
  if (!row?.id) {
    return;
  }
  if (!canManageDefinitionArtifacts.value) {
    definitionArtifactsError.value = "Solo puedes modificar artifacts mientras la definicion este en draft.";
    return;
  }
  const confirmed = window.confirm("¿Deseas eliminar este artifact de la definicion?");
  if (!confirmed) {
    return;
  }
  definitionArtifactsError.value = "";
  try {
    await axios.delete(API_ROUTES.ADMIN_SQL_TABLE("process_definition_templates"), {
      data: {
        keys: { id: row.id }
      }
    });
    if (String(definitionArtifactsEditId.value) === String(row.id)) {
      resetDefinitionArtifactsForm();
    }
    await loadDefinitionArtifacts();
  } catch (error) {
    definitionArtifactsError.value = error?.response?.data?.message || "No se pudo eliminar el artifact.";
  }
};

const loadPersonAssignments = async (personId) => {
  if (!personId) {
    resetPersonAssignments();
    return;
  }
  personEditorId.value = String(personId);
  personAssignmentsLoading.value = true;
  personCargoError.value = "";
  personRoleError.value = "";
  personContractError.value = "";
  try {
    const [cargoRes, roleRes, contractRes] = await Promise.all([
      axios.get(API_ROUTES.ADMIN_SQL_TABLE("position_assignments"), {
        params: { filter_person_id: personId, orderBy: "start_date", order: "desc", limit: 200 }
      }),
      axios.get(API_ROUTES.ADMIN_SQL_TABLE("role_assignments"), {
        params: { filter_person_id: personId, orderBy: "assigned_at", order: "desc", limit: 200 }
      }),
      axios.get(API_ROUTES.ADMIN_SQL_TABLE("contracts"), {
        params: { filter_person_id: personId, orderBy: "start_date", order: "desc", limit: 200 }
      })
    ]);
    personCargoRows.value = cargoRes.data || [];
    personRoleRows.value = roleRes.data || [];
    personContractRows.value = contractRes.data || [];
    await prefetchFkLabelsForRows(personCargoRows.value, ["position_id"]);
    await prefetchPersonCargoUnitLabels(personCargoRows.value);
    await prefetchFkLabelsForRows(personRoleRows.value, ["role_id", "unit_id"]);
    await prefetchFkLabelsForRows(personContractRows.value, ["position_id"]);
  } catch (error) {
    personCargoError.value = personCargoError.value || "No se pudo cargar ocupaciones.";
    personRoleError.value = personRoleError.value || "No se pudo cargar roles.";
    personContractError.value = personContractError.value || "No se pudo cargar contratos.";
  } finally {
    personAssignmentsLoading.value = false;
  }
};

const prefetchPersonCargoUnitLabels = async (rowsToScan) => {
  if (!rowsToScan?.length) {
    personCargoUnitByPositionId.value = {};
    return;
  }
  const positionIds = Array.from(
    new Set(
      rowsToScan
        .map((row) => row?.position_id)
        .filter((value) => value !== null && value !== undefined && value !== "")
    )
  );
  if (!positionIds.length) {
    personCargoUnitByPositionId.value = {};
    return;
  }

  const resolved = await Promise.all(
    positionIds.map(async (positionId) => {
      try {
        const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE("unit_positions"), {
          params: { filter_id: positionId, limit: 1 }
        });
        const unitId = response.data?.[0]?.unit_id;
        if (unitId !== null && unitId !== undefined && unitId !== "") {
          await fetchFkLabel("units", unitId);
        }
        const unitLabel = unitId ? getFkCachedLabel("units", unitId) : null;
        return {
          positionId: String(positionId),
          label: unitLabel ? String(unitLabel) : "—"
        };
      } catch (error) {
        return {
          positionId: String(positionId),
          label: "—"
        };
      }
    })
  );

  const map = {};
  resolved.forEach(({ positionId, label }) => {
    map[positionId] = label;
  });
  personCargoUnitByPositionId.value = map;
};

const formatPersonCargoUnit = (row) => {
  const positionId = row?.position_id;
  if (positionId === null || positionId === undefined || positionId === "") {
    return "—";
  }
  return personCargoUnitByPositionId.value[String(positionId)] || "—";
};

const openPersonAssignments = async (row) => {
  if (!row?.id) {
    return;
  }
  personAssignmentSection.value = "ocupaciones";
  personCargoError.value = "";
  personRoleError.value = "";
  personContractError.value = "";
  resetPersonCargoForm();
  resetPersonRoleForm();
  resetPersonContractForm();
  personAssignmentContext.value = buildPersonAssignmentContext(row);
  ensurePersonAssignmentsInstance();
  personAssignmentsInstance?.show();
  await loadPersonAssignments(row.id);
};

const openPersonCargoFkSearch = (fieldName) => {
  if (!fieldName) {
    return;
  }
  openFkSearch({ name: fieldName }, (row) => {
    const idValue = row.id ?? "";
    personCargoForm.value = {
      ...personCargoForm.value,
      [fieldName]: idValue ? String(idValue) : ""
    };
    const displayField = resolveDisplayField(fkTable.value);
    const labelValue = row[displayField] ?? row.id;
    personCargoLabels.value = {
      ...personCargoLabels.value,
      [fieldName]: labelValue ? String(labelValue) : ""
    };
  });
};

const openPersonRoleFkSearch = (fieldName) => {
  if (!fieldName) {
    return;
  }
  openFkSearch({ name: fieldName }, (row) => {
    const idValue = row.id ?? "";
    personRoleForm.value = {
      ...personRoleForm.value,
      [fieldName]: idValue ? String(idValue) : ""
    };
    const displayField = resolveDisplayField(fkTable.value);
    const labelValue = row[displayField] ?? row.id;
    personRoleLabels.value = {
      ...personRoleLabels.value,
      [fieldName]: labelValue ? String(labelValue) : ""
    };
  });
};

const openPersonContractFkSearch = () => {
  openFkSearch({ name: "position_id" }, (row) => {
    const idValue = row.id ?? "";
    personContractForm.value = {
      ...personContractForm.value,
      position_id: idValue ? String(idValue) : ""
    };
    const displayField = resolveDisplayField(fkTable.value);
    const labelValue = row[displayField] ?? row.id;
    personContractLabels.value = {
      position_id: labelValue ? String(labelValue) : ""
    };
  });
};

const startPersonCargoEdit = (row) => {
  if (!row) {
    return;
  }
  personCargoError.value = "";
  personCargoEditId.value = row.id ? String(row.id) : "";
  personCargoForm.value = {
    position_id: row.position_id ? String(row.position_id) : "",
    start_date: toDateInputValue(row.start_date),
    end_date: toDateInputValue(row.end_date),
    is_current: Number(row.is_current) === 1 ? "1" : "0"
  };
  const labelValue = formatCell(row.position_id, { name: "position_id" });
  personCargoLabels.value = {
    position_id: labelValue === "—" ? "" : String(labelValue)
  };
};

const startPersonRoleEdit = (row) => {
  if (!row) {
    return;
  }
  personRoleError.value = "";
  personRoleEditId.value = row.id ? String(row.id) : "";
  personRoleEditStartDate.value = toDateInputValue(row.start_date) || new Date().toISOString().slice(0, 10);
  personRoleForm.value = {
    role_id: row.role_id ? String(row.role_id) : "",
    unit_id: row.unit_id ? String(row.unit_id) : ""
  };
  const roleLabel = formatCell(row.role_id, { name: "role_id" });
  const unitLabel = formatCell(row.unit_id, { name: "unit_id" });
  personRoleLabels.value = {
    role_id: roleLabel === "—" ? "" : String(roleLabel),
    unit_id: unitLabel === "—" ? "" : String(unitLabel)
  };
};

const startPersonContractEdit = (row) => {
  if (!row) {
    return;
  }
  personContractError.value = "";
  personContractEditId.value = row.id ? String(row.id) : "";
  personContractForm.value = {
    position_id: row.position_id ? String(row.position_id) : "",
    relation_type: row.relation_type ? String(row.relation_type) : "",
    dedication: row.dedication ? String(row.dedication) : "",
    start_date: toDateInputValue(row.start_date),
    end_date: toDateInputValue(row.end_date),
    status: row.status ? String(row.status) : "activo"
  };
  const positionLabel = formatCell(row.position_id, { name: "position_id" });
  personContractLabels.value = {
    position_id: positionLabel === "—" ? "" : String(positionLabel)
  };
};

const deletePersonCargo = async (row) => {
  if (!personEditorId.value || !row?.id) {
    return;
  }
  const shouldDelete = window.confirm("¿Eliminar esta ocupacion?");
  if (!shouldDelete) {
    return;
  }
  personCargoError.value = "";
  try {
    await axios.delete(API_ROUTES.ADMIN_SQL_TABLE("position_assignments"), {
      data: { keys: { id: Number(row.id) } }
    });
    await loadPersonAssignments(personEditorId.value);
    if (personCargoEditId.value && String(personCargoEditId.value) === String(row.id)) {
      resetPersonCargoForm();
    }
  } catch (err) {
    personCargoError.value = err?.response?.data?.message || "No se pudo eliminar la ocupacion.";
  }
};

const deletePersonRole = async (row) => {
  if (!personEditorId.value || !row?.id) {
    return;
  }
  const shouldDelete = window.confirm("¿Eliminar este rol?");
  if (!shouldDelete) {
    return;
  }
  personRoleError.value = "";
  try {
    await axios.delete(API_ROUTES.ADMIN_SQL_TABLE("role_assignments"), {
      data: { keys: { id: Number(row.id) } }
    });
    await loadPersonAssignments(personEditorId.value);
    if (personRoleEditId.value && String(personRoleEditId.value) === String(row.id)) {
      resetPersonRoleForm();
    }
  } catch (err) {
    personRoleError.value = err?.response?.data?.message || "No se pudo eliminar el rol.";
  }
};

const deletePersonContract = async (row) => {
  if (!personEditorId.value || !row?.id) {
    return;
  }
  const shouldDelete = window.confirm("¿Eliminar este contrato?");
  if (!shouldDelete) {
    return;
  }
  personContractError.value = "";
  try {
    await axios.delete(API_ROUTES.ADMIN_SQL_TABLE("contracts"), {
      data: { keys: { id: Number(row.id) } }
    });
    await loadPersonAssignments(personEditorId.value);
    if (personContractEditId.value && String(personContractEditId.value) === String(row.id)) {
      resetPersonContractForm();
    }
  } catch (err) {
    personContractError.value = err?.response?.data?.message || "No se pudo eliminar el contrato.";
  }
};

const submitPersonCargoCreate = async () => {
  if (!personEditorId.value) {
    personCargoError.value = "Guarda el usuario antes de asignar ocupaciones.";
    return;
  }
  personCargoError.value = "";
  const payload = {
    person_id: Number(personEditorId.value),
    position_id: personCargoForm.value.position_id ? Number(personCargoForm.value.position_id) : null,
    start_date: personCargoForm.value.start_date,
    end_date: personCargoForm.value.end_date || null,
    is_current: Number(personCargoForm.value.is_current) === 1 ? 1 : 0
  };
  if (!payload.position_id) {
    personCargoError.value = "Selecciona un puesto.";
    return;
  }
  if (!payload.start_date) {
    personCargoError.value = "Selecciona la fecha de inicio.";
    return;
  }
  try {
    if (personCargoEditId.value) {
      await axios.put(API_ROUTES.ADMIN_SQL_TABLE("position_assignments"), {
        keys: { id: Number(personCargoEditId.value) },
        data: payload
      });
    } else {
      await axios.post(API_ROUTES.ADMIN_SQL_TABLE("position_assignments"), payload);
    }
    await loadPersonAssignments(personEditorId.value);
    resetPersonCargoForm();
  } catch (err) {
    personCargoError.value = err?.response?.data?.message || "No se pudo guardar la ocupacion.";
  }
};

const submitPersonRoleCreate = async () => {
  if (!personEditorId.value) {
    personRoleError.value = "Guarda el usuario antes de asignar roles.";
    return;
  }
  personRoleError.value = "";
  const payload = {
    person_id: Number(personEditorId.value),
    role_id: personRoleForm.value.role_id ? Number(personRoleForm.value.role_id) : null,
    unit_id: personRoleForm.value.unit_id ? Number(personRoleForm.value.unit_id) : null,
    start_date: new Date().toISOString().slice(0, 10)
  };
  if (!payload.role_id) {
    personRoleError.value = "Selecciona un rol.";
    return;
  }
  if (!payload.unit_id) {
    personRoleError.value = "Selecciona una unidad.";
    return;
  }
  try {
    if (personRoleEditId.value) {
      await axios.put(API_ROUTES.ADMIN_SQL_TABLE("role_assignments"), {
        keys: { id: Number(personRoleEditId.value) },
        data: {
          ...payload,
          start_date: personRoleEditStartDate.value || payload.start_date
        }
      });
    } else {
      await axios.post(API_ROUTES.ADMIN_SQL_TABLE("role_assignments"), payload);
    }
    await loadPersonAssignments(personEditorId.value);
    resetPersonRoleForm();
  } catch (err) {
    personRoleError.value = err?.response?.data?.message || "No se pudo guardar el rol.";
  }
};

const submitPersonContractCreate = async () => {
  if (!personEditorId.value) {
    personContractError.value = "Guarda el usuario antes de asignar contratos.";
    return;
  }
  personContractError.value = "";
  const payload = {
    person_id: Number(personEditorId.value),
    position_id: personContractForm.value.position_id ? Number(personContractForm.value.position_id) : null,
    relation_type: personContractForm.value.relation_type?.trim(),
    dedication: personContractForm.value.dedication?.trim(),
    start_date: personContractForm.value.start_date,
    end_date: personContractForm.value.end_date || null,
    status: personContractForm.value.status || "activo"
  };
  if (!payload.position_id) {
    personContractError.value = "Selecciona un puesto.";
    return;
  }
  if (!payload.relation_type || !payload.dedication || !payload.start_date) {
    personContractError.value = "Completa relacion, dedicacion y fecha de inicio.";
    return;
  }
  try {
    if (personContractEditId.value) {
      await axios.put(API_ROUTES.ADMIN_SQL_TABLE("contracts"), {
        keys: { id: Number(personContractEditId.value) },
        data: payload
      });
    } else {
      await axios.post(API_ROUTES.ADMIN_SQL_TABLE("contracts"), payload);
    }
    await loadPersonAssignments(personEditorId.value);
    resetPersonContractForm();
  } catch (err) {
    personContractError.value = err?.response?.data?.message || "No se pudo guardar el contrato.";
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
  } catch (error) {
    // Default remains empty if org type cannot be resolved.
  }
};

const openCreate = async () => {
  if (!props.table) {
    return;
  }
  resetInlineFkState();
  closeProcessDefinitionVersioningModal();
  processDefinitionCloneSourceId.value = "";
  editorMode.value = "create";
  selectedRow.value = null;
  processDefinitionChecklistLoading.value = false;
  processDefinitionChecklist.value = {
    rules: false,
    triggers: false,
    artifacts: false
  };
  modalError.value = "";
  resetForm();
  fkDisplay.value = {};
  await applyUnitRelationDefaults();
  ensureEditorInstance();
  editorInstance?.show();
};

const handlePrimaryCreateAction = async () => {
  if (isTemplateArtifactsTable.value) {
    await openDraftArtifactModal();
    return;
  }
  await openCreate();
};

const openEdit = async (row) => {
  if (
    props.table?.table === "template_artifacts"
    && String(row?.artifact_origin || "") === "system"
  ) {
    showFeedbackToast({
      kind: "error",
      title: "Edicion bloqueada",
      message: "Los artifacts del sistema se sincronizan desde MinIO y no se editan manualmente."
    });
    return;
  }
  if (props.table?.table === "template_artifacts") {
    await openDraftArtifactModal(row);
    return;
  }
  resetInlineFkState();
  closeProcessDefinitionVersioningModal();
  processDefinitionCloneSourceId.value = "";
  editorMode.value = "edit";
  selectedRow.value = row;
  modalError.value = "";
  buildFormFromRow(row);
  await refreshFormFkDisplayLabels();
  if (props.table?.table === "process_definition_versions") {
    await refreshProcessDefinitionChecklist(row);
  }
  ensureEditorInstance();
  editorInstance?.show();
};

const openDelete = (row) => {
  selectedRow.value = row;
  ensureDeleteInstance();
  deleteInstance?.show();
};

const startProcessDefinitionTemplateFromArtifact = async (row) => {
  if (!row || !isProcessDefinitionTemplatesTable.value) {
    return;
  }
  resetInlineFkState();
  closeProcessDefinitionVersioningModal();
  processDefinitionCloneSourceId.value = "";
  editorMode.value = "create";
  selectedRow.value = null;
  processDefinitionChecklistLoading.value = false;
  processDefinitionChecklist.value = {
    rules: false,
    triggers: false,
    artifacts: false
  };
  modalError.value = "";
  resetForm();
  fkDisplay.value = {};
  formData.value = {
    ...formData.value,
    template_artifact_id: row.id ? String(row.id) : ""
  };
  if (row.id !== null && row.id !== undefined && row.id !== "") {
    setFkLabel("template_artifacts", row.id, formatFkOptionLabel("template_artifacts", row));
  }
  await refreshFormFkDisplayLabels();
  ensureEditorInstance();
  editorInstance?.show();
};

const startProcessDefinitionVersioning = async (row) => {
  if (!row) {
    return;
  }
  resetInlineFkState();
  closeProcessDefinitionVersioningModal();
  processDefinitionCloneSourceId.value = row.id ? String(row.id) : "";
  editorMode.value = "create";
  selectedRow.value = null;
  modalError.value = "";
  buildFormFromRow(row);
  formData.value = {
    ...formData.value,
    process_id: row.process_id ?? formData.value.process_id ?? "",
    series_id: row.series_id ?? formData.value.series_id ?? "",
    definition_version: getNextSemanticVersion(row.definition_version),
    status: "draft"
  };
  await refreshFormFkDisplayLabels();
  ensureEditorInstance();
  editorInstance?.show();
};

const openProcessDefinitionVersioningModal = () => {
  processDefinitionVersioningSource.value = selectedRow.value ? { ...selectedRow.value } : null;
  ensureProcessDefinitionVersioningInstance();
  processDefinitionVersioningInstance?.show();
};

const closeProcessDefinitionVersioningModal = () => {
  processDefinitionVersioningInstance?.hide();
  processDefinitionVersioningSource.value = null;
};

const loadProcessDefinitionActivationDetail = async (definitionId) => {
  processDefinitionActivationRules.value = [];
  processDefinitionActivationTriggers.value = [];
  processDefinitionActivationArtifacts.value = [];
  if (!definitionId) {
    return;
  }
  const [rulesResponse, triggersResponse, artifactsResponse] = await Promise.all([
    axios.get(API_ROUTES.ADMIN_SQL_TABLE("process_target_rules"), {
      params: {
        filter_process_definition_id: definitionId,
        orderBy: "priority",
        order: "asc",
        limit: 100
      }
    }),
    axios.get(API_ROUTES.ADMIN_SQL_TABLE("process_definition_triggers"), {
      params: {
        filter_process_definition_id: definitionId,
        orderBy: "created_at",
        order: "desc",
        limit: 100
      }
    }),
    axios.get(API_ROUTES.ADMIN_SQL_TABLE("process_definition_templates"), {
      params: {
        filter_process_definition_id: definitionId,
        orderBy: "sort_order",
        order: "asc",
        limit: 100
      }
    })
  ]);
  processDefinitionActivationRules.value = rulesResponse.data || [];
  processDefinitionActivationTriggers.value = triggersResponse.data || [];
  processDefinitionActivationArtifacts.value = artifactsResponse.data || [];
  await prefetchFkLabelsForRows(processDefinitionActivationRules.value, ["unit_id", "unit_type_id", "cargo_id", "position_id"]);
  await prefetchFkLabelsForRows(processDefinitionActivationTriggers.value, ["term_type_id"]);
  await prefetchFkLabelsForRows(processDefinitionActivationArtifacts.value, ["template_artifact_id"]);
};

const openProcessDefinitionActivationForRow = async (row) => {
  if (!row) {
    return;
  }
  clearModalOrigins();
  editorMode.value = "edit";
  selectedRow.value = row;
  buildFormFromRow(row);
  await refreshFormFkDisplayLabels();
  processDefinitionActivationConfirmed.value = false;
  processDefinitionActivationFromEditor.value = false;
  await openProcessDefinitionActivationModal();
};

const openProcessDefinitionActivationModal = async () => {
  processDefinitionActivationChecking.value = true;
  processDefinitionActivationHasActiveRules.value = true;
  processDefinitionActivationHasActiveTriggers.value = true;
  processDefinitionActivationHasRequiredArtifacts.value = true;
  processDefinitionActivationView.value = "definition";
  processDefinitionActivationRequiresArtifacts.value = Boolean(
    editorInstance
    && editorModal.value?.classList.contains("show")
    && props.table?.table === "process_definition_versions"
      ? Number(formData.value?.has_document) === 1
      : Number(selectedRow.value?.has_document) === 1
  );
  ensureProcessDefinitionActivationInstance();
  processDefinitionActivationInstance?.show();
  try {
    const definitionId = selectedRow.value?.id;
    const requiresArtifacts = processDefinitionActivationRequiresArtifacts.value;
    const [hasRules, hasTriggers, hasArtifacts] = await Promise.all([
      checkDefinitionHasActiveRules(definitionId),
      checkDefinitionHasActiveTriggers(definitionId),
      requiresArtifacts ? checkDefinitionHasArtifactsForActivation(definitionId) : Promise.resolve(true)
    ]);
    await loadProcessDefinitionActivationDetail(definitionId);
    processDefinitionActivationHasActiveRules.value = hasRules;
    processDefinitionActivationHasActiveTriggers.value = hasTriggers;
    processDefinitionActivationHasRequiredArtifacts.value = hasArtifacts;
  } catch {
    processDefinitionActivationHasActiveRules.value = false;
    processDefinitionActivationHasActiveTriggers.value = true;
    processDefinitionActivationHasRequiredArtifacts.value = true;
    processDefinitionActivationRules.value = [];
    processDefinitionActivationTriggers.value = [];
    processDefinitionActivationArtifacts.value = [];
  } finally {
    processDefinitionActivationChecking.value = false;
  }
};

const closeProcessDefinitionActivationModal = () => {
  processDefinitionActivationInstance?.hide();
};

const cancelProcessDefinitionActivation = () => {
  processDefinitionActivationConfirmed.value = false;
  processDefinitionActivationFromEditor.value = false;
  closeProcessDefinitionActivationModal();
};

const openDefinitionEditorFromActivation = () => {
  const context = selectedRow.value;
  if (!context) {
    return;
  }
  closeProcessDefinitionActivationModal();
  processDefinitionActivationConfirmed.value = false;
  setTimeout(() => {
    openEdit(context);
  }, 120);
};

const handleProcessDefinitionActivationPrimaryAction = async () => {
  const actionType = processDefinitionActivationPrimaryAction.value?.type;
  if (!actionType) {
    return;
  }
  if (actionType === "edit_definition") {
    openDefinitionEditorFromActivation();
    return;
  }
  if (actionType === "rules") {
    await openDefinitionRulesFromActivation();
    return;
  }
  if (actionType === "triggers") {
    await openDefinitionTriggersFromActivation();
    return;
  }
  if (actionType === "artifacts") {
    await openDefinitionArtifactsFromActivation();
    return;
  }
  await confirmProcessDefinitionActivation();
};

const confirmProcessDefinitionActivation = async () => {
  if (props.table?.table === "process_definition_versions" && selectedRow.value) {
    if (!processDefinitionActivationFromEditor.value) {
      editorMode.value = "edit";
      buildFormFromRow(selectedRow.value);
      await refreshFormFkDisplayLabels();
    }
    formData.value = {
      ...formData.value,
      status: "active"
    };
  }
  processDefinitionActivationConfirmed.value = true;
  closeProcessDefinitionActivationModal();
  await submitForm();
};

const cancelProcessDefinitionEdit = () => {
  processDefinitionCloneSourceId.value = "";
  closeProcessDefinitionVersioningModal();
  editorInstance?.hide();
};

const promoteProcessDefinitionToNewVersion = async () => {
  const sourceRow = processDefinitionVersioningSource.value || selectedRow.value || {};
  const nextVersion = (
    normalizeComparableFormValue("definition_version", formData.value.definition_version)
    && normalizeComparableFormValue("definition_version", formData.value.definition_version)
      !== normalizeComparableFormValue("definition_version", sourceRow.definition_version)
  )
    ? String(formData.value.definition_version).trim()
    : getNextSemanticVersion(sourceRow.definition_version);

  formData.value = {
    ...formData.value,
    process_id: sourceRow.process_id ?? formData.value.process_id ?? "",
    series_id: sourceRow.series_id ?? formData.value.series_id ?? "",
    definition_version: nextVersion,
    status: "draft"
  };
  fkDisplay.value = {
    ...fkDisplay.value,
    process_id: fkDisplay.value.process_id || (sourceRow.process_id ? String(sourceRow.process_id) : "")
  };
  processDefinitionCloneSourceId.value = sourceRow.id ? String(sourceRow.id) : "";
  editorMode.value = "create";
  selectedRow.value = null;
  processDefinitionChecklistLoading.value = false;
  processDefinitionChecklist.value = {
    rules: false,
    triggers: false,
    artifacts: false
  };
  modalError.value = "";
  closeProcessDefinitionVersioningModal();
  await refreshFormFkDisplayLabels();
};

const submitForm = async () => {
  if (!props.table) {
    return;
  }
  error.value = "";
  modalError.value = "";
  if (isPersonTable.value && editorMode.value === "create") {
    const password = formData.value.password;
    if (typeof password !== "string" || !password.trim()) {
      modalError.value = "Ingresa el password del usuario.";
      return;
    }
  }
  try {
    const payload = buildPayload();
    if (
      props.table.table === "process_definition_versions"
      && editorMode.value === "edit"
      && String(selectedRow.value?.status || "") === "active"
    ) {
      const changedKeys = getChangedPayloadKeys(selectedRow.value || {}, payload);
      const disallowedActiveChanges = changedKeys.filter((key) => !["status", "effective_to"].includes(key));
      if (disallowedActiveChanges.length) {
        openProcessDefinitionVersioningModal();
        return;
      }
    }
    if (
      props.table.table === "process_definition_versions"
      && editorMode.value === "edit"
      && String(selectedRow.value?.status || "") === "draft"
      && String(payload.status || "") === "active"
      && !processDefinitionActivationConfirmed.value
    ) {
      processDefinitionActivationFromEditor.value = true;
      await openProcessDefinitionActivationModal();
      return;
    }
    const usesProcessDefinitionActivationConfirmation = processDefinitionActivationConfirmed.value;
    let createdPersonRow = null;
    let createdDefinitionRow = null;
    let createdTermRow = null;
    let responseNotice = "";
    if (editorMode.value === "create") {
      const response = await axios.post(API_ROUTES.ADMIN_SQL_TABLE(props.table.table), payload);
      responseNotice = response?.data?.__notice ? String(response.data.__notice) : "";
      if (isPersonTable.value) {
        const responseRow = response?.data && typeof response.data === "object" ? response.data : {};
        createdPersonRow = { ...payload, ...responseRow };
      }
      if (props.table.table === "process_definition_versions") {
        const responseRow = response?.data && typeof response.data === "object" ? response.data : {};
        createdDefinitionRow = { ...payload, ...responseRow };
      }
      if (props.table.table === "terms") {
        const responseRow = response?.data && typeof response.data === "object" ? response.data : {};
        createdTermRow = { ...payload, ...responseRow };
      }
    } else {
      const keys = buildKeys(selectedRow.value || {});
      const response = await axios.put(API_ROUTES.ADMIN_SQL_TABLE(props.table.table), {
        keys,
        data: payload
      });
      responseNotice = response?.data?.__notice ? String(response.data.__notice) : "";
    }
    editorInstance?.hide();
    processDefinitionCloneSourceId.value = "";
    await fetchRows();
    if (usesProcessDefinitionActivationConfirmation) {
      processDefinitionActivationConfirmed.value = false;
      processDefinitionActivationFromEditor.value = false;
    }
    if (responseNotice) {
      showFeedbackToast({
        kind: "success",
        title: "Actualizacion aplicada",
        message: responseNotice,
        duration: 6200
      });
    }
    if (createdPersonRow) {
      const createdId = createdPersonRow.id ?? createdPersonRow._id;
      let selectedPerson = null;
      if (createdId !== null && createdId !== undefined && createdId !== "") {
        selectedPerson = rows.value.find((row) => String(row.id) === String(createdId));
      }
      if (!selectedPerson) {
        selectedPerson = rows.value.find((row) =>
          (createdPersonRow.cedula && row.cedula === createdPersonRow.cedula)
          || (createdPersonRow.email && row.email === createdPersonRow.email)
        );
      }
      if (selectedPerson) {
        await openPersonAssignments(selectedPerson);
      }
    }
    if (createdDefinitionRow?.id || createdDefinitionRow?.process_id) {
      let selectedDefinition = null;
      if (createdDefinitionRow.id !== null && createdDefinitionRow.id !== undefined && createdDefinitionRow.id !== "") {
        selectedDefinition = rows.value.find((row) => String(row.id) === String(createdDefinitionRow.id));
      }
      if (!selectedDefinition) {
        selectedDefinition = {
          ...createdDefinitionRow,
          id: createdDefinitionRow.id ?? ""
        };
      }
      openDefinitionArtifactsPrompt(selectedDefinition);
    }
    if (createdTermRow?.id) {
      const shouldInstantiate = window.confirm("El periodo se creo correctamente. ¿Deseas instanciar ahora las tareas automaticas?");
      if (shouldInstantiate) {
        try {
          const generationResponse = await axios.post(API_ROUTES.ADMIN_GENERATE_TERM_TASKS(createdTermRow.id));
          const result = generationResponse?.data || {};
          showFeedbackToast({
            kind: "success",
            title: "Instanciacion completada",
            message: `Tareas: ${result.tasks_created ?? 0}. Items: ${result.task_items_created ?? 0}. Asignaciones: ${result.assignments_created ?? 0}.`,
            duration: 6200
          });
        } catch (generationError) {
          showFeedbackToast({
            kind: "error",
            title: "No se pudo instanciar",
            message: generationError?.response?.data?.error || generationError?.response?.data?.message || "No se pudieron generar las tareas del periodo."
          });
        }
      }
    }
  } catch (err) {
    const responseMessage = err?.response?.data?.message || "";
    if (
      props.table?.table === "process_definition_versions"
      && editorMode.value === "edit"
      && responseMessage === "Una definicion activa solo permite cambiar estado o vigencia final."
    ) {
      processDefinitionActivationConfirmed.value = false;
      openProcessDefinitionVersioningModal();
      return;
    }
    if (processDefinitionActivationConfirmed.value) {
      processDefinitionActivationConfirmed.value = false;
      processDefinitionActivationFromEditor.value = false;
    }
    modalError.value = responseMessage || "No se pudo guardar el registro.";
  }
};

const confirmDelete = async () => {
  if (!props.table || !selectedRow.value) {
    return;
  }
  error.value = "";
  try {
    const keys = buildKeys(selectedRow.value);
    await axios.delete(API_ROUTES.ADMIN_SQL_TABLE(props.table.table), { data: { keys } });
    if (
      isPersonTable.value
      && personEditorId.value
      && String(selectedRow.value?.id) === String(personEditorId.value)
    ) {
      resetPersonAssignments();
    }
    deleteInstance?.hide();
    await fetchRows();
  } catch (err) {
    error.value = err?.response?.data?.message || "No se pudo eliminar el registro.";
  }
};

watch(
  () => props.table?.table,
  async () => {
    resetInlineFkState();
    if (personAssignmentsInstance && personAssignmentsModal.value?.classList.contains("show")) {
      personAssignmentsInstance.hide();
    }
    if (unitPositionSearchInstance && unitPositionSearchModal.value?.classList.contains("show")) {
      unitPositionSearchInstance.hide();
    }
    resetForm();
    resetPersonAssignments();
    positionMetaById.value = {};
    vacantSearchTerm.value = "";
    vacantPositionRows.value = [];
    vacantPositionError.value = "";
    vacantPositionLoading.value = false;
    processFilters.value = {
      parent_id: "",
      is_active: ""
    };
    processFilterLabels.value = {
      parent_id: ""
    };
    templateFilters.value = {
      name: "",
      slug: "",
      description: "",
      process_id: ""
    };
    templateFilterLabels.value = {
      process_id: ""
    };
    documentFilters.value = {
      task_id: "",
      status: ""
    };
    documentFilterLabels.value = {
      task_id: ""
    };
    unitPositionFilters.value = {
      unit_type_id: "",
      unit_id: "",
      cargo_id: ""
    };
    vacantPositionFilters.value = {
      unit_type_id: "",
      unit_id: "",
      cargo_id: "",
      position_type: ""
    };
    unitPositionUnitTypeOptions.value = [];
    unitPositionUnitOptions.value = [];
    unitPositionCargoOptions.value = [];
    vacantPositionUnitTypeOptions.value = [];
    vacantPositionUnitOptions.value = [];
    vacantPositionCargoOptions.value = [];
    unassignedTemplateArtifactSearch.value = "";
    unassignedTemplateArtifactFilters.value = {
      is_active: ""
    };
    unassignedTemplateArtifactRows.value = [];
    unassignedTemplateArtifactError.value = "";
    unassignedTemplateArtifactLoading.value = false;
    processDefinitionInlineFilters.value = {
      process_id: "",
      variation_key: "",
      status: ""
    };
    processTargetRuleInlineFilters.value = {
      definition_execution_mode: "",
      definition_status: ""
    };
    templateArtifactInlineFilters.value = {
      artifact_origin: "",
      artifact_stage: ""
    };
    processDefinitionProcessOptions.value = [];
    processDefinitionSeriesOptions.value = [];
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
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
  if (vacantSearchTimeout) {
    clearTimeout(vacantSearchTimeout);
  }
  if (unassignedTemplateArtifactSearchTimeout) {
    clearTimeout(unassignedTemplateArtifactSearchTimeout);
  }
  if (feedbackToastTimeout) {
    clearTimeout(feedbackToastTimeout);
  }
  resetInlineFkState();
});

defineExpose({
  openCreate,
  openDraftArtifactModal
});
</script>

<style scoped>
.table-title-with-icon {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
}

.table-title-icon {
  width: 2rem;
  height: 2rem;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(var(--color-puce-light-rgb), 0.1);
  border: 1px solid rgba(var(--color-puce-light-rgb), 0.2);
  color: var(--color-puce-light);
  flex: 0 0 auto;
  font-size: 0.95rem;
}

.table-title-icon.is-template-artifacts {
  background:
    linear-gradient(
      135deg,
      rgba(37, 99, 235, 0.16) 0%,
      rgba(37, 99, 235, 0.16) 48%,
      rgba(239, 68, 68, 0.16) 52%,
      rgba(239, 68, 68, 0.16) 100%
    );
  border: 1px solid rgba(112, 110, 186, 0.34);
  color: #6b56d6;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.38),
    0 8px 18px rgba(89, 94, 186, 0.12);
}

.fk-inline-clear-col {
  padding-right: calc(var(--bs-gutter-x) * 0.5 + 0.2rem);
  min-width: 4rem;
}

.fk-inline-clear-btn {
  width: 3rem;
  min-width: 3rem;
  height: 3rem;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
}

.modal .btn:not(.btn-sm):not(.btn-icon) {
  border-radius: 10px;
  padding: 0.65rem 1.75rem;
  font-size: 1.25rem;
  font-weight: 400;
}

.modal .btn.btn-primary,
.modal .btn.btn-outline-primary {
  color: var(--color-puce-light);
  border: 1px solid rgba(var(--color-puce-light-rgb), 0.5);
  background: transparent;
  box-shadow: none;
}

.modal .btn.btn-primary:hover,
.modal .btn.btn-primary:focus,
.modal .btn.btn-outline-primary:hover,
.modal .btn.btn-outline-primary:focus {
  color: #ffffff;
  border: 1px solid var(--color-puce-light);
  background: var(--color-puce-light);
}

.modal .btn.btn-primary:disabled,
.modal .btn.btn-outline-primary:disabled {
  color: rgba(var(--color-puce-light-rgb), 0.56);
  border: 1px solid rgba(var(--color-puce-light-rgb), 0.28);
  background: transparent;
}

.fk-inline-suggestions {
  position: absolute;
  inset-inline: 0;
  top: calc(100% + 0.25rem);
  z-index: 20;
  max-height: 16rem;
  overflow-y: auto;
  border-radius: 0.75rem;
}

.fk-inline-suggestions .list-group-item {
  font-size: 0.95rem;
}

.person-assignment-title,
.person-subtitle {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.person-subtitle {
  color: var(--brand-navy);
}

.person-assignment-panel {
  border: 1px solid rgba(var(--brand-primary-rgb), 0.16);
}

.person-assignment-context {
  border: 1px solid rgba(40, 167, 69, 0.26);
  border-radius: 0.625rem;
  background: rgba(40, 167, 69, 0.1);
  color: #218838;
  padding: 0.65rem 0.85rem;
}

.person-assignment-context .text-muted {
  color: rgba(33, 136, 56, 0.86) !important;
}

.person-assignment-menu {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.person-assignment-form {
  border: 1px solid rgba(var(--color-puce-light-rgb), 0.24);
  border-radius: 0.85rem;
  background: rgba(var(--color-puce-light-rgb), 0.05);
  padding: 0.9rem;
}

.person-assignment-form .form-label {
  font-weight: 600;
}

.person-assignment-form-actions {
  margin-top: 0.85rem;
  padding-top: 0.8rem;
  border-top: 1px dashed rgba(var(--brand-primary-rgb), 0.2);
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
}

.person-assignment-form-actions .btn {
  font-size: 1rem !important;
  padding: 0.52rem 1.25rem !important;
}

.person-assignment-table {
  border: 1px solid rgba(var(--brand-primary-rgb), 0.12);
  border-radius: 0.8rem;
  padding: 0.15rem 0.3rem 0;
  background: #ffffff;
}

.person-assignment-menu-btn {
  min-width: 9.5rem;
  border: 1px solid rgba(var(--color-puce-light-rgb), 0.36);
  border-radius: 999px;
  background: rgba(var(--color-puce-light-rgb), 0.1);
  color: var(--brand-navy);
  padding: 0.52rem 1rem;
  font-size: 0.9rem;
  font-weight: 600;
  letter-spacing: 0.01em;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  transition: all 0.2s ease;
}

.person-assignment-menu-btn:hover {
  border-color: rgba(var(--color-puce-light-rgb), 0.6);
  background: rgba(var(--color-puce-light-rgb), 0.18);
  transform: translateY(-1px);
}

.person-assignment-menu-btn.is-active {
  border-color: rgba(var(--color-puce-light-rgb), 0.85);
  background: rgba(var(--color-puce-light-rgb), 0.24);
  color: #0f3153;
  box-shadow: 0 0 0 2px rgba(var(--color-puce-light-rgb), 0.18);
}

.process-flow-panel {
  border: 1px solid rgba(var(--brand-primary-rgb), 0.14);
  border-radius: 0.85rem;
  padding: 1rem;
  background: rgba(var(--brand-primary-rgb), 0.03);
}

.process-flow-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--brand-ink);
  margin-bottom: 0.9rem;
}

.definition-checklist {
  border: 1px solid rgba(var(--brand-primary-rgb), 0.12);
  border-radius: 1rem;
  background:
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.98) 0%,
      rgba(var(--brand-primary-rgb), 0.025) 100%
    );
  padding: 1rem 1.05rem;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.72),
    0 12px 28px rgba(var(--brand-primary-rgb), 0.05);
}

.definition-checklist-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.9rem;
}

.definition-checklist-head strong {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--brand-ink);
  letter-spacing: 0.01em;
}

.definition-checklist-head .text-muted {
  font-size: 0.82rem;
  font-weight: 600;
}

.definition-checklist-items {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  gap: 0.7rem;
}

.definition-checklist-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  min-height: 3.1rem;
  padding: 0.72rem 0.8rem;
  border-radius: 0.9rem;
  border: 1px solid rgba(var(--brand-primary-rgb), 0.1);
  background: rgba(var(--brand-primary-rgb), 0.03);
  color: rgba(var(--brand-primary-rgb), 0.82);
  transition: border-color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;
}

.definition-checklist-item svg {
  flex: 0 0 auto;
  width: 1rem;
  height: 1rem;
  color: rgba(220, 53, 69, 0.9);
}

.definition-checklist-item span {
  font-size: 0.87rem;
  font-weight: 600;
  line-height: 1.35;
}

.definition-checklist-item.is-complete {
  border-color: rgba(40, 167, 69, 0.24);
  background: rgba(40, 167, 69, 0.08);
  color: #1f6f41;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.46);
}

.definition-checklist-item.is-complete svg {
  color: #218838;
}

.definition-activation-panel {
  border: 1px solid rgba(var(--brand-primary-rgb), 0.12);
  border-radius: 1rem;
  background: rgba(var(--brand-primary-rgb), 0.03);
  padding: 0.95rem;
}

.definition-activation-modal-dialog {
  width: min(70rem, calc(100vw - 2rem));
  max-width: min(70rem, calc(100vw - 2rem));
}

.definition-activation-warning {
  border: 1px solid rgba(255, 193, 7, 0.34);
  border-radius: 0.9rem;
  background: rgba(255, 193, 7, 0.12);
  color: #7a5a00;
  padding: 0.8rem 0.95rem;
  font-size: 0.92rem;
  line-height: 1.45;
  font-weight: 600;
}

.definition-activation-menu {
  display: inline-flex;
  flex-wrap: nowrap !important;
  width: 100%;
}

.definition-activation-panel .btn-group .btn {
  min-width: 0;
  flex: 1 1 0;
  white-space: nowrap;
  font-size: 0.88rem !important;
  padding: 0.5rem 0.8rem !important;
}

.admin-inline-error {
  border: 1px solid rgba(220, 53, 69, 0.22);
  border-radius: 0.85rem;
  background: rgba(220, 53, 69, 0.08);
  color: #b42332;
  padding: 0.9rem 1rem;
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.45;
  margin-bottom: 0.25rem;
}

.admin-feedback-toast {
  position: sticky;
  top: 0.85rem;
  z-index: 18;
  display: flex;
  justify-content: flex-end;
  margin-bottom: 1rem;
  pointer-events: none;
}

.admin-feedback-toast-body {
  min-width: min(34rem, 100%);
  max-width: 42rem;
  border-radius: 1rem;
  padding: 0.95rem 1rem;
  display: flex;
  align-items: flex-start;
  gap: 0.85rem;
  box-shadow: 0 18px 38px rgba(var(--brand-primary-rgb), 0.14);
  border: 1px solid rgba(var(--brand-primary-rgb), 0.12);
  background: #ffffff;
  pointer-events: auto;
}

.admin-feedback-toast.is-success .admin-feedback-toast-body {
  border-color: rgba(40, 167, 69, 0.28);
  background: rgba(40, 167, 69, 0.1);
  box-shadow: 0 18px 38px rgba(40, 167, 69, 0.08);
}

.admin-feedback-toast.is-error .admin-feedback-toast-body {
  border-color: rgba(220, 53, 69, 0.28);
  background: rgba(220, 53, 69, 0.1);
  box-shadow: 0 18px 38px rgba(220, 53, 69, 0.08);
}

.admin-feedback-toast-copy {
  flex: 1;
  min-width: 0;
}

.admin-feedback-toast-title {
  display: block;
  color: var(--brand-ink);
  font-size: 1rem;
  line-height: 1.35;
  margin-bottom: 0.2rem;
}

.admin-feedback-toast.is-success .admin-feedback-toast-title {
  color: #218838;
}

.admin-feedback-toast-message {
  color: rgba(var(--brand-primary-rgb), 0.86);
  font-size: 0.95rem;
  line-height: 1.45;
  white-space: pre-wrap;
}

.admin-feedback-toast.is-success .admin-feedback-toast-message {
  color: rgba(33, 136, 56, 0.92);
}

.admin-feedback-toast.is-error .admin-feedback-toast-title {
  color: #b42332;
}

.admin-feedback-toast.is-error .admin-feedback-toast-message {
  color: rgba(180, 35, 50, 0.92);
}

.admin-feedback-toast-close {
  flex-shrink: 0;
  border: 1px solid rgba(var(--brand-primary-rgb), 0.12);
  background: rgba(255, 255, 255, 0.72);
}

.admin-feedback-toast.is-success .admin-feedback-toast-close {
  border-color: rgba(40, 167, 69, 0.22);
  color: #218838;
  background: rgba(40, 167, 69, 0.06);
}

.admin-feedback-toast.is-error .admin-feedback-toast-close {
  border-color: rgba(220, 53, 69, 0.22);
  color: #dc3545;
  background: rgba(220, 53, 69, 0.06);
}

.available-formats-cell,
.available-formats-viewer {
  min-width: 0;
}

.available-formats-group,
.available-formats-viewer-section {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.available-formats-group.is-inline {
  flex-direction: row;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.available-formats-group.is-inline .available-formats-badges {
  flex: 1 1 auto;
}

.available-formats-group + .available-formats-group,
.available-formats-viewer-section + .available-formats-viewer-section {
  margin-top: 0.55rem;
}

.available-formats-mode,
.available-formats-viewer-title {
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: rgba(var(--brand-primary-rgb), 0.7);
}

.available-formats-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.available-formats-badge {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 0.2rem 0.55rem;
  font-size: 0.76rem;
  font-weight: 700;
  line-height: 1.2;
  color: var(--brand-navy);
  background: rgba(var(--color-puce-light-rgb), 0.16);
  border: 1px solid rgba(var(--color-puce-light-rgb), 0.28);
}

.available-formats-badge.is-viewer {
  min-width: 4.5rem;
  justify-content: center;
}

.available-formats-viewer-entry {
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
  flex-wrap: wrap;
}

.available-formats-path {
  display: inline-block;
  max-width: 100%;
  padding: 0.18rem 0.45rem;
  border-radius: 0.5rem;
  background: rgba(var(--brand-primary-rgb), 0.05);
  color: rgba(var(--brand-primary-rgb), 0.84);
  font-size: 0.8rem;
  white-space: pre-wrap;
  word-break: break-word;
}

.draft-upload-dropzone {
  display: flex;
  min-height: 5.5rem;
  width: 100%;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  border: 1px dashed rgba(var(--brand-primary-rgb), 0.28);
  border-radius: 0.9rem;
  background: rgba(var(--brand-primary-rgb), 0.04);
  color: rgba(var(--brand-primary-rgb), 0.86);
  text-align: center;
  cursor: pointer;
  padding: 0.85rem;
  transition: background 0.16s ease, border-color 0.16s ease;
}

.draft-upload-dropzone:hover {
  background: rgba(var(--brand-primary-rgb), 0.08);
  border-color: rgba(var(--brand-primary-rgb), 0.42);
}

.draft-upload-dropzone-title {
  font-size: 0.86rem;
  font-weight: 700;
}

.draft-upload-dropzone-meta {
  font-size: 0.78rem;
  color: rgba(var(--brand-primary-rgb), 0.68);
  word-break: break-word;
}

.fk-row-actions .hope-action-btn {
  margin: 0;
}

.hope-action-view {
  color: var(--brand-accent) !important;
  background: rgba(var(--brand-accent-rgb), 0.11);
  border-color: rgba(var(--brand-accent-rgb), 0.3);
}

.hope-action-view:hover {
  color: #1d6da0 !important;
  background: rgba(var(--brand-accent-rgb), 0.16);
  border-color: rgba(var(--brand-accent-rgb), 0.42);
}

.hope-action-select {
  color: var(--state-success) !important;
  background: rgba(40, 167, 69, 0.11);
  border-color: rgba(40, 167, 69, 0.3);
}

.hope-action-select:hover {
  color: #218838 !important;
  background: rgba(40, 167, 69, 0.16);
  border-color: rgba(40, 167, 69, 0.42);
}

.hope-action-assign {
  color: var(--brand-navy) !important;
  background: rgba(var(--brand-primary-rgb), 0.11);
  border-color: rgba(var(--brand-primary-rgb), 0.28);
}

.hope-action-assign:hover {
  color: #0f3153 !important;
  background: rgba(var(--brand-primary-rgb), 0.16);
  border-color: rgba(var(--brand-primary-rgb), 0.4);
}

.hope-action-version {
  color: var(--color-puce-light) !important;
  background: rgba(var(--color-puce-light-rgb), 0.14);
  border-color: rgba(var(--color-puce-light-rgb), 0.34);
}

.hope-action-version:hover {
  color: #2f73f1 !important;
  background: rgba(var(--color-puce-light-rgb), 0.2);
  border-color: rgba(var(--color-puce-light-rgb), 0.46);
}

.table-actions-scroll {
  position: relative;
}

.table-institutional.table-actions .admin-action-col {
  position: sticky;
  right: 0;
  min-width: 8rem;
  width: 8rem;
  z-index: 2;
  box-shadow: -6px 0 10px rgba(var(--brand-primary-rgb), 0.08);
}

.table-institutional.table-actions thead .admin-action-col {
  z-index: 3;
  background: #e9f0fa;
}

.table-institutional.table-actions tbody .admin-action-col {
  background: #ffffff;
}

.table-institutional.table-actions.table-striped > tbody > tr:nth-of-type(odd) .admin-action-col {
  background-color: #f7f9fc;
}

.table-institutional.table-actions tbody tr:hover .admin-action-col {
  background: #edf4ff;
}
</style>
