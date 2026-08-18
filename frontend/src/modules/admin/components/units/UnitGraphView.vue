<template>
  <div class="flex flex-col gap-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="flex items-center gap-2 text-sm text-muted">
        <span class="font-semibold text-body">Organigrama</span>
        <span>· {{ nodes.length }} unidades · {{ edges.length }} relaciones</span>
        <AppInfoTip placement="bottom" aria-label="Ayuda del organigrama">
          <template v-if="editable">
            Haz clic en una unidad para ver sus puestos y ocupaciones. Pasa el cursor sobre una unidad para
            editar / agregar hijos, o arrastra desde su punto inferior al superior de otra para crear una
            relación. Usa los botones de cada relación para cambiar su tipo o quitarla.
          </template>
          <template v-else>
            Haz clic en una unidad para ver sus puestos y ocupaciones. Vista de solo lectura: no tienes
            permisos para editar.
          </template>
        </AppInfoTip>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <label class="flex items-center gap-1.5 text-xs font-medium text-icon">
          Relación
          <select
            v-model="activeRelationType"
            class="h-8 border px-2 text-xs font-semibold text-body outline-none"
          >
            <option v-for="rt in relationTypes" :key="rt.id" :value="rt.code">{{ rt.name }}</option>
            <option value="all">Todos los tipos</option>
          </select>
        </label>
        <label class="flex items-center gap-1.5 text-xs font-medium text-icon">
          <input v-model="showInactive" type="checkbox" class="text-primary" />
          Mostrar inactivas
        </label>
        <AppButton v-if="editable" variant="neutral-outline" :disabled="loading" @click="$emit('create-unit')">+ Unidad</AppButton>
        <AppButton variant="neutral-outline" :disabled="loading" @click="loadGraph">Refrescar</AppButton>
      </div>
    </div>

    <!-- Controles: buscar/centrar, salud, exportar -->
    <div class="flex flex-wrap items-center gap-3">
      <div class="flex items-center gap-1.5">
        <input
          v-model="searchTerm"
          type="text"
          aria-label="Buscar unidad"
          placeholder="Buscar unidad…"
          class="h-8 w-52 border px-3 text-xs outline-none"
          @keyup.enter="searchAndCenter"
        />
        <AppButton variant="neutral-outline" @click="searchAndCenter">Buscar</AppButton>
      </div>
      <label class="flex items-center gap-1.5 text-xs font-medium text-icon">
        <input v-model="healthOnly" type="checkbox" class="text-warning" />
        Resaltar pendientes
        <AppTag v-if="pendingCount" variant="warning">{{ pendingCount }}</AppTag>
      </label>
      <AppButton variant="neutral-outline" :disabled="exporting" @click="exportPng">{{ exporting ? "Exportando…" : "Exportar PNG" }}</AppButton>
    </div>

    <!-- Leyenda de tipos de relación presentes -->
    <div v-if="legend.length > 1" class="flex flex-wrap items-center gap-3">
      <span v-for="item in legend" :key="item.code" class="inline-flex items-center gap-1.5 text-xs font-medium text-icon">
        <span class="inline-block h-2.5 w-4 rounded-full" :style="{ backgroundColor: item.color }"></span>
        {{ item.name }}
      </span>
    </div>

    <AppAlert v-if="feedback.message" :variant="feedback.kind === 'error' ? 'danger' : 'success'">
      {{ feedback.message }}
    </AppAlert>

    <div ref="graphCanvas" class="graph-canvas rounded-2xl border border-line bg-surface">
      <div v-if="loading" class="flex h-full items-center justify-center text-sm text-muted">Cargando organigrama…</div>
      <div v-else-if="error" class="flex h-full items-center justify-center px-6 text-center text-sm text-danger">{{ error }}</div>
      <div v-else-if="!nodes.length" class="flex h-full items-center justify-center text-sm text-muted">No hay unidades para mostrar.</div>
      <VueFlow
        v-else
        v-model:nodes="nodes"
        v-model:edges="edges"
        :min-zoom="0.2"
        :max-zoom="2"
        :nodes-connectable="editable"
        :edges-updatable="editable"
        :delete-key-code="null"
        :only-render-visible-elements="true"
        fit-view-on-init
        class="h-full"
        @connect="onConnect"
        @node-click="onNodeClick"
        @edge-update="onEdgeUpdate"
      >
        <Background pattern-color="#cbd5e1" :gap="20" />
        <Controls />
        <template #node-unit="nodeProps">
          <UnitNode :data="nodeProps.data" />
        </template>
        <template #edge-unit="edgeProps">
          <UnitEdge v-bind="edgeProps" />
        </template>
      </VueFlow>
    </div>

    <!-- Confirmar quitar relación -->
    <AppModalShell
      v-if="Boolean(selectedEdge)"
      controlled
      :open="Boolean(selectedEdge)"
      title="Quitar relación"
      content-class="max-w-md"
      @close="selectedEdge = null"
    >
      <p class="m-0 text-sm text-icon">
        ¿Quitar la relación <strong>{{ selectedEdgeLabel }}</strong>? La unidad hija quedará sin padre en este tipo de relación.
      </p>
      <template #footer>
        <AppButton variant="danger-outline" @click="selectedEdge = null">Cancelar</AppButton>
        <AppButton variant="danger-outline" @click="confirmDeleteEdge">Quitar</AppButton>
      </template>
    </AppModalShell>

    <!-- Cambiar el tipo de una relación existente -->
    <AppModalShell
      v-if="Boolean(editingEdge)"
      controlled
      :open="Boolean(editingEdge)"
      title="Cambiar tipo de relación"
      content-class="max-w-md"
      @close="editingEdge = null"
    >
      <p class="m-0 mb-3 text-sm text-icon">Relación <strong>{{ editingEdgeLabel }}</strong>.</p>
      <label class="deasy-form-label">
        Tipo de relación
        <select v-model="editingTypeCode" class="mt-1 h-10 w-full border px-2 text-sm font-medium text-body outline-none">
          <option v-for="rt in relationTypes" :key="rt.id" :value="rt.code">{{ rt.name }}</option>
        </select>
      </label>
      <template #footer>
        <AppButton variant="danger-outline" @click="editingEdge = null">Cancelar</AppButton>
        <AppButton variant="primary-outline" @click="confirmEditEdge">Guardar</AppButton>
      </template>
    </AppModalShell>

    <!-- Crear unidad hija/hermana (con su relación) en un paso -->
    <AppModalShell
      v-if="Boolean(createContext)"
      controlled
      :open="Boolean(createContext)"
      :title="createDialogTitle"
      content-class="max-w-md"
      @close="createContext = null"
    >
      <p class="m-0 mb-3 text-sm text-icon">{{ createDialogHint }}</p>
      <div class="flex flex-col gap-3">
        <label class="deasy-form-label">
          Nombre
          <input v-model="createForm.name" type="text" class="mt-1 h-10 w-full border px-3 text-sm outline-none" placeholder="Nombre de la unidad" />
        </label>
        <label class="deasy-form-label">
          Tipo de unidad
          <select v-model="createForm.unit_type_id" class="mt-1 h-10 w-full border px-2 text-sm outline-none">
            <option value="">Selecciona…</option>
            <option v-for="ut in unitTypes" :key="ut.id" :value="ut.id">{{ ut.name }}</option>
          </select>
        </label>
        <label class="deasy-form-label">
          Slug <span class="font-normal text-muted">(opcional)</span>
          <input v-model="createForm.slug" type="text" class="mt-1 h-10 w-full border px-3 text-sm outline-none" placeholder="se deriva del nombre" />
        </label>
      </div>
      <template #footer>
        <AppButton variant="danger-outline" @click="createContext = null">Cancelar</AppButton>
        <AppButton variant="primary-outline" :disabled="!createForm.name.trim() || !createForm.unit_type_id" @click="confirmCreateUnit">Crear</AppButton>
      </template>
    </AppModalShell>

    <!-- Drawer: detalle de unidad (puestos y ocupaciones) -->
    <div v-if="detailUnit" class="deasy-drawer-overlay" @click.self="closeDetail">
      <aside class="deasy-drawer">
        <header class="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div class="min-w-0">
            <p class="deasy-overline">Detalle de unidad</p>
            <h3 class="m-0 mt-0.5 truncate text-base font-bold text-strong">{{ detailUnit.name }}</h3>
          </div>
          <AppCloseButton class="shrink-0" @click="closeDetail" />
        </header>

        <!-- Pestañas del panel -->
        <div class="deasy-inline-tabs px-5" role="tablist">
          <button type="button" role="tab" class="deasy-inline-tab" :class="detailTab === 'ocupaciones' ? 'deasy-inline-tab--active' : ''" :aria-selected="detailTab === 'ocupaciones'" @click="setDetailTab('ocupaciones')">Ocupaciones</button>
          <button type="button" role="tab" class="deasy-inline-tab" :class="detailTab === 'procesos' ? 'deasy-inline-tab--active' : ''" :aria-selected="detailTab === 'procesos'" @click="setDetailTab('procesos')">Procesos</button>
        </div>

        <div class="flex-1 overflow-y-auto px-5 py-4">
          <!-- Pestaña: Ocupaciones -->
          <div v-show="detailTab === 'ocupaciones'">
          <div class="mb-3 flex items-center justify-between gap-2">
            <p class="deasy-overline">Puestos y ocupaciones</p>
            <AppButton v-if="editable" variant="neutral-outline" @click="addingPosition = !addingPosition">+ Puesto</AppButton>
          </div>

          <!-- Formulario de nuevo puesto -->
          <div v-if="editable && addingPosition" class="mb-3 rounded-xl border border-brand-200 bg-brand-50/40 p-3">
            <div class="flex flex-col gap-2">
              <select v-model="positionForm.cargo_id" aria-label="Cargo del nuevo puesto" class="h-9 w-full border px-2 text-sm outline-none">
                <option value="">Cargo…</option>
                <option v-for="c in cargos" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
              <input v-model="positionForm.title" type="text" aria-label="Título del nuevo puesto (opcional)" placeholder="Título (opcional)" class="h-9 w-full border px-3 text-sm outline-none" />
              <div class="flex items-center gap-3">
                <select v-model="positionForm.position_type" aria-label="Tipo del nuevo puesto" class="h-9 flex-1 border px-2 text-sm outline-none">
                  <option value="real">Real</option>
                  <option value="promocion">Promoción</option>
                  <option value="simbolico">Simbólico</option>
                </select>
                <SToggle v-model="positionForm.is_unit_head" label="Jefatura" label-position="end" />
              </div>
              <div class="flex justify-end gap-2">
                <AppButton variant="danger-outline" @click="addingPosition = false">Cancelar</AppButton>
                <AppButton variant="primary-outline" :disabled="!positionForm.cargo_id" @click="confirmAddPosition">Crear puesto</AppButton>
              </div>
            </div>
          </div>

          <div v-if="detailLoading" class="text-sm text-muted">Cargando…</div>
          <div v-else-if="!detailPositions.length" class="deasy-empty">
            Esta unidad no tiene puestos registrados.
          </div>
          <ul v-else class="m-0 flex list-none flex-col gap-2 p-0">
            <li v-for="pos in detailPositions" :key="pos.id" class="rounded-xl border border-line px-3 py-2.5">
              <div class="flex items-center gap-2">
                <IconCrown v-if="pos.is_unit_head" class="h-4 w-4 shrink-0 text-warning" title="Jefatura" />
                <span class="truncate text-sm font-semibold text-strong">{{ pos.cargo_name || pos.title || 'Puesto' }}</span>
                <span class="text-xs text-muted">#{{ pos.slot_no }}</span>
                <span v-if="!pos.is_active" class="ml-auto text-theme-xs font-semibold text-danger">Inactivo</span>
                <div v-if="editable" class="ml-auto flex items-center gap-1">
                  <AppButton
                    :variant="pos.is_unit_head ? 'warning-soft' : 'neutral-soft'"
                    icon-only
                    title="Marcar/quitar jefatura"
                    aria-label="Marcar/quitar jefatura"
                    @click="toggleHead(pos)"
                  >
                    <IconCrown class="h-5 w-5" />
                  </AppButton>
                  <AppButton
                    variant="success-soft"
                    icon-only
                    title="Editar puesto"
                    aria-label="Editar puesto"
                    @click="openEditPosition(pos)"
                  >
                    <IconPencil class="h-5 w-5" />
                  </AppButton>
                  <AppButton
                    variant="danger-soft"
                    icon-only
                    title="Eliminar puesto"
                    aria-label="Eliminar puesto"
                    @click="removePosition(pos.id)"
                  >
                    <IconTrash class="h-5 w-5" />
                  </AppButton>
                </div>
              </div>
              <div class="mt-1 flex flex-wrap items-center gap-2 text-xs">
                <template v-if="pos.person_id">
                  <AppTag variant="success">Ocupado</AppTag>
                  <span class="truncate text-icon">{{ (pos.person_name || '').trim() }} · {{ pos.cedula }}</span>
                  <div v-if="editable" class="ml-auto flex items-center gap-1">
                    <AppButton
                      variant="success-soft"
                      icon-only
                      title="Cambiar persona asignada"
                      aria-label="Cambiar persona asignada"
                      @click="openAssign(pos.id)"
                    >
                      <IconUserEdit class="h-5 w-5" />
                    </AppButton>
                    <AppButton
                      variant="danger-soft"
                      icon-only
                      title="Quitar persona del puesto"
                      aria-label="Quitar persona del puesto"
                      @click="unassign(pos.id)"
                    >
                      <IconUserMinus class="h-5 w-5" />
                    </AppButton>
                  </div>
                </template>
                <template v-else>
                  <span class="inline-flex items-center rounded-xl bg-surface px-2 py-0.5 font-semibold text-muted ring-1 ring-line">Vacante</span>
                  <AppButton
                    v-if="editable"
                    variant="success-soft"
                    icon-only
                    class-name="ml-auto"
                    title="Asignar persona al puesto"
                    aria-label="Asignar persona al puesto"
                    @click="openAssign(pos.id)"
                  >
                    <IconUserPlus class="h-5 w-5" />
                  </AppButton>
                </template>
              </div>

              <!-- Acceso al wizard de perfil (visible, con texto) -->
              <AppButton
                v-if="editable"
                variant="neutral-outline"
                class-name="mt-2"
                @click="openProfileWizard(pos)"
              >
                <IconFileDescription class="h-3.5 w-3.5" />
                {{ pos.profile ? 'Editar perfil' : 'Definir perfil' }}
              </AppButton>

              <!-- Buscador de persona para asignar -->
              <div v-if="editable && assignForId === pos.id" class="mt-2 rounded-2xl border border-line bg-surface p-2">
                <input
                  v-model="personQuery"
                  type="text"
                  aria-label="Buscar persona por nombre o cédula"
                  placeholder="Buscar persona (nombre o cédula)…"
                  class="h-8 w-full border px-2 text-xs outline-none"
                  @input="searchPersons"
                />
                <div v-if="personSearching" class="mt-1 px-1 text-theme-xs text-muted">Buscando…</div>
                <ul v-else-if="personResults.length" class="m-0 mt-1 flex max-h-40 list-none flex-col gap-0.5 overflow-y-auto p-0">
                  <li v-for="per in personResults" :key="per.id">
                    <button type="button" class="deasy-option deasy-option--split" @click="pickPerson(per.id)">
                      <span class="truncate text-body">{{ per.first_name }} {{ per.last_name }}</span>
                      <span class="ml-2 shrink-0 text-muted">{{ per.cedula }}</span>
                    </button>
                  </li>
                </ul>
                <div v-else-if="personQuery.trim().length >= 2" class="mt-1 px-1 text-theme-xs text-muted">Sin resultados.</div>
              </div>
            </li>
          </ul>
          </div>

          <!-- Pestaña: Procesos de la unidad (alcance) -->
          <div v-show="detailTab === 'procesos'">
            <div class="mb-3 flex items-center justify-between gap-2">
              <p class="deasy-overline">Procesos de la unidad</p>
              <div class="flex items-center gap-2">
                <AppButton v-if="editable" variant="neutral-outline" title="Vincular una configuración en borrador existente a esta unidad" @click="openAttachProcess">Vincular</AppButton>
                <AppButton v-if="editable && canCreateProcess" variant="primary-outline" @click="$emit('create-process')">+ Nueva configuración</AppButton>
              </div>
            </div>
            <div v-if="detailProcessesLoading" class="text-sm text-muted">Cargando…</div>
            <div v-else-if="!detailProcesses.length" class="deasy-empty">
              Ningún proceso aplica a esta unidad.
            </div>
            <ul v-else class="m-0 flex list-none flex-col gap-2 p-0">
              <li v-for="proc in detailProcesses" :key="proc.rule_id" class="rounded-xl border border-line px-3 py-2.5">
                <div class="flex items-center gap-2">
                  <span class="truncate text-sm font-semibold text-strong">{{ proc.process_name }}</span>
                  <AppTag :variant="tonoOrigen(proc.origin)" size="sm" outlined class-name="ml-auto">{{ processOriginMeta(proc.origin).label }}</AppTag>
                  <AppTag :variant="tonoCicloVida(proc.status)" size="sm" outlined>{{ etiquetaCicloVida(proc.status) }}</AppTag>
                </div>
                <div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span class="truncate">{{ proc.definition_name }} · v{{ proc.definition_version }}</span>
                  <span class="inline-flex items-center rounded-xl bg-surface px-2 py-0.5 font-semibold text-icon ring-1 ring-line">{{ processScopeLabel(proc.unit_scope_type) }}</span>
                </div>
                <div class="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                  <span class="text-muted">Destinatario: <span class="font-medium text-body">{{ recipientSummary(proc) }}</span></span>
                  <div v-if="editable && proc.origin === 'direct' && proc.status === 'draft'" class="ml-auto flex items-center gap-1">
                    <AppButton
                      variant="success-soft"
                      icon-only
                      title="Editar alcance de la regla"
                      aria-label="Editar alcance de la regla"
                      @click="openEditProcessRule(proc)"
                    >
                      <IconPencil class="h-5 w-5" />
                    </AppButton>
                    <AppButton
                      variant="danger-soft"
                      icon-only
                      title="Quitar el proceso de esta unidad"
                      aria-label="Quitar el proceso de esta unidad"
                      @click="detachProcess(proc.rule_id)"
                    >
                      <IconUnlink class="h-5 w-5" />
                    </AppButton>
                  </div>
                  <span v-else-if="proc.origin === 'direct'" class="ml-auto text-theme-xs italic text-muted">Versiona el proceso para cambiar el alcance</span>
                  <span v-else class="ml-auto text-theme-xs italic text-muted">Definido a nivel de proceso</span>
                </div>
              </li>
            </ul>
            <p class="m-0 mt-3 text-theme-xs leading-snug text-muted">
              "Directo" = regla propia de esta unidad. El alcance solo se edita mientras la configuración está
              en <span class="font-semibold">borrador</span>; al activarse queda fija (cambiarla ⇒ nueva versión).
              "Por tipo"/"Global" se definen en la configuración del proceso y aplican a varias unidades.
            </p>
          </div>
        </div>
      </aside>
    </div>

    <!-- Editar puesto (cargo, título, tipo, jefatura, activo) -->
    <AppModalShell
      v-if="Boolean(editingPosition)"
      controlled
      :open="Boolean(editingPosition)"
      title="Editar puesto"
      content-class="max-w-md"
      @close="editingPosition = null"
    >
      <div class="flex flex-col gap-3">
        <label class="deasy-form-label">
          Cargo
          <select v-model="editPositionForm.cargo_id" class="mt-1 h-10 w-full border px-2 text-sm outline-none">
            <option value="">Selecciona…</option>
            <option v-for="c in cargos" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </label>
        <label class="deasy-form-label">
          Título <span class="font-normal text-muted">(opcional)</span>
          <input v-model="editPositionForm.title" type="text" class="mt-1 h-10 w-full border px-3 text-sm outline-none" placeholder="Título del puesto" />
        </label>
        <label class="deasy-form-label">
          Tipo
          <select v-model="editPositionForm.position_type" class="mt-1 h-10 w-full border px-2 text-sm outline-none">
            <option value="real">Real</option>
            <option value="promocion">Promoción</option>
            <option value="simbolico">Simbólico</option>
          </select>
        </label>
        <div class="flex items-center gap-6">
          <SToggle v-model="editPositionForm.is_unit_head" label="Jefatura" label-position="end" />
          <SToggle v-model="editPositionForm.is_active" label="Activo" label-position="end" />
        </div>

      </div>
      <template #footer>
        <AppButton variant="danger-outline" @click="editingPosition = null">Cancelar</AppButton>
        <AppButton variant="primary-outline" :disabled="!editPositionForm.cargo_id" @click="confirmEditPosition">Guardar</AppButton>
      </template>
    </AppModalShell>

    <!-- Wizard de perfil del puesto -->
    <UnitPositionProfileWizard
      :open="Boolean(profileWizardPosition)"
      :position="profileWizardPosition"
      @close="profileWizardPosition = null"
      @save="saveProfileWizard"
    />

    <!-- Vincular / editar proceso de la unidad (regla de alcance) -->
    <AppModalShell
      v-if="processModalOpen"
      controlled
      :open="processModalOpen"
      :title="processEditingRuleId ? 'Editar proceso de la unidad' : 'Vincular proceso a la unidad'"
      content-class="max-w-md"
      @close="processModalOpen = false"
    >
      <div class="flex flex-col gap-3">
        <label class="deasy-form-label">
          Proceso (configuración en borrador)
          <select
            v-model="processForm.process_definition_id"
            :disabled="Boolean(processEditingRuleId)"
            class="mt-1 h-10 w-full border px-2 text-sm outline-none"
          >
            <option value="">Selecciona…</option>
            <option v-for="def in attachableProcesses" :key="def.definition_id" :value="def.definition_id">
              {{ def.process_name }} · {{ def.variation_key }} · v{{ def.definition_version }}
            </option>
          </select>
          <span v-if="!processEditingRuleId && attachableLoaded && !attachableProcesses.length" class="mt-1 block text-theme-xs text-warning">
            No hay configuraciones en borrador acotables por unidad. El alcance solo se edita en borrador; las variaciones por tipo de unidad se gestionan en la configuración del proceso.
          </span>
        </label>

        <label class="deasy-form-label">
          Alcance
          <select v-model="processForm.unit_scope_type" class="mt-1 h-10 w-full border px-2 text-sm outline-none">
            <option value="unit_exact">Solo esta unidad</option>
            <option value="unit_subtree">Esta unidad y sus dependientes</option>
          </select>
        </label>

        <label class="deasy-form-label">
          Entrega (destinatario)
          <select v-model="processForm.recipient_policy" class="mt-1 h-10 w-full border px-2 text-sm outline-none">
            <option value="all_matches">Todos los del cargo</option>
            <option value="one_per_unit">Jefatura de la unidad</option>
            <option value="exact_position">Puesto exacto</option>
          </select>
        </label>

        <!-- Cargo: fijado por la serie (variación por cargo) o seleccionable (variación default) -->
        <div v-if="processForm.recipient_policy !== 'exact_position'">
          <div v-if="seriesLockedCargo" class="rounded-2xl border border-brand-200 bg-brand-50/50 px-3 py-2 text-xs text-primary">
            Cargo fijado por la serie: <span class="font-semibold">{{ seriesLockedCargo.name }}</span>
          </div>
          <label v-else class="deasy-form-label">
            Cargo destinatario
            <select v-model="processForm.cargo_id" class="mt-1 h-10 w-full border px-2 text-sm outline-none">
              <option value="">Selecciona…</option>
              <option v-for="c in cargos" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </label>
        </div>

        <!-- Puesto exacto: de los puestos de esta unidad -->
        <label v-else class="deasy-form-label">
          Puesto de la unidad
          <select v-model="processForm.position_id" class="mt-1 h-10 w-full border px-2 text-sm outline-none">
            <option value="">Selecciona…</option>
            <option v-for="pos in detailPositions" :key="pos.id" :value="pos.id">
              {{ pos.cargo_name || pos.title || 'Puesto' }} #{{ pos.slot_no }}
            </option>
          </select>
        </label>
      </div>
      <template #footer>
        <AppButton variant="danger-outline" @click="processModalOpen = false">Cancelar</AppButton>
        <AppButton
          variant="primary-outline"
          :disabled="processSaving || !processForm.process_definition_id
            || (processForm.recipient_policy === 'exact_position' && !processForm.position_id)
            || (processForm.recipient_policy !== 'exact_position' && !seriesLockedCargo && !processForm.cargo_id)"
          @click="confirmProcessRule"
        >
          {{ processSaving ? 'Guardando…' : (processEditingRuleId ? 'Guardar' : 'Vincular') }}
        </AppButton>
      </template>
    </AppModalShell>
  </div>
