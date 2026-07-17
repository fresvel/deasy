<template>
  <AppWorkspaceShell
    :menu-open="showMenu"
    :show-notify="showNotify"
    current-section="home"
    :photo="userPhoto"
    :username="userFullName"
    :sidebar-subtitle="sidebarContextLabel"
    @menu-toggle="toggleMenu"
    @close-mobile="closeMenu"
    @notify="toggleNotify"
    @notify-close="closeNotify"
    @sign="router.push({ name: 'home-signatures' })"
    @primary-nav="handlePrimaryNavInteraction"
  >
    <template #header>
      <div class="deasy-context-header">
        <div class="deasy-context-header__copy">
          <div class="deasy-context-header__title">{{ homeContextTitle }}</div>
          <div v-if="homeContextSubtitle" class="deasy-context-header__subtitle">{{ homeContextSubtitle }}</div>
        </div>
      </div>
    </template>

    <template #sidebar>
      <HomeSidebar
        :menu-loading="menuLoading"
        :menu-error="menuError"
        :sends-count="mySends.length"
        :workspace-icon-tone-class="workspaceIconToneClass"
        @open-section="openWorkspaceSection"
      />
    </template>

        <template v-if="isDocumentCenterRoute">
          <section class="flex flex-col gap-6">
            <!-- Panel de supervisión (solo visible si el usuario encabeza alguna unidad). -->
            <SupervisorStuckPanel />
            <section class="bg-white rounded-xl shadow-xl shadow-slate-200/40 p-5 md:p-6 border border-slate-100 flex flex-col gap-5">
              <div class="deasy-filter-shell">
              <div class="deasy-filter-grid">
                <label class="deasy-filter-field deasy-filter-search-span">
                  <span class="sr-only">Buscar</span>
                  <input v-model="documentCenterFilters.query" type="text" placeholder="Documento, proceso, unidad o periodo" class="deasy-filter-search-input" />
                </label>
                <label class="deasy-filter-field">
                  <span class="sr-only">Año</span>
                  <select v-model="documentCenterFilters.year" class="deasy-filter-control">
                    <option value="all">Año</option>
                    <option v-for="option in documentCenterFilterYears" :key="option" :value="option">{{ option }}</option>
                  </select>
                </label>
                <label class="deasy-filter-field">
                  <span class="sr-only">Tipo de periodo</span>
                  <select v-model="documentCenterFilters.termType" class="deasy-filter-control">
                    <option value="all">Tipo de periodo</option>
                    <option v-for="option in documentCenterFilterTermTypes" :key="option" :value="option">{{ option }}</option>
                  </select>
                </label>
                <label class="deasy-filter-field">
                  <span class="sr-only">Unidad</span>
                  <select v-model="documentCenterFilters.unit" class="deasy-filter-control">
                    <option value="all">Unidad</option>
                    <option v-for="option in documentCenterFilterUnits" :key="option" :value="option">{{ option }}</option>
                  </select>
                </label>
                <label class="deasy-filter-field">
                  <span class="sr-only">Proceso</span>
                  <select v-model="documentCenterFilters.process" class="deasy-filter-control">
                    <option value="all">Proceso</option>
                    <option v-for="option in documentCenterFilterProcesses" :key="option" :value="option">{{ option }}</option>
                  </select>
                </label>
              </div>
              <div class="deasy-filter-toolbar">
                <div class="deasy-filter-summary">Documentos visibles: <span class="font-bold text-slate-700">{{ filteredDocumentCenterItems.length }}</span></div>
                <div class="deasy-filter-actions">
                  <AppButton variant="softNeutral" size="sm" class-name="deasy-filter-btn" @click="resetDocumentCenterFilters">Reset</AppButton>
                  <AppButton variant="softPrimary" size="sm" class-name="deasy-filter-btn" @click="loadDocumentCenterPage">Actualizar</AppButton>
                </div>
              </div>
              </div>

              <section v-if="documentCenterLoading" class="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm font-bold text-slate-600">
                Cargando centro documental...
              </section>
              <section v-else-if="documentCenterError" class="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm font-bold text-rose-700">
                {{ documentCenterError }}
              </section>
              <AppDataTable
                v-else
                :fields="documentCenterFields"
                :rows="filteredDocumentCenterItems"
                :row-key="(row) => `document-center-${row.document_id}`"
                empty-text="No hay documentos para mostrar."
                actions-label="ACCIONES"
              >
                <template #cell="{ row, field }">
                  <template v-if="field.name === 'document'">
                    <div class="flex flex-col gap-1">
                      <strong class="text-sm font-bold text-slate-800">{{ row.template_artifact_name || row.definition_name || `Documento #${row.document_id}` }}</strong>
                      <span class="text-xs font-medium text-slate-500">{{ row.document_version ? `v${row.document_version}` : 'Sin versión' }}</span>
                    </div>
                  </template>
                  <template v-else-if="field.name === 'process'">{{ row.process_name }}</template>
                  <template v-else-if="field.name === 'unit'">{{ row.unit_label || 'Sin unidad' }}</template>
                  <template v-else-if="field.name === 'period'">{{ row.term_name || 'Sin periodo' }}</template>
                  <template v-else-if="field.name === 'status'">
                    <AppTag :variant="row.pending_signature_count ? 'warning' : row.pending_fill_count ? 'info' : 'neutral'">
                      {{ row.document_version_status || row.document_status || 'Sin estado' }}
                    </AppTag>
                  </template>
                </template>
                <template #actions="{ row }">
                  <div class="flex flex-wrap justify-end gap-2">
                    <AppButton v-if="row.preloadPdfPath" variant="softNeutral" size="sm" @click="previewDeliverableFile(buildWorkspacePayloadFromCenterItem(row))">
                      Ver PDF
                    </AppButton>
                    <AppButton v-if="row.preloadFilePath" variant="softPrimary" size="sm" @click="downloadDeliverableFile(buildWorkspacePayloadFromCenterItem(row))">
                      Descargar
                    </AppButton>
                  </div>
                </template>
              </AppDataTable>
            </section>
          </section>
        </template>
        <!-- Vista consolidada: Mis procesos — nivel 1: unidades / nivel 2: procesos -->
        <template v-else-if="showProcessesPanel">
          <section class="flex flex-col gap-6">

            <!-- Nivel 1: tabs por unidad + botón volver en la misma fila -->
            <div class="admin-related-tabs flex items-center justify-between gap-3">
              <div class="deasy-inline-tabs" role="tablist" aria-label="Unidades">
                <button
                  v-for="unit in unitsPanelData"
                  :key="unit.id"
                  type="button"
                  role="tab"
                  class="deasy-inline-tab"
                  :class="activeConsolidatedUnitTab === unit.id ? 'deasy-inline-tab--active' : ''"
                  :aria-selected="activeConsolidatedUnitTab === unit.id"
                  @click="selectConsolidatedUnit(unit)"
                >
                  {{ unit.name }}
                </button>
              </div>
              <div class="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  class="inline-flex items-center gap-1.5 rounded-full border border-indigo-300 bg-white px-3.5 py-2 text-sm font-semibold text-indigo-700 transition hover:-translate-y-0.5 hover:bg-indigo-50"
                  @click="openGeneralTaskModal('free')"
                >
                  <IconPlus class="h-4 w-4" />
                  <span>Nueva tarea</span>
                </button>
                <button
                  type="button"
                  class="deasy-hero-back-button"
                  @click="showProcessesPanel = false; clearSelectedProcess()"
                >
                  <span class="deasy-hero-back-button__icon"><IconArrowLeft class="h-4.5 w-4.5" /></span>
                  <span>Volver</span>
                </button>
              </div>
            </div>

            <!-- Barra de filtros: Cargo / Año / Estado -->
            <div class="deasy-filter-shell">
              <div class="deasy-filter-grid">
                <div ref="processMultiSelectRef" class="deasy-filter-field relative">
                  <span class="sr-only">Procesos</span>
                  <button
                    type="button"
                    class="deasy-filter-control flex w-full items-center justify-between gap-2 text-left"
                    :disabled="!consolidatedCargoProcesses.length"
                    @click="showProcessMultiSelect = !showProcessMultiSelect"
                  >
                    <span class="truncate">{{ processMultiSelectLabel }}</span>
                    <IconChevronDown class="h-4 w-4 shrink-0 transition-transform" :class="showProcessMultiSelect ? 'rotate-180' : ''" />
                  </button>
                  <div
                    v-if="showProcessMultiSelect && consolidatedCargoProcesses.length"
                    class="absolute left-0 top-full z-20 mt-1 w-full min-w-[16rem] rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-200/60"
                  >
                    <button
                      type="button"
                      class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      @click="toggleAllConsolidatedProcesses"
                    >
                      <span class="flex h-4 w-4 items-center justify-center rounded border" :class="allConsolidatedProcessesSelected ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-slate-300'">
                        <IconCheck v-if="allConsolidatedProcessesSelected" class="h-3 w-3" />
                      </span>
                      Todos los procesos
                    </button>
                    <div class="my-1 h-px bg-slate-100"></div>
                    <button
                      v-for="process in consolidatedCargoProcesses"
                      :key="process.process_definition_id || process.id"
                      type="button"
                      class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-slate-600 hover:bg-slate-50"
                      @click="toggleConsolidatedProcess(process.process_definition_id || process.id)"
                    >
                      <span class="flex h-4 w-4 shrink-0 items-center justify-center rounded border" :class="selectedConsolidatedProcessIds.includes(String(process.process_definition_id || process.id)) ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-slate-300'">
                        <IconCheck v-if="selectedConsolidatedProcessIds.includes(String(process.process_definition_id || process.id))" class="h-3 w-3" />
                      </span>
                      <span class="truncate">{{ routedMenuLabel(process) }}</span>
                      <span v-if="process.is_routed" class="ml-auto inline-flex shrink-0 items-center gap-0.5 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[0.6rem] font-bold text-indigo-600"><IconSend class="h-2.5 w-2.5" />Envíos</span>
                    </button>
                  </div>
                </div>
                <label class="deasy-filter-field">
                  <span class="sr-only">Año</span>
                  <select v-model="taskListFilters.year" class="deasy-filter-control">
                    <option value="all">Año</option>
                    <option v-for="option in taskFilterYears" :key="option" :value="option">{{ option }}</option>
                  </select>
                </label>
                <label class="deasy-filter-field">
                  <span class="sr-only">Estado</span>
                  <select v-model="taskListFilters.status" class="deasy-filter-control">
                    <option value="all">Estado</option>
                    <option v-for="option in taskFilterStatuses" :key="option" :value="option">{{ option }}</option>
                  </select>
                </label>
              </div>
              <div class="deasy-filter-toolbar">
                <div class="deasy-filter-summary">
                  Entregables visibles: <span class="font-bold text-slate-700">{{ filteredProcessDeliverables.length }}</span>
                </div>
                <div class="deasy-filter-actions">
                  <AppButton variant="softNeutral" size="sm" class-name="deasy-filter-btn" @click="resetTaskListFilters">Reset</AppButton>
                </div>
              </div>
            </div>

            <!-- Nivel 2: tabs por cargo de la unidad seleccionada -->
            <div v-if="consolidatedUnitCargos.length > 0" class="deasy-inline-tabs" role="tablist" aria-label="Cargos de la unidad">
              <button
                v-for="cargo in consolidatedUnitCargos"
                :key="cargo.id"
                type="button"
                role="tab"
                class="deasy-inline-tab"
                :class="activeConsolidatedCargoTab === cargo.id ? 'deasy-inline-tab--active' : ''"
                :aria-selected="activeConsolidatedCargoTab === cargo.id"
                @click="selectConsolidatedCargo(cargo)"
              >
                {{ cargo.name }}
              </button>
            </div>

            <!-- Estado de carga / error -->
            <section v-if="processPanelLoading" class="bg-sky-50 border border-sky-100 text-sky-800 rounded-2xl p-5 font-semibold text-sm animate-pulse">
              Cargando proceso...
            </section>
            <section v-else-if="processPanelError" class="bg-rose-50 border border-rose-200 text-rose-700 text-sm font-bold rounded-2xl p-5 shadow-sm">
              {{ processPanelError }}
            </section>
            <div v-else-if="!selectedProcessPanel && consolidatedCargoProcesses.length && selectedConsolidatedProcessIds.length" class="border-2 border-dashed border-slate-200 rounded-xl p-8 text-slate-500 text-center text-sm font-medium">
              Selecciona una unidad y proceso para ver sus entregables.
            </div>

            <template v-else>

              <section v-if="processActionMessage" class="rounded-2xl p-5 font-bold text-sm shadow-sm" :class="processActionMessage.type === 'error' ? 'bg-rose-50 border border-rose-200 text-rose-700' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'">
                {{ processActionMessage.text }}
              </section>

              <!-- Tarjetas de entregables -->
              <section class="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <article class="lg:col-span-12 bg-white rounded-xl shadow-xl shadow-slate-200/40 p-5 md:p-6 border border-slate-100 flex flex-col gap-5">

                  <div v-if="!consolidatedCargoProcesses.length" class="border-2 border-dashed border-slate-200 rounded-xl p-8 text-slate-500 bg-slate-50/50 text-center text-sm font-medium">
                    No hay procesos asignados para este cargo.
                  </div>
                  <div v-else-if="!selectedConsolidatedProcessIds.length" class="border-2 border-dashed border-slate-200 rounded-xl p-8 text-slate-500 bg-slate-50/50 text-center text-sm font-medium">
                    Selecciona al menos un proceso para ver sus entregables.
                  </div>
                  <div v-else-if="!filteredProcessDeliverables.length" class="border-2 border-dashed border-slate-200 rounded-xl p-8 text-slate-500 bg-slate-50/50 text-center text-sm font-medium">
                    No hay entregables que coincidan con los filtros actuales.
                  </div>
                  <div v-else class="px-2 md:px-3 xl:px-4 flex flex-col gap-5">
                    <div class="flex items-center gap-3 px-1">
                      <div class="h-px flex-1 bg-slate-200/90"></div>
                      <AppButton
                        variant="plain"
                        class-name="inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-slate-200 bg-white text-xs font-semibold text-slate-500 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
                        :aria-label="isProcessCollapsed ? 'Expandir todo' : 'Colapsar todo'"
                        @click="toggleDeliverableProcess"
                      >
                        <span>{{ isProcessCollapsed ? 'Expandir' : 'Colapsar' }}</span>
                        <IconChevronDown class="h-4 w-4 transition-transform duration-200" :class="isProcessCollapsed ? 'rotate-180' : ''" />
                      </AppButton>
                      <div class="h-px flex-1 bg-slate-200/90"></div>
                    </div>
                    <div v-for="group in deliverableGroups" :key="group.id" class="flex flex-col gap-3">
                      <div v-if="showDeliverableGroupHeaders" class="flex items-center gap-2 px-1">
                        <span class="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700"><IconChecklist class="h-3.5 w-3.5" /></span>
                        <h3 class="m-0 text-sm font-bold text-slate-700">{{ group.name }}</h3>
                        <span class="text-xs font-semibold text-slate-400">{{ group.items.length }}</span>
                      </div>
                      <section v-for="row in group.rows" :key="row.id" class="flex flex-col gap-3">
                        <div class="grid grid-cols-1 gap-x-9 gap-y-0 md:grid-cols-2 xl:grid-cols-3">
                          <DeliverableCard
                            v-for="deliverable in row.items"
                            :key="deliverable.key"
                            :deliverable="deliverable"
                            :helpers="deliverableCardHelpers"
                            :processing-fill-item-id="processingFillItemId"
                            :fill-workflow-submitting="fillWorkflowSubmitting"
                            :is-uploading-deliverable="isUploadingDeliverable"
                            @toggle="toggleDeliverableCard"
                            @open="openDeliverableWorkspaceModal(getDeliverableWorkspacePayload($event))"
                            @start="startDeliverableFlow"
                            @upload="handleInlineDeliverableUpload($event.item, $event.files)"
                            @sign="openDocumentSignFlow"
                            @approve="submitDeliverableCardFillAction($event, 'approve')"
                            @download="downloadDeliverableFile"
                            @template="handleDeliverableFutureAction('download_template', $event)"
                            @preview="previewDeliverableFile"
                            @chat="handleDeliverableFutureAction('process_chat', $event)"
                          />
                        </div>
                      </section>
                    </div>
                  </div>
                </article>
              </section>
            </template>
          </section>
        </template>

        <template v-else-if="!selectedProcessKey && !processPanelLoading">

          <!-- Panel: Mis unidades -->
          <div v-if="showUnitsPanel" class="flex flex-col gap-5">
            <div class="admin-page-header">
              <div class="admin-page-header__main">
                <h1 class="admin-page-header__title">Mis unidades</h1>
              </div>
              <div class="admin-page-header__actions">
                <button type="button" class="deasy-hero-back-button" @click="showUnitsPanel = false">
                  <span class="deasy-hero-back-button__icon"><IconArrowLeft class="h-4.5 w-4.5" /></span>
                  <span>Volver</span>
                </button>
              </div>
            </div>
            <div v-if="!unitsPanelData.length" class="text-sm font-medium text-slate-500 py-4">
              No hay unidades con procesos asignados.
            </div>
            <template v-else>
              <div class="deasy-inline-tabs" role="tablist">
                <button
                  v-for="unit in unitsPanelData"
                  :key="unit.id"
                  type="button"
                  role="tab"
                  class="deasy-inline-tab"
                  :class="activeUnitPanelTab === unit.id ? 'deasy-inline-tab--active' : ''"
                  :aria-selected="activeUnitPanelTab === unit.id"
                  @click="activeUnitPanelTab = unit.id"
                >
                  {{ unit.name }}
                </button>
              </div>
              <template v-for="unit in unitsPanelData" :key="unit.id">
                <div v-if="activeUnitPanelTab === unit.id" class="flex flex-col gap-5">
                  <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    <section class="bg-slate-50/50 rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col gap-4">
                      <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0">
                          <div v-if="unit.groupName" class="text-[11px] font-bold uppercase tracking-wider text-slate-400">{{ unit.groupName }}</div>
                          <h3 class="text-lg font-semibold text-slate-800 m-0 mt-1 leading-snug">{{ unit.name }}</h3>
                        </div>
                      </div>
                      <div v-if="!unit.processes.length" class="text-sm font-medium text-slate-400 italic">
                        Sin procesos asignados.
                      </div>
                      <div v-else class="flex flex-col gap-2">
                        <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Procesos disponibles</div>
                        <button
                          v-for="process in unit.processes"
                          :key="process.process_definition_id || process.id"
                          type="button"
                          class="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white px-4 py-3 text-left shadow-sm transition hover:border-sky-200 hover:shadow-md"
                          @click="handleProcessSelect(process)"
                        >
                          <span class="deasy-nav-item__icon" :class="workspaceIconToneClass(processIconMeta(process).tone)">
                            <component :is="processIconMeta(process).icon" class="h-4.5 w-4.5 shrink-0" />
                          </span>
                          <span class="flex min-w-0 flex-1 flex-col gap-0.5">
                            <strong class="text-sm font-semibold text-slate-800 leading-tight">{{ routedMenuLabel(process) }}</strong>
                          </span>
                          <span v-if="process.is_routed" class="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[0.6rem] font-bold text-indigo-600"><IconSend class="h-2.5 w-2.5" />Envíos</span>
                          <IconArrowRight class="h-4 w-4 shrink-0 text-slate-400" />
                        </button>
                      </div>
                    </section>
                  </div>
                </div>
              </template>
            </template>
          </div>

          <!-- Panel: Mis cargos -->
          <div v-else-if="showCargosPanel" class="flex flex-col gap-5">

            <!-- Cabecera con botón volver -->
            <div class="admin-page-header">
              <button
                type="button"
                class="deasy-hero-back-button"
                @click="showCargosPanel = false"
              >
                <span class="deasy-hero-back-button__icon">
                  <IconArrowLeft class="h-4.5 w-4.5" />
                </span>
                <span>Volver</span>
              </button>
            </div>

            <div v-if="!cargosPanelData.length" class="text-sm font-medium text-slate-500 py-4">
              No hay cargos asignados para mostrar.
            </div>
            <template v-else>
              <!-- Tabs: uno por cargo -->
              <div class="deasy-inline-tabs" role="tablist">
                <button
                  v-for="cargo in cargosPanelData"
                  :key="cargo.id"
                  type="button"
                  role="tab"
                  class="deasy-inline-tab"
                  :class="activeCargoPanelTab === cargo.id ? 'deasy-inline-tab--active' : ''"
                  :aria-selected="activeCargoPanelTab === cargo.id"
                  @click="activeCargoPanelTab = cargo.id"
                >
                  {{ cargo.name }}
                </button>
              </div>

              <!-- Contenido del tab activo -->
              <template v-for="cargo in cargosPanelData" :key="cargo.id">
                <div v-if="activeCargoPanelTab === cargo.id" class="flex flex-col gap-5">

                  <!-- Unidades donde está activo este cargo -->
                  <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    <section
                      v-for="pos in cargo.positions"
                      :key="pos.unitId"
                      class="bg-slate-50/50 rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col gap-4"
                    >
                      <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0">
                          <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400">{{ pos.groupName }}</div>
                          <h3 class="text-lg font-semibold text-slate-800 m-0 mt-1 leading-snug">{{ pos.unitName }}</h3>
                        </div>
                        <span
                          v-if="pos.positionType"
                          class="shrink-0 inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider"
                          :class="{
                            'bg-emerald-100 text-emerald-700': pos.positionType === 'real',
                            'bg-sky-100 text-sky-700': pos.positionType === 'simbolico',
                            'bg-amber-100 text-amber-700': pos.positionType === 'promocion',
                          }"
                        >
                          {{ { real: 'Real', simbolico: 'Simbólico', promocion: 'Promoción' }[pos.positionType] ?? pos.positionType }}
                        </span>
                      </div>

                      <div v-if="!pos.processes.length" class="text-sm font-medium text-slate-400 italic">
                        Sin procesos asignados.
                      </div>
                      <div v-else class="flex flex-col gap-2">
                        <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Procesos disponibles</div>
                        <button
                          v-for="process in pos.processes"
                          :key="process.process_definition_id || process.id"
                          type="button"
                          class="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white px-4 py-3 text-left shadow-sm transition hover:border-sky-200 hover:shadow-md"
                          @click="handleProcessSelect(process)"
                        >
                          <span class="deasy-nav-item__icon" :class="workspaceIconToneClass(processIconMeta(process).tone)">
                            <component :is="processIconMeta(process).icon" class="h-4.5 w-4.5 shrink-0" />
                          </span>
                          <span class="flex min-w-0 flex-1 flex-col gap-0.5">
                            <strong class="text-sm font-semibold text-slate-800 leading-tight">{{ routedMenuLabel(process) }}</strong>
                          </span>
                          <span v-if="process.is_routed" class="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[0.6rem] font-bold text-indigo-600"><IconSend class="h-2.5 w-2.5" />Envíos</span>
                          <IconArrowRight class="h-4 w-4 shrink-0 text-slate-400" />
                        </button>
                      </div>
                    </section>
                  </div>

                </div>
              </template>
            </template>
          </div>

          <!-- Dashboard normal -->
          <div v-else class="flex flex-col gap-4">

            <!-- Error banner -->
            <div v-if="homeErrorMessage" class="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              <IconAlertTriangle class="h-5 w-5 shrink-0" />
              <span>{{ homeErrorMessage }}</span>
            </div>

            <!-- Tabs -->
            <div class="deasy-inline-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                class="deasy-inline-tab"
                :class="homeDashTab === 'inicio' ? 'deasy-inline-tab--active' : ''"
                :aria-selected="homeDashTab === 'inicio'"
                @click="homeDashTab = 'inicio'"
              >
                Inicio
              </button>
              <button
                type="button"
                role="tab"
                class="deasy-inline-tab"
                :class="homeDashTab === 'resumen' ? 'deasy-inline-tab--active' : ''"
                :aria-selected="homeDashTab === 'resumen'"
                @click="homeDashTab = 'resumen'"
              >
                Resumen
                <span v-if="homeActions.length" class="deasy-inline-tab__badge" :class="homeDashTab === 'resumen' ? 'deasy-inline-tab__badge--active' : ''">
                  {{ homeActions.length }}
                </span>
              </button>
            </div>

            <!-- Tab: Inicio — launcher cards -->
            <div v-if="homeDashTab === 'inicio'" class="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">

              <button
                type="button"
                class="flex flex-col h-full min-h-[19rem] bg-slate-50/50 rounded-2xl border border-slate-100 p-6 text-left shadow-sm transition hover:border-sky-200 hover:bg-sky-50/40 hover:shadow-md"
                @click="scrollToProcessNav"
              >
                <h3 class="text-lg font-semibold text-slate-800 mb-4">Mis procesos</h3>
                <div class="flex flex-1 items-center justify-center rounded-xl border border-slate-200/80 bg-white px-6 py-8 shadow-sm">
                  <div class="flex flex-col items-center justify-center text-center">
                    <IconChecklist class="h-10 w-10 text-slate-400" />
                    <span class="mt-4 text-sm font-semibold text-slate-700">{{ homeProcesses.length }} proceso(s) disponible(s)</span>
                    <p class="mt-2 max-w-[16rem] text-xs leading-relaxed text-slate-500">Accede y gestiona las tareas y entregables de tus procesos activos.</p>
                  </div>
                </div>
              </button>

              <button
                type="button"
                class="flex flex-col h-full min-h-[19rem] bg-slate-50/50 rounded-2xl border border-slate-100 p-6 text-left shadow-sm transition hover:border-sky-200 hover:bg-sky-50/40 hover:shadow-md"
                :class="homeSignatureCount ? 'border-amber-200 bg-amber-50/30' : ''"
                @click="navigateToGlobalSignaturePage"
              >
                <h3 class="text-lg font-semibold text-slate-800 mb-4">Centro de firmas</h3>
                <div class="flex flex-1 items-center justify-center rounded-xl border border-slate-200/80 bg-white px-6 py-8 shadow-sm"
                  :class="homeSignatureCount ? 'border-amber-200/80' : ''">
                  <div class="flex flex-col items-center justify-center text-center">
                    <IconSignature class="h-10 w-10" :class="homeSignatureCount ? 'text-amber-500' : 'text-slate-400'" />
                    <span class="mt-4 text-sm font-semibold text-slate-700">
                      {{ homeSignatureCount ? `${homeSignatureCount} firma(s) pendiente(s)` : 'Sin pendientes' }}
                    </span>
                    <p class="mt-2 max-w-[16rem] text-xs leading-relaxed text-slate-500">Firma, solicita y valida documentos electrónicos.</p>
                  </div>
                </div>
              </button>

              <button
                type="button"
                class="flex flex-col h-full min-h-[19rem] bg-slate-50/50 rounded-2xl border border-slate-100 p-6 text-left shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50/30 hover:shadow-md"
                @click="openMySends"
              >
                <h3 class="text-lg font-semibold text-slate-800 mb-4">Mis envíos</h3>
                <div class="flex flex-1 items-center justify-center rounded-xl border border-slate-200/80 bg-white px-6 py-8 shadow-sm">
                  <div class="flex flex-col items-center justify-center text-center">
                    <IconSend class="h-10 w-10 text-indigo-400" />
                    <span class="mt-4 text-sm font-semibold text-slate-700">Documentos que has enviado</span>
                    <p class="mt-2 max-w-[16rem] text-xs leading-relaxed text-slate-500">Memos, oficios y otros documentos que endosaste, con su estado.</p>
                  </div>
                </div>
              </button>

              <button
                type="button"
                class="flex flex-col h-full min-h-[19rem] bg-slate-50/50 rounded-2xl border border-slate-100 p-6 text-left shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50/30 hover:shadow-md"
                @click="navigateToDocumentCenterPage"
              >
                <h3 class="text-lg font-semibold text-slate-800 mb-4">Centro documental</h3>
                <div class="flex flex-1 items-center justify-center rounded-xl border border-slate-200/80 bg-white px-6 py-8 shadow-sm">
                  <div class="flex flex-col items-center justify-center text-center">
                    <IconFileDescription class="h-10 w-10 text-slate-400" />
                    <span class="mt-4 text-sm font-semibold text-slate-700">{{ homeDocumentCount }} documento(s) accesibles</span>
                    <p class="mt-2 max-w-[16rem] text-xs leading-relaxed text-slate-500">Consulta y descarga los documentos accesibles de tu cuenta.</p>
                  </div>
                </div>
              </button>

              <button
                type="button"
                class="flex flex-col h-full min-h-[19rem] bg-slate-50/50 rounded-2xl border border-slate-100 p-6 text-left shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/30 hover:shadow-md"
                @click="navigateTo('perfil')"
              >
                <h3 class="text-lg font-semibold text-slate-800 mb-4">Mi dossier</h3>
                <div class="flex flex-1 items-center justify-center rounded-xl border border-slate-200/80 bg-white px-6 py-8 shadow-sm">
                  <div class="flex flex-col items-center justify-center text-center">
                    <IconUserCheck class="h-10 w-10 text-slate-400" />
                    <span class="mt-4 text-sm font-semibold text-slate-700">{{ homeDossierCompletion }}% completado · {{ homeDossierTotal }} registro(s)</span>
                    <p class="mt-2 max-w-[16rem] text-xs leading-relaxed text-slate-500">Gestiona tu perfil académico, experiencia y certificaciones.</p>
                  </div>
                </div>
              </button>

              <button
                type="button"
                class="flex flex-col h-full min-h-[19rem] bg-slate-50/50 rounded-2xl border border-slate-100 p-6 text-left shadow-sm transition hover:border-slate-300 hover:bg-slate-100/40 hover:shadow-md"
                @click="openCargosPanel"
              >
                <h3 class="text-lg font-semibold text-slate-800 mb-4">Mis cargos</h3>
                <div class="flex flex-1 items-center justify-center rounded-xl border border-slate-200/80 bg-white px-6 py-8 shadow-sm">
                  <div class="flex flex-col items-center justify-center text-center">
                    <IconBriefcase class="h-10 w-10 text-slate-400" />
                    <span class="mt-4 text-sm font-semibold text-slate-700">{{ homeCargoCount }} cargo(s) asignado(s)</span>
                    <p class="mt-2 max-w-[16rem] text-xs leading-relaxed text-slate-500">Consulta las unidades y cargos vinculados a tu cuenta.</p>
                  </div>
                </div>
              </button>

              <button
                type="button"
                class="flex flex-col h-full min-h-[19rem] bg-slate-50/50 rounded-2xl border border-slate-100 p-6 text-left shadow-sm transition hover:border-violet-200 hover:bg-violet-50/30 hover:shadow-md"
                @click="openUnitsPanel"
              >
                <h3 class="text-lg font-semibold text-slate-800 mb-4">Mis unidades</h3>
                <div class="flex flex-1 items-center justify-center rounded-xl border border-slate-200/80 bg-white px-6 py-8 shadow-sm">
                  <div class="flex flex-col items-center justify-center text-center">
                    <IconBuildingMonument class="h-10 w-10 text-slate-400" />
                    <span class="mt-4 text-sm font-semibold text-slate-700">{{ unitsPanelData.length }} unidad(es) activa(s)</span>
                    <p class="mt-2 max-w-[16rem] text-xs leading-relaxed text-slate-500">Revisa los procesos disponibles en cada una de tus unidades.</p>
                  </div>
                </div>
              </button>

            </div>

            <!-- Tab: Resumen — layout 2 columnas -->
            <div v-else-if="homeDashTab === 'resumen'" class="grid grid-cols-1 lg:grid-cols-2 gap-5">

              <!-- Columna izquierda: Acciones pendientes -->
              <section class="bg-slate-50/50 rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col gap-4">
                <div class="flex items-center justify-between gap-3">
                  <h3 class="text-lg font-semibold text-slate-800 m-0">Acciones pendientes</h3>
                  <AppButton variant="softNeutral" size="sm" :disabled="homeLoading" @click="loadHomeData">
                    <IconRefresh class="h-4 w-4" />
                    Actualizar
                  </AppButton>
                </div>
                <div class="flex flex-col gap-2">
                  <div v-if="homeLoading" class="text-sm font-medium text-slate-400 py-2">
                    Actualizando...
                  </div>
                  <div v-else-if="!homeActions.length" class="flex items-center gap-3 rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-emerald-700">
                    <IconCircleCheck class="h-5 w-5 shrink-0" />
                    Todo al día. No hay acciones pendientes.
                  </div>
                  <button
                    v-else
                    v-for="action in homeActions"
                    :key="action.key"
                    type="button"
                    class="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white px-4 py-3.5 text-left shadow-sm transition hover:shadow-md"
                    :class="{
                      'hover:border-amber-200': action.tone === 'warning',
                      'hover:border-sky-200': action.tone === 'info',
                      'hover:border-emerald-200': action.tone === 'success',
                    }"
                    @click="runHomeAction(action)"
                  >
                    <span
                      class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                      :class="{
                        'bg-amber-100 text-amber-600': action.tone === 'warning',
                        'bg-sky-100 text-sky-600': action.tone === 'info',
                        'bg-emerald-100 text-emerald-600': action.tone === 'success',
                        'bg-slate-100 text-slate-600': !['warning','info','success'].includes(action.tone),
                      }"
                    >
                      <component :is="action.icon" class="h-5 w-5" />
                    </span>
                    <span class="flex min-w-0 flex-1 flex-col gap-0.5">
                      <strong class="text-sm font-bold text-slate-800 leading-tight">{{ action.title }}</strong>
                      <span class="text-xs font-medium text-slate-500 leading-snug">{{ action.description }}</span>
                    </span>
                    <AppTag :variant="action.tagVariant" class-name="shrink-0">{{ action.meta }}</AppTag>
                  </button>
                </div>
              </section>

              <!-- Columna derecha: Estadísticas -->
              <section class="bg-slate-50/50 rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col gap-4">
                <h3 class="text-lg font-semibold text-slate-800 m-0">Estadísticas de cuenta</h3>
                <div class="flex flex-col gap-2">
                  <div
                    v-for="stat in homeStats"
                    :key="stat.label"
                    class="flex items-center gap-4 rounded-xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm"
                  >
                    <span
                      class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                      :class="{
                        'bg-sky-100 text-sky-600': stat.tone === 'sky',
                        'bg-emerald-100 text-emerald-600': stat.tone === 'emerald',
                        'bg-indigo-100 text-indigo-600': stat.tone === 'indigo',
                        'bg-amber-100 text-amber-600': stat.tone === 'amber',
                        'bg-slate-100 text-slate-600': stat.tone === 'slate',
                      }"
                    >
                      <component :is="stat.icon" class="h-4.5 w-4.5" />
                    </span>
                    <div class="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400">{{ stat.label }}</span>
                      <span class="text-xs font-medium text-slate-500 truncate">{{ stat.detail }}</span>
                    </div>
                    <strong class="text-xl font-extrabold text-slate-800 shrink-0">{{ stat.value }}</strong>
                  </div>
                </div>
              </section>

            </div>

          </div>
        </template>

        <template v-else>
          <section class="flex flex-col gap-6">

            <!-- Tabs de unidades (arriba del header, como en admin) -->
            <div v-if="!processPanelLoading && !processPanelError && processUnitTabs.length > 1" class="admin-related-tabs">
              <div class="deasy-inline-tabs" role="tablist" aria-label="Unidades del proceso">
                <button
                  v-for="tab in processUnitTabs"
                  :key="tab.key"
                  type="button"
                  role="tab"
                  class="deasy-inline-tab"
                  :class="activeProcessUnitTab === tab.key ? 'deasy-inline-tab--active' : ''"
                  :aria-selected="activeProcessUnitTab === tab.key"
                  @click="activeProcessUnitTab = tab.key"
                >
                  {{ tab.label }}
                </button>
              </div>
            </div>

            <!-- Cabecera con título y botón volver -->
            <div class="admin-page-header">
              <div class="admin-page-header__main">
                <p class="text-[11px] font-bold uppercase tracking-wider text-slate-400 m-0">
                  {{ isRoutedProcess ? 'Documentos' : (selectedProcessPanel?.definition?.process_name || selectedProcessContext?.name || 'Proceso') }}
                </p>
                <h1 class="admin-page-header__title mt-1">
                  {{ isRoutedProcess ? routedHeaderTitle : (selectedProcessPanel?.definition?.name || selectedProcessContext?.name || 'Configuración de proceso') }}
                </h1>
              </div>
              <div class="admin-page-header__actions">
                <button
                  type="button"
                  class="deasy-hero-back-button"
                  @click="clearSelectedProcess"
                >
                  <span class="deasy-hero-back-button__icon">
                    <IconArrowLeft class="h-4.5 w-4.5" />
                  </span>
                  <span>Volver</span>
                </button>
              </div>
            </div>

            <section v-if="processPanelLoading" class="bg-sky-50 border border-sky-100 text-sky-800 rounded-2xl p-5 font-semibold text-sm animate-pulse">
              Cargando la configuración seleccionada...
            </section>

            <section v-else-if="processPanelError" class="bg-rose-50 border border-rose-200 text-rose-700 text-sm font-bold rounded-2xl p-5 shadow-sm">
              {{ processPanelError }}
            </section>

            <template v-else>
              <section v-if="processActionMessage" class="rounded-2xl p-5 font-bold text-sm shadow-sm" :class="processActionMessage.type === 'error' ? 'bg-rose-50 border border-rose-200 text-rose-700' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'">
                {{ processActionMessage.text }}
              </section>

              <!-- Rediseño routed: página enfocada de envíos/recibidos (reemplaza la vista genérica de tareas). -->
              <RoutedProcessPanel
                v-if="isRoutedProcess"
                :purpose="routedPanelPurpose"
                :create-label="routedCreateLabel"
                :sends="routedSends"
                :received="routedReceived"
                :loading="routedInboxLoading"
                @create="openNewSend"
                @refresh="loadRoutedInbox"
              />

              <section v-else class="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <!-- Tareas -->
                <article class="lg:col-span-12 bg-white rounded-xl shadow-xl shadow-slate-200/40 p-5 md:p-6 border border-slate-100 flex flex-col gap-5">
                  <section class="overflow-hidden rounded-[2rem] border border-sky-100 bg-linear-to-br from-sky-50 via-white to-slate-50 shadow-inner shadow-sky-100/40">
                    <div class="flex flex-col gap-5 px-4 py-4 md:px-5 md:py-5">
                      <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <button type="button" class="group relative flex w-full items-center gap-3 rounded-[1.2rem] border border-slate-200/90 bg-white px-4 py-4 text-left shadow-[0_8px_18px_rgba(15,23,42,0.05)] transition duration-200 hover:-translate-y-0.5 hover:border-sky-200 hover:bg-sky-50/40" @click="openTaskFiltersModal">
                          <span class="inline-flex h-11 w-11 items-center justify-center rounded-[0.95rem] border border-sky-100 bg-sky-50/70 text-sky-700 transition-all group-hover:border-sky-200 group-hover:bg-sky-50">
                            <IconSearch class="h-5 w-5" />
                          </span>
                          <span class="flex min-w-0 flex-col">
                            <span class="text-sm font-bold text-slate-800">Filtrar tareas</span>
                          </span>
                        </button>
                        <button type="button" class="group relative flex w-full items-center gap-3 rounded-[1.2rem] border border-slate-200/90 bg-white px-4 py-4 text-left shadow-[0_8px_18px_rgba(15,23,42,0.05)] transition duration-200 hover:-translate-y-0.5 hover:border-sky-200 hover:bg-sky-50/40" @click="navigateToDocumentCenterPage">
                          <span class="inline-flex h-11 w-11 items-center justify-center rounded-[0.95rem] border border-sky-100 bg-sky-50/70 text-sky-700 transition-all group-hover:border-sky-200 group-hover:bg-sky-50">
                            <IconFileDescription class="h-5 w-5" />
                          </span>
                          <span class="flex min-w-0 flex-col">
                            <span class="text-sm font-bold text-slate-800">Centro documental</span>
                          </span>
                        </button>
                        <button type="button" class="group relative flex w-full items-center gap-3 rounded-[1.2rem] border border-slate-200/90 bg-white px-4 py-4 text-left shadow-[0_8px_18px_rgba(15,23,42,0.05)] transition duration-200 hover:-translate-y-0.5 hover:border-sky-200 hover:bg-sky-50/40" @click="navigateToGlobalSignaturePage">
                          <span class="inline-flex h-11 w-11 items-center justify-center rounded-[0.95rem] border border-sky-100 bg-sky-50/70 text-sky-700 transition-all group-hover:border-sky-200 group-hover:bg-sky-50">
                            <IconSignature class="h-5 w-5" />
                          </span>
                          <span class="flex min-w-0 flex-col">
                            <span class="text-sm font-bold text-slate-800">Firma global</span>
                          </span>
                        </button>
                        <button type="button" class="group relative flex w-full items-center gap-3 rounded-[1.2rem] border border-slate-200/90 bg-white px-4 py-4 text-left shadow-[0_8px_18px_rgba(15,23,42,0.05)] transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50/70" @click="openGeneralTaskModal('free')">
                          <span class="inline-flex h-11 w-11 items-center justify-center rounded-[0.95rem] border border-slate-200 bg-slate-50/80 text-slate-600 transition-all group-hover:border-slate-300 group-hover:bg-slate-100">
                            <IconPlus class="h-5 w-5" />
                          </span>
                          <span class="flex min-w-0 flex-col">
                            <span class="text-sm font-bold text-slate-800">Nueva tarea</span>
                          </span>
                        </button>
                      </div>
                      <div class="flex flex-wrap items-center justify-between gap-3 rounded-[1.35rem] border border-slate-200/80 bg-white/80 px-4 py-3">
                        <div class="text-sm font-medium text-slate-500">
                          Tareas visibles:
                          <span class="font-bold text-slate-700">{{ filteredProcessDeliverables.length }}</span>
                        </div>
                        <div class="flex flex-wrap gap-2">
                          <AppTag v-if="taskListFilters.query" variant="info">Búsqueda</AppTag>
                          <AppTag v-if="taskListFilters.year !== 'all'" variant="neutral">{{ taskListFilters.year }}</AppTag>
                          <AppTag v-if="taskListFilters.termType !== 'all'" variant="neutral">{{ taskListFilters.termType }}</AppTag>
                          <AppTag v-if="taskListFilters.participation !== 'all'" variant="warning">
                            {{ taskFilterParticipationOptions.find((option) => option.value === taskListFilters.participation)?.label || 'Participación' }}
                          </AppTag>
                          <AppTag v-if="taskListFilters.actionState !== 'all'" variant="success">
                            {{ taskFilterActionOptions.find((option) => option.value === taskListFilters.actionState)?.label || 'Acción' }}
                          </AppTag>
                          <AppButton variant="softNeutral" size="sm" @click="resetTaskListFilters">Limpiar</AppButton>
                        </div>
                      </div>
                    </div>
                  </section>

                  <!-- Routed: panel de envíos (crear/endosar). Los recibidos llegan al Centro de firmas. -->
                  <section v-if="isRoutedProcess" class="px-2 md:px-3 xl:px-4">
                    <div class="rounded-2xl border border-indigo-100 bg-linear-to-br from-indigo-50/60 via-white to-sky-50/40 p-4 flex flex-wrap items-center justify-between gap-3">
                      <div class="flex items-center gap-3">
                        <span class="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-100 bg-white text-indigo-600">
                          <IconSend class="h-5 w-5" />
                        </span>
                        <div class="flex min-w-0 flex-col">
                          <h3 class="m-0 text-sm font-bold text-slate-800">Mis envíos</h3>
                          <p class="m-0 text-xs font-medium text-slate-500">Crea y endosa un documento a una persona. Lo que te envían llega a tu Centro de firmas.</p>
                        </div>
                      </div>
                      <AppButton variant="primary" size="sm" @click="openNewSend">
                        <span class="inline-flex items-center gap-1.5"><IconPlus class="h-4 w-4" /> Nuevo envío</span>
                      </AppButton>
                    </div>
                  </section>

                  <section v-if="addableDeliverableEntries.length && !isRoutedProcess" class="px-2 md:px-3 xl:px-4">
                    <div class="rounded-2xl border border-sky-100 bg-sky-50/40 p-4 flex flex-col gap-3">
                      <div class="flex items-center gap-1.5">
                        <h3 class="m-0 text-sm font-bold uppercase tracking-wider text-slate-700">Agregar entregable</h3>
                        <IconInfoCircle class="h-4 w-4 text-slate-400" title="Crea réplicas con etiqueta o envíos a un destinatario, según el modo configurado en el proceso." />
                      </div>
                      <div class="flex flex-wrap gap-2">
                        <AppButton
                          v-for="entry in addableDeliverableEntries"
                          :key="`add-${entry.task.id}-${entry.template.id}`"
                          variant="softPrimary"
                          size="sm"
                          @click="openAddDeliverableModal(entry.task, entry.template)"
                        >
                          <span class="inline-flex items-center gap-1.5">
                            <IconPlus class="h-4 w-4" />
                            {{ entry.template.item_mode === 'routed' ? 'Enviar' : 'Agregar' }}: {{ entry.template.name || 'Entregable' }}
                          </span>
                        </AppButton>
                      </div>
                    </div>
                  </section>

                  <div v-if="!selectedProcessPanel.tasks.length && !isRoutedProcess" class="border-2 border-dashed border-slate-200 rounded-xl p-8 text-slate-500 bg-slate-50/50 text-center text-sm font-medium">
                    No tienes tareas activas o históricas para esta configuración.
                  </div>

                  <div v-else-if="!filteredProcessDeliverables.length" class="border-2 border-dashed border-slate-200 rounded-xl p-8 text-slate-500 bg-slate-50/50 text-center text-sm font-medium">
                    {{ isRoutedProcess
                      ? 'Aún no has enviado ningún documento. Usa "Nuevo envío" para crear el primero.'
                      : 'No hay entregables que coincidan con los filtros actuales.' }}
                  </div>

                  <div v-else class="px-2 md:px-3 xl:px-4 flex flex-col gap-5">
                    <div class="flex items-center gap-3 px-1">
                      <div class="h-px flex-1 bg-slate-200/90"></div>
                      <AppButton
                        variant="plain"
                        class-name="inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-slate-200 bg-white text-xs font-semibold text-slate-500 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
                        :aria-label="isProcessCollapsed ? 'Expandir proceso' : 'Colapsar proceso'"
                        :title="isProcessCollapsed ? 'Expandir proceso' : 'Colapsar proceso'"
                        @click="toggleDeliverableProcess"
                      >
                        <span>{{ isProcessCollapsed ? 'Expandir' : 'Colapsar' }}</span>
                        <IconChevronDown class="h-4 w-4 transition-transform duration-200" :class="isProcessCollapsed ? 'rotate-180' : ''" />
                      </AppButton>
                      <div class="h-px flex-1 bg-slate-200/90"></div>
                    </div>
                    <section
                      v-for="row in deliverableRows"
                      :key="row.id"
                      class="flex flex-col gap-3"
                    >
                      <div class="grid grid-cols-1 gap-x-9 gap-y-0 md:grid-cols-2 xl:grid-cols-3">
                        <DeliverableCard
                          v-for="deliverable in row.items"
                          :key="deliverable.key"
                          :deliverable="deliverable"
                          :helpers="deliverableCardHelpers"
                          :processing-fill-item-id="processingFillItemId"
                          :fill-workflow-submitting="fillWorkflowSubmitting"
                          :is-uploading-deliverable="isUploadingDeliverable"
                          @toggle="toggleDeliverableCard"
                          @open="openDeliverableWorkspaceModal(getDeliverableWorkspacePayload($event))"
                          @start="startDeliverableFlow"
                          @upload="handleInlineDeliverableUpload($event.item, $event.files)"
                          @sign="openDocumentSignFlow"
                          @approve="submitDeliverableCardFillAction($event, 'approve')"
                          @download="downloadDeliverableFile"
                          @template="handleDeliverableFutureAction('download_template', $event)"
                          @preview="previewDeliverableFile"
                          @chat="handleDeliverableFutureAction('process_chat', $event)"
                        />
                      </div>
                    </section>
                  </div>
                </article>

                <!-- Dependencies (Full width) -->
                <article class="lg:col-span-12 bg-white rounded-xl shadow-xl shadow-slate-200/40 p-5 md:p-6 border border-slate-100 flex flex-col gap-5">
                  <header class="flex flex-col gap-2">
                    <h2 class="text-lg font-bold text-slate-800 m-0 leading-tight">Dependencias de la configuración</h2>
                    <p class="text-slate-500 text-sm m-0 font-medium">Resumen de reglas, disparadores y artifacts de proceso que hacen operativa esta configuración.</p>
                  </header>
                  <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <section class="p-5 rounded-2xl bg-slate-50/70 border border-slate-200">
                      <h3 class="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4 flex items-center gap-2"><IconSquareCheck class="w-4 h-4 text-slate-400"/> Reglas</h3>
                      <div v-if="!selectedProcessPanel.dependencies.rules.length" class="text-sm text-slate-500 font-medium italic">
                        Sin reglas activas para tu alcance.
                      </div>
                      <ul v-else class="flex flex-col gap-2.5 m-0 p-0 list-none">
                        <li v-for="rule in selectedProcessPanel.dependencies.rules" :key="rule.id" class="text-sm font-medium text-slate-600 flex items-start gap-2">
                          <span class="w-1.5 h-1.5 rounded-full bg-sky-400 mt-1.5 shrink-0"></span> {{ rule.display_label }}
                        </li>
                      </ul>
                    </section>
                    <section class="p-5 rounded-2xl bg-slate-50/70 border border-slate-200">
                      <h3 class="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4 flex items-center gap-2"><IconGlobe class="w-4 h-4 text-slate-400"/> Periodos del proceso</h3>
                      <div v-if="!selectedProcessPanel.dependencies.period_types.length" class="text-sm text-slate-500 font-medium italic">
                        Sin tipos de periodo activos.
                      </div>
                      <ul v-else class="flex flex-col gap-2.5 m-0 p-0 list-none">
                        <li v-for="periodType in selectedProcessPanel.dependencies.period_types" :key="periodType.id" class="text-sm font-medium text-slate-600 flex items-start gap-2">
                          <span class="w-1.5 h-1.5 rounded-full bg-sky-400 mt-1.5 shrink-0"></span> {{ formatTriggerLabel(periodType) }}
                        </li>
                      </ul>
                    </section>
                    <section class="p-5 rounded-2xl bg-slate-50/70 border border-slate-200">
                      <h3 class="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4 flex items-center gap-2"><IconBuildingMonument class="w-4 h-4 text-slate-400"/> Paquetes</h3>
                      <div v-if="!selectedProcessPanel.dependencies.templates.length" class="text-sm text-slate-500 font-medium italic">
                        Sin artifacts vinculados.
                      </div>
                      <ul v-else class="flex flex-col gap-3 m-0 p-0 list-none">
                        <li v-for="template in selectedProcessPanel.dependencies.templates" :key="template.id" class="text-sm font-bold text-slate-700 flex flex-col gap-1 bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                          <span>{{ template.template_artifact_name }}</span>
                        </li>
                      </ul>
                    </section>
                  </div>
                </article>
              </section>
            </template>
          </section>
        </template>
  </AppWorkspaceShell>

    <AdminModalShell
      controlled
      :open="showTaskLaunchModal"
      labelled-by="task-launch-modal-title"
      title="Crear tarea manual"
      size="lg"
      body-class="p-6 lg:p-8 overflow-y-auto flex flex-col gap-6 custom-scrollbar"
      footer-class="px-6 lg:px-8 gap-4"
      @close="closeTaskLaunchModal"
    >
      <template #title>
        <div>
          <div class="text-2xl font-bold tracking-tight text-slate-800">Crear tarea manual</div>
          <p class="mt-1 mb-0 text-sm font-medium text-slate-500">{{ selectedProcessPanel?.definition?.name || 'Configuración seleccionada' }}</p>
        </div>
      </template>

      <div class="flex flex-col gap-6">
        <div class="flex flex-wrap items-center gap-2">
          <div
            v-for="step in taskLaunchSteps"
            :key="step.id"
            class="inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-bold transition-colors"
            :class="taskLaunchStep >= step.id ? 'border-sky-200 bg-sky-50 text-sky-700' : 'border-slate-200 bg-white text-slate-400'"
          >
            <span class="inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px]" :class="taskLaunchStep >= step.id ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-500'">
              {{ step.id }}
            </span>
            <span>{{ step.label }}</span>
          </div>
        </div>

        <div v-if="taskLaunchError" class="bg-rose-50 border border-rose-200 text-rose-700 text-sm font-bold rounded-2xl p-5 shadow-sm">
          {{ taskLaunchError }}
        </div>

        <section v-if="taskLaunchStep === 1" class="grid grid-cols-1 md:grid-cols-2 gap-5 lg:gap-6">
          <div class="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50/60 p-5">
            <div class="flex flex-wrap gap-2">
              <AppTag variant="info">Tarea ligada a proceso</AppTag>
              <AppTag variant="muted">{{ selectedProcessPanel?.definition?.access_source === 'flow' ? 'Acceso derivado' : 'Acceso directo' }}</AppTag>
            </div>
            <p class="mt-3 mb-0 text-sm font-medium text-slate-600">
              Define el contexto operativo de la tarea. El backend la materializará usando los templates activos de esta configuración.
            </p>
          </div>

          <label class="flex flex-col gap-2 md:col-span-2">
            <span class="font-bold text-slate-700 text-sm">Descripción</span>
            <textarea
              v-model="taskLaunchForm.description"
              class="block w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-2xl text-slate-900 focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500 focus:bg-white transition-all outline-none text-sm font-medium placeholder-slate-400 resize-none"
              rows="3"
              placeholder="Describe brevemente la tarea manual que vas a lanzar."
            />
          </label>

          <label class="flex flex-col gap-2">
            <span class="font-bold text-slate-700 text-sm">Periodo existente</span>
            <div class="relative">
              <select v-model="taskLaunchForm.term_id" class="block w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-2xl text-slate-900 focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500 focus:bg-white transition-all outline-none text-sm font-medium appearance-none disabled:opacity-50 disabled:cursor-not-allowed" :disabled="taskLaunchUseCustomTerm">
                <option value="">Seleccionar</option>
                <option v-for="term in selectedProcessPanel?.available_terms || []" :key="term.id" :value="String(term.id)">
                  {{ term.name }} · {{ term.term_type_name }}
                </option>
              </select>
              <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                <svg fill="none" stroke="currentColor" class="h-4 w-4" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m19 9-7 7-7-7"/></svg>
              </div>
            </div>
          </label>

          <div v-if="selectedProcessPanel?.permissions?.can_launch_custom_term" class="mt-1 md:mt-7 p-3 rounded-2xl border border-slate-100 bg-slate-50/50">
            <SToggle v-model="taskLaunchUseCustomTerm" label="Crear periodo custom" />
          </div>

          <template v-if="taskLaunchUseCustomTerm">
            <label class="flex flex-col gap-2 md:col-span-2">
              <span class="font-bold text-slate-700 text-sm">Nombre del periodo custom</span>
              <input v-model="taskLaunchForm.custom_name" class="block w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-2xl text-slate-900 focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500 focus:bg-white transition-all outline-none text-sm font-medium placeholder-slate-400" type="text" placeholder="Ejemplo: Seguimiento extraordinario abril" />
            </label>
            <label class="flex flex-col gap-2">
              <span class="font-bold text-slate-700 text-sm">Fecha inicial</span>
              <input v-model="taskLaunchForm.custom_start_date" class="block w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-2xl text-slate-900 focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500 focus:bg-white transition-all outline-none text-sm font-medium" type="date" />
            </label>
            <label class="flex flex-col gap-2">
              <span class="font-bold text-slate-700 text-sm">Fecha final</span>
              <input v-model="taskLaunchForm.custom_end_date" class="block w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-2xl text-slate-900 focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500 focus:bg-white transition-all outline-none text-sm font-medium" type="date" />
            </label>
          </template>
        </section>

        <section v-else-if="taskLaunchStep === 2" class="flex flex-col gap-5">
          <div class="rounded-xl border border-sky-200 bg-sky-50/70 p-5">
            <h3 class="m-0 text-base font-bold text-sky-900">Base documental de la tarea</h3>
            <p class="mt-2 mb-0 text-sm font-medium text-sky-800/80">
              Esta tarea se creará usando los templates activos de la configuración. En este corte, Home informa el alcance documental real antes de confirmar la creación.
            </p>
          </div>

          <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <article class="rounded-xl border border-slate-200 bg-white p-5 flex flex-col gap-4">
              <header class="flex items-center justify-between gap-3">
                <div>
                  <h3 class="m-0 text-base font-bold text-slate-800">Templates operativos</h3>
                  <p class="mt-1 mb-0 text-sm font-medium text-slate-500">Se materializan al crear la tarea.</p>
                </div>
                <AppTag variant="info">{{ taskLaunchSystemTemplates.length }}</AppTag>
              </header>
              <div v-if="!taskLaunchSystemTemplates.length" class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-500">
                Esta configuración no tiene templates de proceso que generen tarea.
              </div>
              <div v-else class="flex flex-col gap-3">
                <article v-for="template in taskLaunchSystemTemplates" :key="template.id" class="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 flex flex-col gap-2">
                  <div class="flex flex-wrap items-center gap-2">
                    <strong class="text-sm font-bold text-slate-800">{{ template.template_artifact_name }}</strong>
                    <AppTag variant="success">Proceso</AppTag>
                  </div>
                  <div class="flex flex-wrap gap-2">
                    <AppTag variant="neutral">{{ template.signature_flow_count ? `Firmas: ${template.signature_flow_count}` : 'Sin flujo de firma activo' }}</AppTag>
                    <AppTag variant="warning">Entregable requerido</AppTag>
                  </div>
                </article>
              </div>
            </article>

            <article class="rounded-xl border border-slate-200 bg-white p-5 flex flex-col gap-4">
              <header class="flex items-center justify-between gap-3">
                <div>
                  <h3 class="m-0 text-base font-bold text-slate-800">Artifacts generales</h3>
                  <p class="mt-1 mb-0 text-sm font-medium text-slate-500">Disponibles para iteraciones posteriores del flujo manual.</p>
                </div>
                <AppTag variant="muted">{{ selectedProcessPanel?.user_packages?.length || 0 }}</AppTag>
              </header>
              <div v-if="!selectedProcessPanel?.user_packages?.length" class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-500">
                No tienes artifacts generales registrados en esta cuenta.
              </div>
              <div v-else class="flex flex-col gap-3">
                <article v-for="item in selectedProcessPanel.user_packages.slice(0, 4)" :key="item.id" class="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 flex items-center justify-between gap-3">
                  <div class="min-w-0">
                    <strong class="block truncate text-sm font-bold text-slate-800">{{ item.display_name }}</strong>
                    <p class="mt-1 mb-0 text-xs font-medium text-slate-500">{{ item.description || 'Plantilla de documento registrada por el usuario.' }}</p>
                  </div>
                  <AppTag :variant="Number(item.is_active) === 1 ? 'success' : 'muted'" class-name="shrink-0">{{ Number(item.is_active) === 1 ? 'Activa' : 'Inactiva' }}</AppTag>
                </article>
              </div>
            </article>
          </div>
        </section>

        <section v-else class="flex flex-col gap-5">
          <div class="rounded-xl border border-emerald-200 bg-emerald-50/70 p-5">
            <h3 class="m-0 text-base font-bold text-emerald-900">Confirmación</h3>
            <p class="mt-2 mb-0 text-sm font-medium text-emerald-800/80">
              Revisa el contexto antes de crear la tarea. La materialización documental se hará con los templates activos del proceso.
            </p>
          </div>

          <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <article class="rounded-xl border border-slate-200 bg-white p-5 flex flex-col gap-4">
              <h3 class="m-0 text-base font-bold text-slate-800">Resumen operativo</h3>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div class="rounded-2xl bg-slate-50 border border-slate-200 p-4">
                  <div class="text-xs font-bold uppercase tracking-wider text-slate-500">Configuración</div>
                  <div class="mt-2 text-sm font-bold text-slate-800">{{ selectedProcessPanel?.definition?.name || '—' }}</div>
                </div>
                <div class="rounded-2xl bg-slate-50 border border-slate-200 p-4">
                  <div class="text-xs font-bold uppercase tracking-wider text-slate-500">Periodo</div>
                  <div class="mt-2 text-sm font-bold text-slate-800">{{ taskLaunchSelectedTermLabel }}</div>
                </div>
                <div class="rounded-2xl bg-slate-50 border border-slate-200 p-4 sm:col-span-2">
                  <div class="text-xs font-bold uppercase tracking-wider text-slate-500">Descripción</div>
                  <div class="mt-2 text-sm font-medium text-slate-700">{{ taskLaunchForm.description || 'Sin descripción adicional.' }}</div>
                </div>
              </div>
            </article>

            <article class="rounded-xl border border-slate-200 bg-white p-5 flex flex-col gap-4">
              <h3 class="m-0 text-base font-bold text-slate-800">Impacto documental</h3>
              <div class="flex flex-wrap gap-2">
                <AppTag variant="info">{{ taskLaunchSystemTemplates.length }} templates de proceso</AppTag>
                <AppTag variant="neutral">{{ selectedProcessPanel?.dependencies?.period_types?.length || 0 }} tipos de periodo activos</AppTag>
                <AppTag variant="muted">{{ selectedProcessPanel?.dependencies?.rules?.length || 0 }} reglas vigentes</AppTag>
              </div>
              <ul class="m-0 pl-5 text-sm font-medium text-slate-600 flex flex-col gap-2">
                <li>La tarea se creará en modo manual dentro de esta configuración.</li>
                <li>El backend generará entregables y documentos según los templates activos.</li>
                <li>Los flujos de entrega y firma dependerán de la configuración actual de cada template.</li>
              </ul>
            </article>
          </div>
        </section>
      </div>
      <template #footer>
        <AppButton variant="secondary" size="lg" type="button" :disabled="taskLaunchSubmitting" @click="closeTaskLaunchModal">
          Cancelar
        </AppButton>
        <AppButton
          v-if="taskLaunchStep > 1"
          variant="softNeutral"
          size="lg"
          type="button"
          :disabled="taskLaunchSubmitting"
          @click="goToPreviousTaskLaunchStep"
        >
          Volver
        </AppButton>
        <AppButton
          v-if="taskLaunchStep < taskLaunchSteps.length"
          variant="primary"
          size="lg"
          type="button"
          :disabled="!canAdvanceTaskLaunchStep"
          @click="goToNextTaskLaunchStep"
        >
          Continuar
        </AppButton>
        <AppButton v-else variant="primary" size="lg" type="button" :disabled="!canSubmitTaskLaunch" @click="submitTaskLaunch">
          {{ taskLaunchSubmitting ? 'Creando tarea...' : 'Crear tarea' }}
        </AppButton>
      </template>
    </AdminModalShell>

    <AdminModalShell
      ref="taskFiltersModal"
      labelled-by="task-filters-modal-title"
      title="Filtrar tareas y entregables"
      size="lg"
      content-class="rounded-4 shadow border-0"
      body-class="pt-4"
    >
      <div class="deasy-filter-shell flex flex-col gap-5">
        <label class="deasy-filter-field">
          <span class="sr-only">Buscar</span>
          <div class="relative">
            <IconSearch class="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              v-model="taskListFilters.query"
              type="text"
              placeholder="Buscar entregables, periodos o unidades"
              class="deasy-filter-search-input py-3 pl-11 pr-4"
            />
          </div>
        </label>

        <div class="deasy-filter-grid md:grid-cols-3 xl:grid-cols-3">
          <label class="deasy-filter-field">
            <span class="sr-only">Año</span>
            <select v-model="taskListFilters.year" class="deasy-filter-control">
              <option value="all">Año</option>
              <option v-for="option in taskFilterYears" :key="option" :value="option">{{ option }}</option>
            </select>
          </label>
          <label class="deasy-filter-field">
            <span class="sr-only">Tipo de periodo</span>
            <select v-model="taskListFilters.termType" class="deasy-filter-control">
              <option value="all">Tipo de periodo</option>
              <option v-for="option in taskFilterTermTypes" :key="option" :value="option">{{ option }}</option>
            </select>
          </label>
          <label class="deasy-filter-field">
            <span class="sr-only">Unidad</span>
            <select v-model="taskListFilters.unit" class="deasy-filter-control">
              <option value="all">Unidad</option>
              <option v-for="option in taskFilterUnits" :key="option" :value="option">{{ option }}</option>
            </select>
          </label>
          <label class="deasy-filter-field">
            <span class="sr-only">Proceso</span>
            <select v-model="taskListFilters.process" class="deasy-filter-control">
              <option value="all">Proceso</option>
              <option v-for="option in taskFilterProcesses" :key="option" :value="option">{{ option }}</option>
            </select>
          </label>
          <label class="deasy-filter-field">
            <span class="sr-only">Periodo</span>
            <select v-model="taskListFilters.term" class="deasy-filter-control">
              <option value="all">Periodo</option>
              <option v-for="option in taskFilterTerms" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </label>
          <label class="deasy-filter-field">
            <span class="sr-only">Estado</span>
            <select v-model="taskListFilters.status" class="deasy-filter-control">
              <option value="all">Estado</option>
              <option v-for="option in taskFilterStatuses" :key="option" :value="option">{{ option }}</option>
            </select>
          </label>
          <label class="deasy-filter-field">
            <span class="sr-only">Participación</span>
            <select v-model="taskListFilters.participation" class="deasy-filter-control">
              <option v-for="option in taskFilterParticipationOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </label>
          <label class="deasy-filter-field">
            <span class="sr-only">Acción</span>
            <select v-model="taskListFilters.actionState" class="deasy-filter-control">
              <option v-for="option in taskFilterActionOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </label>
        </div>
      </div>
      <template #footer>
        <AppButton variant="softNeutral" class-name="deasy-filter-btn" @click="resetTaskListFilters">Reset</AppButton>
        <AppButton variant="secondary" @click="closeTaskFiltersModal">Cerrar</AppButton>
        <AppButton variant="primary" class-name="deasy-filter-btn" @click="closeTaskFiltersModal">Aplicar</AppButton>
      </template>
    </AdminModalShell>

    <AdminModalShell
      ref="documentSignModal"
      labelled-by="document-sign-modal-title"
      title="Firmar documento"
      size="xl"
      content-class="rounded-4 shadow border-0"
      body-class="pt-4"
    >
      <FirmarPdf ref="embeddedSignerRef" embedded @workflow-signed="handleEmbeddedWorkflowSigned" />
      <template #footer>
        <AppButton variant="secondary" data-modal-dismiss>
          Cerrar
        </AppButton>
      </template>
    </AdminModalShell>

    <AdminModalShell
      ref="documentCenterModal"
      labelled-by="document-center-modal-title"
      title="Centro documental"
      size="lg"
      content-class="rounded-4 shadow border-0"
      body-class="pt-4"
    >
      <div class="flex flex-col gap-4">
        <p class="text-sm text-slate-600 m-0">
          Este espacio quedará para la consulta general de documentos con filtros. Por ahora muestra un resumen básico de los documentos generados en esta configuración.
        </p>
        <div v-if="!selectedProcessPanel?.documents?.length" class="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-slate-500 bg-slate-50 text-center text-sm font-medium">
          No hay documentos generados todavía.
        </div>
        <div v-else class="flex flex-col gap-3">
          <div
            v-for="doc in selectedProcessPanel.documents"
            :key="`document-center-${doc.document_id}`"
            class="flex flex-col gap-2 p-4 rounded-xl border border-slate-200 bg-slate-50/50"
          >
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <strong class="text-sm font-bold text-slate-800">{{ doc.template_artifact_name || `Documento #${doc.document_id}` }}</strong>
              <AppTag variant="muted" class-name="self-start sm:self-auto">
                {{ doc.document_version ? `v${doc.document_version}` : `#${doc.document_version_id}` }}
              </AppTag>
            </div>
            <div class="flex flex-wrap gap-2">
              <AppTag variant="neutral">{{ doc.document_status || 'Inicial' }}</AppTag>
              <AppTag v-if="doc.pending_fill_count" variant="info">Entrega pendiente: {{ doc.pending_fill_count }}</AppTag>
              <AppTag v-if="doc.pending_signature_count" variant="warning">Firmas pendientes: {{ doc.pending_signature_count }}</AppTag>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <AppButton variant="secondary" data-modal-dismiss>
          Cerrar
        </AppButton>
      </template>
    </AdminModalShell>

    <AdminModalShell
      ref="deliverableWorkspaceModal"
      labelled-by="deliverable-workspace-modal-title"
      :title="deliverableWorkspaceTitle"
      size="xl"
      content-class="rounded-4 shadow border-0"
      body-class="pt-4"
    >
      <div class="flex flex-col gap-5">
        <div
          v-if="fillWorkflowState.subject || signatureFlowState.subject"
          class="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3"
          role="tablist"
          aria-label="Secciones del entregable"
        >
          <button
            v-if="deliverableWorkspaceSubject"
            type="button"
            role="tab"
            :aria-selected="deliverableWorkspaceState.tab === 'summary'"
            :tabindex="deliverableWorkspaceState.tab === 'summary' ? 0 : -1"
            class="rounded-t-xl border border-b-0 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition-colors"
            :class="getDeliverableWorkspaceTabClass('summary')"
            @click="deliverableWorkspaceState.tab = 'summary'"
          >
            General
          </button>
          <button
            v-if="fillWorkflowState.subject && hasFillWorkflowActivity(fillWorkflowState.subject)"
            type="button"
            role="tab"
            :aria-selected="deliverableWorkspaceState.tab === 'fill'"
            :tabindex="deliverableWorkspaceState.tab === 'fill' ? 0 : -1"
            class="rounded-t-xl border border-b-0 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition-colors"
            :class="getDeliverableWorkspaceTabClass('fill')"
            @click="deliverableWorkspaceState.tab = 'fill'"
          >
            Entrega
          </button>
          <button
            v-if="signatureFlowState.subject && shouldShowSignatureFlow(signatureFlowState.subject)"
            type="button"
            role="tab"
            :aria-selected="deliverableWorkspaceState.tab === 'signature'"
            :tabindex="deliverableWorkspaceState.tab === 'signature' ? 0 : -1"
            class="rounded-t-xl border border-b-0 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition-colors"
            :class="getDeliverableWorkspaceTabClass('signature')"
            @click="deliverableWorkspaceState.tab = 'signature'"
          >
            Firmas
          </button>
          <button
            v-if="deliverableWorkspaceSubject"
            type="button"
            role="tab"
            :aria-selected="deliverableWorkspaceState.tab === 'attachments'"
            :tabindex="deliverableWorkspaceState.tab === 'attachments' ? 0 : -1"
            class="rounded-t-xl border border-b-0 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition-colors"
            :class="getDeliverableWorkspaceTabClass('attachments')"
            @click="deliverableWorkspaceState.tab = 'attachments'"
          >
            Anexos
            <span v-if="attachmentsState.items.length" class="ml-1.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-indigo-100 px-1 text-[0.65rem] font-bold text-indigo-700">{{ attachmentsState.items.length }}</span>
          </button>
        </div>

        <template v-if="deliverableWorkspaceState.tab === 'summary'">
          <div v-if="deliverableWorkspaceSubject" class="flex flex-col gap-5">
            <section class="rounded-2xl border border-slate-200 bg-white p-4">
              <div class="flex flex-col gap-3">
                <!-- Estado del entregable -->
                <div class="flex flex-wrap gap-2">
                  <AppTag
                    v-for="tag in getDeliverableTagGroups(deliverableWorkspaceSubject)"
                    :key="`workspace-summary-${tag.key}`"
                    :variant="tag.variant"
                  >
                    {{ tag.label }}
                  </AppTag>
                </div>

                <!-- Datos del entregable (homogéneo) -->
                <dl class="grid gap-x-6 gap-y-2.5 m-0 sm:grid-cols-2 lg:grid-cols-4">
                  <div
                    class="flex flex-col gap-0.5 border-l-2 pl-3"
                    :class="shouldShowSign(deliverableWorkspaceSubject) || hasSignatureWorkflowActivity(deliverableWorkspaceSubject) ? 'border-[#4BF1A1]' : 'border-sky-300'"
                  >
                    <dt
                      class="text-[11px] font-bold uppercase tracking-[0.16em]"
                      :class="shouldShowSign(deliverableWorkspaceSubject) || hasSignatureWorkflowActivity(deliverableWorkspaceSubject) ? 'text-[#118a57]' : 'text-sky-600'"
                    >
                      Responsable actual
                    </dt>
                    <dd class="m-0 text-sm font-semibold text-slate-800">{{ getDeliverableCurrentResponsibility(deliverableWorkspaceSubject).name }}</dd>
                  </div>
                  <div class="flex flex-col gap-0.5 border-l-2 border-slate-100 pl-3">
                    <dt class="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Proceso</dt>
                    <dd class="m-0 text-sm font-semibold text-slate-700">{{ getDeliverableProcessLabel(null, deliverableWorkspaceSubject) }}</dd>
                  </div>
                  <div class="flex flex-col gap-0.5 border-l-2 border-slate-100 pl-3">
                    <dt class="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Unidad</dt>
                    <dd class="m-0 text-sm font-semibold text-slate-700">{{ getDeliverableUnitLabel(deliverableWorkspaceSubject) }}</dd>
                  </div>
                  <div class="flex flex-col gap-0.5 border-l-2 border-slate-100 pl-3">
                    <dt class="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Periodo</dt>
                    <dd class="m-0 text-sm font-semibold text-slate-700">{{ getDeliverablePeriodLabelFromSubject(deliverableWorkspaceSubject) }}</dd>
                    <dd class="m-0 text-xs font-medium text-slate-500">{{ getDeliverableDateRangeLabel(deliverableWorkspaceSubject) }}</dd>
                  </div>
                </dl>
              </div>
            </section>

            <section class="rounded-2xl border border-slate-200 bg-white p-4">
              <div class="flex items-center gap-1.5">
                <h3 class="m-0 text-sm font-bold uppercase tracking-wider text-slate-700">Acciones</h3>
                <IconInfoCircle class="h-4 w-4 text-slate-400" title="Todo lo que puedes hacer ahora con este entregable, en un solo lugar." />
              </div>
              <div class="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                <!-- Acción principal (destacada) -->
                <AppButton v-if="shouldShowStartDeliverable(deliverableWorkspaceSubject)" variant="primary" size="sm" :disabled="processingFillItemId === deliverableWorkspaceSubject.itemId || !canStartDeliverableAction(deliverableWorkspaceSubject)" @click="startDeliverableFlow(deliverableWorkspaceSubject)">
                  <span class="inline-flex items-center gap-1.5"><IconPlayerPlayFilled class="h-4 w-4" /> {{ processingFillItemId === deliverableWorkspaceSubject.itemId ? 'Iniciando...' : 'Iniciar' }}</span>
                </AppButton>
                <AppButton v-else-if="shouldShowUploadDeliverable(deliverableWorkspaceSubject)" variant="primary" size="sm" :disabled="!deliverableWorkspaceSubject.actions?.can_upload_deliverable || isUploadingDeliverable" @click="openDeliverableUploadModal(deliverableWorkspaceSubject)">
                  <span class="inline-flex items-center gap-1.5"><IconUpload class="h-4 w-4" /> {{ getUploadActionLabel(deliverableWorkspaceSubject) }}</span>
                </AppButton>
                <AppButton v-else-if="shouldShowSign(deliverableWorkspaceSubject)" variant="primary" size="sm" :disabled="!deliverableWorkspaceSubject.actions?.implemented?.sign" @click="openDocumentSignFlow(deliverableWorkspaceSubject)">
                  <span class="inline-flex items-center gap-1.5"><IconSignature class="h-4 w-4" /> Firmar</span>
                </AppButton>
                <AppButton v-else-if="shouldShowOpenWorkspacePrimary(deliverableWorkspaceSubject)" variant="primary" size="sm" @click="deliverableWorkspaceState.tab = shouldShowManageFill(deliverableWorkspaceSubject) ? 'fill' : 'signature'">
                  <span class="inline-flex items-center gap-1.5"><IconChecklist class="h-4 w-4" /> Ir al detalle</span>
                </AppButton>

                <!-- Revisión -->
                <AppButton v-if="canApproveFillRequest" variant="softSuccess" size="sm" :disabled="fillWorkflowSubmitting" @click="submitFillWorkflowAction('approve')"><span class="inline-flex items-center gap-1.5"><IconCircleCheck class="h-4 w-4" /> {{ fillApproveActionLabel }}</span></AppButton>
                <AppButton v-if="canReturnFillRequest" variant="softWarning" size="sm" :disabled="fillWorkflowSubmitting" @click="submitFillWorkflowAction('return')"><span class="inline-flex items-center gap-1.5"><IconArrowBackUp class="h-4 w-4" /> Devolver</span></AppButton>
                <AppButton v-if="canRejectFillRequest" variant="softDanger" size="sm" :disabled="fillWorkflowSubmitting" @click="submitFillWorkflowAction('reject')"><span class="inline-flex items-center gap-1.5"><IconX class="h-4 w-4" /> Rechazar</span></AppButton>

                <!-- Utilidades -->
                <AppButton variant="softNeutral" size="sm" :disabled="!deliverableWorkspaceSubject.actions?.can_open_process_chat" @click="handleDeliverableFutureAction('process_chat', deliverableWorkspaceSubject)"><span class="inline-flex items-center gap-1.5"><IconMessages class="h-4 w-4" /> Chat</span></AppButton>
                <AppButton v-if="getDeliverableSubject(deliverableWorkspaceSubject).preloadFilePath" variant="softNeutral" size="sm" @click="previewDeliverableFile(deliverableWorkspaceSubject)"><span class="inline-flex items-center gap-1.5"><IconEye class="h-4 w-4" /> Ver PDF</span></AppButton>
                <AppButton v-if="getDeliverableSubject(deliverableWorkspaceSubject).preloadFilePath" variant="softNeutral" size="sm" @click="downloadDeliverableFile(deliverableWorkspaceSubject)"><span class="inline-flex items-center gap-1.5"><IconDownload class="h-4 w-4" /> Descargar</span></AppButton>
                <AppButton v-if="shouldShowTemplateDownload(deliverableWorkspaceSubject)" variant="softNeutral" size="sm" :disabled="!deliverableWorkspaceSubject.actions?.can_download_template" @click="handleDeliverableFutureAction('download_template', deliverableWorkspaceSubject)"><span class="inline-flex items-center gap-1.5"><IconFileDescription class="h-4 w-4" /> Plantilla</span></AppButton>
                <AppButton v-if="deliverableWorkspaceSubject" variant="softNeutral" size="sm" @click="openDerivedTaskFromWorkspace"><span class="inline-flex items-center gap-1.5"><IconPlus class="h-4 w-4" /> Agregar entregable</span></AppButton>

                <!-- Destructiva -->
                <AppButton v-if="shouldShowResetWorkflow(deliverableWorkspaceSubject)" variant="softDanger" size="sm" :disabled="deliverableResetState.submitting" @click="openDeliverableResetModal(deliverableWorkspaceSubject)"><span class="inline-flex items-center gap-1.5"><IconMinus class="h-4 w-4" /> Reiniciar</span></AppButton>
              </div>
            </section>
          </div>
        </template>

        <template v-else-if="deliverableWorkspaceState.tab === 'fill'">
          <DeliverableFillTab
      :fill-workflow-state="fillWorkflowState"
      :observations="fillObservations"
      :observations-loading="observationsLoading"
      :observations-can-add="observationsCanAdd"
      :submitting-observation="submittingObservation"
      :resolving-observation-id="resolvingObservationId"
      @add-observation="submitDeliverableObservation"
      @resolve-observation="resolveDeliverableObservation"
          />
        </template>

        <template v-else-if="deliverableWorkspaceState.tab === 'signature'">
          <DeliverableSignatureTab
      :signature-flow-state="signatureFlowState"
      :observations="signatureObservations"
      :observations-loading="observationsLoading"
      :observations-can-add="observationsCanAdd"
      :submitting-observation="submittingObservation"
      :resolving-observation-id="resolvingObservationId"
      :capitalize="capitalize"
      :get-current-signature-step-order="getCurrentSignatureStepOrder"
      :get-signature-step-assigned-summary="getSignatureStepAssignedSummary"
      @add-observation="submitDeliverableObservation"
      @resolve-observation="resolveDeliverableObservation"
          />
        </template>
        <template v-else-if="deliverableWorkspaceState.tab === 'attachments'">
          <DeliverableAttachmentsTab
            v-model:attachment-upload-kind="attachmentUploadKind"
            :attachments-state="attachmentsState"
            :attachment-kind-labels="ATTACHMENT_KIND_LABELS"
            :handle-attachment-upload="handleAttachmentUpload"
            :handle-attachment-download="handleAttachmentDownload"
            :handle-attachment-delete="handleAttachmentDelete"
          />
        </template>
        <div v-else class="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm font-semibold text-slate-600 text-center">
          No hay una sección disponible para este entregable.
        </div>
      </div>
      <template #footer>
        <AppButton variant="secondary" data-modal-dismiss>
          Cerrar
        </AppButton>
      </template>
    </AdminModalShell>

    <GeneralTaskModal
      ref="generalTaskModal"
      :general-task-modal-title="generalTaskModalTitle"
      v-model:general-task-form="generalTaskForm"
      :general-task-error="generalTaskError"
      :general-task-submitting="generalTaskSubmitting"
      :flow-entrega="flowEntrega"
      :flow-firma="flowFirma"
      :flow-picker-target="flowPickerTarget"
      :flow-catalog="flowCatalog"
      v-model:flow-cargo-form="flowCargoForm"
      :recipient-results="recipientResults"
      :recipient-searching="recipientSearching"
      :sender-units="senderUnits"
      :show-sender-unit-select="showSenderUnitSelect"
      :sender-unit-name="senderUnitName"
      :is-send-flow-modal="isSendFlowModal"
      :open-flow-picker="openFlowPicker"
      :add-flow-person="addFlowPerson"
      :add-flow-cargo="addFlowCargo"
      :remove-from-entrega="removeFromEntrega"
      :remove-firma-step="removeFirmaStep"
      :remove-signer-from-step="removeSignerFromStep"
      :search-recipients="searchRecipients"
      v-model:recipient-query="recipientQuery"
      v-model:flow-picker-mode="flowPickerMode"
      @submit="submitGeneralTask"
    />

    <AdminModalShell
      ref="mySendsModal"
      labelled-by="my-sends-modal-title"
      title="Mis envíos"
      size="xl"
      content-class="rounded-4 shadow border-0"
      body-class="pt-4"
    >
      <div class="flex flex-col gap-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <p class="m-0 text-sm font-medium text-slate-500">Documentos que has enviado/endosado. Lo que te envían llega a tu Centro de firmas.</p>
          <label v-if="mySendsTypes.length > 1" class="flex items-center gap-2 text-sm">
            <span class="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-slate-500">Tipo</span>
            <select v-model="mySendsTypeFilter" class="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-medium text-slate-700 outline-none focus:border-indigo-400">
              <option value="all">Todos</option>
              <option v-for="t in mySendsTypes" :key="t.id" :value="t.id">{{ t.name }}</option>
            </select>
          </label>
        </div>

        <div v-if="mySendsLoading" class="text-sm text-slate-500">Cargando envíos…</div>
        <div v-else-if="!filteredMySends.length" class="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center text-sm font-medium text-slate-500">
          Aún no has enviado ningún documento.
        </div>
        <ul v-else class="m-0 flex flex-col gap-2 p-0 list-none">
          <li v-for="s in filteredMySends" :key="`send-${s.id}`" class="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <div class="flex min-w-0 flex-col gap-0.5">
              <div class="flex flex-wrap items-center gap-2">
                <AppTag variant="info">{{ s.process_name }}</AppTag>
                <span class="text-sm font-semibold text-slate-800">{{ s.label || `Envío #${s.id}` }}</span>
              </div>
              <span class="text-xs font-medium text-indigo-600">Para: {{ s.recipient_name || '—' }}</span>
            </div>
            <div class="flex items-center gap-3 text-xs text-slate-400">
              <span>{{ String(s.created_at || '').slice(0, 10) }}</span>
              <AppTag variant="muted">{{ s.status }}</AppTag>
            </div>
          </li>
        </ul>
      </div>
      <template #footer>
        <AppButton variant="secondary" data-modal-dismiss>Cerrar</AppButton>
      </template>
    </AdminModalShell>

    <AdminModalShell
      ref="fillWorkflowModal"
      labelled-by="fill-workflow-modal-title"
      title="Flujo de entrega"
      size="lg"
      content-class="rounded-4 shadow border-0"
      body-class="pt-4"
    >
      <div class="flex flex-col gap-5">
        <div v-if="fillWorkflowState.subject" class="flex flex-col gap-3">
          <div class="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
            <div class="flex flex-col gap-2">
              <strong class="text-base font-bold text-slate-800">{{ fillWorkflowState.subject.title }}</strong>
              <div class="flex flex-wrap gap-2">
                <AppTag variant="neutral">
                  Paso {{ fillWorkflowState.request?.step_order || 1 }}
                </AppTag>
                <AppTag variant="info">
                  Estado: {{ fillWorkflowState.request?.status_name || fillWorkflowState.request?.status || 'pending' }}
                </AppTag>
                <AppTag :variant="fillWorkflowState.subject.preloadFilePath ? 'success' : 'warning'">
                  {{ fillWorkflowState.subject.preloadFilePath ? `Archivo: ${getFileNameFromPath(fillWorkflowState.subject.preloadFilePath)}` : 'Sin archivo de trabajo' }}
                </AppTag>
              </div>
            </div>
          </div>

          <div class="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 class="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">Secuencia del flujo</h3>
            <div v-if="!fillWorkflowState.subject?.workflow?.fill_steps?.length" class="text-sm text-slate-500">
              Este entregable todavía no tiene una secuencia de entrega visible.
            </div>
            <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div
                v-for="step in fillWorkflowState.subject.workflow.fill_steps"
                :key="`fill-step-${step.id}-${step.request_id || 'na'}`"
                class="relative overflow-hidden rounded-[1.6rem] border bg-white p-4 shadow-sm transition"
                :class="getFillStepCardClass(step, fillWorkflowState.subject.workflow.fill_flow?.current_step_order)"
              >
                <div class="absolute inset-x-0 top-0 h-3" :class="getFillStepAccentClass(step, fillWorkflowState.subject.workflow.fill_flow?.current_step_order)"></div>
                <div class="flex flex-wrap justify-between items-start gap-3 pt-1">
                  <div class="flex items-center gap-2">
                    <span class="inline-flex h-9 min-w-9 items-center justify-center rounded-2xl bg-slate-100 px-3 text-sm font-extrabold text-slate-700">
                      {{ step.step_order }}
                    </span>
                    <div class="flex flex-col gap-1">
                      <strong class="text-sm font-bold text-slate-800">Paso {{ step.step_order }}</strong>
                      <span class="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Entrega</span>
                    </div>
                  </div>
                  <div class="flex flex-wrap gap-2 justify-end">
                    <AppTag :variant="getFillStepStatusTagVariant(step.request_status)">
                      {{ getFillStepStatusLabel(step.request_status) }}
                    </AppTag>
                    <AppTag
                      v-if="fillWorkflowState.subject.workflow.fill_flow?.current_step_order === step.step_order"
                      variant="accent"
                    >
                      Actual
                    </AppTag>
                  </div>
                </div>
                <div class="mt-4 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3">
                  <p class="text-xs font-bold uppercase tracking-[0.14em] text-slate-400 m-0">Responsable</p>
                  <p class="mt-1 text-sm font-semibold text-slate-700 m-0 leading-snug">{{ step.display_label }}</p>
                </div>
                <div class="mt-3 rounded-2xl bg-slate-50/60 px-4 py-3">
                  <p class="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 m-0">Regla</p>
                  <p class="mt-1 text-xs font-medium text-slate-500 m-0">{{ getFillStepResolverLabel(step) }}</p>
                </div>
                <div v-if="step.response_note" class="mt-3 rounded-2xl border border-slate-100 bg-white px-4 py-3">
                  <p class="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 m-0">Nota</p>
                  <p class="mt-1 mb-0 text-xs font-medium text-slate-600">{{ step.response_note }}</p>
                </div>
              </div>
            </div>
          </div>

          <div class="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 class="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">Historial de notas operativas</h3>
            <div v-if="!fillWorkflowNotes.length" class="text-sm text-slate-500">
              Aún no existen notas operativas registradas en este flujo.
            </div>
            <div v-else class="flex flex-col gap-3">
              <div
                v-for="noteEntry in fillWorkflowNotes"
                :key="`fill-note-${noteEntry.stepId}-${noteEntry.requestId || noteEntry.stepOrder}`"
                class="rounded-2xl border border-slate-200 bg-slate-50/50 p-4"
              >
                <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div class="flex flex-col gap-1">
                    <strong class="text-sm font-bold text-slate-800">
                      Paso {{ noteEntry.stepOrder }} · {{ noteEntry.label }}
                    </strong>
                    <span class="text-xs font-semibold text-slate-500">
                      {{ noteEntry.statusLabel }}
                    </span>
                  </div>
                  <span v-if="noteEntry.respondedAtLabel" class="text-xs font-medium text-slate-500">
                    {{ noteEntry.respondedAtLabel }}
                  </span>
                </div>
                <p class="mt-3 mb-0 text-sm font-medium leading-relaxed text-slate-700 whitespace-pre-wrap">
                  {{ noteEntry.note }}
                </p>
              </div>
            </div>
          </div>

          <div class="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 class="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">Acciones disponibles</h3>
            <p
              v-if="fillWorkflowState.request && !canOperateCurrentFillRequest"
              class="mb-3 text-sm font-medium text-slate-600"
            >
              Este paso corresponde a otro responsable. Desde aquí solo puedes revisar el estado del flujo.
            </p>
            <div class="flex flex-wrap gap-2">
              <AppButton
                v-if="canReplaceFillFile"
                variant="softNeutral"
                size="sm"
                :class="isUploadingDeliverable ? 'border-slate-100 bg-slate-100 text-slate-400 cursor-not-allowed' : ''"
                type="button"
                :disabled="isUploadingDeliverable"
                @click="triggerFillWorkflowFileReplace"
              >
                {{ isUploadingDeliverable ? 'Subiendo archivo...' : getUploadActionLabel(fillWorkflowState.subject) }}
              </AppButton>
              <AppButton
                v-if="canApproveFillRequest"
                variant="softSuccess"
                size="sm"
                :class="fillWorkflowSubmitting ? 'border-slate-100 bg-slate-100 text-slate-400 cursor-not-allowed' : ''"
                type="button"
                :disabled="fillWorkflowSubmitting"
                @click="submitFillWorkflowAction('approve')"
              >
                {{ fillApproveActionLabel }}
              </AppButton>
              <AppButton
                v-if="canReturnFillRequest"
                variant="softWarning"
                size="sm"
                :class="fillWorkflowSubmitting ? 'border-slate-100 bg-slate-100 text-slate-400 cursor-not-allowed' : ''"
                type="button"
                :disabled="fillWorkflowSubmitting"
                @click="submitFillWorkflowAction('return')"
              >
                Devolver
              </AppButton>
              <AppButton
                v-if="canRejectFillRequest"
                variant="softDanger"
                size="sm"
                :class="fillWorkflowSubmitting ? 'border-slate-100 bg-slate-100 text-slate-400 cursor-not-allowed' : ''"
                type="button"
                :disabled="fillWorkflowSubmitting"
                @click="submitFillWorkflowAction('reject')"
              >
                Rechazar
              </AppButton>
              <AppButton
                v-if="canCancelFillRequest"
                variant="softNeutral"
                size="sm"
                :class="fillWorkflowSubmitting ? 'border-slate-100 bg-slate-100 text-slate-400 cursor-not-allowed' : ''"
                type="button"
                :disabled="fillWorkflowSubmitting"
                @click="submitFillWorkflowAction('cancel')"
              >
                Cancelar solicitud
              </AppButton>
            </div>
          </div>

          <label class="flex flex-col gap-2">
            <span class="text-sm font-bold text-slate-700">Nota operativa</span>
            <textarea
              v-model="fillWorkflowState.note"
              rows="3"
              class="block w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-2xl text-slate-900 focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500 focus:bg-white transition-all outline-none text-sm font-medium placeholder-slate-400 resize-none"
              placeholder="Agrega una nota para esta acción."
            />
          </label>

          <div v-if="fillWorkflowState.error" class="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
            {{ fillWorkflowState.error }}
          </div>
        </div>
      </div>
      <template #footer>
        <AppButton variant="secondary" data-modal-dismiss>
          Cerrar
        </AppButton>
      </template>
    </AdminModalShell>

    <AdminModalShell
      ref="signatureFlowModal"
      labelled-by="signature-flow-modal-title"
      title="Flujo de firmas"
      size="xl"
      content-class="rounded-4 shadow border-0"
      body-class="pt-4"
      @close="closeSignatureFlowModal"
    >
      <div class="flex flex-col gap-5">
        <div v-if="signatureFlowState.loading" class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm font-semibold text-slate-600">
          Consultando la secuencia de firmas...
        </div>
        <div v-else-if="signatureFlowState.error" class="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm font-semibold text-rose-700">
          {{ signatureFlowState.error }}
        </div>
        <div v-else-if="signatureFlowState.snapshot" class="flex flex-col gap-5">
          <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <section class="rounded-2xl border border-slate-200 bg-slate-50 p-4 flex flex-col gap-2">
              <p class="text-xs uppercase tracking-wider font-semibold text-slate-500">Documento</p>
              <h3 class="text-lg font-bold text-slate-800 m-0">{{ signatureFlowState.subject?.title || 'Documento sin título' }}</h3>
              <div class="flex flex-wrap gap-2">
                <AppTag variant="neutral">
                  {{ signatureFlowState.subject?.documentId ? `Documento #${signatureFlowState.subject.documentId}` : 'Sin documento' }}
                </AppTag>
                <AppTag variant="muted">
                  {{ signatureFlowState.subject?.documentVersion ? `Versión v${signatureFlowState.subject.documentVersion}` : `v${signatureFlowState.subject?.documentVersionId || '—'}` }}
                </AppTag>
                <AppTag :variant="signatureFlowState.snapshot?.canOperate ? 'success' : 'warning'">
                  {{ signatureFlowState.snapshot?.signatureFlow?.statusCode ? signatureFlowState.snapshot.signatureFlow.statusCode : capitalize(signatureFlowState.snapshot?.currentStatus) || 'Pendiente' }}
                </AppTag>
              </div>
              <p class="text-xs text-slate-500">
                Estado documental: {{ capitalize(signatureFlowState.snapshot?.currentStatus) || 'Pendiente de firma' }}
              </p>
              <p v-if="!signatureFlowState.snapshot.readiness?.ok" class="text-xs text-rose-600">
                Motivo: {{ signatureFlowState.snapshot.readiness?.reason || 'Revisa el PDF o los firmantes.' }}
              </p>
            </section>
            <section class="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col gap-2 shadow-sm">
              <p class="text-xs uppercase tracking-wider font-semibold text-slate-500">Responsable actual</p>
              <p class="text-sm font-semibold text-slate-800 mb-0">
                {{ signatureFlowState.snapshot?.responsableActual
                  ? `${signatureFlowState.snapshot.responsableActual.firstName || ''} ${signatureFlowState.snapshot.responsableActual.lastName || ''}`.trim()
                  : 'Sin responsable resuelto' }}
              </p>
              <AppTag :variant="signatureFlowState.snapshot?.canOperate ? 'success' : 'muted'">
                {{ signatureFlowState.snapshot?.canOperate ? 'Puedes operar este paso' : 'Solo visualización' }}
              </AppTag>
              <p class="text-xs text-slate-500">
                Paso actual: {{ getCurrentSignatureStepOrder(signatureFlowState.snapshot) || '—' }}
              </p>
            </section>
            <section class="rounded-2xl border border-slate-200 bg-slate-50 p-4 flex flex-col gap-2">
              <p class="text-xs uppercase tracking-wider font-semibold text-slate-500">Secuencia</p>
              <p class="text-sm font-semibold text-slate-800 mb-0">{{ (signatureFlowState.snapshot.signatureSteps || []).length }} pasos sincronizados</p>
              <p class="text-xs text-slate-500">
                {{ signatureFlowState.snapshot.signatureRequests?.length || 0 }} solicitudes registradas
              </p>
              <p v-if="signatureFlowState.snapshot.readiness?.unresolvedRequiredSteps?.length" class="text-xs text-rose-600">
                Pasos sin firmantes: {{ signatureFlowState.snapshot.readiness.unresolvedRequiredSteps.map((step) => step.stepOrder).join(', ') }}
              </p>
            </section>
          </div>

          <section class="rounded-[1.8rem] border border-slate-200 bg-linear-to-br from-slate-50 via-white to-slate-100/70 p-4 flex flex-col gap-3 shadow-[0_14px_30px_rgba(15,23,42,0.06)]">
            <div class="flex items-center justify-between gap-2">
              <h3 class="text-sm font-bold text-slate-700 uppercase tracking-wider m-0">Pasos del flujo</h3>
              <AppTag variant="muted">
                {{ (signatureFlowState.snapshot.signatureSteps || []).length }} pasos
              </AppTag>
            </div>
            <div v-if="!signatureFlowState.snapshot.signatureSteps?.length" class="text-sm text-slate-500">
              Aún no hay pasos de firma: el flujo se genera al completarse la entrega del documento.
            </div>
            <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div
                v-for="step in signatureFlowState.snapshot.signatureSteps"
                :key="`signature-step-${step.id || step.step_order}`"
                class="relative overflow-hidden rounded-[5%] border bg-white p-4 shadow-[0_16px_32px_rgba(15,23,42,0.07)] ring-1 ring-white/70 transition"
                :class="getSignatureStepCardClass(step, signatureFlowState.snapshot.signatureRequests, getCurrentSignatureStepOrder(signatureFlowState.snapshot))"
              >
                <div class="absolute inset-x-0 top-0 h-3" :class="getSignatureStepAccentClass(step, signatureFlowState.snapshot.signatureRequests, getCurrentSignatureStepOrder(signatureFlowState.snapshot))"></div>
                <div class="flex flex-wrap justify-between items-start gap-3 pt-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="inline-flex h-9 min-w-9 items-center justify-center rounded-2xl bg-slate-100 px-3 text-sm font-extrabold text-slate-700">
                      {{ step.step_order || '—' }}
                    </span>
                    <div class="flex flex-col gap-1">
                      <p class="text-sm font-bold text-slate-800 m-0">Paso {{ step.step_order || '—' }}</p>
                      <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 m-0">Firma</p>
                    </div>
                  </div>
                  <div class="flex flex-wrap gap-2 justify-end">
                    <AppTag
                      :variant="getSignatureStepStatusVariant(getSignatureStepStatusCode(step, signatureFlowState.snapshot.signatureRequests, getCurrentSignatureStepOrder(signatureFlowState.snapshot)))"
                    >
                      {{ getSignatureStepStatusLabel(getSignatureStepStatusCode(step, signatureFlowState.snapshot.signatureRequests, getCurrentSignatureStepOrder(signatureFlowState.snapshot))) }}
                    </AppTag>
                    <AppTag :variant="step.assignees?.length ? 'success' : 'warning'">
                      {{ step.assignees?.length ? `${step.assignees.length} firmante(s)` : 'Sin responsables' }}
                    </AppTag>
                  </div>
                </div>
                <div class="mt-4 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3">
                  <p class="text-xs font-bold uppercase tracking-[0.14em] text-slate-400 m-0">Firmante</p>
                  <p class="mt-1 text-sm font-semibold text-slate-700 m-0 leading-snug">
                    {{ getSignatureStepAssignedSummary(step, signatureFlowState.snapshot.signatureRequests) }}
                  </p>
                </div>
                <div class="mt-3 rounded-2xl bg-slate-50/60 px-4 py-3">
                  <p class="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 m-0">Regla</p>
                  <p class="mt-1 text-xs font-medium text-slate-500 m-0">
                    {{ getSignatureStepResolverLabel(step) }}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section class="rounded-2xl border border-slate-200 bg-slate-50 p-4 flex flex-col gap-3">
            <div class="flex items-center justify-between gap-2">
              <h3 class="text-sm font-bold text-slate-700 uppercase tracking-wider m-0">Historial y trazabilidad</h3>
              <AppTag variant="neutral">
                {{ signatureFlowState.snapshot.signatureRequests?.length || 0 }} registros
              </AppTag>
            </div>
            <div v-if="!signatureFlowState.snapshot.signatureRequests?.length" class="text-sm text-slate-500">
              Aún no se ha registrado actividad sobre este flujo.
            </div>
            <div v-else class="flex flex-col gap-3">
              <div
                v-for="request in signatureFlowState.snapshot.signatureRequests"
                :key="`flow-request-${request.id}`"
                class="rounded-2xl border border-slate-100 bg-white p-3 flex flex-col gap-1"
              >
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <p class="text-sm font-semibold text-slate-800 m-0">Paso {{ request.stepOrder }}</p>
                  <AppTag :variant="signatureRequestTagVariant(request.requestStatusCode)">
                    {{ signatureRequestStatusLabel(request.requestStatusCode) }}
                  </AppTag>
                </div>
                <p class="text-xs text-slate-500 m-0">
                  {{ request.assignedPerson ? `${request.assignedPerson.firstName || ''} ${request.assignedPerson.lastName || ''}`.trim() : 'Firmante no resuelto' }}
                  · Cargo {{ request.cargoName || '—' }}
                </p>
                <p class="text-xs text-slate-500 m-0">
                  {{ request.respondedAt ? formatDateTime(request.respondedAt) : formatDateTime(request.requestedAt) }}
                </p>
              </div>
            </div>
          </section>

          <section class="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col gap-4">
            <div class="flex items-center justify-between gap-2">
              <div>
                <h3 class="text-sm font-bold text-slate-700 uppercase tracking-wider m-0">Firmar documento</h3>
                <p class="text-xs text-slate-500 m-0">Utiliza el visor integrado para completar tu paso actual.</p>
              </div>
              <AppTag :variant="signatureFlowState.snapshot?.canOperate ? 'success' : 'muted'">
                {{ signatureFlowState.snapshot?.canOperate ? 'Listo para operar' : 'Acceso en modo lectura' }}
              </AppTag>
            </div>
            <div v-if="signatureFlowState.snapshot?.canOperate">
              <FirmarPdf ref="signatureFlowSignerRef" embedded @workflow-signed="handleEmbeddedWorkflowSigned" />
            </div>
            <div v-else class="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-500">
              No hay firmas pendientes para tu usuario o el paso aún no está listo para operar.
            </div>
          </section>
        </div>
        <div v-else class="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm font-semibold text-slate-600 text-center">
          Selecciona una solicitud de firma para revisar su flujo.
        </div>
      </div>
      <template #footer>
        <AppButton variant="secondary" data-modal-dismiss>
          Cerrar
        </AppButton>
      </template>
    </AdminModalShell>

    <AdminModalShell
      ref="deliverableUploadModal"
      labelled-by="deliverable-upload-modal-title"
      :title="deliverableUploadModalTitle"
      size="md"
      content-class="rounded-4 shadow border-0"
      body-class="pt-4"
    >
      <div class="flex flex-col gap-4">
        <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          {{ deliverableUploadModalHelp }}
        </div>

        <PdfDropField
          variant="card"
          title="Archivo de trabajo"
          action-text="Seleccionar o arrastrar archivo"
          help-text="Formatos permitidos: PDF, Word y Excel."
          :icon="IconUpload"
          accept="application/pdf,.pdf,.doc,.docx,.xls,.xlsx,application/msword,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          :disabled="isUploadingDeliverable"
          :selected-file="selectedDeliverableUploadFile"
          input-id="home-deliverable-upload"
          @files-selected="handleDeliverableFilesSelected"
          @clear="clearDeliverableUploadSelection"
        />
      </div>
      <template #footer>
        <AppButton variant="secondary" :disabled="isUploadingDeliverable" @click="closeDeliverableUploadModal">
          Cancelar
        </AppButton>
        <AppButton variant="primary" :disabled="!selectedDeliverableUploadFile || isUploadingDeliverable" @click="submitDeliverableUpload">
          {{ isUploadingDeliverable ? 'Subiendo archivo...' : 'Subir archivo' }}
        </AppButton>
      </template>
    </AdminModalShell>

    <AdminModalShell
      ref="deliverableOperationModal"
      labelled-by="deliverable-operation-modal-title"
      :title="deliverableOperationState.title"
      size="md"
      content-class="rounded-4 shadow border-0"
      body-class="pt-4"
    >
      <div class="flex flex-col gap-4">
        <div
          class="rounded-2xl px-4 py-3 text-sm font-semibold"
          :class="deliverableOperationState.type === 'error'
            ? 'bg-rose-50 border border-rose-200 text-rose-700'
            : deliverableOperationState.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
              : 'bg-sky-50 border border-sky-200 text-sky-800'"
        >
          {{ deliverableOperationState.message }}
        </div>
        <p v-if="deliverableOperationState.detail" class="text-sm text-slate-600 m-0">
          {{ deliverableOperationState.detail }}
        </p>
      </div>
      <template #footer>
        <AppButton variant="secondary" data-modal-dismiss>
          Cerrar
        </AppButton>
      </template>
    </AdminModalShell>

    <AdminModalShell
      ref="deliverableSignResultModal"
      labelled-by="deliverable-sign-result-modal-title"
      :title="deliverableSignResultState.success ? 'Documento firmado' : 'Error al firmar'"
      size="md"
      content-class="rounded-4 shadow border-0"
      body-class="pt-4"
    >
      <div v-if="deliverableSignResultState.success" class="flex flex-col gap-4">
        <p class="mb-0 text-sm text-emerald-700 font-medium">
          {{ deliverableSignResultState.message || 'La firma del entregable se registró correctamente.' }}
        </p>
        <div v-if="deliverableSignResultState.signedPath" class="flex flex-wrap gap-3">
          <AppButton variant="outlinePrimary" @click="viewSignedDeliverableResult">
            Visualizar documento
          </AppButton>
          <AppButton variant="primary" @click="downloadSignedDeliverableResult">
            Descargar documento
          </AppButton>
        </div>
      </div>
      <p v-else class="mb-0 text-sm text-rose-700 font-medium">
        {{ deliverableSignResultState.message || 'No se pudo completar la firma.' }}
      </p>
      <template #footer>
        <AppButton variant="secondary" data-modal-dismiss>
          Cerrar
        </AppButton>
      </template>
    </AdminModalShell>

    <AdminModalShell
      ref="deliverableResetModal"
      labelled-by="deliverable-reset-modal-title"
      title="Resetear flujo del entregable"
      size="md"
      content-class="rounded-4 shadow border-0"
      body-class="pt-4"
      @close="closeDeliverableResetModal"
    >
      <div class="flex flex-col gap-4">
        <div class="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          Este reset cancelará el intento actual y creará una nueva versión documental para volver al inicio del flujo.
        </div>
        <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <p class="m-0 font-semibold text-slate-700">
            {{ deliverableResetState.target?.title || 'Entregable seleccionado' }}
          </p>
          <p class="mt-2 mb-0">
            La versión actual quedará como histórico cancelado. La nueva versión empezará desde cero y el documento no conservará el archivo de trabajo previo.
          </p>
        </div>
        <p v-if="deliverableResetState.error" class="m-0 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {{ deliverableResetState.error }}
        </p>
      </div>
      <template #footer>
        <AppButton variant="secondary" :disabled="deliverableResetState.submitting" @click="closeDeliverableResetModal">
          Cancelar
        </AppButton>
        <AppButton variant="warning" :disabled="deliverableResetState.submitting" @click="submitDeliverableReset">
          {{ deliverableResetState.submitting ? 'Reseteando...' : 'Resetear flujo' }}
        </AppButton>
      </template>
    </AdminModalShell>

    <DeliverablePreviewModal
      ref="deliverablePreviewModal"
      :name="deliverablePreviewName"
      :url="deliverablePreviewUrl"
      :is-pdf="deliverablePreviewIsPdf"
      @download="downloadPreviewedFile"
    >
      <!-- El panel de acciones del entregable solo lo tiene esta pantalla: el centro documental
           monta el mismo modal sin este slot y obtiene la vista previa a secas. -->
      <template #actions>
          <div
            v-if="hasDeliverablePreviewActions"
            class="rounded-2xl border border-slate-200 bg-white p-4"
          >
            <h3 class="mb-3 text-sm font-bold uppercase tracking-wider text-slate-700">
              Acciones disponibles
            </h3>
            <div class="flex flex-wrap gap-2">
              <button
                v-if="canReplacePreviewFillFile"
                type="button"
                class="group relative flex items-center gap-2.5 rounded-[1rem] border border-slate-200/90 bg-white px-3.5 py-2.5 text-left shadow-[0_6px_16px_rgba(15,23,42,0.04)] transition duration-200 hover:-translate-y-0.5 hover:border-sky-200 hover:bg-sky-50/45 hover:shadow-[0_10px_20px_rgba(14,165,233,0.08)] disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="isUploadingDeliverable"
                @click="openPreviewDeliverableUploadModal"
              >
                <div class="flex h-9 w-9 items-center justify-center rounded-[0.85rem] border border-sky-100/95 bg-sky-50/55 text-sky-700 transition-all group-hover:border-sky-200 group-hover:bg-sky-50">
                  <IconUpload class="h-4.5 w-4.5" />
                </div>
                <div class="flex min-w-0 flex-col">
                  <span class="text-sm font-semibold text-slate-800">
                    {{ isUploadingDeliverable ? 'Subiendo...' : getUploadActionLabel(deliverablePreviewSource) }}
                  </span>
                </div>
              </button>
              <button
                v-if="canApprovePreviewFillRequest"
                type="button"
                class="group relative flex items-center gap-2.5 rounded-[1rem] border border-slate-200/90 bg-white px-3.5 py-2.5 text-left shadow-[0_6px_16px_rgba(15,23,42,0.04)] transition duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-emerald-50/45 hover:shadow-[0_10px_20px_rgba(16,185,129,0.08)] disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="fillWorkflowSubmitting"
                @click="submitDeliverableCardFillAction(deliverablePreviewSource, 'approve')"
              >
                <div class="flex h-9 w-9 items-center justify-center rounded-[0.85rem] border border-emerald-100/95 bg-emerald-50/55 text-emerald-700 transition-all group-hover:border-emerald-200 group-hover:bg-emerald-50">
                  <IconCircleCheck class="h-4.5 w-4.5" />
                </div>
                <div class="flex min-w-0 flex-col">
                  <span class="text-sm font-semibold text-slate-800">
                    {{ getFillApproveActionLabelForPayload(deliverablePreviewSource) }}
                  </span>
                </div>
              </button>
              <button
                v-if="canReturnPreviewFillRequest"
                type="button"
                class="group relative flex items-center gap-2.5 rounded-[1rem] border border-slate-200/90 bg-white px-3.5 py-2.5 text-left shadow-[0_6px_16px_rgba(15,23,42,0.04)] transition duration-200 hover:-translate-y-0.5 hover:border-amber-200 hover:bg-amber-50/45 hover:shadow-[0_10px_20px_rgba(245,158,11,0.08)] disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="fillWorkflowSubmitting"
                @click="submitDeliverableCardFillAction(deliverablePreviewSource, 'return')"
              >
                <div class="flex h-9 w-9 items-center justify-center rounded-[0.85rem] border border-amber-100/95 bg-amber-50/55 text-amber-700 transition-all group-hover:border-amber-200 group-hover:bg-amber-50">
                  <IconMinus class="h-4.5 w-4.5" />
                </div>
                <div class="flex min-w-0 flex-col">
                  <span class="text-sm font-semibold text-slate-800">Devolver</span>
                </div>
              </button>
              <button
                v-if="canRejectPreviewFillRequest"
                type="button"
                class="group relative flex items-center gap-2.5 rounded-[1rem] border border-slate-200/90 bg-white px-3.5 py-2.5 text-left shadow-[0_6px_16px_rgba(15,23,42,0.04)] transition duration-200 hover:-translate-y-0.5 hover:border-rose-200 hover:bg-rose-50/45 hover:shadow-[0_10px_20px_rgba(244,63,94,0.08)] disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="fillWorkflowSubmitting"
                @click="submitDeliverableCardFillAction(deliverablePreviewSource, 'reject')"
              >
                <div class="flex h-9 w-9 items-center justify-center rounded-[0.85rem] border border-rose-100/95 bg-rose-50/55 text-rose-700 transition-all group-hover:border-rose-200 group-hover:bg-rose-50">
                  <IconX class="h-4.5 w-4.5" />
                </div>
                <div class="flex min-w-0 flex-col">
                  <span class="text-sm font-semibold text-slate-800">Rechazar</span>
                </div>
              </button>
            </div>
          </div>
      </template>
    </DeliverablePreviewModal>

    <WorkspaceChatLauncher :current-person-id="currentUser?.id || currentUser?._id || null" />
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, ref, nextTick, watch } from 'vue';
import { useWorkspaceChrome } from '@/shared/composables/useWorkspaceChrome.js';
import { useRouter, useRoute } from 'vue-router';
import AppWorkspaceShell from '@/layouts/workspace/AppWorkspaceShell.vue';
import AppDataTable from '@/shared/components/data/AppDataTable.vue';
import AppTag from '@/shared/components/data/AppTag.vue';
import FirmarPdf from '@/modules/firmas/components/FirmarPdf.vue';
import UserMenuService from '@/core/services/UserMenuService.js';
import ProcessDefinitionPanelService from '@/core/services/ProcessDefinitionPanelService.js';
import SignatureFlowService from '@/modules/firmas/services/SignatureFlowService.js';
import DossierService from '@/modules/dossier/services/DossierService.js';
import { API_ROUTES } from '@/core/config/apiConfig';
import { Modal } from '@/shared/utils/modalController';
import AdminModalShell from '@/shared/components/modals/AppModalShell.vue';
import AppButton from '@/shared/components/buttons/AppButton.vue';
import SToggle from '@/shared/components/forms/SToggle.vue';
import PdfDropField from '@/shared/components/forms/PdfDropField.vue';
import WorkspaceChatLauncher from '@/shared/components/widgets/WorkspaceChatLauncher.vue';
import DeliverableCard from '@/modules/home/components/DeliverableCard.vue';
import DeliverableObservations from '@/modules/home/components/DeliverableObservations.vue';
import SupervisorStuckPanel from '@/modules/home/components/SupervisorStuckPanel.vue';
import RoutedProcessPanel from '@/modules/home/components/RoutedProcessPanel.vue';
import { useRecipientSearch } from '@/modules/home/composables/useRecipientSearch.js';
import { useProcessPanels } from '@/modules/home/composables/useProcessPanels.js';
import { useFlowBuilder } from '@/modules/home/composables/useFlowBuilder.js';
import { useDeliverableCollapse } from '@/modules/home/composables/useDeliverableCollapse.js';
import HomeSidebar from '@/modules/home/components/HomeSidebar.vue';
import DeliverablePreviewModal from '@/modules/home/components/DeliverablePreviewModal.vue';
import { useGeneralTask } from '@/modules/home/composables/useGeneralTask.js';
import GeneralTaskModal from '@/modules/home/components/GeneralTaskModal.vue';
import DeliverableAttachmentsTab from '@/modules/home/components/DeliverableAttachmentsTab.vue';
import DeliverableFillTab from '@/modules/home/components/DeliverableFillTab.vue';
import DeliverableSignatureTab from '@/modules/home/components/DeliverableSignatureTab.vue';
import { useDeliverableView } from '@/modules/home/composables/useDeliverableView.js';
import { useDeliverableFilePreview } from '@/modules/home/composables/useDeliverableFilePreview.js';
import {
  formatAttachmentSize,
  formatDate,
  formatDateTime,
  formatWorkflowDateTime,
  getSignatureStepStatusCode,
  getSignatureStepStatusLabel,
  getSignatureStepStatusVariant,
  getSignatureStepCardClass,
  getSignatureStepAccentClass,
  formatTriggerLabel,
  getFillStepStatusLabel,
  getFillStepStatusTagVariant,
  getFillStepCardClass,
  getFillStepAccentClass,
  getWorkflowStateTagVariant,
  getDeliverableAccessTagVariant,
  getFillRequestStatusCode,
  isCompletedSignatureRequestStatus,
  getFillStepResolverLabel,
  getSignatureStepResolverLabel,
} from '@/modules/home/views/homeView.helpers.js';
import {
  resolveWorkspaceProcessIcon,
  resolveWorkspaceUnitGroupIcon,
  workspaceIconToneClass,
} from '@/shared/utils/workspaceNavIcons.js';

