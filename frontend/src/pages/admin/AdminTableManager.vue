<template>
  <div class="container-fluid py-4">
    <div class="profile-section-header">
      <div>
        <h2 class="text-start profile-section-title table-title-with-icon">
          <span class="table-title-icon" aria-hidden="true">
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
            class="btn btn-primary btn-lg profile-add-btn"
            type="button"
            :disabled="!table"
            @click="openCreate"
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
              <div :class="isPositionFilterTable ? 'col-12 col-lg-3' : isProcessDefinitionFilterTable ? 'col-12 col-md-4 col-lg-3' : 'col-12 col-md-6'">
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
                <div class="col-12 col-md-4 col-lg-3">
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
                <div class="col-12 col-md-4 col-lg-3">
                  <input
                    v-model="processDefinitionInlineFilters.variation_key"
                    type="text"
                    class="form-control"
                    placeholder="Filtrar por serie"
                    @input="debouncedSearch"
                  />
                </div>
              </template>
              <div :class="isPositionFilterTable ? 'col-12 col-lg-2 text-lg-end' : isProcessDefinitionFilterTable ? 'col-12 col-lg-3 text-lg-end' : 'col-12 col-md-6 text-md-end'">
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
            <div v-else-if="error" class="text-danger">{{ error }}</div>
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
                      {{ formatCell(row[field.name], field, row) }}
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
                        <BtnEdit @onpress="openEdit(row)" />
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
            <div v-else-if="vacantPositionError" class="text-danger">{{ vacantPositionError }}</div>
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
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
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
            <button type="button" class="btn btn-outline-danger" data-bs-dismiss="modal">Cerrar</button>
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
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
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

          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">
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
      <div class="modal-dialog">
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
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <p>Confirma la eliminacion del registro seleccionado.</p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">
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
      id="sqlFkModal"
      tabindex="-1"
      aria-labelledby="sqlFkModalLabel"
      aria-hidden="true"
      ref="fkModal"
    >
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="sqlFkModalLabel">
              Buscar referencia {{ fkTable?.label || "" }}
            </h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
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
                <div class="col-12 col-md-1 d-grid">
                  <button
                    type="button"
                    class="btn btn-sm btn-icon btn-outline-secondary"
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
                <div class="col-12 col-md-5">
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
                  <label class="form-label text-dark">Estado</label>
                  <select
                    v-model="fkFilters.status"
                    class="form-select"
                    @change="handleFkProcessDefinitionFilterChange"
                  >
                    <option value="">Todos</option>
                    <option
                      v-for="option in getFkTableFieldOptions('status')"
                      :key="option"
                      :value="option"
                    >
                      {{ formatSelectOptionLabel(getFkTableField('status'), option) }}
                    </option>
                  </select>
                </div>
                <div class="col-12 col-md-3">
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
                <div class="col-12 col-md-1 d-grid">
                  <button
                    type="button"
                    class="btn btn-sm btn-icon btn-outline-secondary"
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
              <div class="col-12 d-grid">
                <button
                  type="button"
                  class="btn btn-outline-secondary"
                  :disabled="!fkPositionFilters.unit_type_id && !fkPositionFilters.unit_id && !fkPositionFilters.cargo_id"
                  @click="clearFkUnitPositionFilters"
                >
                  Limpiar
                </button>
              </div>
            </div>
            <div v-if="fkLoading" class="text-muted">Cargando...</div>
            <div v-else-if="fkError" class="text-danger">{{ fkError }}</div>
            <div v-else class="table-responsive">
              <table class="table table-striped table-hover align-middle table-institutional">
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
                    <th class="text-start">Accion</th>
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
                      {{ formatFkListCell(row, field) }}
                    </td>
                    <td class="text-end">
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
            <button type="button" class="btn btn-outline-danger" data-bs-dismiss="modal">
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
                      <td>{{ formatRecordViewerValue(field, recordViewerRow) }}</td>
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
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
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
            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">
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
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
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
            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">
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
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
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
            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">
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
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
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
            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">
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
  </div>
</template>

<script setup>
import { computed, defineEmits, defineProps, defineExpose, onBeforeUnmount, ref, watch } from "vue";
import axios from "axios";
import { Modal } from "bootstrap";
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
const searchTerm = ref("");
const vacantSearchTerm = ref("");
const processDefinitionInlineFilters = ref({
  process_id: "",
  variation_key: ""
});
const processDefinitionProcessOptions = ref([]);
const editorMode = ref("create");
const formData = ref({});
const selectedRow = ref(null);
const modalError = ref("");
const fkDisplay = ref({});