</template>

<script setup>
import AppAlert from "@/shared/components/feedback/AppAlert.vue";
import AppTag from "@/shared/components/data/AppTag.vue";
import { tonoCicloVida, tonoOrigen, etiquetaCicloVida } from "@/shared/utils/estadoTono.js";
import AppCloseButton from "@/shared/components/buttons/AppCloseButton.vue";
import { ref, computed, watch, onMounted } from "vue";
import { VueFlow, MarkerType, useVueFlow } from "@vue-flow/core";
import { toBlob } from "html-to-image";
import { Background } from "@vue-flow/background";
import { Controls } from "@vue-flow/controls";
import dagre from "dagre";
import "@vue-flow/core/dist/style.css";
import "@vue-flow/core/dist/theme-default.css";
import "@vue-flow/controls/dist/style.css";
import AppButton from "@/shared/components/buttons/AppButton.vue";
import AppModalShell from "@/shared/components/modals/AppModalShell.vue";
import AppInfoTip from "@/shared/components/widgets/AppInfoTip.vue";
import SToggle from "@/shared/components/forms/SToggle.vue";
import UnitNode from "./UnitNode.vue";
import UnitEdge from "./UnitEdge.vue";
import UnitPositionProfileWizard from "./UnitPositionProfileWizard.vue";
import { IconCrown, IconFileDescription, IconPencil, IconTrash, IconUnlink, IconUserEdit, IconUserMinus, IconUserPlus } from "@tabler/icons-vue";
import { adminSqlService } from "@/modules/admin/services/AdminSqlService";