import {
  IconGlobe,
  IconDownload,
  IconFileDescription,
  IconEye,
  IconSignature,
  IconUpload,
  IconAlertTriangle,
  IconArrowLeft,
  IconArrowRight,
  IconBuildingMonument,
  IconBriefcase,
  IconCheck,
  IconChevronDown,
  IconArrowBackUp,
  IconCircleCheck,
  IconFileCheck,
  IconFiles,
  IconInfoCircle,
  IconMessages,
  IconSend,
  IconMinus,
  IconPlayerPlayFilled,
  IconPlus,
  IconRefresh,
  IconChecklist,
  IconSearch,
  IconSquareCheck,
  IconUserCheck,
  IconX
} from '@tabler/icons-vue';

const router = useRouter();
const route = useRoute();
const menuService = new UserMenuService();
const processPanelService = new ProcessDefinitionPanelService();
const signatureFlowService = new SignatureFlowService();
const WORKSPACE_CHAT_CONTEXT_KEY = 'deasy_workspace_chat_context';

const currentUser = ref(null);
const userPhoto = ref('/images/avatar.png');

const { isClient, menuOpen: showMenu, showNotify, toggleMenu, closeMenu, closeNotify, revealSidebarForNav } =
  useWorkspaceChrome();
let isDesktopStatus = isClient ? window.innerWidth >= 1280 : true; // xl en Tailwind es 1280px
const resolveDeliverableGridColumns = () => {
  if (!isClient) return 3;
  if (window.innerWidth >= 1280) return 3;
  if (window.innerWidth >= 768) return 2;
  return 1;
};