const editorModal = ref(null);
const processDefinitionVersioningModal = ref(null);
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
let deleteInstance = null;
let recordViewerInstance = null;
let personAssignmentsInstance = null;
let fkInstance = null;
let fkViewerInstance = null;
let fkFilterInstance = null;
let fkCreateInstance = null;
let returnModal = null;
let searchTimeout = null;
let vacantSearchTimeout = null;
const skipFkReturnRestore = ref(false);
const fkCreateExitTarget = ref("none");
const fkNestedExitTarget = ref("none");
const recordViewerTable = ref(null);
const recordViewerRow = ref(null);
const recordViewerLoading = ref(false);
const recordViewerError = ref("");
const recordViewerRelatedSections = ref([]);
const processDefinitionVersioningSource = ref(null);

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
  if (props.table.table === "templates") {
    return props.table.fields.filter(
      (field) => !field.readOnly || field.name === "version"
    );
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
const visibleFormFields = computed(() => {
  if (!isProcessTable.value) {
    return formFields.value;
  }
  return formFields.value.filter((field) => !PROCESS_INLINE_HIDDEN_FIELDS.has(field.name));
});
const tableListFields = computed(() => {
  if (!props.table) {
    return [];
  }
  const fields = props.table.fields.filter((field) => !(isPersonTable.value && field.name === "password_hash"));
  const normalizedFields = fields.filter((field) => !(
    props.table.table === "templates" && field.name === "process_name"
  ));
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
  return fkTable.value.fields.filter((field) => !field.virtual);
});
const fkPrimaryListField = computed(() => {
  if (!fkTable.value?.fields) {
    return null;
  }
  if (fkTable.value.table === "process_definition_versions") {
    return fkTable.value.fields.find((field) => field.name === "process_id") || null;
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
const hasFkProcessDefinitionFilters = computed(() =>
  Boolean(fkFilters.value.status || fkFilters.value.execution_mode)
);

const isTemplateTable = computed(() => props.table?.table === "templates");
const isProcessTable = computed(() => props.table?.table === "processes");
const isProcessDefinitionFilterTable = computed(() => props.table?.table === "process_definition_versions");
const isPersonTable = computed(() => props.table?.table === "persons");
const isUnitPositionsTable = computed(() => props.table?.table === "unit_positions");
const isPositionAssignmentsTable = computed(() => props.table?.table === "position_assignments");
const isPositionFilterTable = computed(() =>
  isUnitPositionsTable.value || isPositionAssignmentsTable.value
);
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
    || processDefinitionInlineFilters.value.variation_key?.trim()
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
      "process_definition_template_bindings",
      "templates",
      "template_versions"
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
    if (tableMeta.table === "templates" && field.name === "process_name") {
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

const formatValueForTable = (tableMeta, value, field, row = null) => {
  if (value === null || value === undefined || value === "") {
    if (!["__plaza", "__position_type", "__process_name"].includes(field?.name)) {
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
  if (["created_at", "updated_at", "created", "updated"].includes(fieldName)) {
    return formatDateTimeHour(value);
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

const restoreReturnModal = () => {
  if (returnModal === "editor" && editorInstance) {
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
  returnModal = null;
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

const ensureTemplateSearchInstance = () => {
  if (!templateSearchInstance && templateSearchModal.value) {
    templateSearchInstance = new Modal(templateSearchModal.value);
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
    payload.status = "";
    payload.execution_mode = "";
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
  process_definition_id: "process_definition_versions",
  term_type_id: "term_types",
  term_id: "terms",
  task_id: "tasks",
  unit_type_id: "unit_types",
  unit_id: "units",
  parent_unit_id: "units",
  child_unit_id: "units",
  relation_type_id: "relation_unit_types",
  template_id: "templates",
  template_artifact_id: "template_artifacts",
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
  const preferred = ["name", "title", "email", "code", "slug"];
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
    status: "",
    execution_mode: ""
  };
  await fetchFkRows();
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
  returnModal = null;
  if (editorInstance && editorModal.value?.classList.contains("show")) {
    editorInstance.hide();
    returnModal = "editor";
  }
  if (processSearchInstance && processSearchModal.value?.classList.contains("show")) {
    processSearchInstance.hide();
    returnModal = "processSearch";
  }
  if (templateSearchInstance && templateSearchModal.value?.classList.contains("show")) {
    templateSearchInstance.hide();
    returnModal = "templateSearch";
  }
  if (documentSearchInstance && documentSearchModal.value?.classList.contains("show")) {
    documentSearchInstance.hide();
    returnModal = "documentSearch";
  }
  if (personAssignmentsInstance && personAssignmentsModal.value?.classList.contains("show")) {
    personAssignmentsInstance.hide();
    returnModal = "personAssignments";
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
    { table: "process_definition_versions", label: "Definiciones", foreignKey: "process_id", orderBy: "effective_from", order: "desc" },
    { table: "templates", label: "Plantillas", foreignKey: "process_id", orderBy: "created_at", order: "desc" }
  ],
  process_definition_versions: [
    { table: "process_target_rules", label: "Reglas de alcance", foreignKey: "process_definition_id", orderBy: "priority", order: "asc" },
    { table: "process_definition_template_bindings", label: "Plantillas vinculadas", foreignKey: "process_definition_id", orderBy: "sort_order", order: "asc" },
    { table: "signature_flow_templates", label: "Flujos de firma", foreignKey: "process_definition_id", orderBy: "created_at", order: "desc" },
    { table: "tasks", label: "Tareas", foreignKey: "process_definition_id", orderBy: "created_at", order: "desc" }
  ],
  tasks: [
    { table: "task_assignments", label: "Asignaciones", foreignKey: "task_id", orderBy: "assigned_at", order: "desc" },
    { table: "documents", label: "Documentos", foreignKey: "task_id", orderBy: "created_at", order: "desc" }
  ],
  templates: [
    { table: "template_versions", label: "Versiones de plantilla", foreignKey: "template_id", orderBy: "created_at", order: "desc" }
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

  returnModal = null;
  if (personAssignmentsInstance && personAssignmentsModal.value?.classList.contains("show")) {
    personAssignmentsInstance.hide();
    returnModal = "personAssignments";
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

const fetchRows = async () => {
  if (!props.table) {
    rows.value = [];
    vacantSearchTerm.value = "";
    vacantPositionRows.value = [];
    vacantPositionError.value = "";
    vacantPositionLoading.value = false;
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
    if (props.table?.table === "templates") {
      Object.entries(templateFilters.value).forEach(([key, value]) => {
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
    variation_key: ""
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

const focusSearch = () => {
  searchInput.value?.focus();
};

const handleSearchAction = () => {
  if (props.table?.table === "processes") {
    openProcessSearch();
    return;
  }
  if (props.table?.table === "templates") {
    openTemplateSearch();
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

const handleGoBack = () => {
  emit("go-back");
};

const openProcessSearch = () => {
  ensureProcessSearchInstance();
  processSearchInstance?.show();
};

const openTemplateSearch = () => {
  ensureTemplateSearchInstance();
  templateSearchInstance?.show();
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
  editorMode.value = "create";
  selectedRow.value = null;
  modalError.value = "";
  resetForm();
  fkDisplay.value = {};
  await applyUnitRelationDefaults();
  ensureEditorInstance();
  editorInstance?.show();
};

const openEdit = async (row) => {
  resetInlineFkState();
  closeProcessDefinitionVersioningModal();
  editorMode.value = "edit";
  selectedRow.value = row;
  modalError.value = "";
  buildFormFromRow(row);
  await refreshFormFkDisplayLabels();
  ensureEditorInstance();
  editorInstance?.show();
};

const openDelete = (row) => {
  selectedRow.value = row;
  ensureDeleteInstance();
  deleteInstance?.show();
};

const startProcessDefinitionVersioning = async (row) => {
  if (!row) {
    return;
  }
  resetInlineFkState();
  closeProcessDefinitionVersioningModal();
  editorMode.value = "create";
  selectedRow.value = null;
  modalError.value = "";
  buildFormFromRow(row);
  formData.value = {
    ...formData.value,
    process_id: row.process_id ?? formData.value.process_id ?? "",
    variation_key: row.variation_key ?? formData.value.variation_key ?? "general",
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

const cancelProcessDefinitionEdit = () => {
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
    variation_key: sourceRow.variation_key ?? formData.value.variation_key ?? "general",
    definition_version: nextVersion,
    status: "draft"
  };
  fkDisplay.value = {
    ...fkDisplay.value,
    process_id: fkDisplay.value.process_id || (sourceRow.process_id ? String(sourceRow.process_id) : "")
  };
  editorMode.value = "create";
  selectedRow.value = null;
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
  if (isTemplateTable.value) {
    const processId = formData.value.process_id ? Number(formData.value.process_id) : null;
    if (!processId) {
      modalError.value = "Selecciona un proceso para la plantilla.";
      return;
    }
  }
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
    let createdPersonRow = null;
    if (editorMode.value === "create") {
      const response = await axios.post(API_ROUTES.ADMIN_SQL_TABLE(props.table.table), payload);
      if (isPersonTable.value) {
        const responseRow = response?.data && typeof response.data === "object" ? response.data : {};
        createdPersonRow = { ...payload, ...responseRow };
      }
    } else {
      const keys = buildKeys(selectedRow.value || {});
      await axios.put(API_ROUTES.ADMIN_SQL_TABLE(props.table.table), {
        keys,
        data: payload
      });
    }
    editorInstance?.hide();
    await fetchRows();
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
  } catch (err) {
    const responseMessage = err?.response?.data?.message || "";
    if (
      props.table?.table === "process_definition_versions"
      && editorMode.value === "edit"
      && responseMessage === "Una definicion activa solo permite cambiar estado o vigencia final."
    ) {
      openProcessDefinitionVersioningModal();
      return;
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
    processDefinitionInlineFilters.value = {
      process_id: "",
      variation_key: ""
    };
    processDefinitionProcessOptions.value = [];
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
  resetInlineFkState();
});

defineExpose({
  openCreate
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