const props = defineProps({
  relationType: { type: String, default: "org" },
  editable: { type: Boolean, default: true },
  canCreateProcess: { type: Boolean, default: true }
});
const emit = defineEmits(["edit-unit", "create-unit", "create-process"]);

const EDGE_PALETTE = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#14b8a6"];

const nodes = ref([]);
const edges = ref([]);
const rawGraph = ref({ nodes: [], edges: [] });
const relationTypes = ref([]);
const activeRelationType = ref(props.relationType);
const loading = ref(false);
const error = ref("");
const showInactive = ref(true);
const selectedEdge = ref(null);
const editingEdge = ref(null);
const editingTypeCode = ref("");
const unitTypes = ref([]);
const createContext = ref(null);
const createForm = ref({ name: "", slug: "", unit_type_id: "" });
const detailUnit = ref(null);
const detailPositions = ref([]);
const detailLoading = ref(false);
const detailTab = ref("ocupaciones");
const detailProcesses = ref([]);
const detailProcessesLoading = ref(false);
const detailProcessesLoaded = ref(false);
// Gestión de puestos/ocupaciones en el drawer.
const cargos = ref([]);
const addingPosition = ref(false);
const positionForm = ref({ cargo_id: "", title: "", position_type: "real", is_unit_head: false });
const assignForId = ref(null);
const personQuery = ref("");
const personResults = ref([]);
const personSearching = ref(false);
const editingPosition = ref(null);
const editPositionForm = ref({ cargo_id: "", title: "", position_type: "real", is_unit_head: false, is_active: true });
// Wizard de perfil del puesto (formación/experiencia/capacitación/investigación) → columna JSON `profile`.
const profileWizardPosition = ref(null);
const feedback = ref({ kind: "", message: "" });
// F-E: buscar/centrar, colapsar ramas, salud, exportar.
const { fitView } = useVueFlow();
const searchTerm = ref("");
const collapsedIds = ref(new Set());
const highlightId = ref(null);
const healthOnly = ref(false);
const exporting = ref(false);
let feedbackTimer = null;