const homeDashTab = ref('inicio');
const showCargosPanel = ref(false);
const showUnitsPanel = ref(false);
const showProcessesPanel = ref(false);
const activeConsolidatedUnitTab = ref(null);
const activeConsolidatedCargoTab = ref(null);
const selectedConsolidatedProcessIds = ref([]);
const showProcessMultiSelect = ref(false);
const activeCargoPanelTab = ref(null);
const activeUnitPanelTab = ref(null);
const activeProcessUnitTab = ref('all');
const showNavMenu = ref(false);
const deliverableGridColumns = ref(resolveDeliverableGridColumns());

const handleResize = () => {
  if (!isClient) return;
  deliverableGridColumns.value = resolveDeliverableGridColumns();
  const isNowDesktop = window.innerWidth >= 1280;
  if (isDesktopStatus !== isNowDesktop) {
    isDesktopStatus = isNowDesktop;
    showMenu.value = isNowDesktop;
  }
};

const handlePrimaryNavInteraction = async ({ active } = {}) => {
  if (!isClient) return;
  // En sub-rutas, siempre navegar a home
  if (workspaceRouteMode.value !== 'default') {
    await router.push({ name: 'home' });
    return;
  }
  // Si hay un proceso abierto, cerrarlo (volver al dashboard)
  if (selectedProcessKey.value) {
    clearSelectedProcess();
    return;
  }
  // Si hay un panel abierto, cerrarlo
  if (showCargosPanel.value || showUnitsPanel.value || showProcessesPanel.value) {
    showCargosPanel.value = false;
    showUnitsPanel.value = false;
    showProcessesPanel.value = false;
    return;
  }
  // Agotado el escalado propio, el resto es el comportamiento comun del rail.
  revealSidebarForNav({ active });
};

