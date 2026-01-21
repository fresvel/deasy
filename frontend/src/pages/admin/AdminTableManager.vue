<template>
  <div class="container-fluid py-4">
    <div class="profile-section-header">
      <div v-if="!isPersonTable">
        <h2 class="text-start profile-section-title">
          {{ table?.label || "Administracion SQL" }}
        </h2>
        <p class="profile-section-subtitle">
          Gestiona registros en {{ table?.table || "la base de datos" }}.
        </p>
      </div>
      <div class="profile-section-actions">
        <div class="d-flex gap-2">
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
            :disabled="!table || !isProcessTable"
            @click="openProcessVersionsModal"
          >
            Versiones
          </button>
          <button
            class="btn btn-primary btn-lg profile-add-btn"
            type="button"
            :disabled="!table || isProcessVersionsTable"
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
              <div class="col-12 col-md-6">
                <input
                  ref="searchInput"
                  v-model="searchTerm"
                  type="text"
                  class="form-control"
                  placeholder="Buscar en la tabla"
                  @input="debouncedSearch"
                />
              </div>
              <div class="col-12 col-md-6 text-md-end">
                <button
                  class="btn btn-outline-secondary btn-sm"
                  type="button"
                  @click="fetchRows"
                >
                  Actualizar
                </button>
              </div>
            </div>

            <div v-if="loading" class="text-muted">Cargando datos...</div>
            <div v-else-if="error" class="text-danger">{{ error }}</div>
            <div v-else class="table-responsive table-actions">
              <div class="table-actions-scroll">
                <table class="table table-striped table-hover align-middle table-institutional table-actions">
                <thead>
                  <tr>
                    <th v-for="field in table.fields" :key="field.name" class="text-start">
                      {{ field.label || field.name }}
                    </th>
                    <th class="text-start">ACCION</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="rows.length === 0">
                    <td :colspan="table.fields.length + 1" class="text-center text-muted">
                      <p class="my-3">No hay registros disponibles</p>
                    </td>
                  </tr>
                  <tr v-for="row in rows" :key="rowKey(row)">
                    <td v-for="field in table.fields" :key="field.name">
                      {{ formatCell(row[field.name], field) }}
                    </td>
                    <td>
                      <div class="dropdown" @click.stop>
                        <button
                          class="btn btn-outline-primary btn-sm dropdown-toggle"
                          type="button"
                          :aria-expanded="openDropdownId === rowKey(row)"
                          aria-label="Acciones"
                          title="Acciones"
                          @click="toggleDropdown(row)"
                        >
                          <font-awesome-icon icon="ellipsis-vertical" />
                        </button>
                        <ul
                          class="dropdown-menu dropdown-menu-end"
                          :class="{ show: openDropdownId === rowKey(row) }"
                        >
                          <li v-if="!isProcessVersionsTable">
                            <button class="dropdown-item" type="button" @click="openEdit(row); closeDropdown()">
                              <font-awesome-icon icon="edit" class="me-2" />
                              Editar
                            </button>
                          </li>
                          <li v-if="!isProcessVersionsTable">
                            <button class="dropdown-item text-danger" type="button" @click="openDelete(row); closeDropdown()">
                              <font-awesome-icon icon="trash" class="me-2" />
                              Eliminar
                            </button>
                          </li>
                        </ul>
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
                v-for="field in formFields"
                :key="field.name"
                class="col-12 col-md-6"
              >
                <label class="form-label">
                  {{ field.label || field.name }}
                  <span v-if="field.required" class="text-danger">*</span>
                </label>
                <div v-if="isInputField(field) && isForeignKeyField(field)" class="input-group">
                  <input
                    v-model="fkDisplay[field.name]"
                    type="text"
                    class="form-control"
                    :placeholder="field.placeholder || ''"
                    :readonly="true"
                    @keydown.prevent
                    @paste.prevent
                  />
                  <button
                    class="btn btn-outline-secondary"
                    type="button"
                    :disabled="isFieldLocked(field)"
                    @click="openFkSearch(field)"
                  >
                    Buscar
                  </button>
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
                    {{ option }}
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
              <template v-if="isProcessTable">
                <div class="col-12">
                  <div class="alert alert-warning mb-0">
                    Al actualizar un proceso se generara una nueva version. Completa los datos de la version.
                  </div>
                </div>
                <div class="col-12 col-md-4">
                  <label class="form-label text-dark">Version</label>
                  <input
                    v-model="processVersionForm.version"
                    type="text"
                    class="form-control"
                    placeholder="0.1"
                  />
                </div>
                <div class="col-12 col-md-4">
                  <label class="form-label text-dark">Nombre de version</label>
                  <input
                    v-model="processVersionForm.name"
                    type="text"
                    class="form-control"
                    placeholder="Inicial"
                  />
                </div>
                <div class="col-12 col-md-4">
                  <label class="form-label text-dark">Slug de version</label>
                  <input
                    v-model="processVersionForm.slug"
                    type="text"
                    class="form-control"
                    placeholder="Opcional"
                  />
                </div>
                <div class="col-12 col-md-6">
                  <label class="form-label text-dark">Vigencia desde</label>
                  <input
                    v-model="processVersionForm.effective_from"
                    type="date"
                    class="form-control"
                  />
                </div>
                <div class="col-12 col-md-6">
                  <label class="form-label text-dark">Vigencia hasta</label>
                  <input
                    v-model="processVersionForm.effective_to"
                    type="date"
                    class="form-control"
                  />
                </div>
                <div class="col-12 col-md-6">
                  <label class="form-label text-dark">Version padre</label>
                  <div class="input-group">
                    <input
                      v-model="processVersionForm.parent_version_id"
                      type="text"
                      class="form-control"
                      placeholder="Opcional"
                      readonly
                      @keydown.prevent
                      @paste.prevent
                    />
                    <button
                      class="btn btn-outline-secondary"
                      type="button"
                      @click="openProcessVersionParentSearch"
                    >
                      Buscar
                    </button>
                  </div>
                </div>
              </template>
            </form>

            <template v-if="isPersonTable">
              <div class="border-top pt-4 mt-4">
                <h6 class="text-uppercase text-muted mb-3">Asignaciones del usuario</h6>
                <div v-if="!personEditorId" class="alert alert-info">
                  Guarda el usuario para poder asignar ocupaciones, roles y contratos.
                </div>

                <div class="row g-4">
                  <div class="col-12">
                    <h6 class="mb-2">Ocupaciones</h6>
                    <div v-if="personCargoError" class="alert alert-danger">{{ personCargoError }}</div>
                    <div class="table-responsive mb-3">
                      <table class="table table-sm table-striped align-middle">
                        <thead>
                          <tr>
                            <th>ID</th>
                            <th>Puesto</th>
                            <th>Inicio</th>
                            <th>Fin</th>
                            <th>Actual</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-if="personCargoRows.length === 0">
                            <td colspan="5" class="text-center text-muted">Sin ocupaciones asignadas.</td>
                          </tr>
                          <tr v-for="row in personCargoRows" :key="row.id">
                            <td>{{ row.id }}</td>
                            <td>{{ formatCell(row.position_id, { name: "position_id" }) }}</td>
                            <td>{{ toDateInputValue(row.start_date) }}</td>
                            <td>{{ toDateInputValue(row.end_date) || "—" }}</td>
                            <td>{{ Number(row.is_current) === 1 ? "Si" : "No" }}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

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
                          <button class="btn btn-outline-secondary" type="button" @click="openPersonCargoFkSearch('position_id')">
                            Buscar
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
                      <div class="col-12 text-end">
                        <button class="btn btn-outline-primary" type="button" @click="submitPersonCargoCreate">
                          Agregar ocupacion
                        </button>
                      </div>
                    </div>
                  </div>

                  <div class="col-12">
                    <h6 class="mb-2">Roles</h6>
                    <div v-if="personRoleError" class="alert alert-danger">{{ personRoleError }}</div>
                    <div class="table-responsive mb-3">
                      <table class="table table-sm table-striped align-middle">
                        <thead>
                          <tr>
                            <th>ID</th>
                            <th>Rol</th>
                            <th>Unidad</th>
                            <th>Asignado</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-if="personRoleRows.length === 0">
                            <td colspan="4" class="text-center text-muted">Sin roles asignados.</td>
                          </tr>
                          <tr v-for="row in personRoleRows" :key="row.id">
                            <td>{{ row.id }}</td>
                            <td>{{ formatCell(row.role_id, { name: "role_id" }) }}</td>
                            <td>{{ formatCell(row.unit_id, { name: "unit_id" }) }}</td>
                            <td>{{ row.assigned_at ?? "—" }}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

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
                          <button class="btn btn-outline-secondary" type="button" @click="openPersonRoleFkSearch('role_id')">
                            Buscar
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
                          <button class="btn btn-outline-secondary" type="button" @click="openPersonRoleFkSearch('unit_id')">
                            Buscar
                          </button>
                        </div>
                      </div>
                      <div class="col-12 text-end">
                        <button class="btn btn-outline-primary" type="button" @click="submitPersonRoleCreate">
                          Agregar rol
                        </button>
                      </div>
                    </div>
                  </div>

                  <div class="col-12">
                    <h6 class="mb-2">Contratos / Puestos</h6>
                    <div v-if="personContractError" class="alert alert-danger">{{ personContractError }}</div>
                    <div class="table-responsive mb-3">
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
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-if="personContractRows.length === 0">
                            <td colspan="7" class="text-center text-muted">Sin contratos asignados.</td>
                          </tr>
                          <tr v-for="row in personContractRows" :key="row.id">
                            <td>{{ row.id }}</td>
                            <td>{{ formatCell(row.position_id, { name: "position_id" }) }}</td>
                            <td>{{ row.relation_type }}</td>
                            <td>{{ row.dedication }}</td>
                            <td>{{ toDateInputValue(row.start_date) }}</td>
                            <td>{{ toDateInputValue(row.end_date) || "—" }}</td>
                            <td>{{ row.status }}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

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
                          <button class="btn btn-outline-secondary" type="button" @click="openPersonContractFkSearch">
                            Buscar
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
                      <div class="col-12 text-end">
                        <button class="btn btn-outline-primary" type="button" @click="submitPersonContractCreate">
                          Agregar contrato
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>
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
      id="processVersionEditorModal"
      tabindex="-1"
      aria-labelledby="processVersionEditorModalLabel"
      aria-hidden="true"
      ref="processVersionModal"
    >
      <div class="modal-dialog modal-xl">
        <div class="modal-content process-modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="processVersionEditorModalLabel">Editar versiones de proceso</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <div v-if="processVersionError" class="alert alert-danger mb-3">
              {{ processVersionError }}
            </div>
            <form class="row g-3">
              <div class="col-12">
                <label class="form-label text-dark">Proceso</label>
                <div class="input-group">
                  <input
                    v-model="processVersionProcessLabel"
                    type="text"
                    class="form-control"
                    placeholder="Selecciona un proceso"
                    readonly
                    @keydown.prevent
                    @paste.prevent
                  />
                  <button class="btn btn-outline-secondary" type="button" @click="openProcessVersionProcessSearch">
                    Buscar
                  </button>
                </div>
              </div>
              <div class="col-12">
                <label class="form-label text-dark">Version</label>
                <select v-model="selectedProcessVersionId" class="form-select" @change="handleProcessVersionSelect">
                  <option value="">Selecciona una version</option>
                  <option
                    v-for="versionRow in processVersionRows"
                    :key="versionRow.id"
                    :value="String(versionRow.id)"
                  >
                    {{ `v${versionRow.version} - ${versionRow.name}` }}
                  </option>
                </select>
              </div>
              <div v-if="processVersionEditForm.id" class="col-12 col-md-4">
                <label class="form-label text-dark">Version</label>
                <input v-model="processVersionEditForm.version" type="text" class="form-control" readonly />
              </div>
              <div v-if="processVersionEditForm.id" class="col-12 col-md-8">
                <label class="form-label text-dark">Nombre</label>
                <input v-model="processVersionEditForm.name" type="text" class="form-control" />
              </div>
              <div v-if="processVersionEditForm.id" class="col-12 col-md-6">
                <label class="form-label text-dark">Slug</label>
                <input v-model="processVersionEditForm.slug" type="text" class="form-control" />
              </div>
              <div v-if="processVersionEditForm.id" class="col-12 col-md-6">
                <label class="form-label text-dark">Version padre</label>
                <div class="input-group">
                  <input
                    v-model="processVersionEditLabels.parent_version_id"
                    type="text"
                    class="form-control"
                    placeholder="Selecciona una version"
                    readonly
                    @keydown.prevent
                    @paste.prevent
                  />
                  <button class="btn btn-outline-secondary" type="button" @click="openProcessVersionFkSearch('parent_version_id')">
                    Buscar
                  </button>
                </div>
              </div>
              <div v-if="processVersionEditForm.id" class="col-12 col-md-6">
                <label class="form-label text-dark">Cargo responsable</label>
                <div class="input-group">
                  <input
                    v-model="processVersionEditLabels.cargo_id"
                    type="text"
                    class="form-control"
                    placeholder="Selecciona un cargo"
                    readonly
                    @keydown.prevent
                    @paste.prevent
                  />
                  <button class="btn btn-outline-secondary" type="button" @click="openProcessVersionFkSearch('cargo_id')">
                    Buscar
                  </button>
                </div>
              </div>
              <div v-if="processVersionEditForm.id" class="col-12 col-md-6">
                <label class="form-label text-dark">Vigencia desde</label>
                <input v-model="processVersionEditForm.effective_from" type="date" class="form-control" />
              </div>
              <div v-if="processVersionEditForm.id" class="col-12 col-md-6">
                <label class="form-label text-dark">Vigencia hasta</label>
                <input v-model="processVersionEditForm.effective_to" type="date" class="form-control" />
              </div>
              <div v-if="processVersionEditForm.id" class="col-12 col-md-6">
                <label class="form-label text-dark">Tiene documento</label>
                <select v-model="processVersionEditForm.has_document" class="form-select">
                  <option value="1">Si</option>
                  <option value="0">No</option>
                </select>
              </div>
              <div v-if="processVersionEditForm.id" class="col-12 col-md-6">
                <label class="form-label text-dark">Activo</label>
                <select v-model="processVersionEditForm.is_active" class="form-select">
                  <option value="1">Si</option>
                  <option value="0">No</option>
                </select>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">
              Cancelar
            </button>
            <button
              type="button"
              class="btn btn-primary"
              :disabled="!processVersionEditForm.id"
              @click="submitProcessVersionEdit"
            >
              Guardar cambios
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
            <div class="row g-3 align-items-center mb-3">
              <div class="col-12">
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
            <div v-if="fkLoading" class="text-muted">Cargando...</div>
            <div v-else-if="fkError" class="text-danger">{{ fkError }}</div>
            <div v-else class="table-responsive">
              <table class="table table-striped table-hover align-middle table-institutional">
                <thead>
                  <tr>
                    <th class="text-start">ID</th>
                    <th class="text-start">Detalle</th>
                    <th class="text-start">Accion</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="fkRows.length === 0">
                    <td colspan="3" class="text-center text-muted">
                      <p class="my-3">No hay registros disponibles</p>
                    </td>
                  </tr>
                  <tr v-for="row in fkRows" :key="row.id">
                    <td>{{ row.id }}</td>
                    <td>
                      {{ row[resolveDisplayField(fkTable) || "id"] || "—" }}
                    </td>
                    <td>
                      <button type="button" class="btn btn-outline-primary btn-sm" @click="selectFkRow(row)">
                        Seleccionar
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">
              Cerrar
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
                <label class="form-label text-dark">Unidad</label>
                <div class="input-group">
                  <input
                    v-model="processFilterLabels.unit_id"
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
                    @click="openProcessFkSearch('unit_id')"
                  >
                    Buscar
                  </button>
                </div>
              </div>
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
                    @click="openProcessFkSearch('parent_id')"
                  >
                    Buscar
                  </button>
                </div>
              </div>
              <div class="col-12 col-md-6">
                <label class="form-label text-dark">Tiene documento</label>
                <select v-model="processFilters.has_document" class="form-select">
                  <option value="">Todos</option>
                  <option value="1">Si</option>
                  <option value="0">No</option>
                </select>
              </div>
              <div class="col-12 col-md-6">
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
            <button type="button" class="btn btn-primary" @click="applyProcessFilter">
              Buscar
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
                    @click="openTemplateFkSearch"
                  >
                    Buscar
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
            <button type="button" class="btn btn-primary" @click="applyTemplateFilter">
              Buscar
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
                    @click="openDocumentFkSearch('task_id')"
                  >
                    Buscar
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
            <button type="button" class="btn btn-primary" @click="applyDocumentFilter">
              Buscar
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, defineProps, defineExpose, onBeforeUnmount, onMounted, ref, watch } from "vue";
import axios from "axios";
import { Modal } from "bootstrap";
import { API_ROUTES } from "@/services/apiConfig";

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