const NODE_W = 210;
const NODE_H = 64;

const relationColorMap = computed(() => {
  const map = new Map();
  relationTypes.value.forEach((rt, idx) => map.set(rt.code, EDGE_PALETTE[idx % EDGE_PALETTE.length]));
  return map;
});
const colorForCode = (code) => relationColorMap.value.get(code) || "#94a3b8";

const nodeNameById = computed(() => {
  const map = new Map();
  (rawGraph.value.nodes || []).forEach((u) => map.set(String(u.id), u.name));
  return map;
});
const edgeLabel = (edge) => {
  if (!edge) return "";
  const p = nodeNameById.value.get(String(edge.source)) || edge.source;
  const c = nodeNameById.value.get(String(edge.target)) || edge.target;
  return `${p} → ${c}`;
};
const selectedEdgeLabel = computed(() => edgeLabel(selectedEdge.value));
const editingEdgeLabel = computed(() => edgeLabel(editingEdge.value));
const legend = computed(() => {
  const codes = new Set((rawGraph.value.edges || []).map((e) => e.relation_type_code));
  return relationTypes.value
    .filter((rt) => codes.has(rt.code))
    .map((rt) => ({ code: rt.code, name: rt.name, color: colorForCode(rt.code) }));
});

// Salud: una unidad tiene pendientes si no tiene jefatura o no tiene puestos.
const healthIssues = (u) => {
  const issues = [];
  if (!Number(u.head_count)) issues.push("Sin jefatura");
  if (!Number(u.positions_count)) issues.push("Sin puestos");
  return issues;
};
const pendingCount = computed(
  () => (rawGraph.value.nodes || []).filter((u) => healthIssues(u).length).length
);
// Mapa padre→hijos (tipo de relación activo) para colapsar ramas.
const childrenMap = computed(() => {
  const map = new Map();
  (rawGraph.value.edges || []).forEach((e) => {
    const p = String(e.parent_unit_id);
    if (!map.has(p)) map.set(p, []);
    map.get(p).push(String(e.child_unit_id));
  });
  return map;
});
const hiddenByCollapse = computed(() => {
  const hidden = new Set();
  const walk = (id) => {
    (childrenMap.value.get(String(id)) || []).forEach((childId) => {
      if (!hidden.has(childId)) {
        hidden.add(childId);
        walk(childId);
      }
    });
  };
  collapsedIds.value.forEach((id) => walk(id));
  return hidden;
});