const menuLoading = ref(false);
const menuError = ref('');
const userUnits = ref([]);
const unitGroups = ref([]);
const consolidatedCargos = ref([]);
const menuCargos = ref([]);
const selectedGroupId = ref(null);
const showGroupDropdown = ref(false);
const groupDropdownRef = ref(null);
const processMultiSelectRef = ref(null);
const selectedProcessKey = ref(null);
const selectedProcessContext = ref(null);
const selectedProcessPanel = ref(null);
// En el panel consolidado pueden cargarse varios procesos a la vez (multi-selección).
const selectedProcessPanels = ref([]);
const processPanelLoading = ref(false);
const processPanelError = ref('');
const processActionMessage = ref(null);
const showTaskLaunchModal = ref(false);
const taskLaunchSubmitting = ref(false);
const taskLaunchError = ref('');
const taskLaunchUseCustomTerm = ref(false);
const taskFiltersModal = ref(null);
const documentSignModal = ref(null);
const signatureFlowModal = ref(null);
const documentCenterModal = ref(null);
const fillWorkflowModal = ref(null);
const deliverableUploadModal = ref(null);
const deliverableWorkspaceModal = ref(null);
// Búsqueda de destinatarios para entregables 'routed'.
// P1/P2 routed: flujo definido al ENVIAR. Pasos = persona concreta o "por cargo".
// entrega = quién elabora; firma = quién firma (en orden).
const deliverableOperationModal = ref(null);
const deliverableSignResultModal = ref(null);
const deliverableResetModal = ref(null);
const embeddedSignerRef = ref(null);
const signatureFlowSignerRef = ref(null);
const pendingDeliverableUploadTarget = ref(null);
const selectedDeliverableUploadFile = ref(null);
const isUploadingDeliverable = ref(false);
const deliverableObservations = ref([]);
const observationsLoading = ref(false);
const observationsCanAdd = ref(false);
const submittingObservation = ref(false);
const resolvingObservationId = ref(null);
// Observaciones contextuales por flujo: entrega (revisión/devolución/rechazo) vs firma.
const fillObservations = computed(() => deliverableObservations.value.filter((o) => o.phase !== 'signature'));
const signatureObservations = computed(() => deliverableObservations.value.filter((o) => o.phase === 'signature'));
const processingFillItemId = ref(null);
const startedDeliverableIds = ref(new Set());
const fillWorkflowSubmitting = ref(false);
const deliverableOperationState = ref({
  title: 'Proceso del entregable',
  type: 'info',
  message: '',
  detail: ''
});
const deliverableSignResultState = ref({
  success: true,
  message: '',
  signedPath: '',
  fileName: 'documento_firmado.pdf',
});
const deliverableResetState = ref({
  target: null,
  submitting: false,
  error: '',
});
const documentCenterLoading = ref(false);
const documentCenterError = ref('');
const documentCenterItems = ref([]);
const homeDossierLoading = ref(false);
const homeDossierError = ref('');
const homeDossier = ref(null);
const homeSignatureLoading = ref(false);
const homeSignatureError = ref('');
const homeSignatureItems = ref([]);
const fillWorkflowState = ref({
  subject: null,
  request: null,
  note: '',
  error: ''
});
const deliverableWorkspaceState = ref({
  tab: 'summary'
});
const attachmentsState = ref({
  loading: false,
  uploading: false,
  error: '',
  items: [],
});
const attachmentUploadKind = ref('annex');
const ATTACHMENT_KIND_LABELS = {
  annex: 'Anexo',
  evidence: 'Evidencia',
  source: 'Fuente',
  other: 'Otro',
};