const rows = ref([]);
const loading = ref(false);
const error = ref("");
const searchTerm = ref("");
const editorMode = ref("create");
const formData = ref({});
const selectedRow = ref(null);
const modalError = ref("");
const fkDisplay = ref({});

const editorModal = ref(null);
const deleteModal = ref(null);
const fkModal = ref(null);
const searchInput = ref(null);
let editorInstance = null;
let deleteInstance = null;
let fkInstance = null;
let returnModal = null;
let searchTimeout = null;

const fkTable = ref(null);
const fkRows = ref([]);
const fkSearch = ref("");
const fkLoading = ref(false);
const fkError = ref("");
const fkField = ref("");
const fkSetter = ref(null);
const openDropdownId = ref(null);

const processFilters = ref({
  unit_id: "",
  parent_id: "",
  has_document: "",
  is_active: ""
});
const processFilterLabels = ref({
  unit_id: "",
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
const templateSearchModal = ref(null);
let templateSearchInstance = null;
const documentSearchModal = ref(null);
let documentSearchInstance = null;
const processSearchModal = ref(null);
let processSearchInstance = null;
const processVersionModal = ref(null);
let processVersionInstance = null;
const processVersionForm = ref({
  version: "0.1",
  name: "Inicial",
  slug: "",
  effective_from: "",
  effective_to: "",
  parent_version_id: ""
});
const processVersionError = ref("");
const processVersionProcessId = ref("");
const processVersionProcessLabel = ref("");
const processVersionRows = ref([]);
const selectedProcessVersionId = ref("");
const processVersionEditForm = ref({
  id: "",
  version: "",
  name: "",
  slug: "",
  parent_version_id: "",
  cargo_id: "",
  has_document: "1",
  is_active: "1",
  effective_from: "",
  effective_to: ""
});
const processVersionEditLabels = ref({
  parent_version_id: "",
  cargo_id: ""
});
const personEditorId = ref("");
const personCargoRows = ref([]);
const personCargoError = ref("");
const personCargoForm = ref({
  position_id: "",
  start_date: "",
  end_date: "",
  is_current: "1"
});
const personCargoLabels = ref({
  position_id: ""
});
const personRoleRows = ref([]);
const personRoleError = ref("");
const personRoleForm = ref({
  role_id: "",
  unit_id: ""
});
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
const personContractLabels = ref({
  position_id: ""
});

const editableFields = computed(() => {
  if (!props.table) {
    return [];
  }
  return props.table.fields.filter((field) => !field.readOnly);
});

const formFields = computed(() => {
  if (!props.table) {
    return [];
  }
  if (props.table.table === "templates") {
    return props.table.fields.filter(
      (field) => !field.readOnly || field.name === "version"
    );
  }
  return editableFields.value;
});

const isTemplateTable = computed(() => props.table?.table === "templates");
const isProcessTable = computed(() => props.table?.table === "processes");
const isProcessVersionsTable = computed(() => props.table?.table === "process_versions");
const isPersonTable = computed(() => props.table?.table === "persons");

const allTablesMap = computed(() =>
  Object.fromEntries(props.allTables.map((table) => [table.table, table]))
);
const fkLabelCache = ref({});

const rowKey = (row) => {
  if (!props.table) {
    return JSON.stringify(row);
  }
  return props.table.primaryKeys.map((key) => row[key]).join("-");
};

const formatCell = (value, field) => {
  if (value === null || value === undefined || value === "") {
    return "—";
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

const ensureEditorInstance = () => {
  if (!editorInstance && editorModal.value) {
    editorInstance = new Modal(editorModal.value);
  }
};

const ensureDeleteInstance = () => {
  if (!deleteInstance && deleteModal.value) {
    deleteInstance = new Modal(deleteModal.value);
  }
};

const ensureFkInstance = () => {
  if (!fkInstance && fkModal.value) {
    fkInstance = new Modal(fkModal.value);
    fkModal.value.addEventListener("hidden.bs.modal", () => {
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
      if (returnModal === "processVersionEditor" && processVersionInstance) {
        processVersionInstance.show();
      }
      returnModal = null;
    });
  }
};

const ensureProcessSearchInstance = () => {
  if (!processSearchInstance && processSearchModal.value) {
    processSearchInstance = new Modal(processSearchModal.value);
  }
};

const ensureProcessVersionInstance = () => {
  if (!processVersionInstance && processVersionModal.value) {
    processVersionInstance = new Modal(processVersionModal.value);
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

const resetForm = () => {
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

const resetProcessVersionForm = (mode = "create") => {
  processVersionForm.value = {
    version: mode === "create" ? "0.1" : "",
    name: mode === "create" ? "Inicial" : "",
    slug: "",
    effective_from: "",
    effective_to: "",
    parent_version_id: ""
  };
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
    editorMode.value === "edit" &&
    props.table?.primaryKeys?.includes(field.name) &&
    !props.table?.allowPrimaryKeyUpdate
  ) {
    return true;
  }
  return false;
};

const isInputField = (field) => {
  return ["text", "email", "number", "date", "datetime"].includes(field.type);
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
  return payload;
};

const FK_TABLE_MAP = {
  parent_id: "processes",
  parent_task_id: "tasks",
  parent_version_id: "process_versions",
  process_id: "processes",
  process_version_id: "process_versions",
  term_id: "terms",
  task_id: "tasks",
  unit_type_id: "unit_types",
  unit_id: "units",
  parent_unit_id: "units",
  child_unit_id: "units",
  relation_type_id: "relation_unit_types",
  template_id: "templates",
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

const fetchFkRows = async () => {
  if (!fkTable.value) {
    fkRows.value = [];
    return;
  }
  fkLoading.value = true;
  fkError.value = "";
  try {
    const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE(fkTable.value.table), {
      params: {
        q: fkSearch.value || undefined,
        limit: 25
      }
    });
    fkRows.value = response.data || [];
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
  if (processVersionInstance && processVersionModal.value?.classList.contains("show")) {
    processVersionInstance.hide();
    returnModal = "processVersionEditor";
  }
  fkSetter.value = onSelect;
  fkField.value = field.name;
  fkTable.value = allTablesMap.value[tableName] || null;
  fkSearch.value = "";
  await fetchFkRows();
  ensureFkInstance();
  fkInstance?.show();
};

const selectFkRow = (row) => {
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
  fkInstance?.hide();
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

const fetchRows = async () => {
  if (!props.table) {
    rows.value = [];
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
    const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE(props.table.table), {
      params: {
        q: searchTerm.value || undefined,
        limit: 50,
        ...filters
      }
    });
    rows.value = response.data || [];
    const fkFields = props.table.fields
      .filter((field) => isForeignKeyField(field))
      .map((field) => field.name);
    await prefetchFkLabelsForRows(rows.value, fkFields);
  } catch (err) {
    error.value = err?.response?.data?.message || "No se pudo cargar la informacion.";
  } finally {
    closeDropdown();
    loading.value = false;
  }
};

const debouncedSearch = () => {
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
  searchTimeout = setTimeout(() => {
    fetchRows();
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
  focusSearch();
};

const toggleDropdown = (row) => {
  const key = rowKey(row);
  openDropdownId.value = openDropdownId.value === key ? null : key;
};

const closeDropdown = () => {
  openDropdownId.value = null;
};

const handleDocumentClick = () => {
  closeDropdown();
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

const applyProcessFilter = async () => {
  await fetchRows();
  processSearchInstance?.hide();
};

const clearProcessFilter = async () => {
  processFilters.value = {
    unit_id: "",
    parent_id: "",
    has_document: "",
    is_active: ""
  };
  processFilterLabels.value = {
    unit_id: "",
    parent_id: ""
  };
  await fetchRows();
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

const openProcessVersionParentSearch = () => {
  openFkSearch({ name: "parent_version_id" }, (row) => {
    const idValue = row.id ?? "";
    processVersionForm.value = {
      ...processVersionForm.value,
      parent_version_id: idValue ? String(idValue) : ""
    };
  });
};

const resetProcessVersionEditor = () => {
  processVersionError.value = "";
  processVersionProcessId.value = "";
  processVersionProcessLabel.value = "";
  processVersionRows.value = [];
  selectedProcessVersionId.value = "";
  processVersionEditForm.value = {
    id: "",
    version: "",
    name: "",
    slug: "",
    parent_version_id: "",
    cargo_id: "",
    has_document: "1",
    is_active: "1",
    effective_from: "",
    effective_to: ""
  };
  processVersionEditLabels.value = {
    parent_version_id: "",
    cargo_id: ""
  };
};

const openProcessVersionsModal = () => {
  if (!isProcessTable.value) {
    return;
  }
  resetProcessVersionEditor();
  ensureProcessVersionInstance();
  processVersionInstance?.show();
};

const resetPersonAssignments = () => {
  personEditorId.value = "";
  personCargoRows.value = [];
  personRoleRows.value = [];
  personContractRows.value = [];
  personCargoError.value = "";
  personRoleError.value = "";
  personContractError.value = "";
  personCargoForm.value = {
    position_id: "",
    start_date: "",
    end_date: "",
    is_current: "1"
  };
  personCargoLabels.value = {
    position_id: ""
  };
  personRoleForm.value = {
    role_id: "",
    unit_id: ""
  };
  personRoleLabels.value = {
    role_id: "",
    unit_id: ""
  };
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


const fetchProcessVersions = async () => {
  if (!processVersionProcessId.value) {
    processVersionRows.value = [];
    return;
  }
  processVersionError.value = "";
  try {
    const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE("process_versions"), {
      params: {
        filter_process_id: processVersionProcessId.value,
        orderBy: "created_at",
        order: "desc",
        limit: 100
      }
    });
    processVersionRows.value = response.data || [];
  } catch (err) {
    processVersionError.value = err?.response?.data?.message || "No se pudo cargar las versiones.";
  }
};

const loadPersonAssignments = async (personId) => {
  if (!personId) {
    resetPersonAssignments();
    return;
  }
  personEditorId.value = String(personId);
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
    await prefetchFkLabelsForRows(personRoleRows.value, ["role_id", "unit_id"]);
    await prefetchFkLabelsForRows(personContractRows.value, ["position_id"]);
  } catch (error) {
    personCargoError.value = personCargoError.value || "No se pudo cargar ocupaciones.";
    personRoleError.value = personRoleError.value || "No se pudo cargar roles.";
    personContractError.value = personContractError.value || "No se pudo cargar contratos.";
  }
};

const openProcessVersionProcessSearch = () => {
  openFkSearch({ name: "process_id" }, async (row) => {
    const idValue = row.id ?? "";
    processVersionProcessId.value = idValue ? String(idValue) : "";
    const displayField = resolveDisplayField(fkTable.value);
    const labelValue = row[displayField] ?? row.id;
    processVersionProcessLabel.value = labelValue ? String(labelValue) : "";
    selectedProcessVersionId.value = "";
    processVersionEditForm.value = {
      id: "",
      version: "",
      name: "",
      slug: "",
      parent_version_id: "",
      cargo_id: "",
      has_document: "1",
      is_active: "1",
      effective_from: "",
      effective_to: ""
    };
    processVersionEditLabels.value = {
      parent_version_id: "",
      cargo_id: ""
    };
    await fetchProcessVersions();
  });
};

const handleProcessVersionSelect = () => {
  const selectedId = selectedProcessVersionId.value;
  if (!selectedId) {
    processVersionEditForm.value = {
      id: "",
      version: "",
      name: "",
      slug: "",
      parent_version_id: "",
      cargo_id: "",
      has_document: "1",
      is_active: "1",
      effective_from: "",
      effective_to: ""
    };
    processVersionEditLabels.value = {
      parent_version_id: "",
      cargo_id: ""
    };
    return;
  }
  const row = processVersionRows.value.find((item) => String(item.id) === String(selectedId));
  if (!row) {
    return;
  }
  processVersionEditForm.value = {
    id: row.id ?? "",
    version: row.version ?? "",
    name: row.name ?? "",
    slug: row.slug ?? "",
    parent_version_id: row.parent_version_id ?? "",
    cargo_id: row.cargo_id ?? "",
    has_document: String(Number(row.has_document ?? 1) === 1 ? 1 : 0),
    is_active: String(Number(row.is_active ?? 1) === 1 ? 1 : 0),
    effective_from: toDateInputValue(row.effective_from),
    effective_to: toDateInputValue(row.effective_to)
  };
  processVersionEditLabels.value = {
    parent_version_id: row.parent_version_id ? String(row.parent_version_id) : "",
    cargo_id: row.cargo_id ? String(row.cargo_id) : ""
  };
};

const openProcessVersionFkSearch = (fieldName) => {
  if (!fieldName) {
    return;
  }
  openFkSearch({ name: fieldName }, (row) => {
    const idValue = row.id ?? "";
    processVersionEditForm.value = {
      ...processVersionEditForm.value,
      [fieldName]: idValue ? String(idValue) : ""
    };
    const displayField = resolveDisplayField(fkTable.value);
    const labelValue = row[displayField] ?? row.id;
    processVersionEditLabels.value = {
      ...processVersionEditLabels.value,
      [fieldName]: labelValue ? String(labelValue) : ""
    };
  });
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
    await axios.post(API_ROUTES.ADMIN_SQL_TABLE("position_assignments"), payload);
    await loadPersonAssignments(personEditorId.value);
    personCargoForm.value = {
      position_id: "",
      start_date: "",
      end_date: "",
      is_current: "1"
    };
    personCargoLabels.value = {
      position_id: ""
    };
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
    await axios.post(API_ROUTES.ADMIN_SQL_TABLE("role_assignments"), payload);
    await loadPersonAssignments(personEditorId.value);
    personRoleForm.value = {
      role_id: "",
      unit_id: ""
    };
    personRoleLabels.value = {
      role_id: "",
      unit_id: ""
    };
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
    await axios.post(API_ROUTES.ADMIN_SQL_TABLE("contracts"), payload);
    await loadPersonAssignments(personEditorId.value);
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
  } catch (err) {
    personContractError.value = err?.response?.data?.message || "No se pudo guardar el contrato.";
  }
};

const submitProcessVersionEdit = async () => {
  if (!processVersionEditForm.value.id) {
    return;
  }
  processVersionError.value = "";
  const cargoId = processVersionEditForm.value.cargo_id ? Number(processVersionEditForm.value.cargo_id) : null;
  if (!cargoId) {
    processVersionError.value = "Selecciona el cargo responsable.";
    return;
  }
  if (!processVersionEditForm.value.effective_from) {
    processVersionError.value = "Selecciona la fecha de vigencia inicial.";
    return;
  }
  try {
    const payload = {
      name: processVersionEditForm.value.name?.trim(),
      slug: processVersionEditForm.value.slug?.trim(),
      parent_version_id: processVersionEditForm.value.parent_version_id
        ? Number(processVersionEditForm.value.parent_version_id)
        : null,
      cargo_id: cargoId,
      has_document: Number(processVersionEditForm.value.has_document) === 1 ? 1 : 0,
      is_active: Number(processVersionEditForm.value.is_active) === 1 ? 1 : 0,
      effective_from: processVersionEditForm.value.effective_from,
      effective_to: processVersionEditForm.value.effective_to || null
    };
    await axios.put(API_ROUTES.ADMIN_SQL_TABLE("process_versions"), {
      keys: { id: processVersionEditForm.value.id },
      data: payload
    });
    await fetchProcessVersions();
  } catch (err) {
    processVersionError.value = err?.response?.data?.message || "No se pudo actualizar la version.";
  }
};


const openCreate = () => {
  if (!props.table) {
    return;
  }
  editorMode.value = "create";
  selectedRow.value = null;
  modalError.value = "";
  resetForm();
  fkDisplay.value = {};
  if (isProcessTable.value) {
    resetProcessVersionForm("create");
  }
  resetPersonAssignments();
  ensureEditorInstance();
  editorInstance?.show();
};

const openEdit = async (row) => {
  editorMode.value = "edit";
  selectedRow.value = row;
  modalError.value = "";
  buildFormFromRow(row);
  if (isProcessTable.value) {
    processVersionForm.value = {
      version: "",
      name: row?.name ?? "",
      slug: row?.slug ?? "",
      effective_from: "",
      effective_to: "",
      parent_version_id: ""
    };
  }
  if (isPersonTable.value) {
    await loadPersonAssignments(row?.id);
  } else {
    resetPersonAssignments();
  }
  ensureEditorInstance();
  editorInstance?.show();
};

const openDelete = (row) => {
  selectedRow.value = row;
  ensureDeleteInstance();
  deleteInstance?.show();
};

const submitForm = async () => {
  if (!props.table) {
    return;
  }
  error.value = "";
  modalError.value = "";
  if (props.table.table === "processes") {
    const unitId = formData.value.unit_id ? Number(formData.value.unit_id) : null;
    const cargoId = formData.value.cargo_id ? Number(formData.value.cargo_id) : null;
    if (!unitId) {
      modalError.value = "Selecciona una unidad para el proceso.";
      return;
    }
    if (!cargoId) {
      modalError.value = "Selecciona el cargo responsable inicial.";
      return;
    }
    const versionValue = processVersionForm.value.version?.trim();
    const effectiveFrom = processVersionForm.value.effective_from;
    if (!versionValue) {
      modalError.value = "Indica la version del proceso.";
      return;
    }
    if (!effectiveFrom) {
      modalError.value = "Indica la fecha de vigencia inicial de la version.";
      return;
    }
    if (editorMode.value === "edit") {
      const confirmed = window.confirm(
        "Esta actualizacion generara una nueva version del proceso. ¿Deseas continuar?"
      );
      if (!confirmed) {
        return;
      }
    }
  }
  if (isTemplateTable.value) {
    const processId = formData.value.process_id ? Number(formData.value.process_id) : null;
    if (!processId) {
      modalError.value = "Selecciona un proceso para la plantilla.";
      return;
    }
  }
  try {
    const payload = buildPayload();
    if (isProcessTable.value) {
      payload.version = processVersionForm.value.version?.trim();
      payload.version_name = processVersionForm.value.name?.trim() || undefined;
      payload.version_slug = processVersionForm.value.slug?.trim() || undefined;
      payload.version_effective_from = processVersionForm.value.effective_from || undefined;
      payload.version_effective_to = processVersionForm.value.effective_to || undefined;
      const parentVersionId = processVersionForm.value.parent_version_id;
      payload.version_parent_version_id = parentVersionId ? Number(parentVersionId) : undefined;
    }
    if (editorMode.value === "create") {
      await axios.post(API_ROUTES.ADMIN_SQL_TABLE(props.table.table), payload);
    } else {
      const keys = buildKeys(selectedRow.value || {});
      await axios.put(API_ROUTES.ADMIN_SQL_TABLE(props.table.table), {
        keys,
        data: payload
      });
    }
    editorInstance?.hide();
    await fetchRows();
  } catch (err) {
    modalError.value = err?.response?.data?.message || "No se pudo guardar el registro.";
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
    deleteInstance?.hide();
    await fetchRows();
  } catch (err) {
    error.value = err?.response?.data?.message || "No se pudo eliminar el registro.";
  }
};

watch(
  () => props.table?.table,
  () => {
    resetForm();
    resetProcessVersionForm("create");
    resetProcessVersionEditor();
    resetPersonAssignments();
    processFilters.value = {
      unit_id: "",
      parent_id: "",
      has_document: "",
      is_active: ""
    };
    processFilterLabels.value = {
      unit_id: "",
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
    fetchRows();
  },
  { immediate: true }
);

onMounted(() => {
  document.addEventListener("click", handleDocumentClick);
});

onBeforeUnmount(() => {
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
  document.removeEventListener("click", handleDocumentClick);
});

defineExpose({
  openCreate
});
</script>