const toggleCollapse = (unitId) => {
  const id = String(unitId);
  const next = new Set(collapsedIds.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  collapsedIds.value = next;
  buildGraph();
};

// Buscar y centrar una unidad por nombre.
const searchAndCenter = () => {
  const term = searchTerm.value.trim().toLowerCase();
  if (!term) return;
  const match = (rawGraph.value.nodes || []).find((u) =>
    String(u.name || "").toLowerCase().includes(term)
  );
  if (!match) {
    setFeedback("error", "No se encontró ninguna unidad con ese nombre.");
    return;
  }
  // Si está oculta por colapso, expande sus ancestros (simple: limpia colapsados).
  if (hiddenByCollapse.value.has(String(match.id))) {
    collapsedIds.value = new Set();
    buildGraph();
  }
  highlightId.value = String(match.id);
  buildGraph();
  fitView({ nodes: [{ id: String(match.id) }], duration: 600, maxZoom: 1.2, padding: 0.6 });
};

const graphCanvas = ref(null);

const exportPng = async () => {
  // Acotado a la raiz propia (no document.*): evita chocar con el canvas de ProcessGraph, que compartia clase.
  const root = graphCanvas.value;
  const target = root?.querySelector(".vue-flow") || root?.querySelector(".vue-flow__viewport");
  if (!target) {
    setFeedback("error", "No se encontró el lienzo para exportar.");
    return;
  }
  exporting.value = true;
  try {
    // toBlob + reintento sin fuentes: la incrustación de webfonts es la causa más común de fallo (CORS/caché).
    const opts = { backgroundColor: "#ffffff", pixelRatio: 2, cacheBust: true };
    let blob = null;
    try {
      blob = await toBlob(target, opts);
    } catch {
      blob = await toBlob(target, { ...opts, skipFonts: true });
    }
    if (!blob) {
      throw new Error("el lienzo no devolvió imagen");
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.download = `organigrama-${activeRelationType.value}.png`;
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);
    setFeedback("success", "Organigrama exportado.");
  } catch (e) {
    setFeedback("error", `No se pudo exportar la imagen: ${e?.message || e}`);
  } finally {
    exporting.value = false;
  }
};

const setFeedback = (kind, message) => {
  feedback.value = { kind, message };
  if (feedbackTimer) clearTimeout(feedbackTimer);
  feedbackTimer = setTimeout(() => { feedback.value = { kind: "", message: "" }; }, 4000);
};

// Auto-layout jerárquico (top-down) con dagre.
const layout = (rawNodes, rawEdges) => {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", nodesep: 45, ranksep: 75 });
  g.setDefaultEdgeLabel(() => ({}));
  rawNodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  rawEdges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);
  return rawNodes.map((n) => {
    const p = g.node(n.id);
    return { ...n, position: { x: p.x - NODE_W / 2, y: p.y - NODE_H / 2 } };
  });
};