const resolveAttachmentContext = (payload) => {
  const subject = getDeliverableSubject(payload);
  const userId = currentUserId.value;
  const definitionId = Number(
    subject.processDefinitionId
    || selectedProcessContext.value?.process_definition_id
    || selectedProcessKey.value
  );
  return { userId, definitionId, taskItemId: subject.itemId, documentId: subject.documentId || null };
};

const loadDeliverableAttachments = async (payload) => {
  const { userId, definitionId, taskItemId, documentId } = resolveAttachmentContext(payload);
  if (!userId || !definitionId || !taskItemId) {
    attachmentsState.value = { loading: false, uploading: false, error: '', items: [] };
    return;
  }
  attachmentsState.value = { ...attachmentsState.value, loading: true, error: '' };
  try {
    const data = await processPanelService.listDeliverableAttachments(userId, definitionId, taskItemId, { documentId });
    attachmentsState.value = {
      loading: false,
      uploading: false,
      error: '',
      items: Array.isArray(data?.attachments) ? data.attachments : [],
    };
  } catch (error) {
    attachmentsState.value = {
      loading: false,
      uploading: false,
      error: error?.response?.data?.message || error?.message || 'No se pudieron cargar los anexos.',
      items: [],
    };
  }
};

const handleAttachmentUpload = async (event) => {
  const file = event?.target?.files?.[0];
  if (!file) return;
  const payload = deliverableWorkspaceSubject.value;
  const { userId, definitionId, taskItemId, documentId } = resolveAttachmentContext(payload);
  if (!userId || !definitionId || !taskItemId) {
    setProcessActionInfo('No se pudo resolver el entregable para adjuntar el archivo.', 'error');
    return;
  }
  attachmentsState.value = { ...attachmentsState.value, uploading: true, error: '' };
  try {
    await processPanelService.uploadDeliverableAttachment(userId, definitionId, taskItemId, file, {
      kind: attachmentUploadKind.value,
      documentId,
    });
    if (event?.target) event.target.value = '';
    await loadDeliverableAttachments(payload);
    await refreshActiveProcessPanel();
    setProcessActionInfo('Anexo agregado correctamente.', 'success');
  } catch (error) {
    attachmentsState.value = { ...attachmentsState.value, uploading: false };
    setProcessActionInfo(
      error?.response?.data?.message || error?.message || 'No se pudo subir el anexo.',
      'error'
    );
  }
};

const handleAttachmentDelete = async (attachment) => {
  const payload = deliverableWorkspaceSubject.value;
  const { userId, definitionId, taskItemId } = resolveAttachmentContext(payload);
  if (!userId || !definitionId || !taskItemId || !attachment?.id) return;
  try {
    await processPanelService.deleteDeliverableAttachment(userId, definitionId, taskItemId, attachment.id);
    await loadDeliverableAttachments(payload);
    await refreshActiveProcessPanel();
    setProcessActionInfo('Anexo eliminado.', 'success');
  } catch (error) {
    setProcessActionInfo(
      error?.response?.data?.message || error?.message || 'No se pudo eliminar el anexo.',
      'error'
    );
  }
};

const handleAttachmentDownload = async (attachment) => {
  const payload = deliverableWorkspaceSubject.value;
  const { userId, definitionId, taskItemId } = resolveAttachmentContext(payload);
  if (!userId || !definitionId || !taskItemId || !attachment?.id) return;
  try {
    const { blob, fileName } = await processPanelService.downloadDeliverableAttachment(userId, definitionId, taskItemId, attachment.id);
    downloadBlob(blob, fileName || attachment.file_name || 'anexo.bin');
  } catch (error) {
    setProcessActionInfo(
      error?.response?.data?.message || error?.message || 'No se pudo descargar el anexo.',
      'error'
    );
  }
};

const signatureFlowState = ref({
  loading: false,
  error: '',
  subject: null,
  documentVersionId: null,
  snapshot: null
});
let documentSignModalInstance = null;
let signatureFlowModalInstance = null;
let fillWorkflowModalInstance = null;
let deliverableUploadModalInstance = null;
let deliverableWorkspaceModalInstance = null;
let deliverableOperationModalInstance = null;
let deliverableSignResultModalInstance = null;
let deliverableResetModalInstance = null;
let taskFiltersModalInstance = null;
const taskLaunchForm = ref({
  description: '',
  term_id: '',
  custom_name: '',
  custom_start_date: '',
  custom_end_date: ''
});
const taskLaunchStep = ref(1);
const taskLaunchSteps = [
  { id: 1, label: 'Contexto' },
  { id: 2, label: 'Base documental' },
  { id: 3, label: 'Confirmación' }
];
const taskListFilters = ref({
  query: '',
  year: 'all',
  term: 'all',
  termType: 'all',
  unit: 'all',
  process: 'all',
  status: 'all',
  participation: 'all',
  actionState: 'all'
});
const showAdvancedTaskFilters = ref(false);
const documentCenterFilters = ref({
  query: '',
  year: 'all',
  termType: 'all',
  unit: 'all',
  process: 'all',
  status: 'all'
});
const taskFilterParticipationOptions = [
  { value: 'all', label: 'Todas' },
  { value: 'current', label: 'Actual' },
  { value: 'future', label: 'Futura' },
  { value: 'past', label: 'Pasada' }
];
const taskFilterActionOptions = [
  { value: 'all', label: 'Todas' },
  { value: 'start', label: 'Iniciar' },
  { value: 'sign', label: 'Firmar' },
  { value: 'deliver', label: 'Entregar' }
];

const userFullName = computed(() => {
  if (!currentUser.value) return 'Usuario';
  const firstName = currentUser.value.first_name ?? '';
  const lastName = currentUser.value.last_name ?? '';
  return `${firstName} ${lastName}`.trim() || 'Usuario';
});
const deliverableWorkspaceSubject = computed(() => fillWorkflowState.value.subject || signatureFlowState.value.subject || null);
// Título del modal = nombre del entregable + versión del documento (fallback al título genérico).
const deliverableWorkspaceTitle = computed(() => {
  const subject = deliverableWorkspaceSubject.value;
  if (!subject?.title) return 'Gestión del entregable';
  const version = getDeliverableSubject(subject).documentVersion;
  return version ? `${subject.title} · v${version}` : subject.title;
});

const sidebarContextLabel = computed(() => {
  if (isDocumentCenterRoute.value) {
    return 'Centro documental';
  }
  return selectedGroupLabel.value;
});

const homeContextTitle = computed(() => {
  if (isDocumentCenterRoute.value) return 'Centro documental';
  if (selectedProcessKey.value) {
    if (isRoutedProcess.value) return routedHeaderTitle.value;
    return selectedProcessPanel.value?.definition?.name || 'Proceso activo';
  }
  return userFullName.value;
});

const homeContextSubtitle = computed(() => {
  if (isDocumentCenterRoute.value || selectedProcessKey.value) return '';
  const label = sidebarContextLabel.value;
  return label && label !== userFullName.value ? label : '';
});

const selectedGroupLabel = computed(() => {
  if (!selectedGroupId.value) return 'Todas las unidades';
  const unit = userUnits.value.find((u) => String(u.id) === String(selectedGroupId.value));
  if (unit) return unit.label || unit.name;
  const group = unitGroups.value.find((g) => String(g.id) === String(selectedGroupId.value));
  return group?.label || group?.name || 'Área seleccionada';
});

const deliverableUploadSubject = computed(() => getDeliverableSubject(pendingDeliverableUploadTarget.value));
const deliverableUploadModalTitle = computed(() => {
  const subject = deliverableUploadSubject.value;
  return subject?.title ? `Cargar archivo · ${subject.title}` : 'Cargar archivo del entregable';
});
const deliverableUploadModalHelp = computed(() => {
  const subject = deliverableUploadSubject.value;
  if (!subject) {
    return 'Selecciona el archivo de trabajo que quieres cargar para el entregable.';
  }
  return `Carga el archivo de trabajo para ${subject.title || subject.template_artifact_name || `#${subject.itemId || subject.id}`}.`;
});

const homePlural = (count, singular, plural = `${singular}s`) => `${count} ${count === 1 ? singular : plural}`;
const asHomeArray = (value) => (Array.isArray(value) ? value : []);
const countHomeArray = (value) => asHomeArray(value).length;

const homeCargoSource = computed(() => (
  consolidatedCargos.value.length ? consolidatedCargos.value : menuCargos.value
));

const homeCargos = computed(() => {
  const cargoMap = new Map();
  homeCargoSource.value.forEach((cargo) => {
    const key = String(cargo?.id || cargo?.name || cargoMap.size);
    if (!cargoMap.has(key)) {
      cargoMap.set(key, {
        ...cargo,
        id: cargo?.id ?? key,
        name: cargo?.name || 'Cargo sin nombre',
        processes: []
      });
    }
    const target = cargoMap.get(key);
    asHomeArray(cargo?.processes).forEach((process) => {
      const processKey = String(process?.process_definition_id || process?.id || process?.name || target.processes.length);
      if (!target.processes.some((item) => String(item?.process_definition_id || item?.id || item?.name) === processKey)) {
        target.processes.push(process);
      }
    });
  });
  return Array.from(cargoMap.values()).sort((a, b) => a.name.localeCompare(b.name));
});

const homeCargoCount = computed(() => homeCargos.value.length);

const cargosPanelData = computed(() => {
  const cargoMap = new Map();
  unitGroups.value.forEach((group) => {
    (group.units || []).forEach((unit) => {
      (unit.cargos || []).forEach((cargo) => {
        if (!cargoMap.has(cargo.id)) {
          cargoMap.set(cargo.id, { id: cargo.id, name: cargo.name, positions: [] });
        }
        cargoMap.get(cargo.id).positions.push({
          unitId: unit.id,
          unitName: unit.label || unit.name,
          groupName: group.label || group.name,
          positionType: cargo.position_type ?? null,
          processes: cargo.processes || []
        });
      });
    });
  });
  // Fallback: si no hay unit_groups, usar consolidated
  if (!cargoMap.size) {
    consolidatedCargos.value.forEach((cargo) => {
      cargoMap.set(cargo.id, { id: cargo.id, name: cargo.name, positions: [{ unitName: '—', groupName: '—', positionType: cargo.position_type ?? null, processes: cargo.processes || [] }] });
    });
  }
  return Array.from(cargoMap.values()).sort((a, b) => a.name.localeCompare(b.name));
});

const unitsPanelData = computed(() => {
  const unitMap = new Map();
  unitGroups.value.forEach((group) => {
    (group.units || []).forEach((unit) => {
      if (!unitMap.has(unit.id)) {
        unitMap.set(unit.id, { id: unit.id, name: unit.label || unit.name, groupName: group.label || group.name, cargos: [], processes: [] });
      }
      const target = unitMap.get(unit.id);
      (unit.cargos || []).forEach((cargo) => {
        let targetCargo = target.cargos.find((c) => c.id === cargo.id);
        if (!targetCargo) {
          targetCargo = { id: cargo.id, name: cargo.name, processes: [] };
          target.cargos.push(targetCargo);
        }
        (cargo.processes || []).forEach((process) => {
          const key = String(process.process_definition_id || process.id);
          const enriched = { ...process, cargoId: cargo.id, cargoName: cargo.name };
          if (!target.processes.some((p) => String(p.process_definition_id || p.id) === key)) {
            target.processes.push(enriched);
          }
          if (!targetCargo.processes.some((p) => String(p.process_definition_id || p.id) === key)) {
            targetCargo.processes.push(enriched);
          }
        });
      });
    });
  });
  if (!unitMap.size) {
    userUnits.value.forEach((unit) => {
      const processes = [];
      const cargos = consolidatedCargos.value.map((c) => ({ id: c.id, name: c.name, processes: [] }));
      consolidatedCargos.value.forEach((cargo, cargoIndex) => {
        (cargo.processes || []).forEach((process) => {
          const key = String(process.process_definition_id || process.id);
          const enriched = { ...process, cargoId: cargo.id, cargoName: cargo.name };
          if (!processes.some((p) => String(p.process_definition_id || p.id) === key)) {
            processes.push(enriched);
          }
          cargos[cargoIndex].processes.push(enriched);
        });
      });
      if (processes.length) {
        unitMap.set(unit.id, { id: unit.id, name: unit.label || unit.name, groupName: '', cargos, processes });
      }
    });
  }
  return Array.from(unitMap.values()).sort((a, b) => a.name.localeCompare(b.name));
});

// Nivel 2: todos los cargos de la unidad activa (incluye los que no tienen procesos).
const consolidatedUnitCargos = computed(() =>
  unitsPanelData.value.find((u) => u.id === activeConsolidatedUnitTab.value)?.cargos || []
);

// Procesos de la cargo activa (poblan el selector múltiple de procesos).
const consolidatedCargoProcesses = computed(() => {
  const cargo = consolidatedUnitCargos.value.find((c) => c.id === activeConsolidatedCargoTab.value);
  return cargo?.processes || [];
});

const allConsolidatedProcessesSelected = computed(() =>
  consolidatedCargoProcesses.value.length > 0
  && selectedConsolidatedProcessIds.value.length === consolidatedCargoProcesses.value.length
);

const processMultiSelectLabel = computed(() => {
  const total = consolidatedCargoProcesses.value.length;
  const selected = selectedConsolidatedProcessIds.value.length;
  if (!total) return 'Sin procesos';
  if (selected === 0) return 'Selecciona procesos';
  if (selected === total) return 'Todos los procesos';
  if (selected === 1) {
    const p = consolidatedCargoProcesses.value.find(
      (proc) => String(proc.process_definition_id || proc.id) === selectedConsolidatedProcessIds.value[0]
    );
    return p?.name || '1 proceso';
  }
  return `${selected} procesos`;
});

const homeUnitCount = computed(() => {
  const unitMap = new Map();
  const addUnit = (unit = {}) => {
    const key = String(unit?.id || unit?.label || unit?.name || '');
    if (key) unitMap.set(key, unit);
  };
  userUnits.value.forEach(addUnit);
  unitGroups.value.forEach((group) => asHomeArray(group?.units).forEach(addUnit));
  return unitMap.size;
});

const homeProcesses = computed(() => {
  const processMap = new Map();
  homeCargos.value.forEach((cargo) => {
    asHomeArray(cargo?.processes).forEach((process) => {
      const key = String(process?.process_definition_id || process?.id || process?.name || processMap.size);
      if (!processMap.has(key)) {
        processMap.set(key, {
          ...process,
          cargoName: cargo.name
        });
      }
    });
  });
  return Array.from(processMap.values()).sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
});

const homePrimaryProcess = computed(() => (
  homeProcesses.value.find((process) => process?.access_source === 'process')
  || homeProcesses.value[0]
  || null
));

const homeDossierCounts = computed(() => {
  const dossier = homeDossier.value || {};
  const investigacion = dossier.investigacion || {};
  return {
    titulos: countHomeArray(dossier.titulos),
    experiencia: countHomeArray(dossier.experiencia),
    referencias: countHomeArray(dossier.referencias),
    formacion: countHomeArray(dossier.formacion),
    certificaciones: countHomeArray(dossier.certificaciones),
    investigacion: countHomeArray(investigacion.articulos)
      + countHomeArray(investigacion.libros)
      + countHomeArray(investigacion.ponencias)
      + countHomeArray(investigacion.tesis)
      + countHomeArray(investigacion.proyectos)
  };
});

const homeDossierRows = computed(() => [
  { key: 'titulos', label: 'Titulos', count: homeDossierCounts.value.titulos, icon: IconFileCheck },
  { key: 'experiencia', label: 'Experiencia', count: homeDossierCounts.value.experiencia, icon: IconBriefcase },
  { key: 'formacion', label: 'Formacion', count: homeDossierCounts.value.formacion, icon: IconChecklist },
  { key: 'certificaciones', label: 'Certificaciones', count: homeDossierCounts.value.certificaciones, icon: IconCircleCheck },
  { key: 'investigacion', label: 'Investigacion', count: homeDossierCounts.value.investigacion, icon: IconFiles },
  { key: 'referencias', label: 'Referencias', count: homeDossierCounts.value.referencias, icon: IconUserCheck }
].map((row) => ({
  ...row,
  variant: row.count > 0 ? 'success' : 'muted'
})));

const homeDossierTotal = computed(() =>
  homeDossierRows.value.reduce((total, row) => total + Number(row.count || 0), 0)
);

const homeDossierCompletion = computed(() => {
  const totalSections = homeDossierRows.value.length;
  if (!totalSections) return 0;
  const completedSections = homeDossierRows.value.filter((row) => Number(row.count || 0) > 0).length;
  return Math.round((completedSections / totalSections) * 100);
});

const homeDocumentCount = computed(() => documentCenterItems.value.length);
const homePendingFillCount = computed(() =>
  documentCenterItems.value.reduce((total, item) => total + Number(item?.pending_fill_count || 0), 0)
);
const homeSignatureCount = computed(() => homeSignatureItems.value.length);

const homeLoading = computed(() =>
  menuLoading.value
  || documentCenterLoading.value
  || homeDossierLoading.value
  || homeSignatureLoading.value
);

const homeErrorMessage = computed(() =>
  homeDossierError.value
  || homeSignatureError.value
  || (workspaceRouteMode.value === 'default' ? documentCenterError.value : '')
  || menuError.value
);

const homeStats = computed(() => [
  {
    label: 'Unidades',
    value: homeUnitCount.value,
    detail: homePlural(homeCargoCount.value, 'cargo', 'cargos'),
    icon: IconBuildingMonument,
    tone: 'sky'
  },
  {
    label: 'Procesos',
    value: homeProcesses.value.length,
    detail: homePrimaryProcess.value?.name || 'Sin procesos activos',
    icon: IconChecklist,
    tone: 'emerald'
  },
  {
    label: 'Documentos',
    value: homeDocumentCount.value,
    detail: homePendingFillCount.value ? `${homePendingFillCount.value} pendiente(s) de entrega` : 'Centro documental al dia',
    icon: IconFileDescription,
    tone: 'indigo'
  },
  {
    label: 'Firmas',
    value: homeSignatureCount.value,
    detail: homeSignatureCount.value ? 'Accion requerida' : 'Sin pendientes',
    icon: IconSignature,
    tone: 'amber'
  },
  {
    label: 'Dossier',
    value: `${homeDossierCompletion.value}%`,
    detail: homePlural(homeDossierTotal.value, 'registro', 'registros'),
    icon: IconUserCheck,
    tone: 'slate'
  }
]);

const homeActions = computed(() => {
  const actions = [];
  if (homeSignatureCount.value) {
    actions.push({
      key: 'signatures',
      action: 'signatures',
      title: 'Firmas pendientes',
      description: `${homeSignatureCount.value} documento(s) esperan tu firma.`,
      meta: 'Pendiente',
      tagVariant: 'warning',
      icon: IconSignature,
      tone: 'warning',
      actionLabel: 'Ir a firmas'
    });
  }
  if (homePendingFillCount.value) {
    actions.push({
      key: 'documents-fill',
      action: 'documents',
      title: 'Entregas pendientes',
      description: `${homePendingFillCount.value} entregable(s) requieren completar informacion.`,
      meta: 'Completar',
      tagVariant: 'info',
      icon: IconFileDescription,
      tone: 'info',
      actionLabel: 'Abrir documentos'
    });
  }
  if (homePrimaryProcess.value) {
    actions.push({
      key: `process-${homePrimaryProcess.value.process_definition_id || homePrimaryProcess.value.id}`,
      action: 'process',
      payload: homePrimaryProcess.value,
      title: 'Continuar proceso',
      description: homePrimaryProcess.value.name || 'Proceso disponible para tu cargo.',
      meta: homePrimaryProcess.value.cargoName || 'Proceso',
      tagVariant: 'success',
      icon: IconChecklist,
      tone: 'success',
      actionLabel: 'Abrir proceso'
    });
  }
  if (homeDocumentCount.value) {
    actions.push({
      key: 'documents',
      action: 'documents',
      title: 'Centro documental',
      description: `${homeDocumentCount.value} documento(s) disponibles en tu cuenta.`,
      meta: 'Disponible',
      tagVariant: 'neutral',
      icon: IconFiles,
      tone: 'neutral',
      actionLabel: 'Ver documentos'
    });
  }
  if (homeDossierCompletion.value < 100) {
    actions.push({
      key: 'profile',
      action: 'profile',
      title: 'Completar dossier',
      description: `Tu perfil profesional registra ${homeDossierCompletion.value}% de secciones con datos.`,
      meta: `${homeDossierTotal.value} registro(s)`,
      tagVariant: 'warning',
      icon: IconUserCheck,
      tone: 'warning',
      actionLabel: 'Ir al perfil'
    });
  }
  if (!actions.length) {
    actions.push({
      key: 'profile-default',
      action: 'profile',
      title: 'Cuenta al dia',
      description: 'No hay pendientes operativos detectados para esta cuenta.',
      meta: 'Listo',
      tagVariant: 'success',
      icon: IconCircleCheck,
      tone: 'success',
      actionLabel: 'Ver perfil'
    });
  }
  return actions.slice(0, 4);
});