const buildGraph = () => {
  const hidden = hiddenByCollapse.value;
  const apiNodes = (rawGraph.value.nodes || []).filter(
    (u) => (showInactive.value || Number(u.is_active) === 1) && !hidden.has(String(u.id))
  );
  const visibleIds = new Set(apiNodes.map((u) => String(u.id)));
  const rawNodes = apiNodes.map((u) => {
    const issues = healthIssues(u);
    return {
      id: String(u.id),
      type: "unit",
      position: { x: 0, y: 0 },
      data: {
        ...u,
        editable: props.editable,
        onEdit: editUnit,
        onAddChild,
        onAddSibling,
        onToggleCollapse: toggleCollapse,
        healthIssues: issues,
        hasChildren: childrenMap.value.has(String(u.id)),
        collapsed: collapsedIds.value.has(String(u.id)),
        highlighted: highlightId.value === String(u.id),
        dimmed: healthOnly.value && !issues.length
      }
    };
  });
  const rawEdges = (rawGraph.value.edges || [])
    .filter((e) => visibleIds.has(String(e.parent_unit_id)) && visibleIds.has(String(e.child_unit_id)))
    .map((e) => {
      const color = colorForCode(e.relation_type_code);
      return {
        id: `e${e.id}`,
        type: "unit",
        source: String(e.parent_unit_id),
        target: String(e.child_unit_id),
        updatable: props.editable,
        markerEnd: { type: MarkerType.ArrowClosed, color },
        style: { stroke: color, strokeWidth: 1.6 },
        data: {
          relationId: e.id,
          relationTypeId: e.relation_type_id,
          code: e.relation_type_code,
          editable: props.editable,
          onEdit: openEditEdge,
          onDelete: openDeleteEdge
        }
      };
    });
  nodes.value = rawNodes.length ? layout(rawNodes, rawEdges) : [];
  edges.value = rawEdges;
};

const loadGraph = async () => {
  loading.value = true;
  error.value = "";
  try {
    const { data } = await adminSqlService.getUnitGraph(activeRelationType.value);
    rawGraph.value = { nodes: data.nodes || [], edges: data.edges || [] };
    relationTypes.value = data.relationTypes || [];
    buildGraph();
  } catch (e) {
    error.value = e?.response?.data?.message || "No se pudo cargar el organigrama.";
  } finally {
    loading.value = false;
  }
};

const rawUnitById = (unitId) =>
  (rawGraph.value.nodes || []).find((u) => String(u.id) === String(unitId)) || null;

// Clic en nodo / botón Editar: abre el editor de unidad existente (en el componente padre).
const editUnit = (unitId) => {
  if (!props.editable) return;
  const u = rawUnitById(unitId);
  if (u) emit("edit-unit", { ...u });
};
// Clic en el nodo: abre el panel derecho de puestos y ocupaciones (la edición se hace desde la toolbar).
const onNodeClick = ({ node }) => {
  if (!node?.data) return;
  openDetail(node.data.id);
};

// Detalle de unidad (drawer): puestos y ocupaciones.
const openDetail = async (unitId) => {
  const u = rawUnitById(unitId);
  detailUnit.value = u ? { id: u.id, name: u.name } : { id: unitId, name: "" };
  detailTab.value = "ocupaciones";
  detailProcesses.value = [];
  detailProcessesLoaded.value = false;
  detailPositions.value = [];
  detailLoading.value = true;
  try {
    const { data } = await adminSqlService.getUnitDetail(unitId);
    detailUnit.value = data.unit || detailUnit.value;
    detailPositions.value = data.positions || [];
  } catch (e) {
    setFeedback("error", e?.response?.data?.message || "No se pudo cargar el detalle.");
    detailUnit.value = null;
  } finally {
    detailLoading.value = false;
  }
};
const closeDetail = () => {
  detailUnit.value = null;
  detailPositions.value = [];
  addingPosition.value = false;
  assignForId.value = null;
  editingPosition.value = null;
  profileWizardPosition.value = null;
  processModalOpen.value = false;
  processEditingRuleId.value = null;
  attachableLoaded.value = false;
  attachableProcesses.value = [];
  detailTab.value = "ocupaciones";
};

// Pestaña "Procesos" del drawer: procesos que aplican a la unidad (carga perezosa).
const loadUnitProcesses = async () => {
  if (!detailUnit.value?.id || detailProcessesLoaded.value) return;
  detailProcessesLoading.value = true;
  try {
    const { data } = await adminSqlService.getUnitProcesses(detailUnit.value.id);
    detailProcesses.value = data.processes || [];
    detailProcessesLoaded.value = true;
  } catch (e) {
    setFeedback("error", e?.response?.data?.message || "No se pudieron cargar los procesos.");
  } finally {
    detailProcessesLoading.value = false;
  }
};
const setDetailTab = (tab) => {
  detailTab.value = tab;
  if (tab === "procesos") loadUnitProcesses();
};
const PROCESS_SCOPE_LABELS = {
  unit_exact: "Esta unidad",
  unit_subtree: "Unidad y dependientes",
  unit_type: "Por tipo de unidad",
  all_units: "Todas las unidades"
};
const processScopeLabel = (code) => PROCESS_SCOPE_LABELS[code] || code || "—";


// --- Administración de procesos de la unidad (vía reglas de alcance) ---
const RECIPIENT_POLICY_LABELS = {
  all_matches: "Todos los del cargo",
  one_per_unit: "Jefatura de la unidad",
  exact_position: "Puesto exacto"
};
/* El ORIGEN de la regla ya no lleva su clase: solo la etiqueta. El tono lo pone `tonoOrigen`. */
const PROCESS_ORIGIN_META = {
  direct: { label: "Directa" },
  type: { label: "Por tipo" },
  global: { label: "Global" },
  other: { label: "Heredada" }
};
const recipientPolicyLabel = (code) => RECIPIENT_POLICY_LABELS[code] || code || "—";
const processOriginMeta = (origin) => PROCESS_ORIGIN_META[origin] || PROCESS_ORIGIN_META.other;
const recipientSummary = (proc) => {
  if (proc.recipient_policy === "exact_position") {
    const cargo = proc.position_cargo_name ? `${proc.position_cargo_name}` : "Puesto";
    return `${cargo}${proc.position_title ? ' · ' + proc.position_title : ''}`;
  }
  return `${proc.cargo_name || 'Cargo no definido'} · ${recipientPolicyLabel(proc.recipient_policy)}`;
};

const attachableProcesses = ref([]);
const attachableLoaded = ref(false);
const processModalOpen = ref(false);
const processEditingRuleId = ref(null);
const processSaving = ref(false);
const processForm = ref({ process_definition_id: "", unit_scope_type: "unit_exact", recipient_policy: "all_matches", cargo_id: "", position_id: "" });

const selectedAttachableDef = computed(() =>
  attachableProcesses.value.find((d) => String(d.definition_id) === String(processForm.value.process_definition_id)) || null
);
// Variación por cargo: la serie fija el cargo de la regla (no editable aquí).
const seriesLockedCargo = computed(() => {
  const def = selectedAttachableDef.value;
  return def?.series_cargo_id ? { id: def.series_cargo_id, name: def.series_cargo_name } : null;
});

const loadAttachableProcesses = async () => {
  if (!detailUnit.value?.id) return;
  try {
    const { data } = await adminSqlService.getUnitAttachableProcesses(detailUnit.value.id);
    attachableProcesses.value = data.definitions || [];
  } catch {
    attachableProcesses.value = [];
  } finally {
    attachableLoaded.value = true;
  }
};
const refreshUnitProcesses = async () => {
  detailProcessesLoaded.value = false;
  await loadUnitProcesses();
};
const resetProcessForm = () => {
  processForm.value = { process_definition_id: "", unit_scope_type: "unit_exact", recipient_policy: "all_matches", cargo_id: "", position_id: "" };
};
const openAttachProcess = async () => {
  processEditingRuleId.value = null;
  resetProcessForm();
  processModalOpen.value = true;
  if (!attachableLoaded.value) await loadAttachableProcesses();
};
const openEditProcessRule = async (proc) => {
  processEditingRuleId.value = proc.rule_id;
  processForm.value = {
    process_definition_id: proc.definition_id,
    unit_scope_type: proc.unit_scope_type || "unit_exact",
    recipient_policy: proc.recipient_policy || "all_matches",
    cargo_id: proc.cargo_id || "",
    position_id: proc.position_id || ""
  };
  processModalOpen.value = true;
  if (!attachableLoaded.value) await loadAttachableProcesses();
};
const confirmProcessRule = async () => {
  const form = processForm.value;
  if (!form.process_definition_id) return;
  const exact = form.recipient_policy === "exact_position";
  const payload = {
    process_definition_id: Number(form.process_definition_id),
    unit_scope_type: form.unit_scope_type,
    unit_id: detailUnit.value.id,
    unit_type_id: null,
    recipient_policy: form.recipient_policy,
    // En variación por cargo el cargo lo siembra/blinda la serie en el backend (se envía vacío).
    cargo_id: exact || seriesLockedCargo.value ? null : (form.cargo_id ? Number(form.cargo_id) : null),
    position_id: exact ? (form.position_id ? Number(form.position_id) : null) : null,
    is_active: 1
  };
  processSaving.value = true;
  try {
    if (processEditingRuleId.value) {
      await adminSqlService.update("process_target_rules", { id: processEditingRuleId.value }, payload);
      setFeedback("success", "Proceso actualizado en la unidad.");
    } else {
      await adminSqlService.create("process_target_rules", payload);
      setFeedback("success", "Proceso vinculado a la unidad.");
    }
    processModalOpen.value = false;
    processEditingRuleId.value = null;
    await refreshUnitProcesses();
  } catch (e) {
    setFeedback("error", e?.response?.data?.message || "No se pudo guardar el proceso.");
  } finally {
    processSaving.value = false;
  }
};
const detachProcess = async (ruleId) => {
  try {
    await adminSqlService.remove("process_target_rules", { id: ruleId });
    setFeedback("success", "Proceso desvinculado de la unidad.");
    await refreshUnitProcesses();
  } catch (e) {
    setFeedback("error", e?.response?.data?.message || "No se pudo desvincular el proceso.");
  }
};

const loadCargos = async () => {
  try {
    const { data } = await adminSqlService.list("cargos", { limit: 300 });
    cargos.value = Array.isArray(data) ? data : (data?.rows || []);
  } catch {
    cargos.value = [];
  }
};

// Tras cambiar puestos/ocupaciones: recarga el detalle (drawer) y el grafo (badges).
const refreshAfterPositionChange = async () => {
  if (detailUnit.value?.id) {
    await openDetail(detailUnit.value.id);
  }
  await loadGraph();
};

const confirmAddPosition = async () => {
  if (!detailUnit.value?.id || !positionForm.value.cargo_id) return;
  try {
    await adminSqlService.addUnitPosition(detailUnit.value.id, { ...positionForm.value });
    addingPosition.value = false;
    positionForm.value = { cargo_id: "", title: "", position_type: "real", is_unit_head: false };
    setFeedback("success", "Puesto creado.");
    await refreshAfterPositionChange();
  } catch (e) {
    setFeedback("error", e?.response?.data?.message || "No se pudo crear el puesto.");
  }
};

const removePosition = async (positionId) => {
  try {
    await adminSqlService.removeUnitPosition(positionId);
    setFeedback("success", "Puesto eliminado.");
    await refreshAfterPositionChange();
  } catch (e) {
    setFeedback("error", e?.response?.data?.message || "No se pudo eliminar el puesto.");
  }
};

const openEditPosition = (pos) => {
  editingPosition.value = pos;
  editPositionForm.value = {
    cargo_id: pos.cargo_id || "",
    title: pos.title || "",
    position_type: pos.position_type || "real",
    is_unit_head: Number(pos.is_unit_head) === 1,
    is_active: Number(pos.is_active) === 1
  };
};
const confirmEditPosition = async () => {
  const pos = editingPosition.value;
  const form = editPositionForm.value;
  editingPosition.value = null;
  if (!pos) return;
  try {
    await adminSqlService.updateUnitPosition(pos.id, {
      cargo_id: form.cargo_id ? Number(form.cargo_id) : undefined,
      title: form.title,
      position_type: form.position_type,
      is_unit_head: form.is_unit_head ? 1 : 0,
      is_active: form.is_active ? 1 : 0
    });
    setFeedback("success", "Puesto actualizado.");
    await refreshAfterPositionChange();
  } catch (e) {
    setFeedback("error", e?.response?.data?.message || "No se pudo actualizar el puesto.");
  }
};

// Wizard de perfil: abre/guarda el JSON de perfil del puesto.
const openProfileWizard = (pos) => {
  profileWizardPosition.value = pos;
};
const saveProfileWizard = async (profile) => {
  const pos = profileWizardPosition.value;
  profileWizardPosition.value = null;
  if (!pos) return;
  try {
    await adminSqlService.updateUnitPosition(pos.id, { profile });
    setFeedback("success", "Perfil del puesto guardado.");
    await refreshAfterPositionChange();
  } catch (e) {
    setFeedback("error", e?.response?.data?.message || "No se pudo guardar el perfil.");
  }
};

const toggleHead = async (pos) => {
  try {
    await adminSqlService.updateUnitPosition(pos.id, { is_unit_head: pos.is_unit_head ? 0 : 1 });
    await refreshAfterPositionChange();
  } catch (e) {
    setFeedback("error", e?.response?.data?.message || "No se pudo cambiar la jefatura.");
  }
};

const unassign = async (positionId) => {
  try {
    await adminSqlService.unassignUnitPosition(positionId);
    setFeedback("success", "Ocupante retirado.");
    await refreshAfterPositionChange();
  } catch (e) {
    setFeedback("error", e?.response?.data?.message || "No se pudo retirar el ocupante.");
  }
};

const openAssign = (positionId) => {
  assignForId.value = assignForId.value === positionId ? null : positionId;
  personQuery.value = "";
  personResults.value = [];
};
const searchPersons = async () => {
  const q = personQuery.value.trim();
  if (q.length < 2) {
    personResults.value = [];
    return;
  }
  personSearching.value = true;
  try {
    const { data } = await adminSqlService.list("persons", { q, limit: 8 });
    personResults.value = Array.isArray(data) ? data : (data?.rows || []);
  } catch {
    personResults.value = [];
  } finally {
    personSearching.value = false;
  }
};
const pickPerson = async (personId) => {
  const positionId = assignForId.value;
  assignForId.value = null;
  if (!positionId) return;
  try {
    await adminSqlService.assignUnitPosition(positionId, personId);
    setFeedback("success", "Ocupante asignado.");
    await refreshAfterPositionChange();
  } catch (e) {
    setFeedback("error", e?.response?.data?.message || "No se pudo asignar el ocupante.");
  }
};