const resolvePhotoUrl = (value) => {
  if (!value) {
    return '/images/avatar.png';
  }
  if (value.startsWith('data:') || value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }
  const sanitized = value.replace(/^\/+/, '');
  return `${API_ROUTES.BASE.replace(/\/$/, '')}/${sanitized}`;
};

const applyMenuCargos = (cargos) => {
  menuCargos.value = (cargos ?? []).map((cargo, index) => ({
    ...cargo,
    open: index === 0
  }));
};

const selectConsolidated = () => {
  selectedGroupId.value = null;
  showGroupDropdown.value = false;
  applyMenuCargos(consolidatedCargos.value);
};

const selectUnitOption = (unit) => {
  showGroupDropdown.value = false;
  if (!unit) {
    selectedGroupId.value = null;
    applyMenuCargos(consolidatedCargos.value);
  } else {
    selectedGroupId.value = unit.id;
    const cargos = (unit.cargos || []).map((c) => ({
      ...c,
      processes: (c.processes || []).slice().sort((a, b) => a.name.localeCompare(b.name))
    }));
    cargos.sort((a, b) => a.name.localeCompare(b.name));
    applyMenuCargos(cargos);
  }
  // Si hay un proceso abierto, recargarlo con el nuevo contexto de unidad
  if (selectedProcessContext.value) {
    loadSelectedProcessPanel(selectedProcessContext.value);
  }
};

const handleGroupDropdownOutsideClick = (event) => {
  if (showGroupDropdown.value && groupDropdownRef.value && !groupDropdownRef.value.contains(event.target)) {
    showGroupDropdown.value = false;
  }
  if (showProcessMultiSelect.value && processMultiSelectRef.value && !processMultiSelectRef.value.contains(event.target)) {
    showProcessMultiSelect.value = false;
  }
};

const processIconMeta = (process = {}) => resolveWorkspaceProcessIcon(process);

const resetTaskLaunchForm = () => {
  taskLaunchForm.value = {
    description: '',
    term_id: '',
    custom_name: '',
    custom_start_date: '',
    custom_end_date: ''
  };
  taskLaunchStep.value = 1;
  taskLaunchUseCustomTerm.value = false;
  taskLaunchSubmitting.value = false;
  taskLaunchError.value = '';
};

const resetTaskListFilters = () => {
  taskListFilters.value = {
    query: '',
    year: 'all',
    term: 'all',
    termType: 'all',
    unit: 'all',
    process: 'all',
    status: 'all',
    participation: 'all',
    actionState: 'all'
  };
  showAdvancedTaskFilters.value = false;
};

const resetDocumentCenterFilters = () => {
  documentCenterFilters.value = {
    query: '',
    year: 'all',
    termType: 'all',
    unit: 'all',
    process: 'all',
    status: 'all'
  };
};

const openTaskFiltersModal = () => {
  taskFiltersModalInstance = Modal.getOrCreateInstance(taskFiltersModal.value?.el);
  taskFiltersModalInstance?.show();
};

const closeTaskFiltersModal = () => {
  taskFiltersModalInstance?.hide();
};

const clearSelectedProcess = () => {
  selectedProcessKey.value = null;
  selectedProcessContext.value = null;
  selectedProcessPanel.value = null;
  selectedProcessPanels.value = [];
  processPanelError.value = '';
  processActionMessage.value = null;
  showTaskLaunchModal.value = false;
  activeProcessUnitTab.value = 'all';
  resetTaskListFilters();
  resetTaskLaunchForm();
};

const navigateToHome = async () => {
  if (route.name !== 'home') {
    await router.push({ name: 'home' });
  }
};

const scrollToProcessNav = async () => {
  await navigateToHome();
  showProcessesPanel.value = true;
  showCargosPanel.value = false;
  showUnitsPanel.value = false;
  const firstUnit = unitsPanelData.value[0];
  if (firstUnit) await selectConsolidatedUnit(firstUnit);
};

const openCargosPanel = () => {
  showCargosPanel.value = true;
  showUnitsPanel.value = false;
  showProcessesPanel.value = false;
  activeCargoPanelTab.value = cargosPanelData.value[0]?.id ?? null;
};

const openUnitsPanel = () => {
  showUnitsPanel.value = true;
  showCargosPanel.value = false;
  showProcessesPanel.value = false;
  activeUnitPanelTab.value = unitsPanelData.value[0]?.id ?? null;
};

// Enruta los accesos directos del aside a los mismos destinos que las tarjetas del dashboard.
// El aside ya no navega procesos (lo hace la pagina consolidada); solo lleva a la seccion.
const openWorkspaceSection = (key) => {
  const destinos = {
    processes: scrollToProcessNav,
    signatures: navigateToGlobalSignaturePage,
    sends: openMySends,
    documents: navigateToDocumentCenterPage,
    dossier: () => navigateTo('perfil'),
    cargos: openCargosPanel,
    units: openUnitsPanel,
  };
  destinos[key]?.();
  if (window.innerWidth < 1280) showMenu.value = false;
};

const selectConsolidatedUnit = async (unit) => {
  activeConsolidatedUnitTab.value = unit.id;
  activeConsolidatedCargoTab.value = null;
  selectedConsolidatedProcessIds.value = [];
  clearSelectedProcess();
  const cargos = unit.cargos || [];
  // Prioriza un cargo con procesos; si ninguno tiene, abre el primero (mostrará vacío).
  const firstCargo = cargos.find((cargo) => (cargo.processes || []).length > 0) || cargos[0];
  if (firstCargo) await selectConsolidatedCargo(firstCargo);
};

const selectConsolidatedCargo = async (cargo) => {
  activeConsolidatedCargoTab.value = cargo.id;
  clearSelectedProcess();
  // Por defecto, selecciona todos los procesos del cargo.
  const ids = (cargo.processes || []).map((p) => String(p.process_definition_id || p.id));
  selectedConsolidatedProcessIds.value = ids;
  await loadSelectedProcessPanels();
};

const toggleConsolidatedProcess = async (processId) => {
  const id = String(processId);
  const current = new Set(selectedConsolidatedProcessIds.value);
  if (current.has(id)) current.delete(id);
  else current.add(id);
  // Mantiene el orden original de los procesos del cargo.
  selectedConsolidatedProcessIds.value = consolidatedCargoProcesses.value
    .map((p) => String(p.process_definition_id || p.id))
    .filter((pid) => current.has(pid));
  await loadSelectedProcessPanels();
};

const toggleAllConsolidatedProcesses = async () => {
  const allIds = consolidatedCargoProcesses.value.map((p) => String(p.process_definition_id || p.id));
  selectedConsolidatedProcessIds.value =
    selectedConsolidatedProcessIds.value.length === allIds.length ? [] : allIds;
  await loadSelectedProcessPanels();
};

const navigateToDocumentCenterPage = async () => {
  await router.push({ name: 'home-documents' });
};

const navigateToGlobalSignaturePage = async () => {
  await router.push({ name: 'home-signatures' });
};

const currentUserId = computed(() => currentUser.value?.id ?? currentUser.value?._id ?? null);

const {
  canApproveFillRequestForPayload,
  canPreviewInline,
  canRejectFillRequestForPayload,
  canReturnFillRequestForPayload,
  canStartDeliverableAction,
  capitalize,
  currentUserCanOperateFillStep,
  currentUserCanOperateSignatureStep,
  getCurrentFillStepCandidates,
  getCurrentFillWorkflowRequest,
  getCurrentSignatureRequestsFromSubject,
  getCurrentSignatureStepOrder,
  getCurrentSignatureStepOrderFromSubject,
  getCurrentSignatureWorkflowRequest,
  getDeliverableAccessSource,
  getDeliverableActionFilterState,
  getDeliverableCardTone,
  getDeliverableCurrentResponsibility,
  getDeliverableDateRangeLabel,
  getDeliverableDocumentTagVariant,
  getDeliverableDueState,
  getDeliverableHeaderActionTone,
  getDeliverableParticipationFlags,
  getDeliverablePeriodLabel,
  getDeliverablePeriodLabelFromSubject,
  getDeliverableProcessLabel,
  getDeliverableProgress,
  getDeliverableStateIcon,
  getDeliverableSubject,
  getDeliverableTagGroups,
  getDeliverableUnitLabel,
  getDeliverableWorkspacePayload,
  getDeliverableWorkspaceTabClass,
  getFileExtension,
  getFileNameFromPath,
  getFillApproveActionLabelForPayload,
  getFillRequestId,
  getFillResponsibleName,
  getSignatureRequestAssignedSummary,
  getSignatureResponsibleName,
  getSignatureStepAssignedSummary,
  getSignatureStepsFromSubject,
  getUploadActionLabel,
  hasDeliverableBeenStarted,
  hasFillWorkflowActivity,
  hasPendingFillWorkflow,
  hasSignatureWorkflowActivity,
  isDeliverableSignatureFlowCompleted,
  isFillRequestActionableByCurrentUser,
  isPdfWorkingFile,
  isReviewFillRequestForPayload,
  isSignaturePhaseDocumentStatus,
  resolveUnitNameById,
  shouldShowManageFill,
  shouldShowResetWorkflow,
  shouldShowSign,
  shouldShowSignatureFlow,
  shouldShowStartDeliverable,
  shouldShowUploadDeliverable,
  subjectHasWorkingArtifact,
} = useDeliverableView({
  currentUser,
  currentUserId,
  deliverableWorkspaceState,
  selectedProcessContext,
  selectedProcessPanel,
  startedDeliverableIds,
  unitGroups,
  userFullName,
  userUnits,
});

const {
  loadProcessPanelsForProcesses,
  loadSelectedProcessPanel,
  loadSelectedProcessPanels,
  refreshActiveProcessPanel,
} = useProcessPanels({
  activeConsolidatedUnitTab,
  activeProcessUnitTab,
  consolidatedCargoProcesses,
  currentUserId,
  processActionMessage,
  processPanelError,
  processPanelLoading,
  processPanelService,
  resetTaskListFilters,
  selectedConsolidatedProcessIds,
  selectedGroupId,
  selectedProcessContext,
  selectedProcessKey,
  selectedProcessPanel,
  selectedProcessPanels,
  showCargosPanel,
  showProcessesPanel,
});

const {
  recipientQuery,
  recipientResults,
  recipientSearching,
  searchRecipients,
  clearRecipientSearch,
} = useRecipientSearch({ currentUserId, processPanelService });

const {
  flowEntrega,
  flowFirma,
  flowPickerTarget,
  flowPickerMode,
  flowCatalog,
  flowCargoForm,
  openFlowPicker,
  addFlowPerson,
  addFlowCargo,
  removeFromEntrega,
  removeFirmaStep,
  removeSignerFromStep,
  primaryRecipientFromFlow,
  loadFlowCatalog,
  resetFlowBuilder,
} = useFlowBuilder({ clearRecipientSearch, currentUserId, processPanelService });
// El centro de firmas ya no vive aqui: tiene ruta y vista propias (modules/firmas/views/
// SignatureCenterView.vue). Quedan dos modos, no tres.
const workspaceRouteMode = computed(() => (route.name === 'home-documents' ? 'documents' : 'default'));
const isDocumentCenterRoute = computed(() => workspaceRouteMode.value === 'documents');

const documentCenterFields = [
  { name: 'document', label: 'Documento' },
  { name: 'process', label: 'Proceso' },
  { name: 'unit', label: 'Unidad' },
  { name: 'period', label: 'Periodo' },
  { name: 'status', label: 'Estado' }
];

// Toda plantilla vinculada materializa un entregable, así que todas se instancian al lanzar.
const taskLaunchSystemTemplates = computed(() =>
  selectedProcessPanel.value?.dependencies?.templates || []
);

const taskLaunchSelectedTermLabel = computed(() => {
  if (taskLaunchUseCustomTerm.value) {
    return taskLaunchForm.value.custom_name || 'Periodo custom';
  }
  const currentTermId = Number(taskLaunchForm.value.term_id || 0);
  if (!currentTermId) {
    return 'Sin periodo seleccionado';
  }
  const term = (selectedProcessPanel.value?.available_terms || []).find((item) => Number(item.id) === currentTermId);
  if (!term) {
    return 'Periodo seleccionado';
  }
  return `${term.name} · ${term.term_type_name}`;
});

const taskFilterYears = computed(() => {
  const years = new Set();
  aggregatedProcessTasks.value.forEach((task) => {
    const source = String(task.term_name || task.start_date || task.end_date || '');
    const match = source.match(/(20\d{2})/);
    if (match?.[1]) {
      years.add(match[1]);
    }
  });
  return Array.from(years).sort((a, b) => Number(b) - Number(a));
});

const taskFilterTerms = computed(() => {
  const map = new Map();
  aggregatedProcessTasks.value.forEach((task) => {
    const value = String(task.term_id || task.term_name || task.id);
    const label = task.term_name || `Tarea ${task.id}`;
    if (!map.has(value)) {
      map.set(value, { value, label });
    }
  });
  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
});

const taskFilterTermTypes = computed(() => {
  const types = new Set(
    aggregatedProcessTasks.value
      .map((task) => String(task.term_type_name || '').trim())
      .filter(Boolean)
  );
  return Array.from(types).sort((a, b) => a.localeCompare(b));
});

const taskFilterUnits = computed(() => {
  const values = new Set();
  aggregatedProcessTasks.value.forEach((task) => {
    const taskUnitName = resolveUnitNameById(selectedProcessContext.value?.unit_id);
    if (taskUnitName) values.add(taskUnitName);
    (task.items || []).forEach((item) => {
      const itemUnitName = item.unit_label
        || resolveUnitNameById(item.origin_unit_id || item.originUnitId || item.scope_unit_id || selectedProcessContext.value?.unit_id);
      if (itemUnitName) values.add(itemUnitName);
    });
  });
  return Array.from(values).sort((a, b) => a.localeCompare(b));
});

const taskFilterProcesses = computed(() => {
  const names = new Set();
  aggregatedProcessTasks.value.forEach((task) => {
    const name = String(task.__processName || '').trim();
    if (name) names.add(name);
  });
  if (!names.size) {
    const fallback = String(
      selectedProcessPanel.value?.definition?.process_name
      || selectedProcessContext.value?.name
      || ''
    ).trim();
    if (fallback) names.add(fallback);
  }
  return Array.from(names).sort((a, b) => a.localeCompare(b));
});

const taskFilterStatuses = computed(() => {
  const statuses = new Set(
    aggregatedProcessTasks.value
      .map((task) => String(task.status || '').trim())
      .filter(Boolean)
  );
  return Array.from(statuses).sort((a, b) => a.localeCompare(b));
});

const getCenterFilterOptions = (items, key, transform = (value) => value) => {
  const values = new Set();
  (items || []).forEach((item) => {
    const rawValue = transform(item?.[key], item);
    const normalized = String(rawValue || '').trim();
    if (normalized) values.add(normalized);
  });
  return Array.from(values).sort((a, b) => a.localeCompare(b));
};

const documentCenterFilterYears = computed(() =>
  getCenterFilterOptions(documentCenterItems.value, 'term_year').sort((a, b) => Number(b) - Number(a))
);
const documentCenterFilterTermTypes = computed(() =>
  getCenterFilterOptions(documentCenterItems.value, 'term_type_name')
);
const documentCenterFilterUnits = computed(() =>
  getCenterFilterOptions(documentCenterItems.value, 'unit_label')
);
const documentCenterFilterProcesses = computed(() =>
  getCenterFilterOptions(documentCenterItems.value, 'process_name')
);
const aggregatedProcessTasks = computed(() => {
  const panels = selectedProcessPanels.value;
  if (panels.length) {
    return panels.flatMap(({ definitionId, process, panel }) => {
      const processName = panel?.definition?.name || panel?.definition?.process_name || process?.name || '';
      return (panel?.tasks || []).map((task) => ({
        ...task,
        __processDefinitionId: definitionId,
        __processName: processName,
        items: (task.items || []).map((item) => ({
          ...item,
          process_definition_id: item.process_definition_id || definitionId,
        })),
      }));
    });
  }
  // Fallback: panel único (modo standalone) sin anotaciones extra.
  return selectedProcessPanel.value?.tasks || [];
});