// Tipo de relación a usar al crear una arista (el activo si es específico; si 'all', org o el primero).
const relationTypeIdForCreate = () => {
  if (activeRelationType.value !== "all") {
    const byActive = relationTypes.value.find((r) => r.code === activeRelationType.value);
    if (byActive) return byActive.id;
  }
  return (relationTypes.value.find((r) => r.code === "org") || relationTypes.value[0])?.id || null;
};
const parentUnitIdOf = (childId) => {
  const edge = (rawGraph.value.edges || []).find((e) => String(e.child_unit_id) === String(childId));
  return edge ? edge.parent_unit_id : null;
};

const openCreateUnit = (mode, parentUnitId, anchorName) => {
  if (!props.editable) return;
  createForm.value = { name: "", slug: "", unit_type_id: "" };
  createContext.value = { mode, parentUnitId: parentUnitId || null, anchorName: anchorName || "" };
};
const onAddChild = (unitId) => {
  openCreateUnit("child", unitId, nodeNameById.value.get(String(unitId)));
};
const onAddSibling = (unitId) => {
  const parentId = parentUnitIdOf(unitId);
  openCreateUnit("sibling", parentId, nodeNameById.value.get(String(unitId)));
};

const createDialogTitle = computed(() =>
  createContext.value?.mode === "sibling" ? "Agregar unidad hermana" : "Agregar unidad hija"
);
const createDialogHint = computed(() => {
  const ctx = createContext.value;
  if (!ctx) return "";
  if (ctx.mode === "sibling") {
    return ctx.parentUnitId
      ? `Se creará bajo el mismo padre que "${ctx.anchorName}".`
      : `"${ctx.anchorName}" es una raíz: la nueva unidad se creará sin padre.`;
  }
  return `Se creará como hija de "${ctx.anchorName}".`;
});

const confirmCreateUnit = async () => {
  const ctx = createContext.value;
  const form = createForm.value;
  if (!ctx || !form.name.trim() || !form.unit_type_id) return;
  const parentId = ctx.parentUnitId;
  try {
    await adminSqlService.createUnitWithParent({
      name: form.name.trim(),
      slug: form.slug.trim() || undefined,
      unit_type_id: Number(form.unit_type_id),
      parent_unit_id: parentId || null,
      relation_type_id: parentId ? relationTypeIdForCreate() : null
    });
    createContext.value = null;
    setFeedback("success", "Unidad creada.");
    await loadGraph();
  } catch (e) {
    setFeedback("error", e?.response?.data?.message || "No se pudo crear la unidad.");
  }
};

const loadUnitTypes = async () => {
  try {
    const { data } = await adminSqlService.list("unit_types", { limit: 200 });
    unitTypes.value = Array.isArray(data) ? data : (data?.rows || []);
  } catch {
    unitTypes.value = [];
  }
};

// Fase 4: conectar dos nodos crea la relación padre(source)→hija(target).
const onConnect = async ({ source, target }) => {
  if (!props.editable || !source || !target || source === target) return;
  if (activeRelationType.value === "all") {
    setFeedback("error", "Elige un tipo de relación específico (no 'Todos') para crear aristas.");
    return;
  }
  const rtId = relationTypes.value.find((r) => r.code === activeRelationType.value)?.id;
  if (!rtId) {
    setFeedback("error", "No se encontró el tipo de relación para crear la arista.");
    return;
  }
  try {
    await adminSqlService.create("unit_relations", {
      relation_type_id: rtId,
      parent_unit_id: Number(source),
      child_unit_id: Number(target)
    });
    setFeedback("success", "Relación creada.");
    await loadGraph();
  } catch (e) {
    setFeedback("error", e?.response?.data?.message || "No se pudo crear la relación.");
    await loadGraph();
  }
};

const findEdgeById = (edgeId) => edges.value.find((e) => e.id === edgeId) || null;

// Abrir diálogos desde la toolbar de la arista.
const openDeleteEdge = (edgeId) => {
  if (!props.editable) return;
  selectedEdge.value = findEdgeById(edgeId);
};
const openEditEdge = (edgeId) => {
  if (!props.editable) return;
  const edge = findEdgeById(edgeId);
  if (!edge) return;
  editingEdge.value = edge;
  editingTypeCode.value = edge.data?.code || props.relationType;
};

const confirmDeleteEdge = async () => {
  const edge = selectedEdge.value;
  selectedEdge.value = null;
  if (!edge?.data?.relationId) return;
  try {
    await adminSqlService.remove("unit_relations", { id: edge.data.relationId });
    setFeedback("success", "Relación eliminada.");
    await loadGraph();
  } catch (e) {
    setFeedback("error", e?.response?.data?.message || "No se pudo eliminar la relación.");
  }
};

const confirmEditEdge = async () => {
  const edge = editingEdge.value;
  const newCode = editingTypeCode.value;
  editingEdge.value = null;
  if (!edge?.data?.relationId) return;
  const newTypeId = relationTypes.value.find((r) => r.code === newCode)?.id;
  if (!newTypeId || newTypeId === edge.data.relationTypeId) return;
  try {
    await adminSqlService.update("unit_relations", { id: edge.data.relationId }, { relation_type_id: newTypeId });
    setFeedback("success", "Tipo de relación actualizado.");
    await loadGraph();
  } catch (e) {
    setFeedback("error", e?.response?.data?.message || "No se pudo cambiar el tipo de relación.");
    await loadGraph();
  }
};

// Reparentar arrastrando el extremo de la arista a otro nodo: quita la relación vieja y crea la nueva.
const onEdgeUpdate = async ({ edge, connection }) => {
  if (!props.editable) return;
  const relationId = edge?.data?.relationId;
  const rtId = edge?.data?.relationTypeId;
  const source = connection?.source;
  const target = connection?.target;
  if (!relationId || !rtId || !source || !target || source === target) return;
  try {
    await adminSqlService.remove("unit_relations", { id: relationId });
    await adminSqlService.create("unit_relations", {
      relation_type_id: rtId,
      parent_unit_id: Number(source),
      child_unit_id: Number(target)
    });
    setFeedback("success", "Relación reasignada.");
    await loadGraph();
  } catch (e) {
    setFeedback("error", e?.response?.data?.message || "No se pudo reasignar la relación.");
    await loadGraph();
  }
};

watch(showInactive, buildGraph);
watch(healthOnly, buildGraph);
watch(activeRelationType, loadGraph);
onMounted(() => {
  loadGraph();
  loadUnitTypes();
  loadCargos();
});

// refreshProcesses: tras crear/editar una configuración en el wizard, recarga la lista de procesos del drawer.
const refreshProcessesIfOpen = async () => {
  if (detailUnit.value?.id && detailTab.value === "procesos") {
    attachableLoaded.value = false;
    await refreshUnitProcesses();
  } else {
    detailProcessesLoaded.value = false;
  }
};
defineExpose({ reloadGraph: loadGraph, refreshProcesses: refreshProcessesIfOpen });
</script>