const filteredProcessTasks = computed(() => {
  const query = String(taskListFilters.value.query || '').trim().toLowerCase();
  return aggregatedProcessTasks.value.filter((task) => {
    const taskYearSource = String(task.term_name || task.start_date || task.end_date || '');
    const yearMatch = taskYearSource.match(/(20\d{2})/);
    const taskYear = yearMatch?.[1] || '';
    const matchesYear = taskListFilters.value.year === 'all' || taskYear === taskListFilters.value.year;
    const matchesTerm = taskListFilters.value.term === 'all' || String(task.term_id || task.term_name || task.id) === taskListFilters.value.term;
    const matchesTermType = taskListFilters.value.termType === 'all' || String(task.term_type_name || '').trim() === taskListFilters.value.termType;
    const unitLabels = [
      resolveUnitNameById(selectedProcessContext.value?.unit_id),
      ...(task.items || []).map((item) => (
        item.unit_label
        || resolveUnitNameById(item.origin_unit_id || item.originUnitId || item.scope_unit_id || selectedProcessContext.value?.unit_id)
      ))
    ]
      .filter(Boolean)
      .map((value) => String(value).trim());
    const matchesUnit = taskListFilters.value.unit === 'all' || unitLabels.includes(taskListFilters.value.unit);
    const processLabel = String(task.__processName || selectedProcessPanel.value?.definition?.process_name || selectedProcessContext.value?.name || '').trim();
    const matchesProcess = taskListFilters.value.process === 'all' || processLabel === taskListFilters.value.process;
    const matchesStatus = taskListFilters.value.status === 'all' || String(task.status || '').trim() === taskListFilters.value.status;
    const haystack = [
      task.term_name,
      task.term_type_name,
      task.description,
      ...(task.items || []).map((item) => item.template_artifact_name),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    const matchesQuery = !query || haystack.includes(query);
    return matchesYear && matchesTerm && matchesTermType && matchesUnit && matchesProcess && matchesStatus && matchesQuery;
  });
});

const filteredProcessDeliverables = computed(() =>
  filteredProcessTasks.value.flatMap((task) =>
    (task.items || []).map((item) => ({
      key: `${task.id}-${item.id}`,
      task,
      item,
      processDefinitionId: task.__processDefinitionId || null,
      processName: task.__processName || '',
    }))
  )
    .filter((deliverable) => !isDeliverableSignatureFlowCompleted(deliverable.item))
    .filter((deliverable) => {
      const participation = taskListFilters.value.participation;
      if (participation === 'all') return true;
      return getDeliverableParticipationFlags(deliverable.item)[participation] === true;
    })
    .filter((deliverable) => {
      const actionState = taskListFilters.value.actionState;
      if (actionState === 'all') return true;
      return getDeliverableActionFilterState(deliverable.item) === actionState;
    })
    .filter((deliverable) => {
      if (activeProcessUnitTab.value === 'all') return true;
      const unitId = deliverable.item.origin_unit_id || deliverable.item.originUnitId || deliverable.item.scope_unit_id;
      return String(unitId) === activeProcessUnitTab.value;
    })
);

const {
  isDeliverableCollapsed,
  toggleDeliverableCard,
  isProcessCollapsed,
  toggleDeliverableProcess,
} = useDeliverableCollapse({ filteredProcessDeliverables });

const buildDeliverableRows = (items, keyPrefix = 'row') => {
  const columns = Math.max(1, Number(deliverableGridColumns.value || 1));
  const rows = [];
  for (let index = 0; index < items.length; index += columns) {
    rows.push({
      id: `${keyPrefix}-${columns}-${Math.floor(index / columns)}`,
      index: Math.floor(index / columns),
      items: items.slice(index, index + columns)
    });
  }
  return rows;
};

const deliverableRows = computed(() => buildDeliverableRows(filteredProcessDeliverables.value, 'deliverable-row'));

// Deliverables agrupados por proceso, cada grupo con sus propias filas (multi-selección).
const deliverableGroups = computed(() => {
  const groups = new Map();
  filteredProcessDeliverables.value.forEach((deliverable) => {
    const id = String(deliverable.processDefinitionId || 'sin-proceso');
    if (!groups.has(id)) {
      groups.set(id, { id, name: deliverable.processName || 'Proceso', items: [] });
    }
    groups.get(id).items.push(deliverable);
  });
  return Array.from(groups.values()).map((group) => ({
    ...group,
    rows: buildDeliverableRows(group.items, `group-${group.id}`),
  }));
});

// Mostrar encabezados de grupo sólo cuando hay más de un proceso seleccionado.
const showDeliverableGroupHeaders = computed(() => deliverableGroups.value.length > 1);

const processUnitTabs = computed(() => {
  const seen = new Set();
  const tabs = [{ key: 'all', label: 'Consolidado' }];
  for (const task of selectedProcessPanel.value?.tasks || []) {
    for (const item of task.items || []) {
      const unitId = item.origin_unit_id || item.originUnitId || item.scope_unit_id || null;
      const unitLabel = item.unit_label || item.unitLabel || resolveUnitNameById(unitId) || null;
      if (unitId && !seen.has(unitId)) {
        seen.add(unitId);
        tabs.push({ key: String(unitId), label: unitLabel || String(unitId) });
      }
    }
  }
  return tabs;
});

const filteredDocumentCenterItems = computed(() => {
  const filters = documentCenterFilters.value;
  const query = String(filters.query || '').trim().toLowerCase();
  return documentCenterItems.value.filter((item) => {
    const matchesQuery = !query || [
      item.template_artifact_name,
      item.definition_name,
      item.process_name,
      item.unit_label,
      item.term_name,
      item.term_type_name
    ].filter(Boolean).join(' ').toLowerCase().includes(query);
    const matchesYear = filters.year === 'all' || String(item.term_year || '') === String(filters.year);
    const matchesTermType = filters.termType === 'all' || String(item.term_type_name || '') === filters.termType;
    const matchesUnit = filters.unit === 'all' || String(item.unit_label || '') === filters.unit;
    const matchesProcess = filters.process === 'all' || String(item.process_name || '') === filters.process;
    const matchesStatus = filters.status === 'all' || String(item.document_version_status || '') === filters.status;
    return matchesQuery && matchesYear && matchesTermType && matchesUnit && matchesProcess && matchesStatus;
  });
});

const canAdvanceTaskLaunchStep = computed(() => {
  if (taskLaunchSubmitting.value) {
    return false;
  }
  if (taskLaunchStep.value === 1) {
    if (taskLaunchUseCustomTerm.value) {
      return Boolean(
        taskLaunchForm.value.custom_name
        && taskLaunchForm.value.custom_start_date
        && taskLaunchForm.value.custom_end_date
      );
    }
    return Boolean(taskLaunchForm.value.term_id);
  }
  return true;
});

const canSubmitTaskLaunch = computed(() => {
  if (
    !selectedProcessPanel.value?.permissions?.can_launch_manual
    || taskLaunchSubmitting.value
    || taskLaunchStep.value !== taskLaunchSteps.length
  ) {
    return false;
  }
  if (taskLaunchUseCustomTerm.value) {
    return Boolean(
      taskLaunchForm.value.custom_name
      && taskLaunchForm.value.custom_start_date
      && taskLaunchForm.value.custom_end_date
    );
  }
  return Boolean(taskLaunchForm.value.term_id);
});

const signatureRequestStatusLabel = (statusCode) => {
  const normalized = String(statusCode || '').trim().toLowerCase();
  switch (normalized) {
    case 'completado':
      return 'Firmado';
    case 'rechazado':
      return 'Rechazado';
    case 'cancelado':
      return 'Cancelado';
    case 'en_progreso':
      return 'En progreso';
    case 'pendiente':
      return 'Pendiente';
    default:
      return capitalize(normalized) || 'Pendiente';
  }
};

const signatureRequestTagVariant = (statusCode) => {
  const normalized = String(statusCode || '').trim().toLowerCase();
  if (['completado'].includes(normalized)) {
    return 'success';
  }
  if (['rechazado', 'cancelado'].includes(normalized)) {
    return 'danger';
  }
  if (['en_progreso', 'pendiente'].includes(normalized)) {
    return 'warning';
  }
  return 'muted';
};

const loadDocumentCenterPage = async () => {
  const userId = currentUserId.value;
  if (!userId) return;
  documentCenterLoading.value = true;
  documentCenterError.value = '';
  try {
    const response = await processPanelService.getDocumentCenter(userId);
    documentCenterItems.value = Array.isArray(response?.documents) ? response.documents : [];
  } catch (error) {
    console.error('Error al cargar el centro documental:', error);
    documentCenterItems.value = [];
    documentCenterError.value = error?.response?.data?.message || 'No se pudo cargar el centro documental.';
  } finally {
    documentCenterLoading.value = false;
  }
};

const loadHomeDossier = async () => {
  homeDossierLoading.value = true;
  homeDossierError.value = '';
  try {
    const response = await DossierService.getDossier();
    homeDossier.value = response?.data || null;
  } catch (error) {
    console.error('Error al cargar el dossier de Home:', error);
    homeDossier.value = null;
    homeDossierError.value = error?.response?.data?.message || error?.message || 'No se pudo cargar el dossier.';
  } finally {
    homeDossierLoading.value = false;
  }
};

const loadHomeSignatureCenter = async () => {
  const userId = currentUserId.value;
  if (!userId) return;
  homeSignatureLoading.value = true;
  homeSignatureError.value = '';
  try {
    const response = await processPanelService.getSignatureCenter(userId);
    homeSignatureItems.value = Array.isArray(response?.signatures) ? response.signatures : [];
  } catch (error) {
    console.error('Error al cargar firmas pendientes de Home:', error);
    homeSignatureItems.value = [];
    homeSignatureError.value = error?.response?.data?.message || error?.message || 'No se pudo cargar la bandeja de firmas.';
  } finally {
    homeSignatureLoading.value = false;
  }
};

const loadHomeData = async () => {
  await Promise.all([
    loadDocumentCenterPage(),
    loadHomeSignatureCenter(),
    loadHomeDossier()
  ]);
};

const runHomeAction = async (target) => {
  const action = typeof target === 'string' ? target : target?.action;
  if (action === 'signatures') {
    await navigateToGlobalSignaturePage();
    return;
  }
  if (action === 'documents') {
    await navigateToDocumentCenterPage();
    return;
  }
  if (action === 'process') {
    const process = target?.payload || homePrimaryProcess.value;
    if (process) {
      await handleProcessSelect(process);
    }
    return;
  }
  if (action === 'profile') {
    navigateTo('perfil');
  }
};

const handleHomeDossierUpdated = () => {
  if (workspaceRouteMode.value === 'default') {
    loadHomeDossier();
  }
};

const buildWorkspacePayloadFromCenterItem = (item = {}) => ({
  id: item.task_item_id,
  itemId: item.task_item_id,
  task_id: item.task_id,
  process_definition_id: item.process_definition_id,
  process_id: item.process_id,
  process_label: item.process_name,
  unit_label: item.unit_label,
  period_label: item.term_name,
  document_id: item.document_id,
  document_version_id: item.document_version_id,
  document_version: item.document_version,
  document_status: item.document_status || item.document_version_status,
  working_file_path: item.working_file_path,
  final_file_path: item.final_file_path,
  template_artifact_name: item.template_artifact_name || item.definition_name,
  title: item.template_artifact_name || item.definition_name || `Documento #${item.document_id}`,
  pending_signature_count: item.pending_signature_count || 0,
  pending_fill_count: item.pending_fill_count || 0,
  preloadFilePath: item.preloadFilePath || item.preload_file_path || item.final_file_path || item.working_file_path || '',
  preloadPdfPath: item.preloadPdfPath || item.preload_pdf_path || '',
  task_end_date: item.task_end_date || null,
  item_end_date: item.item_end_date || null,
});

const handleProcessSelect = async (process) => {
  if (workspaceRouteMode.value !== 'default') {
    await router.push({ name: 'home' });
  }
  // Desde el aside o paneles secundarios: modo standalone (cierra vista consolidada)
  showProcessesPanel.value = false;
  selectedProcessKey.value = process?.process_definition_id ? String(process.process_definition_id) : null;
  selectedProcessContext.value = process || null;
  if (window.innerWidth < 1024) {
    showMenu.value = false;
  }
  await loadSelectedProcessPanel(process);
};

const closeTaskLaunchModal = () => {
  showTaskLaunchModal.value = false;
  resetTaskLaunchForm();
};

// Abre el modal de alta para una plantilla configurada (replicated/routed) desde el panel de tarea.
const openAddDeliverableModal = (task, template) => {
  if (!task?.id || !template?.id) return;
  openGeneralTaskModal('derived', {
    sourceTaskId: task.id,
    unitId: task.scope_unit_id || task.origin_unit_id || selectedProcessContext.value?.unit_id || null,
    itemMode: String(template.item_mode || ''),
    processDefinitionTemplateId: template.id,
    templateName: template.name || '',
  });
};

// Búsqueda de destinatarios (debounce simple) para modo routed.

// Plantillas replicated/routed por tarea (entregables que el usuario puede crear on-demand).
const addableDeliverablesByTask = ref({});
const loadAddableDeliverables = async () => {
  const userId = currentUserId.value;
  if (!userId) {
    addableDeliverablesByTask.value = {};
    return;
  }
  const tasks = aggregatedProcessTasks.value || [];
  const next = {};
  for (const task of tasks) {
    if (!task?.id) continue;
    try {
      const data = await processPanelService.listAddableDeliverables(userId, { taskId: task.id });
      const list = Array.isArray(data?.deliverables) ? data.deliverables : [];
      if (list.length) next[task.id] = list;
    } catch {
      // silencioso: una tarea que falla no rompe el resto
    }
  }
  addableDeliverablesByTask.value = next;
};
const addableDeliverableEntries = computed(() => {
  const map = addableDeliverablesByTask.value || {};
  const entries = [];
  for (const task of (filteredProcessTasks.value || [])) {
    for (const template of (map[task.id] || [])) {
      entries.push({ task, template });
    }
  }
  return entries;
});
watch(
  () => (aggregatedProcessTasks.value || []).map((task) => task.id).join(','),
  () => { loadAddableDeliverables(); }
);

// R2/R3: detección de "proceso de envíos" (routed) POR DEFINICIÓN (aunque no tenga tarea/lanzamiento).
// El proceso abierto puede venir del aside (selectedProcessKey) o de la vista consolidada.
const openDefinitionIds = computed(() => {
  const ids = new Set();
  if (selectedProcessKey.value) {
    const n = Number(selectedProcessKey.value);
    if (n) ids.add(n);
  }
  (selectedConsolidatedProcessIds.value || []).forEach((v) => {
    const n = Number(v);
    if (n) ids.add(n);
  });
  return Array.from(ids);
});
const routedTemplatesByDefinition = ref({});
const loadRoutedTemplates = async () => {
  const userId = currentUserId.value;
  const ids = openDefinitionIds.value;
  if (!userId || !ids.length) {
    routedTemplatesByDefinition.value = {};
    return;
  }
  const next = { ...routedTemplatesByDefinition.value };
  for (const defId of ids) {
    if (next[defId]) continue;
    try {
      const data = await processPanelService.listAddableDeliverables(userId, { definitionId: defId });
      const list = Array.isArray(data?.deliverables) ? data.deliverables : [];
      next[defId] = list.filter((t) => String(t.item_mode) === 'routed');
    } catch {
      next[defId] = [];
    }
  }
  routedTemplatesByDefinition.value = next;
};
watch(
  () => openDefinitionIds.value.join(','),
  () => { loadRoutedTemplates(); },
  { immediate: true }
);
// El proceso abierto es "de envíos" cuando TODAS sus definiciones tienen plantilla routed.
const isRoutedProcess = computed(() => {
  const ids = openDefinitionIds.value;
  if (!ids.length) return false;
  return ids.every((id) => (routedTemplatesByDefinition.value[id] || []).length > 0);
});
const routedTemplatesForSelected = computed(() => {
  const ids = openDefinitionIds.value;
  const out = [];
  for (const id of ids) {
    for (const t of (routedTemplatesByDefinition.value[id] || [])) {
      out.push({ definitionId: id, template: t });
    }
  }
  return out;
});
// Abre el alta de un envío: usa una tarea ancla si existe (routed definido) o el flujo libre (default).
const openNewSend = () => {
  const anchorTask = (filteredProcessTasks.value || []).find((t) => t?.id);
  const entry = routedTemplatesForSelected.value[0] || null;
  if (anchorTask && entry?.template) {
    openAddDeliverableModal(anchorTask, entry.template);
    return;
  }
  openGeneralTaskModal('free');
};

// ── Rediseño routed: bandeja del proceso (envíos + recibidos) para RoutedProcessPanel ──
const routedSends = ref([]);
const routedReceived = ref([]);
const routedInboxLoading = ref(false);
const loadRoutedInbox = async () => {
  const userId = currentUserId.value;
  if (!userId || !isRoutedProcess.value) {
    routedSends.value = [];
    routedReceived.value = [];
    return;
  }
  routedInboxLoading.value = true;
  const pid = String(selectedProcessContext.value?.id || '');
  try {
    const [sendsData, recvData] = await Promise.all([
      processPanelService.listMySends(userId),
      processPanelService.listMyReceived(userId),
    ]);
    const allSends = Array.isArray(sendsData?.sends) ? sendsData.sends : [];
    const allRecv = Array.isArray(recvData?.received) ? recvData.received : [];
    // Los endpoints devuelven TODOS los routed; se filtra por el proceso abierto.
    routedSends.value = pid ? allSends.filter((s) => String(s.process_id) === pid) : allSends;
    routedReceived.value = pid ? allRecv.filter((r) => String(r.process_id) === pid) : allRecv;
  } catch {
    routedSends.value = [];
    routedReceived.value = [];
  } finally {
    routedInboxLoading.value = false;
  }
};
watch(
  () => `${selectedProcessContext.value?.id || ''}:${isRoutedProcess.value}`,
  () => { loadRoutedInbox(); },
);

// El proceso por defecto es el comodín "Tareas"; los demás routed usan su propio nombre.
const isDefaultRoutedProcess = computed(() => String(selectedProcessContext.value?.slug || '') === 'default');
// Etiqueta del CTA: "Nueva tarea" (default) o "Nuevo <proceso>" (Memorandum → "Nuevo Memorandum").
const routedCreateLabel = computed(() => {
  if (isDefaultRoutedProcess.value) return 'Nueva tarea';
  const name = selectedProcessContext.value?.name
    || selectedProcessPanel.value?.definition?.process_name
    || 'documento';
  return `Nuevo ${name}`;
});
const routedPanelPurpose = computed(() => (isDefaultRoutedProcess.value
  ? 'Crea una tarea y endósala a la persona responsable. Lo que te asignen aparece en Recibidos y en tu Centro de firmas.'
  : `Crea un ${selectedProcessContext.value?.name || 'documento'} y endósalo a una persona. Lo recibido aparece en Recibidos y en tu Centro de firmas.`));
// Rótulo del proceso en el aside: el default se muestra como "Tareas"; el resto conserva su nombre.
const routedMenuLabel = (process) => (String(process?.slug || '') === 'default' ? 'Tareas' : (process?.name || ''));
// Título de cabecera para un proceso routed (default → "Tareas").
const routedHeaderTitle = computed(() => (isDefaultRoutedProcess.value
  ? 'Tareas'
  : (selectedProcessContext.value?.name || selectedProcessPanel.value?.definition?.name || 'Proceso')));

// R4: consolidado "Mis envíos" — todo lo que el usuario envió (routed) entre tipos, con filtro por tipo.
const mySendsModal = ref(null);
let mySendsModalInstance = null;
const mySends = ref([]);
const mySendsLoading = ref(false);
const mySendsTypeFilter = ref('all');
const mySendsTypes = computed(() => {
  const set = new Map();
  (mySends.value || []).forEach((s) => { if (s.process_name) set.set(String(s.process_id), s.process_name); });
  return Array.from(set, ([id, name]) => ({ id, name }));
});
const filteredMySends = computed(() => {
  const f = mySendsTypeFilter.value;
  return (mySends.value || []).filter((s) => f === 'all' || String(s.process_id) === f);
});
const openMySends = async () => {
  mySendsTypeFilter.value = 'all';
  mySendsLoading.value = true;
  mySendsModalInstance = Modal.getOrCreateInstance(mySendsModal.value?.el);
  mySendsModalInstance?.show();
  try {
    const data = await processPanelService.listMySends(currentUserId.value);
    mySends.value = Array.isArray(data?.sends) ? data.sends : [];
  } catch {
    mySends.value = [];
  } finally {
    mySendsLoading.value = false;
  }
};

const openDerivedTaskFromWorkspace = () => {
  const subject = deliverableWorkspaceSubject.value ? getDeliverableSubject(deliverableWorkspaceSubject.value) : null;
  if (!subject?.taskId) {
    setProcessActionInfo('No se pudo resolver la tarea de origen para agregar el entregable.', 'error');
    return;
  }
  deliverableWorkspaceModalInstance?.hide();
  openGeneralTaskModal('derived', {
    sourceTaskId: subject.taskId,
    unitId: subject.scopeUnitId || subject.originUnitId || null,
  });
};

const goToNextTaskLaunchStep = () => {
  if (!canAdvanceTaskLaunchStep.value) {
    return;
  }
  taskLaunchStep.value = Math.min(taskLaunchStep.value + 1, taskLaunchSteps.length);
};

const goToPreviousTaskLaunchStep = () => {
  taskLaunchStep.value = Math.max(taskLaunchStep.value - 1, 1);
};

const submitTaskLaunch = async () => {
  if (!selectedProcessPanel.value || !canSubmitTaskLaunch.value) {
    return;
  }
  taskLaunchSubmitting.value = true;
  taskLaunchError.value = '';
  try {
    const payload = {
      description: taskLaunchForm.value.description || null
    };
    if (taskLaunchUseCustomTerm.value) {
      payload.custom_term = {
        name: taskLaunchForm.value.custom_name,
        start_date: taskLaunchForm.value.custom_start_date,
        end_date: taskLaunchForm.value.custom_end_date
      };
    } else {
      payload.term_id = Number(taskLaunchForm.value.term_id);
    }

    await processPanelService.createTask(
      currentUserId.value,
      selectedProcessPanel.value.definition.id,
      payload
    );

    processActionMessage.value = {
      type: 'success',
      text: 'El proceso se lanzó correctamente para el periodo seleccionado.'
    };
    closeTaskLaunchModal();
    await loadSelectedProcessPanel({
      process_definition_id: selectedProcessPanel.value.definition.id
    });
  } catch (error) {
    console.error('Error al crear la tarea manual:', error);
    taskLaunchError.value = error?.response?.data?.message || 'No se pudo crear la tarea manual.';
  } finally {
    taskLaunchSubmitting.value = false;
  }
};

const loadUserMenu = async () => {
  const userId = currentUser.value?.id ?? currentUser.value?._id;
  if (!userId) {
    return;
  }
  menuLoading.value = true;
  menuError.value = '';

  try {
    const data = await menuService.getUserMenu(userId);
    userUnits.value = Array.isArray(data?.units) ? data.units : [];
    unitGroups.value = Array.isArray(data?.unit_groups) ? data.unit_groups : [];
    consolidatedCargos.value = Array.isArray(data?.consolidated) ? data.consolidated : [];

    if (!unitGroups.value.length && userUnits.value.length) {
      unitGroups.value = [
        {
          id: 'units',
          name: 'Unidades',
          label: 'Unidades',
          units: userUnits.value
        }
      ];
    }

    if (userUnits.value.length) {
      // Default: seleccionar primera unidad (la carrera/área directa del usuario)
      selectUnitOption(userUnits.value[0]);
    } else if (consolidatedCargos.value.length) {
      selectConsolidated();
    } else {
      applyMenuCargos([]);
      selectedGroupId.value = null;
    }
  } catch (error) {
    console.error('Error al cargar el menú del usuario:', error);
    menuError.value = 'No se pudo cargar el menú del usuario.';
  } finally {
    menuLoading.value = false;
  }
};

onMounted(async () => {
  const userDataString = localStorage.getItem('user');
  if (userDataString) {
    try {
      currentUser.value = JSON.parse(userDataString);
      userPhoto.value = resolvePhotoUrl(currentUser.value?.photoUrl);
    } catch (error) {
      console.error('Error al cargar datos del usuario:', error);
    }
  }
  
  if (isClient) {
    window.addEventListener('resize', handleResize);
    window.addEventListener('dossier-updated', handleHomeDossierUpdated);
    document.addEventListener('click', handleGroupDropdownOutsideClick);
  }

  if (documentSignModal.value?.el) {
    documentSignModalInstance = Modal.getOrCreateInstance(documentSignModal.value.el);
    documentSignModal.value.el.addEventListener('hidden.bs.modal', () => {
      embeddedSignerRef.value?.resetToStart?.();
    });
  }
  if (taskFiltersModal.value?.el) {
    taskFiltersModalInstance = Modal.getOrCreateInstance(taskFiltersModal.value.el);
  }
  if (fillWorkflowModal.value?.el) {
    fillWorkflowModalInstance = Modal.getOrCreateInstance(fillWorkflowModal.value.el);
    fillWorkflowModal.value.el.addEventListener('hidden.bs.modal', () => {
      fillWorkflowState.value = {
        subject: null,
        request: null,
        note: '',
        error: ''
      };
    });
  }
  if (deliverableWorkspaceModal.value?.el) {
    deliverableWorkspaceModalInstance = Modal.getOrCreateInstance(deliverableWorkspaceModal.value.el);
    deliverableWorkspaceModal.value.el.addEventListener('hidden.bs.modal', () => {
      fillWorkflowState.value = {
        subject: null,
        request: null,
        note: '',
        error: ''
      };
      signatureFlowState.value = {
        loading: false,
        error: '',
        subject: null,
        documentVersionId: null,
        snapshot: null
      };
      deliverableWorkspaceState.value = { tab: 'summary' };
    });
  }
  if (deliverableUploadModal.value?.el) {
    deliverableUploadModalInstance = Modal.getOrCreateInstance(deliverableUploadModal.value.el);
    deliverableUploadModal.value.el.addEventListener('hidden.bs.modal', () => {
      selectedDeliverableUploadFile.value = null;
      pendingDeliverableUploadTarget.value = null;
    });
  }
  if (deliverableSignResultModal.value?.el) {
    deliverableSignResultModalInstance = Modal.getOrCreateInstance(deliverableSignResultModal.value.el);
    deliverableSignResultModal.value.el.addEventListener('hidden.bs.modal', () => {
      deliverableSignResultState.value = {
        success: true,
        message: '',
        signedPath: '',
        fileName: 'documento_firmado.pdf',
      };
    });
  }
  
  await loadUserMenu();
  if (workspaceRouteMode.value === 'documents') {
    await loadDocumentCenterPage();
  }
  if (workspaceRouteMode.value === 'default') {
    await loadHomeData();
  }
});

watch(
  taskLaunchUseCustomTerm,
  (enabled) => {
    if (enabled) {
      taskLaunchForm.value.term_id = '';
      return;
    }
    taskLaunchForm.value.custom_name = '';
    taskLaunchForm.value.custom_start_date = '';
    taskLaunchForm.value.custom_end_date = '';
  }
);

watch(
  () => route.fullPath,
  async () => {
    if (!String(route.path || '').startsWith('/home')) return;
    await loadUserMenu();
    if (workspaceRouteMode.value === 'documents') {
      await loadDocumentCenterPage();
    }
    if (workspaceRouteMode.value === 'default') {
      await loadHomeData();
    }
  }
);

onBeforeUnmount(() => {
  if (isClient) {
    window.removeEventListener('resize', handleResize);
    window.removeEventListener('dossier-updated', handleHomeDossierUpdated);
    document.removeEventListener('click', handleGroupDropdownOutsideClick);
  }
});

const navigateTo = (destination) => {
  switch (destination) {
    case 'home':
      router.push('/home');
      break;
    case 'home-documents':
      router.push('/home/documentos');
      break;
    case 'home-signatures':
      router.push('/home/firmas');
      break;
    case 'firmar':
      router.push({ name: 'home-signatures' });
      break;
    case 'perfil':
    default:
      router.push('/perfil');
      break;
  }
};

const setProcessActionInfo = (text, type = 'success') => {
  processActionMessage.value = { text, type };
};

const {
  generalTaskModal,
  generalTaskForm,
  generalTaskSubmitting,
  generalTaskError,
  isSendFlowModal,
  senderUnits,
  showSenderUnitSelect,
  senderUnitName,
  generalTaskModalTitle,
  openGeneralTaskModal,
  submitGeneralTask,
} = useGeneralTask({
  currentUserId,
  processPanelService,
  unitsPanelData,
  activeConsolidatedUnitTab,
  isRoutedProcess,
  routedCreateLabel,
  loadUserMenu,
  loadRoutedInbox,
  loadAddableDeliverables,
  setProcessActionInfo,
  refreshActiveProcessPanel,
  clearRecipientSearch,
  resetFlowBuilder,
  flowEntrega,
  flowFirma,
  primaryRecipientFromFlow,
});

const openDeliverableOperationModal = (payload = {}) => {
  deliverableOperationState.value = {
    title: payload.title || 'Proceso del entregable',
    type: payload.type || 'info',
    message: payload.message || '',
    detail: payload.detail || ''
  };
  deliverableOperationModalInstance = Modal.getOrCreateInstance(deliverableOperationModal.value?.el);
  deliverableOperationModalInstance?.show();
};

const sanitizeEmbeddedSignSuccessMessage = (message) => {
  const raw = String(message || '').trim();
  if (!raw) {
    return 'La firma del entregable se registró correctamente.';
  }
  const warningIndex = raw.indexOf(' Advertencia: ');
  if (warningIndex > -1) {
    return raw.slice(0, warningIndex).trim();
  }
  return raw;
};

const openDeliverableSignResultModal = (payload = {}) => {
  deliverableSignResultState.value = {
    success: payload.success !== false,
    message: payload.message || 'La firma del entregable se registró correctamente.',
    signedPath: payload.signedPath || '',
    fileName: payload.fileName || 'documento_firmado.pdf',
  };
  deliverableSignResultModalInstance = Modal.getOrCreateInstance(deliverableSignResultModal.value?.el);
  deliverableSignResultModalInstance?.show();
};

const openDeliverableResetModal = (payload) => {
  deliverableResetState.value = {
    target: getDeliverableSubject(payload),
    submitting: false,
    error: '',
  };
  deliverableResetModalInstance = Modal.getOrCreateInstance(deliverableResetModal.value?.el);
  deliverableResetModalInstance?.show();
};

const closeDeliverableResetModal = () => {
  deliverableResetState.value = {
    target: null,
    submitting: false,
    error: '',
  };
  deliverableResetModalInstance?.hide();
};

const openDeliverableUploadModal = (payload) => {
  pendingDeliverableUploadTarget.value = payload;
  selectedDeliverableUploadFile.value = null;
  deliverableUploadModalInstance = Modal.getOrCreateInstance(deliverableUploadModal.value?.el);
  deliverableUploadModalInstance?.show();
};

const closeDeliverableUploadModal = () => {
  deliverableUploadModalInstance?.hide();
};

const loadFillWorkflowState = (payload = {}) => {
  const subject = getDeliverableSubject(payload);
  const request = getCurrentFillWorkflowRequest(payload);
  fillWorkflowState.value = {
    subject,
    request,
    note: '',
    error: ''
  };
};

const openFillWorkflowModal = (payload = {}) => {
  loadFillWorkflowState(payload);
  fillWorkflowModalInstance = Modal.getOrCreateInstance(fillWorkflowModal.value?.el);
  fillWorkflowModalInstance?.show();
};

const resolvePreferredChatScopeUnitId = (payload = null) => {
  const subject = payload ? getDeliverableSubject(payload) : null;
  if (subject?.scopeUnitId) {
    return Number(subject.scopeUnitId);
  }
  const scopeIds = Array.isArray(selectedProcessPanel.value?.definition?.chat_context?.accessible_scope_unit_ids)
    ? selectedProcessPanel.value.definition.chat_context.accessible_scope_unit_ids
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0)
    : [];
  if (scopeIds.length === 1) {
    return scopeIds[0];
  }
  return null;
};

const persistWorkspaceChatContext = ({ processId, scopeUnitId = null, title = '', accessibleScopeUnitIds = [] } = {}) => {
  if (typeof window === 'undefined') return;
  const normalizedProcessId = Number(processId || 0) || null;
  if (!normalizedProcessId) {
    window.sessionStorage.removeItem(WORKSPACE_CHAT_CONTEXT_KEY);
    return;
  }

  const nextValue = {
    processId: normalizedProcessId,
    scopeUnitId: Number(scopeUnitId || 0) || null,
    title: String(title || ''),
    accessibleScopeUnitIds: Array.isArray(accessibleScopeUnitIds) ? accessibleScopeUnitIds : []
  };

  window.sessionStorage.setItem(WORKSPACE_CHAT_CONTEXT_KEY, JSON.stringify(nextValue));
  window.dispatchEvent(new CustomEvent('workspace-chat:context-updated', { detail: nextValue }));
};

const openWorkspaceProcessChat = ({ processId, scopeUnitId = null, openConversation = false } = {}) => {
  const normalizedProcessId = Number(processId || 0) || null;
  if (!normalizedProcessId) {
    setProcessActionInfo('No se pudo resolver el proceso asociado al chat.', 'error');
    return;
  }

  const detail = {
    processId: normalizedProcessId,
    scopeUnitId: Number(scopeUnitId || 0) || null,
    title: selectedProcessPanel.value?.definition?.name || selectedProcessContext.value?.name || 'Proceso',
    accessibleScopeUnitIds: Array.isArray(selectedProcessPanel.value?.definition?.chat_context?.accessible_scope_unit_ids)
      ? selectedProcessPanel.value.definition.chat_context.accessible_scope_unit_ids
      : [],
    openConversation
  };

  persistWorkspaceChatContext(detail);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('workspace-chat:open-process', { detail }));
  }
};

watch(
  () => [
    selectedProcessPanel.value?.definition?.chat_context?.process_id,
    selectedProcessPanel.value?.definition?.chat_context?.accessible_scope_unit_ids,
    selectedProcessPanel.value?.definition?.name,
    selectedProcessContext.value?.name
  ],
  () => {
    persistWorkspaceChatContext({
      processId: selectedProcessPanel.value?.definition?.chat_context?.process_id,
      scopeUnitId: resolvePreferredChatScopeUnitId(),
      title: selectedProcessPanel.value?.definition?.name || selectedProcessContext.value?.name || 'Proceso',
      accessibleScopeUnitIds: selectedProcessPanel.value?.definition?.chat_context?.accessible_scope_unit_ids || []
    });
  },
  { immediate: true, deep: true }
);

const shouldShowTemplateDownload = (payload) => {
  const subject = getDeliverableSubject(payload);
  return Boolean(subject.actions?.can_download_template && hasDeliverableBeenStarted(payload));
};

const resolveDeliverableWorkspaceTab = (payload) => {
  if (shouldShowStartDeliverable(payload)) return 'summary';
  if (shouldShowUploadDeliverable(payload) || hasPendingFillWorkflow(payload) || hasFillWorkflowActivity(payload) || shouldShowManageFill(payload)) return 'fill';
  if (shouldShowSign(payload) || hasSignatureWorkflowActivity(payload) || shouldShowSignatureFlow(payload)) return 'signature';
  return 'summary';
};

const shouldShowOpenWorkspacePrimary = (payload) => Boolean(
  !shouldShowStartDeliverable(payload)
  && !shouldShowUploadDeliverable(payload)
  && !shouldShowSign(payload)
  && (shouldShowManageFill(payload) || shouldShowSignatureFlow(payload))
);

const isReviewFillStep = computed(() => {
  const resolver = String(fillWorkflowState.value.request?.resolver_type || '').trim().toLowerCase();
  return ['cargo_in_scope', 'position', 'specific_person'].includes(resolver);
});
const fillApproveActionLabel = computed(() => (isReviewFillStep.value ? 'Aprobar' : 'Enviar'));

const canOperateCurrentFillRequest = computed(() =>
  currentUserCanOperateFillStep(fillWorkflowState.value.subject)
  || isFillRequestActionableByCurrentUser(fillWorkflowState.value.request)
);
const fillWorkflowNotes = computed(() => {
  const steps = fillWorkflowState.value.subject?.workflow?.fill_steps || [];
  return steps
    .filter((step) => String(step?.response_note || '').trim())
    .map((step) => ({
      stepId: Number(step.id || 0),
      requestId: getFillRequestId(step),
      stepOrder: Number(step.step_order || 0),
      label: step.display_label || 'Responsable no resuelto',
      note: String(step.response_note || '').trim(),
      statusLabel: getFillStepStatusLabel(step.request_status),
      respondedAt: step.responded_at || null,
      respondedAtLabel: formatWorkflowDateTime(step.responded_at)
    }))
    .sort((a, b) => {
      const timeA = a.respondedAt ? new Date(a.respondedAt).getTime() : 0;
      const timeB = b.respondedAt ? new Date(b.respondedAt).getTime() : 0;
      return timeB - timeA;
    });
});
const canReplaceFillFile = computed(() => {
  const subject = fillWorkflowState.value.subject;
  if (!subject) return false;
  return Boolean(
    subject.actions?.can_upload_deliverable
    && canOperateCurrentFillRequest.value
    && subjectHasWorkingArtifact(subject)
  );
});
const canApproveFillRequest = computed(() => {
  const code = getFillRequestStatusCode(fillWorkflowState.value.request);
  return canOperateCurrentFillRequest.value
    && ['pending', 'in_progress'].includes(code)
    && subjectHasWorkingArtifact(fillWorkflowState.value.subject);
});
const canReturnFillRequest = computed(() =>
  canOperateCurrentFillRequest.value
  && isReviewFillStep.value
  && ['pending', 'in_progress'].includes(getFillRequestStatusCode(fillWorkflowState.value.request))
);
const canRejectFillRequest = computed(() =>
  canOperateCurrentFillRequest.value
  && isReviewFillStep.value
  && ['pending', 'in_progress'].includes(getFillRequestStatusCode(fillWorkflowState.value.request))
);
const canCancelFillRequest = computed(() =>
  canOperateCurrentFillRequest.value && ['pending', 'in_progress'].includes(getFillRequestStatusCode(fillWorkflowState.value.request))
);
const canReplacePreviewFillFile = computed(() =>
  Boolean(deliverablePreviewSource.value)
  && shouldShowUploadDeliverable(deliverablePreviewSource.value)
);
const canApprovePreviewFillRequest = computed(() =>
  Boolean(deliverablePreviewSource.value)
  && canApproveFillRequestForPayload(deliverablePreviewSource.value)
);
const canReturnPreviewFillRequest = computed(() =>
  Boolean(deliverablePreviewSource.value)
  && canReturnFillRequestForPayload(deliverablePreviewSource.value)
);
const canRejectPreviewFillRequest = computed(() =>
  Boolean(deliverablePreviewSource.value)
  && canRejectFillRequestForPayload(deliverablePreviewSource.value)
);
const hasDeliverablePreviewActions = computed(() =>
  canReplacePreviewFillFile.value
  || canApprovePreviewFillRequest.value
  || canReturnPreviewFillRequest.value
  || canRejectPreviewFillRequest.value
);

const deliverableCardHelpers = {
  getDeliverableCardTone,
  getDeliverableStateIcon,
  isDeliverableCollapsed,
  getDeliverableUnitLabel,
  getDeliverablePeriodLabel,
  getDeliverableHeaderActionTone,
  getDeliverableProgress,
  getDeliverableDueState,
  getDeliverableCurrentResponsibility,
  shouldShowStartDeliverable,
  canStartDeliverableAction,
  shouldShowUploadDeliverable,
  getUploadActionLabel,
  shouldShowSign,
  canApproveFillRequestForPayload,
  getFillApproveActionLabelForPayload,
  getDeliverableSubject,
  shouldShowTemplateDownload,
};

const fetchDeliverableFileBlob = async (payload, kind = 'best') => {
  const subject = getDeliverableSubject(payload);
  const userId = currentUserId.value;
  const definitionId = Number(subject.processDefinitionId || selectedProcessContext.value?.process_definition_id || selectedProcessKey.value);
  return processPanelService.downloadDeliverableFile(userId, definitionId, subject.itemId, kind, {
    documentId: subject.documentId || null,
  });
};

const downloadBlob = (blob, fileName) => {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
};

const fetchSignedDeliverableResultBlob = async () => {
  const signedPath = String(deliverableSignResultState.value.signedPath || '').trim();
  if (!signedPath) {
    throw new Error('No se encontró el documento firmado para descargar.');
  }
  const response = await fetch(`${API_ROUTES.SIGN}/download?path=${encodeURIComponent(signedPath)}`, {
    headers: {
      ...processPanelService.getAuthHeaders(),
    },
  });
  if (!response.ok) {
    throw new Error('No se pudo descargar el documento firmado.');
  }
  return response.blob();
};

const viewSignedDeliverableResult = async () => {
  try {
    const blob = await fetchSignedDeliverableResultBlob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (error) {
    setProcessActionInfo(
      error?.message || 'No se pudo visualizar el documento firmado.',
      'error'
    );
  }
};

const downloadSignedDeliverableResult = async () => {
  try {
    const blob = await fetchSignedDeliverableResultBlob();
    downloadBlob(blob, deliverableSignResultState.value.fileName || 'documento_firmado.pdf');
  } catch (error) {
    setProcessActionInfo(
      error?.message || 'No se pudo descargar el documento firmado.',
      'error'
    );
  }
};

// La vista previa y la descarga del fichero de un entregable viven en useDeliverableFilePreview: el
// centro documental las necesita igual y no puede depender de esta pantalla. Se le inyectan las tres
// piezas que si son de aqui: getDeliverableSubject (que enriquece con el proceso seleccionado), la
// descarga del blob, y el canal de avisos.
const {
  previewModal: deliverablePreviewModal,
  previewUrl: deliverablePreviewUrl,
  previewName: deliverablePreviewName,
  previewSource: deliverablePreviewSource,
  previewIsPdf: deliverablePreviewIsPdf,
  previewFile: previewDeliverableFile,
  downloadFile: downloadDeliverableFile,
  downloadPreviewed: downloadPreviewedFile,
  hidePreview: hideDeliverablePreview,
} = useDeliverableFilePreview({
  getSubject: getDeliverableSubject,
  fetchBlob: fetchDeliverableFileBlob,
  onError: (message) => setProcessActionInfo(message, 'error'),
});

const openPreviewDeliverableUploadModal = () => {
  if (!deliverablePreviewSource.value || isUploadingDeliverable.value) return;
  hideDeliverablePreview();
  openDeliverableUploadModal(deliverablePreviewSource.value);
};

const handleDeliverableFutureAction = (action, payload) => {
  const subject = getDeliverableSubject(payload);
  if (action === 'upload_deliverable') {
    if (isUploadingDeliverable.value) {
      return;
    }
    openDeliverableUploadModal(payload);
    return;
  }
  if (action === 'manage_fill') {
    openFillWorkflowModal(payload);
    return;
  }
  if (action === 'download_template') {
    downloadDeliverableTemplate(payload);
    return;
  }
  if (action === 'review_signature_flow') {
    openSignatureFlowModal(payload);
    return;
  }
  if (action === 'process_chat') {
    openWorkspaceProcessChat({
      processId: Number(subject.processId || 0),
      scopeUnitId: resolvePreferredChatScopeUnitId(payload),
      openConversation: true
    });
    return;
  }
  const actionLabels = {
    manage_fill: 'La gestión operativa de la entrega',
    download_template: 'La descarga de la plantilla',
    upload_deliverable: 'La subida del archivo del entregable',
    review_signature_flow: 'La revisión del flujo de firmas',
    process_chat: 'El chat del proceso'
  };
  setProcessActionInfo(
    `${actionLabels[action] || 'Esta acción'} todavía no está implementada en este panel. Entregable: ${subject.title}.`,
    'error'
  );
};

const triggerFillWorkflowFileReplace = () => {
  if (!fillWorkflowState.value.subject || isUploadingDeliverable.value) return;
  openDeliverableUploadModal(fillWorkflowState.value.subject);
};

const startDeliverableFlow = async (payload) => {
  const subject = getDeliverableSubject(payload);
  const request = getCurrentFillWorkflowRequest(payload);
  const requestId = getFillRequestId(request);
  if (!requestId) {
    setProcessActionInfo(`No se encontró una solicitud inicial de entrega para ${subject.title}.`, 'error');
    return;
  }
  try {
    processingFillItemId.value = Number(subject.itemId || 0);
    if (subject.itemId) {
      startedDeliverableIds.value = new Set([...startedDeliverableIds.value, Number(subject.itemId)]);
    }
    openDeliverableOperationModal({
      title: 'Iniciando entregable',
      type: 'info',
      message: `Se está iniciando el trabajo sobre ${subject.title}...`,
      detail: `Paso ${request.step_order || 1}`
    });
    await processPanelService.startFillRequest(requestId, {
      note: 'Inicio del flujo desde el panel del entregable.'
    });
    if (selectedProcessContext.value) {
      await refreshActiveProcessPanel();
    }
    openDeliverableOperationModal({
      title: 'Entregable iniciado',
      type: 'success',
      message: `El entregable ${subject.title} quedó iniciado.`,
      detail: 'Ahora ya puedes descargar la plantilla y subir el archivo de trabajo.'
    });
    setProcessActionInfo(`El entregable ${subject.title} quedó iniciado correctamente.`, 'success');
  } catch (error) {
    if (subject.itemId) {
      const nextSet = new Set(startedDeliverableIds.value);
      nextSet.delete(Number(subject.itemId));
      startedDeliverableIds.value = nextSet;
    }
    const message = error?.response?.data?.error || error?.response?.data?.message || error?.message || 'No se pudo iniciar el entregable.';
    openDeliverableOperationModal({
      title: 'Error al iniciar entregable',
      type: 'error',
      message,
      detail: subject.title
    });
    setProcessActionInfo(message, 'error');
  } finally {
    processingFillItemId.value = null;
  }
};

const submitFillWorkflowAction = async (action) => {
  const subject = fillWorkflowState.value.subject;
  const request = fillWorkflowState.value.request;
  const requestId = getFillRequestId(request);
  if (!subject || !requestId) {
    fillWorkflowState.value.error = 'No se encontró una solicitud de entrega válida.';
    return;
  }
  if (action === 'approve' && !subject.preloadFilePath) {
    fillWorkflowState.value.error = 'Primero debes cargar un archivo de trabajo para aprobar la entrega.';
    return;
  }

  const actionLabels = {
    start: 'inicio',
    approve: 'aprobación',
    return: 'devolución',
    reject: 'rechazo',
    cancel: 'cancelación'
  };

  try {
    fillWorkflowSubmitting.value = true;
    fillWorkflowState.value.error = '';
    openDeliverableOperationModal({
      title: 'Actualizando flujo de entrega',
      type: 'info',
      message: `Procesando ${actionLabels[action] || 'acción'} para ${subject.title}...`,
      detail: `Paso ${request.step_order || 1}`
    });

    const payload = fillWorkflowState.value.note ? { note: fillWorkflowState.value.note } : {};
    if (action === 'start') {
      await processPanelService.startFillRequest(requestId, payload);
    } else if (action === 'approve') {
      await processPanelService.approveFillRequest(requestId, payload);
    } else if (action === 'return') {
      await processPanelService.returnFillRequest(requestId, payload);
    } else if (action === 'reject') {
      await processPanelService.rejectFillRequest(requestId, payload);
    } else if (action === 'cancel') {
      await processPanelService.cancelFillRequest(requestId, payload);
    } else {
      throw new Error('Acción de entrega no soportada.');
    }

    openDeliverableOperationModal({
      title: 'Flujo de entrega actualizado',
      type: 'success',
      message: `La ${actionLabels[action] || 'acción'} del entregable ${subject.title} se completó correctamente.`,
      detail: 'El panel se actualizará con el nuevo estado.'
    });
    setProcessActionInfo(`El flujo de entrega de ${subject.title} se actualizó correctamente.`, 'success');
    fillWorkflowModalInstance?.hide();
    closeDeliverableWorkspaceModal();
    if (selectedProcessContext.value) {
      await refreshActiveProcessPanel();
    }
  } catch (error) {
    const message = error?.response?.data?.error || error?.response?.data?.message || error?.message || 'No se pudo actualizar el flujo de entrega.';
    fillWorkflowState.value.error = message;
    openDeliverableOperationModal({
      title: 'Error en flujo de entrega',
      type: 'error',
      message,
      detail: subject.title
    });
    setProcessActionInfo(message, 'error');
  } finally {
    fillWorkflowSubmitting.value = false;
  }
};

const submitDeliverableCardFillAction = async (payload, action = 'approve') => {
  const subject = getDeliverableSubject(payload);
  const request = getCurrentFillWorkflowRequest(payload);
  const requestId = getFillRequestId(request);
  if (!subject || !requestId) {
    setProcessActionInfo('No se encontró una solicitud de entrega válida.', 'error');
    return;
  }
  if (action === 'approve' && !subject.preloadFilePath) {
    setProcessActionInfo('Primero debes cargar un archivo de trabajo para continuar.', 'error');
    return;
  }

  const actionLabels = {
    approve: isReviewFillRequestForPayload(payload) ? 'aprobación' : 'envío',
    return: 'devolución',
    reject: 'rechazo'
  };

  try {
    fillWorkflowSubmitting.value = true;
    openDeliverableOperationModal({
      title: 'Actualizando flujo de entrega',
      type: 'info',
      message: `Procesando ${actionLabels[action] || 'acción'} para ${subject.title}...`,
      detail: `Paso ${request.step_order || 1}`
    });

    const requestPayload = {};
    if (action === 'approve') {
      await processPanelService.approveFillRequest(requestId, requestPayload);
    } else if (action === 'return') {
      await processPanelService.returnFillRequest(requestId, requestPayload);
    } else if (action === 'reject') {
      await processPanelService.rejectFillRequest(requestId, requestPayload);
    } else {
      throw new Error('Acción de entrega no soportada.');
    }

    openDeliverableOperationModal({
      title: 'Flujo de entrega actualizado',
      type: 'success',
      message: `La ${actionLabels[action] || 'acción'} del entregable ${subject.title} se completó correctamente.`,
      detail: 'El panel se actualizará con el nuevo estado.'
    });
    setProcessActionInfo(`El flujo de entrega de ${subject.title} se actualizó correctamente.`, 'success');
    hideDeliverablePreview();
    if (selectedProcessContext.value) {
      await refreshActiveProcessPanel();
    }
  } catch (error) {
    const message = error?.response?.data?.error || error?.response?.data?.message || error?.message || 'No se pudo actualizar el flujo de entrega.';
    openDeliverableOperationModal({
      title: 'Error en flujo de entrega',
      type: 'error',
      message,
      detail: subject.title
    });
    setProcessActionInfo(message, 'error');
  } finally {
    fillWorkflowSubmitting.value = false;
  }
};

const downloadDeliverableTemplate = async (payload) => {
  const subject = getDeliverableSubject(payload);
  try {
    const userId = currentUserId.value;
    const definitionId = Number(selectedProcessContext.value?.process_definition_id || selectedProcessKey.value);
    const download = await processPanelService.downloadDeliverableTemplate(userId, definitionId, subject.itemId);
    downloadBlob(download.blob, download.fileName || 'plantilla.zip');
    setProcessActionInfo(`La plantilla de ${subject.title} se descargó correctamente.`, 'success');
  } catch (error) {
    setProcessActionInfo(
      error?.response?.data?.message || error?.message || 'No se pudo descargar la plantilla del entregable.',
      'error'
    );
  }
};

const clearDeliverableUploadSelection = () => {
  selectedDeliverableUploadFile.value = null;
};

const handleDeliverableFilesSelected = (files) => {
  selectedDeliverableUploadFile.value = files?.[0] || null;
};

const handleInlineDeliverableUpload = async (payload, files) => {
  if (!files?.length || isUploadingDeliverable.value) return;
  pendingDeliverableUploadTarget.value = payload;
  selectedDeliverableUploadFile.value = files[0] || null;
  await uploadSelectedDeliverableFile(files[0]);
};

const uploadSelectedDeliverableFile = async (file) => {
  const target = pendingDeliverableUploadTarget.value;
  if (!file || !target) {
    pendingDeliverableUploadTarget.value = null;
    selectedDeliverableUploadFile.value = null;
    return;
  }

  const lowerName = file.name.toLowerCase();
  const allowedExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx'];
  const isAllowed = allowedExtensions.some((extension) => lowerName.endsWith(extension));
  if (!isAllowed) {
    setProcessActionInfo('Solo puedes cargar archivos PDF, Word o Excel para el entregable.', 'error');
    pendingDeliverableUploadTarget.value = null;
    selectedDeliverableUploadFile.value = null;
    return;
  }

  try {
    isUploadingDeliverable.value = true;
    closeDeliverableUploadModal();
    openDeliverableOperationModal({
      title: 'Cargando archivo del entregable',
      type: 'info',
      message: `Subiendo ${file.name}...`,
      detail: `Entregable: ${target.title || target.template_artifact_name || `#${target.itemId || target.id}`}`
    });
    const userId = currentUserId.value;
    const definitionId = Number(selectedProcessContext.value?.process_definition_id || selectedProcessKey.value);
    const taskItemId = Number(target.itemId || target.id || 0);
    const uploadResult = await processPanelService.uploadDeliverableFile(userId, definitionId, taskItemId, file, {
      documentId: Number(target.documentId || 0) || null,
    });
    setProcessActionInfo(`El archivo del entregable ${target.title || target.template_artifact_name || `#${taskItemId}`} se cargó correctamente.`, 'success');
    openDeliverableOperationModal({
      title: 'Archivo cargado',
      type: 'success',
      message: 'El archivo del entregable se cargó correctamente.',
      detail: `Ruta de trabajo: ${uploadResult?.working_file_path || file.name}`
    });
    if (selectedProcessContext.value) {
      await refreshActiveProcessPanel();
    }
  } catch (error) {
    openDeliverableOperationModal({
      title: 'Error al cargar archivo',
      type: 'error',
      message: error?.response?.data?.message || error?.message || 'No se pudo cargar el archivo del entregable.',
      detail: target.title || target.template_artifact_name || `Entregable #${target.itemId || target.id}`
    });
    setProcessActionInfo(
      error?.response?.data?.message || error?.message || 'No se pudo cargar el archivo del entregable.',
      'error'
    );
  } finally {
    isUploadingDeliverable.value = false;
    pendingDeliverableUploadTarget.value = null;
    selectedDeliverableUploadFile.value = null;
  }
};

const submitDeliverableUpload = async () => {
  if (!selectedDeliverableUploadFile.value || isUploadingDeliverable.value) return;
  await uploadSelectedDeliverableFile(selectedDeliverableUploadFile.value);
};

const openDocumentSignFlow = (payload) => {
  const doc = getDeliverableSubject(payload);
  if (!doc?.actions?.can_sign) {
    if (doc.preloadFilePath && !isPdfWorkingFile(payload)) {
      setProcessActionInfo(
        `El entregable ${doc.title} tiene un archivo de trabajo ${getFileExtension(doc.preloadFilePath).toUpperCase()}. Primero debe existir un PDF de trabajo para firmar.`,
        'error'
      );
    }
    return;
  }
  if (doc.preloadFilePath && !isPdfWorkingFile(payload)) {
    setProcessActionInfo(
      `El entregable ${doc.title} todavía no tiene un PDF listo para firma. Debes generar o cargar un PDF de trabajo antes de firmar.`,
      'error'
    );
    return;
  }
  const pendingSignatureRequest = getCurrentSignatureRequestsFromSubject(doc).find((request) => {
    const code = String(request?.request_status_code || request?.status_name || request?.status || '').trim().toLowerCase();
    return ['pendiente', 'pending', 'en_progreso', 'in_progress'].includes(code)
      && !request?.responded_at
      && Number(request?.assigned_person_id || 0) === Number(currentUserId.value || 0);
  });
  if (!pendingSignatureRequest?.id || !doc.documentVersionId) {
    setProcessActionInfo(
      `No se encontró una solicitud de firma pendiente para ${doc.title}.`,
      'error'
    );
    return;
  }
  deliverableWorkspaceModalInstance?.hide();
  fillWorkflowModalInstance?.hide();
  signatureFlowModalInstance?.hide();
  documentSignModalInstance = Modal.getOrCreateInstance(documentSignModal.value?.el);
  documentSignModalInstance?.show();
  nextTick(() => {
    embeddedSignerRef.value?.resetToStart?.();
    embeddedSignerRef.value?.initializeWorkflowSignatureSession?.({
      signatureRequestId: pendingSignatureRequest.id,
      documentVersionId: doc.documentVersionId,
      taskItemId: doc.itemId,
      processDefinitionId: Number(selectedProcessContext.value?.process_definition_id || selectedProcessKey.value),
      documentTitle: doc.title,
      documentVersionLabel: payload?.document_version ? `v${payload.document_version}` : `#${doc.documentVersionId}`,
      preloadPdfPath: doc.preloadPdfPath
    });
  });
};

const signatureRequestPendingCodes = new Set(['pendiente', 'en_progreso']);

const resetSignatureFlowState = () => {
  signatureFlowState.value = {
    loading: false,
    error: '',
    subject: null,
    documentVersionId: null,
    snapshot: null
  };
  signatureFlowSignerRef.value?.resetToStart?.();
};

const closeSignatureFlowModal = () => {
  signatureFlowModalInstance?.hide();
  resetSignatureFlowState();
};

const prepareSignatureSession = async () => {
  const snapshot = signatureFlowState.value.snapshot;
  if (!snapshot?.canOperate) {
    signatureFlowSignerRef.value?.resetToStart?.();
    return;
  }
  const pendingRequest = (snapshot.signatureRequests || []).find((request) => {
    const code = String(request.requestStatusCode || "").trim().toLowerCase();
    return signatureRequestPendingCodes.has(code);
  });
  if (!pendingRequest) {
    signatureFlowSignerRef.value?.resetToStart?.();
    return;
  }
  await nextTick(() => {
    signatureFlowSignerRef.value?.resetToStart?.();
    signatureFlowSignerRef.value?.initializeWorkflowSignatureSession?.({
      signatureRequestId: pendingRequest.id,
      documentVersionId: signatureFlowState.value.documentVersionId,
      taskItemId: signatureFlowState.value.subject?.itemId,
      processDefinitionId: Number(selectedProcessContext.value?.process_definition_id || selectedProcessKey.value || 0),
      documentTitle: signatureFlowState.value.subject?.title,
      documentVersionLabel: signatureFlowState.value.subject?.documentVersion ? `v${signatureFlowState.value.subject.documentVersion}` : `#${signatureFlowState.value.documentVersionId}`,
      preloadPdfPath: signatureFlowState.value.subject?.preloadPdfPath
    });
  });
};

const loadSignatureFlowState = async (payload) => {
  const subject = getDeliverableSubject(payload);
  const documentVersionId = subject.documentVersionId;
  if (!documentVersionId) {
    setProcessActionInfo(`No se encontró la versión documental asociada a ${subject.title}.`, 'error');
    return false;
  }
  signatureFlowState.value = {
    loading: true,
    error: '',
    subject,
    documentVersionId,
    snapshot: null
  };
  try {
    const snapshot = await signatureFlowService.getSignatureFlow(documentVersionId);
    signatureFlowState.value.snapshot = snapshot;
    signatureFlowState.value.error = '';
    await prepareSignatureSession();
    return true;
  } catch (error) {
    signatureFlowState.value.error = error?.response?.data?.message || error?.message || 'No se pudo cargar el flujo de firmas.';
    return false;
  } finally {
    signatureFlowState.value.loading = false;
  }
};

const openSignatureFlowModal = async (payload) => {
  const loaded = await loadSignatureFlowState(payload);
  if (!loaded) return;
  signatureFlowModalInstance = Modal.getOrCreateInstance(signatureFlowModal.value?.el);
  signatureFlowModalInstance?.show();
};

const handleEmbeddedWorkflowSigned = async (payload = {}) => {
  const documentVersionId = Number(payload?.documentVersionId || 0);
  const currentSignatureFlowDocumentVersionId = Number(signatureFlowState.value?.documentVersionId || 0);
  const signedPath = String(payload?.signedPath || '').trim();
  const successMessage = sanitizeEmbeddedSignSuccessMessage(payload?.message);
  const resultFileName = `documento_firmado_${documentVersionId || 'flujo'}.pdf`;

  documentSignModalInstance?.hide();

  if (selectedProcessContext.value || selectedProcessPanels.value.length) {
    await refreshActiveProcessPanel();
  }

  if (documentVersionId && currentSignatureFlowDocumentVersionId && documentVersionId === currentSignatureFlowDocumentVersionId) {
    const refreshed = await loadSignatureFlowState(signatureFlowState.value.subject);
    if (!refreshed) {
      closeSignatureFlowModal();
    }
  }

  processActionMessage.value = null;
  openDeliverableSignResultModal({
    success: true,
    message: successMessage,
    signedPath,
    fileName: resultFileName,
  });
};

const observationContext = (payload) => {
  const subject = getDeliverableSubject(payload);
  const userId = currentUserId.value;
  const definitionId = Number(selectedProcessContext.value?.process_definition_id || selectedProcessKey.value);
  const taskItemId = Number(subject?.itemId || 0);
  return { userId, definitionId, taskItemId };
};

const loadDeliverableObservations = async (payload) => {
  const { userId, definitionId, taskItemId } = observationContext(payload);
  deliverableObservations.value = [];
  observationsCanAdd.value = false;
  if (!userId || !definitionId || !taskItemId) {
    return;
  }
  observationsLoading.value = true;
  try {
    const data = await processPanelService.listTaskItemObservations(userId, definitionId, taskItemId);
    deliverableObservations.value = Array.isArray(data?.observations) ? data.observations : [];
    observationsCanAdd.value = Boolean(data?.can_add);
  } catch (error) {
    deliverableObservations.value = [];
    observationsCanAdd.value = false;
  } finally {
    observationsLoading.value = false;
  }
};

const submitDeliverableObservation = async ({ message, phase = 'review' } = {}) => {
  const text = String(message || '').trim();
  if (!text || submittingObservation.value) {
    return;
  }
  const { userId, definitionId, taskItemId } = observationContext(deliverableWorkspaceSubject.value);
  if (!userId || !definitionId || !taskItemId) {
    return;
  }
  submittingObservation.value = true;
  try {
    await processPanelService.addTaskItemObservation(userId, definitionId, taskItemId, { message: text, phase });
    await loadDeliverableObservations(deliverableWorkspaceSubject.value);
  } catch (error) {
    setProcessActionInfo(error?.response?.data?.message || 'No se pudo agregar la observación.', 'error');
  } finally {
    submittingObservation.value = false;
  }
};

const resolveDeliverableObservation = async (observation) => {
  if (!observation?.id || resolvingObservationId.value) {
    return;
  }
  const { userId, definitionId, taskItemId } = observationContext(deliverableWorkspaceSubject.value);
  if (!userId || !definitionId || !taskItemId) {
    return;
  }
  resolvingObservationId.value = observation.id;
  try {
    await processPanelService.resolveTaskItemObservation(userId, definitionId, taskItemId, observation.id);
    await loadDeliverableObservations(deliverableWorkspaceSubject.value);
  } catch (error) {
    setProcessActionInfo(error?.response?.data?.message || 'No se pudo resolver la observación.', 'error');
  } finally {
    resolvingObservationId.value = null;
  }
};

const openDeliverableWorkspaceModal = async (payload) => {
  const canManageFill = shouldShowManageFill(payload);
  const canReviewSignatureFlow = shouldShowSignatureFlow(payload);

  loadFillWorkflowState(payload);
  loadDeliverableObservations(payload);
  deliverableWorkspaceState.value = {
    tab: resolveDeliverableWorkspaceTab(payload)
  };
  loadDeliverableAttachments(payload);

  if (canReviewSignatureFlow) {
    await loadSignatureFlowState(payload);
  } else {
    signatureFlowState.value = {
      loading: false,
      error: '',
      subject: null,
      documentVersionId: null,
      snapshot: null
    };
  }

  deliverableWorkspaceModalInstance = Modal.getOrCreateInstance(deliverableWorkspaceModal.value?.el);
  deliverableWorkspaceModalInstance?.show();
};

const closeDeliverableWorkspaceModal = () => {
  deliverableWorkspaceModalInstance?.hide();
};

const submitDeliverableReset = async () => {
  const target = deliverableResetState.value.target;
  if (!target || deliverableResetState.value.submitting) return;

  try {
    deliverableResetState.value.submitting = true;
    deliverableResetState.value.error = '';
    const userId = currentUserId.value;
    const definitionId = Number(selectedProcessContext.value?.process_definition_id || selectedProcessKey.value);
    const taskItemId = Number(target.itemId || 0);

    if (!userId || !definitionId || !taskItemId) {
      throw new Error('No se pudo resolver el contexto del reset del entregable.');
    }

    openDeliverableOperationModal({
      title: 'Reseteando flujo',
      type: 'info',
      message: `Se está creando una nueva versión para ${target.title}...`,
      detail: 'El intento actual quedará cancelado.'
    });

    const result = await processPanelService.resetDeliverableWorkflow(userId, definitionId, taskItemId, {
      documentId: Number(target.documentId || 0) || null,
    });

    closeDeliverableResetModal();
    fillWorkflowModalInstance?.hide();
    signatureFlowModalInstance?.hide();
    deliverableWorkspaceModalInstance?.hide();
    documentSignModalInstance?.hide();
    resetSignatureFlowState();

    if (selectedProcessContext.value) {
      await refreshActiveProcessPanel();
    }

    openDeliverableOperationModal({
      title: 'Flujo reseteado',
      type: 'success',
      message: `Se creó la versión v${result?.new_document_version ?? 'nueva'} para ${target.title}.`,
      detail: 'La versión anterior quedó cancelada y el flujo volvió al inicio.'
    });
    setProcessActionInfo(`El flujo de ${target.title} se reseteó correctamente.`, 'success');
  } catch (error) {
    const message = error?.response?.data?.message || error?.message || 'No se pudo resetear el flujo del entregable.';
    deliverableResetState.value.error = message;
    openDeliverableOperationModal({
      title: 'Error al resetear flujo',
      type: 'error',
      message,
      detail: target.title
    });
    setProcessActionInfo(message, 'error');
  } finally {
    deliverableResetState.value.submitting = false;
  }
};



const toggleNotify = () => {
  if (showNavMenu.value) {
    showNavMenu.value = false;
  }
  showNotify.value = !showNotify.value;
};

</script>
<style scoped>
.deliverable-inline-upload :deep(.deasy-dropzone) {
  height: 100%;
}

.deliverable-inline-upload :deep(.deasy-dropzone__surface) {
  min-height: 3.875rem;
  height: 3.875rem;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  gap: 0.75rem;
  border-width: 2px;
  border-style: dashed;
  border-color: rgb(56 189 248);
  border-radius: 1.35rem;
  background: rgb(255 255 255);
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.04);
  padding: 0.75rem 1rem;
}

.deliverable-inline-upload :deep(.deasy-dropzone__surface--clickable:hover) {
  border-color: rgb(14 165 233);
  background: rgb(255 255 255);
  box-shadow: 0 10px 20px rgba(14, 165, 233, 0.08);
  transform: translateY(-2px);
}

.deliverable-inline-upload :deep(.deasy-dropzone__surface--active) {
  border-color: rgb(14 165 233);
  background: rgb(255 255 255);
  box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.12);
}

.deliverable-inline-upload :deep(.deasy-dropzone__trigger),
.deliverable-inline-upload :deep(.deasy-dropzone__trigger--compact) {
  flex: 1 1 auto;
  align-items: flex-start;
  text-align: left;
  justify-content: center;
}

.deliverable-inline-upload :deep(.deasy-dropzone__action) {
  font-size: 0.875rem;
  font-weight: 700;
  color: rgb(30 41 59);
}

.deliverable-inline-upload :deep(.deasy-dropzone__help) {
  display: none;
}

.deliverable-inline-upload :deep(.deasy-dropzone__icon) {
  display: inline-flex;
  height: 2.25rem;
  width: 2.25rem;
  padding: 0.5rem;
  box-sizing: border-box;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 0.85rem;
  border: 1px solid rgb(224 242 254 / 0.98);
  background: rgb(240 249 255 / 0.55);
  color: rgb(2 132 199);
  box-shadow: 0 10px 22px rgba(15, 23, 42, 0.08);
}

.deliverable-inline-upload :deep(.deasy-dropzone__icon--compact) {
  width: 2.25rem;
  height: 2.25rem;
}

.deliverable-inline-upload :deep(.deasy-dropzone__icon svg),
.deliverable-inline-upload :deep(.deasy-dropzone__icon--compact svg) {
  width: 1rem;
  height: 1rem;
}

.deliverable-due-tag--salmon {
  background: rgb(255 236 230) !important;
  border-color: rgb(254 205 190) !important;
  color: rgb(195 83 62) !important;
}
</style>
